# HU-081 tasks

## Activation

- [x] Confirm HU-081 as the next Phase 6 identifier.
- [x] Confirm no duplicate issue, PR, branch, or specification.
- [x] Synchronize clean `main` and record base `35a8742`.
- [x] Create issue #264 with canonical labels.
- [x] Create `codex/hu-081-ios-shifts-planning-swaps-delivery-calendar-settings`.
- [x] Select the iOS `maintenance` profile and preserve project settings.
- [x] Create spec, baseline, plan, tasks, and issue mirror.
- [x] Record authorization and delivery exclusions.

## Baseline and contracts

- [x] Freeze whole-tree and primary/support slice counts.
- [x] Map Domain/Data/App/Presentation files and dependencies.
- [x] Map state groups, operation IDs, unretained tasks, and session fences.
- [x] Map RF-TURN-01...07, RF-CAL-01...05, RNF-02, prior HUs, and ADRs.
- [x] Map the authoritative Function swap transaction and client payload.
- [x] Inventory direct/cross-feature tests, previews, UI automation, and gaps.
- [x] Synchronize the initial living plan to issue #264.

## Phase 1 - Delivery Calendar access and Madrid policy

- [x] Replace the regular-member nil/empty expectation with the correct read contract.
- [x] Capture RED proving an active member loads Calendar default and exceptions.
- [x] Preserve admin-only Calendar mutation and planning with focused tests.
- [x] Apply the smallest read-versus-mutate authorization fix.
- [ ] Add explicit-timezone contract tests before production changes.
- [ ] Capture a valid RED for device-timezone-dependent construction.
- [ ] Move ISO week and window construction to Domain.
- [ ] Use one Madrid authority for delivery/block/open/close instants.
- [ ] Preserve malformed-key behavior, exception-only writes, and default deletion.
- [ ] Run focused calendar/admin suites and fast-unit.

## Phase 2 - swap command boundary

- [ ] Capture stale-local-feed denial RED with an authoritative fake repository.
- [ ] Characterize create/respond/cancel/apply payload fields.
- [ ] Replace request-carrying transitions with minimal typed commands.
- [ ] Preserve Functions as candidate/application/notification authority.
- [ ] Map no-candidate and other transport outcomes to typed localized feedback.
- [ ] Remove false client mutation authority and unused notification dependency.
- [ ] Run Domain/Data/VM/Functions-boundary cohorts and fast-unit.

## Phase 3 - feed ownership

- [ ] Characterize entry/re-entry, retry, cancellation, identity, role, and environment drift.
- [ ] Decide one cohesive feed owner or independently justified owners.
- [ ] Retain/cancel read tasks and preserve latest-wins/owner-only cleanup.
- [ ] Preserve next-shift and board display contracts.
- [ ] Run feed/session/composition cohort and fast-unit.

## Phase 4 - swap ownership

- [ ] Characterize mutation overlap, double submit, route exit, demotion, and late completion.
- [ ] Retain/cancel task owners and protect non-cooperative successors.
- [ ] Preserve acknowledgement and post-mutation refresh ordering.
- [ ] Run swap ownership/repository cohort and fast-unit.

## Phase 5 - planning and calendar ownership

- [ ] Characterize authorization before generation/I/O for every admin operation.
- [ ] Characterize planning overlap and calendar refresh/mutation/sheet lifetimes.
- [ ] Introduce only cohesive Store boundaries demonstrated by tests.
- [ ] Replace direct state bypasses with semantic intents where required.
- [ ] Run admin/planning/calendar/session cohort and fast-unit.

## Phase 6 - UI, previews, accessibility, and motion

- [ ] Add real-route deterministic state matrix for Shifts/Swaps/Calendar/Settings.
- [ ] Add member and admin focused mock UI journeys.
- [ ] Reassess touched multi-View files by cohesive responsibility.
- [ ] Validate phone/iPad, Large/XXX Large/AX5, ES/EN, light/dark, contrast, and motion.
- [ ] Complete VoiceOver/Voice Control and physical-device acceptance.
- [ ] Run independent SwiftUI/accessibility review and close P0-P3 findings.

## Final gates

- [ ] Pass all affected focused cohorts on the frozen final source tree.
- [ ] Pass canonical `fast-unit`, applicable UI, `ui-smoke`, and `release-gate`.
- [ ] Pass SwiftLint, settings 6/6, Debug, Production Release, and static guards.
- [ ] Confirm zero `project.pbxproj`, package, CI, Android, Functions, or live scope drift.
- [ ] Recalculate final inventories and test counts.
- [ ] Reconcile all five HU-081 artifacts and remote issue evidence.
- [ ] Record Android parity, HU-070/#198, later slices, and accepted residuals.

## Delivery

- [x] Obtain explicit authorization for the first checkpoint commit and push.
- [x] Create focused Conventional Commit `b956f09`.
- [x] Push and verify upstream SHA `b956f09`.
- [ ] Open ready PR with validation evidence.
- [ ] Review checks/findings and remediate before merge.
- [ ] Merge, close #264, and clean branches only after confirmed authorization.

The current delivery authority stops at commit and push. PR, merge, issue
closure, and branch cleanup require separate authorization.
