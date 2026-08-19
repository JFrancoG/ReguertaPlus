# AGENTS.md

## Purpose

This file defines how AI coding agents should work in this repository.
Use it as the default operational guide for day-to-day execution.

## Repository Scope

Agents may modify any part of this monorepo when needed:

- `/android`
- `/ios`
- `/functions`
- `/docs`
- `/docs-es`
- `/spec`
- Root-level config files

## Project Snapshot

- Monorepo with Android + iOS apps and Firebase backend.
- Shared architecture target: MVVM + Clean Architecture across platforms.
- Backend: Firebase (Firestore, Auth, Storage, Crashlytics, FCM).
- Minimum platform versions:
  - iOS: 26.0+
  - Android: API 29+

## Cross-Platform Delivery Rule

- Always try to keep Android and iOS feature parity.
- If one platform is blocked, continue delivery on the other platform.
- Do not stop overall progress because one side is temporarily blocked.
- Clearly report any temporary parity gap in the final handoff.

## Skills and Implementation Detail

- Prefer using available skills for platform-specific and UI implementation guidance.
- Android CLI is installed and available; prefer the `android-cli` skill/tooling for Android SDK, emulator, device, and Android Studio-oriented workflows when applicable.
- In Android/Kotlin, resolve deprecation warnings by migrating to the supported modern API whenever one exists. Do not use `@Suppress("DEPRECATION")` as the default fix; any unavoidable compatibility suppression must be narrowly scoped, documented, and reported.
- Do not duplicate detailed UI design rules here; those are handled by skills and future design-system docs.
- Canonical stack definitions live in:
  - `/docs/tech-stack/README.md`
  - `/docs-es/tech-stack/README.md`

## Instruction Conflicts

- If there is any conflict or ambiguity between:
  - this `AGENTS.md`,
  - instructions coming from a skill,
  - or direct user instructions,
  ask the user for clarification before proceeding.
- Do not assume precedence when instructions conflict.

## Branching and Commits

- Agent-created branches must use the `codex/` prefix.
- Before creating any commit, use the `conventional-commits` skill.
- Use Conventional Commits for every commit.
- Keep commit scope focused and messages explicit about platform and layer when relevant.

## Validation Policy

Run validations before closing work, except for minimal/trivial changes.

### Standard validation (default)

Run the relevant checks for touched areas:

- Android (`/android/Reguerta`):
  - `./gradlew app:testDebugUnitTest`
  - `./gradlew app:lintDebug`
  - `./gradlew app:connectedDebugAndroidTest` (when device/emulator is available or UI behavior changed)
- iOS (`/ios/Reguerta`):
  - `xcodebuild -project Reguerta.xcodeproj -scheme Reguerta -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' test`
  - If simulator name is unavailable, use any valid local simulator and report which one was used.
- Functions (`/functions`):
  - `npm run lint`
  - `npm run build`

### Minimal change exception

Full validation may be skipped for minimal, non-behavioral edits (for example: docs text, comments, renames, or tiny refactors with no logic change).
When skipped, explicitly state why in the final handoff.

## Documentation and ADR Hygiene

- If architecture, platform baseline, or backend decisions change, update ADRs in:
  - `/docs/decisions`
  - `/docs-es/decisions`
- Keep English and Spanish docs aligned when updating decision-level documentation.

### Selective Swift Documentation

- In iOS code, use DocC comments for non-trivial APIs whose contracts, invariants,
  side effects, operation ordering, cancellation behavior, units, edge cases,
  errors, or return semantics are not evident from the implementation.
- Keep documentation semantic: explain why the contract matters and what callers
  may rely on instead of narrating the function body.
- Skip obvious stored properties, mechanical `Codable` implementations, trivial
  private helpers, declarative Views, and tests.
- Update the DocC comment whenever the documented contract changes.

### Swift Actor Isolation and Concurrency

- The accepted target policy is that all first-party Swift targets in
  `/ios/Reguerta` use `SWIFT_DEFAULT_ACTOR_ISOLATION = nonisolated` from one
  inherited project-level authority in every configuration. HU-074 completed
  and validated that migration locally under ADR-0011; a future target that
  does not inherit the setting is architectural drift, not an exception.
- Keep Swift 6 strict concurrency set to `complete`. Do not weaken diagnostics
  to make a migration compile.
- Keep `SWIFT_APPROACHABLE_CONCURRENCY = YES` enabled. Treat it as an
  independent concurrency setting; it does not replace explicit actor
  ownership or the `nonisolated` module policy.
- Declare `@MainActor` explicitly on observable presentation models, Stores,
  and composition operations that genuinely own UI state.
- Keep Domain and Data nonisolated by default. Give mutable infrastructure
  state one explicit actor or synchronization owner; preserve non-suspending
  security and routing fences when their ordering is part of the contract.
- Keep Firebase and other SDK reference types inside the appropriate isolated
  infrastructure adapter: Data for persistence/service implementations, or
  App for platform lifecycle and composition responsibilities. Never expose
  live SDK references to Domain or Presentation or transfer them across actor
  boundaries; transfer immutable Domain values, DTOs, or typed errors instead.
- Do not introduce `@preconcurrency`, `@unchecked Sendable`,
  `nonisolated(unsafe)`, `Task.detached`, GCD, or an equivalent escape as a
  compilation workaround. A demonstrated unavoidable exception requires
  explicit user approval, an ADR, a documented ownership invariant, focused
  tests, and a removal condition.
- Do not repeat `nonisolated` when the module default already expresses the
  contract. Keep it when it overrides an isolated context or is semantically
  required by a conformance or SDK boundary.
- Compile tests under the same default-isolation policy as production and
  isolate a test suite to `MainActor` only when the system under test requires
  it.

### Swift Struct Construction and Sendability

- Do not declare explicit initializers inside the primary declaration of a Swift `struct`.
- Use the synthesized memberwise initializer when assigning stored properties already expresses the complete construction contract.
- Put any necessary initializer in an extension in the same file, including initializers that add validation, defaults, injection, composition, transformation, `@ViewBuilder`, or custom `Decodable` behavior.
- Do not add explicit `Sendable` conformance to internal `struct` or `enum` declarations when the compiler can infer it from their stored or associated values.
- Keep explicit `Sendable` only for a demonstrated public or generic boundary that requires it; document and report that boundary.
- Apply these rules to production code, fixtures, previews, and test doubles.

### Swift Signature Formatting

- Use 120 columns, including indentation, as the preferred maximum Swift line width.
- Keep a `func`, `init`, or `subscript` declaration on one line when its complete signature fits within 120 columns and has at most three simple parameters. Count attributes only when they share the declaration line; also count `async`/`throws`, the return type, and the opening brace when present.
- Treat a declaration attribute placed on its own line, whether single-line or multiline, as a separate layout unit. Apply the 120-column and parameter-complexity rules to the declaration header after those attributes. A separated attribute does not by itself require a vertical parameter list.
- Use vertical formatting for four or more parameters or for complex signatures containing closures or function types, nested generics or tuples, closure attributes, multiline default values, or generic requirements. Put one parameter on each line, align the closing delimiter with the declaration, and avoid hybrid wrapping.
- Keep `let` and `var` declarations, including their type annotation, on one line when the complete declaration fits within 120 columns and has no multiline initializer. A function type, `@Sendable`, or a short generic does not require fragmentation by itself.
- Keep a `guard condition else { exit }` statement on one line when it fits within 120 columns and `exit` is one simple immediate transfer such as `return`, `return nil`, `return false`, `continue`, `break`, or a simple `throw`. Retain multiline form for comments, multiline conditions, complex calls, or additional logic; do not extend this exception to `if`, loops, or effectful closures.
- Keep a complete function on one line only when it is a genuinely trivial pure predicate, accessor, adapter, or test double whose single obvious expression fits with the signature. Keep business operations, mutations, `await`, `try`, control flow, and effectful calls multiline.
- Apply these rules to new and touched declarations. Keep historical formatting cleanup in separate, non-functional changes.

## Execution Style

- Make progress autonomously.
- Ask concise clarifying questions only when blocked by missing decisions.
- Prefer targeted, surgical edits over broad refactors unless requested.
- Preserve existing repository conventions and naming.

## Final Handoff Format

Include:

- What changed (by area/platform).
- Validation run (or why skipped under minimal-change policy).
- Any known parity gap and next suggested step.
