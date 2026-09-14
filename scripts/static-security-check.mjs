import { readFileSync } from "node:fs";

const checks = [
  ["lib/auth.ts", /input:\s*false/, "role must remain server-owned (input:false)"],
  ["lib/auth.ts", /BETTER_AUTH_SECRET/, "auth secret guard must exist"],
  ["lib/auth.ts", /BETTER_AUTH_ALLOWED_HOSTS/, "auth hosts must be explicitly allowlisted"],
  ["lib/auth.ts", /storage:\s*"database"/, "auth rate limiting must use shared database storage"],
  ["lib/auth.ts", /disableSignUp: process\.env\.PUBLIC_SIGNUP_ENABLED !== "true"/, "public signup must fail closed"],
  ["proxy.ts", /\/dashboard/, "dashboard request protection must exist"],
  ["lib/session.ts", /requireRole/, "server-side role enforcement must exist"],
  ["lib/actions.ts", /safeLessonId, status: ContentStatus\.PUBLISHED/, "lesson completion must require PUBLISHED content"],
  ["lib/actions.ts", /id: safeScenarioId, status: ContentStatus\.PUBLISHED/, "Gauntlet attempts must require PUBLISHED scenarios"],
  ["lib/content-workflow.ts", /Only approved lessons can be published/, "lesson publication must require prior approval"],
  ["lib/content-workflow.ts", /Publication requires approval from a CFI other than the publishing admin/, "lesson publication must require independent CFI approval"],
  ["lib/content-workflow.ts", /reviewer:\s*\{ role: Role\.CFI \}/, "publication approval must come from a current CFI"],
  ["lib/content-workflow.ts", /decision === ReviewDecision\.APPROVED && actor\.role !== Role\.CFI/, "only CFIs may issue qualifying approvals"],
  ["lib/content-workflow.ts", /contentReview\.create\(\{[\s\S]*version: lesson\.version/, "lesson review records must capture reviewed version"],
  ["lib/content-workflow.ts", /gauntletReview\.create\(\{[\s\S]*version: scenario\.version/, "scenario review records must capture reviewed version"],
  ["lib/content-workflow.ts", /version: lesson\.version[\s\S]*decision: ReviewDecision\.APPROVED/, "lesson publication must use current-version approval"],
  ["lib/content-workflow.ts", /version: scenario\.version[\s\S]*decision: ReviewDecision\.APPROVED/, "scenario publication must use current-version approval"],
  ["prisma/schema.prisma", /model ContentReview \{[\s\S]*version\s+Int/, "lesson reviews must record content version"],
  ["prisma/schema.prisma", /model GauntletReview \{[\s\S]*version\s+Int/, "scenario reviews must record content version"],
  ["lib/actions.ts", /contactConsent/, "Winchester lead capture must retain explicit contact consent"],
  ["lib/actions.ts", /WINCHESTER_LEADS_ENABLED !== "true"/, "Winchester lead capture must fail closed"],
  ["lib/actions.ts", /WINCHESTER_LEAD_STATUS_UPDATED/, "lead status changes must be audited"],
  ["lib/actions.ts", /CHECKRIDE_LEADS_ENABLED !== "true"/, "Checkride lead capture must fail closed"],
  ["lib/actions.ts", /contactConsent = formData\.get\("contactConsent"\) === "yes"/, "Checkride lead capture must require explicit consent"],
  ["lib/checkride-leads.ts", /CHECKRIDE_LEAD_CREATED/, "Checkride lead creation must be audited"],
  ["lib/checkride-leads.ts", /actor\.role !== Role\.ADMIN/, "Checkride pipeline changes must require Admin role"],
  ["lib/checkride-leads.ts", /CHECKRIDE_LEAD_STATUS_UPDATED/, "Checkride pipeline status changes must be audited"],
  ["prisma/schema.prisma", /model CheckrideLead \{[\s\S]*contactConsent\s+Boolean\s+@default\(false\)/, "Checkride consent must fail closed by default"],
  ["app/checkride/page.tsx", /No payment is collected in this release candidate/, "Checkride offer must disclose that payment is disabled"],
  ["lib/actions.ts", /CFI_STUDENT_ASSIGNED/, "CFI assignments must be audited"],
  ["lib/actions.ts", /GAUNTLET_DRAFT_UPDATED/, "scenario edits must be audited"],
  ["lib/actions.ts", /status: ContentStatus\.DRAFT,[\s\S]*version: \{ increment: 1 \}/, "scenario edits must create a new draft version"],
  ["app/privacy/page.tsx", /Prelaunch privacy notice/, "privacy notice must remain clearly marked prelaunch until legal review"],
  ["app/robots.ts", /PUBLIC_INDEXING_ENABLED === "true"/, "search indexing must fail closed"],
  ["prisma/schema.prisma", /role\s+Role\s+@default\(STUDENT\)/, "database role default must remain STUDENT"],
  ["prisma/schema.prisma", /status\s+ContentStatus\s+@default\(DRAFT\)/, "content must default to DRAFT"],
  ["prisma/schema.prisma", /@@unique\(\[providerId, accountId\]\)/, "Better Auth provider/account uniqueness must exist"],
  ["prisma/schema.prisma", /contactConsent\s+Boolean\s+@default\(false\)/, "lead consent must fail closed by default"],
  ["prisma/schema.prisma", /model RateLimit \{/, "database-backed auth rate limit model must exist"],
  ["prisma/seed.ts", /GITHUB_ACTIONS !== "true"/, "synthetic identities must be restricted to GitHub Actions"],
  ["prisma/seed.ts", /E2E_TEST_PASSWORD/, "synthetic identity passwords must come from the environment"],
  ["lib/auth.ts", /requireEmailVerification:\s*true/, "email/password sessions must require verified email"],
  ["lib/auth.ts", /revokeSessionsOnPasswordReset:\s*true/, "password reset must revoke existing sessions"],
  ["lib/auth.ts", /"\/request-password-reset": \{ window: 60, max: 3 \}/, "password reset requests must be tightly rate limited"],
  ["lib/auth.ts", /"\/send-verification-email": \{ window: 60, max: 3 \}/, "verification email requests must be tightly rate limited"],
  ["lib/auth.ts", /PUBLIC_SIGNUP_ENABLED === "true" && !isAccountEmailDeliveryConfigured\(\)/, "signup must require configured account email delivery"],
  ["lib/account-email.ts", /AUTH_EMAIL_DELIVERY_ENABLED === "true"/, "account email delivery must fail closed"]
];

const failures = [];
for (const [path, pattern, message] of checks) {
  const text = readFileSync(path, "utf8");
  if (!pattern.test(text)) failures.push(`${path}: ${message}`);
}
if (failures.length) {
  console.error("Static security checks FAILED:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log(`Static security checks passed (${checks.length} invariants).`);
