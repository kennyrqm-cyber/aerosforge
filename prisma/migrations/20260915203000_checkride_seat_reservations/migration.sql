-- Existing payment rows remain nullable because they predate cohort-bound checkout.
ALTER TABLE "CheckridePayment" ADD COLUMN "cohortId" TEXT;

CREATE INDEX "CheckridePayment_cohortId_status_expiresAt_idx"
ON "CheckridePayment"("cohortId", "status", "expiresAt");

ALTER TABLE "CheckridePayment"
ADD CONSTRAINT "CheckridePayment_cohortId_fkey"
FOREIGN KEY ("cohortId") REFERENCES "CheckrideCohort"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
