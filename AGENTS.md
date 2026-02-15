# AGENTS.md

## Purpose

This file defines how AI coding agents should work in this repository.
Use it as the default operational guide for day-to-day execution.

## Repository Scope

Agents may modify any part of this monorepo when needed:

- `/android`
- `/ios`
- `/functions`
- `/common` (including docs and ADRs)
- Root-level config files

## Project Snapshot

- Monorepo with Android + iOS apps and Firebase backend.
- Shared architecture target: MVVM + Clean Architecture across platforms.
- Backend: Firebase (Firestore, Auth, Storage, Crashlytics, FCM).
- Minimum platform versions:
  - iOS: 26.0+
  - Android: API 29+

## Cross-Platform Delivery Rule

- Always try to keep Android and iOS feature parity.
- If one platform is blocked, continue delivery on the other platform.
- Do not stop overall progress because one side is temporarily blocked.
- Clearly report any temporary parity gap in the final handoff.

## Skills and Implementation Detail

- Prefer using available skills for platform-specific and UI implementation guidance.
- Do not duplicate detailed UI design rules here; those are handled by skills and future design-system docs.
- Canonical stack definitions live in:
  - `/common/docs/tech-stack/README.md`
  - `/common/docs-es/tech-stack/README.md`

## Instruction Conflicts

- If there is any conflict or ambiguity between:
  - this `AGENTS.md`,
  - instructions coming from a skill,
  - or direct user instructions,
  ask the user for clarification before proceeding.
- Do not assume precedence when instructions conflict.

## Branching and Commits

- Agent-created branches must use the `codex/` prefix.
- Use Conventional Commits for every commit.
- Keep commit scope focused and messages explicit about platform and layer when relevant.

## Validation Policy

Run validations before closing work, except for minimal/trivial changes.

### Standard validation (default)

Run the relevant checks for touched areas:

- Android (`/android/Reguerta`):
  - `./gradlew app:testDebugUnitTest`
  - `./gradlew app:lintDebug`
  - `./gradlew app:connectedDebugAndroidTest` (when device/emulator is available or UI behavior changed)
- iOS (`/ios/Reguerta`):
  - `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 16' test`
  - If simulator name is unavailable, use any valid local simulator and report which one was used.
- Functions (`/functions`):
  - `npm run lint`
  - `npm run build`

### Minimal change exception

Full validation may be skipped for minimal, non-behavioral edits (for example: docs text, comments, renames, or tiny refactors with no logic change).
When skipped, explicitly state why in the final handoff.

## Documentation and ADR Hygiene

- If architecture, platform baseline, or backend decisions change, update ADRs in:
  - `/common/docs/decisions`
  - `/common/docs-es/decisions`
- Keep English and Spanish docs aligned when updating decision-level documentation.

## Execution Style

- Make progress autonomously.
- Ask concise clarifying questions only when blocked by missing decisions.
- Prefer targeted, surgical edits over broad refactors unless requested.
- Preserve existing repository conventions and naming.

## Final Handoff Format

Include:

- What changed (by area/platform).
- Validation run (or why skipped under minimal-change policy).
- Any known parity gap and next suggested step.
