import {
  DeliveryPlan,
  DeliveryPlanningContinuity,
  planDeliveryShifts,
} from "./delivery-shift-planner.js";
import {
  MarketPlan,
  planMarketShifts,
} from "./market-shift-planner.js";
import {
  BusinessWeekday,
  buildDeliverySeasonDates,
} from "./shift-planning-calendar.js";
import {
  RotationProjectionPrefix,
  ShiftPlanningError,
  ShiftRotationCursor,
  ShiftRotationType,
} from "./shift-planning-contract.js";
import {
  SHIFT_PLANNING_DIGEST_PREFIX,
  ShiftPlanningCanonicalJsonObject,
  ShiftPlanningFairnessSnapshot,
  createShiftPlanningDigest,
  normalizeShiftPlanningFairnessSnapshot,
} from "./shift-planning-digest.js";
import {
  ShiftPlanningAuthoritativeState,
  parseShiftPlanningAuthoritativeState,
} from "./shift-planning-state-persistence.js";
import {
  ShiftPlanningCandidatePositionManifest,
  buildShiftPlanningCandidatePositionSet,
  parseShiftPlanningCandidatePositionManifest,
} from "./shift-planning-candidate.js";
import {isEligibleForShiftRotation} from "./shift-eligibility.js";
import {
  ShiftPlanningEnvironment,
  ShiftPlanningMode,
  ShiftPlanningReleaseLease,
  ShiftPlanningRequestV2,
  parseShiftPlanningRequestV2,
  parseShiftRotationAggregateWire,
} from "./shift-planning-wire.js";

export const SHIFT_PLANNING_BUNDLE_SCHEMA_VERSION = 2 as const;
export const SHIFT_PLANNING_FIRESTORE_TRANSACTION_WRITE_LIMIT = 500 as const;
export const SHIFT_PLANNING_FIRESTORE_TRANSACTION_BYTE_LIMIT =
  10 * 1024 * 1024;

export type ShiftPlanningProjectionOccupancy = {
  seasonStartYear: number;
  occupiedPositionCount: number;
  lineageRevision: string;
  lineageDigest: string;
};

export type ShiftPlanningStagedCandidate = {
  schemaVersion: typeof SHIFT_PLANNING_BUNDLE_SCHEMA_VERSION;
  status: "staged";
  candidateId: string;
  bundleId: string;
  bundleRevision: string;
  bundleDigest: string;
  environment: ShiftPlanningEnvironment;
  requestedByUserId: string;
  sourcePreviewRequestId: string;
  sourcePreviewReceiptDigest: string;
  sourceStageRequestId: string;
  expectedStateDigest: string;
  positionManifest: ShiftPlanningCandidatePositionManifest;
};

export type ShiftPlanningPreviewReceipt = {
  schemaVersion: typeof SHIFT_PLANNING_BUNDLE_SCHEMA_VERSION;
  status: "completed";
  mode: "preview";
  requestId: string;
  bundleId: string;
  bundleRevision: string;
  bundleDigest: string;
  environment: ShiftPlanningEnvironment;
  requestedByUserId: string;
  expectedStateDigest: string;
};

export type ShiftPlanningBundleInput = {
  request: unknown;
  authoritativeState: unknown;
  fairnessSnapshot: unknown;
  delivery: {
    inheritedTargetPrefix?: RotationProjectionPrefix | null;
    futureProjectionOccupancy?: readonly ShiftPlanningProjectionOccupancy[];
    continuity: DeliveryPlanningContinuity;
  };
  market: {
    inheritedTargetPrefix?: RotationProjectionPrefix | null;
    futureProjectionOccupancy?: readonly ShiftPlanningProjectionOccupancy[];
  };
  transactionWriteLimit?: number;
  persistedPreview?: unknown;
  stagedCandidate?: unknown;
};

export type ShiftPlanningTransactionBudget = {
  direction: "forward" | "inverse";
  writeLimit: number;
  publicShiftWrites: number;
  predecessorHelperWrites: number;
  rotationWrites: 2;
  activeStateWrites: 1;
  bundleMetadataWrites: 0;
  requestWrites: 1;
  stagedCandidateWrites: 0;
  syncCommandWrites: 2;
  operationRegistryWrites: 1;
  beforeImageWrites: number;
  heldIntentWrites: number;
  creditLedgerWrites: number;
  createWrites: number;
  updateWrites: number;
  deleteWrites: number;
  totalWrites: number;
  byteEstimate: {
    status: "requiresPersistenceAdapter";
    estimatedBytes: null;
    configuredByteLimit: typeof SHIFT_PLANNING_FIRESTORE_TRANSACTION_BYTE_LIMIT;
  };
};

export type ShiftPlanningExpectedState = {
  schemaVersion: typeof SHIFT_PLANNING_BUNDLE_SCHEMA_VERSION;
  authoritativeState: ShiftPlanningAuthoritativeState;
  transactionMeasurementAuthority: {
    adapterRevision: string;
    indexConfigurationDigest: string;
  };
};

export type ShiftPlanningFrontier = {
  seasonStartYear: number;
  stateRevision: number;
  cursorDigest: string;
};

export type ShiftPlanningFrontierTransition = {
  frontierBefore: ShiftPlanningFrontier;
  frontierAfter: ShiftPlanningFrontier;
};

export type ShiftPlanningWorkbookPartitionLease = {
  ownerOperationId: string;
  leaseEpoch: number;
  state: "claimed" | "releasing" | "degraded";
  acquiredAtMillis: number;
  deadlineAtMillis: number;
};

export type ShiftPlanningWorkbookPartition = {
  workbookId: string;
  workbookRevision: string;
  partitionKey: string;
  stateRevision: number;
  epoch: number;
  lease: ShiftPlanningWorkbookPartitionLease | null;
};

export type ShiftPlanningReleaseLeaseIntent = {
  action: "acquire";
  type: ShiftRotationType;
  state: "sealed";
  bundleId: string;
  bundleRevision: string;
  bundleDigest: string;
  leaseEpoch: number;
  ownerOperationId: string;
  expectedCurrentLease: null;
  deadlinePolicy: {
    kind: "durationFromServerAcquisition";
    durationMillis: number;
  };
};

export type ShiftPlanningActivationManifest = {
  expectedStateDigest: string;
  expectedAuthoritativeDigest: string;
  publicProjection: {
    deliveryShiftWrites: number;
    marketShiftWrites: number;
    predecessorHelperWrites: number;
  };
  rotations: {
    delivery: {
      stateRevisionBefore: number;
      stateRevisionAfter: number;
      frontierBefore: ShiftPlanningFrontier;
      frontierAfter: ShiftPlanningFrontier;
      cursorAfter: ShiftRotationCursor;
      cohortFrozenAfter: boolean;
      frozenCohortUserIdsAfter: readonly string[];
    };
    market: {
      stateRevisionBefore: number;
      stateRevisionAfter: number;
      frontierBefore: ShiftPlanningFrontier;
      frontierAfter: ShiftPlanningFrontier;
      cursorAfter: ShiftRotationCursor;
      cohortFrozenAfter: boolean;
      frozenCohortUserIdsAfter: readonly string[];
    };
  };
  activeState: {
    stateRevisionBefore: number;
    stateRevisionAfter: number;
    writeEpochBefore: number;
    writeEpochAfter: number;
    activeRevisionBefore: string | null;
  };
  syncCommandTemplates: readonly [
    {
      type: "delivery";
      idempotencyKeySuffix: "sheets:delivery";
      targetSeasonStartYear: number;
      affectedProjectionSeasonStartYears: readonly number[];
      workbookId: string;
      workbookRevision: string;
      partitionKey: string;
      expectedPartitionStateRevision: number;
      expectedPartitionEpoch: number;
      commandPartitionEpoch: number;
      expectedCurrentLease: null;
    },
    {
      type: "market";
      idempotencyKeySuffix: "sheets:market";
      targetSeasonStartYear: number;
      affectedProjectionSeasonStartYears: readonly number[];
      workbookId: string;
      workbookRevision: string;
      partitionKey: string;
      expectedPartitionStateRevision: number;
      expectedPartitionEpoch: number;
      commandPartitionEpoch: number;
      expectedCurrentLease: null;
    },
  ];
  heldRecipients: readonly RecipientManifest[];
  creditLedgerWriteCount: number;
  releaseLeaseIntents: readonly [
    Omit<
      ShiftPlanningReleaseLeaseIntent,
      "bundleRevision" | "bundleDigest"
    >,
    Omit<
      ShiftPlanningReleaseLeaseIntent,
      "bundleRevision" | "bundleDigest"
    >,
  ];
};

export type ShiftPlanningRecoveryManifest = {
  expectedStateDigest: string;
  expectedAuthoritativeDigest: string;
  requiresPersistedBeforeImages: true;
  recoveryWriteEpoch: {
    kind: "incrementCurrent";
    minimumExclusiveEpoch: number;
    neverReuseOrDecrement: true;
  };
  restoreActiveLineage: {
    revision: string | null;
    digest: string | null;
  };
  requiredActiveCas: {
    bundleRevision: "{bundleRevision}";
    bundleDigest: "{bundleDigest}";
    writeEpoch: number;
  };
  deleteCreatedDocuments: readonly {
    pathTemplate: string;
    expectedBundleRevision: "{bundleRevision}";
    expectedBundleDigest: "{bundleDigest}";
  }[];
  restoreBeforeImages: readonly {
    targetPath: string;
    beforeImagePathTemplate: string;
    captureContractDigest: string;
  }[];
  publicProjectionDeletes: {
    delivery: number;
    market: number;
  };
  predecessorHelperRestores: number;
  rotationRestores: 2;
  activeStateRestores: 1;
  bundleMetadataUpdates: 0;
  requestUpdates: 1;
  stagedCandidateUpdates: 0;
  syncCommandDeletes: 2;
  operationRegistryUpdates: 1;
  heldIntentDeletes: number;
  creditLedgerRestores: number;
  releaseLeaseActions: readonly [
    {action: "clear"; type: "delivery"; expectedState: "sealed"},
    {action: "clear"; type: "market"; expectedState: "sealed"},
  ];
};

export type ShiftPlanningSyncCommand = {
  commandId: string;
  idempotencyKey: string;
  state: "pending";
  type: ShiftRotationType;
  bundleRevision: string;
  bundleDigest: string;
  writeEpoch: number;
  workbookId: string;
  workbookRevision: string;
  partitionKey: string;
  expectedPartitionStateRevision: number;
  expectedPartitionEpoch: number;
  commandPartitionEpoch: number;
  expectedCurrentLease: null;
  leaseIntent: {
    ownerOperationId: string;
    leaseEpoch: number;
    state: "claimed";
    durationMillis: number;
  };
  expectedActiveRevision: string;
  expectedActiveDigest: string;
  targetSeasonStartYear: number;
  affectedProjectionSeasonStartYears: readonly number[];
};

export type ShiftPlanningHeldNotificationIntent = {
  intentId: string;
  idempotencyKey: string;
  state: "held";
  recipientUserId: string;
  shiftId: string;
  shiftType: ShiftRotationType;
  expectedAssignmentRevision: 1;
  expectedMembershipRevision: number;
  expectedEligibilityRevision: number;
  expectedDestinationRevision: number;
  canonicalEventType: "shift_assignment_updated";
  payloadPolicy: "genericReferenceOnly";
  bundleRevision: string;
  bundleDigest: string;
  writeEpoch: number;
};

export type ShiftPlanningBundleResult = {
  schemaVersion: typeof SHIFT_PLANNING_BUNDLE_SCHEMA_VERSION;
  requestId: string;
  mode: ShiftPlanningMode;
  bundleId: string;
  environment: ShiftPlanningEnvironment;
  bundleRevision: string;
  bundleDigest: string;
  expectedWriteEpoch: number;
  activationWriteEpoch: number;
  expectedActiveRevision: string | null;
  expectedState: ShiftPlanningExpectedState;
  frontiers: {
    delivery: ShiftPlanningFrontierTransition;
    market: ShiftPlanningFrontierTransition;
  };
  delivery: DeliveryPlan;
  market: MarketPlan;
  manifests: {
    forward: ShiftPlanningActivationManifest;
    inverse: ShiftPlanningRecoveryManifest;
  };
  budgets: {
    forward: ShiftPlanningTransactionBudget;
    inverse: ShiftPlanningTransactionBudget;
  };
  releaseLeaseIntents: readonly [
    ShiftPlanningReleaseLeaseIntent,
    ShiftPlanningReleaseLeaseIntent,
  ];
  syncCommands: readonly [
    ShiftPlanningSyncCommand,
    ShiftPlanningSyncCommand,
  ];
  heldNotificationIntents: readonly ShiftPlanningHeldNotificationIntent[];
  transactionRequirements: {
    writeLimit: number;
    byteLimit: typeof SHIFT_PLANNING_FIRESTORE_TRANSACTION_BYTE_LIMIT;
    forwardManifestDigest: string;
    inverseManifestDigest: string;
  };
  stagedCandidate: ShiftPlanningStagedCandidate | null;
  stagedCandidateDigest: string | null;
  previewReceipt: ShiftPlanningPreviewReceipt | null;
  previewReceiptDigest: string | null;
};

type BundleRosterMember = {
  userId: string;
  roles: readonly string[];
  isActive: boolean;
  isCommonPurchaseManager: boolean;
  membershipRevision: number;
  eligibilityRevision: number;
  destinationRevision: number;
};

type BundleRotationSnapshot = {
  stateRevision: number;
  cursor: ShiftRotationCursor;
  planningFrontierSeasonStartYear: number;
  cohortFrozen: boolean;
  frozenCohortUserIds: readonly string[];
  activeRevision: string | null;
  activeDigest: string | null;
  migrationBaseline: {
    revision: string;
    digest: string;
  } | null;
  releaseLease: ShiftPlanningReleaseLease | null;
  normalized: ShiftPlanningCanonicalJsonObject;
};

type BundleFairnessSnapshot = {
  normalized: ShiftPlanningFairnessSnapshot;
  authoritativeState: ShiftPlanningAuthoritativeState;
  environment: ShiftPlanningEnvironment;
  activeRevision: string | null;
  activeDigest: string | null;
  roster: readonly BundleRosterMember[];
  eligibleUserIds: readonly string[];
  delivery: BundleRotationSnapshot;
  market: BundleRotationSnapshot;
  deliveryWeekday: BusinessWeekday;
  creditLedgerWriteCount: number;
  releaseLeaseDurationMillis: number;
  syncLeaseDurationMillis: number;
  workbookPartitions: {
    delivery: ShiftPlanningWorkbookPartition;
    market: ShiftPlanningWorkbookPartition;
  };
  transactionMeasurementAuthority: {
    adapterRevision: string;
    indexConfigurationDigest: string;
  };
};

export type RecipientManifest = {
  recipientUserId: string;
  shiftId: string;
  shiftType: ShiftRotationType;
  expectedAssignmentRevision: 1;
  expectedMembershipRevision: number;
  expectedEligibilityRevision: number;
  expectedDestinationRevision: number;
};

const businessWeekdays = new Set<BusinessWeekday>([
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
]);

const failState = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_state", message);
};

const requireRecord = (
  value: unknown,
  field: string,
): ShiftPlanningCanonicalJsonObject => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    (
      Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null
    )
  ) {
    return failState(`${field} must be a planning-state object.`);
  }
  return value as ShiftPlanningCanonicalJsonObject;
};

const requireDocumentIdentifier = (
  value: unknown,
  field: string,
): string => {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value !== value.trim() ||
    value.length > 256 ||
    value.includes("/")
  ) {
    return failState(`${field} must be a document-safe identifier.`);
  }
  return value;
};

const requireNullableRevision = (
  value: unknown,
  field: string,
): string | null => value === null ?
  null : requireDocumentIdentifier(value, field);

const requireNullableDigest = (
  value: unknown,
  field: string,
): string | null => {
  if (value === null) return null;
  if (
    typeof value !== "string" ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return failState(`${field} must be a versioned planning digest.`);
  }
  return value;
};

const requireNonNegativeInteger = (
  value: unknown,
  field: string,
): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return failState(`${field} must be a non-negative safe integer.`);
  }
  return value as number;
};

const requireSeasonStartYear = (
  value: unknown,
  field: string,
): number => {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < 2000 ||
    (value as number) > 9998
  ) {
    return failState(`${field} is outside the supported season range.`);
  }
  return value as number;
};

const sameValueSet = (
  left: readonly string[],
  right: readonly string[],
): boolean => left.length === right.length &&
  left.every((value) => right.includes(value));

const parseMigrationBaseline = (
  value: unknown,
  field: string,
): {revision: string; digest: string} | null => {
  if (value === null) return null;
  const baseline = requireRecord(value, field);
  if (
    Object.keys(baseline).length !== 2 ||
    !("revision" in baseline) ||
    !("digest" in baseline)
  ) {
    return failState(`${field} must be one exact revision/digest lineage.`);
  }
  return {
    revision: requireDocumentIdentifier(
      baseline.revision,
      `${field}.revision`,
    ),
    digest: requireNullableDigest(baseline.digest, `${field}.digest`) ||
      failState(`${field}.digest must not be null.`),
  };
};

const sameMigrationBaseline = (
  left: {revision: string; digest: string} | null,
  right: {revision: string; digest: string} | null,
): boolean => left === null || right === null ? left === right :
  left.revision === right.revision && left.digest === right.digest;

const parseWorkbookPartitionLease = (
  value: unknown,
  field: string,
): ShiftPlanningWorkbookPartitionLease | null => {
  if (value === null) return null;
  const lease = requireRecord(value, field);
  const acquiredAtMillis = requireNonNegativeInteger(
    lease.acquiredAtMillis,
    `${field}.acquiredAtMillis`,
  );
  const deadlineAtMillis = requireNonNegativeInteger(
    lease.deadlineAtMillis,
    `${field}.deadlineAtMillis`,
  );
  if (
    lease.state !== "claimed" &&
    lease.state !== "releasing" &&
    lease.state !== "degraded"
  ) {
    return failState(`${field}.state is invalid.`);
  }
  if (deadlineAtMillis < acquiredAtMillis) {
    return failState(`${field} deadline precedes acquisition.`);
  }
  return {
    ownerOperationId: requireDocumentIdentifier(
      lease.ownerOperationId,
      `${field}.ownerOperationId`,
    ),
    leaseEpoch: requireNonNegativeInteger(
      lease.leaseEpoch,
      `${field}.leaseEpoch`,
    ),
    state: lease.state,
    acquiredAtMillis,
    deadlineAtMillis,
  };
};

const parseWorkbookPartition = (
  value: unknown,
  type: ShiftRotationType,
): ShiftPlanningWorkbookPartition => {
  const field = `sync.partitions.${type}`;
  const partition = requireRecord(value, field);
  return {
    workbookId: requireDocumentIdentifier(
      partition.workbookId,
      `${field}.workbookId`,
    ),
    workbookRevision: requireDocumentIdentifier(
      partition.workbookRevision,
      `${field}.workbookRevision`,
    ),
    partitionKey: requireDocumentIdentifier(
      partition.partitionKey,
      `${field}.partitionKey`,
    ),
    stateRevision: requireNonNegativeInteger(
      partition.stateRevision,
      `${field}.stateRevision`,
    ),
    epoch: requireNonNegativeInteger(partition.epoch, `${field}.epoch`),
    lease: parseWorkbookPartitionLease(partition.lease, `${field}.lease`),
  };
};

const parseRosterMember = (
  value: unknown,
  index: number,
): BundleRosterMember => {
  const member = requireRecord(value, `roster[${index}]`);
  if (
    !Array.isArray(member.roles) ||
    member.roles.some((role) => typeof role !== "string" || !role.trim()) ||
    typeof member.isActive !== "boolean" ||
    typeof member.isCommonPurchaseManager !== "boolean"
  ) {
    return failState(`roster[${index}] has invalid eligibility fields.`);
  }
  return {
    userId: requireDocumentIdentifier(
      member.userId,
      `roster[${index}].userId`,
    ),
    roles: member.roles as readonly string[],
    isActive: member.isActive,
    isCommonPurchaseManager: member.isCommonPurchaseManager,
    membershipRevision: requireNonNegativeInteger(
      member.membershipRevision,
      `roster[${index}].membershipRevision`,
    ),
    eligibilityRevision: requireNonNegativeInteger(
      member.eligibilityRevision,
      `roster[${index}].eligibilityRevision`,
    ),
    destinationRevision: requireNonNegativeInteger(
      member.destinationRevision,
      `roster[${index}].destinationRevision`,
    ),
  };
};

const parseRotationSnapshot = (
  value: unknown,
  type: ShiftRotationType,
): BundleRotationSnapshot => {
  const rotation = parseShiftRotationAggregateWire(value, type);
  return {
    stateRevision: rotation.stateRevision,
    cursor: rotation.cursor,
    planningFrontierSeasonStartYear:
      rotation.planningFrontierSeasonStartYear,
    cohortFrozen: rotation.cohortFrozen,
    frozenCohortUserIds: rotation.frozenCohortUserIds,
    activeRevision: rotation.activeRevision,
    activeDigest: rotation.activeDigest,
    migrationBaseline: rotation.migrationBaseline,
    releaseLease: rotation.releaseLease,
    normalized: rotation as unknown as ShiftPlanningCanonicalJsonObject,
  };
};

const parseBundleFairnessSnapshot = (
  value: unknown,
  authoritativeValue: unknown,
): BundleFairnessSnapshot => {
  const authoritativeState = parseShiftPlanningAuthoritativeState(
    authoritativeValue,
  );
  const normalized = normalizeShiftPlanningFairnessSnapshot(value);
  const environment = normalized.environment;
  if (environment !== "develop" && environment !== "production") {
    return failState("Fairness snapshot environment is invalid.");
  }
  const roster = normalized.roster.map(parseRosterMember);
  const eligibleUserIds = roster
    .filter(isEligibleForShiftRotation)
    .map((member) => member.userId);
  const rotations = requireRecord(normalized.rotations, "rotations");
  const config = requireRecord(normalized.config, "config");
  if (
    typeof config.deliveryWeekday !== "string" ||
    !businessWeekdays.has(config.deliveryWeekday as BusinessWeekday) ||
    config.timeZone !== "Europe/Madrid"
  ) {
    return failState("Planning calendar configuration is invalid.");
  }
  const creditLedger = requireRecord(
    normalized.creditLedger,
    "creditLedger",
  );
  const sync = requireRecord(normalized.sync, "sync");
  const syncPartitions = requireRecord(sync.partitions, "sync.partitions");
  const measurementAuthority = requireRecord(
    sync.transactionMeasurementAuthority,
    "sync.transactionMeasurementAuthority",
  );
  if (
    Object.keys(measurementAuthority).length !== 2 ||
    !("adapterRevision" in measurementAuthority) ||
    !("indexConfigurationDigest" in measurementAuthority)
  ) {
    return failState("Transaction measurement authority fields are not exact.");
  }
  const transactionMeasurementAuthority = {
    adapterRevision: requireDocumentIdentifier(
      measurementAuthority.adapterRevision,
      "sync.transactionMeasurementAuthority.adapterRevision",
    ),
    indexConfigurationDigest: requireNullableDigest(
      measurementAuthority.indexConfigurationDigest,
      "sync.transactionMeasurementAuthority.indexConfigurationDigest",
    ) || failState("Measurement index digest must not be null."),
  };
  const activeRevision = requireNullableRevision(
    normalized.activeRevision,
    "activeRevision",
  );
  const activeDigest = requireNullableDigest(
    normalized.activeDigest,
    "activeDigest",
  );
  if ((activeRevision === null) !== (activeDigest === null)) {
    return failState("Active revision and digest must change together.");
  }
  const delivery = parseRotationSnapshot(rotations.delivery, "delivery");
  const market = parseRotationSnapshot(rotations.market, "market");
  const migrationBaseline = parseMigrationBaseline(
    normalized.migrationBaseline,
    "migrationBaseline",
  );
  if (
    delivery.activeRevision !== activeRevision ||
    market.activeRevision !== activeRevision ||
    delivery.activeDigest !== activeDigest ||
    market.activeDigest !== activeDigest
  ) {
    return failState("Rotation active revisions do not match bundle state.");
  }
  if (
    !sameMigrationBaseline(delivery.migrationBaseline, migrationBaseline) ||
    !sameMigrationBaseline(market.migrationBaseline, migrationBaseline)
  ) {
    return failState(
      "Rotation migration baselines do not match bundle lineage.",
    );
  }
  if (
    environment !== authoritativeState.environment ||
    normalized.writeEpoch !== authoritativeState.maintenance.writeEpoch ||
    activeRevision !== authoritativeState.maintenance.activeRevision ||
    activeDigest !== authoritativeState.maintenance.activeDigest ||
    createShiftPlanningDigest(delivery.normalized) !==
      createShiftPlanningDigest(authoritativeState.rotations.delivery) ||
    createShiftPlanningDigest(market.normalized) !==
      createShiftPlanningDigest(authoritativeState.rotations.market)
  ) {
    return failState(
      "Fairness snapshot does not match authoritative planning state.",
    );
  }
  const releaseLeaseDurationMillis = requireNonNegativeInteger(
    config.releaseLeaseDurationMillis,
    "config.releaseLeaseDurationMillis",
  );
  if (releaseLeaseDurationMillis === 0) {
    return failState("Release lease duration must be positive.");
  }
  const syncLeaseDurationMillis = requireNonNegativeInteger(
    sync.leaseDurationMillis,
    "sync.leaseDurationMillis",
  );
  if (syncLeaseDurationMillis === 0) {
    return failState("Sync lease duration must be positive.");
  }
  const workbookPartitions = {
    delivery: parseWorkbookPartition(syncPartitions.delivery, "delivery"),
    market: parseWorkbookPartition(syncPartitions.market, "market"),
  };
  if (
    workbookPartitions.delivery.workbookId !==
      workbookPartitions.market.workbookId ||
    workbookPartitions.delivery.workbookRevision !==
      workbookPartitions.market.workbookRevision ||
    workbookPartitions.delivery.partitionKey ===
      workbookPartitions.market.partitionKey
  ) {
    return failState("Workbook partition identities are inconsistent.");
  }
  const creditLedgerWriteCount = requireNonNegativeInteger(
    creditLedger.plannedWriteCount,
    "creditLedger.plannedWriteCount",
  );
  if (creditLedger.enabled !== false || creditLedgerWriteCount !== 0) {
    return failState(
      "Coverage-credit transitions remain disabled until HU-084.",
    );
  }
  return {
    normalized,
    authoritativeState,
    environment: authoritativeState.environment,
    activeRevision: authoritativeState.maintenance.activeRevision,
    activeDigest: authoritativeState.maintenance.activeDigest,
    roster,
    eligibleUserIds,
    delivery: parseRotationSnapshot(
      authoritativeState.rotations.delivery,
      "delivery",
    ),
    market: parseRotationSnapshot(
      authoritativeState.rotations.market,
      "market",
    ),
    deliveryWeekday: config.deliveryWeekday as BusinessWeekday,
    creditLedgerWriteCount,
    releaseLeaseDurationMillis,
    syncLeaseDurationMillis,
    workbookPartitions,
    transactionMeasurementAuthority,
  };
};

const validateRequestAgainstSnapshot = (
  request: ShiftPlanningRequestV2,
  snapshot: BundleFairnessSnapshot,
): void => {
  if (request.environment !== snapshot.environment) {
    failState("Planning request does not match authoritative state.");
  }
  if (
    request.expectedWriteEpoch !==
      snapshot.authoritativeState.maintenance.writeEpoch
  ) {
    throw new ShiftPlanningError(
      "stale_write_epoch",
      "Planning request write epoch is stale.",
    );
  }
  if (request.expectedActiveRevision !== snapshot.activeRevision) {
    throw new ShiftPlanningError(
      "stale_active_revision",
      "Planning request active revision is stale.",
    );
  }
  if (
    request.subplans.delivery.targetSeasonStartYear !==
      snapshot.delivery.planningFrontierSeasonStartYear ||
    request.subplans.market.targetSeasonStartYear !==
      snapshot.market.planningFrontierSeasonStartYear
  ) {
    throw new ShiftPlanningError(
      "invalid_planning_frontier",
      "Each subplan must target its own first incomplete frontier.",
    );
  }
};

const validateCohort = (
  mode: ShiftPlanningMode,
  type: ShiftRotationType,
  rotation: BundleRotationSnapshot,
  eligibleUserIds: readonly string[],
): void => {
  const cohortMatches = sameValueSet(
    rotation.cursor.cohortUserIds,
    eligibleUserIds,
  );
  if (!rotation.cohortFrozen && !cohortMatches) {
    failState(`${type} unfrozen cohort does not match live eligibility.`);
  }
  if (rotation.cohortFrozen && !cohortMatches && mode !== "preview") {
    throw new ShiftPlanningError(
      "frozen_cohort_mismatch",
      `${type} frozen cohort does not match live eligibility.`,
    );
  }
};

const validateModeGate = (
  request: ShiftPlanningRequestV2,
  snapshot: BundleFairnessSnapshot,
): void => {
  validateCohort(
    request.mode,
    "delivery",
    snapshot.delivery,
    snapshot.eligibleUserIds,
  );
  validateCohort(
    request.mode,
    "market",
    snapshot.market,
    snapshot.eligibleUserIds,
  );
  if (
    request.mode !== "preview" &&
    snapshot.authoritativeState.maintenance.maintenanceStatus !== "closed"
  ) {
    throw new ShiftPlanningError(
      "maintenance_state_conflict",
      "Stage and activate require closed planning maintenance.",
    );
  }
  if (
    request.mode !== "preview" &&
    (
      snapshot.delivery.releaseLease !== null ||
      snapshot.market.releaseLease !== null
    )
  ) {
    throw new ShiftPlanningError(
      "planning_release_lease_conflict",
      "A non-terminal release lease blocks stage and activate.",
    );
  }
  if (
    request.mode !== "preview" &&
    (
      snapshot.workbookPartitions.delivery.lease !== null ||
      snapshot.workbookPartitions.market.lease !== null
    )
  ) {
    throw new ShiftPlanningError(
      "planning_release_lease_conflict",
      "A claimed workbook partition blocks stage and activate.",
    );
  }
};

const requireTransactionWriteLimit = (value: number | undefined): number => {
  const limit = value ?? SHIFT_PLANNING_FIRESTORE_TRANSACTION_WRITE_LIMIT;
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > SHIFT_PLANNING_FIRESTORE_TRANSACTION_WRITE_LIMIT
  ) {
    return failState("Transaction write limit must be a positive integer.");
  }
  return limit;
};

const recipientManifest = (
  delivery: DeliveryPlan,
  market: MarketPlan,
  roster: readonly BundleRosterMember[],
): RecipientManifest[] => {
  const memberById = new Map(roster.map((member) => [member.userId, member]));
  const manifestFor = (
    recipientUserId: string,
    shiftType: ShiftRotationType,
    date: string,
  ): RecipientManifest => {
    const member = memberById.get(recipientUserId);
    if (!member) {
      return failState("Planned notification recipient is absent from roster.");
    }
    return {
      recipientUserId,
      shiftId: `shift_${shiftType}_${date.replace(/-/g, "")}`,
      shiftType,
      expectedAssignmentRevision: 1,
      expectedMembershipRevision: member.membershipRevision,
      expectedEligibilityRevision: member.eligibilityRevision,
      expectedDestinationRevision: member.destinationRevision,
    };
  };
  return [
    ...delivery.shifts.map((shift) => manifestFor(
      shift.assignedUserIds[0],
      "delivery",
      shift.date,
    )),
    ...market.shifts.flatMap((shift) => shift.assignedUserIds.map((userId) =>
      manifestFor(userId, "market", shift.date))),
  ].sort((left, right) => {
    const leftKey = `${left.shiftId}:${left.recipientUserId}`;
    const rightKey = `${right.shiftId}:${right.recipientUserId}`;
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
};

type BudgetInput = {
  writeLimit: number;
  delivery: DeliveryPlan;
  market: MarketPlan;
  heldIntentWrites: number;
  creditLedgerWrites: number;
  beforeImageWriteCount: number;
};

const transactionBudget = (
  direction: "forward" | "inverse",
  input: BudgetInput,
): ShiftPlanningTransactionBudget => {
  const publicShiftWrites =
    input.delivery.shifts.length + input.market.shifts.length;
  const predecessorHelperWrites =
    input.delivery.predecessorHelperUpdate === null ? 0 : 1;
  const beforeImageWrites = direction === "forward" ?
    input.beforeImageWriteCount : 0;
  const rotationWrites = 2 as const;
  const activeStateWrites = 1 as const;
  const bundleMetadataWrites = 0 as const;
  const requestWrites = 1 as const;
  const stagedCandidateWrites = 0 as const;
  const syncCommandWrites = 2 as const;
  const operationRegistryWrites = 1 as const;
  const commonUpdateWrites = predecessorHelperWrites + rotationWrites +
    activeStateWrites + requestWrites +
    operationRegistryWrites + input.creditLedgerWrites;
  const createWrites = direction === "forward" ?
    publicShiftWrites + syncCommandWrites + input.heldIntentWrites +
      beforeImageWrites : 0;
  const updateWrites = commonUpdateWrites;
  const deleteWrites = direction === "inverse" ?
    publicShiftWrites + syncCommandWrites + input.heldIntentWrites : 0;
  const budget: ShiftPlanningTransactionBudget = {
    direction,
    writeLimit: input.writeLimit,
    publicShiftWrites,
    predecessorHelperWrites,
    rotationWrites,
    activeStateWrites,
    bundleMetadataWrites,
    requestWrites,
    stagedCandidateWrites,
    syncCommandWrites,
    operationRegistryWrites,
    beforeImageWrites,
    heldIntentWrites: input.heldIntentWrites,
    creditLedgerWrites: input.creditLedgerWrites,
    createWrites,
    updateWrites,
    deleteWrites,
    totalWrites: createWrites + updateWrites + deleteWrites,
    byteEstimate: {
      status: "requiresPersistenceAdapter",
      estimatedBytes: null,
      configuredByteLimit: SHIFT_PLANNING_FIRESTORE_TRANSACTION_BYTE_LIMIT,
    },
  };
  if (budget.totalWrites > budget.writeLimit) {
    throw new ShiftPlanningError(
      "planning_bundle_oversize",
      "Combined activation manifest exceeds its explicit write limit.",
    );
  }
  return budget;
};

const normalizeFutureProjectionOccupancy = (input: {
  value: readonly ShiftPlanningProjectionOccupancy[] | undefined;
  type: ShiftRotationType;
  targetSeasonStartYear: number;
  deliveryWeekday: BusinessWeekday;
}): ShiftPlanningProjectionOccupancy[] => {
  if (input.value === undefined) return [];
  if (!Array.isArray(input.value)) {
    return failState(
      `${input.type} future projection occupancy must be an array.`,
    );
  }
  const result = input.value.map((item, index) => {
    const record = requireRecord(
      item,
      `${input.type}.futureProjectionOccupancy[${index}]`,
    );
    const fields = Object.keys(record);
    if (
      fields.length !== 4 ||
      ![
        "seasonStartYear",
        "occupiedPositionCount",
        "lineageRevision",
        "lineageDigest",
      ].every((field) => fields.includes(field))
    ) {
      return failState(
        `${input.type} future projection occupancy fields are not exact.`,
      );
    }
    const seasonStartYear = requireSeasonStartYear(
      record.seasonStartYear,
      `${input.type}.futureProjectionOccupancy[${index}].seasonStartYear`,
    );
    const occupiedPositionCount = requireNonNegativeInteger(
      record.occupiedPositionCount,
      `${input.type}.futureProjectionOccupancy[${index}].occupiedPositionCount`,
    );
    const capacity = input.type === "delivery" ?
      buildDeliverySeasonDates(seasonStartYear, input.deliveryWeekday).length :
      30;
    if (
      seasonStartYear <= input.targetSeasonStartYear ||
      occupiedPositionCount < 1 ||
      occupiedPositionCount > capacity
    ) {
      return failState(`${input.type} future projection occupancy is invalid.`);
    }
    return {
      seasonStartYear,
      occupiedPositionCount,
      lineageRevision: requireDocumentIdentifier(
        record.lineageRevision,
        `${input.type}.futureProjectionOccupancy[${index}].lineageRevision`,
      ),
      lineageDigest: requireNullableDigest(
        record.lineageDigest,
        `${input.type}.futureProjectionOccupancy[${index}].lineageDigest`,
      ) || failState("Future projection lineage digest must not be null."),
    };
  }).sort((left, right) => left.seasonStartYear - right.seasonStartYear);
  if (
    new Set(result.map((item) => item.seasonStartYear)).size !== result.length
  ) {
    return failState(
      `${input.type} future projection occupancy is duplicated.`,
    );
  }
  return result;
};

const nextFrontierFromOccupancy = (input: {
  type: ShiftRotationType;
  targetSeasonStartYear: number;
  generatedPositionCount: (seasonStartYear: number) => number;
  futureProjectionOccupancy: readonly ShiftPlanningProjectionOccupancy[];
  capacity: (seasonStartYear: number) => number;
}): number => {
  const occupiedBySeason = new Map(
    input.futureProjectionOccupancy.map((item) => [
      item.seasonStartYear,
      item.occupiedPositionCount,
    ]),
  );
  let frontier = input.targetSeasonStartYear + 1;
  while (frontier <= 9998) {
    const generated = input.generatedPositionCount(frontier);
    const inherited = occupiedBySeason.get(frontier) || 0;
    if (generated > 0 && inherited > 0) {
      return failState(
        `${input.type} generated overflow overlaps existing future occupancy.`,
      );
    }
    const occupied = generated + inherited;
    const capacity = input.capacity(frontier);
    if (occupied > capacity) {
      return failState(`${input.type} future projection exceeds capacity.`);
    }
    if (occupied < capacity) return frontier;
    frontier += 1;
  }
  return failState(
    `${input.type} planning frontier exceeds supported seasons.`,
  );
};

const nextDeliveryFrontier = (
  targetSeasonStartYear: number,
  weekday: BusinessWeekday,
  plan: DeliveryPlan,
  futureProjectionOccupancy: readonly ShiftPlanningProjectionOccupancy[],
): number => nextFrontierFromOccupancy({
  type: "delivery",
  targetSeasonStartYear,
  generatedPositionCount: (seasonStartYear) => plan.shifts.filter(
    (shift) => shift.projectionSeasonStartYear === seasonStartYear,
  ).length,
  futureProjectionOccupancy,
  capacity: (seasonStartYear) =>
    buildDeliverySeasonDates(seasonStartYear, weekday).length,
});

const nextMarketFrontier = (
  targetSeasonStartYear: number,
  plan: MarketPlan,
  futureProjectionOccupancy: readonly ShiftPlanningProjectionOccupancy[],
): number => nextFrontierFromOccupancy({
  type: "market",
  targetSeasonStartYear,
  generatedPositionCount: (seasonStartYear) => plan.shifts
    .filter((shift) => shift.projectionSeasonStartYear === seasonStartYear)
    .reduce(
      (total, shift) => total + shift.rotationPositions.length,
      0,
    ),
  futureProjectionOccupancy,
  capacity: () => 30,
});

const frontierTransitions = (input: {
  snapshot: BundleFairnessSnapshot;
  delivery: DeliveryPlan;
  market: MarketPlan;
  deliveryFutureProjectionOccupancy:
    readonly ShiftPlanningProjectionOccupancy[];
  marketFutureProjectionOccupancy:
    readonly ShiftPlanningProjectionOccupancy[];
}): {
  delivery: ShiftPlanningFrontierTransition;
  market: ShiftPlanningFrontierTransition;
} => {
  if (
    input.snapshot.delivery.stateRevision === Number.MAX_SAFE_INTEGER ||
    input.snapshot.market.stateRevision === Number.MAX_SAFE_INTEGER
  ) {
    return failState("Rotation state revision cannot advance safely.");
  }
  return {
    delivery: {
      frontierBefore: {
        seasonStartYear:
          input.snapshot.delivery.planningFrontierSeasonStartYear,
        stateRevision: input.snapshot.delivery.stateRevision,
        cursorDigest: createShiftPlanningDigest(
          input.snapshot.delivery.cursor,
        ),
      },
      frontierAfter: {
        seasonStartYear: nextDeliveryFrontier(
          input.snapshot.delivery.planningFrontierSeasonStartYear,
          input.snapshot.deliveryWeekday,
          input.delivery,
          input.deliveryFutureProjectionOccupancy,
        ),
        stateRevision: input.snapshot.delivery.stateRevision + 1,
        cursorDigest: createShiftPlanningDigest(input.delivery.nextRotation),
      },
    },
    market: {
      frontierBefore: {
        seasonStartYear:
          input.snapshot.market.planningFrontierSeasonStartYear,
        stateRevision: input.snapshot.market.stateRevision,
        cursorDigest: createShiftPlanningDigest(input.snapshot.market.cursor),
      },
      frontierAfter: {
        seasonStartYear: nextMarketFrontier(
          input.snapshot.market.planningFrontierSeasonStartYear,
          input.market,
          input.marketFutureProjectionOccupancy,
        ),
        stateRevision: input.snapshot.market.stateRevision + 1,
        cursorDigest: createShiftPlanningDigest(input.market.nextRotation),
      },
    },
  };
};

type ReleaseLeaseIntentTemplate = Omit<
  ShiftPlanningReleaseLeaseIntent,
  "bundleRevision" | "bundleDigest"
>;

const releaseLeaseIntentTemplates = (input: {
  bundleId: string;
  leaseEpoch: number;
  durationMillis: number;
}): [ReleaseLeaseIntentTemplate, ReleaseLeaseIntentTemplate] => [
  {
    action: "acquire",
    type: "delivery",
    state: "sealed",
    bundleId: input.bundleId,
    leaseEpoch: input.leaseEpoch,
    ownerOperationId: `activate-${createShiftPlanningDigest({
      bundleId: input.bundleId,
    }).slice(SHIFT_PLANNING_DIGEST_PREFIX.length, 48)}`,
    expectedCurrentLease: null,
    deadlinePolicy: {
      kind: "durationFromServerAcquisition",
      durationMillis: input.durationMillis,
    },
  },
  {
    action: "acquire",
    type: "market",
    state: "sealed",
    bundleId: input.bundleId,
    leaseEpoch: input.leaseEpoch,
    ownerOperationId: `activate-${createShiftPlanningDigest({
      bundleId: input.bundleId,
    }).slice(SHIFT_PLANNING_DIGEST_PREFIX.length, 48)}`,
    expectedCurrentLease: null,
    deadlinePolicy: {
      kind: "durationFromServerAcquisition",
      durationMillis: input.durationMillis,
    },
  },
];

const activationManifest = (input: {
  request: ShiftPlanningRequestV2;
  snapshot: BundleFairnessSnapshot;
  expectedStateDigest: string;
  expectedAuthoritativeDigest: string;
  activationWriteEpoch: number;
  delivery: DeliveryPlan;
  market: MarketPlan;
  recipients: readonly RecipientManifest[];
  frontiers: {
    delivery: ShiftPlanningFrontierTransition;
    market: ShiftPlanningFrontierTransition;
  };
  releaseLeaseIntents: readonly [
    ReleaseLeaseIntentTemplate,
    ReleaseLeaseIntentTemplate,
  ];
}): ShiftPlanningActivationManifest => ({
  expectedStateDigest: input.expectedStateDigest,
  expectedAuthoritativeDigest: input.expectedAuthoritativeDigest,
  publicProjection: {
    deliveryShiftWrites: input.delivery.shifts.length,
    marketShiftWrites: input.market.shifts.length,
    predecessorHelperWrites:
      input.delivery.predecessorHelperUpdate === null ? 0 : 1,
  },
  rotations: {
    delivery: {
      stateRevisionBefore: input.snapshot.delivery.stateRevision,
      stateRevisionAfter: input.snapshot.delivery.stateRevision + 1,
      frontierBefore: input.frontiers.delivery.frontierBefore,
      frontierAfter: input.frontiers.delivery.frontierAfter,
      cursorAfter: input.delivery.nextRotation,
      cohortFrozenAfter: input.delivery.nextRotation.nextMemberIndex !== 0,
      frozenCohortUserIdsAfter:
        input.delivery.nextRotation.nextMemberIndex !== 0 ?
          input.delivery.nextRotation.cohortUserIds : [],
    },
    market: {
      stateRevisionBefore: input.snapshot.market.stateRevision,
      stateRevisionAfter: input.snapshot.market.stateRevision + 1,
      frontierBefore: input.frontiers.market.frontierBefore,
      frontierAfter: input.frontiers.market.frontierAfter,
      cursorAfter: input.market.nextRotation,
      cohortFrozenAfter: input.market.nextRotation.nextMemberIndex !== 0,
      frozenCohortUserIdsAfter:
        input.market.nextRotation.nextMemberIndex !== 0 ?
          input.market.nextRotation.cohortUserIds : [],
    },
  },
  activeState: {
    stateRevisionBefore:
      input.snapshot.authoritativeState.maintenance.stateRevision,
    stateRevisionAfter:
      input.snapshot.authoritativeState.maintenance.stateRevision + 1,
    writeEpochBefore:
      input.snapshot.authoritativeState.maintenance.writeEpoch,
    writeEpochAfter: input.activationWriteEpoch,
    activeRevisionBefore:
      input.snapshot.authoritativeState.maintenance.activeRevision,
  },
  syncCommandTemplates: [
    {
      type: "delivery",
      idempotencyKeySuffix: "sheets:delivery",
      targetSeasonStartYear:
        input.request.subplans.delivery.targetSeasonStartYear,
      affectedProjectionSeasonStartYears:
        input.delivery.affectedProjectionSeasonStartYears,
      workbookId: input.snapshot.workbookPartitions.delivery.workbookId,
      workbookRevision:
        input.snapshot.workbookPartitions.delivery.workbookRevision,
      partitionKey: input.snapshot.workbookPartitions.delivery.partitionKey,
      expectedPartitionStateRevision:
        input.snapshot.workbookPartitions.delivery.stateRevision,
      expectedPartitionEpoch:
        input.snapshot.workbookPartitions.delivery.epoch,
      commandPartitionEpoch:
        input.snapshot.workbookPartitions.delivery.epoch + 1,
      expectedCurrentLease: null,
    },
    {
      type: "market",
      idempotencyKeySuffix: "sheets:market",
      targetSeasonStartYear:
        input.request.subplans.market.targetSeasonStartYear,
      affectedProjectionSeasonStartYears:
        input.market.affectedProjectionSeasonStartYears,
      workbookId: input.snapshot.workbookPartitions.market.workbookId,
      workbookRevision:
        input.snapshot.workbookPartitions.market.workbookRevision,
      partitionKey: input.snapshot.workbookPartitions.market.partitionKey,
      expectedPartitionStateRevision:
        input.snapshot.workbookPartitions.market.stateRevision,
      expectedPartitionEpoch: input.snapshot.workbookPartitions.market.epoch,
      commandPartitionEpoch:
        input.snapshot.workbookPartitions.market.epoch + 1,
      expectedCurrentLease: null,
    },
  ],
  heldRecipients: input.recipients,
  creditLedgerWriteCount: input.snapshot.creditLedgerWriteCount,
  releaseLeaseIntents: input.releaseLeaseIntents,
});

const recoveryManifest = (input: {
  request: ShiftPlanningRequestV2;
  snapshot: BundleFairnessSnapshot;
  expectedStateDigest: string;
  expectedAuthoritativeDigest: string;
  activationWriteEpoch: number;
  delivery: DeliveryPlan;
  market: MarketPlan;
  recipients: readonly RecipientManifest[];
  creditLedgerWriteCount: number;
}): ShiftPlanningRecoveryManifest => {
  const root = `${input.request.environment}/plus-collections`;
  const publicShiftPaths = [
    ...input.delivery.shifts.map((shift) =>
      `${root}/shifts/shift_delivery_${shift.date.replace(/-/g, "")}`),
    ...input.market.shifts.map((shift) =>
      `${root}/shifts/shift_market_${shift.date.replace(/-/g, "")}`),
  ];
  const deleteCreatedDocuments = [
    ...publicShiftPaths,
    `${root}/shiftPlanningSyncCommands/{bundleRevision}-delivery`,
    `${root}/shiftPlanningSyncCommands/{bundleRevision}-market`,
    ...input.recipients.map((_, index) =>
      `${root}/shiftPlanningNotificationIntents/` +
      `{bundleRevision}-notification-${index + 1}`),
  ].map((pathTemplate) => ({
    pathTemplate,
    expectedBundleRevision: "{bundleRevision}" as const,
    expectedBundleDigest: "{bundleDigest}" as const,
  }));
  const beforeImageTargets: {path: string; contract: unknown}[] = [
    {
      path: `${root}/shiftRotations/delivery`,
      contract: input.snapshot.delivery.normalized,
    },
    {
      path: `${root}/shiftRotations/market`,
      contract: input.snapshot.market.normalized,
    },
    {
      path: `${root}/shiftPlanningState/current`,
      contract: input.snapshot.authoritativeState.maintenance,
    },
  ];
  if (input.delivery.predecessorHelperUpdate !== null) {
    const predecessorGuard = input.delivery.predecessorGuard;
    if (predecessorGuard === null) {
      return failState(
        "Delivery predecessor update is missing its transaction guard.",
      );
    }
    beforeImageTargets.push({
      path: `${root}/shifts/${predecessorGuard.shiftId}`,
      contract: predecessorGuard,
    });
  }
  return {
    expectedStateDigest: input.expectedStateDigest,
    expectedAuthoritativeDigest: input.expectedAuthoritativeDigest,
    requiresPersistedBeforeImages: true,
    recoveryWriteEpoch: {
      kind: "incrementCurrent",
      minimumExclusiveEpoch: input.activationWriteEpoch,
      neverReuseOrDecrement: true,
    },
    restoreActiveLineage: {
      revision: input.snapshot.activeRevision,
      digest: input.snapshot.activeDigest,
    },
    requiredActiveCas: {
      bundleRevision: "{bundleRevision}",
      bundleDigest: "{bundleDigest}",
      writeEpoch: input.activationWriteEpoch,
    },
    deleteCreatedDocuments,
    restoreBeforeImages: beforeImageTargets.map(({path, contract}, index) => ({
      targetPath: path,
      beforeImagePathTemplate:
        `${root}/shiftPlanningOperations/{operationId}/` +
        `beforeImages/${index + 1}`,
      captureContractDigest: createShiftPlanningDigest(contract),
    })),
    publicProjectionDeletes: {
      delivery: input.delivery.shifts.length,
      market: input.market.shifts.length,
    },
    predecessorHelperRestores:
      input.delivery.predecessorHelperUpdate === null ? 0 : 1,
    rotationRestores: 2,
    activeStateRestores: 1,
    bundleMetadataUpdates: 0,
    requestUpdates: 1,
    stagedCandidateUpdates: 0,
    syncCommandDeletes: 2,
    operationRegistryUpdates: 1,
    heldIntentDeletes: input.recipients.length,
    creditLedgerRestores: input.creditLedgerWriteCount,
    releaseLeaseActions: [
      {action: "clear", type: "delivery", expectedState: "sealed"},
      {action: "clear", type: "market", expectedState: "sealed"},
    ],
  };
};

const stableRequestInput = (request: ShiftPlanningRequestV2): object => ({
  schemaVersion: request.schemaVersion,
  bundleId: request.bundleId,
  environment: request.environment,
  requestedByUserId: request.requestedByUserId,
  expectedWriteEpoch: request.expectedWriteEpoch,
  expectedActiveRevision: request.expectedActiveRevision,
  subplans: request.subplans,
});

const bundleRevision = (digest: string): string => {
  const hash = digest.slice(SHIFT_PLANNING_DIGEST_PREFIX.length);
  return `bundle-v2-${hash.slice(0, 24)}`;
};

const requireExactRecordFields = (
  record: ShiftPlanningCanonicalJsonObject,
  fields: readonly string[],
  name: string,
): void => {
  const keys = Object.keys(record);
  if (
    keys.length !== fields.length ||
    keys.some((key) => !fields.includes(key))
  ) {
    failState(`${name} fields are not exact.`);
  }
};

/**
 * Rehydrates the exact expected-state artifact persisted with a v2 bundle.
 * @param {unknown} value Untrusted expected-state artifact.
 * @return {ShiftPlanningExpectedState} Canonical authoritative read-set
 * binding.
 */
export const parseShiftPlanningExpectedState = (
  value: unknown,
): ShiftPlanningExpectedState => {
  const expectedState = requireRecord(value, "expectedState");
  requireExactRecordFields(expectedState, [
    "schemaVersion",
    "authoritativeState",
    "transactionMeasurementAuthority",
  ], "expectedState");
  if (expectedState.schemaVersion !== SHIFT_PLANNING_BUNDLE_SCHEMA_VERSION) {
    return failState("Expected-state schema is unsupported.");
  }
  const measurementAuthority = requireRecord(
    expectedState.transactionMeasurementAuthority,
    "expectedState.transactionMeasurementAuthority",
  );
  requireExactRecordFields(measurementAuthority, [
    "adapterRevision",
    "indexConfigurationDigest",
  ], "expectedState.transactionMeasurementAuthority");
  return {
    schemaVersion: SHIFT_PLANNING_BUNDLE_SCHEMA_VERSION,
    authoritativeState: parseShiftPlanningAuthoritativeState(
      expectedState.authoritativeState,
    ),
    transactionMeasurementAuthority: {
      adapterRevision: requireDocumentIdentifier(
        measurementAuthority.adapterRevision,
        "expectedState.transactionMeasurementAuthority.adapterRevision",
      ),
      indexConfigurationDigest: requireNullableDigest(
        measurementAuthority.indexConfigurationDigest,
        "expectedState.transactionMeasurementAuthority." +
          "indexConfigurationDigest",
      ) || failState("Expected-state index digest must not be null."),
    },
  };
};

export const parseShiftPlanningPreviewReceipt = (
  value: unknown,
): ShiftPlanningPreviewReceipt => {
  const receipt = requireRecord(value, "persistedPreview");
  requireExactRecordFields(receipt, [
    "schemaVersion",
    "status",
    "mode",
    "requestId",
    "bundleId",
    "bundleRevision",
    "bundleDigest",
    "environment",
    "requestedByUserId",
    "expectedStateDigest",
  ], "persistedPreview");
  if (
    receipt.schemaVersion !== SHIFT_PLANNING_BUNDLE_SCHEMA_VERSION ||
    receipt.status !== "completed" ||
    receipt.mode !== "preview" ||
    (receipt.environment !== "develop" && receipt.environment !== "production")
  ) {
    return failState("Persisted preview discriminators are invalid.");
  }
  return {
    schemaVersion: SHIFT_PLANNING_BUNDLE_SCHEMA_VERSION,
    status: "completed",
    mode: "preview",
    requestId: requireDocumentIdentifier(
      receipt.requestId,
      "preview.requestId",
    ),
    bundleId: requireDocumentIdentifier(receipt.bundleId, "preview.bundleId"),
    bundleRevision: requireDocumentIdentifier(
      receipt.bundleRevision,
      "preview.bundleRevision",
    ),
    bundleDigest: requireNullableDigest(
      receipt.bundleDigest,
      "preview.bundleDigest",
    ) || failState("Preview bundle digest must not be null."),
    environment: receipt.environment,
    requestedByUserId: requireDocumentIdentifier(
      receipt.requestedByUserId,
      "preview.requestedByUserId",
    ),
    expectedStateDigest: requireNullableDigest(
      receipt.expectedStateDigest,
      "preview.expectedStateDigest",
    ) || failState("Preview expected-state digest must not be null."),
  };
};

export const parseShiftPlanningStagedCandidateArtifact = (
  value: unknown,
): ShiftPlanningStagedCandidate => {
  const candidate = requireRecord(value, "stagedCandidate");
  requireExactRecordFields(candidate, [
    "schemaVersion",
    "status",
    "candidateId",
    "bundleId",
    "bundleRevision",
    "bundleDigest",
    "environment",
    "requestedByUserId",
    "sourcePreviewRequestId",
    "sourcePreviewReceiptDigest",
    "sourceStageRequestId",
    "expectedStateDigest",
    "positionManifest",
  ], "stagedCandidate");
  if (
    candidate.schemaVersion !== SHIFT_PLANNING_BUNDLE_SCHEMA_VERSION ||
    candidate.status !== "staged" ||
    (
      candidate.environment !== "develop" &&
      candidate.environment !== "production"
    )
  ) {
    return failState("Staged candidate discriminators are invalid.");
  }
  return {
    schemaVersion: SHIFT_PLANNING_BUNDLE_SCHEMA_VERSION,
    status: "staged",
    candidateId: requireDocumentIdentifier(
      candidate.candidateId,
      "candidate.candidateId",
    ),
    bundleId: requireDocumentIdentifier(
      candidate.bundleId,
      "candidate.bundleId",
    ),
    bundleRevision: requireDocumentIdentifier(
      candidate.bundleRevision,
      "candidate.bundleRevision",
    ),
    bundleDigest: requireNullableDigest(
      candidate.bundleDigest,
      "candidate.bundleDigest",
    ) || failState("Candidate bundle digest must not be null."),
    environment: candidate.environment,
    requestedByUserId: requireDocumentIdentifier(
      candidate.requestedByUserId,
      "candidate.requestedByUserId",
    ),
    sourcePreviewRequestId: requireDocumentIdentifier(
      candidate.sourcePreviewRequestId,
      "candidate.sourcePreviewRequestId",
    ),
    sourcePreviewReceiptDigest: requireNullableDigest(
      candidate.sourcePreviewReceiptDigest,
      "candidate.sourcePreviewReceiptDigest",
    ) || failState("Candidate preview receipt digest must not be null."),
    sourceStageRequestId: requireDocumentIdentifier(
      candidate.sourceStageRequestId,
      "candidate.sourceStageRequestId",
    ),
    expectedStateDigest: requireNullableDigest(
      candidate.expectedStateDigest,
      "candidate.expectedStateDigest",
    ) || failState("Candidate expected-state digest must not be null."),
    positionManifest: parseShiftPlanningCandidatePositionManifest(
      candidate.positionManifest,
    ),
  };
};

export const validateShiftPlanningStagedCandidate = (input: {
  value: unknown;
}): ShiftPlanningStagedCandidate =>
  parseShiftPlanningStagedCandidateArtifact(input.value);

const validateBinding = (
  request: ShiftPlanningRequestV2,
  revision: string,
  digest: string,
): void => {
  if (
    request.mode !== "preview" &&
    (
      (request.mode === "stage" && request.binding?.kind !== "preview") ||
      (request.mode === "activate" &&
        request.binding?.kind !== "candidate") ||
      request.binding?.bundleRevision !== revision ||
      request.binding?.bundleDigest !== digest
    )
  ) {
    throw new ShiftPlanningError(
      request.mode === "stage" ?
        "preview_binding_mismatch" : "candidate_binding_mismatch",
      "Stage or activate binding does not match the deterministic bundle.",
    );
  }
};

const resolvePersistedPlanningChain = (input: {
  request: ShiftPlanningRequestV2;
  revision: string;
  digest: string;
  expectedStateDigest: string;
  positionManifest: ShiftPlanningCandidatePositionManifest;
  persistedPreview: unknown;
  stagedCandidate: unknown;
}): {
  previewReceipt: ShiftPlanningPreviewReceipt | null;
  previewReceiptDigest: string | null;
  stagedCandidate: ShiftPlanningStagedCandidate | null;
  stagedCandidateDigest: string | null;
} => {
  const hasPersistedPreview = input.persistedPreview !== undefined &&
    input.persistedPreview !== null;
  const hasStagedCandidate = input.stagedCandidate !== undefined &&
    input.stagedCandidate !== null;
  if (input.request.mode === "preview") {
    if (hasPersistedPreview || hasStagedCandidate) {
      return failState("Preview cannot consume persisted-chain artifacts.");
    }
    const previewReceipt: ShiftPlanningPreviewReceipt = {
      schemaVersion: SHIFT_PLANNING_BUNDLE_SCHEMA_VERSION,
      status: "completed",
      mode: "preview",
      requestId: input.request.requestId,
      bundleId: input.request.bundleId,
      bundleRevision: input.revision,
      bundleDigest: input.digest,
      environment: input.request.environment,
      requestedByUserId: input.request.requestedByUserId,
      expectedStateDigest: input.expectedStateDigest,
    };
    return {
      previewReceipt,
      previewReceiptDigest: createShiftPlanningDigest(previewReceipt),
      stagedCandidate: null,
      stagedCandidateDigest: null,
    };
  }
  if (input.request.mode === "stage") {
    if (!hasPersistedPreview || hasStagedCandidate) {
      throw new ShiftPlanningError(
        "preview_binding_mismatch",
        "Stage requires one exact persisted preview.",
      );
    }
    const previewReceipt = parseShiftPlanningPreviewReceipt(
      input.persistedPreview,
    );
    if (
      input.request.binding?.kind !== "preview" ||
      previewReceipt.requestId !== input.request.binding.sourceRequestId ||
      previewReceipt.bundleId !== input.request.bundleId ||
      previewReceipt.bundleRevision !== input.revision ||
      previewReceipt.bundleDigest !== input.digest ||
      previewReceipt.environment !== input.request.environment ||
      previewReceipt.requestedByUserId !== input.request.requestedByUserId ||
      previewReceipt.expectedStateDigest !== input.expectedStateDigest
    ) {
      throw new ShiftPlanningError(
        "preview_binding_mismatch",
        "Persisted preview does not match the stage request and live bundle.",
      );
    }
    const previewReceiptDigest = createShiftPlanningDigest(previewReceipt);
    const stagedCandidate: ShiftPlanningStagedCandidate = {
      schemaVersion: SHIFT_PLANNING_BUNDLE_SCHEMA_VERSION,
      status: "staged",
      candidateId: input.request.bundleId,
      bundleId: input.request.bundleId,
      bundleRevision: input.revision,
      bundleDigest: input.digest,
      environment: input.request.environment,
      requestedByUserId: input.request.requestedByUserId,
      sourcePreviewRequestId: previewReceipt.requestId,
      sourcePreviewReceiptDigest: previewReceiptDigest,
      sourceStageRequestId: input.request.requestId,
      expectedStateDigest: input.expectedStateDigest,
      positionManifest: input.positionManifest,
    };
    return {
      previewReceipt,
      previewReceiptDigest,
      stagedCandidate,
      stagedCandidateDigest: createShiftPlanningDigest(stagedCandidate),
    };
  }
  if (hasPersistedPreview || !hasStagedCandidate) {
    throw new ShiftPlanningError(
      "candidate_binding_mismatch",
      "Activate requires only the persisted staged candidate.",
    );
  }
  const stagedCandidate = validateShiftPlanningStagedCandidate({
    value: input.stagedCandidate,
  });
  const stagedCandidateDigest = createShiftPlanningDigest(stagedCandidate);
  if (
    input.request.binding?.kind !== "candidate" ||
    input.request.binding.candidateDigest !== stagedCandidateDigest ||
    stagedCandidate.candidateId !== input.request.binding.candidateId ||
    stagedCandidate.candidateId !== input.request.bundleId ||
    stagedCandidate.bundleId !== input.request.bundleId ||
    stagedCandidate.bundleRevision !== input.revision ||
    stagedCandidate.bundleDigest !== input.digest ||
    stagedCandidate.environment !== input.request.environment ||
    stagedCandidate.requestedByUserId !== input.request.requestedByUserId ||
    stagedCandidate.sourceStageRequestId === input.request.requestId ||
    stagedCandidate.expectedStateDigest !== input.expectedStateDigest ||
    createShiftPlanningDigest(stagedCandidate.positionManifest) !==
      createShiftPlanningDigest(input.positionManifest)
  ) {
    throw new ShiftPlanningError(
      "candidate_binding_mismatch",
      "Persisted candidate does not match the activate request " +
      "and live bundle.",
    );
  }
  return {
    previewReceipt: null,
    previewReceiptDigest: null,
    stagedCandidate,
    stagedCandidateDigest,
  };
};

const syncCommands = (input: {
  revision: string;
  digest: string;
  writeEpoch: number;
  request: ShiftPlanningRequestV2;
  snapshot: BundleFairnessSnapshot;
  delivery: DeliveryPlan;
  market: MarketPlan;
}): [ShiftPlanningSyncCommand, ShiftPlanningSyncCommand] => {
  const command = (
    type: ShiftRotationType,
    targetSeasonStartYear: number,
    affectedProjectionSeasonStartYears: readonly number[],
  ): ShiftPlanningSyncCommand => {
    const partition = input.snapshot.workbookPartitions[type];
    return {
      commandId: `${input.revision}-${type}`,
      idempotencyKey: `${input.revision}:sheets:${type}`,
      state: "pending",
      type,
      bundleRevision: input.revision,
      bundleDigest: input.digest,
      writeEpoch: input.writeEpoch,
      workbookId: partition.workbookId,
      workbookRevision: partition.workbookRevision,
      partitionKey: partition.partitionKey,
      expectedPartitionStateRevision: partition.stateRevision,
      expectedPartitionEpoch: partition.epoch,
      commandPartitionEpoch: partition.epoch + 1,
      expectedCurrentLease: null,
      leaseIntent: {
        ownerOperationId: `${input.revision}:sheets:${type}`,
        leaseEpoch: partition.epoch + 1,
        state: "claimed",
        durationMillis: input.snapshot.syncLeaseDurationMillis,
      },
      expectedActiveRevision: input.revision,
      expectedActiveDigest: input.digest,
      targetSeasonStartYear,
      affectedProjectionSeasonStartYears,
    };
  };
  return [
    command(
      "delivery",
      input.request.subplans.delivery.targetSeasonStartYear,
      input.delivery.affectedProjectionSeasonStartYears,
    ),
    command(
      "market",
      input.request.subplans.market.targetSeasonStartYear,
      input.market.affectedProjectionSeasonStartYears,
    ),
  ];
};

const heldNotificationIntents = (input: {
  recipients: readonly RecipientManifest[];
  revision: string;
  digest: string;
  writeEpoch: number;
}): ShiftPlanningHeldNotificationIntent[] => input.recipients.map(
  (recipient, index) => ({
    intentId: `${input.revision}-notification-${index + 1}`,
    idempotencyKey: `${input.revision}:notification:${index + 1}`,
    state: "held",
    recipientUserId: recipient.recipientUserId,
    shiftId: recipient.shiftId,
    shiftType: recipient.shiftType,
    expectedAssignmentRevision: recipient.expectedAssignmentRevision,
    expectedMembershipRevision: recipient.expectedMembershipRevision,
    expectedEligibilityRevision: recipient.expectedEligibilityRevision,
    expectedDestinationRevision: recipient.expectedDestinationRevision,
    canonicalEventType: "shift_assignment_updated",
    payloadPolicy: "genericReferenceOnly",
    bundleRevision: input.revision,
    bundleDigest: input.digest,
    writeEpoch: input.writeEpoch,
  }),
);

/**
 * Plans one deterministic delivery-plus-market candidate without persistence.
 * Preview, stage, and activate share the same revision/digest because request
 * lifecycle metadata is excluded while every planning input and derived public
 * manifest remains bound.
 * @param {ShiftPlanningBundleInput} input Untrusted request plus fair state.
 * @return {ShiftPlanningBundleResult} Side-effect-free combined candidate.
 */
export const planShiftPlanningBundle = (
  input: ShiftPlanningBundleInput,
): ShiftPlanningBundleResult => {
  if ("transactionEvidence" in input) {
    failState(
      "Planning cannot consume transaction evidence before a real attempt.",
    );
  }
  const request = parseShiftPlanningRequestV2(input.request);
  const snapshot = parseBundleFairnessSnapshot(
    input.fairnessSnapshot,
    input.authoritativeState,
  );
  validateRequestAgainstSnapshot(request, snapshot);
  validateModeGate(request, snapshot);
  const writeLimit = requireTransactionWriteLimit(
    input.transactionWriteLimit,
  );
  if (
    request.expectedWriteEpoch >= Number.MAX_SAFE_INTEGER - 1 ||
    snapshot.authoritativeState.maintenance.stateRevision ===
      Number.MAX_SAFE_INTEGER
  ) {
    failState("Activation and recovery epochs cannot advance safely.");
  }
  if (
    snapshot.workbookPartitions.delivery.epoch >= Number.MAX_SAFE_INTEGER - 1 ||
    snapshot.workbookPartitions.market.epoch >= Number.MAX_SAFE_INTEGER - 1
  ) {
    failState("Workbook partition epochs cannot advance and recover safely.");
  }
  const activationWriteEpoch =
    snapshot.authoritativeState.maintenance.writeEpoch + 1;
  const deliveryFutureProjectionOccupancy =
    normalizeFutureProjectionOccupancy({
      value: input.delivery.futureProjectionOccupancy,
      type: "delivery",
      targetSeasonStartYear:
        request.subplans.delivery.targetSeasonStartYear,
      deliveryWeekday: snapshot.deliveryWeekday,
    });
  const marketFutureProjectionOccupancy = normalizeFutureProjectionOccupancy({
    value: input.market.futureProjectionOccupancy,
    type: "market",
    targetSeasonStartYear: request.subplans.market.targetSeasonStartYear,
    deliveryWeekday: snapshot.deliveryWeekday,
  });
  const delivery = planDeliveryShifts({
    planningRequestId: request.bundleId,
    targetSeasonStartYear: request.subplans.delivery.targetSeasonStartYear,
    deliveryWeekday: snapshot.deliveryWeekday,
    rotation: snapshot.delivery.cursor,
    inheritedTargetPrefix: input.delivery.inheritedTargetPrefix ?? null,
    continuity: input.delivery.continuity,
  });
  const market = planMarketShifts({
    planningRequestId: request.bundleId,
    targetSeasonStartYear: request.subplans.market.targetSeasonStartYear,
    rotation: snapshot.market.cursor,
    inheritedTargetPrefix: input.market.inheritedTargetPrefix ?? null,
  });
  const recipients = recipientManifest(delivery, market, snapshot.roster);
  const frontiers = frontierTransitions({
    snapshot,
    delivery,
    market,
    deliveryFutureProjectionOccupancy,
    marketFutureProjectionOccupancy,
  });
  const expectedState: ShiftPlanningExpectedState = {
    schemaVersion: SHIFT_PLANNING_BUNDLE_SCHEMA_VERSION,
    authoritativeState: snapshot.authoritativeState,
    transactionMeasurementAuthority:
      snapshot.transactionMeasurementAuthority,
  };
  const expectedStateDigest = createShiftPlanningDigest(expectedState);
  const leaseIntentTemplates = releaseLeaseIntentTemplates({
    bundleId: request.bundleId,
    leaseEpoch: activationWriteEpoch,
    durationMillis: snapshot.releaseLeaseDurationMillis,
  });
  const forwardManifest = activationManifest({
    request,
    snapshot,
    expectedStateDigest,
    expectedAuthoritativeDigest:
      snapshot.authoritativeState.authoritativeDigest,
    activationWriteEpoch,
    delivery,
    market,
    recipients,
    frontiers,
    releaseLeaseIntents: leaseIntentTemplates,
  });
  const inverseManifest = recoveryManifest({
    request,
    snapshot,
    expectedStateDigest,
    expectedAuthoritativeDigest:
      snapshot.authoritativeState.authoritativeDigest,
    activationWriteEpoch,
    delivery,
    market,
    recipients,
    creditLedgerWriteCount: snapshot.creditLedgerWriteCount,
  });
  const budgetInput = {
    writeLimit,
    delivery,
    market,
    heldIntentWrites: recipients.length,
    creditLedgerWrites: snapshot.creditLedgerWriteCount,
    beforeImageWriteCount: inverseManifest.restoreBeforeImages.length,
  };
  const budgets = {
    forward: transactionBudget("forward", budgetInput),
    inverse: transactionBudget("inverse", budgetInput),
  };
  const bundleDigest = createShiftPlanningDigest({
    schemaVersion: SHIFT_PLANNING_BUNDLE_SCHEMA_VERSION,
    request: stableRequestInput(request),
    fairnessSnapshot: snapshot.normalized,
    expectedState,
    frontiers,
    deliveryBoundary: {
      inheritedTargetPrefix: input.delivery.inheritedTargetPrefix ?? null,
      continuity: input.delivery.continuity,
    },
    marketBoundary: {
      inheritedTargetPrefix: input.market.inheritedTargetPrefix ?? null,
    },
    futureProjectionOccupancy: {
      delivery: deliveryFutureProjectionOccupancy,
      market: marketFutureProjectionOccupancy,
    },
    plans: {delivery, market},
    manifests: {
      forward: forwardManifest,
      inverse: inverseManifest,
    },
    budgetPolicy: {
      writeLimit,
      byteLimit: SHIFT_PLANNING_FIRESTORE_TRANSACTION_BYTE_LIMIT,
      byteEstimation: "requiresPersistenceAdapter",
    },
    budgets,
  });
  const revision = bundleRevision(bundleDigest);
  validateBinding(request, revision, bundleDigest);
  const candidatePositionSet = buildShiftPlanningCandidatePositionSet({
    candidateId: request.bundleId,
    bundleRevision: revision,
    bundleDigest,
    writeEpoch: activationWriteEpoch,
    delivery,
    market,
  });
  const forwardManifestDigest = createShiftPlanningDigest(forwardManifest);
  const inverseManifestDigest = createShiftPlanningDigest(inverseManifest);
  const persistedChain = resolvePersistedPlanningChain({
    request,
    revision,
    digest: bundleDigest,
    expectedStateDigest,
    positionManifest: candidatePositionSet.manifest,
    persistedPreview: input.persistedPreview,
    stagedCandidate: input.stagedCandidate,
  });
  const commands = syncCommands({
    revision,
    digest: bundleDigest,
    writeEpoch: activationWriteEpoch,
    request,
    snapshot,
    delivery,
    market,
  });
  const intents = heldNotificationIntents({
    recipients,
    revision,
    digest: bundleDigest,
    writeEpoch: activationWriteEpoch,
  });
  const releaseLeaseIntents = leaseIntentTemplates.map((intent) => ({
    ...intent,
    bundleRevision: revision,
    bundleDigest,
  })) as [
    ShiftPlanningReleaseLeaseIntent,
    ShiftPlanningReleaseLeaseIntent,
  ];

  return {
    schemaVersion: SHIFT_PLANNING_BUNDLE_SCHEMA_VERSION,
    requestId: request.requestId,
    mode: request.mode,
    bundleId: request.bundleId,
    environment: request.environment,
    bundleRevision: revision,
    bundleDigest,
    expectedWriteEpoch: request.expectedWriteEpoch,
    activationWriteEpoch,
    expectedActiveRevision: request.expectedActiveRevision,
    expectedState,
    frontiers,
    delivery,
    market,
    manifests: {
      forward: forwardManifest,
      inverse: inverseManifest,
    },
    budgets,
    releaseLeaseIntents,
    syncCommands: commands,
    heldNotificationIntents: intents,
    transactionRequirements: {
      writeLimit,
      byteLimit: SHIFT_PLANNING_FIRESTORE_TRANSACTION_BYTE_LIMIT,
      forwardManifestDigest,
      inverseManifestDigest,
    },
    stagedCandidate: persistedChain.stagedCandidate,
    stagedCandidateDigest: persistedChain.stagedCandidateDigest,
    previewReceipt: persistedChain.previewReceipt,
    previewReceiptDigest: persistedChain.previewReceiptDigest,
  };
};
