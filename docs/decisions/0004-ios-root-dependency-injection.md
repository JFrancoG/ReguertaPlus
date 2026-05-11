# ADR-0004: Use Root Dependency Injection for iOS SwiftUI

## Status

Accepted

## Date

2026-05-11

## Context

The iOS app root had started to mix SwiftUI composition, app delegate concerns,
Firebase repository construction, session bootstrapping, splash routing, and
home navigation state. That made the main view harder to preview and test, and
it encouraged hidden dependencies in presentation code.

The project already uses MVVM and Clean Architecture. iOS should keep that
direction by making root dependencies explicit and by keeping SwiftUI views
declarative.

## Decision

Use a lightweight `ReguertaAppEnvironment` container at iOS app bootstrap. The
container builds live services, repositories, root view models, and preview
replacements, then SwiftUI injects it from `ReguertaApp` through the environment.

SwiftUI views in the root flow must not define explicit `init` methods, create
repositories/services, or contain business logic. Root workflow state belongs in
`AccessRootViewModel`; session and feature work remains in dedicated view models
and use cases.

## Consequences

### Positive

- App bootstrap, delegate setup, dependency construction, and view composition
  have clearer boundaries.
- `ContentView` stays declarative and preview-friendly.
- Root navigation and splash/startup behavior can be unit tested without live
  Firebase dependencies.
- Future iOS features can reuse the same environment/factory pattern.

### Negative

- The root container adds a small amount of boilerplate.
- Some existing route extensions still need incremental extraction into smaller
  feature views/view models.

## Notes

Firebase must be configured before live Firebase-backed services are created.
Use an idempotent bootstrap helper so the SwiftUI `App` and `AppDelegate` do not
depend on fragile initialization ordering.

Orders is the first feature slice migrated after the root bootstrap. Its
SwiftUI routes receive root-owned view models, while checkout, previous orders,
received orders, producer status writes, and cart persistence are accessed
through `OrdersRepository` and `MyOrderCartStore` dependencies.

Products is the second migrated feature slice. `AccessRootViewModel` owns
`ProductsRouteViewModel`, which receives product, member, seasonal commitment,
image pipeline, and clock dependencies from `ProductsFeatureDependencies`.
`SessionViewModel` remains the session source, but it no longer owns catalog
state, product drafts, product image upload, catalog visibility changes, or the
ordering product feed.
