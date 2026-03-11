# Tech Stack

This document is the technical stack source of truth for Reguerta.

## Core Principles

- Keep Android and iOS architecture aligned (MVVM + Clean Architecture).
- Prefer feature parity across platforms, but allow temporary gaps if one side is blocked.
- Use platform-native UI frameworks and modern concurrency patterns.

## Platform Baselines

- iOS minimum version: 26.0+
- Android minimum API level: 29 (Android 10)

## Android Stack

- Language: Kotlin
- UI: Jetpack Compose
- Design system foundation: Material 3
- Navigation: Navigation 3
- Architecture: MVVM + Clean Architecture
- Dependency injection: Hilt (preferred standard for dependency wiring)
- Async/concurrency: Kotlin Coroutines + Flow/StateFlow
- Serialization: kotlinx.serialization
- Local persistence/preferences: DataStore (Preferences)
- Image loading: Coil (Compose + OkHttp integration)
- Backend integration: Firebase SDK (Auth, Firestore, Storage, Messaging, Crashlytics, Analytics)

## iOS Stack

- Language: Swift 6
- UI: SwiftUI
- Architecture: MVVM + Clean Architecture
- Concurrency: Swift Concurrency (`async/await`, task-based flows)
- Concurrency mode: strict concurrency enabled for app code
- State/observation model: Observation framework (`@Observable`) as the default observable pattern
- Dependency management: Swift Package Manager (SPM)
- Backend integration: Firebase iOS SDK (Auth, Firestore, Storage, Messaging, Crashlytics, Analytics)

## Backend and Cloud

- Platform: Firebase
- Data: Firestore
- Auth: Firebase Authentication
- File storage: Firebase Storage
- Push: Firebase Cloud Messaging (FCM)
- Crash reporting: Firebase Crashlytics
- Server logic: Firebase Cloud Functions (Node.js 22 + TypeScript)

## Testing and Validation Tooling

- Android: Gradle (`test`, `lint`, instrumentation as needed)
- iOS: Xcodebuild test on simulator
- Functions: `npm run lint` and `npm run build`

## Notes

- If implementation details conflict with this document, ADRs, or agent instructions, resolve through explicit clarification with the user before proceeding.
