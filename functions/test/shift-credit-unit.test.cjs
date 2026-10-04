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

const membership = (cohortUserIds, excusedIds, reason = "excusedDeparture") => ({
  cohortUserIds, startRound: 2, publishedOwnerPositionKeys: [],
  excusedOwners: excusedIds.map((userId) => ({userId, reason, membershipRevision: 3}))});

test("a frozen market omission keeps its owner and credit while a full group crosses into the new cohort", () => {
  const source = input("market", ["a", "b", "c", "d"], ["b"], {
    rotation: rotation("market", ["a", "b", "c", "d"], 1), frozenThroughRound: 1,
    membership: membership(["a", "c", "d"], ["b"])});
  const before = structuredClone(source); const unit = plan(source);
  assert.deepEqual(unit.assignments.map((p) => p.rotationOwnerUserId), ["c", "d", "a"]);
  assert.deepEqual(unit.servedPositions[0], {rotationOwnerUserId: "b", roundNumber: 1, positionInRound: 2,
    creditId: null, excuse: {reason: "excusedDeparture", membershipRevision: 3}});
  assert.deepEqual(unit.servedPositions.at(-1).cohortStartUserIds, ["a", "c", "d"]);
  assert.deepEqual(unit.consumedCreditIds, []); assert.deepEqual(unit.deferredCreditIds, ["credit-b"]);
  assert.equal(unit.membershipApplied, true); assert.equal(unit.nextRotation.nextMemberIndex, 1);
  assert.deepEqual(source, before);
  source.membership.publishedOwnerPositionKeys = [JSON.stringify(["market", 1, 2, "b"])];
  assert.throws(() => plan(source), {code: "membership_position_already_published"});
});

test("the last departed delivery owner closes only with a real next-round slot and cannot leave an isolated omission", () => {
  const source = input("delivery", ["a", "b", "c", "d"], [], {
    rotation: rotation("delivery", ["a", "b", "c", "d"], 3), frozenThroughRound: 1,
    stopAfterRound: 1, membership: membership(["a", "b", "c"], ["d"], "excusedIneligible")});
  const unit = plan(source);
  assert.equal(unit.servedPositions[0].rotationOwnerUserId, "d");
  assert.equal(unit.servedPositions[0].excuse.reason, "excusedIneligible");
  assert.equal(unit.assignments[0].rotationOwnerUserId, "a");
  assert.equal(unit.assignments[0].roundNumber, 2);
  const impossible = {...source, adjacentDeliveryUserIds: ["a"]}; const before = structuredClone(impossible);
  assert.throws(() => plan(impossible), {code: "credit_unit_unstaffable"}); assert.deepEqual(impossible, before);
});

test("reactivation can work only its new position, and minimum cohorts reject incomplete replacements without mutation", () => {
  const unit = plan(input("market", ["a", "b", "c"], [], {
    rotation: rotation("market", ["a", "c", "b"], 2), frozenThroughRound: 1,
    membership: membership(["a", "c", "b"], ["b"])}));
  assert.deepEqual(unit.assignments.map((p) => p.rotationOwnerUserId), ["a", "c", "b"]);
  assert.equal(unit.assignments.at(-1).roundNumber, 2);
  for (const type of ["delivery", "market"]) {
    const ids = type === "delivery" ? ["a", "b"] : ["a", "b", "c"];
    const source = input(type, ids, [], {frozenThroughRound: 1, membership: membership(ids.slice(1), ["a"])});
    const before = structuredClone(source);
    assert.throws(() => plan(source), {code: "invalid_membership_unit_policy"}); assert.deepEqual(source, before);
  }
});

test("carryover replays an omission and cohort change inside a full market group and rejects forged lineage", () => {
  const {planShiftSeasonCreditUnits} = require("../lib/shift-credit-season.js");
  const {requireRotationProjectionPrefix: verify} = require("../lib/shift-planning-contract.js");
  const ids = "abcdefghij".split("");
  const result = planShiftSeasonCreditUnits({rotation: rotation("market", ids, 1), targetUnitCount: 1,
    policy: {credits: [], frozenThroughRound: 1, membership: membership(ids.slice(0, -1), ["j"])}});
  const units = result.projection.units.slice(1);
  const prefix = {dates: ["2027-09-01", "2027-10-01"], positions: units.flatMap((unit) => unit.assignments),
    rotationBeforePrefix: result.cursorAtTargetBoundary, lineageRevision: "revision", lineageDigest: "digest"};
  assert.deepEqual(units.at(-1).assignments.map((p) => p.rotationOwnerUserId), ["h", "i", "a"]);
  verify(prefix, result.nextRotation, 3, units.map((unit) => unit.servedPositions));
  for (const kind of ["missingCohort", "creditedExcuse", "trailingExcuse", "invalidReason"]) {
    const evidence = structuredClone(units.map((unit) => unit.servedPositions));
    const last = evidence.at(-1); const omitted = last.find((p) => p.excuse);
    if (kind === "missingCohort") delete last.at(-1).cohortStartUserIds;
    if (kind === "creditedExcuse") omitted.creditId = "false-credit";
    if (kind === "trailingExcuse") last.push(omitted);
    if (kind === "invalidReason") omitted.excuse.reason = "no-show";
    assert.throws(() => verify(prefix, result.nextRotation, 3, evidence), {code: "invalid_inherited_rotation_lineage"});
  }
});
