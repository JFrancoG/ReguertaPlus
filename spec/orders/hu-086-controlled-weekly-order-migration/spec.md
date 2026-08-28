# HU-086 - Controlled weekly-order migration

## Metadata

- issue_id: #271
- priority: P1
- platform: backend
- status: in-progress

## Context and problem

The published app stores the requested historical weekly orders in the legacy
`production/collections` tree. Reguerta+ needs the same 2026 weeks in both of
its environment namespaces, but the existing app-side migration runs with
client credentials and is now rejected by Firestore Rules. Relaxing Rules even
temporarily would widen application permissions and is not an acceptable
migration mechanism.

The earlier helper also merges writes and can skip malformed or orphaned source
documents. A privileged migration must instead make the complete plan visible
before writing, reject ambiguity, preserve identifiers and relationships, and
prove the result by server read-back.

The wire spellings are owned by issue
[#270](https://github.com/JFrancoG/ReguertaPlus/issues/270): confirmed orders use
`consumerStatus = "confirmed"`, and order lines use nullable
`ecoBasketOption`. HU-086 may implement and test tooling while that dependency
is being delivered, but no live apply may precede review of the canonical
contract.

## User story

As a migration operator, I want to copy the requested historical weekly orders
through a guarded Firebase Admin workflow so Reguerta+ has the same audited
order history in develop and production without changing mobile permissions or
silently overwriting existing data.

## Scope

### In scope

- One Firebase Admin CLI migration, dry-run by default.
- Explicit Firebase project, target environment, and one ISO-week argument.
- The fixed source, catalog, targets, and period in the path contract below.
- Deterministic transformation to the canonical `orders` and `orderlines`
  shapes established by #270.
- Preservation of source order IDs, order-line IDs, and every line's `orderId`
  relationship.
- Complete preflight validation before the first write.
- Paginated reads, bounded order transactions, conflict protection,
  stable digests, and aggregate/redacted reporting.
- Idempotent reruns, target conflict detection, and server read-back.
- A gated develop apply and verification before a separately authorized
  production apply.
- Focused migration tests and Functions validation.

### Out of scope

- Reading `develop/collections/{orders,orderLines}` as migration input.
- Mutating or deleting any document under `production/collections`.
- Migrating any year or week outside `2026-W28` through `2026-W34`.
- Migrating collections other than the exact order and order-line targets.
- Firestore or Storage Rules changes or deployment.
- Cloud Functions deployment.
- Android, iOS, or legacy-app source changes.
- Strict Rules cutover or removal of historical reader compatibility.
- Automatic rollback deletes; any corrective mutation requires a new reviewed
  plan and explicit authorization.

## Fixed path and period contract

| Purpose | Exact Firestore path | Access |
| --- | --- | --- |
| Legacy orders source | `production/collections/orders` | Read only |
| Legacy order lines source | `production/collections/orderLines` | Read only |
| Product snapshot catalog | `production/plus-collections/products` | Read only |
| Develop orders target | `develop/plus-collections/orders` | Gated create only |
| Develop order lines target | `develop/plus-collections/orderlines` | Gated create only |
| Production orders target | `production/plus-collections/orders` | Gated create only |
| Production order lines target | `production/plus-collections/orderlines` | Gated create only |

The only accepted weeks are the inclusive ISO-week range `2026-W28` through
`2026-W34`. One invocation plans or applies exactly one week and one target
environment; neither weeks nor `develop` and `production` can be combined.

## Migration invariants

- Every selected source document is decoded strictly; malformed documents are
  reported by redacted reason and fail the complete plan instead of being
  omitted.
- Every selected order line resolves to exactly one selected source order, and
  its `userId` and week agree with that parent order.
- A legacy `orders` document with zero raw lines is an empty cart placeholder
  created when the old app entered the order flow. It is counted and omitted,
  rather than being promoted to a false confirmed order with total zero. An
  order with linked lines that are rejected or incompatible still blocks. Each
  omitted cart remains represented in the internal source/plan digest manifest;
  exact order-ID, owner/week, and target-line collisions block, and apply
  transactionally proves that the source order is unchanged and still empty.
  If the old app created multiple zero-line placeholders for one
  `userId + weekKey`, all are omitted only when every document has zero raw
  lines; apply verifies the complete sibling membership before any write.
- Any duplicate source group for `userId + weekKey` with at least one linked
  raw line fails closed before target writes.
- Every product required to build a canonical line snapshot resolves through
  `production/plus-collections/products`. Any supported legacy product remap is
  explicit, tested, and must resolve to a real catalog document; the tool does
  not synthesize deleted products or vendor identifiers.
- The production product catalog is the historical migrator's authority for
  `vendorId`, name, price, pricing mode, package, and unit snapshots. A legacy
  line can only provide the image fallback used by that migrator; it cannot
  override current catalog values. Optional package fields remain absent when
  the catalog omits them; missing or invalid required catalog data blocks the
  plan instead of activating the old synthetic defaults.
- The historical empty-string image sentinel is projected as canonical `null`;
  a non-string image value remains malformed.
- Target order and order-line document IDs equal their source IDs, and an
  order-line's canonical `orderId` remains unchanged.
- Order totals equal the rounded sum of their lines, and `totalsByVendor`
  equals the same lines grouped by canonical `vendorId`.
- `priceAtOrder` uses the production catalog value rounded to cents exactly as
  the published migrator did; the authoritative legacy subtotal is preserved
  and is not recomputed from that display snapshot.
- Historical orders in this range use `consumerStatus = "confirmed"`; the
  remaining status and timestamp projection is deterministic and covered by
  fixtures for the approved migration contract.
- Canonical lines contain only `ecoBasketOption` for the eco-basket choice:
  `"pickup"`, `"no_pickup"`, or `null`. They do not dual-write
  `ecoBasketOptionAtOrder`.
- Firestore timestamps and numeric values are normalized before comparison and
  digest calculation so input ordering cannot change the result.
- A missing target document is a planned create. A target document whose
  canonical projection is already identical is a no-op. Any divergent target
  document is a conflict and makes the complete invocation non-writable.
- A well-formed Reguerta+ target document unrelated to every selected source
  ID, source owner/week business key, and source `orderId` may coexist. The
  legacy tree is migration input, not an exclusive mirror of the target
  namespace.
- A target order with a valid owner and a canonical `weekKey` outside the one
  selected week may coexist when its numeric `week`, if present, agrees with
  that key. Missing or noncanonical keys, conflicting owner aliases, numeric
  week mismatches, and exact source-ID collisions still fail closed.
- The tool computes stable source and intended-projection digests from sorted
  path/ID records. The Firebase project ID is part of the scope and digest.
  Logs expose only digests, source/target/planned-create counts by week, and
  global blocker categories; no names, emails, payloads, or raw document IDs
  are printed.
- Dry-run performs no writes. Apply recomputes the plan, requires it to match
  the reviewed projection, and uses target non-existence preconditions so a
  change between planning and commit fails rather than being merged.
- Each order transaction re-queries the complete source-line and target-line
  membership for its `orderId`, plus source and target owner/week membership.
  Inserts by an active writer therefore invalidate that group before its
  create operations commit; the final read-back detects changes outside a
  group transaction.
- A successful apply is followed by server read-back of counts, IDs,
  relationships, weeks, statuses, totals, and the intended-projection digest.
  This proves the complete selected projection, not equality of the entire
  target namespace. A repeated dry-run must then report only no-ops and zero
  conflicts for that projection.

## Linked functional requirements

- RF-ORD-09, as canonicalized by #270.
- RF-CAT-11, as canonicalized by #270.
- RNF-03 idempotency principle for weekly operations.

## Acceptance criteria

- The CLI is a dry-run unless `--apply` is explicitly present.
- The CLI rejects an implicit project, a target other than `develop` or
  `production`, combined target environments, combined weeks, and any single
  week outside the inclusive `2026-W28...2026-W34` range.
- Live execution accepts only Firebase project `reguerta-9f27f`, includes it in
  the reviewed digest, and refuses to run while `FIRESTORE_EMULATOR_HOST` is set.
- Source and catalog reads always use the fixed production paths; selecting a
  develop target never changes the source environment.
- The full source and target plan passes strict shape, relationship, product,
  owner/week uniqueness, total, status, and conflict validation before any
  write begins.
- Missing target documents are created without merge semantics, identical
  documents are no-ops, and divergent documents stop the invocation without
  writes. A stale existing document requires a separately reviewed migration
  with its own manifest and authorization.
- Dry-run, apply, and read-back expose stable aggregate counts and digests with
  no PII or raw document identifiers.
- Tests cover argument parsing, path mapping, canonical transformation,
  product remaps, malformed and orphan data, duplicate owner/week orders,
  target conflicts, deterministic digests, batch boundaries, dry-run purity,
  idempotent reruns, and read-back mismatches.
- Functions lint, build, and focused migration tests pass.
- Live reads occur only after an explicit confirmation naming Firebase project
  `reguerta-9f27f`, Firestore, the exact paths, both targets, and the period.
- Develop apply occurs only after a separate exact write confirmation and is
  followed by successful read-back.
- Production apply occurs only after develop verification, review of the live
  evidence, and a separate exact production write confirmation.
- No Rules, deployment, mobile code, legacy source document, or out-of-period
  target document changes as part of HU-086.

## Dependencies

- GitHub issue [#271](https://github.com/JFrancoG/ReguertaPlus/issues/271).
- Canonical weekly-order contract in
  [#270](https://github.com/JFrancoG/ReguertaPlus/issues/270) and ADR-0014 once
  that decision lands on the shared branch.
- Read access to the fixed production legacy source and canonical product
  catalog in Firebase project `reguerta-9f27f`.
- Firebase Admin credentials supplied through the established local
  application-default credential flow; no credential is committed.

## Risks

- Admin SDK bypasses client Rules and increases blast radius.
  - Mitigation: fixed paths and allowed weeks, dry-run default, exact
    confirmations, one week and one target per invocation, and no
    delete/update operations.
- The reviewed dry-run can become stale before apply.
  - Mitigation: recompute source and target state immediately before apply and
    require matching digests and write preconditions.
- Legacy numeric weeks may be interpreted as the wrong year.
  - Mitigation: require an explicit source `year = 2026` when present; otherwise
    require 2026 document creation metadata, validate any `weekKey`, and stop on
    ambiguity.
- Product catalog drift can change historical snapshots.
  - Mitigation: digest the resolved product inputs and require the apply plan
    to match the reviewed dry-run.
- A process or network failure can stop between bounded batches.
  - Mitigation: create-only idempotency, per-batch evidence, immediate
    read-back, and a safe no-op rerun.
- A single-week apply can still stop after one complete order transaction and
  before the next one.
  - Mitigation: report the aggregate committed-write count and require a new
    dry-run before any retry; do not infer week-level atomicity.
- The source or selected target can change while multiple order transactions
  are being applied.
  - Mitigation: serializable membership queries inside each order transaction,
    full-version guards, immediate global read-back, and explicit reporting of
    any already committed group. A failed multi-group apply is reviewed before
    rerun; it is never repaired by merge or delete.
- Develop and production targets may already differ.
  - Mitigation: plan each target independently and treat every divergence as a
    conflict rather than copying one target over the other. Stale existing
    documents require a later explicit manifest and scope.
- Logs could expose historical member data.
  - Mitigation: emit only aggregate counts, redacted reason categories, and
    cryptographic digests.

## Definition of Done (DoD)

- [x] Acceptance criteria validated.
- [x] Focused migration tests, Functions lint, and Functions build pass.
- [x] Android/iOS impact reviewed as not applicable to this backend-only cut.
- [x] Issue, spec, plan, and task ledger linked.
- [x] Authorized W28 develop- and production-target live dry-runs recorded with
  zero blockers and zero applied writes.
- [x] #270 contract dependency reviewed before any live apply.
- [x] Authorized develop apply and read-back complete.
- [x] Separately authorized production apply and read-back complete.
- [x] Final evidence confirms no out-of-scope Firebase or repository changes.
