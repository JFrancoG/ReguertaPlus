# HU-084 — ratification proposal

Status: **discussion draft; none of these proposed rules is ratified**.
Prepared on 2026-10-04. [Español](ratification-es.md).

The maintainer confirms that there is no prior agreement or formal approval.
Informal conversations with the president and some members received a positive
response from those consulted; this is not approval by the whole cooperative.
The [Spanish member-facing proposal](propuesta-turnos-para-socios.md) explains
these choices without implementation terminology.

[PR #278](https://github.com/JFrancoG/ReguertaPlus/pull/278) contains validated
provisional implementation. Technical PR approval neither replaces assembly
ratification nor completes live coverage integration.

## Integrity baseline

Other members' published shifts stay fixed. Rotation ownership remains distinct
from effective assignment. Markets retain three distinct assignees; deliveries
preserve lead/helper constraints. Completed history is immutable. Coverage
requires explicit acceptance. These integrity guarantees are not simplification
options.

## Proposed decisions

Every row needs acceptance or an explicit amendment. Recommendations below must
not be activated as application policy before ratification.

| ID | Topic | Discussion proposal |
| --- | --- | --- |
| D01 | Joins/re-entry | Append to the first wholly new unfrozen round, after published rounds. Order by effective eligibility time, then stable ID for exact ties. Never revive an old position. |
| D02 | Permanent departure | Cover each published position. Skip an unpublished position in a frozen round without a fictitious shift or credit; commit the omission only with a complete, valid delivery or market unit. |
| D03 | Eligibility loss | Real-producer transition or deactivation excludes new assignments. Cover public positions and record omissions for frozen unpublished positions. Temporary absence while still eligible affects only that shift. Renewed eligibility follows D01. |
| D04 | Voluntary reserve | Maintain one reserve per shift type. Offer in entry order, with stable ID ties; acceptance is voluntary. |
| D05 | Reserve continuity | No August reset. Decline/timeout excludes only the current case, without penalty or reordering future cases. Acceptance retains reserve membership but blocks further same-type coverage under D13. |
| D06 | Reserve exit | The maintainer confirms exit when the first ordinary same-type shift becomes due, even if covered by someone else, or earlier on ineligibility. Season publication does not trigger early exit. Implementation and tests still need reconciliation. |
| D07 | Deadlines | Confirmed for the proposal: with at least 14 days remaining, reserve/volunteers/draw/administrators receive 2/7/2/3 days; from 5 to less than 14 days, 1/2/1/1. Phase-wide maxima, 24-hour days, no reset per candidate, and closure on valid acceptance. Below 5 days, immediate exclusive administrative handling without starting reserve/volunteer/draw phases. Explicit acceptance remains mandatory. |
| D08 | Volunteer ordering | The maintainer chooses the first volunteer. Stable ID for exact ties remains proposed. Collective approval of the package is pending. |
| D09 | Draw | Freeze candidates before a future public randomness value is known. Keep one verifiable order, without rerolls after refusal/cancellation. Selection still requires acceptance. The provider and outage behavior need a later technical decision. |
| D10 | Exhaustion | An administrator records the resolution and offers to an eligible member, who must accept. If nobody covers, keep a visible open incident; never manufacture coverage or completion. |
| D11 | Compensation | Confirmed completed coverage earns one future same-type skipped occurrence. Volunteering/acceptance alone earns nothing. Never remove a published assignment to consume credit. |
| D12 | Expiry/leave | The maintainer proposes no expiry except permanent departure, which cancels outstanding credit without deleting history. Later re-entry does not restore it. Temporary suspension preserves the balance. Ratification and implementation of differences remain pending. |
| D13 | Stacking/proximity | Confirmed: block a second same-type coverage while one is accepted/incomplete or credit is pending; failure without credit releases the claim. Preserve helping at one delivery and leading the next; never both roles at the same delivery, including draw selections. Require 10 weeks between the same member’s ordinary delivery-lead shifts in different rounds; helpers do not count and markets are out of scope. Reserve, volunteer, draw and administratively arranged substitutions are exempt. Administrators may authorize a documented force-majeure exception to the minimum, such as avoiding an unstaffed delivery. Role conflicts and published-date stability are not waived. |
| D14 | Unsafe credit consumption | Defer tentative credits in reverse queue order until the complete unit can be staffed. The member works the ordinary shift and retains credit for a later eligible round. Avoid replacement chains generating further credits. If still impossible, block activation and escalate. |
| D15 | Authority/completion | Members report their own absence; admins may manage it. The opener or admin may cancel before acceptance. After acceptance, resolution requires administration. Only admins confirm actual completion/credit, never before the shift. |

## First decisions to resolve

1. Present the proposal to members: absence of any prior agreement is confirmed.
   Record the date and exact wording only after a decision is actually made.
2. Carry the maintainer-confirmed D06, D07 and D13 choices into the presented
   text rather than treating them as unanswered questions.
3. Ratify or amend the remaining package, recording each change.

Provider and Firebase details need not be selected in the initial discussion;
the required draw guarantees do.

## Decision record and follow-up

Decision date/minutes reference: **pending**. Approved wording/amendments by ID:
**pending**. Maintainer approval of reconciled scope: **pending**.

After ratification, reconcile authoritative EN/ES requirements, specification,
implementation and tests. Complete the provider, operational observability, live
composition and recovery, then prepare separately authorized activation/rollback.
HU-085 does not implicitly absorb this work.

Sources: [pending decisions](spec.md#assembly-decisions-required),
[tasks](tasks.md#0-live-activation-decision-gate) and [evidence](review.md).
