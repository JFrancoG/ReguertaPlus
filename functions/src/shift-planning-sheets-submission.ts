import {Timestamp} from "@google-cloud/firestore";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {createShiftPlanningDigest} from "./shift-planning-digest.js";
import {
  ShiftPlanningProcessingSyncCommand,
  ShiftPlanningSyncReadBackEvidence,
  createShiftPlanningCompletedSyncCommand,
  parseShiftPlanningPersistedSyncCommand,
} from "./shift-planning-sync-command.js";

import {ShiftSheetsHumanGenerationRow, shiftSheetsISOWeekKey} from
  "./shift-sheets-human-layout.js";

export type ShiftPlanningReadableSubmission = {
  environment: "develop" | "production";
  rows: readonly ShiftSheetsHumanGenerationRow[];
  sourceVersions: readonly {path: string; updateTime: Timestamp | null}[];
};

/** One possible external submission, never an authorization to retry it. */
export type ShiftPlanningSheetsSubmission = {
  schemaVersion: 1 | 2;
  readable?: ShiftPlanningReadableSubmission;
  command: ShiftPlanningProcessingSyncCommand;
  projectionDigest: string;
  requestDigest: string;
  beforeWorkbookRevision: string;
  submittedAt: Timestamp;
  evidence: ShiftPlanningSyncReadBackEvidence | null;
};

export type ShiftPlanningSheetsSubmissionBinding = Pick<
  ShiftPlanningSheetsSubmission,
  "projectionDigest" | "requestDigest" | "beforeWorkbookRevision" | "readable"
>;

export const failSheetsSubmission = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_sync_command", message);
};

/**
 * Drive's file version is an int64 observation, never a Sheets CAS token.
 * @param {unknown} value Raw Drive version.
 * @return {string} Exact positive decimal representation.
 */
export const requireShiftSheetsWorkbookVersion = (value: unknown): string => {
  if (typeof value !== "string" || !/^[1-9][0-9]{0,18}$/.test(value) ||
    BigInt(value) > BigInt("9223372036854775807")) {
    return failSheetsSubmission("Workbook version is not a Drive int64.");
  }
  return value;
};

const parseReadableSubmission = (
  value: unknown, command: ShiftPlanningProcessingSyncCommand,
): ShiftPlanningReadableSubmission => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return failSheetsSubmission("Readable submission is missing.");
  }
  const record = value as ShiftPlanningReadableSubmission;
  const exact = (value: object, keys: string[]) => value &&
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key));
  const id = (value: unknown) => typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
  const text = (value: unknown, required = true) =>
    typeof value === "string" && value.length <= 1024 &&
    (!required || Boolean(value.trim()));
  if (!exact(record, ["environment", "rows", "sourceVersions"]) ||
    !["develop", "production"].includes(record.environment) ||
    !Array.isArray(record.rows) || !record.rows.length ||
    record.rows.length > 500 || !Array.isArray(record.sourceVersions) ||
    record.sourceVersions.length > 500 ||
    Buffer.byteLength(JSON.stringify(record)) > 900000) {
    return failSheetsSubmission("Readable submission exceeds its contract.");
  }
  const root = `${record.environment}/plus-collections`;
  const expected = new Set<string>();
  const ids = new Set<string>();
  for (const row of record.rows) {
    if (!exact(row, ["id", "visibleDate", "assignees", "helper"]) ||
      !id(row.id) || ids.has(row.id) ||
      !row.id.startsWith(`shift_${command.type}_`) ||
      typeof row.visibleDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row.visibleDate) ||
      !Number.isFinite(Date.parse(row.visibleDate)) ||
      new Date(row.visibleDate).toISOString().slice(0, 10) !==
        row.visibleDate ||
      !Array.isArray(row.assignees) ||
      row.assignees.length !== (command.type === "delivery" ? 1 : 3) ||
      new Set(row.assignees.map((person: {userId?: unknown}) =>
        person?.userId)).size !==
        row.assignees.length) {
      return failSheetsSubmission("Readable row identity is invalid.");
    }
    ids.add(row.id);
    expected.add(`${root}/shifts/${row.id}`);
    if (command.type === "delivery") {
      expected.add(`${root}/deliveryCalendar/` +
        shiftSheetsISOWeekKey(row.visibleDate));
    }
    for (const person of row.assignees) {
      if (!exact(person, ["userId", "name", "phone"]) ||
        !id(person.userId) || !text(person.name) ||
        !text(person.phone, false)) {
        return failSheetsSubmission("Readable assignee is invalid.");
      }
      expected.add(`${root}/users/${person.userId}`);
    }
    if (row.helper !== null) {
      if (command.type !== "delivery" ||
        !exact(row.helper, ["userId", "name"]) ||
        !id(row.helper.userId) || !text(row.helper.name)) {
        return failSheetsSubmission("Readable helper is invalid.");
      }
      expected.add(`${root}/users/${row.helper.userId}`);
    }
  }
  if (record.sourceVersions.length !== expected.size ||
    record.sourceVersions.some((source) =>
      !exact(source, ["path", "updateTime"]) || !expected.delete(source.path) ||
      (!(source.updateTime instanceof Timestamp) &&
        !(source.updateTime === null &&
          source.path.startsWith(`${root}/deliveryCalendar/`))))) {
    return failSheetsSubmission("Readable source versions are incomplete.");
  }
  return {environment: record.environment, rows: structuredClone(record.rows),
    sourceVersions: record.sourceVersions.map((source) => ({...source}))};
};

/**
 * Reuses the existing completion codec for exact read-back evidence.
 * A submission can remain unresolved indefinitely after a crash or timeout.
 * @param {unknown} value Backend-only receipt or workbook pointer contents.
 * @return {ShiftPlanningSheetsSubmission} Validated detached receipt.
 */
export const parseShiftPlanningSheetsSubmission = (
  value: unknown,
): ShiftPlanningSheetsSubmission => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return failSheetsSubmission("Sheets submission must be an object.");
  }
  const record = value as Record<string, unknown>;
  const keys = ["schemaVersion", "command", "projectionDigest",
    "requestDigest", "beforeWorkbookRevision", "submittedAt", "evidence",
    ...(record.schemaVersion === 2 ? ["readable"] : [])];
  if (![1, 2].includes(record.schemaVersion as number) ||
    Object.keys(record).length !== keys.length ||
    Object.keys(record).some((key) => !keys.includes(key))) {
    return failSheetsSubmission("Sheets submission fields are not exact.");
  }
  const command = parseShiftPlanningPersistedSyncCommand(record.command);
  if (command.state !== "processing" ||
    !(record.submittedAt instanceof Timestamp) ||
    record.submittedAt.toMillis() < command.claim.acquiredAt.toMillis() ||
    record.submittedAt.toMillis() >= command.claim.expiresAt.toMillis()) {
    return failSheetsSubmission("Sheets submission has no valid claim.");
  }
  const sheetDigest = (digest: unknown): string => {
    if (typeof digest !== "string" ||
      !/^shift-sheets:v1:sha256:[a-f0-9]{64}$/.test(digest)) {
      return failSheetsSubmission("Sheets submission digest is invalid.");
    }
    return digest;
  };
  const result: ShiftPlanningSheetsSubmission = {
    schemaVersion: record.schemaVersion as 1 | 2,
    ...(record.schemaVersion === 2 ?
      {readable: parseReadableSubmission(record.readable, command)} : {}),
    command,
    projectionDigest: sheetDigest(record.projectionDigest),
    requestDigest: sheetDigest(record.requestDigest),
    beforeWorkbookRevision: requireShiftSheetsWorkbookVersion(
      record.beforeWorkbookRevision,
    ),
    submittedAt: record.submittedAt,
    evidence: null,
  };
  if (record.evidence !== null) {
    if (typeof record.evidence !== "object" ||
      record.evidence === null || Array.isArray(record.evidence) ||
      Object.keys(record.evidence).length !== 2 ||
      !("workbookRevision" in record.evidence) ||
      !("partitionDigest" in record.evidence)) {
      return failSheetsSubmission("Sheets evidence fields are not exact.");
    }
    const evidence = record.evidence as ShiftPlanningSyncReadBackEvidence;
    const completed = createShiftPlanningCompletedSyncCommand({
      command, completedAt: record.submittedAt, evidence,
    });
    const revision = requireShiftSheetsWorkbookVersion(
      completed.terminal.readBackWorkbookRevision,
    );
    if (BigInt(revision) <= BigInt(result.beforeWorkbookRevision) ||
      evidence.partitionDigest !== createShiftPlanningDigest({
        projectionDigest: result.projectionDigest,
      })) {
      return failSheetsSubmission("Read-back is not bound to submission.");
    }
    result.evidence = {
      workbookRevision: revision,
      partitionDigest: completed.terminal.readBackPartitionDigest,
    };
  }
  return result;
};

/** Import reservation shares the activation pointer, without a fake claim. */
export type ShiftSheetsImportSubmission = {
  schemaVersion: 1;
  kind: "importWriteBack";
  environment: "develop" | "production";
  workbookId: string;
  operationId: string;
  resultDigest: string;
  planDigest: string;
  beforeWorkbookRevision: string;
  batch: {
    projectionDigest: string;
    requestDigest: string;
    submittedAt: Timestamp;
  } | null;
  evidence: {
    workbookRevision: string;
    partitionDigest: string;
  } | null;
};

/**
 * A null batch is a reservation; a persisted batch is always inspect-only.
 * Verification changes only evidence, never the physical submission identity.
 * @param {unknown} value Private import receipt or shared workbook pointer.
 * @return {ShiftSheetsImportSubmission} Exact validated receipt.
 */
export const parseShiftSheetsImportSubmission = (
  value: unknown,
): ShiftSheetsImportSubmission => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return failSheetsSubmission("Import submission must be an object.");
  }
  const record = value as ShiftSheetsImportSubmission;
  const keys = ["schemaVersion", "kind", "environment", "workbookId",
    "operationId", "resultDigest", "planDigest", "beforeWorkbookRevision",
    "batch", "evidence"];
  const id = (value: unknown) => typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
  const planningDigest = (value: unknown) => typeof value === "string" &&
    /^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value);
  const sheetsDigest = (value: unknown) => typeof value === "string" &&
    /^shift-sheets:v1:sha256:[a-f0-9]{64}$/.test(value);
  if (Object.keys(record).length !== keys.length ||
    Object.keys(record).some((key) => !keys.includes(key)) ||
    record.schemaVersion !== 1 || record.kind !== "importWriteBack" ||
    !["develop", "production"].includes(record.environment) ||
    !id(record.workbookId) || !id(record.operationId) ||
    !record.operationId.startsWith("sheets-import-") ||
    !planningDigest(record.resultDigest) ||
    !planningDigest(record.planDigest)) {
    return failSheetsSubmission("Import submission fields are not exact.");
  }
  const revision = requireShiftSheetsWorkbookVersion(
    record.beforeWorkbookRevision,
  );
  const batch = record.batch;
  if (batch !== null && (!batch || typeof batch !== "object" ||
    Object.keys(batch).length !== 3 ||
    !sheetsDigest(batch.projectionDigest) ||
    !sheetsDigest(batch.requestDigest) ||
    !(batch.submittedAt instanceof Timestamp))) {
    return failSheetsSubmission("Import batch identity is invalid.");
  }
  const evidence = record.evidence;
  if (evidence !== null) {
    if (!batch || !evidence || typeof evidence !== "object" ||
      Object.keys(evidence).length !== 2 ||
      evidence.partitionDigest !== createShiftPlanningDigest({
        projectionDigest: batch.projectionDigest,
      })) {
      return failSheetsSubmission(
        "Import read-back is not bound to its batch.",
      );
    }
    const readBackRevision = requireShiftSheetsWorkbookVersion(
      evidence.workbookRevision,
    );
    if (BigInt(readBackRevision) <= BigInt(revision)) {
      return failSheetsSubmission("Import read-back version did not advance.");
    }
  }
  return {...record, batch: batch ? {...batch} : null,
    evidence: evidence ? {...evidence} : null};
};

/**
 * One workbook pointer serializes activation and import submissions. Legacy
 * schema-v1 canonical and schema-v2 readable receipts retain their identity.
 * @param {unknown} value Current workbook submission document.
 * @return {object} Fully validated submission with a shared workbook identity.
 */
export const parseShiftSheetsWorkbookSubmission = (value: unknown) => {
  if (value && typeof value === "object" && "kind" in value) {
    const receipt = parseShiftSheetsImportSubmission(value);
    return {workbookId: receipt.workbookId, evidence: receipt.evidence,
      importOperationId: receipt.operationId};
  }
  const receipt = parseShiftPlanningSheetsSubmission(value);
  return {workbookId: receipt.command.workbookId, evidence: receipt.evidence,
    importOperationId: null};
};
