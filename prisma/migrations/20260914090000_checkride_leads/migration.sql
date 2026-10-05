-- Revenue MVP: consented Helicopter Checkride Accelerator interest pipeline.
CREATE TABLE "CheckrideLead" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "certificateLevel" TEXT NOT NULL,
  "ratingGoal" TEXT NOT NULL,
  "aircraft" TEXT,
  "targetCheckride" TEXT,
  "biggestChallenge" TEXT,
  "preferredFormat" TEXT,
  "source" TEXT,
  "campaign" TEXT,
  "contactConsent" BOOLEAN NOT NULL DEFAULT false,
  "consentAt" TIMESTAMP(3),
  "privacyVersion" TEXT,
  "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CheckrideLead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CheckrideLead_email_idx" ON "CheckrideLead"("email");
CREATE INDEX "CheckrideLead_status_createdAt_idx" ON "CheckrideLead"("status", "createdAt");
CREATE INDEX "CheckrideLead_ratingGoal_createdAt_idx" ON "CheckrideLead"("ratingGoal", "createdAt");

ALTER TABLE "CheckrideLead" ADD CONSTRAINT "CheckrideLead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
