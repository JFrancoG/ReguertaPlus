# [HU-019] Hybrid AI bylaws queries

## Summary

As a member I want fast bylaws answers so that I can resolve questions quickly.

## Links
- Spec: spec/ai/hu-019-hybrid-ai-bylaws-queries/spec.md
- Plan: spec/ai/hu-019-hybrid-ai-bylaws-queries/plan.md
- Tasks: spec/ai/hu-019-hybrid-ai-bylaws-queries/tasks.md

## Acceptance criteria

- Regular questions are answered locally.
- Complex questions can escalate to cloud mode.

## Agreed implementation direction
- Local-first routing is mandatory.
- Escalation to cloud must follow explicit policy (confidence/coverage/complexity).
- Cloud calls must be bounded by timeout and have safe fallback messaging.
- Android and iOS must expose equivalent user-visible states (local answer, cloud answer, fallback).

## Scope
### In Scope
- Implement story HU-019 within MVP scope.
- Satisfy linked RFs: RF-IA-01.

### Out of Scope
- Post-MVP functionality.
- Refactors not required to close acceptance criteria.

## Implementation checklist
- [ ] Android
- [ ] iOS
- [ ] Backend / Firestore
- [ ] Testing
- [ ] Documentation

## Suggested labels
- type:feature
- area:ai
- platform:cross
- priority:P3
