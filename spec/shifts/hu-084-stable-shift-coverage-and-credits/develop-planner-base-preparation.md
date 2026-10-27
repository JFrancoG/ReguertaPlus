# Develop planner base preparation — 2026-10-27

Status: **content proposal prepared; shared initialization remains closed**.
The maintainer requests preparation preserving published dates and order after
delivering the initial-state implementation as `537188bd`. This is read-only
develop evidence and offline content validation, not an execution of the old
HU-083 reset or a HU-085 activation command.

## Fresh source comparison

Firebase MCP verifies project `reguerta-9f27f`. Bounded reads inspect the develop
public shifts, selected user fields and five exact planning-state paths. Google
Drive reads metadata first, then all four current seasonal grids within their
observed bounds (1,000 rows × 26 columns each). No production, Auth account,
device token or credential data is accessed.

| Source | Observed result |
| --- | --- |
| Current workbook | Four seasonal tabs plus two historical tabs in metadata; 399 populated literal cells across the four seasonal grids match the retained HU-083 input |
| Delivery 2026–27 | 52 published dates, 2026-09-02 through 2027-08-25 |
| Delivery 2027–28 | Two published dates, 2027-09-01 and 2027-09-08 |
| Market 2026–27 | Ten published dates, 2026-09-19 through 2027-06-19 |
| Market 2027–28 | Eight published dates, 2027-09-18 through 2028-04-15 |
| Current roster | 48 users; the same 32 eligible IDs as the corrected HU-083 scenario; 27 distinct effective assignees across the 108 published places |
| Current Firestore | 62 legacy 2025–26 shifts: 52 delivery and ten market; none of the 72 later published shifts is present |
| Planning authority | `current`, `sourcePolicy`, both rotations and `sheetsSubmission` are absent |

The current legacy document IDs and business fields equal the retained capture,
including ordered assignees, date, helper, source, status and `createdAt`. All 62
server update times have changed; full payload comparison identifies only
`syncMeta.importedAt` and `updatedAt` changes. September CAS guards and before-images
must not be submitted as current authority. Fresh full shift images are retained
privately for this preparation; they are not a post-drain backup.

The current user comparison is against the **corrected 32-member HU-083 input**,
not the older pre-correction capture. No user activity or role is repaired here.
Phone comparison covers the selected `phone`/`phoneNumber` fields; this is not a
fresh complete user import or an audit of every possible legacy contact alias.

## Prepared content and preservation rules

Reuse the explicitly approved **synthetic develop scenario** retained by HU-083.
Its declared ordinary owners are separate from the published effective assignees;
they are not reconstructed from historical replacements or declared valid for
production. Resolve its stored approved mappings with the existing
`resolveShiftRotationBootstrap`, then validate the stored positions/cursors with
`consumeRotationPositions`. Do not sort the current roster to invent a new queue.

- Preserve all 72 published dates and ordered assignments, including the three
  distinct positions inside every market block and the continuation into 2027–28.
- Preserve the existing visible annotations and phones. Keep the readable,
  editable layouts; no canonical-column conversion or workbook replacement.
- Retain the approved 32-member cohort in each independent rotation. Each has
  consumed 54 positions; the stored continuation is round 2, next index 22
  (zero-based). This describes the supplied published set, not a newly generated
  complete annual horizon or permission to advance a live frontier.
- Retain planned/uncompleted semantics from the reviewed test scenario. A past
  date does not prove service, create compensation or declare permanent departure.
- Keep all 62 legacy records in the source inventory. The old 139-write reset
  deletes them and is **not** the execution plan for this preparation.

The private proposal contains semantic projections, owner/position evidence and
continuation cursors. Historical operation IDs, mutation markers, commit times,
epochs and active revisions are not new runtime authority. The proposal is not
a write manifest and has `liveExecutable:false`.

## Differences that remain visible

**Helpers:** all 54 current delivery `Ayuda` cells are blank. The reviewed
canonical scenario has 53 helpers (the next published effective lead) and one
terminal null. Keep the explicit 53-cell helper projection proposal separate
from the unchanged published dates/assignments; do not call this a clean
cross-store audit or invent actual completed assistance. No cell is changed now.

**Market horizon:** July and August 2027 are absent. HU-083's full-season target
expects those two months. Do not silently generate them, mark the inherited
season complete, or consume extra positions and move the existing continuation.
A later reviewed preview must resolve those gaps while preserving the inherited
dates and ordered assignments.

**Legacy representation:** the 62 old payloads lack the canonical ownership,
completion/revision and mutation-provenance contract. Four private configuration
documents, or appending 72 rows beside them, cannot make the HU-084 initializer
ready: it validates the entire public source. Their treatment needs the exact
governed migration/recovery plan; effective assignees are not original-owner proof.

**Capture and runtime:** the Drive connector returns no numeric workbook version,
even when requested. Do not substitute a simulated counter or run audit v2 as
though its version binding existed. Literal equality is proven for the captured
content only; format/group equality, concurrent-writer containment and post-drain
stability are not established. Actual Drive/version and index/admission authority,
writer drain, bounded forward/inverse manifests and read-back remain HU-085 gates.

## Evidence and next operation

Private captures, comparisons, semantic proposal, validation receipt and their
digests remain outside Git. No raw member export, workbook ID/URL or protected
artifact reference is copied into public tracker evidence. The comparison uses
the existing parsers/contracts; no new parser, planner or live apply endpoint is
introduced for this preparation.

Functions build and lint pass under Node 22.23.4. The focused eligibility,
planning-contract/wire, rotation-bootstrap and initial-state suites pass **47/47**
with no skips or failures. Offline validation checks the supplied canonical
content and state contracts separately from live readiness: 72 canonical row
templates, both stored approved mappings and authority-template shape pass the
current contracts. Repeating preparation produces identical proposal bytes.
No emulator or new native run is claimed; Android/iOS code is unchanged.

The semantic content digest is
`shift-planning:v1:sha256:36f53c5e1391e244383fb109920c697d0e7dc6717afa2e1bc558a1e1120f665f`;
the private validation receipt digest is
`shift-planning:v1:sha256:3f496ae6ba6382c0f9cbe7ceb677144639e11b496c5283292947fb68e09cf65a`.
These bind the proposal and its validation, not a future runtime commit.

Next: construct and rehearse the exact governed develop migration and inverse
from a fresh contained source, with the legacy treatment, helper projection and
market gaps explicit. Only then review its finite application handoff. Keep
HU-084/#268, draft PR #278 and HU-085/#269 open, and `operationalReady:false`.
The maintainer's zero-credit/no-known-reserve answers remain recorded; no phone
or additional member declaration is needed for this preparation.
