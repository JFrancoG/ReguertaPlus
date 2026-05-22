# Plan - HU-057 (News list and editor UX refinement)

## 1. Technical approach

Refine the existing HU-012 news slice without changing the `NewsArticle` contract:
- Share the Home news row presentation with the full News list.
- Keep Home constrained to `latestNews` and the full list backed by `newsFeed`.
- Wrap both Home latest news and full News rows in the existing accent list-card treatment.
- Render optional images with platform image components.
- Use existing list action icon buttons for admin edit/delete.
- Treat the editor archive toggle as `checked == !draft.active`.
- Replace successful create/update global feedback with a Reguerta info dialog, then navigate back and highlight the saved item.

## 2. Platform changes

### Android
- Reuse a shared Compose news summary row from Home and the full News route.
- Use `ReguertaListItemCard` for Home latest news and full News items.
- Give the full News route its own scroll surface and bottom floating create action.
- Remove the editor card wrapper, reorder fields, and place image controls beside the preview.
- Keep edit navigation from resetting the draft back to create mode.
- Return a save result from the news action so the route can show the success dialog and scroll-highlight the saved news card.

### iOS
- Reuse the Home latest-news row for the full News route, adding metadata and archived state.
- Use `reguertaListItemCard` for Home latest news and full News items.
- Add a bottom floating create action for admins.
- Remove the editor card wrapper, reorder fields, and place image controls beside the preview.
- Keep the route title dynamic between New news and Edit news.
- Store pending save confirmation in the news view model and highlight the saved item after closing the dialog.

## 3. Test strategy

- Extend iOS presentation/view-model coverage for full-list metadata, archived state, image placement, and existing active filtering.
- Run Android unit tests and lint for the touched module.
- Run iOS scheme tests on an available simulator.
- Manually verify admin/non-admin visibility, Home latest-3 behavior, full list scroll, image rendering, edit/delete, and create/update return flow.

## 4. Rollout notes

- No backend rollout or migration is required.
- Existing Firestore documents remain compatible because `active` is unchanged.
