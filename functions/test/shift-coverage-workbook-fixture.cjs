"use strict";
const {Timestamp} = require("@google-cloud/firestore");
const {createShiftSheetsConfig} = require("../lib/shift-sheets-config.js");
const {createShiftSheetsAdapter} = require("../lib/shift-sheets.js");
const {shiftSheetsISOWeekKey} = require("../lib/shift-sheets-human-layout.js");
const {coverageSheetRow} = require("../lib/shift-coverage-effects.js");
const {createProvisionalCoverageEffectsWorker} = require("../lib/shift-coverage-effects-worker.js");
const {sheetsService} = require("./shift-sheets-api-fixture.cjs");

// Only the fixed emulator plus an in-memory workbook; no Google client or credentials.
module.exports.createCoverageWorkbookFixture = async (db, nowMillis) => {
  const root = "develop/plus-collections";
  const config = createShiftSheetsConfig({environment: "develop", workbooks: {develop: "coverage-rehearsal-book"}});
  const rows = (await db.collection(`${root}/shifts`).get()).docs.map((d) => coverageSheetRow(d.id, d.data()));
  const members = (await db.collection(`${root}/users`).get()).docs.map((d) => ({userId: d.id,
    name: d.data().displayName, phone: d.data().phoneNumber ?? ""}));
  for (const row of rows.filter((r) => r.type === "delivery")) {
    await db.doc(`${root}/deliveryCalendar/${shiftSheetsISOWeekKey(row.date)}`).set({
      deliveryDate: Timestamp.fromDate(new Date(`${row.date}T00:00:00Z`))});
  }
  const sheets = sheetsService(config.workbookId);
  await createShiftSheetsAdapter({config, sheets}).reconcile({operationId: "native-workbook-baseline", rows,
    generationRows: rows.map((r) => ({id: r.id, visibleDate: r.date,
      assignees: r.assignedUserIds.map((id) => members.find((m) => m.userId === id)),
      helper: r.helperUserId ? {userId: r.helperUserId, name: members.find((m) => m.userId === r.helperUserId).name} : null})),
    authorizeMutation: async () => {}});
  const tabs = sheets.state.sheets.map((s) => {
    const type = s.properties.title.includes("reparto") ? "delivery" : "market";
    return {title: s.properties.title, type, seasonStartYear: Number(s.properties.title.match(/(\d{4})-/)[1]),
      layout: `${type}_human`, decorations: [{rowNumber: 1,
        cells: s.data[0].rowData[0].values.map((c) => c.userEnteredValue.stringValue)}]};
  });
  const worker = createProvisionalCoverageEffectsWorker({config, sheets, tabs, nowMillis, readWorkbookVersion: async () => "1"});
  return {worker, sheets};
};
