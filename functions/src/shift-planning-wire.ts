import {
  consumeRotationPositions,
  SHIFT_PLANNING_SCHEMA_VERSION,
  ShiftPlanningError,
  ShiftPlanningFailureCode,
  ShiftRotationCursor,
  ShiftRotationType,
} from "./shift-planning-contract.js";
import {Timestamp} from "firebase-admin/firestore";

export const SHIFT_PLANNING_REQUEST_SCHEMA_VERSION = 2 as const;
export const SHIFT_PLANNING_STATE_SCHEMA_VERSION = 1 as const;
export const SHIFT_PLANNING_WIRE_SCHEMA_VERSION = 1 as const;

export const SHIFT_PLANNING_COLLECTIONS = {
  requests: "shiftPlanningRequests",
  candidates: "shiftPlanningCandidates",
  backendOnly: [
    "shiftPlanningState",
    "shiftRotations",
    "shiftRotationMappings",
    "shiftPlanningBundles",
    "shiftPlanningSyncCommands",
    "shiftPlanningNotificationIntents",
    "shiftPlanningOperations",
  ],
} as const;

export type ShiftPlanningEnvironment = "develop" | "production";
export type ShiftPlanningMode = "preview" | "stage" | "activate";
export type ShiftPlanningRequestStatus =
  | "requested"
  | "processing"
  | "completed"
  | "failed";

export type ShiftPlanningDigestBinding =
  | {
    kind: "preview";
    sourceRequestId: string;
    bundleRevision: string;
    bundleDigest: string;
  }
  | {
    kind: "candidate";
    candidateId: string;
    bundleRevision: string;
    bundleDigest: string;
    candidateDigest: string;
  };

export type ShiftPlanningTargetSubplan = {
  targetSeasonStartYear: number;
};

export type ShiftPlanningRequestV2 = {
  schemaVersion: typeof SHIFT_PLANNING_REQUEST_SCHEMA_VERSION;
  requestId: string;
  bundleId: string;
  environment: ShiftPlanningEnvironment;
  requestedByUserId: string;
  requestedAtMillis: number;
  mode: ShiftPlanningMode;
  status: "requested";
  expectedWriteEpoch: number;
  expectedActiveRevision: string | null;
  subplans: {
    delivery: ShiftPlanningTargetSubplan;
    market: ShiftPlanningTargetSubplan;
  };
  binding: ShiftPlanningDigestBinding | null;
};

export type ShiftPlanningIntakeBarrier = {
  revision: string;
  digest: string;
  verifiedAtMillis: number;
};

export type ShiftPlanningMaintenanceState = {
  schemaVersion: typeof SHIFT_PLANNING_STATE_SCHEMA_VERSION;
  stateRevision: number;
  writeEpoch: number;
  maintenanceStatus: "open" | "closed";
  activeRevision: string | null;
  activeDigest: string | null;
  intakeBarrier: ShiftPlanningIntakeBarrier | null;
  lastTransitionId: string;
};

export type ShiftPlanningLineage = {
  revision: string;
  digest: string;
};

export type ShiftPlanningReleaseLease = {
  type: ShiftRotationType;
  bundleId: string;
  bundleRevision: string;
  bundleDigest: string;
  leaseEpoch: number;
  ownerOperationId: string;
  state: "sealed" | "releasing" | "degraded";
  acquiredAtMillis: number;
  deadlineAtMillis: number;
};

export type ShiftRotationAggregateWire = {
  schemaVersion: typeof SHIFT_PLANNING_WIRE_SCHEMA_VERSION;
  type: ShiftRotationType;
  stateRevision: number;
  cursor: ShiftRotationCursor;
  planningFrontierSeasonStartYear: number;
  cohortFrozen: boolean;
  frozenCohortUserIds: readonly string[];
  activeRevision: string | null;
  activeDigest: string | null;
  lastIdempotencyKey: string | null;
  migrationBaseline: ShiftPlanningLineage | null;
  releaseLease: ShiftPlanningReleaseLease | null;
};

export type ShiftPlannerProvenanceWire = {
  source: "app";
  origin: "planner";
  planningRequestId: string;
  bundleRevision: string;
  bundleDigest: string;
  writeEpoch: number;
};

export type ShiftRotationPositionWire = {
  rotationOwnerUserId: string;
  effectiveAssigneeUserId: string;
  roundNumber: number;
  positionInRound: number;
};

export type ShiftPlanningCompletedSubplanSummary = {
  targetSeasonStartYear: number;
  generatedShiftCount: number;
  affectedProjectionSeasonStartYears: readonly number[];
};

export type ShiftPlanningCompletedSummary = {
  schemaVersion: typeof SHIFT_PLANNING_WIRE_SCHEMA_VERSION;
  status: "completed";
  mode: ShiftPlanningMode;
  bundleId: string;
  bundleRevision: string;
  bundleDigest: string;
  delivery: ShiftPlanningCompletedSubplanSummary;
  market: ShiftPlanningCompletedSubplanSummary;
};

export type ShiftPlanningFailureScope =
  | "request"
  | "delivery"
  | "market"
  | "bundle"
  | "maintenance"
  | "release";

export type ShiftPlanningFailedSummary = {
  schemaVersion: typeof SHIFT_PLANNING_WIRE_SCHEMA_VERSION;
  status: "failed";
  mode: ShiftPlanningMode;
  bundleId: string;
  failure: {
    scope: ShiftPlanningFailureScope;
    code: ShiftPlanningFailureCode;
    messageKey: string;
  };
};

const exactRequestKeys = [
  "schemaVersion",
  "requestId",
  "bundleId",
  "environment",
  "requestedByUserId",
  "requestedAt",
  "mode",
  "status",
  "expectedWriteEpoch",
  "expectedActiveRevision",
  "subplans",
  "binding",
] as const;

const exactMaintenanceKeys = [
  "schemaVersion",
  "stateRevision",
  "writeEpoch",
  "maintenanceStatus",
  "activeRevision",
  "activeDigest",
  "intakeBarrier",
  "lastTransitionId",
] as const;

const exactRotationAggregateKeys = [
  "schemaVersion",
  "type",
  "stateRevision",
  "cursor",
  "planningFrontierSeasonStartYear",
  "cohortFrozen",
  "frozenCohortUserIds",
  "activeRevision",
  "activeDigest",
  "lastIdempotencyKey",
  "migrationBaseline",
  "releaseLease",
] as const;

const exactRotationCursorKeys = [
  "schemaVersion",
  "type",
  "cohortUserIds",
  "roundNumber",
  "nextMemberIndex",
] as const;

const exactReleaseLeaseKeys = [
  "type",
  "bundleId",
  "bundleRevision",
  "bundleDigest",
  "leaseEpoch",
  "ownerOperationId",
  "state",
  "acquiredAtMillis",
  "deadlineAtMillis",
] as const;

const requireRecord = (
  value: unknown,
  code: "invalid_planning_request" | "invalid_planning_state",
): Record<string, unknown> => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new ShiftPlanningError(
      code,
      "Planning wire value must be an object.",
    );
  }
  return value as Record<string, unknown>;
};

const requireExactKeys = (
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  code: "invalid_planning_request" | "invalid_planning_state",
): void => {
  const keys = Object.keys(value);
  if (
    keys.length !== allowedKeys.length ||
    keys.some((key) => !allowedKeys.includes(key))
  ) {
    throw new ShiftPlanningError(code, "Planning wire fields are not exact.");
  }
};

const requireIdentifier = (
  value: unknown,
  code: "invalid_planning_request" | "invalid_planning_state",
): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    throw new ShiftPlanningError(code, "Planning identifier is invalid.");
  }
  return value;
};

const requireNonNegativeInteger = (
  value: unknown,
  code: "invalid_planning_request" | "invalid_planning_state",
): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new ShiftPlanningError(code, "Planning revision is invalid.");
  }
  return value as number;
};

const requireSeasonStartYear = (value: unknown): number => {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < 2000 ||
    (value as number) > 9998
  ) {
    throw new ShiftPlanningError(
      "invalid_planning_request",
      "Planning target season is invalid.",
    );
  }
  return value as number;
};

const requireRequestTimestampMillis = (value: unknown): number => {
  if (!(value instanceof Timestamp)) {
    throw new ShiftPlanningError(
      "invalid_planning_request",
      "Planning request timestamp must be a Firestore Timestamp.",
    );
  }
  const requestedAtMillis = value.toMillis();
  if (!Number.isSafeInteger(requestedAtMillis) || requestedAtMillis < 0) {
    throw new ShiftPlanningError(
      "invalid_planning_request",
      "Planning request timestamp is invalid.",
    );
  }
  return requestedAtMillis;
};

const requireDigest = (
  value: unknown,
  code: "invalid_planning_request" | "invalid_planning_state",
): string => {
  if (
    typeof value !== "string" ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)
  ) {
    throw new ShiftPlanningError(code, "Planning digest is invalid.");
  }
  return value;
};

const requireNullableRevision = (
  value: unknown,
  code: "invalid_planning_request" | "invalid_planning_state",
): string | null => value === null ? null : requireIdentifier(value, code);

const parseBinding = (
  value: unknown,
  mode: Exclude<ShiftPlanningMode, "preview">,
): ShiftPlanningDigestBinding => {
  const binding = requireRecord(value, "invalid_planning_request");
  if (mode === "stage") {
    requireExactKeys(
      binding,
      ["kind", "sourceRequestId", "bundleRevision", "bundleDigest"],
      "invalid_planning_request",
    );
    if (binding.kind !== "preview") {
      throw new ShiftPlanningError(
        "invalid_planning_request",
        "Stage requires a preview binding.",
      );
    }
    return {
      kind: "preview",
      sourceRequestId: requireIdentifier(
        binding.sourceRequestId,
        "invalid_planning_request",
      ),
      bundleRevision: requireIdentifier(
        binding.bundleRevision,
        "invalid_planning_request",
      ),
      bundleDigest: requireDigest(
        binding.bundleDigest,
        "invalid_planning_request",
      ),
    };
  }
  requireExactKeys(
    binding,
    [
      "kind",
      "candidateId",
      "bundleRevision",
      "bundleDigest",
      "candidateDigest",
    ],
    "invalid_planning_request",
  );
  if (binding.kind !== "candidate") {
    throw new ShiftPlanningError(
      "invalid_planning_request",
      "Activate requires a staged candidate binding.",
    );
  }
  return {
    kind: "candidate",
    candidateId: requireIdentifier(
      binding.candidateId,
      "invalid_planning_request",
    ),
    bundleRevision: requireIdentifier(
      binding.bundleRevision,
      "invalid_planning_request",
    ),
    bundleDigest: requireDigest(
      binding.bundleDigest,
      "invalid_planning_request",
    ),
    candidateDigest: requireDigest(
      binding.candidateDigest,
      "invalid_planning_request",
    ),
  };
};

const parseSubplan = (value: unknown): ShiftPlanningTargetSubplan => {
  const subplan = requireRecord(value, "invalid_planning_request");
  requireExactKeys(
    subplan,
    ["targetSeasonStartYear"],
    "invalid_planning_request",
  );
  return {
    targetSeasonStartYear: requireSeasonStartYear(
      subplan.targetSeasonStartYear,
    ),
  };
};

export const parseShiftPlanningRequestV2 = (
  value: unknown,
): ShiftPlanningRequestV2 => {
  const request = requireRecord(value, "invalid_planning_request");
  requireExactKeys(request, exactRequestKeys, "invalid_planning_request");
  if (
    request.schemaVersion !== SHIFT_PLANNING_REQUEST_SCHEMA_VERSION ||
    (
      request.environment !== "develop" &&
      request.environment !== "production"
    ) ||
    (
      request.mode !== "preview" &&
      request.mode !== "stage" &&
      request.mode !== "activate"
    ) ||
    request.status !== "requested"
  ) {
    throw new ShiftPlanningError(
      "invalid_planning_request",
      "Planning request discriminator is invalid.",
    );
  }
  const subplans = requireRecord(request.subplans, "invalid_planning_request");
  requireExactKeys(
    subplans,
    ["delivery", "market"],
    "invalid_planning_request",
  );
  if (
    (request.mode === "preview" && request.binding !== null) ||
    (request.mode !== "preview" && request.binding === null)
  ) {
    throw new ShiftPlanningError(
      "invalid_planning_request",
      "Planning mode binding is invalid.",
    );
  }
  const binding = request.mode === "preview" ? null : parseBinding(
    request.binding,
    request.mode,
  );
  const requestId = requireIdentifier(
    request.requestId,
    "invalid_planning_request",
  );
  const bundleId = requireIdentifier(
    request.bundleId,
    "invalid_planning_request",
  );
  if (
    (binding?.kind === "preview" && binding.sourceRequestId === requestId) ||
    (binding?.kind === "candidate" && binding.candidateId !== bundleId)
  ) {
    throw new ShiftPlanningError(
      "invalid_planning_request",
      "Planning binding source identity is invalid.",
    );
  }
  return {
    schemaVersion: SHIFT_PLANNING_REQUEST_SCHEMA_VERSION,
    requestId,
    bundleId,
    environment: request.environment,
    requestedByUserId: requireIdentifier(
      request.requestedByUserId,
      "invalid_planning_request",
    ),
    requestedAtMillis: requireRequestTimestampMillis(request.requestedAt),
    mode: request.mode,
    status: "requested",
    expectedWriteEpoch: requireNonNegativeInteger(
      request.expectedWriteEpoch,
      "invalid_planning_request",
    ),
    expectedActiveRevision: requireNullableRevision(
      request.expectedActiveRevision,
      "invalid_planning_request",
    ),
    subplans: {
      delivery: parseSubplan(subplans.delivery),
      market: parseSubplan(subplans.market),
    },
    binding,
  };
};

const parseIntakeBarrier = (value: unknown): ShiftPlanningIntakeBarrier => {
  const barrier = requireRecord(value, "invalid_planning_state");
  requireExactKeys(
    barrier,
    ["revision", "digest", "verifiedAtMillis"],
    "invalid_planning_state",
  );
  return {
    revision: requireIdentifier(barrier.revision, "invalid_planning_state"),
    digest: requireDigest(barrier.digest, "invalid_planning_state"),
    verifiedAtMillis: requireNonNegativeInteger(
      barrier.verifiedAtMillis,
      "invalid_planning_state",
    ),
  };
};

export const parseShiftPlanningMaintenanceState = (
  value: unknown,
): ShiftPlanningMaintenanceState => {
  const state = requireRecord(value, "invalid_planning_state");
  requireExactKeys(state, exactMaintenanceKeys, "invalid_planning_state");
  if (
    state.schemaVersion !== SHIFT_PLANNING_STATE_SCHEMA_VERSION ||
    (state.maintenanceStatus !== "open" && state.maintenanceStatus !== "closed")
  ) {
    throw new ShiftPlanningError(
      "invalid_planning_state",
      "Planning state discriminator is invalid.",
    );
  }
  const activeRevision = requireNullableRevision(
    state.activeRevision,
    "invalid_planning_state",
  );
  const activeDigest = state.activeDigest === null ?
    null : requireDigest(state.activeDigest, "invalid_planning_state");
  if ((activeRevision === null) !== (activeDigest === null)) {
    throw new ShiftPlanningError(
      "invalid_planning_state",
      "Active planning revision and digest must change together.",
    );
  }
  const intakeBarrier = state.intakeBarrier === null ?
    null : parseIntakeBarrier(state.intakeBarrier);
  if (
    (state.maintenanceStatus === "closed") !== (intakeBarrier !== null)
  ) {
    throw new ShiftPlanningError(
      "invalid_planning_state",
      "Maintenance status and intake barrier are inconsistent.",
    );
  }
  return {
    schemaVersion: SHIFT_PLANNING_STATE_SCHEMA_VERSION,
    stateRevision: requireNonNegativeInteger(
      state.stateRevision,
      "invalid_planning_state",
    ),
    writeEpoch: requireNonNegativeInteger(
      state.writeEpoch,
      "invalid_planning_state",
    ),
    maintenanceStatus: state.maintenanceStatus,
    activeRevision,
    activeDigest,
    intakeBarrier,
    lastTransitionId: requireIdentifier(
      state.lastTransitionId,
      "invalid_planning_state",
    ),
  };
};

const requireStateIdentifierArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    throw new ShiftPlanningError(
      "invalid_planning_state",
      "Planning identifier collection is invalid.",
    );
  }
  const identifiers = value.map((item) =>
    requireIdentifier(item, "invalid_planning_state"));
  if (new Set(identifiers).size !== identifiers.length) {
    throw new ShiftPlanningError(
      "invalid_planning_state",
      "Planning identifier collection contains duplicates.",
    );
  }
  return identifiers;
};

const parseShiftRotationCursor = (
  value: unknown,
  type: ShiftRotationType,
): ShiftRotationCursor => {
  const cursor = requireRecord(value, "invalid_planning_state");
  requireExactKeys(
    cursor,
    exactRotationCursorKeys,
    "invalid_planning_state",
  );
  const candidate: ShiftRotationCursor = {
    schemaVersion: SHIFT_PLANNING_SCHEMA_VERSION,
    type,
    cohortUserIds: requireStateIdentifierArray(cursor.cohortUserIds),
    roundNumber: requireNonNegativeInteger(
      cursor.roundNumber,
      "invalid_planning_state",
    ),
    nextMemberIndex: requireNonNegativeInteger(
      cursor.nextMemberIndex,
      "invalid_planning_state",
    ),
  };
  if (
    cursor.schemaVersion !== SHIFT_PLANNING_SCHEMA_VERSION ||
    cursor.type !== type
  ) {
    throw new ShiftPlanningError(
      "invalid_planning_state",
      "Rotation cursor discriminator is invalid.",
    );
  }
  try {
    return consumeRotationPositions(candidate, 0).nextRotation;
  } catch {
    throw new ShiftPlanningError(
      "invalid_planning_state",
      "Rotation cursor is invalid.",
    );
  }
};

const parseShiftPlanningLineage = (
  value: unknown,
): ShiftPlanningLineage | null => {
  if (value === null) return null;
  const lineage = requireRecord(value, "invalid_planning_state");
  requireExactKeys(
    lineage,
    ["revision", "digest"],
    "invalid_planning_state",
  );
  return {
    revision: requireIdentifier(lineage.revision, "invalid_planning_state"),
    digest: requireDigest(lineage.digest, "invalid_planning_state"),
  };
};

const parseShiftPlanningReleaseLease = (
  value: unknown,
  type: ShiftRotationType,
): ShiftPlanningReleaseLease | null => {
  if (value === null) return null;
  const lease = requireRecord(value, "invalid_planning_state");
  requireExactKeys(
    lease,
    exactReleaseLeaseKeys,
    "invalid_planning_state",
  );
  const acquiredAtMillis = requireNonNegativeInteger(
    lease.acquiredAtMillis,
    "invalid_planning_state",
  );
  const deadlineAtMillis = requireNonNegativeInteger(
    lease.deadlineAtMillis,
    "invalid_planning_state",
  );
  if (
    lease.type !== type ||
    (
      lease.state !== "sealed" &&
      lease.state !== "releasing" &&
      lease.state !== "degraded"
    ) ||
    deadlineAtMillis < acquiredAtMillis
  ) {
    throw new ShiftPlanningError(
      "invalid_planning_state",
      "Planning release lease is invalid.",
    );
  }
  return {
    type,
    bundleId: requireIdentifier(lease.bundleId, "invalid_planning_state"),
    bundleRevision: requireIdentifier(
      lease.bundleRevision,
      "invalid_planning_state",
    ),
    bundleDigest: requireDigest(
      lease.bundleDigest,
      "invalid_planning_state",
    ),
    leaseEpoch: requireNonNegativeInteger(
      lease.leaseEpoch,
      "invalid_planning_state",
    ),
    ownerOperationId: requireIdentifier(
      lease.ownerOperationId,
      "invalid_planning_state",
    ),
    state: lease.state,
    acquiredAtMillis,
    deadlineAtMillis,
  };
};

export const parseShiftRotationAggregateWire = (
  value: unknown,
  expectedType: ShiftRotationType,
): ShiftRotationAggregateWire => {
  const aggregate = requireRecord(value, "invalid_planning_state");
  requireExactKeys(
    aggregate,
    exactRotationAggregateKeys,
    "invalid_planning_state",
  );
  if (
    aggregate.schemaVersion !== SHIFT_PLANNING_WIRE_SCHEMA_VERSION ||
    aggregate.type !== expectedType ||
    typeof aggregate.cohortFrozen !== "boolean"
  ) {
    throw new ShiftPlanningError(
      "invalid_planning_state",
      "Rotation aggregate discriminator is invalid.",
    );
  }
  const cursor = parseShiftRotationCursor(aggregate.cursor, expectedType);
  const frozenCohortUserIds = requireStateIdentifierArray(
    aggregate.frozenCohortUserIds,
  );
  const frozenCohortMatches =
    cursor.cohortUserIds.length === frozenCohortUserIds.length &&
    cursor.cohortUserIds.every(
      (userId, index) => userId === frozenCohortUserIds[index],
    );
  const shouldFreezeCohort = cursor.nextMemberIndex !== 0;
  if (
    aggregate.cohortFrozen !== shouldFreezeCohort ||
    (shouldFreezeCohort && !frozenCohortMatches) ||
    (!shouldFreezeCohort && frozenCohortUserIds.length !== 0)
  ) {
    throw new ShiftPlanningError(
      "invalid_planning_state",
      "Rotation cohort freeze state is inconsistent.",
    );
  }
  const activeRevision = requireNullableRevision(
    aggregate.activeRevision,
    "invalid_planning_state",
  );
  const activeDigest = aggregate.activeDigest === null ?
    null : requireDigest(aggregate.activeDigest, "invalid_planning_state");
  if ((activeRevision === null) !== (activeDigest === null)) {
    throw new ShiftPlanningError(
      "invalid_planning_state",
      "Rotation active revision and digest must change together.",
    );
  }
  const planningFrontierSeasonStartYear = requireNonNegativeInteger(
    aggregate.planningFrontierSeasonStartYear,
    "invalid_planning_state",
  );
  if (
    planningFrontierSeasonStartYear < 2000 ||
    planningFrontierSeasonStartYear > 9998
  ) {
    throw new ShiftPlanningError(
      "invalid_planning_state",
      "Rotation planning frontier is invalid.",
    );
  }
  return {
    schemaVersion: SHIFT_PLANNING_WIRE_SCHEMA_VERSION,
    type: expectedType,
    stateRevision: requireNonNegativeInteger(
      aggregate.stateRevision,
      "invalid_planning_state",
    ),
    cursor,
    planningFrontierSeasonStartYear,
    cohortFrozen: aggregate.cohortFrozen,
    frozenCohortUserIds,
    activeRevision,
    activeDigest,
    lastIdempotencyKey: aggregate.lastIdempotencyKey === null ?
      null : requireIdentifier(
        aggregate.lastIdempotencyKey,
        "invalid_planning_state",
      ),
    migrationBaseline: parseShiftPlanningLineage(
      aggregate.migrationBaseline,
    ),
    releaseLease: parseShiftPlanningReleaseLease(
      aggregate.releaseLease,
      expectedType,
    ),
  };
};

const failureMessageKeys: Record<ShiftPlanningFailureCode, string> = {
  adjacent_delivery_lead_conflict: "adjacentDeliveryLeadConflict",
  delivery_helper_cursor_conflict: "deliveryHelperCursorConflict",
  delivery_helper_evidence_ambiguous: "deliveryHelperEvidenceAmbiguous",
  delivery_helper_ineligible: "deliveryHelperIneligible",
  insufficient_delivery_members: "insufficientDeliveryMembers",
  insufficient_market_members: "insufficientMarketMembers",
  invalid_business_date: "invalidBusinessDate",
  invalid_delivery_continuity: "invalidDeliveryContinuity",
  invalid_delivery_calendar: "invalidDeliveryCalendar",
  invalid_inherited_projection_prefix: "invalidInheritedProjectionPrefix",
  invalid_inherited_rotation_lineage: "invalidInheritedRotationLineage",
  invalid_market_assignee_group: "invalidMarketAssigneeGroup",
  invalid_planning_request_id: "invalidPlanningRequestId",
  invalid_planning_request: "invalidPlanningRequest",
  invalid_planning_state: "invalidPlanningState",
  invalid_planning_frontier: "invalidPlanningFrontier",
  invalid_shift_planning_digest_input: "invalidShiftPlanningDigestInput",
  invalid_shift_planning_fairness_snapshot:
    "invalidShiftPlanningFairnessSnapshot",
  planning_binding_mismatch: "planningBindingMismatch",
  preview_binding_mismatch: "previewBindingMismatch",
  candidate_binding_mismatch: "candidateBindingMismatch",
  request_intent_conflict: "requestIntentConflict",
  stale_write_epoch: "staleWriteEpoch",
  stale_active_revision: "staleActiveRevision",
  fairness_input_drift: "fairnessInputDrift",
  planning_release_lease_conflict: "planningReleaseLeaseConflict",
  maintenance_state_conflict: "maintenanceStateConflict",
  internal_planning_failure: "internalPlanningFailure",
  planning_bundle_oversize: "planningBundleOversize",
  frozen_cohort_mismatch: "frozenCohortMismatch",
  invalid_rotation_cohort: "invalidRotationCohort",
  invalid_rotation_cursor: "invalidRotationCursor",
  invalid_rotation_position_count: "invalidRotationPositionCount",
  invalid_rotation_type: "invalidRotationType",
  invalid_target_season: "invalidTargetSeason",
  planning_frontier_complete: "planningFrontierComplete",
};

export const isShiftPlanningFailureCode = (
  value: unknown,
): value is ShiftPlanningFailureCode =>
  typeof value === "string" &&
  Object.prototype.hasOwnProperty.call(failureMessageKeys, value);

export const buildShiftPlanningFailureSummary = (input: {
  mode: ShiftPlanningMode;
  bundleId: string;
  scope: ShiftPlanningFailureScope;
  code: ShiftPlanningFailureCode;
}): ShiftPlanningFailedSummary => {
  if (!isShiftPlanningFailureCode(input.code)) {
    throw new ShiftPlanningError(
      "invalid_planning_request",
      "Planning failure code is invalid.",
    );
  }
  return {
    schemaVersion: SHIFT_PLANNING_WIRE_SCHEMA_VERSION,
    status: "failed",
    mode: input.mode,
    bundleId: requireIdentifier(input.bundleId, "invalid_planning_request"),
    failure: {
      scope: input.scope,
      code: input.code,
      messageKey: `shiftPlanning.error.${failureMessageKeys[input.code]}`,
    },
  };
};
