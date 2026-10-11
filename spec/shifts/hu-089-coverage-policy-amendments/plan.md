# Implementation plan

The maintainer authorized a new issue/branch and implementation. This is a coherent child of HU-084, stacked on its unmerged PR rather than recreating its code on main.

1. Deadline/urgency state and backend enforcement, first-volunteer selection, deadline/replay/late-worker tests.
2. Reserve and permanent-departure credit lifecycle with transactional source, ledger and inverse tests.
3. Ordinary delivery spacing and explicit exceptions with cross-round, minimal-cohort and publication regression tests.
4. Reconcile native forms/projections and complete relevant cross-platform validation.

Start with the existing selection/store; do not introduce another workflow engine. Keep the old synthetic policy explicit, opt into the amended provisional policy locally, and reject malformed or missing timeline evidence.

Validation: Functions lint/build and focused unit/emulator suites. Repeat native gates only when their behavior changes. Record completed evidence and remaining scope here.

## First implementation block — backend and native connection

The explicit `hu089-provisional-v1` selection policy now owns normal/urgent/admin-only timing. It is selected through the existing local store/server options; `fifo-signup-v1` remains unchanged for historical synthetic fixtures. Case-opening time fixes urgency; phase deadlines are persisted, bounded for later phases and retained across candidates/replays. Late commands catch up from expired deadlines. Selection can offer the first eligible volunteer before the collection window ends, and acceptance ends the search. Direct administrative offers cannot bypass selection under the new policy. Draw reveal must fit its phase.

Initial evidence: Node 22.23.3; Functions lint/build pass; 52 focused unit tests pass and 128 Firestore/Rules/workflow tests pass, with zero failures/skips. This includes seven new pure timing tests and six new transactional tests. Logs: `/tmp/hu089-final-unit-lint.log` and `/tmp/hu089-emulator.log`.

The client projection now publishes optional `policy.selectionRequired` and per-case `phaseClosesAtMillis`. For open cases, reads derive the current phase with the trusted server clock without mutating case revision or stored records. Native clients retain legacy behavior when these fields are absent. Under the amended policy they require selection before offering, allow the next volunteer offer before signup closes, display the phase deadline, and bound draft expiry by that deadline, the offer maximum and shift start. An expired displayed phase disables administrative selection actions until refresh; the server still revalidates every command.

The same local server can rehearse the amended policy with an explicit policy JSON such as:

```json
{"maximumOfferWindowMillis":604800000,"selectionPolicy":{"version":"hu089-provisional-v1"}}
```

This remains a fixed-emulator opt-in. No migration of old synthetic cases or activation in shared environments is performed. At the first checkpoint, reserve exit, permanent-departure credit cancellation and 10-week ordinary delivery spacing were still pending. The lifecycle block below records the next implemented scope.

## Validation of the connected block

- Functions: lint/build, 52 pure tests, 129 Firestore/Rules/workflow tests (including seven new deadline transactions) and 22 Auth/HTTP tests passed, with zero failures/skips. Node 22.23.3. Final logs: `/tmp/hu089-native-functions-final.log` and `/tmp/hu089-native-functions.log` (Auth/HTTP).
- Android: 505 unit tests passed; `lintDebug` passed with its existing 135 warnings and two hints, zero errors. Connected API 29 run passed 23 ordinary tests; the Sheets opt-in test exited through its existing assumption (reported as one failure in XML although Gradle succeeds). Coverage transport opt-in journeys were excluded; this does not certify a new physical-device journey. Logs: `/tmp/hu089-android-final.log`, `/tmp/hu089-android-connected.log`.
- iOS: canonical `release-gate` passed on iPhone 17 / iOS 26.5 (`091D93C1-5A53-40D0-887E-83F81A8E0326`): 924 passed, five existing opt-in/conditional skips, zero failures; lint 511 files clean, Debug/Release builds passed. Evidence: `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/hu089-final-ios-lyyx6ehe/release-gate.xcresult`. Synthetic Firebase configurations were restored byte-for-byte after the gate. The final guard-only line wrapping passed focused strict SwiftLint; no behavioral changes followed the gate.

Two native regression cases per platform exercise the real repository decoding/presentation path: immediate next-volunteer action with a bounded draft, and mandatory selection versus legacy direct-offer behavior. The backend projection test verifies clock-based phase catch-up, unchanged persisted revision/data and absence of private timing/candidate records. Swift source-style review covered the five changed Swift files; its only heuristic candidate belongs to an unchanged tuple fixture.

The previous physical accessibility/push evidence is not claimed as a rerun of HU-089. No shared deploy, real push or business-data write occurred.


## Reserve and permanent-departure block — 2026-10-11

Implemented through the existing HU-089 opt-in store. New reserve entries freeze an
admission round boundary. The first due ordinary owner position after that boundary
and entry time ends reserve, even with another effective assignee. Helpers,
substitutions and old frozen positions before re-entry do not count. Future cohort
publication does not exit early. Reads and selection/acceptance apply the same due
predicate before administrative reconciliation persists its audited exit.

Permanent departure is an explicit administrative `permanentDepartureReason` on
`reconcileMembership`, accepted only for inactive/missing members. Inactivity alone
keeps compensation. Membership, both reserves, pending-credit cancellation, matching
claim release, type-ledger increments and exact audit images commit together. A
later completion records historical service with an already cancelled credit;
reactivation starts a new reserve entry and cannot resurrect cancelled history.
Cancelled credits pass shared publication parsing but never exempt their ordinary
owner; source checks prevent older forward/inverse operations restoring that balance.

Both native clients decode and distinctly display cancelled credit history in
English and Spanish. See [ADR-0015](../../../docs/decisions/0015-record-explicit-coverage-membership-lifecycle.md)
and its [Spanish version](../../../docs-es/decisions/0015-registrar-ciclo-explicito-de-pertenencia-en-coberturas.md).

The amended reader/selection refuses active legacy reserves without a captured
entry boundary. It does not invent migration evidence. The administrative native
command UI, periodic live reconciliation and legacy-data migration belong to the
pending shared integration/activation, not this local implementation.

Validation completed:

- Functions lint/build and 52 focused pure tests passed. The full Firestore/Rules/workflow run passed 144/144 (129 prior + 15 lifecycle regressions); Auth/HTTP passed 22/22, all without skips/failures. Logs: `/tmp/hu089-lifecycle-functions-final.log`.
- Two new pure publication tests passed under Node 22; the permanent-cancellation forward/inverse CAS regression passed separately 1/1 in the fixed emulator (`/tmp/hu089-lifecycle-publication-cas.log`). These three tests were added after the full suite had loaded its files and are recorded separately rather than inflating its count.
- Android: 506 unit tests passed; lint passed with zero errors and the existing 135 warnings/two hints. The standard connected API 29 run passed 23 ordinary tests; four opt-in Coverage/Sheets journeys exited through their existing assumptions (reported as failures in XML while Gradle succeeds). No physical accessibility run is claimed. Logs: `/tmp/hu089-lifecycle-android.log`, `/tmp/hu089-lifecycle-android-connected-standard.log`.
- iOS: canonical release gate passed on Xcode 27.1 / iPhone 17 iOS 26.5 (`091D93C1-5A53-40D0-887E-83F81A8E0326`): 925 passed, five expected opt-in/conditional skips, zero failures/runtime warnings. Lint 511 files clean; Debug/Release builds passed. Result: `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/hu089-lifecycle-ios-yogrehp3/release-gate.xcresult`. Synthetic Firebase configurations were restored exactly.
- Independent backend/native/documentation review completed, including the four Swift source files and EN/ES ADR parity. In-scope findings were fixed and their regressions passed; final `git diff --check` is clean.

The maintainer requested commit and push of the validated lifecycle block on 2026-10-11. This delivery includes backend, both native clients, regression tests and bilingual ADR-0015 on `codex/hu-089-coverage-policy-amendments`, following `1fc072b4`. The tracker records the resulting commit after remote verification. No deployment, live notification or real-data mutation is included. Ten-week spacing and final story review remain pending.

## Ordinary-delivery spacing block — 2026-10-11

The maintainer authorized this next grouped implementation block. Apply 70 calendar
days to immutable ordinary delivery owners in distinct rounds through the existing
planner and governed source/bundle/publication path. Preserve published prefixes,
queue order, credit algorithm and adjacent lead/helper safety. Capture all published
delivery history and exact reasoned current-authority administrative approvals.
Validate spacing independently of credit enablement and bind full source evidence
in both forward and inverse transactions. See bilingual ADR-0016.

Implemented and independently reviewed. A ten-owner weekly cohort passes the exact
70-day boundary without moving queue, dates or helpers. A nine-owner cohort requires
each actual short pair to be explicitly authorized. Credit compression cannot
silently bypass spacing. Cross-season history, inherited prefixes, DST boundaries,
unused/stale approvals and adjacent lead/helper rejection are covered.

The administrative command writes only immutable approval and actor-bound receipt.
The producer derives its source from published records and current administrator
permissions, not supplied history. The bundle binds that source and current
canonical authority. Full forward/inverse tests apply a real exception, preserve
published history and reject date/owner/round/new-row/approval/permission drift
without partial writes. Recovery passes with 991 retained historical rows plus
60 own newly published deliveries. Strict and phase1 compatibility Rules deny all
client access to the new private collections, including authenticated admins.
Stable spacing failure codes retain delivery scope without publishing raw evidence.

Validation completed under Node 22:

- Functions lint/build passed. Planning unit lane: 294 passed, 51 existing
  emulator-dependent skips, zero failures. Coverage pure lane: 63/63 passed,
  including 11 new spacing cases. Log: `/tmp/hu089-spacing-unit.log`.
- Final focused spacing/request-lifecycle rerun: 28/28 passed without skips,
  including the added public-summary scope/privacy regression.
  Log: `/tmp/hu089-spacing-final-scope.log`.
- Focused new spacing emulator file: 14/14 passed, zero skips/failures.
  Log: `/tmp/hu089-spacing-subagent-emulator-green.log`.
- Complete coverage Firestore/Rules/publication workflow: 161/161 passed; Auth/HTTP:
  22/22 passed, both without skips/failures. These runs use only the fixed
  `demo-reguerta-hu084-coverage` emulator. Final log:
  `/tmp/hu089-spacing-emulator-final.log`. Owned emulators shut down normally.
- Independent backend/documentation review and `git diff --check` passed.
  No native files changed; both planning failure models retain string fields and
  generic existing failure feedback. Public shift/coverage projection contracts
  remain compatible. Native runtime gates were not repeated for this backend block.

All three local HU-089 functional blocks are implemented. On 2026-10-11 the
maintainer requested commit/push of this spacing block after `d7149ab8`, followed
by final combined story review. The definitive pushed hash is recorded in the
tracker after remote verification. Administrative native commands, live composition,
legacy migration and activation remain part of HU-084. Collective ratification is
still pending. No real data, shared deployment or real notification was used.
