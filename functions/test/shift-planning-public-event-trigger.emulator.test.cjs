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

emulatorTest("ordinary export never opens Sheets through global or opposite-environment fallback", async (t) => {
  const vars = {
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
    for (const missing of ["SHEETS_SPREADSHEET_ID_DEVELOP", "SHEETS_DELIVERY_RANGE_DEVELOP", "SHEETS_MARKET_RANGE_DEVELOP"]) {
      Object.assign(process.env, vars); delete process.env[missing];
      await exported.onShiftWritten.run(event);
    }
    assert.equal(sheets.mock.callCount(), 0);
    assert.equal((await ledgers()).size, 0);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
