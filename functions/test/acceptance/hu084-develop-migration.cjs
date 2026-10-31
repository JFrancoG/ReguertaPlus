"use strict";

// Private-data acceptance against one fixed loopback project. No live capture,
// Google client or deployed control-plane authority is constructed here.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {createHash} = require("node:crypto");
const {test, before, after} = require("node:test");
const evidenceDirectory = process.env.HU084_MIGRATION_EVIDENCE_DIR;
const resultDirectory = process.env.HU084_MIGRATION_RESULT_DIR;
const enabled = Boolean(evidenceDirectory && resultDirectory);
const root = "develop/plus-collections";
let db, exported, google, originalSheets, originalDrive, messaging;
const originalMessagingMethods = new Map();
let externalCalls = 0;
const completed = {};
let sourceDigests = {};
const services = [];
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const sha = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const migration = require("../../scripts/rehearse-develop-shift-migration.cjs");
const {createShiftPlanningDigest: digest} = require("../../lib/shift-planning-digest.js");
const {encodeShiftPlanningFirestoreValue: encodeValue,
  decodeShiftPlanningFirestoreDocument: decode, parseShiftPlanningBeforeImageEnvelope,
  parseShiftPlanningPublicShiftDocument} = require("../../lib/shift-planning-publication-contract.js");
const {scope: barrierScope, evidence: barrierEvidence} = require("../shift-planning-barrier-fixture.cjs");
const {createShiftPlanningTrustedIntakeBarrierCheckpoint: checkpoint,
  createShiftPlanningIntakeBarrierFailureClosureRecord: failureRecord} =
  require("../../lib/shift-planning-trusted-intake-barrier-adapter.js");
const encode = (value) => encodeValue(value, "private clone acceptance", new Set());
const same = (a, b, message) => assert.equal(digest(encode(a)), digest(encode(b)), message);
const iso = (time) => new Date(time.seconds * 1000).toISOString().slice(0, 19) +
  `.${String(time.nanoseconds).padStart(9, "0")}Z`;

before(() => {
  if (!enabled) return;
  assert.equal(process.env.GCLOUD_PROJECT, migration.PROJECT_ID);
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, migration.HOST);
  assert.ok(path.isAbsolute(evidenceDirectory) && path.isAbsolute(resultDirectory));
  fs.mkdirSync(resultDirectory, {recursive: true, mode: 0o700});
  const {Firestore} = require("@google-cloud/firestore");
  db = new Firestore({projectId: migration.PROJECT_ID, host: migration.HOST, ssl: false});
  google = require("googleapis").google;
  originalSheets = google.sheets; originalDrive = google.drive;
  const forbidden = () => { externalCalls++; throw new Error("External transport forbidden in clone acceptance"); };
  google.sheets = forbidden; google.drive = forbidden;
  exported = require("../../lib/index.js");
  messaging = require("firebase-admin/messaging").getMessaging();
  for (const name of ["send", "sendEach", "sendEachForMulticast"]) {
    assert.equal(typeof messaging[name], "function");
    originalMessagingMethods.set(name, messaging[name]);
    messaging[name] = forbidden;
  }
});

after(async () => {
  for (const service of services) await service.close();
  if (db) await db.terminate();
  if (google) { google.sheets = originalSheets; google.drive = originalDrive; }
  if (messaging) for (const [name, method] of originalMessagingMethods) messaging[name] = method;
  if (exported) {
    delete process.env.SHIFT_PLANNING_PUBLIC_EVENT_RETENTION_POLICY_DEVELOP;
    await require("firebase-admin/firestore").getFirestore().terminate();
    await require("firebase-admin/app").deleteApp(require("firebase-admin/app").getApp());
  }
  if (!enabled) return;
  const body = {schemaVersion: 1, scope: "fixed_loopback_private_capture_acceptance", liveExecutable: false,
    projectId: migration.PROJECT_ID, scriptSha256: sha(__filename),
    rehearsalScriptSha256: sha(require.resolve("../../scripts/rehearse-develop-shift-migration.cjs")),
    sourceDigests, completed, externalCalls,
    status: completed.roundTrip ? "passed" : "incomplete", limitations: [
      "Firestore SDK and actual exported handlers run locally; no CloudEvent delivery or deployed Rules/IAM is exercised.",
      "Barrier, index and workbook-version authority are explicit local fixtures, not live control-plane evidence.",
      "Users are the selected captured fields; four calendar sentinels come from the retained historical capture, not a new live calendar read.",
      "Raw Sheets-origin legacy events are ordinary no-effect events; they are not classified as canonical controlled events.",
      "The 53 helper cells are exercised in the separate real-adapter/in-memory-Sheets acceptance; no cross-service atomicity is claimed.",
      "The inherited market horizon remains partial, and no live coverage or annual-planning readiness is asserted.",
    ]};
  fs.writeFileSync(path.join(resultDirectory, "hu084-develop-migration-sdk-receipt.json"),
    JSON.stringify({...body, receiptDigest: digest(body)}, null, 2) + "\n", {mode: 0o600});
});

const restData = (document) => Object.fromEntries(Object.entries(document.fields).map(([key, value]) =>
  [key, migration.decodeRESTValue(value)]));
const cloneDocument = (snapshot, fields) => ({
  name: `projects/${migration.PROJECT_ID}/databases/(default)/documents/${snapshot.ref.path}`,
  fields, createTime: iso(snapshot.createTime), updateTime: iso(snapshot.updateTime),
});
const stableCollection = async (name) => (await db.collection(`${root}/${name}`).orderBy("__name__").get()).docs
  .map((document) => ({path: document.ref.path, value: encode(document.data()), updateTime: encode(document.updateTime)}));

const governed = async (prepared) => {
  const now = Date.now();
  const control = {closes: 0, readBacks: 0};
  const held = (scope) => {
    const payload = barrierEvidence().payload;
    const shiftTime = (record) => {
      for (const [key, value] of Object.entries(record)) {
        if (value && typeof value === "object") shiftTime(value);
        else if (key.endsWith("AtMillis")) record[key] += now - 520;
      }
    };
    shiftTime(payload);
    payload.transition = Object.fromEntries(["transitionId", "expectedAuthoritativeDigest", "expectedStateRevision",
      "expectedWriteEpoch", "expectedActiveRevision", "expectedActiveDigest"].map((key) => [key, scope[key]]));
    payload.workbook.fileId = scope.expectedWorkbookFileId;
    payload.workbook.revision = payload.workbook.readBackRevision = scope.expectedWorkbookRevision;
    payload.workbook.digest = payload.workbook.readBackDigest = scope.expectedWorkbookDigest;
    return checkpoint({scope, holdRevision: `clone-held-${scope.transitionId}`,
      evidence: {payload, digest: digest(payload)}});
  };
  const service = migration.createDevelopShiftMigrationRehearsal({prepared, nowMillis: () => now,
    controlPlane: {
      closeAndCollect: async (scope) => { control.closes++; return held(scope); },
      readBackClosed: async (scope) => { control.readBacks++; return held(scope); },
    }, failurePersistence: {
      readExistingFailure: async ({transitionId}) =>
        (await db.doc(`${root}/shiftPlanningRehearsalFailures/${transitionId}`).get()).data() ?? null,
      retainFailureAndReadBack: async (request) => {
        const ref = db.doc(`${root}/shiftPlanningRehearsalFailures/${request.transitionId}`);
        const record = failureRecord(request, now);
        await db.runTransaction(async (tx) => { if (!(await tx.get(ref)).exists) tx.create(ref, record); });
        return (await ref.get()).data();
      },
    }});
  services.push(service);
  const scopeFor = async (inverse = false) => {
    const observation = await service.inspect();
    return barrierScope({transitionId: inverse ? prepared.recoveryOperationId : prepared.operationId,
      expectedAuthoritativeDigest: observation.sourceDigest,
      expectedStateRevision: observation.maintenance.stateRevision, expectedWriteEpoch: observation.maintenance.writeEpoch,
      expectedActiveRevision: observation.maintenance.activeRevision, expectedActiveDigest: observation.maintenance.activeDigest,
      expectedWorkbookFileId: migration.WORKBOOK_ID, expectedWorkbookRevision: "1",
      expectedWorkbookDigest: digest("explicit local workbook snapshot, not real Drive")});
  };
  return {service, scopeFor, control};
};

test("captured 62-to-72 migration and exact reversal retain authority for real delayed event handlers",
  {skip: !enabled}, async () => {
    assert.equal((await fetch(`http://${migration.HOST}/emulator/v1/projects/${migration.PROJECT_ID}/databases/(default)/documents`,
      {method: "DELETE"})).ok, true);
    const currentPath = path.join(evidenceDirectory, "read-only-capture.json");
    const fullPath = path.join(evidenceDirectory, "full-shifts-capture.json");
    const proposalPath = path.join(evidenceDirectory, "content-proposal.json");
    const validationPath = path.join(evidenceDirectory, "validation-receipt.json");
    const current = read(currentPath), full = read(fullPath), contentProposal = read(proposalPath);
    const validation = read(validationPath);
    const comparison = read(path.join(evidenceDirectory, "retained-base-comparison.json"));
    const {receiptDigest, ...validationBody} = validation;
    assert.equal(digest(validationBody), receiptDigest);
    assert.equal(validation.contentDigest,
      "shift-planning:v1:sha256:36f53c5e1391e244383fb109920c697d0e7dc6717afa2e1bc558a1e1120f665f");
    assert.equal(validation.proposalDigest,
      "shift-planning:v1:sha256:05d1efc316f3878cdb191d5cc4acc51bff5a23069559bff6ca53eceddc0446b9");
    assert.equal(contentProposal.contentDigest, validation.contentDigest);
    assert.equal(contentProposal.proposalDigest, validation.proposalDigest);
    assert.equal(sha(currentPath), validation.sources.currentCaptureSha256);
    assert.equal(sha(currentPath), comparison.files.currentCapture.sha256);
    assert.equal(sha(fullPath), comparison.retainedLegacyFirestore.fullPayloadComparison.sha256);
    assert.equal(sha(proposalPath), comparison.contentProposalBinding.proposalSha256);
    assert.equal(comparison.contentProposalBinding.contentDigest, validation.contentDigest);
    assert.equal(comparison.contentProposalBinding.proposalDigest, validation.proposalDigest);
    assert.equal(comparison.contentProposalBinding.validationReceiptDigest, receiptDigest);
    sourceDigests = {currentCaptureSha256: sha(currentPath), fullShiftsCaptureSha256: sha(fullPath),
      contentProposalSha256: sha(proposalPath), validationReceiptSha256: sha(validationPath),
      comparisonSha256: sha(path.join(evidenceDirectory, "retained-base-comparison.json"))};
    const old = read(path.join(path.dirname(validation.sources.planPath), "captured-firestore.json"));
    const calendars = old.source.calendar.map((entry) => entry.document);
    assert.equal(full.documents.length, 62); assert.equal(current.users.documents.length, 48);
    assert.equal(calendars.length, 4);
    const all = [...full.documents, ...current.users.documents, ...calendars];
    const batch = db.batch();
    for (const document of all) batch.create(db.doc(document.name.split("/documents/")[1]), restData(document));
    await batch.commit();
    const initial = (await db.collection(`${root}/shifts`).orderBy("__name__").get()).docs;
    const byPath = new Map(full.documents.map((document) => [document.name.split("/documents/")[1], document]));
    for (const document of initial) same(document.data(), restData(byPath.get(document.ref.path)), "Lossless SDK seed");
    const users = await stableCollection("users"), calendar = await stableCollection("deliveryCalendar");
    const guardCollections = {};
    for (const [name, originals] of [["users", current.users.documents], ["deliveryCalendar", calendars]]) {
      const index = new Map(originals.map((document) => [document.name.split("/documents/")[1], document]));
      guardCollections[name] = (await db.collection(`${root}/${name}`).orderBy("__name__").get()).docs
        .map((snapshot) => cloneDocument(snapshot, index.get(snapshot.ref.path).fields));
    }
    const cloneCapture = {projectId: migration.PROJECT_ID, environment: "develop",
      documents: initial.map((snapshot) => cloneDocument(snapshot, byPath.get(snapshot.ref.path).fields)), guardCollections};
    const prepared = migration.prepareDevelopShiftMigration({contentProposal, legacyCapture: cloneCapture,
      policyDraft: migration.createLocalMigrationPolicyDraft(contentProposal), runId: "hu084-captured-roundtrip"});
    const f = await governed(prepared);
    const initialCanonical = await db.getAll(...prepared.content.shifts.map((shift) => db.doc(`${root}/shifts/${shift.id}`)));
    assert.ok(initialCanonical.every((document) => !document.exists));
    const initialCanonicalById = new Map(initialCanonical.map((document) => [document.id, document]));
    const forwardScope = await f.scopeFor();
    const forward = await f.service.forward({scope: forwardScope});
    assert.equal(forward.direction, "forward");
    const forwardRows = (await db.collection(`${root}/shifts`).orderBy("__name__").get()).docs;
    assert.equal(forwardRows.length, 72);
    const expected = new Map(contentProposal.content.shifts.map((shift) => [shift.id, shift]));
    for (const document of forwardRows) {
      const value = parseShiftPlanningPublicShiftDocument({targetPath: document.ref.path, value: document.data()});
      const row = expected.get(document.id);
      assert.equal(value.type, row.type); assert.equal(value.date.toDate().toISOString().slice(0, 10), row.date);
      same(value.assignedUserIds, row.assignedUserIds, "Ordered assignments remain exact");
      same(value.rotationOwnerUserIds ?? [value.rotationOwnerUserId], row.rotationOwnerUserIds, "Declared owners remain exact");
      assert.equal(value.helperUserId, row.helperUserId); assert.equal(value.completion.state, "uncompleted");
    }
    const operationPath = `${root}/shiftPlanningOperations/${prepared.operationId}`;
    const operation = (await db.doc(operationPath).get()).data();
    assert.equal(operation.publicMutations.length, 72); assert.equal(operation.beforeImages.length, 62);
    for (const binding of operation.beforeImages) {
      const archive = parseShiftPlanningBeforeImageEnvelope((await db.doc(binding.envelopePath).get()).data());
      same(decode(archive.payload), restData(byPath.get(archive.targetPath)), "Every original field is archived");
    }
    same(await stableCollection("users"), users, "Roster content and SDK versions are unchanged");
    same(await stableCollection("deliveryCalendar"), calendar, "Calendar sentinels and SDK versions are unchanged");
    const absentLegacy = await db.getAll(...initial.map((document) => document.ref));
    const event = (id, beforeSnapshot, afterSnapshot, time) => ({id, time,
      params: {env: "develop", shiftId: afterSnapshot.ref.id}, authType: "system",
      data: {before: beforeSnapshot, after: afterSnapshot}});
    const eventTime = operation.attemptedAt.toDate().toISOString();
    process.env.SHIFT_PLANNING_PUBLIC_EVENT_RETENTION_POLICY_DEVELOP = JSON.stringify(f.service.retentionPolicy);
    const originalsById = new Map(initial.map((document) => [document.id, document]));
    for (const [index, snapshot] of absentLegacy.entries()) {
      const input = event(`raw-retire-${index}`, originalsById.get(snapshot.id), snapshot, eventTime);
      await exported.onShiftWritten.run(input); await exported.onShiftPlanningPublicWritten.run(input);
    }
    // Half of the canonical creates are intentionally delivered after recovery.
    const canonicalCreates = [];
    for (const [index, snapshot] of forwardRows.entries()) {
      const missing = initial.find((document) => document.id === snapshot.id);
      assert.equal(missing, undefined);
      const absent = forward.documents.find((document) => document.path === snapshot.ref.path);
      assert.ok(absent?.exists);
      const input = event(`canonical-create-${index}`, initialCanonicalById.get(snapshot.id), snapshot,
        snapshot.updateTime.toDate().toISOString());
      canonicalCreates.push(input);
      await exported.onShiftWritten.run(input);
      if (index < 36) await exported.onShiftPlanningPublicWritten.run(input);
    }
    assert.equal((await db.collection(`${root}/shiftPlanningPublicEventLedgers`).where("recordKind", "==", "publicEventLedger").get()).size, 36);
    const forwardVersions = forwardRows.map((document) => [document.id, encode(document.updateTime)]);
    const replay = await f.service.forward({scope: forwardScope});
    assert.equal(replay.direction, "forward");
    assert.equal(replay.measurement, null, "A retained forward replay admits no new transaction writes");
    same((await db.collection(`${root}/shifts`).orderBy("__name__").get()).docs.map((document) =>
      [document.id, encode(document.updateTime)]), forwardVersions, "Forward replay performs no public write");
    const inverseScope = await f.scopeFor(true);
    const inverse = await f.service.inverse({scope: inverseScope, forwardReadBack: forward});
    assert.equal(inverse.direction, "inverse");
    const restored = (await db.collection(`${root}/shifts`).orderBy("__name__").get()).docs;
    assert.equal(restored.length, 62);
    for (const document of restored) same(document.data(), restData(byPath.get(document.ref.path)), "Exact raw restoration");
    const deletedCanonical = await db.getAll(...forwardRows.map((document) => document.ref));
    const recovery = (await db.doc(operationPath).get()).data();
    assert.equal(recovery.operationKind, "activationRecovery");
    assert.equal(recovery.activationTerminal.operationId, prepared.operationId);
    for (const [index, snapshot] of deletedCanonical.entries()) {
      assert.equal(snapshot.exists, false);
      const input = event(`canonical-recover-${index}`, forwardRows[index], snapshot, recovery.recoveredAt.toDate().toISOString());
      await exported.onShiftWritten.run(input);
      await exported.onShiftPlanningPublicWritten.run(input); await exported.onShiftPlanningPublicWritten.run(input);
    }
    const missingById = new Map(absentLegacy.map((document) => [document.id, document]));
    for (const [index, snapshot] of restored.entries()) {
      const input = event(`raw-restore-${index}`, missingById.get(snapshot.id), snapshot, snapshot.updateTime.toDate().toISOString());
      await exported.onShiftWritten.run(input); await exported.onShiftPlanningPublicWritten.run(input);
    }
    for (const input of canonicalCreates) {
      await exported.onShiftPlanningPublicWritten.run(input); await exported.onShiftPlanningPublicWritten.run(input);
    }
    const ledgers = await db.collection(`${root}/shiftPlanningPublicEventLedgers`).where("recordKind", "==", "publicEventLedger").get();
    assert.equal(ledgers.size, 144);
    assert.ok(ledgers.docs.every((document) => document.get("outcome") === "controlledNoOp"));
    assert.equal(ledgers.docs.filter((document) => document.get("controlledOperationKind") === "activation").length, 72);
    assert.equal(ledgers.docs.filter((document) => document.get("controlledOperationKind") === "recovery").length, 72);
    const finalPublic = await stableCollection("shifts");
    assert.equal((await f.service.inverse({scope: inverseScope, forwardReadBack: forward})).replayed, true);
    same(await stableCollection("shifts"), finalPublic, "Inverse replay performs no public write");
    same(await stableCollection("users"), users, "Roster remains unchanged after recovery");
    same(await stableCollection("deliveryCalendar"), calendar, "Calendar remains unchanged after recovery");
    const currentState = (await db.doc(`${root}/shiftPlanningState/current`).get()).data();
    assert.equal(currentState.maintenanceStatus, "closed"); assert.equal(currentState.writeEpoch, 2);
    assert.equal(currentState.activeRevision, null);
    for (const name of ["notificationEvents", "notificationInbox", "shiftCoverageCredits", "shiftCoverageCases"]) {
      assert.equal((await db.collection(`${root}/${name}`).get()).size, 0);
    }
    assert.equal(externalCalls, 0);
    assert.ok(f.control.closes >= 2 && f.control.readBacks >= 4);
    completed.roundTrip = {legacyArchivedAndRestored: 62, canonicalPromotedAndRemoved: 72,
      participantSlotsPreserved: 108, usersUnchanged: 48, historicalCalendarSentinelsUnchanged: 4,
      forwardMeasurement: forward.measurement, inverseMeasurement: inverse.measurement,
      controlledActivationLedgers: 72, controlledRecoveryLedgers: 72, ordinaryNoEffectRetirements: 62,
      ordinaryNoEffectRestorations: 62, delayedFirstDeliveriesAfterRecovery: 36,
      securityEpochAfterRecovery: currentState.writeEpoch, externalCalls, contentDigest: prepared.contentDigest};
    delete process.env.SHIFT_PLANNING_PUBLIC_EVENT_RETENTION_POLICY_DEVELOP;
    // Snapshots remain private; the published receipt contains counts/digests only.
  });
