# ADR-0017: Keep administrative resolution open after its target deadline

## Status

Accepted for HU-089 local implementation on 2026-10-11 under the maintainer's
explicit decision on late administrative resolution. Collective ratification and
shared activation remain pending.

## Context

Reserve, volunteer and draw deadlines end their search phases. Administration is
the final escalation: treating its three-day or one-day deadline as a permission
cutoff would leave a future unstaffed shift impossible to resolve through the
normal administrative command, precisely when intervention is still needed.

## Decision

- Keep reserve, volunteer and draw deadlines as phase-wide hard cutoffs. Keep
  the original administrative deadline as a management target: three days in
  normal cases and one day in urgent cases. Record overdue administration
  without resetting that target or restarting earlier search phases.
- Allow an administrator to offer and resolve the pending case after that
  target, while the shift is still in the future. Each offer retains its own
  expiry, no later than the configured maximum offer window and strictly before
  the shift. The administrative target does not invalidate an otherwise valid
  offer or acceptance.
- Preserve explicit acceptance before offer expiry and before the shift,
  current eligibility, administrative authorization and all lead/helper and
  accumulation constraints. Elapsed targets never manufacture coverage or
  completion; unresolved cases remain visible and pending.

## Consequences

Late administration can still resolve a future shift without a new search cycle
or another deadline mechanism. The original target remains useful for detecting
delay. Administrative intervention still cannot rescue an expired individual
offer or record acceptance after the shift starts. This local decision does not
approve the cooperative's policy or activate shared services.

## Related work

- [HU-089 spec](../../spec/shifts/hu-089-coverage-policy-amendments/spec.md)
- [Ratification proposal D07/D10](../../spec/shifts/hu-084-stable-shift-coverage-and-credits/ratification.md)
- GitHub issues [#279](https://github.com/JFrancoG/ReguertaPlus/issues/279) and [#268](https://github.com/JFrancoG/ReguertaPlus/issues/268)
