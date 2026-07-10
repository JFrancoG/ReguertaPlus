# Tasks - HU-064 (News and community UI polish)

## 1. Preparation
- [x] Create `codex/hu-064-news-community-ui-polish` branch from updated `main`.
- [x] Create GitHub issue #167 and link it from the story artifacts.
- [x] Create issue mirror and story docs.
- [x] Review current Android headers and iOS News image path.

## 2. Android UI
- [x] Put the News title below the back arrow.
- [x] Put the Community title below the back arrow.
- [x] Preserve back semantics, route actions, and unrelated header layouts.
- [x] Add or update targeted UI/unit coverage where the current test structure supports it.

## 3. iOS News image
- [x] Identify the failing URL/image-loading contract.
- [x] Restore image rendering in Home latest news and the full News list.
- [x] Preserve graceful behavior for missing or invalid image references.
- [x] Add focused regression coverage.

## 4. Validation
- [x] Run Android unit tests and lint.
- [x] Run Android connected UI tests on Pixel 8 Pro API 35.
- [x] Run iOS tests on iPhone 17 and record the pre-existing drawer-navigation UI failure.
- [x] Record validation and parity evidence in `spec.md`.

## 5. Closure
- [x] Update story status and Definition of Done.
- [x] Link draft pull request #168 and keep issue #167 open until merge.
