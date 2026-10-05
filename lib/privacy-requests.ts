import { PrivacyRequestStatus, PrivacyRequestType, Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";

const DEFAULT_RESPONSE_DAYS = 45;
const RECENT_DUPLICATE_WINDOW_MS = 15 * 60 * 1000;
const TERMINAL_STATUSES = new Set<PrivacyRequestStatus>([
  PrivacyRequestStatus.COMPLETED,
  PrivacyRequestStatus.DENIED
]);

function validContactEmail(value: string | undefined) {
  const email = value?.trim().toLowerCase() ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function getPrivacyContactEmail() {
  return validContactEmail(process.env.PRIVACY_CONTACT_EMAIL);
}

export function isPrivacyRequestIntakeConfigured() {
  return process.env.PRIVACY_REQUESTS_ENABLED === "true" && getPrivacyContactEmail() !== null;
}

export function getPrivacyResponseDays() {
  const configured = Number(process.env.PRIVACY_REQUEST_RESPONSE_DAYS ?? DEFAULT_RESPONSE_DAYS);
  return Number.isInteger(configured) && configured >= 1 && configured <= 90
    ? configured
    : DEFAULT_RESPONSE_DAYS;
}

export type PrivacyRequestInput = {
  userId?: string;
  requestType: PrivacyRequestType;
  firstName: string;
  lastName: string;
  email: string;
  details?: string;
  privacyVersion: string;
};

export async function createPrivacyRequest(input: PrivacyRequestInput) {
  const recent = await db.privacyRequest.findFirst({
    where: {
      email: input.email,
      requestType: input.requestType,
      createdAt: { gte: new Date(Date.now() - RECENT_DUPLICATE_WINDOW_MS) }
    },
    orderBy: { createdAt: "desc" },
    select: { id: true }
  });
  if (recent) return { id: recent.id, created: false };

  const now = new Date();
  const dueAt = new Date(now.getTime() + getPrivacyResponseDays() * 24 * 60 * 60 * 1000);
  const request = await db.$transaction(async (tx) => {
    const created = await tx.privacyRequest.create({
      data: { ...input, dueAt }
    });
    await tx.auditEvent.create({
      data: {
        actorId: input.userId,
        action: "PRIVACY_REQUEST_CREATED",
        entityType: "PrivacyRequest",
        entityId: created.id,
        metadata: { requestType: input.requestType, dueAt: dueAt.toISOString() }
      }
    });
    return created;
  });
  return { id: request.id, created: true };
}

export async function updatePrivacyRequestStatusWorkflow(input: {
  actor: { id: string; role: Role };
  requestId: string;
  status: PrivacyRequestStatus;
  internalNote?: string | null;
}) {
  if (input.actor.role !== Role.ADMIN) throw new Error("Only an Admin can update privacy requests.");
  const internalNote = input.internalNote?.trim() || null;
  if (internalNote && internalNote.length > 2000) throw new Error("Internal note is too long.");
  if (input.status === PrivacyRequestStatus.DENIED && !internalNote) {
    throw new Error("Denied requests require an internal reason.");
  }

  const request = await db.privacyRequest.findUnique({
    where: { id: input.requestId },
    select: { status: true, requestType: true, email: true, identityVerifiedAt: true, resolvedAt: true }
  });
  if (!request) throw new Error("Privacy request not found.");

  const now = new Date();
  const marksVerified = input.status === PrivacyRequestStatus.VERIFIED;
  const requiresVerifiedIdentity = new Set<PrivacyRequestStatus>([
    PrivacyRequestStatus.IN_PROGRESS,
    PrivacyRequestStatus.COMPLETED
  ]).has(input.status);
  if (requiresVerifiedIdentity && !request.identityVerifiedAt) {
    throw new Error("Identity must be verified before processing or completing this request.");
  }
  const terminal = TERMINAL_STATUSES.has(input.status);

  await db.$transaction(async (tx) => {
    let consentRecordsRevoked = 0;
    if (input.status === PrivacyRequestStatus.COMPLETED && request.requestType === PrivacyRequestType.CONSENT_WITHDRAWAL) {
      const [winchester, checkride] = await Promise.all([
        tx.winchesterLead.updateMany({
          where: { email: request.email, contactConsent: true },
          data: { contactConsent: false }
        }),
        tx.checkrideLead.updateMany({
          where: { email: request.email, contactConsent: true },
          data: { contactConsent: false, nextFollowUpAt: null }
        })
      ]);
      consentRecordsRevoked = winchester.count + checkride.count;
    }
    await tx.privacyRequest.update({
      where: { id: input.requestId },
      data: {
        status: input.status,
        internalNote,
        identityVerifiedAt: marksVerified ? request.identityVerifiedAt ?? now : undefined,
        resolvedAt: terminal ? request.resolvedAt ?? now : null
      }
    });
    await tx.auditEvent.create({
      data: {
        actorId: input.actor.id,
        action: "PRIVACY_REQUEST_STATUS_UPDATED",
        entityType: "PrivacyRequest",
        entityId: input.requestId,
        metadata: {
          previousStatus: request.status,
          status: input.status,
          identityVerified: Boolean(request.identityVerifiedAt) || marksVerified,
          noteUpdated: internalNote !== null,
          consentRecordsRevoked
        }
      }
    });
  });
}
