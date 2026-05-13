# Plan - HU-052 (iOS Liquid Glass screen header component)

## 1. Technical approach

Introduce `ReguertaScreenHeaderView` as a small SwiftUI design-system primitive before replacing route-specific headers. The component should be layout-stable, token-driven, and independent from current route state so HU-053 can migrate screens incrementally.

The implementation will keep all screen migration out of scope and only add previews for visual iteration. The component lives in its own folder with a view file and a view-model file so the UI structure stays separate from helper models and presentation decisions.

## 2. Layer impact
- UI: new iOS design-system component and previews.
- Domain: no changes.
- Data: no changes.
- Backend: no changes.
- Docs: HU-052 spec, plan, and tasks.

## 3. Platform-specific changes

### Android
- No implementation in HU-052.
- Record Android/Compose parity as deferred to a future story.

### iOS
- Add `ReguertaScreenHeader/ReguertaScreenHeaderView.swift` under `DesignSystem/Components`.
- Add `ReguertaScreenHeader/ReguertaScreenHeaderViewModel.swift` under `DesignSystem/Components`.
- Add `ReguertaHeaderText`, `ReguertaHeaderAction`, and `ReguertaHeaderBadge` to the view-model file.
- Add the glass icon button implementation as a subview in the view file.
- Avoid custom `init` declarations in all SwiftUI views.
- Use `GlassEffectContainer` when header actions are present.
- Keep icon action size fixed at `58.resize`.
- Add previews for the agreed variants.

### Functions/Backend
- Not applicable.

## 4. Test strategy
- Unit: not required; the change is a stateless SwiftUI component.
- Build/test: run the iOS scheme test command.
- Manual: inspect previews in light and dark modes, especially long text, badges, disabled state, and fallback styling.

## 5. Rollout and functional validation
- Ship the component unused by production screens.
- Review the component visually before HU-053 begins.
- Use HU-053 for the actual app-wide migration after design feedback.

## 6. Phased implementation sequence

### Phase 1 - Tracking and docs
- Create GitHub issue #132.
- Add HU-052 `spec.md`, `plan.md`, and `tasks.md`.

### Phase 2 - Component
- Add header text/action/badge models.
- Implement `ReguertaScreenHeader`.
- Implement the Liquid Glass icon button and fallback.

### Phase 3 - Preview and validation
- Add previews for all required states.
- Run iOS validation.
- Review the final diff and record any existing unrelated worktree changes.

## 7. Technical risks and mitigation
- Risk: previews compile but later route migration needs more configuration.
  - Mitigation: model text and actions as generic values rather than route-specific enums.
- Risk: badges shift button layout.
  - Mitigation: overlay badges on fixed-size icon buttons.
- Risk: fallback style drifts from Home shell.
  - Mitigation: match current material, border, and shadow conventions.
