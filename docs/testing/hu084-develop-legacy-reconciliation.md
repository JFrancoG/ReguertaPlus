# Prior develop operation reconciliation — HU-084 / HU-085

## Scope and delivery

The maintainer authorizes this read-only investigation after delivering the
administrator/server closure as `afbcd098f7857e989ae3e4488891d222080764e9`.
The exact remote and draft PR heads match. Reuse #268/#269 and draft PR #278;
no new execution item or operational engine is introduced.

Firestore, Cloud Logging and the actual configured develop workbook are read;
no production business data or Auth/device records are inspected. The configured
session is used without exposing credentials.
There is no cloud mutation, replay, Sheets edit, FCM send or new deployment.
Raw source/provider content and identities remain in protected private evidence.

## Reconciled observations

| Observed set | Evidence and disposition |
| --- | --- |
| 12 retained captures | All bind to the two accepted synthetic-probe receipts by exact payload, core/CloudEvent identity and nanosecond source versions; eight acknowledged creates and four captured deletes, with conditional cleanup/current absence. None is a retained business command to replay. |
| First probe phase | Five actual old-revision logs cover malformed notice/request/shift exits and two calendar completions with updatedCount0. The exact archived source and local no-effect rehearsal explain the calendar result; the word “reflected” in its log does not imply a Sheets write when the count is zero. |
| 62 current legacy shifts | 52 delivery/10 market documents are consistent with the 23 October import: an application terminal reporting 62 and HTTP200 of the same trace, on the exact pre-bridge revision. Source/import timestamps agree with this observation; import reads Sheets, persists Firestore and the shift callback returns for google_sheets origin. This does not reconstruct earlier before-images or establish all old executions. |
| 4 current calendar documents | Retained as current baseline only; no older external-call outcome is manufactured. |
| 12 recent reminder runs | A finite 30-day query finds12 application terminals and12 HTTP200s, joined by trace, with no observed failure. They are consistent with the12 recent reminder notices, week/slot and source revision. Creating the notice is distinct from dispatching it. |
| 117 historical notices | All remain possibly delivered and unreplayable. The existing55 no_tokens/34 partial_success/25 success/3 absent summaries are preserved. No summary proves device receipt or absence of previous attempts. |
| Older history | 105 notices predate the 30-day window, including75 reminders; two nonstandard reminder IDs and an old slot21 are not attributed to the three current jobs. The three absent dispatch summaries are administrative broadcasts from 1 April, not a new pause failure. |

Provider metadata confirms retention of 30 days in _Default and 400 days in
_Required. The latter is not used as a substitute for missing callback/FCM
terminal evidence. The observed HTTP/app timestamps are separate provider clocks;
matching traces/revisions/results do not create a transaction interval or global
causal-drain proof.

## Current workbook and stable source set

The deployed legacy import configuration points to `'TORRE 2025-26'!A:F` and
`'MERCADO 2025-26'!A:C` in the verified develop workbook. This explains the old62-row
baseline; it is distinct from the prepared migration of later published seasons.

Metadata is read before six bounded ranges. Typed userEnteredValue maps for the
four seasonal grids exactly equal the retained 27 October capture:399 literals
(228/85/17/69), preserving their coordinates and therefore the published data.
The two configured historical grids are read now; no earlier grid capture exists
for them, so no historical equality is claimed. Observed file modifiedTime is
unchanged before/after. Formatting, hidden writer exclusion and atomic maintenance
authority are not inferred from this value comparison.

The before/after Firestore census preserves all183 source documents,12 captures,
deliveries/chunks and revision 12. Stable set identity is
`3227fab3a1571795c984c1317923b6e0d603d7c1fd636d499d0e28bc676de6f4`.
Fresh Scheduler inspection retains all three PAUSED states, semantic configuration,
Function sources and IAM. The legacyUntracked marker remains true.

## Offline tool and validation

[reconcile-develop-legacy-census.cjs](../../functions/scripts/reconcile-develop-legacy-census.cjs)
reuses inspectCensus instead of another SDK client or journal. A private manifest
pins census/receipt bytes and the stable set digest; output uses exclusive wx and
a private parent directory. Duplicate/contradictory receipts, source recreation,
payload/version/metadata differences and a receipt revision newer than the census
cannot classify a capture as a matching test. Optional source evidence is provenance
only, never a live terminal/authority adapter. All execution/admission flags remain
false, including physicalHandoffReady, canEnterMaintenance and canApply.

Run from functions:

```sh
npm run build
npm run lint
npm run test:shift-planning:develop-legacy-reconciliation
node scripts/reconcile-develop-legacy-census.cjs --input '/private/path/manifest.json' --output '/private/path/new-report.json'
```

Build/full lint, focused CJS lint and 40 offline regressions pass, zero failures/
skips. The 19 previous census cases rerun with the shared fixture; 21 new cases
exercise classification and CLI boundaries. Independent review finds and fixes
receipt12/census6 regression. Real before/after manifests both classify 12 matching
captures and zero unmatched captures. No native source changes; unaffected native
and deployed-runtime acceptance is reused. The maintainer authorizes delivery of this reconciliation source; exact
commit/remote evidence is recorded in #268/#269 and draft PR #278.

## Admission boundary and next finite gate

This completes classification of the observed set and records the unavailable
history. It does not prove the complete universe of old invocations, external
terminality or the eight zero causal-drain counters required by the trusted barrier.
Do not clear legacyUntracked, replay old notices, fabricate modern intents/leases
or reinterpret a completed investigation as maintenance permission.

The next gate is to assemble actual admission evidence: remaining automated-writer/
queue/in-flight controls, owner/administrator participants and a concrete agreed
window. If an external effect remains physically uncertain, use the existing
HU-085 scoped residual/incident exit rather than silently accepting global closure.
No human decision or device action is required by the observations in this report.

## Post-reminder effects reconciliation — 2026-10-29

Direct reminder closure and its deployment evidence are committed/pushed as
`34aa7aaec1b9ddcd44b970b540ec700a4f4e80c1`; remote equality was verified.
This subsequent reconciliation is read-only and its documentation is local.

A bounded develop-only application-log query covers 2026-09-29 16:55:14 UTC through
2026-10-29 16:55:14 UTC across six exact legacy services. All pages are exhausted:
20 application records and20 same-trace request records. Requests were read only
for the traces found in that develop query. Exact pre-bridge revisions match the
reviewed deployed sources; no production payloads, device records or tokens are read.

- **12 FCM attempts reconciled:** event ID joins the terminal log to its current
  Firestore dispatch summary; accepted/failed counts, status and resolved-user count
  agree, timestamps are present and each exact trace/revision has HTTP200. The SDK
  reports six successful token sends and six failures. Error codes were not retained
  by this legacy terminal; a failure is not promoted to proof of non-delivery. This is server-attempt evidence,
  not device receipt, absence of other attempts or permission to replay.
- **Three imports completed:** 12,14 and23 October each report62 imported shifts
  on the reviewed revision with a same-trace HTTP200. These read Sheets and write
  Firestore; they do not prove a Sheets export. The last matches the current baseline.
- **Five prior probe exits:** one each malformed notice/planning request/shift and
  two calendar callbacks with updatedCount0, all same-trace HTTP200. The archived
  calendar log occurs before potential notice creation; do not treat its log alone
  as whole-callback completion. Count0 bypasses that subsequent notification branch.
- **Stable current source set:** snapshot readTime2026-10-29 16:54:40 UTC preserves
  all183 business source documents,12 captures and16 delivery records versus the
  preceding window-readiness snapshot, including exact document images/versions.
- **Six bounded Sheets ranges unchanged:** four seasonal A1:F100/A1:C100 ranges
  retain399 typed values (228/85/17/69); historical TORRE A1:F150 and MERCADO A1:C100
  retain343 (270/73). Coordinate/type/value equality preserves the inspected published
  dates/order. Drive modifiedTime is unchanged before/after. This does not certify
  formatting, uninspected cells, effective writer exclusion or past-call completion.

Private evidence resides in `2026-10-29-effects-reconciliation`: bounded query/pages,
atomic census, workbook snapshots and `effects-reconciliation-private.json`.
Five negative correlation checks reject changed counts/status/event IDs/revisions/
environment. No application code changed; reuse the delivered build/lint and
15 local/24 emulator acceptance. Documentation gets diff/bilingual checks.

### Finite disposition and next gate

The105 older notices remain unverifiable history, possibly delivered and never
replayed; they are **not105 pending sends**. Preserve the55 no_tokens/34 partial_success/
25 success/three missing historical summaries. Missing logs do not prove an active
operation, zero old work or completeness of the callback universe. No develop Sheets
export terminal appeared in this finite query; current cell equality is not a
substitute for external-call terminal evidence. Do not clear legacyUntracked or
admit maintenance/migration from these observations.

Close this finite historical search rather than repeatedly querying expired logs.
Reopen it only for new causal evidence. The actionable next gate is current automated
credential/destination authority and effective workbook writers, with old-call
termination or effective isolation bound to those controls. Retain any physically
uncertain external submission under the existing scoped incident process, without
fabricating zero counters or using an incident as successful admission. Obtain fresh
owner/admin window agreements only after those controls are ready. No device action,
new policy acceptance or live mutation was needed for this reconciliation.
