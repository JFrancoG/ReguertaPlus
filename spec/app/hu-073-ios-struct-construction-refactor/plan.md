# Plan - HU-073 (iOS struct construction and Sendable refactor)

## 1. Technical approach

Perform a behavior-preserving Swift refactor in small, compiler-validated
batches. Use the syntax-tree inventory as the baseline instead of a broad text
replacement.

For each primary-declaration initializer, decide between two outcomes:

- remove it when the synthesized memberwise initializer preserves the required
  signature and access;
- otherwise move it verbatim to an extension in the same file.

For each explicit internal-struct `Sendable` conformance, remove only the
nominal conformance and rely on strict-concurrency diagnostics to confirm
inference. Do not alter `@Sendable` closures or protocol contracts.

## 2. Layer impact

- Domain: construction placement and inferred sendability only.
- Data: dependency/DTO initializer placement and inferred sendability only.
- Presentation/DesignSystem: initializer placement without UI composition or
  visual changes.
- Tests: the same rules for fixtures and doubles.
- Governance: record the permanent convention in `AGENTS.md`.
- Android/Backend: no code changes.

## 3. Phased implementation

### Phase 1 - Baseline and governance

- Preserve the 329-file syntax audit and candidate counts.
- Link issue #245, branch, and HU artifacts.
- Add the struct construction and sendability rule to `AGENTS.md`.
- Keep the corrected `NewsArticle` as the first implementation example.

### Phase 2 - Domain

- Move or remove the 11 Domain initializers.
- Remove redundant explicit `Sendable` from internal Domain structs.
- Refresh diagnostics and build before continuing.

### Phase 3 - Data and App

- Move or remove the 17 Data and one App initializers.
- Preserve private-property access, injected dependencies, default values, and
  composition ordering.
- Remove redundant explicit internal-struct `Sendable` conformances.
- Refresh diagnostics and build before continuing.

### Phase 4 - Presentation, DesignSystem, and tests

- Move or remove the five Presentation, five DesignSystem, and one test-double
  initializers.
- Preserve `@ViewBuilder`, closure escaping, preview setup, and SwiftUI call
  sites.
- Remove the remaining redundant struct `Sendable` conformances.
- Run the dedicated SwiftUI review because View source files are touched.

### Phase 5 - Final verification

- Re-run the syntax-tree inventory and require zero primary-struct
  initializers.
- Require zero explicit internal-struct `Sendable` conformances unless an
  exception is demonstrated and documented.
- Run `git diff --check`, Xcode diagnostics, build, and the iOS tests required
  by `AGENTS.md`.
- Run independent architecture/concurrency and SwiftUI reviews.
- Update issue #245 and HU evidence.

## 4. Test strategy

- Structural: compare baseline and final syntax inventories.
- Compiler: strict-concurrency diagnostics and a clean build after each layer.
- Focused tests: affected Domain/Data/Presentation suites when a batch changes
  compiler-visible construction or isolation.
- Regression: full iOS test command from `AGENTS.md` before closure.
- UI: no visual claims; run the SwiftUI review and previews only where needed
  to verify unchanged generic `@ViewBuilder` construction.

## 5. Alternatives and constraints

- Do not run a repository-wide textual replacement: it could touch closures,
  protocols, enums, or unrelated declarations.
- Do not replace meaningful initializers with ceremonial factories.
- Do not weaken private storage or invariants to retain a synthesized
  initializer.
- Do not add a regex-only lint rule unless it proves reliable across nested
  structs, extensions, comments, and strings.

## 6. Delivery boundary

This bootstrap creates issue #245, the HU branch, governance, and planning
artifacts and preserves the first `NewsArticle` correction. Commit, push, PR,
merge, issue closure, and branch cleanup require later explicit authorization.
