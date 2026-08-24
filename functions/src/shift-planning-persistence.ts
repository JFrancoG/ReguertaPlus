import {
  ShiftPlanningBundleResult,
  ShiftPlanningPreviewReceipt,
  ShiftPlanningStagedCandidate,
} from "./shift-planning-bundle.js";
import {
  SHIFT_PLANNING_WIRE_SCHEMA_VERSION,
  ShiftPlanningCompletedSummary,
  ShiftPlanningEnvironment,
  ShiftPlanningFailedSummary,
  ShiftPlanningRequestV2,
} from "./shift-planning-wire.js";

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

export type ShiftPlanningActivationPreflight = {
  request: ShiftPlanningRequestV2;
  candidate: ShiftPlanningPersistedCandidate;
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

  loadPersistedPreview(input: {
    environment: ShiftPlanningEnvironment;
    requestId: string;
  }): Promise<ShiftPlanningPersistedPreview>;

  preflightActivation(input: {
    environment: ShiftPlanningEnvironment;
    requestId: string;
  }): Promise<ShiftPlanningActivationPreflight>;
}
