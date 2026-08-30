import {
  DeliveryPlan,
  PlannedDeliveryShift,
} from "./delivery-shift-planner.js";
import {
  MarketPlan,
  PlannedMarketShift,
} from "./market-shift-planner.js";
import {
  ShiftPlanningError,
  ShiftRotationType,
} from "./shift-planning-contract.js";
import {createShiftPlanningDigest} from "./shift-planning-digest.js";

export const SHIFT_PLANNING_CANDIDATE_POSITION_SCHEMA_VERSION = 1 as const;

type UnknownRecord = Record<string, unknown>;

export type ShiftPlanningCandidateRotationPosition = {
  rotationOwnerUserId: string;
  effectiveAssigneeUserId: string;
  roundNumber: number;
  positionInRound: number;
  planningReason:
    | "target"
    | "boundaryRoundRemainder"
    | "finalGroupPadding";
};

export type ShiftPlanningCandidatePosition = {
  schemaVersion: typeof SHIFT_PLANNING_CANDIDATE_POSITION_SCHEMA_VERSION;
  positionId: string;
  candidateId: string;
  type: ShiftRotationType;
  shiftId: string;
  scheduledDate: string;
  projectionSeasonStartYear: number;
  rotationOwnerUserIds: readonly string[];
  assignedUserIds: readonly string[];
  rotationPositions: readonly ShiftPlanningCandidateRotationPosition[];
  helperUserId: string | null;
  source: "app";
  origin: "planner";
  planningRequestId: string;
  bundleRevision: string;
  bundleDigest: string;
  writeEpoch: number;
};

export type ShiftPlanningCandidatePositionManifest = {
  schemaVersion: typeof SHIFT_PLANNING_CANDIDATE_POSITION_SCHEMA_VERSION;
  positionDocumentCount: number;
  assignmentPositionCount: number;
  positionSetDigest: string;
};

export type ShiftPlanningCandidatePositionSet = {
  manifest: ShiftPlanningCandidatePositionManifest;
  positions: readonly ShiftPlanningCandidatePosition[];
};

export type ShiftPlanningPersistedCandidatePosition = {
  schemaVersion: typeof SHIFT_PLANNING_CANDIDATE_POSITION_SCHEMA_VERSION;
  candidateId: string;
  candidateDigest: string;
  positionId: string;
  positionDigest: string;
  position: ShiftPlanningCandidatePosition;
};

const positionFields = [
  "schemaVersion",
  "positionId",
  "candidateId",
  "type",
  "shiftId",
  "scheduledDate",
  "projectionSeasonStartYear",
  "rotationOwnerUserIds",
  "assignedUserIds",
  "rotationPositions",
  "helperUserId",
  "source",
  "origin",
  "planningRequestId",
  "bundleRevision",
  "bundleDigest",
  "writeEpoch",
] as const;

const failCandidate = (message: string): never => {
  throw new ShiftPlanningError("candidate_binding_mismatch", message);
};

const requireRecord = (value: unknown, name: string): UnknownRecord => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    (
      Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null
    )
  ) {
    return failCandidate(`${name} must be a plain object.`);
  }
  return value as UnknownRecord;
};

const requireExactFields = (
  value: UnknownRecord,
  fields: readonly string[],
  name: string,
): void => {
  const actual = Object.keys(value);
  if (
    actual.length !== fields.length ||
    actual.some((field) => !fields.includes(field))
  ) {
    failCandidate(`${name} fields are not exact.`);
  }
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failCandidate(`${name} is not a valid identifier.`);
  }
  return value;
};

const requireDigest = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return failCandidate(`${name} is not a planning digest.`);
  }
  return value;
};

const requireNonNegativeInteger = (value: unknown, name: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return failCandidate(`${name} must be a non-negative integer.`);
  }
  return value as number;
};

const requirePositiveInteger = (value: unknown, name: string): number => {
  const integer = requireNonNegativeInteger(value, name);
  if (integer < 1) return failCandidate(`${name} must be positive.`);
  return integer;
};

const requireIdentifierArray = (
  value: unknown,
  name: string,
): readonly string[] => {
  if (!Array.isArray(value)) {
    return failCandidate(`${name} must be an array.`);
  }
  const identifiers = value.map((item, index) =>
    requireIdentifier(item, `${name}[${index}]`));
  if (new Set(identifiers).size !== identifiers.length) {
    return failCandidate(`${name} must not contain duplicates.`);
  }
  return identifiers;
};

const requirePlanningReason = (
  value: unknown,
): ShiftPlanningCandidateRotationPosition["planningReason"] => {
  if (
    value !== "target" &&
    value !== "boundaryRoundRemainder" &&
    value !== "finalGroupPadding"
  ) {
    return failCandidate("Candidate planning reason is invalid.");
  }
  return value;
};

const publicShiftId = (
  type: ShiftRotationType,
  date: string,
): string => `shift_${type}_${date.replace(/-/g, "")}`;

const requireCalendarDate = (value: unknown): string => {
  if (typeof value !== "string") {
    return failCandidate("Candidate scheduledDate is invalid.");
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) {
    return failCandidate("Candidate scheduledDate is invalid.");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (
    year < 1 ||
    month < 1 ||
    month > daysInMonth.length ||
    day < 1 ||
    day > daysInMonth[month - 1]
  ) {
    return failCandidate("Candidate scheduledDate is invalid.");
  }
  return value;
};

const parseRotationPosition = (
  value: unknown,
  index: number,
): ShiftPlanningCandidateRotationPosition => {
  const position = requireRecord(
    value,
    `candidate rotationPositions[${index}]`,
  );
  requireExactFields(position, [
    "rotationOwnerUserId",
    "effectiveAssigneeUserId",
    "roundNumber",
    "positionInRound",
    "planningReason",
  ], `candidate rotationPositions[${index}]`);
  return {
    rotationOwnerUserId: requireIdentifier(
      position.rotationOwnerUserId,
      `candidate rotationPositions[${index}].rotationOwnerUserId`,
    ),
    effectiveAssigneeUserId: requireIdentifier(
      position.effectiveAssigneeUserId,
      `candidate rotationPositions[${index}].effectiveAssigneeUserId`,
    ),
    roundNumber: requirePositiveInteger(
      position.roundNumber,
      `candidate rotationPositions[${index}].roundNumber`,
    ),
    positionInRound: requirePositiveInteger(
      position.positionInRound,
      `candidate rotationPositions[${index}].positionInRound`,
    ),
    planningReason: requirePlanningReason(position.planningReason),
  };
};

export const parseShiftPlanningCandidatePositionManifest = (
  value: unknown,
): ShiftPlanningCandidatePositionManifest => {
  const manifest = requireRecord(value, "candidate position manifest");
  requireExactFields(manifest, [
    "schemaVersion",
    "positionDocumentCount",
    "assignmentPositionCount",
    "positionSetDigest",
  ], "candidate position manifest");
  if (
    manifest.schemaVersion !==
      SHIFT_PLANNING_CANDIDATE_POSITION_SCHEMA_VERSION
  ) {
    return failCandidate("Candidate position manifest version is invalid.");
  }
  const positionDocumentCount = requireNonNegativeInteger(
    manifest.positionDocumentCount,
    "candidate positionDocumentCount",
  );
  const assignmentPositionCount = requireNonNegativeInteger(
    manifest.assignmentPositionCount,
    "candidate assignmentPositionCount",
  );
  if (assignmentPositionCount < positionDocumentCount) {
    return failCandidate("Candidate position counts are inconsistent.");
  }
  return {
    schemaVersion: SHIFT_PLANNING_CANDIDATE_POSITION_SCHEMA_VERSION,
    positionDocumentCount,
    assignmentPositionCount,
    positionSetDigest: requireDigest(
      manifest.positionSetDigest,
      "candidate positionSetDigest",
    ),
  };
};

export const parseShiftPlanningCandidatePosition = (
  value: unknown,
): ShiftPlanningCandidatePosition => {
  const position = requireRecord(value, "candidate position");
  requireExactFields(position, positionFields, "candidate position");
  if (
    position.schemaVersion !==
      SHIFT_PLANNING_CANDIDATE_POSITION_SCHEMA_VERSION ||
    (position.type !== "delivery" && position.type !== "market") ||
    position.source !== "app" ||
    position.origin !== "planner"
  ) {
    return failCandidate("Candidate position discriminators are invalid.");
  }
  const type = position.type;
  const scheduledDate = requireCalendarDate(position.scheduledDate);
  const rotationOwnerUserIds = requireIdentifierArray(
    position.rotationOwnerUserIds,
    "candidate rotationOwnerUserIds",
  );
  const assignedUserIds = requireIdentifierArray(
    position.assignedUserIds,
    "candidate assignedUserIds",
  );
  if (!Array.isArray(position.rotationPositions)) {
    return failCandidate("Candidate rotationPositions must be an array.");
  }
  const rotationPositions = position.rotationPositions.map(
    parseRotationPosition,
  );
  const expectedPositionCount = type === "delivery" ? 1 : 3;
  if (
    rotationOwnerUserIds.length !== expectedPositionCount ||
    assignedUserIds.length !== expectedPositionCount ||
    rotationPositions.length !== expectedPositionCount ||
    rotationPositions.some((item, index) =>
      item.rotationOwnerUserId !== rotationOwnerUserIds[index] ||
      item.effectiveAssigneeUserId !== assignedUserIds[index]
    ) ||
    (type === "market" && position.helperUserId !== null)
  ) {
    return failCandidate("Candidate position assignment shape is invalid.");
  }
  const helperUserId = position.helperUserId === null ?
    null : requireIdentifier(position.helperUserId, "candidate helperUserId");
  const parsed: ShiftPlanningCandidatePosition = {
    schemaVersion: SHIFT_PLANNING_CANDIDATE_POSITION_SCHEMA_VERSION,
    positionId: requireIdentifier(position.positionId, "positionId"),
    candidateId: requireIdentifier(position.candidateId, "candidateId"),
    type,
    shiftId: requireIdentifier(position.shiftId, "shiftId"),
    scheduledDate,
    projectionSeasonStartYear: requirePositiveInteger(
      position.projectionSeasonStartYear,
      "candidate projectionSeasonStartYear",
    ),
    rotationOwnerUserIds,
    assignedUserIds,
    rotationPositions,
    helperUserId,
    source: "app",
    origin: "planner",
    planningRequestId: requireIdentifier(
      position.planningRequestId,
      "candidate planningRequestId",
    ),
    bundleRevision: requireIdentifier(
      position.bundleRevision,
      "candidate bundleRevision",
    ),
    bundleDigest: requireDigest(
      position.bundleDigest,
      "candidate bundleDigest",
    ),
    writeEpoch: requireNonNegativeInteger(
      position.writeEpoch,
      "candidate writeEpoch",
    ),
  };
  if (
    parsed.positionId !== parsed.shiftId ||
    parsed.shiftId !== publicShiftId(parsed.type, parsed.scheduledDate)
  ) {
    return failCandidate("Candidate position ID is not canonical.");
  }
  return parsed;
};

const deliveryPosition = (input: {
  candidateId: string;
  bundleRevision: string;
  bundleDigest: string;
  writeEpoch: number;
  shift: PlannedDeliveryShift;
}): ShiftPlanningCandidatePosition => {
  const shiftId = publicShiftId("delivery", input.shift.date);
  return {
    schemaVersion: SHIFT_PLANNING_CANDIDATE_POSITION_SCHEMA_VERSION,
    positionId: shiftId,
    candidateId: input.candidateId,
    type: "delivery",
    shiftId,
    scheduledDate: input.shift.date,
    projectionSeasonStartYear: input.shift.projectionSeasonStartYear,
    rotationOwnerUserIds: [input.shift.rotationOwnerUserId],
    assignedUserIds: [...input.shift.assignedUserIds],
    rotationPositions: [{
      rotationOwnerUserId: input.shift.rotationOwnerUserId,
      effectiveAssigneeUserId: input.shift.assignedUserIds[0],
      roundNumber: input.shift.roundNumber,
      positionInRound: input.shift.positionInRound,
      planningReason: input.shift.planningReason,
    }],
    helperUserId: input.shift.helperUserId,
    source: input.shift.source,
    origin: input.shift.origin,
    planningRequestId: input.shift.planningRequestId,
    bundleRevision: input.bundleRevision,
    bundleDigest: input.bundleDigest,
    writeEpoch: input.writeEpoch,
  };
};

const marketPosition = (input: {
  candidateId: string;
  bundleRevision: string;
  bundleDigest: string;
  writeEpoch: number;
  shift: PlannedMarketShift;
}): ShiftPlanningCandidatePosition => {
  const shiftId = publicShiftId("market", input.shift.date);
  return {
    schemaVersion: SHIFT_PLANNING_CANDIDATE_POSITION_SCHEMA_VERSION,
    positionId: shiftId,
    candidateId: input.candidateId,
    type: "market",
    shiftId,
    scheduledDate: input.shift.date,
    projectionSeasonStartYear: input.shift.projectionSeasonStartYear,
    rotationOwnerUserIds: [...input.shift.rotationOwnerUserIds],
    assignedUserIds: [...input.shift.assignedUserIds],
    rotationPositions: input.shift.rotationPositions.map((position, index) => ({
      rotationOwnerUserId: position.rotationOwnerUserId,
      effectiveAssigneeUserId: input.shift.assignedUserIds[index],
      roundNumber: position.roundNumber,
      positionInRound: position.positionInRound,
      planningReason: position.planningReason,
    })),
    helperUserId: null,
    source: input.shift.source,
    origin: input.shift.origin,
    planningRequestId: input.shift.planningRequestId,
    bundleRevision: input.bundleRevision,
    bundleDigest: input.bundleDigest,
    writeEpoch: input.writeEpoch,
  };
};

const manifestForPositions = (
  positions: readonly ShiftPlanningCandidatePosition[],
): ShiftPlanningCandidatePositionManifest => {
  const entries = positions.map((position) => ({
    positionId: position.positionId,
    positionDigest: createShiftPlanningDigest(position),
  }));
  return {
    schemaVersion: SHIFT_PLANNING_CANDIDATE_POSITION_SCHEMA_VERSION,
    positionDocumentCount: positions.length,
    assignmentPositionCount: positions.reduce(
      (total, position) => total + position.assignedUserIds.length,
      0,
    ),
    positionSetDigest: createShiftPlanningDigest(entries),
  };
};

/**
 * Builds the immutable admin-inspection projection for one staged bundle.
 * The preview bundle remains the planning authority; this projection is a
 * digest-bound, queryable view and never advances active state.
 * @param {object} input Candidate lineage plus both deterministic plans.
 * @return {object} Ordered position documents and their set manifest.
 */
export const buildShiftPlanningCandidatePositionSet = (input: {
  candidateId: string;
  bundleRevision: string;
  bundleDigest: string;
  writeEpoch: number;
  delivery: DeliveryPlan;
  market: MarketPlan;
}): ShiftPlanningCandidatePositionSet => {
  requireIdentifier(input.candidateId, "candidateId");
  requireIdentifier(input.bundleRevision, "bundleRevision");
  requireDigest(input.bundleDigest, "bundleDigest");
  requireNonNegativeInteger(input.writeEpoch, "writeEpoch");
  const positions = [
    ...input.delivery.shifts.map((shift) =>
      deliveryPosition({...input, shift})),
    ...input.market.shifts.map((shift) =>
      marketPosition({...input, shift})),
  ].sort((left, right) => left.positionId.localeCompare(right.positionId));
  if (
    new Set(positions.map(({positionId}) => positionId)).size !==
      positions.length
  ) {
    return failCandidate("Candidate position IDs must be unique.");
  }
  positions.forEach((position) =>
    parseShiftPlanningCandidatePosition(position));
  return {manifest: manifestForPositions(positions), positions};
};

export const persistShiftPlanningCandidatePosition = (input: {
  position: ShiftPlanningCandidatePosition;
  candidateDigest: string;
}): ShiftPlanningPersistedCandidatePosition => {
  const position = parseShiftPlanningCandidatePosition(input.position);
  return {
    schemaVersion: SHIFT_PLANNING_CANDIDATE_POSITION_SCHEMA_VERSION,
    candidateId: position.candidateId,
    candidateDigest: requireDigest(input.candidateDigest, "candidateDigest"),
    positionId: position.positionId,
    positionDigest: createShiftPlanningDigest(position),
    position,
  };
};

export const parseShiftPlanningPersistedCandidatePosition = (
  value: unknown,
): ShiftPlanningPersistedCandidatePosition => {
  const document = requireRecord(value, "persisted candidate position");
  requireExactFields(document, [
    "schemaVersion",
    "candidateId",
    "candidateDigest",
    "positionId",
    "positionDigest",
    "position",
  ], "persisted candidate position");
  if (
    document.schemaVersion !==
      SHIFT_PLANNING_CANDIDATE_POSITION_SCHEMA_VERSION
  ) {
    return failCandidate("Persisted candidate position version is invalid.");
  }
  const position = parseShiftPlanningCandidatePosition(document.position);
  const parsed = {
    schemaVersion: SHIFT_PLANNING_CANDIDATE_POSITION_SCHEMA_VERSION,
    candidateId: requireIdentifier(document.candidateId, "candidateId"),
    candidateDigest: requireDigest(document.candidateDigest, "candidateDigest"),
    positionId: requireIdentifier(document.positionId, "positionId"),
    positionDigest: requireDigest(document.positionDigest, "positionDigest"),
    position,
  };
  if (
    parsed.candidateId !== position.candidateId ||
    parsed.positionId !== position.positionId ||
    parsed.positionDigest !== createShiftPlanningDigest(position)
  ) {
    return failCandidate("Persisted candidate position lineage is invalid.");
  }
  return parsed;
};

export const validateShiftPlanningCandidatePositionSet = (input: {
  manifest: unknown;
  positions: readonly ShiftPlanningPersistedCandidatePosition[];
  candidateId: string;
  candidateDigest: string;
  bundleRevision: string;
  bundleDigest: string;
  writeEpoch: number;
}): readonly ShiftPlanningPersistedCandidatePosition[] => {
  const manifest = parseShiftPlanningCandidatePositionManifest(input.manifest);
  const candidateId = requireIdentifier(input.candidateId, "candidateId");
  const candidateDigest = requireDigest(
    input.candidateDigest,
    "candidateDigest",
  );
  const bundleRevision = requireIdentifier(
    input.bundleRevision,
    "bundleRevision",
  );
  const bundleDigest = requireDigest(input.bundleDigest, "bundleDigest");
  const writeEpoch = requireNonNegativeInteger(input.writeEpoch, "writeEpoch");
  const positions = input.positions
    .map((document) => parseShiftPlanningPersistedCandidatePosition(document))
    .sort((left, right) => left.positionId.localeCompare(right.positionId));
  if (
    new Set(positions.map(({positionId}) => positionId)).size !==
      positions.length ||
    positions.some((document) =>
      document.candidateId !== candidateId ||
      document.candidateDigest !== candidateDigest ||
      document.position.candidateId !== candidateId ||
      document.position.bundleRevision !== bundleRevision ||
      document.position.bundleDigest !== bundleDigest ||
      document.position.writeEpoch !== writeEpoch
    )
  ) {
    return failCandidate("Candidate position-set lineage is invalid.");
  }
  const actualManifest = manifestForPositions(
    positions.map(({position}) => position),
  );
  if (
    createShiftPlanningDigest(actualManifest) !==
      createShiftPlanningDigest(manifest)
  ) {
    return failCandidate("Candidate position set does not match its manifest.");
  }
  return positions;
};
