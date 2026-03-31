# Plan - HU-012 (Publish news as admin)

## 1. Technical approach

Implement a lightweight news slice in both apps:
- Firestore-backed repository under `plus-collections/news`
- Home summary card fed by the latest active news
- Full news list route for all authorized users
- Shared create/edit form for admins
- Basic delete flow for admins with confirmation in UI

## 2. Layer impact
- UI: Home latest-news card, news list route, news editor route, admin actions.
- Domain: News entity/repository contract plus admin-only write rules in presentation/domain flow.
- Data: Firestore collection path, mapper, list/save/delete operations.
- Backend: no Functions work expected for MVP iteration unless validation reveals a blocker.
- Docs: Spec/tasks plus Firestore field docs updated with optional `urlImage`.

## 3. Platform-specific changes
### Android
- Add `news` domain/data slice and wire it into `SessionViewModel`.
- Replace home placeholder news with real latest active news.
- Implement all-news and admin create/edit flows from the home shell.

### iOS
- Mirror Android behavior with the same Firestore contract and admin restrictions.
- Keep all-news and admin create/edit flow functionally aligned with Android.

### Functions/Backend
- No backend code planned unless Firestore contract validation reveals a missing dependency.

## 4. Test strategy
- Unit tests for news ordering / permissions-sensitive save flow where practical.
- Android and iOS regression builds/tests.
- Manual validation in develop for member vs admin behavior and create/edit/delete flow.

## 5. Rollout and functional validation
- Validate changes in develop environment.
- Run cross-story regression for related stories in the same domain.
- Confirm role-based behavior (member/producer/admin/reviewer when applicable).

## 6. Phased implementation sequence
### Phase 1 - Preparation
- Align Firestore/news contract and localization copy.
- Define route transitions: home -> news list -> editor -> news list.

### Phase 2 - Implementation
- Implement Android slice and UI wiring.
- Implement iOS slice and UI wiring.

### Phase 3 - Closure
- Execute tests and validate acceptance criteria.
- Update issue, completion checklist, and documentation.

## 7. Technical risks and mitigation
- Risk: platform behavior drift.
  - Mitigation: parity checklist per acceptance criterion.
- Risk: Firestore data inconsistencies.
  - Mitigation: domain validations plus security rules.
- Risk: `publishedAt` ordering drift if local timestamps differ.
  - Mitigation: store timestamps consistently and sort descending in repositories/UI.
