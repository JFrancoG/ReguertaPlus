import {createShiftPlanningDigest} from "./shift-planning-digest.js";
import {
  failShiftSheetsImport,
  readShiftSheetsImport,
} from "./shift-sheets-import.js";
import {
  ShiftSheetsProjectionRow,
  SHIFT_SHEETS_LIMITS,
} from "./shift-sheets.js";

export type ShiftSheetsImportSource = {
  row: ShiftSheetsProjectionRow;
  documentRevision: number;
  assignmentRevision: number;
  completionRevision: number;
  completed: boolean;
};

type AssignmentPatch = {
  id: string;
  assignedUserIds: readonly string[];
  helperUserId: string | null;
  status: ShiftSheetsProjectionRow["status"];
};

/**
 * Produces assignment-only patches and exact source guards, never applies them.
 * The trusted source must include the continuous delivery neighborhood. A lead
 * edit at either supplied edge is rejected because missing neighbors are not
 * proof of a real rotation boundary. Apply must re-read these source guards and
 * the complete neighborhood under the governed writer/notification transaction.
 * @param {object} input Complete import observation and trusted source
 * revisions.
 * @return {object} Reviewable zero-write plan; no deletion or ownership
 * mutation.
 */
export const planShiftSheetsImport = (input: {
  observation: Awaited<ReturnType<typeof readShiftSheetsImport>>;
  source: readonly ShiftSheetsImportSource[];
}) => {
  const {observation} = input;
  const source = structuredClone(input.source);
  const {snapshotDigest, ...observedValues} = observation;
  if (createShiftPlanningDigest(observedValues) !== snapshotDigest) {
    return failShiftSheetsImport(
      "Import observation was changed after reading.",
    );
  }
  if (observation.missingIds.length ||
    createShiftPlanningDigest(source.map((item) => item.row)) !==
      observation.baselineDigest) {
    return failShiftSheetsImport("Import source is incomplete or has changed.");
  }
  if (source.length > SHIFT_SHEETS_LIMITS.projectionRows ||
    new Set(source.map((item) => item.row.id)).size !== source.length ||
    source.some((item) =>
      [item.documentRevision, item.assignmentRevision, item.completionRevision]
        .some((revision) => !Number.isSafeInteger(revision) || revision < 0) ||
      item.documentRevision < 1 || typeof item.completed !== "boolean" ||
      item.completed !== (item.completionRevision > 0))) {
    return failShiftSheetsImport("Source revisions or completion are invalid.");
  }
  const byId = new Map(source.map((item) => [item.row.id, item]));
  const delivery = source.filter((item) => item.row.type === "delivery")
    .sort((a, b) => a.row.date.localeCompare(b.row.date));
  const proposed = new Map(observation.assignments.map((item) =>
    [item.id, item]));
  if (proposed.size !== observation.assignments.length) {
    return failShiftSheetsImport("Import assignments contain duplicate IDs.");
  }
  const patches = new Map<string, AssignmentPatch>();
  const guards = new Set<string>();
  const patchFor = (item: ShiftSheetsImportSource) => {
    let patch = patches.get(item.row.id);
    if (!patch) {
      patch = {id: item.row.id,
        assignedUserIds: [...item.row.assignedUserIds],
        helperUserId: item.row.helperUserId, status: item.row.status};
      patches.set(item.row.id, patch);
    }
    return patch;
  };
  const lead = (item: ShiftSheetsImportSource) =>
    proposed.get(item.row.id)?.assignedUserIds[0] ??
      item.row.assignedUserIds[0];
  for (const assignment of observation.assignments) {
    const current = byId.get(assignment.id);
    if (!current || current.row.type !== assignment.type ||
      current.row.date !== assignment.date) {
      return failShiftSheetsImport("Assignment is not in the trusted source.");
    }
    const changedLead =
      createShiftPlanningDigest(assignment.assignedUserIds) !==
      createShiftPlanningDigest(current.row.assignedUserIds);
    const changedStatus = assignment.status !== current.row.status;
    if (!changedLead && !changedStatus) continue;
    if (current.completed || assignment.status === "swap_pending" ||
      current.row.status === "swap_pending") {
      return failShiftSheetsImport(
        "Completed history or pending swaps are locked.",
      );
    }
    guards.add(current.row.id);
    Object.assign(patchFor(current), {
      assignedUserIds: [...assignment.assignedUserIds],
      status: assignment.status,
    });
    if (assignment.type !== "delivery" || !changedLead) continue;
    const index = delivery.indexOf(current);
    const previous = delivery[index - 1];
    const next = delivery[index + 1];
    if (!previous || !next) {
      return failShiftSheetsImport(
        "Delivery edit lacks a proven neighborhood.",
      );
    }
    [previous, current, next].forEach((item) => guards.add(item.row.id));
    if (lead(previous) === lead(current) || lead(current) === lead(next)) {
      return failShiftSheetsImport(
        "Adjacent delivery leads must remain distinct.",
      );
    }
    if (!previous.completed) patchFor(previous).helperUserId = lead(current);
    patchFor(current).helperUserId = lead(next);
  }
  const planned = [...patches.values()].sort((a, b) =>
    a.id.localeCompare(b.id));
  const sourceGuards = source.filter((item) => guards.has(item.row.id))
    .sort((a, b) => a.row.id.localeCompare(b.row.id));
  const plan = {environment: observation.environment,
    workbookId: observation.workbookId,
    workbookRevision: observation.workbookRevision,
    snapshotDigest: observation.snapshotDigest,
    patches: planned, sourceGuards};
  return {...plan, planDigest: createShiftPlanningDigest(plan)};
};
