"use strict";

// Complete the original Develop projection after its verified Firestore commit.
// The caller owns the fresh agreement, credentials, exclusive controls and
// their cleanup. This module receives no Firestore mutation capability.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {createShiftSheetsOwnerPreservationManifest, assertShiftSheetsOwnerPreservation} =
  require("../lib/shift-sheets-owner-manifest.js");
const {FILE, TABS} = require("./develop-original-writer-provider.cjs");

const planningDigest = /^shift-planning:v1:sha256:[a-f0-9]{64}$/;
const sheetDigest = /^shift-sheets:v1:sha256:[a-f0-9]{64}$/;
const DELIVERY_SHEETS = [TABS[0].id, TABS[2].id];
const MARKER = "reguerta.shiftSheets.v1";

function verifyPlan(binding, plan, original) {
  assert.equal(binding.workbookId, FILE);
  assert.match(binding.operationId, /^request-hu084-initial-[a-f0-9]{20}$/);
  for (const key of ["planDigest", "receiptDigest", "afterimageProof", "checkpointDigest"]) {
    assert.match(binding[key], planningDigest);
  }
  assert.match(binding.projectionDigest, sheetDigest);
  assert.match(binding.requestDigest, sheetDigest);
  assert.equal(plan.kind, "develop-helper-batch-plan");
  assert.equal(plan.direction, "forward");
  assert.equal(plan.operation.operationId, binding.operationId);
  const {planDigest, ...body} = plan;
  assert.equal(planDigest, binding.planDigest);
  assert.equal(digest(body), binding.planDigest);
  assert.equal(plan.requestDigest, binding.requestDigest);
  assert.equal(plan.observationDigest, digest(original));
  assert.equal(original.spreadsheetId, FILE);
  assert.deepEqual(original.sheets.map(sheet => sheet.properties.sheetId), TABS.map(tab => tab.id));
  assert.ok(original.sheets.every(sheet => sheet.dataCoverage === "complete"));
  const requests = plan.requests;
  assert.equal(requests.length, 55);
  const manifest = createShiftSheetsOwnerPreservationManifest({before: original, requests});
  assert.deepEqual(manifest, plan.preservation);
  assert.equal(manifest.requestDigest, binding.requestDigest);
  const {writes, creates} = manifest.policy;
  assert.equal(writes.length, 53);
  assert.equal(new Set(writes.map(({sheetId, row, column}) => [sheetId, row, column].join("/"))).size, 53);
  assert.deepEqual([...new Set(writes.map(write => write.sheetId))].sort(), [...DELIVERY_SHEETS].sort());
  assert.deepEqual(creates.map(mark => mark.location.sheetId).sort(), [...DELIVERY_SHEETS].sort());
  assert.equal(requests.filter(request => request.updateCells).length, 53);
  assert.equal(requests.filter(request => request.createDeveloperMetadata).length, 2);
  for (const sheet of original.sheets) {
    if (DELIVERY_SHEETS.includes(sheet.properties.sheetId)) {
      assert.ok(!sheet.developerMetadata.some(item => item.metadataKey === MARKER));
    }
  }
  for (const mark of creates) {
    assert.equal(mark.metadataKey, MARKER);
    assert.equal(mark.visibility, "DOCUMENT");
    assert.deepEqual(JSON.parse(mark.metadataValue), {
      operationId: binding.operationId, projectionDigest: binding.projectionDigest,
    });
  }
}

function verifyFirestore(binding, proof) {
  for (const key of ["operationId", "receiptDigest", "afterimageProof", "checkpointDigest"]) {
    assert.equal(proof[key], binding[key], "continuation_fireproof_mismatch");
  }
  for (const [key, value] of Object.entries({verifiedImages: 203, verifiedCreates: 141, verifiedDeletes: 62,
    operationPresent: true, baselinePresent: true, barrierPresent: true, failurePresent: false})) {
    assert.equal(proof[key], value, "continuation_fireproof_mismatch");
  }
}

function inspectOwner(binding, plan, observation, at) {
  assert.equal(observation.fileId, binding.workbookId);
  assert.match(observation.after.file.version, /^[1-9]\d*$/);
  assert.ok(Number.isSafeInteger(observation.startedAtMillis) && Number.isSafeInteger(observation.observedAtMillis));
  assert.ok(observation.startedAtMillis >= binding.window.startsAtMillis &&
    observation.startedAtMillis <= observation.observedAtMillis && observation.observedAtMillis <= at);
  assert.equal(observation.snapshotDigest, digest(observation.snapshot));
  if (observation.snapshotDigest === plan.observationDigest) return "original";
  // The owner manifest verifies each written value, both metadata values and
  // their locations, and every protected field outside that authorized change.
  assertShiftSheetsOwnerPreservation({manifest: plan.preservation, after: observation.snapshot});
  return "projected";
}

// Only fixed classifications cross from exceptions to the evidence directory.
// A Google error message or arbitrary HTTP response may contain workbook data.
function classifyFailure(error) {
  try {
    const own = key => Object.getOwnPropertyDescriptor(error, key)?.value;
    const message = own("message"), code = own("code"), name = own("name");
    const messages = {
      copy_batch_readback_budget_exhausted: "writer-readback-reserve-exhausted",
      copy_stage_deadline_exhausted: "provider-stage-expired",
      copy_http_deadline_exhausted: "provider-request-expired",
      original_owner_read_unavailable: "owner-read-unavailable",
      original_writer_response_uncertain: "writer-response-uncertain",
      continuation_window_expired: "continuation-window-expired",
      continuation_dispatch_expired: "continuation-dispatch-expired",
      continuation_before_image: "workbook-is-not-original",
      continuation_fireproof_mismatch: "retained-firestore-proof-mismatch",
    };
    if (typeof message === "string" && Object.hasOwn(messages, message)) return messages[message];
    if (code === "EEXIST") return "operation-already-claimed";
    if (code === "ETIMEDOUT" || name === "TimeoutError") return "provider-timeout";
    if (code === "ABORT_ERR" || name === "AbortError") return "provider-interrupted";
    // Original writer uses assert.equal(response.status, 200).
    const status = own("status") ?? own("statusCode") ??
      (code === "ERR_ASSERTION" && own("expected") === 200 ? own("actual") : null);
    if ([400, 401, 403, 404, 408, 409, 412, 429, 500, 502, 503, 504].includes(status)) return "http-" + status;
    if (code === "ERR_ASSERTION") return "precondition-mismatch";
  } catch { /* Opaque exceptions still yield a safe stage and timestamp. */ }
  return "unclassified";
}

function syncDirectory(directory) {
  const fd = fs.openSync(directory, "r");
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

// Even a truncated exclusive record consumes its name. A restart may inspect
// that operation, but may never repair the artifact by submitting again.
function publishOnce(directory, name, value) {
  const target = path.join(directory, name);
  const fd = fs.openSync(target, "wx", 0o600);
  try {
    fs.writeFileSync(fd, JSON.stringify(value) + "\n");
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
  syncDirectory(directory);
}

function openJournal(root, operationId) {
  assert.ok(path.isAbsolute(root));
  assert.equal(fs.realpathSync(root), root);
  assert.ok(fs.lstatSync(root).isDirectory());
  const directory = path.join(root, operationId);
  try { fs.mkdirSync(directory, {mode: 0o700}); } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  assert.ok(fs.lstatSync(directory).isDirectory());
  syncDirectory(root);
  return directory;
}

function hasRecord(directory, name) {
  try { fs.lstatSync(path.join(directory, name)); return true; } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return false;
  }
}

async function runDevelopSheetsContinuation({
  binding: reviewedBinding, plan: reviewedPlan, originalSnapshot, journalRoot,
  readFirestore, readOwner, assertControls, submitBatch, nowMillis = Date.now,
}) {
  let step = "review-plan", directory = null;
  let claimed = false, intentRetained = false, dispatched = false;
  let binding;
  try {
    binding = structuredClone(reviewedBinding);
    const plan = structuredClone(reviewedPlan);
    verifyPlan(binding, plan, structuredClone(originalSnapshot));
    const window = binding.window;
    for (const at of [window.startsAtMillis, window.dispatchDeadlineMillis, window.endsAtMillis]) {
      assert.ok(Number.isSafeInteger(at));
    }
    // The independent controls port also checks credential expiry and its
    // reserved access-cleanup budget. These 75s cover the batch and readback.
    assert.ok(window.startsAtMillis < window.dispatchDeadlineMillis &&
      window.dispatchDeadlineMillis + 75000 <= window.endsAtMillis);
    for (const port of [readFirestore, readOwner, assertControls, submitBatch, nowMillis]) {
      assert.equal(typeof port, "function");
    }
    const within = deadline => {
      const at = nowMillis();
      assert.ok(Number.isSafeInteger(at) && at >= window.startsAtMillis && at < deadline,
        deadline === window.dispatchDeadlineMillis ? "continuation_dispatch_expired" : "continuation_window_expired");
      return at;
    };
    const readState = async (phase, expectedOriginalVersion) => {
      within(window.endsAtMillis);
      step = "firestore-" + phase;
      verifyFirestore(binding, await readFirestore());
      step = "owner-" + phase;
      const observation = structuredClone(await readOwner());
      const state = inspectOwner(binding, plan, observation, within(window.endsAtMillis));
      if (expectedOriginalVersion !== undefined) {
        step = "before-image";
        assert.equal(state, "original", "continuation_before_image");
        assert.equal(observation.after.file.version, expectedOriginalVersion);
      }
      step = "controls-" + phase;
      await assertControls({phase, state, observation: structuredClone(observation), binding: structuredClone(binding)});
      within(window.endsAtMillis);
      return {state, observation};
    };

    step = "local-journal";
    directory = openJournal(journalRoot, binding.operationId);
    const initial = await readState("initial");
    const result = kind => ({kind, operationId: binding.operationId, requestDigest: binding.requestDigest,
      intentRetained, dispatchBoundaryReached: dispatched, canRetry: false, canEnterMaintenance: false});
    const markVerified = () => {
      const record = {operationId: binding.operationId, requestDigest: binding.requestDigest,
        projectionDigest: binding.projectionDigest, receiptDigest: binding.receiptDigest};
      try { publishOnce(directory, "verified.json", record); } catch (error) {
        if (error.code !== "EEXIST") throw error;
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, "verified.json"), "utf8")), record);
      }
    };
    step = "prior-submission";
    intentRetained = hasRecord(directory, "dispatch-intent.json");
    if (initial.state === "projected") {
      markVerified();
      return result("already-projected");
    }
    assert.ok(!intentRetained && !hasRecord(directory, "verified.json"));
    step = "submission-budget";
    const claimedAt = within(window.dispatchDeadlineMillis);
    step = "claim-writer";
    publishOnce(directory, "writer-claim.json", {operationId: binding.operationId,
      requestDigest: binding.requestDigest, atMillis: claimedAt});
    claimed = true;
    // The caller may grant only here. Its return binds the revision actually
    // verified after its own ACL transition. Without a transition, the initial
    // revision is required again before the submission.
    step = "prepare-writer";
    const transition = await assertControls({phase: "prepare-writer", state: initial.state,
      observation: structuredClone(initial.observation), binding: structuredClone(binding)});
    const writerVersion = transition?.writerVersion ?? initial.observation.after.file.version;
    assert.match(writerVersion, /^[1-9]\d*$/);
    within(window.dispatchDeadlineMillis);
    await readState("before-dispatch", writerVersion);
    step = "submission-budget";
    const intentAt = within(window.dispatchDeadlineMillis);
    step = "persist-intent";
    publishOnce(directory, "dispatch-intent.json", {operationId: binding.operationId,
      requestDigest: binding.requestDigest, projectionDigest: binding.projectionDigest,
      planDigest: binding.planDigest, observedVersion: writerVersion, atMillis: intentAt});
    intentRetained = true;
    let active = true;
    step = "sheets-submit";
    try {
      await submitBatch({workbookId: binding.workbookId, operationId: binding.operationId,
        requestDigest: binding.requestDigest, projectionDigest: binding.projectionDigest,
        requests: structuredClone(plan.requests), assertSubmissionNow() {
          assert.ok(active && !dispatched);
          within(window.dispatchDeadlineMillis);
          dispatched = true;
        }});
      assert.ok(dispatched);
    } finally { active = false; }
    const after = await readState("final-readback");
    step = "final-image";
    assert.equal(after.state, "projected");
    step = "verification-receipt";
    markVerified();
    return result("projection-verified");
  } catch (error) {
    const failure = {step, reason: classifyFailure(error), atMillis: null};
    try {
      const at = nowMillis();
      if (Number.isSafeInteger(at)) failure.atMillis = at;
    } catch { /* A clock fault must not hide the first failed stage. */ }
    let firstFailure = failure, failureDurable = false;
    if (directory) {
      try {
        intentRetained = hasRecord(directory, "dispatch-intent.json");
        if (!hasRecord(directory, "first-failure.json") &&
            (claimed || !hasRecord(directory, "writer-claim.json"))) {
          try { publishOnce(directory, "first-failure.json", failure); } catch (error) {
            if (error.code !== "EEXIST") throw error;
          }
        }
        const saved = JSON.parse(fs.readFileSync(path.join(directory, "first-failure.json"), "utf8"));
        assert.match(saved.step, /^[a-z-]{1,40}$/);
        assert.ok(saved.atMillis === null || Number.isSafeInteger(saved.atMillis));
        assert.match(saved.reason, /^[a-z0-9-]{1,45}$/);
        firstFailure = {step: saved.step, reason: saved.reason, atMillis: saved.atMillis};
        failureDurable = true;
      } catch { /* Keep the classified local result on journal failure. */ }
    }
    return {kind: "inspection-required", firstFailure, failureDurable, intentRetained,
      dispatchBoundaryReached: dispatched, canRetry: false, canEnterMaintenance: false};
  }
}

module.exports = {runDevelopSheetsContinuation, verifyPlan, verifyFirestore, inspectOwner};
