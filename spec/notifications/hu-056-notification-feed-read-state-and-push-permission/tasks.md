# Tasks - HU-056 (Notification feed read state and push permission)

## Shared
- [x] Define user-scoped read marker contract.
- [x] Update Firestore contract docs in English and Spanish.
- [x] Create local issue markdown.

## Android
- [x] Extend notification repository contract and implementations.
- [x] Add push permission provider and settings event.
- [x] Add UI state for read ids, unread indicator, and push dialog.
- [x] Redesign notifications feed route.
- [x] Add focused unit coverage.
- [x] Run Android validation (`app:testDebugUnitTest`, `app:lintDebug`; no connected device/emulator for `connectedDebugAndroidTest`).

## iOS
- [x] Extend notification repository contract and implementations.
- [x] Add push permission provider and dependency injection.
- [x] Add ViewModel state/actions for read ids, unread indicator, and push dialog.
- [x] Redesign notifications feed route.
- [x] Add focused unit coverage.
- [x] Run iOS validation (`xcodebuild ... -destination 'platform=iOS Simulator,name=iPhone 17' test`).

## Parity
- [x] Review Android/iOS behavior after validation.
