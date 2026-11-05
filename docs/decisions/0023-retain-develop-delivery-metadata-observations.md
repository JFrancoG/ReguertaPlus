# ADR-0023: Retain distinct observations of a develop delivery

## Status

Accepted on 2026-10-29 through the maintainer's explicit authorization to update
only the four private develop collectors in reguerta-9f27f and verify natural
redelivery. Maintenance admission, migration and business replay remain excluded.

## Context

Read-only provider inspection finds one pending message in each private develop
collector and repeated event_payload_conflict/HTTP500 responses. Those provider
IDs already exist in the intake. The current v1 key binds entryPoint/source/id,
while its digest contains every metadata field; two metadata observations can
therefore collide despite an unchanged document version/core. Changing only
traceparent reproduces this mechanism locally. Current logs do not distinguish
the exact conflicting component, so transport equivalence must not be assumed.

## Decision

Keep the first event envelope and all schema1 deliveries immutable. For the same
validated event/core and exact immutable CloudEvent id/source/type/subject/time/
specversion, retain a differing complete metadata observation as schema2 in the
existing deliveries collection. Bind it to the validated canonical schema1 row;
its key is the SHA256 of {baseDeliveryKey,metadataDigest}, where metadataDigest
is the existing digest of the complete metadata and core. Preserve its original
read times on exact duplicate. Commit observation and existing monotonic counters
before ACK; eventCount stays unchanged. Never normalize/drop metadata or call the
business handler. Core, event-key and immutable-identity conflicts still reject
without ACK, with a sanitized diagnostic dimension.

The inspector reads both versions, rejects orphan/inconsistent observations and
includes every retained row in the set digest. Observations do not claim transport
equivalence, callback terminality, causal drain or maintenance readiness. The five
existing root fields/schema1 remain compatible with the six deployed legacy
wrappers; only the four private collectors need this scoped update.

## Consequences and alternatives

This is a backward-compatible journal extension, not a new workflow/ledger.
Metadata variants create extra rows and advance deliveryCount/captureRevision;
previous set-bound manifests must be refreshed. Persistent identity/core conflicts
remain a separate unresolved error. Historical notices stay unreplayable.

Ignoring metadata, overwriting the canonical delivery or ACKing without retaining
the new observation would lose evidence. Keying only by receiver would still
collide when metadata changes within a receiver. A diagnostic-only deployment
followed by a second update is unnecessary when the same reviewed package can
retain safe observations and still reject/diagnose other conflicts.

## References

- [ADR-0022](0022-cooperate-with-develop-firebase-administrators.md)
- [Intake adapter](../../functions/src/develop-shift-intake.ts)
- [Offline census](../../functions/scripts/inspect-develop-legacy-census.cjs)
