const assert = require("node:assert/strict");
const {test} = require("node:test");

const {
  planMarketShifts,
} = require("../lib/market-shift-planner.js");
const {
  buildMarketSeasonDates,
} = require("../lib/shift-planning-calendar.js");
const {
  consumeRotationPositions,
} = require("../lib/shift-planning-contract.js");

const marketRotation = (count, nextMemberIndex = 0, roundNumber = 1) => ({
  schemaVersion: 1,
  type: "market",
  cohortUserIds: Array.from({length: count}, (_, index) => `member-${index + 1}`),
  roundNumber,
  nextMemberIndex,
});

test("materializes the expected market boundary for N=3/4/29/30/31", () => {
  const expectedEventCounts = new Map([
    [3, 10],
    [4, 11],
    [29, 20],
    [30, 10],
    [31, 11],
  ]);
  for (const [count, expectedEventCount] of expectedEventCounts) {
    const plan = planMarketShifts({
      planningRequestId: `market-${count}`,
      targetSeasonStartYear: 2026,
      rotation: marketRotation(count),
    });
    assert.equal(plan.targetSeasonPositionCount, 30);
    assert.equal(plan.shifts.length, expectedEventCount);
    assert.equal(plan.shifts.slice(0, 10).flatMap((shift) => shift.assignedUserIds).length, 30);
    assert.equal(plan.shifts.every((shift) =>
      shift.assignedUserIds.length === 3 &&
      new Set(shift.assignedUserIds).size === 3
    ), true);
  }
});

test("continues N=29 and N=31 without losing or duplicating a round position", () => {
  const twentyNine = planMarketShifts({
    planningRequestId: "market-29",
    targetSeasonStartYear: 2026,
    rotation: marketRotation(29),
  });
  assert.deepEqual(twentyNine.shifts[10].assignedUserIds, [
    "member-2",
    "member-3",
    "member-4",
  ]);
  assert.deepEqual(twentyNine.shifts.at(-1).assignedUserIds, [
    "member-29",
    "member-1",
    "member-2",
  ]);

  const thirtyOne = planMarketShifts({
    planningRequestId: "market-31",
    targetSeasonStartYear: 2026,
    rotation: marketRotation(31),
  });
  assert.deepEqual(thirtyOne.shifts[10].assignedUserIds, [
    "member-31",
    "member-1",
    "member-2",
  ]);
});

test("preserves a prefilled target prefix", () => {
  const plan = planMarketShifts({
    planningRequestId: "market-prefix",
    targetSeasonStartYear: 2026,
    inheritedTargetPrefix: {
      dates: ["2026-09-19", "2026-10-17"],
      positions: [
        {rotationOwnerUserId: "member-1", roundNumber: 1, positionInRound: 1},
        {rotationOwnerUserId: "member-2", roundNumber: 1, positionInRound: 2},
        {rotationOwnerUserId: "member-3", roundNumber: 1, positionInRound: 3},
        {rotationOwnerUserId: "member-4", roundNumber: 1, positionInRound: 4},
        {rotationOwnerUserId: "member-1", roundNumber: 2, positionInRound: 1},
        {rotationOwnerUserId: "member-2", roundNumber: 2, positionInRound: 2},
      ],
      rotationBeforePrefix: marketRotation(4),
      lineageRevision: "baseline-1",
      lineageDigest: "digest-1",
    },
    rotation: marketRotation(4, 2, 2),
  });
  assert.equal(plan.shifts[0].date, "2026-11-21");
  assert.equal(plan.shifts.filter((shift) => shift.projectionSeasonStartYear === 2026).length, 8);
});

test("materializes large boundary rounds across multiple future projections", () => {
  const plan = planMarketShifts({
    planningRequestId: "market-100",
    targetSeasonStartYear: 2026,
    rotation: marketRotation(100),
  });
  assert.equal(plan.shifts.length, 34);
  assert.deepEqual(plan.affectedProjectionSeasonStartYears, [2026, 2027, 2028, 2029]);
  assert.equal(plan.shifts.at(-1).projectionSeasonStartYear, 2029);
});

test("uses the third Saturday from September through June", () => {
  const plan = planMarketShifts({
    planningRequestId: "market-calendar",
    targetSeasonStartYear: 2026,
    rotation: marketRotation(30),
  });
  assert.deepEqual(plan.shifts.map((shift) => shift.date), [
    "2026-09-19",
    "2026-10-17",
    "2026-11-21",
    "2026-12-19",
    "2027-01-16",
    "2027-02-20",
    "2027-03-20",
    "2027-04-17",
    "2027-05-15",
    "2027-06-19",
  ]);
});

test("fails closed with fewer than three selectable members", () => {
  assert.throws(() => planMarketShifts({
    planningRequestId: "market-two",
    targetSeasonStartYear: 2026,
    rotation: marketRotation(2),
  }), (error) => error.code === "insufficient_market_members");
});

test("matches a reference continuous queue for cohorts N=3 through N=200", () => {
  for (let count = 3; count <= 200; count += 1) {
    const plan = planMarketShifts({
      planningRequestId: `market-property-${count}`,
      targetSeasonStartYear: 2026,
      rotation: marketRotation(count),
    });
    const flattened = plan.shifts.flatMap((shift) => shift.rotationOwnerUserIds);
    const expected = Array.from(
      {length: flattened.length},
      (_, index) => `member-${(index % count) + 1}`,
    );
    assert.deepEqual(flattened, expected);
    assert.equal(plan.shifts.every((shift) =>
      shift.source === "app" &&
      shift.origin === "planner" &&
      new Set(shift.assignedUserIds).size === 3
    ), true);

    const indexAtBoundary = 30 % count;
    const remainder = indexAtBoundary === 0 ? 0 : count - indexAtBoundary;
    const padding = remainder === 0 ? 0 : (3 - (remainder % 3)) % 3;
    assert.equal(flattened.length, 30 + remainder + padding);
  }
});

test("rejects a market prefix that does not lead to the supplied cursor", () => {
  assert.throws(() => planMarketShifts({
    planningRequestId: "market-lineage",
    targetSeasonStartYear: 2026,
    inheritedTargetPrefix: {
      dates: ["2026-09-19"],
      positions: [
        {rotationOwnerUserId: "member-1", roundNumber: 1, positionInRound: 1},
        {rotationOwnerUserId: "member-2", roundNumber: 1, positionInRound: 2},
        {rotationOwnerUserId: "member-3", roundNumber: 1, positionInRound: 3},
      ],
      rotationBeforePrefix: marketRotation(4),
      lineageRevision: "baseline-1",
      lineageDigest: "digest-1",
    },
    rotation: marketRotation(4),
  }), (error) => error.code === "invalid_inherited_rotation_lineage");
});

test("rejects a fully occupied market target even when its cursor is mid-round", () => {
  const dates = buildMarketSeasonDates(2026);
  const rotationBeforePrefix = marketRotation(4);
  const inherited = consumeRotationPositions(rotationBeforePrefix, 30);
  assert.throws(() => planMarketShifts({
    planningRequestId: "market-full-target-boundary",
    targetSeasonStartYear: 2026,
    inheritedTargetPrefix: {
      dates,
      positions: inherited.positions,
      rotationBeforePrefix,
      lineageRevision: "baseline-1",
      lineageDigest: "digest-1",
    },
    rotation: inherited.nextRotation,
  }), (error) => error.code === "planning_frontier_complete");
});

test("reports a complete market frontier when the target ends on a round boundary", () => {
  const dates = buildMarketSeasonDates(2026);
  const rotationBeforePrefix = marketRotation(3);
  const inherited = consumeRotationPositions(rotationBeforePrefix, 30);

  assert.throws(() => planMarketShifts({
    planningRequestId: "market-complete",
    targetSeasonStartYear: 2026,
    inheritedTargetPrefix: {
      dates,
      positions: inherited.positions,
      rotationBeforePrefix,
      lineageRevision: "baseline-1",
      lineageDigest: "digest-1",
    },
    rotation: inherited.nextRotation,
  }), (error) => error.code === "planning_frontier_complete");
});
