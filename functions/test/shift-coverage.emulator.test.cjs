"use strict";
const assert = require("node:assert/strict");
const {test, before, beforeEach, after} = require("node:test");
const {Firestore, Timestamp} = require("@google-cloud/firestore");
const {createProvisionalShiftCoverageStore} = require("../lib/shift-coverage-provisional-store.js");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {buildShiftPlanningPublicShiftMaterialization, createShiftPlanningActivationOperationTerminal,
  attachShiftPlanningBackendMutationMarker} = require("../lib/shift-planning-publication-contract.js");

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const run = (name, fn) => test(name, {skip: !enabled}, fn);
const root = "develop/plus-collections", projectId = "demo-reguerta-hu084-coverage";
const initialTime = Date.parse("2027-08-25T00:00:00Z");
const activeDigest = digest({fixture: "coverage"});
let db, store, now, sequence;
const ref = (collection, id) => db.doc(`${root}/${collection}/${id}`);
const read = async (collection, id) => (await ref(collection, id).get()).data();
const member = (roles = ["member"], isCommonPurchaseManager = false) =>
  ({roles, isCommonPurchaseManager, isActive: true});
const materialize = (id, type, date, assigned, helper = null) => {
  const item = buildShiftPlanningPublicShiftMaterialization({environment: "develop",
    attemptedAt: Timestamp.fromMillis(initialTime - 1_000_000), position: {
      schemaVersion: 1, positionId: id, shiftId: id, type, scheduledDate: date,
      candidateId: "candidate", projectionSeasonStartYear: Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 9 ? 1 : 0),
      rotationOwnerUserIds: assigned, assignedUserIds: assigned,
      rotationPositions: assigned.map((uid, i) => ({rotationOwnerUserId: uid,
        effectiveAssigneeUserId: uid, roundNumber: 1, positionInRound: i + 1, planningReason: "target"})),
      helperUserId: helper, source: "app", origin: "planner", planningRequestId: "initial",
      bundleRevision: "active-1", bundleDigest: activeDigest, writeEpoch: 1,
    }});
  const operation = createShiftPlanningActivationOperationTerminal({operationId: "initial",
    environment: "develop", requestId: "initial", candidateId: "candidate", bundleRevision: "active-1",
    bundleDigest: activeDigest, forwardManifestDigest: digest("forward"), expectedStateDigest: digest("before"),
    writeEpoch: 1, attemptedAt: Timestamp.fromMillis(initialTime - 1_000_000),
    publicMutations: [{mutationKind: "create", targetPath: item.targetPath,
      documentRevision: item.documentRevision, payloadDigest: item.payloadDigest}], beforeImages: []});
  return attachShiftPlanningBackendMutationMarker({materialization: item, operation});
};
const snapshot = async () => {
  const output = {};
  for (const collection of ["shifts", "users", "shiftCoverageCases", "shiftCoverageCredits",
    "shiftCoverageSlots", "shiftCoverageReserves", "shiftCoverageMemberClaims", "shiftCoverageOperations", "shiftCoverageLedgerState"]) {
    output[collection] = (await db.collection(`${root}/${collection}`).get()).docs.map((d) => [d.id, d.data()]);
  }
  return output;
};
const makeCommand = async (caseId, action, extra = {}) => {
  const state = (await read("shiftCoverageCases", caseId))?.value;
  const shiftId = action === "open" ? extra.shiftId : state.shiftId;
  const shift = await read("shifts", shiftId);
  return {schemaVersion: 1, environment: "develop", caseId, operationId: `op-${++sequence}`,
    expectedRevision: state?.revision ?? 0, expectedShiftRevision: shift.documentRevision,
    action, ...extra};
};
const execute = async (caseId, action, actor, extra) =>
  store.execute(await makeCommand(caseId, action, extra), actor);
const open = (caseId = "case-1", shiftId = "shift_delivery_20270901", absentUserId = "a") =>
  execute(caseId, "open", absentUserId, {shiftId, absentUserId, reason: "Unavailable"});
const offer = (caseId = "case-1", userId = "d") => execute(caseId, "offer", "admin",
  {userId, reason: "Explicit administrative arrangement", expiresAtMillis: now + 10_000});
const rejectWithoutWrites = async (command, actor, code) => {
  const before = await snapshot();
  await assert.rejects(store.execute(command, actor), code ? {code} : undefined);
  assert.deepEqual(await snapshot(), before);
};

before(() => {
  if (!enabled) return;
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8798");
  assert.equal(process.env.GCLOUD_PROJECT, projectId);
  db = new Firestore({projectId, host: "127.0.0.1:8798", ssl: false});
  store = createProvisionalShiftCoverageStore({nowMillis: () => now, maximumOfferWindowMillis: 60_000,
    selectionPolicy: {version: "fifo-signup-v1", volunteerWindowMillis: 1000}});
});
after(async () => { if (store) await store.close(); if (db) await db.terminate(); });
beforeEach(async () => {
  if (!enabled) return;
  assert.equal((await fetch(`http://127.0.0.1:8798/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    {method: "DELETE"})).ok, true);
  now = initialTime; sequence = 0;
  await ref("shiftPlanningState", "current").set({schemaVersion: 1, stateRevision: 1, writeEpoch: 1,
    maintenanceStatus: "open", activeRevision: "active-1", activeDigest, intakeBarrier: null, lastTransitionId: "initial"});
  for (const id of ["a", "b", "c", "d", "e", "f", "admin"]) {
    await ref("users", id).set(member(id === "admin" ? ["admin", "member"] : ["member"]));
  }
  await ref("shifts", "shift_delivery_20270825").set(materialize("shift_delivery_20270825", "delivery", "2027-08-25", ["b"], "a"));
  await ref("shifts", "shift_delivery_20270901").set(materialize("shift_delivery_20270901", "delivery", "2027-09-01", ["a"], "c"));
  await ref("shifts", "shift_delivery_20270908").set(materialize("shift_delivery_20270908", "delivery", "2027-09-08", ["c"], "e"));
  await ref("shifts", "shift_market_20270904").set(materialize("shift_market_20270904", "market", "2027-09-04", ["a", "b", "c"]));
  await ref("shifts", "shift_market_20270911").set(materialize("shift_market_20270911", "market", "2027-09-11", ["a", "b", "c"]));
});

run("delivery acceptance updates only effective assignment and prospective helper; completion earns one credit", async () => {
  const original = await snapshot();
  await open(); await offer();
  assert.equal((await db.collection(`${root}/shiftCoverageCredits`).get()).size, 0);
  const command = await makeCommand("case-1", "accept");
  const accepted = await store.execute(command, "d");
  assert.equal(accepted.case.status, "accepted");
  assert.equal((await read("shifts", "shift_delivery_20270825")).helperUserId, "d");
  const current = await read("shifts", "shift_delivery_20270901");
  assert.deepEqual(current.assignedUserIds, ["d"]);
  assert.equal(current.rotationOwnerUserId, "a");
  assert.equal(current.assignmentRevision, 2);
  assert.deepEqual(await read("shifts", "shift_delivery_20270908"), original.shifts.find(([id]) => id === "shift_delivery_20270908")[1]);
  const after = await snapshot();
  assert.equal((await store.execute(command, "d")).replayed, true);
  assert.deepEqual(await snapshot(), after);
  await rejectWithoutWrites(await makeCommand("case-1", "complete"), "admin", "coverage_completion_conflict");
  now = current.date.toMillis() + 1000;
  const complete = await makeCommand("case-1", "complete");
  await store.execute(complete, "admin");
  assert.equal((await store.execute(complete, "admin")).replayed, true);
  assert.equal((await read("shiftCoverageCredits", "case-1")).userId, "d");
  assert.equal((await read("shiftCoverageLedgerState", "delivery")).revision, 1);
  assert.equal((await read("shifts", "shift_delivery_20270901")).completion.actualHelperUserId, "c");
  assert.deepEqual((await snapshot()).users, original.users);
});

run("completed predecessor helper history is not rewritten by later coverage", async () => {
  await ref("shifts", "shift_delivery_20270825").update({documentRevision: 2, updatedAt: Timestamp.fromMillis(now), completion: {state: "completed", revision: 1,
    actualHelperUserId: "a", helperSourceAssignmentRevision: 1, completedAt: Timestamp.fromMillis(now)}});
  const old = await read("shifts", "shift_delivery_20270825");
  await open(); await offer(); await execute("case-1", "accept", "d");
  assert.deepEqual(await read("shifts", "shift_delivery_20270825"), old);
});

run("eligibility drift, self-cover and both adjacent leads reject without partial writes", async () => {
  await open();
  for (const userId of ["a", "b", "c"]) {
    await rejectWithoutWrites(await makeCommand("case-1", "offer", {userId, reason: "Test", expiresAtMillis: now + 1000}), "admin");
  }
  await ref("users", "d").set(member(["member", "producer"], true));
  await offer();
  await ref("users", "d").update({isCommonPurchaseManager: false});
  await rejectWithoutWrites(await makeCommand("case-1", "accept"), "d", "coverage_candidate_ineligible");
});

run("offer binds neighbor completion and assignment revisions across the seasonal boundary", async () => {
  await open(); await offer();
  await ref("shifts", "shift_delivery_20270825").update({documentRevision: 2});
  await rejectWithoutWrites(await makeCommand("case-1", "accept"), "d", "coverage_offer_source_changed");
});

run("deadline, decline, expiration, cancellation and operation identity are explicit", async () => {
  await open(); await offer();
  await rejectWithoutWrites(await makeCommand("case-1", "accept"), "e", "coverage_actor_forbidden");
  await execute("case-1", "decline", "d");
  await offer("case-1", "e");
  now += 10_000;
  await rejectWithoutWrites(await makeCommand("case-1", "accept"), "e", "coverage_offer_deadline");
  await execute("case-1", "expire", "admin");
  const cancel = await makeCommand("case-1", "cancel", {reason: "Resolved"});
  await store.execute(cancel, "a");
  assert.equal((await store.execute(cancel, "a")).replayed, true);
  await rejectWithoutWrites({...cancel, reason: "Different intent"}, "a", "coverage_operation_conflict");
  await open("case-2");
});

run("two simultaneous opens cannot claim the same vacancy", async () => {
  const first = await makeCommand("case-1", "open", {shiftId: "shift_delivery_20270901", absentUserId: "a", reason: "One"});
  const second = {...first, caseId: "case-2", operationId: "other"};
  const results = await Promise.allSettled([store.execute(first, "a"), store.execute(second, "a")]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await db.collection(`${root}/shiftCoverageCases`).get()).size, 1);
});

run("concurrent same-type accepts cannot stack; failure releases the claim without credit", async () => {
  await open("case-1", "shift_market_20270904"); await offer();
  await open("case-2", "shift_market_20270911"); await offer("case-2");
  const commands = await Promise.all([makeCommand("case-1", "accept"), makeCommand("case-2", "accept")]);
  const results = await Promise.allSettled(commands.map((c) => store.execute(c, "d")));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const winner = results.findIndex((r) => r.status === "fulfilled");
  const acceptedId = `case-${winner + 1}`, remainingId = `case-${2 - winner}`;
  await execute(acceptedId, "fail", "admin", {reason: "Cannot perform"});
  assert.equal((await db.collection(`${root}/shiftCoverageCredits`).get()).size, 0);
  await execute(remainingId, "accept", "d");
});

run("market keeps three distinct assignees and earned credit blocks further same-type acceptance", async () => {
  await open("case-1", "shift_market_20270904");
  await rejectWithoutWrites(await makeCommand("case-1", "offer", {userId: "b", reason: "Test", expiresAtMillis: now + 1000}), "admin");
  await offer(); await execute("case-1", "accept", "d");
  const shifted = await read("shifts", "shift_market_20270904");
  assert.deepEqual(shifted.assignedUserIds, ["d", "b", "c"]);
  assert.deepEqual(shifted.rotationOwnerUserIds, ["a", "b", "c"]);
  assert.equal(shifted.rotationPositions[0].effectiveAssigneeUserId, "d");
  now = shifted.date.toMillis() + 1000;
  await execute("case-1", "complete", "admin");
  await open("case-2", "shift_market_20270911");
  await rejectWithoutWrites(await makeCommand("case-2", "offer", {userId: "d", reason: "Test", expiresAtMillis: now + 1000}), "admin", "coverage_candidate_ineligible");
});

run("authority changes, admin demotion, stale case versions and premature completion reject atomically", async () => {
  await open();
  const offered = await makeCommand("case-1", "offer", {userId: "d", reason: "Test", expiresAtMillis: now + 1000});
  await ref("users", "admin").update({roles: ["member"]});
  await rejectWithoutWrites(offered, "admin", "coverage_actor_forbidden");
  await ref("users", "admin").update({roles: ["admin"]});
  await store.execute(offered, "admin");
  await rejectWithoutWrites({...offered, operationId: "different"}, "admin", "coverage_revision_conflict");
  await rejectWithoutWrites(await makeCommand("case-1", "complete"), "d", "coverage_actor_forbidden");
  await ref("shiftPlanningState", "current").update({stateRevision: 2});
  await rejectWithoutWrites(await makeCommand("case-1", "accept"), "d", "coverage_authority_changed");
});

run("same-type claims do not block the other rotation", async () => {
  await open("delivery", "shift_delivery_20270901"); await offer("delivery");
  await execute("delivery", "accept", "d");
  await open("market", "shift_market_20270904"); await offer("market");
  await execute("market", "accept", "d");
  assert.equal((await db.collection(`${root}/shiftCoverageMemberClaims`).get()).size, 2);
});

run("two covered market positions earn distinct credits without rewriting completion history", async () => {
  await open("first", "shift_market_20270904", "a"); await offer("first", "d");
  await execute("first", "accept", "d");
  await open("second", "shift_market_20270904", "b"); await offer("second", "e");
  await execute("second", "accept", "e");
  now = (await read("shifts", "shift_market_20270904")).date.toMillis() + 1000;
  await execute("first", "complete", "admin");
  const history = await read("shifts", "shift_market_20270904");
  now += 1000;
  await execute("second", "complete", "admin");
  assert.deepEqual(await read("shifts", "shift_market_20270904"), history);
  assert.equal((await read("shiftCoverageLedgerState", "market")).revision, 2);
  assert.equal((await db.collection(`${root}/shiftCoverageCredits`).get()).size, 2);
});

run("an offered member's removal does not prevent administrator expiry and cancellation", async () => {
  await open(); await offer();
  await ref("users", "d").delete();
  now += 10_000;
  await execute("case-1", "expire", "admin");
  await execute("case-1", "cancel", "admin", {reason: "Vacancy no longer needed"});
  assert.equal((await db.collection(`${root}/shiftCoverageSlots`).get()).size, 0);
  assert.equal((await db.collection(`${root}/shiftCoverageCredits`).get()).size, 0);
});

const reserve = (userId, enteredAtMillis, extra = {}) => ref("shiftCoverageReserves",
  digest(["delivery", userId]).slice("shift-planning:v1:sha256:".length)).set({userId,
  type: "delivery", active: true, enteredAtMillis, revision: 1, ...extra});
const startSelection = () => execute("case-1", "startSelection", "admin");
const offerNext = () => execute("case-1", "offerNext", "admin", {expiresAtMillis: now + 10_000});
const selection = async () => (await read("shiftCoverageCases", "case-1")).value.selection;

run("reserve FIFO continues after decline and expiry, then collects volunteers and reuses completion", async () => {
  await reserve("e", now - 100); await reserve("d", now - 200);
  await open(); await startSelection();
  const original = await selection();
  assert.equal((await offerNext()).case.offer.userId, "d");
  await execute("case-1", "decline", "d");
  assert.equal((await offerNext()).case.offer.userId, "e");
  now += 10_000;
  await execute("case-1", "expire", "admin");
  assert.equal((await offerNext()).case.selection.phase, "volunteers");
  await execute("case-1", "volunteer", "f");
  await rejectWithoutWrites(await makeCommand("case-1", "offerNext", {expiresAtMillis: now + 5000}),
    "admin", "coverage_volunteer_window_open");
  now += 1000;
  const offered = (await offerNext()).case;
  assert.equal(offered.offer.userId, "f"); assert.equal(offered.offer.source, "volunteer");
  await execute("case-1", "accept", "f");
  now = (await read("shifts", "shift_delivery_20270901")).date.toMillis() + 1000;
  await execute("case-1", "complete", "admin");
  assert.equal((await read("shiftCoverageCredits", "case-1")).userId, "f");
  assert.deepEqual((await selection()).snapshot, original.snapshot);
  assert.equal((await selection()).snapshotDigest, original.snapshotDigest);
  assert.deepEqual((await selection()).attemptedUserIds, ["d", "e", "f"]);
});

run("source snapshot records exclusions, ignores late entrants and skips changed reserves", async () => {
  await reserve("d", now - 200); await reserve("e", now - 100);
  await reserve("a", now - 400); await reserve("b", now - 300);
  await open(); await startSelection();
  const original = await selection();
  assert.equal(original.snapshot.find((v) => v.userId === "a").exclusion, "already_assigned");
  assert.equal(original.snapshot.find((v) => v.userId === "b").exclusion, "adjacent_delivery");
  await reserve("f", now - 500);
  await ref("users", "d").update({isActive: false});
  const offered = (await offerNext()).case;
  assert.equal(offered.offer.userId, "e");
  assert.ok(offered.selection.latestExclusions.some((e) => e.userId === "d" && e.reason === "inactive"));
  await reserve("e", now - 100, {active: false, revision: 2});
  await rejectWithoutWrites(await makeCommand("case-1", "accept"), "e", "coverage_reserve_changed");
  assert.deepEqual((await selection()).snapshot, original.snapshot);
});

run("volunteer order is server time then ID; withdrawal and late response cannot change it", async () => {
  await open(); await startSelection(); await offerNext();
  const first = await makeCommand("case-1", "volunteer");
  await store.execute(first, "f");
  const after = await snapshot();
  assert.equal((await store.execute(first, "f")).replayed, true);
  assert.deepEqual(await snapshot(), after);
  await execute("case-1", "volunteer", "e");
  await execute("case-1", "volunteer", "d");
  await execute("case-1", "withdrawVolunteer", "d");
  now += 1000;
  await rejectWithoutWrites(await makeCommand("case-1", "volunteer"), "admin", "coverage_volunteer_window_closed");
  await rejectWithoutWrites(await makeCommand("case-1", "withdrawVolunteer"), "e", "coverage_volunteer_window_closed");
  assert.equal((await offerNext()).case.offer.userId, "e");
  await execute("case-1", "decline", "e");
  assert.equal((await offerNext()).case.offer.userId, "f");
});

run("exhausted selection stops at drawRequired without an invented draw or administrator override", async () => {
  await open(); await startSelection(); await offerNext();
  now += 1000;
  const result = await offerNext();
  assert.equal(result.case.selection.phase, "drawRequired");
  assert.equal(result.case.offer, null);
  assert.deepEqual((await read("shifts", "shift_delivery_20270901")).assignedUserIds, ["a"]);
  await rejectWithoutWrites(await makeCommand("case-1", "offerNext", {expiresAtMillis: now + 5000}),
    "admin", "coverage_draw_required");
  await rejectWithoutWrites(await makeCommand("case-1", "offer", {userId: "d", reason: "Override", expiresAtMillis: now + 5000}),
    "admin", "coverage_selection_admin_override_blocked");
  assert.equal((await db.collection(`${root}/shiftCoverageCredits`).get()).size, 0);
});

run("simultaneous selection offers commit once and reject identity or snapshot replacement", async () => {
  await reserve("d", now - 1); await open();
  await rejectWithoutWrites(await makeCommand("case-1", "startSelection"), "d", "coverage_actor_forbidden");
  await startSelection();
  await rejectWithoutWrites(await makeCommand("case-1", "startSelection"), "admin", "coverage_selection_already_started");
  const command = await makeCommand("case-1", "offerNext", {expiresAtMillis: now + 1000});
  await rejectWithoutWrites({...command, userId: "f"}, "admin", "invalid_coverage_command");
  const results = await Promise.allSettled([store.execute(command, "admin"),
    store.execute({...command, operationId: "parallel"}, "admin")]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.deepEqual((await selection()).attemptedUserIds, ["d"]);
});

run("a volunteer's new same-type claim is excluded when the response window closes", async () => {
  await open("other", "shift_delivery_20270908", "c");
  // A second delivery requires its own successor; use a separately held claim
  // with exactly the schema written by the already validated acceptance path.
  await open(); await startSelection(); await offerNext();
  await execute("case-1", "volunteer", "d");
  await ref("shiftCoverageMemberClaims", digest(["delivery", "d"]).slice("shift-planning:v1:sha256:".length))
    .set({caseId: "other", userId: "d", type: "delivery", state: "accepted"});
  now += 1000;
  const result = (await offerNext()).case;
  assert.equal(result.selection.phase, "drawRequired");
  assert.deepEqual(result.selection.latestExclusions, [{userId: "d", reason: "same_type_claim"}]);
});

run("market selection isolates its reserve pool and preserves three assignees and owners", async () => {
  await reserve("f", now - 500);
  await ref("users", "d").update({roles: ["member", "producer"], isCommonPurchaseManager: true});
  await ref("shiftCoverageReserves", digest(["market", "d"]).slice("shift-planning:v1:sha256:".length))
    .set({userId: "d", type: "market", active: true, enteredAtMillis: now - 100, revision: 1});
  await open("case-1", "shift_market_20270904"); await startSelection();
  const offered = (await offerNext()).case;
  assert.equal(offered.offer.userId, "d");
  await execute("case-1", "accept", "d");
  const market = await read("shifts", "shift_market_20270904");
  assert.deepEqual(market.assignedUserIds, ["d", "b", "c"]);
  assert.deepEqual(market.rotationOwnerUserIds, ["a", "b", "c"]);
});

run("server clock regression cannot reorder volunteer registration", async () => {
  await open(); await startSelection(); await offerNext();
  now += 50;
  await execute("case-1", "volunteer", "e");
  now -= 10;
  await rejectWithoutWrites(await makeCommand("case-1", "volunteer"), "d", "invalid_coverage_clock");
});

run("selection cannot reset a case that already attempted an administrative offer", async () => {
  await open(); await offer(); await execute("case-1", "decline", "d");
  await rejectWithoutWrites(await makeCommand("case-1", "startSelection"), "admin",
    "coverage_selection_requires_new_case");
});
