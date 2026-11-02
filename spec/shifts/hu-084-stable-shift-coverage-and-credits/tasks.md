# Tasks - HU-084 (Stable shift coverage and earned credits)

> 2026-11-02 09:39 UTC: second authorized develop attempt consumed and stopped before native grant (unattended 20s queue). No writer token, maintenance or business writes. All 21 journal entries and file/IAM/OAuth cleanup verified; user quiet window released. Private launch now uses an attended start/reply interface, with no raw run/answer entry points. Correction and bilingual evidence remain local after `874146e3`; another execution needs a new receipt/authorization. See the initial-evidence window guide.

> 2026-11-02 09:06 UTC: authorized develop attempt stopped before native Sheets grant; no maintenance/business write/writer token. File/IAM/OAuth cleanup verified. Private browser-context connection corrected and checked read-only; a new dated attempt remains pending. See the initial-evidence window guide.

## Local implementation checkpoint — 2026-09-12

- [x] Maintainer authorized provisional local implementation before ratification.
- [x] Create `codex/hu-084-stable-shift-coverage-and-credits` from merged HU-083.
- [x] Implement the administrative lifecycle with transactional assignment,
  completion/credit, idempotency, membership checks and private Rules.
- [x] Add unit, emulator race/history/eligibility and client-access tests.
- [x] Add local frozen reserve FIFO, bounded volunteer registration/withdrawal,
  deterministic offers, current eligibility/claim checks and exhausted-selection
  state, reusing acceptance/completion and adding race/Rules tests.
- [x] Add local committed future-round draw, signed evidence verification, fixed
  retries, administrative offers and cancellation recovery without reroll.
- [ ] Select/ratify the real entropy provider and complete live backend integration
  (outcome group 1).
- [x] Add pure whole-unit credit/backtracking planning and atomic local
  preview/stage/consumption rehearsal with full-ledger binding and claim release.
- [x] Integrate credits into existing complete seasonal planners, including boundary
  closure, credited carryover, prospective helper changes and exact ledger images.
- [x] Integrate governed seasonal credit sources and credit/claim/cursor/public
  writes into existing HU-082 forward/inverse publication, with full-source CAS,
  before images, shared admission/fences and local emulator evidence.
- [x] Reconcile observed membership/eligibility changes with versioned audit,
  both reserve pools and individual published coverage cases atomically locally.
  Preserve re-entry ordering evidence and block old-position revival, including
  credit-disabled planning; do not infer reserve exit from cohort inclusion.
- [x] Admit reconciled membership changes at wholly new round boundaries in both
  seasonal planners and the governed HU-082 forward/inverse transaction. Preserve
  retained order, append new/re-entering owners by reserve time/UID, bind complete
  membership/reserve evidence and keep acknowledgement revisions monotonic.
- [x] Integrate frozen unpublished departures/ineligibility with whole-unit
  activation/inverse, reason-preserving re-entry, cross-season carryover and
  zero-write rejection when a complete valid unit cannot be staffed (local outcome group 2).
- [x] Add authenticated fixed-emulator command transport and member/admin read
  models; prove real Auth token checks, transactional UID/member binding, safe
  projections, revoked/disabled sessions and exact command replay locally.
- [x] Add equivalent Android/iOS typed local repositories and presentation operation
  ownership, session revision fences, explicit uncertain-command replay and shared
  wire-fixture pipeline tests. Keep local adapters outside Release/live composition.
- [x] Compose isolated emulator Auth sessions and connect member/admin native UI,
  localized forms/actions, static accessibility, previews and native HTTP journeys.
- [x] Persist atomic command effects and rehearse HU-083 readable projection plus
  generic inbox release with exact retries, manual conflict preservation and private Rules.
- [x] Resolve authenticated notification references to current minimal cases in
  both native rehearsals; retain refresh scope and restore overview across pending
  reads/writes without replaying uncertain commands. Drain local effects automatically.
- [x] Add fixed-demo push submission receipts and authenticated native push routing;
  verify iOS simulated system taps and Android cold/warm Intents, with draft/session
  fences and no automatic resend after an uncertain result.
- [x] Reuse the trusted HU-082 barrier and backend-only operator authorization
  to recover verified projection/inbox and classify interrupted push submissions
  locally, retaining conflict reservations, audit history and closed writers.
- [x] Complete isolated real OS push delivery and native notification opening on
  both physical platforms in foreground, background and process-closed states.
- [ ] Complete real multi-service controls/destination admission; the demo worker
  and the isolated transport rehearsal are not live coverage integration.
- [x] Add opt-in native role/cancellation acceptance with enlarged text and fresh
  read-back; validate both Android phone sizes and retain iOS visual evidence.
- [x] Complete the bounded physical assistive-technology journeys and native device
  matrix recorded in `review.md`, including API 29 and maximum-text/keyboard rechecks.
- [ ] Complete Android/iOS, Sheets and notification integration (outcome group 3).

Detailed tasks below describe the complete live feature. An emulator-only subset
is not completion of those production tasks. See `plan.md` for the current boundary.

## 0. Live activation decision gate

- [ ] Present normal-round placement/tie order for joins/reactivations, reserve
  lifecycle and exit boundary, volunteer, draw, admin fallback, deadlines,
  completion, committed seed/no-reroll, pending-coverage/credit stacking,
  whole-unit credit rollback/fallback, frozen-round unpublished departure handling,
  non-membership eligibility transitions/re-entry, and credit questions
  to the assembly.
- [ ] Link the assembly decision/date and exact accepted wording.
- [ ] Update authoritative English and Spanish requirements/user stories.
- [ ] Reconcile issue #268 and this spec with any amendments.
- [ ] Obtain maintainer approval of the reconciled implementation scope.
- [ ] Only then authorize live activation of the reconciled implementation.

## 1. Threat model and contracts

- [ ] Define coverage case, offer, response, candidate snapshot, selection,
  completion, reserve, and credit-ledger states.
- [ ] Define immutable ownership versus effective assignment fields.
- [ ] Define frozen/unfrozen departure transitions. Ratify the proposed idempotent
  `excusedDeparture` tombstone/skip or a complete coverage alternative, including
  slot, owner, cursor, round closure, completion/failure, and credit effects.
- [ ] Map every HU-082 predicate transition reason across frozen/unfrozen and
  preview/stage/public states. Define deterministic remove/append, reason-coded
  `excusedIneligible` versus coverage, and re-entry without position revival.
- [ ] Define actor permissions, deadlines, idempotency keys, versions, stable
  error codes, notification types, and audit retention.
- [ ] Define committed candidate snapshot plus non-manipulable seed derivation,
  no-reroll evidence, and remaining-order retry semantics.
- [ ] Define pending accepted-coverage eligibility and credit stacking cap/proximity,
  deterministic order, cancellation, and consumption. By default, block a second
  same-type acceptance while coverage is accepted/incomplete and then while its
  earned credit is pending; cancel/failure without credit releases eligibility unless
  the assembly ratifies another bounded terminal outcome.
- [ ] Define the complete same-type ledger version included in planner
  snapshots/digests and the atomic activation precondition.
- [ ] Threat-model forged completion/credit, self-assignment, replay, late
  response, candidate manipulation, demotion, and cross-environment access.
- [ ] Add RED state-machine, candidate, draw, credit, and Rules/security tests.
- [ ] Add shared Android/iOS wire/lifecycle fixtures.

## 2. Backend workflow

- [ ] Add versioned coverage/reserve/credit contracts and Firestore docs.
- [ ] Implement reserve FIFO and response windows as ratified.
- [ ] Implement volunteer collection and deterministic tie-breaking as ratified.
- [ ] Implement committed, non-manipulable compensated draw with no reroll and
  remaining-candidate retries from the original ordering.
- [ ] Implement explicit admin fallback and cancellation.
- [ ] Apply effective assignment without changing rotation ownership.
- [ ] Exclude both adjacent effective delivery leads from coverage/credit candidates.
  CAS predecessor/current/successor assignment, completion, and revision; reject
  equal-adjacent or stale results without side effects.
- [ ] Recompute only an uncompleted predecessor's planned helper. Freeze actual
  helper UID/source revision/time at completion and preserve it through later
  coverage/credit/HU-016 changes and cross-season races.
- [ ] Regenerate departed members only out of unfrozen rounds. For frozen rounds,
  preserve cohort/owner and implement the ratified public-coverage plus unpublished-
  tombstone/coverage rule without moving unrelated published rows.
- [ ] Keep tombstone/`excusedIneligible` provisional until activation atomically
  commits it with cursor/round closure and a fully staffed physical delivery/market
  unit. On any staffing/invariant failure, commit nothing and use the ratified
  coverage/admin fallback or blocked state.
- [ ] Implement versioned eligible/ineligible transitions using role/company/status
  revisions. Invalidate candidates, replan only unfrozen cohorts, preserve frozen
  owner/cohort, and send later re-eligibility to reserve/next unfrozen round.
- [ ] Publish notifications and terminal states idempotently.
- [ ] Issue credit only after authoritative coverage completion.
- [ ] Attempt one credit at the first eligible unactivated same-type occurrence
  and retry at each later eligible unactivated occurrence after deferral.
- [ ] Keep preview/stage ledger effects provisional and consume only with atomic
  activation of the exact candidate revision; invalidate on any intervening
  relevant ledger-version change.
- [ ] Plan one delivery slot or complete market group atomically, advancing owner
  positions while excluding all tentatively resting owners and existing market
  assignees from effective work in that unit.
- [ ] For delivery, treat adjacent-lead distinctness as a hard staffing constraint;
  reverse-backtrack/defer a credit when N=2 or another cohort has no valid filler.
- [ ] Roll back tentative consumptions in reverse queue order until the unit is
  staffable; make each restored owner work/serve that normal position and advance
  the cursor while preserving only their credit for retry.
- [ ] If the assembly rejects backtracking for a coverage fallback, first define
  and test original-credit consumption, replacement-credit issuance, failed
  coverage, and the original-owner-works outcome; do not infer that accounting.
- [ ] Preserve market distinctness, delivery handover, HU-016 swaps, and HU-082
  cursor invariants.

## 3. Security and observability

- [ ] Update strict Rules so backend-only fields cannot be forged by clients.
- [ ] Prove actor permissions for member, selected member, admin, inactive member,
  and wrong environment.
- [ ] Persist candidate/exclusion/algorithm input and transition evidence.
- [ ] Add structured logs/metrics for stuck cases, exhaustion, retries, and credit
  failures without exposing sensitive member data.
- [ ] Define operator reconciliation for partial notification/projection failure.

## 4. Android

- [ ] Add Domain/Data coverage, offer, response, and credit contracts.
- [ ] Add member vacancy/volunteer/offer/final-assignment/credit states.
- [ ] Add admin oversight and explicit resolution path.
- [ ] Fence operations to session, UID, environment, and authorization.
- [ ] Add localized copy, errors, deadlines, accessibility, adaptive layouts, and
  notification deep links.
- [ ] Add unit, repository, operation-safety, and connected UI tests.

## 5. iOS

- [ ] Add equivalent Domain/Data coverage, offer, response, and credit contracts.
- [ ] Add equivalent SwiftUI member and admin states/flows.
- [ ] Own and cancel work under the correct MainActor presentation boundary.
- [ ] Fence operations to session, UID, environment, and authorization.
- [ ] Add localized copy, errors, deadlines, accessibility, adaptive layouts,
  previews, identifiers, and notification deep links.
- [ ] Add Swift Testing, operation-safety, presentation, and UI smoke coverage.

## 6. Sheets projection and regression

- [ ] Project effective assignment and approved coverage metadata through the
  HU-083 adapter.
- [ ] Prove Sheet import cannot award credit, change ownership, or manipulate
  candidate evidence.
- [ ] Re-run HU-016 reciprocal swap and HU-082 rotation boundary suites.
- [ ] Reconcile coverage state, shift assignment, notification, and Sheet row.

## 7. Validation after approval

- [ ] Run Functions `npm run lint` and `npm run build`.
- [ ] Run focused coverage/credit/draw/security/Rules suites.
- [ ] Run Android unit and lint gates plus connected UI tests.
- [ ] Run iOS focused tests, `fast-unit`, `ui-smoke`, `release-gate`, and
  SwiftLint.
- [ ] Run local/emulator journeys for every ratified branch of the selection
  hierarchy without a shared-project deploy.
- [ ] Cover the two-person delivery minimum, all-credited cohorts, overlapping
  accepted coverage/stacking policy, committed-seed grinding/reroll rejection, consecutive credits,
  queue wrap, deterministic rollback, ledger drift after stage, and every
  ratified reserve-exit boundary.
- [ ] Cover delivery/market `unfrozen|frozen x preview|stage|public` departures,
  tombstone retry/concurrency, cursor/round closure, next real slot, no false
  completion/credit/replacement owner, and any ratified coverage alternative.
- [ ] Cover tombstone atomic-unit activation for delivery N=2, market N=3, and
  multiple losses; prove zero mutation when the next physical unit is unstaffable.
- [ ] Cover active eligibility drift and reversal for common purchase manager, real
  producer, inactive status, and concurrent predicate revisions across that matrix;
  prove no old position revival or partial state.
- [ ] Cover N=2 adjacent-filler rejection, coverage/credit/swap at cross-tab/season
  boundaries, and completion-versus-assignment CAS races; prove completed helper
  history is frozen and no uncompleted lead equals its planned helper.
- [ ] Run Android/iOS accessibility, adaptive layout, localization, role, and
  parity matrix.
- [ ] Run `git diff --check` and reconcile every criterion with evidence.

## 8. Closure

- [ ] Attach assembly decision, test evidence, manual journeys, parity matrix,
  and residuals to issue #268.
- [ ] Update spec DoD and all bilingual technical/data documentation.
- [ ] Link focused commits and PR.
- [ ] Do not infer production deploy or live mutation authority from closure.
- [ ] Record a separate HU-085-equivalent activation story as the remaining live
  gate after assembly-approved implementation evidence.


## Grouped native administration — 2026-10-26

- [x] Add authenticated administrative projections and atomic stale-context guards.
- [x] Connect derived reserves and explicit permanent departure on both native apps.
- [x] Connect exact planner-derived ten-week exception choices on both native apps.
- [x] Verify replay/session/security boundaries and native behavior in local gates.
- [x] Independently review and record concrete manual checks for the maintainer.

- [x] Finish the original bounded iOS new-form physical acceptance on iPhone 11 (2026-10-26, before the keyboard-placement correction): reader/focus/reason/acknowledgement/maximum-text/keyboard and independent-button direct touch.
- [x] Resolve the two invalid-frame runtime warnings: verified native iOS 26.5 accessory passes fixed width +infinity; navigation-bar dismissal avoids it and preserves behavior. Corrected full gate on frozen source: 938 passes/five expected skips/zero failures and zero compiler/analyzer/runtime issues; temporary configuration restored.
- [x] Confirm the corrected navigation-bar Hide keyboard action and full accessibility-size header on iPhone 11/iOS 27.2 with VoiceOver (2026-10-27, frozen 8877 source): departure title/action read fully, keyboard hides retaining Prueba, Back returns focus to Register permanent departure; no submission.
- [x] Complete the bounded Android new-form physical matrix on Xiaomi/Android 14: TalkBack reading/return focus, native XXL/1.5 text, reason/keyboard/cancellation, all three direct-touch actions, and authenticated local reserve/departure/exact-spacing writes and read-back. Original APK restored; TalkBack off, final normal font 1.0 preserved, demo services stopped. Earlier coverage/push results remain separate evidence.
- [x] Investigate the separate Xcode 27.1 AppIntents warning: the supported disable option emits a replacement warning; preserve the explicit limitation without warning filters, unused imports or an undocumented project setting. Application/build configuration remains unchanged.

## Authenticated normal-app composition — 2026-10-27

- [x] Reuse one environment-bound Firestore coverage implementation and preserve fixed-demo guards.
- [x] Add exact authenticated access/action endpoints and transactional readiness/identity checks.
- [x] Connect normal Android/iOS sessions, forms, navigation and coverage notification routing.
- [x] Verify token/session/account/environment drift, disabled access and immutable retry intents.
- [x] Complete Functions/Android/iOS validation and independent review with bounded evidence.
- [ ] Complete the separate operational dependencies before enabling shared coverage.

## Shared Sheets/notification coordination — 2026-10-27

- [x] Commit/push the validated normal-app composition as `be3fde49` and verify exact remote identity.
- [x] Bind every public coverage write to its atomic private receipt/outbox and exact commit metadata; preserve planner audit first and ordinary manual edits.
- [x] Reuse the global HU-083 submission pointer and partition fencing for coverage, planner/import and all ordinary export entrypoints.
- [x] Close the public-command-to-worker gap and reject stale ordinary event snapshots before export.
- [x] Persist possible batches before I/O; retain unknown outcomes without automatic resend or TTL release, using existing governed read-only recovery.
- [x] Inject environment-bound effects/recovery/push authority, retain demo wrappers and release one inbox/push path only after verified coverage projection.
- [x] Version the affected-writer inventory with coverage ingress/effects/push and retain independent proof of in-flight drain.
- [x] Add race, crash, corruption, read-back, Rules and HU-083 regression tests, including a real ordinary-writer/coverage transaction interleaving.
- [x] Record final grouped gate/cleanup evidence in `review.md`; new coordination remains local after the delivered normal-app checkpoint.

Shared activation, authoritative source/credit migration, real destination/provider
admission, collective ratification and deployment/operator controls remain open.
The exported composition remains operationally closed; neither native platform
changes in this backend block.
## Initial coverage-state bootstrap — 2026-10-27

- [x] Deliver coordination as `fd225f35`; verify exact remote hash and retain draft PR/open parent.
- [x] Confirm canonical per-environment sources and maintainer declarations: zero pending credits, no known prior active reserves.
- [x] Add deterministic review plan with complete versioned source sets, explicit declarations and conservative blockers.
- [x] Validate existing credit/claim/ledger history and initialize only consistent missing ledgers.
- [x] Add create-only administrative initialization under the existing trusted closed barrier, with source CAS, receipt and safe replay.
- [x] Require the verified initial receipt in normal backend availability without opening operational readiness.
- [x] Provide an offline review command and bilingual operator/user explanation.
- [x] Complete local pure/SDK/Rules gates, independent review and cleanup; preserve native validation boundaries.
- [x] Deliver initial-state implementation as `537188bd` and verify the exact remote hash.
- [x] Prepare a private content-only develop baseline against fresh source reads, retaining the 72 published dates/108 ordered places and approved synthetic lineage; report helper/horizon/legacy differences explicitly.

- [ ] Establish/review the canonical base-planner state in shared develop before actual initialization: the four current/sourcePolicy/rotation documents are absent in the bounded read-only check.
- [ ] Resolve the 62 legacy representation, 53 helper projection differences and two missing market months in the governed migration/preview, retaining the published dates and ordered assignments; obtain real Drive/admission authority and rehearse the exact inverse.
- [ ] Review a real complete per-environment plan, obtain the concrete application/control-plane handoff and verify shared read-back; no live apply is included in local source preparation.

## Controlled develop migration rehearsal — 2026-10-27

- [x] Deliver the content preparation as `73001988` and verify the remote hash.
- [x] Prepare the exact emulator-only migration and recovery, retaining raw legacy before-images and current published dates/ordered assignments.
- [x] Reuse trusted barrier/admission/fences; measure and apply the full forward/inverse (203/140 writes), retaining terminal/audit evidence and an advanced closed security epoch.
- [x] Rehearse actual handler dispositions, replay, stale/extra/ABA source, lost acknowledgement and recovery guards with zero external transports.
- [x] Rehearse 53 helper projection changes and exact literal reversal through the existing Sheets adapter; report the two missing market months and real-authority gaps.
- [x] Complete independent review, relevant backend gates, private evidence and secret-safe operational handoff; keep shared activation closed.

Accepted local evidence: [rehearsal guide](../../../docs/testing/hu084-develop-migration-rehearsal.md).

## Develop operational inspection preparation — 2026-10-27

- [x] Deliver the controlled migration/inverse rehearsal as `0b5ceabb` and verify its remote hash.
- [x] Refresh read-only develop/project observations and document actual Rules, identity, version and index gaps.
- [x] Align the documented writer inventory with compiled v3 (26 writers).
- [x] Prepare a private develop-only inspection with read scopes, bounded version/ACL capture and sanitized non-executable results.
- [x] Validate 58 provider/HTTP/composition/regression tests, lint/build, focused CJS checks and independent reviews.
- [x] Deliver inspection preparation as `4b179d10` and verify its remote hash.
- [x] Authorize and establish dedicated private-inspection identities and deployment, without changing unrelated credentials or existing writers.
- [ ] Establish effective external writer controls and actual closure/drain bindings before any real migration proposal is admitted.

## Dedicated private inspection identity — 2026-10-27

- [x] Authorize the identities/permissions for only the private develop inspector; preserve existing writers and production configuration.
- [x] Create dedicated runtime and invoker identities without user-managed keys or direct project roles; bind source to both exact accounts.
- [x] Verify inherited deployment `actAs`; add only temporary OIDC creation on the invoker and prepare removal of that exact binding.
- [x] Validate 58 tests, lint/build and a one-target package with isolated develop environment and no legacy Runtime Config read.
- [x] Verify the maintainer's manual reader grant on the develop workbook (connector sharing denied).
- [x] Deploy only `inspectDevelopShiftMigration`; verify dedicated runtime/private invoker and unchanged metadata/revisions for all 19 existing Functions.
- [x] Validate 63 local tests and real HTTP 403/405/400/400/200; capture six tabs under stable Drive version 259 with unavailable detailed ACL reported as null.
- [x] Remove the exact temporary OIDC binding; verify empty direct policy, actual token creation denied with 403, zero user-managed keys and unchanged Artifact Registry cleanup policy.

## Reversible develop writer-control preparation — 2026-10-27

- [x] Reuse #268/#269 and the current branch; capture fresh Rules release/source, Function/IAM metadata and visible workbook writers without changing controls.
- [x] Prepare a temporary all-develop client-write deny from the exact deployed Rules, preserving reads and production predicates.
- [x] Pass 12 isolated emulator cases with real stored-image comparisons, producer/admin/read parity, explicit Admin bypass and Rules-only pre-write restoration; pass build/lint and focused CJS checks.
- [x] Audit immutable deployed sources of the six legacy writers; confirm absent develop/epoch/in-flight guards and unsafe generic config fallback.
- [x] Map the 26 compiled writer IDs, capture prior/reversal conditions and prepare the blocked private packet and bilingual runbook.
- [x] Record the maintainer's declaration of only app/actions-here writers; keep it distinct from technical exclusion.
- [x] Deliver this preparation as `f105ca5c`; exact remote HEAD verified, without deployment or closure.
- [ ] Reconcile deployed private client-write authority with the compiled writer groups/targets and accepted revision/digest before barrier admission.
- [x] Design and locally rehearse selective admission/retention against the exact audited legacy source, preserving positive production callback behavior and conservative in-flight uncertainty.
- [ ] Establish actual durable develop delivery and reconcile invocations from old revisions before deploying a real bridge.
- [x] Verify owner-only lock capability and reversible isolated-copy owner/service-account canaries.
- [ ] Resolve actual-file ACL/control-plane authority and a transition under
  ADR-0021's bounded owner-cooperation policy before real application; all other
  writers and automated owner-credential paths remain controlled.
Shared runtime/operator/Drive admission, complete post-drain capture, actual
application/rollback authorization and full annual preview remain open.

## Selective pause and isolated Sheets copy — 2026-10-28

- [x] Deliver the prior Rules/control preparation and verify local/remote `f105ca5c`.
- [x] Bind the local pause design to the exact audited deployed JS; keep normal exports/configuration unchanged.
- [x] Validate 20 emulator cases, build/lint, focused CJS syntax and independent review: production bypass, durable develop admission/retention, duplicate integrity and conservative uncertainty with the exact legacy callbacks.
- [x] Create a separate private native Sheets copy and a dedicated canary tab; leave original develop/production data untouched.
- [x] Obtain explicit session `drive.metadata` consent; verify actual owner capabilities, absent restrictions and a positive owner write followed by restoration.
- [x] Complete owner/service-account positive-before, denied-during and recovered-after copy canaries, exact own-lock reversal and temporary-access cleanup.
- [x] Record final local validation, independent copy-image/restriction review and verified ACL/IAM/OAuth cleanup; preserve `canApply:false` and unresolved old-in-flight/delivery/inventory gates.
- [x] Deliver this rehearsal as `f5c3b5db`; exact remote HEAD verified.

## Exclusive backend handoff design and rehearsal — 2026-10-28

- [x] Commit/push the accepted pause/copy-lock group and reuse #268/#269/current branch.
- [x] Refine masked metadata for six exact legacy Functions/Run revisions and four Eventarc/subscription configurations; distinguish configuration from absent runtime/queue census.
- [x] Inspect existing custody/external-fence/barrier contracts and accessible Shared Drives without changing resources.
- [x] Prepare the bilingual three-lane design and custody alternatives; record the
  later explicit owner-cooperation choice in ADR-0021 and align HU-085.
- [x] Rehearse committed capture with lost SDK acknowledgement, duplicate/conflict handling and current-state reconciliation without legacy callback/notification replay; do not infer broker durability.
- [x] Rehearse pre-pause and recording-provider-accepted late work, unknown history/uncertainty refusal, initialized epoch/revision checks and stale-command rejection in the fixed demo emulator.
- [x] Validate 28 joint passes (eight new plus 20 unchanged), build/lint and both CJS syntax checks; reject fixture output as a live barrier proof, independently review and retain private evidence.
- [x] Record remaining external authority/queue/inventory/procedure gates without
  fabricating closure or authorizing a live migration; all local outputs retain `canApply:false`.
- [x] Record the provisional personal-account assumption and accepted bounded
  owner-cooperation policy in bilingual ADR/spec/runbook documentation.
- [x] Implement and locally rehearse version 2 maintenance entry with bound
  owner/file/window/confirmations, other-writer controls, expiry, drift and
  uncertain outcomes; keep real provider/Sheets procedure integration pending.

The group was validated against `f5c3b5db`. Durable live intake, complete
old-work control/reconciliation, writer authority and the revised maintenance procedure remain
open; the local suite cannot close them. No native source or shared resource changed.

## Owner maintenance contract adaptation and local rehearsal — 2026-10-28

- [x] Deliver the preceding handoff/policy group as `3aafe4e8`; verify exact remote HEAD and reuse #268/#269/current branch.
- [x] Record the approved local-only scope and choose an explicit versioned variant in the existing barrier/retention/CAS architecture.
- [x] Implement bounded agreement parsing and bindings without treating owner cooperation as technical `fenced` evidence.
- [x] Integrate the variant through exact writer inventory, trusted checkpoint, immutable evidence retention/replay and maintenance CAS; preserve default strict behavior and other-writer/drain controls.
- [x] Rehearse stale/expired/wrong agreement, editor/authority/content drift, reported edits and uncertain operation outcomes through guarded local effects and actual emulator persistence.
- [x] Pass 438 joint emulator/regression tests with zero failures/skips, Functions build/lint and independent source review; update bilingual guidance and private evidence with exact results.
- [x] Record remaining provider/copy/live-admission gates and keep production, native apps and shared permissions unchanged.

The group was validated against `3aafe4e8`. Version 2 covers maintenance
entry with an unchanged workbook baseline and historical CAS receipt reads;
later Sheets batches still need their expected-postimage guard and actual
provider composition before any safe-copy or live window is authorized.

## Real control read-backs and guarded Sheets operations — 2026-10-28

- [x] Deliver owner-entry implementation as `2690528e`, verify remote HEAD and reuse #268/#269/current branch.
- [x] Record narrow implementation/read-only scope and verify the existing seven-tab copy without changing permissions/content.
- [x] Extend the existing Drive/Sheets reader with restrictions/capabilities and explicit incomplete/denied evidence; compose it with reviewed agreement/technical prerequisites.
- [x] Bind and guard the existing consumer's exact batch/before/expected-after images and require fresh controls for apply, inspect and completion.
- [x] Extend existing submission receipts/pointers with immutable owner binding and sticky incidents; reject unguarded schema3 recovery and uncertain automatic resubmission.
- [x] Validate real Firestore receipts/exclusion plus the real Sheets adapter with recorded Google protocol; preserve strict/legacy paths and original/production canaries.
- [x] Prepare the copy-only identity/window/operations/read-back/recovery packet and record any concrete user action still needed without applying it.
- [x] Complete Functions build/lint, five CJS syntax checks, 622 joint passes with zero failures/skips, independent review, bilingual guidance and private evidence; keep shared live readiness blocked.

Local/uncommitted against `2690528e`; 29 new concrete-composition emulator cases
cover fresh identity/controls, agreement/TTL/epoch drift, changed/restored reports,
preservation, cached evidence, one physical batch and lost acknowledgement.
Copy execution and temporary access/window confirmations remain separately
authorized, as do all original develop/production activation gates.


## Authorized real-copy execution — 2026-10-28

- [x] Add explicit copy-only technical authority and a schema 2 owner/runner
  agreement without fictitious shared writer evidence or a second human operator.
- [x] Bind short keyless token/scopes, fresh provider controls, owned local lock
  and actual SDK counters to existing durable receipts/CAS and isolated demo data.
- [x] Rehearse one real Google batch: 45 requests, ten synthetic market rows, one
  new tab, identical raw before/after images of all seven existing tabs checked
  before completion, completed market command/released lease and zero notices.
- [x] Preserve blocked zero-send incidents; constrain inherited writer acceptance
  to the exact named owner and verify short-token SDK refresh configuration.
- [x] Verify owner-only copy ACL, disabled fresh identity without keys/project
  roles/bindings and denial of the still-valid bearer plus a new mint.
- [x] Pass Functions build/full lint and 661 joint emulator/regression tests with
  zero failures/skips; preserve the earlier 622-case local history.
- [x] Include both reviewed groups in the authorized delivery checkpoint; record
  exact commit/remote verification in #268/#269 and draft PR #278.
- [ ] Establish durable shared develop intake and actual old-writer/effect and
  effective-authority controls before a shared maintenance/migration packet.

The provider result is limited to the authorized copy and localhost demo
Firestore. No original/production I/O, shared deploy or notification release
occurred. Private evidence is retained in `2026-10-28-isolated-copy-rehearsal`;
HU-084/HU-085 remain open and shared admission remains `canApply:false`.

## Durable develop intake and selective compatibility bridge — 2026-10-28

- [x] Add an owned, exact-project Firestore capture adapter outside the deployed
  broad client Rules; atomically retain typed images/chunks, delivery identities
  and a monotonic capture revision before acknowledging the callback.
- [x] Reject conflicting duplicates, unsupported values and oversized envelopes;
  preserve ambiguous/old history without automatic replay or closure claims.
- [x] Prepare four exact-develop retry-enabled collectors and wrappers for the
  six byte-pinned deployed callbacks; original event destinations also capture
  during overlap and original develop HTTP paths reject before business work.
- [x] Generate a separate allowlisted package with the exact legacy lockfile,
  an empty buildpack hook and explicit preservation of existing runtime settings;
  cap new collectors at 20 instances and require exact four/six target selectors.
- [x] Refresh only the six live Functions' configuration/source provenance and
  bind the unchanged legacy source and private runtime/environment hashes.
- [x] Pass Functions build/full lint and 697 joint tests, zero failures/skips;
  execute the generated JavaScript for six positive production paths plus two
  omitted-environment HTTP paths, matching baseline traces and after-images.
- [x] Install the actual packaged legacy SDKs separately and execute 20
  capture callbacks locally, including raw protobuf: ten logical captures/ten
  delivery records, no
  Sheets/FCM submissions and no reset of existing runtime metadata in the manifest.
- [x] Obtain explicit first-phase authorization, deploy only the four new develop
  collectors, verify private invocation/retry/filters/limits and the exact
  deployed source, and prove the six old Functions unchanged.
- [x] Correct the actual protobuf snapshot readTime boundary; accept all four
  original create events and both written-delete events through provider retry,
  without recreating/pulling/seeking/replaying messages; verify four CAS-cleaned
  probe documents remain absent and keep all failed-attempt evidence.
- [x] Separately authorize the six compatibility updates after the accepted
  capture phase and prepare their bounded pause/recovery handoff.
- [ ] Reconcile earlier invocations, retry-disabled failures and provider effects;
  connect current effective authority to the existing trusted closed barrier.

This source group is included in the maintainer-authorized delivery checkpoint.
At the first-phase checkpoint only the four new develop collectors were
live; the six legacy Functions were unchanged. Four authorized temporary
source records were created/deleted and six original events are retained in the
private journal. No original/production Sheet I/O, production data change or
trial notification send occurred.
The intake retains `legacyUntracked:true`; `canApply:false` remains mandatory.

## Selective old-develop containment and bounded reconciliation — 2026-10-28

- [x] Deliver the accepted intake group at `76a96826`; verify local/remote/PR
  heads and synchronize #268/#269 plus draft PR #278 without closing them.
- [x] Read a bounded, common-readTime census of the four actual develop source
  collections and private journal; preserve raw documents outside Git.
- [x] Refresh the all-region/both-generation inventory: exactly six updates,
  zero creates/deletes; verify four unchanged collectors and runtime/configuration.
- [x] Prepare the accepted-source package, four create-only/CAS-cleaned probes,
  two develop-only HTTP checks, source/config/traffic read-back and stop/forward
  repair policy; disclose retention of all develop notices, including orders.
- [x] Obtain explicit authorization for these six shared Function updates and
  four bounded develop probes, without Sheets/FCM/Rules/IAM/production data changes.
- [x] Update the dispatcher first, verify it, then update the other five;
  verify all six immutable sources, runtime/permissions/filters and latest traffic.
- [x] Verify the two HTTP 503 responses, six logical probe events and conditional
  cleanup; compare the unchanged business-document census before/after.
- [x] Add and validate an offline inspector of exact source/capture/delivery
  sets, hashes and versions, with no replay and no closure or apply authority.
- [x] Record the actual containment result separately from historical effects,
  client writes and effective-authority controls; keep shared maintenance closed.

The six updated immutable sources match the accepted package; runtime, permissions,
filters/retries and 100% latest traffic are verified. Four collectors and 14 other
Functions remain unchanged. The two HTTP 503 checks and six event requests on the
updated revisions are positively observed in a complete paginated log window.
Four probes are CAS-cleaned; the private journal now contains twelve verified
events/deliveries and revision twelve. All 183 business documents/versions are
unchanged. The final offline inspector rejects equal-version content/createTime
contradictions and passes 16 tests plus syntax, Functions build/full lint.
The accepted 697-test/packaged-SDK baseline is reused for unchanged bridge code.

This completes containment of new executions at these six develop entry points,
not historical effect closure. There are zero current planning requests and
117 historical notices with no automatic resend; three missing dispatch summaries
belong to administrative broadcasts from 2026-04-01. All external outcomes retain
their original uncertainty. Direct clients and effective-authority controls are
still pending, and shared maintenance/migration stays closed. No original Sheet
I/O, production business mutation or test FCM send occurred. The maintainer
authorizes this source delivery; exact commit/remote verification is recorded in
#268/#269 and draft PR #278. All eight accepted file hashes match before the
delivery-only wording/changelog edits, so the build/lint/16-test gate is reused.

## Remaining develop operational controls — 2026-10-28

- [x] Deliver `f141a902` and verify remote/PR heads; retain the existing open issues.
- [x] Refresh Rules release/source and read real IAM/runtime/key metadata without
  changing permissions, credentials, deployments or business data.
- [x] Prepare an immutable Rules-only packet with exact source/release checks,
  explicit all-develop-client scope and no automatic restoration.
- [x] Add a stable complete-source/journal set binding; preserve provenance,
  historical uncertainty and closed maintenance admission.
- [x] Prove current census/retained records cannot impersonate a trusted hold or
  disabled/isolated controls, even after rehashing.
- [x] Extend the Rules matrix to products, orders/orderLines, notices, global
  config and devices; pass build/full lint and 159 joint tests without skips/failures.
- [x] Prepare/review one regular temporary Auth account and one fictitious source
  to verify actual Firebase-ID-token admission before/after publication, with
  exact cleanup and a single-attempt receipt; do not store credentials.
- [x] Obtain and apply the concrete Rules/Auth/probe authorization; verify the
  live candidate, client denials/reads, cleanup and unchanged business/source sets.
- [x] Resolve ADR-0022 explicitly; owner-only cooperation does not
  silently amend Firestore administrative authority or automatic-writer controls.
- [ ] Complete real server admission, outstanding-effect and current-authority
  evidence before connecting a successful trusted control plane or entering maintenance.
- [x] Read the remaining nine HTTP/three scheduled deployed sources and exact
  Scheduler bindings: preserve the newer access resolver and actual develop-only jobs.
- [x] Correct inventory v4 with three mandatory Scheduler controls and reject
  missing/enabled/pending/in-flight jobs and incomplete v3 evidence before any CAS.
- [x] Revalidate after the core correction: 394 planning tests and a separate
  155-case controls/regression run, zero failures/skips; build/full lint pass.
- [x] Separately authorize/read back the exact three-job pause, preserving the
  actual develop-only configuration and one attempt per job.
- [ ] Reconcile prior invocations independently; pause does not prove drain.

The approved Rules-only attempt completes inside the twenty-minute window.
Source/release read-back matches baseline/candidate; the real authenticated client
proves create200 before, then update403/read200/delete403/create403. The owned Auth
identity and fictitious source are cleaned and read back absent. All 183 business
documents and twelve events/deliveries/revision twelve preserve their stable set.
Independent post-read verifies all 24 Function configurations/provenances, IAM,
nine service accounts and inspected policies/keys unchanged; three jobs remain
enabled. ADR-0022 is accepted for develop human capability only. Its versioned
contract/confirmations, server admission, job containment and earlier effects still
block maintenance. Executable hashes are unchanged, so build/lint and the 394/155
runs are reused. Native apps are unchanged. The maintainer authorizes this source
delivery; definitive commit/remote verification is recorded in #268/#269 and PR #278.

## Grouped administrator/server closure — 2026-10-28

- [x] Commit/push the accepted client Rules/policy checkpoint as `e29b6bdd`.
- [x] Implement explicit develop administrator v3 using existing intake/Sheets
  evidence, CAS, incidents and receipts, preserving strict v1/owner v2.
- [x] Prepare exact-source eight/one HTTP packs with pinned locks, preserved
  callbacks and explicit direct/effective develop denial.
- [x] Complete independent review, Functions build/full lint, 400 planning and
  separate 228-control emulator cases, zero failures/skips.
- [x] Accept exactly three PAUSED reminder jobs with unchanged semantic config
  and no invented prior-operation drain.
- [x] Separately authorize/update/read back the nine scoped HTTP handlers:
  exact deployed archives, preserved controls and seven 503/two existing IAM403.
- [ ] Bind actual complete participant confirmations, technical authority and
  earlier-effect reconciliation before shared maintenance admission.

## Prior develop operations: approved reconciliation — 2026-10-28

- [x] Commit/push the accepted administrator/server closure as `afbcd098`; verify
  remote and draft PR head, preserving both open stories and the existing branch.
- [x] Refresh the complete develop census without business/journal writes.
- [x] Bind synthetic captures to exact probe versions, accepted receipts and
  cleanup; compare source-level no-effect arguments with bounded runtime logs.
- [x] Inspect recent develop-only reminder executions and actual log retention;
  do not infer historical completeness or drain from absent records.
- [x] Implement/review/test the bounded offline reconciliation using inspectCensus,
  preserving possibly-delivered/no-replay history and all admission blockers.
- [x] Seal the measured classification, explicit residuals and next finite gate;
  keep physical handoff and migration admission false.

## Develop queues and maintenance-window preparation — 2026-10-28

- [x] Commit/push prior reconciliation as `4cb21682`; verify remote/draft PR.
- [x] Read eight exact trigger/topic/subscription bindings, metric scope/lag and
  service revisions without consuming/ACKing messages; retain shared UNKNOWN.
- [x] Identify four actual private backlog/500 conflicts and confirm five planning
  authority paths absent; do not infer a maintenance epoch or drain.
- [x] Implement/review/test lossless delivery observations and backwards-compatible
  inspection, preserving original records and strict core/identity rejection.
- [x] Prepare the four-private-collector-only packet with exact SDK/config/source
  bindings and obtain separate deployment authorization after local validation.
- [x] Verify natural redelivery retention, current source set and bounded metrics
  after any authorized update; keep shared/absent metrics as UNKNOWN.
- [x] Record the proposed window, real participants/operator requirements, remaining
  control/bootstrap gaps and explicit NOT READY status without starting a window.

Local gate: full Functions build/lint and147 joint tests pass, zero failures/skips.
The exact four-export/seven-file packet and GET-only guard are independently
reviewed; all24 Functions still match the baseline. Separate deployment approval
and natural-retry acceptance remain pending. See the bilingual queue/window guide.

Acceptance on 2026-10-29: four natural HTTP2xx requests are correlated by exact
CloudEvent ID/source labels, service and new revision; the bounded query has no
HTTP4xx/5xx or application errors. Four metadata observations differ only in
traceparent; original183 sources/twelve events/twelve V1 deliveries/chunks and
versions are preserved. Revision/deliveryCount16, eventCount12. All four source
archives and controls match; other20 Functions unchanged. Eight unchanged
executable-input hashes retain build/lint and147 tests. Shared UNKNOWN and bootstrap/
provider-sourceScope/participant requirements still block maintenance admission.
The maintainer authorizes source delivery; exact Git/remote evidence is recorded in #268/#269 and draft PR #278.

Final bounded queue observation (2026-10-29): latest returned backlog samples are
0/0/0/1 across the four private subscriptions. Four correlated HTTP2xx responses
and preserved metadata do not establish broker ACK/drain; the remaining value1
is unresolved, not silently treated as metric lag. Shared missing series remain
UNKNOWN. Next operational step is to reconcile that residual provider delivery
before claiming private queue drain or preparing real maintenance admission.

## Delivered repair and residual reconciliation — 2026-10-29

Repair delivered as `3977fd6f2df13d87748c7db1e3dd31ed36b8db1d`; remote and draft
PR match. Read-only residual reconciliation observes one provider ack_204/push ACK
in00:30–00:31 UTC and backlog/oldest-age0 at00:36/00:37 UTC for the private shift
subscription. Fresh183-source/12-event/16-delivery census is unchanged; no new
requests/errors in the later bounded query. Historical residual reconciled; recent
missing metrics remain UNKNOWN and do not admit maintenance. Next: provider/sourceScope
control and controlled bootstrap before participant/window commitments. See the
bilingual queue/window guide. Only this new evidence documentation remains local.


## Shared triggers and initial planner preparation — 2026-10-29

- [x] Deliver residual reconciliation as `3dbbd4da`; verify local/remote/draft PR heads.
- [x] Compare all eight deployed immutable-source/configuration bindings, normalizing
  filter order only; retain shared no-retry/private retry policies and production routing.
- [x] Refresh the183-source/12-event/16-delivery census and five-path absence evidence;
  preserve the prior stable set digest and UNKNOWN drain counters.
- [x] Prepare an offline source-scoped control review and initial-state recipe using
  the existing72-turn content and rotation checker, without an executable state.
- [x] Retain both round2/index22 cursors; keep sheetsSubmission absent until needed.
- [x] Pass build/lint, focused CJS lint and60 joint tests without skips; align EN/ES evidence.
- [x] Integrate trusted capture-only source controls with barrier verification and
  rehearse atomic initial authority creation as one block, including rejection/recovery
  (local implementation below; real operational admission remains pending).
- [ ] Refresh actual cohort/workbook/source-policy bindings, separate causal drain and
  complete participant commitments before any shared maintenance or migration write.

Only the first delivery is committed/pushed. New preparation changes remain local;
no deployment, migration, Sheets or FCM is authorized or performed in this block.


## Source-scoped barrier and bootstrap/recovery rehearsal — 2026-10-29

- [x] Commit/push previous preparation as `51b9c514` with changelog; verify remote.
- [x] Add exact four-pair develop capture proof to existing barrier verification,
  authorized manifests and immutable evidence; preserve ACTIVE production transport.
- [x] Keep prior schemas readable and unchanged absent explicit capture proof;
  reject production, partial routes, unreviewed bindings and unknown/nonzero drain.
- [x] Compose with separate owner/admin confirmation and fresh observation checks.
- [x] Rehearse atomic initialization, exact inverse and idempotent replay with new
  controls; verify partial authority cannot be overwritten.
- [x] Retain real emulator evidence/incidents through the existing repository;
  verify lost-ACK restart blocks replay and preserves committed rows/closed state.
- [x] Pass build/lint, focused CJS lint,72 local and33 emulator tests without skips.
- [ ] Compose actual provider/source-scoped observations and separate causal drain
  through the trusted port, with refreshed workbook/cohort/policy bindings.
- [ ] Admit a separately authorized real window only after current owner/admin
  commitments and all remaining controls are proven; no shared migration occurred.

ADR-0024 documents the additive control evidence. This completes the preceding
local integration/rehearsal checkbox; actual shared control-plane composition and
admission remain open. The new implementation is local and uncommitted.


## Real control/source observations and proposed window — 2026-10-29

- [x] Deliver capture integration as `f7ef299a`; local/remote/draft PR heads match.
- [x] Connect read-only provider ports to the existing eight-function verifier and
  new capture proof, download/check reviewed immutable archives, then re-read controls.
- [x] Read actual Eventarc/PubSub/Run bindings and metrics without pull/ACK/replay;
  preserve UNKNOWN and null causal drain when no series returns.
- [x] Refresh24 Functions, three PAUSED jobs, exact Rules release/source,183-source
  census,48-member planning fields (32 eligible), empty coverage/work collections
  and the four unchanged bounded published-sheet projections.
- [x] Retain scope-invalid shifts index response as UNBOUND; do not infer readiness.
- [x] Prepare one private-inspector invocation plus exact ten-minute OIDC grant/
  cleanup; obtain explicit authorization before the scoped permission mutation.
- [x] Prepare a NOT_READY window with explicit stop conditions, no start time and
  no premature no-edit promise. Preserve initial policy/cursors and higher-epoch recovery.
- [x] Pass Functions build/lint, CJS lint and73 joint observation/preparation tests.
- [x] After explicit authorization, invoke the private inspector once: HTTP200,
  six tabs, version259 before/after and canApply:false. Retry only OIDC mint403
  within the original deadline; remove both grants and independently verify zero
  direct bindings/preserved prior policy. Detailed ACL/owner inventory stays unknown.
- [ ] Resolve source-specific causal drain/prior effects and scope-bound index
  authority; bind actual source policy before requesting concrete window commitments.

This continues the previous trusted-port composition item for measured capture
controls; it does not claim a complete held multi-service barrier. New work is local.

## Index authority and finite drain diagnosis — 2026-10-29

- [x] Bind complete database composite/field inventory and exact shifts inheritance;
  resolve the earlier unbound index-list response without editing indexes.
- [x] Verify the missing declared latest-request index with develop plan-only Explain.
- [x] Prepare exactly one index create, preserve all five existing indexes and ask
  for explicit shared-project authorization; no deploy performed yet.
- [x] Reconcile fresh183-source/12-probe/16-delivery census with retained receipts.
- [x] Read eight subscriptions over24 hours and23 service traffic/revision inventories;
  retain stale/unknown delivery and invocation status instead of synthesizing zeros.
- [x] After explicit authorization, create exactly one index: READY, five old indexes
  and field overrides unchanged; develop Explain returns200 using the new index.
  Refresh the index-configuration binding; retain the initial propagation failure.
- [ ] Establish writer-specific old-work terminality or effective isolation; resolve
  the sampled-telemetry/live-drain contract gap before any maintenance admission.

No new native/backend runtime code or provider mutation; changes remain local.

Authorized index rollout changes only the shared index configuration. No business
write or other deployment; documentation remains local and admission stays false.

## Finite old-work assessment and proposed evidence correction — 2026-10-29

- [x] Account for all31 canonical cooperative writers (25 intake/six activation)
  and separate present routes, prior operations and external authority.
- [x] Read23 runtime/revision inventories: reviewed traffic,284 retired historical
  revisions; retain the explicit absence of invocation/external-terminal proof.
- [x] Prepare bilingual Proposed ADR-0025 without changing accepted ADRs/verifiers.
- [x] Check exact table membership, bilingual local links and diff hygiene.
- [x] Maintainer accepts the contained-delivery evidence alternative on2026-10-29.
- [x] Implement and rehearse it as one grouped change, retaining old
  effects/unknown authority as independent blockers and production strictness.

No provider mutation, migration, deployment or commit is included in this assessment.

### ADR-0025 implementation acceptance — 2026-10-29

Maintainer explicitly accepted local implementation/rehearsal. Four control opt-ins
bind the new evidence alternative into the approved manifest. Eight-route nullable/
nonzero observations and source/core/history bindings cannot relax old business-work,
quiet business-effect, owner/admin or production checks. Offline census projection
preserves append-only captures and legacyUntracked; it never authorizes live entry.
Held receipt drift still stops progression instead of silently refreshing evidence.
174 local tests and37 emulator tests pass without skips, plus build/full lint and
focused CJS lint under Node22.23.4. Initial creation/inverse, late classified versus
unseen events, retained evidence and lost-ACK restart are covered. No native/shared
service change. Work remains local/uncommitted. Next resolve real old business effects
and automated authority before workbook/source-policy/window admission.

### Direct reminder admission correction prepared — 2026-10-29

ADR-0025/observations are delivered as `5f648963398d2e600f70129bc8fdec19317b77aa`.
Read-only authority inspection found that all three PAUSED reminder jobs still target
ACTIVE, directly invocable original develop callbacks. The existing source preparer
now wraps those three callbacks, preserving original production-only behavior and
rejecting whole develop/mixed target sets before data access. New work remains local.
Build/full lint/focused CJS lint,15 local and24 emulator tests pass without skips.
The exact reviewed ZIP and build-source-only update plan preserve all jobs PAUSED,
all other21 Functions, runtime configuration and IAM; no live invocation is proposed.
Deployment requires explicit approval. It closes new admission, not old-call or
external-effect uncertainty. All117 notices remain unreplayed, legacyUntracked stays
true and live maintenance/migration stays NOT_READY. No native changes/parity gap.
See the bilingual `docs/testing/hu084-develop-old-work-boundary.md` guide for package
hashes, preflight/readback requirements and stopping rules.

### Authorized reminder closure deployed — 2026-10-29

The maintainer explicitly authorized the three reminder Function updates in
`reguerta-9f27f`. Sequential build-source-only patches completed and exact source
ZIP/readiness/traffic were verified for all three. Jobs remain PAUSED; effective
runtime configuration/IAM and all other 21 Functions are unchanged. Provider-added
identity metadata is checked against exact function/region values. No Function was
invoked; no business data, Sheets or FCM was written. Private operation/readback
records retain the result; bilingual old-work-boundary guide records revisions and
reconciled preparation incidents. Reuse the unchanged 15 local/24 emulator tests and
build/lint; this turn adds real deployment verification and negative verifier checks.
Code/docs remain uncommitted after `5f648963`. Old work/automated authority and
workbook/window evidence remain open; no replay or maintenance/migration admission.

### Post-reminder effects reconciliation — 2026-10-29

Reminder closure delivered/pushed as `34aa7aaec1b9ddcd44b970b540ec700a4f4e80c1`.
Read-only reconciliation joins12 recent FCM attempt terminals to exact traces,
reviewed revisions and matching Firestore summaries: six token sends reported successful/six
failed by the SDK, without claiming device receipt, non-delivery or replay safety. Three62-row imports
and five probe exits have matching HTTP200s. Current183 sources/12 captures/16
recorded deliveries and six inspected Sheets ranges (742 typed values) are unchanged.
Five negative correlation checks pass; reuse unchanged application acceptance.
The105 older notices are unreplayable/unverifiable history, not a pending-send count.
Stop repeating expired-log searches; next bind actual automated credential/destination
and workbook-writer authority to old-work completion or effective isolation. Keep
legacyUntracked and maintenance/migration NOT_READY. New documentation remains local;
no cloud mutation, production data access or native change. See bilingual legacy-
reconciliation guide for exact bounds, evidence and limitations.

### Effective writer authority reviewed — 2026-10-29

Prior reconciliation delivered/pushed as `713c09020b46d0317399a1dd3fb0d60f8e952286`.
Owner-side metadata identifies one owner, two service-account writers and one inspector
reader on the develop workbook; parent My Drive shows only its owner. Compute runs23
of24 Functions; SDK is a file writer without a Function runtime assignment. All24
source/runtime bindings remain unchanged. Four reviewed accounts have no USER_MANAGED
keys but project delegation/data authority persists. Three jobs PAUSED; no extra Run
service/job in europe-west1, no Build triggers in global/europe-west1, no App Engine
services. Compute inventory is unknown because its API is disabled; no API enabled.
Prepared exact-file writer-to-reader changes for the two service accounts, preserving
production/IAM/owner/inspector. Not authorized/applied; exact permission IDs and fresh
reversible readback are required before mutation. Two human project owners identified
privately for the later window. No source/platform change; docs checks only. New docs
local; maintenance NOT_READY. See bilingual develop-writer-controls guide.

### Develop permission-record checkpoint — 2026-10-29

- [x] Deliver writer-authority review (`048497d2`); acquire exact file/parent ACL records through explicitly authorized metadata-only OAuth reads. Two service writers are direct grants; preserve owner inheritance and inspector reader.
- [x] Prepare exact two-role demotion/recovery requests, sequential whole-ACL checks and unknown/partial-result handling; verify private manifest and revoke temporary access (original token denied 401, no refresh token). New evidence/documentation remains local.
- [x] Apply the separately authorized develop-only writer-to-reader changes. Both identities pass positive batch200 before and read200/canEdit=false/write403 after;742 values unchanged. Temporary account-scoped IAM grants removed; no recovery needed. New operational evidence remains local after `25ed6f63`.
- [x] Join the observed two-account Sheets fence and credential cleanup to validated old/current censuses and owner-role observations in offline preparation; preserve unknown work and NOT_READY.114 focused tests pass; source/jobs/value refresh retained privately. Local after `e6d02cc2`.
- [ ] Resolve earlier external-call completion/isolation and remaining automatic-writer authority; obtain consistent workbook-version/control evidence and fresh owner/admin agreements before proposing the maintenance window. The two-account preparation is not runtime admission.


### Old containers retired; owner isolation prepared — 2026-10-29

Previous preparation delivered as `9f01bae8`. Provider-bound inspection confirms288
old revisions across24 services are RETIRED, current traffic100% with no tags and
stable service readbacks. Added15 tests;129 focused tests/build/lint pass. This closes
old-container execution only; previously submitted effects and other writers remain
independent. Owner OAuth grants include broad Sheets/Drive write access; the known
test account's Google UI reports no linked apps. Prepared transfer of only the same
develop file to that account, demotion of the former owner to reader, parent-inheritance
check, connector probe/value comparison and conditional reverse-transfer recovery.
No ownership/permission change authorized or performed yet. New code/docs local;
maintenance/migration NOT_READY. See bilingual writer-controls guide for scope.


### Owner isolation executed with authorization — 2026-10-29

The exact develop workbook transfer was accepted by the test account; the former
owner is now a reader alongside the three service readers, with restricted sharing.
Same-value Fecha/A1 connector write succeeded before and returns 403 PERMISSION_DENIED
after; reads remain available and all 742 typed values across six ranges are unchanged.
No move was necessary for the observed denial. Parent/permission metadata is now
unavailable to the reader connector; do not fabricate a parent ACL or refresh the
historical owner API record. The preparation binds current UI/probe evidence separately.
141 focused tests/build/lint pass; actual combined evidence remains NOT_READY with
unknown prior effects/other writers and explicit current-parent/version/control gates.
No new OAuth/IAM, global revocation, deployment, FCM or production change. No native
parity gap. New changes remain local after `9f01bae8`. See bilingual writer-controls guide
and private `2026-10-29-develop-owner-transfer` evidence. Next complete remaining automatic
authority/prior effects before a bounded agreed window; HU-084/HU-085 and draft PR #278
remain open. Recovery would require reverse transfer and acceptance.


### Remaining access/effects audit — 2026-10-29

`b69dcf5b` delivered and remote verified. Fresh provider inventory confirms only 24
reviewed Run services globally, no Run jobs/worker pools/instances, three paused
Scheduler jobs, no Build triggers/active builds across 44 locations, nine keyless
service accounts and unchanged project IAM/Rules. Census remains 183 sources plus
12 captures/16 deliveries. Two known calendar probes have exact HTTP 200 terminals
and no Sheets/notice effects. No global old-effect closure is inferred.
The maintainer identifies the existing apps/Functions using `collections`, distinct
from `plus-collections`. Both use the same project; current develop Rules cover both
namespaces and legacy HTTP endpoints are shared. This identifies known callers, not
an exhaustive external-credential inventory. The 105 older notices remain unreplayed
history and residual effects still block admission.
No cloud mutation or production-data read. This audit is documentation only; prior 141 tests/
build/lint reused unchanged. See bilingual writer-controls guide for finite next
steps and private 2026-10-29-remaining-authority-effects evidence. No native parity gap.


### Historical-effect decision pending — 2026-10-29

Access/namespace audit delivered in `d3ae12d9`, remote verified. Offline disposition
of all 117 retained notices passes: 55 no-token, 34 partial, 25 success, three missing
April outcomes; 12 send summaries have correlated terminal receipts. Three imports
and two calendar probes retain separate completion evidence. No replay, fresh cloud
observation or live mutation. Complete historical termination remains unproved.
Proposed [ADR-0026](../../../docs/decisions/0026-accept-bounded-develop-historical-effect-risk.md)
requires an explicit policy decision before local implementation: accept the scoped
develop historical risk or retain strict blocked admission. It does not open a
window. Details and private evidence are in the bilingual writer-controls guide.
New documentation remains local; assertions/links/diff pass, no native parity change.


### ADR-0026 accepted; local implementation/rehearsal complete — 2026-10-30

Explicit maintainer acceptance covers develop historical risk, local implementation
and rehearsal only. The existing v3 barrier now binds exact risk acceptance and
preserves historical unknowns. The fixed-demo migration/inverse runner verifies both
plans and notices in its transaction source set; no shared entry point is enabled.
137 local + 26 emulator passes, build/lint/syntax/diff pass. See bilingual
[ADR-0026](../../../docs/decisions/0026-accept-bounded-develop-historical-effect-risk.md)
for rejection cases, post-commit failure and limits. Work remains local after
`d3ae12d9`; no commit/push, shared maintenance, production change or native parity
gap. Next prepare fresh real authority and exact operation acceptance, then request
its separately authorized window. HU-084/HU-085 and draft PR #278 stay open.


### Real develop evidence refreshed; window remains closed — 2026-10-30

ADR-0026 delivered in `0539ee40`, remote/draft PR #278 verified. Reused unchanged
137 local + 26 emulator tests, build/lint after checking all seven source hashes.
New read-only packet `2026-10-30-maintenance-evidence`: unchanged 24 Functions,
Rules/IAM, three paused jobs, 288 retired revisions, six READY indexes; unchanged
62 shifts/four calendars/117 notices and 12 captures/16 deliveries; 48 projected users;
five absent authority documents; 742 unchanged typed workbook cells and renewed UI
showing one owner/four readers. Offline assertions pass. No shared writes or native gap.
A separately authorized owner Online-only metadata-read session confirms stable Drive
version 278 and the test owner's My Drive root: one owner/four direct readers on the
file, only that owner on its parent. Authorization removed; Connections empty and same
GET denied with 401. No retained credentials or IAM changes. Bind real source policy/
plans and refresh remaining authority/queue controls before the separately authorized
owner/admin/risk window; the observations are not a held barrier. NOT_READY, no window
or operation acceptance fabricated. See bilingual writer-controls guide for scope and
historical-evidence limits. New documentary work remains uncommitted; issues stay open.

### Evidence-bound migration review package — 2026-10-30

Previous real-evidence documentation delivered/pushed as `3c06b28d`; draft PR #278
head verified. New offline preparer and 19 focused tests remain local. It binds
thirteen private evidence files, reviewed proposal/content, version 278, exact
permissions/index/control/source observations, 62 raw before-images, 72 published
semantic creates and 53 helper cells to one source-policy binding and both intents.
117 notices remain preserved without replay; dates and all 108 positions unchanged.
Raw inverse fields are exact; original service timestamps cannot be restored.

Package `ee465d0e2adb646111336d19356d685196c49ed4954834d7e320eeec49d7ac75`
is PREPARED_NOT_ADMITTED, not an executable manifest. Runtime policy, held source
versions, actual receipts/markers, live budget and window/risk agreements remain
explicitly unbound. No provider calls, maintenance entry, migration or production
access. 83 local tests, build/lint and focused CJS lint pass; no native changes or
parity gap. Emulator executor unchanged, not rerun. See the bilingual migration
rehearsal guide. Next materialize/rehearse the closed runtime policy and exact
transaction manifests locally; obtain fresh admission evidence and explicit window
only afterwards. HU-084/HU-085 remain open, PR #278 draft.

### Closed policy and final local migration/inverse accepted — 2026-10-30

Review package delivered/pushed in `e9fb31e5`, remote/PR #278 head verified. New
local implementation materializes an explicitly closed source policy and complete
forward/inverse transaction manifests with the existing serializer/barrier/CAS.
Execution reconstructs and compares every mutation/precondition; inverse requires
the actual forward receipt. Raw/guard drift, rounded clone fields, missing final
manifest, future/stale time and substituted writes reject. Reviewed operation IDs
are explicitly mapped to the existing canonical request-operation identity.
Annual production rejects the closed policy even after accidental local opening.

92 local + 39 SDK-emulator + 1 captured Sheets acceptance pass, build/full lint
and CJS lint pass. Real retained input roundtrip: 203/140 writes; exact 62 originals,
72 published rows/108 positions, 48 users, four calendars and 117 notices preserved.
Sheets: 53 helpers plus two markers per batch; 742 observed cells/notes restored.
Evidence `2026-10-30-final-migration`; see bilingual migration guide for exact
digests, byte estimates and limitations. All final receipts/times/controls are local
rehearsal authority, not live admission. No shared executor, maintenance opening,
deployment or production access; no native parity gap. Next connect controlled
develop execution and prepare read-only admission before a separately authorized
window. New changes remain local; HU-084/HU-085/PR #278 stay open/draft.

### Controlled executor connected; real admission remains blocked — 2026-10-30

Previous materializer delivered/pushed as `9a83203f`; remote and draft PR #278
head verified. New local composition reuses the extracted migration engine with
fixed develop project/database/namespace and exact original service versions.
Passive admission does not close controls or write incidents; execution consumes
an already-held barrier, rechecks source/human observations and rejects inspection
older than 60 seconds. Reports never authorize application or maintenance entry.

102 unit + 47 SDK-emulator passes, build/full lint and CJS lint. Retained-input
203/140-write roundtrip restores 62 originals and preserves 117 notices. Actual
read-only develop inspection detects two unreviewed config documents (member/public);
config/global itself is unchanged. Admission blocks with zero shared writes or
control reads. Next extend/review the exact config census and regenerate the bound
packet before repeating passive admission and preparing the separately authorized
window. See bilingual migration guide and private `2026-10-30-controlled-executor`.
No deployment, maintenance opening, production access or native parity gap.
New work remains uncommitted; HU-084/HU-085 open, PR #278 draft.

### Complete config census; real passive source match — 2026-10-30

Controlled composition delivered/pushed in `eb073e0e`, exact remote/PR #278 head
verified. New local correction requires all three config documents and binds whole
payloads/versions to the reviewed policy and materializer. The fresh atomic census
preserves every previously reviewed source/receipt; config/member and config/public
were pre-existing omissions. Regenerated packet preserves all business mutations,
published dates/order and 53 helper intents; identities change with new evidence.

Actual SDK read-only source inspection passes and stops at window_scope_missing:
one transaction, zero control reads/close calls/writes, no maintenance permission.
Other technical/Sheets authorities remain retained observations, not fresh admission.
113 unit + 50 SDK-emulator tests, build/lint and CJS lint pass. Exact 203/140-write
recovery and config drift/ABA refusal are covered; no native parity gap.
See bilingual migration guide and private `2026-10-30-config-census` for digests
and limits. Next prepare/refresh current technical and Sheets writer/destination
admission for this exact package before requesting the explicit window. No shared
mutation, deploy, maintenance opening or production access. New work remains local;
HU-084/HU-085 remain open and PR #278 draft.

### Current technical controls and Sheets destination reviewed — 2026-10-30

Config-census correction delivered/pushed as `27920b02`; prior 113 unit/50 emulator
gates reused with all seven code/test hashes verified. New work is documentary and
read-only evidence. All 24 Functions, Rules/IAM and six READY indexes match; three
jobs stay paused, 288 old revisions retired; four exact capture proofs/eight transport
bindings verified. Queue metrics UNKNOWN are not drain proof. Nine accounts have no
user keys/direct bindings; no global Run jobs/pools/instances. Cloud Asset disabled;
other automation inventory remains labelled historical.

Develop destination/tab IDs and 742 cells/notes match. The explicitly authorized
Online metadata-only owner session confirms stable Drive version 278, all five file
permissions and the returned owner-only My Drive root. Four direct readers; the only
inherited writer detail is the owner itself. No extra writer or content restriction.
Both the stalled first session and successful clean-tab retry were revoked; final
connection absent and same GET denied 401, no refresh token, Playground fields cleared.
No controlled Sheets worker is deployed; existing runtime has general project data/FCM
roles and no file grant. No service-account grant/token or write probe. See bilingual
writer-controls guide and private `2026-10-30-technical-sheets-review`; owner evidence
assertions pass. Next prepare the scoped writer grant/probe proposal before any
separately authorized window. No maintenance, business/Sheets write, FCM or production
data access; no native gap.
New docs remain local; stories open, PR #278 draft.

### Develop Sheets writer identity and test proposal — 2026-10-30

Technical/owner evidence delivered in `2a0836b0`. The new non-executable
`develop-sheets-writer-plan.json` and bilingual writer-controls guide propose a
fresh `reguerta-develop-sheets-writer`, no project roles/keys/attached services,
copy-only editor access, a ten-minute account-scoped mint grant and one 300-second
token with the existing two scopes. No account, grant, token or workbook created.

The existing observer requires canShare for complete ACLs; do not bypass this or
mistake owner capabilities for runtime capabilities. The seven-tab runner can use
a fresh synthetic workbook, not the six-tab original or completed eight-tab copy.
Separate Google credentials from Firestore authority; do not add data/FCM roles to
make the file writer an all-purpose runtime. Token scopes/count/lifetime are explicit
controller limits, not constraints enforced by that IAM role. Cleanup removes only
the exact copy permission/IAM binding, disables the account and verifies access loss;
unknown writes stay inspect-only. No production requests, original-file grant,
maintenance opening, shared deployment or native change.

Next: prepare the exact synthetic-copy/controller execution packet, then request
bounded provisioning and copy-rehearsal authorization. Original develop permission,
regenerated source/ACL binding, current external-control composition and a named
owner/admin/risk window remain separate gates. Proposal is local after the delivered
commit; HU-084/HU-085 open, PR #278 draft.

Validation: proposal invariants/source-scope checks and ten selected local contract/runner
tests pass (zero failures/skips). Live provider/emulator scenarios were not rerun;
no executable sources changed, so full build/lint and native gates were not repeated.


### Concrete synthetic writer execution prepared locally — 2026-10-30

Proposal delivered/pushed as `44e578d1`; exact remote and draft PR #278 head verified.
New local controller emits sealed offline payloads/input template and composes the
existing copy runner with exact-ID IAM/Drive adapters. Explicit parent credentials,
one token attempt, parent review before the only batch, four-minute child deadline,
independent cleanup stages and same-unexpired-token denial are covered. Unknown
outcomes stay inspect-only; concurrent foreign grants are preserved. There is no
live CLI, ADC fallback, resource provisioning or shared activation in this work.

Validation: build/lint, targeted CJS diagnostics and 30 tests, no failures/skips;
real Firestore SDK/emulator and Google transport doubles. Native sources unchanged.
Reproduce with `npm run test:shift-planning:writer-copy:emulator` in functions.
Concrete steps, credential separation, baseline capture and crash recovery are in
both writer-controls guides; private preparation: 2026-10-30-develop-writer-execution.
Next request bounded authorization to create the identity and synthetic workbook,
run this exact session and verify cleanup. No phone action now. Original develop
permission/current shared controls/maintenance remain separate. New implementation
is uncommitted; HU-084/HU-085 open, PR #278 draft, production untouched.


### Synthetic writer attempt contained; diagnostics corrected locally — 2026-10-30

Controller delivered in `98840300`. Authorized provisioning created the isolated
account and synthetic workbook; the first expired-owner attempt stopped before
access grants. Separately authorized recovery validated the same seven-tab baseline,
then failed opening the parent session before batch review/submission. Exact copy/IAM
grants were removed, the account disabled/keyless/without direct grants, and owner
OAuth revoked (same-token 401, Google UI zero linked apps). Positive writer access and
same-valid-token access loss were not established; `inspection_required` remains,
with no retry or maintenance admission. Audit records do not identify the root cause.

Local diagnostics now preserve the parent phase and bounded HTTP status without
secrets, broader access or retries. Build/lint and 31 focused tests pass, zero skips
or failures. New preparation digest, retained separate receipts and exported demo
ledger. See the bilingual writer-controls guide for exact evidence/limits. These
changes are uncommitted after `98840300`; native parity is unchanged. Next review and
deliver diagnostics before any newly authorized recovery. HU-084/HU-085 remain open,
PR #278 draft; production and original develop workbook untouched.


### Diagnostic delivery and fresh recovery preparation — 2026-10-30

Diagnostic/evidence commit `b8cebf6f` is pushed and remote-verified. Read-only
preflight confirms the owned account remains disabled/keyless/no direct bindings,
unchanged project IAM and expired prior window. New private recovery-2 packet
binds the corrected preparation/composition and preserves prior receipts/export;
missing approval rejects before effects. OAuth consent is prepared but not granted.
Fresh explicit reactivation/OAuth/execution approval and ten-minute owner window
remain required. No maintenance, production, new resource, token or native change.
Build/lint, 31 joint passes and final 17-case rerun reused after exact source hashes.
This preparation note is local after the delivery; issues open and PR #278 draft.


### Live mint denial and local readiness correction — 2026-10-30

Authorized recovery on `b8cebf6f` reports mint-token HTTP 403, before Sheets or shared
Firestore access. Exact cleanup: owner-only copy ACL, account disabled/keyless/no
direct bindings, temporary IAM removed, later mint denied; OAuth revoked, same-token
401 and zero linked apps. Writer positive-read/access-loss acceptance remains open.
API enabled and role contains getAccessToken; three-second grant-to-mint interval
makes propagation plausible but unproven. No real retry or new grants.

Local candidate adds advisory exact-account testIamPermissions polling (5s, max 180s,
reserving 360s of the unchanged window), fresh source/authority checks and fail-closed
cleanup before mint on timeout/drift. One actual mint only; a positive read is not
an authorization guarantee. Build/lint and 36 tests pass, zero skips/failures. New
preparation digest requires new approval after review/delivery; current changes are
uncommitted. Preserve retry-2 receipts/export; maintenance/production remain excluded,
native parity unchanged, HU-084/HU-085 open and PR #278 draft.


### Readiness accepted; actual mint denied; cleanup complete — 2026-10-30

The authorized recovery-3 used delivered `7d5bd6d6`. Owner/full ACL and the raw
seven-tab baseline matched. Advisory permission readiness returned true after
747 ms; the single actual mint still returned HTTP 403 (`mint-token`). No writer
token handoff, batch review, Sheets submission or shared Firestore access occurred;
child submitted/in-flight/unknown counters are zero. This does not establish a
root cause or justify broader permissions or a different identity.

Cleanup verified owner-only copy ACL, exact temporary IAM removal, disabled
account, zero user keys/direct bindings and a later denied mint. Owner OAuth was
revoked (200), the same token denied (401), and Google showed zero linked apps.
The private retry-3 receipt and emulator export are retained; local bridge and
emulator stopped. Positive writer-read/access-loss acceptance remains unproven:
`inspection_required`, `canRetry:false`, `canEnterMaintenance:false`.

A local diagnostic correction now retains only recognized Google ErrorInfo reason
codes, discarding messages, metadata and unknown values. It preserves the first
recognized reason across child failure reporting. It cannot recover the reason
from this completed attempt. Build/lint and 38 focused tests pass, zero failures
or skips. The correction and this evidence are not yet committed. No retry was
performed with the modified sources; any future packet requires a fresh digest.

Next: deliver the diagnostic correction, then prepare an IAM-only diagnostic
without owner OAuth or workbook sharing/window before proposing another full
rehearsal. That diagnostic is not yet prepared or authorized. Maintenance stays
closed; production, original develop workbook, shared business data and FCM remain
untouched. No native changes or parity gap. HU-084/HU-085 open; PR #278 draft.


### IAM-only diagnostic preparation — 2026-10-30

Delivered and remote-verified `d7fb614a`: denial reasons and actual recovery-3
failure/cleanup evidence. New local IAM-only preparation uses the same caller,
account, role and single 300s mint, with fresh source-bound approval, max ten-minute
window, bounded readiness, exclusive journal and exact cleanup. No owner OAuth,
workbook access, token use, data client, second cleanup mint or automatic retry.
Known IAM service ErrorInfo domains are supported without retaining raw errors.
Lint/build, 38 copy/emulator regressions and nine IAM-only tests pass, zero skips.
Private inert packet/offline rejection: `2026-10-30-develop-writer-iam-only`.
Preparation remains uncommitted; no credentials loaded or Google calls this phase.
Review/deliver then obtain explicit isolated IAM execution approval. No closed-sheet
window or owner action needed. Success will not prove Sheets access or migration
readiness. Maintenance closed; production untouched; native parity unchanged.
HU-084/HU-085 stay open and PR #278 draft. See bilingual writer-controls guide.


### Delivered IAM-only check; no mint; cleanup reconciled — 2026-10-30

`43706b14` pushed/remote-verified, lint/build and 33 focused tests passed. Authorized
execution enabled the isolated account but a local check failed at grant-identity
before grant intent or token request. Original inspection_required receipt retained;
no replay. Separate live read confirms disabled/keyless/no direct bindings, unchanged
project policy and authority checks passing. Scoped audit confirms successful enable
and disable. Cleanup reconciliation is separate from the original unresolved receipt.
Prior 403 remains unexplained. Local correction records bounded check/phase and
expected/observed lifecycle booleans, distinguishing local assertions without raw
policy/errors/secrets. Same admission/cleanup/one-attempt contract. Review/deliver
before a fresh authorized execution; no maintenance, production or workbook access,
native parity unchanged. Issues open; PR #278 draft. See writer-controls guide.

Observation correction validation: lint/build and 34 focused tests pass, zero failures/skips.


### IAM lifecycle inconsistency and explicit containment — 2026-10-30

`dfaafc22` delivered/remote-verified, lint/build and34 focused tests passed. Authorized
retry-1 enabled the account and granted scoped IAM; next read reported disabled=true,
so account-lifecycle stopped before token request. Grant removed, but automatic
cleanup skipped disable based on that stale/inconsistent read. Later live read found
enabled. Explicit disable returned200; final read confirms disabled/keyless/no direct
bindings/project policy unchanged. Scoped audit supports this sequence. Original
terminal preserved and containment superseded by separate cleanup reconciliation.
No token/second enable/grant. Local fix always sends disable and adds bounded
lifecycle-only read observation (5s/max60s, existing deadlines; authority drift still
fails immediately). Tests:37 focused +38 copy/emulator regressions,51 unique passes,
no skips. Local/uncommitted/not executed; fresh digest and authorization needed after
review/delivery. Historical403 unresolved. Maintenance closed; production/workbooks
untouched; native parity unchanged. See bilingual writer-controls guide.


### IAM denial isolated; minimum grant age prepared — 2026-10-30

`7de7a19a` delivered/remote-verified; lint/build and37 focused passes before retry-2.
Single actual mint:403 IAM_PERMISSION_DENIED after advisory readiness649ms, about
1.4s after grant. No token issued/used. Grant removed, explicit disable succeeded;
independent read confirms disabled/keyless/no direct bindings/project unchanged,
admin audit caller expected. API enabled and role contains getAccessToken. Root
cause remains unproven; propagation is plausible, not justification for more roles.
Local candidate adds120s minimum grant age before the single mint, preserving max
180s readiness, ten-minute window and360s reserve; no mutation/mint retry. Lint/build
and39 focused cases pass without skips/failures. Candidate/evidence uncommitted and
not executed. Review/deliver then fresh authorized attempt; no owner/Sheets window.
Maintenance closed, production/workbooks untouched, no native parity gap. Issues
open; PR#278 draft. See bilingual writer-controls guide and retained retry-2 receipts.


### IAM-only diagnostic succeeded and contained — 2026-10-30

`ede1c71a` pushed/remote+PR verified; lint/build and39 focused passes. Authorized
retry-3 waited124,975ms after grant; one 300s token issued, validated and discarded
without use/storage/handoff. Result mint-observed-and-contained, no failures.
Exact grant removed, explicit disable and independent read/audit confirm disabled,
zero keys/direct bindings, project policy unchanged. Private retry-3 receipts and
reconciliation retained. No copy/production/data access, maintenance or deployment.
This validates IAM-only issuance, not Sheets or migration. Next integrate the tested
waits into the synthetic-copy controller and validate locally before a separately
authorized copy rehearsal. No owner action needed now. Outcome docs local/uncommitted;
no new runtime changes. Native parity unchanged; HU-084/HU-085 open, PR #278 draft.


### Synthetic-copy IAM controls validated locally — 2026-10-31

Evidence-only `a3b43fc7` pushed; exact remote and draft PR #278 head verified.
New local/uncommitted integration shares sealed timing with IAM-only preparation:
120s minimum grant age, bounded 60s lifecycle polls, unchanged 180s readiness and
360s reserve. Wait precedes child launch; identity/keys/bindings/project authority
remain strict during stale state. Explicit disable plus bounded terminal read.
The old cleanup mint probe is removed to enforce one actual mint attempt; this
is not fresh-mint-denial evidence. Same unexpired-token copy denial, exact ACL/CAS
cleanup, parent-reviewed single batch and seven-tab preservation stay required.
Lint/build, four CJS syntax checks, 49 focused and 48 emulator passes, no skips or
failures (34 overlap; 63 distinct cases, ten new). No live external execution,
maintenance or production access. Native unchanged. Inert preparation/logs private
in 2026-10-31-develop-writer-copy-integration-local; old execution packets stale.
Next deliver this integration, regenerate/review concrete existing-copy composition,
then request fresh owner OAuth/window/execution authorization. No user action now.
Both issues stay open and PR #278 draft. See bilingual writer-controls guide.


### Concrete existing-copy execution preparation — 2026-10-31

`3f88c846` pushed; remote/PR head verified. Previous lint/build and 63 distinct
local cases reused after identical source/preparation digests. Private packet
2026-10-31-develop-writer-copy-ready binds existing copy/account, historical images
and current source hashes; it rereads actual owner/ACL/baseline/identity before enable.
Wrapper removes immediate-enabled/conditional-disable assumptions, separates OAuth
setup from fresh owner window and cleans stages independently with OAuth revocation.
Eight offline composition cases and syntax pass; real controller plus simulated
provider/child, no live Google/shared-data operations. No approved execution file
or active bridge; preparation evidence remains local/uncommitted after delivery.
Next obtain explicit copy-only execution/OAuth authorization, then a separate fresh
ten-minute owner confirmation after setup. One token, one ten-row batch, seven tabs
preserved, exact cleanup. No maintenance or production; native unchanged. Issues
open, PR #278 draft. See bilingual writer guide for limits and private evidence.


### Existing synthetic writer proved end to end — 2026-10-31

Separately authorized execution/window completed with unchanged `3f88c846` packet.
126,484ms grant age, one300s writer token, one45-request batch, ten fictional market
turns in one new tab. Seven raw original-tab snapshots independently recomputed
equal; emulator command completed, zero uncertain/in-flight submissions and zero
notification events. Browser readback confirms the artifact. Same writer token
lost copy access404 with273,626ms remaining. Exact IAM/file grants removed, account
explicitly disabled/keyless/unbound and project policy unchanged (independent read).
Owner-only file ACL, OAuth revoke200/same-token401; no second writer mint. Controller
stopped; emulator exported and stopped. Outcome completed-and-contained, no failures.
Private receipts/reconciliation in 2026-10-31-develop-writer-copy-ready. Copy retained
with eight tabs; approvals consumed, no replay/reset allowed. Original develop and
production untouched, maintenance closed, no shared Firestore/FCM/deploy/native
change. Documentation-only; accepted local gates reused. Next deliver evidence and
bind validated writer to refreshed original-develop admission controls/destination,
with separately authorized grants. Issues open, PR draft; evidence docs uncommitted.


### Historical writer evidence incorporated into admission preparation — 2026-10-31

- [x] Deliver copy preparation/outcome documentation: `7d7a7da0`, pushed.
- [x] Verify and bind real retained copy receipts into the existing review package,
  materializer and controlled admission report; no new live execution.
- [x] Preserve source policy and forward/inverse intents, including operation IDs,
  dates/order and helper cells; keep current original-file authority unproven.
- [x] Regenerate private review/shared preparation; retain source observations as
  historical (version 278), with apply/maintenance flags false.
- [x] Functions lint/build, 137 unit and 50 emulator cases pass. Retained-evidence
  clone completes 203 forward / 140 inverse writes, restores 62 originals and preserves
  117 notices. Negative admission tests still require current controls and a window.
- [ ] Prepare original-develop writer permissions/capability check and refresh
  independent source/ACL/control observations; obtain separate authorizations and
  Firestore authority before any owner/admin/risk maintenance window.

Private evidence: `2026-10-31-writer-admission-binding`; original receipts unchanged.
This integration remains local/uncommitted after `7d7a7da0`. No maintenance, Google
resource change, shared data write, Sheets request, FCM or production access. No
native change/parity gap. HU-084/HU-085 open, PR #278 draft; prior approvals consumed.


### Original develop writer permissions/check prepared — 2026-10-31

- [x] Commit/push historical rehearsal binding: `2376ff42`; unchanged validation
  hashes accepted (lint/build, 137 unit / 50 emulator).
- [x] Prepare inert original-file permissions and one same-value A1 probe; exact
  UID/file/tab/cell, one 300s token, bounded grant and complete cleanup. No execution
  authority or standing editor; preserve original-protected copy runner.
- [x] Refresh 24 Functions, Rules/IAM, three paused jobs, six READY indexes,288 retired
  revisions, four capture pairs/eight transports and isolated writer identity.
  Five metric groups remain UNKNOWN. Global Run inventory finds 24 services and no
  jobs/worker pools/instances; writer assigned to none of the observed services.
- [x] Recheck six tabs and 742 typed-cell/note positions: unchanged within bounds.
- [x] Complete authorized Online-only owner metadata read: version 278 unchanged,
  expected owner/four readers, owner-only parent and complete ACL matching prior
  observation. OAuth revoked 200; same token denied 401; no refresh credential.
  Bind dated facts to inert plan (5e06b852…a4d46e2); require freshness at execution.
- [ ] Review original-only execution/journal and owner grant/removal channel; obtain
  separate permissions/one-write approval and fresh closed-file owner window.
- [ ] Regenerate migration authority after any new ACL/version, refresh business
  source census and separate Firestore authority, then seek owner/admin/risk window.

Private evidence: `2026-10-31-original-writer-preparation`. New documentation/inert
plan remain local after `2376ff42`; local scope/evidence checks pass. No maintenance,
IAM/ACL mutation, writer token, Sheets write, deployment, FCM or production-data
access. No native change/parity gap. HU-084/HU-085 open; PR #278 draft.


### Original develop writer executor prepared — 2026-10-31

- [x] Publish preceding original-file/control/owner-read preparation in `ac24e5ce`;
  exact remote HEAD verified. No maintenance or live writer approval inferred.
- [x] Prepare the fixed original-only provider and explicit real-provider composition,
  consumed approval/per-file lock, current controls, one 300s token after 120s minimum
  grant age, same-value A1 write and 120s cleanup reserve. Preserve copy exclusions.
- [x] Rehearse owner grant/removal protocol, independent IAM cleanup/disable, lost
  responses, authority/content drift, concurrent grants, expired denial and OAuth
  revocation with real transport fixtures:83 passes (34 new/49 regressions), no skips.
  Functions lint/build and new CJS syntax checks pass under Node 22.23.4.
- [ ] Verify the real native owner sharing channel/callbacks, refresh current
  independent controls and baseline, bind fresh preparation/source digests, obtain
  separate live permissions/token/write/cleanup authorization and owner window.
- [ ] Execute the one original-file check and inspect its final evidence. Migration
  authority/business census and maintenance approval remain separate.

Local uncommitted executor after `ac24e5ce`. No live Google calls, permissions/token,
Sheets/business write, deployment, notification or maintenance change this step;
production untouched. No native change/parity gap. Private validation:
`2026-10-31-original-writer-executor`. Guide:
`docs/testing/hu084-original-writer-check.md` and its Spanish counterpart.


### Native owner channel checked without mutation — 2026-10-31

- [x] Publish executor as `3e494fc8`; remote and draft PR head verified.
- [x] Review exact owner/file sharing UI: writer Editor draft with notifications off,
  cancelled; existing-reader Remove access menu inspected without selecting removal.
  Owner plus four readers preserved. This is UI-path evidence, not executed permissions.
- [x] Refresh bounded controls/identity/runtime and six-tab baseline. Correct legacy
  25-column read to A1:Y100, with grid-bound regression; other five ranges unchanged.
  Node 22.23.4: 84 focused passes (35 original/49 IAM-copy), no failures/skips; build,
  lint and CJS syntax pass. No native/Firestore change requiring their suites.
- [x] Complete authorized owner API metadata renewal at 11:56:08Z: version 278,
  same complete file/parent ACL; revoke 200, same-token 401, no refresh credential.
  Bind dated observations to the inert plan; clear fields and close Playground.
- [ ] Bind fresh source/baseline/control/owner evidence to separate live probe
  approval and the owner window; this read is not execution or maintenance authority.
- [ ] Execute original writer check and inspect actual grant/removal/cleanup results.
  Maintenance/migration remain separately gated; no global drain is inferred.

New local work after `3e494fc8`. Private evidence: `2026-10-31-original-permission-channel`.
No permission mutation, writer token, Sheets write, maintenance or production-data
access. No native parity gap. HU-084/HU-085 remain open; PR #278 remains draft.


### Authorized original attempt and contained cleanup — 2026-10-31

- [x] Deliver preceding preparation as `b52e75a8`; bind exact controls/baselines and
  the maintainer's authorization/ten-minute closed-file window to one attempt.
- [x] Grant/remove the exact writer permission through native owner UI; one token
  after120s IAM wait, positive Drive read and same-live-token404 after removal.
- [x] Verify IAM removal, disabled identity, zero keys/grants/runtime assignments,
  owner-token401, cleared/closed Playground and unchanged six-tab/control snapshots.
  Preserve terminal receipt/lock; record independent cleanup reconciliation.
- [x] Improve local diagnostic phases, comparison digests/pinned source locations and
  OAuth HTTP receipts without secret leakage or retry.86 focused passes; build/lint.
- [ ] Establish original-file write capability: this attempt stopped before write
  intent in broad `positive-read`; the exact assertion was not retained. Review and
  publish diagnostic correction, explicitly reconcile retained lock, then obtain a
  new single-attempt approval/window. No migration/maintenance authority follows.

Private `2026-10-31-original-writer-live`; current diagnostic code/docs local after
`b52e75a8`. No native change/parity gap. HU-084/HU-085 open; PR278 draft.


## Original writer diagnostic retry preparation — 2026-10-31

- [x] Publish expanded diagnostics and prior cleanup evidence as `930959bd`; exact remote HEAD verified. Reuse 86 passing tests/build/lint with matching source hashes.
- [x] Prepare an inert new private session with pinned prior receipts, a distinct receipt ID, fresh evidence inputs and explicit preparation-bound approval.
- [x] Verify locally that the retained lock rejects startup before credentials/network; original journal unchanged.
- [ ] New execution/OAuth approval, fresh identity/owner ACL/version/controls and explicit journal-lock reconciliation; no rollover performed yet.
- [ ] Fresh closed-sheet window, single token/same-value batch and independently verified cleanup. Original-file writing remains unproved.
- [ ] Separate maintenance/migration admission; neither is opened by this preparation.


## Original diagnostic attempt outcome — 2026-10-31

- [x] Execute one newly authorized attempt/window; preserve old receipt and archived lock.
- [x] Identify writer-parent assertion (provider line57 in930959bd), one token and zero writes; raw parent value not retained.
- [x] Verify exact grant removal, disabled identity, writer404/owner401, restored ACL, unchanged bounded snapshots and independent controls. Version280→282; no maintenance/production.
- [x] Correct writer-parent visibility locally without adding parent access; retain strict independent owner authority and reject conflicts.93 tests/build/lint pass.
- [ ] Publish local correction and regenerate preparation; another real attempt needs new approval/window. Original-file write capability remains unproved.


## Original writer parent-fix attempt — 2026-10-31

- [x] Publish parent correction as `44271c22`; bind new approval, current controls/ACL and fresh closed-sheet window to one attempt.
- [x] Verify real omitted writer parent with strict independent owner authority; metadata comparison passes.
- [x] Stop before write intent on unequal connector/direct snapshot digests; one token, zero batches. Raw writer snapshot not retained, exact differing field unknown.
- [x] Independently verify restored ACL, disabled/no-key/no-grant/unassigned writer, same-token404/owner401, exact unchanged six-tab connector snapshots and controls. Version282→284; cleanup has zero failures and releases active lock.
- [ ] Isolate the exact snapshot difference through read-only diagnostics before another write rehearsal; do not relax comparison or replace the independent baseline.
- [ ] Establish original-file writing under separately authorized new preparation/window. Maintenance/migration remain closed; #268/#269 open and #278 draft.

Private evidence: `2026-10-31-original-writer-owner-parent`; canonical consumed receipt
`original-writer-20261031-owner-parent`. Outcome-only local changes after44271c22;
no native code/parity gap and no controller/provider change.


## Read-only snapshot diagnosis — 2026-10-31

- [x] Publish contained attempt outcome in `b890d722`; exact remote HEAD and clean checkout verified before diagnosis.
- [x] Execute two explicitly authorized raw Sheets GETs with Online readonly OAuth; no writer token, IAM or file-permission change.
- [x] Reproduce the consumed writer digest exactly and isolate284 empty format objects across224 cells, only in the two2025-26 tabs. Values/notes/remaining fields and connector before/after captures match; exact detached reconstruction passes.
- [x] Revoke OAuth, preserve initial200 acceptance/200 probe and later same-token401, clear fields/close tab/discard token.
- [x] Specify independent raw GET baseline fidelity with exact writer mask/ranges; preserve strict comparison and all formats. No runtime normalizer or controller/provider change.
- [ ] Prepare a fresh independent raw baseline with renewed controls and a separately authorized rehearsal/window. Current diagnosis is not live admission or proof of original-file writing.

Evidence-only local changes after b890d722;44 focused plan passes. No native parity
gap, maintenance, migration, production access or sheet writes. #268/#269 open; #278 draft.


## Independent raw baseline preparation — 2026-10-31

- [x] Publish diagnosis in fe08a9e0 and verify exact remote HEAD.
- [x] Prepare inert owner-readonly two-GET capture with exact writer fields/ranges, strict raw equality, preserved empty formats and owner ACL/version bracket, before writer enable/grants/token.
- [x] Preserve all consumed receipts and use a new receipt ID; bind refreshed preparation/source hashes and capture freshness without historical-baseline substitution.
- [x] Validate5 private recording-transport cases plus44 existing plan/controller cases, with no real network or mutation. Public runtime unchanged.
- [ ] New concrete rehearsal/combined-readonly-OAuth approval, fresh owner/controls/capture and separate ten-minute closed-sheet window. No execution authorized by preparation alone.

Local preparation after fe08a9e0; no native parity gap, IAM/grant/token, maintenance
or production access. Private `2026-10-31-original-writer-raw-baseline`.


## Original raw-baseline rehearsal passed — 2026-10-31

- [x] Publish preparation as d6a2dae9 and verify exact remote HEAD.
- [x] Obtain explicit one-attempt/read-only OAuth approval and fresh owner closed-sheet window; reject stale capture before writer access and renew two exact raw GETs with owner/control brackets.
- [x] Verify one token, one same-value A1 batch, identical raw before/after digests and six identical supplemental connector captures; preserve dates/order/formats.
- [x] Remove exact file/IAM permissions, verify writer404/owner401, independently confirm disabled identity/no keys/grants/runtime assignments, restored ACL and unchanged controls. Version284→287.
- [x] Retain all receipts, release active lock, clear OAuth fields/tabs/token references.
- [ ] Incorporate successful original-destination evidence into the develop admission package and regenerate current version/ACL/source/control bindings before any separately authorized maintenance window.

Historical pending preparation/attempt checklists are superseded by this outcome.
No migration authority, maintenance, FCM or production access.44 focused tests pass;
public runtime/native code unchanged. Outcome evidence is local after d6a2dae9.
Private `2026-10-31-original-writer-raw-baseline/fresh-window`; canonical
`original-writer-20261031-raw-baseline`. #268/#269 remain open; #278 remains draft.


## Original writer admission binding — 2026-10-31

- [x] Publish original rehearsal result as b08c6428 and verify remote HEAD.
- [x] Bind separately reviewed original receipt/raw baseline/cleanup evidence alongside synthetic proof; carry it through materialization and passive admission without granting current authority.
- [x] Refresh develop census/control/identity reads; preserve all business document versions and exact cell mutation intents. Retain clearly dated owner/Sheet observations from the successful rehearsal; do not imply renewed OAuth.
- [x] Regenerate review and controlled package at retained version 287; real source-only admission matches and refuses the absent window without writes.
- [x] Validate Functions build/lint/CJS,146 focused and 50 emulator tests, including the regenerated package forward/inverse (203/140 writes,62 originals restored, 117 notices preserved).
- [ ] Renew final owner observations and bind current writer/Firestore authority, causal-risk controls and a separately authorized owner/administrator window before maintenance admission.

Local implementation after b08c6428. Private `2026-10-31-original-admission-binding`.
No native changes, live grants, maintenance, migration, production, FCM or deploy.
Historical success remains evidence, not current execution permission.


## Owner observations and concrete permission/window preparation — 2026-10-31

- [x] Commit/push original-writer admission integration as `d42ce7fe`; exact remote
  HEAD verified, reusing the unchanged build/lint, 146 focused and 50 emulator gate.
- [x] Prepare inert resource/permission/participant/operation bindings and bilingual
  [ordered window checklist](../../../docs/testing/hu084-develop-window-permissions.md).
  No grants, token mint, maintenance entry, migration or production access.
- [x] Renew owner metadata/full ACL/parent and two direct bounded raw Sheets reads;
  version 287 and exact 3286-cell image match. OAuth revoked; same-token Drive/Sheets
  denial verified, with intermediate Sheets 200 retained before its eventual 401.
- [x] Maintainer confirms exclusive control of both retained human Firebase Owner
  accounts. This identifies the administrator participant, not future-window consent.
- [ ] Complete/rehearse real held-barrier composition and combined timing/cleanup,
  refresh final sources/controls/risk, then bind separately authorized permissions
  and owner/operator/administrator commitments to a concrete window. Start/end and
  confirmations remain absent; the provisional 20+20-minute proposal is not readiness.

New documents/private preparation are local after d42ce7fe. No runtime/native change
or parity gap. Build and 50 emulator cases pass on the renewed package; 62 originals restored, 117
notices preserved. The 146 focused cases/lint are reused after matching executable
hashes. Documentation and private-script syntax checks pass; no native suite repeated. #268/#269 remain open and #278 draft.


## Durable develop barrier acquisition — 2026-10-31

- [x] Commit/push permission/window preparation as `9e724da4`; remote HEAD verified.
- [x] Connect controlled acquisition to the existing Firestore evidence/failure
  repository and admission executor. Bind closed policy, exact package/operations,
  source versions, workbook and historical-risk plans; no extra journal or reopen API.
- [x] Reconstruct held evidence from persistent storage; inspect consumed keys without
  automatically reacquiring or renewing expired human commitments.
- [x] Locally rehearse acquisition and exact forward/inverse with the renewed package,
  interruption before/after retention and final human checks, lost acknowledgement,
  cleanup failures, expiry, source/control drift and foreign-package rejection.
- [x] Verify build/lint, 166 focused and 65 emulator cases without failures/skips;
  203/140 local writes, 62 originals restored, 117 notices and guard versions preserved.
- [ ] Connect the trusted observation sessions to actual bounded provider readers,
  rehearse original-workbook batch/cleanup and combined timing, then refresh exact
  controls/sources/risk and request the separately authorized concrete window.

That acquisition implementation was subsequently committed/pushed as `9ed3a9ef`. Firestore persistence and business
transactions use the real local SDK; provider/cleanup observations are test doubles.
No live controls, permission changes, current OAuth revocation or total Google timing
are proven by the emulator. A process kill cannot guarantee cleanup; uncertain
resources require reconciliation. No maintenance, production, Sheets, FCM, deployment
or native change; no platform parity gap. Private evidence:
`2026-10-31-durable-barrier-acquisition`. #268/#269 open, #278 draft.

## Google observations and joint batch — 2026-11-01

- [x] Commit/push durable acquisition as `9ed3a9ef`; exact remote HEAD verified.
- [x] Exercise fixed-resource Google read transports: version 287, complete grids and
  ACL, 24 Functions, three paused jobs and reviewed Rules/IAM; revoke the authorized
  owner OAuth session and verify same-token Drive/Sheets denial.
- [x] Bind the complete capture to the existing package and materialize 53 helper
  updates/two markers with the existing adapter and runtime operation identities.
- [x] Jointly rehearse durable acquisition, Firestore forward/inverse and full Sheets
  batch on retained real captures: restore 62 originals and observed cells, preserve
  117 notices; cover lost acknowledgement, interruption and exhausted cleanup budget.
- [x] Build/lint, syntax/diff, 247 focused and 68 emulator cases pass without skips.
- [ ] Complete the remaining live observation/window composition and single owner
  credential lifecycle; bind writer grant/removal and rehearse the exact full batch
  plus total timing on an explicitly reviewed isolated destination. Then renew/freeze
  evidence and request the concrete separately authorized maintenance window.

New implementation remains local after `9ed3a9ef`. Google reads/OAuth cleanup were
real; Sheets writes and barrier human observations in the joint rehearsal were
simulated. Writer permission grant/removal was not exercised in this block. No current writer grant, real full-batch acceptance or
combined timing guarantee. No maintenance, production, native change or parity gap.
See the bilingual window-permissions guide for measurements, evidence and remaining
scope. Private record: `2026-11-01-google-batch-integration`; #268/#269 open, #278 draft.

## Full copy lifecycle preparation — 2026-11-01

- [x] Commit/push Google observations and helper-batch integration as `a2ba5dfa`;
  exact remote HEAD verified, prior six executable validation hashes unchanged.
- [x] Compose the full synthetic 53-helper forward/inverse with existing IAM checks,
  one short token, complete image preservation, cleanup reserve and independent
  removal/disable/OAuth cleanup; no original-file transport or Firestore writer.
- [x] Verify read-only identity preflight: disabled, no user keys, no temporary IAM,
  absent from the reviewed global Functions/Cloud Run runtime inventory.
- [x] Build/lint, syntax/diff checks and 117 focused tests pass without skips.
- [x] Obtain explicit copy/IAM/OAuth authorization in chat.
- [x] Create the new synthetic copy and independently verify all six grids against
  the exact baseline; owner-only permissions, no writer grant.
- [x] Confirm the fresh ten-minute owner window and execute the authorized attempt.
  Forward adapter readback passed; complete owner preservation rejected; no inverse.
- [x] Verify removal with the same unexpired token (404), empty IAM, disabled identity
  and owner OAuth denial in both APIs. Preserve the consumed attempt and partial copy.
- [x] Reproduce and narrowly correct derived SHEET metadata-location rejection; retain
  future owner readbacks before preservation checks.
- [x] Reconcile the exact copy through a complete owner-only read: stable version14,
  53 helpers/two markers and preservation verified; old/new validator comparison
  isolates derived SHEET fields on the current capture. Both OAuth sessions revoked.
- [x] Prepare inverse-only recovery with the existing runner: bind historical forward
  evidence, current code, exact55 requests and version14; offline real-image rehearsal
  and133 focused tests pass. Current transport permits one attempt, cleanup is reused.
- [x] Separately authorize the inverse, renew scoped owner access and confirm a fresh
  ten-minute window; restore 53 cells/update two markers in one batch with full preservation.
- [x] Verify permission removal, same-token denial, empty temporary IAM, disabled identity
  and OAuth denial in both APIs; cleanup complete in the 194,571ms attempt.
- [x] Bind reviewed inverse receipts through package, materializer and admission;
  preserve original business intents and fail closed on malformed or uncontained proof.
- [x] Review measured timing and identify the120s cleanup allowance mismatch: OAuth
  alone permits120s; combined lifecycle remains unmeasured.
- [x] Reconstruct/review ten-row/A1 source compatibility and preserve all original
  receipts through exact pinned transitions; no current-authority claim.
- [x] Bind complete copy deadlines:150s work plus60/90/120s cleanup slots; one300s token,
  same600s window. Rehearse slow/error paths and real transports on synthetic HTTP.
- [ ] Separately prepare/authorize a fresh synthetic copy for uninterrupted real timing;
  then refresh shared develop evidence and its combined maintenance-window admission.

Historical forward execution stopped before inverse. The separately authorized recovery
now restores the copy with complete preservation and cleanup verified. No uninterrupted
roundtrip or admission success claim. Existing A1 and
ten-row runners retain their scope. No maintenance, production, deployment, FCM or
native change/parity gap. Bilingual window-permissions guide contains the exact
recipe and boundaries. Private packet: `2026-11-01-helper-copy-lifecycle`.

### Inverse execution and delivery boundary

Recovery implementation is delivered as `a2a0b963`, with exact remote/PR head verified.
The authorized live inverse is complete; private packet `2026-11-01-copy-inverse-execution`
retains its receipts and independent checks. No maintenance, original workbook, production
or native change. Only outcome documentation remains local/uncommitted. The preparation
request stays unchanged as a historical unauthorized template; execution has a separate
consumed authorization receipt. See the bilingual window guide for measured timings.

### Recovery receipt integration — 2026-11-01

Outcome docs delivered as `82029bf8`. New local integration and offline regeneration
pass build/lint and152 tests. Old ten-row/A1 proofs are retained separately with exact
hashes, not recertified against changed backend sources. Real recovery receipts are
bound; original source policy/intents and observation ages remain unchanged. No live
calls, maintenance or production. See the bilingual window guide for all timing gates.

### Complete budget and compatibility — 2026-11-01

Receipt integration delivered as `3aa1b467`. New local budget and historical transition
review pass build/lint and166 tests on Node22.23.4, including14 new cases. Three original
evidence pins are restored in the offline package without rewriting receipts or
refreshing observations. Real uninterrupted provider timing and shared maintenance
remain unproved/unauthorized. Bilingual window guide contains exact deadlines and limits.


### Full budgeted synthetic-copy execution — 2026-11-01

`08b3098b` delivers the complete budget and compatibility block. One authorized
real `runBudgetedCopy` roundtrip now passes in 201,376ms with one300s token, two
55-request batches and all53 cells restored. Both full preservation manifests and
an independent six-tab cell/property comparison pass. No deadline breaches or
pending requests; owner-only copy access, same-token404, disabled/keyless/unbound
writer, both OAuth401 and released lock verified. Pre-window initialization had a
failed verification read; revoked session and read-only resumption are recorded
separately, with no initialization replay or writer token consumed.

Existing166 tests/build/lint reused at exact published hashes; outcome docs only,
no new native/emulator claim. Next bind this full-cycle receipt and budget to the
existing admission packet and rehearse combined barrier/Firestore/Sheets timing
locally. Original controls were not refreshed; no shared maintenance, original
workbook/production access, FCM or deployment. Issues open, PR #278 draft. Outcome
docs remain local; see the bilingual window guide and private
`2026-11-01-budgeted-copy-execution` receipts.


### Full-cycle admission evidence and joint local rehearsal — 2026-11-01

Previous outcome docs committed/pushed as `2ef610b3`. New local `helperCopyCycle`
review binds exact raw full-cycle receipts, deadlines and final cleanup through the
review package, materializer and passive admission. Existing source policy, business
intents, operation IDs and three earlier evidence pins are unchanged; no observation
is refreshed and no historical result grants current writer authority.

The real Firestore emulator plus in-memory Sheets exercises complete recovery,
budget rejection before/after Firestore, stopped inverse with separately admitted
recovery and cleanup deadline failure. The deadline clock and provider cleanup are
simulated; authority fixtures retain their own clock. This is not a combined live
timing certificate. See the bilingual window guide for hashes, validation and limits.
Next connect the tested scheduling order and Firestore deadlines to controlled
composition, then refresh current controls before a separately authorized window.
No live Google/Firestore, IAM, FCM, maintenance, original workbook or production access.
No native changes. New work local; both issues open, PR #278 draft.

Validation: Node22 build/full lint/focused CJS lint; 252 distinct local tests and
73 emulator tests pass, zero skips. No native gates needed for this scripts-only block.


### Controlled joint scheduling and uncertain response inspection — 2026-11-01

Previous full-cycle evidence delivered as `f01c40c0`. Local `executeJoint` now connects
the existing migration and Sheets adapters with deadline checks at transaction
mutations/callback completion and exact Sheets submission. Fresh inverse admission
precedes Sheets recovery. One SDK transaction attempt, no concurrent/repeated joint
direction, no abandoned promises. Uncertain results stop and inspect read-only even
when a barrier incident exists; absence is never retry authority. Inverse terminal
proof remains distinct from current recovered-row verification. The caller owns the
persistent evidence sink and cleanup; step success does not certify timely revocation.
No live calls, maintenance, original workbook, production or native changes. Next
compose acquisition/joint execution/cleanup for the concrete window and rehearse
interruption/restart before refreshing controls or requesting its authorization.
See the bilingual window guide and private `2026-11-01-joint-controlled-execution`.
New work uncommitted; HU-084/HU-085 open and PR #278 draft.

Validation: build/full lint/CJS lint; 256 distinct local tests and 82 distinct
emulator cases pass after focused final reruns. Shared execution without the
joint deadline guard is refused. No native changes or parity gap.


### Persistent acquisition/execution/cleanup composition — 2026-11-01

Prior joint executor delivered as `4dfa4946`. New local window composition binds a
numbered fsynced digest-chain journal before setup, acquires the existing barrier,
admits one direction, executes jointly and attempts file/IAM/OAuth cleanup independently.
An unverified cleanup fences other windows. Recovery only inspects and cleans after
process/ownership checks; it never resumes migration or automatically runs the inverse.
Corrupt evidence or abandoned recovery lock requires inspection, not automatic takeover.
Real SIGKILL after Firestore emulator commit retains the receipt and recovery leaves
business data unchanged. Google/session permissions remain test doubles. Private
journals: `2026-11-01-persistent-controlled-window`. No live maintenance, provider,
production/original workbook, FCM, deployment or native changes. Next verify concrete
session/recovery adapters, then renew controls for a separately authorized window.
New code local; both stories open and PR #278 draft.

Validation: Node22 build/full lint/CJS lint; 270 distinct local tests and 86 distinct
emulator cases pass. Five retained journals re-read successfully. Admission packet
unchanged; no current controls refreshed or native validation required.


### Concrete session/recovery verification — 2026-11-01

Persistent-window block committed/pushed as `d8b99067`; this review remains local.
Actual adapter code was verified using synthetic HTTP, not live credentials. Exact
IAM cleanup and joining pending reads are reusable. Three grouped connections remain:
original-file lifecycle observations/exact batch transport; durable ownership and
per-session cleanup evidence (a new OAuth token cannot close the lost session);
concrete normal/recovery factories, including Firestore, native owner channel and
one common deadline budget. No factory currently supplies those complete real ports.
Do not substitute the header probe/copy adapter, relax the baseline reader or label
fresh-session revocation as old-session cleanup. Keep unknown cleanup fenced.
Next implement/test these connections together locally, then renew observations for
a separately authorized window. This supersedes the previous suggestion to renew
controls immediately after this verification. No user action, maintenance, live
provider access, production changes or native parity gap. See the bilingual window
permissions document and private `2026-11-01-window-provider-review` validation.

Validation: Node22 build/full lint/CJS lint and 150 tests passed (zero skips).
Eight committed runtime source hashes match; the admission package was regenerated
and equals its retained value. Prior 86 emulator cases reused; no runtime/native change.


### Original observation/batch/session recovery connected — 2026-11-01

Previous review delivered as `559e6b20`. The three connections are now implemented
locally together: lifecycle-aware full owner capture, exact original helper batch,
and explicit normal/recovery Google sessions composed with the persistent window,
existing Firestore/barrier and common deadline budget. Owned permission-only version
movement is retained, never hidden. One token/batch per direction; inverse separately
admitted. Recovery exposes inspection/cleanup only, scopes removal to durable ownership
and matches credential fingerprints/expiries to earlier sessions. A new owner credential
does not certify an old session. Missing credential/denial/closure evidence retains
the fence after best-effort independent containment. Disk interruption cannot suppress
cleanup, but it cannot produce a verified terminal either.

Native permission actions and Google HTTP remain synthetic in validation; Firestore
is the local emulator. No live authorization, observation renewal, permission change,
maintenance, production access or native changes. Private evidence and final counts:
`2026-11-01-original-window-integration`; bilingual window-permissions docs describe the
concrete adapter contract and limits. New implementation remains uncommitted.
Next prepare the concrete operator invocation and refresh current evidence when needed
before separately authorizing a live window. No user action required for this block;
HU-084/HU-085 remain open and PR #278 draft.

Validation: build/full lint/CJS lint, 397 local tests and 90 emulator cases pass
with zero skips. Five concrete journals re-read; package/preparation unchanged.
Final pre-effect argument rejection checks are covered by the final local suite;
the emulator pass precedes only those rejection checks. No native gates needed.


### Concrete develop invocation and renewed evidence — 2026-11-01

Original-file lifecycle delivered/pushed as `5b24be80`. The next local preparation
pins the refreshed packet, code and exact batch, retaining absent scope/window/
authorization fields. Real read-only census, Cloud controls, writer identity/runtime
and owner captures match the reviewed state; OAuth revocation verified in Drive and
Sheets. No published changes, write grants, maintenance, FCM or production access.
The new packet regenerates operation IDs (`68e09b87cef3ef75a357`) while preserving
business intents and historical rehearsals. Passive live admission matches sources
and rejects only the absent window, with one read-only transaction and zero writes.
See `docs/testing/hu084-develop-concrete-invocation.md` and its Spanish counterpart.

Next grouped technical work: connect complete real technical/causal/owner/admin
observation sessions to the barrier and bind reviewed native permission callbacks;
verify their shared timing before requesting the concrete live window. The emulator
still supplies synthetic complete barrier evidence. Do not equate these refreshed
isolated captures with held admission. No user action or native parity gap now.
Private preparation/validation: `2026-11-01-concrete-develop-preparation`. Issues remain
open and PR #278 draft; new documentation/preparation is local, not yet committed.

Validation: 82 local tests and 90 emulator cases pass, zero skips/failures; five
concrete journals re-read. Runtime unchanged: exact source hashes permit reuse of
the prior build/lint. Passive real source read and inert invocation verified.

## Barrier observation/native permission composition — 2026-11-01

Preparation published as `40e32c6c`; new adapters remain local pending commit.
The concrete Cloud/census/owner composition now shares the original window budget
and lease. Initial agreements, closure and historical-risk dates remain immutable;
fresh human reports are mandatory. The CUA channel binds exact file/writer actions,
checks time before final mutation and verifies ACLs independently. No real grant
or maintenance occurred; the reviewed Share form was cancelled.

175 local tests and 90 emulator cases pass with zero failures/skips; build/lint
and focused CJS lint pass. Emulator results are retained
in `2026-11-01-barrier-native-composition`. Next: freeze the initial complete reviewed
barrier and new code hashes with actual operation/window commitments before asking
for execution. Prior evidence ages and unknown delivery counts remain explicit;
Google/UI joint wall-clock timing is not yet certified. See the bilingual
[concrete invocation](../../../docs/testing/hu084-develop-concrete-invocation.md).
Both stories remain open, PR #278 draft; no production/native-app change.

## Initial evidence and concrete window preparation — 2026-11-02

`658b7e9c` publishes the observation/native-permission block. Fresh develop source
versions and Cloud controls match; passive admission makes one read-only transaction
and correctly rejects `window_scope_missing`. Owner evidence remains retained.
The same package/operation IDs are preserved; the initial draft covers 25 controls
and eight routes without inventing agreements, zero counts or closure timestamps.

Proposed reservation: up to five minutes of initial read-only preparation plus the
unchanged ten-minute writer cycle. Status remains NOT_READY_INITIAL_SEAL_ORDER:
service composition demands the complete initial envelope before the native action
whose verified closure must bind the permission-controller exception. Next correct
that ordering with the existing durable journal and cleanup, then rehearse locally;
do not request the real window or manufacture a future receipt. Seven offline
preparation checks pass; runtime hashes and prior 175/90 validation remain unchanged.
See [initial evidence/window](../../../docs/testing/hu084-develop-initial-evidence-window.md).
No maintenance, production, native-app or permission mutation; stories/PR stay open.

## Post-permission initial seal — locally rehearsed, 2026-11-02

Preparation committed/pushed as `cb92b367`. The new local correction binds a fixed
pre-effect plan to this attempt's real native permission-action/closure receipt.
Final owner/admin confirmations, capture and quiet horizon precede the durable
initial seal and single token. Only four derived scope hashes and the risk assessment
time are completed; participants, operations, source, deadlines and risk acceptance
stay fixed. Admission receives the final sealed scope. The same journal preserves
partial setup; recovery never recollects confirmations, regrants or mints. Missing
seal, lost native acknowledgement, expired evidence, cancellation or failed append
retain containment/inspection semantics. Actual native grant dismisses the sharing
dialog and checks dismissal; it does not claim owner logout or revoked ownership.

Validation: 115 distinct local passes (91 unchanged plus final 15 seal and nine native-channel cases), 90
Firestore emulator passes, zero failures/skips; build/full lint/focused CJS lint pass.
Google/native surfaces are synthetic in the new tests; the real service factory is
exercised through seal construction, and Firestore regressions use localhost demo
only. Evidence: `2026-11-02-startup-seal`. No shared read/write, IAM/ACL/OAuth change,
maintenance, production or native-app change. Existing package/operation identities
remain; final live plan/review/code pins and actual window commitments are pending.
Next prepare that exact collection against the unchanged preparation deadline before
requesting execution. Stories remain open and PR #278 draft; no user action now.

## Concrete initial collector and timing — local, 2026-11-02

Startup correction is committed/pushed as `25109ad4` (remote verified). The new
collector connects existing Cloud/census/source/workbook/authority readers and
explicit receipt-bound owner/admin confirmation and final-report ports. A fixed
reviewed technical template precedes collection; fresh reads bracket the actual
quiet interval. Unknown delivery counters remain unknown. Package mismatch fails
before provider access. Passive source inspection uses a read-only SDK transaction.

Within the unchanged 180-second preparation cap, collection ends by window +150s,
reserving 30s for remaining checks. The normal deterministic scenario takes 60.400s;
slow confirmations/source/grant fail before token issuance. Pending SDK/human calls
must settle: real joint latency and bounded cleanup under arbitrary delay are not
certified. Tests cover failure, cancellation, settlement and package binding.

Validation: 106 local / 90 Firestore-emulator passes, zero failures/skips; build,
full/focused lint and diff checks pass. Google/human timing remains synthetic. Private
`2026-11-02-initial-collection` pins seven retained real inputs and the exact unchanged
package; its 25-control map still requires reviewed technical closure values for 23
rows and actual future commitments for two human rows. No synthetic authority is
inserted. The concrete technical template/final provider wiring and renewed evidence
are next, before any real window request. No live reads/writes, IAM/ACL/OAuth changes,
maintenance, production or native changes. New work is uncommitted; stories remain
open and PR #278 draft. No user action or sheet closure now.

## Retained technical receipts and explicit human inputs — local, 2026-11-02

Collector/timing delivered in `4dd7bb54` with remote HEAD verified. New local work
binds 23 technical controls to 25 retained files (ten deployed archives verified),
keeps 23 predecessor work counts unknown, and completes the static scope/owner/admin/
risk forms without dates or consent. Closure, absence and conditional composite
authority evidence remain distinct. The maintainer confirms no extra automation
beyond known apps/Functions; this is not proof of historical drain or a future window.
The explicit human transport validates each fresh challenge/reply and journals both;
no defaults, stale/reused replies or automatic confirmation. Current admission stays
false pending renewed full authority/file/parent observations and real dated commitments.
Validation: 126 local + three private offline checks; build/full/focused lint pass.
The detached synthetic completion passes the real codec; operational forms remain
unconfirmed. No live provider/IAM/ACL/OAuth/maintenance/production/native action.
Next renew identified evidence and review the dated packet before execution approval.
See the bilingual initial-evidence/window guide and private `2026-11-02-technical-receipts`.

## Renewed authority/owner observations and dated review — local, 2026-11-02

Receipt/human inputs delivered in `8edfc7df`, remote and draft PR head verified.
New read-only evidence at 08:07 UTC (Cloud/census), 08:11 UTC (owner): unchanged
24 Functions, 24 Run services, three paused jobs, Rules/IAM, six indexes and source
census. Ten service accounts: the additional one since October is the reviewed,
disabled develop Sheets writer; no user keys or direct account bindings.
Owner/parent ACL and version 287 unchanged; two full and two bounded direct Sheets
reads match. Owner OAuth revoked, same token denied by both APIs in 53.492s.
Package reproduced exactly from 17 pinned inputs; new 23-control receipt binding
retains all predecessor counts unknown and all human acceptance unconfirmed.
Three private checks and dated-plan/budget/rejection checks pass. Prior 126 tests
and build/lint reused after 346 file hashes match; evidence/docs only, no native gap.
Review-only proposal: 2 November 10:00–10:15 Madrid (09:00–09:15 UTC), including
five-minute read-only preflight and ten-minute writer budget. Fresh observations,
actual permission receipt and explicit operation/risk/owner/admin consent still required.
Do not start late; missed proposal must be redated/reviewed. No maintenance, provider
IAM/ACL changes, Sheets/Firestore business writes, FCM or production access.
Next review and authorize the concrete operation before requesting the real window.
See bilingual initial-evidence/window guide; private `2026-11-02-authority-owner-refresh`.
