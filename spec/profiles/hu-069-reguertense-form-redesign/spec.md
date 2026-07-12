# HU-069 - Regüertense add and edit form redesign

## Metadata

- issue_id: #188
- priority: P2
- platform: both
- status: implemented

## Context and problem

The member administration editor still uses a legacy outer card, generic platform text fields, and a second Back action at the bottom. The layout does not match current Reguerta form screens and the relationship between Common purchases manager, Producer, and company name is not enforced by the editor.

## User story

As an administrator, I want to add or update a regüertense using the same clear form language as the rest of the app, so role-dependent information is easy to understand and invalid combinations are avoided.

## Scope

### In scope

- Remove the full-form card on Android and iOS.
- Show the mode-specific form title immediately under the existing screen back control.
- Use the shared Reguerta input component for all textual entries.
- Preserve the email as read-only in edit mode.
- Show company name only for producers.
- Enforce Common purchases manager as a producer with company name `Compras Regüerta`.
- Disable company-name editing while Common purchases manager is selected.
- Keep the primary save action at the bottom and remove the redundant lower Back action.
- Add targeted regression coverage for role/company transitions.

### Out of scope

- Changes to member persistence, Firestore shape, permissions, or role definitions.
- Redesign of the authorized-regüertenses list or its cards.
- Changes to activation/deactivation behavior.
- New server-side validation or migration of existing members.

## Product contracts

### Form mode

- Create mode displays `Añadir regüertense` and an editable email Reguerta Input.
- Edit mode displays `Actualizar regüertense` and the existing email in a disabled/read-only Reguerta Input.
- The primary action displays the corresponding Add/Update wording and remains the final form control.

### Producer and common purchases manager

- Enabling Producer reveals company name without assigning a default company.
- Disabling Producer clears Common purchases manager and company name.
- Enabling Common purchases manager enables Producer, assigns `Compras Regüerta`, reveals company name, and makes it read-only.
- Disabling Common purchases manager does not disable Producer or clear company name; it only makes company name editable again.
- While Common purchases manager is enabled, attempts to change company name through the UI are unavailable.

## Acceptance criteria

- No outer card or bordered container wraps the complete form on either platform.
- The mode title is the first form content below the existing back control.
- All text entries use the platform's shared Reguerta Input implementation.
- Editing a member shows their email in a non-editable Reguerta Input.
- Company name visibility and editability follow the role contract above.
- Common purchases manager cannot be saved without Producer or with a company other than `Compras Regüerta` through this UI.
- Admin remains independently selectable.
- The primary action is full-width, uses the shared primary button, and appears at the bottom.
- There is no duplicate Back action below the primary action.
- The form scrolls on compact windows and keeps keyboard dismissal behavior.
- Android and iOS expose the same strings and behavior in English and Spanish.
- Targeted automated tests cover role/company transitions on both platforms where the current test architecture permits.

## Dependencies and risks

- Reuses the existing shared Reguerta input and button components.
- The form draft currently lives in different presentation state models on Android and iOS; transition logic should be centralized in small testable helpers without changing the persistence contract.
- Existing stored members may contain unusual role/company combinations. Opening the form must not silently mutate persisted data; normalization occurs only after an explicit role interaction or save through the editor.

## Validation plan

- Android:
  - `./gradlew app:testDebugUnitTest`
  - `./gradlew app:lintDebug`
  - `./gradlew app:connectedDebugAndroidTest` when an emulator/device is available because visible UI behavior changes.
- iOS:
  - `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' test`
  - If unavailable, use another valid simulator and record it.
- Static checks:
  - `git diff --check`
  - Parse the iOS String Catalog after localization edits.

## Validation evidence

- Android unit tests and lint: `./gradlew app:testDebugUnitTest app:lintDebug` passed.
- Android connected tests: `ANDROID_SERIAL=emulator-5554 ./gradlew app:connectedDebugAndroidTest` passed 11 tests on `Pixel_8_Pro_API_35(AVD) - 15`.
- Android targeted regression: `./gradlew app:testDebugUnitTest --tests com.reguerta.user.presentation.users.UsersEditorStateTest` passed.
- The current Android debug APK installed and launched successfully through `android run`; visual form inspection remains pending because a clean install opens at Welcome and requires an authenticated administrator session.
- iOS unit suite: `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ReguertaTests test` passed, including the new member-editor and header/back tests.
- The full iOS `test` command built the app and ran unit tests, but repeatedly failed to launch `com.plusprojects.ReguertaUITests.xctrunner` with `DebuggerVersionStore.StoreError: no debugger version`; it was interrupted after the environment blocker repeated. No product-code test failure was reported.
- `git diff --check` and the String Catalog JSON parse check passed.
- Feature parity is complete in implementation: both platforms use the shared Reguerta Inputs, contextual shell title/back behavior, the same role/company transitions, and the same localized action wording.

## Definition of Done

- [x] Acceptance criteria implemented.
- [x] Android/iOS parity reviewed or temporary gap documented.
- [x] Relevant tests and lint executed.
- [x] Issue and branch linked.
- [x] Pull request linked: #189.
