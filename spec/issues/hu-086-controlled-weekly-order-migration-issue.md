# [HU-086] Controlled W28-W34 order migration to plus-collections

GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/271

## Outcome

Provide a reviewed Firebase Admin migration for the requested 2026 historical
weekly orders, copying one fixed production legacy source into the separate
Reguerta+ develop and production targets without relaxing client permissions,
merging over divergent documents, or deploying Firebase resources.

## Links

- Spec: `spec/orders/hu-086-controlled-weekly-order-migration/spec.md`
- Plan: `spec/orders/hu-086-controlled-weekly-order-migration/plan.md`
- Tasks: `spec/orders/hu-086-controlled-weekly-order-migration/tasks.md`
- Contract dependency:
  [issue #270](https://github.com/JFrancoG/ReguertaPlus/issues/270) and ADR-0014
  once landed.

## Exact data boundary

| Role | Firestore path |
| --- | --- |
| Orders source | `production/collections/orders` |
| Order-lines source | `production/collections/orderLines` |
| Product catalog | `production/plus-collections/products` |
| Develop targets | `develop/plus-collections/{orders,orderlines}` |
| Production targets | `production/plus-collections/{orders,orderlines}` |

The allowed weeks are ISO `2026-W28` through `2026-W34`, inclusive, but each
invocation handles exactly one week and one target. The develop legacy tree is
not a source. Both targets are planned independently from the same production
source.

## Acceptance criteria

- The Admin CLI requires an explicit Firebase project, one target environment,
  and one allowed ISO week; dry-run is the default.
- Source orders, source `orderLines`, and product catalog reads always use the
  fixed production paths, regardless of target.
- The canonical projection preserves order and line document IDs plus every
  `orderId` relationship.
- Orders use `consumerStatus = "confirmed"`; lines use only nullable
  `ecoBasketOption` and do not dual-write the historical alias.
- Malformed documents, orphaned lines, identity/week mismatches, duplicate
  owner/week orders with any linked line, unresolved products, invalid totals,
  or target conflicts fail the complete plan before writes. Multiple zero-line
  placeholders for the same owner/week may all be omitted under the same
  digested and transactional guards as one empty cart.
- Missing targets are created without merge semantics, identical targets are
  no-ops, and divergent targets are never overwritten. Stale existing targets
  require a later explicit manifest and authorization.
- The read-back proves the complete selected migration projection, not equality
  of the whole target namespace; unrelated well-formed Reguerta+ orders may
  coexist.
- Paginated reads, bounded writes, non-existence preconditions, stable digests,
  aggregate/redacted logs, read-back, and idempotent reruns are tested.
- Focused migration tests, Functions lint, and Functions build pass.
- A read-only live dry-run requires an exact confirmation naming project,
  service, paths, targets, and period.
- Develop apply requires a separate exact write confirmation and successful
  read-back before production is considered.
- Production apply requires a new exact write confirmation after develop
  evidence is reviewed, followed by its own read-back and no-op rerun.
- No Rules, Functions deploy, mobile source, legacy source document, or
  out-of-period target document changes.

## Safety gates

1. Implement and validate the tooling locally while #270 is completed.
2. Obtain explicit authorization and run separate read-only target plans.
3. Review aggregate counts, source/projection digests, and every blocker.
4. After #270 review, obtain develop-only apply authorization.
5. Apply develop, read back the server state, and prove an idempotent rerun.
6. Present the evidence and obtain a separate production-only authorization.
7. Apply production, read back, prove idempotency, and verify source immutability.

Authorization for one gate does not authorize the next. A conflict or digest
change returns the workflow to dry-run and review.

## Superseded range dry-run - 2026-08-28

The fixed source/catalog and both targets were read with Node.js `v22.23.2`
against `reguerta-9f27f` for `2026-W28...2026-W34`. Both plans reported
`apply: false`, `appliedWrites: 0`, and `readBack: null`.

| Target | Plan digest | Source/projection digests | Counts and blockers |
| --- | --- | --- | --- |
| `develop` | `9afe978816df134d50cc5cf7a1edddbe29bd2cd0865bffb0b92bcc1049098f23` | `88bf570f57085dcdd3a682cc7738e0257d02f12232688bf1ac49f8e7f8769799` / `70bf6019d1076cb1bf210c7c275993abc53b00971460db0653549a6aaecaf7e7` | 146 source orders; 318 source lines; 254 products; 132 target orders; 0 target lines; 90 groups; 254 planned writes; 200 blockers |
| `production` | `1c71c9ce24ed054b21a300ef50c04cbb243484d131c9c730673cf708bf0e46b2` | `88bf570f57085dcdd3a682cc7738e0257d02f12232688bf1ac49f8e7f8769799` / `70bf6019d1076cb1bf210c7c275993abc53b00971460db0653549a6aaecaf7e7` | 146 source orders; 318 source lines; 254 products; 132 target orders; 0 target lines; 90 groups; 254 planned writes; 200 blockers |

Each target reported `duplicate-owner-week: 2`, `malformed-product: 43`,
`malformed-target-order: 132`, and `order-without-orderlines: 23`. The task
ledger contains the weekly aggregate breakdown. The planned writes are
hypothetical; no Firestore mutation occurred. Both applies remain blocked
pending diagnosis/remediation and #270 review.

This preliminary seven-week plan was superseded after comparison with the
published migrator. The 132 targets all had canonical week keys outside 2026
and were pulled only by the broad numeric-week query; they were not malformed
2026 targets. The 43 image failures were the legacy empty-string sentinel,
which the canonical projection now normalizes to `null`. The 23 orders without
raw lines are empty carts eagerly created by the old app and are now counted and
omitted rather than promoted to false confirmed orders. No write occurred in
the superseded run and none of its plan digests is valid for apply.

## Authorized single-week dry-run evidence - W28 - 2026-08-28

Separate read-only invocations for `develop` and `production` selected only
`2026-W28`. Both returned `apply: false`, `appliedWrites: 0`, `readBack: null`,
the same source/projection digests, and zero blockers.

| Target | Plan digest | Source digest | Projection digest |
| --- | --- | --- | --- |
| `develop` | `abcc3cdc1c772be48dc73972c2e051817b8c19b9ca58bf431a52ad696366cd59` | `cb3bb27cd8a220e3004cd66f0b3b03ba47d1b0d13ee1f6507e8648c6b379bbe4` | `fb0bee0fd23f50453399e34ea2f30bfeaf772236fd994087c145a1e721b82bd5` |
| `production` | `fb9388130bc144701f4d3cd8bf7c7d381e5f42520ce930c60bbc383d1a55b668` | `cb3bb27cd8a220e3004cd66f0b3b03ba47d1b0d13ee1f6507e8648c6b379bbe4` | `fb0bee0fd23f50453399e34ea2f30bfeaf772236fd994087c145a1e721b82bd5` |

Each target scanned 21 source orders, 58 source lines, 254 products, 16
canonical target orders from another year, and no selected target lines. The
projection omits 2 empty legacy carts and plans 19 order creates plus 58 line
creates: 77 writes. The 16 outside-week target orders coexist and do not enter
the selected business-key index; exact source-ID collisions remain guarded.
The two omitted carts are present in the digested internal manifest and retain
transactional collision and source-membership guards without exposing IDs in
the dry-run summary.

## Authorized develop apply evidence - W28 - 2026-08-28

The exact reviewed develop plan was applied with digest
`abcc3cdc1c772be48dc73972c2e051817b8c19b9ca58bf431a52ad696366cd59`.
It created 19 orders and 58 order lines: 77 writes. The transactional guards
reported zero blockers and the two empty legacy carts remained omitted.

The built-in read-back and a separate post-apply dry-run both found the 19
selected orders and 58 selected lines with zero planned writes and zero
blockers. The source digest remained
`cb3bb27cd8a220e3004cd66f0b3b03ba47d1b0d13ee1f6507e8648c6b379bbe4`
and the projection digest remained
`fb0bee0fd23f50453399e34ea2f30bfeaf772236fd994087c145a1e721b82bd5`.
The post-apply no-op plan digest is
`9b6da0116a3505d99f6b7e91e1c7b0b4479ca12928af2cbc41c6b8da91c91cee`.
No production document or other week was written.

The owner subsequently reported a manual spot-check of the migrated W28
records as correct in principle. This is retained as supplementary operational
evidence rather than an exhaustive field-by-field audit.

## Authorized develop apply evidence - W29 - 2026-08-28

The single-week develop dry-run scanned 19 source orders and 39 source lines,
omitted 4 empty legacy carts, and planned 15 orders plus 39 lines with zero
blockers. The reviewed plan digest
`c09abd9ed85742fc3393f43bb7febd01ed00de675f6d2bd9658ee698f6f48de6`
was applied, creating 54 documents.

The built-in read-back and a separate post-apply dry-run both found 15 selected
orders and 39 selected lines with zero planned writes and zero blockers. The
source digest is
`159215f5514c8e56917ed107a5e0c4bb2baf2ca393bb6d69e1b6fef9493eb708`,
the projection digest is
`05373c31d435f57e089c6d66ff41c74a4e175afc92f298a603c317202bbb6334`,
and the post-apply no-op plan digest is
`6c842cce9867ff9878871e7b9a6514a36c59df8c6f0bf38255dbb04474d0d4b1`.
No production document or W30-W34 resource was written.

## Authorized develop apply evidence - W30-W32 - 2026-08-28

W30, W31, and W32 were processed sequentially as three isolated invocations.
Every preflight, transactional apply, built-in read-back, and independent
post-apply dry-run reported zero blockers. No production document or W33-W34
resource was written.

| Week | Source orders / lines | Empty carts | Created orders / lines | Writes | Apply digest | No-op digest |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `2026-W30` | 25 / 75 | 3 | 22 / 75 | 97 | `7773e0df705f26dc3a5c26a6d8710b028584bbacede79b9301f1921ffbff8f1c` | `c40b0350b05816a5ebf68506f2fd05fe398a836b70c67a0974f603cfc0afc045` |
| `2026-W31` | 21 / 60 | 4 | 17 / 60 | 77 | `1d8042d4ebf7fdc6ad4f450a255fbb9719c3f317110fe6b486633a91b15e88e1` | `6e3904f2da51e6660ff62476db769387467038ecbe8ab59afce25243f3b5614d` |
| `2026-W32` | 18 / 18 | 1 | 17 / 18 | 35 | `28d05a86e8c07f92e0b92c537849c0e80c10cccf61525b97400a2b3b67d4d9c4` | `ddd124be1b305a533b18b2b61796902c98d59d2bcc49c88d1cb315bdb1391b35` |

The three weeks created 56 orders and 153 order lines in 209 create-only
writes while omitting 8 empty carts. Across W28-W32, develop now contains the
complete projection of 90 selected orders and 250 selected order lines created
by this migration, with 14 empty carts omitted.

## Authorized develop closure - W33-W34 - 2026-08-28

W33 created 17 orders and 52 order lines in 69 writes, omitting 5 empty carts.
Its reviewed apply digest was
`044ef613308ca33472db4859b9f374924c2b8abd09038a2131b33380e328688a`
and its post-apply no-op digest is
`909c8a15c810f67c1de690cc47d40471ee42f9cccdf75724f2eeda997fc1763a`.

The first W34 dry-run stopped safely with one two-document duplicate
owner/week group and performed no write. A PII-free read-only diagnosis proved
that both documents were zero-line carts created 17 seconds apart. The planner
was then tightened to omit an owner/week duplicate group only when every raw
`orderId` membership is empty; all members remain digested and a single bounded
transaction verifies the exact IDs, update times, source/target lines, and
owner/week membership. Any duplicate group with one linked raw line still
blocks. Validation passed with 27/27 focused tests, 50/50 migration-script
tests, 2/2 Firebase Admin contract tests, 1/1 emulator test, lint, build, and an
independent review with no P1/P2 findings.

The corrected W34 plan used digest
`45c968c8cd33ad2ff1e1aabda9de50657b27ff52bd8ad760a72e23fdfe5d1454`
and created 14 orders plus 16 lines in 30 writes while omitting 6 empty carts.
Its post-apply no-op digest is
`a8e57b0d9f8744589c8ddc4a7926dde7d8720daf9a8b9c30402481f2c9ec17aa`.

A final read-only sweep of every week W28-W34 returned zero blockers and zero
pending writes. Develop contains the complete migration projection of 121
orders and 318 order lines created in 439 writes; 25 empty carts were omitted.
No production document was written.

## Authorized production apply evidence - W28 - 2026-08-28

A fresh production dry-run returned 19 planned orders, 58 planned lines, 2
empty carts omitted, and zero blockers. The reviewed apply digest
`fb9388130bc144701f4d3cd8bf7c7d381e5f42520ce930c60bbc383d1a55b668`
was applied in 77 create-only writes.

The built-in read-back and a separate post-apply dry-run both found 19 selected
orders and 58 selected lines with zero pending writes and zero blockers. The
source digest remained
`cb3bb27cd8a220e3004cd66f0b3b03ba47d1b0d13ee1f6507e8648c6b379bbe4`,
the projection digest remained
`fb0bee0fd23f50453399e34ea2f30bfeaf772236fd994087c145a1e721b82bd5`,
and the production no-op plan digest is
`57ad672336029f1e6c680ef3d2a263aa39e46be16aea0220ece034bfc72549b1`.
No production W29-W34 resource was written.

## Authorized production apply evidence - W29-W31 - 2026-08-28

W29, W30, and W31 were processed sequentially as three isolated invocations.
Every preflight, transactional apply, built-in read-back, and independent
post-apply dry-run reported zero blockers and zero pending writes.

| Week | Source orders / lines | Empty carts | Created orders / lines | Writes | Apply digest | No-op digest |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `2026-W29` | 19 / 39 | 4 | 15 / 39 | 54 | `2de8ce256886d179d8dc79fe8c93a2a1911999730c576162bd48be64880f42ac` | `54b34676c6df2b105e302ec779f43e77f0375fcd6b8f0d9b95c2e31b88871bda` |
| `2026-W30` | 25 / 75 | 3 | 22 / 75 | 97 | `8bbecb1570df83b58359499e7f2a583b565c58cb2d6e54c018c2ca9379f40b5f` | `b0a0f0a023a5d201ee0bd974702de6daae22f918797de4bc6202cd0d0fc93215` |
| `2026-W31` | 21 / 60 | 4 | 17 / 60 | 77 | `9fc83f5cd53b603ac6b3d9d9975efa96f18a781953a82a715ed11ebb4a8b6df5` | `759cfbfbf8a950ceb96dcfff6a704af7a3796caf036e18e9d2af45143e8a80b1` |

These three weeks created 54 orders and 174 order lines in 228 create-only
writes while omitting 11 empty carts. Across W28-W31, production now contains
the complete migration projection of 73 selected orders and 232 selected order
lines created in 305 writes; 13 empty carts were omitted. Production W32-W34
was not written.

## Authorized production closure - W32-W34 - 2026-08-28

W32, W33, and W34 were processed sequentially as three isolated invocations.
Every preflight, transactional apply, built-in read-back, and independent
post-apply dry-run reported zero blockers and zero pending writes.

| Week | Source orders / lines | Empty carts | Created orders / lines | Writes | Apply digest | No-op digest |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `2026-W32` | 18 / 18 | 1 | 17 / 18 | 35 | `2fe681d3dbca1b178d4c7ae46f2e75ad5b18cfc0bdc9b86297b701ed458dd1b0` | `680d68b30898633bb99758d72152e9292513fc48a905f686c89537432f1a6b2d` |
| `2026-W33` | 22 / 52 | 5 | 17 / 52 | 69 | `e7fbee6c9a7dfe34f4a7574f1dd064444c040a869675a86a328877cd5bae304d` | `f195823a290541d1b5a9d9636b8cee762529735ee0fc580e626840931c7e0fc0` |
| `2026-W34` | 20 / 16 | 6 | 14 / 16 | 30 | `71b22bd76c5d24298357327e3fc5ab9e29182026c70e13450cef3daa64111a6b` | `3c4e6db8a03e607d2bf3c0e82c963b2adcac12d1d6bbdeda377ecfa0dd4e053a` |

These three weeks created 48 orders and 86 order lines in 134 create-only
writes while omitting 12 empty carts. A final read-only sweep of every week
W28-W34 returned zero blockers and zero pending writes. Production contains the
complete migration projection of 121 selected orders and 318 selected order
lines created in 439 writes; 25 empty carts were omitted.

## Out of scope

- `develop/collections` as a migration source.
- Source writes or deletes.
- Blind merge/update of existing target documents.
- Any week outside `2026-W28...2026-W34`.
- Firestore/Storage Rules, indexes, Functions configuration, or deployment.
- Android, iOS, or legacy-app changes.
- Contract changes owned by #270 or strict Rules cutover.
- Automated rollback deletes.

## Implementation checklist

- [x] Backend/Admin migration CLI.
- [x] Pure planner, canonical transformer, conflict detector, and digest.
- [x] Focused automated tests.
- [x] Functions lint and build.
- [x] Authorized read-only live dry-run for W28 in both targets.
- [x] Separately authorized develop apply and read-back.
- [x] Final develop W28-W34 zero-blocker, zero-pending sweep.
- [x] Separately authorized production W28-W34 apply and read-back.
- [x] Final production W28-W34 zero-blocker, zero-pending sweep.
- [x] Aggregate evidence and documentation reconciliation.

## Suggested labels

- type:feature
- area:orders
- platform:backend
- priority:P1
