import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migrationRoot = "prisma/migrations";
const migrations = readdirSync(migrationRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(migrationRoot, entry.name, "migration.sql"));
if (migrations.length !== 1) {
  console.error(`Expected exactly one prelaunch migration; found ${migrations.length}. Review migration history before launch.`);
  process.exit(1);
}
const migration = readFileSync(migrations[0], "utf8");
const models = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((match) => match[1]);
const tables = [...migration.matchAll(/CREATE TABLE\s+"([^"]+)"/g)].map((match) => match[1]);
const missingTables = models.filter((model) => !tables.includes(model));
const extraTables = tables.filter((table) => !models.includes(table));
const requiredFragments = [
  'CREATE UNIQUE INDEX "Account_providerId_accountId_key"',
  'CREATE UNIQUE INDEX "CfiStudentAssignment_cfiId_studentId_key"',
  '"contactConsent" BOOLEAN NOT NULL DEFAULT false',
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
console.log(`Schema/migration static parity passed (${models.length} models / ${tables.length} tables).`);
