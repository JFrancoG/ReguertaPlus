"use strict";
const assert = require("node:assert/strict");
const {test, before, beforeEach, after} = require("node:test");
const {initializeApp, deleteApp} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {startProvisionalShiftCoverageServer} = require("../lib/shift-coverage-local-server.js");
const {createProvisionalCreditFirestore} = require("../lib/shift-credit-publication.js");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {materialize, initialTime, activeDigest} = require("./shift-coverage-fixture.cjs");
const projectId = "demo-reguerta-hu084-coverage", root = "develop/plus-collections";
const enabled = process.env.GCLOUD_PROJECT === projectId && process.env.FIRESTORE_EMULATOR_HOST === "127.0.0.1:8798" &&
  process.env.FIREBASE_AUTH_EMULATOR_HOST === "127.0.0.1:9098";
const run = (name, fn) => test(name, {skip: !enabled}, fn);
let app, db, adminApp, auth, now, sequence, tokens;
const ref = (collection, id) => db.doc(`${root}/${collection}/${id}`);
const read = async (collection, id) => (await ref(collection, id).get()).data();
const overview = {schemaVersion: 1, environment: "develop", action: "overview"};
const detail = (caseId = "case") => ({...overview, action: "detail", caseId});
const call = async (actor, body, token = tokens[actor]) => {
  const response = await fetch(app.url, {method: "POST", headers: {
    authorization: `Bearer ${token}`, "Content-Type": "application/json"}, body: JSON.stringify(body)});
  return {status: response.status, value: await response.json(), headers: Object.fromEntries(response.headers)};
};
const command = async (action, extra = {}) => {
  const current = await read("shiftCoverageCases", "case");
  const shiftId = extra.shiftId ?? current?.value.shiftId ?? "shift_delivery_20270901";
  const shift = await read("shifts", shiftId);
  return {schemaVersion: 1, environment: "develop", action, caseId: "case", operationId: `app-${++sequence}`,
    expectedRevision: current?.value.revision ?? 0, expectedShiftRevision: shift.documentRevision, ...extra};
};
const execute = async (actor, action, extra = {}) => {
  const response = await call(actor, await command(action, extra));
  assert.equal(response.status, 200, JSON.stringify(response.value)); return response;
};
const open = (shiftId = "shift_delivery_20270901") => execute("a", "open",
  {shiftId, absentUserId: "a", reason: "Private absence reason"});
const offer = () => execute("admin", "offer", {userId: "d", reason: "Explicit arrangement", expiresAtMillis: now + 10_000});
const capture = async () => {
  const result = {};
  for (const name of ["users", "authLinks", "shifts", "shiftCoverageCases", "shiftCoverageOperations", "shiftCoverageCredits",
    "shiftCoverageMemberClaims", "shiftCoverageLedgerState", "shiftCoverageSlots", "shiftCoverageReserves"]) {
    result[name] = (await db.collection(`${root}/${name}`).orderBy("__name__").get()).docs.map((doc) => [doc.id, doc.data()]);
  }
  return result;
};
before(async () => {
  if (!enabled) return;
  db = createProvisionalCreditFirestore();
  adminApp = initializeApp({projectId}, "hu084-auth-fixture"); auth = getAuth(adminApp);
  app = await startProvisionalShiftCoverageServer({nowMillis: () => now, maximumOfferWindowMillis: 60_000,
    selectionPolicy: {version: "fifo-signup-v1", volunteerWindowMillis: 1000}}, 0);
});
after(async () => { if (app) await app.close(); if (db) await db.terminate(); if (adminApp) await deleteApp(adminApp); });
beforeEach(async () => {
  if (!enabled) return;
  await db.recursiveDelete(db.doc(root));
  assert.equal((await fetch(`http://127.0.0.1:9098/emulator/v1/projects/${projectId}/accounts`, {method: "DELETE"})).ok, true);
  now = initialTime; sequence = 0; tokens = {};
  await ref("shiftPlanningState", "current").set({schemaVersion: 1, stateRevision: 1, writeEpoch: 1,
    maintenanceStatus: "open", activeRevision: "active-1", activeDigest, intakeBarrier: null, lastTransitionId: "initial"});
  for (const id of ["a", "b", "c", "d", "e", "admin"]) {
    await auth.createUser({uid: `auth-${id}`, email: `${id}@example.test`, password: "local-fixture-password", emailVerified: true});
    const response = await fetch("http://127.0.0.1:9098/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key", {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({email: `${id}@example.test`, password: "local-fixture-password", returnSecureToken: true})});
    assert.equal(response.ok, true); const result = await response.json();
    assert.equal(JSON.parse(Buffer.from(result.idToken.split(".")[1], "base64url")).aud, projectId);
    tokens[id] = result.idToken;
    await ref("authLinks", `auth-${id}`).set({memberId: id});
    await ref("users", id).set({displayName: `Member ${id}`, authUid: `auth-${id}`, isActive: true, isCommonPurchaseManager: false,
      roles: id === "admin" ? ["member", "admin"] : ["member"]});
  }
  for (const [id, date, assigned, helper] of [["shift_delivery_20270825", "2027-08-25", ["b"], "a"],
    ["shift_delivery_20270901", "2027-09-01", ["a"], "c"], ["shift_delivery_20270908", "2027-09-08", ["c"], "e"]]) {
    await ref("shifts", id).set(materialize(id, "delivery", date, assigned, helper));
  }
  await ref("shifts", "shift_market_20270904").set(materialize("shift_market_20270904", "market", "2027-09-04", ["a", "b", "c"]));
});

for (const type of ["delivery", "market"]) run(`real Auth tokens cover ${type} from opening to own earned credit without disclosing internal records`, async () => {
  const shiftId = type === "delivery" ? "shift_delivery_20270901" : "shift_market_20270904";
  await open(shiftId); await offer();
  let response = await call("d", overview); assert.equal(response.status, 200);
  assert.equal(response.value.data.memberId, "d"); assert.equal(response.value.data.cases[0].offer.userId, "d");
  assert.equal(response.value.data.cases[0].administration, null);
  assert.equal(JSON.stringify(response.value).includes("assignmentContextDigest"), false);
  assert.equal((await call("e", overview)).value.data.cases[0].offer, null);
  assert.equal((await call("admin", overview)).value.data.cases[0].administration.reason, "Private absence reason");
  const accepted = await execute("d", "accept"); assert.deepEqual(Object.keys(accepted.value.data).sort(),
    ["caseId", "environment", "operationId", "replayed", "revision", "schemaVersion"]);
  now = (await read("shifts", shiftId)).date.toMillis() + 1000;
  await execute("admin", "complete");
  response = await call("d", overview); assert.equal(response.value.data.credits.length, 1);
  assert.equal(response.value.data.credits[0].state, "pending"); assert.equal(response.value.data.credits[0].type, type);
  assert.equal((await call("a", overview)).value.data.credits.length, 0);
  assert.equal((await call("e", detail())).value.code, "coverage_case_unavailable");
  assert.equal((await call("admin", detail())).status, 200);
  const shift = await read("shifts", shiftId);
  assert.deepEqual(type === "delivery" ? [shift.rotationOwnerUserId] : shift.rotationOwnerUserIds,
    type === "delivery" ? ["a"] : ["a", "b", "c"]);
});

run("selection views show own reserve/volunteer data, never candidate snapshots, exclusions or another member's credit", async () => {
  const reserveId = digest(["delivery", "d"]).split(":").at(-1);
  await ref("shiftCoverageReserves", reserveId).set({userId: "d", type: "delivery", active: true, enteredAtMillis: now, revision: 1});
  await open(); await execute("admin", "startSelection");
  await execute("admin", "offerNext", {expiresAtMillis: now + 10_000});
  await execute("d", "decline");
  await execute("admin", "offerNext", {expiresAtMillis: now + 10_000});
  await execute("e", "volunteer");
  const before = await capture();
  for (const id of ["d", "e", "admin"]) {
    const response = await call(id, overview); assert.equal(response.status, 200);
    const value = response.value.data;
    assert.equal(value.cases[0].selectionPhase, "volunteers");
    assert.equal(value.cases[0].volunteered, id === "e");
    assert.equal(value.reserves.length, id === "d" ? 1 : 0);
    for (const forbidden of ["snapshot", "exclusion", "memberDigest", "latestExclusions", "attemptedUserIds"]) {
      assert.equal(JSON.stringify(value).includes(forbidden), false);
    }
  }
  assert.deepEqual(await capture(), before);
  await execute("e", "withdrawVolunteer");
  const withdrawn = (await call("e", detail())).value.data.cases[0];
  assert.equal(withdrawn.volunteered, false);
  assert.equal(withdrawn.hasVolunteered, true);
});

for (const drift of ["inactive", "unlink", "wrongLink", "authDisabled", "authDeleted", "authRevoked"]) {
  run(`${drift} after token issuance rejects queries, commands and replay without partial writes`, async () => {
    await open(); await offer(); const accept = await command("accept");
    assert.equal((await call("d", accept)).status, 200);
    if (drift === "inactive") await ref("users", "d").update({isActive: false});
    if (drift === "unlink") await ref("authLinks", "auth-d").delete();
    if (drift === "wrongLink") await ref("authLinks", "auth-d").set({memberId: "admin"});
    if (drift === "authDisabled") await auth.updateUser("auth-d", {disabled: true});
    if (drift === "authDeleted") await auth.deleteUser("auth-d");
    if (drift === "authRevoked") {
      await new Promise((resolve) => setTimeout(resolve, 1100));
      await auth.revokeRefreshTokens("auth-d");
    }
    const before = await capture();
    for (const body of [overview, detail(), accept]) {
      const response = await call("d", body); assert.ok([401, 403].includes(response.status), JSON.stringify(response.value));
      assert.equal(response.value.data, undefined);
    }
    assert.deepEqual(await capture(), before);
  });
}

run("admin demotion, another user's acceptance and client actor forgery cannot change coverage", async () => {
  await open();
  const offered = await command("offer", {userId: "d", reason: "Consent", expiresAtMillis: now + 10_000});
  await ref("users", "admin").update({roles: ["member"]}); const before = await capture();
  assert.equal((await call("admin", offered)).value.code, "coverage_actor_forbidden");
  assert.deepEqual(await capture(), before);
  await ref("users", "admin").update({roles: ["admin", "member"]}); await offer();
  const accept = await command("accept"); const active = await capture();
  assert.equal((await call("e", accept)).value.code, "coverage_actor_forbidden");
  assert.equal((await call("e", {...accept, actorMemberId: "d"})).status, 400);
  assert.equal((await call("d", {...accept, environment: "production"})).status, 400);
  assert.deepEqual(await capture(), active);
});

run("authenticated replay is bound to UID/member/command and competing acceptance commits once", async () => {
  await open(); await offer(); const accept = await command("accept");
  const responses = await Promise.all([call("d", accept), call("d", accept)]);
  assert.ok(responses.every((response) => response.status === 200));
  assert.equal(responses.filter((response) => !response.value.data.replayed).length, 1);
  const before = await capture();
  assert.equal((await call("d", accept)).value.data.replayed, true);
  assert.equal((await call("e", accept)).value.code, "coverage_operation_conflict");
  assert.deepEqual(await capture(), before);
  assert.equal((await read("shiftCoverageOperations", accept.operationId)).authUid, "auth-d");
});

run("invalid/wrong-project tokens and runtime environment drift fail before accessing private case data", async () => {
  const before = await capture();
  assert.equal((await call("a", overview, "not-a-token")).status, 401);
  const parts = tokens.a.split(".");
  for (const patch of [{aud: "another-project"}, {iss: "https://untrusted.example.test"}, {exp: 1}]) {
    const payload = {...JSON.parse(Buffer.from(parts[1], "base64url")), ...patch};
    const wrong = [parts[0], Buffer.from(JSON.stringify(payload)).toString("base64url"), parts[2]].join(".");
    assert.equal((await call("a", overview, wrong)).status, 401);
  }
  const saved = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  try { delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    assert.equal((await call("a", overview)).value.code, "coverage_provisional_auth_emulator_required");
  } finally { process.env.FIREBASE_AUTH_EMULATOR_HOST = saved; }
  assert.deepEqual(await capture(), before);
});

run("a relinked session cannot replay a receipt issued to a different Auth UID for the same member", async () => {
  await open(); await offer(); const accept = await command("accept");
  assert.equal((await call("d", accept)).status, 200);
  await ref("authLinks", "auth-e").set({memberId: "d"});
  await ref("users", "d").update({authUid: "auth-e"});
  const before = await capture();
  assert.equal((await call("e", overview)).value.data.memberId, "d");
  assert.equal((await call("e", accept)).value.code, "coverage_operation_conflict");
  assert.equal((await call("d", accept)).value.code, "invalid_link");
  assert.deepEqual(await capture(), before);
});

run("maintenance leaves a read-only case and a changed authority disables stale actions", async () => {
  await open();
  const state = await read("shiftPlanningState", "current");
  await ref("shiftPlanningState", "current").set({...state, maintenanceStatus: "closed",
    intakeBarrier: {revision: "closed", digest: digest("closed"), verifiedAtMillis: now}});
  const before = await capture();
  const response = await call("a", detail());
  assert.equal(response.status, 200, JSON.stringify(response.value));
  assert.equal(response.value.data.cases[0].writable, false);
  assert.deepEqual(await capture(), before);
  await ref("shiftPlanningState", "current").set({...state, stateRevision: 2});
  assert.equal((await call("a", detail())).value.data.cases[0].writable, false);
  assert.equal((await call("a", await command("cancel", {reason: "No longer needed"}))).value.code, "coverage_authority_changed");
});

run("real producers do not browse vacancies; common purchase managers retain membership eligibility", async () => {
  await open();
  await ref("users", "d").update({roles: ["member", "producer"]});
  const producer = await call("d", overview);
  assert.equal(producer.status, 200); assert.equal(producer.value.data.eligible, false);
  assert.deepEqual(producer.value.data.cases, []);
  assert.equal((await call("d", detail())).value.code, "coverage_case_unavailable");
  await ref("users", "d").update({isCommonPurchaseManager: true});
  const manager = await call("d", overview);
  assert.equal(manager.value.data.eligible, true); assert.equal(manager.value.data.cases.length, 1);
  assert.deepEqual(manager.value.data.policy,
    {maximumOfferWindowMillis: 60_000, volunteerWindowMillis: 1000, drawAvailable: false});
});

run("an oversized inbox fails explicitly without exposing a partial board or mutating any state", async () => {
  await open(); const stored = await read("shiftCoverageCases", "case"); const batch = db.batch();
  for (let i = 0; i < 250; i++) {
    const value = {...stored.value, id: `extra-${i}`};
    batch.set(ref("shiftCoverageCases", value.id), {...stored, value, digest: digest(value)});
  }
  await batch.commit(); const before = await capture();
  const response = await call("d", overview);
  assert.equal(response.value.code, "coverage_read_limit"); assert.equal(response.value.data, undefined);
  assert.equal((await call("d", detail())).status, 200);
  assert.deepEqual(await capture(), before);
});

run("loopback HTTP enforces route, JSON, method, bounded body and no-cache errors without state changes", async () => {
  assert.equal(new URL(app.url).hostname, "127.0.0.1");
  const before = await capture();
  for (const [url, options, status] of [
    [app.url, {method: "GET"}, 405],
    [app.url.replace("/coverage", "/other"), {method: "POST"}, 404],
    [app.url, {method: "POST", body: "text"}, 415],
    [app.url, {method: "POST", headers: {"Content-Type": "application/json"}, body: "{"}, 400],
    [app.url, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({padding: "x".repeat(20_000)})}, 413],
  ]) {
    const response = await fetch(url, options);
    assert.equal(response.status, status); assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await response.json()).ok, false);
  }
  assert.deepEqual(await capture(), before);
});

run("form choices expose owned lead slots and visible names, with eligible admin candidates and no writes", async () => {
  await open(); await offer();
  await ref("users", "e").update({isActive: false});
  const before = await capture();
  const member = (await call("a", overview)).value.data;
  assert.deepEqual(member.availableShifts.map((s) => s.shiftId), ["shift_delivery_20270901", "shift_market_20270904"]);
  assert.ok(member.availableShifts.every((s) => s.assignedUserIds.join() === "a"));
  assert.deepEqual(member.members, [{memberId: "a", displayName: "Member a", offerCandidate: false}]);
  assert.equal(member.cases[0].openedByMe, true);
  const offered = (await call("d", overview)).value.data;
  assert.deepEqual(offered.members.map((m) => m.memberId).sort(), ["a", "d"]);
  const admin = (await call("admin", overview)).value.data;
  assert.deepEqual(admin.members.filter((m) => m.offerCandidate).map((m) => m.memberId).sort(), ["a", "admin", "b", "c", "d"]);
  assert.ok(admin.members.every((m) => Object.keys(m).sort().join() === "displayName,memberId,offerCandidate"));
  assert.deepEqual(await capture(), before);
  await ref("users", "a").update({isActive: false});
  const inactive = (await call("admin", overview)).value.data.members.find((m) => m.memberId === "a");
  assert.equal(inactive.displayName, "Member a"); assert.equal(inactive.offerCandidate, false);
});

run("maintenance makes new absence choices read-only", async () => {
  const state = await read("shiftPlanningState", "current");
  await ref("shiftPlanningState", "current").set({...state, maintenanceStatus: "closed",
    intakeBarrier: {revision: "closed", digest: digest("closed"), verifiedAtMillis: now}});
  const before = await capture();
  const value = (await call("a", overview)).value.data;
  assert.ok(value.availableShifts.length > 0);
  assert.ok(value.availableShifts.every((s) => !s.writable));
  assert.deepEqual(await capture(), before);
});

run("admin absence choices retain inactive assigned owners before any case exists", async () => {
  await ref("users", "a").update({isActive: false});
  const before = await capture();
  const value = (await call("admin", overview)).value.data;
  assert.deepEqual(value.cases, []);
  assert.ok(value.availableShifts.some((s) => s.assignedUserIds.includes("a")));
  assert.deepEqual(value.members.find((m) => m.memberId === "a"),
    {memberId: "a", displayName: "Member a", offerCandidate: false});
  assert.deepEqual(await capture(), before);
});
