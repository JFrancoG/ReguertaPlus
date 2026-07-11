# Tasks - HU-068 (Order screen localization and header cleanup)

## 1. Preparation
- [x] Confirm a clean updated `main`.
- [x] Create `codex/hu-068-order-screen-localization`.
- [x] Create GitHub issue #181 with cross-platform order labels.
- [x] Create the issue mirror and story spec/plan/tasks.
- [x] Trace the iOS hardcoded copy and Android title composition.

## 2. iOS localization
- [x] Add My order localization keys to `AccessL10nKey`.
- [x] Add complete English/Spanish translations to `Localizable.xcstrings`.
- [x] Localize product-list headers, badges, actions, quantity controls, price/stock labels, and search.
- [x] Localize cart, confirmed-order, previous-order, and eco-basket states.
- [x] Localize validation, success, and failure dialogs.
- [x] Localize quantity-control accessibility labels.
- [x] Remove app-owned Spanish literals from the My order route and helpers.

## 3. Android header
- [x] Hide the normal editable My order shell title.
- [x] Preserve Product list, navigation, cart action, cart title, and read-only behavior.
- [x] Add focused regression coverage for title selection.

## 4. Validation and handoff
- [x] Parse the iOS String Catalog and run targeted localization tests.
- [x] Run Android unit tests and lint.
- [x] Run Android connected tests when an emulator/device is available.
- [x] Run iOS tests on an available iPhone simulator; document the separate UI-runner debugger blocker.
- [x] Run static hardcoded-copy and diff checks.
- [x] Record validation evidence and parity status in `spec.md`.
- [x] Link pull request #182.
