-- CreateEnum
CREATE TYPE "CheckrideCohortStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "CheckrideEnrollmentStatus" AS ENUM ('PAID_PENDING_ONBOARDING', 'READY', 'ACTIVE', 'COMPLETED', 'REVIEW_REQUIRED', 'REFUNDED', 'DISPUTED');

-- CreateTable
CREATE TABLE "CheckrideCohort" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "capacity" INTEGER NOT NULL DEFAULT 10,
    "status" "CheckrideCohortStatus" NOT NULL DEFAULT 'SCHEDULED',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckrideCohort_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CheckrideCohort_capacity_check" CHECK ("capacity" BETWEEN 1 AND 50),
    CONSTRAINT "CheckrideCohort_dates_check" CHECK ("endsAt" IS NULL OR "endsAt" >= "startsAt")
);

-- CreateTable
CREATE TABLE "CheckrideEnrollment" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "userId" TEXT,
    "cohortId" TEXT,
    "status" "CheckrideEnrollmentStatus" NOT NULL DEFAULT 'PAID_PENDING_ONBOARDING',
    "nextActionAt" TIMESTAMP(3),
    "internalNote" TEXT,
    "onboardedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckrideEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckrideCohort_code_key" ON "CheckrideCohort"("code");
CREATE INDEX "CheckrideCohort_status_startsAt_idx" ON "CheckrideCohort"("status", "startsAt");
CREATE UNIQUE INDEX "CheckrideEnrollment_leadId_key" ON "CheckrideEnrollment"("leadId");
CREATE UNIQUE INDEX "CheckrideEnrollment_paymentId_key" ON "CheckrideEnrollment"("paymentId");
CREATE INDEX "CheckrideEnrollment_status_nextActionAt_idx" ON "CheckrideEnrollment"("status", "nextActionAt");
CREATE INDEX "CheckrideEnrollment_cohortId_status_idx" ON "CheckrideEnrollment"("cohortId", "status");
CREATE INDEX "CheckrideEnrollment_userId_createdAt_idx" ON "CheckrideEnrollment"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "CheckrideCohort" ADD CONSTRAINT "CheckrideCohort_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CheckrideEnrollment" ADD CONSTRAINT "CheckrideEnrollment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CheckrideLead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CheckrideEnrollment" ADD CONSTRAINT "CheckrideEnrollment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CheckridePayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CheckrideEnrollment" ADD CONSTRAINT "CheckrideEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CheckrideEnrollment" ADD CONSTRAINT "CheckrideEnrollment_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "CheckrideCohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;
