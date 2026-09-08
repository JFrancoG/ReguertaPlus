"use strict";
const assert = require("node:assert/strict");
const {after, beforeEach, test} = require("node:test");
const {Firestore, Timestamp} = require("@google-cloud/firestore");
const {fixture, fairnessSnapshot, predecessorFixture, attemptedAt, materializerInput, readDocument} = require("./shift-planning-activation-fixture.cjs");
const {materializeShiftPlanningForwardActivation} = require("../lib/shift-planning-forward-materializer.js");
const {createFirestoreShiftPlanningSyncCommandRepository} = require("../lib/shift-planning-firestore-sync-command-repository.js");
const {createFirestoreShiftPlanningSheetsConsumer, createShiftSheetsWorkbookVersionReader} = require("../lib/shift-planning-sheets-consumer.js");
const {executeShiftPlanningSyncCommand, drainShiftPlanningSyncCommands} = require("../lib/shift-planning-sync-command-executor.js");
const {createShiftPlanningSyncCommandToken} = require("../lib/shift-planning-sync-command.js");
const {parseShiftPlanningSheetsSubmission} = require("../lib/shift-planning-sheets-submission.js");
const {createShiftPlanningDigest} = require("../lib/shift-planning-digest.js");
const {createShiftSheetsAdapter} = require("../lib/shift-sheets.js");
const {createShiftSheetsConfig} = require("../lib/shift-sheets-config.js");
const {sheetsService, content} = require("./shift-sheets-api-fixture.cjs");
const projectId = "demo-reguerta-hu083-sheets-consumer";
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host) throw new Error("Isolated Firestore emulator required.");
const firestore = new Firestore({projectId});
const root = "develop/plus-collections";
const config = createShiftSheetsConfig({environment: "develop", workbooks: {develop: "reguerta-shifts"}});
const invalid = (error) => error.code === "invalid_planning_sync_command";
let now;
beforeEach(async () => {
  const response = await fetch(`http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`, {method: "DELETE"});
  assert.equal(response.ok, true);
  now = attemptedAt.toMillis() + 1000;
});
after(() => firestore.terminate());

const setup = async ({predecessor = false} = {}) => {
  const snapshot = fairnessSnapshot();
  snapshot.sync.partitions.delivery.workbookRevision = "10";
  snapshot.sync.partitions.market.workbookRevision = "10";
  const prior = predecessor ? predecessorFixture(snapshot) : null;
  const value = prior?.value ?? fixture(snapshot);
  const input = materializerInput(value);
  if (prior) input.beforeImageDocuments.push(readDocument(prior.predecessorPath, prior.predecessorDocument, attemptedAt.toMillis() - 1000));
  const activation = materializeShiftPlanningForwardActivation(input);
  const batch = firestore.batch();
  for (const mutation of activation.mutations) batch.set(firestore.doc(mutation.documentPath), mutation.data);
  batch.set(firestore.doc(`${root}/shiftPlanningBundles/${value.preflight.bundle.bundleRevision}`), value.preflight.bundle);
  batch.set(firestore.doc(`${root}/shiftPlanningState/sourcePolicy`), {environment: "develop", sync: snapshot.sync});
  await batch.commit();
  const repository = createFirestoreShiftPlanningSyncCommandRepository(firestore, () => Timestamp.fromMillis(now));
  const service = sheetsService(config.workbookId);
  let version = 10;
  let metadataReads = 0;
  const metadata = {};
  service.onMutation = async () => { version += 1; };
  const readWorkbookVersion = createShiftSheetsWorkbookVersionReader({workbookId: config.workbookId, files: {
    async get(params, options) {
      metadataReads += 1;
      assert.equal(params.fileId, config.workbookId);
      assert.equal(params.fields, "id,mimeType,trashed,version");
      assert.equal(options.retry, false);
      return {data: {id: config.workbookId, mimeType: "application/vnd.google-apps.spreadsheet", trashed: false, version: String(version), ...metadata}};
    },
  }});
  const sheets = createShiftSheetsAdapter({config, sheets: service});
  const consumer = createFirestoreShiftPlanningSheetsConsumer({firestore, config, repository, sheets, readWorkbookVersion});
  const commands = value.liveResult.syncCommands;
  const commandId = (type = "delivery") => commands.find((command) => command.type === type).commandId;
  const reference = (type) => firestore.doc(`${root}/shiftPlanningSyncCommands/${commandId(type)}`);
  const receipt = async (type) => (await reference(type).collection("externalSubmissions").doc("sheets").get()).data();
  const execute = (type = "delivery", extra = {}) => executeShiftPlanningSyncCommand({repository, consumer,
    environment: "develop", commandId: commandId(type), workerId: "worker-1", attemptId: "attempt-1", ...extra});
  return {value, prior, activation, repository, service, consumer, metadata, commandId, reference, receipt, execute,
    get metadataReads() { return metadataReads; },
    changeVersion() { version += 1; },
    async token(type = "delivery") { return createShiftPlanningSyncCommandToken({environment: "develop", command: (await reference(type).get()).data()}); },
    async partition(type = "delivery") { return (await firestore.doc(`${root}/shiftPlanningState/sourcePolicy`).get()).get(`sync.partitions.${type}`); },
  };
};

test("real executor drains both activated partitions through one batch each and replays without I/O", async () => {
  const f = await setup();
  const result = await drainShiftPlanningSyncCommands({repository: f.repository, consumer: f.consumer,
    environment: "develop", workerId: "drainer", limit: 10, createAttemptId: (_id, index) => `drain-${index}`});
  assert.deepEqual(result.map((item) => item.kind), ["completed", "completed"]);
  assert.equal(f.service.mutations.length, 2);
  assert.deepEqual(result.map((item) => item.command.terminal.readBackWorkbookRevision), ["11", "12"]);
  for (const type of ["delivery", "market"]) {
    const receipt = await f.receipt(type);
    assert.equal((await f.partition(type)).lease, null);
    assert.equal(receipt.evidence.workbookRevision, (await f.partition(type)).workbookRevision);
    assert.ok(receipt.requestDigest.startsWith("shift-sheets:v1:sha256:"));
  }
  const actualIds = f.service.state.sheets.flatMap((sheet) => sheet.data[0].rowData.slice(1).map((_, index) => content(sheet, index + 1, 0).stringValue));
  assert.deepEqual(actualIds.sort(), f.activation.publicDocuments.map((item) => item.targetPath.split("/").at(-1)).sort());
  const reads = f.metadataReads;
  assert.equal((await f.execute()).kind, "terminalReplay");
  assert.equal(f.metadataReads, reads);
  assert.equal(f.service.mutations.length, 2);
  assert.deepEqual(await f.repository.discoverRunnable({environment: "develop", limit: 10}), []);
});

test("lost acknowledgement after an applied batch is completed by exact read-back", async () => {
  const f = await setup();
  f.service.loseAcknowledgement = true;
  assert.equal((await f.execute()).kind, "completed");
  assert.equal(f.service.mutations.length, 1);
  assert.equal((await f.receipt()).evidence.workbookRevision, "11");
});

test("unknown call never resends after expiry and blocks the other partition", async () => {
  const f = await setup();
  f.service.rejectBeforeApply = true;
  assert.equal((await f.execute()).kind, "reconciliationRequired");
  const original = (await f.reference().get()).data();
  now = original.claim.expiresAt.toMillis() + 1;
  const claimed = await f.repository.claim({environment: "develop", commandId: f.commandId(), workerId: "other", attemptId: "other-attempt"});
  assert.equal(claimed.kind, "reconcile");
  assert.deepEqual(claimed.command.claim, original.claim);
  f.service.rejectBeforeApply = false;
  assert.equal((await f.execute("delivery", {workerId: "other", attemptId: "other-attempt"})).kind, "reconciliationRequired");
  await assert.rejects(f.execute("market"), invalid);
  assert.equal(f.service.mutations.length, 1);
  assert.equal((await f.partition()).lease.state, "claimed");
  assert.equal((await f.receipt()).evidence, null);
  assert.equal(await f.receipt("market"), undefined);
  await assert.rejects(f.repository.authorizeBatch(await f.token()), invalid);
});

test("a call still in flight past expiry can confirm later under its original identity", async () => {
  const f = await setup();
  let allow;
  let entered;
  const gate = new Promise((resolve) => { allow = resolve; });
  const arrival = new Promise((resolve) => { entered = resolve; });
  const originalBatch = f.service.batchUpdate;
  let invocations = 0;
  f.service.batchUpdate = async (...args) => { invocations += 1; entered(); await gate; return originalBatch.apply(f.service, args); };
  const execution = f.execute();
  await arrival;
  try {
    const original = (await f.reference().get()).data();
    now = original.claim.expiresAt.toMillis() + 1000;
    assert.equal((await f.execute("delivery", {workerId: "late-reader", attemptId: "late-read"})).kind, "reconciliationRequired");
    await assert.rejects(f.execute("market"), invalid);
    assert.equal(invocations, 1);
    allow();
    const result = await execution;
    assert.equal(result.kind, "completed");
    assert.equal(result.command.terminal.fencingEpoch, original.claim.fencingEpoch);
    assert.equal(result.command.terminal.workerId, original.claim.workerId);
    assert.equal(result.command.terminal.completedAt.toMillis(), now);
    assert.equal(f.service.mutations.length, 1);
  } finally { allow(); await execution.catch(() => {}); }
});

test("a crash after persisted read-back resumes without another Sheets read or write", async () => {
  const f = await setup();
  const broken = {...f.repository, async complete() { throw new Error("simulated completion outage"); }};
  await assert.rejects(f.execute("delivery", {repository: broken}), /completion outage/);
  assert.notEqual((await f.receipt()).evidence, null);
  const token = await f.token();
  const evidence = (await f.receipt()).evidence;
  assert.equal((await f.execute("market")).kind, "completed");
  const pointer = firestore.doc(`${root}/shiftPlanningState/sheetsSubmission`);
  assert.equal((await pointer.get()).get("command.type"), "market");
  await f.repository.verifySubmission({token, evidence});
  assert.equal((await pointer.get()).get("command.type"), "market");
  const reads = f.service.reads.length;
  now += 200000;
  assert.equal((await f.execute("delivery", {workerId: "recovery", attemptId: "recovery"})).kind, "completed");
  assert.equal(f.service.reads.length, reads);
  assert.equal(f.service.mutations.length, 2);
});

test("unverified or forged evidence cannot complete an expired submission", async () => {
  const f = await setup();
  f.service.rejectBeforeApply = true;
  await f.execute();
  now += 200000;
  const token = await f.token();
  const receipt = await f.receipt();
  const evidence = {workbookRevision: "11", partitionDigest: createShiftPlanningDigest({projectionDigest: receipt.projectionDigest})};
  await assert.rejects(f.repository.complete({token, evidence}), invalid);
  await assert.rejects(f.repository.verifySubmission({token: {...token, fencingEpoch: token.fencingEpoch + 1}, evidence}), invalid);
  await assert.rejects(f.repository.verifySubmission({token, evidence: {...evidence, partitionDigest: createShiftPlanningDigest("forged")}}), invalid);
  for (const malformed of [undefined, [], "evidence", {workbookRevision: "11"}, {...evidence, extra: true}]) {
    assert.throws(() => parseShiftPlanningSheetsSubmission({...receipt, evidence: malformed}), invalid);
  }
  assert.equal((await f.partition()).lease.state, "claimed");
});

test("an expired claim without a submission cannot use the late-confirmation path", async () => {
  const f = await setup();
  const claim = await f.repository.claim({environment: "develop", commandId: f.commandId(), workerId: "worker", attemptId: "claim-only"});
  now = claim.command.claim.expiresAt.toMillis();
  await assert.rejects(f.repository.complete({token: claim.token, evidence: {workbookRevision: "11", partitionDigest: createShiftPlanningDigest("rows")}}), invalid);
  assert.equal(f.service.mutations.length, 0);
});

test("payload drift with its old marker is rejected before any Sheets mutation", async () => {
  const f = await setup();
  const row = f.activation.publicDocuments.find((item) => item.document.type === "delivery");
  await firestore.doc(row.targetPath).update({helperUserId: "forged-helper"});
  await assert.rejects(f.execute());
  assert.equal(f.service.mutations.length, 0);
  assert.equal(await f.receipt(), undefined);
});

test("active lineage changes prevent reconciliation and leave the unknown write retained", async () => {
  const f = await setup();
  f.service.rejectBeforeApply = true;
  await f.execute();
  const reads = f.service.reads.length;
  await firestore.doc(`${root}/shiftPlanningState/current`).update({writeEpoch: 999});
  await assert.rejects(f.execute("delivery", {workerId: "other", attemptId: "other"}), invalid);
  assert.equal(f.service.reads.length, reads);
  assert.equal((await f.receipt()).evidence, null);
});

test("unexplained Drive version drift rejects a submission before batchUpdate", async () => {
  const f = await setup();
  f.changeVersion();
  await assert.rejects(f.execute(), invalid);
  assert.equal(f.service.mutations.length, 0);
  assert.equal(await f.receipt(), undefined);
});

test("metadata must identify the exact native workbook and a real int64 version", async () => {
  const f = await setup();
  for (const malformed of [{id: "other"}, {mimeType: "application/pdf"}, {trashed: true}, {version: "workbook-11"}, {version: "9223372036854775808"}]) {
    Object.assign(f.metadata, malformed);
    await assert.rejects(f.execute(), invalid);
    for (const key of Object.keys(f.metadata)) delete f.metadata[key];
  }
  assert.equal(f.service.mutations.length, 0);
});

test("read-back failure remains inspect-only until a later exact read succeeds", async () => {
  const f = await setup();
  f.service.onMutation = async () => { f.changeVersion(); f.service.failRead = true; };
  assert.equal((await f.execute()).kind, "reconciliationRequired");
  now += 200000;
  assert.equal((await f.execute()).kind, "reconciliationRequired");
  f.service.failRead = false;
  assert.equal((await f.execute()).kind, "completed");
  assert.equal(f.service.mutations.length, 1);
});

test("the prior-season predecessor helper is included in the exact command and Sheets rows", async () => {
  const f = await setup({predecessor: true});
  const command = f.value.liveResult.syncCommands.find((item) => item.type === "delivery");
  assert.deepEqual(command.affectedProjectionSeasonStartYears, [2025, 2026, 2027]);
  assert.equal((await f.execute()).kind, "completed");
  const priorTab = f.service.state.sheets.find((sheet) => sheet.properties.title === "turnos-reparto 2025-26");
  assert.equal(content(priorTab, 1, 0).stringValue, f.prior.predecessorPath.split("/").at(-1));
  assert.equal(content(priorTab, 1, 6).stringValue, "member-1");
  assert.equal(content(priorTab, 1, 4).stringValue, '["member-6"]');
});


test("a changing Drive version during read-back stays unresolved despite matching cells", async () => {
  const f = await setup();
  const originalGet = f.service.get;
  f.service.onMutation = async () => {
    f.changeVersion();
    f.service.get = async (...args) => { f.changeVersion(); return originalGet(...args); };
  };
  assert.equal((await f.execute()).kind, "reconciliationRequired");
  assert.equal((await f.receipt()).evidence, null);
  f.service.get = originalGet;
  assert.equal((await f.execute()).kind, "completed");
  assert.equal(f.service.mutations.length, 1);
});

test("activation refuses a reserved import and accepts its later verified workbook revision", async () => {
  const {parseShiftSheetsImportSubmission} = require("../lib/shift-planning-sheets-submission.js");
  const f = await setup();
  const pointer = firestore.doc(`${root}/shiftPlanningState/sheetsSubmission`);
  const receipt = parseShiftSheetsImportSubmission({schemaVersion: 1, kind: "importWriteBack", environment: "develop",
    workbookId: config.workbookId, operationId: "sheets-import-earlier", resultDigest: createShiftPlanningDigest({result: "earlier"}),
    planDigest: createShiftPlanningDigest({plan: "earlier"}), beforeWorkbookRevision: "10", batch: null, evidence: null});
  await pointer.set(receipt);
  for (const type of ["delivery", "market"]) {
    await assert.rejects(f.execute(type), /reserved by an unfinished import/);
    assert.equal((await f.reference(type).get()).get("state"), "pending");
  }
  const projectionDigest = "shift-sheets:v1:sha256:" + "a".repeat(64);
  const verified = parseShiftSheetsImportSubmission({...receipt,
    batch: {projectionDigest, requestDigest: "shift-sheets:v1:sha256:" + "b".repeat(64), submittedAt: Timestamp.fromMillis(now)},
    evidence: {workbookRevision: "11", partitionDigest: createShiftPlanningDigest({projectionDigest})}});
  await pointer.set(verified); f.changeVersion();
  assert.equal((await f.execute()).kind, "completed");
  assert.equal((await f.receipt()).beforeWorkbookRevision, "11");
  assert.equal((await f.receipt()).evidence.workbookRevision, "12");
  assert.equal(f.service.mutations.length, 1);
  assert.equal((await pointer.get()).get("command.type"), "delivery");
});


const {createShiftPlanningSheetsWorkerHttpHandler} = require("../lib/shift-planning-sheets-worker.js");
const invokeWorker = async (f, body) => {
  const result = {};
  const response = {setHeader() { return response; }, status(value) { result.status = value; return response; },
    json(value) { result.body = value; return response; }};
  const handler = createShiftPlanningSheetsWorkerHttpHandler({repository: f.repository,
    consumerFor: (environment) => { assert.equal(environment, "develop"); return f.consumer; },
    logger: {error() {}}});
  await handler({method: "POST", query: {}, body: {schemaVersion: 1, environment: "develop", ...body}}, response);
  return result;
};

test("invoked HTTP worker drains real commands and terminal retries do no Sheets or Drive I/O", async () => {
  const f = await setup({predecessor: true});
  const drained = await invokeWorker(f, {mode: "drain", limit: 2});
  assert.equal(drained.status, 200);
  assert.deepEqual(drained.body.results.map((item) => item.kind), ["completed", "completed"]);
  assert.equal(f.service.mutations.length, 2);
  const reads = f.metadataReads;
  const replay = await invokeWorker(f, {mode: "execute", commandId: f.commandId()});
  assert.equal(replay.status, 200);
  assert.deepEqual(replay.body.results, [{kind: "terminalReplay", commandId: f.commandId()}]);
  assert.equal(f.service.mutations.length, 2); assert.equal(f.metadataReads, reads);
  assert.deepEqual((await invokeWorker(f, {mode: "drain", limit: 2})).body.results, []);
});

test("HTTP poll stops at an uncertain real submission and later invocations never resend", async () => {
  const f = await setup();
  f.service.rejectBeforeApply = true;
  const first = await invokeWorker(f, {mode: "drain", limit: 2});
  assert.equal(first.status, 409);
  assert.deepEqual(first.body.results.map((item) => item.kind), ["reconciliationRequired"]);
  assert.equal(f.service.mutations.length, 1);
  const firstId = first.body.results[0].commandId;
  const persisted = (await firestore.doc(`${root}/shiftPlanningSyncCommands/${firstId}`).get()).data();
  now = persisted.claim.expiresAt.toMillis() + 1;
  f.service.rejectBeforeApply = false;
  const second = await invokeWorker(f, {mode: "execute", commandId: firstId});
  assert.equal(second.status, 409);
  assert.equal(f.service.mutations.length, 1);
  const other = f.value.liveResult.syncCommands.find((command) => command.commandId !== firstId);
  assert.equal((await firestore.doc(`${root}/shiftPlanningSyncCommands/${other.commandId}`).get()).get("state"), "pending");
});
