# Architecture

We will build both iOS and Android using MVVM and Clean Architecture.

Goals:
- Keep a shared mental model across platforms.
- Align naming for variables, functions, folders, and feature structure whenever possible.
- Enable parallel development with minimal translation overhead between teams.

High-level structure:
- Presentation: MVVM (Views/Composables -> ViewModel -> UI State)
- Domain: Use cases / business rules
- Data: Repositories and data sources

## Swift type abstraction policy

For iOS, choose the narrowest abstraction that preserves the real contract:

- Use a concrete type when composition fixes one implementation and that boundary does not support substitution.
- Use a generic parameter or `some Protocol` when each instance has one statically known concrete type.
- Use `any Protocol` only for runtime substitution, heterogeneous storage, or a deliberately non-generic boundary.

Do not remove only the `any` keyword as a cleanup. A protocol name used as a type remains an existential in language modes that still allow the implicit spelling. In particular, keep `any Error` when a boundary intentionally accepts heterogeneous errors; use a concrete error or typed throws when the contract is closed.

During focused reviews, use Swift's opt-in `ExistentialType` diagnostic to inventory existential costs. Classify each warning instead of turning the diagnostic into a zero-warning gate, because valid dependency-injection boundaries and heterogeneous values are also reported. SwiftLint regex rules must not globally prohibit `any`: they cannot determine whether runtime type erasure is required.

### Existential audit

Run the opt-in audit from the repository root:

```bash
ios/Reguerta/scripts/audit-swift-existentials.sh
```

The default `--diff` mode reports only diagnostics on Swift lines changed from the merge base with `origin/main`. Use `--base <git-ref>` to select another comparison ref, or `--all` to inventory all project-source diagnostics. The script builds the app and test targets in an isolated temporary Derived Data directory with warnings allowed, then removes that directory.

The audit is informational: findings exit successfully so that every existential can be classified by contract. Invalid arguments, Git/reporting errors, and build failures exit unsuccessfully. Xcode and Python 3 are required.

Backend services:
- Database: Firebase Firestore
- Auth: Firebase Authentication
- Storage: Firebase Storage
- Crash reporting: Firebase Crashlytics
- Push notifications: Firebase Cloud Messaging (FCM)

Related decisions live in `../decisions`.
Technical stack details live in `../tech-stack/README.md`.
