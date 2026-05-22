# HU-057 - News list and editor UX refinement

## Metadata
- issue_id: #148
- priority: P2
- platform: both
- status: implemented

## Context and problem

HU-012 delivered the base news workflow, but the full news screen and editor still feel visually different from the Home news summary and from newer admin list screens. This story refines that experience while preserving the existing Firestore contract.

## User story

As an authorized member I want the full News screen to show all available news with the same visual treatment as Home, and as an admin I want compact edit/delete controls plus a clearer create/edit form, so that news management feels consistent and fast.

## Scope

### In Scope
- Full News route uses the same news row presentation as Home, while Home remains limited to the latest 3 active items.
- Home latest news and full News items are shown inside accent-tinted list cards.
- Full News keeps the published-by metadata visible.
- Optional news images render visually instead of exposing their raw URL.
- Admin users see icon-only edit and delete actions on each news item.
- The create action appears at the bottom of the full News list.
- News editor is scrollable, unframed, ordered as title, body, image, archive toggle, save action.
- The archive toggle binds to the inverse of `NewsArticle.active`.
- Successful create/update shows a Reguerta info dialog before returning to the full News list.
- After dismissing the dialog, the created/updated item is highlighted and scrolled into view.
- English and Spanish copy is updated for create/edit/archive/save labels.

### Out of Scope
- Firestore schema changes.
- Notification delivery changes.
- Replacing delete with soft delete.

## Linked functional requirements

- RF-NOTI-01

## Acceptance criteria

- Tapping News/Noticias in the side menu opens a scrollable full news list using the Home-style news layout.
- Home still shows only the latest 3 active news items, each in an accent-tinted card.
- Full News list items use the same accent-tinted card treatment.
- The full list keeps Published by / Publicada por metadata visible.
- Admin users see icon-only edit and delete actions on each news item.
- Non-admin users do not see create, edit, delete, or archived news.
- The add action appears at the bottom of the full News screen and opens the create editor.
- Create editor title is New news / Nueva noticia; edit editor title is Edit news / Editar noticia.
- Editor has no surrounding card/border, scrolls when needed, and shows title/body before image.
- Archive toggle stores `active = false` when enabled.
- Save button says Create news / Crear noticia when creating and Update / Actualizar when editing.
- Saving shows a Reguerta info dialog titled News created / Noticia creada or News updated / Noticia modificada.
- Dismissing the dialog returns to the full News list and highlights the created or edited item in place.

## Dependencies

- Builds on HU-012 news repository, Firestore mapping, permissions, and routes.
- Depends on the existing Android/iOS admin permission checks for publishing news.

## Risks

- Risk: create/edit route resets an edit draft when navigation preparation runs.
  - Mitigation: keep create preparation explicit and preserve edit navigation state.
- Risk: archive copy conflicts with the existing `active` field.
  - Mitigation: keep the data contract unchanged and invert only the UI toggle.

## Definition of Done (DoD)

- [x] Acceptance criteria validated
- [x] Agreed test coverage executed
- [x] Android/iOS impact reviewed
- [x] Documentation updated
