#!/usr/bin/env node
"use strict";

// Offline evidence only: no Firebase/Google clients or mutation mode.
const {readFileSync, statSync} = require("node:fs");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {createShiftSheetsConfig, resolveShiftSheetsTab} = require("../lib/shift-sheets-config.js");
const {buildShiftSheetsProjections, SHIFT_SHEETS_LIMITS: limits} = require("../lib/shift-sheets.js");
const {readShiftSheetsImport} = require("../lib/shift-sheets-import.js");
const {readShiftSheetsImportMapping} = require("../lib/shift-sheets-import-http.js");
const {resolveShiftRotationBootstrap} = require("../lib/shift-rotation-bootstrap.js");
const {consumeRotationPositions} = require("../lib/shift-planning-contract.js");
const MAX_BYTES = 4 * 1024 * 1024;
const types = ["delivery", "market"];
const requireValue = (condition) => { if (!condition) throw new Error("invalid_audit_evidence"); };
const exact = (value, keys) => value !== null && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).sort().join(",") === [...keys].sort().join(",");
const id = (value) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const same = (a, b) => digest(a) === digest(b);

// Bounds apply before the existing grid reader can allocate sparse arrays.
const validateGrid = (spreadsheet, workbookId) => {
  requireValue(spreadsheet?.spreadsheetId === workbookId && Array.isArray(spreadsheet.sheets) &&
    spreadsheet.sheets.length <= limits.tabs);
  const titles = new Set(), ids = new Set();
  let cells = 0;
  for (const sheet of spreadsheet.sheets) {
    const p = sheet.properties, grid = p?.gridProperties;
    requireValue(p && typeof p.title === "string" && !titles.has(p.title) &&
      Number.isSafeInteger(p.sheetId) && p.sheetId >= 0 && !ids.has(p.sheetId) &&
      Number.isSafeInteger(grid?.rowCount) && grid.rowCount > 0 && grid.rowCount <= limits.tabRows &&
      Number.isSafeInteger(grid?.columnCount) && grid.columnCount > 0 && grid.columnCount <= limits.tabColumns &&
      Array.isArray(sheet.data));
    titles.add(p.title); ids.add(p.sheetId); cells += grid.rowCount * grid.columnCount;
    const occupied = new Set();
    for (const data of sheet.data) {
      const r = data.startRow ?? 0, c = data.startColumn ?? 0;
      requireValue(Number.isSafeInteger(r) && r >= 0 && Number.isSafeInteger(c) && c >= 0 &&
        r < grid.rowCount && c < grid.columnCount && Array.isArray(data.rowData) &&
        r + data.rowData.length <= grid.rowCount);
      data.rowData.forEach((row, offset) => {
        requireValue(Array.isArray(row.values) && c + row.values.length <= grid.columnCount);
        row.values.forEach((cell, col) => {
          const key = `${r + offset}:${c + col}`;
          requireValue((cell === null || (typeof cell === "object" && !Array.isArray(cell))) && !occupied.has(key));
          occupied.add(key);
        });
      });
    }
  }
  requireValue(cells <= limits.readCells);
};

// These are captured contracts, not permission to reconstruct ownership from assignees.
const bootstrapSources = ["versionedState", "ownerHistory", "approvedMapping"];
const metadataKeys = ["revision", "digest", "provenance"];
const validIds = (values) => Array.isArray(values) && values.length > 0 && values.length <= limits.projectionRows &&
  values.every(id) && new Set(values).size === values.length;
const cursorShape = (value) => exact(value, ["schemaVersion", "type", "cohortUserIds", "roundNumber", "nextMemberIndex"]) &&
  validIds(value.cohortUserIds);
const metadataShape = (value) => metadataKeys.every((key) => typeof value[key] === "string" && value[key].length <= 1024);
const validateBootstrapShape = (input) => {
  requireValue(exact(input, ["type", "eligibleUserIds", "isTrulyNewRotation", ...bootstrapSources, "legacyDeliveryHelper"]) &&
    types.includes(input.type) && validIds(input.eligibleUserIds) && typeof input.isTrulyNewRotation === "boolean");
  const state = input.versionedState, history = input.ownerHistory, mapping = input.approvedMapping, helper = input.legacyDeliveryHelper;
  if (state !== null) requireValue(exact(state, [...metadataKeys, "rotation"]) && metadataShape(state) && cursorShape(state.rotation));
  if (history !== null) {
    requireValue(exact(history, [...metadataKeys, "entries"]) && metadataShape(history) && Array.isArray(history.entries) &&
      history.entries.length <= limits.projectionRows * 3);
    for (const entry of history.entries) requireValue(exact(entry, ["type", "chronologySequence", "roundNumber", "positionInRound",
      "rotationOwnerUserId", "cohortUserIds", "evidence"]) && id(entry.rotationOwnerUserId) && validIds(entry.cohortUserIds) &&
      typeof entry.evidence === "string" && entry.evidence.length <= 1024);
  }
  if (mapping !== null) requireValue(exact(mapping, [...metadataKeys, "approvalStatus", "type", "orderedUserIds", "roundNumber",
    "nextMemberIndex", "stableTieOrder", "evidence"]) && metadataShape(mapping) && validIds(mapping.orderedUserIds) &&
    validIds(mapping.stableTieOrder) && typeof mapping.evidence === "string" && mapping.evidence.length <= 1024);
  if (helper !== null) {
    const keys = helper?.kind === "unique" ? ["kind", "userId", "evidenceRevision", "evidenceDigest"] :
      helper?.kind === "ambiguous" ? ["kind", "candidateUserIds", "evidenceDigest"] : ["kind", "userId", "evidenceDigest"];
    requireValue(exact(helper, keys) && ["unique", "ambiguous", "ineligible"].includes(helper.kind) &&
      typeof helper.evidenceDigest === "string" && helper.evidenceDigest.length <= 1024 &&
      (helper.kind === "ambiguous" ? validIds(helper.candidateUserIds) : id(helper.userId)) &&
      (helper.kind !== "unique" || (typeof helper.evidenceRevision === "string" && helper.evidenceRevision.length <= 1024)));
  }
};

const auditLineage = (input, findings) => {
  requireValue(exact(input.lineage, types));
  const summaries = {};
  for (const type of types) {
    const start = findings.length, evidence = input.lineage[type];
    const add = (code, rowIndex = null) => findings.push({code, rowIndex, type});
    if (evidence === null) { add("missing_lineage_evidence"); summaries[type] = {status: "missing"}; continue; }
    try {
      requireValue(exact(evidence, ["beforeDate", "bootstrap", "rows", "rotationAfterHorizon"]));
      validateBootstrapShape(evidence.bootstrap);
      requireValue(cursorShape(evidence.rotationAfterHorizon) && Array.isArray(evidence.rows) && evidence.rows.length <= limits.projectionRows);
      for (const row of evidence.rows) requireValue(exact(row, ["shiftId", "positions"]) && id(row.shiftId) &&
        Array.isArray(row.positions) && row.positions.length <= 3 && row.positions.every((position) =>
          exact(position, ["roundNumber", "positionInRound"]) && Number.isSafeInteger(position.roundNumber) &&
          position.roundNumber > 0 && Number.isSafeInteger(position.positionInRound) && position.positionInRound > 0));
      const dates = [...input.expectedDates[type]].sort(), bootstrap = evidence.bootstrap;
      if (evidence.beforeDate !== dates[0] || bootstrap.type !== type || evidence.rotationAfterHorizon.type !== type) {
        add("lineage_boundary_mismatch"); summaries[type] = {status: "rejected"}; continue;
      }
      const eligible = input.members.filter((member) => member.eligibleTypes.includes(type)).map((member) => member.userId).sort();
      if (!same([...bootstrap.eligibleUserIds].sort(), eligible) || eligible.length < (type === "delivery" ? 2 : 3)) {
        add("bootstrap_roster_mismatch"); summaries[type] = {status: "rejected"}; continue;
      }
      let selected;
      try { selected = resolveShiftRotationBootstrap(bootstrap); } catch {
        add("invalid_rotation_bootstrap"); summaries[type] = {status: "rejected"}; continue;
      }
      // Selection retains HU-082 precedence; the audit still surfaces contradictory lower-priority evidence.
      for (const source of bootstrapSources.filter((source) => source !== selected.source && bootstrap[source] !== null)) {
        const alternative = {...bootstrap, versionedState: null, ownerHistory: null, approvedMapping: null, [source]: bootstrap[source]};
        try {
          if (!same(resolveShiftRotationBootstrap(alternative).rotation, selected.rotation)) add("conflicting_bootstrap_source");
        } catch { add("invalid_bootstrap_alternative"); }
      }
      const width = type === "delivery" ? 1 : 3;
      const expected = consumeRotationPositions(selected.rotation, dates.length * width);
      // Validate the resulting boundary too, including safe-integer round overflow.
      consumeRotationPositions(expected.nextRotation, 0);
      const rowIds = dates.map((date) => `shift_${type}_${date.replaceAll("-", "")}`);
      for (const observed of evidence.rows) if (!rowIds.includes(observed.shiftId)) add("unexpected_position_evidence");
      for (const [offset, shiftId] of rowIds.entries()) {
        const sources = input.source.map((entry, index) => ({entry, index})).filter(({entry}) => entry.row?.id === shiftId);
        const observed = evidence.rows.filter((row) => row.shiftId === shiftId);
        const index = sources.length === 1 ? sources[0].index : null;
        if (sources.length !== 1) add(sources.length ? "ambiguous_lineage_source" : "missing_lineage_source");
        if (observed.length !== 1) add(observed.length ? "duplicate_position_evidence" : "missing_position_evidence", index);
        const positions = expected.positions.slice(offset * width, (offset + 1) * width);
        if (sources.length === 1) {
          const row = sources[0].entry.row;
          if (row.type !== type || row.date !== dates[offset]) add("lineage_source_mismatch", index);
          if (!Array.isArray(row.rotationOwnerUserIds) || !same(row.rotationOwnerUserIds, positions.map((position) => position.rotationOwnerUserId))) {
            add("rotation_owner_sequence_mismatch", index);
          }
        }
        if (observed.length === 1 && !same(observed[0].positions, positions.map(({roundNumber, positionInRound}) => ({roundNumber, positionInRound})))) {
          add("rotation_position_mismatch", index);
        }
      }
      if (!same(evidence.rotationAfterHorizon, expected.nextRotation)) add("rotation_cursor_mismatch");
      summaries[type] = {status: findings.length === start ? "consistent" : "findings", selectedSource: selected.source,
        bootstrapDigest: digest(selected), expectedPositionCount: expected.positions.length};
    } catch {
      add("invalid_lineage_evidence"); summaries[type] = {status: "rejected"};
    }
  }
  return summaries;
};

/** Audits supplied evidence, never certifies its capture or invents rotation lineage. */
const auditShiftPlanning = async (evidence, target) => {
  requireValue(Buffer.byteLength(JSON.stringify(evidence)) <= MAX_BYTES);
  const input = structuredClone(evidence);
  requireValue(exact(input, ["schemaVersion", "target", "capturedAt", "aliases", "tabs", "workbookVersion",
    "spreadsheet", "source", "members", "expectedDates", ...(input.schemaVersion === 2 ? ["lineage"] : [])]) &&
    [1, 2].includes(input.schemaVersion));
  requireValue(exact(target, ["projectId", "environment", "workbookId"]) &&
    /^[a-z][a-z0-9-]{4,62}$/.test(target.projectId) && same(input.target, target));
  requireValue(typeof input.capturedAt === "string" && /^\d{4}-\d{2}-\d{2}T/.test(input.capturedAt) &&
    new Date(input.capturedAt).toISOString() === input.capturedAt);
  requireValue(typeof input.workbookVersion === "string" && /^[1-9][0-9]*$/.test(input.workbookVersion));
  requireValue(Array.isArray(input.aliases));
  const config = createShiftSheetsConfig({environment: target.environment,
    workbooks: {[target.environment]: target.workbookId}, aliases: input.aliases});
  const tabs = readShiftSheetsImportMapping(config, {
    [`SHIFT_SHEETS_IMPORT_TABS_${target.environment.toUpperCase()}`]: JSON.stringify(input.tabs),
  });
  requireValue(exact(input.expectedDates, types));
  for (const type of types) {
    const dates = input.expectedDates[type];
    requireValue(Array.isArray(dates) && dates.length > 0 && dates.length <= limits.projectionRows &&
      new Set(dates).size === dates.length);
    for (const date of dates) {
      const routed = resolveShiftSheetsTab(config, type, date);
      requireValue(tabs.some((tab) => tab.type === type && tab.title === routed.title));
    }
  }
  requireValue(Array.isArray(input.members) && input.members.length > 0 && input.members.length <= limits.projectionRows);
  const members = new Map();
  for (const member of input.members) {
    requireValue(exact(member, ["userId", "names", "phones", "eligibleTypes"]) && id(member.userId) &&
      !members.has(member.userId) && [member.names, member.phones, member.eligibleTypes].every(Array.isArray) &&
      [...member.names, ...member.phones].every((value) => typeof value === "string" && value.length <= 1024) &&
      member.eligibleTypes.every((type) => types.includes(type)));
    members.set(member.userId, member);
  }
  requireValue(Array.isArray(input.source) && input.source.length <= limits.projectionRows);
  validateGrid(input.spreadsheet, target.workbookId);
  const findings = [];
  // Indices refer to the input artifact; no member names, phones or raw errors leave it.
  const add = (code, rowIndex = null) => findings.push({code, rowIndex});
  const valid = [], ids = new Set(), dates = new Map();
  let comparable = input.source.length > 0;
  input.source.forEach((entry, index) => {
    requireValue(exact(entry, ["row", "documentRevision", "assignmentRevision", "completionRevision", "completed"]) &&
      typeof entry.completed === "boolean" &&
      [entry.documentRevision, entry.assignmentRevision, entry.completionRevision].every((n) => Number.isSafeInteger(n) && n >= 0));
    const row = entry.row;
    if (!exact(row, ["id", "type", "date", "rotationOwnerUserIds", "assignedUserIds", "helperUserId", "status", "source", "origin"])) {
      add("invalid_projection", index); comparable = false; return;
    }
    if (!["app", "google_sheets"].includes(row.source) || (row.origin === "planner" && row.source !== "app")) {
      add("invalid_source", index); comparable = false;
    }
    // Calendar presence is independent of source/assignment validity.
    try { resolveShiftSheetsTab(config, row.type, row.date); } catch {
      add("invalid_projection", index); comparable = false; return;
    }
    if (row.id !== `shift_${row.type}_${row.date.replaceAll("-", "")}`) {
      add("invalid_stable_id", index); comparable = false;
    }
    const key = `${row.type}:${row.date}`;
    if (id(row.id) && ids.has(row.id)) { add("duplicate_id", index); comparable = false; }
    if (dates.has(key)) { add("duplicate_date", index); comparable = false; }
    if (id(row.id)) ids.add(row.id);
    dates.set(key, (dates.get(key) ?? 0) + 1);
    if (!input.expectedDates[row.type].includes(row.date)) add("unexpected_date", index);
    try { buildShiftSheetsProjections(config, [row]); } catch {
      add("invalid_projection", index); comparable = false; return;
    }
    if (!entry.completed) {
      if (row.rotationOwnerUserIds.some((uid) => !members.get(uid)?.eligibleTypes.includes(row.type))) add("ineligible_owner", index);
      if (row.assignedUserIds.some((uid) => !members.get(uid)?.eligibleTypes.includes(row.type))) add("ineligible_assignee", index);
      if (row.helperUserId !== null && !members.get(row.helperUserId)?.eligibleTypes.includes("delivery")) add("ineligible_helper", index);
    }
    valid.push({entry, index});
  });
  for (const type of types) {
    for (const date of [...input.expectedDates[type]].sort()) {
      if (!dates.has(`${type}:${date}`)) findings.push({code: "missing_date", rowIndex: null, type, date});
    }
  }
  const delivery = valid.filter(({entry}) => entry.row.type === "delivery")
    .sort((a, b) => a.entry.row.date.localeCompare(b.entry.row.date));
  const expectedDelivery = [...input.expectedDates.delivery].sort();
  for (let i = 0; i + 1 < delivery.length; i += 1) {
    const current = delivery[i], next = delivery[i + 1];
    // Missing dates and duplicate rows do not define a trustworthy neighborhood.
    const at = expectedDelivery.indexOf(current.entry.row.date);
    if (at < 0 || expectedDelivery[at + 1] !== next.entry.row.date ||
      dates.get(`delivery:${current.entry.row.date}`) !== 1 ||
      dates.get(`delivery:${next.entry.row.date}`) !== 1) continue;
    if (current.entry.row.assignedUserIds[0] === next.entry.row.assignedUserIds[0]) add("adjacent_equal_leads", current.index);
    if (!current.entry.completed && current.entry.row.helperUserId !== next.entry.row.assignedUserIds[0]) add("helper_discontinuity", current.index);
  }
  let crossStore = "not_evaluated_invalid_source";
  if (comparable) {
    try {
      const observation = await readShiftSheetsImport({config, tabs, members: input.members,
        baseline: input.source.map((entry) => entry.row), readWorkbookVersion: async () => input.workbookVersion,
        sheets: {get: async () => ({data: structuredClone(input.spreadsheet)})}});
      for (const missing of observation.missingIds) add("missing_sheet_row", input.source.findIndex((entry) => entry.row.id === missing));
      for (const assignment of observation.assignments) {
        const index = input.source.findIndex((entry) => entry.row.id === assignment.id), row = input.source[index].row;
        if (!same(row.assignedUserIds, assignment.assignedUserIds) || row.status !== assignment.status) add("cross_store_disagreement", index);
      }
      // The union reader checks selected partitions; every source partition must be selected too.
      for (const {entry, index} of valid) {
        const routed = resolveShiftSheetsTab(config, entry.row.type, entry.row.date);
        if (!tabs.some((tab) => tab.title === routed.title)) add("unmapped_source_partition", index);
      }
      crossStore = "evaluated";
    } catch {
      add("unreadable_sheet_snapshot"); crossStore = "rejected";
    }
  }
  const lineage = input.schemaVersion === 2 ? auditLineage(input, findings) : null;
  const body = {schemaVersion: input.schemaVersion, mode: "audit", scope: "supplied_snapshot", inputDigest: digest(input),
    readyForRepair: false, crossStore, findings, ...(lineage ? {lineage} : {}),
    pendingChecks: [...(lineage ? [] : ["rotation_lineage_and_rounds", "bootstrap_mapping_and_last_helper"]),
      "historical_eligibility_and_boundary_helpers", "trusted_capture_and_live_completeness"],
    status: findings.length ? "findings" : "no_findings_in_checked_scope"};
  return {...body, reportDigest: digest(body)};
};

const main = async (args) => {
  const names = ["--mode", "--input", "--project", "--environment", "--workbook"];
  requireValue(args.length === names.length * 2);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    requireValue(names.includes(args[i]) && !Object.hasOwn(options, args[i]) && args[i + 1]);
    options[args[i]] = args[i + 1];
  }
  requireValue(options["--mode"] === "audit");
  requireValue(statSync(options["--input"]).isFile() && statSync(options["--input"]).size <= MAX_BYTES);
  const report = await auditShiftPlanning(JSON.parse(readFileSync(options["--input"], "utf8")), {
    projectId: options["--project"], environment: options["--environment"], workbookId: options["--workbook"],
  });
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  process.stderr.write(`Snapshot audit: ${report.findings.length} findings; cross-store ${report.crossStore}; repair not authorized.\n`);
  process.exitCode = report.findings.length ? 2 : 0;
};
if (require.main === module) main(process.argv.slice(2)).catch(() => {
  process.stderr.write("Snapshot audit rejected: invalid arguments or evidence.\n"); process.exitCode = 1;
});
module.exports = {auditShiftPlanning, MAX_BYTES};
