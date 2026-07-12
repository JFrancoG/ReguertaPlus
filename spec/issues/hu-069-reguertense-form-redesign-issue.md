# Issue #188 - [HU-069] Rediseñar los formularios de añadir y editar regüertenses

## Summary

Redesign the Android and iOS member administration forms so adding and editing a regüertense follows the current Reguerta form language instead of the legacy card-based layout.

## Acceptance criteria

- Remove the outer card around the complete form.
- Place `Añadir regüertense` or `Actualizar regüertense` immediately below the screen back control, according to the active mode.
- Render email, display name, phone number, and company name with the shared Reguerta input component.
- Keep the existing email visible but read-only while editing.
- Show company name only when Producer is selected.
- Selecting Common purchases manager also selects Producer, sets company name to `Compras Regüerta`, and makes the company field read-only.
- Clearing Common purchases manager leaves Producer selected and makes company name editable again.
- Clearing Producer also clears Common purchases manager and company name, preserving a valid role combination.
- Keep role controls aligned with comparable Reguerta screens.
- Place the Add/Update primary action at the bottom of the form and remove the second bottom Back action.
- Preserve Android/iOS behavior parity and existing persistence contracts.

## Scope

- Android and iOS member administration presentation, localization, and targeted tests.
- No Firestore schema, Cloud Functions, or member-domain contract changes.

## Implementation checklist

- [x] Create branch, issue, and planning artifacts.
- [x] Implement and test Android.
- [x] Implement and test iOS.
- [x] Run relevant validation from `AGENTS.md`; record the known iOS UI-runner environment blocker separately.
- [x] Record evidence and parity status.

## Links

- GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/188
- Pull request: https://github.com/JFrancoG/ReguertaPlus/pull/189
- Branch: `codex/hu-069-reguertense-form-redesign`
- Story docs: `spec/profiles/hu-069-reguertense-form-redesign/`
