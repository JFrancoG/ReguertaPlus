"use strict";
const assert = require("node:assert/strict");
const {test, before, beforeEach, after} = require("node:test");
const {generateKeyPairSync, sign} = require("node:crypto");
const {publicKey, privateKey} = generateKeyPairSync("ed25519");
const {Firestore, Timestamp} = require("@google-cloud/firestore");
const {createProvisionalShiftCoverageStore} = require("../lib/shift-coverage-provisional-store.js");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {materialize, initialTime, activeDigest} = require("./shift-coverage-fixture.cjs");

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const run = (name, fn) => test(name, {skip: !enabled}, fn);
const root = "develop/plus-collections", projectId = "demo-reguerta-hu084-coverage";
let db, store, now, sequence;
const ref = (collection, id) => db.doc(`${root}/${collection}/${id}`);
const read = async (collection, id) => (await ref(collection, id).get()).data();
const member = (roles = ["member"], isCommonPurchaseManager = false) =>
  ({roles, isCommonPurchaseManager, isActive: true});
const snapshot = async () => {
  const output = {};
  for (const collection of ["shiftMembershipState", "shiftMembershipOperations", "shifts", "users", "shiftRotations", "shiftCoverageCreditPlans", "shiftCoverageCreditUnits", "shiftCoverageCases", "shiftCoverageCredits",
    "shiftCoverageSlots", "shiftCoverageBeaconRounds", "shiftCoverageReserves", "shiftCoverageMemberClaims", "shiftCoverageOperations", "shiftCoverageEffects", "shiftCoverageProjectionState", "shiftCoverageLedgerState"]) {
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
    selectionPolicy: {version: "fifo-signup-v1", volunteerWindowMillis: 1000},
    beaconPolicy: {sourceId: "local-test-beacon", publicKeyPem: publicKey.export({format: "pem", type: "spki"}),
      genesisMillis: initialTime, periodMillis: 1000}});
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

const waitForDraw = async () => {
  await open(); await startSelection(); await offerNext(); now += 1000; await offerNext();
};
const commitDraw = () => execute("case-1", "commitDraw", "admin");
const revealDraw = () => execute("case-1", "revealDraw", "admin");
const beaconRef = (draw) => ref("shiftCoverageBeaconRounds",
  digest([draw.beacon.sourceId, String(draw.round)]).slice("shift-planning:v1:sha256:".length));
const publishBeacon = async (draw, overrides = {}) => {
  const payload = {domain: "hu084-local-beacon-v1", sourceId: draw.beacon.sourceId,
    round: draw.round, publishedAtMillis: draw.availableAtMillis, randomness: "12".repeat(32)};
  await beaconRef(draw).set({...payload,
    signatureHex: sign(null, Buffer.from(digest(payload)), privateKey).toString("hex"), ...overrides});
};

run("committed future draw verifies evidence, preserves ordering on replay and reaches completion", async () => {
  await waitForDraw();
  const committed = (await commitDraw()).case.selection.draw;
  assert.equal(committed.order, null);
  assert.ok(committed.availableAtMillis > now);
  await rejectWithoutWrites(await makeCommand("case-1", "revealDraw"), "admin", "coverage_entropy_not_available");
  now = committed.availableAtMillis;
  await publishBeacon(committed);
  const command = await makeCommand("case-1", "revealDraw");
  const revealed = (await store.execute(command, "admin")).case.selection.draw;
  assert.equal(revealed.commitmentDigest, committed.commitmentDigest);
  assert.deepEqual(new Set(revealed.order), new Set(["admin", "d", "e", "f"]));
  const evidence = await snapshot();
  assert.equal((await store.execute(command, "admin")).replayed, true);
  assert.deepEqual(await snapshot(), evidence);
  await rejectWithoutWrites(await makeCommand("case-1", "revealDraw"), "admin", "coverage_draw_state_conflict");
  const offered = (await offerNext()).case;
  assert.equal(offered.offer.source, "draw"); assert.equal(offered.offer.userId, revealed.order[0]);
  await execute("case-1", "accept", revealed.order[0]);
  now = (await read("shifts", "shift_delivery_20270901")).date.toMillis() + 1000;
  await execute("case-1", "complete", "admin");
  assert.equal((await read("shiftCoverageCredits", "case-1")).userId, revealed.order[0]);
});

run("bad signature, changed round and prepublished entropy reject without writes", async () => {
  await waitForDraw();
  const {commitCoverageDraw} = require("../lib/shift-coverage-draw.js");
  const anticipated = commitCoverageDraw({caseId: "case-1", selectionDigest: "unused", assignmentContextDigest: "unused",
    candidates: [], policy: {sourceId: "local-test-beacon", publicKeyPem: publicKey.export({format: "pem", type: "spki"}),
      genesisMillis: initialTime, periodMillis: 1000}, now});
  await publishBeacon(anticipated);
  await rejectWithoutWrites(await makeCommand("case-1", "commitDraw"), "admin", "coverage_entropy_already_available");
  await beaconRef(anticipated).delete();
  const draw = (await commitDraw()).case.selection.draw;
  now = draw.availableAtMillis;
  await publishBeacon(draw, {signatureHex: "00".repeat(64)});
  await rejectWithoutWrites(await makeCommand("case-1", "revealDraw"), "admin", "coverage_beacon_signature_invalid");
  await publishBeacon(draw, {round: draw.round + 1});
  await rejectWithoutWrites(await makeCommand("case-1", "revealDraw"), "admin", "coverage_beacon_evidence_invalid");
  await publishBeacon(draw); await revealDraw();
});

run("draw retries use remaining committed order then explicit admin consent", async () => {
  await waitForDraw(); const draw = (await commitDraw()).case.selection.draw;
  now = draw.availableAtMillis; await publishBeacon(draw);
  const order = (await revealDraw()).case.selection.draw.order;
  for (const id of order) {
    assert.equal((await offerNext()).case.offer.userId, id);
    await execute("case-1", "decline", id);
  }
  assert.equal((await offerNext()).case.selection.phase, "adminRequired");
  await rejectWithoutWrites(await makeCommand("case-1", "offerNext", {expiresAtMillis: now + 1000}),
    "admin", "coverage_admin_required");
  await execute("case-1", "offerAdmin", "admin", {userId: "d", reason: "Member agreed after reviewing circumstances",
    expiresAtMillis: now + 1000});
  assert.deepEqual((await read("shifts", "shift_delivery_20270901")).assignedUserIds, ["a"]);
  await execute("case-1", "accept", "d");
  assert.deepEqual((await read("shifts", "shift_delivery_20270901")).assignedUserIds, ["d"]);
  assert.deepEqual((await selection()).draw.order, order);
});

run("cancelled draw cannot reopen under a new case; administrative recovery preserves evidence", async () => {
  await waitForDraw(); const draw = (await commitDraw()).case.selection.draw;
  now = draw.availableAtMillis; await publishBeacon(draw); await revealDraw();
  const before = (await selection()).draw;
  await execute("case-1", "cancel", "a", {reason: "Needs administrative review"});
  await assert.rejects(open("replacement"), {code: "coverage_slot_occupied"});
  await rejectWithoutWrites(await makeCommand("case-1", "resumeAdmin", {reason: "Review"}), "a", "coverage_actor_forbidden");
  await execute("case-1", "resumeAdmin", "admin", {reason: "Documented recovery without reroll"});
  await rejectWithoutWrites(await makeCommand("case-1", "commitDraw"), "admin", "coverage_draw_state_conflict");
  await execute("case-1", "offerAdmin", "admin", {userId: "d", reason: "Explicit arrangement", expiresAtMillis: now + 1000});
  await execute("case-1", "accept", "d");
  assert.deepEqual((await selection()).draw, before);
});

run("draw skips current ineligibility without rewriting evidence or including later members", async () => {
  await waitForDraw(); const draw = (await commitDraw()).case.selection.draw;
  now = draw.availableAtMillis; await publishBeacon(draw);
  const revealed = (await revealDraw()).case.selection.draw;
  const [first, second] = revealed.order;
  if (first === "admin") await ref("users", first).update({roles: ["admin", "producer"]});
  else await ref("users", first).update({isActive: false});
  await ref("users", "newcomer").set(member());
  const next = (await offerNext()).case;
  assert.equal(next.offer.userId, second);
  assert.ok(next.selection.latestExclusions.some((entry) => entry.userId === first));
  assert.deepEqual(next.selection.draw, revealed);
});

run("concurrent commitments fix one draw and commands cannot supply seed, key or candidates", async () => {
  await waitForDraw(); const command = await makeCommand("case-1", "commitDraw");
  for (const extra of [{seed: "chosen"}, {round: 123}, {candidates: ["d"]}, {publicKeyPem: "chosen"}]) {
    await rejectWithoutWrites({...command, ...extra}, "admin", "invalid_coverage_command");
  }
  const results = await Promise.allSettled([store.execute(command, "admin"),
    store.execute({...command, operationId: "competing"}, "admin")]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  await rejectWithoutWrites(await makeCommand("case-1", "commitDraw"), "admin", "coverage_draw_state_conflict");
});

run("empty draw pool requires admin resolution without waiting for entropy or forcing an assignee", async () => {
  await waitForDraw();
  for (const id of ["d", "e", "f"]) await ref("users", id).update({isActive: false});
  await ref("users", "admin").update({roles: ["admin", "producer"]});
  const result = (await commitDraw()).case;
  assert.equal(result.selection.phase, "adminRequired");
  assert.equal(result.selection.draw, undefined);
  assert.deepEqual((await read("shifts", "shift_delivery_20270901")).assignedUserIds, ["a"]);
  await rejectWithoutWrites(await makeCommand("case-1", "offerAdmin", {userId: "d", reason: "Attempt",
    expiresAtMillis: now + 1000}), "admin", "coverage_candidate_ineligible");
  await ref("users", "d").update({isActive: true});
  await execute("case-1", "offerAdmin", "admin", {userId: "d", reason: "Available again", expiresAtMillis: now + 1000});
  await execute("case-1", "accept", "d");
});

run("source drift between commitment and reveal rejects the result and preserves recoverable evidence", async () => {
  await waitForDraw(); const draw = (await commitDraw()).case.selection.draw;
  await ref("shifts", "shift_delivery_20270908").update({documentRevision: 2});
  now = draw.availableAtMillis; await publishBeacon(draw);
  await rejectWithoutWrites(await makeCommand("case-1", "revealDraw"), "admin", "coverage_draw_source_changed");
  await execute("case-1", "cancel", "admin", {reason: "Source changed during commitment"});
  await execute("case-1", "resumeAdmin", "admin", {reason: "Resolve from current source without drawing again"});
  assert.deepEqual((await selection()).draw, draw);
});

const seedCreditRotation = (type, cohortUserIds, roundNumber = 2, nextMemberIndex = 0) =>
  ref("shiftRotations", type).set({schemaVersion: 1, type, stateRevision: 1,
    cursor: {schemaVersion: 1, type, cohortUserIds, roundNumber, nextMemberIndex},
    planningFrontierSeasonStartYear: 2027, cohortFrozen: nextMemberIndex !== 0,
    frozenCohortUserIds: nextMemberIndex ? cohortUserIds : [],
    activeRevision: "active-1", activeDigest, lastIdempotencyKey: null, migrationBaseline: null, releaseLease: null});
const creditIntent = (planId = "plan-1", type = "market", scheduledDate = "2027-09-18") =>
  ({schemaVersion: 1, environment: "develop", planId, type, scheduledDate});
const prepareEarnedCredit = async () => {
  await open("case-1", "shift_market_20270904"); await offer(); await execute("case-1", "accept", "d");
  now = (await read("shifts", "shift_market_20270904")).date.toMillis() + 1000;
  await execute("case-1", "complete", "admin");
  await seedCreditRotation("market", ["d", "a", "b", "c", "e", "f"]);
};
const activatePlan = (plan) => store.activateCreditUnit({planId: plan.proposal.planId, planDigest: plan.planDigest}, "admin");
const creditRejectWithoutWrites = async (action, code) => {
  const original = await snapshot();
  await assert.rejects(action(), code ? {code} : undefined);
  assert.deepEqual(await snapshot(), original);
};

run("earned credit previews without writes, stages without spending, then atomically advances a private complete unit", async () => {
  await prepareEarnedCredit();
  const original = await snapshot();
  const preview = await store.previewCreditUnit(creditIntent(), "admin");
  assert.deepEqual(await snapshot(), original);
  assert.deepEqual(preview.proposal.unit.consumedCreditIds, ["case-1"]);
  assert.deepEqual(preview.proposal.unit.assignments.map((p) => p.rotationOwnerUserId), ["a", "b", "c"]);
  const staged = await store.stageCreditUnit(creditIntent(), "admin");
  assert.equal(staged.planDigest, preview.planDigest);
  assert.equal((await read("shiftCoverageCredits", "case-1")).state, "pending");
  assert.deepEqual((await snapshot()).shiftRotations, original.shiftRotations);
  const result = await activatePlan(staged);
  assert.equal(result.replayed, false);
  assert.equal((await read("shiftCoverageCredits", "case-1")).state, "consumed");
  assert.equal((await read("shiftCoverageLedgerState", "market")).revision, 2);
  assert.equal((await db.collection(`${root}/shiftCoverageMemberClaims`).get()).size, 0);
  assert.equal((await read("shiftRotations", "market")).cursor.nextMemberIndex, 4);
  const recorded = await read("shiftCoverageCreditUnits", "market_2027-09-18");
  assert.equal(recorded.scope, "localRehearsal");
  assert.equal(recorded.unit.assignments.length, 3);
  assert.deepEqual((await snapshot()).shifts, original.shifts);
  const completed = await snapshot();
  assert.equal((await activatePlan(staged)).replayed, true);
  assert.deepEqual(await snapshot(), completed);
  await creditRejectWithoutWrites(() => store.stageCreditUnit(creditIntent("different"), "admin"), "credit_unit_occupied");
});

run("any same-type ledger change after stage invalidates activation, including credits not consumed by that unit", async () => {
  await prepareEarnedCredit();
  const plan = await store.stageCreditUnit(creditIntent(), "admin");
  const earned = await read("shiftCoverageCredits", "case-1");
  await ref("shiftCoverageCredits", "unrelated").set({...earned, id: "unrelated", caseId: "unrelated", userId: "f"});
  await ref("shiftCoverageMemberClaims", digest(["market", "f"]).slice("shift-planning:v1:sha256:".length))
    .set({caseId: "unrelated", userId: "f", type: "market", state: "creditPending"});
  await ref("shiftCoverageLedgerState", "market").update({revision: 2});
  await creditRejectWithoutWrites(() => activatePlan(plan), "credit_plan_source_changed");
  assert.equal((await read("shiftCoverageCredits", "case-1")).state, "pending");
});

run("competing local activations cannot spend a credit or cursor twice", async () => {
  await prepareEarnedCredit();
  const one = await store.stageCreditUnit(creditIntent("one"), "admin");
  const two = await store.stageCreditUnit(creditIntent("two", "market", "2027-09-25"), "admin");
  const results = await Promise.allSettled([activatePlan(one), activatePlan(two)]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal((await read("shiftCoverageLedgerState", "market")).revision, 2);
  assert.equal((await read("shiftRotations", "market")).stateRevision, 2);
  assert.equal((await db.collection(`${root}/shiftCoverageCreditUnits`).get()).size, 1);
});

run("admin demotion, membership drift and changed maintenance authority reject credit activation atomically", async () => {
  await prepareEarnedCredit();
  const plan = await store.stageCreditUnit(creditIntent(), "admin");
  await ref("users", "admin").update({roles: ["member"]});
  await creditRejectWithoutWrites(() => activatePlan(plan), "coverage_actor_forbidden");
  await ref("users", "admin").update({roles: ["admin", "member"]});
  await ref("users", "b").update({isActive: false});
  await creditRejectWithoutWrites(() => activatePlan(plan), "credit_cohort_ineligible");
  await ref("users", "b").update({isActive: true});
  await ref("shiftPlanningState", "current").update({stateRevision: 2});
  await creditRejectWithoutWrites(() => activatePlan(plan), "credit_plan_source_changed");
});

run("frozen-round and insufficient-market fallback retain credit and claim while advancing ordinary positions", async () => {
  await prepareEarnedCredit();
  await seedCreditRotation("market", ["d", "a", "b"]);
  const plan = await store.stageCreditUnit(creditIntent(), "admin");
  assert.deepEqual(plan.proposal.unit.consumedCreditIds, []);
  assert.deepEqual(plan.proposal.unit.deferredCreditIds, ["case-1"]);
  await activatePlan(plan);
  assert.equal((await read("shiftCoverageCredits", "case-1")).state, "pending");
  assert.equal((await read("shiftCoverageLedgerState", "market")).revision, 1);
  assert.equal((await db.collection(`${root}/shiftCoverageMemberClaims`).get()).size, 1);
  await seedCreditRotation("market", ["a", "d", "b", "c", "e", "f"], 2, 1);
  const frozen = await store.previewCreditUnit(creditIntent("frozen", "market", "2027-09-25"), "admin");
  assert.deepEqual(frozen.proposal.unit.consumedCreditIds, []);
});

run("already public dates and forged credit plan payloads reject before any mutation", async () => {
  await prepareEarnedCredit();
  await creditRejectWithoutWrites(() => store.stageCreditUnit(creditIntent("public", "market", "2027-09-11"), "admin"),
    "credit_unit_already_public");
  await creditRejectWithoutWrites(() => store.stageCreditUnit({...creditIntent(), consumedCreditIds: ["case-1"]}, "admin"),
    "invalid_credit_plan_command");
  const plan = await store.stageCreditUnit(creditIntent(), "admin");
  await creditRejectWithoutWrites(() => store.activateCreditUnit({planId: "plan-1", planDigest: plan.planDigest,
    unit: {assignments: ["d"]}}, "admin"), "invalid_credit_plan_command");
  await creditRejectWithoutWrites(() => store.activateCreditUnit({planId: "plan-1", planDigest: "forged"}, "admin"),
    "credit_plan_digest_changed");
});

run("delivery credit activation binds both neighbors and preserves completed helper history", async () => {
  await open(); await offer(); await execute("case-1", "accept", "d");
  now = (await read("shifts", "shift_delivery_20270901")).date.toMillis() + 1000;
  await execute("case-1", "complete", "admin");
  await seedCreditRotation("delivery", ["d", "f", "a", "b", "c", "e"]);
  const history = await read("shifts", "shift_delivery_20270901");
  const plan = await store.stageCreditUnit(creditIntent("delivery-credit", "delivery", "2027-09-05"), "admin");
  assert.deepEqual(plan.proposal.unit.consumedCreditIds, ["case-1"]);
  assert.equal(plan.proposal.unit.assignments[0].rotationOwnerUserId, "f");
  assert.ok(plan.proposal.deliveryProjection);
  await activatePlan(plan);
  assert.deepEqual(await read("shifts", "shift_delivery_20270901"), history);
  assert.equal((await read("shiftRotations", "delivery")).cursor.nextMemberIndex, 2);
  assert.equal((await read("shiftCoverageCredits", "case-1")).state, "consumed");
});

run("ledger contents are bound even without a revision bump, and missing claims fail closed", async () => {
  await prepareEarnedCredit();
  const plan = await store.stageCreditUnit(creditIntent(), "admin");
  const credit = await read("shiftCoverageCredits", "case-1");
  await ref("shiftCoverageCredits", "case-1").update({earnedAtMillis: credit.earnedAtMillis - 1});
  await creditRejectWithoutWrites(() => activatePlan(plan), "credit_plan_source_changed");
  await ref("shiftCoverageCredits", "case-1").set(credit);
  await ref("shiftCoverageMemberClaims", digest(["market", "d"]).slice("shift-planning:v1:sha256:".length)).delete();
  await creditRejectWithoutWrites(() => activatePlan(plan), "credit_claim_changed");
});

run("a missing ledger cannot turn issued credits into an unversioned activation", async () => {
  await prepareEarnedCredit();
  await ref("shiftCoverageLedgerState", "market").delete();
  await creditRejectWithoutWrites(() => store.stageCreditUnit(creditIntent(), "admin"), "invalid_credit_plan_revision");
});

run("a released seasonal claim re-enters selection and can be replaced by a new accepted coverage", async () => {
  const claimId = digest(["delivery", "d"]).split(":").at(-1);
  await ref("shiftCoverageMemberClaims", claimId).set({caseId: "old-completed", type: "delivery", userId: "d",
    state: "released", consumedByPlanId: "seasonal-plan", consumedAtMillis: now - 1});
  await open();
  await execute("case-1", "startSelection", "admin");
  const state = (await read("shiftCoverageCases", "case-1")).value;
  assert.equal(state.selection.snapshot.find((c) => c.userId === "d").exclusion, null);
  await execute("case-1", "cancel", "admin", {reason: "Exercise administrative offer"});
  await open("case-2"); await offer("case-2");
  await execute("case-2", "accept", "d");
  assert.equal((await read("shiftCoverageMemberClaims", claimId)).state, "accepted");
  assert.equal((await read("shiftCoverageMemberClaims", claimId)).caseId, "case-2");
});

const seedMembershipRotations = async () => {
  for (const type of ["delivery", "market"]) await ref("shiftRotations", type).set({schemaVersion: 1,
    type, stateRevision: 4, cursor: {schemaVersion: 1, type, cohortUserIds: ["a", "b", "c"],
      roundNumber: 1, nextMemberIndex: 1}, planningFrontierSeasonStartYear: 2027,
    cohortFrozen: true, frozenCohortUserIds: ["a", "b", "c"], activeRevision: "active-1",
    activeDigest, lastIdempotencyKey: null, migrationBaseline: null, releaseLease: null});
};
const membershipCommand = async (userId, operationId = `membership-${++sequence}`) => ({
  schemaVersion: 1, environment: "develop", userId, operationId,
  expectedRevision: (await read("shiftMembershipState", userId))?.value.revision ?? 0,
});
const reconcile = async (userId) => store.reconcileMembership(await membershipCommand(userId), "admin");
const reserveFor = (userId, type = "delivery") => read("shiftCoverageReserves", digest([type, userId]).split(":").at(-1));

run("membership baseline preserves cohort members and idempotency is actor-bound", async () => {
  await seedMembershipRotations(); const before = await snapshot();
  const command = await membershipCommand("a");
  const first = await store.reconcileMembership(command, "admin");
  assert.equal(first.result.state.pendingQueueTransition, false);
  assert.equal(first.result.state.revision, 1);
  assert.deepEqual(first.result.coverage, []);
  assert.equal(await reserveFor("a"), undefined);
  const after = await snapshot();
  assert.deepEqual(after.shifts, before.shifts); assert.deepEqual(after.shiftRotations, before.shiftRotations);
  assert.equal((await store.reconcileMembership(command, "admin")).replayed, true);
  assert.deepEqual(await snapshot(), after);
  await ref("users", "e").update({roles: ["member", "admin"]});
  await assert.rejects(store.reconcileMembership(command, "e"), {code: "membership_operation_conflict"});
  const unchanged = await reconcile("a");
  assert.equal(unchanged.result.state.revision, 1);
});

run("new membership enters both FIFO pools, stays reserved across August and normal cohort inclusion", async () => {
  await seedMembershipRotations();
  const joined = await reconcile("d");
  assert.equal(joined.result.state.pendingQueueTransition, true);
  assert.deepEqual(joined.result.state.admissionAfterRound, {delivery: 1, market: 1});
  for (const type of ["delivery", "market"]) assert.deepEqual(await reserveFor("d", type),
    {userId: "d", type, active: true, enteredAtMillis: initialTime, revision: 1});
  await open(); await execute("case-1", "startSelection", "admin");
  const offered = await execute("case-1", "offerNext", "admin", {expiresAtMillis: now + 10_000});
  assert.equal(offered.case.offer.userId, "d"); assert.equal(offered.case.offer.source, "reserve");
  now = Date.parse("2028-09-01T00:00:00Z");
  for (const type of ["delivery", "market"]) await ref("shiftRotations", type).update({
    "cursor.cohortUserIds": ["a", "b", "c", "d"], "cursor.roundNumber": 2,
    "cursor.nextMemberIndex": 0, cohortFrozen: false, frozenCohortUserIds: []});
  await reconcile("d");
  assert.equal((await reserveFor("d")).enteredAtMillis, initialTime);
  assert.equal((await reserveFor("d")).revision, 1);
});

run("departure opens only affected future cases, preserves history and re-entry cannot revive old positions", async () => {
  await seedMembershipRotations(); await reconcile("a");
  const before = await snapshot();
  await ref("users", "a").update({isActive: false});
  const departed = await reconcile("a");
  assert.equal(departed.result.state.pendingQueueTransition, true);
  assert.deepEqual(departed.result.state.pendingTypes, {delivery: true, market: true});
  assert.deepEqual(departed.result.state.frozenExclusion,
    {reason: "excusedDeparture", revision: departed.result.state.revision});
  assert.equal(departed.result.coverage.length, 3);
  assert.ok(departed.result.coverage.every((c) => c.status === "opened"));
  let after = await snapshot();
  assert.deepEqual(after.shifts, before.shifts); assert.deepEqual(after.shiftRotations, before.shiftRotations);
  assert.deepEqual(after.shiftCoverageCredits, before.shiftCoverageCredits);
  assert.equal(after.shiftCoverageCases.length, 3);
  for (const [, entry] of after.shiftCoverageCases) {
    assert.equal(entry.value.absentUserId, "a"); assert.equal(entry.value.reason, "member_inactive");
  }
  const repeat = await reconcile("a");
  assert.ok(repeat.result.coverage.every((c) => c.status === "existing_case"));
  now += 100;
  await ref("users", "a").update({isActive: true});
  const restored = await reconcile("a");
  assert.equal(restored.result.state.pendingQueueTransition, true);
  assert.deepEqual(restored.result.state.frozenExclusion, departed.result.state.frozenExclusion);
  assert.equal((await reserveFor("a")).enteredAtMillis, now);
  assert.equal((await reserveFor("a", "market")).active, true);
  const {assertNoPendingShiftMembership} = require("../lib/shift-membership-reconciliation.js");
  await assert.rejects(db.runTransaction((transaction) => assertNoPendingShiftMembership(db, transaction)),
    {code: "membership_queue_transition_pending"});
  after = await snapshot();
  assert.equal(after.shiftCoverageCases.length, 3); assert.deepEqual(after.shifts, before.shifts);
  const delivery = departed.result.coverage.find((c) => c.shiftId === "shift_delivery_20270901");
  await offer(delivery.caseId, "d"); await execute(delivery.caseId, "accept", "d");
  assert.equal((await read("shifts", delivery.shiftId)).rotationOwnerUserId, "a");
  assert.deepEqual((await read("shifts", delivery.shiftId)).assignedUserIds, ["d"]);
});

run("producer/company eligibility changes deactivate reserves and re-entry goes to the FIFO tail", async () => {
  await seedMembershipRotations(); await reconcile("d");
  now += 10; await reconcile("e");
  now += 10; await ref("users", "d").update({roles: ["member", "producer"]});
  const producer = await reconcile("d");
  assert.equal(producer.result.state.eligible, false);
  assert.deepEqual(producer.result.state.frozenExclusion,
    {reason: "excusedIneligible", revision: producer.result.state.revision});
  assert.equal((await reserveFor("d")).active, false);
  assert.equal((await reserveFor("d")).revision, 2);
  now += 10; await ref("users", "d").update({isCommonPurchaseManager: true});
  const manager = await reconcile("d");
  assert.equal(manager.result.state.eligible, true);
  assert.deepEqual(manager.result.state.frozenExclusion, producer.result.state.frozenExclusion);
  assert.equal((await reserveFor("d")).revision, 3);
  assert.ok((await reserveFor("d")).enteredAtMillis > (await reserveFor("e")).enteredAtMillis);
  await open(); await execute("case-1", "startSelection", "admin");
  const offered = await execute("case-1", "offerNext", "admin", {expiresAtMillis: now + 10_000});
  assert.equal(offered.case.offer.userId, "e");
});

run("reactivation invalidates an older reserve offer even when current user fields match again", async () => {
  await seedMembershipRotations(); await reconcile("d");
  await open(); await execute("case-1", "startSelection", "admin");
  await execute("case-1", "offerNext", "admin", {expiresAtMillis: now + 10_000});
  now += 1; await ref("users", "d").update({isActive: false}); await reconcile("d");
  now += 1; await ref("users", "d").update({isActive: true}); await reconcile("d");
  await rejectWithoutWrites(await makeCommand("case-1", "accept"), "d");
});

run("concurrent reconciliations commit one baseline and one pair of reserve entries", async () => {
  await seedMembershipRotations();
  const commands = await Promise.all([membershipCommand("d", "join-one"), membershipCommand("d", "join-two")]);
  const results = await Promise.allSettled(commands.map((command) => store.reconcileMembership(command, "admin")));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const loser = results.findIndex((result) => result.status === "rejected");
  const error = results[loser].reason;
  if (error.code === 3) {
    // The emulator can close its retry transaction under lock contention.
    assert.match(error.message, /Transaction is invalid or closed/);
    await assert.rejects(store.reconcileMembership(commands[loser], "admin"), {code: "membership_revision_conflict"});
  } else {
    assert.equal(error.code, "membership_revision_conflict");
  }
  assert.equal((await snapshot()).shiftMembershipOperations.length, 1);
  assert.equal((await reserveFor("d")).revision, 1);
});

run("membership commands fail closed for unauthorized actors, malformed source, stale authority and command injection", async () => {
  await seedMembershipRotations(); const command = await membershipCommand("d");
  let before = await snapshot();
  await assert.rejects(store.reconcileMembership(command, "a"), {code: "coverage_actor_forbidden"});
  await assert.rejects(store.reconcileMembership({...command, eligible: true}, "admin"), {code: "invalid_membership_command"});
  assert.deepEqual(await snapshot(), before);
  await ref("users", "d").update({roles: "member"}); before = await snapshot();
  await assert.rejects(store.reconcileMembership(command, "admin"), {code: "invalid_coverage_member"});
  assert.deepEqual(await snapshot(), before);
  await ref("users", "d").set(member());
  await ref("shiftRotations", "market").update({activeRevision: "stale"}); before = await snapshot();
  await assert.rejects(store.reconcileMembership(command, "admin"), {code: "membership_rotation_changed"});
  assert.deepEqual(await snapshot(), before);
});

run("deleted members become audited departures and existing cases are reused", async () => {
  await seedMembershipRotations(); await reconcile("a"); await open();
  await ref("users", "a").delete();
  const result = await reconcile("a");
  assert.equal(result.result.state.source, null);
  assert.equal(result.result.coverage.filter((c) => c.status === "existing_case").length, 1);
  assert.equal((await snapshot()).shiftCoverageCases.length, 3);
});

run("oversized departure reconciliations leave reserves, cases, state and rotations untouched", async () => {
  await seedMembershipRotations(); await ref("users", "a").update({isActive: false});
  const batch = db.batch();
  for (let i = 0; i < 250; i++) {
    const date = new Date(Date.parse("2028-01-01T00:00:00Z") + i * 86_400_000).toISOString().slice(0, 10);
    const id = `shift_market_${date.replaceAll("-", "")}`;
    batch.set(ref("shifts", id), materialize(id, "market", date, ["a", "b", "c"]));
  }
  await batch.commit();
  const before = await snapshot();
  await assert.rejects(reconcile("a"), {code: "membership_transaction_oversize"});
  assert.deepEqual(await snapshot(), before);
});

run("membership reconciliation leaves pending swaps for resolution and rejects orphan coverage claims atomically", async () => {
  await seedMembershipRotations(); await ref("users", "a").update({isActive: false});
  await ref("shifts", "shift_delivery_20270901").update({status: "swap_pending"});
  const first = await reconcile("a");
  assert.deepEqual(first.result.coverage.find((c) => c.shiftId === "shift_delivery_20270901"),
    {shiftId: "shift_delivery_20270901", status: "swap_pending", caseId: null});
  assert.equal((await read("shifts", "shift_delivery_20270901")).status, "swap_pending");
  assert.equal((await snapshot()).shiftCoverageCases.length, 2);
  const slotId = digest(["shift_market_20270904", "0"]).split(":").at(-1);
  await ref("shiftCoverageSlots", slotId).set({caseId: "missing-case"});
  const before = await snapshot();
  await assert.rejects(reconcile("a"), {code: "invalid_coverage_case"});
  assert.deepEqual(await snapshot(), before);
});

run("legacy pending membership cannot acquire guessed per-type admission flags on reconciliation", async () => {
  await seedMembershipRotations(); await reconcile("d");
  const record = await read("shiftMembershipState", "d");
  delete record.value.admissionRequired; record.digest = digest(record.value);
  await ref("shiftMembershipState", "d").set(record);
  const before = await snapshot();
  await assert.rejects(reconcile("d"), {code: "membership_admission_evidence_required"});
  assert.deepEqual(await snapshot(), before);
});
