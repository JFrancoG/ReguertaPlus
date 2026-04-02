# [HU-020] Shifts backed by Google Sheets

## Summary

As a member/admin I want shifts to be read and updated from a shared source so that everyone sees consistent data.

## Links
- Spec: spec/ai/hu-020-shifts-backed-by-google-sheets/spec.md
- Plan: spec/ai/hu-020-shifts-backed-by-google-sheets/plan.md
- Tasks: spec/ai/hu-020-shifts-backed-by-google-sheets/tasks.md

## Acceptance criteria

- App reads current shifts from Google Sheets.
- Confirmed changes sync source and notify all members.
- Manual edits made directly in Google Sheets are ingested back into app-visible shifts.
- Confirmed app-side changes write back to Google Sheets with defined reconciliation rules.

## Scope
### In Scope
- Implement story HU-020 within MVP scope.
- Satisfy linked RFs: RF-IA-02, RF-IA-03.

### Out of Scope
- Post-MVP functionality.
- Refactors not required to close acceptance criteria.

## Implementation checklist
- [x] Android
- [x] iOS
- [x] Backend / Firestore
- [x] Testing
- [x] Documentation

## Suggested labels
- type:feature
- area:ai
- platform:cross
- priority:P2
