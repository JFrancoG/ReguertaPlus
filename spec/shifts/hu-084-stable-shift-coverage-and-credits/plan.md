# Plan - HU-084 (Stable shift coverage and earned credits)

## 1. Current state

Planning only. This plan is intentionally non-executable until the assembly
ratifies the business policy and the bilingual requirements are updated. Issue
#268 may collect amendments, but an open issue is not approval.

## 2. Technical approach after approval

Build coverage as a separate state machine, not as a special reciprocal swap or
a mutation of rotation order. Reuse HU-082 identity, authorization, environment,
and notification infrastructure where the contracts match, while keeping
coverage cases, offers, candidate evidence, and credits explicit.

Suggested backend modules:

- `functions/src/shift-coverage.ts`
- `functions/src/shift-credit-ledger.ts`
- `functions/src/auditable-draw.ts`

Suggested collections are frozen only after policy approval and threat-model
review. Likely concepts include coverage cases/offers, reserve membership, and
a credit ledger. Every mutable aggregate needs a version and idempotency key.

## 3. Layer impact

### Functions/Firestore

- Authoritative workflow and deadlines.
- Candidate snapshot/exclusion policy and deterministic draw.
- Atomic effective-assignment transition.
- Completion-based credit issue and later single consumption while the next
  eligible owner fills the same physical slot.
- Snapshot/digest binding to the complete same-type ledger version, with any
  post-stage ledger change invalidating activation.
- Atomic whole-unit credit planning for one delivery slot or one market group,
  with reverse-order rollback of tentative credit consumptions until the unit is
  staffable under the proposed safe fallback.
- Notification event creation and late-response fencing.
- Security Rules and backend-owned fields.

### Android

- Domain models/repository for coverage cases, offers, responses, and credits.
- Member vacancy/volunteer/offer UI and admin resolution UI.
- Session/environment/authorization fencing, localized errors, accessibility,
  and notification deep links.

### iOS

- Equivalent Domain/Data contracts and SwiftUI flows.
- Main-actor presentation ownership, cancellation, session/environment fencing,
  localized errors, accessibility, previews, and notification deep links.
- Swift 6 strict concurrency and the repository's construction/Sendability
  rules remain unchanged.

### Sheets

- Project final effective assignment and coverage metadata required for human
  review.
- Never allow Sheet edits to issue credits, replace candidate evidence, or
  mutate rotation ownership.

## 4. Phased sequence

### Phase 0 - Assembly gate

- Present the decision list from the spec with concrete examples.
- Include normal-round placement/tie order for joins and reactivations; do not
  treat the proposed tail placement as already accepted.
- Include frozen-round departure handling: free regeneration only before cohort
  freeze; after freeze, proposed `excusedDeparture` tombstone for an unpublished
  owner position versus a fully accounted coverage alternative.
- Include eligibility drift without membership exit: reason mapping, unfrozen
  remove/append order, frozen coverage/tombstone behavior, and re-entry without
  reviving prior owner positions.
- Record accepted wording, thresholds, deadlines, authorities, and any rejected
  option.
- Update English/Spanish requirements and user stories.
- Re-review this spec and issue before creating an implementation branch.

### Phase 1 - Threat model and RED contract

- Model unauthorized self-assignment, forged completion, duplicate credit,
  replayed response, late response, demotion, environment change, and candidate
  manipulation, admin seed grinding/reroll, and overlapping accepted coverages.
- Model departure across unfrozen/frozen rounds and preview/stage/public positions,
  including tombstone replay/concurrency, cursor/round closure, and no false credit.
- Add failing pure state-machine, eligibility, ordering/draw, and ledger tests.
- Add failing Rules/security tests for every actor and backend-owned field.
- Add shared Android/iOS wire fixtures and lifecycle examples.

### Phase 2 - Backend workflow

- Implement versioned coverage cases and offer transitions.
- Implement the ratified frozen-round departure transition without mutating cohort/
  ownership: tombstone/skip as proposed, or the fully specified coverage alternative.
- Keep tombstones provisional through preview/stage. Activate tombstone(s), cursor/
  round closure, and one complete affected delivery/market unit atomically; on
  insufficient/distinctness/adjacent-helper failure, commit nothing and enter the
  ratified coverage/admin fallback or blocked state.
- Implement versioned HU-082 predicate transitions. Invalidate preview/stage; replan
  unfrozen rounds, preserve frozen cohort/owner, apply the ratified reason-specific
  coverage/`excusedIneligible` transition, and route later eligibility to reserve/
  next unfrozen round.
- Implement reserve and volunteer selection under the ratified ordering.
- Implement reproducible compensated draw and remaining-candidate retries.
- Implement effective assignment and notification publication atomically or
  through a resumable idempotent boundary.
- Implement completion-based credit issuance and unactivated-round consumption.
- Keep candidate credit effects provisional during preview/stage and commit them
  atomically only with exact revision activation; include the full ledger
  version in the snapshot/digest so any intervening issue/consume/cancel change
  invalidates that candidate.
- Attempt each pending credit at the owner's first eligible unactivated
  occurrence and retry it at the next such occurrence whenever safe staffing
  defers consumption.
- Plan one delivery slot or one market group as an atomic unit. Traverse the
  queue in order, exclude every tentatively resting credited owner from that
  unit, and fill from subsequent eligible owners with market distinctness. For
  delivery, exclude both adjacent effective leads and digest their assignment,
  completion, and revision.
- If staffing is impossible, roll back tentative consumptions in reverse queue
  order until feasible. The restored owner works and serves that position while
  only the credit remains pending for a later eligible occurrence. Use an
  alternative coverage fallback only if the assembly ratifies its complete
  original-credit/replacement-credit/failure accounting.
- CAS the complete affected delivery predecessor/current/successor chain at coverage/
  credit activation. Recompute only an uncompleted predecessor's planned helper;
  preserve completed actual helper history and reject equal-adjacent/stale results.
- Preserve HU-016 swaps and HU-082 rotation state.

### Phase 3 - Mobile parity

- Add member vacancy, volunteering, offer response, final assignment, and credit
  visibility on Android and iOS.
- Add administrator oversight/resolution without client authority over draw or
  credit.
- Handle deadlines, cancellation, stale context, notification deep links,
  localized failures, accessibility, and adaptive layouts.
- Refresh from Firestore after backend terminal state before showing success.

### Phase 4 - Projection and integrated validation

- Project effective assignment safely through the HU-083 Sheets adapter.
- Validate temporary absence, permanent departure across frozen/unfrozen and
  preview/stage/public states, join/reactivation, all
  selection stages, retries, market distinctness, delivery handover, completion,
  and credit consumption locally/in emulators.
- Reconcile emulator Firestore, Sheets adapter fixtures, notification outbox,
  Android, and iOS without a shared-project deploy.

### Phase 5 - Closure

- Run full platform/backend gates and an independent security/fairness review.
- Attach assembly decision, automated evidence, manual journeys, and parity
  matrix.
- Keep production deployment/live mutation outside scope until separately
  authorized with a HU-085-equivalent rollout gate.
- Create that activation story only after assembly ratification and integrated
  local/emulator evidence; HU-085 does not implicitly activate HU-084.

## 5. Test matrix

- Join/reactivation before and after one or multiple active/public rounds,
  including every proposed reserve-exit boundary.
- Reserve accepts, declines, times out, becomes ineligible, or changes context.
- Zero/one/multiple volunteers and ratified tie-breaking.
- Draw with committed snapshot/non-manipulable seed, no reroll, exclusions, retry
  among the committed remaining ordering, and exhausted set.
- Temporary absence versus permanent departure across delivery/market and the
  `unfrozen|frozen x preview|stage|public` matrix, with unaffected rows unchanged.
- `excusedDeparture` tombstone idempotency/replay/concurrency, deterministic cursor/
  round closure and next real slot, no completion/credit, and no replacement owner;
  if assembly chooses coverage instead, test its complete accounting.
- Atomic tombstone plus next-unit planning for delivery N=2, market N=3, larger and
  multiple-loss cohorts; prove no cursor/round/tombstone/credit mutation on an
  unstaffable unit and no unfilled calendar date/group.
- Eligible-to-ineligible and reverse transitions for active member, inactive status,
  common purchase manager, and real producer across the complete frozen/unfrozen x
  preview/stage/public matrix; re-entry never revives old tombstones/positions.
- Delivery/market credit issue only after completion.
- Pending accepted coverage and multiple-credit cases follow the ratified stacking
  cap/proximity/eligibility/order. Safe-default tests exclude a second acceptance
  while accepted/incomplete or while its completed credit is pending, then prove
  cancel/failure without earned credit releases eligibility under the terminal rule.
- Credit waits past an active round, retries after deterministic deferral,
  consumes once, stays type-scoped, and never leaves a delivery date or market
  position unfilled.
- Post-stage credit issue/consume/cancel invalidates the candidate by ledger
  version before any cursor or credit transition commits.
- Delivery/market unit solving covers the two-person delivery minimum, all members credited,
  consecutive credits, queue wrap, reverse-order rollback tie-breaking, the
  restored owner's served position, and pending-credit retry.
- N=2 credit deferral when the only filler is an adjacent lead; delivery coverage/
  credit/swap at previous/next, round, tab, and season boundaries; completion wins/
  loses the CAS race without history rewrite or lead = planned helper.
- Concurrent offers/responses/completion and idempotent replay.
- Admin demotion, member deactivation, UID/environment/session change.
- Market retains three distinct members; delivery handover stays operational.
- Prospective helper recomputation from the next effective lead before predecessor
  completion, actual-helper freeze afterward, and unchanged rotation ownership under
  coverage, credit, or HU-016 swap.
- HU-016 swap regression and HU-082 cursor invariants.

## 6. Validation gates after approval

### Functions

- `npm run lint`
- `npm run build`
- focused coverage, credit, draw, notification, backend-security, and Rules tests

### Android

- `./gradlew app:testDebugUnitTest`
- `./gradlew app:lintDebug`
- connected UI tests because member/admin workflow changes

### iOS

- focused Swift Testing cohorts
- canonical `fast-unit`, `ui-smoke`, and `release-gate`
- repository-pinned SwiftLint and relevant Xcode MCP preview/UI inspection

### Integrated

- Local/emulator workflow across Firestore, notification outbox, Sheets adapter,
  Android, and iOS.
- Manual accessibility/adaptive/parity matrix for member and admin roles.

## 7. Rollout and rollback principles

- No production rollout is authorized by this planning story.
- Enable the workflow behind an explicit backend capability/config gate if the
  implementation design demonstrates that staged rollout needs one.
- A rollback stops new coverage cases but preserves completed assignment and
  ledger evidence; it never deletes credits or rewrites published rows blindly.
- Reconcile any in-flight offer by version and state before disabling the path.

## 8. Main risks

- **Unratified business behavior**: hard stop at Phase 0.
- **Hidden coercion**: explicit acceptance and admin escalation.
- **Credit double-spend**: append-only ledger plus transactional consumption.
- **Stale staged fairness**: digest and recheck the complete relevant ledger
  version, not only the credit IDs selected by the old candidate.
- **Queue drift**: immutable rotation owner distinct from assignee.
- **Bias or non-reproducibility**: persisted candidates/exclusions/input/version.
- **Cross-platform divergence**: shared lifecycle fixtures and parity criteria.
