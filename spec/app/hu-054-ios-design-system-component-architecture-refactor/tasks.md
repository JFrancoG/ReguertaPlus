# Tasks - HU-054

GitHub tracking:

- #134 - iOS design-system component architecture refactor.

## 1. Preparation
- [ ] Confirm final component list from `DesignSystem/Components`.
- [ ] Confirm `ReguertaScreenHeader` is the reference pattern.
- [ ] Identify public type names and call sites for each component.
- [ ] Confirm whether any generic container needs a documented exception.

## 2. Component folder migration
- [ ] Create `ReguertaButton/`.
- [ ] Create `ReguertaCard/`.
- [ ] Create `ReguertaDialog/`.
- [ ] Create `ReguertaInlineFeedback/`.
- [ ] Create `ReguertaInputField/`.
- [ ] Remove migrated standalone component files after replacements compile.

## 3. View/view-model split
- [ ] Split `ReguertaButton` into view and view-model files.
- [ ] Split `ReguertaCard` into view and view-model files.
- [ ] Split `ReguertaDialog` into view and view-model files.
- [ ] Split `ReguertaInlineFeedback` into view and view-model files.
- [ ] Split `ReguertaInputField` into view and view-model files.
- [ ] Keep previews in view files.
- [ ] Move presentation enums, action structs, state/config models, and helpers into view-model files.
- [ ] Remove explicit `init` declarations from SwiftUI view structs.
- [ ] Keep visuals and accessibility behavior unchanged.

## 4. Xcode and call-site compatibility
- [ ] Update Xcode project membership if required.
- [ ] Preserve existing public names with aliases where useful.
- [ ] Adjust call sites only where required by the simplified API.
- [ ] Confirm `ReguertaScreenHeader` remains unchanged unless a small consistency fix is needed.

## 5. Validation
- [ ] Run SwiftLint for touched iOS files if available.
- [ ] Run `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' test`.
- [ ] Manually inspect previews in light/dark where possible.
- [ ] Confirm no Android changes are required.

## 6. Documentation and closure
- [ ] Update `spec.md` DoD.
- [ ] Link final PR in issue #134.
- [ ] Document validation evidence and any accepted exceptions.
