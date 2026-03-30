# Plan - HU-038 (Unauthorized authenticated user home gating)

## 1. Technical approach

Separate unauthorized-access UX from session-expiry UX while keeping the same authorization source of truth: an active authorized `users` record matched by normalized email.

## 2. Layer impact
- UI: Restricted home presentation, disabled module affordances, and explicit sign-out action.
- Domain: Session-resolution outcomes already expose unauthorized state and may need small refinements for UX clarity.
- Data: Reuse existing email-to-user authorization lookup and active-member checks.
- Backend: No schema change expected; only confirm current `users` contract is sufficient.
- Docs: Add HU-038 and realign HU-010/HU-023 references.

## 3. Platform-specific changes
### Android
- Refine unauthorized home card/dialog treatment and restricted actions.
- Ensure sign-out is available from unauthorized state without looking like expiry recovery.

### iOS
- Mirror Android unauthorized home treatment and restricted actions.
- Keep parity in copy, disabled modules, and sign-out affordance.

### Functions/Backend
- Validate no extra backend path is required beyond current `users` authorization contract.

## 4. Test strategy
- Unit tests for unauthorized session resolution and home gating behavior where practical.
- UI/state integration tests for disabled modules and safe sign-out path.
- Manual validation with a Firebase-authenticated email absent from authorized `users`.

## 5. Rollout and functional validation
- Validate unauthorized login in `develop`.
- Validate transition from unauthorized to authorized after admin enablement.
- Confirm unauthorized and expired-session UX stay distinct.

## 6. Phased implementation sequence
### Phase 1 - Preparation
- Finalize copy and restricted-home interaction rules.
- Confirm exact protected entry points in scope for MVP.

### Phase 2 - Implementation
- Apply Android/iOS home-state changes.
- Add/update tests for unauthorized gating.

### Phase 3 - Closure
- Run validation, capture evidence, and update linked docs/issues.

## 7. Technical risks and mitigation
- Risk: unauthorized users can still reach placeholder flows through stale navigation state.
  - Mitigation: gate module actions and route transitions from the resolved session state.
- Risk: copy overlap with HU-023 causes support confusion.
  - Mitigation: keep unauthorized and expired wording/action paths intentionally different.
