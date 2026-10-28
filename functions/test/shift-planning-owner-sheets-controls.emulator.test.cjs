"use strict";
const assert = require("node:assert/strict");
const {createHash} = require("node:crypto");
const {before, beforeEach, afterEach, after, test} = require("node:test");
const {Firestore, Timestamp} = require("@google-cloud/firestore");
const {fixture: activationFixture, fairnessSnapshot, attemptedAt, materializerInput} =
  require("./shift-planning-activation-fixture.cjs");
const {materializeShiftPlanningForwardActivation} =
  require("../lib/shift-planning-forward-materializer.js");
const {createFirestoreShiftPlanningSyncCommandRepository} =
  require("../lib/shift-planning-firestore-sync-command-repository.js");
const {createShiftSheetsConfig} = require("../lib/shift-sheets-config.js");
const {createShiftSheetsAdapter} = require("../lib/shift-sheets.js");
const {observeShiftSheetsWorkbook} = require("../lib/shift-sheets-operational-preflight.js");
const {createShiftSheetsOwnerPreservationManifest} = require("../lib/shift-sheets-owner-manifest.js");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {createShiftPlanningOwnerMaintenanceAgreement} = require("../lib/shift-planning-owner-maintenance.js");
const {createFirestoreShiftPlanningStateRepository} = require("../lib/shift-planning-firestore-state-repository.js");
const {createFirestoreShiftPlanningIntakeBarrierRepository} = require("../lib/shift-planning-firestore-intake-barrier-repository.js");
const {shiftPlanningOwnerSheetsAuthorizationDigest} = require("../lib/shift-planning-owner-sheets-contract.js");
const {SHIFT_PLANNING_COPY_TOKEN_SCOPES, createShiftPlanningOwnerSheetsCopyAgreement} =
  require("../lib/shift-planning-owner-sheets-copy-controls.js");
const {SHIFT_PLANNING_OWNER_AGREEMENT_OWNER_WRITER_ID: OWNER_WRITER} =
  require("../lib/shift-planning-writer-inventory.js");
const {ownerFixture} = require("./shift-planning-owner-maintenance-fixture.cjs");
const {createShiftPlanningOwnerSheetsComposition} = require("../lib/shift-planning-owner-sheets-composition.js");
const {createShiftPlanningSyncCommandToken} = require("../lib/shift-planning-sync-command.js");
const {sheetsService, clone, setCell, content} = require("./shift-sheets-api-fixture.cjs");

const PROJECT = "demo-reguerta-owner-sheets-controls";
const HOST = "127.0.0.1:8897";
const ROOT = "develop/plus-collections";
const COPY = "reviewed-owner-sheets-copy";
const ORIGINALS = ["original-develop-workbook", "original-production-workbook"];
const OWNER = "owner-human";
const RUNTIME = "fixture-sheets-runtime";
const PRODUCTION_CANARY = "production/plus-collections/shifts/published-canary";
const AUTHORIZATION = "owner-sheets-reviewed-copy";
const EXTERNAL = "ownerSheetsControlsRehearsal/external";
const copyScope = () => ({copyWorkbookId: COPY, protectedWorkbookIds: ORIGINALS,
  runId: "owner-copy-local"});
assert.equal(process.env.GCLOUD_PROJECT, "demo-reguerta-writer-controls");
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, HOST);
let db, now;
const compositions = [];

before(() => { db = new Firestore({projectId: PROJECT, host: HOST, ssl: false}); });
after(async () => { await db.terminate(); });
afterEach(async () => {
  await Promise.all(compositions.splice(0).map((runtime) => runtime.dispose()));
});
beforeEach(async () => {
  const response = await fetch(
    `http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
    {method: "DELETE"},
  );
  assert.equal(response.ok, true, await response.text());
  now = attemptedAt.toMillis() + 1000;
});

async function setupBase() {
  const snapshot = fairnessSnapshot();
  for (const partition of Object.values(snapshot.sync.partitions)) {
    partition.workbookId = COPY;
    partition.workbookRevision = "10";
  }
  const value = activationFixture(snapshot);
  const activation = materializeShiftPlanningForwardActivation(materializerInput(value));
  const batch = db.batch();
  for (const mutation of activation.mutations) {
    batch.set(db.doc(mutation.documentPath), mutation.data);
  }
  batch.set(db.doc(`${ROOT}/shiftPlanningBundles/${value.preflight.bundle.bundleRevision}`), value.preflight.bundle);
  batch.set(db.doc(`${ROOT}/shiftPlanningState/sourcePolicy`), {environment: "develop", sync: snapshot.sync});
  const userIds = new Set(activation.publicDocuments.flatMap(({document}) => [
    ...document.assignedUserIds, ...(document.helperUserId ? [document.helperUserId] : []),
  ]));
  for (const id of userIds) batch.set(db.doc(`${ROOT}/users/${id}`), {
    displayName: `Persona ${id.slice(7)}`, phoneNumber: `600${id.slice(7).padStart(6, "0")}`, roles: ["member"],
  });
  batch.set(db.doc(PRODUCTION_CANARY), {date: Timestamp.fromDate(new Date("2027-01-06T00:00:00Z")),
    assignedUserIds: ["member-b", "member-a"], sentinel: "production-preserved"});
  await batch.commit();
  const config = createShiftSheetsConfig({environment: "develop", workbooks: {develop: COPY}});
  const repository = createFirestoreShiftPlanningSyncCommandRepository(db, () => Timestamp.fromMillis(now));
  const service = sheetsService(COPY);
  const projectionRows = activation.publicDocuments.map(({targetPath, document}) => ({
    id: targetPath.split("/").at(-1), type: document.type,
    date: document.date.toDate().toISOString().slice(0, 10),
    rotationOwnerUserIds: document.rotationOwnerUserIds ?? [document.rotationOwnerUserId],
    assignedUserIds: document.assignedUserIds, helperUserId: document.helperUserId,
    status: document.status, source: document.source, origin: document.origin,
  }));
  const generationRows = projectionRows.map((row) => ({id: row.id, visibleDate: row.date,
    assignees: row.assignedUserIds.map((userId) => ({userId,
      name: `Persona ${userId.slice(7)}`, phone: `600${userId.slice(7).padStart(6, "0")}`})),
    helper: row.helperUserId ? {userId: row.helperUserId,
      name: `Persona ${row.helperUserId.slice(7)}`} : null}));
  // The fixture starts with valid generated headers, but no projected turns.
  // Derive their exact Google protocol shape through the production adapter.
  const initial = sheetsService(COPY);
  await createShiftSheetsAdapter({config, sheets: initial}).reconcile({
    operationId: "fixture-headers", rows: projectionRows, generationRows,
    authorizeMutation: async () => {},
  });
  service.state = clone(initial.state);
  for (const [index, sheet] of service.state.sheets.entries()) {
    Object.assign(sheet.properties, {index, sheetType: "GRID", hidden: false});
    Object.assign(sheet.properties.gridProperties, {frozenRowCount: 0, frozenColumnCount: 0});
    sheet.data[0].rowData = [sheet.data[0].rowData[0]];
    sheet.developerMetadata = [];
    sheet.protectedRanges = [];
    sheet.merges = [];
  }
  setCell(service.state.sheets[0], 0, 0, {note: "Preserve the reviewed annotation"});
  const titles = service.state.sheets.map((sheet) => sheet.properties.title);
  const reads = [];
  const metadata = {id: COPY, mimeType: "application/vnd.google-apps.spreadsheet", trashed: false,
    owners: [{permissionId: OWNER, emailAddress: "owner@example.test", me: false}],
    contentRestrictions: [], capabilities: {canEdit: true, canModifyContent: true,
      canShare: true, canReadRevisions: true, canModifyEditorContentRestriction: true,
      canModifyContentRestriction: false, canModifyOwnerContentRestriction: false,
      canRemoveContentRestriction: false}};
  const permissions = [
    {id: OWNER, type: "user", role: "owner", emailAddress: "owner@example.test", deleted: false,
      permissionDetails: [{permissionType: "file", role: "owner", inherited: false}]},
    {id: RUNTIME, type: "user", role: "writer", emailAddress: "runtime@fixture.iam.gserviceaccount.com", deleted: false,
      permissionDetails: [{permissionType: "file", role: "writer", inherited: false}]},
  ];
  const drive = {files: {async get(params, options) {
    reads.push({kind: "file", params: clone(params)});
    assert.equal(params.fileId, COPY);
    assert.equal(options.retry, false);
    return {data: clone({...metadata, version: String(10 + service.revision)})};
  }}, permissions: {async list(params, options) {
    reads.push({kind: "permissions", params: clone(params)});
    assert.equal(params.fileId, COPY);
    assert.equal(options.retry, false);
    return {data: {permissions: clone(permissions)}};
  }}, about: {async get(_params, options) {
    reads.push({kind: "principal"});
    assert.equal(options.retry, false);
    return {data: {user: {permissionId: RUNTIME,
      emailAddress: "runtime@fixture.iam.gserviceaccount.com", me: true}}};
  }}};
  const commands = value.liveResult.syncCommands;
  const command = (type = "delivery") => commands.find((entry) => entry.type === type);
  const reference = (type = "delivery") => db.doc(`${ROOT}/shiftPlanningSyncCommands/${command(type).commandId}`);
  const receipt = async (type = "delivery") =>
    (await reference(type).collection("externalSubmissions").doc("sheets").get()).data();
  const partition = async (type = "delivery") =>
    (await db.doc(`${ROOT}/shiftPlanningState/sourcePolicy`).get()).get(`sync.partitions.${type}`);
  const observe = async () => (await observeShiftSheetsWorkbook({config, titles,
    files: drive.files, permissions: drive.permissions, about: drive.about,
    sheets: service, nowMillis: () => now, collector: "googleapis-raw",
    includePreservationCells: true})).privateObservation;
  const protectedPaths = [...activation.publicDocuments.map((entry) => entry.targetPath), PRODUCTION_CANARY];
  const protectedData = async () => (await db.getAll(...protectedPaths.map((path) => db.doc(path))))
    .map((document) => ({path: document.ref.path, data: document.data(),
      version: `${document.updateTime.seconds}:${document.updateTime.nanoseconds}`}));
  const publishedBefore = await protectedData();
  return {snapshot, value, activation, config, repository, service, drive, metadata, permissions, reads,
    projectionRows, generationRows, titles, observe, protectedData, publishedBefore,
    commands, command, reference, receipt, partition};
}

function offsetTimes(value, amount) {
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "number" && /AtMillis$|DeadlineMillis$/.test(key)) value[key] += amount;
    else offsetTimes(item, amount);
  }
}
async function retainTechnicalEvidence(base, workbook, maximumEvidenceAgeMillis = 1000) {
  const current = await createFirestoreShiftPlanningStateRepository(db)
    .loadAuthoritativeState({environment: "develop"});
  const source = ownerFixture({expectedAuthoritativeDigest: current.authoritativeDigest,
    expectedStateRevision: current.maintenance.stateRevision,
    expectedWriteEpoch: current.maintenance.writeEpoch,
    expectedActiveRevision: current.maintenance.activeRevision,
    expectedActiveDigest: current.maintenance.activeDigest,
    expectedWorkbookFileId: COPY, expectedWorkbookRevision: workbook.workbookVersionBefore,
    expectedWorkbookDigest: workbook.contentDigest});
  const payload = structuredClone(source.evidence.payload);
  offsetTimes(payload, now - source.nowMillis);
  payload.policy.maximumEvidenceAgeMillis = maximumEvidenceAgeMillis;
  const intent = payload.ownerAgreement.payload.intent;
  const agreement = createShiftPlanningOwnerMaintenanceAgreement(intent,
    payload.ownerAgreement.payload.confirmations.map((confirmation) => ({
      ...confirmation, intentDigest: digest(intent),
    })));
  payload.ownerAgreement = agreement;
  const owner = payload.writerControls.find((control) => control.writerId === OWNER_WRITER);
  for (const field of ["controlDigest", "initialReadBackDigest", "finalReadBackDigest"]) owner[field] = agreement.digest;
  const evidence = {payload, digest: digest(payload)};
  const repository = createFirestoreShiftPlanningIntakeBarrierRepository(db, () => Timestamp.fromMillis(now));
  await repository.retainAndReadBack({environment: "develop",
    transitionId: source.command.transitionId, evidence});
  await db.doc(EXTERNAL).create({scope: "declared-demo-controls", evidence});
  return {evidence, transitionId: source.command.transitionId};
}
async function authorizeCopy(base, {windowMillis = 500, evidenceAgeMillis = 1000,
  technicalEvidenceAgeMillis = evidenceAgeMillis} = {}) {
  // Read-only preparation is deliberately separate from the confirmation below.
  // Its placeholder approval digest cannot authorize execution: no registry exists.
  const preview = await composition(base, {expectedAuthorizationDigest: digest({review: "not-yet-confirmed"}),
    technicalTransitionId: "maintenance-entry-7"}, {copyRehearsal: copyScope()});
  const prepared = await preview.prepareCopyRehearsal({commandId: base.command().commandId,
    proposedWindow: {startsAtMillis: now - 100, endsAtMillis: now + windowMillis,
      recoveryDeadlineMillis: now + Math.max(120_000, windowMillis + 60_000)}});
  assert.equal(prepared.canApply, false);
  assert.equal(base.service.mutations.length, 0);
  const workbook = prepared.privateObservation;
  const planned = prepared.planned.batch;
  const preservation = createShiftSheetsOwnerPreservationManifest({before: workbook.snapshot,
    requests: planned.requests});
  assert.equal(preservation.digest, prepared.planned.preservationManifest.digest);
  const technical = await retainTechnicalEvidence(base, workbook, technicalEvidenceAgeMillis);
  return approvePreparedCopy(base, prepared, {windowMillis, evidenceAgeMillis,
    technicalEvidenceDigest: technical.evidence.digest, technicalTransitionId: technical.transitionId});
}
async function approvePreparedCopy(base, prepared, {windowMillis, evidenceAgeMillis,
  technicalEvidenceDigest, technicalTransitionId, copyAuthority}) {
  const workbook = prepared.privateObservation;
  const planned = prepared.planned.batch;
  const preservation = prepared.planned.preservationManifest;
  const command = base.command();
  const batchIntent = {schemaVersion: copyAuthority ? 2 : 1,
    ...(copyAuthority ? {technicalControlKind: "isolated-copy-runtime"} : {}),
    kind: "owner-sheets-batch", environment: "develop",
    workbookId: COPY, commandId: command.commandId, commandDigest: digest(command),
    operationId: command.idempotencyKey, writeEpoch: command.writeEpoch,
    activeRevision: command.expectedActiveRevision, activeDigest: command.expectedActiveDigest,
    beforeWorkbookRevision: workbook.workbookVersionBefore, beforeContentDigest: workbook.contentDigest,
    beforeAclDigest: workbook.authorityDigest, beforeProtectionsDigest: workbook.protectionsDigest,
    observerPrincipalId: RUNTIME, projectionDigest: planned.projectionDigest, requestDigest: planned.requestDigest,
    preservationDigest: preservation.preservationDigest, preservationManifestDigest: preservation.digest,
    technicalEvidenceDigest,
    maximumEvidenceAgeMillis: evidenceAgeMillis};
  const participants = [{principalId: OWNER, role: "owner"},
    {principalId: copyAuthority?.runnerInstanceId ?? "operator-invoker", role: "operator"}];
  const intent = {agreementId: "copy-owner-sheets-agreement", environment: "develop", workbookFileId: COPY,
    ownerPrincipalId: OWNER, participants, participantsRevision: "copy-participants-1",
    effectiveAuthorityDigest: workbook.authorityDigest,
    sourceRevision: batchIntent.beforeWorkbookRevision, sourceDigest: batchIntent.beforeContentDigest,
    expectedWriteEpoch: command.writeEpoch, expectedActiveRevision: command.expectedActiveRevision,
    expectedActiveDigest: command.expectedActiveDigest, affectedScopeDigest: digest(batchIntent),
    operations: [{operationId: command.idempotencyKey, kind: "sheets-batch", manifestDigest: digest(batchIntent)}],
    startsAtMillis: now - 100, endsAtMillis: now + windowMillis,
    recoveryDeadlineMillis: now + Math.max(120_000, windowMillis + 60_000),
    permissionControl: null};
  const createAgreement = copyAuthority ? createShiftPlanningOwnerSheetsCopyAgreement :
    createShiftPlanningOwnerMaintenanceAgreement;
  const agreement = createAgreement(intent, participants.map((participant) => ({
    ...participant, intentDigest: digest(intent), confirmationId: `copy-confirm-${participant.role}`,
    confirmedAtMillis: now, onlineClosedNoOfflineEdits: true, noManualOrAutomationWrites: true,
  })));
  const authorization = {schemaVersion: 1, operationKind: "ownerSheetsAuthorization", environment: "develop",
    commandId: command.commandId, technicalTransitionId, agreement, batchIntent,
    ...(copyAuthority ? {copyAuthority} : {}),
    preservationManifest: preservation,
    ownerReport: {agreementDigest: agreement.digest, agreementStatus: "confirmed", ownerActivity: "none-reported",
      unresolvedWriteCount: 0, participantsDigest: digest({revision: intent.participantsRevision, participants}),
      effectiveAuthorityDigest: intent.effectiveAuthorityDigest, permissionWorkflowClosed: true,
      permissionControlEvidenceDigest: null}};
  await db.doc(`${ROOT}/shiftPlanningOperations/${AUTHORIZATION}`).create(authorization);
  return {authorization, expectedAuthorizationDigest: shiftPlanningOwnerSheetsAuthorizationDigest(authorization),
    technicalTransitionId, planned, workbook, preservation};
}

async function composition(base, approval, extra = {}) {
  const runtime = createShiftPlanningOwnerSheetsComposition({firestore: db, config: base.config,
    titles: base.titles, commandId: base.command().commandId, authorizationDocumentId: AUTHORIZATION,
    expectedAuthorizationDigest: approval.expectedAuthorizationDigest,
    technicalTransitionId: approval.technicalTransitionId, runtimePrincipalId: RUNTIME,
    clients: {sheets: base.service, drive: base.drive}, nowMillis: () => now,
    readCurrentExternalControls: async () => (await db.doc(EXTERNAL).get()).get("evidence") ?? null,
    ...extra});
  compositions.push(runtime);
  return runtime;
}
async function setup(options) {
  const base = await setupBase();
  const approval = await authorizeCopy(base, options);
  const runtime = await composition(base, approval);
  const execute = (extra = {}) => runtime.execute({commandId: base.command().commandId,
    workerId: "owner-sheets-worker", attemptId: "owner-sheets-attempt", ...extra});
  return {...base, approval, runtime, execute};
}
function isolatedAuthority({tokenMillis = 120_000, evidenceAgeMillis = 1000} = {}) {
  const {runId, protectedWorkbookIds} = copyScope();
  return {schemaVersion: 1, kind: "isolated-copy-authority", runId, protectedWorkbookIds,
    workbookId: COPY, demoProjectId: PROJECT, firestoreHost: HOST,
    runnerInstanceId: "copy-runner:owned-copy-runner", runnerSourceDigest: digest({runner: "reviewed-local-test-port"}),
    runnerStartedAtMillis: now - 50, lockNonceDigest: digest({lock: "owned-copy-lock"}),
    serviceAccountEmail: "runtime@fixture.iam.gserviceaccount.com",
    serviceAccountUniqueId: "100000000000000000001", drivePermissionId: RUNTIME,
    creationReceiptDigest: digest({identity: "copy-only-created-receipt"}),
    grantPolicyDigest: digest({grant: "copy-only-20-minute-binding"}),
    grantStartsAtMillis: now - 100, grantExpiresAtMillis: now + 600_000,
    tokenIssuedAtMillis: now - 10, tokenExpiresAtMillis: now + tokenMillis,
    tokenScopes: [...SHIFT_PLANNING_COPY_TOKEN_SCOPES], maximumEvidenceAgeMillis: evidenceAgeMillis};
}
async function setupIsolatedCopy({windowMillis = 300_000, tokenMillis = 120_000,
  evidenceAgeMillis = 1000, configureWorkbook} = {}) {
  const base = await setupBase();
  await configureWorkbook?.(base);
  const authority = isolatedAuthority({tokenMillis, evidenceAgeMillis});
  const scope = {...copyScope(), authority};
  const preview = await composition(base, {expectedAuthorizationDigest: digest({review: "copy-not-yet-confirmed"}),
    technicalTransitionId: "isolated-copy-run"}, {copyRehearsal: scope});
  const prepared = await preview.prepareCopyRehearsal({commandId: base.command().commandId,
    proposedWindow: {startsAtMillis: now - 100, endsAtMillis: now + windowMillis,
      recoveryDeadlineMillis: now + windowMillis + 60_000}});
  const approval = await approvePreparedCopy(base, prepared, {windowMillis, evidenceAgeMillis,
    technicalEvidenceDigest: digest(authority), technicalTransitionId: "isolated-copy-run", copyAuthority: authority});
  const state = {inFlightRequestCount: 0, unknownRequestCount: 0, reads: 0,
    patch: {}, sourceUnavailable: false};
  const batchUpdate = base.service.batchUpdate;
  base.service.batchUpdate = async (...args) => {
    state.inFlightRequestCount += 1;
    try { return await batchUpdate(...args); }
    catch (error) { state.unknownRequestCount += 1; throw error; }
    finally { state.inFlightRequestCount -= 1; }
  };
  const readCurrentCopyControls = async () => {
    state.reads += 1;
    if (state.sourceUnavailable) return null;
    const submitted = base.service.mutations;
    const receipt = await base.receipt();
    return {schemaVersion: 1, kind: "isolated-copy-runtime", authorityDigest: digest(authority),
      observedAtMillis: now, serviceAccountEmail: authority.serviceAccountEmail,
      serviceAccountUniqueId: authority.serviceAccountUniqueId,
      serviceAccountDisabled: false, userManagedKeyCount: 0, directProjectRoleCount: 0,
      grantPolicyDigest: authority.grantPolicyDigest, tokenExpiresAtMillis: authority.tokenExpiresAtMillis,
      tokenScopes: authority.tokenScopes, runnerInstanceId: authority.runnerInstanceId,
      runnerSourceDigest: authority.runnerSourceDigest, runnerPid: 30101, lockOwnerPid: 30101,
      lockRunnerStartedAtMillis: authority.runnerStartedAtMillis, lockNonceDigest: authority.lockNonceDigest,
      submittedRequestCount: submitted.length, inFlightRequestCount: state.inFlightRequestCount,
      unknownRequestCount: state.unknownRequestCount,
      submittedRequestDigest: submitted.length === 1 ? "shift-sheets:v1:sha256:" + createHash("sha256")
        .update(JSON.stringify({requests: submitted[0].requestBody.requests})).digest("hex") : null,
      receiptBindingDigest: submitted.length === 1 ? receipt?.ownerMaintenance?.bindingDigest ?? null : null,
      ...state.patch};
  };
  const runtime = await composition(base, approval, {copyRehearsal: scope, readCurrentCopyControls,
    // A copy proof must stand on its own, without a declared shared-control packet.
    readCurrentExternalControls: undefined});
  const execute = (extra = {}) => runtime.execute({commandId: base.command().commandId,
    workerId: "isolated-copy-worker", attemptId: "isolated-copy-attempt", ...extra});
  assert.equal((await db.doc(EXTERNAL).get()).exists, false);
  assert.equal((await db.collection(`${ROOT}/shiftPlanningOperations`).get()).docs
    .some((document) => document.id.startsWith("barrier-evidence-")), false);
  return {...base, approval, authority, copyRuntimeState: state, copyScope: scope,
    readCurrentCopyControls, runtime, execute};
}
async function unchangedBusiness(base) {
  assert.deepEqual(await base.protectedData(), base.publishedBefore);
  assert.equal((await db.collection(`${ROOT}/notificationEvents`).get()).empty, true);
  assert.equal((await db.collection("production/plus-collections/notificationEvents").get()).empty, true);
}
async function heldWithoutCompletion(base) {
  const receipt = await base.receipt();
  assert.equal(receipt.schemaVersion, 3);
  assert.equal((await base.reference().get()).get("state"), "processing");
  assert.notEqual((await base.partition()).lease, null);
  const pointer = (await db.doc(`${ROOT}/shiftPlanningState/sheetsSubmission`).get()).data();
  assert.deepEqual(pointer.guardIncident, receipt.guardIncident);
  assert.ok(receipt.guardIncident);
  assert.equal(receipt.guardIncident.bindingDigest, receipt.ownerMaintenance.bindingDigest);
  assert.equal(receipt.guardIncident.incidentDigest, digest(Object.fromEntries(
    Object.entries(receipt.guardIncident).filter(([key]) => key !== "incidentDigest"))));
  await unchangedBusiness(base);
  return receipt;
}
async function rejectedOrHeld(work) {
  try {
    const result = await work();
    assert.equal(result.kind, "reconciliationRequired");
  } catch (error) {
    assert.equal(error.code, "invalid_planning_sync_command");
  }
}
async function noExternalSubmission(base) {
  assert.equal(base.service.mutations.length, 0);
  assert.equal(await base.receipt(), undefined);
  assert.equal((await db.doc(`${ROOT}/shiftPlanningState/sheetsSubmission`).get()).exists, false);
  assert.notEqual((await base.reference().get()).get("state"), "completed");
  await unchangedBusiness(base);
}
function reportDuringLastGoogleRead(base, targetCycle, patch) {
  const about = base.drive.about.get, file = base.drive.files.get;
  let cycle = 0, armed = false, changed = false;
  base.drive.about.get = async (...args) => {
    const result = await about(...args);
    cycle += 1;
    if (cycle === targetCycle) armed = true;
    return result;
  };
  base.drive.files.get = async (params, options) => {
    const result = await file(params, options);
    if (armed && params.fields === "id,mimeType,trashed,version") {
      armed = false; changed = true;
      if (typeof patch === "function") await patch();
      else await db.doc(`${ROOT}/shiftPlanningOperations/${AUTHORIZATION}`).update(patch);
    }
    return result;
  };
  return () => changed;
}

test("copy preparation uses the real source and adapter but creates no claim, receipt or Google batch", async () => {
  const f = await setup();
  const before = (await f.reference().get()).data();
  const preview = await composition(f, f.approval, {copyRehearsal: copyScope()});
  const prepared = await preview.prepareCopyRehearsal({commandId: f.command().commandId,
    proposedWindow: {startsAtMillis: now - 100, endsAtMillis: now + 500,
      recoveryDeadlineMillis: now + 120_000}});
  assert.equal(prepared.canApply, false);
  assert.equal(prepared.operationalReady, false);
  assert.equal(prepared.copyWorkbookId, COPY);
  assert.equal(prepared.planned.batch.requestDigest, f.approval.planned.requestDigest);
  assert.equal(prepared.planned.preservationManifest.digest, f.approval.preservation.digest);
  assert.deepEqual((await f.reference().get()).data(), before);
  assert.equal((await f.partition()).lease, null);
  await noExternalSubmission(f);
});

test("the concrete composition admits its reviewed copy batch and legitimate postimage before completing the real lease", async () => {
  const f = await setup();
  const before = clone(f.service.state);
  assert.equal((await f.execute()).kind, "completed");
  assert.equal(f.service.mutations.length, 1);
  assert.notDeepEqual(clone(f.service.state), before);
  const receipt = await f.receipt();
  assert.equal(receipt.schemaVersion, 3);
  assert.equal(receipt.beforeWorkbookRevision, "10");
  assert.equal(receipt.evidence.workbookRevision, "11");
  assert.equal(receipt.guardIncident, null);
  assert.equal(receipt.ownerMaintenance.batchIntent.preservationManifestDigest, f.approval.preservation.digest);
  assert.equal(receipt.ownerMaintenance.authorizationDigest, f.approval.expectedAuthorizationDigest);
  assert.equal(receipt.ownerMaintenance.claim.workerId, "owner-sheets-worker");
  assert.equal((await f.partition()).lease, null);
  assert.equal(f.service.state.sheets[0].data[0].rowData[0].values[0].note,
    "Preserve the reviewed annotation");
  await unchangedBusiness(f);
});

test("an applied batch with a lost acknowledgement is verified once, never physically resubmitted", async () => {
  const f = await setup();
  f.service.loseAcknowledgement = true;
  assert.equal((await f.execute()).kind, "completed");
  assert.equal(f.service.mutations.length, 1);
  const image = clone(f.service.state);
  assert.equal((await f.execute()).kind, "terminalReplay");
  assert.equal(f.service.mutations.length, 1);
  assert.deepEqual(clone(f.service.state), image);
  await unchangedBusiness(f);
});

for (const [label, change] of [
  ["an active owner content restriction", (f) => {
    f.metadata.contentRestrictions = [{readOnly: true, ownerRestricted: true,
      systemRestricted: false, type: "globalContentRestriction"}];
  }],
  ["unknown content restrictions", (f) => { f.metadata.contentRestrictions = null; }],
  ["unknown runtime content capability", (f) => { delete f.metadata.capabilities.canModifyContent; }],
  ["unknown restriction capability", (f) => { delete f.metadata.capabilities.canRemoveContentRestriction; }],
  ["an additional human editor", (f) => {
    f.permissions.push({id: "unreviewed-editor", type: "user", role: "writer",
      emailAddress: "another@example.test", deleted: false});
  }],
  ["owner credentials used as the runtime", (f) => {
    const get = f.drive.about.get;
    f.drive.about.get = async (...args) => {
      const response = await get(...args);
      return {data: {user: {...response.data.user, permissionId: OWNER, emailAddress: "owner@example.test"}}};
    };
  }],
]) {
  test(`${label} is denied before preparing a receipt or sending a batch`, async () => {
    const f = await setup();
    change(f);
    await rejectedOrHeld(() => f.execute());
    await noExternalSubmission(f);
  });
}

test("a retained technical packet cannot replace a missing current external hold", async () => {
  const f = await setup();
  await db.doc(EXTERNAL).delete();
  await rejectedOrHeld(() => f.execute());
  await noExternalSubmission(f);
});

test("the copy rehearsal allowlist rejects either original workbook before Google protocol access", async () => {
  const f = await setup();
  for (const original of ORIGINALS) {
    const reads = f.reads.length, sheetReads = f.service.reads.length;
    const config = createShiftSheetsConfig({environment: "develop", workbooks: {develop: original}});
    await assert.rejects(async () => {
      const runtime = await composition(f, f.approval, {config, copyRehearsal: copyScope()});
      return runtime.execute({commandId: f.command().commandId, workerId: "wrong-target", attemptId: "wrong-target"});
    });
    assert.equal(f.reads.length, reads);
    assert.equal(f.service.reads.length, sheetReads);
    assert.equal(f.service.mutations.length, 0);
  }
  await unchangedBusiness(f);
});

test("the isolated-copy execution path cannot reinterpret a shared-control fixture as copy authority", async () => {
  const f = await setup();
  const runtime = await composition(f, f.approval, {copyRehearsal: copyScope()});
  await assert.rejects(runtime.execute({commandId: f.command().commandId,
    workerId: "unapproved-copy", attemptId: "unapproved-copy"}));
  await noExternalSubmission(f);
});

test("expiry inside the technical evidence lifetime denies the batch with no external submission", async () => {
  const f = await setup();
  now = f.approval.authorization.agreement.payload.intent.endsAtMillis;
  await rejectedOrHeld(() => f.execute());
  await noExternalSubmission(f);
});

for (const kind of ["epoch", "claim-expiry", "technical-expiry"]) {
  test(`${kind} changing during the final pre-batch Google read cannot cross the final Firestore authorization`, async () => {
    const f = await setup({windowMillis: 300_000, evidenceAgeMillis: 500_000,
      technicalEvidenceAgeMillis: kind === "technical-expiry" ? 1000 : 500_000});
    const startedAtMillis = now;
    const get = f.drive.about.get;
    let ownerReads = 0, tripped = false;
    f.drive.about.get = async (...args) => {
      const response = await get(...args);
      ownerReads += 1;
      if (ownerReads === 2) {
        tripped = true;
        if (kind === "epoch") {
          await db.doc(`${ROOT}/shiftPlanningState/current`).update({writeEpoch: f.command().writeEpoch + 1});
        } else if (kind === "claim-expiry") {
          const claim = (await f.reference().get()).get("claim");
          now = claim.expiresAt.toMillis();
          assert.ok(now < f.approval.authorization.agreement.payload.intent.endsAtMillis);
        } else {
          now = startedAtMillis + 1001;
          assert.ok(now < (await f.reference().get()).get("claim.expiresAt").toMillis());
          assert.ok(now < f.approval.authorization.agreement.payload.intent.endsAtMillis);
        }
      }
      return response;
    };
    await rejectedOrHeld(() => f.execute());
    assert.equal(tripped, true);
    assert.equal(f.service.mutations.length, 0);
    assert.notEqual((await f.reference().get()).get("state"), "completed");
    const receipt = await f.receipt();
    if (receipt) {
      assert.equal(receipt.evidence, null);
      assert.ok(receipt.guardIncident);
    }
    await unchangedBusiness(f);
  });
}

test("an initially adverse owner report is latched even if a later Google read would observe its restoration", async () => {
  const f = await setup();
  const registry = db.doc(`${ROOT}/shiftPlanningOperations/${AUTHORIZATION}`);
  await registry.update({"ownerReport.ownerActivity": "reported"});
  reportDuringLastGoogleRead(f, 1, {"ownerReport.ownerActivity": "none-reported"});
  await rejectedOrHeld(() => f.execute());
  await noExternalSubmission(f);
  const incident = (await registry.get()).get("controlIncident");
  assert.ok(incident);
  assert.equal(incident.authorizationDigest, f.approval.expectedAuthorizationDigest);
  assert.equal(incident.reason, "owner_controls_rejected");
  assert.equal(incident.phase, "before-submission");
});

test("time elapsed between observing the workbook and creating its proof cannot rejuvenate that observation", async () => {
  const base = await setupBase();
  const approval = await authorizeCopy(base, {windowMillis: 300_000,
    evidenceAgeMillis: 100, technicalEvidenceAgeMillis: 500_000});
  const observedAtMillis = now;
  let physical = false, postClockCalls = 0, advanced = false;
  const runtime = await composition(base, approval, {nowMillis: () => {
    if (physical && ++postClockCalls >= 3) { now = observedAtMillis + 101; advanced = true; }
    return now;
  }});
  base.service.onMutation = async () => { physical = true; };
  await rejectedOrHeld(() => runtime.execute({commandId: base.command().commandId,
    workerId: "elapsed-proof", attemptId: "elapsed-proof"}));
  assert.equal(advanced, true);
  assert.equal(base.service.mutations.length, 1);
  const receipt = await heldWithoutCompletion(base);
  assert.equal(receipt.evidence, null);
  assert.ok(now < approval.authorization.agreement.payload.intent.endsAtMillis);
});

for (const [phase, cycle] of [["before-submission", 2], ["readback", 3]]) {
  test(`a fresh owner report changed during the last ${phase} Google read is rejected by the following transaction`, async () => {
    const f = await setup();
    const changed = reportDuringLastGoogleRead(f, cycle, {"ownerReport.ownerActivity": "reported"});
    await rejectedOrHeld(() => f.execute());
    assert.equal(changed(), true);
    assert.notEqual((await f.reference().get()).get("state"), "completed");
    if (phase === "before-submission") {
      assert.equal(f.service.mutations.length, 0);
      const receipt = await f.receipt();
      const authorization = (await db.doc(`${ROOT}/shiftPlanningOperations/${AUTHORIZATION}`).get()).data();
      assert.ok(authorization.controlIncident || receipt?.guardIncident);
      if (receipt) assert.equal(receipt.evidence, null);
      await unchangedBusiness(f);
    } else {
      assert.equal(f.service.mutations.length, 1);
      const receipt = await heldWithoutCompletion(f);
      assert.equal(receipt.evidence, null);
      assert.equal(receipt.guardIncident.phase, "readback");
    }
  });
}

test("an adverse report restored within one Google read is not hidden by an unchanged final report digest", async () => {
  const f = await setup();
  const registry = db.doc(`${ROOT}/shiftPlanningOperations/${AUTHORIZATION}`);
  const changed = reportDuringLastGoogleRead(f, 2, async () => {
    await registry.update({"ownerReport.ownerActivity": "reported"});
    await registry.update({"ownerReport.ownerActivity": "none-reported"});
  });
  await rejectedOrHeld(() => f.execute());
  assert.equal(changed(), true);
  assert.equal((await registry.get()).get("ownerReport.ownerActivity"), "none-reported");
  assert.equal(f.service.mutations.length, 0);
  const receipt = await f.receipt();
  assert.ok((await registry.get()).get("controlIncident") || receipt?.guardIncident);
  assert.notEqual((await f.reference().get()).get("state"), "completed");
  await unchangedBusiness(f);
});

test("a pre-submission owner report latches the reviewed authorization instead of disappearing when the report is restored", async () => {
  const f = await setup();
  const registry = db.doc(`${ROOT}/shiftPlanningOperations/${AUTHORIZATION}`);
  await registry.update({"ownerReport.ownerActivity": "reported"});
  await rejectedOrHeld(() => f.execute());
  await noExternalSubmission(f);
  const incident = (await registry.get()).get("controlIncident");
  assert.equal(incident.authorizationDigest, f.approval.expectedAuthorizationDigest);
  assert.equal(incident.phase, "before-submission");
  assert.equal(incident.reason, "owner_controls_rejected");
  assert.ok(incident.observationDigest);
  await registry.update({"ownerReport.ownerActivity": "none-reported"});
  let command = (await f.reference().get()).data();
  let token;
  if (command.state === "pending") {
    const claimed = await f.repository.claim({environment: "develop", commandId: command.commandId,
      workerId: "blocked-reader", attemptId: "blocked-reader"});
    command = claimed.command; token = claimed.token;
  } else token = createShiftPlanningSyncCommandToken({environment: "develop", command});
  const authorized = await f.repository.authorizeBatch(token);
  await rejectedOrHeld(() => f.runtime.consumer.apply(authorized, async () => {
    await f.repository.authorizeBatch(token);
  }));
  assert.equal(f.service.mutations.length, 0);
  assert.equal(await f.receipt(), undefined);
  assert.deepEqual((await registry.get()).get("controlIncident"), incident);
  await unchangedBusiness(f);
});

test("a reported owner edit after the physical batch is sticky even if the report later says no activity", async () => {
  const f = await setup();
  f.service.onMutation = async () => {
    await db.doc(`${ROOT}/shiftPlanningOperations/${AUTHORIZATION}`).update({"ownerReport.ownerActivity": "reported"});
  };
  await rejectedOrHeld(() => f.execute());
  assert.equal(f.service.mutations.length, 1);
  const retained = await heldWithoutCompletion(f);
  assert.equal(retained.guardIncident.reason, "owner_controls_rejected");
  const image = clone(f.service.state);
  await db.doc(`${ROOT}/shiftPlanningOperations/${AUTHORIZATION}`).update({"ownerReport.ownerActivity": "none-reported"});
  await rejectedOrHeld(() => f.execute({workerId: "recovery-reader", attemptId: "recovery-reader"}));
  assert.equal(f.service.mutations.length, 1);
  assert.deepEqual(clone(f.service.state), image);
  assert.deepEqual((await f.receipt()).guardIncident, retained.guardIncident);
  assert.equal((await f.reference().get()).get("state"), "processing");
});

test("post-batch edits to the other observed partition fail preservation without retry or inverse writes", async () => {
  const f = await setup();
  f.service.onMutation = async () => {
    const other = f.service.state.sheets.find((sheet) => sheet.properties.title.includes("mercado"));
    setCell(other, 0, 0, {userEnteredValue: {stringValue: "Unreviewed market change"}});
  };
  await rejectedOrHeld(() => f.execute());
  assert.equal(f.service.mutations.length, 1);
  const retained = await heldWithoutCompletion(f);
  assert.equal(retained.guardIncident.reason, "workbook_preservation_rejected");
  const other = f.service.state.sheets.find((sheet) => sheet.properties.title.includes("mercado"));
  assert.equal(content(other, 0, 0).stringValue, "Unreviewed market change");
  const image = clone(f.service.state);
  await rejectedOrHeld(() => f.execute());
  assert.equal(f.service.mutations.length, 1);
  assert.deepEqual(clone(f.service.state), image);
});

test("owner-window expiry after an accepted batch retains its afterimage and unresolved lease", async () => {
  const f = await setup();
  f.service.onMutation = async () => { now = f.approval.authorization.agreement.payload.intent.endsAtMillis; };
  await rejectedOrHeld(() => f.execute());
  assert.equal(f.service.mutations.length, 1);
  const retained = await heldWithoutCompletion(f);
  assert.equal(retained.guardIncident.reason, "owner_window_expired");
  now += 120_000;
  await rejectedOrHeld(() => f.execute({workerId: "late-reader", attemptId: "late-reader"}));
  assert.equal(f.service.mutations.length, 1);
  assert.deepEqual((await f.receipt()).guardIncident, retained.guardIncident);
});

test("a changed command epoch before execution cannot reach the Sheets submission path", async () => {
  const f = await setup();
  await db.doc(`${ROOT}/shiftPlanningState/current`).update({writeEpoch: f.command().writeEpoch + 1});
  await rejectedOrHeld(() => f.execute());
  await noExternalSubmission(f);
});

test("an epoch change after the physical batch can still retain the original submission incident", async () => {
  const f = await setup();
  f.service.onMutation = async () => {
    await db.doc(`${ROOT}/shiftPlanningState/current`).update({writeEpoch: f.command().writeEpoch + 1});
  };
  await rejectedOrHeld(() => f.execute());
  assert.equal(f.service.mutations.length, 1);
  const retained = await heldWithoutCompletion(f);
  assert.equal(retained.guardIncident.reason, "owner_controls_unavailable");
  assert.equal(retained.command.writeEpoch, f.command().writeEpoch);
  assert.equal((await db.doc(`${ROOT}/shiftPlanningState/current`).get()).get("writeEpoch"),
    retained.command.writeEpoch + 1);
});

test("a cached verified receipt cannot bypass a fresh owner check or clear a later incident", async () => {
  const f = await setup();
  const claim = await f.repository.claim({environment: "develop", commandId: f.command().commandId,
    workerId: "before-crash", attemptId: "before-crash"});
  const authorized = await f.repository.authorizeBatch(claim.token);
  const evidence = await f.runtime.consumer.apply(authorized, async () => {
    await f.repository.authorizeBatch(claim.token);
  });
  assert.equal("kind" in evidence, false);
  assert.notEqual((await f.receipt()).evidence, null);
  assert.equal((await f.reference().get()).get("state"), "processing");
  assert.equal(f.service.mutations.length, 1);
  await db.doc(`${ROOT}/shiftPlanningOperations/${AUTHORIZATION}`).update({"ownerReport.ownerActivity": "reported"});
  await rejectedOrHeld(() => f.execute({workerId: "after-crash", attemptId: "after-crash"}));
  const retained = await heldWithoutCompletion(f);
  assert.equal(retained.guardIncident.reason, "owner_controls_rejected");
  await db.doc(`${ROOT}/shiftPlanningOperations/${AUTHORIZATION}`).update({"ownerReport.ownerActivity": "none-reported"});
  await rejectedOrHeld(() => f.execute({workerId: "another-reader", attemptId: "another-reader"}));
  assert.deepEqual((await f.receipt()).guardIncident, retained.guardIncident);
  assert.equal(f.service.mutations.length, 1);
  await assert.rejects(f.repository.complete({token: claim.token, evidence}));
  assert.equal((await f.reference().get()).get("state"), "processing");
  await unchangedBusiness(f);
});

test("a report changed after the final fresh proof but before the completion transaction cannot complete the command", async () => {
  const f = await setup();
  const complete = f.runtime.repository.complete.bind(f.runtime.repository);
  let changed = false;
  f.runtime.repository.complete = async (request) => {
    changed = true;
    await db.doc(`${ROOT}/shiftPlanningOperations/${AUTHORIZATION}`).update({"ownerReport.agreementStatus": "withdrawn"});
    return complete(request);
  };
  try { await rejectedOrHeld(() => f.execute()); }
  finally { f.runtime.repository.complete = complete; }
  assert.equal(changed, true);
  assert.equal(f.service.mutations.length, 1);
  const receipt = await heldWithoutCompletion(f);
  assert.notEqual(receipt.evidence, null);
  assert.equal(receipt.guardIncident.phase, "completion");
  const image = clone(f.service.state);
  await db.doc(`${ROOT}/shiftPlanningOperations/${AUTHORIZATION}`).update({"ownerReport.agreementStatus": "confirmed"});
  await rejectedOrHeld(() => f.execute({workerId: "after-completion-race", attemptId: "after-completion-race"}));
  assert.equal(f.service.mutations.length, 1);
  assert.deepEqual(clone(f.service.state), image);
  assert.deepEqual((await f.receipt()).guardIncident, receipt.guardIncident);
});

test("an accepted lost acknowledgement with unavailable read-back remains inspect-only and never sends the batch again", async () => {
  const f = await setup();
  f.service.loseAcknowledgement = true;
  f.service.onMutation = async () => { f.service.failRead = true; };
  await rejectedOrHeld(() => f.execute());
  assert.equal(f.service.mutations.length, 1);
  const retained = await heldWithoutCompletion(f);
  assert.equal(retained.evidence, null);
  const image = clone(f.service.state);
  f.service.failRead = false;
  f.service.loseAcknowledgement = false;
  f.service.onMutation = null;
  await rejectedOrHeld(() => f.execute({workerId: "read-only-recovery", attemptId: "read-only-recovery"}));
  assert.equal(f.service.mutations.length, 1);
  assert.deepEqual(clone(f.service.state), image);
  assert.deepEqual((await f.receipt()).guardIncident, retained.guardIncident);
  assert.equal((await f.reference().get()).get("state"), "processing");
});

test("isolated-copy uses its own current runtime controls and real receipt without a shared barrier fixture", async () => {
  const f = await setupIsolatedCopy();
  assert.equal((await f.execute()).kind, "completed");
  assert.equal(f.service.mutations.length, 1);
  assert.ok(f.copyRuntimeState.reads >= 4);
  const receipt = await f.receipt();
  assert.equal(receipt.schemaVersion, 3);
  assert.equal(receipt.ownerMaintenance.batchIntent.schemaVersion, 2);
  assert.equal(receipt.ownerMaintenance.batchIntent.technicalControlKind, "isolated-copy-runtime");
  assert.deepEqual(receipt.ownerMaintenance.copyAuthority, f.authority);
  assert.equal(receipt.guardIncident, null);
  assert.equal(receipt.evidence.workbookRevision, "11");
  assert.equal((await f.partition()).lease, null);
  assert.equal((await db.doc(EXTERNAL).get()).exists, false);
  assert.equal((await db.collection(`${ROOT}/shiftPlanningOperations`).get()).docs
    .some((document) => document.id.startsWith("barrier-evidence-")), false);
  await unchangedBusiness(f);
});

test("isolated-copy never consults an injected Firestore client outside its owned demo client", async () => {
  const f = await setupIsolatedCopy();
  let forbiddenAccesses = 0;
  const forbiddenClient = new Proxy({}, {get() {
    forbiddenAccesses += 1;
    throw new Error("Injected Firestore is outside the isolated-copy boundary");
  }});
  const runtime = await composition(f, f.approval, {firestore: forbiddenClient,
    copyRehearsal: f.copyScope, readCurrentCopyControls: f.readCurrentCopyControls,
    readCurrentExternalControls: undefined});
  const prepared = await runtime.prepareCopyRehearsal({commandId: f.command().commandId,
    proposedWindow: {startsAtMillis: now - 100, endsAtMillis: now + 300_000,
      recoveryDeadlineMillis: now + 360_000}});
  assert.equal(prepared.canApply, false);
  assert.equal((await runtime.execute({commandId: f.command().commandId,
    workerId: "owned-demo-client", attemptId: "owned-demo-client"})).kind, "completed");
  assert.equal(forbiddenAccesses, 0);
  assert.equal(f.service.mutations.length, 1);
  await unchangedBusiness(f);
});

function ownerWithInheritedWriterDetail(base) {
  const owner = base.permissions.find((permission) => permission.id === OWNER);
  owner.permissionDetails = [{role: "writer", inherited: true, inheritedFrom: null},
    {role: "owner", inherited: false}];
}

test("isolated-copy accepts the current named owner's inherited writer detail alongside its direct owner permission", async () => {
  const f = await setupIsolatedCopy({configureWorkbook: ownerWithInheritedWriterDetail});
  assert.equal(f.metadata.owners[0].permissionId, OWNER);
  assert.equal(f.approval.authorization.agreement.payload.intent.ownerPrincipalId, OWNER);
  assert.equal(f.approval.authorization.batchIntent.beforeAclDigest, (await f.observe()).authorityDigest);
  assert.equal((await f.execute()).kind, "completed");
  assert.equal(f.service.mutations.length, 1);
  assert.equal((await f.receipt()).guardIncident, null);
  assert.equal((await f.partition()).lease, null);
  await unchangedBusiness(f);
});

for (const [label, configure] of [
  ["an inherited runtime writer", (base) => {
    base.permissions.find((permission) => permission.id === RUNTIME).permissionDetails = [
      {permissionType: "file", role: "writer", inherited: true, inheritedFrom: "unreviewed-parent"},
    ];
  }],
  ["another direct writer", (base) => {
    base.permissions.push({id: "additional-direct-editor", type: "user", role: "writer",
      emailAddress: "extra-editor@example.test", deleted: false,
      permissionDetails: [{permissionType: "file", role: "writer", inherited: false}]});
  }],
  ["a different current file owner", (base) => {
    base.metadata.owners[0].permissionId = "different-current-owner";
  }],
]) {
  test(`the inherited-owner exception cannot admit ${label} even when that ACL is in the reviewed before-image`, async () => {
    const f = await setupIsolatedCopy({configureWorkbook: (base) => {
      ownerWithInheritedWriterDetail(base);
      configure(base);
    }});
    // Rejection must come from effective authority, rather than an unapproved
    // digest change introduced after preparation.
    assert.equal(f.approval.authorization.batchIntent.beforeAclDigest, (await f.observe()).authorityDigest);
    await rejectedOrHeld(() => f.execute());
    await noExternalSubmission(f);
  });
}

for (const [label, change] of [
  ["an additional editor on the copy", (f) => {
    f.permissions.push({id: "copy-extra-editor", type: "user", role: "writer",
      emailAddress: "extra@example.test", deleted: false});
  }],
  ["an unavailable runtime observation", (f) => { f.copyRuntimeState.sourceUnavailable = true; }],
  ["a different immutable service identity", (f) => {
    f.copyRuntimeState.patch.serviceAccountUniqueId = "100000000000000000002";
  }],
  ["a disabled service identity", (f) => { f.copyRuntimeState.patch.serviceAccountDisabled = true; }],
  ["a user-managed service key", (f) => { f.copyRuntimeState.patch.userManagedKeyCount = 1; }],
  ["a direct project role", (f) => { f.copyRuntimeState.patch.directProjectRoleCount = 1; }],
  ["an unknown token expiry", (f) => { f.copyRuntimeState.patch.tokenExpiresAtMillis = null; }],
  ["an unexpected token scope", (f) => {
    f.copyRuntimeState.patch.tokenScopes = [...f.authority.tokenScopes, "https://www.googleapis.com/auth/drive"];
  }],
  ["a lock held by another runner", (f) => { f.copyRuntimeState.patch.lockOwnerPid = 30102; }],
  ["a different runner start", (f) => {
    f.copyRuntimeState.patch.lockRunnerStartedAtMillis = f.authority.runnerStartedAtMillis + 1;
  }],
  ["an unknown prior request", (f) => { f.copyRuntimeState.patch.unknownRequestCount = 1; }],
  ["an in-flight prior request", (f) => { f.copyRuntimeState.patch.inFlightRequestCount = 1; }],
  ["a stale runner observation", (f) => {
    f.copyRuntimeState.patch.observedAtMillis = now - f.authority.maximumEvidenceAgeMillis;
  }],
  ["a future runner observation", (f) => { f.copyRuntimeState.patch.observedAtMillis = now + 1; }],
]) {
  test(`isolated-copy rejects ${label} before any external submission`, async () => {
    const f = await setupIsolatedCopy();
    change(f);
    await rejectedOrHeld(() => f.execute());
    await noExternalSubmission(f);
    if (["a different immutable service identity", "an unknown prior request"].includes(label)) {
      const registry = db.doc(`${ROOT}/shiftPlanningOperations/${AUTHORIZATION}`);
      const incident = (await registry.get()).get("controlIncident");
      assert.equal(incident.authorizationDigest, f.approval.expectedAuthorizationDigest);
      assert.equal(incident.phase, "before-submission");
      assert.ok(incident.observationDigest);
      f.copyRuntimeState.patch = {};
      await rejectedOrHeld(() => f.execute({workerId: "copy-after-invalid-observation",
        attemptId: "copy-after-invalid-observation"}));
      await noExternalSubmission(f);
      assert.deepEqual((await registry.get()).get("controlIncident"), incident);
    }
  });
}

for (const [variable, invalid] of [["GCLOUD_PROJECT", "real-project-denied"],
  ["FIRESTORE_EMULATOR_HOST", "192.0.2.1:8897"]]) {
  test(`isolated-copy rejects an unapproved ${variable} before Google reads or a lease claim`, async () => {
    const f = await setupIsolatedCopy();
    const previous = process.env[variable];
    const commandBefore = (await f.reference().get()).data();
    const googleReads = f.reads.length, sheetsReads = f.service.reads.length;
    try {
      process.env[variable] = invalid;
      await assert.rejects(f.execute());
    } finally { process.env[variable] = previous; }
    assert.equal(f.reads.length, googleReads);
    assert.equal(f.service.reads.length, sheetsReads);
    assert.deepEqual((await f.reference().get()).data(), commandBefore);
    assert.equal((await f.partition()).lease, null);
    await noExternalSubmission(f);
  });
}

test("isolated-copy denies either protected original even when its copied authority is retargeted", async () => {
  const f = await setupIsolatedCopy();
  for (const original of ORIGINALS) {
    const reads = f.reads.length, sheetsReads = f.service.reads.length;
    const authority = {...f.authority, workbookId: original};
    const copyRehearsal = {...f.copyScope, copyWorkbookId: original, authority};
    const config = createShiftSheetsConfig({environment: "develop", workbooks: {develop: original}});
    await assert.rejects(async () => {
      const runtime = await composition(f, f.approval, {config, copyRehearsal,
        readCurrentCopyControls: f.readCurrentCopyControls});
      return runtime.execute({commandId: f.command().commandId,
        workerId: "denied-original", attemptId: "denied-original"});
    });
    assert.equal(f.reads.length, reads);
    assert.equal(f.service.reads.length, sheetsReads);
  }
  await noExternalSubmission(f);
});

test("isolated-copy authority cannot name a live project or extend its token lifetime", async () => {
  const f = await setupIsolatedCopy();
  for (const patch of [{demoProjectId: "real-project-denied"},
    {tokenExpiresAtMillis: f.authority.tokenIssuedAtMillis + 300_001}]) {
    const googleReads = f.reads.length, sheetsReads = f.service.reads.length;
    await assert.rejects(async () => {
      const runtime = await composition(f, f.approval, {
        copyRehearsal: {...f.copyScope, authority: {...f.authority, ...patch}},
        readCurrentCopyControls: f.readCurrentCopyControls});
      return runtime.execute({commandId: f.command().commandId,
        workerId: "wrong-copy-authority", attemptId: "wrong-copy-authority"});
    });
    assert.equal(f.reads.length, googleReads);
    assert.equal(f.service.reads.length, sheetsReads);
  }
  await noExternalSubmission(f);
});

test("isolated-copy runner token expiry denies execution while the owner window is still valid", async () => {
  const f = await setupIsolatedCopy();
  now = f.authority.tokenExpiresAtMillis;
  assert.ok(now < f.approval.authorization.agreement.payload.intent.endsAtMillis);
  await rejectedOrHeld(() => f.execute());
  await noExternalSubmission(f);
});

for (const kind of ["reported-owner-edit", "epoch-change"]) {
  test(`isolated-copy preserves the ${kind} gate before submitting`, async () => {
    const f = await setupIsolatedCopy();
    if (kind === "reported-owner-edit") {
      await db.doc(`${ROOT}/shiftPlanningOperations/${AUTHORIZATION}`).update({"ownerReport.ownerActivity": "reported"});
    } else {
      await db.doc(`${ROOT}/shiftPlanningState/current`).update({writeEpoch: f.command().writeEpoch + 1});
    }
    await rejectedOrHeld(() => f.execute());
    await noExternalSubmission(f);
  });
}

test("isolated-copy cannot complete after token expiry during its accepted batch or resend during recovery", async () => {
  const f = await setupIsolatedCopy();
  f.service.onMutation = async () => { now = f.authority.tokenExpiresAtMillis; };
  await rejectedOrHeld(() => f.execute());
  assert.equal(f.service.mutations.length, 1);
  const receipt = await heldWithoutCompletion(f);
  assert.equal(receipt.evidence, null);
  const image = clone(f.service.state);
  await rejectedOrHeld(() => f.execute({workerId: "expired-copy-reader", attemptId: "expired-copy-reader"}));
  assert.equal(f.service.mutations.length, 1);
  assert.deepEqual(clone(f.service.state), image);
  assert.deepEqual((await f.receipt()).guardIncident, receipt.guardIncident);
});

test("isolated-copy does not reuse a verified cached receipt after a new owner report", async () => {
  const f = await setupIsolatedCopy();
  const claim = await f.repository.claim({environment: "develop", commandId: f.command().commandId,
    workerId: "isolated-before-crash", attemptId: "isolated-before-crash"});
  const authorized = await f.repository.authorizeBatch(claim.token);
  const evidence = await f.runtime.consumer.apply(authorized, async () => {
    await f.repository.authorizeBatch(claim.token);
  });
  assert.equal("kind" in evidence, false);
  assert.ok((await f.receipt()).evidence);
  assert.equal(f.service.mutations.length, 1);
  const registry = db.doc(`${ROOT}/shiftPlanningOperations/${AUTHORIZATION}`);
  await registry.update({"ownerReport.ownerActivity": "reported"});
  await rejectedOrHeld(() => f.execute({workerId: "isolated-after-crash", attemptId: "isolated-after-crash"}));
  const retained = await heldWithoutCompletion(f);
  assert.equal(retained.guardIncident.reason, "owner_controls_rejected");
  await registry.update({"ownerReport.ownerActivity": "none-reported"});
  await rejectedOrHeld(() => f.execute({workerId: "isolated-restored-report", attemptId: "isolated-restored-report"}));
  assert.equal(f.service.mutations.length, 1);
  assert.deepEqual((await f.receipt()).guardIncident, retained.guardIncident);
  await assert.rejects(f.repository.complete({token: claim.token, evidence}));
  await unchangedBusiness(f);
});

test("isolated-copy retains an unknown acknowledgement and never resubmits its physical batch", async () => {
  const f = await setupIsolatedCopy();
  f.service.loseAcknowledgement = true;
  await rejectedOrHeld(() => f.execute());
  assert.equal(f.service.mutations.length, 1);
  assert.equal(f.copyRuntimeState.unknownRequestCount, 1);
  const receipt = await heldWithoutCompletion(f);
  assert.equal(receipt.evidence, null);
  const image = clone(f.service.state);
  f.service.loseAcknowledgement = false;
  // Even a later inspection that clears transport uncertainty cannot erase the incident.
  f.copyRuntimeState.unknownRequestCount = 0;
  await rejectedOrHeld(() => f.execute({workerId: "copy-inspection-only", attemptId: "copy-inspection-only"}));
  assert.equal(f.service.mutations.length, 1);
  assert.deepEqual(clone(f.service.state), image);
  assert.deepEqual((await f.receipt()).guardIncident, receipt.guardIncident);
});
