"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const emulatorAvailable = process.env.FIRESTORE_EMULATOR_HOST === "127.0.0.1:8798" &&
  process.env.GCLOUD_PROJECT === "demo-reguerta-hu084-coverage";
process.env.GCLOUD_PROJECT = "demo-reguerta-hu084-coverage";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8798";
const {Timestamp} = require("@google-cloud/firestore");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {planShiftPlanningBundle} = require("../lib/shift-planning-bundle.js");
const {materializeShiftPlanningForwardActivation, applyShiftPlanningForwardActivationAttempt: applyForward} =
  require("../lib/shift-planning-forward-materializer.js");
const {applyShiftPlanningInverseRecoveryAttempt: applyInverse} = require("../lib/shift-planning-inverse-materializer.js");
const {createFirestoreShiftPlanningInverseRecoveryResolver} = require("../lib/shift-planning-firestore-source-resolver.js");
const {createProvisionalCreditFirestore, isReleasedShiftCoverageClaim} = require("../lib/shift-credit-publication.js");
const {fixture, fairnessSnapshot, materializerInput, readDocument, bundleInput, request} =
  require("./shift-planning-activation-fixture.cjs");
const root = "develop/plus-collections";
const credit = (userId, type) => ({schemaVersion: 1, policyRevision: "hu084-provisional-v1",
  id: `${type}-${userId}`, caseId: `${type}-${userId}`, userId, type, state: "pending",
  shiftId: `previous-${type}`, earnedAtMillis: 1, completionRevision: 1});
const claim = (c) => ({id: digest([c.type, c.userId]).split(":").at(-1),
  data: {caseId: c.id, userId: c.userId, type: c.type, state: "creditPending"}});
const source = (type) => {
  const credits = [credit("member-1", type), credit("outside", type)];
  return {credits, claims: credits.map(claim), ledger: {revision: 4}, frozenThroughRound: 0};
};
const setup = (configure = () => {}) => {
  const snapshot = fairnessSnapshot();
  snapshot.creditLedger = {enabled: true, policyRevision: "hu084-provisional-v1",
    sources: {delivery: source("delivery"), market: source("market")}};
  configure(snapshot);
  const value = fixture(snapshot);
  const input = materializerInput(value);
  const publication = value.liveResult.manifests.forward.creditPublication;
  input.beforeImageDocuments.push(...publication.changes.map((c) => readDocument(c.targetPath, c.before, 100)));
  return {snapshot, value, input, publication};
};

test("credited preview/stage/activation share exact plans, before images, counts and public materialization", () => {
  const {input, publication, snapshot} = setup();
  const result = materializeShiftPlanningForwardActivation(input);
  assert.equal(publication.changes.length, 6);
  assert.equal(result.beforeImages.length, 9);
  assert.equal(result.mutations.length, input.liveResult.budgets.forward.totalWrites);
  assert.equal(input.liveResult.budgets.inverse.creditLedgerWrites, 6);
  const delivery = result.publicDocuments.find((d) => d.document.type === "delivery").document;
  assert.equal(delivery.rotationOwnerUserId, "member-2");
  for (const change of publication.changes) {
    const mutation = result.mutations.find((m) => m.documentPath === change.targetPath);
    assert.equal(mutation.kind, "update");
    assert.ok(mutation.precondition.lastUpdateTime);
  }
  assert.equal(publication.sources.delivery.credits[0].state, "pending");
  assert.throws(() => fixture(snapshot, {transactionWriteLimit: result.mutations.length - 1}),
    {code: "planning_bundle_oversize"});
});

test("credits remain inaccessible outside the fixed emulator and cannot thaw an authoritative round", () => {
  const {snapshot} = setup();
  process.env.GCLOUD_PROJECT = "reguerta-9f27f";
  try {
    assert.throws(() => fixture(snapshot), {code: "coverage_provisional_emulator_required"});
  } finally { process.env.GCLOUD_PROJECT = "demo-reguerta-hu084-coverage"; }
  const frozen = structuredClone(snapshot);
  frozen.rotations.delivery.cursor.nextMemberIndex = 1;
  frozen.rotations.delivery.cohortFrozen = true;
  frozen.rotations.delivery.frozenCohortUserIds = frozen.rotations.delivery.cursor.cohortUserIds;
  assert.throws(() => planShiftPlanningBundle(bundleInput(frozen, request())), {code: "invalid_planning_state"});
  const missing = structuredClone(snapshot);
  missing.creditLedger.sources.delivery.claims = [];
  assert.throws(() => fixture(missing), {code: "credit_claim_changed"});
});

test("staged before-image forgery rejects and released-claim parsing stays strict", () => {
  const {input} = setup();
  input.beforeImageDocuments.at(-1).data = {revision: 999};
  assert.throws(() => materializeShiftPlanningForwardActivation(input), {code: "invalid_planning_forward_materialization"});
  const released = {...claim(credit("member-1", "delivery")).data, state: "released",
    consumedByPlanId: "plan", consumedAtMillis: 20};
  assert.equal(isReleasedShiftCoverageClaim(released), true);
  assert.equal(isReleasedShiftCoverageClaim({...released, consumedAtMillis: "20"}), false);
});

const withDatabase = async (body) => {
  const db = createProvisionalCreditFirestore();
  try { await db.recursiveDelete(db.doc(root)); await body(db); }
  finally { await db.terminate(); }
};
const seed = async (db, data) => {
  const batch = db.batch();
  batch.set(db.doc(data.input.requestDocument.targetPath), data.input.requestDocument.data);
  for (const doc of data.input.beforeImageDocuments) batch.set(db.doc(doc.targetPath), doc.data);
  for (const type of ["delivery", "market"]) {
    const source = data.publication.sources[type];
    batch.set(db.doc(`${root}/shiftCoverageLedgerState/${type}`), source.ledger);
    for (const c of source.credits) batch.set(db.doc(`${root}/shiftCoverageCredits/${c.id}`), c);
    for (const c of source.claims) batch.set(db.doc(`${root}/shiftCoverageMemberClaims/${c.id}`), c.data);
  }
  batch.set(db.doc(`${root}/shiftPlanningBundles/${data.value.preflight.bundle.bundleRevision}`), data.value.preflight.bundle);
  await batch.commit();
};
const read = (doc) => ({targetPath: doc.ref.path, data: doc.data(), updateTime: doc.updateTime});
const forward = (db, data) => db.runTransaction(async (transaction) => {
  const docs = await transaction.getAll(db.doc(data.input.requestDocument.targetPath),
    ...data.input.beforeImageDocuments.map((d) => db.doc(d.targetPath)));
  return applyForward({...data.input, firestore: db, transaction,
    requestDocument: read(docs[0]), beforeImageDocuments: docs.slice(1).map(read)});
});
const inverse = (db, data) => db.runTransaction(async (transaction) => {
  const resolve = createFirestoreShiftPlanningInverseRecoveryResolver({environment: "develop",
    activationOperationId: data.input.operationId});
  const resolved = await resolve({firestore: db, transaction});
  return applyInverse({...resolved, firestore: db, transaction, recoveryOperationId: "recover-credits",
    recoveredAt: Timestamp.fromMillis(data.input.attemptedAt.toMillis() + 1_000)});
});
const capture = async (db) => {
  const collections = ["shifts", "shiftRotations", "shiftPlanningState", "shiftCoverageCredits",
    "shiftCoverageMemberClaims", "shiftCoverageLedgerState", "shiftPlanningOperations", "shiftPlanningRequests"];
  const result = {};
  for (const c of collections) {
    const docs = await db.collection(`${root}/${c}`).orderBy("__name__").get();
    result[c] = docs.docs.map((doc) => [doc.id, JSON.stringify(doc.data())]);
  }
  return result;
};

test("atomic seasonal publication and canonical inverse restore credits/claims and all public rows together", {skip: !emulatorAvailable},
  () => withDatabase(async (db) => {
    const data = setup(); await seed(db, data);
    const result = await forward(db, data);
    assert.equal(result.measurement.documentWriteCount, data.value.liveResult.budgets.forward.totalWrites);
    assert.equal((await db.doc(`${root}/shiftCoverageCredits/delivery-member-1`).get()).data().state, "consumed");
    const released = await db.doc(`${root}/shiftCoverageMemberClaims/${claim(credit("member-1", "delivery")).id}`).get();
    assert.equal(isReleasedShiftCoverageClaim(released.data()), true);
    assert.equal((await db.collection(`${root}/shifts`).get()).size, data.value.liveResult.delivery.shifts.length +
      data.value.liveResult.market.shifts.length);
    const recovery = await inverse(db, data);
    assert.equal(recovery.measurement.documentWriteCount, data.value.liveResult.budgets.inverse.totalWrites);
    assert.equal((await db.collection(`${root}/shifts`).get()).size, 0);
    assert.deepEqual((await db.doc(`${root}/shiftCoverageCredits/delivery-member-1`).get()).data(), credit("member-1", "delivery"));
    assert.equal((await db.doc(released.ref.path).get()).data().state, "creditPending");
    assert.equal((await db.doc(`${root}/shiftCoverageLedgerState/delivery`).get()).data().revision, 6);
    assert.equal((await db.doc(`${root}/shiftPlanningState/current`).get()).data().writeEpoch, 9);
    const restored = await capture(db);
    await assert.rejects(() => inverse(db, data));
    assert.deepEqual(await capture(db), restored);
  }));

for (const drift of ["deferredCredit", "newCredit", "claim", "ledger"]) {
  test(`complete source CAS blocks ${drift} drift before forward and inverse with zero partial writes`, {skip: !emulatorAvailable},
    () => withDatabase(async (db) => {
      const data = setup(); await seed(db, data);
      const change = async () => {
        if (drift === "deferredCredit") await db.doc(`${root}/shiftCoverageCredits/delivery-outside`).update({completionRevision: 2});
        if (drift === "newCredit") await db.doc(`${root}/shiftCoverageCredits/delivery-new`).set(credit("new", "delivery"));
        if (drift === "claim") await db.doc(`${root}/shiftCoverageMemberClaims/${claim(credit("member-1", "delivery")).id}`)
          .update({caseId: "another-case"});
        if (drift === "ledger") await db.doc(`${root}/shiftCoverageLedgerState/delivery`).update({revision: 123});
      };
      await change(); const before = await capture(db);
      await assert.rejects(() => forward(db, data));
      assert.deepEqual(await capture(db), before);
      await db.recursiveDelete(db.doc(root)); await seed(db, data); await forward(db, data);
      await change(); const active = await capture(db);
      await assert.rejects(() => inverse(db, data));
      assert.deepEqual(await capture(db), active);
    }));
}

test("competing activation attempts cannot consume twice or partly publish", {skip: !emulatorAvailable},
  () => withDatabase(async (db) => {
    const data = setup(); await seed(db, data);
    const outcomes = await Promise.allSettled([forward(db, data), forward(db, data)]);
    assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal((await db.doc(`${root}/shiftCoverageLedgerState/delivery`).get()).data().revision, 5);
    const active = await capture(db);
    await assert.rejects(() => forward(db, data));
    assert.deepEqual(await capture(db), active);
  }));

const {createGovernedShiftPlanningForwardActivationResolver, refreshShiftPlanningLiveSource,
  loadCurrentShiftPlanningLiveSource} = require("../lib/shift-planning-firestore-source-producer.js");
const seedGoverned = async (db) => {
  const initial = setup(); await seed(db, initial);
  const policy = {schemaVersion: 1, environment: "develop", policyRevision: "hu084-local-source",
    delivery: {continuity: {kind: "newRotation"}, inheritedTargetPrefix: null, futureProjectionOccupancy: []},
    market: {inheritedTargetPrefix: null, futureProjectionOccupancy: []},
    releaseLeaseDurationMillis: initial.snapshot.config.releaseLeaseDurationMillis,
    creditLedger: {enabled: true, policyRevision: "hu084-provisional-v1"}, sync: initial.snapshot.sync,
    transactionWriteLimit: 500};
  const batch = db.batch();
  batch.set(db.doc(`${root}/shiftPlanningState/sourcePolicy`), policy);
  batch.set(db.doc(`${root}/config/global`), {otherConfig: {deliveryDayOfWeek: "THU"}});
  for (const member of initial.snapshot.roster) batch.set(db.doc(`${root}/users/${member.userId}`), member);
  await batch.commit();
  const {source} = await refreshShiftPlanningLiveSource({firestore: db, environment: "develop"});
  const value = fixture(source.inputs.fairnessSnapshot);
  const input = materializerInput(value);
  const publication = value.liveResult.manifests.forward.creditPublication;
  input.beforeImageDocuments.push(...publication.changes.map((c) => readDocument(c.targetPath, c.before, 100)));
  const data = {value, input, publication};
  await seed(db, data);
  const candidateRef = db.doc(`${root}/shiftPlanningCandidates/${value.preflight.candidate.bundleId}`);
  const staged = db.batch();
  staged.set(candidateRef, value.preflight.candidate);
  for (const position of value.preflight.positions) {
    staged.set(candidateRef.collection("positions").doc(position.position.positionId), position);
  }
  await staged.commit();
  return data;
};
const governedForward = (db, data) => db.runTransaction(async (transaction) => {
  const resolver = createGovernedShiftPlanningForwardActivationResolver({environment: "develop",
    requestId: data.value.preflight.request.requestId});
  const resolved = await resolver({firestore: db, transaction});
  return applyForward({...data.input, ...resolved, firestore: db, transaction});
});

test("governed source captures real ledger/claims and uses the common forward resolver through recovery", {skip: !emulatorAvailable},
  () => withDatabase(async (db) => {
    const data = await seedGoverned(db);
    const before = await capture(db);
    const source = await loadCurrentShiftPlanningLiveSource({firestore: db, environment: "develop"});
    assert.deepEqual(await capture(db), before);
    assert.equal(source.inputs.fairnessSnapshot.creditLedger.sources.delivery.credits.length, 2);
    await governedForward(db, data);
    assert.equal((await db.doc(`${root}/shiftCoverageCredits/market-member-1`).get()).data().state, "consumed");
    await inverse(db, data);
    assert.equal((await db.collection(`${root}/shifts`).get()).size, 0);
    assert.equal((await db.doc(`${root}/shiftCoverageCredits/market-member-1`).get()).data().state, "pending");
  }));

test("governed activation rejects a new ledger credit or member demotion after stage", {skip: !emulatorAvailable},
  () => withDatabase(async (db) => {
    for (const drift of ["newCredit", "member"]) {
      await db.recursiveDelete(db.doc(root));
      const data = await seedGoverned(db);
      if (drift === "newCredit") await db.doc(`${root}/shiftCoverageCredits/delivery-outside`).update({completionRevision: 2});
      else await db.doc(`${root}/users/member-2`).update({isActive: false});
      const before = await capture(db);
      await assert.rejects(() => governedForward(db, data));
      assert.deepEqual(await capture(db), before);
    }
  }));

const {captureShiftCreditPublicationSources} = require("../lib/shift-credit-publication.js");
test("governed credit carryover is recovered from the active bundle and its actual consumed ledger", {skip: !emulatorAvailable},
  () => withDatabase(async (db) => {
    const data = setup((snapshot) => {
      snapshot.roster.push({...snapshot.roster[1], userId: "member-7"});
      for (const type of ["delivery", "market"]) snapshot.rotations[type].cursor.cohortUserIds.push("member-7");
      snapshot.creditLedger.sources.market.frozenThroughRound = 4;
    });
    await seed(db, data); await forward(db, data);
    const market = data.value.liveResult.market;
    const overflow = market.shifts.slice(10);
    const units = market.creditProjection.units.slice(10);
    assert.ok(units.some((unit) => unit.consumedCreditIds.length));
    const before = await capture(db);
    const captureSources = () => db.runTransaction(async (transaction) => {
      const rotations = await transaction.getAll(db.doc(`${root}/shiftRotations/delivery`), db.doc(`${root}/shiftRotations/market`));
      return captureShiftCreditPublicationSources({firestore: db, transaction,
        rotations: {delivery: rotations[0].data(), market: rotations[1].data()}, prefixes: {delivery: null,
          market: {dates: overflow.map((shift) => shift.date), positions: overflow.flatMap((shift) => shift.rotationPositions),
            rotationBeforePrefix: market.cursorAtTargetBoundary, lineageRevision: data.value.liveResult.bundleRevision,
            lineageDigest: data.value.liveResult.bundleDigest}}});
    });
    const sources = await captureSources();
    assert.deepEqual(sources.market.inheritedUnits, units.map((unit) => unit.servedPositions));
    assert.equal(sources.market.credits.find((c) => c.userId === "member-1").state, "consumed");
    assert.deepEqual(await capture(db), before);
    await db.doc(`${root}/shiftPlanningBundles/${data.value.liveResult.bundleRevision}`).update({artifactDigest: digest("forged")});
    await assert.rejects(() => captureSources(), {code: "credit_prefix_ledger_changed"});
  }));
