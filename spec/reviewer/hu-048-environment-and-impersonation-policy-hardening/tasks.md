# Tasks - HU-048 (Environment and impersonation policy hardening)

## 1. Preparation
- [ ] Define canonical environment and impersonation policy.
- [ ] Inventory all current environment-switch and impersonation entry points.
- [ ] Define release safety checks and expected outcomes.

## 2. Android implementation
- [ ] Enforce debug-only impersonation on Android.
- [ ] Remove/block unsafe release pathways.
- [ ] Add Android tests for release build hardening.

## 3. iOS implementation
- [ ] Enforce debug-only impersonation on iOS.
- [ ] Remove/block unsafe release pathways.
- [ ] Add iOS tests for release build hardening.

## 4. Backend / Firestore
- [ ] Validate backend assumptions for environment-bound writes.
- [ ] Add safeguards/tests preventing production contamination paths.

## 5. Testing
- [ ] Execute Android release-like validation.
- [ ] Execute iOS release-like validation.
- [ ] Perform manual reviewer flow checks for no contamination.

## 6. Documentation
- [ ] Document policy and release verification checklist.
- [ ] Update issue notes with security hardening evidence.
- [ ] Document parity status and exceptions.

## 7. Closure
- [ ] Create/update linked issue and connect PR.
- [ ] Complete DoD checklist in spec.md.
- [ ] Attach validation and security evidence.
