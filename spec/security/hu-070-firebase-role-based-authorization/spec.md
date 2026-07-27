# HU-070 - Firebase role-based authorization

## Metadata

- issue_id: #198
- priority: P1
- platform: cross + backend
- status: in_progress

## Context and problem

Authenticated Firebase accounts currently receive broad Firestore and Storage
access, while public HTTP Functions use Admin SDK and therefore bypass Security
Rules. Member documents use internal IDs instead of Firebase UIDs, so Rules
need a deterministic server-owned identity link before roles can be enforced.

The same Firebase project serves two live Firestore trees in both environments:

- currently published apps use `<env>/collections/**`;
- Reguerta+ uses `<env>/plus-collections/**`.

The brief transition Rules release was restored after this dependency was
identified. Firestore Phase 1 was subsequently deployed and read back: it
enumerates the eight authenticated legacy prefixes while retaining the prior
authenticated `plus-collections` contract. Strict plus authorization is not
deployed. Storage live still has global authenticated read/write Rules.

## User story

As the association, we want every Firebase operation authorized from the active
member and canonical role matrix so each member, producer, common-purchase
manager, and admin can access only the data and mutations required by that role.

## Scope

### In scope

- Server-owned `authLinks/{uid}` identity index in develop and production.
- Separate, explicit Rules matrices for `collections` and `plus-collections`.
- Temporary authenticated read/write compatibility for the live legacy
  `collections` tree's eight observed prefixes, contained so it cannot authorize
  any plus, future legacy, or unknown path.
- Verified-token first link and active-member resolution.
- Token/role protection for every mutating HTTP Function.
- Backend transaction for sensitive multi-document workflows.
- Firestore and Storage Rules with deny-by-default fallback.
- Strict Storage candidate: authenticated legacy `products/**`
  get/create/update with list/delete denied, plus linked-role Reguerta+
  `{env}/images/{products|news|shared_profiles}/...` get and role/owner
  create/update/delete; create/update require JPEG <= 2 MiB and list is denied.
- Android/iOS compatibility, fail-closed persistence, and query alignment.
- Backend-materialized per-member notification inboxes for secure feed queries.
- PII-free `memberDirectory`, anonymous `config/public`, active-member
  `config/member`, and private `config/global` in `plus-collections`.
- Emulator tests, controlled backfill, scoped deploys, verification, rollback.

### Out of scope

- New business roles or a reviewer role persisted in `users.roles`.
- Different permission policies for develop and production.
- Re-keying member documents to Firebase Auth UIDs.
- Moving checkout price calculation to backend unless required by this rollout.
- Claiming role-aware least privilege for `collections` before verification and
  deterministic identity backfill are complete.

## Canonical actor contract

| Actor | Additional permissions beyond active member |
| --- | --- |
| Member | Own orders/lines, device/read state/profile, active common content |
| Producer | Own catalog, own received lines/orders, own producer status |
| Common-purchase manager | Own catalog capability without producer role |
| Admin | Members through backend, news/broadcasts, calendar/planning/support |
| Reviewer | No persisted role; routed dataset plus the member's real roles |
| System | Admin SDK triggers/jobs after endpoint or event authorization |

## Acceptance criteria

- Anonymous users can read only the minimal public startup config.
- In `plus-collections`, unlinked and inactive Firebase accounts cannot access
  operational data.
- In `collections`, only authenticated users retain temporary broad read/write
  compatibility under `config`, `containers`, `measures`, `news`, `orderLines`,
  `orders`, `products`, and `users`; every other prefix is denied.
- Clients cannot write identity links, roles, activity, or arbitrary member data.
- Active non-admin Reguerta+ members read member discovery only through
  `memberDirectory`; full `users` and `config/global` are owner/admin and
  backend/admin scoped respectively, while safe operations use `config/member`.
- Product ownership is immutable and catalog writes require the declared
  producer/manager capability.
- Order and order-line access is owner/vendor/admin scoped; producer status
  updates can mutate only the caller's vendor entry.
- Admin invariants and shift application are transactional backend operations.
- Mutating HTTP endpoints reject missing/invalid tokens and insufficient roles.
- Under the strict candidate, Storage legacy `products/**` allows authenticated
  get/create/update and denies list/delete. Reguerta+ image paths allow linked
  get plus role/owner create/update/delete; create/update require JPEG <= 2 MiB,
  list is denied, and every other path is denied.
- Develop and production execute the same allow/deny matrix.
- Emulator and platform tests cover representative positive and negative cases
  for both Firestore trees and both environment prefixes.
- Backfill and deployment run against `reguerta-9f27f` with count-only evidence
  and an explicit rollback path.

## Dependencies

- Canonical role matrix: `spec/app/hu-044-canonical-role-permission-matrix-and-test-fixtures/role-permission-matrix.v1.json`
- ADR: `docs/decisions/0007-firebase-role-based-authorization.md`
- GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/198

## Risks

- Strict rules reject legacy broad queries and old direct-write workflows.
- The legacy tree remains broad for authenticated accounts until verification,
  identity backfill, client migration, and a separate payload matrix complete.
  Isolation contains but does not eliminate this confidentiality/integrity debt.
- Existing tester accounts may not have verified email; linked accounts require
  backfill before strict rules, while only new links require token verification.
- Cross-service Storage authorization adds Firestore Rules reads and IAM setup.
- Legacy Storage objects lack reliable ownership metadata, so `products/**`
  remains authenticated-wide debt until objects and published clients migrate.
- Previously issued tokenized Storage download URLs are not re-evaluated by
  Rules and remain a separate bearer-link exposure until audited and rotated or
  revoked where appropriate.
- Admin SDK remains privileged, making endpoint and trigger review mandatory.

## Current rollout state and blocker

- Firestore Phase 1 is deployed and read back; Firestore strict is not deployed.
- Storage live remains global authenticated read/write. `storage.phase1.rules`
  is its semantic rollback; Storage strict is not deployed.
- `firebase.json` and `firebase.phase1.json` select Phase 1 Rules,
  `firebase.strict.json` selects strict candidates, and
  `firebase.functions.json` isolates Functions source.
- The initial identity dry-run found 7 active admins in develop and 3 in
  production but zero operationally linked admins. The owner later authorized
  verification of the seven matching admin Auth accounts; read-back and the
  repeated dry-run resolve that bootstrap gate at 7 develop / 3 production.
- A read-only order audit found 1,893 documents in each environment, all with
  `userId` and `weekKey` but historical non-deterministic IDs. Twenty-seven
  owner-week pairs are duplicated, all no later than `2026-W27`. Candidate
  clients update the unique historical document, create a deterministic ID only
  for an empty owner-week query, and reject ambiguous writes.
- The order-line audit found 8,572 documents in each environment, all carrying
  `userId`, `orderId`, and `weekKey`, with no member-only or contradictory owner
  aliases. Two owner-week pairs span two historical order IDs; read-only client
  summaries aggregate their lines and documented totals without weakening the
  checkout ambiguity guard.
- On 2026-07-27, the owner authorized and the migration operator applied
  `emailVerified = true` to the seven Auth accounts matching active develop
  admins; the three production admins use the same accounts. Read-back verified
  7/7 enabled accounts. The subsequent dry-run projects 7 linked admins in
  develop and 3 in production. The two values initially counted as missing-Auth
  UIDs are intentional non-Auth UI-test fixtures in develop. The migration plan
  retains only their exact member/UID pairs without writes, links, production
  handling, or a Rules exception.
- The owner then authorized the exact guarded Firestore plan. It applied 27
  user updates plus 22 `authLinks` in develop and 21 user updates plus 16
  `authLinks` in production. Post-run verification reports zero conflicts, zero
  pending shape writes, zero planned operations, 7/7 linked active admins in
  develop, and 3/3 in production. Firebase Auth was not changed by this
  backfill; 27 accounts remain unverified and will self-verify in Reguerta+.
  Candidate Functions, the remaining backfills, and strict Rules remain
  undeployed pending adoption.

## Definition of Done

- [x] Backend and migration tests pass.
- [x] Firestore and Storage emulator matrices pass.
- [x] The dual-tree matrix proves strict `plus-collections`, authenticated
      legacy compatibility, and deny-by-default outside both trees.
- [x] Android unit/lint validation passes.
- [x] iOS build/tests pass through the repository-approved Xcode tooling.
- [ ] Dry-run and applied migration counts are verified.
- [ ] Scoped Functions, Firestore Rules, and Storage Rules deploys succeed; no
      deployment is inferred from source or emulator state.
- [ ] Live role smoke checks and deployed Rules read-back succeed.
- [x] Android/iOS parity and any legacy-build impact are reported.
