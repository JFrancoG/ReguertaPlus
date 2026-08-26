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
- Planner-generated shift origin: `planner`
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

- `planningSchemaVersion`: integer|null (exact `1` for HU-082 planner rows)
- `type`: string (`delivery`|`market`) (required)
- `date`: timestamp (required)
- `assignedUserIds`: array<string> (required)
- `helperUserId`: string|null
- `status`: string (`planned`|`swap_pending`|`confirmed`) (required)
- `source`: string (`app`|`google_sheets`) (required)
- `origin`: string|null (`planner` for an HU-082 generated shift)
- `planningRequestId`: string|null (request lineage for a planner-generated shift)
- `bundleRevision`: string|null (publication revision; required by the future HU-082 publication adapter)
- `bundleDigest`: string|null (digest bound to `bundleRevision`; required by the future HU-082 publication adapter)
- `writeEpoch`: integer|null (maintenance/publication epoch; required by the future HU-082 publication adapter)
- `projectionSeasonStartYear`: integer|null (season partition that contains the projected date)
- `rotationOwnerUserId`: string|null (immutable fair-queue owner for a generated `delivery` shift)
- `rotationOwnerUserIds`: array<string>|null (three immutable fair-queue owners for a generated `market` shift)
- `roundNumber`: integer|null (delivery owner's one-based round)
- `positionInRound`: integer|null (delivery owner's one-based position in its round)
- `rotationPositions`: array<map>|null (market positions, aligned with `assignedUserIds`)
  - `rotationOwnerUserId`: string (immutable fair-queue owner)
  - `effectiveAssigneeUserId`: string (member currently expected to cover the position)
  - `roundNumber`: integer (one-based)
  - `positionInRound`: integer (one-based)
- `planningReason`: string|null (`target`|`boundaryRoundRemainder` for delivery; market positions may also use `finalGroupPadding`)
- `assignmentRevision`: integer|null (positive for HU-082 planner rows)
- `completion`: map|null (required for HU-082 planner rows)
  - `state`: string (`uncompleted`|`completed`)
  - `revision`: integer (`0` while uncompleted; positive when completed)
  - `actualHelperUserId`: string|null (required for completed delivery)
  - `helperSourceAssignmentRevision`: integer|null
  - `completedAt`: timestamp|null
- `documentRevision`: integer|null (positive monotonic planner revision)
- `lastBackendMutation`: map|null (required for HU-082 controlled writes)
  - `schemaVersion`: integer (exact `1`)
  - `kind`: string (`activation`|`recovery`|`repair`|`syncCorrection`)
  - `operationId`: string
  - `operationIntentDigest`: string
  - `bundleRevision`: string
  - `bundleDigest`: string
  - `writeEpoch`: integer
  - `targetPath`: string
  - `documentRevision`: integer
  - `payloadDigest`: string (exact document digest without this marker)
- `createdAt`: timestamp (required)
- `updatedAt`: timestamp (required)

HU-082 keeps effective assignment (`assignedUserIds`) separate from rotation
ownership. A newly generated position initially copies its owner into its
effective assignee, but later coverage or reassignment must not rewrite the
owner, round, or position. Planner-generated shifts remain compatible with
current clients by using `source = app`; `origin = planner` and the lineage
fields distinguish them from ordinary app edits. The bundle revision, digest,
epoch, and complete ownership persistence listed here are the contract intended
for the publication/activation adapter. Publication codec v1 now enforces one
assigned UID for delivery, exactly three distinct UIDs for market, UTC-midnight
dates, coherent assignment/completion/document revisions, and exact rotation
shape. Existing clients continue consuming their unchanged required fields and
ignore the additive planner metadata.

The backend marker is historical provenance, not a permanent hash of every
later ordinary edit. A candidate `onShiftWritten` validates path, payload,
revision, bundle, epoch, and operation intent only when the marker changes in
that event. If a normal later edit retains the same marker, it is handled
normally even though the historical `payloadDigest` no longer matches. This
cut freezes the pure codec but does not activate a writer in `index.ts`.

### 4.8.b `shiftPlanningRequests/{requestId}`

- `schemaVersion`: integer (required, exact value `2`)
- `requestId`: string (required, equals the document ID)
- `bundleId`: string (required, stable ID shared by both subplans)
- `environment`: string (`develop`|`production`) (required, equals path `<env>`)
- `requestedByUserId`: string (required, equals the linked requesting admin member)
- `requestedAt`: timestamp (required Firestore `Timestamp`; the Functions parser normalizes it to `requestedAtMillis` internally)
- `mode`: string (`preview`|`stage`|`activate`) (required)
- `status`: string (required, exact intake value `requested`)
- `expectedWriteEpoch`: integer (required, non-negative)
- `expectedActiveRevision`: string|null (required optimistic precondition)
- `subplans`: map (required, exact keys `delivery` and `market`)
  - `delivery.targetSeasonStartYear`: integer (required, `2000...9998`)
  - `market.targetSeasonStartYear`: integer (required, `2000...9998`)
- `binding`: map|null (required)
  - `preview`: must be `null`.
  - `stage`: exact map `{ kind: "preview", sourceRequestId, bundleRevision, bundleDigest }`.
  - `activate`: exact map `{ kind: "candidate", candidateId, bundleRevision, bundleDigest, candidateDigest }`.
  - `bundleDigest` and `candidateDigest` format: `shift-planning:v1:sha256:<64 lowercase hexadecimal characters>`.

This is an exact v2 intake schema: extra or missing fields fail validation, and
the backend never infers either target season from the wall clock. In strict
Rules, only an active linked admin may create and read requests; creation also
binds `requestId`, `environment`, and `requestedByUserId` to authenticated path
state. No client may update or delete a request.

A private Firestore repository now implements the local/emulator lifecycle for
`preview` and `stage`. A transactional claim binds the immutable intake to an
operation and processing lease. The same worker may resume, a different worker
receives `busy` while the lease is live, and an expired-lease takeover increments
the fencing epoch so the previous owner can no longer finish. Exact terminal
state replays without invoking planning or rewriting artifacts. Preview and
stage therefore persist `requested -> processing -> completed|failed` with a
stable typed summary and no raw internal error message. This repository is not
wired to the legacy runtime trigger.

### 4.8.c `shiftPlanningCandidates/{bundleId}`

The local backend repository persists a versioned two-subplan staged-candidate
header plus one immutable inspection document per planned public shift under
`positions/{shiftId}`. A market document keeps its three ordered assignment
positions together. This partition is outside the public `shifts` projection,
Sheets export, and ordinary member queries. Strict Rules allow active linked
admins to read/get/list only the candidate header and its `positions`
subcollection; every client, including admins, is denied create, update, and
delete. Only trusted backend code may write them.

The pure contract and private repository enforce this artifact chain:

1. `preview` produces a digest-bound receipt containing its request and bundle
   identity, environment, requester, and `expectedStateDigest`. Completing
   preview atomically persists the immutable bundle plus that receipt and the
   terminal lifecycle. After claim, the lifecycle reads maintenance plus both
   rotations coherently. Artifact schema v2 stores that complete normalized
   read-set and its authoritative digest in the bundle's `expectedState`; the
   receipt retains only the transitive digest. Preview accepts either open or
   closed maintenance for inspection.
2. `stage` must receive that exact persisted preview receipt. It loads the
   persisted preview before a fresh authoritative-state
   read, and the resolved bundle must bind exactly that read-set. Stage requires
   closed maintenance and the same state as preview; maintenance entry therefore
   invalidates an open-state preview and requires a new closed-state preview.
   The repository reloads the source preview and bundle, then atomically
   terminalizes the existing request/operation and creates without overwrite one
   `status = staged` header plus every inspection position. The header contains source
   preview/stage IDs, preview-receipt digest, expected-state digest, bundle
   revision/digest, exact document/assignment counts, and `positionSetDigest`.
   It contains no transaction measurement because the activation/recovery
   request/operation IDs,
   before-images, and opaque transaction token do not exist yet. Each child carries its canonical payload,
   `positionDigest`, `candidateDigest`, and candidate/bundle lineage. Exact replay
   verifies missing, extra, aliased, or altered children and never rewrites them.
3. The current `activate` boundary is read-only preflight. It loads and verifies
   the persisted staged candidate, its immutable preview bundle, and the complete
   position set against `candidateId`, both artifact digests, bundle lineage,
   counts, and set/position digests. It does not claim or
   complete the request and performs no write. The immutable preview bundle
   remains the planning authority; positions are a queryable inspection
   projection, not a second authority. The future runtime caller must recompute
   and revalidate the live input snapshot and bundle digest before any CAS or
   public activation.

The planner remains side-effect free. The local/emulator repository proves
private receipt, bundle, lifecycle, candidate-header, and inspection-position
persistence. A separate local forward materializer now builds and seals the exact
activation mutation set, but the repository/runtime does not yet load every live
fairness input or execute the production publication CAS.
Bundle, receipt, and candidate use internal artifact schema v2 and
`bundle-v2-*` revisions. Transaction measurements use their own internal schema
v1. The request remains `schemaVersion = 2`; the public wire terminal summary
remains `schemaVersion = 1`.

The staged candidate is immutable and is not updated, restored, or captured as a
before-image by either direction. Future activation request and operation records
are also excluded from staged before-image targets; their terminal lifecycle is
owned by the attempt that creates/claims them. Stage rejects any supplied
`transactionEvidence` instead of persisting a synthetic future measurement.

The pinned adapter `firestore-grpc-v1-fs8.7.0-r1` serializes the actual
canonically ordered `WriteBatch` of one completely resolved attempt only after
its real transaction token is available. Its transaction-attempt boundary now
requires completed authoritative reads and the empty internal batch owned by the
same pinned SDK `Transaction`, then canonically populates, measures, and seals
that batch. Firestore commits that same inspected object after the callback.
Successful measurement replaces the SDK operation closures with detached copies
of the measured `Write` protos and makes operation storage adapter-owned. The
commit guard uses a detached measured-token copy and reserializes the full request
immediately before transport; a different token or byte sequence fails closed.
SDK reset clears that authority, so every retried callback must resolve and
measure again. Each immutable
in-memory measurement binds `direction`,
`manifestDigest`, database name, `writeSetDigest`, `commitRequestDigest`,
`documentWriteCount`, `fieldTransformCount`,
`maximumFieldTransformsPerDocument`, `requestByteCount`, `adapterRevision`, and
`indexConfigurationDigest`; the opaque token is never returned or persisted.
The request digest also remains in memory because persisting it inside the same
measured request would make the digest self-referential. An immutable attempt
outcome therefore requires a separate non-circular persistence protocol.
The conservative HU-082 gate is 500 combined planned document writes and field
transforms, no more than 500 transforms on one document, plus 10 MiB per exact
protobuf `CommitRequest`. The pure budget remains structural until activation or
recovery has resolved every ID, payload, precondition, and before-image.
Measurement authority remains part of the fairness snapshot and exact
expected-state envelope, so authority/read-set drift invalidates the candidate.
The index digest binds the audited configuration but protobuf bytes do not include
backend index-entry accounting; the separately governed isolated-clone rehearsal
remains mandatory before production activation.

Other digest-bound pure bundle invariants are:

- `futureProjectionOccupancy` is independent per type and contains exact
  `{ seasonStartYear, occupiedPositionCount, lineageRevision, lineageDigest }`
  entries. It advances over already complete future projections and rejects
  overlap, duplicate seasons, invalid capacity, or missing lineage.
- A migration baseline is either absent everywhere or the exact same
  `revision`/`digest` at bundle, delivery rotation, and market rotation scope.
- Until HU-084 defines exact credit transitions, the credit ledger must be
  disabled with zero planned transitions; every other value fails closed.
- Activation freezes a typed cohort only when its boundary-active round remains
  incomplete. A frozen cohort must preserve its ordered cursor cohort; live
  eligibility drift may be inspected by preview but blocks stage and activate.
- The bundle carries digest-bound forward and inverse manifests. The inverse
  recovery manifest names created paths to delete, target paths whose persisted
  before-images must be restored, before-image contract digests, required active
  bundle/write-epoch CAS, and a strictly higher recovery epoch that is never
  reused or decremented. The immutable bundle persisted by preview predates
  activation and remains outside both write-sets: it is retained as replay
  evidence and is never updated, restored, or deleted.
- Both manifests carry `expectedStateDigest` and
  `expectedAuthoritativeDigest`. The forward manifest records the maintenance
  `stateRevision` and `writeEpoch` transition. The before-image contract for
  `shiftPlanningState/current` covers the complete maintenance document.

### 4.8.d HU-082 backend-only planning collections

The following collection names are frozen for the private control plane:

- `shiftPlanningState`: `current` holds maintenance state, monotonic
  `writeEpoch`, and paired active-lineage keys `activeRevision`/`activeDigest`.
- `shiftRotations`: independent versioned delivery and market rotation aggregates.
- `shiftRotationMappings`: administrator-reviewed bootstrap/migration evidence.
- `shiftPlanningBundles`: immutable bundle metadata, manifests, budgets, and lineage.
- `shiftPlanningSyncCommands`: backend-owned Sheets commands bound to
  workbook/revision, partition/state revision, expected and command partition
  epochs, and a claim lease intent.
- `shiftPlanningNotificationIntents`: one held generic intent per assignment
  position, bound to recipient UID, shift identity, and expected assignment,
  membership, eligibility, and destination revisions.
- `shiftPlanningOperations`: idempotency/audit records plus recovery paths,
  including the implemented request claim/lease/fencing lifecycle; future
  operation records also carry recovery paths, persisted before-image
  references/digests, active CAS, and monotonic recovery epoch.

Publication codec v1 additionally freezes an activation terminal at
`shiftPlanningOperations/{operationId}` with `operationKind = activation` and
`state = committed`. It binds environment, request/candidate/bundle lineage,
forward-manifest and expected-state digests, write epoch, callback
`attemptedAt`, a target-sorted public-mutation manifest, contiguous before-image
bindings, and `operationIntentDigest`. `attemptedAt` is the trusted callback
clock sample rather than a server acknowledgement timestamp; the terminal
document exists only if the same atomic transaction committed.

Each persisted `beforeImages/{ordinal}` document binds its operation, bundle,
manifest, epoch, contiguous ordinal, target/envelope paths, target snapshot
update time, capture-contract digest, encoded payload digest, and envelope
digest. Codec `firestore-value-v1` losslessly tags Firestore maps, arrays,
null/boolean/finite-number/string scalars, `Timestamp`, bytes, and `GeoPoint`.
Sentinels, references, dates/class instances, cycles, accessors, sparse/extra
array properties, symbol/hidden map properties, and unsupported values fail
closed. `targetUpdateTime` binds the snapshot captured by activation; recovery
decodes only a revalidated envelope and uses the target's new transaction-read
`lastUpdateTime` for its restore CAS/precondition.

The forward materializer requires a complete live activate result whose
persisted-artifact digest matches the staged bundle/candidate/position set. It
creates every flat public shift, optionally updates only the guarded predecessor
helper, advances both rotations and active state, completes the request, creates
the two sync commands, held intents, before-images, and the activation terminal.
Every update uses its transaction-read `lastUpdateTime`; the complete mutation
set must equal the forward budget and inverse create manifest before the pinned
attempt adapter measures and seals it. Emulator evidence is local only: runtime
loading and production activation remain pending.

The inverse materializer re-digests the bundle/manifest and validates the
activation terminal, completed request, contiguous before-images, unchanged
created targets, exact active bundle/write-epoch CAS, and both sealed release
leases. It deletes activation creates and restores all before-image targets with
their current transaction `lastUpdateTime`. Restoration returns the prior active
business lineage while advancing one fresh recovery epoch and monotonically
incrementing aggregate revisions; both release leases clear. Exact replacement
sets every retained top-level value (thereby replacing nested maps) and attaches
delete sentinels for current top-level fields absent from the desired restored
document. The operation record becomes `operationKind = activationRecovery`,
`state = committed`, with forward/inverse manifest bindings, activation/recovery
epochs, deleted paths, before-image bindings, restored lineage, and a
non-self-referential `recoveryIntentDigest`. Before-images and the completed
activation request remain; the request write is a guarded historical-terminal
touch, not a claim that recovery never occurred. The exact inverse budget is
measured/sealed by the pinned adapter and proven locally in the Firestore
emulator. The local transaction-scoped resolver now reloads the live source,
staged package, authoritative state/rotations, and before-image targets for each
forward retry; the inverse resolver reloads every recovery target.

After a measured forward or inverse transaction returns successfully, the local
outcome protocol creates
`shiftPlanningOperations/{operationId}/attemptOutcomes/{attemptId}`. The stable
`attemptId` is `{direction}-{commitRequestDigestHex}`. Schema v1 requires
`operationKind = planningTransactionAttemptOutcome`, `state = committed`, and
`acknowledgement = transactionReturned`; it binds environment, operation intent,
bundle revision/digest, write epoch, direction, post-return `recordedAt`, the
complete exact measurement, `measurementDigest`, and `outcomeDigest`. It stores
neither the opaque transaction token nor a claim of lower-level transport
acknowledgement.

The backend repository creates the outcome without overwrite in a separate
transaction. A new outcome must match the current activation or recovery
terminal, including intent, bundle, epoch, and direction-specific manifest.
Exact retries converge on the immutable document and an independent read-back
revalidates its path, key, fields, and digests. An already retained exact forward
outcome remains valid historical evidence after the parent terminal transitions
to recovery. The local CAS runtime invokes the resolver inside every Firestore
retry and retains only the outcome belonging to the attempt returned by
`runTransaction`. It replays an exact existing directional outcome without
another CAS and fails closed if a committed terminal has lost that evidence.
`shiftPlanningState/fairness` is the backend-only live-source envelope. Schema
v1 contains `environment`, `sourceRevision`, `inputs`, and `sourceDigest`.
`inputs` exactly contains the normalized fairness snapshot, delivery and market
boundary/occupancy inputs, and the conservative write limit. The nested snapshot
retains membership/roster, rotation, config/policy/calendar, override,
credit-ledger, workbook-partition, measurement-authority, and migration-baseline
versions. The envelope is re-digested before planning; any valid live drift must
recompute a different bundle and fail the staged candidate binding without
writing. The governed producer that refreshes this envelope from real sources
is now implemented locally. It transactionally reads bounded `users` and
per-eligible-member `devices` projections, `config/global`, bounded
`deliveryCalendar`, maintenance, both rotations, and
`shiftPlanningState/sourcePolicy`. It excludes authentication-only member
metadata, hashes notification credentials instead of copying them, derives
stable per-member membership/eligibility/destination revisions, and creates or
replaces `fairness` only after every source validates. Exact replay performs no
write; an invalid or over-limit source leaves the preceding envelope intact.
The concrete forward resolver requires a live-source rebuilder and compares its
same-transaction digest with the cached envelope during every Firestore retry;
underlying drift therefore fails before any activation mutation even when
`fairness` itself was not refreshed. The local `index.ts` trigger now classifies
unversioned requests as legacy and routes every declared schema-v2 request away
from that writer. Preview/stage use a read-only same-source comparison before
private lifecycle persistence; activate enters the governed CAS directly so an
exact terminal replay does not depend on an out-of-transaction preflight. The
inverse recovery port is composed but remains unexported until its IAM-only,
maintenance-allowlisted command boundary is implemented. Nothing is deployed.

`shiftPlanningState/sourcePolicy` is the backend-only schema-v1 authority for
inputs that cannot be inferred safely from application collections. It exactly
contains `environment`, `policyRevision`, delivery and market continuity/
prefix/occupancy inputs, release-lease duration, the disabled HU-084 credit
ledger, workbook partitions and sync/measurement authority, and the conservative
transaction write limit. It is an input to the producer, never a client or
derived-cache contract.

All seven collections are backend-only: strict Rules deny every client read and
write, including admin clients. Their internal field schemas are not a mobile
contract in this cut.

The implemented local state repository treats these exact documents as one
authoritative CAS read-set:

- `shiftPlanningState/current` contains `schemaVersion`, monotonic
  `stateRevision` and `writeEpoch`, `maintenanceStatus`, paired
  `activeRevision`/`activeDigest`, `intakeBarrier`, and `lastTransitionId`.
  `open` requires a null barrier; `closed` requires exact verified barrier
  evidence (`revision`, `digest`, `verifiedAtMillis`).
- `shiftPlanningState/fairness` contains the exact schema-v1 live-source
  envelope and digest that preview/stage must use and every activation retry
  re-reads. It is not a client contract or an independently trusted cache: the
  governed producer rebuilds it from the real sources.
- `shiftPlanningState/sourcePolicy` contains the exact backend-owned non-derived
  inputs consumed while rebuilding `fairness`; malformed, mismatched, or
  unsupported policy fails closed.
- `shiftRotations/delivery` and `shiftRotations/market` contain the exact typed
  aggregate, cursor, planning frontier, frozen-cohort state, paired active
  lineage, last idempotency key, migration baseline, and optional release lease.
  Both aggregates must match the global active lineage and each other's
  migration baseline. The cohort is frozen exactly while its cursor is inside a
  round; a round-boundary cursor requires `cohortFrozen = false` and an empty
  frozen snapshot.
- `shiftPlanningOperations/state-{transitionId}` stores immutable terminal
  schema-v2 evidence for maintenance entry or pre-activation abort, including the exact
  rotations needed to recompute both authoritative digests. A maintenance-entry
  intent also stores `intakeBarrierExpiresAtMillis`; this field belongs to the
  immutable operation, not to `shiftPlanningState/current`. The operation stores
  the trusted transaction-callback clock sample as `attemptedAt`; this local,
  runtime-disconnected flow has no deployed v1 operation state to migrate. An exact retry
  replays its original result; an ID reused for another intent or altered digest
  evidence fails closed.
- `shiftPlanningOperations/barrier-evidence-{transitionId}` stores the complete immutable
  intake-barrier evidence envelope under the stable environment and transition key.
  Its exact schema-v1 wrapper is `schemaVersion`,
  `operationKind = intakeBarrierEvidence`, `environment`, `transitionId`,
  `evidence`, `evidenceDigest`, and Firestore `retainedAt`. That timestamp must
  be millisecond-exact, non-negative, and no earlier than the packet's
  `verifiedAtMillis`.
- `shiftPlanningOperations/barrier-failure-{transitionId}` stores one immutable
  failed-closure incident with
  `operationKind = intakeBarrierFailureClosure`. It binds the environment and
  transition to the exact `scopeDigest`, `holdRevision`, `checkpointDigest`, and
  failure `phase`; it also records Firestore `failedAt` and the canonical
  `failureDigest`. The domain read-back derives `failedAtMillis` from that exact
  timestamp and retains no raw exception text.

The fixed `barrier-evidence-` and `barrier-failure-` namespaces are disjoint, so
no accepted transition ID can alias an evidence document to another
transition's failure closure.

Both barrier records use create-or-exact-replay semantics. A retry with the same
canonical evidence or closure intent reads back the original record without
updating its retention/failure instant. Reusing the stable key with another
digest or binding, or finding a malformed or digest/binding-tampered record,
fails closed without overwrite, repair, or early deletion. Every successful
create or replay is followed by an exact Firestore read-back. The backend-only
IAM boundary remains responsible for protecting the audit timestamps themselves;
the repository also compares the complete transaction result, including its
timestamp, with the immediate post-transaction read-back.

This freezes only the local/emulator persistence contract and the incident
journal used by the production-shaped adapter. It does not prove a live Rules,
IAM, Functions/Eventarc, Drive, Workspace, queue, editor, or workbook fence; it
does not authorize a deployment and exposes no reopening capability. Governed
live implementations, wiring, and read-back evidence remain pending.

Local maintenance entry and pre-activation abort each update only `current` and
create one operation record in a transaction. Both revisions advance exactly
once, active lineage is preserved, and abort clears the current barrier so new
entry requires new evidence; the immutable operation retains the prior proof.
Abort also requires the exact persisted entry operation still to own the current
read-set and both rotation release leases to be null. A terminal abort replay
revalidates both conditions against persisted evidence before returning.
This state transition does not verify or reopen the external Rules/IAM fence.
The entry transaction admits an attempt only when
`verifiedAtMillis <= attemptedAtMillis <= intakeBarrierExpiresAtMillis`.
`attemptedAtMillis` is not the physical Firestore server commit time. The
external adapter must keep every fence held until the transaction resolves, so
commit latency cannot reopen an intake gap.
A raw repository entry replay remains historical evidence; the barrier
coordinator accepts it only after reloading authoritative state and proving its
after-digest is still current, maintenance remains closed, `lastTransitionId`
matches, and the compact barrier is unchanged.
The coordinator looks up terminal evidence before enforcing freshness: a missing
operation requires a fresh packet, while an exact terminal operation may replay
after expiry only by reading the already-retained full envelope. It never
recreates missing historical evidence.
Missing state is invalid and is never initialized or repaired implicitly.

The same SDK-free normalizer supplies the bundle boundary. The bundle requires
the legacy fairness rotation fields to equal both authoritative aggregates
canonically, and persists the complete authoritative envelope plus measurement
authority in schema-v2 `expectedState`. Barrier/status/revision/transition drift
or any rotation aggregate drift changes the state and manifest digests. Preview
receipts and staged candidates keep only `expectedStateDigest`, binding the same
read-set transitively without duplicating it.

Rollout state for this cut: the v2 wire parser, deterministic pure planners, and
private Firestore repositories exist as local/emulator code. The request
repository owns claim/lease/fencing/takeover/replay, atomically persists preview bundle plus
receipt, reloads persisted preview/bundle before creating a non-overwritten stage
header plus its digest-bound inspection positions, and offers a read-only
activation preflight over candidate, immutable bundle, and positions. An SDK-free
local orchestrator transactionally routes and claims preview/stage before
planning, short-circuits busy and terminal replay, loads authoritative state for
preview, reloads the exact preview and then authoritative state for stage,
rejects a resolver result bound to any other read-set, terminalizes only typed
deterministic failures, and routes activate to that no-write preflight without
creating an operation or reading state. The state repository
atomically reads maintenance plus both rotations, derives one canonical CAS
digest, and implements runtime-disconnected, idempotent maintenance entry and
abort.
Still pending and fail-closed are real byte/transform measurement, live Google
control-plane implementations and trusted intake-barrier wiring, writer
migration, bundle-bound public
activation/recovery CAS,
a v2 trigger connected to the orchestrator, sync, notification and recovery
consumers, mobile integration, deployment, and live data changes. The legacy
`onShiftPlanningRequestCreated` implementation in `functions/src/index.ts`
remains the active runtime. The local Phase 1 Rules
candidate denies all client access to the new planning control plane; the local
strict candidate allows only the exact admin request create/read and admin
candidate read boundaries above. Neither Rules change has been deployed.

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
