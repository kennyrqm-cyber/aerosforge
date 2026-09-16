-- Founder revenue operations: accountable follow-up and server-owned funnel timestamps.
ALTER TABLE "CheckrideLead"
  ADD COLUMN "internalNote" TEXT,
  ADD COLUMN "nextFollowUpAt" TIMESTAMP(3),
  ADD COLUMN "lastContactedAt" TIMESTAMP(3),
  ADD COLUMN "qualifiedAt" TIMESTAMP(3),
  ADD COLUMN "enrolledAt" TIMESTAMP(3),
  ADD COLUMN "closedAt" TIMESTAMP(3);

CREATE INDEX "CheckrideLead_nextFollowUpAt_status_idx" ON "CheckrideLead"("nextFollowUpAt", "status");
