# Plan - HU-021 (Startup remote version gate)

## 1. Technical approach

Implement startup version policy evaluation from environment-scoped `config/global`.

## 2. Layer impact
- UI: Forced/optional update dialogs and startup blocking states.
- Domain: Version comparison and policy resolution.
- Data: Read version policy fields from config document.
- Backend: Ensure policy fields are present and valid in each environment.
- Docs: Story/issue evidence updates.

## 3. Platform-specific changes
### Android
- Evaluate startup policy before entering main flows.

### iOS
- Mirror Android behavior with identical decision rules.

### Functions/Backend
- Validate required policy fields for local/develop/production configs.

## 4. Test strategy
- Unit tests for version comparison and policy resolution.
- Integration tests for config read paths.
- Manual startup validation for forced and optional modes.

## 5. Rollout and validation
- Validate across local/develop/production environments.
- Confirm parity Android/iOS.

## 6. Phased implementation sequence
### Phase 1 - Preparation
- Confirm config/global contract and version string format.

### Phase 2 - Implementation
- Implement policy evaluation and UI outcomes.

### Phase 3 - Closure
- Execute tests and document outcomes.

## 7. Risks and mitigation
- Risk: inconsistent policy across environments.
  - Mitigation: environment-level config checklist.
