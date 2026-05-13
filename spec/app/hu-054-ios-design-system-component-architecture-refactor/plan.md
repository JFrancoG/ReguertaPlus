# Plan - HU-054

## 1. Technical approach

Refactor iOS design-system components to match the `ReguertaScreenHeader` architecture: one component folder, one view file, and one view-model/support file. This is a structural refactor only. Visuals, accessibility labels, behavior, and call-site semantics should stay the same.

## 2. Layer impact

- UI: iOS design-system component files move into per-component folders and split view composition from presentation support.
- Domain: no changes.
- Data: no changes.
- Backend: no changes.
- Docs: HU spec, plan, tasks, and implementation evidence.

## 3. Platform-specific changes

### Android
- No code changes.
- Record as an intentional parity non-impact because this is an iOS SwiftUI file-structure refactor.

### iOS
- Audit the remaining standalone SwiftUI component files under `DesignSystem/Components`.
- Move each applicable component to `DesignSystem/Components/<ComponentName>/`.
- Split each applicable component into:
  - `<ComponentName>View.swift`
  - `<ComponentName>ViewModel.swift`
- Keep `ReguertaScreenHeader` as the reference pattern.
- Remove explicit `init` declarations from SwiftUI view structs.
- Move enums, actions, config/state models, display helpers, and compatibility aliases into view-model files.
- Keep previews in view files.
- Update Xcode project membership if the project does not pick up moved files automatically.

### Functions/Backend
- No changes.

## 4. Test strategy

- Static: verify no explicit `init` declarations remain in refactored SwiftUI view files.
- Static: verify no old standalone component files remain for components that were migrated.
- Lint: run SwiftLint for touched iOS files if available.
- Build/test: run `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' test`.
- Manual: inspect previews for refactored components in light and dark mode where possible.

## 5. Rollout and functional validation

- Keep the PR focused on file organization and local call-site fixes.
- Do not combine with HU-053 screen header migration.
- Confirm there are no visual or behavioral changes in the handoff.

## 6. Phased implementation sequence

### Phase 1 - Audit
- Inventory current component files, public types, explicit initializers, previews, and call sites.
- Decide which components are directly applicable to the two-file pattern.

### Phase 2 - File moves and split
- Create component folders.
- Move view composition, subviews, and previews into `View` files.
- Move presentation enums, actions, config models, and helpers into `ViewModel` files.
- Adopt camelCase component factories instead of lint-disabled UpperCamelCase factory aliases.

### Phase 3 - Compile and polish
- Update imports, project membership, and call sites only as required.
- Run static checks and iOS validation.
- Update tasks and DoD with evidence.

## 7. Technical risks and mitigation

- Call-site churn -> apply a mechanical rename to camelCase factories and validate with `xcodebuild`.
- Generic `@ViewBuilder` containers -> keep the simplest compiling API and document any exception before broad changes.
- Xcode project file drift -> validate through `xcodebuild`.
- Hidden visual changes -> avoid style edits and keep previews close to the moved component.
