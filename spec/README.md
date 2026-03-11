# Spec-Driven Framework (Reguerta)

This directory implements the workflow:

Story -> spec.md -> plan.md -> tasks.md -> issue

## Structure

- spec/<feature-domain>/<hu-slug>/spec.md
- spec/<feature-domain>/<hu-slug>/plan.md
- spec/<feature-domain>/<hu-slug>/tasks.md
- spec/issues/hu-xxx-*.md
- spec/_templates/*

## Conventions

- 1 story = 1 issue.
- Language: English.
- issue_id in each spec.md starts as TBD until the real issue is created.
- Allowed status markers in tasks.md: [ ], [~], [x], [!].
- Android/iOS parity is required when applicable.

## Current domains

- app
- orders
- notifications
- products
- producers
- admin
- news
- profiles
- shifts
- reviewer
- ai

## Source artifacts

Specs are derived from:
- docs/requirements/mvp-requirements-reguerta-v1.md
- docs/requirements/user-stories-mvp-reguerta-v1.md
- docs/requirements/firestore-structure-mvp-proposal-v1.md
