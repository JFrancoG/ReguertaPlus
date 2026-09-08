"use strict";
const assert = require("node:assert/strict");
const {after, beforeEach, test} = require("node:test");
const {Firestore, Timestamp} = require("@google-cloud/firestore");
const {predecessorFixture, fairnessSnapshot, materializerInput, readDocument, attemptedAt} = require("./shift-planning-activation-fixture.cjs");
const {materializeShiftPlanningForwardActivation} = require("../lib/shift-planning-forward-materializer.js");
const {createFirestoreShiftSheetsImport} = require("../lib/shift-sheets-firestore-import.js");
const {createShiftSheetsConfig, resolveShiftSheetsTab} = require("../lib/shift-sheets-config.js");
const {createShiftSheetsAdapter} = require("../lib/shift-sheets.js");
const {classifyShiftPlanningPublicWriteEvent} = require("../lib/shift-planning-public-event-contract.js");
const {sheetsService, setCell} = require("./shift-sheets-api-fixture.cjs");
const {createShiftPlanningPublicEventRetentionPolicy} = require("../lib/shift-planning-public-event-retention.js");
const retentionPolicy = createShiftPlanningPublicEventRetentionPolicy({policyRevision: "import-test", maximumDeliveryRetryHorizonMillis: 60000, safetyMarginMillis: 1000});
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host) throw new Error("Isolated Firestore emulator required.");
const projectId = "demo-reguerta-hu083-import";
const firestore = new Firestore({projectId});
const root = "develop/plus-collections";
const config = createShiftSheetsConfig({environment: "develop", workbooks: {develop: "reguerta-shifts"}});
const currentPath = `${root}/shiftPlanningState/current`;
const projection = (id, doc) => ({id, type: doc.type, date: doc.date.toDate().toISOString().slice(0, 10),
  rotationOwnerUserIds: doc.rotationOwnerUserIds ?? [doc.rotationOwnerUserId], assignedUserIds: doc.assignedUserIds,
  helperUserId: doc.helperUserId, status: doc.status, source: doc.source, origin: doc.origin});
const invalid = (error) => error.code === "invalid_sheets_import";
let now;
beforeEach(async () => {
  assert.equal((await fetch(`http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`, {method: "DELETE"})).ok, true);
  now = attemptedAt.toMillis() + 1000;
});
after(() => firestore.terminate());
const setup = async () => {
  const snapshot = fairnessSnapshot();
  for (const type of ["delivery", "market"]) snapshot.sync.partitions[type].workbookRevision = "10";
  const prior = predecessorFixture(snapshot);
  const input = materializerInput(prior.value);
  input.beforeImageDocuments.push(readDocument(prior.predecessorPath, prior.predecessorDocument, now - 2000));
  const activation = materializeShiftPlanningForwardActivation(input);
  const batch = firestore.batch();
  for (const item of activation.publicDocuments) batch.set(firestore.doc(item.targetPath), item.document);
  const states = activation.mutations.filter((mutation) => mutation.documentPath.includes("/shiftRotations/") || mutation.documentPath === currentPath);
  for (const item of states) batch.set(firestore.doc(item.documentPath), item.documentPath === currentPath ? {...item.data, maintenanceStatus: "open", intakeBarrier: null} : {...item.data, releaseLease: null});
  batch.set(firestore.doc(`${root}/shiftPlanningState/sourcePolicy`), {environment: "develop", sync: snapshot.sync});
  for (const member of snapshot.roster) batch.set(firestore.doc(`${root}/users/${member.userId}`), {...member, displayName: member.userId, phoneNumber: null});
  await batch.commit();
  const rows = activation.publicDocuments.map((item) => projection(item.targetPath.split("/").at(-1), item.document));
  const service = sheetsService(config.workbookId);
  await createShiftSheetsAdapter({config, sheets: service}).reconcile({operationId: "initial-export", rows, authorizeMutation: async () => {}});
  service.mutations.length = 0;
  const tabs = [...new Map(rows.map((row) => { const tab = resolveShiftSheetsTab(config, row.type, row.date); return [tab.title, {...tab, layout: "canonical", decorations: []}]; })).values()];
  let version = "11";
  let versionReads = 0;
  const api = createFirestoreShiftSheetsImport({retentionPolicy, firestore, config, tabs, sheets: service, clock: () => Timestamp.fromMillis(now), readWorkbookVersion: async () => { versionReads += 1; return version; }});
  const target = rows.filter((row) => row.type === "delivery" && row.date.startsWith("2026-09")).sort((a, b) => a.date.localeCompare(b.date))[0];
  const predecessorId = prior.predecessorPath.split("/").at(-1);
  const edit = (id = target.id, assigned = ["member-3"]) => {
    const sheet = service.state.sheets.find((sheet) => sheet.data[0].rowData.some((row) => row.values[0]?.userEnteredValue?.stringValue === id));
    const rowIndex = sheet.data[0].rowData.findIndex((row) => row.values[0]?.userEnteredValue?.stringValue === id);
    setCell(sheet, rowIndex, 5, {userEnteredValue: {stringValue: JSON.stringify(assigned)}});
  };
  edit();
  const readShift = async (id) => (await firestore.doc(`${root}/shifts/${id}`).get()).data();
  return {api, service, rows, target, predecessorId, readShift, edit, tabs,
    sealedLease: states.find((item) => item.documentPath.endsWith("/delivery")).data.releaseLease,
    changeVersion() { version = "12"; }, get versionReads() { return versionReads; },
    async prepared(id = "operation-1") { return api.prepare(id); },
    resultRef: (id = "operation-1") => firestore.doc(`${root}/shiftPlanningOperations/sheets-import-${id}/sheetsImport/result`),
    commandRef: (id = "operation-1") => firestore.doc(`${root}/shiftPlanningOperations/sheets-import-${id}/sheetsImport/prepared`),
    operationRef: (id = "operation-1") => firestore.doc(`${root}/shiftPlanningOperations/sheets-import-${id}`),
  };
};

test("prepares trusted sources then atomically applies a cross-season lead/helper change", async () => {
  const f = await setup();
  const before = await f.readShift(f.target.id);
  const predecessor = await f.readShift(f.predecessorId);
  const preparation = await f.prepared();
  assert.equal(preparation.kind, "prepared");
  assert.deepEqual(await f.readShift(f.target.id), before, "prepare does no public writes");
  assert.equal(preparation.plan.patches.length, 2);
  const applied = await f.api.apply("operation-1", preparation.plan.planDigest);
  assert.equal(applied.kind, "committed");
  const after = await f.readShift(f.target.id);
  const changedPredecessor = await f.readShift(f.predecessorId);
  assert.deepEqual(after.assignedUserIds, ["member-3"]);
  assert.equal(changedPredecessor.helperUserId, "member-3");
  assert.equal(after.assignmentRevision, before.assignmentRevision + 1);
  assert.equal(changedPredecessor.assignmentRevision, predecessor.assignmentRevision + 1);
  for (const key of ["rotationOwnerUserId", "roundNumber", "positionInRound", "completion", "source", "origin", "planningRequestId"]) assert.deepEqual(after[key], before[key]);
  const terminal = (await f.operationRef().get()).data();
  assert.equal(terminal.publicMutations.length, 2);
  assert.equal(classifyShiftPlanningPublicWriteEvent({targetPath: `${root}/shifts/${f.target.id}`, before, after, operation: terminal}).kind, "controlledNoOp");
  assert.equal(classifyShiftPlanningPublicWriteEvent({targetPath: `${root}/shifts/${f.target.id}`, before: after, after: {...after, status: "confirmed"}, operation: terminal}).kind, "ordinary");
  assert.equal(applied.result.writeBackRows.length, 2);
  assert.equal(applied.result.writeBackState, "pending");
  assert.equal(f.service.mutations.length, 0);
  assert.equal((await firestore.collection(`${root}/notificationEvents`).get()).size, 0);
});

test("concurrent apply commits once and exact replay does not re-read Sheets or mutate source", async () => {
  const f = await setup(); const {plan} = await f.prepared();
  const results = await Promise.all([f.api.apply("operation-1", plan.planDigest), f.api.apply("operation-1", plan.planDigest)]);
  assert.deepEqual(results.map((item) => item.kind).sort(), ["committed", "replayed"]);
  const beforeReplay = await f.readShift(f.target.id);
  const reads = f.versionReads;
  f.changeVersion();
  assert.equal((await f.api.apply("operation-1", plan.planDigest)).kind, "replayed");
  assert.equal(f.versionReads, reads);
  assert.deepEqual(await f.readShift(f.target.id), beforeReplay);
});

test("changed membership rejects the entire plan with no public mutation", async () => {
  const f = await setup(); const {plan} = await f.prepared();
  const before = await f.readShift(f.target.id);
  await firestore.doc(`${root}/users/member-3`).update({isActive: false});
  await assert.rejects(f.api.apply("operation-1", plan.planDigest), invalid);
  assert.deepEqual(await f.readShift(f.target.id), before);
  assert.equal((await f.resultRef().get()).exists, false);
});

test("completed predecessor history stays frozen during import", async () => {
  const f = await setup();
  const old = await f.readShift(f.predecessorId);
  await firestore.doc(`${root}/shifts/${f.predecessorId}`).update({completion: {state: "completed", revision: 1,
    actualHelperUserId: old.helperUserId, helperSourceAssignmentRevision: old.assignmentRevision,
    completedAt: Timestamp.fromMillis(now)}, updatedAt: Timestamp.fromMillis(now), documentRevision: old.documentRevision + 1});
  const {plan} = await f.prepared();
  assert.equal(plan.patches.length, 1);
  const completed = await f.readShift(f.predecessorId);
  await f.api.apply("operation-1", plan.planDigest);
  assert.deepEqual(await f.readShift(f.predecessorId), completed);
});

test("source revision or assignment changes after review require a new plan", async () => {
  const f = await setup(); const {plan} = await f.prepared();
  const current = await f.readShift(f.target.id);
  await firestore.doc(`${root}/shifts/${f.target.id}`).update({documentRevision: current.documentRevision + 1});
  await assert.rejects(f.api.apply("operation-1", plan.planDigest), invalid);
  assert.equal((await f.operationRef().get()).exists, false);
});

test("inserting a chronological neighbor cannot escape the bounded source query", async () => {
  const f = await setup(); const {plan} = await f.prepared();
  const current = await f.readShift(f.target.id);
  const date = new Date(current.date.toMillis() - 86400000);
  const id = `shift_delivery_${date.toISOString().slice(0, 10).replaceAll("-", "")}`;
  const path = `${root}/shifts/${id}`;
  await firestore.doc(path).set({...current, date: Timestamp.fromDate(date), lastBackendMutation: {...current.lastBackendMutation, targetPath: path}});
  await assert.rejects(f.api.apply("operation-1", plan.planDigest), invalid);
  assert.equal((await f.resultRef().get()).exists, false);
});

test("an active notification fence on a predecessor blocks every patch", async () => {
  const f = await setup(); const {plan} = await f.prepared();
  const before = await f.readShift(f.target.id);
  await firestore.doc(`${root}/shiftPlanningNotificationFences/shift:${f.predecessorId}`).set({schemaVersion: 1,
    operationKind: "notificationDispatchResourceFence", scope: "shift", resourceId: f.predecessorId,
    intentId: "intent", eventId: "event", attemptId: "attempt", workerId: "worker", leaseEpoch: 1,
    acquiredAt: Timestamp.fromMillis(now - 1000), expiresAt: Timestamp.fromMillis(now + 29000),
    validationDigest: `shift-planning:v1:sha256:${"f".repeat(64)}`});
  await assert.rejects(f.api.apply("operation-1", plan.planDigest), invalid);
  assert.deepEqual(await f.readShift(f.target.id), before);
  assert.equal((await f.operationRef().get()).exists, false);
});

test("wrong review digest, changed prepared command and changed workbook all fail closed", async () => {
  const f = await setup(); const {plan} = await f.prepared();
  await assert.rejects(f.api.apply("operation-1", "forged"), invalid);
  f.changeVersion();
  await assert.rejects(f.api.apply("operation-1", plan.planDigest), invalid);
  await f.commandRef().update({sourceDigest: "forged"});
  await assert.rejects(f.api.apply("operation-1", plan.planDigest), invalid);
  assert.equal((await f.resultRef().get()).exists, false);
});

test("closed maintenance and pending Sheets commands prevent preparation", async () => {
  const f = await setup();
  await firestore.doc(currentPath).update({maintenanceStatus: "closed", intakeBarrier: {revision: "barrier", digest: `shift-planning:v1:sha256:${"a".repeat(64)}`, verifiedAtMillis: now}});
  await assert.rejects(f.prepared());
  await firestore.doc(currentPath).update({maintenanceStatus: "open", intakeBarrier: null});
  await firestore.doc(`${root}/shiftPlanningSyncCommands/pending`).set({state: "pending"});
  await assert.rejects(f.prepared(), invalid);
  assert.equal((await f.commandRef().get()).exists, false);
});

test("preparation rejects Firestore changes during the external read", async () => {
  const f = await setup(); const get = f.service.get; let changed = false;
  f.service.get = async (...args) => { if (!changed) { changed = true; await firestore.doc(`${root}/users/member-3`).update({isActive: false}); } return get(...args); };
  await assert.rejects(f.prepared(), invalid);
  assert.equal((await f.commandRef().get()).exists, false);
});

test("unchanged input does not create an apply command or operation terminal", async () => {
  const f = await setup(); f.edit(f.target.id, ["member-1"]);
  assert.equal((await f.prepared()).kind, "unchanged");
  assert.equal((await f.commandRef().get()).exists, false);
  assert.equal((await f.operationRef().get()).exists, false);
});

test("completion committed after review invalidates the whole original plan", async () => {
  const f = await setup(); const {plan} = await f.prepared();
  const targetBefore = await f.readShift(f.target.id);
  const old = await f.readShift(f.predecessorId);
  await firestore.doc(`${root}/shifts/${f.predecessorId}`).update({completion: {state: "completed", revision: 1,
    actualHelperUserId: old.helperUserId, helperSourceAssignmentRevision: old.assignmentRevision,
    completedAt: Timestamp.fromMillis(now)}, updatedAt: Timestamp.fromMillis(now), documentRevision: old.documentRevision + 1});
  await assert.rejects(f.api.apply("operation-1", plan.planDigest), invalid);
  assert.deepEqual(await f.readShift(f.target.id), targetBefore);
  assert.equal((await f.resultRef().get()).exists, false);
});

test("rotation release leases and a claimed workbook partition block import preparation", async () => {
  const f = await setup();
  await firestore.doc(`${root}/shiftRotations/delivery`).update({releaseLease: f.sealedLease});
  await assert.rejects(f.prepared(), invalid);
  await firestore.doc(`${root}/shiftRotations/delivery`).update({releaseLease: null});
  await firestore.doc(`${root}/shiftPlanningState/sourcePolicy`).update({"sync.partitions.delivery.lease": {state: "claimed"}});
  await assert.rejects(f.prepared(), invalid);
  assert.equal((await f.commandRef().get()).exists, false);
});

test("a failure while constructing the second write commits neither shift nor terminal", async () => {
  const f = await setup(); const {plan} = await f.prepared();
  const targetBefore = await f.readShift(f.target.id);
  const predecessorBefore = await f.readShift(f.predecessorId);
  const failing = new Proxy(firestore, {get(target, key) {
    if (key === "runTransaction") return (callback) => target.runTransaction((transaction) => {
      let writes = 0;
      return callback(new Proxy(transaction, {get(tx, method) {
        if (method === "set") return (...args) => { if (++writes === 2) throw new Error("simulated second write failure"); return tx.set(...args); };
        const value = Reflect.get(tx, method); return typeof value === "function" ? value.bind(tx) : value;
      }}));
    });
    const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
  }});
  const broken = createFirestoreShiftSheetsImport({retentionPolicy, firestore: failing, config, tabs: f.tabs, sheets: f.service, clock: () => Timestamp.fromMillis(now), readWorkbookVersion: async () => "11"});
  await assert.rejects(broken.apply("operation-1", plan.planDigest), /second write failure/);
  assert.deepEqual(await f.readShift(f.target.id), targetBefore);
  assert.deepEqual(await f.readShift(f.predecessorId), predecessorBefore);
  assert.equal((await f.operationRef().get()).exists, false);
});

test("real import provenance is retained once by the durable public-event auditor", async () => {
  const {createFirestoreShiftPlanningPublicEventAudit} = require("../lib/shift-planning-firestore-public-event-audit.js");
  const {createShiftPlanningPublicEventRetentionPolicy} = require("../lib/shift-planning-public-event-retention.js");
  const f = await setup(); const before = await f.readShift(f.target.id);
  const {plan} = await f.prepared(); await f.api.apply("operation-1", plan.planDigest);
  const after = await f.readShift(f.target.id);
  const auditor = createFirestoreShiftPlanningPublicEventAudit(firestore, createShiftPlanningPublicEventRetentionPolicy({policyRevision: "import-test", maximumDeliveryRetryHorizonMillis: 60000, safetyMarginMillis: 1000}));
  const event = {eventId: "import-event", eventTime: Timestamp.fromMillis(now + 1000), targetPath: `${root}/shifts/${f.target.id}`, before, after};
  const result = await auditor.audit(event);
  assert.equal(result.outcome.kind, "controlledNoOp");
  assert.equal(result.outcome.legacySideEffectsAllowed, false);
  assert.equal((await auditor.audit(event)).persistence, "replayed");
});

test("prepared command replay is read-only and another configured environment cannot apply it", async () => {
  const f = await setup(); const {plan} = await f.prepared();
  const reads = f.versionReads;
  assert.equal((await f.prepared()).plan.planDigest, plan.planDigest);
  assert.equal(f.versionReads, reads);
  const other = createFirestoreShiftSheetsImport({retentionPolicy, firestore, config: createShiftSheetsConfig({environment: "production", workbooks: {production: "other-book"}}), tabs: f.tabs, sheets: f.service, readWorkbookVersion: async () => "11"});
  await assert.rejects(other.apply("operation-1", plan.planDigest), invalid);
  assert.equal((await f.resultRef().get()).exists, false);
});

test("a malformed or oversized source cannot be treated as a partial baseline", async () => {
  const f = await setup();
  const batch = firestore.batch();
  for (let index = 0; index < 450; index++) batch.set(firestore.doc(`${root}/users/extra-${index}`), {roles: ["member"], isActive: true, isCommonPurchaseManager: false, displayName: `extra-${index}`, phone: null});
  await batch.commit();
  await assert.rejects(f.prepared(), invalid);
  assert.equal((await f.commandRef().get()).exists, false);
});


test("human delivery rows use canonical member phoneNumber and reject contradictory phones", async () => {
  const f = await setup();
  const tab = f.tabs.find((tab) => tab.title === resolveShiftSheetsTab(config, "delivery", f.target.date).title);
  const rows = f.rows.filter((row) => row.type === "delivery" && resolveShiftSheetsTab(config, row.type, row.date).title === tab.title);
  const batch = firestore.batch();
  for (const row of rows) batch.update(firestore.doc(`${root}/users/${row.assignedUserIds[0]}`), {phoneNumber: `600${row.assignedUserIds[0].replace("member-", "").padStart(6, "0")}`});
  await batch.commit();
  const sheet = f.service.state.sheets.find((sheet) => sheet.properties.title === tab.title);
  sheet.data[0].rowData = rows.map((row) => ({values: [row.date, row.assignedUserIds[0], `600${row.assignedUserIds[0].replace("member-", "").padStart(6, "0")}`, "", row.id === f.target.id ? "lo hace member-3" : ""].map((stringValue) => ({userEnteredValue: {stringValue}}))}));
  const tabs = f.tabs.map((item) => item === tab ? {...item, layout: "delivery_human"} : item);
  const api = createFirestoreShiftSheetsImport({retentionPolicy, firestore, config, tabs, sheets: f.service, clock: () => Timestamp.fromMillis(now), readWorkbookVersion: async () => "11"});
  const {plan} = await api.prepare("human");
  assert.deepEqual(plan.patches.find((patch) => patch.id === f.target.id).assignedUserIds, ["member-3"]);
  setCell(sheet, 0, 2, {userEnteredValue: {stringValue: "699999999"}});
  await assert.rejects(api.prepare("contradictory-phone"), invalid);
});

test("noncanonical member roles reject preparation before any public write", async () => {
  const f = await setup();
  await firestore.doc(`${root}/users/member-3`).update({roles: ["unknown"]});
  await assert.rejects(f.prepared(), invalid);
  assert.equal((await f.commandRef().get()).exists, false);
});


test("market imports update effective assignees without changing rotation ownership", async () => {
  const f = await setup();
  const market = f.rows.find((row) => row.type === "market");
  const before = await f.readShift(market.id);
  const assigned = [...market.assignedUserIds].reverse();
  f.edit(market.id, assigned);
  const {plan} = await f.prepared();
  await f.api.apply("operation-1", plan.planDigest);
  const after = await f.readShift(market.id);
  assert.deepEqual(after.assignedUserIds, assigned);
  assert.deepEqual(after.rotationPositions.map((item) => item.effectiveAssigneeUserId), assigned);
  for (let i = 0; i < 3; i++) {
    for (const key of ["rotationOwnerUserId", "roundNumber", "positionInRound", "planningReason"]) assert.deepEqual(after.rotationPositions[i][key], before.rotationPositions[i][key]);
  }
  assert.deepEqual(after.rotationOwnerUserIds, before.rotationOwnerUserIds);
  assert.deepEqual(after.completion, before.completion);
});
