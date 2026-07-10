# Plan - HU-065 (Android screen header spacing)

## Goal

Create a consistent 8 dp visual gap below every shared Android screen title.

## Workstreams

1. Shared component
- Apply bottom-only padding in `ReguertaScreenTitle`.
- Preserve existing typography and semantics.

2. Regression coverage
- Render the shared back header followed immediately by content.
- Verify the measured title-to-content gap is at least 8 dp.
- Keep Dashboard geometry coverage unchanged.

3. Validation and delivery
- Run Android unit tests, lint, and connected UI tests.
- Review the diff for route-specific or unrelated changes.
- Commit, push, and open a draft pull request linked to issue #169.
