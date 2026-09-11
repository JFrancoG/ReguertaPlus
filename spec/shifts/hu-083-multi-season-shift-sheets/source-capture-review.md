# Cut 28 source capture review — 2026-09-11

The maintainer explicitly authorized the concrete evidence-access proposal,
including its temporary database-wide read capability. Capture and revocation
are complete. **Cut 28 is still open for the exact migration/repair proposal and
reviewed repair-or-deferral outcome.** No live source data was modified.

## Capture and recoverability

| Evidence | Verified result |
| --- | --- |
| Target | `reguerta-9f27f`, default database, only the approved `develop/plus-collections` paths and configured develop workbook |
| Principal | Dedicated keyless `hu083-evidence-auditor` service account |
| Firestore snapshot | `2026-09-11T11:25:09.427819Z`; verification read at `11:25:10.496775Z` |
| Source stability | Identical document payloads/update times between reads; workbook version unchanged across capture |
| Documents | 62 shifts, 48 users, four calendar records; five state/rotation documents absent; no pending/processing sync command returned by the bounded query |
| Workbook | All four metadata-derived grids, within the adapter's tab/grid/cell limits; values and native structure captured, not only displayed text |
| Backup | Create-only object in the approved EU bucket, server-side encrypted, public access prevented, unlocked 30-day retention and deletion lifecycle |
| Capture SHA-256 | `a369eb56aca9e74f96d286cf64193612e0af1b3c7bc6e2f5706e669275714070` |
| Restore | Uploaded object fetched at its exact generation and digest verified; 114 documents restored into the loopback `demo-hu083-evidence` Firestore emulator, every field compared, five absent states verified |
| Final receipt SHA-256 | `ca6fe510419eea29128f5f1da19b6d780aa4a858c6075db7331f8ba98d50333c` |

The protected receipt records object generations, capture/restore provenance,
script digests, access-window timestamps and aggregated findings. Raw member
data, workbook IDs and private object references remain outside Git and the issue.
The restore verifies document contents; Firestore's service-managed creation and
update timestamps are necessarily newly assigned in the emulator. It is not a
forward/inverse repair rehearsal, Rules test or mobile acceptance test.

The isolated production-like copy remains a separate layout fixture. It was not
substituted for the configured develop workbook or used to manufacture source UIDs.

## Findings grounded in the captured data

1. **Develop Firestore contains only 2025–26 shifts.** There are 52 delivery
   dates through 2026-08-26 and ten market dates through 2026-06-20. All 62 records
   are `source=google_sheets`, `status=planned`, with the old payload shape. They
   lack origin, rotation ownership/positions, document/assignment/completion
   revisions and the governed mutation marker required by the new pipeline.
   All 62 reject the existing canonical public-shift parser. This is migration
   evidence, not permission to invent provenance or mark past shifts completed.
2. **The 2026–27 Sheets season is not represented in Firestore.** The future
   tabs contain 44 delivery dates (September–June) and ten market dates; all 54
   are absent from the captured source. The complete intended horizon and
   carryover must come from the reviewed calendar/rotation baseline, not an
   assumption that these visible dates are the full target.
3. **Rotation and activation authority are absent.** Neither `shiftRotations`
   document nor `shiftPlanningState/current`, `sourcePolicy` or `sheetsSubmission`
   exists. Effective assignees alone cannot supply original rotation ownership,
   cursor, approved historical membership or completion history.
4. **Two displayed-name aliases need reconciliation.** Four visible references
   have no exact normalized member-name match: `TORRE 2025-26!B63`,
   `turnos-mercado 2026-27!A47`, and `turnos-reparto 2026-27!B22`/`B44`.
   Each phone has one candidate in the captured users; the historical candidate
   agrees with its current Firestore assignee. These are candidates for an
   explicit alias mapping, not automatic name edits or proof of a changed person.
   The other 51 historical delivery and ten historical market assignments match
   by date and normalized name-to-UID resolution. This comparison does not claim
   the full import passes: the canonical source gate already rejects the legacy
   payloads, and the reader also validates phones, eligibility and calendar.
5. **Member/history boundaries remain material.** All captured assigned UIDs
   resolve to user documents; the current eligibility predicate returns 35 users.
   Current eligibility is not historical membership authority. The single null
   delivery helper is recorded without classifying the terminal boundary as a
   defect or inferring actual assistance from a planned assignment.

## Revocation and retained resources

The IAM grants were removed and the account disabled at
`2026-09-11T11:25:44.247Z`. A request using the issued token failed with HTTP 401
at `11:26:13.383Z`, before its `11:34:59Z` expiry. The temporary spreadsheet reader
was removed; connector read-back returned the original owner and two writers.
Project, account and bucket policy checks confirmed the exact added bindings were
gone and unrelated bindings preserved. No user-managed service-account key exists.

The two approved APIs remain enabled. The disabled account and retained evidence
bucket remain as documented; neither is an active source-reading workload. The
final receipt was written by the authorized operator after auditor revocation,
with create-only upload preconditions and generation/digest read-back. Existing
project administrators retain the inherited authority disclosed in the proposal.

No production documents, Auth users, user-device subcollections or notification
payloads were read. No Functions/Rules deployment, source repair, new planning
request or FCM send occurred. Spreadsheet permission changes necessarily change
file metadata; unchanged content evidence refers to the capture window, not to
an assertion that the permission operations leave Drive metadata unchanged.

## Next bounded operation

Later maintainer clarification identified the old develop schedule as disposable
test data. The explicitly authorized workbook rebuild is complete; see the latest
section of `offline-reconciliation-proposal.md`. This capture remains historical
evidence and must not be passed as the current workbook snapshot.

Offline reconciliation findings and the pending source-data decision are now
recorded in [the reconciliation proposal](offline-reconciliation-proposal.md).
The existing repair materializer requires a canonical before-image and cannot
directly bind the captured legacy payloads.

Complete the exact offline proposal from this frozen capture: explicit mappings
for the two name aliases, approved rotation/calendar/bootstrap inputs, treatment
of legacy historical records, and the 54 visible future rows absent from source.
Preserve historical assignments and existing annotations. Do not fabricate
completion, original ownership or revision lineage to satisfy a parser.

Then run the existing audit/materializer and exact forward/inverse rehearsal
against that reviewed proposal. Source writer/trigger containment and any live
repair authorization remain separate; without containment, hand the exact
materialization to HU-085. The source capture alone is not a completed zero-write
deferral and does not advance HU-083 to cut 29.
