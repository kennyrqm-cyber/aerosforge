import { LeadStatus, Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export type CheckrideLeadInput = {
  userId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  certificateLevel: string;
  ratingGoal: string;
  aircraft?: string;
  targetCheckride?: string;
  biggestChallenge?: string;
  preferredFormat?: string;
  source?: string;
  campaign?: string;
  contactConsent: true;
  privacyVersion: string;
};

export async function createCheckrideLead(input: CheckrideLeadInput) {
  const recent = await db.checkrideLead.findFirst({
    where: {
      email: input.email,
      createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) }
    },
    orderBy: { createdAt: "desc" },
    select: { id: true }
  });
  if (recent) return { id: recent.id, created: false };

  const lead = await db.$transaction(async (tx) => {
    const created = await tx.checkrideLead.create({
      data: {
        ...input,
        consentAt: new Date()
      }
    });
    await tx.auditEvent.create({
      data: {
        actorId: input.userId,
        action: "CHECKRIDE_LEAD_CREATED",
        entityType: "CheckrideLead",
        entityId: created.id,
        metadata: { ratingGoal: input.ratingGoal, source: input.source, campaign: input.campaign }
      }
    });
    return created;
  });
  return { id: lead.id, created: true };
}

export async function updateCheckrideLeadStatusWorkflow(input: {
  actor: { id: string; role: Role };
  leadId: string;
  status: LeadStatus;
  internalNote?: string | null;
  nextFollowUpAt?: Date | null;
  markContacted?: boolean;
}) {
  if (input.actor.role !== Role.ADMIN) throw new Error("Only an Admin can update checkride leads.");
  const internalNote = input.internalNote?.trim() || null;
  if (internalNote && internalNote.length > 2000) throw new Error("Internal note is too long.");
  if (input.nextFollowUpAt && Number.isNaN(input.nextFollowUpAt.getTime())) throw new Error("Next follow-up is invalid.");
  const lead = await db.checkrideLead.findUnique({
    where: { id: input.leadId },
    select: { status: true, contactConsent: true, consentAt: true, qualifiedAt: true, enrolledAt: true, closedAt: true }
  });
  if (!lead) throw new Error("Checkride lead not found.");
  if (input.markContacted && (!lead.contactConsent || !lead.consentAt)) throw new Error("Cannot record contact without documented consent.");
  const now = new Date();
  const qualificationStages = new Set<LeadStatus>([LeadStatus.QUALIFIED, LeadStatus.DISCOVERY_SCHEDULED, LeadStatus.ENROLLED]);
  const terminalStages = new Set<LeadStatus>([LeadStatus.ENROLLED, LeadStatus.CLOSED]);
  const reachedQualification = qualificationStages.has(input.status);
  const terminalStatus = terminalStages.has(input.status);
  if (!terminalStatus && !input.nextFollowUpAt) throw new Error("Open leads require a next follow-up date.");
  await db.$transaction(async (tx) => {
    await tx.checkrideLead.update({
      where: { id: input.leadId },
      data: {
        status: input.status,
        internalNote,
        nextFollowUpAt: terminalStatus ? null : input.nextFollowUpAt ?? null,
        lastContactedAt: input.markContacted ? now : undefined,
        qualifiedAt: reachedQualification ? lead.qualifiedAt ?? now : undefined,
        enrolledAt: input.status === LeadStatus.ENROLLED ? lead.enrolledAt ?? now : undefined,
        closedAt: input.status === LeadStatus.CLOSED ? lead.closedAt ?? now : null
      }
    });
    await tx.auditEvent.create({
      data: {
        actorId: input.actor.id,
        action: "CHECKRIDE_LEAD_STATUS_UPDATED",
        entityType: "CheckrideLead",
        entityId: input.leadId,
        metadata: {
          previousStatus: lead.status,
          status: input.status,
          noteUpdated: internalNote !== null,
          nextFollowUpAt: terminalStatus ? null : input.nextFollowUpAt?.toISOString() ?? null,
          contactMarked: input.markContacted === true
        }
      }
    });
  });
}
