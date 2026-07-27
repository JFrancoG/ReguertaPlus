# [HU-070] Aplicar autorizacion Firebase por roles

GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/198

## Outcome

Apply least-privilege authorization to Firestore, Storage, and mutating HTTP
Functions using the same canonical role matrix in develop and production,
without interrupting the published apps that still use the separate legacy
`collections` tree.

## Links

- Spec: `spec/security/hu-070-firebase-role-based-authorization/spec.md`
- Plan: `spec/security/hu-070-firebase-role-based-authorization/plan.md`
- Tasks: `spec/security/hu-070-firebase-role-based-authorization/tasks.md`
- ADR: `docs/decisions/0007-firebase-role-based-authorization.md`

## Acceptance criteria

- Server-owned UID links resolve only active canonical members.
- Mutating Functions verify Firebase ID tokens and required roles.
- `plus-collections` denies by default and enforces role/ownership boundaries.
- `collections` temporarily preserves authenticated read/write compatibility
  for the eight observed live prefixes in both environments and cannot
  authorize plus, future legacy, or unknown paths.
- Strict Storage candidate preserves legacy `products/**` get/create/update,
  denies list/delete, and applies linked-role get plus role/owner
  create/update/delete to Reguerta+ images; create/update require JPEG <= 2 MiB.
- Android and iOS use compatible authenticated flows and fail closed.
- Emulator tests cover every supported actor and both Firestore trees in
  develop and production.
- Backfill and scoped deployment to `reguerta-9f27f` are verified and reversible.
- Legacy least privilege remains tracked debt until accounts are verified,
  identity is backfilled, and published clients migrate.

## Current rollout state

Firestore Phase 1 is deployed and read back: eight legacy prefixes remain
authenticated and Reguerta+ retains its previous authenticated contract. Strict
Firestore is not deployed. Storage live remains global authenticated read/write;
`storage.phase1.rules` is a semantic rollback and strict Storage is not deployed.

The guarded identity backfill is applied and verified: develop has 22
`authLinks` and 7 linked active admins; production has 16 `authLinks` and 3
linked active admins. Both post-run plans report zero pending operations, and
the two exact develop UI-test fixtures remain untouched. The 27 remaining Auth
accounts will self-verify through Reguerta+. Candidate Functions, the remaining
backfills, and both strict deployments remain pending adoption and explicit
rollout approval.
