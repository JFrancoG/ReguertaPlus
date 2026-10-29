"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {createHash} = require("node:crypto");
const {execFileSync, spawnSync} = require("node:child_process");
const {prepareDevelopCaptureObservationUpdate: prepare, prepareDevelopIntakeBridge,
  prepareDevelopAdministrativeBridge, CAPTURE, LEGACY} =
  require("../scripts/prepare-develop-intake-bridge.cjs");
const archive = process.env.HU084_DEPLOYED_LEGACY_ZIP;
const sources = process.env.HU084_REMAINING_LEGACY_SOURCES;
const oldSDK = process.env.HU084_CAPTURE_SDK_NODE_MODULES;
const compiled = path.resolve(__dirname, "../lib");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const documents = ["shiftPlanningRequests/{requestId}", "shifts/{shiftId}",
  "deliveryCalendar/{weekKey}", "notificationEvents/{eventId}"];

function metadata() {
  return {projectId: "reguerta-9f27f", capturedAt: "2026-10-28T21:47:55.631Z",
    observations: CAPTURE.map((name, index) => ({target: name, sourceUnchanged: true,
      data: {name: `projects/reguerta-9f27f/locations/europe-west1/functions/${name}`,
        state: "ACTIVE", updateTime: "2026-10-28T13:00:00Z",
        buildConfig: {entryPoint: name, runtime: "nodejs22"},
        serviceConfig: {environmentVariables: {APP_ENV: "develop", PUBLIC_FIXTURE: "capture-only"},
          serviceAccountEmail: "runtime-fixture@reguerta-9f27f.iam.gserviceaccount.com",
          maxInstanceCount: 20, timeoutSeconds: 60, maxInstanceRequestConcurrency: 1,
          availableCpu: "1", availableMemory: "256Mi", ingressSettings: "ALLOW_ALL",
          allTrafficOnLatestRevision: true},
        eventTrigger: {retryPolicy: "RETRY_POLICY_RETRY",
          serviceAccountEmail: "runtime-fixture@reguerta-9f27f.iam.gserviceaccount.com",
          eventType: `google.cloud.firestore.document.v1.${[1, 2].includes(index) ? "written" : "created"}`,
          eventFilters: [{attribute: "document", value: `develop/plus-collections/${documents[index]}`,
            operator: "match-path-pattern"}]}}}))};
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "capture-update-pack-"));
  const metadataPath = path.join(root, "runtime.json");
  fs.writeFileSync(metadataPath, JSON.stringify(metadata()));
  return {root, metadataPath, output: path.join(root, "pack"), options: {
    sourceZip: archive || path.join(root, "absent.zip"), outputDirectory: path.join(root, "pack"),
    compiledDirectory: compiled, projectId: "reguerta-9f27f", codebase: "default",
    runtimeMetadataPath: metadataPath}, close() { fs.rmSync(root, {recursive: true, force: true}); }};
}

test("capture update requires metadata and rejects unknown profiles before creating a packet", () => {
  const f = fixture();
  try {
    assert.throws(() => prepare({...f.options, runtimeMetadataPath: undefined}), /capture_update_configuration_invalid/);
    assert.throws(() => prepare({...f.options, profile: "unreviewed"}), /capture_update_profile_invalid/);
    assert.throws(() => prepareDevelopIntakeBridge({...f.options, profile: "unreviewed"}), /capture_update_configuration_invalid/);
    assert.equal(fs.existsSync(f.output), false);
  } finally { f.close(); }
});

test("capture-only packet contains exactly four exports and seven reviewed deploy files", {skip: !archive}, () => {
  const f = fixture();
  try {
    const manifest = prepare(f.options);
    assert.equal(manifest.profile, "capture-update4");
    assert.deepEqual(manifest.exports, CAPTURE);
    assert.equal(manifest.requiredOnly, CAPTURE.map((name) => `functions:${name}`).join(","));
    assert.equal(manifest.requiredConfig, "firebase.capture.json");
    assert.deepEqual(manifest.phases.map((phase) => phase.functions), [CAPTURE]);
    assert.equal(manifest.files.length, 7);
    assert.deepEqual(manifest.files.map((file) => file.path).sort(), ["firebase.capture.json",
      "runtime/package.json", "runtime/package-lock.json", "runtime/lib/index.js", "runtime/lib/legacy.js",
      "runtime/lib/develop-shift-intake.js", "runtime/lib/develop-shift-intake-bridge.js"].sort());
    for (const file of manifest.files) assert.equal(sha(fs.readFileSync(path.join(f.output, file.path))), file.sha256);
    assert.deepEqual(fs.readdirSync(f.output).sort(), ["bridge-manifest.json", "firebase.capture.json", "runtime"]);
    assert.deepEqual(fs.readdirSync(path.join(f.output, "runtime/lib")).sort(),
      ["develop-shift-intake-bridge.js", "develop-shift-intake.js", "index.js", "legacy.js"]);
    assert.deepEqual([...fs.readFileSync(path.join(f.output, "runtime/lib/index.js"), "utf8")
      .matchAll(/^exports\.([A-Za-z0-9_]+) =/gm)].map((match) => match[1]), CAPTURE);
    assert.equal(manifest.canApply, false);
    assert.equal(manifest.guards.noLegacyDeploymentAuthorized, true);
    assert.equal(manifest.guards.selectorPrefixCollisionsRequireLiveReadback, true);
    assert.equal(fs.existsSync(path.join(f.output, "firebase.bridge.json")), false);
    assert.equal(fs.existsSync(path.join(f.output, "runtime/.env")), false);
  } finally { f.close(); }
});

test("capture update preserves exact archived dependencies and only disables the buildpack hook", {skip: !archive}, () => {
  const f = fixture();
  try {
    const manifest = prepare(f.options), runtime = path.join(f.output, "runtime");
    const originalPackage = JSON.parse(execFileSync("unzip", ["-p", archive, "package.json"]));
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(runtime, "package.json"))),
      {...originalPackage, scripts: {...originalPackage.scripts, "gcp-build": ""}});
    assert.deepEqual(fs.readFileSync(path.join(runtime, "package-lock.json")),
      execFileSync("unzip", ["-p", archive, "package-lock.json"]));
    assert.deepEqual(manifest.versions, {admin: "13.4.0", functions: "6.3.2", firestore: "7.11.1", googleapis: "144.0.0"});
    assert.equal(manifest.preservedLockSha256, "38009fa8abd24f149347d2e571bc6dfcc6e96662cb389e5b21acf58d9068ef6a");
    assert.match(fs.readFileSync(path.join(runtime, "lib/legacy.js"), "utf8"), /preserveExternalChanges: true/);
    assert.equal(manifest.runtimeMetadata.functions.length, 4);
    for (const [index, item] of manifest.runtimeMetadata.functions.entries()) {
      assert.equal(item.retryPolicy, "RETRY_POLICY_RETRY");
      assert.equal(item.documentPattern, `develop/plus-collections/${documents[index]}`);
      assert.equal(item.eventTriggerSha256, sha(JSON.stringify(metadata().observations[index].data.eventTrigger)));
      assert.equal(item.serviceAccountSha256, item.triggerServiceAccountSha256);
    }
  } finally { f.close(); }
});

test("missing metadata file, changed document/operator/retry/identity and altered archive leave no output", {skip: !archive}, () => {
  for (const kind of ["missing", "document", "operator", "retry", "identity", "archive"]) {
    const f = fixture();
    try {
      const value = metadata();
      if (kind === "missing") fs.unlinkSync(f.metadataPath);
      if (kind === "document") value.observations[0].data.eventTrigger.eventFilters[0].value = "{env}/plus-collections/shiftPlanningRequests/{requestId}";
      if (kind === "operator") delete value.observations[0].data.eventTrigger.eventFilters[0].operator;
      if (kind === "retry") value.observations[0].data.eventTrigger.retryPolicy = "RETRY_POLICY_DO_NOT_RETRY";
      if (kind === "identity") value.observations[0].data.eventTrigger.serviceAccountEmail = "other-fixture@reguerta-9f27f.iam.gserviceaccount.com";
      if (!["missing", "archive"].includes(kind)) fs.writeFileSync(f.metadataPath, JSON.stringify(value));
      if (kind === "archive") {
        const altered = path.join(f.root, "altered.zip");
        fs.writeFileSync(altered, Buffer.concat([fs.readFileSync(archive), Buffer.from("unaudited")]));
        f.options.sourceZip = altered;
      }
      assert.throws(() => prepare(f.options), kind === "missing" ? /ENOENT/ : kind === "archive" ? /source_archive_digest_mismatch/ : /runtime_metadata_changed/);
      assert.equal(fs.existsSync(f.output), false);
    } finally { f.close(); }
  }
});

test("CLI profile capture-update4 uses the same bounded package and unknown profile creates nothing", {skip: !archive}, () => {
  const f = fixture();
  try {
    const script = path.resolve(__dirname, "../scripts/prepare-develop-intake-bridge.cjs");
    const args = [script, "--source-zip", archive, "--output", f.output, "--compiled", compiled,
      "--project", "reguerta-9f27f", "--codebase", "default", "--runtime-metadata", f.metadataPath, "--profile", "capture-update4"];
    const accepted = spawnSync(process.execPath, args, {encoding: "utf8"});
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.equal(JSON.parse(accepted.stdout).exportedCount, 4);
    args[args.indexOf(f.output)] = path.join(f.root, "unknown"); args[args.length - 1] = "unknown";
    assert.notEqual(spawnSync(process.execPath, args, {encoding: "utf8"}).status, 0);
    assert.equal(fs.existsSync(path.join(f.root, "unknown")), false);
  } finally { f.close(); }
});

test("existing ten-function and both HTTP profile entrypoints retain their reviewed bytes", {skip: !archive || !sources}, () => {
  for (const [profile, archiveName, entryHash, legacyHash] of [
    [null, null, "152c4cb098293bc0d2abeb434a3c5a8d75187ee257678e891fc77c3e9f891af3", "be55fe8214515e9faa6ec94a22bed94cd2b0b77c44d744c7caf501d94586f53e"],
    ["legacy-http8", "onProductWrite.zip", "a0ae9f08e1e90e28fa55a6f46d46317e2aedbf09e6534e1f9e1600ac6c833faf", "5bce1dc3336b34f984bfbb801e8e1605da838be77eff5e5b4e45286f90db5268"],
    ["authorized-member1", "resolveAuthorizedMember.zip", "97f6b4d47f70b7a0a4ed845eab29f5f89594298da387962c77b6329d5d512fce", "138a19fa530897b84db932c44418f7c6db1625f56d5e5e6ad249c9ad0ff1e570"],
  ]) {
    const f = fixture();
    try {
      const options = {...f.options, runtimeMetadataPath: undefined, ...(profile ? {profile, sourceZip: path.join(sources, archiveName)} : {})};
      const manifest = profile ? prepareDevelopAdministrativeBridge(options) : prepareDevelopIntakeBridge(options);
      assert.equal(sha(fs.readFileSync(path.join(f.output, "runtime/lib/index.js"))), entryHash);
      assert.equal(sha(fs.readFileSync(path.join(f.output, "runtime/lib/legacy.js"))), legacyHash);
      const config = profile ? "firebase.http.json" : "firebase.capture.json";
      assert.equal(sha(fs.readFileSync(path.join(f.output, config))), "27c1928a76e4f54a477c520d36896820aad92530993a1920f3c3a324cb1c1b13");
      if (!profile) { assert.deepEqual(manifest.exports, [...LEGACY, ...CAPTURE]); assert.equal(manifest.files.length, 6); }
    } finally { f.close(); }
  }
});

test("archived SDK6 discovers exactly the four retry-enabled develop capture exports", {skip: !archive || !oldSDK}, () => {
  const f = fixture();
  try {
    prepare(f.options);
    const program = `const exports=require(${JSON.stringify(path.join(f.output, "runtime/lib/index.js"))});
      console.log(JSON.stringify(Object.entries(exports).map(([name,fn])=>({name,trigger:fn.__endpoint.eventTrigger,max:fn.__endpoint.maxInstances}))));`;
    const result = spawnSync(process.execPath, ["-e", program], {encoding: "utf8", env: {
      PATH: process.env.PATH, NODE_PATH: oldSDK, GCLOUD_PROJECT: "demo-reguerta-capture-sdk",
      METADATA_SERVER_DETECTION: "none"}});
    assert.equal(result.status, 0, result.stderr);
    const exported = JSON.parse(result.stdout.trim());
    assert.deepEqual(exported.map((item) => item.name), CAPTURE);
    for (const [index, item] of exported.entries()) {
      assert.equal(item.trigger.retry, true);
      assert.equal(item.trigger.eventFilterPathPatterns.document, `develop/plus-collections/${documents[index]}`);
      assert.equal(item.max, 20);
    }
  } finally { f.close(); }
});
