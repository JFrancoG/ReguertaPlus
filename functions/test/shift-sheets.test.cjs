"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {createShiftSheetsConfig} = require("../lib/shift-sheets-config.js");
const {createShiftSheetsAdapter, planShiftSheetsMerge} = require("../lib/shift-sheets.js");

const config = createShiftSheetsConfig({environment: "develop", workbooks: {develop: "book-development"}});
const row = (id, date, changes = {}) => ({id, date, type: "delivery", rotationOwnerUserIds: ["member-a"],
  assignedUserIds: ["member-a"], helperUserId: "member-b", status: "planned", source: "app", origin: "planner", ...changes});
const {clone, content, setCell, sheetsService} = require("./shift-sheets-api-fixture.cjs");

const fixture = () => {
  const sheets = sheetsService();
  const adapter = createShiftSheetsAdapter({config, sheets});
  let authorizations = 0;
  return {sheets, adapter, get authorizations() { return authorizations; },
    reconcile: (operationId, rows, extra = {}) => adapter.reconcile({operationId, rows,
      authorizeMutation: async () => { authorizations += 1; }, ...extra})};
};

test("one authorized atomic batch creates two seasons and records exact read-back", async () => {
  const f = fixture();
  const result = await f.reconcile("activation-1", [row("delivery-aug", "2026-08-26"), row("delivery-sep", "2026-09-02")]);
  assert.equal(result.kind, "verified");
  assert.equal(result.readBackDigest, result.projectionDigest);
  assert.equal(f.authorizations, 1);
  assert.equal(f.sheets.mutations.length, 1);
  assert.deepEqual(f.sheets.state.sheets.map((sheet) => sheet.properties.title), ["turnos-reparto 2025-26", "turnos-reparto 2026-27"]);
  const first = f.sheets.state.sheets[0];
  assert.deepEqual(first.data[0].rowData[0].values.map((cell) => cell.userEnteredValue.stringValue),
    ["shiftId", "type", "date", "seasonStartYear", "rotationOwnerUserIds", "assignedUserIds", "helperUserId", "status", "source", "origin", "rowDigest"]);
  assert.equal(content(first, 1, 0).stringValue, "delivery-aug");
  assert.equal(content(first, 1, 2).stringValue, "2026-08-26");
  assert.equal(content(first, 1, 4).stringValue, '["member-a"]');
  assert.equal(first.developerMetadata.length, 1);
});

test("carryover merge preserves existing rows, manual columns and cell formatting; replay sends nothing", async () => {
  const f = fixture();
  const inherited = row("inherited", "2027-09-01");
  await f.reconcile("initial", [inherited]);
  const sheet = f.sheets.state.sheets[0];
  setCell(sheet, 1, 11, {userEnteredValue: {formulaValue: "=1+2"}});
  setCell(sheet, 1, 5, {userEnteredFormat: {backgroundColor: {red: 0.7}}});
  const result = await f.reconcile("following-round", [row("new-owner", "2027-09-08")]);
  assert.equal(result.kind, "verified");
  const current = f.sheets.state.sheets[0];
  assert.equal(content(current, 1, 0).stringValue, "inherited");
  assert.equal(content(current, 2, 0).stringValue, "new-owner");
  assert.equal(content(current, 1, 11).formulaValue, "=1+2");
  assert.equal(current.data[0].rowData[1].values[5].userEnteredFormat.backgroundColor.red, 0.7);
  assert.equal(current.developerMetadata.length, 1, "only latest marker is retained per tab");
  const writes = f.sheets.mutations.length;
  assert.equal((await f.reconcile("following-round", [row("new-owner", "2027-09-08")])).kind, "verified");
  assert.equal(f.sheets.mutations.length, writes);
});

test("manual assignment changes and ambiguous identities fail before any mutation", async () => {
  const f = fixture();
  const value = row("existing", "2026-09-02");
  await f.reconcile("initial", [value]);
  setCell(f.sheets.state.sheets[0], 1, 5, {userEnteredValue: {stringValue: '["manual-member"]'}});
  const baseline = clone(f.sheets.state);
  await assert.rejects(f.reconcile("next", [value]), {code: "sheets_manual_conflict"});
  assert.deepEqual(f.sheets.state, baseline);
  assert.equal(f.sheets.mutations.length, 1);
  await assert.rejects(f.reconcile("duplicate", [value, value]), {code: "duplicate_sheets_row"});
  const duplicate = clone(baseline);
  duplicate.sheets[0].data[0].rowData.push(clone(duplicate.sheets[0].data[0].rowData[1]));
  assert.throws(() => planShiftSheetsMerge(config, duplicate, [value]), {code: "duplicate_sheets_row"});
});

test("formula/protected/merged cells and old layouts cannot be overwritten", async () => {
  for (const modification of [
    (sheet) => { sheet.protectedRanges = [{range: {sheetId: sheet.properties.sheetId}}]; },
    (sheet) => { sheet.merges = [{sheetId: sheet.properties.sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 2}]; },
    (sheet) => { setCell(sheet, 0, 0, {userEnteredValue: {stringValue: "LEGACY HUMAN LAYOUT"}}); },
  ]) {
    const f = fixture();
    await f.reconcile("initial", [row("existing", "2026-09-02")]);
    modification(f.sheets.state.sheets[0]);
    await assert.rejects(f.reconcile("next", [row("new", "2026-09-09")]));
    assert.equal(f.sheets.mutations.length, 1);
  }
  const f = fixture();
  const value = row("existing", "2026-09-02");
  await f.reconcile("initial", [value]);
  setCell(f.sheets.state.sheets[0], 1, 5, {userEnteredValue: {formulaValue: '=CONCATENATE("member-a")'}});
  await assert.rejects(f.reconcile("next", [value]));
  assert.equal(f.sheets.mutations.length, 1);
});

test("acknowledgement loss is verified only from cells plus marker, never retried internally", async () => {
  const f = fixture();
  f.sheets.loseAcknowledgement = true;
  const rows = [row("existing", "2026-09-02")];
  assert.equal((await f.reconcile("lost-ack", rows)).kind, "verified");
  assert.equal(f.sheets.mutations.length, 1);
  f.sheets.failRead = true;
  assert.deepEqual(await f.adapter.inspect({operationId: "lost-ack", rows}), {
    kind: "ambiguous", operationId: "lost-ack", reason: "read_back_unavailable",
  });
  assert.equal(f.sheets.mutations.length, 1);
  f.sheets.failRead = false;
  assert.equal((await f.adapter.inspect({operationId: "lost-ack", rows})).kind, "verified");
});

test("unknown submission stays ambiguous and inspect does not resend", async () => {
  const f = fixture();
  f.sheets.rejectBeforeApply = true;
  const rows = [row("existing", "2026-09-02")];
  assert.equal((await f.reconcile("unknown", rows)).kind, "ambiguous");
  assert.equal((await f.adapter.inspect({operationId: "unknown", rows})).kind, "ambiguous");
  assert.equal(f.sheets.mutations.length, 1);
  assert.equal(f.sheets.state.sheets.length, 0);
});

test("read-back discrepancy or reused operation digest never authorizes another batch", async () => {
  const f = fixture();
  const rows = [row("existing", "2026-09-02")];
  f.sheets.onMutation = async () => setCell(f.sheets.state.sheets[0], 1, 6, {userEnteredValue: {stringValue: "someone-else"}});
  assert.equal((await f.reconcile("mismatch", rows)).kind, "ambiguous");
  assert.equal(f.sheets.mutations.length, 1);
  const clean = fixture();
  await clean.reconcile("stable-id", rows);
  await assert.rejects(clean.reconcile("stable-id", [row("existing", "2026-09-02", {helperUserId: "other-helper"})]), {code: "sheets_marker_conflict"});
  assert.equal(clean.sheets.mutations.length, 1);
});

test("authorization rejection, abort and oversized grid all stop before mutation", async () => {
  const f = fixture();
  const rows = [row("existing", "2026-09-02")];
  await assert.rejects(f.reconcile("unauthorized", rows, {authorizeMutation: async () => { throw new Error("epoch changed"); }}));
  await assert.rejects(f.reconcile("aborted", rows, {signal: AbortSignal.abort()}), {code: "sheets_submission_aborted"});
  assert.equal(f.sheets.mutations.length, 0);
  f.sheets.state.sheets.push({properties: {sheetId: 2, title: "turnos-reparto 2026-27", gridProperties: {rowCount: 100000, columnCount: 26}}});
  await assert.rejects(f.reconcile("too-big", rows), {code: "sheets_limit"});
  assert.equal(f.sheets.mutations.length, 0);
});

test("caller mutation during initial read cannot alter submitted assignments", async () => {
  const f = fixture();
  const rows = [row("existing", "2026-09-02")];
  const get = f.sheets.get;
  f.sheets.get = async (...args) => {
    rows[0].assignedUserIds[0] = "changed-after-call";
    return get(...args);
  };
  assert.equal((await f.reconcile("detached", rows)).kind, "verified");
  assert.equal(content(f.sheets.state.sheets[0], 1, 5).stringValue, '["member-a"]');
});

test("market projects three explicit owners and assignees on one shift row", async () => {
  const f = fixture();
  const value = row("market-one", "2026-09-05", {type: "market", rotationOwnerUserIds: ["a", "b", "c"],
    assignedUserIds: ["a", "replacement", "c"], helperUserId: null});
  assert.equal((await f.reconcile("market", [value])).kind, "verified");
  const sheet = f.sheets.state.sheets[0];
  assert.equal(sheet.properties.title, "turnos-mercado 2026-27");
  assert.equal(sheet.data[0].rowData.length, 2);
  assert.equal(content(sheet, 1, 4).stringValue, '["a","b","c"]');
  assert.equal(content(sheet, 1, 5).stringValue, '["a","replacement","c"]');
});

test("a grid dimension change between discovery and bounded read stops before append", async () => {
  const f = fixture();
  await f.reconcile("initial", [row("existing", "2026-09-02")]);
  const get = f.sheets.get;
  f.sheets.get = async (...args) => {
    const result = await get(...args);
    if (args[0].ranges) result.data.sheets[0].properties.gridProperties.rowCount += 1;
    return result;
  };
  await assert.rejects(f.reconcile("grow", [row("new", "2026-09-09")]), {code: "sheets_read_incomplete"});
  assert.equal(f.sheets.mutations.length, 1);
});

test("different ID at an existing date and incoming ID in another affected tab are rejected", async () => {
  const f = fixture();
  await f.reconcile("initial", [row("existing", "2026-09-02")]);
  await assert.rejects(f.reconcile("date-collision", [row("new-id", "2026-09-02")]), {code: "duplicate_sheets_row"});
  await assert.rejects(f.reconcile("partition-collision", [
    row("existing", "2027-09-01"), row("keep-old-tab-affected", "2026-09-09"),
  ]), {code: "duplicate_sheets_row"});
  assert.equal(f.sheets.mutations.length, 1);
});

test("invalid marker ID/location cannot broaden a metadata update filter", async () => {
  for (const corrupt of [
    (marker) => { delete marker.metadataId; },
    (marker) => { marker.metadataId = -1; },
    (marker) => { marker.location.sheetId = 987; },
    (marker) => { marker.metadataValue = "null"; },
  ]) {
    const f = fixture();
    await f.reconcile("initial", [row("existing", "2026-09-02")]);
    corrupt(f.sheets.state.sheets[0].developerMetadata[0]);
    await assert.rejects(f.reconcile("next", [row("new", "2026-09-09")]), {code: "sheets_marker_conflict"});
    assert.equal(f.sheets.mutations.length, 1);
  }
});

test("read-back rejects formula headers even if their literal formula text equals the header", async () => {
  const f = fixture();
  const rows = [row("existing", "2026-09-02")];
  await f.reconcile("initial", rows);
  setCell(f.sheets.state.sheets[0], 0, 0, {userEnteredValue: {formulaValue: "shiftId"}});
  assert.equal((await f.adapter.inspect({operationId: "initial", rows})).kind, "ambiguous");
  assert.equal(f.sheets.mutations.length, 1);
});

for (const sameOperation of [true, false]) {
  test(`concurrent absent-tab discovery reconciles ${sameOperation ? "the same operation" : "different operations"} without duplicate creation`, async () => {
    const f = fixture();
    const get = f.sheets.get;
    let release;
    let discoveries = 0;
    const bothDiscovered = new Promise((resolve) => { release = resolve; });
    f.sheets.get = async (...args) => {
      const response = await get(...args);
      if (!args[0].ranges && discoveries < 2) {
        assert.deepEqual(response.data.sheets, [], "both workers capture the absent tab");
        discoveries += 1;
        assert.equal(f.sheets.mutations.length, 0, "neither worker writes before both snapshots exist");
        if (discoveries === 2) release();
        await bothDiscovered;
      }
      return response;
    };
    const inputs = [
      {operationId: "concurrent-first", rows: [row("shared-row", "2026-09-02")]},
      {operationId: sameOperation ? "concurrent-first" : "concurrent-second",
        rows: [row("shared-row", "2026-09-02", {assignedUserIds: [sameOperation ? "member-a" : "member-c"]})]},
    ];
    const results = await Promise.all(inputs.map((input) => f.reconcile(input.operationId, input.rows)));
    assert.equal(discoveries, 2);
    assert.equal(f.sheets.mutations.length, 2, "two stale plans submit one batch each without internal resend");
    assert.equal(f.sheets.rejectedBatches, 1, "the API rejects the second conflicting addSheet atomically");
    assert.equal(f.sheets.state.sheets.length, 1, "one physical tab is created");
    const sheet = f.sheets.state.sheets[0];
    assert.equal(sheet.data[0].rowData.length, 2, "one header and one logical row survive");
    assert.equal(sheet.developerMetadata.length, 1);
    if (sameOperation) {
      assert.deepEqual(results.map((result) => result.kind), ["verified", "verified"]);
      assert.equal(results[0].readBackDigest, results[1].readBackDigest);
    } else {
      assert.deepEqual(results.map((result) => result.kind).sort(), ["ambiguous", "verified"]);
      const winnerIndex = results.findIndex((result) => result.kind === "verified");
      assert.equal(content(sheet, 1, 5).stringValue, JSON.stringify(inputs[winnerIndex].rows[0].assignedUserIds));
      assert.equal(JSON.parse(sheet.developerMetadata[0].metadataValue).operationId, inputs[winnerIndex].operationId);
    }
  });
}
