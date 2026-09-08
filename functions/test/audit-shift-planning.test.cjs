"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync} = require("node:fs");
const {tmpdir} = require("node:os");
const {join} = require("node:path");
const {spawnSync} = require("node:child_process");
const {auditShiftPlanning, MAX_BYTES} = require("../scripts/audit-shift-planning.cjs");
const {createShiftSheetsConfig, resolveShiftSheetsTab} = require("../lib/shift-sheets-config.js");
const {createShiftSheetsAdapter} = require("../lib/shift-sheets.js");
const {sheetsService, clone, setCell} = require("./shift-sheets-api-fixture.cjs");
const target = {projectId: "demo-reguerta-audit", environment: "develop", workbookId: "audit-book"};
const fixture = async () => {
  const config = createShiftSheetsConfig({environment: "develop", workbooks: {develop: target.workbookId}});
  const row = (date, owner, helper) => ({id: `shift_delivery_${date.replaceAll("-", "")}`, type: "delivery", date,
    rotationOwnerUserIds: [owner], assignedUserIds: [owner], helperUserId: helper, status: "planned", source: "app", origin: "planner"});
  const rows = [row("2026-08-27", "a", "b"), row("2026-09-03", "b", "c"), row("2026-09-10", "c", null),
    {...row("2026-09-20", "a", null), id: "shift_market_20260920", type: "market", rotationOwnerUserIds: ["a", "b", "c"], assignedUserIds: ["a", "b", "c"]}];
  const service = sheetsService(target.workbookId);
  await createShiftSheetsAdapter({config, sheets: service}).reconcile({operationId: "fixture", rows, authorizeMutation: async () => {}});
  return {schemaVersion: 1, target: clone(target), capturedAt: "2026-09-08T12:00:00.000Z", aliases: [],
    tabs: [...new Map(rows.map((row) => { const tab = resolveShiftSheetsTab(config, row.type, row.date); return [tab.title, {...tab, layout: "canonical", decorations: []}]; })).values()],
    workbookVersion: "17", spreadsheet: clone(service.state), expectedDates: {delivery: rows.slice(0, 3).map((row) => row.date), market: [rows[3].date]},
    source: rows.map((row) => ({row, documentRevision: 2, assignmentRevision: 1, completionRevision: 0, completed: false})),
    members: ["a", "b", "c", "d"].map((userId) => ({userId, names: [`Persona ${userId}`], phones: ["90000000" + userId], eligibleTypes: ["delivery", "market"]}))};
};
const codes = (report) => report.findings.map((item) => item.code);
const edit = (input, id, column, value) => {
  for (const sheet of input.spreadsheet.sheets) {
    const index = sheet.data[0].rowData.findIndex((row) => row.values[0]?.userEnteredValue?.stringValue === id);
    if (index >= 0) { setCell(sheet, index, column, {userEnteredValue: {stringValue: value}}); return; }
  }
  assert.fail("Missing fixture row");
};

test("consistent snapshot is deterministic, read-only and explicitly incomplete as repair evidence", async () => {
  const input = await fixture(), before = clone(input), report = await auditShiftPlanning(input, target);
  assert.deepEqual(report.findings, []); assert.equal(report.crossStore, "evaluated");
  assert.equal(report.status, "no_findings_in_checked_scope"); assert.equal(report.readyForRepair, false);
  assert.ok(report.pendingChecks.includes("rotation_lineage_and_rounds"));
  assert.deepEqual(await auditShiftPlanning(input, target), report); assert.deepEqual(input, before);
  input.source[0].documentRevision += 1;
  assert.notEqual((await auditShiftPlanning(input, target)).inputDigest, report.inputDigest);
  assert.doesNotMatch(JSON.stringify(report), /Persona|90000000/);
});

test("detects gaps and extra dates against explicit horizon, never an inferred weekly cadence", async () => {
  const input = await fixture(); input.expectedDates.delivery.push("2026-09-17");
  input.expectedDates.market = ["2026-09-27"];
  const report = await auditShiftPlanning(input, target);
  assert.deepEqual(report.findings.filter((item) => item.code === "missing_date").map((item) => item.date), ["2026-09-17", "2026-09-27"]);
  assert.ok(codes(report).includes("unexpected_date"));
});

test("duplicate identity/date, invalid ID, source and market cardinality remain findings", async () => {
  const input = await fixture(); input.source.push(clone(input.source[0]));
  let report = await auditShiftPlanning(input, target);
  assert.ok(codes(report).includes("duplicate_id")); assert.ok(codes(report).includes("duplicate_date"));
  assert.equal(report.crossStore, "not_evaluated_invalid_source");
  const invalid = await fixture(); invalid.source[0].row.source = "planner";
  invalid.source[1].row.id = "wrong-id"; invalid.source[3].row.assignedUserIds.pop();
  report = await auditShiftPlanning(invalid, target);
  for (const code of ["invalid_source", "invalid_stable_id", "invalid_projection"]) assert.ok(codes(report).includes(code));
  assert.ok(!codes(report).includes("missing_date"), "Invalid existing rows are not missing dates");
});

test("checks active eligibility without treating historic completed assignments as current roster violations", async () => {
  const input = await fixture(); input.members.find((member) => member.userId === "a").eligibleTypes = [];
  let report = await auditShiftPlanning(input, target);
  assert.ok(report.findings.some((item) => item.code === "ineligible_owner" && item.rowIndex === 0));
  assert.ok(report.findings.some((item) => item.code === "ineligible_assignee" && item.rowIndex === 0));
  input.source[0].completed = true;
  report = await auditShiftPlanning(input, target);
  assert.ok(!report.findings.some((item) => item.rowIndex === 0 && item.code.startsWith("ineligible_")));
});

test("checks cross-season helpers but freezes completed actual helpers", async () => {
  const input = await fixture(); input.source[0].row.helperUserId = "d";
  let report = await auditShiftPlanning(input, target);
  assert.ok(report.findings.some((item) => item.code === "helper_discontinuity" && item.rowIndex === 0));
  input.source[0].completed = true;
  report = await auditShiftPlanning(input, target);
  assert.ok(!codes(report).includes("helper_discontinuity"));
  input.source[1].row.assignedUserIds = ["a"];
  assert.ok(codes(await auditShiftPlanning(input, target)).includes("adjacent_equal_leads"));
});

test("does not connect helper neighborhoods across missing expected dates", async () => {
  const input = await fixture(); input.expectedDates.delivery.splice(1, 0, "2026-08-30");
  input.source[0].row.helperUserId = "d";
  const report = await auditShiftPlanning(input, target);
  assert.ok(codes(report).includes("missing_date")); assert.ok(!codes(report).includes("helper_discontinuity"));
  const duplicated = await fixture(); duplicated.source[0].row.helperUserId = "d";
  const invalidDuplicate = clone(duplicated.source[0]); invalidDuplicate.row.source = "planner";
  duplicated.source.push(invalidDuplicate);
  const duplicateReport = await auditShiftPlanning(duplicated, target);
  assert.ok(codes(duplicateReport).includes("duplicate_date"));
  assert.ok(!codes(duplicateReport).includes("helper_discontinuity"));
});

test("manual Sheet edit is a cross-store finding without changing source or planning a repair", async () => {
  const input = await fixture(); edit(input, input.source[1].row.id, 5, '["d"]');
  const before = clone(input), report = await auditShiftPlanning(input, target);
  assert.deepEqual(report.findings, [{code: "cross_store_disagreement", rowIndex: 1}]);
  assert.deepEqual(input, before); assert.equal(report.readyForRepair, false);
});

test("missing Sheet row is diagnosed and missing tab is not a successful partial audit", async () => {
  const input = await fixture(); const sheet = input.spreadsheet.sheets.find((sheet) => sheet.properties.title === input.tabs[0].title);
  sheet.data[0].rowData.splice(1, 1);
  assert.ok(codes(await auditShiftPlanning(input, target)).includes("missing_sheet_row"));
  input.spreadsheet.sheets.pop(); const report = await auditShiftPlanning(input, target);
  assert.equal(report.crossStore, "rejected"); assert.ok(codes(report).includes("unreadable_sheet_snapshot"));
});

test("formula and forged authority cells reject cross-store interpretation without echoing cell text", async () => {
  for (const column of [4, 8, 10]) {
    const input = await fixture(); edit(input, input.source[1].row.id, column, "private-cell-value");
    const report = await auditShiftPlanning(input, target);
    assert.equal(report.crossStore, "rejected"); assert.doesNotMatch(JSON.stringify(report), /private-cell-value/);
  }
});

test("formula cells reject the snapshot even when their displayed value could match", async () => {
  const input = await fixture();
  const sheet = input.spreadsheet.sheets[0];
  setCell(sheet, 1, 5, {userEnteredValue: {formulaValue: '=PRIVATE("person")'}});
  const report = await auditShiftPlanning(input, target);
  assert.equal(report.crossStore, "rejected"); assert.doesNotMatch(JSON.stringify(report), /PRIVATE|person/);
});

test("reviewed human mapping resolves assignments but never derives owners from displayed names", async () => {
  const input = await fixture(); const tab = input.tabs[0]; tab.layout = "delivery_human";
  const sheet = input.spreadsheet.sheets.find((sheet) => sheet.properties.title === tab.title);
  sheet.data = [{rowData: [{values: ["27/08/2026", "Persona a", "90000000a"].map((stringValue) => ({userEnteredValue: {stringValue}}))}]}];
  const report = await auditShiftPlanning(input, target);
  assert.equal(report.crossStore, "evaluated"); assert.deepEqual(report.findings, []);
  assert.ok(report.pendingChecks.includes("rotation_lineage_and_rounds"));
  input.members[1].names.push("Persona a");
  assert.equal((await auditShiftPlanning(input, target)).crossStore, "rejected");
});

test("an unselected source season cannot silently disappear from cross-store coverage", async () => {
  const input = await fixture(); input.expectedDates.delivery.shift();
  input.tabs = input.tabs.filter((tab) => tab.seasonStartYear !== 2025);
  const report = await auditShiftPlanning(input, target);
  assert.ok(codes(report).includes("unexpected_date")); assert.ok(codes(report).includes("unmapped_source_partition"));
});

test("wrong target, malformed mapping, oversized/sparse/overlapping grids reject before reading", async () => {
  const input = await fixture();
  for (const changed of [{...target, projectId: "other-project"}, {...target, environment: "production"}, {...target, workbookId: "other-book"}]) {
    await assert.rejects(auditShiftPlanning(input, changed));
  }
  for (const mutate of [
    (f) => { f.tabs[0].layout = "unknown"; },
    (f) => { f.members.push(clone(f.members[0])); },
    (f) => { f.source[0].completed = "false"; },
    (f) => { f.spreadsheet.sheets[0].data[0].startRow = 1000000000; },
    (f) => { f.spreadsheet.sheets[0].data.push(clone(f.spreadsheet.sheets[0].data[0])); },
    (f) => { f.spreadsheet.sheets[0].data = null; },
    (f) => { f.capturedAt = "invalid"; },
    (f) => { f.extra = "x".repeat(MAX_BYTES); },
  ]) { const invalid = clone(input); mutate(invalid); await assert.rejects(auditShiftPlanning(invalid, target)); }
});

test("CLI writes only reports and rejects apply, wrong target and malformed input", async () => {
  const directory = mkdtempSync(join(tmpdir(), "shift-audit-")), path = join(directory, "input.json");
  try {
    const input = await fixture(), serialized = JSON.stringify(input); writeFileSync(path, serialized);
    const args = [require.resolve("../scripts/audit-shift-planning.cjs"), "--mode", "audit", "--input", path,
      "--project", target.projectId, "--environment", target.environment, "--workbook", target.workbookId];
    const run = (values = args) => spawnSync(process.execPath, values, {encoding: "utf8", env: {PATH: process.env.PATH}});
    let result = run(); assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).readyForRepair, false); assert.match(result.stderr, /0 findings/);
    assert.equal(readFileSync(path, "utf8"), serialized); assert.deepEqual(readdirSync(directory), ["input.json"]);
    const apply = [...args]; apply[2] = "apply"; result = run(apply); assert.equal(result.status, 1); assert.equal(result.stdout, "");
    result = run([...args, "--apply", "yes"]); assert.equal(result.status, 1);
    const wrong = [...args]; wrong[6] = "wrong-project"; assert.equal(run(wrong).status, 1);
    input.source[0].row.source = "planner"; writeFileSync(path, JSON.stringify(input));
    result = run(); assert.equal(result.status, 2); assert.ok(codes(JSON.parse(result.stdout)).includes("invalid_source"));
    writeFileSync(path, "private malformed payload"); result = run();
    assert.equal(result.status, 1); assert.doesNotMatch(result.stderr, /private malformed payload/);
  } finally { rmSync(directory, {recursive: true, force: true}); }
});
