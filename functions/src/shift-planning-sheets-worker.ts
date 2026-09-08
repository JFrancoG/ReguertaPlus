import {randomUUID} from "node:crypto";
import {Request, onRequest} from "firebase-functions/v2/https";
import {Response} from "express";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {ShiftSheetsError} from "./shift-sheets-config.js";
import {ShiftPlanningEnvironment} from "./shift-planning-wire.js";
import {ShiftPlanningSyncCommandRepository} from
  "./shift-planning-sync-command.js";
import {
  ShiftPlanningSheetsSyncConsumer,
  ShiftPlanningSyncExecutionResult,
  drainShiftPlanningSyncCommands,
  executeShiftPlanningSyncCommand,
} from "./shift-planning-sync-command-executor.js";
import {ShiftPlanningOperationalLogger} from
  "./shift-planning-operational-log.js";

type Command = {
  schemaVersion: 1;
  environment: ShiftPlanningEnvironment;
} & ({mode: "execute"; commandId: string} | {mode: "drain"; limit: number});

type Dependencies = {
  repository: ShiftPlanningSyncCommandRepository;
  consumerFor(environment: ShiftPlanningEnvironment):
    ShiftPlanningSheetsSyncConsumer;
  logger: Pick<ShiftPlanningOperationalLogger, "error">;
};

const parseCommand = (value: unknown): Command => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid worker command.");
  }
  const body = value as Record<string, unknown>;
  const fields = ["schemaVersion", "environment", "mode",
    body.mode === "execute" ? "commandId" : "limit"];
  if (Object.keys(body).length !== fields.length ||
    Object.keys(body).some((key) => !fields.includes(key)) ||
    body.schemaVersion !== 1 ||
    (body.environment !== "develop" && body.environment !== "production") ||
    (body.mode !== "execute" && body.mode !== "drain")) {
    throw new Error("Invalid worker command.");
  }
  if (body.mode === "execute") {
    if (typeof body.commandId !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(body.commandId)) {
      throw new Error("Invalid command ID.");
    }
    return {schemaVersion: 1, environment: body.environment,
      mode: "execute", commandId: body.commandId};
  }
  if (!Number.isSafeInteger(body.limit) ||
    (body.limit as number) < 1 || (body.limit as number) > 2) {
    throw new Error("Worker drain limit must be one or two.");
  }
  return {schemaVersion: 1, environment: body.environment,
    mode: "drain", limit: body.limit as number};
};

const summary = (result: ShiftPlanningSyncExecutionResult) => {
  switch (result.kind) {
  case "completed":
  case "terminalReplay":
    return {kind: result.kind, commandId: result.command.commandId};
  case "busy":
    return {kind: result.kind, retryAtMillis: result.retryAtMillis};
  case "reconciliationRequired":
    return {kind: result.kind, commandId: result.commandId};
  }
};

/**
 * Runs explicit sync work behind the function's Cloud Run IAM boundary.
 * Each request owns fresh worker/attempt IDs. Durable receipts
 * decide whether it may submit or can only inspect. Responses expose no rows.
 * @param {object} dependencies Repository and environment composition.
 * @return {Function} Bounded HTTP handler; no in-handler caller/IAM substitute.
 */
export const createShiftPlanningSheetsWorkerHttpHandler = (
  dependencies: Dependencies,
) => async (
  request: Pick<Request, "method" | "body" | "query">,
  response: Pick<Response, "json" | "setHeader" | "status">,
): Promise<void> => {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ok: false, code: "method_not_allowed"});
    return;
  }
  let command: Command;
  try {
    if (Object.keys(request.query).length) {
      throw new Error("Unexpected query.");
    }
    command = parseCommand(request.body);
  } catch {
    response.status(400).json({
      ok: false, code: "invalid_sheets_worker_command",
    });
    return;
  }
  const auditId = randomUUID();
  try {
    const consumer = dependencies.consumerFor(command.environment);
    const input = {repository: dependencies.repository, consumer,
      environment: command.environment, workerId: auditId};
    const results = command.mode === "execute" ?
      [await executeShiftPlanningSyncCommand({...input,
        commandId: command.commandId, attemptId: randomUUID()})] :
      await drainShiftPlanningSyncCommands({...input, limit: command.limit,
        createAttemptId: () => randomUUID()});
    const status = results.some((item) =>
      item.kind === "reconciliationRequired") ? 409 :
      results.some((item) => item.kind === "busy") ? 202 : 200;
    response.status(status).json({schemaVersion: 1, ok: status === 200,
      auditId, environment: command.environment,
      results: results.map(summary)});
  } catch (error) {
    const rejected = error instanceof ShiftPlanningError ||
      error instanceof ShiftSheetsError;
    const code = rejected ? "sheets_worker_rejected" :
      "sheets_worker_unavailable";
    dependencies.logger.error("Shift Sheets worker did not complete", {
      component: "shift_sheets_worker", auditId,
      environment: command.environment, code,
    });
    response.status(rejected ? 409 : 503).json({ok: false, auditId, code});
  }
};

/**
 * No public invoker or scheduler is created. HU-085 must grant the reviewed
 * worker identity invoke-only access and establish external writer exclusion.
 * @param {object} dependencies Concrete sync ports and sanitized log sink.
 * @return {object} Private operator-invoked Function declaration.
 */
export const createShiftPlanningSheetsWorkerHttpFunction = (
  dependencies: Dependencies,
) => onRequest({cors: false, invoker: "private", timeoutSeconds: 300},
  createShiftPlanningSheetsWorkerHttpHandler(dependencies));
