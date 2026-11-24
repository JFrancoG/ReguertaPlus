"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const {createHash} = require("node:crypto");
const {wrapDevelopLegacyHttp: http, wrapDevelopLegacyEvent: event,
  createDevelopShiftCaptureTriggers: triggers} = require("../lib/develop-shift-intake-bridge.js");
const {prepareDevelopIntakeBridge: prepare, wrapLegacySource,
  LEGACY, CAPTURE, LEGACY_JS_SHA256} = require("../scripts/prepare-develop-intake-bridge.cjs");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const archive = process.env.HU084_DEPLOYED_LEGACY_ZIP;
const legacyPath = process.env.HU084_DEPLOYED_LEGACY_JS;
const captureResult = {eventKey: "event-key", coreDigest: "core-digest", duplicate: false};

test("HTTP production uses the original lexical resolver and exact original callback result", () => {
  const req = {query: {}}, res = {}, result = {baseline: true};
  let called = 0;
  const wrapped = http("syncShiftsFromGoogleSheets", (request, response) => {
    assert.equal(request, req); assert.equal(response, res); called++; return result;
  }, () => "production");
  assert.equal(wrapped(req, res), result); assert.equal(called, 1);
});

test("HTTP develop returns 503 and invalid environments cannot reach the original", () => {
  for (const environment of ["develop", "unknown", undefined]) {
    let code, body;
    const wrapped = http("exportShiftsToGoogleSheets", () => assert.fail("legacy write"), () => environment);
    const response = {status(value) { code = value; return this; }, json(value) { body = value; }};
    if (environment === "develop") {
      wrapped({query: {}}, response); assert.equal(code, 503);
      assert.equal(body.error, "develop_legacy_intake_closed");
    } else assert.throws(() => wrapped({query: {}}, response), /environment_invalid/);
  }
});

test("event production bypasses capture and preserves the original event/result", async () => {
  const input = {params: {env: "production"}}, result = {original: true};
  const wrapped = event("onShiftWritten", async (received) => {
    assert.equal(received, input); return result;
  }, () => assert.fail("capture must remain lazy"));
  assert.equal(await wrapped(input), result);
});

test("old develop trigger waits for retention and never runs legacy effects, including duplicate delivery", async () => {
  let release, writes = 0;
  const held = new Promise((resolve) => { release = resolve; });
  const input = {params: {env: "develop"}, id: "old-delivery"};
  const wrapped = event("onNotificationEventCreated", async () => { writes++; },
    async (entry, received) => { assert.equal(entry, "onNotificationEventCreated");
      assert.equal(received, input); await held; return captureResult; });
  let settled = false;
  const running = wrapped(input).then(() => { settled = true; });
  await Promise.resolve(); assert.equal(settled, false);
  release(); await running; await wrapped(input);
  assert.equal(writes, 0);
});

test("old retention failure rejects rather than claiming capture or running legacy", async () => {
  const wrapped = event("onShiftPlanningRequestCreated", () => assert.fail("legacy body"),
    async () => { throw Error("storage_unavailable"); });
  await assert.rejects(wrapped({params: {env: "develop"}}), /storage_unavailable/);
  await assert.rejects(wrapped({params: {env: "other"}}), /environment_invalid/);
});

test("four capture-only registrations are fixed to develop, retry enabled and normalize only path-derived environment", async () => {
  const registered = [], received = [];
  const register = (kind) => (options, handler) => { registered.push({kind, options, handler}); return handler; };
  const exported = triggers({created: register("created"), written: register("written")},
    async (entry, value) => { received.push({entry, value}); return captureResult; });
  assert.deepEqual(Object.keys(exported), CAPTURE);
  assert.equal(registered.length, 4);
  for (const item of registered) {
    assert.equal(item.options.retry, true);
    assert.equal(item.options.maxInstances, 20);
    assert.ok(item.options.document.startsWith("develop/plus-collections/"));
    await item.handler({params: {sourceId: "original"}, extension: "preserved"});
    assert.equal(received.at(-1).value.params.env, "develop");
    assert.equal(received.at(-1).value.extension, "preserved");
    await assert.rejects(item.handler({params: {env: "production"}}), /environment_invalid/);
  }
  assert.deepEqual(received.map((value) => value.entry), LEGACY.slice(2));
});

test("default capture rejects an unapproved runtime project before client admission", async () => {
  const previous = {project: process.env.GCLOUD_PROJECT, host: process.env.FIRESTORE_EMULATOR_HOST};
  process.env.GCLOUD_PROJECT = "unrelated-project";
  delete process.env.FIRESTORE_EMULATOR_HOST;
  try {
    const wrapped = event("onShiftWritten", () => assert.fail("legacy body"));
    await assert.rejects(wrapped({params: {env: "develop"}}),
      (error) => error.code === "intake_database_invalid");
  } finally {
    if (previous.project === undefined) delete process.env.GCLOUD_PROJECT;
    else process.env.GCLOUD_PROJECT = previous.project;
    if (previous.host === undefined) delete process.env.FIRESTORE_EMULATOR_HOST;
    else process.env.FIRESTORE_EMULATOR_HOST = previous.host;
  }
});

test("source pin rejects any unaudited legacy bytes", () => {
  assert.throws(() => wrapLegacySource(Buffer.from("unknown")), /source_digest_mismatch/);
});

test("builder preserves locked dependencies, disables buildpack recompilation and exports only ten functions",
  {skip: !archive || !legacyPath}, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "develop-bridge-test-"));
    const output = path.join(root, "sourcepack");
    try {
      const baseline = fs.readFileSync(legacyPath);
      assert.equal(sha(baseline), LEGACY_JS_SHA256);
      const transformed = wrapLegacySource(baseline);
      assert.equal(transformed.registrations.length, 6);
      assert.equal(transformed.runtimePreservation.onlyAddedGlobalOption, "preserveExternalChanges");
      assert.equal(transformed.runtimePreservation.expectedGlobalOptionInsertions, 1);
      assert.match(transformed.source, /preserveExternalChanges: true/);
      assert.ok(transformed.source.startsWith('"use strict";'));
      const manifest = prepare({sourceZip: archive, outputDirectory: output,
        compiledDirectory: path.resolve(__dirname, "../lib"),
        projectId: "reguerta-9f27f", codebase: "default",
        runtimeMetadataPath: process.env.HU084_LEGACY_RUNTIME_METADATA});
      assert.equal(manifest.canApply, false);
      assert.deepEqual(manifest.exports, [...LEGACY, ...CAPTURE]);
      assert.equal(manifest.files.length, 6);
      const runtime = path.join(output, "runtime");
      assert.equal(sha(fs.readFileSync(path.join(runtime, "package-lock.json"))), manifest.preservedLockSha256);
      assert.equal(sha(fs.readFileSync(path.join(runtime, "package.json"))), manifest.generatedPackageSha256);
      const generated = JSON.parse(fs.readFileSync(path.join(runtime, "package.json")));
      assert.equal(generated.scripts["gcp-build"], "");
      delete generated.scripts["gcp-build"];
      const originalPackage = require("node:child_process").execFileSync("unzip", ["-p", archive, "package.json"]);
      assert.deepEqual(generated, JSON.parse(originalPackage));
      assert.equal(sha(originalPackage), manifest.originalPackageSha256);
      assert.deepEqual(fs.readdirSync(runtime).sort(), ["lib", "package-lock.json", "package.json"]);
      assert.deepEqual(fs.readdirSync(path.join(runtime, "lib")).sort(),
        ["develop-shift-intake-bridge.js", "develop-shift-intake.js", "index.js", "legacy.js"]);
      const exports = {};
      const legacy = Object.fromEntries(LEGACY.map((name) => [name, Symbol(name)]));
      const captures = Object.fromEntries(CAPTURE.map((name) => [name, Symbol(name)]));
      vm.runInNewContext(fs.readFileSync(path.join(runtime, "lib/index.js"), "utf8"), {
        exports, require(name) {
          if (name === "./legacy.js") return legacy;
          if (name === "./develop-shift-intake-bridge.js") return {createDevelopShiftCaptureTriggers: () => captures};
          if (name === "firebase-functions/v2/firestore") return {};
          assert.fail("unexpected dependency");
        },
      });
      assert.deepEqual(Object.keys(exports), [...LEGACY, ...CAPTURE]);
      for (const name of manifest.exports) assert.equal(exports[name], (legacy[name] || captures[name]));
      assert.equal(manifest.phases[0].functions.length, 4);
      assert.equal(manifest.phases[1].functions.length, 6);
      assert.equal(manifest.guards.configsAloneDoNotFilterFunctions, true);
      assert.equal(fs.existsSync(path.join(output, ".env")), false);
    } finally { fs.rmSync(root, {recursive: true, force: true}); }
  });
