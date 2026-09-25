CREATE TYPE "LaunchGateStatus" AS ENUM ('BLOCKED', 'EVIDENCE_SUBMITTED', 'APPROVED');

CREATE TABLE "LaunchGateDecision" (
    "id" TEXT NOT NULL,
    "gateKey" TEXT NOT NULL,
    "gateVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "LaunchGateStatus" NOT NULL DEFAULT 'BLOCKED',
    "evidence" TEXT,
    "reviewerName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaunchGateDecision_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LaunchGateDecision_gateVersion_check" CHECK ("gateVersion" >= 1),
    CONSTRAINT "LaunchGateDecision_evidence_check" CHECK (
      "status" = 'BLOCKED' OR length(trim(COALESCE("evidence", ''))) >= 20
    ),
    CONSTRAINT "LaunchGateDecision_approval_check" CHECK (
      "status" <> 'APPROVED' OR
      ("approvedAt" IS NOT NULL AND length(trim(COALESCE("evidence", ''))) >= 20 AND length(trim(COALESCE("reviewerName", ''))) >= 3)
    )
);

CREATE UNIQUE INDEX "LaunchGateDecision_gateKey_key" ON "LaunchGateDecision"("gateKey");
CREATE INDEX "LaunchGateDecision_status_updatedAt_idx" ON "LaunchGateDecision"("status", "updatedAt");

ALTER TABLE "LaunchGateDecision"
ADD CONSTRAINT "LaunchGateDecision_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
