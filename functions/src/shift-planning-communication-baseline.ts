import {
  DeliveryPlan,
  DeliveryPlannerPredecessor,
  PlannedDeliveryShift,
  planDeliveryShifts,
} from "./delivery-shift-planner.js";
import {
  MarketPlan,
  PlannedMarketShift,
  planMarketShifts,
} from "./market-shift-planner.js";
import {BusinessWeekday} from "./shift-planning-calendar.js";
import {
  ShiftPlanningDigest,
  createShiftPlanningDigest,
} from "./shift-planning-digest.js";
import {isEligibleForShiftRotation} from "./shift-eligibility.js";
import {
  ApprovedRotationMapping,
  LegacyDeliveryHelperEvidence,
  ShiftRotationBootstrapResult,
  resolveShiftRotationBootstrap,
} from "./shift-rotation-bootstrap.js";

export const SHIFT_PLANNING_COMMUNICATION_BASELINE_SCHEMA_VERSION = 2 as const;
export const SHIFT_PLANNING_COMMUNICATION_APPROVAL_MAX_VALIDITY_MS =
  15 * 60_000;

export type ShiftPlanningCommunicationBaselineFailureCode =
  | "invalid_shift_communication_baseline_input"
  | "incommunicable_shift_roster"
  | "invalid_shift_communication_source_manifest"
  | "shift_communication_source_manifest_mismatch"
  | "shift_communication_mapping_digest_mismatch"
  | "shift_communication_approval_mismatch"
  | "invalid_shift_communication_zero_write_attestation"
  | "invalid_shift_communication_seal";

/** Stable fail-closed error for the private communication-baseline boundary. */
export class ShiftPlanningCommunicationBaselineError extends Error {
  readonly code: ShiftPlanningCommunicationBaselineFailureCode;

  /**
   * Preserves a stable machine code while keeping diagnostics internal.
   * @param {ShiftPlanningCommunicationBaselineFailureCode} code Failure code.
   * @param {string} message Internal non-user-facing diagnostic.
   */
  constructor(
    code: ShiftPlanningCommunicationBaselineFailureCode,
    message: string,
  ) {
    super(message);
    this.name = "ShiftPlanningCommunicationBaselineError";
    this.code = code;
  }
}

export type ShiftPlanningCommunicationSourceManifestPayload = {
  schemaVersion:
    typeof SHIFT_PLANNING_COMMUNICATION_BASELINE_SCHEMA_VERSION;
  captureId: string;
  capturedAt: string;
  revision: string;
  provenance: string;
  rosterDigest: ShiftPlanningDigest;
  deliveryWeekdayDigest: ShiftPlanningDigest;
  predecessorDigest: ShiftPlanningDigest;
};

export type ShiftPlanningCommunicationSourceManifest =
  ShiftPlanningCommunicationSourceManifestPayload & {
    manifestDigest: ShiftPlanningDigest;
  };

export type ShiftPlanningSourceRosterMember = {
  userId: string;
  displayName: string | null;
  phone: string | null;
  isActive: boolean;
  roles: readonly string[];
  isCommonPurchaseManager: boolean;
};

export type ShiftPlanningEligibilityRosterMember = Pick<
  ShiftPlanningSourceRosterMember,
  "userId" | "isActive" | "roles" | "isCommonPurchaseManager"
>;

export type ShiftPlanningResolverEntry = {
  userId: string;
  displayName: string;
};

export type ShiftPlanningUniqueLegacyDeliveryHelperEvidence = Extract<
  LegacyDeliveryHelperEvidence,
  {kind: "unique"}
>;

export type ShiftPlanningCommunicationProposalInput = {
  schemaVersion:
    typeof SHIFT_PLANNING_COMMUNICATION_BASELINE_SCHEMA_VERSION;
  proposalId: string;
  environment: "production";
  targetSeasonStartYear: number;
  sourceManifest: ShiftPlanningCommunicationSourceManifest;
  roster: readonly ShiftPlanningSourceRosterMember[];
  delivery: {
    planningRequestId: string;
    deliveryWeekday: BusinessWeekday;
    approvedMapping: ApprovedRotationMapping;
    predecessor: DeliveryPlannerPredecessor;
    legacyHelper: ShiftPlanningUniqueLegacyDeliveryHelperEvidence;
  };
  market: {
    planningRequestId: string;
    approvedMapping: ApprovedRotationMapping;
  };
};

type ShiftPlanningCommunicationProposalArtifact = {
  schemaVersion:
    typeof SHIFT_PLANNING_COMMUNICATION_BASELINE_SCHEMA_VERSION;
  status: "proposal";
  proposalId: string;
  environment: "production";
  targetSeasonStartYear: number;
  sourceManifest: ShiftPlanningCommunicationSourceManifest;
  inputDigest: ShiftPlanningDigest;
  rosterDigest: ShiftPlanningDigest;
  eligibilityRoster: readonly ShiftPlanningEligibilityRosterMember[];
  eligibilityRosterDigest: ShiftPlanningDigest;
  resolverEntries: readonly ShiftPlanningResolverEntry[];
  resolverDigest: ShiftPlanningDigest;
  assignmentDigest: ShiftPlanningDigest;
  planningDigest: ShiftPlanningDigest;
  delivery: {
    approvedMapping: ApprovedRotationMapping;
    approvedMappingDigest: ShiftPlanningDigest;
    predecessor: DeliveryPlannerPredecessor;
    legacyHelper: ShiftPlanningUniqueLegacyDeliveryHelperEvidence;
    continuityDigest: ShiftPlanningDigest;
    bootstrap: ShiftRotationBootstrapResult;
    bootstrapDigest: ShiftPlanningDigest;
    plan: DeliveryPlan;
    planDigest: ShiftPlanningDigest;
  };
  market: {
    approvedMapping: ApprovedRotationMapping;
    approvedMappingDigest: ShiftPlanningDigest;
    bootstrap: ShiftRotationBootstrapResult;
    bootstrapDigest: ShiftPlanningDigest;
    plan: MarketPlan;
    planDigest: ShiftPlanningDigest;
  };
};

export type ShiftPlanningCommunicationProposal =
  ShiftPlanningCommunicationProposalArtifact & {
    proposalDigest: ShiftPlanningDigest;
  };

export type ShiftPlanningZeroWriteAttestation = {
  kind: "zeroWrite";
  attestedAt: string;
  firestoreWriteCount: 0;
  workbookWriteCount: 0;
  notificationDispatchCount: 0;
  evidence: string;
};

export type ShiftPlanningCommunicationGlobalApproval = {
  approvalStatus: "approved";
  scope: "global";
  approvedBy: string;
  approvedAt: string;
  evidence: string;
  proposalDigest: ShiftPlanningDigest;
  planningDigest: ShiftPlanningDigest;
  validUntil: string;
  supersedesPlanningDigest: ShiftPlanningDigest | null;
  zeroWriteAttestation: ShiftPlanningZeroWriteAttestation;
};

export type ShiftPlanningCommunicationSealInput = {
  schemaVersion:
    typeof SHIFT_PLANNING_COMMUNICATION_BASELINE_SCHEMA_VERSION;
  sealId: string;
  sealedAt: string;
  proposalInput: ShiftPlanningCommunicationProposalInput;
  approval: ShiftPlanningCommunicationGlobalApproval;
};

type ShiftPlanningCommunicationSealArtifact = {
  schemaVersion:
    typeof SHIFT_PLANNING_COMMUNICATION_BASELINE_SCHEMA_VERSION;
  status: "sealed";
  sealId: string;
  sealedAt: string;
  validUntil: string;
  supersedesPlanningDigest: ShiftPlanningDigest | null;
  proposalInput: ShiftPlanningCommunicationProposalInput;
  proposal: ShiftPlanningCommunicationProposal;
  approval: ShiftPlanningCommunicationGlobalApproval;
};

export type ShiftPlanningCommunicationSeal =
  ShiftPlanningCommunicationSealArtifact & {
    sealDigest: ShiftPlanningDigest;
  };

export type ShiftPlanningAudienceRenderInput = {
  schemaVersion:
    typeof SHIFT_PLANNING_COMMUNICATION_BASELINE_SCHEMA_VERSION;
  seal: ShiftPlanningCommunicationSeal;
};

export type ShiftPlanningAudienceDeliveryRow = Pick<
  PlannedDeliveryShift,
  "date" | "projectionSeasonStartYear" | "roundNumber"
> & {
  ownerDisplayName: string;
};

export type ShiftPlanningAudienceMarketRow = Pick<
  PlannedMarketShift,
  "date" | "projectionSeasonStartYear"
> & {
  ownerDisplayNames: [string, string, string];
};

export type ShiftPlanningAudienceSchedule = {
  deliveryRows: readonly ShiftPlanningAudienceDeliveryRow[];
  marketRows: readonly ShiftPlanningAudienceMarketRow[];
};

export type ShiftPlanningCommunicationBaselineInput =
  ShiftPlanningCommunicationProposalInput;

export type ShiftPlanningCommunicationBaselineResult =
  ShiftPlanningCommunicationProposal;

const failInput = (message: string): never => {
  throw new ShiftPlanningCommunicationBaselineError(
    "invalid_shift_communication_baseline_input",
    message,
  );
};

const failRoster = (message: string): never => {
  throw new ShiftPlanningCommunicationBaselineError(
    "incommunicable_shift_roster",
    message,
  );
};

const failSourceManifest = (message: string): never => {
  throw new ShiftPlanningCommunicationBaselineError(
    "invalid_shift_communication_source_manifest",
    message,
  );
};

const failSourceMismatch = (message: string): never => {
  throw new ShiftPlanningCommunicationBaselineError(
    "shift_communication_source_manifest_mismatch",
    message,
  );
};

const failMappingDigest = (message: string): never => {
  throw new ShiftPlanningCommunicationBaselineError(
    "shift_communication_mapping_digest_mismatch",
    message,
  );
};

const failApproval = (message: string): never => {
  throw new ShiftPlanningCommunicationBaselineError(
    "shift_communication_approval_mismatch",
    message,
  );
};

const failZeroWrite = (message: string): never => {
  throw new ShiftPlanningCommunicationBaselineError(
    "invalid_shift_communication_zero_write_attestation",
    message,
  );
};

const failSeal = (message: string): never => {
  throw new ShiftPlanningCommunicationBaselineError(
    "invalid_shift_communication_seal",
    message,
  );
};

export const createShiftPlanningCommunicationSourceManifestDigest = (
  payload: ShiftPlanningCommunicationSourceManifestPayload,
): ShiftPlanningDigest => createShiftPlanningDigest(payload);

export type ShiftPlanningApprovedMappingDigestPayload = Omit<
  ApprovedRotationMapping,
  "digest"
>;

export const createShiftPlanningApprovedMappingDigest = (
  payload: ShiftPlanningApprovedMappingDigestPayload,
): ShiftPlanningDigest => createShiftPlanningDigest(payload);

const requireExactRecord = (
  value: unknown,
  keys: readonly string[],
  path: string,
): Record<string, unknown> => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return failInput(`${path} must be a plain object.`);
  }
  const record = value as Record<string, unknown>;
  const actualKeys = Object.keys(record).sort();
  const expectedKeys = [...keys].sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    return failInput(`${path} must contain exactly the documented fields.`);
  }
  return record;
};

const requireArray = (value: unknown, path: string): readonly unknown[] => {
  if (!Array.isArray(value)) {
    return failInput(`${path} must be an array.`);
  }
  return value;
};

const requireString = (value: unknown, path: string): string => {
  if (
    typeof value !== "string" ||
    !value ||
    value.trim() !== value
  ) {
    return failInput(`${path} must be an exact non-empty string.`);
  }
  return value;
};

const requireNullableString = (
  value: unknown,
  path: string,
): string | null => value === null ? null : requireString(value, path);

const requireBoolean = (value: unknown, path: string): boolean => {
  if (typeof value !== "boolean") {
    return failInput(`${path} must be a boolean.`);
  }
  return value;
};

const requireInteger = (
  value: unknown,
  path: string,
  minimum: number,
): number => {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    return failInput(
      `${path} must be an integer greater than or equal to ${minimum}.`,
    );
  }
  return value as number;
};

const requireStringArray = (
  value: unknown,
  path: string,
): readonly string[] => {
  const result = requireArray(value, path).map(
    (item, index) => requireString(item, `${path}[${index}]`),
  );
  if (new Set(result).size !== result.length) {
    return failInput(`${path} must not contain duplicate values.`);
  }
  return result;
};

const compareCodeUnits = (left: string, right: string): number => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

const sourceManifestRoster = (
  roster: readonly ShiftPlanningSourceRosterMember[],
): readonly Omit<ShiftPlanningSourceRosterMember, "phone">[] => roster.map(
  (member) => ({
    userId: member.userId,
    displayName: member.displayName,
    isActive: member.isActive,
    roles: [...member.roles].sort(compareCodeUnits),
    isCommonPurchaseManager: member.isCommonPurchaseManager,
  }),
).sort((left, right) => compareCodeUnits(left.userId, right.userId));

export const createShiftPlanningCommunicationSourceRosterDigest = (
  roster: readonly ShiftPlanningSourceRosterMember[],
): ShiftPlanningDigest => createShiftPlanningDigest(
  sourceManifestRoster(roster),
);

const requireCanonicalDigest = (
  value: unknown,
  path: string,
): ShiftPlanningDigest => {
  const digest = requireString(value, path);
  if (!/^shift-planning:v1:sha256:[0-9a-f]{64}$/.test(digest)) {
    return failInput(`${path} must be a canonical shift-planning digest.`);
  }
  return digest as ShiftPlanningDigest;
};

const requireNullableCanonicalDigest = (
  value: unknown,
  path: string,
): ShiftPlanningDigest | null => value === null ?
  null :
  requireCanonicalDigest(value, path);

const requireIsoInstant = (value: unknown, path: string): string => {
  const instant = requireString(value, path);
  if (
    !Number.isFinite(Date.parse(instant)) ||
    new Date(instant).toISOString() !== instant
  ) {
    return failInput(`${path} must be an exact ISO-8601 UTC instant.`);
  }
  return instant;
};

const requireDocumentSafeId = (value: unknown, path: string): string => {
  const identifier = requireString(value, path);
  if (identifier.includes("/") || identifier.length > 256) {
    return failInput(`${path} must be a document-safe identifier.`);
  }
  return identifier;
};

const parseSourceManifest = (
  value: unknown,
): ShiftPlanningCommunicationSourceManifest => {
  const source = requireExactRecord(
    value,
    [
      "schemaVersion",
      "captureId",
      "capturedAt",
      "revision",
      "provenance",
      "rosterDigest",
      "deliveryWeekdayDigest",
      "predecessorDigest",
      "manifestDigest",
    ],
    "sourceManifest",
  );
  if (
    source.schemaVersion !==
      SHIFT_PLANNING_COMMUNICATION_BASELINE_SCHEMA_VERSION
  ) {
    return failSourceManifest("Source manifest schema is not supported.");
  }
  const payload: ShiftPlanningCommunicationSourceManifestPayload = {
    schemaVersion: SHIFT_PLANNING_COMMUNICATION_BASELINE_SCHEMA_VERSION,
    captureId: requireDocumentSafeId(
      source.captureId,
      "sourceManifest.captureId",
    ),
    capturedAt: requireIsoInstant(
      source.capturedAt,
      "sourceManifest.capturedAt",
    ),
    revision: requireString(source.revision, "sourceManifest.revision"),
    provenance: requireString(
      source.provenance,
      "sourceManifest.provenance",
    ),
    rosterDigest: requireCanonicalDigest(
      source.rosterDigest,
      "sourceManifest.rosterDigest",
    ),
    deliveryWeekdayDigest: requireCanonicalDigest(
      source.deliveryWeekdayDigest,
      "sourceManifest.deliveryWeekdayDigest",
    ),
    predecessorDigest: requireCanonicalDigest(
      source.predecessorDigest,
      "sourceManifest.predecessorDigest",
    ),
  };
  const manifestDigest = requireCanonicalDigest(
    source.manifestDigest,
    "sourceManifest.manifestDigest",
  );
  if (
    manifestDigest !==
      createShiftPlanningCommunicationSourceManifestDigest(payload)
  ) {
    return failSourceManifest(
      "Source manifest digest does not match its payload.",
    );
  }
  return {...payload, manifestDigest};
};

const parseRoster = (
  value: unknown,
): readonly ShiftPlanningSourceRosterMember[] => {
  const userIds = new Set<string>();
  const members = requireArray(value, "roster").map((item, index) => {
    const path = `roster[${index}]`;
    const member = requireExactRecord(item, [
      "userId",
      "displayName",
      "phone",
      "isActive",
      "roles",
      "isCommonPurchaseManager",
    ], path);
    const userId = requireString(member.userId, `${path}.userId`);
    if (userId.includes("/") || userIds.has(userId)) {
      return failInput(`${path}.userId must be unique and document-safe.`);
    }
    userIds.add(userId);
    return {
      userId,
      displayName: requireNullableString(
        member.displayName,
        `${path}.displayName`,
      ),
      phone: requireNullableString(member.phone, `${path}.phone`),
      isActive: requireBoolean(member.isActive, `${path}.isActive`),
      roles: [...requireStringArray(
        member.roles,
        `${path}.roles`,
      )].sort(compareCodeUnits),
      isCommonPurchaseManager: requireBoolean(
        member.isCommonPurchaseManager,
        `${path}.isCommonPurchaseManager`,
      ),
    };
  });
  return members.sort((left, right) =>
    compareCodeUnits(left.userId, right.userId));
};

const parseApprovedMapping = (
  value: unknown,
  type: "delivery" | "market",
): ApprovedRotationMapping => {
  const path = `${type}.approvedMapping`;
  const mapping = requireExactRecord(value, [
    "revision",
    "digest",
    "provenance",
    "approvalStatus",
    "type",
    "orderedUserIds",
    "roundNumber",
    "nextMemberIndex",
    "stableTieOrder",
    "evidence",
  ], path);
  if (mapping.approvalStatus !== "approved" || mapping.type !== type) {
    return failInput(`${path} must be an approved mapping for ${type}.`);
  }
  const payload: ShiftPlanningApprovedMappingDigestPayload = {
    revision: requireString(mapping.revision, `${path}.revision`),
    provenance: requireString(mapping.provenance, `${path}.provenance`),
    approvalStatus: "approved",
    type,
    orderedUserIds: requireStringArray(
      mapping.orderedUserIds,
      `${path}.orderedUserIds`,
    ),
    roundNumber: requireInteger(mapping.roundNumber, `${path}.roundNumber`, 1),
    nextMemberIndex: requireInteger(
      mapping.nextMemberIndex,
      `${path}.nextMemberIndex`,
      0,
    ),
    stableTieOrder: requireStringArray(
      mapping.stableTieOrder,
      `${path}.stableTieOrder`,
    ),
    evidence: requireString(mapping.evidence, `${path}.evidence`),
  };
  const digest = requireCanonicalDigest(mapping.digest, `${path}.digest`);
  if (digest !== createShiftPlanningApprovedMappingDigest(payload)) {
    return failMappingDigest(`${path}.digest does not bind its exact mapping.`);
  }
  return {...payload, digest};
};

const parseLegacyHelper = (
  value: unknown,
): ShiftPlanningUniqueLegacyDeliveryHelperEvidence => {
  const path = "delivery.legacyHelper";
  const helper = requireExactRecord(
    value,
    ["kind", "userId", "evidenceRevision", "evidenceDigest"],
    path,
  );
  if (helper.kind !== "unique") {
    return failInput(`${path}.kind must be unique.`);
  }
  return {
    kind: "unique",
    userId: requireString(helper.userId, `${path}.userId`),
    evidenceRevision: requireString(
      helper.evidenceRevision,
      `${path}.evidenceRevision`,
    ),
    evidenceDigest: requireString(
      helper.evidenceDigest,
      `${path}.evidenceDigest`,
    ),
  };
};

const parseCompletion = (
  value: unknown,
): DeliveryPlannerPredecessor["completion"] => {
  const base = requireExactRecordForCompletion(value);
  const assignmentRevision = requireInteger(
    base.assignmentRevision,
    "delivery.predecessor.completion.assignmentRevision",
    0,
  );
  const completionRevision = requireInteger(
    base.completionRevision,
    "delivery.predecessor.completion.completionRevision",
    0,
  );
  if (base.state === "uncompleted") {
    return {
      state: "uncompleted",
      assignmentRevision,
      completionRevision,
      plannedHelperUserId: requireNullableString(
        base.plannedHelperUserId,
        "delivery.predecessor.completion.plannedHelperUserId",
      ),
    };
  }
  if (base.state !== "completed") {
    return failInput("delivery.predecessor.completion.state is not supported.");
  }
  return {
    state: "completed",
    assignmentRevision,
    completionRevision,
    actualHelperUserId: requireString(
      base.actualHelperUserId,
      "delivery.predecessor.completion.actualHelperUserId",
    ),
    helperSourceAssignmentRevision: requireInteger(
      base.helperSourceAssignmentRevision,
      "delivery.predecessor.completion.helperSourceAssignmentRevision",
      0,
    ),
    completedAtMillis: requireInteger(
      base.completedAtMillis,
      "delivery.predecessor.completion.completedAtMillis",
      0,
    ),
  };
};

const requireExactRecordForCompletion = (
  value: unknown,
): Record<string, unknown> => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return failInput("delivery.predecessor.completion must be a plain object.");
  }
  const state = (value as Record<string, unknown>).state;
  const keys = state === "uncompleted" ? [
    "state",
    "assignmentRevision",
    "completionRevision",
    "plannedHelperUserId",
  ] : [
    "state",
    "assignmentRevision",
    "completionRevision",
    "actualHelperUserId",
    "helperSourceAssignmentRevision",
    "completedAtMillis",
  ];
  return requireExactRecord(
    value,
    keys,
    "delivery.predecessor.completion",
  );
};

const parsePredecessor = (value: unknown): DeliveryPlannerPredecessor => {
  const path = "delivery.predecessor";
  const predecessor = requireExactRecord(value, [
    "shiftId",
    "scheduledDate",
    "effectiveLeadUserId",
    "completion",
  ], path);
  return {
    shiftId: requireString(predecessor.shiftId, `${path}.shiftId`),
    scheduledDate: requireString(
      predecessor.scheduledDate,
      `${path}.scheduledDate`,
    ),
    effectiveLeadUserId: requireString(
      predecessor.effectiveLeadUserId,
      `${path}.effectiveLeadUserId`,
    ),
    completion: parseCompletion(predecessor.completion),
  };
};

const parseDelivery = (
  value: unknown,
): ShiftPlanningCommunicationProposalInput["delivery"] => {
  const delivery = requireExactRecord(value, [
    "planningRequestId",
    "deliveryWeekday",
    "approvedMapping",
    "predecessor",
    "legacyHelper",
  ], "delivery");
  const deliveryWeekday = requireString(
    delivery.deliveryWeekday,
    "delivery.deliveryWeekday",
  );
  if (![
    "MON",
    "TUE",
    "WED",
    "THU",
    "FRI",
    "SAT",
    "SUN",
  ].includes(deliveryWeekday)) {
    return failInput("delivery.deliveryWeekday is not supported.");
  }
  return {
    planningRequestId: requireString(
      delivery.planningRequestId,
      "delivery.planningRequestId",
    ),
    deliveryWeekday: deliveryWeekday as BusinessWeekday,
    approvedMapping: parseApprovedMapping(
      delivery.approvedMapping,
      "delivery",
    ),
    predecessor: parsePredecessor(delivery.predecessor),
    legacyHelper: parseLegacyHelper(delivery.legacyHelper),
  };
};

const parseMarket = (
  value: unknown,
): ShiftPlanningCommunicationProposalInput["market"] => {
  const market = requireExactRecord(
    value,
    ["planningRequestId", "approvedMapping"],
    "market",
  );
  return {
    planningRequestId: requireString(
      market.planningRequestId,
      "market.planningRequestId",
    ),
    approvedMapping: parseApprovedMapping(
      market.approvedMapping,
      "market",
    ),
  };
};

const parseInput = (
  value: unknown,
): ShiftPlanningCommunicationProposalInput => {
  const input = requireExactRecord(value, [
    "schemaVersion",
    "proposalId",
    "environment",
    "targetSeasonStartYear",
    "sourceManifest",
    "roster",
    "delivery",
    "market",
  ], "input");
  if (
    input.schemaVersion !==
      SHIFT_PLANNING_COMMUNICATION_BASELINE_SCHEMA_VERSION ||
    input.environment !== "production"
  ) {
    return failInput("Input schema version or environment is not supported.");
  }
  const roster = parseRoster(input.roster);
  const delivery = parseDelivery(input.delivery);
  const market = parseMarket(input.market);
  const sourceManifest = parseSourceManifest(input.sourceManifest);
  if (
    sourceManifest.rosterDigest !==
      createShiftPlanningCommunicationSourceRosterDigest(roster)
  ) {
    return failSourceMismatch(
      "Source manifest roster digest does not match the captured roster.",
    );
  }
  if (
    sourceManifest.deliveryWeekdayDigest !== createShiftPlanningDigest({
      deliveryWeekday: delivery.deliveryWeekday,
    })
  ) {
    return failSourceMismatch(
      "Source manifest delivery weekday digest does not match capture data.",
    );
  }
  if (
    sourceManifest.predecessorDigest !==
      createShiftPlanningDigest(delivery.predecessor)
  ) {
    return failSourceMismatch(
      "Source manifest predecessor digest does not match capture data.",
    );
  }
  return {
    schemaVersion: SHIFT_PLANNING_COMMUNICATION_BASELINE_SCHEMA_VERSION,
    proposalId: requireDocumentSafeId(input.proposalId, "proposalId"),
    environment: "production",
    targetSeasonStartYear: requireInteger(
      input.targetSeasonStartYear,
      "targetSeasonStartYear",
      2000,
    ),
    sourceManifest,
    roster: roster.map((member) => ({...member, phone: null})),
    delivery,
    market,
  };
};

type ResolvedEligibleRosterMember =
  Omit<ShiftPlanningSourceRosterMember, "displayName"> & {
    displayName: string;
  };

const resolvedEligibleRoster = (
  roster: readonly ShiftPlanningSourceRosterMember[],
): readonly ResolvedEligibleRosterMember[] => {
  const labels = new Set<string>();
  return roster.filter(isEligibleForShiftRotation).map((member) => {
    if (!member.displayName) {
      return failRoster(
        `Eligible member ${member.userId} has no display name.`,
      );
    }
    const label = member.displayName
      .normalize("NFKC")
      .toLocaleLowerCase("es-ES");
    if (labels.has(label)) {
      return failRoster("Eligible members have an ambiguous display name.");
    }
    labels.add(label);
    return {...member, displayName: member.displayName};
  });
};

const eligibilityRoster = (
  roster: readonly ShiftPlanningSourceRosterMember[],
): readonly ShiftPlanningEligibilityRosterMember[] => roster.map((member) => ({
  userId: member.userId,
  isActive: member.isActive,
  roles: member.roles,
  isCommonPurchaseManager: member.isCommonPurchaseManager,
}));

const resolverEntries = (
  roster: readonly ResolvedEligibleRosterMember[],
): readonly ShiftPlanningResolverEntry[] => roster.map((member) => ({
  userId: member.userId,
  displayName: member.displayName,
}));

const requireCanonicalData = (value: unknown): void => {
  try {
    createShiftPlanningDigest(value);
  } catch {
    failInput("Input must be exact canonical JSON data.");
  }
};

const deepFreeze = <Value>(value: Value): Value => {
  if (
    typeof value !== "object" ||
    value === null ||
    Object.isFrozen(value)
  ) {
    return value;
  }
  Object.getOwnPropertyNames(value).forEach((key) => {
    const child = (value as Record<string, unknown>)[key];
    deepFreeze(child);
  });
  return Object.freeze(value);
};

const buildProposal = (value: unknown): {
  input: ShiftPlanningCommunicationProposalInput;
  proposal: ShiftPlanningCommunicationProposal;
} => {
  requireCanonicalData(value);
  const input = parseInput(value);
  const inputDigest = createShiftPlanningDigest(input);
  const eligibleRoster = resolvedEligibleRoster(input.roster);
  const eligibleUserIds = eligibleRoster.map((member) => member.userId);
  const resolvedNames = resolverEntries(eligibleRoster);
  const planningRoster = eligibilityRoster(input.roster);
  const deliveryBootstrap = resolveShiftRotationBootstrap({
    type: "delivery",
    eligibleUserIds,
    approvedMapping: input.delivery.approvedMapping,
    isTrulyNewRotation: false,
    legacyDeliveryHelper: input.delivery.legacyHelper,
  });
  const marketBootstrap = resolveShiftRotationBootstrap({
    type: "market",
    eligibleUserIds,
    approvedMapping: input.market.approvedMapping,
    isTrulyNewRotation: false,
  });
  const deliveryPlan = planDeliveryShifts({
    planningRequestId: input.delivery.planningRequestId,
    targetSeasonStartYear: input.targetSeasonStartYear,
    deliveryWeekday: input.delivery.deliveryWeekday,
    rotation: deliveryBootstrap.rotation,
    continuity: {
      kind: "legacyBootstrap",
      predecessor: input.delivery.predecessor,
      helperEvidence: input.delivery.legacyHelper,
    },
  });
  const marketPlan = planMarketShifts({
    planningRequestId: input.market.planningRequestId,
    targetSeasonStartYear: input.targetSeasonStartYear,
    rotation: marketBootstrap.rotation,
  });
  const assignmentDigest = createShiftPlanningDigest({
    schemaVersion: SHIFT_PLANNING_COMMUNICATION_BASELINE_SCHEMA_VERSION,
    environment: input.environment,
    targetSeasonStartYear: input.targetSeasonStartYear,
    eligibilityRoster: planningRoster,
    delivery: {
      planningRequestId: input.delivery.planningRequestId,
      deliveryWeekday: input.delivery.deliveryWeekday,
      approvedMapping: input.delivery.approvedMapping,
      predecessor: input.delivery.predecessor,
      legacyHelper: input.delivery.legacyHelper,
      bootstrap: deliveryBootstrap,
      plan: deliveryPlan,
    },
    market: {
      planningRequestId: input.market.planningRequestId,
      approvedMapping: input.market.approvedMapping,
      bootstrap: marketBootstrap,
      plan: marketPlan,
    },
  });
  const resolverDigest = createShiftPlanningDigest({
    schemaVersion: SHIFT_PLANNING_COMMUNICATION_BASELINE_SCHEMA_VERSION,
    entries: resolvedNames,
  });
  const planningDigest = createShiftPlanningDigest({
    schemaVersion: SHIFT_PLANNING_COMMUNICATION_BASELINE_SCHEMA_VERSION,
    sourceManifestDigest: input.sourceManifest.manifestDigest,
    assignmentDigest,
    resolverDigest,
  });
  const artifact: ShiftPlanningCommunicationProposalArtifact = {
    schemaVersion: SHIFT_PLANNING_COMMUNICATION_BASELINE_SCHEMA_VERSION,
    status: "proposal",
    proposalId: input.proposalId,
    environment: input.environment,
    targetSeasonStartYear: input.targetSeasonStartYear,
    sourceManifest: input.sourceManifest,
    inputDigest,
    rosterDigest: createShiftPlanningCommunicationSourceRosterDigest(
      input.roster,
    ),
    eligibilityRoster: planningRoster,
    eligibilityRosterDigest: createShiftPlanningDigest(planningRoster),
    resolverEntries: resolvedNames,
    resolverDigest,
    assignmentDigest,
    planningDigest,
    delivery: {
      approvedMapping: input.delivery.approvedMapping,
      approvedMappingDigest:
        input.delivery.approvedMapping.digest as ShiftPlanningDigest,
      predecessor: input.delivery.predecessor,
      legacyHelper: input.delivery.legacyHelper,
      continuityDigest: createShiftPlanningDigest({
        predecessor: input.delivery.predecessor,
        legacyHelper: input.delivery.legacyHelper,
      }),
      bootstrap: deliveryBootstrap,
      bootstrapDigest: createShiftPlanningDigest(deliveryBootstrap),
      plan: deliveryPlan,
      planDigest: createShiftPlanningDigest(deliveryPlan),
    },
    market: {
      approvedMapping: input.market.approvedMapping,
      approvedMappingDigest:
        input.market.approvedMapping.digest as ShiftPlanningDigest,
      bootstrap: marketBootstrap,
      bootstrapDigest: createShiftPlanningDigest(marketBootstrap),
      plan: marketPlan,
      planDigest: createShiftPlanningDigest(marketPlan),
    },
  };
  return {
    input,
    proposal: {
      ...artifact,
      proposalDigest: createShiftPlanningDigest(artifact),
    },
  };
};

/**
 * Builds a private zero-write proposal. It is not an audience artifact and
 * cannot be rendered until a separate globally approved seal is validated.
 * @param {unknown} value Exact private proposal input.
 * @return {ShiftPlanningCommunicationProposal} Frozen private proposal.
 */
export const proposeShiftPlanningCommunicationBaseline = (
  value: unknown,
): ShiftPlanningCommunicationProposal => deepFreeze(
  buildProposal(value).proposal,
);

export const planShiftPlanningCommunicationBaseline =
  proposeShiftPlanningCommunicationBaseline;

const parseZeroWriteAttestation = (
  value: unknown,
): ShiftPlanningZeroWriteAttestation => {
  const path = "approval.zeroWriteAttestation";
  const attestation = requireExactRecord(value, [
    "kind",
    "attestedAt",
    "firestoreWriteCount",
    "workbookWriteCount",
    "notificationDispatchCount",
    "evidence",
  ], path);
  if (
    attestation.kind !== "zeroWrite" ||
    attestation.firestoreWriteCount !== 0 ||
    attestation.workbookWriteCount !== 0 ||
    attestation.notificationDispatchCount !== 0
  ) {
    return failZeroWrite("Zero-write attestation contains a non-zero effect.");
  }
  return {
    kind: "zeroWrite",
    attestedAt: requireIsoInstant(
      attestation.attestedAt,
      `${path}.attestedAt`,
    ),
    firestoreWriteCount: 0,
    workbookWriteCount: 0,
    notificationDispatchCount: 0,
    evidence: requireString(attestation.evidence, `${path}.evidence`),
  };
};

const parseGlobalApproval = (
  value: unknown,
  proposal: ShiftPlanningCommunicationProposal,
): ShiftPlanningCommunicationGlobalApproval => {
  const approval = requireExactRecord(value, [
    "approvalStatus",
    "scope",
    "approvedBy",
    "approvedAt",
    "evidence",
    "proposalDigest",
    "planningDigest",
    "validUntil",
    "supersedesPlanningDigest",
    "zeroWriteAttestation",
  ], "approval");
  if (
    approval.approvalStatus !== "approved" ||
    approval.scope !== "global"
  ) {
    return failApproval("Approval must explicitly cover the global proposal.");
  }
  const proposalDigest = requireCanonicalDigest(
    approval.proposalDigest,
    "approval.proposalDigest",
  );
  const planningDigest = requireCanonicalDigest(
    approval.planningDigest,
    "approval.planningDigest",
  );
  if (
    proposalDigest !== proposal.proposalDigest ||
    planningDigest !== proposal.planningDigest
  ) {
    return failApproval(
      "Approval digests do not match the recomputed proposal.",
    );
  }
  const approvedAt = requireIsoInstant(
    approval.approvedAt,
    "approval.approvedAt",
  );
  const validUntil = requireIsoInstant(
    approval.validUntil,
    "approval.validUntil",
  );
  const supersedesPlanningDigest = requireNullableCanonicalDigest(
    approval.supersedesPlanningDigest,
    "approval.supersedesPlanningDigest",
  );
  const zeroWriteAttestation = parseZeroWriteAttestation(
    approval.zeroWriteAttestation,
  );
  const capturedMillis = Date.parse(proposal.sourceManifest.capturedAt);
  const attestedMillis = Date.parse(zeroWriteAttestation.attestedAt);
  const approvedMillis = Date.parse(approvedAt);
  const validUntilMillis = Date.parse(validUntil);
  if (
    attestedMillis < capturedMillis ||
    approvedMillis < attestedMillis ||
    validUntilMillis <= approvedMillis ||
    validUntilMillis - approvedMillis >
      SHIFT_PLANNING_COMMUNICATION_APPROVAL_MAX_VALIDITY_MS
  ) {
    return failApproval(
      "Approval chronology or validity is inconsistent with its evidence.",
    );
  }
  if (supersedesPlanningDigest === proposal.planningDigest) {
    return failApproval(
      "Approval cannot supersede its own planning digest.",
    );
  }
  return {
    approvalStatus: "approved",
    scope: "global",
    approvedBy: requireString(approval.approvedBy, "approval.approvedBy"),
    approvedAt,
    evidence: requireString(approval.evidence, "approval.evidence"),
    proposalDigest,
    planningDigest,
    validUntil,
    supersedesPlanningDigest,
    zeroWriteAttestation,
  };
};

type ShiftPlanningSealLifecycle = Pick<
  ShiftPlanningCommunicationSealArtifact,
  "sealedAt" | "validUntil" | "supersedesPlanningDigest"
>;

const parseSealLifecycle = (
  record: Record<string, unknown>,
  approval: ShiftPlanningCommunicationGlobalApproval,
  path: string,
): ShiftPlanningSealLifecycle => {
  const sealedAt = requireIsoInstant(record.sealedAt, `${path}.sealedAt`);
  if (
    Date.parse(sealedAt) <= Date.parse(approval.approvedAt) ||
    Date.parse(approval.validUntil) <= Date.parse(sealedAt)
  ) {
    return failSeal(
      "Seal validity must start after approval and end after sealing.",
    );
  }
  return {
    sealedAt,
    validUntil: approval.validUntil,
    supersedesPlanningDigest: approval.supersedesPlanningDigest,
  };
};

/**
 * Recomputes a proposal and seals it only when one explicit global approval
 * binds both proposal and planning digests with zero-write evidence.
 * @param {unknown} value Exact seal request containing the original input.
 * @return {ShiftPlanningCommunicationSeal} Frozen validated seal.
 */
export const sealShiftPlanningCommunicationProposal = (
  value: unknown,
): ShiftPlanningCommunicationSeal => {
  requireCanonicalData(value);
  const request = requireExactRecord(value, [
    "schemaVersion",
    "sealId",
    "sealedAt",
    "proposalInput",
    "approval",
  ], "sealRequest");
  if (
    request.schemaVersion !==
      SHIFT_PLANNING_COMMUNICATION_BASELINE_SCHEMA_VERSION
  ) {
    return failInput("Seal request schema version is not supported.");
  }
  const built = buildProposal(request.proposalInput);
  const approval = parseGlobalApproval(request.approval, built.proposal);
  const lifecycle = parseSealLifecycle(
    request,
    approval,
    "sealRequest",
  );
  const artifact: ShiftPlanningCommunicationSealArtifact = {
    schemaVersion: SHIFT_PLANNING_COMMUNICATION_BASELINE_SCHEMA_VERSION,
    status: "sealed",
    sealId: requireDocumentSafeId(request.sealId, "sealId"),
    ...lifecycle,
    proposalInput: built.input,
    proposal: built.proposal,
    approval,
  };
  return deepFreeze({
    ...artifact,
    sealDigest: createShiftPlanningDigest(artifact),
  });
};

const revalidateSeal = (value: unknown): ShiftPlanningCommunicationSeal => {
  try {
    requireCanonicalData(value);
    const record = requireExactRecord(value, [
      "schemaVersion",
      "status",
      "sealId",
      "sealedAt",
      "validUntil",
      "supersedesPlanningDigest",
      "proposalInput",
      "proposal",
      "approval",
      "sealDigest",
    ], "seal");
    if (
      record.schemaVersion !==
        SHIFT_PLANNING_COMMUNICATION_BASELINE_SCHEMA_VERSION ||
      record.status !== "sealed"
    ) {
      return failSeal("Seal status or schema version is invalid.");
    }
    const built = buildProposal(record.proposalInput);
    if (
      createShiftPlanningDigest(record.proposal) !==
        createShiftPlanningDigest(built.proposal)
    ) {
      return failSeal("Stored proposal does not match recomputed planning.");
    }
    const approval = parseGlobalApproval(record.approval, built.proposal);
    const lifecycle = parseSealLifecycle(
      record,
      approval,
      "seal",
    );
    if (
      record.validUntil !== lifecycle.validUntil ||
      record.supersedesPlanningDigest !==
        lifecycle.supersedesPlanningDigest
    ) {
      return failSeal("Seal lifecycle is not bound to its global approval.");
    }
    const artifact: ShiftPlanningCommunicationSealArtifact = {
      schemaVersion: SHIFT_PLANNING_COMMUNICATION_BASELINE_SCHEMA_VERSION,
      status: "sealed",
      sealId: requireDocumentSafeId(record.sealId, "sealId"),
      ...lifecycle,
      proposalInput: built.input,
      proposal: built.proposal,
      approval,
    };
    const sealDigest = requireCanonicalDigest(
      record.sealDigest,
      "seal.sealDigest",
    );
    if (sealDigest !== createShiftPlanningDigest(artifact)) {
      return failSeal("Seal digest does not match its recomputed artifact.");
    }
    return deepFreeze({...artifact, sealDigest});
  } catch (error) {
    if (
      error instanceof ShiftPlanningCommunicationBaselineError &&
      error.code === "invalid_shift_communication_seal"
    ) {
      throw error;
    }
    return failSeal("Seal failed complete proposal and approval revalidation.");
  }
};

const resolvedDisplayName = (
  namesByUserId: ReadonlyMap<string, string>,
  userId: string,
): string => {
  const displayName = namesByUserId.get(userId);
  if (!displayName) {
    return failSeal(
      "A sealed assignment has no approved display-name resolver.",
    );
  }
  return displayName;
};

const audienceDeliveryRows = (
  shifts: readonly PlannedDeliveryShift[],
  namesByUserId: ReadonlyMap<string, string>,
): readonly ShiftPlanningAudienceDeliveryRow[] => shifts.map((shift) => ({
  date: shift.date,
  projectionSeasonStartYear: shift.projectionSeasonStartYear,
  roundNumber: shift.roundNumber,
  ownerDisplayName: resolvedDisplayName(
    namesByUserId,
    shift.rotationOwnerUserId,
  ),
}));

const audienceMarketRows = (
  shifts: readonly PlannedMarketShift[],
  namesByUserId: ReadonlyMap<string, string>,
): readonly ShiftPlanningAudienceMarketRow[] => shifts.map((shift) => ({
  date: shift.date,
  projectionSeasonStartYear: shift.projectionSeasonStartYear,
  ownerDisplayNames: shift.rotationOwnerUserIds.map(
    (userId) => resolvedDisplayName(namesByUserId, userId),
  ) as ShiftPlanningAudienceMarketRow["ownerDisplayNames"],
}));

/**
 * Revalidates a complete seal immediately before rendering the only
 * audience-safe output and rejects it outside its approved validity window.
 * The returned schedule has human-facing shift facts only: no lifecycle
 * metadata, ids, digests, or phones.
 * @param {unknown} value Exact private seal render request.
 * @return {ShiftPlanningAudienceSchedule} Frozen audience-safe schedule.
 */
export const renderShiftPlanningAudienceSchedule = (
  value: unknown,
): ShiftPlanningAudienceSchedule => {
  let seal: ShiftPlanningCommunicationSeal;
  try {
    requireCanonicalData(value);
    const request = requireExactRecord(value, [
      "schemaVersion",
      "seal",
    ], "audienceRenderInput");
    if (
      request.schemaVersion !==
        SHIFT_PLANNING_COMMUNICATION_BASELINE_SCHEMA_VERSION
    ) {
      return failSeal("Audience render schema version is not supported.");
    }
    seal = revalidateSeal(request.seal);
    const nowMillis = Date.now();
    if (
      nowMillis < Date.parse(seal.sealedAt) ||
      nowMillis >= Date.parse(seal.validUntil)
    ) {
      return failSeal("Seal is outside its approved validity window.");
    }
  } catch (error) {
    if (
      error instanceof ShiftPlanningCommunicationBaselineError &&
      error.code === "invalid_shift_communication_seal"
    ) {
      throw error;
    }
    return failSeal("Audience render input failed complete revalidation.");
  }
  const proposal = seal.proposal;
  const namesByUserId = new Map(
    proposal.resolverEntries.map(
      (entry) => [entry.userId, entry.displayName] as const,
    ),
  );
  return deepFreeze({
    deliveryRows: audienceDeliveryRows(
      proposal.delivery.plan.shifts,
      namesByUserId,
    ),
    marketRows: audienceMarketRows(
      proposal.market.plan.shifts,
      namesByUserId,
    ),
  });
};
