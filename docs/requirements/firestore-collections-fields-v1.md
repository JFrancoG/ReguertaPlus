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
  - `develop/{collections|plus-collections}/...`
  - `production/{collections|plus-collections}/...`
  - `local` is runtime-only (emulator/dev), not a required cloud namespace.
- Main IDs:
  - `users/{userId}` -> internal stable member ID (not required to match Firebase Auth UID)
  - `users.authUid` -> Firebase Auth UID after first authorized login (nullable before first login)
  - `users/{userId}/devices/{deviceId}` -> per-device metadata for push delivery and diagnostics
  - `orders/{orderId}` -> recommended `order_{userId}_{weekKey}`
  - `deliveryCalendar/{weekKey}` -> e.g. `2026-W10` (`weekKey` is document ID)
- Logical delete for historical entities (`archived`, `archivedAt`).
- Audit fields in primary documents: `createdAt`, `updatedAt`.

## 3. Canonical enums

- Roles: `member`, `producer`, `admin`
- Consumer status: `not_started`, `in_cart`, `confirmed`
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
- Swap request status: `pending`, `accepted`, `requester_confirmed`, `rejected`, `cancelled`, `applied`
- Notification event type: `order_reminder`, `order_auto_generated`, `shift_swap_requested`, `shift_swap_accepted`, `shift_swap_applied`, `shift_updated`, `news_published`, `admin_broadcast`
- Notification target: `all`, `users`, `segment`
- Notification segment type: `members_with_pending_order`, `users_with_shift`, `producers_by_vendor`, `role`

## 4. Canonical MVP collections

Path prefixes for every collection below:
- Legacy dataset path: `<env>/collections/<collectionName>/...`
- Plus dataset path: `<env>/plus-collections/<collectionName>/...`
- `<env>`: `develop` or `production`

### 4.1 `users/{userId}`

- `displayName`: string (required)
- `email`: string (required)
- `emailNormalized`: string (required, lowercase/trimmed for auth lookup)
- `authUid`: string|null (nullable until first authorized login)
- `phone`: string (optional)
- `roles`: array<string> (required)
- `isActive`: bool (required)
- `producerCatalogEnabled`: bool (required, default `true`; producer business flag for catalog visibility)
- `producerParity`: string|null (`even`|`odd`|null) (producer classification for fixed parity producer assignment)
- `isCommonPurchaseManager`: bool (required, default `false`; identifies members acting as common-purchase managers)
- `ecoCommitment`: map
  - `mode`: string (`weekly`|`biweekly`)
  - `parity`: string|null (`even`|`odd`|null)
- `settings`: map
  - `theme`: string (`light`|`dark`|`system`)
- `createdAt`: timestamp (required)
- `updatedAt`: timestamp (required)
- `archivedAt`: timestamp|null
- `lastDeviceId`: string|null (latest active device for this user)

Subcollection `users/{userId}/devices/{deviceId}`:
- `deviceId`: string (required, should match document ID)
- `platform`: string (`android`|`ios`) (required)
- `appVersion`: string (required)
- `osVersion`: string (required)
- `apiLevel`: number|null (Android API level; must be `null` on iOS)
- `manufacturer`: string|null (required on Android, nullable on iOS)
- `model`: string|null (required on Android, nullable on iOS)
- `fcmToken`: string|null (latest FCM token known for this device)
- `tokenUpdatedAt`: timestamp|null (last refresh time for `fcmToken`)
- `firstSeenAt`: timestamp (required)
- `lastSeenAt`: timestamp (required)

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
- `weightStep`: number|null (required when `pricingMode == weight`, same unit as `unitName`)
- `minWeight`: number|null (optional, only for `weight`, same unit as `unitName`)
- `maxWeight`: number|null (optional, only for `weight`, same unit as `unitName`)
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
- `fixedQtyPerOfferedWeek`: number (required)
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

### 4.9 `shiftSwapRequests/{requestId}`

- `shiftId`: string (required)
- `requesterUserId`: string (required)
- `targetUserId`: string (required)
- `status`: string (required)
- `requestedAt`: timestamp (required)
- `respondedAt`: timestamp|null
- `confirmedAt`: timestamp|null
- `appliedAt`: timestamp|null

### 4.10 `news/{newsId}`

- `title`: string (required)
- `body`: string (required)
- `publishedBy`: string (required)
- `publishedAt`: timestamp (required)
- `active`: bool (required)
- `urlImage`: string|null (optional)

### 4.11 `notificationEvents/{eventId}` (recommended)

- `title`: string (required)
- `body`: string (required)
- `type`: string (`order_reminder`|`order_auto_generated`|`shift_swap_requested`|`shift_swap_accepted`|`shift_swap_applied`|`shift_updated`|`news_published`|`admin_broadcast`) (required)
- `target`: string (`all`|`users`|`segment`) (required)
- `targetPayload`: map
- `sentAt`: timestamp (required)
- `createdBy`: string (required)
- `weekKey`: string|null

`targetPayload` contract:
- For `target == all`: empty map or null.
- For `target == users`: `{ userIds: string[] }` (required, non-empty).
- For `target == segment`: `{ segmentType: string, ... }` with allowed shapes:
  - `segmentType == members_with_pending_order`: requires `weekKey`.
  - `segmentType == users_with_shift`: requires `shiftId`.
  - `segmentType == producers_by_vendor`: requires `vendorId`.
  - `segmentType == role`: requires `role` (`member`|`producer`|`admin`).

### 4.12 `config/global` (environment-scoped operational config)

Current live path:
- `develop/collections/config/global`
- `production/collections/config/global`

Target-compatible path for the new dataset:
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

### 4.13 Existing legacy dataset in `collections` (as-is)

Current collection names under `<env>/collections`:
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

### 4.13.1 Confirmed legacy fields in `collections` (current data)

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

Migration note:
- Before production migration jobs, run full schema inventory for `users`, `products`, `orders`, and `orderLines` in both `develop/collections` and `production/collections`.

## 5. Mandatory business validations

- `users.roles` includes at least `member` for active members.
- `users.emailNormalized` must be unique across active member records.
- `users.producerCatalogEnabled` must be boolean and must not be stored in `users.settings`.
- `users.producerParity` must be `even`, `odd`, or `null`.
- `users.isCommonPurchaseManager` must be boolean.
- Firebase-authenticated access is operationally authorized only when a `users` record exists with matching `emailNormalized` and `isActive == true`.
- On first authorized login, if `users.authUid` is null it is linked to the authenticated UID; if already set, it must match authenticated UID.
- If no authorized `users` record exists for authenticated email, app must show unauthorized alert and block operational actions.
- If `users.lastDeviceId` is set, referenced device document must exist in `users/{userId}/devices/{lastDeviceId}`.
- Device records must enforce `platform` in (`android`, `ios`).
- For iOS devices, `apiLevel` must be `null`; for Android devices, `apiLevel` must be a non-negative number.
- Device timestamp consistency: `firstSeenAt <= lastSeenAt`.
- `config/global.versions.android` and `config/global.versions.ios` must include `current`, `min`, `forceUpdate`, and `storeUrl` before startup gating runs.
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
- For `shifts.type == market`, assigned users must be at least 3.
- `shifts.source` must be `app` or `google_sheets` (no other values).
- `notificationEvents.targetPayload` must match `target`:
  - `all`: empty/null payload only.
  - `users`: non-empty `userIds`.
  - `segment`: valid `segmentType` and required keys per segment contract.
- If `products.pricingMode == weight`, `price` and `weightStep` are required and > 0.
- If `orderlines.pricingModeAtOrder == weight`, `quantity` stores weight amount (decimal allowed, in `unitName`), and `subtotal = quantity * priceAtOrder`.

## 6. Minimum recommended indexes

- `orders`: `(userId ASC, weekKey DESC)`
- `orders`: `(weekKey ASC, consumerStatus ASC)`
- `orderlines`: `(orderId ASC, companyName ASC)`
- `orderlines`: `(vendorId ASC, weekKey DESC)`
- `products`: `(vendorId ASC, archived ASC, isAvailable ASC)`
- `users`: `(emailNormalized ASC, isActive ASC)`
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
