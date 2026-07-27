# Tasks - HU-070 (Firebase role-based authorization)

## Workflow

- [x] Reuse/search existing work and open GitHub issue #198.
- [x] Create branch `codex/198-firebase-role-authorization`.
- [x] Record the security architecture in English and Spanish ADRs.

## Backend

- [x] Add verified bearer-token and active-member authorization helpers.
- [x] Make first link transactional and server-owned.
- [x] Move admin member management to a verified backend transaction.
- [x] Protect all mutating HTTP Functions in the candidate source.
- [x] Apply final shift swaps transactionally.
- [x] Materialize per-member notification inboxes and provide a backfill.
- [x] Materialize the PII-free member directory and provide a backfill.
- [x] Add dry-run/apply migration scripts for links, public/member config,
      directory, and inbox.

## Android and iOS

- [x] Resolve sessions through the authenticated backend with parity.
- [x] Require verified email before first authorization.
- [x] Remove runtime demo fallback and permission-error swallowing.
- [x] Align queries and sensitive mutations with strict Rules.
- [x] Move startup version reads to `config/public`.
- [x] Move operational config reads to `config/member` and member listing to
      `memberDirectory` with Android/iOS parity.

## Rules and tests

- [x] Add explicit strict candidate `plus-collections` role/ownership rules.
- [x] Preserve Phase 1 authenticated read/write compatibility only under
      the eight observed live prefixes in `develop/collections` and
      `production/collections`.
- [x] Deny unknown/future prefixes under both legacy environment trees.
- [x] Add strict Storage candidate namespace, role, JPEG, and size rules without
      breaking published-app paths.
- [x] In strict Storage candidate, allow legacy `products/**`
      get/create/update and deny list/delete.
- [x] Test linked-role get/create/update/delete, JPEG <= 2 MiB for
      create/update, and denied list for every
      Reguerta+ image namespace.
- [x] Complete separate legacy and Reguerta+ allow/deny matrices.
- [x] Test both develop and production prefixes.
- [x] Run all backend/rules/platform validations.

## Phase 0 live safety

- [x] Restore previous Rules after the brief transition release exposed the
      shared live-client dependency.
- [x] Verify target project and deployed baseline immediately before each
      mutation.
- [x] Inventory every published `collections` read/write payload and confirm
      current Auth verification/link coverage.

## Phase 1 live boundary and admin blocker

- [x] Deploy Firestore Phase 1 and verify deployed Rules read-back.
- [x] Verify live Storage remains global authenticated read/write and retain
      `storage.phase1.rules` as semantic rollback.
- [x] Run the initial identity dry-run: 7 active admins in develop, 3 in
      production, and zero operationally linked admins due to unverified Auth
      matches at that checkpoint.
- [x] Audit live order identity without writes: 1,893 documents per environment,
      historical IDs throughout, and 27 duplicated owner-week pairs no later
      than `2026-W27`.
- [x] Audit live order-line ownership without writes: 8,572 documents per
      environment, all with `userId`, `orderId`, and `weekKey`, no contradictory
      aliases, and two owner-week pairs split across historical order IDs.
- [x] Obtain owner decision for safe admin bootstrap and verify/read back the
      seven matching Auth accounts (three shared with production).
- [x] Repeat identity dry-run: admin projection is now 7 develop / 3 production;
      identify the two missing-Auth UIDs as intentional develop UI-test
      fixtures and retain only their exact pairs in the migration candidate.
- [x] Isolate iOS `-useMockAuth` from live repositories and FCM/device writes;
      do not add any Rules exception for mock UIDs.
- [ ] Let the 27 remaining matching Auth accounts self-verify through Reguerta+
      and verify their links before strict cutover.
- [ ] Deploy an explicitly reviewed Function allowlist after unblock.
- [x] Apply the guarded `authLinks` backfill after a fresh dry-run: 22 links and
      7 linked admins in develop; 16 links and 3 linked admins in production;
      zero post-run operations and both develop fixtures retained.
- [ ] Apply the directory, public/member config, and inbox backfills only after
      their own fresh dry-runs and explicit rollout approval.

## Strict rollout after unblock

- [ ] Pass `HEAD + new` compatibility tests for both trees, environments,
      actors, and workflows.
- [ ] Deploy strict Firestore Rules separately and verify read-back.
- [ ] Deploy strict Storage Rules separately and verify read-back.
- [ ] Run live role smoke checks and record rollback evidence.

## Phases 3-4 adoption and debt removal

- [ ] Publish updated Android/iOS builds and prove adoption before forcing the
      minimum supported version.
- [ ] Verify/backfill legacy identities and replace authenticated-wide
      `collections` access with a proven role matrix or retire the tree.
- [ ] Inventory tokenized Storage download URLs and rotate/revoke unintended
      bearer access during legacy object migration.
