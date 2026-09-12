"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {planDeliveryShifts} = require("../lib/delivery-shift-planner.js");
const {planMarketShifts} = require("../lib/market-shift-planner.js");
const {planShiftSeasonCreditUnits, buildShiftSeasonCreditChanges} = require("../lib/shift-credit-season.js");
const {consumeRotationPositions} = require("../lib/shift-planning-contract.js");
const rotation = (type, count, nextMemberIndex = 0, roundNumber = 1) => ({schemaVersion: 1,
  type, cohortUserIds: Array.from({length: count}, (_, i) => `member-${i}`), roundNumber, nextMemberIndex});
const credit = (userId, type) => ({schemaVersion: 1, policyRevision: "hu084-provisional-v1",
  id: `credit-${userId}`, caseId: `credit-${userId}`, shiftId: "past", type, userId,
  state: "pending", earnedAtMillis: 1, completionRevision: 1});
const policy = (cursor, members = cursor.cohortUserIds, frozenThroughRound = 0) => ({
  credits: members.map((id) => credit(id, cursor.type)), frozenThroughRound});
const delivery = (cursor, provisionalCredits) => ({planningRequestId: "season-delivery",
  targetSeasonStartYear: 2026, deliveryWeekday: "WED", rotation: cursor,
  continuity: {kind: "newRotation"}, ...(provisionalCredits ? {provisionalCredits} : {})});
const market = (cursor, provisionalCredits) => ({planningRequestId: "season-market",
  targetSeasonStartYear: 2026, rotation: cursor, ...(provisionalCredits ? {provisionalCredits} : {})});
const withoutProjection = ({creditProjection, ...plan}) => plan;

const assertTraversal = (initial, projection, final) => {
  const served = projection.units.flatMap((unit) => unit.servedPositions);
  const ordinary = consumeRotationPositions(initial, served.length);
  assert.deepEqual(served.map(({creditId, ...position}) => position), ordinary.positions);
  assert.deepEqual(final, ordinary.nextRotation);
  const used = served.filter((p) => p.creditId !== null).map((p) => p.creditId);
  assert.deepEqual(used, projection.consumedCreditIds);
  assert.equal(new Set(used).size, used.length);
  for (const unit of projection.units) {
    assert.equal(unit.assignments.length, initial.type === "delivery" ? 1 : 3);
    const working = unit.assignments.map((p) => p.rotationOwnerUserId);
    assert.equal(new Set(working).size, working.length);
    for (const position of unit.servedPositions.filter((p) => p.creditId !== null)) {
      assert.equal(working.includes(position.rotationOwnerUserId), false);
    }
  }
};

test("empty-credit seasonal plans are identical to both existing planners including boundary padding", () => {
  for (const type of ["delivery", "market"]) {
    for (let size = type === "market" ? 3 : 2; size <= 35; size++) {
      const cursor = rotation(type, size);
      const plan = type === "delivery" ? planDeliveryShifts : planMarketShifts;
      const input = type === "delivery" ? delivery : market;
      const ordinary = plan(input(cursor));
      const credited = plan(input(cursor, policy(cursor, [])));
      assert.deepEqual(withoutProjection(credited), ordinary);
      assertTraversal(cursor, credited.creditProjection, credited.nextRotation);
    }
  }
});

test("delivery credits fill a season, preserve helper succession and close the actual served round", () => {
  const cursor = rotation("delivery", 7);
  const input = delivery(cursor, policy(cursor, ["member-0", "member-1", "member-6"]));
  const before = structuredClone(input);
  const plan = planDeliveryShifts(input);
  assert.equal(plan.generatedTargetShiftCount, 52);
  assert.deepEqual(plan.shifts.slice(0, 3).map((s) => s.rotationOwnerUserId), ["member-2", "member-3", "member-4"]);
  assert.equal(plan.creditProjection.consumedCreditIds.length, 3);
  assert.equal(plan.nextRotation.nextMemberIndex, 0);
  for (let i = 0; i < plan.shifts.length - 1; i++) {
    assert.equal(plan.shifts[i].helperUserId, plan.shifts[i + 1].assignedUserIds[0]);
    assert.notEqual(plan.shifts[i].assignedUserIds[0], plan.shifts[i + 1].assignedUserIds[0]);
  }
  assertTraversal(cursor, plan.creditProjection, plan.nextRotation);
  assert.deepEqual(input, before);
});

test("market credits move ownership positions without removing any of the ten physical markets", () => {
  const cursor = rotation("market", 8);
  const plan = planMarketShifts(market(cursor, policy(cursor)));
  assert.equal(plan.generatedTargetPositionCount, 30);
  assert.equal(plan.shifts.filter((s) => s.projectionSeasonStartYear === 2026).length, 10);
  assert.deepEqual(plan.shifts[0].assignedUserIds, ["member-5", "member-6", "member-7"]);
  assert.equal(plan.creditProjection.consumedCreditIds.length, 8);
  assertTraversal(cursor, plan.creditProjection, plan.nextRotation);
  for (const shift of plan.shifts) assert.equal(new Set(shift.assignedUserIds).size, 3);
});

test("frozen credits retry in later rounds; minimum delivery and market cohorts remain staffed", () => {
  const cursor = rotation("market", 4);
  const plan = planMarketShifts(market(cursor, policy(cursor, ["member-0"], 1)));
  const resting = plan.creditProjection.units.flatMap((u) => u.servedPositions).find((p) => p.creditId !== null);
  assert.equal(resting.roundNumber, 2);
  for (const type of ["market", "delivery"]) {
    const minimum = rotation(type, type === "market" ? 3 : 2);
    const result = planShiftSeasonCreditUnits({rotation: minimum, targetUnitCount: 12,
      policy: policy(minimum), previousDeliveryUserId: type === "delivery" ? "member-1" : null});
    assert.deepEqual(result.projection.consumedCreditIds, []);
    assertTraversal(minimum, result.projection, result.nextRotation);
  }
});

test("last delivery owner cannot create a new-round physical slot just to redeem a credit", () => {
  const cursor = rotation("delivery", 4);
  const result = planShiftSeasonCreditUnits({rotation: cursor, targetUnitCount: 1,
    policy: policy(cursor, ["member-3"])});
  assert.equal(result.projection.units.length, 4);
  assert.deepEqual(result.projection.consumedCreditIds, []);
  assert.deepEqual(result.projection.units.at(-1).deferredCreditIds, ["credit-member-3"]);
  assert.equal(result.nextRotation.roundNumber, 2);
  assert.equal(result.nextRotation.nextMemberIndex, 0);
});

test("credits recompute prospective helper, preserve completed history and reject stale cursor evidence", () => {
  const cursor = rotation("delivery", 4);
  const predecessor = {shiftId: "prior", scheduledDate: "2026-08-26", effectiveLeadUserId: "member-3",
    completion: {state: "uncompleted", assignmentRevision: 4, completionRevision: 0,
      plannedHelperUserId: "member-0"}};
  const input = {...delivery(cursor, policy(cursor, ["member-0"])),
    continuity: {kind: "persistedAppend", predecessor}};
  const pinned = planDeliveryShifts(input);
  assert.equal(pinned.shifts[0].rotationOwnerUserId, "member-1");
  assert.deepEqual(pinned.predecessorHelperUpdate, {shiftId: "prior", helperUserId: "member-1"});
  assert.equal(pinned.creditProjection.units.find((u) => u.consumedCreditIds.length).servedPositions[0].roundNumber, 1);
  const stale = structuredClone(input);
  stale.continuity.predecessor.completion.plannedHelperUserId = "member-2";
  assert.throws(() => planDeliveryShifts(stale), {code: "delivery_helper_cursor_conflict"});
  const completed = {...predecessor, completion: {state: "completed", assignmentRevision: 4,
    completionRevision: 1, actualHelperUserId: "member-0", helperSourceAssignmentRevision: 4,
    completedAtMillis: 10}};
  const completedPlan = planDeliveryShifts({...input, continuity: {kind: "persistedAppend", predecessor: completed}});
  assert.equal(completedPlan.shifts[0].rotationOwnerUserId, "member-1");
  assert.equal(completedPlan.predecessorHelperUpdate, null);
  assert.equal(completedPlan.predecessorGuard.expectedActualHelperUserId, "member-0");
});

const carriedMarket = () => {
  const initial = rotation("market", 7);
  const credits = policy(initial, [], 0);
  // Credits first become eligible in the overflow of round 5.
  credits.credits = [credit("member-5", "market"), credit("member-6", "market")];
  credits.frozenThroughRound = 4;
  const first = planMarketShifts(market(initial, credits));
  const offset = 10;
  const carry = first.shifts.slice(offset);
  const units = first.creditProjection.units.slice(offset);
  assert.ok(carry.length > 0);
  assert.ok(units.some((u) => u.consumedCreditIds.length));
  const changes = buildShiftSeasonCreditChanges({projection: first.creditProjection,
    credits: credits.credits, planId: "first-season", activatedAtMillis: 2});
  const ledger = credits.credits.map((c) => changes.find((change) => change.id === c.id)?.after ?? c);
  return {first, input: {planningRequestId: "next-season", targetSeasonStartYear: 2027,
    rotation: first.nextRotation, inheritedTargetPrefix: {
      dates: carry.map((s) => s.date), positions: carry.flatMap((s) => s.rotationPositions),
      rotationBeforePrefix: first.cursorAtTargetBoundary, lineageRevision: "first-season",
      lineageDigest: "first-season-digest"}, provisionalCredits: {credits: ledger,
      frozenThroughRound: Math.max(...units.flatMap((u) => u.servedPositions.map((p) => p.roundNumber))),
      inheritedUnits: units.map((u) => u.servedPositions)}}};
};

test("credited market carryover proves served lineage across two seasons without duplicating credits", () => {
  const {input} = carriedMarket();
  const next = planMarketShifts(input);
  assert.equal(next.shifts[0].date > input.inheritedTargetPrefix.dates.at(-1), true);
  assertTraversal(input.rotation, next.creditProjection, next.nextRotation);
  assert.deepEqual(next.creditProjection.consumedCreditIds, []);
  assert.throws(() => planMarketShifts({...input, provisionalCredits: undefined}),
    {code: "invalid_inherited_rotation_lineage"});
  const lost = structuredClone(input);
  lost.provisionalCredits.inheritedUnits[0].shift();
  assert.throws(() => planMarketShifts(lost), {code: "invalid_inherited_rotation_lineage"});
  const pending = structuredClone(input);
  pending.provisionalCredits.credits = pending.provisionalCredits.credits.map((c) => credit(c.userId, c.type));
  assert.throws(() => planMarketShifts(pending), {code: "credit_prefix_ledger_changed"});
  const thawed = structuredClone(input);
  thawed.provisionalCredits.frozenThroughRound = 0;
  assert.throws(() => planMarketShifts(thawed), {code: "credit_prefix_not_frozen"});
});

test("seasonal forward/inverse credit images bind the full ledger including deferred and unrelated members", () => {
  const cursor = rotation("market", 4);
  const source = policy(cursor, ["member-0", "outside"]);
  const plan = planMarketShifts(market(cursor, source));
  const changes = buildShiftSeasonCreditChanges({projection: plan.creditProjection,
    credits: source.credits, planId: "activation", activatedAtMillis: 10});
  assert.equal(changes.length, 1);
  assert.deepEqual(changes[0].before, source.credits[0]);
  assert.equal(changes[0].after.state, "consumed");
  assert.equal(changes[0].after.consumedByPlanId, "activation");
  assert.equal(source.credits[0].state, "pending");
  assert.throws(() => buildShiftSeasonCreditChanges({projection: plan.creditProjection,
    credits: source.credits.slice(0, 1), planId: "activation", activatedAtMillis: 10}), {code: "credit_plan_source_changed"});
  assert.throws(() => buildShiftSeasonCreditChanges({projection: plan.creditProjection,
    credits: source.credits, planId: "activation", activatedAtMillis: 0}), {code: "invalid_coverage_credit"});
});

test("small seasonal cohorts and every credit subset retain unique staffing and exact queue traversal", () => {
  for (const type of ["delivery", "market"]) {
    for (let count = type === "market" ? 3 : 2; count <= 7; count++) {
      const cursor = rotation(type, count);
      for (let mask = 0; mask < 2 ** count; mask++) {
        const source = policy(cursor, cursor.cohortUserIds.filter((_, i) => mask & (1 << i)));
        const result = planShiftSeasonCreditUnits({rotation: cursor, targetUnitCount: type === "market" ? 10 : 52,
          policy: source, previousDeliveryUserId: type === "delivery" ? cursor.cohortUserIds.at(-1) : null});
        assertTraversal(cursor, result.projection, result.nextRotation);
        if (type === "delivery") {
          const leads = [cursor.cohortUserIds.at(-1), ...result.projection.units.map((u) => u.assignments[0].rotationOwnerUserId)];
          for (let i = 1; i < leads.length; i++) assert.notEqual(leads[i - 1], leads[i]);
          assert.equal(result.nextRotation.nextMemberIndex, 0);
        }
      }
    }
  }
});

test("delivery carryover retains credited owner positions and resumes the following season", () => {
  const cursor = rotation("delivery", 7);
  const source = policy(cursor, ["member-5"], 7);
  const first = planDeliveryShifts(delivery(cursor, source));
  const carry = first.shifts.slice(first.generatedTargetShiftCount);
  const units = first.creditProjection.units.slice(first.generatedTargetShiftCount);
  assert.ok(units.some((u) => u.consumedCreditIds.length));
  const changes = buildShiftSeasonCreditChanges({projection: first.creditProjection,
    credits: source.credits, planId: "delivery-activation", activatedAtMillis: 2});
  const last = carry.at(-1);
  const next = planDeliveryShifts({planningRequestId: "following-delivery", targetSeasonStartYear: 2027,
    deliveryWeekday: "WED", rotation: first.nextRotation, inheritedTargetPrefix: {
      dates: carry.map((s) => s.date), positions: carry.map((s) => ({rotationOwnerUserId: s.rotationOwnerUserId,
        roundNumber: s.roundNumber, positionInRound: s.positionInRound})),
      rotationBeforePrefix: first.cursorAtTargetBoundary, lineageRevision: "delivery-activation", lineageDigest: "bound"},
    provisionalCredits: {credits: changes.map((c) => c.after), frozenThroughRound: 8,
      inheritedUnits: units.map((u) => u.servedPositions)}, continuity: {kind: "persistedAppend",
      predecessor: {shiftId: "previous", scheduledDate: last.date, effectiveLeadUserId: last.assignedUserIds[0],
        completion: {state: "uncompleted", assignmentRevision: 1, completionRevision: 0, plannedHelperUserId: null}}}});
  assert.equal(next.shifts[0].date, "2027-09-22");
  assert.equal(next.shifts[0].rotationOwnerUserId, "member-0");
  assert.deepEqual(next.creditProjection.consumedCreditIds, []);
  assert.deepEqual(next.predecessorHelperUpdate, {shiftId: "previous", helperUserId: "member-0"});
});

test("credit carryover rejects forged resting owners, reused credits and missing calendar evidence", () => {
  const {input} = carriedMarket();
  const wrong = structuredClone(input);
  const rest = wrong.provisionalCredits.inheritedUnits.flat().find((p) => p.creditId !== null);
  rest.creditId = "forged";
  assert.throws(() => planMarketShifts(wrong), {code: "credit_prefix_ledger_changed"});
  const reused = structuredClone(input);
  const rests = reused.provisionalCredits.inheritedUnits.flat().filter((p) => p.creditId !== null);
  assert.ok(rests.length > 1);
  rests[1].creditId = rests[0].creditId;
  assert.throws(() => planMarketShifts(reused), {code: "invalid_inherited_rotation_lineage"});
  const missing = structuredClone(input);
  delete missing.inheritedTargetPrefix;
  assert.throws(() => planMarketShifts(missing), {code: "invalid_inherited_rotation_lineage"});
});
