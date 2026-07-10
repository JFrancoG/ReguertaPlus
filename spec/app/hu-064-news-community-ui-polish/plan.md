# Plan - HU-064 (News and community UI polish)

## Goal

Clarify Android header hierarchy on News and Community and restore optional news-image rendering on iOS without changing backend contracts.

## Workstreams

1. Header discovery
- Trace how Android Home destinations derive top-bar titles and navigation actions.
- Compare the requested News/Community placement with routes that already render their title below the back arrow.

2. Android UI
- Introduce a reusable screen header that owns back navigation, trailing actions, title placement, typography, and heading semantics.
- Use it for every Home destination with back navigation while preserving the compact Dashboard header.
- Reuse its title primitive for dynamic route-owned titles and remove duplicate static titles where the shell now owns them.
- Preserve nested Community title overrides and existing back behavior.

3. iOS image diagnosis and repair
- Trace persisted `urlImage` values from Firestore mapping and the upload pipeline into News presentation.
- Identify why the current SwiftUI image loader does not render the stored reference.
- Implement the smallest compatible correction and add focused regression coverage.

4. Validation
- Run Android unit tests and lint, plus connected UI tests when a device/emulator is available.
- Run iOS tests on the configured simulator or the closest available equivalent.
- Review all Home destination title ownership and record parity notes.
