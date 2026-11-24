import type {DocumentSnapshot, Firestore, Transaction} from
  "@google-cloud/firestore";
import {coverageId, rejectCoverage, ShiftCoverageCase} from
  "./shift-coverage.js";
import type {ShiftCoverageEffects} from "./shift-coverage-effects.js";
import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";
import {parseShiftCoverageSheetsSubmission} from
  "./shift-planning-sheets-submission.js";

/**
 * Only completion directly following this exact acceptance retains its rows.
 * @param {object} effect Accepted public changes.
 * @param {object} accepted Case snapshot from the acceptance receipt.
 * @param {object} stored Current case and its digest.
 * @return {boolean} True when only the completion fields have advanced.
 */
export const isCompletedCoverageAcceptance = (
  effect: ShiftCoverageEffects, accepted?: ShiftCoverageCase,
  stored?: {value?: ShiftCoverageCase; digest?: string},
) => {
  const current = stored?.value;
  if (!accepted || !current || effect.action !== "accept" ||
      !effect.changes.length || accepted.status !== "accepted" ||
      accepted.id !== effect.caseId ||
      accepted.environment !== effect.environment ||
      accepted.revision !== effect.caseRevision ||
      digest(accepted) !== effect.caseDigest ||
      current.updatedAtMillis < accepted.updatedAtMillis) return false;
  const completed = {...accepted, status: "completed", creditId: accepted.id,
    updatedAtMillis: current.updatedAtMillis, revision: accepted.revision + 1};
  return stored.digest === digest(current) &&
    stored.digest === digest(completed);
};

/**
 * Old pending completions can recover their unique acceptance by revision.
 * @param {Firestore} db Server-owned Firestore client.
 * @param {Transaction} tx Caller transaction.
 * @param {object} completion Validated completion effect.
 * @return {Promise<DocumentSnapshot>} Receipt-bound acceptance projection.
 */
export const readCoverageAcceptanceProjection = async (
  db: Firestore, tx: Transaction, completion: ShiftCoverageEffects,
): Promise<DocumentSnapshot> => {
  if (completion.action !== "complete") {
    return rejectCoverage("coverage_effects_projection_changed");
  }
  const root = `${completion.environment}/plus-collections`;
  const collection = db.collection(`${root}/shiftCoverageEffects`);
  let snapshot: DocumentSnapshot;
  if (completion.projectionOperationId !== undefined) {
    snapshot = await tx.get(collection.doc(
      coverageId(completion.projectionOperationId)));
  } else {
    const matches = await tx.get(collection
      .where("value.caseId", "==", completion.caseId)
      .where("value.caseRevision", "==", completion.caseRevision - 1)
      .limit(2));
    if (matches.size !== 1) {
      return rejectCoverage("coverage_effects_projection_changed");
    }
    snapshot = matches.docs[0];
  }
  const value = snapshot.get("value") as ShiftCoverageEffects | undefined;
  if (!value || value.environment !== completion.environment ||
      value.operationId !== snapshot.id || value.action !== "accept" ||
      value.caseId !== completion.caseId ||
      value.caseRevision !== completion.caseRevision - 1 ||
      !value.changes.length) {
    return rejectCoverage("coverage_effects_projection_changed");
  }
  const {effectsDigest, ...core} = value;
  const [receipt, completionReceipt] = await tx.getAll(
    db.doc(`${root}/shiftCoverageOperations/${snapshot.id}`),
    db.doc(`${root}/shiftCoverageOperations/${completion.operationId}`));
  if (effectsDigest !== digest(core) ||
      effectsDigest !== receipt.get("effectsDigest") ||
      completion.effectsDigest !== completionReceipt.get("effectsDigest") ||
      !isCompletedCoverageAcceptance(value, receipt.get("result"), {
        value: completionReceipt.get("result"), digest: completion.caseDigest,
      })) {
    return rejectCoverage("coverage_effects_projection_changed");
  }
  return snapshot;
};

export const isVerifiedCoverageProjection = (snapshot: DocumentSnapshot) => {
  if (!["completed", "retired"].includes(snapshot.get("state"))) return false;
  const receipt = parseShiftCoverageSheetsSubmission(
    snapshot.get("workbookSubmission"));
  const projection = snapshot.get("projection");
  if (!receipt.batch || !receipt.evidence ||
      receipt.environment !== snapshot.get("value.environment") ||
      receipt.effectsDigest !== snapshot.get("value.effectsDigest") ||
      receipt.operationId !== snapshot.id || projection?.kind !== "verified" ||
      receipt.sourceDigest !== snapshot.get("submission.sourceDigest") ||
      receipt.evidence.partitionDigest !== digest({
        projectionDigest: receipt.batch.projectionDigest,
      }) ||
      projection.operationId !== snapshot.id ||
      projection.projectionDigest !== receipt.batch.projectionDigest ||
      projection.readBackDigest !== receipt.batch.projectionDigest) {
    return rejectCoverage("coverage_effects_readback_required");
  }
  return true;
};
