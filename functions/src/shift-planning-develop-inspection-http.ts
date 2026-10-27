import {randomUUID} from "node:crypto";
import {HttpsFunction, HttpsOptions, Request, onRequest} from
  "firebase-functions/v2/https";
import {Response} from "express";
import {SHIFT_PLANNING_OPERATOR_SERVICE_ACCOUNT_EMAIL} from
  "./shift-planning-operator-http.js";
import type {ShiftPlanningOperatorAuditLogger} from
  "./shift-planning-operator-http.js";
import {SHIFT_SHEETS_OPERATIONAL_PREFLIGHT_BLOCKERS} from
  "./shift-sheets-operational-preflight.js";
import type {ShiftSheetsOperationalPreflightSummary} from
  "./shift-sheets-operational-preflight.js";

export const SHIFT_PLANNING_DEVELOP_INSPECTION_PROJECT_ID =
  "reguerta-9f27f" as const;
export const SHIFT_PLANNING_DEVELOP_INSPECTION_HTTPS_OPTIONS = {
  cors: false,
  invoker: SHIFT_PLANNING_OPERATOR_SERVICE_ACCOUNT_EMAIL,
} as const satisfies HttpsOptions;

type Data = Record<string, unknown>;
type InspectionRequest = Pick<Request, "method" | "body" | "query">;
type InspectionResponse = Pick<Response, "json" | "setHeader" | "status">;

export type ShiftPlanningDevelopInspectionInput = {
  operationId: string;
  workbookId: string;
};

export type ShiftPlanningDevelopInspectionDependencies = {
  projectId: string;
  workbookId: string;
  inspect(input: ShiftPlanningDevelopInspectionInput): Promise<unknown>;
  createAuditId?: () => string;
};

const digest = (value: unknown): value is string =>
  typeof value === "string" &&
    /^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value);
const record = (value: unknown): Data | null => {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype) return null;
  return value as Data;
};
const field = (value: Data, key: string): unknown =>
  Object.getOwnPropertyDescriptor(value, key)?.value;
const count = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0 &&
    (value as number) <= 100_000;
const version = (value: unknown): value is string =>
  typeof value === "string" &&
    /^[1-9][0-9]{0,18}$/.test(value) &&
    BigInt(value) <= BigInt("9223372036854775807");

const command = (value: unknown) => {
  const body = record(value);
  if (!body || Object.getOwnPropertySymbols(body).length ||
      Object.keys(body).sort().join() !==
        "environment,operationId,schemaVersion" ||
      field(body, "schemaVersion") !== 1 ||
      field(body, "environment") !== "develop" ||
      typeof field(body, "operationId") !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(
        field(body, "operationId") as string)) return null;
  return {operationId: field(body, "operationId") as string};
};

/**
 * Copies only the public inspection summary. Unknown provider fields are never
 * traversed; invalid values and blocker codes fail closed without reflecting
 * their contents. A successful inspection cannot authorize a mutation.
 * @param {unknown} value Trusted provider output, still checked at HTTP egress.
 * @return {object|null} Detached safe summary or an unavailable observation.
 */
const sanitize = (
  value: unknown,
): ShiftSheetsOperationalPreflightSummary | null => {
  const data = record(value);
  if (!data) return null;
  const at = field(data, "observedAtMillis");
  const principal = field(data, "observationPrincipalKind");
  const tabs = field(data, "selectedTabCount");
  const permissions = field(data, "permissionCount");
  const owners = field(data, "ownerCount");
  const before = field(data, "workbookVersionBefore");
  const after = field(data, "workbookVersionAfter");
  const blockers = field(data, "blockers");
  const digests = ["contentDigest", "aclDigest", "protectionsDigest",
    "observationDigest"].map((key) => field(data, key));
  if (field(data, "schemaVersion") !== 1 ||
      field(data, "environment") !== "develop" ||
      field(data, "canApply") !== false ||
      !Number.isSafeInteger(at) || (at as number) < 0 ||
      (at as number) > 8_640_000_000_000_000 ||
      !["serviceAccount", "user", "unknown"].includes(principal as string) ||
      !count(tabs) || tabs > 8 || !count(permissions) ||
      (owners !== null && !count(owners)) ||
      !version(before) || !version(after) || !digests.every(digest) ||
      !Array.isArray(blockers) ||
      blockers.length > SHIFT_SHEETS_OPERATIONAL_PREFLIGHT_BLOCKERS.length ||
      new Set(blockers).size !== blockers.length ||
      blockers.some((code) =>
        !SHIFT_SHEETS_OPERATIONAL_PREFLIGHT_BLOCKERS.includes(code))) {
    return null;
  }
  return {schemaVersion: 1, environment: "develop", canApply: false,
    observedAtMillis: at as number, workbookVersionBefore: before,
    workbookVersionAfter: after,
    observationPrincipalKind: principal as
      ShiftSheetsOperationalPreflightSummary["observationPrincipalKind"],
    selectedTabCount: tabs, permissionCount: permissions,
    ownerCount: owners as number | null,
    contentDigest: digests[0] as string, aclDigest: digests[1] as string,
    protectionsDigest: digests[2] as string,
    observationDigest: digests[3] as string, blockers: [...blockers]};
};

/**
 * Builds a read-only develop inspection behind infrastructure invoker IAM.
 * Transport and server scope are validated before the provider runs. The caller
 * supplies only an operation identity; it cannot select a
 * project, workbook, range or execution mode. Logs contain no caller fields or
 * provider diagnostics, and every response keeps canApply false.
 * @param {object} dependencies Server-owned target and read-only observation.
 * @param {object} logger Sanitized operator audit sink.
 * @return {Function} Strict inspection-only HTTP handler.
 */
export const createShiftPlanningDevelopInspectionHttpHandler = (
  dependencies: ShiftPlanningDevelopInspectionDependencies,
  logger: ShiftPlanningOperatorAuditLogger,
) => async (request: InspectionRequest, response: InspectionResponse) => {
  response.setHeader("Cache-Control", "no-store");
  const auditId = (dependencies.createAuditId ?? randomUUID)();
  const reject = (status: number, code: string, message: string) => {
    logger.warn("Develop shift inspection rejected", {
      auditSchemaVersion: 1, auditId, environment: "develop", failureCode: code,
    });
    response.status(status).json({ok: false, schemaVersion: 1, auditId,
      environment: "develop", canApply: false, error: {code, message}});
  };
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    reject(405, "method_not_allowed", "Only POST is supported.");
    return;
  }
  if (!request.query || Object.keys(request.query).length) {
    reject(400, "invalid_inspection_command",
      "Inspection commands do not accept query parameters.");
    return;
  }
  const parsed = command(request.body);
  if (!parsed) {
    reject(400, "invalid_inspection_command", "Inspection command is invalid.");
    return;
  }
  if (dependencies.projectId !==
        SHIFT_PLANNING_DEVELOP_INSPECTION_PROJECT_ID ||
      typeof dependencies.workbookId !== "string" ||
      !/^[A-Za-z0-9_-]{10,128}$/.test(dependencies.workbookId)) {
    reject(503, "inspection_unavailable", "Inspection is unavailable.");
    return;
  }
  try {
    const report = sanitize(await dependencies.inspect({...parsed,
      workbookId: dependencies.workbookId}));
    if (!report) throw new Error("Invalid inspection summary");
    logger.info("Develop shift inspection completed", {
      auditSchemaVersion: 1, auditId, environment: "develop", canApply: false,
      blockerCount: report.blockers.length,
    });
    response.status(200).json({ok: true, schemaVersion: 1, auditId,
      environment: "develop", canApply: false, report});
  } catch {
    reject(503, "inspection_unavailable", "Inspection is unavailable.");
  }
};

/**
 * Declares one IAM-only inspection entry. Creating this source declaration does
 * not provision its invoker, select a runtime identity or deploy a Function.
 * @param {object} dependencies Server-owned read-only provider composition.
 * @param {object} logger Sanitized operator audit sink.
 * @return {HttpsFunction} Inspection-only Function declaration.
 */
export const createShiftPlanningDevelopInspectionHttpFunction = (
  dependencies: ShiftPlanningDevelopInspectionDependencies,
  logger: ShiftPlanningOperatorAuditLogger,
): HttpsFunction => onRequest(
  SHIFT_PLANNING_DEVELOP_INSPECTION_HTTPS_OPTIONS,
  createShiftPlanningDevelopInspectionHttpHandler(dependencies, logger),
);
