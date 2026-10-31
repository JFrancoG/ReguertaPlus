"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {test} = require("node:test");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {prepare, runCheck, runWithExplicitCredentials, IDENTITY} = require("../scripts/prepare-develop-original-writer-check.cjs");
const {FILE, PARENT, OWNER, WRITER, PERMISSION, TABS, REQUEST, READERS, metadataFingerprint,
  createWorkbookAccess, createOwnerReader, snapshot} = require("../scripts/develop-original-writer-provider.cjs");
const NOW = 1793448000000, HASH = digest("reviewed-local-fixture"), SECRET = "fixture-secret-never-recorded";
function metadata() {
  const owners = [{emailAddress: OWNER, permissionId: "owner-id", me: true}];
  const ownerPermission = {id: "owner-id", type: "user", role: "owner", emailAddress: OWNER};
  return {file: {id: FILE, mimeType: "application/vnd.google-apps.spreadsheet", trashed: false,
    version: "278", parents: [PARENT], owners, capabilities: {canEdit: true, canModifyContent: true, canShare: true}},
  filePermissions: [ownerPermission, ...READERS.map((emailAddress, i) => ({id: `reader-${i}`, emailAddress, type: "user", role: "reader"}))]
    .sort((a, b) => a.id.localeCompare(b.id)),
  parent: {id: PARENT, mimeType: "application/vnd.google-apps.folder", trashed: false, version: "99", owners},
  parentPermissions: [ownerPermission]};
}
function grid() {
  return {spreadsheetId: FILE, properties: {locale: "es_ES"}, sheets: TABS.map((tab, index) => ({
    properties: {sheetId: tab.id, title: tab.title, index},
    data: [{rowData: [{values: [{userEnteredValue: {stringValue: "Fecha"}, note: "preserve note"}]}]}],
  }))};
}
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "original-writer-"));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const state = {now: NOW, disabled: true, policy: {version: 3, etag: "first", bindings: []}, metadata: metadata(),
    grid: grid(), calls: [], mints: 0, writes: 0, revoked: false, lostWrite: false, alteredWrite: false, denyStatus: 404};
  const prepared = prepare(), approval = {...prepared.approvalTemplate, authorized: true,
    receiptId: "original-probe-approval", preparationDigest: prepared.preparationDigest,
    startsAtMillis: NOW, endsAtMillis: NOW + 600000, ownerWindowReceiptId: "owner-window-receipt",
    onlineClosedNoOfflineEdits: true, noOtherWritesOrTokens: true, ownerChannelReviewDigest: HASH,
    controlsDigest: HASH, baselineMetadataDigest: metadataFingerprint(state.metadata), baselineSnapshotDigest: snapshot(state.grid).digest};
  const iam = {
    async readIdentity() { return {account: {...IDENTITY, disabled: state.disabled}, keys: {keys: []},
      project: {projectId: "reguerta-9f27f"}, projectPolicy: {bindings: []}, policy: structuredClone(state.policy)}; },
    async enableOwned() { state.calls.push("enable"); state.disabled = false; },
    async disableOwned() { state.calls.push("disable"); state.disabled = true; },
    async setPolicy(policy) { assert.equal(policy.etag, state.policy.etag); state.calls.push("iam-policy");
      state.policy = {...structuredClone(policy), etag: policy.etag + "+"}; },
    async hasMintPermission() { return true; },
    async mint(body) { assert.deepEqual(body, prepared.tokenRequest); state.calls.push("mint"); state.mints++;
      assert.ok(state.now - NOW >= 120000);
      return {accessToken: SECRET, expireTime: new Date(state.now + 300000).toISOString()}; },
  };
  const ownerChannel = {kind: "native-drive-owner-sharing", reviewDigest: HASH,
    async grant(action) {
      assert.deepEqual(action, {fileId: FILE, permissionId: PERMISSION, role: "writer", type: "user", emailAddress: WRITER});
      state.calls.push("grant-file"); state.metadata.filePermissions.push({id: PERMISSION, role: "writer", type: "user", emailAddress: WRITER});
      state.metadata.filePermissions.sort((a, b) => a.id.localeCompare(b.id));
    },
    async remove(action) { assert.equal(action.permissionId, PERMISSION); state.calls.push("remove-file");
      state.metadata.filePermissions = state.metadata.filePermissions.filter(p => p.id !== PERMISSION); },
  };
  const owner = {async read() { return structuredClone(state.metadata); }, async close() { state.calls.push("revoke-owner");
    state.revoked = true; return {revoked: true, sameTokenStatus: 401}; }};
  async function fetchImpl(url, options) {
    assert.equal(options.redirect, "error"); assert.ok(options.signal);
    assert.equal(options.headers.Authorization, `Bearer ${SECRET}`);
    const u = new URL(url), granted = state.metadata.filePermissions.some(p => p.id === PERMISSION);
    state.calls.push(`${options.method} ${u.pathname}`);
    // The writer must never query the owner's parent (nor another file).
    assert.ok(u.pathname.includes(FILE)); assert.ok(!u.pathname.includes(PARENT));
    if (!granted) return {status: state.denyStatus, json: async () => ({})};
    let data;
    if (options.method === "POST") {
      assert.equal(u.pathname, `/v4/spreadsheets/${FILE}:batchUpdate`);
      assert.deepEqual(JSON.parse(options.body), REQUEST()); state.writes++;
      state.metadata.file.version = String(Number(state.metadata.file.version) + 1);
      if (state.alteredWrite) state.grid.sheets[1].data[0].rowData[0].values[0].note = "external edit";
      if (state.lostWrite) throw Error(SECRET);
      data = {spreadsheetId: FILE, replies: [{}]};
    } else if (u.pathname.endsWith("/permissions")) data = {permissions: state.metadata.filePermissions};
    else if (u.pathname.startsWith("/drive/")) {
      data = u.searchParams.get("fields") === "id" ? {id: FILE} : structuredClone(state.metadata.file);
      if (data.owners) data.owners.forEach(o => { o.me = false; });
    }
    else { assert.equal(u.searchParams.getAll("ranges").length, 6); data = state.grid; }
    return {status: 200, json: async () => structuredClone(data)};
  }
  const args = {input: approval, iam, owner, ownerChannel,
    openWorkbook: writerBearer => createWorkbookAccess({writerBearer, fetchImpl}), journalRoot: root,
    async readIndependentControls() { return {observedAtMillis: state.now, controlsDigest: HASH, writerIsolated: true, developFencesHeld: true}; },
    nowMillis: () => state.now, async sleep(ms) { state.now += ms; }};
  return {state, args, root, receipts: () => fs.readdirSync(path.join(root, approval.receiptId))
    .map(file => fs.readFileSync(path.join(root, approval.receiptId, file), "utf8")).join("\n")};
}

test("inert preparation binds source/request and rejects wrong approval before any provider access", async t => {
  assert.equal(prepare().canExecute || prepare().canEnterMaintenance, false);
  for (const change of [a => { a.authorized = false; }, a => { a.preparationDigest = HASH; },
    a => { a.kind = "authorized-single-synthetic-copy-rehearsal"; }, a => { a.endsAtMillis = NOW + 600001; },
    a => { a.startsAtMillis = NOW + 1; }, a => { a.noOtherWritesOrTokens = false; }, a => { a.fileId = "other"; }]) {
    const f = fixture(t); change(f.args.input); await assert.rejects(runCheck(f.args)); assert.deepEqual(f.state.calls, []);
  }
});

test("exact provider performs one same-value write, preserves six tabs and revokes access with same token", async t => {
  const f = fixture(t), before = snapshot(f.state.grid).digest;
  const result = await runCheck(f.args);
  assert.equal(result.kind, "original-probe-contained"); assert.equal(f.state.mints, 1); assert.equal(f.state.writes, 1);
  assert.equal(snapshot(f.state.grid).digest, before); assert.equal(f.state.metadata.file.version, "279");
  assert.equal(f.state.disabled, true); assert.deepEqual(f.state.policy.bindings, []); assert.equal(f.state.revoked, true);
  assert.equal(f.state.metadata.filePermissions.length, 5); assert.equal(result.grantsMigrationAuthority, false);
  assert.equal(f.receipts().includes(SECRET), false);
  const calls = f.state.calls.length;
  await assert.rejects(runCheck(f.args), {code: "EEXIST"}); assert.equal(f.state.calls.length, calls);
});

test("active per-file lock prevents a different approval from concurrent use", async t => {
  const f = fixture(t); fs.mkdirSync(path.join(f.root, "original-develop-active"));
  await assert.rejects(runCheck(f.args), {code: "EEXIST"}); assert.deepEqual(f.state.calls, []);
});

for (const variant of ["wrong-owner", "existing-writer", "extra-editor", "stale-baseline", "stale-controls", "foreign-identity", "reader-is-not-owner"]) {
  test(`preflight denies ${variant} without enable, mint or file mutation`, async t => {
    const f = fixture(t);
    if (variant === "wrong-owner") f.state.metadata.file.owners[0].emailAddress = "foreign@example.test";
    if (variant === "reader-is-not-owner") f.state.metadata.file.owners[0].me = false;
    if (variant === "existing-writer") await f.args.ownerChannel.grant({fileId: FILE, permissionId: PERMISSION, role: "writer", type: "user", emailAddress: WRITER});
    if (variant === "extra-editor") f.state.metadata.filePermissions.push({id: "extra", type: "user", role: "writer", emailAddress: "extra@example.test"});
    if (variant === "stale-baseline") f.args.input.baselineMetadataDigest = HASH;
    if (variant === "stale-controls") f.args.readIndependentControls = async () => ({observedAtMillis: NOW - 60001, controlsDigest: HASH});
    if (variant === "foreign-identity") { const read = f.args.iam.readIdentity; f.args.iam.readIdentity = async () => {
      const v = await read(); v.account.uniqueId = "100000000000000000001"; return v; }; }
    f.state.calls = [];
    const result = await runCheck(f.args);
    assert.equal(result.kind, "inspection_required"); assert.equal(f.state.mints + f.state.writes, 0);
    assert.deepEqual(f.state.calls, ["revoke-owner"]);
  });
}

for (const variant of ["lost-enable", "lost-iam-grant", "lost-file-grant", "mint-denied", "permission-timeout", "late-mint", "changed-cell", "writer-cannot-share"]) {
  test(`${variant} never retries and independently contains the identity`, async t => {
    const f = fixture(t);
    if (variant === "lost-enable") f.args.iam.enableOwned = async () => { f.state.disabled = false; throw Error(SECRET); };
    if (variant === "lost-iam-grant") { const set = f.args.iam.setPolicy;
      f.args.iam.setPolicy = async p => { await set(p); if (p.bindings.length) throw Error(SECRET); }; }
    if (variant === "lost-file-grant") { const grant = f.args.ownerChannel.grant;
      f.args.ownerChannel.grant = async p => { await grant(p); throw Error(SECRET); }; }
    if (variant === "mint-denied") f.args.iam.mint = async () => { f.state.mints++; throw Object.assign(Error(SECRET), {httpStatus: 403}); };
    if (variant === "permission-timeout") f.args.iam.hasMintPermission = async () => false;
    if (variant === "late-mint") { const mint = f.args.iam.mint;
      f.args.iam.mint = async p => { const value = await mint(p); f.state.now += 300000; return value; }; }
    if (variant === "changed-cell") f.state.grid.sheets[1].data[0].rowData[0].values[0].note = "changed since review";
    if (variant === "writer-cannot-share") f.state.metadata.file.capabilities.canShare = false;
    const result = await runCheck(f.args);
    assert.equal(result.kind, "inspection_required"); assert.ok(f.state.mints <= 1); assert.equal(f.state.writes, 0);
    assert.equal(f.state.disabled, true); assert.deepEqual(f.state.policy.bindings, []);
    assert.equal(f.state.metadata.filePermissions.length, 5); assert.equal(f.state.revoked, true);
    assert.equal(f.receipts().includes(SECRET), false);
  });
}

for (const variant of ["lost-write-response", "changed-postimage"]) {
  test(`${variant} inspects without resubmitting and still cleans all permissions`, async t => {
    const f = fixture(t); f.state.lostWrite = variant === "lost-write-response"; f.state.alteredWrite = variant === "changed-postimage";
    const result = await runCheck(f.args);
    assert.equal(result.kind, "inspection_required"); assert.equal(result.writeVerified, false);
    assert.equal(f.state.writes, 1); assert.equal(f.state.mints, 1); assert.deepEqual(result.cleanupFailures, []);
    assert.equal(f.state.metadata.filePermissions.length, 5); assert.equal(f.state.disabled, true);
    assert.equal(f.receipts().includes(SECRET), false);
    assert.ok(f.receipts().includes("afterDigest"));
  });
}

for (const variant of ["remove-file", "expired-denial", "disable", "revoke-owner", "foreign-grant"]) {
  test(`cleanup failure ${variant} remains visible and retains the process lock`, async t => {
    const f = fixture(t);
    if (variant === "remove-file") f.args.ownerChannel.remove = async () => { throw Error(SECRET); };
    if (variant === "expired-denial") f.state.denyStatus = 401;
    if (variant === "disable") f.args.iam.disableOwned = async () => { throw Error(SECRET); };
    if (variant === "revoke-owner") f.args.owner.close = async () => { throw Error(SECRET); };
    const foreign = {role: "roles/viewer", members: ["user:other@example.test"]};
    if (variant === "foreign-grant") { const remove = f.args.ownerChannel.remove;
      f.args.ownerChannel.remove = async a => { await remove(a); f.state.policy.bindings.push(foreign); }; }
    const result = await runCheck(f.args);
    assert.equal(result.kind, "inspection_required"); assert.ok(result.cleanupFailures.length > 0);
    assert.equal(fs.existsSync(path.join(f.root, "original-develop-active")), true);
    assert.equal(f.state.mints, 1); assert.equal(f.state.writes, 1);
    if (variant !== "disable") assert.equal(f.state.disabled, true);
    if (variant === "foreign-grant") assert.deepEqual(f.state.policy.bindings, [foreign]);
    else assert.deepEqual(f.state.policy.bindings, []);
    assert.equal(f.receipts().includes(SECRET), false);
  });
}

test("owner read-only transport exhausts pages, brackets version and revokes without any permission mutation", async () => {
  const m = metadata(), calls = [];
  let revoked = false;
  const owner = createOwnerReader({ownerBearer: SECRET, async fetchImpl(url, options) {
    const u = new URL(url); calls.push({url, method: options.method});
    assert.equal(options.redirect, "error");
    if (u.hostname === "oauth2.googleapis.com") { assert.equal(options.method, "POST"); revoked = true;
      assert.equal(new URLSearchParams(options.body).get("token"), SECRET); return {status: 200}; }
    assert.equal(options.method, "GET"); assert.ok([`/drive/v3/files/${FILE}`, `/drive/v3/files/${PARENT}`,
      `/drive/v3/files/${FILE}/permissions`, `/drive/v3/files/${PARENT}/permissions`].includes(u.pathname));
    if (revoked) return {status: 401, json: async () => ({})};
    let data;
    if (u.pathname.endsWith("/permissions")) {
      if (u.pathname.includes(PARENT)) data = {permissions: m.parentPermissions};
      else data = u.searchParams.has("pageToken") ? {permissions: m.filePermissions.slice(2)} : {permissions: m.filePermissions.slice(0, 2), nextPageToken: "next"};
    } else data = u.pathname.endsWith(PARENT) ? m.parent : m.file;
    return {status: 200, json: async () => structuredClone(data)};
  }});
  assert.deepEqual(await owner.read(), m); assert.deepEqual(await owner.close(), {revoked: true, sameTokenStatus: 401});
  assert.equal(calls.filter(x => x.method !== "GET").length, 1);
  await assert.rejects(owner.read());
});

test("writer transport consumes a lost write before invocation and cannot submit a second batch", async () => {
  let calls = 0;
  const access = createWorkbookAccess({writerBearer: SECRET, async fetchImpl() { calls++; throw Error("lost"); }});
  await assert.rejects(access.writeSameHeader()); await assert.rejects(access.writeSameHeader()); assert.equal(calls, 1);
  access.close(); await assert.rejects(access.probeAccess()); assert.equal(calls, 1);
});

for (const variant of ["controls-withdrawn", "version-drift", "wrong-header", "extra-tab"]) {
  test(`changed admission ${variant} stops before the header request`, async t => {
    const f = fixture(t);
    if (variant === "controls-withdrawn") {
      let reads = 0;
      f.args.readIndependentControls = async () => ({observedAtMillis: f.state.now, controlsDigest: HASH,
        writerIsolated: true, developFencesHeld: ++reads < 3});
    }
    if (variant === "version-drift") {
      const open = f.args.openWorkbook;
      f.args.openWorkbook = token => { const book = open(token), read = book.readSnapshot;
        book.readSnapshot = async () => { const data = await read(); f.state.metadata.file.version = "999"; return data; }; return book; };
    }
    if (variant === "wrong-header") f.state.grid.sheets[0].data[0].rowData[0].values[0].userEnteredValue = {stringValue: "Otro"};
    if (variant === "extra-tab") f.state.grid.sheets.push({properties: {sheetId: 42, title: "unreviewed"}});
    const result = await runCheck(f.args);
    assert.equal(result.kind, "inspection_required"); assert.equal(f.state.writes, 0);
    assert.equal(f.state.metadata.filePermissions.length, 5); assert.equal(f.state.disabled, true);
  });
}

test("changed unrelated reader is preserved while the exact new writer is removed", async t => {
  const f = fixture(t), remove = f.args.ownerChannel.remove;
  f.args.ownerChannel.remove = async a => {
    await remove(a); f.state.metadata.filePermissions.find(p => p.role === "reader").role = "writer";
  };
  const result = await runCheck(f.args);
  assert.equal(result.kind, "inspection_required"); assert.equal(f.state.disabled, true);
  assert.equal(f.state.metadata.filePermissions.some(p => p.id === PERMISSION), false);
  assert.equal(f.state.metadata.filePermissions.filter(p => p.role === "writer").length, 1);
});

test("unexpected parent or cyclic permission pagination cannot expand owner read scope", async () => {
  for (const mode of ["parent", "pages"]) {
    const calls = [], m = metadata();
    if (mode === "parent") m.file.parents = ["foreign-folder"];
    const reader = createOwnerReader({ownerBearer: SECRET, async fetchImpl(url) {
      calls.push(url); assert.ok(url.includes(FILE));
      const data = url.includes("/permissions?") ? {permissions: [], nextPageToken: "same-page"} : m.file;
      return {status: 200, json: async () => data};
    }});
    await assert.rejects(reader.read()); assert.ok(calls.length <= 3);
  }
});


test("explicit composition revokes owner OAuth even if the local journal lock rejects startup", async t => {
  const f = fixture(t), originalFetch = global.fetch, calls = [];
  t.after(() => { global.fetch = originalFetch; });
  global.fetch = async (url, options) => {
    calls.push(url);
    if (url === "https://oauth2.googleapis.com/revoke") {
      assert.equal(options.method, "POST"); return {status: 200};
    }
    assert.ok(url.startsWith(`https://www.googleapis.com/drive/v3/files/${FILE}?`));
    return {status: 401, json: async () => ({})};
  };
  fs.mkdirSync(path.join(f.root, "original-develop-active"));
  const start = Date.now();
  await assert.rejects(runWithExplicitCredentials({input: {...f.args.input, startsAtMillis: start, endsAtMillis: start + 600000},
    journalRoot: f.root, iamBearer: SECRET, ownerBearer: SECRET, ownerChannel: f.args.ownerChannel,
    readIndependentControls: f.args.readIndependentControls}), {code: "EEXIST"});
  assert.equal(calls.length, 2); assert.equal(f.state.mints + f.state.writes, 0);
});
