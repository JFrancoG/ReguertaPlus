import {Timestamp} from "@google-cloud/firestore";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {createShiftPlanningDigest} from "./shift-planning-digest.js";
import {
  ShiftPlanningProcessingSyncCommand,
  ShiftPlanningSyncReadBackEvidence,
  createShiftPlanningCompletedSyncCommand,
  parseShiftPlanningPersistedSyncCommand,
} from "./shift-planning-sync-command.js";

/** One possible external submission, never an authorization to retry it. */
export type ShiftPlanningSheetsSubmission = {
  schemaVersion: 1;
  command: ShiftPlanningProcessingSyncCommand;
  projectionDigest: string;
  requestDigest: string;
  beforeWorkbookRevision: string;
  submittedAt: Timestamp;
  evidence: ShiftPlanningSyncReadBackEvidence | null;
};

export type ShiftPlanningSheetsSubmissionBinding = Pick<
  ShiftPlanningSheetsSubmission,
  "projectionDigest" | "requestDigest" | "beforeWorkbookRevision"
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
    "requestDigest", "beforeWorkbookRevision", "submittedAt", "evidence"];
  if (record.schemaVersion !== 1 ||
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
    schemaVersion: 1,
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
