# Cut 28 evidence access proposal

Prepared 2026-09-11. **Explicitly authorized and executed; temporary access revoked.**
This authorizes the source-read window required by `plan.md` Phase 0, including
the stated database-wide read capability; it does not authorize a repair or deployment.
Results and retained resources: [source capture review](source-capture-review.md).

## Verified starting point

Authenticated Firebase administration can read project metadata despite the empty
gcloud account list. Complete project-local account and bucket listings returned
four service accounts and seven buckets, without pagination. None is a dedicated
HU-083 auditor or evidence bucket. The existing accounts have write-capable roles.
This does not prove that no suitable resource exists in another project.

The only database is `projects/reguerta-9f27f/databases/(default)`, in `eur3`.
Develop and production are document namespaces inside it. Sheets API is enabled;
IAM Service Account Credentials API and Drive API are disabled in this project.
No source documents or new workbook cells were read during this inspection.

## Proposed resources and permissions

| Resource | Exact proposed change |
| --- | --- |
| Project `reguerta-9f27f` | Enable only `iamcredentials.googleapis.com` and `drive.googleapis.com` for this capture. Existing Sheets API remains enabled. |
| Service account | Create `hu083-evidence-auditor@reguerta-9f27f.iam.gserviceaccount.com`, without a downloaded key or deployed workload. |
| Firestore grant | Give that account `roles/datastore.viewer`, conditioned on the exact default database and a one-hour window. No import/export-admin, write, notification or runtime-invocation grant. |
| Token grant | Give the currently authenticated operator a one-hour `roles/iam.serviceAccountTokenCreator` binding on this new account only. Mint short-lived tokens in memory; the auditor receives no impersonation grant. |
| Source spreadsheet | Add the auditor as reader only to the workbook resolved by `SHEETS_SPREADSHEET_ID_DEVELOP`; verify identity against the previously inventoried develop workbook. No notification email, production share, test-copy rebinding or editor grant. |
| Evidence bucket | Create `reguerta-9f27f-hu083-evidence` in `EU`, with uniform bucket access, enforced public-access prevention, server-side encryption, unlocked 30-day retention and deletion lifecycle after 30 days. If the name is unavailable, stop instead of silently selecting another destination. |
| Evidence grant | Give the auditor `roles/storage.objectCreator` on this bucket for the capture window. Create uniquely named objects with `ifGenerationMatch=0`. Give the operator object-read access for verification and restore rehearsal. |

Firestore grant condition (replace `EXPIRY_UTC` once at execution, with start +
one hour, and record the exact value in the private execution manifest):

```text
resource.name == "projects/reguerta-9f27f/databases/(default)" &&
request.time < timestamp("EXPIRY_UTC")
```

Use the same expiry for the new token and bucket bindings. Preserve every existing
binding through etag-checked policy updates; do not replace unrelated permissions.

**Permission boundary requiring explicit acceptance:** this Firestore IAM grant
is database-scoped. It can technically read production documents in the same
database even though the capture program must reject every non-develop path.
The program's allowlist is not an IAM denial of production reads. Google documents
[database-scoped IAM conditions](https://firebase.google.com/docs/firestore/manage-databases)
and [the read-only viewer role](https://firebase.google.com/docs/firestore/security/iam).
Approval must explicitly accept that temporary read capability; otherwise this
proposal must not execute.

Existing project owners, editors and administrative service accounts retain their
inherited authority. In particular, existing project-level token creators and
Storage administrators are not eliminated by these narrower new grants. The
bucket is not represented as accessible to the operator alone. The auditor itself
cannot overwrite/delete artifacts under
[Object Creator](https://docs.cloud.google.com/storage/docs/access-control/iam-roles).
No retention lock or new KMS infrastructure is proposed.

## Capture and completion

Prepare and inspect the capture command before activating the one-hour grants.
Its network targets are the exact project/database, configured develop workbook
and proposed evidence bucket. All document reads must start at
`develop/plus-collections/`, limited to `shifts`, `users`, `deliveryCalendar`,
`shiftRotations/{delivery,market}` and the three known `shiftPlanningState` documents
(`current`, `sourcePolicy`, `sheetsSubmission`). Observe at most one pending or
processing `shiftPlanningSyncCommands` document to detect active work. Do not read
Auth accounts, user devices, notification payloads or production documents.

Reuse the reader's 500-row limits with overflow detection, typed full shift
snapshots and bounded member/calendar inputs. Reject overflow rather than auditing
a truncated export. Freeze Firestore read time and document update times; capture
Sheets values, relevant native structure and before/after workbook versions.
Retain raw data only in protected evidence artifacts, never Git or chat output.
An unstable source produces an incomplete capture, not an accepted baseline.

Record artifact hashes, generations, capture time, actual grants/readers, expiry
and retention. Verify uploads and restore the captured content only into the local
offline/emulator rehearsal. The isolated production-like copy remains a separate
layout fixture; it must not replace the actual develop workbook in the baseline.

On completion or failure, remove only the new source-reader and temporary IAM
bindings, disable the auditor and verify effective access revocation, accounting
for IAM propagation and already-issued token lifetime. Keep the evidence under
its retention policy. Leave enabled APIs in place to avoid disrupting intervening
users; enabling them is an explicit project-level configuration change.
No Functions/Rules deployment, source mutation, runtime fence or FCM send is part
of this proposal. Actual repair or its exact HU-085 deferral remains a later result
of the evidence review, not a consequence of approving access.
