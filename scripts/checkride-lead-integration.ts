import "dotenv/config";
import { LeadStatus, Role } from "../generated/prisma/client";
import { createCheckrideLead, updateCheckrideLeadStatusWorkflow } from "../lib/checkride-leads";
import { db } from "../lib/db";

if (process.env.GITHUB_ACTIONS !== "true" || process.env.E2E_TEST_IDENTITIES_ENABLED !== "true") {
  throw new Error("Checkride lead integration runs only with GitHub Actions test identities.");
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

async function main() {
  const [student, admin] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { email: "student.e2e@aerosforge.test" } }),
    db.user.findUniqueOrThrow({ where: { email: "admin.e2e@aerosforge.test" } })
  ]);
  const input = {
    userId: student.id,
    firstName: "Test",
    lastName: "Candidate",
    email: "candidate.e2e@aerosforge.test",
    certificateLevel: "Student pilot",
    ratingGoal: "Private Helicopter",
    aircraft: "R22",
    targetCheckride: "Within 90 days",
    preferredFormat: "Hybrid: self-paced + live group",
    source: "ci",
    campaign: "revenue-mvp",
    contactConsent: true as const,
    privacyVersion: "ci-test"
  };
  const first = await createCheckrideLead(input);
  const duplicate = await createCheckrideLead(input);
  if (!first.created || duplicate.created || first.id !== duplicate.id) throw new Error("Recent duplicate Checkride lead was not suppressed.");

  const stored = await db.checkrideLead.findUniqueOrThrow({ where: { id: first.id } });
  if (!stored.contactConsent || !stored.consentAt || stored.status !== LeadStatus.NEW) {
    throw new Error("Checkride lead consent or initial status was not persisted.");
  }
  await expectRejection(
    () => updateCheckrideLeadStatusWorkflow({ actor: { id: student.id, role: Role.STUDENT }, leadId: first.id, status: LeadStatus.QUALIFIED }),
    "Only an Admin can update checkride leads."
  );
  await expectRejection(
    () => updateCheckrideLeadStatusWorkflow({ actor: { id: admin.id, role: Role.ADMIN }, leadId: first.id, status: LeadStatus.CONTACTED }),
    "Open leads require a next follow-up date."
  );
  const nextFollowUpAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  await updateCheckrideLeadStatusWorkflow({
    actor: { id: admin.id, role: Role.ADMIN },
    leadId: first.id,
    status: LeadStatus.QUALIFIED,
    internalNote: "Strong fit; confirm aircraft and practical-test target.",
    nextFollowUpAt,
    markContacted: true
  });

  const [updated, createAudits, statusAudits] = await Promise.all([
    db.checkrideLead.findUniqueOrThrow({ where: { id: first.id } }),
    db.auditEvent.count({ where: { action: "CHECKRIDE_LEAD_CREATED", entityId: first.id } }),
    db.auditEvent.count({ where: { action: "CHECKRIDE_LEAD_STATUS_UPDATED", entityId: first.id } })
  ]);
  if (
    updated.status !== LeadStatus.QUALIFIED ||
    !updated.qualifiedAt ||
    !updated.lastContactedAt ||
    updated.internalNote !== "Strong fit; confirm aircraft and practical-test target." ||
    updated.nextFollowUpAt?.getTime() !== nextFollowUpAt.getTime() ||
    createAudits !== 1 ||
    statusAudits !== 1
  ) {
    throw new Error("Checkride pipeline state or audit history is incorrect.");
  }
  await db.checkrideLead.update({ where: { id: first.id }, data: { contactConsent: false } });
  await expectRejection(
    () => updateCheckrideLeadStatusWorkflow({
      actor: { id: admin.id, role: Role.ADMIN },
      leadId: first.id,
      status: LeadStatus.QUALIFIED,
      nextFollowUpAt,
      markContacted: true
    }),
    "Cannot record contact without documented consent."
  );
  await db.checkrideLead.update({ where: { id: first.id }, data: { contactConsent: true } });
  await updateCheckrideLeadStatusWorkflow({
    actor: { id: admin.id, role: Role.ADMIN },
    leadId: first.id,
    status: LeadStatus.ENROLLED,
    internalNote: updated.internalNote
  });
  const enrolled = await db.checkrideLead.findUniqueOrThrow({ where: { id: first.id } });
  if (!enrolled.enrolledAt || enrolled.nextFollowUpAt !== null) throw new Error("Enrollment did not close the follow-up loop.");
  console.log("Consented lead → duplicate suppression → Admin follow-up → qualification → enrollment integration passed.");
}

main().then(() => db.$disconnect()).catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
