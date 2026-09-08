"use strict";
const assert = require("node:assert/strict");
const {before, beforeEach, after, test} = require("node:test");
const {Firestore} = require("@google-cloud/firestore");
const {recoveryEventFixture} = require("./shift-planning-recovery-event-fixture.cjs");
const {createShiftPlanningPublicEventRetentionPolicy, createShiftPlanningPublicEventOperationRetention,
  shiftPlanningPublicEventOperationRetentionPath} = require("../lib/shift-planning-public-event-retention.js");
const projectId = "demo-reguerta-hu083-public-event-trigger";
const host = process.env.FIRESTORE_EMULATOR_HOST;
const emulatorTest = (name, fn) => test(name, {skip: !host}, fn);
const root = "develop/plus-collections";
const policyKey = "SHIFT_PLANNING_PUBLIC_EVENT_RETENTION_POLICY_DEVELOP";
const policy = createShiftPlanningPublicEventRetentionPolicy({
  policyRevision: "test-policy", maximumDeliveryRetryHorizonMillis: 60_000, safetyMarginMillis: 1_000,
});
let firestore, exported;
before(() => {
  if (!host) return;
  assert.equal(process.env.GCLOUD_PROJECT, projectId);
  firestore = new Firestore({projectId});
  exported = require("../lib/index.js");
});
beforeEach(async () => {
  if (!host) return;
  process.env[policyKey] = JSON.stringify(policy);
  const response = await fetch(`http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`, {method: "DELETE"});
  assert.equal(response.ok, true);
});
after(async () => {
  if (!host) return;
  delete process.env[policyKey];
  await firestore.terminate();
  await require("firebase-admin/firestore").getFirestore().terminate();
  await require("firebase-admin/app").deleteApp(require("firebase-admin/app").getApp());
});
const seedAuthority = async (value) => {
  const batch = firestore.batch();
  batch.create(firestore.doc(value.recovery.operationPath), value.recovery.operation);
  for (const envelope of value.activation.beforeImages) batch.create(firestore.doc(envelope.envelopePath), envelope);
  for (const kind of ["activation", "recovery"]) {
    const operation = kind === "activation" ? value.activation.operation : value.recovery.operation;
    const retention = createShiftPlanningPublicEventOperationRetention({
      environment: "develop", controlledOperationKind: kind,
      operationId: kind === "activation" ? operation.operationId : operation.recoveryOperationId,
      operationIntentDigest: kind === "activation" ? operation.operationIntentDigest : operation.recoveryIntentDigest,
      terminalAt: kind === "activation" ? operation.attemptedAt : operation.recoveredAt, policy,
    });
    batch.create(firestore.doc(shiftPlanningPublicEventOperationRetentionPath({
      environment: "develop", operationId: retention.operationId,
    })), retention);
  }
  await batch.commit();
};
const sdkEvent = async (input) => {
  const ref = firestore.doc(input.targetPath);
  if (input.before) await ref.set(input.before); else await ref.delete();
  const before = await ref.get();
  if (input.after) await ref.set(input.after); else await ref.delete();
  const after = await ref.get();
  return {id: input.eventId, time: input.eventTime.toDate().toISOString(),
    params: {env: "develop", shiftId: ref.id}, authType: "system", data: {before, after}};
};
const ledgers = () => firestore.collection(`${root}/shiftPlanningPublicEventLedgers`)
  .where("recordKind", "==", "publicEventLedger").get();

emulatorTest("actual retry export persists recovery and delayed activation events exactly once", async () => {
  const value = recoveryEventFixture();
  await seedAuthority(value);
  assert.equal(exported.onShiftPlanningPublicWritten.__endpoint.eventTrigger.retry, true);
  assert.notEqual(exported.onShiftWritten.__endpoint.eventTrigger.retry, true);
  const created = value.activation.publicDocuments.find((item) => item.mutationKind === "create");
  for (const input of [
    value.input,
    {...value.input, eventId: "activation-update", before: value.input.after, after: value.input.before},
    {...value.input, eventId: "recovery-delete", targetPath: created.targetPath, before: created.document, after: null},
  ]) {
    const event = await sdkEvent(input);
    await exported.onShiftPlanningPublicWritten.run(event);
    await exported.onShiftPlanningPublicWritten.run(event);
  }
  const records = await ledgers();
  assert.equal(records.size, 3);
  assert.ok(records.docs.every((doc) => doc.get("outcome") === "controlledNoOp"));
  assert.deepEqual(records.docs.map((doc) => doc.get("controlledOperationKind")).sort(),
    ["activation", "recovery", "recovery"]);
});

emulatorTest("actual export retries missing policy and unavailable authority, then rejects durably", async (t) => {
  const value = recoveryEventFixture();
  const event = await sdkEvent(value.input);
  delete process.env[policyKey];
  await assert.rejects(exported.onShiftPlanningPublicWritten.run(event));
  assert.equal((await ledgers()).size, 0);
  process.env[policyKey] = JSON.stringify(policy);
  const database = require("firebase-admin/firestore").getFirestore();
  const failure = new Error("injected unavailable");
  const outage = t.mock.method(database, "runTransaction", async () => { throw failure; });
  await assert.rejects(exported.onShiftPlanningPublicWritten.run(event), (error) => error === failure);
  outage.mock.restore();
  assert.equal((await ledgers()).size, 0);
  await exported.onShiftPlanningPublicWritten.run(event);
  await exported.onShiftPlanningPublicWritten.run(event);
  const records = await ledgers();
  assert.equal(records.size, 1);
  assert.equal(records.docs[0].get("outcome"), "rejected");
  assert.equal(records.docs[0].get("alertRequired"), true);
});

emulatorTest("actual ordinary trigger excludes forged confirmed rows before opening Sheets", async (t) => {
  const value = recoveryEventFixture();
  const event = await sdkEvent({...value.input, after: {
    ...value.input.after, status: "confirmed", lastBackendMutation: {forged: true},
  }});
  process.env.SHEETS_SPREADSHEET_ID_DEVELOP = "test-book";
  process.env.SHEETS_DELIVERY_RANGE_DEVELOP = "delivery!A:F";
  process.env.SHEETS_MARKET_RANGE_DEVELOP = "market!A:C";
  const sheets = t.mock.method(require("googleapis").google, "sheets", () => {
    throw new Error("ordinary writer must not open Sheets");
  });
  await exported.onShiftWritten.run(event);
  assert.equal(sheets.mock.callCount(), 0);
  assert.equal((await ledgers()).size, 0);
  delete process.env.SHEETS_SPREADSHEET_ID_DEVELOP;
  delete process.env.SHEETS_DELIVERY_RANGE_DEVELOP;
  delete process.env.SHEETS_MARKET_RANGE_DEVELOP;
});

emulatorTest("ordinary retained-marker events bypass audit configuration and keep no ledger", async () => {
  const value = recoveryEventFixture();
  const event = await sdkEvent({...value.input, before: value.input.after,
    after: {...value.input.after, helperUserId: "member-9"}});
  delete process.env[policyKey];
  await exported.onShiftPlanningPublicWritten.run(event);
  assert.equal((await ledgers()).size, 0);
});

emulatorTest("ordinary seasonal export rejects missing scoped authority before opening Sheets", async (t) => {
  const vars = {
    SHIFT_SHEETS_ALIASES_DEVELOP: "[]",
    SHEETS_SPREADSHEET_ID: "global-book", SHEETS_DELIVERY_RANGE: "Global!A:F", SHEETS_MARKET_RANGE: "Global!A:C",
    SHEETS_SPREADSHEET_ID_DEVELOP: "dev-book", SHEETS_DELIVERY_RANGE_DEVELOP: "Delivery!A:F", SHEETS_MARKET_RANGE_DEVELOP: "Market!A:C",
    SHEETS_SPREADSHEET_ID_PRODUCTION: "prod-book", SHEETS_DELIVERY_RANGE_PRODUCTION: "Production!A:F", SHEETS_MARKET_RANGE_PRODUCTION: "Production!A:C",
  };
  const original = Object.fromEntries(Object.keys(vars).map((key) => [key, process.env[key]]));
  const sheets = t.mock.method(require("googleapis").google, "sheets", () => { throw new Error("No Sheets access without scoped configuration"); });
  try {
    const value = recoveryEventFixture(), after = {...value.input.after, status: "confirmed"};
    delete after.lastBackendMutation;
    const event = await sdkEvent({...value.input, before: null, after});
    for (const missing of ["SHEETS_SPREADSHEET_ID_DEVELOP", "SHIFT_SHEETS_ALIASES_DEVELOP"]) {
      Object.assign(process.env, vars); delete process.env[missing];
      await assert.rejects(exported.onShiftWritten.run(event));
    }
    assert.equal(sheets.mock.callCount(), 0);
    assert.equal((await ledgers()).size, 0);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

const humanSheets = (tabs) => {
  const state = structuredClone(tabs), writes = [], reads = [];
  const locate = (range) => {
    const separator = range.lastIndexOf("!"), quoted = range.slice(0, separator);
    const title = quoted.slice(1, -1).replace(/''/g, "'");
    assert.ok(Object.hasOwn(state, title), "No implicit destination creation or fallback");
    return {title, cells: range.slice(separator + 1)};
  };
  const update = ({range, values}) => {
    const {title, cells} = locate(range), match = /^([A-F])(\d+)(?::([A-F])(\d+))?$/.exec(cells);
    assert.ok(match); const row = Number(match[2]) - 1, col = match[1].charCodeAt(0) - 65;
    for (const [r, data] of values.entries()) {
      state[title][row + r] ??= [];
      for (const [c, value] of data.entries()) state[title][row + r][col + c] = value;
    }
  };
  const values = {
    get: async (request) => {
      reads.push(request); const {title} = locate(request.range);
      return {data: {values: state[title].map((row) => row.map((value) => value?.startsWith("=") ? "computed" : value))}};
    },
    update: async (request) => { writes.push(request); update({range: request.range, values: request.requestBody.values}); return {data: {}}; },
    batchUpdate: async (request) => { writes.push(request); request.requestBody.data.forEach(update); return {data: {}}; },
    append: async (request) => { writes.push(request); state[locate(request.range).title].push(...structuredClone(request.requestBody.values)); return {data: {}}; },
  };
  return {state, writes, reads, api: {spreadsheets: {values,
    get: async ({spreadsheetId}) => ({data: {spreadsheetId, sheets: Object.keys(state).map((title) =>
      ({properties: {title, gridProperties: {rowCount: Math.max(100, state[title].length), columnCount: 26}}}))}}),
  }}};
};
const ordinaryHumanFixture = async (t, {type = "delivery", date = "2026-08-27", ids = ["a"], title = "TORRE 2025-26", rows = []} = {}) => {
  const keys = ["SHEETS_SPREADSHEET_ID_DEVELOP", "SHIFT_SHEETS_ALIASES_DEVELOP"];
  const original = keys.map((key) => process.env[key]);
  t.after(() => keys.forEach((key, index) => { if (original[index] === undefined) delete process.env[key]; else process.env[key] = original[index]; }));
  process.env.SHEETS_SPREADSHEET_ID_DEVELOP = "human-fixture-book";
  process.env.SHIFT_SHEETS_ALIASES_DEVELOP = JSON.stringify([{type,
    seasonStartYear: Number(date.slice(0, 4)) - Number(Number(date.slice(5, 7)) < 9), title}]);
  for (const id of ["a", "b", "c", "d"]) await firestore.doc(`${root}/users/${id}`).set({displayName: `Persona ${id.toUpperCase()}`, phone: `90000000${id}`});
  const sheets = humanSheets({[title]: rows});
  t.mock.method(require("googleapis").google, "sheets", () => sheets.api);
  const shiftId = `shift_${type}_${date.replaceAll("-", "")}`;
  const event = await sdkEvent({targetPath: `${root}/shifts/${shiftId}`, before: null, after: {
    type, date: require("@google-cloud/firestore").Timestamp.fromDate(new Date(`${date}T00:00:00Z`)),
    assignedUserIds: ids, helperUserId: null, status: "confirmed", source: "app",
    syncMeta: {sheetName: "untrusted-wrong-season"},
  }, eventId: `ordinary-${shiftId}`, eventTime: require("@google-cloud/firestore").Timestamp.now()});
  return {event, sheets, shiftId, title};
};

emulatorTest("ordinary delivery uses the reviewed seasonal alias and leaves manual formulas and names readable", async (t) => {
  const f = await ordinaryHumanFixture(t, {title: "Torre's! 2025-26", ids: ["b"], rows: [
    ["AGOSTO"], ["27/8/2026", "Persona A", "old phone", "=1+1", "lo hace Persona B", "35"],
  ]});
  await exported.onShiftWritten.run(f.event);
  assert.equal(f.sheets.reads[0].range, "'Torre''s! 2025-26'!A1:F2000");
  assert.deepEqual(f.sheets.state[f.title][1], ["27/8/2026", "Persona B", "90000000b", "=1+1", "lo hace Persona B", "35"]);
  assert.equal(f.sheets.writes.length, 1);
  assert.equal((await firestore.doc(`${root}/shifts/${f.shiftId}`).get()).get("syncMeta.sheetName"), f.title);
  assert.equal((await firestore.collection(`${root}/notificationEvents`).get()).size, 1);
});

emulatorTest("market updates only three participant name/phone pairs and preserves the next date and manual cells", async (t) => {
  const rows = [["20/9/2026", "heading note"], ["Persona A", "old", "=2+2"], ["Persona B", "old", "note B"],
    ["Persona C", "old", "note C"], ["18/10/2026"], ["Persona D", "phone", "next date note"]];
  const f = await ordinaryHumanFixture(t, {type: "market", date: "2026-09-20", ids: ["b", "c", "a"], title: "turnos-mercado 2026-27", rows});
  await exported.onShiftWritten.run(f.event);
  assert.deepEqual(f.sheets.state[f.title], [rows[0], ["Persona B", "90000000b", "=2+2"], ["Persona C", "90000000c", "note B"],
    ["Persona A", "90000000a", "note C"], rows[4], rows[5]]);
  assert.equal(f.sheets.writes[0].range, "'turnos-mercado 2026-27'!A2:B4");
});

emulatorTest("market append adds one date and exactly three named people without technical columns", async (t) => {
  const f = await ordinaryHumanFixture(t, {type: "market", date: "2026-09-20", ids: ["a", "b", "c"], title: "turnos-mercado 2026-27"});
  await exported.onShiftWritten.run(f.event);
  const rows = f.sheets.state[f.title];
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.slice(1).map((row) => row[0]), ["Persona A", "Persona B", "Persona C"]);
  assert.ok(rows.every((row) => row.length <= 3));
});

emulatorTest("ambiguous dates and oversized or incomplete market groups stop before writes or notification effects", async (t) => {
  const f = await ordinaryHumanFixture(t, {type: "market", date: "2026-09-20", ids: ["a", "b", "c"], title: "turnos-mercado 2026-27"});
  for (const rows of [
    [["20/9/2026"], ["Persona A"], ["Persona B"], ["Persona C"], ["20/9/2026"]],
    [["20/9/2026"], ["Persona A"], ["Persona B"], ["18/10/2026"]],
    [["20/9/2026"], ["Persona A"], ["Persona B"], ["Persona C"], ["Persona D"]],
  ]) {
    f.sheets.state[f.title] = rows;
    await assert.rejects(exported.onShiftWritten.run(f.event));
  }
  assert.equal(f.sheets.writes.length, 0);
  assert.equal((await firestore.collection(`${root}/notificationEvents`).get()).size, 0);
});

emulatorTest("full HTTP export sends delivery carryover and market to their own readable seasonal tabs", async (t) => {
  const f = await ordinaryHumanFixture(t);
  const {Timestamp} = require("@google-cloud/firestore");
  f.sheets.state["turnos-reparto 2026-27"] = [];
  f.sheets.state["turnos-mercado 2026-27"] = [];
  await firestore.doc(`${root}/shifts/shift_delivery_20260903`).set({type: "delivery", date: Timestamp.fromDate(new Date("2026-09-03T00:00:00Z")), assignedUserIds: ["b"], helperUserId: null, status: "planned", source: "app"});
  await firestore.doc(`${root}/shifts/shift_market_20260920`).set({type: "market", date: Timestamp.fromDate(new Date("2026-09-20T00:00:00Z")), assignedUserIds: ["a", "b", "c"], helperUserId: null, status: "planned", source: "app"});
  await firestore.doc(`${root}/authLinks/fixture-admin`).set({memberId: "a"});
  await firestore.doc(`${root}/users/a`).set({authUid: "fixture-admin", isActive: true, roles: ["member", "admin"]}, {merge: true});
  t.mock.method(require("firebase-admin/auth").getAuth(), "verifyIdToken", async () => ({uid: "fixture-admin", email_verified: true}));
  const response = {statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }};
  await exported.exportShiftsToGoogleSheets({method: "POST", body: {environment: "develop"}, query: {}, headers: {authorization: "Bearer fixture-token"}}, response);
  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.deepEqual(response.body, {ok: true, env: "develop", exportedCount: 3, deliveryCount: 2, marketCount: 1});
  assert.deepEqual(f.sheets.reads.map((request) => request.range).sort(), ["'TORRE 2025-26'!A1:F2000", "'turnos-mercado 2026-27'!A1:C2000", "'turnos-reparto 2026-27'!A1:F2000"]);
  assert.equal(f.sheets.state["TORRE 2025-26"][1][1], "Persona A");
  assert.equal(f.sheets.state["turnos-reparto 2026-27"][1][1], "Persona B");
  assert.equal(f.sheets.state["turnos-mercado 2026-27"].length, 4);
});

emulatorTest("calendar override keeps the logical seasonal tab and updates the visible date without touching notes", async (t) => {
  const f = await ordinaryHumanFixture(t, {rows: [["27/8/2026", "Persona A", "phone", "=1+1", "manual", "35"]]});
  const {Timestamp} = require("@google-cloud/firestore"), ref = firestore.doc(`${root}/deliveryCalendar/2026-W35`);
  const before = await ref.get();
  await ref.set({deliveryDate: Timestamp.fromDate(new Date("2026-08-28T00:00:00Z")), updatedBy: "a"});
  const after = await ref.get();
  await exported.onDeliveryCalendarOverrideWritten.run({params: {env: "develop", weekKey: "2026-W35"}, authType: "system", data: {before, after}});
  assert.equal(f.sheets.reads[0].range, "'TORRE 2025-26'!A1:F2000");
  assert.deepEqual(f.sheets.state[f.title][0], ["28/8/2026", "Persona A", "90000000a", "=1+1", "manual", "35"]);
  assert.equal(f.sheets.writes.length, 1);
});

emulatorTest("human writers reject unknown destinations, oversized grids and unresolved assignees before writing", async (t) => {
  const f = await ordinaryHumanFixture(t);
  let metadata;
  const get = t.mock.method(f.sheets.api.spreadsheets, "get", async () => ({data: metadata}));
  for (const data of [
    {spreadsheetId: "human-fixture-book", sheets: []},
    {spreadsheetId: "wrong-book", sheets: [{properties: {title: f.title, gridProperties: {rowCount: 100}}}]},
    {spreadsheetId: "human-fixture-book", sheets: [{properties: {title: f.title, gridProperties: {rowCount: 2001}}}]},
  ]) { metadata = data; await assert.rejects(exported.onShiftWritten.run(f.event)); }
  assert.equal(f.sheets.reads.length, 0);
  const before = get.mock.callCount();
  for (const ids of [[], ["a", "b"], ["unknown"]]) {
    const ref = firestore.doc(`${root}/shifts/${f.shiftId}`);
    await ref.update({assignedUserIds: ids});
    await assert.rejects(exported.onShiftWritten.run({...f.event, data: {...f.event.data, after: await ref.get()}}));
  }
  assert.equal(get.mock.callCount(), before);
  assert.equal(f.sheets.writes.length, 0);
  assert.equal((await firestore.collection(`${root}/notificationEvents`).get()).size, 0);
});

emulatorTest("readable exports never substitute a UID for a missing name or render ambiguous member names", async (t) => {
  const f = await ordinaryHumanFixture(t);
  await firestore.doc(`${root}/users/a`).update({displayName: ""});
  await assert.rejects(exported.onShiftWritten.run(f.event));
  await firestore.doc(`${root}/users/a`).update({displayName: "Persona A"});
  await firestore.doc(`${root}/users/b`).update({displayName: "Persona A"});
  await assert.rejects(exported.onShiftWritten.run(f.event));
  assert.equal(f.sheets.reads.length, 0);
  assert.equal(f.sheets.writes.length, 0);
});

emulatorTest("readable exports cannot append human rows into a technical table", async (t) => {
  const f = await ordinaryHumanFixture(t, {rows: [["shiftId", "type", "date", "seasonStartYear", "rotationOwnerUserIds", "assignedUserIds"]]});
  await assert.rejects(exported.onShiftWritten.run(f.event));
  assert.equal(f.sheets.writes.length, 0);
});

emulatorTest("legacy planning retires a pending request once without generating shifts, Sheets or notifications", async (t) => {
  t.mock.method(require("googleapis").google, "sheets", () => {throw new Error("Legacy planner must never open Sheets");});
  const ref = firestore.doc(`${root}/shiftPlanningRequests/legacy-retired`);
  await ref.set({type: "delivery", status: "requested", requestedByUserId: "a",
    requestedAt: require("@google-cloud/firestore").Timestamp.now()});
  const event = {params: {env: "develop", requestId: ref.id}, authType: "system", data: await ref.get()};
  await exported.onShiftPlanningRequestCreated.run(event);
  const failed = await ref.get();
  assert.equal(failed.get("status"), "failed"); assert.equal(failed.get("errorCode"), "legacy_planning_retired");
  assert.equal(failed.get("processingStartedAt"), undefined);
  await exported.onShiftPlanningRequestCreated.run(event);
  assert.ok((await ref.get()).updateTime.isEqual(failed.updateTime), "replay does not rewrite the terminal result");
  assert.equal((await firestore.collection(`${root}/shifts`).get()).size, 0);
  assert.equal((await firestore.collection(`${root}/notificationEvents`).get()).size, 0);
});

emulatorTest("legacy retirement ignores v2, unsupported, unauthorized and replaced snapshots", async () => {
  const {Timestamp} = require("@google-cloud/firestore");
  const ref = firestore.doc(`${root}/shiftPlanningRequests/legacy-stale`);
  const legacy = {type: "market", status: "requested", requestedByUserId: "a", requestedAt: Timestamp.now()};
  const eventFor = (data) => ({params: {env: "develop", requestId: ref.id}, authType: "system", data});
  await ref.set(legacy); const original = await ref.get();
  await exported.onShiftPlanningRequestCreated.run({...eventFor(original), authType: "unauthenticated"});
  assert.ok((await ref.get()).updateTime.isEqual(original.updateTime));
  for (const next of [{...legacy, schemaVersion: 2}, {...legacy, schemaVersion: 42}, {...legacy, status: "completed"}]) {
    await ref.set(next); const before = await ref.get();
    await exported.onShiftPlanningRequestCreated.run(eventFor(before));
    await exported.onShiftPlanningRequestCreated.run(eventFor(original));
    assert.ok((await ref.get()).updateTime.isEqual(before.updateTime));
  }
});

emulatorTest("legacy sync returns an authenticated migration error and performs no import", async (t) => {
  t.mock.method(require("googleapis").google, "sheets", () => {throw new Error("Retired sync must never open Sheets");});
  const response = () => ({statusCode: null, body: null, status(code) {this.statusCode = code; return this;}, json(body) {this.body = body; return this;}});
  const request = {method: "POST", body: {environment: "develop"}, query: {}, headers: {authorization: "Bearer fixture-token"}};
  t.mock.method(require("firebase-admin/auth").getAuth(), "verifyIdToken", async () => ({uid: "fixture-admin", email_verified: true}));
  await firestore.doc(`${root}/authLinks/fixture-admin`).set({memberId: "a"});
  await firestore.doc(`${root}/users/a`).set({authUid: "fixture-admin", displayName: "Admin", isActive: true, roles: ["member", "admin"]});
  const retired = response(); await exported.syncShiftsFromGoogleSheets(request, retired);
  assert.equal(retired.statusCode, 410, JSON.stringify(retired.body));
  assert.match(JSON.stringify(retired.body), /legacy_shift_sync_retired/);
  const method = response(); await exported.syncShiftsFromGoogleSheets({...request, method: "GET"}, method);
  assert.equal(method.statusCode, 405);
  await firestore.doc(`${root}/users/a`).update({roles: ["member"]});
  const denied = response(); await exported.syncShiftsFromGoogleSheets(request, denied);
  assert.equal(denied.statusCode, 403);
  assert.equal((await firestore.collection(`${root}/shifts`).get()).size, 0);
  assert.equal((await firestore.collection(`${root}/notificationEvents`).get()).size, 0);
});

emulatorTest("ordinary export preserves the new helper column and appends no month decoration", async (t) => {
  const headers = ["Fecha", "Persona", "Teléfono", "Notas", "Cambio", "Ayuda"];
  const f = await ordinaryHumanFixture(t, {rows: [headers, ["27/8/2026", "Persona A", "old", "=1+1", "nota", "Persona C"]]});
  const ref = firestore.doc(`${root}/shifts/${f.shiftId}`);
  await ref.update({helperUserId: "b"});
  await exported.onShiftWritten.run({...f.event, data: {...f.event.data, after: await ref.get()}});
  assert.deepEqual(f.sheets.state[f.title][1], ["27/8/2026", "Persona A", "90000000a", "=1+1", "nota", "Persona B"]);
  // The missing-row path must remain parseable by the same generated layout.
  f.sheets.state[f.title] = [headers];
  await ref.update({syncMeta: {sheetName: "untrusted-wrong-season"}});
  await exported.onShiftWritten.run({...f.event, data: {...f.event.data, after: await ref.get()}});
  assert.equal(f.sheets.state[f.title].length, 2);
  assert.equal(f.sheets.state[f.title][1][0], "27/8/2026");
  assert.equal(f.sheets.state[f.title][1][5], "Persona B");
});

emulatorTest("generated delivery export rejects a missing helper name and clears a removed helper", async (t) => {
  const f = await ordinaryHumanFixture(t, {rows: [["Fecha", "Persona", "Teléfono", "Notas", "Cambio", "Ayuda"],
    ["27/8/2026", "Persona A", "old", "nota", "", "Persona C"]]});
  const ref = firestore.doc(`${root}/shifts/${f.shiftId}`);
  await ref.update({helperUserId: "missing"});
  await assert.rejects(exported.onShiftWritten.run({...f.event, data: {...f.event.data, after: await ref.get()}}));
  assert.equal(f.sheets.writes.length, 0);
  await ref.update({helperUserId: null});
  await exported.onShiftWritten.run({...f.event, data: {...f.event.data, after: await ref.get()}});
  assert.equal(f.sheets.state[f.title][1][5], "");
  assert.equal(f.sheets.state[f.title][1][3], "nota");
});
