"use strict";
const assert = require("node:assert/strict");
const clone = (value) => JSON.parse(JSON.stringify(value));
const content = (sheet, rowIndex, column) => sheet.data?.[0]?.rowData?.[rowIndex]?.values?.[column]?.userEnteredValue;
const setCell = (sheet, rowIndex, column, cell) => {
  sheet.data ??= [{rowData: []}];
  const values = (sheet.data[0].rowData[rowIndex] ??= {values: []}).values;
  values[column] = {...values[column], ...cell};
};

// A stateful public-API fake applies an entire batch to a copy before publishing
// it. Assertions inspect the resulting cells, not merely calls to our helpers.
const sheetsService = (workbookId = "book-development") => {
  const service = {state: {spreadsheetId: workbookId, sheets: []}, mutations: [], reads: [],
    failRead: false, loseAcknowledgement: false, rejectBeforeApply: false, onMutation: null, rejectedBatches: 0};
  let nextMetadataId = 1;
  service.get = async (input, options) => {
    service.reads.push(clone(input));
    assert.equal(options.retry, false);
    if (service.failRead) throw new Error("read unavailable");
    const data = clone(service.state);
    if (input.ranges) {
      data.sheets = data.sheets.filter((sheet) => input.ranges.some((range) =>
        range.startsWith(`'${sheet.properties.title.replace(/'/g, "''")}'!`)));
    } else data.sheets.forEach((sheet) => { delete sheet.data; });
    return {data};
  };
  service.batchUpdate = async (input, options) => {
    service.mutations.push(clone(input));
    assert.equal(options.retry, false);
    if (service.rejectBeforeApply) throw new Error("uncertain transport failure");
    const next = clone(service.state);
    for (const request of input.requestBody.requests) {
      if (request.addSheet) {
        const proposed = request.addSheet.properties;
        if (next.sheets.some((sheet) => sheet.properties.title === proposed.title || sheet.properties.sheetId === proposed.sheetId)) {
          service.rejectedBatches += 1;
          throw new Error("ALREADY_EXISTS: sheet title or ID is already present");
        }
        next.sheets.push({properties: request.addSheet.properties, data: [{rowData: []}]});
      } else if (request.updateSheetProperties) {
        const patch = request.updateSheetProperties.properties;
        Object.assign(next.sheets.find((sheet) => sheet.properties.sheetId === patch.sheetId).properties.gridProperties, patch.gridProperties);
      } else if (request.updateCells) {
        assert.equal(request.updateCells.fields, "userEnteredValue");
        const {range, rows} = request.updateCells;
        const sheet = next.sheets.find((item) => item.properties.sheetId === range.sheetId);
        rows[0].values.forEach((cell, column) => {
          setCell(sheet, range.startRowIndex, range.startColumnIndex + column, cell);
          if (!Object.hasOwn(cell, "userEnteredValue")) {
            delete sheet.data[0].rowData[range.startRowIndex].values[range.startColumnIndex + column].userEnteredValue;
          }
        });
      } else if (request.createDeveloperMetadata) {
        const marker = request.createDeveloperMetadata.developerMetadata;
        const sheet = next.sheets.find((item) => item.properties.sheetId === marker.location.sheetId);
        (sheet.developerMetadata ??= []).push({...marker, metadataId: nextMetadataId++});
      } else if (request.updateDeveloperMetadata) {
        const update = request.updateDeveloperMetadata;
        const id = update.dataFilters[0].developerMetadataLookup.metadataId;
        const marker = next.sheets.flatMap((sheet) => sheet.developerMetadata ?? []).find((item) => item.metadataId === id);
        assert.ok(marker);
        Object.assign(marker, update.developerMetadata);
      } else assert.fail(`Unexpected destructive or unsupported request: ${JSON.stringify(request)}`);
    }
    service.state = next;
    await service.onMutation?.();
    if (service.loseAcknowledgement) throw new Error("acknowledgement lost");
    return {data: {spreadsheetId: workbookId}};
  };
  return service;
};
module.exports = {clone, content, setCell, sheetsService};
