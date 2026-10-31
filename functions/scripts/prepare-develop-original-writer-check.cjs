"use strict";

// Original-develop probe only. Preparation is offline; no live main or credential lookup.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {prepare: prepareCopy, grantFor, removeOwnGrant, checkIdentity, safeProviderReason} =
  require("./prepare-develop-writer-rehearsal.cjs");
const {FILE, OWNER, WRITER, PERMISSION, REQUEST, validateMetadata, metadataFingerprint} =
  require("./develop-original-writer-provider.cjs");
const PLAN = path.resolve(__dirname, "../../spec/shifts/hu-084-stable-shift-coverage-and-credits/develop-original-writer-check-plan.json");
const IDENTITY = Object.freeze({email: WRITER, uniqueId: "110752956317536684858"});
const hashPattern = /^shift-planning:v1:sha256:[a-f0-9]{64}$/;
const receiptPattern = /^[A-Za-z0-9_-]{6,128}$/;

function prepare() {
  const plan = JSON.parse(fs.readFileSync(PLAN)), previous = prepareCopy();
  assert.equal(plan.destination.fileId, FILE); assert.equal(plan.identity.uniqueId, IDENTITY.uniqueId);
  for (const flag of ["canProvision", "canExecute", "canApply", "canEnterMaintenance"]) assert.equal(plan[flag], false);
  assert.deepEqual({requests: [plan.futureProbe.request]}, REQUEST());
  assert.deepEqual(previous.tokenRequest.scope, plan.futureTemporaryPermissions.writerToken.scopes);
  const value = {kind: "original-develop-writer-check-preparation", canExecute: false, canEnterMaintenance: false,
    planDigest: digest(plan), reusedIamPreparationDigest: previous.preparationDigest,
    controllerSourceDigest: digest(fs.readFileSync(__filename, "utf8")),
    providerSourceDigest: digest(fs.readFileSync(path.join(__dirname, "develop-original-writer-provider.cjs"), "utf8")),
    identity: IDENTITY, fileId: FILE, requestDigest: digest(REQUEST()),
    tokenRequest: previous.tokenRequest, minimumGrantAgeSeconds: previous.minimumGrantAgeSeconds,
    readiness: previous.mintReadiness, lifecycle: previous.lifecycleObservation,
    cleanupReserveSeconds: 120, maximumWindowSeconds: 600,
    approvalTemplate: {kind: "authorized-single-original-develop-writer-check", authorized: false,
      receiptId: null, preparationDigest: null, startsAtMillis: null, endsAtMillis: null,
      ownerWindowReceiptId: null, ownerEmail: OWNER, onlineClosedNoOfflineEdits: false,
      noOtherWritesOrTokens: false, ownerChannelReviewDigest: null,
      controlsDigest: null, baselineMetadataDigest: null, baselineSnapshotDigest: null}};
  return {...value, preparationDigest: digest(value)};
}

function bind(input, now) {
  const prepared = prepare(), a = structuredClone(input);
  assert.deepEqual(Object.keys(a).sort(), Object.keys(prepared.approvalTemplate).sort(), "Unexpected approval field");
  assert.equal(a.kind, prepared.approvalTemplate.kind); assert.equal(a.authorized, true);
  assert.match(a.receiptId, receiptPattern); assert.match(a.ownerWindowReceiptId, receiptPattern);
  assert.equal(a.preparationDigest, prepared.preparationDigest);
  for (const key of ["ownerChannelReviewDigest", "controlsDigest", "baselineMetadataDigest", "baselineSnapshotDigest"]) assert.match(a[key], hashPattern);
  assert.equal(a.ownerEmail, OWNER); assert.equal(a.onlineClosedNoOfflineEdits, true); assert.equal(a.noOtherWritesOrTokens, true);
  assert.ok([now, a.startsAtMillis, a.endsAtMillis].every(Number.isSafeInteger));
  assert.ok(a.startsAtMillis <= now && now + 360000 < a.endsAtMillis);
  assert.ok(a.endsAtMillis - a.startsAtMillis <= 600000);
  return {a, prepared};
}

/** Native owner grant/remove callbacks are trusted operator actions bound to the
 * reviewed source digest, never an API permission inferred from read-only OAuth.
 * Each must settle after its UI action finishes; abandonment requires inspection.
 * All other ports are bounded provider readers or the existing scoped IAM transport.
 */
async function runCheck({input, iam, owner, ownerChannel, openWorkbook, readIndependentControls,
  journalRoot, nowMillis = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms))}) {
  const {a, prepared} = bind(input, nowMillis());
  assert.equal(ownerChannel.kind, "native-drive-owner-sharing");
  assert.equal(ownerChannel.reviewDigest, a.ownerChannelReviewDigest);
  // One per-file process and one consumed approval; neither can be reset on restart.
  const lock = path.join(journalRoot, "original-develop-active");
  fs.mkdirSync(lock, {mode: 0o700});
  const directory = path.join(journalRoot, a.receiptId);
  try { fs.mkdirSync(directory, {mode: 0o700}); } catch (error) { fs.rmdirSync(lock); throw error; }
  function record(name, value) {
    const fd = fs.openSync(path.join(directory, name + ".json"), "wx", 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + "\n"); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  }
  record("approval", a);
  const binding = grantFor({startsAtMillis: a.startsAtMillis, endsAtMillis: a.endsAtMillis});
  binding.condition.title = "hu084-original-develop-writer-check";
  binding.condition.description = "Single same-value original-develop header probe; temporary access";
  const permission = Object.freeze({fileId: FILE, permissionId: PERMISSION, type: "user", role: "writer", emailAddress: WRITER});
  let phase = "preflight", baseline = null, projectPolicy = null, owned = false, fileGrantAttempted = false;
  let workbook = null, expiry = 0, mintAttempted = false, writeAttempted = false, writeVerified = false;
  let positiveRead = false, failure = null;
  const cleanupFailures = [];
  const current = reserve => {
    assert.equal(prepare().preparationDigest, a.preparationDigest, "Prepared source changed");
    assert.ok(nowMillis() >= a.startsAtMillis && nowMillis() + reserve < a.endsAtMillis, "Window exhausted");
    if (expiry) assert.ok(nowMillis() + reserve < expiry, "Writer token/cleanup window exhausted");
  };
  async function controls() {
    const value = await readIndependentControls();
    assert.ok(Number.isSafeInteger(value.observedAtMillis));
    assert.ok(value.observedAtMillis <= nowMillis() && nowMillis() - value.observedAtMillis <= 60000);
    assert.equal(value.controlsDigest, a.controlsDigest);
    assert.equal(value.writerIsolated, true); assert.equal(value.developFencesHeld, true);
  }
  function identity(value, bindings) {
    checkIdentity({...value, account: {...value.account, disabled: false}}, {identity: IDENTITY}, bindings);
    if (projectPolicy) assert.equal(digest(value.projectPolicy), projectPolicy);
  }
  async function observe(disabled, bindings, outerDeadline) {
    const deadline = Math.min(nowMillis() + 60000, outerDeadline);
    while (true) {
      assert.ok(nowMillis() < deadline);
      const value = await iam.readIdentity(); identity(value, bindings);
      assert.ok(nowMillis() < deadline);
      if ((value.account.disabled === true) === disabled) return value;
      await sleep(Math.min(5000, deadline - nowMillis()));
    }
  }
  async function ownerObservation(granted) {
    const value = await owner.read(); validateMetadata(value, granted);
    assert.equal(value.file.owners[0].me, true, "Owner reader must be the named owner");
    assert.equal(value.parent.owners[0].me, true);
    if (baseline) assert.equal(metadataFingerprint(value, {omitWriter: granted, omitVersion: true}),
      metadataFingerprint(baseline, {omitVersion: true}), "Unrelated file authority changed");
    return value;
  }
  try {
    const before = await iam.readIdentity(); identity(before, []); assert.equal(before.account.disabled, true);
    projectPolicy = digest(before.projectPolicy);
    baseline = await ownerObservation(false);
    assert.equal(metadataFingerprint(baseline), a.baselineMetadataDigest);
    await controls(); current(360000);
    record("enable-intent", {identity: IDENTITY}); owned = true;
    phase = "enable"; await iam.enableOwned();
    const enabled = await observe(false, [], a.endsAtMillis - 360000); current(360000);
    phase = "iam-grant"; record("iam-grant-intent", {binding, beforePolicyDigest: digest(enabled.policy)});
    await iam.setPolicy({...enabled.policy, version: 3, bindings: [binding]});
    const grantedAt = nowMillis();
    phase = "file-grant"; current(360000);
    record("file-grant-intent", permission); fileGrantAttempted = true;
    await ownerChannel.grant(permission);
    const granted = await ownerObservation(true); current(360000);
    record("file-granted", {metadataDigest: metadataFingerprint(granted), permissionId: PERMISSION});
    phase = "readiness";
    const deadline = Math.min(grantedAt + 180000, a.endsAtMillis - 360000);
    while (true) {
      current(360000); assert.ok(nowMillis() < deadline);
      await observe(false, [binding], deadline);
      const ready = await iam.hasMintPermission();
      assert.equal(typeof ready, "boolean"); assert.ok(nowMillis() < deadline);
      if (ready && nowMillis() >= grantedAt + 120000) break;
      await sleep(Math.min(5000, deadline - nowMillis()));
    }
    phase = "mint"; await controls(); current(360000);
    await ownerObservation(true); await observe(false, [binding], a.endsAtMillis - 360000); current(360000);
    record("mint-intent", {attempt: 1, request: prepared.tokenRequest}); mintAttempted = true;
    let token = await iam.mint(prepared.tokenRequest);
    try {
      expiry = Date.parse(token.expireTime);
      assert.ok(typeof token.accessToken === "string" && token.accessToken.length > 0);
      assert.ok(Number.isSafeInteger(expiry) && expiry <= nowMillis() + 300000 && expiry > nowMillis() + 180000);
      assert.ok(expiry <= a.endsAtMillis);
      workbook = openWorkbook(token.accessToken);
    } finally { token = null; }
    record("token-issued", {expiresAtMillis: expiry, tokenRetained: false});
    phase = "positive-read";
    const access = await workbook.probeAccess(); assert.equal(access.status, 200); assert.equal(access.id, FILE); positiveRead = true;
    const ownerGranted = await ownerObservation(true);
    // The file-only writer has no permission on the owner's My Drive root.
    // Parent authority comes from the independent owner metadata reader.
    const metadata = {...ownerGranted, ...await workbook.readMetadata()}; validateMetadata(metadata, true);
    for (const capability of ["canEdit", "canModifyContent", "canShare"]) assert.equal(metadata.file.capabilities?.[capability], true);
    assert.equal(metadataFingerprint(metadata), metadataFingerprint(await ownerObservation(true)));
    const beforeCells = await workbook.readSnapshot(); assert.equal(beforeCells.digest, a.baselineSnapshotDigest);
    await controls(); await observe(false, [binding], expiry - 120000);
    assert.equal(metadataFingerprint(await ownerObservation(true)), metadataFingerprint(metadata)); current(120000);
    phase = "write"; record("write-intent", {fileId: FILE, requestDigest: prepared.requestDigest, baseline: beforeCells.digest});
    writeAttempted = true;
    // Ambiguous provider acknowledgement cannot authorize another attempt.
    try { await workbook.writeSameHeader(); }
    finally {
      phase = "post-write-observation";
      const afterCells = await workbook.readSnapshot();
      record("post-write-observation", {beforeDigest: beforeCells.digest, afterDigest: afterCells.digest});
      assert.equal(afterCells.digest, beforeCells.digest);
    }
    await ownerObservation(true); current(90000); writeVerified = true;
  } catch (error) {
    failure = {phase, httpStatus: Number.isInteger(error?.httpStatus) ? error.httpStatus : null,
      providerReason: safeProviderReason(error?.providerReason)};
  } finally {
    if (fileGrantAttempted) {
      try {
        // Inspect even an uncertain UI grant. Never remove a pre-existing permission.
        const value = await owner.read();
        const permissionNow = value.filePermissions.find(p => p.id === PERMISSION);
        if (permissionNow) {
          assert.equal(value.file.id, FILE); assert.equal(permissionNow.emailAddress, WRITER);
          assert.equal(permissionNow.role, "writer"); assert.equal(permissionNow.type, "user");
          assert.ok(!(permissionNow.permissionDetails ?? []).some(d => d.inherited));
          record("file-remove-intent", permission); await ownerChannel.remove(permission);
        }
        await ownerObservation(false);
        assert.ok(positiveRead && workbook && nowMillis() < expiry);
        const denied = await workbook.probeAccess();
        assert.ok([403, 404].includes(denied.status) && nowMillis() < expiry);
        record("file-denied", {status: denied.status, sameUnexpiredToken: true});
      } catch { cleanupFailures.push("file_removal_or_live_token_denial_unproven"); }
    }
    if (owned) {
      try {
        const value = await iam.readIdentity();
        assert.equal(value.account.email, WRITER); assert.equal(value.account.uniqueId, IDENTITY.uniqueId);
        assert.ok(value.policy.etag);
        const next = removeOwnGrant(value.policy, binding);
        if (digest(next.bindings) !== digest(value.policy.bindings ?? [])) await iam.setPolicy(next);
      } catch { cleanupFailures.push("iam_removal_unproven"); }
      try { await iam.disableOwned(); } catch { cleanupFailures.push("disable_unproven"); }
      try { await observe(true, [], nowMillis() + 60000); }
      catch { cleanupFailures.push("terminal_identity_unproven"); }
    }
    try { workbook?.close(); } catch { cleanupFailures.push("writer_session_discard_unproven"); }
    try {
      assert.deepEqual(await owner.close(), {revoked: true, sameTokenStatus: 401});
    } catch { cleanupFailures.push("owner_oauth_cleanup_unproven"); }
  }
  const result = {kind: failure || cleanupFailures.length ? "inspection_required" : "original-probe-contained",
    failure, cleanupFailures, mintAttempted, writeAttempted, writeVerified,
    canRetry: false, canEnterMaintenance: false, grantsMigrationAuthority: false};
  record("terminal", result);
  // Unproven cleanup retains the lock for manual, journal-guided recovery.
  if (cleanupFailures.length === 0) fs.rmdirSync(lock);
  return result;
}
// Real-provider composition stays opt-in; the normal CLI only emits preparation.
// No credential is read from the environment, persisted, or forwarded to owner UI.
async function runWithExplicitCredentials({input, journalRoot, iamBearer, ownerBearer, ownerChannel, readIndependentControls}) {
  bind(input, Date.now());
  assert.equal(ownerChannel.kind, "native-drive-owner-sharing");
  assert.equal(ownerChannel.reviewDigest, input.ownerChannelReviewDigest);
  const {createIamProvider} = require("./develop-writer-copy-provider.cjs");
  const {createOwnerReader, createWorkbookAccess} = require("./develop-original-writer-provider.cjs");
  const reader = createOwnerReader({ownerBearer});
  let cleanup, result;
  const close = () => cleanup ??= reader.close();
  try {
    result = await runCheck({input, journalRoot, ownerChannel, readIndependentControls,
      iam: createIamProvider({identity: IDENTITY, iamBearer}), owner: {read: reader.read, close},
      openWorkbook: writerBearer => createWorkbookAccess({writerBearer})});
    return result;
  } finally {
    // Also close a newly opened owner session if journal admission fails before
    // runCheck enters its provider lifecycle. Never revoke twice.
    try { await close(); } catch {
      if (!result) throw Error("Startup failed; owner OAuth cleanup unproven");
    }
  }
}
module.exports = {prepare, bind, runCheck, runWithExplicitCredentials, IDENTITY};
if (require.main === module) {
  assert.equal(process.argv.length, 3, "Offline only: fresh preparation output path");
  fs.writeFileSync(process.argv[2], JSON.stringify(prepare(), null, 2) + "\n", {flag: "wx", mode: 0o600});
}
