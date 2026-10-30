# Tasks - HU-084 (Stable shift coverage and earned credits)

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
- [x] Prepare exact two-role demotion/recovery requests, sequential whole-ACL checks and unknown/partial-result handling; verify private manifest and revoke temporary access (original token denied401, no refresh token). New evidence/documentation remains local.
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
connection absent and same GET denied401, no refresh token, Playground fields cleared.
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
