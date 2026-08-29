import {
  DocumentSnapshot,
  Firestore,
  Timestamp,
  Transaction,
} from "@google-cloud/firestore";
import {
  SHIFT_PLANNING_FIRESTORE_TRANSACTION_WRITE_LIMIT,
  ShiftPlanningBundleInput,
  planShiftPlanningBundle,
} from "./shift-planning-bundle.js";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {
  ShiftPlanningDigest,
  ShiftPlanningFairnessSnapshot,
  canonicalShiftPlanningJson,
  createShiftPlanningDigest,
  normalizeShiftPlanningFairnessSnapshot,
} from "./shift-planning-digest.js";
import {
  ShiftPlanningForwardActivationAttemptResolution,
  ShiftPlanningForwardActivationAttemptResolver,
  ShiftPlanningInverseRecoveryAttemptResolution,
  ShiftPlanningInverseRecoveryAttemptResolver,
} from "./shift-planning-firestore-cas-runtime.js";
import {
  parseCandidatePositionDocuments,
  parsePersistedBundle,
  parsePersistedCandidate,
} from "./shift-planning-firestore-repository.js";
import {
  ShiftPlanningActivationReadDocument,
} from "./shift-planning-forward-materializer.js";
import {
  ShiftPlanningRecoveryReadDocument,
} from "./shift-planning-inverse-materializer.js";
import {
  parseShiftPlanningActivationOperationTerminal,
} from "./shift-planning-publication-contract.js";
import {
  parseShiftPlanningActivationProcessingRequest,
} from "./shift-planning-persistence.js";
import {
  buildShiftPlanningAuthoritativeState,
} from "./shift-planning-state-persistence.js";
import {
  ShiftPlanningEnvironment,
  parseShiftPlanningRequestV2,
} from "./shift-planning-wire.js";

export const SHIFT_PLANNING_LIVE_SOURCE_SCHEMA_VERSION = 1 as const;
export const SHIFT_PLANNING_LIVE_SOURCE_DOCUMENT_ID = "fairness" as const;

export type ShiftPlanningLiveSourceInputs = {
  fairnessSnapshot: ShiftPlanningFairnessSnapshot;
  delivery: {
    continuity: ShiftPlanningBundleInput["delivery"]["continuity"];
    inheritedTargetPrefix: NonNullable<
      ShiftPlanningBundleInput["delivery"]["inheritedTargetPrefix"]
    > | null;
    futureProjectionOccupancy: NonNullable<
      ShiftPlanningBundleInput["delivery"]["futureProjectionOccupancy"]
    >;
  };
  market: {
    inheritedTargetPrefix: NonNullable<
      ShiftPlanningBundleInput["market"]["inheritedTargetPrefix"]
    > | null;
    futureProjectionOccupancy: NonNullable<
      ShiftPlanningBundleInput["market"]["futureProjectionOccupancy"]
    >;
  };
  transactionWriteLimit: number;
};

export type ShiftPlanningLiveSourceDocument = {
  schemaVersion: typeof SHIFT_PLANNING_LIVE_SOURCE_SCHEMA_VERSION;
  environment: ShiftPlanningEnvironment;
  sourceRevision: string;
  inputs: ShiftPlanningLiveSourceInputs;
  sourceDigest: ShiftPlanningDigest;
};

export type ShiftPlanningLiveSourceRebuilder = (input: {
  firestore: Firestore;
  transaction: Transaction;
  environment: ShiftPlanningEnvironment;
}) => Promise<ShiftPlanningLiveSourceDocument>;

type UnknownRecord = Record<string, unknown>;

const failSource = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_transaction", message);
};

const requireRecord = (value: unknown, name: string): UnknownRecord => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return failSource(`${name} must be a plain object.`);
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
    failSource(`${name} fields are not exact.`);
  }
};

const requireEnvironment = (value: unknown): ShiftPlanningEnvironment => {
  if (value !== "develop" && value !== "production") {
    return failSource("Planning source environment is invalid.");
  }
  return value;
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failSource(`${name} is not a valid identifier.`);
  }
  return value;
};

const requireDigest = (value: unknown, name: string): ShiftPlanningDigest => {
  if (
    typeof value !== "string" ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return failSource(`${name} is not a planning digest.`);
  }
  return value as ShiftPlanningDigest;
};

const canonicalClone = <Value>(value: Value, name: string): Value => {
  try {
    return JSON.parse(canonicalShiftPlanningJson(value)) as Value;
  } catch {
    return failSource(`${name} is not canonical planning JSON.`);
  }
};

const normalizedSourceInputs = (
  value: unknown,
): ShiftPlanningLiveSourceInputs => {
  const inputs = requireRecord(value, "planning source inputs");
  requireExactKeys(
    inputs,
    ["fairnessSnapshot", "delivery", "market", "transactionWriteLimit"],
    "planning source inputs",
  );
  const delivery = requireRecord(inputs.delivery, "delivery source");
  requireExactKeys(
    delivery,
    ["continuity", "inheritedTargetPrefix", "futureProjectionOccupancy"],
    "delivery source",
  );
  const market = requireRecord(inputs.market, "market source");
  requireExactKeys(
    market,
    ["inheritedTargetPrefix", "futureProjectionOccupancy"],
    "market source",
  );
  if (
    !Number.isSafeInteger(inputs.transactionWriteLimit) ||
    (inputs.transactionWriteLimit as number) < 1 ||
    (inputs.transactionWriteLimit as number) >
      SHIFT_PLANNING_FIRESTORE_TRANSACTION_WRITE_LIMIT
  ) {
    return failSource("Planning source write limit is invalid.");
  }
  return {
    fairnessSnapshot: normalizeShiftPlanningFairnessSnapshot(
      inputs.fairnessSnapshot,
    ),
    delivery: canonicalClone({
      continuity: delivery.continuity,
      inheritedTargetPrefix: delivery.inheritedTargetPrefix,
      futureProjectionOccupancy: delivery.futureProjectionOccupancy,
    }, "delivery source") as ShiftPlanningLiveSourceInputs["delivery"],
    market: canonicalClone({
      inheritedTargetPrefix: market.inheritedTargetPrefix,
      futureProjectionOccupancy: market.futureProjectionOccupancy,
    }, "market source") as ShiftPlanningLiveSourceInputs["market"],
    transactionWriteLimit: inputs.transactionWriteLimit as number,
  };
};

const liveSourceDigest = (input: {
  environment: ShiftPlanningEnvironment;
  sourceRevision: string;
  inputs: ShiftPlanningLiveSourceInputs;
}): ShiftPlanningDigest => createShiftPlanningDigest({
  schemaVersion: SHIFT_PLANNING_LIVE_SOURCE_SCHEMA_VERSION,
  environment: input.environment,
  sourceRevision: input.sourceRevision,
  inputs: input.inputs,
});

/**
 * Builds the one backend-owned live source envelope shared by future
 * preview/stage production and every activation retry. Its nested snapshot
 * retains the exact
 * versioned membership, roster, policy/calendar, override, credit, workbook,
 * measurement-authority, and migration-baseline inputs.
 * @param {object} input Environment, revision, and complete planning inputs.
 * @return {ShiftPlanningLiveSourceDocument} Canonical digest-bound envelope.
 */
export const createShiftPlanningLiveSourceDocument = (input: {
  environment: ShiftPlanningEnvironment;
  sourceRevision: string;
  inputs: unknown;
}): ShiftPlanningLiveSourceDocument => {
  const environment = requireEnvironment(input.environment);
  const sourceRevision = requireIdentifier(
    input.sourceRevision,
    "planning sourceRevision",
  );
  const inputs = normalizedSourceInputs(input.inputs);
  if (inputs.fairnessSnapshot.environment !== environment) {
    return failSource("Planning source snapshot environment has drifted.");
  }
  return {
    schemaVersion: SHIFT_PLANNING_LIVE_SOURCE_SCHEMA_VERSION,
    environment,
    sourceRevision,
    inputs,
    sourceDigest: liveSourceDigest({environment, sourceRevision, inputs}),
  };
};

/**
 * Parses and re-digests an untrusted live planning source document.
 * @param {unknown} value Untrusted Firestore document data.
 * @return {ShiftPlanningLiveSourceDocument} Canonical live source envelope.
 */
export const parseShiftPlanningLiveSourceDocument = (
  value: unknown,
): ShiftPlanningLiveSourceDocument => {
  const source = requireRecord(value, "planning live source");
  requireExactKeys(source, [
    "schemaVersion",
    "environment",
    "sourceRevision",
    "inputs",
    "sourceDigest",
  ], "planning live source");
  if (source.schemaVersion !== SHIFT_PLANNING_LIVE_SOURCE_SCHEMA_VERSION) {
    return failSource("Planning source schema is unsupported.");
  }
  const environment = requireEnvironment(source.environment);
  const sourceRevision = requireIdentifier(
    source.sourceRevision,
    "planning sourceRevision",
  );
  const inputs = normalizedSourceInputs(source.inputs);
  const sourceDigest = requireDigest(source.sourceDigest, "sourceDigest");
  if (
    inputs.fairnessSnapshot.environment !== environment ||
    liveSourceDigest({environment, sourceRevision, inputs}) !== sourceDigest
  ) {
    return failSource("Planning live source digest does not match.");
  }
  return {
    schemaVersion: SHIFT_PLANNING_LIVE_SOURCE_SCHEMA_VERSION,
    environment,
    sourceRevision,
    inputs,
    sourceDigest,
  };
};

const planningRoot = (environment: ShiftPlanningEnvironment): string =>
  `${environment}/plus-collections`;

const planningRequestValue = (
  request: ReturnType<typeof parseShiftPlanningRequestV2>,
): object => ({
  schemaVersion: request.schemaVersion,
  requestId: request.requestId,
  bundleId: request.bundleId,
  environment: request.environment,
  requestedByUserId: request.requestedByUserId,
  requestedAt: Timestamp.fromMillis(request.requestedAtMillis),
  mode: request.mode,
  status: "requested",
  expectedWriteEpoch: request.expectedWriteEpoch,
  expectedActiveRevision: request.expectedActiveRevision,
  subplans: request.subplans,
  binding: request.binding,
});

const requireReadDocument = (
  snapshot: DocumentSnapshot,
  name: string,
): ShiftPlanningActivationReadDocument => {
  const data = snapshot.data();
  if (
    !snapshot.exists ||
    data === undefined ||
    snapshot.updateTime === undefined
  ) {
    return failSource(`${name} is missing.`);
  }
  return {
    targetPath: snapshot.ref.path,
    data,
    updateTime: snapshot.updateTime,
  };
};

const requireRecoveryReadDocument = (
  snapshot: DocumentSnapshot,
  name: string,
): ShiftPlanningRecoveryReadDocument => requireReadDocument(snapshot, name);

/**
 * Creates the concrete forward resolver used inside every Firestore retry. It
 * reloads the immutable staged package, cached envelope, rebuilt governed
 * source, both authoritative rotations/state, and every before-image target
 * before the runtime is allowed to materialize a write.
 * @param {object} input Environment, request identity, and source rebuilder.
 * @return {ShiftPlanningForwardActivationAttemptResolver} Retry-scoped
 * forward resolver.
 */
export const createFirestoreShiftPlanningForwardActivationResolver = (input: {
  environment: ShiftPlanningEnvironment;
  requestId: string;
  rebuildLiveSource: ShiftPlanningLiveSourceRebuilder;
}): ShiftPlanningForwardActivationAttemptResolver => {
  const environment = requireEnvironment(input.environment);
  const requestId = requireIdentifier(input.requestId, "activation requestId");
  const root = planningRoot(environment);
  return async ({firestore, transaction}): Promise<
    ShiftPlanningForwardActivationAttemptResolution
  > => {
    const requestSnapshot = await transaction.get(
      firestore.doc(`${root}/shiftPlanningRequests/${requestId}`),
    );
    const requestDocument = requireReadDocument(
      requestSnapshot,
      "activation request",
    );
    const request = parseShiftPlanningActivationProcessingRequest(
      requestDocument.data,
    ).request;
    if (
      request.environment !== environment ||
      request.requestId !== requestId ||
      request.mode !== "activate" ||
      request.binding?.kind !== "candidate"
    ) {
      return failSource("Activation request identity or mode is invalid.");
    }
    const binding = request.binding;
    const candidateReference = firestore.doc(
      `${root}/shiftPlanningCandidates/${binding.candidateId}`,
    );
    const [candidateSnapshot, bundleSnapshot, sourceSnapshot,
      maintenanceSnapshot, deliveryRotationSnapshot, marketRotationSnapshot] =
      await transaction.getAll(
        candidateReference,
        firestore.doc(
          `${root}/shiftPlanningBundles/${binding.bundleRevision}`,
        ),
        firestore.doc(
          `${root}/shiftPlanningState/` +
            SHIFT_PLANNING_LIVE_SOURCE_DOCUMENT_ID,
        ),
        firestore.doc(`${root}/shiftPlanningState/current`),
        firestore.doc(`${root}/shiftRotations/delivery`),
        firestore.doc(`${root}/shiftRotations/market`),
      );
    const candidate = parsePersistedCandidate(
      requireReadDocument(candidateSnapshot, "staged candidate").data,
    );
    const bundle = parsePersistedBundle(
      requireReadDocument(bundleSnapshot, "persisted bundle").data,
    );
    const source = parseShiftPlanningLiveSourceDocument(
      requireReadDocument(sourceSnapshot, "planning live source").data,
    );
    let rebuiltSource: ShiftPlanningLiveSourceDocument;
    try {
      rebuiltSource = await input.rebuildLiveSource({
        firestore,
        transaction,
        environment,
      });
    } catch (error) {
      if (
        error instanceof ShiftPlanningError &&
        (
          error.code === "invalid_planning_transaction" ||
          error.code === "invalid_shift_planning_fairness_snapshot"
        )
      ) {
        throw new ShiftPlanningError(
          "fairness_input_drift",
          "Activation fairness inputs no longer reproduce the staged source.",
        );
      }
      throw error;
    }
    if (
      source.environment !== environment ||
      rebuiltSource.environment !== environment
    ) {
      return failSource(
        "Activation governed source environment has drifted.",
      );
    }
    if (rebuiltSource.sourceDigest !== source.sourceDigest) {
      throw new ShiftPlanningError(
        "fairness_input_drift",
        "Activation fairness inputs changed after the staged candidate.",
      );
    }
    if (
      candidate.bundleId !== binding.candidateId ||
      candidate.bundleRevision !== binding.bundleRevision ||
      candidate.bundleDigest !== binding.bundleDigest ||
      candidate.candidateDigest !== binding.candidateDigest ||
      bundle.bundleId !== candidate.bundleId ||
      bundle.bundleRevision !== candidate.bundleRevision ||
      bundle.bundleDigest !== candidate.bundleDigest ||
      bundle.artifactDigest !== candidate.bundleArtifactDigest
    ) {
      return failSource(
        "Activation staged package has drifted.",
      );
    }
    const positionSnapshots = await transaction.get(
      candidateReference.collection("positions").limit(
        candidate.candidate.positionManifest.positionDocumentCount + 1,
      ),
    );
    const positions = parseCandidatePositionDocuments({
      documents: positionSnapshots.docs,
      candidate,
      bundle,
    });
    const authoritativeState = buildShiftPlanningAuthoritativeState({
      environment,
      maintenance: requireReadDocument(
        maintenanceSnapshot,
        "maintenance state",
      ).data,
      rotations: {
        delivery: requireReadDocument(
          deliveryRotationSnapshot,
          "delivery rotation",
        ).data,
        market: requireReadDocument(
          marketRotationSnapshot,
          "market rotation",
        ).data,
      },
    });
    const liveResult = planShiftPlanningBundle({
      request: planningRequestValue(request),
      authoritativeState,
      fairnessSnapshot: source.inputs.fairnessSnapshot,
      delivery: source.inputs.delivery,
      market: source.inputs.market,
      transactionWriteLimit: source.inputs.transactionWriteLimit,
      stagedCandidate: candidate.candidate,
    });
    const beforeImageSnapshots = await transaction.getAll(
      ...bundle.artifact.manifests.inverse.restoreBeforeImages.map(
        ({targetPath}) => firestore.doc(targetPath),
      ),
    );
    return {
      preflight: {request, candidate, bundle, positions},
      liveResult,
      requestDocument,
      beforeImageDocuments: beforeImageSnapshots.map((snapshot, index) =>
        requireReadDocument(
          snapshot,
          `activation before-image target ${index + 1}`,
        )),
    };
  };
};

const resolveManifestPath = (
  template: string,
  input: {
    bundleRevision: string;
    bundleDigest: string;
    operationId: string;
  },
): string => template
  .split("{bundleRevision}").join(input.bundleRevision)
  .split("{bundleDigest}").join(input.bundleDigest)
  .split("{operationId}").join(input.operationId);

/**
 * Creates the inverse resolver that reloads the activation tombstone, immutable
 * bundle, terminal request, complete before-image collection, and every current
 * delete/restore target inside the recovery transaction attempt.
 * @param {object} input Environment and parent activation identity.
 * @return {ShiftPlanningInverseRecoveryAttemptResolver} Retry-scoped inverse
 * resolver.
 */
export const createFirestoreShiftPlanningInverseRecoveryResolver = (input: {
  environment: ShiftPlanningEnvironment;
  activationOperationId: string;
}): ShiftPlanningInverseRecoveryAttemptResolver => {
  const environment = requireEnvironment(input.environment);
  const activationOperationId = requireIdentifier(
    input.activationOperationId,
    "activation operationId",
  );
  const root = planningRoot(environment);
  return async ({firestore, transaction}): Promise<
    ShiftPlanningInverseRecoveryAttemptResolution
  > => {
    const operationReference = firestore.doc(
      `${root}/shiftPlanningOperations/${activationOperationId}`,
    );
    const operationSnapshot = await transaction.get(operationReference);
    const activationOperationDocument = requireRecoveryReadDocument(
      operationSnapshot,
      "activation operation",
    );
    const activation = parseShiftPlanningActivationOperationTerminal(
      activationOperationDocument.data,
    );
    if (
      activation.environment !== environment ||
      activation.operationId !== activationOperationId
    ) {
      return failSource("Recovery activation identity has drifted.");
    }
    const [bundleSnapshot, requestSnapshot, beforeImageSnapshots] =
      await Promise.all([
        transaction.get(firestore.doc(
          `${root}/shiftPlanningBundles/${activation.bundleRevision}`,
        )),
        transaction.get(firestore.doc(
          `${root}/shiftPlanningRequests/${activation.requestId}`,
        )),
        transaction.get(
          operationReference.collection("beforeImages").limit(
            activation.beforeImages.length + 1,
          ),
        ),
      ]);
    const bundle = parsePersistedBundle(
      requireRecoveryReadDocument(bundleSnapshot, "recovery bundle").data,
    );
    if (
      bundle.environment !== environment ||
      bundle.bundleId !== activation.candidateId ||
      bundle.bundleRevision !== activation.bundleRevision ||
      bundle.bundleDigest !== activation.bundleDigest
    ) {
      return failSource("Recovery bundle lineage has drifted.");
    }
    if (beforeImageSnapshots.size !== activation.beforeImages.length) {
      return failSource("Recovery before-image collection has drifted.");
    }
    const beforeImageDocuments = beforeImageSnapshots.docs.map(
      (snapshot, index) => requireRecoveryReadDocument(
        snapshot,
        `recovery before-image ${index + 1}`,
      ),
    );
    const currentPaths = [
      ...bundle.artifact.manifests.inverse.deleteCreatedDocuments.map(
        ({pathTemplate}) => resolveManifestPath(pathTemplate, {
          bundleRevision: bundle.bundleRevision,
          bundleDigest: bundle.bundleDigest,
          operationId: activation.operationId,
        }),
      ),
      ...bundle.artifact.manifests.inverse.restoreBeforeImages.map(
        ({targetPath}) => targetPath,
      ),
    ].sort();
    if (new Set(currentPaths).size !== currentPaths.length) {
      return failSource("Recovery current read-set contains duplicates.");
    }
    const currentSnapshots = await transaction.getAll(
      ...currentPaths.map((path) => firestore.doc(path)),
    );
    return {
      bundle,
      activationOperationDocument,
      requestDocument: requireRecoveryReadDocument(
        requestSnapshot,
        "recovery request",
      ),
      beforeImageDocuments,
      currentDocuments: currentSnapshots.map((snapshot, index) =>
        requireRecoveryReadDocument(
          snapshot,
          `recovery current target ${index + 1}`,
        )),
    };
  };
};
