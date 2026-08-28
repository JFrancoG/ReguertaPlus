const assert = require("node:assert/strict");
const {test} = require("node:test");

const {
  applyMemberSwap,
  assertShiftSwapPlanningAuthority,
  assertActiveShiftSwapParticipants,
  assertShiftSwapTimingEligible,
  buildShiftSwapCandidates,
  captureShiftSwapPlanningAuthority,
  parseShiftSwapTransitionInput,
  recomputeDeliveryHelpers,
  upsertShiftSwapResponse,
} = require("../lib/shift-swap-security.js");

const digest = (character) =>
  `shift-planning:v1:sha256:${character.repeat(64)}`;

const planningState = (overrides = {}) => ({
  schemaVersion: 1,
  stateRevision: 4,
  writeEpoch: 7,
  maintenanceStatus: "open",
  activeRevision: "bundle-v2-1234567890abcdef12345678",
  activeDigest: digest("a"),
  intakeBarrier: null,
  lastTransitionId: "activation-transition-1",
  ...overrides,
});

test("parses the explicit shift-swap transition contract", () => {
  assert.deepEqual(parseShiftSwapTransitionInput({
    environment: "develop",
    action: "respond",
    requestId: "request-1",
    candidateShiftId: "shift-2",
    response: "available",
  }), {
    environment: "develop",
    action: "respond",
    requestId: "request-1",
    candidateShiftId: "shift-2",
    response: "available",
  });
  assert.throws(() => parseShiftSwapTransitionInput({
    environment: "develop",
    action: "apply",
    requestId: "request-1",
  }));
});

test("captures the exact open planning authority when state exists", () => {
  assert.equal(captureShiftSwapPlanningAuthority(undefined), null);
  assert.deepEqual(captureShiftSwapPlanningAuthority(planningState()), {
    schemaVersion: 1,
    stateRevision: 4,
    writeEpoch: 7,
    activeRevision: "bundle-v2-1234567890abcdef12345678",
    activeDigest: digest("a"),
  });

  assert.throws(
    () => captureShiftSwapPlanningAuthority(planningState({
      maintenanceStatus: "closed",
      intakeBarrier: {
        revision: "barrier-revision-1",
        digest: digest("b"),
        verifiedAtMillis: 1_000,
      },
    })),
    (error) => error.code === "shift_planning_maintenance",
  );
  assert.throws(
    () => captureShiftSwapPlanningAuthority({...planningState(), extra: true}),
    (error) => error.code === "invalid_shift_planning_state",
  );
});

test("revalidates shift-swap planning authority without legacy drift", () => {
  const authority = captureShiftSwapPlanningAuthority(planningState());
  assert.doesNotThrow(() => assertShiftSwapPlanningAuthority(
    authority,
    planningState(),
  ));
  assert.doesNotThrow(() => assertShiftSwapPlanningAuthority(null, undefined));

  for (const current of [
    undefined,
    planningState({stateRevision: 5}),
    planningState({writeEpoch: 8}),
    planningState({
      activeRevision: "bundle-v2-abcdef1234567890abcdef12",
      activeDigest: digest("c"),
    }),
  ]) {
    assert.throws(
      () => assertShiftSwapPlanningAuthority(authority, current),
      (error) => error.code === "shift_swap_planning_authority_changed",
    );
  }
  assert.throws(
    () => assertShiftSwapPlanningAuthority(null, planningState()),
    (error) => error.code === "shift_swap_planning_authority_changed",
  );
});

test("builds candidates from future shifts of the same type", () => {
  const source = {
    id: "source",
    type: "market",
    dateMillis: 1_000,
    assignedUserIds: ["requester"],
    helperUserId: null,
  };
  const candidates = buildShiftSwapCandidates(source, [
    source,
    {...source, id: "past", dateMillis: 900, assignedUserIds: ["past-user"]},
    {...source, id: "future", dateMillis: 2_000, assignedUserIds: ["candidate", "requester"]},
    {...source, id: "other", type: "delivery", dateMillis: 2_000, assignedUserIds: ["other"]},
  ], "requester", 1_000);
  assert.deepEqual(candidates, [{userId: "candidate", shiftId: "future"}]);
});

test("updates one response per candidate deterministically", () => {
  const updated = upsertShiftSwapResponse([
    {userId: "candidate", shiftId: "shift-2", status: "unavailable", respondedAtMillis: 1},
    {userId: "other", shiftId: "shift-3", status: "available", respondedAtMillis: 2},
  ], {
    userId: "candidate",
    shiftId: "shift-2",
    status: "available",
    respondedAtMillis: 3,
  });
  assert.deepEqual(updated.map((response) => response.respondedAtMillis), [3, 2]);
  assert.equal(updated[0].status, "available");
});

test("apply requires both participants to remain active", () => {
  assert.doesNotThrow(() => assertActiveShiftSwapParticipants(
    {isActive: true},
    {isActive: true},
  ));
  for (const participants of [
    [{isActive: false}, {isActive: true}],
    [{isActive: true}, {isActive: false}],
    [undefined, {isActive: true}],
  ]) {
    assert.throws(
      () => assertActiveShiftSwapParticipants(...participants),
      (error) => error.code === "shift_swap_participant_inactive",
    );
  }
});

test("apply revalidates current shift timing", () => {
  const day = 24 * 60 * 60 * 1_000;
  const market = {
    id: "market-requested",
    type: "market",
    dateMillis: 2_000,
    assignedUserIds: ["requester"],
    helperUserId: null,
  };
  assert.doesNotThrow(() => assertShiftSwapTimingEligible(
    market,
    {...market, id: "market-candidate", dateMillis: 1_000},
    1_000,
  ));
  assert.throws(
    () => assertShiftSwapTimingEligible(
      {...market, dateMillis: 999},
      {...market, id: "market-candidate"},
      1_000,
    ),
    (error) => error.code === "shift_in_past",
  );

  const delivery = {...market, id: "delivery-requested", type: "delivery"};
  assert.doesNotThrow(() => assertShiftSwapTimingEligible(
    delivery,
    {...delivery, id: "delivery-candidate", dateMillis: 1_000 + (14 * day)},
    1_000,
  ));
  assert.throws(
    () => assertShiftSwapTimingEligible(
      delivery,
      {...delivery, id: "delivery-candidate", dateMillis: 1_000 + (14 * day) - 1},
      1_000,
    ),
    (error) => error.code === "shift_swap_candidate_expired",
  );
});

test("swaps only the represented member ids", () => {
  const [requested, candidate] = applyMemberSwap(
    {
      id: "requested",
      type: "delivery",
      dateMillis: 1,
      assignedUserIds: ["requester"],
      helperUserId: "helper",
    },
    {
      id: "candidate",
      type: "delivery",
      dateMillis: 2,
      assignedUserIds: ["responder"],
      helperUserId: null,
    },
    "requester",
    "responder",
  );
  assert.deepEqual(requested.assignedUserIds, ["responder"]);
  assert.deepEqual(candidate.assignedUserIds, ["requester"]);
  assert.throws(() => applyMemberSwap(
    requested,
    candidate,
    "missing",
    "responder",
  ));
});

test("recomputes delivery helpers from the next delivery lead", () => {
  const shifts = recomputeDeliveryHelpers([
    {id: "delivery-2", type: "delivery", dateMillis: 2, assignedUserIds: ["two"], helperUserId: "stale"},
    {id: "market", type: "market", dateMillis: 2, assignedUserIds: ["market"], helperUserId: "keep"},
    {id: "delivery-1", type: "delivery", dateMillis: 1, assignedUserIds: ["one"], helperUserId: null},
  ]);
  assert.equal(shifts.find((shift) => shift.id === "delivery-1").helperUserId, "two");
  assert.equal(shifts.find((shift) => shift.id === "delivery-2").helperUserId, null);
  assert.equal(shifts.find((shift) => shift.id === "market").helperUserId, "keep");
});
