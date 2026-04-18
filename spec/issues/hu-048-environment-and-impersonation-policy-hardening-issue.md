# [HU-048] Environment and impersonation policy hardening

## Summary

As a security owner I want a hardened environment and impersonation policy so production data remains protected from debug-only capabilities.

## Links
- Spec: spec/reviewer/hu-048-environment-and-impersonation-policy-hardening/spec.md
- Plan: spec/reviewer/hu-048-environment-and-impersonation-policy-hardening/plan.md
- Tasks: spec/reviewer/hu-048-environment-and-impersonation-policy-hardening/tasks.md

## Acceptance criteria

- Release builds cannot enable impersonation through UI, hidden arguments, or persisted flags.
- Develop-only environment overrides remain available for QA and are clearly bounded.
- Reviewer routing and environment behavior are validated with explicit no-contamination checks.
- Android and iOS enforce equivalent hardening behavior.

## Scope
### In Scope
- Implement story HU-048 within MVP scope.
- Satisfy linked RFs: RF-REV-01, RF-REV-02, RF-REV-03, RF-ROL-05.

### Out of Scope
- Full IAM redesign outside app/runtime boundaries.
- New business reviewer features unrelated to environment safety.

## Implementation checklist
- [x] Android
- [x] iOS
- [x] Backend / Firestore
- [x] Testing
- [x] Documentation

## Implementation notes
- Hardening is implemented on top of HU-018 routing baseline, preserving session-scoped environment override behavior.
- Android:
  - `developImpersonationEnabled` is wired from `BuildConfig.DEBUG`.
  - `impersonateMember` and `clearImpersonation` are runtime-guarded when impersonation is disabled.
- iOS:
  - `developImpersonationEnabled` is compile-time guarded with `#if DEBUG`.
  - `impersonate` and `clearImpersonation` are runtime-guarded when impersonation is disabled.
- Reviewer environment routing remains bounded and reset-safe:
  - Production base sessions can reroute only allowlisted reviewer identities to `develop`.
  - Sign-out / session expiry resets environment override to base.

## Validation evidence
- Static/code inspection confirms release builds cannot expose impersonation behavior through runtime paths.
- Existing HU-018 validation suite remains valid for routing/no-contamination expectations.
- Manual QA reconfirmed in current cycle: reviewer flow tested and working as expected.

## Suggested labels
- type:feature
- area:reviewer
- platform:cross
- priority:P1

## Dependencies
- #13 (HU-018)
