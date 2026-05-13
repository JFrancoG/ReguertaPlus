# HU-054 - iOS design-system component architecture refactor

## Metadata
- issue_id: #134
- priority: P2
- platform: ios
- status: ready

## Context and problem

HU-052 introduced `ReguertaScreenHeader` using a cleaner component structure: a dedicated folder plus separate files for SwiftUI view composition and presentation support. The remaining iOS design-system components still live as standalone files, often mixing view layout, presentation enums, actions, helpers, previews, and explicit view initializers.

Before HU-053 starts replacing screen headers across app screens, the iOS design-system component folder should use one simple convention so future screen migrations do not amplify existing inconsistencies.

## User story

As an iOS maintainer I want each reusable design-system component to have a predictable folder and file split so that component changes stay small, visual code stays readable, and presentation logic does not leak into SwiftUI views.

## Scope

### In Scope
- Audit `ios/Reguerta/Reguerta/DesignSystem/Components/`.
- Refactor applicable standalone components into dedicated folders.
- Use two files per refactored component:
  - `<ComponentName>View.swift` for SwiftUI views, subviews, view-only modifiers, and previews.
  - `<ComponentName>ViewModel.swift` for presentation models, enums, actions, display helpers, and compatibility aliases if needed.
- Remove explicit `init` declarations from SwiftUI view structs.
- Keep logic out of SwiftUI view structs.
- Preserve visual output and behavior.
- Preserve existing call-site ergonomics where practical, with minimal call-site changes when the new API requires them.
- Keep `ReguertaScreenHeader` as the reference pattern and out of the migration scope except for small naming consistency fixes if needed.

### Out of Scope
- HU-053 screen header migration.
- Replacing screen-level headers, titles, or navigation buttons.
- Redesigning component visuals.
- Feature-specific view refactors outside `DesignSystem/Components`.
- Android/Compose parity changes.
- New design tokens or typography decisions.

## Initial component inventory

- `ReguertaButton.swift`
- `ReguertaCard.swift`
- `ReguertaDialog.swift`
- `ReguertaInlineFeedback.swift`
- `ReguertaInputField.swift`
- `ReguertaScreenHeader/` is already compliant and acts as the reference implementation.

## Linked functional requirements

- No direct functional requirement. This is an iOS design-system maintainability story.

## Acceptance criteria

- Each applicable iOS design-system component has its own folder under `DesignSystem/Components`.
- Each refactored component has a `View` file and a `ViewModel` file.
- View files contain SwiftUI view composition, private subviews, view-only modifiers, and previews only.
- View-model files contain presentation enums, action structs, state/config models, derived display helpers, and compatibility aliases.
- SwiftUI view structs contain no explicit `init` declarations.
- Non-trivial presentation logic is not implemented in SwiftUI view bodies.
- Existing visuals and accessibility behavior remain unchanged.
- Existing call sites compile after the refactor.
- Previews remain available for refactored components.
- `ReguertaScreenHeader` remains unchanged unless a small consistency adjustment is needed.

## Dependencies

- HU-052 establishes the target folder/file convention.
- HU-053 should wait until this refactor is complete to reduce screen migration churn.

## Risks

- Risk: call-site churn grows if component APIs change too much.
  - Mitigation: preserve aliases and model defaults where they keep the API simple.
- Risk: generic container components become awkward without explicit view initializers.
  - Mitigation: keep the refactor simple, document any unavoidable exception before implementation, and avoid redesigning the component contract unless needed.
- Risk: Xcode project membership may need updates for moved files.
  - Mitigation: validate with `xcodebuild` after moving files.
- Risk: visual regressions slip in during file moves.
  - Mitigation: avoid visual changes and keep previews for quick comparison.

## Definition of Done (DoD)

- [ ] Acceptance criteria validated.
- [ ] iOS validation executed or blocker documented.
- [ ] Android impact reviewed and recorded as out of scope.
- [ ] Documentation artifacts updated.
- [ ] Issue and PR linked.
