import {
  DocumentData,
  FieldValue,
  Firestore,
  Timestamp,
  Transaction,
} from "@google-cloud/firestore";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {createShiftPlanningDigest} from "./shift-planning-digest.js";
import {
  ShiftPlanningFirestoreCommitMeasurement,
  ShiftPlanningFirestoreMutation,
} from "./shift-planning-firestore-transaction-serializer.js";
import {
  measureAndSealShiftPlanningFirestoreTransactionAttempt,
} from "./shift-planning-firestore-transaction-attempt.js";
import {
  ShiftPlanningPersistedBundle,
} from "./shift-planning-persistence.js";
import {
  ShiftPlanningActivationOperationTerminal,
  ShiftPlanningBeforeImageBinding,
  ShiftPlanningBeforeImageEnvelope,
  decodeShiftPlanningFirestoreDocument,
  parseShiftPlanningActivationOperationTerminal,
  parseShiftPlanningBeforeImageEnvelope,
  parseShiftPlanningPublicShiftDocument,
} from "./shift-planning-publication-contract.js";
import {
  ShiftPlanningEnvironment,
  ShiftPlanningMaintenanceState,
  ShiftPlanningReleaseLease,
  ShiftRotationAggregateWire,
  parseShiftPlanningMaintenanceState,
  parseShiftRotationAggregateWire,
} from "./shift-planning-wire.js";

export const SHIFT_PLANNING_RECOVERY_OPERATION_SCHEMA_VERSION = 1 as const;

export type ShiftPlanningRecoveryReadDocument = {
  targetPath: string;
  data: DocumentData;
  updateTime: Timestamp;
};

export type ShiftPlanningRecoveryOperationTerminal = {
  schemaVersion: typeof SHIFT_PLANNING_RECOVERY_OPERATION_SCHEMA_VERSION;
  operationKind: "activationRecovery";
  state: "committed";
  operationId: string;
  recoveryOperationId: string;
  environment: ShiftPlanningEnvironment;
  requestId: string;
  bundleRevision: string;
  bundleDigest: string;
  forwardManifestDigest: string;
  inverseManifestDigest: string;
  activationOperationIntentDigest: string;
  expectedStateDigest: string;
  activationWriteEpoch: number;
  recoveryWriteEpoch: number;
  recoveredAt: Timestamp;
  restoreActiveLineage: {revision: string | null; digest: string | null};
  deletedPaths: readonly string[];
  restoredBeforeImages: readonly ShiftPlanningBeforeImageBinding[];
  recoveryIntentDigest: string;
};

export type MaterializeShiftPlanningInverseRecoveryInput = {
  recoveryOperationId: string;
  recoveredAt: Timestamp;
  bundle: ShiftPlanningPersistedBundle;
  activationOperationDocument: ShiftPlanningRecoveryReadDocument;
  requestDocument: ShiftPlanningRecoveryReadDocument;
  beforeImageDocuments: readonly ShiftPlanningRecoveryReadDocument[];
  currentDocuments: readonly ShiftPlanningRecoveryReadDocument[];
};

export type ShiftPlanningInverseRecoveryMaterialization = {
  operationPath: string;
  operation: ShiftPlanningRecoveryOperationTerminal;
  recoveryWriteEpoch: number;
  restoredDocuments: readonly {targetPath: string; document: DocumentData}[];
  deletedPaths: readonly string[];
  mutations: readonly ShiftPlanningFirestoreMutation[];
};

export type MeasureAndSealShiftPlanningInverseRecoveryAttemptInput =
  MaterializeShiftPlanningInverseRecoveryInput & {
    firestore: Firestore;
    transaction: Transaction;
  };

export type ShiftPlanningInverseRecoveryAttempt = {
  materialization: ShiftPlanningInverseRecoveryMaterialization;
  measurement: ShiftPlanningFirestoreCommitMeasurement;
};

type UnknownRecord = Record<string, unknown>;

const recoveryOperationFields = [
  "schemaVersion",
  "operationKind",
  "state",
  "operationId",
  "recoveryOperationId",
  "environment",
  "requestId",
  "bundleRevision",
  "bundleDigest",
  "forwardManifestDigest",
  "inverseManifestDigest",
  "activationOperationIntentDigest",
  "expectedStateDigest",
  "activationWriteEpoch",
  "recoveryWriteEpoch",
  "recoveredAt",
  "restoreActiveLineage",
  "deletedPaths",
  "restoredBeforeImages",
  "recoveryIntentDigest",
] as const;

const failInverse = (message: string): never => {
  throw new ShiftPlanningError(
    "invalid_planning_inverse_materialization",
    message,
  );
};

const requireRecord = (value: unknown, name: string): UnknownRecord => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Object.getOwnPropertySymbols(value).length > 0
  ) {
    return failInverse(`${name} must be a plain object.`);
  }
  return value as UnknownRecord;
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failInverse(`${name} is not a valid identifier.`);
  }
  return value;
};

const requireDigest = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return failInverse(`${name} is not a planning digest.`);
  }
  return value;
};

const requireNonNegativeInteger = (value: unknown, name: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return failInverse(`${name} must be a non-negative safe integer.`);
  }
  return value as number;
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
    failInverse(`${name} fields are not exact.`);
  }
};

const requireTimestamp = (value: unknown, name: string): Timestamp => {
  if (!(value instanceof Timestamp)) {
    return failInverse(`${name} must be a Firestore Timestamp.`);
  }
  return value;
};

const requireDocumentPath = (
  value: unknown,
  environment: ShiftPlanningEnvironment,
  name: string,
): string => {
  if (typeof value !== "string") {
    return failInverse(`${name} must be a document path.`);
  }
  const segments = value.split("/");
  if (
    segments.length < 4 ||
    segments.length % 2 !== 0 ||
    segments.some((segment) => segment.length < 1) ||
    segments[0] !== environment ||
    segments[1] !== "plus-collections"
  ) {
    return failInverse(`${name} is outside the planning environment.`);
  }
  return value;
};

const sameDigest = (left: unknown, right: unknown): boolean =>
  createShiftPlanningDigest(left) === createShiftPlanningDigest(right);

const parseWithInverseFailure = <Value>(
  parse: () => Value,
  message: string,
): Value => {
  try {
    return parse();
  } catch {
    return failInverse(message);
  }
};

const readDocumentsByPath = (input: {
  environment: ShiftPlanningEnvironment;
  documents: readonly ShiftPlanningRecoveryReadDocument[];
  name: string;
}): Map<string, ShiftPlanningRecoveryReadDocument> => {
  if (!Array.isArray(input.documents)) {
    return failInverse(`${input.name} must be an array.`);
  }
  const result = new Map<string, ShiftPlanningRecoveryReadDocument>();
  for (const document of input.documents) {
    const path = requireDocumentPath(
      document.targetPath,
      input.environment,
      `${input.name} target`,
    );
    requireRecord(document.data, `${input.name} data`);
    requireTimestamp(document.updateTime, `${input.name} updateTime`);
    if (result.has(path)) {
      return failInverse(`${input.name} contains duplicate paths.`);
    }
    result.set(path, document);
  }
  return result;
};

const resolveTemplate = (
  template: string,
  bundleRevision: string,
  bundleDigest: string,
  operationId: string,
): string => template
  .split("{bundleRevision}").join(bundleRevision)
  .split("{bundleDigest}").join(bundleDigest)
  .split("{operationId}").join(operationId);

const requireBundle = (bundle: ShiftPlanningPersistedBundle) => {
  const artifact = bundle.artifact;
  const manifest = artifact.manifests.inverse;
  const budget = artifact.budgets.inverse;
  const expectedRestoreWrites = manifest.rotationRestores +
    manifest.activeStateRestores + manifest.predecessorHelperRestores +
    manifest.creditLedgerRestores;
  const expectedDeleteWrites = manifest.publicProjectionDeletes.delivery +
    manifest.publicProjectionDeletes.market + manifest.syncCommandDeletes +
    manifest.heldIntentDeletes;
  if (
    bundle.schemaVersion !== 1 ||
    bundle.environment !== artifact.environment ||
    bundle.bundleId !== artifact.bundleId ||
    bundle.bundleRevision !== artifact.bundleRevision ||
    bundle.bundleDigest !== artifact.bundleDigest ||
    bundle.artifactDigest !== createShiftPlanningDigest(artifact) ||
    artifact.transactionRequirements.inverseManifestDigest !==
      createShiftPlanningDigest(artifact.manifests.inverse) ||
    manifest.expectedStateDigest !==
      createShiftPlanningDigest(artifact.expectedState) ||
    manifest.expectedAuthoritativeDigest !==
      artifact.expectedState.authoritativeState.authoritativeDigest ||
    manifest.requiredActiveCas.bundleRevision !==
      "{bundleRevision}" ||
    manifest.requiredActiveCas.bundleDigest !==
      "{bundleDigest}" ||
    manifest.requiredActiveCas.writeEpoch !==
      artifact.activationWriteEpoch ||
    manifest.recoveryWriteEpoch.kind !==
      "incrementCurrent" ||
    manifest.recoveryWriteEpoch.minimumExclusiveEpoch !==
      artifact.activationWriteEpoch ||
    manifest.recoveryWriteEpoch.neverReuseOrDecrement !==
      true ||
    manifest.requiresPersistedBeforeImages !== true ||
    manifest.restoreActiveLineage.revision !==
      artifact.expectedState.authoritativeState.maintenance.activeRevision ||
    manifest.restoreActiveLineage.digest !==
      artifact.expectedState.authoritativeState.maintenance.activeDigest ||
    manifest.restoreBeforeImages.length !== expectedRestoreWrites ||
    manifest.deleteCreatedDocuments.length !== expectedDeleteWrites ||
    manifest.requestUpdates !== 1 ||
    manifest.operationRegistryUpdates !== 1 ||
    manifest.syncCommandDeletes !== 2 ||
    manifest.releaseLeaseActions.length !== 2 ||
    manifest.releaseLeaseActions[0].action !== "clear" ||
    manifest.releaseLeaseActions[0].type !== "delivery" ||
    manifest.releaseLeaseActions[0].expectedState !== "sealed" ||
    manifest.releaseLeaseActions[1].action !== "clear" ||
    manifest.releaseLeaseActions[1].type !== "market" ||
    manifest.releaseLeaseActions[1].expectedState !== "sealed" ||
    budget.direction !== "inverse" ||
    budget.createWrites !== 0 ||
    budget.deleteWrites !== expectedDeleteWrites ||
    budget.updateWrites !== expectedRestoreWrites + 2 ||
    budget.totalWrites !== budget.updateWrites + budget.deleteWrites ||
    budget.beforeImageWrites !== 0 ||
    budget.creditLedgerWrites !== 0 ||
    manifest.creditLedgerRestores !== 0
  ) {
    return failInverse("Persisted inverse bundle authority has drifted.");
  }
  return artifact;
};

const requireActivationOperation = (input: {
  document: ShiftPlanningRecoveryReadDocument;
  environment: ShiftPlanningEnvironment;
  operationPath: string;
  candidateId: string;
  bundleRevision: string;
  bundleDigest: string;
  forwardManifestDigest: string;
  expectedStateDigest: string;
  activationWriteEpoch: number;
}): ShiftPlanningActivationOperationTerminal => {
  if (input.document.targetPath !== input.operationPath) {
    return failInverse("Activation operation path changed before recovery.");
  }
  const operation = parseWithInverseFailure(
    () => parseShiftPlanningActivationOperationTerminal(input.document.data),
    "Activation operation tombstone is invalid.",
  );
  if (
    operation.environment !== input.environment ||
    operation.candidateId !== input.candidateId ||
    operation.bundleRevision !== input.bundleRevision ||
    operation.bundleDigest !== input.bundleDigest ||
    operation.forwardManifestDigest !== input.forwardManifestDigest ||
    operation.expectedStateDigest !== input.expectedStateDigest ||
    operation.writeEpoch !== input.activationWriteEpoch
  ) {
    return failInverse("Activation operation lineage does not match bundle.");
  }
  return operation;
};

const requireRequestTerminal = (input: {
  document: ShiftPlanningRecoveryReadDocument;
  environment: ShiftPlanningEnvironment;
  requestPath: string;
  requestId: string;
  bundleId: string;
  bundleRevision: string;
  bundleDigest: string;
  operationId: string;
  artifactDigest: string;
}): DocumentData => {
  if (input.document.targetPath !== input.requestPath) {
    return failInverse("Activation request path changed before recovery.");
  }
  const request = requireRecord(input.document.data, "activation request");
  const lifecycle = requireRecord(request.lifecycle, "activation lifecycle");
  const summary = requireRecord(lifecycle.summary, "activation summary");
  const persistedArtifact = requireRecord(
    lifecycle.artifact,
    "activation request artifact",
  );
  if (
    request.environment !== input.environment ||
    request.requestId !== input.requestId ||
    request.bundleId !== input.bundleId ||
    request.mode !== "activate" ||
    request.status !== "completed" ||
    lifecycle.operationId !== input.operationId ||
    lifecycle.state !== "completed" ||
    summary.status !== "completed" ||
    summary.mode !== "activate" ||
    summary.bundleRevision !== input.bundleRevision ||
    summary.bundleDigest !== input.bundleDigest ||
    persistedArtifact.kind !== "candidate" ||
    persistedArtifact.candidateId !== input.bundleId ||
    persistedArtifact.bundleArtifactDigest !== input.artifactDigest ||
    lifecycle.terminalDigest !== createShiftPlanningDigest({
      summary: lifecycle.summary,
      artifact: lifecycle.artifact,
    })
  ) {
    return failInverse("Activation request terminal does not match bundle.");
  }
  return input.document.data;
};

const requireBeforeImages = (input: {
  documents: readonly ShiftPlanningRecoveryReadDocument[];
  operation: ShiftPlanningActivationOperationTerminal;
  bundle: ShiftPlanningPersistedBundle;
}): {envelope: ShiftPlanningBeforeImageEnvelope; document: DocumentData}[] => {
  const artifact = input.bundle.artifact;
  const manifest = artifact.manifests.inverse;
  const documents = readDocumentsByPath({
    environment: input.bundle.environment,
    documents: input.documents,
    name: "recovery before-images",
  });
  if (
    documents.size !== manifest.restoreBeforeImages.length ||
    input.operation.beforeImages.length !== manifest.restoreBeforeImages.length
  ) {
    return failInverse("Recovery before-image read-set is incomplete.");
  }
  return manifest.restoreBeforeImages.map((restore, index) => {
    const binding = input.operation.beforeImages[index];
    const envelopePath = resolveTemplate(
      restore.beforeImagePathTemplate,
      artifact.bundleRevision,
      artifact.bundleDigest,
      input.operation.operationId,
    );
    const read = documents.get(envelopePath);
    if (read === undefined) {
      return failInverse("Recovery before-image document is missing.");
    }
    const envelope = parseWithInverseFailure(
      () => parseShiftPlanningBeforeImageEnvelope(read.data),
      "Recovery before-image envelope is invalid.",
    );
    if (
      binding.ordinal !== index + 1 ||
      binding.targetPath !== restore.targetPath ||
      binding.envelopePath !== envelopePath ||
      binding.envelopeDigest !== envelope.envelopeDigest ||
      envelope.ordinal !== index + 1 ||
      envelope.operationId !== input.operation.operationId ||
      envelope.environment !== input.bundle.environment ||
      envelope.bundleRevision !== artifact.bundleRevision ||
      envelope.bundleDigest !== artifact.bundleDigest ||
      envelope.forwardManifestDigest !==
        artifact.transactionRequirements.forwardManifestDigest ||
      envelope.writeEpoch !== artifact.activationWriteEpoch ||
      envelope.targetPath !== restore.targetPath ||
      envelope.envelopePath !== envelopePath ||
      envelope.captureContractDigest !== restore.captureContractDigest
    ) {
      return failInverse("Recovery before-image binding has drifted.");
    }
    return {
      envelope,
      document: parseWithInverseFailure(
        () => decodeShiftPlanningFirestoreDocument(envelope.payload),
        "Recovery before-image payload is invalid.",
      ),
    };
  });
};

const requireCurrentAuthoritativeState = (input: {
  currentDocuments: Map<string, ShiftPlanningRecoveryReadDocument>;
  root: string;
  activationOperationId: string;
  recoveryOperationId: string;
  bundle: ShiftPlanningPersistedBundle;
  restoredByPath: Map<string, DocumentData>;
}): {
  maintenance: ShiftPlanningMaintenanceState;
  rotations: {
    delivery: ShiftRotationAggregateWire;
    market: ShiftRotationAggregateWire;
  };
  restored: {
    maintenance: ShiftPlanningMaintenanceState;
    delivery: ShiftRotationAggregateWire;
    market: ShiftRotationAggregateWire;
  };
  recoveryWriteEpoch: number;
} => {
  const artifact = input.bundle.artifact;
  const maintenancePath = `${input.root}/shiftPlanningState/current`;
  const deliveryPath = `${input.root}/shiftRotations/delivery`;
  const marketPath = `${input.root}/shiftRotations/market`;
  const maintenanceRead = input.currentDocuments.get(maintenancePath);
  const deliveryRead = input.currentDocuments.get(deliveryPath);
  const marketRead = input.currentDocuments.get(marketPath);
  if (
    maintenanceRead === undefined ||
    deliveryRead === undefined ||
    marketRead === undefined
  ) {
    return failInverse("Current authoritative recovery read-set is missing.");
  }
  const maintenance = parseWithInverseFailure(
    () => parseShiftPlanningMaintenanceState(maintenanceRead.data),
    "Current maintenance state is invalid.",
  );
  const delivery = parseWithInverseFailure(
    () => parseShiftRotationAggregateWire(deliveryRead.data, "delivery"),
    "Current delivery rotation is invalid.",
  );
  const market = parseWithInverseFailure(
    () => parseShiftRotationAggregateWire(marketRead.data, "market"),
    "Current market rotation is invalid.",
  );
  const beforeMaintenance = parseWithInverseFailure(
    () => parseShiftPlanningMaintenanceState(
      input.restoredByPath.get(maintenancePath),
    ),
    "Persisted maintenance before-image is invalid.",
  );
  const beforeDelivery = parseWithInverseFailure(
    () => parseShiftRotationAggregateWire(
      input.restoredByPath.get(deliveryPath),
      "delivery",
    ),
    "Persisted delivery before-image is invalid.",
  );
  const beforeMarket = parseWithInverseFailure(
    () => parseShiftRotationAggregateWire(
      input.restoredByPath.get(marketPath),
      "market",
    ),
    "Persisted market before-image is invalid.",
  );
  const expected = artifact.expectedState.authoritativeState;
  if (
    !sameDigest(beforeMaintenance, expected.maintenance) ||
    !sameDigest(beforeDelivery, expected.rotations.delivery) ||
    !sameDigest(beforeMarket, expected.rotations.market)
  ) {
    return failInverse("Authoritative before-images do not match bundle.");
  }
  if (
    maintenance.writeEpoch !== artifact.activationWriteEpoch ||
    maintenance.activeRevision !== artifact.bundleRevision ||
    maintenance.activeDigest !== artifact.bundleDigest ||
    maintenance.lastTransitionId !== input.activationOperationId
  ) {
    return failInverse("Current maintenance CAS does not match activation.");
  }
  if (
    delivery.activeRevision !== artifact.bundleRevision ||
    delivery.activeDigest !== artifact.bundleDigest ||
    market.activeRevision !== artifact.bundleRevision ||
    market.activeDigest !== artifact.bundleDigest ||
    delivery.stateRevision !== beforeDelivery.stateRevision + 1 ||
    market.stateRevision !== beforeMarket.stateRevision + 1 ||
    maintenance.stateRevision !== beforeMaintenance.stateRevision + 1
  ) {
    return failInverse("Current rotation CAS does not match activation.");
  }
  const requireSealedLease = (
    lease: ShiftPlanningReleaseLease | null,
    type: "delivery" | "market",
  ): void => {
    const intent = artifact.releaseLeaseIntents.find(
      (item) => item.type === type,
    );
    if (
      lease === null ||
      intent === undefined ||
      lease.state !== "sealed" ||
      lease.type !== type ||
      lease.bundleId !== artifact.bundleId ||
      lease.bundleRevision !== artifact.bundleRevision ||
      lease.bundleDigest !== artifact.bundleDigest ||
      lease.leaseEpoch !== artifact.activationWriteEpoch ||
      lease.ownerOperationId !== intent.ownerOperationId
    ) {
      return failInverse(`${type} recovery release lease is not owned.`);
    }
  };
  requireSealedLease(delivery.releaseLease, "delivery");
  requireSealedLease(market.releaseLease, "market");
  if (
    maintenance.writeEpoch === Number.MAX_SAFE_INTEGER ||
    maintenance.stateRevision === Number.MAX_SAFE_INTEGER ||
    delivery.stateRevision === Number.MAX_SAFE_INTEGER ||
    market.stateRevision === Number.MAX_SAFE_INTEGER
  ) {
    return failInverse("Recovery revisions cannot be incremented safely.");
  }
  const recoveryWriteEpoch = maintenance.writeEpoch + 1;
  const restoredMaintenance = parseWithInverseFailure(
    () => parseShiftPlanningMaintenanceState({
      ...beforeMaintenance,
      stateRevision: maintenance.stateRevision + 1,
      writeEpoch: recoveryWriteEpoch,
      lastTransitionId: input.recoveryOperationId,
    }),
    "Recovered maintenance state is invalid.",
  );
  const restoreRotation = (
    before: ShiftRotationAggregateWire,
    current: ShiftRotationAggregateWire,
  ): ShiftRotationAggregateWire => parseWithInverseFailure(
    () => parseShiftRotationAggregateWire({
      ...before,
      stateRevision: current.stateRevision + 1,
      lastIdempotencyKey: input.recoveryOperationId,
      releaseLease: null,
    }, before.type),
    `Recovered ${before.type} rotation is invalid.`,
  );
  return {
    maintenance,
    rotations: {delivery, market},
    restored: {
      maintenance: restoredMaintenance,
      delivery: restoreRotation(beforeDelivery, delivery),
      market: restoreRotation(beforeMarket, market),
    },
    recoveryWriteEpoch,
  };
};

const requireCreatedDocuments = (input: {
  currentDocuments: Map<string, ShiftPlanningRecoveryReadDocument>;
  operation: ShiftPlanningActivationOperationTerminal;
  bundle: ShiftPlanningPersistedBundle;
  deletedPaths: readonly string[];
}): void => {
  const artifact = input.bundle.artifact;
  const publicCreates = new Map(input.operation.publicMutations
    .filter((item) => item.mutationKind === "create")
    .map((item) => [item.targetPath, item]));
  const expectedBackend = new Map<string, unknown>();
  artifact.syncCommands.forEach((command) => expectedBackend.set(
    `${input.bundle.environment}/plus-collections/` +
      `shiftPlanningSyncCommands/${command.commandId}`,
    command,
  ));
  artifact.heldNotificationIntents.forEach((intent) => expectedBackend.set(
    `${input.bundle.environment}/plus-collections/` +
      `shiftPlanningNotificationIntents/${intent.intentId}`,
    intent,
  ));
  for (const path of input.deletedPaths) {
    const read = input.currentDocuments.get(path);
    if (read === undefined) {
      return failInverse("A recovery delete target is missing.");
    }
    const binding = publicCreates.get(path);
    if (binding !== undefined) {
      const document = parseWithInverseFailure(
        () => parseShiftPlanningPublicShiftDocument({
          targetPath: path,
          value: read.data,
          expectedOperationIntentDigest: input.operation.operationIntentDigest,
        }),
        "A created public shift no longer matches activation.",
      );
      if (
        document.lastBackendMutation.kind !== "activation" ||
        document.lastBackendMutation.operationId !==
          input.operation.operationId ||
        document.lastBackendMutation.bundleRevision !==
          artifact.bundleRevision ||
        document.lastBackendMutation.bundleDigest !== artifact.bundleDigest ||
        document.lastBackendMutation.writeEpoch !==
          artifact.activationWriteEpoch ||
        document.documentRevision !== binding.documentRevision ||
        document.lastBackendMutation.payloadDigest !== binding.payloadDigest
      ) {
        return failInverse(
          "A public delete target has changed after activation.",
        );
      }
      continue;
    }
    const expected = expectedBackend.get(path);
    if (expected === undefined || !sameDigest(read.data, expected)) {
      return failInverse(
        "A backend delete target has changed after activation.",
      );
    }
  }
  if (
    publicCreates.size + expectedBackend.size !== input.deletedPaths.length ||
    input.deletedPaths.some((path) =>
      !publicCreates.has(path) && !expectedBackend.has(path))
  ) {
    return failInverse(
      "Recovery delete manifest does not match forward creates.",
    );
  }
};

/**
 * Produces one guarded update that leaves exactly the desired top-level field
 * set. Replacing each retained map value removes nested after-only fields, and
 * explicit delete sentinels remove top-level fields absent from the
 * before-image.
 * @param {object} input Desired document and current post-activation document.
 * @return {DocumentData} Exact replacement represented as one update mutation.
 */
export const buildShiftPlanningExactReplacementData = (input: {
  desired: DocumentData;
  current: DocumentData;
}): DocumentData => {
  const desired = requireRecord(input.desired, "desired replacement");
  const current = requireRecord(input.current, "current replacement");
  const result: DocumentData = {};
  for (const key of Object.keys(desired).sort()) {
    if (key.includes(".") || key.includes("`") || key === "__proto__") {
      return failInverse(
        "Replacement contains an unsafe top-level field name.",
      );
    }
    result[key] = desired[key];
  }
  for (const key of Object.keys(current).sort()) {
    if (key.includes(".") || key.includes("`") || key === "__proto__") {
      return failInverse("Current document contains an unsafe field name.");
    }
    if (!Object.prototype.hasOwnProperty.call(desired, key)) {
      result[key] = FieldValue.delete();
    }
  }
  return result;
};

const createRecoveryOperation = (input: {
  recoveryOperationId: string;
  recoveredAt: Timestamp;
  activation: ShiftPlanningActivationOperationTerminal;
  bundle: ShiftPlanningPersistedBundle;
  recoveryWriteEpoch: number;
  deletedPaths: readonly string[];
}): ShiftPlanningRecoveryOperationTerminal => {
  const artifact = input.bundle.artifact;
  const withoutDigest: Omit<
    ShiftPlanningRecoveryOperationTerminal,
    "recoveryIntentDigest"
  > = {
    schemaVersion: SHIFT_PLANNING_RECOVERY_OPERATION_SCHEMA_VERSION,
    operationKind: "activationRecovery",
    state: "committed",
    operationId: input.activation.operationId,
    recoveryOperationId: requireIdentifier(
      input.recoveryOperationId,
      "recoveryOperationId",
    ),
    environment: input.bundle.environment,
    requestId: input.activation.requestId,
    bundleRevision: artifact.bundleRevision,
    bundleDigest: artifact.bundleDigest,
    forwardManifestDigest:
      artifact.transactionRequirements.forwardManifestDigest,
    inverseManifestDigest:
      artifact.transactionRequirements.inverseManifestDigest,
    activationOperationIntentDigest: input.activation.operationIntentDigest,
    expectedStateDigest: artifact.manifests.inverse.expectedStateDigest,
    activationWriteEpoch: artifact.activationWriteEpoch,
    recoveryWriteEpoch: input.recoveryWriteEpoch,
    recoveredAt: requireTimestamp(input.recoveredAt, "recoveredAt"),
    restoreActiveLineage: artifact.manifests.inverse.restoreActiveLineage,
    deletedPaths: [...input.deletedPaths],
    restoredBeforeImages: input.activation.beforeImages.map((item) => ({
      ...item,
    })),
  };
  return {
    ...withoutDigest,
    recoveryIntentDigest: createShiftPlanningDigest(
      recoveryOperationDigestCore(withoutDigest),
    ),
  };
};

const recoveryOperationDigestCore = (
  value: Omit<
    ShiftPlanningRecoveryOperationTerminal,
    "recoveryIntentDigest"
  >,
): object => ({
  ...value,
  recoveredAt: {
    seconds: value.recoveredAt.seconds,
    nanoseconds: value.recoveredAt.nanoseconds,
  },
});

/**
 * Parses the terminal that replaces one committed activation after a valid
 * inverse recovery. It preserves the original activation binding while adding
 * the strictly newer recovery epoch and its own non-self-referential digest.
 * @param {unknown} value Persisted recovery operation document.
 * @return {ShiftPlanningRecoveryOperationTerminal} Canonical terminal.
 */
export const parseShiftPlanningRecoveryOperationTerminal = (
  value: unknown,
): ShiftPlanningRecoveryOperationTerminal => {
  const operation = requireRecord(value, "recovery operation");
  requireExactFields(
    operation,
    recoveryOperationFields,
    "recovery operation",
  );
  if (
    operation.schemaVersion !==
      SHIFT_PLANNING_RECOVERY_OPERATION_SCHEMA_VERSION ||
    operation.operationKind !== "activationRecovery" ||
    operation.state !== "committed"
  ) {
    return failInverse("Recovery operation discriminators are invalid.");
  }
  const environment = operation.environment;
  if (environment !== "develop" && environment !== "production") {
    return failInverse("Recovery operation environment is invalid.");
  }
  const operationId = requireIdentifier(operation.operationId, "operationId");
  const recoveryOperationId = requireIdentifier(
    operation.recoveryOperationId,
    "recoveryOperationId",
  );
  const requestId = requireIdentifier(operation.requestId, "requestId");
  if (
    operationId !== `request-${requestId}` ||
    recoveryOperationId === operationId
  ) {
    return failInverse("Recovery operation identity is not canonical.");
  }
  const activationWriteEpoch = requireNonNegativeInteger(
    operation.activationWriteEpoch,
    "activation write epoch",
  );
  const recoveryWriteEpoch = requireNonNegativeInteger(
    operation.recoveryWriteEpoch,
    "recovery write epoch",
  );
  if (recoveryWriteEpoch <= activationWriteEpoch) {
    return failInverse("Recovery write epoch is not strictly newer.");
  }
  const lineage = requireRecord(
    operation.restoreActiveLineage,
    "restored active lineage",
  );
  requireExactFields(
    lineage,
    ["revision", "digest"],
    "restored active lineage",
  );
  const revision = lineage.revision === null ? null : requireIdentifier(
    lineage.revision,
    "restored active revision",
  );
  const digest = lineage.digest === null ? null : requireDigest(
    lineage.digest,
    "restored active digest",
  );
  if ((revision === null) !== (digest === null)) {
    return failInverse("Restored active lineage is incomplete.");
  }
  if (!Array.isArray(operation.deletedPaths)) {
    return failInverse("Recovery deleted paths must be an array.");
  }
  const deletedPaths = operation.deletedPaths.map((path) =>
    requireDocumentPath(path, environment, "recovery deleted path"));
  if (
    deletedPaths.length < 1 ||
    new Set(deletedPaths).size !== deletedPaths.length ||
    deletedPaths.some((path, index) =>
      index > 0 && deletedPaths[index - 1] >= path)
  ) {
    return failInverse("Recovery deleted paths are not canonical.");
  }
  if (!Array.isArray(operation.restoredBeforeImages)) {
    return failInverse("Recovery before-image bindings must be an array.");
  }
  const restoredBeforeImages = operation.restoredBeforeImages.map(
    (rawBinding, index): ShiftPlanningBeforeImageBinding => {
      const binding = requireRecord(
        rawBinding,
        `recovery before-image binding ${index + 1}`,
      );
      requireExactFields(
        binding,
        ["ordinal", "targetPath", "envelopePath", "envelopeDigest"],
        `recovery before-image binding ${index + 1}`,
      );
      const ordinal = requireNonNegativeInteger(
        binding.ordinal,
        "recovery before-image ordinal",
      );
      const targetPath = requireDocumentPath(
        binding.targetPath,
        environment,
        "recovery before-image target",
      );
      const envelopePath = requireDocumentPath(
        binding.envelopePath,
        environment,
        "recovery before-image envelope",
      );
      if (
        ordinal !== index + 1 ||
        envelopePath !== `${environment}/plus-collections/` +
          `shiftPlanningOperations/${operationId}/beforeImages/${ordinal}`
      ) {
        return failInverse("Recovery before-image binding is not canonical.");
      }
      return {
        ordinal,
        targetPath,
        envelopePath,
        envelopeDigest: requireDigest(
          binding.envelopeDigest,
          "recovery before-image envelope digest",
        ),
      };
    },
  );
  if (
    restoredBeforeImages.length < 3 ||
    new Set(restoredBeforeImages.map((item) => item.targetPath)).size !==
      restoredBeforeImages.length
  ) {
    return failInverse("Recovery before-image bindings are incomplete.");
  }
  const withoutDigest: Omit<
    ShiftPlanningRecoveryOperationTerminal,
    "recoveryIntentDigest"
  > = {
    schemaVersion: SHIFT_PLANNING_RECOVERY_OPERATION_SCHEMA_VERSION,
    operationKind: "activationRecovery",
    state: "committed",
    operationId,
    recoveryOperationId,
    environment,
    requestId,
    bundleRevision: requireIdentifier(
      operation.bundleRevision,
      "bundle revision",
    ),
    bundleDigest: requireDigest(operation.bundleDigest, "bundle digest"),
    forwardManifestDigest: requireDigest(
      operation.forwardManifestDigest,
      "forward manifest digest",
    ),
    inverseManifestDigest: requireDigest(
      operation.inverseManifestDigest,
      "inverse manifest digest",
    ),
    activationOperationIntentDigest: requireDigest(
      operation.activationOperationIntentDigest,
      "activation operation intent digest",
    ),
    expectedStateDigest: requireDigest(
      operation.expectedStateDigest,
      "expected state digest",
    ),
    activationWriteEpoch,
    recoveryWriteEpoch,
    recoveredAt: requireTimestamp(operation.recoveredAt, "recoveredAt"),
    restoreActiveLineage: {revision, digest},
    deletedPaths,
    restoredBeforeImages,
  };
  const recoveryIntentDigest = requireDigest(
    operation.recoveryIntentDigest,
    "recovery intent digest",
  );
  if (
    recoveryIntentDigest !== createShiftPlanningDigest(
      recoveryOperationDigestCore(withoutDigest),
    )
  ) {
    return failInverse("Recovery operation intent digest does not match.");
  }
  return {...withoutDigest, recoveryIntentDigest};
};

/**
 * Resolves the complete inverse write set from one current transaction read.
 * Created documents must still carry the activation lineage, every before-image
 * must match the immutable tombstone, and the active CAS must still own both
 * sealed release leases. Recovery restores business state while advancing the
 * maintenance write epoch and aggregate revisions monotonically.
 * @param {MaterializeShiftPlanningInverseRecoveryInput} input Bundle and exact
 * transaction read-set for the activation being recovered.
 * @return {ShiftPlanningInverseRecoveryMaterialization} Ordered inverse writes.
 */
export const materializeShiftPlanningInverseRecovery = (
  input: MaterializeShiftPlanningInverseRecoveryInput,
): ShiftPlanningInverseRecoveryMaterialization => {
  const recoveryOperationId = requireIdentifier(
    input.recoveryOperationId,
    "recoveryOperationId",
  );
  const artifact = requireBundle(input.bundle);
  const root = `${input.bundle.environment}/plus-collections`;
  const expectedOperationId = input.activationOperationDocument.targetPath
    .split("/").at(-1);
  if (expectedOperationId === undefined) {
    return failInverse("Activation operation path is invalid.");
  }
  const operationPath =
    `${root}/shiftPlanningOperations/${expectedOperationId}`;
  const activation = requireActivationOperation({
    document: input.activationOperationDocument,
    environment: input.bundle.environment,
    operationPath,
    candidateId: artifact.bundleId,
    bundleRevision: artifact.bundleRevision,
    bundleDigest: artifact.bundleDigest,
    forwardManifestDigest:
      artifact.transactionRequirements.forwardManifestDigest,
    expectedStateDigest: artifact.manifests.inverse.expectedStateDigest,
    activationWriteEpoch: artifact.activationWriteEpoch,
  });
  if (
    activation.operationId !== expectedOperationId ||
    activation.operationId !== `request-${activation.requestId}` ||
    activation.operationId === recoveryOperationId
  ) {
    return failInverse("Activation operation identity is not canonical.");
  }
  const requestPath = `${root}/shiftPlanningRequests/${activation.requestId}`;
  const requestDocument = requireRequestTerminal({
    document: input.requestDocument,
    environment: input.bundle.environment,
    requestPath,
    requestId: activation.requestId,
    bundleId: artifact.bundleId,
    bundleRevision: artifact.bundleRevision,
    bundleDigest: artifact.bundleDigest,
    operationId: activation.operationId,
    artifactDigest: input.bundle.artifactDigest,
  });
  const beforeImages = requireBeforeImages({
    documents: input.beforeImageDocuments,
    operation: activation,
    bundle: input.bundle,
  });
  const restoredByPath = new Map(beforeImages.map((item) => [
    item.envelope.targetPath,
    item.document,
  ]));
  const deletedPaths = artifact.manifests.inverse.deleteCreatedDocuments
    .map(({pathTemplate}) => requireDocumentPath(
      resolveTemplate(
        pathTemplate,
        artifact.bundleRevision,
        artifact.bundleDigest,
        activation.operationId,
      ),
      input.bundle.environment,
      "recovery delete target",
    ))
    .sort();
  const expectedCurrentPaths = [
    ...deletedPaths,
    ...artifact.manifests.inverse.restoreBeforeImages.map(({targetPath}) =>
      targetPath),
  ].sort();
  const currentDocuments = readDocumentsByPath({
    environment: input.bundle.environment,
    documents: input.currentDocuments,
    name: "current recovery documents",
  });
  if (
    currentDocuments.size !== expectedCurrentPaths.length ||
    expectedCurrentPaths.some((path) => !currentDocuments.has(path))
  ) {
    return failInverse("Current recovery read-set does not match manifest.");
  }
  requireCreatedDocuments({
    currentDocuments,
    operation: activation,
    bundle: input.bundle,
    deletedPaths,
  });
  const authoritative = requireCurrentAuthoritativeState({
    currentDocuments,
    root,
    activationOperationId: activation.operationId,
    recoveryOperationId,
    bundle: input.bundle,
    restoredByPath,
  });
  const maintenancePath = `${root}/shiftPlanningState/current`;
  const deliveryPath = `${root}/shiftRotations/delivery`;
  const marketPath = `${root}/shiftRotations/market`;
  const restoredDocuments = beforeImages.map(({envelope, document}) => {
    if (envelope.targetPath === maintenancePath) {
      return {
        targetPath: envelope.targetPath,
        document: authoritative.restored.maintenance,
      };
    }
    if (envelope.targetPath === deliveryPath) {
      return {
        targetPath: envelope.targetPath,
        document: authoritative.restored.delivery,
      };
    }
    if (envelope.targetPath === marketPath) {
      return {
        targetPath: envelope.targetPath,
        document: authoritative.restored.market,
      };
    }
    parseWithInverseFailure(
      () => parseShiftPlanningPublicShiftDocument({
        targetPath: envelope.targetPath,
        value: document,
      }),
      "Persisted public before-image is invalid.",
    );
    const current = currentDocuments.get(envelope.targetPath);
    const binding = activation.publicMutations.find((item) =>
      item.targetPath === envelope.targetPath &&
      item.mutationKind === "update");
    if (current === undefined || binding === undefined) {
      return failInverse("Updated public shift recovery binding is missing.");
    }
    const currentPublic = parseWithInverseFailure(
      () => parseShiftPlanningPublicShiftDocument({
        targetPath: envelope.targetPath,
        value: current.data,
        expectedOperationIntentDigest: activation.operationIntentDigest,
      }),
      "Updated public shift changed after activation.",
    );
    if (
      currentPublic.lastBackendMutation.kind !== "activation" ||
      currentPublic.lastBackendMutation.operationId !==
        activation.operationId ||
      currentPublic.lastBackendMutation.bundleRevision !==
        artifact.bundleRevision ||
      currentPublic.lastBackendMutation.bundleDigest !==
        artifact.bundleDigest ||
      currentPublic.lastBackendMutation.writeEpoch !==
        artifact.activationWriteEpoch ||
      currentPublic.lastBackendMutation.documentRevision !==
        binding.documentRevision ||
      currentPublic.lastBackendMutation.payloadDigest !== binding.payloadDigest
    ) {
      return failInverse("Updated public shift binding has drifted.");
    }
    return {targetPath: envelope.targetPath, document};
  });
  const operation = createRecoveryOperation({
    recoveryOperationId,
    recoveredAt: input.recoveredAt,
    activation,
    bundle: input.bundle,
    recoveryWriteEpoch: authoritative.recoveryWriteEpoch,
    deletedPaths,
  });
  const requireCurrentDocument = (
    targetPath: string,
  ): ShiftPlanningRecoveryReadDocument => {
    const document = currentDocuments.get(targetPath);
    if (document === undefined) {
      return failInverse("Recovery current document disappeared.");
    }
    return document;
  };
  const mutations: ShiftPlanningFirestoreMutation[] = [
    ...deletedPaths.map((documentPath) => ({
      kind: "delete" as const,
      documentPath,
      precondition: {
        lastUpdateTime: requireCurrentDocument(documentPath).updateTime,
      },
    })),
    ...restoredDocuments.map(({targetPath, document}) => ({
      kind: "update" as const,
      documentPath: targetPath,
      data: buildShiftPlanningExactReplacementData({
        desired: document,
        current: requireCurrentDocument(targetPath).data,
      }),
      precondition: {
        lastUpdateTime: requireCurrentDocument(targetPath).updateTime,
      },
    })),
    {
      kind: "update" as const,
      documentPath: requestPath,
      data: requestDocument,
      precondition: {lastUpdateTime: input.requestDocument.updateTime},
    },
    {
      kind: "update" as const,
      documentPath: operationPath,
      data: buildShiftPlanningExactReplacementData({
        desired: operation,
        current: input.activationOperationDocument.data,
      }),
      precondition: {
        lastUpdateTime: input.activationOperationDocument.updateTime,
      },
    },
  ].sort((left, right) => left.documentPath < right.documentPath ? -1 :
    left.documentPath > right.documentPath ? 1 : 0);
  if (
    new Set(mutations.map((item) => item.documentPath)).size !==
      mutations.length ||
    mutations.length !== artifact.budgets.inverse.totalWrites ||
    deletedPaths.length !== artifact.budgets.inverse.deleteWrites ||
    restoredDocuments.length + 2 !== artifact.budgets.inverse.updateWrites
  ) {
    return failInverse("Inverse mutations do not match their exact budget.");
  }
  return {
    operationPath,
    operation,
    recoveryWriteEpoch: authoritative.recoveryWriteEpoch,
    restoredDocuments,
    deletedPaths,
    mutations,
  };
};

/**
 * Materializes and seals one complete inverse recovery in the SDK-owned batch
 * of the current transaction attempt.
 * @param {MeasureAndSealShiftPlanningInverseRecoveryAttemptInput} input Real
 * transaction and the complete recovery read-set resolved in that callback.
 * @return {Promise<ShiftPlanningInverseRecoveryAttempt>} Exact inverse batch
 * and in-memory CommitRequest measurement.
 */
export const measureAndSealShiftPlanningInverseRecoveryAttempt = async (
  input: MeasureAndSealShiftPlanningInverseRecoveryAttemptInput,
): Promise<ShiftPlanningInverseRecoveryAttempt> => {
  const materialization = materializeShiftPlanningInverseRecovery(input);
  const artifact = input.bundle.artifact;
  const measurement =
    await measureAndSealShiftPlanningFirestoreTransactionAttempt({
      firestore: input.firestore,
      transaction: input.transaction,
      mutations: materialization.mutations,
      writerFenceCheckedAt: input.recoveredAt,
      direction: "inverse",
      manifestDigest:
        artifact.transactionRequirements.inverseManifestDigest,
      expectedDocumentWriteCount: artifact.budgets.inverse.totalWrites,
      authority: artifact.expectedState.transactionMeasurementAuthority,
      writeLimit: artifact.budgets.inverse.writeLimit,
      byteLimit: artifact.transactionRequirements.byteLimit,
    });
  return {materialization, measurement};
};
