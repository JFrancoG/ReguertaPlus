# Tasks - HU-086 (Controlled weekly-order migration)

## 1. Preparation

- [x] Search existing tracker work and create GitHub issue #271.
- [x] Create isolated branch/worktree
  `codex/hu-086-controlled-weekly-order-migration`.
- [x] Add the HU-086 spec, plan, task ledger, and issue mirror.
- [x] Record the fixed production-only source and product catalog separately
  from the two target environments.
- [x] Audit the legacy app-side migration behavior and identify silent skip,
  merge, fallback, and client-permission hazards that must not be retained.
- [x] Reconcile the #271 issue body with the fixed production-only source.
- [x] Review #270 and ADR-0014 before authorizing any live apply.

## 2. Android implementation

- [x] Confirm no Android source or runtime change is in scope.
- [x] Verify the final migrated projection remains compatible with the #270
  Android reader contract.

## 3. iOS implementation

- [x] Confirm no iOS or legacy-app source change is in scope.
- [x] Verify the final migrated projection remains compatible with the #270
  iOS reader contract.

## 4. Backend / Firestore tooling

- [x] Add the dedicated Admin migration CLI with dry-run default.
- [x] Require the explicit Firebase project, one target environment, and one
  week selected from `2026-W28...2026-W34`.
- [x] Hard-fence reads to `production/collections/{orders,orderLines}` and
  `production/plus-collections/products`.
- [x] Hard-fence writes to the selected
  `<target>/plus-collections/{orders,orderlines}` paths.
- [x] Add paginated reads and bounded create-only order transactions.
- [x] Strictly decode every source order, order line, and referenced product.
- [x] Validate parent relationships, identity/week agreement, owner/week
  uniqueness, product resolution, totals, and canonical field values.
- [x] Preserve source document IDs and order-to-line relationships.
- [x] Emit `consumerStatus = "confirmed"` and nullable `ecoBasketOption`
  without historical aliases.
- [x] Make approved legacy product remaps explicit and reject unresolved
  products or synthesized vendor/snapshot fallbacks.
- [x] Normalize the legacy empty image sentinel to canonical `null` while
  rejecting non-string values.
- [x] Count and omit zero-line legacy cart placeholders while retaining
  fail-closed behavior for rejected or incompatible linked lines.
- [x] Classify target documents as create, no-op, or conflict without merge or
  update semantics.
- [x] Add stable source/projection digests and aggregate PII-free summaries.
- [x] Protect creates with non-existence and transactional membership guards.
- [x] Add server read-back and idempotent rerun verification.
- [x] Add package scripts for the focused tests and migration command.

## 5. Testing

- [x] Record RED tests for CLI arguments and path fences.
- [x] Record RED tests for canonical order/order-line transformation and
  approved product remaps.
- [x] Record RED tests for malformed documents, orphans, ownership/week
  mismatches, duplicate owner/week orders with lines, all-zero duplicate
  placeholder omission, and missing products.
- [x] Record RED tests for create/no-op/conflict planning and dry-run purity.
- [x] Record RED tests for single-week scope, prior-year target coexistence,
  exact-ID collisions, empty images, and empty legacy cart omission.
- [x] Record RED tests for deterministic digests, bounded transactions,
  precondition failures, partial writes, and read-back mismatches.
- [x] Turn all focused migration tests GREEN.
- [x] Run the complete migration-script suite.
- [x] Run `npm run lint` in `/functions`.
- [x] Run `npm run build` in `/functions`.
- [x] Run `git diff --check` and audit the final file scope.

## 6. Authorized live dry-run

- [x] Obtain explicit read-only confirmation naming `reguerta-9f27f`,
  Firestore, the fixed source/catalog, both targets, and weeks 2026-W28-W34.
- [x] Verify the active Firebase project and credential context immediately
  before reading.
- [x] Run the develop-target dry-run with no writes.
- [x] Run the production-target dry-run with no writes.
- [x] Record only aggregate counts, redacted reason categories, and digests.
- [x] Stop and review any malformed input, orphan, duplicate, missing product,
  target conflict, or digest mismatch.

### Superseded range evidence - 2026-08-28

- Runtime: Node.js `v22.23.2`.
- Project: `reguerta-9f27f`; ADC verified without an inherited credential or
  Firestore emulator.
- Source: `production/collections/{orders,orderLines}`; catalog:
  `production/plus-collections/products`; period: `2026-W28...2026-W34`.
- Both invocations reported `apply: false`, `appliedWrites: 0`, and
  `readBack: null`.

| Target | Plan digest | Source digest | Projection digest |
| --- | --- | --- | --- |
| `develop` | `9afe978816df134d50cc5cf7a1edddbe29bd2cd0865bffb0b92bcc1049098f23` | `88bf570f57085dcdd3a682cc7738e0257d02f12232688bf1ac49f8e7f8769799` | `70bf6019d1076cb1bf210c7c275993abc53b00971460db0653549a6aaecaf7e7` |
| `production` | `1c71c9ce24ed054b21a300ef50c04cbb243484d131c9c730673cf708bf0e46b2` | `88bf570f57085dcdd3a682cc7738e0257d02f12232688bf1ac49f8e7f8769799` | `70bf6019d1076cb1bf210c7c275993abc53b00971460db0653549a6aaecaf7e7` |

Both targets returned the same aggregate inventory and proposed projection:

| Count | Value |
| --- | ---: |
| Source orders scanned | 146 |
| Source order lines scanned | 318 |
| Products scanned | 254 |
| Target orders scanned | 132 |
| Target order lines scanned | 0 |
| Planned groups | 90 |
| Planned order creates | 90 |
| Planned order-line creates | 164 |
| Planned writes | 254 |
| Blockers | 200 |

| Week | Source orders | Source lines | Target orders | Target lines | Planned groups | Order creates | Line creates |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `2026-W28` | 21 | 58 | 0 | 0 | 14 | 14 | 37 |
| `2026-W29` | 19 | 39 | 0 | 0 | 11 | 11 | 24 |
| `2026-W30` | 25 | 75 | 0 | 0 | 13 | 13 | 34 |
| `2026-W31` | 21 | 60 | 0 | 0 | 10 | 10 | 17 |
| `2026-W32` | 18 | 18 | 0 | 0 | 17 | 17 | 18 |
| `2026-W33` | 22 | 52 | 0 | 0 | 12 | 12 | 20 |
| `2026-W34` | 20 | 16 | 0 | 0 | 13 | 13 | 14 |

Redacted blocker categories were identical for both targets:

| Blocker | Count |
| --- | ---: |
| `duplicate-owner-week` | 2 |
| `malformed-product` | 43 |
| `malformed-target-order` | 132 |
| `order-without-orderlines` | 23 |

The planned-write count is hypothetical dry-run output, not a mutation count.
Both plans remain blocked pending diagnosis/remediation and review of #270; no
apply or read-back was attempted.

An aggregate-only diagnostic rerun produced the same counts and all three
digests for both targets, and narrowed the blockers without emitting document
or member identifiers:

- `malformed-product`: 43 affected order lines across 13 distinct products;
  every first failure was `invalidProductImageUrl`. `catalogDocuments: 0`
  means no catalog snapshot failed structural ID/data loading; it does not mean
  that every referenced product field is valid.
- `malformed-target-order`: all 132 documents reported
  `missingOrOutOfScopeWeekKey`.
- `duplicate-owner-week`: one two-document source group in `2026-W34`.
- `order-without-orderlines`: all 23 orders had zero raw lines linked by exact
  `orderId`: W28 2, W29 4, W30 3, W31 4, W32 1, W33 5, and W34 4.

The diagnostic summary is excluded from projection and digest material. Its
JSON output boundary is tested to omit groups, document IDs, member IDs, names,
and payloads. Full canonical validation of otherwise unrelated target orders
remains part of the #270 contract review before any apply.

The range evidence above is retained only as audit history. A later diagnostic
split proved that all 132 target records were canonical documents outside the
2026 period, not malformed selected targets. The 43 image blockers were empty
legacy strings, and the 23 zero-line records were legacy cart placeholders.
The planner and CLI were therefore narrowed and all range digests invalidated.

### Current W28 evidence - 2026-08-28

- Unit migration tests: 27/27.
- Complete migration-script suite: 50/50 after the final planner change.
- Firebase Admin contract tests: 2/2.
- Firestore emulator migration test: 1/1.
- Functions lint and build: passed.
- Both initial live invocations were read-only and reported `appliedWrites: 0`.

| Target | Plan digest | Source digest | Projection digest |
| --- | --- | --- | --- |
| `develop` | `abcc3cdc1c772be48dc73972c2e051817b8c19b9ca58bf431a52ad696366cd59` | `cb3bb27cd8a220e3004cd66f0b3b03ba47d1b0d13ee1f6507e8648c6b379bbe4` | `fb0bee0fd23f50453399e34ea2f30bfeaf772236fd994087c145a1e721b82bd5` |
| `production` | `fb9388130bc144701f4d3cd8bf7c7d381e5f42520ce930c60bbc383d1a55b668` | `cb3bb27cd8a220e3004cd66f0b3b03ba47d1b0d13ee1f6507e8648c6b379bbe4` | `fb0bee0fd23f50453399e34ea2f30bfeaf772236fd994087c145a1e721b82bd5` |

| Count per target | Value |
| --- | ---: |
| Source orders scanned | 21 |
| Source order lines scanned | 58 |
| Products scanned | 254 |
| Canonical target orders outside selected week | 16 |
| Selected target orders / lines | 0 / 0 |
| Empty legacy carts omitted | 2 |
| Planned order / line creates | 19 / 58 |
| Planned writes | 77 |
| Blockers | 0 |

The two omitted carts remain in the internal source/plan digest manifest and
are protected against exact-order, owner/week, and target-line races before
apply and during read-back; their identifiers are absent from the public JSON.

W28 develop was subsequently applied using the reviewed develop digest. The
owner then reported a manual spot-check of those records as correct in
principle; this supplements but does not replace the automated read-back. No
production Firestore write has been performed.

## 7. Authorized develop apply

- [x] Confirm the canonical migration contract; #270 delivery remains a
  separate repository consistency change.
- [x] Obtain a separate exact authorization for writes only to
  `develop/plus-collections/{orders,orderlines}`.
- [x] Recompute the plan and require the reviewed source/projection digest.
- [x] Apply bounded create-only transactions to develop: 19 orders and 58
  order lines, 77 writes total.
- [x] Read back counts, relationships, week, statuses, totals, and digests:
  19 selected orders, 58 selected lines, zero blockers and zero pending writes.
- [x] Repeat the develop dry-run and prove zero creates/conflicts. Its no-op
  plan digest is
  `9b6da0116a3505d99f6b7e91e1c7b0b4479ca12928af2cbc41c6b8da91c91cee`.
- [x] Confirm the source digest remains
  `cb3bb27cd8a220e3004cd66f0b3b03ba47d1b0d13ee1f6507e8648c6b379bbe4`
  and projection digest remains
  `fb0bee0fd23f50453399e34ea2f30bfeaf772236fd994087c145a1e721b82bd5`.
- [x] Present aggregate develop evidence before any production write.

### W29 develop apply - 2026-08-28

- [x] Dry-run one exact week with zero blockers: 19 source orders, 39 source
  lines, 4 empty carts omitted, 15 planned orders and 39 planned lines.
- [x] Apply the reviewed plan digest
  `c09abd9ed85742fc3393f43bb7febd01ed00de675f6d2bd9658ee698f6f48de6`:
  54 create-only writes.
- [x] Read back 15 selected orders and 39 selected lines with zero blockers and
  zero pending writes.
- [x] Repeat an independent dry-run with the same source digest
  `159215f5514c8e56917ed107a5e0c4bb2baf2ca393bb6d69e1b6fef9493eb708`
  and projection digest
  `05373c31d435f57e089c6d66ff41c74a4e175afc92f298a603c317202bbb6334`.
- [x] Record the W29 no-op plan digest
  `6c842cce9867ff9878871e7b9a6514a36c59df8c6f0bf38255dbb04474d0d4b1`.
- [x] Confirm no production document or W30-W34 resource was written.

### W30-W32 sequential develop applies - 2026-08-28

Each week was planned, applied, read back, and independently replanned before
starting the next one. All six verification plans returned zero blockers and
zero pending writes after apply.

| Week | Source orders / lines | Empty carts | Created orders / lines | Writes | Apply digest | No-op digest |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `2026-W30` | 25 / 75 | 3 | 22 / 75 | 97 | `7773e0df705f26dc3a5c26a6d8710b028584bbacede79b9301f1921ffbff8f1c` | `c40b0350b05816a5ebf68506f2fd05fe398a836b70c67a0974f603cfc0afc045` |
| `2026-W31` | 21 / 60 | 4 | 17 / 60 | 77 | `1d8042d4ebf7fdc6ad4f450a255fbb9719c3f317110fe6b486633a91b15e88e1` | `6e3904f2da51e6660ff62476db769387467038ecbe8ab59afce25243f3b5614d` |
| `2026-W32` | 18 / 18 | 1 | 17 / 18 | 35 | `28d05a86e8c07f92e0b92c537849c0e80c10cccf61525b97400a2b3b67d4d9c4` | `ddd124be1b305a533b18b2b61796902c98d59d2bcc49c88d1cb315bdb1391b35` |

- [x] W30 source/projection digests:
  `335921b316374e0b833fce237de59f38d8905e096a95c55bd2e403397cc9f655` /
  `f73549dcf59480f8483726e2e1b266ffbad626f92d8d18217f977224f1ec233e`.
- [x] W31 source/projection digests:
  `f1792f7a1d76b41e7f086f5f76580383b533863e0f3689eec4a79e6833d6905a` /
  `0b0d6b418f58f48a3b2b0dfbe38a1befdae27ef9c35491d4eca53dea079dd9f7`.
- [x] W32 source/projection digests:
  `a7a4220f16319ee86af637f203939a9e61de2435bf2388dce7959ae4719974c6` /
  `cb951f0863b0a9d54e3a807d1c7149dcc0ce8e97d304f9c41c95b9fa2608c1d3`.
- [x] Aggregate W30-W32: 56 orders, 153 order lines, 209 writes, 8
  empty carts omitted, and zero blockers.
- [x] Cumulative W28-W32 develop projection created by HU-086: 90 orders and
  250 order lines; 14 empty carts omitted.
- [x] Confirm no production document or W33-W34 resource was written.

### W33-W34 develop closure - 2026-08-28

- [x] Apply W33 with reviewed digest
  `044ef613308ca33472db4859b9f374924c2b8abd09038a2131b33380e328688a`:
  17 orders, 52 lines, 69 writes, 5 empty carts omitted, and zero blockers.
- [x] Verify W33 read-back and independent dry-run with no-op digest
  `909c8a15c810f67c1de690cc47d40471ee42f9cccdf75724f2eeda997fc1763a`.
- [x] Stop the first W34 dry-run on one two-document duplicate owner/week
  group; confirm `appliedWrites: 0`.
- [x] Diagnose the group read-only and PII-free: both documents had zero lines,
  zero subtotal, identical owner/display identity, and creation times 17
  seconds apart.
- [x] Permit only duplicate groups whose every raw `orderId` line membership is
  empty; digest every member and guard the complete group in one bounded
  transaction. Keep all mixed/non-empty duplicate groups blocking.
- [x] Validate the correction: focused unit 27/27, complete migration suite
  50/50, Firebase Admin contract 2/2, emulator 1/1, lint/build passed, and
  independent review found no P1/P2.
- [x] Apply corrected W34 with digest
  `45c968c8cd33ad2ff1e1aabda9de50657b27ff52bd8ad760a72e23fdfe5d1454`:
  14 orders, 16 lines, 30 writes, 6 empty carts omitted, and zero blockers.
- [x] Verify W34 read-back and independent dry-run with no-op digest
  `a8e57b0d9f8744589c8ddc4a7926dde7d8720daf9a8b9c30402481f2c9ec17aa`.
- [x] Sweep W28-W34 read-only: every week reports zero blockers and zero
  pending writes.
- [x] Final develop aggregate: 121 orders, 318 order lines, 439 create-only
  writes, and 25 empty carts omitted.
- [x] Confirm no production document was written.

## 8. Authorized production applies

### W28 production apply - 2026-08-28

- [x] Obtain exact authorization for W28 writes only to
  `production/plus-collections/{orders,orderlines}`.
- [x] Recompute a fresh zero-blocker plan and apply reviewed digest
  `fb9388130bc144701f4d3cd8bf7c7d381e5f42520ce930c60bbc383d1a55b668`.
- [x] Create 19 orders and 58 order lines in 77 writes; omit 2 empty carts.
- [x] Read back 19 selected orders and 58 selected lines with zero blockers and
  zero pending writes.
- [x] Repeat an independent production dry-run with no-op digest
  `57ad672336029f1e6c680ef3d2a263aa39e46be16aea0220ece034bfc72549b1`.
- [x] Verify unchanged source/projection digests:
  `cb3bb27cd8a220e3004cd66f0b3b03ba47d1b0d13ee1f6507e8648c6b379bbe4` /
  `fb0bee0fd23f50453399e34ea2f30bfeaf772236fd994087c145a1e721b82bd5`.
- [x] Confirm no production W29-W34 resource was written.

### W29-W31 sequential production applies - 2026-08-28

Each week was planned, applied, read back, and independently replanned before
starting the next one. Every post-apply verification returned zero blockers and
zero pending writes.

| Week | Source orders / lines | Empty carts | Created orders / lines | Writes | Apply digest | No-op digest |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `2026-W29` | 19 / 39 | 4 | 15 / 39 | 54 | `2de8ce256886d179d8dc79fe8c93a2a1911999730c576162bd48be64880f42ac` | `54b34676c6df2b105e302ec779f43e77f0375fcd6b8f0d9b95c2e31b88871bda` |
| `2026-W30` | 25 / 75 | 3 | 22 / 75 | 97 | `8bbecb1570df83b58359499e7f2a583b565c58cb2d6e54c018c2ca9379f40b5f` | `b0a0f0a023a5d201ee0bd974702de6daae22f918797de4bc6202cd0d0fc93215` |
| `2026-W31` | 21 / 60 | 4 | 17 / 60 | 77 | `9fc83f5cd53b603ac6b3d9d9975efa96f18a781953a82a715ed11ebb4a8b6df5` | `759cfbfbf8a950ceb96dcfff6a704af7a3796caf036e18e9d2af45143e8a80b1` |

- [x] W29 source/projection digests:
  `159215f5514c8e56917ed107a5e0c4bb2baf2ca393bb6d69e1b6fef9493eb708` /
  `05373c31d435f57e089c6d66ff41c74a4e175afc92f298a603c317202bbb6334`.
- [x] W30 source/projection digests:
  `335921b316374e0b833fce237de59f38d8905e096a95c55bd2e403397cc9f655` /
  `f73549dcf59480f8483726e2e1b266ffbad626f92d8d18217f977224f1ec233e`.
- [x] W31 source/projection digests:
  `f1792f7a1d76b41e7f086f5f76580383b533863e0f3689eec4a79e6833d6905a` /
  `0b0d6b418f58f48a3b2b0dfbe38a1befdae27ef9c35491d4eca53dea079dd9f7`.
- [x] Aggregate W29-W31: 54 orders, 174 order lines, 228 create-only
  writes, 11 empty carts omitted, and zero blockers.
- [x] Cumulative W28-W31 production projection created by HU-086: 73 orders
  and 232 order lines in 305 writes; 13 empty carts omitted.
- [x] Confirm no production W32-W34 resource was written.

### W32-W34 production closure - 2026-08-28

Each week was planned, applied, read back, and independently replanned before
starting the next one. Every post-apply verification returned zero blockers and
zero pending writes.

| Week | Source orders / lines | Empty carts | Created orders / lines | Writes | Apply digest | No-op digest |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `2026-W32` | 18 / 18 | 1 | 17 / 18 | 35 | `2fe681d3dbca1b178d4c7ae46f2e75ad5b18cfc0bdc9b86297b701ed458dd1b0` | `680d68b30898633bb99758d72152e9292513fc48a905f686c89537432f1a6b2d` |
| `2026-W33` | 22 / 52 | 5 | 17 / 52 | 69 | `e7fbee6c9a7dfe34f4a7574f1dd064444c040a869675a86a328877cd5bae304d` | `f195823a290541d1b5a9d9636b8cee762529735ee0fc580e626840931c7e0fc0` |
| `2026-W34` | 20 / 16 | 6 | 14 / 16 | 30 | `71b22bd76c5d24298357327e3fc5ab9e29182026c70e13450cef3daa64111a6b` | `3c4e6db8a03e607d2bf3c0e82c963b2adcac12d1d6bbdeda377ecfa0dd4e053a` |

- [x] W32 source/projection digests:
  `a7a4220f16319ee86af637f203939a9e61de2435bf2388dce7959ae4719974c6` /
  `cb951f0863b0a9d54e3a807d1c7149dcc0ce8e97d304f9c41c95b9fa2608c1d3`.
- [x] W33 source/projection digests:
  `59e9ae5352e169b29153863ca8180264fa5792f3b768b08eaf06933741425e99` /
  `8bc9c7662347d5c45fbc57d775187ab77d6299d27d3389f6d853337fb2ace07c`.
- [x] W34 source/projection digests:
  `0a4d7ca8c35c0b8e5f07915c6860151e57e2f22093e73819f085af87e68c4485` /
  `6882a5aa0c0ca734197ea59c483f5141fc5d2f38a2a5b4205aacf93126ba7eb1`.
- [x] Aggregate W32-W34: 48 orders, 86 order lines, 134 create-only
  writes, 12 empty carts omitted, and zero blockers.
- [x] Sweep W28-W34 read-only: every week reports zero blockers and zero
  pending writes.
- [x] Final production aggregate: 121 orders, 318 order lines, 439 create-only
  writes, and 25 empty carts omitted.

## 9. Documentation and closure

- [x] Update the task ledger with local validation evidence.
- [x] Update #271 with corrected scope and aggregate live evidence.
- [x] Confirm no Rules, deployment, mobile, legacy-source, or out-of-period
  resource changed.
- [x] Review Android/iOS compatibility and report that no platform source was
  modified.
- [x] Prepare focused commits and PR #272 after separate authorization.
- [x] Close #271 only after every acceptance criterion and live gate is
  complete.
- [x] Create HU-087 / #273 for the temporary W35-W36 bridge.
- [x] Create HU-088 / #274 for the W01-W27 empty-projection reconciliation,
  explicitly excluding 2025.
