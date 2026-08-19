# Tasks - HU-076

Authorization source and delivery boundaries are recorded verbatim in
`spec.md`. Phase 3 bootstrap and implementation are authorized. The maintainer's
later 2026-08-19 delivery instruction is quoted verbatim: "Haz commit y push. Antes no te dije de lanzar la PR porque no sabía si tenias una issue por fase, como veo que si, lanza la anterior y lanza esta para poder cerrar ramas y empezar la siguiente fase con todo limpio".
Commit, push, and opening the prior HU-075 and current HU-076 pull requests are
authorized and completed: HU-076 source commit `59216b5` and its synchronized
branch/upstream are published; PR #252 and PR #253 are open, ready, and
non-draft. Merge, issue closure, branch deletion, deployment, and integration
remain separate gates.

## 0. Governance and baseline

- [x] Verify HU-076 is the next free canonical story and no equivalent issue
  exists.
- [x] Create issue #251 with `enhancement`, `platform:ios`, `priority:P1`, and
  `area:app`.
- [x] Create `codex/hu-076-ios-session-environment-ownership` from published
  HU-075 tip `d079379`.
- [x] Record dependencies on #249 and #250 and the stacked-branch rule.
- [x] Select the iOS maintenance profile and confirm Xcode 26/iOS 26 scope.
- [x] Inventory globals, Firebase imports, unchecked sendability, affected
  operations, package pin, and executable lanes.
- [x] Record Phase 4's ownership of the existing Presentation composition leak.
- [x] Create the spec, plan, tasks, baseline, issue mirror, and ADR-0012 EN/ES.
- [x] Align issue #251 with the refined local scope, local artifact paths, and
  current evidence while keeping it open with labels intact.

`[!]` below records a completed end-state test obligation whose originally
planned red-first chronology cannot be demonstrated from retained evidence.

## 1. Instance-owned environment and authorized lease

- [!] Add failing tests for two independent environment owners/signals.
- [!] Add failing tests for apply/reset mutation-before-publication.
- [!] Add failing tests for stale lease and current-lease cleanup.
- [!] Add a failing test proving candidate member failure does not publish the
  candidate environment.
- [x] Replace the process-global environment with one injected owner per graph.
- [x] Co-own effective state and transition signal.
- [x] Read the exact member from an explicit candidate environment.
- [x] Publish the route only after exact authorization succeeds.
- [x] Create and retain the environment lease at the final session commit.
- [x] Use conditional normal cleanup and preserve an explicit fail-safe path.
- [x] Pass focused environment/session lifecycle tests.

## 2. Immutable per-operation snapshots

- [x] Make Firestore path construction require an explicit environment.
- [x] Remove optional/global environment fallbacks and default arguments.
- [x] Capture one immutable `SessionEnvironment` in the initiating owner before
  each affected operation suspends or calls an actor-isolated repository.
- [x] Pass the captured environment through Products and Orders
  operations/helpers.
- [x] Pass it through Shifts, News, Notifications, Profiles, and Users.
- [x] Pass it through Functions, freshness, and media boundaries.
- [x] Adapt App composition and only the mechanically required signatures in
  the existing Presentation dependency factory.
- [x] Prove a route transition while an actor call is queued or suspended cannot
  change operation paths.
- [x] Reduce `ReguertaRuntimeEnvironment` production references from 26 to 0.
- [x] Run focused tests, fast unit, and UI smoke.

## 3. Injected development clock

- [x] Add tests for persisted override, system-time fallback, and independent
  instances.
- [x] Define the checked clock dependency and instance-owned implementation.
- [x] Compose one clock per application graph.
- [x] Replace every `DevelopmentTimeMachine.shared` call with injection.
- [x] Preserve the develop-time UI mutation and persisted override.
- [x] Reduce `.shared` references from 12 to 0 and remove its unchecked escape.

## 4. Firebase boundary clusters

- [x] Remove the retroactive unchecked sendability of `FirebaseAuth.User`.
- [x] Keep Auth SDK references inside the main-actor adapter and transfer only
  checked immutable Domain values, token strings, booleans, or typed errors.
- [x] Verify late Auth results cannot publish into a successor.
- [x] Freeze Functions environment/token context for a full request.
- [x] Preserve device registration generation/lease/live-session fences.
- [x] Re-check cancellation after Firebase callback completion so a late
  callback success cannot escape a cancelled task.
- [x] Route revoked authorization through owned local-session termination,
  invalidate the device lease/context, and retain the cleanup barrier.
- [x] Replace touched AppDelegate GCD ownership with a structured actor hop.
- [x] Verify freshness actors retain checked identity/value state only.
- [x] Pass focused Auth, Functions, devices, freshness, and UI-smoke gates.

## 5. Firestore repositories and media

- [!] Characterize repository and image-pipeline state/cancellation first.
- [x] Remove unchecked conformance from Member/Product/Commitment/Calendar.
- [x] Remove unchecked conformance from Shifts/Planning/Swap.
- [x] Remove unchecked conformance from News/Notifications/Profile/Startup.
- [x] Remove unchecked conformance from Device Registration.
- [x] Give the image pipeline explicit checked Storage ownership.
- [x] Freeze media paths and fence obsolete upload/download completions.
- [x] Reduce all 15 production `@unchecked Sendable` declarations to zero.
- [x] Confirm no replacement unsafe concurrency escape exists. The one
  pre-existing `ReguertaImagePickerField` GCD use remains outside HU-076.

## 6. Review remediations

These obligations were completed during review and are not presented as a
universal red-first chronology.

- [x] Define the canonical active-authorization entry guard: principal linkage,
  active authenticated/selected members, and valid delegated selection.
- [x] Make Products, Shifts, Freshness, Users, Shared Profile, every Orders
  route, and device-token entry fail closed before repository work when live
  authorization is invalid, including deliberately broken test fixtures.
- [x] Give same-context Orders re-entry a successor operation owner and cover
  result/cleanup ownership with nine deterministic regressions.
- [x] Fence all four Orders route models, checkout, and status mutation by the
  captured session revision with six deterministic regressions.
- [x] Qualify My Order local draft/confirmation keys by environment; prove
  develop/production separation and deliberately ignore unqualified legacy
  state whose origin cannot be established.
- [x] Fence Users with both stored and live authorization signatures; fence
  Shared Profile refresh/save/delete/upload and Products/Shifts with live
  session ownership/revision.
- [x] Separate result/error publication from cleanup: publication requires the
  current owner plus live authorization/revision or a receipt-backed self-owned
  handoff; cleanup requires only the operation owner and cannot clear a
  successor.
- [x] Make route-owned cancel-and-replace reads create a successor on re-entry;
  allow independent mutations to retain an explicit owner through benign
  re-entry only while publication remains live-session fenced.
- [x] Add 16 final owner-cleanup regressions: seven Orders reads, seven Products/
  Shifts read, entry, and no-clobber cases, and two Freshness cases. Freshness
  proves revoked payload rejection, fail-closed handle cleanup, and successor
  protection.
- [x] Add two separate post-callback regressions: email verification maps late
  success to `false`; a late FCM token throws `CancellationError` without
  persistence or registration.
- [x] Keep Orders Firestore SDK references inside the repository actor across
  all split helper files and enforce the boundary structurally.
- [x] Harden asynchronous test waiters with cancellable UUID ownership,
  double-checked registration, exactly-once removal/resume, `cancelAll`/`defer`
  cleanup, `NSCondition` for synchronous mailbox control, and bounded suites.

## 7. Executable validation and closure evidence

- [x] Run all focused ownership/security/session/Firebase/media suites after
  the complete review-remediation set.
- [x] Run strict SwiftLint 0.61.0: 363 Swift files, 0 violations.
- [x] Run the six-pair effective-settings verifier: 6/6 passed.
- [x] Run fast unit on iPhone 17 / iOS 26.5: 580/580 passed, 0 skipped,
  0 failed (574 Swift Testing plus 6 XCTest).
- [x] Run UI smoke and record 4/4.
- [x] Build Debug for a generic iOS Simulator.
- [x] Build Production Release for a generic iOS Simulator.
- [x] Run release gate: 589 logical responsibilities, 588 passed, 1 known
  skip, 0 failed.
- [x] Record the tree inventory: 363 Swift files / 62,984 lines; production
  253/36,197, unit 108/26,403, UI 2/384; 574 `@Test` declarations, 6 XCTest unit
  methods, and 9 XCTest UI methods.
- [x] Confirm global, singleton, unchecked, and unsafe-escape zero targets, plus
  the expected GCD reduction from two pre-existing uses to one with none added.
- [x] Confirm the Presentation Firebase import count did not grow.
- [x] Confirm `Package.resolved` is unchanged.
- [x] Run `git diff --check` and explicit scope review; Android and
  `project.pbxproj` have no diff.
- [x] Complete independent iOS concurrency/architecture review: 0 P0-P3.
- [x] Update ADR-0012, baseline, and issue mirror with final executable evidence,
  the complete remediation matrix, owner-cleanup contract, token-mapping TDD,
  and documented process deviations.
- [x] Record the Phase 2 SwiftLint `PATH` warning as historical, not a current
  Xcode or Issue Navigator diagnostic.
- [x] Update remote issue #251 with final local evidence, verify it remains open,
  and preserve its labels.
- [x] Obtain explicit authorization for commit, push, and opening the prior
  HU-075 and current HU-076 pull requests.
- [x] Commit the validated HU-076 source scope as `59216b5` with a focused
  Conventional Commit.
- [x] Push the HU-076 branch and verify its same-named `origin` upstream is
  synchronized.
- [x] Open PR #252 from HU-075 to the HU-074 branch and PR #253 from HU-076 to
  the HU-075 branch; verify both are ready and non-draft.
- [x] Verify issues #249, #250, and #251 remain open and HU-074 still has no pull
  request and is not integrated.

## Explicit non-tasks

- [x] Do not move live dependency construction out of Presentation in Phase 3.
- [x] Do not change product behavior, Firebase/backend/live data, Android, or
  package pins.
- [x] Do not redesign App shell, SwiftUI, layout, DesignSystem, or features.
- [x] Do not adopt iOS/Xcode 27-only APIs, settings, simulators, or rules.
- [x] Do not merge a pull request, close #251, delete branches, deploy, or
  integrate without separate authorization. The authorized commit, push, and
  prior/current pull-request opening are complete.
