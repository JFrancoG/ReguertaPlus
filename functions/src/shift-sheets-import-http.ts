import {randomUUID} from "node:crypto";
import {Request, onRequest} from "firebase-functions/v2/https";
import {Response} from "express";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {ShiftPlanningDigestError} from "./shift-planning-digest.js";
import {ShiftPlanningOperationalLogger} from
  "./shift-planning-operational-log.js";
import {
  ShiftSheetsConfig, ShiftSheetsEnvironment, ShiftSheetsError,
  resolveShiftSheetsTab,
} from "./shift-sheets-config.js";
import {ShiftSheetsImportTab} from "./shift-sheets-import.js";
import {createFirestoreShiftSheetsImport} from
  "./shift-sheets-firestore-import.js";
import {SHIFT_SHEETS_LIMITS} from "./shift-sheets.js";

type Command = {environment: ShiftSheetsEnvironment; operationId: string} &
  ({mode: "prepare"} |
  {mode: "apply" | "writeBack"; expectedPlanDigest: string});
type Dependencies = {
  importerFor(environment: ShiftSheetsEnvironment):
    ReturnType<typeof createFirestoreShiftSheetsImport>;
  logger: Pick<ShiftPlanningOperationalLogger, "error">;
};

/**
 * Loads the reviewed mapping from deployment configuration, never HTTP input.
 * A human mapping permits preparation only; public apply keeps its conversion
 * gate. No layout or decoration row is inferred from a title or alias.
 * @param {ShiftSheetsConfig} config Exact environment and routing authority.
 * @param {object} variables Invocation-time environment variables.
 * @return {ShiftSheetsImportTab[]} Explicit bounded tab mapping.
 */
export const readShiftSheetsImportMapping = (
  config: ShiftSheetsConfig,
  variables: Readonly<Record<string, string | undefined>>,
): readonly ShiftSheetsImportTab[] => {
  try {
    const raw = variables[
      `SHIFT_SHEETS_IMPORT_TABS_${config.environment.toUpperCase()}`
    ];
    if (!raw || raw.length > 65536) throw new Error("Missing mapping.");
    const tabs = JSON.parse(raw) as ShiftSheetsImportTab[];
    if (!Array.isArray(tabs) || !tabs.length ||
      tabs.length > SHIFT_SHEETS_LIMITS.tabs ||
      new Set(tabs.map((tab) => tab.title)).size !== tabs.length) {
      throw new Error("Invalid tab set.");
    }
    for (const tab of tabs) {
      if (Object.keys(tab).sort().join(",") !==
          "decorations,layout,seasonStartYear,title,type" ||
        !Number.isSafeInteger(tab.seasonStartYear) ||
        resolveShiftSheetsTab(config, tab.type,
          `${tab.seasonStartYear}-09-01`).title !== tab.title ||
        !["canonical", `${tab.type}_human`].includes(tab.layout) ||
        !Array.isArray(tab.decorations) ||
        tab.decorations.length > SHIFT_SHEETS_LIMITS.tabRows ||
        (tab.layout === "canonical" && tab.decorations.length) ||
        new Set(tab.decorations.map((row) => row.rowNumber)).size !==
        tab.decorations.length || tab.decorations.some((row) =>
        Object.keys(row).sort().join(",") !== "cells,rowNumber" ||
          !Number.isSafeInteger(row.rowNumber) || row.rowNumber < 1 ||
          row.rowNumber > SHIFT_SHEETS_LIMITS.tabRows ||
          !Array.isArray(row.cells) ||
          row.cells.length > SHIFT_SHEETS_LIMITS.tabColumns ||
          row.cells.some((cell: unknown) =>
            typeof cell !== "string" || cell.length > 1024))) {
        throw new Error("Invalid layout.");
      }
    }
    return tabs;
  } catch {
    throw new ShiftSheetsError("invalid_sheets_import",
      "An exact reviewed import mapping is required.");
  }
};

const parseCommand = (value: unknown): Command => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid command.");
  }
  const body = value as Record<string, unknown>;
  const keys = ["schemaVersion", "environment", "operationId", "mode",
    ...(body.mode === "prepare" ? [] : ["expectedPlanDigest"])];
  if (Object.keys(body).length !== keys.length ||
    Object.keys(body).some((key) => !keys.includes(key)) ||
    body.schemaVersion !== 1 ||
    (body.environment !== "develop" && body.environment !== "production") ||
    typeof body.operationId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(body.operationId)) {
    throw new Error("Invalid command fields.");
  }
  const shared = {environment: body.environment,
    operationId: body.operationId} as const;
  if (body.mode === "prepare") return {...shared, mode: "prepare"};
  if ((body.mode !== "apply" && body.mode !== "writeBack") ||
    typeof body.expectedPlanDigest !== "string" ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(body.expectedPlanDigest)) {
    throw new Error("Invalid reviewed digest.");
  }
  return {...shared, mode: body.mode,
    expectedPlanDigest: body.expectedPlanDigest};
};

/**
 * Keeps review, atomic apply and external write-back as separate invocations.
 * Prepare returns the complete plan for review; mutation responses contain only
 * outcome metadata. Unknown outcomes must be retried with the same ID/digest.
 * @param {object} dependencies Trusted import composition and safe log sink.
 * @return {Function} Handler behind the exported Cloud Run IAM boundary.
 */
export const createShiftSheetsImportHttpHandler = (
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
    if (Object.keys(request.query).length) throw new Error("Unexpected query.");
    command = parseCommand(request.body);
  } catch {
    response.status(400).json({ok: false, code: "invalid_import_command"});
    return;
  }
  const auditId = randomUUID();
  try {
    const importer = dependencies.importerFor(command.environment);
    const result = command.mode === "prepare" ?
      await importer.prepare(command.operationId) :
      await importer[command.mode](
        command.operationId, command.expectedPlanDigest,
      );
    const status = result.kind === "reconciliationRequired" ? 409 : 200;
    response.status(status).json({ok: status === 200, schemaVersion: 1,
      auditId, environment: command.environment,
      operationId: command.operationId,
      kind: result.kind, ...("plan" in result ? {plan: result.plan} : {}),
    });
  } catch (error) {
    const rejected = error instanceof ShiftSheetsError ||
      error instanceof ShiftPlanningError ||
      error instanceof ShiftPlanningDigestError;
    const code = rejected ? "sheets_import_rejected" :
      "sheets_import_unavailable";
    dependencies.logger.error("Shift Sheets import did not complete", {
      component: "shift_sheets_import", auditId,
      environment: command.environment, code,
    });
    response.status(rejected ? 409 : 503).json({ok: false, auditId, code});
  }
};

/**
 * Declares a private entry only. HU-085 owns caller IAM, runtime identity and
 * external writer exclusion; there is no scheduler or implicit combined apply.
 * @param {object} dependencies Existing import API and sanitized logger.
 * @return {object} Private import function declaration.
 */
export const createShiftSheetsImportHttpFunction = (
  dependencies: Dependencies,
) => onRequest({cors: false, invoker: "private", timeoutSeconds: 300},
  createShiftSheetsImportHttpHandler(dependencies));
