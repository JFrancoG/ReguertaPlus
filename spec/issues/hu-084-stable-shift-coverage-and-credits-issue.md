# [HU-084] Stable shift coverage and earned credits

## Pre-PR assessment — 2026-09-13

The next recommended step is one final branch review and validation pass, not more
independent feature cuts. A PR may review the explicitly provisional, demo-only
implementation with `Refs #268`. It must not claim the assembly-approved Definition
of Done or close #268. No PR, merge or activation is authorized by this checkpoint.

Before presenting that PR as ready for review:

1. Reconcile the full branch against the acceptance criteria in one current matrix;
   review cross-feature regressions, source/ownership boundaries and unnecessary
   complexity. Historical checkpoints and unchecked live tasks are not that matrix.
2. Validate the final revision: Functions suites including HU-016/HU-082 regressions,
   Android unit/lint/connected gates, and the canonical iOS release gate. Reuse
   unaffected recent evidence explicitly. The last full iOS release gate predates
   the final push callback; later focused/smoke tests do not replace that full gate.
   Separate the 137 recorded Android baseline lint findings from new diagnostics.
3. Attach the exact residual acceptance list: physical VoiceOver/TalkBack, Android
   API 29, Android notification-tray opening and iOS cold-process notification
   opening. Run feasible local checks; an unperformed check stays visible and cannot
   be marked passed. Real APNs/FCM delivery is also unverified.

Full HU-084 closure additionally requires the linked assembly decision and bilingual
ratified requirements, reconciliation/testing of any policy amendments (reserve exit,
windows/order, eligibility/departures, draw and credits), the real entropy-provider
contract, and completion or explicit disposition of operational observability:
structured logs/metrics for stuck cases, exhaustion, retries and credit failures.
Persisted audit receipts alone do not complete that observability task. Live backend,
mobile composition, destination admission and operational recovery remain unwired;
they need an explicitly scoped coverage activation handoff after ratification.

HU-085/#269 currently owns the base planner/workbook rollout and is independent of
HU-084. Its existing scope must not be treated as implicit completion or automatic
ownership of every remaining coverage task. Real IAM/Drive fencing, deployment and
production writes remain separately authorized activation work.

## Governed recovery checkpoint — 2026-09-13

This checkpoint builds on pushed commit `2779b2e` (coverage push dispatch and
routing) and implements and validates the grouped local recovery block.
It reuses the HU-082 trusted closed-intake adapter, evidence verifier and immutable
failure journal, plus HU-083 read-only projection inspection. No alternate lock,
live endpoint, IAM/Drive controller or automatic retry scheduler is introduced.

Backend-owned authorization beneath the exact effect binds an active administrator,
closed maintenance, workbook and source versions. Source, role and authorization
changes reject before effect completion. Matching canonical assignments and exact
Sheet read-back can atomically complete the effect, release its generic inbox and
remove its reservation without a new Sheets write. Shared inbox construction retains
the ordinary worker's behavior. Superseded/expired notification-only effects retire;
missing/conflicting projections or changed assignments keep the reservation.

Recovery preserves accepted, failed and unknown push history; an interrupted
submitting record becomes unknown with the original attempt and destination digest.
Recipients with no submission are listed separately. None is automatically resent.
Concurrent/repeated recovery produces one receipt/inbox release. A failed final
barrier check after commit leaves the receipt and a durable incident; retry cannot
claim clean completion. Writers remain closed, and the original effect authority is
not renewed. Future push admission after a new epoch requires its governed path.

Validation:

- Functions build and lint pass.
- 122 fixed-demo emulator/Rules scenarios pass, zero failures/skips, including
  14 new recovery scenarios. This covers lost projection acknowledgement, roster
  and writer drift, manual conflicts, canonical assignment drift, expired evidence,
  active/inactive administrator, missing/forged/revoked authorization, in-flight
  writers, another workbook, concurrent recovery, malformed push evidence, missing
  submissions and a lost final barrier acknowledgement. Nested authorization,
  recovery and push records deny client reads/writes under strict and phase1 Rules.
- 86 units pass, zero failures/skips: coverage/credits plus intake-barrier,
  trusted-adapter and notification-reconciliation regressions. The barrier fixture
  is shared with the pre-existing HU-082 tests rather than copied into a new framework.
- Source review and `git diff --check` pass. No Android/iOS code changed in this
  block, so their accepted push-block validations are retained without rerunning
  native builds. There is no new platform parity gap.

Evidence logs: `/tmp/hu084-recovery-emulator-final.log`,
`/tmp/hu084-recovery-units-final.log`, `/tmp/hu084-recovery-lint-final.log`.
Tests use real local Firestore/Rules and a stateful Sheets fake; the external
control-plane proof is simulated, not evidence of deployed IAM or Drive fencing.
No production/shared data or real notification endpoint was accessed.

Next: review the HU-084 acceptance matrix for closeout and consolidate remaining
local/manual evidence versus HU-085 activation work. Physical assistive-technology,
API 29, Android tray/FCM, iOS cold-process/APNs delivery, real entropy/provider and
assembly decisions remain explicit gaps. Issue #268 remains open.

## Coverage push rehearsal checkpoint — 2026-09-13

Commit `3dcc84c` (`test(shifts): validate native coverage acceptance`) is pushed.
The push block is committed and pushed as `2779b2e`. It reuses
our generic Messaging transport with injected demo destinations and simulated SDK
submission. A verified inbox/effect is required; membership, offer expiry, case
revision and writer authority are checked again before claiming a send. Each
recipient has one durable submission receipt, with no raw tokens. Replays return
that receipt even if the case or destinations later change; submitting/unknown
outcomes never trigger automatic resend. APNs collapse identifiers are 64 bytes;
the longer opaque event ID remains intact in the generic payload.

Both native rehearsal routes defer coverage push opening until authentication and
until an active draft or uncertain command is resolved. Logout invalidates late
responses. Opening a notice already on screen preserves case navigation. Normal
live routes do not forward coverage events into the seasonal-planning detail.
The iOS system-tap journey exposed a UIKit main-thread assertion in the existing
async delegate completion bridge. The supported completion-handler signature now
copies the immutable reference and finishes on MainActor, including invalid payloads.
No SDK notification crosses the actor boundary.

Validation:

- Functions lint/build and 45 coverage unit tests pass; 108 coverage/Rules emulator
  scenarios pass, including concurrent submission, unknown SDK outcome, expired
  offers, source/writer drift and receipt replay after state/destination changes.
- Android: 502 unit tests, lint and all 25 connected tests pass on Pixel 8 Pro/API
  35, with both HU-084 opt-in journeys. The separate HU-083 fixture class is excluded.
  Cold activity Intent before login and warm `onNewIntent` both open the correct
  offered market case. Android shell notification posting is denied by the OS;
  notification-tray and real FCM delivery are not certified by those Intent checks.
- iOS: fast-unit passes 908 tests with one existing HU-083 opt-in skip; four UI-smoke
  journeys pass on iPhone 17/iOS 26.5. The final callback/composition change passes
  18 focused tests (19 parameterized executions), simulator build, Xcode MCP build
  and zero MCP warnings. The prior full release-gate evidence belongs to `3dcc84c`.
- On iPhone SE (3rd generation)/iOS 26.5, `simctl push` plus an actual Notification
  Center Open action retains the reference before login and opens the September 4
  market offer after authenticating as `d@example.test`, without accepting it.
  A second system tap with detail open preserves that case. The callback no longer
  crashes. This proves simulated OS routing, not APNs delivery or a cold-process launch.
- Recursive fixed-demo read-back contains 51 documents: the original three cases
  retain accepted/revision 3, offered/revision 2 and open/revision 1 states; six new
  receipts record simulated accepted submissions. All 51 documents remain unchanged
  after the final iOS journeys. No credit is created.
- Independent source review and Swift source-style audit pass after resolving the
  collapse-key, navigation, receipt-replay and callback findings. `git diff --check`
  is clean. No shared Firebase project, workbook or real Messaging endpoint is used.

Next grouped outcome: governed reconciliation for uncertain notification/projection
outcomes and shared-writer recovery. Real destination admission, provider selection,
physical assistive-technology/device evidence, assembly ratification and HU-085
remain explicit live gates. Issue #268 stays open. Reproduction instructions and
local evidence limits are in the bilingual native rehearsal guides.

## Native acceptance and release checkpoint — 2026-09-13

Commit `d0dbec5` (`feat(shifts): open authenticated coverage notifications`) is
pushed. The native acceptance block was subsequently committed and pushed as
`3dcc84c`; it adds opt-in native acceptance tests and documentation. Product behavior and the fixed-demo backend are unchanged.
Both platforms authenticate real local demo roles, open/cancel acceptance and
completion forms, restore the full overview and read current server state again.
Android uses production Compose at font scale 2; iOS uses Spanish and AX5.
The existing Android drawer test now scrolls before checking its offscreen rows.

Validation:

- Android: 501 unit tests pass; lint passes with 137 existing unrelated findings
  and zero shiftcoverage findings. All 25 connected tests pass on both Pixel 8 Pro
  and Small Phone, API 35, including the two new opt-in scenarios. The separate
  HU-083 Sheets acceptance class is excluded because its fixture is not running.
- iOS canonical release gate: 917 passes, five expected skips, zero failures on
  iPhone 17/iOS 26.5; Debug/Release builds and SwiftLint (509 files, zero violations)
  pass. Skips are three local HU-084 opt-in journeys, the HU-083 opt-in journey and
  the conditional launch/performance test. Strict Swift 6/nonisolated settings
  remain intact. Test-harness-only adjustments were rebuilt in the focused lane.
- Spanish AX5 role/cancellation acceptance passes on iPhone SE (3rd generation),
  and iPad mini (A17 Pro) in landscape, iOS 26.5. The xcresult retains
  admin confirmation, replacement detail and member
  offer screenshots. Controls and body content remain reachable by scrolling;
  native navigation titles abbreviate at this size. This does not certify
  VoiceOver, TalkBack, physical devices or Android API 29.
- Final recursive Firestore read-back matches all 45 baseline demo documents: cases,
  credits, effects and inbox records are unchanged after the cancellation journeys.
  iPad gestures target the list, and screenshots capture the full screen so window
  coordinates do not crop the evidence. The final iPad rerun passes with all three
  screenshots reviewed; its long admin navigation title also abbreviates at AX5.

Evidence is local: `/tmp/hu084-acceptance-release-final.xcresult`,
`/tmp/hu084-acceptance-iphone-se-6.xcresult`,
`/tmp/hu084-acceptance-ipad-3.xcresult`, and Android connected-result XML/logs.
The bilingual rehearsal guides retain reproducible opt-in commands.

Next grouped outcome: integrate and test actual OS notification routing and dispatch
through the existing notification pipeline, keeping the isolated/live boundary.
Physical assistive-technology acceptance remains pending; shared-writer recovery,
real entropy selection, assembly ratification and HU-085 still gate live activation.
No production/shared workbook or real notification service was modified. Issue #268
stays open.

## Authenticated notification rehearsal checkpoint — 2026-09-13

Commit `c672c76` (`feat(shifts): rehearse coverage effects`) is pushed. Commit `d0dbec5` now publishes the validated equivalent
iOS/Android inbox-to-case navigation. The server resolves only an authenticated
recipient's delivered event, binding the completed effect and receipt to the
current minimal case. Affected helpers/market companions can read that projection
without administrative reasons, other members' credits or new command privileges.
Old offers show current state; copied, forged, pending and inactive-user references
are denied. Refresh retains notification scope, and Back restores the full overview
even during a pending request, without replaying or discarding an uncertain command.
Session changes invalidate late reads and navigation intent.

The native fixture now seeds a readable in-memory workbook and drains new effects
automatically. Native iOS market acceptance produced a completed effect and a third
simulated workbook batch. A further September 8 delivery vacancy makes restoration
of the full overview observable. No shared workbook, real Firebase project, FCM
send or notificationEvents fan-out is involved.

Validation:

- Functions build/lint and 45 coverage units pass; 103 Firestore/Rules and 22 real
  local Auth/HTTP scenarios pass, including recipient-reference authorization.
- Android passes 501 unit tests, lint (no coverage findings; unrelated baseline
  findings remain), and 23 connected tests on Pixel 8 Pro/API 35. The opt-in HU-083
  Sheets acceptance class is excluded because its separate fixture is not running.
  Runtime inspection confirms local notices open and refresh accepted delivery.
- iOS passes 906 tests with one existing opt-in HU-083 skip on iPhone 17/iOS 26.5,
  four UI-smoke journeys and explicit notification-to-market acceptance. That UI
  journey verifies Back both before and after acceptance. The final pending-request
  correction is additionally covered in both native unit suites, including response
  loss without command replay. SwiftLint is clean.
- Independent source review resolved recipient access, refresh scope and Back-during-
  request findings. Xcode MCP did not expose this worktree, so the repository runner
  and closed native xcresult bundles provide the build/test evidence; no new MCP
  previews or VoiceOver acceptance are claimed. `git diff --check` is clean.

Next grouped work: reconcile the remaining acceptance matrix and run the full release
validation, grouping simulator/device, accessibility and role scenarios. Real OS push
routing/dispatch, governed shared-writer recovery and entropy-provider selection
still need their integrations and decisions; assembly ratification and HU-085 retain
the live activation boundary. The story stays open; this is local integration evidence.

## Start checkpoint — 2026-09-12

The maintainer requested grouped implementation on branch
`codex/hu-084-stable-shift-coverage-and-credits`, based on merged HU-083 (`327e563`),
and authorized provisional local work on 2026-09-12. Assembly policy and live
activation remain unratified. This branch has local coverage lifecycle,
reserve/volunteer selection, committed draws/admin recovery, seasonal credit
planning and governed forward/inverse publication. Frozen whole-unit omissions and
inverse recovery were committed and pushed as `1ea675f`.

The authenticated loopback API was committed and pushed as `70a1778`. Its
verification includes 45 coverage/HTTP unit tests, 31 security tests, 294 planning
regressions, 87 Firestore/Rules tests and 17 HTTP/Auth/Firestore emulator scenarios.

Commit `99c5777` published the equivalent native repositories and session owners.
Commit `455d27a` published Debug-only member/admin screens connected to
isolated Auth-emulator sessions, with absence and offer forms, selection actions,
completion/failure, own credits/reserves, localized copy and explicit uncertain
operation retry. Both platforms revalidate session, revision, action and expiry
before confirming. Minimal names distinguish market vacancies and retain inactive
future owners for admin absence forms without offering them as replacements.

Validation: Functions lint/build, 45 unit tests and 20 real Auth/Firestore emulator
scenarios pass. Android passes 495 unit tests and 23 connected tests on Pixel 8 Pro
API 35; lint passes with no coverage diagnostics and existing unrelated findings.
iOS iPhone 17/iOS 26.5 passes 900 tests, one existing HU-083 opt-in skip and the four
UI-smoke journeys; SwiftLint is clean. Explicit native HTTP tests demonstrated iOS
market acceptance and own-credit read at AX5. Android UI confirmed past delivery
completion and the replacement's earned credit. Direct local Firestore read-back
confirmed market accepted rev3, delivery completed rev4 and one pending credit.
Independent architecture/UI reviews closed all actionable findings; VoiceOver and
the full adaptive-device matrix remain open.

Rehearsal instructions: `docs/testing/hu084-native-rehearsal.md` and its Spanish
counterpart. The current backend checkpoint persists atomic command effects,
projects effective assignees/prospective helpers through the existing HU-083 readable
adapter and releases generic inbox records only after verified projection. It retains
exact submissions on uncertain responses, rejects manual conflicts and source drift,
preserves notes/formulas/owners, and prevents duplicate credits or inbox entries.
This uses the fixed Firestore demo and an in-memory workbook; the native UI fixture
does not auto-drain it. No notificationEvents fan-out or FCM dispatch is introduced.

Validation adds 101 Firestore/Rules scenarios (14 effects integrations), 72 Sheets
scenarios, 45 coverage units, 20 Auth/Firestore HTTP scenarios, 31 backend/security
scenarios and 294 planning units, with lint/build clean. The planning unit lane has
51 explicitly emulator-dependent skips. Native sources are unchanged since `455d27a`;
those gates were not repeated for this backend checkpoint.

Next grouped outcome: authenticated case-specific notification detail/navigation in
both native rehearsals and integrated reconciliation, then full release/device
acceptance. Real dispatch, external multi-writer recovery, entropy selection,
assembly ratification and HU-085 activation remain pending. No live endpoint, shared
Firebase/Sheets write or notification dispatch was introduced. The story remains
open. See `plan.md` for current contracts, validation and evidence boundaries.

The operational plan groups work into three complete outcomes: coverage backend
with persistence/security/tests; credit/membership/atomic-planner integration;
then equivalent member/admin mobile flows plus Sheets and integrated validation.
Avoid per-helper/per-test cuts. Reuse HU-082 eligibility, ownership, admission and
HU-083 projection/event infrastructure. Detailed plan: the existing `plan.md` below.

## Tracking

- GitHub issue: #268
- URL: https://github.com/JFrancoG/ReguertaPlus/issues/268
- State: IN PROGRESS / PROVISIONAL LOCAL IMPLEMENTATION
- Planning branch: `codex/hu-082-shift-operations-planning`
- Implementation branch: `codex/hu-084-stable-shift-coverage-and-credits` (explicitly requested; policy ratification not inferred)
- Depends on: HU-082 / #266 and HU-083 / #267
- Independent production activation: HU-085 / #269

## Summary

Keep every unaffected published assignment stable. Resolve one vacancy through
the proposed sequence `reserve FIFO -> volunteers -> compensated auditable draw
-> admin`, always with explicit acceptance. A completed coverage earns one
same-type credit whose first skip attempt is the owner's first eligible
unactivated occurrence; safe staffing may defer it for retry.

This is a proposal derived from the maintainer's joins/departures/volunteer
questions. The authoritative requirements reserve the final policy for the
assembly, so issue creation is traceability, not approval.

## Non-negotiable safety properties in the proposal

- Never shift everybody's published dates after a join/departure/absence.
- Keep immutable rotation ownership separate from effective assignment.
- Never use opaque random selection or silently force a candidate.
- Commit the candidate snapshot and non-manipulable seed derivation before drawing;
  forbid admin seed grinding, snapshot replacement, and reroll after outcome preview.
- Award credit only after completed coverage; consume it once and never in a
  previously active/public round.
- A credit is first attempted at the owner's first eligible unactivated
  occurrence; a safely deferred credit stays pending and retries later.
- Safe default: one accepted/incomplete same-type coverage or unconsumed credit at a
  time. The assembly must ratify it or define the stacking cap/proximity, eligibility,
  ordering, cancellation, and consumption rules.
- One whole delivery slot or three-person market is solved atomically. Resting
  credited owners cannot work that unit; if staffing is impossible, tentative
  consumptions roll back in reverse queue order until feasible. A restored owner
  works and serves that position; only their credit stays pending for retry.
- Delivery coverage/credit candidates must differ from both adjacent effective
  leads. CAS includes adjacent assignment/completion revisions; if N=2 or any other
  case has no valid filler, the credit defers/backtracks or coverage escalates rather
  than creating the same lead/helper.
- Backtracking is the complete safe proposal. Any alternative coverage fallback
  requires assembly-approved accounting for both credits, completion/failure,
  and the original owner ultimately working.
- The full same-type ledger version is in the stage digest. Any intervening
  issue/consume/cancel change invalidates activation, which commits selected
  credit and cursor transitions atomically.
- Preview/stage do not freeze a future cohort. A round freezes on first public
  activation, and a new member joins the next still-unfrozen round.
- A departure may regenerate only a still-unfrozen round. In a frozen round, owner/
  cohort never change: public positions use coverage; the safe proposal gives an
  unpublished owner position an `excusedDeparture` tombstone that proposes round
  advancement only through the complete-unit atomic activation below, without a
  shift, completion, credit, or replacement owner. The
  assembly may choose coverage instead only with complete slot/cursor/credit rules.
- A tombstone never advances alone: it commits atomically with cursor/round closure
  and a complete affected physical unit. If delivery N=2, market N=3, or multiple
  losses cannot staff that unit under all invariants, nothing changes and the
  ratified coverage/admin fallback or blocked state applies.
- Eligibility can change without membership exit. The live HU-082 predicate governs:
  unfrozen rounds deterministically remove/append after invalidating preview/stage;
  frozen rounds preserve owner/cohort and use ratified reason-specific coverage or
  `excusedIneligible`. Re-eligibility enters reserve/next unfrozen round and never
  revives an old tombstone. `Compras Regüerta` remains eligible; real producers do not.
- The proposed reserve FIFO crosses the seasonal boundary. The assembly must
  decide whether reserve status ends on future-cohort activation, when the first
  regular turn is due/completed, or at another explicit boundary.
- Helper recomputation is prospective: an uncompleted predecessor follows the next
  effective lead; completion freezes its actual helper/revision/time. Later coverage/
  credit or HU-016 swap preserves completed history and rotation ownership.
- Keep HU-016 reciprocal swaps separate.
- Keep Android/iOS behavior and notifications equivalent.

## Links

- Spec: `spec/shifts/hu-084-stable-shift-coverage-and-credits/spec.md`
- Plan: `spec/shifts/hu-084-stable-shift-coverage-and-credits/plan.md`
- Tasks: `spec/shifts/hu-084-stable-shift-coverage-and-credits/tasks.md`

## Live activation gate

- [ ] Assembly decision/date and accepted wording linked.
- [ ] Normal-round tail placement and simultaneous-join ordering explicitly
  ratified or amended.
- [ ] Frozen-round unpublished departure handling is ratified: proposed audited
  tombstone/skip or a complete coverage alternative with physical-slot, owner,
  cursor, round-closure, completion/failure, and credit accounting.
- [ ] Tombstone/eligibility skip atomicity with the next complete physical unit and
  the zero-mutation N=2 delivery/N=3 market/multiple-loss fallback is ratified.
- [ ] Every HU-082 eligibility-transition reason is mapped across unfrozen/frozen
  and preview/stage/public states, including re-entry ordering and whether frozen
  unpublished positions use coverage or reason-coded `excusedIneligible`.
- [ ] Reserve-exit boundary and deterministic whole-unit credit rollback or
  fully accounted coverage fallback explicitly ratified.
- [ ] English/Spanish requirements updated.
- [ ] Spec/issue reconciled and maintainer-approved.
- [x] Implementation branch explicitly requested and created on 2026-09-12.
- [x] Provisional local implementation explicitly authorized on 2026-09-12.
- [ ] Assembly ratification and complete integration authorize live activation.

## Suggested labels

- `type:feature`
- `area:shifts`
- `platform:cross`
- `priority:P1`


## Governed recovery implementation — 2026-09-13

Approved next grouped outcome: recover fixed-demo projection and push effects using
HU-082's trusted closed-intake barrier and backend-owned, operator-bound authorization.
Bind authorization to the exact current evidence, require closed maintenance, verify
external evidence before committing, and preserve operation history. Reuse HU-083
read-only inspection: recovery cannot patch Sheets or resend push. Verified current
projections can release their generic inbox; superseded effects can be retired only
with exact projected rows still matching canonical assignments. Unverifiable rows
keep their reservation. Interrupted push submissions remain unknown, never delivered.
Replays and concurrent recovery must not duplicate inbox, alter credits or reopen
writers. Validate denial, drift, crashes/unknown outcomes and cross-season projection
recovery in the existing emulator suites. This does not supply live IAM/Drive controls,
real destination admission or new client/operator endpoints; those remain HU-085.
