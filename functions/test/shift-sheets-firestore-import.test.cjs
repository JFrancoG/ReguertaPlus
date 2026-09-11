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
  service.onMutation = async () => { version = String(BigInt(version) + 1n); };
  let versionReads = 0;
  const readWorkbookVersion = async () => { versionReads += 1; return version; };
  const api = createFirestoreShiftSheetsImport({retentionPolicy, firestore, config, tabs, sheets: service, clock: () => Timestamp.fromMillis(now), readWorkbookVersion});
  const target = rows.filter((row) => row.type === "delivery" && row.date.startsWith("2026-09")).sort((a, b) => a.date.localeCompare(b.date))[0];
  const predecessorId = prior.predecessorPath.split("/").at(-1);
  const edit = (id = target.id, assigned = ["member-3"]) => {
    const sheet = service.state.sheets.find((sheet) => sheet.data[0].rowData.some((row) => row.values[0]?.userEnteredValue?.stringValue === id));
    const rowIndex = sheet.data[0].rowData.findIndex((row) => row.values[0]?.userEnteredValue?.stringValue === id);
    setCell(sheet, rowIndex, 5, {userEnteredValue: {stringValue: JSON.stringify(assigned)}});
  };
  edit();
  const readShift = async (id) => (await firestore.doc(`${root}/shifts/${id}`).get()).data();
  return {api, service, rows, target, predecessorId, readShift, edit, tabs, activation, readWorkbookVersion,
    sealedLease: states.find((item) => item.documentPath.endsWith("/delivery")).data.releaseLease,
    changeVersion() { version = String(BigInt(version) + 1n); }, get versionReads() { return versionReads; },
    async prepared(id = "operation-1") { return api.prepare(id); },
    submissionRef: (id = "operation-1") => firestore.doc(`${root}/shiftPlanningOperations/sheets-import-${id}/sheetsImport/submission`),
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
  await firestore.doc(`${root}/shiftPlanningState/sourcePolicy`).update({"sync.partitions.delivery.lease": {state: "claimed", ownerOperationId: "other-writer", leaseEpoch: 1, acquiredAtMillis: now, deadlineAtMillis: now + 30000}});
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
  const broken = createFirestoreShiftSheetsImport({retentionPolicy, firestore: failing, config, tabs: f.tabs, sheets: f.service, clock: () => Timestamp.fromMillis(now), readWorkbookVersion: f.readWorkbookVersion});
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
  const api = createFirestoreShiftSheetsImport({retentionPolicy, firestore, config, tabs, sheets: f.service, clock: () => Timestamp.fromMillis(now), readWorkbookVersion: f.readWorkbookVersion});
  const {plan} = await api.prepare("human");
  assert.deepEqual(plan.patches.find((patch) => patch.id === f.target.id).assignedUserIds, ["member-3"]);
  const phone = structuredClone(sheet.data[0].rowData[0].values[2]);
  setCell(sheet, 0, 2, {userEnteredValue: {stringValue: "699999999"}});
  await assert.rejects(api.prepare("contradictory-phone"), invalid);
  setCell(sheet, 0, 2, phone);
  assert.equal((await api.apply("human", plan.planDigest)).kind, "committed");
  assert.equal((await api.writeBack("human", plan.planDigest)).kind, "completed");
  const resultSheet = f.service.state.sheets.find((item) => item.properties.title === tab.title);
  const targetIndex = rows.findIndex((row) => row.id === f.target.id);
  assert.equal(resultSheet.data[0].rowData[targetIndex].values[1].userEnteredValue.stringValue, "member-3");
  assert.equal(resultSheet.data[0].rowData[targetIndex].values[4].userEnteredValue, undefined);
});

test("noncanonical member roles reject preparation before any public write", async () => {
  const f = await setup();
  await firestore.doc(`${root}/users/member-3`).update({roles: ["unknown"]});
  await assert.rejects(f.prepared(), invalid);
  assert.equal((await f.commandRef().get()).exists, false);
});

const committedImport = async () => {
  const f = await setup();
  const {plan} = await f.prepared();
  await f.api.apply("operation-1", plan.planDigest);
  return Object.assign(f, {plan, writeBack: () => f.api.writeBack("operation-1", plan.planDigest)});
};
const workbookPointer = () => firestore.doc(`${root}/shiftPlanningState/sheetsSubmission`);

test("write-back updates reviewed cells and both seasons, preserves unrelated content, and acknowledges once", async () => {
  const {content} = require("./shift-sheets-api-fixture.cjs");
  const f = await committedImport();
  const resultBefore = (await f.resultRef().get()).data();
  const sourceBefore = await f.readShift(f.target.id);
  const untouched = JSON.parse(JSON.stringify(f.service.state.sheets.find((sheet) => sheet.properties.title.includes("mercado"))));
  const sheet = f.service.state.sheets.find((sheet) => sheet.data[0].rowData.some((row) => row.values[0]?.userEnteredValue?.stringValue === f.target.id));
  const index = sheet.data[0].rowData.findIndex((row) => row.values[0]?.userEnteredValue?.stringValue === f.target.id);
  setCell(sheet, index, 11, {userEnteredValue: {formulaValue: "=1+2"}});
  setCell(sheet, index, 5, {userEnteredFormat: {backgroundColor: {red: 0.7}}});
  const reservation = (await f.submissionRef().get()).data();
  assert.equal(reservation.batch, null);
  assert.deepEqual((await workbookPointer().get()).data(), reservation);
  const result = await f.writeBack();
  assert.equal(result.kind, "completed");
  assert.equal(result.evidence.workbookRevision, "12");
  assert.equal(f.service.mutations.length, 1);
  for (const row of resultBefore.writeBackRows) {
    const actualSheet = f.service.state.sheets.find((sheet) => sheet.data[0].rowData.some((item) => item.values[0]?.userEnteredValue?.stringValue === row.id));
    const actualIndex = actualSheet.data[0].rowData.findIndex((item) => item.values[0]?.userEnteredValue?.stringValue === row.id);
    assert.deepEqual(JSON.parse(content(actualSheet, actualIndex, 5).stringValue), row.assignedUserIds);
    assert.equal(content(actualSheet, actualIndex, 6).stringValue, row.helperUserId ?? "");
    const actualCells = actualSheet.data[0].rowData[actualIndex].values.slice(0, 10).map((cell) => cell.userEnteredValue.stringValue);
    const expectedHash = "shift-sheets:v1:sha256:" + require("node:crypto").createHash("sha256").update(JSON.stringify(actualCells)).digest("hex");
    assert.equal(content(actualSheet, actualIndex, 10).stringValue, expectedHash);
  }
  const updated = f.service.state.sheets.find((item) => item.properties.title === sheet.properties.title);
  assert.equal(content(updated, index, 11).formulaValue, "=1+2");
  assert.equal(updated.data[0].rowData[index].values[5].userEnteredFormat.backgroundColor.red, 0.7);
  assert.deepEqual(f.service.state.sheets.find((item) => item.properties.title === untouched.properties.title), untouched);
  assert.deepEqual((await f.resultRef().get()).data(), resultBefore);
  assert.deepEqual(await f.readShift(f.target.id), sourceBefore);
  for (const type of ["delivery", "market"]) {
    const partition = (await firestore.doc(`${root}/shiftPlanningState/sourcePolicy`).get()).get(`sync.partitions.${type}`);
    assert.equal(partition.workbookRevision, "12");
    assert.equal(partition.lease, null);
  }
  const receipt = (await f.submissionRef().get()).data();
  assert.deepEqual(receipt.evidence, result.evidence);
  assert.deepEqual((await workbookPointer().get()).data(), receipt);
  const reads = f.service.reads.length; const versions = f.versionReads;
  f.changeVersion();
  assert.equal((await f.writeBack()).kind, "replayed");
  assert.equal(f.service.reads.length, reads);
  assert.equal(f.versionReads, versions);
  assert.equal((await f.api.prepare("next-unchanged")).kind, "unchanged");
});

test("an unfinished import blocks a second import and activation claims for both partitions", async () => {
  const {createFirestoreShiftPlanningSyncCommandRepository} = require("../lib/shift-planning-firestore-sync-command-repository.js");
  const f = await committedImport();
  await assert.rejects(f.api.prepare("second-import"), invalid);
  const repository = createFirestoreShiftPlanningSyncCommandRepository(firestore, () => Timestamp.fromMillis(now));
  for (const item of f.activation.mutations.filter((item) => item.documentPath.includes("/shiftPlanningSyncCommands/"))) {
    await firestore.doc(item.documentPath).set(item.data);
    await assert.rejects(repository.claim({environment: "develop", commandId: item.data.commandId, workerId: "activation", attemptId: "attempt"}), /reserved by an unfinished import/);
    assert.equal((await firestore.doc(item.documentPath).get()).get("state"), "pending");
  }
  assert.equal(f.service.mutations.length, 0);
});

test("lost write-back response is verified without resending", async () => {
  const f = await committedImport(); f.service.loseAcknowledgement = true;
  assert.equal((await f.writeBack()).kind, "completed");
  assert.equal(f.service.mutations.length, 1);
  assert.notEqual((await f.submissionRef().get()).get("evidence"), null);
});

test("unknown write-back never resends after elapsed time and retains the shared reservation", async () => {
  const f = await committedImport(); f.service.rejectBeforeApply = true;
  assert.equal((await f.writeBack()).kind, "reconciliationRequired");
  const original = (await f.submissionRef().get()).data();
  now += 86400000;
  f.service.rejectBeforeApply = false;
  assert.equal((await f.writeBack()).kind, "reconciliationRequired");
  assert.equal(f.service.mutations.length, 1);
  assert.deepEqual((await f.submissionRef().get()).data(), original);
  await assert.rejects(f.api.prepare("next"), invalid);
});

test("concurrent write-back callers can submit only one batch", async () => {
  const f = await committedImport();
  const results = await Promise.allSettled([f.writeBack(), f.writeBack()]);
  assert.ok(results.some((result) => result.status === "fulfilled" && ["completed", "replayed"].includes(result.value.kind)));
  assert.equal(f.service.mutations.length, 1);
  assert.notEqual((await f.submissionRef().get()).get("evidence"), null);
});

test("an in-flight batch stays inspect-only and can confirm under its original receipt", async () => {
  const f = await committedImport();
  let release; let entered;
  const gate = new Promise((resolve) => { release = resolve; });
  const arrival = new Promise((resolve) => { entered = resolve; });
  const send = f.service.batchUpdate; let calls = 0;
  f.service.batchUpdate = async (...args) => { calls += 1; entered(); await gate; return send(...args); };
  const execution = f.writeBack();
  await arrival;
  try {
    const original = (await f.submissionRef().get()).data();
    now += 86400000;
    assert.equal((await f.writeBack()).kind, "reconciliationRequired");
    assert.equal(calls, 1);
    release();
    assert.equal((await execution).kind, "completed");
    assert.deepEqual((await f.submissionRef().get()).get("batch"), original.batch);
    assert.equal(calls, 1);
  } finally { release(); await execution.catch(() => {}); }
});

test("unavailable read-back leaves the original submission inspect-only until verification succeeds", async () => {
  const f = await committedImport(); const onMutation = f.service.onMutation;
  f.service.onMutation = async () => { await onMutation(); f.service.failRead = true; };
  assert.equal((await f.writeBack()).kind, "reconciliationRequired");
  assert.equal((await f.submissionRef().get()).get("evidence"), null);
  f.service.failRead = false;
  assert.equal((await f.writeBack()).kind, "completed");
  assert.equal(f.service.mutations.length, 1);
});

test("Firestore source changed during Sheets planning rejects submission before I/O", async () => {
  const f = await committedImport(); const get = f.service.get; let changed = false;
  f.service.get = async (...args) => {
    if (!changed && args[0].ranges) { changed = true; await firestore.doc(`${root}/users/member-3`).update({isActive: false}); }
    return get(...args);
  };
  await assert.rejects(f.writeBack());
  assert.equal(f.service.mutations.length, 0);
  assert.equal((await f.submissionRef().get()).get("batch"), null);
});

test("changed reviewed cells, formulas and protection cannot be overwritten", async () => {
  const f = await committedImport();
  const sheet = f.service.state.sheets.find((sheet) => sheet.data[0].rowData.some((row) => row.values[0]?.userEnteredValue?.stringValue === f.target.id));
  const index = sheet.data[0].rowData.findIndex((row) => row.values[0]?.userEnteredValue?.stringValue === f.target.id);
  for (const value of [{stringValue: '["member-4"]'}, {formulaValue: '=CONCATENATE("member-3")'}]) {
    setCell(sheet, index, 5, {userEnteredValue: value});
    await assert.rejects(f.writeBack());
  }
  setCell(sheet, index, 5, {userEnteredValue: {stringValue: '["member-3"]'}});
  sheet.protectedRanges = [{range: {sheetId: sheet.properties.sheetId}}];
  await assert.rejects(f.writeBack());
  assert.equal(f.service.mutations.length, 0);
  assert.equal((await f.submissionRef().get()).get("batch"), null);
});

test("changed workbook revision and wrong reviewed digest reject write-back before mutation", async () => {
  const f = await committedImport();
  await assert.rejects(f.api.writeBack("operation-1", "wrong"), invalid);
  f.changeVersion(); await assert.rejects(f.writeBack(), invalid);
  assert.equal(f.service.mutations.length, 0);
});

test("a crash before atomic acknowledgement leaves receipt and partition revisions unchanged", async () => {
  const f = await committedImport();
  const failing = new Proxy(firestore, {get(target, key) {
    if (key === "runTransaction") return (callback) => target.runTransaction((transaction) => callback(new Proxy(transaction, {get(tx, method) {
      if (method === "set") return (ref, value, ...args) => { if (value?.kind === "importWriteBack" && value.evidence) throw new Error("acknowledgement outage"); return tx.set(ref, value, ...args); };
      const value = Reflect.get(tx, method); return typeof value === "function" ? value.bind(tx) : value;
    }})));
    const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
  }});
  const api = createFirestoreShiftSheetsImport({retentionPolicy, firestore: failing, config, tabs: f.tabs, sheets: f.service, clock: () => Timestamp.fromMillis(now), readWorkbookVersion: f.readWorkbookVersion});
  await assert.rejects(api.writeBack("operation-1", f.plan.planDigest), /acknowledgement outage/);
  assert.equal((await f.submissionRef().get()).get("evidence"), null);
  assert.equal((await firestore.doc(`${root}/shiftPlanningState/sourcePolicy`).get()).get("sync.partitions.delivery.workbookRevision"), "10");
  assert.equal((await f.writeBack()).kind, "completed");
  assert.equal(f.service.mutations.length, 1);
});

test("changed source after physical submission cannot acknowledge or silently release the reservation", async () => {
  const f = await committedImport(); const onMutation = f.service.onMutation;
  f.service.onMutation = async () => { await onMutation(); await firestore.doc(`${root}/shifts/${f.target.id}`).update({status: "confirmed"}); };
  await assert.rejects(f.writeBack());
  await assert.rejects(f.writeBack());
  assert.equal(f.service.mutations.length, 1);
  assert.equal((await f.submissionRef().get()).get("evidence"), null);
});

test("acknowledged replay cannot overwrite a subsequent import reservation", async () => {
  const f = await committedImport();
  assert.equal((await f.writeBack()).kind, "completed");
  f.edit(f.target.id, ["member-4"]); f.changeVersion();
  const {plan} = await f.api.prepare("second");
  await f.api.apply("second", plan.planDigest);
  const pointer = (await workbookPointer().get()).data();
  assert.equal(pointer.operationId, "sheets-import-second");
  const reads = f.service.reads.length;
  assert.equal((await f.writeBack()).kind, "replayed");
  assert.equal(f.service.reads.length, reads);
  assert.deepEqual((await workbookPointer().get()).data(), pointer);
  assert.equal((await f.api.writeBack("second", plan.planDigest)).kind, "completed");
  assert.equal(f.service.mutations.length, 2);
  assert.deepEqual((await f.resultRef().get()).get("writeBackRows").find((row) => row.id === f.target.id).assignedUserIds, ["member-3"]);
});

test("an unstable Drive observation prevents acknowledgement even with exact cells", async () => {
  const f = await committedImport(); const get = f.service.get; const onMutation = f.service.onMutation;
  f.service.onMutation = async () => { await onMutation(); f.service.get = async (...args) => { f.changeVersion(); return get(...args); }; };
  assert.equal((await f.writeBack()).kind, "reconciliationRequired");
  assert.equal((await f.submissionRef().get()).get("evidence"), null);
  f.service.get = get;
  assert.equal((await f.writeBack()).kind, "completed");
  assert.equal(f.service.mutations.length, 1);
});

test("receipt corruption cannot authorize another send or release another workbook", async () => {
  const f = await committedImport();
  const receipt = (await f.submissionRef().get()).data();
  for (const delta of [{resultDigest: "shift-planning:v1:sha256:" + "a".repeat(64)}, {workbookId: "wrong-book"}, {operationId: "sheets-import-other"}, {evidence: {workbookRevision: "12", partitionDigest: "shift-planning:v1:sha256:" + "b".repeat(64)}}]) {
    await f.submissionRef().set({...receipt, ...delta});
    await assert.rejects(f.writeBack());
  }
  assert.equal(f.service.mutations.length, 0);
  assert.deepEqual((await workbookPointer().get()).data(), receipt);
});

test("a notification fence acquired after import commit blocks write-back before submission", async () => {
  const f = await committedImport();
  await firestore.doc(`${root}/shiftPlanningNotificationFences/shift:${f.predecessorId}`).set({schemaVersion: 1,
    operationKind: "notificationDispatchResourceFence", scope: "shift", resourceId: f.predecessorId,
    intentId: "intent", eventId: "event", attemptId: "attempt", workerId: "worker", leaseEpoch: 1,
    acquiredAt: Timestamp.fromMillis(now - 1000), expiresAt: Timestamp.fromMillis(now + 29000),
    validationDigest: `shift-planning:v1:sha256:${"f".repeat(64)}`});
  await assert.rejects(f.writeBack(), /Notification fence blocks write-back/);
  assert.equal(f.service.mutations.length, 0);
  assert.equal((await f.submissionRef().get()).get("batch"), null);
});

test("a neighbor revision changed after commit blocks write-back despite unchanged projected cells", async () => {
  const f = await committedImport();
  const neighbor = f.plan.sourceGuards.find((guard) => !f.plan.patches.some((patch) => patch.id === guard.row.id));
  assert.ok(neighbor);
  await firestore.doc(`${root}/shifts/${neighbor.row.id}`).update({documentRevision: neighbor.documentRevision + 1});
  await assert.rejects(f.writeBack(), /neighbor changed after commit/);
  assert.equal(f.service.mutations.length, 0);
  assert.equal((await f.submissionRef().get()).get("batch"), null);
});

test("one import writes delivery and market patches in the same physical batch", async () => {
  const f = await setup();
  const market = f.rows.find((row) => row.type === "market");
  const before = await f.readShift(market.id);
  const assignees = [...market.assignedUserIds].reverse();
  f.edit(market.id, assignees);
  const {plan} = await f.prepared();
  await f.api.apply("operation-1", plan.planDigest);
  assert.equal((await f.api.writeBack("operation-1", plan.planDigest)).kind, "completed");
  assert.equal(f.service.mutations.length, 1);
  const row = f.service.state.sheets.flatMap((sheet) => sheet.data[0].rowData).find((row) => row.values[0]?.userEnteredValue?.stringValue === market.id);
  assert.deepEqual(JSON.parse(row.values[5].userEnteredValue.stringValue), assignees);
  const after = await f.readShift(market.id);
  assert.deepEqual(after.rotationOwnerUserIds, market.rotationOwnerUserIds);
  assert.deepEqual(after.rotationPositions.map((position) => position.effectiveAssigneeUserId), assignees);
  for (let index = 0; index < 3; index++) {
    for (const key of ["rotationOwnerUserId", "roundNumber", "positionInRound", "planningReason"]) {
      assert.deepEqual(after.rotationPositions[index][key], before.rotationPositions[index][key]);
    }
  }
  assert.equal((await f.resultRef().get()).get("writeBackRows").length, 3);
});

const {createShiftSheetsImportHttpHandler} = require("../lib/shift-sheets-import-http.js");
const invokeImport = async (f, mode, expectedPlanDigest) => {
  const result = {};
  const response = {setHeader() { return response; }, status(v) { result.status = v; return response; }, json(v) { result.body = v; return response; }};
  const handler = createShiftSheetsImportHttpHandler({importerFor: (environment) => {
    assert.equal(environment, "develop"); return f.api;
  }, logger: {error() {}}});
  const body = {schemaVersion: 1, environment: "develop", operationId: "http-import-1", mode,
    ...(expectedPlanDigest ? {expectedPlanDigest} : {})};
  await handler({method: "POST", query: {}, body}, response);
  return result;
};

test("HTTP import keeps review, atomic apply and write-back separate and replayable", async () => {
  const f = await setup();
  const before = await f.readShift(f.target.id);
  const prepared = await invokeImport(f, "prepare");
  assert.equal(prepared.status, 200); assert.equal(prepared.body.plan.patches.length, 2);
  const digest = prepared.body.plan.planDigest;
  assert.deepEqual(await f.readShift(f.target.id), before);
  assert.equal((await f.resultRef("http-import-1").get()).exists, false);
  const invalid = await invokeImport(f, "apply", "shift-planning:v1:sha256:" + "0".repeat(64));
  assert.equal(invalid.status, 409); assert.deepEqual(await f.readShift(f.target.id), before);
  const applied = await invokeImport(f, "apply", digest);
  assert.equal(applied.status, 200); assert.equal(applied.body.kind, "committed");
  assert.deepEqual((await f.readShift(f.target.id)).assignedUserIds, ["member-3"]);
  assert.equal(f.service.mutations.length, 0);
  const written = await invokeImport(f, "writeBack", digest);
  assert.equal(written.status, 200); assert.equal(written.body.kind, "completed");
  assert.equal(f.service.mutations.length, 1);
  const reads = f.versionReads; f.changeVersion();
  for (const mode of ["apply", "writeBack"]) {
    const replay = await invokeImport(f, mode, digest);
    assert.equal(replay.status, 200); assert.equal(replay.body.kind, "replayed");
  }
  assert.equal(f.versionReads, reads); assert.equal(f.service.mutations.length, 1);
});

test("HTTP apply rejects stale reviewed authority without public changes", async () => {
  const f = await setup(); const before = await f.readShift(f.target.id);
  const prepared = await invokeImport(f, "prepare"); f.changeVersion();
  const result = await invokeImport(f, "apply", prepared.body.plan.planDigest);
  assert.equal(result.status, 409); assert.deepEqual(await f.readShift(f.target.id), before);
  assert.equal((await f.resultRef("http-import-1").get()).exists, false);
  assert.equal(f.service.mutations.length, 0);
});

test("HTTP write-back reports uncertainty and never turns a retry into another batch", async () => {
  const f = await setup(); const prepared = await invokeImport(f, "prepare");
  const digest = prepared.body.plan.planDigest;
  assert.equal((await invokeImport(f, "apply", digest)).status, 200);
  f.service.rejectBeforeApply = true;
  const first = await invokeImport(f, "writeBack", digest);
  assert.equal(first.status, 409); assert.equal(first.body.kind, "reconciliationRequired");
  f.service.rejectBeforeApply = false;
  const retry = await invokeImport(f, "writeBack", digest);
  assert.equal(retry.status, 409); assert.equal(retry.body.kind, "reconciliationRequired");
  assert.equal(f.service.mutations.length, 1);
});


test("prepares the readable seasonal union with real names, notes, formulas and a trusted Madrid override", async () => {
  const f = await setup();
  const users = await firestore.collection(`${root}/users`).get();
  const names = new Map(users.docs.map((doc, index) => [doc.id, `Persona ${index + 1}`]));
  for (const doc of users.docs) await doc.ref.update({displayName: names.get(doc.id)});
  const {buildDeliveryCalendarOverride} = require("../lib/delivery-calendar-command.js");
  const {deliveryDateMillis} = buildDeliveryCalendarOverride({weekKey: "2026-W36", deliveryWeekday: "FRI", actorMemberId: "member-1", updatedAtMillis: now});
  await firestore.doc(`${root}/deliveryCalendar/2026-W36`).set({weekKey: "2026-W36", deliveryDate: Timestamp.fromMillis(deliveryDateMillis)});
  const formatter = new Intl.DateTimeFormat("es-ES", {timeZone: "Europe/Madrid", day: "numeric", month: "long", year: "numeric"});
  const tabs = f.tabs.map((tab) => ({...tab, layout: `${tab.type}_human`}));
  for (const tab of tabs) {
    const sheet = f.service.state.sheets.find((sheet) => sheet.properties.title === tab.title);
    const rows = f.rows.filter((row) => resolveShiftSheetsTab(config, row.type, row.date).title === tab.title);
    const values = rows.flatMap((row) => row.type === "delivery" ?
      [[row.id === f.target.id ? "4/9/2026" : row.date, names.get(row.id === f.target.id ? "member-3" : row.assignedUserIds[0]), "", "Nota", "Traer cajas"]] :
      [[formatter.format(new Date(`${row.date}T00:00:00Z`)).toUpperCase(), "Nota de fecha"], ...row.assignedUserIds.map((id) => [names.get(id), "", "Nota"])]);
    sheet.data[0].rowData = values.map((row) => ({values: row.map((stringValue) => ({userEnteredValue: {stringValue}}))}));
    setCell(sheet, tab.type === "delivery" ? 0 : 1, tab.type === "delivery" ? 3 : 2, {userEnteredValue: {formulaValue: "=1+2"}});
  }
  const before = await f.readShift(f.target.id);
  const originalSheets = structuredClone(f.service.state);
  const api = createFirestoreShiftSheetsImport({retentionPolicy, firestore, config, tabs, sheets: f.service, clock: () => Timestamp.fromMillis(now), readWorkbookVersion: f.readWorkbookVersion});
  const result = await api.prepare("readable-union");
  assert.equal(result.kind, "prepared");
  assert.deepEqual(result.plan.patches.find((patch) => patch.id === f.target.id).assignedUserIds, ["member-3"]);
  assert.equal(result.plan.patches.find((patch) => patch.id === f.predecessorId).helperUserId, "member-3");
  assert.deepEqual(await f.readShift(f.target.id), before);
  assert.deepEqual(f.service.state, originalSheets);
  assert.equal((await api.apply("readable-union", result.plan.planDigest)).kind, "committed");
  assert.equal((await api.writeBack("readable-union", result.plan.planDigest)).kind, "completed");
  assert.equal((await api.writeBack("readable-union", result.plan.planDigest)).kind, "replayed");
  assert.equal(f.service.mutations.length, 1);
  for (const sheet of f.service.state.sheets) {
    const original = originalSheets.sheets.find((item) => item.properties.sheetId === sheet.properties.sheetId);
    assert.deepEqual(sheet.data, original.data, "already edited human values and annotations remain unchanged");
  }
  assert.equal((await firestore.collection(`${root}/notificationEvents`).get()).size, 0);
});

test("calendar edits during preparation or after review invalidate the import source", async () => {
  const f = await setup();
  const calendar = firestore.doc(`${root}/deliveryCalendar/2026-W36`);
  const originalGet = f.service.get;
  let injected = false;
  f.service.get = async (...args) => {
    if (!injected) { injected = true; await calendar.set({deliveryDate: Timestamp.fromDate(new Date("2026-09-04T00:00:00Z"))}); }
    return originalGet(...args);
  };
  await assert.rejects(f.api.prepare("calendar-race"), invalid);
  assert.equal((await f.commandRef("calendar-race").get()).exists, false);
  const {plan} = await f.api.prepare("calendar-reviewed");
  await calendar.delete();
  await assert.rejects(f.api.apply("calendar-reviewed", plan.planDigest), invalid);
  assert.equal((await f.operationRef("calendar-reviewed").get()).exists, false);
  assert.equal(f.service.mutations.length, 0);
});


const readableMarketImport = async () => {
  const f = await setup(); f.edit(f.target.id, f.target.assignedUserIds);
  const target = f.rows.find((row) => row.type === "market");
  const tab = f.tabs.find((item) => item.type === "market" && item.title === resolveShiftSheetsTab(config, "market", target.date).title);
  const users = await firestore.collection(`${root}/users`).get();
  const substitute = users.docs.find((doc) => !target.assignedUserIds.includes(doc.id)).id;
  const tabs = f.tabs.map((item) => item === tab ? {...item, layout: "market_human"} : item);
  const rows = f.rows.filter((row) => row.type === "market" && resolveShiftSheetsTab(config, row.type, row.date).title === tab.title);
  const sheet = f.service.state.sheets.find((item) => item.properties.title === tab.title);
  const values = rows.flatMap((row) => [[row.date, "Nota cabecera"], ...row.assignedUserIds.map((id, index) =>
    [id, "", row.id === target.id && index === 0 ? `lo hace ${substitute}` : "Nota conservada"])]);
  sheet.data[0].rowData = values.map((row) => ({values: row.map((stringValue) => ({userEnteredValue: {stringValue}}))}));
  setCell(sheet, 2, 2, {userEnteredValue: {formulaValue: "=1+2"}, note: "Comentario", userEnteredFormat: {textFormat: {bold: true}}});
  const api = createFirestoreShiftSheetsImport({retentionPolicy, firestore, config, tabs, sheets: f.service,
    clock: () => Timestamp.fromMillis(now), readWorkbookVersion: f.readWorkbookVersion});
  return {...f, api, marketTarget: target, marketTab: tab, substitute, marketBefore: structuredClone(sheet)};
};

test("HTTP human prepare/apply/write-back replaces one market participant, consumes only its instruction and replays once", async () => {
  const f = await readableMarketImport();
  const before = await f.readShift(f.marketTarget.id);
  const prepared = await invokeImport(f, "prepare");
  assert.equal(prepared.status, 200);
  const digest = prepared.body.plan.planDigest;
  assert.equal(prepared.body.plan.patches.length, 1);
  assert.equal((await invokeImport(f, "apply", digest)).body.kind, "committed");
  f.service.loseAcknowledgement = true;
  assert.equal((await invokeImport(f, "writeBack", digest)).body.kind, "completed");
  const after = await f.readShift(f.marketTarget.id);
  assert.deepEqual(after.assignedUserIds, [f.substitute, ...before.assignedUserIds.slice(1)]);
  assert.deepEqual(after.rotationOwnerUserIds, before.rotationOwnerUserIds);
  assert.deepEqual(after.completion, before.completion);
  const sheet = f.service.state.sheets.find((item) => item.properties.title === f.marketTab.title);
  assert.equal(sheet.data[0].rowData[1].values[0].userEnteredValue.stringValue, f.substitute);
  assert.equal(sheet.data[0].rowData[1].values[2].userEnteredValue, undefined);
  assert.deepEqual(sheet.data[0].rowData[0], f.marketBefore.data[0].rowData[0]);
  assert.deepEqual(sheet.data[0].rowData.slice(2), f.marketBefore.data[0].rowData.slice(2));
  assert.equal(f.service.mutations.length, 1);
  assert.equal((await invokeImport(f, "writeBack", digest)).body.kind, "replayed");
  assert.equal((await invokeImport(f, "apply", digest)).body.kind, "replayed");
  assert.equal(f.service.mutations.length, 1);
  assert.equal((await f.api.prepare("after-human-write-back")).kind, "unchanged");
  assert.equal((await firestore.collection(`${root}/notificationEvents`).get()).size, 0);
});

test("human unknown submissions stay inspect-only after elapsed time", async () => {
  const f = await readableMarketImport(); const {plan} = await f.api.prepare("human-unknown");
  await f.api.apply("human-unknown", plan.planDigest);
  f.service.rejectBeforeApply = true;
  assert.equal((await f.api.writeBack("human-unknown", plan.planDigest)).kind, "reconciliationRequired");
  now += 86400000;
  assert.equal((await f.api.writeBack("human-unknown", plan.planDigest)).kind, "reconciliationRequired");
  assert.equal(f.service.mutations.length, 1);
  assert.equal((await f.submissionRef("human-unknown").get()).get("evidence"), null);
});

test("human changes after review or calendar changes after apply cannot obtain a Sheets submission", async () => {
  for (const changeCalendar of [false, true]) {
    const f = await readableMarketImport(); const id = `human-stale-${changeCalendar}`;
    const {plan} = await f.api.prepare(id); await f.api.apply(id, plan.planDigest);
    if (changeCalendar) {
      await firestore.doc(`${root}/deliveryCalendar/2026-W36`).set({deliveryDate: Timestamp.fromDate(new Date("2026-09-04T00:00:00Z"))});
    } else {
      const sheet = f.service.state.sheets.find((item) => item.properties.title === f.marketTab.title);
      setCell(sheet, 2, 2, {userEnteredValue: {formulaValue: "=9"}});
    }
    await assert.rejects(f.api.writeBack(id, plan.planDigest));
    assert.equal((await f.submissionRef(id).get()).get("batch"), null);
    assert.equal(f.service.mutations.length, 0);
    // Each fixture needs an isolated store; the unfinished reservation stays intact.
    if (!changeCalendar) assert.equal((await fetch(`http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`, {method: "DELETE"})).ok, true);
  }
});

test("generated delivery import refreshes predecessor helper cells and can be generated again", async () => {
  const f = await setup();
  f.service.state.sheets = [];
  const display = (rows) => rows.map((row) => ({id: row.id, visibleDate: row.date,
    assignees: row.assignedUserIds.map((userId) => ({userId, name: userId, phone: ""})),
    helper: row.helperUserId ? {userId: row.helperUserId, name: row.helperUserId} : null}));
  const adapter = createShiftSheetsAdapter({config, sheets: f.service});
  await adapter.reconcile({operationId: "readable-initial", rows: f.rows, generationRows: display(f.rows), authorizeMutation: async () => {}});
  const tabs = f.tabs.map((tab) => ({...tab, layout: `${tab.type}_human`, decorations: [{rowNumber: 1,
    cells: f.service.state.sheets.find((sheet) => sheet.properties.title === tab.title).data[0].rowData[0].values.map((c) => c.userEnteredValue.stringValue)}]}));
  const locate = (row) => {
    const sheet = f.service.state.sheets.find((item) => item.properties.title === resolveShiftSheetsTab(config, row.type, row.date).title);
    const index = sheet.data[0].rowData.findIndex((line) => line.values?.[0]?.userEnteredValue?.stringValue === row.date.split("-").reverse().join("/"));
    return {sheet, index};
  };
  const target = locate(f.target);
  setCell(target.sheet, target.index, 4, {userEnteredValue: {stringValue: "lo hace member-3"}});
  f.changeVersion(); f.service.mutations.length = 0;
  const api = createFirestoreShiftSheetsImport({retentionPolicy, firestore, config, tabs, sheets: f.service,
    clock: () => Timestamp.fromMillis(now), readWorkbookVersion: f.readWorkbookVersion});
  const {plan} = await api.prepare("generated-import");
  await api.apply("generated-import", plan.planDigest);
  f.service.loseAcknowledgement = true;
  assert.equal((await api.writeBack("generated-import", plan.planDigest)).kind, "completed");
  const prior = locate(f.rows.find((row) => row.id === f.predecessorId));
  assert.equal(prior.sheet.data[0].rowData[prior.index].values[5].userEnteredValue.stringValue, "member-3");
  const updated = await Promise.all(f.rows.map(async (row) => projection(row.id, await f.readShift(row.id))));
  assert.equal((await adapter.reconcile({operationId: "after-reviewed-import", rows: updated, generationRows: display(updated),
    authorizeMutation: async () => {}})).kind, "verified");
  assert.equal((await api.prepare("after-reimport")).kind, "unchanged");
  assert.equal((await firestore.collection(`${root}/notificationEvents`).get()).size, 0);
});

test("already-effective instruction is consumed without changing assignments or assignment revision", async () => {
  const f = await readableMarketImport();
  const sheet = f.service.state.sheets.find((item) => item.properties.title === f.marketTab.title);
  setCell(sheet, 1, 2, {userEnteredValue: {stringValue: `lo hace ${f.marketTarget.assignedUserIds[0]}`}});
  const before = await f.readShift(f.marketTarget.id);
  const {kind, plan} = await f.api.prepare("same-assignee");
  assert.equal(kind, "prepared");
  await f.api.apply("same-assignee", plan.planDigest);
  await f.api.writeBack("same-assignee", plan.planDigest);
  const after = await f.readShift(f.marketTarget.id);
  assert.deepEqual(after.assignedUserIds, before.assignedUserIds);
  assert.equal(after.assignmentRevision, before.assignmentRevision);
  assert.equal(after.documentRevision, before.documentRevision + 1);
  assert.equal(f.service.state.sheets.find((item) => item.properties.title === f.marketTab.title).data[0].rowData[1].values[2].userEnteredValue, undefined);
  assert.equal((await f.api.prepare("same-assignee-replay")).kind, "unchanged");
});

test("an already-effective instruction never reopens completed history", async () => {
  const f = await readableMarketImport();
  const sheet = f.service.state.sheets.find((item) => item.properties.title === f.marketTab.title);
  setCell(sheet, 1, 2, {userEnteredValue: {stringValue: `lo hace ${f.marketTarget.assignedUserIds[0]}`}});
  const old = await f.readShift(f.marketTarget.id);
  await firestore.doc(`${root}/shifts/${f.marketTarget.id}`).update({completion: {state: "completed", revision: 1,
    actualHelperUserId: null, helperSourceAssignmentRevision: null, completedAt: Timestamp.fromMillis(now)},
    updatedAt: Timestamp.fromMillis(now), documentRevision: old.documentRevision + 1});
  const before = await f.readShift(f.marketTarget.id);
  assert.equal((await f.api.prepare("completed-instruction")).kind, "unchanged");
  assert.deepEqual(await f.readShift(f.marketTarget.id), before);
  assert.equal(f.service.mutations.length, 0);
});
