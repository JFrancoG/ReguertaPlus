#!/usr/bin/env node
"use strict";

// Offline proposal, not a Sheets batch or an approval of the human-facing layout.
const {readFileSync, statSync} = require("node:fs");
const {auditShiftPlanning, MAX_BYTES} = require("./audit-shift-planning.cjs");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {createShiftSheetsConfig} = require("../lib/shift-sheets-config.js");
const {buildShiftSheetsProjections, SHIFT_SHEETS_HEADERS: headers, SHIFT_SHEETS_LIMITS: limits} = require("../lib/shift-sheets.js");
const check = (value) => { if (!value) throw new Error("sheets_conversion_rejected"); };
const same = (a, b) => digest(a) === digest(b);
const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) &&
  same(Object.keys(value).sort(), [...keys].sort());
const titleKey = (title) => title.normalize("NFKC").toLowerCase();
const validTitle = (title) => typeof title === "string" && title.trim() === title && title.length > 0 && title.length <= 100 &&
  !/[[\]:*?/\\\x00-\x1f]/.test(title);

const planShiftSheetsConversion = async (options) => {
  const {input, target, expectedInputDigest, selection, expectedSelectionDigest} = structuredClone(options);
  check(Buffer.byteLength(JSON.stringify(selection)) <= MAX_BYTES && digest(input) === expectedInputDigest &&
    digest(selection) === expectedSelectionDigest && target.environment === "develop");
  const beforeAudit = await auditShiftPlanning(input, target);
  // Conversion must not choose a winner between Firestore and human edits or
  // fill calendar gaps. Rotation/eligibility findings remain for the repair review.
  check(beforeAudit.crossStore === "evaluated" && !beforeAudit.findings.some(({code}) =>
    ["cross_store_disagreement", "missing_sheet_row", "unmapped_source_partition", "missing_date", "unexpected_date"].includes(code)));
  check(exact(selection, ["schemaVersion", "target", "inputDigest", "strategy", "tabs"]) && selection.schemaVersion === 1 &&
    same(selection.target, target) && selection.inputDigest === expectedInputDigest && selection.strategy === "archive_and_create_canonical" &&
    Array.isArray(selection.tabs));
  const humanTabs = input.tabs.filter((tab) => tab.layout !== "canonical");
  check(humanTabs.length > 0 && selection.tabs.length === humanTabs.length &&
    input.spreadsheet.sheets.length + humanTabs.length <= limits.tabs);
  const titles = new Set(), ids = new Set();
  for (const sheet of input.spreadsheet.sheets) {
    check(validTitle(sheet.properties.title) && !titles.has(titleKey(sheet.properties.title)));
    titles.add(titleKey(sheet.properties.title)); ids.add(sheet.properties.sheetId);
  }
  const selected = new Map();
  for (const tab of selection.tabs) {
    check(exact(tab, ["sourceSheetId", "sourceTitle", "archiveTitle", "canonicalSheetId"]) &&
      humanTabs.some((item) => item.title === tab.sourceTitle) && !selected.has(tab.sourceTitle));
    const source = input.spreadsheet.sheets.find((sheet) => sheet.properties.sheetId === tab.sourceSheetId);
    check(source?.properties.title === tab.sourceTitle && validTitle(tab.archiveTitle) && !titles.has(titleKey(tab.archiveTitle)) &&
      Number.isSafeInteger(tab.canonicalSheetId) && tab.canonicalSheetId >= 0 && tab.canonicalSheetId <= 2147483647 && !ids.has(tab.canonicalSheetId));
    titles.add(titleKey(tab.archiveTitle)); ids.add(tab.canonicalSheetId); selected.set(tab.sourceTitle, tab);
  }
  const config = createShiftSheetsConfig({environment: target.environment, workbooks: {[target.environment]: target.workbookId}, aliases: input.aliases});
  const projections = buildShiftSheetsProjections(config, input.source.map((entry) => entry.row));
  const canonicalInput = structuredClone(input), changes = [];
  for (const tab of humanTabs) {
    const selection = selected.get(tab.title);
    const archive = canonicalInput.spreadsheet.sheets.find((sheet) => sheet.properties.sheetId === selection.sourceSheetId);
    const originalDigest = digest(archive);
    archive.properties.title = selection.archiveTitle;
    const rows = projections.filter((row) => row.title === tab.title).sort((a, b) => a.id.localeCompare(b.id));
    check(rows.length > 0);
    const canonical = {properties: {sheetId: selection.canonicalSheetId, title: tab.title, sheetType: "GRID",
      gridProperties: {rowCount: rows.length + 1, columnCount: headers.length, frozenRowCount: 1}},
    data: [{rowData: [headers, ...rows.map((row) => row.values)].map((values) =>
      ({values: values.map((stringValue) => ({userEnteredValue: {stringValue}}))}))}]};
    canonicalInput.spreadsheet.sheets.push(canonical);
    changes.push({...selection, originalDigest, archiveDigest: digest(archive), canonicalDigest: digest(canonical),
      shiftIds: rows.map((row) => row.id)});
  }
  canonicalInput.tabs = input.tabs.map((tab) => ({...tab, layout: "canonical", decorations: []}));
  const afterAudit = await auditShiftPlanning(canonicalInput, target);
  check(afterAudit.crossStore === "evaluated" && same(beforeAudit.findings, afterAudit.findings));
  const body = {schemaVersion: 1, mode: "dry-run", scope: "supplied_snapshot_layout_proposal", target,
    inputDigest: expectedInputDigest, selectionDigest: expectedSelectionDigest, workbookVersion: input.workbookVersion,
    originalSpreadsheetDigest: digest(input.spreadsheet), canonicalSpreadsheetDigest: digest(canonicalInput.spreadsheet),
    canonicalInputDigest: digest(canonicalInput), changes, canonicalInput,
    inverse: {scope: "offline_image_only", expectedCanonicalInputDigest: digest(canonicalInput), originalInput: input},
    audit: {before: beforeAudit, after: afterAudit}, readyForApply: false,
    pendingGates: ["visual_layout_approval", "trusted_full_workbook_capture", "formula_reference_and_protection_review",
      "exclusive_writer_fence_and_live_revision_guards", "restored_clone_forward_inverse_rehearsal", "explicit_live_apply_authorization"]};
  return {...body, planDigest: digest(body)};
};

const main = async (args) => {
  const names = ["--mode", "--input", "--selection", "--expected-input-digest", "--expected-selection-digest", "--project", "--environment", "--workbook"];
  check(args.length === names.length * 2); const values = {};
  for (let i = 0; i < args.length; i += 2) {
    check(names.includes(args[i]) && !Object.hasOwn(values, args[i]) && args[i + 1]); values[args[i]] = args[i + 1];
  }
  check(values["--mode"] === "dry-run");
  const read = (path) => { check(statSync(path).size <= MAX_BYTES); return JSON.parse(readFileSync(path, "utf8")); };
  const result = await planShiftSheetsConversion({input: read(values["--input"]), selection: read(values["--selection"]),
    expectedInputDigest: values["--expected-input-digest"], expectedSelectionDigest: values["--expected-selection-digest"],
    target: {projectId: values["--project"], environment: values["--environment"], workbookId: values["--workbook"]}});
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.stderr.write(`Conversion proposal: ${result.changes.length} archived/created pairs; apply unavailable.\n`);
};
if (require.main === module) main(process.argv.slice(2)).catch(() => {
  process.stderr.write("Conversion proposal rejected: invalid arguments or evidence.\n"); process.exitCode = 1;
});
module.exports = {planShiftSheetsConversion};
