# HU-084 — Initial evidence and proposed develop window

Preparation on 2026-11-02; **NOT_READY_INITIAL_SEAL_ORDER**. No maintenance is open.
The observation/native-permission adapters are published as `658b7e9c`. This block
prepares evidence and a proposed window; it does not authorize execution.

## Exact evidence and unchanged operation

Private directory: `2026-11-02-initial-evidence-window`.
`initial-evidence-draft-private.json` pins the reviewed package, current Cloud/census
observations, retained owner image, source inspection and native-channel review.
It enumerates all 25 writer controls and all eight contained delivery routes.
The envelope, scope, owner/admin agreements, operation-specific historical-risk
acceptance, permission-action closure receipt and actual quiet interval remain null.
The draft fails the real observation constructor before any provider access.

The package remains `9d5287014d6ac4ff82b62841f164aeb3137e6545bbf72ad729e04e5d617d1b8f`;
forward operation remains `request-hu084-initial-68e09b87cef3ef75a357`, inverse
`hu084-inverse-68e09b87cef3ef75a357`. The new observations match the pinned sources;
there is no reason to regenerate the package merely to attach later readbacks.
The reviewed forward intent remains 203 Firestore writes, 53 helper cells and two
markers; dates/order and historical notices remain protected. Inverse stays a
separately admitted direction, never an automatic retry.

Fresh read-only observations (Europe/Madrid, 2 November):

- Census at 00:17:55: all 14 reviewed collections, singletons and retained intake
  records preserve their exact contents/service versions. There are 62 shifts,
  48 projected users, four calendars, three config documents, 117 notices,
  12 captured events and 16 delivery records. Initial planner authority is absent.
- Cloud at 00:18:02: 24 reviewed Function configurations, three paused jobs, Rules,
  project/invoker IAM and six READY indexes match. Writer disabled, no user keys
  or own IAM bindings; absent from the checked runtime inventory.
- A raw inventory digest differed. Two complete new inventory responses differ
  only in event-filter order. After normalizing that order, they match; the
  24 Function names/configurations and 24 service names/revisions/identities match
  the reviewed configuration. The previous raw response was not retained, so its
  hash alone is not described as proof of an unchanged complete historical response.
- The real executor performs one read-only source transaction and zero control
  acquisitions/writes. Sources match; admission rejects `window_scope_missing`.
- Owner Sheets evidence is **retained**, from 1 November at 21:50:39 Madrid time.
  It is not a new window observation. Its OAuth session was revoked previously.

The Cloud read took 1.072s and the census 3.709s. These isolated read durations do
not establish total permission, admission, Sheets or cleanup latency. Unknown
historical work and delivery counts remain unknown; no notice is replayed.

## Proposed schedule, not a started window

Reserve **up to 15 minutes** from a later explicit confirmation: up to five for
read-only initial inputs and ten for the existing writer cycle. OAuth setup must be
ready before that confirmation. No actual start/end or IAM condition is filled now.

| Offset from future confirmation | Maximum purpose |
| --- | --- |
| 0–5 minutes | Read-only reconciliation, named commitments and initial inputs; no grants or maintenance |
| 5–8 minutes | Exact owned permissions, minimum 120s IAM propagation, actual initial-evidence completion, one token |
| 8–10:30 minutes | Barrier/admission and one forward direction |
| 10:30–11:30 minutes | File permission withdrawal and same-token denial |
| 11:30–13 minutes | IAM withdrawal and explicit writer disablement |
| 13–15 minutes | OAuth revocation and Drive/Sheets denial verification |

These are upper bounds, not sleep targets. Operational caps stay 180/150/60/90/120s
inside 600s; no permission lifetime is enlarged. Existing strict headroom checks
may reject before a displayed boundary. Missing an initial-input or execution
boundary stops progression; it never silently extends the window.

Proposed command-level values: a 30s observed quiet interval, at most 600s evidence
age, and initial quiet-end no more than 30s before starting the writer cycle.
The immutable quiet-end remains part of freshness; later readbacks must not redate
it. These values are proposals, not deployed defaults or proof of historical drain.
No agreement, risk acceptance or provider timestamp is generated from this schedule.

## Concrete ordering issue found during preparation

The planned owner permission-controller exception under ADR-0021 must bind the
actual exact ACL action and its closure. The new attempt has no such receipt yet.
`createOriginalWindowSessions.start` currently calls `ensureServices` **before**
the permission action. `composeDevelopWindowServices` immediately constructs the
observer, which requires the complete verified initial envelope. The actual owned
permission transition is produced later. Filling that missing receipt with an old
attempt, future timestamp, null exception or synthetic success would misstate the
exception and is not an admission solution.

Next implementation: retain the reviewed immutable action/package plan before any
effect, then complete and freeze the initial evidence/binding after the exact native
action and its closure are verified, before mint/admission. Reuse the existing
persistent journal and independent cleanup; partial setup must remain recoverable
without a valid final envelope. No second workflow engine, automatic inverse,
relaxed verifier or longer writer token is proposed. This ordering must be locally
validated before requesting the real window. The 15-minute schedule is consequently
not ready for execution authorization yet.

## Validation and handoff

Seven offline preparation checks pass: exact pins/source identity, draft rejection
before providers, time allocation, strict submission/preparation limits, complete
cleanup reserves, full inventory normalization and preservation of unknown/retained
facts. Runtime files and 337 code/package hashes are unchanged after the delivered
175-local/90-emulator pass; build/lint are reused. This block changes documentation
and private preparation only, so native/build/emulator suites are not repeated.

No IAM/ACL mutation, owner OAuth renewal, Sheets write, FCM, deployment, maintenance
or production business-data access. Native parity is unchanged. HU-084/HU-085 stay
open and PR #278 stays draft. No sheet closure or user action is required now.
