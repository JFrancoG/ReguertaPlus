# MVP Requirements Reguerta (v1)

Date: 2026-03-06
Source: Consolidated from the functional draft and Q1-Q35 clarifications.

## 1. MVP Scope

Included in MVP:
- Weekly ordering flow (consumer member).
- Product and received-order management (producer/common-purchase manager).
- Commitment validation.
- Inactive-member support through `isActive` (to avoid false forgotten-order detection).
- Controlled onboarding based on admin-authorized member list.
- Startup safeguards: remote version gate, session refresh, and critical-data freshness checks.
- Basic shift management (delivery/market) and swap requests.
- Shared member profile.
- Admin-only news publishing.
- Push reminders for pending commitments.
- Per-user device registry for push delivery and last active device tracking.
- Production reviewer account routed to develop backend.

Out of MVP (later phase):
- Full in-app cashbox/incidents ledger.
- Bulk selling by weight unit (price + user-entered decimal weight quantity), tracked as HU-026.
- Dedicated communication/editor sub-role.
- Advanced technical chatbot auditing.

## 2. Calendar Rules

- Official delivery day: Wednesday.
- Allowed exceptions: Tuesday, Thursday, or Friday (holidays/weather alerts).
- Only admins can update future delivery dates (8-10 weeks; extendable to 15-20).
- Day after delivery: ordering is blocked.
- Order window: from day+2 00:00 after delivery until Sunday 23:59.
- Single business timezone: Europe/Madrid.
- `deliveryCalendar` uses `weekKey` as document ID (non auto-generated).
- `deliveryCalendar` stores exception weeks only; default weeks are resolved from `config/global.deliveryDayOfWeek`.

### 2.1 Calendar Configuration

- RF-CAL-01 Only admin can manage future delivery dates.
- RF-CAL-02 Delivery-day changes must recalculate blocked/open order windows.
- RF-CAL-03 `deliveryCalendar/{weekKey}` must use `weekKey` as document ID.
- RF-CAL-04 `deliveryCalendar` must persist only exception weeks; missing week document means fallback to default schedule.
- RF-CAL-05 `config/global.deliveryDayOfWeek` remains mandatory as default fallback source.

## 3. Functional Requirements

### 3.1 Roles and access

- RF-ROL-01 Support roles: member, producer/common-purchase manager, admin.
- RF-ROL-02 A producer member keeps consumer capabilities.
- RF-ROL-03 Only admin can access member CRUD.
- RF-ROL-04 Only admin can grant/revoke admin role.
- RF-ROL-05 System must never allow zero active admins.
- RF-ROL-06 Admin must pre-register a member in `users` with authorized email before first operational access.
- RF-ROL-07 If authenticated email is not in the authorized member list, app shows `Unauthorized user` alert and keeps all operational modules disabled until admin authorization exists.
- RF-ROL-08 If authenticated email is authorized, first login/register links auth identity to that member record and routes user to home.

### 3.2 Member state and commitments

- RF-COM-01 Active members with commitment must buy exactly 1 eco-basket as minimum baseline (fixed business rule, not configurable in MVP).
- RF-COM-02 Legacy biweekly parity commitment must be supported (even/odd fixed producer).
- RF-COM-03 Seasonal commitments must be supported per member+product+season (fixed qty).
- RF-COM-04 Member leave is represented in MVP by setting `isActive = false` (no mandatory reason).
- RF-COM-05 Members with `isActive = false` are excluded from forgotten-order logic and automations.
- RF-COM-06 Eco-basket commitment can be fulfilled by either `pickup` or `no_pickup` eco-basket option; both count as paid commitment.
- RF-COM-07 Previous yearly eco-basket resignation allowance is removed; no waiver mode exists in MVP.
- RF-COM-08 Eco-basket price must be identical for both options (`pickup` and `no_pickup`) and for both parity producers (even/odd).

### 3.3 Consumer order flow

- RF-ORD-01 During consultation phase (Mon to delivery day), show previous-week order.
- RF-ORD-02 On blocked day (day after delivery), block create/edit and show notice.
- RF-ORD-03 During active window, allow create/edit order.
- RF-ORD-04 Product list grouped by producer and prioritized: common purchases + committed eco-basket producer.
- RF-ORD-05 Provide search and producer filter.
- RF-ORD-06 Block confirmation if mandatory commitments are missing.
- RF-ORD-07 Persist cart state when user exits without confirming.
- RF-ORD-08 Allow full edit of confirmed order within deadline:
  - increase/decrease quantities,
  - remove lines,
  - add lines.
- RF-ORD-09 Consumer statuses: `sin_hacer`, `en_carrito`, `confirmado`.

### 3.4 Producer flow

- RF-PROD-01 Producer sees `Received orders` entry point.
- RF-PROD-02 `Received orders` enabled from Monday to delivery day (inclusive), disabled otherwise.
- RF-PROD-03 Show tabs by product and by member (with subtotals/totals).
- RF-PROD-04 Producer statuses apply at full-order level: `unread`, `read`, `prepared`, `delivered` (initial state `unread`).

### 3.5 Product catalog

- RF-CAT-01 Producer/common-purchase manager can create, edit, archive products.
- RF-CAT-02 Physical delete is not allowed in MVP.
- RF-CAT-03 `vendorId` is immutable after creation.
- RF-CAT-04 Product availability and stock controls are required.
- RF-CAT-05 Stock supports direct edit and extended/infinite mode.
- RF-CAT-06 `companyName` must be visible in product search results.
- RF-CAT-07 Producer can toggle own full catalog availability in a single confirmed action.
- RF-CAT-08 Product form supports image select/crop/upload and persisted Storage URL.
- RF-CAT-09 (Post-MVP) System must support weighted products with `pricingMode = weight`, single `price`, and member-entered decimal weight quantity.
- RF-CAT-10 Product model must include `unitAbbreviation` and `packContainerAbbreviation` for compact UI use.
- RF-CAT-11 Eco-basket products must declare `ecoBasketOption` (`pickup` or `no_pickup`) to avoid string-based logic.
- RF-CAT-12 Eco-basket product price cannot diverge by option or parity producer.

### 3.6 Shared profile and member list

- RF-PERF-01 Member list is visible to authenticated members.
- RF-PERF-02 Public profile includes photo, family names, and shared free text.
- RF-PERF-03 A member can only create/edit/delete their own shared profile.
- RF-PERF-04 Admin has member CRUD view in the same area.

### 3.7 Shifts

- RF-TURN-01 Provide global shifts screen (delivery + market).
- RF-TURN-02 Show each member's next delivery and market shifts in a visible area.
- RF-TURN-03 Shift planning uses only active members.
- RF-TURN-04 New/reactivated members are appended at rotation end.
- RF-TURN-05 Provide swap request/accept/final confirm flow.
- RF-TURN-06 Notify all members when a swap becomes effective.
- RF-TURN-07 Market shift must have at least 3 assigned members; fallback from next in rotation.

Governance note: final policy for post-publication absence replacement remains an assembly decision.

### 3.8 News and communications

- RF-NOTI-01 Only admin can publish news in MVP.
- RF-NOTI-02 Push notifications are mandatory.
- RF-NOTI-03 Automatic reminders for members with pending commitment orders on Sunday 20:00, 22:00, 23:00.
- RF-NOTI-04 Admin can use all notification delivery modes enabled in MVP.
- RF-NOTI-05 System must store user devices in `users/{userId}/devices/{deviceId}` and keep `users.lastDeviceId` updated with the latest active device.

### 3.9 Reviewer account (Apple/TestFlight)

- RF-REV-01 There must be a known reviewer account.
- RF-REV-02 When this account logs into production app, backend routing must point to develop.
- RF-REV-03 Reviewer can create/edit/delete in develop without affecting production data.

### 3.10 AI scope (MVP-bounded)

- RF-IA-01 Bylaws consultation uses hybrid approach:
  - local first,
  - cloud escalation for complex cases.
- RF-IA-02 Shifts can be integrated with Google Sheets (read/write).
- RF-IA-03 MVP operational traceability for shift changes relies on global notifications.

### 3.11 App startup and synchronization

- RF-APP-01 Startup must read remote app-version policy and support forced or optional update behavior.
- RF-APP-02 `My order` access must be gated by critical-data freshness (with timeout and retry path).
- RF-APP-03 Session/token refresh must run on startup and foreground, with explicit expired-session UX.
- RF-APP-04 System must run selective foreground synchronization using TTL/throttling and remote collection timestamps.
- RF-APP-05 Runtime environments include `local`, `develop`, and `production`, with reviewer routing override already defined in RF-REV-*.

## 4. Non-Functional Requirements

- RNF-01 Role-based Firestore security.
- RNF-02 Time consistency with Europe/Madrid business timezone.
- RNF-03 Idempotent weekly automations (reminders, optional auto-order generation).
- RNF-04 Logical delete for historical entities (products, members, orders).
- RNF-05 Initial localization: Spanish and English.
- RNF-06 Minimum observability for automations (job errors, push sends, shift changes).
- RNF-07 Environment isolation and safety must hold across `local`/`develop`/`production`.

## 5. Global MVP Acceptance Criteria

- Weekly flows obey admin-defined operational calendar.
- No committed member can confirm an order while violating active commitments.
- Eco-basket commitment validation accepts `pickup` and `no_pickup` options, and both remain paid lines in order totals.
- Eco-basket lines use the same price for `pickup` and `no_pickup`, regardless of even/odd producer.
- Members with `isActive = false` are excluded from forgotten-order handling.
- Shifts are globally visible and each member can see upcoming assignments.
- Accepted and confirmed swap updates shifts and triggers notification.
- Reviewer account operates on develop without impacting production dataset.
- Authenticated accounts not present in authorized member list remain in disabled mode until admin adds/authorizes them.
- Forced-update policy blocks unsupported app versions at startup.
- `My order` is only enabled after critical data freshness validation.

## 6. Open Decisions (Non-blocking)

- Assembly-level decision for replacement policy after published shifts.
- Additional product field edit restrictions beyond immutable `vendorId`.
- Final Android fallback strategy for reminders (push-only vs local alarms by OS policy).
- Reference: `docs/requirements/implemented-features-gap-reconciliation-v1.md`.
