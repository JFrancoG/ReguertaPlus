# Tasks - HU-053

GitHub tracking:

- #136 - iOS Liquid Glass screen header migration.

## 1. Preparation
- [x] Audit iOS screens for local route headers, titles, and back buttons.
- [x] List all candidate files and group by feature area.
- [x] Confirm `ReguertaScreenHeader` API is sufficient for migration.
- [x] Decide and document Home shell top bar strategy.

## 2. Shared migration helpers
- [x] Add helper(s) only if repeated header action setup becomes noisy.
- [x] Preserve existing action accessibility labels/identifiers and document the shared title identifier change.
- [x] Keep navigation closures and route-state mutations unchanged.

## 3. Auth and entry routes
- [x] Migrate applicable auth back buttons to `ReguertaScreenHeader`.
- [x] Remove duplicated auth title chrome where replaced.
- [x] Verify login/register/password-reset flow still routes correctly.

## 4. Home and shell routes
- [x] Review `HomeShellTopBarView`.
- [x] Decide whether Home uses `ReguertaScreenHeader`, partial adaptation, or remains specialized.
- [x] Document rationale.

## 5. Feature route migration
- [x] Migrate bylaws route where applicable.
- [x] Review products routes and keep internal editor controls out of migration.
- [x] Migrate news and notifications routes where applicable.
- [x] Review users routes and keep internal editor controls out of migration.
- [x] Migrate settings/admin routes where applicable.
- [x] Migrate shifts routes where applicable.
- [x] Review shared profile routes and keep internal detail/editor controls out of migration.
- [x] Migrate order and received-order routes where applicable.
- [x] List screens intentionally left out with rationale.

## 6. Cleanup
- [x] Remove replaced local back button/title code.
- [x] Confirm no duplicated screen titles remain in migrated routes.
- [x] Confirm long titles and optional leading text do not overlap header actions.
- [x] Confirm Android has no code impact.

## 7. Validation
- [x] Run SwiftLint for touched iOS files if available.
- [x] Run `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' test`.
- [x] Perform manual pass through migrated screens in light/dark where possible.
- [x] Record any simulator or preview limitations.

## 8. Documentation and closure
- [x] Update `spec.md` DoD.
- [x] Link final PR in issue #136.
- [x] Document validation evidence and any accepted exceptions.
