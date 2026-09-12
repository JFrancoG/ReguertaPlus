"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
process.env.GCLOUD_PROJECT = "demo-reguerta-hu084-coverage";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8798";
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {fixture, fairnessSnapshot} = require("./shift-planning-activation-fixture.cjs");
const {planShiftMembershipAdmission: plan} = require("../lib/shift-membership-planning.js");
const {planMarketShifts} = require("../lib/market-shift-planner.js");

const {admissionSnapshot, recordFor, reserveFor, inputFor} = require("./shift-membership-planning-fixture.cjs");

test("new-round admission retains order, appends re-entry/new members by FIFO then UID and preserves inputs", () => {
  const snapshot = admissionSnapshot(); const before = structuredClone(snapshot);
  const result = plan(inputFor(snapshot));
  assert.deepEqual(result.cohorts.delivery, ["member-3", "member-4", "member-5", "member-6", "member-1", "member-7"]);
  assert.deepEqual(result.cohorts.market, ["member-3", "member-6", "member-5", "member-4", "member-1", "member-7"]);
  assert.equal(result.changes.length, 3);
  assert.ok(result.changes.every((change) => change.after.value.revision === 4 && !change.after.value.pendingQueueTransition));
  assert.deepEqual(snapshot, before);
});

test("combined seasonal candidate binds membership acknowledgements and publishes complete market groups", () => {
  const snapshot = admissionSnapshot(); const value = fixture(snapshot);
  const planned = value.liveResult;
  assert.deepEqual(planned.delivery.nextRotation.cohortUserIds, plan(inputFor(snapshot)).cohorts.delivery);
  assert.deepEqual(planned.market.nextRotation.cohortUserIds, plan(inputFor(snapshot)).cohorts.market);
  assert.ok(planned.market.shifts.every((shift) => new Set(shift.assignedUserIds).size === 3));
  const changes = planned.manifests.forward.creditPublication.changes;
  assert.equal(changes.length, 3);
  assert.equal(planned.budgets.forward.creditLedgerWrites, 3);
  assert.equal(planned.budgets.inverse.creditLedgerWrites, 3);
  assert.throws(() => fixture(snapshot, {transactionWriteLimit: planned.budgets.forward.totalWrites - 1}),
    {code: "planning_bundle_oversize"});
});

test("public/frozen rounds, missing reserve evidence and unreconciled departures cannot be silently replanned", () => {
  for (const kind of ["partial", "published", "admissionFloor", "missingReserve", "futureReserve", "missingPerType", "unobservedDeparture", "changedRole"]) {
    const snapshot = admissionSnapshot(); const input = inputFor(snapshot);
    let code;
    if (kind === "partial") { input.rotations.market.nextMemberIndex = 1; code = "membership_frozen_unit_required"; }
    if (kind === "published") { input.frozenThroughRound.market = 1; code = "membership_frozen_unit_required"; }
    if (kind === "admissionFloor") {
      const entry = input.source.records[0]; entry.data.value.admissionAfterRound.delivery = 1;
      entry.data.digest = digest(entry.data.value); code = "membership_frozen_unit_required";
    }
    if (kind === "missingReserve") { input.source.reserves.pop(); code = "membership_reserve_evidence_required"; }
    if (kind === "futureReserve") { input.source.reserves[0].data.enteredAtMillis = 11; code = "membership_reserve_evidence_required"; }
    if (kind === "missingPerType") {
      delete input.source.records[0].data.value.admissionRequired;
      input.source.records[0].data.digest = digest(input.source.records[0].data.value); code = "membership_admission_evidence_required";
    }
    if (kind === "unobservedDeparture") { snapshot.roster[2].isActive = false; code = "membership_source_not_reconciled"; }
    if (kind === "changedRole") { snapshot.roster[0].isCommonPurchaseManager = true; code = "membership_source_not_reconciled"; }
    const before = structuredClone(input);
    assert.throws(() => plan(input), {code}); assert.deepEqual(input, before);
  }
});

test("insufficient replacement cohort rejects the combined plan without acknowledging departures", () => {
  const snapshot = admissionSnapshot();
  for (const member of snapshot.roster.slice(2, 6)) {
    member.isActive = false;
    snapshot.creditLedger.sources.membership.records.push(recordFor(member, false));
  }
  const before = structuredClone(snapshot);
  assert.throws(() => fixture(snapshot), {code: "membership_unit_unstaffable"});
  assert.deepEqual(snapshot, before);
});

test("per-type admission never moves an existing delivery member just because market requires entry", () => {
  const snapshot = admissionSnapshot();
  const entry = snapshot.creditLedger.sources.membership.records[0];
  entry.data.value.admissionRequired.delivery = false; entry.data.digest = digest(entry.data.value);
  const result = plan(inputFor(snapshot));
  assert.equal(result.cohorts.delivery[0], "member-1");
  assert.equal(result.cohorts.market.at(-2), "member-1");
});

test("new-cohort seasonal overflow remains valid carryover for the next seasonal frontier", () => {
  const snapshot = admissionSnapshot();
  // Seven eligible members force a market group across the round boundary.
  snapshot.roster.push({...snapshot.roster[2], isActive: true, userId: "member-8"});
  const source = snapshot.creditLedger.sources.membership;
  source.records.push(recordFor(snapshot.roster.at(-1), true, 0, 20));
  source.reserves.push(...["delivery", "market"].map((type) => reserveFor("member-8", type, 20)));
  const value = fixture(snapshot); const market = value.liveResult.market;
  const overflow = market.shifts.slice(10);
  assert.ok(overflow.length > 0);
  const inheritedTargetPrefix = {dates: overflow.map((shift) => shift.date),
    positions: overflow.flatMap((shift) => shift.rotationPositions),
    rotationBeforePrefix: market.cursorAtTargetBoundary, lineageRevision: "admitted", lineageDigest: digest("admitted")};
  const next = planMarketShifts({planningRequestId: "next", targetSeasonStartYear: 2027,
    rotation: market.nextRotation, inheritedTargetPrefix,
    provisionalCredits: {credits: [], frozenThroughRound: market.nextRotation.roundNumber,
      inheritedUnits: market.creditProjection.units.slice(10).map((unit) => unit.servedPositions)}});
  assert.ok(next.shifts.every((shift) => new Set(shift.assignedUserIds).size === 3));
  assert.deepEqual(next.nextRotation.cohortUserIds, market.nextRotation.cohortUserIds);
});

test("admission changes only the prospective delivery helper and rejects an equal adjacent lead", () => {
  const {planDeliveryShifts} = require("../lib/delivery-shift-planner.js");
  const snapshot = admissionSnapshot(); const admission = plan(inputFor(snapshot));
  const predecessor = {shiftId: "prior", scheduledDate: "2026-08-27", effectiveLeadUserId: "member-6",
    completion: {state: "uncompleted", assignmentRevision: 4, completionRevision: 0, plannedHelperUserId: "member-1"}};
  const input = {planningRequestId: "admission", targetSeasonStartYear: 2026, deliveryWeekday: "THU",
    rotation: snapshot.rotations.delivery.cursor, continuity: {kind: "persistedAppend", predecessor},
    provisionalCredits: {credits: [], frozenThroughRound: 0, cohortAtStart: admission.cohorts.delivery}};
  const result = planDeliveryShifts(input);
  assert.equal(result.shifts[0].rotationOwnerUserId, "member-3");
  assert.deepEqual(result.predecessorHelperUpdate, {shiftId: "prior", helperUserId: "member-3"});
  const completed = structuredClone(input);
  completed.continuity.predecessor.completion = {state: "completed", assignmentRevision: 4, completionRevision: 1,
    actualHelperUserId: "member-1", helperSourceAssignmentRevision: 4, completedAtMillis: 10};
  const completedResult = planDeliveryShifts(completed);
  assert.equal(completedResult.predecessorHelperUpdate, null);
  assert.equal(completedResult.predecessorGuard.expectedActualHelperUserId, "member-1");
  const impossible = structuredClone(input); impossible.continuity.predecessor.effectiveLeadUserId = "member-3";
  assert.throws(() => planDeliveryShifts(impossible), {code: "credit_unit_unstaffable"});
});
