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
  const userIds = new Set(activation.publicDocuments.flatMap(({document}) =>
    [...document.assignedUserIds, ...(document.helperUserId ? [document.helperUserId] : [])]));
  for (const id of userIds) batch.set(firestore.doc(`${root}/users/${id}`),
    {displayName: `Persona ${id.slice(7)}`, phoneNumber: `600${id.slice(7).padStart(6, "0")}`, roles: ["member"]});
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
  for (const type of ["delivery", "market"]) {
    const receipt = await f.receipt(type);
    assert.equal(receipt.schemaVersion, 2);
    assert.equal(receipt.readable.environment, "develop");
    assert.deepEqual(receipt.readable.rows.map((row) => row.id).sort(),
      f.activation.publicDocuments.filter((item) => item.document.type === type).map((item) => item.targetPath.split("/").at(-1)).sort());
  }
  const delivery = f.service.state.sheets.find((sheet) => sheet.properties.title.includes("reparto"));
  const market = f.service.state.sheets.find((sheet) => sheet.properties.title.includes("mercado"));
  assert.equal(content(delivery, 0, 0).stringValue, "Fecha");
  assert.equal(content(market, 0, 0).stringValue, "Fecha / Persona");
  assert.match(content(delivery, 1, 1).stringValue, /^Persona /);
  assert.match(content(market, 2, 0).stringValue, /^Persona /);
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
  assert.match(content(priorTab, 1, 0).stringValue, /^\d{2}\/\d{2}\/2026$/);
  assert.equal(content(priorTab, 1, 5).stringValue, "Persona 1");
  assert.equal(content(priorTab, 1, 1).stringValue, "Persona 6");
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

const {shiftSheetsISOWeekKey} = require("../lib/shift-sheets-human-layout.js");

test("readable worker uses Madrid calendar dates and member phone aliases, persisting the exact display", async () => {
  const f = await setup();
  const first = f.activation.publicDocuments.find((item) => item.document.type === "delivery");
  const date = first.document.date.toDate(); const logical = date.toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() + (date.getUTCDay() === 0 ? -1 : 1));
  const visible = date.toISOString().slice(0, 10); const week = shiftSheetsISOWeekKey(logical);
  await firestore.doc(`${root}/deliveryCalendar/${week}`).set({weekKey: week,
    deliveryDate: Timestamp.fromDate(new Date(`${visible}T00:30:00+02:00`))});
  const memberId = first.document.assignedUserIds[0];
  await firestore.doc(`${root}/users/${memberId}`).set({displayName: "Socio con alias", roles: ["member"], telephone: "611222333"});
  assert.equal((await f.execute()).kind, "completed");
  const receipt = await f.receipt();
  const display = receipt.readable.rows.find((row) => row.id === first.targetPath.split("/").at(-1));
  assert.equal(display.visibleDate, visible); assert.equal(display.assignees[0].name, "Socio con alias");
  assert.equal(display.assignees[0].phone, "611222333");
  assert.ok(receipt.readable.sourceVersions.some((item) => item.path === `${root}/deliveryCalendar/${week}` && item.updateTime instanceof Timestamp));
  const shownDate = visible.split("-").reverse().join("/");
  assert.ok(f.service.state.sheets.some((sheet) => sheet.data[0].rowData.some((line) =>
    line.values?.[0]?.userEnteredValue?.stringValue === shownDate && line.values?.[1]?.userEnteredValue?.stringValue === "Socio con alias")));
});

test("member edits and newly created calendar overrides between planning and submission reject atomically", async () => {
  for (const mutation of ["member", "calendar", "shift"]) {
    const f = await setup(); const prepare = f.repository.prepareSubmission;
    f.repository.prepareSubmission = async (input) => {
      const sources = input.binding.readable.sourceVersions;
      if (mutation === "member") {
        const path = sources.find((source) => source.path.includes("/users/")).path;
        await firestore.doc(path).update({displayName: "Renamed during planning"});
      } else if (mutation === "calendar") {
        const path = sources.find((source) => source.path.includes("/deliveryCalendar/") && source.updateTime === null).path;
        await firestore.doc(path).set({weekKey: path.split("/").at(-1), deliveryDate: Timestamp.now()});
      } else {
        const path = sources.find((source) => source.path.includes("/shifts/")).path;
        await firestore.doc(path).update({unrelated: "changed after source read"});
      }
      return prepare(input);
    };
    await assert.rejects(f.execute(), invalid);
    assert.equal(f.service.mutations.length, 0); assert.equal(await f.receipt(), undefined);
    // Each iteration starts from a fresh emulator fixture, including old source documents.
    assert.equal((await fetch(`http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`, {method: "DELETE"})).ok, true);
  }
});

test("uncertain readable submission recovers with persisted labels after directory and calendar changes", async () => {
  const f = await setup();
  f.service.onMutation = async () => {f.changeVersion(); f.service.failRead = true;};
  assert.equal((await f.execute()).kind, "reconciliationRequired");
  const receipt = await f.receipt();
  for (const source of receipt.readable.sourceVersions) {
    if (source.path.includes("/users/")) await firestore.doc(source.path).delete();
    if (source.path.includes("/deliveryCalendar/")) await firestore.doc(source.path).set({changed: true});
  }
  now += 200000; f.service.failRead = false;
  assert.equal((await f.execute()).kind, "completed");
  assert.equal(f.service.mutations.length, 1);
  assert.deepEqual((await f.receipt()).readable, receipt.readable);
});

test("legacy schema-v1 canonical receipts still reconcile without member or calendar data", async () => {
  const f = await setup();
  const claim = await f.repository.claim({environment: "develop", commandId: f.commandId(), workerId: "legacy", attemptId: "legacy-attempt"});
  const command = claim.command; const token = await f.token();
  const rows = f.activation.publicDocuments.filter((item) => item.document.type === "delivery").map(({targetPath, document}) => ({
    id: targetPath.split("/").at(-1), type: document.type, date: document.date.toDate().toISOString().slice(0, 10),
    assignedUserIds: document.assignedUserIds, rotationOwnerUserIds: document.rotationOwnerUserIds ?? [document.rotationOwnerUserId],
    helperUserId: document.helperUserId, status: document.status, source: document.source, origin: document.origin}));
  const adapter = createShiftSheetsAdapter({config, sheets: f.service});
  await adapter.reconcile({operationId: command.idempotencyKey, rows, authorizeMutation: async (binding) => {
    await f.repository.authorizeBatch(token);
    await f.repository.prepareSubmission({token, binding: {beforeWorkbookRevision: "10",
      projectionDigest: binding.projectionDigest, requestDigest: binding.requestDigest}});
  }});
  assert.equal((await f.receipt()).schemaVersion, 1);
  for (const doc of (await firestore.collection(`${root}/users`).get()).docs) await doc.ref.delete();
  assert.equal((await f.execute()).kind, "completed"); assert.equal(f.service.mutations.length, 1);
});

test("readable receipt codec rejects incomplete, cross-scope and oversized recovery data", async () => {
  const f = await setup(); assert.equal((await f.execute()).kind, "completed");
  const receipt = await f.receipt();
  for (const mutate of [
    (value) => {value.schemaVersion = 1;},
    (value) => {value.readable.sourceVersions.pop();},
    (value) => {value.readable.sourceVersions[0].path = "production/plus-collections/users/other";},
    (value) => {value.readable.rows[0].assignees[0].name = "x".repeat(1025);},
    (value) => {value.readable.rows[0].visibleDate = "2026-02-30";},
    (value) => {value.readable.rows[0].assignees = [null];},
  ]) {
    const value = {...receipt, readable: {...receipt.readable, rows: structuredClone(receipt.readable.rows),
      sourceVersions: receipt.readable.sourceVersions.map((source) => ({...source}))}};
    mutate(value); assert.throws(() => parseShiftPlanningSheetsSubmission(value), invalid);
  }
});

test("missing named members and invalid calendar authority reject before Sheets writes", async () => {
  for (const scenario of ["member", "calendar"]) {
    const f = await setup();
    const first = f.activation.publicDocuments.find((item) => item.document.type === "delivery").document;
    if (scenario === "member") await firestore.doc(`${root}/users/${first.assignedUserIds[0]}`).delete();
    else {
      const week = shiftSheetsISOWeekKey(first.date.toDate().toISOString().slice(0, 10));
      await firestore.doc(`${root}/deliveryCalendar/${week}`).set({weekKey: "wrong", deliveryDate: Timestamp.now()});
    }
    await assert.rejects(f.execute(), invalid);
    assert.equal(f.service.mutations.length, 0); assert.equal(await f.receipt(), undefined);
    assert.equal((await fetch(`http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`, {method: "DELETE"})).ok, true);
  }
});
