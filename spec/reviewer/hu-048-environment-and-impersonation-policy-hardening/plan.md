# Plan - HU-048 (Environment and impersonation policy hardening)

## 1. Technical approach

Create a hardening layer for environment and impersonation controls based on compile-time guards, runtime checks, and explicit validation for production safety.

## 2. Layer impact
- UI: Remove or hide impersonation entry points outside debug builds.
- Domain: Centralize environment policy decisions and constraints.
- Data: Prevent persisted flags from re-enabling restricted behavior.
- Backend: Validate environment-bound constraints where applicable.
- Docs: Publish policy and release verification checklist.

## 3. Platform-specific changes
### Android
- Enforce debug-only impersonation with build-type checks.
- Add tests for release-mode behavior and blocked toggles.

### iOS
- Enforce debug-only impersonation with build configuration checks.
- Add tests for release-mode behavior and blocked toggles.

### Functions/Backend
- Validate reviewer routing safety assumptions against production paths.

## 4. Test strategy
- Unit tests for environment policy resolution.
- Build-configuration checks for release artifacts.
- Manual validation of no-contamination reviewer flows.

## 5. Rollout and functional validation
- Validate in develop and release-like builds.
- Confirm reviewer QA workflows remain usable in debug.
- Confirm production safety gates hold in release.

## 6. Phased implementation sequence
### Phase 1 - Preparation
- Define policy document and expected behavior matrix.
- Inventory all impersonation and env-switch entry points.

### Phase 2 - Implementation
- Enforce guards and remove unsafe paths.
- Add automated checks.

### Phase 3 - Closure
- Execute release safety validation.
- Update docs/issues with evidence.

## 7. Technical risks and mitigation
- Risk: hidden entry points remain unguarded.
  - Mitigation: repo-wide audit and targeted tests.
- Risk: broken QA workflows after hardening.
  - Mitigation: maintain explicit debug-only paths and docs.
