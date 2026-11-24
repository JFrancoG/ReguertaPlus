# HU-084 — assembly agreement on shift coverage

**Member-facing text approved on 18 November 2026**, as reported by the
maintainer. [Español](ratification-es.md).

The [approved member-facing text](propuesta-turnos-para-socios.md) governs the
coverage rules. [PR #278](https://github.com/JFrancoG/ReguertaPlus/pull/278)
contains the provisional implementation to check against the agreement.

## Integrity baseline

Other members' published shifts stay fixed. Rotation ownership remains distinct
from effective assignment. Markets retain three distinct assignees; deliveries
preserve lead/helper constraints. Completed history is immutable. Coverage
requires explicit acceptance. These integrity guarantees are not simplification
options.

## Technical mapping D01–D15

The assembly approved the member-facing text as a package. This table maps its
rules to design decisions. The reconciliation below records the current implementation of frozen-round omissions (D02/D03), ID ties (D01/D04/D08) and the public draw provider (D09).

| ID | Topic | Rule and technical mapping |
| --- | --- | --- |
| D01 | Joins/re-entry | Append to the first wholly new unfrozen round, after published rounds. Order by effective eligibility time, then stable ID for exact ties. Never revive an old position. |
| D02 | Permanent departure | Cover each published position. Skip an unpublished position in a frozen round without a fictitious shift or credit; commit the omission only with a complete, valid delivery or market unit. |
| D03 | Eligibility loss | Real-producer transition or deactivation excludes new assignments. Cover public positions and record omissions for frozen unpublished positions. Temporary absence while still eligible affects only that shift. Renewed eligibility follows D01. |
| D04 | Voluntary reserve | Maintain one reserve per shift type. Offer in entry order, with stable ID ties; acceptance is voluntary. |
| D05 | Reserve continuity | No August reset. Decline/timeout excludes only the current case, without penalty or reordering future cases. Acceptance retains reserve membership but blocks further same-type coverage under D13. |
| D06 | Reserve exit | Reserve membership ends when the first ordinary same-type shift becomes due, even if covered by someone else, or earlier on ineligibility. Season publication does not trigger early exit. Implemented and validated locally in HU-089 using the original owner and reserve-entry boundary. HU-084 shared integration remains pending. |
| D07 | Deadlines | With at least 14 days remaining, reserve/volunteers/draw/administrators receive 2/7/2/3 days; from 5 to less than 14 days, 1/2/1/1. Reserve/volunteer/draw deadlines are phase-wide maxima; the administrative 3/1 days are management targets. Administration may resolve a future shift after its original target, recording delay without resetting the target or restarting search phases. Each offer keeps an expiry within the configured maximum response window and strictly before the shift; explicit timely acceptance remains mandatory. Days mean 24 hours, with no reset per candidate and closure on valid acceptance. Below 5 days, immediate exclusive administrative handling without starting reserve/volunteer/draw phases. See [ADR-0017](../../../docs/decisions/0017-keep-administrative-resolution-open-after-its-target-deadline.md). |
| D08 | Volunteer ordering | Give priority to the first volunteer. Exact ties use a fixed, recorded order. The technical proposal uses a stable ID. |
| D09 | Draw | Freeze candidates before a future public randomness value is known. Keep one verifiable order, without rerolls after refusal/cancellation. Selection still requires acceptance. The agreement delegates provider selection and outage handling to the technical integration. |
| D10 | Exhaustion | An administrator records the resolution and offers to an eligible member, who must accept. If nobody covers, keep a visible open incident; never manufacture coverage or completion. |
| D11 | Compensation | Confirmed completed coverage earns one future same-type skipped occurrence. Volunteering/acceptance alone earns nothing. Never remove a published assignment to consume credit. |
| D12 | Expiry/leave | Credits do not expire except on explicit permanent departure, which cancels outstanding credit without deleting history. Later re-entry does not restore it. Temporary suspension preserves the balance. Implemented and validated locally in HU-089 with administrative declaration and retained receipts. HU-084 shared integration remains pending. |
| D13 | Stacking/proximity | Block a second same-type coverage while one is accepted/incomplete or credit is pending; failure without credit releases the claim. Preserve helping at one delivery and leading the next; never both roles at the same delivery, including draw selections. Require 10 weeks between the same member’s ordinary delivery-lead shifts in different rounds; helpers do not count and markets are out of scope. Reserve, volunteer, draw and administratively arranged substitutions are exempt. Administrators may authorize a documented force-majeure exception to the minimum, such as avoiding an unstaffed delivery. Role conflicts and published-date stability are not waived. |
| D14 | Unsafe credit consumption | Defer tentative credits in reverse queue order until the complete unit can be staffed. The member works the ordinary shift and retains credit for a later eligible round. Avoid replacement chains generating further credits. If still impossible, block activation and escalate. |
| D15 | Authority/completion | Members report their own absence; admins may manage it. The opener or admin may cancel before acceptance. After acceptance, resolution requires administration. Only admins confirm actual completion/credit, never before the shift. |

## Decision record and follow-up

The [reported agreement of 18 November 2026](propuesta-turnos-para-socios.md#acuerdo-de-la-asamblea)
approves the text. The assembly also noted that after some time and several
cases, deadlines may be extended or shortened and other adjustments may be made
through app updates if all members agree. The approved deadlines apply at launch.
The minutes reference and the effective date remain pending.

The technical reconciliation below identifies the remaining differences.
Coverage activation and rollback require separate authorization.

See the [specification](spec.md#assembly-decision-and-technical-reconciliation),
[tasks](tasks.md#0-live-activation-decision-gate), and [evidence](review.md).

## Technical reconciliation on 20 November 2026

Review of the source and tests versioned in candidate `24dd092c`. The evidence identifies the behavior covered by the existing local cases. Acceptance with normal accounts on Develop remains open.

| Decision | Local evidence and remaining difference |
| --- | --- |
| D01 | The 20 November candidate used the reconciliation clock for round admission. The local fix on 21 November sorts entrants and returning members by the Firestore commit of their effective transition, breaking exact ties by stable ID. Admission respects frozen rounds. Reserve offers retain reserve entry order. [Correction evidence](review.md#d01-effective-eligibility-on-21-november-2026) · [Writer contract](../../../docs/decisions/0015-record-explicit-coverage-membership-lifecycle.md#effective-eligibility-time-for-d01--21-november-2026) |
| D02–D03 | Departure or loss of eligibility opens a case for each affected published shift. In a frozen round the omission retains the owner and reason and commits with the complete unit. A member who remains eligible can open an absence for an individual shift. This documents how the internal omission record maps to the approved outcome. [Departure, producers and re-entry](../../../functions/test/shift-coverage.emulator.test.cjs#L709) · [Publication and inverse](../../../functions/test/shift-credit-publication.test.cjs#L494) · [Individual absence](../../../functions/src/shift-coverage-store.ts#L451) |
| D04–D05, D08 | Each shift type has its own reserve, retained across August. Declines and timeouts belong to the case. Reserve selection uses entry time and volunteers use receipt time, both with ID ties. An offer needs an explicit response. [Selection](../../../functions/src/shift-coverage-selection.ts#L186) · [Decline and expiry](../../../functions/test/shift-coverage.emulator.test.cjs#L230) · [Ties](../../../functions/test/shift-coverage.emulator.test.cjs#L272) · [August continuity](../../../functions/test/shift-coverage.emulator.test.cjs#L690) |
| D06, D12 | Reserve participation ends when the original owner’s ordinary shift of that type becomes due. Suspension preserves credit. An explicit permanent departure cancels only the pending balance, preserving its history even if the member returns. [Ordinary shift exit](../../../functions/test/shift-membership-lifecycle.emulator.test.cjs#L114) · [Suspension and departure](../../../functions/test/shift-membership-lifecycle.emulator.test.cjs#L182) |
| D07, D10 | Tests cover the 14- and 5-day boundaries, phase-wide maxima and exclusive admin handling below 5 days. After candidate exhaustion the case stays visible to administration. An admin offer requires acceptance and retains the reason and any delay against the original target. [Deadlines](../../../functions/test/shift-coverage-deadlines.test.cjs#L18) · [Empty candidate pool](../../../functions/test/shift-coverage.emulator.test.cjs#L473) · [Authorized view](../../../functions/src/shift-coverage-client.ts#L81) · [Resolution receipt](../../../functions/src/shift-coverage-store.ts#L755) |
| D09 | The candidate uses drand Quicknet. Firestore must record the candidates and round before the public pulse. A failed check alerts administration and retains the same round. A late commitment requires administrative resolution. The case preserves its original draw across cancellation and reopening. [Technical decision](../../../docs/decisions/0029-use-drand-quicknet-for-coverage-draws.md) · [Evidence](review.md#d09-public-draw-on-21-november-2026) |
| D11, D13 | Completing coverage earns one same-type credit. An accepted coverage or a pending credit blocks another of the same type. Tests preserve owners, handovers and dates, apply ten weeks to ordinary leads in different rounds and limit each force-majeure exception. [Credit and handover](../../../functions/test/shift-coverage.emulator.test.cjs#L75) · [Stacking](../../../functions/test/shift-coverage.emulator.test.cjs#L150) · [Ten weeks](../../../functions/test/shift-delivery-spacing.test.cjs#L46) · [Exception limits](../../../functions/test/shift-delivery-spacing.test.cjs#L146) |
| D14 | The planner defers credits in reverse order, preserves balances and blocks a unit it cannot fully staff. Shared operation must demonstrate that the rejection reaches the responsible administrator and that the credit-aware plan can be published there. [Deferral and rejection](../../../functions/test/shift-credit-unit.test.cjs#L25) · [Emulator publication and inverse](../../../functions/test/shift-credit-publication.test.cjs#L177) |
| D15 | A member can open only their own absence. The opener or an administrator can cancel before acceptance. After acceptance only an administrator can record failure or completion, and confirmation before the shift is rejected. [Authority](../../../functions/src/shift-coverage-store.ts#L142) · [Opening](../../../functions/src/shift-coverage-store.ts#L451) · [Cancellation and completion](../../../functions/src/shift-coverage-store.ts#L619) · [Write-free rejection](../../../functions/test/shift-coverage.emulator.test.cjs#L177) |

Credit publication and delivery spacing now use the environment-bound planner and have local evidence. [Implementation and retry results](review.md#credit-publication-and-delivery-spacing-on-21-november-2026).

HU-084 acceptance on Develop still requires shared integration of the locally verified D01 and D09 changes, credit and spacing publication beyond the emulator, and verification of writer controls for the integrated Sheets and notification workers. [Local completion and recovery](review.md#completed-coverage-delivery-on-21-november-2026). Operations must be able to identify stuck cases, exhaustion, retries and credit failures. The backend keeps normal access closed. Once these conditions are verified, the two shared journeys are market and delivery. The session notice is checked in the affected journey. The four base calendar checks belong to HU-085 activation. [Access](../../../functions/src/index.ts#L3203) · [Planner boundary](../../../functions/src/shift-credit-publication.ts#L81) · [Observability](review.md#acceptance-matrix) · [Roadmap](../../../docs-es/requirements/estado-y-hoja-de-ruta-turnos-2026-11-12.md#los-seis-escenarios-de-aceptación-funcional)
