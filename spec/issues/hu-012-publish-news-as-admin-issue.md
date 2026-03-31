# [HU-012] Publish news as admin

## Summary

As an admin I want to publish news so that I can inform the community.

## Links
- Spec: spec/news/hu-012-publish-news-as-admin/spec.md
- Plan: spec/news/hu-012-publish-news-as-admin/plan.md
- Tasks: spec/news/hu-012-publish-news-as-admin/tasks.md

## Acceptance criteria

- Admin can publish active news visible to members.
- Non-admin users can read the news list but cannot create, edit, or delete news.
- Home shows the latest 3 active news items in descending publication order.
- All authorized users can open the full news list from the drawer.
- Admin can create news from the dedicated admin entry point and from the all-news screen.
- Admin can edit and delete old news from the all-news screen.
- After saving a new or edited item, the app returns to the all-news screen.

## Scope
### In Scope
- Implement story HU-012 within MVP scope.
- Satisfy linked RFs: RF-NOTI-01.
- Use `title`, `body`, `active`, `publishedBy`, `publishedAt`, and optional `urlImage`.

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
- area:news
- platform:cross
- priority:P2
