"use strict";

const assert = require("node:assert/strict");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {FILE, WRITER, PERMISSION, validateMetadata, metadataFingerprint} = require("./develop-original-writer-provider.cjs");
const {openOriginalWindowWriter} = require("./develop-original-window-provider.cjs");
const {grantFor, removeOwnGrant, checkIdentity, prepare} = require("./prepare-develop-writer-rehearsal.cjs");

const IDENTITY = Object.freeze({email: WRITER, uniqueId: "110752956317536684858"});
const PERMIT = Object.freeze({fileId: FILE, permissionId: PERMISSION, type: "user", role: "writer", emailAddress: WRITER});

// The privilege lifetime is independent of the old migration. Only this module
// owns the newly enabled identity, conditional IAM binding and exact file ACL.
function createSheetsContinuationAccess({window, requests, owner, iam, isolated, channel, budget, record,
  assertQuiet, nowMillis = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  openWriter = openOriginalWindowWriter}) {
  const grant = grantFor(window);
  grant.condition.title = "hu084-retained-sheets-projection";
  grant.condition.description = "Single reviewed Develop Sheets projection";
  const reviewedRequests = structuredClone(requests);
  let baseline, activeImage, initialProjectPolicy, enabled = false, grantAttempted = false;
  let enableVerified = false, iamGrantAttempted = false, nativeUncertain = false, fileGranted = false, issued = false, positive = false;
  let writer, expiry, checkDispatch, cleanupStarted = false;

  function current() {
    assert.equal(cleanupStarted, false);
    budget.assertStage();
    assertQuiet();
  }
  async function identity(disabled, bindings, previousBindings) {
    const deadline = Math.min(nowMillis() + 60000, budget.currentStageDeadlineMillis());
    for (;;) {
      budget.assertStage();
      const value = await iam.readIdentity();
      const actual = value.policy.bindings ?? [];
      const ready = digest(actual) === digest(bindings);
      const propagating = previousBindings !== undefined && digest(actual) === digest(previousBindings);
      assert.ok(ready || propagating, "unexpected_writer_binding");
      checkIdentity({...value, account: {...value.account, disabled: false}}, {identity: IDENTITY}, actual);
      if (initialProjectPolicy) assert.equal(digest(value.projectPolicy), initialProjectPolicy);
      if (ready && (value.account.disabled === true) === disabled) return value;
      assert.ok(nowMillis() + 1000 < deadline, "writer_state_propagation_unverified");
      await sleep(1000);
    }
  }
  async function isolation() { assert.equal((await isolated()).writerIsolated, true); }
  const authority = metadata => metadataFingerprint(metadata, {omitVersion: true, omitWriter: true});

  async function capture() {
    current();
    const value = await owner.capture(fileGranted);
    if (baseline) assert.equal(authority(value.after), authority(baseline.after));
    else baseline = value;
    if (fileGranted && !activeImage) {
      assert.equal(value.snapshotDigest, baseline.snapshotDigest, "permission_transition_changed_image");
      activeImage = value;
    }
    current();
    return value;
  }
  async function acquire() {
    current();
    assert.ok(baseline && !enabled && !fileGranted);
    const prev = await identity(true, []);
    initialProjectPolicy = digest(prev.projectPolicy);
    await isolation();
    const before = await capture();
    assert.equal(before.metadataDigest, baseline.metadataDigest);
    assert.equal(before.snapshotDigest, baseline.snapshotDigest);
    record({phase: "enable-intent", identity: IDENTITY, baselineAuthority: authority(before.after), projectPolicyDigest: initialProjectPolicy, previouslyDisabled: true, grant});
    enabled = true;
    await iam.enableOwned();
    const active = await identity(false, []);
    enableVerified = true;
    record({phase: "enabled-verified", identity: IDENTITY});
    current();
    record({phase: "conditional-grant-intent", grant});
    iamGrantAttempted = true;
    await iam.setPolicy({...active.policy, version: 3, bindings: [grant]});
    const grantedAt = nowMillis();
    current();
    record({phase: "file-grant-intent", permission: PERMIT});
    grantAttempted = true;
    try {
      const receipt = await channel.grant(PERMIT, {assertActive: current});
      assert.equal(receipt.closure?.grantCapability, "consumed");
      fileGranted = true;
    } catch (error) {
      nativeUncertain = error.nativeGrantUncertain === true;
      throw error;
    }
    const after = await capture();
    record({phase: "file-granted", originalVersion: before.after.file.version, grantedVersion: after.after.file.version,
      snapshotDigest: after.snapshotDigest, authorityDigest: authority(after.after)});
    for (;;) {
      current();
      await identity(false, [grant], []);
      if (await iam.hasMintPermission() && nowMillis() >= grantedAt + 120000) break;
      await sleep(Math.min(5000, Math.max(1, budget.currentStageDeadlineMillis() - nowMillis())));
    }
    record({phase: "conditional-grant-verified", grant});
    await isolation();
    current();
    return {writerVersion: activeImage.after.file.version};
  }
  async function issue() {
    current();
    assert.ok(activeImage && !issued);
    await identity(false, [grant]);
    await isolation();
    const fresh = await capture();
    assert.equal(fresh.metadataDigest, activeImage.metadataDigest);
    assert.equal(fresh.snapshotDigest, activeImage.snapshotDigest);
    current();
    record({phase: "writer-mint-intent", identity: IDENTITY});
    issued = true;
    const token = await iam.mint(prepare().tokenRequest);
    expiry = Date.parse(token.expireTime);
    try {
      budget.beginWork(expiry);
      writer = openWriter({bearer: token.accessToken, expiresAtMillis: expiry, fetchImpl: budget.fetch, nowMillis,
        authorizeBatch: async body => assert.deepEqual(body, {requests: reviewedRequests}),
        assertSubmission() { current(); budget.assertSubmission(); checkDispatch(); }});
    } finally { token.accessToken = null; }
    assert.equal((await writer.probe()).status, 200);
    positive = true;
    record({phase: "writer-probed", expiresAtMillis: expiry});
  }
  async function submit(requestsToSend, assertAtDispatch) {
    assert.ok(positive);
    assert.deepEqual(requestsToSend, reviewedRequests);
    assert.equal(typeof assertAtDispatch, "function");
    checkDispatch = assertAtDispatch;
    return writer.sheets.batchUpdate({spreadsheetId: FILE, requestBody: {requests: reviewedRequests}}, {retry: false});
  }
  async function close() {
    assert.equal(cleanupStarted, false);
    cleanupStarted = true;
    const receipts = {}, failures = [];
    // Each containment step runs even if an earlier provider or the journal failed.
    function note(value) {
      try { record(value); } catch { if (!failures.includes("journal")) failures.push("journal"); }
    }
    async function stage(name, action) {
      try {
        await budget.beginCleanup(name);
        receipts[name] = await action();
        note({phase: name + "-closed", receipt: receipts[name]});
      } catch { failures.push(name); }
    }
    await stage("file", async () => {
      if (!grantAttempted) return {attempted: false};
      const metadata = await owner.read();
      if (metadata.filePermissions.some(p => p.id === PERMISSION)) {
        validateMetadata(metadata, true);
        assert.equal(authority(metadata), authority(baseline.after));
        await channel.remove(PERMIT, {assertActive: budget.assertStage});
      }
      const clean = await owner.read();
      validateMetadata(clean, false);
      assert.equal(authority(clean), authority(baseline.after));
      assert.equal(nativeUncertain, false, "native_grant_settlement_unverified");
      let denialStatus = null;
      if (issued) {
        assert.ok(positive && nowMillis() < expiry);
        denialStatus = (await writer.probe()).status;
        assert.ok([403, 404].includes(denialStatus) && nowMillis() < expiry);
      }
      return {verified: true, denialStatus};
    });
    await stage("iam", async () => {
      if (!enabled) return {attempted: false};
      const errors = [];
      try {
        if (iamGrantAttempted) {
          // A stale empty policy immediately after a grant does not prove absence.
          // Read the exact grant before removing it with its own version precondition.
          const granted = await identity(false, [grant], []);
          const next = removeOwnGrant(granted.policy, grant);
          assert.deepEqual(next.bindings, []);
          note({phase: "conditional-remove-intent", grant});
          await iam.setPolicy(next);
        }
      } catch { errors.push("remove"); }
      try {
        note({phase: "disable-intent", identity: IDENTITY});
        await iam.disableOwned();
      } catch { errors.push("disable"); }
      try { await identity(true, [], [grant]); await isolation(); } catch { errors.push("verify"); }
      if (!enableVerified) errors.push("enable-settlement");
      assert.deepEqual(errors, []);
      return {verified: true, disabled: true, isolated: true};
    });
    writer?.close();
    await stage("oauth", async () => {
      const result = await owner.close();
      assert.equal(result.verified, true);
      const last = result.attempts.at(-1);
      assert.equal(last.drive, 401);
      assert.equal(last.sheets, 401);
      return {verified: true, revocationStatus: result.revocationStatus, drive: last.drive, sheets: last.sheets};
    });
    try { budget.complete(); } catch { failures.push("time-budget"); }
    return {verified: failures.length === 0, receipts, failures};
  }
  async function verifyIdle() {
    current();
    await identity(true, []);
    await isolation();
    current();
  }
  return {capture, verifyIdle, acquire, issue, submit, close};
}

module.exports = {createSheetsContinuationAccess, IDENTITY};
