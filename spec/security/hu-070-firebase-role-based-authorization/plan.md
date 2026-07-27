# Plan - HU-070 (Firebase role-based authorization)

## Phase 0. Restore baseline and inventory both live trees (complete)

- The brief transition release was restored on 2026-07-26 after confirming
  published clients share this Firebase project.
- Inventory published Android/iOS requests under `<env>/collections/**`
  separately from Reguerta+ requests under `<env>/plus-collections/**`.
- Capture read/write payloads, Auth verification/link coverage, rollback, and
  observability before another Rules mutation.

## Phase 1. Firestore compatibility boundary (deployed and read back)

- `firestore.phase1.rules` is live in `reguerta-9f27f`: eight observed legacy
  prefixes are authenticated read/write, unknown legacy roots are denied, and
  `plus-collections` retains its previous authenticated contract plus HU-045.
- Strict `plus-collections` authorization is not deployed.
- Live Storage remains global authenticated read/write. `storage.phase1.rules`
  is a semantic rollback copy, not a restricted live policy.

## Phase 2. Resolve admin bootstrap (completed)

- The owner authorized verification of the seven matching admin Auth accounts;
  read-back succeeded. The applied identity backfill now provides 7 linked
  admins in develop and 3 in production.
- Retain the two exact non-Auth UI-test fixtures in develop only; never create
  links or a Rules bypass for them.

## Phase 3. Additive backend and strict Rules (pending)

- Deploy only an explicitly reviewed Function allowlist through
  `firebase.functions.json`; preserve legacy GET contracts and never deploy all
  Functions as a blanket target.
- The guarded `authLinks` backfill is applied and verified at 22 links in
  develop and 16 in production. Apply `memberDirectory`, `config/public`,
  `config/member`, and notification inbox backfills only after their own fresh
  dry-runs and explicit rollout approval.
- Let the 27 remaining matching Auth accounts self-verify from Reguerta+ and
  confirm link adoption before strict cutover.
- Validate `HEAD + new`, then deploy Firestore and Storage separately through
  `firebase.strict.json` and read each service back.
- Strict Storage candidate: legacy `products/**` allows authenticated
  get/create/update and denies list/delete; Reguerta+ image paths allow linked
  get and role/owner create/update/delete, require JPEG <= 2 MiB for
  create/update, and deny list.

## Phase 4. Adoption and legacy debt removal (pending)

- Publish and measure updated-client adoption.
- Verify/link legacy identities, migrate legacy Storage objects, audit tokenized
  download URLs, and retire compatibility grants only after evidence is green.
