"use strict";

// Deliberately local: this runner has no deployment/export and no ADC fallback.
// The parent owns IAM credentials; this process receives one short Google token
// and asks the parent only for fresh identity-policy observations over IPC.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const {Firestore} = require("@google-cloud/firestore");
const {google} = require("googleapis");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {createShiftSheetsConfig} = require("../lib/shift-sheets-config.js");
const {observeShiftSheetsWorkbook} = require("../lib/shift-sheets-operational-preflight.js");
const {assertShiftSheetsOwnerPreservation} = require("../lib/shift-sheets-owner-manifest.js");
const {createShiftPlanningOwnerSheetsComposition} = require("../lib/shift-planning-owner-sheets-composition.js");
const {createShiftPlanningOwnerSheetsCopyAgreement, parseShiftPlanningOwnerSheetsCopyAuthority,
  SHIFT_PLANNING_COPY_TOKEN_SCOPES} = require("../lib/shift-planning-owner-sheets-copy-controls.js");
const {shiftPlanningOwnerSheetsAuthorizationDigest} = require("../lib/shift-planning-owner-sheets-contract.js");
const {materializeShiftPlanningForwardActivation} = require("../lib/shift-planning-forward-materializer.js");
const {fixture, fairnessSnapshot, materializerInput} = require("../test/shift-planning-activation-fixture.cjs");

const HOST = "127.0.0.1:8897";
const ROOT = "develop/plus-collections";
const fail = (message) => { throw new Error(message); };
const hashFile = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const safeId = (value) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,100}$/.test(value);
const writePrivate = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", {mode: 0o600});

function createShortTokenAuth(accessToken, expiresAtMillis) {
  // The SDK's default five-minute eager refresh would reject this deliberately
  // short, non-refreshable token before its first request. Zero is ignored by
  // the installed AuthClient constructor; one millisecond preserves real expiry.
  const auth = new google.auth.OAuth2({eagerRefreshThresholdMillis: 1, forceRefreshOnFailure: false});
  auth.setCredentials({access_token: accessToken, expiry_date: expiresAtMillis});
  return auth;
}

function ownsLock(file, descriptor, expected) {
  try {
    const held = fs.fstatSync(descriptor);
    const current = fs.lstatSync(file);
    return current.isFile() && held.dev === current.dev && held.ino === current.ino &&
      fs.readFileSync(file, "utf8") === JSON.stringify(expected);
  } catch { return false; }
}

function runnerSourceDigest() {
  const root = path.resolve(__dirname, "..");
  const files = [__filename, path.join(root, "package-lock.json"),
    path.join(root, "test/shift-planning-activation-fixture.cjs")];
  function walk(directory) {
    for (const item of fs.readdirSync(directory, {withFileTypes: true})) {
      const file = path.join(directory, item.name);
      if (item.isDirectory()) walk(file);
      else if (item.isFile() && /\.(js|ts)$/.test(item.name)) files.push(file);
    }
  }
  walk(path.join(root, "lib"));
  walk(path.join(root, "src"));
  return digest(files.sort().map((file) => ({path: path.relative(root, file), sha256: hashFile(file)})));
}

function validatePacket(packet) {
  if (!packet || packet.schemaVersion !== 1 || !safeId(packet.copyWorkbookId) ||
      !safeId(packet.runId) || packet.runId.length > 48 || !/^demo-reguerta-copy-[a-z0-9-]{1,20}$/.test(packet.demoProjectId ?? "") ||
      !Array.isArray(packet.protectedWorkbookIds) || packet.protectedWorkbookIds.length < 2 ||
      packet.protectedWorkbookIds.some((value) => !safeId(value)) ||
      new Set(packet.protectedWorkbookIds).size !== packet.protectedWorkbookIds.length ||
      packet.protectedWorkbookIds.includes(packet.copyWorkbookId) ||
      !["prepare", "execute", "inspect"].includes(packet.mode) ||
      process.env.FIRESTORE_EMULATOR_HOST !== HOST ||
      process.env.GCLOUD_PROJECT !== packet.demoProjectId) fail("Exact copy and local demo boundaries required.");
  if (packet.mode === "execute") {
    const owner = packet.ownerConfirmation;
    const now = Date.now();
    if (!owner || !safeId(owner.receiptId) || owner.onlineClosedNoOfflineEdits !== true ||
        owner.noManualOrAutomationWrites !== true || owner.noAdditionalTokenMinting !== true ||
        ![owner.confirmedAtMillis, owner.startsAtMillis, owner.endsAtMillis].every(Number.isSafeInteger) ||
        owner.confirmedAtMillis > now || owner.confirmedAtMillis < owner.startsAtMillis ||
        owner.startsAtMillis > now || owner.endsAtMillis <= now ||
        owner.endsAtMillis - owner.startsAtMillis > 1200000) fail("Fresh bounded owner confirmation required.");
  }
  return packet;
}

async function seedSyntheticSource(db, workbookId, workbookVersion) {
  const existing = await db.listCollections();
  if (existing.length) fail("A new empty demo project is required; existing evidence is never reset.");
  const snapshot = fairnessSnapshot();
  for (const partition of Object.values(snapshot.sync.partitions)) {
    partition.workbookId = workbookId;
    partition.workbookRevision = workbookVersion;
  }
  const value = fixture(snapshot);
  const activation = materializeShiftPlanningForwardActivation(materializerInput(value));
  const batch = db.batch();
  for (const mutation of activation.mutations) batch.set(db.doc(mutation.documentPath), mutation.data);
  batch.set(db.doc(`${ROOT}/shiftPlanningBundles/${value.preflight.bundle.bundleRevision}`), value.preflight.bundle);
  batch.set(db.doc(`${ROOT}/shiftPlanningState/sourcePolicy`), {environment: "develop", sync: snapshot.sync});
  const users = new Set(activation.publicDocuments.flatMap(({document}) =>
    [...document.assignedUserIds, ...(document.helperUserId ? [document.helperUserId] : [])]));
  for (const id of users) batch.set(db.doc(`${ROOT}/users/${id}`), {
    displayName: `Persona de ensayo ${id.slice(7)}`, phoneNumber: "", roles: ["member"],
  });
  await batch.commit();
  const command = value.liveResult.syncCommands.find((item) => item.type === "market");
  if (!command || digest(command.affectedProjectionSeasonStartYears) !== digest([2026])) {
    fail("The reviewed one-season synthetic market source changed.");
  }
  return command;
}

async function readRawOriginalTabs({drive, sheets, workbookId, originals}) {
  const version = async () => {
    const value = (await drive.files.get({fileId: workbookId, fields: "id,version"},
      {retry: false, timeout: 15000})).data;
    if (value.id !== workbookId || !/^\d+$/.test(value.version ?? "")) fail("Raw workbook version required.");
    return value.version;
  };
  const before = await version();
  const column = (count) => count <= 26 ? String.fromCharCode(64 + count) :
    String.fromCharCode(64 + Math.floor((count - 1) / 26)) + String.fromCharCode(65 + (count - 1) % 26);
  const snapshot = (await sheets.get({spreadsheetId: workbookId,
    ranges: originals.map(({properties: p}) => `'${p.title.replace(/'/g, "''")}'!A1:` +
      column(p.gridProperties.columnCount) + p.gridProperties.rowCount),
    fields: "spreadsheetId,properties,sheets(properties,protectedRanges,merges,developerMetadata," +
      "conditionalFormats,basicFilter,filterViews,rowGroups,columnGroups,bandedRanges,charts," +
      "data(startRow,startColumn,rowData(values(userEnteredValue,userEnteredFormat,note," +
      "textFormatRuns,dataValidation,chipRuns))))",
  }, {retry: false, timeout: 15000})).data;
  const after = await version();
  const ids = originals.map((item) => item.properties.sheetId).sort((a, b) => a - b);
  snapshot.sheets = snapshot.sheets?.filter((item) => ids.includes(item.properties?.sheetId))
    .sort((a, b) => a.properties.sheetId - b.properties.sheetId);
  if (before !== after || snapshot.spreadsheetId !== workbookId ||
      digest(snapshot.sheets?.map((item) => item.properties.sheetId)) !== digest(ids)) fail("Raw original-tab read changed or is incomplete.");
  return {version: after, digest: digest(snapshot), snapshot};
}

function assertOneNewTabPlan(planned, title, existingIds) {
  const requests = planned?.batch?.requests;
  if (!Array.isArray(requests)) fail("No concrete batch was prepared.");
  const added = requests.filter((item) => item.addSheet).map((item) => item.addSheet.properties);
  if (added.length !== 1 || added[0].title !== title || existingIds.includes(added[0].sheetId)) {
    fail("Only one new reviewed rehearsal tab is allowed.");
  }
  const newId = added[0].sheetId;
  for (const request of requests) {
    if (!request || Object.keys(request).length !== 1) fail("One reviewed action per request is required.");
    if (request.addSheet) continue;
    if (request.updateCells && request.updateCells.range.sheetId === newId &&
        request.updateCells.fields === "userEnteredValue") continue;
    if (request.createDeveloperMetadata && request.createDeveloperMetadata.developerMetadata.location.sheetId === newId) continue;
    fail("The copy plan would modify an existing tab or an unreviewed surface.");
  }
}

/** Runs one owned local process. openSession never transfers the parent credential. */
async function runOwnerSheetsCopyRehearsal({packet: raw, outputDirectory, openSession, onPrepared}) {
  const packet = validatePacket(raw);
  const output = path.resolve(outputDirectory);
  fs.mkdirSync(output, {recursive: true, mode: 0o700});
  fs.chmodSync(output, 0o700);
  const lockPath = path.join(output, "copy-runner.lock");
  const started = Date.now();
  const nonce = crypto.randomBytes(32).toString("hex");
  const lock = {pid: process.pid, runnerStartedAtMillis: started,
    runnerInstanceId: `copy-runner:${packet.runId}`, lockNonceDigest: digest(nonce)};
  const lockDescriptor = fs.openSync(lockPath, "wx", 0o600);
  fs.writeFileSync(lockDescriptor, JSON.stringify(lock));
  const sourceDigest = runnerSourceDigest();
  let db, runtime;
  let submitted = 0, inFlight = 0, unknown = 0, requestDigest = null, preparedBinding = null;
  try {
    const session = await openSession({...lock, runnerSourceDigest: sourceDigest});
    if (!session?.accessToken || !Number.isSafeInteger(session.tokenExpiresAtMillis) ||
        typeof session.readProviderControls !== "function") fail("Explicit short-token session required.");
    const auth = createShortTokenAuth(session.accessToken, session.tokenExpiresAtMillis);
    const sheetsResource = google.sheets({version: "v4", auth}).spreadsheets;
    const drive = google.drive({version: "v3", auth});
    const sheets = {
      get: sheetsResource.get.bind(sheetsResource),
      async batchUpdate(params, options) {
        if (packet.mode !== "execute" || submitted || params.spreadsheetId !== packet.copyWorkbookId ||
            options?.retry !== false) fail("The one-copy single-batch budget is closed.");
        const actual = "shift-sheets:v1:sha256:" + crypto.createHash("sha256")
          .update(JSON.stringify({requests: params.requestBody.requests})).digest("hex");
        if (!preparedBinding?.ownerMaintenance || preparedBinding.requestDigest !== actual ||
            !ownsLock(lockPath, lockDescriptor, lock) ||
            runnerSourceDigest() !== sourceDigest) fail("Prepared receipt, lock and token must still match.");
        const now = Date.now();
        const binding = preparedBinding.ownerMaintenance;
        if (now >= session.tokenExpiresAtMillis || now >= binding.controlsValidUntilMillis ||
            now >= binding.claim.expiresAtMillis || now < binding.agreement.payload.intent.startsAtMillis ||
            now >= binding.agreement.payload.intent.endsAtMillis) fail("Known authority deadline expired before the SDK call.");
        submitted++; inFlight++; requestDigest = actual;
        try { return await sheetsResource.batchUpdate(params, options); }
        catch (error) { unknown++; throw error; }
        finally { inFlight--; }
      },
    };
    const title = `ENSAYO HU084 Mercado ${packet.runId}`;
    const config = createShiftSheetsConfig({environment: "develop", workbooks: {develop: packet.copyWorkbookId},
      aliases: [{type: "market", seasonStartYear: 2026, title}]});
    const metadata = (await sheets.get({spreadsheetId: packet.copyWorkbookId,
      fields: "spreadsheetId,sheets(properties)"}, {retry: false, timeout: 15000})).data;
    if (packet.mode === "inspect") {
      if (metadata.spreadsheetId !== packet.copyWorkbookId || ![7, 8].includes(metadata.sheets?.length) ||
          metadata.sheets.filter((item) => item.properties?.title === title).length > 1) fail("The bounded seven/eight-tab copy is required for inspection.");
      db = new Firestore({projectId: packet.demoProjectId, host: HOST, ssl: false});
      const commands = await db.collection(`${ROOT}/shiftPlanningSyncCommands`).where("type", "==", "market").limit(2).get();
      if (commands.size !== 1) fail("One retained market command required; inspection never seeds data.");
      const commandSnapshot = commands.docs[0];
      const receipt = (await commandSnapshot.ref.collection("externalSubmissions").doc("sheets").get()).data();
      if (receipt?.command?.workbookId !== packet.copyWorkbookId || receipt.ownerMaintenance?.copyAuthority?.runId !== packet.runId) {
        fail("The retained copy receipt does not match this run.");
      }
      const manifest = receipt.ownerMaintenance.preservationManifest;
      const added = manifest.policy.additions;
      if (added.length !== 1 || added[0].title !== title) fail("The retained new-tab plan changed.");
      const expectedIds = [...manifest.policy.existing, ...added.map((item) => item.sheetId)];
      if (metadata.sheets.some((item) => !expectedIds.includes(item.properties.sheetId))) fail("Inspection found an unreviewed tab.");
      const config = createShiftSheetsConfig({environment: "develop", workbooks: {develop: packet.copyWorkbookId}});
      const inspectionTitles = [...new Set([...metadata.sheets.map((item) => item.properties.title), title])];
      const observed = (await observeShiftSheetsWorkbook({config, titles: inspectionTitles,
        files: drive.files, permissions: drive.permissions, about: drive.about, sheets, nowMillis: Date.now,
        collector: "googleapis-raw", includePreservationCells: true, allowMissingReviewedTitles: [title]})).privateObservation;
      let matches = false;
      try { assertShiftSheetsOwnerPreservation({manifest: receipt.ownerMaintenance.preservationManifest, after: observed.snapshot}); matches = true; }
      catch { /* A mismatch remains an observation, never a retry or inverse. */ }
      writePrivate(path.join(output, "inspection.json"), {receipt, observed, physicalPostimageMatches: matches,
        canComplete: false, canResubmit: false, receiptUnmodified: true});
      return {kind: "inspected", physicalPostimageMatches: matches, canComplete: false, submitted: 0};
    }
    if (metadata.spreadsheetId !== packet.copyWorkbookId || metadata.sheets?.length !== 7 ||
        metadata.sheets.some((item) => item.properties?.title === title)) fail("Expected seven original copy tabs required.");
    const titles = [...metadata.sheets.map((item) => item.properties.title), title];
    const observation = await observeShiftSheetsWorkbook({config, titles, files: drive.files,
      permissions: drive.permissions, about: drive.about, sheets, nowMillis: Date.now,
      collector: "googleapis-raw", includePreservationCells: true, allowMissingReviewedTitles: [title]});
    const before = observation.privateObservation;
    const rawBefore = await readRawOriginalTabs({drive, sheets, workbookId: packet.copyWorkbookId, originals: metadata.sheets});
    const authority = parseShiftPlanningOwnerSheetsCopyAuthority({
      ...session.authority, runnerInstanceId: lock.runnerInstanceId, runnerStartedAtMillis: started,
      runnerSourceDigest: sourceDigest, lockNonceDigest: lock.lockNonceDigest,
      drivePermissionId: before.principal.permissionId,
    });
    if (authority.workbookId !== packet.copyWorkbookId || authority.demoProjectId !== packet.demoProjectId ||
        authority.runId !== packet.runId || digest(authority.protectedWorkbookIds) !== digest(packet.protectedWorkbookIds) ||
        digest(authority.tokenScopes) !== digest(SHIFT_PLANNING_COPY_TOKEN_SCOPES) ||
        before.principal.emailAddress !== authority.serviceAccountEmail) fail("Runtime identity does not match the reviewed copy.");
    db = new Firestore({projectId: packet.demoProjectId, host: HOST, ssl: false});
    const command = await seedSyntheticSource(db, packet.copyWorkbookId, before.workbookVersionBefore);
    const authorizationDocumentId = `${packet.runId}-approval`;
    const receiptReference = db.doc(`${ROOT}/shiftPlanningSyncCommands/${command.commandId}`)
      .collection("externalSubmissions").doc("sheets");
    const composition = (approvalDigest) => createShiftPlanningOwnerSheetsComposition({
      firestore: db, config, titles, authorizationDocumentId, commandId: command.commandId,
      expectedAuthorizationDigest: approvalDigest, technicalTransitionId: packet.runId,
      runtimePrincipalId: authority.drivePermissionId, clients: {drive, sheets},
      copyRehearsal: {copyWorkbookId: packet.copyWorkbookId, protectedWorkbookIds: packet.protectedWorkbookIds,
        runId: packet.runId, authority},
      async readCurrentCopyControls() {
        const provider = await session.readProviderControls();
        const actualLock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
        if (!ownsLock(lockPath, lockDescriptor, lock) || digest(actualLock) !== digest(lock) ||
            runnerSourceDigest() !== sourceDigest) fail("Runner source or lock changed.");
        const receipt = (await receiptReference.get()).data();
        return {...provider, schemaVersion: 1, kind: "isolated-copy-runtime", authorityDigest: digest(authority),
          tokenExpiresAtMillis: authority.tokenExpiresAtMillis, tokenScopes: authority.tokenScopes,
          runnerInstanceId: lock.runnerInstanceId, runnerSourceDigest: sourceDigest,
          runnerPid: process.pid, lockOwnerPid: actualLock.pid, lockRunnerStartedAtMillis: started,
          lockNonceDigest: lock.lockNonceDigest, submittedRequestCount: submitted,
          inFlightRequestCount: inFlight, unknownRequestCount: unknown,
          submittedRequestDigest: requestDigest, receiptBindingDigest: submitted ? receipt?.ownerMaintenance?.bindingDigest ?? null : null};
      },
    });
    runtime = composition(digest({approval: "preparation-only"}));
    const window = packet.ownerConfirmation ?? {startsAtMillis: Date.now(), endsAtMillis: Date.now() + 1200000};
    const prepared = await runtime.prepareCopyRehearsal({commandId: command.commandId, proposedWindow: {
      startsAtMillis: window.startsAtMillis, endsAtMillis: window.endsAtMillis,
      recoveryDeadlineMillis: window.endsAtMillis + 300000,
    }});
    if (rawBefore.version !== prepared.privateObservation.workbookVersionBefore) fail("Copy changed between the raw image and plan.");
    assertOneNewTabPlan(prepared.planned, title, metadata.sheets.map((item) => item.properties.sheetId));
    const reviewedPlan = {requestDigest: prepared.planned.batch.requestDigest,
      projectionDigest: prepared.planned.batch.projectionDigest,
      preservationManifestDigest: prepared.planned.preservationManifest.digest,
      originalTabsDigest: rawBefore.digest, beforeWorkbookRevision: rawBefore.version};
    if (packet.reviewedPlan && digest(packet.reviewedPlan) !== digest(reviewedPlan)) {
      fail("The exact read-only reviewed plan changed; no physical batch is admitted.");
    }
    writePrivate(path.join(output, "original-tabs-before.json"), rawBefore);
    writePrivate(path.join(output, "prepared.json"), prepared);
    writePrivate(path.join(output, "reviewed-plan.json"), reviewedPlan);
    await onPrepared?.({title, expectedRows: 10, requests: prepared.planned.batch.requests.length,
      preservationDigest: prepared.planned.preservationManifest.digest, canApply: false,
      originalTabsDigest: rawBefore.digest, workbookId: packet.copyWorkbookId,
      ownerEmail: before.file.owners[0].emailAddress, ownerPermissionId: before.file.owners[0].permissionId,
      runtimeEmail: before.principal.emailAddress, runtimePermissionId: before.principal.permissionId});
    if (packet.mode !== "execute") return {kind: "prepared", canApply: false, submitted: 0, title};
    validatePacket(packet);
    const planned = prepared.planned.batch;
    const workbook = prepared.privateObservation;
    const preservation = prepared.planned.preservationManifest;
    const batchIntent = {schemaVersion: 2, kind: "owner-sheets-batch", technicalControlKind: "isolated-copy-runtime",
      environment: "develop", workbookId: packet.copyWorkbookId, commandId: command.commandId,
      commandDigest: digest(command), operationId: command.idempotencyKey, writeEpoch: command.writeEpoch,
      activeRevision: command.expectedActiveRevision, activeDigest: command.expectedActiveDigest,
      beforeWorkbookRevision: workbook.workbookVersionBefore, beforeContentDigest: workbook.contentDigest,
      beforeAclDigest: workbook.authorityDigest, beforeProtectionsDigest: workbook.protectionsDigest,
      observerPrincipalId: authority.drivePermissionId, projectionDigest: planned.projectionDigest,
      requestDigest: planned.requestDigest, preservationDigest: preservation.preservationDigest,
      preservationManifestDigest: preservation.digest, technicalEvidenceDigest: digest(authority),
      maximumEvidenceAgeMillis: authority.maximumEvidenceAgeMillis};
    const participants = [{principalId: workbook.file.owners[0].permissionId, role: "owner"},
      {principalId: lock.runnerInstanceId, role: "operator"}];
    const intent = {agreementId: `${packet.runId}-owner`, environment: "develop", workbookFileId: packet.copyWorkbookId,
      ownerPrincipalId: participants[0].principalId, participants, participantsRevision: packet.runId,
      effectiveAuthorityDigest: workbook.authorityDigest, sourceRevision: workbook.workbookVersionBefore,
      sourceDigest: workbook.contentDigest, expectedWriteEpoch: command.writeEpoch,
      expectedActiveRevision: command.expectedActiveRevision, expectedActiveDigest: command.expectedActiveDigest,
      affectedScopeDigest: digest(batchIntent), operations: [{operationId: command.idempotencyKey,
        kind: "sheets-batch", manifestDigest: digest(batchIntent)}], startsAtMillis: window.startsAtMillis,
      endsAtMillis: window.endsAtMillis, recoveryDeadlineMillis: window.endsAtMillis + 300000, permissionControl: null};
    const agreement = createShiftPlanningOwnerSheetsCopyAgreement(intent, participants.map((participant) => ({
      ...participant, intentDigest: digest(intent), confirmationId: `${packet.ownerConfirmation.receiptId}-${participant.role}`,
      confirmedAtMillis: participant.role === "owner" ? packet.ownerConfirmation.confirmedAtMillis : Date.now(),
      onlineClosedNoOfflineEdits: true, noManualOrAutomationWrites: true,
    })));
    const authorization = {schemaVersion: 1, operationKind: "ownerSheetsAuthorization", environment: "develop",
      commandId: command.commandId, technicalTransitionId: packet.runId, agreement, batchIntent,
      preservationManifest: preservation, copyAuthority: authority, ownerReport: {
        agreementDigest: agreement.digest, agreementStatus: "confirmed", ownerActivity: "none-reported",
        unresolvedWriteCount: 0, participantsDigest: digest({revision: intent.participantsRevision, participants}),
        effectiveAuthorityDigest: intent.effectiveAuthorityDigest, permissionWorkflowClosed: true,
        permissionControlEvidenceDigest: null}};
    await db.doc(`${ROOT}/shiftPlanningOperations/${authorizationDocumentId}`).create(authorization);
    await runtime.dispose();
    runtime = undefined;
    runtime = composition(shiftPlanningOwnerSheetsAuthorizationDigest(authorization));
    // Observe the actual durable prepare, without inserting asynchronous work
    // between the adapter's last synchronous fence and the physical SDK call.
    const persistSubmission = runtime.repository.prepareSubmission.bind(runtime.repository);
    runtime.repository.prepareSubmission = async (request) => {
      await persistSubmission(request);
      preparedBinding = structuredClone(request.binding);
    };
    let rawAfter = null;
    const authorizeCompletion = runtime.consumer.authorizeCompletion.bind(runtime.consumer);
    runtime.consumer.authorizeCompletion = async (processing, evidence) => {
      try {
        rawAfter = await readRawOriginalTabs({drive, sheets, workbookId: packet.copyWorkbookId, originals: metadata.sheets});
        writePrivate(path.join(output, "original-tabs-after.json"), rawAfter);
        if (rawBefore.digest !== rawAfter.digest) fail("Observed original tabs changed before completion.");
        // The production guard obtains its fresh controls AFTER the additional
        // raw audit, so its final authorization/CAS does not use an old proof.
        return await authorizeCompletion(processing, evidence);
      } catch (error) {
        await runtime.consumer.completionFailed(processing, error);
        throw error;
      }
    };
    const result = await runtime.execute({commandId: command.commandId,
      workerId: packet.runId, attemptId: `${packet.runId}-attempt`});
    const receipt = (await receiptReference.get()).data();
    writePrivate(path.join(output, "terminal.json"), {result, receipt, originalTabsAfter: rawAfter, submitted, inFlight, unknown});
    if (result.kind !== "completed" || !rawAfter || submitted !== 1 || inFlight || unknown) fail("No known one-batch terminal result.");
    return {kind: "completed", submitted, preservedOriginalTabs: 7, expectedRows: 10, title};
  } catch (error) {
    writePrivate(path.join(output, "runner-failure.json"), {at: Date.now(), submitted, inFlight, unknown,
      code: typeof error.code === "string" ? error.code : null,
      message: String(error.message).slice(0, 500).replace(/Bearer\s+\S+|ya29\.[A-Za-z0-9._-]+/g, "[redacted]"),
      httpStatus: Number.isInteger(error.response?.status) ? error.response.status : null,
      incidentRequiresInspection: submitted > 0});
    throw error;
  } finally {
    const closing = await Promise.allSettled([runtime?.dispose(), db?.terminate()]);
    writePrivate(path.join(output, "local-cleanup.json"), {clientsClosed: closing.every((item) => item.status === "fulfilled"),
      submitted, inFlight, unknown, iamAndCopyAccessCleanupOwnedByParent: true});
    if (ownsLock(lockPath, lockDescriptor, lock)) fs.unlinkSync(lockPath);
    fs.closeSync(lockDescriptor);
  }
}

module.exports = {runOwnerSheetsCopyRehearsal, validatePacket, assertOneNewTabPlan, runnerSourceDigest, ownsLock,
  createShortTokenAuth, readRawOriginalTabs};

if (require.main === module) {
  if (!process.send || process.argv.length !== 4) fail("Use the reviewed one-session parent; no standalone credentials are loaded.");
  let sequence = 0;
  const pending = new Map();
  process.on("message", (message) => {
    if (message?.type !== "reply") return;
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    clearTimeout(entry.timer);
    if (message.error) entry.reject(new Error("Parent control read failed."));
    else entry.resolve(message.value);
  });
  function request(type, data) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error("Parent control read timed out.")); }, 30000);
      pending.set(id, {resolve, reject, timer});
      process.send({type, id, data});
    });
  }
  const packet = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  runOwnerSheetsCopyRehearsal({packet, outputDirectory: process.argv[3],
    async openSession(context) {
      const session = await request("open-copy-session", context);
      return {...session, readProviderControls: () => request("read-copy-identity")};
    },
    onPrepared: (summary) => packet.requireParentPlanReview ? request("review-copy-plan", summary) :
      process.send({type: "prepared", data: summary}),
  }).then((result) => { process.send({type: "result", data: result}); process.disconnect(); })
    .catch(() => { process.send({type: "failed"}); process.exitCode = 1; process.disconnect(); });
}
