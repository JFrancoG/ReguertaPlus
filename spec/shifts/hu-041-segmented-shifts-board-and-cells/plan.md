# Plan - HU-041 (Segmented shifts board and cells)

## Goal

Upgrade the generic `Turnos` screen into a role-neutral board with delivery/market tabs and domain-specific cell layouts that make weekly and monthly shifts easy to scan.

## Workstreams

1. UX contract
- Finalize the information hierarchy for delivery and market cells.
- Define the segmented control/tab behavior across platforms.

2. Android
- Replace the current list with segmented state and dedicated cell composables.
- Preserve scroll behavior and current refresh entry points.

3. iOS
- Mirror the segmented board in SwiftUI with equivalent cells and scroll behavior.
- Reuse the existing `HU-015` shifts state without changing the data contract.

4. Validation
- Verify delivery and market data presentation with real synchronized shifts.
- Check compact devices and long-name overflow handling.
