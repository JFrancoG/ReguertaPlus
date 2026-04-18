# Tasks - HU-048 (Environment and impersonation policy hardening)

## 1. Preparation
- [x] Define canonical environment and impersonation policy.
- [x] Inventory all current environment-switch and impersonation entry points.
- [x] Define release safety checks and expected outcomes.

## 2. Android implementation
- [x] Enforce debug-only impersonation on Android.
- [x] Remove/block unsafe release pathways.
- [x] Add Android tests for release build hardening.

## 3. iOS implementation
- [x] Enforce debug-only impersonation on iOS.
- [x] Remove/block unsafe release pathways.
- [x] Add iOS tests for release build hardening.

## 4. Backend / Firestore
- [x] Validate backend assumptions for environment-bound writes.
- [x] Add safeguards/tests preventing production contamination paths.

## 5. Testing
- [x] Execute Android release-like validation.
- [x] Execute iOS release-like validation.
- [x] Perform manual reviewer flow checks for no contamination.

## 6. Documentation
- [x] Document policy and release verification checklist.
- [x] Update issue notes with security hardening evidence.
- [x] Document parity status and exceptions.

## 7. Closure
- [x] Create/update linked issue and connect PR.
- [x] Complete DoD checklist in spec.md.
- [x] Attach validation and security evidence.
