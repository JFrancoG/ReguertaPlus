import {Timestamp} from "@google-cloud/firestore";
import {
  ShiftPlanningBundleResult,
  ShiftPlanningPreviewReceipt,
  ShiftPlanningStagedCandidate,
} from "./shift-planning-bundle.js";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {createShiftPlanningDigest} from "./shift-planning-digest.js";
import {
  SHIFT_PLANNING_WIRE_SCHEMA_VERSION,
  ShiftPlanningCompletedSummary,
  ShiftPlanningEnvironment,
  ShiftPlanningFailedSummary,
  ShiftPlanningRequestV2,
  parseShiftPlanningRequestV2,
} from "./shift-planning-wire.js";
import {
  ShiftPlanningPersistedCandidatePosition,
} from "./shift-planning-candidate.js";

export const SHIFT_PLANNING_PERSISTENCE_SCHEMA_VERSION = 1 as const;

export type ShiftPlanningTerminalSummary =
  | ShiftPlanningCompletedSummary
  | ShiftPlanningFailedSummary;

export type ShiftPlanningProcessingLease = {
  workerId: string;
  fencingEpoch: number;
  acquiredAtMillis: number;
  expiresAtMillis: number;
};

export type ShiftPlanningPersistedArtifact =
  | {
    kind: "preview";
    receipt: ShiftPlanningPreviewReceipt;
    receiptDigest: string;
    bundleArtifactDigest: string;
  }
  | {
    kind: "candidate";
    candidateId: string;
    candidateDigest: string;
    bundleArtifactDigest: string;
  };

export type ShiftPlanningPersistedLifecycle = {
  schemaVersion: typeof SHIFT_PLANNING_PERSISTENCE_SCHEMA_VERSION;
  operationId: string;
  requestIntentDigest: string;
  state: "processing" | "completed" | "failed";
  lease: ShiftPlanningProcessingLease;
  terminalDigest: string | null;
  summary: ShiftPlanningTerminalSummary | null;
  artifact: ShiftPlanningPersistedArtifact | null;
};

export type ShiftPlanningClaimToken = {
  environment: ShiftPlanningEnvironment;
  requestId: string;
  operationId: string;
  workerId: string;
  fencingEpoch: number;
  requestIntentDigest: string;
};

export type ShiftPlanningRequestClaim =
  | {
    kind: "activationPreflight";
    request: ShiftPlanningRequestV2;
  }
  | {
    kind: "process" | "resume";
    request: ShiftPlanningRequestV2;
    token: ShiftPlanningClaimToken;
  }
  | {
    kind: "busy";
    request: ShiftPlanningRequestV2;
    retryAfterMillis: number;
  }
  | {
    kind: "terminalReplay";
    request: ShiftPlanningRequestV2;
    summary: ShiftPlanningTerminalSummary;
    artifact: ShiftPlanningPersistedArtifact | null;
  };

export type ShiftPlanningActivationRequestClaim =
  | {
    kind: "process" | "resume";
    request: ShiftPlanningRequestV2;
    token: ShiftPlanningClaimToken;
  }
  | {
    kind: "busy";
    request: ShiftPlanningRequestV2;
    retryAfterMillis: number;
  }
  | {
    kind: "terminalReplay";
    request: ShiftPlanningRequestV2;
    summary: ShiftPlanningFailedSummary;
    artifact: null;
  }
  | {
    kind: "activationCommitted";
    request: ShiftPlanningRequestV2;
    workerId: string;
    fencingEpoch: number;
  };

export type ShiftPlanningPersistedPreview = {
  request: ShiftPlanningRequestV2;
  summary: ShiftPlanningCompletedSummary;
  receipt: ShiftPlanningPreviewReceipt;
  receiptDigest: string;
  bundleArtifactDigest: string;
};

export type ShiftPlanningPersistedCandidate = {
  schemaVersion: typeof SHIFT_PLANNING_PERSISTENCE_SCHEMA_VERSION;
  status: "staged";
  environment: ShiftPlanningEnvironment;
  bundleId: string;
  bundleRevision: string;
  bundleDigest: string;
  candidate: ShiftPlanningStagedCandidate;
  candidateDigest: string;
  bundleArtifactDigest: string;
};

export type ShiftPlanningPersistedBundleArtifact = Pick<
  ShiftPlanningBundleResult,
  | "schemaVersion"
  | "bundleId"
  | "environment"
  | "bundleRevision"
  | "bundleDigest"
  | "expectedWriteEpoch"
  | "activationWriteEpoch"
  | "expectedActiveRevision"
  | "expectedState"
  | "frontiers"
  | "delivery"
  | "market"
  | "manifests"
  | "budgets"
  | "releaseLeaseIntents"
  | "syncCommands"
  | "heldNotificationIntents"
  | "transactionRequirements"
>;

export type ShiftPlanningPersistedBundle = {
  schemaVersion: typeof SHIFT_PLANNING_PERSISTENCE_SCHEMA_VERSION;
  environment: ShiftPlanningEnvironment;
  bundleId: string;
  bundleRevision: string;
  bundleDigest: string;
  artifactDigest: string;
  artifact: ShiftPlanningPersistedBundleArtifact;
};

export type ShiftPlanningPersistenceResult = "committed" | "replayed";

export type ShiftPlanningActivationFailurePersistenceResult =
  | ShiftPlanningPersistenceResult
  | "activationCommitted";

export type ShiftPlanningActivationPreflight = {
  request: ShiftPlanningRequestV2;
  candidate: ShiftPlanningPersistedCandidate;
  bundle: ShiftPlanningPersistedBundle;
  positions: readonly ShiftPlanningPersistedCandidatePosition[];
};

export type ShiftPlanningActivationProcessingRequest = {
  request: ShiftPlanningRequestV2;
  lifecycle: ShiftPlanningPersistedLifecycle & {state: "processing"};
};

const failActivationLifecycle = (message: string): never => {
  throw new ShiftPlanningError("request_intent_conflict", message);
};

const requirePlainRecord = (
  value: unknown,
  name: string,
): Record<string, unknown> => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return failActivationLifecycle(`${name} must be a plain object.`);
  }
  return value as Record<string, unknown>;
};

const requireExactFields = (
  value: Record<string, unknown>,
  expected: readonly string[],
  name: string,
): void => {
  const actual = Object.keys(value);
  if (
    actual.length !== expected.length ||
    actual.some((field) => !expected.includes(field))
  ) {
    return failActivationLifecycle(`${name} fields are not exact.`);
  }
};

const requireLifecycleIdentifier = (
  value: unknown,
  name: string,
): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failActivationLifecycle(`${name} is invalid.`);
  }
  return value;
};

const requireLifecycleDigest = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return failActivationLifecycle(`${name} is invalid.`);
  }
  return value;
};

const requireLifecycleTimestamp = (value: unknown, name: string): number => {
  if (
    !(value instanceof Timestamp) ||
    value.nanoseconds % 1_000_000 !== 0 ||
    !Number.isSafeInteger(value.toMillis()) ||
    value.toMillis() < 0
  ) {
    return failActivationLifecycle(`${name} is invalid.`);
  }
  return value.toMillis();
};

/**
 * Parses the exact request-only processing envelope used while activation owns
 * its CAS lease. The operation document remains absent until the atomic commit.
 * @param {unknown} value Candidate Firestore request document.
 * @return {ShiftPlanningActivationProcessingRequest} Verified envelope.
 */
export const parseShiftPlanningActivationProcessingRequest = (
  value: unknown,
): ShiftPlanningActivationProcessingRequest => {
  const document = requirePlainRecord(value, "activation request");
  const requestFields = [
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
  requireExactFields(
    document,
    [...requestFields, "lifecycle"],
    "activation request",
  );
  const intent: Record<string, unknown> = {};
  requestFields.forEach((key) => {
    intent[key] = document[key];
  });
  intent.status = "requested";
  const request = parseShiftPlanningRequestV2(intent);
  const lifecycle = requirePlainRecord(
    document.lifecycle,
    "activation lifecycle",
  );
  requireExactFields(
    lifecycle,
    [
      "schemaVersion",
      "operationId",
      "requestIntentDigest",
      "state",
      "lease",
      "terminalDigest",
      "summary",
      "artifact",
    ],
    "activation lifecycle",
  );
  const lease = requirePlainRecord(lifecycle.lease, "activation lease");
  requireExactFields(
    lease,
    ["workerId", "fencingEpoch", "acquiredAt", "expiresAt"],
    "activation lease",
  );
  const acquiredAtMillis = requireLifecycleTimestamp(
    lease.acquiredAt,
    "activation acquiredAt",
  );
  const expiresAtMillis = requireLifecycleTimestamp(
    lease.expiresAt,
    "activation expiresAt",
  );
  const requestIntentDigest = requireLifecycleDigest(
    lifecycle.requestIntentDigest,
    "activation requestIntentDigest",
  );
  const fencingEpoch = lease.fencingEpoch;
  if (
    document.status !== "processing" ||
    request.mode !== "activate" ||
    lifecycle.schemaVersion !== SHIFT_PLANNING_PERSISTENCE_SCHEMA_VERSION ||
    lifecycle.state !== "processing" ||
    lifecycle.terminalDigest !== null ||
    lifecycle.summary !== null ||
    lifecycle.artifact !== null ||
    requestIntentDigest !== createShiftPlanningDigest(request) ||
    lifecycle.operationId !== `request-${request.requestId}` ||
    !Number.isSafeInteger(fencingEpoch) ||
    (fencingEpoch as number) < 1 ||
    expiresAtMillis <= acquiredAtMillis
  ) {
    return failActivationLifecycle(
      "Activation processing lifecycle is invalid.",
    );
  }
  return {
    request,
    lifecycle: {
      schemaVersion: SHIFT_PLANNING_PERSISTENCE_SCHEMA_VERSION,
      operationId: lifecycle.operationId,
      requestIntentDigest,
      state: "processing",
      lease: {
        workerId: requireLifecycleIdentifier(
          lease.workerId,
          "activation workerId",
        ),
        fencingEpoch: fencingEpoch as number,
        acquiredAtMillis,
        expiresAtMillis,
      },
      terminalDigest: null,
      summary: null,
      artifact: null,
    },
  };
};

export const buildShiftPlanningCompletedSummary = (
  result: ShiftPlanningBundleResult,
): ShiftPlanningCompletedSummary => ({
  schemaVersion: SHIFT_PLANNING_WIRE_SCHEMA_VERSION,
  status: "completed",
  mode: result.mode,
  bundleId: result.bundleId,
  bundleRevision: result.bundleRevision,
  bundleDigest: result.bundleDigest,
  delivery: {
    targetSeasonStartYear:
      result.frontiers.delivery.frontierBefore.seasonStartYear,
    generatedShiftCount: result.delivery.shifts.length,
    affectedProjectionSeasonStartYears:
      result.delivery.affectedProjectionSeasonStartYears,
  },
  market: {
    targetSeasonStartYear:
      result.frontiers.market.frontierBefore.seasonStartYear,
    generatedShiftCount: result.market.shifts.length,
    affectedProjectionSeasonStartYears:
      result.market.affectedProjectionSeasonStartYears,
  },
});

export interface ShiftPlanningPersistence {
  claimRequest(input: {
    environment: ShiftPlanningEnvironment;
    requestId: string;
    operationId: string;
    workerId: string;
    leaseDurationMillis: number;
  }): Promise<ShiftPlanningRequestClaim>;

  claimActivationRequest(input: {
    environment: ShiftPlanningEnvironment;
    requestId: string;
    operationId: string;
    workerId: string;
    leaseDurationMillis: number;
  }): Promise<ShiftPlanningActivationRequestClaim>;

  completePreview(input: {
    token: ShiftPlanningClaimToken;
    result: ShiftPlanningBundleResult;
    summary: ShiftPlanningCompletedSummary;
  }): Promise<ShiftPlanningPersistenceResult>;

  completeStage(input: {
    token: ShiftPlanningClaimToken;
    result: ShiftPlanningBundleResult;
    summary: ShiftPlanningCompletedSummary;
  }): Promise<ShiftPlanningPersistenceResult>;

  failRequest(input: {
    token: ShiftPlanningClaimToken;
    summary: ShiftPlanningFailedSummary;
  }): Promise<ShiftPlanningPersistenceResult>;

  failClaimedActivationRequest(input: {
    token: ShiftPlanningClaimToken;
    summary: ShiftPlanningFailedSummary;
  }): Promise<ShiftPlanningActivationFailurePersistenceResult>;

  loadPersistedPreview(input: {
    environment: ShiftPlanningEnvironment;
    requestId: string;
  }): Promise<ShiftPlanningPersistedPreview>;

  preflightActivation(input: {
    environment: ShiftPlanningEnvironment;
    requestId: string;
  }): Promise<ShiftPlanningActivationPreflight>;
}
