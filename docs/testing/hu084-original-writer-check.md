# HU-084 — Original develop writer check

Status: executor prepared and locally tested, **not authorized or executed live**.
The preceding owner/control preparation is delivered in `ac24e5ce`; the new executor
is local. This is a bounded permissions check, not migration or maintenance admission.

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
may increase. All six tab identities and bounded `A1:Z100` snapshots of typed values,
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
