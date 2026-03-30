# Plan - HU-028 (Role-aware home shell and drawer navigation)

## 1. Technical approach

Introduce a reusable home shell with a role-aware drawer and structured content zones so new features can plug in without reworking the app entry screen repeatedly.

## 2. Layer impact
- UI: Home shell, drawer, top actions, placeholders, and role-aware sections.
- Domain: Role visibility mapping for drawer sections.
- Data: Read-only use of existing session/member role data; later weekly/news data can plug into the shell.
- Backend: No immediate schema changes required for visual shell scaffolding.
- Docs: Add HU-028 and clarify ownership against HU-027.

## 3. Platform-specific changes
### Android
- Implement drawer/sheet interaction following native patterns.
- Add role-aware section visibility and version footer.

### iOS
- Implement matching shell and drawer interaction adapted to SwiftUI patterns.
- Preserve the same information architecture and role gating as Android.

### Functions/Backend
- Not required for initial shell scaffolding.

## 4. Test strategy
- Unit tests for role-based section visibility where practical.
- UI tests for drawer visibility and restricted/role-aware menu composition.
- Manual validation for gestures, drawer toggle, and placeholder rendering.

## 5. Rollout and functional validation
- Validate common/member/producer/admin navigation variants in `develop`.
- Confirm shell still behaves correctly with unauthorized and expired-session overlays.

## 6. Phased implementation sequence
### Phase 1 - Preparation
- Finalize information architecture and placeholder zones.
- Confirm which sections are common, producer-only, and admin-only.

### Phase 2 - Implementation
- Build shell and drawer on Android/iOS.
- Add placeholder zones for weekly context and latest news.

### Phase 3 - Closure
- Execute validations and capture screenshots/evidence.

## 7. Technical risks and mitigation
- Risk: role menus become tightly coupled to future unfinished modules.
  - Mitigation: keep menu descriptors centralized and allow placeholder states.
- Risk: gesture behavior causes accidental drawer interactions.
  - Mitigation: follow conservative platform defaults and validate manually.
