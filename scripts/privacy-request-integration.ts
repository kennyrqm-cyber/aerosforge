import "dotenv/config";
import { PrivacyRequestStatus, PrivacyRequestType, Role } from "../generated/prisma/client";
import { createPrivacyRequest, getPrivacyResponseDays, updatePrivacyRequestStatusWorkflow } from "../lib/privacy-requests";
import { db } from "../lib/db";

if (process.env.GITHUB_ACTIONS !== "true" || process.env.E2E_TEST_IDENTITIES_ENABLED !== "true") {
  throw new Error("Privacy request integration runs only with GitHub Actions test identities.");
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
    requestType: PrivacyRequestType.CONSENT_WITHDRAWAL,
    firstName: "Privacy",
    lastName: "Requester",
    email: "privacy.requester.e2e@aerosforge.test",
    details: "Please stop Checkride and Winchester outreach associated with this email.",
    privacyVersion: "ci-test"
  };
  const first = await createPrivacyRequest(input);
  const duplicate = await createPrivacyRequest(input);
  if (!first.created || duplicate.created || first.id !== duplicate.id) {
    throw new Error("Recent duplicate privacy request was not suppressed.");
  }

  const stored = await db.privacyRequest.findUniqueOrThrow({ where: { id: first.id } });
  const expectedDueAt = stored.createdAt.getTime() + getPrivacyResponseDays() * 24 * 60 * 60 * 1000;
  if (stored.status !== PrivacyRequestStatus.RECEIVED || Math.abs(stored.dueAt.getTime() - expectedDueAt) > 1000) {
    throw new Error("Privacy request status or response target was not persisted correctly.");
  }

  await expectRejection(
    () => updatePrivacyRequestStatusWorkflow({ actor: { id: student.id, role: Role.STUDENT }, requestId: first.id, status: PrivacyRequestStatus.VERIFIED }),
    "Only an Admin can update privacy requests."
  );

  await Promise.all([
    db.winchesterLead.create({
      data: {
        firstName: "Privacy",
        lastName: "Requester",
        email: input.email,
        contactConsent: true,
        consentAt: new Date(),
        privacyVersion: "ci-test"
      }
    }),
    db.checkrideLead.create({
      data: {
        firstName: "Privacy",
        lastName: "Requester",
        email: input.email,
        certificateLevel: "Student pilot",
        ratingGoal: "Private Helicopter",
        contactConsent: true,
        consentAt: new Date(),
        privacyVersion: "ci-test",
        nextFollowUpAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    })
  ]);
  await expectRejection(
    () => updatePrivacyRequestStatusWorkflow({ actor: { id: admin.id, role: Role.ADMIN }, requestId: first.id, status: PrivacyRequestStatus.COMPLETED }),
    "Identity must be verified before processing or completing this request."
  );

  await updatePrivacyRequestStatusWorkflow({
    actor: { id: admin.id, role: Role.ADMIN },
    requestId: first.id,
    status: PrivacyRequestStatus.VERIFIED,
    internalNote: "Identity verified through the controlled account-channel procedure."
  });
  await updatePrivacyRequestStatusWorkflow({
    actor: { id: admin.id, role: Role.ADMIN },
    requestId: first.id,
    status: PrivacyRequestStatus.COMPLETED,
    internalNote: "Account and training record inventory prepared for controlled response."
  });

  const [completed, winchesterLead, checkrideLead, createAudits, statusAudits] = await Promise.all([
    db.privacyRequest.findUniqueOrThrow({ where: { id: first.id } }),
    db.winchesterLead.findFirstOrThrow({ where: { email: input.email } }),
    db.checkrideLead.findFirstOrThrow({ where: { email: input.email } }),
    db.auditEvent.count({ where: { action: "PRIVACY_REQUEST_CREATED", entityId: first.id } }),
    db.auditEvent.count({ where: { action: "PRIVACY_REQUEST_STATUS_UPDATED", entityId: first.id } })
  ]);
  if (
    completed.status !== PrivacyRequestStatus.COMPLETED ||
    !completed.identityVerifiedAt ||
    !completed.resolvedAt ||
    winchesterLead.contactConsent ||
    checkrideLead.contactConsent ||
    checkrideLead.nextFollowUpAt !== null ||
    createAudits !== 1 ||
    statusAudits !== 2
  ) {
    throw new Error("Privacy request verification, resolution, or audit history is incorrect.");
  }
  console.log("Privacy request → duplicate suppression → Admin-only verification → consent suppression → audited resolution integration passed.");
}

main().then(() => db.$disconnect()).catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
