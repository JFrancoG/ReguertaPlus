# Tasks - HU-052 (iOS Liquid Glass screen header component)

GitHub tracking:

- #132 - iOS Liquid Glass screen header component.

## 1. Preparation
- [x] Create implementation branch.
- [x] Create GitHub issue.
- [x] Confirm HU number and spec path.

## 2. Documentation
- [x] Add `spec.md`.
- [x] Add `plan.md`.
- [x] Add `tasks.md`.

## 3. iOS implementation
- [x] Add `ReguertaHeaderText`.
- [x] Add `ReguertaHeaderBadge`.
- [x] Add `ReguertaHeaderAction`.
- [x] Add `ReguertaScreenHeaderView`.
- [x] Split component into `ReguertaScreenHeaderView.swift` and `ReguertaScreenHeaderViewModel.swift`.
- [x] Remove custom `init` declarations from SwiftUI views.
- [x] Add Liquid Glass icon action button with fallback.
- [x] Add previews for required variants.

## 4. Testing
- [x] Run `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' test`.
- [x] Confirm `iPhone 17` was available; no fallback simulator was needed.
- [ ] Manually inspect previews where possible.

## 5. Closure
- [x] Confirm no existing screens were migrated.
- [x] Review git diff.
- [x] Document Android parity gap as deferred.
