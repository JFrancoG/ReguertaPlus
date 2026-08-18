# [HU-072] Preserve Android state across activity recreation

## Summary

Retain the Android session, root route, and startup completion when
`MainActivity` is recreated for orientation or another configuration change.

## Links

- GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/241
- Spec: `spec/app/hu-072-android-activity-state-restoration/spec.md`
- Plan: `spec/app/hu-072-android-activity-state-restoration/plan.md`
- Tasks: `spec/app/hu-072-android-activity-state-restoration/tasks.md`

## Acceptance criteria

- Activity recreation does not repeat splash or startup-gate work.
- The `SessionViewModel`, root route, and Home destination survive recreation.
- Cold launch retains its existing startup behavior.
- ViewModel-owned resources are released at the ViewModel lifecycle boundary.
- Relevant Android unit, lint, and connected tests pass.

## Scope

### In scope

- Android lifecycle-aware ViewModel ownership.
- Root navigation/startup restoration.
- Deterministic recreation tests.
- Validation and evidence.

### Out of scope

- Orientation locking.
- Adaptive layout redesign.
- Whole-app Navigation 3 migration.
- iOS or backend changes.

## Implementation checklist

- [x] Android
- [x] iOS impact reviewed; no code change required
- [x] Backend/Firestore not affected
- [x] Testing
- [x] Documentation

## Labels

- `bug`
- `area:app`
- `platform:android`
- `priority:P1`
