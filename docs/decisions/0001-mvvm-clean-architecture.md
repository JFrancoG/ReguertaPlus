# ADR-0001: Use MVVM + Clean Architecture Across iOS and Android

## Status

Accepted

## Date

2026-02-05

## Context

We are building iOS and Android in parallel and want to keep feature delivery
and structure aligned. Without a shared architectural approach, code structure
and naming can diverge quickly, slowing development and making cross-platform
collaboration harder.

## Decision

Adopt MVVM for presentation and Clean Architecture for overall structure on
both iOS and Android. We will align naming for variables, functions, folders,
modules, and feature structure whenever feasible.

## Consequences

### Positive

- Consistent mental model across platforms
- Easier parallel development and cross-review
- Clear separation of concerns (presentation, domain, data)
- Better testability and maintainability

### Negative

- More upfront structure and boilerplate
- Requires discipline to keep naming aligned over time

## Notes

Platform-specific constraints can override alignment when necessary, but the
default is to keep parity.
