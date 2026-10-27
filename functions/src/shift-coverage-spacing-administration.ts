import {Firestore, Transaction} from "@google-cloud/firestore";
import {coverageId, coverageMember, rejectCoverage} from "./shift-coverage.js";
import {requireRegisteredProvisionalCreditFirestore} from
  "./shift-credit-publication.js";
import {deliverySpacingConflicts, parseDeliverySpacingSource} from
  "./shift-delivery-spacing.js";
import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";
import {planShiftPlanningBundle} from "./shift-planning-bundle.js";
import {rebuildShiftPlanningLiveSourceInTransaction} from
  "./shift-planning-firestore-source-producer.js";
import {parseShiftPlanningRequestEnvelope} from
  "./shift-planning-firestore-repository.js";
import {buildShiftPlanningAuthoritativeState} from
  "./shift-planning-state-persistence.js";
import {serializeShiftPlanningRequestV2} from "./shift-planning-wire.js";

const root = "develop/plus-collections";
export type SpacingAdministrationCandidate = {
  id: string; userId: string; displayName: string; planningRequestId: string;
  previousDate: string; previousRoundNumber: number;
  date: string; roundNumber: number; contextDigest: string;
};
type ContextCommand = Omit<SpacingAdministrationCandidate,
  "id" | "displayName" | "contextDigest"> & {
  proposalId: string; expectedContextDigest: string;
};

/**
 * Enumerate exact conflicts from current persisted previews using the existing
 * planner, including its credit and membership rules. The spacing-free result
 * is diagnostic only: no preview, candidate, source or public row is written.
 * Every choice binds the complete source and request for transactional recheck.
 * Re-previews of one bundle select the latest timestamp, then request ID; every
 * bounded envelope is validated before superseded previews can be discarded.
 * @param {Firestore} db Registered fixed-emulator database.
 * @param {Transaction} transaction Caller-owned authenticated transaction.
 * @param {number} now Trusted server time for future-pair admission.
 * @return {Promise<object>} Minimal choices, or an explicit empty-state reason.
 */
export const readSpacingAdministration = async (
  db: Firestore, transaction: Transaction, now: number,
) => {
  requireRegisteredProvisionalCreditFirestore(db);
  if (!Number.isSafeInteger(now) || now < 0) {
    return rejectCoverage("invalid_coverage_clock");
  }
  const requests = await transaction.get(db.collection(
    `${root}/shiftPlanningRequests`).where("mode", "==", "preview")
    .limit(21));
  if (requests.size > 20) return rejectCoverage("coverage_read_limit");
  const parsed = requests.docs.map((document) =>
    parseShiftPlanningRequestEnvelope(document, "develop"));
  const previews = parsed.filter(({request, lifecycle}) =>
    request.mode === "preview" && (!lifecycle ||
      (lifecycle.state === "failed" &&
        lifecycle.summary?.status === "failed" &&
        lifecycle.summary.failure.code === "delivery_spacing_conflict")));
  const empty = (reason: string) => ({
    spacingCandidates: [] as SpacingAdministrationCandidate[],
    spacingUnavailableReason: reason as string | null,
  });
  if (!previews.length) return empty("no_planning_request");
  const policy = await transaction.get(db.doc(
    `${root}/shiftPlanningState/sourcePolicy`));
  if (!policy.exists) return empty("no_planning_request");
  const source = await rebuildShiftPlanningLiveSourceInTransaction({
    firestore: db, transaction, environment: "develop"});
  if (source.inputs.fairnessSnapshot.deliverySpacing === undefined) {
    return empty("spacing_policy_unavailable");
  }
  const spacing = parseDeliverySpacingSource(
    source.inputs.fairnessSnapshot.deliverySpacing);
  const [maintenance, delivery, market] = await transaction.getAll(
    db.doc(`${root}/shiftPlanningState/current`),
    db.doc(`${root}/shiftRotations/delivery`),
    db.doc(`${root}/shiftRotations/market`));
  const state = buildShiftPlanningAuthoritativeState({environment: "develop",
    maintenance: maintenance.data(), rotations: {
      delivery: delivery.data(), market: market.data()}});
  const candidates = new Map<string, SpacingAdministrationCandidate>();
  let currentPreviewAvailable = false;
  const bundles = new Map<string, typeof previews[number]>();
  for (const preview of previews.sort((a, b) =>
    b.request.requestedAtMillis - a.request.requestedAtMillis ||
      b.request.requestId.localeCompare(a.request.requestId))) {
    if (!bundles.has(preview.request.bundleId)) {
      bundles.set(preview.request.bundleId, preview);
    }
  }
  for (const {request} of bundles.values()) {
    if (request.expectedWriteEpoch !== state.maintenance.writeEpoch ||
        request.expectedActiveRevision !== state.maintenance.activeRevision) {
      continue;
    }
    const snapshot = {...source.inputs.fairnessSnapshot};
    delete snapshot.deliverySpacing;
    const result = planShiftPlanningBundle({
      request: serializeShiftPlanningRequestV2(request),
      authoritativeState: state, fairnessSnapshot: snapshot,
      delivery: source.inputs.delivery, market: source.inputs.market,
      transactionWriteLimit: source.inputs.transactionWriteLimit});
    currentPreviewAvailable = true;
    const continuity = source.inputs.delivery.continuity;
    if (continuity.kind === "persistedAppend" &&
        !spacing.history.some((entry) => entry.shiftId ===
          continuity.predecessor.shiftId && entry.date ===
          continuity.predecessor.scheduledDate)) {
      return rejectCoverage("delivery_spacing_history_required");
    }
    const prefix = source.inputs.delivery.inheritedTargetPrefix;
    if (prefix && prefix.dates.some((date, index) =>
      !spacing.history.some((entry) => entry.date === date &&
        entry.userId === prefix.positions[index].rotationOwnerUserId &&
        entry.roundNumber === prefix.positions[index].roundNumber))) {
      return rejectCoverage("delivery_spacing_history_required");
    }
    const approved = spacing.exceptions.filter((entry) =>
      entry.planningRequestId === request.bundleId);
    if (approved.some((entry) => !entry.authorized ||
        entry.authorityDigest !== spacing.authorityDigest)) {
      return rejectCoverage("delivery_spacing_exception_unavailable");
    }
    const conflicts = deliverySpacingConflicts({source: spacing,
      shifts: result.delivery.shifts});
    for (const conflict of conflicts) {
      if (Date.parse(conflict.date + "T00:00:00.000Z") <= now ||
          approved.some((entry) => entry.userId === conflict.userId &&
            entry.previousDate === conflict.previousDate &&
            entry.previousRoundNumber === conflict.previousRoundNumber &&
            entry.date === conflict.date &&
            entry.roundNumber === conflict.roundNumber)) continue;
      const pair = {planningRequestId: request.bundleId, ...conflict};
      const id = digest(pair).slice("shift-planning:v1:sha256:".length);
      const contextDigest = digest({sourceDigest: source.sourceDigest,
        authoritativeDigest: state.authoritativeDigest, request, pair});
      candidates.set(id, {id, ...pair, displayName: conflict.userId,
        contextDigest});
    }
  }
  if (candidates.size > 250) return rejectCoverage("coverage_read_limit");
  const users = [...new Set([...candidates.values()].map((item) =>
    item.userId))];
  const members = users.length ? await transaction.getAll(...users.map(
    (id) => db.doc(`${root}/users/${coverageId(id)}`))) : [];
  for (const document of members) {
    const member = document.data();
    if (!document.exists || !coverageMember(member).eligible) {
      return rejectCoverage("delivery_spacing_member_ineligible");
    }
    const name = typeof member?.displayName === "string" ?
      member.displayName.trim() : "";
    for (const item of candidates.values()) {
      if (item.userId === document.id) item.displayName = name || document.id;
    }
  }
  return {spacingCandidates: [...candidates.values()].sort((a, b) =>
    a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
  spacingUnavailableReason: currentPreviewAvailable ?
    null : "no_planning_request"};
};

/**
 * Confirm the immutable form choice against the transaction's current plan and
 * sources. A changed request, owner, credit, source, authority or exact pair
 * rejects the command before its approval or receipt can be written.
 * @param {Firestore} db Registered fixed-emulator database.
 * @param {Transaction} transaction Approval writer's transaction.
 * @param {number} now Trusted server time.
 * @param {object} command Exact immutable native proposal binding.
 */
export const assertSpacingAdministrationContext = async (
  db: Firestore, transaction: Transaction, now: number,
  command: ContextCommand,
): Promise<void> => {
  const {spacingCandidates} = await readSpacingAdministration(
    db, transaction, now);
  const candidate = spacingCandidates.find((item) =>
    item.id === command.proposalId);
  if (!candidate || candidate.contextDigest !==
      command.expectedContextDigest ||
      candidate.userId !== command.userId ||
      candidate.planningRequestId !== command.planningRequestId ||
      candidate.previousDate !== command.previousDate ||
      candidate.previousRoundNumber !== command.previousRoundNumber ||
      candidate.date !== command.date ||
      candidate.roundNumber !== command.roundNumber) {
    return rejectCoverage("coverage_administration_context_changed");
  }
};
