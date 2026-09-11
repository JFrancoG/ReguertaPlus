"use strict";

// Opt-in evidence check, not a reset runner. Guard before creating any SDK client.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {beforeEach, after, test} = require("node:test");
const dir = process.env.HU083_EVIDENCE_DIR;
assert(dir && path.isAbsolute(dir), "HU083_EVIDENCE_DIR is required");
assert.equal(process.env.GCLOUD_PROJECT, "demo-hu083-runtime-boundary");
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8797");

const {Firestore, Timestamp} = require("@google-cloud/firestore");
const {createShiftPlanningDigest: digest} = require("../../lib/shift-planning-digest.js");
const {decodeShiftPlanningFirestoreDocument: decode} =
  require("../../lib/shift-planning-publication-contract.js");
const {createFirestoreShiftPlanningPublicEventAudit} =
  require("../../lib/shift-planning-firestore-public-event-audit.js");
const {requiresShiftPlanningPublicEventAudit} =
  require("../../lib/shift-planning-public-event-trigger.js");
const {
  createShiftPlanningPublicEventRetentionPolicy,
  createShiftPlanningPublicEventOperationRetention,
  shiftPlanningPublicEventOperationRetentionPath,
} = require("../../lib/shift-planning-public-event-retention.js");

const {planDigest, ...plan} = JSON.parse(
  fs.readFileSync(path.join(dir, "develop-reset-plan.json"), "utf8"),
);
assert.equal(planDigest, digest(plan), "Content plan changed");
assert.equal(planDigest,
  "shift-planning:v1:sha256:c11f9a90e7fb190c723f726255682cacb80d81274e90a12228fed60f2ed5d564");
assert.equal(plan.liveExecutable, false);
const root = "develop/plus-collections";
for (const item of [...plan.forward, ...plan.inverse]) {
  assert(item.path.startsWith(root + "/"));
  assert(["create", "delete"].includes(item.action));
}
const publicCreates = plan.forward.filter((item) =>
  item.action === "create" && item.path.startsWith(root + "/shifts/"));
const legacyRestores = plan.inverse.filter((item) => item.action === "create");
const operationWrite = plan.forward.find((item) =>
  item.path.startsWith(root + "/shiftPlanningOperations/"));
const operation = decode(operationWrite.payload);
assert.equal(publicCreates.length, 72);
assert.equal(legacyRestores.length, 62);
assert.equal(plan.forward.length, 139);
assert.equal(plan.inverse.length, 139);
assert(plan.inverse.some((item) =>
  item.path === operationWrite.path && item.action === "delete"));

// This local policy tests the existing contract; it is not rollout policy approval.
const policy = createShiftPlanningPublicEventRetentionPolicy({
  policyRevision: "hu083-runtime-boundary-fixture",
  maximumDeliveryRetryHorizonMillis: 60_000,
  safetyMarginMillis: 1_000,
});
const retention = createShiftPlanningPublicEventOperationRetention({
  environment: "develop",
  controlledOperationKind: "activation",
  operationId: operation.operationId,
  operationIntentDigest: operation.operationIntentDigest,
  terminalAt: operation.attemptedAt,
  policy,
});
const retentionPath = shiftPlanningPublicEventOperationRetentionPath({
  environment: "develop", operationId: operation.operationId,
});
assert(!plan.forward.some((item) => item.path === retentionPath));
const db = new Firestore({
  projectId: process.env.GCLOUD_PROJECT,
  host: "127.0.0.1:8797", ssl: false,
});
const auditor = createFirestoreShiftPlanningPublicEventAudit(db, policy);
const evidence = {};
const event = (item, direction) => ({
  eventId: `hu083-runtime-${direction}-${item.path.split("/").at(-1)}`,
  eventTime: Timestamp.fromMillis(operation.attemptedAt.toMillis() + 1_000),
  targetPath: item.path,
  before: direction === "delete" ? decode(item.payload) : null,
  after: direction === "delete" ? null : decode(item.payload),
});

beforeEach(async () => {
  const response = await fetch(
    "http://127.0.0.1:8797/emulator/v1/projects/" +
      "demo-hu083-runtime-boundary/databases/(default)/documents",
    {method: "DELETE"},
  );
  assert.equal(response.ok, true);
});
after(async () => {
  await db.terminate();
  if (Object.keys(evidence).length !== 4) return;
  fs.writeFileSync(path.join(dir, "runtime-boundary-receipt.json"),
    JSON.stringify({
      schemaVersion: 1, contentPlanDigest: planDigest, liveExecutable: false,
      scope: "existing_public_event_auditor_in_emulator",
      fixturePolicyDigest: policy.policyDigest,
      evidence,
      limitations: [
        "No CloudEvent delivery, Rules, Sheets, live Drive or FCM exercised",
        "Positive retention control does not authorize or materialize a rollout",
        "The reset still requires a fenced runtime command and retained recovery authority",
      ],
    }, null, 2) + "\n", {mode: 0o600});
});

test("content-only forward plan rejects all marked creates without retention", async () => {
  await db.doc(operationWrite.path).create(operation);
  for (const item of publicCreates) {
    const input = event(item, "create");
    assert.equal(requiresShiftPlanningPublicEventAudit(input), true);
    const result = await auditor.audit(input);
    assert.equal(result.outcome.kind, "failClosed");
    assert.equal(result.outcome.alertRequired, true);
    assert.equal(result.outcome.legacySideEffectsAllowed, false);
    assert.equal(result.persistence, "created");
    assert.equal((await auditor.audit(input)).persistence, "replayed");
  }
  evidence.forwardWithoutRetention = {rejected: 72, replayed: 72};
});

test("exact activation retention admits and replays all 72 creates", async () => {
  await db.doc(operationWrite.path).create(operation);
  await db.doc(retentionPath).create(retention);
  for (const item of publicCreates) {
    const input = event(item, "create");
    const result = await auditor.audit(input);
    assert.equal(result.outcome.kind, "controlledNoOp");
    assert.equal(result.outcome.legacySideEffectsAllowed, false);
    assert.equal(result.persistence, "created");
    assert.equal((await auditor.audit(input)).persistence, "replayed");
  }
  evidence.forwardWithFixtureRetention = {controlledNoOp: 72, replayed: 72};
});

test("clone inverse loses delete authority and cannot clear late event audit", async () => {
  // The inverse deletes the operation. Audit delayed deletes against that final state.
  assert.equal((await db.doc(operationWrite.path).get()).exists, false);
  for (const item of publicCreates) {
    const input = event(item, "delete");
    assert.equal(requiresShiftPlanningPublicEventAudit(input), true);
    const result = await auditor.audit(input);
    assert.equal(result.outcome.kind, "failClosed");
    assert.equal(result.outcome.alertRequired, true);
    assert.equal(result.persistence, "created");
    assert.equal((await auditor.audit(input)).persistence, "replayed");
  }
  evidence.inverseWithoutRetainedAuthority = {rejected: 72, replayed: 72};
});

test("all captured legacy restores and deletes remain unmarked ordinary events", async () => {
  for (const item of legacyRestores) {
    const payload = decode(item.payload);
    assert.equal(payload.source, "google_sheets");
    assert.equal(payload.status, "planned");
    for (const direction of ["create", "delete"]) {
      const input = event(item, direction);
      assert.equal(requiresShiftPlanningPublicEventAudit(input), false);
      assert.equal((await auditor.audit(input)).outcome.kind, "ordinary");
    }
  }
  evidence.legacyEvents = {ordinaryCreates: 62, ordinaryDeletes: 62};
});
