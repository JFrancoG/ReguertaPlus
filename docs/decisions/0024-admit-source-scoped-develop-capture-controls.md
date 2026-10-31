# ADR-0024: Admit source-scoped develop capture controls

## Status

Accepted for local implementation and isolated rehearsal on 2026-10-29, following
maintainer authorization to integrate develop control with the maintenance barrier
and rehearse initial creation/recovery. No live maintenance or migration is admitted.

## Context

Four legacy Firestore triggers serve both develop and production. Their reviewed
bridge captures develop events without invoking business callbacks; four private
collectors preserve delivery evidence with retry. Disabling shared transport would
affect production. The previous barrier only recognized disabled/isolated delivery;
the offline entry preparation deliberately could not substitute its capture review.

## Decision

Add the explicit `capture-only` writer-control variant with a mandatory
`developCapture` binding, revision `hu084-develop-source-capture-v1`. Require all
four exact shared/private pairs together, a single project/default database and
develop scope. Require exact function and document-pattern identities, ACTIVE
transport and shared no-retry/private retry policies. Pin immutable source generation,
runtime revision and observed source/configuration digests to reviewed digests.
The trusted control-plane adapter must obtain those observations; a caller-supplied
hash, preparer result or successful GET alone cannot establish reviewed code behavior.

The complete binding hashes into the authorized control manifest and the immutable
barrier envelope. Initial/final control read-backs must still match. Keep the original
inventory identities, digests and strict/cooperative envelope versions readable:
this is an explicit control-evidence extension, not a rewrite of historical receipts.
Without the new variant and its complete proof, required states remain unchanged.
Production rejects it. A cooperative administrator agreement must bind the same
project. Only the shared project and fixed demo rehearsal project are supported.
The demo allowance is for injected rehearsal evidence, not permission to contact a
shared service or synthesize its observations.

All writer pending/in-flight counts and all eight causal-drain counters remain
mandatory, numeric and zero. Chronology, freshness, Rules, workbook, IAM, owner and
administrator observations remain independently enforced. ACTIVE transport is never
serialized as disabled. Capture does not prove prior callbacks finished or that
possibly delivered notices are safe to replay. ADR-0022 human agreements are unchanged.

Reuse the existing trusted adapter, evidence/incident repository and fixed-loopback
migration/recovery implementation. The transaction reads absence of all initial
authority documents and the Sheets submission pointer before creating revision1 /
writeEpoch1, source policy and both preserved cursors. The synthetic command's zero
predecessor is bound to actual document absence, not an invented persisted epoch0.
Recovery restores exact legacy payloads and removes introduced rotations/policy,
retaining closed audit state at a higher epoch. Lost acknowledgements retain an
incident and block automatic replay, including after a service restart. They do not
imply rollback or authorize deleting the incident. No automatic reopening is added.

## Alternatives and consequences

Global trigger shutdown is incompatible with preserving production availability.
Calling capture-only transport disabled would misrepresent the control. A separate
migration engine or another complete maintenance-policy version would duplicate the
unchanged admission, participant and recovery rules. The bounded evidence extension
reuses those rules while retaining the new capability explicitly in each manifest.

Old binaries cannot admit the new variant; deployment must include its verifier
before any real use. Read-only preparation remains non-executable and still lacks
trusted runtime/control, causal drain, current source policy and participant/window
admission. This implementation supplies the verifier and tests, not a new deployed
control-plane service. Remaining live composition must obtain real evidence through
the existing trusted port, not reuse the synthetic rehearsal controls.

## Validation

Functions build/lint and focused CJS lint pass. Seventy-two local barrier/control/
owner/administrator tests pass; thirty-three Firestore emulator tests pass, including
seventeen migration scenarios and sixteen evidence/incident repository scenarios.
No skips. The rehearsal uses `demo-reguerta-hu084-migration` at `127.0.0.1:8798`;
repository regression tests use their separate demo project on that same emulator.
No deployed export, native app, shared Firebase document, Sheets file or FCM changed.
