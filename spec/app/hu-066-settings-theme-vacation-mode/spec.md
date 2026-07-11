# HU-066 - Settings appearance and producer unavailable mode

## Metadata
- issue_id: #172
- priority: P2
- platform: both
- status: implemented

## Context and problem

The Settings screen currently presents all content inside one outer card and places develop-only controls before administrator tools. It does not expose a user-selectable app appearance. Producer catalog visibility already exists as a technical toggle in catalog management, but the user-facing concept should be Unavailable mode in Settings and must consistently hide the producer's products from ordering.

## User story

As a cooperative member I want settings grouped by who they apply to, with a persistent appearance choice, and as a producer I want to pause my catalog while I am on vacation so the screen is clear and members cannot order unavailable products.

## Scope

### In scope
- Remove the card that wraps the complete Settings screen.
- Group and order settings as General, Producer, Administrator, Develop.
- Add a general appearance selector with System, Light, and Dark options.
- Persist the appearance locally and apply it at the app theme root immediately.
- Add a producer-only Unavailable mode switch or checkbox.
- Persist Unavailable mode using the existing producer catalog-visibility field.
- Exclude vacationing producers from ordering catalogs while keeping their own catalog management available.
- Keep Android and iOS behavior aligned.
- Preserve existing administrator calendar/planning and develop impersonation/time controls.
- Remove the manual delivery-calendar reload action and keep the change-day action centered.
- Edit a weekly delivery exception in one sheet: choose the week, move to the previous or next weekday, and save only after the day changes.
- Provide an explicit close action in the platform-standard corner while preserving gesture dismissal outside an active save.

### Out of scope
- Scheduled vacations or automatic reactivation.
- Per-account/cloud-synchronized appearance.
- Changing individual product availability, stock, archive state, or historical orders.
- Redesigning administrator or develop tools beyond the delivery-calendar flow described above.
- Backend migration for a second vacation field.

## Product contracts

### Appearance
- `system`: follow the operating-system appearance and react to system changes.
- `light`: force the light app palette.
- `dark`: force the dark app palette.
- Default for users without a stored preference: `system`.
- Selection is stored locally on each platform and applies to signed-out and signed-in screens on that device.

### Unavailable mode
- Unavailable mode is represented by `producerCatalogEnabled == false` to preserve compatibility with existing clients and Firestore data.
- Only members with the producer role see the control.
- Enabling it hides every product owned by that producer from member ordering flows.
- The filter applies only to the product list used to prepare a new order; existing and historical orders remain unchanged.
- Disabling it makes eligible products visible again; normal archived, availability, stock, parity, and commitment filters still apply.
- The producer continues to see and manage their catalog while Unavailable mode is active.

## Acceptance criteria

- Settings has no single enclosing card and uses normal screen padding/section separation.
- Sections appear in the order General, Producer, Administrator, Develop, omitting any section outside the current member/build scope.
- System, Light, and Dark appearance options are accessible, persist across app relaunch, and update the full app immediately.
- The System option tracks the current OS appearance.
- A producer can toggle Unavailable mode with visible saving/disabled state and feedback on failure.
- Unavailable mode persists across sessions on Android and iOS through the existing member document contract.
- A producer in Unavailable mode contributes no products to another member's ordering UI.
- Existing and historical orders keep their saved product lines when Unavailable mode changes.
- Turning Unavailable mode off restores only products that pass the existing ordering filters.
- The producer catalog management route remains usable during Unavailable mode.
- Existing admin and develop controls still work after being moved to their ordered sections.
- Delivery-calendar data continues to refresh automatically when Settings opens; there is no manual reload button.
- The Delivery calendar section uses the same hierarchy on Android and iOS: title, concise help text, then the centered Change delivery day action, without a second platform-specific description.
- The centered Change delivery day action opens one sheet with the first available week selected.
- The sheet shows circular previous/next controls around a central weekday capsule, aligned with the order-history week navigator, and Save remains disabled until the weekday changes.
- Weekday navigation is bounded: Previous is disabled on Monday and Next is disabled on Sunday.
- The sheet can be dismissed by gesture or an explicit close icon (top-left on iOS, top-right on Android), except while a save is in progress.
- Returning an existing exception to the usual delivery day and pressing Save deletes the exception instead of persisting a redundant override.
- The sheet exposes only the Save action; it does not need a separate remove-exception button.
- The explanatory copy wraps without truncation on iOS, and Android keeps balanced top/bottom spacing without colliding with system navigation.
- Android primary actions use the shared capsule-shaped button component; compact paired actions reduce internal padding and center wrapped labels. Explicit fixed corner radii remain reserved for the order flows that require them.
- The iOS Change delivery day action provides comfortable horizontal space around its localized title.
- Every Develop setting is localized in English and Spanish rather than embedding Spanish copy in platform views.
- Both platforms include regression coverage for the new behavior.

## Dependencies and risks

- Reuses `producerCatalogEnabled`, the current cross-platform Firestore/member mapping and ordering filters.
- Theme ownership currently sits at each platform's app root, so Settings state must be lifted without coupling it to an authenticated session.
- Existing catalog visibility controls can create duplicate entry points unless removed or deliberately redirected.
- Ordering data can be cached; member/product refresh paths must reflect the changed producer state without requiring sign-out.

## Validation plan

- Android:
  - `./gradlew app:testDebugUnitTest`
  - `./gradlew app:lintDebug`
  - `./gradlew app:connectedDebugAndroidTest` when an emulator/device is available because visible UI behavior changes.
- iOS:
  - `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' test`
  - If unavailable, use another valid simulator and record it.
- Manual/targeted:
  - Relaunch with each appearance option and verify root screens.
  - Toggle Unavailable mode as a producer, refresh another member's order screen, and verify disappearance/restoration.

## Validation evidence

- Android unit tests and lint: `./gradlew app:testDebugUnitTest app:lintDebug` passed.
- Android connected tests: `ANDROID_SERIAL=emulator-5554 ./gradlew app:connectedDebugAndroidTest` passed 10 tests on `Pixel_8_Pro_API_35(AVD) - 15`.
- iOS build: `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' build` passed; SwiftLint reported 0 violations.
- iOS unit tests: `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ReguertaTests test` passed.
- The full iOS `test` command could not launch `com.plusprojects.ReguertaUITests.xctrunner` because the local Xcode/LLDB runner reported `DebuggerVersionStore.StoreError: no debugger version`. This is a UI-runner environment blocker; no product-code test failure was reported.
- `git diff --check` and the String Catalog JSON parse check passed.
- Manual signed-in producer verification remains pending because it requires a suitable authenticated test account/session.
- Feature parity is complete in implementation: both platforms use the same appearance values and inverse `producerCatalogEnabled` Unavailable mode contract.
- Follow-up scope regression: Android and iOS unit suites verify that Unavailable mode does not remove the scheduled producer from the weekly summary; only the new-order product feed applies the visibility filter.
- Follow-up Android UI cleanup: removed the duplicate in-content Settings title and replaced Settings-only `titleSmall` uses (which fell back to Material's default font) with the project's configured Cabin typography.
- Follow-up copy/layout polish: renamed the visible producer control to Unavailable mode, simplified its explanatory copy, renamed the appearance setting in Spanish, removed the displayed default delivery day, localized Android delivery-calendar and shift-planning content, and made the two planning actions equal-width and centered on both platforms.
- Follow-up delivery-calendar flow: removed the manual Reload action, centered Change delivery day, and replaced the two-step editor with one sheet on both platforms. The first available week is preselected; Previous/weekday/Next controls update the proposed day; Save is disabled until that day changes; and an explicit platform-positioned close icon complements gesture dismissal.
- Follow-up visual polish: replaced the weekday text actions with the circular-chevron and central-capsule pattern used by order-history week navigation, bounded selection to Monday through Sunday, fixed multiline explanatory copy on iOS, and balanced Android sheet spacing while retaining scroll access on short windows.
- Follow-up exception removal: removed the dedicated action from both sheets. Saving the usual delivery day for a week that already has an exception now deletes its override, while saving any other changed day creates or updates the exception.
- Regression coverage verifies the save decision on Android and the complete create-then-return-to-default deletion flow through the iOS shifts view model.
- Follow-up component polish: restored the shared Android button’s capsule contract, kept fixed corner radii as explicit exceptions, added configurable horizontal content padding and centered labels, applied compact typography/padding to the paired planning actions, widened the iOS delivery-calendar action, and moved Develop copy on both platforms into localized resources.
- Follow-up delivery-calendar parity: aligned the Settings section on Android and iOS as title, concise help text, then centered action, and removed the redundant Android-only description.

## Definition of Done

- [ ] Acceptance criteria validated manually with an authenticated producer session.
- [x] Android/iOS parity reviewed or temporary gap documented.
- [x] Relevant tests and lint executed.
- [x] Functional documentation updated.
- [ ] Issue and pull request linked.
