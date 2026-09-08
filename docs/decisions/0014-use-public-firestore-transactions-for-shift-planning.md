# ADR-0014: Use public Firestore transactions for shift planning

## Status

Accepted for local implementation on 2026-09-08 by the maintainer's authorization
to resolve the HU-082 audit. Partially supersedes ADR-0013's exact SDK transaction
serialization and attempt-acknowledgement requirements. No deployment is authorized.

## Context

HU-082's rotation invariants are sound, but its publication adapter intercepted
private Firestore SDK batches, commit methods and transaction tokens. That added
1,500 lines and made an SDK update depend on application-owned SDK internals. Exact
protobuf size still did not account for server index work. An absent post-commit
receipt could also block recovery despite the operation's committed terminal.

## Decision

1. Keep one atomic transaction for the complete delivery/market publication or
   recovery. Rebuild authoritative inputs on every transaction retry and retain
   current revision checks, write epochs, public-writer fences and before-images.
2. Prepare an immutable, detached logical mutation manifest using the existing
   lossless Firestore-value codec. Apply it through public `Transaction.create`,
   `update` and `delete` APIs. Do not inspect or replace SDK-private members.
3. Admission schema v2 / `public-transaction-v2` records `logicalMutationDigest`,
   `documentWriteCount` and `estimatedRequestBytes`, bound to the operation manifest
   and index configuration. Application limits are 500 writes and 8 MiB estimated
   request size, with a conservative 768 KiB encoded per-document admission limit.
   These are application limits, not a claim about exact wire or index size.
   Firestore enforces its own limits and all-or-nothing commit. HU-085 still proves
   the real forward/inverse workload against its approved indexes in an isolated clone.
4. Attempt outcome schema v2 distinguishes `transactionReturned`, which retains
   the admission evidence, from `operationReadBack`, which records revalidation of
   the committed directional terminal without inventing lost admission evidence.
   A lost response or absent receipt must not repeat the publication: revalidate the
   terminal and retain an idempotent read-back receipt. A receipt never overrides
   mismatched intent, bundle, epoch or recovery authority.
5. Keep notification recovery policy in one complete dispatch-history reader shared
   by reconciliation, incident entry and terminalization. Its decisive boundary is
   whether authenticated submission might have occurred. Unsubmitted work may be
   cancelled; accepted/unknown work requires reconciliation or correction. Existing
   timeboxed incident ownership remains necessary to close unresolved work; it is
   not permission to replay an old intent under a newer epoch.

## Alternatives and consequences

- Retaining the private serializer preserves exact protobuf evidence but introduces
  SDK coupling without proving server index size. It is rejected.
- Splitting public writes into batches would reduce transaction size but break
  installed flat-collection readers' atomic view. It is rejected.
- Native transactions reduce code and maintenance risk. Admission may reject a
  workload the server could accept, and server limits can still reject an admitted
  workload. Such failures preserve the database atomically and require review of
  the workload, not bypassing admission or weakening client isolation.
- The unpublished v1 adapter/outcome configuration is replaced, not silently
  reinterpreted. HU-085 must use `public-transaction-v2` and the v2 evidence contract.
  Rotation, request, candidate, sync-command and public-event schemas stay unchanged.

## Related work

- [HU-082 correction plan](../../spec/shifts/hu-082-continuous-seasonal-shift-rotation/post-audit-corrections.md)
- [ADR-0013](0013-model-shifts-as-continuous-rotations-with-seasonal-projections.md)
- [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)
