# HU-082 - Non-activating communication baseline

## Purpose and current status

This document defines the urgent path for preparing and communicating a provisional
delivery-plus-market plan before HU-085 performs any production activation. It is a
normative contract; the execution checkpoint below records the separately authorized
consultation publication completed on 2026-08-24.

The path is:

`proposal -> approved -> sealed -> rendered -> communicated`

A proposal is reviewer-only and is never communicable to the cooperative audience.
Approval is also insufficient by itself. Only a current seal whose exact global
approval and zero-write attestation revalidate may be rendered and communicated.

Communication does not make shifts active. After explicit authorization, the sealed
audience render may be copied to dedicated consultation tabs in the shared production
workbook. The app, Firestore public projections, rotation cursors, notifications, and
production configuration remain unchanged until HU-085 completes its separately
authorized activation.

## Atomic scope

One communication baseline always contains both typed subplans:

- `delivery`, including inherited carryover, every remaining weekly position through
  August, and the complete boundary-active round in later seasonal projections; and
- `market`, including the ten target-season markets, 30 target-season positions, and
  the complete boundary-active round/final group in later seasonal projections.

The two queues keep their independent frontier seasons, cohorts, rounds, and cursors,
but the baseline is reviewed, approved, sealed, superseded, and recommunicated as one
indivisible bundle. A delivery-only or market-only approval is invalid.

## Preparation zero-write boundary

Preparing, reviewing, approving, sealing, and rendering this baseline may use only an
explicitly authorized, immutable read-only snapshot and deterministic offline planning.
Before a separate consultation-publication authorization, it must not:

- attempt to use HU-082 `preview` against production, because that contract permits
  private request, operation, bundle, and receipt writes;
- call any production planning, rollout, repair, migration, stage, activate, sync,
  recovery, or cleanup endpoint;
- write Firestore, the production workbook, Drive metadata or permissions, queues,
  notification intents, FCM, app-visible state, runtime configuration, or secrets;
- deploy Functions, Rules, indexes, or either mobile app; or
- treat a private message or reviewed document as activation evidence.

Any authorized production read used to form the snapshot is recorded outside this
repository in one exact source manifest with its capture time, source revisions, and
content digests. The proposal contrasts every manifest entry with the corresponding
private input, then recomputes the manifest digest. A missing, extra, stale, or
mismatched source—or an inability to prove that it was read-only—blocks the proposal.

## Authorized consultation-publication boundary

After a current seal has produced the exact audience render, an explicit maintainer
authorization may publish that render to dedicated consultation tabs in the shared
workbook. This narrowly scoped communication side effect must:

- publish delivery and market together and label the result as available for
  consultation but not active in the app;
- expose only the audience fields permitted by this contract;
- preserve historical tabs and existing Drive permissions;
- perform an immediate live read-back of tab order, values, counts, formatting, and
  forbidden-field absence; and
- prove that Firestore public shifts, rotation state, app configuration, notifications,
  deployments, and mobile clients were not activated or changed.

The consultation publication is not the HU-083 sync consumer or the HU-085 activation
transaction. The apps continue to read Firestore, not these consultation tabs.

## Privacy boundary

Repository documents, public issue text, logs, and screenshots use only synthetic or
opaque references such as `member-ref-001`, `snapshot-ref-001`, and
`baseline-ref-001`. They contain no real member names, emails, UIDs, account IDs,
workbook IDs, URLs, service accounts, phone numbers, or credentials.

The protected planning package may contain the real stable member UIDs needed to prove
assignment identity. Its resolver contains only exact `UID + displayName` pairs for
members used by either plan. Phone numbers are not resolver data and are never copied
into an audience row. Any contact-only fields present in protected source evidence stay
outside the resolver and audience rendering.

The audience renderer returns only dates, projection seasons, the delivery round, and
approved responsible display names. Delivery-helper identities remain private continuity data. The render
never returns UIDs, member/account/baseline/request/workbook identifiers, digests,
phone numbers, lifecycle/source-manifest internals, or credentials. The private package
and its render are not committed to this repository or pasted into a public issue.

## Source manifest and digest layers

### Source manifest

The immutable baseline `sourceManifest` identifies one exact protected capture and
binds the three external read-only inputs consumed by this narrow preparation path:
the normalized source roster, delivery weekday, and legacy delivery predecessor. It
records capture time, revision, provenance, the three content digests, and its own
canonical `sourceManifestDigest`. The roster digest excludes contact-only phone data.
Approved delivery and market mappings, helper
evidence, bootstrap results, cursors, and generated plans remain explicit private
proposal inputs or outputs and are bound by their own canonical digest layers; they
are not falsely described as independent source-manifest entries.

Generation, approval preparation, and sealing each contrast the supplied source
objects against their entry digests and recompute `sourceManifestDigest`. A manifest
digest without successful per-entry comparison is not evidence. Contact-only values
such as phone numbers are not normalized planning inputs.

### Assignment digest

The immutable assignment payload contains at least:

- communication schema version, environment, and target season;
- the normalized eligibility roster without display names or phones;
- the exact eligible UID cohort, bootstrap mappings/evidence, and independent before/
  after round and cursor state for delivery and market;
- all delivery dates, projection seasons, owner/effective-assignee/helper UIDs, round,
  and position data through August and the complete boundary-active round; and
- all market dates, projection seasons, ordered owner/effective-assignee UIDs, and
  round/position data for the 30 target-season positions and complete carryover.

`assignmentDigest = createShiftPlanningDigest(assignmentPayload)` binds identities
and both exact plans. Source lineage is sealed separately by `planningDigest`. The
assignment payload contains no display names or phone numbers.

### Resolver digest

The canonical resolver is the complete, stably ordered set of exact `UID +
displayName` pairs needed by the two plans. Names must be present and unambiguous under
the agreed normalization rule.

`resolverDigest = createShiftPlanningDigest(resolverPayload)` binds that resolver.
Changing a display name changes `resolverDigest` even when the UIDs and assignments do
not change. Phone numbers are excluded.

### Planning digest

The proposal computes `planningDigest` over a seal payload that contains the
communication schema/version, `sourceManifestDigest`, `assignmentDigest`, and
`resolverDigest`. Therefore any plan/UID, normalized source, or rendered-name change
changes `planningDigest`.

All digests use the existing canonical HU-082 contract: deterministic UTF-16
object-key ordering, array-order preservation, fail-closed JSON values, and
domain-separated SHA-256 in the form
`shift-planning:v1:sha256:<64 lowercase hexadecimal characters>`.

Lifecycle status, approval records, seal metadata, and communication receipts are an
append-only envelope around those immutable payloads. `planningDigest` is intentionally
distinct from runtime `bundleDigest` and `candidateDigest`: those cover different
schemas and cannot substitute for approval of the communicated plan.

## Lifecycle

### 1. Proposal

A proposal is generated from one exact source manifest and contains both complete
subplans plus all three digest layers. Its lifecycle state is `proposal`; it is
restricted to authorized reviewers and the audience renderer must reject it. It must
not be shared as a provisional schedule, even with a warning. Every payload change
creates a new immutable revision and new affected digests; a proposal is never edited
in place after review starts.

The reviewer verifies at least:

- eligibility excludes active real producers and retains active common purchase
  managers under the HU-082 predicate;
- delivery starts from the exact inherited frontier, respects the predecessor/helper
  continuity gate, fills August, and completes the boundary-active round;
- market has ten target-season dates, 30 target-season positions, three distinct
  assignees per group, and complete carryover of the boundary-active round;
- neither typed queue resets at a seasonal projection boundary;
- every source entry matches its own digest and the recomputed
  `sourceManifestDigest`;
- every UID/row, cohort, cursor, input revision, and exception is represented in the
  assignment payload and `assignmentDigest`;
- the complete UID/display-name resolver reproduces `resolverDigest`, and neither
  assignment nor audience rows contain phone numbers; and
- preparation through audience rendering produced no production write.

If deterministic offline tooling is not yet able to consume the authorized snapshot,
manual preparation is allowed only inside the restricted review boundary, with
independent second-person verification of every position, source-manifest contrast,
and all three canonical digests. It remains non-communicable and does not weaken any
HU-082 invariant.

### 2. Approval

An authorized cooperative approver records one global decision for the complete
delivery-plus-market package against its exact baseline revision, `planningDigest`,
`assignmentDigest`, `resolverDigest`, and `sourceManifestDigest`. The protected
approval record includes an opaque approver reference, decision time, exclusive
`validUntil`, nullable `supersedesPlanningDigest`, and an explicit pre-communication
zero-production-write attestation. The seal must copy that approved validity and
supersession unchanged; the
sealer cannot widen or redirect either field. `validUntil` is exclusive and may be at
most 15 minutes after `approvedAt`, limiting how long an offline approval can be
replayed before a fresh approval is required.

Approval of a summary, one subplan, separate per-type decisions, a mutable link, a
filename, or an un-digested rendering is insufficient. Approval alone is not
communicable. Any correction after approval returns the artifact to a new proposal
revision and requires a new global approval.

### 3. Seal

Sealing recontrasts every source-manifest entry, recomputes the manifest plus all three
digest layers, verifies the exact global approval binds them, and requires the approved
zero-write attestation. It then freezes the complete private package and approval
reference. A seal records an immutable `sealedAt` strictly after approval, sealed
status, and the approval-bound exclusive `validUntil` and nullable
`supersedesPlanningDigest`. Immediately before render, the SDK-free core revalidates
the complete seal and uses its own clock to require
`Date.now() ∈ [sealedAt, validUntil)`.

This offline baseline deliberately makes no claim that a status manifest, unkeyed
digest, or caller assertion proves authoritative currentness or supersession. It does
not accept such an object. Registry lookup, monotonic revision, and atomic
current-to-superseded CAS belong to HU-085 before activation. The nullable
`supersedesPlanningDigest` records the approved intent for that later governed step;
it does not prove that the referenced digest exists or was current.

The sealed package remains **not active**. Its repository-safe evidence contains only
the digest, revisions, validation result, timestamps, non-sensitive counts, and opaque
references; the protected package retains the exact rows.

### 4. Render and communication

Immediately before every audience render, the renderer revalidates the seal,
approval-bound validity/supersession intent, global approval, zero-write attestation,
source-manifest comparisons, and recomputed `assignmentDigest`, `resolverDigest`, and
`planningDigest`. Its internal clock rejects a seal before `sealedAt` or at/after the
exclusive `validUntil`. It fails closed for a proposal, approval-only package, expired
seal, digest mismatch, missing/ambiguous display name, or any forbidden audience field.

The resulting communication contains both subplans and states:

- that the list is provisional and not active in the app or Firestore public shifts;
- the delivery and market horizons, including any carryover into later seasons; and
- that a later correction will clearly replace the prior list and be recommunicated.

Rendering uses only the exact resolver sealed by `resolverDigest`. Schedule rows expose
responsible display names but no helper identity, UIDs, phone numbers, digests, or
lifecycle metadata. A resolver change is planning drift even when dates and member UIDs
remain unchanged.

Protected communication receipts are append-only operational evidence. They bind the
rendered copy to `planningDigest`, but that technical identifier is not included in the
audience payload. Repository-safe receipts use audience roles, counts, channel type,
time, and an opaque evidence reference rather than names or contact details.

When consultation tabs are authorized, the protected receipt additionally binds the
exact workbook write and live read-back. Repository-safe evidence records only
non-sensitive counts and outcomes; it does not expose the workbook identifier, URL,
technical digests, or member data.

## Drift, expiry, and supersession

A sealed baseline becomes unusable for communication or activation when any source-
manifest entry, UID/plan row, resolver name, or corresponding digest changes, its
validity condition expires, or evidence can no longer prove the read-only snapshot.
The old artifact is retained and marked `superseded`; it is never silently overwritten
or described as current.

The replacement follows the complete lifecycle again:

`new proposal -> new approval -> new seal -> explicit recommunication`

The correction identifies the superseded `planningDigest` and communicates the whole
delivery-plus-market bundle, even if only one typed subplan changed.

## HU-085 handoff rule

HU-085 receives the latest sealed and communicated `planningDigest`, its bound
`assignmentDigest`, `resolverDigest`, `sourceManifestDigest`, protected payloads,
approval/seal records, and communication receipts.
Before production activation is authorized, HU-085 must choose exactly one path:

1. **Respect it**: recontrast the source manifest, prove live input lineage is
   unchanged, and produce a UID-based row-by-row alignment showing that both runtime
   subplans plus the sealed display-name resolver reproduce all three digest layers.
   The HU-085 evidence links the `planningDigest` to its separate `bundleDigest` and
   `candidateDigest`; equality between those different digests is not required.
2. **Supersede it**: if any input, date, assignment, order, carryover, or row differs,
   create a new communication-baseline revision, approve it, seal it, and recommunicate
   it before production activation.

HU-085 must never silently activate a plan that differs from the last communicated
`planningDigest`. Runtime readiness, a valid `bundleDigest`, or a successful stage does
not waive this gate. Governed non-public preview/stage may be used to produce the
alignment evidence, but a mismatch must complete supersession and recommunication
before activation.

## Evidence checklist

- [x] One immutable read-only source manifest and every contrasted entry are retained.
- [x] One proposal contains complete `delivery` and `market` subplans.
- [x] All HU-082 continuity, eligibility, round, horizon, and distinctness checks pass.
- [x] UID plans reproduce `assignmentDigest`; UID/display-name pairs reproduce
  `resolverDigest`; `planningDigest` seals both plus `sourceManifestDigest`.
- [x] An authorized approver globally approves those exact digests and attests zero
  production writes through rendering for the complete two-type package.
- [x] The approved source/digest layers are recontrasted, recomputed, and sealed.
- [x] The renderer rejects proposal/approval-only state, revalidates the seal, and
  proves its own clock is inside the approval-bound 15-minute validity window before
  producing both audience subplans.
- [x] The communicated sealed plan is labelled not active.
- [x] Repository/public evidence contains no PII, real IDs, URLs, or credentials.
- [x] Audience rendering uses approved display names but no UIDs, IDs, or phone numbers.
- [x] The explicitly authorized consultation tabs were published and read back while
  Firestore/app activation and deployment counts remained zero.
- [ ] HU-085 authoritatively proves currentness and exact alignment through its
  registry/CAS boundary, or records supersession and recommunication.

## Execution checkpoint - consultation publication (2026-08-24)

The maintainer approved the exact rendered package and then explicitly authorized its
publication for cooperative consultation. The protected evidence retains the exact
source, proposal, approval, seal, audience render, workbook transaction, and read-back;
repository evidence remains intentionally sanitized.

- The eligible cohort contains 27 participants.
- Delivery contains 54 weekly assignments: 52 in the target projection and 2 carried
  into the following projection. Every participant has exactly two delivery positions.
- Market contains 18 three-person events: 10 in the target projection and 8 carried
  into the following projection. Every participant has exactly two market positions,
  and every event contains three distinct people.
- Five new consultation tabs were published: one summary, two delivery projections,
  and two market projections. Historical tabs and existing permissions were preserved.
- Live Google Sheets read-back verified tab order, row counts, month separators,
  blank observation cells, formatting, and the absence of helper identities, UIDs,
  technical digests, and phone numbers from audience values.
- Firestore public shifts remained empty after publication. No rotation cursor,
  notification, runtime configuration, deployment, or Android/iOS activation occurred.

This checkpoint communicates the schedule; it does not complete HU-082 runtime delivery
or the HU-085 authoritative activation/alignment gate.
