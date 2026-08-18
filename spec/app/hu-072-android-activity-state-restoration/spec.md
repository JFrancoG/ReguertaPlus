# HU-072 - Android activity state restoration

## Metadata

- issue_id: #241
- priority: P1
- platform: android
- status: in_progress

## Context and problem

Android recreates `MainActivity` for configuration changes such as orientation,
window resizing, and display changes. Reguerta currently constructs
`SessionViewModel` with Compose `remember`, so the instance is not retained by
the activity `ViewModelStore`. The root shell, splash completion, and startup
version gate also use non-saveable composition state.

As a result, a configuration change behaves like a cold launch: the splash is
shown again, the startup gate and session refresh run again, and transient or
in-flight session state can be discarded.

## User story

As an Android member, I want the current session and screen to survive window
configuration changes so that rotating or resizing the app does not restart my
workflow.

## Scope

### In scope

- Obtain `SessionViewModel` from the activity `ViewModelStore` through a real
  `ViewModelProvider.Factory`.
- Create ViewModel-owned dependencies only when a new ViewModel instance is
  required.
- Release ViewModel-owned closeable resources when the ViewModel is cleared.
- Preserve the root shell route across activity configuration recreation.
- Prevent splash animation and startup version-gate work from repeating for a
  configuration recreation.
- Preserve the existing cold-launch behavior.
- Add deterministic activity-recreation or equivalent state-restoration tests.

### Out of scope

- Locking Android orientation.
- Redesigning compact-landscape or large-screen layouts.
- Migrating the complete navigation hierarchy to Navigation 3.
- iOS, Firebase, Rules, Functions, or live-data changes.
- General process-death persistence for large domain snapshots.

## Linked functional requirements

- ADR-0001 MVVM and Clean Architecture presentation ownership.
- HU-021 startup remote version gate.
- HU-023 session lifecycle refresh and expiry UX.
- HU-039 role-aware home shell and drawer navigation.
- Android adaptive configuration and continuity guidance.

## Acceptance criteria

- Recreating `MainActivity` after startup does not show the splash again.
- The startup version gate is not requested again solely because of a
  configuration change.
- The same `SessionViewModel` instance survives activity recreation.
- The current root shell route and Home destination remain stable.
- Saveable form and route state continues to restore where already supported.
- A true cold launch still shows the splash, resolves the startup gate, and
  refreshes the session.
- ViewModel-owned closeable resources are released only when the ViewModel is
  permanently cleared, not when a composition is replaced.
- Android unit tests, lint, and focused connected recreation tests pass.

## Dependencies

- AndroidX Lifecycle ViewModel and Compose integration already used by the app.
- Existing `SessionViewModel`, auth-shell reducer, startup gate, and Home state
  restoration contracts.
- GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/241

## Risks

- Constructing dependencies before `ViewModelProvider` resolves an existing
  instance could create and immediately orphan expensive resources.
  - Mitigation: make dependency creation lazy inside the factory `create` path.
- Retaining only the route while recreating the ViewModel would produce an
  inconsistent shell/session pair.
  - Mitigation: fix lifecycle ownership first and test both identity and route.
- Treating every restored route as a completed cold launch could bypass a
  required startup gate after process death.
  - Mitigation: model cold-launch completion explicitly and cover the boundary
    with restoration tests.
- A broad navigation migration would increase regression risk.
  - Mitigation: keep Navigation 3 adoption as separate future work.

## Definition of Done (DoD)

- [x] Acceptance criteria validated.
- [x] RED/GREEN recreation evidence recorded.
- [x] Android unit tests pass.
- [x] Android lint passes without new errors.
- [x] Focused connected recreation tests pass on an available emulator/device.
- [x] Android/iOS parity impact reviewed and any gap documented.
- [x] Issue and planning documentation created.
- [ ] PR prepared with validation evidence when delivery is authorized.

## Validation evidence

- RED: `app:compileDebugAndroidTestKotlin` failed because `MainActivity` did
  not expose lifecycle-owned session/root ViewModels; all 12 diagnostics were
  the expected unresolved ownership references in `MainActivityRecreationTest`.
- Focused GREEN: `MainActivityRecreationTest` passed 1/1 on
  `Pixel_9_Pro_XL_Api37-A17`, Android 17/API 37.
- Root cold-launch/retry tests passed 2/2.
- Full `app:testDebugUnitTest`: 437/437 passed, with no failures, errors, or
  skips.
- Final `app:lintDebug`: 0 errors and 134 existing warnings; no warning was
  introduced by HU-072. The first run identified and the implementation
  removed one new `EmptySuperCall` warning.
- Full `app:connectedDebugAndroidTest`: 20/20 passed on the API 37 AVD, with
  no failures or skips.
- Manual portrait-to-landscape rotation retained the Welcome route and its two
  actions without replaying the splash. The AVD was restored to automatic
  rotation afterward.
- The connected Android 14/API 34 physical device rejected test-APK
  installation with `INSTALL_FAILED_USER_RESTRICTED`; no device setting was
  changed, and the official AVD supplied the connected evidence instead.
- Visual inspection found a separate pre-existing compact-landscape Welcome
  layout problem: the logo dominates the window and text is clipped. That
  adaptive-layout redesign remains outside this state-restoration fix.
- No iOS or backend code changed; platform parity is unaffected by the
  Android-specific lifecycle repair.
