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
