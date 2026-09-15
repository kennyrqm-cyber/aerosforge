import "dotenv/config";
import type Stripe from "stripe";
import { CheckrideEnrollmentStatus, CheckridePaymentStatus, LeadStatus, Role } from "../generated/prisma/client";
import {
  CHECKRIDE_FOUNDING_OFFER,
  createCheckrideCheckout,
  processStripeWebhook
} from "../lib/checkride-payments";
import { db } from "../lib/db";

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
    async createSession(input: { paymentId: string; integrationIdentifier: string; expiresAt: Date }) {
      if (!/^aerosforge_checkride_[a-z]{8}$/.test(input.integrationIdentifier)) {
        throw new Error("Integration identifier is missing its random suffix.");
      }
      return {
        id: `cs_test_${input.paymentId}`,
        url: `https://checkout.stripe.com/c/pay/${input.paymentId}`,
        expiresAt: input.expiresAt
      };
    }
  };

  await expectRejection(
    () => createCheckrideCheckout({ actor: { id: student.id, role: Role.STUDENT }, leadId: lead.id, config, gateway }),
    "Only an Admin can create Checkride checkout sessions."
  );
  await expectRejection(
    () => createCheckrideCheckout({ actor: { id: admin.id, role: Role.ADMIN }, leadId: lead.id, config, gateway }),
    "Only qualified Checkride leads can receive checkout."
  );
  await db.checkrideLead.update({ where: { id: lead.id }, data: { status: LeadStatus.QUALIFIED, qualifiedAt: new Date() } });
  await expectRejection(
    () => createCheckrideCheckout({
      actor: { id: admin.id, role: Role.ADMIN },
      leadId: lead.id,
      config,
      gateway: { ...gateway, retrievePrice: async () => ({ active: true, currency: "usd", unitAmount: 39900, recurring: false }) }
    }),
    "Stripe price does not match the approved $349 one-time founding offer."
  );

  const first = await createCheckrideCheckout({ actor: { id: admin.id, role: Role.ADMIN }, leadId: lead.id, config, gateway });
  const duplicate = await createCheckrideCheckout({ actor: { id: admin.id, role: Role.ADMIN }, leadId: lead.id, config, gateway });
  if (!first.created || duplicate.created || first.payment.id !== duplicate.payment.id || !first.payment.checkoutUrl) {
    throw new Error("Open Checkout Session duplicate suppression failed.");
  }

  const event = {
    id: `evt_test_${first.payment.id}`,
    type: "checkout.session.completed",
    data: {
      object: {
        id: first.payment.stripeCheckoutSessionId,
        client_reference_id: first.payment.id,
        metadata: { paymentId: first.payment.id, leadId: lead.id },
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
    storedLead.status !== LeadStatus.ENROLLED || !storedLead.enrolledAt ||
    storedEnrollment.status !== CheckrideEnrollmentStatus.PAID_PENDING_ONBOARDING || !storedEnrollment.nextActionAt ||
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
  console.log("Qualified checkout → amount lock → signed payment → enrollment → refund/dispute lockout → idempotency passed.");
}

main().then(() => db.$disconnect()).catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
