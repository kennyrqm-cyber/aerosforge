import "dotenv/config";
import {
  CheckrideCohortStatus,
  CheckrideEnrollmentStatus,
  CheckridePaymentStatus,
  LeadStatus,
  Role
} from "../generated/prisma/client";
import {
  createCheckrideCohortWorkflow,
  updateCheckrideCohortStatusWorkflow,
  updateCheckrideEnrollmentWorkflow
} from "../lib/checkride-enrollments";
import { db } from "../lib/db";

if (process.env.GITHUB_ACTIONS !== "true" || process.env.E2E_TEST_IDENTITIES_ENABLED !== "true") {
  throw new Error("Checkride enrollment integration runs only with GitHub Actions test identities.");
}

async function expectRejection(action: () => Promise<unknown>, expected: string) {
  try {
    await action();
  } catch (error) {
    if (error instanceof Error && error.message === expected) return;
    throw error;
  }
  throw new Error(`Expected rejection: ${expected}`);
}

async function createPaidEnrollment(input: { adminId: string; email: string; cohortId?: string }) {
  const lead = await db.checkrideLead.create({
    data: {
      firstName: "Cohort",
      lastName: "Test",
      email: input.email,
      certificateLevel: "Student pilot",
      ratingGoal: "Private Helicopter",
      contactConsent: true,
      consentAt: new Date(),
      privacyVersion: "integration-test",
      status: LeadStatus.ENROLLED,
      enrolledAt: new Date()
    }
  });
  const payment = await db.checkridePayment.create({
    data: { leadId: lead.id, cohortId: input.cohortId, createdById: input.adminId, status: CheckridePaymentStatus.PAID, paidAt: new Date() }
  });
  return db.checkrideEnrollment.create({
    data: {
      leadId: lead.id,
      paymentId: payment.id,
      cohortId: input.cohortId,
      status: CheckrideEnrollmentStatus.PAID_PENDING_ONBOARDING,
      nextActionAt: new Date(Date.now() + 86_400_000)
    }
  });
}

async function main() {
  const [admin, student, cfi] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { email: "admin.e2e@aerosforge.test" } }),
    db.user.findUniqueOrThrow({ where: { email: "student.e2e@aerosforge.test" } }),
    db.user.findUniqueOrThrow({ where: { email: "cfi.e2e@aerosforge.test" } })
  ]);
  const cohortInput = {
    code: `PH-${Date.now()}`,
    name: "Private Helicopter Test Cohort",
    startsAt: new Date(Date.now() + 7 * 86_400_000),
    endsAt: new Date(Date.now() + 21 * 86_400_000),
    capacity: 1
  };
  await expectRejection(
    () => createCheckrideCohortWorkflow({ actor: { id: student.id, role: Role.STUDENT }, ...cohortInput }),
    "Only an Admin can create Checkride cohorts."
  );
  const cohort = await createCheckrideCohortWorkflow({ actor: { id: admin.id, role: Role.ADMIN }, ...cohortInput });
  const heldCohort = await createCheckrideCohortWorkflow({
    actor: { id: admin.id, role: Role.ADMIN },
    code: `HELD-${Date.now()}`,
    name: "Held inventory test cohort",
    startsAt: new Date(Date.now() + 30 * 86_400_000),
    endsAt: new Date(Date.now() + 60 * 86_400_000),
    capacity: 1
  });
  const reservationLead = await db.checkrideLead.create({
    data: {
      firstName: "Held",
      lastName: "Reservation",
      email: `held-${Date.now()}@aerosforge.test`,
      certificateLevel: "Student pilot",
      ratingGoal: "Private Helicopter",
      contactConsent: true,
      consentAt: new Date(),
      privacyVersion: "integration-test",
      status: LeadStatus.QUALIFIED,
      qualifiedAt: new Date()
    }
  });
  const heldPayment = await db.checkridePayment.create({
    data: {
      leadId: reservationLead.id,
      cohortId: heldCohort.id,
      createdById: admin.id,
      status: CheckridePaymentStatus.OPEN,
      expiresAt: new Date(Date.now() + 86_400_000)
    }
  });
  const heldConflictEnrollment = await createPaidEnrollment({ adminId: admin.id, email: student.email });
  await expectRejection(
    () => updateCheckrideEnrollmentWorkflow({
      actor: { id: admin.id, role: Role.ADMIN },
      enrollmentId: heldConflictEnrollment.id,
      status: CheckrideEnrollmentStatus.READY,
      userId: student.id,
      cohortId: heldCohort.id,
      nextActionAt: new Date(Date.now() + 2 * 86_400_000)
    }),
    "Checkride cohort capacity has been reached."
  );
  await expectRejection(
    () => updateCheckrideCohortStatusWorkflow({ actor: { id: admin.id, role: Role.ADMIN }, cohortId: heldCohort.id, status: CheckrideCohortStatus.CANCELED }),
    "Resolve every open enrollment and payment reservation before closing a cohort."
  );
  await db.checkridePayment.update({ where: { id: heldPayment.id }, data: { status: CheckridePaymentStatus.EXPIRED } });
  await updateCheckrideCohortStatusWorkflow({ actor: { id: admin.id, role: Role.ADMIN }, cohortId: heldCohort.id, status: CheckrideCohortStatus.CANCELED });
  const wrongStudent = await db.user.create({
    data: { name: "Wrong Student", email: `wrong-${Date.now()}@aerosforge.test`, role: Role.STUDENT, emailVerified: true }
  });
  const unverifiedStudent = await db.user.create({
    data: { name: "Unverified Student", email: `unverified-${Date.now()}@aerosforge.test`, role: Role.STUDENT, emailVerified: false }
  });
  const first = await createPaidEnrollment({ adminId: admin.id, email: student.email, cohortId: cohort.id });
  const second = await createPaidEnrollment({ adminId: admin.id, email: student.email });
  const unverifiedEnrollment = await createPaidEnrollment({ adminId: admin.id, email: unverifiedStudent.email });
  const nextActionAt = new Date(Date.now() + 2 * 86_400_000);

  await expectRejection(
    () => updateCheckrideEnrollmentWorkflow({
      actor: { id: admin.id, role: Role.ADMIN }, enrollmentId: first.id,
      status: CheckrideEnrollmentStatus.READY, userId: student.id, cohortId: null, nextActionAt
    }),
    "Enrollment must remain in its reserved Checkride cohort."
  );
  await expectRejection(
    () => updateCheckrideEnrollmentWorkflow({
      actor: { id: cfi.id, role: Role.CFI }, enrollmentId: first.id,
      status: CheckrideEnrollmentStatus.READY, userId: student.id, cohortId: cohort.id, nextActionAt
    }),
    "Only an Admin can update Checkride delivery."
  );
  await expectRejection(
    () => updateCheckrideEnrollmentWorkflow({
      actor: { id: admin.id, role: Role.ADMIN }, enrollmentId: first.id,
      status: CheckrideEnrollmentStatus.READY, userId: wrongStudent.id, cohortId: cohort.id, nextActionAt
    }),
    "Student account email must match the paid applicant email."
  );
  await expectRejection(
    () => updateCheckrideEnrollmentWorkflow({
      actor: { id: admin.id, role: Role.ADMIN }, enrollmentId: unverifiedEnrollment.id,
      status: CheckrideEnrollmentStatus.READY, userId: unverifiedStudent.id, cohortId: null, nextActionAt
    }),
    "Enrollment can link only to a verified Student account."
  );
  await updateCheckrideEnrollmentWorkflow({
    actor: { id: admin.id, role: Role.ADMIN }, enrollmentId: first.id,
    status: CheckrideEnrollmentStatus.READY, userId: student.id, cohortId: cohort.id, nextActionAt,
    internalNote: "Orientation scheduled."
  });
  const active = await updateCheckrideEnrollmentWorkflow({
    actor: { id: admin.id, role: Role.ADMIN }, enrollmentId: first.id,
    status: CheckrideEnrollmentStatus.ACTIVE, userId: student.id, cohortId: cohort.id,
    nextActionAt: new Date(Date.now() + 3 * 86_400_000)
  });
  if (!active.userId || !active.cohortId || !active.onboardedAt || !active.startedAt) {
    throw new Error("Paid enrollment did not activate with accountable delivery timestamps.");
  }
  await expectRejection(
    () => updateCheckrideCohortStatusWorkflow({ actor: { id: admin.id, role: Role.ADMIN }, cohortId: cohort.id, status: CheckrideCohortStatus.CANCELED }),
    "Resolve every open enrollment and payment reservation before closing a cohort."
  );
  await expectRejection(
    () => updateCheckrideEnrollmentWorkflow({
      actor: { id: admin.id, role: Role.ADMIN }, enrollmentId: second.id,
      status: CheckrideEnrollmentStatus.READY, userId: student.id, cohortId: cohort.id, nextActionAt
    }),
    "Checkride cohort capacity has been reached."
  );
  await db.checkridePayment.update({ where: { id: second.paymentId }, data: { status: CheckridePaymentStatus.REFUNDED } });
  await expectRejection(
    () => updateCheckrideEnrollmentWorkflow({
      actor: { id: admin.id, role: Role.ADMIN }, enrollmentId: second.id,
      status: CheckrideEnrollmentStatus.REFUNDED, userId: null, cohortId: null, nextActionAt: null
    }),
    "Payment-derived delivery statuses are webhook-owned."
  );
  await expectRejection(
    () => updateCheckrideEnrollmentWorkflow({
      actor: { id: admin.id, role: Role.ADMIN }, enrollmentId: second.id,
      status: CheckrideEnrollmentStatus.READY, userId: student.id, cohortId: null, nextActionAt
    }),
    "Delivery cannot proceed without a verified paid payment."
  );
  const auditCount = await db.auditEvent.count({ where: { action: "CHECKRIDE_ENROLLMENT_UPDATED", entityId: first.id } });
  if (auditCount !== 2) throw new Error("Enrollment delivery updates were not audited exactly once.");
  console.log("Admin-only paid enrollment → matching account → cohort capacity → accountable delivery → payment lockout passed.");
}

main().then(() => db.$disconnect()).catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
