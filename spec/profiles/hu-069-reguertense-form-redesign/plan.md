# Plan - HU-069 (Regüertense add and edit form redesign)

## Goal

Replace the legacy member editor presentation with the shared Reguerta form language and enforce the role-dependent company behavior consistently on Android and iOS.

## Workstreams

1. Contract and component discovery
- Trace member draft ownership, save validation, localization, and existing tests on both platforms.
- Confirm the shared input, primary button, switch/checkbox, and screen-header patterns used by recent form screens.
- Identify a small testable boundary for role/company transitions.

2. Android form redesign
- Remove the outer card and redundant lower Back action.
- Move the mode title to the top of the form and replace text entries with `ReguertaInputField`.
- Implement deterministic Producer/Common purchases manager/company transitions.
- Add unit and UI semantics coverage where useful.

3. iOS form redesign
- Mirror the hierarchy with the shared `reguertaInputField` and button primitives.
- Preserve view-model-owned draft state and keyboard/scroll behavior.
- Implement the same deterministic role/company transitions and tests.

4. Localization, validation, and parity
- Add or update English and Spanish form wording without embedded user-facing copy.
- Run the relevant Android and iOS validation from `AGENTS.md`.
- Record evidence, known environment blockers, and any temporary parity gap.

## Delivery phases

1. Bootstrap and behavioral contract.
2. Android implementation and targeted tests.
3. iOS implementation and targeted tests.
4. Full relevant validation and handoff.

If either platform becomes temporarily blocked, finish and validate the other platform and document the gap as required by `AGENTS.md`.
