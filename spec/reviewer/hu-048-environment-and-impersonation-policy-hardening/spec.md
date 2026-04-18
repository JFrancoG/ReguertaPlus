# HU-048 - Environment and impersonation policy hardening

## Metadata
- issue_id: #109
- priority: P1
- platform: both
- status: implemented

## Context and problem

Environment switching and impersonation controls are sensitive. Any production exposure of debug impersonation paths can create severe security and data-isolation risks.

## User story

As a security owner I want a hardened environment and impersonation policy so production data remains protected from debug-only capabilities.

## Scope

### In Scope
- Define canonical environment policy for develop vs production across platforms.
- Ensure impersonation capabilities are debug-only and blocked in release builds.
- Add explicit safeguards against production contamination in reviewer/test flows.
- Add verification checks in tests and release validation steps.

### Out of Scope
- Full IAM redesign outside app/runtime boundaries.
- New business reviewer features unrelated to environment safety.

## Linked functional requirements

- RF-REV-01, RF-REV-02, RF-REV-03
- RF-ROL-05

## Acceptance criteria

- Release builds cannot enable impersonation through UI, hidden arguments, or persisted flags.
- Develop-only environment overrides remain available for QA and are clearly bounded.
- Reviewer routing and environment behavior are validated with explicit no-contamination checks.
- Android and iOS enforce equivalent hardening behavior.

## Dependencies

- Base references: docs-es/requirements/requisitos-mvp-reguerta-v1.md.
- Functional references: docs-es/requirements/historias-usuario-mvp-reguerta-v1.md.
- Data references: docs-es/requirements/firestore-estructura-mvp-propuesta-v1.md.
- Depends on HU-018 runtime routing behavior.

## Risks

- Risk: accidental disablement of legitimate QA tooling.
  - Mitigation: separate debug-only tooling with explicit compile-time guards.
- Risk: platform divergence in build configuration.
  - Mitigation: add mirrored checks in Android/iOS release pipelines.

## Definition of Done (DoD)

- [x] Story acceptance criteria validated.
- [x] Implementation aligned with linked RFs.
- [x] Android/iOS parity reviewed or temporary gap documented.
- [x] Agreed tests executed.
- [x] Technical/functional documentation updated.
- [x] Issue and PR linked.

## Implementation notes

- Environment routing hardening builds on HU-018 and remains session-scoped on both platforms.
- Android impersonation is debug-only by construction:
  - `developImpersonationEnabled = BuildConfig.DEBUG`
  - Runtime guard in `impersonateMember/clearImpersonation` blocks behavior when disabled.
- iOS impersonation is debug-only by construction:
  - `#if DEBUG` enables impersonation, release builds force disable.
  - Runtime guard in `impersonate/clearImpersonation` blocks behavior when disabled.
- Reviewer routing remains bounded to production base sessions and only reroutes allowlisted reviewer identities to `develop`.
- Session sign-out and expiry reset environment overrides back to base, avoiding cross-session contamination.

## Validation evidence

- Static/code inspection confirms release builds cannot enable impersonation paths on Android and iOS.
- Existing automated validation from HU-018 remains green and covers runtime routing behavior in both platforms.
- Manual functional validation reconfirmed in current cycle by product validation ("probada y funcionando").
