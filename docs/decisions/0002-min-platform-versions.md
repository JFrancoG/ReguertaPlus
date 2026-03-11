# ADR-0002: Set Minimum Platform Versions

## Status

Accepted

## Date

2026-02-05

## Context

We need a baseline for platform features, SDK availability, and testing scope
that keeps development efficient while supporting a reasonable user base.

## Decision

- iOS minimum version: iOS 26
- Android minimum API level: 29 (Android 10)

## Consequences

### Positive

- Access to modern APIs and tooling
- Simpler compatibility matrix
- Lower maintenance and QA overhead

### Negative

- Drops older devices/OS versions
- Smaller install base on older Android devices
