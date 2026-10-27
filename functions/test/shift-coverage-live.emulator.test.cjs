"use strict";
const assert = require("node:assert/strict");
const {test, before, beforeEach, after} = require("node:test");
const {initializeApp, deleteApp} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {getFirestore, Timestamp} = require("firebase-admin/firestore");
const {verifyBearerIdentity, resolveReviewerEnvironment} = require("../lib/backend-security.js");
const {createFirestoreShiftCoverageService} = require("../lib/shift-coverage-live.js");
const {executeShiftCoverageAccessRequest, executeShiftCoverageRequest} = require("../lib/shift-coverage-live-http.js");
const {SHIFT_COVERAGE_POLICY_REVISION} = require("../lib/shift-coverage.js");
const {writeProof, proof} = require("./shift-coverage-bootstrap-proof-fixture.cjs");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {buildShiftPlanningPublicShiftMaterialization, createShiftPlanningActivationOperationTerminal,
  attachShiftPlanningBackendMutationMarker} = require("../lib/shift-planning-publication-contract.js");

const projectId = "demo-reguerta-hu084-coverage";
const enabled = process.env.GCLOUD_PROJECT === projectId && process.env.FIRESTORE_EMULATOR_HOST === "127.0.0.1:8798" &&
  process.env.FIREBASE_AUTH_EMULATOR_HOST === "127.0.0.1:9098";
const run = (name, fn) => test(name, {skip: !enabled}, fn);
const environments = ["develop", "production"];
const shiftId = "shift_market_20270904";
const now = Date.parse("2027-08-25T00:00:00Z"), activeDigest = digest({fixture: "shared-coverage"});
let app, db, auth, token;
const rootFor = (environment) => `${environment}/plus-collections`;
const ref = (environment, collection, id) => db.doc(`${rootFor(environment)}/${collection}/${id}`);
const activation = (environment) => ({enabled: true, environment, policyRevision: SHIFT_COVERAGE_POLICY_REVISION,
  ratificationReference: "local integration fixture only", maximumOfferWindowMillis: 60_000});
const sourcePolicy = (environment) => ({environment, coverage: activation(environment),
  creditLedger: {enabled: true, policyRevision: SHIFT_COVERAGE_POLICY_REVISION},
  deliverySpacing: {version: "hu089-delivery-spacing-v1"}});
const request = (body) => ({method: "POST", query: {}, body});
const dependencies = (database = db, operationalReady = true, bearer = token) => ({
  verifyIdentity: () => verifyBearerIdentity(`Bearer ${bearer}`, (value, revoked) => auth.verifyIdToken(value, revoked)),
  resolveEnvironment: async (environment, identity) => environment === "production" ?
    resolveReviewerEnvironment(environment, identity, (await ref("production", "config", "global").get()).data()) : environment,
  serviceFor: (environment) => createFirestoreShiftCoverageService({firestore: database, environment,
    operationalReady, nowMillis: () => now}),
});
const access = (environment, deps) => executeShiftCoverageAccessRequest(request({schemaVersion: 1, environment}), deps ?? dependencies());
const call = (environment, body, deps) => executeShiftCoverageRequest(request({schemaVersion: 1, environment, ...body}), deps ?? dependencies());
const open = (environment) => ({action: "open", caseId: "same-case", operationId: "same-operation", expectedRevision: 0,
  expectedShiftRevision: 1, shiftId, absentUserId: `${environment}-a`, reason: "Local integration absence"});
const capture = async () => {
  const values = [];
  for (const environment of environments) {
    for (const collection of (await db.doc(rootFor(environment)).listCollections()).sort((a, b) => a.id.localeCompare(b.id))) {
      values.push([environment, collection.id, (await collection.orderBy("__name__").get()).docs.map((doc) => [doc.id, doc.data()])]);
    }
  }
  return values;
};
const materialize = (environment) => {
  const assigned = ["a", "b", "c"].map((id) => `${environment}-${id}`);
  const item = buildShiftPlanningPublicShiftMaterialization({environment, attemptedAt: Timestamp.fromMillis(now - 1000), position: {
    schemaVersion: 1, positionId: shiftId, shiftId, type: "market", scheduledDate: "2027-09-04", candidateId: "candidate",
    projectionSeasonStartYear: 2027, rotationOwnerUserIds: assigned, assignedUserIds: assigned,
    rotationPositions: assigned.map((userId, index) => ({rotationOwnerUserId: userId, effectiveAssigneeUserId: userId,
      roundNumber: 1, positionInRound: index + 1, planningReason: "target"})), helperUserId: null,
    source: "app", origin: "planner", planningRequestId: "initial", bundleRevision: "active-1", bundleDigest: activeDigest, writeEpoch: 1,
  }});
  const operation = createShiftPlanningActivationOperationTerminal({operationId: "initial", environment, requestId: "initial",
    candidateId: "candidate", bundleRevision: "active-1", bundleDigest: activeDigest, forwardManifestDigest: digest("forward"),
    expectedStateDigest: digest("before"), writeEpoch: 1, attemptedAt: Timestamp.fromMillis(now - 1000),
    publicMutations: [{mutationKind: "create", targetPath: item.targetPath, documentRevision: item.documentRevision,
      payloadDigest: item.payloadDigest}], beforeImages: []});
  return attachShiftPlanningBackendMutationMarker({materialization: item, operation});
};
const administrationCommand = async (environment) => {
  const projection = await call(environment, {action: "administration"});
  const member = projection.members.find((row) => row.userId === `${environment}-d`);
  assert.ok(member);
  return {action: "reconcileMembership", operationId: "membership-operation", userId: member.userId,
    expectedRevision: member.membershipRevision, expectedContextDigest: member.contextDigest};
};

before(async () => {
  if (!enabled) return;
  app = initializeApp({projectId}, "hu084-shared-coverage");
  db = getFirestore(app); auth = getAuth(app);
});
after(async () => { if (db) await db.terminate(); if (app) await deleteApp(app); });
beforeEach(async () => {
  if (!enabled) return;
  for (const environment of environments) await db.recursiveDelete(db.doc(rootFor(environment)));
  assert.equal((await fetch(`http://127.0.0.1:9098/emulator/v1/projects/${projectId}/accounts`, {method: "DELETE"})).ok, true);
  await auth.createUser({uid: "shared-admin", email: "shared-admin@example.test", password: "local-shared-password", emailVerified: true});
  const signed = await fetch("http://127.0.0.1:9098/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key", {
    method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({email: "shared-admin@example.test", password: "local-shared-password", returnSecureToken: true})});
  assert.equal(signed.ok, true); token = (await signed.json()).idToken;
  for (const environment of environments) {
    await ref(environment, "shiftPlanningState", "sourcePolicy").set(sourcePolicy(environment));
    await ref(environment, "shiftPlanningState", "current").set({schemaVersion: 1, stateRevision: 1, writeEpoch: 1,
      maintenanceStatus: "open", activeRevision: "active-1", activeDigest, intakeBarrier: null, lastTransitionId: "initial"});
    await ref(environment, "authLinks", "shared-admin").set({memberId: `${environment}-admin`});
    for (const id of ["a", "b", "c", "d", "admin"]) {
      await ref(environment, "users", `${environment}-${id}`).set({displayName: `${environment} member ${id}`,
        ...(id === "admin" ? {authUid: "shared-admin"} : {}), isActive: true, isCommonPurchaseManager: false,
        roles: id === "admin" ? ["member", "admin"] : ["member"]});
    }
    for (const type of ["delivery", "market"]) {
      const cohort = ["a", "b", "c"].map((id) => `${environment}-${id}`);
      await ref(environment, "shiftRotations", type).set({schemaVersion: 1, type, stateRevision: 1,
        cursor: {schemaVersion: 1, type, cohortUserIds: cohort, roundNumber: 1, nextMemberIndex: 1}, planningFrontierSeasonStartYear: 2027,
        cohortFrozen: true, frozenCohortUserIds: cohort, activeRevision: "active-1", activeDigest, lastIdempotencyKey: null,
        migrationBaseline: null, releaseLease: null});
    }
    await ref(environment, "shifts", shiftId).set(materialize(environment));
    await writeProof(db, environment, {now});
  }
});

run("normal coverage admission requires an immutable matching initialization proof", async () => {
  const current = ref("production", "shiftCoverageMigrations", "current");
  const receipt = ref("production", "shiftCoverageMigrations", "fixture-initialization");
  const assertClosed = async () => {
    const beforeCall = await capture();
    assert.equal((await access("production")).enabled, false);
    await assert.rejects(call("production", open("production")), {status: 409, code: "coverage_unavailable"});
    assert.deepEqual(await capture(), beforeCall);
  };
  await current.delete(); await assertClosed();
  await current.set(proof("production", {now}).marker);
  await assertClosed(); // Recreated marker is not the receipt's original commit.
  await receipt.delete(); await assertClosed();
  await current.delete();
  await writeProof(db, "production", {now});
  assert.equal((await access("production")).enabled, true);
  await receipt.update({receiptDigest: digest("forged")}); await assertClosed();
});

run("a proof copied from develop cannot initialize production and later ledger writes preserve readiness", async () => {
  const current = ref("production", "shiftCoverageMigrations", "current");
  const receipt = ref("production", "shiftCoverageMigrations", "fixture-initialization");
  await current.delete(); await receipt.delete();
  const copied = proof("develop", {now}), batch = db.batch();
  batch.create(current, copied.marker); batch.create(receipt, copied.receipt); await batch.commit();
  assert.equal((await access("production")).enabled, false);
  await current.delete(); await receipt.delete();
  await writeProof(db, "production", {now});
  await ref("production", "shiftCoverageLedgerState", "delivery").set({revision: 8});
  assert.equal((await access("production")).enabled, true);
});

run("replacing initialization proof between admission and mutation invalidates the captured command", async () => {
  let transactions = 0;
  const guarded = new Proxy(db, {get(target, key) {
    if (key === "runTransaction") return async (...args) => {
      const number = ++transactions, value = await target.runTransaction(...args);
      if (number === 1) {
        await ref("production", "shiftCoverageMigrations", "current").delete();
        await ref("production", "shiftCoverageMigrations", "fixture-initialization").delete();
        await writeProof(db, "production", {now: now + 1000});
      }
      return value;
    };
    const value = Reflect.get(target, key, target);
    return typeof value === "function" ? value.bind(target) : value;
  }});
  const original = (await ref("production", "shifts", shiftId).get()).data();
  await assert.rejects(call("production", open("production"), dependencies(guarded)),
    {status: 409, code: "coverage_unavailable"});
  assert.deepEqual((await ref("production", "shifts", shiftId).get()).data(), original);
  assert.equal((await db.collection(`${rootFor("production")}/shiftCoverageOperations`).get()).size, 0);
  assert.equal((await db.collection(`${rootFor("production")}/shiftCoverageCases`).get()).size, 0);
});

run("shared Admin SDK composition isolates production and develop identities, commands, receipts and projections", async () => {
  for (const environment of environments) {
    assert.deepEqual(await access(environment), {schemaVersion: 1, environment, memberId: `${environment}-admin`, enabled: true,
      policyRevision: SHIFT_COVERAGE_POLICY_REVISION});
    const result = await call(environment, open(environment));
    assert.deepEqual(Object.keys(result).sort(), ["caseId", "environment", "operationId", "replayed", "revision", "schemaVersion"]);
    assert.equal(result.environment, environment); assert.equal(result.replayed, false);
    const overview = await call(environment, {action: "overview"});
    assert.equal(overview.memberId, `${environment}-admin`); assert.equal(overview.environment, environment);
    assert.equal(overview.cases.length, 1); assert.equal(overview.cases[0].absentUserId, `${environment}-a`);
    assert.equal(overview.policy.drawAvailable, false);
    const stored = (await ref(environment, "shiftCoverageCases", "same-case").get()).data().value;
    assert.equal(stored.environment, environment); assert.equal(stored.openedByUserId, `${environment}-admin`);
  }
  const beforeReplay = await capture();
  assert.equal((await call("production", open("production"))).replayed, true);
  assert.deepEqual(await capture(), beforeReplay);
});

run("missing, disabled, malformed and cross-environment policies or missing authority stay closed without writes", async () => {
  const missingWindow = activation("production"); delete missingWindow.maximumOfferWindowMillis;
  const invalid = [undefined, {...activation("production"), enabled: false}, activation("develop"),
    {...activation("production"), policyRevision: "unknown"}, {...activation("production"), ratificationReference: " "},
    {...activation("production"), maximumOfferWindowMillis: 0}, missingWindow, {...activation("production"), extra: true}];
  for (const value of invalid) {
    const policy = sourcePolicy("production");
    if (value === undefined) delete policy.coverage; else policy.coverage = value;
    await ref("production", "shiftPlanningState", "sourcePolicy").set(policy);
    const beforeCall = await capture();
    assert.equal((await access("production")).enabled, false);
    await assert.rejects(call("production", open("production")), {status: 409, code: "coverage_unavailable"});
    assert.deepEqual(await capture(), beforeCall);
  }
  await ref("production", "shiftPlanningState", "sourcePolicy").set(sourcePolicy("production"));
  await ref("production", "shiftPlanningState", "current").delete();
  const beforeCall = await capture();
  assert.equal((await access("production")).enabled, false);
  await assert.rejects(call("production", open("production")), {status: 409, code: "coverage_unavailable"});
  assert.deepEqual(await capture(), beforeCall);
});

run("trusted operational admission stays closed despite a complete policy and cannot be supplied by a client", async () => {
  const closed = dependencies(db, false), beforeCall = await capture();
  assert.deepEqual(await access("production", closed), {schemaVersion: 1, environment: "production",
    memberId: "production-admin", enabled: false, policyRevision: null});
  await assert.rejects(call("production", open("production"), closed), {code: "coverage_unavailable"});
  await assert.rejects(call("production", {...open("production"), operationalReady: true}), {status: 400});
  assert.deepEqual(await capture(), beforeCall);
});

run("policy drift after preflight rejects the actual transaction instead of using a stale maximum response window", async () => {
  let transactions = 0, afterDrift;
  const scheduled = new Proxy(db, {get(target, property) {
    if (property === "runTransaction") return async (...args) => {
      const result = await target.runTransaction(...args);
      if (++transactions === 1) {
        await ref("production", "shiftPlanningState", "sourcePolicy").update({"coverage.maximumOfferWindowMillis": 120_000});
        afterDrift = await capture();
      }
      return result;
    };
    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  }});
  await assert.rejects(call("production", open("production"), dependencies(scheduled)), {status: 409, code: "coverage_unavailable"});
  assert.equal(transactions, 1); assert.ok(afterDrift); assert.deepEqual(await capture(), afterDrift);
});

run("administration and replay recheck current roles and reciprocal links in the requested environment", async () => {
  const command = await administrationCommand("production");
  assert.equal((await call("production", command)).replayed, false);
  assert.equal((await call("production", command)).replayed, true);
  await ref("production", "users", "production-admin").update({roles: ["member"]});
  let beforeCall = await capture();
  await assert.rejects(call("production", command), {status: 403});
  assert.deepEqual(await capture(), beforeCall);
  await ref("production", "users", "production-admin").update({roles: ["member", "admin"]});
  await ref("production", "authLinks", "shared-admin").set({memberId: "production-d"});
  beforeCall = await capture();
  await assert.rejects(access("production"), {status: 403});
  await assert.rejects(call("production", command), {status: 403});
  assert.equal((await access("develop")).memberId, "develop-admin");
  assert.deepEqual(await capture(), beforeCall);
});

run("a reciprocal link rebound to another administrator after preflight cannot execute the original account intent", async () => {
  await ref("production", "users", "replacement-admin").set({displayName: "Replacement local administrator",
    authUid: "shared-admin", isActive: true, isCommonPurchaseManager: false, roles: ["member", "admin"]});
  let transactions = 0, afterDrift;
  const scheduled = new Proxy(db, {get(target, property) {
    if (property === "runTransaction") return async (...args) => {
      const result = await target.runTransaction(...args);
      if (++transactions === 1) {
        await ref("production", "authLinks", "shared-admin").set({memberId: "replacement-admin"});
        afterDrift = await capture();
      }
      return result;
    };
    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  }});
  await assert.rejects(call("production", open("production"), dependencies(scheduled)),
    {status: 409, code: "coverage_session_changed"});
  assert.equal(transactions, 1); assert.ok(afterDrift); assert.deepEqual(await capture(), afterDrift);
  assert.equal((await ref("production", "shiftCoverageOperations", "same-operation").get()).exists, false);
});

run("revoked real emulator Auth tokens cannot read access, projections or replay a completed command", async () => {
  const command = await administrationCommand("production");
  await call("production", command);
  await new Promise((resolve) => setTimeout(resolve, 1100));
  await auth.revokeRefreshTokens("shared-admin");
  const beforeCall = await capture();
  for (const action of [() => access("production"), () => call("production", {action: "overview"}),
    () => call("production", command)]) {
    await assert.rejects(action(), {status: 401, code: "unauthenticated"});
  }
  assert.deepEqual(await capture(), beforeCall);
});

run("reviewer routing never silently changes the body environment or mutates either scope", async () => {
  await ref("production", "config", "global").set({reviewerAllowlistUids: ["shared-admin"]});
  const beforeCall = await capture();
  await assert.rejects(access("production"), {status: 409, code: "coverage_environment_changed"});
  await assert.rejects(call("production", open("production")), {status: 409, code: "coverage_environment_changed"});
  assert.equal((await access("develop")).environment, "develop");
  assert.deepEqual(await capture(), beforeCall);
});
