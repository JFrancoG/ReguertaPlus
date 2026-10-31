"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {mkdtempSync, writeFileSync, readFileSync, statSync, rmSync} = require("node:fs");
const {tmpdir} = require("node:os");
const {join, resolve} = require("node:path");
const {spawnSync} = require("node:child_process");
const fixture = require("./shift-coverage-bootstrap-fixture.cjs");
const command = resolve(__dirname, "../scripts/prepare-shift-coverage-bootstrap.cjs");
const setup = (t, snapshot = fixture.snapshot(), decision = fixture.decision()) => {
  const folder = mkdtempSync(join(tmpdir(), "hu084-bootstrap-review-"));
  t.after(() => rmSync(folder, {recursive: true, force: true}));
  const capture = join(folder, "snapshot.json"), declaration = join(folder, "decision.json");
  const output = join(folder, "review.json");
  writeFileSync(capture, JSON.stringify(snapshot)); writeFileSync(declaration, JSON.stringify(decision));
  return {capture, declaration, output, run: (extra = []) => spawnSync(process.execPath,
    [command, "--snapshot", capture, "--decision", declaration, "--out", output, ...extra],
    {encoding: "utf8", timeout: 15000, env: {...process.env,
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:1", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:1",
      GCLOUD_PROJECT: "offline-command-must-never-use-a-project",
      GOOGLE_APPLICATION_CREDENTIALS: join(folder, "credentials-must-not-be-needed.json")}})};
};

test("offline review succeeds without Firebase credentials or an available server and preserves source files", (t) => {
  const f = setup(t), original = readFileSync(f.capture, "utf8"), result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout), plan = JSON.parse(readFileSync(f.output, "utf8"));
  assert.equal(summary.mode, "review-only"); assert.equal(summary.environment, "develop");
  assert.equal(summary.creates, 9); assert.equal(summary.blockers, 0);
  assert.match(summary.planDigest, /^shift-planning:v1:sha256:[a-f0-9]{64}$/);
  assert.equal(plan.planDigest, summary.planDigest);
  assert.equal(result.stdout.includes("Example"), false);
  assert.equal(statSync(f.output).mode & 0o777, 0o600);
  assert.equal(readFileSync(f.capture, "utf8"), original);
  assert.ok(plan.creates.every((row) => /\/(shiftMembershipState|shiftCoverageLedgerState)\//.test(row.path)));
});

test("a contradictory source produces a blocked review with zero creates and exit code two", (t) => {
  const snapshot = fixture.snapshot();
  snapshot.documents.push(fixture.document("develop", "users", "not-in-existing-cohort", {
    isActive: true, roles: ["member"], isCommonPurchaseManager: false,
  }));
  const f = setup(t, snapshot), result = f.run();
  assert.equal(result.status, 2, result.stderr);
  const plan = JSON.parse(readFileSync(f.output, "utf8"));
  assert.deepEqual(plan.creates, []);
  assert.ok(plan.blockers.some((row) => row.code === "bootstrap_cohort_reconciliation_required"));
});

test("review refuses apply and project flags before creating an output", (t) => {
  const f = setup(t);
  for (const args of [["--apply"], ["--project", "a-cloud-project"]]) {
    const result = f.run(args);
    assert.equal(result.status, 1);
    assert.throws(() => statSync(f.output), {code: "ENOENT"});
  }
});

test("an existing review artifact is never replaced", (t) => {
  const f = setup(t); writeFileSync(f.output, "retain existing review");
  assert.equal(f.run().status, 1);
  assert.equal(readFileSync(f.output, "utf8"), "retain existing review");
});

test("cross-environment input fails without producing a review or exposing the capture", (t) => {
  const f = setup(t, fixture.snapshot("production"), fixture.decision("develop"));
  const result = f.run();
  assert.equal(result.status, 1);
  assert.equal(result.stderr.includes("Example"), false);
  assert.throws(() => statSync(f.output), {code: "ENOENT"});
});
