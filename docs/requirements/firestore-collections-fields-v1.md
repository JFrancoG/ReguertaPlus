# Firestore - Collections and Fields (MVP v1)

Date: 2026-03-06
Status: Canonical implementation contract
Scope: Reguerta MVP

## 1. Goal

Define collections and fields as a closed contract so Android, iOS, and backend models align exactly.

## 2. Global conventions

- Business timezone: `Europe/Madrid`.
- Timestamp type: Firestore `Timestamp` (stored UTC, displayed in business timezone).
- Field naming: `camelCase`.
- Runtime environments: `local`, `develop`, `production`.
- Cloud Firestore namespaces currently used:
  - `develop/collections/...` and `production/collections/...` are the live
    legacy trees used by the currently published apps.
  - `develop/plus-collections/...` and `production/plus-collections/...` are the
    Reguerta+ trees.
  - `local` is runtime-only (emulator/dev), not a required cloud namespace.
- `develop` and `production` intentionally coexist in the same Firebase project
  and stay close for tester workflows. The namespace is routing context, never
  proof of identity, role, ownership, or authorization.
- Main IDs:
  - `users/{userId}` -> internal stable member ID (not required to match Firebase Auth UID)
  - `users.authUid` -> Firebase Auth UID after first authorized login (nullable before first login)
  - `authLinks/{firebaseUid}` -> server-owned deterministic link to `users/{memberId}`
  - `users/{userId}/devices/{deviceId}` -> per-device metadata for push delivery and diagnostics
  - `users/{userId}/notificationReads/{eventId}` -> per-user read markers for in-app notifications
  - `orders/{orderId}` -> recommended `order_{userId}_{weekKey}`
  - `deliveryCalendar/{weekKey}` -> e.g. `2026-W10` (`weekKey` is document ID)
- Logical delete for historical entities (`archived`, `archivedAt`).
- Audit fields in primary documents: `createdAt`, `updatedAt`.

## 3. Canonical enums

- Roles: `member`, `producer`, `admin`
- Consumer status wire values: `sin_hacer`, `en_carrito`, `confirmado`
- Producer status: `unread`, `read`, `prepared`, `delivered`
- Eco commitment mode: `weekly`, `biweekly`
- Eco parity: `even`, `odd`, `null`
- Producer parity: `even`, `odd`, `null`
- Product stock mode: `finite`, `infinite`
- Product pricing mode: `fixed`, `weight`
- Eco basket order option: `pickup`, `no_pickup`, `null`
- Device platform: `android`, `ios`
- Common purchase type: `seasonal`, `spot`, `null`
- Shift type: `delivery`, `market`
- Shift status: `planned`, `swap_pending`, `confirmed`
- Shift source: `app`, `google_sheets`
- Swap request status: `open`, `cancelled`, `applied`
- Swap response status: `available`, `unavailable`
- Notification event type: `order_reminder`, `order_auto_generated`, `shift_swap_requested`, `shift_swap_available`, `shift_swap_unavailable`, `shift_swap_accepted`, `shift_swap_applied`, `shift_updated`, `news_published`, `admin_broadcast`
- Notification target: `all`, `users`, `segment`
- Notification segment type: `role`

## 4. Canonical MVP collections

Path prefixes for every collection below:
- Runtime dataset path: `<env>/plus-collections/<collectionName>/...`
- `<env>`: `develop` or `production`

### 4.1 `users/{userId}`

- `displayName`: string (required)
- `normalizedEmail`: string (required, lowercase/trimmed canonical auth lookup)
- `email` / `emailNormalized`: string (legacy aliases accepted only during
  migration; trusted writes remove them)
- `authUid`: string|null (nullable until first authorized login)
- `phoneNumber`: string (optional; readers may accept legacy `phone` aliases)
- `roles`: array<string> (required)
- `isActive`: bool (required)
- `producerCatalogEnabled`: bool (required, default `true`; producer business flag for catalog visibility)
- `producerParity`: string|null (`even`|`odd`|null) (producer classification for fixed parity producer assignment)
- `isCommonPurchaseManager`: bool (required, default `false`; identifies members acting as common-purchase managers)
- `ecoCommitment`: map
  - `mode`: string (`weekly`|`biweekly`)
  - `parity`: string|null (`even`|`odd`|null)
- `settings`: map (optional legacy/reserved field; current preferences are local
  and clients do not write this map)
- `createdAt`: timestamp (required)
- `updatedAt`: timestamp (required)
- `archivedAt`: timestamp|null
- `lastDeviceId`: string|null (latest active device; when changed by the owner,
  it must reference an existing device in that user's subcollection)

Subcollection `users/{userId}/devices/{deviceId}`:
- `deviceId`: string (required, should match document ID)
- `platform`: string (`android`|`ios`) (required)
- `appVersion`: string (required)
- `osVersion`: string (required)
- `apiLevel`: integer|null (required and non-negative on Android; must be
  `null` on iOS)
- `manufacturer`: string|null
- `model`: string|null
- `fcmToken`: string|null (latest FCM token known for this device)
- `tokenUpdatedAt`: timestamp|null (last refresh time for `fcmToken`)
- `firebaseInstallationId`: string|null (Android Firebase Installation ID used
  by the current FCM registration API; dispatched separately from legacy/iOS
  tokens)
- `registrationUpdatedAt`: timestamp|null (last refresh time for
  `firebaseInstallationId`)
- `firstSeenAt`: timestamp (required)
- `lastSeenAt`: timestamp (required)

Subcollection `users/{userId}/notificationReads/{eventId}`:
- `notificationEventId`: string (required, should match document ID and an existing `notificationEvents/{eventId}` when available)
- `readAt`: timestamp (required)

### 4.1.b `authLinks/{firebaseUid}`

- `memberId`: string (required; references the canonical `users/{memberId}` document)

Authorization contract:

- Only trusted backend code and controlled migration scripts create or change
  these documents.
- A client may get only `authLinks/{request.auth.uid}` and may never list,
  create, update, or delete identity links.
- Operational authorization requires the linked member to have
  `users.authUid == request.auth.uid`, `isActive == true`, and the canonical
  `member` role. Both directions of the identity link must agree.
- The first link verifies the Firebase ID token and verified token email on the
  backend, then writes `users.authUid` and `authLinks/{uid}` transactionally.

### 4.1.c `memberDirectory/{memberId}`

Backend-owned, PII-free projection for member-to-member discovery:

- `userId`: string (required; equals the canonical `users` document ID)
- `displayName`: string (required)
- `companyName`: string|null
- `roles`: array<string> (required; canonical role values only)
- `isActive`: bool (required; only `true` documents are projected)
- `producerCatalogEnabled`: bool (required)
- `isCommonPurchaseManager`: bool (required)
- `producerParity`: string|null (`even`|`odd`|null)
- `ecoCommitment`: map (required)
  - `mode`: string (`weekly`|`biweekly`)
  - `parity`: string|null (`even`|`odd`|null)

The projection must never contain `normalizedEmail`, legacy email aliases,
`phoneNumber`, legacy phone aliases, `authUid`, device data, or reviewer
configuration. Only trusted backend code writes it. In strict
`plus-collections`, active members may query this directory while complete
`users` records are readable only by their owner or an admin. Published legacy
clients keep using the separate `collections` tree during migration.

### 4.2 `sharedProfiles/{userId}`

- `userId`: string (required)
- `familyNames`: string
- `photoUrl`: string|null
- `about`: string
- `updatedAt`: timestamp (required)

### 4.3 `products/{productId}`

- `vendorId`: string (required, immutable)
- `companyName`: string (required)
- `name`: string (required)
- `description`: string
- `productImageUrl`: string|null (Storage URL)
- `price`: number (required)
- `pricingMode`: string (`fixed`|`weight`) (required, default `fixed`)
- `weightStep`: number|null (required when `pricingMode == weight`, kilograms in the mobile app)
- `minWeight`: number|null (required when `pricingMode == weight`)
- `maxWeight`: number|null (required when `pricingMode == weight`)
- `unitName`: string (required)
- `unitAbbreviation`: string (optional, recommended)
- `unitPlural`: string (required)
- `unitQty`: number (required)
- `packContainerName`: string
- `packContainerAbbreviation`: string (optional, recommended)
- `packContainerPlural`: string
- `packContainerQty`: number
- `isAvailable`: bool (required)
- `stockMode`: string (`finite`|`infinite`) (required)
- `stockQty`: number|null (required when finite)
- `isEcoBasket`: bool (required)
- `isCommonPurchase`: bool (required)
- `commonPurchaseType`: string|null
- `archived`: bool (required)
- `createdAt`: timestamp (required)
- `updatedAt`: timestamp (required)

Modeling note:
- `products` must remain season-agnostic stable catalog entities.
- Seasonal lifecycle belongs in `seasonalCommitments` (and future campaign entities if needed), not in `products`.
- Eco-basket pickup choice is not a product attribute; it belongs to the weekly order line.

### 4.4 `orders/{orderId}`

- `userId`: string (required)
- `consumerDisplayName`: string (required, buyer display-name snapshot at order level)
- `week`: number (required)
- `weekKey`: string (required)
- `deliveryDate`: timestamp (required)
- `consumerStatus`: string (required)
- `producerStatus`: string (`unread`|`read`|`prepared`|`delivered`) (required, default `unread`)
- `total`: number (required)
- `totalsByVendor`: map<string, number> (keys must be `vendorId`, values are subtotals)
- `isAutoGenerated`: bool (required)
- `autoGeneratedReason`: string|null (optional trace field; set when `isAutoGenerated == true`, else null)
- `createdAt`: timestamp (required)
- `updatedAt`: timestamp (required)
- `confirmedAt`: timestamp|null

Uniqueness rule: one order per `userId + weekKey`.

Snapshot rule:
- `consumerDisplayName` must be copied from `users.displayName` when the order is first created.
- If the user profile name changes later, historical orders must keep the stored snapshot unchanged.
- If business rules allow replacing the buyer identity of an existing order, the snapshot must be rewritten together with `userId`; otherwise it remains immutable.

### 4.5 `orderlines/{orderlineId}`

- `orderId`, `userId`, `productId`, `vendorId`: string (required)
- `consumerDisplayName`: string (required, duplicated buyer display-name snapshot for producer views/grouping)
- `companyName`, `productName`: string (required)
- `productImageUrl`: string|null
- `quantity`: number (required)
- `priceAtOrder`: number (required)
- `subtotal`: number (required)
- `pricingModeAtOrder`: string (`fixed`|`weight`) (required)
- `unitName`, `unitPlural`: string
- `unitAbbreviation`: string|null
- `unitQty`: number
- `packContainerName`, `packContainerPlural`: string
- `packContainerAbbreviation`: string|null
- `packContainerQty`: number
- `ecoBasketOptionAtOrder`: string|null (`pickup`|`no_pickup`|null)
- `week`: number (required)
- `weekKey`: string (required)
- `createdAt`: timestamp (required)
- `updatedAt`: timestamp (required)

Producer read-model note:
- Prefer loading producer `Received orders` from `orderlines` filtered by `vendorId`.
- Product tab groups/sorts the loaded lines by product/company fields.
- Member tab groups/sorts the same loaded lines by `consumerDisplayName` (with `userId` as stable fallback key).
- `orders` stays as the source for whole-order status/totals/traceability, while `orderlines` acts as the main list/read model for producer work views.

Snapshot rule:
- `consumerDisplayName` must be written from the same value stored in `orders.consumerDisplayName` whenever an order line is created.
- When order lines are regenerated/rebuilt from an existing order, preserve or repopulate the same snapshot value from the parent order.
- Profile edits in `users.displayName` must not retroactively update existing order lines.

### 4.6 `deliveryCalendar/{weekKey}`

- `weekKey`: string (required)
- `deliveryDate`: timestamp (required)
- `ordersBlockedDate`: timestamp (required)
- `ordersOpenAt`: timestamp (required)
- `ordersCloseAt`: timestamp (required)
- `updatedBy`: string (required)
- `updatedAt`: timestamp (required)

Delivery calendar strategy (canonical):
- `weekKey` must match document ID.
- Store only exception weeks in `deliveryCalendar`.
- If a week document is missing, resolve calendar from `config/global.deliveryDayOfWeek` fallback and derive blocked/open windows at runtime.

### 4.7 `seasonalCommitments/{commitmentId}`

- `userId`: string (required)
- `productId`: string (required)
- `seasonKey`: string (required)
- `fixedQty`: number (required, canonical)
- `fixedQtyPerOfferedWeek`: number (legacy alias, temporary compatibility)
- `fixedQtyPerWeek`: number (legacy alias, temporary compatibility)
- `active`: bool (required)
- `createdAt`: timestamp (required)
- `updatedAt`: timestamp (required)

### 4.8 `shifts/{shiftId}`

- `type`: string (`delivery`|`market`) (required)
- `date`: timestamp (required)
- `assignedUserIds`: array<string> (required)
- `helperUserId`: string|null
- `status`: string (`planned`|`swap_pending`|`confirmed`) (required)
- `source`: string (`app`|`google_sheets`) (required)
- `createdAt`: timestamp (required)
- `updatedAt`: timestamp (required)

### 4.8.b `shiftPlanningRequests/{requestId}`

- `type`: string (`delivery`|`market`) (required)
- `requestedByUserId`: string (required)
- `requestedAt`: timestamp (required)
- `status`: string (`requested`|`processing`|`completed`|`failed`) (required)
- `seasonLabel`: string|null (optional, backend completion summary)
- `sheetName`: string|null (optional, backend completion summary)
- `generatedCount`: number|null (optional, backend completion summary)
- `errorMessage`: string|null (optional, only when failed)

### 4.9 `shiftSwapRequests/{requestId}`

- `requestedShiftId`: string (required)
- `requesterUserId`: string (required)
- `reason`: string (required; may be empty)
- `status`: string (`open`|`cancelled`|`applied`) (required)
- `candidates`: array of `{ userId, shiftId }` (required)
- `responses`: array of `{ userId, shiftId, status, respondedAt }` (required)
- `selectedCandidateUserId`: string|null
- `selectedCandidateShiftId`: string|null
- `requestedAt`: timestamp (required)
- `confirmedAt`: timestamp|null
- `appliedAt`: timestamp|null

### 4.10 `news/{newsId}`

- `title`: string (required)
- `body`: string (required)
- `publishedBy`: string (required, display name)
- `publishedAt`: timestamp (required)
- `active`: bool (required)
- `urlImage`: string|null (optional)

### 4.11 `notificationEvents/{eventId}` (recommended)

- `title`: string (required)
- `body`: string (required)
- `type`: string (`order_reminder`|`order_auto_generated`|`shift_swap_requested`|`shift_swap_available`|`shift_swap_unavailable`|`shift_swap_accepted`|`shift_swap_applied`|`shift_updated`|`news_published`|`admin_broadcast`) (required)
- `target`: string (`all`|`users`|`segment`) (required)
- `targetPayload`: map
- `sentAt`: timestamp (required)
- `createdBy`: string (required, `system` or authorized `userId`)
- `weekKey`: string (optional, only when the notification applies to a specific week)

Per-user read state is stored outside immutable events in
`users/{userId}/notificationReads/{eventId}`. Clients mark visible
notifications as read when the user leaves the notifications screen.

The backend materializes every resolved recipient's immutable feed copy at
`users/{userId}/notificationInbox/{eventId}`. It contains
`notificationEventId` plus the display and audience fields from the source
event. Clients list only their own inbox; only backend code writes or removes
inbox documents. The global `notificationEvents` collection remains the source
for dispatch and admin audit, not the strict Reguerta+ member feed query. The
separate `collections` tree retains the published apps' legacy feed contract.

`targetPayload` contract:
- For `target == all`: empty map.
- For `target == users`: `{ userIds: string[] }` (required, non-empty).
- For `target == segment`: `{ segmentType: string, ... }` with allowed shapes:
  - `segmentType == role`: requires `role` (`member`|`producer`|`admin`).

### 4.12 `config/public` (anonymous startup config)

Environment-scoped paths:

- `develop/plus-collections/config/public`
- `production/plus-collections/config/public`

This document contains only the `versions` map described below. In the strict
target it is the only anonymous Firestore read in the application dataset.
Reviewer allowlists, freshness timestamps, delivery settings, and any other
operational values must not be copied into it.

### 4.12.b `config/member` (active-member operational projection)

Environment-scoped paths:

- `develop/plus-collections/config/member`
- `production/plus-collections/config/member`

Backend-owned fields copied from the authoritative global configuration:

- `cacheExpirationMinutes`: number (required, greater than zero)
- `lastTimestamps`: map (required; only freshness timestamps needed by clients)
- `deliveryDayOfWeek`: string (required; normalized weekday code)

The projection must not contain version policy, reviewer allowlists, secrets,
or unrelated global settings. In the strict phase any active linked member may
read it and clients may not write it.

### 4.12.c `config/global` (authoritative environment-scoped config)

Current live path:
- `develop/plus-collections/config/global`
- `production/plus-collections/config/global`

Current fields in use (must be preserved):
- `cacheExpirationMinutes`: number (required)
- `lastTimestamps`: map (required)
  - current keys include: `containers`, `measures`, `orderlines`, `orders`, `products`, `users`
  - add new keys as new collections become sync-critical in `plus-collections`
- `otherConfig`: map (required)
  - `deliveryDayOfWeek`: string (required, current format like `WED`)
- `versions`: map (required)
  - `android.current`: string (required)
  - `android.min`: string (required)
  - `android.forceUpdate`: bool (required)
  - `android.storeUrl`: string (required)
  - `ios.current`: string (required)
  - `ios.min`: string (required)
  - `ios.forceUpdate`: bool (required)
  - `ios.storeUrl`: string (required)

Normalization note for `plus-collections`:
- Preferred normalized field is top-level `deliveryDayOfWeek`.
- Backward compatibility should keep read support for `otherConfig.deliveryDayOfWeek`.
- `deliveryDayOfWeek` remains mandatory while exception-only `deliveryCalendar` strategy is active.

Strict `plus-collections` access to `config/global` is limited to trusted
backend code and admins. Published clients keep their existing config contract
under the separate `collections` tree until migration.

### 4.12.d Authorization rollout compatibility

The Firebase project is shared, but published apps and Reguerta+ use separate
Firestore trees. One Rules file must implement both matrices explicitly:

0. The brief transition release was restored after the live-client dependency
   was found.
1. Firestore Phase 1 is now deployed and read back. It keeps authenticated
   read/write for the eight enumerated legacy prefixes and preserves the prior
   authenticated `plus-collections` contract; strict plus authorization is not
   deployed. Live Storage remains global authenticated read/write, and
   `storage.phase1.rules` is only its semantic rollback snapshot.
2. The identity dry-run blocks progress: develop has 7 active admins and
   production has 3, but both have zero operationally linked admins because the
   matching Auth accounts are unverified. No Functions deployment, backfill
   `--apply`, or strict Rules deployment is allowed before an owner decision.
3. After that decision and a safe admin-link dry-run, deploy a reviewed Function
   allowlist, apply additive projections, and deploy/read back Firestore and
   Storage strict separately through `firebase.strict.json`.
4. Publish and measure client adoption, then migrate and retire legacy access.

Live Storage still allows global authenticated read/write, including list and
delete. The undeployed strict candidate changes legacy `products/**` to
authenticated `get`/`create`/`update` with `list`/`delete` denied. Reguerta+
`{env}/images/{products|news|shared_profiles}/...` allows linked-member `get` and
role/owner-scoped `create`/`update`/`delete`; creates and updates must be JPEG <=
2 MiB, and `list` is denied. Previously issued tokenized download URLs are not
re-evaluated by Rules and need separate inventory and token rotation/revocation.

### 4.13 Live legacy compatibility dataset (`collections`)

The currently published apps still read and write the non-plus paths under
`develop/collections/**` and `production/collections/**`. Their current
complete observed top-level compatibility allowlist is:
- `config` (`global` document)
- `containers`
- `measures`
- `news` (currently empty)
- `orders`
- `orderLines` (legacy name in DB)
- `products`
- `users` (with `devices` subcollection)

Canonical naming note:
- Specs/docs use logical `orderlines`; migration/adapters must map `orderLines` <-> `orderlines` safely.

### 4.13.1 Confirmed fields in the live legacy dataset

`containers/{containerId}`:
- `name`
- `plural`

`measures/{measureId}`:
- `abbreviation`
- `name`
- `plural`
- `type`

`users/{userId}` (observed sample, non-exhaustive):
- `available`
- `companyName`
- `email`
- `isAdmin`
- `isProducer`
- `lastDeviceId`
- `name`
- `numResignations`
- `phone`
- `surname`
- `tropical1`
- `tropical2`
- `typeConsumer`
- `typeProducer`
- subcollection: `devices`

`products/{productId}` (observed sample, non-exhaustive):
- `available`
- `companyName`
- `container`
- `description`
- `name`
- `price`
- `quantityContainer`
- `quantityWeight`
- `stock`
- `unity`
- `urlImage`
- `userId`

`orders/{orderId}` (observed sample, non-exhaustive):
- `name`
- `surname`
- `userId`
- `week`

`orderLines/{orderLineId}` (observed sample, non-exhaustive):
- `companyName`
- `orderId`
- `productId`
- `quantity`
- `subtotal`
- `userId`
- `week`

Migration and authorization notes:

- Before changing legacy Rules or running migration jobs, inventory the full
  schema and real payloads for `users`, `products`, `orders`, and `orderLines`
  in both environments.
- Until every legitimate Firebase account can be deterministically linked to a
  legacy member, keep `request.auth != null` reads and writes for only the eight
  enumerated live prefixes and deny any unknown legacy prefix. Do not infer
  roles from `develop`/`production`, unverified email, or client input.
- The broad authenticated rule is temporary compatibility debt. The strict
  `plus-collections` matrix and final catch-all must prevent it from authorizing
  any Reguerta+ or unknown path.

## 5. Mandatory business validations

Unless a rule explicitly names the live legacy dataset, the validations below
apply to the canonical `plus-collections` contract.

- `users.roles` includes at least `member` for active members.
- `users.normalizedEmail` must be unique across active member records.
- `users.producerCatalogEnabled` must be boolean and must not be stored in `users.settings`.
- `users.producerParity` must be `even`, `odd`, or `null`.
- `users.isCommonPurchaseManager` must be boolean.
- Firebase-authenticated access is operationally authorized only when
  `authLinks/{request.auth.uid}` resolves to a `users` record with
  `isActive == true` and the canonical `member` role.
- On first authorized login, the backend requires a verified token email. If
  `users.authUid` is null it transactionally writes the authenticated UID and
  `authLinks/{uid}`; if already set, it must match the authenticated UID.
- If no authorized `users` record exists for authenticated email, app must show unauthorized alert and block operational actions.
- If `users.lastDeviceId` is set, referenced device document must exist in `users/{userId}/devices/{lastDeviceId}`.
- Device records must enforce `platform` in (`android`, `ios`).
- For iOS devices, `apiLevel` must be `null`; for Android devices, `apiLevel` must be a non-negative number.
- Device timestamp consistency: `firstSeenAt <= lastSeenAt`.
- `config/public.versions.android` and `config/public.versions.ios` must include
  `current`, `min`, `forceUpdate`, and `storeUrl` before startup gating runs.
- `config/global.cacheExpirationMinutes` must be > 0.
- Delivery day must be readable from `config/global.deliveryDayOfWeek` (preferred) or `config/global.otherConfig.deliveryDayOfWeek` (backward compatible).
- `deliveryCalendar/{weekKey}` documents are exceptions only; missing document means default schedule from `deliveryDayOfWeek`.
- `config/global.lastTimestamps` must include tracked critical collections used by freshness gate.
- Admin revoke cannot leave zero active admins.
- `products.vendorId` immutable after creation.
- If `products.productImageUrl` is set, it must be a valid Storage/media URL.
- If `stockMode == finite`, `stockQty` is required and >= 0.
- Product visibility in ordering must require all of:
  - producer `users.producerCatalogEnabled == true`
  - `products.isAvailable == true`
  - `products.archived == false`
- One order per `userId + weekKey`.
- `orders.total` equals sum of related `orderlines.subtotal`.
- `orders.producerStatus` is mandatory and must be one of `unread`, `read`, `prepared`, `delivered` (no null state).
- `orders.totalsByVendor` must use `vendorId` keys (not `companyName`) for stability.
- `orders.autoGeneratedReason` is optional and only meaningful when `isAutoGenerated == true`; current value set is `forgotten_commitment`.
- Confirmation must satisfy eco/seasonal commitments.
- Eco-basket minimum quantity is a fixed business rule (=1) and is not stored as a per-user field.
- If an eco-basket line is present, `orderlines.ecoBasketOptionAtOrder` may be `pickup` or `no_pickup`.
- `ecoBasketOptionAtOrder = no_pickup` means the commitment is paid but basket pickup is skipped.
- All active eco-basket products must share the same `price`, regardless of `orderlines.ecoBasketOptionAtOrder` (`pickup`/`no_pickup`) and parity producer (`even`/`odd`).
- `isActive == false` excludes member from reminders, optional auto-order, and shift planning.
- Non-admin member directory queries use only `memberDirectory` and return
  active projections; admins use full `users` records for account governance
  and reactivation.
- For `shifts.type == market`, assigned users must be at least 3.
- `shifts.source` must be `app` or `google_sheets` (no other values).
- `notificationEvents.targetPayload` must match `target`:
  - `all`: empty map only.
  - `users`: non-empty `userIds`.
  - `segment`: valid `segmentType` and required keys per segment contract.
- If `products.pricingMode == weight`, `price`, `weightStep`, `minWeight`, and `maxWeight` are required and > 0; `minWeight <= maxWeight`, and the maximum must be reachable from the minimum using whole `weightStep` increments.
- If `orderlines.pricingModeAtOrder == weight`, `quantity` stores weight amount (decimal allowed, in `unitName`), and `subtotal = quantity * priceAtOrder`.

## 6. Minimum recommended indexes

- `orders`: `(userId ASC, weekKey DESC)`
- `orders`: `(weekKey ASC, consumerStatus ASC)`
- `orderlines`: `(orderId ASC, companyName ASC)`
- `orderlines`: `(vendorId ASC, weekKey DESC)`
- `products`: `(vendorId ASC, archived ASC, isAvailable ASC)`
- `users`: `(normalizedEmail ASC, isActive ASC)`
- `memberDirectory`: `(isActive ASC, displayName ASC)` when ordered directory
  queries are introduced
- `users/{userId}/devices`: `(lastSeenAt DESC)` (if list/history by recency is needed)
- `shifts`: `(date ASC, type ASC)`
- `shiftSwapRequests`: `(targetUserId ASC, status ASC, requestedAt DESC)`
- `seasonalCommitments`: `(userId ASC, seasonKey ASC, active ASC)`

## 7. Suggested DTO names (cross-platform)

- `UserDto`
- `DeviceDto`
- `SharedProfileDto`
- `ProductDto`
- `OrderDto`
- `OrderLineDto`
- `DeliveryCalendarDto`
- `SeasonalCommitmentDto`
- `ShiftDto`
- `ShiftSwapRequestDto`
- `NewsDto`
- `NotificationEventDto`

Implementation guidance:
- Use tolerant decoding with defaults for incremental compatibility.
- Enforce strong domain validation before persistence.

## 8. Contract versioning

Current version: `v1`.
Any contract change must update this file, affected specs, and migration notes when compatibility breaks.
