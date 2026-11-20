"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const {spawnSync} = require("node:child_process");
const {randomUUID} = require("node:crypto");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {FILE, PARENT, OWNER, WRITER, PERMISSION, READERS, metadataFingerprint} = require("../scripts/develop-original-writer-provider.cjs");
const {REQUEST} = require("../scripts/develop-sheets-continuation-operator.cjs");
const {grantFor} = require("../scripts/prepare-develop-writer-rehearsal.cjs");
const {containInterruptedContinuation, inspectContinuationContainment} = require("../scripts/develop-sheets-continuation-containment.cjs");

function fixture(t) {
  t.mock.method(global, "fetch", () => { throw Error("External provider forbidden in containment tests."); });
  const journalRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "hu084-closed-")));
  t.after(() => fs.rmSync(journalRoot, {recursive: true, force: true}));
  const accessDirectory = fs.mkdtempSync(path.join(journalRoot, "access-"));
  const at = Date.now(), packetSha256 = "c".repeat(64), runId = randomUUID();
  const window = {startsAtMillis: at, endsAtMillis: at + 1200000};
  const identity = {email: WRITER, uniqueId: "110752956317536684858"};
  const permission = {fileId: FILE, permissionId: PERMISSION, emailAddress: WRITER, type: "user", role: "writer"};
  const reviewDigest = digest({kind: "native-drive-owner-sharing", owner: OWNER, operationId: REQUEST.operationId, packetSha256, permission});
  const grant = grantFor(window);
  grant.condition.title = "hu084-retained-sheets-projection"; grant.condition.description = "Single reviewed Develop Sheets projection";
  const owner = {emailAddress: OWNER, permissionId: "original-owner", me: true};
  const ownerPerm = {emailAddress: OWNER, id: "original-owner", type: "user", role: "owner"};
  const baseline = {file: {id: FILE, parents: [PARENT], mimeType: "application/vnd.google-apps.spreadsheet", owners: [owner], version: "307", trashed: false},
    parent: {id: PARENT, mimeType: "application/vnd.google-apps.folder", owners: [owner], trashed: false}, parentPermissions: [ownerPerm],
    filePermissions: [ownerPerm, ...READERS.map((emailAddress, i) => ({emailAddress, id: "reader" + i, type: "user", role: "reader"}))]};
  const projectPolicy = {bindings: []};
  const values = {filePresent: true, disabled: false, bindings: [grant]};
  const writes = [];
  const oldOwnerPid = spawnSync(process.execPath, ["-e", ""]).pid;
  const events = [{phase: "start", atMillis: at, runId, packetSha256, window, processId: oldOwnerPid,
    approval: {authorized: true, packetSha256, scope: REQUEST}, consent: {stableWorkbookAndAdministration: true, operationId: REQUEST.operationId, packetSha256, startsAtMillis: at}},
  {phase: "enable-intent", atMillis: at + 2, identity, grant, previouslyDisabled: true, projectPolicyDigest: digest(projectPolicy),
    baselineAuthority: metadataFingerprint(baseline, {omitVersion: true, omitWriter: true})},
  {phase: "enabled-verified", identity}, {phase: "conditional-grant-intent", grant}, {phase: "conditional-grant-verified", grant},
  {phase: "file-grant-intent", permission}, {phase: "native-grant-dispatch", permission, reviewDigest},
  {phase: "native-grant-verified", permission, reviewDigest}, {phase: "writer-mint-intent"}];
  function save() {
    fs.writeFileSync(path.join(accessDirectory, "events.jsonl"), events.map(e => JSON.stringify(e)).join("\n") + "\n", {mode: 0o600});
  }
  save();
  const dir = path.join(journalRoot, REQUEST.operationId); fs.mkdirSync(dir, {mode: 0o700});
  fs.writeFileSync(path.join(dir, "writer-claim.json"), JSON.stringify({operationId: REQUEST.operationId, requestDigest: REQUEST.requestDigest, atMillis: at + 1}), {mode: 0o600});
  const inputs = {journalRoot, accessDirectory, packetSha256, runId,
    owner: {read: async () => {
      const metadata = structuredClone(baseline);
      if (values.filePresent) metadata.filePermissions.push({id: PERMISSION, emailAddress: WRITER, type: "user", role: "writer"});
      return metadata;
    }},
    channel: {reviewDigest, remove: async (p, {assertActive}) => {
      assertActive(); assert.deepEqual(p, permission); writes.push("remove-file"); values.filePresent = false;
    }},
    iam: {readIdentity: async () => ({account: {...identity, disabled: values.disabled}, project: {projectId: "reguerta-9f27f"}, projectPolicy, keys: {},
      policy: {etag: "observed-CAS", bindings: values.bindings}}),
    setPolicy: async policy => {assert.equal(policy.etag, "observed-CAS"); assert.deepEqual(policy.bindings, []); writes.push("remove-iam"); values.bindings = [];},
    disableOwned: async () => {writes.push("disable"); values.disabled = true;}},
    isolated: async () => ({writerIsolated: values.disabled && !values.bindings.length})};
  return {inputs, values, writes, events, save, grant, identity};
}
test("contains only the matched ACL, grant and identity after process death and preserves lost-credential uncertainty", async t => {
  const f = fixture(t);
  assert.equal(inspectContinuationContainment(f.inputs).processAlive, false);
  const result = await containInterruptedContinuation(f.inputs);
  assert.equal(result.kind, "access-contained-original-credentials-unverified");
  assert.equal(result.originalWriterDenial, "unknown-original-token-unavailable");
  assert.equal(result.originalOwnerRevocation, "unknown-original-credential-unavailable");
  assert.equal(result.sheetsBatches, 0); assert.equal(result.firestoreWrites, 0);
  assert.deepEqual(f.writes, ["remove-file", "remove-iam", "disable"]);
  assert.equal((await containInterruptedContinuation(f.inputs)).kind, result.kind);
  assert.equal(f.writes.length, 3);
});
test("refuses a live owner, a foreign binding or an uncorrelated access directory", async t => {
  const f = fixture(t);
  await assert.rejects(containInterruptedContinuation({...f.inputs, packetSha256: "d".repeat(64)}));
  const pid = f.events[0].processId; f.events[0].processId = process.pid; f.save();
  await assert.rejects(containInterruptedContinuation(f.inputs)); assert.deepEqual(f.writes, []);
  f.events[0].processId = pid; f.save(); f.values.bindings = [{role: "foreign", members: []}];
  const stopped = await containInterruptedContinuation(f.inputs);
  assert.equal(stopped.kind, "inspection-required"); assert.deepEqual(stopped.errors, ["iam"]);
  assert.deepEqual(f.writes, ["remove-file"]);
});
test("retains possible late enable, grant, and unresolved cleanup even when current reads appear closed", async t => {
  const f = fixture(t); f.values.bindings = []; f.values.disabled = true; f.values.filePresent = false;
  f.events.splice(f.events.findIndex(e => e.phase === "conditional-grant-verified"), 1);
  f.events.push({phase: "conditional-remove-intent", grant: f.grant}, {phase: "disable-intent", identity: f.identity});
  f.save();
  const result = await containInterruptedContinuation(f.inputs);
  assert.equal(result.kind, "inspection-required"); assert.equal(result.iam.lateIamExcluded, false);
  assert.equal(result.iam.cleanupSettled, false); assert.deepEqual(f.writes, []);
});
test("a previously dispatched native removal or IAM cleanup never triggers a second dispatch", async t => {
  const f = fixture(t), grant = f.events.find(e => e.phase === "native-grant-dispatch");
  f.events.push({...grant, phase: "native-remove-dispatch"}, {phase: "conditional-remove-intent", grant: f.grant}, {phase: "disable-intent", identity: f.identity}); f.save();
  const result = await containInterruptedContinuation(f.inputs);
  assert.equal(result.kind, "inspection-required"); assert.deepEqual(f.writes, []);
});
