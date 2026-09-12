import {consumeRotationPositions, ServedRotationPosition,
  ShiftRotationCursor} from
  "./shift-planning-contract.js";
import {coverageId, rejectCoverage, ShiftCoverageCredit} from
  "./shift-coverage.js";
import {parseShiftCoverageCredit, planShiftCreditUnit, ShiftCreditUnit} from
  "./shift-credit-unit.js";
import {createShiftPlanningDigest} from "./shift-planning-digest.js";

/** Provisional input; production bundle intake still rejects credits. */
export type ProvisionalSeasonCredits = {
  credits: readonly ShiftCoverageCredit[];
  frozenThroughRound: number;
  cohortAtStart?: readonly string[];
  inheritedUnits?: readonly (readonly ServedRotationPosition[])[];
};

export type ShiftSeasonCreditProjection = {
  units: ShiftCreditUnit[];
  sourceLedgerDigest: string;
  consumedCreditIds: string[];
  remainingPendingCreditIds: string[];
};

/**
 * Traverse full physical units, then close the target boundary round. Delivery
 * never spills into a new round solely to redeem the final resting owner;
 * market may need a final group, as in the ordinary seasonal planner.
 * Bind the complete ledger even when a credit cannot be used. No consumption
 * timestamp, persistence, claim release or publication is implied.
 * @param {object} input Canonical cursor and provisional complete ledger.
 * @return {object} Immutable ledger proposal and both seasonal cursors.
 */
export const planShiftSeasonCreditUnits = (input: {
  rotation: ShiftRotationCursor;
  targetUnitCount: number;
  policy: ProvisionalSeasonCredits;
  previousDeliveryUserId?: string | null;
}) => {
  const original = consumeRotationPositions(input.rotation, 0).nextRotation;
  if (!Number.isSafeInteger(input.targetUnitCount) ||
      input.targetUnitCount < 1 || input.targetUnitCount > 366) {
    return rejectCoverage("invalid_credit_season_size");
  }
  const ledger = input.policy.credits.map(parseShiftCoverageCredit)
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  for (const position of input.policy.inheritedUnits?.flat() ?? []) {
    if (position.roundNumber > input.policy.frozenThroughRound) {
      return rejectCoverage("credit_prefix_not_frozen");
    }
    if (position.creditId !== null && !ledger.some((credit) =>
      credit.id === position.creditId && credit.state === "consumed" &&
      credit.userId === position.rotationOwnerUserId)) {
      return rejectCoverage("credit_prefix_ledger_changed");
    }
  }
  const consumed = new Set<string>();
  const units: ShiftCreditUnit[] = [];
  if (input.policy.cohortAtStart && (original.nextMemberIndex !== 0 ||
      original.roundNumber <= input.policy.frozenThroughRound)) {
    return rejectCoverage("membership_frozen_unit_required");
  }
  let cursor = input.policy.cohortAtStart ? consumeRotationPositions({
    ...original, cohortUserIds: [...input.policy.cohortAtStart]}, 0)
    .nextRotation : original;
  let previous = input.previousDeliveryUserId ?? null;
  const append = (stopAfterRound?: number) => {
    const unit = planShiftCreditUnit({rotation: cursor,
      credits: ledger.filter((credit) => !consumed.has(credit.id)),
      frozenThroughRound: input.policy.frozenThroughRound,
      adjacentDeliveryUserIds: previous ? [previous] : [],
      stopAfterRound});
    units.push(unit);
    for (const id of unit.consumedCreditIds) consumed.add(id);
    cursor = unit.nextRotation;
    previous = unit.assignments.at(-1)?.rotationOwnerUserId ?? null;
  };
  for (let count = 0; count < input.targetUnitCount; count++) append();
  const cursorAtTargetBoundary = cursor;
  if (cursor.nextMemberIndex !== 0) {
    const closingRound = cursor.roundNumber;
    while (cursor.roundNumber === closingRound) {
      append(cursor.type === "delivery" ? closingRound : undefined);
    }
  }
  const projection: ShiftSeasonCreditProjection = {
    units, sourceLedgerDigest: createShiftPlanningDigest(ledger),
    consumedCreditIds: [...consumed],
    remainingPendingCreditIds: ledger.filter((credit) =>
      credit.state === "pending" && !consumed.has(credit.id))
      .map((credit) => credit.id),
  };
  return {projection, cursorAtTargetBoundary, nextRotation: cursor};
};

/**
 * Credit before/after images for a future atomic HU-082 manifest. The inverse
 * must CAS the full post-activation ledger and restore exact before images;
 * it must not blindly restore every consumed credit to pending. This pure
 * builder neither authorizes a writer nor activates/reverts a plan.
 * @param {object} input Recomputed proposal, complete ledger and trusted time.
 * @return {object[]} Exact forward and inverse ledger values.
 */
export const buildShiftSeasonCreditChanges = (input: {
  projection: ShiftSeasonCreditProjection;
  credits: readonly ShiftCoverageCredit[];
  planId: string;
  activatedAtMillis: number;
}) => {
  coverageId(input.planId);
  if (!Number.isSafeInteger(input.activatedAtMillis) ||
      input.activatedAtMillis < 0) {
    return rejectCoverage("invalid_coverage_credit");
  }
  const ledger = input.credits.map(parseShiftCoverageCredit)
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const resting = input.projection.units.flatMap((unit) =>
    unit.servedPositions.filter((position) => position.creditId !== null));
  const restingIds = resting.map((position) => position.creditId);
  if (createShiftPlanningDigest(restingIds) !==
      createShiftPlanningDigest(input.projection.consumedCreditIds) ||
      createShiftPlanningDigest(ledger) !==
      input.projection.sourceLedgerDigest ||
      new Set(input.projection.consumedCreditIds).size !==
      input.projection.consumedCreditIds.length) {
    return rejectCoverage("credit_plan_source_changed");
  }
  return input.projection.consumedCreditIds.map((id) => {
    const before = ledger.find((credit) => credit.id === id);
    const position = resting.find((item) => item.creditId === id);
    if (!before || before.state !== "pending" ||
        before.userId !== position?.rotationOwnerUserId) {
      return rejectCoverage("credit_plan_source_changed");
    }
    const after = parseShiftCoverageCredit({...before, state: "consumed",
      consumedByPlanId: input.planId,
      consumedAtMillis: input.activatedAtMillis});
    return {id, before, after};
  });
};
