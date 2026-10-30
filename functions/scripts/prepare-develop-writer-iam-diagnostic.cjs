"use strict";

// Offline by default. Live composition must inject caller credentials and a new approval.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {prepare, grantFor, removeOwnGrant, checkIdentity, safeProviderReason, PROJECT, EMAIL} =
  require("./prepare-develop-writer-rehearsal.cjs");

function prepareDiagnostic(identity) {
  assert.deepEqual(Object.keys(identity).sort(), ["email", "uniqueId"]);
  assert.equal(identity.email, EMAIL); assert.match(identity.uniqueId, /^\d{10,30}$/);
  const previous = prepare();
  const value = {kind: "develop-writer-iam-only-preparation", projectId: PROJECT, identity,
    sourceDigest: digest(fs.readFileSync(__filename, "utf8")), parentPreparationDigest: previous.preparationDigest,
    caller: "user:drpuerk@gmail.com", role: "roles/iam.workloadIdentityUser",
    maximumWindowSeconds: 600, mintReadiness: previous.mintReadiness, tokenRequest: previous.tokenRequest,
    lifecycleObservation: {maximumWaitSeconds: 60, pollSeconds: 5},
    minimumGrantAgeSeconds: 120,
    maximumMintAttempts: 1, useIssuedToken: false, ownerOAuthRequired: false, workbookAccess: false,
    canExecute: false, canRetry: false, canEnterMaintenance: false,
    approvalTemplate: {kind: "authorized-single-iam-diagnostic", authorized: false, receiptId: null,
      preparationDigest: null, confirmedAtMillis: null, endsAtMillis: null}};
  return {...value, preparationDigest: digest(value)};
}

function bindDiagnostic(input, now) {
  const prepared = prepareDiagnostic(input.identity), a = input.approval;
  assert.equal(a?.authorized, true); assert.equal(a.kind, prepared.approvalTemplate.kind);
  assert.match(a.receiptId, /^[A-Za-z0-9_-]{6,128}$/);
  assert.equal(a.preparationDigest, prepared.preparationDigest);
  assert.ok([now, a.confirmedAtMillis, a.endsAtMillis].every(Number.isSafeInteger));
  assert.ok(a.confirmedAtMillis <= now && now + 360000 < a.endsAtMillis);
  assert.ok(a.endsAtMillis - a.confirmedAtMillis <= prepared.maximumWindowSeconds * 1000);
  return prepared;
}

// No data client, owner token, workbook ID, child process or second mint is involved.
// An exclusive local journal consumes the approval before any provider operation.
async function runDiagnostic({input, provider, journalRoot, nowMillis = Date.now,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms))}) {
  input = structuredClone(input);
  const prepared = bindDiagnostic(input, nowMillis()), a = input.approval;
  const directory = require("node:path").join(journalRoot, a.receiptId);
  fs.mkdirSync(directory, {mode: 0o700});
  const record = (name, value) => fs.writeFileSync(require("node:path").join(directory, name + ".json"),
    JSON.stringify(value, null, 2) + "\n", {flag: "wx", mode: 0o600});
  record("approval", {input, preparationDigest: prepared.preparationDigest});
  const binding = grantFor({startsAtMillis: a.confirmedAtMillis, endsAtMillis: a.endsAtMillis});
  binding.condition.title = "hu084-develop-writer-iam-only";
  binding.condition.description = "Single IAM diagnosis; issued token is never used";
  let phase = "preflight", owned = false, baselineProject = null, failure = null, mintAttempted = false;
  let tokenIssued = false, readiness = null;
  const cleanupFailures = [];
  const observations = [];
  const assertAdmission = () => {
    assert.equal(prepareDiagnostic(input.identity).preparationDigest, prepared.preparationDigest);
    assert.ok(nowMillis() >= a.confirmedAtMillis);
    assert.ok(nowMillis() + 360000 < a.endsAtMillis, "Insufficient remaining diagnostic window");
  };
  function check(observation, disabled, bindings, allowLifecycleWait = false) {
    const summary = {phase, expectedDisabled: disabled, observedDisabled: observation.account.disabled === true,
      check: "account-lifecycle", passed: false};
    observations.push(summary);
    if (!allowLifecycleWait) assert.equal(observation.account.disabled === true, disabled);
    summary.check = "identity-authority";
    // Reuse authority checks without relaxing the existing enabled-session contract.
    checkIdentity({...observation, account: {...observation.account, disabled: false}}, input, bindings);
    summary.check = "project-policy";
    if (baselineProject !== null) assert.equal(digest(observation.projectPolicy), baselineProject);
    if ((observation.account.disabled === true) !== disabled) {
      summary.check = "account-lifecycle";
      return false;
    }
    summary.passed = true;
    return true;
  }
  async function observeState(disabled, bindings, outerDeadline = a.endsAtMillis - 360000) {
    const deadline = Math.min(nowMillis() + prepared.lifecycleObservation.maximumWaitSeconds * 1000, outerDeadline);
    while (true) {
      if (!disabled) assertAdmission();
      assert.ok(nowMillis() < deadline, "Account lifecycle observation deadline exceeded");
      const observation = await provider.readIdentity();
      const matched = check(observation, disabled, bindings, true);
      assert.ok(nowMillis() < deadline, "Account lifecycle observation arrived too late");
      if (matched) return observation;
      await sleep(Math.min(prepared.lifecycleObservation.pollSeconds * 1000, deadline - nowMillis()));
    }
  }
  try {
    const before = await provider.readIdentity();
    check(before, true, []);
    baselineProject = digest(before.projectPolicy);
    assertAdmission();
    record("enable-intent", {identity: input.identity});
    owned = true; // Contain even an enable response lost after the request applied.
    phase = "enable-identity";
    await provider.enableOwned();
    phase = "grant-identity";
    const enabled = await observeState(false, []); assertAdmission();
    record("grant-intent", {binding, beforePolicy: enabled.policy});
    await provider.setPolicy({...enabled.policy, version: 3, bindings: [binding]});
    const grantedAtMillis = nowMillis();
    phase = "wait-token-permission";
    const start = nowMillis(), deadline = Math.min(start + prepared.mintReadiness.maximumWaitSeconds * 1000,
      a.endsAtMillis - prepared.mintReadiness.minimumRemainingWindowSeconds * 1000);
    while (true) {
      assertAdmission(); assert.ok(nowMillis() < deadline);
      await observeState(false, [binding], deadline);
      const ready = await provider.hasMintPermission();
      assert.equal(typeof ready, "boolean"); assert.ok(nowMillis() < deadline);
      // The advisory permission can appear before the mint service sees the grant.
      // Keep one actual mint, inside the unchanged deadline, after a minimum age.
      if (ready && nowMillis() >= grantedAtMillis + prepared.minimumGrantAgeSeconds * 1000) break;
      await sleep(Math.min(prepared.mintReadiness.pollSeconds * 1000, deadline - nowMillis()));
    }
    readiness = {waitedMillis: nowMillis() - start, grantAgeMillis: nowMillis() - grantedAtMillis,
      isAuthorizationProof: false};
    record("readiness", readiness);
    phase = "admit-mint";
    await observeState(false, [binding]); assertAdmission();
    record("mint-intent", {attempt: 1, tokenRequest: prepared.tokenRequest});
    mintAttempted = true; phase = "mint-token";
    let token = await provider.mint(prepared.tokenRequest);
    try {
      phase = "validate-token-response";
      assert.ok(typeof token?.accessToken === "string" && token.accessToken.length > 0);
      const expiry = Date.parse(token.expireTime);
      assert.ok(Number.isSafeInteger(expiry) && expiry > nowMillis() && expiry <= nowMillis() + 300000 && expiry <= a.endsAtMillis);
      tokenIssued = true;
      record("token-discarded", {expiresAtMillis: expiry, tokenUsed: false, tokenRetained: false});
    } finally { token = null; }
  } catch (error) {
    failure = {phase, httpStatus: Number.isInteger(error?.httpStatus) && error.httpStatus >= 100 && error.httpStatus <= 599 ? error.httpStatus : null,
      providerReason: safeProviderReason(error?.providerReason)};
  } finally {
    if (owned) {
      phase = "cleanup";
      try {
        const current = await provider.readIdentity();
        assert.equal(current.account.email, EMAIL); assert.equal(current.account.uniqueId, input.identity.uniqueId);
        const next = removeOwnGrant(current.policy, binding);
        if (digest(next.bindings) !== digest(current.policy.bindings ?? [])) await provider.setPolicy(next);
      } catch { cleanupFailures.push("iam_binding_removal_unproven"); }
      try { await provider.disableOwned(); } catch { cleanupFailures.push("identity_disablement_unproven"); }
      try { await observeState(true, [], nowMillis() + prepared.lifecycleObservation.maximumWaitSeconds * 1000); }
      catch { cleanupFailures.push("terminal_identity_unproven"); }
    }
  }
  const result = {kind: failure || cleanupFailures.length ? "inspection_required" : "mint-observed-and-contained",
    mintAttempted, tokenIssued, readiness, failure, cleanupFailures, observations, canRetry: false, canEnterMaintenance: false,
    provesSheetsAccess: false};
  record("terminal", result);
  return result;
}

module.exports = {prepareDiagnostic, bindDiagnostic, runDiagnostic};
if (require.main === module) {
  assert.equal(process.argv.length, 4, "Offline only: identity JSON path and fresh output path");
  const identity = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  fs.writeFileSync(process.argv[3], JSON.stringify(prepareDiagnostic(identity), null, 2) + "\n", {flag: "wx", mode: 0o600});
}
