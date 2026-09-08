"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {createShiftSheetsConfig} = require("../lib/shift-sheets-config.js");
const {createShiftSheetsAdapter} = require("../lib/shift-sheets.js");
const {readShiftSheetsImport} = require("../lib/shift-sheets-import.js");
const {clone, content, setCell, sheetsService} = require("./shift-sheets-api-fixture.cjs");
const config = createShiftSheetsConfig({environment: "develop", workbooks: {develop: "book-development"}});
const members = ["Ana", "Bea", "Celia"].map((name, index) => ({userId: `member-${index}`,
  names: [name], phones: [`60000000${index}`], eligibleTypes: ["delivery", "market"]}));
const row = (id, date, type = "delivery", changes = {}) => ({id, date, type,
  rotationOwnerUserIds: type === "delivery" ? ["member-0"] : members.map((m) => m.userId),
  assignedUserIds: type === "delivery" ? ["member-0"] : members.map((m) => m.userId),
  helperUserId: type === "delivery" ? "member-1" : null,
  status: "planned", source: "app", origin: "planner", ...changes});
const display = (rows) => rows.map((item) => ({id: item.id, visibleDate: item.date,
  assignees: item.assignedUserIds.map((id) => { const member = members.find((m) => m.userId === id);
    return {userId: id, name: member.names[0], phone: member.phones[0]}; }),
  helper: item.helperUserId ? {userId: item.helperUserId, name: members.find((m) => m.userId === item.helperUserId).names[0]} : null}));
const fixture = () => { const sheets = sheetsService(); const adapter = createShiftSheetsAdapter({config, sheets});
  let authorizations = 0;
  return {sheets, adapter, get authorizations() {return authorizations;},
    run: (operationId, rows, generationRows = display(rows), extra = {}) => adapter.reconcile({operationId, rows, generationRows,
      authorizeMutation: async () => { authorizations++; }, ...extra})}; };

test("readable generation atomically creates seasonal tabs and round-trips through the reviewed importer", async () => {
  const f = fixture();
  const rows = [row("shift_delivery_20260831", "2026-08-31"), row("shift_delivery_20260909", "2026-09-09"),
    row("shift_market_20260905", "2026-09-05", "market")];
  const labels = display(rows); labels[0].visibleDate = "2026-09-02";
  assert.equal((await f.run("human-generation", rows, labels)).kind, "verified");
  assert.equal(f.sheets.mutations.length, 1); assert.equal(f.authorizations, 1);
  const sheets = f.sheets.state.sheets;
  assert.deepEqual(sheets.map((sheet) => sheet.properties.title), ["turnos-mercado 2026-27", "turnos-reparto 2025-26", "turnos-reparto 2026-27"]);
  const delivery = sheets[1]; const market = sheets[0];
  assert.deepEqual(delivery.data[0].rowData[0].values.map((c) => c.userEnteredValue.stringValue),
    ["Fecha", "Persona", "Teléfono", "Notas", "Cambio", "Ayuda"]);
  assert.equal(content(delivery, 1, 0).stringValue, "02/09/2026");
  assert.equal(content(delivery, 1, 1).stringValue, "Ana");
  assert.equal(content(delivery, 1, 2).stringValue, "600000000");
  assert.equal(content(delivery, 1, 5).stringValue, "Bea");
  assert.equal(content(market, 1, 0).stringValue, "05/09/2026");
  assert.deepEqual([2, 3, 4].map((index) => content(market, index, 0).stringValue), ["Ana", "Bea", "Celia"]);
  assert.equal(market.data[0].rowData.length, 5, "header plus one four-row block");
  const imported = await readShiftSheetsImport({config, sheets: f.sheets,
    tabs: sheets.map((sheet) => {const type = sheet.properties.title.includes("reparto") ? "delivery" : "market";
      return {title: sheet.properties.title, type, seasonStartYear: sheet.properties.title.includes("2025") ? 2025 : 2026,
        layout: `${type}_human`, decorations: [{rowNumber: 1,
          cells: sheet.data[0].rowData[0].values.map((c) => c.userEnteredValue.stringValue)}]}; }),
    baseline: rows, members, deliveryCalendar: [{weekKey: "2026-W36", date: "2026-09-02"}], readWorkbookVersion: async () => "10"});
  assert.equal(imported.assignments.length, 3); assert.deepEqual(imported.missingIds, []);
  for (const assignment of imported.assignments) assert.deepEqual(assignment.assignedUserIds, rows.find((r) => r.id === assignment.id).assignedUserIds);
});

test("carryover append preserves manual notes, formulas, formats and prior assignments while refreshing the helper", async () => {
  const f = fixture(); const inherited = row("inherited", "2027-09-01");
  await f.run("first", [inherited]);
  let sheet = f.sheets.state.sheets[0];
  setCell(sheet, 1, 3, {userEnteredValue: {formulaValue: "=1+2"}, note: "Conservar"});
  setCell(sheet, 1, 4, {userEnteredValue: {stringValue: "Traer cajas"}});
  setCell(sheet, 1, 1, {userEnteredFormat: {backgroundColor: {red: 0.5}}});
  const preserved = clone(sheet.data[0].rowData[1].values.slice(0, 5));
  const changed = {...inherited, helperUserId: "member-2"};
  const rows = [changed, row("next", "2027-09-08")];
  assert.equal((await f.run("next-round", rows)).kind, "verified");
  sheet = f.sheets.state.sheets[0];
  assert.deepEqual(sheet.data[0].rowData[1].values.slice(0, 5), preserved);
  assert.equal(content(sheet, 1, 5).stringValue, "Celia");
  assert.equal(content(sheet, 2, 0).stringValue, "08/09/2027");
  assert.equal(sheet.data[0].rowData.length, 3);
  assert.equal((await f.run("next-round", rows)).kind, "verified");
  assert.equal(f.sheets.mutations.length, 2);
});

test("market append preserves annotations and existing later blocks", async () => {
  const f = fixture(); const later = row("later", "2026-10-03", "market");
  await f.run("later", [later]);
  setCell(f.sheets.state.sheets[0], 3, 2, {userEnteredValue: {formulaValue: "=7"}, note: "Keep"});
  setCell(f.sheets.state.sheets[0], 1, 2, {userEnteredValue: {stringValue: "Lo hace Celia"}});
  assert.equal((await f.run("same-date-heading-note", [later])).kind, "verified");
  const before = clone(f.sheets.state.sheets[0].data[0].rowData.slice(1, 5));
  assert.equal((await f.run("earlier", [row("earlier", "2026-09-05", "market")])).kind, "verified");
  const sheet = f.sheets.state.sheets[0];
  assert.deepEqual(sheet.data[0].rowData.slice(1, 5), before);
  assert.equal(content(sheet, 5, 0).stringValue, "05/09/2026");
  assert.equal(content(sheet, 8, 0).stringValue, "Celia");
  assert.equal(sheet.data[0].rowData.length, 9);
});

test("changed people, pending replacement, duplicate dates and incompatible layouts stop before authorization", async () => {
  for (const modify of [
    (sheet) => setCell(sheet, 1, 1, {userEnteredValue: {stringValue: "Editada"}}),
    (sheet) => setCell(sheet, 1, 4, {userEnteredValue: {stringValue: "Lo hace Celia"}}),
    (sheet) => setCell(sheet, 1, 0, {userEnteredValue: {stringValue: "03/09/2026"}}),
    (sheet) => setCell(sheet, 1, 1, {userEnteredValue: {formulaValue: '="Ana"'}}),
    (sheet) => setCell(sheet, 0, 0, {userEnteredValue: {stringValue: "shiftId"}}),
    (sheet) => {sheet.data[0].rowData.push(clone(sheet.data[0].rowData[1]));},
  ]) {
    const f = fixture(); const rows = [row("one", "2026-09-02")];
    await f.run("before", rows); modify(f.sheets.state.sheets[0]); const before = clone(f.sheets.state);
    await assert.rejects(f.run("after", rows));
    assert.equal(f.authorizations, 1); assert.equal(f.sheets.mutations.length, 1); assert.deepEqual(clone(f.sheets.state), before);
  }
});

test("protected or merged appends, exhausted grids and invalid display bindings cannot submit", async () => {
  for (const modify of [
    (sheet) => {sheet.protectedRanges = [{range: {sheetId: sheet.properties.sheetId, startRowIndex: 2}}];},
    (sheet) => {sheet.merges = [{sheetId: sheet.properties.sheetId, startRowIndex: 2, endRowIndex: 3}];},
    (sheet) => {sheet.properties.gridProperties.rowCount = 2001;},
  ]) {
    const f = fixture(); await f.run("initial", [row("one", "2026-09-02")]); modify(f.sheets.state.sheets[0]);
    await assert.rejects(f.run("next", [row("two", "2026-09-09")])); assert.equal(f.authorizations, 1);
  }
  for (const modify of [
    (labels) => {labels[0].assignees[0].userId = "wrong";},
    (labels) => {labels[0].assignees[0].name = " ";},
    (labels) => {labels[0].visibleDate = "2026-09-10";},
    (labels) => {labels[0].helper = null;},
    (labels) => {labels.push(clone(labels[0]));},
  ]) {
    const f = fixture(); const rows = [row("one", "2026-09-02")]; const labels = display(rows); modify(labels);
    await assert.rejects(f.run("invalid", rows, labels)); assert.equal(f.sheets.reads.length, 0); assert.equal(f.authorizations, 0);
  }
});

test("generation recovers lost acknowledgements without resend and binds literal labels to operation identity", async () => {
  const f = fixture(); const rows = [row("one", "2026-09-02")]; const labels = display(rows);
  f.sheets.loseAcknowledgement = true; f.sheets.onMutation = async () => {f.sheets.failRead = true;};
  assert.equal((await f.run("lost", rows, labels)).kind, "ambiguous");
  f.sheets.failRead = false;
  assert.equal((await f.adapter.inspect({operationId: "lost", rows, generationRows: labels})).kind, "verified");
  assert.equal((await f.run("lost", rows, labels)).kind, "verified");
  const changed = clone(labels); changed[0].assignees[0].phone = "";
  await assert.rejects(f.run("lost", rows, changed), {code: "sheets_marker_conflict"});
  assert.equal(f.sheets.mutations.length, 1);
  setCell(f.sheets.state.sheets[0], 1, 1, {userEnteredValue: {stringValue: "Cambió"}});
  assert.equal((await f.adapter.inspect({operationId: "lost", rows, generationRows: labels})).kind, "ambiguous");
  assert.equal(f.sheets.mutations.length, 1);
});

test("generation detaches labels before I/O and empty phones remain literal empty cells", async () => {
  const f = fixture(); const rows = [row("one", "2026-09-02")]; const labels = display(rows);
  labels[0].assignees[0].phone = ""; const get = f.sheets.get;
  f.sheets.get = async (...args) => {labels[0].assignees[0].name = "Changed"; return get(...args);};
  assert.equal((await f.run("detached", rows, labels)).kind, "verified");
  assert.equal(content(f.sheets.state.sheets[0], 1, 1).stringValue, "Ana");
  assert.equal(content(f.sheets.state.sheets[0], 1, 2), undefined);
});

test("readable growth stays bounded and clearing an obsolete helper preserves the row", async () => {
  const f = fixture(); const previous = row("one", "2026-09-02");
  await f.run("before", [previous]);
  f.sheets.state.sheets[0].properties.gridProperties.rowCount = 2;
  setCell(f.sheets.state.sheets[0], 1, 3, {userEnteredValue: {stringValue: "Lo hace Celia"}});
  const rows = [{...previous, helperUserId: null}, row("two", "2026-09-09")];
  assert.equal((await f.run("grow", rows)).kind, "verified");
  assert.equal(f.sheets.state.sheets[0].properties.gridProperties.rowCount, 3);
  assert.equal(content(f.sheets.state.sheets[0], 1, 5), undefined);
  assert.equal(content(f.sheets.state.sheets[0], 1, 1).stringValue, "Ana");
  assert.equal(content(f.sheets.state.sheets[0], 2, 0).stringValue, "09/09/2026");
});

test("colliding effective weeks and ambiguous names or phones fail before reading Sheets", async () => {
  for (const scenario of ["week", "name", "phone"]) {
    const f = fixture();
    const rows = scenario === "week" ? [row("one", "2026-09-02"), row("two", "2026-09-03")] :
      [row("one", "2026-09-05", "market")];
    const labels = display(rows);
    if (scenario === "name") labels[0].assignees[1].name = " ANA ";
    if (scenario === "phone") labels[0].assignees[1].phone = "600 000 000";
    await assert.rejects(f.run("ambiguous", rows, labels));
    assert.equal(f.sheets.reads.length, 0); assert.equal(f.sheets.mutations.length, 0);
  }
});

test("concurrent readable tab creation has one winner and never retries the rejected batch", async () => {
  const f = fixture(); const rows = [row("one", "2026-09-02")];
  let arrived = 0; let release;
  const barrier = new Promise((resolve) => {release = resolve;});
  const authorizeMutation = async () => {if (++arrived === 2) release(); await barrier;};
  const results = await Promise.all([f.run("race-a", rows, display(rows), {authorizeMutation}),
    f.run("race-b", rows, display(rows), {authorizeMutation})]);
  assert.deepEqual(results.map((r) => r.kind).sort(), ["ambiguous", "verified"]);
  assert.equal(f.sheets.mutations.length, 2); assert.equal(f.sheets.rejectedBatches, 1);
  assert.equal(f.sheets.state.sheets.length, 1);
  const loser = results[0].kind === "ambiguous" ? "race-a" : "race-b";
  assert.equal((await f.adapter.inspect({operationId: loser, rows, generationRows: display(rows)})).kind, "ambiguous");
  assert.equal(f.sheets.mutations.length, 2);
});

const historicalTab = (title, type, seasonStartYear, rows, decorations) => ({
  sheet: {properties: {title, sheetId: seasonStartYear * 2 + Number(type === "market"),
    gridProperties: {rowCount: 1000, columnCount: 26}}, data: [{rowData: rows.map((row) => ({
      values: row.map((value) => ({userEnteredValue: typeof value === "object" ? value :
        typeof value === "number" ? {numberValue: value} : {stringValue: value}})),
    }))}]},
  mapping: {title, type, seasonStartYear, layout: `${type}_human`,
    decorations: decorations.map((index) => ({rowNumber: index + 1, cells: rows[index]}))},
});

test("reviewed historical aliases, month headings and market spacing survive generation and import across two seasons", async () => {
  const historicConfig = createShiftSheetsConfig({environment: "develop", workbooks: {develop: "book-development"},
    aliases: [{type: "delivery", seasonStartYear: 2025, title: "TORRE 2025-26"},
      {type: "market", seasonStartYear: 2025, title: "MERCADO 2025-26"}]});
  const serial = (date) => (Date.parse(date) - Date.UTC(1899, 11, 30)) / 86400000;
  const deliveryRows = [row("shift_delivery_20260826", "2026-08-26"), row("shift_delivery_20260902", "2026-09-02")];
  const marketRows = [row("shift_market_20260822", "2026-08-22", "market"), row("shift_market_20260905", "2026-09-05", "market")];
  const participants = members.map((m) => [m.names[0], m.phones[0], {formulaValue: "=1+2"}]);
  const tabs = [
    historicalTab("TORRE 2025-26", "delivery", 2025, [["REPARTO 2025-26"], ["AGOSTO"],
      [serial("2026-08-26"), "Ana", "600000000", {formulaValue: "=3"}, "Anotación", {formulaValue: "=35"}]], [0, 1]),
    historicalTab("turnos-reparto 2026-27", "delivery", 2026, [["REPARTO 2026-27"], [], ["SEPTIEMBRE"],
      ["2 de septiembre de 2026", "Ana", "600000000", "nota", "", "36"]], [0, 2]),
    historicalTab("MERCADO 2025-26", "market", 2025, [["MERCADO"], ["22/8/2026"], ...participants, [], ["FIN"]], [0, 6]),
    historicalTab("turnos-mercado 2026-27", "market", 2026, [["MERCADO"], [], [], ["2026-09-05"], ...participants,
      [], [], ["SIGUIENTE MES"]], [0, 9]),
  ];
  const service = sheetsService(); service.state.sheets = tabs.map((tab) => tab.sheet);
  const before = clone(service.state.sheets);
  const generationTabs = tabs.map((tab) => tab.mapping);
  const rows = [...deliveryRows, ...marketRows, row("shift_delivery_20260909", "2026-09-09"),
    row("shift_market_20261003", "2026-10-03", "market")];
  const adapter = createShiftSheetsAdapter({config: historicConfig, sheets: service});
  const operation = {operationId: "historical-generation", rows, generationRows: display(rows), generationTabs};
  assert.equal((await adapter.reconcile({...operation, authorizeMutation: async () => {}})).kind, "verified");
  assert.equal(service.mutations.length, 1);
  for (const [index, sheet] of before.entries()) {
    assert.deepEqual(service.state.sheets[index].data[0].rowData.slice(0, sheet.data[0].rowData.length), sheet.data[0].rowData);
  }
  assert.equal(content(service.state.sheets[1], 4, 5).stringValue, "37", "new historical delivery F is the week, not a helper");
  assert.equal(content(service.state.sheets[3], 10, 0).stringValue, "03/10/2026");
  const imported = await readShiftSheetsImport({config: historicConfig, sheets: service, tabs: generationTabs,
    baseline: rows, members, readWorkbookVersion: async () => "12"});
  assert.equal(imported.assignments.length, rows.length); assert.deepEqual(imported.missingIds, []);
  assert.equal((await adapter.inspect(operation)).kind, "verified");
  assert.equal(service.mutations.length, 1);
});

test("historical adoption rejects unreviewed, stale, hidden-date and incomplete blocks before authorization", async () => {
  for (const scenario of ["absent-map", "stale-title", "hidden-date", "missing-person", "extra-person", "missing-tab", "wrong-routing"]) {
    const f = fixture();
    const tab = historicalTab("turnos-mercado 2026-27", "market", 2026,
      [["MERCADO"], ["05/09/2026"], ["Ana", "600000000"], ["Bea", "600000001"], ["Celia", "600000002"]], [0]);
    f.sheets.state.sheets = [tab.sheet];
    if (scenario === "stale-title") tab.mapping.decorations[0].cells = ["OTRO TÍTULO"];
    if (scenario === "hidden-date") tab.mapping.decorations.push({rowNumber: 2, cells: ["05/09/2026"]});
    if (scenario === "missing-person") tab.sheet.data[0].rowData.splice(3, 1);
    if (scenario === "extra-person") tab.sheet.data[0].rowData.push({values: [{userEnteredValue: {stringValue: "Cuarta persona"}}]});
    if (scenario === "missing-tab") f.sheets.state.sheets = [];
    if (scenario === "wrong-routing") tab.mapping.title = "MERCADO 2026-27";
    const rows = [row("shift_market_20260905", "2026-09-05", "market")];
    await assert.rejects(f.run(scenario, rows, display(rows), scenario === "absent-map" ? {} : {generationTabs: [tab.mapping]}),
      (error) => typeof error.code === "string", scenario);
    assert.equal(f.authorizations, 0, scenario); assert.equal(f.sheets.mutations.length, 0, scenario);
  }
});

test("historical layout is detached, digest-bound and inspect-only after lost acknowledgement", async () => {
  const f = fixture(); const tab = historicalTab("turnos-reparto 2026-27", "delivery", 2026,
    [["REPARTO"], ["02/09/2026", "Ana", "600000000", "nota", "", "36"]], [0]);
  f.sheets.state.sheets = [tab.sheet];
  const generationTabs = [tab.mapping], saved = clone(generationTabs);
  const rows = [row("shift_delivery_20260902", "2026-09-02"), row("shift_delivery_20260909", "2026-09-09")];
  f.sheets.loseAcknowledgement = true;
  const result = await f.run("history-uncertain", rows, display(rows), {generationTabs,
    authorizeMutation: async () => {generationTabs[0].decorations[0].cells[0] = "mutated caller";}});
  assert.equal(result.kind, "verified");
  assert.equal((await f.adapter.inspect({operationId: "history-uncertain", rows, generationRows: display(rows), generationTabs: saved})).kind, "verified");
  const changed = clone(saved); changed[0].decorations.push({rowNumber: 4, cells: ["new title"]});
  await assert.rejects(f.run("history-uncertain", rows, display(rows), {generationTabs: changed}), {code: "sheets_marker_conflict"});
  assert.equal(f.sheets.mutations.length, 1);
});
