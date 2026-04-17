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
- [ ] Android
- [ ] iOS
- [ ] Backend / Firestore
- [ ] Testing
- [ ] Documentation

## Suggested labels
- type:feature
- area:reviewer
- platform:cross
- priority:P1

## Dependencies
- #13 (HU-018)
