import "dotenv/config";
import type Stripe from "stripe";
import { CheckrideEnrollmentStatus, CheckridePaymentStatus, LaunchGateStatus, LeadStatus, Role } from "../generated/prisma/client";
import {
  CHECKRIDE_FOUNDING_OFFER,
  createCheckrideCheckout,
  processStripeWebhook
} from "../lib/checkride-payments";
import { db } from "../lib/db";
import { CHECKRIDE_LAUNCH_GATES, updateLaunchGateDecisionWorkflow } from "../lib/launch-readiness";

if (process.env.GITHUB_ACTIONS !== "true" || process.env.E2E_TEST_IDENTITIES_ENABLED !== "true") {
  throw new Error("Checkride payment integration runs only with GitHub Actions test identities.");
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
  const [admin, student] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { email: "admin.e2e@aerosforge.test" } }),
    db.user.findUniqueOrThrow({ where: { email: "student.e2e@aerosforge.test" } })
  ]);
  const lead = await db.checkrideLead.create({
    data: {
      firstName: "Payment",
      lastName: "Test",
      email: `payment-${Date.now()}@aerosforge.test`,
      certificateLevel: "Student pilot",
      ratingGoal: "Private Helicopter",
      contactConsent: true,
      consentAt: new Date(),
      privacyVersion: "integration-test"
    }
  });
  const cohort = await db.checkrideCohort.create({
    data: {
      code: `PAY-${Date.now()}`,
      name: "Payment inventory test cohort",
      startsAt: new Date(Date.now() + 7 * 86_400_000),
      endsAt: new Date(Date.now() + 21 * 86_400_000),
      capacity: 1,
      ownerId: admin.id
    }
  });
  const config = {
    apiKey: "rk_test_not_used_by_fake_gateway",
    webhookSecret: "whsec_not_used_by_fake_gateway",
    priceId: "price_test_checkride",
    baseUrl: "https://preview.aerosforge.test"
  };
  const gateway = {
    async retrievePrice() {
      return { active: true, currency: "usd", unitAmount: 34_900, recurring: false };
    },
    async createSession(input: { paymentId: string; cohortId: string; integrationIdentifier: string; expiresAt: Date }) {
      if (!/^aerosforge_checkride_[a-z]{8}$/.test(input.integrationIdentifier)) {
        throw new Error("Integration identifier is missing its random suffix.");
      }
      if (input.cohortId !== cohort.id) throw new Error("Checkout was not bound to the selected cohort.");
      return {
        id: `cs_test_${input.paymentId}`,
        url: `https://checkout.stripe.com/c/pay/${input.paymentId}`,
        expiresAt: input.expiresAt
      };
    }
  };

  await expectRejection(
    () => createCheckrideCheckout({ actor: { id: student.id, role: Role.STUDENT }, leadId: lead.id, cohortId: cohort.id, config, gateway }),
    "Only an Admin can create Checkride checkout sessions."
  );
  await expectRejection(
    () => createCheckrideCheckout({ actor: { id: admin.id, role: Role.ADMIN }, leadId: lead.id, cohortId: cohort.id, config, gateway }),
    "Only qualified Checkride leads can receive checkout."
  );
  await db.checkrideLead.update({ where: { id: lead.id }, data: { status: LeadStatus.QUALIFIED, qualifiedAt: new Date() } });
  await updateLaunchGateDecisionWorkflow({
    actor: { id: admin.id, role: Role.ADMIN }, gateKey: CHECKRIDE_LAUNCH_GATES[0].key,
    status: LaunchGateStatus.BLOCKED
  });
  await expectRejection(
    () => createCheckrideCheckout({ actor: { id: admin.id, role: Role.ADMIN }, leadId: lead.id, cohortId: cohort.id, config, gateway }),
    "Checkride checkout is blocked until every launch-readiness gate has current approval evidence."
  );
  for (const gate of CHECKRIDE_LAUNCH_GATES) {
    await updateLaunchGateDecisionWorkflow({
      actor: { id: admin.id, role: Role.ADMIN }, gateKey: gate.key,
      status: LaunchGateStatus.APPROVED,
      evidence: `Payment integration evidence for ${gate.key}; current definition verified.`,
      reviewerName: `CI ${gate.authority}`
    });
  }
  await expectRejection(
    () => createCheckrideCheckout({
      actor: { id: admin.id, role: Role.ADMIN },
      leadId: lead.id,
      cohortId: cohort.id,
      config,
      gateway: { ...gateway, retrievePrice: async () => ({ active: true, currency: "usd", unitAmount: 39900, recurring: false }) }
    }),
    "Stripe price does not match the approved $349 one-time founding offer."
  );
  const publishedLesson = await db.lesson.findFirstOrThrow({ where: { status: "PUBLISHED" } });
  await db.lesson.update({ where: { id: publishedLesson.id }, data: { status: "DRAFT" } });
  await expectRejection(
    () => createCheckrideCheckout({ actor: { id: admin.id, role: Role.ADMIN }, leadId: lead.id, cohortId: cohort.id, config, gateway }),
    "Checkout requires independently reviewed published training content."
  );
  await db.lesson.update({ where: { id: publishedLesson.id }, data: { status: "PUBLISHED" } });

  await expectRejection(
    () => createCheckrideCheckout({ actor: { id: admin.id, role: Role.ADMIN }, leadId: lead.id, cohortId: "missing-cohort", config, gateway }),
    "Checkout requires a future scheduled Checkride cohort with a defined delivery window."
  );

  const gatedCheckout = await createCheckrideCheckout({
    actor: { id: admin.id, role: Role.ADMIN }, leadId: lead.id, cohortId: cohort.id, config, gateway
  });
  await updateLaunchGateDecisionWorkflow({
    actor: { id: admin.id, role: Role.ADMIN }, gateKey: CHECKRIDE_LAUNCH_GATES[0].key,
    status: LaunchGateStatus.BLOCKED
  });
  const gatedPaidEvent = {
    id: `evt_gate_hold_${gatedCheckout.payment.id}`,
    type: "checkout.session.completed",
    data: {
      object: {
        id: gatedCheckout.payment.stripeCheckoutSessionId,
        client_reference_id: gatedCheckout.payment.id,
        metadata: { paymentId: gatedCheckout.payment.id, leadId: lead.id, cohortId: cohort.id },
        amount_total: CHECKRIDE_FOUNDING_OFFER.amountCents,
        currency: CHECKRIDE_FOUNDING_OFFER.currency,
        payment_status: "paid",
        payment_intent: `pi_gate_hold_${gatedCheckout.payment.id}`,
        customer: `cus_gate_hold_${gatedCheckout.payment.id}`
      }
    }
  } as unknown as Stripe.Event;
  await processStripeWebhook(gatedPaidEvent);
  const [gatedPaidPayment, gatedEnrollment] = await Promise.all([
    db.checkridePayment.findUniqueOrThrow({ where: { id: gatedCheckout.payment.id } }),
    db.checkrideEnrollment.findUnique({ where: { paymentId: gatedCheckout.payment.id } })
  ]);
  if (gatedPaidPayment.status !== CheckridePaymentStatus.REVIEW_REQUIRED || !gatedPaidPayment.paidAt || gatedEnrollment) {
    throw new Error("Paid event bypassed a revoked launch gate.");
  }
  await processStripeWebhook({
    id: `evt_gate_hold_refund_${gatedCheckout.payment.id}`,
    type: "charge.refunded",
    data: { object: { payment_intent: gatedPaidPayment.stripePaymentIntentId, amount: 34_900, amount_refunded: 34_900 } }
  } as unknown as Stripe.Event);
  await updateLaunchGateDecisionWorkflow({
    actor: { id: admin.id, role: Role.ADMIN }, gateKey: CHECKRIDE_LAUNCH_GATES[0].key,
    status: LaunchGateStatus.APPROVED,
    evidence: "Payment integration reapproval after the deliberate webhook lockout drill.",
    reviewerName: "CI Independent CFI"
  });

  const first = await createCheckrideCheckout({ actor: { id: admin.id, role: Role.ADMIN }, leadId: lead.id, cohortId: cohort.id, config, gateway });
  const duplicate = await createCheckrideCheckout({ actor: { id: admin.id, role: Role.ADMIN }, leadId: lead.id, cohortId: cohort.id, config, gateway });
  if (!first.created || duplicate.created || first.payment.id !== duplicate.payment.id || !first.payment.checkoutUrl) {
    throw new Error("Open Checkout Session duplicate suppression failed.");
  }
  const capacityLead = await db.checkrideLead.create({
    data: {
      firstName: "Capacity",
      lastName: "Test",
      email: `capacity-${Date.now()}@aerosforge.test`,
      certificateLevel: "Student pilot",
      ratingGoal: "Private Helicopter",
      contactConsent: true,
      consentAt: new Date(),
      privacyVersion: "integration-test",
      status: LeadStatus.QUALIFIED,
      qualifiedAt: new Date()
    }
  });
  await expectRejection(
    () => createCheckrideCheckout({ actor: { id: admin.id, role: Role.ADMIN }, leadId: capacityLead.id, cohortId: cohort.id, config, gateway }),
    "No reservable seats remain in this Checkride cohort."
  );

  const event = {
    id: `evt_test_${first.payment.id}`,
    type: "checkout.session.completed",
    data: {
      object: {
        id: first.payment.stripeCheckoutSessionId,
        client_reference_id: first.payment.id,
        metadata: { paymentId: first.payment.id, leadId: lead.id, cohortId: cohort.id },
        amount_total: CHECKRIDE_FOUNDING_OFFER.amountCents,
        currency: CHECKRIDE_FOUNDING_OFFER.currency,
        payment_status: "paid",
        payment_intent: `pi_test_${first.payment.id}`,
        customer: `cus_test_${first.payment.id}`
      }
    }
  } as unknown as Stripe.Event;
  const processed = await processStripeWebhook(event);
  const repeated = await processStripeWebhook(event);
  const [storedPayment, storedLead, storedEnrollment, eventCount, auditCount] = await Promise.all([
    db.checkridePayment.findUniqueOrThrow({ where: { id: first.payment.id } }),
    db.checkrideLead.findUniqueOrThrow({ where: { id: lead.id } }),
    db.checkrideEnrollment.findUniqueOrThrow({ where: { paymentId: first.payment.id } }),
    db.stripeWebhookEvent.count({ where: { id: event.id } }),
    db.auditEvent.count({ where: { action: "CHECKRIDE_PAYMENT_CONFIRMED", entityId: first.payment.id } })
  ]);
  if (
    !processed.processed || repeated.processed ||
    storedPayment.status !== "PAID" || !storedPayment.paidAt ||
    storedPayment.cohortId !== cohort.id ||
    storedLead.status !== LeadStatus.ENROLLED || !storedLead.enrolledAt ||
    storedEnrollment.status !== CheckrideEnrollmentStatus.PAID_PENDING_ONBOARDING || storedEnrollment.cohortId !== cohort.id || !storedEnrollment.nextActionAt ||
    eventCount !== 1 || auditCount !== 1
  ) {
    throw new Error("Signed-event fulfillment, enrollment, or webhook idempotency failed.");
  }

  const refundEvent = {
    id: `evt_refund_${first.payment.id}`,
    type: "charge.refunded",
    data: { object: { payment_intent: storedPayment.stripePaymentIntentId, amount: 34_900, amount_refunded: 34_900 } }
  } as unknown as Stripe.Event;
  await processStripeWebhook(refundEvent);
  await processStripeWebhook(refundEvent);
  const [refundedPayment, refundedEnrollment, refundEventCount] = await Promise.all([
    db.checkridePayment.findUniqueOrThrow({ where: { id: first.payment.id } }),
    db.checkrideEnrollment.findUniqueOrThrow({ where: { paymentId: first.payment.id } }),
    db.stripeWebhookEvent.count({ where: { id: refundEvent.id } })
  ]);
  if (refundedPayment.status !== CheckridePaymentStatus.REFUNDED || refundedEnrollment.status !== CheckrideEnrollmentStatus.REFUNDED || refundEventCount !== 1) {
    throw new Error("Refund did not stop delivery idempotently.");
  }

  const releasedSeat = await createCheckrideCheckout({
    actor: { id: admin.id, role: Role.ADMIN }, leadId: capacityLead.id, cohortId: cohort.id, config, gateway
  });
  if (!releasedSeat.created) throw new Error("Refunded payment did not release its cohort seat.");
  const expirationEvent = {
    id: `evt_expired_${releasedSeat.payment.id}`,
    type: "checkout.session.expired",
    data: { object: { id: releasedSeat.payment.stripeCheckoutSessionId } }
  } as unknown as Stripe.Event;
  await processStripeWebhook(expirationEvent);
  await processStripeWebhook(expirationEvent);
  const expiredPayment = await db.checkridePayment.findUniqueOrThrow({ where: { id: releasedSeat.payment.id } });
  if (expiredPayment.status !== CheckridePaymentStatus.EXPIRED) throw new Error("Expired checkout did not release its cohort seat.");
  const lateSuccessEvent = {
    id: `evt_late_success_${releasedSeat.payment.id}`,
    type: "checkout.session.async_payment_succeeded",
    data: {
      object: {
        id: releasedSeat.payment.stripeCheckoutSessionId,
        client_reference_id: releasedSeat.payment.id,
        metadata: { paymentId: releasedSeat.payment.id, leadId: capacityLead.id, cohortId: cohort.id },
        amount_total: CHECKRIDE_FOUNDING_OFFER.amountCents,
        currency: CHECKRIDE_FOUNDING_OFFER.currency,
        payment_status: "paid",
        payment_intent: `pi_late_${releasedSeat.payment.id}`,
        customer: `cus_late_${releasedSeat.payment.id}`
      }
    }
  } as unknown as Stripe.Event;
  await processStripeWebhook(lateSuccessEvent);
  const latePayment = await db.checkridePayment.findUniqueOrThrow({ where: { id: releasedSeat.payment.id } });
  const lateEnrollment = await db.checkrideEnrollment.findUnique({ where: { paymentId: releasedSeat.payment.id } });
  if (latePayment.status !== CheckridePaymentStatus.REVIEW_REQUIRED || !latePayment.paidAt || lateEnrollment) {
    throw new Error("Late paid event was not held for review without automatic enrollment.");
  }
  const replacementLead = await db.checkrideLead.create({
    data: {
      firstName: "Replacement",
      lastName: "Test",
      email: `replacement-${Date.now()}@aerosforge.test`,
      certificateLevel: "Student pilot",
      ratingGoal: "Private Helicopter",
      contactConsent: true,
      consentAt: new Date(),
      privacyVersion: "integration-test",
      status: LeadStatus.QUALIFIED,
      qualifiedAt: new Date()
    }
  });
  await expectRejection(
    () => createCheckrideCheckout({ actor: { id: admin.id, role: Role.ADMIN }, leadId: replacementLead.id, cohortId: cohort.id, config, gateway }),
    "No reservable seats remain in this Checkride cohort."
  );
  const lateRefundEvent = {
    id: `evt_late_refund_${releasedSeat.payment.id}`,
    type: "charge.refunded",
    data: { object: { payment_intent: latePayment.stripePaymentIntentId, amount: 34_900, amount_refunded: 34_900 } }
  } as unknown as Stripe.Event;
  await processStripeWebhook(lateRefundEvent);
  const replacementSeat = await createCheckrideCheckout({
    actor: { id: admin.id, role: Role.ADMIN }, leadId: replacementLead.id, cohortId: cohort.id, config, gateway
  });
  if (!replacementSeat.created || replacementSeat.payment.cohortId !== cohort.id) {
    throw new Error("Expired checkout inventory was not safely reusable.");
  }
  const failedEvent = {
    id: `evt_failed_${replacementSeat.payment.id}`,
    type: "checkout.session.async_payment_failed",
    data: { object: { id: replacementSeat.payment.stripeCheckoutSessionId } }
  } as unknown as Stripe.Event;
  await processStripeWebhook(failedEvent);
  const failedPayment = await db.checkridePayment.findUniqueOrThrow({ where: { id: replacementSeat.payment.id } });
  if (failedPayment.status !== CheckridePaymentStatus.FAILED) throw new Error("Failed payment did not release its cohort seat.");
  const finalLead = await db.checkrideLead.create({
    data: {
      firstName: "Final",
      lastName: "Inventory",
      email: `final-inventory-${Date.now()}@aerosforge.test`,
      certificateLevel: "Student pilot",
      ratingGoal: "Private Helicopter",
      contactConsent: true,
      consentAt: new Date(),
      privacyVersion: "integration-test",
      status: LeadStatus.QUALIFIED,
      qualifiedAt: new Date()
    }
  });
  const finalSeat = await createCheckrideCheckout({
    actor: { id: admin.id, role: Role.ADMIN }, leadId: finalLead.id, cohortId: cohort.id, config, gateway
  });
  if (!finalSeat.created) throw new Error("Failed payment inventory was not safely reusable.");

  const disputedLead = await db.checkrideLead.create({
    data: {
      firstName: "Dispute",
      lastName: "Test",
      email: `dispute-${Date.now()}@aerosforge.test`,
      certificateLevel: "Student pilot",
      ratingGoal: "Private Helicopter",
      contactConsent: true,
      consentAt: new Date(),
      privacyVersion: "integration-test",
      status: LeadStatus.ENROLLED,
      enrolledAt: new Date()
    }
  });
  const disputedPayment = await db.checkridePayment.create({
    data: {
      leadId: disputedLead.id,
      createdById: admin.id,
      status: CheckridePaymentStatus.PAID,
      stripePaymentIntentId: `pi_dispute_${disputedLead.id}`,
      paidAt: new Date()
    }
  });
  await db.checkrideEnrollment.create({
    data: { leadId: disputedLead.id, paymentId: disputedPayment.id, status: CheckrideEnrollmentStatus.PAID_PENDING_ONBOARDING, nextActionAt: new Date(Date.now() + 86_400_000) }
  });
  const disputeEvent = {
    id: `evt_dispute_${disputedPayment.id}`,
    type: "charge.dispute.created",
    data: { object: { payment_intent: disputedPayment.stripePaymentIntentId } }
  } as unknown as Stripe.Event;
  await processStripeWebhook(disputeEvent);
  await processStripeWebhook(disputeEvent);
  const [paymentUnderDispute, enrollmentUnderDispute, disputeEventCount] = await Promise.all([
    db.checkridePayment.findUniqueOrThrow({ where: { id: disputedPayment.id } }),
    db.checkrideEnrollment.findUniqueOrThrow({ where: { paymentId: disputedPayment.id } }),
    db.stripeWebhookEvent.count({ where: { id: disputeEvent.id } })
  ]);
  if (paymentUnderDispute.status !== CheckridePaymentStatus.DISPUTED || enrollmentUnderDispute.status !== CheckrideEnrollmentStatus.DISPUTED || disputeEventCount !== 1) {
    throw new Error("Dispute did not stop delivery idempotently.");
  }
  console.log("Qualified checkout → launch-gate lockout → reserved cohort seat → signed payment → automatic cohort enrollment → refund/dispute lockout → idempotency passed.");
}

main().then(() => db.$disconnect()).catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
