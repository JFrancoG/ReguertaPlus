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
