"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {createHash} = require("node:crypto");
const {createShiftSheetsOwnerPreservationManifest: create,
  assertShiftSheetsOwnerPreservation: verify,
  parseShiftSheetsOwnerPreservationManifest: parse} =
  require("../lib/shift-sheets-owner-manifest.js");
const clone = structuredClone;
const properties = (sheetId, title, index) => ({sheetId, title, index,
  sheetType: "GRID", hidden: false, gridProperties: {
    rowCount: 3, columnCount: 3, frozenRowCount: 0, frozenColumnCount: 0}});
const cell = (text) => ({userEnteredValue: {stringValue: text}});
const marker = (metadataId, sheetId, value = "before") => ({metadataId,
  metadataKey: "reguerta.shiftSheets.v1", metadataValue: value,
  visibility: "DOCUMENT", location: {sheetId, dimensionRange: {
    sheetId: null, dimension: null, startIndex: null, endIndex: null},
    spreadsheet: null}});
const fixture = () => ({spreadsheetId: "copy-workbook", sheets: [
  {properties: properties(1, "Managed", 0), dataCoverage: "complete",
    protectedRanges: [], merges: [], developerMetadata: [marker(7, 1)],
    data: [{startRow: 0, startColumn: 0, rowData: [{values: [
      {...cell("date"), userEnteredFormat: {textFormat: {bold: true}},
        note: "preserve note", textFormatRuns: [{startIndex: 0,
          format: {bold: true}}]}, cell("annotation"),
      {userEnteredValue: {formulaValue: "=1+2"},
        dataValidation: {condition: {type: "NUMBER_GREATER", values: [
          {userEnteredValue: "0"}]}}}]}]}]},
  {properties: properties(2, "Unobserved cells", 1),
    dataCoverage: "metadata-only", protectedRanges: [], merges: [],
    developerMetadata: [], data: []},
]});
const update = {updateCells: {range: {sheetId: 1, startRowIndex: 0,
  endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1},
rows: [{values: [cell("new date")]}], fields: "userEnteredValue"}};
const expected = (before) => {
  const after = clone(before);
  after.sheets[0].data[0].rowData[0].values[0].userEnteredValue =
    {stringValue: "new date"};
  return after;
};
const rejected = (run) => assert.throws(run,
  (error) => error.code === "sheets_owner_preservation_rejected");

test("binds the exact request bytes and verifies values while preserving observed annotations and formats", () => {
  const before = fixture(), requests = [clone(update)];
  const manifest = create({before, requests});
  assert.equal(manifest.requestDigest, "shift-sheets:v1:sha256:" +
    createHash("sha256").update(JSON.stringify({requests})).digest("hex"));
  assert.deepEqual(parse(manifest), manifest);
  verify({manifest, after: expected(before)});
  assert.ok(JSON.stringify(manifest).length < JSON.stringify(before).length + 500);
  before.sheets[0].properties.title = "mutated input";
  requests[0].updateCells.fields = "*";
  verify({manifest, after: expected(fixture())});
});

test("rejects changes to managed values, untouched values, formulas, formatting, notes, controls and tab identity", () => {
  const before = fixture(), manifest = create({before, requests: [update]});
  const mutations = [
    (s) => { s.data[0].rowData[0].values[0].userEnteredValue.stringValue = "wrong"; },
    (s) => { s.data[0].rowData[0].values[1] = cell("manual drift"); },
    (s) => { s.data[0].rowData[0].values[2].userEnteredValue.formulaValue = "=2+2"; },
    (s) => { s.data[0].rowData[0].values[0].userEnteredFormat.textFormat.bold = false; },
    (s) => { s.data[0].rowData[0].values[0].note = "changed"; },
    (s) => { s.data[0].rowData[0].values[0].textFormatRuns = []; },
    (s) => { s.data[0].rowData[0].values[2].dataValidation = {}; },
    (s) => { s.protectedRanges = [{protectedRangeId: 1}]; },
    (s) => { s.merges = [{sheetId: 1}]; },
    (s) => { s.developerMetadata[0].metadataValue = "unrequested"; },
    (s) => { s.properties.hidden = true; },
    (s) => { s.properties.index = 1; },
  ];
  for (const mutate of mutations) {
    const after = expected(before); mutate(after.sheets[0]);
    rejected(() => verify({manifest, after}));
  }
  const after = expected(before); after.sheets.push({...clone(after.sheets[1]),
    properties: properties(3, "unexpected", 2)});
  rejected(() => verify({manifest, after}));
  after.sheets.pop(); after.sheets.pop();
  rejected(() => verify({manifest, after}));
});

test("asserts exact dimension growth, explicit clears and metadata value updates", () => {
  const before = fixture();
  const requests = [{updateSheetProperties: {properties: {sheetId: 1,
    gridProperties: {rowCount: 4, columnCount: 3}},
  fields: "gridProperties.rowCount,gridProperties.columnCount"}},
  {updateCells: {...clone(update.updateCells), rows: [{values: [{}]}]}},
  {updateDeveloperMetadata: {dataFilters: [{developerMetadataLookup: {
    metadataId: 7}}], developerMetadata: {metadataValue: "new marker"},
  fields: "metadataValue"}}];
  const manifest = create({before, requests}), after = clone(before);
  after.sheets[0].properties.gridProperties.rowCount = 4;
  delete after.sheets[0].data[0].rowData[0].values[0].userEnteredValue;
  after.sheets[0].developerMetadata[0].metadataValue = "new marker";
  verify({manifest, after});
  after.sheets[0].properties.gridProperties.rowCount = 5;
  rejected(() => verify({manifest, after}));
});

test("checks new tab defaults, exact markers and absence of observed unintended cells or controls", () => {
  const before = fixture();
  const requests = [{addSheet: {properties: {sheetId: 3, title: "Created",
    gridProperties: {rowCount: 3, columnCount: 3}}}},
  {updateCells: {...clone(update.updateCells), range: {
    ...update.updateCells.range, sheetId: 3}}},
  {createDeveloperMetadata: {developerMetadata: {
    metadataKey: "reguerta.shiftSheets.v1", metadataValue: "new marker",
    visibility: "DOCUMENT", location: {sheetId: 3}}}}];
  const manifest = create({before, requests}), after = clone(before);
  after.sheets.push({properties: properties(3, "Created", 2),
    dataCoverage: "complete", protectedRanges: [], merges: [],
    developerMetadata: [marker(8, 3, "new marker")], data: [{startRow: 0,
      startColumn: 0, rowData: [{values: [cell("new date")]}]}]});
  verify({manifest, after});
  const mutations = [
    (s) => { s.properties.gridProperties.frozenRowCount = 1; },
    (s) => { s.protectedRanges = [{protectedRangeId: 99}]; },
    (s) => { s.merges = [{sheetId: 3}]; },
    (s) => { s.data[0].rowData[0].values.push(cell("unexpected")); },
    (s) => { s.developerMetadata[0].metadataValue = "wrong"; },
    (s) => { s.developerMetadata.push(marker(9, 3, "new marker")); },
  ];
  for (const mutate of mutations) {
    const drift = clone(after); mutate(drift.sheets[2]);
    rejected(() => verify({manifest, after: drift}));
  }
  const defaults = clone(after);
  delete defaults.sheets[2].properties.hidden;
  delete defaults.sheets[2].properties.sheetType;
  delete defaults.sheets[2].properties.gridProperties.frozenRowCount;
  delete defaults.sheets[2].properties.gridProperties.frozenColumnCount;
  verify({manifest, after: defaults});
  const grown = clone(after);
  grown.sheets[2].properties.gridProperties.rowCount = 4;
  const grownManifest = create({before, requests: [...requests,
    {updateSheetProperties: {properties: {sheetId: 3,
      gridProperties: {rowCount: 4, columnCount: 3}},
    fields: "gridProperties.rowCount,gridProperties.columnCount"}}]});
  verify({manifest: grownManifest, after: grown});
});

test("rejects unsupported or unbounded requests, masked formatting, overlap and unobserved targets", () => {
  const before = fixture();
  const cases = [
    [{deleteSheet: {sheetId: 1}}],
    [{deleteDeveloperMetadata: {dataFilter: {}}}],
    [{updateCells: {...clone(update.updateCells), fields: "*"}}],
    [{updateCells: {...clone(update.updateCells), fields: "userEnteredFormat"}}],
    [{updateCells: {...clone(update.updateCells), range: {sheetId: 1}}}],
    [{updateCells: {...clone(update.updateCells), range: {...update.updateCells.range, sheetId: 2}}}],
    [clone(update), clone(update)],
    [{updateSheetProperties: {properties: {sheetId: 1,
      gridProperties: {rowCount: 2, columnCount: 3}},
    fields: "gridProperties.rowCount,gridProperties.columnCount"}}],
  ];
  for (const requests of cases) rejected(() => create({before, requests}));
  const manifest = create({before, requests: [update]}), after = expected(before);
  after.sheets[0].dataCoverage = "metadata-only";
  rejected(() => verify({manifest, after}));
  manifest.policy.writes[0].column = 2;
  rejected(() => parse(manifest));
});
