# ADR-0022: Cooperate with develop Firebase administrators

## Status

Accepted as policy on 2026-10-28 after the maintainer explicitly selected
“Aceptar mantenimiento acordado de develop (recomendado)”. This amends only the
technical exclusion of retained human Firebase administrator capability in develop.
The versioned contract, confirmed participants, technical controls and each live
phase admission remain separate gates. Policy acceptance does not certify that
Rules have been applied or that operational closure is complete.

## Context

The live metadata census of `reguerta-9f27f` finds 23 of 24 Functions using the
same Compute account, including production and the develop compatibility bridge.
That account retains Editor; other server identities can also write Firestore.
Two user principals have Owner bindings. No user-managed keys were observed on
the four inspected service accounts; project grants still permit administration
and impersonation. Missing key files do not establish sole writing.

Client Rules do not constrain privileged server access. Develop and production
share the default database, and withdrawing global runtime privileges would affect
production. The six wrappers close selected develop effects without disabling
shared production transports. They do not close every administrative capability.

ADR-0021 permits cooperation only for the workbook owner's retained capability.
Its exception cannot silently authorize residual Firestore administration.

## Decision

For **develop only**, permit a bounded maintenance agreement with every identified
human administrator who retains direct write or control-plane/impersonation access.
They agree not to write data manually, publish Rules, deploy code, change IAM or
start scripts/other workloads during the window, except separately authorized,
exactly scoped operational actions. The agreement must name the participants,
project/database/environment, approved commands, source/control digests and window.
An unidentified or unconfirmed administrative participant blocks admission.
ADR-0021 continues to govern the named workbook owner's separate exception;
this distinct Firebase administrator policy covers no automated credential use
and leaves production Firestore administration unchanged.

This exception covers retained **human capability**, not automated use of their
credentials. All automated entry points, server workloads, client writes, queued
work, earlier invocations and unresolved external submissions still require their
real technical controls and reconciliation. Historical possibly delivered notices
remain explicitly unreplayed. Neither a quiet interval nor zero current requests
may fabricate a drain or clear `legacyUntracked`.

Represent this mode explicitly in a separately versioned maintenance contract.
Keep current strict/owner-only contracts unchanged. Do not label residual IAM
capability as technically fenced or coerce a census into trusted evidence. Continue
using the existing command/CAS, technical read-backs, incident and recovery paths.
Missing evidence, participant activity, withdrawal, expiry or changed authority
stops progression and retains the affected closure; no automatic reopen occurs.

Production Firestore administration keeps its existing requirements. Any extension
of this policy to production needs its own decision and live authorization.

## Alternatives and consequences

Keeping absolute technical exclusion requires a separately reviewed isolation
design, including how develop is separated from production and how old credentials
and in-flight operations lose access. A different service account alone is not
sufficient while the original identities retain access.

The accepted mode avoids disabling production's shared privileges, while accepting
the risk of an administrator breaking the agreement or making an undetected
transient change. It does not authorize migration or remove the other activation
conditions. Implementation and each real maintenance window remain separate gates.

## Implementation checkpoint

Explicit schema v3 composes this agreement with the existing owner-only intake
and Sheets controls; strict v1 and owner-only v2 remain unchanged. Named human
confirmations are bound to the exact source, effective IAM, technical controls,
operations and window. The observation reader must be supplied explicitly and
revalidated around governed effects. Rejected observations remain bound to the
existing incident receipt. This local contract is not a real signed agreement,
provider authority adapter, migration admission or production authorization.

See the [selective develop pause guide](../testing/hu084-selective-develop-pause.md)
for the grouped implementation and acceptance boundary.

## References

- [ADR-0021](0021-use-cooperative-owner-maintenance-for-shift-workbooks.md)
- [HU-085](../../spec/shifts/hu-085-production-shift-workbook-activation/spec.md)
- [Firebase server access and Rules](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [Firestore IAM](https://firebase.google.com/docs/firestore/security/iam)
