export const SHIFT_PLANNING_SCHEMA_VERSION = 1 as const;

export type ShiftRotationType = "delivery" | "market";

export type ShiftRotationCursor = {
  schemaVersion: typeof SHIFT_PLANNING_SCHEMA_VERSION;
  type: ShiftRotationType;
  cohortUserIds: readonly string[];
  roundNumber: number;
  nextMemberIndex: number;
};

export type PlannedRotationPosition = {
  rotationOwnerUserId: string;
  roundNumber: number;
  positionInRound: number;
};

export type RotationProjectionPrefix = {
  dates: readonly string[];
  positions: readonly PlannedRotationPosition[];
  rotationBeforePrefix: ShiftRotationCursor;
  lineageRevision: string;
  lineageDigest: string;
};

export type ShiftPlanningFailureCode =
  | "adjacent_delivery_lead_conflict"
  | "delivery_helper_cursor_conflict"
  | "delivery_helper_evidence_ambiguous"
  | "delivery_helper_ineligible"
  | "insufficient_delivery_members"
  | "insufficient_market_members"
  | "invalid_business_date"
  | "invalid_delivery_continuity"
  | "invalid_delivery_calendar"
  | "invalid_inherited_projection_prefix"
  | "invalid_inherited_rotation_lineage"
  | "invalid_market_assignee_group"
  | "invalid_planning_request_id"
  | "invalid_planning_request"
  | "invalid_planning_state"
  | "invalid_planning_frontier"
  | "invalid_shift_planning_digest_input"
  | "invalid_shift_planning_fairness_snapshot"
  | "planning_binding_mismatch"
  | "preview_binding_mismatch"
  | "candidate_binding_mismatch"
  | "request_intent_conflict"
  | "stale_write_epoch"
  | "stale_active_revision"
  | "fairness_input_drift"
  | "planning_release_lease_conflict"
  | "maintenance_state_conflict"
  | "internal_planning_failure"
  | "invalid_planning_transaction"
  | "planning_bundle_oversize"
  | "planning_transaction_adapter_drift"
  | "invalid_planning_publication_contract"
  | "invalid_planning_forward_materialization"
  | "invalid_planning_inverse_materialization"
  | "invalid_planning_attempt_outcome"
  | "invalid_planning_sync_command"
  | "frozen_cohort_mismatch"
  | "invalid_rotation_cohort"
  | "invalid_rotation_cursor"
  | "invalid_rotation_position_count"
  | "invalid_rotation_type"
  | "invalid_target_season"
  | "planning_frontier_complete";

/** Stable fail-closed error surfaced by pure planning contracts. */
export class ShiftPlanningError extends Error {
  readonly code: ShiftPlanningFailureCode;

  /**
   * Builds an internal diagnostic with a client-stable machine code.
   * @param {ShiftPlanningFailureCode} code Stable failure code.
   * @param {string} message Internal non-user-facing diagnostic.
   */
  constructor(code: ShiftPlanningFailureCode, message: string) {
    super(message);
    this.name = "ShiftPlanningError";
    this.code = code;
  }
}

export const requirePlanningRequestId = (value: string): string => {
  const requestId = value.trim();
  if (!requestId || requestId.length > 256 || requestId.includes("/")) {
    throw new ShiftPlanningError(
      "invalid_planning_request_id",
      "Planning request id must be a non-empty document-safe identifier.",
    );
  }
  return requestId;
};

const normalizedRotation = (
  rotation: ShiftRotationCursor,
): ShiftRotationCursor => {
  if (rotation.schemaVersion !== SHIFT_PLANNING_SCHEMA_VERSION) {
    throw new ShiftPlanningError(
      "invalid_rotation_cursor",
      "Rotation schema version is not supported.",
    );
  }
  if (rotation.type !== "delivery" && rotation.type !== "market") {
    throw new ShiftPlanningError(
      "invalid_rotation_type",
      "Rotation type is not supported.",
    );
  }
  const cohortUserIds = rotation.cohortUserIds.map((userId) => userId.trim());
  if (
    cohortUserIds.length === 0 ||
    cohortUserIds.some((userId) => !userId || userId.includes("/")) ||
    new Set(cohortUserIds).size !== cohortUserIds.length
  ) {
    throw new ShiftPlanningError(
      "invalid_rotation_cohort",
      "Rotation cohort must contain unique document-safe member ids.",
    );
  }
  if (
    !Number.isSafeInteger(rotation.roundNumber) ||
    rotation.roundNumber < 1 ||
    !Number.isSafeInteger(rotation.nextMemberIndex) ||
    rotation.nextMemberIndex < 0 ||
    rotation.nextMemberIndex >= cohortUserIds.length
  ) {
    throw new ShiftPlanningError(
      "invalid_rotation_cursor",
      "Rotation cursor is outside the persisted cohort.",
    );
  }
  return {...rotation, cohortUserIds};
};

export const consumeRotationPositions = (
  rotation: ShiftRotationCursor,
  count: number,
): {
  positions: PlannedRotationPosition[];
  nextRotation: ShiftRotationCursor;
} => {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new ShiftPlanningError(
      "invalid_rotation_position_count",
      "Rotation position count must be a non-negative integer.",
    );
  }
  const normalized = normalizedRotation(rotation);
  let roundNumber = normalized.roundNumber;
  let nextMemberIndex = normalized.nextMemberIndex;
  const positions: PlannedRotationPosition[] = [];

  for (let index = 0; index < count; index += 1) {
    positions.push({
      rotationOwnerUserId: normalized.cohortUserIds[nextMemberIndex],
      roundNumber,
      positionInRound: nextMemberIndex + 1,
    });
    nextMemberIndex += 1;
    if (nextMemberIndex === normalized.cohortUserIds.length) {
      nextMemberIndex = 0;
      roundNumber += 1;
    }
  }

  return {
    positions,
    nextRotation: {
      ...normalized,
      roundNumber,
      nextMemberIndex,
    },
  };
};

const rotationsMatch = (
  left: ShiftRotationCursor,
  right: ShiftRotationCursor,
): boolean =>
  left.schemaVersion === right.schemaVersion &&
  left.type === right.type &&
  left.roundNumber === right.roundNumber &&
  left.nextMemberIndex === right.nextMemberIndex &&
  left.cohortUserIds.length === right.cohortUserIds.length &&
  left.cohortUserIds.every(
    (userId, index) => userId === right.cohortUserIds[index],
  );

export const requireRotationProjectionPrefix = (
  prefix: RotationProjectionPrefix,
  rotationAfterPrefix: ShiftRotationCursor,
  positionsPerDate: number,
): void => {
  if (!Number.isSafeInteger(positionsPerDate) || positionsPerDate < 1) {
    throw new ShiftPlanningError(
      "invalid_inherited_rotation_lineage",
      "Inherited projection position width is invalid.",
    );
  }
  const lineageRevision = prefix.lineageRevision.trim();
  const lineageDigest = prefix.lineageDigest.trim();
  if (
    !lineageRevision ||
    !lineageDigest ||
    lineageRevision.length > 512 ||
    lineageDigest.length > 512 ||
    prefix.positions.length !== prefix.dates.length * positionsPerDate
  ) {
    throw new ShiftPlanningError(
      "invalid_inherited_rotation_lineage",
      "Inherited projection lineage is incomplete.",
    );
  }
  const expected = consumeRotationPositions(
    prefix.rotationBeforePrefix,
    prefix.positions.length,
  );
  const normalizedCurrent = consumeRotationPositions(rotationAfterPrefix, 0)
    .nextRotation;
  const positionsMatch = expected.positions.every((position, index) => {
    const actual = prefix.positions[index];
    return actual.rotationOwnerUserId === position.rotationOwnerUserId &&
      actual.roundNumber === position.roundNumber &&
      actual.positionInRound === position.positionInRound;
  });
  if (
    !positionsMatch ||
    !rotationsMatch(expected.nextRotation, normalizedCurrent)
  ) {
    throw new ShiftPlanningError(
      "invalid_inherited_rotation_lineage",
      "Inherited positions do not lead to the supplied rotation cursor.",
    );
  }
};

export const plannerProvenance = (planningRequestId: string): {
  source: "app";
  origin: "planner";
  planningRequestId: string;
} => ({
  source: "app",
  origin: "planner",
  planningRequestId: requirePlanningRequestId(planningRequestId),
});
