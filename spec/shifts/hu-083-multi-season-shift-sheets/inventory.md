# HU-083 — read-only workbook layout inventory

Observed on 2026-09-08 through the authorized Google Drive connector. The target
was resolved from the original checkout's `SHEETS_SPREADSHEET_ID_DEVELOP`;
no workbook identifier, participant name, phone number, or credential is copied
into this document. No file, cell, sharing permission, or Firebase resource was
changed. This is a bounded layout inspection, not a recoverable backup or the
reviewed source snapshot required for repair.

## Observed workbook and tabs

The file is a native spreadsheet titled `Turnos Test 2025-26`, locale `es_ES`,
with workbook time zone `America/Los_Angeles`. Its reported last modification was
2026-08-23T12:23:06.633Z. Drive reports one owner and two user writers; effective
authority, transitive access, offline edits and writer drain are not established.

| Tab | Allocated grid | Last populated row in A1:K180 | Observed dated shifts |
| --- | --- | --- | --- |
| `TORRE 2025-26` | 1006 × 25 | 66 | 52 delivery dates, September–August |
| `MERCADO 2025-26` | 998 × 26 | 52 | 10 market dates, September–June |
| `turnos-mercado 2026-27` | 1007 × 26 | 60 | 10 market dates, September–June |
| `turnos-reparto 2026-27` | 1000 × 26 | 56 | 44 delivery dates, September–June |

The first row is a display title, not the new adapter's technical header. Delivery
uses one row per date with person, phone and other human columns; month headings
interrupt the rows. Market uses a date heading followed by participant rows.
The historical and newer market block spacing differs. No formula or cell
validation was returned within **A1:K180** of these four tabs. This says nothing
about cells outside that rectangle. Protected ranges and complete merge metadata
were not exposed by these connector responses and remain unverified.

## Consequences for implementation

- New canonical titles match the existing `turnos-reparto YYYY-YY` and
  `turnos-mercado YYYY-YY` pattern. The explicit 2025 aliases are `TORRE 2025-26`
  for delivery and `MERCADO 2025-26` for market.
- All four existing tabs require a reviewed layout mapping. Merely configuring
  aliases must not let the new adapter overwrite their title or human columns.
  The adapter's header rejection is therefore required for this actual workbook.
- Keep dates as calendar dates. The workbook's reported time zone must not shift
  the season boundary through implicit UTC/local conversions.
- A bounded inspection confirms the 2026 delivery projection ends on June 30,
  while the historical season extends through August. Correct repair still needs
  the Firestore baseline, ownership evidence and the complete audited snapshot.
- The visual contract for newly generated tabs must be settled before wiring
  export/import. A uniform row per shift and preservation of the existing human
  layout are different presentation contracts; do not silently convert history.

## Remaining evidence gates

Complete used-range/protection/merge inventory, deployed parameter presence,
effective principals, exact Firestore/workbook baseline and digests, encrypted
backup destination/ACL/retention and restore rehearsal remain pending. Their
temporary evidence auditor is specified in `spec.md`; it has not been created
or verified. An administrative `gcloud` account-list attempt could not run because
no active CLI account is selected. That failure does not prove the auditor is
absent and does not invalidate the authorized connector layout reads above.

## Cut 28 access checkpoint — 2026-09-09

Cut 27 is committed and pushed as `a1ef9ca`. Cut 28 has started; source capture,
exact repair and accepted zero-write deferral are **not complete**.

Read-only checks in this window:

- Both checkouts resolve the shared project `reguerta-9f27f`. Firebase MCP is
  authenticated against that project and attached to the original checkout.
  `gcloud auth list --format='value(status)'` succeeds with no account rows.
  This is a CLI credential gap, not a Firebase authentication failure or proof
  that a suitable auditor does not exist.
- The develop workbook parameter resolves uniquely in the original checkout.
  A metadata-only Drive read confirms the same native workbook/title and
  `2026-08-23T12:23:06.633Z` modification time. Permissions returned are one
  user owner and two user writers; the connector can share the file. No group
  or domain grant was returned. This does not establish transitive authority,
  offline activity, complete content equality or a recoverable backup.
- Firebase's deployed-function inventory contains `exportShiftsToGoogleSheets`,
  `syncShiftsFromGoogleSheets`, `onShiftWritten`,
  `onDeliveryCalendarOverrideWritten`, `onShiftPlanningRequestCreated` and
  `onNotificationEventCreated`, all v2, Node.js 22, `europe-west1`.
  Names/runtime alone do not attest deployed source revisions, trigger filters,
  writer exclusion or effective notification suppression.

No Firestore document read, workbook cell read/export, source mutation, IAM or
sharing change, backup creation, deployment or FCM send was performed in this
window. Existing connector sessions are not substituted for the separately
bounded evidence auditor required by `plan.md` Phase 0 and `spec.md`.

### Required input before source capture

Identify an existing temporary keyless auditor (principal and invocation path)
and the encrypted evidence destination (resource, allowed readers, retention and
create-only access). If they do not exist, first prepare and review their concrete
provisioning scope; none is created or authorized by this checkpoint. Do not ask
for credentials or keys in chat. The current account's broader capabilities do
not establish the required bounded authority.

Once those references are available, verify the exact develop Firestore/workbook
read scope and negative permissions, capture the bounded baseline through that
identity, record digests/read times and restore provenance, then revoke/read back
its access. Use the existing offline auditor and materializer on that evidence.
Uncontained writers/triggers select exact HU-085 deferral only after the required
real baseline and unchanged-source proof exist. Waiting for access is not a new
cut, a completed deferral, or authorization to advance to cut 29.


## Additional test copy — 2026-09-11

The user supplied a separate copy owned by the test account. The latest supplied
URL was verified through Drive as native Google Sheets, titled
`TURNOS 2026-27 REPARTO Y MERCADO`; metadata returns one owner and one writer.
This is an isolated test reference, not the configured develop workbook or a
trusted Firestore baseline. Previous Excel/conversion links are superseded for
this test. No environment parameter or access grant was changed by the agent.

Metadata and bounded `A1:K180` reads succeeded for seven tabs: `TORRE 2025-26`,
`MERCADO 2025-26`, `RESUMEN 2026-27`, `TORRE 2026-27`, `TORRE 2027-28`,
`MERCADO 2026-27`, `MERCADO 2027-28`. Each grid has 1,000 rows and 26 columns;
locale is `es_ES`, time zone `America/Los_Angeles`. No formulas, cell notes or
validation were returned within those ranges; full-grid/protection/merge coverage
is not established.

Read-only consistency checks on the four new seasonal tabs:

- Delivery: 52 dates from 2026-09-02 through 2027-08-25, then two carryover dates
  (2027-09-01 and 2027-09-08). The 54 assignments contain 27 distinct displayed
  names, each exactly twice, with no duplicate date or adjacent repeated lead.
- Market: ten dates from September 2026 through June 2027 and eight from September
  2027 through April 2028. Every date has three distinct nonempty displayed names;
  27 distinct names each appear twice over the 54 assignments. No duplicate date.
- These are visible-name counts, not verified member UIDs, rotation ownership,
  historical helper continuity or approved calendar lineage.

Before adaptation, the reference had a layout compatibility gap with the cut-27 reader. New delivery
uses `Fecha / Responsable / Ronda / Observaciones`, whereas `delivery_human`
expects name/phone in B/C. New market uses one date and three names across A:D,
whereas `market_human` consumes a date heading followed by participant rows.
Tab aliases and decoration mappings alone cannot bridge these column/row contracts.
The maintainer subsequently confirmed that these tabs were prepared through Codex
as a temporary seasonal workaround before the app feature was ready. They were
not produced by the app. The next annual generation will use the app.

### Isolated copy adaptation and read-back

The maintainer accepted the existing HU-083 readable contract: delivery columns
`Fecha / Persona / Teléfono / Notas / Cambio / Ayuda`, and market date headings
followed by three participant rows. No second reader or writer was introduced.

Before editing, a native backup was created in the connected account's ChatGPT
folder, verified as owner-only, and compared with the source across all seven
captured ranges. This is a backup of the isolated reference, not the encrypted
dual-store evidence backup required for the actual develop source. Raw workbook
IDs, names and member data are not recorded in this repository.

The four seasonal tabs were adapted in one 120-request Sheets batch, with values
and formatting bounded to `A1:F68`, `A1:F7`, `A1:F54` and `A1:F44` respectively.
Column widths were adjusted for readable fields. Exact observed merges were
replaced; metadata showed no protected ranges or tables on these four tabs.
All 54 delivery dates, 18 market dates and their assigned people were preserved.
The 54 delivery round values moved to `Notas` as `Ronda: 1` or `Ronda: 2`;
the original visible observations were empty. Phones and helpers remain blank
because the reference provides no trusted values for them.

A fresh `A1:K180` read across all seven tabs matched every planned value. Historical
and summary snapshots were unchanged, as were cells outside the four written
rectangles within those captured ranges. All four adapted tabs were visually
inspected at 100% zoom; dates, names, rounds and carryover styling were readable.
This is bounded evidence, not a comparison of every cell in each 1,000-row grid.

The actual post-write values and merges were then anonymized in memory and passed
through the existing HU-083 reader and import planner with a synthetic baseline:
72 shifts, no missing rows, no changed assignees, zero backend patches and zero
fake-service mutations. The same check passed before writing. It proves layout
compatibility and preservation of visible assignments, not real member UID,
rotation-owner, helper or Firestore revision correctness. No Firebase call,
deployment, environment binding or actual develop/production workbook was changed.
Cut 28 still requires the separately bounded auditor, trusted source capture and
the exact repair-or-deferral decision.
