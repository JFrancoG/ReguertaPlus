#!/usr/bin/env node
"use strict";

// Review artifact only. No live SDK client, apply mode or writable adapter.
const {readFileSync, statSync} = require("node:fs");
const {auditShiftPlanning, MAX_BYTES} = require("./audit-shift-planning.cjs");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {SHIFT_SHEETS_HEADERS: headers, shiftSheetsGridRows} = require("../lib/shift-sheets.js");
const {Timestamp} = require("@google-cloud/firestore");
const {encodeShiftPlanningFirestoreValue, decodeShiftPlanningFirestoreValue, decodeShiftPlanningFirestoreDocument} =
  require("../lib/shift-planning-publication-contract.js");
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

const exactKeys = (value, keys) => value !== null && typeof value === "object" && !Array.isArray(value) &&
  same(Object.keys(value).sort(), [...keys].sort());
const encode = (value) => encodeShiftPlanningFirestoreValue(value, "repair capture", new Set());
const timestamp = (encoded) => {
  requireValue(encoded?.kind === "timestamp");
  const value = decodeShiftPlanningFirestoreValue(encoded);
  requireValue(value instanceof Timestamp && same(encode(value), encoded)); return value;
};

// This binds supplied evidence; it does not attest how the evidence was captured.
const bindFirestoreCapture = (capture, expectedDigest, before, after) => {
  requireValue(Buffer.byteLength(JSON.stringify(capture)) <= MAX_BYTES && digest(capture) === expectedDigest);
  requireValue(exactKeys(capture, ["schemaVersion", "target", "inputDigest", "capturedAt", "documents", "absentPaths"]) &&
    capture.schemaVersion === 1 && same(capture.target, before.target) && capture.inputDigest === digest(before) &&
    capture.capturedAt === before.capturedAt && Array.isArray(capture.documents) && Array.isArray(capture.absentPaths));
  const root = `${before.target.environment}/plus-collections/shifts/`;
  const originals = new Map(before.source.map((entry) => [root + entry.row.id, entry]));
  const creates = after.source.filter((entry) => !originals.has(root + entry.row.id)).map((entry) => root + entry.row.id).sort();
  requireValue(capture.documents.length === originals.size && same([...capture.absentPaths].sort(), creates));
  const capturedAt = Timestamp.fromDate(new Date(capture.capturedAt)), seen = new Set(), documents = [];
  for (const entry of capture.documents) {
    requireValue(exactKeys(entry, ["targetPath", "updateTime", "payload"]) && originals.has(entry.targetPath) && !seen.has(entry.targetPath));
    seen.add(entry.targetPath);
    const updateTime = timestamp(entry.updateTime);
    requireValue(updateTime.seconds < capturedAt.seconds ||
      (updateTime.seconds === capturedAt.seconds && updateTime.nanoseconds <= capturedAt.nanoseconds));
    const doc = decodeShiftPlanningFirestoreDocument(entry.payload);
    requireValue(same(encode(doc), entry.payload));
    const source = originals.get(entry.targetPath), id = source.row.id;
    requireValue(doc.date instanceof Timestamp && ["type", "assignedUserIds", "helperUserId", "status", "source", "origin",
      "documentRevision", "assignmentRevision", "completion"].every((field) => Object.hasOwn(doc, field)));
    requireValue(doc.type === "delivery" ? doc.rotationOwnerUserIds === null && doc.rotationPositions === null :
      doc.rotationOwnerUserId === null && doc.roundNumber === null && doc.positionInRound === null);
    const owners = doc.type === "delivery" ? [doc.rotationOwnerUserId] : doc.rotationOwnerUserIds;
    const projection = {id, type: doc.type, date: doc.date.toDate().toISOString().slice(0, 10),
      rotationOwnerUserIds: owners, assignedUserIds: doc.assignedUserIds, helperUserId: doc.helperUserId,
      status: doc.status, source: doc.source, origin: doc.origin};
    requireValue(same(projection, source.row) && doc.documentRevision === source.documentRevision &&
      doc.assignmentRevision === source.assignmentRevision && exactKeys(doc.completion,
        ["state", "revision", "actualHelperUserId", "helperSourceAssignmentRevision", "completedAt"]));
    requireValue(doc.completion.revision === source.completionRevision &&
      doc.completion.state === (source.completed ? "completed" : "uncompleted"));
    if (source.completed) {
      requireValue(doc.completion.completedAt instanceof Timestamp && source.completionRevision > 0);
      if (doc.type === "delivery") requireValue(identity(doc.completion.actualHelperUserId) &&
        Number.isSafeInteger(doc.completion.helperSourceAssignmentRevision) && doc.completion.helperSourceAssignmentRevision > 0 &&
        doc.completion.helperSourceAssignmentRevision <= source.assignmentRevision);
      else requireValue(doc.completion.actualHelperUserId === null && doc.completion.helperSourceAssignmentRevision === null);
    } else requireValue(source.completionRevision === 0 && doc.completion.actualHelperUserId === null &&
      doc.completion.helperSourceAssignmentRevision === null && doc.completion.completedAt === null);
    const lineage = before.lineage[doc.type].rows.filter((row) => row.shiftId === id);
    const positions = doc.type === "delivery" ? [{roundNumber: doc.roundNumber, positionInRound: doc.positionInRound}] :
      doc.rotationPositions?.map((position) => ({roundNumber: position.roundNumber, positionInRound: position.positionInRound}));
    requireValue(lineage.length === 1 && same(positions, lineage[0].positions));
    if (doc.type === "market") requireValue(same(doc.rotationPositions.map((position) => position.rotationOwnerUserId), owners) &&
      same(doc.rotationPositions.map((position) => position.effectiveAssigneeUserId), doc.assignedUserIds));
    documents.push({targetPath: entry.targetPath, updateTime: entry.updateTime, payload: entry.payload,
      payloadDigest: digest(entry.payload), projectionDigest: digest(source)});
  }
  documents.sort((a, b) => a.targetPath.localeCompare(b.targetPath));
  return {captureDigest: expectedDigest, documents, absentPaths: creates};
};

const planShiftRepair = async ({input, proposal, target, expectedInputDigest, expectedProposalDigest, firestoreCapture, expectedCaptureDigest}) => {
  const before = structuredClone(input), after = structuredClone(proposal);
  requireValue((firestoreCapture === undefined) === (expectedCaptureDigest === undefined));
  requireValue(firestoreCapture === undefined || (firestoreCapture !== null && typeof firestoreCapture === "object" && !Array.isArray(firestoreCapture)));
  const capture = firestoreCapture === undefined ? null : structuredClone(firestoreCapture);
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
  const firestoreEvidence = capture === null ? null : bindFirestoreCapture(capture, expectedCaptureDigest, before, after);
  const body = {schemaVersion: firestoreEvidence ? 2 : 1, mode: "dry-run", scope: "normalized_projection_review", readyForApply: false,
    ...(firestoreEvidence ? {firestoreEvidence} : {}),
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
  if (args.includes("--firestore-capture") || args.includes("--expected-capture-digest")) {
    names.push("--firestore-capture", "--expected-capture-digest");
  }
  if (args.includes("--materialization") || args.includes("--expected-materialization-digest")) {
    names.push("--materialization", "--expected-materialization-digest");
  }
  if (args.includes("--baseline-revision") || args.includes("--expected-materialized-plan-digest")) {
    requireValue(args.includes("--materialization"));
    names.push("--baseline-revision", "--expected-materialized-plan-digest");
  }
  if (args.includes("--authority-capture") || args.includes("--expected-authority-capture-digest")) {
    requireValue(args.includes("--baseline-revision"));
    names.push("--authority-capture", "--expected-authority-capture-digest");
  }
  requireValue(args.length === names.length * 2); const values = {};
  for (let i = 0; i < args.length; i += 2) {
    requireValue(names.includes(args[i]) && !Object.hasOwn(values, args[i]) && args[i + 1]); values[args[i]] = args[i + 1];
  }
  requireValue(values["--mode"] === "dry-run");
  const planner = values["--materialization"] ? require("./materialize-shift-repair.cjs").materializeShiftRepair : planShiftRepair;
  const plan = await planner({input: readSnapshot(values["--input"]), proposal: readSnapshot(values["--proposal"]),
    target: {projectId: values["--project"], environment: values["--environment"], workbookId: values["--workbook"]},
    expectedInputDigest: values["--expected-input-digest"], expectedProposalDigest: values["--expected-proposal-digest"],
    ...(values["--firestore-capture"] ? {firestoreCapture: readSnapshot(values["--firestore-capture"]),
      expectedCaptureDigest: values["--expected-capture-digest"]} : {}),
    ...(values["--materialization"] ? {materialization: readSnapshot(values["--materialization"]),
      expectedMaterializationDigest: values["--expected-materialization-digest"]} : {}),
    ...(values["--baseline-revision"] ? {baselineRevision: values["--baseline-revision"],
      expectedMaterializedPlanDigest: values["--expected-materialized-plan-digest"]} : {}),
    ...(values["--authority-capture"] ? {authorityCapture: readSnapshot(values["--authority-capture"]),
      expectedAuthorityCaptureDigest: values["--expected-authority-capture-digest"]} : {})});
  process.stdout.write(JSON.stringify(plan, null, 2) + "\n");
  process.stderr.write(`Repair review: ${plan.projectionChanges.length} projections, ${plan.lineageChanges.length} lineage changes, ${plan.sheetsChanges.length} cells; apply unavailable.\n`);
};
module.exports = {planShiftRepair};
if (require.main === module) main(process.argv.slice(2)).catch(() => {
  process.stderr.write("Repair review rejected: invalid arguments, evidence or proposal.\n"); process.exitCode = 1;
});
