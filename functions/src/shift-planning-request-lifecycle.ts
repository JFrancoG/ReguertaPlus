import {
  ShiftPlanningBundleResult,
} from "./shift-planning-bundle.js";
import {
  ShiftPlanningError,
  ShiftPlanningFailureCode,
} from "./shift-planning-contract.js";
import {
  ShiftPlanningDigestError,
} from "./shift-planning-digest.js";
import {
  ShiftPlanningActivationPreflight,
  ShiftPlanningPersistedArtifact,
  ShiftPlanningPersistedPreview,
  ShiftPlanningPersistence,
  ShiftPlanningPersistenceResult,
  ShiftPlanningTerminalSummary,
  buildShiftPlanningCompletedSummary,
} from "./shift-planning-persistence.js";
import {
  ShiftPlanningEnvironment,
  ShiftPlanningFailedSummary,
  ShiftPlanningFailureScope,
  ShiftPlanningRequestV2,
  buildShiftPlanningFailureSummary,
} from "./shift-planning-wire.js";

export type ShiftPlanningBundleResolutionInput = {
  request: ShiftPlanningRequestV2;
  persistedPreview: ShiftPlanningPersistedPreview | null;
};

export type ShiftPlanningBundleResolver = (
  input: ShiftPlanningBundleResolutionInput,
) => Promise<ShiftPlanningBundleResult>;

export type ShiftPlanningRequestLifecycleResult =
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
  }
  | {
    kind: "completed";
    request: ShiftPlanningRequestV2;
    summary: ReturnType<typeof buildShiftPlanningCompletedSummary>;
    persistenceResult: ShiftPlanningPersistenceResult;
    result: ShiftPlanningBundleResult;
  }
  | {
    kind: "failed";
    request: ShiftPlanningRequestV2;
    summary: ShiftPlanningFailedSummary;
    persistenceResult: ShiftPlanningPersistenceResult;
  }
  | {
    kind: "activationPreflight";
    preflight: ShiftPlanningActivationPreflight;
  };

export type ExecuteShiftPlanningRequestInput = {
  persistence: ShiftPlanningPersistence;
  resolveBundle: ShiftPlanningBundleResolver;
  environment: ShiftPlanningEnvironment;
  requestId: string;
  operationId: string;
  workerId: string;
  leaseDurationMillis: number;
};

const deliveryFailureCodes = new Set<ShiftPlanningFailureCode>([
  "adjacent_delivery_lead_conflict",
  "delivery_helper_cursor_conflict",
  "delivery_helper_evidence_ambiguous",
  "delivery_helper_ineligible",
  "insufficient_delivery_members",
  "invalid_delivery_continuity",
  "invalid_delivery_calendar",
]);

const marketFailureCodes = new Set<ShiftPlanningFailureCode>([
  "insufficient_market_members",
  "invalid_market_assignee_group",
]);

const maintenanceFailureCodes = new Set<ShiftPlanningFailureCode>([
  "stale_write_epoch",
  "stale_active_revision",
  "maintenance_state_conflict",
]);

const requestFailureCodes = new Set<ShiftPlanningFailureCode>([
  "invalid_planning_request_id",
  "invalid_planning_request",
  "planning_binding_mismatch",
  "preview_binding_mismatch",
  "candidate_binding_mismatch",
  "request_intent_conflict",
]);

const failureScope = (
  code: ShiftPlanningFailureCode,
): ShiftPlanningFailureScope => {
  if (deliveryFailureCodes.has(code)) return "delivery";
  if (marketFailureCodes.has(code)) return "market";
  if (maintenanceFailureCodes.has(code)) return "maintenance";
  if (code === "planning_release_lease_conflict") return "release";
  if (requestFailureCodes.has(code)) return "request";
  return "bundle";
};

const deterministicFailureCode = (
  error: unknown,
): ShiftPlanningFailureCode | null => {
  if (error instanceof ShiftPlanningError) return error.code;
  if (error instanceof ShiftPlanningDigestError) return error.code;
  return null;
};

const invalidResolvedBundle = (message: string): never => {
  throw new ShiftPlanningError("internal_planning_failure", message);
};

const requireResolvedBundle = (
  request: ShiftPlanningRequestV2,
  result: ShiftPlanningBundleResult,
): ShiftPlanningBundleResult => {
  if (
    result.requestId !== request.requestId ||
    result.mode !== request.mode ||
    result.bundleId !== request.bundleId ||
    result.environment !== request.environment
  ) {
    return invalidResolvedBundle(
      "Resolved planning bundle does not match its claimed request.",
    );
  }
  if (request.mode === "preview") {
    if (
      result.previewReceipt === null ||
      result.previewReceiptDigest === null ||
      result.transactionEvidence !== null ||
      result.stagedCandidate !== null ||
      result.stagedCandidateDigest !== null
    ) {
      return invalidResolvedBundle(
        "Preview resolver returned an invalid artifact chain.",
      );
    }
    return result;
  }
  if (
    request.mode !== "stage" ||
    result.transactionEvidence === null ||
    result.stagedCandidate === null ||
    result.stagedCandidateDigest === null ||
    result.previewReceipt === null ||
    result.previewReceiptDigest === null
  ) {
    return invalidResolvedBundle(
      "Stage resolver returned an invalid artifact chain.",
    );
  }
  return result;
};

const resolveClaimedBundle = async (input: {
  persistence: ShiftPlanningPersistence;
  resolveBundle: ShiftPlanningBundleResolver;
  request: ShiftPlanningRequestV2;
}): Promise<ShiftPlanningBundleResult> => {
  const binding = input.request.binding;
  if (input.request.mode === "stage" && binding?.kind !== "preview") {
    throw new ShiftPlanningError(
      "preview_binding_mismatch",
      "Claimed stage request lost its preview binding.",
    );
  }
  const persistedPreview = binding?.kind === "preview" ?
    await input.persistence.loadPersistedPreview({
      environment: input.request.environment,
      requestId: binding.sourceRequestId,
    }) : null;
  return requireResolvedBundle(
    input.request,
    await input.resolveBundle({request: input.request, persistedPreview}),
  );
};

/**
 * Runs the private v2 request lifecycle without selecting Firebase triggers or
 * public side effects. Preview and stage claim before planning; activation is
 * deliberately restricted to the repository's candidate-only read preflight.
 * @param {ExecuteShiftPlanningRequestInput} input Persistence and planner
 * ports.
 * @return {Promise<ShiftPlanningRequestLifecycleResult>} Stable lifecycle
 * result.
 */
export const executeShiftPlanningRequest = async (
  input: ExecuteShiftPlanningRequestInput,
): Promise<ShiftPlanningRequestLifecycleResult> => {
  const claim = await input.persistence.claimRequest({
    environment: input.environment,
    requestId: input.requestId,
    operationId: input.operationId,
    workerId: input.workerId,
    leaseDurationMillis: input.leaseDurationMillis,
  });
  if (claim.kind === "activationPreflight") {
    return {
      kind: "activationPreflight",
      preflight: await input.persistence.preflightActivation({
        environment: input.environment,
        requestId: input.requestId,
      }),
    };
  }
  if (claim.kind === "busy") {
    return {
      kind: "busy",
      request: claim.request,
      retryAfterMillis: claim.retryAfterMillis,
    };
  }
  if (claim.kind === "terminalReplay") {
    return {
      kind: "terminalReplay",
      request: claim.request,
      summary: claim.summary,
      artifact: claim.artifact,
    };
  }
  if (claim.request.mode === "activate") {
    throw new ShiftPlanningError(
      "request_intent_conflict",
      "Persistence returned activate after its no-write routing decision.",
    );
  }

  let result: ShiftPlanningBundleResult;
  try {
    result = await resolveClaimedBundle({
      persistence: input.persistence,
      resolveBundle: input.resolveBundle,
      request: claim.request,
    });
  } catch (error) {
    const code = deterministicFailureCode(error);
    if (code === null) throw error;
    const summary = buildShiftPlanningFailureSummary({
      mode: claim.request.mode,
      bundleId: claim.request.bundleId,
      scope: failureScope(code),
      code,
    });
    return {
      kind: "failed",
      request: claim.request,
      summary,
      persistenceResult: await input.persistence.failRequest({
        token: claim.token,
        summary,
      }),
    };
  }

  const summary = buildShiftPlanningCompletedSummary(result);
  const persistenceResult = claim.request.mode === "preview" ?
    await input.persistence.completePreview({
      token: claim.token,
      result,
      summary,
    }) :
    await input.persistence.completeStage({
      token: claim.token,
      result,
      summary,
    });
  return {
    kind: "completed",
    request: claim.request,
    summary,
    persistenceResult,
    result,
  };
};
