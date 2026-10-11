"use strict";
const assert = require("node:assert/strict");
const {test, before, beforeEach, after} = require("node:test");
const {Firestore, Timestamp} = require("@google-cloud/firestore");
const {createProvisionalShiftCoverageStore} = require("../lib/shift-coverage-provisional-store.js");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {SHIFT_COVERAGE_POLICY_REVISION} = require("../lib/shift-coverage.js");
const {buildShiftPlanningPublicShiftMaterialization, createShiftPlanningActivationOperationTerminal,
  attachShiftPlanningBackendMutationMarker} = require("../lib/shift-planning-publication-contract.js");
const {initialTime, activeDigest} = require("./shift-coverage-fixture.cjs");

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const run = (name, fn) => test(name, {skip: !enabled}, fn);
const projectId = "demo-reguerta-hu084-coverage", root = "develop/plus-collections", day = 86_400_000;
let db, store, now, sequence;
const hash = (values) => digest(values).split(":").at(-1);
const ref = (collection, id) => db.doc(`${root}/${collection}/${id}`);
const read = async (collection, id) => (await ref(collection, id).get()).data();
const reserveFor = (type = "delivery", userId = "d") => read("shiftCoverageReserves", hash([type, userId]));
const claimFor = (type = "delivery", userId = "d") => read("shiftCoverageMemberClaims", hash([type, userId]));
const snapshot = async () => {
  const collections = await db.doc(root).listCollections();
  return Promise.all(collections.sort((a, b) => a.id.localeCompare(b.id)).map(async (collection) =>
    [collection.id, (await collection.orderBy("__name__").get()).docs.map((document) => [document.id, document.data()])]));
};
const membershipCommand = async (userId = "d", extra = {}) => ({schemaVersion: 1, environment: "develop", userId,
  operationId: `lifecycle-${++sequence}`, expectedRevision: (await read("shiftMembershipState", userId))?.value.revision ?? 0,
  ...extra});
const reconcile = async (userId = "d", extra = {}) => store.reconcileMembership(await membershipCommand(userId, extra), "admin");
const rejectMembershipWithoutWrites = async (input, code, actor = "admin") => {
  const prior = await snapshot();
  await assert.rejects(store.reconcileMembership(input, actor), {code});
  assert.deepEqual(await snapshot(), prior);
};

// Public documents are built through the real publication contract. A later
// ordinary owner and its effective replacement remain distinct source evidence.
const seedShift = async (type, date, owners, round = 1, assigned = owners, helper = null) => {
  const id = `shift_${type}_${date.replaceAll("-", "")}`;
  const materialization = buildShiftPlanningPublicShiftMaterialization({environment: "develop",
    attemptedAt: Timestamp.fromMillis(initialTime - 1000), position: {schemaVersion: 1,
      positionId: id, shiftId: id, type, scheduledDate: date, candidateId: "candidate",
      projectionSeasonStartYear: Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 9 ? 1 : 0),
      rotationOwnerUserIds: owners, assignedUserIds: assigned,
      rotationPositions: owners.map((userId, index) => ({rotationOwnerUserId: userId,
        effectiveAssigneeUserId: assigned[index], roundNumber: round, positionInRound: index + 1, planningReason: "target"})),
      helperUserId: helper, source: "app", origin: "planner", planningRequestId: "initial",
      bundleRevision: "active-1", bundleDigest: activeDigest, writeEpoch: 1}});
  const operation = createShiftPlanningActivationOperationTerminal({operationId: "initial", environment: "develop",
    requestId: "initial", candidateId: "candidate", bundleRevision: "active-1", bundleDigest: activeDigest,
    forwardManifestDigest: digest("forward"), expectedStateDigest: digest("before"), writeEpoch: 1,
    attemptedAt: Timestamp.fromMillis(initialTime - 1000), publicMutations: [{mutationKind: "create",
      targetPath: materialization.targetPath, documentRevision: materialization.documentRevision,
      payloadDigest: materialization.payloadDigest}], beforeImages: []});
  await ref("shifts", id).set(attachShiftPlanningBackendMutationMarker({materialization, operation}));
  return id;
};
const seedCredit = async (id, type = "delivery", userId = "d", state = "pending") => {
  const credit = {schemaVersion: 1, policyRevision: SHIFT_COVERAGE_POLICY_REVISION, id, caseId: id,
    shiftId: `historical-${id}`, type, userId, earnedAtMillis: now - 1000, completionRevision: 1, state,
    ...(state === "consumed" ? {consumedByPlanId: "old-plan", consumedAtMillis: now - 500} : {})};
  await ref("shiftCoverageCredits", id).set(credit);
  if (state === "pending") {
    await ref("shiftCoverageMemberClaims", hash([type, userId])).set({caseId: id, type, userId, state: "creditPending"});
  }
  return credit;
};
const coverageCommand = async (caseId, action, extra = {}) => {
  const value = (await read("shiftCoverageCases", caseId))?.value;
  const shift = await read("shifts", extra.shiftId ?? value.shiftId);
  return {schemaVersion: 1, environment: "develop", action, caseId, operationId: `coverage-${++sequence}`,
    expectedRevision: value?.revision ?? 0, expectedShiftRevision: shift.documentRevision, ...extra};
};
const coverage = async (caseId, action, actor = "admin", extra = {}) => store.execute(await coverageCommand(caseId, action, extra), actor);
const acceptMarketCoverage = async () => {
  await reconcile();
  const shiftId = await seedShift("market", "2027-09-04", ["a", "b", "c"]);
  await coverage("covered", "open", "a", {shiftId, absentUserId: "a", reason: "Unavailable"});
  await coverage("covered", "startSelection");
  const offered = await coverage("covered", "offerNext", "admin", {expiresAtMillis: now + 1000});
  assert.equal(offered.case.offer.userId, "d");
  await coverage("covered", "accept", "d");
  return shiftId;
};

before(() => {
  if (!enabled) return;
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8798");
  assert.equal(process.env.GCLOUD_PROJECT, projectId);
  db = new Firestore({projectId, host: "127.0.0.1:8798", ssl: false});
  store = createProvisionalShiftCoverageStore({nowMillis: () => now, maximumOfferWindowMillis: 7 * day,
    selectionPolicy: {version: "hu089-provisional-v1"}});
});
after(async () => { if (store) await store.close(); if (db) await db.terminate(); });
beforeEach(async () => {
  if (!enabled) return;
  assert.equal((await fetch(`http://127.0.0.1:8798/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    {method: "DELETE"})).ok, true);
  now = initialTime; sequence = 0;
  await ref("shiftPlanningState", "current").set({schemaVersion: 1, stateRevision: 1, writeEpoch: 1,
    maintenanceStatus: "open", activeRevision: "active-1", activeDigest, intakeBarrier: null, lastTransitionId: "initial"});
  for (const id of ["a", "b", "c", "d", "e", "admin"]) {
    await ref("users", id).set({isActive: true, roles: id === "admin" ? ["admin", "member"] : ["member"],
      isCommonPurchaseManager: false});
  }
  for (const type of ["delivery", "market"]) {
    await ref("shiftRotations", type).set({schemaVersion: 1, type, stateRevision: 4,
      cursor: {schemaVersion: 1, type, cohortUserIds: ["a", "b", "c"], roundNumber: 1, nextMemberIndex: 1},
      planningFrontierSeasonStartYear: 2027, cohortFrozen: true, frozenCohortUserIds: ["a", "b", "c"],
      activeRevision: "active-1", activeDigest, lastIdempotencyKey: null, migrationBaseline: null, releaseLease: null});
  }
});

run("reserve exit is due-time bound, preserves admission evidence and follows ordinary owner independently by type", async () => {
  await reconcile();
  const entry = await reserveFor();
  assert.equal(entry.admissionAfterRound, 1);
  const deliveryId = await seedShift("delivery", "2027-09-01", ["d"], 2, ["e"], "b");
  await seedShift("market", "2027-09-04", ["d", "b", "c"], 2, ["e", "b", "c"]);
  for (const type of ["delivery", "market"]) await ref("shiftRotations", type).update({
    "cursor.cohortUserIds": ["a", "b", "c", "d"], "cursor.roundNumber": 2,
    "cursor.nextMemberIndex": 0, cohortFrozen: false, frozenCohortUserIds: []});
  now = Date.parse("2027-09-01T00:00:00Z") - 1;
  await reconcile();
  assert.deepEqual(await reserveFor(), entry);
  assert.equal((await reserveFor("market")).active, true);
  const shifts = (await snapshot()).find(([collection]) => collection === "shifts");
  now += 1;
  await reconcile();
  assert.equal((await reserveFor()).active, false);
  assert.equal((await reserveFor()).revision, 2);
  assert.equal((await reserveFor()).admissionAfterRound, 1);
  assert.equal((await reserveFor("market")).active, true);
  assert.deepEqual((await read("shifts", deliveryId)).assignedUserIds, ["e"]);
  assert.deepEqual((await snapshot()).find(([collection]) => collection === "shifts"), shifts);
  now = Date.parse("2027-09-04T00:00:00Z");
  await reconcile();
  assert.equal((await reserveFor("market")).active, false);
  assert.equal((await reserveFor("market")).revision, 2);
});

run("cohort inclusion, helper work, coverage substitution and older frozen owner positions do not end reserve", async () => {
  await reconcile();
  const entries = [await reserveFor(), await reserveFor("market")];
  await seedShift("delivery", "2027-08-20", ["d"], 2, ["e"], "b");
  await seedShift("delivery", "2027-09-01", ["b"], 2, ["b"], "d");
  await seedShift("delivery", "2027-09-08", ["d"], 1, ["e"], "c");
  await seedShift("market", "2027-09-04", ["a", "b", "c"], 2, ["d", "b", "c"]);
  for (const type of ["delivery", "market"]) await ref("shiftRotations", type).update({
    "cursor.cohortUserIds": ["a", "b", "c", "d"], "cursor.roundNumber": 3,
    "cursor.nextMemberIndex": 0, cohortFrozen: false, frozenCohortUserIds: []});
  now = Date.parse("2027-09-10T00:00:00Z");
  await reconcile();
  assert.deepEqual([await reserveFor(), await reserveFor("market")], entries);
});

run("re-entry starts a new reserve epoch and cannot exit through positions frozen before it", async () => {
  await reconcile();
  await seedShift("delivery", "2027-09-01", ["d"], 2, ["e"], "b");
  now += 1000;
  await ref("users", "d").update({isActive: false}); await reconcile();
  now += 1000;
  await ref("users", "d").update({isActive: true}); await reconcile();
  const reentry = await reserveFor();
  assert.equal(reentry.admissionAfterRound, 2);
  assert.equal(reentry.enteredAtMillis, now);
  now = Date.parse("2027-09-01T00:00:00Z"); await reconcile();
  assert.deepEqual(await reserveFor(), reentry);
  await seedShift("delivery", "2027-09-08", ["d"], 3, ["e"], "c");
  now = Date.parse("2027-09-08T00:00:00Z"); await reconcile();
  assert.equal((await reserveFor()).active, false);
  assert.equal((await reserveFor("market")).active, true);
});

run("amended reconciliation refuses legacy active reserves without an admission floor and never guesses it", async () => {
  await reconcile();
  const entry = await reserveFor(); delete entry.admissionAfterRound;
  await ref("shiftCoverageReserves", hash(["delivery", "d"])).set(entry);
  await rejectMembershipWithoutWrites(await membershipCommand(), "membership_reserve_admission_evidence_required");
});

run("temporary inactivity and later re-entry retain pending and consumed credit history and claims", async () => {
  await reconcile();
  const pending = await seedCredit("earned-delivery"), consumed = await seedCredit("consumed-delivery", "delivery", "d", "consumed");
  await ref("shiftCoverageLedgerState", "delivery").set({revision: 5});
  const claim = await claimFor();
  now += 1000; await ref("users", "d").update({isActive: false});
  const departed = await reconcile();
  assert.equal(departed.result.state.permanentDeparture, undefined);
  assert.equal((await reserveFor()).active, false);
  now += 1000; await ref("users", "d").update({isActive: true}); await reconcile();
  assert.equal((await reserveFor()).active, true);
  assert.deepEqual(await read("shiftCoverageCredits", pending.id), pending);
  assert.deepEqual(await read("shiftCoverageCredits", consumed.id), consumed);
  assert.deepEqual(await claimFor(), claim);
  assert.deepEqual(await read("shiftCoverageLedgerState", "delivery"), {revision: 5});
});

run("explicit permanent departure cancels only own pending balances, releases claims, increments each ledger once and cannot resurrect", async () => {
  await reconcile();
  const delivery = await seedCredit("earned-delivery"), market = await seedCredit("earned-market", "market");
  const consumed = await seedCredit("consumed-delivery", "delivery", "d", "consumed"), other = await seedCredit("other-member", "market", "e");
  await ref("shiftCoverageLedgerState", "delivery").set({revision: 5});
  await ref("shiftCoverageLedgerState", "market").set({revision: 8});
  now += 1000; await ref("users", "d").update({isActive: false});
  const input = await membershipCommand("d", {permanentDepartureReason: "Confirmed permanent departure"});
  const result = await store.reconcileMembership(input, "admin");
  assert.deepEqual(result.result.state.permanentDeparture,
    {operationId: input.operationId, reason: input.permanentDepartureReason, atMillis: now});
  for (const beforeCredit of [delivery, market]) {
    assert.deepEqual(await read("shiftCoverageCredits", beforeCredit.id), {...beforeCredit, state: "cancelled",
      cancelledByMembershipOperationId: input.operationId, cancelledAtMillis: now});
    assert.deepEqual(await claimFor(beforeCredit.type), {type: beforeCredit.type, userId: "d", caseId: beforeCredit.id,
      state: "released", cancelledByMembershipOperationId: input.operationId, cancelledAtMillis: now});
  }
  assert.deepEqual(await read("shiftCoverageCredits", consumed.id), consumed);
  assert.deepEqual(await read("shiftCoverageCredits", other.id), other);
  assert.equal((await claimFor("market", "e")).state, "creditPending");
  assert.deepEqual(await read("shiftCoverageLedgerState", "delivery"), {revision: 6});
  assert.deepEqual(await read("shiftCoverageLedgerState", "market"), {revision: 9});
  const prior = await snapshot();
  assert.equal((await store.reconcileMembership(input, "admin")).replayed, true);
  assert.deepEqual(await snapshot(), prior);
  await reconcile();
  assert.deepEqual(await read("shiftCoverageLedgerState", "delivery"), {revision: 6});
  now += 1000; await ref("users", "d").update({isActive: true});
  const returned = await reconcile();
  assert.equal(returned.result.state.permanentDeparture, undefined);
  assert.equal((await reserveFor()).active, true);
  assert.equal((await read("shiftCoverageCredits", delivery.id)).state, "cancelled");
  assert.equal((await read("shiftCoverageCredits", market.id)).state, "cancelled");
  const shiftId = await seedShift("market", "2027-09-04", ["a", "b", "c"]);
  await coverage("after-return", "open", "a", {shiftId, absentUserId: "a", reason: "New absence"});
  await coverage("after-return", "startSelection");
  const next = await coverage("after-return", "offerNext", "admin", {expiresAtMillis: now + 1000});
  assert.equal(next.case.offer.userId, "d");
  await coverage("after-return", "accept", "d");
  assert.equal((await claimFor("market")).state, "accepted");
});

run("completion recorded after permanent departure retains earned history without creating a spendable credit", async () => {
  const shiftId = await acceptMarketCoverage();
  now += 1; await ref("users", "d").update({isActive: false});
  const input = await membershipCommand("d", {permanentDepartureReason: "Departure confirmed before completion"});
  await store.reconcileMembership(input, "admin");
  now = (await read("shifts", shiftId)).date.toMillis();
  const complete = await coverageCommand("covered", "complete");
  const result = await store.execute(complete, "admin");
  assert.equal(result.case.status, "completed");
  const credit = await read("shiftCoverageCredits", "covered");
  assert.equal(credit.state, "cancelled");
  assert.equal(credit.cancelledByMembershipOperationId, input.operationId);
  assert.ok(credit.cancelledAtMillis >= credit.earnedAtMillis);
  assert.equal((await claimFor("market")).state, "released");
  assert.deepEqual((await read("shifts", shiftId)).assignedUserIds, ["d", "b", "c"]);
  assert.deepEqual(await read("shiftCoverageLedgerState", "market"), {revision: 1});
  const prior = await snapshot();
  assert.equal((await store.execute(complete, "admin")).replayed, true);
  assert.deepEqual(await snapshot(), prior);
});

run("permanent departure requires an inactive or missing member, administrative authority and an exact reason-only intent", async () => {
  await reconcile();
  const input = await membershipCommand("d", {permanentDepartureReason: "Confirmed departure"});
  await rejectMembershipWithoutWrites(input, "membership_permanent_departure_requires_inactive");
  await ref("users", "d").update({isActive: false});
  await rejectMembershipWithoutWrites(input, "coverage_actor_forbidden", "a");
  for (const extra of [{cancelledCredits: ["chosen"]}, {permanentDeparture: {operationId: "chosen"}},
    {permanentDepartureReason: " "}, {permanentDepartureReason: "x".repeat(501)}]) {
    await rejectMembershipWithoutWrites({...input, ...extra}, "invalid_membership_command");
  }
  await ref("users", "d").delete();
  const result = await store.reconcileMembership(input, "admin");
  assert.equal(result.result.state.source, null);
  assert.equal(result.result.state.permanentDeparture.operationId, input.operationId);
  const changedActor = await ref("users", "e").get();
  await changedActor.ref.update({roles: ["member", "admin"]});
  await rejectMembershipWithoutWrites(input, "membership_operation_conflict", "e");
  await rejectMembershipWithoutWrites({...input, permanentDepartureReason: "Different reason"}, "membership_operation_conflict");
});

run("missing or forged claims, duplicate pending credits and invalid ledgers reject permanent cancellation atomically", async () => {
  await reconcile(); await seedCredit("earned");
  await ref("shiftCoverageLedgerState", "delivery").set({revision: 5});
  await ref("users", "d").update({isActive: false});
  const validClaim = await claimFor();
  const input = await membershipCommand("d", {permanentDepartureReason: "Confirmed departure"});
  await ref("shiftCoverageMemberClaims", hash(["delivery", "d"])).delete();
  await rejectMembershipWithoutWrites(input, "credit_claim_changed");
  await ref("shiftCoverageMemberClaims", hash(["delivery", "d"])).set({...validClaim, caseId: "another-case"});
  await rejectMembershipWithoutWrites(input, "credit_claim_changed");
  await ref("shiftCoverageMemberClaims", hash(["delivery", "d"])).set(validClaim);
  for (const revision of [0, -1, 1.5, Number.MAX_SAFE_INTEGER]) {
    await ref("shiftCoverageLedgerState", "delivery").set({revision});
    await rejectMembershipWithoutWrites(input, "invalid_coverage_ledger");
  }
  await ref("shiftCoverageLedgerState", "delivery").delete();
  await rejectMembershipWithoutWrites(input, "invalid_coverage_ledger");
  await ref("shiftCoverageLedgerState", "delivery").set({revision: 5});
  await seedCredit("duplicate");
  await rejectMembershipWithoutWrites(input, "duplicate_pending_coverage_credit");
  await ref("shiftCoverageCredits", "duplicate").delete();
  await ref("shiftCoverageMemberClaims", hash(["delivery", "d"])).set(validClaim);
  await ref("shiftCoverageCredits", "earned").update({earnedAtMillis: now + 1});
  await rejectMembershipWithoutWrites(input, "invalid_coverage_credit");
});

run("an orphan pending claim and an oversized member history reject without any reserve, credit or audit write", async () => {
  await reconcile(); await ref("users", "d").update({isActive: false});
  const input = await membershipCommand("d", {permanentDepartureReason: "Confirmed departure"});
  await ref("shiftCoverageMemberClaims", hash(["delivery", "d"])).set({caseId: "missing-credit", type: "delivery",
    userId: "d", state: "creditPending"});
  await rejectMembershipWithoutWrites(input, "credit_claim_changed");
  await ref("shiftCoverageMemberClaims", hash(["delivery", "d"])).delete();
  const batch = db.batch();
  for (let index = 0; index < 251; index++) {
    const id = `old-${index}`;
    batch.set(ref("shiftCoverageCredits", id), {schemaVersion: 1, policyRevision: SHIFT_COVERAGE_POLICY_REVISION,
      id, caseId: id, shiftId: `historical-${id}`, type: "market", userId: "d", earnedAtMillis: now - 1000,
      completionRevision: 1, state: "consumed", consumedByPlanId: "old-plan", consumedAtMillis: now - 500});
  }
  await batch.commit();
  await rejectMembershipWithoutWrites(input, "membership_source_limit");
});

run("concurrent explicit departures cancel once and leave one administrative receipt and one ledger increment", async () => {
  await reconcile(); await seedCredit("earned");
  await ref("shiftCoverageLedgerState", "delivery").set({revision: 5});
  await ref("users", "d").update({isActive: false});
  const inputs = await Promise.all([membershipCommand("d", {permanentDepartureReason: "First report"}),
    membershipCommand("d", {permanentDepartureReason: "Second report"})]);
  const beforeCount = (await db.collection(`${root}/shiftMembershipOperations`).get()).size;
  const results = await Promise.allSettled(inputs.map((input) => store.reconcileMembership(input, "admin")));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const loser = results.findIndex((result) => result.status === "rejected");
  if (results[loser].reason.code === 3) {
    // The Firestore emulator can close a contended retry; retry must still fail
    // against the authoritative revision, without a second cancellation.
    assert.match(results[loser].reason.message, /Transaction is invalid or closed/);
    await rejectMembershipWithoutWrites(inputs[loser], "membership_revision_conflict");
  } else assert.equal(results[loser].reason.code, "membership_revision_conflict");
  assert.equal((await db.collection(`${root}/shiftMembershipOperations`).get()).size, beforeCount + 1);
  assert.deepEqual(await read("shiftCoverageLedgerState", "delivery"), {revision: 6});
  const winner = inputs[results.findIndex((result) => result.status === "fulfilled")];
  assert.equal((await read("shiftCoverageCredits", "earned")).cancelledByMembershipOperationId, winner.operationId);
  assert.equal((await claimFor()).state, "released");
});

run("racing completion with permanent departure cannot leave a spendable credit regardless of commit order", async () => {
  const shiftId = await acceptMarketCoverage();
  now = (await read("shifts", shiftId)).date.toMillis();
  await ref("users", "d").update({isActive: false});
  const departure = await membershipCommand("d", {permanentDepartureReason: "Confirmed while completion was pending"});
  const complete = await coverageCommand("covered", "complete");
  const operations = [() => store.reconcileMembership(departure, "admin"), () => store.execute(complete, "admin")];
  const results = await Promise.allSettled(operations.map((operation) => operation()));
  for (const [index, result] of results.entries()) {
    if (result.status === "rejected") {
      assert.equal(result.reason.code, 3);
      assert.match(result.reason.message, /Transaction is invalid or closed/);
      await operations[index]();
    }
  }
  const credit = await read("shiftCoverageCredits", "covered");
  assert.equal(credit.state, "cancelled");
  assert.equal(credit.cancelledByMembershipOperationId, departure.operationId);
  assert.equal((await claimFor("market")).state, "released");
  assert.equal((await read("shiftCoverageCases", "covered")).value.status, "completed");
  assert.ok([1, 2].includes((await read("shiftCoverageLedgerState", "market")).revision));
  const prior = await snapshot();
  assert.equal((await store.reconcileMembership(departure, "admin")).replayed, true);
  assert.equal((await store.execute(complete, "admin")).replayed, true);
  assert.deepEqual(await snapshot(), prior);
});

run("read-only reserve projection and discovery stop at the due turn before an explicit reconciliation", async () => {
  now = Date.parse("2027-08-31T00:00:00Z"); await reconcile();
  now += 1; await reconcile("e");
  await ref("authLinks", "auth-d").set({memberId: "d"});
  await ref("users", "d").update({authUid: "auth-d"});
  await seedShift("market", "2027-09-01", ["d", "b", "c"], 2, ["e", "b", "c"]);
  const shiftId = await seedShift("market", "2027-09-30", ["a", "b", "c"]);
  await coverage("future", "open", "a", {shiftId, absentUserId: "a", reason: "Unavailable"});
  await coverage("future", "startSelection");
  now = Date.parse("2027-09-01T00:00:00Z");
  const prior = await snapshot();
  const result = await store.readClient({schemaVersion: 1, environment: "develop", action: "overview"}, {uid: "auth-d"});
  assert.equal(result.reserves.find((entry) => entry.type === "market").active, false);
  assert.equal(result.reserves.find((entry) => entry.type === "delivery").active, true);
  assert.deepEqual(await snapshot(), prior);
  assert.equal((await reserveFor("market")).active, true);
  const offered = await coverage("future", "offerNext", "admin", {expiresAtMillis: now + 1000});
  assert.equal(offered.case.offer.userId, "e");
  assert.equal((await reserveFor("market")).active, true);
});

run("acceptance rejects an otherwise unexpired reserve offer when the beneficiary's ordinary turn becomes due", async () => {
  now = Date.parse("2027-08-31T00:00:00Z"); await reconcile();
  await seedShift("market", "2027-09-01", ["d", "b", "c"], 2, ["e", "b", "c"]);
  const shiftId = await seedShift("market", "2027-09-30", ["a", "b", "c"]);
  await coverage("future", "open", "a", {shiftId, absentUserId: "a", reason: "Unavailable"});
  await coverage("future", "startSelection");
  const offered = await coverage("future", "offerNext", "admin", {expiresAtMillis: now + 2 * day});
  assert.equal(offered.case.offer.userId, "d");
  now = Date.parse("2027-09-01T00:00:00Z");
  assert.ok(now < offered.case.offer.expiresAtMillis);
  const prior = await snapshot();
  await assert.rejects(store.execute(await coverageCommand("future", "accept"), "d"), {code: "coverage_reserve_changed"});
  assert.deepEqual(await snapshot(), prior);
  assert.equal((await reserveFor("market")).active, true);
});

run("completion cannot outrun a later recorded permanent-departure observation by moving the clock backwards", async () => {
  const shiftId = await acceptMarketCoverage();
  const due = (await read("shifts", shiftId)).date.toMillis();
  now = due + day; await ref("users", "d").update({isActive: false});
  await reconcile("d", {permanentDepartureReason: "Confirmed departure"});
  now = due;
  const prior = await snapshot();
  await assert.rejects(store.execute(await coverageCommand("covered", "complete"), "admin"), {code: "invalid_coverage_clock"});
  assert.deepEqual(await snapshot(), prior);
});
