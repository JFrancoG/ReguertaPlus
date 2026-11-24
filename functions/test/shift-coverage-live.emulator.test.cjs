"use strict";
const assert = require("node:assert/strict");
const {test, before, beforeEach, after} = require("node:test");
const {initializeApp, deleteApp} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {getFirestore, Timestamp} = require("firebase-admin/firestore");
const {verifyBearerIdentity, resolveReviewerEnvironment} = require("../lib/backend-security.js");
const {createFirestoreShiftCoverageService} = require("../lib/shift-coverage-live.js");
const {createFirestoreShiftCoverageEffectsWorker} = require("../lib/shift-coverage-effects-worker.js");
const {createFirestoreShiftCoveragePushDispatcher} = require("../lib/shift-coverage-push.js");
const {createShiftSheetsConfig} = require("../lib/shift-sheets-config.js");
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
const dependencies = (database = db, operationalReady = true, bearer = token, serviceOptions = {}) => ({
  verifyIdentity: () => verifyBearerIdentity(`Bearer ${bearer}`, (value, revoked) => auth.verifyIdToken(value, revoked)),
  resolveEnvironment: async (environment, identity) => environment === "production" ?
    resolveReviewerEnvironment(environment, identity, (await ref("production", "config", "global").get()).data()) : environment,
  serviceFor: (environment) => createFirestoreShiftCoverageService({firestore: database, environment,
    operationalReady, nowMillis: () => now, ...serviceOptions}),
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
const materialize = (environment, scheduledDate = "2027-09-04", publishedAt = now - 1000) => {
  const materializedId = "shift_market_" + scheduledDate.replaceAll("-", "");
  const assigned = ["a", "b", "c"].map((id) => `${environment}-${id}`);
  const item = buildShiftPlanningPublicShiftMaterialization({environment, attemptedAt: Timestamp.fromMillis(publishedAt), position: {
    schemaVersion: 1, positionId: materializedId, shiftId: materializedId, type: "market", scheduledDate, candidateId: "candidate",
    projectionSeasonStartYear: Number(scheduledDate.slice(0, 4)) - (Number(scheduledDate.slice(5, 7)) < 9 ? 1 : 0),
    rotationOwnerUserIds: assigned, assignedUserIds: assigned,
    rotationPositions: assigned.map((userId, index) => ({rotationOwnerUserId: userId, effectiveAssigneeUserId: userId,
      roundNumber: 1, positionInRound: index + 1, planningReason: "target"})), helperUserId: null,
    source: "app", origin: "planner", planningRequestId: "initial", bundleRevision: "active-1", bundleDigest: activeDigest, writeEpoch: 1,
  }});
  const operation = createShiftPlanningActivationOperationTerminal({operationId: "initial", environment, requestId: "initial",
    candidateId: "candidate", bundleRevision: "active-1", bundleDigest: activeDigest, forwardManifestDigest: digest("forward"),
    expectedStateDigest: digest("before"), writeEpoch: 1, attemptedAt: Timestamp.fromMillis(publishedAt),
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

const signIn = async (uid) => {
  const email = uid + "@example.test", password = "local-shared-password";
  await auth.createUser({uid, email, password, emailVerified: true});
  const response = await fetch("http://127.0.0.1:9098/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key", {
    method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({email, password, returnSecureToken: true})});
  assert.equal(response.ok, true);
  return (await response.json()).idToken;
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
  token = await signIn("shared-admin");
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
    assert.equal(overview.policy.drawAvailable, true);
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

// Use a fresh service on every request so a successful retry must load the
// original participant set, future round and failure receipt from Firestore.
const prepareDrawPhase = async (commitClock, beaconFetcher) => {
  const day = 86_400_000;
  let clock = commitClock - 7 * day;
  const saturday = new Date(commitClock + 28 * day);
  saturday.setUTCDate(saturday.getUTCDate() + (6 - saturday.getUTCDay() + 7) % 7);
  const date = saturday.toISOString().slice(0, 10), id = "shift_market_" + date.replaceAll("-", "");
  await ref("develop", "shifts", id).set(materialize("develop", date, clock - 1000));
  const memberToken = await signIn("draw-member");
  await ref("develop", "users", "develop-d").update({authUid: "draw-member"});
  await ref("develop", "authLinks", "draw-member").set({memberId: "develop-d"});
  const send = (body, member = "develop-admin") => call("develop", body,
    dependencies(db, true, member === "develop-admin" ? token : memberToken,
      {nowMillis: () => clock, beaconFetcher}));
  const caseRef = ref("develop", "shiftCoverageCases", "same-case");
  const read = async () => (await caseRef.get()).get("value");
  const command = async (action, operationId, extra = {}) => ({action, operationId,
    caseId: caseRef.id, expectedRevision: (await read()).revision, expectedShiftRevision: 1, ...extra});
  const step = async (action, operationId, extra, member) => send(await command(action, operationId, extra), member);
  const nextOffer = (operationId) => step("offerNext", operationId, {expiresAtMillis: clock + 10_000});
  await send({...open("develop"), shiftId: id});
  await step("startSelection", "draw-start");
  await nextOffer("draw-open-volunteer");
  assert.equal((await read()).selection.phase, "volunteers");
  clock = commitClock;
  await nextOffer("draw-close-volunteer");
  assert.equal((await read()).selection.phase, "drawRequired");
  return {send, read, step, command, nextOffer, setClock: (time) => { clock = time; }};
};

const prepareDraw = async (commitClock, beaconFetcher) => {
  const phase = await prepareDrawPhase(commitClock, beaconFetcher);
  const {read, step} = phase;
  await step("commitDraw", "draw-commit");
  const draw = (await read()).selection.draw;
  assert.equal(draw.evidence, null);
  assert.equal(draw.order, null);
  assert.deepEqual(draw.candidates.filter((row) => !row.exclusion).map((row) => row.userId), ["develop-admin", "develop-d"]);
  const receipt = await ref("develop", "shiftCoverageOperations", "draw-commit").get();
  return {...phase, draw, receipt};
};

const drawAlerts = async () => (await db.collection(rootFor("develop") + "/shiftCoverageEffects").get()).docs
  .flatMap((row) => row.get("value.notifications")).map((notification) => notification.userId);

run("a public draw outage preserves the original commitment, alerts its administrator once and rejects invalid evidence", async () => {
  const urls = [];
  const fixture = require("./fixtures/shift-coverage-drand-quicknet.json");
  let invalid = false;
  const journey = await prepareDraw(Date.now(), async (url) => {
    urls.push(String(url));
    return invalid ? Response.json({...fixture, round: journey.draw.round}) : new Response(null, {status: 503});
  });
  const {draw} = journey;
  assert.ok(journey.receipt.createTime.toMillis() < draw.availableAtMillis);
  const reveal = await journey.command("revealDraw", "draw-unavailable");
  await assert.rejects(journey.send(reveal), {code: "coverage_entropy_not_available"});
  assert.deepEqual(urls, []);
  journey.setClock(draw.availableAtMillis);
  await assert.rejects(journey.send(reveal, "develop-d"), {code: "coverage_actor_forbidden"});
  assert.deepEqual(urls, []);
  await assert.rejects(journey.send(reveal), {code: "coverage_draw_provider_unavailable"});
  const attempts = urls.length;
  assert.ok(attempts > 0);
  const first = await journey.read();
  assert.deepEqual(first.selection.draw, draw);
  assert.equal(first.selection.drawFailure.administratorId, "develop-admin");
  assert.deepEqual(await drawAlerts(), ["develop-admin"]);
  const detail = {action: "detail", caseId: "same-case"};
  assert.equal((await journey.send(detail)).cases[0].administration.drawFailure.code, "coverage_draw_provider_unavailable");
  assert.equal((await journey.send(detail, "develop-d")).cases[0].administration, null);
  await assert.rejects(journey.send(reveal), {code: "coverage_draw_provider_unavailable"});
  assert.equal(urls.length, attempts);
  invalid = true;
  const retry = await journey.command("revealDraw", "draw-invalid");
  await assert.rejects(journey.send(retry), {code: "coverage_draw_provider_invalid"});
  assert.ok(urls.length > attempts);
  const retryAttempts = urls.length;
  assert.ok(urls.every((url) => new URL(url).pathname.endsWith("/" + draw.round)));
  const latest = await journey.read();
  assert.equal(latest.revision, first.revision + 1);
  assert.deepEqual(latest.selection.draw, draw);
  assert.equal(latest.selection.drawFailure.code, "coverage_draw_provider_invalid");
  assert.equal((await journey.send(detail)).cases[0].administration.drawFailure.code, "coverage_draw_provider_invalid");
  const retryReceipt = await ref("develop", "shiftCoverageOperations", retry.operationId).get();
  assert.equal(retryReceipt.get("drawFailure"), "coverage_draw_provider_invalid");
  await assert.rejects(journey.send(retry), {code: "coverage_draw_provider_invalid"});
  await assert.rejects(journey.send(reveal), {code: "coverage_draw_provider_unavailable"});
  assert.deepEqual(await journey.read(), latest);
  assert.equal(urls.length, retryAttempts);
  assert.deepEqual(await drawAlerts(), ["develop-admin"]);

  const context = {environment: "develop", requireReady: async () => {}};
  const worker = createFirestoreShiftCoverageEffectsWorker({firestore: db, context, tabs: [],
    config: createShiftSheetsConfig({environment: "develop", workbooks: {develop: "draw-fixture-book"}}),
    sheets: {get: assert.fail, batchUpdate: assert.fail}, readWorkbookVersion: assert.fail,
    nowMillis: () => draw.availableAtMillis, leaseDurationMillis: 60_000});
  assert.deepEqual(await worker.drain(reveal.operationId), {state: "completed", replayed: false});
  assert.deepEqual(await worker.drain(reveal.operationId), {state: "completed", replayed: true});
  const firstEffect = await ref("develop", "shiftCoverageEffects", reveal.operationId).get();
  assert.deepEqual(firstEffect.get("deliveredTo"), ["develop-admin"]);
  const inbox = await ref("develop", "users", "develop-admin").collection("notificationInbox").get();
  assert.equal(inbox.size, 1);
  const eventId = inbox.docs[0].id;
  const message = await journey.send({action: "notification", eventId});
  assert.equal(message.cases[0].administration.drawFailure.code, "coverage_draw_provider_invalid");
  let sends = 0;
  const push = createFirestoreShiftCoveragePushDispatcher({firestore: db, context, nowMillis: () => draw.availableAtMillis,
    resolveTargets: async () => ({fcmTokens: ["local-draw-admin"], firebaseInstallationIds: []}),
    transport: {submit: async () => { sends++; return {outcome: "accepted", acceptedTargetCount: 1}; }}});
  const submit = () => push.submit("develop-admin", eventId);
  const roles = ref("develop", "users", "develop-admin");
  await roles.update({roles: ["member"]});
  await assert.rejects(submit(), {code: "coverage_push_stale"});
  await roles.update({roles: ["member", "admin"]});
  await assert.rejects(journey.step("commitDraw", "draw-again"), {code: "coverage_draw_state_conflict"});
  await journey.step("cancel", "draw-cancel", {reason: "Test interruption"});
  await assert.rejects(submit(), {code: "coverage_push_stale"});
  assert.equal(sends, 0);
  await journey.step("resumeAdmin", "draw-resume", {reason: "Restore the original draw"});
  const resumed = await journey.read();
  assert.equal(resumed.selection.phase, "drawRequired");
  assert.deepEqual(resumed.selection.draw, draw);
  assert.deepEqual(await submit(), {state: "accepted", replayed: false});
  assert.deepEqual(await submit(), {state: "accepted", replayed: true});
  assert.equal(sends, 1);
  await assert.rejects(journey.step("offerAdmin", "draw-override", {userId: "develop-d",
    reason: "Test premature override", expiresAtMillis: draw.availableAtMillis + 10_000}),
  {code: "coverage_admin_not_required"});
});

run("revoking the operator while the public round is being read prevents a stale administrative write", async () => {
  const journey = await prepareDraw(Date.now(), async () => {
    await ref("develop", "users", "develop-admin").update({roles: ["member"]});
    return new Response(null, {status: 503});
  });
  journey.setClock(journey.draw.availableAtMillis);
  const before = await journey.read();
  await assert.rejects(journey.step("revealDraw", "draw-session-changed"), {code: "coverage_session_changed"});
  assert.deepEqual(await journey.read(), before);
  assert.equal((await ref("develop", "shiftCoverageOperations", "draw-session-changed").get()).exists, false);
  assert.deepEqual(await drawAlerts(), []);
});

run("a public round already available when Firestore committed cannot be revealed", async () => {
  const pulse = require("./fixtures/shift-coverage-drand-quicknet.json");
  const availableAt = 1692803367000 + (pulse.round - 1) * 3000;
  let requests = 0;
  const journey = await prepareDraw(availableAt - 300_000, async () => { requests++; return Response.json(pulse); });
  assert.equal(journey.draw.round, pulse.round);
  assert.ok(journey.receipt.createTime.toMillis() > availableAt);
  journey.setClock(availableAt);
  await assert.rejects(journey.step("revealDraw", "draw-late"), {code: "coverage_draw_commit_too_late"});
  assert.equal(requests, 0);
  const late = await journey.read();
  assert.deepEqual(late.selection.draw, journey.draw);
  assert.equal(late.selection.phase, "adminRequired");
  assert.deepEqual(await drawAlerts(), ["develop-admin"]);
  await assert.rejects(journey.step("commitDraw", "late-reroll"), {code: "coverage_draw_state_conflict"});
  await journey.step("offerAdmin", "late-manual-offer", {userId: "develop-d", reason: "Late public commitment",
    expiresAtMillis: availableAt + 10_000});
  const assignment = () => ref("develop", "shifts", late.shiftId).get().then((snapshot) => snapshot.get("assignedUserIds"));
  assert.deepEqual(await assignment(), ["develop-a", "develop-b", "develop-c"]);
  await journey.step("accept", "late-consent", {}, "develop-d");
  assert.deepEqual(await assignment(), ["develop-d", "develop-b", "develop-c"]);
  assert.deepEqual((await journey.read()).selection.draw, journey.draw);
  assert.equal(requests, 0);
});

run("a draw window too short for a future public round refers the case to administration just once", async () => {
  let requests = 0;
  const phase = await prepareDrawPhase(Date.now(), async () => { requests++; return new Response(null, {status: 503}); });
  const deadline = (await phase.read()).selection.timing.phaseClosesAtMillis;
  phase.setClock(deadline - 60_000);
  const commit = await phase.command("commitDraw", "draw-too-short");
  await assert.rejects(phase.send(commit), {code: "coverage_draw_window_too_short"});
  await assert.rejects(phase.send(commit), {code: "coverage_draw_window_too_short"});
  const referred = await phase.read();
  assert.equal(referred.selection.phase, "adminRequired");
  assert.equal(referred.selection.draw, undefined);
  assert.equal(referred.selection.drawFailure.code, "coverage_draw_window_too_short");
  const adminDeadline = referred.selection.timing.phaseClosesAtMillis;
  phase.setClock(deadline);
  await phase.step("cancel", "short-cancel", {reason: "Pause case"});
  await assert.rejects(phase.send({...open("develop"), shiftId: referred.shiftId,
    operationId: "short-reopen", caseId: "short-new-case"}), {code: "coverage_slot_occupied"});
  await phase.step("resumeAdmin", "short-resume", {reason: "Continue administrative offer"});
  assert.equal((await phase.read()).selection.timing.phaseClosesAtMillis, adminDeadline);
  await assert.rejects(phase.step("commitDraw", "short-reroll"), {code: "coverage_draw_state_conflict"});
  assert.deepEqual(await drawAlerts(), ["develop-admin"]);
  await phase.step("offerAdmin", "short-offer", {userId: "develop-d", reason: "Draw window closed",
    expiresAtMillis: deadline + 10_000});
  assert.equal((await phase.read()).acceptedUserId, null);
  await phase.step("accept", "short-consent", {}, "develop-d");
  assert.equal((await phase.read()).acceptedUserId, "develop-d");
  assert.equal(requests, 0);
});

test("the pinned public pulse recovers the same committed round and the candidates can decline or accept in order",
  {skip: !enabled || process.env.HU084_PUBLIC_DRAW_ACCEPTANCE !== "1", timeout: 120_000}, async (t) => {
    let unavailable = true;
    const urls = [];
    // Only the provider and public round appear in this read. Firestore must
    // timestamp the commitment before that actual round is published.
    const journey = await prepareDraw(Date.now() - 275_000, async (url, init) => {
      urls.push(String(url));
      return unavailable ? new Response(null, {status: 503}) : fetch(url, init);
    });
    const {draw} = journey;
    assert.ok(journey.receipt.createTime.toMillis() < draw.availableAtMillis);
    const waitMillis = draw.availableAtMillis - Date.now() + 2500;
    assert.ok(waitMillis > 0 && waitMillis < 60_000);
    await new Promise((resolve) => setTimeout(resolve, waitMillis));
    journey.setClock(Date.now());
    await assert.rejects(journey.step("revealDraw", "draw-outage"), {code: "coverage_draw_provider_unavailable"});
    assert.deepEqual(await drawAlerts(), ["develop-admin"]);
    unavailable = false;
    const recovery = await journey.command("revealDraw", "draw-recover");
    await journey.send(recovery);
    const selected = await journey.read(), revealed = selected.selection.draw;
    assert.equal(revealed.commitmentDigest, draw.commitmentDigest);
    assert.equal(revealed.round, draw.round);
    assert.equal(revealed.evidence.round, draw.round);
    assert.deepEqual(revealed.candidates, draw.candidates);
    assert.deepEqual([...revealed.order].sort(), ["develop-admin", "develop-d"]);
    assert.ok(!selected.selection.drawFailure);
    const fetchCount = urls.length;
    assert.equal((await journey.send(recovery)).replayed, true);
    assert.equal(urls.length, fetchCount);
    assert.ok(urls.every((url) => new URL(url).pathname.endsWith("/" + draw.round)));
    await journey.step("cancel", "draw-cancel-revealed", {reason: "Test interruption"});
    await journey.step("resumeAdmin", "draw-resume-revealed", {reason: "Resume the original order"});
    assert.equal((await journey.read()).selection.phase, "draw");
    assert.deepEqual((await journey.read()).selection.draw, revealed);
    await journey.nextOffer("draw-offer-first");
    assert.equal((await journey.read()).offer.userId, revealed.order[0]);
    await journey.step("decline", "draw-decline", {}, revealed.order[0]);
    await journey.nextOffer("draw-offer-next");
    assert.equal((await journey.read()).offer.userId, revealed.order[1]);
    assert.equal((await journey.read()).acceptedUserId, null);
    await journey.step("accept", "draw-accept", {}, revealed.order[1]);
    const accepted = await journey.read();
    assert.equal(accepted.acceptedUserId, revealed.order[1]);
    assert.deepEqual(accepted.selection.draw, revealed);
    assert.equal(urls.length, fetchCount);
    t.diagnostic(JSON.stringify({round: draw.round, firestoreCommitMillis: journey.receipt.createTime.toMillis(),
      publishedAtMillis: draw.availableAtMillis, commitmentDigest: draw.commitmentDigest,
      randomness: revealed.evidence.randomness, order: revealed.order}));
  });

run("administrative delivery pages completed coverages, separates uncertain pushes and fences the actor again on retry", async () => {
  const environment = "production", userId = "production-d", row = ref(environment, "shiftCoverageEffects", "event-25");
  const batch = db.batch(), policy = SHIFT_COVERAGE_POLICY_REVISION;
  const {buildShiftCoverageEffects} = require("../lib/shift-coverage-effects.js");
  for (let index = 0; index < 26; index++) {
    const id = "event-" + String(index).padStart(2, "0");
    const accepted = {schemaVersion: 1, environment, policyRevision: policy, id: "case-" + id, revision: 4,
      updatedAtMillis: now - 1000, status: "accepted", creditId: null, acceptedUserId: userId, absentUserId: "production-a", openedByUserId: "production-a"};
    const next = {...accepted, status: "completed", revision: 5, updatedAtMillis: now, creditId: accepted.id};
    const acceptanceId = "accepted-" + id;
    const value = buildShiftCoverageEffects({operationId: id, action: "complete", next, before: new Map(), writes: new Map()});
    const refFor = (collection) => ref(environment, collection, id);
    batch.create(refFor("shiftCoverageOperations"), {command: {action: "complete"}, effectsDigest: value.effectsDigest, result: next});
    batch.create(refFor("shiftCoverageEffects"), {value, state: index < 24 ? "retired" : "completed", deliveredTo: [userId]});
    if (index >= 24) {
      const before = materialize(environment), after = {...before, assignedUserIds: [userId, ...before.assignedUserIds.slice(1)]};
      const acceptance = buildShiftCoverageEffects({operationId: acceptanceId, action: "accept", next: accepted,
        before: new Map([[shiftId, before]]), writes: new Map([[shiftId, after]])});
      const sheetDigest = "shift-sheets:v1:sha256:" + "1".repeat(64);
      const workbookSubmission = {schemaVersion: 1, kind: "coverageWriteBack", environment, workbookId: "test-book",
        operationId: acceptanceId, effectsDigest: acceptance.effectsDigest, sourceDigest: digest("source"),
        beforeWorkbookRevision: "1", claim: {workerId: "worker", attemptId: "run", acquiredAt: Timestamp.fromMillis(now - 1000),
          expiresAt: Timestamp.fromMillis(now + 1000), partitions: [{type: "market", partitionKey: "market", stateRevision: 1, epoch: 1}]},
        batch: {projectionDigest: sheetDigest, requestDigest: sheetDigest, submittedAt: Timestamp.fromMillis(now)},
        evidence: {workbookRevision: "2", partitionDigest: digest({projectionDigest: sheetDigest})}};
      batch.create(ref(environment, "shiftCoverageOperations", acceptanceId), {effectsDigest: acceptance.effectsDigest, result: accepted});
      batch.create(ref(environment, "shiftCoverageEffects", acceptanceId), {value: acceptance, state: "completed", workbookSubmission,
        submission: {sourceDigest: workbookSubmission.sourceDigest}, projection: {kind: "verified", projectionDigest: sheetDigest, readBackDigest: sheetDigest, operationId: acceptanceId}});
    }
    const eventId = value.notifications.find((notice) => notice.userId === userId).push.data.eventId;
    const state = index === 25 ? "unknown" : index === 24 ? "noTargets" : "accepted";
    batch.create(refFor("shiftCoverageEffects").collection("pushes").doc(userId), {eventId, attemptId: "first",
      state, result: {outcome: state}, startedAt: Timestamp.fromMillis(now), completedAt: Timestamp.fromMillis(now)});
  }
  await batch.commit();
  const actor = ref(environment, "users", "production-admin");
  let submissions = 0;
  const deps = dependencies(db, true, token, {effectDeliveryFor: (context) => ({
    drain: () => { throw Error("Cannot drain an uncertain push"); },
    inspect: () => { throw Error("No Sheets I/O for a completed effect"); },
    retryRejected: async () => {
      await actor.update({roles: ["member"]});
      await db.runTransaction((tx) => context.requireReady(tx));
      submissions++;
    },
  })});
  const query = {action: "deliveryIncidents"};
  const first = await call(environment, query, deps);
  assert.deepEqual(first.incidents, []);
  assert.equal(first.nextCursor, "event-24");
  const page = await call(environment, {...query, after: first.nextCursor}, deps);
  assert.equal(page.nextCursor, null);
  const incident = page.incidents[0];
  assert.equal(page.incidents.length, 1);
  assert.equal(incident.mode, null); assert.equal(incident.state, "pushUnconfirmed");
  assert.equal(incident.effectOperationId, row.id); assert.equal(incident.memberId, userId);
  const acceptance = ref(environment, "shiftCoverageEffects", "accepted-event-25");
  const tailPage = () => call(environment, {...query, after: first.nextCursor}, deps);
  for (const frozen of [row, acceptance]) {
    await frozen.update({state: "reconciliationRequired"});
    const [incident] = (await tailPage()).incidents;
    assert.equal(incident.state, "governedReconciliation");
    assert.equal(incident.projectionOperationId, frozen.id);
    assert.equal(incident.mode, null);
    await frozen.update({state: "completed"});
  }
  await ref(environment, "shiftCoverageOperations", "event-23").update({effectsDigest: digest("changed")});
  await ref(environment, "shiftCoverageEffects", "accepted-event-24").update({workbookSubmission: {}});
  const damaged = await call(environment, query, deps);
  assert.deepEqual(damaged.incidents, ["event-23", "event-24"].map((effectOperationId) =>
    ({effectOperationId, state: "invalidEvidence", mode: null})));
  assert.equal(damaged.nextCursor, first.nextCursor);
  const push = row.collection("pushes").doc(userId);
  await push.update({state: "failed", result: {outcome: "failed", failureCode: "all_targets_rejected"}, retryable: true});
  const rejected = (await call(environment, {...query, after: first.nextCursor}, deps)).incidents[0];
  assert.equal(rejected.mode, "retryPush"); assert.equal(rejected.expectedAttemptId, "first");
  const command = {action: "retryDelivery", mode: "retryPush", effectOperationId: row.id, memberId: userId,
    eventId: incident.eventId, operationId: "recover-once", expectedAttemptId: "first"};
  await assert.rejects(call(environment, {...command, memberId: "production-a"}, deps), {code: "coverage_delivery_target_changed"});
  await assert.rejects(call(environment, command, deps), {code: "coverage_session_changed"});
  assert.equal(submissions, 0);
  await assert.rejects(call(environment, query, deps), {code: "coverage_actor_forbidden"});
});
