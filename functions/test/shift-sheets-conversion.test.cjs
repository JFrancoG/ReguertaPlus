"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {mkdtempSync, writeFileSync, readFileSync, rmSync} = require("node:fs");
const {tmpdir} = require("node:os");
const {join} = require("node:path");
const {spawnSync} = require("node:child_process");
const {planShiftSheetsConversion: plan} = require("../scripts/plan-shift-sheets-conversion.cjs");
const {planShiftRepair} = require("../scripts/repair-planned-shifts.cjs");
const {repairFixture, digest} = require("./shift-repair-rehearsal-fixture.cjs");
const {createShiftSheetsConfig} = require("../lib/shift-sheets-config.js");
const {createShiftSheetsAdapter, shiftSheetsGridRows} = require("../lib/shift-sheets.js");
const {sheetsService, clone} = require("./shift-sheets-api-fixture.cjs");
const cell = (value) => ({userEnteredValue: typeof value === "number" ? {numberValue: value} : {stringValue: value}});
const fixture = async () => {
  const {options} = await repairFixture(), input = clone(options.proposal);
  input.spreadsheet.properties = {locale: "es_ES", timeZone: "America/Los_Angeles"};
  for (const tab of input.tabs) {
    const sheet = input.spreadsheet.sheets.find((sheet) => sheet.properties.title === tab.title);
    // Exercise the explicit historic alias and both current season layouts.
    if (tab.type === "delivery" && tab.seasonStartYear === 2025) {
      sheet.properties.title = tab.title = "TORRE 2025-26";
      input.aliases.push({type: tab.type, seasonStartYear: tab.seasonStartYear, title: tab.title});
    }
    tab.layout = `${tab.type}_human`;
    tab.decorations = [{rowNumber: 1, cells: ["Título"]}, {rowNumber: 2, cells: ["Mes"]}];
    const rows = [["Título"], ["Mes"]];
    const sources = input.source.filter(({row}) => row.type === tab.type &&
      Number(row.date.slice(0, 4)) - Number(Number(row.date.slice(5, 7)) < 9) === tab.seasonStartYear);
    for (const {row} of sources) {
      const serial = (Date.parse(row.date + "T00:00:00Z") - Date.UTC(1899, 11, 30)) / 86400000;
      if (tab.type === "delivery") rows.push([serial, "Fixture " + row.assignedUserIds[0], "", "", "", "nota manual"]);
      else rows.push([row.date], ...row.assignedUserIds.map((id) => ["Fixture " + id]), []);
    }
    sheet.data = [{rowData: rows.map((values) => ({values: values.map(cell)}))}];
    sheet.merges = [{sheetId: sheet.properties.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 6}];
    sheet.protectedRanges = [{protectedRangeId: 8, range: {sheetId: sheet.properties.sheetId}, warningOnly: true}];
    const first = sheet.data[0].rowData[2].values;
    while (first.length < 12) first.push({});
    first.push({userEnteredValue: {formulaValue: "=1+1"}, note: "nota fuera del rango humano", userEnteredFormat: {textFormat: {bold: true}}});
  }
  const selection = {schemaVersion: 1, target: input.target, inputDigest: digest(input), strategy: "archive_and_create_canonical",
    tabs: input.tabs.map((tab, index) => ({sourceSheetId: input.spreadsheet.sheets.find((sheet) => sheet.properties.title === tab.title).properties.sheetId,
      sourceTitle: tab.title, archiveTitle: `Archivo ${tab.title}`, canonicalSheetId: 100 + index}))};
  return {input, target: input.target, selection, expectedInputDigest: digest(input), expectedSelectionDigest: digest(selection)};
};
const rebind = (options) => {
  options.expectedInputDigest = options.selection.inputDigest = digest(options.input);
  options.expectedSelectionDigest = digest(options.selection); return options;
};
const texts = (sheet) => shiftSheetsGridRows(sheet).map((row) => row.map((cell) => cell?.userEnteredValue?.stringValue));

test("human archive preserves full metadata, notes and formulas; canonical calendar/UID rows round-trip without changing source", async () => {
  const f = await fixture(), original = clone(f), result = await plan(f);
  assert.deepEqual(f, original); assert.deepEqual(await plan(f), result);
  assert.equal(result.changes.length, 3); assert.equal(result.readyForApply, false);
  assert.deepEqual(result.audit.after.findings, []);
  for (const key of ["source", "members", "lineage", "aliases", "expectedDates", "capturedAt", "workbookVersion"]) {
    assert.deepEqual(result.canonicalInput[key], f.input[key]);
  }
  for (const change of result.changes) {
    const original = f.input.spreadsheet.sheets.find((sheet) => sheet.properties.sheetId === change.sourceSheetId);
    const archive = result.canonicalInput.spreadsheet.sheets.find((sheet) => sheet.properties.sheetId === change.sourceSheetId);
    assert.deepEqual({...archive, properties: {...archive.properties, title: original.properties.title}}, original);
    const canonical = result.canonicalInput.spreadsheet.sheets.find((sheet) => sheet.properties.sheetId === change.canonicalSheetId);
    const rows = texts(canonical);
    assert.deepEqual(rows[0], ["shiftId", "type", "date", "seasonStartYear", "rotationOwnerUserIds", "assignedUserIds", "helperUserId", "status", "source", "origin", "rowDigest"]);
    for (const row of rows.slice(1)) {
      const source = f.input.source.find((entry) => entry.row.id === row[0]).row;
      assert.equal(row[2], source.date); assert.deepEqual(JSON.parse(row[5]), source.assignedUserIds);
      assert.equal(row.length, 11);
    }
  }
  assert.deepEqual(result.inverse.originalInput, f.input);
  assert.equal(digest(result.inverse.originalInput), result.inputDigest);
  assert.equal(result.inverse.expectedCanonicalInputDigest, digest(result.canonicalInput));
});

test("existing exporter targets new canonical IDs and leaves human archives unchanged", async () => {
  const f = await fixture(), result = await plan(f), service = sheetsService(f.target.workbookId);
  service.state = clone(result.canonicalInput.spreadsheet);
  const archives = service.state.sheets.filter((sheet) => sheet.properties.title.startsWith("Archivo"));
  const before = clone(archives), rows = clone(f.input.source.map((entry) => entry.row)); rows[1].assignedUserIds = ["d"];
  const config = createShiftSheetsConfig({environment: "develop", workbooks: {develop: f.target.workbookId}, aliases: f.input.aliases});
  await createShiftSheetsAdapter({config, sheets: service}).reconcile({operationId: "after-conversion", rows, authorizeMutation: async () => {}});
  assert.deepEqual(service.state.sheets.filter((sheet) => sheet.properties.title.startsWith("Archivo")), before);
  const edited = service.state.sheets.flatMap(texts).find((row) => row[0] === rows[1].id);
  assert.equal(edited[5], '["d"]');
  assert.ok(service.mutations.length > 0);
});

test("canonical clone feeds existing repair review while unresolved lineage findings and archived sheets remain intact", async () => {
  const f = await fixture(); f.input.lineage.market.rows[0].positions[0].roundNumber = 8; rebind(f);
  const conversion = await plan(f), input = conversion.canonicalInput, proposal = clone(input);
  assert.ok(conversion.audit.after.findings.some(({code}) => code === "rotation_position_mismatch"));
  proposal.lineage.market.rows[0].positions[0].roundNumber = 1;
  const repair = await planShiftRepair({input, proposal, target: f.target, expectedInputDigest: digest(input), expectedProposalDigest: digest(proposal)});
  assert.equal(repair.lineageChanges.length, 1); assert.deepEqual(repair.sheetsChanges, []);
});

test("stale evidence binds notes, workbook revision, membership and exact conversion selection", async () => {
  for (const mutate of [
    (f) => { f.input.workbookVersion = "18"; },
    (f) => { f.input.members[0].names.push("otra"); },
    (f) => { f.input.spreadsheet.sheets[0].data[0].rowData[2].values[12].note = "changed"; },
    (f) => { f.selection.tabs[0].canonicalSheetId = 200; },
    (f) => { f.expectedInputDigest = digest({wrong: true}); },
  ]) { const f = await fixture(); mutate(f); await assert.rejects(plan(f)); }
});

test("conversion cannot absorb assignment disputes, missing dates, invalid provenance or ambiguous identities", async () => {
  for (const mutate of [
    (f) => { f.input.spreadsheet.sheets[0].data[0].rowData[2].values[1] = cell("Fixture d"); },
    (f) => { f.input.spreadsheet.sheets[0].data[0].rowData.splice(2); },
    (f) => { f.input.expectedDates.delivery.push("2026-09-17"); },
    (f) => { f.input.source[0].row.source = "planner"; },
    (f) => { f.input.members[1].names = ["Fixture a"]; },
    (f) => { f.input.spreadsheet.sheets[0].data[0].rowData[0].values[0] = cell("Changed title"); },
    (f) => { f.input.spreadsheet.sheets[0].data[0].rowData[2].values[0] = {userEnteredValue: {formulaValue: "=NOW()"}}; },
  ]) { const f = await fixture(); mutate(f); await assert.rejects(plan(rebind(f))); }
});

test("explicit selection rejects duplicate, missing, wrong, colliding and invalid archive or sheet identities", async () => {
  for (const mutate of [
    (f) => { f.selection.tabs.pop(); },
    (f) => { f.selection.tabs[1] = clone(f.selection.tabs[0]); },
    (f) => { f.selection.tabs[0].sourceSheetId = f.selection.tabs[1].sourceSheetId; },
    (f) => { f.selection.tabs[0].canonicalSheetId = f.selection.tabs[0].sourceSheetId; },
    (f) => { f.selection.tabs[0].canonicalSheetId = 2147483648; },
    (f) => { f.selection.tabs[0].archiveTitle = f.selection.tabs[1].archiveTitle.toUpperCase(); },
    (f) => { f.selection.tabs[0].archiveTitle = f.selection.tabs[0].sourceTitle; },
    (f) => { f.selection.tabs[0].archiveTitle = "bad/title"; },
    (f) => { f.selection.tabs[0].approved = true; },
    (f) => { f.selection.strategy = "overwrite"; },
    (f) => { f.selection.target = {...f.target, environment: "production"}; },
  ]) { const f = await fixture(); mutate(f); await assert.rejects(plan(rebind(f))); }
});

test("whole workbook bounds include retained archives and generated canonical tabs", async () => {
  const f = await fixture();
  for (let i = 0; i < 3; i++) f.input.spreadsheet.sheets.push({properties: {sheetId: 200 + i, title: `Extra ${i}`, gridProperties: {rowCount: 1, columnCount: 1}}, data: []});
  await assert.rejects(plan(rebind(f)));
  const g = await fixture(); g.input.spreadsheet.sheets[0].properties.gridProperties.rowCount = 2001;
  await assert.rejects(plan(rebind(g)));
  const h = await fixture();
  h.input.spreadsheet.sheets.forEach((sheet, index) => Object.assign(sheet.properties.gridProperties,
    index < 2 ? {rowCount: 2000, columnCount: 60} : {rowCount: 625, columnCount: 16}));
  const {auditShiftPlanning} = require("../scripts/audit-shift-planning.cjs");
  assert.deepEqual((await auditShiftPlanning(h.input, h.target)).findings, []);
  await assert.rejects(plan(rebind(h)), "Generated grids must not exceed the total 250000-cell limit");
});

test("mixed canonical/human partitions leave existing canonical cells and unrelated tabs exactly intact", async () => {
  const f = await fixture(), tab = f.input.tabs[0];
  const config = createShiftSheetsConfig({environment: "develop", workbooks: {develop: f.target.workbookId}, aliases: f.input.aliases});
  const service = sheetsService(f.target.workbookId);
  await createShiftSheetsAdapter({config, sheets: service}).reconcile({operationId: "fixture", rows: f.input.source.map((entry) => entry.row), authorizeMutation: async () => {}});
  const canonical = clone(service.state.sheets.find((sheet) => sheet.properties.title === tab.title));
  canonical.properties.sheetId = f.selection.tabs[0].sourceSheetId;
  const canonicalIndex = f.input.spreadsheet.sheets.findIndex((sheet) => sheet.properties.sheetId === canonical.properties.sheetId);
  f.input.spreadsheet.sheets[canonicalIndex] = canonical; tab.layout = "canonical"; tab.decorations = []; f.selection.tabs.shift();
  const extra = {properties: {sheetId: 500, title: "Notas", gridProperties: {rowCount: 1, columnCount: 1}}, data: [{rowData: [{values: [cell("untouched")]}]}]};
  f.input.spreadsheet.sheets.push(extra);
  const result = await plan(rebind(f));
  assert.deepEqual(result.canonicalInput.spreadsheet.sheets[canonicalIndex], canonical);
  assert.deepEqual(result.canonicalInput.spreadsheet.sheets.find((sheet) => sheet.properties.title === "Notas"), extra);
});

test("CLI emits a private offline review, preserves both inputs and refuses mutation modes or unknown flags", async () => {
  const f = await fixture(), dir = mkdtempSync(join(tmpdir(), "hu083-conversion-"));
  try {
    const input = join(dir, "input.json"), selection = join(dir, "selection.json");
    writeFileSync(input, JSON.stringify(f.input)); writeFileSync(selection, JSON.stringify(f.selection));
    const originals = [readFileSync(input, "utf8"), readFileSync(selection, "utf8")];
    const args = ["scripts/plan-shift-sheets-conversion.cjs", "--mode", "dry-run", "--input", input, "--selection", selection,
      "--expected-input-digest", f.expectedInputDigest, "--expected-selection-digest", f.expectedSelectionDigest,
      "--project", f.target.projectId, "--environment", "develop", "--workbook", f.target.workbookId];
    const run = (args) => spawnSync(process.execPath, args, {cwd: join(__dirname, ".."), encoding: "utf8", maxBuffer: 8 * 1024 * 1024});
    const result = run(args); assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).readyForApply, false);
    assert.doesNotMatch(result.stderr, /Fixture|nota manual/);
    for (const invalid of [args.map((arg) => arg === "dry-run" ? "apply" : arg), [...args, "--apply"],
      args.map((arg) => arg === "develop" ? "production" : arg)]) {
      const rejected = run(invalid); assert.equal(rejected.status, 1); assert.equal(rejected.stdout, "");
    }
    assert.deepEqual([readFileSync(input, "utf8"), readFileSync(selection, "utf8")], originals);
  } finally { rmSync(dir, {recursive: true}); }
});
