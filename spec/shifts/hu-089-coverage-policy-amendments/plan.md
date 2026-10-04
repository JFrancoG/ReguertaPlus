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

This remains a fixed-emulator opt-in. No migration of old synthetic cases or activation in shared environments is performed. Reserve exit, permanent-departure credit cancellation and 10-week ordinary delivery spacing remain pending.

## Validation of the connected block

- Functions: lint/build, 52 pure tests, 129 Firestore/Rules/workflow tests (including seven new deadline transactions) and 22 Auth/HTTP tests passed, with zero failures/skips. Node 22.23.3. Final logs: `/tmp/hu089-native-functions-final.log` and `/tmp/hu089-native-functions.log` (Auth/HTTP).
- Android: 505 unit tests passed; `lintDebug` passed with its existing 135 warnings and two hints, zero errors. Connected API 29 run passed 23 ordinary tests; the Sheets opt-in test exited through its existing assumption (reported as one failure in XML although Gradle succeeds). Coverage transport opt-in journeys were excluded; this does not certify a new physical-device journey. Logs: `/tmp/hu089-android-final.log`, `/tmp/hu089-android-connected.log`.
- iOS: canonical `release-gate` passed on iPhone 17 / iOS 26.5 (`091D93C1-5A53-40D0-887E-83F81A8E0326`): 924 passed, five existing opt-in/conditional skips, zero failures; lint 511 files clean, Debug/Release builds passed. Evidence: `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/hu089-final-ios-lyyx6ehe/release-gate.xcresult`. Synthetic Firebase configurations were restored byte-for-byte after the gate. The final guard-only line wrapping passed focused strict SwiftLint; no behavioral changes followed the gate.

Two native regression cases per platform exercise the real repository decoding/presentation path: immediate next-volunteer action with a bounded draft, and mandatory selection versus legacy direct-offer behavior. The backend projection test verifies clock-based phase catch-up, unchanged persisted revision/data and absence of private timing/candidate records. Swift source-style review covered the five changed Swift files; its only heuristic candidate belongs to an unchanged tuple fixture.

The previous physical accessibility/push evidence is not claimed as a rerun of HU-089. No shared deploy, real push or business-data write occurred.
