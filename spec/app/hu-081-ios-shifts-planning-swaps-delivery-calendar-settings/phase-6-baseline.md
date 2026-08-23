# HU-081 Phase 6 slice 3 baseline

Captured on 2026-08-23 from clean base
`35a874288e3844d9c3d88abbaa39e2fb6fef42b2`.

## Repository profile and settings

- Profile: `maintenance`.
- iOS deployment target: 26.0.
- Swift language mode: 6.0.
- Strict concurrency: `complete`.
- Approachable Concurrency: enabled.
- Default actor isolation: inherited project-level `nonisolated`.
- Canonical test plans: `fast-unit-v1`, `ui-smoke-v1`, and
  `release-gate-v1`.
- Xcode/iOS 27, packages, project settings, and test migration are not part of
  HU-081.

## Whole-tree activation inventory

| Area | Swift files | Lines |
| --- | ---: | ---: |
| Production | 283 | 40,888 |
| Unit tests | 151 | 35,290 |
| UI tests | 3 | 535 |
| Total | 437 | 76,713 |

- Swift Testing declarations: 763 `@Test` declarations in the unit target.
- XCTest unit methods: 8 declarations; existing test-plan selection remains
  authoritative.
- Canonical activation `fast-unit`: 779 logical / 970 concrete executions.
- UI target: 12 XCTest methods including launch/performance responsibilities.
- Canonical activation `release-gate`: 791 logical / 985 concrete executions.

These counts characterize the post-HU-080 base. They are not HU-081 completion
evidence.

## Primary slice inventory

| Area | Files | Lines |
| --- | ---: | ---: |
| Domain / Shifts | 6 | 123 |
| Domain / Calendar | 2 | 32 |
| Data / Shifts | 2 | 116 |
| Data / Planning requests | 2 | 269 |
| Data / Swap requests | 2 | 276 |
| Data / Calendar | 2 | 192 |
| App composition | 1 | 56 |
| Presentation / Shifts | 9 | 2,266 |
| Presentation / Settings | 4 | 914 |
| Primary total | 30 | 4,244 |

Directly supporting surface:

| Support | Files | Lines |
| --- | ---: | ---: |
| Shifts/Settings localization | 2 | 241 |
| Adaptive Operations previews | 3 | 1,334 |
| Develop time owner | 1 | 66 |
| Support total | 6 | 1,641 |

The activation surface is therefore 36 files / 5,885 lines before tests and
cross-feature composition guards.

## Current owners and boundaries

| Capability | Current owner | Activation observation |
| --- | --- | --- |
| Shifts feed and next shifts | `ShiftsFeatureViewModel` | generation fenced but initial session refresh is launched in an unretained task |
| Swap feed and mutations | `ShiftsFeatureViewModel` extensions | local models duplicate backend mutation state; two mutation tasks are unretained |
| Planning submission | `ShiftsFeatureViewModel` | one operation ID, direct repository call, no retained owner |
| Delivery Calendar | `ShiftsFeatureViewModel` plus Settings helpers | policy is in Presentation and uses device timezone |
| Settings appearance | root theme state | must remain independent of authenticated session |
| Producer unavailable mode | `ProductsRouteViewModel` | Settings is a consumer and must not create a second owner |
| Develop time | `DevelopmentTimeMachine` | root-owned process state consumed by Settings/Shifts |
| Swap authority | `transitionShiftSwap` Function | rereads live shifts/members and owns candidate/application/notification transaction |

`ShiftsFeatureViewModel` currently receives five repositories: shifts, swap
requests, planning requests, delivery calendar, and notifications. The
notification repository is stored but unused. Four repository capabilities are
invoked directly from Presentation.

## Initial behavioral and architecture evidence

### Delivery Calendar read authorization drift

`refreshDeliveryCalendar` requires `session.member.isAdmin`; otherwise it
resets the default and overrides. Firestore Rules allow every active member to
read `deliveryCalendar`, HU-042 requires member-facing surfaces to show the
effective exception, and `My Order`, `Received Orders`, and Home consume this
shared state for regular sessions. The current admin test explicitly protects
the incorrect nil/empty behavior and must be replaced with read-versus-mutate
coverage.

The Firestore repository resolves the default first through the member-safe
`config/member` projection and then through admin-only `config/global`. A
regular member therefore requires `config/member.deliveryDayOfWeek` to exist
live. HU-081 does not seed or read back that document; HU-022/HU-070 retain the
live rollout and canary responsibility.

### Delivery Calendar timezone drift

`DeliveryCalendarSupport.swift` parses the week with an ISO calendar whose
timezone is `.current`, then repeatedly uses `Calendar.current` to derive
delivery, blocked, open, and close instants. `OrderBusinessCalendar` and
`ShiftAssignment.weekKey` use `Europe/Madrid`. Existing tests exercise the
helper only under the process timezone and do not compare UTC/New York/Madrid.

### Swap client/backend authority mismatch

The local create path computes candidates from `shiftsFeed` and returns before
the repository call when none are present. Functions reads current server
shifts and active users and rejects with `no_shift_swap_candidates` only after
the authoritative calculation. This is a source-backed stale-snapshot denial.

The Domain transition carries complete request models. Data discards most of
those fields and serializes only action, requested shift, reason, request ID,
candidate shift, and response. The public client contract should match that
actual command surface.

### Ownership and layering

- Candidate projection, member replacement, helper recomputation, and calendar
  window policy are declared in Presentation.
- Operation IDs protect many late publications, but session refresh and two
  swap mutations launch unretained tasks.
- `ShiftsFeatureViewModel` and extensions contain 1,213 lines of observable
  state/operations within the 2,266-line Shifts Presentation cohort.
- No Store/use-case split is pre-approved; each extraction requires a distinct
  state or operation lifetime and tests.

## Test and UI inventory

The reproducible nominal cohort whose filename contains `Shifts`,
`SettingsShifts`, `AdaptiveOperationsRoutesPreview`, or
`DevelopmentTimeMachine` contains 12 files / 2,685 lines / 66 Swift Testing
declarations on the frozen base. Ten test-bearing files account for 2,189
lines / 66 declarations and two support-only files account for 496 lines.
Cross-feature session, root, composition, Functions-boundary, and preview
tests also protect this slice.

Coverage gaps at activation:

- no dedicated success/contract suites for `FirestoreShiftRepository`,
  `FirestoreDeliveryCalendarRepository`, or
  `FirestoreShiftSwapRequestRepository`;
- no test separating active-member Calendar reads from admin-only mutations;
- no test proving Calendar construction is device-timezone independent;
- no test proving a stale local candidate projection cannot deny backend
  create;
- no XCUITest navigates or acts in Shifts, Planning, Swaps, Delivery Calendar,
  or Settings;
- 17 affected View types are concentrated in five route/component files and
  those files contain no local `#Preview`;
- the shared Operations gallery has Shifts Planning, Settings, and Delivery
  Calendar Sheet scenarios but no swap or loading/empty/error/saving matrix.

## Inherited requirements and decisions

- `docs/requirements/mvp-requirements-reguerta-v1.md`: RF-TURN-01...07,
  RF-CAL-01...05, RNF-02, RNF-05, RNF-07.
- HU-011, HU-015, HU-016, HU-017, HU-020, HU-041, HU-042, HU-063, and HU-066.
- ADR-0004, ADR-0008, ADR-0011, ADR-0012, HU-079, and HU-080.
- Functions `transitionShiftSwap` remains the authoritative live transaction;
  no Function edit or deployment is authorized.

## Reproducible activation checks

```bash
git status --short --branch
git rev-list --left-right --count main...origin/main
rg -n "IPHONEOS_DEPLOYMENT_TARGET|SWIFT_VERSION|SWIFT_STRICT_CONCURRENCY|SWIFT_DEFAULT_ACTOR_ISOLATION|SWIFT_APPROACHABLE_CONCURRENCY" \
  ios/Reguerta/Reguerta.xcodeproj/project.pbxproj
find ios/Reguerta/Reguerta -type f -name '*.swift' | wc -l
find ios/Reguerta/ReguertaTests -type f -name '*.swift' | wc -l
find ios/Reguerta/ReguertaUITests -type f -name '*.swift' | wc -l
```

Implementation evidence will record exact focused selectors and isolated
`.xcresult` paths. No live Firebase, Functions, or Google Sheets call is part
of activation.

## Validated Phase 1 delta

This section records progress after the frozen activation snapshot without
rewriting the historical inventory above.

- Phase 1A separated active-member Calendar reads from admin-only mutation and
  planning. Functional checkpoint `b956f09` and documentation checkpoint
  `b491e50` are published; `b491e50` is the verified remote tip.
- Phase 1B checkpoint `fc1157e` removed persisted Calendar construction from
  Presentation and generalized the existing Orders authority into one guarded
  `BusinessCalendar` in Domain.
- Strict `YYYY-Www` round-trip validation now rejects malformed or impossible
  ISO weeks. Calendar arithmetic preserves Madrid midnight and Sunday close
  contracts across DST.
- Persisted exceptions accept Tuesday, Thursday, or Friday only. Default weeks
  and unchanged exceptions perform no repository write; returning to the
  default deletes the existing exception.
- Final focused evidence passed 30 logical / 46 concrete executions. The same
  policy selector passed 5 logical / 21 concrete executions under both
  `TZ=UTC` and `TZ=America/New_York` through temporary `.xctestrun` copies.
- Canonical final `fast-unit-v1` passed 789 logical / 996 concrete executions
  on iPhone 17 / iOS 26.5. SwiftLint reported zero violations in 438 files and
  `git diff --check` passed.
- The canonical four-journey UI smoke runner produced changing `signal term`
  failures while Xcode reported no LLDB debugger version. Each terminated
  journey passed when retried alone; there was no product assertion failure.

Phase 1B is committed and its authorized delivery precedes Phase 2. Remaining
Shifts/Settings display `Calendar.current` and implicit formatter timezone
usage stays in HU-081 for later display/UI phases. The inherited
`OrderHistoryWeek` fallback is outside the touched Phase 1 seam. No live
configuration or Firebase state was mutated or inferred from these local tests.

## Validated Phase 2 delta

This section records the completed local command-boundary cut without changing
the frozen activation inventory.

- Minimal typed Domain commands now represent create/respond/cancel/apply; Data
  maps only their accepted fields to the unchanged Functions union.
- Presentation no longer fabricates authoritative swap request mutations or
  denies create from a stale local candidate projection.
- Typed backend outcomes drive localized ES/EN feedback. The Shifts-only unused
  notification dependency is removed; Functions and News/Notifications remain
  unchanged.
- The in-memory authority models read-back, actor identity, open/accepted state,
  authenticated response attribution, and repository-owned timestamps.
- Focused suites and all 28 Functions security tests passed. Canonical
  `fast-unit-v1` passed 796 logical / 1,018 concrete executions, all four
  `ui-smoke` journeys passed, and SwiftLint found zero violations in 440 files.

Phase 2 is published as `fae4da0`. Phase 3 feed ownership is authorized and
begins with its deterministic RED matrix. Project settings, packages, Android,
Functions, CI, live Firebase, and Google Sheets remain untouched.

## Validated Phase 3 delta

This section records the published feed-ownership cut without changing the
frozen activation inventory.

- One weak, atomic owner now covers the Shifts and swap-request feed. It
  propagates cancellation to the exact task and keeps latest-wins,
  owner-only cleanup.
- Pending initial Feed -> Calendar hydration transfers only to an equivalent
  session successor and preserves ordering after success or terminal failure.
- Principal, authenticated member, selected member, role/capability,
  environment, and admin fences prevent obsolete publication. Role-only drift
  resets just the feed; full identity/access/environment drift keeps the hard
  reset.
- Focused evidence passed 12 logical / 15 concrete executions; the expanded
  cohort passed 79 / 87; canonical `fast-unit-v1` passed 808 / 1,033; and
  SwiftLint passed 0 / 444. Independent ownership, tests, and scope reviews
  found zero P0-P2 issues.

Phase 3 is published as functional checkpoint `124c34d` plus documentation
checkpoint `5dab3e2` on the verified feature branch.

## Validated Phase 4 delta

This section records the completed mutation-ownership cut without changing the
frozen activation inventory.

- One weak retained owner and one single-flight lane serialize
  create/respond/cancel/apply. Operation identity, authorization fences, route
  generation, and an observable ABA boundary reject obsolete publication and
  preserve a completion receipt when result and boundary handling race.
- Create is keyed by requested shift ID; respond/cancel/apply are keyed by
  request ID. Definitive failures release that key. Ambiguous failures
  quarantine only that key, and operation provenance protects a newer
  uncertainty from stale cleanup.
- Acknowledgement precedes authoritative read-back and releases the lane.
  Request uncertainty clears only on the exact reflected or terminal state;
  missing/stale projection retains it. Create cannot auto-clear without a
  backend correlation/idempotency key, which remains a separate Functions
  contract and issue.
- Same-resource transitions preserve confirmed acknowledgements and keyed
  uncertainty; a distinct identity/environment discards them. Nested Users
  public-projection changes remain fail-closed until the actual successor
  session is handled.
- Focused evidence passed 43 logical / 280 concrete executions; the expanded
  cohort passed 105 / 124; canonical `fast-unit-v1` passed 844 / 1,303; and
  SwiftLint passed 0 / 460 on iPhone 17 / iOS 26.5. Xcode built without errors
  or warnings; static project, scope, layer, concurrency, and formatting guards passed.

Phase 4 implementation is committed as `6df78eb`; its documentation checkpoint
and feature-branch push are authorized. Phase 5 planning and Delivery Calendar
ownership has not started and requires separate explicit authorization.
Remaining Presentation `Calendar.current` and implicit formatter-timezone
cleanup belong to the later display/UI phase of HU-081.
