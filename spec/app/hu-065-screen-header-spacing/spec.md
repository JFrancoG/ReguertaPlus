# HU-065 - Android screen header spacing

## Metadata
- issue_id: #169
- priority: P3
- platform: android
- status: implemented

## Context and problem

The shared Android screen header now provides consistent navigation and title hierarchy, but content begins too close to the title. The spacing belongs in the shared screen-title primitive so static and dynamic screen titles remain aligned.

## User story

As a member I want a little breathing room below each screen title so that the header and following content are easier to scan.

## Scope

### In scope
- Add 8 dp of bottom padding to the shared Android screen-title primitive.
- Preserve navigation-row, title typography, heading semantics, and trailing actions.
- Add geometry coverage for the title-to-content gap.

### Out of scope
- iOS layout changes.
- Top, start, or end padding changes.
- Dashboard compact-header changes.

## Acceptance criteria

- Shared Android screen titles add exactly 8 dp of bottom space before following content.
- The spacing is inherited without route-specific modifiers.
- Dashboard, back navigation, and header actions retain their current behavior.
- Android validation passes on unit tests, lint, and the available emulator.

## Validation evidence

- `./gradlew app:testDebugUnitTest` passed.
- `./gradlew app:lintDebug` passed.
- `ANDROID_SERIAL=emulator-5554 ./gradlew app:connectedDebugAndroidTest` passed 10 tests on `Pixel_8_Pro_API_35` (API 35), including the 8 dp title-to-content geometry assertion.
- Platform parity: intentional Android-only change because the affected shared component is Android-specific; iOS layout is unchanged.
- Existing unrelated local changes in Android/iOS Bylaws, Home routing, and localization files were preserved and excluded from this story.

## Definition of Done

- [x] Acceptance criteria validated.
- [x] Android-only parity scope documented.
- [x] Relevant checks executed.
- [ ] GitHub issue and pull request linked.
