# Tasks - HU-012 (Publish news as admin)

## 1. Preparation
- [x] Review linked RFs and acceptance criteria for this story.
- [x] Align `news/{newsId}` contract with optional `urlImage`.
- [x] Define route transitions and admin/member expectations.

## 2. Android implementation
- [x] Add news repository/model and Firestore path.
- [x] Load latest active news into home.
- [x] Implement all-news list and admin create/edit/delete flow.
- [x] Validate loading, error, and success states.

## 3. iOS implementation
- [x] Add news repository/model and Firestore path.
- [x] Load latest active news into home.
- [x] Implement all-news list and admin create/edit/delete flow.
- [x] Validate loading, error, and success states.

## 4. Backend / Firestore
- [x] Update Firestore docs with the final field contract for `news`.
- [x] Verify compatibility with `develop/plus-collections/news` and `production/plus-collections/news`.

## 5. Testing
- [x] Execute unit tests for impacted areas.
- [ ] Perform full manual acceptance validation.

## 6. Documentation
- [x] Update technical notes in the linked issue.
- [x] Record implementation decisions made during development.
- [x] Document Android/iOS parity status or temporary gap.

## 7. Closure
- [ ] Create/update linked issue and connect PR.
- [ ] Complete DoD checklist in spec.md.
- [ ] Attach test evidence and functional validation output.
