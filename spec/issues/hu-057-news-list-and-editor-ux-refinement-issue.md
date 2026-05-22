# [HU-057] Refine news list and editor UX

## Summary

As an authorized member I want the full News screen to show all available news with the same visual treatment as Home, and as an admin I want compact edit/delete controls plus a clearer create/edit form, so that news management feels consistent and fast.

## Links
- GitHub issue: #148
- Spec: spec/news/hu-057-news-list-and-editor-ux-refinement/spec.md
- Plan: spec/news/hu-057-news-list-and-editor-ux-refinement/plan.md
- Tasks: spec/news/hu-057-news-list-and-editor-ux-refinement/tasks.md

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

## Scope
### In Scope
- Android and iOS parity for the News list and editor UX refinement.
- Localization updates in English and Spanish.
- Spec, plan, tasks, and issue traceability artifacts.

### Out of Scope
- Firestore schema changes.
- Notification delivery changes.
- Replacing hard delete with soft delete.

## Implementation checklist
- [x] Android
- [x] iOS
- [x] Backend/Firestore (not required)
- [x] Testing
- [x] Documentation

## Suggested labels
- type:feature
- area:news
- platform:cross
- priority:P2
