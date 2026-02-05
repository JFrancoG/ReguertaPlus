# ReguertaPlus

ReguertaPlus is a cross-platform mobile project (iOS + Android) organized as a
monorepo to keep features, architecture, and naming aligned across both apps.

## Goal

Build iOS and Android in parallel while sharing architectural principles,
naming, and feature structure to reduce daily friction, accelerate delivery,
and make cross-reviews easier.

## Architecture

- Pattern: MVVM + Clean Architecture on both platforms.
- Layered structure:
  - Presentation: Views/Composables -> ViewModel -> UI State
  - Domain: use cases / business rules
  - Data: repositories and data sources

More details in `common/docs/architecture` and `common/docs-es/architecture`.

## Backend (Firebase)

Firebase is the chosen backend due to its simplicity, strong free tier, and
integrated set of services.

Services in use:
- Database: Firestore
- Auth: Firebase Authentication
- Storage: Firebase Storage
- Crash reporting: Firebase Crashlytics
- Push notifications: Firebase Cloud Messaging (FCM)

Architecture decisions are documented in `common/docs/decisions` and
`common/docs-es/decisions`.

## Minimum Versions

- iOS: 18
- Android: API 29 (Android 10)

## Repository Structure

- `ios/`: iOS app
- `android/`: Android app
- `common/`: shared documentation (ES/EN)
- `functions/`: Firebase Cloud Functions
- `firebase.json` and `.firebaserc`: Firebase configuration

## Cloud Functions

Cloud Functions live at the repo root to keep the backend alongside the apps
and simplify deployment.

## Status

Early stage. This README will evolve as development progresses.
