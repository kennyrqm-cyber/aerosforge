# Founding Cohort Launch Gates

Revenue Stage 4 turns the remaining production blockers into server-enforced, versioned decisions. A configured Stripe account or an enabled environment flag is not sufficient to create Checkride Accelerator checkout.

## Enforcement

- Every required gate defaults to `BLOCKED`, including a gate with no database row.
- `EVIDENCE_SUBMITTED` requires a meaningful evidence reference but does not permit sales.
- `APPROVED` requires evidence plus an accountable reviewer name or role.
- Gate definitions are versioned in code. Evidence recorded against a different version fails closed.
- Every change is attributed to the authenticated Admin and recorded in `AuditEvent`.
- Every update carries the revision timestamp loaded by the Admin. A stale form is rejected instead of silently overwriting newer evidence.
- Audit history retains the before-and-after status, evidence reference, reviewer, gate version, and approval time for each change.
- Checkout checks all gates before contacting Stripe and checks again inside the serializable seat-reservation transaction.
- A paid webhook rechecks readiness before automatic enrollment. If a gate was revoked after Checkout creation, financial evidence is retained in manual review and delivery does not begin automatically.
- The Admin dashboard stops exposing an active Checkout link while readiness is revoked and instructs operations to expire that Session in Stripe before reopening launch readiness.
- Public flags, `main`, production promotion, and search indexing remain separate deliberate approvals.

Do not paste passwords, API keys, government IDs, medical records, certificate images, or confidential legal advice into gate evidence. Record a controlled document name/version, dated drill result, ticket, or restricted evidence location.

## Required gates

| Gate | Accountable authority | Minimum evidence |
|---|---|---|
| Paid content approved | Independent CFI | Exact lesson/scenario versions, CFI decision, Admin publication record |
| Cohort delivery rehearsed | Operations owner | Dated onboarding-to-completion rehearsal and resolved blockers |
| Stripe sandbox drills passed | Payments owner | Payment, expiration, delayed success, failure, refund, dispute, replay, and reconciliation results |
| Terms, privacy, and refunds reviewed | Qualified reviewer | Reviewed production versions and dated disposition of material issues |
| Account email flow proven | Security owner | Domain verification, verification email, reset, revocation, and recovery results |
| CFI identity controls approved | Founder | Identity/certificate review and Admin-only role-elevation procedure |
| Backup restoration proven | Database owner | Restore date, source backup, recovery timing, validation, and owner |
| Monitoring and support staffed | On-call owner | Alert routes, response owner, escalation path, and customer-support procedure |
| Accessibility and student acceptance passed | Acceptance owner | Supported-device/browser results and real helicopter-student rehearsal findings |

## Approval sequence

1. Complete the underlying work outside the checklist.
2. Store the evidence in its appropriate controlled system.
3. Record a non-sensitive evidence reference in the Admin dashboard.
4. Move the gate to `EVIDENCE_SUBMITTED` for review.
5. The accountable authority reviews the current gate definition and evidence.
6. An Admin records `APPROVED` with the accountable reviewer.
7. Revoke the gate immediately if evidence becomes stale, an incident invalidates it, or the operating process changes.

## Revenue-opening decision

All gates approved means the operational evidence layer is ready. It does **not** independently open sales. Checkout still requires:

- explicit `CHECKRIDE_PAYMENTS_ENABLED=true` in the reviewed environment;
- a least-privilege restricted Stripe key and signed webhook secret;
- the approved $349 one-time Stripe Price and exact HTTPS checkout origin;
- a qualified, consented applicant;
- independently published content;
- a future scheduled cohort with a defined delivery window and available inventory; and
- no unresolved payment review state.

Production promotion, public lead collection, signup, privacy intake, and indexing remain separately fail-closed.
