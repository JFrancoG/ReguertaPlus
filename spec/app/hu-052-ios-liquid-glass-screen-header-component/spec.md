# HU-052 - iOS Liquid Glass screen header component

## Metadata
- issue_id: 132
- priority: P2
- platform: ios
- status: in-progress

## Context and problem

Most authenticated iOS routes already sit inside a shared Home shell, but screen-level headers, back affordances, and titles are still implemented in several local shapes. The next migration will touch many screens, so the reusable header should be designed and reviewed first as an isolated design-system component.

This story creates the iOS Liquid Glass screen header component only. Existing screens must not be migrated in this story.

## User story

As an iOS app user I want a consistent screen header with clear navigation and optional contextual actions so that every route can later use the same accessible top-of-screen pattern.

## Scope

### In Scope
- Add a reusable SwiftUI `ReguertaScreenHeaderView` design-system component.
- Keep a `ReguertaScreenHeader` type alias for the component contract.
- Split the component into a view file and a view-model/presentation-logic file.
- Support optional screen title, optional leading text, optional leading icon action, and optional trailing icon action.
- Support enabled/disabled icon actions.
- Support optional dot and count badges for trailing or leading icon actions.
- Use native Liquid Glass for icon actions on iOS 26+.
- Provide a material fallback for environments where the glass API is not active.
- Add SwiftUI previews covering the agreed design variants.
- Add HU spec, plan, and tasks artifacts.

### Out of Scope
- Migrating `HomeShellTopBarView`.
- Replacing existing screen back buttons.
- Removing duplicated screen titles.
- Changing route navigation behavior.
- Android or Compose parity.
- Backend, data, or domain changes.

## Linked functional requirements

- RF-APP-HEADER-01
- RF-APP-HEADER-02
- RF-APP-ACCESSIBILITY-01

## Acceptance criteria

- `ReguertaScreenHeaderView` exists under its own iOS design-system component folder.
- `ReguertaScreenHeaderView.swift` contains only the view, subviews, and previews.
- `ReguertaScreenHeaderViewModel.swift` contains text/action/badge models and presentation helpers.
- No SwiftUI `View` in the component declares a custom `init`.
- `ReguertaScreenHeaderViewModel` exposes:
  - `title: ReguertaHeaderText?`
  - `leadingAction: ReguertaHeaderAction?`
  - `leadingText: ReguertaHeaderText?`
  - `trailingAction: ReguertaHeaderAction?`
- `ReguertaHeaderText` supports `.localized(String)` and `.verbatim(String)`.
- `ReguertaHeaderAction` supports SF Symbol name, accessibility label, optional accessibility identifier, enabled state, optional badge, and action closure.
- `ReguertaHeaderBadge` supports `.dot` and `.count(Int)`.
- Icon actions render with Liquid Glass on iOS 26+ and material fallback otherwise.
- Icon action frames remain stable at `58.resize` square.
- Previews cover:
  - back + title,
  - back + leading text + title,
  - menu + date + notification dot with no title,
  - back + title + cart count,
  - disabled trailing action.
- No existing app screen is migrated in this story.

## Dependencies

- Existing iOS design tokens in `ReguertaDesignTokens`.
- Existing responsive sizing helpers such as `.resize`.
- iOS 26+ Liquid Glass API availability.
- GitHub issue #132.

## Risks

- Risk: component API may become too narrow for the future migration.
  - Mitigation: keep title/action/text models generic and independent from Home-specific destinations.
- Risk: Liquid Glass usage may diverge from existing Home shell glass style.
  - Mitigation: reuse the same circle shape, tint, material fallback, border, and shadow conventions.
- Risk: long leading text or titles may overlap actions.
  - Mitigation: use stable icon dimensions, line limits, and minimum scale factors.

## Definition of Done (DoD)

- [ ] Acceptance criteria validated.
- [ ] iOS validation executed or blocker documented.
- [ ] Android impact reviewed and recorded as out of scope.
- [ ] Documentation artifacts added.
