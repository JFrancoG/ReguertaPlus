"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {createHash} = require("node:crypto");
const {spawnSync} = require("node:child_process");
const {prepareDevelopRulesPause: prepare, BASELINE_SHA256, CANDIDATE_SHA256} =
  require("../scripts/prepare-develop-rules-pause.cjs");
const baseline = fs.readFileSync(path.join(__dirname, "firestore/fixtures/develop-writer-controls-baseline.rules"), "utf8");
const candidate = fs.readFileSync(path.resolve(__dirname, "../../firestore.develop-writer-controls.rules"));
const releaseName = "projects/reguerta-9f27f/releases/cloud.firestore";
const rulesetName = "projects/reguerta-9f27f/rulesets/fixture-baseline";
const hash = (value) => createHash("sha256").update(value).digest("hex");
function capture() {
  return {schemaVersion: 1, projectId: "reguerta-9f27f", capturedAt: "2026-10-28T12:00:00Z",
    release: {name: releaseName, rulesetName, createTime: "2023-01-01T00:00:00Z", updateTime: "2026-08-17T21:58:31.096797Z"},
    ruleset: {name: rulesetName, createTime: "2026-08-17T21:58:30.685391Z",
      source: {files: [{name: "firestore.phase1.rules", content: baseline, fingerprint: "provider-fingerprint"}]},
      metadata: {services: ["cloud.firestore"]}}};
}
function withFiles(operation) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "develop-rules-pause-"));
  const input = path.join(folder, "capture.json"), source = path.join(folder, "candidate.rules"), output = path.join(folder, "packet");
  fs.writeFileSync(input, JSON.stringify(capture()));
  fs.writeFileSync(source, candidate);
  const args = {captureFile: input, candidateFile: source, outputDirectory: output};
  try { return operation({args, input, source, output, folder}); }
  finally { fs.rmSync(folder, {recursive: true, force: true}); }
}
const errorCode = (expected) => (error) => error.code === expected && error.message === expected;

test("the private packet pins captured release/source and contains only a default-database Rules deployment", () => withFiles(({args, output}) => {
  const manifest = prepare(args);
  assert.equal(manifest.canApply, false);
  assert.equal(manifest.releaseName, releaseName);
  assert.equal(manifest.baselineSha256, BASELINE_SHA256);
  assert.equal(manifest.candidateSha256, CANDIDATE_SHA256);
  assert.deepEqual(manifest.priorRelease, capture().release);
  assert.deepEqual(manifest.requiredDeployment, {projectId: "reguerta-9f27f", config: "firebase.rules-only.json",
    only: "firestore:rules", functionsChanges: 0, storageChanges: 0, indexChanges: 0});
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(output, "firebase.rules-only.json"))),
    {firestore: {database: "(default)", rules: "candidate.rules"}});
  assert.equal(fs.readFileSync(path.join(output, "baseline.rules"), "utf8"), baseline);
  assert.deepEqual(fs.readFileSync(path.join(output, "candidate.rules")), candidate);
  assert.equal(fs.statSync(output).mode & 0o777, 0o700);
  assert.equal(fs.statSync(path.join(output, "manifest.json")).mode & 0o777, 0o600);
  for (const file of manifest.files) {
    const copied = fs.readFileSync(path.join(output, file.path));
    assert.equal(hash(copied), file.sha256);
    assert.equal(copied.length, file.bytes);
    assert.equal(fs.statSync(path.join(output, file.path)).mode & 0o777, 0o600);
  }
  assert.equal(manifest.checks.freshBeforeReleaseAndSourceRequired, true);
  assert.equal(manifest.checks.ownAfterReleaseAndCandidateHashRequired, true);
  assert.equal(manifest.checks.publisherCompareAndPatchIsCAS, false);
  assert.equal(manifest.checks.baselineRestoreAllowed, false);
  assert.equal(manifest.checks.automaticReopenAllowed, false);
  assert.equal(manifest.checks.ttlReopenAllowed, false);
  assert.equal(manifest.checks.legacyDrainProven, false);
}));

test("a changed captured baseline is rejected before output creation", () => withFiles(({args, input, output}) => {
  const value = capture(); value.ruleset.source.files[0].content += "\n";
  fs.writeFileSync(input, JSON.stringify(value));
  assert.throws(() => prepare(args), errorCode("baseline_source_drift"));
  assert.equal(fs.existsSync(output), false);
}));

test("another project, named database release, service or mismatched ruleset cannot produce a packet", () => {
  for (const [mutate, code] of [
    [(value) => { value.projectId = "other-project"; }, "capture_project_invalid"],
    [(value) => { value.release.name += "/another-database"; }, "capture_release_invalid"],
    [(value) => { value.release.rulesetName = "projects/other/rulesets/fixture-baseline"; }, "capture_release_invalid"],
    [(value) => { value.ruleset.name += "-changed"; }, "capture_ruleset_mismatch"],
    [(value) => { value.ruleset.metadata.services = ["firebase.storage"]; }, "capture_service_invalid"],
  ]) withFiles(({args, input, output}) => {
    const value = capture(); mutate(value); fs.writeFileSync(input, JSON.stringify(value));
    assert.throws(() => prepare(args), errorCode(code));
    assert.equal(fs.existsSync(output), false);
  });
});

test("malformed chronology and incomplete REST source are rejected", () => {
  for (const [mutate, code] of [
    [(value) => { value.capturedAt = "2026-02-30T12:00:00Z"; }, "capture_time_invalid"],
    [(value) => { value.release.updateTime = "2027-01-01T00:00:00Z"; }, "capture_time_invalid"],
    [(value) => { delete value.ruleset.source.files[0].content; }, "capture_fields_invalid"],
    [(value) => { value.ruleset.source.files.push(value.ruleset.source.files[0]); }, "capture_source_invalid"],
    [(value) => { value.canApply = true; }, "capture_fields_invalid"],
  ]) withFiles(({args, input, output}) => {
    const value = capture(); mutate(value); fs.writeFileSync(input, JSON.stringify(value));
    assert.throws(() => prepare(args), errorCode(code));
    assert.equal(fs.existsSync(output), false);
  });
});

test("double guards, unreviewed production semantics and comment changes are rejected", () => {
  for (const mutate of [
    (value) => value.replace('env != "develop" &&', 'env != "develop" && env != "develop" &&'),
    (value) => value.replace('return env in ["develop", "production"];', 'return env == "develop";'),
    (value) => value.replace('env != "develop" &&', ''),
    (value) => "// Different reviewed scope\n" + value,
  ]) withFiles(({args, source, output}) => {
    fs.writeFileSync(source, mutate(candidate.toString("utf8")));
    assert.throws(() => prepare(args), errorCode("candidate_source_drift"));
    assert.equal(fs.existsSync(output), false);
  });
});

test("an existing export directory/config is never overwritten", () => withFiles(({args, output}) => {
  fs.mkdirSync(output); const config = path.join(output, "firebase.rules-only.json");
  const original = Buffer.from('{"unrelated":"existing configuration"}\n');
  fs.writeFileSync(config, original);
  assert.throws(() => prepare(args), errorCode("output_exists"));
  assert.deepEqual(fs.readFileSync(config), original);
  assert.deepEqual(fs.readdirSync(output), ["firebase.rules-only.json"]);
}));

test("a completed packet is immutable to a second preparation", () => withFiles(({args, output}) => {
  prepare(args); const manifest = fs.readFileSync(path.join(output, "manifest.json"));
  assert.throws(() => prepare(args), errorCode("output_exists"));
  assert.deepEqual(fs.readFileSync(path.join(output, "manifest.json")), manifest);
}));

test("the CLI emits only private preparation metadata and never publishes or reopens", () => withFiles(({input, source, output}) => {
  const script = path.resolve(__dirname, "../scripts/prepare-develop-rules-pause.cjs");
  const result = spawnSync(process.execPath, [script, "--capture", input, "--candidate", source, "--output", output], {encoding: "utf8"});
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {packetWritten: true, canApply: false, only: "firestore:rules", baselineRestoreAllowed: false});
  assert.equal(result.stdout.includes(rulesetName), false);
}));
