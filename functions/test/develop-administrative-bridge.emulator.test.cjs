"use strict";
const {test, after} = require("node:test");
const assert = require("node:assert/strict");
const {Firestore, Timestamp} = require("@google-cloud/firestore");
const {loadExactLegacy, normalize} = require("./develop-legacy-pause-rehearsal-vm.cjs");
const bridge = require("../lib/develop-shift-intake-bridge.js");
const {ADMINISTRATIVE} = require("../scripts/prepare-develop-intake-bridge.cjs");
assert.ok(process.env.HU084_REMAINING_LEGACY_SOURCES, "private_sources_required");
assert.equal(process.env.GCLOUD_PROJECT, "demo-reguerta-writer-controls");
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8897");
const db = new Firestore({projectId: "demo-reguerta-writer-controls", host: "127.0.0.1:8897", ssl: false});
after(async () => { await db.terminate(); });
const fixedTimestampMillis = Date.parse("2026-10-28T12:00:00Z");
const common = {fixedTimestampMillis};
const member = {displayName: "Member", normalizedEmail: "member@example.test", roles: ["member"],
  isActive: true, authUid: "fixture-uid", producerCatalogEnabled: false};
async function seed({firstLink = false, reviewer = false} = {}) {
  for (const environment of ["production", "develop", "local"]) {
    await db.recursiveDelete(db.doc(`${environment}/collections`));
    await db.recursiveDelete(db.doc(`${environment}/plus-collections`));
    for (const dataset of ["collections", "plus-collections"]) {
      const root = `${environment}/${dataset}`;
      await db.doc(`${root}/config/global`).set({deliveryDayOfWeek: "WED", cacheExpirationMinutes: -5,
        lastTimestamps: {}, ...(reviewer && environment === "production" ? {reviewerAllowlistUids: ["fixture-uid"]} : {})});
      await db.doc(`${root}/users/administrator`).set({displayName: "Admin", authUid: "admin-uid", roles: ["admin"], isActive: true});
      await db.doc(`${root}/users/member`).set({...member, authUid: firstLink ? null : member.authUid});
      if (!firstLink) await db.doc(`${root}/authLinks/fixture-uid`).set({memberId: "member"});
    }
  }
}
async function image() {
  const result = {};
  for (const environment of ["production", "develop", "local"]) for (const dataset of ["collections", "plus-collections"]) {
    for (const name of ["config", "users", "authLinks"]) {
      const collection = `${environment}/${dataset}/${name}`;
      result[collection] = Object.fromEntries((await db.collection(collection).get()).docs
        .map((doc) => [doc.id, normalize(doc.data())]));
    }
  }
  return result;
}
async function invoke(harness, name, overrides = {}) {
  const request = {method: "POST", query: {env: "production"}, headers: {authorization: "Bearer fixture-token"},
    body: name === "upsertMemberByAdmin" ? {env: "production", actorAuthUid: "admin-uid", memberId: "member",
      displayName: "Changed member", normalizedEmail: "member@example.test", isActive: true, roles: ["member"]} :
      name === "resolveAuthorizedMember" ? {environment: "production"} : {}, ...overrides};
  let response;
  const res = {status(code) { response = {code}; return this; },
    json(body) { response.body = normalize(body); return this; },
    send(body) { response.body = body; return this; }};
  await harness.handlers[name](request, res);
  return response;
}
const load = (options = {}, wrapped = false) => loadExactLegacy(db, {...common, ...options,
  ...(wrapped ? {administrativeBridgeWrappers: bridge} : {})});

for (const name of ADMINISTRATIVE) test(`emitted administrative bridge preserves production ${name} response, trace and real afterimages`, async () => {
  await seed();
  const baseline = load(), response = await invoke(baseline, name), expected = await image();
  assert.equal(response.code, 200); assert.ok(baseline.mutations.length > 0);
  await seed();
  const candidate = load({}, true);
  assert.deepEqual(await invoke(candidate, name), response);
  assert.deepEqual(candidate.trace, baseline.trace);
  assert.deepEqual(await image(), expected);
});

test("old resolvers preserve query/body precedence and production defaults without altering request", async () => {
  for (const [name, overrides, options] of [
    ["onProductWrite", {query: {env: "production"}, body: {env: "develop"}}, {}],
    ["onOrderWrite", {query: {}}, {defaultEnv: "production"}],
    ["onUserWrite", {query: {}}, {defaultEnv: null, runtimeEnv: "production"}],
    ["onMeasureWrite", {query: {env: ["production"]}}, {}],
    ["upsertMemberByAdmin", {query: {env: "develop"}, body: {env: " production ", actorAuthUid: "admin-uid",
      memberId: "member", displayName: "Changed", normalizedEmail: "member@example.test"}}, {}],
    ["validateGlobalVersionPolicy", {query: {envs: [" PRODUCTION ", "production"]}}, {}],
    ["validateGlobalFreshnessConfig", {query: {envs: "production, PRODUCTION"}}, {}],
  ]) {
    await seed(); const baseline = load(options), response = await invoke(baseline, name, overrides), expected = await image();
    assert.equal(response.code, 200);
    await seed(); const candidate = load(options, true);
    assert.deepEqual(await invoke(candidate, name, overrides), response);
    assert.deepEqual(candidate.trace, baseline.trace); assert.deepEqual(await image(), expected);
  }
});

test("all old develop writes and whole default/mixed validator requests stop before every original port", async () => {
  await seed(); const before = await image();
  for (const name of ADMINISTRATIVE) {
    const candidate = load({}, true);
    const response = await invoke(candidate, name, {query: {env: "develop"}, body: {env: "develop"}});
    assert.equal(response.code, 503); assert.deepEqual(candidate.trace, []); assert.deepEqual(candidate.mutations, []);
  }
  for (const name of ADMINISTRATIVE.filter((name) => name.startsWith("validate"))) for (const query of [
    {}, {envs: "production,develop"}, {envs: ["production", " DEVELOP "]}, {envs: "", env: "production"},
  ]) {
    const candidate = load({defaultEnv: "production"}, true);
    assert.equal((await invoke(candidate, name, {query})).code, 503);
    assert.deepEqual(candidate.trace, []);
  }
  assert.deepEqual(await image(), before);
});

test("old production method and administrator error responses remain original", async () => {
  for (const overrides of [{method: "GET"}, {body: {env: "production"}},
    {body: {env: "production", actorAuthUid: "missing", displayName: "Member", email: "member@example.test"}}]) {
    await seed(); const baseline = load(), response = await invoke(baseline, "upsertMemberByAdmin", overrides), expected = await image();
    assert.ok([400, 403, 405].includes(response.code));
    await seed(); const candidate = load({}, true);
    assert.deepEqual(await invoke(candidate, "upsertMemberByAdmin", overrides), response);
    assert.deepEqual(candidate.trace, baseline.trace); assert.deepEqual(await image(), expected);
  }
});

for (const firstLink of [false, true]) test(`modern emitted resolve preserves production ${firstLink ? "first link transaction" : "linked member"}`, async () => {
  await seed({firstLink}); const baseline = load({authorizedMember: true}), response = await invoke(baseline, "resolveAuthorizedMember"), expected = await image();
  assert.equal(response.code, 200); assert.equal(response.body.environment, "production");
  assert.equal(response.body.firstLoginLinked, firstLink);
  if (firstLink) { assert.ok(baseline.mutations.includes("firestore.transaction.create"));
    assert.equal(expected["production/plus-collections/authLinks"]["fixture-uid"].memberId, "member"); }
  await seed({firstLink}); const candidate = load({authorizedMember: true}, true);
  assert.deepEqual(await invoke(candidate, "resolveAuthorizedMember"), response);
  assert.deepEqual(candidate.trace, baseline.trace); assert.deepEqual(await image(), expected);
});

test("modern production methods, invalid environment and auth failures preserve original error responses and ports", async () => {
  for (const [overrides, options, code] of [
    [{method: "GET", body: {environment: "develop"}}, {}, 405],
    [{body: {environment: "invalid"}}, {}, 400],
    [{headers: {}}, {}, 401],
    [{}, {identityError: true}, 401],
  ]) {
    await seed(); const baseline = load({authorizedMember: true, ...options});
    const response = await invoke(baseline, "resolveAuthorizedMember", overrides); assert.equal(response.code, code);
    await seed(); const candidate = load({authorizedMember: true, ...options}, true);
    assert.deepEqual(await invoke(candidate, "resolveAuthorizedMember", overrides), response);
    assert.deepEqual(candidate.trace, baseline.trace);
  }
});

test("modern production defaults and body/query precedence keep original resolution, responses and afterimages", async () => {
  for (const [overrides, options] of [
    [{body: {}, query: {}}, {defaultEnv: "production"}],
    [{body: {}, query: {}}, {defaultEnv: null, runtimeEnv: "production"}],
    [{body: {environment: " PRODUCTION ", env: "develop"}, query: {environment: "develop"}}, {}],
    [{body: {}, query: {environment: "production", env: "develop"}}, {}],
  ]) {
    await seed(); const baseline = load({authorizedMember: true, ...options});
    const response = await invoke(baseline, "resolveAuthorizedMember", overrides), expected = await image();
    assert.equal(response.code, 200); assert.equal(response.body.environment, "production");
    await seed(); const candidate = load({authorizedMember: true, ...options}, true);
    assert.deepEqual(await invoke(candidate, "resolveAuthorizedMember", overrides), response);
    assert.deepEqual(candidate.trace, baseline.trace); assert.deepEqual(await image(), expected);
  }
});

test("modern direct develop closes before identity/member ports, including body/query/default precedence", async () => {
  await seed(); const before = await image();
  for (const [overrides, options] of [
    [{body: {environment: "develop"}, query: {env: "production"}}, {}],
    [{body: {env: "develop"}, query: {environment: "production"}}, {}],
    [{body: {}, query: {environment: "develop"}}, {}],
    [{body: {}, query: {}}, {defaultEnv: "develop"}],
  ]) {
    const candidate = load({authorizedMember: true, ...options}, true);
    assert.equal((await invoke(candidate, "resolveAuthorizedMember", overrides)).code, 503);
    assert.deepEqual(candidate.trace, []); assert.deepEqual(candidate.mutations, []);
  }
  assert.deepEqual(await image(), before);
});

test("modern reviewer production routing closes before member reads/link writes after original auth/config resolution", async () => {
  await seed({firstLink: true, reviewer: true});
  const baseline = load({authorizedMember: true});
  assert.equal((await invoke(baseline, "resolveAuthorizedMember")).body.environment, "develop");
  assert.ok(baseline.mutations.includes("firestore.transaction.create"));
  await seed({firstLink: true, reviewer: true}); const before = await image();
  const candidate = load({authorizedMember: true}, true);
  assert.equal((await invoke(candidate, "resolveAuthorizedMember")).code, 503);
  assert.deepEqual(candidate.trace.map((item) => item.port), ["auth.verifyIdToken", "firestore.get"]);
  assert.equal(candidate.trace[1].args.path, "production/plus-collections/config/global");
  assert.deepEqual(candidate.mutations, []); assert.deepEqual(await image(), before);
});
