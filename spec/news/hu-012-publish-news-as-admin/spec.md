# HU-012 - Publish news as admin

## Metadata
- issue_id: #16
- priority: P2
- platform: both
- status: implemented

## Context and problem

This story enables a critical part of the Reguerta MVP workflow and must preserve Android/iOS functional parity when applicable.

## User story

As an admin I want to publish news so that I can inform the community.

## Scope

### In Scope
- Admin can create news with `title`, `body`, `active`, `publishedBy`, `publishedAt`, and optional `urlImage`.
- All authorized users can access a full news list from the drawer.
- Home shows the latest active news items ordered by `publishedAt` descending.
- Admin can open the create flow from the drawer and from the all-news screen.
- Admin can edit existing news and delete old news from the all-news screen.
- After creating or editing news, the flow returns to the all-news screen.

### Out of Scope
- Functionality marked as post-MVP in global requirements.
- Refactors not required to satisfy this story.
- Visual polish beyond the minimum shell/form/list needed to validate the workflow.

## Linked functional requirements

- RF-NOTI-01

## Acceptance criteria

- Admin can publish active news visible to authorized members in Android and iOS.
- Non-admin users can read the news list but cannot create, edit, or delete news.
- Home shows the latest 3 active news items ordered by `publishedAt` descending.
- The drawer exposes a full news list for all authorized users.
- Admin can create a news item from the dedicated admin entry point and from the all-news screen.
- Admin can edit or delete an older news item from the all-news screen.
- After saving a new or edited news item, the app routes back to the all-news screen and the newest item appears first when applicable.

## Dependencies

- Base references: docs-es/requirements/requisitos-mvp-reguerta-v1.md.
- Functional references: docs-es/requirements/historias-usuario-mvp-reguerta-v1.md.
- Data references: docs-es/requirements/firestore-estructura-mvp-propuesta-v1.md.
- Depends on authentication, role permissions, and MVP Firestore model.

## Risks

- Main risk: misalignment between business rules and data rules.
  - Mitigation: validate against linked RFs and acceptance tests.
- Secondary risk: regression in existing weekly workflows.
  - Mitigation: weekly-window regression tests by role.

## Definition of Done (DoD)

- [ ] Story acceptance criteria validated.
- [x] Implementation aligned with linked RFs.
- [x] Android/iOS parity reviewed or temporary gap documented.
- [x] Agreed tests executed.
- [x] Technical/functional documentation updated.
- [ ] Issue and PR linked.
