# ADR-0004: Use Root Dependency Injection for iOS SwiftUI

## Status

Accepted

## Date

2026-05-11

## HU-077 Implementation Addendum

HU-077 / issue #255 materializes this accepted decision without rewriting it.
App now selects one typed live, preview, or UI-test scenario, performs all live
Firebase/Data construction, and injects a complete graph through a shared pure
`ReguertaAppEnvironment.assemble` seam. Presentation has zero Firebase imports
and no live adapter construction. The exhaustive Data boundary permits one
inherited typed error reference only:
`FirebaseFunctionClientError.unauthorized` at exactly one existing use site.
It does not permit live construction or any additional Data type reference.
`MainView` is the single shell reader of the environment; the unused root
wrappers and broad routing protocol were removed only after characterization,
and route views receive explicit inputs, bindings, and actions.

`ReguertaAppConfiguration` decodes the fourth supported launch control,
`-reguerta_dev_time_machine.override_now_millis`, once in App, requires one
adjacent `Int64`, and fails fast for malformed input. The typed initial seed
wins over persisted state. Live retains its persistent development clock;
preview and UI-test clocks are transient, isolated per graph, and routed
through root, session, features, and Freshness. Live Freshness retains its
original `Date` wall clock. The accepted `AccessRootViewModel` ownership remains
unchanged because characterization did not justify another store.

The first full release checkpoint remains honest red evidence:
`/private/tmp/hu077-final-release-gate.xcresult` recorded 615 responsibilities,
613 passed, one known launch skip, and one failure in the My Order safe-area UI
test because its search field was not found. The transient UI-test clock had
lost the launch seed `1778760000000`. The typed seed fix restored deterministic
My Order state.

Local executable evidence on iPhone 17 / iOS 26.5 then passed: focused
composition recorded 33 logical tests and 34 executions; shell/root passed
21/21; fast unit passed 608/608 (602 Swift Testing plus 6 XCTest); UI smoke
passed 4/4; and `/private/tmp/hu077-final-release-gate-2.xcresult` recorded 617
responsibilities, 616 passed, one known launch skip, and zero failures.
SwiftLint inspected 375 files with zero violations; effective settings passed
6/6; generic Debug and Production Release builds are green. The tree contains
375 Swift files and 63,992 lines: production 261/36,243, unit 112/27,365, and
UI 2/384. The post-P1 Xcode MCP rerun in `windowtab2` completed all nine Large
previews with no tool errors; Home passed one isolated retry after a transient
`PotentialCrashError`.

That 9/9 is a tool-completion result, not nine semantically unequivocal macro
selections. The dedicated startup `unavailable` preview at index 0 repeatedly
displayed `timedOut` despite its `.unavailable` source fixture. `MainView`
displayed `unavailable` for the same fixture and runtime coverage distinguishes
the states. A RenderPreview cache/selection interaction among macros sharing
one source file is the current inference, not a demonstrated app-state defect.

Final independent reconciliation reports 0 unresolved P0-P3. The maintainer's
later instruction "haz commit y push, lanza pr y cierra issue, etc" authorizes
commit, push, a ready pull request, merge, issue closure, branch deletion, and
integration for HU-077. Issue #255 remains open and the branch remains local
without an upstream while that delivery executes. Firebase deployment remains
outside the requested scope.

## Context

The iOS app root had started to mix SwiftUI composition, app delegate concerns,
Firebase repository construction, session bootstrapping, splash routing, and
home navigation state. That made the main view harder to preview and test, and
it encouraged hidden dependencies in presentation code.

The project already uses MVVM and Clean Architecture. iOS should keep that
direction by making root dependencies explicit and by keeping SwiftUI views
declarative.

## Decision

Use a lightweight `ReguertaAppEnvironment` container at iOS app bootstrap. The
container builds live services, repositories, root view models, and preview
replacements, then SwiftUI injects it from `ReguertaApp` through the environment.

SwiftUI views in the root flow must not define explicit `init` methods, create
repositories/services, or contain business logic. Root workflow state belongs in
`AccessRootViewModel`; session and feature work remains in dedicated view models
and use cases.

## Consequences

### Positive

- App bootstrap, delegate setup, dependency construction, and view composition
  have clearer boundaries.
- `ContentView` stays declarative and preview-friendly.
- Root navigation and splash/startup behavior can be unit tested without live
  Firebase dependencies.
- Future iOS features can reuse the same environment/factory pattern.

### Negative

- The root container adds a small amount of boilerplate.
- Some existing route extensions still need incremental extraction into smaller
  feature views/view models.

## Notes

Firebase must be configured before live Firebase-backed services are created.
Use an idempotent bootstrap helper so the SwiftUI `App` and `AppDelegate` do not
depend on fragile initialization ordering.

Orders is the first feature slice migrated after the root bootstrap. Its
SwiftUI routes receive root-owned view models, while checkout, previous orders,
received orders, producer status writes, and cart persistence are accessed
through `OrdersRepository` and `MyOrderCartStore` dependencies.

Products is the second migrated feature slice. `AccessRootViewModel` owns
`ProductsRouteViewModel`, which receives product, member, seasonal commitment,
image pipeline, and clock dependencies from `ProductsFeatureDependencies`.
`SessionViewModel` remains the session source, but it no longer owns catalog
state, product drafts, product image upload, catalog visibility changes, or the
ordering product feed.

Shifts is the third migrated feature slice. `AccessRootViewModel` owns
`ShiftsFeatureViewModel`, which receives shift, swap request, planning request,
delivery calendar, notification, and clock dependencies from
`ShiftsFeatureDependencies`. `SessionViewModel` remains the session source, but
it no longer owns shift feeds, swap workflow state,
delivery calendar state, admin planning requests, or the develop time override.
Orders consumes shifts and delivery calendar data from the root-owned Shifts
view model so ordering windows stay shared without reintroducing hidden
dependencies.

News/Notifications is the fourth migrated feature slice. `AccessRootViewModel`
owns `NewsNotificationsFeatureViewModel`, which receives news, notification,
image pipeline, and clock dependencies from
`NewsNotificationsFeatureDependencies`. `SessionViewModel` remains the session,
bylaws, and global feedback source at this step, but it no longer owns news feeds, news
drafts, image upload for news, notification feeds, broadcast drafts, or admin
send/delete workflows. Shifts and News/Notifications can share a single
`NotificationRepository` instance from the root container when both slices need
to publish or read notification events.

SharedProfile is the fifth migrated feature slice. `AccessRootViewModel` owns
`SharedProfileFeatureViewModel`, which receives shared profile repository,
image pipeline, and clock dependencies from `SharedProfileFeatureDependencies`.
`SessionViewModel` remains the session, bylaws, and global feedback source at
this step, but it no longer owns community profile feeds, the current profile
draft, shared profile image upload, or save/delete profile workflows. The drawer
and profile route consume profile state from the root-owned SharedProfile view
model.

Users/Admin Members is the sixth migrated feature slice. `AccessRootViewModel`
owns `UsersFeatureViewModel`, which receives the shared member repository and
admin upsert use case from `UsersFeatureDependencies`. `SessionViewModel`
remains the auth/session, bylaws, freshness, and global feedback source at this
step, but it no longer owns member drafts or admin member management workflows.
The dashboard admin card and the Users route consume the root-owned Users view
model.

Session/Auth closes the root-owned slice migration. `SessionViewModel` remains
the auth/session owner for login, registration, password recovery, refresh,
sign-out, impersonation, reviewer routing, and session dialogs. Global feedback
now lives in a shared `GlobalFeedbackCenter`, order freshness lives in
`MyOrderFreshnessViewModel`, and bylaws assistance lives in
`BylawsFeatureViewModel`; all three are constructed by `ReguertaAppEnvironment`
and owned from `AccessRootViewModel`. Feature view models publish feedback
through the shared center instead of routing messages through session state.
