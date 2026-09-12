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
    const source = data.publication?.sources[type];
    if (!source) continue;
    if (source.ledger) batch.set(db.doc(`${root}/shiftCoverageLedgerState/${type}`), source.ledger);
    for (const c of source.credits) batch.set(db.doc(`${root}/shiftCoverageCredits/${c.id}`), c);
    for (const c of source.claims) batch.set(db.doc(`${root}/shiftCoverageMemberClaims/${c.id}`), c.data);
  }
  const membership = data.publication?.sources.membership;
  if (membership) {
    for (const record of membership.records) batch.set(db.doc(`${root}/shiftMembershipState/${record.id}`), record.data);
    for (const reserve of membership.reserves) batch.set(db.doc(`${root}/shiftCoverageReserves/${reserve.id}`), reserve.data);
    for (const member of data.snapshot?.roster ?? []) batch.set(db.doc(`${root}/users/${member.userId}`), member);
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
  const collections = ["shiftMembershipState", "shiftMembershipOperations", "shiftCoverageReserves", "shifts", "shiftRotations", "shiftPlanningState", "shiftCoverageCredits",
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

for (const drift of ["deferredCredit", "newCredit", "claim", "ledger", "membershipReentry"]) {
  test(`complete source CAS blocks ${drift} drift before forward and inverse with zero partial writes`, {skip: !emulatorAvailable},
    () => withDatabase(async (db) => {
      const data = setup(); await seed(db, data);
      const change = async () => {
        if (drift === "deferredCredit") await db.doc(`${root}/shiftCoverageCredits/delivery-outside`).update({completionRevision: 2});
        if (drift === "newCredit") await db.doc(`${root}/shiftCoverageCredits/delivery-new`).set(credit("new", "delivery"));
        if (drift === "claim") await db.doc(`${root}/shiftCoverageMemberClaims/${claim(credit("member-1", "delivery")).id}`)
          .update({caseId: "another-case"});
        if (drift === "ledger") await db.doc(`${root}/shiftCoverageLedgerState/delivery`).update({revision: 123});
        if (drift === "membershipReentry") {
          const value = {schemaVersion: 1, policyRevision: "hu084-provisional-v1", userId: "member-1",
            revision: 3, source: {isActive: true, roles: ["member"], isCommonPurchaseManager: false},
            eligible: true, observedAtMillis: 3, pendingQueueTransition: true,
            admissionAfterRound: {delivery: 1, market: 1}};
          await db.doc(`${root}/shiftMembershipState/member-1`).set({value, digest: digest(value)});
        }
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
const seedGoverned = async (db, initial = setup()) => {
  await seed(db, initial);
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

test("membership re-entry fences governed source and ordinary credit-disabled publication", {skip: !emulatorAvailable},
  () => withDatabase(async (db) => {
    const pending = async () => {
      const value = {schemaVersion: 1, policyRevision: "hu084-provisional-v1", userId: "member-1",
        revision: 3, source: {isActive: true, roles: ["member"], isCommonPurchaseManager: false},
        eligible: true, observedAtMillis: 3, pendingQueueTransition: true,
        admissionAfterRound: {delivery: 1, market: 1}};
      await db.doc(`${root}/shiftMembershipState/member-1`).set({value, digest: digest(value)});
    };
    await seedGoverned(db); await pending();
    await db.doc(`${root}/shiftPlanningState/sourcePolicy`).update({creditLedger: {...fairnessSnapshot().creditLedger, digest: digest("disabled")}});
    let before = await capture(db);
    await assert.rejects(refreshShiftPlanningLiveSource({firestore: db, environment: "develop"}),
      {code: "membership_queue_transition_pending"});
    assert.deepEqual(await capture(db), before);
    await db.recursiveDelete(db.doc(root));
    const value = fixture(); const data = {value, input: materializerInput(value)};
    assert.equal(value.liveResult.manifests.forward.creditPublication, undefined);
    await seed(db, data); await pending(); before = await capture(db);
    await assert.rejects(forward(db, data), {code: "membership_queue_transition_pending"});
    assert.deepEqual(await capture(db), before);
  }));

const {admissionSnapshot} = require("./shift-membership-planning-fixture.cjs");
const setupAdmission = (withCredits = false, configure = () => {}) => {
  const snapshot = admissionSnapshot();
  if (withCredits) {
    const creditSources = setup().snapshot.creditLedger.sources;
    snapshot.creditLedger.sources.delivery = creditSources.delivery;
    snapshot.creditLedger.sources.market = creditSources.market;
  }
  configure(snapshot);
  const value = fixture(snapshot); const input = materializerInput(value);
  const publication = value.liveResult.manifests.forward.creditPublication;
  input.beforeImageDocuments.push(...publication.changes.map((change) => readDocument(change.targetPath, change.before, 100)));
  return {snapshot, value, input, publication};
};

test("new-round admission publishes both cohorts and acknowledgements together; inverse restores order and advances member revisions",
  {skip: !emulatorAvailable}, () => withDatabase(async (db) => {
    const data = setupAdmission(true); await seed(db, data);
    const before = await capture(db);
    const result = await forward(db, data);
    assert.equal(result.measurement.documentWriteCount, data.value.liveResult.budgets.forward.totalWrites);
    for (const type of ["delivery", "market"]) {
      const rotation = (await db.doc(`${root}/shiftRotations/${type}`).get()).data();
      assert.deepEqual(rotation.cursor.cohortUserIds, data.value.liveResult[type].nextRotation.cohortUserIds);
      assert.equal(rotation.cursor.cohortUserIds.includes("member-2"), false);
      assert.ok(rotation.cursor.cohortUserIds.indexOf("member-1") > 0);
      assert.equal((await db.doc(`${root}/shiftCoverageCredits/${type}-member-1`).get()).data().state, "consumed");
    }
    for (const entry of data.publication.sources.membership.records) {
      const state = (await db.doc(`${root}/shiftMembershipState/${entry.id}`).get()).data();
      assert.equal(state.value.pendingQueueTransition, false); assert.equal(state.value.revision, 4);
      assert.equal(state.digest, digest(state.value));
    }
    assert.deepEqual((await capture(db)).shiftCoverageReserves, before.shiftCoverageReserves);
    await inverse(db, data);
    assert.equal((await db.collection(`${root}/shifts`).get()).size, 0);
    for (const entry of data.publication.sources.membership.records) {
      const state = (await db.doc(`${root}/shiftMembershipState/${entry.id}`).get()).data();
      assert.equal(state.value.revision, 5); assert.equal(state.value.pendingQueueTransition, true);
      assert.deepEqual(state.value.admissionRequired, entry.data.value.admissionRequired);
      assert.equal(state.digest, digest(state.value));
    }
    for (const type of ["delivery", "market"]) {
      assert.deepEqual((await db.doc(`${root}/shiftRotations/${type}`).get()).data().cursor, data.snapshot.rotations[type].cursor);
    }
  }));

for (const drift of ["reserve", "state", "unreconciledUser", "newState"]) {
  test(`membership ${drift} drift rejects forward/inverse admission without partial publication`,
    {skip: !emulatorAvailable}, () => withDatabase(async (db) => {
      const data = setupAdmission();
      const change = async () => {
        const source = data.publication.sources.membership;
        if (drift === "reserve") await db.doc(`${root}/shiftCoverageReserves/${source.reserves[0].id}`).update({revision: 99});
        if (drift === "state") {
          const ref = db.doc(`${root}/shiftMembershipState/member-1`); const stored = (await ref.get()).data();
          stored.value.revision += 1; stored.digest = digest(stored.value); await ref.set(stored);
        }
        if (drift === "unreconciledUser") await db.doc(`${root}/users/member-1`).update({isCommonPurchaseManager: true});
        if (drift === "newState") {
          const value = {...source.records[0].data.value, userId: "late", pendingQueueTransition: false};
          await db.doc(`${root}/shiftMembershipState/late`).set({value, digest: digest(value)});
        }
      };
      await seed(db, data); await change(); const before = await capture(db);
      await assert.rejects(forward(db, data)); assert.deepEqual(await capture(db), before);
      await db.recursiveDelete(db.doc(root)); await seed(db, data); await forward(db, data); await change();
      const active = await capture(db); await assert.rejects(inverse(db, data)); assert.deepEqual(await capture(db), active);
    }));
}

test("governed source derives and activates new-round membership from canonical state and reserves", {skip: !emulatorAvailable},
  () => withDatabase(async (db) => {
    const data = await seedGoverned(db, setupAdmission());
    const before = await capture(db);
    const source = await loadCurrentShiftPlanningLiveSource({firestore: db, environment: "develop"});
    assert.equal(source.inputs.fairnessSnapshot.creditLedger.sources.membership.records.length, 3);
    assert.deepEqual(await capture(db), before);
    await governedForward(db, data);
    assert.equal((await db.doc(`${root}/shiftMembershipState/member-1`).get()).data().value.pendingQueueTransition, false);
    await inverse(db, data);
    assert.equal((await db.doc(`${root}/shiftMembershipState/member-1`).get()).data().value.pendingQueueTransition, true);
  }));

test("concurrent admission cannot acknowledge membership twice or partly publish one cohort", {skip: !emulatorAvailable},
  () => withDatabase(async (db) => {
    const data = setupAdmission(); await seed(db, data);
    const results = await Promise.allSettled([forward(db, data), forward(db, data)]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal((await db.doc(`${root}/shiftMembershipState/member-1`).get()).data().value.revision, 4);
    const after = await capture(db); await assert.rejects(forward(db, data)); assert.deepEqual(await capture(db), after);
  }));

const freezeMarket = (snapshot) => {
  const rotation = snapshot.rotations.market;
  rotation.cursor.nextMemberIndex = 1; rotation.cohortFrozen = true;
  rotation.frozenCohortUserIds = [...rotation.cursor.cohortUserIds];
  snapshot.creditLedger.sources.market.frozenThroughRound = 1;
  for (const record of snapshot.creditLedger.sources.membership.records) {
    record.data.value.admissionAfterRound.market = 1;
    record.data.digest = digest(record.data.value);
  }
};

test("frozen seasonal preview preserves departed and reactivated owners as omissions inside complete market units", () => {
  const data = setupAdmission(true, freezeMarket);
  const units = data.value.liveResult.market.creditProjection.units;
  assert.deepEqual(units[0].assignments.map((p) => p.rotationOwnerUserId), ["member-6", "member-5", "member-4"]);
  assert.deepEqual(units[0].servedPositions.filter((p) => p.excuse).map((p) =>
    [p.rotationOwnerUserId, p.roundNumber, p.positionInRound, p.excuse.reason, p.creditId]),
  [["member-2", 1, 2, "excusedDeparture", null], ["member-1", 1, 3, "excusedDeparture", null]]);
  assert.equal(data.publication.excusedOwnerPositionKeys.length, 2);
  assert.ok(units.slice(1).some((unit) => unit.consumedCreditIds.includes("market-member-1")));
  const snapshot = structuredClone(data.snapshot);
  snapshot.creditLedger.sources.membership.publishedOwnerPositionKeys = [JSON.stringify(["market", 1, 2, "member-2"])];
  assert.throws(() => fixture(snapshot), {code: "membership_position_already_published"});
});

test("frozen publication commits omission evidence, full units and membership together; inverse restores frozen ownership",
  {skip: !emulatorAvailable}, () => withDatabase(async (db) => {
    const data = setupAdmission(true, freezeMarket); await seed(db, data);
    await forward(db, data);
    const active = (await db.doc(`${root}/shiftPlanningBundles/${data.value.preflight.bundle.bundleRevision}`).get()).data();
    assert.ok(JSON.stringify(active).includes("excusedDeparture"));
    const shifts = await db.collection(`${root}/shifts`).where("type", "==", "market").get();
    assert.ok(shifts.docs.every((doc) => new Set(doc.data().assignedUserIds).size === 3));
    assert.ok(shifts.docs.every((doc) => !doc.data().rotationPositions.some((p) =>
      p.roundNumber === 1 && ["member-1", "member-2"].includes(p.rotationOwnerUserId))));
    assert.equal((await db.doc(`${root}/shiftMembershipState/member-2`).get()).data().value.pendingQueueTransition, false);
    await inverse(db, data);
    assert.equal((await db.collection(`${root}/shifts`).get()).size, 0);
    assert.deepEqual((await db.doc(`${root}/shiftRotations/market`).get()).data().cursor, data.snapshot.rotations.market.cursor);
    const restored = (await db.doc(`${root}/shiftMembershipState/member-1`).get()).data();
    assert.equal(restored.value.revision, 5); assert.equal(restored.value.pendingQueueTransition, true);
    assert.deepEqual(restored.value.frozenExclusion, {reason: "excusedDeparture", revision: 2});
    assert.equal((await db.doc(`${root}/shiftCoverageCredits/market-member-1`).get()).data().state, "pending");
  }));

test("a position published after frozen preview rejects activation and inverse with zero partial writes",
  {skip: !emulatorAvailable}, () => withDatabase(async (db) => {
    const data = setupAdmission(false, freezeMarket);
    const materialized = materializeShiftPlanningForwardActivation(data.input);
    const original = materialized.publicDocuments.find((item) => item.document.type === "market").document;
    const document = {...original, date: Timestamp.fromDate(new Date("2025-09-01T00:00:00Z")),
      projectionSeasonStartYear: 2025, rotationPositions: [...original.rotationPositions],
      rotationOwnerUserIds: [...original.rotationOwnerUserIds], assignedUserIds: [...original.assignedUserIds],
      lastBackendMutation: {...original.lastBackendMutation, targetPath: `${root}/shifts/shift_market_20250901`}};
    document.rotationPositions[0] = {...original.rotationPositions[0], rotationOwnerUserId: "member-2",
      effectiveAssigneeUserId: "member-2", roundNumber: 1, positionInRound: 2};
    document.rotationOwnerUserIds[0] = "member-2";
    document.assignedUserIds[0] = "member-2";
    const ref = db.doc(`${root}/shifts/shift_market_20250901`);
    const {parseShiftPlanningPublicShiftDocument} = require("../lib/shift-planning-publication-contract.js");
    parseShiftPlanningPublicShiftDocument({targetPath: ref.path, value: document});
    await seed(db, data); await ref.set(document);
    const before = await capture(db);
    await assert.rejects(forward(db, data), {code: "membership_position_already_published"});
    assert.deepEqual(await capture(db), before);
    await ref.delete(); await forward(db, data); await ref.set(document);
    const active = await capture(db);
    await assert.rejects(inverse(db, data), {code: "membership_position_already_published"});
    assert.deepEqual(await capture(db), active);
  }));

test("governed source captures frozen ownership and resolves publication through the canonical activation path",
  {skip: !emulatorAvailable}, () => withDatabase(async (db) => {
    const data = await seedGoverned(db, setupAdmission(false, freezeMarket));
    const source = await loadCurrentShiftPlanningLiveSource({firestore: db, environment: "develop"});
    assert.deepEqual(source.inputs.fairnessSnapshot.creditLedger.sources.membership.publishedOwnerPositionKeys, []);
    assert.equal(data.publication.excusedOwnerPositionKeys.length, 2);
    await governedForward(db, data); await inverse(db, data);
    assert.equal((await db.doc(`${root}/shiftRotations/market`).get()).data().cursor.nextMemberIndex, 1);
  }));

const setupLargeFrozen = (departure) => setup((snapshot) => {
  const {recordFor, reserveFor} = require("./shift-membership-planning-fixture.cjs");
  const member = snapshot.roster[0];
  snapshot.roster = Array.from({length: departure ? 34 : 35}, (_, i) => ({...member, userId: `member-${i + 1}`}));
  const ids = snapshot.roster.slice(0, 34).map((m) => m.userId);
  for (const type of ["delivery", "market"]) snapshot.rotations[type].cursor.cohortUserIds = [...ids];
  const changing = snapshot.roster.at(-1);
  changing.isActive = !departure;
  const record = recordFor(changing, !departure);
  const membership = {records: [record], reserves: departure ? [] :
    ["delivery", "market"].map((type) => reserveFor(changing.userId, type))};
  const empty = () => ({credits: [], claims: [], ledger: null, frozenThroughRound: 0});
  snapshot.creditLedger.sources = {delivery: empty(), market: empty(), membership};
  freezeMarket(snapshot);
});

test("frozen overflow retains omission and cohort-boundary proof in the active bundle for next-season carryover",
  {skip: !emulatorAvailable}, () => withDatabase(async (db) => {
    const data = setupLargeFrozen(true); await seed(db, data); await forward(db, data);
    const market = data.value.liveResult.market; const overflow = market.shifts.slice(10);
    const units = market.creditProjection.units.slice(10);
    assert.equal(units.length, 1);
    assert.deepEqual(units[0].assignments.map((p) => p.rotationOwnerUserId), ["member-32", "member-33", "member-1"]);
    assert.equal(units[0].servedPositions[2].excuse.reason, "excusedDeparture");
    assert.equal(units[0].servedPositions.at(-1).cohortStartUserIds.length, 33);
    const prefix = {dates: overflow.map((shift) => shift.date), positions: overflow.flatMap((shift) => shift.rotationPositions),
      rotationBeforePrefix: market.cursorAtTargetBoundary, lineageRevision: data.value.liveResult.bundleRevision,
      lineageDigest: data.value.liveResult.bundleDigest};
    const before = await capture(db);
    const sources = await db.runTransaction(async (transaction) => {
      const rotations = await transaction.getAll(db.doc(`${root}/shiftRotations/delivery`), db.doc(`${root}/shiftRotations/market`));
      return captureShiftCreditPublicationSources({firestore: db, transaction,
        rotations: {delivery: rotations[0].data(), market: rotations[1].data()}, prefixes: {delivery: null, market: prefix}});
    });
    assert.deepEqual(sources.market.inheritedUnits, units.map((unit) => unit.servedPositions));
    assert.ok(sources.membership.publishedOwnerPositionKeys.length > 0);
    assert.equal(sources.membership.publishedOwnerPositionKeys.includes(JSON.stringify(["market", 1, 34, "member-34"])), false);
    const {planMarketShifts} = require("../lib/market-shift-planner.js");
    const next = planMarketShifts({planningRequestId: "next", targetSeasonStartYear: 2027,
      rotation: market.nextRotation, inheritedTargetPrefix: prefix, provisionalCredits: sources.market});
    assert.ok(next.shifts.every((shift) => new Set(shift.assignedUserIds).size === 3));
    assert.deepEqual(await capture(db), before);
    await inverse(db, data);
    assert.deepEqual((await db.doc(`${root}/shiftRotations/market`).get()).data().cursor.cohortUserIds,
      data.snapshot.rotations.market.cursor.cohortUserIds);
  }));

test("publication does not add a new round solely to acknowledge admission; each type retains its pending frontier",
  {skip: !emulatorAvailable}, () => withDatabase(async (db) => {
    const data = setupLargeFrozen(false); await seed(db, data);
    assert.equal(data.value.liveResult.market.creditProjection.membershipApplied, false);
    assert.equal(data.value.liveResult.market.shifts.length, 11);
    assert.equal(data.value.liveResult.market.nextRotation.nextMemberIndex, 0);
    await forward(db, data);
    const state = (await db.doc(`${root}/shiftMembershipState/member-35`).get()).data();
    assert.deepEqual(state.value.pendingTypes, {delivery: false, market: true});
    assert.deepEqual(state.value.admissionRequired, {delivery: false, market: true});
    assert.equal(state.value.pendingQueueTransition, true);
    const {planShiftMembershipAdmission} = require("../lib/shift-membership-planning.js");
    const source = structuredClone(data.publication.sources.membership); source.records[0].data = state;
    const next = planShiftMembershipAdmission({source, roster: data.snapshot.roster,
      rotations: {delivery: data.value.liveResult.delivery.nextRotation, market: data.value.liveResult.market.nextRotation},
      frozenThroughRound: {delivery: 2, market: 1}});
    assert.equal(next.policies.delivery, undefined); assert.equal(next.cohorts.market.at(-1), "member-35");
    await inverse(db, data);
    assert.deepEqual((await db.doc(`${root}/shiftMembershipState/member-35`).get()).data().value.pendingTypes,
      {delivery: true, market: true});
  }));
