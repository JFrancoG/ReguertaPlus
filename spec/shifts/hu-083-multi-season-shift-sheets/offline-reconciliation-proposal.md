# Cut 28 offline reconciliation proposal — 2026-09-11

Status: **develop workbook rebuilt under explicit maintainer authorization**;
the backend import rehearsal passes in emulation; live source synchronization
and cut-28 acceptance remain open. The maintainer
confirmed that the previous develop turns were disposable test data and authorized
rebuilding/renaming develop while protecting production. Earlier pending-data
questions below are retained as the audit history, not additional approval gates.

## Authorized develop rebuild — completed 2026-09-11

- Created a native full-workbook backup before changing the original. Read-back
  verified all four populated tab rectangles including values, formats, notes,
  validation and rich-text/chip fields. Backup permissions show only its owner.
- Preserved the configured develop workbook ID and its original owner/two writers.
  Renamed it `Regüerta — DEVELOP — Turnos de prueba` and set `Europe/Madrid`.
  The connector's metadata rename lacked file authorization; the owner completed
  the same authorized rename through the native Sheets UI, without new grants.
- Used native cross-workbook sheet copies from the supplied isolated reference;
  verified all four copies before deleting the two obsolete develop future tabs.
  No Sheets values were regenerated from inferred historical rotation ownership.
- Named the four copied tabs using HU-083's existing canonical routing:
  `turnos-reparto 2026-27`, `turnos-mercado 2026-27`,
  `turnos-reparto 2027-28`, `turnos-mercado 2027-28`.
- Preserved the two 2025–26 historical tabs, their IDs and bounded cell contents.
  Their original order moved behind the four current rehearsal tabs.
- Preserved 72 reference turns: 52 delivery/10 market in 2026–27 and two
  delivery/eight market in 2027–28. All 54 delivery round annotations remain.
- Resolved all 108 participation slots to 27 distinct active eligible develop
  users by **exact display name**. The reference phone columns were empty; they
  did not corroborate identity. Filled only those 108 phone cells from each
  matched user's canonical phone field, using the same field priority as the
  existing source adapter. No user, role or active status was changed.
- Final cell read-back matches the expected native copies plus exactly those
  phone additions; historical values/formats are unchanged. Visually inspected
  all four changed tabs at 100% zoom. The reference's modification timestamp
  remains unchanged. No production workbook was accessed or changed.

Private receipt SHA-256:
`0f99455737a4361b30f98ab04ff893792dfee7f58a71ba5c32c67c78b3aa5131`.
Raw IDs, phone values and backup references remain outside Git/the issue.

### Backend import rehearsal — completed 2026-09-11

Ran the existing transactional Firestore import implementation against a local
Firestore emulator, using the four rebuilt develop tab snapshots and all 48
captured users. All 32 eligible members remain in the synthetic rotation cohort;
the 27 reference participants remain the initial effective assignees. None of the
five additional eligible members was disabled or excluded.

The initial planning state, ownership, cursor, completion and activation terminal
are explicitly **new emulator fixture data**, built with the existing contract
builders. They do not establish historical lineage, execute a real activation or
provide a migration plan for the 62 legacy develop documents. Sheets/Drive calls
use the existing stateful API fixture populated from the actual read-back.

Verified in one successful executable rehearsal:

- Initial prepare detects 53 missing helper names in readable delivery cells.
  Apply/write-back fills them in the simulated workbook while preserving all
  effective assignments, helper identities, ownership and completion. Prepare
  itself does not change public shift documents.
- The normalized baseline prepares as unchanged across all 72 turns.
- A `Lo hace` instruction on 2027-09-01 selects an eligible member outside the
  reference's 27 participants. Exactly that delivery and its 2027-08-25
  predecessor change; the predecessor receives the replacement helper.
- The other 70 public documents remain exactly unchanged. Ownership and completion
  remain unchanged on both affected documents. Apply replay is recognized;
  write-back updates the name and clears the instruction, and the next prepare
  is unchanged.
- All 48 user documents remain identical; the notification-event collection
  remains empty. This Admin SDK rehearsal runs without Functions triggers or
  restrictive Rules, so it does not validate deployed notification suppression,
  client authorization or mobile read-back.

Private aggregate receipt SHA-256:
`d759148390d4b67c3eec2d2b9546ce2d246027644509ef3a5fdbad689f4a3e0e`.
The private runner/input/receipt remain outside Git because the captured fixture
contains member data. No production code changed; full build/lint/mobile suites
were not repeated for this evidence/documentation step.

### Disposable-source replacement and inverse — rehearsed 2026-09-11

Import evidence is committed/pushed as `cbd9a55`. The next bounded operation
verified the retained capture generation/SHA-256 and prepared a private exact
forward/inverse **emulator-only replacement candidate**. The ordinary repair
materializer still rejects the legacy schema; it was not weakened. A private
loopback-only runner uses existing canonical payload/rotation builders and native
Firestore transactions to test replacement of the obsolete test dataset.

| Operation | Verified emulator result |
| --- | --- |
| Forward | One transaction: delete 62 captured legacy shifts, create 72 canonical shifts and five private planning documents; 139 writes |
| Inverse | Restore all 62 original payloads, remove all 77 newly created documents; exact field read-back |
| Preserved | All 48 current user documents and four captured calendar documents |
| Rejection | Duplicate forward; unexpected extra public document; original payload restored after an intervening write but with a newer service update time |

Inverse restores fields and absence, not Firestore-generated update times. Its
preconditions are bound to forward read-back. After the deliberately injected
drift test, the runner explicitly verifies identical payloads and captures new
update times before the final inverse; it never silently relaxes a stale guard.

This candidate starts a **new test scenario**: all 32 eligible UIDs in stable
sorted order, round 1/index 0, consuming 54 positions per rotation while retaining
the supplied 27 effective assignees. Initial completion is explicitly uncompleted
fixture state. It neither reconstructs historical ownership nor proves an actual
bootstrap/activation. The five private documents use emulator operation identity
and synthetic workbook version `100`; they are not approved live authority or a
final migration baseline. No user record or historical payload is rewritten to
make the ordinary parser accept it.

Private candidate plan digest:
`shift-planning:v1:sha256:6cf64b9aa8b024e224339e02dbde1b0b93903c1a9554e2a656a448ce527d85db`.
Private receipt SHA-256:
`368b0c09cc395858695607cf679855625be8e8d01e954326a8f6990393bfbfdc`.
Captured member data and exact writes remain outside Git and the issue.

### Deployed-writer compatibility — live apply gate fails

Read-only Firebase metadata and generation-pinned deployed source retrieval
confirmed six relevant Functions are ACTIVE: shift writes, calendar writes,
planning requests, import HTTP, export HTTP and notification events. All six
retrieved source archives have SHA-256
`07cd231c91df1e7bd31ab6a9f6a711559536aca3e7de697e641628d6c8216b49`.
Their deployed updates are dated 2026-04-07; this is direct deployed-source
evidence, not an inference from the current branch or an old inventory.

The actual deployed `onShiftWritten` handler ignores deletions, `google_sheets`
source and non-confirmed turns. It does **not** read the new maintenance authority
or recognize canonical backend-mutation markers. A local test double executed
that exact compiled handler: 72 planned creates, 62 legacy deletes and 62 legacy
restores perform no I/O, but confirming a canonical `source=app` turn reaches the
legacy writer. The test intercepted its first Sheets call; no Google write or
notification was sent. No maintenance-state read occurred. This distinguishes a
quiet initial write from a safely usable final state.

The old writer uses `syncMeta.sheetName` or configured fixed ranges. Planning
still rewrites seasonal sheets; calendar handling and the HTTP import/export
paths also lack the new maintenance/provenance contract. Creating only a
maintenance document would therefore not contain the deployed system. No
production workbook/data, IAM, Functions, Rules or live Firestore document was
modified. Access was limited to develop's retained capture and deployment metadata
/source archives; the auditor stayed revoked.

### Remaining backend boundary

The 139-write candidate and inverse pass locally. **Do not apply this fixture to
live develop:** source revisions/complete inventory need a fresh bounded check,
operational rotation/baseline authority remains to be materialized, and deployed
writers/clients are not contained. The old 62-document live source has not been
replaced and no live helper-cell normalization has occurred.

The recommended route is the existing HU-085 deferred activation handoff, with
these exact reset/inverse findings and the deployed-writer blocker. Finish its
operational baseline/manifest and required app/equivalence evidence within cut 28;
then perform cut-29 acceptance. This rehearsal alone is not an accepted zero-write
deferral, mobile read-back or permission to deploy shared Functions/Rules. No new
implementation cut or generic legacy migration framework is introduced.

Validation: successful Firestore emulator forward/inverse with the three negative
cases above and exact deployed-handler probes. Rules, automatic trigger delivery,
FCM and mobile behavior were not exercised. No product code changed, so full
build/lint/platform suites were not repeated for this documentation/evidence step.

## Earlier offline capture review

The source-capture record was committed and pushed as `c219272`. Its frozen
backup remains unchanged and independently recoverable. The older observations
below concern that capture unless explicitly labelled as later live checks.

## Workbook clarification after maintainer correction

A bounded live connector check confirmed that both real member accounts flagged
as absent from the old develop workbook are present in the supplied isolated
production-like copy. Their delivery dates are 2027-01-13/2027-07-21 and
2027-01-20/2027-07-28 respectively; their market dates are 2027-01-16 and
2027-02-20. These observations match the maintainer's correction.

The configured develop workbook is still titled `Turnos Test 2025-26`; live
sentinel reads show different assignees on 2027-01-13/2027-01-20 and in the two
market months. The supplied reference is titled `TURNOS 2026-27 REPARTO Y MERCADO`.
The earlier absence counts apply only to the former workbook and must not be
presented as missing real assignments or defective user accounts. Admin/common
purchase manager roles are not evidence that an account is a test fixture.

No user record or workbook was changed. The source/reference distinction must be
resolved before selecting the develop rehearsal dataset; the old workbook's
roster differences are not themselves grounds to alter the real current season.

## Live roster recheck after maintainer corrections

At `2026-09-11T17:22:07.657Z`, a bounded read-only Firebase MCP check of
`develop/plus-collections/users` returned all 48 documents without pagination.
Only display name, roles, active status and common-purchase-manager status were
requested. Two reads returned identical projected fields and update times.
No IAM grant, auditor reactivation, source mutation or production read occurred.
This is an operator/MCP observation, not a replacement for the frozen backup.

The corrected roster has 42 active and six inactive users; 32 satisfy the existing
eligibility contract. The reported inactive-to-active correction is confirmed;
four previously eligible users are now inactive. All 48 projected records have
valid required field types, names and role combinations.

Against the **previously captured** 2026–27 sheets, five distinct assignees are
now inactive (ten participation slots) and seven currently eligible identities
are absent. The historical comparison has one remaining inactive participation;
this does not invalidate that historical assignment. Sheets, phones and other
Firestore collections were not reread in this check.

An active admin is not excluded merely by role. An active producer remains
eligible when `isCommonPurchaseManager=true`, as required by HU-082. Therefore
active test accounts with those settings participate in the current roster;
the maintainer must identify which are test fixtures before choosing the exact
rehearsal cohort. Do not silently alter the business eligibility rule to remove
them. Earlier counts below describe the frozen capture, not the updated roster.

## Verified reconciliation of the original capture

| Check | Result |
| --- | --- |
| Identity slots across four tabs | 156; zero phone/identity mismatches when the two pending name aliases are included as candidates |
| Name aliases | Two explicit candidate mappings, four cell references; candidates remain unapproved |
| Historical calendar | All four captured overrides match visible historical delivery dates after `Europe/Madrid` conversion, including two Friday exceptions |
| Future market | All ten dates exactly match `buildMarketSeasonDates(2026)` |
| Future delivery | Exact 44-date prefix of `buildDeliverySeasonDates(2026, "WED")`; eight July/August dates are absent |
| Future participants | Same 30 distinct identities across both tabs; 29 currently eligible, one inactive |
| Current eligible roster | 35 identities; six do not appear in the future tabs |
| Historical inactive participants | Five slots involving two currently inactive members; current inactivity does not invalidate historical assignments |
| Rotation authority | Neither rotation state is present; effective assignment order does not establish ownership, cursor or completion |

Missing delivery dates: `2027-07-07`, `2027-07-14`, `2027-07-21`, `2027-07-28`,
`2027-08-04`, `2027-08-11`, `2027-08-18`, `2027-08-25`. These are calculated
calendar differences, not proposed generated assignments or an approved horizon.

This is a bounded identity/calendar comparison, not a passing canonical import.
Two alias mappings still need confirmation. The current eligibility predicate
rejects seven visible participation slots, including two in the future season.
No member was reactivated, reassigned, removed or silently made eligible.

## Proposed treatment and decisions

1. Preserve all 62 legacy documents, all four calendar documents, and the four
   original sheets while reviewing the migration. Preserve annotations and
   assigned people; do not infer completion from past dates.
2. Review the two name-to-UID candidates privately. The historical candidate also
   matches its captured Firestore assignee. Add reviewed aliases to migration
   inputs if confirmed; do not silently rename users or spreadsheet cells.
3. Resolve whether the develop 2026–27 assignments remain the agreed reference
   or are obsolete test data. The inactive participant and six absent eligible
   members make this a real data decision. Do not silently prefer either the
   current roster or the visible sheet roster as historical rotation authority.
4. If these sheets remain authoritative, review the intended annual horizon and
   the original ordered roster/continuation boundary. The eight absent dates
   must not be assigned by guessing a cursor. If the sheets are obsolete, define
   an explicitly separate test scenario while preserving this capture.

The maintainer has been asked the reference-data question in item 3. The private
review contains the exact two aliases, affected cells, inactive member, six
absent members, calendar comparison and the 54 visible future assignments.
Its SHA-256 is `a512eb1a26904966f03b54cacfb0101f7a40381b29b1409adb4a245077f94066`. It contains member data and is deliberately
excluded from Git and the issue.

## Existing repair-tool boundary

`functions/scripts/repair-planned-shifts.cjs` binds its before-image through
`bindFirestoreCapture`, which requires existing origin, document/assignment
revisions and completion fields. The captured 62 legacy documents lack those
fields. It also requires resolved original bootstrap authority before producing
an exact plan. Therefore **the current materializer cannot directly migrate this
capture**, even after confirming the two aliases.

Do not synthesize a canonical before-image, assume assignees were original owners,
set fake historical revisions, or classify this existing rotation as truly new.
The chosen source-data treatment must first define an explicit legacy-schema
transition or a separate test scenario. This is an identified migration boundary,
not a reason to loosen the ordinary import parser or add another general repair
framework before the data decision is settled.

After that decision, finish the exact before/after materialization and inverse
rehearsal within cut 28. A live repair would still need containment of current
writers/triggers; an exact deferred handoff belongs to HU-085. No shared Functions
or Rules deployment, production mutation or cut-29 acceptance occurred here.

## Validation

The frozen backup generation/digest was verified. Offline assertions against the
existing compiled calendar functions pass for both types; all four calendar
records were compared in the same business timezone as the source adapter.
Identity checks cover all 156 visible slots, with pending aliases explicitly
separated from exact-name resolution. No production code changed, so platform
builds and the full regression suites were not repeated for this documentation
and private analysis. Previous test results remain dated evidence.
