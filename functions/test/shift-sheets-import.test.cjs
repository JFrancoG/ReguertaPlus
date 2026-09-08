"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {createShiftSheetsConfig, resolveShiftSheetsTab} = require("../lib/shift-sheets-config.js");
const {createShiftSheetsAdapter} = require("../lib/shift-sheets.js");
const {readShiftSheetsImport} = require("../lib/shift-sheets-import.js");
const {planShiftSheetsImport} = require("../lib/shift-sheets-import-plan.js");
const {clone, sheetsService, setCell} = require("./shift-sheets-api-fixture.cjs");
const config = createShiftSheetsConfig({environment: "develop", workbooks: {develop: "import-book"}});
const members = ["a", "b", "c", "d"].map((id, index) => ({userId: id, names: [`Persona ${id.toUpperCase()}`], phones: [`90000000${index}`], eligibleTypes: ["delivery", "market"]}));
const row = (date, owner, helper, changes = {}) => ({id: `shift_delivery_${date.replaceAll("-", "")}`, type: "delivery", date, rotationOwnerUserIds: [owner], assignedUserIds: [owner], helperUserId: helper, status: "planned", source: "app", origin: "planner", ...changes});
const baseline = [row("2026-08-27", "a", "b"), row("2026-09-03", "b", "c"), row("2026-09-10", "c", null)];
const sources = (rows = baseline) => rows.map((row) => ({row: clone(row), documentRevision: 5, assignmentRevision: 2, completionRevision: 0, completed: false}));
const invalid = {code: "invalid_sheets_import"};
const setup = async (rows = baseline) => {
  const service = sheetsService(config.workbookId);
  const adapter = createShiftSheetsAdapter({config, sheets: service});
  await adapter.reconcile({operationId: "fixture-export", rows, authorizeMutation: async () => {}});
  service.mutations.length = 0;
  const tabs = [...new Map(rows.map((item) => {const tab = resolveShiftSheetsTab(config, item.type, item.date); return [tab.title, {...tab, layout: "canonical", decorations: []}];})).values()];
  const input = {config, sheets: service, tabs, baseline: clone(rows), members: clone(members), readWorkbookVersion: async () => "11"};
  const edit = (date, column, value) => {
    const sheet = service.state.sheets.find((sheet) => sheet.data[0].rowData.some((row) => row.values[2]?.userEnteredValue?.stringValue === date));
    const index = sheet.data[0].rowData.findIndex((row) => row.values[2]?.userEnteredValue?.stringValue === date);
    setCell(sheet, index, column, {userEnteredValue: {stringValue: value}});
  };
  return {service, input, edit, read: () => readShiftSheetsImport(input)};
};
const human = (f, type, season, rows, decorations = []) => {
  const tab = f.input.tabs.find((tab) => tab.type === type && tab.seasonStartYear === season);
  tab.layout = `${type}_human`;
  tab.decorations = decorations;
  const sheet = f.service.state.sheets.find((sheet) => sheet.properties.title === tab.title);
  sheet.data = [{rowData: rows.map((row) => ({values: row.map((value) => ({userEnteredValue: typeof value === "number" ? {numberValue: value} : {stringValue: value}}))}))}];
};

test("exported canonical rows round-trip across seasons without any write", async () => {
  const f = await setup();
  const observation = await f.read();
  assert.deepEqual(observation.assignments.map((item) => item.id), baseline.map((item) => item.id));
  assert.deepEqual(observation.missingIds, []);
  assert.deepEqual(planShiftSheetsImport({observation, source: sources()}).patches, []);
  assert.equal(f.service.mutations.length, 0);
  assert.ok(f.service.reads.every((request) => request.spreadsheetId === "import-book"));
});

test("manual lead edit guards three neighbors and updates the previous season helper", async () => {
  const f = await setup();
  f.edit("2026-09-03", 5, '["d"]');
  const observation = await f.read();
  const source = sources();
  const original = clone(source);
  const plan = planShiftSheetsImport({observation, source});
  assert.deepEqual(plan.patches, [
    {id: baseline[0].id, assignedUserIds: ["a"], helperUserId: "d", status: "planned"},
    {id: baseline[1].id, assignedUserIds: ["d"], helperUserId: "c", status: "planned"},
  ]);
  assert.deepEqual(plan.sourceGuards.map((item) => item.row.id), baseline.map((item) => item.id));
  assert.deepEqual(source, original);
  assert.ok(plan.patches.every((patch) => !Object.keys(patch).some((key) => /owner|round|cursor|completion/i.test(key))));
  assert.equal(f.service.mutations.length, 0);
});

test("completed predecessor history stays frozen and completion revisions bind the plan", async () => {
  const f = await setup();
  f.edit("2026-09-03", 5, '["d"]');
  const observation = await f.read();
  const source = sources();
  source[0].completed = true; source[0].completionRevision = 1;
  const plan = planShiftSheetsImport({observation, source});
  assert.deepEqual(plan.patches.map((item) => item.id), [baseline[1].id]);
  source[0].completionRevision += 1;
  assert.equal(plan.sourceGuards[0].completionRevision, 1);
  assert.notEqual(plan.planDigest, planShiftSheetsImport({observation, source}).planDigest);
});

test("adjacent equal leads, incomplete neighborhoods and edits to completed shifts are rejected", async () => {
  for (const newLead of ["a", "c"]) {
    const f = await setup(); f.edit("2026-09-03", 5, JSON.stringify([newLead]));
    const observation = await f.read();
    assert.throws(() => planShiftSheetsImport({observation, source: sources()}), invalid);
  }
  const edge = await setup(); edge.edit("2026-08-27", 5, '["d"]');
  const edgeRead = await edge.read();
  assert.throws(() => planShiftSheetsImport({observation: edgeRead, source: sources()}), invalid);
  const f = await setup(); f.edit("2026-09-03", 5, '["d"]');
  const source = sources(); source[1].completed = true; source[1].completionRevision = 1;
  const observation = await f.read();
  assert.throws(() => planShiftSheetsImport({observation, source}), invalid);
});

test("missing or failed tabs never produce a partial successful import", async () => {
  const f = await setup();
  f.service.state.sheets.pop();
  await assert.rejects(f.read(), invalid);
  const g = await setup(); const get = g.service.get;
  g.service.get = async (request, options) => { const result = await get(request, options); if (request.ranges) result.data.sheets.pop(); return result; };
  await assert.rejects(g.read(), {code: "sheets_read_incomplete"});
  assert.equal(f.service.mutations.length + g.service.mutations.length, 0);
});

test("an absent row is an audit discrepancy, never a deletion instruction", async () => {
  const f = await setup();
  f.service.state.sheets[0].data[0].rowData.splice(1, 1);
  const observation = await f.read();
  assert.deepEqual(observation.missingIds, [baseline[0].id]);
  assert.throws(() => planShiftSheetsImport({observation, source: sources()}), invalid);
  assert.equal("deletes" in observation, false);
  assert.equal(f.service.mutations.length, 0);
});

test("immutable owner, helper, source, provenance and digest cells cannot be imported", async () => {
  for (const column of [0, 1, 3, 4, 6, 8, 9, 10]) {
    const f = await setup(); f.edit("2026-09-03", column, "forged");
    await assert.rejects(f.read());
    assert.equal(f.service.mutations.length, 0);
  }
});

test("human delivery rows use explicit decoration mapping and calendar dates", async () => {
  const f = await setup();
  human(f, "delivery", 2025, [["Título"], ["AGOSTO"], ["27/08/2026", "Persona A", "900000000", "", "", "nota"]],
    [{rowNumber: 1, cells: ["Título"]}, {rowNumber: 2, cells: ["AGOSTO"]}]);
  const serial = (Date.UTC(2026, 8, 3) - Date.UTC(1899, 11, 30)) / 86400000;
  human(f, "delivery", 2026, [[serial, "Persona B", "900000001", "", "lo hace Persona D"], ["10/09/2026", "Persona C", "900000002"]]);
  const observation = await f.read();
  assert.deepEqual(observation.assignments[1].assignedUserIds, ["d"]);
  assert.equal(observation.assignments[0].date, "2026-08-27");
  assert.equal(planShiftSheetsImport({observation, source: sources()}).patches[0].helperUserId, "d");
});

test("changed or unmapped headings and unresolved replacements reject the whole human read", async () => {
  for (const replacement of ["lo hace Desconocido", "lo hace"]) {
    const f = await setup();
    human(f, "delivery", 2026, [["03/09/2026", "Persona B", "900000001", "", replacement]]);
    await assert.rejects(f.read(), invalid);
  }
  const f = await setup();
  human(f, "delivery", 2025, [["Título cambiado"]], [{rowNumber: 1, cells: ["Título"]}]);
  await assert.rejects(f.read(), invalid);
  f.input.tabs[0].decorations = [];
  await assert.rejects(f.read());
});

test("duplicate names, conflicting phones and ineligible replacements never fall back", async () => {
  const f = await setup();
  human(f, "delivery", 2026, [["03/09/2026", "Persona B", "900000001", "", "lo hace Persona D"]]);
  f.input.members[3].eligibleTypes = [];
  await assert.rejects(f.read(), invalid);
  f.input.members[3].eligibleTypes = ["delivery"];
  f.input.members[2].names.push("Persona D");
  await assert.rejects(f.read(), invalid);
  f.input.members[2].names.pop();
  f.input.members[1].phones = ["900000099"];
  await assert.rejects(f.read(), invalid);
});

const marketRow = {id: "shift_market_20260906", type: "market", date: "2026-09-06", rotationOwnerUserIds: ["a", "b", "c"], assignedUserIds: ["a", "b", "c"], helperUserId: null, status: "planned", source: "app", origin: "planner"};
test("market blocks support spacing and name-only people but always require three unique assignees", async () => {
  const f = await setup([marketRow]);
  human(f, "market", 2026, [["MERCADO"], [], ["06/09/2026"], ["Persona A"], ["Persona B", "900000001"], ["Persona C", "900000002"], []], [{rowNumber: 1, cells: ["MERCADO"]}]);
  assert.deepEqual((await f.read()).assignments[0].assignedUserIds, ["a", "b", "c"]);
  f.service.state.sheets[0].data[0].rowData.splice(5, 1);
  await assert.rejects(f.read(), invalid);
  assert.equal(f.service.mutations.length, 0);
});

test("wrong environment mapping, duplicate dates and formulas reject import", async () => {
  const f = await setup(); f.input.tabs[0].title = "unapproved";
  await assert.rejects(f.read(), invalid);
  const g = await setup();
  g.service.state.sheets[0].data[0].rowData.push(clone(g.service.state.sheets[0].data[0].rowData[1]));
  await assert.rejects(g.read(), invalid);
  const h = await setup();
  setCell(h.service.state.sheets[0], 1, 5, {userEnteredValue: {formulaValue: '=CONCAT("a")'}});
  await assert.rejects(h.read(), invalid);
});

test("a changing Drive version or tampered import/source rejects the review plan", async () => {
  const f = await setup(); let revision = 11; f.input.readWorkbookVersion = async () => String(revision++);
  await assert.rejects(f.read(), invalid);
  f.input.readWorkbookVersion = async () => "13";
  const observation = await f.read();
  const forged = clone(observation); forged.assignments[1].assignedUserIds = ["d"];
  assert.throws(() => planShiftSheetsImport({observation: forged, source: sources()}), invalid);
  const changed = sources(); changed[1].row.helperUserId = "a";
  assert.throws(() => planShiftSheetsImport({observation, source: changed}), invalid);
});

test("caller edits during I/O cannot alter the detached import mapping", async () => {
  const f = await setup();
  const get = f.service.get;
  f.service.get = async (...args) => { f.input.baseline[0].assignedUserIds = ["d"]; f.input.tabs.length = 0; f.input.members.length = 0; return get(...args); };
  const observation = await f.read();
  assert.equal(observation.assignments.length, 3);
  assert.deepEqual(observation.assignments[0].assignedUserIds, ["a"]);
});


test("unchanged historical assignees may be inactive but new assignments must be eligible", async () => {
  const f = await setup();
  f.input.members[0].eligibleTypes = [];
  assert.equal((await f.read()).assignments.length, 3);
  f.input.members[3].eligibleTypes = [];
  f.edit("2026-09-03", 5, '["d"]');
  await assert.rejects(f.read(), invalid);
});

test("status changes remain assignment-only and cannot open a swap workflow", async () => {
  const f = await setup(); f.edit("2026-09-03", 7, "confirmed");
  const observation = await f.read();
  const plan = planShiftSheetsImport({observation, source: sources()});
  assert.equal(plan.patches.length, 1);
  assert.equal(plan.patches[0].status, "confirmed");
  assert.deepEqual(plan.patches[0].assignedUserIds, ["b"]);
  f.edit("2026-09-03", 7, "swap_pending");
  const pending = await f.read();
  assert.throws(() => planShiftSheetsImport({observation: pending, source: sources()}), invalid);
});

test("a partial configured union never reports absent rows from unselected seasons", async () => {
  const f = await setup();
  f.input.tabs = f.input.tabs.filter((tab) => tab.seasonStartYear === 2026);
  const observation = await f.read();
  assert.equal(observation.assignments.length, 2);
  assert.deepEqual(observation.missingIds, []);
  assert.deepEqual(planShiftSheetsImport({observation, source: sources()}).patches, []);
});

test("market replacement stays separate from immutable owners and rejects duplicate participants", async () => {
  const f = await setup([marketRow]);
  human(f, "market", 2026, [["06/09/2026"], ["Persona A", "900000000", "lo hace Persona D"], ["Persona B", "900000001"], ["Persona C", "900000002"]]);
  const observation = await f.read();
  const plan = planShiftSheetsImport({observation, source: sources([marketRow])});
  assert.deepEqual(plan.patches[0].assignedUserIds, ["d", "b", "c"]);
  assert.deepEqual(plan.sourceGuards[0].row.rotationOwnerUserIds, ["a", "b", "c"]);
  f.service.state.sheets[0].data[0].rowData[2] = clone(f.service.state.sheets[0].data[0].rowData[1]);
  await assert.rejects(f.read(), invalid);
});

test("human dates cannot overflow calendars or silently move into another season", async () => {
  for (const date of ["31/09/2026", "31/08/2026", "2026-09-03T00:00:00Z"]) {
    const f = await setup();
    human(f, "delivery", 2026, [[date, "Persona B", "900000001"]]);
    await assert.rejects(f.read());
    assert.equal(f.service.mutations.length, 0);
  }
});


test("readable market exports accept Spanish dates and retain inert annotations/formulas", async () => {
  const next = {...marketRow, id: "shift_market_20261004", date: "2026-10-04"};
  const f = await setup([marketRow, next]);
  human(f, "market", 2026, [["6 DE SEPTIEMBRE DE 2026", "Nota de cabecera"],
    ["Persona A", "900000000", "Llevar cajas"], ["Persona B", "900000001"], ["Persona C", "900000002"],
    ["4 DE OCTUBRE DE 2026"], ["Persona A"], ["Persona B"], ["Persona C"]]);
  const sheet = f.service.state.sheets[0];
  setCell(sheet, 2, 2, {userEnteredValue: {formulaValue: '=CONCAT("lo hace Persona D")'}, effectiveValue: {stringValue: "lo hace Persona D"}});
  setCell(sheet, 0, 2, {userEnteredValue: {formulaValue: "=1+2"}});
  const original = clone(f.service.state);
  const observation = await f.read();
  assert.deepEqual(observation.assignments.map(({date, assignedUserIds}) => ({date, assignedUserIds})),
    [{date: "2026-09-06", assignedUserIds: ["a", "b", "c"]}, {date: "2026-10-04", assignedUserIds: ["a", "b", "c"]}]);
  assert.deepEqual(planShiftSheetsImport({observation, source: sources([marketRow, next])}).patches, []);
  assert.deepEqual(f.service.state, original);
  assert.equal(f.service.mutations.length, 0);
});

test("human annotation formulas cannot change assignments and direct names still yield cross-season patches", async () => {
  const f = await setup();
  human(f, "delivery", 2025, [["27/08/2026", "Persona A", "900000000", "nota", "Llevar cajas", "35"]]);
  human(f, "delivery", 2026, [["03/09/2026", "Persona D", "900000003"], ["10/09/2026", "Persona C", "900000002"]]);
  const sheet = f.service.state.sheets.find((sheet) => sheet.properties.title.endsWith("2026-27"));
  for (const column of [3, 4, 5]) setCell(sheet, 0, column, {userEnteredValue: {formulaValue: '=CONCAT("lo hace Persona B")'}});
  const original = clone(f.service.state);
  const observation = await f.read();
  assert.deepEqual(planShiftSheetsImport({observation, source: sources()}).patches, [
    {id: baseline[0].id, assignedUserIds: ["a"], helperUserId: "d", status: "planned"},
    {id: baseline[1].id, assignedUserIds: ["d"], helperUserId: "c", status: "planned"},
  ]);
  assert.deepEqual(f.service.state, original);
});

test("visible delivery overrides resolve only from the detached trusted calendar", async () => {
  const f = await setup();
  human(f, "delivery", 2025, [["28/08/2026", "Persona A", "900000000"]]);
  await assert.rejects(f.read(), invalid, "same week alone is not authority");
  f.input.deliveryCalendar = [{weekKey: "2026-W35", date: "2026-08-28"}];
  const originalGet = f.service.get;
  f.service.get = async (...args) => { f.input.deliveryCalendar[0].date = "2026-08-25"; return originalGet(...args); };
  const observed = await f.read();
  assert.equal(observed.assignments[0].date, "2026-08-27");
  assert.equal(observed.assignments[0].id, baseline[0].id);
  assert.deepEqual(planShiftSheetsImport({observation: observed, source: sources()}).patches, []);
  await assert.rejects(f.read(), invalid);
  f.input.deliveryCalendar = [{weekKey: "2026-W34", date: "2026-08-28"}];
  await assert.rejects(f.read(), invalid);
  f.input.deliveryCalendar = [{weekKey: "2026-W35", date: "2026-08-28"}, {weekKey: "2026-W35", date: "2026-08-25"}];
  await assert.rejects(f.read(), invalid);
  assert.equal(f.service.mutations.length, 0);
});

test("an effective date crossing August stays in the logical September tab", async () => {
  const logical = row("2022-09-01", "a", null);
  const f = await setup([logical]);
  human(f, "delivery", 2022, [["30/08/2022", "Persona A", "900000000"]]);
  f.input.deliveryCalendar = [{weekKey: "2022-W35", date: "2022-08-30"}];
  const observation = await f.read();
  assert.deepEqual(observation.assignments[0], {id: logical.id, type: "delivery", date: "2022-09-01",
    assignedUserIds: ["a"], status: "planned", sheetName: "turnos-reparto 2022-23", rowNumber: 1});
});

test("human authority formulas, impossible Spanish dates and orphaned identities reject", async () => {
  for (const column of [0, 1, 2]) {
    const f = await setup();
    human(f, "delivery", 2025, [["27/08/2026", "Persona A", "900000000"]]);
    setCell(f.service.state.sheets[0], 0, column, {userEnteredValue: {formulaValue: "=1+2"}});
    await assert.rejects(f.read(), invalid);
  }
  for (const first of ["31 DE SEPTIEMBRE DE 2026", "6 DE INVENTADO DE 2026", ""]) {
    const f = await setup([marketRow]);
    human(f, "market", 2026, [[first], ["Persona A"], ["Persona B"], ["Persona C"]]);
    await assert.rejects(f.read());
    assert.equal(f.service.mutations.length, 0);
  }
  const f = await setup();
  human(f, "delivery", 2025, [["", "Persona A", "900000000"]]);
  await assert.rejects(f.read(), invalid);
});
