# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Documentation

- 2026-08-29 | 📝 docs(shifts): reconcile recovery CAS evidence
- 2026-08-24 | 📝 docs(shifts): define seasonal rotation rollout
- 2026-08-23 | 📝 docs(ios): prepare HU-081 closeout
- 2026-08-23 | 📝 docs(ios): record HU-081 swap checkpoint
- 2026-08-23 | 📝 docs(ios): start HU-081 swap ownership
- 2026-08-23 | 📝 docs(ios): start HU-081 feed ownership
- 2026-08-23 | 📝 docs(ios): record HU-081 calendar checkpoint
- 2026-08-23 | 📝 docs(ios): record HU-081 checkpoint

### Changed

- 2026-08-23 | ♻️ refactor(ios): own shift swap mutation lifecycle
- 2026-08-23 | ♻️ refactor(ios): own shifts feed lifecycle
- 2026-08-23 | ♻️ refactor(ios): make swap commands authoritative
- 2026-08-23 | ♻️ refactor(ios): harden order state ownership
- 2026-08-21 | ♻️ refactor(ios): harden auth session ownership
- 2026-08-20 | ♻️ refactor(ios): adopt adaptive layout
- 2026-08-19 | ♻️ refactor(ios): consolidate app composition
- 2026-08-19 | ♻️ refactor(ios): own session runtime context
- 2026-08-19 | ♻️ refactor(ios): adopt nonisolated isolation
- 2026-08-18 | ♻️ refactor(ios): simplify struct construction
- 2026-08-11 | ♻️ refactor(ios): remove dormant repositories
- 2026-08-05 | 💄 style(ios): clear Swift line-length baseline

### Added

- 2026-08-29 | ✨ feat(shifts): fence bulk shift export
- 2026-08-29 | ✨ feat(shifts): route calendar writes to command
- 2026-08-29 | ✨ feat(shifts): add calendar mutation command
- 2026-08-29 | ✨ feat(shifts): fence calendar trigger authority
- 2026-08-29 | ✨ feat(shifts): fence legacy planner authority
- 2026-08-29 | ✨ feat(shifts): fence Sheets import authority
- 2026-08-29 | ✨ feat(shifts): fence swap planning authority
- 2026-08-29 | ✨ feat(shifts): route notification push opens
- 2026-08-29 | ✨ feat(shifts): open authorized notification detail
- 2026-08-28 | ✨ feat(shifts): mark planning notifications generic
- 2026-08-28 | ✨ feat(shifts): expose planning read-back
- 2026-08-28 | ✨ feat(shifts): terminalize notification incidents

- 2026-08-28 | ✨ feat(shifts): persist degraded incidents

- 2026-08-28 | ✨ feat(shifts): enforce incident fences

- 2026-08-28 | ✨ feat(shifts): model terminal incidents

- 2026-08-28 | ✨ feat(shifts): persist batch reconciliation

- 2026-08-28 | ✨ feat(shifts): reconcile notification batches
- 2026-08-28 | ✨ feat(shifts): bind notification runtime
- 2026-08-28 | ✨ feat(shifts): compose notification dispatch
- 2026-08-28 | ✨ feat(shifts): reserve governed notifications
- 2026-08-28 | ✨ feat(devices): defer blocked registration
- 2026-08-28 | ✨ feat(shifts): fence legacy shift writers
- 2026-08-28 | ✨ feat(shifts): fence v2 shift transactions
- 2026-08-28 | ✨ feat(shifts): fence backend shift writers
- 2026-08-28 | ✨ feat(shifts): fence notification-bound writers
- 2026-08-28 | ✨ feat(shifts): bound notification transport attempts
- 2026-08-28 | ✨ feat(shifts): persist notification dispatch attempts
- 2026-08-28 | ✨ feat(shifts): release held notification effects
- 2026-08-27 | ✨ feat(shifts): fence activation request lifecycle
- 2026-08-27 | ✨ feat(shifts): retain public event evidence
- 2026-08-27 | ✨ feat(shifts): classify controlled shift events
- 2026-08-27 | ✨ feat(shifts): govern sync command retries
- 2026-08-27 | ✨ feat(shifts): restrict recovery operator endpoint
- 2026-08-26 | ✨ feat(shifts): authorize recovery execution
- 2026-08-26 | ✨ feat(shifts): persist activation failures
- 2026-08-26 | ✨ feat(shifts): route governed planning requests
- 2026-08-26 | ✨ feat(shifts): recheck governed sources
- 2026-08-26 | ✨ feat(shifts): produce governed sources
- 2026-08-26 | ✨ feat(shifts): resolve planning CAS sources
- 2026-08-26 | ✨ feat(shifts): execute planning CAS runtime
- 2026-08-26 | ✨ feat(shifts): persist attempt outcomes
- 2026-08-26 | ✨ feat(shifts): materialize inverse recoveries
- 2026-08-26 | ✨ feat(shifts): materialize forward activations
- 2026-08-25 | ✨ feat(shifts): add activation transaction contracts
- 2026-08-25 | ✨ feat(shifts): add staged candidate positions
- 2026-08-25 | ✨ feat(shifts): persist intake barrier evidence
- 2026-08-25 | ✨ feat(shifts): add consultation baseline
- 2026-08-24 | ✨ feat(shifts): enforce planning intake barrier
- 2026-08-24 | ✨ feat(shifts): bind planning artifacts to state
- 2026-08-24 | ✨ feat(shifts): orchestrate seasonal planning lifecycle
- 2026-08-24 | ✨ feat(shifts): persist seasonal planning workflow
- 2026-08-24 | ✨ feat(shifts): add seasonal planning bundle
- 2026-08-24 | ✨ feat(shifts): add deterministic rotation planners
- 2026-07-29 | ✨ feat(order): refresh critical data before entry
- 2026-07-27 | ✨ feat(ios): adopt linked authorization
- 2026-07-27 | ✨ feat(android): adopt linked authorization
- 2026-07-27 | ✨ feat(firebase): add phased role authorization
- 2026-07-12 | ✨ feat(users): redesign member editor
- 2026-07-11 | ✨ feat(products): redesign mobile product editor
- 2026-07-11 | ✨ feat(settings): add appearance and unavailable mode
- 2026-07-08 | ✨ feat(access): confirm drawer sign-out
- 2026-05-27 | ✨ feat(shifts): redesign shifts screen
- 2026-05-26 | ✨ feat(orders): add received order history
- 2026-05-25 | ✨ feat(orders): add weekly order history
- 2026-05-25 | ✨ feat(community): refine family profiles
- 2026-05-22 | ✨ feat(news): refine news and notification UX
- 2026-05-22 | ✨ feat(notifications): add read-state feed
- 2026-05-16 | ✨ feat(ui): add reusable list controls
- 2026-05-14 | ✨ feat(home): add weekly market context
- 2026-05-14 | ✨ feat(ios-ui): migrate liquid glass headers
- 2026-05-13 | ✨ feat(ios-ui): add screen header component
- 2026-05-03 | ✨ feat(home): apply HU-051 redesign
- 2026-04-28 | ✨ feat(access): implement HU-019 bylaws hybrid mode
- 2026-04-19 | ✨ feat(media): integrate image picker in news and profile
- 2026-04-18 | ✨ feat(access): implement admin users management
- 2026-04-18 | ✨ feat(media): add shared image pipeline and naming
- 2026-04-17 | ✨ feat(access): add HU-044 role capability matrix
- 2026-04-17 | ✨ feat(orders): harden producer status security contract (HU-045)
- 2026-04-17 | ✨ feat(functions): add HU-046 reminder retries
- 2026-04-16 | ✨ feat(functions): add pending-order reminders (HU-006)
- 2026-04-15 | ✨ feat(access): route production reviewer to develop (HU-018)
- 2026-04-14 | ✨ feat(producers): implement received orders board (HU-008)
- 2026-04-14 | ✨ feat(producers): add producer status visual feedback (HU-009)
- 2026-04-13 | ✨ feat(app): add develop time machine for date-dependent QA
- 2026-04-10 | ✨ feat(order): show previous-week order in consultation window (HU-005)
- 2026-04-09 | ✨ feat(order): implement HU-001 create-order flow
- 2026-04-09 | ✨ feat(order): enforce HU-002 commitments on checkout
- 2026-04-09 | ✨ feat(order): resume unconfirmed cart across re-entry (HU-003)
- 2026-04-09 | ✨ feat(order): allow confirmed order edits before cutoff (HU-004)
- 2026-04-08 | ✨ feat(products): add producer catalog visibility toggle (HU-024)
- 2026-04-07 | ✨ feat(functions): notify users on delivery day changes (HU-042)
- 2026-04-07 | ✨ feat(products): implement own catalog management (HU-007)
- 2026-04-06 | ✨ feat(admin): manage delivery calendar overrides (HU-011)
- 2026-04-06 | ✨ feat(shifts): plan active-member seasons from admin (HU-017)
- 2026-04-05 | ✨ feat(functions): sync shifts with Google Sheets (HU-020/HU-041)
- 2026-04-05 | ✨ feat(shifts): implement shift swap request flow (HU-016)
- 2026-04-02 | ✨ feat(shifts): implement global and next assignments (HU-015)
- 2026-04-01 | ✨ feat(notifications): deliver admin notifications end to end (HU-013)
- 2026-04-01 | ✨ feat(profile): add shared community hub (HU-014)
- 2026-03-31 | ✨ feat(access): implement role-aware home shell and drawer (HU-039)
- 2026-03-31 | ✨ feat(access): wire drawer placeholder routes (HU-040)
- 2026-03-31 | ✨ feat(news): publish and manage news from admin (HU-012)
- 2026-03-30 | ✨ feat(access): gate unauthorized authenticated home access (HU-038)
- 2026-03-29 | ✨ feat(access): refresh session lifecycle and recovery UX (HU-023)
- 2026-03-13 | ✨ feat(auth-ui): align splash and auth views
- 2026-03-13 | ✨ feat(app): implement startup remote version gate (HU-021)

### Fixed

- 2026-08-29 | 🐛 fix(shifts): block direct shift writes
- 2026-08-29 | 🐛 fix(shifts): block direct calendar writes
- 2026-08-23 | 🐛 fix(ios): enforce Madrid delivery calendar
- 2026-08-23 | 🐛 fix(ios): load member delivery calendar
- 2026-08-21 | 🐛 fix(ios-ui): restore screen spacing and dialogs
- 2026-08-19 | 🐛 fix(home): stabilize order freshness recovery
- 2026-08-18 | 🐛 fix(home): automate freshness and feed recovery
- 2026-08-18 | 🐛 fix(news): remove nonexistent publisher metadata
- 2026-08-18 | 🐛 fix(android): preserve state across activity recreation
- 2026-08-18 | 🐛 fix(startup): allow public version checks
- 2026-08-14 | 🐛 fix(access): fix login feedback and validation
- 2026-08-12 | 🐛 fix(auth): accept legacy Firestore values
- 2026-08-11 | 🐛 fix(ios): clear strict concurrency warnings
- 2026-07-29 | 🐛 fix(community): enforce feed integrity
- 2026-07-29 | 🐛 fix(android): preserve device identity across secure-store migration
- 2026-07-28 | 🐛 fix(push): fence registration to live sessions
- 2026-07-28 | 🐛 fix(android-auth): preserve cleanup quarantine
- 2026-07-28 | 🐛 fix(auth): bound session operations
- 2026-07-28 | 🐛 fix(android-auth): shorten credential lifetime
- 2026-07-28 | 🐛 fix(security): harden device credential storage
- 2026-07-28 | 🐛 fix(app): harden startup and freshness gates
- 2026-07-28 | 🐛 fix(android-auth): fence stale sessions
- 2026-07-28 | 🐛 fix(shifts): surface remote failures
- 2026-07-27 | 🐛 fix(community): surface profile failures
- 2026-07-27 | 🐛 fix(products): surface repository failures
- 2026-07-27 | 🐛 fix(mobile-ui): enforce WCAG AA contrast
- 2026-07-27 | 🐛 fix(ios-freshness): make refresh tasks deterministic
- 2026-07-27 | 🐛 fix(ios-auth): invalidate stale session tasks
- 2026-07-27 | 🐛 fix(ios): stop logging FCM tokens
- 2026-07-25 | 🐛 fix(bylaws): ground local answers in article evidence
- 2026-07-12 | 🐛 fix(navigation): return broadcast editor home
- 2026-07-12 | 🐛 fix(users): gate purchase manager by producer
- 2026-07-12 | 🐛 fix(users): refine member editor controls
- 2026-07-12 | 🐛 fix(users): refine member editor layout
- 2026-07-12 | 🐛 fix(android-orders): show product fallback image
- 2026-07-12 | 🐛 fix(orders): stabilize editable order summary
- 2026-07-12 | 🐛 fix(orders): localize checkout dialogs
- 2026-07-12 | 🐛 fix(orders): align last order presentation
- 2026-07-12 | 🐛 fix(orders): polish received orders UI
- 2026-07-11 | 🐛 fix(android-orders): align purchase group title
- 2026-07-11 | 🐛 fix(ios-orders): shrink purchase badge text
- 2026-07-11 | 🐛 fix(orders): shorten shared purchase title
- 2026-07-11 | 🐛 fix(orders): localize order screen copy
- 2026-07-11 | 🐛 fix(products): show product fallback image
- 2026-07-11 | 🐛 fix(mobile): localize weekly order screens
- 2026-07-11 | 🐛 fix(bylaws): refine query experience
- 2026-07-10 | 🐛 fix(android-ui): space screen header content
- 2026-07-10 | 🐛 fix(community): merge profile intro copy
- 2026-07-10 | 🐛 fix(android-ui): standardize screen headers
- 2026-07-10 | 🐛 fix(ui): restore news image and header layout
- 2026-07-10 | 🐛 fix(shifts): align helper assignments
- 2026-07-08 | 🐛 fix(ios-ui): refine welcome layout
- 2026-07-08 | 🐛 fix(android-orders): polish order cards
- 2026-07-07 | 🐛 fix(ui): polish drawer and mobile spacing
- 2026-07-07 | 🐛 fix(home): align weekly delivery summary
- 2026-05-22 | 🐛 fix(orders): correct received order prep display
- 2026-05-21 | 🐛 fix(order): align producer card dividers
- 2026-05-21 | 🐛 fix(prices): localize euro formatting
- 2026-05-21 | 🐛 fix(order): polish my order cards
- 2026-05-15 | 🐛 fix(ios): resolve lint and concurrency errors
- 2026-05-15 | 🐛 fix(ios-ui): restore drawer route scrolling
- 2026-05-15 | 🐛 fix(mobile): polish safe area order UI
- 2026-05-15 | 🐛 fix(orders): polish my order list UI
- 2026-05-15 | 🐛 fix(ios-home): fix dashboard news layout
- 2026-05-14 | 🐛 fix(order): polish cart overlay layout
- 2026-05-14 | 🐛 fix(ios-home): refine order buttons glass
- 2026-05-13 | 🐛 fix(firestore): remove legacy collection paths
- 2026-05-13 | 🐛 fix(order): restore last order lookup
- 2026-05-13 | 🐛 fix(ios): fix side drawer layout
- 2026-05-12 | 🐛 fix(ios-orders): persist draft cart
- 2026-05-12 | 🐛 fix(ios-home): restore drawer navigation
- 2026-05-11 | 🐛 fix(order): polish cart overlay
- 2026-05-09 | 🐛 fix(ui): refine order screen chrome
- 2026-05-09 | 🐛 fix(home): polish action tiles
- 2026-05-03 | 🐛 fix(ios): add glass home controls
- 2026-05-03 | 🐛 fix(ios): pin home dashboard layout
- 2026-05-03 | 🐛 fix(ios): group home summary fields
- 2026-05-03 | 🐛 fix(home): align summary week range
- 2026-05-03 | 🐛 fix(home): refine HU-051 layout
- 2026-05-03 | 🐛 fix(ios): hide drawer behind home content
- 2026-04-19 | 🐛 fix(mobile): migrate permission strings to xcstrings
- 2026-04-13 | 🐛 fix(calendar): support legacy config keys and fallback paths for delivery calendar
- 2026-04-10 | 🐛 fix(order): finalize confirmed order flow
- 2026-04-09 | 🐛 fix(order): enforce avocado commitments with legacy mapping (HU-043)
- 2026-04-09 | 🐛 fix(order): harden seasonal commitment lookup for avocado warnings
- 2026-04-07 | 🐛 fix(functions): correct delivery-sheet exception matching
- 2026-04-05 | 🐛 fix(functions): read runtime config in v2 sheets sync
- 2026-04-05 | 🐛 fix(shifts): refine imported schedule board and aliases
- 2026-03-19 | 🐛 fix(firestore): use plus-collections paths

### Tests

- 2026-08-29 | ✅ test(shifts): prove generated swap compatibility
- 2026-08-28 | ✅ test(shifts): prove atomic activation publication
- 2026-08-28 | ✅ test(shifts): prove planner provenance compatibility
- 2026-08-19 | ✅ test(ios): add reproducible validation lanes
- 2026-07-27 | ✅ test(ios): harden home news regression

### Documentation

- 2026-08-23 | 📝 docs(hu-080): record delivery authorization
- 2026-08-21 | 📝 docs(hu-079): record delivery authorization
- 2026-08-21 | 📝 docs(hu-078): record delivery authorization
- 2026-08-19 | 📝 docs(hu-077): record final delivery
- 2026-08-19 | 📝 docs(hu-076): record branch publication
- 2026-08-19 | 📝 docs(hu-075): record branch publication
- 2026-08-19 | 📝 docs(hu-074): record branch publication
- 2026-08-18 | 📝 docs(hu-073): record final delivery
- 2026-08-18 | 📝 docs(hu-072): record pull request readiness
- 2026-07-30 | 📝 docs(ios): document domain contracts
- 2026-07-27 | 📝 docs(design-system): add generated color catalog
- 2026-07-27 | 📝 docs(firebase): record HU-070 rollout state
- 2026-07-12 | 📝 docs(users): link HU-069 pull request
- 2026-07-11 | 📝 docs(orders): link HU-068 pull request
- 2026-07-10 | 📝 docs(app): link HU-065 pull request
- 2026-07-10 | 📝 docs(app): link HU-064 pull request
- 2026-07-10 | 📝 docs(shifts): link HU-063 pull request
- 2026-05-03 | 📝 docs(design): refine home drawer proposal
- 2026-05-03 | 📝 docs(design): add home drawer proposal
- 2026-05-03 | 📝 docs(design): add home dashboard proposal
- 2026-04-19 | 📝 docs(changelog): reorder entries by recency
- 2026-04-18 | 📝 docs(spec): align HU-019 planning artifacts
- 2026-04-18 | 📝 docs(reviewer): close HU-048 hardening checklist
- 2026-04-17 | 📝 docs(reviewer): finalize HU-018 closure checklists
- 2026-04-17 | 📝 docs(admin): finalize HU-010 closure checklists and links
- 2026-04-17 | 📝 docs(spec): add HU-044..HU-049 specs and issue links
- 2026-04-15 | 📝 docs(agents): require conventional-commits skill before commits
- 2026-04-13 | 📝 docs(testing): document develop date override and weekly order test flow
- 2026-04-09 | 📝 docs(firestore): set seasonalCommitments qty field to fixedQty
- 2026-03-19 | 📝 docs(orders): define consumer name snapshots

### Maintenance

- 2026-08-29 | 📦 build(android): update Navigation and Coil
- 2026-08-26 | 📦 build(android): update AGP to 9.3.2
- 2026-08-20 | 📦 build(android): update Firebase tooling
- 2026-08-18 | 📦 build(android): upgrade Gradle to 9.7.0
- 2026-08-18 | 📦 build(android): refresh app dependencies
- 2026-08-05 | 💄 style(ios): normalize Swift declarations
- 2026-08-02 | 🔧 chore(ios): enforce Swift line width
- 2026-07-30 | 📦 build(android): update Navigation 3 to 1.1.5
- 2026-07-29 | 📦 build(android): configure release signing
- 2026-07-29 | 📦 build(android): modernize build settings
- 2026-07-29 | 🔧 chore(order): integrate Android updates
- 2026-07-29 | 🔧 chore(android): adopt modern platform APIs
- 2026-07-29 | 🔧 chore(push): separate legacy tokens from Android FIDs
- 2026-07-27 | 📦 build(ios): enable Swift 6 for test targets
- 2026-07-25 | 📦 build(android): update Gradle, AGP, and Kotlin
- 2026-07-25 | 📦 build(android): refresh Gradle wrapper
- 2026-07-10 | 📦 build(android): update Firebase BoM to 34.16.0
- 2026-07-07 | 📦 build(android): update Compose and Navigation
- 2026-06-30 | 📦 build(ios): update Firebase Swift package
- 2026-06-30 | 📦 build(android): update Android dependencies
- 2026-05-13 | 🔧 chore(project): add HU-054 setup updates
- 2026-05-03 | 📦 build(android): update Gradle and AGP
- 2026-04-19 | 📦 build(ios): bump Firebase SDK minimum to 12.11
- 2026-04-17 | 📦 build(mobile): add non-production debug app icons
- 2026-04-17 | 📦 build(mobile): update AGP and release QA signing
- 2026-04-16 | 🔧 chore(functions): remove HU-006 debug trigger
- 2026-04-15 | 📦 build(ios): add env schemes and SwiftLint phase
- 2026-03-16 | 🔧 chore(repo): checkpoint pending app updates
- 2026-03-13 | 🔧 chore(ios): sync localizable string catalog
- 2026-03-03 | 📦 build(android): update Gradle and Android deps
- 2026-02-15 | 🔧 chore(repo): align stack docs and iOS baseline

### Changed

- 2026-08-05 | 💄 style(ios): normalize Swift declaration layout
- 2026-08-02 | ♻️ refactor(ios): reduce existential erasure
- 2026-07-29 | ♻️ refactor(ios): clear SwiftLint warnings
- 2026-07-24 | ♻️ refactor(ios): split large feature files
- 2026-07-12 | ♻️ refactor(ios): clear SwiftLint warnings
- 2026-07-10 | ♻️ refactor(android): organize presentation packages
- 2026-07-10 | ♻️ refactor(mobile): clean platform warnings
- 2026-05-14 | ♻️ refactor(ios-orders): split previous order fetch
- 2026-05-14 | ♻️ refactor(ios-ui): split design components
- 2026-05-12 | ♻️ refactor(ios-ui): organize presentation layout
- 2026-05-12 | ♻️ refactor(ios-session): move session adjuncts to root
- 2026-05-12 | ♻️ refactor(ios-users): move users to root VM
- 2026-05-12 | ♻️ refactor(ios-profile): move profiles to root VM
- 2026-05-12 | ♻️ refactor(ios-news): move news workflows to root VM
- 2026-05-12 | ♻️ refactor(ios-shifts): move shifts to root VM
- 2026-05-12 | ♻️ refactor(ios-products): move products to root VM
- 2026-05-11 | ♻️ refactor(ios-orders): move orders to root-owned view models
- 2026-05-11 | ♻️ refactor(ios): split feature files for lint
- 2026-05-11 | ♻️ refactor(ios): inject root dependencies
- 2026-04-16 | ♻️ refactor(ios): clean lint and concurrency warnings
- 2026-04-15 | ♻️ refactor(ios): split order routes and tighten SwiftLint gate
- 2026-04-10 | ♻️ refactor(ios): organize Presentation/Access into feature folders
- 2026-04-08 | ♻️ refactor(android): split access routes and slim root files
- 2026-04-08 | ♻️ refactor(ios): split ContentView routes and action files
- 2026-04-08 | ♻️ refactor(l10n): remove hardcoded locale date formatting
