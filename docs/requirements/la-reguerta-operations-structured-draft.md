# La Reguerta Operations - Structured Draft

Date: 2026-03-06
Source: Original brainstorming draft, reorganized and clarified through Q1-Q35 rounds.

## 1. Purpose

This document groups and clarifies operational knowledge to:
- detect missing details,
- prepare formal requirements and user stories,
- support Firestore data design decisions.

## 2. Functional snapshot

Main capability groups:
- Weekly member ordering lifecycle.
- Producer offer and received-order visibility.
- Commitment rules (eco-basket and seasonal/common purchases).
- Member/admin profile and governance actions.
- Shift assignment and swap management.
- Notifications and reviewer operation mode.

## 3. Actors and roles

- Member (consumer)
- Member (producer/common-purchase manager)
- Non-member producer
- Admin
- Family unit under one shared account
- Reviewer account for Apple/TestFlight

## 4. Confirmed business rules

### 4.1 Commitments

- New members commit to one eco-basket as fixed minimum every week (not configurable).
- Two eco-basket producers alternate by week parity.
- Eco-basket price is unique and must remain identical across parity producers and pickup modes (`pickup`/`no_pickup`).
- 7 legacy members have fixed biweekly parity commitment.
- Seasonal products can include fixed quantity commitment by member/product/season.
- Order confirmation must enforce active commitments.

### 4.2 Weekly timeline

- Official delivery day: Wednesday.
- Delivery day can be moved (Tue/Thu/Fri) for holidays or alerts.
- Day after delivery: no ordering.
- Active order window starts day+2 at 00:00 and ends Sunday 23:59.
- Business timezone is fixed: Europe/Madrid.

### 4.3 Consumer flow

- In active window, product catalog is grouped by producer.
- Priority display: common purchases, committed eco-basket producer, then others.
- Search and producer filter are required.
- Cart persists if user exits without confirmation.
- Confirmed orders remain fully editable inside deadline.

### 4.4 Producer flow

- Producers access `Received orders` in allowed period.
- Views: by product and by member.
- Producer status applies to full order (`unread`, `read`, `prepared`, `delivered`).
- Initial producer status is `unread` (no null state).

### 4.5 Product management

- Allowed operations: create, edit, archive.
- Physical delete is not allowed in MVP.
- `vendorId` is immutable.
- Stock supports direct editing and infinite/extended mode.
- Bulk-per-kg flow is identified as post-MVP.

### 4.6 Profiles and users

- Member list is visible to members.
- Admin has full member CRUD view.
- Non-admin sees shared profile info only.
- Shared profile fields: photo, family names, long free text.
- New member access must be pre-authorized by admin in member list (email-based).
- If a signed-in email is not authorized, app shows `Unauthorized user` and keeps operational modules disabled.
- If first login/register uses an authorized email, user enters home and account is linked to that member profile.

### 4.7 Shift operations

- Planning includes only active members.
- New/reactivated members join at end of queue.
- Global shift view is required.
- Each member sees next delivery and market assignment.
- Swap flow requires request + accept + final confirmation.
- Applied swaps notify all members.
- Market shift minimum assignment: 3 members.

### 4.8 Notifications

- Push is the mandatory channel.
- Pending-order reminders on Sunday at 20:00, 22:00, 23:00.
- Admin can use all enabled MVP notification modes.
- Each user keeps device metadata in `users/{userId}/devices/{deviceId}`.
- `users.lastDeviceId` stores the most recently active device.
- On iOS devices, `apiLevel` is always `null`.

### 4.9 Reviewer account

- Known reviewer account is allowlisted.
- Production app routes reviewer traffic to develop backend.
- Reviewer can read/write freely in develop without touching production data.

### 4.10 AI scope

- Bylaws consultation: hybrid local+cloud strategy.
- Shift source integration: Google Sheets for read/write.
- MVP auditing for chatbot-driven shift changes is operational/social (global notifications), not deep technical tracing.

## 5. Clarified non-MVP scope

Deferred:
- Full in-app cashbox ledger.
- Advanced chatbot action auditing.
- Bulk-per-kg product purchasing.
- Dedicated editor sub-role for news publishing.

## 6. Governance-dependent points

These need assembly-level decisions and are tracked as non-blocking governance items:
- Post-publication shift replacement policy when a member drops out.
- Additional product field edit restrictions beyond immutable `vendorId`.

## 7. Derivative artifacts already produced

From this draft, the following were produced:
- `docs/requirements/mvp-requirements-reguerta-v1.md`
- `docs/requirements/user-stories-mvp-reguerta-v1.md`
- `docs/requirements/firestore-structure-mvp-proposal-v1.md`
- `docs/requirements/firestore-collections-fields-v1.md`
- `docs/requirements/implemented-features-gap-reconciliation-v1.md`

Spanish mirror artifacts remain in:
- `docs-es/requirements/`

## 8. Additional confirmed rule: new member onboarding authorization

Consolidation date: 2026-03-07 (Europe/Madrid).

- New members receive app access (iOS/Android) but must be pre-authorized by admin in `users`.
- On first app usage, member can register or login with Firebase Auth.
- If authenticated email is not in authorized member list:
  - app shows `Unauthorized user`,
  - user remains inside app in restricted mode with operational features disabled,
  - access remains restricted until admin adds/authorizes that member.
- If email is already authorized by admin:
  - first login/register enters home directly.

## 9. Requirement impact of additional rule

- Access authorization must validate authenticated email against pre-authorized `users` list.
- Onboarding flow must include:
  - admin pre-creation of member record,
  - first member login/register,
  - auth identity linking to member profile.
- Unauthorized-authenticated state must be explicit in UX:
  - visible alert,
  - restricted mode without operational actions.
- Notification delivery design must include per-user device registry and `lastDeviceId` maintenance.

## 10. Reconciliation decisions accepted (all Option A)

Consolidation date: 2026-03-07 (Europe/Madrid).

- Startup remote version gate is formalized (forced and optional update paths).
- `My order` requires critical-data freshness check (with timeout/retry path).
- Session/token refresh on startup + foreground is required, with explicit expired-session UX.
- Producer bulk availability toggle is accepted in MVP scope.
- Product image pipeline (pick/crop/upload/persist URL) is accepted in MVP scope.
- Runtime environments are formalized as `local`, `develop`, `production`.
- Timestamp-based selective sync is treated as formal requirement for startup/freshness orchestration.
