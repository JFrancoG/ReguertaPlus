# Tasks - HU-072

## 1. Preparation

- [x] Confirm the root cause in `SessionViewModel` and auth-shell ownership.
- [x] Search GitHub for an equivalent existing issue.
- [x] Create and link issue #241.
- [x] Create `codex/hu-072-android-activity-state-restoration` from `main`.
- [x] Define approved scope, exclusions, acceptance criteria, and validation.

## 2. Android implementation

- [x] Add a RED activity-recreation/state-restoration test.
- [x] Introduce a real `ViewModelProvider.Factory`.
- [x] Obtain `SessionViewModel` through the activity `ViewModelStore`.
- [x] Move closeable-resource cleanup to the ViewModel lifecycle.
- [x] Preserve root route and startup completion across recreation.
- [x] Preserve cold-launch behavior.

## 3. iOS implementation

- [x] Confirm no iOS code change is required for this Android-only defect.

## 4. Backend / Firestore

- [x] Confirm no backend or live Firebase change is required.

## 5. Testing

- [x] Record the focused RED failure.
- [x] Pass focused unit/restoration tests.
- [x] Run `./gradlew app:testDebugUnitTest` (437/437 passed).
- [x] Run `./gradlew app:lintDebug` (0 errors; no new warnings).
- [x] Run focused and full `app:connectedDebugAndroidTest` when an emulator or
  device is available.
- [x] Perform a manual portrait/landscape rotation check.

## 6. Documentation

- [x] Add HU-072 spec, plan, tasks, and issue mirror.
- [x] Record final validation evidence and parity assessment.
- [x] Update `CHANGELOG.md` for delivery.

## 7. Closure

- [x] Create/update linked issue.
- [ ] Prepare focused commit and PR when authorized.
- [~] Complete DoD checklist; commit/PR delivery remains unauthorized.

## Validation evidence

- RED compilation: expected unresolved lifecycle-owner references in the new
  recreation test.
- Focused recreation: 1/1 passed on Android 17/API 37.
- Focused root state: 2/2 passed.
- Full unit suite: 437/437 passed.
- Lint: 0 errors, 134 existing warnings, and no HU-072 warning.
- Full connected suite: 20/20 passed on `Pixel_9_Pro_XL_Api37-A17`.
- Manual rotation: Welcome remained active without splash replay; automatic
  rotation was restored.
- Separate out-of-scope finding: Welcome requires a later adaptive landscape
  layout correction because its logo/text do not fit the compact height.
