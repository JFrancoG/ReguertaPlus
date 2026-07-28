# Plan - HU-021 (Startup remote version gate)

## 1. Technical approach

Implement startup version policy evaluation from environment-scoped `config/public`, using a
server-only read and explicit unavailable/timeout states. While Firebase remains on Phase 1 and
the public projection is not deployed, users may explicitly continue after the warning; the
strict gate is not release-ready until the backend prerequisite is verified live. At that
coordinated cutover, both clients must remove or disable the provisional Continue action for
unavailable/timeout states so a failed policy check cannot bypass startup enforcement.

## 2. Layer impact
- UI: Forced/optional update dialogs and startup blocking states.
- Domain: Version comparison and policy resolution.
- Data: Read required version policy fields from `config/public` without cache fallback.
- Backend: Seed the public projection and allow its anonymous read only at the coordinated cutover.
- Docs: Story/issue evidence updates.

## 3. Platform-specific changes
### Android
- Evaluate startup policy before entering main flows.

### iOS
- Mirror Android behavior with identical decision rules.

### Functions/Backend
- Validate required policy fields for local/develop/production public projections.

## 4. Test strategy
- Unit tests for version comparison and policy resolution.
- Integration tests for server-only config reads, typed failures, timeout, and retry.
- Manual startup validation for forced and optional modes.

## 5. Rollout and validation
- Validate across local/develop/production environments.
- Confirm parity Android/iOS.

## 6. Phased implementation sequence
### Phase 1 - Preparation
- Confirm `config/public` contract and version string format.

### Phase 2 - Implementation
- Implement policy evaluation and UI outcomes.

### Phase 3 - Closure
- Deploy and verify the environment-scoped public projection.
- Remove or disable the provisional Continue action on Android and iOS.
- Execute strict-gate integration/manual tests and document outcomes.

## 7. Risks and mitigation
- Risk: Phase 1 does not yet expose `config/public` to signed-out clients.
  - Mitigation: explicit recoverable warning in the client and a live backend gate before strict release.
- Risk: retaining the provisional Continue action after backend cutover would make unavailable/timeout fail open.
  - Mitigation: track client-side removal as an explicit cutover task and validate both states remain blocking.
