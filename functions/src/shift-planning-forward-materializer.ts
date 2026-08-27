import {
  DocumentData,
  Firestore,
  Timestamp,
  Transaction,
} from "@google-cloud/firestore";
import {
  ShiftPlanningBundleResult,
  parseShiftPlanningExpectedState,
  validateShiftPlanningStagedCandidate,
} from "./shift-planning-bundle.js";
import {
  ShiftPlanningPersistedCandidatePosition,
  validateShiftPlanningCandidatePositionSet,
} from "./shift-planning-candidate.js";
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
  ShiftPlanningActivationPreflight,
  ShiftPlanningActivationProcessingRequest,
  SHIFT_PLANNING_PERSISTENCE_SCHEMA_VERSION,
  ShiftPlanningPersistedBundleArtifact,
  ShiftPlanningPersistedArtifact,
  buildShiftPlanningCompletedSummary,
  parseShiftPlanningActivationProcessingRequest,
} from "./shift-planning-persistence.js";
import {
  ShiftPlanningActivationOperationTerminal,
  ShiftPlanningBeforeImageEnvelope,
  ShiftPlanningPublicShiftDocument,
  ShiftPlanningPublicShiftMaterialization,
  attachShiftPlanningBackendMutationMarker,
  buildShiftPlanningPublicShiftMaterialization,
  createShiftPlanningActivationOperationTerminal,
  createShiftPlanningBeforeImageEnvelope,
  createShiftPlanningPublicShiftMaterialization,
  parseShiftPlanningPublicShiftDocument,
} from "./shift-planning-publication-contract.js";
import {
  ShiftPlanningMaintenanceState,
  ShiftPlanningRequestV2,
  ShiftRotationAggregateWire,
  parseShiftPlanningMaintenanceState,
  parseShiftPlanningRequestV2,
  parseShiftRotationAggregateWire,
} from "./shift-planning-wire.js";

export type ShiftPlanningActivationReadDocument = {
  targetPath: string;
  data: DocumentData;
  updateTime: Timestamp;
};

export type MaterializeShiftPlanningForwardActivationInput = {
  operationId: string;
  workerId: string;
  fencingEpoch: number;
  leaseDurationMillis: number;
  attemptedAt: Timestamp;
  preflight: ShiftPlanningActivationPreflight;
  liveResult: ShiftPlanningBundleResult;
  requestDocument: ShiftPlanningActivationReadDocument;
  beforeImageDocuments: readonly ShiftPlanningActivationReadDocument[];
};

export type ShiftPlanningForwardPublicDocument = {
  mutationKind: "create" | "update";
  targetPath: string;
  document: ShiftPlanningPublicShiftDocument;
};

export type ShiftPlanningForwardActivationMaterialization = {
  operationPath: string;
  operation: ShiftPlanningActivationOperationTerminal;
  beforeImages: readonly ShiftPlanningBeforeImageEnvelope[];
  publicDocuments: readonly ShiftPlanningForwardPublicDocument[];
  mutations: readonly ShiftPlanningFirestoreMutation[];
};

export type MeasureAndSealShiftPlanningForwardActivationAttemptInput =
  MaterializeShiftPlanningForwardActivationInput & {
    firestore: Firestore;
    transaction: Transaction;
  };

export type ShiftPlanningForwardActivationAttempt = {
  materialization: ShiftPlanningForwardActivationMaterialization;
  measurement: ShiftPlanningFirestoreCommitMeasurement;
};

const failForward = (message: string): never => {
  throw new ShiftPlanningError(
    "invalid_planning_forward_materialization",
    message,
  );
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failForward(`${name} is not a valid identifier.`);
  }
  return value;
};

const requirePositiveInteger = (value: unknown, name: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    return failForward(`${name} must be a positive safe integer.`);
  }
  return value as number;
};

const requireTimestamp = (value: unknown, name: string): Timestamp => {
  if (!(value instanceof Timestamp)) {
    return failForward(`${name} must be a Firestore Timestamp.`);
  }
  return value;
};

const requireDocumentPath = (
  value: unknown,
  environment: string,
  name: string,
): string => {
  if (typeof value !== "string") {
    return failForward(`${name} must be a document path.`);
  }
  const segments = value.split("/");
  if (
    segments.length < 4 ||
    segments.length % 2 !== 0 ||
    segments.some((segment) => segment.length < 1) ||
    segments[0] !== environment ||
    segments[1] !== "plus-collections"
  ) {
    return failForward(`${name} is not a canonical planning path.`);
  }
  return value;
};

const sameDigest = (left: unknown, right: unknown): boolean =>
  createShiftPlanningDigest(left) === createShiftPlanningDigest(right);

const parsedRequest = (
  request: ShiftPlanningRequestV2,
): ShiftPlanningRequestV2 => parseShiftPlanningRequestV2({
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

const persistedArtifact = (
  result: ShiftPlanningBundleResult,
): ShiftPlanningPersistedBundleArtifact => ({
  schemaVersion: result.schemaVersion,
  bundleId: result.bundleId,
  environment: result.environment,
  bundleRevision: result.bundleRevision,
  bundleDigest: result.bundleDigest,
  expectedWriteEpoch: result.expectedWriteEpoch,
  activationWriteEpoch: result.activationWriteEpoch,
  expectedActiveRevision: result.expectedActiveRevision,
  expectedState: parseShiftPlanningExpectedState(result.expectedState),
  frontiers: result.frontiers,
  delivery: result.delivery,
  market: result.market,
  manifests: result.manifests,
  budgets: result.budgets,
  releaseLeaseIntents: result.releaseLeaseIntents,
  syncCommands: result.syncCommands,
  heldNotificationIntents: result.heldNotificationIntents,
  transactionRequirements: result.transactionRequirements,
});

const requireLiveLineage = (input: {
  preflight: ShiftPlanningActivationPreflight;
  liveResult: ShiftPlanningBundleResult;
}): {
  request: ShiftPlanningRequestV2;
  artifact: ShiftPlanningPersistedBundleArtifact;
  positions: readonly ShiftPlanningPersistedCandidatePosition[];
} => {
  const request = parsedRequest(input.preflight.request);
  const candidate = input.preflight.candidate;
  const bundle = input.preflight.bundle;
  const liveArtifact = persistedArtifact(input.liveResult);
  const stagedCandidate = validateShiftPlanningStagedCandidate({
    value: candidate.candidate,
  });
  if (
    request.mode !== "activate" ||
    request.binding?.kind !== "candidate" ||
    input.liveResult.mode !== "activate" ||
    input.liveResult.requestId !== request.requestId ||
    input.liveResult.bundleId !== request.bundleId ||
    input.liveResult.environment !== request.environment ||
    bundle.schemaVersion !== SHIFT_PLANNING_PERSISTENCE_SCHEMA_VERSION ||
    bundle.environment !== request.environment ||
    bundle.bundleId !== request.bundleId ||
    bundle.bundleRevision !== input.liveResult.bundleRevision ||
    bundle.bundleDigest !== input.liveResult.bundleDigest ||
    !sameDigest(bundle.artifact, liveArtifact) ||
    bundle.artifactDigest !== createShiftPlanningDigest(liveArtifact) ||
    candidate.bundleArtifactDigest !== bundle.artifactDigest ||
    candidate.schemaVersion !== SHIFT_PLANNING_PERSISTENCE_SCHEMA_VERSION ||
    candidate.status !== "staged" ||
    candidate.environment !== request.environment ||
    candidate.candidateDigest !== createShiftPlanningDigest(stagedCandidate) ||
    candidate.bundleId !== bundle.bundleId ||
    candidate.bundleRevision !== bundle.bundleRevision ||
    candidate.bundleDigest !== bundle.bundleDigest ||
    request.binding.candidateId !== candidate.bundleId ||
    request.binding.bundleRevision !== candidate.bundleRevision ||
    request.binding.bundleDigest !== candidate.bundleDigest ||
    request.binding.candidateDigest !== candidate.candidateDigest ||
    input.liveResult.stagedCandidateDigest !== candidate.candidateDigest ||
    input.liveResult.stagedCandidate === null ||
    !sameDigest(input.liveResult.stagedCandidate, stagedCandidate) ||
    stagedCandidate.expectedStateDigest !==
      createShiftPlanningDigest(liveArtifact.expectedState) ||
    input.liveResult.transactionRequirements.forwardManifestDigest !==
      createShiftPlanningDigest(liveArtifact.manifests.forward)
  ) {
    return failForward(
      "Live activation inputs do not reproduce the staged bundle exactly.",
    );
  }
  const positions = validateShiftPlanningCandidatePositionSet({
    manifest: stagedCandidate.positionManifest,
    positions: input.preflight.positions,
    candidateId: candidate.bundleId,
    candidateDigest: candidate.candidateDigest,
    bundleRevision: candidate.bundleRevision,
    bundleDigest: candidate.bundleDigest,
    writeEpoch: liveArtifact.activationWriteEpoch,
  });
  if (
    liveArtifact.budgets.forward.creditLedgerWrites !== 0 ||
    liveArtifact.manifests.forward.creditLedgerWriteCount !== 0
  ) {
    return failForward(
      "Credit-ledger forward writes require the HU-084 materializer.",
    );
  }
  return {request, artifact: liveArtifact, positions};
};

const readDocumentsByPath = (input: {
  environment: string;
  documents: readonly ShiftPlanningActivationReadDocument[];
}): Map<string, ShiftPlanningActivationReadDocument> => {
  const documents = new Map<string, ShiftPlanningActivationReadDocument>();
  for (const document of input.documents) {
    const targetPath = requireDocumentPath(
      document.targetPath,
      input.environment,
      "Activation read target",
    );
    requireTimestamp(document.updateTime, `${targetPath} updateTime`);
    if (documents.has(targetPath)) {
      return failForward("Activation read-set contains a duplicate target.");
    }
    documents.set(targetPath, {...document, targetPath});
  }
  return documents;
};

const nextRotationState = (input: {
  type: "delivery" | "market";
  artifact: ShiftPlanningPersistedBundleArtifact;
  attemptedAt: Timestamp;
}): ShiftRotationAggregateWire => {
  const expected = input.artifact.expectedState.authoritativeState
    .rotations[input.type];
  const transition = input.artifact.manifests.forward.rotations[input.type];
  const leaseIntent = input.artifact.releaseLeaseIntents.find(
    ({type}) => type === input.type,
  );
  const manifestLeaseIntent =
    input.artifact.manifests.forward.releaseLeaseIntents.find(
      ({type}) => type === input.type,
    );
  if (
    leaseIntent === undefined ||
    manifestLeaseIntent === undefined ||
    leaseIntent.action !== "acquire" ||
    leaseIntent.state !== "sealed" ||
    leaseIntent.bundleId !== input.artifact.bundleId ||
    leaseIntent.bundleRevision !== input.artifact.bundleRevision ||
    leaseIntent.bundleDigest !== input.artifact.bundleDigest ||
    leaseIntent.expectedCurrentLease !== null ||
    transition.stateRevisionBefore !== expected.stateRevision ||
    transition.frontierBefore.stateRevision !== expected.stateRevision ||
    transition.frontierBefore.seasonStartYear !==
      expected.planningFrontierSeasonStartYear ||
    transition.stateRevisionAfter !== expected.stateRevision + 1 ||
    !sameDigest({
      action: leaseIntent.action,
      type: leaseIntent.type,
      state: leaseIntent.state,
      bundleId: leaseIntent.bundleId,
      leaseEpoch: leaseIntent.leaseEpoch,
      ownerOperationId: leaseIntent.ownerOperationId,
      expectedCurrentLease: leaseIntent.expectedCurrentLease,
      deadlinePolicy: leaseIntent.deadlinePolicy,
    }, manifestLeaseIntent)
  ) {
    return failForward(`${input.type} forward rotation manifest drifted.`);
  }
  const acquiredAtMillis = input.attemptedAt.toMillis();
  const deadlineAtMillis = acquiredAtMillis +
    leaseIntent.deadlinePolicy.durationMillis;
  if (!Number.isSafeInteger(deadlineAtMillis)) {
    return failForward(`${input.type} release lease deadline is unsafe.`);
  }
  return parseShiftRotationAggregateWire({
    ...expected,
    stateRevision: transition.stateRevisionAfter,
    cursor: transition.cursorAfter,
    planningFrontierSeasonStartYear:
      transition.frontierAfter.seasonStartYear,
    cohortFrozen: transition.cohortFrozenAfter,
    frozenCohortUserIds: [...transition.frozenCohortUserIdsAfter],
    activeRevision: input.artifact.bundleRevision,
    activeDigest: input.artifact.bundleDigest,
    lastIdempotencyKey:
      `${input.artifact.bundleRevision}:activation:${input.type}`,
    releaseLease: {
      type: input.type,
      bundleId: input.artifact.bundleId,
      bundleRevision: input.artifact.bundleRevision,
      bundleDigest: input.artifact.bundleDigest,
      leaseEpoch: leaseIntent.leaseEpoch,
      ownerOperationId: leaseIntent.ownerOperationId,
      state: "sealed",
      acquiredAtMillis,
      deadlineAtMillis,
    },
  }, input.type);
};

const nextMaintenanceState = (input: {
  artifact: ShiftPlanningPersistedBundleArtifact;
  operationId: string;
}): ShiftPlanningMaintenanceState => {
  const expected = input.artifact.expectedState.authoritativeState.maintenance;
  const transition = input.artifact.manifests.forward.activeState;
  if (
    transition.stateRevisionBefore !== expected.stateRevision ||
    transition.stateRevisionAfter !== expected.stateRevision + 1 ||
    transition.writeEpochBefore !== expected.writeEpoch ||
    transition.writeEpochAfter !== input.artifact.activationWriteEpoch ||
    transition.activeRevisionBefore !== expected.activeRevision
  ) {
    return failForward("Forward maintenance manifest drifted.");
  }
  return parseShiftPlanningMaintenanceState({
    ...expected,
    stateRevision: transition.stateRevisionAfter,
    writeEpoch: transition.writeEpochAfter,
    activeRevision: input.artifact.bundleRevision,
    activeDigest: input.artifact.bundleDigest,
    lastTransitionId: input.operationId,
  });
};

const isoDate = (timestamp: Timestamp): string =>
  new Date(timestamp.toMillis()).toISOString().slice(0, 10);

const predecessorMaterialization = (input: {
  artifact: ShiftPlanningPersistedBundleArtifact;
  beforeImage: ShiftPlanningActivationReadDocument;
  attemptedAt: Timestamp;
}): ShiftPlanningPublicShiftMaterialization => {
  const update = input.artifact.delivery.predecessorHelperUpdate;
  const guard = input.artifact.delivery.predecessorGuard;
  if (update === null || guard === null) {
    return failForward("Predecessor update has no exact continuity guard.");
  }
  const current = parseShiftPlanningPublicShiftDocument({
    targetPath: input.beforeImage.targetPath,
    value: input.beforeImage.data,
  });
  const completion = current.completion;
  if (
    current.type !== "delivery" ||
    input.beforeImage.targetPath.split("/").at(-1) !== guard.shiftId ||
    update.shiftId !== guard.shiftId ||
    isoDate(current.date) !== guard.expectedScheduledDate ||
    current.assignedUserIds[0] !== guard.expectedEffectiveLeadUserId ||
    current.assignmentRevision !== guard.expectedAssignmentRevision ||
    completion.revision !== guard.expectedCompletionRevision ||
    completion.state !== guard.expectedCompletionState ||
    current.helperUserId !== guard.expectedPlannedHelperUserId ||
    completion.actualHelperUserId !== guard.expectedActualHelperUserId ||
    completion.helperSourceAssignmentRevision !==
      guard.expectedHelperSourceAssignmentRevision ||
    (completion.completedAt?.toMillis() ?? null) !==
      guard.expectedCompletedAtMillis ||
    completion.state !== "uncompleted" ||
    current.assignmentRevision === Number.MAX_SAFE_INTEGER ||
    current.documentRevision === Number.MAX_SAFE_INTEGER
  ) {
    return failForward("Delivery predecessor changed after planning.");
  }
  const payload: Record<string, unknown> = {...current};
  if (!Reflect.deleteProperty(payload, "lastBackendMutation")) {
    return failForward("Delivery predecessor marker cannot be replaced.");
  }
  return createShiftPlanningPublicShiftMaterialization({
    targetPath: input.beforeImage.targetPath,
    payload: {
      ...payload,
      helperUserId: update.helperUserId,
      planningRequestId: input.artifact.bundleId,
      bundleRevision: input.artifact.bundleRevision,
      bundleDigest: input.artifact.bundleDigest,
      writeEpoch: input.artifact.activationWriteEpoch,
      assignmentRevision: current.assignmentRevision + 1,
      documentRevision: current.documentRevision + 1,
      updatedAt: input.attemptedAt,
    },
  });
};

const requestTerminalDocument = (input: {
  request: ShiftPlanningRequestV2;
  artifact: ShiftPlanningPersistedBundleArtifact;
  liveResult: ShiftPlanningBundleResult;
  operationId: string;
  processingLifecycle: ShiftPlanningActivationProcessingRequest["lifecycle"];
  candidateId: string;
  candidateDigest: string;
  bundleArtifactDigest: string;
}): DocumentData => {
  const summary = buildShiftPlanningCompletedSummary(input.liveResult);
  const artifact: ShiftPlanningPersistedArtifact = {
    kind: "candidate",
    candidateId: input.candidateId,
    candidateDigest: input.candidateDigest,
    bundleArtifactDigest: input.bundleArtifactDigest,
  };
  const lifecycle = {
    schemaVersion: 1,
    operationId: input.operationId,
    requestIntentDigest: createShiftPlanningDigest(input.request),
    state: "completed",
    lease: {
      workerId: input.processingLifecycle.lease.workerId,
      fencingEpoch: input.processingLifecycle.lease.fencingEpoch,
      acquiredAt: Timestamp.fromMillis(
        input.processingLifecycle.lease.acquiredAtMillis,
      ),
      expiresAt: Timestamp.fromMillis(
        input.processingLifecycle.lease.expiresAtMillis,
      ),
    },
    terminalDigest: createShiftPlanningDigest({summary, artifact}),
    summary,
    artifact,
  };
  return {
    schemaVersion: input.request.schemaVersion,
    requestId: input.request.requestId,
    bundleId: input.request.bundleId,
    environment: input.request.environment,
    requestedByUserId: input.request.requestedByUserId,
    requestedAt: Timestamp.fromMillis(input.request.requestedAtMillis),
    mode: input.request.mode,
    status: "completed",
    expectedWriteEpoch: input.request.expectedWriteEpoch,
    expectedActiveRevision: input.request.expectedActiveRevision,
    subplans: input.request.subplans,
    binding: input.request.binding,
    lifecycle,
  };
};

const resolvedRecoveryCreatePaths = (
  artifact: ShiftPlanningPersistedBundleArtifact,
): string[] => artifact.manifests.inverse.deleteCreatedDocuments.map(
  ({pathTemplate}) => pathTemplate
    .split("{bundleRevision}").join(artifact.bundleRevision)
    .split("{bundleDigest}").join(artifact.bundleDigest),
).sort();

/**
 * Builds every mutation for one forward activation after a trusted resolver has
 * recomputed the complete live fairness snapshot in the same Firestore
 * transaction. The result remains local until the real attempt adapter seals
 * and the SDK commits that exact batch.
 * @param {MaterializeShiftPlanningForwardActivationInput} input Staged/live
 * lineage, transaction-read documents, and trusted callback clock.
 * @return {ShiftPlanningForwardActivationMaterialization} Exact ordered writes.
 */
export const materializeShiftPlanningForwardActivation = (
  input: MaterializeShiftPlanningForwardActivationInput,
): ShiftPlanningForwardActivationMaterialization => {
  const attemptedAt = requireTimestamp(input.attemptedAt, "attemptedAt");
  const operationId = requireIdentifier(input.operationId, "operationId");
  const workerId = requireIdentifier(input.workerId, "workerId");
  const fencingEpoch = requirePositiveInteger(
    input.fencingEpoch,
    "fencingEpoch",
  );
  const {request, artifact, positions} = requireLiveLineage(input);
  const root = `${request.environment}/plus-collections`;
  if (operationId !== `request-${request.requestId}`) {
    return failForward("Activation operation ID is not request-canonical.");
  }
  const requestPath = `${root}/shiftPlanningRequests/${request.requestId}`;
  const operationPath = `${root}/shiftPlanningOperations/${operationId}`;
  let processing: ShiftPlanningActivationProcessingRequest;
  try {
    processing = parseShiftPlanningActivationProcessingRequest(
      input.requestDocument.data,
    );
  } catch {
    return failForward("Activation request lifecycle is invalid.");
  }
  const processingLease = processing.lifecycle.lease;
  const attemptedAtMillis = attemptedAt.toMillis();
  if (
    requireDocumentPath(
      input.requestDocument.targetPath,
      request.environment,
      "Activation request target",
    ) !== requestPath ||
    !sameDigest(processing.request, request) ||
    processing.lifecycle.operationId !== operationId ||
    processingLease.workerId !== workerId ||
    processingLease.fencingEpoch !== fencingEpoch ||
    processingLease.expiresAtMillis - processingLease.acquiredAtMillis !==
      input.leaseDurationMillis ||
    attemptedAtMillis < processingLease.acquiredAtMillis ||
    attemptedAtMillis >= processingLease.expiresAtMillis
  ) {
    return failForward("Activation request changed after preflight.");
  }
  requireTimestamp(
    input.requestDocument.updateTime,
    "Activation request updateTime",
  );

  const beforeImageDocuments = readDocumentsByPath({
    environment: request.environment,
    documents: input.beforeImageDocuments,
  });
  const restoreContracts = artifact.manifests.inverse.restoreBeforeImages;
  if (
    beforeImageDocuments.size !== restoreContracts.length ||
    restoreContracts.some(({targetPath}) =>
      !beforeImageDocuments.has(targetPath))
  ) {
    return failForward("Activation before-image read-set is incomplete.");
  }
  const authoritativeTargets = new Set([
    `${root}/shiftRotations/delivery`,
    `${root}/shiftRotations/market`,
    `${root}/shiftPlanningState/current`,
  ]);
  for (const restore of restoreContracts) {
    const document = beforeImageDocuments.get(restore.targetPath);
    if (
      document === undefined ||
      (authoritativeTargets.has(restore.targetPath) &&
        createShiftPlanningDigest(document.data) !==
          restore.captureContractDigest)
    ) {
      return failForward("Activation before-image contract has drifted.");
    }
  }
  const beforeImages = restoreContracts.map((restore, index) => {
    const document = beforeImageDocuments.get(restore.targetPath);
    if (document === undefined) {
      return failForward("Activation before-image disappeared.");
    }
    return createShiftPlanningBeforeImageEnvelope({
      operationId,
      environment: request.environment,
      bundleRevision: artifact.bundleRevision,
      bundleDigest: artifact.bundleDigest,
      forwardManifestDigest:
        artifact.transactionRequirements.forwardManifestDigest,
      writeEpoch: artifact.activationWriteEpoch,
      ordinal: index + 1,
      targetPath: restore.targetPath,
      targetUpdateTime: document.updateTime,
      captureContractDigest: restore.captureContractDigest,
      document: document.data,
    });
  });

  const publicMaterializations: {
    mutationKind: "create" | "update";
    materialization: ShiftPlanningPublicShiftMaterialization;
  }[] = positions.map(({position}) => ({
    mutationKind: "create",
    materialization: buildShiftPlanningPublicShiftMaterialization({
      environment: request.environment,
      position,
      attemptedAt,
    }),
  }));
  if (artifact.delivery.predecessorHelperUpdate !== null) {
    const predecessorPath = `${root}/shifts/` +
      artifact.delivery.predecessorHelperUpdate.shiftId;
    const predecessor = beforeImageDocuments.get(predecessorPath);
    if (predecessor === undefined) {
      return failForward("Delivery predecessor before-image is missing.");
    }
    publicMaterializations.push({
      mutationKind: "update",
      materialization: predecessorMaterialization({
        artifact,
        beforeImage: predecessor,
        attemptedAt,
      }),
    });
  }
  const operation = createShiftPlanningActivationOperationTerminal({
    operationId,
    environment: request.environment,
    requestId: request.requestId,
    candidateId: input.preflight.candidate.bundleId,
    bundleRevision: artifact.bundleRevision,
    bundleDigest: artifact.bundleDigest,
    forwardManifestDigest:
      artifact.transactionRequirements.forwardManifestDigest,
    expectedStateDigest: createShiftPlanningDigest(artifact.expectedState),
    writeEpoch: artifact.activationWriteEpoch,
    attemptedAt,
    publicMutations: publicMaterializations.map((item) => ({
      mutationKind: item.mutationKind,
      targetPath: item.materialization.targetPath,
      documentRevision: item.materialization.documentRevision,
      payloadDigest: item.materialization.payloadDigest,
    })),
    beforeImages: beforeImages.map((beforeImage) => ({
      ordinal: beforeImage.ordinal,
      targetPath: beforeImage.targetPath,
      envelopePath: beforeImage.envelopePath,
      envelopeDigest: beforeImage.envelopeDigest,
    })),
  });
  const publicDocuments = publicMaterializations.map((item) => ({
    mutationKind: item.mutationKind,
    targetPath: item.materialization.targetPath,
    document: attachShiftPlanningBackendMutationMarker({
      materialization: item.materialization,
      operation,
    }),
  }));

  const deliveryRotation = nextRotationState({
    type: "delivery",
    artifact,
    attemptedAt,
  });
  const marketRotation = nextRotationState({
    type: "market",
    artifact,
    attemptedAt,
  });
  const maintenance = nextMaintenanceState({artifact, operationId});
  const requestTerminal = requestTerminalDocument({
    request,
    artifact,
    liveResult: input.liveResult,
    operationId,
    processingLifecycle: processing.lifecycle,
    candidateId: input.preflight.candidate.bundleId,
    candidateDigest: input.preflight.candidate.candidateDigest,
    bundleArtifactDigest: input.preflight.bundle.artifactDigest,
  });
  const mutationForPublic = (
    value: ShiftPlanningForwardPublicDocument,
  ): ShiftPlanningFirestoreMutation => {
    if (value.mutationKind === "create") {
      return {
        kind: "create",
        documentPath: value.targetPath,
        data: value.document,
      };
    }
    const beforeImage = beforeImageDocuments.get(value.targetPath);
    if (beforeImage === undefined) {
      return failForward("Updated public shift has no read precondition.");
    }
    return {
      kind: "update",
      documentPath: value.targetPath,
      data: value.document,
      precondition: {lastUpdateTime: beforeImage.updateTime},
    };
  };
  const updateMutation = (
    documentPath: string,
    data: DocumentData,
  ): ShiftPlanningFirestoreMutation => {
    const beforeImage = beforeImageDocuments.get(documentPath);
    if (beforeImage === undefined) {
      return failForward(`${documentPath} has no read precondition.`);
    }
    return {
      kind: "update",
      documentPath,
      data,
      precondition: {lastUpdateTime: beforeImage.updateTime},
    };
  };
  const mutations: ShiftPlanningFirestoreMutation[] = [
    ...publicDocuments.map(mutationForPublic),
    updateMutation(`${root}/shiftRotations/delivery`, deliveryRotation),
    updateMutation(`${root}/shiftRotations/market`, marketRotation),
    updateMutation(`${root}/shiftPlanningState/current`, maintenance),
    {
      kind: "update" as const,
      documentPath: requestPath,
      data: requestTerminal,
      precondition: {lastUpdateTime: input.requestDocument.updateTime},
    },
    ...artifact.syncCommands.map((command) => ({
      kind: "create" as const,
      documentPath:
        `${root}/shiftPlanningSyncCommands/${command.commandId}`,
      data: command,
    })),
    ...artifact.heldNotificationIntents.map((intent) => ({
      kind: "create" as const,
      documentPath:
        `${root}/shiftPlanningNotificationIntents/${intent.intentId}`,
      data: intent,
    })),
    ...beforeImages.map((beforeImage) => ({
      kind: "create" as const,
      documentPath: beforeImage.envelopePath,
      data: beforeImage,
    })),
    {
      kind: "create" as const,
      documentPath: operationPath,
      data: operation,
    },
  ].sort((left, right) =>
    left.documentPath < right.documentPath ? -1 :
      left.documentPath > right.documentPath ? 1 : 0);
  if (
    new Set(mutations.map(({documentPath}) => documentPath)).size !==
      mutations.length ||
    mutations.length !== artifact.budgets.forward.totalWrites ||
    publicDocuments.filter(({mutationKind}) => mutationKind === "create")
      .length !== artifact.budgets.forward.publicShiftWrites ||
    publicDocuments.filter(({mutationKind}) => mutationKind === "update")
      .length !== artifact.budgets.forward.predecessorHelperWrites
  ) {
    return failForward("Forward mutations do not match their exact budget.");
  }
  const recoverableCreates = mutations
    .filter((mutation) =>
      mutation.kind === "create" &&
      mutation.documentPath !== operationPath &&
      !mutation.documentPath.includes("/beforeImages/"))
    .map(({documentPath}) => documentPath)
    .sort();
  if (!sameDigest(recoverableCreates, resolvedRecoveryCreatePaths(artifact))) {
    return failForward("Forward creates do not match the inverse manifest.");
  }
  return {
    operationPath,
    operation,
    beforeImages,
    publicDocuments,
    mutations,
  };
};

/**
 * Materializes and seals one complete forward activation in the SDK-owned batch
 * of the current transaction attempt. Callers must resolve `preflight`, the
 * complete live bundle, request, and before-images from reads awaited in this
 * same callback. Firestore retries must call this function again with their new
 * transaction and freshly recomputed read-set.
 * @param {MeasureAndSealShiftPlanningForwardActivationAttemptInput} input Real
 * transaction plus all live activation inputs.
 * @return {Promise<ShiftPlanningForwardActivationAttempt>} Exact mutation and
 * measured CommitRequest evidence retained only in memory.
 */
export const measureAndSealShiftPlanningForwardActivationAttempt = async (
  input: MeasureAndSealShiftPlanningForwardActivationAttemptInput,
): Promise<ShiftPlanningForwardActivationAttempt> => {
  const materialization = materializeShiftPlanningForwardActivation(input);
  const artifact = input.preflight.bundle.artifact;
  const measurement =
    await measureAndSealShiftPlanningFirestoreTransactionAttempt({
      firestore: input.firestore,
      transaction: input.transaction,
      mutations: materialization.mutations,
      direction: "forward",
      manifestDigest:
        artifact.transactionRequirements.forwardManifestDigest,
      expectedDocumentWriteCount: artifact.budgets.forward.totalWrites,
      authority: artifact.expectedState.transactionMeasurementAuthority,
      writeLimit: artifact.budgets.forward.writeLimit,
      byteLimit: artifact.transactionRequirements.byteLimit,
    });
  return {materialization, measurement};
};
