# Tasks - HU-082 (Continuous seasonal shift rotation)

## 0. Approval and traceability

- [x] Review and accept ADR-0013 core rotation/projection decision.
- [x] Review this spec, including the explicit replacement of the fixed
  two-turns-per-season idea with the completed-round invariant.
- [x] Align RF-TURN-03, RF-TURN-04, RF-TURN-07, RF-IA-02, and RF-IA-03 in the
  English and Spanish authoritative requirements.
- [x] Freeze the exact base commit, implementation branch, and current issue
  state before code changes.
- [x] Record the current develop test anomalies without repairing live data.
- [x] Define the non-activating communication-baseline contract for one atomic
  delivery-plus-market package: source-manifest contrast, UID-plan
  `assignmentDigest`, UID/display-name `resolverDigest`, sealing `planningDigest`,
  privacy, global approval/zero-write, render revalidation, supersession, and HU-085.
- [x] Capture one authorized immutable read-only source manifest, contrast each entry
  and digest, and prepare both complete subplans without production `preview` or write.
- [x] Review the exact reviewer-only proposal and reproduce all three digest layers.
  Obtain one global approval for the exact `planningDigest` plus zero-write attestation;
  recontrast, recompute, and seal it before any audience rendering.
- [x] Revalidate the seal at render time and require the renderer's own clock to remain
  in its approval-bound `[sealedAt, validUntil)` window of at most 15 minutes; then
  communicate both subplans as not active. The private package may retain UIDs;
  audience rows contain approved display names but no UIDs, IDs, or phones. Keep
  repository/public evidence opaque and PII-free.
- [ ] Hand HU-085 the applicable sealed source manifest, `assignmentDigest`,
  `resolverDigest`, `planningDigest`, and protected payloads. Require exact contrast/
  alignment or a new globally approved, sealed, revalidated, and recommunicated bundle.
  HU-085 owns authoritative current/superseded state and registry CAS; the offline
  baseline's supersession field records intent only.

Approval checkpoint: maintainer authorization on 2026-08-24; implementation branch
`codex/hu-082-continuous-seasonal-shift-rotation` frozen from `d8fd646`. The
observed `TurnosTest 2025-26` anomalies remain evidence-only for HU-083.

Communication checkpoint: after zero-write preparation, exact review, approval, seal,
and bounded render, the maintainer separately authorized consultation publication on
2026-08-24. Five sanitized workbook tabs now communicate one 27-person package: 54
weekly delivery assignments (52 target plus 2 carryover) and 18 three-person market
events (10 target plus 8 carryover). Live read-back passed, historical tabs and existing
permissions were preserved, and Firestore public shifts remained empty. This was a
workbook communication side effect only; no runtime/app activation or deployment
occurred. Protected technical evidence remains outside the repository.

## 1. Contract and RED fixtures

- [x] Define versioned rotation, round, cohort, cursor, horizon, ownership,
  assignment, migration-baseline lineage, release lease, and provenance wire
  contracts.
- [x] Define bootstrap-source precedence and exact admin mapping artifact with UID
  order, round/cursor, evidence, stable tie order, predecessor/helper constraint,
  provenance, and digest independently per type.
- [x] Define one side-effect-free seasonal activation-bundle contract containing
  delivery and market target/frontier subplans, future projection occupancy,
  common migration baseline, cohort-freeze transitions, combined digest/revision,
  forward/inverse manifests and budgets, both rotation lease intents,
  epoch/lease-bound sync commands, and per-assignment notification intents.
- [x] Define stable request terminal summaries and localized failure codes.
- [ ] Define backend-owned monotonic maintenance/write epoch, active-revision
  preconditions, stable stale-write failures, and the affected-writer inventory.
  - [x] Implement the exact maintenance/rotation codecs and one transactional
    three-document authoritative digest with stable epoch, active-lineage, and
    read-set conflict classification.
  - [x] Inventory and canonically digest every current app/admin, swap, override,
    calendar, Sheets-import/export, trigger, IAM, and workbook writer. Classify
    fairness-input writers separately for activation-version recheck.
  - [ ] Remaining: migrate or deny every affected writer and implement each
    server mutation's same-transaction epoch/revision precondition.
- [ ] Define the no-gap entry barrier (external/Rules deny read-back followed by the
  atomic backend close/epoch bump) plus atomic activation, abort/reopen, and recovery
  transitions. Include epoch/revision in digest, forward/inverse manifests/budgets,
  idempotency keys, and failure injection. Never restore/reuse an epoch.
  - [x] Implement local/emulator-only idempotent entry and pre-activation abort
    CAS. Each transition advances `stateRevision` and `writeEpoch` exactly once,
    preserves active lineage, records immutable replay evidence, and revalidates
    entry ownership plus null release leases on terminal abort replay.
  - [x] Bind bundle schema v2, both manifests, preview receipts, and staged
    candidates to the full authoritative maintenance-plus-rotations read-set.
    Preview may inspect open or closed state; stage requires the same closed
    state and therefore requires a new closed-state preview after maintenance
    entry.
  - [x] Add the SDK-free exact barrier-packet verifier and coordinator that runs
    inside the adapter-provided held-fence callback. Bind the authorized packet
    to command CAS, inventory, Rules, exact control manifest, causal set,
    workbook, dual read-backs, queues, and quiet horizon; retain/read back and
    reverify the full evidence idempotently under `environment + transitionId`,
    enforce an expiry-bound transaction-attempt admission, reject a superseded
    replay, recover an exact terminal replay after expiry through an
    `existing-only` evidence read, and expose no reopen operation. State-operation
    schema v2 records the attempt sample and has no deployed v1 state to migrate.
  - [x] Implement and validate the local/emulator immutable idempotent evidence
    store plus a production-shaped trusted adapter over injected control-plane
    ports. The adapter holds one exact checkpoint around one callback per
    invocation, requires concurrent closure of the same scope to converge,
    performs initial/final read-back, retains an immutable failure closure for
    every post-close failure, and has no reopen capability.
  - [ ] Remaining: bind that adapter to the real Rules, IAM,
    Functions/Eventarc, queue, Drive/Workspace, editor, and workbook controls;
    then implement activation/recovery transitions, crash injection, live
    rollout evidence, and governed reopen.
- [x] Add RED eligibility cases for inactive members, real producers, common
  purchase managers, and catalog flags.
- [x] Add RED bootstrap cases for valid state/history/mapping/new queue, randomized
  query order, ambiguous legacy ownership, helper/cursor conflict, ineligible helper,
  and independent delivery/market mappings.
- [ ] Add RED delivery cases for inherited carryover, October continuation,
  August completion, round overflow, N=2/N<2, effective-lead helpers, append
  recomputation, and HU-016 swap behavior across seasons.
- [x] Add RED market cases for N=3, N=4, N=29, N=30, N=31, and N<3, plus
  property tests across schedulable cohort sizes.
- [x] Add RED market overflow materialization across one and multiple future
  seasonal projections.
- [ ] Add RED replay, invalid planning-frontier season, cohort mismatch,
  preview/stage/activate mismatch, every fairness-input version drift (including
  an enabled credit ledger), staged-visibility, and concurrent-request cases.
- [ ] Add RED bundle cases where either subplan fails, drifts, replays, or exceeds
  budget; neither type may activate or emit side effects on failure.
- [x] Add focused pure bundle cases for exact preview/stage/activate artifact
  binding, staged `candidateDigest`, rejection of stage-time transaction evidence,
  measurement-authority lineage, before-image budgeting, disabled credit-ledger
  enforcement, the 500-write/10-MiB gate, future occupancy, common baseline,
  cohort freeze, immutable preview-bundle/candidate exclusion from activation/recovery,
  exact create/update/delete classification, and release/workbook-partition lease
  conflicts.
- [ ] Add shared mobile fixtures for canonical source and planner provenance.

## 2. Backend model and deterministic planners

- [ ] Extract the planning contract from `functions/src/index.ts`.
- [x] Implement the single canonical eligibility predicate.
- [ ] Implement a Firestore rotation-state repository with optimistic version or
  lease ownership and idempotency keys.
  - [x] Read `shiftPlanningState/current` and both rotation aggregates in one
    transaction and bind them to one deterministic authoritative digest. Missing,
    corrupt, cross-lineage, or competing state fails closed; no bootstrap occurs.
  - [ ] Remaining: governed rotation writes, activation/recovery ownership, and
    release-lease reconciliation.
- [x] Implement fail-closed typed bootstrap precedence. Require the last unambiguous
  eligible registered delivery helper as the first new owner/effective lead; never
  infer owner from swapped assignment or silently rewrite conflicting helper evidence.
- [ ] Implement an IAM-restricted, maintenance-allowlisted rollout execution
  boundary separate from the normal mobile/admin request path. Give the operator
  invoker-only IAM; deny direct data roles and runtime impersonation/token minting.
- [ ] Implement exact digest-bound modes for repair, migration/bootstrap, preview,
  stage, activate, sync correction, recovery, and cleanup. Only the epoch-aware
  runtime writes; reject every alternate operator/deployer/controller/script path.
- [x] Implement the pure delivery planner over explicit Madrid dates, cohort,
  cursor, and inherited carryover.
- [x] Implement the pure market planner for exactly 10 target-season dates plus
  materialized remainder of the boundary-active round in future projections.
- [x] Implement the side-effect-free two-type bundle planner with deterministic
  receipt/candidate digests, exact expected state, frontier transitions,
  forward/inverse recovery manifests, budgets, sync commands, held intents, and
  release-lease intents.
- [ ] Persist `rotationOwnerUserId` separately from effective assignment.
- [ ] Recompute delivery helpers from the next chronological effective lead after
  generation, append, swap, import, manual assignment, credit, or approved coverage,
  including boundaries, but only while the predecessor is uncompleted.
- [ ] Add a versioned planned-versus-actual helper contract. Completion atomically
  freezes helper UID/source assignment revision/time; ordinary later edits preserve
  that history, and only a separate evidenced correction command may amend it.
- [ ] Enforce distinct adjacent effective delivery leads. Under one authoritative
  CAS/transaction, validate predecessor/current/successor assignment, completion,
  and revision for every effective-lead mutation; reject equal lead/helper or stale
  completion without partial mutation or side effects.
- [ ] Remove random roster order and wall-clock target-season inference.

## 3. Publication, requests, notifications, and security

- [ ] Track the first incomplete planning-frontier season; merge partial overflow,
  advance over fully prefilled seasons, allow exact replay, and reject arbitrary
  targets independently per typed subplan before accepting the combined bundle.
- [ ] Fail closed without mutation when live eligibility differs from the frozen
  round cohort.
- [ ] Implement the Firestore request/candidate repository so preview persists its
  exact receipt, stage loads that receipt without future transaction evidence,
  and activate loads the exact staged candidate package—header,
  immutable preview bundle, and positions—and verifies its `candidateDigest`
  plus input snapshot/digest/revision.
  - [x] Private persistence cut: transactional claim/lease/fencing, immutable
    preview bundle/receipt, persisted-preview stage, non-overwriting candidate
    header, terminal replay integrity, and read-only activation preflight are
    covered in the Firestore emulator.
  - [x] Authoritative binding cut: after claim, preview loads the full current
    read-set; stage loads the exact persisted preview and then the current
    read-set. Both reject a resolver result that does not bind that exact state.
  - [x] Candidate-inspection cut: stage atomically creates one immutable child
    per planned public shift, with market's three assignment positions kept
    together. Header counts/set digest, per-child digest, candidate/bundle
    lineage, exact replay, and read-only candidate+bundle+position preflight are
    covered in the Firestore emulator. The immutable preview bundle remains the
    authority; the children are an admin-inspection projection only.
  - [x] Serializer cut: remove synthetic measurements from stage, keep the staged
    candidate outside both write sets/before-images, pin Firestore 8.7.0 behind
    `firestore-grpc-v1-fs8.7.0-r1`, and produce deterministic exact protobuf
    write-set/request digests, transform counts, and bytes from a supplied actual
    batch, require canonical target order, detach the measured `Write` protos, and
    seal later public/payload mutations; guard commit with a detached token copy
    and require remeasurement after reset, without committing or opening transport.
    - [x] Validation: Functions lint/build, 6 serializer vectors, the 150-test
      planning unit suite, and the 13-test isolated candidate-repository emulator
      suite pass with no public write or deployment.
  - [x] Transaction-attempt cut: require completed reads and the empty internal
    batch owned by the exact pinned SDK `Transaction`; populate, measure, seal,
    and commit that same object once per callback attempt. Reset requires a fresh
    measurement, while the commit guard reserializes immediately before transport
    and rejects private operation/token/byte drift. The exact measurement remains
    in memory rather than becoming a self-referential write in its own request.
    - [x] Fix manifest/budget drift so a predecessor before-image is captured only
      when activation really changes its helper; a read-only predecessor guard
      remains part of the CAS without becoming a recovery write.
    - [x] Validation: Node 22 Functions lint/build, 151 planning unit vectors
      including 6 serializer vectors, 4 real-attempt Firestore-emulator vectors,
      13 candidate-repository emulator vectors, and 16 intake-barrier emulator
      vectors pass with no shared/public write or deployment.
  - [x] Freeze the exact public-shift assignment/completion codec, backend mutation
    marker plus activation terminal lifecycle, and persisted before-image envelope
    before claiming a semantic forward/inverse materializer.
    - [x] Publication codec v1 keeps installed-client fields with `source = app`,
      requires exact one/three-person assignment shape, revision/completion
      invariants and UTC-midnight dates, and binds changed backend markers to the
      marker-free payload plus operation/bundle/epoch. Historical unchanged
      markers remain valid provenance on later ordinary edits.
    - [x] Activation terminal v1 binds ordered public mutations and contiguous
      before-images. `firestore-value-v1` round-trips exact supported Firestore
      values with target update-time and contract/payload/envelope digests and
      rejects sentinels, references, lossy/custom structures and hidden extras.
    - [x] Validation: Node 22 Functions lint/build, 6 focused publication-contract
      vectors, and the 157-vector planning unit suite pass without emulator,
      shared/public write, transport, or deployment.
  - [x] Materialize the exact forward mutations, recheck the complete live input
    snapshot, and pass them to the real attempt adapter inside the activation CAS.
    - [x] Require the live activate result to reproduce the immutable staged
      bundle/candidate/position set and reject lineage, read-set, manifest,
      authority, budget, inverse-create, or update-time drift before mutation.
    - [x] Build public creates plus the guarded predecessor-helper update, both
      rotation/lease transitions, active state, terminal request, sync commands,
      held intents, activation tombstone and contiguous before-images; keep
      non-zero credit writes closed until HU-084.
    - [x] Feed the exact ordered mutations to the pinned real-attempt adapter;
      focused vectors and a Firestore-emulator transaction prove the same
      measured SDK batch commits atomically. The local CAS runtime and
      post-return outcome invocation are implemented; concrete fairness-source
      loading and production routing remain pending.
    - [x] Validation: Node 22 Functions lint/build, 4/4 pure focused vectors,
      5/5 focused vectors with Firestore emulator, and 161/161 non-emulator
      planning unit vectors pass; the emulator-only vector is skipped by the
      ordinary unit lane. No shared/public write, transport, or deployment.
  - [x] Materialize inverse mutations from persisted before-images and current
    recovery CAS/epoch, including exact replacement semantics for after-only fields.
    - [x] Revalidate persisted bundle/manifest, activation tombstone, completed
      request, contiguous before-images, unchanged created targets, active
      bundle/write-epoch CAS, and ownership of both sealed release leases.
    - [x] Delete only activation-created documents; restore authoritative state
      and any predecessor from before-images with `lastUpdateTime` preconditions,
      clearing leases while advancing a strictly newer recovery epoch and
      monotonic aggregate revisions.
    - [x] Represent exact replacement as retained top-level values plus explicit
      delete sentinels for after-only fields, and replace the activation terminal
      with a digest-bound recovery terminal while retaining before-images and the
      completed historical request.
    - [x] Feed the exact inverse budget to the pinned real-attempt adapter;
      focused pure vectors and a Firestore-emulator transaction prove atomic
      delete/restore/epoch behavior. The local CAS runtime and post-return
      outcome invocation are implemented; concrete source loading and production
      routing remain pending.
    - [x] Validation: Node 22 Functions lint/build, 3/3 pure focused vectors,
      4/4 focused vectors with Firestore emulator, and 164/164 non-emulator
      planning unit vectors pass; the two emulator-only vectors are skipped by
      the ordinary unit lane. No shared/public write, transport, or deployment.
  - [ ] Persist immutable non-circular backend-only attempt outcome evidence and
    execute the maintenance/publication and recovery CAS paths.
    - [x] Persist a canonical `transactionReturned` outcome only after the
      measured transaction succeeds, keyed by direction and exact commit-request
      digest and bound to intent, bundle, epoch, manifest, and full measurement.
    - [x] Use create-without-overwrite semantics, exact replay convergence,
      operation-terminal validation, and an independent read-back without
      persisting the opaque token or embedding evidence in the measured request.
    - [x] Validation: Node 22 Functions lint/build, 3/3 pure focused vectors,
      4/4 focused Firestore-emulator vectors, and 167/167 non-emulator planning
      vectors pass; the ordinary lane skips three emulator-only vectors. No
      shared/public write, runtime connection, transport, or deployment.
    - [x] Execute forward publication and inverse recovery through a local
      Firestore CAS runtime that invokes its resolver inside every SDK retry and
      records only the successful attempt's post-return outcome.
    - [x] Short-circuit exact terminal/outcome replays without another CAS and
      fail closed when an already committed activation/recovery terminal has no
      retained directional outcome.
    - [x] Validation: Node 22 Functions lint/build, 2/2 pure focused vectors,
      5/5 focused CAS Firestore-emulator vectors, 4/4 outcome-repository
      emulator regressions, and 169/169 non-emulator planning vectors pass; the
      ordinary lane skips six emulator-only vectors. No shared/public write,
      trigger routing, transport, or deployment.
    - [x] Implement the concrete transaction-scoped forward resolver over the
      digest-bound live source, staged package, authoritative state/rotations,
      positions, request, and before-image targets; implement the inverse
      resolver over terminal, bundle, request, before-images, and every current
      delete/restore target.
    - [x] Validation: Node 22 Functions lint/build, 170/170 non-emulator
      planning vectors with seven emulator-only skips, 2/2 source-resolver,
      5/5 CAS-runtime, and 4/4 outcome-repository Firestore-emulator vectors
      pass. The end-to-end resolver vector proves valid membership drift writes
      nothing, then exact activation and higher-epoch recovery. No shared/public
      Firebase write or deployment.
    - [x] Implement the governed producer that refreshes
      `shiftPlanningState/fairness` transactionally from bounded real sources,
      with exact replay, stable digest-derived revisions, credential hashing,
      and fail-closed preservation of the prior valid envelope.
    - [x] Validation: Node 22 Functions lint/build, 2/2 focused producer
      Firestore-emulator vectors, and 170/170 non-emulator planning vectors with
      nine emulator-only skips pass. No shared/public Firebase write, routing,
      transport, or deployment.
    - [x] Rebuild and compare those real sources inside every activation CAS
      retry; require this dependency at the concrete resolver boundary and fail
      with zero public writes when the cached fairness envelope is stale.
    - [x] Validation: Node 22 Functions lint/build, 3/3 governed-source and 2/2
      source-resolver Firestore-emulator vectors pass, including valid activation
      and higher-epoch recovery after the new source gate.
    - [ ] Connect v2 request/recovery routing from `index.ts`; retain the legacy
      production trigger until that replacement passes the governed rollout.
      - [x] Classify every declared request version before legacy parsing;
        preserve the unversioned handler and fail closed for unknown versions.
      - [x] Route schema-v2 preview/stage through the private lifecycle and
        activate directly through the governed CAS so exact terminal replay does
        not require an out-of-transaction preflight.
      - [x] Compose the inverse recovery runtime port and prove preview, stage,
        stale-source zero-write activation, exact activation/replay, and recovery
        against the Firestore emulator without exporting a recovery endpoint.
      - [x] Validation: Node 22 Functions lint/build, 183 planning vectors with
        ten emulator-only skips, 3/3 governed-runtime producer vectors, and 2/2
        source-resolver plus 13/13 persistence-repository emulator vectors pass.
        No shared Firebase write, transport, endpoint export, deployment, or
        live activation occurred.
      - [x] Persist only typed deterministic activation failures rejected inside
        the transaction callback before commit. Use request/operation CAS so a
        concurrent completed activation wins; replay exact failed terminals and
        leave transport, retry-exhaustion, and post-commit/outcome ambiguity
        retryable without overwriting either terminal.
      - [x] Validation: Node 22 Functions lint/build, 184/184 planning vectors
        with eleven emulator-only skips, 6/6 focused CAS-runtime and 3/3
        governed-runtime Firestore-emulator vectors pass. The tests distinguish
        typed pre-commit rejection from ambiguous errors, prove failed replay,
        require a new request for retry, and prove a late failure cannot replace
        a completed activation. No shared Firebase write, endpoint, deployment,
        or live activation occurred.
      - [ ] Export recovery only through the IAM-restricted operator boundary
        after it enforces the maintenance allowlist for exact operation,
        revision, digest, and state.
        - [x] Implement the SDK-backed local operator executor and strict command/
          authorization codecs. Store one digest-bound authorization below the
          activation operation and re-read it before execution and inside every
          CAS retry; bind both IDs, bundle revision/digest, activation intent,
          bounded time window, and exact closed maintenance state.
        - [x] Prove malformed/extra/tampered/expired commands and maintenance-
          epoch drift write nothing; prove exact recovery and outcome replay
          converge through the allowlisted executor in the Firestore emulator.
        - [x] Validation: Node 22 Functions lint/build, 186/186 planning vectors
          with eleven emulator-only skips, 2/2 focused authorization vectors,
          and 3/3 governed activation/allowlisted-recovery emulator vectors pass.
          No shared Firebase write, HTTP export, deployment, or live recovery.
        - [x] Pin the future dedicated operator identity to
          `reguerta-shifts-operator@reguerta-9f27f.iam.gserviceaccount.com` and
          export the local recovery Function with that exact `invoker`. Reject
          non-POST, query-bearing, malformed, or extra-field commands before the
          executor; correlate sanitized accepted/completed/rejected/unknown audit
          events without logging bodies, authorization digests, member data, or
          internal diagnostics. Do not select a runtime service account here.
        - [ ] Remaining for the controlled HU-085 rollout: provision the named
          operator principal, grant only exact endpoint invocation, deploy/read
          back the binding, and prove IAM allow/deny plus absence of direct data,
          workbook, impersonation, and token-minting authority.
      - [x] Validation: Node 22 Functions lint/build, 193 planning vectors with
        eleven emulator-only skips, 7/7 focused HTTP boundary vectors, and 3/3
        governed activation/allowlisted-recovery Firestore-emulator vectors
        pass. No shared Firebase write, IAM mutation, deployment, or live
        recovery occurred.
      - [x] Serialize every legacy importer/planner Firestore shift upsert and
        stale imported-shift deletion with the exact notification-resource fence.
        Re-read stale-delete ownership inside the transaction and preserve the
        stable HTTP conflict when dispatch owns the shift. This is deliberately
        only a Firestore mutation guard: the multi-shift import remains partially
        applicable and the legacy planner still writes its workbook first, so
        their intake shutdown/drain and HU-083 replacement remain mandatory.
      - [x] Validation: Node 22 Functions lint/build and 7/7 focused
        notification-writer Firestore-emulator vectors pass, including active-
        fence zero-mutation and snapshot-based guarded write. No workbook,
        shared Firebase, endpoint, deployment, or live writer changed.
- [ ] Include membership, rotation, policy/config/calendar override, and enabled
  credit-ledger versions plus any migration-baseline revision/digest in the
  candidate lineage; transactionally recheck them and commit planned credit
  transitions only during exact activation.
- [ ] Keep staged rotation/shifts admin-readable but outside normal member queries,
  Sheets export, active cursor/cohort state, and notification consumers.
  - [x] Backend/Rules cut: only active linked admins can get/list the candidate
    header and exact `positions` subcollection; all client writes and every other
    nested candidate path remain denied. Stage and preflight write no public
    shift, active cursor/cohort, Sheets command, or notification intent.
  - [ ] Remaining: expose and verify equivalent admin-only inspection in Android
    and iOS without adding candidate rows to normal member feeds.
- [ ] Inventory current flat `shifts` readers and implement one measured atomic
  public promotion transaction for the combined delivery/market projection, both
  rotation/cursors, active bundle metadata, digest-bound sync commands, and held
  intents. Measure forward and inverse serialized requests with the real adapter;
  fail closed above the conservative 500-write/10-MiB gate.
- [x] Persist sync commands as claimable pending state and define explicit post-
  commit pull/invocation plus discovery/retry; never depend on an Eventarc creation
  delivery that occurred while its consumer was disabled. CAS workbook/revision,
  partition state revision, expected/command partition epoch, and claim lease
  immediately before every external batch.
  - [x] Version and strictly parse pending/processing/completed commands; bind the
    immutable intent with `commandDigest`, retain exact read-back terminal evidence,
    and reject extra, malformed, cross-lineage, or expired completion data.
  - [x] Add the Firestore polling repository and SDK-free executor. Discovery is
    read-only and bounded; claim/takeover increments the partition fencing epoch;
    pre-batch authorization and completion transactionally recheck active lineage,
    workbook revision, partition state/epoch, and exact lease ownership.
  - [x] Prove an unexpired competitor is busy, an expired worker is fenced, active
    or partition drift writes nothing, terminal replay performs no external call,
    and a lost completion is rediscovered and converges through an idempotent fake
    consumer. The real multi-season Sheets adapter/read-back remains HU-083 scope.
  - [x] Validation: Node 22 Functions lint/build, 196 planning vectors with eleven
    emulator-only skips, 3/3 focused lifecycle vectors, 5/5 sync-repository and 3/3
    governed activation/recovery Firestore-emulator vectors pass. No shared
    Firebase/Sheets write, trigger export, deployment, or live sync occurred.
- [x] Define operation-registry/marker and fake-consumer vectors requiring
  candidate `onShiftWritten` to validate before/after changes for creates/updates
  and exact before-image marker/version/path for recovery deletes, no-op only that
  operation, and leave later ordinary events active. HU-083 owns the real trigger.
  - [x] Parse exact activation/recovery registry terminals and freeze the minimal
    `controlledPublicMutation` terminal for repair/sync-correction create/update
    bindings. Changed markers without exact authority fail closed.
  - [x] Classify retained historical markers as ordinary, bind every controlled
    no-op to a stable `eventDigest`, and prove create/update/delete, replay,
    repair, sync-correction, recovery, missing-registry, and tampering cases with
    an SDK-free fake consumer. No `index.ts` trigger is changed.
  - [x] Validation: Node 22 Functions lint/build, 5/5 focused fake-consumer
    vectors and 201 planning vectors with eleven emulator-only skips pass. No
    shared Firebase/Sheets write, trigger export, deployment, or live event.
- [x] Define retention/fail-closed requirements for terminal operation tombstones
  and per-event ledgers; prove the producer contract with fixtures and hand real
  consumer implementation/integration evidence to HU-083.
  - [x] Freeze a digest-bound policy for the maximum end-to-end delivery/retry
    horizon plus positive safety margin, one immutable operation-retention
    binding, and deterministic backend-only operation/event ledger paths.
  - [x] Produce stable controlled-no-op and rejected-event ledger terminals.
    Unknown/expired/missing authority requires an alert and blocks legacy side
    effects; cleanup protects the operation terminal, retention binding, and
    ledgers through the exact exclusive-expiry boundary.
  - [x] Prove exact replay, tamper rejection, delayed boundary delivery,
    retained-marker ordinary routing, unknown-marker alert intent, and cleanup
    eligibility with five SDK-free fixtures. HU-083 owns Firestore persistence,
    `onShiftWritten` wiring, real alert/export/notification evidence, and policy
    activation.
  - [x] Validation: Node 22 Functions lint/build, 5/5 focused retention vectors,
    and 206 planning vectors with eleven emulator-only skips pass. No shared
    Firebase/Sheets write, trigger export, deployment, or live event occurred.
- [x] Make `requested -> processing -> completed|failed` idempotent and safe
  under retry or competing triggers.
  - [x] Implement and test that lifecycle for private `preview` and `stage`,
    including busy/resume, expired takeover, fencing, exact terminal summaries,
    and replay without artifact overwrite.
  - [x] Add the SDK-free local request orchestrator: claim before planning,
    short-circuit busy/replay, load persisted preview for stage, terminalize only
    typed deterministic failures, load the authoritative state for preview/stage,
    and keep activate read-only over the exact candidate/bundle/position package.
  - [x] Extend the lifecycle to the v2 activation runtime. Activation claims only
    the request while the operation path remains absent for the atomic CAS;
    busy/resume, expired takeover, fencing, deterministic pre-commit failure,
    completed replay, and stale/expired claim rejection are covered locally and
    in Firestore emulators. Recovery does not open a second request lifecycle:
    it reuses the immutable activation terminal plus independently retained
    directional outcomes, while the previously frozen operation/event retention
    policy remains the HU-083 persistence handoff.
  - [x] Validation: Node 22 Functions lint/build, 5/5 focused forward-materializer
    vectors, 14/14 repository-emulator vectors, 2/2 source-resolver activation/
    recovery vectors, and 3/3 governed source/runtime vectors pass. No deploy,
    live Firestore write, trigger export, Sheets call, or notification occurred.
- [x] Write client-compatible `source = app` plus planner provenance.
  - [x] The activation materializer preserves the installed-client contract with
    canonical `source = app` and adds backend-owned `origin = planner`, stable
    planning-chain, bundle, write-epoch, projection, rotation, and mutation metadata.
  - [x] Functions contract tests bind the exact public provenance. Android and iOS
    decoding regressions accept every additive planner field without widening their
    Domain models and still reject `source = planner` as invalid public data.
  - [x] Validation: Node 22 Functions lint/build and 196/196 executed shift-planning
    unit vectors pass (11 intentionally skipped); Android unit tests and `lintDebug`
    pass; Xcode MCP focused planner-provenance test passes 1/1; iOS `fast-unit-v1`
    passes on iPhone 17 / iOS 26.5. No deploy or live Firestore write occurred.
- [x] Publish rotation state, shifts, and request summary without partial cursor
  advancement; hold notifications until governed release.
  - [x] One measured Firestore transaction contains the complete flat shift
    projection, both rotation/cursor and release-lease transitions, active state,
    exact completed request summary, two Sheets commands, held intents,
    before-images, and the immutable activation tombstone.
  - [x] Held intents are created only in the backend-owned
    `shiftPlanningNotificationIntents` outbox with `state = held`; activation never
    creates a consumable `notificationEvents` document.
  - [x] Validation: Node 22 Functions lint/build, 196/196 executed unit vectors
    (12 emulator-only skips), and 7/7 focused Firestore-emulator vectors pass. The
    emulator proves both the complete commit and that a conflicting create leaves
    both cursors, active state, request lifecycle, and every other create
    unchanged. No deploy, live Firestore write, Sheets call, or notification
    occurred.
- [ ] Release held notifications idempotently after the authorized read-back gate;
  prove replay cannot duplicate the canonical event/inbox effect while FCM remains
  explicitly at least once and may retry/present a duplicate.
  - [x] Add the local, non-exported Firestore release repository. One transaction
    verifies both completed Sheets read-backs, current active bundle, assignment,
    active eligibility, and shared membership/eligibility/destination revisions,
    then creates one stable legacy-compatible generic event, inbox row, and
    backend-only receipt. Exact replay is write-free and stale input creates none.
  - [x] Reserve receipt-bound canonical shift events for the governed dispatcher
    before the legacy trigger performs inbox fan-out or generic FCM delivery.
    Receipt absence preserves unrelated legacy events; present malformed or
    drifting evidence fails closed instead of falling back to legacy delivery.
    - [x] Validation: Node 22 Functions lint/build, 217/217 executed planning
      vectors with 30 emulator-only skips, 4/4 focused delivery-authority
      vectors, and 2/2 modular Admin SDK vectors pass. No trigger export, deploy,
      live Firestore write, FCM submission, inbox fan-out, or notification
      occurred.
  - [x] Compose idempotent release and one governed dispatch attempt behind a
    local, non-exported executor. Validate environment, intent, worker, and
    attempt identifiers before release; exact release replay proceeds to dispatch,
    while release failure or event drift invokes no dispatch dependency.
    - [x] Validation: Node 22 Functions lint/build, 222/222 executed planning
      vectors with 30 emulator-only skips, and 5/5 focused release-dispatch
      vectors pass. No trigger export, Firebase Messaging binding, deploy, live
      Firestore write, FCM submission, inbox fan-out, or notification occurred.
  - [x] Bind the composed executor to the real Firestore repositories and modular
    Firebase Messaging transport, then place it behind a strict CORS-disabled HTTP
    factory whose sole invoker is the existing dedicated shifts operator. Parse one
    exact versioned command and expose only sanitized attempt lineage/outcome.
    Keep the factories absent from `index.ts`; select no runtime service account.
    Treat any error escaping an accepted execution as unknown rather than assuming
    it occurred before authenticated submission.
    - [x] Validation: Node 22 Functions lint/build, 230/230 executed planning
      vectors with 30 emulator-only skips, 8/8 focused HTTP/runtime vectors, and
      2/2 modular Admin SDK vectors pass. No Function export, runtime identity
      selection, deploy, live Firestore write, FCM submission, or notification
      occurred.
  - [ ] HU-085 provisions and reads back invoker/runtime IAM, exports the Function,
    deploys it during the governed change window, and performs the first live call.
  - [x] Validation: Node 22 Functions lint/build, 198/198 executed planning unit
    vectors (16 emulator-only skips), 6/6 focused release emulator vectors, and
    3/3 source-producer plus 26/26 strict Firestore Rules emulator vectors pass.
    No export, deploy, live Firestore write, FCM submission, or notification
    occurred.
- [ ] Retain bundle release leases on both affected types and reject any later
  stage/activate touching either while sealed/partial/non-terminal; clear both
  only on reconciliation, valid rollback, or an explicit terminal incident that
  accounts for demonstrably unsubmitted and `unknown`/accepted/delivered events.
  - [x] Add the SDK-free terminal batch-reconciliation plan. It requires exact
    paired lease ownership/lineage, the complete contiguous held-intent set, and
    only terminal append-only attempt histories before emitting one digest-bound
    pair of clear actions. It retains accepted/unknown as possible-delivery
    history and distinguishes a definitive authenticated failure from an intent
    demonstrated never to have crossed authenticated submission.
    - [x] Validation: Node 22 Functions lint/build, 235/235 executed planning
      vectors with 30 emulator-only skips, 5/5 focused reconciliation vectors,
      and 2/2 modular Admin SDK vectors pass. No reconciliation persistence,
      lease clear, deploy, live Firestore write, FCM submission, or notification
      occurred.
  - [x] Persist the reconciliation with one Firestore CAS over both rotations,
    the exact intents/attempt histories, active lineage, and immutable replay
    record; prove any drift or partial evidence writes nothing.
    - [x] The local repository treats the persisted active bundle as canonical,
      compares its complete intent list with the live collection, verifies every
      dispatch counter and named append-only attempt, reconstructs the pure plan,
      advances maintenance `stateRevision`/`writeEpoch` and both rotation
      revisions, clears both leases, and creates one digest-bound replay record
      in the same transaction. It remains absent from `index.ts`.
    - [x] Validation: Node 22 Functions lint/build, 235/235 executed planning
      vectors with 30 emulator-only skips, 1/1 local repository command vector,
      5/5 focused Firestore-emulator vectors, and 2/2 modular Admin SDK vectors
      pass. No shared-project write, Function export, deploy, FCM submission, or
      notification occurred.
  - [x] Add the explicit terminal-incident path and safe-resume degraded-mode
    authority before allowing abandoned non-terminal batches to clear.
    - [x] Add the pure safe-resume and terminal-incident contract. Entry requires
      an expired paired batch with exact inactive dispatch evidence, transfers
      both leases to one owner for at most 24 hours, and derives the affected-
      shift fence. Expiry cancels exactly intents proven never submitted while
      retaining submitting/unknown/accepted evidence for correction.
    - [x] Prove zero counters, claimed-before-submission, prior `unknown` plus a
      claimed retry, active-dispatch rejection, TTL expiry, exact cancellation,
      deterministic order, and dual-lease clear actions locally.
      - [x] Validation: Node 22 Functions lint/build, 243/243 executed planning
        vectors with 30 emulator-only skips, 8/8 focused incident vectors, and
        2/2 modular Admin SDK vectors pass. The contract remains absent from
        `index.ts`; no persistence, export, deploy, FCM submission, notification,
        or shared-project write occurred.
    - [x] Persist degraded entry, affected-shift fences, terminal evidence,
      cancellations, replay, and the final atomic dual-lease clear.
      - [x] Define the deterministic incident-shift fence bound to incident,
        bundle lineage, owner, safe-resume digest, and bounded TTL. Backend
        transactional writers and strict Rules now inspect it alongside dispatch
        fences; Phase 1 keeps the partition private. Active exact evidence blocks
        only the affected shift, expiry reopens it, and malformed evidence fails
        closed.
        - [x] Validation: Node 22 Functions lint/build, 246/246 executed planning
          vectors with 31 emulator-only skips, 3/3 pure fence vectors, 8/8
          backend writer-fence emulator vectors, 28/28 strict Rules vectors,
          5/5 Phase 1 compatibility vectors, and 2/2 modular Admin SDK vectors
          pass. No export, deploy, shared-project write, FCM submission, or
          notification occurred.
      - [x] Persist degraded entry through one Firestore CAS that re-reads the
        active bundle, canonical intents, inactive dispatch counters, and named
        attempts; advances the maintenance epoch and both rotation revisions;
        retains the activation epoch on both incident-owned degraded leases;
        creates every exact affected-shift fence; and records immutable replay.
        Existing partial fences or any lineage/evidence drift write nothing.
        - [x] Validation: Node 22 Functions lint/build, 247/247 executed planning
          vectors with 34 emulator-only skips, 4/4 focused Firestore-emulator
          vectors, exact replay/zero-write drift assertions, and 2/2 modular
          Admin SDK vectors pass. The repository remains absent from `index.ts`;
          no export, deployment, shared-project write, FCM submission, or
          notification occurred.
      - [x] Persist terminal evidence, exact cancellations, one terminal marker
        per intent, atomic incident-fence deletion, immutable replay, and the
        final dual-lease clear. Release and dispatch reject terminal markers;
        missing/drifting fences, partial markers, evidence drift, or incomplete
        cancellation write nothing. Entry bounds the combined intent/fence set
        so terminalization always fits one Firestore CAS.
        - [x] Validation: Node 22 Functions lint/build, 250/250 executed planning
          vectors with 39 emulator-only skips, 2/2 terminal-marker vectors, 8/8
          pure terminal-incident vectors, 6/6 terminal repository vectors, 6/6
          release and 10/10 dispatch regressions, 28/28 strict Rules vectors,
          5/5 Phase 1 vectors, and 2/2 modular Admin SDK vectors pass. The
          repository remains absent from `index.ts`; no export, deployment,
          shared-project write, FCM submission, or notification occurred.
- [x] Define safe resume as degraded mode with affected-shift mutation fence,
  owner, TTL, escalation, and terminal cancellation/supersession of demonstrably
  unsubmitted intents at expiry; keep `unknown`/accepted/delivered history immutable
  and route possible delivery through reconciliation/correction.
  - [x] Freeze the pure authority and its 24-hour maximum TTL without exporting
    runtime or performing Firebase writes.
- [ ] Persist one held intent per assignment position and bind it to recipient UID,
  shift identity, and assignment/membership/eligibility/destination revisions;
  transactionally/CAS read them while claiming and creating event/inbox, and
  write nothing when stale.
- [ ] Before every FCM send/retry, freshly revalidate assignment, UID, active
  eligibility, and token ownership/version while holding a short dispatch lease
  respected by every writer of those values; cancel/supersede drift only before
  authenticated submission starts, without silent retargeting or reuse of an
  earlier validation.
  - [x] The local, non-exported dispatch repository claims a fixed 30-second
    monotonic lease and revalidates the complete current assignment/member/device
    source again immediately before authenticated submission authorization. Raw
    targets are transient; only their digest and count enter retained evidence.
  - [x] Publish deterministic backend-only member/shift resource fences in the
    same claim transaction. Distinct intents serialize on both resources;
    definitive completion releases only exact ownership, while `unknown` retains
    the fence through lease expiry. Local strict Rules make direct shift/device
    writers fail closed while active; Phase 1 keeps the collection private.
  - [x] Validation: Node 22 Functions lint/build, 212/212 executed planning
    vectors with 24 emulator-only skips, 3/3 focused fence vectors, 10/10
    dispatch-repository emulator vectors, 27/27 strict Rules vectors, and 5/5
    Phase 1 compatibility vectors pass locally. No Firebase, Rules, Functions,
    FCM, or production data deployment occurred.
  - [ ] Make every assignment/member/device writer honor or atomically supersede
    that lease. Migrate each Admin SDK/server writer to the same transaction guard,
    define retry behavior for blocked mobile device registration, then connect
    the real FCM transport.
    - [x] Add one shared Admin SDK transaction guard and bind the authenticated
      admin member upsert plus reciprocal shift-swap application to the exact
      member/changed-shift fences. Active leases return stable HTTP conflict;
      malformed state fails closed; a real emulator race proves the writer and
      dispatch claim serialize on the same deterministic document.
      - [x] Validation: Node 22 Functions lint/build, 213/213 executed planning
        vectors with 28 emulator-only skips, 5/5 focused writer-fence emulator
        vectors, and 28/28 backend-security/member-directory/shift-swap vectors
        pass locally. No Firebase, Functions, FCM, or production data deployment
        occurred.
    - [x] Bind the measured v2 forward-activation/inverse-recovery transaction
      attempt to every exact public-shift fence derived from its canonical
      mutation set. Read all fences before populating/sealing the SDK-owned batch;
      reject the complete attempt for active or malformed state.
      - [x] Validation: Node 22 Functions lint/build, 213/213 executed planning
        vectors with 28 emulator-only skips, 7/7 real transaction-attempt vectors,
        and 17/17 forward/inverse/CAS emulator vectors pass. Coverage includes
        active atomic rejection, exact expiry, malformed fail-closed state, retry
        remeasurement, and commit transport binding. No Firebase, Functions, FCM,
        or production deployment occurred.
    - [x] Serialize every legacy Sheets importer/planner shift mutation with its
      exact notification-resource fence; preserve the separately documented
      external-workbook and multi-shift atomicity limitations.
    - [x] Classify a Rules-denied Android/iOS device-registration commit as
      deferred, retain the current authorized context/credential, and retry only
      on the next authorized session/token event with all existing session, UID,
      and credential fences. Never mark the deferred write uploaded or delay login
      with a timer loop; other Firestore failures remain ordinary failures.
      - [x] Validation: Android `app:testDebugUnitTest` and `app:lintDebug`, iOS
        SwiftLint (0 violations in 461 files), 2/2 focused Xcode MCP tests, an
        Xcode MCP build with zero warnings, and 27/27 Firestore role-access Rules
        emulator vectors pass. The canonical iOS `fast-unit` lane compiled and
        started but was interrupted after 1043.677 seconds because Xcode remained
        blocked waiting for test workers and log finalization; no assertion or
        compile failure was observed. No Firebase, Functions, FCM, or production
        data deployment occurred.
    - [x] Transfer receipt-bound canonical-event ownership away from the legacy
      inbox/FCM trigger while preserving events without a release receipt.
    - [x] Compose release with the governed dispatch executor without exporting a
      trigger or binding the production Messaging instance.
    - [x] Bind the composed executor to real Firestore/modular Messaging behind an
      invoker-only HTTP factory without exporting it from the Firebase runtime.
    - [ ] Remaining rollout gate: HU-085 provisions/read-backs IAM and runtime
      identity, exports/deploys the Function, and authorizes the first live call.
- [x] Persist an append-only attempt ledger per canonical event with `attemptId`,
  lease owner/epoch/deadline, validation digest, authenticated start, and terminal
  `accepted|unknown|failed`; derive aggregate state without replacing evidence.
- [x] Use bounded timeout, keep ambiguous expiry as immutable possibly delivered
  `unknown`, and append a new revalidated attempt for any at-least-once retry.
  - [x] Firestore expiry/takeover converts an unsubmitted claim to terminal
    `failed`, converts a started attempt to immutable `unknown`, rejects late
    reclassification, and appends the retry under a higher epoch.
  - [x] Validation: Node 22 Functions lint/build, 200/200 executed planning unit
    vectors (21 emulator-only skips), 7/7 focused dispatch, 6/6 release, and
    26/26 strict Firestore Rules emulator vectors pass. No export, deploy, live
    Firestore write, FCM submission, or notification occurred.
  - [x] Add the local, non-exported 10-second transport executor and classify its
    accepted, definitive failure, timeout, thrown-error, malformed-response, and
    exhausted-lease paths through the append-only repository. The injected
    Firebase adapter separates token/FID batches, sends only generic copy/data,
    and never retains raw acknowledgements or errors.
  - [x] Validation: Node 22 Functions lint/build, 209/209 executed planning unit
    vectors (23 emulator-only skips), 9/9 focused executor, 9/9 dispatch emulator,
    6/6 release emulator, and 2/2 modular Admin SDK vectors pass. No export,
    deploy, live Firestore write, FCM submission, or notification occurred.
- [x] Persist generic non-sensitive canonical event/inbox copies and send a generic
  event-reference push, with no member name, shift date, or effective assignment.
  Fetch authorized current-revision detail on every push/inbox open; document the
  irreducible later OS-display race.
  - [x] Version the backend-only generic event/inbox discriminator and preserve it
    through the immutable per-user copy without adding shift/member/date detail.
  - [x] Android and iOS inbox rows fetch and render current detail only through the
    authenticated `resolveShiftNotificationDetail` boundary. The transaction
    revalidates the current auth link, active member, immutable event/release
    lineage, and current public assignment before returning exact schema v1.
  - [x] Android and iOS accept only the canonical `eventId`, `shift_updated`, and
    `users` reference when the OS opens a push. Each client keeps at most one
    in-memory pending reference, waits for an authorized Home route, refreshes the
    inbox, and reuses `resolveShiftNotificationDetail`; no rich push field or
    durable detail cache participates.
- [ ] Version backend/mobile event and inbox schemas/decoders so legacy required
  `title`/`body` fields receive only generic copy for these events. Add Rules,
  repository, offline-cache, logout/demotion/environment/assignment-drift tests;
  purge ephemeral detail and show generic state when fresh fetch is unavailable.
  - [x] Android and iOS accept the exact schema-v1 planning discriminator, map it
    to an authorized-fetch Domain policy, reject partial/rich/spoofed forms, and
    preserve unversioned event behavior. Strict Rules reserve its fields for the
    backend runtime.
  - [x] Inbox-open detail is ephemeral on both clients, cleared on feed refresh,
    route exit, logout, authorization/environment drift, and rejected when the
    current member is no longer assigned. Offline, denied, missing, malformed, or
    stale responses preserve only the generic row; cross-session late completions
    cannot publish.
  - [x] OS push-open routing exercises the same refresh, authorization, current-
    assignment, session/environment, and ephemeral-detail policy as inbox opening.
  - [ ] Remaining: complete the old/current/candidate rollout matrix under HU-085.
- [x] Store held notification intents outside every currently watched consumer
  path; create canonical events only during explicit idempotent release.
  - [x] The backend-only `shiftPlanningNotificationIntents` outbox is denied to
    clients by strict Rules; only the explicit release repository creates the
    canonical event and inbox copy under the stable intent/event identifier.
- [ ] Test old/current/candidate consumer and rollback combinations against the
  held outbox.
  - [ ] Remaining: execute the installed/candidate consumer and rollback matrix
    under the controlled HU-085 rollout.
- [x] Preserve existing reciprocal swap behavior for newly generated shifts.
  - [x] Cross-contract tests prove generated delivery and market documents remain
    eligible for reciprocal swaps, retain immutable planner/rotation ownership,
    recompute delivery helpers from the next effective lead, and keep market groups
    complete and distinct.
- [x] Update strict Firestore Rules and bilingual collection documentation for the
  exact local v2 request, admin-readable/backend-written candidate, and eight
  backend-only control-plane partitions; do not deploy either Rules candidate.
- [x] Implement persisted before-image capture and recovery CAS from the pure
  inverse manifest: exact target/create paths, before-image contract digests,
  current active bundle revision/digest/write epoch, and a strictly higher epoch
  that is never reused or decremented.
  - [x] Forward activation writes contiguous digest-bound before-image envelopes
    in the same measured transaction; inverse recovery re-reads their exact paths,
    validates the active bundle and epoch, restores/deletes only manifest-owned
    targets, and advances to `activationWriteEpoch + 1`.
  - [x] Current validation: 7/7 forward and 4/4 inverse materializer vectors pass
    against isolated Firestore demo-project emulators, including atomic conflicts,
    exact replacement, before-image drift, and the strictly newer recovery epoch.
- [ ] Require current epoch/revision in Rules/server CAS for every affected app/admin,
  swap, override, calendar, Sheets-import, and command mutation; migrate unsupported
  direct paths to versioned callables/commands and reject offline legacy queues.
  - [x] Shift-swap create captures the exact open `stateRevision`, `writeEpoch`,
    and active revision/digest when v2 planning state exists. Respond/apply re-read
    and compare that authority in their transaction; maintenance or lineage drift
    fails before request, shift, helper, or notification mutation. Missing state
    remains compatible only while both captured and current state are absent.
  - [x] Validation: Functions lint/build, 30/30 backend-security/shift-swap
    vectors, and the 255 executed planning-unit vectors pass; 39 emulator-only
    vectors remain intentionally skipped in the ordinary unit lane.
  - [x] The Sheets importer captures one exact open planning authority only after
    its read-only workbook phase. Every shift upsert and stale imported-shift
    deletion revalidates that authority inside the same notification-guarded
    transaction before mutation; drift stops all remaining writes. The operation
    remains intentionally non-atomic across rows until HU-083 replaces it.
  - [x] Validation: Functions lint/build, 30/30 backend-security/shift-swap
    vectors, 255/255 executed planning-unit vectors with 40 emulator-only skips,
    and 9/9 focused notification-writer Firestore-emulator vectors pass locally.
  - [ ] Remaining: migrate/deny direct client writes and fence calendar, planner,
    trigger, admin, and other inventoried mutation paths.
- [ ] Prove crash/retry at every epoch transition either commits the full authorized
  state pair once or leaves writes closed, with no stale active-revision reopening.
- [ ] Prove clients cannot forge planner state, ownership, or terminal success.
- [ ] Prove mobile/admin credentials cannot call the rollout-only boundary or
  forge/change mutation provenance, and prove the operator cannot write Firestore/
  Sheets directly or impersonate/mint tokens for the runtime.
- [ ] Add structured operational logging without member-sensitive payloads.

## 4. Android read-back

- [x] Extend the request entity/repository with exact two-subplan bundle
  observation and per-type terminal summary/failure decoding.
- [ ] Update every affected Android writer to carry epoch/revision or use the
  versioned command path; test stale offline queue rejection and reauthentication.
- [ ] Add candidate revision/digest Domain models and an admin-authorized
  repository query; prove normal-member reads fail in Rules/repository tests.
- [x] Decode terminal summary and stable error codes without exposing raw backend
  messages.
- [x] Retain/cancel the operation under session, environment, user, and admin
  authorization ownership.
- [x] Show requested/processing/failed/completed states in the admin flow.
- [x] Fetch/render the exact staged revision for authorized admins without
  leaking candidate shifts into normal member feeds.
- [x] Refresh the server shifts feed once after activation completion and only
  then show success.
- [ ] Verify board and upcoming-shift projections across seasons.
- [ ] Add unit, failure, decoding, operation-safety, and UI tests.

## 5. iOS read-back

- [x] Extend Domain/Data request contracts with exact two-subplan bundle
  observation and per-type terminal summary/failure decoding.
- [ ] Update every affected iOS writer to carry epoch/revision or use the versioned
  command path; test stale offline queue rejection and reauthentication.
- [ ] Add equivalent candidate revision/digest Domain models and admin-only
  repository query; prove normal-member reads fail in Rules/repository tests.
- [x] Decode terminal summary and stable error codes without exposing raw backend
  messages.
- [x] Own and fence the operation in the current Shifts/Settings presentation
  boundary without broad HU-081 cleanup.
- [x] Show requested/processing/failed/completed states with localized copy.
- [x] Fetch/render the exact staged revision for authorized admins without
  leaking candidate shifts into normal member feeds.
- [x] Refresh the server shifts feed once after activation completion and only
  then show success.
- [ ] Verify board and upcoming-shift projections across seasons.
- [ ] Add Swift Testing cohorts, previews, accessibility identifiers, and UI
  smoke coverage where UI changes.

## 6. Automated validation

- [x] Run Functions `npm run lint`.
- [x] Run Functions `npm run build`.
- [x] Run the communication-baseline focused and full planner unit suites.
- [ ] Run remaining focused contract, concurrency, backend security, and Rules
  suites.
- [x] Run Android `app:testDebugUnitTest` and `app:lintDebug`.
- [x] Run Android connected UI tests when an emulator/device is available.
- [x] Run iOS focused tests and `fast-unit`.
- [x] Run iOS `ui-smoke` because Settings and Shifts feedback changes.
- [x] Run the canonical iOS `release-gate` and verify SwiftLint.
- [ ] Run `git diff --check` and reconcile all acceptance criteria with evidence.

## 7. Local/emulator acceptance

- [ ] Generate delivery with a prior-season tail and prove the next fair owner is
  appended as the preceding shift's effective-lead helper; prove later swaps update
  uncompleted helpers without changing ownership or completed helper history.
- [ ] Verify N=2 and cross-season append/swap/import/manual/coverage matrices never
  produce adjacent equal delivery leads, and completion-versus-edit races freeze
  actual history or retry the edit without rewriting it.
- [ ] Prove delivery fills August and finishes the active round across one or
  multiple future projections, including a cohort larger than one full season.
- [ ] Generate market N=4, N=29, N=30, and N=31 scenarios and verify
  distinctness, final-group fill, and carryover.
- [ ] Prove each market boundary-active round is materialized into the required
  future projections without recursively publishing later rounds.
- [ ] Read back request, rotation state, shifts, and notifications.
- [ ] Verify Android and iOS update after terminal completion without restart.
- [ ] Prove replay produces no duplicate or cursor drift.
- [ ] Prove preview has only private request/operation/bundle writes, stage
  remains non-public, activation is atomic, canonical notification-event release is
  idempotent, inbox upsert deduplicates, and FCM carries a stable event ID while
  retaining explicit possible-duplicate semantics.
  - [x] Emulator cut: preview writes only private request/operation/bundle state,
    stage atomically writes only its private candidate header/positions plus
    terminal lifecycle, and activate preflight verifies candidate, immutable
    bundle, and positions without performing any write.
- [ ] Prove canonical event/inbox/push artifacts contain only generic shift references,
  supported clients decode them, and stale/offline caches cannot expose member/date/
  assignment detail after authorization or revision changes.
- [ ] Prove assignment/member drift between read and event claim fails CAS, and
  UID/eligibility/token writers serialize with every initial/retried FCM dispatch
  lease; prove drift before authenticated submission starts fails closed and drift
  after submission cannot retract `unknown`/accepted state; presentation remains
  generic, at least once, and potentially delayed/duplicated.
- [ ] Prove crash/timeout/lost-ack/late-completion dispatch cases never hold the
  lease indefinitely and preserve `unknown` as possibly accepted evidence.
- [ ] Prove any post-stage fairness-input or enabled credit-ledger change
  invalidates activation without a partial cursor/credit transition.
  - [x] Local artifact cut: maintenance barrier/status/revision/transition drift
    and either rotation-aggregate drift change the expected-state/manifests and
    invalidate the preview-to-stage chain; candidate and receipt retain the
    transitive `expectedStateDigest` binding.
  - [x] Transactionally re-read every live fairness input in the activation CAS
    and prove the stale cached-source zero-public-write failure path.
- [ ] Prove current supported flat readers never see candidate or partial data,
  and transaction-budget overflow makes no public write and blocks rollout for a
  mobile active-revision migration.
- [ ] Prove exact activation/repair/recovery Sheets-sync command and event vectors
  with an idempotent fake consumer; require HU-083 to prove the real adapter drains
  them without duplicate export/notification.
- [ ] Prove rollback/cleanup retains replay evidence until expiry and delayed or
  unknown-marker events cannot be misclassified as ordinary after cleanup.
- [x] Prove safe resume retains the release lease, partial release blocks a
  superseding revision, terminal reconciliation clears it, and candidate lineage
  cannot mix migration baselines.
- [ ] Prove membership mismatch and invalid planning frontier fail atomically.
- [ ] Record the handoff contract for HU-083; do not activate Firestore/app production.
  The separately authorized consultation-workbook publication remains communication
  evidence, not HU-083 sync or HU-085 activation evidence.
- [x] Record zero Firestore/app activation and zero deployments for communication-
  baseline preparation, then retain source-manifest contrasts, all three digests, exact
  global approval, seal, render revalidation, separately authorized consultation-
  workbook publication/read-back, and private communication receipts.

## 8. Closure

- [ ] Update spec DoD, issue checklists, and implementation evidence.
- [ ] Document parity status and any approved residual explicitly.
- [ ] Link focused commits and PR to issue #266.
- [ ] Keep HU-083, HU-084, and HU-085 blockers/status synchronized without
  closing them implicitly.
- [ ] Confirm HU-085 respects the communicated `planningDigest` or links the full
  supersession/reapproval/reseal/recommunication evidence before activation.
