# ADR-0021: Use cooperative owner maintenance for shift workbooks

## Status

Accepted as policy on 2026-10-28 after the maintainer explicitly selected
“Mantenimiento acordado con el propietario”. Implementation, rehearsal of the
revised procedure on a copy, readiness and live phase authorization remain
separate gates. This decision authorizes no shared write, grant or deployment.

## Context

The maintainer believes the workbooks use personal accounts, but is not fully
certain; absence of Workspace is not verified. The accepted copy experiment
showed that a global Drive content restriction blocks both the owner and the
backend writer, while the owner can remove it. Range protection cannot remove
the owner's permissions. Unlocking does not establish physical sole writing.

ADR-0013 and HU-085 required technical exclusion of every owner write path.
For this scope, the maintainer accepts a bounded cooperative window instead.
Only that absolute owner-exclusion requirement is amended; the other writer,
event, effect, security and notification controls remain mandatory.

## Decision

- Preserve the same workbook ID/link and published dates and assignment order.
  Firestore remains the app authority. During maintenance, the reviewed backend
  is the only authorized automatic writer; manual proposals use its governed
  command and reconciliation paths, not an unrestricted automatic import.
- Before candidate operations, there are no active authorized source-data
  writers. The named owner's technical capability remains, but exercising it
  is outside the agreement. During the candidate phase, only exact reviewed
  backend commands may write. Neither phase claims physical zero writers or
  physical sole-writer authority.
- Bind the agreement to a named owner, environment, workbook, affected scope,
  operations and deadline, with source revision/digest and recorded confirmation.
  The owner confirms the file is online, closed and has no pending offline
  edits, and agrees not to edit, unlock, change access or initiate owner OAuth,
  script or other automation activity during the window. The sole exception is
  a separately authorized, sealed ACL/protection action if the owner also acts
  as the named permission controller: no content edit or other automation is
  allowed, and that workflow/temporary credentials close immediately afterwards.
- Inventory and fence all other editors, automation, credentials and privileged
  control-plane paths. Automated use of the owner's credentials is included:
  the exception concerns the named human capability only. Reconcile requests
  submitted before closure; their work may finish later. Unknown or unfenced
  writers and unresolved effects block progression.
- Bound the window and its recovery/resume outcome. Expiry or a change of owner,
  participants, membership or effective authority invalidates the agreement.
  Stop automatic progression; obtain renewed owner confirmation and fresh
  read-backs before continuing under the applicable phase authorization.
  Expiry never proves that a request was cancelled or finished.
- Compare recorded revision/content before and after each batch. These checks
  are not Sheets CAS: they detect some drift, cannot prevent read/write races
  and may miss transient edits. Observed drift or uncertain writes stop automatic
  progression, retries and blind inverse recovery. Preserve evidence and
  reconcile the concrete outcome with the responsible operator and owner before
  a separately admitted continuation or recovery.
- Keep durable delivery, old Admin SDK/in-flight work, causal descendants,
  external submissions and possible notification delivery under the existing
  strong controls. Client Rules or a new journal cannot account for earlier
  privileged writes. Keep epoch/revision admission, backups, recovery and
  notification release gates; the security epoch never rolls back.
- The existing trusted barrier adapter still accepts its strict proof only.
  Do not label the residual owner capability as technically fenced, inject a
  boolean bypass or use a local fixture packet as operational evidence.
  A reviewed implementation/evidence contract and copy rehearsal must represent
  this policy explicitly before any live admission. This ADR alone changes
  neither `canApply` nor `operationalReady`.

## Consequences

The current file and published plan can be retained without requiring a Workspace
purchase, a new Firebase project or an ownership transfer. The accepted tradeoff
is reliance on the named owner's cooperation, with residual risk of concurrent
or undetected transient edits. Transfer to another personal owner only moves
that capability; a service account is not an assumed ownership solution.

Acceptance of this policy is not acceptance of a completed handoff. The procedure
still needs implementation, bounded tests, fresh provider evidence and separately
authorized application/recovery. The exception must not spread to other writers
or replace technical control of earlier operations and uncertain side effects.

## Related work

- [ADR-0013](0013-model-shifts-as-continuous-rotations-with-seasonal-projections.md): only its absolute owner-exclusion condition is amended here.
- [HU-085](../../spec/shifts/hu-085-production-shift-workbook-activation/spec.md)
- [HU-084 handoff rehearsal](../testing/hu084-backend-handoff-rehearsal.md)
- Google: [range protection](https://support.google.com/docs/answer/1218656?hl=en), [content restrictions](https://developers.google.com/workspace/drive/api/guides/content-restrictions), [ownership transfer](https://developers.google.com/workspace/drive/api/guides/transfer-file).
