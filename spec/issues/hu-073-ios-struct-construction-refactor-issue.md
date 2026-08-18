# [HU-073] Refactor iOS struct construction and Sendable

## Summary

Use Swift's synthesized memberwise initializers and inferred internal
sendability where sufficient. Keep every necessary custom struct initializer
in an extension in the same file without changing behavior or access.

## Links

- GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/245
- Spec: `spec/app/hu-073-ios-struct-construction-refactor/spec.md`
- Plan: `spec/app/hu-073-ios-struct-construction-refactor/plan.md`
- Tasks: `spec/app/hu-073-ios-struct-construction-refactor/tasks.md`

## Acceptance criteria

- No primary struct declaration contains an explicit initializer.
- Redundant memberwise-copy initializers are removed.
- Necessary initializers live in same-file extensions and preserve their API.
- Internal structs rely on inferred `Sendable` unless a real public or generic
  boundary is demonstrated.
- `@Sendable` closures and protocol contracts remain unchanged.
- Strict-concurrency diagnostics, build, and applicable iOS tests pass.
- Repository governance records the convention.
- Android and backend have no code impact.

## Scope

### In scope

- iOS production structs, fixtures, previews, and test doubles.
- Domain, Data, Presentation, DesignSystem, App composition, and tests.
- Struct initializer placement and internal struct sendability declarations.
- Behavior-preserving validation and documentation.

### Out of scope

- Functional or visual changes.
- API or domain redesign.
- `@Sendable` closures and non-struct concurrency contracts.
- Android, backend, Firebase, live data, or deployments.

## Initial inventory

- 329 Swift files parsed without failures.
- 40 primary-declaration initializers in 39 structs and 31 files.
- 102 explicit internal-struct `Sendable` conformances in 57 files.
- `NewsArticle` is the first corrected type.

## Labels

- `enhancement`
- `area:app`
- `platform:ios`
- `priority:P2`
