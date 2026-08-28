# Plan - HU-086 (Controlled weekly-order migration)

## 1. Technical approach

Implement a Firebase Admin CLI in `/functions` with a pure planning core and a
thin Firestore adapter. The command requires an explicit Firebase project,
target environment, and one ISO week from the HU-086 range. Its
source is always `production/collections/{orders,orderLines}`, and product
snapshots always resolve from `production/plus-collections/products`.

The tool first pages all required source, catalog, and selected-target data into
a bounded migration model. Pure code then decodes every document, validates the
complete relationship graph, builds canonical target projections, compares
them with normalized target documents, and calculates sorted cryptographic
digests. A dry-run stops after printing aggregate/redacted evidence.

Apply is a separate mode for exactly one target environment. It recomputes the
plan, rejects malformed input or any target conflict before the first write,
and creates only missing documents in batches below Firestore's write limit.
Non-existence preconditions protect against target changes after planning.
Server read-back rebuilds and verifies the intended projection; a final dry-run
must be fully idempotent. This is projection verification, not a declaration
that the legacy source exclusively owns every target document in those weeks;
well-formed native Reguerta+ records unrelated to the selected source may
coexist. Existing stale documents that collide with the selected projection
are reported as conflicts and deferred to a later explicit manifest and
authorization.

## 2. Layer impact

- UI: none.
- Presentation: none.
- Domain: no mobile domain change; migration validation remains isolated in
  Functions tooling.
- Data: no Android/iOS repository change.
- Backend: Admin migration CLI, pure planning/normalization helpers, bounded
  Firestore adapter, read-back verifier, and package scripts.
- Firebase configuration: no Rules, index, Functions configuration, or deploy
  change.
- Docs: HU-086 spec, plan, task ledger, and issue mirror.

## 3. Platform-specific changes

### Android

- No source or runtime change.
- Confirm the migrated wire projection remains compatible with #270; do not
  use HU-086 to add reader aliases.

### iOS

- No source or runtime change.
- The legacy app-side migration remains unused; do not change its permissions
  or invoke it for this rollout.

### Functions/Backend

- Add a dedicated CommonJS Admin CLI following the repository's existing
  migration-script conventions.
- Require explicit `--project`, `--target-env`, and `--week`; accept one of
  `2026-W28...2026-W34`, default to dry-run, and require `--apply` for writes.
- Bind live execution and its digest to `reguerta-9f27f`; reject inherited
  emulator routing in the real CLI.
- Hard-fence the fixed source/catalog paths and one selected 2026 week.
- Keep transformation and plan generation pure and exportable for `node:test`.
- Strictly decode orders, lines, and referenced products without `try?`-style
  omission or synthesized snapshot fallbacks.
- Count and omit only legacy order documents with zero raw linked lines, which
  are empty carts created eagerly by the published app. Keep fail-closed
  behavior when linked lines exist but cannot form a canonical order. Include
  each omitted cart in an internal digested manifest and retain exact-ID,
  owner/week, and target-line collision checks plus a transactional source
  membership guard before apply.
- Reproduce the audited legacy migrator's product-catalog authority for vendor,
  name, price, pricing mode, package, and unit snapshots while rejecting its
  silent defaults and preserving optional package absence.
- Normalize the published migrator's empty image sentinel to canonical `null`,
  while retaining strict rejection of non-string image values.
- Preserve source document IDs and parent relationships while emitting the #270
  canonical status and eco-basket field.
- Classify target records as create, no-op, or conflict after Firestore-aware
  normalization.
- Produce stable source/projection digests and redacted count summaries.
- Plan the whole invocation before writes, then create each complete order
  group in a bounded transaction with non-existence preconditions and
  transactional membership queries for concurrent source/target inserts.
- Re-read the target through the server after apply and verify the full
  projection, followed by an idempotent no-op plan.

## 4. Test strategy

- Unit:
  - dry-run default and explicit apply parsing;
  - mandatory project, single target environment, and single-week guards;
  - fixed production source/catalog paths for both targets;
  - strict canonical order and order-line transformation;
  - canonical `confirmed` and nullable `ecoBasketOption` without aliases;
  - approved legacy product remaps and missing-product rejection;
  - malformed documents, orphan lines, ownership/week mismatches, duplicate
    owner/week orders with linked lines, safe omission of all-zero duplicate
    placeholder groups, invalid totals, and non-finite numbers;
  - create/no-op/conflict classification with timestamp, number, and map-order
    normalization;
  - stable source/projection digests under shuffled input;
  - dry-run purity, transaction-size rejection, precondition failure, and partial
    apply reporting;
  - read-back count, ID, relationship, total, status, period, and digest
    mismatches;
  - successful idempotent rerun.
- Integration:
  - exercise pagination cursors with deterministic fakes and the complete
    Firestore adapter against the local emulator, including exact paths,
    concurrent membership inserts, precondition races, partial apply, hidden
    related targets, read-back mismatch, and idempotency;
  - do not use live Firebase as an automated test dependency.
- Repository validation:
  - run the focused migration tests;
  - run `npm run lint` and `npm run build` from `/functions`;
  - run `git diff --check` and inspect the final scope.
- Live validation:
  - only after the explicit confirmations in the rollout sequence below;
  - retain aggregate/redacted output and digests, never raw documents.

## 5. Rollout and functional validation

1. Complete local implementation, tests, and independent review. Tooling work
   may advance while #270 is in progress, but no live apply is allowed yet.
2. Obtain an exact read-only confirmation naming Firebase project
   `reguerta-9f27f`, Firestore, the fixed production sources/catalog, both
   target namespaces, and `2026-W28...2026-W34`.
3. Verify the active project and credentials, then run separate dry-runs for
   the develop and production targets one week at a time, beginning with
   `2026-W28`. Record source/projection digests and aggregate
   source/target/planned-create counts plus blocker categories for that week.
4. Stop on any malformed source, ambiguity, orphan, missing product, duplicate
   containing a linked line, or target conflict. Multiple duplicate zero-line
   placeholders require explicit tested classification and complete membership
   guards; do not bypass the guard.
5. After the dry-run evidence is reviewed, obtain a separate exact
   authorization to write only the develop target. #270 delivery remains a
   separate repository consistency change.
6. Recompute and match the reviewed projection, apply develop, perform server
   read-back, and repeat dry-run to prove zero pending creates/conflicts.
7. Present the develop evidence. Obtain a new, separate exact authorization to
   write the production target; develop authorization does not carry forward.
8. Recompute and match the reviewed projection, apply production, perform
   server read-back, and repeat dry-run to prove idempotency.
9. Repeat this independently for the next week only after the preceding week
   has passed both target verifications.
10. Report final counts and digests together with evidence that the fixed source
   digest is unchanged and no Rules, deploy, mobile, or out-of-period resource
   was touched.

No rollback delete is part of this plan. If read-back reveals an unexpected
result, stop and prepare a separately reviewed corrective plan scoped from the
recorded manifest and digests.

## 6. Phased implementation sequence

### Phase 1 - Contract and RED tests

- Record the fixed source/catalog/target matrix and operational gates.
- Translate the approved legacy transformations into explicit fixtures.
- Add failing tests for CLI fences, strict graph validation, canonical
  projection, target conflicts, digest stability, batching, and read-back.

### Phase 2 - Planner and Firestore adapter

- Implement pure parsing, normalization, transformation, plan, and digest
  helpers.
- Implement paginated Admin reads and create-only bounded transactions.
- Implement redacted summaries and server read-back verification.
- Turn focused migration tests GREEN.

### Phase 3 - Local validation and review

- Run focused tests, Functions lint, and Functions build.
- Audit the diff for path leakage, logging, unsafe merge/update/delete calls,
  and accidental deployment/configuration changes.
- Reconcile #271 with the fixed production-only source before any live run.

### Phase 4 - Authorized live dry-run

- Obtain the exact read-only confirmation.
- Verify `reguerta-9f27f` and run both target plans for `2026-W28` without
  writes before proceeding to any later week.
- Review counts, digests, conflicts, and blockers.

Executed for `2026-W28` on 2026-08-28 for both targets with Node.js
`v22.23.2`. Both invocations reported `apply: false`, `appliedWrites: 0`, and
zero blockers; their aggregate digests and counts are recorded in the task
ledger. The later week-by-week rollout completed every W28-W34 develop and
production apply under separate authorization, read-back, and no-op gates.

### Phase 5 - Authorized develop apply

- [x] Confirm #270 and the reviewed plan.
- [x] Obtain develop-only write authorization.
- [x] Apply, read back, and prove a no-op rerun.

Completed for W28-W34 with 121 orders and 318 order lines created in 439
create-only writes. Twenty-five empty cart placeholders were omitted, and the
final read-only sweep reported zero blockers and zero pending writes.

### Phase 6 - Authorized production apply

- [x] Review successful develop evidence.
- [x] Obtain production-only write authorization.
- [x] Apply, read back, prove a no-op rerun, and complete the final audit.

Completed for W28-W34 with the same aggregate projection: 121 orders and 318
order lines in 439 create-only writes, with 25 empty cart placeholders omitted.
The final audit reported zero blockers, zero pending writes, and no Rules,
deployment, mobile, source, or out-of-period changes.

## 7. Technical risks and mitigation

- Risk: Admin credentials bypass Firestore Rules.
  - Mitigation: hard-fenced paths/period, one target per invocation, dry-run
    default, explicit confirmations, create-only writes, and no deployment.
- Risk: an app-side behavior is copied without its silent-skip weaknesses.
  - Mitigation: encode intended transformations as strict fixtures and reject
    malformed, orphaned, or unresolved inputs.
- Risk: target data changes between dry-run and apply.
  - Mitigation: recompute the plan, match digests, and use non-existence
    preconditions.
- Risk: a batch failure leaves a partial create set.
  - Mitigation: bounded progress evidence, immediate read-back, and idempotent
    reruns that classify committed documents as no-ops.
- Risk: production is applied before develop proves the process.
  - Mitigation: single-target invocations and separate production
    authorization after develop read-back.
- Risk: PII appears in terminal or issue evidence.
  - Mitigation: reason categories, counts, and hashes only; no raw IDs or
    payload serialization in logs.
