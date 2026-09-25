import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migrationRoot = "prisma/migrations";
const migrations = readdirSync(migrationRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(migrationRoot, entry.name, "migration.sql"))
  .sort();
if (migrations.length === 0) {
  console.error("At least one reviewed migration is required before launch.");
  process.exit(1);
}
const migration = migrations.map((path) => readFileSync(path, "utf8")).join("\n");
const models = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((match) => match[1]);
const tables = [...migration.matchAll(/CREATE TABLE\s+"([^"]+)"/g)].map((match) => match[1]);
const missingTables = models.filter((model) => !tables.includes(model));
const extraTables = tables.filter((table) => !models.includes(table));
const requiredFragments = [
  'CREATE UNIQUE INDEX "Account_providerId_accountId_key"',
  'CREATE UNIQUE INDEX "CfiStudentAssignment_cfiId_studentId_key"',
  '"contactConsent" BOOLEAN NOT NULL DEFAULT false',
  'CREATE TABLE "CheckrideLead"',
  'CREATE INDEX "CheckrideLead_status_createdAt_idx"',
  'CREATE INDEX "CheckrideLead_nextFollowUpAt_status_idx"',
  'CREATE TABLE "PrivacyRequest"',
  'CREATE INDEX "PrivacyRequest_status_dueAt_idx"',
  'ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_userId_fkey"',
  'CREATE TABLE "CheckrideBaseline"',
  'CREATE INDEX "CheckrideBaseline_userId_createdAt_idx"',
  'ALTER TABLE "CheckrideBaseline" ADD CONSTRAINT "CheckrideBaseline_userId_fkey"',
  'CONSTRAINT "CheckrideBaseline_confidenceTotal_check" CHECK ("confidenceTotal" BETWEEN 10 AND 50)',
  '"instrumentVersion" INTEGER NOT NULL DEFAULT 1',
  'CREATE TYPE "CheckridePaymentStatus"',
  'CREATE TABLE "CheckridePayment"',
  'CREATE TABLE "StripeWebhookEvent"',
  'CREATE UNIQUE INDEX "CheckridePayment_stripeCheckoutSessionId_key"',
  'CREATE UNIQUE INDEX "CheckridePayment_stripePaymentIntentId_key"',
  'CONSTRAINT "CheckridePayment_amountCents_check" CHECK ("amountCents" = 34900)',
  'ALTER TABLE "CheckridePayment" ADD CONSTRAINT "CheckridePayment_leadId_fkey"',
  'ALTER TABLE "StripeWebhookEvent" ADD CONSTRAINT "StripeWebhookEvent_paymentId_fkey"',
  'CREATE TYPE "CheckrideCohortStatus"',
  'CREATE TYPE "CheckrideEnrollmentStatus"',
  'CREATE TABLE "CheckrideCohort"',
  'CREATE TABLE "CheckrideEnrollment"',
  'CREATE UNIQUE INDEX "CheckrideEnrollment_leadId_key"',
  'CREATE UNIQUE INDEX "CheckrideEnrollment_paymentId_key"',
  'CONSTRAINT "CheckrideCohort_capacity_check" CHECK ("capacity" BETWEEN 1 AND 50)',
  'ALTER TABLE "CheckrideCohort" ADD CONSTRAINT "CheckrideCohort_ownerId_fkey"',
  'ALTER TABLE "CheckrideEnrollment" ADD CONSTRAINT "CheckrideEnrollment_paymentId_fkey"',
  'ALTER TABLE "CheckrideEnrollment" ADD CONSTRAINT "CheckrideEnrollment_userId_fkey"',
  'ALTER TABLE "CheckridePayment" ADD COLUMN "cohortId" TEXT',
  'CREATE INDEX "CheckridePayment_cohortId_status_expiresAt_idx"',
  'ALTER TABLE "CheckridePayment"',
  'ADD CONSTRAINT "CheckridePayment_cohortId_fkey"',
  'CREATE TYPE "LaunchGateStatus"',
  'CREATE TABLE "LaunchGateDecision"',
  'CREATE UNIQUE INDEX "LaunchGateDecision_gateKey_key"',
  'CONSTRAINT "LaunchGateDecision_evidence_check"',
  'CONSTRAINT "LaunchGateDecision_approval_check"',
  'ALTER TABLE "LaunchGateDecision"',
  'ADD CONSTRAINT "LaunchGateDecision_updatedById_fkey"',
  'ADD COLUMN "qualifiedAt" TIMESTAMP(3)',
  'ADD COLUMN "enrolledAt" TIMESTAMP(3)',
  'ALTER TABLE "CheckrideLead" ADD CONSTRAINT "CheckrideLead_userId_fkey"',
  'CREATE TABLE "RateLimit"',
  'CREATE TABLE "GauntletReview"',
  '"version" INTEGER NOT NULL'
];
const missingFragments = requiredFragments.filter((fragment) => !migration.includes(fragment));
if (missingTables.length || extraTables.length || missingFragments.length) {
  console.error("Schema/migration static parity FAILED.");
  if (missingTables.length) console.error("Missing tables:", missingTables.join(", "));
  if (extraTables.length) console.error("Unexpected tables:", extraTables.join(", "));
  if (missingFragments.length) console.error("Missing migration invariants:", missingFragments.join(" | "));
  process.exit(1);
}
console.log(`Schema/migration static parity passed (${models.length} models / ${tables.length} tables across ${migrations.length} migrations).`);
