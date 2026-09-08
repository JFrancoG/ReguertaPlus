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
    writeFileSync(path, JSON.stringify(await lineageFixture())); result = run();
    assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).schemaVersion, 2);
    assert.equal(JSON.parse(result.stdout).lineage.market.status, "consistent");
    input.source[0].row.source = "planner"; writeFileSync(path, JSON.stringify(input));
    result = run(); assert.equal(result.status, 2); assert.ok(codes(JSON.parse(result.stdout)).includes("invalid_source"));
    writeFileSync(path, "private malformed payload"); result = run();
    assert.equal(result.status, 1); assert.doesNotMatch(result.stderr, /private malformed payload/);
  } finally { rmSync(directory, {recursive: true, force: true}); }
});

const rotation = (type, roundNumber = 1, nextMemberIndex = 0) => ({schemaVersion: 1, type,
  cohortUserIds: ["a", "b", "c", "d"], roundNumber, nextMemberIndex});
const bootstrap = (type) => ({type, eligibleUserIds: ["a", "b", "c", "d"], isTrulyNewRotation: false,
  versionedState: {revision: "captured-before-horizon", digest: "captured-state-ref", provenance: "fixture-state", rotation: rotation(type)},
  ownerHistory: null, approvedMapping: null, legacyDeliveryHelper: null});
const lineageFixture = async () => {
  const input = await fixture(); input.schemaVersion = 2;
  input.lineage = {
    delivery: {beforeDate: "2026-08-27", bootstrap: bootstrap("delivery"), rotationAfterHorizon: rotation("delivery", 1, 3),
      rows: input.source.slice(0, 3).map(({row}, index) => ({shiftId: row.id, positions: [{roundNumber: 1, positionInRound: index + 1}]}))},
    market: {beforeDate: "2026-09-20", bootstrap: bootstrap("market"), rotationAfterHorizon: rotation("market", 1, 3),
      rows: [{shiftId: input.source[3].row.id, positions: [1, 2, 3].map((positionInRound) => ({roundNumber: 1, positionInRound}))}]},
  };
  return input;
};
const approvedMapping = (type, roundNumber = 1, nextMemberIndex = 0) => ({approvalStatus: "approved", type,
  orderedUserIds: ["a", "b", "c", "d"], roundNumber, nextMemberIndex, stableTieOrder: ["a", "b", "c", "d"],
  revision: "review-r1", digest: "review-d1", provenance: "review-fixture", evidence: "reviewed mapping fixture"});
const legacyHelper = (userId) => ({kind: "unique", userId, evidenceRevision: "helper-r1", evidenceDigest: "helper-d1"});
const ownerHistory = (type) => ({revision: "history-r1", digest: "history-d1", provenance: "captured-owner-history",
  entries: [1, 2, 3, 4].map((positionInRound, index) => ({type, chronologySequence: index,
    roundNumber: 1, positionInRound, rotationOwnerUserId: ["a", "b", "c", "d"][index],
    cohortUserIds: ["a", "b", "c", "d"], evidence: `owner-position-${index}`}))});

test("v2 binds both lineage streams to source owners, round positions and final cursors", async () => {
  const input = await lineageFixture(), before = clone(input), report = await auditShiftPlanning(input, target);
  assert.deepEqual(report.findings, []); assert.equal(report.schemaVersion, 2);
  assert.equal(report.lineage.delivery.status, "consistent"); assert.equal(report.lineage.market.status, "consistent");
  assert.equal(report.lineage.market.expectedPositionCount, 3); assert.equal(report.readyForRepair, false);
  assert.ok(!report.pendingChecks.includes("rotation_lineage_and_rounds"));
  assert.deepEqual(input, before); assert.deepEqual(await auditShiftPlanning(input, target), report);
  input.lineage.delivery.bootstrap.versionedState.revision = "new-observation";
  assert.notEqual((await auditShiftPlanning(input, target)).reportDigest, report.reportDigest);
});

test("v1 remains scoped and rejects silently adding v2 evidence to its schema", async () => {
  const input = await fixture(), report = await auditShiftPlanning(input, target);
  assert.equal(report.schemaVersion, 1); assert.equal(report.lineage, undefined);
  assert.ok(report.pendingChecks.includes("rotation_lineage_and_rounds"));
  input.lineage = {}; await assert.rejects(auditShiftPlanning(input, target));
});

test("consumes delivery across seasons and three market positions across a round boundary", async () => {
  const input = await lineageFixture();
  for (const type of ["delivery", "market"]) {
    input.lineage[type].bootstrap.versionedState.rotation = rotation(type, 7, 3);
    input.lineage[type].rotationAfterHorizon = rotation(type, 8, 2);
  }
  input.source.slice(0, 3).forEach(({row}, index) => { row.rotationOwnerUserIds = [["d"], ["a"], ["b"]][index]; });
  input.lineage.delivery.rows.forEach((row, index) => { row.positions = [[{roundNumber: 7, positionInRound: 4}],
    [{roundNumber: 8, positionInRound: 1}], [{roundNumber: 8, positionInRound: 2}]][index]; });
  input.source[3].row.rotationOwnerUserIds = ["d", "a", "b"];
  input.lineage.market.rows[0].positions = [{roundNumber: 7, positionInRound: 4}, {roundNumber: 8, positionInRound: 1}, {roundNumber: 8, positionInRound: 2}];
  const report = await auditShiftPlanning(input, target);
  assert.equal(report.lineage.delivery.status, "consistent"); assert.equal(report.lineage.market.status, "consistent");
  // Effective assignments remain a/b/c: they are deliberately different from owners.
  assert.ok(!codes(report).includes("rotation_owner_sequence_mismatch"));
});

test("repeated/skipped owners, forged rounds and final cursor drift are independently diagnosed", async () => {
  const input = await lineageFixture(); input.source[1].row.rotationOwnerUserIds = ["a"];
  input.source[3].row.rotationOwnerUserIds = ["a", "c", "d"];
  input.lineage.delivery.rows[2].positions[0].roundNumber = 2;
  input.lineage.market.rotationAfterHorizon.nextMemberIndex = 0;
  const report = await auditShiftPlanning(input, target);
  assert.equal(report.findings.filter((item) => item.code === "rotation_owner_sequence_mismatch").length, 2);
  assert.ok(codes(report).includes("rotation_position_mismatch")); assert.ok(codes(report).includes("rotation_cursor_mismatch"));
});

test("assignment-only swaps do not change lineage evidence or owner sequence", async () => {
  const input = await lineageFixture(); input.source[1].row.assignedUserIds = ["d"]; input.source[0].row.helperUserId = "d";
  const report = await auditShiftPlanning(input, target);
  assert.equal(report.lineage.delivery.status, "consistent");
  assert.ok(!codes(report).includes("rotation_owner_sequence_mismatch"));
});

test("missing evidence, duplicate positions and truncated source never pass lineage", async () => {
  let input = await lineageFixture(); input.lineage.delivery = null;
  assert.ok(codes(await auditShiftPlanning(input, target)).includes("missing_lineage_evidence"));
  input = await lineageFixture(); input.lineage.delivery.rows.pop();
  input.lineage.market.rows.push(clone(input.lineage.market.rows[0])); input.source.splice(1, 1);
  const report = await auditShiftPlanning(input, target);
  for (const code of ["missing_lineage_source", "missing_position_evidence", "duplicate_position_evidence"]) assert.ok(codes(report).includes(code));
});

test("corrupt authoritative state never falls back to a valid mapping", async () => {
  const input = await lineageFixture(); const b = input.lineage.market.bootstrap;
  b.versionedState.rotation.nextMemberIndex = 9; b.approvedMapping = approvedMapping("market");
  const report = await auditShiftPlanning(input, target);
  assert.equal(report.lineage.market.status, "rejected"); assert.ok(codes(report).includes("invalid_rotation_bootstrap"));
});

test("valid state keeps precedence while contradictory lower-priority evidence is surfaced", async () => {
  const input = await lineageFixture(); const b = input.lineage.market.bootstrap;
  b.approvedMapping = approvedMapping("market", 4, 1);
  let report = await auditShiftPlanning(input, target);
  assert.equal(report.lineage.market.selectedSource, "versionedState"); assert.ok(codes(report).includes("conflicting_bootstrap_source"));
  b.approvedMapping.stableTieOrder.reverse(); report = await auditShiftPlanning(input, target);
  assert.ok(codes(report).includes("invalid_bootstrap_alternative"));
});

test("history is validated in chronology order and binds the cursor before the audited window", async () => {
  const input = await lineageFixture();
  for (const type of ["delivery", "market"]) {
    const evidence = input.lineage[type], b = evidence.bootstrap;
    b.versionedState = null; b.ownerHistory = ownerHistory(type); b.ownerHistory.entries.reverse();
    if (type === "delivery") b.legacyDeliveryHelper = legacyHelper("a");
    evidence.rows.forEach((row) => row.positions.forEach((position) => { position.roundNumber = 2; }));
    evidence.rotationAfterHorizon.roundNumber = 2;
  }
  let report = await auditShiftPlanning(input, target);
  assert.equal(report.lineage.delivery.status, "consistent"); assert.equal(report.lineage.market.selectedSource, "ownerHistory");
  input.lineage.market.bootstrap.ownerHistory.entries.pop();
  report = await auditShiftPlanning(input, target);
  assert.equal(report.lineage.market.status, "consistent");
  // A suffix is valid history; remove an internal chronology position to prove the gap.
  input.lineage.market.bootstrap.ownerHistory.entries.splice(1, 1);
  assert.ok(codes(await auditShiftPlanning(input, target)).includes("invalid_rotation_bootstrap"));
});

test("approved mappings enforce tie order and the inherited delivery helper gate", async () => {
  const input = await lineageFixture(); const b = input.lineage.delivery.bootstrap;
  b.versionedState = null; b.approvedMapping = approvedMapping("delivery"); b.legacyDeliveryHelper = legacyHelper("a");
  let report = await auditShiftPlanning(input, target); assert.equal(report.lineage.delivery.status, "consistent");
  for (const helper of [null, legacyHelper("b"), {kind: "ambiguous", candidateUserIds: ["a", "b"], evidenceDigest: "ambiguous"}]) {
    b.legacyDeliveryHelper = helper;
    assert.ok(codes(await auditShiftPlanning(input, target)).includes("invalid_rotation_bootstrap"));
  }
  b.legacyDeliveryHelper = legacyHelper("a"); b.approvedMapping.stableTieOrder.reverse();
  assert.ok(codes(await auditShiftPlanning(input, target)).includes("invalid_rotation_bootstrap"));
});

test("boundary/type/roster mismatch and malformed lineage contracts are rejected", async () => {
  for (const [mutate, expected] of [
    [(input) => { input.lineage.delivery.beforeDate = "2026-09-03"; }, "lineage_boundary_mismatch"],
    [(input) => { input.lineage.delivery.bootstrap.type = "market"; }, "lineage_boundary_mismatch"],
    [(input) => { input.lineage.delivery.bootstrap.eligibleUserIds.pop(); }, "bootstrap_roster_mismatch"],
    [(input) => { input.lineage.market.rows[0].positions[0].extra = true; }, "invalid_lineage_evidence"],
    [(input) => { input.lineage.market.bootstrap.versionedState = null; }, "invalid_rotation_bootstrap"],
    [(input) => { input.lineage.market.rows[0].shiftId = "unrelated-shift"; }, "unexpected_position_evidence"],
    [(input) => { input.lineage.delivery.bootstrap.legacyDeliveryHelper = {...legacyHelper("a"), kind: "guess"}; }, "invalid_lineage_evidence"],
    [(input) => { input.lineage.market.bootstrap.ownerHistory = {...ownerHistory("market"), entries: Array(1501).fill(ownerHistory("market").entries[0])}; }, "invalid_lineage_evidence"],
  ]) { const input = await lineageFixture(); mutate(input); assert.ok(codes(await auditShiftPlanning(input, target)).includes(expected), expected); }
});


test("ten market dates consume thirty owner positions with exact round and cursor continuity", async () => {
  const input = await lineageFixture(), source = clone(input.source[3]);
  const dates = ["2026-09-20", "2026-10-20", "2026-11-20", "2026-12-20", "2027-01-20", "2027-02-20", "2027-03-20", "2027-04-20", "2027-05-20", "2027-06-20"];
  const groups = [["a", "b", "c"], ["d", "a", "b"], ["c", "d", "a"], ["b", "c", "d"]];
  input.expectedDates.market = dates;
  input.source = input.source.slice(0, 3).concat(dates.map((date, index) => ({...clone(source), row: {...clone(source.row),
    id: `shift_market_${date.replaceAll("-", "")}`, date, rotationOwnerUserIds: groups[index % 4], assignedUserIds: groups[index % 4]}})));
  input.lineage.market.rows = input.source.slice(3).map(({row}, index) => ({shiftId: row.id,
    positions: [0, 1, 2].map((offset) => ({roundNumber: Math.floor((index * 3 + offset) / 4) + 1, positionInRound: (index * 3 + offset) % 4 + 1}))}));
  input.lineage.market.rotationAfterHorizon = rotation("market", 8, 2);
  const report = await auditShiftPlanning(input, target);
  assert.equal(report.lineage.market.status, "consistent"); assert.equal(report.lineage.market.expectedPositionCount, 30);
  input.source[12].row.rotationOwnerUserIds = ["a", "b", "c"];
  assert.ok(codes(await auditShiftPlanning(input, target)).includes("rotation_owner_sequence_mismatch"));
});

test("truly new rotation requires an approved mapping at round one and cursor zero", async () => {
  const input = await lineageFixture(), b = input.lineage.market.bootstrap;
  b.versionedState = null; b.isTrulyNewRotation = true; b.approvedMapping = approvedMapping("market");
  assert.equal((await auditShiftPlanning(input, target)).lineage.market.status, "consistent");
  b.approvedMapping.nextMemberIndex = 1;
  assert.ok(codes(await auditShiftPlanning(input, target)).includes("invalid_rotation_bootstrap"));
});

const {planShiftRepair} = require("../scripts/repair-planned-shifts.cjs");
const {createShiftPlanningDigest: snapshotDigest} = require("../lib/shift-planning-digest.js");
const {buildShiftSheetsProjections} = require("../lib/shift-sheets.js");
const repair = async (input, proposal, overrides = {}) => {
  const original = clone(input), desired = clone(proposal);
  return planShiftRepair({input: original, proposal: desired, target,
    expectedInputDigest: snapshotDigest(original), expectedProposalDigest: snapshotDigest(desired), ...overrides});
};
const syncProposalCells = (proposal) => {
  const config = createShiftSheetsConfig({environment: target.environment, workbooks: {develop: target.workbookId}, aliases: proposal.aliases});
  for (const projected of buildShiftSheetsProjections(config, proposal.source.map((entry) => entry.row))) {
    const sheet = proposal.spreadsheet.sheets.find((sheet) => sheet.properties.title === projected.title);
    let row = sheet.data[0].rowData.findIndex((entry) => entry.values[0]?.userEnteredValue?.stringValue === projected.id);
    if (row < 0) row = sheet.data[0].rowData.length;
    projected.values.forEach((stringValue, column) => setCell(sheet, row, column, {userEnteredValue: {stringValue}}));
  }
};

test("repair dry-run produces exact source/cell before-after and stable digests without mutation", async () => {
  const proposal = await lineageFixture(), input = clone(proposal);
  input.source[0].row.source = "planner"; edit(input, input.source[0].row.id, 8, "planner");
  const original = clone(input), desired = clone(proposal), plan = await planShiftRepair({input, proposal, target,
    expectedInputDigest: snapshotDigest(input), expectedProposalDigest: snapshotDigest(proposal)});
  assert.deepEqual(plan.projectionChanges, [{id: input.source[0].row.id, before: input.source[0], after: proposal.source[0]}]);
  assert.equal(plan.sheetsChanges.length, 1); assert.equal(plan.sheetsChanges[0].columnNumber, 9);
  assert.deepEqual(plan.sheetsChanges[0].before, {stringValue: "planner"}); assert.deepEqual(plan.sheetsChanges[0].after, {stringValue: "app"});
  assert.deepEqual(plan.lineageChanges, []); assert.equal(plan.readyForApply, false);
  assert.deepEqual(await repair(input, proposal), plan); assert.deepEqual(input, original); assert.deepEqual(proposal, desired);
  const rerun = await repair(proposal, proposal);
  assert.deepEqual([rerun.projectionChanges, rerun.lineageChanges, rerun.sheetsChanges], [[], [], []]);
  assert.notEqual(rerun.planDigest, plan.planDigest);
});

test("repair binds explicit owner/round/cursor corrections without rewriting bootstrap", async () => {
  const proposal = await lineageFixture(), input = clone(proposal);
  input.source[1].row.rotationOwnerUserIds = ["a"];
  input.lineage.delivery.rows[1].positions[0].roundNumber = 8;
  input.lineage.delivery.rotationAfterHorizon.nextMemberIndex = 1;
  const plan = await repair(input, proposal);
  assert.equal(plan.projectionChanges.length, 1); assert.equal(plan.lineageChanges.length, 1);
  assert.deepEqual(plan.lineageChanges[0].before.rotationAfterHorizon, input.lineage.delivery.rotationAfterHorizon);
  assert.deepEqual(plan.lineageChanges[0].after.rotationAfterHorizon, proposal.lineage.delivery.rotationAfterHorizon);
});

test("repair allows a guarded interior lead/helper correction and rejects edge changes", async () => {
  const input = await lineageFixture(), proposal = clone(input);
  proposal.source[1].row.assignedUserIds = ["d"]; proposal.source[0].row.helperUserId = "d"; syncProposalCells(proposal);
  const plan = await repair(input, proposal); assert.equal(plan.projectionChanges.length, 2);
  assert.equal(plan.projectionChanges[0].before.documentRevision, 2);
  const edge = clone(input); edge.source[0].row.assignedUserIds = ["d"]; syncProposalCells(edge);
  await assert.rejects(repair(input, edge));
  const helper = clone(input); helper.source[2].row.helperUserId = "d"; syncProposalCells(helper);
  await assert.rejects(repair(input, helper));
});

test("missing row can be proposed as a create with zero revisions and exact cells", async () => {
  const proposal = await lineageFixture(), input = clone(proposal);
  input.source.splice(1, 1); input.lineage.delivery.rows.splice(1, 1);
  const sheet = input.spreadsheet.sheets.find((sheet) => sheet.properties.title === input.tabs[1].title);
  // Blank the missing row without moving its successor.
  sheet.data[0].rowData[1].values = [];
  Object.assign(proposal.source[1], {documentRevision: 0, assignmentRevision: 0, completionRevision: 0});
  const plan = await repair(input, proposal);
  assert.equal(plan.projectionChanges.length, 1); assert.equal(plan.projectionChanges[0].before, null);
  assert.equal(plan.sheetsChanges.length, 11);
  proposal.source[1].documentRevision = 2; await assert.rejects(repair(input, proposal));
});

test("repair rejects digest drift, wrong target, proposal findings and authority substitutions", async () => {
  const input = await lineageFixture(), proposal = clone(input);
  for (const overrides of [{expectedInputDigest: "wrong"}, {expectedProposalDigest: "wrong"}, {target: {...target, environment: "production"}}]) {
    await assert.rejects(repair(input, proposal, overrides));
  }
  for (const mutate of [
    (p) => { p.source[0].row.source = "planner"; },
    (p) => { p.workbookVersion = "18"; },
    (p) => { p.capturedAt = "2026-09-09T12:00:00.000Z"; },
    (p) => { p.lineage.delivery.bootstrap.versionedState.revision = "replacement"; },
    (p) => { p.members[0].phones = ["replacement"]; },
    (p) => { p.source[0].documentRevision += 1; },
  ]) { const changed = clone(proposal); mutate(changed); await assert.rejects(repair(input, changed)); }
  input.lineage.market.bootstrap.approvedMapping = approvedMapping("market", 9, 0);
  await assert.rejects(repair(input, proposal));
});

test("repair freezes completed rows/positions and never deletes or chooses duplicate identities", async () => {
  let input = await lineageFixture(); input.source[0].completed = true; input.source[0].completionRevision = 1;
  let proposal = clone(input); proposal.source[0].row.helperUserId = "d"; syncProposalCells(proposal);
  await assert.rejects(repair(input, proposal));
  proposal = clone(input); input.lineage.delivery.rows[0].positions[0].roundNumber = 8;
  await assert.rejects(repair(input, proposal));
  input = await lineageFixture(); proposal = clone(input); proposal.source.shift();
  await assert.rejects(repair(input, proposal));
  proposal = clone(input); input.source.push(clone(input.source[0])); await assert.rejects(repair(input, proposal));
});

test("repair refuses manual-column, header, format, protection, merge and metadata edits", async () => {
  for (const mutate of [
    (p) => setCell(p.spreadsheet.sheets[0], 1, 12, {userEnteredValue: {stringValue: "manual note"}}),
    (p) => setCell(p.spreadsheet.sheets[0], 0, 12, {userEnteredValue: {stringValue: "header"}}),
    (p) => { p.spreadsheet.sheets[0].properties.title += " changed"; },
    (p) => { p.spreadsheet.sheets[0].developerMetadata = []; },
    (p) => setCell(p.spreadsheet.sheets[0], 1, 8, {note: "format changed"}),
  ]) {
    const input = await lineageFixture(), proposal = clone(input); mutate(proposal); await assert.rejects(repair(input, proposal));
  }
  for (const field of ["protectedRanges", "merges"]) {
    const proposal = await lineageFixture(), input = clone(proposal), range = {startRowIndex: 1, endRowIndex: 2, startColumnIndex: 8, endColumnIndex: 9};
    for (const snapshot of [input, proposal]) snapshot.spreadsheet.sheets.find((sheet) => sheet.properties.title === snapshot.tabs[0].title)[field] = field === "merges" ? [range] : [{range}];
    input.source[0].row.source = "planner"; edit(input, input.source[0].row.id, 8, "planner");
    await assert.rejects(repair(input, proposal));
  }
});

test("repair CLI emits a private review artifact and rejects apply without touching files", async () => {
  const directory = mkdtempSync(join(tmpdir(), "repair-review-")), oldPath = join(directory, "input.json"), newPath = join(directory, "proposal.json");
  try {
    const proposal = await lineageFixture(), input = clone(proposal); input.source[0].row.source = "planner";
    const original = JSON.stringify(input), desired = JSON.stringify(proposal); writeFileSync(oldPath, original); writeFileSync(newPath, desired);
    const args = [require.resolve("../scripts/repair-planned-shifts.cjs"), "--mode", "dry-run", "--input", oldPath, "--proposal", newPath,
      "--project", target.projectId, "--environment", target.environment, "--workbook", target.workbookId,
      "--expected-input-digest", snapshotDigest(input), "--expected-proposal-digest", snapshotDigest(proposal)];
    const run = () => spawnSync(process.execPath, args, {encoding: "utf8", env: {PATH: process.env.PATH}});
    let result = run(); assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).readyForApply, false);
    assert.doesNotMatch(result.stderr, /Persona|90000000/); assert.equal(readFileSync(oldPath, "utf8"), original);
    assert.equal(readFileSync(newPath, "utf8"), desired); assert.equal(readdirSync(directory).length, 2);
    args[2] = "apply"; result = run(); assert.equal(result.status, 1); assert.equal(result.stdout, "");
  } finally { rmSync(directory, {recursive: true, force: true}); }
});


test("repair rejects human conversion and never overwrites formulas or unidentified cell content", async () => {
  const human = await lineageFixture(); const tab = human.tabs[0]; tab.layout = "delivery_human";
  human.spreadsheet.sheets.find((sheet) => sheet.properties.title === tab.title).data = [{rowData: [{values:
    ["27/08/2026", "Persona a", "90000000a"].map((stringValue) => ({userEnteredValue: {stringValue}}))}]}];
  assert.deepEqual((await auditShiftPlanning(human, target)).findings, []);
  await assert.rejects(repair(human, human));
  const proposal = await lineageFixture(), input = clone(proposal);
  input.source[0].row.source = "planner";
  const sheet = input.spreadsheet.sheets.find((sheet) => sheet.properties.title === input.tabs[0].title);
  setCell(sheet, 1, 8, {userEnteredValue: {formulaValue: '=PRIVATE("value")'}});
  await assert.rejects(repair(input, proposal));
  sheet.data[0].rowData[1].values = [];
  setCell(sheet, 1, 5, {userEnteredValue: {stringValue: "unidentified old content"}});
  input.source.shift(); input.lineage.delivery.rows.shift();
  Object.assign(proposal.source[0], {documentRevision: 0, assignmentRevision: 0, completionRevision: 0});
  await assert.rejects(repair(input, proposal));
});


test("repair preserves unselected tabs and rejects mutations outside reviewed partitions", async () => {
  const input = await lineageFixture();
  input.spreadsheet.sheets.push({properties: {sheetId: 9999, title: "Notes", gridProperties: {rowCount: 2, columnCount: 2}},
    data: [{rowData: [{values: [{userEnteredValue: {stringValue: "private note"}}]}]}]});
  const proposal = clone(input);
  assert.deepEqual((await repair(input, proposal)).sheetsChanges, []);
  setCell(proposal.spreadsheet.sheets.at(-1), 1, 0, {userEnteredValue: {stringValue: "shift_delivery_20260827"}});
  await assert.rejects(repair(input, proposal));
});

const {Timestamp, GeoPoint} = require("@google-cloud/firestore");
const {encodeShiftPlanningFirestoreValue: encodeFirestore, decodeShiftPlanningFirestoreDocument: decodeDocument} = require("../lib/shift-planning-publication-contract.js");
const encoded = (value) => encodeFirestore(value, "fixture", new Set());
const capturedDocuments = (input, proposal = input) => ({schemaVersion: 1, target: clone(target), inputDigest: snapshotDigest(input), capturedAt: input.capturedAt,
  absentPaths: proposal.source.filter((entry) => !input.source.some((old) => old.row.id === entry.row.id)).map((entry) => `${target.environment}/plus-collections/shifts/${entry.row.id}`),
  documents: input.source.map((entry) => {
    const row = entry.row, positions = input.lineage[row.type].rows.find((item) => item.shiftId === row.id).positions;
    const date = new Timestamp(Date.parse(row.date + "T00:00:00Z") / 1000, 123456789);
    return {targetPath: `${target.environment}/plus-collections/shifts/${row.id}`,
      updateTime: encoded(new Timestamp(Date.parse(input.capturedAt) / 1000 - 1, 987654321)),
      payload: encoded({type: row.type, date, assignedUserIds: row.assignedUserIds, helperUserId: row.helperUserId,
        status: row.status, source: row.source, origin: row.origin, documentRevision: entry.documentRevision, assignmentRevision: entry.assignmentRevision,
        rotationOwnerUserId: row.type === "delivery" ? row.rotationOwnerUserIds[0] : null,
        rotationOwnerUserIds: row.type === "market" ? row.rotationOwnerUserIds : null,
        roundNumber: row.type === "delivery" ? positions[0].roundNumber : null,
        positionInRound: row.type === "delivery" ? positions[0].positionInRound : null,
        rotationPositions: row.type === "market" ? positions.map((position, index) => ({...position, rotationOwnerUserId: row.rotationOwnerUserIds[index], effectiveAssigneeUserId: row.assignedUserIds[index]})) : null,
        completion: entry.completed ? {state: "completed", revision: entry.completionRevision, actualHelperUserId: row.type === "delivery" ? "d" : null,
          helperSourceAssignmentRevision: row.type === "delivery" ? entry.assignmentRevision : null, completedAt: date} :
          {state: "uncompleted", revision: 0, actualHelperUserId: null, helperSourceAssignmentRevision: null, completedAt: null},
        lastBackendMutation: {originalEvidence: "retained verbatim"}, createdAt: date, updatedAt: date,
        extra: {note: "private extra field", binary: Buffer.from([0, 255]), location: new GeoPoint(40.4, -3.7), nested: [null, true, {at: date}]}})};
  })});
const boundRepair = (input, proposal, capture, overrides = {}) => repair(input, proposal,
  {firestoreCapture: capture, expectedCaptureDigest: snapshotDigest(capture), ...overrides});
const editCaptured = (capture, index, mutate) => {
  const doc = decodeDocument(capture.documents[index].payload); mutate(doc); capture.documents[index].payload = encoded(doc);
};

test("bound repair preserves full typed before-images including unchanged neighbors and extra fields", async () => {
  const proposal = await lineageFixture(), input = clone(proposal); input.source[0].row.source = "planner";
  const capture = capturedDocuments(input), copy = clone(capture), plan = await boundRepair(input, proposal, capture);
  assert.equal(plan.schemaVersion, 2); assert.equal(plan.readyForApply, false); assert.equal(plan.firestoreEvidence.documents.length, 4);
  assert.deepEqual(capture, copy); assert.deepEqual(plan.firestoreEvidence.absentPaths, []);
  for (const item of plan.firestoreEvidence.documents) {
    const original = capture.documents.find((doc) => doc.targetPath === item.targetPath);
    assert.deepEqual(item.payload, original.payload); assert.deepEqual(item.updateTime, original.updateTime);
    const decoded = decodeDocument(item.payload);
    assert.equal(decoded.date.nanoseconds, 123456789); assert.deepEqual(decoded.extra.binary, Buffer.from([0, 255]));
    assert.equal(decoded.extra.location.latitude, 40.4); assert.equal(decoded.extra.nested[2].at.nanoseconds, 123456789);
    assert.equal(decoded.extra.note, "private extra field"); assert.deepEqual(decoded.lastBackendMutation, {originalEvidence: "retained verbatim"});
  }
  assert.deepEqual(await boundRepair(input, proposal, capture), plan);
  assert.equal((await repair(input, proposal)).schemaVersion, 1);
});

test("any unchanged neighbor payload or nanosecond updateTime changes the bound plan digest", async () => {
  const input = await lineageFixture(), capture = capturedDocuments(input), plan = await boundRepair(input, input, capture);
  editCaptured(capture, 2, (doc) => { doc.extra.note = "different private field"; });
  assert.notEqual((await boundRepair(input, input, capture)).planDigest, plan.planDigest);
  const changed = await boundRepair(input, input, capture); capture.documents[2].updateTime.nanoseconds -= 1;
  assert.notEqual((await boundRepair(input, input, capture)).planDigest, changed.planDigest);
  await assert.rejects(boundRepair(input, input, capture, {expectedCaptureDigest: plan.firestoreEvidence.captureDigest}));
});

test("capture requires every original document and exact create absences without extra or foreign paths", async () => {
  const proposal = await lineageFixture(), input = clone(proposal);
  input.source.splice(1, 1); input.lineage.delivery.rows.splice(1, 1);
  Object.assign(proposal.source[1], {documentRevision: 0, assignmentRevision: 0, completionRevision: 0});
  const capture = capturedDocuments(input, proposal), plan = await boundRepair(input, proposal, capture);
  assert.deepEqual(plan.firestoreEvidence.absentPaths, [`develop/plus-collections/shifts/${proposal.source[1].row.id}`]);
  for (const mutate of [(c) => c.documents.pop(), (c) => c.documents.push(clone(c.documents[0])), (c) => { c.absentPaths = []; },
    (c) => c.absentPaths.push(c.absentPaths[0]), (c) => { c.documents[0].targetPath = c.documents[0].targetPath.replace("develop/", "production/"); }]) {
    const bad = clone(capture); mutate(bad); await assert.rejects(boundRepair(input, proposal, bad));
  }
});

test("capture rejects mismatched projections, revisions, completion and row positions", async () => {
  const input = await lineageFixture(), capture = capturedDocuments(input);
  for (const mutate of [(doc) => { doc.assignedUserIds = ["d"]; }, (doc) => { doc.documentRevision += 1; },
    (doc) => { doc.completion.revision = 1; }, (doc) => { doc.completion.completedAt = doc.date; },
    (doc) => { doc.roundNumber = 8; }, (doc) => { doc.rotationOwnerUserIds = ["a"]; },
    (doc) => { doc.date = Timestamp.fromMillis(0); }, (doc) => { delete doc.origin; }]) {
    const bad = clone(capture); editCaptured(bad, 0, mutate); await assert.rejects(boundRepair(input, input, bad));
  }
  const badMarket = clone(capture); editCaptured(badMarket, 3, (doc) => { doc.rotationPositions[0].effectiveAssigneeUserId = "d"; });
  await assert.rejects(boundRepair(input, input, badMarket));
});

test("capture keeps completed actual-helper evidence and rejects lossy timestamp or unsupported values", async () => {
  const input = await lineageFixture(); Object.assign(input.source[0], {completed: true, completionRevision: 1});
  const capture = capturedDocuments(input), plan = await boundRepair(input, input, capture);
  const item = plan.firestoreEvidence.documents.find((item) => item.targetPath.endsWith(input.source[0].row.id));
  assert.equal(decodeDocument(item.payload).completion.actualHelperUserId, "d");
  for (const mutate of [(c) => { c.documents[0].updateTime = {kind: "number", value: 0}; },
    (c) => { c.documents[0].updateTime.nanoseconds = 1000000000; },
    (c) => { c.documents[0].payload = {kind: "reference", path: "private/path"}; },
    (c) => { c.documents[0].updateTime.seconds += 2; }]) {
    const bad = clone(capture); mutate(bad); await assert.rejects(boundRepair(input, input, bad));
  }
});

test("capture binding rejects context mismatch or partial options and never silently downgrades null", async () => {
  const input = await lineageFixture(), capture = capturedDocuments(input);
  for (const mutate of [(c) => { c.inputDigest = "wrong"; }, (c) => { c.capturedAt = "2026-09-09T00:00:00.000Z"; },
    (c) => { c.target.workbookId = "wrong"; }, (c) => { c.schemaVersion = 2; }, (c) => { c.extra = true; }]) {
    const bad = clone(capture); mutate(bad); await assert.rejects(boundRepair(input, input, bad));
  }
  await assert.rejects(repair(input, input, {firestoreCapture: capture}));
  await assert.rejects(repair(input, input, {expectedCaptureDigest: snapshotDigest(capture)}));
  await assert.rejects(repair(input, input, {firestoreCapture: null, expectedCaptureDigest: snapshotDigest(null)}));
});

test("bound CLI reads three immutable files and rejects an unpaired capture flag", async () => {
  const directory = mkdtempSync(join(tmpdir(), "capture-review-"));
  try {
    const proposal = await lineageFixture(), input = clone(proposal); input.source[0].row.source = "planner";
    const capture = capturedDocuments(input), inputPath = join(directory, "input.json"), proposalPath = join(directory, "proposal.json"), capturePath = join(directory, "capture.json");
    const serialized = JSON.stringify(input), desired = JSON.stringify(proposal), captured = JSON.stringify(capture);
    writeFileSync(inputPath, serialized); writeFileSync(proposalPath, desired); writeFileSync(capturePath, captured);
    const args = [require.resolve("../scripts/repair-planned-shifts.cjs"), "--mode", "dry-run", "--input", inputPath, "--proposal", proposalPath,
      "--project", target.projectId, "--environment", target.environment, "--workbook", target.workbookId,
      "--expected-input-digest", snapshotDigest(input), "--expected-proposal-digest", snapshotDigest(proposal),
      "--firestore-capture", capturePath, "--expected-capture-digest", snapshotDigest(capture)];
    const result = spawnSync(process.execPath, args, {encoding: "utf8", env: {PATH: process.env.PATH}});
    assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).schemaVersion, 2);
    assert.equal(readFileSync(inputPath, "utf8"), serialized); assert.equal(readFileSync(capturePath, "utf8"), captured);
    assert.equal(readFileSync(proposalPath, "utf8"), desired); assert.equal(readdirSync(directory).length, 3);
    assert.doesNotMatch(result.stderr, /private extra field|retained verbatim/);
    const bad = spawnSync(process.execPath, args.slice(0, -2), {encoding: "utf8"}); assert.equal(bad.status, 1); assert.equal(bad.stdout, "");
  } finally { rmSync(directory, {recursive: true, force: true}); }
});

const {materializeShiftRepair} = require("../scripts/materialize-shift-repair.cjs");
const {createShiftPlanningPublicEventRetentionPolicy, produceShiftPlanningPublicEventAudit} = require("../lib/shift-planning-public-event-retention.js");
const preparedAt = Timestamp.fromDate(new Date("2026-09-08T12:01:00.000Z"));
const repairAuthority = {bundleRevision: "reviewed-r1", bundleDigest: snapshotDigest({fixture: "bundle"}), writeEpoch: 7};
const retentionPolicy = createShiftPlanningPublicEventRetentionPolicy({policyRevision: "review-policy-r1", maximumDeliveryRetryHorizonMillis: 86400000, safetyMarginMillis: 3600000});
const canonicalCapture = (input, proposal = input) => {
  const capture = capturedDocuments(input, proposal);
  capture.documents.forEach((entry, index) => editCaptured(capture, index, (doc) => {
    delete doc.extra; delete doc.lastBackendMutation; doc.date = new Timestamp(doc.date.seconds, 0);
    Object.assign(doc, {planningSchemaVersion: 1, planningRequestId: "original-request", ...repairAuthority,
      projectionSeasonStartYear: doc.date.toDate().getUTCMonth() >= 8 ? 2026 : 2025, planningReason: doc.type === "delivery" ? "target" : null,
      createdAt: new Timestamp(Date.parse("2026-08-01T00:00:00Z") / 1000, 123456789), updatedAt: Timestamp.fromDate(new Date("2026-08-02T00:00:00Z"))});
    if (doc.completion.state === "completed") doc.updatedAt = doc.completion.completedAt;
    if (doc.rotationPositions) doc.rotationPositions.forEach((position) => { position.planningReason = "target"; });
  }));
  return capture;
};
const packetFor = async (input, proposal, capture) => {
  const review = await boundRepair(input, proposal, capture), writes = [];
  for (const next of proposal.source) {
    const row = next.row, original = input.source.find((entry) => entry.row.id === row.id);
    const positionsFor = (snapshot) => snapshot.lineage[row.type].rows.find((entry) => entry.shiftId === row.id)?.positions ?? null;
    if (original && snapshotDigest(original) === snapshotDigest(next) && snapshotDigest(positionsFor(input)) === snapshotDigest(positionsFor(proposal))) continue;
    const previous = capture.documents.find((entry) => entry.targetPath.endsWith(row.id));
    const payload = previous ? decodeDocument(previous.payload) : {planningSchemaVersion: 1, planningRequestId: "create-request",
      createdAt: preparedAt, completion: {state: "uncompleted", revision: 0, actualHelperUserId: null, helperSourceAssignmentRevision: null, completedAt: null},
      planningReason: row.type === "delivery" ? "target" : null, projectionSeasonStartYear: Number(row.date.slice(5, 7)) >= 9 ? 2026 : 2025};
    const assignmentRevision = previous ? payload.assignmentRevision + Number(snapshotDigest(payload.assignedUserIds) !== snapshotDigest(row.assignedUserIds) || payload.helperUserId !== row.helperUserId) : 1;
    const documentRevision = previous ? payload.documentRevision + 1 : 1;
    Object.assign(payload, {type: row.type, date: payload.date ?? Timestamp.fromDate(new Date(row.date + "T00:00:00Z")),
      assignedUserIds: row.assignedUserIds, helperUserId: row.helperUserId, status: row.status, source: row.source, origin: row.origin,
      assignmentRevision, documentRevision, updatedAt: preparedAt, ...repairAuthority,
      rotationOwnerUserId: row.type === "delivery" ? row.rotationOwnerUserIds[0] : null, rotationOwnerUserIds: row.type === "market" ? row.rotationOwnerUserIds : null,
      roundNumber: row.type === "delivery" ? positionsFor(proposal)[0].roundNumber : null, positionInRound: row.type === "delivery" ? positionsFor(proposal)[0].positionInRound : null,
      rotationPositions: row.type === "market" ? positionsFor(proposal).map((position, index) => ({...position,
        rotationOwnerUserId: row.rotationOwnerUserIds[index], effectiveAssigneeUserId: row.assignedUserIds[index], planningReason: "target"})) : null});
    delete payload.lastBackendMutation;
    writes.push({targetPath: `develop/plus-collections/shifts/${row.id}`, payload: encoded(payload)});
  }
  return {schemaVersion: 1, target: clone(target), repairPlanDigest: review.planDigest, operationId: "repair-r1",
    preparedAt: encoded(preparedAt), authority: clone(repairAuthority), retentionPolicy, writes};
};
const materialize = (input, proposal, capture, packet, overrides = {}) => materializeShiftRepair({input, proposal, target,
  expectedInputDigest: snapshotDigest(input), expectedProposalDigest: snapshotDigest(proposal), firestoreCapture: capture,
  expectedCaptureDigest: snapshotDigest(capture), materialization: packet, expectedMaterializationDigest: snapshotDigest(packet), ...overrides});
const editWrite = (packet, index, mutate) => { const doc = decodeDocument(packet.writes[index].payload); mutate(doc); packet.writes[index].payload = encoded(doc); };

test("materialization binds exact public writes, full guards and create-only terminal/retention with controlled event routing", async () => {
  const proposal = await lineageFixture(), input = clone(proposal); input.source[0].row.source = "planner";
  const capture = canonicalCapture(input), packet = await packetFor(input, proposal, capture), originalPacket = clone(packet);
  const result = await materialize(input, proposal, capture, packet), group = result.materializationEvidence.atomicGroup;
  assert.equal(result.schemaVersion, 3); assert.equal(result.readyForApply, false); assert.equal(group.writes.length, 3); assert.equal(group.readGuards.length, 6);
  assert.deepEqual(packet, originalPacket); assert.deepEqual(await materialize(input, proposal, capture, packet), result);
  const write = group.writes[0], doc = decodeDocument(write.payload), terminal = decodeDocument(group.writes[1].payload), retention = decodeDocument(group.writes[2].payload);
  assert.equal(doc.source, "app"); assert.equal(doc.documentRevision, 3); assert.equal(doc.assignmentRevision, 1);
  assert.equal(doc.createdAt.nanoseconds, 123456789); assert.equal(doc.planningRequestId, "original-request"); assert.equal(doc.lastBackendMutation.kind, "repair");
  assert.equal(terminal.publicMutations[0].payloadDigest, doc.lastBackendMutation.payloadDigest);
  assert.equal(retention.operationIntentDigest, terminal.operationIntentDigest); assert.equal(retention.retainUntil.toMillis(), preparedAt.toMillis() + 90000000);
  assert.equal(group.readGuards.find((guard) => guard.targetPath.endsWith(input.source[2].row.id)).updateTime.nanoseconds, 987654321);
  assert.ok(group.readGuards.filter((guard) => !guard.exists).every((guard) => /shiftPlanningOperations|shiftPlanningPublicEventLedgers/.test(guard.targetPath)));
  const event = {eventId: "independent-event", eventTime: preparedAt, targetPath: write.targetPath, before: decodeDocument(capture.documents[0].payload),
    after: doc, operation: terminal, retention, policy: retentionPolicy};
  assert.equal(produceShiftPlanningPublicEventAudit(event).kind, "controlledNoOp");
  assert.equal(produceShiftPlanningPublicEventAudit({...event, operation: null}).kind, "failClosed");
  const changed = {...doc, helperUserId: "d"};
  assert.equal(produceShiftPlanningPublicEventAudit({...event, after: changed}).kind, "failClosed");
  assert.equal(produceShiftPlanningPublicEventAudit({...event, before: doc, after: changed}).kind, "ordinary");
});

test("materialization includes lineage-only repairs and increments assignment revision only for assignment/helper changes", async () => {
  const proposal = await lineageFixture(), input = clone(proposal); input.lineage.market.rows[0].positions[0].roundNumber = 8;
  input.source[1].row.assignedUserIds = ["d"]; input.source[0].row.helperUserId = "d";
  const capture = canonicalCapture(input), packet = await packetFor(input, proposal, capture), result = await materialize(input, proposal, capture, packet);
  const writes = result.materializationEvidence.atomicGroup.writes.slice(0, -2); assert.equal(writes.length, 3);
  const market = decodeDocument(writes.find((write) => write.targetPath.includes("shift_market")).payload);
  assert.equal(market.rotationPositions[0].roundNumber, 1); assert.equal(market.assignmentRevision, 1);
  for (const write of writes.filter((write) => write.targetPath.includes("shift_delivery"))) assert.equal(decodeDocument(write.payload).assignmentRevision, 2);
});

test("materialization creates missing rows with revision one and exact absence guards", async () => {
  const proposal = await lineageFixture(), input = clone(proposal); input.source.splice(1, 1); input.lineage.delivery.rows.splice(1, 1);
  Object.assign(proposal.source[1], {documentRevision: 0, assignmentRevision: 0, completionRevision: 0});
  const capture = canonicalCapture(input, proposal), packet = await packetFor(input, proposal, capture), result = await materialize(input, proposal, capture, packet);
  const group = result.materializationEvidence.atomicGroup, write = group.writes[0], doc = decodeDocument(write.payload);
  assert.equal(write.mutationKind, "create"); assert.equal(doc.documentRevision, 1); assert.equal(doc.assignmentRevision, 1); assert.ok(doc.createdAt.isEqual(preparedAt));
  assert.deepEqual(group.readGuards.find((guard) => guard.targetPath === write.targetPath), {targetPath: write.targetPath, exists: false});
});

test("materialization rejects wrong scope, stale bindings and missing, duplicate or extra writes", async () => {
  const proposal = await lineageFixture(), input = clone(proposal); input.source[0].row.source = "planner";
  const capture = canonicalCapture(input), packet = await packetFor(input, proposal, capture);
  for (const mutate of [(p) => { p.repairPlanDigest = "stale"; }, (p) => { p.target.workbookId = "wrong"; }, (p) => { p.writes = []; },
    (p) => p.writes.push(clone(p.writes[0])), (p) => { p.writes[0].targetPath = p.writes[0].targetPath.replace("develop/", "production/"); },
    (p) => { p.authority.writeEpoch += 1; }, (p) => { p.preparedAt = encoded(Timestamp.fromMillis(0)); }, (p) => { p.extra = true; }]) {
    const bad = clone(packet); mutate(bad); await assert.rejects(materialize(input, proposal, capture, bad));
  }
  await assert.rejects(materialize(input, proposal, capture, packet, {expectedMaterializationDigest: "stale"}));
  editCaptured(capture, 2, (doc) => { doc.updatedAt = Timestamp.fromMillis(0); }); await assert.rejects(materialize(input, proposal, capture, packet));
});

test("materialization rejects altered dates, metadata, completion, revisions and unreviewed projection changes", async () => {
  const proposal = await lineageFixture(), input = clone(proposal); input.source[0].row.source = "planner";
  const capture = canonicalCapture(input), packet = await packetFor(input, proposal, capture);
  for (const mutate of [(doc) => { doc.date = new Timestamp(doc.date.seconds, 1); }, (doc) => { doc.planningRequestId = "different"; },
    (doc) => { doc.planningReason = "boundaryRoundRemainder"; }, (doc) => { doc.createdAt = preparedAt; }, (doc) => { doc.documentRevision = 2; },
    (doc) => { doc.assignmentRevision = 2; }, (doc) => { doc.helperUserId = "d"; }, (doc) => { doc.roundNumber = 8; },
    (doc) => { doc.completion.state = "completed"; }, (doc) => { doc.extra = "unexpected"; }, (doc) => { doc.updatedAt = doc.createdAt; }]) {
    const bad = clone(packet); editWrite(bad, 0, mutate); await assert.rejects(materialize(input, proposal, capture, bad));
  }
});

test("materialization refuses loss of legacy extras and malformed prior provenance while retaining before-images", async () => {
  const proposal = await lineageFixture(), input = clone(proposal); input.source[0].row.source = "planner";
  for (const field of ["extra", "lastBackendMutation"]) {
    const capture = canonicalCapture(input); editCaptured(capture, 0, (doc) => { doc[field] = {evidence: "preserve me"}; });
    const packet = await packetFor(input, proposal, capture); editWrite(packet, 0, (doc) => { delete doc[field]; });
    assert.equal((await boundRepair(input, proposal, capture)).firestoreEvidence.documents.length, 4);
    await assert.rejects(materialize(input, proposal, capture, packet));
  }
});

test("completed source stays guarded unchanged and cannot be hidden in the write packet", async () => {
  const proposal = await lineageFixture(); Object.assign(proposal.source[0], {completed: true, completionRevision: 1});
  const input = clone(proposal); input.source[3].row.source = "planner";
  const capture = canonicalCapture(input), packet = await packetFor(input, proposal, capture), result = await materialize(input, proposal, capture, packet);
  const completedPath = capture.documents[0].targetPath;
  assert.ok(!result.materializationEvidence.atomicGroup.writes.some((write) => write.targetPath === completedPath));
  assert.deepEqual(result.firestoreEvidence.documents.find((doc) => doc.targetPath === completedPath).payload, capture.documents[0].payload);
  packet.writes.push({targetPath: completedPath, payload: capture.documents[0].payload}); await assert.rejects(materialize(input, proposal, capture, packet));
});

test("materialization CLI emits an immutable review and rejects unpaired options and apply", async () => {
  const directory = mkdtempSync(join(tmpdir(), "materialization-review-"));
  try {
    const proposal = await lineageFixture(), input = clone(proposal); input.source[0].row.source = "planner";
    const capture = canonicalCapture(input), packet = await packetFor(input, proposal, capture), values = {input, proposal, capture, packet};
    for (const [name, value] of Object.entries(values)) writeFileSync(join(directory, name + ".json"), JSON.stringify(value));
    const args = [require.resolve("../scripts/repair-planned-shifts.cjs"), "--mode", "dry-run", "--input", join(directory, "input.json"),
      "--proposal", join(directory, "proposal.json"), "--project", target.projectId, "--environment", target.environment, "--workbook", target.workbookId,
      "--expected-input-digest", snapshotDigest(input), "--expected-proposal-digest", snapshotDigest(proposal),
      "--firestore-capture", join(directory, "capture.json"), "--expected-capture-digest", snapshotDigest(capture),
      "--materialization", join(directory, "packet.json"), "--expected-materialization-digest", snapshotDigest(packet)];
    const result = spawnSync(process.execPath, args, {encoding: "utf8", env: {PATH: process.env.PATH}});
    assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).schemaVersion, 3);
    for (const [name, value] of Object.entries(values)) assert.equal(readFileSync(join(directory, name + ".json"), "utf8"), JSON.stringify(value));
    assert.equal(readdirSync(directory).length, 4);
    const partial = spawnSync(process.execPath, args.slice(0, -2), {encoding: "utf8"}); assert.equal(partial.status, 1); assert.equal(partial.stdout, "");
    args[2] = "apply"; const apply = spawnSync(process.execPath, args, {encoding: "utf8"}); assert.equal(apply.status, 1); assert.equal(apply.stdout, "");
  } finally { rmSync(directory, {recursive: true, force: true}); }
});

test("materialization preserves market planning reasons and rejects exhausted counters or invalid retention", async () => {
  const proposal = await lineageFixture(), input = clone(proposal); input.lineage.market.rows[0].positions[0].roundNumber = 8;
  const capture = canonicalCapture(input), packet = await packetFor(input, proposal, capture);
  await materialize(input, proposal, capture, packet);
  const reason = clone(packet); editWrite(reason, 0, (doc) => { doc.rotationPositions[0].planningReason = "finalGroupPadding"; });
  await assert.rejects(materialize(input, proposal, capture, reason));
  const policy = clone(packet); policy.retentionPolicy.maximumDeliveryRetryHorizonMillis += 1;
  await assert.rejects(materialize(input, proposal, capture, policy));
  input.source[3].documentRevision = Number.MAX_SAFE_INTEGER; proposal.source[3].documentRevision = Number.MAX_SAFE_INTEGER;
  const exhaustedCapture = canonicalCapture(input), exhaustedPacket = await packetFor(input, proposal, exhaustedCapture);
  await assert.rejects(materialize(input, proposal, exhaustedCapture, exhaustedPacket));
});

test("materialization requires bound captures and real public changes rather than fabricating empty repair terminals", async () => {
  const input = await lineageFixture(), capture = canonicalCapture(input), packet = await packetFor(input, input, capture);
  assert.equal(packet.writes.length, 0); await assert.rejects(materialize(input, input, capture, packet));
  await assert.rejects(materialize(input, input, capture, packet, {firestoreCapture: undefined, expectedCaptureDigest: undefined}));
});
