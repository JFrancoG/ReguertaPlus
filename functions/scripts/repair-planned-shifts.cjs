#!/usr/bin/env node
"use strict";

// Review artifact only. No live SDK client, apply mode or writable adapter.
const {readFileSync, statSync} = require("node:fs");
const {auditShiftPlanning, MAX_BYTES} = require("./audit-shift-planning.cjs");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {SHIFT_SHEETS_HEADERS: headers, shiftSheetsGridRows} = require("../lib/shift-sheets.js");
const same = (a, b) => digest(a) === digest(b);
const requireValue = (condition) => { if (!condition) throw new Error("repair_plan_rejected"); };
const identity = (value) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const sourceMap = (source) => {
  const result = new Map();
  for (const entry of source) {
    requireValue(identity(entry.row?.id) && !result.has(entry.row.id)); result.set(entry.row.id, entry);
  }
  return result;
};
const intersects = (range, row, column) => range && row >= (range.startRowIndex ?? 0) && row < (range.endRowIndex ?? Infinity) &&
  column >= (range.startColumnIndex ?? 0) && column < (range.endColumnIndex ?? Infinity);
const literal = (cell) => cell?.userEnteredValue ?? null;
const unmanagedCell = (cell) => { const {userEnteredValue, ...rest} = cell ?? {}; return rest; };

const cellChanges = (before, after, selectedTitles, sourceIds) => {
  requireValue(before.sheets.length === after.sheets.length);
  const changes = [];
  for (const sheet of [...before.sheets].sort((a, b) => a.properties.sheetId - b.properties.sheetId)) {
    const next = after.sheets.find((item) => item.properties.sheetId === sheet.properties.sheetId);
    requireValue(next);
    const {data: oldData, ...oldMeta} = sheet, {data: newData, ...newMeta} = next;
    requireValue(same(oldMeta, newMeta));
    for (const range of [...(sheet.merges ?? []), ...(sheet.protectedRanges ?? []).flatMap((p) => [p.range, ...(p.unprotectedRanges ?? [])])].filter(Boolean)) {
      requireValue(["startRowIndex", "endRowIndex", "startColumnIndex", "endColumnIndex"].every((key) =>
        range[key] === undefined || (Number.isSafeInteger(range[key]) && range[key] >= 0)));
      requireValue((range.startRowIndex ?? 0) < (range.endRowIndex ?? Infinity) &&
        (range.startColumnIndex ?? 0) < (range.endColumnIndex ?? Infinity));
    }
    const oldRows = shiftSheetsGridRows(sheet), newRows = shiftSheetsGridRows(next);
    const selected = selectedTitles.has(sheet.properties.title);
    requireValue(!selected || headers.every((header, index) => literal(oldRows[0]?.[index])?.stringValue === header &&
      !literal(oldRows[0]?.[index])?.formulaValue));
    for (let row = 0; row < Math.max(oldRows.length, newRows.length); row += 1) {
      const oldId = literal(oldRows[row]?.[0])?.stringValue, newId = literal(newRows[row]?.[0])?.stringValue;
      if (row > 0) requireValue(!oldId || oldId === newId);
      if (row > 0 && !oldId && newId) requireValue((oldRows[row] ?? []).slice(0, headers.length).every((cell) =>
        literal(cell) === null || same(literal(cell), {stringValue: ""})));
      for (let column = 0; column < Math.max(oldRows[row]?.length ?? 0, newRows[row]?.length ?? 0); column += 1) {
        const oldCell = oldRows[row]?.[column], newCell = newRows[row]?.[column];
        requireValue(same(unmanagedCell(oldCell), unmanagedCell(newCell)));
        const oldValue = literal(oldCell), newValue = literal(newCell);
        if (same(oldValue, newValue)) continue;
        requireValue(selected && row > 0 && column < headers.length && identity(newId) && sourceIds.has(newId) &&
          !Object.hasOwn(oldValue ?? {}, "formulaValue") && !Object.hasOwn(newValue ?? {}, "formulaValue"));
        requireValue(!(sheet.merges ?? []).some((range) => intersects(range, row, column)));
        requireValue(!(sheet.protectedRanges ?? []).some((protection) => !protection.range ||
          (intersects(protection.range, row, column) && !(protection.unprotectedRanges ?? []).some((range) => intersects(range, row, column)))));
        changes.push({sheetId: sheet.properties.sheetId, rowNumber: row + 1, columnNumber: column + 1,
          before: oldValue, after: newValue});
      }
    }
  }
  return changes;
};

const planShiftRepair = async ({input, proposal, target, expectedInputDigest, expectedProposalDigest}) => {
  const before = structuredClone(input), after = structuredClone(proposal);
  requireValue(before.schemaVersion === 2 && after.schemaVersion === 2);
  const originalAudit = await auditShiftPlanning(before, target), proposedAudit = await auditShiftPlanning(after, target);
  requireValue(originalAudit.inputDigest === expectedInputDigest && proposedAudit.inputDigest === expectedProposalDigest);
  requireValue(proposedAudit.findings.length === 0 && proposedAudit.crossStore === "evaluated");
  for (const key of ["target", "capturedAt", "aliases", "tabs", "workbookVersion", "members", "expectedDates"]) requireValue(same(before[key], after[key]));
  requireValue(before.tabs.every((tab) => tab.layout === "canonical"));
  for (const type of ["delivery", "market"]) {
    requireValue(originalAudit.lineage[type]?.selectedSource && proposedAudit.lineage[type]?.status === "consistent" &&
      same(before.lineage[type].bootstrap, after.lineage[type].bootstrap) && same(before.lineage[type].beforeDate, after.lineage[type].beforeDate));
  }
  requireValue(!originalAudit.findings.some((finding) => ["conflicting_bootstrap_source", "invalid_bootstrap_alternative"].includes(finding.code)));
  const oldRows = sourceMap(before.source), newRows = sourceMap(after.source), projectionChanges = [];
  requireValue([...oldRows.keys()].every((id) => newRows.has(id)));
  const deliveryDates = [...before.expectedDates.delivery].sort();
  const neighbor = (date, offset, rows) => {
    const at = deliveryDates.indexOf(date), adjacent = deliveryDates[at + offset];
    requireValue(at >= 0 && adjacent);
    const entry = rows.get(`shift_delivery_${adjacent.replaceAll("-", "")}`); requireValue(entry); return entry;
  };
  for (const [id, next] of [...newRows].sort(([a], [b]) => a.localeCompare(b))) {
    const old = oldRows.get(id);
    if (!old) {
      requireValue(!next.completed && [next.documentRevision, next.assignmentRevision, next.completionRevision].every((value) => value === 0));
      projectionChanges.push({id, before: null, after: next}); continue;
    }
    requireValue(old.documentRevision >= 1 && old.completed === (old.completionRevision > 0));
    requireValue(same(Object.keys(old.row).sort(), Object.keys(next.row).sort()));
    for (const key of ["documentRevision", "assignmentRevision", "completionRevision", "completed"]) requireValue(same(old[key], next[key]));
    requireValue(old.row.type === next.row.type && old.row.date === next.row.date);
    requireValue(!old.completed || same(old, next));
    if (old.completed) {
      const positions = (snapshot) => snapshot.lineage[old.row.type].rows.filter((row) => row.shiftId === id);
      requireValue(same(positions(before), positions(after)));
    }
    if (same(old, next)) continue;
    if (old.row.source !== next.row.source || old.row.origin !== next.row.origin) requireValue(next.row.source === "app" && next.row.origin === "planner");
    if (old.row.type === "delivery") {
      if (!same(old.row.assignedUserIds, next.row.assignedUserIds)) {
        for (const offset of [-1, 1]) { neighbor(old.row.date, offset, oldRows); neighbor(old.row.date, offset, newRows); }
      }
      if (old.row.helperUserId !== next.row.helperUserId) { neighbor(old.row.date, 1, oldRows); neighbor(old.row.date, 1, newRows); }
    }
    projectionChanges.push({id, before: old, after: next});
  }
  const lineageChanges = [];
  for (const type of ["delivery", "market"]) {
    const value = (snapshot) => ({rows: snapshot.lineage[type].rows, rotationAfterHorizon: snapshot.lineage[type].rotationAfterHorizon});
    if (!same(value(before), value(after))) lineageChanges.push({type, before: value(before), after: value(after)});
  }
  const sheetsChanges = cellChanges(before.spreadsheet, after.spreadsheet,
    new Set(after.tabs.map((tab) => tab.title)), new Set(newRows.keys()));
  const body = {schemaVersion: 1, mode: "dry-run", scope: "normalized_projection_review", readyForApply: false,
    target: before.target, inputDigest: originalAudit.inputDigest, proposalDigest: proposedAudit.inputDigest,
    originalAuditDigest: originalAudit.reportDigest, proposedAuditDigest: proposedAudit.reportDigest,
    projectionChanges, lineageChanges, sheetsChanges,
    pendingGates: ["trusted_capture_and_approved_calendar", "historical_membership_and_boundary_helpers", "backup_and_restore_rehearsal",
      "writer_exclusion_and_trigger_model", "full_document_atomic_cas_and_provenance", "migration_baseline_and_rollback"]};
  return {...body, planDigest: digest(body)};
};
const readSnapshot = (path) => {
  requireValue(statSync(path).isFile() && statSync(path).size <= MAX_BYTES); return JSON.parse(readFileSync(path, "utf8"));
};
const main = async (args) => {
  const names = ["--mode", "--input", "--proposal", "--project", "--environment", "--workbook", "--expected-input-digest", "--expected-proposal-digest"];
  requireValue(args.length === names.length * 2); const values = {};
  for (let i = 0; i < args.length; i += 2) {
    requireValue(names.includes(args[i]) && !Object.hasOwn(values, args[i]) && args[i + 1]); values[args[i]] = args[i + 1];
  }
  requireValue(values["--mode"] === "dry-run");
  const plan = await planShiftRepair({input: readSnapshot(values["--input"]), proposal: readSnapshot(values["--proposal"]),
    target: {projectId: values["--project"], environment: values["--environment"], workbookId: values["--workbook"]},
    expectedInputDigest: values["--expected-input-digest"], expectedProposalDigest: values["--expected-proposal-digest"]});
  process.stdout.write(JSON.stringify(plan, null, 2) + "\n");
  process.stderr.write(`Repair review: ${plan.projectionChanges.length} projections, ${plan.lineageChanges.length} lineage changes, ${plan.sheetsChanges.length} cells; apply unavailable.\n`);
};
if (require.main === module) main(process.argv.slice(2)).catch(() => {
  process.stderr.write("Repair review rejected: invalid arguments, evidence or proposal.\n"); process.exitCode = 1;
});
module.exports = {planShiftRepair};
