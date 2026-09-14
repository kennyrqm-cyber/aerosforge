# AeroComm Master MVP v1.0.4 RC

## v1.0.4 resilience hardening

This release candidate adds deterministic release provenance tied to the verified v1.0.2 parent artifact, verifies provenance inside the final ZIP, and adds an operational rollback/recovery policy. Database rollback remains forward-only by default; no automatic down-migration path is claimed.

A cross-device aviation radio training MVP built around a deterministic ATC state/scoring core. AI/speech services may assist with transcription, controller language, translation, and coaching, but they do not own safety-critical clearance state or pass/fail transitions.

## Verified in this package
- Deterministic ATC regression suite and compiled-engine scenario tests.
- Critical readback retry behavior remains on the same state/turn until passed.
- Aviation number/phonetic and clearance-limit normalization covered by tests.
- Scenario graph/critical-field validation before runtime use.
- Certificate HMAC signing with canonical serialization, minimum secret length, and timing-safe verification.
- Audit event hash verification and chained tamper detection.
- Database migrations make audit events append-only, stage certificate consistency constraints, and version certificate signatures.
- Auth-gated and quota-gated transcription/realtime provider routes.
- Instructor/admin role guards and Supabase RLS hardening source.
- Deterministic deployment manifest plus verifier.
- CI configured to require a lockfile, use `npm ci`, run release checks, full TypeScript, and `next build`.

## Not verified / not claimed
This package is not claimed as deployed, production-ready, FAA-approved, WINGS-approved, regulator-certified, or revenue-generating. The current runner cannot produce `package-lock.json` because npm dependency resolution times out, so the full Next.js production build remains an external gate.

## Key commands
```bash
npm run verify:core
npm run verify:release
npm run deployment:verify
npm run cloud:preflight
npm run lockfile:preflight   # intentionally fails until package-lock.json is generated
```

See `docs/RELEASE_CANDIDATE_V101.md`, `docs/DEPLOYMENT_HANDOFF_V101.md`, `docs/BUILD_STATUS.md`, `docs/BROWSER_VALIDATION_V10.md`, and `docs/WINGS_PATH.md` for launch and compliance boundaries.