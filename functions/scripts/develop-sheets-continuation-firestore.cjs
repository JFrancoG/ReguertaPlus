"use strict";

const assert = require("node:assert/strict");
const {createHash} = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {encodeShiftPlanningFirestoreValue: encode} = require("../lib/shift-planning-publication-contract.js");
const {createFirestoreShiftPlanningIntakeBarrierRepository} = require("../lib/shift-planning-firestore-intake-barrier-repository.js");
const {decodeRESTValue} = require("./develop-shift-migration-engine.cjs");
const {readWindowJournal} = require("./develop-window-journal.cjs");

const PROJECT = "reguerta-9f27f";
const ROOT = "develop/plus-collections";
const DOCUMENTS = "projects/" + PROJECT + "/databases/(default)/documents";
const REST = "https://firestore.googleapis.com/v1/" + DOCUMENTS;
const OPERATION = "request-hu084-initial-73d77a7da377753f11f9";
const JOURNAL = "develop-original-20261120-interactive-15";
const HEAD = "shift-planning:v1:sha256:b60daeedcba3e81368b237909858c263aeab0b0108cef8c27ad46c11f53b5a94";
const POSTFLIGHT_HASH = "20d45423ba340fce4a433bdd0eb6b2bb625278a92d0797e899bd67205b4c2877";
const OPERATIONS = ROOT + "/shiftPlanningOperations/";
const EVIDENCE = OPERATIONS + "barrier-evidence-" + OPERATION;
const FAILURE = OPERATIONS + "barrier-failure-" + OPERATION;
// Earlier records observed by attempt 15's admission and predecessor inspection.
const priorBarriers = [
  "barrier-evidence-request-hu084-initial-72981c0ff1b7b0f64b72",
  "barrier-evidence-request-hu084-initial-49191fee5a5fbd866533",
  "barrier-evidence-request-hu084-initial-0eb52a3163ebea83f3b4",
  "barrier-failure-request-hu084-initial-0eb52a3163ebea83f3b4",
];
const controlCollections = new Set(["shiftPlanningOperations", "shiftPlanningMigrationBaselines", "shifts"]);

const stamped = value => encode(decodeRESTValue({timestampValue: value}), "continuation service time", new Set());
const data = row => Object.fromEntries(Object.entries(row.fields ?? {}).map(([key, value]) => [key, decodeRESTValue(value)]));
const payload = row => encode(data(row), "continuation document", new Set());

function historicalInput(prepared, directory, postflightPath) {
  assert.equal(path.basename(directory), JOURNAL);
  const journal = readWindowJournal(directory);
  assert.equal(journal.headDigest, HEAD, "The original operation journal changed.");
  assert.equal(journal.pendingFiles.length, 0);
  assert.equal(fs.existsSync(path.join(path.dirname(directory), "controlled-window-active")), false);
  assert.equal(fs.existsSync(path.join(directory, "recovery.lock")), false);
  const raw = fs.readFileSync(postflightPath);
  assert.equal(createHash("sha256").update(raw).digest("hex"), POSTFLIGHT_HASH);
  const report = JSON.parse(raw), board = report.journal, proof = report.checks.firestore;
  const {preparedDigest, ...parameters} = prepared;
  assert.equal(digest(parameters), preparedDigest);
  assert.equal(preparedDigest, journal.binding.preparedDigest);
  assert.equal(preparedDigest, report.preparedDigest);
  assert.equal(prepared.reviewPackageDigest, report.packageDigest);
  assert.equal(report.operationId, OPERATION);
  assert.equal(prepared.operationId, OPERATION);
  assert.equal(prepared.projectId, PROJECT);
  assert.equal(prepared.environment, "develop");
  assert.equal(board.headDigest, HEAD);
  assert.equal(board.terminalSettled, true);
  assert.equal(board.dispatchRecorded, false);
  assert.deepEqual(report.errors, []);
  const records = journal.records.map(record => record.value);
  const one = phase => {
    const events = records.filter(event => event.phase === phase);
    assert.equal(events.length, 1, "Expected one original " + phase);
    return events[0];
  };
  const result = records.at(-1);
  assert.equal(result.phase, "window-terminal");
  assert.equal(result.kind, "inspection-required");
  assert.equal(result.result.phase, "sheets");
  assert.equal(result.providerCallsSettled, true);
  const checkpoint = one("acquired").acquired.checkpoint;
  const callback = one("firestore-receipt").receipt;
  const inspection = one("inspection").results;
  const retained = inspection.firestore.receipt;
  assert.equal(inspection.firestore.kind, "committed-and-readback-verified");
  assert.equal(inspection.barrier.failure, null);
  for (const [receipt, replayed] of [[callback, false], [retained, true]]) {
    const {receiptDigest, ...body} = receipt;
    assert.equal(receiptDigest, digest(body));
    assert.equal(receipt.direction, "forward");
    assert.equal(receipt.replayed, replayed);
    assert.equal(receipt.preparedDigest, preparedDigest);
  }
  assert.deepEqual(callback.documents, retained.documents);
  assert.equal(callback.measurement.documentWriteCount, 203);
  assert.equal(retained.receiptDigest, proof.verifiedReceiptDigest);
  assert.equal(digest(checkpoint), proof.barrierCheckpointDigest);
  assert.equal(checkpoint.scope.transitionId, OPERATION);
  assert.equal(checkpoint.evidence.digest, checkpoint.evidenceDigest);
  assert.deepEqual(checkpoint, inspection.barrier.checkpoint);
  const images = callback.documents, paths = images.map(row => row.path);
  assert.equal(images.length, 203);
  assert.equal(new Set(paths).size, 203);
  assert.equal(images.filter(row => row.exists).length, 141);
  assert.deepEqual(images.filter(row => !row.exists).map(row => row.path).sort(), prepared.legacy.map(row => row.path).sort());
  assert.ok(paths.every(p => p.startsWith(ROOT + "/") && /^[a-zA-Z0-9_./:-]+$/.test(p) && !p.includes("..")));
  assert.ok(paths.includes(OPERATIONS + OPERATION));
  assert.ok(paths.includes(ROOT + "/shiftPlanningMigrationBaselines/" + prepared.baselineRevision));
  return {images, checkpoint, proof, callbackReceiptDigest: callback.receiptDigest, serviceVersions: report.checks.targets.serviceVersionsDigest};
}

// Firestore returns server-assigned readTime even for a single witness. All later
// document and collection reads use that same instant; no request can commit.
function createSnapshotTransport(authorizedFetch) {
  assert.equal(typeof authorizedFetch, "function");
  async function getJson(url, init) {
    const response = await authorizedFetch(url, {...init, redirect: "error", cache: "no-store"});
    assert.equal(response.status, 200, "Firestore read unavailable.");
    return response.json();
  }
  async function batch(paths, readTime) {
    const names = paths.map(p => DOCUMENTS + "/" + p);
    const body = {documents: names};
    if (readTime !== undefined) body.readTime = readTime;
    const rows = await getJson(REST + ":batchGet", {
      method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body),
    });
    assert.ok(Array.isArray(rows));
    assert.equal(rows.length, paths.length, "Incomplete Firestore snapshot.");
    const wanted = new Set(names), found = new Map();
    for (const row of rows) {
      assert.notEqual(!!row.found, !!row.missing);
      const name = row.found ? row.found.name : row.missing;
      assert.ok(wanted.delete(name), "Unexpected or repeated response.");
      stamped(row.readTime);
      if (readTime !== undefined) assert.deepEqual(stamped(row.readTime), stamped(readTime));
      found.set(name.slice(DOCUMENTS.length + 1), {document: row.found ?? null, readTime: row.readTime});
    }
    return found;
  }
  async function collection(name, readTime) {
    assert.ok(controlCollections.has(name));
    const prefix = DOCUMENTS + "/" + ROOT + "/" + name + "/";
    const documents = new Map(), tokens = new Set();
    let token;
    do {
      const query = new URLSearchParams({readTime, pageSize: "100", fields: "documents(name,updateTime),nextPageToken"});
      if (token) query.set("pageToken", token);
      const result = await getJson(REST + "/" + ROOT + "/" + name + "?" + query, {method: "GET"});
      assert.ok(result && typeof result === "object" && !Array.isArray(result));
      const rows = result.documents ?? [];
      assert.ok(Array.isArray(rows));
      for (const row of rows) {
        assert.ok(typeof row.name === "string" && row.name.startsWith(prefix));
        const id = row.name.slice(prefix.length);
        assert.ok(id.length > 0 && !id.includes("/") && !documents.has(id));
        documents.set(id, stamped(row.updateTime));
      }
      token = result.nextPageToken;
      if (token) {
        assert.equal(typeof token, "string");
        assert.ok(!tokens.has(token), "Repeated Firestore page token.");
        tokens.add(token);
      }
    } while (token);
    return documents;
  }
  return {batch, collection};
}

function validateInventory(operations, baselines, shifts, prepared, commitTime) {
  const baseline = prepared.baselineRevision;
  assert.deepEqual([...baselines.keys()], [baseline], "A competing migration baseline exists.");
  assert.deepEqual(baselines.get(baseline), commitTime);
  const ids = prepared.content.shifts.map(row => row.id).sort();
  assert.equal(ids.length, 72);
  assert.deepEqual([...shifts.keys()].sort(), ids, "The set of canonical shifts changed.");
  for (const time of shifts.values()) assert.deepEqual(time, commitTime);
  const barrierId = "barrier-evidence-" + OPERATION;
  assert.deepEqual([...operations.keys()].sort(), [OPERATION, barrierId, ...priorBarriers].sort(),
    "The operation and retained incident inventory differs from the reviewed scope.");
  assert.deepEqual(operations.get(OPERATION), commitTime);
  for (const id of priorBarriers) {
    const time = operations.get(id);
    assert.ok(time.seconds < commitTime.seconds ||
      (time.seconds === commitTime.seconds && time.nanoseconds < commitTime.nanoseconds), "A competing barrier or incident exists.");
  }
}

function createDevelopSheetsContinuationFirestoreReader({prepared, journalDirectory, postflightPath, authorizedFetch}) {
  const frozen = structuredClone(prepared);
  const transport = createSnapshotTransport(authorizedFetch);
  return async function readFirestore() {
    const {images, checkpoint, proof, callbackReceiptDigest, serviceVersions} =
      historicalInput(frozen, journalDirectory, postflightPath);
    const opPath = OPERATIONS + OPERATION;
    const witness = (await transport.batch([opPath])).get(opPath);
    assert.ok(witness.document, "Original committed operation is absent.");
    const readTime = witness.readTime;
    const [rows, operations, baselines, shifts] = await Promise.all([
      transport.batch([...images.map(row => row.path), EVIDENCE, FAILURE], readTime),
      transport.collection("shiftPlanningOperations", readTime),
      transport.collection("shiftPlanningMigrationBaselines", readTime),
      transport.collection("shifts", readTime),
    ]);
    const commitTime = images.find(row => row.path === opPath).updateTime;
    const versions = [];
    for (const expected of images) {
      const doc = rows.get(expected.path).document;
      assert.equal(doc !== null, expected.exists, "Unexpected Firestore destination presence.");
      if (doc) {
        assert.deepEqual(payload(doc), expected.payload, "Firestore afterimage differs.");
        assert.deepEqual(stamped(doc.updateTime), expected.updateTime, "Firestore update version differs.");
        assert.deepEqual(stamped(doc.createTime), commitTime, "Firestore creation version differs.");
      }
      versions.push({path: expected.path, exists: expected.exists, createTime: doc ? stamped(doc.createTime) : null,
        updateTime: doc ? stamped(doc.updateTime) : null});
    }
    assert.equal(digest(versions), serviceVersions, "Firestore service versions differ from the independent postflight.");
    validateInventory(operations, baselines, shifts, frozen, commitTime);
    assert.equal(rows.get(FAILURE).document, null, "The operation has a retained incident.");
    const held = rows.get(EVIDENCE).document;
    assert.ok(held, "The retained barrier is absent.");
    const persisted = data(held);
    const repository = createFirestoreShiftPlanningIntakeBarrierRepository({doc(p) {
      assert.equal(p, EVIDENCE);
      return {get: async () => ({exists: true, data: () => persisted})};
    }});
    const evidence = await repository.readExisting({environment: "develop", transitionId: OPERATION});
    assert.deepEqual(evidence, checkpoint.evidence);
    return Object.freeze({operationId: OPERATION, journalHeadDigest: HEAD, readTime, callbackReceiptDigest,
      receiptDigest: proof.verifiedReceiptDigest, afterimageProof: proof.afterimageProof, checkpointDigest: proof.barrierCheckpointDigest,
      verifiedImages: 203, verifiedCreates: 141, verifiedDeletes: 62,
      operationPresent: true, baselinePresent: true, barrierPresent: true, failurePresent: false});
  };
}

module.exports = {createDevelopSheetsContinuationFirestoreReader};
