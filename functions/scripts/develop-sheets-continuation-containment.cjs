"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {randomUUID} = require("node:crypto");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {FILE, OWNER, WRITER, PERMISSION, validateMetadata, metadataFingerprint} = require("./develop-original-writer-provider.cjs");
const {grantFor, removeOwnGrant, checkIdentity} = require("./prepare-develop-writer-rehearsal.cjs");
const REQUEST = {kind: "single-retained-sheets-projection", environment: "develop", workbookId: FILE,
  operationId: "request-hu084-initial-73d77a7da377753f11f9",
  requestDigest: "shift-sheets:v1:sha256:a8b55e319b315566b8916015638b8d3eac9454a9bcda4c7d99f513fdc76b72ab",
  maximumSheetsBatches: 1, firestoreWrites: 0, temporaryFileAndIamAccess: true, acceptsHistoricalRisk: true};

const IDENTITY = {email: WRITER, uniqueId: "110752956317536684858"};
const PERMIT = {fileId: FILE, permissionId: PERMISSION, type: "user", role: "writer", emailAddress: WRITER};
const authority = metadata => metadataFingerprint(metadata, {omitVersion: true, omitWriter: true});
const exact = (a, b) => assert.equal(digest(a), digest(b));
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const has = (events, phase) => events.some(row => row.phase === phase);
function ownLocation(file, directory) {
  assert.ok(path.isAbsolute(file));
  assert.equal(fs.realpathSync(file), file);
  const stat = fs.lstatSync(file);
  assert.ok(directory ? stat.isDirectory() : stat.isFile());
  assert.equal(stat.uid, process.getuid());
  assert.equal(stat.mode & 0o077, 0, "Recovery evidence must be private.");
}
function originalRun({journalRoot, accessDirectory, packetSha256, runId}) {
  ownLocation(journalRoot, true);
  ownLocation(accessDirectory, true);
  assert.equal(path.dirname(accessDirectory), journalRoot);
  assert.match(path.basename(accessDirectory), /^access-[A-Za-z0-9]{6}$/);
  assert.match(packetSha256, /^[a-f0-9]{64}$/);
  assert.match(runId, /^[0-9a-f-]{36}$/);
  const log = path.join(accessDirectory, "events.jsonl");
  ownLocation(log, false);
  const bytes = fs.readFileSync(log, "utf8"), end = bytes.lastIndexOf("\n");
  assert.ok(end >= 0, "Original authorization record is incomplete.");
  const events = bytes.slice(0, end).split("\n").map(line => JSON.parse(line));
  const start = events[0], partialTail = end !== bytes.length - 1;
  assert.equal(start.phase, "start"); assert.equal(start.runId, runId);
  assert.equal(start.packetSha256, packetSha256);
  assert.deepEqual(start.approval.scope, REQUEST);
  assert.equal(start.approval.authorized, true);
  assert.equal(start.approval.packetSha256, packetSha256);
  assert.equal(start.consent.packetSha256, packetSha256);
  assert.equal(start.consent.operationId, REQUEST.operationId);
  assert.equal(start.consent.stableWorkbookAndAdministration, true);
  assert.equal(start.window.startsAtMillis, start.consent.startsAtMillis);
  assert.equal(start.window.endsAtMillis - start.window.startsAtMillis, 1200000);
  assert.ok(Number.isSafeInteger(start.processId) && start.processId > 0);
  const grant = grantFor(start.window);
  grant.condition.title = "hu084-retained-sheets-projection";
  grant.condition.description = "Single reviewed Develop Sheets projection";
  const reviewDigest = digest({kind: "native-drive-owner-sharing", owner: OWNER, operationId: REQUEST.operationId, packetSha256, permission: PERMIT});
  const enable = events.find(e => e.phase === "enable-intent");
  if (enable) {
    assert.equal(events.filter(e => e.phase === "enable-intent").length, 1);
    const claimDirectory = path.join(journalRoot, REQUEST.operationId);
    ownLocation(claimDirectory, true);
    const claim = path.join(claimDirectory, "writer-claim.json");
    ownLocation(claim, false);
    const intent = read(claim);
    assert.equal(intent.operationId, REQUEST.operationId);
    assert.equal(intent.requestDigest, REQUEST.requestDigest);
    assert.ok(start.atMillis <= intent.atMillis && intent.atMillis <= enable.atMillis);
    assert.equal(enable.previouslyDisabled, true);
    for (const d of [enable.baselineAuthority, enable.projectPolicyDigest]) assert.match(d, /^shift-planning:v1:sha256:[a-f0-9]{64}$/);
    exact(enable.identity, IDENTITY); exact(enable.grant, grant);
  }
  const seen = new Set();
  for (const event of events) {
    if (event.phase === "enabled-verified" || event.phase === "disable-intent") {
      assert.ok(seen.has("enable-intent")); exact(event.identity, IDENTITY);
    }
    if (event.phase === "conditional-grant-intent") { assert.ok(seen.has("enabled-verified")); exact(event.grant, grant); }
    if (event.phase === "conditional-grant-verified" || event.phase === "conditional-remove-intent") {
      assert.ok(seen.has("conditional-grant-intent")); exact(event.grant, grant);
    }
    if (event.phase === "file-grant-intent") { assert.ok(seen.has("conditional-grant-intent")); exact(event.permission, PERMIT); }
    if (/^native-(?:grant|remove)-(?:dispatch|verified)$/.test(event.phase)) {
      assert.ok(seen.has("file-grant-intent")); exact(event.permission, PERMIT); assert.equal(event.reviewDigest, reviewDigest);
      if (event.phase.endsWith("-verified")) assert.ok(seen.has(event.phase.replace("-verified", "-dispatch")));
    }
    if (["start", "enable-intent", "conditional-grant-intent", "file-grant-intent", "native-grant-dispatch", "native-remove-dispatch"].includes(event.phase)) {
      assert.ok(!seen.has(event.phase), "Repeated owned authorization phase.");
    }
    seen.add(event.phase);
  }
  return {start, events, enable, grant, reviewDigest, partialTail};
}
function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) {
    if (e.code === "ESRCH") return false;
    throw e;
  }
}
function inspectContinuationContainment(input) {
  const {start, events, reviewDigest, partialTail} = originalRun(input);
  const terminal = events.at(-1);
  return {runId: start.runId, reviewDigest, processId: start.processId, processAlive: alive(start.processId), partialTail,
    terminalRecorded: terminal.phase === "terminal", originalClosureVerified: terminal.phase === "terminal" && terminal.cleanup?.verified === true,
    enableIntent: has(events, "enable-intent"), fileIntent: has(events, "file-grant-intent"),
    nativeGrantDispatched: has(events, "native-grant-dispatch"), nativeGrantSettled: has(events, "native-grant-verified"),
    writerMintAttempted: has(events, "writer-mint-intent"), canSubmit: false};
}
// Link a completely written, fsynced inode. Concurrent processes cannot both
// acquire a generation or reserve a repeated native/IAM dispatch.
function publish(directory, name, value) {
  const temporary = path.join(directory, "." + randomUUID());
  const fd = fs.openSync(temporary, "wx", 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value) + "\n"); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  try {
    fs.linkSync(temporary, path.join(directory, name));
    const dir = fs.openSync(directory, "r");
    try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
  } finally { fs.unlinkSync(temporary); }
}
function claimRecovery(directory, runId) {
  const names = fs.readdirSync(directory).filter(n => /^claim-[0-9]{6}\.json$/.test(n)).sort();
  for (const [index, name] of names.entries()) {
    assert.equal(name, "claim-" + String(index + 1).padStart(6, "0") + ".json");
    const old = read(path.join(directory, name));
    assert.equal(old.runId, runId);
    if (index === names.length - 1 && !fs.existsSync(path.join(directory, "result-" + old.generation + ".json"))) {
      assert.equal(alive(old.processId), false, "Another containment process is active.");
    }
  }
  const generation = String(names.length + 1).padStart(6, "0");
  publish(directory, "claim-" + generation + ".json", {generation, runId, processId: process.pid});
  return generation;
}

async function containInterruptedContinuation(input) {
  const {events, enable, grant, reviewDigest, start, partialTail} = originalRun(input);
  const {accessDirectory, owner, iam, channel, isolated, closeRecoveryOwner} = input;
  const last = events.at(-1);
  if (last.phase === "terminal" && last.cleanup?.verified === true) {
    return {kind: "already-contained", runId: start.runId, originalClosureVerified: true, canSubmit: false};
  }
  assert.equal(alive(start.processId), false, "Original operator still owns containment.");
  const directory = path.join(accessDirectory, "containment");
  try { fs.mkdirSync(directory, {mode: 0o700}); } catch (e) { if (e.code !== "EEXIST") throw e; }
  ownLocation(directory, true);
  const generation = claimRecovery(directory, start.runId);
  const result = {kind: "inspection-required", runId: start.runId, packetSha256: start.packetSha256, partialTail,
    canSubmit: false, firestoreWrites: 0, sheetsBatches: 0, errors: []};
  async function measure(name, callback) {
    try { result[name] = await callback(); } catch { result.errors.push(name); }
  }
  const marked = name => fs.existsSync(path.join(directory, name + ".json"));
  function settle(name) {
    if (!marked(name + "-verified")) publish(directory, name + "-verified.json", {runId: start.runId, generation, atMillis: Date.now()});
  }
  function reserve(name) {
    const destination = path.join(directory, name + "-intent.json");
    if (fs.existsSync(destination)) return false;
    publish(directory, name + "-intent.json", {runId: start.runId, generation, atMillis: Date.now()});
    return true;
  }
  await measure("file", async () => {
    if (!has(events, "file-grant-intent")) return {notAttempted: true};
    assert.ok(enable);
    let current = await owner.read();
    const present = current.filePermissions.some(p => p.id === PERMISSION);
    validateMetadata(current, present);
    assert.equal(authority(current), enable.baselineAuthority);
    let removedHere = false;
    if (present) {
      assert.ok(has(events, "native-grant-dispatch"), "No matching native grant dispatch.");
      assert.equal(has(events, "native-remove-dispatch"), false, "Original removal remains uncertain.");
      assert.equal(channel.reviewDigest, reviewDigest);
      assert.ok(reserve("remove-file"), "A prior removal is awaiting inspection.");
      await channel.remove(PERMIT, {assertActive() { assert.equal(alive(start.processId), false); }});
      removedHere = true;
      current = await owner.read();
    }
    validateMetadata(current, false);
    assert.equal(authority(current), enable.baselineAuthority);
    if (removedHere) settle("remove-file");
    const lateGrantExcluded = !has(events, "native-grant-dispatch") || has(events, "native-grant-verified");
    const removalSettled = (!has(events, "native-remove-dispatch") || has(events, "native-remove-verified")) &&
      (!marked("remove-file-intent") || marked("remove-file-verified"));
    return {absent: true, lateGrantExcluded, removalSettled};
  });
  await measure("iam", async () => {
    if (!enable) return {notAttempted: true};
    async function inspect() {
      const value = await iam.readIdentity();
      const bindings = value.policy.bindings ?? [];
      assert.ok(bindings.length === 0 || (has(events, "conditional-grant-intent") && digest(bindings) === digest([grant])));
      checkIdentity({...value, account: {...value.account, disabled: false}}, {identity: IDENTITY}, bindings);
      assert.equal(digest(value.projectPolicy), enable.projectPolicyDigest);
      return {value, bindings};
    }
    const initial = await inspect();
    const unresolved = [];
    let removedHere = false, disabledHere = false;
    if (initial.bindings.length) {
      try {
        assert.equal(has(events, "conditional-remove-intent"), false);
        assert.ok(reserve("remove-iam"), "A prior IAM removal remains uncertain.");
        await iam.setPolicy(removeOwnGrant(initial.value.policy, grant));
        removedHere = true;
      } catch { unresolved.push("grant-removal"); }
    }
    const beforeDisable = await inspect();
    if (removedHere && !beforeDisable.bindings.length) settle("remove-iam");
    if (!beforeDisable.value.account.disabled) {
      try {
        assert.equal(has(events, "disable-intent"), false);
        assert.ok(reserve("disable-writer"), "A prior disable remains uncertain.");
        await iam.disableOwned();
        disabledHere = true;
      } catch { unresolved.push("disable"); }
    }
    const after = await inspect();
    if (disabledHere && after.value.account.disabled === true) settle("disable-writer");
    const originalIamClosed = events.findLast(e => e.phase === "iam-closed")?.receipt?.verified === true;
    const lateIamExcluded = originalIamClosed || (has(events, "enabled-verified") &&
      (!has(events, "conditional-grant-intent") || has(events, "conditional-grant-verified")));
    const cleanupSettled = (originalIamClosed || (!has(events, "conditional-remove-intent") && !has(events, "disable-intent"))) &&
      (!marked("remove-iam-intent") || marked("remove-iam-verified")) &&
      (!marked("disable-writer-intent") || marked("disable-writer-verified"));
    const writerIsolated = (await isolated()).writerIsolated;
    if (after.bindings.length || !after.value.account.disabled || !writerIsolated || unresolved.length) result.errors.push("iam-containment");
    return {disabled: after.value.account.disabled === true, isolated: writerIsolated === true,
      bindings: after.bindings.length, lateIamExcluded, cleanupSettled, unresolved};
  });
  const priorFile = events.findLast(e => e.phase === "file-closed")?.receipt;
  const priorOAuth = events.findLast(e => e.phase === "oauth-closed")?.receipt;
  result.originalWriterDenial = has(events, "writer-mint-intent") ?
    (priorFile?.verified && [403, 404].includes(priorFile.denialStatus) ? "verified-in-original-journal" : "unknown-original-token-unavailable") : "not-minted";
  result.originalOwnerRevocation = priorOAuth?.verified && priorOAuth.revocationStatus === 200 && priorOAuth.drive === 401 && priorOAuth.sheets === 401 ?
    "verified-in-original-journal" : "unknown-original-credential-unavailable";
  if (closeRecoveryOwner) await measure("recoveryOwner", async () => {
    const closed = await closeRecoveryOwner();
    assert.equal(closed.verified, true); assert.equal(closed.revocationStatus, 200);
    assert.deepEqual([closed.attempts.at(-1).drive, closed.attempts.at(-1).sheets], [401, 401]);
    return {revoked: true};
  });
  const fileClosed = result.file?.notAttempted || (result.file?.absent && result.file?.lateGrantExcluded && result.file?.removalSettled);
  const iamClosed = result.iam?.notAttempted || (result.iam?.isolated && result.iam?.disabled && result.iam?.bindings === 0 && result.iam?.lateIamExcluded && result.iam?.cleanupSettled);
  if (!result.errors.length && fileClosed && iamClosed && !partialTail) {
    result.kind = result.originalOwnerRevocation.startsWith("verified-") && !result.originalWriterDenial.startsWith("unknown-") ?
      "contained-and-verified" : "access-contained-original-credentials-unverified";
  }
  publish(directory, "result-" + generation + ".json", result);
  return result;
}
module.exports = {inspectContinuationContainment, containInterruptedContinuation};
