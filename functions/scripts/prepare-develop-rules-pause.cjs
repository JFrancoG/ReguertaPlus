"use strict";

// Offline packaging only: no credential discovery, SDK, network or publication.
const fs = require("node:fs");
const path = require("node:path");
const {createHash} = require("node:crypto");
const PROJECT = "reguerta-9f27f";
const RELEASE = `projects/${PROJECT}/releases/cloud.firestore`;
const BASELINE_SHA256 = "bb87cdacc63dc4e285ac24d50b8f2f8c64eff3def1e4fcf24265030059591dfa";
const CANDIDATE_SHA256 = "ba2f097fefb435092c42a50a4c5c4fae5caaea0f84f9662c193590bf1f6a7438";
const HEADER = "// Preparation-only develop write fence derived from the captured deployed Rules.\n" +
  `// Baseline SHA-256: ${BASELINE_SHA256}\n` +
  "// Do not deploy from this emulator configuration. It closes all develop client writes.\n" +
  "// Restoring the permissive baseline after governed data/epoch changes is unsafe.\n";
const MAX_BYTES = 1024 * 1024;
const fail = (code) => { throw Object.assign(new Error(code), {code}); };
const check = (condition, code) => { if (!condition) fail(code); };
const hash = (value) => createHash("sha256").update(value).digest("hex");
const plain = (value) => value && typeof value === "object" && !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;
const keys = (value, required, optional = []) => check(plain(value) &&
  required.every((name) => Object.hasOwn(value, name)) &&
  Object.keys(value).every((name) => [...required, ...optional].includes(name)), "capture_fields_invalid");
function time(value) {
  check(typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(Date.parse(value)).toISOString().slice(0, 19) === value.slice(0, 19),
  "capture_time_invalid");
  return Date.parse(value);
}
function readFile(file) {
  check(typeof file === "string" && path.isAbsolute(file), "input_path_invalid");
  const info = fs.lstatSync(file);
  check(info.isFile() && info.size <= MAX_BYTES, "input_file_invalid");
  return fs.readFileSync(file);
}

function reviewedCandidate(baseline) {
  let splitCount = 0, guardCount = 0;
  let source = baseline.replace(/      allow read, write: if ([\s\S]*?);/g, (_, predicate) => {
    splitCount++;
    return `      allow read: if ${predicate};\n` +
      `      allow write: if env != "develop" && ${predicate};`;
  });
  source = source.replace(/allow (create|update|delete): if isSignedIn\(\)/g, (_, operation) => {
    guardCount++;
    return `allow ${operation}: if env != "develop" && isSignedIn()`;
  });
  check(splitCount === 2 && guardCount === 3, "baseline_transform_invalid");
  return HEADER + source;
}

/** Seal a reviewed Rules-only packet; it never authorizes or publishes a release. */
function prepareDevelopRulesPause({captureFile, candidateFile, outputDirectory}) {
  const captureBytes = readFile(captureFile), candidate = readFile(candidateFile);
  let capture;
  try { capture = JSON.parse(captureBytes.toString("utf8")); } catch { fail("capture_json_invalid"); }
  keys(capture, ["schemaVersion", "projectId", "capturedAt", "release", "ruleset"]);
  check(capture.schemaVersion === 1 && capture.projectId === PROJECT, "capture_project_invalid");
  const capturedAt = time(capture.capturedAt), release = capture.release, ruleset = capture.ruleset;
  keys(release, ["name", "rulesetName", "createTime", "updateTime"]);
  check(release.name === RELEASE && typeof release.rulesetName === "string" &&
    new RegExp(`^projects/${PROJECT}/rulesets/[A-Za-z0-9-]+$`).test(release.rulesetName), "capture_release_invalid");
  check(time(release.createTime) <= time(release.updateTime) && time(release.updateTime) <= capturedAt,
    "capture_time_invalid");
  keys(ruleset, ["name", "createTime", "source"], ["metadata"]);
  check(ruleset.name === release.rulesetName && time(ruleset.createTime) <= time(release.updateTime),
    "capture_ruleset_mismatch");
  if (ruleset.metadata !== undefined) {
    keys(ruleset.metadata, ["services"]);
    check(Array.isArray(ruleset.metadata.services) && ruleset.metadata.services.length === 1 &&
      ruleset.metadata.services[0] === "cloud.firestore", "capture_service_invalid");
  }
  keys(ruleset.source, ["files"]);
  check(Array.isArray(ruleset.source.files) && ruleset.source.files.length === 1, "capture_source_invalid");
  const file = ruleset.source.files[0];
  keys(file, ["name", "content"], ["fingerprint"]);
  check(typeof file.name === "string" && /^[A-Za-z0-9._-]+\.rules$/.test(file.name) &&
    typeof file.content === "string" && (file.fingerprint === undefined || typeof file.fingerprint === "string"),
  "capture_source_invalid");
  const baseline = Buffer.from(file.content);
  check(hash(baseline) === BASELINE_SHA256, "baseline_source_drift");
  check(candidate.equals(Buffer.from(reviewedCandidate(file.content))) && hash(candidate) === CANDIDATE_SHA256,
    "candidate_source_drift");
  check(typeof outputDirectory === "string" && path.isAbsolute(outputDirectory), "output_path_invalid");
  check(!fs.existsSync(outputDirectory), "output_exists");
  const config = Buffer.from(JSON.stringify({firestore: {database: "(default)", rules: "candidate.rules"}}, null, 2) + "\n");
  const files = {"baseline.rules": baseline, "candidate.rules": candidate,
    "capture.json": captureBytes, "firebase.rules-only.json": config};
  const manifest = {
    schemaVersion: 1, kind: "develop-rules-pause-preparation", projectId: PROJECT, databaseId: "(default)",
    canApply: false, releaseName: RELEASE, capturedAt: capture.capturedAt,
    priorRelease: {...release}, baselineSha256: BASELINE_SHA256, candidateSha256: CANDIDATE_SHA256,
    files: Object.entries(files).map(([name, bytes]) => ({path: name, sha256: hash(bytes), bytes: bytes.length})),
    requiredDeployment: {projectId: PROJECT, config: "firebase.rules-only.json", only: "firestore:rules",
      functionsChanges: 0, storageChanges: 0, indexChanges: 0},
    checks: {freshBeforeReleaseAndSourceRequired: true, exactCapturedPriorReleaseRequired: true,
      ownAfterReleaseAndCandidateHashRequired: true, exclusiveRulesPublisherRequired: true,
      publisherCompareAndPatchIsCAS: false, allDevelopClientWritesClosed: true,
      productionAdmissionPreserved: true, readsPreserved: true, privilegedServerWritesFenced: false,
      legacyDrainProven: false, baselineRestoreAllowed: false, automaticReopenAllowed: false,
      ttlReopenAllowed: false, afterBusinessOrEpochChangeUseGovernedRecovery: true},
  };
  // Exclusive directory creation and wx writes refuse to replace any existing packet/config.
  fs.mkdirSync(outputDirectory, {mode: 0o700});
  for (const [name, bytes] of Object.entries(files)) {
    fs.writeFileSync(path.join(outputDirectory, name), bytes, {flag: "wx", mode: 0o600});
  }
  fs.writeFileSync(path.join(outputDirectory, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n",
    {flag: "wx", mode: 0o600});
  return manifest;
}

module.exports = {prepareDevelopRulesPause, BASELINE_SHA256, CANDIDATE_SHA256};
if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    check(args.length === 6 && args[0] === "--capture" && args[2] === "--candidate" && args[4] === "--output",
      "arguments_invalid");
    const result = prepareDevelopRulesPause({captureFile: args[1], candidateFile: args[3], outputDirectory: args[5]});
    process.stdout.write(JSON.stringify({packetWritten: true, canApply: result.canApply,
      only: result.requiredDeployment.only, baselineRestoreAllowed: false}) + "\n");
  } catch (error) {
    const code = typeof error.code === "string" && /^[a-z_]+$/.test(error.code) ? error.code : "preparation_failed";
    process.stderr.write(`rules_pause_preparation_failed:${code}\n`);
    process.exitCode = 1;
  }
}
