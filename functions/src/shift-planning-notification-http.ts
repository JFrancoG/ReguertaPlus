import {randomUUID} from "node:crypto";
import {
  HttpsFunction,
  HttpsOptions,
  Request,
  onRequest,
} from "firebase-functions/v2/https";
import {Response} from "express";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import type {
  ShiftPlanningNotificationReleaseDispatchResult,
  createShiftPlanningNotificationReleaseDispatchExecutor,
} from "./shift-planning-notification-release-dispatch-executor.js";
import {
  SHIFT_PLANNING_OPERATOR_SERVICE_ACCOUNT_EMAIL,
  ShiftPlanningOperatorAuditLogger,
} from "./shift-planning-operator-http.js";
import type {ShiftPlanningEnvironment} from "./shift-planning-wire.js";

export const SHIFT_PLANNING_NOTIFICATION_HTTPS_OPTIONS = {
  cors: false,
  invoker: SHIFT_PLANNING_OPERATOR_SERVICE_ACCOUNT_EMAIL,
} as const satisfies HttpsOptions;

export type ShiftPlanningNotificationExecutionCommand = {
  schemaVersion: 1;
  mode: "notificationReleaseDispatch";
  environment: ShiftPlanningEnvironment;
  intentId: string;
  workerId: string;
  attemptId: string;
};

type ShiftPlanningNotificationExecutor = ReturnType<
  typeof createShiftPlanningNotificationReleaseDispatchExecutor
>;

type ShiftPlanningNotificationHttpRequest = Pick<
  Request,
  "method" | "body" | "query"
>;

type ShiftPlanningNotificationHttpResponse = Pick<
  Response,
  "json" | "setHeader" | "status"
>;

type ShiftPlanningNotificationHttpDependencies = {
  createAuditId?: () => string;
};

export type ShiftPlanningNotificationHttpHandler = (
  request: ShiftPlanningNotificationHttpRequest,
  response: ShiftPlanningNotificationHttpResponse,
) => Promise<void>;

type UnknownRecord = Record<string, unknown>;

const commandFields = [
  "schemaVersion",
  "mode",
  "environment",
  "intentId",
  "workerId",
  "attemptId",
] as const;

const failCommand = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_transaction", message);
};

const requireRecord = (value: unknown): UnknownRecord => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return failCommand("Notification command must be a plain object.");
  }
  return value as UnknownRecord;
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failCommand(`${name} is not a valid identifier.`);
  }
  return value;
};

export const parseShiftPlanningNotificationExecutionCommand = (
  value: unknown,
): ShiftPlanningNotificationExecutionCommand => {
  const command = requireRecord(value);
  const actualFields = Object.keys(command);
  if (
    actualFields.length !== commandFields.length ||
    actualFields.some((field) =>
      !commandFields.some((expected) => expected === field)) ||
    command.schemaVersion !== 1 ||
    command.mode !== "notificationReleaseDispatch" ||
    (command.environment !== "develop" &&
      command.environment !== "production")
  ) {
    return failCommand("Notification command fields are invalid.");
  }
  return {
    schemaVersion: 1,
    mode: "notificationReleaseDispatch",
    environment: command.environment,
    intentId: requireIdentifier(command.intentId, "notification intentId"),
    workerId: requireIdentifier(command.workerId, "notification workerId"),
    attemptId: requireIdentifier(command.attemptId, "notification attemptId"),
  };
};

const auditBinding = (
  auditId: string,
  command: ShiftPlanningNotificationExecutionCommand,
): Record<string, unknown> => ({
  auditSchemaVersion: 1,
  auditId,
  mode: command.mode,
  environment: command.environment,
  intentId: command.intentId,
  workerId: command.workerId,
  attemptId: command.attemptId,
});

const dispatchResponse = (
  result: ShiftPlanningNotificationReleaseDispatchResult,
): Record<string, unknown> => {
  if (result.dispatch.kind === "busy") {
    return {
      releaseKind: result.releaseKind,
      dispatchKind: "busy",
      retryAtMillis: result.dispatch.retryAtMillis,
    };
  }
  return {
    releaseKind: result.releaseKind,
    dispatchKind: result.dispatch.kind,
    outcome: result.dispatch.attempt.terminal.outcome,
    failureCode: result.dispatch.attempt.terminal.failureCode,
    acceptedTargetCount:
      result.dispatch.attempt.terminal.acceptedTargetCount,
  };
};

const sendError = (
  response: ShiftPlanningNotificationHttpResponse,
  status: number,
  code: string,
  message: string,
  auditId: string,
): void => {
  response.status(status).json({
    ok: false,
    auditId,
    error: {code, message},
  });
};

/**
 * Builds the strict notification release-dispatch HTTP adapter behind invoker
 * IAM. It exposes only stable attempt lineage/outcome and never request bodies,
 * destinations, acknowledgements, member data, or internal error messages.
 * @param {object} executor Fully composed governed notification executor.
 * @param {object} auditLogger Structured audit sink.
 * @param {object} dependencies Testable audit identity source.
 * @return {ShiftPlanningNotificationHttpHandler} Strict HTTP handler.
 */
export const createShiftPlanningNotificationHttpHandler = (
  executor: ShiftPlanningNotificationExecutor,
  auditLogger: ShiftPlanningOperatorAuditLogger,
  dependencies: ShiftPlanningNotificationHttpDependencies = {},
): ShiftPlanningNotificationHttpHandler => {
  const createAuditId = dependencies.createAuditId ?? randomUUID;
  return async (request, response) => {
    const auditId = createAuditId();
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      auditLogger.warn("Shift notification request rejected", {
        auditSchemaVersion: 1,
        auditId,
        failureCode: "method_not_allowed",
      });
      sendError(
        response,
        405,
        "method_not_allowed",
        "Only POST is supported.",
        auditId,
      );
      return;
    }
    if (Object.keys(request.query).length !== 0) {
      auditLogger.warn("Shift notification request rejected", {
        auditSchemaVersion: 1,
        auditId,
        failureCode: "unexpected_query",
      });
      sendError(
        response,
        400,
        "invalid_notification_command",
        "Notification commands do not accept query parameters.",
        auditId,
      );
      return;
    }

    let command: ShiftPlanningNotificationExecutionCommand;
    try {
      command = parseShiftPlanningNotificationExecutionCommand(request.body);
    } catch {
      auditLogger.warn("Shift notification request rejected", {
        auditSchemaVersion: 1,
        auditId,
        failureCode: "invalid_notification_command",
      });
      sendError(
        response,
        400,
        "invalid_notification_command",
        "Notification command is invalid.",
        auditId,
      );
      return;
    }

    const binding = auditBinding(auditId, command);
    auditLogger.info("Shift notification request accepted", binding);
    try {
      const result = await executor.execute(command);
      const summary = dispatchResponse(result);
      auditLogger.info("Shift notification response completed", {
        ...binding,
        ...summary,
      });
      response.status(200).json({
        ok: true,
        auditId,
        schemaVersion: 1,
        mode: command.mode,
        environment: command.environment,
        intentId: command.intentId,
        workerId: command.workerId,
        attemptId: command.attemptId,
        ...summary,
      });
    } catch (error) {
      auditLogger.error("Shift notification response failed", {
        ...binding,
        failureCode: "internal",
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
      sendError(
        response,
        500,
        "internal",
        "Notification outcome is unknown; inspect audit evidence " +
          "before retrying.",
        auditId,
      );
    }
  };
};

/**
 * Declares the notification endpoint with the existing shifts operator as sole
 * invoker. HU-085 provisions/read-backs IAM and selects the runtime identity;
 * this factory remains absent from index.ts until that deployment gate.
 * @param {object} executor Fully composed governed notification executor.
 * @param {object} auditLogger Structured audit sink.
 * @return {HttpsFunction} IAM-restricted Function declaration.
 */
export const createShiftPlanningNotificationHttpFunction = (
  executor: ShiftPlanningNotificationExecutor,
  auditLogger: ShiftPlanningOperatorAuditLogger,
): HttpsFunction => onRequest(
  SHIFT_PLANNING_NOTIFICATION_HTTPS_OPTIONS,
  createShiftPlanningNotificationHttpHandler(executor, auditLogger),
);
