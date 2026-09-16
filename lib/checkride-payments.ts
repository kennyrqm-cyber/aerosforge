import { randomBytes } from "node:crypto";
import type Stripe from "stripe";
import { CheckrideCohortStatus, CheckrideEnrollmentStatus, CheckridePaymentStatus, LeadStatus, Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  createStripeClient,
  getCheckrideCheckoutConfig,
  type CheckrideCheckoutConfig
} from "@/lib/stripe";

export const CHECKRIDE_FOUNDING_OFFER = {
  code: "PRIVATE_HELICOPTER_FOUNDING_2026",
  version: 1,
  amountCents: 34_900,
  currency: "usd",
  accessDays: 90
} as const;

const CHECKOUT_ELIGIBLE_LEAD_STATUSES = new Set<LeadStatus>([
  LeadStatus.QUALIFIED,
  LeadStatus.DISCOVERY_SCHEDULED
]);
const PAYMENT_FINAL_OR_ESCALATED_STATUSES = new Set<CheckridePaymentStatus>([
  CheckridePaymentStatus.PAID,
  CheckridePaymentStatus.REVIEW_REQUIRED,
  CheckridePaymentStatus.REFUNDED,
  CheckridePaymentStatus.DISPUTED
]);
const PAYMENT_ADVERSE_STATUSES = new Set<CheckridePaymentStatus>([
  CheckridePaymentStatus.REFUNDED,
  CheckridePaymentStatus.DISPUTED
]);
const RESERVED_ENROLLMENT_STATUSES = [
  CheckrideEnrollmentStatus.PAID_PENDING_ONBOARDING,
  CheckrideEnrollmentStatus.READY,
  CheckrideEnrollmentStatus.ACTIVE,
  CheckrideEnrollmentStatus.COMPLETED
];
const HELD_PAYMENT_STATUSES = [CheckridePaymentStatus.CREATING, CheckridePaymentStatus.OPEN];
const AUTOMATED_SUCCESS_STATUSES = new Set<CheckridePaymentStatus>([
  CheckridePaymentStatus.CREATING,
  CheckridePaymentStatus.OPEN,
  CheckridePaymentStatus.PAID
]);

type CheckoutGateway = {
  retrievePrice(priceId: string): Promise<{ active: boolean; currency: string; unitAmount: number | null; recurring: boolean }>;
  createSession(input: {
    paymentId: string;
    leadId: string;
    cohortId: string;
    email: string;
    priceId: string;
    baseUrl: string;
    expiresAt: Date;
    integrationIdentifier: string;
  }): Promise<{ id: string; url: string | null; expiresAt: Date }>;
};

function randomLetters(length: number) {
  return Array.from(randomBytes(length), (value) => String.fromCharCode(97 + (value % 26))).join("");
}

function stringId(value: string | { id: string } | null) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function productionGateway(config: CheckrideCheckoutConfig): CheckoutGateway {
  const stripe = createStripeClient(config.apiKey);
  return {
    async retrievePrice(priceId) {
      const price = await stripe.prices.retrieve(priceId);
      return {
        active: price.active,
        currency: price.currency,
        unitAmount: price.unit_amount,
        recurring: price.type === "recurring"
      };
    },
    async createSession(input) {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: input.email,
        client_reference_id: input.paymentId,
        line_items: [{ price: input.priceId, quantity: 1 }],
        success_url: `${input.baseUrl}/checkride/enrollment/complete?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${input.baseUrl}/checkride/enrollment/canceled`,
        expires_at: Math.floor(input.expiresAt.getTime() / 1000),
        integration_identifier: input.integrationIdentifier,
        metadata: {
          paymentId: input.paymentId,
          leadId: input.leadId,
          cohortId: input.cohortId,
          offerCode: CHECKRIDE_FOUNDING_OFFER.code,
          offerVersion: String(CHECKRIDE_FOUNDING_OFFER.version)
        }
      }, { idempotencyKey: `checkride-payment-${input.paymentId}` });
      return {
        id: session.id,
        url: session.url,
        expiresAt: new Date(session.expires_at * 1000)
      };
    }
  };
}

export async function createCheckrideCheckout(input: {
  actor: { id: string; role: Role };
  leadId: string;
  cohortId: string;
  config?: CheckrideCheckoutConfig;
  gateway?: CheckoutGateway;
}) {
  if (input.actor.role !== Role.ADMIN) throw new Error("Only an Admin can create Checkride checkout sessions.");
  const config = input.config ?? getCheckrideCheckoutConfig();
  const gateway = input.gateway ?? productionGateway(config);
  const lead = await db.checkrideLead.findUnique({ where: { id: input.leadId } });
  if (!lead) throw new Error("Checkride lead not found.");
  if (!lead.contactConsent || !lead.consentAt) throw new Error("Checkout requires documented contact consent.");
  if (!CHECKOUT_ELIGIBLE_LEAD_STATUSES.has(lead.status)) {
    throw new Error("Only qualified Checkride leads can receive checkout.");
  }

  const existing = await db.checkridePayment.findFirst({
    where: {
      leadId: lead.id,
      status: CheckridePaymentStatus.OPEN,
      expiresAt: { gt: new Date() },
      checkoutUrl: { not: null }
    },
    orderBy: { createdAt: "desc" }
  });
  if (existing?.checkoutUrl) {
    if (existing.cohortId !== input.cohortId) throw new Error("An active checkout already reserves a different cohort.");
    return { payment: existing, created: false };
  }

  const price = await gateway.retrievePrice(config.priceId);
  if (!price.active || price.recurring || price.currency !== CHECKRIDE_FOUNDING_OFFER.currency || price.unitAmount !== CHECKRIDE_FOUNDING_OFFER.amountCents) {
    throw new Error("Stripe price does not match the approved $349 one-time founding offer.");
  }

  const now = new Date();
  const requestedExpiry = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const payment = await db.$transaction(async (tx) => {
    const cohort = await tx.checkrideCohort.findUnique({ where: { id: input.cohortId } });
    if (!cohort || cohort.status !== CheckrideCohortStatus.SCHEDULED || cohort.startsAt <= now || !cohort.endsAt) {
      throw new Error("Checkout requires a future scheduled Checkride cohort with a defined delivery window.");
    }
    const [publishedLessonCount, enrolledSeats, heldSeats, orphanedPaidSeats] = await Promise.all([
      tx.lesson.count({ where: { status: "PUBLISHED" } }),
      tx.checkrideEnrollment.count({
        where: { cohortId: cohort.id, status: { in: RESERVED_ENROLLMENT_STATUSES } }
      }),
      tx.checkridePayment.count({
        where: {
          cohortId: cohort.id,
          status: { in: HELD_PAYMENT_STATUSES }
        }
      }),
      tx.checkridePayment.count({
        where: {
          cohortId: cohort.id,
          status: { in: [CheckridePaymentStatus.PAID, CheckridePaymentStatus.REVIEW_REQUIRED] },
          paidAt: { not: null },
          enrollment: null
        }
      })
    ]);
    if (publishedLessonCount === 0) {
      throw new Error("Checkout requires independently reviewed published training content.");
    }
    if (enrolledSeats + heldSeats + orphanedPaidSeats >= cohort.capacity) {
      throw new Error("No reservable seats remain in this Checkride cohort.");
    }
    const created = await tx.checkridePayment.create({
      data: {
        leadId: lead.id,
        cohortId: cohort.id,
        createdById: input.actor.id,
        offerCode: CHECKRIDE_FOUNDING_OFFER.code,
        offerVersion: CHECKRIDE_FOUNDING_OFFER.version,
        amountCents: CHECKRIDE_FOUNDING_OFFER.amountCents,
        currency: CHECKRIDE_FOUNDING_OFFER.currency,
        expiresAt: requestedExpiry
      }
    });
    await tx.auditEvent.create({
      data: {
        actorId: input.actor.id,
        action: "CHECKRIDE_SEAT_RESERVED",
        entityType: "CheckridePayment",
        entityId: created.id,
        metadata: { leadId: lead.id, cohortId: cohort.id, expiresAt: requestedExpiry.toISOString() }
      }
    });
    return created;
  }, { isolationLevel: "Serializable" });

  try {
    const session = await gateway.createSession({
      paymentId: payment.id,
      leadId: lead.id,
      cohortId: input.cohortId,
      email: lead.email,
      priceId: config.priceId,
      baseUrl: config.baseUrl,
      expiresAt: requestedExpiry,
      integrationIdentifier: `aerosforge_checkride_${randomLetters(8)}`
    });
    if (!session.url || !session.url.startsWith("https://checkout.stripe.com/")) {
      throw new Error("Stripe did not return a valid hosted Checkout URL.");
    }
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.checkridePayment.update({
        where: { id: payment.id },
        data: {
          status: CheckridePaymentStatus.OPEN,
          stripeCheckoutSessionId: session.id,
          checkoutUrl: session.url,
          expiresAt: session.expiresAt
        }
      });
      await tx.auditEvent.create({
        data: {
          actorId: input.actor.id,
          action: "CHECKRIDE_CHECKOUT_CREATED",
          entityType: "CheckridePayment",
          entityId: payment.id,
          metadata: { leadId: lead.id, cohortId: payment.cohortId, offerCode: payment.offerCode, amountCents: payment.amountCents, currency: payment.currency }
        }
      });
      return result;
    });
    return { payment: updated, created: true };
  } catch {
    await db.$transaction([
      db.checkridePayment.update({ where: { id: payment.id }, data: { status: CheckridePaymentStatus.REVIEW_REQUIRED, expiresAt: null } }),
      db.auditEvent.create({
        data: {
          actorId: input.actor.id,
          action: "CHECKRIDE_CHECKOUT_REVIEW_REQUIRED",
          entityType: "CheckridePayment",
          entityId: payment.id,
          metadata: { leadId: lead.id }
        }
      })
    ]);
    throw new Error("Checkout could not be created. No charge was made.");
  }
}

function paymentIntentFromCharge(charge: Stripe.Charge) {
  return stringId(charge.payment_intent);
}

export async function processStripeWebhook(event: Stripe.Event) {
  return db.$transaction(async (tx) => {
    const prior = await tx.stripeWebhookEvent.findUnique({ where: { id: event.id }, select: { id: true } });
    if (prior) return { processed: false, matched: true };

    let payment = null as Awaited<ReturnType<typeof tx.checkridePayment.findUnique>>;
    let nextStatus: CheckridePaymentStatus | null = null;
    let action = "STRIPE_EVENT_RECORDED";
    let stripePaymentIntentId: string | undefined;
    let stripeCustomerId: string | undefined;
    let paidAt: Date | undefined;

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentId = session.metadata?.paymentId ?? session.client_reference_id;
      if (paymentId) payment = await tx.checkridePayment.findUnique({ where: { id: paymentId } });
      if (payment) {
        if (session.payment_status === "paid") {
          stripePaymentIntentId = stringId(session.payment_intent) ?? undefined;
          stripeCustomerId = stringId(session.customer) ?? undefined;
          paidAt = payment.paidAt ?? new Date();
        }
        const matches = session.id === payment.stripeCheckoutSessionId
          && session.metadata?.leadId === payment.leadId
          && (!payment.cohortId || session.metadata?.cohortId === payment.cohortId)
          && session.amount_total === payment.amountCents
          && session.currency === payment.currency;
        if (!matches) {
          nextStatus = CheckridePaymentStatus.REVIEW_REQUIRED;
          action = "CHECKRIDE_PAYMENT_REVIEW_REQUIRED";
        } else if (session.payment_status === "paid" && !PAYMENT_ADVERSE_STATUSES.has(payment.status)) {
          const existingEnrollment = await tx.checkrideEnrollment.findUnique({ where: { leadId: payment.leadId } });
          if (!AUTOMATED_SUCCESS_STATUSES.has(payment.status) || (existingEnrollment && existingEnrollment.paymentId !== payment.id)) {
            nextStatus = CheckridePaymentStatus.REVIEW_REQUIRED;
            action = "CHECKRIDE_PAYMENT_REVIEW_REQUIRED";
          } else {
            nextStatus = CheckridePaymentStatus.PAID;
            action = "CHECKRIDE_PAYMENT_CONFIRMED";
          }
        }
      }
    } else if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;
      payment = await tx.checkridePayment.findUnique({ where: { stripeCheckoutSessionId: session.id } });
      if (payment && !PAYMENT_FINAL_OR_ESCALATED_STATUSES.has(payment.status)) {
        nextStatus = event.type === "checkout.session.expired" ? CheckridePaymentStatus.EXPIRED : CheckridePaymentStatus.FAILED;
        action = event.type === "checkout.session.expired" ? "CHECKRIDE_CHECKOUT_EXPIRED" : "CHECKRIDE_PAYMENT_FAILED";
      }
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = paymentIntentFromCharge(charge);
      if (paymentIntentId) payment = await tx.checkridePayment.findUnique({ where: { stripePaymentIntentId: paymentIntentId } });
      if (payment) {
        nextStatus = charge.amount_refunded === charge.amount ? CheckridePaymentStatus.REFUNDED : CheckridePaymentStatus.REVIEW_REQUIRED;
        action = nextStatus === CheckridePaymentStatus.REFUNDED ? "CHECKRIDE_PAYMENT_REFUNDED" : "CHECKRIDE_PAYMENT_REVIEW_REQUIRED";
      }
    } else if (event.type === "charge.dispute.created") {
      const dispute = event.data.object as Stripe.Dispute;
      const paymentIntentId = stringId(dispute.payment_intent);
      if (paymentIntentId) payment = await tx.checkridePayment.findUnique({ where: { stripePaymentIntentId: paymentIntentId } });
      if (payment) {
        nextStatus = CheckridePaymentStatus.DISPUTED;
        action = "CHECKRIDE_PAYMENT_DISPUTED";
      }
    }

    await tx.stripeWebhookEvent.create({
      data: { id: event.id, type: event.type, paymentId: payment?.id }
    });
    if (payment && nextStatus) {
      await tx.checkridePayment.update({
        where: { id: payment.id },
        data: { status: nextStatus, stripePaymentIntentId, stripeCustomerId, paidAt }
      });
      if (nextStatus === CheckridePaymentStatus.PAID) {
        await tx.checkrideLead.updateMany({
          where: { id: payment.leadId, status: { not: LeadStatus.CLOSED } },
          data: { status: LeadStatus.ENROLLED, enrolledAt: paidAt, nextFollowUpAt: null }
        });
        await tx.checkrideEnrollment.upsert({
          where: { leadId: payment.leadId },
          update: {},
          create: {
            leadId: payment.leadId,
            paymentId: payment.id,
            cohortId: payment.cohortId,
            status: CheckrideEnrollmentStatus.PAID_PENDING_ONBOARDING,
            nextActionAt: new Date((paidAt ?? new Date()).getTime() + 48 * 60 * 60 * 1000)
          }
        });
      } else if (nextStatus === CheckridePaymentStatus.REVIEW_REQUIRED) {
        await tx.checkrideEnrollment.updateMany({
          where: { paymentId: payment.id },
          data: { status: CheckrideEnrollmentStatus.REVIEW_REQUIRED, nextActionAt: null }
        });
      } else if (nextStatus === CheckridePaymentStatus.REFUNDED) {
        await tx.checkrideEnrollment.updateMany({
          where: { paymentId: payment.id },
          data: { status: CheckrideEnrollmentStatus.REFUNDED, nextActionAt: null }
        });
      } else if (nextStatus === CheckridePaymentStatus.DISPUTED) {
        await tx.checkrideEnrollment.updateMany({
          where: { paymentId: payment.id },
          data: { status: CheckrideEnrollmentStatus.DISPUTED, nextActionAt: null }
        });
      }
    }
    await tx.auditEvent.create({
      data: {
        action,
        entityType: payment ? "CheckridePayment" : "StripeWebhookEvent",
        entityId: payment?.id ?? event.id,
        metadata: { stripeEventId: event.id, stripeEventType: event.type, matched: payment !== null, status: nextStatus }
      }
    });
    return { processed: true, matched: payment !== null, status: nextStatus };
  });
}
