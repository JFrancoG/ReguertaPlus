# Tasks - HU-054

GitHub tracking:

- #134 - iOS design-system component architecture refactor.

## 1. Preparation
- [x] Confirm final component list from `DesignSystem/Components`.
- [x] Confirm `ReguertaScreenHeader` is the reference pattern.
- [x] Identify public type names and call sites for each component.
- [x] Confirm whether any generic container needs a documented exception.

## 2. Component folder migration
- [x] Create `ReguertaButton/`.
- [x] Create `ReguertaCard/`.
- [x] Create `ReguertaDialog/`.
- [x] Create `ReguertaInlineFeedback/`.
- [x] Create `ReguertaInputField/`.
- [x] Remove migrated standalone component files after replacements compile.

## 3. View/view-model split
- [x] Split `ReguertaButton` into view and view-model files.
- [x] Split `ReguertaCard` into view and view-model files.
- [x] Split `ReguertaDialog` into view and view-model files.
- [x] Split `ReguertaInlineFeedback` into view and view-model files.
- [x] Split `ReguertaInputField` into view and view-model files.
- [x] Keep previews in view files.
- [x] Move presentation enums, action structs, state/config models, and helpers into view-model files.
- [x] Remove explicit `init` declarations from SwiftUI view structs.
- [x] Keep visuals and accessibility behavior unchanged.

## 4. Xcode and call-site compatibility
- [x] Update Xcode project membership if required.
- [x] Adopt camelCase component factories without SwiftLint suppressions.
- [x] Adjust call sites for the simplified API.
- [x] Confirm `ReguertaScreenHeader` remains unchanged unless a small consistency fix is needed.

## 5. Validation
- [x] Run SwiftLint for touched iOS files if available.
- [x] Run `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' test`.
- [ ] Manually inspect previews in light/dark where possible.
- [x] Confirm no Android changes are required.

## 6. Documentation and closure
- [x] Update `spec.md` DoD.
- [ ] Link final PR in issue #134.
- [x] Document validation evidence and any accepted exceptions.
