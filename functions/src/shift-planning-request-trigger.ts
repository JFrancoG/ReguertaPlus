import {randomUUID} from "node:crypto";
import {logger} from "firebase-functions";
import {
  AuthType,
  onDocumentCreatedWithAuthContext,
} from "firebase-functions/v2/firestore";
import {
  ShiftPlanningFirestoreRuntime,
  classifyShiftPlanningCreatedRequest,
} from "./shift-planning-firestore-runtime.js";
import {
  logShiftPlanningOperationalEvent,
} from "./shift-planning-operational-log.js";
import {
  ShiftPlanningEnvironment,
  parseShiftPlanningRequestV2,
} from "./shift-planning-wire.js";

/**
 * Retries only versioned, idempotent requests. A busy lease rejects delivery
 * so Eventarc redelivers after the prior worker finishes or its lease expires.
 * Malformed input and terminal business failures do not retry. Legacy requests
 * receive a retirement result from their separate, non-retrying trigger.
 * @param {ShiftPlanningFirestoreRuntime} runtime Versioned request authority.
 * @param {Function} authorize Current privileged-event authorization.
 * @return {object} Retry-enabled Firestore function.
 */
export const createVersionedShiftPlanningRequestTrigger = (
  runtime: Pick<ShiftPlanningFirestoreRuntime, "executeRequest">,
  authorize: (
    environment: ShiftPlanningEnvironment,
    authType: AuthType,
    authId?: string,
  ) => Promise<boolean>,
) => onDocumentCreatedWithAuthContext({
  document: "{env}/plus-collections/shiftPlanningRequests/{requestId}",
  retry: true,
}, async (event) => {
  const request = event.data?.data();
  if (classifyShiftPlanningCreatedRequest(request) !== "v2") return;
  const environment = event.params.env;
  if (environment !== "develop" && environment !== "production") return;
  try {
    const parsed = parseShiftPlanningRequestV2(request);
    if (
      parsed.environment !== environment ||
      parsed.requestId !== event.params.requestId
    ) throw new Error("Planning event identity is invalid.");
  } catch (error) {
    logShiftPlanningOperationalEvent(logger, {
      kind: "requestFailed", environment,
      requestId: event.params.requestId, error,
    });
    return;
  }
  try {
    if (!await authorize(environment, event.authType, event.authId)) return;
    const result = await runtime.executeRequest({
      environment,
      requestId: event.params.requestId,
      request,
      workerId: `planning-${randomUUID()}`,
    });
    if (result.kind === "lifecycle" && result.result.kind === "busy") {
      throw new Error(
        "Planning request is owned by a live worker; retry delivery.",
      );
    }
    logShiftPlanningOperationalEvent(logger, {
      kind: "requestRouted", environment,
      requestId: event.params.requestId,
      routeKind: result.kind, resultKind: result.result.kind,
    });
  } catch (error) {
    logShiftPlanningOperationalEvent(logger, {
      kind: "requestFailed", environment,
      requestId: event.params.requestId, error,
    });
    throw error;
  }
});
