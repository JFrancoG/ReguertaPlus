import {
  consumeRotationPositions,
  PlannedRotationPosition,
  ShiftRotationCursor,
} from "./shift-planning-contract.js";
import {coverageId, rejectCoverage, ShiftCoverageCredit,
  SHIFT_COVERAGE_POLICY_REVISION} from "./shift-coverage.js";

export type ShiftCreditUnit = {
  type: "delivery" | "market";
  assignments: PlannedRotationPosition[];
  servedPositions: (PlannedRotationPosition & {creditId: string | null})[];
  consumedCreditIds: string[];
  deferredCreditIds: string[];
  nextRotation: ShiftRotationCursor;
};

export const parseShiftCoverageCredit = (
  value: unknown,
): ShiftCoverageCredit => {
  const credit = value as ShiftCoverageCredit | undefined;
  if (!credit || credit.schemaVersion !== 1 ||
      credit.policyRevision !== SHIFT_COVERAGE_POLICY_REVISION ||
      !["delivery", "market"].includes(credit.type) ||
      !["pending", "consumed"].includes(credit.state) ||
      !Number.isSafeInteger(credit.earnedAtMillis) ||
      credit.earnedAtMillis < 0 ||
      !Number.isSafeInteger(credit.completionRevision) ||
      credit.completionRevision < 1 || credit.id !== credit.caseId) {
    return rejectCoverage("invalid_coverage_credit");
  }
  const keys = ["schemaVersion", "policyRevision", "id", "caseId", "shiftId",
    "type", "userId", "state", "earnedAtMillis", "completionRevision"];
  if (credit.state === "consumed") {
    keys.push("consumedByPlanId", "consumedAtMillis");
  }
  if (Object.keys(credit).sort().join() !== keys.sort().join()) {
    return rejectCoverage("invalid_coverage_credit");
  }
  [credit.id, credit.caseId, credit.shiftId, credit.userId].forEach(coverageId);
  if (credit.state === "consumed" &&
      (!Number.isSafeInteger(credit.consumedAtMillis) ||
        credit.consumedAtMillis < credit.earnedAtMillis)) {
    return rejectCoverage("invalid_coverage_credit");
  }
  if (credit.state === "consumed") coverageId(credit.consumedByPlanId);
  return structuredClone(credit);
};

/**
 * Solves one physical unit, traversing the existing canonical owner cursor.
 * Credits serve an owner position without taking a calendar slot. No resting
 * owner may work anywhere in the unit. On failure, disable the last tentative
 * credit and retry from the original cursor; never silently skip an uncredited
 * owner or commit a partly staffed market. Frozen-round credits remain pending.
 * @param {object} input Immutable cursor, complete ledger and neighbor leads.
 * @return {ShiftCreditUnit} Pure proposal; no ledger or cursor is mutated.
 */
export const planShiftCreditUnit = (input: {
  rotation: ShiftRotationCursor;
  credits: readonly ShiftCoverageCredit[];
  frozenThroughRound: number;
  adjacentDeliveryUserIds: readonly string[];
}): ShiftCreditUnit => {
  const rotation = consumeRotationPositions(input.rotation, 0).nextRotation;
  const width = rotation.type === "delivery" ? 1 : 3;
  if (rotation.cohortUserIds.length < Math.max(width, 2) ||
      !Number.isSafeInteger(input.frozenThroughRound) ||
      input.frozenThroughRound < 0) {
    return rejectCoverage("invalid_credit_unit_source");
  }
  const pending = new Map<string, ShiftCoverageCredit>();
  const ids = new Set<string>();
  for (const value of input.credits) {
    const credit = parseShiftCoverageCredit(value);
    if (credit.type !== rotation.type || ids.has(credit.id)) {
      return rejectCoverage("invalid_credit_unit_ledger");
    }
    ids.add(credit.id);
    if (credit.state === "pending") {
      if (pending.has(credit.userId)) {
        return rejectCoverage("duplicate_pending_coverage_credit");
      }
      pending.set(credit.userId, credit);
    }
  }
  const disabled = new Set<string>();
  for (let attempt = 0; attempt <= pending.size; attempt++) {
    let cursor = rotation;
    const assignments: PlannedRotationPosition[] = [];
    const servedPositions: ShiftCreditUnit["servedPositions"] = [];
    const consumed: ShiftCoverageCredit[] = [];
    const resting = new Set<string>();
    const deferred = new Set<string>();
    // A repeated owner cannot work or rest twice within one physical unit.
    for (let step = 0; step <= rotation.cohortUserIds.length; step++) {
      const traversal = consumeRotationPositions(cursor, 1);
      if (!Number.isSafeInteger(traversal.nextRotation.roundNumber)) {
        return rejectCoverage("invalid_credit_unit_cursor");
      }
      const position = traversal.positions[0];
      const owner = position.rotationOwnerUserId;
      if (resting.has(owner) || assignments.some((item) =>
        item.rotationOwnerUserId === owner)) break;
      const credit = pending.get(owner);
      if (credit && position.roundNumber > input.frozenThroughRound &&
          !disabled.has(credit.id)) {
        consumed.push(credit);
        resting.add(owner);
        servedPositions.push({...position, creditId: credit.id});
      } else {
        if (rotation.type === "delivery" &&
            input.adjacentDeliveryUserIds.includes(owner)) break;
        assignments.push(position);
        servedPositions.push({...position, creditId: null});
        if (credit) deferred.add(credit.id);
      }
      cursor = traversal.nextRotation;
      if (assignments.length === width) {
        return {type: rotation.type, assignments, servedPositions,
          consumedCreditIds: consumed.map((credit) => credit.id),
          deferredCreditIds: [...deferred], nextRotation: cursor};
      }
    }
    const last = consumed.at(-1);
    if (!last) return rejectCoverage("credit_unit_unstaffable");
    disabled.add(last.id);
  }
  return rejectCoverage("credit_unit_unstaffable");
};
