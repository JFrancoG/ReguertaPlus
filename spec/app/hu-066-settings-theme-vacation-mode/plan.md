# Plan - HU-066 (Settings appearance and producer unavailable mode)

## Goal

Turn Settings into a scope-ordered screen and deliver complete, persistent appearance and producer Unavailable mode behavior on Android and iOS.

## Workstreams

1. Contract and architecture discovery
- Trace Settings composition, app-root theme ownership, local preference facilities, member persistence, and ordering filters on both platforms.
- Confirm the existing `producerCatalogEnabled` field safely represents the inverse of Unavailable mode.
- Identify duplicated catalog-visibility UI and the refresh path after a producer update.

2. General appearance
- Add a platform-local enum/value contract for System, Light, and Dark.
- Add persistent preference storage with System as the backwards-compatible default.
- Bind the stored preference at each app root so changes update all screens immediately and survive relaunch.
- Add the General section selector and targeted preference/theme tests.

3. Producer Unavailable mode
- Expose a producer-only switch/checkbox in the Producer section.
- Save the inverse value through the existing member repository contract and keep authenticated/current member state synchronized.
- Remove or replace the old catalog-visibility presentation to keep one clear product concept.
- Validate all ordering filters and committed-producer selection while keeping own catalog management available.

4. Settings information architecture
- Remove the outer wrapping card.
- Render sections in General, Producer, Administrator, Develop order.
- Keep role/build scope checks explicit and preserve all existing admin/develop actions.
- Add UI/logic coverage for section presence and order.

5. Validation and delivery readiness
- Run Android unit/lint/connected checks and iOS tests from `AGENTS.md`.
- Manually verify appearance persistence and cross-session Unavailable mode effects where local environments allow.
- Update story evidence, parity status, and issue links.

## Delivery phases

The story stays atomic, but implementation proceeds in reviewable phases:

1. Bootstrap and contracts.
2. Android appearance/settings/vacation implementation.
3. iOS appearance/settings/vacation implementation.
4. Cross-platform regression tests and validation.

If a platform becomes blocked, complete and validate the other platform and record the temporary parity gap as required by `AGENTS.md`.
