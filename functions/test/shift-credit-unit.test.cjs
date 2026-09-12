"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {planShiftCreditUnit: plan} = require("../lib/shift-credit-unit.js");
const {consumeRotationPositions} = require("../lib/shift-planning-contract.js");
const rotation = (type, cohortUserIds, nextMemberIndex = 0) =>
  ({schemaVersion: 1, type, cohortUserIds, roundNumber: 1, nextMemberIndex});
const credit = (userId, type = "market") => ({schemaVersion: 1, policyRevision: "hu084-provisional-v1",
  id: `credit-${userId}`, caseId: `credit-${userId}`, shiftId: "past", type, userId, state: "pending",
  earnedAtMillis: 1, completionRevision: 1});
const input = (type, ids, credited = ids, extra = {}) => ({rotation: rotation(type, ids),
  credits: credited.map((id) => credit(id, type)), frozenThroughRound: 0, adjacentDeliveryUserIds: [], ...extra});

test("credits serve queue positions but never occupy a physical market place", () => {
  const source = input("market", ["a", "b", "c", "d", "e"], ["a", "b"]);
  const original = structuredClone(source);
  const unit = plan(source);
  assert.deepEqual(unit.assignments.map((p) => p.rotationOwnerUserId), ["c", "d", "e"]);
  assert.deepEqual(unit.consumedCreditIds, ["credit-a", "credit-b"]);
  assert.equal(unit.servedPositions.length, 5);
  assert.equal(unit.nextRotation.roundNumber, 2);
  assert.deepEqual(source, original);
});

test("minimum market cohort restores credits in reverse order and staffs all three places", () => {
  const unit = plan(input("market", ["a", "b", "c"]));
  assert.deepEqual(unit.assignments.map((p) => p.rotationOwnerUserId), ["a", "b", "c"]);
  assert.deepEqual(unit.consumedCreditIds, []);
  assert.deepEqual(unit.deferredCreditIds, ["credit-a", "credit-b", "credit-c"]);
  const larger = plan(input("market", ["a", "b", "c", "d"]));
  assert.deepEqual(larger.consumedCreditIds, ["credit-a"]);
  assert.deepEqual(larger.assignments.map((p) => p.rotationOwnerUserId), ["b", "c", "d"]);
});

test("delivery defers credit if its filler is adjacent, and blocks impossible units without skipping owners", () => {
  const source = input("delivery", ["a", "b"], ["a"], {adjacentDeliveryUserIds: ["b"]});
  const unit = plan(source);
  assert.deepEqual(unit.consumedCreditIds, []);
  assert.deepEqual(unit.deferredCreditIds, ["credit-a"]);
  assert.equal(unit.assignments[0].rotationOwnerUserId, "a");
  assert.throws(() => plan({...source, adjacentDeliveryUserIds: ["a", "b"]}), {code: "credit_unit_unstaffable"});
});

test("frozen rounds retain credits, wrap keeps fairness, and malformed same-type ledgers reject", () => {
  const source = input("market", ["a", "b", "c", "d"], ["a"]);
  const frozen = plan({...source, frozenThroughRound: 1});
  assert.deepEqual(frozen.consumedCreditIds, []);
  assert.deepEqual(frozen.assignments.map((p) => p.rotationOwnerUserId), ["a", "b", "c"]);
  const wrap = plan(input("delivery", ["a", "b"], ["b"], {rotation: rotation("delivery", ["a", "b"], 1)}));
  assert.equal(wrap.assignments[0].rotationOwnerUserId, "a");
  assert.equal(wrap.assignments[0].roundNumber, 2);
  assert.throws(() => plan({...source, credits: [credit("a"), {...credit("a"), id: "second", caseId: "second"}]}),
    {code: "duplicate_pending_coverage_credit"});
  assert.throws(() => plan({...source, credits: [credit("a", "delivery")]}), {code: "invalid_credit_unit_ledger"});
});

test("all small-cohort credit combinations preserve staffing, resting exclusion and canonical cursor traversal", () => {
  for (const type of ["delivery", "market"]) {
    for (let count = type === "market" ? 3 : 2; count <= 6; count++) {
      const ids = Array.from({length: count}, (_, i) => `user-${i}`);
      for (let mask = 0; mask < 2 ** count; mask++) {
        for (let start = 0; start < count; start++) {
          const credited = ids.filter((_, i) => mask & (1 << i));
          const source = input(type, ids, credited, {rotation: rotation(type, ids, start)});
          const unit = plan(source);
          const assigned = unit.assignments.map((p) => p.rotationOwnerUserId);
          assert.equal(assigned.length, type === "market" ? 3 : 1);
          assert.equal(new Set(assigned).size, assigned.length);
          assert.equal(new Set(unit.consumedCreditIds).size, unit.consumedCreditIds.length);
          for (const id of assigned) assert.equal(unit.consumedCreditIds.includes(`credit-${id}`), false);
          const normal = consumeRotationPositions(source.rotation, unit.servedPositions.length);
          assert.deepEqual(unit.nextRotation, normal.nextRotation);
          assert.deepEqual(unit.servedPositions.map(({creditId, ...p}) => p), normal.positions);
          assert.ok(unit.consumedCreditIds.every((id) => credited.some((user) => id === `credit-${user}`)));
        }
      }
    }
  }
});
