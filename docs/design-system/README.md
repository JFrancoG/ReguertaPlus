# Design System

This folder defines a living design-system baseline for Reguerta.

Goal: provide shared direction for Android and iOS without freezing product evolution.

## Working Principles

- Use this as guidance, not a cage.
- Prioritize semantic naming over implementation history.
- Keep platform parity on foundations and intent, not pixel-for-pixel clones.
- Prefer incremental migration instead of big-bang rewrites.
- Keep room for product experiments (`experimental` status) before standardizing.

## Structure

- `foundations.md`: canonical token model and naming policy.
- [`color-tokens.json`](color-tokens.json): machine-readable source of truth for semantic colors and their platform mappings.
- [`color-catalog.html`](color-catalog.html): generated, self-contained visual catalog; do not edit it by hand.
- `components.md`: cross-platform component catalog and parity matrix.
- `governance.md`: lifecycle (`experimental -> candidate -> stable -> deprecated`) and update process.
- `migration-backlog.md`: prioritized work to move from current state to clean design-system.
- `source-snapshots/`: raw imported references from current Android/iOS systems.

## How To Use This Folder

1. Read `foundations.md` before creating tokens or styles.
2. Check `components.md` before creating new component APIs.
3. If a change is non-trivial, update `governance.md` decision log and `migration-backlog.md`.
4. Keep `docs` and `docs-es` aligned.

## Color Catalog

The catalog belongs in documentation, not in either app bundle. Production colors continue to live in iOS Assets/Swift and Android theme tokens; the generator verifies those sources against the shared contract before producing the HTML.

Regenerate after changing the contract or a mapped production color:

```sh
python3 scripts/design-system/generate_color_catalog.py
```

Check source parity and detect a stale generated file without modifying it:

```sh
python3 scripts/design-system/generate_color_catalog.py --check
```

## Scope Boundaries

In scope:

- Visual foundations (color, type, spacing, shape, elevation, iconography).
- Reusable primitives and shared component contracts.
- Naming and lifecycle governance.

Out of scope:

- Product feature behavior.
- Business rules.
- Navigation architecture.
