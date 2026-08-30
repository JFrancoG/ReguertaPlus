# Tasks - HU-084 (Stable shift coverage and earned credits)

## 0. Hard decision gate

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
- [ ] Only then create the HU-084 implementation branch.

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
