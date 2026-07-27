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

Design system:
- `docs/design-system/README.md`
- `docs-es/design-system/README.md`

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

## Firebase rollout boundaries

Firebase configuration files are intentionally separated by deployment target:

| Config | Purpose |
| --- | --- |
| `firebase.json` | Default Phase 1 Rules configuration; same Rules targets as `firebase.phase1.json` |
| `firebase.phase1.json` | Firestore Phase 1 compatibility Rules and the semantic Storage rollback |
| `firebase.strict.json` | Undeployed strict candidates: `firestore.strict.rules` and `storage.strict.rules` |
| `firebase.functions.json` | Functions-only source configuration; never use it as an implicit full deployment |

Current live state (2026-07-27):

- Firestore Phase 1 is deployed and was read back: the eight observed legacy
  prefixes remain authenticated read/write, while `plus-collections` keeps its
  previous authenticated contract and HU-045 producer-status guard. Strict
  Reguerta+ authorization is not deployed.
- Storage still uses the previous global authenticated read/write Rules.
  `storage.phase1.rules` is a semantic rollback copy of that live contract; the
  strict Storage candidate is not deployed.
- The seven Auth accounts matching active develop admins are verified; the
  three production admins are a subset. The guarded identity backfill created
  22 `authLinks` in develop and 16 in production; post-run verification reports
  7 and 3 linked active admins respectively, with zero pending operations.
- Two sparse develop documents are intentional non-Auth UI-test fixtures. The
  applied migration retained their exact member/UID pairs, without an
  `authLink` or Rules exception. Twenty-seven remaining Auth accounts must
  self-verify through Reguerta+ before strict authorization can be enabled
  without excluding legitimate testers.

Always deploy one service at a time with explicit config, target, and project.
Never run a plain `firebase deploy`.

```bash
# Reapply/rollback Firestore to the deployed Phase 1 contract.
firebase deploy --config firebase.phase1.json \
  --only firestore:rules --project reguerta-9f27f

# Restore Storage semantics to the current authenticated-global baseline.
firebase deploy --config firebase.phase1.json \
  --only storage --project reguerta-9f27f
```

The strict commands below are documented for the later approved gate and must
not run until the remaining accounts verify, link adoption and role canaries
are proven, and the cutover receives explicit approval:

```bash
firebase deploy --config firebase.strict.json \
  --only firestore:rules --project reguerta-9f27f

firebase deploy --config firebase.strict.json \
  --only storage --project reguerta-9f27f
```

Functions must never be deployed with `--only functions` from the current
source as a blanket target. Any deployment must use `firebase.functions.json`,
an explicitly reviewed allowlist such as
`--only functions:<approved-function>`, and separate rollout approval; see
`functions/README.md`.

The repository `functions` serve/shell scripts are pinned to
`demo-reguerta-functions` and fail closed. The risk is a manual Functions
emulator or shell invocation without that demo project and without matching
Auth, Firestore, and Storage emulators: Admin SDK calls can then reach live
Firebase services.

## Collaboration Rules (Summary)

- Keep Android and iOS feature parity whenever possible.
- If one platform is blocked, continue progress on the other and report the gap.
- Prefer targeted changes over broad refactors unless explicitly requested.
- Follow Conventional Commits and keep commit scope focused.

## Status

Active product definition and feature delivery in progress.
This README should evolve with implementation milestones.
