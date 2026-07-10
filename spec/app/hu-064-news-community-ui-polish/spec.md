# HU-064 - News and community UI polish

## Metadata
- issue_id: #167
- priority: P2
- platform: both
- status: implemented

## Context and problem

The Android News and Community routes currently place their main title in the same horizontal row as the back arrow. This weakens the vertical hierarchy used by other recently polished routes, where navigation is presented first and the screen title starts below it.

On iOS, news records can include an optional image URL, but the image is not visible in the rendered news card. The URL-to-image path needs to be traced and repaired without changing the persisted Firestore contract.

## User story

As a cooperative member I want News and Community to have a clear, consistent header hierarchy and news images to render on iOS so that both screens are easy to scan and retain their intended visual content.

## Scope

### In Scope
- Android News title appears below the back arrow.
- Android Community title appears below the back arrow.
- Existing Android top-bar actions and nested Community titles keep working.
- iOS news image URL handling and rendering are diagnosed and corrected.
- Targeted regression coverage for the iOS image URL/rendering contract where practical.

### Out of Scope
- Firestore schema or Storage rules changes.
- News publishing/editor behavior changes.
- Redesigning News cards or Community profiles.
- Moving titles on unrelated Android routes.

## Linked functional requirements

- RF-NOTI-01
- RF-PERF-01

## Acceptance criteria

- On Android News, the back arrow occupies the navigation row and the localized News title begins on a row below it.
- On Android Community, the back arrow occupies the navigation row and the localized Community title begins on a row below it.
- The header change does not alter Dashboard or unrelated route headers.
- Android still exposes the same back navigation behavior and accessibility description.
- On iOS, a news article with a valid persisted image reference renders its remote image in both the Home latest-news card and the full News list.
- An absent or invalid iOS news image reference keeps the current non-blocking placeholder/no-image behavior.
- No Firestore news fields or image upload contracts change.

## Dependencies

- Builds on HU-057 for the shared News card presentation.
- Builds on HU-014 for the Community/shared-profile route.
- Reuses the existing image upload and download URL contract from HU-025.

## Risks

- Risk: changing the shared Android top bar could unintentionally move titles on other routes.
  - Mitigation: make title placement an explicit per-route option and retain the existing default.
- Risk: iOS may receive more than one persisted Firebase image-reference format.
  - Mitigation: trace current repository/upload output and normalize only supported formats with focused tests.

## Validation plan

- Android:
  - `./gradlew app:testDebugUnitTest`
  - `./gradlew app:lintDebug`
  - `./gradlew app:connectedDebugAndroidTest` when a device/emulator is available because UI layout changes.
- iOS:
  - `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' test`
  - If that simulator is unavailable, use another valid local simulator and report it.

## Validation evidence

- Firebase (`reguerta-9f27f`, read-only): the three latest active develop news documents contain HTTPS image references; their Storage objects exist and the persisted URLs return valid 300 x 300 JPEG responses.
- Android: `./gradlew app:testDebugUnitTest` passed.
- Android: `./gradlew app:lintDebug` passed.
- Android: `ANDROID_SERIAL=emulator-5554 ./gradlew app:connectedDebugAndroidTest` passed 9 tests on `Pixel_8_Pro_API_35` (API 35), including the new header-position coverage.
- iOS focused: `NewsImageDataLoaderTests` passed 3 tests on iPhone 17.
- iOS full: 170 tests passed and 4 launch tests were skipped on iPhone 17 / iOS 26.5. The run reports the pre-existing `ReguertaUITests.testDrawerNavigationOpensSelectedRoute()` failure because the login email field is not found before News navigation begins; the News image loader tests and `testHomeShowsLatestNewsWithoutBottomObstruction()` passed.
- Platform parity: no temporary gap. Android receives the requested header hierarchy and iOS restores the existing optional image contract without backend changes.

## Definition of Done (DoD)

- [x] Acceptance criteria validated.
- [x] Android/iOS parity reviewed or temporary gap documented.
- [x] Relevant checks executed or skipped with reason.
- [x] Technical/functional documentation updated.
- [ ] GitHub issue and pull request linked.
