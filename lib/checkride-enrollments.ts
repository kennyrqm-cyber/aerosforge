import {
  CheckrideCohortStatus,
  CheckrideEnrollmentStatus,
  CheckridePaymentStatus,
  Role
} from "@/generated/prisma/client";
import { db } from "@/lib/db";

const SERVICE_STATUSES = new Set<CheckrideEnrollmentStatus>([
  CheckrideEnrollmentStatus.PAID_PENDING_ONBOARDING,
  CheckrideEnrollmentStatus.READY,
  CheckrideEnrollmentStatus.ACTIVE,
  CheckrideEnrollmentStatus.COMPLETED
]);

const ACCOUNTABLE_STATUSES = new Set<CheckrideEnrollmentStatus>([
  CheckrideEnrollmentStatus.PAID_PENDING_ONBOARDING,
  CheckrideEnrollmentStatus.READY,
  CheckrideEnrollmentStatus.ACTIVE
]);

const ONBOARDED_STATUSES = new Set<CheckrideEnrollmentStatus>([
  CheckrideEnrollmentStatus.READY,
  CheckrideEnrollmentStatus.ACTIVE,
  CheckrideEnrollmentStatus.COMPLETED
]);

const STARTED_STATUSES = new Set<CheckrideEnrollmentStatus>([
  CheckrideEnrollmentStatus.ACTIVE,
  CheckrideEnrollmentStatus.COMPLETED
]);

const ADMIN_MANAGED_ENROLLMENT_STATUSES = new Set<CheckrideEnrollmentStatus>([
  CheckrideEnrollmentStatus.PAID_PENDING_ONBOARDING,
  CheckrideEnrollmentStatus.READY,
  CheckrideEnrollmentStatus.ACTIVE,
  CheckrideEnrollmentStatus.COMPLETED
]);

const CAPACITY_STATUSES = [
  CheckrideEnrollmentStatus.PAID_PENDING_ONBOARDING,
  CheckrideEnrollmentStatus.READY,
  CheckrideEnrollmentStatus.ACTIVE,
  CheckrideEnrollmentStatus.COMPLETED
];

const ENROLLMENT_TRANSITIONS: Record<CheckrideEnrollmentStatus, Set<CheckrideEnrollmentStatus>> = {
  PAID_PENDING_ONBOARDING: new Set([
    CheckrideEnrollmentStatus.PAID_PENDING_ONBOARDING,
    CheckrideEnrollmentStatus.READY,
    CheckrideEnrollmentStatus.REVIEW_REQUIRED,
    CheckrideEnrollmentStatus.REFUNDED,
    CheckrideEnrollmentStatus.DISPUTED
  ]),
  READY: new Set([
    CheckrideEnrollmentStatus.READY,
    CheckrideEnrollmentStatus.ACTIVE,
    CheckrideEnrollmentStatus.REVIEW_REQUIRED,
    CheckrideEnrollmentStatus.REFUNDED,
    CheckrideEnrollmentStatus.DISPUTED
  ]),
  ACTIVE: new Set([
    CheckrideEnrollmentStatus.ACTIVE,
    CheckrideEnrollmentStatus.COMPLETED,
    CheckrideEnrollmentStatus.REVIEW_REQUIRED,
    CheckrideEnrollmentStatus.REFUNDED,
    CheckrideEnrollmentStatus.DISPUTED
  ]),
  COMPLETED: new Set([CheckrideEnrollmentStatus.COMPLETED]),
  REVIEW_REQUIRED: new Set([
    CheckrideEnrollmentStatus.REVIEW_REQUIRED,
    CheckrideEnrollmentStatus.PAID_PENDING_ONBOARDING,
    CheckrideEnrollmentStatus.REFUNDED,
    CheckrideEnrollmentStatus.DISPUTED
  ]),
  REFUNDED: new Set([CheckrideEnrollmentStatus.REFUNDED]),
  DISPUTED: new Set([CheckrideEnrollmentStatus.DISPUTED])
};

const COHORT_TRANSITIONS: Record<CheckrideCohortStatus, Set<CheckrideCohortStatus>> = {
  SCHEDULED: new Set([CheckrideCohortStatus.SCHEDULED, CheckrideCohortStatus.ACTIVE, CheckrideCohortStatus.CANCELED]),
  ACTIVE: new Set([CheckrideCohortStatus.ACTIVE, CheckrideCohortStatus.COMPLETED, CheckrideCohortStatus.CANCELED]),
  COMPLETED: new Set([CheckrideCohortStatus.COMPLETED]),
  CANCELED: new Set([CheckrideCohortStatus.CANCELED])
};

export async function createCheckrideCohortWorkflow(input: {
  actor: { id: string; role: Role };
  code: string;
  name: string;
  startsAt: Date;
  endsAt?: Date | null;
  capacity: number;
}) {
  if (input.actor.role !== Role.ADMIN) throw new Error("Only an Admin can create Checkride cohorts.");
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  if (!/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(code)) throw new Error("Cohort code must be 3–32 letters, numbers, or hyphens.");
  if (!name || name.length > 120) throw new Error("Cohort name must be 1–120 characters.");
  if (Number.isNaN(input.startsAt.getTime())) throw new Error("Cohort start is invalid.");
  if (input.endsAt && Number.isNaN(input.endsAt.getTime())) throw new Error("Cohort end is invalid.");
  if (input.endsAt && input.endsAt < input.startsAt) throw new Error("Cohort end must be after its start.");
  if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 50) {
    throw new Error("Cohort capacity must be between 1 and 50.");
  }

  return db.$transaction(async (tx) => {
    const cohort = await tx.checkrideCohort.create({
      data: {
        code,
        name,
        startsAt: input.startsAt,
        endsAt: input.endsAt ?? null,
        capacity: input.capacity,
        ownerId: input.actor.id
      }
    });
    await tx.auditEvent.create({
      data: {
        actorId: input.actor.id,
        action: "CHECKRIDE_COHORT_CREATED",
        entityType: "CheckrideCohort",
        entityId: cohort.id,
        metadata: { code, startsAt: cohort.startsAt.toISOString(), capacity: cohort.capacity }
      }
    });
    return cohort;
  });
}

export async function updateCheckrideCohortStatusWorkflow(input: {
  actor: { id: string; role: Role };
  cohortId: string;
  status: CheckrideCohortStatus;
}) {
  if (input.actor.role !== Role.ADMIN) throw new Error("Only an Admin can update Checkride cohorts.");
  return db.$transaction(async (tx) => {
    const cohort = await tx.checkrideCohort.findUnique({ where: { id: input.cohortId } });
    if (!cohort) throw new Error("Checkride cohort not found.");
    if (!COHORT_TRANSITIONS[cohort.status].has(input.status)) throw new Error("Invalid Checkride cohort status transition.");
    if (input.status === CheckrideCohortStatus.COMPLETED || input.status === CheckrideCohortStatus.CANCELED) {
      const unfinished = await tx.checkrideEnrollment.count({
        where: {
          cohortId: cohort.id,
          status: { in: [
            CheckrideEnrollmentStatus.PAID_PENDING_ONBOARDING,
            CheckrideEnrollmentStatus.READY,
            CheckrideEnrollmentStatus.ACTIVE
          ] }
        }
      });
      if (unfinished > 0) throw new Error("Resolve every open enrollment before closing a cohort.");
    }
    const updated = await tx.checkrideCohort.update({ where: { id: cohort.id }, data: { status: input.status } });
    await tx.auditEvent.create({
      data: {
        actorId: input.actor.id,
        action: "CHECKRIDE_COHORT_STATUS_UPDATED",
        entityType: "CheckrideCohort",
        entityId: cohort.id,
        metadata: { previousStatus: cohort.status, status: input.status }
      }
    });
    return updated;
  });
}

export async function updateCheckrideEnrollmentWorkflow(input: {
  actor: { id: string; role: Role };
  enrollmentId: string;
  status: CheckrideEnrollmentStatus;
  userId?: string | null;
  cohortId?: string | null;
  nextActionAt?: Date | null;
  internalNote?: string | null;
}) {
  if (input.actor.role !== Role.ADMIN) throw new Error("Only an Admin can update Checkride delivery.");
  if (!ADMIN_MANAGED_ENROLLMENT_STATUSES.has(input.status)) {
    throw new Error("Payment-derived delivery statuses are webhook-owned.");
  }
  const internalNote = input.internalNote?.trim() || null;
  if (internalNote && internalNote.length > 2000) throw new Error("Delivery note is too long.");
  if (input.nextActionAt && Number.isNaN(input.nextActionAt.getTime())) throw new Error("Next action is invalid.");
  if (ACCOUNTABLE_STATUSES.has(input.status) && (!input.nextActionAt || input.nextActionAt <= new Date())) {
    throw new Error("Open enrollments require a future next action.");
  }

  return db.$transaction(async (tx) => {
    const enrollment = await tx.checkrideEnrollment.findUnique({
      where: { id: input.enrollmentId },
      include: { payment: true, lead: true }
    });
    if (!enrollment) throw new Error("Checkride enrollment not found.");
    if (!ENROLLMENT_TRANSITIONS[enrollment.status].has(input.status)) {
      throw new Error("Invalid Checkride enrollment status transition.");
    }
    if (SERVICE_STATUSES.has(input.status) && enrollment.payment.status !== CheckridePaymentStatus.PAID) {
      throw new Error("Delivery cannot proceed without a verified paid payment.");
    }

    const userId = input.userId ?? null;
    const cohortId = input.cohortId ?? null;
    if (userId) {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true, email: true, emailVerified: true } });
      if (!user || user.role !== Role.STUDENT || !user.emailVerified) {
        throw new Error("Enrollment can link only to a verified Student account.");
      }
      if (user.email.toLowerCase() !== enrollment.lead.email.toLowerCase()) {
        throw new Error("Student account email must match the paid applicant email.");
      }
    }
    if (cohortId) {
      const cohort = await tx.checkrideCohort.findUnique({ where: { id: cohortId } });
      if (!cohort || cohort.status === CheckrideCohortStatus.CANCELED || cohort.status === CheckrideCohortStatus.COMPLETED) {
        throw new Error("Select an available Checkride cohort.");
      }
      const occupied = await tx.checkrideEnrollment.count({
        where: { cohortId, id: { not: enrollment.id }, status: { in: CAPACITY_STATUSES } }
      });
      if (occupied >= cohort.capacity) throw new Error("Checkride cohort capacity has been reached.");
    }
    if ((input.status === CheckrideEnrollmentStatus.ACTIVE || input.status === CheckrideEnrollmentStatus.COMPLETED) && (!userId || !cohortId)) {
      throw new Error("Active or completed delivery requires a matching Student account and cohort.");
    }

    const now = new Date();
    const updated = await tx.checkrideEnrollment.update({
      where: { id: enrollment.id },
      data: {
        userId,
        cohortId,
        status: input.status,
        nextActionAt: ACCOUNTABLE_STATUSES.has(input.status) ? input.nextActionAt : null,
        internalNote,
        onboardedAt: ONBOARDED_STATUSES.has(input.status)
          ? enrollment.onboardedAt ?? now
          : enrollment.onboardedAt,
        startedAt: STARTED_STATUSES.has(input.status)
          ? enrollment.startedAt ?? now
          : enrollment.startedAt,
        completedAt: input.status === CheckrideEnrollmentStatus.COMPLETED ? enrollment.completedAt ?? now : enrollment.completedAt
      }
    });
    await tx.auditEvent.create({
      data: {
        actorId: input.actor.id,
        action: "CHECKRIDE_ENROLLMENT_UPDATED",
        entityType: "CheckrideEnrollment",
        entityId: enrollment.id,
        metadata: {
          previousStatus: enrollment.status,
          status: input.status,
          cohortId,
          userLinked: Boolean(userId),
          nextActionAt: updated.nextActionAt?.toISOString() ?? null
        }
      }
    });
    return updated;
  }, { isolationLevel: "Serializable" });
}
