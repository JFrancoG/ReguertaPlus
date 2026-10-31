# HU-089 — Coverage policy amendments

- Issue: https://github.com/JFrancoG/ReguertaPlus/issues/279
- Parent: HU-084 / #268; depends on draft PR #278.
- Implementation branch: `codex/hu-089-coverage-policy-amendments` (merged and deleted).
- Current integration branch: `codex/hu-084-stable-shift-coverage-and-credits`.
- Base: `5f36e041394ada8d3db3949b10691e9974e91669` (HU-084, unmerged).
- Status: local delivery complete through merged PR #280 and closed issue #279 on 2026-10-11; parent HU-084/main integration and collective ratification/activation remain pending.

Canonical decisions: [proposal](../hu-084-stable-shift-coverage-and-credits/propuesta-turnos-para-socios.md) and [matrix](../hu-084-stable-shift-coverage-and-credits/ratification.md).

## Acceptance

Implement phase-wide reserve/volunteer/draw maxima of 2/7/2 days when opening at
least 14 days before the shift and 1/2/1 days between 5 and 14 days, with
administrative management targets of 3 and 1 days respectively. Below 5 days,
use exclusive administrative resolution. Days mean 24 hours. The case-opening
time fixes the urgency class; a delayed worker cannot restart the timeline or
consume the time reserved for later phases. Administration may still resolve a
future shift after its target: retain the original overdue target, never restart
the search, and require explicit acceptance of an unexpired offer within the
configured maximum response window and strictly before the shift. A valid
accepted offer closes the search. First volunteer has priority. Preserve existing
synthetic fixtures under their original explicit policy version. See
[ADR-0017](../../../docs/decisions/0017-keep-administrative-resolution-open-after-its-target-deadline.md).

Exit reserves at first ordinary same-type due date. Cancel pending credits on permanent departure with retained audit history, while temporary ineligibility preserves balance. Preserve publication/inverse and whole-ledger atomicity.

Require 10 weeks between ordinary delivery-lead assignments in different rounds. Helpers/markets/substitutions are exempt. Record authorized force-majeure exceptions without relaxing lead/helper safety, changing published dates or silently reordering the queue.

No shared deployment, real push, production writes or collective approval is implied. Real entropy and general live integration remain in HU-084. Native policy parity was validated in this local delivery; administrative forms were connected under HU-084 on 2026-10-26.


## Local lifecycle contract

Permanent departure is recorded explicitly by an administrator in membership
reconciliation, with `permanentDepartureReason`, against an inactive/missing member.
Inactivity alone retains credits. Terminal `cancelled` credits retain earned-service
history and the original departure receipt; active re-entry clears the current
declaration but does not restore cancelled balances. See [ADR-0015](../../../docs/decisions/0015-record-explicit-coverage-membership-lifecycle.md).

Reserve entries freeze their admission round boundary. Ordinary due-time evaluation
uses the original rotation owner, not the effective assignee, and excludes old
positions from an earlier entry generation. Read-only projections and reserve
offer/acceptance apply the same predicate even before persisted reconciliation.

## Local ordinary-delivery spacing contract

The explicit `deliverySpacing: {version: "hu089-delivery-spacing-v1"}` source-policy
option captures published ordinary delivery owners and exact administrative
exceptions in the registered fixed emulator, independently of credit enablement.
Seventy calendar days separate the same owner's dated positions in different
rounds; effective coverage assignees and helpers do not alter that history.
Published historical conflicts alone do not trigger retroactive calendar changes.

An administrator records a reasoned exception for one member, two exact dates and
rounds, and the planning request. Current permission and canonical authority are
checked again before publication. Forward/inverse transactions bind complete
source evidence; inverse excludes only its own newly created verified public rows.
Insufficient spacing, including credit compression, blocks the unchanged plan
until exact valid exceptions exist. See [ADR-0016](../../../docs/decisions/0016-bind-delivery-spacing-to-ordinary-planning-history.md)
and its [Spanish version](../../../docs-es/decisions/0016-vincular-separacion-de-repartos-al-historial-ordinario.md).

Administrative native forms were connected locally under HU-084 on 2026-10-26;
shared live integration remains there. The spacing policy changes neither the
public shift schema nor existing native coverage projections. See the current
HU-084 review for the new administrative transport and physical-check boundaries.

Integration note: exception commands use `planningRequestId` for the stable
`bundleId` shared by preview/stage/activate, not a phase's individual `requestId`.
