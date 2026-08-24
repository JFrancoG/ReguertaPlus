# [HU-082] Continuous seasonal shift rotation

## Tracking

- GitHub issue: #266
- URL: https://github.com/JFrancoG/ReguertaPlus/issues/266
- State: IN PROGRESS / local implementation authorized
- Planning branch: `codex/hu-082-shift-operations-planning`
- Implementation branch: `codex/hu-082-continuous-seasonal-shift-rotation`
- Implementation base: `d8fd646`
- Extends: HU-017 / #4 and HU-020 / #19 (both closed)
- Precedes: the continuation deferred from HU-081 / #264
- Downstream: HU-083 / #267 and HU-085 / #269
- Independent policy proposal: HU-084 / #268

## Summary

Replace seasonal reshuffling with one persisted fair queue per shift type.
Delivery covers the weekly calendar through August and completes the active
round across as many following seasonal projections as needed. Market creates
ten target-season groups and materializes its boundary-active round from the same
continuous queue. Android and iOS observe exact requests and refresh Firestore
after activation.

The standard seasonal operation is one atomic bundle with explicit delivery and
market frontier subplans. Their queues remain independent, but both activate or
neither does; one failure can never leave only one calendar updated.

The earlier fixed target of exactly two delivery turns per member and season is
not retained. The invariant is one position per member in every completed
round, with as many rounds as the calendar and cohort require.

## Canonical decisions

- Active common purchase managers from `Compras Regüerta` are selectable;
  real producers are not.
- A seasonal sheet/tab is a date projection and never resets a rotation.
- Bootstrap order/cursor comes only from valid versioned rotation state,
  unambiguous historical owner evidence, or an explicit admin-approved member-ID
  mapping. It never comes from query order or an unseeded shuffle.
- If the last legacy delivery has one unambiguous eligible registered helper, that
  UID must be the first new owner/effective lead. A cursor/helper conflict fails
  closed for mapping; generation never overwrites the historical helper to fit.
- Delivery requires at least two eligible members. The helper is the next
  chronological delivery's effective lead while that predecessor remains
  uncompleted; completion freezes the actual helper/revision. Adjacent effective
  delivery leads must differ. Append, swap, coverage, credit, import, or manual
  assignment validates predecessor/current/successor plus completion revisions
  atomically, never rewrites completed helper history, and never changes ownership.
- Market has 30 target-season positions, then materializes the complete
  boundary-active round into as many future projections as needed and completes
  the final group of three.
- Firestore owns rotation state. Apps read Firestore, not Sheets.
- HU-082 emits the versioned Sheets-sync/operation-marker contract; HU-083 owns
  the real multi-season consumer and candidate trigger implementation.
- Planner shifts use `source = app` with separate `origin = planner` metadata.
- Generation accepts only the first incomplete planning-frontier season or exact
  replay for each typed subplan, merging partial overflow and advancing over
  fully prefilled seasons before accepting the combined bundle.
- HU-082 owns a backend maintenance/write epoch plus expected active-revision
  precondition for every affected app/admin, swap, override, calendar, Sheets-import,
  and command write. Stale/offline writes fail; unsupported direct paths remain
  closed or migrate to versioned commands before HU-085 may reopen them.
- Epoch lifecycle is monotonic: after the external/Rules intake barrier is proved
  closed, maintenance entry atomically advances it; activation
  commits a newer epoch with the new active revision; rollback commits a still newer
  epoch with the restored business revision; pre-activation abort advances it before
  reopening. It is digested and budgeted and is never restored or reused.
- A round cohort freezes on public activation, never on preview/stage; roster
  or any other fairness-input drift forces a new digest.
- Preview writes only private request/status/audit records; digest-bound staging
  stays in a separate admin-only partition, and activation transactionally
  rechecks all input versions, including the credit ledger when enabled.
- The invoker-only rollout boundary covers every governed data mutation: repair,
  migration/bootstrap, preview, stage, activate, sync correction, recovery, and
  cleanup. The epoch-aware runtime alone writes data; operator/deployer/scripts do not.
- Current flat-collection clients require the complete public projection,
  both rotation/cursors, sync commands, metadata, and held intents to fit one
  combined delivery-plus-market transaction; an oversize manifest blocks rollout
  pending a mobile versioned-reader migration.
- Notification release creates one canonical event idempotently per stable key;
  inbox upsert deduplicates by it, while FCM remains at least once and may present
  a duplicate push despite stable event ID/collapse metadata.
- Canonical shift events, inbox rows, and pushes persist only a generic non-sensitive
  copy/reference—never member names, shift date, or effective assignment. Opening
  either push or inbox fetches current detail under authorization/freshness; offline
  or stale cache shows only the generic state.
- Event/inbox claim uses a transaction/CAS over current assignment/member versions;
  every FCM send/retry uses a writer-honored lease over UID/eligibility/token state.
  Event/inbox/push are generic and current detail is authorized on open; later OS presentation
  may race a state change. Sealed/partial bundles retain both rotation leases.
- Only drift found before authenticated submission starts can cancel an intent.
  `unknown` is possibly delivered, is never reclassified as unreleased, and uses
  at-least-once reconciliation/correction semantics.

## Links

- Spec: `spec/shifts/hu-082-continuous-seasonal-shift-rotation/spec.md`
- Plan: `spec/shifts/hu-082-continuous-seasonal-shift-rotation/plan.md`
- Tasks: `spec/shifts/hu-082-continuous-seasonal-shift-rotation/tasks.md`
- ADR: `docs/decisions/0013-model-shifts-as-continuous-rotations-with-seasonal-projections.md`

## Delivery gate

- [x] ADR-0013 reviewed and accepted.
- [x] Bilingual requirements aligned.
- [x] Implementation branch frozen from current `main` at `d8fd646`.
- [ ] Local/emulator gates green with no shared-project Functions/Rules deploy.
- [ ] Functions, Android, and iOS test evidence complete.
- [ ] Local/emulator activation read-back proves generation is visible in both
  apps; no live develop deploy is required.
- [ ] Android/iOS admin inspection can render stage without exposing it to normal
  feeds, and current flat readers pass atomic/oversize activation tests.
- [ ] No production mutation is included.

## Suggested labels

- `type:feature`
- `area:shifts`
- `platform:cross`
- `priority:P1`
