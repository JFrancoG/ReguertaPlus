# Tasks - HU-049 (Minimum operational observability for critical jobs)

## 1. Preparation
- [ ] Identify critical jobs and define owner map.
- [ ] Define minimum telemetry schema (logs, counters, duration, errors).
- [ ] Define alert thresholds and escalation channels.

## 2. Android implementation
- [ ] Validate Android-side push diagnostics integration (if surfaced).
- [ ] Confirm no regressions from backend telemetry changes.

## 3. iOS implementation
- [ ] Validate iOS-side push diagnostics integration (if surfaced).
- [ ] Confirm no regressions from backend telemetry changes.

## 4. Backend / Firestore
- [ ] Add structured logs and counters for critical jobs.
- [ ] Add push failure reason classification.
- [ ] Configure baseline alerts for failures and missing runs.

## 5. Testing
- [ ] Execute telemetry unit/integration tests.
- [ ] Execute controlled alert-drill in develop/staging.
- [ ] Perform manual verification of incident triage flow.

## 6. Documentation
- [ ] Create operational runbook and escalation steps.
- [ ] Update issue notes with telemetry and alert evidence.
- [ ] Document known limitations and next improvements.

## 7. Closure
- [ ] Create/update linked issue and connect PR.
- [ ] Complete DoD checklist in spec.md.
- [ ] Attach observability evidence and drill output.
