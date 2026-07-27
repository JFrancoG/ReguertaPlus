# ADR-0007: Enforce Firebase Authorization Through Server-Owned Identity Links

## Status

Accepted - Phase 1 live; strict cutover pending identity adoption

## Date

2026-07-26

## Context

Reguerta stores members under stable internal IDs, while Firebase Authentication
identifies sessions with a UID. Firestore Security Rules cannot query the
`users` collection to discover which internal member document has a given UID.
The previous client-side email lookup and UID link therefore could not support
deny-by-default rules. It also allowed broad authenticated access, and public
HTTP Functions using the Admin SDK could bypass any Firestore rule.

The Android and iOS apps use the same Firebase project and keep intentionally
similar `develop` and `production` datasets for tester workflows. Environment
selection is not an authorization boundary. Reviewer is a runtime routing
persona and is not a persisted business role.

That Firebase project is also consumed by the Android and iOS binaries that are
currently published and in active use. A Rules release therefore affects old
and new clients immediately, regardless of which app build produced the
request. The inventory confirms two independent Firestore trees under both
environments: published legacy apps use `<env>/collections/**`, while Reguerta+
uses `<env>/plus-collections/**`. A secure migration must preserve every
legitimate legacy path without weakening the isolated Reguerta+ tree.

Reguerta+ `config/global` also mixed anonymous startup version information with private
operational data and reviewer allowlists. Firestore cannot return only selected
fields from a document according to the caller.

## Decision Drivers

- Resolve a Firebase UID to one canonical Reguerta+ member deterministically in
  Rules.
- Apply role and ownership checks from current Firestore state so deactivation
  and role revocation take effect without waiting for token claims to refresh.
- Close Admin SDK bypasses in every mutating HTTP Function.
- Keep the same permission matrix in `develop` and `production`.
- Preserve internal member IDs and the canonical role matrix.
- Keep startup version checks available before authentication without exposing
  private configuration.
- Make rollout and rollback auditable through emulator tests and scoped deploys.

## Considered Options

### Use the Firebase Auth UID as every `users` document ID

Rejected because stable internal member IDs are already referenced throughout
orders, products, shifts, commitments, notifications, and historical records.
Re-keying all documents would be a high-risk migration unrelated to the
authorization goal.

### Store roles only in Firebase custom claims

Rejected as the primary authorization source because claim changes remain
cached in issued ID tokens. Claims may be added later for coarse infrastructure
gates, but live member state in Firestore remains authoritative.

### Continue querying members by email from clients

Rejected because Security Rules are not filters and cannot use a query result
to resolve a caller before authorizing that same query. Email and UID linking
are security-sensitive server operations.

### Server-owned UID link plus live member document

Selected. It requires two deterministic document reads and works in both
Firestore and Storage Security Rules.

### Deploy strict Rules immediately after validating only the new clients

Rejected. Emulator success for the candidate Android and iOS implementations
does not prove that published binaries have stopped using broad `users`,
`config/global`, notification-event, or direct-write paths. Tightening those
paths inside the same live tree before client adoption would turn an
authorization improvement into a production outage. This does not prevent
strict Rules on the separate `plus-collections` tree after its own clients and
data migration pass validation.

## Decision

Firestore authorization has two explicit, non-overlapping matrices under each
environment prefix:

1. `<env>/collections/**` is the live legacy compatibility tree. Temporarily,
   its Rules preserve authenticated read/write access in both environments only
   under the eight observed top-level prefixes: `config`, `containers`,
   `measures`, `news`, `orderLines`, `orders`, `products`, and `users`, including
   their required document/subcollection paths. Unknown or future legacy
   prefixes are denied. Current member documents lack deterministic `authUid`
   links and, in the 2026-07-26 inventory, 34 of 49 Auth accounts were
   unverified. A role-aware restriction cannot safely identify every legitimate
   legacy caller today. This is explicit security debt and must not be
   represented as least privilege.
2. `<env>/plus-collections/**` is the Reguerta+ tree. Its strict target uses the
   canonical role matrix, server-owned identity links, additive projections,
   and deny-by-default Rules. That strict target is not yet deployed.

The final catch-all denies paths outside these explicit trees. Rules must never
route authorization by treating `develop` or `production` as a trust level.

For each supported environment, create:

`<env>/plus-collections/authLinks/{firebaseUid}`

The document contains only the canonical `memberId` required by authorization.
Clients may read their own link but may never create, update, delete, or list
links. Cloud Functions and controlled migration scripts own the collection.

Rules resolve the caller through `authLinks/{request.auth.uid}`, load the linked
`users/{memberId}`, and require the reciprocal `users.authUid` to match the
token UID, `isActive == true`, and the canonical `member` role for operational
access. `producer`, `admin`, and
`isCommonPurchaseManager` add only their declared capabilities. An admin does
not implicitly gain producer catalog ownership. Reviewer receives the roles of
the routed member and no Rules bypass. Debug impersonation never changes the
Firebase identity and therefore cannot authorize live writes as another member.

The first-link endpoint verifies a Firebase ID token with Admin SDK, derives
UID and email only from that token, requires a verified email for a new link,
rejects ambiguous or conflicting member records, and transactionally writes
both `users.authUid` and `authLinks/{uid}`. Existing links remain usable after a
controlled backfill, including for already provisioned tester accounts.

The candidate implementation makes every mutating HTTP Function verify a bearer
Firebase ID token and resolve an active member. Administrative and operational
endpoints additionally require the `admin` role. Caller UID, email, role, and
member ID supplied in a request body are never authoritative. Multi-document
invariants such as preventing zero active admins and applying shift swaps are
enforced transactionally in backend code because Security Rules cannot aggregate
or safely validate those workflows. These Function changes are not deployed.

Within `plus-collections`, Firestore Rules deny unknown collections and grant
reads/writes per role, ownership, immutable identity fields, and constrained
field diffs. The separate explicit `collections` match retains temporary
authenticated compatibility. Storage also has two explicit matrices:

1. Legacy published apps use only `products/**`. Because those objects have no
   reliable ownership metadata, the strict candidate allows authenticated
   `get`, `create`, and `update`, but denies `list` and `delete`.
2. Reguerta+ uses
   `{env}/images/{products|news|shared_profiles}/...`. These paths use the same
   identity link and member document, allow linked active-member `get`, and
   constrain `create`, `update`, and `delete` by namespace role and owner.
   `create`/`update` accept only JPEG uploads no larger than 2 MiB. `list` is
   denied in every image namespace.

In the strict target, all other Storage paths are denied. The temporary
`products/**` grant is legacy debt and must never match or authorize the
Reguerta+ image tree.

Notification feeds use a backend-materialized inbox at
`users/{memberId}/notificationInbox/{eventId}`. Firestore cannot safely treat
Rules as a post-query filter, and a global audience query cannot prove a member
ID that Rules obtain indirectly from `authLinks`. The notification trigger
resolves the audience and writes an immutable event copy into each recipient's
inbox. Clients query only their linked member path; the global
`notificationEvents` collection remains the dispatch/audit source and is
listable only by admins.

Member discovery uses a backend-owned projection at
`memberDirectory/{memberId}`. It contains only the active member's public
operational fields: stable ID, display/company names, canonical roles, catalog
and common-purchase capabilities, producer parity, and eco-commitment. It never
contains email, phone, Firebase UID, or other private account data. Updated
clients read this projection; admins continue to govern full member records
through the authenticated backend.

Anonymous startup reads move to `<env>/plus-collections/config/public`, which
contains only the Android and iOS version policy. Active members read safe
operational values from `<env>/plus-collections/config/member`, a backend-owned
projection containing cache expiry, freshness timestamps, and delivery day.
`config/global` remains the authoritative source and may contain reviewer
allowlists and other private operations data.

Within `plus-collections`, strict Rules grant full `users` reads only to the
record owner and admins, grant active members directory access through
`memberDirectory`, and limit `config/global` to trusted backend/admin access.
Within `collections`, authenticated legacy reads and writes remain compatible
until users can be verified, identity-linked/backfilled, and updated apps are
adopted. This temporary broad access is scoped only to the eight enumerated live
prefixes and never broadens the Reguerta+ rules.

## Deployment State (2026-07-26)

- Firestore Phase 1 is deployed and was read back from `reguerta-9f27f`.
  `firestore.phase1.rules` keeps authenticated read/write for the eight observed
  legacy prefixes and preserves the prior authenticated `plus-collections`
  contract, including the HU-045 producer-status guard. It is not the strict
  HU-070 matrix.
- Live Storage still uses the previous global authenticated read/write baseline.
  `storage.phase1.rules` is a semantic rollback snapshot of that live contract;
  its more selective legacy and Reguerta+ paths are only in the undeployed
  `storage.strict.rules` candidate.
- `firebase.json` and `firebase.phase1.json` select Phase 1 Rules;
  `firebase.strict.json` selects `firestore.strict.rules` and
  `storage.strict.rules`; `firebase.functions.json` isolates Functions source.
  Config files describe targets and do not prove deployment.
- The initial 2026-07-26 identity dry-run reported 7 active admins in develop
  and 3 in production, but zero operationally linked admins because the
  matching Firebase Auth accounts were unverified. The 2026-07-27 checkpoint
  below supersedes that bootstrap snapshot.
- A read-only live audit found 1,893 orders in each environment: every document
  has `userId` and `weekKey`, none relies only on `memberId`, and every document
  retains a non-deterministic historical ID. There are 27 duplicate user-week
  pairs, all through `2026-W27` and none from `2026-W28` through `2026-W31`.
  Candidate clients resolve by owner and week, update the historical ID when
  exactly one result exists, create a deterministic ID only when none exists,
  and abort without writing when the result is ambiguous.
- The same read-only audit found 8,572 order lines in each environment. Every
  line has `userId`, `orderId`, and `weekKey`; none is `memberId`-only and no
  owner aliases conflict. Two owner-week pairs contain lines split across two
  historical order IDs. Read-only summaries merge those lines and documented
  totals, while checkout continues to reject ambiguous writes.
- At that checkpoint Functions, every backfill `--apply`, and both strict Rules
  candidates were blocked pending an explicit owner decision on admin
  bootstrap. The decision and verification are recorded below.

## Deployment Checkpoint (2026-07-27)

- The owner authorized setting `emailVerified = true` for the seven Firebase
  Auth accounts that match active admins in develop; the three production
  admins are a subset of those same accounts. All seven updates were applied
  UID by UID in `reguerta-9f27f` and independently read back as verified and
  enabled. No claims, passwords, Firestore data, Storage objects, Functions, or
  Rules changed in that operation.
- A guarded identity dry-run projected 7 linked active admins in develop and 3
  in production, resolving the admin-bootstrap gate. The two develop `authUid`
  values without Auth users are intentional UI-test fixtures, not historical
  identities: `member_admin_001` and `member_producer_001`.
- The owner authorized that exact plan. The migration applied 27 user updates
  plus 22 `authLinks` in develop and 21 user updates plus 16 `authLinks` in
  production. Post-run verification found zero conflicts, zero pending shape
  writes, zero planned operations, 7/7 linked active admins in develop, and 3/3
  in production. The two exact fixtures remained untouched and Firebase Auth
  was not modified by the backfill.
- Twenty-seven matching Auth accounts remain unverified and will self-verify
  through Reguerta+. Strict cutover remains pending verification and link
  adoption.
- `-useMockAuth` now composes the iOS UI-test environment entirely from local
  repositories and suppresses live device/FCM persistence. Rules remain strict
  for every real Firebase request; mock UIDs receive no special access.
- Phase 1 therefore remains deployed. Only the `authLinks` backfill was
  applied; directory/config/inbox backfills, candidate Functions, and strict
  Rules remain undeployed.

## Consequences

### Positive

- In `plus-collections`, unlinked, inactive, and unknown Firebase accounts fail
  closed.
- In `plus-collections`, role changes and deactivation are effective from live
  member data.
- Reguerta+ client code cannot grant itself roles or forge another member's
  identity.
- Once the candidate Functions are safely deployed, Admin SDK endpoints no
  longer bypass authorization anonymously.
- Reguerta+ Firestore and Storage share one explicit authorization model.
- Develop and production behavior remains intentionally equivalent.
- Reguerta+ public startup configuration no longer exposes reviewer or
  operational data.
- Member directory and operational configuration reads no longer expose
  account PII or private global configuration once the strict phase is active.
- Reguerta+ notification feeds no longer download events for another audience
  and filter them on the device.

### Negative

- Every authorized request can incur up to two cached Rules document reads.
- The legacy `collections` tree remains broadly readable/writable by any
  authenticated account during compatibility. Published builds rely on older
  email queries, config reads, payload aliases, and direct-write workflows, and
  the current data cannot deterministically map every Auth UID to a member.
- Path isolation contains this debt but does not remove its confidentiality and
  integrity risk. Verification, identity backfill, migration, and eventual
  retirement of the legacy tree remain mandatory follow-up work.
- Live Storage still permits global authenticated read/write, including list
  and delete. The stricter legacy `products/**` get/create/update-only contract
  remains an undeployed candidate because the objects do not carry reliable
  ownership metadata.
- Previously issued tokenized Firebase Storage download URLs are not
  re-evaluated by Security Rules. They remain a residual bearer-link risk and
  require a separate inventory plus token rotation/revocation where exposure is
  no longer intended.
- New Reguerta+ password accounts must verify their email before first
  authorization.
- Backend endpoints and migrations become part of the security-critical code
  surface and require focused tests and scoped deployment.
- Notification fan-out adds bounded write amplification and requires backfill
  for existing events.
- Storage cross-service Rules require the Firebase Rules service account to
  have permission to read the default Firestore database.

## Rollout and Rollback

### Phase 0 - Restore and inventory the live baseline (complete)

- The brief transition release was restored after identifying the published
  clients, and Firestore/Storage evidence was separated.

### Phase 1 - Isolate Firestore compatibility (deployed and read back)

- `firestore.phase1.rules` is live: eight explicit legacy prefixes remain
  authenticated read/write, unknown legacy roots are denied, and Reguerta+
  retains its previous authenticated contract rather than strict HU-070.
- Storage was not advanced. Its live global authenticated baseline remains;
  `storage.phase1.rules` is the semantic rollback target.

### Phase 2 - Resolve the admin bootstrap blocker (completed)

- Seven matching admin Auth accounts were verified and read back. The guarded
  identity backfill then created 22 links in develop and 16 in production,
  resulting in 7 linked admins in develop and 3 in production.

### Phase 3 - Additive backend and strict rollout (pending)

- The `authLinks` backfill is complete. Deploy only an explicitly reviewed
  Function allowlist, preserving legacy GET contracts, and apply the remaining
  `memberDirectory`, `config/public`, `config/member`, and inbox backfills only
  after their own dry-runs and approvals.
- Retain the two exact develop UI-test fixtures only in the migration plan, and
  let the 27 remaining Auth accounts self-verify through Reguerta+ before
  strict cutover.
- Re-run the `HEAD + new` matrix, deploy Firestore and Storage strict separately
  through `firebase.strict.json`, read back each service, and roll back on any
  legitimate denial. A blanket Functions deploy is never part of this phase.

### Phase 4 - Adoption and legacy debt removal (pending)

- Publish and measure updated-client adoption, migrate legacy identities and
  Storage objects, audit tokenized URLs, and retire compatibility grants only
  after the relevant gates pass.

## References

- [Firebase: Securely query data](https://firebase.google.com/docs/firestore/security/rules-query)
- [Firebase: Security Rules conditions](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [Firebase: Storage Rules conditions](https://firebase.google.com/docs/storage/security/rules-conditions)
- [Firebase: Verify ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- `spec/app/hu-044-canonical-role-permission-matrix-and-test-fixtures/role-permission-matrix.v1.json`
- GitHub issue #198
