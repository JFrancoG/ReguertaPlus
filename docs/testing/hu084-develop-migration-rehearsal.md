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

## Closed policy and final local manifests — 2026-10-30

The review package is delivered/pushed in `e9fb31e5`. This new implementation
remains local. `materialize-develop-migration-package.cjs` verifies that exact
review packet against its thirteen pinned inputs and compares every original
payload with the freshly seeded/read emulator clone. Original service versions
are never submitted to the clone. Even timestamp rounding is rejected; Firestore
field timestamps have microsecond precision, while offline before-images retain
all supplied digits. No loss is silently normalized.

`closedDevelopInitialMigration` is an explicit closed source-policy record. It
binds the reviewed workbook/index evidence and disables planning, coverage,
credits and notification replay. Annual continuity, inherited prefix and frontier
remain null. The ordinary source producer rejects its distinct shape, including
when a local maintenance flag is accidentally opened. No annual parser was
weakened. Rotation metadata retains the existing closed-rehearsal 2025 sentinel,
explicitly not an admitted annual frontier. Replacing this closed policy with an
annual policy remains separate work.

The existing fixed-loopback runner now materializes a detached final transaction
using the existing public transaction serializer, then reconstructs it inside the
execution transaction and requires exact equality before any business write.
Closed mode requires this step in both directions. Each final manifest binds the
prepared digest, direction, held scope, concrete timestamps, full serialized
mutations and preconditions. Future timestamps or age above 60 seconds reject.
The inverse is materialized only from the actual forward readback receipt; no
future service versions are invented. Retained-operation replay still works
without resubmitting a final manifest. Barrier evidence may be recorded in the
local journal during preparation; no business document changes in that stage.

The runtime operation ID is explicitly lowered to `request-${reviewForwardId}`,
with that reviewed ID as requestId. The deterministic mapping is retained in the
prepared digest; the existing recovery identity contract is unchanged. Both
directions bind users, calendars, notices and config; new requests, credits,
reserves, memberships, cases, effects or sync/swap work prevent execution.

Private acceptance: `2026-10-30-final-migration`, against only
`demo-reguerta-hu084-migration` at `127.0.0.1:8798`. Concrete retained results:

| Artifact | SHA-256 suffix after `shift-planning:v1:sha256:` |
| --- | --- |
| Prepared clone | `4cf80f9b53f6898bcb6253abe52360c7d3e53994abd8c65ef012398791b097c2` |
| Final forward manifest | `d588a58b173da4bab8ec2b0ec5195bd4a16c3fe037b08dfb0aa7a53e97a5f8af` |
| Final inverse manifest | `41950f02de9a6849e6a64616d6ca73519fcf8358703e866d8c6d1e4bc19a60ab` |
| Sheets acceptance/manifests | `956899b9841043558abc7d2cd0fd007510009db5205a91e3cff20563657d396b` |

Forward commits 203 writes (application estimate 1,844,040 bytes); inverse commits
140 (532,726 bytes). Both restore/preserve the expected 62 originals, 72 published
rows, 108 positions, 48 users, four calendars and 117 notices without replay.
Recovery leaves security closed at epoch 2. These byte estimates bind the retained
index observation but are not provider wire/index measurements or live admission.

The existing Sheets adapter separately materializes and applies two exact batches
to an in-memory copy seeded from the current retained six-tab image: each has
53 helper-cell writes and two technical markers. Both batches bind the review,
prepared digest and local Firestore receipts. All 742 observed typed cells/notes
are restored; technical markers remain. Sheets metadata IDs and its version
counter are local, not current Google authority. Unobserved formatting/grids and
cross-service atomicity are not certified. No Google client is constructed.

Validation: 92 local tests + 39 Firestore-emulator tests + one retained-image Sheets
acceptance pass, zero failures/skips in their final runs; Functions build/full
lint, focused CJS lint and diff checks pass. Commands:

```sh
npm run test:shift-planning:develop-final-migration
npm run test:shift-planning:develop-final-migration:emulator
```

Private acceptance additionally supplies `HU084_REVIEW_MANIFEST` and
`HU084_FINAL_OUTPUT` to the emulator tests. The Sheets acceptance uses those plus
`HU084_MIGRATION_EVIDENCE_DIR` for the independently reviewed published mapping.
Outputs use exclusive creation/mode 0600 in a private directory; do not reuse an
output directory for another run. Clone versions make each rehearsal digest unique.

No shared executor/endpoint, deployment, real maintenance opening or production
access is added. This closes local materialization/recovery, not live activation.
Next connect the materializer to the controlled develop executor, prepare its
read-only admission checks and refresh authority before requesting a specific
owner/admin/risk window. Do not copy emulator receipts, timestamps or approvals
into that window. HU-084/HU-085 and draft PR #278 remain open; no native parity gap.

## Controlled develop composition and passive admission — 2026-10-30

The previous materializer is delivered/pushed in `9a83203f`; remote and draft
PR #278 head match. The following implementation remains local.

`develop-shift-migration-engine.cjs` extracts the existing serializer/barrier/CAS
runner without duplicating its algorithm. The original rehearsal wrapper still
requires the exact demo project and loopback host before constructing a client.
The new `controlled-develop-migration.cjs` accepts an injected Firestore client
pinned to `reguerta-9f27f`, database `(default)`, and hard-coded
`develop/plus-collections`. Shared preparation requires original reviewed service
versions, not clone versions. The policy context explicitly records
`controlled_develop_preparation`; the historical `localOnly` container name does
not imply emulator authority. No endpoint, deployment or apply CLI is supplied.

Passive inspection uses a read-only source transaction and existing held-control
readers. It neither acquires/closes controls nor persists incidents. Every report
keeps `canApply:false` and `canEnterMaintenance:false`; even `checksPassed:true`
is not authorization. Execution separately requires a matching, unexpired
inspection (maximum 60 seconds), reconstructs the exact manifest and rechecks
current source versions, owner/admin observations and the existing held barrier.
The inverse requires the actual forward receipt. Execution failures retain the
existing incident behavior; passive failures cannot claim durable incident evidence.

**Real read-only result: blocked, correctly.** Existing CLI authorization was used
only for develop Firestore reads. The retained packet reviewed `config/global`
only, while the real collection also contains `config/member` and `config/public`.
Global's payload and update time still match exactly. This is an incomplete source
census, not evidence that global changed. Admission returns `source_not_verified`;
no complete source match or held window is claimed. Each diagnostic transaction
was explicitly read-only; zero control reads, control-close calls or write attempts.
An initial REST/auth-library mismatch failed before useful verification; the private
harness then reused the SDK's own compatible auth library, without changing project
dependencies or granting permissions. Failed observations are retained separately.

Local validation: 102 unit tests and 47 SDK-emulator tests, zero failures/skips;
Functions build/full lint and focused CJS lint pass. The retained-input controlled
roundtrip uses the same 203/140 mutations, restores all 62 originals and preserves
117 notices. Passive snapshots, including service versions, stay unchanged.
Missing/invalid held controls, changed human observations, late writes, expired
inspection and the observed extra-config condition block. No native changes/parity
gap. The previous captured-image Sheets acceptance is unchanged and not rerun;
this new composition does not establish live Sheets writer authority or atomicity.
Private evidence: `2026-10-30-controlled-executor` (final emulator run in `final/`).

Next refresh the exact source census to include and review both additional config
documents, regenerate the bound package and repeat passive admission. Then bind
current technical control readers, Sheets destination/writer authority and explicit
owner/admin/risk agreements for a separately authorized window. No approval is
needed from the user for the current local block. Maintenance remains unopened,
with no shared business writes, Sheets writes, notification, deployment or production
access. HU-084/HU-085 remain open; PR #278 stays draft.
