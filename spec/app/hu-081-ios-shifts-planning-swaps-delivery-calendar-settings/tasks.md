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
- [x] Add explicit-timezone contract tests before production changes.
- [x] Capture a valid RED for device-timezone-dependent construction.
- [x] Move ISO week and window construction to Domain.
- [x] Use one Madrid authority for delivery/block/open/close instants.
- [x] Preserve malformed-key behavior, exception-only writes, and default deletion.
- [x] Run focused calendar/admin suites and fast-unit.

Phase 1B evidence: 30 logical / 46 concrete focused executions passed; the
policy passed 5 logical / 21 concrete executions under both `TZ=UTC` and
`TZ=America/New_York`; canonical `fast-unit-v1` passed 789 logical / 996
concrete executions. SwiftLint found zero violations in 438 files. Functional
commit `fc1157e` and documentation commit `be2cdfd` are published on the
verified upstream branch.

## Phase 2 - swap command boundary

- [x] Capture stale-local-feed denial RED with an authoritative fake repository.
- [x] Characterize create/respond/cancel/apply payload fields.
- [x] Replace request-carrying transitions with minimal typed commands.
- [x] Preserve Functions as candidate/application/notification authority.
- [x] Map no-candidate and other transport outcomes to typed localized feedback.
- [x] Remove false client mutation authority and unused notification dependency.
- [x] Run Domain/Data/VM/Functions-boundary cohorts and fast-unit.

Phase 2 evidence: the valid stale-feed RED proved Presentation denied create
before making any repository call. The GREEN sends only typed command inputs,
preserves the existing Functions union and notification transaction, maps the
transport taxonomy to localized feedback, and gives the in-memory authority
explicit actor, transition, and timestamp semantics. Focused boundary/VM/
composition suites and Functions security tests passed. Canonical
`fast-unit-v1` passed 796 logical / 1,018 concrete executions; `ui-smoke`
passed all four journeys. SwiftLint found zero violations in 440 files.
Functional commit `fae4da0` is published on the verified feature branch.

## Phase 3 - feed ownership

- [x] Characterize entry/re-entry, retry, cancellation, identity, role, and environment drift.
- [x] Decide one cohesive feed owner or independently justified owners.
- [x] Retain/cancel read tasks and preserve latest-wins/owner-only cleanup.
- [x] Preserve next-shift and board display contracts.
- [x] Run feed/session/composition cohort and fast-unit.

Phase 3 is complete locally. The valid RED proved that a same-context feed
successor lost pending initial Calendar hydration. The GREEN retains one weak,
atomic Shifts + swap-request feed owner, transfers the pending exact-context
Calendar intent only to an equivalent successor, preserves Feed -> Calendar
ordering, and distinguishes feed-only role drift from full identity,
admin-access, environment, and invalid-authorization reset. Focused ownership
and Calendar tests passed 12 logical / 15 concrete executions; the expanded
cohort passed 79 / 87; canonical `fast-unit-v1` passed 808 / 1,033; and
SwiftLint passed 0 / 444.
Independent ownership, test, and scope reviews found zero P0-P2 issues. Phase
3 is published as `124c34d` with documentation checkpoint `5dab3e2` on the
verified feature branch. Phase 4 implementation is committed as `6df78eb`; its
documentation checkpoint and feature-branch push are authorized.

## Phase 4 - swap ownership

- [x] Characterize mutation overlap, double submit, route exit, demotion, and late completion.
- [x] Retain/cancel task owners and protect non-cooperative successors.
- [x] Preserve acknowledgement and post-mutation refresh ordering.
- [x] Run swap ownership/repository cohort and fast-unit.

Phase 4 is complete and committed as `6df78eb`. One weak retained task and one
operation identity serialize create/respond/cancel/apply, propagate caller and authorization
cancellation, and prevent stale results or cleanup from affecting a successor.
An observable authorization-boundary revision covers coalesced ABA transitions
and result-before-handler races. Role-only drift and route exit preserve an
accepted command; identity/environment drift invalidates it. Admin-capability
drift fences publication while preserving same-resource acknowledgements and
keyed uncertainty.

Acknowledgement precedes separately owned feed read-back and releases the lane.
Exact retry keys are requested shift ID for create and request ID for the other
commands. Definitive failures release the key; ambiguous failures quarantine
only that key with operation provenance. Request uncertainty clears only on an
exact reflected or terminal read-back. Missing/stale read-back retains it;
create uncertainty cannot auto-clear without a backend correlation/idempotency
key. That Functions contract remains a separate issue outside this cut.

The focused matrix passed 43 logical / 280 concrete executions, the expanded
cohort passed 105 / 124, canonical `fast-unit-v1` passed 844 / 1,303, and
SwiftLint passed 0 / 460 on iPhone 17 / iOS 26.5. Xcode built with no errors or
warnings and static scope/concurrency/project guards passed.

## Deferred continuation after issue #264

The maintainer closed the scope of #264 at the completed Phase 4 boundary. The
following Phase 5, Phase 6, and continuation gates are intentionally pending,
not failed acceptance criteria and not work claimed by this delivery. They must
be re-audited from the future `main` after a separate Shifts adjustment merges.

## Phase 5 - planning and calendar ownership

- [ ] Characterize authorization before generation/I/O for every admin operation.
- [ ] Characterize planning overlap and calendar refresh/mutation/sheet lifetimes.
- [ ] Introduce only cohesive Store boundaries demonstrated by tests.
- [ ] Replace direct state bypasses with semantic intents where required.
- [ ] Run admin/planning/calendar/session cohort and fast-unit.

Remaining Presentation `Calendar.current` and implicit formatter-timezone
cleanup belong to Phase 6 of the future HU-081 continuation issue, not to Phase 5.

## Phase 6 - UI, previews, accessibility, and motion

- [ ] Add real-route deterministic state matrix for Shifts/Swaps/Calendar/Settings.
- [ ] Add member and admin focused mock UI journeys.
- [ ] Reassess touched multi-View files by cohesive responsibility.
- [ ] Validate phone/iPad, Large/XXX Large/AX5, ES/EN, light/dark, contrast, and motion.
- [ ] Complete VoiceOver/Voice Control and physical-device acceptance.
- [ ] Run independent SwiftUI/accessibility review and close P0-P3 findings.

## Deferred continuation gates

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
- [x] Create checkpoint documentation commit `b491e50`.
- [x] Push and verify upstream tip `b491e50`.
- [x] Obtain explicit authorization for the Phase 1B checkpoint and Phase 2 start.
- [x] Create Phase 1B Conventional Commit `fc1157e`.
- [x] Create Phase 1B documentation commit `be2cdfd`.
- [x] Push and verify the Phase 1B checkpoint on the upstream branch.
- [x] Obtain explicit authorization for the Phase 2 checkpoint and Phase 3 start.
- [x] Create and push Phase 2 Conventional Commit `fae4da0`.
- [x] Obtain explicit authorization for the Phase 3 checkpoint and Phase 4 start.
- [x] Create Phase 3 Conventional Commit `124c34d`.
- [x] Create Phase 3 documentation checkpoint `5dab3e2`.
- [x] Push and verify the Phase 3 checkpoint at upstream tip `5dab3e2`.
- [x] Obtain explicit authorization for the Phase 4 checkpoint.
- [x] Create Phase 4 Conventional Commit `6df78eb`.
- [x] Create and push the Phase 4 documentation checkpoint and verify upstream.
- [ ] Obtain explicit authorization for the Phase 5 start.
- [x] Obtain explicit authorization for PR, merge, #264 closure, and branch cleanup.
- [x] Prepare the Phase 1–4 PR with `Refs #264`, validation, and accepted deferrals.
- [x] Pass the terminal Phase 1–4 `release-gate-v1`: 856 logical tests
  (855 passed, 1 skipped, 0 failed), 1,318 concrete executions (1,314 passed,
  4 skipped, 0 failed), SwiftLint 0/460, settings 6/6, Debug/Production Release,
  and all repository guards on iPhone 17 / iOS 26.5.
- [ ] Record the definitive PR, merge, #264 closure, and branch cleanup in the
  final tracker comment after those external operations succeed.
- [x] Stop without starting Phase 5 or creating its execution item.

The current delivery authority covers the Phase 1–4 PR, review, merge, explicit
#264 closure, and local/remote branch cleanup. It does not cover Phase 5
implementation or tracker creation, live mutations, Firebase deployment,
Google Sheets, or Android work.
