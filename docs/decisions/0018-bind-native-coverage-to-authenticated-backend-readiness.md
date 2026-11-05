# ADR-0018: Bind native coverage to authenticated backend readiness

## Status

Accepted for the HU-084 composition implementation authorized by the maintainer
on 2026-10-27. Collective ratification, operational readiness and shared activation
remain separate requirements.

## Context

The coverage state machine and native forms have been exercised through a fixed
demo project. Normal apps already own authenticated Firebase HTTP clients and
canonical account/member/environment sessions. Merely changing the demo URL
would lose those boundaries and could select the wrong environment or let a
request continue after account replacement. Enabling coverage also requires
coordination with existing planning, Sheets and notification writers.

## Decision

- Reuse one transactional coverage implementation with Firestore and environment
  supplied by trusted backend composition. The fixed-demo wrapper still owns its
  isolated SDK client, project and ports. Direct member-ID actors are restricted
  to that registered local wrapper; shared requests use verified Auth identities.
- Expose an exact `resolveShiftCoverageAccess` request and the existing coverage
  action contract through authenticated HTTP. Both reject malformed transport
  before Auth. Reuse the existing Admin clients, revoked-token verification,
  current account links, roles, writer authority and canonical error envelope.
  Never accept a caller-supplied actor or silently redirect a request to another
  environment after authentication.
- Keep private availability in optional `shiftPlanningState/sourcePolicy.coverage`.
  Its exact fields are `enabled`, `environment`, `policyRevision`,
  `ratificationReference` and `maximumOfferWindowMillis`. Missing, malformed,
  disabled, cross-environment or unsupported policy cannot grant access. The
  offer bound remains explicit; connection work invents no default business
  deadline. Avoid `config/global`, whose existing cloning operation copies the
  develop document to production.
- Resolve access before exposing normal native navigation. A positive response
  does not authorize future commands: every server transaction, including receipt
  replay, rechecks readiness and current identity. Bind preflight policy to the
  transaction so a changed offer window or revision cannot reuse stale inputs.
- Bind native work to UID, canonical member, environment and session generation;
  reject impersonation. Observed roles and common-purchase responsibility must
  invalidate that scope even when a legacy metadata refresh preserves the global
  generation. iOS already advances its central revision for those value changes;
  Android includes their copied typed values in the coverage session. Validate
  after token acquisition and immediately before
  transport, and discard stale responses. Capture command environment and local
  policy expectation in the draft so explicit retries retain the original intent.
  Share forms and presentation operations with rehearsal wrappers; normal routes
  neither show emulator credentials nor sign into a second Auth session.
- Keep the exported composition operationally closed in code. A policy document
  alone cannot activate it while effect ownership versus ordinary write events,
  HU-083 workbook leases, writer-intake inventory, real entropy and authoritative
  credit/membership migration remain incomplete. Do not remove the existing
  provisional planner/publication fences as a shortcut.

## Consequences

Both native graphs can use the real authenticated transport and account scope
without duplicating coverage rules or inventing a second scheduler. The same
backend implementation can be tested against both environment namespaces using
real local Auth/Firestore SDK clients. Such tests do not establish deployment or
shared operational readiness. Missing endpoints or disabled access leave the
feature unavailable; unrelated application features keep their existing flow.

No shared configuration, production data, deployment or notification send is
required to prepare this connection. Completing the operational dependencies,
ratifying policy and authorizing a bounded rollout are still necessary before
members can use the feature in a shared environment.

## Related work

- [ADR-0008](0008-bound-mobile-session-operations.md)
- [ADR-0013](0013-model-shifts-as-continuous-rotations-with-seasonal-projections.md)
- [ADR-0015](0015-record-explicit-coverage-membership-lifecycle.md)
- [HU-084 plan](../../spec/shifts/hu-084-stable-shift-coverage-and-credits/plan.md)
- [HU-084 issue](https://github.com/JFrancoG/ReguertaPlus/issues/268)
