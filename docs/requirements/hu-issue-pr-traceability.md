# HU / Issue / PR Traceability

Date: 2026-03-30

## Purpose

This document makes the history easier to follow when roadmap user stories (`HU-xxx`) do not match GitHub issue or PR numbers.

## Rule

- `HU-xxx` is the canonical roadmap identifier.
- GitHub issue and PR numbers are creation-order identifiers and are not expected to match the HU number.
- Issue and PR titles must always start with the canonical `HU-xxx`.
- If a HU id collides with an older historical item, the new story must be renumbered instead of reusing the existing id.

## Current normalized mapping

| Roadmap HU | Scope | GitHub issue | GitHub PR | Status |
| --- | --- | --- | --- | --- |
| HU-021 | Startup remote version gate | n/a | #51 | merged |
| HU-022 | Critical-data freshness before order | n/a | #52 | merged |
| HU-023 | Session lifecycle refresh and expiry UX | n/a | #53 | merged |
| HU-038 | Unauthorized authenticated user home gating | #54 | #55 | merged |
| HU-039 | Role-aware home shell and drawer navigation | #56 | n/a | in progress |

## Historical note

- Older auth/design-track work already consumed HU ids in the `HU-027..HU-037` range in GitHub history.
- To preserve traceability, the current MVP access/home stories were renumbered to `HU-038` and `HU-039` instead of rewriting old merged artifacts.
