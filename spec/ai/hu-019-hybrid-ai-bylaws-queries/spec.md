# HU-019 - Hybrid AI bylaws queries

## Metadata
- issue_id: #20
- priority: P3
- platform: both
- status: ready

## Context and problem

This story enables a critical part of the Reguerta MVP workflow and must preserve Android/iOS functional parity when applicable.

## User story

As a member I want fast bylaws answers so that I can resolve questions quickly.

## Scope

### In Scope
- Implement capability defined by HU-019 within MVP boundaries.
- Fulfill story-specific acceptance criteria for HU-019.

### Out of Scope
- Functionality marked as post-MVP in global requirements.
- Refactors not required to satisfy this story.

## Linked functional requirements

- RF-IA-01

## Acceptance criteria

- Regular questions are answered locally.
- Complex questions can escalate to cloud mode.
- Escalation decision follows explicit policy (confidence/coverage/intent complexity) and is observable.
- If cloud mode fails or times out, user receives safe fallback response and guidance.

## Dependencies

- Base references: docs-es/requirements/requisitos-mvp-reguerta-v1.md.
- Functional references: docs-es/requirements/historias-usuario-mvp-reguerta-v1.md.
- Data references: docs-es/requirements/firestore-estructura-mvp-propuesta-v1.md.
- Depends on local+cloud hybrid strategy and/or Google Sheets integration.

## Risks

- Main risk: misalignment between business rules and data rules.
  - Mitigation: validate against linked RFs and acceptance tests.
- Secondary risk: regression in existing weekly workflows.
  - Mitigation: weekly-window regression tests by role.
- Additional risk: cloud-cost and latency spikes.
  - Mitigation: local-first routing, bounded timeout, and usage telemetry.

## Definition of Done (DoD)

- [x] Story acceptance criteria validated.
- [x] Implementation aligned with linked RFs.
- [x] Android/iOS parity reviewed or temporary gap documented.
- [ ] Agreed tests executed.
- [x] Technical/functional documentation updated.
- [ ] Issue and PR linked.

## Validation notes

- iOS scheme tests executed on simulator `iPhone 17 (iOS 26.4.1)` because `iPhone 16` was unavailable locally.
- `ReguertaTests` passed and iOS `build` is green on `iPhone 17 (iOS 26.4.1)`.
- Targeted `ReguertaUITests` execution is currently blocked in this environment by simulator runner startup (`IDELaunchParametersSnapshot`), so functional UI evidence is pending.
- `connectedDebugAndroidTest` could not complete on connected device due install restriction (`INSTALL_FAILED_USER_RESTRICTED`).
- Android and iOS now both provide embedded in-app PDF viewing for bylaws.
