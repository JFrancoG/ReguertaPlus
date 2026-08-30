import {
  consumeRotationPositions,
  plannerProvenance,
  requireRotationProjectionPrefix,
  RotationProjectionPrefix,
  ShiftPlanningError,
  ShiftRotationCursor,
} from "./shift-planning-contract.js";
import {
  addBusinessDays,
  buildDeliverySeasonDates,
  BusinessWeekday,
  projectionSeasonStartYear,
  requireProjectionPrefix,
} from "./shift-planning-calendar.js";

export type DeliveryPlannerPredecessor = {
  shiftId: string;
  scheduledDate: string;
  effectiveLeadUserId: string;
  completion:
    | {
      state: "uncompleted";
      assignmentRevision: number;
      completionRevision: number;
      plannedHelperUserId: string | null;
    }
    | {
      state: "completed";
      assignmentRevision: number;
      completionRevision: number;
      actualHelperUserId: string;
      helperSourceAssignmentRevision: number;
      completedAtMillis: number;
    };
};

export type DeliveryPlanningContinuity =
  | {kind: "newRotation"}
  | {
    kind: "persistedAppend";
    predecessor: DeliveryPlannerPredecessor;
  }
  | {
    kind: "legacyBootstrap";
    predecessor: DeliveryPlannerPredecessor;
    helperEvidence:
      | {
        kind: "unique";
        userId: string;
        evidenceRevision: string;
        evidenceDigest: string;
      }
      | {
        kind: "ambiguous";
        candidateUserIds: readonly string[];
        evidenceDigest: string;
      }
      | {
        kind: "ineligible";
        userId: string;
        evidenceDigest: string;
      };
  };

export type DeliveryPlannerInput = {
  planningRequestId: string;
  targetSeasonStartYear: number;
  deliveryWeekday: BusinessWeekday;
  rotation: ShiftRotationCursor;
  inheritedTargetPrefix?: RotationProjectionPrefix | null;
  continuity: DeliveryPlanningContinuity;
};

export type PlannedDeliveryShift = {
  type: "delivery";
  date: string;
  projectionSeasonStartYear: number;
  rotationOwnerUserId: string;
  assignedUserIds: [string];
  helperUserId: string | null;
  roundNumber: number;
  positionInRound: number;
  planningReason: "target" | "boundaryRoundRemainder";
  source: "app";
  origin: "planner";
  planningRequestId: string;
};

export type DeliveryPlan = {
  targetSeasonShiftCount: number;
  generatedTargetShiftCount: number;
  shifts: PlannedDeliveryShift[];
  predecessorHelperUpdate: {
    shiftId: string;
    helperUserId: string;
  } | null;
  predecessorGuard: {
    shiftId: string;
    expectedScheduledDate: string;
    expectedEffectiveLeadUserId: string;
    expectedAssignmentRevision: number;
    expectedCompletionRevision: number;
    expectedCompletionState: "uncompleted" | "completed";
    expectedPlannedHelperUserId: string | null;
    expectedActualHelperUserId: string | null;
    expectedHelperSourceAssignmentRevision: number | null;
    expectedCompletedAtMillis: number | null;
  } | null;
  cursorAtTargetBoundary: ShiftRotationCursor;
  nextRotation: ShiftRotationCursor;
  affectedProjectionSeasonStartYears: number[];
};

const requireNonNegativeRevision = (value: number): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ShiftPlanningError(
      "invalid_delivery_continuity",
      "Delivery predecessor revision is invalid.",
    );
  }
};

const requirePredecessor = (
  predecessor: DeliveryPlannerPredecessor,
): void => {
  if (
    !predecessor.shiftId.trim() ||
    !predecessor.scheduledDate.trim() ||
    !predecessor.effectiveLeadUserId.trim()
  ) {
    throw new ShiftPlanningError(
      "invalid_delivery_continuity",
      "Delivery predecessor identity is incomplete.",
    );
  }
  requireNonNegativeRevision(predecessor.completion.assignmentRevision);
  requireNonNegativeRevision(predecessor.completion.completionRevision);
  if (predecessor.completion.state === "completed") {
    requireNonNegativeRevision(
      predecessor.completion.helperSourceAssignmentRevision,
    );
    if (
      !predecessor.completion.actualHelperUserId.trim() ||
      !Number.isSafeInteger(predecessor.completion.completedAtMillis) ||
      predecessor.completion.completedAtMillis < 0
    ) {
      throw new ShiftPlanningError(
        "invalid_delivery_continuity",
        "Completed delivery helper history is incomplete.",
      );
    }
  }
};

const predecessorForContinuity = (
  continuity: DeliveryPlanningContinuity,
): DeliveryPlannerPredecessor | null =>
  continuity.kind === "newRotation" ? null : continuity.predecessor;

export const planDeliveryShifts = (
  input: DeliveryPlannerInput,
): DeliveryPlan => {
  if (input.rotation.type !== "delivery") {
    throw new ShiftPlanningError(
      "invalid_rotation_type",
      "Delivery planner requires a delivery rotation.",
    );
  }
  if (input.rotation.cohortUserIds.length < 2) {
    throw new ShiftPlanningError(
      "insufficient_delivery_members",
      "Delivery planning requires at least two eligible members.",
    );
  }
  const provenance = plannerProvenance(input.planningRequestId);
  const targetDates = buildDeliverySeasonDates(
    input.targetSeasonStartYear,
    input.deliveryWeekday,
  );
  const inheritedTargetPrefix = input.inheritedTargetPrefix || null;
  const occupiedTargetDates = inheritedTargetPrefix?.dates || [];
  requireProjectionPrefix(targetDates, occupiedTargetDates);
  if (inheritedTargetPrefix) {
    requireRotationProjectionPrefix(
      inheritedTargetPrefix,
      input.rotation,
      1,
    );
  }
  if (occupiedTargetDates.length === targetDates.length) {
    throw new ShiftPlanningError(
      "planning_frontier_complete",
      "Delivery planning frontier is already complete.",
    );
  }
  if (
    input.continuity.kind === "newRotation" &&
    (
      input.rotation.roundNumber !== 1 ||
      input.rotation.nextMemberIndex !== 0 ||
      occupiedTargetDates.length > 0
    )
  ) {
    throw new ShiftPlanningError(
      "invalid_delivery_continuity",
      "A new delivery rotation must start at round one without carryover.",
    );
  }
  const remainingTargetDates = targetDates.slice(occupiedTargetDates.length);
  const targetResult = consumeRotationPositions(
    input.rotation,
    remainingTargetDates.length,
  );
  const targetCursor = targetResult.nextRotation;
  const overflowPositionCount = targetCursor.nextMemberIndex === 0 ?
    0 : targetCursor.cohortUserIds.length - targetCursor.nextMemberIndex;
  const overflowResult = consumeRotationPositions(
    targetResult.nextRotation,
    overflowPositionCount,
  );
  const overflowDates = Array.from(
    {length: overflowPositionCount},
    (_, index) => addBusinessDays(
      targetDates[targetDates.length - 1],
      7 * (index + 1),
    ),
  );
  const positions = [
    ...targetResult.positions.map((position) => ({
      ...position,
      planningReason: "target" as const,
    })),
    ...overflowResult.positions.map((position) => ({
      ...position,
      planningReason: "boundaryRoundRemainder" as const,
    })),
  ];
  const dates = [...remainingTargetDates, ...overflowDates];
  const firstOwnerUserId = positions[0].rotationOwnerUserId;
  const predecessor = predecessorForContinuity(input.continuity);
  if (predecessor) {
    requirePredecessor(predecessor);
  }
  let requiredFirstOwnerUserId: string | null = null;
  if (input.continuity.kind === "legacyBootstrap") {
    const evidence = input.continuity.helperEvidence;
    if (evidence.kind === "ambiguous") {
      throw new ShiftPlanningError(
        "delivery_helper_evidence_ambiguous",
        "Legacy delivery helper evidence is ambiguous.",
      );
    }
    if (evidence.kind === "ineligible") {
      throw new ShiftPlanningError(
        "delivery_helper_ineligible",
        "Legacy delivery helper is not eligible for this cohort.",
      );
    }
    if (!evidence.evidenceRevision.trim() || !evidence.evidenceDigest.trim()) {
      throw new ShiftPlanningError(
        "invalid_delivery_continuity",
        "Legacy delivery helper evidence lineage is incomplete.",
      );
    }
    requiredFirstOwnerUserId = evidence.userId.trim();
    if (!input.rotation.cohortUserIds.includes(requiredFirstOwnerUserId)) {
      throw new ShiftPlanningError(
        "delivery_helper_ineligible",
        "Legacy delivery helper is not eligible for this cohort.",
      );
    }
    const completion = input.continuity.predecessor.completion;
    const recordedHelperUserId = completion.state === "completed" ?
      completion.actualHelperUserId : completion.plannedHelperUserId;
    if (
      recordedHelperUserId &&
      recordedHelperUserId !== requiredFirstOwnerUserId
    ) {
      throw new ShiftPlanningError(
        "delivery_helper_cursor_conflict",
        "Legacy helper evidence conflicts with predecessor history.",
      );
    }
  } else if (
    input.continuity.kind === "persistedAppend" &&
    input.continuity.predecessor.completion.state === "uncompleted"
  ) {
    requiredFirstOwnerUserId =
      input.continuity.predecessor.completion.plannedHelperUserId;
  }
  if (
    requiredFirstOwnerUserId !== null &&
    requiredFirstOwnerUserId !== firstOwnerUserId
  ) {
    throw new ShiftPlanningError(
      "delivery_helper_cursor_conflict",
      "Persisted delivery cursor conflicts with predecessor helper evidence.",
    );
  }
  if (
    predecessor &&
    predecessor.effectiveLeadUserId === firstOwnerUserId
  ) {
    throw new ShiftPlanningError(
      "adjacent_delivery_lead_conflict",
      "Adjacent delivery leads must be distinct.",
    );
  }
  if (
    predecessor &&
    addBusinessDays(predecessor.scheduledDate, 7) !== dates[0]
  ) {
    throw new ShiftPlanningError(
      "invalid_delivery_continuity",
      "Delivery predecessor is not the immediately preceding calendar slot.",
    );
  }

  const shifts: PlannedDeliveryShift[] = positions.map((position, index) => ({
    type: "delivery",
    date: dates[index],
    projectionSeasonStartYear: projectionSeasonStartYear(dates[index]),
    rotationOwnerUserId: position.rotationOwnerUserId,
    assignedUserIds: [position.rotationOwnerUserId],
    helperUserId: positions[index + 1]?.rotationOwnerUserId || null,
    roundNumber: position.roundNumber,
    positionInRound: position.positionInRound,
    planningReason: position.planningReason,
    ...provenance,
  }));
  for (let index = 1; index < shifts.length; index += 1) {
    const previousLead = shifts[index - 1].assignedUserIds[0];
    const currentLead = shifts[index].assignedUserIds[0];
    if (previousLead === currentLead) {
      throw new ShiftPlanningError(
        "adjacent_delivery_lead_conflict",
        "Adjacent delivery leads must be distinct.",
      );
    }
  }

  const affectedProjectionSeasonStartYears = Array.from(new Set(
    shifts.map((shift) => shift.projectionSeasonStartYear),
  ));
  const predecessorHelperUpdate = predecessor &&
    predecessor.completion.state === "uncompleted" &&
    predecessor.completion.plannedHelperUserId !== firstOwnerUserId ? {
      shiftId: predecessor.shiftId,
      helperUserId: firstOwnerUserId,
    } : null;
  const predecessorGuard = predecessor ? {
    shiftId: predecessor.shiftId,
    expectedScheduledDate: predecessor.scheduledDate,
    expectedEffectiveLeadUserId: predecessor.effectiveLeadUserId,
    expectedAssignmentRevision: predecessor.completion.assignmentRevision,
    expectedCompletionRevision: predecessor.completion.completionRevision,
    expectedCompletionState: predecessor.completion.state,
    expectedPlannedHelperUserId:
      predecessor.completion.state === "uncompleted" ?
        predecessor.completion.plannedHelperUserId : null,
    expectedActualHelperUserId: predecessor.completion.state === "completed" ?
      predecessor.completion.actualHelperUserId : null,
    expectedHelperSourceAssignmentRevision:
      predecessor.completion.state === "completed" ?
        predecessor.completion.helperSourceAssignmentRevision : null,
    expectedCompletedAtMillis: predecessor.completion.state === "completed" ?
      predecessor.completion.completedAtMillis : null,
  } : null;

  return {
    targetSeasonShiftCount: targetDates.length,
    generatedTargetShiftCount: remainingTargetDates.length,
    shifts,
    predecessorHelperUpdate,
    predecessorGuard,
    cursorAtTargetBoundary: targetResult.nextRotation,
    nextRotation: overflowResult.nextRotation,
    affectedProjectionSeasonStartYears,
  };
};
