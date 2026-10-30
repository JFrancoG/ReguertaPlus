"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {test} = require("node:test");
const {prepareDiagnostic, runDiagnostic} = require("../scripts/prepare-develop-writer-iam-diagnostic.cjs");
const {createIamProvider} = require("../scripts/develop-writer-copy-provider.cjs");
const {EMAIL, PROJECT} = require("../scripts/prepare-develop-writer-rehearsal.cjs");
const NOW = 1793352000000;

function fixture(t) {
  const identity = {email: EMAIL, uniqueId: "100000000000000000001"}, prepared = prepareDiagnostic(identity);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "iam-only-diagnostic-"));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const state = {now: NOW, disabled: true, policy: {etag: "initial", version: 3, bindings: []},
    keys: [], projectBindings: [], calls: [], mintCount: 0};
  const input = {identity, approval: {...prepared.approvalTemplate, authorized: true,
    receiptId: "single-approved-diagnostic", preparationDigest: prepared.preparationDigest,
    confirmedAtMillis: NOW, endsAtMillis: NOW + 600000}};
  const provider = {
    async readIdentity() { state.calls.push("read"); return {account: {...identity, disabled: state.disabled},
      keys: {keys: structuredClone(state.keys)}, policy: structuredClone(state.policy),
      projectPolicy: {bindings: structuredClone(state.projectBindings)}, project: {projectId: PROJECT}}; },
    async enableOwned() { state.calls.push("enable"); state.disabled = false; },
    async disableOwned() { state.calls.push("disable"); state.disabled = true; },
    async setPolicy(policy) { assert.equal(policy.etag, state.policy.etag); state.calls.push("policy");
      state.policy = {...structuredClone(policy), etag: state.policy.etag + "-next"}; },
    async hasMintPermission() { state.calls.push("permission"); return true; },
    async mint(body) { assert.deepEqual(body, prepared.tokenRequest); state.calls.push("mint"); state.mintCount++;
      return {accessToken: "synthetic-secret", expireTime: new Date(state.now + 300000).toISOString()}; },
  };
  return {state, prepared, args: {input, provider, journalRoot: root, nowMillis: () => state.now,
    async sleep(ms) { state.now += ms; }},
  receipts() { const folder = path.join(root, input.approval.receiptId);
    return fs.readdirSync(folder).map(n => fs.readFileSync(path.join(folder, n), "utf8")).join("\n"); }};
}

test("offline packet has no workbook and rejects inert, stale or changed approval before provider access", async t => {
  for (const change of [a => { a.authorized = false; }, a => { a.kind = "copy-rehearsal"; },
    a => { a.preparationDigest = "stale"; }, a => { a.endsAtMillis = NOW + 360000; },
    a => { a.endsAtMillis = NOW + 600001; }, a => { a.confirmedAtMillis = NOW + 1; }]) {
    const f = fixture(t); change(f.args.input.approval);
    await assert.rejects(runDiagnostic(f.args)); assert.deepEqual(f.state.calls, []);
    assert.equal(f.prepared.canExecute || f.prepared.canEnterMaintenance || f.prepared.workbookAccess || f.prepared.ownerOAuthRequired, false);
  }
});

test("one successful mint is discarded, cleanup verified, and journal refuses reuse before any provider access", async t => {
  const f = fixture(t), result = await runDiagnostic(f.args);
  assert.equal(result.kind, "mint-observed-and-contained"); assert.equal(f.state.mintCount, 1);
  assert.equal(result.tokenIssued, true); assert.equal(result.provesSheetsAccess || result.canRetry || result.canEnterMaintenance, false);
  assert.equal(f.state.disabled, true); assert.deepEqual(f.state.policy.bindings, []);
  assert.equal(f.receipts().includes("synthetic-secret"), false);
  const count = f.state.calls.length;
  await assert.rejects(runDiagnostic(f.args), {code: "EEXIST"}); assert.equal(f.state.calls.length, count);
});

test("mint denial retains only safe reason; network ambiguity is not retried", async t => {
  for (const reason of ["IAM_PERMISSION_DENIED", "synthetic-secret", null]) {
    const f = fixture(t);
    f.args.provider.mint = async () => { f.state.mintCount++;
      throw Object.assign(Error("synthetic-secret"), {httpStatus: reason === null ? undefined : 403,
        providerReason: reason, response: {token: "synthetic-secret"}}); };
    const result = await runDiagnostic(f.args);
    assert.equal(result.kind, "inspection_required"); assert.equal(f.state.mintCount, 1);
    assert.equal(result.failure.phase, "mint-token");
    assert.equal(result.failure.providerReason, reason === "IAM_PERMISSION_DENIED" ? reason : null);
    assert.equal(f.state.disabled, true); assert.deepEqual(f.state.policy.bindings, []);
    assert.equal(f.receipts().includes("synthetic-secret"), false);
  }
});

test("foreign identity authority or an already enabled account prevents activation", async t => {
  for (const mutate of [s => { s.disabled = false; }, s => { s.keys = [{name: "foreign-key"}]; },
    s => { s.policy.bindings = [{role: "roles/viewer", members: ["user:other@example.test"]}]; },
    s => { s.projectBindings = [{role: "roles/editor", members: [`serviceAccount:${EMAIL}`]}]; }]) {
    const f = fixture(t); mutate(f.state);
    const result = await runDiagnostic(f.args);
    assert.equal(result.failure.phase, "preflight"); assert.deepEqual(f.state.calls, ["read"]);
  }
});

test("uncertain enable or grant still disables and removes only the owned binding", async t => {
  for (const phase of ["enable", "grant"]) {
    const f = fixture(t);
    if (phase === "enable") f.args.provider.enableOwned = async () => { f.state.disabled = false; throw Error("lost"); };
    else { const set = f.args.provider.setPolicy;
      f.args.provider.setPolicy = async policy => { await set(policy); if (policy.bindings.length) throw Error("lost"); }; }
    const result = await runDiagnostic(f.args);
    assert.equal(result.kind, "inspection_required"); assert.equal(f.state.mintCount, 0);
    assert.equal(f.state.disabled, true); assert.deepEqual(f.state.policy.bindings, []);
  }
});

test("readiness timeout and late positive reply abort before mint", async t => {
  for (const late of [false, true]) {
    const f = fixture(t);
    f.args.provider.hasMintPermission = async () => { if (late) f.state.now += 180000; return late; };
    const result = await runDiagnostic(f.args);
    assert.equal(result.failure.phase, "wait-token-permission"); assert.equal(f.state.mintCount, 0);
    assert.equal(f.state.now, NOW + 180000); assert.equal(f.state.disabled, true);
    assert.deepEqual(f.state.policy.bindings, []);
  }
});

test("concurrent grant is preserved, observed drift blocks mint, terminal check stays unresolved", async t => {
  const f = fixture(t), foreign = {role: "roles/viewer", members: ["user:other@example.test"]};
  f.args.provider.hasMintPermission = async () => { f.state.policy.bindings.push(foreign); return true; };
  const result = await runDiagnostic(f.args);
  assert.equal(f.state.mintCount, 0); assert.equal(f.state.disabled, true);
  assert.deepEqual(f.state.policy.bindings, [foreign]); assert.ok(result.cleanupFailures.includes("terminal_identity_unproven"));
});

test("failed cleanup is explicit and cannot be confused with successful diagnosis", async t => {
  const f = fixture(t); f.args.provider.disableOwned = async () => { throw Error("offline"); };
  const result = await runDiagnostic(f.args);
  assert.equal(result.kind, "inspection_required"); assert.equal(f.state.mintCount, 1);
  assert.deepEqual(result.cleanupFailures, ["identity_disablement_unproven", "terminal_identity_unproven"]);
});

test("lifecycle mismatch is distinguished from project authority drift without leaking policy data", async t => {
  for (const lifecycle of [true, false]) {
    const f = fixture(t);
    f.args.provider.enableOwned = async () => {
      f.state.disabled = lifecycle;
      if (!lifecycle) f.state.projectBindings.push({role: "roles/viewer", members: ["user:synthetic-secret@example.test"]});
    };
    const result = await runDiagnostic(f.args);
    assert.equal(result.failure.phase, "grant-identity"); assert.equal(f.state.mintCount, 0);
    assert.deepEqual(result.observations.find(o => o.phase === "grant-identity"), {
      phase: "grant-identity", expectedDisabled: false, observedDisabled: lifecycle,
      check: lifecycle ? "account-lifecycle" : "project-policy", passed: false,
    });
    assert.equal(f.receipts().includes("synthetic-secret"), false);
    assert.equal(f.state.disabled, true);
  }
});

test("IAM-only transport addresses exact UID with no redirect or workbook capability", async () => {
  const calls = [], identity = {email: EMAIL, uniqueId: "100000000000000000001"};
  const provider = createIamProvider({identity, iamBearer: "synthetic-secret", async fetchImpl(url, options) {
    calls.push({url, method: options.method}); assert.equal(options.redirect, "error");
    assert.ok(["iam.googleapis.com", "iamcredentials.googleapis.com", "cloudresourcemanager.googleapis.com"].includes(new URL(url).hostname));
    let data = {...identity, disabled: true};
    if (url.includes(":testIamPermissions")) data = {permissions: ["iam.serviceAccounts.getAccessToken"]};
    if (url.includes(":generateAccessToken")) data = {accessToken: "synthetic-secret"};
    return {status: 200, json: async () => data};
  }});
  assert.equal(provider.probeCopy, undefined);
  await provider.enableOwned(); await provider.hasMintPermission();
  await provider.mint(prepareDiagnostic(identity).tokenRequest); await provider.disableOwned();
  assert.equal(calls.filter(c => c.url.includes(":generateAccessToken")).length, 1);
  assert.ok(calls.every(c => c.url.includes(identity.uniqueId)));
  await assert.rejects(provider.mint({scope: ["https://www.googleapis.com/auth/cloud-platform"], lifetime: "3600s"}));
});
