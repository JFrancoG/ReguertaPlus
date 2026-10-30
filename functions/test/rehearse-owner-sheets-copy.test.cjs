"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {createRequire} = require("node:module");
const {spawnSync} = require("node:child_process");
const {test} = require("node:test");
const {Firestore} = require("@google-cloud/firestore");
const {google} = require("googleapis");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {SHIFT_PLANNING_COPY_TOKEN_SCOPES} = require("../lib/shift-planning-owner-sheets-copy-controls.js");
const {sheetsService, clone} = require("./shift-sheets-api-fixture.cjs");
const runnerPath = path.resolve(__dirname, "../scripts/rehearse-owner-sheets-copy.cjs");
const {validatePacket, assertOneNewTabPlan, runOwnerSheetsCopyRehearsal, createShortTokenAuth} = require(runnerPath);

const PROJECT = "demo-reguerta-copy-focused";
const HOST = "127.0.0.1:8897";
const COPY = "isolated-review-copy";
const ORIGINALS = ["protected-develop-original", "protected-production-original"];
const ROOT = "develop/plus-collections";
const OWNER = "runner-test-owner";
const RUNTIME = "runner-test-service";
const SERVICE_EMAIL = "runner@fixture.iam.gserviceaccount.com";
const emulatorAvailable = process.env.FIRESTORE_EMULATOR_HOST === HOST &&
  process.env.GCLOUD_PROJECT?.startsWith("demo-");

function packet(mode = "prepare") {
  const now = Date.now();
  return {schemaVersion: 1, copyWorkbookId: COPY, runId: "focused-copy-run",
    demoProjectId: PROJECT, protectedWorkbookIds: ORIGINALS, mode,
    ...(mode === "execute" ? {ownerConfirmation: {receiptId: "explicit-owner-confirmation",
      onlineClosedNoOfflineEdits: true, noManualOrAutomationWrites: true,
      noAdditionalTokenMinting: true, confirmedAtMillis: now - 10,
      startsAtMillis: now - 100, endsAtMillis: now + 60_000}} : {})};
}

async function localEnvironment(work) {
  const variables = ["GCLOUD_PROJECT", "FIRESTORE_EMULATOR_HOST", "GOOGLE_APPLICATION_CREDENTIALS"];
  const previous = Object.fromEntries(variables.map((name) => [name, process.env[name]]));
  Object.assign(process.env, {GCLOUD_PROJECT: PROJECT, FIRESTORE_EMULATOR_HOST: HOST,
    GOOGLE_APPLICATION_CREDENTIALS: path.join(os.tmpdir(), "no-copy-runner-adc-is-authorized.json")});
  try { return await work(); }
  finally {
    for (const name of variables) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
}

test("the runner admits only its isolated demo copy and a fresh bounded owner confirmation", async () => {
  await localEnvironment(() => {
    assert.equal(validatePacket(packet()).copyWorkbookId, COPY);
    assert.equal(validatePacket(packet("execute")).mode, "execute");
    for (const change of [
      (value) => { value.copyWorkbookId = ORIGINALS[0]; },
      (value) => { value.copyWorkbookId = ORIGINALS[1]; },
      (value) => { value.demoProjectId = "real-project-denied"; },
      (value) => { value.demoProjectId = "demo-reguerta-copy-another"; },
      (value) => { delete value.ownerConfirmation; },
      (value) => { value.ownerConfirmation.confirmedAtMillis = Date.now() - 120_001; },
      (value) => { value.ownerConfirmation.confirmedAtMillis = Date.now() + 60_000; },
      (value) => { value.ownerConfirmation.endsAtMillis = Date.now() - 1; },
      (value) => { value.ownerConfirmation.noAdditionalTokenMinting = false; },
    ]) {
      const value = packet("execute");
      change(value);
      assert.throws(() => validatePacket(value));
    }
    process.env.FIRESTORE_EMULATOR_HOST = "192.0.2.1:8897";
    assert.throws(() => validatePacket(packet()), /local demo boundaries/);
    process.env.FIRESTORE_EMULATOR_HOST = HOST;
    process.env.GCLOUD_PROJECT = "another-unapproved-project";
    assert.throws(() => validatePacket(packet()), /local demo boundaries/);
  });
});

test("a five-minute copy token produces SDK headers without renewal and expires locally without a provider retry", async () => {
  const token = "synthetic-short-lived-copy-token";
  const auth = createShortTokenAuth(token, Date.now() + 300_000);
  assert.equal(auth.credentials.refresh_token, undefined);
  assert.equal(auth.refreshHandler, undefined);
  let requests = 0;
  auth.transporter.request = async () => {
    requests += 1;
    throw new Error("A header-only SDK operation must not reach the transport");
  };
  const headers = await auth.getRequestHeaders("https://sheets.googleapis.com/v4/spreadsheets/copy-fixture");
  assert.equal(headers.Authorization, `Bearer ${token}`);
  assert.equal(requests, 0);
  for (const status of [401, 403]) {
    let providerCalls = 0;
    const rejection = Object.assign(new Error("Synthetic provider rejected the token"), {
      response: {status, config: {data: {requests: []}}},
    });
    auth.transporter.request = async (request) => {
      providerCalls += 1;
      assert.equal(request.headers.Authorization, `Bearer ${token}`);
      assert.equal(request.retry, false);
      throw rejection;
    };
    await assert.rejects(auth.request({url: "https://sheets.googleapis.com/v4/spreadsheets/copy-fixture:batchUpdate",
      method: "POST", data: {requests: []}, retry: false}), (error) => error === rejection);
    assert.equal(providerCalls, 1);
    assert.equal(auth.credentials.access_token, token);
    assert.equal(auth.credentials.refresh_token, undefined);
    assert.equal(auth.refreshHandler, undefined);
  }
  const expired = createShortTokenAuth(token, Date.now() - 100);
  let expiredRequests = 0;
  expired.transporter.request = async () => {
    expiredRequests += 1;
    throw new Error("Expired credentials must fail before any network request");
  };
  await assert.rejects(expired.getRequestHeaders(), /No refresh token/);
  await assert.rejects(expired.request({url: "https://sheets.googleapis.com/v4/spreadsheets/copy-fixture",
    method: "GET", retry: false}), /No refresh token/);
  assert.equal(expiredRequests, 0);
});

test("a reviewed one-tab plan cannot edit an original tab or smuggle an additional action", () => {
  const newId = 300, originalIds = [10, 20, 30];
  const title = "ENSAYO HU084 Mercado focused-copy-run";
  const allowed = [
    {addSheet: {properties: {sheetId: newId, title}}},
    {updateCells: {range: {sheetId: newId, startRowIndex: 0, startColumnIndex: 0},
      rows: [{values: [{userEnteredValue: {stringValue: "Synthetic turn"}}]}], fields: "userEnteredValue"}},
    {createDeveloperMetadata: {developerMetadata: {metadataKey: "operation", metadataValue: "single-copy-batch",
      visibility: "DOCUMENT", location: {sheetId: newId}}}},
  ];
  const planned = (requests) => ({batch: {requests}});
  assert.doesNotThrow(() => assertOneNewTabPlan(planned(allowed), title, originalIds));
  for (const extra of [
    {updateCells: {...allowed[1].updateCells, range: {...allowed[1].updateCells.range, sheetId: originalIds[0]}}},
    {createDeveloperMetadata: {developerMetadata: {...allowed[2].createDeveloperMetadata.developerMetadata,
      location: {sheetId: originalIds[1]}}}},
    {addSheet: {properties: {sheetId: 301, title: "Unreviewed additional tab"}}},
    {deleteSheet: {sheetId: originalIds[2]}},
    {updateCells: {...allowed[1].updateCells, fields: "userEnteredValue,note"}},
  ]) {
    assert.throws(() => assertOneNewTabPlan(planned([...allowed, extra]), title, originalIds));
  }
  const combined = [{...allowed[0], deleteSheet: {sheetId: originalIds[0]}}, ...allowed.slice(1)];
  assert.throws(() => assertOneNewTabPlan(planned(combined), title, originalIds));
  assert.throws(() => assertOneNewTabPlan(planned(allowed), title, [...originalIds, newId]));
});

test("no standalone invocation or missing parent session can load ambient credentials or reach a Google request", async () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "reguerta-copy-no-session-"));
  try {
    const child = spawnSync(process.execPath, [runnerPath], {encoding: "utf8", timeout: 20_000,
      env: {...process.env, GCLOUD_PROJECT: PROJECT, FIRESTORE_EMULATOR_HOST: HOST,
        GOOGLE_APPLICATION_CREDENTIALS: path.join(output, "missing-adc.json"),
        METADATA_SERVER_DETECTION: "none"}});
    assert.equal(child.status, 1);
    assert.match(child.stderr, /no standalone credentials are loaded/);
    assert.doesNotMatch(child.stderr, /Could not load the default credentials|ENOENT/);
    let sessions = 0;
    await localEnvironment(async () => {
      await assert.rejects(runOwnerSheetsCopyRehearsal({packet: packet(), outputDirectory: output,
        async openSession() { sessions += 1; return null; }}), /Explicit short-token session required/);
    });
    assert.equal(sessions, 1);
    assert.equal(fs.existsSync(path.join(output, "copy-runner.lock")), false);
    const cleanup = JSON.parse(fs.readFileSync(path.join(output, "local-cleanup.json"), "utf8"));
    assert.equal(cleanup.clientsClosed, true);
    assert.equal(cleanup.submitted, 0);
    assert.equal(cleanup.inFlight, 0);
    assert.equal(cleanup.unknown, 0);
    assert.equal(fs.existsSync(path.join(output, "prepared.json")), false);
  } finally { fs.rmSync(output, {recursive: true, force: true}); }
});

test("the source fence changes for executed source, compiled adapters and lockfile but ignores unrelated outputs", () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "reguerta-copy-source-fence-"));
  try {
    for (const directory of ["scripts", "src/nested", "lib", "test", "private-output"]) {
      fs.mkdirSync(path.join(folder, directory), {recursive: true});
    }
    const temporaryRunner = path.join(folder, "scripts/rehearse-owner-sheets-copy.cjs");
    const source = fs.readFileSync(runnerPath, "utf8");
    fs.writeFileSync(temporaryRunner, source);
    fs.writeFileSync(path.join(folder, "package-lock.json"), "{\"lockfileVersion\":3}\n");
    fs.writeFileSync(path.join(folder, "test/shift-planning-activation-fixture.cjs"), "module.exports = {};\n");
    fs.writeFileSync(path.join(folder, "src/nested/guard.ts"), "export const policy = 1;\n");
    fs.writeFileSync(path.join(folder, "lib/guard.js"), "exports.policy = 1;\n");
    // Execute the actual helper with a temporary __dirname in the same JS realm.
    // Imports stay bound to the real built modules; no repository file is changed.
    const temporaryModule = {exports: {}};
    new Function("exports", "require", "module", "__filename", "__dirname", source)(
      temporaryModule.exports, createRequire(runnerPath), temporaryModule,
      temporaryRunner, path.dirname(temporaryRunner));
    const fingerprint = temporaryModule.exports.runnerSourceDigest;
    let previous = fingerprint();
    assert.match(previous, /^shift-planning:v1:sha256:[a-f0-9]{64}$/);
    assert.equal(fingerprint(), previous);
    fs.writeFileSync(path.join(folder, "private-output/receipt.json"), "{\"changed\":true}\n");
    assert.equal(fingerprint(), previous);
    for (const [file, change] of [
      ["src/nested/guard.ts", "export const policy = 2;\n"],
      ["lib/guard.js", "exports.policy = 2;\n"],
      ["package-lock.json", "{\"lockfileVersion\":4}\n"],
      ["test/shift-planning-activation-fixture.cjs", "module.exports = {changed: true};\n"],
      ["scripts/rehearse-owner-sheets-copy.cjs", source + "\n// changed runner\n"],
    ]) {
      fs.writeFileSync(path.join(folder, file), change);
      const changed = fingerprint();
      assert.notEqual(changed, previous, file);
      previous = changed;
    }
  } finally { fs.rmSync(folder, {recursive: true, force: true}); }
});

async function runnerScenario(work) {
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, HOST);
  assert.ok(process.env.GCLOUD_PROJECT?.startsWith("demo-"));
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "reguerta-copy-runner-emulator-"));
  const client = new Firestore({projectId: PROJECT, host: HOST, ssl: false});
  const previousSheets = google.sheets, previousDrive = google.drive;
  try {
    const cleared = await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
      {method: "DELETE"});
    assert.equal(cleared.ok, true, await cleared.text());
    const service = sheetsService(COPY);
    service.state.properties = {title: "Synthetic rehearsal copy", locale: "es_ES", timeZone: "Europe/Madrid"};
    service.state.sheets = Array.from({length: 7}, (_, index) => ({
      properties: {sheetId: index + 10, title: `Original ${index + 1}`, index,
        sheetType: "GRID", hidden: false, gridProperties: {rowCount: 4, columnCount: 4,
          frozenRowCount: 0, frozenColumnCount: 0, hideGridlines: false}},
      protectedRanges: [], merges: [], developerMetadata: [],
      data: [{startRow: 0, startColumn: 0, rowData: [{values: [{
        userEnteredValue: {stringValue: `Original cell ${index + 1}`},
        userEnteredFormat: {backgroundColor: {red: 0.5}}, note: `Original note ${index + 1}`,
        chipRuns: [{startIndex: 0, chip: {personProperties: {email: "owner@example.test"}}}],
      }]}]}],
    }));
    const originalsBefore = clone(service.state.sheets);
    const requests = [];
    const drive = {files: {async get(params, options) {
      assert.equal(params.fileId, COPY);
      assert.equal(options.retry, false);
      requests.push({kind: "file", fields: params.fields});
      return {data: {id: COPY, mimeType: "application/vnd.google-apps.spreadsheet", trashed: false,
        version: String(10 + service.revision), contentRestrictions: [],
        owners: [{permissionId: OWNER, emailAddress: "owner@example.test", me: false}],
        capabilities: {canEdit: true, canModifyContent: true, canShare: true, canReadRevisions: true,
          canModifyEditorContentRestriction: true, canModifyOwnerContentRestriction: false,
          canRemoveContentRestriction: false}}};
    }}, permissions: {async list(params, options) {
      assert.equal(params.fileId, COPY);
      assert.equal(options.retry, false);
      requests.push({kind: "permissions"});
      return {data: {permissions: [
        {id: OWNER, type: "user", role: "owner", emailAddress: "owner@example.test", deleted: false,
          permissionDetails: [{permissionType: "file", role: "owner", inherited: false}]},
        {id: RUNTIME, type: "user", role: "writer", emailAddress: SERVICE_EMAIL, deleted: false,
          permissionDetails: [{permissionType: "file", role: "writer", inherited: false}]},
      ]}};
    }}, about: {async get(_params, options) {
      assert.equal(options.retry, false);
      requests.push({kind: "principal"});
      return {data: {user: {permissionId: RUNTIME, emailAddress: SERVICE_EMAIL, me: true}}};
    }}};
    const get = service.get, batch = service.batchUpdate;
    service.get = async (params, options) => {
      assert.equal(params.spreadsheetId, COPY);
      return get(params, options);
    };
    service.batchUpdate = async (params, options) => {
      assert.equal(params.spreadsheetId, COPY);
      try {
        // The SDK serializes its request; provider defaults must not mutate the
        // caller's sealed plan through a shared fixture object reference.
        return await batch(clone(params), options);
      } finally {
        for (const [index, sheet] of service.state.sheets.entries()) {
          sheet.properties.index ??= index;
          sheet.properties.sheetType ??= "GRID";
          sheet.properties.hidden ??= false;
          sheet.properties.gridProperties.frozenRowCount ??= 0;
          sheet.properties.gridProperties.frozenColumnCount ??= 0;
        }
      }
    };
    let factoryCalls = 0, sessions = 0;
    const requireExplicitToken = ({auth, version}, expectedVersion) => {
      assert.equal(version, expectedVersion);
      assert.equal(auth.credentials.access_token, "synthetic-explicit-copy-token");
      assert.ok(auth.credentials.expiry_date > Date.now());
      factoryCalls += 1;
    };
    google.sheets = (options) => { requireExplicitToken(options, "v4"); return {spreadsheets: service}; };
    google.drive = (options) => { requireExplicitToken(options, "v3"); return drive; };
    const openSession = async (lock) => {
      sessions += 1;
      const now = Date.now();
      const authority = {schemaVersion: 1, kind: "isolated-copy-authority", runId: "focused-copy-run",
        workbookId: COPY, protectedWorkbookIds: ORIGINALS, demoProjectId: PROJECT, firestoreHost: HOST,
        runnerInstanceId: lock.runnerInstanceId, runnerSourceDigest: lock.runnerSourceDigest,
        runnerStartedAtMillis: lock.runnerStartedAtMillis, lockNonceDigest: lock.lockNonceDigest,
        serviceAccountEmail: SERVICE_EMAIL, serviceAccountUniqueId: "100000000000000000003",
        drivePermissionId: RUNTIME, creationReceiptDigest: digest({identity: "test-session-created"}),
        grantPolicyDigest: digest({grant: "one-copy-test-binding"}), grantStartsAtMillis: now - 100,
        grantExpiresAtMillis: now + 600_000, tokenIssuedAtMillis: now, tokenExpiresAtMillis: now + 180_000,
        tokenScopes: [...SHIFT_PLANNING_COPY_TOKEN_SCOPES], maximumEvidenceAgeMillis: 60_000};
      return {accessToken: "synthetic-explicit-copy-token", tokenExpiresAtMillis: authority.tokenExpiresAtMillis,
        authority, async readProviderControls() {
          return {observedAtMillis: Date.now(), serviceAccountEmail: SERVICE_EMAIL,
            serviceAccountUniqueId: authority.serviceAccountUniqueId, serviceAccountDisabled: false,
            userManagedKeyCount: 0, directProjectRoleCount: 0, grantPolicyDigest: authority.grantPolicyDigest};
        }};
    };
    const records = async () => {
      const collections = await Promise.all(["shiftPlanningSyncCommands", "shiftPlanningOperations", "shiftPlanningState",
        "shifts", "notificationEvents", "users", "shiftPlanningBundles"]
        .map((name) => client.collection(`${ROOT}/${name}`).get()));
      const documents = collections.flatMap((snapshot) => snapshot.docs);
      for (const document of collections[0].docs) {
        documents.push(...(await document.ref.collection("externalSubmissions").get()).docs);
      }
      return documents.map((document) => ({path: document.ref.path, data: document.data(),
        updateTime: `${document.updateTime.seconds}:${document.updateTime.nanoseconds}`}))
        .sort((a, b) => a.path.localeCompare(b.path));
    };
    const market = async () => {
      const result = await client.collection(`${ROOT}/shiftPlanningSyncCommands`).where("type", "==", "market").get();
      assert.equal(result.size, 1);
      const command = result.docs[0];
      const receipt = await command.ref.collection("externalSubmissions").doc("sheets").get();
      return {command, receipt};
    };
    await localEnvironment(() => work({service, drive, requests, originalsBefore, client, output,
      openSession, records, market, factoryCalls: () => factoryCalls, sessions: () => sessions}));
  } finally {
    google.sheets = previousSheets;
    google.drive = previousDrive;
    await client.terminate();
    fs.rmSync(output, {recursive: true, force: true});
  }
}

test("the real copy runner completes one new market tab with ten turns and preserves all seven original raw tabs",
  {skip: !emulatorAvailable}, async () => {
    await runnerScenario(async (f) => {
      const result = await runOwnerSheetsCopyRehearsal({packet: packet("execute"),
        outputDirectory: f.output, openSession: f.openSession});
      assert.equal(result.kind, "completed");
      assert.equal(result.submitted, 1);
      assert.equal(f.factoryCalls(), 2);
      assert.equal(f.service.mutations.length, 1);
      assert.equal(f.service.state.sheets.length, 8);
      assert.deepEqual(clone(f.service.state.sheets.slice(0, 7)), f.originalsBefore);
      const before = JSON.parse(fs.readFileSync(path.join(f.output, "original-tabs-before.json"), "utf8"));
      const after = JSON.parse(fs.readFileSync(path.join(f.output, "original-tabs-after.json"), "utf8"));
      assert.equal(before.digest, after.digest);
      assert.deepEqual(before.snapshot, after.snapshot);
      const {command, receipt} = await f.market();
      assert.equal(command.get("state"), "completed");
      assert.equal(receipt.get("guardIncident"), null);
      assert.equal(receipt.get("readable.rows").length, 10);
      const added = f.service.state.sheets.find((sheet) => sheet.properties.title === result.title);
      assert.ok(added);
      const dates = added.data[0].rowData.flatMap((row) => row?.values?.[0]?.userEnteredValue?.stringValue ?? [])
        .filter((value) => /^\d{2}\/\d{2}\/\d{4}$/.test(value));
      assert.equal(dates.length, 10);
      assert.deepEqual(dates, receipt.get("readable.rows").map((row) => row.visibleDate.split("-").reverse().join("/")));
      assert.equal((await f.client.collection(`${ROOT}/notificationEvents`).get()).empty, true);
    });
  });

test("the runner raw postimage detects an original-tab display change before completing and retains the incident",
  {skip: !emulatorAvailable}, async () => {
    await runnerScenario(async (f) => {
      const get = f.drive.files.get;
      let changed = false;
      f.drive.files.get = async (params, options) => {
        if (!changed && f.service.mutations.length === 1 && params.fields === "id,version") {
          f.service.state.sheets[0].properties.gridProperties.hideGridlines = true;
          f.service.revision += 1;
          changed = true;
        }
        return get(params, options);
      };
      await assert.rejects(runOwnerSheetsCopyRehearsal({packet: packet("execute"),
        outputDirectory: f.output, openSession: f.openSession}), /original tabs changed before completion/);
      assert.equal(changed, true);
      assert.equal(f.service.mutations.length, 1);
      assert.equal(f.service.state.sheets[0].properties.gridProperties.hideGridlines, true);
      const {command, receipt} = await f.market();
      assert.equal(command.get("state"), "processing");
      assert.ok(receipt.get("evidence"));
      assert.equal(receipt.get("guardIncident.phase"), "completion");
      const pointer = await f.client.doc(`${ROOT}/shiftPlanningState/sheetsSubmission`).get();
      assert.deepEqual(pointer.get("guardIncident"), receipt.get("guardIncident"));
      const before = JSON.parse(fs.readFileSync(path.join(f.output, "original-tabs-before.json"), "utf8"));
      const after = JSON.parse(fs.readFileSync(path.join(f.output, "original-tabs-after.json"), "utf8"));
      assert.notEqual(after.digest, before.digest);
      assert.equal(after.snapshot.sheets[0].properties.gridProperties.hideGridlines, true);
      assert.equal((await f.client.doc(`${ROOT}/shiftPlanningState/sourcePolicy`).get()).get("sync.partitions.market.lease") !== null,
        true);
    });
  });

test("a new runner instance inspects an unacknowledged non-applied seven-tab batch without writing or changing its registry",
  {skip: !emulatorAvailable}, async () => {
    await runnerScenario(async (f) => {
      f.service.rejectBeforeApply = true;
      await assert.rejects(runOwnerSheetsCopyRehearsal({packet: packet("execute"),
        outputDirectory: f.output, openSession: f.openSession}));
      assert.equal(f.service.mutations.length, 1);
      assert.equal(f.service.revision, 0);
      assert.equal(f.service.state.sheets.length, 7);
      assert.deepEqual(clone(f.service.state.sheets), f.originalsBefore);
      const retained = await f.market();
      assert.equal(retained.command.get("state"), "processing");
      assert.equal(retained.receipt.get("evidence"), null);
      assert.ok(retained.receipt.get("guardIncident"));
      const recordsBefore = await f.records();
      f.service.rejectBeforeApply = false;
      const inspection = await runOwnerSheetsCopyRehearsal({packet: packet("inspect"),
        outputDirectory: path.join(f.output, "second-instance"), openSession: f.openSession});
      assert.equal(f.sessions(), 2);
      assert.equal(inspection.kind, "inspected");
      assert.equal(inspection.physicalPostimageMatches, false);
      assert.equal(inspection.canComplete, false);
      assert.equal(inspection.submitted, 0);
      assert.equal(f.service.mutations.length, 1);
      assert.equal(f.service.revision, 0);
      assert.deepEqual(await f.records(), recordsBefore);
      const evidence = JSON.parse(fs.readFileSync(path.join(f.output, "second-instance/inspection.json"), "utf8"));
      assert.equal(evidence.canResubmit, false);
      assert.equal(evidence.receiptUnmodified, true);
      assert.equal(evidence.physicalPostimageMatches, false);
    });
  });


test("a rejected parent plan stops the actual runner before the only Sheets batch",
  {skip: !emulatorAvailable}, async () => {
    await runnerScenario(async (f) => {
      let reviews = 0;
      await assert.rejects(runOwnerSheetsCopyRehearsal({packet: packet("execute"),
        outputDirectory: f.output, openSession: f.openSession,
        async onPrepared(review) {
          reviews++;
          assert.equal(review.workbookId, COPY);
          assert.equal(review.runtimeEmail, SERVICE_EMAIL);
          assert.equal(review.runtimePermissionId, RUNTIME);
          assert.equal(review.ownerPermissionId, OWNER);
          assert.match(review.originalTabsDigest, /^shift-planning:v1:sha256:[a-f0-9]{64}$/);
          assert.equal(review.expectedRows, 10);
          assert.equal(review.requests, 45);
          throw Error("Parent rejected baseline");
        }}), /Parent rejected baseline/);
      assert.equal(reviews, 1);
      assert.equal(f.service.mutations.length, 0);
      assert.deepEqual(clone(f.service.state.sheets), f.originalsBefore);
    });
  });
