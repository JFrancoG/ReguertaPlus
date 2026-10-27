# HU-084 controlled develop migration rehearsal

The content preparation is delivered as `73001988`. The following implementation
and acceptance remain local after that checkpoint. They introduce no shared
endpoint, production operation or alternate planner/parser.

## Fixed local boundary

`functions/scripts/rehearse-develop-shift-migration.cjs` constructs an SDK client
only for `demo-reguerta-hu084-migration` at `127.0.0.1:8798`, after validating the
exact environment and prepared digest. Direct CLI execution is rejected. The
runner composes existing barrier, transaction admission/notification fences,
publication, before-image, recovery and retention contracts. It does not call the
general activation runtime with a fabricated staged bundle, or relax the public
canonical parser to accept legacy ownership.

The private source files and reviewed semantic proposal are hash-bound before
seeding. SDK seeding necessarily assigns new service versions; the clone is read
back and its own exact versions are captured for CAS. Original timestamp field
values and every raw field remain intact; live September/October CAS metadata is
never submitted to the emulator as though it were its service metadata.

## Accepted result — 2026-10-27

| Direction | Complete transaction | Estimated request bytes in the accepted captured-data run |
| --- | --- | --- |
| Forward | 203 writes: 62 immutable archives, 62 exact legacy deletes, 72 canonical creates, four control records, baseline, terminal and retention | 1,813,600 |
| Inverse | 140 writes: 72 canonical deletes, 62 exact legacy restores, three control deletes, closed current-state update, retained recovery terminal and retention | 530,196 |

Both budgets use `public-transaction-v2` and fit the existing 500-write admission;
the SDK commits each complete manifest as one transaction. This application
estimate uses **synthetic local index authority**, not measured deployed indexes.
No live transaction budget or operational permission follows from these values.

All 72 published dates and 108 ordered places match the proposal. Original
ownership is the explicitly declared synthetic develop mapping, not inferred
legacy history. Both stored continuations remain round 2/index 22. Local metadata
keeps the frontier before the first inherited season, with planning readiness
explicitly false: July/August 2027 Market gaps are not silently generated.

The inverse restores all 62 original payloads, retains archives/baseline/terminal
evidence and leaves maintenance **closed at write epoch 2**. It does not restore
the absence of security state or undo the security epoch. The 48 captured user
projections and four historical calendar sentinels keep their SDK versions.

Actual exported handlers verify 72 controlled activation events and 72 controlled
recovery events, with 36 first deliveries intentionally delayed until after
recovery. Duplicates add no ledger. The 62 raw retirements and 62 raw restorations
are separately verified **ordinary no-effect** events because of deletion/Sheets
origin. They are not called canonical controlled events. Google Sheets/Drive and
the actual FCM `send`, `sendEach` and `sendEachForMulticast` methods are trapped;
zero external calls or notification/credit effects occur.

The real Sheets reader/adapter on an in-memory captured workbook applies exactly
53 `F` helper cells and reverses their literals. Its two technical operation
markers are retained. The 399 existing literals, published order, terminal null
helper and observed historical-tab metadata remain intact. Replay, authorization
refusal, before-image drift, lost acknowledgement and ambiguous read-back are
tested. No formats, groups, native cell notes, historical grids or cross-service
atomicity are certified by this double.

## Repeat the checks

From `functions`, with Node 22 and installed dependencies:

```sh
npm run test:shift-planning:develop-migration
npm run test:shift-planning:develop-migration:emulator
```

The opt-in captured-data tests additionally need absolute private input/output
directories in `HU084_MIGRATION_EVIDENCE_DIR` and `HU084_MIGRATION_RESULT_DIR`.
With the fixed emulator already running, set `GCLOUD_PROJECT` and
`FIRESTORE_EMULATOR_HOST` to the exact values above and run:

```sh
node --test --test-concurrency=1 \
  test/acceptance/hu084-develop-migration.cjs \
  test/acceptance/hu084-develop-migration-sheets.cjs
```

Absent opt-in input means skipped private acceptance, not a passed source review.
Receipts contain counts/digests; raw captures stay private. Final acceptance:
build/lint, targeted CJS syntax/undefined/unused checks; **8 portable pure + 62
unchanged-contract regressions + 15 portable SDK + one captured-data SDK + five
captured Sheets cases = 91 passes**, zero skips/failures. The tests include ABA,
query phantoms, altered cohort/owner sequence, pending Sheets reservation,
conflicting workbook version, active notification fence, re-signed receipt,
barrier/journal failures and actual SDK commit acknowledgement loss. Uncertainty
keeps its incident and blocks resubmission even after the fixture TTL.

The accepted SDK receipt digest is
`shift-planning:v1:sha256:19c123c1088fd24aa0a8aec40d01a716f78deb896ae0a680a1392fedd0e0d776`.
The runner SHA-256 is
`d1d70062dd98ee8c23b5def79afd6bedaa6b0683b6500e0aa288fa3bc6565cdc`.

## Remaining shared handoff

HU-085 still needs the actual reviewed runtime operation, current operator and
index/Drive authority, writer containment/drain and post-drain backup, full
forward/inverse read-back packet and finite application authorization. The local
barrier, workbook counter and index authority do not prove those conditions.
The two missing market months and partial annual horizon remain visible. The
53-cell helper batch has only adapter-level captured-data acceptance; persistent
shared workbook exclusion is not newly certified here. Android/iOS are unchanged,
with no new parity gap or physical test. No maintainer/phone action is needed for
the completed local rehearsal.
