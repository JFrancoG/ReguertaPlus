import {
  consumeRotationPositions,
  PlannedRotationPosition,
  plannerProvenance,
  requireRotationProjectionPrefix,
  RotationProjectionPrefix,
  ShiftPlanningError,
  ShiftRotationCursor,
} from "./shift-planning-contract.js";
import {
  buildFutureMarketDates,
  buildMarketSeasonDates,
  projectionSeasonStartYear,
  requireProjectionPrefix,
} from "./shift-planning-calendar.js";

export type MarketPlannerInput = {
  planningRequestId: string;
  targetSeasonStartYear: number;
  rotation: ShiftRotationCursor;
  inheritedTargetPrefix?: RotationProjectionPrefix | null;
};

type PlannedMarketPosition = PlannedRotationPosition & {
  planningReason:
    | "target"
    | "boundaryRoundRemainder"
    | "finalGroupPadding";
};

export type PlannedMarketShift = {
  type: "market";
  date: string;
  projectionSeasonStartYear: number;
  rotationOwnerUserIds: [string, string, string];
  assignedUserIds: [string, string, string];
  rotationPositions: [
    PlannedMarketPosition,
    PlannedMarketPosition,
    PlannedMarketPosition,
  ];
  source: "app";
  origin: "planner";
  planningRequestId: string;
};

export type MarketPlan = {
  targetSeasonPositionCount: 30;
  generatedTargetPositionCount: number;
  shifts: PlannedMarketShift[];
  cursorAtTargetBoundary: ShiftRotationCursor;
  nextRotation: ShiftRotationCursor;
  boundaryRoundRemainingPositionCount: number;
  finalGroupPaddingPositionCount: number;
  affectedProjectionSeasonStartYears: number[];
};

const groupMarketPositions = (
  dates: readonly string[],
  positions: PlannedMarketPosition[],
  provenance: ReturnType<typeof plannerProvenance>,
): PlannedMarketShift[] => dates.map((date, index) => {
  const offset = index * 3;
  const group = positions.slice(offset, offset + 3);
  if (group.length !== 3) {
    throw new ShiftPlanningError(
      "invalid_market_assignee_group",
      "Every market date requires exactly three positions.",
    );
  }
  const ownerIds = group.map((position) => position.rotationOwnerUserId);
  if (new Set(ownerIds).size !== 3) {
    throw new ShiftPlanningError(
      "invalid_market_assignee_group",
      "Every market date requires three distinct members.",
    );
  }
  const rotationOwnerUserIds = ownerIds as [string, string, string];
  return {
    type: "market",
    date,
    projectionSeasonStartYear: projectionSeasonStartYear(date),
    rotationOwnerUserIds,
    assignedUserIds: [...rotationOwnerUserIds],
    rotationPositions: group as [
      PlannedMarketPosition,
      PlannedMarketPosition,
      PlannedMarketPosition,
    ],
    ...provenance,
  };
});

export const planMarketShifts = (input: MarketPlannerInput): MarketPlan => {
  if (input.rotation.type !== "market") {
    throw new ShiftPlanningError(
      "invalid_rotation_type",
      "Market planner requires a market rotation.",
    );
  }
  if (input.rotation.cohortUserIds.length < 3) {
    throw new ShiftPlanningError(
      "insufficient_market_members",
      "Market planning requires at least three eligible members.",
    );
  }
  const provenance = plannerProvenance(input.planningRequestId);
  const targetDates = buildMarketSeasonDates(input.targetSeasonStartYear);
  const inheritedTargetPrefix = input.inheritedTargetPrefix || null;
  const occupiedTargetDates = inheritedTargetPrefix?.dates || [];
  requireProjectionPrefix(targetDates, occupiedTargetDates);
  if (inheritedTargetPrefix) {
    requireRotationProjectionPrefix(
      inheritedTargetPrefix,
      input.rotation,
      3,
    );
  }
  if (occupiedTargetDates.length === targetDates.length) {
    throw new ShiftPlanningError(
      "planning_frontier_complete",
      "Market planning frontier is already complete.",
    );
  }
  const remainingTargetDates = targetDates.slice(occupiedTargetDates.length);
  const generatedTargetPositionCount = remainingTargetDates.length * 3;
  const targetResult = consumeRotationPositions(
    input.rotation,
    generatedTargetPositionCount,
  );
  const boundaryRoundRemainingPositionCount =
    targetResult.nextRotation.nextMemberIndex === 0 ?
      0 :
      targetResult.nextRotation.cohortUserIds.length -
        targetResult.nextRotation.nextMemberIndex;
  const boundaryResult = consumeRotationPositions(
    targetResult.nextRotation,
    boundaryRoundRemainingPositionCount,
  );
  const finalGroupPaddingPositionCount =
    boundaryRoundRemainingPositionCount === 0 ?
      0 :
      (3 - (boundaryRoundRemainingPositionCount % 3)) % 3;
  const paddingResult = consumeRotationPositions(
    boundaryResult.nextRotation,
    finalGroupPaddingPositionCount,
  );
  const targetPositions: PlannedMarketPosition[] = targetResult.positions.map(
    (position) => ({...position, planningReason: "target"}),
  );
  const overflowPositions: PlannedMarketPosition[] = [
    ...boundaryResult.positions.map((position) => ({
      ...position,
      planningReason: "boundaryRoundRemainder" as const,
    })),
    ...paddingResult.positions.map((position) => ({
      ...position,
      planningReason: "finalGroupPadding" as const,
    })),
  ];
  const overflowDates = buildFutureMarketDates(
    input.targetSeasonStartYear,
    overflowPositions.length / 3,
  );
  const shifts = [
    ...groupMarketPositions(remainingTargetDates, targetPositions, provenance),
    ...groupMarketPositions(overflowDates, overflowPositions, provenance),
  ];
  const affectedProjectionSeasonStartYears = Array.from(new Set(
    shifts.map((shift) => shift.projectionSeasonStartYear),
  ));

  return {
    targetSeasonPositionCount: 30,
    generatedTargetPositionCount,
    shifts,
    cursorAtTargetBoundary: targetResult.nextRotation,
    nextRotation: paddingResult.nextRotation,
    boundaryRoundRemainingPositionCount,
    finalGroupPaddingPositionCount,
    affectedProjectionSeasonStartYears,
  };
};
