# AEROSFORGE ONE privacy operations runbook

Status: prelaunch operational draft; legal/privacy review required before public intake.

## Hard launch gate

Privacy intake stays unavailable unless both conditions are true:

1. `PRIVACY_REQUESTS_ENABLED=true` is deliberately configured in the target environment.
2. `PRIVACY_CONTACT_EMAIL` contains a valid, monitored mailbox owned by AEROSFORGE.

Enabling the flag is not approval to launch payments, public sign-up, Winchester leads, Checkride applications, email delivery, indexing, or production.

## Case handling

1. A request starts as `RECEIVED` with a server-owned response target.
2. Move it to `IDENTITY_PENDING` while requesting the minimum additional information needed through the monitored mailbox or existing authenticated account channel.
3. Do not collect passwords, government IDs, medical documents, pilot certificate images, or payment data through the public form.
4. Only mark `VERIFIED` after completing the reviewed identity-verification procedure. Record the method, not sensitive evidence, in the restricted note.
5. The system rejects `IN_PROGRESS` or `COMPLETED` unless verification was previously recorded.
6. Search every applicable system and processor, document the decision and exceptions, respond through the verified channel, then record `COMPLETED`.
   For a verified `CONSENT_WITHDRAWAL`, completion automatically disables matching Winchester and Checkride contact flags and clears scheduled Checkride follow-up.
7. `DENIED` requires an internal reason. Route appeals as a new `APPEAL` request linked in the handling notes until a formal relation is implemented.
8. Every creation and status change must leave an audit event.

## Response target

The default initial target is 45 calendar days and is configurable with `PRIVACY_REQUEST_RESPONSE_DAYS` from 1–90 days. It is an operational deadline, not a claim about which law applies. The case owner must obtain jurisdiction-specific advice for extensions, appeals, authorized agents, and exceptions.

## Retention and erasure blocker

No automated erasure executor exists in this release candidate. Before one is built or any public intake is enabled, AEROSFORGE must approve:

- a system-by-system data inventory and processor list;
- retention periods for accounts, training records, leads, privacy cases, audit events, logs, and backups;
- legal, accounting, fraud-prevention, security, aviation-safety, and dispute exceptions;
- backup expiration and restore/re-deletion behavior;
- a consent-withdrawal procedure that suppresses further outreach;
- export formats and secure delivery procedures;
- a two-person review for destructive deletion operations;
- incident escalation and counsel contacts.

Until that review is complete, minimize collection and do not describe AEROSFORGE as legally compliant merely because this workflow exists.

## Activation checklist

- [ ] Qualified privacy/legal reviewer approves the notice, scope, identity verification, deadlines, appeal path, and retention schedule.
- [ ] Founder names a primary and backup case owner.
- [ ] Monitored privacy mailbox is configured and tested.
- [ ] Public-form abuse controls and alerting are configured at the hosting edge.
- [ ] Case owners complete a dry run for access, correction, consent withdrawal, and deletion.
- [ ] Processor/data map and response templates are approved.
- [ ] Production backup and deletion behavior is verified.
- [ ] Only then set `PRIVACY_REQUESTS_ENABLED=true` in the reviewed environment.
