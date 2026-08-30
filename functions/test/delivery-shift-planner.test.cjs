const assert = require("node:assert/strict");
const {test} = require("node:test");

const {
  planDeliveryShifts,
} = require("../lib/delivery-shift-planner.js");
const {
  buildDeliverySeasonDates,
} = require("../lib/shift-planning-calendar.js");
const {
  consumeRotationPositions,
} = require("../lib/shift-planning-contract.js");

const deliveryRotation = (cohortUserIds, nextMemberIndex = 0, roundNumber = 1) => ({
  schemaVersion: 1,
  type: "delivery",
  cohortUserIds,
  roundNumber,
  nextMemberIndex,
});

test("fills delivery through August and completes the boundary round", () => {
  const cohort = Array.from({length: 30}, (_, index) => `member-${index + 1}`);
  const plan = planDeliveryShifts({
    planningRequestId: "delivery-2026",
    targetSeasonStartYear: 2026,
    deliveryWeekday: "WED",
    rotation: deliveryRotation(cohort),
    continuity: {kind: "newRotation"},
  });

  assert.equal(plan.targetSeasonShiftCount, 52);
  assert.equal(plan.shifts.length, 60);
  assert.equal(plan.shifts[0].date, "2026-09-02");
  assert.equal(plan.shifts[51].date, "2027-08-25");
  assert.equal(plan.shifts[52].date, "2027-09-01");
  assert.equal(plan.shifts.at(-1).date, "2027-10-20");
  assert.equal(plan.shifts[51].helperUserId, plan.shifts[52].assignedUserIds[0]);
  assert.deepEqual(plan.affectedProjectionSeasonStartYears, [2026, 2027]);
  assert.equal(plan.nextRotation.nextMemberIndex, 0);
  assert.equal(plan.shifts.every((shift) =>
    shift.source === "app" &&
    shift.origin === "planner" &&
    shift.planningRequestId === "delivery-2026"
  ), true);
});

test("preserves inherited carryover and links the historical predecessor", () => {
  const targetPrefix = [
    "2026-09-02",
    "2026-09-09",
    "2026-09-16",
    "2026-09-23",
    "2026-09-30",
    "2026-10-07",
  ];
  const cohort = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
  const plan = planDeliveryShifts({
    planningRequestId: "delivery-carryover",
    targetSeasonStartYear: 2026,
    deliveryWeekday: "WED",
    inheritedTargetPrefix: {
      dates: targetPrefix,
      positions: targetPrefix.map((_, index) => ({
        rotationOwnerUserId: cohort[index],
        roundNumber: 1,
        positionInRound: index + 1,
      })),
      rotationBeforePrefix: deliveryRotation(cohort),
      lineageRevision: "baseline-1",
      lineageDigest: "digest-1",
    },
    continuity: {
      kind: "legacyBootstrap",
      predecessor: {
        shiftId: "delivery-2026-10-07",
        scheduledDate: "2026-10-07",
        effectiveLeadUserId: "f",
        completion: {
          state: "uncompleted",
          assignmentRevision: 4,
          completionRevision: 0,
          plannedHelperUserId: null,
        },
      },
      helperEvidence: {
        kind: "unique",
        userId: "g",
        evidenceRevision: "legacy-1",
        evidenceDigest: "legacy-digest-1",
      },
    },
    rotation: deliveryRotation(cohort, 6),
  });

  assert.equal(plan.shifts[0].date, "2026-10-14");
  assert.equal(plan.shifts[0].rotationOwnerUserId, "g");
  assert.deepEqual(plan.predecessorHelperUpdate, {
    shiftId: "delivery-2026-10-07",
    helperUserId: "g",
  });
  assert.deepEqual(plan.predecessorGuard, {
    shiftId: "delivery-2026-10-07",
    expectedScheduledDate: "2026-10-07",
    expectedEffectiveLeadUserId: "f",
    expectedAssignmentRevision: 4,
    expectedCompletionRevision: 0,
    expectedCompletionState: "uncompleted",
    expectedPlannedHelperUserId: null,
    expectedActualHelperUserId: null,
    expectedHelperSourceAssignmentRevision: null,
    expectedCompletedAtMillis: null,
  });
  assert.equal(plan.shifts.some((shift) => targetPrefix.includes(shift.date)), false);
});

test("fails closed when helper evidence conflicts with the persisted cursor", () => {
  assert.throws(() => planDeliveryShifts({
    planningRequestId: "delivery-conflict",
    targetSeasonStartYear: 2026,
    deliveryWeekday: "WED",
    rotation: deliveryRotation(["a", "b", "c"]),
    continuity: {
      kind: "legacyBootstrap",
      predecessor: {
        shiftId: "legacy",
        scheduledDate: "2026-08-26",
        effectiveLeadUserId: "c",
        completion: {
          state: "uncompleted",
          assignmentRevision: 1,
          completionRevision: 0,
          plannedHelperUserId: "b",
        },
      },
      helperEvidence: {
        kind: "unique",
        userId: "b",
        evidenceRevision: "legacy-1",
        evidenceDigest: "legacy-digest-1",
      },
    },
  }), (error) => error.code === "delivery_helper_cursor_conflict");
});

test("fails closed for ambiguous or ineligible legacy helper evidence", () => {
  const predecessor = {
    shiftId: "legacy",
    scheduledDate: "2026-08-26",
    effectiveLeadUserId: "c",
    completion: {
      state: "uncompleted",
      assignmentRevision: 1,
      completionRevision: 0,
      plannedHelperUserId: null,
    },
  };
  const base = {
    planningRequestId: "delivery-evidence",
    targetSeasonStartYear: 2026,
    deliveryWeekday: "WED",
    rotation: deliveryRotation(["a", "b", "c"]),
  };
  assert.throws(() => planDeliveryShifts({
    ...base,
    continuity: {
      kind: "legacyBootstrap",
      predecessor,
      helperEvidence: {
        kind: "ambiguous",
        candidateUserIds: ["a", "b"],
        evidenceDigest: "legacy-digest-1",
      },
    },
  }), (error) => error.code === "delivery_helper_evidence_ambiguous");
  assert.throws(() => planDeliveryShifts({
    ...base,
    continuity: {
      kind: "legacyBootstrap",
      predecessor,
      helperEvidence: {
        kind: "ineligible",
        userId: "departed",
        evidenceDigest: "legacy-digest-1",
      },
    },
  }), (error) => error.code === "delivery_helper_ineligible");
});

test("cannot bypass a recorded helper through persisted append continuity", () => {
  assert.throws(() => planDeliveryShifts({
    planningRequestId: "delivery-persisted-conflict",
    targetSeasonStartYear: 2026,
    deliveryWeekday: "WED",
    rotation: deliveryRotation(["a", "b", "c"]),
    continuity: {
      kind: "persistedAppend",
      predecessor: {
        shiftId: "persisted",
        scheduledDate: "2026-08-26",
        effectiveLeadUserId: "c",
        completion: {
          state: "uncompleted",
          assignmentRevision: 2,
          completionRevision: 0,
          plannedHelperUserId: "b",
        },
      },
    },
  }), (error) => error.code === "delivery_helper_cursor_conflict");
  assert.throws(() => planDeliveryShifts({
    planningRequestId: "delivery-new-bypass",
    targetSeasonStartYear: 2026,
    deliveryWeekday: "WED",
    rotation: deliveryRotation(["a", "b", "c"], 1),
    continuity: {kind: "newRotation"},
  }), (error) => error.code === "invalid_delivery_continuity");
});

test("requires two members and keeps every adjacent lead distinct for N=2", () => {
  const plan = planDeliveryShifts({
    planningRequestId: "delivery-two",
    targetSeasonStartYear: 2026,
    deliveryWeekday: "WED",
    rotation: deliveryRotation(["a", "b"]),
    continuity: {kind: "newRotation"},
  });
  for (let index = 1; index < plan.shifts.length; index += 1) {
    assert.notEqual(
      plan.shifts[index - 1].assignedUserIds[0],
      plan.shifts[index].assignedUserIds[0],
    );
  }
  assert.equal(plan.shifts.at(-1).helperUserId, null);
  assert.throws(() => planDeliveryShifts({
    planningRequestId: "delivery-one",
    targetSeasonStartYear: 2026,
    deliveryWeekday: "WED",
    rotation: deliveryRotation(["a"]),
    continuity: {kind: "newRotation"},
  }), (error) => error.code === "insufficient_delivery_members");
});

test("never rewrites a completed predecessor helper", () => {
  const plan = planDeliveryShifts({
    planningRequestId: "delivery-completed-predecessor",
    targetSeasonStartYear: 2026,
    deliveryWeekday: "WED",
    rotation: deliveryRotation(["a", "b"]),
    continuity: {
      kind: "persistedAppend",
      predecessor: {
        shiftId: "legacy",
        scheduledDate: "2026-08-26",
        effectiveLeadUserId: "b",
        completion: {
          state: "completed",
          assignmentRevision: 7,
          completionRevision: 3,
          actualHelperUserId: "historical-helper",
          helperSourceAssignmentRevision: 6,
          completedAtMillis: 1_000,
        },
      },
    },
  });
  assert.equal(plan.predecessorHelperUpdate, null);
  assert.deepEqual(plan.predecessorGuard, {
    shiftId: "legacy",
    expectedScheduledDate: "2026-08-26",
    expectedEffectiveLeadUserId: "b",
    expectedAssignmentRevision: 7,
    expectedCompletionRevision: 3,
    expectedCompletionState: "completed",
    expectedPlannedHelperUserId: null,
    expectedActualHelperUserId: "historical-helper",
    expectedHelperSourceAssignmentRevision: 6,
    expectedCompletedAtMillis: 1_000,
  });
});

test("guards the predecessor slot and its planned helper before persistence", () => {
  const plan = planDeliveryShifts({
    planningRequestId: "delivery-uncompleted-guard",
    targetSeasonStartYear: 2026,
    deliveryWeekday: "WED",
    rotation: deliveryRotation(["a", "b"]),
    continuity: {
      kind: "persistedAppend",
      predecessor: {
        shiftId: "delivery-2026-08-26",
        scheduledDate: "2026-08-26",
        effectiveLeadUserId: "b",
        completion: {
          state: "uncompleted",
          assignmentRevision: 8,
          completionRevision: 2,
          plannedHelperUserId: "a",
        },
      },
    },
  });

  assert.equal(plan.predecessorHelperUpdate, null);
  assert.deepEqual(plan.predecessorGuard, {
    shiftId: "delivery-2026-08-26",
    expectedScheduledDate: "2026-08-26",
    expectedEffectiveLeadUserId: "b",
    expectedAssignmentRevision: 8,
    expectedCompletionRevision: 2,
    expectedCompletionState: "uncompleted",
    expectedPlannedHelperUserId: "a",
    expectedActualHelperUserId: null,
    expectedHelperSourceAssignmentRevision: null,
    expectedCompletedAtMillis: null,
  });
});

test("preserves round and adjacency invariants across cohort sizes", () => {
  for (let count = 2; count <= 100; count += 1) {
    const cohort = Array.from({length: count}, (_, index) => `member-${index + 1}`);
    const plan = planDeliveryShifts({
      planningRequestId: `delivery-property-${count}`,
      targetSeasonStartYear: 2026,
      deliveryWeekday: "WED",
      rotation: deliveryRotation(cohort),
      continuity: {kind: "newRotation"},
    });
    assert.equal(plan.nextRotation.nextMemberIndex, 0);
    assert.equal(plan.shifts.length % count, 0);
    for (let index = 1; index < plan.shifts.length; index += 1) {
      assert.notEqual(
        plan.shifts[index - 1].assignedUserIds[0],
        plan.shifts[index].assignedUserIds[0],
      );
    }
  }
});

test("rejects inherited delivery dates that are not a calendar prefix", () => {
  assert.throws(() => planDeliveryShifts({
    planningRequestId: "delivery-gap",
    targetSeasonStartYear: 2026,
    deliveryWeekday: "WED",
    inheritedTargetPrefix: {
      dates: ["2026-09-09"],
      positions: [{
        rotationOwnerUserId: "a",
        roundNumber: 1,
        positionInRound: 1,
      }],
      rotationBeforePrefix: deliveryRotation(["a", "b"]),
      lineageRevision: "baseline-1",
      lineageDigest: "digest-1",
    },
    rotation: deliveryRotation(["a", "b"], 1),
    continuity: {kind: "newRotation"},
  }), (error) => error.code === "invalid_inherited_projection_prefix");
});

test("rejects carryover whose owners do not lead to the supplied cursor", () => {
  assert.throws(() => planDeliveryShifts({
    planningRequestId: "delivery-lineage",
    targetSeasonStartYear: 2026,
    deliveryWeekday: "WED",
    inheritedTargetPrefix: {
      dates: ["2026-09-02", "2026-09-09"],
      positions: [
        {rotationOwnerUserId: "a", roundNumber: 1, positionInRound: 1},
        {rotationOwnerUserId: "b", roundNumber: 1, positionInRound: 2},
      ],
      rotationBeforePrefix: deliveryRotation(["a", "b", "c"]),
      lineageRevision: "baseline-1",
      lineageDigest: "digest-1",
    },
    rotation: deliveryRotation(["a", "b", "c"], 0),
    continuity: {
      kind: "persistedAppend",
      predecessor: {
        shiftId: "delivery-2026-09-09",
        scheduledDate: "2026-09-09",
        effectiveLeadUserId: "b",
        completion: {
          state: "uncompleted",
          assignmentRevision: 1,
          completionRevision: 0,
          plannedHelperUserId: null,
        },
      },
    },
  }), (error) => error.code === "invalid_inherited_rotation_lineage");
});

test("rejects a fully occupied target even when its cursor is mid-round", () => {
  const cohort = ["a", "b", "c"];
  const dates = buildDeliverySeasonDates(2026, "WED");
  const rotationBeforePrefix = deliveryRotation(cohort);
  const inherited = consumeRotationPositions(rotationBeforePrefix, dates.length);
  assert.throws(() => planDeliveryShifts({
    planningRequestId: "delivery-full-target-boundary",
    targetSeasonStartYear: 2026,
    deliveryWeekday: "WED",
    inheritedTargetPrefix: {
      dates,
      positions: inherited.positions,
      rotationBeforePrefix,
      lineageRevision: "baseline-1",
      lineageDigest: "digest-1",
    },
    rotation: inherited.nextRotation,
    continuity: {
      kind: "persistedAppend",
      predecessor: {
        shiftId: "delivery-2027-08-25",
        scheduledDate: "2027-08-25",
        effectiveLeadUserId: "a",
        completion: {
          state: "uncompleted",
          assignmentRevision: 1,
          completionRevision: 0,
          plannedHelperUserId: null,
        },
      },
    },
  }), (error) => error.code === "planning_frontier_complete");
});

test("reports a complete frontier when the occupied target ends on a round boundary", () => {
  const cohort = ["a", "b"];
  const dates = buildDeliverySeasonDates(2026, "WED");
  const rotationBeforePrefix = deliveryRotation(cohort);
  const inherited = consumeRotationPositions(rotationBeforePrefix, dates.length);

  assert.throws(() => planDeliveryShifts({
    planningRequestId: "delivery-complete",
    targetSeasonStartYear: 2026,
    deliveryWeekday: "WED",
    inheritedTargetPrefix: {
      dates,
      positions: inherited.positions,
      rotationBeforePrefix,
      lineageRevision: "baseline-1",
      lineageDigest: "digest-1",
    },
    rotation: inherited.nextRotation,
    continuity: {
      kind: "persistedAppend",
      predecessor: {
        shiftId: "delivery-2027-08-25",
        scheduledDate: "2027-08-25",
        effectiveLeadUserId: "b",
        completion: {
          state: "uncompleted",
          assignmentRevision: 1,
          completionRevision: 0,
          plannedHelperUserId: null,
        },
      },
    },
  }), (error) => error.code === "planning_frontier_complete");
});
