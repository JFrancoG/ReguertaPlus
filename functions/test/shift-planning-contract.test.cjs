const assert = require("node:assert/strict");
const {test} = require("node:test");

const {
  consumeRotationPositions,
} = require("../lib/shift-planning-contract.js");

test("consumes a persisted rotation without repeating before round completion", () => {
  const result = consumeRotationPositions({
    schemaVersion: 1,
    type: "delivery",
    cohortUserIds: ["a", "b", "c"],
    roundNumber: 2,
    nextMemberIndex: 1,
  }, 5);

  assert.deepEqual(result.positions.map((position) => ({
    owner: position.rotationOwnerUserId,
    round: position.roundNumber,
    index: position.positionInRound,
  })), [
    {owner: "b", round: 2, index: 2},
    {owner: "c", round: 2, index: 3},
    {owner: "a", round: 3, index: 1},
    {owner: "b", round: 3, index: 2},
    {owner: "c", round: 3, index: 3},
  ]);
  assert.deepEqual(result.nextRotation, {
    schemaVersion: 1,
    type: "delivery",
    cohortUserIds: ["a", "b", "c"],
    roundNumber: 4,
    nextMemberIndex: 0,
  });
});

test("rejects ambiguous cohorts and invalid cursors", () => {
  const base = {
    schemaVersion: 1,
    type: "market",
    cohortUserIds: ["a", "b", "c"],
    roundNumber: 1,
    nextMemberIndex: 0,
  };
  assert.throws(
    () => consumeRotationPositions({...base, cohortUserIds: ["a", "a", "c"]}, 1),
    (error) => error.code === "invalid_rotation_cohort",
  );
  assert.throws(
    () => consumeRotationPositions({...base, nextMemberIndex: 3}, 1),
    (error) => error.code === "invalid_rotation_cursor",
  );
  assert.throws(
    () => consumeRotationPositions({...base, type: "unknown"}, 1),
    (error) => error.code === "invalid_rotation_type",
  );
  assert.throws(
    () => consumeRotationPositions(base, -1),
    (error) => error.code === "invalid_rotation_position_count",
  );
});
