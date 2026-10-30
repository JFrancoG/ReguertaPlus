"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {EventEmitter} = require("node:events");
const {test} = require("node:test");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {prepare, bind, runSession, PROJECT, EMAIL, DEMO, HOST} = require("../scripts/prepare-develop-writer-rehearsal.cjs");
const {createProvider, createOwnerControls, createChildRunner} = require("../scripts/develop-writer-copy-provider.cjs");
const ORIGINAL = "1O7VKs7S4wZHVvTfNBehAd5EzF3Mgw2q9LweK68Gm76A";
const NOW = 1793352000000;
const clone = structuredClone;

function fixture() {
  const state = {now: NOW, policy: {version: 3, etag: "version-1", bindings: []}, disabled: false,
    keys: [], projectBindings: [], copyPermission: true, calls: [], records: [], mintCount: 0};
  const input = {approval: {kind: "authorized-single-synthetic-copy-rehearsal", receiptId: "fixture-approval",
    preparationDigest: prepare().preparationDigest}, identity: {email: EMAIL, uniqueId: "100000000000000000001"},
    copy: {fileId: "synthetic-copy-only", permissionId: "synthetic-writer-id", parentId: "synthetic-parent-id",
      ownerEmail: "testplusprojects@gmail.com", ownerPermissionId: "synthetic-owner-id", baselineDigest: digest({synthetic: true})},
    protectedWorkbookIds: [ORIGINAL, "protected-production-id"], window: {startsAtMillis: NOW - 1000, endsAtMillis: NOW + 599000},
    owner: {receiptId: "fixture-owner-confirmation", confirmedAtMillis: NOW - 100,
      onlineClosedNoOfflineEdits: true, noManualOrAutomationWrites: true, noAdditionalTokenMinting: true}};
  const provider = {
    async readIdentity() { return {account: {...input.identity, disabled: state.disabled}, keys: {keys: clone(state.keys)},
      policy: clone(state.policy), projectPolicy: {bindings: clone(state.projectBindings)}, project: {projectId: PROJECT}}; },
    async setPolicy(policy) {
      assert.equal(policy.etag, state.policy.etag, "No lost policy update");
      state.calls.push("set-policy"); state.policy = {...clone(policy), etag: state.policy.etag + "-next"};
    },
    async mint(body) { assert.deepEqual(body, prepare().tokenRequest); state.mintCount++;
      return {accessToken: "synthetic-secret", expireTime: new Date(state.now + 300000).toISOString()}; },
    async probeCopy(token) { assert.equal(token, "synthetic-secret"); state.calls.push("probe-copy");
      return state.copyPermission ? {status: 200, id: input.copy.fileId} : {status: 404}; },
    async disableOwned() { state.calls.push("disable"); state.disabled = true; },
    async probeMintDenied() { state.calls.push("probe-mint"); assert.ok(state.disabled); return 403; },
  };
  const review = {originalTabsDigest: input.copy.baselineDigest, workbookId: input.copy.fileId,
    ownerEmail: input.copy.ownerEmail, ownerPermissionId: input.copy.ownerPermissionId,
    runtimeEmail: EMAIL, runtimePermissionId: input.copy.permissionId, expectedRows: 10, requests: 45};
  const context = {runnerSourceDigest: prepare().runnerSourceDigest, runnerInstanceId: "copy-runner:develop-writer-identity-v1",
    runnerStartedAtMillis: NOW - 10, lockNonceDigest: digest("synthetic-lock")};
  const completed = {kind: "completed", submitted: 1, preservedOriginalTabs: 7, expectedRows: 10};
  const args = {input, provider, async verifyOwnerCopy() {}, nowMillis: () => state.now,
    async record(kind, body) { state.records.push({kind, body: clone(body)}); },
    async removeCopyPermission(value) { assert.deepEqual(value, {fileId: input.copy.fileId, permissionId: input.copy.permissionId});
      state.calls.push("remove-copy"); state.copyPermission = false; },
    async runChild(ports) { await ports.openSession(context); await ports.readIdentity(); await ports.reviewPlan(review); return completed; }};
  return {args, state, review, context, completed};
}

async function run(f) {
  const previous = {GCLOUD_PROJECT: process.env.GCLOUD_PROJECT, FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST};
  Object.assign(process.env, {GCLOUD_PROJECT: DEMO, FIRESTORE_EMULATOR_HOST: HOST});
  try { return await runSession(f.args); }
  finally { for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  } }
}

test("offline preparation emits seven synthetic grids and disabled activation flags", () => {
  const p = prepare();
  assert.equal(p.workbookCreate.sheets.length, 7);
  assert.equal(new Set(p.workbookCreate.sheets.map(s => s.properties.sheetId)).size, 7);
  for (const s of p.workbookCreate.sheets) {
    assert.deepEqual(s.properties.gridProperties, {rowCount: 20, columnCount: 6});
    assert.equal(s.data[0].rowData[0].values[0].userEnteredValue.stringValue, "ENSAYO SIN DATOS REALES");
  }
  assert.equal(p.canProvision || p.canExecute || p.canEnterMaintenance, false);
  assert.equal(p.tokenRequest.lifetime, "300s"); assert.equal(p.tokenRequest.scope.length, 2);
  assert.equal(JSON.stringify(p).includes("accessToken"), false);
});

test("invalid approval, source, owner, original destination and stale window stop before provider calls", () => {
  for (const change of [
    v => { v.approval.kind = "preparation-only"; }, v => { v.approval.preparationDigest = digest("stale-source"); },
    v => { v.copy.fileId = ORIGINAL; }, v => { v.copy.ownerEmail = "another@example.test"; },
    v => { v.window.endsAtMillis = NOW; }, v => { v.window.endsAtMillis = NOW + 600001; },
    v => { v.owner.noAdditionalTokenMinting = false; }, v => { v.copy.baselineDigest += "bad"; },
  ]) { const f = fixture(); change(f.args.input); assert.throws(() => bind(f.args.input, NOW)); assert.deepEqual(f.state.calls, []); }
});

test("one mint, reviewed batch and same unexpired-token denial finish with no grant or file access", async () => {
  const f = fixture(); const result = await run(f);
  assert.equal(result.kind, "completed-and-contained"); assert.equal(f.state.mintCount, 1);
  assert.deepEqual(f.state.policy.bindings, []); assert.equal(f.state.disabled, true); assert.equal(f.state.copyPermission, false);
  assert.deepEqual(f.state.calls.slice(-5), ["remove-copy", "probe-copy", "set-policy", "disable", "probe-mint"]);
  assert.equal(JSON.stringify(f.state.records).includes("synthetic-secret"), false);
  assert.equal(result.canRetry || result.canEnterMaintenance, false);
  const grant = f.state.records[0].body.binding;
  assert.equal(grant.role, "roles/iam.workloadIdentityUser");
  assert.deepEqual(grant.members, ["user:drpuerk@gmail.com"]); assert.match(grant.condition.expression, /request.time >=/);
});

test("duplicate token attempt is refused and an uncertain mint is never retried", async () => {
  for (const uncertain of [false, true]) {
    const f = fixture();
    if (uncertain) f.args.provider.mint = async () => { f.state.mintCount++; throw Error("response lost"); };
    f.args.runChild = async ports => { await ports.openSession(f.context); await ports.openSession(f.context); };
    const result = await run(f); assert.equal(result.kind, "inspection_required");
    assert.equal(f.state.mintCount, 1); assert.equal(f.state.disabled, true); assert.deepEqual(f.state.policy.bindings, []);
  }
});

test("a changed baseline prevents review and an uncertain write remains inspect-only after cleanup", async () => {
  for (const uncertainWrite of [false, true]) {
    const f = fixture(); let batches = 0;
    f.args.runChild = async ports => {
      await ports.openSession(f.context);
      await ports.reviewPlan({...f.review, ...(uncertainWrite ? {} : {originalTabsDigest: digest("drift")})});
      batches++; throw Error("SDK response lost after submission");
    };
    const result = await run(f); assert.equal(result.kind, "inspection_required");
    assert.equal(batches, uncertainWrite ? 1 : 0); assert.equal(result.canRetry, false);
    assert.equal(f.state.disabled, true); assert.equal(f.state.copyPermission, false);
  }
});

test("cleanup preserves concurrent foreign grants and reports unresolved authority", async () => {
  const f = fixture(), normal = f.args.runChild;
  f.args.runChild = async ports => {
    const result = await normal(ports);
    f.state.policy.bindings[0].members.push("user:concurrent@example.test");
    f.state.policy.bindings.push({role: "roles/viewer", members: ["user:another@example.test"]});
    f.state.policy.etag = "concurrent-update"; return result;
  };
  const result = await run(f);
  assert.equal(result.kind, "inspection_required"); assert.equal(f.state.disabled, true);
  assert.deepEqual(f.state.policy.bindings[0].members, ["user:concurrent@example.test"]);
  assert.equal(f.state.policy.bindings[1].role, "roles/viewer");
  assert.ok(result.cleanupFailures.includes("terminal_identity_denial_unproven"));
});

test("ACL removal failure and IAM conflict do not suppress account containment or erase foreign updates", async () => {
  const f = fixture(), set = f.args.provider.setPolicy;
  f.args.removeCopyPermission = async () => { throw Error("owner channel unavailable"); };
  f.args.provider.setPolicy = async policy => {
    if (f.state.mintCount) throw Error("CAS conflict");
    return set(policy);
  };
  const result = await run(f); assert.equal(result.kind, "inspection_required"); assert.equal(f.state.disabled, true);
  assert.ok(result.cleanupFailures.includes("copy_access_denial_unproven"));
  assert.ok(result.cleanupFailures.includes("iam_binding_removal_unproven"));
  assert.equal(f.state.policy.bindings.length, 1);
});

test("expiry never masquerades as an effective permission-removal denial", async () => {
  const f = fixture(), remove = f.args.removeCopyPermission;
  f.args.removeCopyPermission = async value => { await remove(value); f.state.now += 300001; };
  const result = await run(f); assert.equal(result.kind, "inspection_required");
  assert.ok(result.cleanupFailures.includes("copy_access_denial_unproven")); assert.equal(f.state.disabled, true);
});

test("an unverified account is never modified or disabled by cleanup", async () => {
  const f = fixture(), read = f.args.provider.readIdentity;
  f.args.provider.readIdentity = async () => { const value = await read(); value.account.uniqueId = "99999999999999"; return value; };
  const result = await run(f); assert.equal(result.kind, "inspection_required"); assert.deepEqual(f.state.calls, []);
  assert.equal(f.state.mintCount, 0); assert.equal(f.state.disabled, false);
});

test("project-role drift during the session blocks admission and still contains the owned identity", async () => {
  const f = fixture();
  f.args.runChild = async ports => { await ports.openSession(f.context);
    f.state.projectBindings.push({role: "roles/editor", members: [`serviceAccount:${EMAIL}`]});
    await ports.readIdentity(); throw Error("unreachable"); };
  const result = await run(f); assert.equal(result.kind, "inspection_required"); assert.equal(f.state.disabled, true);
});

test("a forged successful child result cannot replace mint and reviewed-plan receipts", async () => {
  const f = fixture(); f.args.runChild = async () => f.completed;
  assert.equal((await run(f)).kind, "inspection_required");
});

test("exact transport binds resource URLs and scopes without exposing provider error bodies", async () => {
  const f = fixture(), calls = [];
  const provider = createProvider({identity: f.args.input.identity, copyFileId: f.args.input.copy.fileId,
    protectedWorkbookIds: f.args.input.protectedWorkbookIds, iamBearer: "synthetic-parent-bearer",
    async fetchImpl(url, options) {
      calls.push({url, options});
      if (url.endsWith(f.args.input.identity.uniqueId)) return {status: 200, json: async () => ({...f.args.input.identity})};
      return {status: 403, json: async () => ({message: "never-surface-provider-secret"})};
    }});
  await assert.rejects(provider.mint({...prepare().tokenRequest, lifetime: "3600s"})); assert.equal(calls.length, 0);
  await assert.rejects(provider.mint(prepare().tokenRequest), error => !error.message.includes("never-surface"));
  assert.equal(calls.length, 1); assert.match(calls[0].url, /projects\/-\/serviceAccounts\/100000000000000000001:generateAccessToken$/);
  assert.equal(JSON.parse(calls[0].options.body).delegates, undefined);
  assert.deepEqual(await provider.probeCopy("synthetic-copy-token"), {status: 403, id: null});
  assert.equal(calls[1].url, "https://www.googleapis.com/drive/v3/files/synthetic-copy-only?fields=id");
  assert.equal(calls[1].options.headers.Authorization, "Bearer synthetic-copy-token");
  await assert.rejects(provider.disableOwned(), /Scoped provider operation failed/);
  assert.equal(calls.at(-1).url.endsWith(f.args.input.identity.uniqueId + ":disable"), true);
});

// The transport double responds exactly like IPC and exits only after the review
// reply. It checks credential isolation and that a negative review never releases a batch.
for (const rejectReview of [false, true]) test(`child IPC awaits parent review (rejected=${rejectReview})`, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "writer-parent-ipc-"));
  const f = fixture(); let sentBatch = false, calls = 0;
  try {
    const runChild = createChildRunner({outputDirectory: path.join(root, "run"), expectedRunnerDigest: prepare().runnerSourceDigest,
      spawnChild(_script, _args, options) {
        assert.equal(options.env.GOOGLE_APPLICATION_CREDENTIALS, undefined);
        assert.equal(options.env.HOME, undefined); assert.equal(options.env.GCLOUD_PROJECT, DEMO);
        const child = new EventEmitter(); child.connected = true; child.pid = 1234;
        child.kill = () => { child.connected = false; child.emit("exit", 1, "SIGTERM"); };
        child.send = reply => {
          if (reply.error) { child.connected = false; setImmediate(() => child.emit("exit", 1, null)); return; }
          if (reply.id === 1) setImmediate(() => child.emit("message", {type: "review-copy-plan", id: 2, data: f.review}));
          if (reply.id === 2) { sentBatch = true; setImmediate(() => {
            child.emit("message", {type: "result", data: f.completed});
            setImmediate(() => { child.connected = false; child.emit("exit", 0, null); });
          }); }
        };
        setImmediate(() => child.emit("message", {type: "open-copy-session", id: 1, data: {...f.context, pid: 1234}}));
        return child;
      }});
    const execution = runChild({packet: {demoProjectId: DEMO, requireParentPlanReview: true,
      ownerConfirmation: {endsAtMillis: Date.now() + 10000}},
    async openSession() { calls++; return {}; }, async reviewPlan() {
      assert.equal(sentBatch, false); if (rejectReview) throw Error("rejected");
    }});
    if (rejectReview) await assert.rejects(execution, /requires inspection/); else assert.deepEqual(await execution, f.completed);
    assert.equal(calls, 1); assert.equal(sentBatch, !rejectReview);
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});


test("owner cleanup verifies the exact copy, parent and writer; drift never deletes a permission", async () => {
  for (const drift of [false, true]) {
    const f = fixture(), copy = f.args.input.copy, calls = [];
    const controls = createOwnerControls({copy, protectedWorkbookIds: f.args.input.protectedWorkbookIds,
      ownerBearer: "synthetic-owner-token", async fetchImpl(url, options) {
        calls.push({url, options});
        assert.equal(options.headers.Authorization, "Bearer synthetic-owner-token");
        const data = url.includes("/permissions/") ? {id: copy.permissionId, type: "user", role: "writer", emailAddress: EMAIL} :
          {id: copy.fileId, mimeType: "application/vnd.google-apps.spreadsheet", trashed: false,
            parents: [drift ? "changed-parent" : copy.parentId],
            owners: [{emailAddress: copy.ownerEmail, permissionId: copy.ownerPermissionId}], capabilities: {canShare: true}};
        return {status: options.method === "DELETE" ? 204 : 200, json: async () => data};
      }});
    const remove = controls.remove({fileId: copy.fileId, permissionId: copy.permissionId});
    if (drift) await assert.rejects(remove); else await remove;
    assert.equal(calls.filter(c => c.options.method === "DELETE").length, drift ? 0 : 1);
    assert.ok(calls.every(c => c.url.startsWith("https://www.googleapis.com/drive/v3/files/" + copy.fileId)));
  }
});

test("an IPC error waits for child termination before releasing the parent for cleanup", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "writer-parent-error-"));
  let terminated = false;
  try {
    const runChild = createChildRunner({outputDirectory: path.join(root, "run"), expectedRunnerDigest: prepare().runnerSourceDigest,
      spawnChild() {
        const child = new EventEmitter(); child.pid = 1234; child.connected = true;
        child.kill = signal => { assert.equal(signal, "SIGTERM"); setImmediate(() => {
          terminated = true; child.connected = false; child.emit("exit", 1, "SIGTERM");
        }); };
        setImmediate(() => child.emit("error", Error("synthetic IPC failure")));
        return child;
      }});
    await assert.rejects(runChild({packet: {demoProjectId: DEMO, requireParentPlanReview: true,
      ownerConfirmation: {endsAtMillis: Date.now() + 10000}}}), /requires inspection/);
    assert.equal(terminated, true);
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});
