import {
  DEVELOP_CAPTURE_CONTROL_REVISION,
  DEVELOP_CAPTURE_ROUTES,
  developCaptureControlDigest,
  parseShiftPlanningDevelopCaptureControl,
  ShiftPlanningDevelopCaptureControl,
} from "./shift-planning-develop-capture-control.js";
import {
  ShiftPlanningError,
} from "./shift-planning-contract.js";
import {
  canonicalShiftPlanningJson,
  createShiftPlanningDigest,
  ShiftPlanningDigest,
} from "./shift-planning-digest.js";
import {
  ShiftPlanningMaintenanceCas,
  ShiftPlanningMaintenanceTransitionRecord,
  ShiftPlanningMaintenanceTransitionResult,
  ShiftPlanningStatePersistence,
} from "./shift-planning-state-persistence.js";
import {
  SHIFT_PLANNING_AFFECTED_WRITERS,
  SHIFT_PLANNING_INTAKE_BARRIER_WRITERS,
  SHIFT_PLANNING_RULES_DENIED_WRITER_IDS,
  SHIFT_PLANNING_OWNER_AGREEMENT_WRITERS,
  SHIFT_PLANNING_OWNER_AGREEMENT_INTAKE_WRITERS,
  SHIFT_PLANNING_OWNER_AGREEMENT_INVENTORY_REVISION,
  SHIFT_PLANNING_OWNER_AGREEMENT_INVENTORY_DIGEST,
  SHIFT_PLANNING_OWNER_AGREEMENT_OWNER_WRITER_ID,
  SHIFT_PLANNING_ADMINISTRATOR_AGREEMENT_WRITERS,
  SHIFT_PLANNING_ADMINISTRATOR_AGREEMENT_INTAKE_WRITERS,
  SHIFT_PLANNING_ADMINISTRATOR_AGREEMENT_INVENTORY_REVISION,
  SHIFT_PLANNING_ADMINISTRATOR_AGREEMENT_INVENTORY_DIGEST,
  SHIFT_PLANNING_ADMINISTRATOR_AGREEMENT_WRITER_ID,
  SHIFT_PLANNING_WRITER_INVENTORY_DIGEST,
  SHIFT_PLANNING_WRITER_INVENTORY_REVISION,
  ShiftPlanningWriterControlState,
} from "./shift-planning-writer-inventory.js";
import {
  ShiftPlanningEnvironment,
  ShiftPlanningIntakeBarrier,
} from "./shift-planning-wire.js";

import {
  parseShiftPlanningOwnerMaintenanceAgreement,
  assertShiftPlanningOwnerMaintenanceObservation,
  ShiftPlanningOwnerMaintenanceAgreement,
} from "./shift-planning-owner-maintenance.js";
import {
  parseShiftPlanningAdministratorMaintenanceAgreement,
  assertShiftPlanningAdministratorMaintenanceObservation,
  ShiftPlanningAdministratorMaintenanceAgreement,
} from "./shift-planning-administrator-maintenance.js";

export type ShiftPlanningOwnerAgreementMode = {
  schemaVersion: 2;
  maintenanceMode: "owner-agreement";
  expectedOwnerAgreementDigest: ShiftPlanningDigest;
  expectedTechnicalControlManifestDigest: ShiftPlanningDigest;
};
export type ShiftPlanningAdministratorAgreementMode = Omit<
  ShiftPlanningOwnerAgreementMode, "schemaVersion" | "maintenanceMode"
> & {
  schemaVersion: 3;
  maintenanceMode: "develop-administrator-agreement";
  expectedAdministratorAgreementDigest: ShiftPlanningDigest;
  expectedAdministratorSourceRevision: string;
  expectedAdministratorSourceDigest: ShiftPlanningDigest;
  expectedEffectiveIamDigest: ShiftPlanningDigest;
};
type ShiftPlanningStrictMode = {
  schemaVersion?: never;
  maintenanceMode?: never;
  expectedOwnerAgreementDigest?: never;
  expectedTechnicalControlManifestDigest?: never;
};
type MaintenanceMode =
  ShiftPlanningStrictMode | ShiftPlanningOwnerAgreementMode |
  ShiftPlanningAdministratorAgreementMode;
type PolicyVersion = 1 | 2 | 3;
const inventoryFor = (version: PolicyVersion) => version === 3 ? {
  revision: SHIFT_PLANNING_ADMINISTRATOR_AGREEMENT_INVENTORY_REVISION,
  digest: SHIFT_PLANNING_ADMINISTRATOR_AGREEMENT_INVENTORY_DIGEST,
  writers: SHIFT_PLANNING_ADMINISTRATOR_AGREEMENT_WRITERS,
  intake: SHIFT_PLANNING_ADMINISTRATOR_AGREEMENT_INTAKE_WRITERS,
} : version === 2 ? {
  revision: SHIFT_PLANNING_OWNER_AGREEMENT_INVENTORY_REVISION,
  digest: SHIFT_PLANNING_OWNER_AGREEMENT_INVENTORY_DIGEST,
  writers: SHIFT_PLANNING_OWNER_AGREEMENT_WRITERS,
  intake: SHIFT_PLANNING_OWNER_AGREEMENT_INTAKE_WRITERS,
} : {revision: SHIFT_PLANNING_WRITER_INVENTORY_REVISION,
  digest: SHIFT_PLANNING_WRITER_INVENTORY_DIGEST,
  writers: SHIFT_PLANNING_AFFECTED_WRITERS,
  intake: SHIFT_PLANNING_INTAKE_BARRIER_WRITERS};
const versionOf = (value: {schemaVersion?: number}): PolicyVersion =>
  value.schemaVersion === 3 ? 3 : value.schemaVersion === 2 ? 2 : 1;

export const SHIFT_PLANNING_INTAKE_BARRIER_SCHEMA_VERSION = 1 as const;

type UnknownRecord = Record<string, unknown>;

export type ShiftPlanningBarrierTransitionBinding = {
  transitionId: string;
  expectedAuthoritativeDigest: ShiftPlanningDigest;
  expectedStateRevision: number;
  expectedWriteEpoch: number;
  expectedActiveRevision: string | null;
  expectedActiveDigest: ShiftPlanningDigest | null;
};

export type ShiftPlanningBarrierInventoryBinding = {
  revision: typeof SHIFT_PLANNING_WRITER_INVENTORY_REVISION |
    typeof SHIFT_PLANNING_OWNER_AGREEMENT_INVENTORY_REVISION |
    typeof SHIFT_PLANNING_ADMINISTRATOR_AGREEMENT_INVENTORY_REVISION;
  digest: ShiftPlanningDigest;
};

export type ShiftPlanningBarrierPolicy = {
  minimumQuietHorizonMillis: number;
  maximumEvidenceAgeMillis: number;
};

export type ShiftPlanningRulesBarrierEvidence = {
  deployedRevision: string;
  deployedDigest: ShiftPlanningDigest;
  initialReadBackRevision: string;
  initialReadBackDigest: ShiftPlanningDigest;
  finalReadBackRevision: string;
  finalReadBackDigest: ShiftPlanningDigest;
  deniedWriterIds: readonly string[];
  closedAtMillis: number;
  initialReadBackAtMillis: number;
  finalReadBackAtMillis: number;
};

export type ShiftPlanningWriterControlEvidence = {
  writerId: string;
  state: ShiftPlanningWriterControlState | "capture-only";
  developCapture?: ShiftPlanningDevelopCaptureControl;
  controlRevision: string;
  controlDigest: ShiftPlanningDigest;
  initialReadBackRevision: string;
  initialReadBackDigest: ShiftPlanningDigest;
  finalReadBackRevision: string;
  finalReadBackDigest: ShiftPlanningDigest;
  closedAtMillis: number;
  initialReadBackAtMillis: number;
  finalReadBackAtMillis: number;
  pendingWorkCount: number;
  inFlightWorkCount: number;
};

export type ShiftPlanningCausalDrainEvidence = {
  acceptedSetRevision: string;
  acceptedSetDigest: ShiftPlanningDigest;
  capturedAtMillis: number;
  drainedAtMillis: number;
  initialPendingWorkCount: number;
  initialInFlightWorkCount: number;
  initialPendingDeliveryCount: number;
  initialInFlightDeliveryCount: number;
  initialQueueReadBackAtMillis: number;
  finalPendingWorkCount: number;
  finalInFlightWorkCount: number;
  finalPendingDeliveryCount: number;
  finalInFlightDeliveryCount: number;
  finalQueueReadBackAtMillis: number;
};

export type ShiftPlanningWorkbookBarrierEvidence = {
  fileId: string;
  revision: string;
  digest: ShiftPlanningDigest;
  readBackRevision: string;
  readBackDigest: ShiftPlanningDigest;
  pendingOfflineEditorCount: number;
  capturedAtMillis: number;
  readBackAtMillis: number;
};

export type ShiftPlanningQuietHorizonEvidence = {
  startedAtMillis: number;
  endedAtMillis: number;
  firestoreMutationCount: number;
  workbookMutationCount: number;
  deliveryMutationCount: number;
};

type IntakeBarrierEvidenceCommon = {
  environment: ShiftPlanningEnvironment;
  barrierRevision: string;
  transition: ShiftPlanningBarrierTransitionBinding;
  writerInventory: ShiftPlanningBarrierInventoryBinding;
  policy: ShiftPlanningBarrierPolicy;
  rules: ShiftPlanningRulesBarrierEvidence;
  writerControls: readonly ShiftPlanningWriterControlEvidence[];
  causalDrain: ShiftPlanningCausalDrainEvidence;
  workbook: ShiftPlanningWorkbookBarrierEvidence;
  quietHorizon: ShiftPlanningQuietHorizonEvidence;
  verifiedAtMillis: number;
};
export type ShiftPlanningIntakeBarrierEvidencePayload =
  IntakeBarrierEvidenceCommon & ({
    schemaVersion: 1;
    maintenanceMode?: never;
    ownerAgreement?: never;
    ownerObservation?: never;
  } | {
    schemaVersion: 2;
    maintenanceMode: "owner-agreement";
    ownerAgreement: ShiftPlanningOwnerMaintenanceAgreement;
    ownerObservation: unknown;
  } | {
    schemaVersion: 3;
    maintenanceMode: "develop-administrator-agreement";
    ownerAgreement: ShiftPlanningOwnerMaintenanceAgreement;
    ownerObservation: unknown;
    administratorAgreement: ShiftPlanningAdministratorMaintenanceAgreement;
    administratorObservation: unknown;
  });

export type ShiftPlanningIntakeBarrierEvidenceEnvelope = {
  payload: ShiftPlanningIntakeBarrierEvidencePayload;
  digest: ShiftPlanningDigest;
};

export type VerifiedShiftPlanningIntakeBarrier = {
  barrier: ShiftPlanningIntakeBarrier;
  expiresAtMillis: number;
  evidence: ShiftPlanningIntakeBarrierEvidenceEnvelope;
};

export type ShiftPlanningIntakeBarrierEvidenceKey = {
  environment: ShiftPlanningEnvironment;
  transitionId: string;
};

export type ShiftPlanningIntakeBarrierEvidenceRetentionRequest =
  ShiftPlanningIntakeBarrierEvidenceKey & {
  evidence: ShiftPlanningIntakeBarrierEvidenceEnvelope;
};

export type ShiftPlanningMaintenanceEntryRequest =
  ShiftPlanningMaintenanceCas & MaintenanceMode & {
    expectedBarrierRevision: string;
    expectedRulesRevision: string;
    expectedRulesDigest: ShiftPlanningDigest;
    expectedControlManifestDigest: ShiftPlanningDigest;
    expectedWorkbookFileId: string;
    expectedWorkbookRevision: string;
    expectedWorkbookDigest: ShiftPlanningDigest;
    expectedCausalSetRevision: string;
    expectedCausalSetDigest: ShiftPlanningDigest;
    minimumQuietHorizonMillis: number;
    maximumEvidenceAgeMillis: number;
  };

export type ShiftPlanningClosedBarrierScope = MaintenanceMode & {
  environment: ShiftPlanningEnvironment;
  transitionId: string;
  expectedAuthoritativeDigest: string;
  expectedStateRevision: number;
  expectedWriteEpoch: number;
  expectedActiveRevision: string | null;
  expectedActiveDigest: string | null;
  expectedBarrierRevision: string;
  expectedRulesRevision: string;
  expectedRulesDigest: ShiftPlanningDigest;
  expectedControlManifestDigest: ShiftPlanningDigest;
  expectedWorkbookFileId: string;
  expectedWorkbookRevision: string;
  expectedWorkbookDigest: ShiftPlanningDigest;
  expectedCausalSetRevision: string;
  expectedCausalSetDigest: ShiftPlanningDigest;
  minimumQuietHorizonMillis: number;
  maximumEvidenceAgeMillis: number;
  writerInventoryRevision: typeof SHIFT_PLANNING_WRITER_INVENTORY_REVISION |
    typeof SHIFT_PLANNING_OWNER_AGREEMENT_INVENTORY_REVISION |
    typeof SHIFT_PLANNING_ADMINISTRATOR_AGREEMENT_INVENTORY_REVISION;
  writerInventoryDigest: ShiftPlanningDigest;
};

/**
 * Trusted control-plane boundary for an already authorized and held checkpoint.
 * Before invoking this port, implementations close every manifested ingress,
 * collect and authorize the exact dynamic scope, and keep every fence held for
 * the whole callback. They must leave the fences closed when collection,
 * verification, retention, or the maintenance CAS fails. Reopening is a
 * separate governed transition and is intentionally absent from this port.
 */
export interface ShiftPlanningIntakeBarrierAdapter {
  withClosedIntakeBarrier<Result>(
    scope: ShiftPlanningClosedBarrierScope,
    operation: (evidence: unknown) => Promise<Result>,
  ): Promise<Result>;
  assertReadOnlyReplayAllowed?(
    scope: ShiftPlanningClosedBarrierScope,
  ): Promise<void>;
}

/**
 * Immutable evidence store keyed by `environment + transitionId`.
 * Implementations create when absent, return the existing full envelope for an
 * exact digest replay, and fail closed when that stable key already owns any
 * other digest. Every success includes an exact post-write/read-existing
 * read-back; retries must never depend on overwriting retained evidence.
 */
export interface ShiftPlanningIntakeBarrierEvidencePersistence {
  /** A terminal replay must read retained evidence without recreating it. */
  readExisting(
    key: ShiftPlanningIntakeBarrierEvidenceKey,
  ): Promise<unknown | null>;

  retainAndReadBack(
    request: ShiftPlanningIntakeBarrierEvidenceRetentionRequest,
  ): Promise<unknown>;
}

const payloadKeys = [
  "schemaVersion",
  "environment",
  "barrierRevision",
  "transition",
  "writerInventory",
  "policy",
  "rules",
  "writerControls",
  "causalDrain",
  "workbook",
  "quietHorizon",
  "verifiedAtMillis",
] as const;

const failBarrier = (message: string): never => {
  throw new ShiftPlanningError("maintenance_state_conflict", message);
};

const detachedCanonicalValue = (value: unknown, name: string): unknown => {
  try {
    return JSON.parse(canonicalShiftPlanningJson(value)) as unknown;
  } catch {
    return failBarrier(`${name} must contain canonical JSON data.`);
  }
};

const requireRecord = (value: unknown, name: string): UnknownRecord => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return failBarrier(`${name} must be a plain object.`);
  }
  return value as UnknownRecord;
};

const requireExactKeys = (
  value: UnknownRecord,
  keys: readonly string[],
  name: string,
): void => {
  const actual = Object.keys(value);
  if (
    actual.length !== keys.length ||
    actual.some((key) => !keys.includes(key))
  ) {
    failBarrier(`${name} fields are not exact.`);
  }
};

const requireArray = (value: unknown, name: string): unknown[] => {
  if (
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype
  ) {
    return failBarrier(`${name} must be a plain array.`);
  }
  return value;
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failBarrier(`${name} must be a canonical identifier.`);
  }
  return value;
};

const requireDigest = (value: unknown, name: string): ShiftPlanningDigest => {
  if (
    typeof value !== "string" ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return failBarrier(`${name} must be a shift-planning digest.`);
  }
  return value as ShiftPlanningDigest;
};

const requireNonNegativeInteger = (value: unknown, name: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return failBarrier(`${name} must be a non-negative safe integer.`);
  }
  return value as number;
};

const requirePositiveInteger = (value: unknown, name: string): number => {
  const parsed = requireNonNegativeInteger(value, name);
  if (parsed === 0) return failBarrier(`${name} must be positive.`);
  return parsed;
};

const requireEnvironment = (value: unknown): ShiftPlanningEnvironment => {
  if (value !== "develop" && value !== "production") {
    return failBarrier("Barrier environment is invalid.");
  }
  return value;
};

const requireNullableIdentifier = (
  value: unknown,
  name: string,
): string | null => value === null ? null : requireIdentifier(value, name);

const requireNullableDigest = (
  value: unknown,
  name: string,
): ShiftPlanningDigest | null => value === null ? null :
  requireDigest(value, name);

const maintenanceEntryRequestKeys = [
  "environment",
  "transitionId",
  "expectedAuthoritativeDigest",
  "expectedStateRevision",
  "expectedWriteEpoch",
  "expectedActiveRevision",
  "expectedActiveDigest",
  "expectedBarrierRevision",
  "expectedRulesRevision",
  "expectedRulesDigest",
  "expectedControlManifestDigest",
  "expectedWorkbookFileId",
  "expectedWorkbookRevision",
  "expectedWorkbookDigest",
  "expectedCausalSetRevision",
  "expectedCausalSetDigest",
  "minimumQuietHorizonMillis",
  "maximumEvidenceAgeMillis",
] as const;

const ownerMode = (value: UnknownRecord): ShiftPlanningOwnerAgreementMode => {
  if (value.schemaVersion !== 2 ||
      value.maintenanceMode !== "owner-agreement") {
    return failBarrier("Cooperative owner maintenance mode is not explicit.");
  }
  return {
    schemaVersion: 2, maintenanceMode: "owner-agreement",
    expectedOwnerAgreementDigest: requireDigest(
      value.expectedOwnerAgreementDigest, "owner agreement digest",
    ),
    expectedTechnicalControlManifestDigest: requireDigest(
      value.expectedTechnicalControlManifestDigest, "technical controls digest",
    ),
  };
};
const administratorMode = (
  value: UnknownRecord,
): ShiftPlanningAdministratorAgreementMode => {
  if (value.schemaVersion !== 3 || value.maintenanceMode !==
      "develop-administrator-agreement" || value.environment !== "develop") {
    return failBarrier("Administrator cooperation is explicit develop-only.");
  }
  return {...ownerMode({...value, schemaVersion: 2,
    maintenanceMode: "owner-agreement"}), schemaVersion: 3,
  maintenanceMode: "develop-administrator-agreement",
  expectedAdministratorAgreementDigest: requireDigest(
    value.expectedAdministratorAgreementDigest, "administrator agreement"),
  expectedAdministratorSourceRevision: requireIdentifier(
    value.expectedAdministratorSourceRevision, "administrator source revision"),
  expectedAdministratorSourceDigest: requireDigest(
    value.expectedAdministratorSourceDigest, "administrator source digest"),
  expectedEffectiveIamDigest: requireDigest(
    value.expectedEffectiveIamDigest, "effective IAM digest")};
};
const cooperativeKeys = ["schemaVersion", "maintenanceMode",
  "expectedOwnerAgreementDigest", "expectedTechnicalControlManifestDigest"];
const administratorKeys = ["expectedAdministratorAgreementDigest",
  "expectedAdministratorSourceRevision", "expectedAdministratorSourceDigest",
  "expectedEffectiveIamDigest"];

const normalizeMaintenanceEntryRequest = (
  value: ShiftPlanningMaintenanceEntryRequest,
): ShiftPlanningMaintenanceEntryRequest => {
  const command = requireRecord(
    detachedCanonicalValue(value, "maintenance entry request"),
    "maintenance entry request",
  );
  requireExactKeys(
    command,
    command.schemaVersion === 3 ? [...maintenanceEntryRequestKeys,
      ...cooperativeKeys, ...administratorKeys] : command.schemaVersion === 2 ?
      [...maintenanceEntryRequestKeys, ...cooperativeKeys] :
      maintenanceEntryRequestKeys,
    "maintenance entry request",
  );
  const expectedActiveRevision = requireNullableIdentifier(
    command.expectedActiveRevision,
    "expected active revision",
  );
  const expectedActiveDigest = requireNullableDigest(
    command.expectedActiveDigest,
    "expected active digest",
  );
  if ((expectedActiveRevision === null) !== (expectedActiveDigest === null)) {
    return failBarrier("Expected active lineage must change together.");
  }
  const mode = command.schemaVersion === 3 ? administratorMode(command) :
    command.schemaVersion === 2 ? ownerMode(command) : {};
  return Object.freeze({
    ...mode,
    environment: requireEnvironment(command.environment),
    transitionId: requireIdentifier(command.transitionId, "transitionId"),
    expectedAuthoritativeDigest: requireDigest(
      command.expectedAuthoritativeDigest,
      "expected authoritative digest",
    ),
    expectedStateRevision: requireNonNegativeInteger(
      command.expectedStateRevision,
      "expected state revision",
    ),
    expectedWriteEpoch: requireNonNegativeInteger(
      command.expectedWriteEpoch,
      "expected write epoch",
    ),
    expectedActiveRevision,
    expectedActiveDigest,
    expectedBarrierRevision: requireIdentifier(
      command.expectedBarrierRevision,
      "expected barrier revision",
    ),
    expectedRulesRevision: requireIdentifier(
      command.expectedRulesRevision,
      "expected Rules revision",
    ),
    expectedRulesDigest: requireDigest(
      command.expectedRulesDigest,
      "expected Rules digest",
    ),
    expectedControlManifestDigest: requireDigest(
      command.expectedControlManifestDigest,
      "expected control manifest digest",
    ),
    expectedWorkbookFileId: requireIdentifier(
      command.expectedWorkbookFileId,
      "expected workbook fileId",
    ),
    expectedWorkbookRevision: requireIdentifier(
      command.expectedWorkbookRevision,
      "expected workbook revision",
    ),
    expectedWorkbookDigest: requireDigest(
      command.expectedWorkbookDigest,
      "expected workbook digest",
    ),
    expectedCausalSetRevision: requireIdentifier(
      command.expectedCausalSetRevision,
      "expected causal set revision",
    ),
    expectedCausalSetDigest: requireDigest(
      command.expectedCausalSetDigest,
      "expected causal set digest",
    ),
    minimumQuietHorizonMillis: requirePositiveInteger(
      command.minimumQuietHorizonMillis,
      "minimum quiet horizon",
    ),
    maximumEvidenceAgeMillis: requirePositiveInteger(
      command.maximumEvidenceAgeMillis,
      "maximum evidence age",
    ),
  });
};

const parseTransition = (
  value: unknown,
): ShiftPlanningBarrierTransitionBinding => {
  const transition = requireRecord(value, "barrier transition");
  requireExactKeys(transition, [
    "transitionId",
    "expectedAuthoritativeDigest",
    "expectedStateRevision",
    "expectedWriteEpoch",
    "expectedActiveRevision",
    "expectedActiveDigest",
  ], "barrier transition");
  const expectedActiveRevision = requireNullableIdentifier(
    transition.expectedActiveRevision,
    "expected active revision",
  );
  const expectedActiveDigest = requireNullableDigest(
    transition.expectedActiveDigest,
    "expected active digest",
  );
  if ((expectedActiveRevision === null) !== (expectedActiveDigest === null)) {
    return failBarrier("Barrier active lineage must change together.");
  }
  return {
    transitionId: requireIdentifier(
      transition.transitionId,
      "barrier transitionId",
    ),
    expectedAuthoritativeDigest: requireDigest(
      transition.expectedAuthoritativeDigest,
      "expected authoritative digest",
    ),
    expectedStateRevision: requireNonNegativeInteger(
      transition.expectedStateRevision,
      "expected state revision",
    ),
    expectedWriteEpoch: requireNonNegativeInteger(
      transition.expectedWriteEpoch,
      "expected write epoch",
    ),
    expectedActiveRevision,
    expectedActiveDigest,
  };
};

const parseInventory = (
  value: unknown,
  version: PolicyVersion = 1,
): ShiftPlanningBarrierInventoryBinding => {
  const inventory = requireRecord(value, "writer inventory binding");
  requireExactKeys(
    inventory,
    ["revision", "digest"],
    "writer inventory binding",
  );
  const revision = requireIdentifier(
    inventory.revision,
    "writer inventory revision",
  );
  const digest = requireDigest(inventory.digest, "writer inventory digest");
  const {revision: expectedRevision, digest: expectedDigest} =
    inventoryFor(version);
  if (revision !== expectedRevision || digest !== expectedDigest) {
    return failBarrier("Writer inventory binding does not match the runtime.");
  }
  return {revision: expectedRevision, digest};
};

const parsePolicy = (value: unknown): ShiftPlanningBarrierPolicy => {
  const policy = requireRecord(value, "barrier policy");
  requireExactKeys(policy, [
    "minimumQuietHorizonMillis",
    "maximumEvidenceAgeMillis",
  ], "barrier policy");
  return {
    minimumQuietHorizonMillis: requirePositiveInteger(
      policy.minimumQuietHorizonMillis,
      "minimum quiet horizon",
    ),
    maximumEvidenceAgeMillis: requirePositiveInteger(
      policy.maximumEvidenceAgeMillis,
      "maximum evidence age",
    ),
  };
};

const parseStringSet = (
  value: unknown,
  name: string,
): string[] => {
  const parsed = requireArray(value, name).map((item) =>
    requireIdentifier(item, `${name} item`));
  if (new Set(parsed).size !== parsed.length) {
    return failBarrier(`${name} must not contain duplicates.`);
  }
  return parsed.sort();
};

const exactStringSet = (
  actual: readonly string[],
  expected: readonly string[],
): boolean =>
  actual.length === expected.length &&
  actual.every((item, index) => item === expected[index]);

const compareIdentifiers = (left: string, right: string): number => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

const parseRules = (value: unknown): ShiftPlanningRulesBarrierEvidence => {
  const rules = requireRecord(value, "Rules barrier evidence");
  requireExactKeys(rules, [
    "deployedRevision",
    "deployedDigest",
    "initialReadBackRevision",
    "initialReadBackDigest",
    "finalReadBackRevision",
    "finalReadBackDigest",
    "deniedWriterIds",
    "closedAtMillis",
    "initialReadBackAtMillis",
    "finalReadBackAtMillis",
  ], "Rules barrier evidence");
  const deployedRevision = requireIdentifier(
    rules.deployedRevision,
    "deployed Rules revision",
  );
  const deployedDigest = requireDigest(
    rules.deployedDigest,
    "deployed Rules digest",
  );
  const initialReadBackRevision = requireIdentifier(
    rules.initialReadBackRevision,
    "initial read-back Rules revision",
  );
  const initialReadBackDigest = requireDigest(
    rules.initialReadBackDigest,
    "initial read-back Rules digest",
  );
  const finalReadBackRevision = requireIdentifier(
    rules.finalReadBackRevision,
    "final read-back Rules revision",
  );
  const finalReadBackDigest = requireDigest(
    rules.finalReadBackDigest,
    "final read-back Rules digest",
  );
  const deniedWriterIds = parseStringSet(
    rules.deniedWriterIds,
    "Rules denied writers",
  );
  if (
    deployedRevision !== initialReadBackRevision ||
    deployedDigest !== initialReadBackDigest ||
    deployedRevision !== finalReadBackRevision ||
    deployedDigest !== finalReadBackDigest ||
    !exactStringSet(
      deniedWriterIds,
      SHIFT_PLANNING_RULES_DENIED_WRITER_IDS,
    )
  ) {
    return failBarrier("Rules deny deployment was not read back exactly.");
  }
  return {
    deployedRevision,
    deployedDigest,
    initialReadBackRevision,
    initialReadBackDigest,
    finalReadBackRevision,
    finalReadBackDigest,
    deniedWriterIds,
    closedAtMillis: requireNonNegativeInteger(
      rules.closedAtMillis,
      "Rules close instant",
    ),
    initialReadBackAtMillis: requireNonNegativeInteger(
      rules.initialReadBackAtMillis,
      "initial Rules read-back instant",
    ),
    finalReadBackAtMillis: requireNonNegativeInteger(
      rules.finalReadBackAtMillis,
      "final Rules read-back instant",
    ),
  };
};

const parseWriterControl = (
  value: unknown,
  version: PolicyVersion = 1,
): ShiftPlanningWriterControlEvidence => {
  const control = requireRecord(value, "writer control evidence");
  requireExactKeys(control, [
    "writerId",
    "state",
    "controlRevision",
    "controlDigest",
    "initialReadBackRevision",
    "initialReadBackDigest",
    "finalReadBackRevision",
    "finalReadBackDigest",
    "closedAtMillis",
    "initialReadBackAtMillis",
    "finalReadBackAtMillis",
    "pendingWorkCount",
    "inFlightWorkCount",
    ...(control.state === "capture-only" ? ["developCapture"] : []),
  ], "writer control evidence");
  const writerId = requireIdentifier(control.writerId, "writerId");
  const writer = inventoryFor(version).writers.find(
    (item) => item.writerId === writerId);
  if (!writer || writer.shutdownOrder === "activation-recheck") {
    return failBarrier(`Writer ${writerId} is not an intake-barrier writer.`);
  }
  const developCapture = control.state === "capture-only" ?
    parseShiftPlanningDevelopCaptureControl(control.developCapture, writerId) :
    undefined;
  if (developCapture && (control.controlRevision !==
      DEVELOP_CAPTURE_CONTROL_REVISION || control.controlDigest !==
      developCaptureControlDigest(developCapture))) {
    return failBarrier("Develop capture proof is not bound to its control.");
  }
  if (!developCapture && control.state !== writer.requiredState) {
    return failBarrier(`Writer ${writerId} is not in its required state.`);
  }
  const controlRevision = requireIdentifier(
    control.controlRevision,
    `writer ${writerId} control revision`,
  );
  const controlDigest = requireDigest(
    control.controlDigest,
    `writer ${writerId} control digest`,
  );
  const initialReadBackRevision = requireIdentifier(
    control.initialReadBackRevision,
    `writer ${writerId} initial read-back revision`,
  );
  const initialReadBackDigest = requireDigest(
    control.initialReadBackDigest,
    `writer ${writerId} initial read-back digest`,
  );
  const finalReadBackRevision = requireIdentifier(
    control.finalReadBackRevision,
    `writer ${writerId} final read-back revision`,
  );
  const finalReadBackDigest = requireDigest(
    control.finalReadBackDigest,
    `writer ${writerId} final read-back digest`,
  );
  if (
    controlRevision !== initialReadBackRevision ||
    controlDigest !== initialReadBackDigest ||
    controlRevision !== finalReadBackRevision ||
    controlDigest !== finalReadBackDigest
  ) {
    return failBarrier(`Writer ${writerId} control read-back drifted.`);
  }
  return {
    writerId,
    state: developCapture ? "capture-only" :
      control.state as ShiftPlanningWriterControlState,
    ...(developCapture ? {developCapture} : {}),
    controlRevision,
    controlDigest,
    initialReadBackRevision,
    initialReadBackDigest,
    finalReadBackRevision,
    finalReadBackDigest,
    closedAtMillis: requireNonNegativeInteger(
      control.closedAtMillis,
      `writer ${writerId} close instant`,
    ),
    initialReadBackAtMillis: requireNonNegativeInteger(
      control.initialReadBackAtMillis,
      `writer ${writerId} initial read-back instant`,
    ),
    finalReadBackAtMillis: requireNonNegativeInteger(
      control.finalReadBackAtMillis,
      `writer ${writerId} final read-back instant`,
    ),
    pendingWorkCount: requireNonNegativeInteger(
      control.pendingWorkCount,
      `writer ${writerId} pending work`,
    ),
    inFlightWorkCount: requireNonNegativeInteger(
      control.inFlightWorkCount,
      `writer ${writerId} in-flight work`,
    ),
  };
};

const parseWriterControls = (
  value: unknown,
  rules: ShiftPlanningRulesBarrierEvidence,
  version: PolicyVersion = 1,
): ShiftPlanningWriterControlEvidence[] => {
  const controls = requireArray(value, "writer controls")
    .map((control) => parseWriterControl(control, version))
    .sort((left, right) => compareIdentifiers(left.writerId, right.writerId));
  const expectedWriterIds = inventoryFor(version).intake
    .map((writer) => writer.writerId)
    .sort();
  const actualWriterIds = controls.map((control) => control.writerId);
  if (!exactStringSet(actualWriterIds, expectedWriterIds)) {
    return failBarrier("Writer controls do not match the complete inventory.");
  }
  for (const control of controls) {
    if (control.pendingWorkCount !== 0 || control.inFlightWorkCount !== 0) {
      return failBarrier(`Writer ${control.writerId} is not drained.`);
    }
    if (
      SHIFT_PLANNING_RULES_DENIED_WRITER_IDS.includes(control.writerId) &&
      (
        control.controlRevision !== rules.finalReadBackRevision ||
        control.controlDigest !== rules.finalReadBackDigest
      )
    ) {
      return failBarrier(
        `Writer ${control.writerId} is not bound to the Rules read-back.`,
      );
    }
  }
  return controls;
};

/**
 * Digests exact authorized controls independently of observation times.
 * @param {ShiftPlanningWriterControlEvidence[]} controls Controls.
 * @param {string} mode Explicit cooperative inventory when selected.
 * @return {ShiftPlanningDigest} Canonical control-manifest digest.
 */
export const createShiftPlanningControlManifestDigest = (
  controls: readonly ShiftPlanningWriterControlEvidence[],
  mode?: "owner-agreement" | "develop-administrator-agreement",
): ShiftPlanningDigest => createShiftPlanningDigest({
  schemaVersion: SHIFT_PLANNING_INTAKE_BARRIER_SCHEMA_VERSION,
  writerInventoryRevision: inventoryFor(mode ===
    "develop-administrator-agreement" ? 3 : mode === "owner-agreement" ? 2 : 1)
    .revision,
  controls: controls
    .map((control) => ({
      writerId: control.writerId,
      state: control.state,
      controlRevision: control.controlRevision,
      controlDigest: control.controlDigest,
    }))
    .sort((left, right) => compareIdentifiers(left.writerId, right.writerId)),
});

const parseCausalDrain = (
  value: unknown,
): ShiftPlanningCausalDrainEvidence => {
  const drain = requireRecord(value, "causal drain evidence");
  requireExactKeys(drain, [
    "acceptedSetRevision",
    "acceptedSetDigest",
    "capturedAtMillis",
    "drainedAtMillis",
    "initialPendingWorkCount",
    "initialInFlightWorkCount",
    "initialPendingDeliveryCount",
    "initialInFlightDeliveryCount",
    "initialQueueReadBackAtMillis",
    "finalPendingWorkCount",
    "finalInFlightWorkCount",
    "finalPendingDeliveryCount",
    "finalInFlightDeliveryCount",
    "finalQueueReadBackAtMillis",
  ], "causal drain evidence");
  const parsed = {
    acceptedSetRevision: requireIdentifier(
      drain.acceptedSetRevision,
      "accepted causal set revision",
    ),
    acceptedSetDigest: requireDigest(
      drain.acceptedSetDigest,
      "accepted causal set digest",
    ),
    capturedAtMillis: requireNonNegativeInteger(
      drain.capturedAtMillis,
      "causal capture instant",
    ),
    drainedAtMillis: requireNonNegativeInteger(
      drain.drainedAtMillis,
      "causal drain instant",
    ),
    initialPendingWorkCount: requireNonNegativeInteger(
      drain.initialPendingWorkCount,
      "initial pending causal work",
    ),
    initialInFlightWorkCount: requireNonNegativeInteger(
      drain.initialInFlightWorkCount,
      "initial in-flight causal work",
    ),
    initialPendingDeliveryCount: requireNonNegativeInteger(
      drain.initialPendingDeliveryCount,
      "initial pending deliveries",
    ),
    initialInFlightDeliveryCount: requireNonNegativeInteger(
      drain.initialInFlightDeliveryCount,
      "initial in-flight deliveries",
    ),
    initialQueueReadBackAtMillis: requireNonNegativeInteger(
      drain.initialQueueReadBackAtMillis,
      "initial queue read-back instant",
    ),
    finalPendingWorkCount: requireNonNegativeInteger(
      drain.finalPendingWorkCount,
      "final pending causal work",
    ),
    finalInFlightWorkCount: requireNonNegativeInteger(
      drain.finalInFlightWorkCount,
      "final in-flight causal work",
    ),
    finalPendingDeliveryCount: requireNonNegativeInteger(
      drain.finalPendingDeliveryCount,
      "final pending deliveries",
    ),
    finalInFlightDeliveryCount: requireNonNegativeInteger(
      drain.finalInFlightDeliveryCount,
      "final in-flight deliveries",
    ),
    finalQueueReadBackAtMillis: requireNonNegativeInteger(
      drain.finalQueueReadBackAtMillis,
      "final queue read-back instant",
    ),
  };
  if (
    parsed.initialPendingWorkCount !== 0 ||
    parsed.initialInFlightWorkCount !== 0 ||
    parsed.initialPendingDeliveryCount !== 0 ||
    parsed.initialInFlightDeliveryCount !== 0 ||
    parsed.finalPendingWorkCount !== 0 ||
    parsed.finalInFlightWorkCount !== 0 ||
    parsed.finalPendingDeliveryCount !== 0 ||
    parsed.finalInFlightDeliveryCount !== 0
  ) {
    return failBarrier("Causal work and delivery queues must be empty.");
  }
  return parsed;
};

const parseWorkbook = (
  value: unknown,
): ShiftPlanningWorkbookBarrierEvidence => {
  const workbook = requireRecord(value, "workbook barrier evidence");
  requireExactKeys(workbook, [
    "fileId",
    "revision",
    "digest",
    "readBackRevision",
    "readBackDigest",
    "pendingOfflineEditorCount",
    "capturedAtMillis",
    "readBackAtMillis",
  ], "workbook barrier evidence");
  const revision = requireIdentifier(workbook.revision, "workbook revision");
  const digest = requireDigest(workbook.digest, "workbook digest");
  const readBackRevision = requireIdentifier(
    workbook.readBackRevision,
    "workbook read-back revision",
  );
  const readBackDigest = requireDigest(
    workbook.readBackDigest,
    "workbook read-back digest",
  );
  const pendingOfflineEditorCount = requireNonNegativeInteger(
    workbook.pendingOfflineEditorCount,
    "pending offline workbook editors",
  );
  if (
    revision !== readBackRevision ||
    digest !== readBackDigest ||
    pendingOfflineEditorCount !== 0
  ) {
    return failBarrier("Workbook content or offline-editor state drifted.");
  }
  return {
    fileId: requireIdentifier(workbook.fileId, "workbook fileId"),
    revision,
    digest,
    readBackRevision,
    readBackDigest,
    pendingOfflineEditorCount,
    capturedAtMillis: requireNonNegativeInteger(
      workbook.capturedAtMillis,
      "workbook capture instant",
    ),
    readBackAtMillis: requireNonNegativeInteger(
      workbook.readBackAtMillis,
      "workbook read-back instant",
    ),
  };
};

const parseQuietHorizon = (
  value: unknown,
): ShiftPlanningQuietHorizonEvidence => {
  const horizon = requireRecord(value, "quiet horizon evidence");
  requireExactKeys(horizon, [
    "startedAtMillis",
    "endedAtMillis",
    "firestoreMutationCount",
    "workbookMutationCount",
    "deliveryMutationCount",
  ], "quiet horizon evidence");
  const parsed = {
    startedAtMillis: requireNonNegativeInteger(
      horizon.startedAtMillis,
      "quiet horizon start",
    ),
    endedAtMillis: requireNonNegativeInteger(
      horizon.endedAtMillis,
      "quiet horizon end",
    ),
    firestoreMutationCount: requireNonNegativeInteger(
      horizon.firestoreMutationCount,
      "quiet Firestore mutations",
    ),
    workbookMutationCount: requireNonNegativeInteger(
      horizon.workbookMutationCount,
      "quiet workbook mutations",
    ),
    deliveryMutationCount: requireNonNegativeInteger(
      horizon.deliveryMutationCount,
      "quiet delivery mutations",
    ),
  };
  if (
    parsed.firestoreMutationCount !== 0 ||
    parsed.workbookMutationCount !== 0 ||
    parsed.deliveryMutationCount !== 0
  ) {
    return failBarrier("Quiet horizon contains affected mutations.");
  }
  return parsed;
};

const sameNullable = (
  left: string | null,
  right: string | null,
): boolean => left === right;

const validateCommandBinding = (
  payload: ShiftPlanningIntakeBarrierEvidencePayload,
  command: ShiftPlanningMaintenanceEntryRequest,
): void => {
  const transition = payload.transition;
  if (payload.schemaVersion !== 1) {
    if (command.schemaVersion !== payload.schemaVersion ||
        payload.ownerAgreement.digest !==
          command.expectedOwnerAgreementDigest ||
        createShiftPlanningControlManifestDigest(payload.writerControls.filter(
          (control) => control.writerId !==
            SHIFT_PLANNING_OWNER_AGREEMENT_OWNER_WRITER_ID &&
            control.writerId !==
              SHIFT_PLANNING_ADMINISTRATOR_AGREEMENT_WRITER_ID,
        ), payload.maintenanceMode) !==
          command.expectedTechnicalControlManifestDigest ||
        payload.writerControls.find((control) => control.writerId ===
          SHIFT_PLANNING_OWNER_AGREEMENT_OWNER_WRITER_ID)?.controlDigest !==
          payload.ownerAgreement.digest) {
      failBarrier("Owner agreement does not bind its operation controls.");
    }
    if (payload.schemaVersion === 3 && (command.schemaVersion !== 3 ||
        payload.administratorAgreement.digest !==
          command.expectedAdministratorAgreementDigest ||
        payload.writerControls.find((control) => control.writerId ===
          SHIFT_PLANNING_ADMINISTRATOR_AGREEMENT_WRITER_ID)?.controlDigest !==
          payload.administratorAgreement.digest)) {
      failBarrier("Administrator agreement does not bind its controls.");
    }
    if (payload.schemaVersion === 3) {
      const administrator = payload.writerControls.find((control) =>
        control.writerId === SHIFT_PLANNING_ADMINISTRATOR_AGREEMENT_WRITER_ID);
      const observed = requireRecord(payload.administratorObservation,
        "historical administrator observation");
      if (!administrator || payload.administratorAgreement.payload.confirmations
        .some((confirmation) => confirmation.confirmedAtMillis >
          administrator.closedAtMillis) ||
        requireNonNegativeInteger(observed.observedAtMillis,
          "administrator observation time") > payload.verifiedAtMillis) {
        failBarrier("Administrator agreement was not recorded before capture.");
      }
    }
  } else if (command.schemaVersion !== undefined) {
    failBarrier("Strict evidence cannot authorize cooperative maintenance.");
  }
  if (
    payload.environment !== command.environment ||
    payload.barrierRevision !== command.expectedBarrierRevision ||
    transition.transitionId !== command.transitionId ||
    transition.expectedAuthoritativeDigest !==
      command.expectedAuthoritativeDigest ||
    transition.expectedStateRevision !== command.expectedStateRevision ||
    transition.expectedWriteEpoch !== command.expectedWriteEpoch ||
    !sameNullable(
      transition.expectedActiveRevision,
      command.expectedActiveRevision,
    ) ||
    !sameNullable(
      transition.expectedActiveDigest,
      command.expectedActiveDigest,
    ) ||
    payload.rules.finalReadBackRevision !== command.expectedRulesRevision ||
    payload.rules.finalReadBackDigest !== command.expectedRulesDigest ||
    createShiftPlanningControlManifestDigest(payload.writerControls,
      payload.maintenanceMode) !==
      command.expectedControlManifestDigest ||
    payload.workbook.fileId !== command.expectedWorkbookFileId ||
    payload.workbook.revision !== command.expectedWorkbookRevision ||
    payload.workbook.digest !== command.expectedWorkbookDigest ||
    payload.causalDrain.acceptedSetRevision !==
      command.expectedCausalSetRevision ||
    payload.causalDrain.acceptedSetDigest !==
      command.expectedCausalSetDigest ||
    payload.policy.minimumQuietHorizonMillis !==
      command.minimumQuietHorizonMillis ||
    payload.policy.maximumEvidenceAgeMillis !==
      command.maximumEvidenceAgeMillis
  ) {
    failBarrier("Barrier evidence does not bind the maintenance command.");
  }
};

const validateChronology = (
  payload: ShiftPlanningIntakeBarrierEvidencePayload,
  nowMillis: number,
  requireFreshness: boolean,
): void => {
  const {causalDrain, quietHorizon, rules, workbook} = payload;
  const oldestFinalObservation = oldestBarrierObservationMillis(payload);
  if (
    oldestFinalObservation >
      Number.MAX_SAFE_INTEGER - payload.policy.maximumEvidenceAgeMillis
  ) {
    return failBarrier("Barrier evidence expiry is not representable.");
  }
  const expiresAtMillis = oldestFinalObservation +
    payload.policy.maximumEvidenceAgeMillis;
  if (
    rules.closedAtMillis > rules.initialReadBackAtMillis ||
    rules.initialReadBackAtMillis > causalDrain.capturedAtMillis ||
    causalDrain.capturedAtMillis > causalDrain.drainedAtMillis ||
    causalDrain.drainedAtMillis >
      causalDrain.initialQueueReadBackAtMillis ||
    causalDrain.initialQueueReadBackAtMillis > workbook.capturedAtMillis ||
    workbook.capturedAtMillis > quietHorizon.startedAtMillis ||
    quietHorizon.startedAtMillis > quietHorizon.endedAtMillis ||
    quietHorizon.endedAtMillis > payload.verifiedAtMillis ||
    causalDrain.finalQueueReadBackAtMillis < quietHorizon.endedAtMillis ||
    causalDrain.finalQueueReadBackAtMillis > payload.verifiedAtMillis ||
    rules.finalReadBackAtMillis < quietHorizon.endedAtMillis ||
    workbook.readBackAtMillis < quietHorizon.endedAtMillis ||
    rules.finalReadBackAtMillis > payload.verifiedAtMillis ||
    workbook.readBackAtMillis > payload.verifiedAtMillis ||
    payload.verifiedAtMillis > nowMillis ||
    payload.verifiedAtMillis > expiresAtMillis ||
    (requireFreshness && nowMillis > expiresAtMillis) ||
    quietHorizon.endedAtMillis - quietHorizon.startedAtMillis <
      payload.policy.minimumQuietHorizonMillis
  ) {
    failBarrier("Barrier evidence chronology is invalid or stale.");
  }
  for (const control of payload.writerControls) {
    const writer = inventoryFor(versionOf(payload)).writers.find((item) =>
      item.writerId === control.writerId);
    if (!writer) {
      return failBarrier("Barrier writer disappeared from inventory.");
    }
    const closureHasExpectedOrder =
      writer.shutdownOrder === "before-causal-capture" ?
        control.initialReadBackAtMillis <= causalDrain.capturedAtMillis :
        control.closedAtMillis >= causalDrain.drainedAtMillis &&
          control.initialReadBackAtMillis <=
            causalDrain.initialQueueReadBackAtMillis;
    if (
      !closureHasExpectedOrder ||
      control.closedAtMillis > control.initialReadBackAtMillis ||
      control.closedAtMillis > quietHorizon.startedAtMillis ||
      control.finalReadBackAtMillis < quietHorizon.endedAtMillis ||
      control.finalReadBackAtMillis > payload.verifiedAtMillis
    ) {
      failBarrier(`Writer ${control.writerId} has invalid control chronology.`);
    }
  }
};

const oldestBarrierObservationMillis = (
  payload: ShiftPlanningIntakeBarrierEvidencePayload,
): number => Math.min(
  payload.quietHorizon.endedAtMillis,
  payload.causalDrain.finalQueueReadBackAtMillis,
  payload.rules.finalReadBackAtMillis,
  payload.workbook.readBackAtMillis,
  ...payload.writerControls.map(
    (control) => control.finalReadBackAtMillis,
  ),
);

const barrierEvidenceExpiresAtMillis = (
  payload: ShiftPlanningIntakeBarrierEvidencePayload,
): number => Math.min(
  oldestBarrierObservationMillis(payload) +
    payload.policy.maximumEvidenceAgeMillis,
  payload.schemaVersion !== 1 ?
    payload.ownerAgreement.payload.intent.endsAtMillis :
    Number.MAX_SAFE_INTEGER,
  payload.schemaVersion === 3 ?
    payload.administratorAgreement.payload.intent.endsAtMillis :
    Number.MAX_SAFE_INTEGER,
);

const parsePayload = (
  value: unknown,
  version: PolicyVersion = 1,
): ShiftPlanningIntakeBarrierEvidencePayload => {
  const payload = requireRecord(value, "intake barrier payload");
  const cooperative = version !== 1;
  requireExactKeys(payload, cooperative ? [...payloadKeys, "maintenanceMode",
    "ownerAgreement", "ownerObservation", ...(version === 3 ?
      ["administratorAgreement", "administratorObservation"] : [])] :
    payloadKeys,
  "intake barrier payload");
  if (payload.schemaVersion !== version ||
      (cooperative && payload.maintenanceMode !== (version === 3 ?
        "develop-administrator-agreement" : "owner-agreement")) ||
      (version === 3 && payload.environment !== "develop")) {
    return failBarrier("Intake barrier schema version is unsupported.");
  }
  const rules = parseRules(payload.rules);
  const writerControls = parseWriterControls(payload.writerControls, rules,
    version);
  const captures = writerControls.filter((control) => control.developCapture);
  if (captures.length && (payload.environment !== "develop" ||
      !exactStringSet(captures.map((control) => control.writerId).sort(),
        DEVELOP_CAPTURE_ROUTES.map((route) => route[0]).sort()) ||
      new Set(captures.map((control) => control.developCapture?.projectId))
        .size !== 1)) {
    return failBarrier("Develop capture needs all four exact source routes.");
  }
  if (captures.length && version === 3) {
    const agreement = parseShiftPlanningAdministratorMaintenanceAgreement(
      payload.administratorAgreement);
    if (captures.some((control) => control.developCapture?.projectId !==
        agreement.payload.intent.projectId)) {
      return failBarrier("Capture and administrator project bindings differ.");
    }
  }
  return {
    ...(cooperative ? {
      ...(version === 3 ? {schemaVersion: 3 as const,
        maintenanceMode: "develop-administrator-agreement" as const,
        administratorAgreement:
          parseShiftPlanningAdministratorMaintenanceAgreement(
            payload.administratorAgreement),
        administratorObservation: detachedCanonicalValue(
          payload.administratorObservation, "administrator observation"),
      } : {schemaVersion: 2 as const,
        maintenanceMode: "owner-agreement" as const}),
      ownerAgreement: parseShiftPlanningOwnerMaintenanceAgreement(
        payload.ownerAgreement,
      ),
      ownerObservation: detachedCanonicalValue(
        payload.ownerObservation, "owner observation",
      ),
    } : {schemaVersion: 1 as const}),
    environment: requireEnvironment(payload.environment),
    barrierRevision: requireIdentifier(
      payload.barrierRevision,
      "barrier revision",
    ),
    transition: parseTransition(payload.transition),
    writerInventory: parseInventory(payload.writerInventory, version),
    policy: parsePolicy(payload.policy),
    rules,
    writerControls,
    causalDrain: parseCausalDrain(payload.causalDrain),
    workbook: parseWorkbook(payload.workbook),
    quietHorizon: parseQuietHorizon(payload.quietHorizon),
    verifiedAtMillis: requireNonNegativeInteger(
      payload.verifiedAtMillis,
      "barrier verification instant",
    ),
  };
};

/**
 * Parses one detached intake-barrier envelope and verifies that its digest
 * binds the complete normalized payload. This structural boundary deliberately
 * does not apply command binding, chronology, or freshness; those checks belong
 * to maintenance admission, while immutable evidence storage must also read
 * terminal packets after their admission window has elapsed.
 * @param {unknown} value Untrusted evidence envelope.
 * @param {number} version Explicit policy version.
 * @return {ShiftPlanningIntakeBarrierEvidenceEnvelope} Normalized envelope.
 */
const parseEvidenceEnvelope = (
  value: unknown,
  version: PolicyVersion = 1,
): ShiftPlanningIntakeBarrierEvidenceEnvelope => {
  const canonicalEnvelope = detachedCanonicalValue(
    value,
    "intake barrier envelope",
  );
  const envelope = requireRecord(
    canonicalEnvelope,
    "intake barrier envelope",
  );
  requireExactKeys(envelope, ["payload", "digest"], "intake barrier envelope");
  const payload = parsePayload(envelope.payload, version);
  const digest = requireDigest(
    envelope.digest,
    "intake barrier evidence digest",
  );
  if (digest !== createShiftPlanningDigest(payload)) {
    return failBarrier("Intake barrier evidence digest does not match.");
  }
  return {payload, digest};
};

/**
 * Parses strict v1 only; cooperative evidence never falls back to strict.
 * @param {unknown} value Strict evidence envelope.
 * @return {ShiftPlanningIntakeBarrierEvidenceEnvelope} Exact strict evidence.
 */
export const parseShiftPlanningIntakeBarrierEvidenceEnvelope = (
  value: unknown,
): ShiftPlanningIntakeBarrierEvidenceEnvelope => parseEvidenceEnvelope(value);

/**
 * Parses the explicitly versioned cooperative owner contract.
 * @param {unknown} value Cooperative evidence envelope.
 * @return {ShiftPlanningIntakeBarrierEvidenceEnvelope} Exact v2 evidence.
 */
export const parseShiftPlanningOwnerAgreementIntakeBarrierEvidenceEnvelope = (
  value: unknown,
): ShiftPlanningIntakeBarrierEvidenceEnvelope =>
  parseEvidenceEnvelope(value, 2);

/**
 * Parses ADR-0022 only through its explicit develop-only policy version.
 * @param {unknown} value Version 3 evidence.
 * @return {ShiftPlanningIntakeBarrierEvidenceEnvelope} Exact evidence.
 */
export const parseShiftPlanningAdministratorAgreementIntakeBarrierEvidence = (
  value: unknown,
): ShiftPlanningIntakeBarrierEvidenceEnvelope =>
  parseEvidenceEnvelope(value, 3);

/**
 * Reads immutable retained evidence of either explicit version.
 * @param {unknown} value Retained envelope, not an admission bypass.
 * @return {ShiftPlanningIntakeBarrierEvidenceEnvelope} Version-bound evidence.
 */
export const parseShiftPlanningMaintenanceBarrierEvidenceEnvelope = (
  value: unknown,
): ShiftPlanningIntakeBarrierEvidenceEnvelope => {
  const envelope = requireRecord(value, "maintenance evidence");
  const payload = requireRecord(envelope.payload, "maintenance payload");
  return parseEvidenceEnvelope(value, versionOf(payload));
};

/**
 * Revalidates a detached audit packet and derives the compact evidence
 * persisted by the maintenance CAS. The digest binds the exact packet; it does
 * not replace the trusted adapter that reads and holds real Rules, IAM, queue,
 * and Drive state.
 * @param {unknown} value Untrusted evidence envelope from the adapter.
 * @param {ShiftPlanningMaintenanceEntryRequest} command Exact maintenance CAS.
 * @param {number} nowMillis Trusted current clock in milliseconds.
 * @param {boolean} requireFreshness Whether this admits a new transition.
 * @return {VerifiedShiftPlanningIntakeBarrier} Normalized packet and CAS proof.
 */
const verifyIntakeBarrierEvidence = (
  value: unknown,
  command: ShiftPlanningMaintenanceEntryRequest,
  nowMillis: number,
  requireFreshness: boolean,
): VerifiedShiftPlanningIntakeBarrier => {
  const {payload, digest} =
    parseEvidenceEnvelope(value, versionOf(command));
  const normalizedNow = requireNonNegativeInteger(
    nowMillis,
    "verification clock",
  );
  const normalizedCommand = normalizeMaintenanceEntryRequest(command);
  validateCommandBinding(payload, normalizedCommand);
  validateChronology(payload, normalizedNow, requireFreshness);
  if (payload.schemaVersion !== 1) {
    assertShiftPlanningOwnerMaintenanceObservation({
      agreement: payload.ownerAgreement, observation: payload.ownerObservation,
      environment: command.environment, operationId: command.transitionId,
      workbookFileId: command.expectedWorkbookFileId,
      workbookRevision: command.expectedWorkbookRevision,
      workbookDigest: command.expectedWorkbookDigest,
      writeEpoch: command.expectedWriteEpoch,
      activeRevision: command.expectedActiveRevision,
      activeDigest: command.expectedActiveDigest,
      authoritativeDigest: command.expectedAuthoritativeDigest,
      technicalControlManifestDigest:
        command.expectedTechnicalControlManifestDigest as ShiftPlanningDigest,
      nowMillis: normalizedNow,
      maximumEvidenceAgeMillis: command.maximumEvidenceAgeMillis,
      requireFreshWindow: requireFreshness,
    });
  }
  if (payload.schemaVersion === 3 && command.schemaVersion === 3) {
    assertShiftPlanningAdministratorMaintenanceObservation({
      agreement: payload.administratorAgreement,
      observation: payload.administratorObservation,
      environment: command.environment,
      ownerAgreementDigest: command.expectedOwnerAgreementDigest,
      affectedScopeDigest: command.expectedAuthoritativeDigest,
      writeEpoch: command.expectedWriteEpoch,
      activeRevision: command.expectedActiveRevision,
      activeDigest: command.expectedActiveDigest,
      technicalControlManifestDigest:
        command.expectedTechnicalControlManifestDigest,
      sourceRevision: command.expectedAdministratorSourceRevision,
      sourceDigest: command.expectedAdministratorSourceDigest,
      effectiveIamDigest: command.expectedEffectiveIamDigest,
      operationId: command.transitionId, operationKind: "maintenance-entry",
      operationManifestDigest: command.expectedTechnicalControlManifestDigest,
      nowMillis: normalizedNow,
      maximumEvidenceAgeMillis: command.maximumEvidenceAgeMillis,
      requireFreshWindow: requireFreshness,
    });
  }
  return {
    barrier: {
      revision: payload.barrierRevision,
      digest,
      verifiedAtMillis: payload.verifiedAtMillis,
    },
    expiresAtMillis: barrierEvidenceExpiresAtMillis(payload),
    evidence: {payload, digest},
  };
};

/**
 * Verifies an intake-barrier packet that must still admit a new transition.
 * @param {unknown} value Untrusted evidence envelope from the adapter.
 * @param {ShiftPlanningMaintenanceEntryRequest} command Exact maintenance CAS.
 * @param {number} nowMillis Trusted current clock in milliseconds.
 * @return {VerifiedShiftPlanningIntakeBarrier} Normalized packet and CAS proof.
 */
export const verifyShiftPlanningIntakeBarrierEvidence = (
  value: unknown,
  command: ShiftPlanningMaintenanceEntryRequest,
  nowMillis: number,
): VerifiedShiftPlanningIntakeBarrier => {
  if (command.schemaVersion !== undefined) {
    return failBarrier("Strict admission cannot accept owner-agreement mode.");
  }
  return verifyIntakeBarrierEvidence(value, command, nowMillis, true);
};

/**
 * Verifies explicit cooperative admission with original strong controls.
 * @param {unknown} value Version 2 evidence.
 * @param {ShiftPlanningMaintenanceEntryRequest} command Version 2 request.
 * @param {number} nowMillis Trusted admission clock.
 * @return {VerifiedShiftPlanningIntakeBarrier} Bound maintenance evidence.
 */
export const verifyShiftPlanningOwnerAgreementIntakeBarrierEvidence = (
  value: unknown,
  command: ShiftPlanningMaintenanceEntryRequest,
  nowMillis: number,
): VerifiedShiftPlanningIntakeBarrier => {
  if (command.schemaVersion !== 2) {
    return failBarrier("Cooperative admission requires explicit version 2.");
  }
  return verifyIntakeBarrierEvidence(value, command, nowMillis, true);
};

/**
 * Admits explicit develop administration while preserving all technical gates.
 * @param {unknown} value Version 3 evidence.
 * @param {ShiftPlanningMaintenanceEntryRequest} command Version 3 command.
 * @param {number} nowMillis Trusted current clock.
 * @return {VerifiedShiftPlanningIntakeBarrier} Bound evidence.
 */
export const verifyShiftPlanningAdministratorAgreementIntakeBarrierEvidence = (
  value: unknown, command: ShiftPlanningMaintenanceEntryRequest,
  nowMillis: number,
): VerifiedShiftPlanningIntakeBarrier => {
  if (command.schemaVersion !== 3) {
    return failBarrier("Administrator admission requires explicit version 3.");
  }
  return verifyIntakeBarrierEvidence(value, command, nowMillis, true);
};

const requireFreshBarrierEvidence = (
  verified: VerifiedShiftPlanningIntakeBarrier,
  nowMillis: number,
): void => {
  const now = requireNonNegativeInteger(nowMillis, "verification clock");
  if (
    verified.barrier.verifiedAtMillis > now ||
    now > verified.expiresAtMillis ||
    (verified.evidence.payload.schemaVersion !== 1 &&
      now >= verified.evidence.payload.ownerAgreement.payload.intent
        .endsAtMillis)
  ) {
    failBarrier("Barrier evidence is stale for a new maintenance attempt.");
  }
};

const stateCommand = (
  command: ShiftPlanningMaintenanceEntryRequest,
  intakeBarrier: ShiftPlanningIntakeBarrier,
  intakeBarrierExpiresAtMillis: number,
) => ({
  action: "enterMaintenance" as const,
  environment: command.environment,
  transitionId: command.transitionId,
  expectedAuthoritativeDigest: command.expectedAuthoritativeDigest,
  expectedStateRevision: command.expectedStateRevision,
  expectedWriteEpoch: command.expectedWriteEpoch,
  expectedActiveRevision: command.expectedActiveRevision,
  expectedActiveDigest: command.expectedActiveDigest,
  intakeBarrier,
  intakeBarrierExpiresAtMillis,
});

const sameBarrier = (
  left: ShiftPlanningIntakeBarrier | null,
  right: ShiftPlanningIntakeBarrier,
): boolean => left !== null &&
  left.revision === right.revision &&
  left.digest === right.digest &&
  left.verifiedAtMillis === right.verifiedAtMillis;

const requireMatchingTerminalTransition = (
  record: ShiftPlanningMaintenanceTransitionRecord,
  command: ShiftPlanningMaintenanceEntryRequest,
  barrier: ShiftPlanningIntakeBarrier,
  expiresAtMillis: number,
): void => {
  const expectedIntent = stateCommand(command, barrier, expiresAtMillis);
  if (
    record.action !== "enterMaintenance" ||
    record.environment !== command.environment ||
    record.transitionId !== command.transitionId ||
    record.intentDigest !== createShiftPlanningDigest(expectedIntent)
  ) {
    failBarrier("Terminal maintenance transition owns another intent.");
  }
};

const requireCurrentReplayOwnership = async (
  statePersistence: ShiftPlanningStatePersistence,
  result: ShiftPlanningMaintenanceTransitionResult,
  barrier: ShiftPlanningIntakeBarrier,
): Promise<void> => {
  if (result.kind !== "replayed") return;
  const current = await statePersistence.loadAuthoritativeState({
    environment: result.transition.environment,
  });
  if (
    current.authoritativeDigest !==
      result.transition.authoritativeDigestAfter ||
    current.maintenance.maintenanceStatus !== "closed" ||
    current.maintenance.lastTransitionId !== result.transition.transitionId ||
    !sameBarrier(current.maintenance.intakeBarrier, barrier)
  ) {
    failBarrier("Replayed maintenance entry no longer owns current state.");
  }
};

const maintenanceScope = (
  command: ShiftPlanningMaintenanceEntryRequest,
): ShiftPlanningClosedBarrierScope => {
  const common = {environment: command.environment,
    transitionId: command.transitionId,
    expectedAuthoritativeDigest: command.expectedAuthoritativeDigest,
    expectedStateRevision: command.expectedStateRevision,
    expectedWriteEpoch: command.expectedWriteEpoch,
    expectedActiveRevision: command.expectedActiveRevision,
    expectedActiveDigest: command.expectedActiveDigest,
    expectedBarrierRevision: command.expectedBarrierRevision,
    expectedRulesRevision: command.expectedRulesRevision,
    expectedRulesDigest: command.expectedRulesDigest,
    expectedControlManifestDigest:
    command.expectedControlManifestDigest,
    expectedWorkbookFileId: command.expectedWorkbookFileId,
    expectedWorkbookRevision: command.expectedWorkbookRevision,
    expectedWorkbookDigest: command.expectedWorkbookDigest,
    expectedCausalSetRevision: command.expectedCausalSetRevision,
    expectedCausalSetDigest: command.expectedCausalSetDigest,
    minimumQuietHorizonMillis: command.minimumQuietHorizonMillis,
    maximumEvidenceAgeMillis: command.maximumEvidenceAgeMillis,
    writerInventoryRevision: inventoryFor(versionOf(command)).revision,
    writerInventoryDigest: inventoryFor(versionOf(command)).digest};
  return command.schemaVersion === 3 ? {
    ...common, ...administratorMode(command as unknown as UnknownRecord),
  } : command.schemaVersion === 2 ? {
    ...common, ...ownerMode(command as unknown as UnknownRecord),
  } : common;
};

/**
 * Establishes the no-gap ordering: the adapter holds the external fence while
 * evidence is verified and the backend state advances. No reopen capability is
 * available to this coordinator, including on failure.
 * @param {object} dependencies Trusted adapter, state repository, and clock.
 * @param {ShiftPlanningMaintenanceEntryRequest} command Exact maintenance CAS.
 * @return {Promise<ShiftPlanningMaintenanceTransitionResult>} CAS outcome.
 */
export const enterShiftPlanningMaintenanceBehindIntakeBarrier = async (
  dependencies: {
    barrierAdapter: ShiftPlanningIntakeBarrierAdapter;
    evidencePersistence: ShiftPlanningIntakeBarrierEvidencePersistence;
    statePersistence: ShiftPlanningStatePersistence;
    readClockMillis: () => number;
  },
  command: ShiftPlanningMaintenanceEntryRequest,
): Promise<ShiftPlanningMaintenanceTransitionResult> => {
  const stableCommand = normalizeMaintenanceEntryRequest(command);
  const scope = maintenanceScope(stableCommand);
  if (stableCommand.schemaVersion !== undefined) {
    const terminal = await dependencies.statePersistence
      .loadMaintenanceTransition({
        environment: stableCommand.environment,
        transitionId: stableCommand.transitionId,
      });
    if (terminal) {
      if (!dependencies.barrierAdapter.assertReadOnlyReplayAllowed) {
        return failBarrier("Owner receipt replay requires its adapter.");
      }
      await dependencies.barrierAdapter.assertReadOnlyReplayAllowed(scope);
      const evidence = await dependencies.evidencePersistence.readExisting({
        environment: stableCommand.environment,
        transitionId: stableCommand.transitionId,
      });
      if (!evidence) return failBarrier("Terminal evidence is missing.");
      const verified = verifyIntakeBarrierEvidence(
        evidence, stableCommand, dependencies.readClockMillis(), false,
      );
      requireMatchingTerminalTransition(
        terminal, stableCommand, verified.barrier, verified.expiresAtMillis,
      );
      const replay = {kind: "replayed" as const, transition: terminal};
      await requireCurrentReplayOwnership(
        dependencies.statePersistence, replay, verified.barrier,
      );
      await dependencies.barrierAdapter.assertReadOnlyReplayAllowed(scope);
      return replay;
    }
  }
  let callbackInvocationCount = 0;
  let callbackResult: ShiftPlanningMaintenanceTransitionResult | undefined;
  let callbackDidFail = false;
  let callbackFailure: unknown;
  const adapterResult = await dependencies.barrierAdapter
    .withClosedIntakeBarrier<ShiftPlanningMaintenanceTransitionResult>(
      scope,
      async (evidence) => {
        callbackInvocationCount += 1;
        if (callbackInvocationCount !== 1) {
          return failBarrier(
            "Barrier adapter invoked the operation more than once.",
          );
        }
        try {
          const initialNowMillis = dependencies.readClockMillis();
          const verified = verifyIntakeBarrierEvidence(
            evidence,
            stableCommand,
            initialNowMillis,
            false,
          );
          let terminalTransition = await dependencies.statePersistence
            .loadMaintenanceTransition({
              environment: stableCommand.environment,
              transitionId: stableCommand.transitionId,
            });
          if (terminalTransition) {
            requireMatchingTerminalTransition(
              terminalTransition,
              stableCommand,
              verified.barrier,
              verified.expiresAtMillis,
            );
          } else {
            requireFreshBarrierEvidence(verified, initialNowMillis);
          }
          const evidenceKey = {
            environment: stableCommand.environment,
            transitionId: stableCommand.transitionId,
          };
          const retainedEvidence = terminalTransition ?
            await dependencies.evidencePersistence.readExisting(evidenceKey) :
            await dependencies.evidencePersistence.retainAndReadBack({
              ...evidenceKey,
              evidence: verified.evidence,
            });
          if (retainedEvidence === null) {
            return failBarrier(
              "Terminal maintenance evidence is not retained.",
            );
          }
          const retainedNowMillis = dependencies.readClockMillis();
          const retained = verifyIntakeBarrierEvidence(
            retainedEvidence,
            stableCommand,
            retainedNowMillis,
            false,
          );
          if (
            !sameBarrier(retained.barrier, verified.barrier) ||
            retained.expiresAtMillis !== verified.expiresAtMillis
          ) {
            return failBarrier(
              "Retained barrier evidence did not read back exactly.",
            );
          }
          if (!terminalTransition) {
            terminalTransition = await dependencies.statePersistence
              .loadMaintenanceTransition({
                environment: stableCommand.environment,
                transitionId: stableCommand.transitionId,
              });
            if (terminalTransition) {
              requireMatchingTerminalTransition(
                terminalTransition,
                stableCommand,
                retained.barrier,
                retained.expiresAtMillis,
              );
            } else {
              requireFreshBarrierEvidence(retained, retainedNowMillis);
            }
          }
          const result = await dependencies.statePersistence
            .enterMaintenanceWithBarrierEvidence(
              stateCommand(
                stableCommand,
                verified.barrier,
                verified.expiresAtMillis,
              ),
            );
          await requireCurrentReplayOwnership(
            dependencies.statePersistence,
            result,
            verified.barrier,
          );
          callbackResult = result;
          return result;
        } catch (error) {
          callbackDidFail = true;
          callbackFailure = error;
          throw error;
        }
      },
    );
  if (callbackDidFail) throw callbackFailure;
  if (
    callbackInvocationCount !== 1 ||
    callbackResult === undefined ||
    adapterResult !== callbackResult
  ) {
    return failBarrier("Barrier adapter did not return its one CAS operation.");
  }
  return adapterResult;
};


/**
 * Revalidates the strong technical evidence used by an explicit Sheets phase.
 * This does not make a historical retained document a current control read;
 * the caller must also obtain the same held checkpoint from its live reader.
 * Owner validity and the current command lineage are separate batch gates.
 * @param {unknown} value Versioned evidence read from trusted controls.
 * @param {string} expectedDigest Reviewed evidence identity.
 * @param {string} environment Exact phase environment.
 * @param {string} workbookId Exact phase workbook.
 * @param {number} nowMillis Current trusted clock.
 * @param {object} administrator Explicit develop source and IAM binding.
 * @return {ShiftPlanningIntakeBarrierEvidenceEnvelope} Verified technical data.
 */
export const verifyShiftPlanningOwnerSheetsTechnicalEvidence = (
  value: unknown,
  expectedDigest: string,
  environment: ShiftPlanningEnvironment,
  workbookId: string,
  nowMillis: number,
  administrator?: {sourceRevision: string; sourceDigest: string;
    effectiveIamDigest: string},
): {evidence: ShiftPlanningIntakeBarrierEvidenceEnvelope;
  technicalExpiresAtMillis: number} => {
  const evidence = administrator ?
    parseShiftPlanningAdministratorAgreementIntakeBarrierEvidence(value) :
    parseShiftPlanningOwnerAgreementIntakeBarrierEvidenceEnvelope(value);
  if (evidence.digest !== expectedDigest ||
      evidence.payload.environment !== environment ||
      evidence.payload.workbook.fileId !== workbookId) {
    return failBarrier("Sheets technical control scope changed.");
  }
  if (administrator && (environment !== "develop" ||
      evidence.payload.schemaVersion !== 3 ||
      evidence.payload.administratorAgreement.payload.intent.sourceRevision !==
        administrator.sourceRevision ||
      evidence.payload.administratorAgreement.payload.intent.sourceDigest !==
        administrator.sourceDigest ||
      evidence.payload.administratorAgreement.payload.intent
        .effectiveIamDigest !==
        administrator.effectiveIamDigest)) {
    return failBarrier("Sheets administrator source or IAM authority changed.");
  }
  if (evidence.payload.schemaVersion === 3) {
    const payload = evidence.payload;
    const intent = payload.administratorAgreement.payload.intent;
    verifyIntakeBarrierEvidence(evidence, {
      ...payload.transition, ...payload.policy,
      environment: payload.environment, schemaVersion: 3,
      maintenanceMode: "develop-administrator-agreement",
      expectedBarrierRevision: payload.barrierRevision,
      expectedRulesRevision: payload.rules.finalReadBackRevision,
      expectedRulesDigest: payload.rules.finalReadBackDigest,
      expectedControlManifestDigest: createShiftPlanningControlManifestDigest(
        payload.writerControls, payload.maintenanceMode),
      expectedWorkbookFileId: payload.workbook.fileId,
      expectedWorkbookRevision: payload.workbook.revision,
      expectedWorkbookDigest: payload.workbook.digest,
      expectedCausalSetRevision: payload.causalDrain.acceptedSetRevision,
      expectedCausalSetDigest: payload.causalDrain.acceptedSetDigest,
      expectedOwnerAgreementDigest: payload.ownerAgreement.digest,
      expectedTechnicalControlManifestDigest:
        intent.technicalControlManifestDigest,
      expectedAdministratorAgreementDigest:
        payload.administratorAgreement.digest,
      expectedAdministratorSourceRevision: intent.sourceRevision,
      expectedAdministratorSourceDigest: intent.sourceDigest,
      expectedEffectiveIamDigest: intent.effectiveIamDigest,
    }, nowMillis, false);
  }
  validateChronology(evidence.payload, nowMillis, true);
  return {evidence, technicalExpiresAtMillis:
    oldestBarrierObservationMillis(evidence.payload) +
      evidence.payload.policy.maximumEvidenceAgeMillis};
};
