"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {randomUUID} = require("node:crypto");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {createOriginalDevelopTimeBudget, ORIGINAL_DEVELOP_MODE} = require("./develop-copy-time-budget.cjs");
const {FILE, OWNER, WRITER, PERMISSION, metadataFingerprint} = require("./develop-original-writer-provider.cjs");
const {createOriginalWindowOwner} = require("./develop-original-window-provider.cjs");
const {createIamProvider} = require("./develop-writer-copy-provider.cjs");
const {createIsolationReader} = require("./develop-helper-copy-provider.cjs");
const {createNativeOwnerChannel} = require("./develop-native-owner-channel.cjs");
const {IDENTITY, createSheetsContinuationAccess} = require("./develop-sheets-continuation-access.cjs");
const {runDevelopSheetsContinuation, verifyFirestore, inspectOwner} = require("./develop-sheets-continuation.cjs");
const {createDevelopSheetsContinuationFirestoreReader} = require("./develop-sheets-continuation-firestore.cjs");

const OPERATION = "request-hu084-initial-73d77a7da377753f11f9";
const BATCH = "shift-sheets:v1:sha256:a8b55e319b315566b8916015638b8d3eac9454a9bcda4c7d99f513fdc76b72ab";
const REQUEST = Object.freeze({kind: "single-retained-sheets-projection", operationId: OPERATION, requestDigest: BATCH,
  environment: "develop", workbookId: FILE, maximumSheetsBatches: 1, firestoreWrites: 0,
  temporaryFileAndIamAccess: true, acceptsHistoricalRisk: true});
const MAX_WINDOW = 1200000;

function verifyApproval(approval, packetSha256) {
  assert.match(packetSha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(approval.scope, REQUEST);
  assert.equal(approval.packetSha256, packetSha256);
  assert.equal(approval.authorized, true);
  assert.match(approval.confirmationId, /^[\w-]{6,160}$/);
  assert.ok(Number.isSafeInteger(approval.confirmedAtMillis) && approval.confirmedAtMillis <= Date.now());
}

function assertWindow(window, consent, approval) {
  assert.equal(consent.stableWorkbookAndAdministration, true);
  assert.match(consent.confirmationId, /^[\w-]{6,160}$/);
  assert.equal(consent.operationId, OPERATION);
  assert.equal(consent.packetSha256, approval.packetSha256);
  assert.equal(consent.startsAtMillis, window.startsAtMillis);
  assert.ok(window.startsAtMillis >= approval.confirmedAtMillis && Date.now() >= window.startsAtMillis);
  assert.equal(window.endsAtMillis - window.startsAtMillis, MAX_WINDOW);
  assert.ok(Date.now() < window.endsAtMillis, "continuation_window_expired");
}

function accessJournal(root) {
  // Independent, private stream per invocation. Only the durable claim in the
  // core can admit a writer, even across two authorizations or two processes.
  const directory = fs.mkdtempSync(path.join(root, "access-"));
  const log = path.join(directory, "events.jsonl");
  const descriptor = fs.openSync(log, "wx", 0o600);
  for (const dir of [directory, root]) {
    const fd = fs.openSync(dir, "r");
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  }
  return {directory, record(event) {
    fs.writeFileSync(descriptor, JSON.stringify({atMillis: Date.now(), ...event}) + "\n");
    fs.fsyncSync(descriptor);
  }, close() { fs.closeSync(descriptor); }};
}

async function runAuthorizedProjection({packet, packetSha256, approval, consent, journalRoot, ownerBearer, ownerExpiry,
  iamBearer, tab, signal, onOwnerHandoff}) {
  verifyApproval(approval, packetSha256);
  const startsAtMillis = consent.startsAtMillis;
  const window = {startsAtMillis, endsAtMillis: startsAtMillis + MAX_WINDOW,
    dispatchDeadlineMillis: startsAtMillis + MAX_WINDOW - 345000};
  assertWindow(window, consent, approval);
  assert.equal(packet.binding.operationId, OPERATION);
  assert.equal(packet.binding.requestDigest, BATCH);
  assert.ok(typeof ownerBearer === "string" && ownerBearer && ownerExpiry >= window.endsAtMillis);
  assert.ok(typeof iamBearer === "string" && iamBearer);
  assert.equal(typeof tab?.getAXState, "function");
  const budget = createOriginalDevelopTimeBudget({...window, reviewedMode: ORIGINAL_DEVELOP_MODE});
  const owner = createOriginalWindowOwner({ownerBearer, fetchImpl: budget.fetch, nowMillis: Date.now});
  const iam = createIamProvider({identity: IDENTITY, iamBearer, fetchImpl: budget.fetch});
  const isolated = createIsolationReader({iamBearer, fetchImpl: budget.fetch});
  const log = accessJournal(journalRoot);
  let inCleanup = false;
  function quiet() {
    assertWindow(window, consent, approval);
    assert.ok(!signal?.aborted, "continuation_interrupted");
  }
  const review = {kind: "native-drive-owner-sharing", owner: OWNER, operationId: OPERATION, packetSha256,
    permission: {fileId: FILE, permissionId: PERMISSION, type: "user", role: "writer", emailAddress: WRITER}};
  const reviewDigest = digest(review);
  const channel = createNativeOwnerChannel({tab, review, reviewDigest, readMetadata: owner.read, record(event) {
    // A logging failure before removal must not strand the writer's file ACL.
    if (!inCleanup) return log.record(event);
    try { log.record(event); } catch { auditFailure = true; }
  }, authorizeAction: async action => {
    assert.deepEqual(action.permission, review.permission);
    assert.equal(action.reviewDigest, reviewDigest);
    assert.equal(action.kind, inCleanup ? "remove" : "grant");
    budget.assertStage();
    if (!inCleanup) quiet();
  }});
  let auditFailure = false;
  const access = createSheetsContinuationAccess({window, requests: packet.plan.requests, owner, iam, isolated, channel,
    budget, record: log.record, assertQuiet: quiet});
  let result, cleanup;
  try {
    onOwnerHandoff();
    log.record({phase: "start", runId: randomUUID(), processId: process.pid, packetSha256, approval, consent, window});
    const bindingAuthority = packet.binding.authorityDigest;
    const reader = createDevelopSheetsContinuationFirestoreReader({...packet.firestore, authorizedFetch(url, init) {
      const documents = "https://firestore.googleapis.com/v1/projects/reguerta-9f27f/databases/(default)/documents";
      const location = new URL(url);
      const list = ["shiftPlanningOperations", "shiftPlanningMigrationBaselines", "shifts"]
        .some(name => location.origin + location.pathname === documents + "/develop/plus-collections/" + name);
      assert.ok((init.method === "GET" && list) || (init.method === "POST" && url === documents + ":batchGet"));
      quiet();
      return budget.fetch(url, {...init, headers: {...init.headers, Authorization: "Bearer " + iamBearer}});
    }});
    result = await runDevelopSheetsContinuation({binding: {...packet.binding, window}, plan: packet.plan,
      originalSnapshot: packet.originalSnapshot, journalRoot, readOwner: access.capture,
      async readFirestore() {
        const proof = await reader();
        log.record({phase: "firestore-read", proof});
        return proof;
      }, async assertControls({phase, observation, state}) {
        quiet();
        budget.assertStage();
        log.record({phase: "owner-" + phase, state, version: observation.after.file.version,
          snapshotDigest: observation.snapshotDigest, metadataDigest: observation.metadataDigest});
        assert.equal(metadataFingerprint(observation.after, {omitVersion: true, omitWriter: true}),
          bindingAuthority, "reviewed_authority_changed");
        if (phase === "initial") return access.verifyIdle();
        if (phase === "prepare-writer") return access.acquire();
        if (phase === "before-dispatch") {
          await access.issue();
          budget.assertSubmission();
        }
      }, submitBatch: ({requests, assertSubmissionNow}) => access.submit(requests, assertSubmissionNow)});
    log.record({phase: "projection-result", result});
    // On a lost response, keep the first failure and only inspect while the
    // reserved readback time remains. Nothing in this branch can submit.
    if (result.kind === "inspection-required" && result.dispatchBoundaryReached &&
        Date.now() + 45000 < budget.currentStageDeadlineMillis()) {
      let observation = {state: "unverified"};
      try {
        const binding = {...packet.binding, window};
        const proof = await reader();
        verifyFirestore(binding, proof);
        const image = await access.capture();
        const state = inspectOwner(binding, packet.plan, image, Date.now());
        observation = {state, snapshotDigest: image.snapshotDigest, firestoreReadTime: proof.readTime};
      } catch { /* Containment still owns its full reserved interval. */ }
      result = {...result, observation};
      log.record({phase: "inspection-after-dispatch", observation});
    }
  } catch {
    result ??= {kind: "inspection-required", firstFailure: {step: "operator-preparation"}};
    auditFailure = true;
  } finally {
    inCleanup = true;
    try { cleanup = await access.close(); } catch { cleanup = {verified: false, failures: ["access-closure"]}; }
    try { log.record({phase: "terminal", result, cleanup}); } catch { auditFailure = true; }
    log.close();
  }
  return {kind: cleanup.verified && !auditFailure ? result.kind : "inspection-required", result,
    cleanup, auditFailure, journal: log.directory, canRetry: false};
}

module.exports = {REQUEST, verifyApproval, runAuthorizedProjection};
