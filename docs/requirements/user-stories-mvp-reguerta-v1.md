# MVP User Stories Reguerta (v1)

Date: 2026-03-06

## 1. Consumer member

### HU-001 Create order in active window

As a consumer member I want to create my order during the weekly window so that I receive my products at delivery.

Acceptance criteria:
- During active window, `My order` shows available products grouped by producer.
- Common purchases and committed eco-basket producer are prioritized.
- Product search and producer filtering are available.

### HU-002 Validate commitments on confirmation

As a member with commitments I want mandatory validation before confirming so that I avoid invalid orders.

Acceptance criteria:
- If mandatory items are missing, confirmation is blocked and warning is shown.
- If commitments are satisfied, order becomes `confirmado`.
- Eco-basket commitment is satisfied by either `pickup` or `no_pickup` option, and both remain paid order lines.
- Eco-basket price is the same for `pickup` and `no_pickup`, and does not change by even/odd eco-basket producer.

### HU-003 Resume unconfirmed cart

As a member I want to resume an incomplete cart so that I don't lose selected items.

Acceptance criteria:
- Exiting without confirmation keeps selected lines and quantities for the next entry.

### HU-004 Edit confirmed order within deadline

As a member I want to update a confirmed order before cutoff so that I can adjust needs.

Acceptance criteria:
- With open deadline, user can increase/decrease quantities, remove lines, and add lines.
- If edits violate commitments, confirmation is blocked.

### HU-005 View previous-week order

As a member I want to view the previous-week order outside active window for totals/subtotals reference.

Acceptance criteria:
- Between Monday and delivery day, `My order` shows previous-week order grouped by producer.

### HU-006 Receive pending-order reminders

As a committed member I want reminders when order is not confirmed so that I avoid forgetting.

Acceptance criteria:
- If order is `sin_hacer` or `en_carrito`, push reminders are sent at Sunday 20:00, 22:00, 23:00.
- If order is confirmed, no reminder is sent.

## 2. Producer/common-purchase manager

### HU-007 Manage own catalog

As a producer I want to create/edit/archive products so that my offer stays current.

Acceptance criteria:
- Producer can create/edit/archive own products.
- `vendorId` cannot be changed after product creation.
- Stock can be set by direct input and extended/infinite mode.
- Product edition supports `unitAbbreviation` and `packContainerAbbreviation`.
- Eco-basket products remain a single catalog product; `pickup` or `no_pickup` is chosen later on the order line.
- Eco-basket product pricing is constrained to the shared eco-basket price used by both parity producers and both pickup options.

### HU-008 View received orders

As a producer I want to view received orders by product and by member so that I can prepare delivery.

Acceptance criteria:
- In enabled period, `Received orders` shows tabs by product and by member.
- Outside enabled period, access appears disabled.

### HU-009 Update producer order status

As a producer I want to update order preparation status so that members can track progress.

Acceptance criteria:
- Allowed statuses are `unread`, `read`, `prepared`, `delivered` at full-order level.
- New/untouched producer orders start at `unread`.

## 3. Admin

### HU-010 Manage members and roles

As an admin I want to manage member lifecycle, onboarding authorization, and privileges so that access remains controlled.

Acceptance criteria:
- Admin sees create/edit/deactivate actions for members.
- Grant/revoke admin is blocked if it leaves zero active admins.
- If a member is pre-authorized by admin, first login/register enters home with full role-based access.

### HU-011 Manage delivery calendar

As an admin I want to move future delivery dates to adapt to holidays/weather alerts.

Acceptance criteria:
- Only admin can edit future delivery planning horizon.
- Day shifts recalculate blocked/open windows correctly.
- Calendar overrides are stored as `deliveryCalendar/{weekKey}` (doc ID equals `weekKey`).
- Weeks without a `deliveryCalendar/{weekKey}` document use default delivery day from `config/global.deliveryDayOfWeek`.
- Removing an override reverts that week to default schedule resolution.

### HU-012 Publish news

As an admin I want to publish news so that I can inform members.

Acceptance criteria:
- Admin can publish visible news.
- Non-admin publishing is denied.

### HU-013 Send admin notifications

As an admin I want to send notifications through enabled delivery modes.

Acceptance criteria:
- Admin can send notifications using enabled MVP segments/modes.
- Delivery targets are resolved from registered user devices (`users/{userId}/devices`).
- `users.lastDeviceId` points to the latest active device used by each member.

## 4. Member shared profile

### HU-014 Share profile information

As a member I want to share family profile information so that we know each other better.

Acceptance criteria:
- Member can create/edit/delete own shared profile.
- Other members see photo, family names, and free text.

## 5. Shifts

### HU-015 View global shifts and next assignments

As a member I want to view all shifts and my next assignments so that I can plan.

Acceptance criteria:
- A global shift view is available.
- Next delivery and market assignments are clearly visible.

### HU-016 Request shift swap

As a member I want to request a shift swap when unavailable.

Acceptance criteria:
- Request enters pending state for target member.
- Accept + requester final confirm applies the swap.
- Applied swap triggers notification to all members.

### HU-017 Plan with active members only

As admin/system I want shift planning with active members only.

Acceptance criteria:
- Members with `isActive = false` are excluded from planning.
- New/reactivated members are appended to rotation end.
- Market shifts enforce minimum 3 assigned members.

## 6. Reviewer (Apple/TestFlight)

### HU-018 Test production app safely

As reviewer I want full functional access without touching real production data.

Acceptance criteria:
- Allowlisted reviewer logs in production app but uses develop backend.
- Reviewer writes do not affect production dataset.

## 7. AI and documents

### HU-019 Hybrid bylaws consultation

As a member I want fast bylaws answers.

Acceptance criteria:
- Typical questions are resolved locally.
- Complex questions can escalate to cloud mode.

### HU-020 Shift management with shared source

As member/admin I want shift read/write through a shared source (Google Sheets).

Acceptance criteria:
- App reads current shifts from source.
- Confirmed swap/change syncs source and sends notification.

## 8. App startup and catalog operations

### HU-021 Startup remote version gate

As a member I want the app to validate minimum/current app version at startup so that unsupported versions are blocked or warned.

Acceptance criteria:
- Forced update blocks usage until update.
- Optional update lets user continue.

### HU-022 Critical-data freshness before order

As a member I want `My order` to open only when critical data is fresh so that I avoid placing orders with stale catalog/rules.

Acceptance criteria:
- `My order` stays disabled while critical sync is pending.
- Timeout/retry path is available when sync gets stuck.

### HU-023 Session lifecycle refresh and expiry UX

As a member I want session refresh on app lifecycle events so that access remains stable and expiration is explicit.

Acceptance criteria:
- Session/token refresh runs on startup and foreground.
- Expired session shows explicit message and safe recovery path.

### HU-027 Unauthorized authenticated user home gating

As an authenticated but not yet authorized person I want clear restricted-access feedback in home so that I understand why I cannot use the app and what must happen next.

Acceptance criteria:
- If a user authenticates in Firebase but no active authorized `users` record exists for that email, home shows an explicit unauthorized state.
- In unauthorized state, operational modules stay disabled and protected flows remain blocked.
- Unauthorized state exposes a safe sign-out path distinct from expired-session recovery.
- If the user becomes authorized later, the next session resolution restores normal home access.

### HU-028 Role-aware home shell and drawer navigation

As a member, producer, or admin I want a clearer home shell with role-aware navigation so that I can understand my available areas and key weekly context from a single entry point.

Acceptance criteria:
- Home shows a top-level shell prepared for menu access and notifications.
- Drawer exposes common sections to everyone and additional sections only when user role allows them.
- Drawer can be opened and closed through the menu trigger, and gesture support is reviewed per platform.
- Home reserves visible space for weekly context and latest news, even if backed initially by placeholders.
- App version remains visible in the drawer footer.

### HU-024 Producer bulk availability toggle

As a producer I want to toggle my catalog visibility in one action so that weekly pauses (vacation/sickness) are fast without losing per-product setup.

Acceptance criteria:
- Producer can enable or disable own catalog visibility with confirmation.
- When producer catalog visibility is disabled, neither producer `companyName` nor producer products appear in ordering lists.
- Re-enabling producer catalog visibility does not overwrite existing per-product `isAvailable` values.

### HU-025 Product image handling pipeline

As a producer I want product image pick/crop/upload integrated in product form so that listings stay visually complete.

Acceptance criteria:
- Image can be selected and uploaded to Storage.
- Product keeps a valid image URL after save.

## 9. Post-MVP catalog backlog

### HU-026 Sell bulk products by weight unit

As a producer I want to define bulk products with a single weight-mode price and as a member I want to enter the weight quantity directly so ordering is simpler and avoids duplicate product entries.

Acceptance criteria:
- Producer can create/edit a product in `weight` pricing mode with a single `price`.
- Member can enter decimal weight quantity for `weight` products in cart/order edit.
- Subtotal is calculated in real time as `quantity * price`.
- Orderline keeps snapshot fields needed for audit (`pricingModeAtOrder`, `priceAtOrder`, `quantity` in product weight unit).
