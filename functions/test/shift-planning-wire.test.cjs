const assert = require("node:assert/strict");
const {test} = require("node:test");
const {Timestamp} = require("firebase-admin/firestore");

const {
  buildShiftPlanningFailureSummary,
  parseShiftPlanningMaintenanceState,
  parseShiftPlanningRequestV2,
  parseShiftRotationAggregateWire,
  serializeShiftPlanningRequestV2,
  SHIFT_PLANNING_COLLECTIONS,
} = require("../lib/shift-planning-wire.js");

const previewRequest = (overrides = {}) => ({
  schemaVersion: 2,
  requestId: "request-preview-2026",
  bundleId: "bundle-2026",
  environment: "develop",
  requestedByUserId: "admin-1",
  requestedAt: Timestamp.fromMillis(1_782_643_200_000),
  mode: "preview",
  status: "requested",
  expectedWriteEpoch: 7,
  expectedActiveRevision: "active-6",
  subplans: {
    delivery: {targetSeasonStartYear: 2026},
    market: {targetSeasonStartYear: 2026},
  },
  binding: null,
  ...overrides,
});

test("parses an exact two-subplan preview request", () => {
  const {requestedAt, ...request} = previewRequest();
  const parsed = parseShiftPlanningRequestV2({...request, requestedAt});
  assert.deepEqual(parsed, {
    ...request,
    requestedAtMillis: requestedAt.toMillis(),
  });
  assert.deepEqual(serializeShiftPlanningRequestV2(parsed), {
    ...request,
    requestedAt,
  });
});

test("requires digest binding for stage and activate but forbids it for preview", () => {
  const digestBinding = {
    bundleRevision: "bundle-v1-0123456789abcdef",
    bundleDigest: `shift-planning:v1:sha256:${"a".repeat(64)}`,
  };
  const requests = [
    previewRequest({
      mode: "stage",
      binding: {
        kind: "preview",
        sourceRequestId: "request-preview-source",
        ...digestBinding,
      },
    }),
    previewRequest({
      mode: "activate",
      binding: {
        kind: "candidate",
        candidateId: "bundle-2026",
        candidateDigest: `shift-planning:v1:sha256:${"b".repeat(64)}`,
        ...digestBinding,
      },
    }),
  ];
  for (const request of requests) {
    const {requestedAt, ...expected} = request;
    assert.deepEqual(parseShiftPlanningRequestV2(request), {
      ...expected,
      requestedAtMillis: requestedAt.toMillis(),
    });
    assert.throws(
      () => parseShiftPlanningRequestV2({...request, binding: null}),
      (error) => error.code === "invalid_planning_request",
    );
  }
  assert.throws(
    () => parseShiftPlanningRequestV2(previewRequest({
      binding: {
        kind: "preview",
        sourceRequestId: "request-preview-source",
        ...digestBinding,
      },
    })),
    (error) => error.code === "invalid_planning_request",
  );
  assert.throws(
    () => parseShiftPlanningRequestV2(previewRequest({
      mode: "stage",
      binding: {
        kind: "candidate",
        candidateId: "bundle-2026",
        candidateDigest: `shift-planning:v1:sha256:${"b".repeat(64)}`,
        ...digestBinding,
      },
    })),
    (error) => error.code === "invalid_planning_request",
  );
  assert.throws(
    () => parseShiftPlanningRequestV2(previewRequest({
      mode: "activate",
      binding: {
        kind: "candidate",
        candidateId: "another-bundle",
        candidateDigest: `shift-planning:v1:sha256:${"b".repeat(64)}`,
        ...digestBinding,
      },
    })),
    (error) => error.code === "invalid_planning_request",
  );
  const activateWithoutCandidateDigest = requests[1];
  delete activateWithoutCandidateDigest.binding.candidateDigest;
  assert.throws(
    () => parseShiftPlanningRequestV2(activateWithoutCandidateDigest),
    (error) => error.code === "invalid_planning_request",
  );
});

test("rejects implicit seasons, unsupported environments and extra fields", () => {
  assert.throws(
    () => parseShiftPlanningRequestV2(previewRequest({environment: "local"})),
    (error) => error.code === "invalid_planning_request",
  );
  assert.throws(
    () => parseShiftPlanningRequestV2(previewRequest({subplans: {delivery: {}}})),
    (error) => error.code === "invalid_planning_request",
  );
  assert.throws(
    () => parseShiftPlanningRequestV2({...previewRequest(), legacyType: "delivery"}),
    (error) => error.code === "invalid_planning_request",
  );
  assert.throws(
    () => parseShiftPlanningRequestV2(previewRequest({requestId: "invalid/id"})),
    (error) => error.code === "invalid_planning_request",
  );
  assert.throws(
    () => parseShiftPlanningRequestV2(previewRequest({bundleId: " padded "})),
    (error) => error.code === "invalid_planning_request",
  );
  assert.throws(
    () => parseShiftPlanningRequestV2(previewRequest({requestedAt: new Date()})),
    (error) => error.code === "invalid_planning_request",
  );
});

test("parses monotonic maintenance state and requires a verified close barrier", () => {
  const open = {
    schemaVersion: 1,
    stateRevision: 11,
    writeEpoch: 9,
    maintenanceStatus: "open",
    activeRevision: "active-8",
    activeDigest: `shift-planning:v1:sha256:${"b".repeat(64)}`,
    intakeBarrier: null,
    lastTransitionId: "activate-8",
  };
  assert.deepEqual(parseShiftPlanningMaintenanceState(open), open);

  const closed = {
    ...open,
    stateRevision: 12,
    writeEpoch: 10,
    maintenanceStatus: "closed",
    intakeBarrier: {
      revision: "rules-barrier-10",
      digest: `shift-planning:v1:sha256:${"c".repeat(64)}`,
      verifiedAtMillis: 1_782_643_200_000,
    },
    lastTransitionId: "maintenance-10",
  };
  assert.deepEqual(parseShiftPlanningMaintenanceState(closed), closed);
  assert.throws(
    () => parseShiftPlanningMaintenanceState({...closed, intakeBarrier: null}),
    (error) => error.code === "invalid_planning_state",
  );
  assert.throws(
    () => parseShiftPlanningMaintenanceState({
      ...open,
      intakeBarrier: closed.intakeBarrier,
    }),
    (error) => error.code === "invalid_planning_state",
  );
  assert.throws(
    () => parseShiftPlanningMaintenanceState({
      ...open,
      activeDigest: null,
    }),
    (error) => error.code === "invalid_planning_state",
  );
});

test("parses exact rotation aggregates with path-owned type and lineage", () => {
  const aggregate = {
    schemaVersion: 1,
    type: "delivery",
    stateRevision: 4,
    cursor: {
      schemaVersion: 1,
      type: "delivery",
      cohortUserIds: ["member-1", "member-2", "member-3"],
      roundNumber: 2,
      nextMemberIndex: 1,
    },
    planningFrontierSeasonStartYear: 2027,
    cohortFrozen: true,
    frozenCohortUserIds: ["member-1", "member-2", "member-3"],
    activeRevision: "active-8",
    activeDigest: `shift-planning:v1:sha256:${"b".repeat(64)}`,
    lastIdempotencyKey: "activate-8-delivery",
    migrationBaseline: {
      revision: "baseline-1",
      digest: `shift-planning:v1:sha256:${"c".repeat(64)}`,
    },
    releaseLease: {
      type: "delivery",
      bundleId: "bundle-2027",
      bundleRevision: "bundle-v1-2027",
      bundleDigest: `shift-planning:v1:sha256:${"d".repeat(64)}`,
      leaseEpoch: 3,
      ownerOperationId: "release-3",
      state: "sealed",
      acquiredAtMillis: 1_782_643_200_000,
      deadlineAtMillis: 1_782_643_260_000,
    },
  };

  assert.deepEqual(
    parseShiftRotationAggregateWire(aggregate, "delivery"),
    aggregate,
  );
  assert.throws(
    () => parseShiftRotationAggregateWire(aggregate, "market"),
    (error) => error.code === "invalid_planning_state",
  );
  assert.throws(
    () => parseShiftRotationAggregateWire({...aggregate, extra: true}, "delivery"),
    (error) => error.code === "invalid_planning_state",
  );
  assert.throws(
    () => parseShiftRotationAggregateWire({
      ...aggregate,
      activeDigest: null,
    }, "delivery"),
    (error) => error.code === "invalid_planning_state",
  );
  assert.throws(
    () => parseShiftRotationAggregateWire({
      ...aggregate,
      cohortFrozen: false,
      frozenCohortUserIds: [],
    }, "delivery"),
    (error) => error.code === "invalid_planning_state",
  );
  assert.throws(
    () => parseShiftRotationAggregateWire({
      ...aggregate,
      cursor: {...aggregate.cursor, nextMemberIndex: 0},
    }, "delivery"),
    (error) => error.code === "invalid_planning_state",
  );
});

test("builds stable localized failure metadata without raw backend messages", () => {
  assert.deepEqual(buildShiftPlanningFailureSummary({
    mode: "stage",
    bundleId: "bundle-2026",
    scope: "market",
    code: "insufficient_market_members",
  }), {
    schemaVersion: 1,
    status: "failed",
    mode: "stage",
    bundleId: "bundle-2026",
    failure: {
      scope: "market",
      code: "insufficient_market_members",
      messageKey: "shiftPlanning.error.insufficientMarketMembers",
    },
  });
  assert.throws(
    () => buildShiftPlanningFailureSummary({
      mode: "stage",
      bundleId: "bundle-2026",
      scope: "request",
      code: "constructor",
    }),
    (error) => error.code === "invalid_planning_request",
  );
});

test("freezes distinct public, admin-readable and backend-only collections", () => {
  assert.equal(SHIFT_PLANNING_COLLECTIONS.requests, "shiftPlanningRequests");
  assert.equal(SHIFT_PLANNING_COLLECTIONS.candidates, "shiftPlanningCandidates");
  assert.deepEqual(SHIFT_PLANNING_COLLECTIONS.backendOnly, [
    "shiftPlanningState",
    "shiftRotations",
    "shiftRotationMappings",
    "shiftPlanningBundles",
    "shiftPlanningSyncCommands",
    "shiftPlanningNotificationIntents",
    "shiftPlanningNotificationFences",
    "shiftPlanningNotificationIncidentFences",
    "shiftPlanningOperations",
  ]);
});
