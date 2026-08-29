import {createHash} from "node:crypto";
import {
  ShiftPlanningError,
  ShiftPlanningFailureCode,
} from "./shift-planning-contract.js";
import {
  ShiftPlanningDigestError,
  ShiftPlanningDigestFailureCode,
} from "./shift-planning-digest.js";
import {ShiftPlanningEnvironment} from "./shift-planning-wire.js";

const SHIFT_PLANNING_OPERATIONAL_LOG_SCHEMA_VERSION = 1 as const;
const SHIFT_PLANNING_OPERATIONAL_LOG_COMPONENT = "shift_planning" as const;
const SHIFT_PLANNING_REQUEST_CORRELATION_DOMAIN =
  "shift-planning-request:v1" as const;

type ShiftPlanningOperationalFailureCode =
  | ShiftPlanningFailureCode
  | ShiftPlanningDigestFailureCode
  | "internal_planning_failure"
  | "invalid_legacy_request"
  | "unsupported_schema_version";

type ShiftPlanningOperationalLogEvent =
  | {
    kind: "requestRouted";
    environment: ShiftPlanningEnvironment;
    requestId: string;
    routeKind: "activation" | "lifecycle";
    resultKind:
      | "busy"
      | "committed"
      | "completed"
      | "failed"
      | "terminalReplay";
  }
  | {
    kind: "requestRejected";
    environment: ShiftPlanningEnvironment;
    requestId: string;
    failureCode: "invalid_legacy_request" | "unsupported_schema_version";
  }
  | {
    kind: "requestFailed";
    environment: ShiftPlanningEnvironment;
    requestId: string;
    error: unknown;
  }
  | {
    kind: "legacyCompleted";
    environment: ShiftPlanningEnvironment;
    requestId: string;
    planningType: "delivery" | "market";
    seasonLabel: string;
    generatedCount: number;
  }
  | {
    kind: "legacyFailed";
    environment: ShiftPlanningEnvironment;
    requestId: string;
    planningType: "delivery" | "market";
    error: unknown;
  };

export type ShiftPlanningOperationalLogger = {
  info(message: string, data: Record<string, unknown>): void;
  warn(message: string, data: Record<string, unknown>): void;
  error(message: string, data: Record<string, unknown>): void;
};

const requestCorrelationId = (requestId: string): string => {
  const digest = createHash("sha256")
    .update(`${SHIFT_PLANNING_REQUEST_CORRELATION_DOMAIN}:${requestId}`)
    .digest("hex");
  return `${SHIFT_PLANNING_REQUEST_CORRELATION_DOMAIN}:sha256:${digest}`;
};

const failureCode = (
  error: unknown,
): ShiftPlanningOperationalFailureCode => {
  if (
    error instanceof ShiftPlanningError ||
    error instanceof ShiftPlanningDigestError
  ) {
    return error.code;
  }
  return "internal_planning_failure";
};

const baseData = (
  eventKind: string,
  environment: ShiftPlanningEnvironment,
  requestId: string,
): Record<string, unknown> => ({
  schemaVersion: SHIFT_PLANNING_OPERATIONAL_LOG_SCHEMA_VERSION,
  component: SHIFT_PLANNING_OPERATIONAL_LOG_COMPONENT,
  eventKind,
  environment,
  requestCorrelationId: requestCorrelationId(requestId),
});

/**
 * Emits one allowlisted planning event for operational correlation. Request
 * identifiers are one-way fingerprinted, while member fields, sheet names,
 * digests, exception objects, and internal diagnostic messages never cross the
 * logging boundary.
 * @param {ShiftPlanningOperationalLogger} logger Structured log sink.
 * @param {ShiftPlanningOperationalLogEvent} event Allowlisted event input.
 */
export const logShiftPlanningOperationalEvent = (
  logger: ShiftPlanningOperationalLogger,
  event: ShiftPlanningOperationalLogEvent,
): void => {
  switch (event.kind) {
  case "requestRouted":
    logger.info("Shift planning request routed", {
      ...baseData("request_routed", event.environment, event.requestId),
      routeKind: event.routeKind,
      resultKind: event.resultKind,
    });
    return;
  case "requestRejected":
    logger.warn("Shift planning request rejected", {
      ...baseData("request_rejected", event.environment, event.requestId),
      failureCode: event.failureCode,
    });
    return;
  case "requestFailed":
    logger.error("Shift planning request failed", {
      ...baseData("request_failed", event.environment, event.requestId),
      failureCode: failureCode(event.error),
    });
    return;
  case "legacyCompleted":
    logger.info("Legacy shift planning completed", {
      ...baseData("legacy_completed", event.environment, event.requestId),
      planningType: event.planningType,
      seasonLabel: event.seasonLabel,
      generatedCount: event.generatedCount,
    });
    return;
  case "legacyFailed":
    logger.error("Legacy shift planning failed", {
      ...baseData("legacy_failed", event.environment, event.requestId),
      planningType: event.planningType,
      failureCode: failureCode(event.error),
    });
  }
};
