# ADR-0027: Collect coherent develop observations before issuing the writer token

## Status

Accepted for local preparation and rehearsal — 2026-11-02. The maintainer requested
preparation of another develop attempt and offered 20 or 30 minutes of availability.
This decision prepares an explicit **20-minute** variant. It does not authorize its
real execution, credentials, IAM/Drive grants, migration, deployment or production.
The previously consumed single-attempt authorization is not reused.

## Context

The second attempt stopped before native grant because its launch returned before
attending the queued browser action. The private attended interface corrects that
specific launch. Reviewing the entire token budget found a separate composition
problem: each technical, owner and administrator port independently recollected the
same complete Google/workbook/census evidence and requested another human report.
Acquisition, admission and execution consequently required 22 complete observations
after issuing a 300-second token, within 150 seconds of work. Unit tests of isolated
ports did not demonstrate that this real sequence was feasible.

Extending availability without changing this sequence does not solve that problem.
We retain the existing planner, barrier, source CAS, command/receipt and recovery
contracts; no new workflow, worker, journal, provider or live entry point is added.

## Decision

1. Add an explicit optional cooperative v3 observation port. One phase returns a
   complete fresh observation and its owner/administrator projections together.
   Validate the checkpoint and both projections under the existing domain guards.
   Require human reports observed within that phase, not a prior phase or operation.
   Close the observation lease before returning. Obtain another complete observation
   after the callback. A supplied joint port failing never falls back to old reads.
   Strict v1, owner v2 and unmodified v3 callers retain their existing behavior.
2. For an already-held barrier, obtain its immutable retained checkpoint separately
   from live observation. The actual acquisition still collects and retains closure;
   held execution still performs fresh complete checks before and after its callback.
   Retained evidence alone grants no current admission. No TTL cache spans operations.
3. Bind `original-develop-deferred-writer-v1` into the reviewed execution request.
   Only this explicit original-develop variant permits up to 20 minutes. Existing
   copy/default ten-minute limits remain intact. Preparation acquires the closed
   barrier and materializes admission before issuing the writer token. Those steps
   retain their existing persistence/incident behavior and do not execute migration.
4. Issue at most one 300-second writer token after preparation, IAM readiness,
   current identity/isolation/workbook/seal checks. Keep the 120-second minimum IAM
   propagation wait in preparation. The initial evidence collector must finish
   with its existing 30-second reserve before the preparation deadline.
5. Keep work at 150 seconds, file cleanup at 60, IAM cleanup at 90 and OAuth cleanup
   at 120. Keep manifest age at 60 seconds and evidence age at ten minutes; a longer
   operator window does not extend either. Slow mint/readback/human response may
   still reject before mutation or leave a retained uncertain result. Inspect and
   clean up independently; never retry, invert or reopen automatically.

6. Treat the final observation after an owned forward commit separately from the
   frozen admission proof. Pass the actual callback receipt to that phase and
   independently inspect its retained committed afterimages. Require exact
   operation/preparation identity, all expected source payloads/service versions,
   absence of extra source documents and unchanged unrelated census rows. Preserve
   the actual current-source digest separately from the historical causal digest.
   Never manufacture an unchanged-source observation after a legitimate mutation.
   Existing history stays append-only; every new observed event core must match an
   exact owned create/delete before/after image and its service versions. Unknown
   or changed cores reject; events not yet delivered remain unknown and unreplayed.
   This proof is forward-only and grants no inverse, retry or fresh admission.

## Consequences and validation boundary

The intended complete sequence has three full observations during acquisition,
three during admission and two during execution; the token is issued after the
first six. This is a composition target to verify with the real local barrier,
executor and SDK, not a claim that real Google or human response latency is bounded.
A 30-minute variant and a longer-lived token are not introduced.

Rehearse fresh before/after observations, activity/withdrawal/drift, scope/checkpoint
substitution, stale/reused reports, expired manifest after slow mint, preparation
failure without mint, uncertain writes, interruption and independent cleanup.
Measure the complete local path with explicit simulated provider/human delays.
Live authority/file/source evidence must be renewed and the exact operation/window
separately authorized before execution. Android/iOS and production behavior do not
change; assembly ratification and HU-085 activation remain independent gates.

Related decisions: [ADR-0021](0021-use-cooperative-owner-maintenance-for-shift-workbooks.md),
[ADR-0022](0022-cooperate-with-develop-firebase-administrators.md),
[ADR-0026](0026-accept-bounded-develop-historical-effect-risk.md).
