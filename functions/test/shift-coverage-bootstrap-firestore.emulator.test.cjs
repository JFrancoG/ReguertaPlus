"use strict";
const assert = require("node:assert/strict");
const {test, before, beforeEach, after} = require("node:test");
const {Firestore} = require("@google-cloud/firestore");
const {createFirestoreShiftCoverageBootstrap, readVerifiedShiftCoverageBootstrap} =
  require("../lib/shift-coverage-bootstrap-firestore.js");
const {decodeShiftPlanningFirestoreDocument} = require("../lib/shift-planning-publication-contract.js");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {scope: barrierScope, evidence: barrierEvidence} = require("./shift-planning-barrier-fixture.cjs");
const {createShiftPlanningTrustedIntakeBarrierCheckpoint: checkpoint,
  createShiftPlanningIntakeBarrierFailureClosureRecord: failureRecord} =
  require("../lib/shift-planning-trusted-intake-barrier-adapter.js");
const fixture = require("./shift-coverage-bootstrap-fixture.cjs");
const projectId = "demo-reguerta-hu084-coverage";
const enabled = process.env.GCLOUD_PROJECT === projectId && process.env.FIRESTORE_EMULATOR_HOST === "127.0.0.1:8798";
const run = (name, body) => test(name, {skip: !enabled}, body);
const identity = {uid: "bootstrap-admin", email: null, emailVerified: true};
let db, now;
const ref = (environment, path) => db.doc(`${environment}/plus-collections/${path}`);

before(() => {
  if (enabled) db = new Firestore({projectId, host: "127.0.0.1:8798", ssl: false});
});
after(async () => { if (db) await db.terminate(); });
beforeEach(async () => {
  if (!enabled) return;
  assert.equal((await fetch(`http://127.0.0.1:8798/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    {method: "DELETE"})).ok, true);
  now = fixture.initialTime;
});

const seed = async (environment) => {
  for (const document of fixture.snapshot(environment).documents) {
    if (document.value !== null) await db.doc(document.path).set(decodeShiftPlanningFirestoreDocument(document.value));
  }
  await ref(environment, "users/admin").update({authUid: identity.uid});
  await ref(environment, `authLinks/${identity.uid}`).set({memberId: "admin"});
};

const governed = async (environment = "develop", options = {}) => {
  await seed(environment);
  let held, failed = null, controls = 0, readBacks = 0;
  const service = createFirestoreShiftCoverageBootstrap({firestore: options.firestore ?? db, environment,
    nowMillis: () => now, controlPlane: {
      closeAndCollect: async () => { controls++; await options.onClose?.(); return held(); },
      readBackClosed: async () => { readBacks++; await options.onReadBack?.(readBacks);
        return held((payload) => options.mutateReadBackEvidence?.(payload, readBacks)); },
    }, failurePersistence: {
      readExistingFailure: async () => failed,
      retainFailureAndReadBack: async (request) => (failed = failureRecord(request, now)),
    }});
  const decision = fixture.decision(environment);
  const plan = await service.preview(decision);
  assert.deepEqual(plan.blockers, []);
  const state = (await ref(environment, "shiftPlanningState/current").get()).data();
  const scope = barrierScope({environment, transitionId: decision.operationId,
    expectedAuthoritativeDigest: plan.sourceDigest, expectedStateRevision: state.stateRevision,
    expectedWriteEpoch: state.writeEpoch, expectedActiveRevision: state.activeRevision, expectedActiveDigest: state.activeDigest,
    expectedWorkbookFileId: "coverage-rehearsal-book", expectedWorkbookRevision: "1"});
  const payload = barrierEvidence().payload;
  const shiftTimes = (value) => {
    for (const [key, item] of Object.entries(value)) {
      if (item && typeof item === "object") shiftTimes(item);
      else if (key.endsWith("AtMillis")) value[key] += now - 520;
    }
  };
  shiftTimes(payload);
  payload.environment = environment;
  payload.transition = {transitionId: decision.operationId, expectedAuthoritativeDigest: plan.sourceDigest,
    expectedStateRevision: state.stateRevision, expectedWriteEpoch: state.writeEpoch,
    expectedActiveRevision: state.activeRevision, expectedActiveDigest: state.activeDigest};
  payload.workbook.fileId = scope.expectedWorkbookFileId;
  payload.workbook.revision = payload.workbook.readBackRevision = "1";
  options.mutateEvidence?.(payload);
  held = (mutate) => {
    const observed = structuredClone(payload);
    mutate?.(observed);
    return checkpoint({scope, holdRevision: "bootstrap-local-held", evidence: {payload: observed, digest: digest(observed)}});
  };
  const request = {decision, expectedPlanDigest: plan.planDigest, identity, scope};
  return {service, request, plan, get controls() { return controls; }, get failed() { return failed; },
    apply: (overrides = {}) => service.apply({...request, ...overrides})};
};

const readProof = (environment) => db.runTransaction((tx) => readVerifiedShiftCoverageBootstrap(db, tx, environment));
const stableSources = async (environment) => {
  const root = `${environment}/plus-collections`;
  const result = [];
  for (const collection of ["users", "shifts", "shiftRotations", "shiftPlanningState"]) {
    const docs = await db.collection(`${root}/${collection}`).orderBy("__name__").get();
    result.push([collection, docs.docs.map((doc) => [doc.id, doc.data(), doc.updateTime])]);
  }
  return result;
};

run("SDK bootstrap isolates environments, creates exact private baseline atomically and preserves public sources", async () => {
  for (const environment of ["develop", "production"]) {
    const f = await governed(environment), before = await stableSources(environment);
    const inspected = await f.service.inspect();
    assert.equal(inspected.environment, environment);
    const result = await f.apply();
    assert.equal(result.state, "completed"); assert.equal(result.replayed, false);
    assert.deepEqual(await stableSources(environment), before);
    const receipt = await readProof(environment);
    assert.equal(receipt.planDigest, f.plan.planDigest); assert.equal(receipt.actor.memberId, "admin");
    const pointer = await ref(environment, "shiftCoverageMigrations/current").get();
    const operation = await ref(environment, `shiftCoverageMigrations/${f.request.decision.operationId}`).get();
    assert.ok(pointer.createTime.isEqual(operation.createTime));
    for (const type of ["delivery", "market"]) {
      assert.deepEqual((await ref(environment, `shiftCoverageLedgerState/${type}`).get()).data(), {revision: 0});
    }
    assert.equal((await db.collection(`${environment}/plus-collections/shiftCoverageCredits`).get()).size, 0);
    assert.equal((await db.collection(`${environment}/plus-collections/shiftCoverageReserves`).get()).size, 0);
    assert.equal((await ref(environment, "shiftMembershipState/admin").get()).data().value.revision, 1);
    assert.deepEqual(await f.apply(), {...result, replayed: true});
  }
});

run("exact replay retains later private history and still requires reciprocal current administrator", async () => {
  const f = await governed(); await f.apply();
  await ref("develop", "shiftCoverageLedgerState/delivery").update({revision: 3});
  const memberRef = ref("develop", "shiftMembershipState/admin"), original = (await memberRef.get()).data();
  const value = {...original.value, revision: 2};
  await memberRef.set({value, digest: digest(value)});
  assert.equal((await f.apply()).replayed, true);
  assert.equal((await ref("develop", "shiftCoverageLedgerState/delivery").get()).data().revision, 3);
  assert.equal((await memberRef.get()).data().value.revision, 2);
  await ref("develop", "users/admin").update({roles: ["member"]});
  await assert.rejects(f.apply(), {status: 403, code: "coverage_actor_forbidden"});
});

run("source query phantoms after preview reject every initial create", async () => {
  const f = await governed("production", {onClose: async () => {
    await ref("production", "users/late-phantom").set({isActive: true, roles: ["member"], isCommonPurchaseManager: false});
  }});
  await assert.rejects(f.apply(), {code: "coverage_bootstrap_plan_changed"});
  assert.equal((await ref("production", "shiftCoverageMigrations/current").get()).exists, false);
  assert.equal((await db.collection("production/plus-collections/shiftMembershipState").get()).size, 0);
  assert.equal((await ref("production", "shiftCoverageLedgerState/delivery").get()).exists, false);
  assert.equal(f.failed.phase, "operation");
});

run("rebound canonical identity after preflight cannot initialize under a different administrator", async () => {
  const f = await governed("develop", {onClose: async () => {
    await ref("develop", "users/other-admin").set({isActive: true, roles: ["member", "admin"],
      isCommonPurchaseManager: false, authUid: identity.uid});
    await ref("develop", `authLinks/${identity.uid}`).set({memberId: "other-admin"});
  }});
  await assert.rejects(f.apply(), {code: "coverage_session_changed"});
  assert.equal((await ref("develop", "shiftCoverageMigrations/current").get()).exists, false);
  assert.equal((await db.collection("develop/plus-collections/shiftMembershipState").get()).size, 0);
});

run("wrong scope, changed decision and a future cutoff stop before barrier or writes", async () => {
  const f = await governed();
  await assert.rejects(f.apply({scope: {...f.request.scope, expectedWriteEpoch: 99}}), {code: "coverage_bootstrap_scope_changed"});
  await assert.rejects(f.apply({decision: {...f.request.decision, confirmationReference: "Another intent"}}),
    {code: "coverage_bootstrap_plan_changed"});
  await assert.rejects(f.apply({decision: {...f.request.decision, effectiveAtMillis: now + 1}}),
    {code: "coverage_bootstrap_intent_invalid"});
  assert.equal(f.controls, 0);
  assert.equal((await ref("develop", "shiftCoverageMigrations/current").get()).exists, false);
});

run("a terminal workbook pointer from another book or typed environment cannot admit bootstrap", async () => {
  const f = await governed();
  const {coverageWorkbookSubmission} = require("./shift-coverage-fixture.cjs");
  for (const overrides of [{workbookId: "foreign-book"}, {environment: "production"}]) {
    const receipt = coverageWorkbookSubmission({now: now - 60_000, ...overrides});
    const projectionDigest = `shift-sheets:v1:sha256:${"a".repeat(64)}`;
    receipt.batch = {projectionDigest, requestDigest: `shift-sheets:v1:sha256:${"b".repeat(64)}`,
      submittedAt: fixture.Timestamp.fromMillis(now - 1)};
    receipt.evidence = {workbookRevision: "2", partitionDigest: digest({projectionDigest})};
    await ref("develop", "shiftPlanningState/sheetsSubmission").set(receipt);
    const blocked = await f.service.preview(f.request.decision);
    assert.ok(blocked.blockers.length > 0); assert.deepEqual(blocked.creates, []);
    await assert.rejects(f.apply(), {code: "coverage_bootstrap_plan_changed"});
  }
  assert.equal(f.controls, 0);
  assert.equal((await ref("develop", "shiftCoverageMigrations/current").get()).exists, false);
});

run("concurrent initialization commits one baseline and one immutable receipt", async () => {
  const f = await governed();
  const results = await Promise.all([f.apply(), f.apply()]);
  assert.equal(results.filter((result) => result.replayed).length, 1);
  assert.equal((await db.collection("develop/plus-collections/shiftCoverageMigrations").get()).size, 2);
  assert.deepEqual((await ref("develop", "shiftCoverageLedgerState/delivery").get()).data(), {revision: 0});
});

run("a lost Firestore acknowledgement resolves the committed proof without another business write", async () => {
  let armed = true;
  const sdk = new Proxy(db, {get(target, key) {
    if (key === "runTransaction") return async (...args) => {
      const result = await target.runTransaction(...args);
      if (armed && result?.state === "completed" && result.replayed === false) {
        armed = false; throw new Error("Injected lost commit acknowledgement");
      }
      return result;
    };
    const value = Reflect.get(target, key, target);
    return typeof value === "function" ? value.bind(target) : value;
  }});
  const f = await governed("production", {firestore: sdk});
  const result = await f.apply();
  assert.equal(result.replayed, true); assert.equal(f.failed, null);
  assert.equal((await db.collection("production/plus-collections/shiftCoverageMigrations").get()).size, 2);
  assert.ok(await readProof("production"));
});

run("rewritten or malformed bootstrap evidence closes readiness while SDK errors propagate", async () => {
  const f = await governed(); await f.apply();
  const pointerRef = ref("develop", "shiftCoverageMigrations/current");
  const pointer = (await pointerRef.get()).data();
  await pointerRef.set({...pointer, temporarilyChanged: true});
  await pointerRef.set(pointer);
  assert.equal(await readProof("develop"), null, "restoring fields after a real change does not restore the creation proof");
  await pointerRef.set({...pointer, unknown: true});
  assert.equal(await readProof("develop"), null);
  const failure = new Error("Injected SDK read failure");
  await assert.rejects(readVerifiedShiftCoverageBootstrap(db, {get: async () => { throw failure; }}, "develop"),
    (error) => error === failure);
});

run("in-flight writer evidence keeps the barrier closed and cannot create any baseline state", async () => {
  const f = await governed("develop", {mutateReadBackEvidence: (payload, index) => {
    if (index === 1) payload.writerControls[0].inFlightWorkCount = 1;
  }});
  await assert.rejects(f.apply());
  assert.equal((await ref("develop", "shiftCoverageMigrations/current").get()).exists, false);
  assert.equal((await ref("develop", "shiftCoverageLedgerState/delivery").get()).exists, false);
  assert.ok(f.failed);
  assert.equal(f.failed.phase, "initialReadBack");
});

run("lost final barrier read-back retains the committed baseline and prevents clean retry or restoration", async () => {
  const f = await governed("develop", {onReadBack: async (index) => {
    if (index === 2) throw new Error("Injected final control-plane acknowledgement loss");
  }});
  await assert.rejects(f.apply(), /Injected final control-plane acknowledgement loss/);
  const receipt = await readProof("develop");
  assert.ok(receipt); assert.equal(receipt.planDigest, f.plan.planDigest);
  assert.equal(f.failed.phase, "finalReadBack");
  const marker = await ref("develop", "shiftCoverageMigrations/current").get();
  assert.equal((await ref("develop", "shiftMembershipState/admin").get()).data().value.revision, 1);
  await ref("develop", "shiftCoverageLedgerState/delivery").update({revision: 8});
  await assert.rejects(f.apply());
  assert.equal((await ref("develop", "shiftCoverageLedgerState/delivery").get()).data().revision, 8);
  assert.deepEqual(await readProof("develop"), receipt);
  assert.ok((await ref("develop", "shiftCoverageMigrations/current").get()).updateTime.isEqual(marker.updateTime));
  assert.equal(f.controls, 1, "a durably failed held scope is not reopened by receipt replay");
});
