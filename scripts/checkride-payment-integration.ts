import "dotenv/config";
import type Stripe from "stripe";
import { LeadStatus, Role } from "../generated/prisma/client";
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
  const [storedPayment, storedLead, eventCount, auditCount] = await Promise.all([
    db.checkridePayment.findUniqueOrThrow({ where: { id: first.payment.id } }),
    db.checkrideLead.findUniqueOrThrow({ where: { id: lead.id } }),
    db.stripeWebhookEvent.count({ where: { id: event.id } }),
    db.auditEvent.count({ where: { action: "CHECKRIDE_PAYMENT_CONFIRMED", entityId: first.payment.id } })
  ]);
  if (
    !processed.processed || repeated.processed ||
    storedPayment.status !== "PAID" || !storedPayment.paidAt ||
    storedLead.status !== LeadStatus.ENROLLED || !storedLead.enrolledAt ||
    eventCount !== 1 || auditCount !== 1
  ) {
    throw new Error("Signed-event fulfillment, enrollment, or webhook idempotency failed.");
  }
  console.log("Admin-only qualified checkout → amount lock → hosted URL → signed event → paid enrollment → idempotency passed.");
}

main().then(() => db.$disconnect()).catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
