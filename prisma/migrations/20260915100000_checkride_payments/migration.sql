-- CreateEnum
CREATE TYPE "CheckridePaymentStatus" AS ENUM ('CREATING', 'OPEN', 'PAID', 'EXPIRED', 'FAILED', 'REVIEW_REQUIRED', 'REFUNDED', 'DISPUTED');

-- CreateTable
CREATE TABLE "CheckridePayment" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "offerCode" TEXT NOT NULL DEFAULT 'PRIVATE_HELICOPTER_FOUNDING_2026',
    "offerVersion" INTEGER NOT NULL DEFAULT 1,
    "amountCents" INTEGER NOT NULL DEFAULT 34900,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "CheckridePaymentStatus" NOT NULL DEFAULT 'CREATING',
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeCustomerId" TEXT,
    "checkoutUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckridePayment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CheckridePayment_amountCents_check" CHECK ("amountCents" = 34900),
    CONSTRAINT "CheckridePayment_currency_check" CHECK ("currency" = 'usd')
);

-- CreateTable
CREATE TABLE "StripeWebhookEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "paymentId" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckridePayment_stripeCheckoutSessionId_key" ON "CheckridePayment"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "CheckridePayment_stripePaymentIntentId_key" ON "CheckridePayment"("stripePaymentIntentId");
CREATE INDEX "CheckridePayment_leadId_createdAt_idx" ON "CheckridePayment"("leadId", "createdAt");
CREATE INDEX "CheckridePayment_status_createdAt_idx" ON "CheckridePayment"("status", "createdAt");
CREATE INDEX "StripeWebhookEvent_paymentId_processedAt_idx" ON "StripeWebhookEvent"("paymentId", "processedAt");
CREATE INDEX "StripeWebhookEvent_type_processedAt_idx" ON "StripeWebhookEvent"("type", "processedAt");

-- AddForeignKey
ALTER TABLE "CheckridePayment" ADD CONSTRAINT "CheckridePayment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CheckrideLead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CheckridePayment" ADD CONSTRAINT "CheckridePayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StripeWebhookEvent" ADD CONSTRAINT "StripeWebhookEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CheckridePayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
