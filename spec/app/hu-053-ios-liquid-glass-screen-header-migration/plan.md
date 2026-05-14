# Plan - HU-053

## 1. Technical approach

Migrate iOS route-level top chrome to `ReguertaScreenHeader` without changing business behavior. Treat Home separately because its top bar combines menu, date, notifications, drawer state, and dashboard-specific semantics.

Implementation decision: Home now uses `ReguertaScreenHeader` through `HomeShellTopBarView`. Dashboard maps its date to `leadingText`; non-dashboard routes map their screen title to `title` and keep the existing leading/trailing actions.

## 2. Layer impact

- UI: replace local header/back/title rows in iOS SwiftUI routes with `ReguertaScreenHeader`.
- Domain: no changes.
- Data: no changes.
- Backend: no changes.
- Docs: update HU-053 tasks/spec with migration decisions and validation evidence.

## 3. Platform-specific changes

### Android
- No code changes.
- Record Android/Compose parity as intentionally out of scope.

### iOS
- Audit current route headers and local back buttons.
- Introduce small local helpers only when they reduce repeated `ReguertaHeaderAction` setup without hiding navigation behavior.
- Replace applicable screen-level back/title rows with `ReguertaScreenHeader`.
- Keep route-specific content and actions unchanged.
- Preserve accessibility labels and identifiers.
- Make a specific Home top bar decision after inspecting `HomeShellTopBarView`.

### Functions/Backend
- No changes.

## 4. Test strategy

- Static: verify migrated screens no longer contain duplicate local route headers.
- Static: verify `ReguertaScreenHeader` usage is limited to screen-level top chrome, not arbitrary card/section headings.
- Lint: run SwiftLint for touched iOS files if available.
- Build/test: run `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' test`.
- Manual: navigate through migrated screens in light/dark mode and confirm title/back/action layout.

## 5. Rollout and functional validation

- Keep one focused PR for iOS header migration.
- Avoid unrelated layout redesigns.
- Record any intentionally skipped screen in the handoff.
- Keep Android as a documented parity gap until a Compose header story is planned.

## 6. Phased implementation sequence

### Phase 1 - Audit
- Find custom back buttons, `commonBack` usage, local title rows, and screen-level HStacks.
- Group routes by migration risk.
- Decide whether Home uses the generic header or remains specialized.

### Phase 2 - Low-risk route migration
- Migrate straightforward feature routes with simple back + title patterns.
- Remove duplicated title text.
- Preserve accessibility identifiers.

### Phase 3 - Complex route migration
- Review auth, order, products, news, users, settings, shifts, profile, bylaws, and received-orders routes.
- Migrate only where the header is screen-level chrome.
- Document screens left specialized.

### Phase 4 - Validation and closure
- Run lint and iOS tests.
- Perform manual pass where practical.
- Update tasks, DoD, and PR evidence.

Status: build and tests pass on `iPhone 17`; manual light/dark screenshots were reviewed during iteration.

## 7. Technical risks and mitigation

- Header migration churn -> group changes by route area and keep behavior closures intact.
- Home mismatch -> document a separate decision instead of forcing generic reuse.
- Accessibility regressions -> preserve labels/identifiers and rely on existing UI tests.
- Spacing regressions -> avoid modifying route content layout beyond replacing header rows.
