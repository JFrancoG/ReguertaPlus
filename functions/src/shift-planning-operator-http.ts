import {randomUUID} from "node:crypto";
import {
  HttpsFunction,
  HttpsOptions,
  Request,
  onRequest,
} from "firebase-functions/v2/https";
import {Response} from "express";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {ShiftPlanningDigestError} from "./shift-planning-digest.js";
import {
  ShiftPlanningOperatorRecoveryCommand,
  ShiftPlanningOperatorRecoveryExecutor,
  parseShiftPlanningOperatorRecoveryCommand,
} from "./shift-planning-operator-recovery.js";

export const SHIFT_PLANNING_OPERATOR_SERVICE_ACCOUNT_EMAIL =
  "reguerta-shifts-operator@reguerta-9f27f.iam.gserviceaccount.com" as const;

export const SHIFT_PLANNING_OPERATOR_RECOVERY_HTTPS_OPTIONS = {
  cors: false,
  invoker: SHIFT_PLANNING_OPERATOR_SERVICE_ACCOUNT_EMAIL,
} as const satisfies HttpsOptions;

type ShiftPlanningOperatorRecoveryHttpRequest = Pick<
  Request,
  "method" | "body" | "query"
>;

type ShiftPlanningOperatorRecoveryHttpResponse = Pick<
  Response,
  "json" | "setHeader" | "status"
>;

export type ShiftPlanningOperatorAuditLogger = {
  info(message: string, data: Record<string, unknown>): void;
  warn(message: string, data: Record<string, unknown>): void;
  error(message: string, data: Record<string, unknown>): void;
};

type ShiftPlanningOperatorRecoveryHttpDependencies = {
  createAuditId?: () => string;
};

export type ShiftPlanningOperatorRecoveryHttpHandler = (
  request: ShiftPlanningOperatorRecoveryHttpRequest,
  response: ShiftPlanningOperatorRecoveryHttpResponse,
) => Promise<void>;

const recoveryAuditBinding = (
  auditId: string,
  command: ShiftPlanningOperatorRecoveryCommand,
): Record<string, unknown> => ({
  auditSchemaVersion: 1,
  auditId,
  mode: command.mode,
  environment: command.environment,
  activationOperationId: command.activationOperationId,
  recoveryOperationId: command.recoveryOperationId,
});

const sendError = (
  response: ShiftPlanningOperatorRecoveryHttpResponse,
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

const isPlanningRejection = (
  error: unknown,
): error is ShiftPlanningError | ShiftPlanningDigestError =>
  error instanceof ShiftPlanningError ||
  error instanceof ShiftPlanningDigestError;

/**
 * Builds the exact recovery HTTP adapter behind Cloud Run invoker IAM.
 * The handler never interprets Firebase mobile identity: the infrastructure
 * authenticates the one operator principal before this code runs. Responses and
 * logs retain only operation lineage and stable failure codes, never request
 * bodies, member data, authorization digests, or internal diagnostics.
 * @param {ShiftPlanningOperatorRecoveryExecutor} executor Allowlisted executor.
 * @param {ShiftPlanningOperatorAuditLogger} auditLogger Structured audit sink.
 * @param {object} dependencies Testable audit identity source.
 * @return {ShiftPlanningOperatorRecoveryHttpHandler} Strict HTTP handler.
 */
export const createShiftPlanningOperatorRecoveryHttpHandler = (
  executor: ShiftPlanningOperatorRecoveryExecutor,
  auditLogger: ShiftPlanningOperatorAuditLogger,
  dependencies: ShiftPlanningOperatorRecoveryHttpDependencies = {},
): ShiftPlanningOperatorRecoveryHttpHandler => {
  const createAuditId = dependencies.createAuditId ?? randomUUID;
  return async (request, response) => {
    const auditId = createAuditId();
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      auditLogger.warn("Shift planning recovery request rejected", {
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
      auditLogger.warn("Shift planning recovery request rejected", {
        auditSchemaVersion: 1,
        auditId,
        failureCode: "unexpected_query",
      });
      sendError(
        response,
        400,
        "invalid_recovery_command",
        "Recovery commands do not accept query parameters.",
        auditId,
      );
      return;
    }

    let command: ShiftPlanningOperatorRecoveryCommand;
    try {
      command = parseShiftPlanningOperatorRecoveryCommand(request.body);
    } catch (error) {
      auditLogger.warn("Shift planning recovery request rejected", {
        auditSchemaVersion: 1,
        auditId,
        failureCode: isPlanningRejection(error) ?
          error.code :
          "invalid_recovery_command",
      });
      sendError(
        response,
        400,
        "invalid_recovery_command",
        "Recovery command is invalid.",
        auditId,
      );
      return;
    }

    const auditBinding = recoveryAuditBinding(auditId, command);
    auditLogger.info("Shift planning recovery request accepted", auditBinding);
    try {
      const result = await executor.execute(command);
      const responseBody = {
        ok: true,
        auditId,
        schemaVersion: 1,
        mode: command.mode,
        environment: command.environment,
        activationOperationId: command.activationOperationId,
        recoveryOperationId: command.recoveryOperationId,
        resultKind: result.kind,
        outcomePersistenceKind: result.outcomePersistenceKind,
        outcomeDigest: result.outcome.outcomeDigest,
      } as const;
      auditLogger.info("Shift planning recovery response completed", {
        ...auditBinding,
        resultKind: result.kind,
        outcomePersistenceKind: result.outcomePersistenceKind,
        outcomeDigest: result.outcome.outcomeDigest,
      });
      response.status(200).json(responseBody);
    } catch (error) {
      if (isPlanningRejection(error)) {
        auditLogger.warn("Shift planning recovery response rejected", {
          ...auditBinding,
          failureCode: error.code,
        });
        sendError(
          response,
          409,
          "recovery_rejected",
          "Recovery authorization or state no longer matches.",
          auditId,
        );
        return;
      }
      auditLogger.error("Shift planning recovery response failed", {
        ...auditBinding,
        failureCode: "internal",
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
      sendError(
        response,
        500,
        "internal",
        "Recovery outcome is unknown; inspect audit evidence before retrying.",
        auditId,
      );
    }
  };
};

/**
 * Exports recovery with one exact future operator invoker. The operator account
 * and its sole invoker grant are provisioned and read back only during HU-085;
 * no Function runtime service account is selected at this source boundary.
 * @param {ShiftPlanningOperatorRecoveryExecutor} executor Allowlisted executor.
 * @param {ShiftPlanningOperatorAuditLogger} auditLogger Structured audit sink.
 * @return {HttpsFunction} IAM-restricted recovery Function declaration.
 */
export const createShiftPlanningOperatorRecoveryHttpFunction = (
  executor: ShiftPlanningOperatorRecoveryExecutor,
  auditLogger: ShiftPlanningOperatorAuditLogger,
): HttpsFunction => onRequest(
  SHIFT_PLANNING_OPERATOR_RECOVERY_HTTPS_OPTIONS,
  createShiftPlanningOperatorRecoveryHttpHandler(executor, auditLogger),
);
