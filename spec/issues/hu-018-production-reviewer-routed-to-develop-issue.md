# [HU-018] Production reviewer routed to develop

## Summary

As a reviewer I want to run full test flows without impacting real production data.

## Links
- Spec: spec/reviewer/hu-018-production-reviewer-routed-to-develop/spec.md
- Plan: spec/reviewer/hu-018-production-reviewer-routed-to-develop/plan.md
- Tasks: spec/reviewer/hu-018-production-reviewer-routed-to-develop/tasks.md

## Acceptance criteria

- Allowlisted reviewer in production app is routed to develop backend.
- Reviewer writes never affect real production dataset.

## Scope
### In Scope
- Implement story HU-018 within MVP scope.
- Satisfy linked RFs: RF-REV-01, RF-REV-02, RF-REV-03.

### Out of Scope
- Post-MVP functionality.
- Refactors not required to close acceptance criteria.

## Implementation checklist
- [x] Android
- [x] iOS
- [ ] Backend / Firestore
- [x] Testing
- [x] Documentation

## Implementation notes
- Added runtime Firestore environment strategy in both apps:
  - Base environment by build type (`develop` in debug, `production` in release).
  - Session-level override support to reroute a signed-in reviewer account to `develop`.
- Added reviewer routing resolver in Android+iOS auth flows:
  - Runs on `signIn`, `signUp`, and session refresh before resolving authorized member data.
  - Reads reviewer allowlist from `production/.../config/global` supporting keys:
    - `reviewerAllowlistEmails` / `reviewerAllowlist`
    - `reviewerAllowlistUids`
    - nested `reviewerAllowlist.{emails,uids}`.
- Converted Firestore repositories and order route helpers to dynamic runtime environment defaults (no longer hardcoded to `develop`), so reviewer writes are persisted in `develop` when override applies.
- Added session reset hooks on sign out / expired session to restore base environment.

## Validation evidence
- Android: `./gradlew app:testDebugUnitTest` ✅
- Android: `./gradlew app:lintDebug` ✅
- Android: `./gradlew app:connectedDebugAndroidTest` ⚠️ blocked by device restriction (`INSTALL_FAILED_USER_RESTRICTED`).
- iOS: `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17e,OS=26.4' test` ✅

## Suggested labels
- type:feature
- area:reviewer
- platform:cross
- priority:P1
