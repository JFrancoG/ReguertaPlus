# HU-083 — accepted closeout, 2026-09-12

The maintainer explicitly accepted the recommended HU-085 deferral and authorized
commit/push, PR, merge, issue closure and branch deletion on 2026-09-12. This is
the current acceptance decision; earlier cut checklists are dated work records.
The definitive delivery result is recorded in [issue #267](https://github.com/JFrancoG/ReguertaPlus/issues/267)
and its linked PR. Acceptance does not assert that the live reset is implemented.

## Accepted scope

Readable seasonal Sheets discovery, generation, merge, bounded import/write-back
and ordinary export are integrated with the existing continuous-rotation contract.
Stable IDs, inherited carryover, completed helper history and rotation ownership
are preserved. Controlled events use retained operation authority and durable
rejection/replay; the legacy import/generation paths are retired in source.

The develop workbook was rebuilt under the maintainer's separate authorization.
The 48-user/32-eligible-member scenario keeps the supplied 27 effective assignees.
The exact 139-write content plan, two-type baseline and clone inverse are retained
privately. Both native clients observe 72 turns, the real import's two-row change,
and restoration of the original 62 records through their real SDK/repositories.
Android dependency updates approved by the maintainer are included. iOS fixes
FoundationModels SDK compatibility and isolates acceptance/command test clients.

## Acceptance reconciliation

| Original criterion group | Accepted result and evidence |
| --- | --- |
| Explicit environment configuration and stable workbook identity | Configuration validation, stable-ID workbook rename/rebuild and read-back; no cross-environment fallback |
| Seasonal creation/merge, carryover, full/incremental/override routes | Local adapter/import/consumer/exported-handler tests; captured-grid market-30 and carryover rehearsal |
| Bounded imports, workbook reservation, replay and ambiguous external outcomes | Import/consumer emulator suites; unknown submissions remain inspect-only |
| Public event authorization, recovery deletion, retention, Rules | Controlled/rejected event and Rules suites; exact reset boundary probe documents missing rollout authority rather than treating the content fixture as executable |
| Ownership, bootstrap, eligibility and predecessor helper continuity | Explicit approved new develop queue; import CAS/ownership tests; native three-phase acceptance |
| Read-only audit, backup, restore and evidence principal | Source capture/restore receipts, revoked auditor, approved workbook backup/rebuild; no shared Firestore replacement |
| Conditional live repair, sole writer, post-drain CAS and final baseline | **Accepted deferral to HU-085.** Current deployed writer is incompatible; no live baseline/reset is claimed |
| Equivalent local pipeline, native read-back and inverse | Captured-grid real import, request/export/notification contract suites, both native repositories and exact clone restoration |
| Shared deployment and production activation | **Excluded from HU-083 and retained in open #269**, together with the runtime reset/recovery implementation below |

The unchecked live-apply steps in the original spec/tasks are not performed steps.
They are satisfied for this story through its explicitly selected deferral branch;
HU-085 must meet them before its own activation can complete. No blanket waiver
of writer containment, event retention or production acceptance is granted.

## Accepted HU-085 transfer

The [complete handoff](hu085-handoff.md) binds the exact private content/baseline
and inverse digests, source-drift receipt and validation evidence. HU-085 must:

1. Implement the bounded runtime-owned reset and inverse using existing publication,
   transaction admission and audit contracts. The 139-write content fixture omits
   forward retention and removes inverse operation authority; the four-case probe
   proves those events reject. It is not an invocation payload for live execution.
2. Preserve recovery terminals, required before-images, event ledgers and advanced
   security epoch while restoring business data. Measure/rehearse the complete
   forward and inverse budgets, including these intentional retained records.
3. Obtain fresh post-drain source evidence, real Drive version and deployed index
   authority; contain old writers/clients and authorize the coordinated shared
   runtime/Rules/workbook activation. Do not reuse the revoked auditor or bypass
   the runtime with the content-rehearsal controller.
4. Preserve the manually prepared current production season's dates, assignees,
   rounds and annotations, and complete deployed event/notification plus native
   acceptance. The next annual generation runs through the app.

`acceptedFinalDeferral = true`; `liveExecutable = false`. This changes acceptance
and ownership of the remaining work, not the contents of immutable prior receipts.
HU-084 remains the separate coverage/credits story; neither #268 nor #269 closes
with HU-083. No HU-085 deployment or production data access is authorized here.

## Validation

- Functions lint/build and the 61-file local union rerun for delivery pass:
  **525 passed, 51 emulator-only skips, zero failures**. Those skipped cases have
  the unchanged emulator coverage below; they are not counted as local passes.
- Prior unchanged backend emulator gate: 275 passing executions in 20 suites,
  including every emulator-only local case; detailed matrix in
  [acceptance-review.md](acceptance-review.md#validation-after-cut-27).
- Exact runtime-boundary probe: 4/4, zero failures/skips, including positive
  retention and rejection/replay for all 72 creates/deletes.
- Reused iOS canonical release gate: 895 passed, one existing screenshot-launch
  skip, zero failures, iPhone 17 / iOS 26.5; SwiftLint 487 files, zero violations.
  SDK26 compatibility typecheck and both Debug/Release builds passed.
- Reused Android: 480 unit tests and exact native acceptance passed; lint adds no
  findings (136 existing warnings and two hints). No physical-device proof claimed.
- Final Swift source-style audit: all five changed files reviewed; 12 recall-tool
  candidates are unchanged historical code outside the diff. No changed-scope
  findings. Native data/presentation parity is covered; Android acceptance does
  not launch an Activity and supplies no screenshot/UI E2E claim.

The full native gate and new runtime-boundary evidence are unchanged since their
successful runs. This closeout edits documentation and adds the already validated
boundary probe; no production behavior changed after `601676e`.
