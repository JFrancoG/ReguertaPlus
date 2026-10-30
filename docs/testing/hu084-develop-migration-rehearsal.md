# HU-084 controlled develop migration rehearsal

## Evidence-bound review package — 2026-10-30

Previous evidence documentation is delivered as `3c06b28d`. The new local-only
`functions/scripts/prepare-develop-migration-package.cjs` composes the existing
census, eligibility, rotation-position and deployed capture-control checks. It
does not create a provider client or change the loopback-only rehearsal runner.
Inputs are thirteen retained JSON files, pinned by absolute path and SHA-256,
plus the independently reviewed content/proposal digests. An operator must select
those reviewed digests from the existing validation receipt, not recalculate
approval from an edited proposal. Private captures and generated packets stay
outside Git. Output is created exclusively with mode `0600`; an existing packet
is never overwritten, and there is no apply mode.

The accepted retained packet binds the atomic source observation of
`2026-10-30T06:48:26.324Z`, workbook version 278, 742 typed cells/notes, exact file
and parent permissions, 48 projected users, six READY indexes, reviewed Functions,
Rules/IAM and three paused jobs. It compares the cell image with the retained
owner-transfer image and normalizes only unordered provider event filters.
These are historical observations, not a held multi-service barrier; the earlier
automatic-access, queue and write-denial controls still need refreshing at admission.

The source-policy **binding** records those authorities, both unchanged rotation
queues/cursors, zero initial credits and no retained reserves. Its runtime policy
document stays null: annual continuity, inherited prefix and frontier have not
been admitted, and July/August 2027 Market gaps must not be invented. The 48-user
projection is sufficient to check the retained cohort, not to bootstrap all user
fields or notification destinations. Planning, coverage and notification replay
remain disabled. This binding is not written to Firestore.

The forward intent contains all 62 raw before-images with exact update-time
preconditions, their retirements, all 72 reviewed semantic creates preserving the
108 ordered places, and 53 exact helper-cell before/after literals. All 117 notice
documents are bound for preservation, with no replay. The inverse binds that
forward digest, restores every raw field and reverses those 53 literals; deleting
canonical rows requires the actual forward readback versions and payloads. It
retains archive/baseline evidence and technical Sheets markers, leaves security
state closed at epoch 2, and never restores the original absence of security
state. Service create/update timestamps cannot be restored. Existing transaction
shapes imply 203/140 writes, **not** a measured live byte/index budget or atomic
commit spanning Firestore and Sheets.

The packet is an exact captured-data/static-intent review, **not yet an executable
transaction manifest**. The runtime source-policy document, final markers and
timestamps, actual index budget, governed Sheets writer/markers, held refreshed
source versions, owner/admin agreements, and operation-specific ADR-0026 risk
acceptance remain explicit prerequisites. The inverse additionally requires the
actual forward receipt. No acceptance or window timestamps are fabricated.

Retained private acceptance: `2026-10-30-migration-package`.

| Binding | SHA-256 suffix after `shift-planning:v1:sha256:` |
| --- | --- |
| Complete review packet | `ee465d0e2adb646111336d19356d685196c49ed4954834d7e320eeec49d7ac75` |
| Forward static intent | `90793bc01d63c0a4f9922e4ed8529e72aaa38adad83304d061ccc69dad87bed9` |
| Inverse static intent | `fc1d2573b7ddb883e89257655a72734cc98aa3c6c996f228972242b02635a3f4` |

Validation: `npm run test:shift-planning:develop-migration-package` covers 83
passing local tests, including 19 new tests for lossless recovery, deterministic
binding, altered proposal/CAS/cells/cohort/permissions/controls/indexes, output
overwrite refusal and file-byte tampering. Functions build/lint and focused CJS
lint pass. Existing emulator tests were not rerun: no executor, barrier, app or
SDK mutation behavior changed. This does not certify live migration or recovery.
HU-084/HU-085 and draft PR #278 remain open; no native parity gap. Next materialize
and rehearse the closed runtime policy/manifests locally before seeking a window.

```sh
node scripts/prepare-develop-migration-package.cjs --input /private/manifest.json --output /private/review-package.json
```

The manifest has `files` (each entry `{path, sha256}`), `reviewedContentDigest`
and `reviewedProposalDigest`. File keys are `snapshot`, `sheetCells`,
`referenceCells`, `proposal`, `fileBefore`, `fileAfter`, `filePermissions`, `parent`,
`parentPermissions`, `indexes`, `controls`, `reviewedControls`, `assessment`.

## Earlier local rehearsal

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
