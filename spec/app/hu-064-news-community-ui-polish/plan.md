# Plan - HU-064 (News and community UI polish)

## Goal

Clarify Android header hierarchy on News and Community and restore optional news-image rendering on iOS without changing backend contracts.

## Workstreams

1. Header discovery
- Trace how Android Home destinations derive top-bar titles and navigation actions.
- Compare the requested News/Community placement with routes that already render their title below the back arrow.

2. Android UI
- Add a narrowly scoped below-navigation title mode to the shared Home shell header.
- Enable it only for the top-level News and Community destinations.
- Preserve nested Community title overrides and existing back behavior.

3. iOS image diagnosis and repair
- Trace persisted `urlImage` values from Firestore mapping and the upload pipeline into News presentation.
- Identify why the current SwiftUI image loader does not render the stored reference.
- Implement the smallest compatible correction and add focused regression coverage.

4. Validation
- Run Android unit tests and lint, plus connected UI tests when a device/emulator is available.
- Run iOS tests on the configured simulator or the closest available equivalent.
- Review the final diff for unrelated route/header changes and record parity notes.
