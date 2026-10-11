import {Firestore, Transaction} from "@google-cloud/firestore";
import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";
import {parseShiftCoverageCredit} from "./shift-credit-unit.js";
import {rejectCoverage} from "./shift-coverage.js";
import {CoverageReserve} from "./shift-coverage-selection.js";
import {ShiftPlanningPublicShiftDocument} from
  "./shift-planning-publication-contract.js";

type Change = {targetPath: string; before: Record<string, unknown>;
  after: Record<string, unknown>};
const root = "develop/plus-collections";

/**
 * Match the ordinary owner in this reserve entry, never the effective
 * substitute or a helper. Publishing a future turn does not end the reserve.
 * @param {CoverageReserve} reserve Entry with its immutable admission boundary.
 * @param {object[]} shifts Published ordinary positions.
 * @param {number} now Trusted current time.
 * @return {object|undefined} First already-due ordinary turn of the same type.
 */
export const firstDueOrdinaryShift = (
  reserve: CoverageReserve,
  shifts: {id: string; shift: ShiftPlanningPublicShiftDocument}[],
  now: number,
) => {
  const floor = reserve.admissionAfterRound;
  if (!Number.isSafeInteger(floor) || (floor as number) < 0) {
    return rejectCoverage("membership_reserve_admission_evidence_required");
  }
  return shifts.filter(({shift}) => shift.type === reserve.type &&
    shift.date.toMillis() >= reserve.enteredAtMillis &&
    shift.date.toMillis() <= now && (shift.type === "delivery" ?
    shift.rotationOwnerUserId === reserve.userId &&
        (shift.roundNumber ?? 0) > (floor as number) :
    shift.rotationPositions?.some((position) =>
      position.rotationOwnerUserId === reserve.userId &&
        position.roundNumber > (floor as number))))
    .sort((a, b) => a.shift.date.toMillis() - b.shift.date.toMillis() ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
};

/**
 * Cancel only unspent credits and release their matching claims. Exact before
 * images enter the administrative receipt; type ledgers invalidate every older
 * preview, stage and inverse. All reads precede the caller's atomic writes.
 * @param {Firestore} db Fixed-emulator database.
 * @param {Transaction} transaction Administrative membership transaction.
 * @param {string} userId Departed beneficiary.
 * @param {string} operationId Original explicit permanent-departure receipt.
 * @param {number} now Trusted cancellation time.
 * @return {Promise<Change[]>} Bounded changes, preserving historical rows.
 */
export const readDepartureCreditChanges = async (
  db: Firestore,
  transaction: Transaction,
  userId: string,
  operationId: string,
  now: number,
): Promise<Change[]> => {
  const documents = await transaction.get(db.collection(
    `${root}/shiftCoverageCredits`).where("userId", "==", userId).limit(251));
  if (documents.size > 250) return rejectCoverage("membership_source_limit");
  const credits = documents.docs.map((doc) => {
    const credit = parseShiftCoverageCredit(doc.data());
    if (credit.id !== doc.id || credit.userId !== userId) {
      return rejectCoverage("invalid_coverage_credit");
    }
    return {document: doc, credit};
  });
  const types = ["delivery", "market"] as const;
  const records = await transaction.getAll(...types.flatMap((type) => [
    db.doc(`${root}/shiftCoverageMemberClaims/${digest([type, userId])
      .split(":").at(-1)}`),
    db.doc(`${root}/shiftCoverageLedgerState/${type}`),
  ]));
  const changes: Change[] = [];
  for (const [index, type] of types.entries()) {
    const pending = credits.filter((item) => item.credit.type === type &&
      item.credit.state === "pending");
    const claim = records[index * 2];
    if (pending.length > 1) {
      return rejectCoverage("duplicate_pending_coverage_credit");
    }
    if (!pending.length) {
      if (claim.data()?.state === "creditPending") {
        return rejectCoverage("credit_claim_changed");
      }
      continue;
    }
    const {document, credit} = pending[0];
    const expectedClaim = {type, userId, caseId: credit.id,
      state: "creditPending"};
    if (digest(claim.data() ?? null) !== digest(expectedClaim)) {
      return rejectCoverage("credit_claim_changed");
    }
    const ledger = records[index * 2 + 1];
    const revision = ledger.data()?.revision;
    if (!Number.isSafeInteger(revision) || revision < 1 ||
        revision >= Number.MAX_SAFE_INTEGER - 1) {
      return rejectCoverage("invalid_coverage_ledger");
    }
    const cancellation = {cancelledByMembershipOperationId: operationId,
      cancelledAtMillis: now};
    const after = parseShiftCoverageCredit({...credit, state: "cancelled",
      ...cancellation});
    changes.push({targetPath: document.ref.path, before: document.data(),
      after}, {targetPath: claim.ref.path, before: expectedClaim,
      after: {...expectedClaim, state: "released", ...cancellation}},
    {targetPath: ledger.ref.path, before: ledger.data() as {revision: number},
      after: {revision: revision + 1}});
  }
  return changes;
};
