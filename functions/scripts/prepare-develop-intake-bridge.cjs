"use strict";
// Generates a reviewable source pack. No SDK client, installation or deploy call.
const fs = require("node:fs");
const path = require("node:path");
const {createHash} = require("node:crypto");
const {execFileSync} = require("node:child_process");
const ts = require("typescript");
const ZIP_SHA256 = "07cd231c91df1e7bd31ab6a9f6a711559536aca3e7de697e641628d6c8216b49";
const LEGACY_JS_SHA256 = "405d00ce204f64565d553649e1786fb968818024bf437c250c73514f1ffc1883";
const PROJECT_ID = "reguerta-9f27f";
const LEGACY = ["syncShiftsFromGoogleSheets", "exportShiftsToGoogleSheets",
  "onShiftPlanningRequestCreated", "onShiftWritten",
  "onDeliveryCalendarOverrideWritten", "onNotificationEventCreated"];
const CAPTURE = ["captureDevelopShiftPlanningRequest", "captureDevelopShiftWritten",
  "captureDevelopDeliveryCalendarWritten", "captureDevelopNotificationCreated"];
const fail = (code) => { throw Object.assign(Error(code), {code}); };
const sha = (value) => createHash("sha256").update(value).digest("hex");
const readZip = (archive, entry) => execFileSync("unzip", ["-p", archive, entry],
  {maxBuffer: 20 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"]});

function registrations(source) {
  const parsed = ts.createSourceFile("legacy.js", source, ts.ScriptTarget.Latest,
    true, ts.ScriptKind.JS);
  if (parsed.parseDiagnostics.length) fail("legacy_syntax_invalid");
  const matches = new Map();
  function visit(node) {
    if (ts.isBinaryExpression(node) && ts.isPropertyAccessExpression(node.left) &&
        node.left.expression.getText(parsed) === "exports" &&
        LEGACY.includes(node.left.name.text) && ts.isCallExpression(node.right)) {
      const name = node.left.name.text, call = node.right;
      if (matches.has(name) || !call.arguments.length) fail("legacy_registration_ambiguous");
      const callback = call.arguments.at(-1);
      if (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback)) {
        fail("legacy_callback_invalid");
      }
      const constructor = call.expression.getText(parsed);
      const expected = name.startsWith("on") ?
        (name === "onShiftWritten" || name === "onDeliveryCalendarOverrideWritten" ?
          "onDocumentWritten" : "onDocumentCreated") : "onRequest";
      if (!constructor.endsWith(`.${expected})`)) fail("legacy_constructor_changed");
      matches.set(name, {name, callback: callback.getText(parsed),
        start: callback.getStart(parsed), end: callback.end, constructor,
        options: call.arguments.slice(0, -1).map((arg) => arg.getText(parsed))});
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  if (matches.size !== 6) fail("legacy_registration_incomplete");
  return matches;
}

function globalPreservationPatch(source) {
  const parsed = ts.createSourceFile("legacy.js", source, ts.ScriptTarget.Latest,
    true, ts.ScriptKind.JS);
  const matches = [];
  function visit(node) {
    if (ts.isCallExpression(node) &&
        node.expression.getText(parsed).endsWith(".setGlobalOptions)")) {
      if (node.arguments.length !== 1 ||
          !ts.isObjectLiteralExpression(node.arguments[0])) fail("legacy_global_options_invalid");
      const options = node.arguments[0], original = options.getText(parsed);
      if (options.properties.some((property) => property.name?.getText(parsed) ===
          "preserveExternalChanges")) fail("legacy_global_option_already_present");
      matches.push({start: options.getStart(parsed), end: options.end, callback: original,
        replacement: `({...${original}, preserveExternalChanges: true})`});
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  if (matches.length !== 1) fail("legacy_global_options_ambiguous");
  return matches[0];
}

function wrapLegacySource(bytes) {
  if (sha(bytes) !== LEGACY_JS_SHA256) fail("legacy_source_digest_mismatch");
  const source = bytes.toString("utf8"), original = registrations(source);
  const patches = [...original.values()].map((entry) => ({...entry,
    replacement: entry.name.startsWith("on") ?
      `__developShiftBridge.wrapDevelopLegacyEvent(${JSON.stringify(entry.name)}, ${entry.callback})` :
      `__developShiftBridge.wrapDevelopLegacyHttp(${JSON.stringify(entry.name)}, ${entry.callback}, req => parseEnvParam(req.query.env))`,
  }));
  const globalPatch = globalPreservationPatch(source);
  patches.push(globalPatch);
  patches.sort((a, b) => b.start - a.start);
  let patched = source;
  for (const patch of patches) {
    patched = patched.slice(0, patch.start) + patch.replacement + patched.slice(patch.end);
  }
  // Verify lossless reconstruction of every baseline byte before writing output.
  let reconstructed = patched;
  for (const patch of patches) {
    const first = reconstructed.indexOf(patch.replacement);
    if (first < 0 || reconstructed.indexOf(patch.replacement, first + 1) !== -1) {
      fail("legacy_patch_ambiguous");
    }
    reconstructed = reconstructed.slice(0, first) + patch.callback +
      reconstructed.slice(first + patch.replacement.length);
  }
  if (reconstructed !== source) fail("legacy_patch_not_lossless");
  const strict = '"use strict";';
  if (!patched.startsWith(strict)) fail("legacy_strict_directive_missing");
  const header = '\nconst __developShiftBridge = require("./develop-shift-intake-bridge.js");';
  return {source: strict + header + patched.slice(strict.length),
    registrations: [...original.values()].map(({name, constructor, options}) =>
      ({name, constructor, options, callbackWrappedOnly: true})),
    runtimePreservation: {onlyAddedGlobalOption: "preserveExternalChanges", value: true,
      originalGlobalOptionsSha256: sha(globalPatch.callback),
      amendedGlobalOptionsSha256: sha(globalPatch.replacement),
      expectedCallbackInsertions: 6, expectedGlobalOptionInsertions: 1}};
}

function entrypoint(names) {
  return '"use strict";\n' +
    'const legacy = require("./legacy.js");\n' +
    'const bridge = require("./develop-shift-intake-bridge.js");\n' +
    'const sdk = require("firebase-functions/v2/firestore");\n' +
    'const capture = bridge.createDevelopShiftCaptureTriggers({created:sdk.onDocumentCreated,written:sdk.onDocumentWritten});\n' +
    names.map((name) => `exports.${name} = ${LEGACY.includes(name) ? "legacy" : "capture"}.${name};`).join("\n") + "\n";
}

function runtimeMetadata(file) {
  if (!file) return null;
  if (!path.isAbsolute(file)) fail("runtime_metadata_path_invalid");
  const bytes = fs.readFileSync(file), value = JSON.parse(bytes);
  if (value.projectId !== PROJECT_ID || !Array.isArray(value.observations) ||
      value.observations.length !== 6 || !Number.isFinite(Date.parse(value.capturedAt))) {
    fail("runtime_metadata_invalid");
  }
  const entries = value.observations.map((item) => {
    const data = item.data, name = data?.buildConfig?.entryPoint;
    const service = data?.serviceConfig;
    if (!LEGACY.includes(name) || item.sourceUnchanged !== true ||
        data.state !== "ACTIVE" || data.buildConfig.runtime !== "nodejs22" ||
        !service || !service.environmentVariables || !service.serviceAccountEmail ||
        service.maxInstanceCount !== 20 || service.timeoutSeconds !== 60 ||
        service.maxInstanceRequestConcurrency !== 1 || service.availableCpu !== "1" ||
        service.availableMemory !== "256Mi" || service.ingressSettings !== "ALLOW_ALL" ||
        service.allTrafficOnLatestRevision !== true ||
        (name.startsWith("on") &&
          data.eventTrigger?.retryPolicy !== "RETRY_POLICY_DO_NOT_RETRY")) {
      fail("runtime_metadata_changed");
    }
    return {entryPoint: name, state: data.state, updateTime: data.updateTime,
      runtime: data.buildConfig.runtime, serviceConfigSha256: sha(JSON.stringify(service)),
      buildConfigSha256: sha(JSON.stringify(data.buildConfig)),
      environmentVariablesSha256: sha(JSON.stringify(service.environmentVariables)),
      serviceAccountSha256: sha(service.serviceAccountEmail),
      maximumInstances: service.maxInstanceCount, timeoutSeconds: service.timeoutSeconds,
      concurrency: service.maxInstanceRequestConcurrency, cpu: service.availableCpu,
      memory: service.availableMemory, ingress: service.ingressSettings,
      minimumInstances: service.minInstanceCount ?? null,
      minimumInstancesKnown: Object.hasOwn(service, "minInstanceCount"),
      retryPolicy: data.eventTrigger?.retryPolicy ?? null};
  });
  if (new Set(entries.map((entry) => entry.entryPoint)).size !== 6) fail("runtime_metadata_invalid");
  return {capturedAt: value.capturedAt, captureSha256: sha(bytes), functions: entries};
}

function prepareDevelopIntakeBridge(options) {
  const {sourceZip, outputDirectory, compiledDirectory} = options;
  if (!path.isAbsolute(sourceZip) || !path.isAbsolute(outputDirectory) ||
      !path.isAbsolute(compiledDirectory) || fs.existsSync(outputDirectory) ||
      options.projectId !== PROJECT_ID || options.codebase !== "default") {
    fail("bridge_configuration_invalid");
  }
  if (sha(fs.readFileSync(sourceZip)) !== ZIP_SHA256) fail("source_archive_digest_mismatch");
  const packageBytes = readZip(sourceZip, "package.json");
  const lockBytes = readZip(sourceZip, "package-lock.json");
  const pkg = JSON.parse(packageBytes), lock = JSON.parse(lockBytes);
  const versions = {admin: lock.packages["node_modules/firebase-admin"].version,
    functions: lock.packages["node_modules/firebase-functions"].version,
    firestore: lock.packages["node_modules/@google-cloud/firestore"].version,
    googleapis: lock.packages["node_modules/googleapis"].version};
  if (pkg.main !== "lib/index.js" || pkg.engines.node !== "22" ||
      JSON.stringify(versions) !== JSON.stringify({admin: "13.4.0", functions: "6.3.2",
        firestore: "7.11.1", googleapis: "144.0.0"})) fail("baseline_package_changed");
  // Cloud buildpacks otherwise run the archived tsc script, overwriting the
  // generated entrypoint. Only the buildpack hook changes; the lock is exact.
  const deployPackage = {...pkg, scripts: {...pkg.scripts, "gcp-build": ""}};
  const deployPackageBytes = Buffer.from(JSON.stringify(deployPackage, null, 2) + "\n");
  const observedRuntime = runtimeMetadata(options.runtimeMetadataPath);
  const legacy = wrapLegacySource(readZip(sourceZip, "lib/index.js"));
  const modules = {};
  for (const name of ["develop-shift-intake", "develop-shift-intake-bridge"]) {
    const bytes = fs.readFileSync(path.join(compiledDirectory, `${name}.js`));
    const source = bytes.toString("utf8");
    const dependencies = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map((m) => m[1]);
    if (dependencies.some((name) => !["node:crypto", "@google-cloud/firestore",
      "./develop-shift-intake.js"].includes(name))) fail("bridge_dependency_outside_pack");
    modules[name] = bytes;
  }
  const runtime = path.join(outputDirectory, "runtime");
  fs.mkdirSync(path.join(runtime, "lib"), {recursive: true});
  fs.writeFileSync(path.join(runtime, "package.json"), deployPackageBytes);
  fs.writeFileSync(path.join(runtime, "package-lock.json"), lockBytes);
  fs.writeFileSync(path.join(runtime, "lib/legacy.js"), legacy.source);
  fs.writeFileSync(path.join(runtime, "lib/index.js"), entrypoint([...LEGACY, ...CAPTURE]));
  for (const [name, bytes] of Object.entries(modules)) {
    fs.writeFileSync(path.join(runtime, `lib/${name}.js`), bytes);
  }
  const functions = [{source: "runtime", codebase: "default", runtime: "nodejs22"}];
  for (const phase of ["capture", "bridge"]) {
    fs.writeFileSync(path.join(outputDirectory, `firebase.${phase}.json`),
      JSON.stringify({functions}, null, 2) + "\n");
  }
  const files = ["package.json", "package-lock.json", "lib/index.js", "lib/legacy.js",
    "lib/develop-shift-intake.js", "lib/develop-shift-intake-bridge.js"].map((name) => ({
    path: `runtime/${name}`, sha256: sha(fs.readFileSync(path.join(runtime, name))),
  }));
  const manifest = {schemaVersion: 1, kind: "develop-intake-bridge-preparation",
    projectId: PROJECT_ID, codebase: "default", runtime: "nodejs22", canApply: false,
    sourceArchiveSha256: ZIP_SHA256, deployedJavaScriptSha256: LEGACY_JS_SHA256,
    originalPackageSha256: sha(packageBytes), generatedPackageSha256: sha(deployPackageBytes),
    packageDelta: {onlyAddedScript: "gcp-build", value: ""},
    preservedLockSha256: sha(lockBytes), versions, runtimeMetadata: observedRuntime,
    blockers: ["read_back_capture_deployment_before_bridge",
      "preserve_live_environment_and_runtime_at_deployment",
      "old_work_and_retry_disabled_delivery_outcomes_unproved",
      ...(!observedRuntime ? ["fresh_runtime_metadata_required"] : [])],
    exports: [...LEGACY, ...CAPTURE], registrations: legacy.registrations,
    runtimePreservation: legacy.runtimePreservation, files,
    phases: [{kind: "capture-first", config: "firebase.capture.json", functions: CAPTURE,
      requiredOnly: CAPTURE.map((name) => `functions:${name}`).join(",")},
    {kind: "bridge-after-readback", config: "firebase.bridge.json", functions: LEGACY,
      requiredOnly: LEGACY.map((name) => `functions:${name}`).join(",")}],
    guards: {noDeploymentPerformed: true, exactPhaseSelectorRequired: true,
      configsAloneDoNotFilterFunctions: true, broadDeployForbidden: true,
      preserveOriginalEnvironmentAndRuntimeMetadata: true,
      deployCaptureAndVerifyBeforeBridge: true, noLegacyReplay: true,
      earlierWorkAndRetryDisabledFailuresRemainUnknown: true},
    excluded: [".env", "source maps", "current application index", "credentials"],
  };
  fs.writeFileSync(path.join(outputDirectory, "bridge-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}
module.exports = {prepareDevelopIntakeBridge, wrapLegacySource,
  ZIP_SHA256, LEGACY_JS_SHA256, LEGACY, CAPTURE};
if (require.main === module) {
  const args = process.argv.slice(2);
  if (![10, 12].includes(args.length) || args.some((value, i) => i % 2 === 0 &&
      !["--source-zip", "--output", "--compiled", "--project", "--codebase",
        "--runtime-metadata"].includes(value)) ||
      new Set(args.filter((_, i) => i % 2 === 0)).size !== args.length / 2) fail("bridge_arguments_invalid");
  const flags = Object.fromEntries(Array.from({length: args.length / 2},
    (_, i) => [args[i * 2], args[i * 2 + 1]]));
  const result = prepareDevelopIntakeBridge({sourceZip: flags["--source-zip"],
    outputDirectory: flags["--output"], compiledDirectory: flags["--compiled"],
    projectId: flags["--project"], codebase: flags["--codebase"],
    runtimeMetadataPath: flags["--runtime-metadata"]});
  process.stdout.write(JSON.stringify({canApply: result.canApply, exportedCount: result.exports.length,
    sourceArchiveSha256: result.sourceArchiveSha256}) + "\n");
}
