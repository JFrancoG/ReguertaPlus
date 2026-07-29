# [HU-071] Make corrupt news and notification data explicit

GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/230

## Outcome

News and notification feeds distinguish a successful empty query from a
present but invalid Firestore document. Invalid documents fail the complete
snapshot with a typed, PII-free error instead of disappearing from a partial
list.

## Links

- Spec: `spec/notifications/hu-071-news-notification-data-integrity/spec.md`
- Plan: `spec/notifications/hu-071-news-notification-data-integrity/plan.md`
- Tasks: `spec/notifications/hu-071-news-notification-data-integrity/tasks.md`

## Acceptance criteria

- A successful empty query returns an empty collection.
- A missing, mistyped, blank, or invalid required field in any document
  returned by the query fails the complete snapshot on Android and iOS.
- Notification type, target, target payload, segment role, timestamps, and
  inbox event identity follow the canonical Firestore contract.
- `urlImage` and `weekKey` remain the only optional content fields in scope.
- Invalid-data errors identify only the collection and document ID.
- Network, permission, and invalid-data failures preserve the last valid feed
  only inside the same session context, stop loading, and expose a recoverable
  retry path.
- A principal, member, authorization-scope, session-epoch, or environment
  change clears the previous news, inbox, and read-state snapshot before the
  next refresh.
- Results and errors from a stale principal, member, session epoch, or
  environment do not mutate state or feedback.
- Cancellation is not reported as a network/data failure and only the matching
  operation may finish its loader.
- Android authorization does not become dependent on the non-critical
  community-feed read succeeding.
- A confirmed news save/delete or notification send is applied locally and is
  not reported as a failed mutation when its later fenced refresh fails.
- Save/send/delete mutations are serialized and editor-owned: clear/reopen or a
  newer deletion request cannot receive draft, confirmation, feedback,
  callback, or loader effects from the older operation.
- Focused and affected Android/iOS suites pass without new warnings.

The strict client contract deliberately rejects non-canonical notification
types and target payloads. Existing Functions writers are known to emit some
non-canonical values, so end-to-end/live compatibility remains a later
coordinated backend gate and is not claimed by this client cut.
That deferred gate is tracked in
[issue #231](https://github.com/JFrancoG/ReguertaPlus/issues/231).

Firestore Rules require ordinary-member News reads to query `active == true`.
Consequently, a News document whose `active` field is absent or mistyped is not
returned to that client and cannot be diagnosed by the mobile decoder. An
unfiltered administrator read remains strict; a PII-free live inventory and
backend/Rules validation remain a later Firebase gate while standby continues,
tracked in [issue #232](https://github.com/JFrancoG/ReguertaPlus/issues/232).

## Out of scope

- Firebase deployment, Rules, Functions, backfills, or live-data mutation.
- Durable local-first persistence and P1-02.
- Non-live chained repositories unless new composition evidence is found.
- Visual UI changes and audit P2/P3 work.
