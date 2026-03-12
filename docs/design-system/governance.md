# Governance

This process keeps the design-system useful, adaptable, and auditable.

## 1. Lifecycle

- `experimental`: free to evolve quickly.
- `candidate`: validated in real screens, pending final naming/contract review.
- `stable`: default for new features.
- `deprecated`: migration path defined; no new usage.

## 2. Change Policy

Any non-trivial design-system change should include:

1. Why the change exists (problem/opportunity).
2. Token/component impact.
3. Cross-platform implications.
4. Migration notes (if breaking or renamed).

## 3. Acceptance Criteria For `stable`

- Used in at least one real Android flow and one real iOS flow.
- Naming is semantic and not tied to one feature.
- Accessibility baseline checked.
- Documentation updated in both `docs` and `docs-es`.

## 4. Backward Compatibility

- Prefer aliases first, removal later.
- Mark old names as deprecated before deletion.
- Track removals in `migration-backlog.md`.

## 5. Decision Log (initial)

- 2026-03-12: imported Android/iOS current design-system references as source snapshots.
- 2026-03-12: established semantic-first naming strategy and lifecycle governance.
- 2026-03-12: decided to keep platform-native implementations while aligning shared intent.
