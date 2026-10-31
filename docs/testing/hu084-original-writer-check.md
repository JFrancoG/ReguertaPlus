# HU-084 — Original develop writer check

Status: the second authorized original-file attempt stopped before writing at the
writer-parent assertion (provider line57 in `930959bd`). Cleanup passed and was
independently verified. A local parent-visibility correction awaits publication
and another separately authorized real check. No migration or maintenance admission.

## Scope and entry point

`functions/scripts/prepare-develop-original-writer-check.cjs` emits an inert preparation
when run with one fresh output path. It never reads credentials or performs network
requests from the CLI. `runWithExplicitCredentials` is the reviewed, explicit real-
provider composition: injected IAM bearer, separate owner metadata-only bearer,
reviewed native owner-sharing callbacks and an independent current-controls reader.
Neither token is passed to the owner UI; no ADC, refresh, subprocess, Firestore client,
notification client or deployment entry point is added.

The only destination is original develop file
`1O7VKs7S4wZHVvTfNBehAd5EzF3Mgw2q9LweK68Gm76A`. The only write is one batch containing
one `updateCells` to sheet 673721152/A1 with the already observed string `Fecha`, fields
`userEnteredValue`. No date/order, note or format change is requested. Drive version
may increase. All six tab identities and bounded snapshots (`A1:Z100`, or `A1:Y100` for the 25-column TORRE 2025-26 tab) of typed values,
notes and entered formats must match the reviewed baseline before and after. This is
not a full-grid or immutable-history guarantee. No inverse write or automatic retry.

Existing copy-provider/runner exclusions are unchanged. IAM transport, identity
checks, token scope/lifetime and exact conditional-binding removal are reused.
The original-file transport adds only fixed file/parent reads, bounded permission
pagination and the one fixed batch. It follows no redirects and retries no request.
The writer reads only the file: its owner's My Drive root is checked independently
by the owner reader, without granting the writer folder access.

## Reviewable owner channel

Before executing, inspect the native Drive sharing UI with **testplusprojects@gmail.com**
on the exact file above and verify that both Add and Remove access are available.
Record the UI observation and the callback source digest in the private channel
review. Bind that digest to `ownerChannel.reviewDigest` and the new approval. The
callbacks are trusted operator actions, not arbitrary untrusted input or proof that
OAuth grants write authority. They must settle only after their UI action finishes.

1. `grant(action)`: verify file ID/account, existing owner and four readers. Add only
   `reguerta-develop-sheets-writer@reguerta-9f27f.iam.gserviceaccount.com` as Editor on
   this file. Do not change the parent, sharing restrictions or existing readers.
   The controller requires the new direct permission ID `06575248221544440100` and
   re-reads the complete ACL. A missing or uncertain result stops progression.
2. `remove(action)`: on that same file/account, select only the writer added above,
   remove its access and save. Do not change another permission. The controller
   inspects even a grant whose UI response was lost and removes only the exact
   newly attempted permission. A pre-existing writer is rejected before any action.
3. Complete owner metadata reads confirm restoration. While the same writer token
   is still valid, a file GET must return 403/404 after its successful positive read.
   An expired/401 token is not evidence of removal. No second write or mint is used.

These UI actions need separate execution authorization. The metadata-only OAuth
session cannot create/remove permissions, and no broader OAuth scope is proposed.
The previous revoked session is never reused. The new owner session must be Online,
without refresh, and is revoked in final cleanup with same-token 401 verification;
clear Playground fields/references and close its tab afterward.

## Single attempt and cleanup

A new authorization binds the exact preparation/source/request digests, owner channel,
reviewed baseline metadata/content, independent controls and an online, closed-file,
no-offline/no-other-writes-or-token-issuance owner window of at most ten minutes.
`readIndependentControls` is a trusted read-only integration: use the existing live
control and runtime-isolation observations, not booleans inferred from old evidence.
Every response must carry the matching controls digest, observed time at most 60s old,
and verified writer isolation/develop fences. Shared sources/queue unknowns retain
their existing classifications; these observations never authorize maintenance.

Use one canonical private journal root for all attempts on this file. An exclusive
per-file lock and consumed approval directory are created before provider calls.
Write intents are flushed before enable, grant, mint and batch submission; journal
records contain bounded hashes/statuses, never tokens, raw SDK errors or cell data.
Keep private baseline/control evidence separately. Never clear a journal or lock to
retry: inspect and reconcile interrupted cleanup first, with a new approval if needed.

The account must start disabled with its exact UID, no keys, no direct account
bindings and unchanged permitted project authority. Enable once; grant the exact
conditional IAM binding for at most 600s; observe lifecycle and advisory mint readiness
with at least 120s grant age and a bounded 180s wait. Request one 300s token. Reserve 120s
of its lifetime before the write for independent cleanup. Source, identity, controls,
owner/file authority, token/window and baseline are checked again before submission.

A lost write acknowledgement is followed only by a bounded afterimage read, then
cleanup; matching contents do not invent successful acknowledgement. File-permission
removal, CAS removal of exactly the owned IAM member/condition, explicit disable,
independent identity read and owner OAuth revocation are separate cleanup steps.
Unrelated concurrent grants are preserved and reported as unresolved drift. Failures
never reopen develop. Failed cleanup retains the local lock and an inspection result.
If the process/UI stalls or crashes, use retained intents to inspect and remove the
owned grant, remove exact IAM binding and explicitly disable; token expiry alone is
not successful cleanup. No automated resume or second attempt is provided.

## Acceptance and next gate

Node 22.23.4: Functions build/lint pass; 83 focused cases pass, zero failures/skips
(34 original-file cases plus 49 unchanged IAM/copy regressions). Native apps and
Firestore behavior are unchanged, so no native suite or emulator run is required.
The new CJS files also pass syntax checks; standard lint covers the repository's
configured JS/TS scope, while CJS behavior is covered by the focused tests.

Next: review the real owner UI/callbacks and fresh independent controls, bind current
baseline/source digests, obtain one explicit IAM/file/token/write/cleanup approval,
then prepare Online owner OAuth and request the ten-minute window separately. The
local tests do not establish original-file writer capability. A later migration still
needs new ACL/version binding, current business census, separate Firestore authority
and its own owner/admin/risk maintenance authorization.

Provider references: [UpdateCellsRequest](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/request#UpdateCellsRequest)
and [complete permission pagination](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/list).


## Native sharing review and refreshed evidence — 2026-10-31

Executor delivery: `3e494fc8`, exact pushed head verified. Read-only native review
confirms the named owner account and exact original file, owner/four readers and
restricted access. The writer email resolves to the expected account; its pending
Editor form supports turning notifications off. The draft was cancelled without
Sharing/Sending. An existing reader's permission menu exposes Remove access; it was
closed without selecting a change. The writer is absent afterward. This verifies
the UI path, not a successful grant/removal of a writer that does not yet exist.
Future actions must use fresh visible state, never retained AX indices. The final
post-removal confirmation will be inspected only during the authorized attempt.

Refreshed metadata confirms the legacy TORRE tab has 25 columns. The old uniform Z
read would exceed that grid; the original-only provider now uses Y there, preserving
Z on the other five tabs. A regression models real grid bounds. Snapshot masking,
write budget, same-value request, IAM contract and copy exclusions are unchanged.
The readonly connector supplies the new six-tab raw baseline. Its complete version/
parent/ACL projection is unavailable in the connector. The authorized owner-only
OAuth read completed at 11:56:08Z: version 278 stable, same complete five-entry file
ACL and owner-only parent. Revocation returned 200 and the same token then returned
401. No refresh token; fields cleared and Playground closed.

24 Functions remain unchanged, three scheduler jobs PAUSED, six indexes READY;
Rules and project/account policies match prior observations. The writer remains
disabled with zero user keys/account grants and no assignment to the 24 observed
Functions or 24 globally listed Run services. Global jobs/worker pools/instances are
empty, with no continuation/unreachable locations. Business sources, causal queues
and retired-revision evidence are not renewed or declared drained by this check.

Private evidence: `2026-10-31-original-permission-channel`. No permission change,
writer token, Sheets write, notification, maintenance or production-data access.
Native apps unchanged. Local code/evidence updates remain uncommitted after
`3e494fc8`; live execution still requires its separate approval and owner window.

Validation of this correction: Node 22.23.4, 84 cases (35 original and 49 IAM/copy
regressions), zero failures/skips; build, lint and CJS syntax pass. Native/emulator
suites are not repeated because app/Firestore behavior is unchanged.


## Authorized original-file attempt — 2026-10-31

The maintainer authorized one original-file attempt and confirmed the ten-minute
closed-file window. Prior grid/control evidence is delivered in `b52e75a8`. Before
execution, the provider's response field mask was aligned with the independent
connector's workbook/tab projection; the 84-case suite and build/lint passed.

The attempt enabled the exact identity, granted the exact conditional IAM member
and one direct Editor permission, waited at least 120 seconds, and minted one 300s
token. Its positive Drive read succeeded. It then failed an assertion in the old
`positive-read` phase, **before any write intent or Sheets batch**. The old diagnostic
did not preserve the specific assertion or source location; the cause is unresolved.
Do not infer a capability, ACL, format or snapshot mismatch from that broad phase.

Cleanup removed the exact file permission and verified the complete owner/four-reader
ACL. The same still-valid writer token was denied404. Exact IAM binding removal,
explicit disable, zero user keys/account grants and absent runtime assignment were
independently verified. The controller initially marked owner OAuth cleanup unproven;
a subsequent independent GET with that same owner token returned401. Reapplying
revocation returned400 with the already invalid token, followed by401 again. The
first revocation/probe statuses were not retained, so no propagation cause or initial
HTTP200 is claimed. OAuth fields were cleared, its tab closed and RAM references
discarded. Initial terminal receipt and per-file lock remain unchanged; a separate
manual reconciliation records verified cleanup and consumed authorization.

The six bounded connector snapshots before/after match (3286 selected cell objects,
including entered values, notes and formats). Refreshed Functions/jobs/Rules/IAM/Run/
index controls match the same digest. One post-cleanup control read was unavailable;
the subsequent complete matching read passed. No Sheets write, FCM, business-data
write, maintenance or production-data access occurred. The file's post-permission
Drive version was not retained; version278 is historical, not a current execution fence.

Local follow-up diagnostics split pre-write stages, retain only capability booleans,
comparison hashes and pinned-source locations, and preserve numeric OAuth cleanup
statuses without raw errors or secrets. They add no retry, token or write. Node
22.23.4: **86 focused passes**, zero failures/skips, build/lint and CJS syntax pass.
Native apps/Firestore behavior unchanged; their suites are not repeated.

Private evidence: `2026-10-31-original-writer-live`, canonical receipt
`original-develop-writer-journal/original-writer-20261031-one-attempt`. Writer capability
on the original file remains unproved. Next review/publish diagnostics and reconcile
the retained lock explicitly before a separately authorized new attempt and fresh
owner window. Never erase or reuse this consumed attempt. New follow-up code/docs
remain local after `b52e75a8`; migration and maintenance are still closed.

## New diagnostic attempt preparation — 2026-10-31

Diagnostics are published as `930959bd`; unchanged source hashes match the accepted
86-case/build/lint evidence. Private session `2026-10-31-original-writer-diagnostic-retry`
is inert, with a new receipt ID and an explicit approval bound to its preparation
digest. No owner session, IAM change, writer token or Sheets request was started.

Pin every old receipt, preserve the original failed terminal and its separate cleanup
reconciliation. Only after new execution approval, confirmation that no process is
running and fresh identity/owner-ACL/control readbacks may the operator rename the
empty retained lock to `original-develop-reconciled-20261031-one-attempt` in the same
canonical journal. Record that action in the new evidence; never delete old receipts,
change journal roots or reuse the consumed attempt. Rollover has **not** occurred.
The new session rejects the retained lock, changed receipts and unexpected attempts.

Renew the six-tab snapshot, owner-channel review and complete owner metadata/version;
version278 is historical. Use a newly authorized Online metadata-readonly owner OAuth
session. Prepare sharing before requesting a fresh ten-minute closed-sheet window.
Keep one300s token, minimum120s IAM age, one same-value A1 batch and cleanup reserve.
After failure retain the precise phase/location and safe diagnostic receipts without
retry. Verify cleanup independently. Maintenance and migration remain closed.


## Diagnostic attempt and parent boundary — 2026-10-31

New approval and a fresh ten-minute owner window admitted exactly one attempt.
Before starting, the previous empty lock was archived under the reviewed name;
all previous receipts and the failed terminal were preserved. Read-only setup
had one connection failure and a receipt collision; both preceded the attempt,
permissions and writer-token mint. Numbered control receipts were preserved.

One300s token was issued after the minimum120s IAM age. Positive Drive read passed.
The expanded diagnostic stopped at `writer-metadata-read`, specifically provider
line57 in `930959bd`: the writer's `parents` did not equal the configured owner
parent. No write intent or batch occurred. The raw returned parent value was not
retained, so absence versus another shape cannot be asserted from this receipt.
The first attempt's specific assertion remains unknown; do not retroactively equate it.

The controller reports no cleanup failures: exact file/IAM grants removed, same
unexpired writer token404, explicit account disable and owner OAuth same-token401.
Independent identity/runtime checks confirm disabled, zero user keys/account
bindings and no service assignment. Complete file ACL is restored to owner and
four readers; parent owner-only. Version280 before,282 after permission changes.
All six selected snapshots match exactly (3286 cell objects). Independent controls
match the baseline digest; no Firestore business-data access, Sheets writes, maintenance, migration,
FCM or production changes. OAuth fields cleared/tab closed, session references
released; active lock released by successful cleanup. Both attempts remain consumed.

Local correction: accept omitted/empty writer `parents` only, while retaining
strict independent owner folder/ACL verification and refusing malformed fields or
visible conflicting parents. Combine the writer's own file/ACL/capabilities with
only the owner's verified parent authority; recheck owner observations before the
write. No parent access is granted to the writer. This addresses an overly strict
assumption, not a claimed real-provider success. Google documents parent visibility
restrictions in its [Drive API differences guide](https://developers.google.com/workspace/drive/api/guides/shared-drives-diffs).
That reference discusses shared drives; it is not a captured personal-Drive response.

Validation: Node22.23.4,93 passes (44 original +49 IAM/copy), zero failures/skips;
build/lint and CJS syntax pass. New cases cover omitted/empty writer parents,
malformed/conflicting parents, mandatory owner parent and cleanup. Native/Firestore
behavior unchanged, so those suites were not repeated. Local changes after
`930959bd` need publication. A future real attempt requires new approval and window,
fresh observations and a regenerated preparation digest; no retry under this window.
Private evidence: `2026-10-31-original-writer-diagnostic-retry`, canonical receipt
`original-writer-20261031-diagnostic-attempt`.


## Parent correction exercised; snapshot mismatch contained — 2026-10-31

The correction and previous outcome are published in `44271c22` (exact remote HEAD
verified). A newly authorized attempt and ten-minute closed-sheet window used one
300-second writer token after the minimum120-second IAM age. The real writer view
omitted `parents`; the strict independent owner parent/ACL and combined metadata
comparison passed. This observation belongs to this attempt only.

The next guard stopped at `baseline-snapshot-comparison`, controller line192 in that
commit. Connector digest `854e761f…` differs from direct Sheets digest `07c74039…`.
No write intent or batch occurred. Only the two digests were retained from this
comparison, not the writer's raw snapshot; the differing field and its cause remain
unknown. Do not infer content drift, harmless serialization or a correction from
hash inequality alone, and do not substitute the writer digest as the baseline.

Cleanup has zero controller failures and independent confirmation: exact file/IAM
permissions removed, account disabled, zero user keys/account bindings/runtime
assignments, same unexpired writer token404 and revoked owner token401. File ACL
restored to owner/four readers, parent owner-only; version282 before and284 after
permission changes. All six bounded connector captures match exactly before/after
(3286 selected cell objects). Independent technical-control digest is unchanged.
OAuth fields were cleared, tabs closed, session references discarded and active
lock released; all three consumed attempts and archived historical lock remain.
No Sheets write, maintenance, migration, FCM or production-data access occurred.

Next isolate the exact snapshot difference through read-only diagnostics before
another write rehearsal. Retain the complete value/note/format comparison; no
normalization or permission expansion is justified yet. Original-file writing
remains unproved. A later real attempt needs regenerated preparation, separate
approval and fresh owner window. Native apps and controller/provider code are
unchanged; this outcome updates only evidence, inert plan and tasks. Private
receipts: `2026-10-31-original-writer-owner-parent` and canonical
`original-writer-20261031-owner-parent`.
