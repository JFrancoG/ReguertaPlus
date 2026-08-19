# HU-074 - Adopt nonisolated and restore the iOS build

## Metadata

- issue_id: #249
- priority: P1
- platform: ios
- status: in-progress

## Authorization and delivery boundary

Authorization source: the maintainer's 2026-08-19 message in the Codex task,
quoted verbatim: "Pues empieza, crea ADR y spec con su issue asociada, abrimos
rama y empezamos fase 0".

The maintainer activated the next step in the same Codex task on 2026-08-19,
quoted verbatim: "autorizada fase 1".

After local validation closed, the maintainer authorized delivery and the next
independent story in the same Codex task on 2026-08-19, quoted verbatim: "haz
commit y push, y cerramos fase 1 y empezamos fase 2".

Together, those instructions cover the ADR, story artifacts, associated issue,
branch, Phase 0 governance/baseline, Phase 1 implementation and validation,
commit, push, technical closure of Phase 1, and the separate Phase 2 bootstrap.
They do not authorize pull request, merge, issue closure, branch deletion, or
expanding HU-074 with Phase 2 implementation.

HU-074 is the first executable unit of the broader iOS refactor program. Its
acceptance scope is limited to Phase 0 and the atomic Phase 1 compilation
recovery. The later phases in `plan.md` are an ordered roadmap. Each requires a
new canonical HU, issue, branch, measurable inventory, validation matrix, and
explicit activation after its predecessor gate closes.

## Context and problem

Reguerta's iOS target uses Swift 6, complete strict-concurrency checking,
Approachable Concurrency, and an iOS 26 deployment target. Unannotated
declarations previously inferred `MainActor` isolation from the app target's
module-wide default. That hid ownership decisions in Domain, Data, App
composition, and Presentation.

The maintainer intentionally changed the app target's Debug and Release
configurations to `SWIFT_DEFAULT_ACTOR_ISOLATION = nonisolated`. Phase 1 has
since moved that policy to the project-level Debug and Release configurations,
where the app, unit-test, and UI-test targets inherit it. Source/test recovery
and the complete validation matrix are green locally; repository delivery is
not authorized by this story activation.

The reproducible Phase 0 build stops at three actor-isolation errors in the
authorized-session and critical-data-freshness use cases. They expose ownership
and synchronous-ordering contracts that must be resolved deliberately; they
are not a reason to annotate the whole application with `@MainActor`.

The migration must preserve the session, lease, cleanup, and context rules
accepted by ADR-0008, ADR-0009, and ADR-0010. The setting change and the
minimum source fixes required to restore compilation are therefore one atomic
cut.

## User story

As an iOS maintainer, I want every first-party target to inherit an explicit
`nonisolated` module default and the affected owners to declare their real
isolation, so that the project compiles under Swift 6 without hiding
concurrency errors or changing established behavior.

## Scope

### In scope

- Establish ADR-0011 and aligned English/Spanish governance and stack docs.
- Persist the current toolchain, source/test inventory, strict-lint result, and
  reproducible compiler-diagnostic ledger.
- Move `SWIFT_DEFAULT_ACTOR_ISOLATION = nonisolated` to one project-level
  Debug/Release authority inherited by the app, unit-test, and UI-test targets.
- Keep Swift 6, complete strict concurrency, and Approachable Concurrency
  enabled.
- Add explicit `@MainActor` only to UI-owned observable state and the
  composition operations that construct it.
- Resolve every compiler diagnostic exposed by the setting change, including
  authorized-session, synchronous environment-routing, freshness/local-store,
  App-factory, and Firebase ownership diagnostics, without unsafe escapes.
- Preserve synchronous invalidation, lease/context ownership,
  cleanup-before-successor ordering, cancellation, fail-closed behavior, and
  late-result rejection.
- Compile Debug and Release, run the focused ownership/security suites, and run
  the repository's standard iOS test gate.
- Keep Firebase 12.15.0 and all other dependency pins unchanged.

### Out of scope

- The roadmap phases after compilation recovery: validation-lane redesign,
  full environment/Firebase cleanup, composition-root and shell refactor,
  adaptive-layout migration, feature slices, broad test modernization,
  mechanical API cleanup, and release hardening.
- APIs, project settings, or rules exclusive to iOS or Xcode 27.
- Firebase/SPM dependency upgrades.
- Firebase deploys, Rules changes, Functions changes, backfills, or live-data
  mutation.
- Product behavior changes unrelated to compilation recovery.
- Android code; HU-074 has no cross-platform behavior change.
- Reopening HU-073 or repeating its completed struct-construction work.
- A blanket `@MainActor`, unsafe Sendable conformance/import, `Task.detached`,
  GCD workaround, or equivalent migration escape.
- Commit, push, pull request, merge, issue closure, or branch deletion without
  separate authorization.

## Linked requirements and decisions

- `AGENTS.md` repository workflow and Swift conventions.
- ADR-0001: MVVM and Clean Architecture.
- ADR-0002: iOS 26 minimum platform version.
- ADR-0004: root dependency injection for iOS SwiftUI.
- ADR-0008: bounded session operations and definitive cleanup.
- ADR-0009: process-live push authorization.
- ADR-0010: community refresh ownership and context invalidation.
- ADR-0011: `nonisolated` default actor isolation and explicit ownership.
- HU-073: delivered struct construction and inferred-sendability rules.
- GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/249
- Reproducible baseline: `phase-0-baseline.md`.

## Acceptance criteria

- ADR-0011, this spec, plan, tasks, issue mirror, `AGENTS.md`, and English and
  Spanish stack docs agree on the target policy and migration status.
- The app, `ReguertaTests`, and `ReguertaUITests` targets inherit an effective
  `SWIFT_DEFAULT_ACTOR_ISOLATION = nonisolated` value from one project-level
  authority in Debug and Release.
- Swift 6, complete strict concurrency, and Approachable Concurrency remain
  enabled for all three targets.
- The Debug app build succeeds with the `Reguerta` scheme for a generic iOS
  Simulator destination and code signing disabled.
- The Release app build succeeds with the `Reguerta-Production` scheme for a
  generic iOS Simulator destination and code signing disabled.
- The standard `Reguerta` scheme test gate succeeds on an available iOS
  Simulator, with the exact destination and test count recorded.
- Focused authorized-session, environment-routing, freshness, and root
  dependency tests pass.
- The Phase 0 diagnostic ledger has no open entry and a final full build exposes
  no remaining actor-isolation error in first-party code.
- No new `@preconcurrency`, `@unchecked Sendable`, `nonisolated(unsafe)`,
  `Task.detached`, GCD-based workaround, or equivalent escape is introduced.
- Observable presentation state and its true UI owners declare `@MainActor`
  explicitly; Domain types are not isolated to the main actor for convenience.
- Session invalidation, leases, generations, cleanup-before-successor,
  cancellation, fail-closed behavior, and late-result rejection remain covered
  and intact.
- `Package.resolved` is unchanged and Android impact is recorded as none.
- An independent architecture/concurrency review has no unresolved finding.

## Phase 1 verification contract

| Gate | Command or evidence | Required result |
| --- | --- | --- |
| Effective settings | `xcodebuild -project Reguerta.xcodeproj -target <target> -configuration <configuration> -showBuildSettings` for 3 targets x 2 configurations | One inherited `nonisolated` authority; no target override |
| Debug build | `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO` | Exit 0 |
| Release build | Same command with `Reguerta-Production` and `Release` | Exit 0 |
| Standard tests | `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=<available simulator>' test` | Exit 0; destination and counts recorded |
| Focused tests | Exact test identifiers selected from auth, routing, freshness, and root-dependency suites after compilation | Exit 0; identifiers and counts recorded |
| Dependency pin | `git diff -- ios/Reguerta/Reguerta.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` | Empty |
| Unsafe escapes | Structural search plus independent review | No new escape |
| Repository diff | `git diff --check` and explicit-path status review | Clean and in scope |

## Dependencies

- Xcode 26.6 and Swift 6.3.3 are the approved maintenance toolchain at story
  start.
- Firebase iOS SDK remains pinned to 12.15.0.
- Existing session, freshness, data-integrity, and routing tests are the
  behavior-preservation baseline.
- Phase 1 cannot be delivered while any target fails to compile. The
  setting-only change is not an acceptable executable cut.

## Risks

- Blanket `@MainActor` annotations could hide incorrect ownership.
  - Mitigation: classify each diagnostic by state owner and isolate the
    narrowest coherent boundary.
- Turning a synchronous environment fence into an actor hop could break
  security ordering.
  - Mitigation: preserve the non-suspending transition and the ADR-0008/9/10
    ownership and cleanup contracts before selecting an implementation.
- Firebase reference types are not safely transferable by assumption.
  - Mitigation: retain them in the responsible Data or App infrastructure
    adapter and cross boundaries with immutable values or typed errors.
- Fixing only the first compiler batch could produce a false green claim.
  - Mitigation: refresh the ledger after every root cluster and run full Debug,
    Release, and test gates before closure.
- Phase 1 could absorb unrelated refactoring.
  - Mitigation: defer every non-essential layout, navigation, composition,
    naming, test-migration, and API cleanup to its separately activated HU.

## Definition of Done (DoD)

- [x] All HU-074 acceptance criteria are validated.
- [x] ADR-0011 implementation status reflects the executable result.
- [x] The diagnostic ledger contains final status and validation evidence.
- [x] Debug, Release, focused tests, standard tests, and `git diff --check`
  pass with exact commands and results recorded.
- [x] Architecture/concurrency review has no unresolved finding.
- [x] English and Spanish decision/stack documentation remains aligned.
- [x] Android parity impact is recorded as none.
- [x] Issue #249 contains the final evidence for the authorized delivery step.
