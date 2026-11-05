"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const {mkdtempSync, writeFileSync, rmSync} = require("node:fs");
const {tmpdir} = require("node:os");
const {join} = require("node:path");
const {spawnSync} = require("node:child_process");
const {plan, submitIOSOnce} = require("../scripts/coverage-remote-push.cjs");
const destination = {projectId: "reguerta-9f27f", platform: "android",
  appId: "1:195744802339:android:65308f6405a03baaadb396", bundleId: "com.reguerta.user.debug",
  firebaseInstallationId: "fake-installation-only"};
const iosDestination = {projectId: "reguerta-9f27f", platform: "ios",
  appId: "1:195744802339:ios:3fa2544ff8ed478aadb396", bundleId: "com.plusprojects.Reguerta.debug",
  fcmToken: "private-fake-ios-token"};
test("reject release, foreign project and fanout before transport", () => {
  for (const change of [{bundleId: "com.reguerta.user"}, {projectId: "other"}, {topic: "all"},
    {fcmToken: "second-destination"}, {firebaseInstallationId: ["one", "two"]}]) {
    assert.throws(() => plan({...destination, ...change}));
  }
});
test("iOS submits exactly one targeted HTTP v1 message and accepts only its acknowledgement", async () => {
  const calls = [];
  const result = await submitIOSOnce(iosDestination, "private-fake-access-token", async (...args) => {
    calls.push(args);
    return {status: 200, json: async () => ({name: "projects/reguerta-9f27f/messages/example"})};
  });
  assert.equal(calls.length, 1);
  const [url, request] = calls[0];
  assert.equal(url, "https://fcm.googleapis.com/v1/projects/reguerta-9f27f/messages:send");
  assert.equal(request.method, "POST");
  assert.equal(request.redirect, "error");
  assert.ok(request.signal instanceof AbortSignal);
  assert.equal(request.signal.aborted, false);
  assert.deepEqual(request.headers, {Authorization: "Bearer private-fake-access-token", "Content-Type": "application/json"});
  assert.deepEqual(JSON.parse(request.body), {message: {
    token: iosDestination.fcmToken,
    notification: {title: "Ensayo HU-084", body: "Abrir cobertura de ejemplo"},
    data: {eventId: "coverage-" + "84".repeat(32), type: "shift_updated", target: "users"},
    apns: {headers: {"apns-collapse-id": "84".repeat(32)}},
  }});
  assert.deepEqual(result, {outcome: "accepted", acceptedTargetCount: 1});
});
test("iOS never retries network, timeout, redirect, server or malformed acknowledgement failures", async (t) => {
  const logs = [];
  t.mock.method(console, "log", (...args) => logs.push(args));
  t.mock.method(console, "error", (...args) => logs.push(args));
  for (const failure of [
    new TypeError(`fetch failed ${iosDestination.fcmToken}`),
    new DOMException("timed out", "TimeoutError"),
    new TypeError("unexpected redirect"),
    {status: 302, json: async () => ({})}, {status: 500, json: async () => ({})},
    {status: 503, json: async () => ({})},
    {status: 200, json: async () => { throw new SyntaxError(iosDestination.fcmToken); }},
    {status: 200, json: async () => ({name: "projects/another/messages/wrong"})},
    {status: 200, json: async () => ({name: "projects/reguerta-9f27f/messages/"})},
  ]) {
    let calls = 0;
    const result = await submitIOSOnce(iosDestination, "private-fake-access-token", async () => {
      calls++;
      if (failure instanceof Error) throw failure;
      return failure;
    });
    assert.equal(calls, 1);
    assert.equal(result.outcome, "unknown");
    assert.equal(JSON.stringify(result).includes(iosDestination.fcmToken), false);
    assert.equal(JSON.stringify(result).includes("private-fake-access-token"), false);
  }
  assert.deepEqual(logs, []);
});
test("iOS rejects unsafe destinations before any fetch and never retries a definitive rejection", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return {status: 403, json: async () => ({})}; };
  for (const value of [destination, {...iosDestination, topic: "all"},
    {...iosDestination, projectId: "other"}, {...iosDestination, bundleId: "com.plusprojects.Reguerta"}]) {
    await assert.rejects(submitIOSOnce(value, "fake-access-token", fetchImpl));
  }
  assert.equal(calls, 0);
  assert.deepEqual(await submitIOSOnce(iosDestination, "fake-access-token", fetchImpl),
    {outcome: "failed", failureCode: "fcm_http_403"});
  assert.equal(calls, 1);
});
test("iOS exposes only allowlisted provider codes and never raw error messages or destinations", async () => {
  for (const [httpStatus, status, fcmCode] of [
    [401, "UNAUTHENTICATED", "THIRD_PARTY_AUTH_ERROR"],
    [403, "PERMISSION_DENIED", undefined],
    [400, iosDestination.fcmToken, iosDestination.fcmToken],
  ]) {
    let calls = 0;
    const result = await submitIOSOnce(iosDestination, "private-fake-access-token", async () => {
      calls++;
      return {status: httpStatus, json: async () => ({error: {status, message: iosDestination.fcmToken,
        details: [{"@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError", errorCode: fcmCode}]}})};
    });
    assert.equal(calls, 1);
    assert.equal(result.outcome, "failed");
    assert.equal(result.failureCode, `fcm_http_${httpStatus}`);
    assert.equal(result.errorStatus, httpStatus === 400 ? undefined : status);
    assert.equal(result.fcmErrorCode, httpStatus === 401 ? fcmCode : undefined);
    assert.equal(JSON.stringify(result).includes(iosDestination.fcmToken), false);
  }
});
test("iOS CLI stays offline by default and an existing receipt prevents another submission", () => {
  const dir = mkdtempSync(join(tmpdir(), "hu084-ios-send-"));
  try {
    const file = join(dir, "destination.json"); writeFileSync(file, JSON.stringify(iosDestination));
    const receipt = join(dir, "receipt.json"); writeFileSync(receipt, "already-started");
    const script = require.resolve("../scripts/coverage-remote-push.cjs");
    const offline = spawnSync(process.execPath, [script, "--destination", file], {encoding: "utf8"});
    assert.equal(offline.status, 0);
    assert.equal(JSON.parse(offline.stdout).sends, 0);
    const duplicate = spawnSync(process.execPath, [script, "--destination", file, "--send",
      "--confirm-project", "reguerta-9f27f", "--receipt", receipt], {encoding: "utf8"});
    assert.equal(duplicate.status, 1);
    assert.equal((offline.stdout + duplicate.stdout + duplicate.stderr).includes(iosDestination.fcmToken), false);
  } finally { rmSync(dir, {recursive: true}); }
});
test("default CLI is offline and never reveals a destination", () => {
  const dir = mkdtempSync(join(tmpdir(), "hu084-send-"));
  try {
    const file = join(dir, "destination.json"); writeFileSync(file, JSON.stringify(destination));
    const result = spawnSync(process.execPath, [require.resolve("../scripts/coverage-remote-push.cjs"), "--destination", file], {encoding: "utf8"});
    assert.equal(result.status, 0);
    assert.equal(JSON.parse(result.stdout).sends, 0);
    assert.equal(result.stdout.includes(destination.firebaseInstallationId), false);
    const denied = spawnSync(process.execPath, [require.resolve("../scripts/coverage-remote-push.cjs"), "--destination", file, "--send"], {encoding: "utf8"});
    assert.equal(denied.status, 1);
  } finally { rmSync(dir, {recursive: true}); }
});
