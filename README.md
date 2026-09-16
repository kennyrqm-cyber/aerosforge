# AEROSFORGE ONE™

Release-candidate foundation for an aviation education and operations platform.

## Implemented in this candidate

- Next.js application with Better Auth and Neon Postgres
- Server-owned Student, CFI, and Admin roles with route-level authorization
- CI-only synthetic identities that cannot be seeded outside GitHub Actions
- Academy lessons and Gauntlet scenarios restricted to published content
- Independent CFI approval followed by separate Admin publication
- Version-bound review records and audit events
- Controlled public-signup, Winchester-lead, search-indexing, and account-email flags
- Focused Helicopter Checkride Accelerator offer and consented qualification pipeline
- Admin-owned checkride lead status workflow with acquisition labels, duplicate suppression, and audit history
- Founder revenue control center with follow-up dates, internal notes, stage timestamps, overdue signals, and funnel metrics
- Student-only FAA-S-ACS-15 confidence baseline with a self-reported focus map visible to the assigned CFI
- Admin-only, amount-locked Stripe Checkout for qualified Checkride leads with signed, idempotent webhook fulfillment
- Payment-triggered Checkride delivery records with Admin-owned cohorts, capacity controls, account matching, next-action accountability, and refund/dispute lockout
- Cohort-bound Checkout inventory with expiring seat holds, automatic paid-cohort assignment, and refund/expiration release controls
- Database-backed founding-cohort launch gates with versioned evidence, accountable reviewers, audit history, and server-enforced checkout lockout
- Fail-closed privacy-request intake with a monitored-contact dependency, duplicate suppression, response targets, and audit history
- Admin privacy case queue that blocks processing/completion until identity verification is recorded
- Email verification and password recovery integration prepared for Resend
- Password-reset session revocation and database-backed auth rate limiting
- Health, role-boundary, content-workflow, recovery-gate, schema, and security checks
- Preserved legacy site and documented rollback path

## Controlled-launch configuration

All public capabilities remain closed unless their exact flags and dependencies are configured. See `.env.example`.

- `PUBLIC_SIGNUP_ENABLED` requires verified account email delivery.
- `AUTH_EMAIL_DELIVERY_ENABLED` requires both `RESEND_API_KEY` and `AUTH_EMAIL_FROM`.
- `WINCHESTER_LEADS_ENABLED` controls lead submission.
- `CHECKRIDE_LEADS_ENABLED` controls Checkride Accelerator applications.
- `CHECKRIDE_PAYMENTS_ENABLED` remains ineffective unless a restricted Stripe key, signed-webhook secret, approved Price ID, and exact checkout origin are all configured.
- Payment configuration cannot bypass the independently tracked Stage 4 launch gates documented in `docs/FOUNDING_COHORT_LAUNCH_GATES.md`.
- `PRIVACY_REQUESTS_ENABLED` requires a valid `PRIVACY_CONTACT_EMAIL`; the case workflow remains unavailable without both.
- `PRIVACY_REQUEST_RESPONSE_DAYS` sets an operational target only and does not determine applicable legal obligations.
- `PUBLIC_INDEXING_ENABLED` controls search-engine indexing.
- CI test identities require GitHub Actions plus an explicit E2E flag and password.

## Non-negotiable safety boundary

AEROSFORGE does not issue FAA certificates or WINGS credit and does not replace a CFI, an official briefing, approved aircraft data, current regulations, or pilot-in-command judgment. The Checkride Baseline is self-reported study planning—not an exam, endorsement, eligibility determination, readiness score, or pass prediction. Checkout availability is not acceptance, certification, or a pass guarantee. Aviation training content must remain draft until independently reviewed and published through the enforced workflow.

## Remaining production blockers

- Verify the sending domain and exercise real email verification and password recovery end to end.
- Provision a least-privilege Stripe restricted key, approved $349 one-time Price, and signed webhook; pass sandbox payment, expiration, refund, and dispute drills before enabling payments.
- Conduct an end-to-end founding-cohort delivery rehearsal with a real schedule, named delivery owner, support path, refund procedure, and independently approved training content.
- Establish identity-proofed CFI onboarding and role-elevation procedures.
- Obtain qualified review of the privacy notice and operations runbook; approve retention, erasure, backup, appeal, and incident-response procedures.
- Prove Neon backup restoration and document recovery objectives.
- Add production monitoring, alerting, and an on-call owner.
- Complete accessibility and supported-device/browser acceptance testing.
- Approve production content through the independent CFI/Admin workflow.
- Validate the Checkride Accelerator offer with real helicopter students before building broader marketplace or FlightOps scope.

Until those gates are evidenced, this branch is a release candidate—not a public production launch.

## Verification

```bash
npm ci
npm run preflight
npm run test:launch-readiness # CI test identities + PostgreSQL only
npm run typecheck
npm run lint
npm run build
```

Database-backed integration and post-deploy smoke tests run in GitHub Actions.

## Brand

AEROSFORGE is the working brand. Use ™ while clearance or registration is pending; never use ® unless registration is granted.
