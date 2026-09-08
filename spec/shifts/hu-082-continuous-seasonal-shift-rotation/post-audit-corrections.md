# HU-082 post-delivery audit corrections

## Authority and scope

- Execution issue: #266; original delivery: PR #275 / `78f018e`.
- Branch: `codex/hu-082-audit-corrections`.
- Status: implementation and local validation complete. On 2026-09-08 the
  maintainer authorized commit, push, PR, merge, issue closure and branch cleanup,
  explicitly including the existing Coil 3.6.0 → 3.6.2 update.
- The correction worktree preserves the continuous rotation domain. The exact Coil
  edit is included as a separate dependency commit in the same delivery.
- HU-083 remains pending. Shared Firebase/Sheets changes and deployment remain
  outside this authorization. The definitive Git result is recorded in issue #266.

## Current plan

1. Correct the five demonstrated integration failures with independent regression
   scenarios: nullable iOS calendar authority; durable v2 request retries; exact
   per-administrator request observation; observation recovery after transient
   failures; and no new Messaging call after transport timeout or lease expiry.
2. Replace Firestore SDK-private transaction sealing with public transaction APIs,
   an immutable logical mutation manifest, conservative application admission
   limits and server-enforced atomicity. Keep version revalidation, replay,
   public-write fences and operation evidence. Do not describe an application
   estimate as exact wire or index accounting. Record the changed guarantee in a
   bilingual ADR and reconcile downstream contracts before HU-083.
3. Consolidate notification recovery around the distinction between no external
   submission and a possibly delivered submission. Remove redundant validation
   and unsupported alternative execution paths where the call graph proves they
   are unnecessary; retain honest unknown outcomes, current authorization,
   idempotent events and a bounded incident/recovery procedure.
4. Independently review the resulting changes and run the relevant Functions,
   emulator, Android and iOS validation gates. Record exact evidence and any
   remaining environment limitation here.

## Acceptance and progress

- [x] iOS sends explicit nulls for an authority with no active bundle.
- [x] A transient v2 worker failure can resume the same request to one terminal;
      legacy non-idempotent processing is not accidentally enabled for retries.
- [x] Both apps observe their selected request despite another administrator's
      newer request, and recover observation after a transient source/candidate error.
- [x] iOS has no permanent two-second polling of recent global requests.
- [x] Timeout/lease expiry prevents every subsequent SDK send in a mixed-target
      transport, while an already-started call remains possibly delivered.
- [x] Activation and recovery use supported Firestore APIs without private SDK
      interception, preserve atomicity/replay and reject oversized application plans.
- [x] Notification recovery complexity is reduced with preserved explicit guarantees.
- [x] Current EN/ES contracts and HU-083 handoff describe the actual implementation.
- [x] Focused regressions, complete applicable gates and independent review pass.

## Validation evidence

- Functions: `npm run lint` and `npm run build` passed on the correction sources.
- Integrated backend gate: **501 passed, 0 failed, 0 skipped**. Every root
  `test/*.test.cjs` suite except the non-emulator HU-086 unit suite ran serially
  against Firestore Emulator on port 8787, together with strict role-access and
  producer-order-status Rules suites. All project IDs were isolated `demo-*` IDs.
  Log: `/tmp/hu082-full-backend-gate-green.log`.
- HU-086 non-emulator regression: **27/27 passed** with
  `env -u FIRESTORE_EMULATOR_HOST node --test test/migrate-legacy-orders.test.cjs`.
  Its live-routing rejection test requires the absence of emulator routing; the
  initial broad run exposed that test-environment mismatch. The separate emulator
  migration test remained in the 501-test gate and passed.
- The first integrated run also caught a changed missing-evidence error code in
  the shared recovery reader. The implementation now preserves
  `invalid_planning_transaction`; the unmodified regression passed in the final run.
- Android: **480/480 unit tests**, **23/23 instrumented tests** on
  `Pixel_8_Pro_API_35` / `emulator-5554` (Android 15). `app:lintDebug` passed with
  141 warnings and 2 hints outside the four changed files; no diagnostics in those
  files. External native-library stripping warnings are unchanged.
- Independent review covered Android selection/recovery, trigger authorization and
  inventory, transport cancellation, shared recovery evidence, and iOS observation.
  The identified projection, authorization and environment-boundary defects were
  corrected before final validation.
- iOS final canonical gate: **895 total, 894 passed, 1 skipped, 0 failed**; runner
  exited 0. `./scripts/validate-ios.sh release-gate --destination
  'platform=iOS Simulator,id=087C0B4D-8C32-419D-8B71-1763CAC6D46B'` on iPhone 17,
  iOS 26.5. Debug/Release builds and the six target/configuration isolation checks
  passed. SwiftLint reported **0 violations in 485 files**.
  The existing skipped case is `ReguertaUITestsLaunchTests/testLaunch`, disabled
  for flaky launch screenshots on test clones. All nine new regression executions
  passed: two calendar null cases, five observation/recovery cases and two crossed
  environment cases. Final log: `/tmp/reguerta-hu082-ios-release-gate-final.log`.
- iOS intermediate evidence is not a substitute for that final gate: the first
  focused MCP run used its active physical-device destination, where one existing
  host-source-file assertion could not read the host filesystem. A later simulator
  gate was explicitly interrupted by its owner to add the environment guard; only
  the final complete simulator result is counted above. The final runner emitted
  Xcode `IDELaunchParametersSnapshot` / `no debugger version` diagnostics despite
  passing; those are retained as tool diagnostics, not hidden as a warning-free log.
- `git diff --check` and changed-document local link verification passed.
  The Coil change was copied byte-for-byte from the original checkout; delivery
  validation for that dependency update is recorded below.

## Delivery validation

- Coil 3.6.2: repeated Android unit **480/480** and connected **23/23** gates on
  `Pixel_8_Pro_API_35` / `emulator-5554`. Lint: 0 errors, 139 warnings and 2 hints,
  with none in the four corrected files. Gradle `dependencyInsight` confirms
  all `io.coil-kt.coil3` modules resolve to 3.6.2 in `debugRuntimeClasspath`.
- Functions and iOS gates above are reused: their validated behavior is unchanged.
  Final Swift source-style audit normalized seven whitespace-only constructions;
  whitespace-stripped bytes match exactly before/after and focused strict SwiftLint
  passed with 0 violations. The 13-file Swift diff audit has no remaining findings. No extra build
  or test run is needed for that non-functional formatting under the minimal-change
  exception. No project or concurrency setting is changed.

## Resulting scope

- Backend production source is approximately **1,250 lines smaller**, including
  new retry and recovery code. SDK-private interception and its introspection tests
  were removed; pure rotation planners, atomic publication/recovery, writer fences,
  before-images, and notification ambiguity guarantees remain.
- ADR-0014 and current EN/ES field contracts replace exact-protobuf claims with
  public APIs, conservative admission and schema-v2 returned/read-back receipts.
  `npm run test:shift-planning:admission` is the renamed focused entrypoint.
- The writer inventory is `hu082-affected-writers-v2`; the versioned retry trigger
  must be captured/drained alongside legacy delivery. The new composite request
  index must be deployed and verified READY before the corrected apps are enabled.
- No shared Firebase/Sheets changes or HU-083 execution occurred. Git delivery
  follows the maintainer's explicit closeout instruction, with final PR/merge and
  branch-cleanup evidence in issue #266.
