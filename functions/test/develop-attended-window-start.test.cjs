"use strict";

const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {prepareAttendedWindowStart, releaseAfterFailedStart} = require("../scripts/develop-attended-window-start.cjs");

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "develop-start-"));
  t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
  const quietFile = path.join(directory, "quiet.json");
  const quiet = {confirmed: true, observedAtMillis: 100, answerText: "synthetic-confirmation"};
  fs.writeFileSync(quietFile, JSON.stringify(quiet));
  const window = {startsAtMillis: 100, endsAtMillis: 1200100};
  const operator = {async startAndAttend(actual) {assert.deepEqual(actual, quiet); return "synthetic-prompt";}};
  const inputs = {ownerCredential: {sessionId: "fixture", bearer: "private-data", expiresAtMillis: 1300100},
    iamBearer: "private-data", firestore: {}, tab: {}};
  const deps = {directory, nowMillis: () => 101, requireOperationalReview() {}, validateOperatorInputs() {},
    validateRiskAcceptance() {}, bindActualWindow: () => ({window, quietFile, operatorMustStartBeforeMillis: 15100}),
    createOperator: () => operator};
  return {directory, quiet, window, inputs, deps, operator, file: path.join(directory, "startup-first-failure-private.json")};
}

test("records the initiating backend error before release and retains it when owner cleanup fails", async t => {
  const f = fixture(t);
  f.deps.createOperator = () => assert.equal("private-data", "different", "unreviewed backend transition");
  const entry = prepareAttendedWindowStart(f.inputs, f.deps);
  const expected = {phase: "create-operator", reason: "unreviewed-backend-transition", observedAtMillis: 101};
  await assert.rejects(entry.start(f.quiet).catch(error => releaseAfterFailedStart(error, async () => {
    assert.deepEqual(JSON.parse(fs.readFileSync(f.file)), expected);
    throw Error("private-cleanup-data");
  })), error => {
    assert.deepEqual(error.startupFailure, {...expected, recorded: true});
    assert.equal(error.ownerReleaseNeedsInspection, true);
    assert.doesNotMatch(JSON.stringify(error), /private-/);
    return true;
  });
  assert.equal(fs.statSync(f.file).mode & 0o777, 0o600);
});

test("preserves an earlier receipt and joins cleanup even when the diagnostic cannot be published", async t => {
  const f = fixture(t);
  fs.writeFileSync(f.file, "first");
  const opaque = new Proxy({}, {getOwnPropertyDescriptor() {throw Error("private-data");}});
  f.deps.createOperator = () => {throw opaque;};
  const entry = prepareAttendedWindowStart(f.inputs, f.deps);
  let released = false;
  await assert.rejects(entry.start(f.quiet).catch(error =>
    releaseAfterFailedStart(error, async () => {released = true;})), error => {
    assert.deepEqual(error.startupFailure, {phase: "create-operator", reason: "unclassified-error",
      observedAtMillis: 101, recorded: false});
    return true;
  });
  assert.equal(released, true);
  assert.equal(fs.readFileSync(f.file, "utf8"), "first");
});

test("rejects deadline expiry after constructing the operator without entering its provider path", async t => {
  const f = fixture(t);
  let attended = false;
  f.deps.nowMillis = () => 15100;
  f.deps.createOperator = () => ({startAndAttend() {attended = true;}});
  const entry = prepareAttendedWindowStart(f.inputs, f.deps);
  await assert.rejects(entry.start(f.quiet), error => error.startupFailure.reason === "start-deadline-exhausted");
  assert.equal(attended, false);
  assert.equal(JSON.parse(fs.readFileSync(f.file)).phase, "check-start-deadline");
});

test("preserves the reviewed successful start, quiet receipt, return value and one-shot guard", async t => {
  const f = fixture(t);
  const entry = prepareAttendedWindowStart(f.inputs, f.deps);
  assert.deepEqual(await entry.start(f.quiet), {operator: f.operator, first: "synthetic-prompt", window: f.window});
  await assert.rejects(entry.start(f.quiet), /Start is one-shot/);
  assert.equal(fs.existsSync(f.file), false);
});
