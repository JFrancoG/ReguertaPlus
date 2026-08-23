# HU-081 implementation plan

## State

- status: in_progress
- plan_state: approved
- issue: #264
- branch: `codex/hu-081-ios-shifts-planning-swaps-delivery-calendar-settings`
- base: `35a874288e3844d9c3d88abbaa39e2fb6fef42b2`
- profile: iOS maintenance

## Delivery principles

1. Preserve delivered product behavior unless a source-backed regression test
   proves a defect.
2. Capture a valid focused RED before every risk-bearing production change.
3. Keep Functions authoritative for live swap eligibility/application while
   making the client command boundary truthful.
4. Move stable business policy inward to Domain and transport outward to Data;
   do not create ceremonial use cases or empty layers.
5. Split operation/state ownership only where lifecycle, cancellation, or
   composition evidence justifies it.
6. Preserve active authorization, session revision, member/role, environment,
   and owner-only cleanup before and after every suspension point.
7. Do not mutate live Firebase/Sheets, alter backend behavior, or enter later
   Phase 6 slices.

## Phase 0 - activation and frozen baseline

- Resolve HU-081 and prevent duplicate issue/branch/spec work.
- Freeze base, profile, settings, whole-tree and slice inventories.
- Map every repository, operation ID, unretained task, state group, route,
  preview, test, and composition seam.
- Map RF-TURN, RF-CAL, RNF-02, earlier HUs, ADRs, and Function authority.
- Publish the issue mirror and keep issue/spec/plan/tasks aligned.

Exit: activation artifacts are decision useful, the worktree contains only
HU-081 planning files, and the first RED is exact.

## Phase 1 - Delivery Calendar access and Madrid policy

### Phase 1A - active-member read boundary

RED:

- Replace the test that expects nil/empty Calendar state for a regular member
  with a regression proving an active member loads the default and exceptions.
- Prove the same regular member still cannot persist an override or submit a
  planning request.
- Preserve active-session, identity, environment, generation, cancellation,
  and owner-only publication fences around the read.

GREEN:

- Separate Calendar read authorization from mutation/planning authorization.
- Keep every Calendar write and planning request behind the existing live
  admin context before generation mutation or repository I/O.
- Preserve shared Calendar state consumed by `My Order`, `Received Orders`,
  and Home without introducing a second owner.

Gate: focused member/admin Calendar suite + authorization guards + fast-unit.

### Phase 1B - Madrid Delivery Calendar policy

RED:

- Add a pure Swift Testing contract that requests the same `weekKey` under
  multiple simulated device timezones and expects identical Madrid-derived
  delivery, blocked, open, and close instants.
- Characterize malformed week keys, weekday bounds, end-of-year ISO weeks, DST
  boundaries, and the return-to-default delete decision.
- Confirm the RED belongs to the missing Domain contract/current helper rather
  than global process-timezone mutation or test setup.

GREEN:

- Move week parsing and window construction into a Domain policy/value factory.
- Reuse or generalize the existing Madrid business-calendar authority without
  creating two timezone sources.
- Keep Settings as editor/coordinator and Data as persistence adapter.
- Preserve exception-only writes and default deletion.

Gate: focused calendar policy + existing admin/calendar suites + fast-unit.

### Executed Phase 1 evidence

Phase 1A is completed and published. Commit `b956f09` contains the functional
read-boundary fix and `b491e50` records the checkpoint at the verified remote
tip.

Phase 1B is completed in commit `fc1157e`. The sequence captured a valid
old-helper RED, then introduced one guarded Madrid business calendar, strict
ISO week validation, DST-safe window construction, the allowed
Tuesday/Thursday/Friday exception policy, exact selection behavior, and zero
repository writes for default/unchanged no-ops. The same policy selector ran
from temporary `.xctestrun` copies with `TZ=UTC` and
`TZ=America/New_York`; both passed without mutating the global simulator
timezone.

The final focused cohort passed 30 logical / 46 concrete executions, and the
canonical final `fast-unit-v1` passed 789 logical / 996 concrete executions on
iPhone 17 / iOS 26.5. SwiftLint reported zero violations across 438 files.
Presentation-only `Calendar.current` and implicit formatter timezone use remain
for the later display/UI phases of HU-081.

## Phase 2 - truthful swap command boundary

RED:

- Prove a current authorized member can submit create to a fake authoritative
  repository even when the local feed cannot project candidates.
- Characterize the exact create/respond/cancel/apply command fields and prevent
  client request-model mutations from becoming transport authority.
- Prove backend `no_shift_swap_candidates` maps to specific localized feedback;
  permission, conflict, unavailable, invalid data, and cancellation remain
  distinct where the existing transport exposes them.

GREEN:

- Replace request-carrying transitions with minimal typed Domain commands.
- Map those commands in Data to the existing Function payload without changing
  Functions.
- Treat local candidates as display guidance only; the backend owns create
  eligibility and candidate count.
- Remove client-side application calculations that cannot be authoritative,
  retaining only pure display projections still consumed by UI.
- Remove the unused Shifts notification dependency while preserving
  Function-owned notification writes.

Gate: focused Domain/Data/VM boundary suite + Functions security contract tests
+ fast-unit.

### Executed Phase 2 evidence

The stale-feed test first failed because Presentation returned before calling
the authoritative repository. The completed boundary now exposes only typed
create/respond/cancel/apply inputs from Domain; Data alone maps them to the
existing Functions payload union. Presentation no longer builds authoritative
candidate, response, cancellation, or application request models, and local
candidate projection cannot deny create.

Backend errors retain a typed taxonomy for no candidates, permission,
conflict, transport unavailability, invalid data, unknown failure, and task
cancellation, with localized ES/EN feedback. The unused Shifts notification
dependency was removed while Functions notification writes and the separate
News/Notifications dependency remain unchanged. The authoritative in-memory
double persists create/read-back, owns transition timestamps, checks open and
accepted states, and resolves responders by authenticated member plus shift.

The focused boundary/VM/composition cohorts passed, as did all 28 Functions
security contract tests. Canonical `fast-unit-v1` passed 796 logical / 1,018
concrete executions and all four `ui-smoke` journeys passed on iPhone 17 / iOS
26.5. SwiftLint reported zero violations across 440 files; localization JSON,
`git diff --check`, project/package/Functions guards, and the independent P0-P2
review passed. Phase 2 is published as `fae4da0`; Phase 3 feed ownership is now
complete locally. The Phase 2 documentation checkpoint is published as
`3a10095`; Phase 3 and its documentation checkpoint are published as `124c34d`
and `5dab3e2`. Phase 4 swap-mutation ownership is committed as `6df78eb`; its
documentation checkpoint and feature-branch push are explicitly authorized.

## Phase 3 - Shifts feed ownership

- Characterize authorized entry, identity/role/environment changes, retry,
  re-entry, cancellation, non-cooperative reads, and successor cleanup.
- Retain one refresh owner for Shifts + swap feed where their atomic publication
  requires it; otherwise justify separate owners with tests.
- Preserve latest-wins and acknowledgements without allowing stale cleanup.
- Keep next-shift and board display projection pure and Madrid-consistent.

Gate: feed/session ownership cohort + root composition guards + fast-unit.

Phase 3 completion evidence: the valid RED timed out because a same-context
feed successor lost the pending initial Calendar hydration. The GREEN retains
one weak, atomic Shifts + swap-request feed owner; propagates cancellation to
the exact owned task; applies latest-wins and owner-only cleanup; adopts an
already-authorized session; and fences publication across principal,
authenticated-member, selected-member, role/capability, environment, and admin
changes. Role drift resets only the feed and preserves acknowledgements,
dismissals, draft, segment, and the later mutation owners; full identity or
admin-access drift, environment drift, or invalid authorization keeps the full
reset. Initial Feed -> Calendar hydration
is transferable only to an equivalent-context successor and uses the captured
`SessionContext`, preserving ordering after success or terminal feed failure.

The focused ownership/calendar cohort passed 12 logical / 15 concrete
executions; the expanded Shifts/session/composition cohort passed 79 / 87; and
canonical `fast-unit-v1` passed 808 / 1,033 on iPhone 17 / iOS 26.5. SwiftLint
reported zero violations across 444 files. `git diff --check`, the 120-column
guard, concurrency-escape scan, project-file guard, and independent ownership,
test, and scope reviews passed with zero P0-P2 findings.

## Phase 4 - swap mutation ownership

- Characterize create/respond/cancel/apply overlap, double submit, route exit,
  session demotion, late success/failure, acknowledgement refresh, and retry.
- Retain/cancel mutation tasks under one cohesive owner or separate owners only
  when operations may safely coexist.
- Preserve backend result acknowledgement and refresh ordering.

Gate: swap ownership cohort + repository command suite + fast-unit.

Phase 4 completion evidence: the valid RED showed that sign-out did not
physically cancel a suspended non-cooperative create operation. The GREEN owns
create/respond/cancel/apply through one weak retained task and one single-flight
operation identity. Owner invalidation precedes cancellation; current
identity/authorization/environment and owner checks fence late result, error,
and cleanup. An observable authorization-boundary revision closes coalesced ABA
transitions and retains a pending completion receipt when the result wins the
race against the boundary handler. Role-only drift preserves an accepted
command. Identity/environment drift cancels it; admin-capability drift is a hard
publication boundary while retaining same-resource mutation receipts. Route exit
preserves an accepted mutation, but semantic root completion only navigates
while the request route remains current.

Confirmed command acknowledgement precedes the atomic feed refresh and the
mutation lane no longer waits for read-back. Failed read-back retains that
acknowledgement and blocks ambiguous resubmission only for the exact command
key. Create is keyed by requested shift ID; respond/cancel/apply are keyed by
request ID. Definitive `noCandidates`, `permissionDenied`, and `conflict`
failures release the key. Ambiguous `unavailable`, `invalidData`, and unknown
failures quarantine it with operation provenance so a stale failure cannot
clear a newer uncertainty.

Authoritative read-back clears request uncertainty only when the exact request
is reflected or terminal; missing and stale projections retain it. Create
uncertainty cannot auto-clear because the backend command lacks a client
correlation/idempotency key. That end-to-end contract belongs to a separate
Functions issue. Same-resource relogin preserves receipts and uncertainty;
different identity/environment discards them. Nested Users public-projection
changes remain fail-closed until the actual successor session is handled.

The focused ownership matrix passed 43 logical / 280 concrete executions; the
expanded Shifts/session/repository/root cohort passed 105 / 124; and canonical
`fast-unit-v1` passed 844 / 1,303 on iPhone 17 / iOS 26.5, all without failures
or skips. SwiftLint reported zero violations across 460 files. Xcode built with
zero errors or warnings; `git diff --check`, concurrency/layer/scope guards, and the
zero-project-file-diff guard passed.

## Phase 5 - planning and Delivery Calendar ownership

- Characterize admin authorization before generation/I/O, concurrent planning,
  calendar refresh vs mutation, sheet dismissal, stale writes, and successor
  sessions.
- Give planning and calendar independent owners only if their lifetimes differ;
  otherwise retain one cohesive admin-operations Store.
- Ensure Settings bindings call semantic intents and do not mutate owner state
  directly when that bypasses invariants.

Gate: admin/calendar/planning cohort + session/role guards + fast-unit.

This phase does not absorb Presentation display cleanup. Remaining
`Calendar.current` and implicit formatter-timezone uses stay in the later
display/UI phase of HU-081, not in a separate issue.

## Phase 6 - SwiftUI, previews, accessibility, and motion

- Reassess the 17 affected View declarations by cohesive source responsibility;
  split only touched multi-View files whose boundaries are independently useful.
- Add deterministic Shifts loading/empty/content/error, swap create/incoming/
  outgoing/history/mutation, planning, calendar saving/failure, Settings role,
  appearance, and develop-time scenarios through real routes.
- Add focused XCUITest journeys:
  - member opens Shifts and completes a safe mock swap interaction;
  - admin opens Settings, planning, and Delivery Calendar without live I/O.
- Validate phone/iPad, Large/XXX Large/AX5, ES/EN, light/dark, Increased
  Contrast, Reduce Motion, VoiceOver, Voice Control, focus order, labels,
  grouping, dialogs/sheets, and touch targets.
- Run independent SwiftUI/accessibility review and remediate P0-P3 findings.

## Phase 7 - closure gates and handoff

- Run final affected cohorts on the frozen source tree.
- Run canonical `fast-unit`, applicable UI focal and `ui-smoke`, then definitive
  `release-gate` on iPhone 17 / iOS 26.5.
- Run SwiftLint strict/no-cache, effective settings 6/6, Debug, Production
  Release, layer/escape guards, package/project scope, and `git diff --check`.
- Complete required physical-device acceptance for changed UI/interaction.
- Recalculate source/test/previews and logical/concrete test counts.
- Reconcile issue mirror, spec, plan, tasks, evidence, Android parity, HU-070,
  and residual debt.
- Preserve checkpoints `b956f09`, `b491e50`, `fc1157e`, `be2cdfd`, `fae4da0`,
  and `124c34d` on the remote
  feature branch and request separate authorization before PR, merge, closure,
  or branch cleanup.

## Initial risks and controls

| Risk | Control |
| --- | --- |
| Client refactor changes backend-authoritative behavior | Characterize payload and Function contract; no Function edits |
| Store split weakens atomic state | Split only from lifecycle tests; retain facade/composition |
| Calendar fix changes historical millis | Pure Madrid policy tests at ISO/DST boundaries; no live rewrite |
| Global timezone cleanup expands scope | Limit to touched Shifts/Calendar/Settings seams and record residual RNF-02 |
| New UI tests call live services | Use existing mock-auth/in-memory launch paths only |
| Settings reopens Products/Auth | Keep appearance/root and unavailable-mode/Products owners unchanged |

## Next executable step

Publish the authorized Phase 4 implementation and documentation checkpoint on
the feature branch, then stop. Phase 5 remains unauthorized and must begin only
after separate approval, with deterministic planning and Delivery Calendar
ownership characterization before changing production ownership.
