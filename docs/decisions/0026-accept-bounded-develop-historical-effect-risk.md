# ADR-0026: Accept bounded develop historical-effect risk

## Status

Accepted for local implementation and rehearsal — 2026-10-30. The maintainer
explicitly accepts the bounded risk only in develop, without opening maintenance or
touching production. Shared maintenance remains NOT_READY. This amends the historical-effect completion requirement of
[ADR-0025](0025-separate-contained-deliveries-from-business-drain.md) for one initial
develop migration only. Acceptance authorizes local implementation/rehearsal,
not deployment, a real maintenance window, shared-data writes or production activation.

## Context and completed reconciliation

The retained develop snapshot at `2026-10-29T20:03:40.358Z` contains 117 notices:
55 stored `no_tokens` results, 34 `partial_success`, 25 `success`, and three with no
dispatch result, created on April 1. Twelve of the 59 send summaries additionally
have correlated application/request terminal records: six tokens accepted by FCM,
six rejected. Device receipt and a complete retry history are not established.
The other 105 notices contain 102 stored summaries and three unknown outcomes;
they are not 105 pending sends. All 117 remain unreplayed.

Three 62-row imports and two no-effect calendar probes have separately reconciled
terminals. Source retirement, client/server admission controls and workbook reader
permissions establish distinct observations; none proves that every previously
submitted Firestore, Sheets or FCM operation finished. Repeating unavailable log
queries cannot reconstruct the missing attempt ledger. Nor can the newer incident
workflow manufacture command/claim/receipt ancestry for these legacy operations.

Private evidence: `2026-10-29-historical-effect-disposition`, containing an offline
per-document disposition, exact source/version hashes and correlation checks against
the retained provider records. No current control observation was refreshed by it.

## Decision

Permit a separately versioned **accepted historical risk** admission alternative
only for initial migration of `reguerta-9f27f`, default database,
`develop/plus-collections` and the existing develop workbook. The uncertainty covers
effects submitted before the reviewed develop admission closures, including
unidentified earlier attempts. It is bounded by environment, predecessor sources,
cutoff evidence and one operation, **not** by a proved finite count of all attempts.

- Bind explicit operator acceptance to the exact census, workbook images, reviewed
  predecessor/current source bindings, closure instants and migration/inverse plan.
  Do not use this document's date or a quiet interval as a fabricated cutoff proof.
- Preserve `legacyUntracked=true`, unknown counts and original receipts. A new
  evidence alternative must not claim zero in-flight work, successful old delivery,
  technical termination or satisfaction of the strict ADR-0025 branch.
- Retain every historical notice and never resubmit it or derive new credits,
  assignments or notifications from it. Keep legacy business callbacks closed and
  the reviewed capture-only delivery routes in place.
- Keep all other current gates: known automated-writer controls, current effective
  workbook/parent authority, named owner/admin agreements, exact source/version
  rechecks and existing CAS, Sheets verification and recovery. Newly discovered
  writers, drift or evidence of continuing old work block this alternative.
- During the operation, unexpected source/cell changes stop progression and retain
  closure for reconciliation. Recovery must inspect the changed state; it must not
  overwrite an unexplained late change or automatically reopen legacy writers.

This explicitly accepts the possibility of an unidentified earlier external
submission taking effect late. Before/after checks can detect some such changes;
they cannot prevent every race or cancel an already accepted notification. That is
the risk being accepted, not a new claim of exclusive provider execution.

## Alternatives and consequences

Recommended for develop: accept this limited risk after local rejection/recovery
tests. It avoids indefinite historical searches and disruption of production's
shared identities. It requires a small explicit branch in the existing evidence
and admission contracts, not another worker, journal or migration framework.

Keeping ADR-0025 unchanged remains valid: maintenance stays blocked until independent
completion evidence or effective destination isolation is obtained. A separate
project/destination would require its own design, data/link implications and approval;
it is not implied by this proposal.

Acceptance does not waive current automatic-writer discovery/control requirements,
authorize classic `develop/collections` reopening, extend cooperative human policy
to automated credentials, or change any production policy.

## Implementation and validation

Reuse the existing barrier/evidence/CAS path and retain strict defaults. Rehearse
rejection of production, missing/changed acceptance, new source events, stale
controls, missing agreements, observed continuing work and unexplained late writes;
verify preserved unknowns, no replay, stop and inspect-only recovery. Do not attach
legacy events to invented notification incidents. Only after that acceptance and
the remaining real authority gates can a specific live window be proposed.


## Local implementation checkpoint — 2026-10-30

Implemented locally after explicit acceptance, without changing shared runtime
configuration or opening maintenance. A versioned `develop-historical-risk-v1`
record is hashed into the independently authorized v3 command/checkpoint. It binds
named operator acceptance, predecessor source/closure evidence, current controls,
exact source/workbook and forward/inverse plan identities. Acceptance must follow
observed closures. Forward requires initial revision/epoch zero and no active
lineage; inverse requires the first initialized revision/epoch and active lineage.
The existing migration runner additionally verifies both exact prepared plans.

Only explicitly listed technical predecessors may retain null work counts. Human
agreements, positive work observations and unknown unreviewed writers still reject.
`legacyUntracked=true`, no replay and `drainedAtMillis=null` remain in immutable
evidence; assessment time is not described as drain completion. Strict/default
and production behavior remain unchanged. Current human readers, expiry, held
checkpoint equality and CAS/incident/recovery paths are reused.

The fixed-loopback migration runner supports an explicit local opt-in; it maps the
logical develop workbook identity to its existing synthetic workbook and uses only
`demo-reguerta-hu084-migration` at `127.0.0.1:8798`. Its transactional source set also
includes historical notices, so an inserted/changed notice invalidates acceptance.
No Google/FCM writer or new shared entry point is added. The live preparation script
continues to report NOT_READY; these simulated controls are not live authority.

Validation under Node22.23.4: build/full lint, CJS syntax and diff checks pass;
**137 local tests and 26 Firestore-emulator tests pass, zero failures/skips**. The
actual SDK forward/inverse preserves old notices and restores 62 original rows
from 72 canonical rows. New notices, substituted plans and late manual edits reject;
post-commit failure retains 72 committed rows and closure, never falsely claiming
rollback. A changed held checkpoint cannot fabricate a durable incident receipt.
Private evidence: `2026-10-30-historical-risk-local`. No native changes/parity gap.
All implementation/doc changes remain local after `d3ae12d9`; no commit/push was
requested for this step. Next bind fresh real authority/observations and the exact
operation acceptance before requesting a separately authorized maintenance window.

## Final local materialization checkpoint — 2026-10-30

The accepted risk decision is unchanged. The loopback runner now uses an explicit
closed migration policy instead of treating a fixture annual policy as runtime
authority. Its distinct record is deliberately rejected by the ordinary annual
source parser. Complete transaction manifests are reconstructed and compared
inside the existing attempt; inverse depends on the actual forward receipt.
No live entry point, human acceptance or held shared observation is manufactured.
The retained workbook/index identity is bound as evidence, while all service
versions, timestamps, barriers and receipts used in this acceptance belong to
the emulator. Local closed-policy acceptance: 92 unit + 39 emulator + one captured
Sheets test; see the bilingual migration guide. Shared activation and annual
policy admission remain separate gates.
