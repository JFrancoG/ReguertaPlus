# HU-082 to HU-083 handoff contract

## Status and boundary

This versioned handoff freezes the local contract that HU-083 / #267 must consume.
It does not mark HU-082 as merged, authorize an HU-083 implementation branch, deploy
Functions or Rules, execute a live planning request, or activate Firestore/Sheets.
The consultation workbook publication is communication evidence only and is not a
sync-consumer or activation result.

HU-082 remains the authority for continuous rotation planning, the two-type bundle,
activation/recovery materialization, sync-command lifecycle, public-write event
classification, and retention codecs. HU-083 owns the real multi-season Sheets
adapter and the durable integration described below. HU-084 owns joins, departures,
coverage and credits. HU-085 owns production identities, configuration, deployment,
activation and live rollback.

## Frozen upstream surfaces

| Surface | HU-082 authority | HU-083 consumption rule |
| --- | --- | --- |
| Sheets sync command | `SHIFT_PLANNING_SYNC_COMMAND_SCHEMA_VERSION = 1` in `functions/src/shift-planning-sync-command.ts` | Parse the exact schema. Never introduce a looser parallel command or infer missing fields. |
| Command location and identity | `{environment}/plus-collections/shiftPlanningSyncCommands/{bundleRevision}-{type}`; idempotency key `{bundleRevision}:sheets:{type}` | Discover only bounded runnable commands and preserve the stable ID/key through every external retry. |
| Command repository | `discoverRunnable`, `claim`, `authorizeBatch`, and `complete` in `functions/src/shift-planning-firestore-sync-command-repository.ts` | Claim transactionally, call `authorizeBatch` immediately before each Sheets batch, and complete only with verified workbook revision plus partition digest. |
| Public-write classifier | Schema v1 in `functions/src/shift-planning-public-event-contract.ts` | Use the exact before/after marker and registry decision. Controlled backend events are audited no-ops; ordinary later edits retain the legacy path; forged or missing changed authority fails closed. |
| Replay retention | Schema v1 in `functions/src/shift-planning-public-event-retention.ts` | Persist operation retention and event ledgers with create-or-exact-replay, alert rejected changed-marker events, and clean up only after the exclusive expiry decision allows it. |
| Public mobile source | `{environment}/plus-collections/shifts`, with `source = app` and separate `origin = planner` | Sheets never becomes rotation authority. Candidate/private paths must remain invisible to the supported flat mobile readers. |

The immutable sync command already binds type, bundle revision/digest, write epoch,
workbook/partition identity, expected partition state/epoch/lease, target season,
affected projection seasons, and active lineage. HU-083 may add durable external
attempt evidence around its adapter, but may not mutate or reinterpret those fields.

## Required HU-083 execution contract

1. An explicit pull/invoked worker discovers pending commands after commit. It must
   not depend on enabling an Eventarc trigger after command creation.
2. The worker claims one command, routes its exact partition manifest across all
   affected seasonal tabs, and calls `authorizeBatch` immediately before every
   external mutation. A lost invocation or acknowledgement is reconciled through
   the stable idempotency key and workbook read-back, never by assuming success.
3. Completion records the exact read-back workbook revision and partition digest.
   Busy, stale, ambiguous or partially observed work retains the lease and prevents
   recovery/supersession until terminal drain is proved.
4. The real multi-season adapter creates missing tabs idempotently and merges stable
   rows without whole-tab clearing. Import deletion is bounded to partitions read
   successfully in that run; rotation owner, cohort, round and cursor remain
   Firestore-owned.
5. The real `onShiftWritten` integration feeds the exact event classifier. It writes
   controlled/rejected event ledgers create-or-exact-replay, performs no legacy
   export/notification for controlled events, alerts on rejected changed authority,
   and preserves ordinary later edits/deletes.
6. Cleanup protects the operation terminal, retention binding and every controlled
   ledger through the exact exclusive boundary. Unknown delayed backend markers
   after eligible cleanup still fail closed and alert; they never fall through as
   ordinary events.

## Acceptance evidence HU-083 must add

- Real adapter tests for delivery and market commands spanning existing and newly
  created seasonal tabs, including carryover plus later-generation coexistence.
- Lost-invocation, lost-acknowledgement, stale epoch, partial batch and recovery-drain
  integration tests with durable external-attempt/read-back evidence.
- Real trigger tests for activation, repair, sync-correction, recovery delete,
  replay, retained ordinary edits/deletes, forged authority and unknown markers.
- Cleanup persistence tests at, before and after the exact retention boundary.
- Functions lint/build, focused adapter/emulator suites, applicable Rules/security
  tests and Android/iOS regressions only when the shared mobile contract changes.

The upstream executable evidence is in:

- `functions/test/shift-planning-firestore-sync-command-repository.test.cjs`
- `functions/test/shift-planning-sync-command.test.cjs`
- `functions/test/shift-planning-public-event-contract.test.cjs`
- `functions/test/shift-planning-public-event-retention.test.cjs`
- `functions/test/shift-planning-firestore-source-producer.test.cjs`

## Live-operation prohibition

This handoff authorizes no shared-project deployment or production mutation. HU-083
must prove new Functions/Rules behavior locally and in emulators. Any bounded develop
repair still requires its own exact audit, dry-run, writer/authority fence, backup,
CAS/read-back plan and explicit apply authorization; otherwise it remains a zero-write
manifest for HU-085. No HU-083 repair credential or principal may be reused by HU-085.
