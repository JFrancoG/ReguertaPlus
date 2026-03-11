# ADR-0003: Use Firebase as Backend

## Status

Accepted

## Date

2026-02-05

## Context

We need a backend that is fast to implement, low maintenance, and fits a
mobile-first product. We also want a generous free tier while we validate
product-market fit and scale gradually.

## Decision

Use Firebase as the backend platform, specifically:
- Database: Firestore
- Auth: Firebase Authentication
- Storage: Firebase Storage
- Crash reporting: Firebase Crashlytics
- Push notifications: Firebase Cloud Messaging (FCM)

## Rationale

Firebase provides a simple, managed backend with a strong free tier and a
cohesive set of services that reduce operational overhead and speed up
iteration.

## Consequences

### Positive

- Rapid development and simpler infrastructure
- Reduced DevOps workload
- Built-in services for auth, storage, crash reporting, and notifications

### Negative

- Vendor lock-in considerations
- Less flexibility than a custom backend for complex requirements
