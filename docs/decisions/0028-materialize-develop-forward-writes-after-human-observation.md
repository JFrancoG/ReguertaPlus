# ADR-0028 · Materialize the Develop forward transaction after the last pre-write observation

## Status

Adopted for local rehearsal on 2026-11-20. Applies to the forward migration of the original Develop workbook under [ADR-0027](0027-collect-coherent-develop-observations-before-writer-token.md). Each shared execution requires a reviewed package and its own authorization.

## Context

In attempt 13, only 3.651 seconds of manifest validity remained when the operator received the last human reply before the Firestore write. The journal and source still needed verification. A local replay reproduced expiry. The live journal recorded the operation incident but omitted the initiating exception. [Attempt 13 readback](../testing/hu084-develop-initial-evidence-window.md#attempt-13-closed-during-firestore-execution--2026-11-20)

## Decision

1. Before issuing the writer credential, retain the complete admission manifest for the authorized scope. Verify it on entry to execution. The pre-write human observation then runs under the held barrier.
2. After that observation, reread the source and its Firestore versions in a read-only transaction. Rebuild the complete transaction using the admission timestamp and compare it with the admitted manifest. Only an exact match permits building the execution manifest from that same snapshot using the current clock. Record the execution manifest with the digests of the admission and its manifest.
3. Inside the write transaction, reread the source and verify the exact execution manifest. Check its 60-second lifetime and the work budget through the last write and until the callback returns to the SDK. Observe the barrier again after the operation. Retain the first classified failure, its phase and time before recording the incident. Inspect ambiguous outcomes and remove temporary permissions.

## Consequences

The extra read-only transaction costs time inside the existing writer budget. Human response time can still exhaust the work window or the reserve for Sheets and cleanup. A verified local run establishes ordering and data integrity. Provider latency and the shared migration require separate evidence. [Rehearsal and next decision](../testing/hu084-develop-initial-evidence-window.md#post-attempt-13-local-rehearsal)
