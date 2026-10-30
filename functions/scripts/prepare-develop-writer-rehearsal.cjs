"use strict";

// Offline preparation and explicit composition only. No ADC, CLI login or live main.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {SHIFT_PLANNING_COPY_TOKEN_SCOPES: SCOPES} = require("../lib/shift-planning-owner-sheets-copy-controls.js");
const {runnerSourceDigest} = require("./rehearse-owner-sheets-copy.cjs");
const PLAN = path.resolve(__dirname, "../../spec/shifts/hu-084-stable-shift-coverage-and-credits/develop-sheets-writer-plan.json");
const PROJECT = "reguerta-9f27f";
const EMAIL = "reguerta-develop-sheets-writer@reguerta-9f27f.iam.gserviceaccount.com";
const CALLER = "user:drpuerk@gmail.com";
const ROLE = "roles/iam.workloadIdentityUser";
const HOST = "127.0.0.1:8897";
const DEMO = "demo-reguerta-copy-writer-v1";
const id = value => typeof value === "string" && /^[A-Za-z0-9_-]{6,128}$/.test(value);

function prepare() {
  const plan = JSON.parse(fs.readFileSync(PLAN));
  assert.equal(plan.identity.email, EMAIL);
  assert.deepEqual(plan.temporaryMintGrant.scopes, SCOPES);
  assert.equal(plan.canProvision, false);
  const workbook = {properties: {title: "HU-084 — ENSAYO SINTETICO DEL ESCRITOR DEVELOP", locale: "es_ES", timeZone: "Europe/Madrid"},
    sheets: plan.copyRehearsal.initialTabTitles.map((title, index) => ({
      properties: {sheetId: 100 + index, title, gridProperties: plan.copyRehearsal.initialGrid},
      data: [{startRow: 0, startColumn: 0, rowData: [{values: [{userEnteredValue: {stringValue: plan.copyRehearsal.initialCellA1}}]}]}],
    }))};
  const value = {kind: "develop-writer-copy-execution-preparation", projectId: PROJECT, environment: "develop",
    canProvision: false, canExecute: false, canEnterMaintenance: false, planDigest: digest(plan),
    runnerSourceDigest: runnerSourceDigest(), controllerSourceDigest: digest(fs.readFileSync(__filename, "utf8")),
    providerSourceDigest: digest(fs.readFileSync(path.join(__dirname, "develop-writer-copy-provider.cjs"), "utf8")),
    accountCreate: {accountId: plan.identity.accountId, serviceAccount: {displayName: plan.identity.displayName}},
    workbookCreate: workbook, filePermissionCreate: {type: "user", role: "writer", emailAddress: EMAIL},
    tokenRequest: {scope: [...SCOPES], lifetime: "300s"},
    runtime: {runId: plan.copyRehearsal.runId, demoProjectId: DEMO, firestoreHost: HOST, mode: "execute"},
    unresolved: ["explicit-authorization", "created-copy-id-owner-parent-and-raw-baseline", "created-account-unique-id",
      "created-copy-permission-id", "fresh-owner-confirmation", "exact-UTC-window", "protected-file-ids",
      "live-controller-credentials-and-owner-permission-removal-channel"],
    inputTemplate: {
      approval: {kind: "authorized-single-synthetic-copy-rehearsal", receiptId: null, preparationDigest: null},
      identity: {email: EMAIL, uniqueId: null},
      copy: {fileId: null, permissionId: null, ownerEmail: "testplusprojects@gmail.com",
        ownerPermissionId: null, parentId: null, baselineDigest: null},
      protectedWorkbookIds: [plan.laterDevelopAdmission.workbookId, null],
      window: {startsAtMillis: null, endsAtMillis: null},
      owner: {receiptId: null, confirmedAtMillis: null, onlineClosedNoOfflineEdits: false,
        noManualOrAutomationWrites: false, noAdditionalTokenMinting: false},
    }};
  return {...value, preparationDigest: digest(value)};
}

function bind(input, now) {
  const value = structuredClone(input);
  assert.equal(value.approval?.kind, "authorized-single-synthetic-copy-rehearsal");
  assert.ok(id(value.approval.receiptId));
  assert.equal(value.approval.preparationDigest, prepare().preparationDigest, "Preparation/source changed");
  assert.equal(value.identity.email, EMAIL);
  assert.match(value.identity.uniqueId, /^\d{10,30}$/);
  assert.ok(id(value.copy.fileId) && id(value.copy.permissionId));
  assert.equal(value.copy.ownerEmail, "testplusprojects@gmail.com");
  assert.ok(id(value.copy.ownerPermissionId) && id(value.copy.parentId));
  assert.match(value.copy.baselineDigest, /^shift-planning:v1:sha256:[a-f0-9]{64}$/);
  assert.ok(Array.isArray(value.protectedWorkbookIds) && value.protectedWorkbookIds.length >= 2);
  assert.ok(value.protectedWorkbookIds.every(id));
  assert.equal(new Set(value.protectedWorkbookIds).size, value.protectedWorkbookIds.length);
  const plan = JSON.parse(fs.readFileSync(PLAN));
  assert.ok(value.protectedWorkbookIds.includes(plan.laterDevelopAdmission.workbookId));
  assert.ok(!value.protectedWorkbookIds.includes(value.copy.fileId));
  const w = value.window;
  assert.ok([w.startsAtMillis, w.endsAtMillis, value.owner.confirmedAtMillis].every(Number.isSafeInteger));
  assert.ok(w.startsAtMillis <= now && now < w.endsAtMillis && w.endsAtMillis - w.startsAtMillis <= 600000);
  assert.ok(value.owner.confirmedAtMillis >= w.startsAtMillis && value.owner.confirmedAtMillis <= now);
  for (const key of ["onlineClosedNoOfflineEdits", "noManualOrAutomationWrites", "noAdditionalTokenMinting"]) assert.equal(value.owner[key], true);
  assert.ok(id(value.owner.receiptId));
  return value;
}

function grantFor(window) {
  return {role: ROLE, members: [CALLER], condition: {title: "hu084-develop-writer-copy",
    description: "One synthetic copy; no original develop or production access",
    expression: `request.time >= timestamp("${new Date(window.startsAtMillis).toISOString()}") && request.time < timestamp("${new Date(window.endsAtMillis).toISOString()}")`}};
}

function removeOwnGrant(policy, binding) {
  return {...policy, version: 3, bindings: (policy.bindings ?? []).flatMap(item => {
    if (item.role !== binding.role || digest(item.condition ?? null) !== digest(binding.condition)) return [item];
    const members = item.members.filter(member => member !== CALLER);
    return members.length ? [{...item, members}] : [];
  })};
}

function checkIdentity(observation, owned, expectedBindings) {
  assert.equal(observation.account.email, EMAIL);
  assert.equal(observation.account.uniqueId, owned.identity.uniqueId);
  assert.notEqual(observation.account.disabled, true);
  assert.equal(observation.project.projectId, PROJECT);
  assert.equal(observation.project.parent, undefined, "Parent authority requires another review");
  assert.deepEqual(observation.keys.keys ?? [], []);
  assert.ok(observation.policy.etag, "etag required for policy CAS");
  assert.deepEqual(observation.policy.bindings ?? [], expectedBindings);
  const bindings = observation.projectPolicy.bindings ?? [];
  assert.ok(!bindings.some(b => (b.members ?? []).some(member => member === `serviceAccount:${EMAIL}` ||
    ["allUsers", "allAuthenticatedUsers"].includes(member) || member.startsWith("principalSet://"))));
  return digest({policy: observation.policy, projectPolicy: observation.projectPolicy, parent: null});
}

/** Ports are explicit and scoped to the owned identity/copy. No resource creation here.
 * runChild must resolve only after the child terminates; cleanup never infers that a
 * failed batch was not applied. The owner removal channel cannot carry the IAM token.
 */
async function runSession({input, provider, runChild, verifyOwnerCopy, removeCopyPermission, record, nowMillis = Date.now}) {
  const owned = bind(input, nowMillis()), prepared = prepare(), binding = grantFor(owned.window);
  assert.equal(process.env.GCLOUD_PROJECT, DEMO);
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, HOST);
  let mintAttempted = false, bearer = null, expiry = 0, positiveRead = false, outcome = null, baseline = null;
  let primaryFailure = null, ownedVerified = false, planReviewed = false;
  let failureDetails = null, phase = "verify-identity";
  const assertSources = () => assert.equal(prepare().preparationDigest, owned.approval.preparationDigest);
  const cleanupFailures = [];
  const packet = {schemaVersion: 1, copyWorkbookId: owned.copy.fileId, runId: prepared.runtime.runId,
    demoProjectId: DEMO, protectedWorkbookIds: owned.protectedWorkbookIds, mode: "execute",
    ownerConfirmation: {...owned.owner, ...owned.window}, requireParentPlanReview: true};
  try {
    const before = await provider.readIdentity();
    checkIdentity(before, owned, []);
    ownedVerified = true;
    phase = "verify-owner-copy";
    await verifyOwnerCopy();
    await record("grant-intent", {binding, beforePolicy: before.policy, identity: owned.identity});
    phase = "grant-identity";
    await provider.setPolicy({...before.policy, version: 3, bindings: [binding]});
    phase = "verify-grant";
    baseline = checkIdentity(await provider.readIdentity(), owned, [binding]);
    phase = "start-child";
    outcome = await runChild({packet, async openSession(context) {
      phase = "validate-token-admission";
      assert.equal(mintAttempted, false, "One mint attempt only, including uncertain failures");
      mintAttempted = true;
      assertSources();
      assert.equal(context.runnerSourceDigest, prepared.runnerSourceDigest);
      assert.equal(context.runnerInstanceId, `copy-runner:${packet.runId}`);
      assert.ok(context.runnerStartedAtMillis <= nowMillis());
      assert.ok(nowMillis() + 300000 < owned.window.endsAtMillis, "Insufficient token/cleanup window");
      assert.equal(checkIdentity(await provider.readIdentity(), owned, [binding]), baseline);
      phase = "mint-token";
      const token = await provider.mint(prepared.tokenRequest);
      phase = "validate-token-response";
      bearer = token.accessToken; expiry = Date.parse(token.expireTime);
      assert.ok(typeof bearer === "string" && bearer.length > 0);
      const issued = expiry - 300000;
      assert.ok(Number.isSafeInteger(expiry) && issued >= context.runnerStartedAtMillis && issued <= nowMillis());
      assert.ok(expiry > nowMillis() && expiry <= owned.window.endsAtMillis);
      phase = "verify-identity-after-mint";
      assert.equal(checkIdentity(await provider.readIdentity(), owned, [binding]), baseline);
      phase = "probe-copy-access";
      const probe = await provider.probeCopy(bearer);
      if (probe.status !== 200) throw Object.assign(Error("Copy read failed"), {httpStatus: probe.status});
      assert.equal(probe.id, owned.copy.fileId); positiveRead = true;
      await record("token-issued", {issuedAtMillis: issued, expiresAtMillis: expiry, tokenRetained: false});
      const authority = {schemaVersion: 1, kind: "isolated-copy-authority", runId: packet.runId,
        workbookId: packet.copyWorkbookId, protectedWorkbookIds: packet.protectedWorkbookIds,
        demoProjectId: DEMO, firestoreHost: HOST, runnerInstanceId: context.runnerInstanceId,
        runnerStartedAtMillis: context.runnerStartedAtMillis, runnerSourceDigest: context.runnerSourceDigest,
        lockNonceDigest: context.lockNonceDigest, serviceAccountEmail: EMAIL, serviceAccountUniqueId: owned.identity.uniqueId,
        drivePermissionId: owned.copy.permissionId, creationReceiptDigest: digest(owned.identity), grantPolicyDigest: baseline,
        grantStartsAtMillis: owned.window.startsAtMillis, grantExpiresAtMillis: owned.window.endsAtMillis,
        tokenIssuedAtMillis: issued, tokenExpiresAtMillis: expiry, tokenScopes: [...SCOPES], maximumEvidenceAgeMillis: 60000};
      return {accessToken: bearer, tokenExpiresAtMillis: expiry, authority};
    }, async readIdentity() {
      phase = "verify-child-identity";
      const current = await provider.readIdentity();
      assert.equal(checkIdentity(current, owned, [binding]), baseline);
      return {observedAtMillis: nowMillis(), serviceAccountEmail: EMAIL, serviceAccountUniqueId: owned.identity.uniqueId,
        serviceAccountDisabled: false, userManagedKeyCount: 0, directProjectRoleCount: 0, grantPolicyDigest: baseline};
    }, async reviewPlan(review) {
      phase = "review-batch";
      assertSources();
      assert.equal(planReviewed, false);
      assert.equal(review.originalTabsDigest, owned.copy.baselineDigest);
      assert.equal(review.workbookId, owned.copy.fileId);
      assert.equal(review.ownerEmail, owned.copy.ownerEmail);
      assert.equal(review.ownerPermissionId, owned.copy.ownerPermissionId);
      assert.equal(review.runtimeEmail, EMAIL);
      assert.equal(review.runtimePermissionId, owned.copy.permissionId);
      assert.equal(review.expectedRows, 10); assert.equal(review.requests, 45);
      assert.ok(nowMillis() < expiry && nowMillis() < owned.window.endsAtMillis);
      assert.equal(checkIdentity(await provider.readIdentity(), owned, [binding]), baseline);
      await record("reviewed-batch", review);
      planReviewed = true;
      phase = "execute-reviewed-batch";
    }});
    phase = "validate-child-outcome";
    assert.ok(mintAttempted && positiveRead && planReviewed);
    assert.equal(outcome.kind, "completed"); assert.equal(outcome.submitted, 1);
    assert.equal(outcome.preservedOriginalTabs, 7); assert.equal(outcome.expectedRows, 10);
  } catch (error) {
    primaryFailure = "session_requires_inspection";
    const status = error?.httpStatus;
    failureDetails = {phase, httpStatus: Number.isInteger(status) && status >= 100 && status <= 599 ? status : null};
  }
  finally {
    // Never clean an unverified identity. Once ownership is verified, failures
    // still require containment, including an uncertain grant or token issuance.
    if (ownedVerified) {
      try {
        await removeCopyPermission({fileId: owned.copy.fileId, permissionId: owned.copy.permissionId});
        assert.ok(positiveRead && bearer && nowMillis() < expiry, "Live-token denial cannot be established");
        const denied = await provider.probeCopy(bearer);
        assert.ok([403, 404].includes(denied.status) && nowMillis() < expiry);
        await record("copy-access-removed", {status: denied.status, originalTokenUnexpired: true});
      } catch { cleanupFailures.push("copy_access_denial_unproven"); }
      try {
        const current = await provider.readIdentity();
        assert.equal(current.account.uniqueId, owned.identity.uniqueId); assert.equal(current.account.email, EMAIL);
        assert.ok(current.policy.etag);
        const next = removeOwnGrant(current.policy, binding);
        if (digest(next.bindings) !== digest(current.policy.bindings ?? [])) await provider.setPolicy(next);
      } catch { cleanupFailures.push("iam_binding_removal_unproven"); }
      try { await provider.disableOwned(); } catch { cleanupFailures.push("identity_disablement_unproven"); }
      try {
        const terminal = await provider.readIdentity();
        assert.equal(terminal.account.email, EMAIL); assert.equal(terminal.account.uniqueId, owned.identity.uniqueId);
        assert.equal(terminal.account.disabled, true); assert.deepEqual(terminal.keys.keys ?? [], []);
        assert.deepEqual(terminal.policy.bindings ?? [], []);
        assert.ok(!(terminal.projectPolicy.bindings ?? []).some(b => b.members?.includes(`serviceAccount:${EMAIL}`)));
        assert.ok([403, 404].includes(await provider.probeMintDenied(prepared.tokenRequest)));
      } catch { cleanupFailures.push("terminal_identity_denial_unproven"); }
    }
    bearer = null;
  }
  const result = {kind: primaryFailure || cleanupFailures.length ? "inspection_required" : "completed-and-contained",
    outcome, cleanupFailures, primaryFailure, failureDetails, mintAttempted, canRetry: false, canEnterMaintenance: false};
  await record("terminal", result);
  return result;
}

module.exports = {prepare, bind, grantFor, removeOwnGrant, checkIdentity, runSession, PROJECT, EMAIL, DEMO, HOST};
if (require.main === module) {
  assert.equal(process.argv.length, 3, "Only an offline output path is accepted");
  fs.writeFileSync(process.argv[2], JSON.stringify(prepare(), null, 2) + "\n", {flag: "wx", mode: 0o600});
}
