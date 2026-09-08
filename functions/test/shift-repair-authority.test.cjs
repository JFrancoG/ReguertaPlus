"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {materializeShiftRepair} = require("../scripts/materialize-shift-repair.cjs");
const {rehearseShiftRepair} = require("../scripts/rehearse-shift-repair.cjs");
const {repairFixture, root, encode, decode, digest} = require("./shift-repair-rehearsal-fixture.cjs");

test("authority binding attaches both rotations to one baseline and preserves maintenance for inverse CAS", async () => {
  const {options, review, initial} = await repairFixture();
  assert.equal(review.schemaVersion, 5); assert.equal(review.readyForApply, false);
  const {forward, inverse, baseline} = review.recoveryEvidence;
  for (const type of ["delivery", "market"]) {
    const path = `${root}/shiftRotations/${type}`, result = decode(forward.writes.find((write) => write.targetPath === path).payload);
    assert.equal(result.stateRevision, 3); assert.deepEqual(result.migrationBaseline, baseline.reference);
    assert.deepEqual(result.cursor, options.proposal.lineage[type].rotationAfterHorizon);
    assert.deepEqual(decode(inverse.writes.find((write) => write.targetPath === path).payload), initial.get(path));
  }
  assert.ok(!forward.writes.some((write) => write.targetPath.endsWith("/current")));
  assert.ok(inverse.readGuards.some((guard) => guard.targetPath.endsWith("/current")));
  assert.deepEqual(await materializeShiftRepair(options), review);
});

test("authority rejects incomplete captures, open maintenance, mismatched lineage, frontier, leases and exhausted revisions", async () => {
  const {options} = await repairFixture();
  const mutations = [(capture) => capture.documents.pop(), (capture) => {capture.inputDigest = "stale";},
    (capture) => {capture.target = {...capture.target, workbookId: "wrong"};},
    ...[(doc) => {doc.maintenanceStatus = "open"; doc.intakeBarrier = null;}, (doc) => {doc.writeEpoch += 1;}].map((edit) => (capture) => {
      const entry = capture.documents.find((doc) => doc.targetPath.endsWith("/current")), value = decode(entry.payload); edit(value); entry.payload = encode(value);
    }),
    ...[(doc) => {doc.cursor.nextMemberIndex = 2;}, (doc) => {doc.stateRevision = Number.MAX_SAFE_INTEGER;},
      (doc) => {doc.planningFrontierSeasonStartYear = 2025;}, (doc) => {doc.extra = true;},
      (doc) => {doc.releaseLease = {type: "delivery", bundleId: "bundle-r1", bundleRevision: doc.activeRevision, bundleDigest: doc.activeDigest,
        leaseEpoch: 1, ownerOperationId: "lease-r1", state: "sealed", acquiredAtMillis: 0, deadlineAtMillis: 10000};}].map((edit) => (capture) => {
      const entry = capture.documents.find((doc) => doc.targetPath.endsWith("/delivery")), value = decode(entry.payload); edit(value); entry.payload = encode(value);
    })];
  for (const edit of mutations) {
    const bad = structuredClone(options); edit(bad.authorityCapture); bad.expectedAuthorityCaptureDigest = digest(bad.authorityCapture);
    await assert.rejects(materializeShiftRepair(bad));
  }
  await assert.rejects(materializeShiftRepair({...options, expectedAuthorityCaptureDigest: "wrong"}));
  await assert.rejects(materializeShiftRepair({...options, authorityCapture: undefined}));
});

test("executor rejects live projects, non-loopback targets and missing emulator environment before constructing a client", async () => {
  for (const emulator of [{host: "remote.example:8080", projectId: "demo-reguerta-hu083-repair"},
    {host: "127.0.0.1:8080", projectId: "reguerta-live"}, {host: "127.0.0.1:99999", projectId: "demo-reguerta-hu083-repair"}]) {
    await assert.rejects(rehearseShiftRepair({emulator}));
  }
});

const {planShiftRepair} = require("../scripts/repair-planned-shifts.cjs");
const {mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync} = require("node:fs");
const {tmpdir} = require("node:os");
const {join} = require("node:path");
const {spawnSync} = require("node:child_process");

test("a reviewed cursor correction is applied to the aggregate while its old cursor is retained for inverse", async () => {
  const {options} = await repairFixture();
  options.input.lineage.delivery.rotationAfterHorizon.nextMemberIndex = 2;
  options.expectedInputDigest = digest(options.input);
  options.firestoreCapture.inputDigest = options.expectedInputDigest; options.expectedCaptureDigest = digest(options.firestoreCapture);
  options.authorityCapture.inputDigest = options.expectedInputDigest;
  const entry = options.authorityCapture.documents.find((doc) => doc.targetPath.endsWith("/delivery")), old = decode(entry.payload);
  old.cursor.nextMemberIndex = 2; entry.payload = encode(old); options.expectedAuthorityCaptureDigest = digest(options.authorityCapture);
  const {baselineRevision, expectedMaterializedPlanDigest, authorityCapture, expectedAuthorityCaptureDigest, ...base} = options;
  base.materialization.repairPlanDigest = (await planShiftRepair(base)).planDigest;
  base.expectedMaterializationDigest = digest(base.materialization);
  const v3 = await materializeShiftRepair(base);
  const result = await materializeShiftRepair({...base, baselineRevision, expectedMaterializedPlanDigest: v3.planDigest, authorityCapture, expectedAuthorityCaptureDigest});
  const path = `${root}/shiftRotations/delivery`;
  assert.equal(decode(result.recoveryEvidence.forward.writes.find((write) => write.targetPath === path).payload).cursor.nextMemberIndex, 3);
  assert.equal(decode(result.recoveryEvidence.inverse.writes.find((write) => write.targetPath === path).payload).cursor.nextMemberIndex, 2);
});

test("five-file CLI binds authority capture and rejects unpaired or stale authority options without writes", async () => {
  const {options} = await repairFixture(), directory = mkdtempSync(join(tmpdir(), "repair-authority-"));
  try {
    const fields = ["input", "proposal", "firestoreCapture", "materialization", "authorityCapture"];
    for (const field of fields) writeFileSync(join(directory, field + ".json"), JSON.stringify(options[field]));
    const args = [require.resolve("../scripts/repair-planned-shifts.cjs"), "--mode", "dry-run", "--input", join(directory, "input.json"),
      "--proposal", join(directory, "proposal.json"), "--project", options.target.projectId, "--environment", "develop", "--workbook", options.target.workbookId,
      "--expected-input-digest", options.expectedInputDigest, "--expected-proposal-digest", options.expectedProposalDigest,
      "--firestore-capture", join(directory, "firestoreCapture.json"), "--expected-capture-digest", options.expectedCaptureDigest,
      "--materialization", join(directory, "materialization.json"), "--expected-materialization-digest", options.expectedMaterializationDigest,
      "--baseline-revision", options.baselineRevision, "--expected-materialized-plan-digest", options.expectedMaterializedPlanDigest,
      "--authority-capture", join(directory, "authorityCapture.json"), "--expected-authority-capture-digest", options.expectedAuthorityCaptureDigest];
    const result = spawnSync(process.execPath, args, {encoding: "utf8", env: {PATH: process.env.PATH}});
    assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).schemaVersion, 5);
    for (const field of fields) assert.equal(readFileSync(join(directory, field + ".json"), "utf8"), JSON.stringify(options[field]));
    assert.equal(readdirSync(directory).length, 5);
    assert.equal(spawnSync(process.execPath, args.slice(0, -2), {encoding: "utf8"}).status, 1);
    args[args.length - 1] = "stale"; const bad = spawnSync(process.execPath, args, {encoding: "utf8"}); assert.equal(bad.status, 1); assert.equal(bad.stdout, "");
  } finally {rmSync(directory, {recursive: true, force: true});}
});
