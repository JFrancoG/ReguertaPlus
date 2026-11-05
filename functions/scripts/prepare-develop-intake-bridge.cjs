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
const CAPTURE_DOCUMENTS = ["shiftPlanningRequests/{requestId}", "shifts/{shiftId}",
  "deliveryCalendar/{weekKey}", "notificationEvents/{eventId}"];
const ADMINISTRATIVE = ["onProductWrite", "onContainerWrite", "onMeasureWrite",
  "onUserWrite", "onOrderWrite", "upsertMemberByAdmin", "validateGlobalVersionPolicy",
  "validateGlobalFreshnessConfig"];
const REMINDERS = [20, 22, 23].map(hour => `sendPendingOrderReminderSunday${hour}`);
const REMINDER_PROFILE = {
  zip: "98175ecc32c5c2e4b94c82df856aeadb9d804b38f625d9db4a2cd6b0871de1a5",
  main: "1b3d01cc95a3e10ee3f8d0eab610ed240f65c2a7fa29c0489050518f01c55aba",
};
const RESOLVE_PROFILE = {
  zip: "83f0b69192dab558f0698a8eac0e39ed34ee2b0f2b677b7d09b6660da448a44c",
  main: "bc52c3d0122680145c3b5e1623c3feedad24dca57aa69765e576d3f8c3c9dd99",
  lock: "9e7a729c66e7f82077c70d8cc6efe7db2fe83e4e1dc6ef85cf84513fc7c3fa37",
  helpers: {
    "lib/backend-security.js": "4c00ef9ac86aff0f6e2fb7b23e20d1ca42903c4b56991f25d6511e038dce2c41",
    "lib/member-directory.js": "9d60878a6465dcb6e5f3af0ca8476ea82115e887c2eda9d389f28778c0569d1f",
    "lib/notification-inbox.js": "91760ef81e66726d0b5ae9be883d2ff22be7249076d23100eece6ce8088d5174",
    "lib/shift-swap-security.js": "4b70e6abe5505b9d39828724aa6538991efa23b17a05a81d31784c5b8fdcf799",
  },
};
const fail = (code) => { throw Object.assign(Error(code), {code}); };
const sha = (value) => createHash("sha256").update(value).digest("hex");
const readZip = (archive, entry) => execFileSync("unzip", ["-p", archive, entry],
  {maxBuffer: 20 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"]});

function registrations(source, names = LEGACY, httpOnly = false, scheduled = false) {
  const parsed = ts.createSourceFile("legacy.js", source, ts.ScriptTarget.Latest,
    true, ts.ScriptKind.JS);
  if (parsed.parseDiagnostics.length) fail("legacy_syntax_invalid");
  const matches = new Map();
  function visit(node) {
    if (ts.isBinaryExpression(node) && ts.isPropertyAccessExpression(node.left) &&
        node.left.expression.getText(parsed) === "exports" &&
        names.includes(node.left.name.text) && ts.isCallExpression(node.right)) {
      const name = node.left.name.text, call = node.right;
      if (matches.has(name) || !call.arguments.length) fail("legacy_registration_ambiguous");
      const callback = call.arguments.at(-1);
      if (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback)) {
        fail("legacy_callback_invalid");
      }
      const constructor = call.expression.getText(parsed);
      const expected = scheduled ? "onSchedule" : !httpOnly && name.startsWith("on") ?
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
  if (matches.size !== names.length) fail("legacy_registration_incomplete");
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

function runtimeMetadata(file, names = LEGACY) {
  if (!file) return null;
  if (!path.isAbsolute(file)) fail("runtime_metadata_path_invalid");
  const bytes = fs.readFileSync(file), value = JSON.parse(bytes);
  if (value.projectId !== PROJECT_ID || !Array.isArray(value.observations) ||
      value.observations.length !== names.length || !Number.isFinite(Date.parse(value.capturedAt))) {
    fail("runtime_metadata_invalid");
  }
  const entries = value.observations.map((item) => {
    const data = item.data, name = data?.buildConfig?.entryPoint;
    const service = data?.serviceConfig;
    if (!names.includes(name) || item.sourceUnchanged !== true ||
        data.state !== "ACTIVE" || data.buildConfig.runtime !== "nodejs22" ||
        !service || !service.environmentVariables || !service.serviceAccountEmail ||
        (names === REMINDERS ? Object.hasOwn(service, "maxInstanceCount") :
          names === LEGACY ? service.maxInstanceCount !== 20 :
            !Number.isSafeInteger(service.maxInstanceCount) || service.maxInstanceCount < 1) ||
        service.timeoutSeconds !== 60 ||
        service.maxInstanceRequestConcurrency !== 1 || service.availableCpu !== "1" ||
        service.availableMemory !== "256Mi" || service.ingressSettings !== "ALLOW_ALL" ||
        service.allTrafficOnLatestRevision !== true ||
        (names === CAPTURE && (service.maxInstanceCount !== 20 ||
          data.eventTrigger?.retryPolicy !== "RETRY_POLICY_RETRY" ||
          data.eventTrigger?.serviceAccountEmail !== service.serviceAccountEmail ||
          data.eventTrigger?.eventType !== `google.cloud.firestore.document.v1.${
            [1, 2].includes(CAPTURE.indexOf(name)) ? "written" : "created"}` ||
          data.eventTrigger?.eventFilters?.find((filter) => filter.attribute === "document")?.operator !==
            "match-path-pattern" ||
          data.eventTrigger?.eventFilters?.find((filter) => filter.attribute === "document")?.value !==
            `develop/plus-collections/${CAPTURE_DOCUMENTS[CAPTURE.indexOf(name)]}`)) ||
        (LEGACY.includes(name) && name.startsWith("on") &&
          data.eventTrigger?.retryPolicy !== "RETRY_POLICY_DO_NOT_RETRY")) {
      fail("runtime_metadata_changed");
    }
    return {entryPoint: name, state: data.state, updateTime: data.updateTime,
      runtime: data.buildConfig.runtime, serviceConfigSha256: sha(JSON.stringify(service)),
      buildConfigSha256: sha(JSON.stringify(data.buildConfig)),
      environmentVariablesSha256: sha(JSON.stringify(service.environmentVariables)),
      serviceAccountSha256: sha(service.serviceAccountEmail),
      maximumInstances: service.maxInstanceCount, timeoutSeconds: service.timeoutSeconds,
      ...(names === REMINDERS ? {maximumInstancesKnown: false} : {}),
      concurrency: service.maxInstanceRequestConcurrency, cpu: service.availableCpu,
      memory: service.availableMemory, ingress: service.ingressSettings,
      minimumInstances: service.minInstanceCount ?? null,
      minimumInstancesKnown: Object.hasOwn(service, "minInstanceCount"),
      retryPolicy: data.eventTrigger?.retryPolicy ?? null,
      ...(names === CAPTURE ? {eventTriggerSha256: sha(JSON.stringify(data.eventTrigger)),
        documentPattern: `develop/plus-collections/${CAPTURE_DOCUMENTS[CAPTURE.indexOf(name)]}`,
        triggerServiceAccountSha256: sha(data.eventTrigger.serviceAccountEmail)} : {})};
  });
  if (new Set(entries.map((entry) => entry.entryPoint)).size !== names.length) fail("runtime_metadata_invalid");
  return {capturedAt: value.capturedAt, captureSha256: sha(bytes), functions: entries};
}

function prepareDevelopIntakeBridge(options) {
  const {sourceZip, outputDirectory, compiledDirectory} = options;
  const captureUpdate = options.profile === "capture-update4";
  if ((options.profile !== undefined && !captureUpdate) ||
      (captureUpdate && !options.runtimeMetadataPath)) fail("capture_update_configuration_invalid");
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
  const observedRuntime = runtimeMetadata(options.runtimeMetadataPath, captureUpdate ? CAPTURE : LEGACY);
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
  fs.writeFileSync(path.join(runtime, "lib/index.js"), entrypoint(captureUpdate ? CAPTURE : [...LEGACY, ...CAPTURE]));
  for (const [name, bytes] of Object.entries(modules)) {
    fs.writeFileSync(path.join(runtime, `lib/${name}.js`), bytes);
  }
  const functions = [{source: "runtime", codebase: "default", runtime: "nodejs22"}];
  for (const phase of captureUpdate ? ["capture"] : ["capture", "bridge"]) {
    fs.writeFileSync(path.join(outputDirectory, `firebase.${phase}.json`),
      JSON.stringify({functions}, null, 2) + "\n");
  }
  const files = ["package.json", "package-lock.json", "lib/index.js", "lib/legacy.js",
    "lib/develop-shift-intake.js", "lib/develop-shift-intake-bridge.js"].map((name) => ({
    path: `runtime/${name}`, sha256: sha(fs.readFileSync(path.join(runtime, name))),
  }));
  if (captureUpdate) files.push({path: "firebase.capture.json",
    sha256: sha(fs.readFileSync(path.join(outputDirectory, "firebase.capture.json")))});
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
  if (captureUpdate) {
    manifest.kind = "develop-capture-observation-update-preparation";
    manifest.profile = "capture-update4";
    manifest.exports = [...CAPTURE];
    manifest.requiredConfig = "firebase.capture.json";
    manifest.requiredOnly = CAPTURE.map((name) => `functions:${name}`).join(",");
    manifest.phases = [{kind: "capture-update-only", config: manifest.requiredConfig,
      functions: [...CAPTURE], requiredOnly: manifest.requiredOnly}];
    manifest.blockers = ["fresh_capture_source_runtime_identity_and_iam_readbacks_required",
      "old_work_and_delivery_outcomes_unproved"];
    manifest.guards.deployCaptureAndVerifyBeforeBridge = false;
    manifest.guards.captureUpdateOnly = true;
    manifest.guards.noLegacyDeploymentAuthorized = true;
    manifest.guards.selectorPrefixCollisionsRequireLiveReadback = true;
  }
  fs.writeFileSync(path.join(outputDirectory, "bridge-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

function prepareDevelopCaptureObservationUpdate(options) {
  if (options.profile !== undefined && options.profile !== "capture-update4") {
    fail("capture_update_profile_invalid");
  }
  return prepareDevelopIntakeBridge({...options, profile: "capture-update4"});
}
function wrapAdministrativeSource(bytes, profile) {
  const modern = profile === "authorized-member1";
  const reminders = profile === "reminders3";
  if (!modern && !reminders && profile !== "legacy-http8") fail("administrative_profile_invalid");
  if (sha(bytes) !== (modern ? RESOLVE_PROFILE.main : reminders ? REMINDER_PROFILE.main : LEGACY_JS_SHA256)) fail("source_digest_mismatch");
  const source = bytes.toString("utf8"), names = modern ? ["resolveAuthorizedMember"] : reminders ? REMINDERS : ADMINISTRATIVE;
  const original = registrations(source, names, true, reminders), patches = [];
  if (reminders) {
    for (const entry of original.values()) patches.push({...entry, replacement:
      `__developShiftBridge.wrapDevelopScheduledReminder(${JSON.stringify(entry.name)}, ${entry.callback}, parseOrderReminderEnvs)`});
  } else if (modern) {
    const parsed = ts.createSourceFile("legacy.js", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const wanted = new Map([
      ["parseRequestEnvironment", "wrapDevelopEnvironmentResolver"],
      ["resolveRequestEnvironmentForIdentity", "wrapDevelopEffectiveEnvironmentResolver"],
    ]);
    const visit = (node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && wanted.has(node.name.text)) {
        const initializer = node.initializer;
        if (!initializer || !ts.isArrowFunction(initializer)) fail("environment_resolver_invalid");
        const callback = initializer.getText(parsed), method = wanted.get(node.name.text);
        wanted.delete(node.name.text);
        patches.push({start: initializer.getStart(parsed), end: initializer.end, callback,
          replacement: `__developShiftBridge.${method}(${callback}, () => new backend_security_js_1.HttpRequestError(503, "develop_legacy_intake_closed", "Develop member writes are paused"))`});
      }
      ts.forEachChild(node, visit);
    };
    visit(parsed);
    if (wanted.size || patches.length !== 2) fail("environment_resolver_incomplete");
  } else {
    for (const entry of original.values()) {
      const resolver = entry.name.startsWith("validate") ?
        "req => { const envs = parseEnvList(req.query.envs ?? req.query.env); return envs.length ? envs : DEFAULT_VERSION_POLICY_ENVS; }" :
        entry.name === "upsertMemberByAdmin" ?
          "req => parseString(parseBody(req.body).env) || parseString(req.query.env) || ENV" :
          "req => String(req.query.env || ENV)";
      patches.push({...entry, replacement:
        `__developShiftBridge.wrapDevelopAdministrativeHttp(${JSON.stringify(entry.name)}, ${entry.callback}, ${resolver})`});
    }
  }
  patches.push(globalPreservationPatch(source));
  patches.sort((a, b) => b.start - a.start);
  let patched = source;
  for (const patch of patches) patched = patched.slice(0, patch.start) + patch.replacement + patched.slice(patch.end);
  let reconstructed = patched;
  for (const patch of patches) {
    const index = reconstructed.indexOf(patch.replacement);
    if (index < 0 || reconstructed.indexOf(patch.replacement, index + 1) !== -1) fail("legacy_patch_ambiguous");
    reconstructed = reconstructed.slice(0, index) + patch.callback + reconstructed.slice(index + patch.replacement.length);
  }
  if (reconstructed !== source || !patched.startsWith('"use strict";')) fail("legacy_patch_not_lossless");
  const strict = '"use strict";';
  return {source: strict + '\nconst __developShiftBridge = require("./develop-shift-intake-bridge.js");' + patched.slice(strict.length),
    names, patchCount: patches.length, originalCallbacksUnchanged: modern,
    registrations: [...original.values()].map(({name, constructor, options}) => ({name, constructor, options}))};
}

function prepareDevelopAdministrativeBridge(options) {
  const {sourceZip, outputDirectory, compiledDirectory, profile} = options;
  const modern = profile === "authorized-member1";
  const reminders = profile === "reminders3";
  if ((!modern && !reminders && profile !== "legacy-http8") || !path.isAbsolute(sourceZip) ||
      !path.isAbsolute(outputDirectory) || !path.isAbsolute(compiledDirectory) ||
      fs.existsSync(outputDirectory) || options.projectId !== PROJECT_ID || options.codebase !== "default") {
    fail("bridge_configuration_invalid");
  }
  const expectedZip = modern ? RESOLVE_PROFILE.zip : reminders ? REMINDER_PROFILE.zip : ZIP_SHA256;
  if (sha(fs.readFileSync(sourceZip)) !== expectedZip) fail("source_archive_digest_mismatch");
  const packageBytes = readZip(sourceZip, "package.json"), lockBytes = readZip(sourceZip, "package-lock.json");
  if (sha(lockBytes) !== (modern ? RESOLVE_PROFILE.lock : "38009fa8abd24f149347d2e571bc6dfcc6e96662cb389e5b21acf58d9068ef6a")) {
    fail("baseline_lock_changed");
  }
  const pkg = JSON.parse(packageBytes), lock = JSON.parse(lockBytes);
  const versions = Object.fromEntries(["firebase-admin", "firebase-functions", "@google-cloud/firestore", "googleapis"]
    .map((name) => [name, lock.packages[`node_modules/${name}`]?.version]));
  const expected = modern ? ["14.2.0", "7.3.2", "8.7.0", "144.0.0"] : ["13.4.0", "6.3.2", "7.11.1", "144.0.0"];
  if (pkg.main !== "lib/index.js" || pkg.engines.node !== "22" ||
      JSON.stringify(Object.values(versions)) !== JSON.stringify(expected)) fail("baseline_package_changed");
  const transformed = wrapAdministrativeSource(readZip(sourceZip, "lib/index.js"), profile);
  const packageOut = Buffer.from(JSON.stringify({...pkg, scripts: {...pkg.scripts, "gcp-build": ""}}, null, 2) + "\n");
  const files = {"package.json": packageOut, "package-lock.json": lockBytes,
    "lib/legacy.js": Buffer.from(transformed.source), "lib/index.js": Buffer.from('"use strict";\n' +
      'const legacy = require("./legacy.js");\n' + transformed.names.map((name) =>
      `exports.${name} = legacy.${name};`).join("\n") + "\n")};
  for (const name of ["develop-shift-intake", "develop-shift-intake-bridge"]) {
    const bytes = fs.readFileSync(path.join(compiledDirectory, `${name}.js`));
    const dependencies = [...bytes.toString("utf8").matchAll(/require\(["']([^"']+)["']\)/g)].map((match) => match[1]);
    if (dependencies.some((name) => !["node:crypto", "@google-cloud/firestore", "./develop-shift-intake.js"].includes(name))) {
      fail("bridge_dependency_outside_pack");
    }
    files[`lib/${name}.js`] = bytes;
  }
  if (modern) for (const [name, expectedHash] of Object.entries(RESOLVE_PROFILE.helpers)) {
    const bytes = readZip(sourceZip, name);
    if (sha(bytes) !== expectedHash) fail("helper_source_digest_mismatch");
    files[name] = bytes;
  }
  const observedRuntime = runtimeMetadata(options.runtimeMetadataPath, transformed.names);
  const configBytes = Buffer.from(JSON.stringify({functions: [
    {source: "runtime", codebase: "default", runtime: "nodejs22"},
  ]}, null, 2) + "\n");
  const manifest = {schemaVersion: 1, kind: reminders ? "develop-reminder-bridge-preparation" : "develop-administrative-http-bridge-preparation", profile,
    projectId: PROJECT_ID, codebase: "default", runtime: "nodejs22", canApply: false,
    sourceArchiveSha256: expectedZip, deployedJavaScriptSha256: modern ? RESOLVE_PROFILE.main : reminders ? REMINDER_PROFILE.main : LEGACY_JS_SHA256,
    originalPackageSha256: sha(packageBytes), generatedPackageSha256: sha(packageOut),
    packageDelta: {onlyAddedScript: "gcp-build", value: ""}, preservedLockSha256: sha(lockBytes), versions,
    exports: transformed.names, registrations: transformed.registrations, patchCount: transformed.patchCount,
    originalCallbacksUnchanged: transformed.originalCallbacksUnchanged,
    originalCallbackBodiesPreserved: true,
    runtimeMetadata: observedRuntime, requiredConfig: "firebase.http.json",
    requiredOnly: transformed.names.map((name) => `functions:${name}`).join(","),
    files: [...Object.entries(files).map(([name, bytes]) => ({path: `runtime/${name}`, sha256: sha(bytes)})),
      {path: "firebase.http.json", sha256: sha(configBytes)}],
    guards: {exactSelectorRequired: true, preserveExternalChanges: true, noDeploymentPerformed: true,
      mixedOrDefaultDevelopRequestsRejectedWhole: true, noRequestFilteringOrProductionSubset: true,
      directAndReviewerDevelopResolutionClosed: modern, oldInFlightOrAuthorityClosureClaimed: false,
      ...(reminders ? {schedulerJobsMustRemainPaused: true, functionBuildUpdateOnly: true,
        firebaseCliDeployForbidden: true, noSchedulerOrIamMutation: true} : {})},
    blockers: ["fresh_source_runtime_environment_and_iam_readbacks_required", "old_work_and_authority_unproved",
      ...(!observedRuntime ? ["fresh_runtime_metadata_required"] : [])],
    excluded: [".env", "source maps", "current application index", "credentials", "all unrelated exports"]};
  fs.mkdirSync(outputDirectory, {mode: 0o700});
  fs.mkdirSync(path.join(outputDirectory, "runtime/lib"), {recursive: true, mode: 0o700});
  for (const [name, bytes] of Object.entries(files)) {
    fs.writeFileSync(path.join(outputDirectory, "runtime", name), bytes, {flag: "wx", mode: 0o600});
  }
  fs.writeFileSync(path.join(outputDirectory, "firebase.http.json"), configBytes, {flag: "wx", mode: 0o600});
  fs.writeFileSync(path.join(outputDirectory, "bridge-manifest.json"), JSON.stringify(manifest, null, 2) + "\n",
    {flag: "wx", mode: 0o600});
  return manifest;
}

module.exports = {prepareDevelopIntakeBridge, prepareDevelopCaptureObservationUpdate,
  wrapLegacySource, prepareDevelopAdministrativeBridge,
  wrapAdministrativeSource, ZIP_SHA256, LEGACY_JS_SHA256, LEGACY, CAPTURE, ADMINISTRATIVE, RESOLVE_PROFILE, REMINDERS, REMINDER_PROFILE};
if (require.main === module) {
  const args = process.argv.slice(2);
  if (![10, 12, 14].includes(args.length) || args.some((value, i) => i % 2 === 0 &&
      !["--source-zip", "--output", "--compiled", "--project", "--codebase",
        "--runtime-metadata", "--profile"].includes(value)) ||
      new Set(args.filter((_, i) => i % 2 === 0)).size !== args.length / 2) fail("bridge_arguments_invalid");
  const flags = Object.fromEntries(Array.from({length: args.length / 2},
    (_, i) => [args[i * 2], args[i * 2 + 1]]));
  const prepare = flags["--profile"] === "capture-update4" ? prepareDevelopCaptureObservationUpdate :
    flags["--profile"] ? prepareDevelopAdministrativeBridge : prepareDevelopIntakeBridge;
  const result = prepare({sourceZip: flags["--source-zip"], profile: flags["--profile"],
    outputDirectory: flags["--output"], compiledDirectory: flags["--compiled"],
    projectId: flags["--project"], codebase: flags["--codebase"],
    runtimeMetadataPath: flags["--runtime-metadata"]});
  process.stdout.write(JSON.stringify({canApply: result.canApply, exportedCount: result.exports.length,
    sourceArchiveSha256: result.sourceArchiveSha256}) + "\n");
}
