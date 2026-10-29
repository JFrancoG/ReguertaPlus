# ADR-0025: Separate contained deliveries from business drain

## Status

Accepted for local implementation and isolated rehearsal on 2026-10-29 after the
maintainer selected “Aceptar la corrección acotada (recomendado)”. Amends only the
capture-only delivery-count requirement of ADR-0024 in develop. No shared deployment
or real maintenance/migration is authorized by this decision.

## Context

ADR-0024 admits reviewed capture-only handlers but still requires every writer and
all eight causal-drain counts to be numeric zero. The real adapter cannot establish
current invocation counts; missing Pub/Sub samples remain unknown. Repeating those
reads cannot complete the proof. More importantly, delivery to the reviewed capture
path can only retain evidence: it cannot invoke its original business callback.
That is different from an earlier invocation of code able to write or send a notice.

The [31-writer assessment](../testing/hu084-develop-old-work-boundary.md) separates
these cases. Current reviewed traffic and historical revision retirement are useful
observations, not proof that all previously submitted external effects terminated.

## Decision

For the four exact shared/private develop pairs already bound by ADR-0024, allow
**contained transport delivery** as an alternative to proving an empty transport.
Require the existing immutable source/configuration/revision bindings and initial/
final read-backs to prove that every currently reachable delivery route only appends
capture evidence. A source mismatch, alternate unreviewed route, or fallback to the
business callback rejects the alternative. Do not infer this property from logs,
traffic percentages, a function name or a successful capture alone.

Keep observed transport counts, including unknown or nonzero values, as observations.
Never serialize them as zero. Separate them from business-work counts in an explicit
versioned evidence alternative. The strict default, production and writers without
the complete capture proof retain their existing requirements.

This alternative does **not** cover invocations admitted by earlier business code,
unknown automated writers, or previously submitted Firestore/Sheets/FCM effects.
Those still require independently evidenced completion or effective isolation of
the affected destination. Timeouts, retired revisions, quiet snapshots, and human
agreements do not substitute for that evidence. Unresolved cases block admission;
use the existing scoped incident/residual process, without replaying old notices or
clearing `legacyUntracked` merely to proceed.

Freeze a reviewed business-source set separately from delivery metadata. Late
delivery of an already classified source event may extend the append-only capture
history; a new, changed or unclassified source event invalidates the candidate.
Preserve the exact capture revisions used in each receipt. Never ignore changes
to make the old envelope match. The implementation must define and test this
separation before a real window can be proposed.

Reuse the existing adapter, barrier, evidence repository, CAS and recovery paths.
No new journal, worker, migration engine or automatic reopening is proposed.

## Alternatives and consequences

- Keeping the current rule avoids a contract change but leaves this route blocked
  until a provider-backed current zero proof becomes available.
- Disabling shared transport affects production and does not settle old external
  effects. It is not proposed for this develop step.
- The proposed alternative removes an unnecessary empty-transport requirement;
  it adds a narrow evidence branch and therefore needs compatibility and rejection
  tests. It does not by itself make maintenance ready or solve old-effect ambiguity.

## Implementation and acceptance

1. Add an explicit evidence alternative; retain old receipt decoding and strict
   defaults. Do not weaken all writer counters or aggregate unknown work into it.
2. Test nonzero/unknown contained delivery, incomplete/mixed proofs, changed sources,
   old business invocations, uncertain submissions and production rejection.
3. Rehearse late duplicate and previously unseen events through the existing
   fixed-loopback bootstrap/recovery path. Bind a stable business set without
   suppressing capture history or lost-ack incidents.
4. Reassess the finite old-effect and external-authority blockers. Request the
   concrete live window only when those independent requirements are satisfied.

## References

- [ADR-0024](0024-admit-source-scoped-develop-capture-controls.md)
- [ADR-0022](0022-cooperate-with-develop-firebase-administrators.md)
- [Pub/Sub metric gaps](https://docs.cloud.google.com/pubsub/docs/metrics-autoscaling-best-practices)
- [Cloud Run container lifecycle](https://docs.cloud.google.com/run/docs/container-contract)

## Local implementation checkpoint — 2026-10-29

Each of the four capture controls must explicitly opt into
`develop-contained-delivery-v1`; that choice is hashed into the authorized control
manifest, including the cooperative agreements. The evidence records all eight
function routes, exact nullable/nonnegative counts and their aggregates, source-set
and classified/core-set digests, and both capture revisions/history digests.
Old business-work counters and all quiet business/Sheets/delivery-mutation counters
remain numeric zero. Intake journal metadata is represented separately by capture
revisions; it is not a business mutation or proof that an old callback terminated.

The offline projection reuses the complete census inspector, verifies the reviewed
classification and append-only history, and does not set canEnterMaintenance/canApply.
New source versions or unclassified cores reject. Existing envelope/repository and
held-checkpoint equality checks remain: observations already frozen in a receipt
are never rewritten. A later changed checkpoint stops the operation for renewed
review; this implementation does not automatically refresh a held receipt to absorb
new deliveries. The late-duplicate rehearsal covers the initial/final admission
observation interval, not arbitrary checkpoint replacement during a governed write.

Node22.23.4: build/full lint/focused CJS lint pass;174 local tests and37 Firestore
emulator tests pass, with no skips. The emulator uses only
`demo-reguerta-hu084-migration` at `127.0.0.1:8798` (the repository suite has its own
demo namespace). Tests cover unknown/nonzero transport, incomplete/mixed proofs,
old work, uncertain human writes, production rejection, classified duplicate versus
unseen event, initial creation/inverse, retained evidence and restart after lost ACK.
No native change or parity gap. Code/evidence remain local and uncommitted; no shared
provider mutation. Real old-effect/authority/window gates remain independent.
