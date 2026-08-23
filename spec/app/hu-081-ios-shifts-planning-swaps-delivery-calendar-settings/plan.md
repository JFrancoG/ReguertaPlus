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

## Phase 3 - Shifts feed ownership

- Characterize authorized entry, identity/role/environment changes, retry,
  re-entry, cancellation, non-cooperative reads, and successor cleanup.
- Retain one refresh owner for Shifts + swap feed where their atomic publication
  requires it; otherwise justify separate owners with tests.
- Preserve latest-wins and acknowledgements without allowing stale cleanup.
- Keep next-shift and board display projection pure and Madrid-consistent.

Gate: feed/session ownership cohort + root composition guards + fast-unit.

## Phase 4 - swap mutation ownership

- Characterize create/respond/cancel/apply overlap, double submit, route exit,
  session demotion, late success/failure, acknowledgement refresh, and retry.
- Retain/cancel mutation tasks under one cohesive owner or separate owners only
  when operations may safely coexist.
- Preserve backend result acknowledgement and refresh ordering.

Gate: swap ownership cohort + repository command suite + fast-unit.

## Phase 5 - planning and Delivery Calendar ownership

- Characterize admin authorization before generation/I/O, concurrent planning,
  calendar refresh vs mutation, sheet dismissal, stale writes, and successor
  sessions.
- Give planning and calendar independent owners only if their lifetimes differ;
  otherwise retain one cohesive admin-operations Store.
- Ensure Settings bindings call semantic intents and do not mutate owner state
  directly when that bypasses invariants.

Gate: admin/calendar/planning cohort + session/role guards + fast-unit.

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
- Preserve checkpoint `b956f09` on the remote feature branch and request
  separate authorization before PR, merge, closure, or branch cleanup.

## Initial risks and controls

| Risk | Control |
| --- | --- |
| Client refactor changes backend-authoritative behavior | Characterize payload and Function contract; no Function edits |
| Store split weakens atomic state | Split only from lifecycle tests; retain facade/composition |
| Calendar fix changes historical millis | Pure Madrid policy tests at ISO/DST boundaries; no live rewrite |
| Global timezone cleanup expands scope | Limit to touched Shifts/Calendar/Settings seams and record residual RNF-02 |
| New UI tests call live services | Use existing mock-auth/in-memory launch paths only |
| Settings reopens Products/Auth | Keep appearance/root and unavailable-mode/Products owners unchanged |

## First executable step

Replace the incorrect regular-member Calendar expectation with a focused RED:
an active member must load the default and weekly exceptions, while mutation
and planning stay admin-only. Then apply the smallest role-boundary GREEN
before entering the explicit-timezone policy tests.
