# ReguertaPlus

ReguertaPlus is a cross-platform monorepo (Android + iOS + Firebase) for La Reguerta.

The project is organized to keep business rules, architecture, and delivery aligned across platforms.

## What This Repository Contains

- Android app
- iOS app
- Firebase Cloud Functions
- Shared architecture/docs (EN + ES)
- Spec-driven planning artifacts (EN)

## Architecture

ReguertaPlus follows MVVM + Clean Architecture on both mobile platforms.

Layer model:
- Presentation: Screens/Views -> ViewModel -> UI State
- Domain: Use cases and business rules
- Data: Repositories, data sources, and mappers

Backend stack:
- Firestore
- Firebase Auth
- Firebase Storage
- Firebase Cloud Messaging
- Firebase Crashlytics

## Minimum Platform Versions

- iOS: 26.0+
- Android: API 29+

## Repository Structure

- `android/` Android project
- `ios/` iOS project
- `functions/` Firebase Cloud Functions
- `docs/` Shared documentation (English)
- `docs-es/` Shared documentation (Spanish)
- `spec/` Spec-driven framework and feature specs (English)

## Spec-Driven Workflow

The repository includes a story-driven structure where each user story maps to a feature folder with:
- `spec.md`
- `plan.md`
- `tasks.md`

Current location:
- `spec/`

Issue-ready markdowns are available under:
- `spec/issues/`

## Key Documentation

Architecture and decisions:
- `docs/architecture/README.md`
- `docs-es/architecture/README.md`
- `docs/decisions/`
- `docs-es/decisions/`

Technical stack:
- `docs/tech-stack/README.md`
- `docs-es/tech-stack/README.md`

Current requirements baseline (English, source of truth):
- `docs/requirements/mvp-requirements-reguerta-v1.md`
- `docs/requirements/user-stories-mvp-reguerta-v1.md`
- `docs/requirements/firestore-structure-mvp-proposal-v1.md`
- `docs/requirements/firestore-collections-fields-v1.md`

Spanish mirror:
- `docs-es/requirements/`

## Validation Commands

Android (`android/Reguerta`):
```bash
./gradlew app:testDebugUnitTest
./gradlew app:lintDebug
./gradlew app:connectedDebugAndroidTest
```

iOS (`ios/Reguerta`):
```bash
xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 16' test
```

Functions (`functions`):
```bash
npm run lint
npm run build
```

## Cloud Functions

Functions are deployed from `functions/` and maintain operational timestamps for key collections.

Deployment:
```bash
firebase deploy --only functions
```

## Collaboration Rules (Summary)

- Keep Android and iOS feature parity whenever possible.
- If one platform is blocked, continue progress on the other and report the gap.
- Prefer targeted changes over broad refactors unless explicitly requested.
- Follow Conventional Commits and keep commit scope focused.

## Status

Active product definition and feature delivery in progress.
This README should evolve with implementation milestones.
