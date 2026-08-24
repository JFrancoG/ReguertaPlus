import {
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  Timestamp,
  Transaction,
} from "firebase-admin/firestore";
import {
  SHIFT_PLANNING_BUNDLE_SCHEMA_VERSION,
  ShiftPlanningBundleResult,
  parseShiftPlanningExpectedState,
  parseShiftPlanningPreviewReceipt,
  parseShiftPlanningStagedCandidateArtifact,
  validateShiftPlanningStagedCandidate,
} from "./shift-planning-bundle.js";
import {
  ShiftPlanningError,
  ShiftPlanningFailureCode,
  requirePlanningRequestId,
} from "./shift-planning-contract.js";
import {createShiftPlanningDigest} from "./shift-planning-digest.js";
import {
  SHIFT_PLANNING_PERSISTENCE_SCHEMA_VERSION,
  ShiftPlanningActivationPreflight,
  ShiftPlanningClaimToken,
  ShiftPlanningPersistedArtifact,
  ShiftPlanningPersistedBundle,
  ShiftPlanningPersistedBundleArtifact,
  ShiftPlanningPersistedCandidate,
  ShiftPlanningPersistedLifecycle,
  ShiftPlanningPersistedPreview,
  ShiftPlanningPersistence,
  ShiftPlanningPersistenceResult,
  ShiftPlanningProcessingLease,
  ShiftPlanningRequestClaim,
  ShiftPlanningTerminalSummary,
  buildShiftPlanningCompletedSummary,
} from "./shift-planning-persistence.js";
import {
  SHIFT_PLANNING_COLLECTIONS,
  SHIFT_PLANNING_REQUEST_SCHEMA_VERSION,
  SHIFT_PLANNING_WIRE_SCHEMA_VERSION,
  ShiftPlanningCompletedSummary,
  ShiftPlanningEnvironment,
  ShiftPlanningFailureScope,
  ShiftPlanningFailedSummary,
  ShiftPlanningMode,
  ShiftPlanningRequestV2,
  buildShiftPlanningFailureSummary,
  parseShiftPlanningRequestV2,
} from "./shift-planning-wire.js";

type UnknownRecord = Record<string, unknown>;

type ParsedRequestEnvelope = {
  request: ShiftPlanningRequestV2;
  lifecycle: ShiftPlanningPersistedLifecycle | null;
};

type PersistedOperation = ShiftPlanningPersistedLifecycle & {
  requestId: string;
  environment: ShiftPlanningEnvironment;
  requestIntent: ShiftPlanningRequestV2;
};

const requestKeys = [
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

const lifecycleKeys = [
  "schemaVersion",
  "operationId",
  "requestIntentDigest",
  "state",
  "lease",
  "terminalDigest",
  "summary",
  "artifact",
] as const;

const operationKeys = [
  ...lifecycleKeys,
  "requestId",
  "environment",
  "requestIntent",
] as const;

const candidateKeys = [
  "schemaVersion",
  "status",
  "environment",
  "bundleId",
  "bundleRevision",
  "bundleDigest",
  "candidate",
  "candidateDigest",
  "bundleArtifactDigest",
] as const;

const bundleKeys = [
  "schemaVersion",
  "environment",
  "bundleId",
  "bundleRevision",
  "bundleDigest",
  "artifactDigest",
  "artifact",
] as const;

const failPersistence = (message: string): never => {
  throw new ShiftPlanningError("request_intent_conflict", message);
};

const requireRecord = (value: unknown, name: string): UnknownRecord => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return failPersistence(`${name} must be a plain object.`);
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
    failPersistence(`${name} fields are not exact.`);
  }
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failPersistence(`${name} is not a valid identifier.`);
  }
  return value;
};

const requireDigest = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return failPersistence(`${name} is not a planning digest.`);
  }
  return value;
};

const requireNonNegativeInteger = (value: unknown, name: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return failPersistence(`${name} must be a non-negative integer.`);
  }
  return value as number;
};

const requireTimestampMillis = (value: unknown, name: string): number => {
  if (!(value instanceof Timestamp)) {
    return failPersistence(`${name} must be a Firestore Timestamp.`);
  }
  return requireNonNegativeInteger(value.toMillis(), `${name} millis`);
};

const requireEnvironment = (value: unknown): ShiftPlanningEnvironment => {
  if (value !== "develop" && value !== "production") {
    return failPersistence("Planning environment is invalid.");
  }
  return value;
};

const requireLease = (value: unknown): ShiftPlanningProcessingLease => {
  const lease = requireRecord(value, "processing lease");
  requireExactKeys(
    lease,
    ["workerId", "fencingEpoch", "acquiredAt", "expiresAt"],
    "processing lease",
  );
  const acquiredAtMillis = requireTimestampMillis(
    lease.acquiredAt,
    "processing lease acquiredAt",
  );
  const expiresAtMillis = requireTimestampMillis(
    lease.expiresAt,
    "processing lease expiresAt",
  );
  if (expiresAtMillis <= acquiredAtMillis) {
    failPersistence("Processing lease expiry must follow acquisition.");
  }
  return {
    workerId: requireIdentifier(lease.workerId, "workerId"),
    fencingEpoch: requireNonNegativeInteger(
      lease.fencingEpoch,
      "fencingEpoch",
    ),
    acquiredAtMillis,
    expiresAtMillis,
  };
};

const serializeLease = (lease: ShiftPlanningProcessingLease): object => ({
  workerId: lease.workerId,
  fencingEpoch: lease.fencingEpoch,
  acquiredAt: Timestamp.fromMillis(lease.acquiredAtMillis),
  expiresAt: Timestamp.fromMillis(lease.expiresAtMillis),
});

const serializedLifecycle = (
  lifecycle: ShiftPlanningPersistedLifecycle,
): object => ({
  schemaVersion: lifecycle.schemaVersion,
  operationId: lifecycle.operationId,
  requestIntentDigest: lifecycle.requestIntentDigest,
  state: lifecycle.state,
  lease: serializeLease(lifecycle.lease),
  terminalDigest: lifecycle.terminalDigest,
  summary: lifecycle.summary,
  artifact: lifecycle.artifact,
});

const requireTerminalSummary = (
  value: unknown,
): ShiftPlanningTerminalSummary => {
  const summary = requireRecord(value, "terminal summary");
  if (summary.status === "completed") {
    return requireCompletedSummaryValue(summary);
  }
  if (summary.status === "failed") {
    return requireFailedSummaryValue(summary);
  }
  return failPersistence("Terminal summary discriminator is invalid.");
};

const requirePersistedArtifact = (
  value: unknown,
): ShiftPlanningPersistedArtifact => {
  const artifact = requireRecord(value, "persisted artifact");
  if (artifact.kind === "preview") {
    requireExactKeys(
      artifact,
      [
        "kind",
        "receipt",
        "receiptDigest",
        "bundleArtifactDigest",
      ],
      "preview artifact",
    );
    const receipt = parseShiftPlanningPreviewReceipt(artifact.receipt);
    const receiptDigest = requireDigest(
      artifact.receiptDigest,
      "preview receipt digest",
    );
    if (createShiftPlanningDigest(receipt) !== receiptDigest) {
      failPersistence("Persisted preview receipt digest does not match.");
    }
    return {
      kind: "preview",
      receipt,
      receiptDigest,
      bundleArtifactDigest: requireDigest(
        artifact.bundleArtifactDigest,
        "preview bundle artifact digest",
      ),
    };
  }
  if (artifact.kind === "candidate") {
    requireExactKeys(
      artifact,
      ["kind", "candidateId", "candidateDigest", "bundleArtifactDigest"],
      "candidate reference artifact",
    );
    return {
      kind: "candidate",
      candidateId: requireIdentifier(
        artifact.candidateId,
        "candidateId",
      ),
      candidateDigest: requireDigest(
        artifact.candidateDigest,
        "candidateDigest",
      ),
      bundleArtifactDigest: requireDigest(
        artifact.bundleArtifactDigest,
        "candidate bundle artifact digest",
      ),
    };
  }
  return failPersistence("Persisted artifact discriminator is invalid.");
};

const terminalDigest = (
  summary: ShiftPlanningTerminalSummary,
  artifact: ShiftPlanningPersistedArtifact | null,
): string => createShiftPlanningDigest({summary, artifact});

const requireMode = (value: unknown): ShiftPlanningMode => {
  if (value !== "preview" && value !== "stage" && value !== "activate") {
    return failPersistence("Planning mode is invalid.");
  }
  return value;
};

const requireAffectedSeasons = (
  value: unknown,
  name: string,
): readonly number[] => {
  if (
    !Array.isArray(value) ||
    value.some((season) =>
      !Number.isSafeInteger(season) || season < 2000 || season > 9998
    ) ||
    new Set(value).size !== value.length
  ) {
    return failPersistence(`${name} is invalid.`);
  }
  return value;
};

const requireCompletedSubplanSummary = (
  value: unknown,
  name: string,
): ShiftPlanningCompletedSummary["delivery"] => {
  const subplan = requireRecord(value, `${name} completed summary`);
  requireExactKeys(
    subplan,
    [
      "targetSeasonStartYear",
      "generatedShiftCount",
      "affectedProjectionSeasonStartYears",
    ],
    `${name} completed summary`,
  );
  const targetSeasonStartYear = requireNonNegativeInteger(
    subplan.targetSeasonStartYear,
    `${name} targetSeasonStartYear`,
  );
  if (targetSeasonStartYear < 2000 || targetSeasonStartYear > 9998) {
    return failPersistence(`${name} target season is invalid.`);
  }
  return {
    targetSeasonStartYear,
    generatedShiftCount: requireNonNegativeInteger(
      subplan.generatedShiftCount,
      `${name} generatedShiftCount`,
    ),
    affectedProjectionSeasonStartYears: requireAffectedSeasons(
      subplan.affectedProjectionSeasonStartYears,
      `${name} affected seasons`,
    ),
  };
};

const requireCompletedSummaryValue = (
  value: unknown,
): ShiftPlanningCompletedSummary => {
  const summary = requireRecord(value, "completed summary");
  requireExactKeys(
    summary,
    [
      "schemaVersion",
      "status",
      "mode",
      "bundleId",
      "bundleRevision",
      "bundleDigest",
      "delivery",
      "market",
    ],
    "completed summary",
  );
  if (
    summary.schemaVersion !== SHIFT_PLANNING_WIRE_SCHEMA_VERSION ||
    summary.status !== "completed"
  ) {
    return failPersistence("Completed summary discriminator is invalid.");
  }
  return {
    schemaVersion: SHIFT_PLANNING_WIRE_SCHEMA_VERSION,
    status: "completed",
    mode: requireMode(summary.mode),
    bundleId: requireIdentifier(summary.bundleId, "summary bundleId"),
    bundleRevision: requireIdentifier(
      summary.bundleRevision,
      "summary bundleRevision",
    ),
    bundleDigest: requireDigest(summary.bundleDigest, "summary bundleDigest"),
    delivery: requireCompletedSubplanSummary(summary.delivery, "delivery"),
    market: requireCompletedSubplanSummary(summary.market, "market"),
  };
};

const failureScopes: readonly ShiftPlanningFailureScope[] = [
  "request",
  "delivery",
  "market",
  "bundle",
  "maintenance",
  "release",
];

const requireFailedSummaryValue = (
  value: unknown,
): ShiftPlanningFailedSummary => {
  const summary = requireRecord(value, "failed summary");
  requireExactKeys(
    summary,
    ["schemaVersion", "status", "mode", "bundleId", "failure"],
    "failed summary",
  );
  const failure = requireRecord(summary.failure, "failure summary detail");
  requireExactKeys(
    failure,
    ["scope", "code", "messageKey"],
    "failure summary detail",
  );
  if (
    summary.schemaVersion !== SHIFT_PLANNING_WIRE_SCHEMA_VERSION ||
    summary.status !== "failed" ||
    typeof failure.scope !== "string" ||
    !failureScopes.includes(failure.scope as ShiftPlanningFailureScope) ||
    typeof failure.code !== "string" ||
    typeof failure.messageKey !== "string"
  ) {
    return failPersistence("Failed summary discriminator is invalid.");
  }
  const expected = buildShiftPlanningFailureSummary({
    mode: requireMode(summary.mode),
    bundleId: requireIdentifier(summary.bundleId, "summary bundleId"),
    scope: failure.scope as ShiftPlanningFailureScope,
    code: failure.code as ShiftPlanningFailureCode,
  });
  if (
    expected.failure.messageKey === "shiftPlanning.error.undefined" ||
    createShiftPlanningDigest(summary) !== createShiftPlanningDigest(expected)
  ) {
    return failPersistence("Failed summary is not canonical.");
  }
  return expected;
};

const requireLifecycle = (value: unknown): ShiftPlanningPersistedLifecycle => {
  const lifecycle = requireRecord(value, "request lifecycle");
  requireExactKeys(lifecycle, lifecycleKeys, "request lifecycle");
  if (
    lifecycle.schemaVersion !== SHIFT_PLANNING_PERSISTENCE_SCHEMA_VERSION ||
    (
      lifecycle.state !== "processing" &&
      lifecycle.state !== "completed" &&
      lifecycle.state !== "failed"
    )
  ) {
    return failPersistence("Request lifecycle discriminator is invalid.");
  }
  const state = lifecycle.state;
  const summary = lifecycle.summary === null ?
    null : requireTerminalSummary(lifecycle.summary);
  const artifact = lifecycle.artifact === null ?
    null : requirePersistedArtifact(lifecycle.artifact);
  const storedTerminalDigest = lifecycle.terminalDigest === null ?
    null : requireDigest(lifecycle.terminalDigest, "terminalDigest");
  if (state === "processing") {
    if (
      summary !== null ||
      artifact !== null ||
      storedTerminalDigest !== null
    ) {
      return failPersistence(
        "Processing lifecycle cannot contain terminal data.",
      );
    }
  } else {
    if (summary === null || storedTerminalDigest === null) {
      return failPersistence("Terminal lifecycle is incomplete.");
    }
    if (summary.status !== state) {
      failPersistence("Terminal summary does not match lifecycle state.");
    }
    if (state === "failed" && artifact !== null) {
      failPersistence("Failed lifecycle cannot publish an artifact.");
    }
    if (state === "completed" && artifact === null) {
      failPersistence("Completed lifecycle must publish an artifact.");
    }
    if (terminalDigest(summary, artifact) !== storedTerminalDigest) {
      failPersistence("Terminal lifecycle digest does not match.");
    }
  }
  return {
    schemaVersion: SHIFT_PLANNING_PERSISTENCE_SCHEMA_VERSION,
    operationId: requireIdentifier(lifecycle.operationId, "operationId"),
    requestIntentDigest: requireDigest(
      lifecycle.requestIntentDigest,
      "requestIntentDigest",
    ),
    state,
    lease: requireLease(lifecycle.lease),
    terminalDigest: storedTerminalDigest,
    summary,
    artifact,
  };
};

const requestIntentData = (request: ShiftPlanningRequestV2): object => ({
  schemaVersion: SHIFT_PLANNING_REQUEST_SCHEMA_VERSION,
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

const requestEnvelopeData = (
  request: ShiftPlanningRequestV2,
  lifecycle: ShiftPlanningPersistedLifecycle,
): object => ({
  ...requestIntentData(request),
  status: lifecycle.state,
  lifecycle: serializedLifecycle(lifecycle),
});

const parseRequestEnvelope = (
  snapshot: DocumentSnapshot,
  expectedEnvironment: ShiftPlanningEnvironment,
): ParsedRequestEnvelope => {
  if (!snapshot.exists) {
    return failPersistence("Planning request does not exist.");
  }
  const document = requireRecord(snapshot.data(), "planning request");
  const status = document.status;
  if (status === "requested") {
    const request = parseShiftPlanningRequestV2(document);
    if (
      request.requestId !== snapshot.id ||
      request.environment !== expectedEnvironment
    ) {
      return failPersistence("Planning request path identity does not match.");
    }
    return {request, lifecycle: null};
  }
  requireExactKeys(
    document,
    [...requestKeys, "lifecycle"],
    "persisted planning request",
  );
  const intent: UnknownRecord = {};
  requestKeys.forEach((key) => {
    intent[key] = document[key];
  });
  intent.status = "requested";
  const request = parseShiftPlanningRequestV2(intent);
  const lifecycle = requireLifecycle(document.lifecycle);
  const intentDigest = createShiftPlanningDigest(request);
  if (
    request.requestId !== snapshot.id ||
    request.environment !== expectedEnvironment ||
    lifecycle.requestIntentDigest !== intentDigest ||
    lifecycle.state !== status
  ) {
    return failPersistence("Persisted planning request lineage is invalid.");
  }
  return {request, lifecycle};
};

const operationData = (
  request: ShiftPlanningRequestV2,
  lifecycle: ShiftPlanningPersistedLifecycle,
): object => ({
  ...serializedLifecycle(lifecycle),
  requestId: request.requestId,
  environment: request.environment,
  requestIntent: request,
});

const parseOperation = (snapshot: DocumentSnapshot): PersistedOperation => {
  if (!snapshot.exists) {
    return failPersistence("Planning operation does not exist.");
  }
  const data = requireRecord(snapshot.data(), "planning operation");
  requireExactKeys(data, operationKeys, "planning operation");
  const lifecycleData: UnknownRecord = {};
  lifecycleKeys.forEach((key) => {
    lifecycleData[key] = data[key];
  });
  const lifecycle = requireLifecycle(lifecycleData);
  const requestIntent = requireRecord(
    data.requestIntent,
    "operation request intent",
  ) as ShiftPlanningRequestV2;
  if (
    createShiftPlanningDigest(requestIntent) !== lifecycle.requestIntentDigest
  ) {
    return failPersistence("Operation request intent digest does not match.");
  }
  return {
    ...lifecycle,
    requestId: requireIdentifier(data.requestId, "operation requestId"),
    environment: requireEnvironment(data.environment),
    requestIntent,
  };
};

const assertOperationMatchesRequest = (
  operation: PersistedOperation,
  envelope: ParsedRequestEnvelope,
): void => {
  const lifecycle = envelope.lifecycle;
  if (
    lifecycle === null ||
    operation.requestId !== envelope.request.requestId ||
    operation.environment !== envelope.request.environment ||
    operation.requestIntentDigest !== lifecycle.requestIntentDigest ||
    createShiftPlanningDigest(operation) !== createShiftPlanningDigest({
      ...lifecycle,
      requestId: envelope.request.requestId,
      environment: envelope.request.environment,
      requestIntent: operation.requestIntent,
    })
  ) {
    failPersistence("Planning request and operation have diverged.");
  }
};

const planningRoot = (environment: ShiftPlanningEnvironment): string =>
  `${environment}/plus-collections`;

const resultExpectedState = (
  result: ShiftPlanningBundleResult,
): ShiftPlanningBundleResult["expectedState"] => {
  const expectedState = parseShiftPlanningExpectedState(result.expectedState);
  if (
    createShiftPlanningDigest(expectedState) !==
      createShiftPlanningDigest(result.expectedState) ||
    expectedState.authoritativeState.environment !== result.environment ||
    expectedState.authoritativeState.maintenance.writeEpoch !==
      result.expectedWriteEpoch ||
    expectedState.authoritativeState.maintenance.activeRevision !==
      result.expectedActiveRevision
  ) {
    return failPersistence(
      "Planning result has invalid authoritative-state lineage.",
    );
  }
  return expectedState;
};

const bundleArtifact = (
  result: ShiftPlanningBundleResult,
): ShiftPlanningPersistedBundleArtifact => {
  const expectedState = resultExpectedState(result);
  return {
    schemaVersion: result.schemaVersion,
    bundleId: result.bundleId,
    environment: result.environment,
    bundleRevision: result.bundleRevision,
    bundleDigest: result.bundleDigest,
    expectedWriteEpoch: result.expectedWriteEpoch,
    activationWriteEpoch: result.activationWriteEpoch,
    expectedActiveRevision: result.expectedActiveRevision,
    expectedState,
    frontiers: result.frontiers,
    delivery: result.delivery,
    market: result.market,
    manifests: result.manifests,
    budgets: result.budgets,
    releaseLeaseIntents: result.releaseLeaseIntents,
    syncCommands: result.syncCommands,
    heldNotificationIntents: result.heldNotificationIntents,
    transactionRequirements: result.transactionRequirements,
  };
};

const persistedBundle = (
  result: ShiftPlanningBundleResult,
): ShiftPlanningPersistedBundle => {
  const artifact = bundleArtifact(result);
  return {
    schemaVersion: SHIFT_PLANNING_PERSISTENCE_SCHEMA_VERSION,
    environment: result.environment,
    bundleId: result.bundleId,
    bundleRevision: result.bundleRevision,
    bundleDigest: result.bundleDigest,
    artifactDigest: createShiftPlanningDigest(artifact),
    artifact,
  };
};

const parsePersistedBundle = (value: unknown): ShiftPlanningPersistedBundle => {
  const bundle = requireRecord(value, "persisted bundle");
  requireExactKeys(bundle, bundleKeys, "persisted bundle");
  const rawArtifact = requireRecord(
    bundle.artifact,
    "persisted bundle artifact",
  );
  const expectedState = parseShiftPlanningExpectedState(
    rawArtifact.expectedState,
  );
  const artifact = {
    ...rawArtifact,
    expectedState,
  } as ShiftPlanningPersistedBundleArtifact;
  const parsed: ShiftPlanningPersistedBundle = {
    schemaVersion: SHIFT_PLANNING_PERSISTENCE_SCHEMA_VERSION,
    environment: requireEnvironment(bundle.environment),
    bundleId: requireIdentifier(bundle.bundleId, "bundleId"),
    bundleRevision: requireIdentifier(
      bundle.bundleRevision,
      "bundleRevision",
    ),
    bundleDigest: requireDigest(bundle.bundleDigest, "bundleDigest"),
    artifactDigest: requireDigest(bundle.artifactDigest, "artifactDigest"),
    artifact,
  };
  if (
    bundle.schemaVersion !== SHIFT_PLANNING_PERSISTENCE_SCHEMA_VERSION ||
    createShiftPlanningDigest(artifact) !== parsed.artifactDigest ||
    artifact.schemaVersion !== SHIFT_PLANNING_BUNDLE_SCHEMA_VERSION ||
    artifact.environment !== parsed.environment ||
    artifact.bundleId !== parsed.bundleId ||
    artifact.bundleRevision !== parsed.bundleRevision ||
    artifact.bundleDigest !== parsed.bundleDigest ||
    expectedState.authoritativeState.environment !== parsed.environment ||
    artifact.expectedWriteEpoch !==
      expectedState.authoritativeState.maintenance.writeEpoch ||
    artifact.expectedActiveRevision !==
      expectedState.authoritativeState.maintenance.activeRevision
  ) {
    return failPersistence("Persisted bundle lineage is invalid.");
  }
  return parsed;
};

const persistedCandidate = (
  result: ShiftPlanningBundleResult,
): ShiftPlanningPersistedCandidate => {
  const rawCandidate = result.stagedCandidate;
  const candidateDigest = result.stagedCandidateDigest;
  if (
    result.mode !== "stage" ||
    result.transactionEvidence === null ||
    rawCandidate === null ||
    candidateDigest === null
  ) {
    return failPersistence(
      "Stage result does not contain validated candidate evidence.",
    );
  }
  const candidate = validateShiftPlanningStagedCandidate({
    value: rawCandidate,
    forwardManifestDigest:
      result.transactionRequirements.forwardManifestDigest,
    inverseManifestDigest:
      result.transactionRequirements.inverseManifestDigest,
    budgets: result.budgets,
    authority: result.expectedState.transactionMeasurementAuthority,
  });
  if (
    createShiftPlanningDigest(candidate) !== candidateDigest ||
    createShiftPlanningDigest(candidate.transactionEvidence) !==
      createShiftPlanningDigest(result.transactionEvidence) ||
    candidate.candidateId !== result.bundleId ||
    candidate.bundleId !== result.bundleId ||
    candidate.bundleRevision !== result.bundleRevision ||
    candidate.bundleDigest !== result.bundleDigest ||
    candidate.environment !== result.environment ||
    candidate.sourceStageRequestId !== result.requestId ||
    candidate.expectedStateDigest !==
      createShiftPlanningDigest(result.expectedState)
  ) {
    return failPersistence(
      "Stage result does not contain validated candidate evidence.",
    );
  }
  return {
    schemaVersion: SHIFT_PLANNING_PERSISTENCE_SCHEMA_VERSION,
    status: "staged",
    environment: result.environment,
    bundleId: result.bundleId,
    bundleRevision: result.bundleRevision,
    bundleDigest: result.bundleDigest,
    candidate,
    candidateDigest,
    bundleArtifactDigest: persistedBundle(result).artifactDigest,
  };
};

const parsePersistedCandidate = (
  value: unknown,
): ShiftPlanningPersistedCandidate => {
  const candidate = requireRecord(value, "persisted candidate");
  requireExactKeys(candidate, candidateKeys, "persisted candidate");
  const artifact = parseShiftPlanningStagedCandidateArtifact(
    candidate.candidate,
  );
  const parsed: ShiftPlanningPersistedCandidate = {
    schemaVersion: SHIFT_PLANNING_PERSISTENCE_SCHEMA_VERSION,
    status: "staged",
    environment: requireEnvironment(candidate.environment),
    bundleId: requireIdentifier(candidate.bundleId, "candidate bundleId"),
    bundleRevision: requireIdentifier(
      candidate.bundleRevision,
      "candidate bundleRevision",
    ),
    bundleDigest: requireDigest(
      candidate.bundleDigest,
      "candidate bundleDigest",
    ),
    candidate: artifact,
    candidateDigest: requireDigest(
      candidate.candidateDigest,
      "candidateDigest",
    ),
    bundleArtifactDigest: requireDigest(
      candidate.bundleArtifactDigest,
      "candidate bundleArtifactDigest",
    ),
  };
  if (
    candidate.schemaVersion !== SHIFT_PLANNING_PERSISTENCE_SCHEMA_VERSION ||
    candidate.status !== "staged" ||
    createShiftPlanningDigest(artifact) !== parsed.candidateDigest ||
    artifact.environment !== parsed.environment ||
    artifact.bundleId !== parsed.bundleId ||
    artifact.candidateId !== parsed.bundleId ||
    artifact.bundleRevision !== parsed.bundleRevision ||
    artifact.bundleDigest !== parsed.bundleDigest
  ) {
    return failPersistence("Persisted candidate lineage is invalid.");
  }
  return parsed;
};

const requireResultIdentity = (
  result: ShiftPlanningBundleResult,
  token: ShiftPlanningClaimToken,
  mode: "preview" | "stage",
): void => {
  if (
    result.schemaVersion !== SHIFT_PLANNING_BUNDLE_SCHEMA_VERSION ||
    result.mode !== mode ||
    result.requestId !== token.requestId ||
    result.environment !== token.environment
  ) {
    failPersistence("Planning result does not match the claimed request.");
  }
};

const requireResultRequestLineage = (
  result: ShiftPlanningBundleResult,
  request: ShiftPlanningRequestV2,
): void => {
  if (
    result.requestId !== request.requestId ||
    result.mode !== request.mode ||
    result.bundleId !== request.bundleId ||
    result.environment !== request.environment ||
    result.expectedWriteEpoch !== request.expectedWriteEpoch ||
    result.expectedActiveRevision !== request.expectedActiveRevision ||
    result.frontiers.delivery.frontierBefore.seasonStartYear !==
      request.subplans.delivery.targetSeasonStartYear ||
    result.frontiers.market.frontierBefore.seasonStartYear !==
      request.subplans.market.targetSeasonStartYear
  ) {
    failPersistence("Planning result does not match its immutable intake.");
  }
};

const requireCompletedSummary = (
  summary: ShiftPlanningCompletedSummary,
  result: ShiftPlanningBundleResult,
): void => {
  const expected = buildShiftPlanningCompletedSummary(result);
  if (
    createShiftPlanningDigest(summary) !== createShiftPlanningDigest(expected)
  ) {
    failPersistence("Completed summary does not match the planning result.");
  }
};

const terminalLifecycle = (input: {
  current: ShiftPlanningPersistedLifecycle;
  state: "completed" | "failed";
  summary: ShiftPlanningTerminalSummary;
  artifact: ShiftPlanningPersistedArtifact | null;
}): ShiftPlanningPersistedLifecycle => ({
  schemaVersion: input.current.schemaVersion,
  operationId: input.current.operationId,
  requestIntentDigest: input.current.requestIntentDigest,
  state: input.state,
  lease: input.current.lease,
  terminalDigest: terminalDigest(input.summary, input.artifact),
  summary: input.summary,
  artifact: input.artifact,
});

const assertClaimOwnsLifecycle = (
  token: ShiftPlanningClaimToken,
  lifecycle: ShiftPlanningPersistedLifecycle,
  currentTimeMillis: number,
): void => {
  if (
    lifecycle.state !== "processing" ||
    lifecycle.operationId !== token.operationId ||
    lifecycle.requestIntentDigest !== token.requestIntentDigest ||
    lifecycle.lease.workerId !== token.workerId ||
    lifecycle.lease.fencingEpoch !== token.fencingEpoch ||
    lifecycle.lease.expiresAtMillis <= currentTimeMillis
  ) {
    failPersistence("Planning claim is stale or no longer owns the request.");
  }
};

const sameTerminal = (
  lifecycle: ShiftPlanningPersistedLifecycle,
  expectedDigest: string,
): boolean => {
  if (lifecycle.state === "processing") {
    return false;
  }
  if (lifecycle.terminalDigest !== expectedDigest) {
    failPersistence("Terminal replay conflicts with the persisted result.");
  }
  return true;
};

export const createFirestoreShiftPlanningRepository = (
  firestore: Firestore,
  clock: () => Timestamp = () => Timestamp.now(),
): ShiftPlanningPersistence => {
  const readClockMillis = (): number => {
    const value = clock().toMillis();
    if (!Number.isSafeInteger(value) || value < 0) {
      return failPersistence("Repository clock returned an invalid instant.");
    }
    return value;
  };

  const requestRef = (
    environment: ShiftPlanningEnvironment,
    requestId: string,
  ): DocumentReference => firestore.doc(
    `${planningRoot(environment)}/${SHIFT_PLANNING_COLLECTIONS.requests}/` +
    requestId,
  );
  const operationRef = (
    environment: ShiftPlanningEnvironment,
    requestId: string,
  ): DocumentReference => firestore.doc(
    `${planningRoot(environment)}/shiftPlanningOperations/request-${requestId}`,
  );
  const bundleRef = (
    environment: ShiftPlanningEnvironment,
    revision: string,
  ): DocumentReference => firestore.doc(
    `${planningRoot(environment)}/shiftPlanningBundles/${revision}`,
  );
  const candidateRef = (
    environment: ShiftPlanningEnvironment,
    candidateId: string,
  ): DocumentReference => firestore.doc(
    `${planningRoot(environment)}/${SHIFT_PLANNING_COLLECTIONS.candidates}/` +
    candidateId,
  );

  const validateTerminalReplay = async (
    transaction: Transaction,
    envelope: ParsedRequestEnvelope,
    operation: PersistedOperation,
  ): Promise<void> => {
    const summary = operation.summary;
    if (
      summary === null ||
      summary.mode !== envelope.request.mode ||
      summary.bundleId !== envelope.request.bundleId
    ) {
      return failPersistence("Terminal summary does not match its request.");
    }
    if (summary.status === "failed") {
      if (operation.artifact !== null) {
        failPersistence("Failed terminal replay cannot expose an artifact.");
      }
      return;
    }
    const artifact = operation.artifact;
    if (artifact === null) {
      return failPersistence("Completed terminal replay lost its artifact.");
    }
    if (artifact.kind === "preview") {
      if (
        envelope.request.mode !== "preview" ||
        artifact.receipt.requestId !== envelope.request.requestId ||
        artifact.receipt.bundleId !== summary.bundleId ||
        artifact.receipt.bundleRevision !== summary.bundleRevision ||
        artifact.receipt.bundleDigest !== summary.bundleDigest ||
        artifact.receipt.environment !== envelope.request.environment ||
        artifact.receipt.requestedByUserId !==
          envelope.request.requestedByUserId
      ) {
        return failPersistence("Terminal preview receipt lineage is invalid.");
      }
      const snapshot = await transaction.get(
        bundleRef(envelope.request.environment, summary.bundleRevision),
      );
      if (!snapshot.exists) {
        return failPersistence("Terminal preview lost its persisted bundle.");
      }
      const bundle = parsePersistedBundle(snapshot.data());
      if (
        bundle.bundleId !== summary.bundleId ||
        bundle.bundleDigest !== summary.bundleDigest ||
        bundle.artifactDigest !== artifact.bundleArtifactDigest
      ) {
        failPersistence("Terminal preview bundle lineage is invalid.");
      }
      return;
    }
    if (envelope.request.mode !== "stage") {
      return failPersistence("Terminal candidate is not owned by stage.");
    }
    const [candidateSnapshot, bundleSnapshot] = await Promise.all([
      transaction.get(candidateRef(
        envelope.request.environment,
        artifact.candidateId,
      )),
      transaction.get(bundleRef(
        envelope.request.environment,
        summary.bundleRevision,
      )),
    ]);
    if (!candidateSnapshot.exists || !bundleSnapshot.exists) {
      return failPersistence("Terminal stage lost a persisted artifact.");
    }
    const candidate = parsePersistedCandidate(candidateSnapshot.data());
    const bundle = parsePersistedBundle(bundleSnapshot.data());
    if (
      candidate.candidateDigest !== artifact.candidateDigest ||
      candidate.bundleArtifactDigest !== artifact.bundleArtifactDigest ||
      candidate.bundleId !== summary.bundleId ||
      candidate.bundleRevision !== summary.bundleRevision ||
      candidate.bundleDigest !== summary.bundleDigest ||
      candidate.candidate.sourceStageRequestId !== envelope.request.requestId ||
      candidate.candidate.requestedByUserId !==
        envelope.request.requestedByUserId ||
      bundle.bundleId !== candidate.bundleId ||
      bundle.bundleRevision !== candidate.bundleRevision ||
      bundle.bundleDigest !== candidate.bundleDigest ||
      bundle.artifactDigest !== candidate.bundleArtifactDigest
    ) {
      failPersistence("Terminal stage artifact lineage is invalid.");
    }
  };

  const readClaimed = async (
    transaction: Transaction,
    token: ShiftPlanningClaimToken,
  ): Promise<{
    requestReference: DocumentReference;
    operationReference: DocumentReference;
    envelope: ParsedRequestEnvelope;
    operation: PersistedOperation;
  }> => {
    const requestReference = requestRef(token.environment, token.requestId);
    const operationReference = operationRef(token.environment, token.requestId);
    const [requestSnapshot, operationSnapshot] = await Promise.all([
      transaction.get(requestReference),
      transaction.get(operationReference),
    ]);
    const envelope = parseRequestEnvelope(
      requestSnapshot,
      token.environment,
    );
    const operation = parseOperation(operationSnapshot);
    assertOperationMatchesRequest(operation, envelope);
    if (
      operation.operationId !== token.operationId ||
      operation.requestIntentDigest !== token.requestIntentDigest
    ) {
      failPersistence("Claim token does not match its planning operation.");
    }
    return {
      requestReference,
      operationReference,
      envelope,
      operation,
    };
  };

  const claimRequest = async (input: {
    environment: ShiftPlanningEnvironment;
    requestId: string;
    operationId: string;
    workerId: string;
    leaseDurationMillis: number;
  }): Promise<ShiftPlanningRequestClaim> => {
    const environment = requireEnvironment(input.environment);
    const requestId = requirePlanningRequestId(input.requestId);
    const operationId = requireIdentifier(input.operationId, "operationId");
    const workerId = requireIdentifier(input.workerId, "workerId");
    if (
      !Number.isSafeInteger(input.leaseDurationMillis) ||
      input.leaseDurationMillis < 1 ||
      input.leaseDurationMillis > 24 * 60 * 60 * 1000
    ) {
      return failPersistence("Processing lease duration is invalid.");
    }
    return firestore.runTransaction(async (transaction) => {
      const requestReference = requestRef(environment, requestId);
      const operationReference = operationRef(environment, requestId);
      const requestSnapshot = await transaction.get(requestReference);
      const envelope = parseRequestEnvelope(requestSnapshot, environment);
      if (envelope.request.mode === "activate") {
        return {
          kind: "activationPreflight",
          request: envelope.request,
        };
      }
      const operationSnapshot = await transaction.get(operationReference);
      const nowMillis = readClockMillis();
      const expiresAtMillis = nowMillis + input.leaseDurationMillis;
      if (!Number.isSafeInteger(expiresAtMillis)) {
        return failPersistence("Processing lease expiry is unsafe.");
      }
      if (!operationSnapshot.exists) {
        if (envelope.lifecycle !== null) {
          return failPersistence(
            "Persisted request has no matching planning operation.",
          );
        }
        const requestIntentDigest = createShiftPlanningDigest(envelope.request);
        const lease: ShiftPlanningProcessingLease = {
          workerId,
          fencingEpoch: 1,
          acquiredAtMillis: nowMillis,
          expiresAtMillis,
        };
        const lifecycle: ShiftPlanningPersistedLifecycle = {
          schemaVersion: SHIFT_PLANNING_PERSISTENCE_SCHEMA_VERSION,
          operationId,
          requestIntentDigest,
          state: "processing",
          lease,
          terminalDigest: null,
          summary: null,
          artifact: null,
        };
        transaction.create(
          operationReference,
          operationData(envelope.request, lifecycle),
        );
        transaction.set(
          requestReference,
          requestEnvelopeData(envelope.request, lifecycle),
        );
        return {
          kind: "process",
          request: envelope.request,
          token: {
            environment,
            requestId,
            operationId,
            workerId,
            fencingEpoch: 1,
            requestIntentDigest,
          },
        };
      }
      const operation = parseOperation(operationSnapshot);
      assertOperationMatchesRequest(operation, envelope);
      if (operation.operationId !== operationId) {
        return failPersistence(
          "Request is already bound to another planning operation.",
        );
      }
      if (operation.state !== "processing") {
        if (operation.summary === null) {
          return failPersistence("Terminal operation has no summary.");
        }
        await validateTerminalReplay(transaction, envelope, operation);
        return {
          kind: "terminalReplay",
          request: envelope.request,
          summary: operation.summary,
          artifact: operation.artifact,
        };
      }
      if (operation.lease.expiresAtMillis > nowMillis) {
        if (operation.lease.workerId === workerId) {
          return {
            kind: "resume",
            request: envelope.request,
            token: {
              environment,
              requestId,
              operationId,
              workerId,
              fencingEpoch: operation.lease.fencingEpoch,
              requestIntentDigest: operation.requestIntentDigest,
            },
          };
        }
        return {
          kind: "busy",
          request: envelope.request,
          retryAfterMillis: operation.lease.expiresAtMillis - nowMillis,
        };
      }
      const fencingEpoch = operation.lease.fencingEpoch + 1;
      if (!Number.isSafeInteger(fencingEpoch)) {
        return failPersistence("Processing fencing epoch cannot advance.");
      }
      const lifecycle: ShiftPlanningPersistedLifecycle = {
        schemaVersion: operation.schemaVersion,
        operationId: operation.operationId,
        requestIntentDigest: operation.requestIntentDigest,
        state: operation.state,
        lease: {
          workerId,
          fencingEpoch,
          acquiredAtMillis: nowMillis,
          expiresAtMillis,
        },
        terminalDigest: operation.terminalDigest,
        summary: operation.summary,
        artifact: operation.artifact,
      };
      transaction.set(
        operationReference,
        operationData(envelope.request, lifecycle),
      );
      transaction.set(
        requestReference,
        requestEnvelopeData(envelope.request, lifecycle),
      );
      return {
        kind: "process",
        request: envelope.request,
        token: {
          environment,
          requestId,
          operationId,
          workerId,
          fencingEpoch,
          requestIntentDigest: operation.requestIntentDigest,
        },
      };
    });
  };

  const completePreview = async (input: {
    token: ShiftPlanningClaimToken;
    result: ShiftPlanningBundleResult;
    summary: ShiftPlanningCompletedSummary;
  }): Promise<ShiftPlanningPersistenceResult> => {
    requireResultIdentity(input.result, input.token, "preview");
    requireCompletedSummary(input.summary, input.result);
    const rawReceipt = input.result.previewReceipt;
    const receiptDigest = input.result.previewReceiptDigest;
    if (
      rawReceipt === null ||
      receiptDigest === null
    ) {
      return failPersistence(
        "Preview result does not contain its exact receipt.",
      );
    }
    const receipt = parseShiftPlanningPreviewReceipt(rawReceipt);
    if (
      createShiftPlanningDigest(receipt) !== receiptDigest ||
      receipt.requestId !== input.token.requestId ||
      receipt.bundleId !== input.result.bundleId ||
      receipt.bundleRevision !== input.result.bundleRevision ||
      receipt.bundleDigest !== input.result.bundleDigest ||
      receipt.environment !== input.result.environment ||
      receipt.expectedStateDigest !==
        createShiftPlanningDigest(input.result.expectedState)
    ) {
      return failPersistence(
        "Preview result does not contain its exact receipt.",
      );
    }
    const bundle = persistedBundle(input.result);
    const artifact: ShiftPlanningPersistedArtifact = {
      kind: "preview",
      receipt,
      receiptDigest,
      bundleArtifactDigest: bundle.artifactDigest,
    };
    const expectedTerminalDigest = terminalDigest(input.summary, artifact);
    return firestore.runTransaction(async (transaction) => {
      const current = await readClaimed(transaction, input.token);
      requireResultRequestLineage(input.result, current.envelope.request);
      if (
        current.envelope.request.mode !== "preview" ||
        current.envelope.request.bundleId !== input.result.bundleId ||
        current.envelope.request.requestedByUserId !==
          receipt.requestedByUserId
      ) {
        return failPersistence("Preview result does not match its intake.");
      }
      const bundleReference = bundleRef(
        input.token.environment,
        input.result.bundleRevision,
      );
      const bundleSnapshot = await transaction.get(bundleReference);
      const isTerminal =
        current.operation.state !== "processing" ||
        current.envelope.lifecycle?.state !== "processing";
      if (isTerminal) {
        sameTerminal(current.operation, expectedTerminalDigest);
        if (current.envelope.lifecycle === null) {
          return failPersistence("Terminal request lost its lifecycle.");
        }
        sameTerminal(current.envelope.lifecycle, expectedTerminalDigest);
      } else {
        assertClaimOwnsLifecycle(
          input.token,
          current.operation,
          readClockMillis(),
        );
      }
      if (bundleSnapshot.exists) {
        const existing = parsePersistedBundle(bundleSnapshot.data());
        if (existing.artifactDigest !== bundle.artifactDigest) {
          return failPersistence("Preview bundle revision already conflicts.");
        }
      } else if (!isTerminal) {
        transaction.create(bundleReference, bundle);
      } else {
        return failPersistence("Terminal preview lost its persisted bundle.");
      }
      if (isTerminal) {
        return "replayed";
      }
      const lifecycle = terminalLifecycle({
        current: current.operation,
        state: "completed",
        summary: input.summary,
        artifact,
      });
      transaction.set(
        current.operationReference,
        operationData(current.envelope.request, lifecycle),
      );
      transaction.set(
        current.requestReference,
        requestEnvelopeData(current.envelope.request, lifecycle),
      );
      return "committed";
    });
  };

  const loadPersistedPreview = async (input: {
    environment: ShiftPlanningEnvironment;
    requestId: string;
  }): Promise<ShiftPlanningPersistedPreview> => {
    const environment = requireEnvironment(input.environment);
    const requestId = requirePlanningRequestId(input.requestId);
    return firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(
        requestRef(environment, requestId),
      );
      const envelope = parseRequestEnvelope(snapshot, environment);
      const lifecycle = envelope.lifecycle;
      if (
        envelope.request.mode !== "preview" ||
        lifecycle?.state !== "completed" ||
        lifecycle.summary?.status !== "completed" ||
        lifecycle.artifact?.kind !== "preview"
      ) {
        return failPersistence(
          "Persisted preview is not terminal and complete.",
        );
      }
      return {
        request: envelope.request,
        summary: lifecycle.summary,
        receipt: lifecycle.artifact.receipt,
        receiptDigest: lifecycle.artifact.receiptDigest,
        bundleArtifactDigest: lifecycle.artifact.bundleArtifactDigest,
      };
    });
  };

  const completeStage = async (input: {
    token: ShiftPlanningClaimToken;
    result: ShiftPlanningBundleResult;
    summary: ShiftPlanningCompletedSummary;
  }): Promise<ShiftPlanningPersistenceResult> => {
    requireResultIdentity(input.result, input.token, "stage");
    requireCompletedSummary(input.summary, input.result);
    const candidate = persistedCandidate(input.result);
    const expectedBundle = persistedBundle(input.result);
    const artifact: ShiftPlanningPersistedArtifact = {
      kind: "candidate",
      candidateId: candidate.bundleId,
      candidateDigest: candidate.candidateDigest,
      bundleArtifactDigest: candidate.bundleArtifactDigest,
    };
    const expectedTerminalDigest = terminalDigest(input.summary, artifact);
    return firestore.runTransaction(async (transaction) => {
      const current = await readClaimed(transaction, input.token);
      requireResultRequestLineage(input.result, current.envelope.request);
      if (current.envelope.request.mode !== "stage") {
        return failPersistence("Claimed request is not a stage request.");
      }
      const binding = current.envelope.request.binding;
      if (binding?.kind !== "preview") {
        return failPersistence("Stage request has no preview binding.");
      }
      const sourceRequestReference = requestRef(
        input.token.environment,
        binding.sourceRequestId,
      );
      const sourceBundleReference = bundleRef(
        input.token.environment,
        input.result.bundleRevision,
      );
      const destinationCandidateReference = candidateRef(
        input.token.environment,
        candidate.bundleId,
      );
      const [sourceRequestSnapshot, sourceBundleSnapshot, candidateSnapshot] =
        await Promise.all([
          transaction.get(sourceRequestReference),
          transaction.get(sourceBundleReference),
          transaction.get(destinationCandidateReference),
        ]);
      const isTerminal =
        current.operation.state !== "processing" ||
        current.envelope.lifecycle?.state !== "processing";
      if (isTerminal) {
        sameTerminal(current.operation, expectedTerminalDigest);
        if (current.envelope.lifecycle === null) {
          return failPersistence("Terminal request lost its lifecycle.");
        }
        sameTerminal(current.envelope.lifecycle, expectedTerminalDigest);
      } else {
        assertClaimOwnsLifecycle(
          input.token,
          current.operation,
          readClockMillis(),
        );
      }
      const sourceEnvelope = parseRequestEnvelope(
        sourceRequestSnapshot,
        input.token.environment,
      );
      const sourceLifecycle = sourceEnvelope.lifecycle;
      if (
        current.envelope.request.bundleId !== candidate.bundleId ||
        current.envelope.request.requestedByUserId !==
          candidate.candidate.requestedByUserId ||
        current.envelope.request.requestId !==
          candidate.candidate.sourceStageRequestId ||
        binding.sourceRequestId !==
          candidate.candidate.sourcePreviewRequestId ||
        sourceEnvelope.request.mode !== "preview" ||
        sourceLifecycle?.state !== "completed" ||
        sourceLifecycle.artifact?.kind !== "preview" ||
        sourceLifecycle.artifact.receiptDigest !==
          candidate.candidate.sourcePreviewReceiptDigest ||
        sourceLifecycle.artifact.receipt.requestId !==
          binding.sourceRequestId ||
        sourceLifecycle.artifact.receipt.bundleId !==
          current.envelope.request.bundleId ||
        sourceLifecycle.artifact.receipt.bundleRevision !==
          binding.bundleRevision ||
        sourceLifecycle.artifact.receipt.bundleDigest !==
          binding.bundleDigest ||
        sourceLifecycle.artifact.receipt.expectedStateDigest !==
          candidate.candidate.expectedStateDigest ||
        sourceEnvelope.request.requestedByUserId !==
          current.envelope.request.requestedByUserId
      ) {
        throw new ShiftPlanningError(
          "preview_binding_mismatch",
          "Stage did not load the exact persisted preview receipt.",
        );
      }
      if (!sourceBundleSnapshot.exists) {
        return failPersistence("Stage source bundle is not persisted.");
      }
      const sourceBundle = parsePersistedBundle(sourceBundleSnapshot.data());
      if (
        sourceBundle.artifactDigest !== expectedBundle.artifactDigest ||
        sourceBundle.artifactDigest !==
          sourceLifecycle.artifact.bundleArtifactDigest
      ) {
        throw new ShiftPlanningError(
          "preview_binding_mismatch",
          "Stage source bundle has changed after preview.",
        );
      }
      if (candidateSnapshot.exists) {
        const existing = parsePersistedCandidate(candidateSnapshot.data());
        if (
          existing.candidateDigest !== candidate.candidateDigest ||
          existing.bundleArtifactDigest !== candidate.bundleArtifactDigest
        ) {
          return failPersistence("Staged candidate ID already conflicts.");
        }
        if (!isTerminal) {
          return failPersistence(
            "Staged candidate ID existed before request completion.",
          );
        }
      } else if (!isTerminal) {
        transaction.create(destinationCandidateReference, candidate);
      } else {
        return failPersistence("Terminal stage lost its persisted candidate.");
      }
      if (isTerminal) {
        return "replayed";
      }
      const lifecycle = terminalLifecycle({
        current: current.operation,
        state: "completed",
        summary: input.summary,
        artifact,
      });
      transaction.set(
        current.operationReference,
        operationData(current.envelope.request, lifecycle),
      );
      transaction.set(
        current.requestReference,
        requestEnvelopeData(current.envelope.request, lifecycle),
      );
      return "committed";
    });
  };

  const failRequest = async (input: {
    token: ShiftPlanningClaimToken;
    summary: ShiftPlanningFailedSummary;
  }): Promise<ShiftPlanningPersistenceResult> => {
    const summary = requireFailedSummaryValue(input.summary);
    if (
      summary.mode === "activate"
    ) {
      return failPersistence("Failed request summary is invalid for this cut.");
    }
    const expectedTerminalDigest = terminalDigest(summary, null);
    return firestore.runTransaction(async (transaction) => {
      const current = await readClaimed(transaction, input.token);
      if (
        current.operation.state !== "processing" ||
        current.envelope.lifecycle?.state !== "processing"
      ) {
        if (
          sameTerminal(current.operation, expectedTerminalDigest) &&
          current.envelope.lifecycle !== null &&
          sameTerminal(current.envelope.lifecycle, expectedTerminalDigest)
        ) {
          return "replayed";
        }
      }
      assertClaimOwnsLifecycle(
        input.token,
        current.operation,
        readClockMillis(),
      );
      if (
        summary.mode !== current.envelope.request.mode ||
        summary.bundleId !== current.envelope.request.bundleId
      ) {
        return failPersistence("Failure summary does not match its request.");
      }
      const lifecycle = terminalLifecycle({
        current: current.operation,
        state: "failed",
        summary,
        artifact: null,
      });
      transaction.set(
        current.operationReference,
        operationData(current.envelope.request, lifecycle),
      );
      transaction.set(
        current.requestReference,
        requestEnvelopeData(current.envelope.request, lifecycle),
      );
      return "committed";
    });
  };

  const preflightActivation = async (input: {
    environment: ShiftPlanningEnvironment;
    requestId: string;
  }): Promise<ShiftPlanningActivationPreflight> => {
    const environment = requireEnvironment(input.environment);
    const requestId = requirePlanningRequestId(input.requestId);
    return firestore.runTransaction(async (transaction) => {
      const requestSnapshot = await transaction.get(
        requestRef(environment, requestId),
      );
      const envelope = parseRequestEnvelope(requestSnapshot, environment);
      if (envelope.lifecycle !== null || envelope.request.mode !== "activate") {
        return failPersistence(
          "Activation preflight accepts only an unclaimed activate request.",
        );
      }
      const binding = envelope.request.binding;
      if (binding?.kind !== "candidate") {
        return failPersistence("Activate request has no candidate binding.");
      }
      const candidateSnapshot = await transaction.get(
        candidateRef(environment, binding.candidateId),
      );
      if (!candidateSnapshot.exists) {
        throw new ShiftPlanningError(
          "candidate_binding_mismatch",
          "Activation candidate is not persisted.",
        );
      }
      const candidate = parsePersistedCandidate(candidateSnapshot.data());
      if (
        candidate.candidateDigest !== binding.candidateDigest ||
        candidate.candidate.candidateId !== binding.candidateId ||
        candidate.bundleId !== envelope.request.bundleId ||
        candidate.bundleRevision !== binding.bundleRevision ||
        candidate.bundleDigest !== binding.bundleDigest ||
        candidate.environment !== environment ||
        candidate.candidate.requestedByUserId !==
          envelope.request.requestedByUserId
      ) {
        throw new ShiftPlanningError(
          "candidate_binding_mismatch",
          "Activation binding does not match persisted candidate lineage.",
        );
      }
      return {request: envelope.request, candidate};
    });
  };

  return {
    claimRequest,
    completePreview,
    completeStage,
    failRequest,
    loadPersistedPreview,
    preflightActivation,
  };
};
