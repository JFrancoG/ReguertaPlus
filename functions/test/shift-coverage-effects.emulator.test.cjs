"use strict";
const assert = require("node:assert/strict");
const {test, before, beforeEach, after} = require("node:test");
const {Firestore, Timestamp} = require("@google-cloud/firestore");
const {createProvisionalShiftCoverageStore} = require("../lib/shift-coverage-provisional-store.js");
const {createProvisionalCoverageEffectsWorker} = require("../lib/shift-coverage-effects-worker.js");
const {coverageSheetRow} = require("../lib/shift-coverage-effects.js");
const {createShiftSheetsConfig} = require("../lib/shift-sheets-config.js");
const {createShiftSheetsAdapter} = require("../lib/shift-sheets.js");
const {readShiftSheetsImport} = require("../lib/shift-sheets-import.js");
const {clone, content, setCell, sheetsService} = require("./shift-sheets-api-fixture.cjs");
const {materialize, initialTime, activeDigest} = require("./shift-coverage-fixture.cjs");
const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const run = (name, fn) => test(name, {skip: !enabled}, fn);
const root = "develop/plus-collections", projectId = "demo-reguerta-hu084-coverage";
const config = createShiftSheetsConfig({environment: "develop", workbooks: {develop: "coverage-rehearsal-book"}});
const members = ["a", "b", "c", "d", "e", "admin"].map((userId, i) =>
  ({userId, names: [`Member ${userId}`], phones: [`60000000${i}`], eligibleTypes: ["delivery", "market"]}));
let db, store, worker, sheets, tabs, now, sequence;
const ref = (collection, id) => db.doc(`${root}/${collection}/${id}`);
const read = async (collection, id) => (await ref(collection, id).get()).data();
const inbox = async () => (await db.collectionGroup("notificationInbox").get()).docs.map((d) => [d.ref.path, d.data()]);
const command = async (action, actor = "admin", extra = {}) => {
  const state = (await read("shiftCoverageCases", "case-1"))?.value;
  const shift = await read("shifts", extra.shiftId ?? state.shiftId);
  const value = {schemaVersion: 1, environment: "develop", caseId: "case-1", operationId: `effects-${++sequence}`,
    expectedRevision: state?.revision ?? 0, expectedShiftRevision: shift.documentRevision, action, ...extra};
  await store.execute(value, actor); return value;
};
const accept = async (type = "delivery") => {
  await command("open", "a", {shiftId: type === "delivery" ? "shift_delivery_20270901" : "shift_market_20270904",
    absentUserId: "a", reason: "Private reason must never reach notifications"});
  await command("offer", "admin", {userId: "d", reason: "Private arrangement", expiresAtMillis: now + 10_000});
  return command("accept", "d");
};
const sheet = (title) => sheets.state.sheets.find((s) => s.properties.title === title);
const currentRows = async () => (await db.collection(`${root}/shifts`).get()).docs.map((d) => coverageSheetRow(d.id, d.data()));
before(() => {
  if (!enabled) return;
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8798");
  assert.equal(process.env.GCLOUD_PROJECT, projectId);
  db = new Firestore({projectId, host: "127.0.0.1:8798", ssl: false});
  store = createProvisionalShiftCoverageStore({nowMillis: () => now, maximumOfferWindowMillis: 60_000});
});
after(async () => { if (worker) await worker.close(); if (store) await store.close(); if (db) await db.terminate(); });
beforeEach(async () => {
  if (!enabled) return;
  if (worker) await worker.close();
  assert.equal((await fetch(`http://127.0.0.1:8798/emulator/v1/projects/${projectId}/databases/(default)/documents`, {method: "DELETE"})).ok, true);
  now = initialTime; sequence = 0;
  await ref("shiftPlanningState", "current").set({schemaVersion: 1, stateRevision: 1, writeEpoch: 1,
    maintenanceStatus: "open", activeRevision: "active-1", activeDigest, intakeBarrier: null, lastTransitionId: "initial"});
  for (const member of members) await ref("users", member.userId).set({roles: member.userId === "admin" ? ["admin", "member"] : ["member"],
    isActive: true, isCommonPurchaseManager: false, displayName: member.names[0], phoneNumber: member.phones[0]});
  for (const [id, type, date, assigned, helper] of [
    ["shift_delivery_20270825", "delivery", "2027-08-25", ["b"], "a"],
    ["shift_delivery_20270901", "delivery", "2027-09-01", ["a"], "c"],
    ["shift_delivery_20270908", "delivery", "2027-09-08", ["c"], "e"],
    ["shift_market_20270904", "market", "2027-09-04", ["a", "b", "c"], null],
  ]) await ref("shifts", id).set(materialize(id, type, date, assigned, helper));
  for (const [weekKey, date] of [["2027-W34", "2027-08-25"], ["2027-W35", "2027-09-01"], ["2027-W36", "2027-09-08"]]) {
    await ref("deliveryCalendar", weekKey).set({deliveryDate: Timestamp.fromDate(new Date(`${date}T00:00:00Z`))});
  }
  const rows = await currentRows(); sheets = sheetsService(config.workbookId);
  assert.equal((await createShiftSheetsAdapter({config, sheets}).reconcile({operationId: "baseline", rows,
    generationRows: rows.map((r) => ({id: r.id, visibleDate: r.date,
      assignees: r.assignedUserIds.map((userId) => { const m = members.find((m) => m.userId === userId);
        return {userId, name: m.names[0], phone: m.phones[0]}; }),
      helper: r.helperUserId ? {userId: r.helperUserId, name: members.find((m) => m.userId === r.helperUserId).names[0]} : null})),
    authorizeMutation: async () => {}})).kind, "verified");
  tabs = sheets.state.sheets.map((s) => { const type = s.properties.title.includes("reparto") ? "delivery" : "market";
    return {title: s.properties.title, type, seasonStartYear: s.properties.title.includes("2026") ? 2026 : 2027,
      layout: `${type}_human`, decorations: [{rowNumber: 1, cells: s.data[0].rowData[0].values.map((c) => c.userEnteredValue.stringValue)}]}; });
  worker = createProvisionalCoverageEffectsWorker({config, sheets, tabs, readWorkbookVersion: async () => "1", nowMillis: () => now});
});

run("atomic acceptance outbox projects cross-season helper and lead before releasing generic inbox exactly once", async () => {
  const before = await currentRows();
  setCell(sheet("turnos-reparto 2027-28"), 1, 3, {userEnteredValue: {formulaValue: "=1+2"}, note: "Keep note"});
  setCell(sheet("turnos-reparto 2027-28"), 1, 4, {userEnteredValue: {stringValue: "Bring crates"}});
  const preserved = clone(sheet("turnos-reparto 2027-28").data[0].rowData[1].values.slice(3, 5));
  const value = await accept();
  const effects = await read("shiftCoverageEffects", value.operationId);
  assert.equal(effects.value.changes.length, 2);
  assert.equal((await read("shiftCoverageOperations", value.operationId)).effectsDigest, effects.value.effectsDigest);
  assert.deepEqual(await inbox(), []);
  assert.deepEqual(await worker.drain(value.operationId), {state: "completed", replayed: false});
  assert.equal(content(sheet("turnos-reparto 2027-28"), 1, 1).stringValue, "Member d");
  assert.equal(content(sheet("turnos-reparto 2026-27"), 1, 5).stringValue, "Member d");
  assert.deepEqual(sheet("turnos-reparto 2027-28").data[0].rowData[1].values.slice(3, 5), preserved);
  const delivered = await inbox(); assert.equal(delivered.length, 4);
  assert.equal(JSON.stringify(delivered).includes("Private"), false);
  assert.equal((await db.collection(`${root}/notificationEvents`).get()).size, 0, "no dispatch trigger");
  assert.deepEqual((await currentRows()).map((r) => r.rotationOwnerUserIds), before.map((r) => r.rotationOwnerUserIds));
  assert.equal((await db.collection(`${root}/shiftCoverageCredits`).get()).size, 0);
  const mutations = sheets.mutations.length;
  assert.equal((await store.execute(value, "d")).replayed, true);
  assert.deepEqual(await worker.drain(value.operationId), {state: "completed", replayed: true});
  assert.deepEqual(await inbox(), delivered); assert.equal(sheets.mutations.length, mutations);
});

run("market replacement keeps three ordered distinct members, notes and readable import", async () => {
  setCell(sheet("turnos-mercado 2027-28"), 3, 2, {userEnteredValue: {formulaValue: "=7"}, note: "Keep"});
  const value = await accept("market"); await worker.drain(value.operationId);
  const market = sheet("turnos-mercado 2027-28");
  assert.deepEqual([2, 3, 4].map((i) => content(market, i, 0).stringValue), ["Member d", "Member b", "Member c"]);
  assert.equal(content(market, 3, 2).formulaValue, "=7");
  const observation = await readShiftSheetsImport({config, sheets, tabs, baseline: await currentRows(), members,
    deliveryCalendar: [{weekKey: "2027-W34", date: "2027-08-25"}, {weekKey: "2027-W35", date: "2027-09-01"}, {weekKey: "2027-W36", date: "2027-09-08"}],
    readWorkbookVersion: async () => "1"});
  assert.deepEqual(observation.assignments.find((r) => r.id === "shift_market_20270904").assignedUserIds, ["d", "b", "c"]);
  assert.deepEqual(observation.missingIds, []);
});

run("unknown acknowledgement retains submission and reservation, then read-back releases inbox without another mutation", async () => {
  const value = await accept(); sheets.loseAcknowledgement = true;
  sheets.onMutation = async () => { sheets.failRead = true; assert.deepEqual(await inbox(), []); };
  assert.deepEqual(await worker.drain(value.operationId), {state: "pending", replayed: false});
  const pending = await read("shiftCoverageEffects", value.operationId);
  assert.ok(pending.submission); assert.equal((await read("shiftCoverageProjectionState", "workbook")).operationId, value.operationId);
  assert.deepEqual(await inbox(), []); const count = sheets.mutations.length;
  sheets.failRead = false; sheets.onMutation = null;
  assert.equal((await worker.drain(value.operationId)).state, "completed");
  assert.equal(sheets.mutations.length, count);
  assert.equal(await read("shiftCoverageProjectionState", "workbook"), undefined);
  assert.deepEqual((await read("shiftCoverageEffects", value.operationId)).submission, pending.submission);
});

run("manual replacement conflicts preserve workbook and withhold inbox", async () => {
  const value = await accept();
  setCell(sheet("turnos-reparto 2027-28"), 1, 1, {userEnteredValue: {stringValue: "Member e"}});
  setCell(sheet("turnos-reparto 2027-28"), 1, 2, {userEnteredValue: {stringValue: members.find((m) => m.userId === "e").phones[0]}});
  const before = clone(sheets.state), count = sheets.mutations.length;
  await assert.rejects(worker.drain(value.operationId), {code: "coverage_effects_manual_conflict"});
  assert.deepEqual(clone(sheets.state), before); assert.equal(sheets.mutations.length, count);
  assert.deepEqual(await inbox(), []); assert.equal(await read("shiftCoverageProjectionState", "workbook"), undefined);
});

run("source drift after ambiguous submission blocks re-preparation and notifications", async () => {
  const value = await accept(); sheets.onMutation = async () => { sheets.failRead = true; };
  await worker.drain(value.operationId); const pending = await read("shiftCoverageEffects", value.operationId);
  sheets.failRead = false; sheets.onMutation = null; const count = sheets.mutations.length;
  await ref("users", "d").update({isActive: false});
  await assert.rejects(worker.drain(value.operationId), {code: "coverage_effects_source_changed"});
  assert.equal(sheets.mutations.length, count); assert.deepEqual(await inbox(), []);
  assert.deepEqual((await read("shiftCoverageEffects", value.operationId)).submission, pending.submission);
});

run("authority drift at external acknowledgement withholds inbox", async () => {
  const value = await accept();
  sheets.onMutation = async () => { await ref("shiftPlanningState", "current").update({stateRevision: 2, writeEpoch: 2}); };
  await assert.rejects(worker.drain(value.operationId), {code: "coverage_effects_authority_changed"});
  assert.deepEqual(await inbox(), []);
  assert.equal((await read("shiftCoverageEffects", value.operationId)).state, "pending");
});

run("expired and superseded offers do not notify; completion does not re-project or duplicate credit", async () => {
  await command("open", "a", {shiftId: "shift_delivery_20270901", absentUserId: "a", reason: "Unavailable"});
  const offer = await command("offer", "admin", {userId: "d", reason: "Agreement", expiresAtMillis: now + 10_000});
  now += 10_000;
  await assert.rejects(worker.drain(offer.operationId), {code: "coverage_effects_expired"});
  now -= 10_000; const accepted = await command("accept", "d");
  await assert.rejects(worker.drain(offer.operationId), {code: "coverage_effects_superseded"});
  await worker.drain(accepted.operationId); const count = sheets.mutations.length;
  now = Date.parse("2027-09-01T01:00:00Z"); const complete = await command("complete");
  const credit = await read("shiftCoverageCredits", "case-1");
  await worker.drain(complete.operationId); await worker.drain(complete.operationId);
  assert.deepEqual(await read("shiftCoverageCredits", "case-1"), credit); assert.equal(sheets.mutations.length, count);
  assert.equal((await read("shiftCoverageLedgerState", "delivery")).revision, 1);
});

run("inactive offer recipient is excluded and replay cannot duplicate the inbox", async () => {
  await command("open", "a", {shiftId: "shift_delivery_20270901", absentUserId: "a", reason: "Unavailable"});
  const offer = await command("offer", "admin", {userId: "d", reason: "Agreement", expiresAtMillis: now + 10_000});
  await ref("users", "d").update({isActive: false});
  assert.equal((await worker.drain(offer.operationId)).state, "completed"); assert.deepEqual(await inbox(), []);
});

run("concurrent notification-only drains create one generic inbox entry", async () => {
  await command("open", "a", {shiftId: "shift_delivery_20270901", absentUserId: "a", reason: "Unavailable"});
  const offer = await command("offer", "admin", {userId: "d", reason: "Agreement", expiresAtMillis: now + 10_000});
  const results = await Promise.all([worker.drain(offer.operationId), worker.drain(offer.operationId)]);
  assert.ok(results.every((r) => r.state === "completed")); assert.equal((await inbox()).length, 1);
  assert.equal(results.filter((r) => r.replayed).length, 1); assert.equal(sheets.mutations.length, 1);
});

run("tampered receipt and reserved workbook stop before external effects", async () => {
  const value = await accept();
  await ref("shiftCoverageProjectionState", "workbook").set({operationId: "other-operation"});
  await assert.rejects(worker.drain(value.operationId), {code: "coverage_effects_workbook_reserved"});
  await ref("shiftCoverageProjectionState", "workbook").delete();
  await ref("shiftCoverageOperations", value.operationId).update({effectsDigest: "forged"});
  await assert.rejects(worker.drain(value.operationId), {code: "coverage_effects_changed"});
  assert.equal(sheets.mutations.length, 1); assert.deepEqual(await inbox(), []);
});

test("effects worker rejects any workbook outside the fixed local rehearsal", () => {
  assert.throws(() => createProvisionalCoverageEffectsWorker({config: {...config, workbookId: "shared-book"}}),
    {code: "coverage_effects_local_workbook_required"});
});

run("manual helper edits and ambiguous new labels stop before overwriting human cells", async () => {
  const value = await accept();
  setCell(sheet("turnos-reparto 2026-27"), 1, 5, {userEnteredValue: {stringValue: "Member e"}});
  await assert.rejects(worker.drain(value.operationId), {code: "coverage_effects_manual_conflict"});
  assert.equal(content(sheet("turnos-reparto 2026-27"), 1, 5).stringValue, "Member e");
  setCell(sheet("turnos-reparto 2026-27"), 1, 5, {userEnteredValue: {stringValue: "Member a"}});
  await ref("users", "e").update({displayName: "Member d"});
  await assert.rejects(worker.drain(value.operationId), /unknown or ambiguous/);
  assert.equal(sheets.mutations.length, 1); assert.deepEqual(await inbox(), []);
});

run("uncertain transport before apply can resume the exact submission", async () => {
  const value = await accept(); sheets.rejectBeforeApply = true;
  assert.equal((await worker.drain(value.operationId)).state, "pending");
  const pending = await read("shiftCoverageEffects", value.operationId);
  assert.deepEqual(await inbox(), []);
  sheets.rejectBeforeApply = false;
  assert.equal((await worker.drain(value.operationId)).state, "completed");
  assert.deepEqual((await read("shiftCoverageEffects", value.operationId)).submission, pending.submission);
  assert.equal(content(sheet("turnos-reparto 2027-28"), 1, 1).stringValue, "Member d");
});

run("concurrent acceptance drains converge on the stored submission and one inbox per recipient", async () => {
  const value = await accept();
  const results = await Promise.all([worker.drain(value.operationId), worker.drain(value.operationId)]);
  assert.ok(results.every((r) => ["completed", "pending"].includes(r.state)));
  assert.equal((await worker.drain(value.operationId)).state, "completed");
  assert.equal((await inbox()).length, 4);
  assert.equal(content(sheet("turnos-reparto 2027-28"), 1, 1).stringValue, "Member d");
  assert.equal(content(sheet("turnos-reparto 2026-27"), 1, 5).stringValue, "Member d");
});
