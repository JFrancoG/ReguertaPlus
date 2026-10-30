"use strict";

// Exact-resource parent transport. Caller credentials are injected in memory.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {fork} = require("node:child_process");
const {prepare, PROJECT, EMAIL, DEMO, HOST} = require("./prepare-develop-writer-rehearsal.cjs");
const {runnerSourceDigest} = require("./rehearse-owner-sheets-copy.cjs");

function createProvider({identity, copyFileId, protectedWorkbookIds, iamBearer, fetchImpl = fetch}) {
  assert.equal(identity.email, EMAIL); assert.match(identity.uniqueId, /^\d{10,30}$/);
  assert.match(copyFileId, /^[A-Za-z0-9_-]{6,128}$/); assert.ok(iamBearer);
  assert.ok(protectedWorkbookIds?.length >= 2 && !protectedWorkbookIds.includes(copyFileId));
  assert.ok(protectedWorkbookIds.includes("1O7VKs7S4wZHVvTfNBehAd5EzF3Mgw2q9LweK68Gm76A"));
  const tokenRequest = prepare().tokenRequest;
  const resource = `https://iam.googleapis.com/v1/projects/${PROJECT}/serviceAccounts/${identity.uniqueId}`;
  const project = `https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT}`;
  const mintUrl = `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${identity.uniqueId}:generateAccessToken`;
  const copyUrl = `https://www.googleapis.com/drive/v3/files/${copyFileId}?fields=id`;
  async function request(url, method, body, bearer = iamBearer) {
    const response = await fetchImpl(url, {method, headers: {Authorization: `Bearer ${bearer}`, "Content-Type": "application/json"},
      ...(body === undefined ? {} : {body: JSON.stringify(body)}), signal: AbortSignal.timeout(15000)});
    // Deliberately never put response bodies, headers or raw provider errors in logs.
    let data = null;
    try { data = await response.json(); } catch { /* A non-JSON body stays unknown. */ }
    return {status: response.status, data};
  }
  async function requireSuccess(url, method = "GET", body) {
    const result = await request(url, method, body);
    if (!(result.status >= 200 && result.status < 300 && result.data)) {
      throw Object.assign(Error("Scoped provider operation failed"), {httpStatus: result.status});
    }
    return result.data;
  }
  async function verifyAccount() {
    const account = await requireSuccess(resource);
    assert.equal(account.email, EMAIL); assert.equal(account.uniqueId, identity.uniqueId);
    return account;
  }
  return {
    async readIdentity() {
      const [account, keys, policy, projectPolicy, info] = await Promise.all([
        verifyAccount(), requireSuccess(resource + "/keys?keyTypes=USER_MANAGED"),
        requireSuccess(resource + ":getIamPolicy", "POST", {options: {requestedPolicyVersion: 3}}),
        requireSuccess(project + ":getIamPolicy", "POST", {options: {requestedPolicyVersion: 3}}), requireSuccess(project),
      ]);
      return {account, keys, policy, projectPolicy, project: info};
    },
    async setPolicy(policy) {
      assert.ok(policy.etag); assert.equal(policy.version, 3);
      await verifyAccount();
      return requireSuccess(resource + ":setIamPolicy", "POST", {policy, updateMask: "bindings,etag,version"});
    },
    async mint(body) {
      assert.deepEqual(body, tokenRequest);
      return requireSuccess(mintUrl, "POST", body);
    },
    async probeCopy(bearer) {
      const r = await request(copyUrl, "GET", undefined, bearer);
      return {status: r.status, id: r.data?.id ?? null};
    },
    async disableOwned() {
      const account = await verifyAccount();
      if (!account.disabled) await requireSuccess(resource + ":disable", "POST", {});
    },
    async probeMintDenied(body) {
      assert.deepEqual(body, tokenRequest);
      return (await request(mintUrl, "POST", body)).status;
    },
  };
}

// A separate owner session removes only the writer permission created for this
// rehearsal. It is never supplied to the child or to the IAM transport.
function createOwnerControls({copy, protectedWorkbookIds, ownerBearer, fetchImpl = fetch}) {
  assert.ok(ownerBearer && protectedWorkbookIds?.length >= 2 && !protectedWorkbookIds.includes(copy.fileId));
  assert.equal(copy.ownerEmail, "testplusprojects@gmail.com");
  assert.ok(protectedWorkbookIds.includes("1O7VKs7S4wZHVvTfNBehAd5EzF3Mgw2q9LweK68Gm76A"));
  for (const key of ["fileId", "permissionId", "ownerPermissionId", "parentId"]) assert.match(copy[key], /^[A-Za-z0-9_-]{6,128}$/);
  const url = `https://www.googleapis.com/drive/v3/files/${copy.fileId}`;
  async function request(target, method = "GET") {
    const response = await fetchImpl(target, {method, headers: {Authorization: `Bearer ${ownerBearer}`},
      signal: AbortSignal.timeout(15000)});
    if (method === "DELETE") { assert.equal(response.status, 204); return null; }
    assert.equal(response.status, 200, "Owner copy control unavailable");
    return response.json();
  }
  async function verify() {
    const file = await request(url + "?fields=id,mimeType,trashed,parents,owners(emailAddress,permissionId),capabilities(canShare)");
    assert.equal(file.id, copy.fileId); assert.equal(file.mimeType, "application/vnd.google-apps.spreadsheet");
    assert.equal(file.trashed, false); assert.deepEqual(file.parents, [copy.parentId]);
    assert.deepEqual(file.owners, [{emailAddress: copy.ownerEmail, permissionId: copy.ownerPermissionId}]);
    assert.equal(file.capabilities?.canShare, true);
    const permission = await request(url + `/permissions/${copy.permissionId}?fields=id,type,role,emailAddress`);
    assert.deepEqual(permission, {id: copy.permissionId, type: "user", role: "writer", emailAddress: EMAIL});
  }
  return {verify, async remove(value) {
    assert.deepEqual(value, {fileId: copy.fileId, permissionId: copy.permissionId});
    await verify();
    await request(url + `/permissions/${copy.permissionId}`, "DELETE");
  }};
}

function createChildRunner({outputDirectory, expectedRunnerDigest, spawnChild = fork}) {
  // Must be fresh. Never overwrite an old command receipt or reuse its demo ledger.
  assert.equal(runnerSourceDigest(), expectedRunnerDigest);
  fs.mkdirSync(outputDirectory, {mode: 0o700});
  return async function runChild({packet, openSession, readIdentity, reviewPlan}) {
    assert.equal(runnerSourceDigest(), expectedRunnerDigest);
    assert.equal(packet.demoProjectId, DEMO); assert.equal(packet.requireParentPlanReview, true);
    const packetFile = path.join(outputDirectory, "packet.json");
    fs.writeFileSync(packetFile, JSON.stringify(packet), {flag: "wx", mode: 0o600});
    const env = {PATH: process.env.PATH, LANG: "C.UTF-8", GCLOUD_PROJECT: DEMO,
      FIRESTORE_EMULATOR_HOST: HOST, METADATA_SERVER_DETECTION: "none"};
    const child = spawnChild(path.join(__dirname, "rehearse-owner-sheets-copy.cjs"), [packetFile, outputDirectory],
      {execPath: process.execPath, execArgv: [], env, silent: true});
    // Raw child logs can contain SDK request configuration. Keep only typed receipts.
    child.stdout?.resume(); child.stderr?.resume();
    let result = null, opened = false, reviewed = false, protocolFailed = false, exited = false;
    let failureHttpStatus = null;
    let chain = Promise.resolve();
    const deadline = Math.max(1, Math.min(240000, packet.ownerConfirmation.endsAtMillis - Date.now()));
    const kill = setTimeout(() => { protocolFailed = true; child.kill("SIGTERM"); }, deadline);
    const hardKill = setTimeout(() => child.kill("SIGKILL"), deadline + 5000);
    child.on("message", message => {
      chain = chain.then(async () => {
        assert.equal(protocolFailed, false);
        if (message?.type === "failed") { protocolFailed = true; return; }
        if (message?.type === "result") { assert.ok(opened && reviewed && !result); result = message.data; return; }
        assert.ok(Number.isSafeInteger(message?.id));
        let value;
        if (message.type === "open-copy-session") {
          assert.ok(!exited && !opened); opened = true;
          assert.equal(message.data?.pid, child.pid);
          // Google expiry timestamps can be rounded to seconds; preserve ordering.
          await new Promise(resolve => setTimeout(resolve, 1100));
          assert.ok(!exited && !protocolFailed);
          value = await openSession(message.data);
        } else if (message.type === "read-copy-identity") {
          assert.ok(opened); value = await readIdentity();
        } else if (message.type === "review-copy-plan") {
          assert.ok(opened && !reviewed); await reviewPlan(message.data); reviewed = true;
        } else throw Error("Unexpected child protocol");
        if (child.connected) child.send({type: "reply", id: message.id, value});
      }).catch(error => {
        // Preserve only a bounded status, never provider messages or request bodies.
        if (Number.isInteger(error?.httpStatus) && error.httpStatus >= 100 && error.httpStatus <= 599) {
          failureHttpStatus = error.httpStatus;
        }
        protocolFailed = true;
        if (child.connected && Number.isSafeInteger(message?.id)) child.send({type: "reply", id: message.id, error: true});
      });
    });
    try {
      const exit = await new Promise(resolve => {
        child.once("error", () => {
          protocolFailed = true;
          if (child.pid) child.kill("SIGTERM");
          else resolve({code: null, signal: "spawn-failed"});
        });
        child.once("exit", (code, signal) => { exited = true; resolve({code, signal}); });
      });
      await chain;
      if (!(exit.code === 0 && !exit.signal && !protocolFailed && result)) {
        throw Object.assign(Error("Child outcome requires inspection"), {httpStatus: failureHttpStatus});
      }
      return result;
    } finally { clearTimeout(kill); clearTimeout(hardKill); }
  };
}
module.exports = {createProvider, createOwnerControls, createChildRunner};
if (require.main === module) { console.error("Explicit reviewed composition required; no live CLI."); process.exitCode = 1; }
