"use strict";
const assert = require("node:assert/strict");
const {test, before, beforeEach, after} = require("node:test");
const {Timestamp} = require("@google-cloud/firestore");
const {createProvisionalCreditFirestore} = require("../lib/shift-credit-publication.js");
const {createDeliverySpacingAdministration, captureDeliverySpacingSource} = require("../lib/shift-delivery-spacing-store.js");
const {deliverySpacingAuthorityDigest} = require("../lib/shift-delivery-spacing.js");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {fixture, fairnessSnapshot, materializerInput} = require("./shift-planning-activation-fixture.cjs");
const {applyShiftPlanningForwardActivationAttempt: applyForward} = require("../lib/shift-planning-forward-materializer.js");
const {applyShiftPlanningInverseRecoveryAttempt: applyInverse} = require("../lib/shift-planning-inverse-materializer.js");
const {createFirestoreShiftPlanningInverseRecoveryResolver} = require("../lib/shift-planning-firestore-source-resolver.js");
const {refreshShiftPlanningLiveSource, loadCurrentShiftPlanningLiveSource,
  createGovernedShiftPlanningForwardActivationResolver} = require("../lib/shift-planning-firestore-source-producer.js");
const {buildShiftPlanningPublicShiftMaterialization, createShiftPlanningActivationOperationTerminal,
  attachShiftPlanningBackendMutationMarker} = require("../lib/shift-planning-publication-contract.js");

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const run = (name, fn) => test(name, {skip: !enabled}, fn);
const root = "develop/plus-collections";
const projectId = "demo-reguerta-hu084-coverage";
const version = "hu089-delivery-spacing-v1";
const publicId = (type, date) => `shift_${type}_${date.replaceAll("-", "")}`;
const historicalId = publicId("delivery", "2026-05-07");
const recentId = publicId("delivery", "2026-08-20");
const predecessorId = publicId("delivery", "2026-08-27");
let db, administration, now, base;
const ref = (collection, id) => db.doc(`${root}/${collection}/${id}`);
const read = async (collection, id) => (await ref(collection, id).get()).data();
const command = (extra = {}) => ({schemaVersion: 1, environment: "develop",
  operationId: "force-majeure-operation", planningRequestId: "foreign-request", userId: "member-2",
  previousDate: "2026-09-03", previousRoundNumber: 1, date: "2026-11-05", roundNumber: 2,
  reason: "Avoid an unstaffed ordinary delivery", ...extra});
const capture = async () => {
  // Every possible writer collection plus the fixture's sole nested collection.
  const collections = await db.doc(root).listCollections();
  const result = await Promise.all(collections.sort((a, b) => a.id.localeCompare(b.id)).map(async (collection) => {
    const docs = (await collection.orderBy("__name__").get()).docs;
    return [collection.id, await Promise.all(docs.map(async (doc) => [doc.id, doc.data(),
      collection.id === "shiftPlanningCandidates" ? (await doc.ref.collection("positions")
        .orderBy("__name__").get()).docs.map((position) => [position.id, position.data()]) : []]))];
  }));
  return result;
};
const rejectWithoutWrites = async (action, code) => {
  const before = await capture();
  await assert.rejects(action, code ? {code} : undefined);
  assert.deepEqual(await capture(), before);
};
const authority = async () => deliverySpacingAuthorityDigest(await read("shiftPlanningState", "current"),
  await read("shiftRotations", "delivery"));
const spacingSource = async (authorityDigest) => db.runTransaction((transaction) => captureDeliverySpacingSource({
  firestore: db, transaction, authorityDigest}));

const expandedSnapshot = () => {
  const snapshot = fairnessSnapshot();
  const priorRoster = snapshot.roster;
  const ids = Array.from({length: 10}, (_, index) => `member-${index + 1}`);
  snapshot.roster = ids.map((userId, index) => ({...priorRoster[index % priorRoster.length], userId,
    roles: index === 0 ? ["admin", "member"] : ["member"], membershipRevision: index + 1,
    eligibilityRevision: index + 20, destinationRevision: index + 40}));
  for (const type of ["delivery", "market"]) snapshot.rotations[type].cursor.cohortUserIds = ids;
  snapshot.membership = {revision: "ten-member-membership", digest: digest(snapshot.roster), memberCount: 10};
  snapshot.creditLedger.digest = digest({credits: "disabled-v1"});
  return snapshot;
};
const seedBase = async () => {
  now = Date.parse("2026-06-01T00:00:00Z");
  const snapshot = expandedSnapshot();
  base = {snapshot, value: fixture(snapshot)};
  base.input = materializerInput(base.value);
  const batch = db.batch();
  for (const doc of base.input.beforeImageDocuments) batch.set(db.doc(doc.targetPath), doc.data);
  for (const member of snapshot.roster) batch.set(ref("users", member.userId), member);
  await batch.commit();
};
const reset = async () => {
  await db.recursiveDelete(db.doc(root));
  await seedBase();
};
const publicShift = ({type = "delivery", date = "2026-05-07",
  owner = "member-2", assigned = owner, round = 1, helper = "member-3"} = {}) => {
  const id = publicId(type, date);
  const owners = type === "delivery" ? [owner] : [owner, "member-4", "member-5"];
  const assignees = type === "delivery" ? [assigned] : [assigned, "member-4", "member-5"];
  const attemptedAt = Timestamp.fromMillis(now - 1000);
  const materialization = buildShiftPlanningPublicShiftMaterialization({environment: "develop", attemptedAt,
    position: {schemaVersion: 1, positionId: id, shiftId: id, type, scheduledDate: date,
      candidateId: "historical-candidate", projectionSeasonStartYear: Number(date.slice(0, 4)) -
        (Number(date.slice(5, 7)) < 9 ? 1 : 0), rotationOwnerUserIds: owners, assignedUserIds: assignees,
      rotationPositions: owners.map((userId, index) => ({rotationOwnerUserId: userId,
        effectiveAssigneeUserId: assignees[index], roundNumber: round, positionInRound: index + 1,
        planningReason: "target"})), helperUserId: type === "delivery" ? helper : null,
      source: "app", origin: "planner", planningRequestId: "historical-planning",
      bundleRevision: "historical-bundle", bundleDigest: base.snapshot.activeDigest, writeEpoch: 6}});
  const operation = createShiftPlanningActivationOperationTerminal({operationId: "historical-activation",
    environment: "develop", requestId: "historical-planning", candidateId: "historical-candidate",
    bundleRevision: "historical-bundle", bundleDigest: base.snapshot.activeDigest,
    forwardManifestDigest: digest("historical-forward"), expectedStateDigest: digest("historical-before"),
    writeEpoch: 6, attemptedAt, publicMutations: [{mutationKind: "create", targetPath: materialization.targetPath,
      documentRevision: materialization.documentRevision, payloadDigest: materialization.payloadDigest}], beforeImages: []});
  return attachShiftPlanningBackendMutationMarker({materialization, operation});
};
const seedHistorical = async (extra = {}) => {
  const id = publicId(extra.type ?? "delivery", extra.date ?? "2026-05-07");
  await ref("shifts", id).set(publicShift(extra));
  return id;
};
const seedSourcePolicy = async (spacing = {version}, continuity = {kind: "newRotation"}) => {
  const snapshot = base.snapshot;
  const batch = db.batch();
  batch.set(ref("shiftPlanningState", "sourcePolicy"), {schemaVersion: 1, environment: "develop",
    policyRevision: "hu089-local-source", delivery: {continuity,
      inheritedTargetPrefix: null, futureProjectionOccupancy: []},
    market: {inheritedTargetPrefix: null, futureProjectionOccupancy: []},
    releaseLeaseDurationMillis: snapshot.config.releaseLeaseDurationMillis,
    creditLedger: snapshot.creditLedger, sync: snapshot.sync, transactionWriteLimit: 500,
    deliverySpacing: spacing});
  batch.set(ref("config", "global"), {otherConfig: {deliveryDayOfWeek: "THU"}});
  await batch.commit();
};
const prepare = async (actualException = false) => {
  await seedHistorical();
  let continuity = {kind: "newRotation"};
  let intent = command();
  if (actualException) {
    await ref("shiftRotations", "delivery").update({"cursor.roundNumber": 2, stateRevision: 5});
    await seedHistorical({date: "2026-08-20", owner: "member-1", helper: "member-10"});
    await seedHistorical({date: "2026-08-27", owner: "member-10", helper: "member-1"});
    continuity = {kind: "persistedAppend", predecessor: {shiftId: predecessorId,
      scheduledDate: "2026-08-27", effectiveLeadUserId: "member-10", completion: {state: "uncompleted",
        assignmentRevision: 1, completionRevision: 0, plannedHelperUserId: "member-1"}}};
    intent = command({planningRequestId: "bundle-2026", userId: "member-1", previousDate: "2026-08-20",
      date: "2026-09-03"});
  }
  const approval = await administration.authorizeDeliverySpacingException(intent, "member-1");
  await seedSourcePolicy({version}, continuity);
  const {source} = await refreshShiftPlanningLiveSource({firestore: db, environment: "develop"});
  const value = fixture(source.inputs.fairnessSnapshot, {delivery: source.inputs.delivery, market: source.inputs.market});
  const input = materializerInput(value);
  const batch = db.batch();
  batch.set(db.doc(input.requestDocument.targetPath), input.requestDocument.data);
  for (const doc of input.beforeImageDocuments) batch.set(db.doc(doc.targetPath), doc.data);
  batch.set(ref("shiftPlanningBundles", value.preflight.bundle.bundleRevision), value.preflight.bundle);
  const candidate = ref("shiftPlanningCandidates", value.preflight.candidate.bundleId);
  batch.set(candidate, value.preflight.candidate);
  for (const position of value.preflight.positions) batch.set(candidate.collection("positions")
    .doc(position.position.positionId), position);
  await batch.commit();
  return {value, input, approval: approval.result, source};
};
const readDocument = (doc) => ({targetPath: doc.ref.path, data: doc.data(), updateTime: doc.updateTime});
const forward = (data) => db.runTransaction(async (transaction) => {
  const docs = await transaction.getAll(db.doc(data.input.requestDocument.targetPath),
    ...data.input.beforeImageDocuments.map((doc) => db.doc(doc.targetPath)));
  return applyForward({...data.input, firestore: db, transaction, requestDocument: readDocument(docs[0]),
    beforeImageDocuments: docs.slice(1).map(readDocument)});
});
const governedForward = (data) => db.runTransaction(async (transaction) => {
  const resolver = createGovernedShiftPlanningForwardActivationResolver({environment: "develop",
    requestId: data.value.preflight.request.requestId});
  const resolved = await resolver({firestore: db, transaction});
  return applyForward({...data.input, ...resolved, firestore: db, transaction});
});
const inverse = (data) => db.runTransaction(async (transaction) => {
  const resolver = createFirestoreShiftPlanningInverseRecoveryResolver({environment: "develop",
    activationOperationId: data.input.operationId});
  const resolved = await resolver({firestore: db, transaction});
  return applyInverse({...resolved, firestore: db, transaction, recoveryOperationId: "recover-spacing",
    recoveredAt: Timestamp.fromMillis(data.input.attemptedAt.toMillis() + 1000)});
});

before(() => {
  if (!enabled) return;
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8798");
  assert.equal(process.env.GCLOUD_PROJECT, projectId);
  db = createProvisionalCreditFirestore();
  administration = createDeliverySpacingAdministration(db, () => now);
});
beforeEach(async () => { if (enabled) await reset(); });
after(async () => { if (db) await db.terminate(); });

run("closed-maintenance force-majeure authorization changes only its immutable approval and actor-bound receipt", async () => {
  assert.equal((await read("shiftPlanningState", "current")).maintenanceStatus, "closed");
  const before = await capture();
  const intent = command({reason: "  Avoid an unstaffed ordinary delivery  "});
  const approved = await administration.authorizeDeliverySpacingException(intent, "member-1");
  assert.equal(approved.replayed, false);
  assert.equal(approved.result.reason, "Avoid an unstaffed ordinary delivery");
  assert.equal(approved.result.approvedByUserId, "member-1");
  assert.equal(approved.result.approvedAtMillis, now);
  assert.equal(approved.result.authorityDigest, await authority());
  const afterApproval = await capture();
  assert.deepEqual(afterApproval.filter(([collection]) => !collection.startsWith("shiftDeliverySpacing")), before);
  assert.equal((await db.collection(`${root}/shiftDeliverySpacingExceptions`).get()).size, 1);
  assert.equal((await db.collection(`${root}/shiftDeliverySpacingOperations`).get()).size, 1);
  now += 1000;
  assert.deepEqual(await administration.authorizeDeliverySpacingException(intent, "member-1"), {...approved, replayed: true});
  assert.deepEqual(await capture(), afterApproval);
  await ref("users", "other-admin").set({isActive: true, roles: ["admin", "member"], isCommonPurchaseManager: false});
  await rejectWithoutWrites(() => administration.authorizeDeliverySpacingException(intent, "other-admin"),
    "delivery_spacing_operation_conflict");
  await rejectWithoutWrites(() => administration.authorizeDeliverySpacingException({...intent, reason: "Other reason"}, "member-1"),
    "delivery_spacing_operation_conflict");
});

run("invalid, unnecessary, duplicate and ineligible exception commands reject without public or audit writes", async () => {
  await rejectWithoutWrites(() => administration.authorizeDeliverySpacingException(command(), "member-2"), "coverage_actor_forbidden");
  for (const extra of [{reason: " "}, {approvedByUserId: "member-1"}, {environment: "production"}, {roundNumber: 1}]) {
    await rejectWithoutWrites(() => administration.authorizeDeliverySpacingException(command(extra), "member-1"),
      "invalid_delivery_spacing_command");
  }
  await rejectWithoutWrites(() => administration.authorizeDeliverySpacingException(command({date: "2026-11-12"}), "member-1"),
    "delivery_spacing_exception_not_required");
  now = Date.parse("2026-11-05T00:00:00Z");
  await rejectWithoutWrites(() => administration.authorizeDeliverySpacingException(command(), "member-1"), "delivery_spacing_date_unavailable");
  now = Date.parse("2026-06-01T00:00:00Z");
  await ref("users", "member-2").update({isActive: false});
  await rejectWithoutWrites(() => administration.authorizeDeliverySpacingException(command(), "member-1"), "delivery_spacing_member_ineligible");
  await ref("users", "member-2").update({isActive: true});
  await administration.authorizeDeliverySpacingException(command(), "member-1");
  await rejectWithoutWrites(() => administration.authorizeDeliverySpacingException(command({operationId: "duplicate-pair"}), "member-1"),
    "delivery_spacing_pair_already_authorized");
  await ref("shiftRotations", "delivery").update({activeRevision: "another-active-revision"});
  await rejectWithoutWrites(() => administration.authorizeDeliverySpacingException(command({operationId: "changed-authority",
    planningRequestId: "another-request"}), "member-1"), "delivery_spacing_authority_changed");
});

run("ordinary history retains original owners while helpers, markets and effective coverage assignees are exempt", async () => {
  const dates = ["2026-05-07", "2026-05-14", "2026-05-21", "2026-05-28"];
  for (let index = 0; index < dates.length; index++) await seedHistorical({date: dates[index],
    assigned: `member-${index + 6}`, helper: "member-1"});
  await seedHistorical({type: "market", date: "2026-05-16", assigned: "member-6"});
  const authorityDigest = await authority();
  const before = await capture();
  const source = await spacingSource(authorityDigest);
  assert.deepEqual(source.history, dates.map((date) => ({shiftId: publicId("delivery", date), date,
    userId: "member-2", roundNumber: 1})));
  assert.deepEqual(source.exceptions, []);
  assert.deepEqual(await capture(), before);
  await seedHistorical({date: dates[0], assigned: "member-10", helper: "member-9"});
  assert.deepEqual(await spacingSource(authorityDigest), source);
});

run("capture rechecks administrator availability and excludes immutable approvals from an earlier authority", async () => {
  const approved = await administration.authorizeDeliverySpacingException(command(), "member-1");
  const authorityDigest = await authority();
  assert.deepEqual((await spacingSource(authorityDigest)).exceptions, [{...approved.result, authorized: true}]);
  await ref("users", "member-1").update({roles: ["member"]});
  assert.deepEqual((await spacingSource(authorityDigest)).exceptions, [{...approved.result, authorized: false}]);
  await ref("shiftPlanningState", "current").update({writeEpoch: 8});
  assert.deepEqual((await spacingSource(await authority())).exceptions, []);
  assert.deepEqual((await read("shiftDeliverySpacingExceptions", approved.result.id)).value, approved.result);
});

run("the governed source derives spacing evidence with credits disabled and rejects policy-supplied history", async () => {
  await seedHistorical();
  await seedSourcePolicy();
  const {source} = await refreshShiftPlanningLiveSource({firestore: db, environment: "develop"});
  assert.equal(source.inputs.fairnessSnapshot.creditLedger.enabled, false);
  assert.deepEqual(source.inputs.fairnessSnapshot.deliverySpacing, {version, authorityDigest: await authority(),
    history: [{shiftId: historicalId, date: "2026-05-07", userId: "member-2", roundNumber: 1}], exceptions: []});
  const before = await capture();
  assert.deepEqual(await loadCurrentShiftPlanningLiveSource({firestore: db, environment: "develop"}), source);
  assert.deepEqual(await capture(), before);
  await seedSourcePolicy({version, history: []});
  await rejectWithoutWrites(() => refreshShiftPlanningLiveSource({firestore: db, environment: "develop"}), "invalid_planning_transaction");
});

run("governed forward and inverse preserve historical documents and exclude only the exact validated new publication", async () => {
  const data = await prepare(true);
  const historical = await read("shifts", historicalId);
  const predecessor = await read("shifts", predecessorId);
  const recent = await read("shifts", recentId);
  assert.equal(data.value.liveResult.delivery.spacingEvidence.source.exceptions.length, 1);
  assert.deepEqual(data.value.liveResult.delivery.spacingEvidence.appliedExceptionIds, [data.approval.id]);
  assert.equal(data.value.liveResult.manifests.forward.creditPublication, undefined);
  const result = await governedForward(data);
  assert.equal(result.measurement.documentWriteCount, data.value.liveResult.budgets.forward.totalWrites);
  assert.deepEqual(await read("shifts", historicalId), historical);
  assert.equal((await db.collection(`${root}/shifts`).get()).size,
    3 + data.value.liveResult.delivery.shifts.length + data.value.liveResult.market.shifts.length);
  const ownId = data.value.preflight.positions.find((row) => row.position.type === "delivery").position.shiftId;
  const original = await read("shifts", ownId);
  await ref("shifts", ownId).update({assignedUserIds: ["member-10"]});
  await rejectWithoutWrites(() => inverse(data));
  await ref("shifts", ownId).set(original);
  const recovered = await inverse(data);
  assert.equal(recovered.measurement.documentWriteCount, data.value.liveResult.budgets.inverse.totalWrites);
  assert.equal((await db.collection(`${root}/shifts`).get()).size, 3);
  assert.deepEqual(await read("shifts", historicalId), historical);
  assert.deepEqual(await read("shifts", predecessorId), predecessor);
  assert.deepEqual(await read("shifts", recentId), recent);
  assert.deepEqual((await read("shiftDeliverySpacingExceptions", data.approval.id)).value, data.approval);
  assert.equal((await read("shiftPlanningState", "current")).writeEpoch, 9);
  await rejectWithoutWrites(() => inverse(data));
});

run("bundle authority and dated approval receipts cannot be forged into an otherwise valid source", async () => {
  const data = await prepare();
  const snapshot = structuredClone(data.source.inputs.fairnessSnapshot);
  snapshot.deliverySpacing.authorityDigest = digest("chosen-authority");
  assert.throws(() => fixture(snapshot), {code: "invalid_planning_state"});
  const value = {...data.approval, approvedAtMillis: Date.parse(`${data.approval.date}T00:00:00Z`)};
  await ref("shiftDeliverySpacingExceptions", value.id).set({value, digest: digest(value)});
  await rejectWithoutWrites(() => spacingSource(data.approval.authorityDigest), "invalid_delivery_spacing_source");
});

run("inverse can restore a near-limit complete history after its own sixty-row publication without exempting unrelated rows", async () => {
  for (let start = 0; start < 990; start += 450) {
    const batch = db.batch();
    for (let index = start; index < Math.min(start + 450, 990); index++) {
      const date = new Date(Date.UTC(2000, 0, 6 + 7 * index)).toISOString().slice(0, 10);
      const id = publicId("delivery", date);
      batch.set(ref("shifts", id), publicShift({date, owner: `member-${index % 10 + 1}`,
        helper: `member-${(index + 1) % 10 + 1}`}));
    }
    await batch.commit();
  }
  const data = await prepare();
  assert.equal(data.value.liveResult.delivery.spacingEvidence.source.history.length, 991);
  const historyBefore = (await db.collection(`${root}/shifts`).where("type", "==", "delivery")
    .orderBy("__name__").get()).docs.map((doc) => [doc.id, doc.data()]);
  await governedForward(data);
  assert.equal((await db.collection(`${root}/shifts`).where("type", "==", "delivery").get()).size, 1051);
  await seedHistorical({date: "2025-08-07", owner: "member-8"});
  await rejectWithoutWrites(() => inverse(data), "delivery_spacing_source_changed");
  await ref("shifts", publicId("delivery", "2025-08-07")).delete();
  await inverse(data);
  assert.deepEqual((await db.collection(`${root}/shifts`).where("type", "==", "delivery")
    .orderBy("__name__").get()).docs.map((doc) => [doc.id, doc.data()]), historyBefore);
});

for (const drift of ["date", "owner", "round", "newRow"]) {
  run(`complete ordinary-history CAS rejects ${drift} drift before publication and recovery`, async () => {
    for (const direction of ["forward", "inverse"]) {
      await reset();
      const data = await prepare();
      if (direction === "inverse") await governedForward(data);
      if (drift === "date") {
        // A valid date change also replaces its canonical public document ID.
        const batch = db.batch();
        batch.delete(ref("shifts", historicalId));
        batch.set(ref("shifts", publicId("delivery", "2026-05-14")), publicShift({date: "2026-05-14"}));
        await batch.commit();
      }
      if (drift === "owner") await seedHistorical({owner: "member-8"});
      if (drift === "round") await seedHistorical({round: 2});
      if (drift === "newRow") await seedHistorical({date: "2026-05-14", owner: "member-8"});
      await rejectWithoutWrites(() => direction === "forward" ? forward(data) : inverse(data), "delivery_spacing_source_changed");
      if (direction === "forward") await rejectWithoutWrites(() => governedForward(data), "fairness_input_drift");
    }
  });
}

for (const drift of ["approval", "administratorRole"]) {
  run(`complete exception authority CAS rejects ${drift} drift before publication and recovery`, async () => {
    for (const direction of ["forward", "inverse"]) {
      await reset();
      const data = await prepare();
      if (direction === "inverse") await governedForward(data);
      if (drift === "approval") {
        const value = {...data.approval, reason: "Changed approval reason"};
        await ref("shiftDeliverySpacingExceptions", value.id).set({value, digest: digest(value)});
      } else await ref("users", "member-1").update({roles: ["member"]});
      await rejectWithoutWrites(() => direction === "forward" ? forward(data) : inverse(data), "delivery_spacing_source_changed");
      if (direction === "forward") await rejectWithoutWrites(() => governedForward(data), "fairness_input_drift");
    }
  });
}
