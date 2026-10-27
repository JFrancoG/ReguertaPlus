"use strict";
const assert = require("node:assert/strict");
const {test, before, beforeEach, after} = require("node:test");
const {Firestore} = require("@google-cloud/firestore");
const {runShiftSheetsOrdinaryWriter, parseShiftSheetsOrdinarySubmission} =
  require("../lib/shift-sheets-ordinary-writer.js");
const {parseShiftSheetsWorkbookSubmission} =
  require("../lib/shift-planning-sheets-submission.js");
const {createShiftSheetsConfig} = require("../lib/shift-sheets-config.js");
const {activeDigest} = require("./shift-coverage-fixture.cjs");
const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const run = (name, fn) => test(name, {skip: !enabled}, fn);
const projectId = "demo-reguerta-hu084-coverage";
const root = "develop/plus-collections";
const config = createShiftSheetsConfig({environment: "develop",
  workbooks: {develop: "coverage-rehearsal-book"}});
let db, revision, observations;
const pointer = () => db.doc(`${root}/shiftPlanningState/sheetsSubmission`);
const state = () => db.doc(`${root}/shiftPlanningState/current`);
const read = async () => (await pointer().get()).data();
const write = (work) => runShiftSheetsOrdinaryWriter({firestore: db, config,
  readWorkbookVersion: async () => { observations++; return revision; }}, work);
before(() => {
  if (!enabled) return;
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8798");
  assert.equal(process.env.GCLOUD_PROJECT, projectId);
  db = new Firestore({projectId, host: "127.0.0.1:8798", ssl: false});
});
beforeEach(async () => {
  if (!enabled) return;
  const cleared = await fetch(`http://127.0.0.1:8798/emulator/v1/projects/${projectId}/databases/(default)/documents`, {method: "DELETE"});
  assert.equal(cleared.ok, true); revision = "1"; observations = 0;
  await state().set({schemaVersion: 1, stateRevision: 1, writeEpoch: 1,
    maintenanceStatus: "open", activeRevision: "active-1", activeDigest,
    intakeBarrier: null, lastTransitionId: "initial"});
});
after(async () => { if (db) await db.terminate(); });

run("ordinary export reserves before source loading and preserves the verified version chain", async () => {
  let calls = 0;
  assert.equal(await write(async (fence) => {
    assert.equal((await read()).state, "reserved");
    await fence.beforeMutation(); calls++; revision = "2";
    assert.equal((await read()).state, "submitting");
    return "exported";
  }), "exported");
  const terminal = parseShiftSheetsOrdinarySubmission(await read());
  assert.equal(terminal.state, "completed");
  assert.equal(terminal.evidence.workbookRevision, "2");
  assert.equal(parseShiftSheetsWorkbookSubmission(terminal).ordinaryOperationId,
    terminal.operationId);
  assert.equal(calls, 1);
  assert.equal((await db.collection(`${root}/shiftSheetsOrdinaryOperations`).get()).size, 1);
  await write(async () => "no matching rows");
  assert.deepEqual(await read(), terminal, "no-op preserves predecessor authority");
});

run("an exception before a possible SDK submission safely restores the previous pointer", async () => {
  await write(async (fence) => { await fence.beforeMutation(); revision = "2"; });
  const predecessor = await read();
  await assert.rejects(write(async () => { throw new Error("bad source"); }), /bad source/);
  assert.deepEqual(await read(), predecessor);
  assert.equal((await db.collection(`${root}/shiftSheetsOrdinaryOperations`).get()).size, 1);
});

run("unknown SDK outcome keeps shared exclusion and never resubmits", async () => {
  let calls = 0;
  await assert.rejects(write(async (fence) => {
    await fence.beforeMutation(); calls++; throw new Error("connection lost");
  }), /connection lost/);
  const retained = await read();
  assert.equal(retained.state, "submitting");
  assert.equal(retained.evidence, null);
  const reads = observations;
  await assert.rejects(write(async () => { calls++; }),
    {code: "shift_sheets_ordinary_unresolved"});
  assert.equal(calls, 1); assert.equal(observations, reads);
  assert.deepEqual(await read(), retained);
});

run("concurrent ordinary writers cannot load sources under the same workbook reservation", async () => {
  let entered, release;
  const started = new Promise((resolve) => { entered = resolve; });
  const held = new Promise((resolve) => { release = resolve; });
  const first = write(async (fence) => {
    entered(); await held; await fence.beforeMutation(); revision = "2";
  });
  await started;
  await assert.rejects(write(async () => assert.fail("second source loading")),
    {code: "shift_sheets_ordinary_unresolved"});
  release(); await first;
});

run("pending or frozen coverage projections block ordinary SDK work; notification-only effects do not", async () => {
  const effect = db.doc(`${root}/shiftCoverageEffects/coverage-1`);
  for (const status of ["pending", "reconciliationRequired"]) {
    await effect.set({state: status, value: {changes: [{after: {id: "one"}}]}});
    await assert.rejects(write(async () => assert.fail("ordinary cannot overtake coverage")),
      {code: "shift_sheets_ordinary_unresolved"});
  }
  assert.equal(observations, 0);
  await effect.set({state: "pending", value: {changes: []}});
  assert.equal(await write(async () => "notification only"), "notification only");
  assert.equal(await read(), undefined);
});

run("authority drift before the SDK call rejects without retaining an unused reservation", async () => {
  let calls = 0;
  await assert.rejects(write(async (fence) => {
    await state().update({stateRevision: 2});
    await fence.beforeMutation(); calls++;
  }), {code: "shift_sheets_ordinary_authority_changed"});
  assert.equal(calls, 0); assert.equal(await read(), undefined);
});

run("authority drift after a possible call cannot release the reservation", async () => {
  await assert.rejects(write(async (fence) => {
    await fence.beforeMutation(); revision = "2";
    await state().update({stateRevision: 2});
  }), {code: "shift_sheets_ordinary_authority_changed"});
  assert.equal((await read()).state, "submitting");
  assert.equal((await read()).evidence, null);
});

run("SDK acknowledgement without a stable advanced version remains unresolved", async () => {
  await assert.rejects(write(async (fence) => { await fence.beforeMutation(); }),
    {code: "shift_sheets_ordinary_unresolved"});
  assert.equal((await read()).state, "submitting");
  assert.equal((await read()).evidence, null);
});

run("an out-of-band workbook version cannot be adopted as a verified predecessor", async () => {
  await write(async (fence) => { await fence.beforeMutation(); revision = "2"; });
  const predecessor = await read(); revision = "3";
  await assert.rejects(write(async () => assert.fail("no source loading")),
    {code: "shift_sheets_ordinary_unresolved"});
  assert.deepEqual(await read(), predecessor);
});

run("first governed ordinary export rejects workbook drift even without a preceding pointer", async () => {
  const policy = db.doc(`${root}/shiftPlanningState/sourcePolicy`);
  await policy.set({environment: "develop", sync: {partitions: Object.fromEntries(
    ["delivery", "market"].map((type) => [type, {
      workbookId: config.workbookId, workbookRevision: "1", partitionKey: type,
      stateRevision: 1, epoch: 0, lease: null,
    }]))}});
  revision = "2";
  await assert.rejects(write(async () => assert.fail("cannot adopt external drift")),
    {code: "shift_sheets_ordinary_unresolved"});
  assert.equal(await read(), undefined);
  assert.equal((await db.collection(`${root}/shiftSheetsOrdinaryOperations`).get()).size, 0);
});

run("a lost Firestore acknowledgement after marking a call cannot free its durable pointer", async () => {
  let transactionNumber = 0, sdkCalls = 0;
  const interrupted = {
    doc: db.doc.bind(db), collection: db.collection.bind(db),
    runTransaction: async (body) => {
      const number = ++transactionNumber;
      const result = await db.runTransaction(body);
      if (number === 3) throw new Error("Firestore acknowledgement lost");
      return result;
    },
  };
  await assert.rejects(runShiftSheetsOrdinaryWriter({firestore: interrupted,
    config, readWorkbookVersion: async () => revision}, async (fence) => {
    await fence.beforeMutation(); sdkCalls++;
  }), /Firestore acknowledgement lost/);
  assert.equal(sdkCalls, 0);
  const retained = await read();
  assert.equal(retained.submissionCount, 1);
  assert.equal(retained.state, "submitting");
  assert.throws(() => parseShiftSheetsOrdinarySubmission({...retained,
    state: "completed", evidence: {workbookRevision: "2", partitionDigest: "forged"}}));
});
