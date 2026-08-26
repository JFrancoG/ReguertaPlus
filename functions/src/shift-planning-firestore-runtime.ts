import {Firestore} from "@google-cloud/firestore";
import {
  ShiftPlanningBundleResult,
  planShiftPlanningBundle,
} from "./shift-planning-bundle.js";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {
  ShiftPlanningFirestoreCasExecutionResult,
  createFirestoreShiftPlanningCasRuntime,
} from "./shift-planning-firestore-cas-runtime.js";
import {
  createFirestoreShiftPlanningRepository,
} from "./shift-planning-firestore-repository.js";
import {
  createGovernedShiftPlanningForwardActivationResolver,
  loadCurrentShiftPlanningLiveSource,
} from "./shift-planning-firestore-source-producer.js";
import {
  createFirestoreShiftPlanningInverseRecoveryResolver,
} from "./shift-planning-firestore-source-resolver.js";
import {
  createFirestoreShiftPlanningStateRepository,
} from "./shift-planning-firestore-state-repository.js";
import {
  ShiftPlanningForwardActivationAttempt,
} from "./shift-planning-forward-materializer.js";
import {
  ShiftPlanningInverseRecoveryAttempt,
} from "./shift-planning-inverse-materializer.js";
import {
  ShiftPlanningRequestLifecycleResult,
  executeShiftPlanningRequest,
} from "./shift-planning-request-lifecycle.js";
import {
  SHIFT_PLANNING_REQUEST_SCHEMA_VERSION,
  ShiftPlanningEnvironment,
  ShiftPlanningRequestV2,
  parseShiftPlanningRequestV2,
  serializeShiftPlanningRequestV2,
} from "./shift-planning-wire.js";

export const SHIFT_PLANNING_REQUEST_LEASE_DURATION_MILLIS = 300_000 as const;

export type ShiftPlanningCreatedRequestRoute =
  | "legacy"
  | "v2"
  | "unsupportedVersion";

export type ShiftPlanningFirestoreRequestRuntimeResult =
  | {
    kind: "lifecycle";
    result: Exclude<
      ShiftPlanningRequestLifecycleResult,
      {kind: "activationPreflight"}
    >;
  }
  | {
    kind: "activation";
    result: ShiftPlanningFirestoreCasExecutionResult<
      ShiftPlanningForwardActivationAttempt
    >;
  };

export type ShiftPlanningFirestoreRuntime = {
  executeRequest(input: {
    environment: ShiftPlanningEnvironment;
    requestId: string;
    request: unknown;
    workerId: string;
  }): Promise<ShiftPlanningFirestoreRequestRuntimeResult>;
  executeRecovery(input: {
    environment: ShiftPlanningEnvironment;
    activationOperationId: string;
    recoveryOperationId: string;
  }): Promise<ShiftPlanningFirestoreCasExecutionResult<
    ShiftPlanningInverseRecoveryAttempt
  >>;
};

const failRuntime = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_request", message);
};

/**
 * Classifies a created request before legacy parsing. Once a document declares
 * any schema version it can never fall through to the unversioned writer.
 * @param {unknown} value Created Firestore document data.
 * @return {ShiftPlanningCreatedRequestRoute} Safe routing decision.
 */
export const classifyShiftPlanningCreatedRequest = (
  value: unknown,
): ShiftPlanningCreatedRequestRoute => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "legacy";
  }
  const request = value as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(request, "schemaVersion")) {
    return "legacy";
  }
  return request.schemaVersion === SHIFT_PLANNING_REQUEST_SCHEMA_VERSION ?
    "v2" : "unsupportedVersion";
};

const requireRequestIdentity = (input: {
  environment: ShiftPlanningEnvironment;
  requestId: string;
  request: unknown;
}): ShiftPlanningRequestV2 => {
  const request = parseShiftPlanningRequestV2(input.request);
  if (
    request.environment !== input.environment ||
    request.requestId !== input.requestId
  ) {
    return failRuntime("Planning request path identity does not match.");
  }
  return request;
};

/**
 * Composes the v2 request lifecycle and measured CAS executors around one
 * Firestore authority. Preview and stage remain private lifecycle operations;
 * activation enters the retry-scoped CAS directly so terminal replays never
 * depend on an out-of-transaction preflight.
 * @param {Firestore} firestore Pinned Firestore authority.
 * @return {ShiftPlanningFirestoreRuntime} Request and recovery runtime ports.
 */
export const createFirestoreShiftPlanningRuntime = (
  firestore: Firestore,
): ShiftPlanningFirestoreRuntime => {
  const persistence = createFirestoreShiftPlanningRepository(firestore);
  const statePersistence = createFirestoreShiftPlanningStateRepository(
    firestore,
  );
  const casRuntime = createFirestoreShiftPlanningCasRuntime(firestore);

  return {
    async executeRequest(input): Promise<
      ShiftPlanningFirestoreRequestRuntimeResult
    > {
      const request = requireRequestIdentity(input);
      const operationId = `request-${request.requestId}`;
      if (request.mode === "activate") {
        return {
          kind: "activation",
          result: await casRuntime.executeForwardActivation({
            environment: request.environment,
            operationId,
            workerId: input.workerId,
            fencingEpoch: 1,
            leaseDurationMillis:
              SHIFT_PLANNING_REQUEST_LEASE_DURATION_MILLIS,
            resolveAttempt:
              createGovernedShiftPlanningForwardActivationResolver({
                environment: request.environment,
                requestId: request.requestId,
              }),
          }),
        };
      }

      const result = await executeShiftPlanningRequest({
        persistence,
        statePersistence,
        environment: request.environment,
        requestId: request.requestId,
        operationId,
        workerId: input.workerId,
        leaseDurationMillis: SHIFT_PLANNING_REQUEST_LEASE_DURATION_MILLIS,
        resolveBundle: async ({
          request: claimedRequest,
          persistedPreview,
          authoritativeState,
        }): Promise<ShiftPlanningBundleResult> => {
          const source = await loadCurrentShiftPlanningLiveSource({
            firestore,
            environment: claimedRequest.environment,
          });
          return planShiftPlanningBundle({
            request: serializeShiftPlanningRequestV2(claimedRequest),
            authoritativeState,
            ...source.inputs,
            persistedPreview: persistedPreview?.receipt,
          });
        },
      });
      if (result.kind === "activationPreflight") {
        return failRuntime(
          "Non-activation request reached the activation preflight.",
        );
      }
      return {kind: "lifecycle", result};
    },

    async executeRecovery(input): Promise<
      ShiftPlanningFirestoreCasExecutionResult<
        ShiftPlanningInverseRecoveryAttempt
      >
    > {
      return casRuntime.executeInverseRecovery({
        environment: input.environment,
        activationOperationId: input.activationOperationId,
        recoveryOperationId: input.recoveryOperationId,
        resolveAttempt: createFirestoreShiftPlanningInverseRecoveryResolver({
          environment: input.environment,
          activationOperationId: input.activationOperationId,
        }),
      });
    },
  };
};
