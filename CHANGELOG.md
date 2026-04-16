# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- 2026-03-13 | ✨ feat(auth-ui): align splash and auth views
- 2026-03-13 | ✨ feat(app): implement startup remote version gate (HU-021)
- 2026-03-29 | ✨ feat(access): refresh session lifecycle and recovery UX (HU-023)
- 2026-03-30 | ✨ feat(access): gate unauthorized authenticated home access (HU-038)
- 2026-03-31 | ✨ feat(access): implement role-aware home shell and drawer (HU-039)
- 2026-03-31 | ✨ feat(access): wire drawer placeholder routes (HU-040)
- 2026-03-31 | ✨ feat(news): publish and manage news from admin (HU-012)
- 2026-04-01 | ✨ feat(notifications): deliver admin notifications end to end (HU-013)
- 2026-04-01 | ✨ feat(profile): add shared community hub (HU-014)
- 2026-04-02 | ✨ feat(shifts): implement global and next assignments (HU-015)
- 2026-04-05 | ✨ feat(functions): sync shifts with Google Sheets (HU-020/HU-041)
- 2026-04-05 | ✨ feat(shifts): implement shift swap request flow (HU-016)
- 2026-04-06 | ✨ feat(admin): manage delivery calendar overrides (HU-011)
- 2026-04-06 | ✨ feat(shifts): plan active-member seasons from admin (HU-017)
- 2026-04-07 | ✨ feat(functions): notify users on delivery day changes (HU-042)
- 2026-04-07 | ✨ feat(products): implement own catalog management (HU-007)
- 2026-04-08 | ✨ feat(products): add producer catalog visibility toggle (HU-024)
- 2026-04-09 | ✨ feat(order): implement HU-001 create-order flow
- 2026-04-09 | ✨ feat(order): enforce HU-002 commitments on checkout
- 2026-04-09 | ✨ feat(order): resume unconfirmed cart across re-entry (HU-003)
- 2026-04-09 | ✨ feat(order): allow confirmed order edits before cutoff (HU-004)
- 2026-04-10 | ✨ feat(order): show previous-week order in consultation window (HU-005)
- 2026-04-13 | ✨ feat(app): add develop time machine for date-dependent QA
- 2026-04-14 | ✨ feat(producers): implement received orders board (HU-008)
- 2026-04-14 | ✨ feat(producers): add producer status visual feedback (HU-009)
- 2026-04-15 | ✨ feat(access): route production reviewer to develop (HU-018)
- 2026-04-16 | ✨ feat(functions): add pending-order reminders (HU-006)
- 2026-04-16 | ✨ feat(functions): add HU-006 debug reminder trigger
- 2026-04-16 | ✨ feat(functions): add forced-user reminder debug run

### Fixed

- 2026-03-19 | 🐛 fix(firestore): use plus-collections paths
- 2026-04-05 | 🐛 fix(functions): read runtime config in v2 sheets sync
- 2026-04-05 | 🐛 fix(shifts): refine imported schedule board and aliases
- 2026-04-07 | 🐛 fix(functions): correct delivery-sheet exception matching
- 2026-04-09 | 🐛 fix(order): enforce avocado commitments with legacy mapping (HU-043)
- 2026-04-09 | 🐛 fix(order): harden seasonal commitment lookup for avocado warnings
- 2026-04-10 | 🐛 fix(order): finalize confirmed order flow
- 2026-04-13 | 🐛 fix(calendar): support legacy config keys and fallback paths for delivery calendar

### Documentation

- 2026-03-19 | 📝 docs(orders): define consumer name snapshots
- 2026-04-09 | 📝 docs(firestore): set seasonalCommitments qty field to fixedQty
- 2026-04-13 | 📝 docs(testing): document develop date override and weekly order test flow
- 2026-04-15 | 📝 docs(agents): require conventional-commits skill before commits

### Maintenance

- 2026-02-15 | 🔧 chore(repo): align stack docs and iOS baseline
- 2026-03-03 | 📦 build(android): update Gradle and Android deps
- 2026-03-13 | 🔧 chore(ios): sync localizable string catalog
- 2026-03-16 | 🔧 chore(repo): checkpoint pending app updates
- 2026-04-15 | 📦 build(ios): add env schemes and SwiftLint phase

### Changed

- 2026-04-08 | ♻️ refactor(android): split access routes and slim root files
- 2026-04-08 | ♻️ refactor(ios): split ContentView routes and action files
- 2026-04-08 | ♻️ refactor(l10n): remove hardcoded locale date formatting
- 2026-04-10 | ♻️ refactor(ios): organize Presentation/Access into feature folders
- 2026-04-15 | ♻️ refactor(ios): split order routes and tighten SwiftLint gate
- 2026-04-16 | ♻️ refactor(ios): clean lint and concurrency warnings
