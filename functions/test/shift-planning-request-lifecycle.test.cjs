const assert = require("node:assert/strict");
const {test} = require("node:test");
const {
  ShiftPlanningError,
} = require("../lib/shift-planning-contract.js");
const {
  ShiftPlanningDigestError,
} = require("../lib/shift-planning-digest.js");
const {
  buildShiftPlanningAuthoritativeState,
} = require("../lib/shift-planning-state-persistence.js");
const {
  executeShiftPlanningRequest,
} = require("../lib/shift-planning-request-lifecycle.js");

const ENVIRONMENT = "develop";
const BUNDLE_ID = "bundle-2026";
const BUNDLE_REVISION = "bundle-v2-aaaaaaaaaaaaaaaaaaaaaaaa";
const BUNDLE_DIGEST = `shift-planning:v1:sha256:${"a".repeat(64)}`;
const ACTIVE_DIGEST = `shift-planning:v1:sha256:${"9".repeat(64)}`;

const rotation = (type, overrides = {}) => ({
  schemaVersion: 1,
  type,
  stateRevision: type === "delivery" ? 4 : 7,
  cursor: {
    schemaVersion: 1,
    type,
    cohortUserIds: ["member-1", "member-2", "member-3"],
    roundNumber: 3,
    nextMemberIndex: 0,
  },
  planningFrontierSeasonStartYear: 2026,
  cohortFrozen: false,
  frozenCohortUserIds: [],
  activeRevision: "active-6",
  activeDigest: ACTIVE_DIGEST,
  lastIdempotencyKey: "activate-6",
  migrationBaseline: null,
  releaseLease: null,
  ...overrides,
});

const authoritativeState = (overrides = {}) =>
  buildShiftPlanningAuthoritativeState({
    environment: ENVIRONMENT,
    maintenance: {
      schemaVersion: 1,
      stateRevision: 8,
      writeEpoch: 7,
      maintenanceStatus: "open",
      activeRevision: "active-6",
      activeDigest: ACTIVE_DIGEST,
      intakeBarrier: null,
      lastTransitionId: "activate-6",
      ...overrides.maintenance,
    },
    rotations: {
      delivery: rotation("delivery", overrides.delivery),
      market: rotation("market", overrides.market),
    },
  });

const request = (mode = "preview") => ({
  schemaVersion: 2,
  requestId: `${mode}-001`,
  bundleId: BUNDLE_ID,
  environment: ENVIRONMENT,
  requestedByUserId: "admin-001",
  requestedAtMillis: 1_782_643_200_000,
  mode,
  status: "requested",
  expectedWriteEpoch: 7,
  expectedActiveRevision: "active-6",
  subplans: {
    delivery: {targetSeasonStartYear: 2026},
    market: {targetSeasonStartYear: 2026},
  },
  binding: mode === "preview" ? null : mode === "stage" ? {
    kind: "preview",
    sourceRequestId: "preview-001",
    bundleRevision: BUNDLE_REVISION,
    bundleDigest: BUNDLE_DIGEST,
  } : {
    kind: "candidate",
    candidateId: BUNDLE_ID,
    bundleRevision: BUNDLE_REVISION,
    bundleDigest: BUNDLE_DIGEST,
    candidateDigest: `shift-planning:v1:sha256:${"b".repeat(64)}`,
  },
});

const token = (value) => ({
  environment: value.environment,
  requestId: value.requestId,
  operationId: `request-${value.requestId}`,
  workerId: "worker-001",
  fencingEpoch: 1,
  requestIntentDigest: `shift-planning:v1:sha256:${"c".repeat(64)}`,
});

const completedResult = (value, resolvedState = authoritativeState()) => {
  const previewReceipt = {
    schemaVersion: 2,
    status: "completed",
    mode: "preview",
    requestId: value.mode === "preview" ? value.requestId : "preview-001",
    bundleId: value.bundleId,
    bundleRevision: BUNDLE_REVISION,
    bundleDigest: BUNDLE_DIGEST,
    environment: value.environment,
    requestedByUserId: value.requestedByUserId,
    expectedStateDigest: `shift-planning:v1:sha256:${"d".repeat(64)}`,
  };
  const isPreview = value.mode === "preview";
  return {
    schemaVersion: 2,
    requestId: value.requestId,
    mode: value.mode,
    bundleId: value.bundleId,
    environment: value.environment,
    bundleRevision: BUNDLE_REVISION,
    bundleDigest: BUNDLE_DIGEST,
    expectedState: {
      schemaVersion: 2,
      authoritativeState: resolvedState,
      transactionMeasurementAuthority: {
        adapterRevision: "firestore-adapter-v1",
        indexConfigurationDigest:
          `shift-planning:v1:sha256:${"8".repeat(64)}`,
      },
    },
    frontiers: {
      delivery: {
        frontierBefore: {seasonStartYear: 2026},
        frontierAfter: {seasonStartYear: 2027},
      },
      market: {
        frontierBefore: {seasonStartYear: 2026},
        frontierAfter: {seasonStartYear: 2027},
      },
    },
    delivery: {shifts: [], affectedProjectionSeasonStartYears: [2026]},
    market: {shifts: [], affectedProjectionSeasonStartYears: [2026]},
    transactionEvidence: isPreview ? null : {schemaVersion: 2},
    stagedCandidate: isPreview ? null : {schemaVersion: 2},
    stagedCandidateDigest: isPreview ? null :
      `shift-planning:v1:sha256:${"e".repeat(64)}`,
    previewReceipt,
    previewReceiptDigest: `shift-planning:v1:sha256:${"f".repeat(64)}`,
  };
};

const completedSummary = (mode = "preview") => ({
  schemaVersion: 1,
  status: "completed",
  mode,
  bundleId: BUNDLE_ID,
  bundleRevision: BUNDLE_REVISION,
  bundleDigest: BUNDLE_DIGEST,
  delivery: {
    targetSeasonStartYear: 2026,
    generatedShiftCount: 0,
    affectedProjectionSeasonStartYears: [2026],
  },
  market: {
    targetSeasonStartYear: 2026,
    generatedShiftCount: 0,
    affectedProjectionSeasonStartYears: [2026],
  },
});

const persistedPreview = {
  request: request("preview"),
  summary: completedSummary("preview"),
  receipt: completedResult(request("preview")).previewReceipt,
  receiptDigest: `shift-planning:v1:sha256:${"f".repeat(64)}`,
  bundleArtifactDigest: `shift-planning:v1:sha256:${"1".repeat(64)}`,
};

const fakePersistence = (input = {}) => {
  const inspectedRequest = input.request || request("preview");
  const calls = [];
  const loadedAuthoritativeState = input.authoritativeState ||
    authoritativeState();
  const persistence = {
    claimRequest: async (value) => {
      calls.push(["claimRequest", value]);
      if (input.claimError) throw input.claimError;
      if (inspectedRequest.mode === "activate") {
        return input.claim || {
          kind: "activationPreflight",
          request: inspectedRequest,
        };
      }
      return input.claim || {
        kind: "process",
        request: inspectedRequest,
        token: token(inspectedRequest),
      };
    },
    completePreview: async (value) => {
      calls.push(["completePreview", value]);
      if (input.completePreviewError) throw input.completePreviewError;
      return input.completePreviewResult || "committed";
    },
    completeStage: async (value) => {
      calls.push(["completeStage", value]);
      if (input.completeStageError) throw input.completeStageError;
      return input.completeStageResult || "committed";
    },
    failRequest: async (value) => {
      calls.push(["failRequest", value]);
      if (input.failError) throw input.failError;
      return input.failResult || "committed";
    },
    loadPersistedPreview: async (value) => {
      calls.push(["loadPersistedPreview", value]);
      if (input.loadPreviewError) throw input.loadPreviewError;
      return input.persistedPreview || persistedPreview;
    },
    preflightActivation: async (value) => {
      calls.push(["preflightActivation", value]);
      if (input.preflightError) throw input.preflightError;
      return input.preflight || {
        request: inspectedRequest,
        candidate: {candidateDigest: inspectedRequest.binding.candidateDigest},
      };
    },
  };
  const statePersistence = {
    loadAuthoritativeState: async (value) => {
      calls.push(["loadAuthoritativeState", value]);
      if (input.loadStateError) throw input.loadStateError;
      return loadedAuthoritativeState;
    },
  };
  return {calls, persistence, statePersistence, loadedAuthoritativeState};
};

const execute = (
  persistence,
  statePersistence,
  resolveBundle,
  value = request("preview"),
) =>
  executeShiftPlanningRequest({
    persistence,
    statePersistence,
    resolveBundle,
    environment: value.environment,
    requestId: value.requestId,
    operationId: `request-${value.requestId}`,
    workerId: "worker-001",
    leaseDurationMillis: 10_000,
  });

test("preview claims before resolving and completes its exact result", async () => {
  const value = request("preview");
  const {calls, persistence, statePersistence, loadedAuthoritativeState} =
    fakePersistence({request: value});
  const resolutionInputs = [];
  const result = await execute(persistence, statePersistence, async (input) => {
    calls.push(["resolveBundle", input]);
    resolutionInputs.push(input);
    return completedResult(value);
  }, value);

  assert.equal(result.kind, "completed");
  assert.equal(result.persistenceResult, "committed");
  assert.equal(result.summary.mode, "preview");
  assert.equal(resolutionInputs.length, 1);
  assert.equal(resolutionInputs[0].persistedPreview, null);
  assert.equal(
    resolutionInputs[0].authoritativeState,
    loadedAuthoritativeState,
  );
  assert.deepEqual(calls.map(([name]) => name), [
    "claimRequest",
    "loadAuthoritativeState",
    "resolveBundle",
    "completePreview",
  ]);
});

test("stage loads its exact persisted preview before resolving", async () => {
  const value = request("stage");
  const {calls, persistence, statePersistence, loadedAuthoritativeState} =
    fakePersistence({request: value});
  let resolutionInput;
  const result = await execute(persistence, statePersistence, async (input) => {
    calls.push(["resolveBundle", input]);
    resolutionInput = input;
    return completedResult(value);
  }, value);

  assert.equal(result.kind, "completed");
  assert.equal(result.summary.mode, "stage");
  assert.equal(resolutionInput.persistedPreview, persistedPreview);
  assert.equal(resolutionInput.authoritativeState, loadedAuthoritativeState);
  assert.deepEqual(calls.map(([name]) => name), [
    "claimRequest",
    "loadPersistedPreview",
    "loadAuthoritativeState",
    "resolveBundle",
    "completeStage",
  ]);
  assert.equal(
    calls.find(([name]) => name === "loadPersistedPreview")[1].requestId,
    "preview-001",
  );
});

test("rejects a resolved bundle bound to another authoritative read-set", async () => {
  const value = request("preview");
  const loadedState = authoritativeState();
  const driftedState = authoritativeState({
    maintenance: {stateRevision: 9},
  });
  const {calls, persistence, statePersistence} = fakePersistence({
    request: value,
    authoritativeState: loadedState,
  });

  const result = await execute(
    persistence,
    statePersistence,
    async () => completedResult(value, driftedState),
    value,
  );

  assert.equal(result.kind, "failed");
  assert.deepEqual(result.summary.failure, {
    scope: "bundle",
    code: "internal_planning_failure",
    messageKey: "shiftPlanning.error.internalPlanningFailure",
  });
  assert.deepEqual(calls.map(([name]) => name), [
    "claimRequest",
    "loadAuthoritativeState",
    "failRequest",
  ]);
});

test("rejects malformed authoritative evidence returned by the resolver", async () => {
  const value = request("stage");
  const {calls, persistence, statePersistence} = fakePersistence({request: value});
  const result = await execute(
    persistence,
    statePersistence,
    async () => {
      const resolved = completedResult(value);
      resolved.expectedState.authoritativeState = {
        ...resolved.expectedState.authoritativeState,
        authoritativeDigest: `shift-planning:v1:sha256:${"0".repeat(64)}`,
      };
      return resolved;
    },
    value,
  );

  assert.equal(result.kind, "failed");
  assert.equal(result.summary.failure.code, "internal_planning_failure");
  assert.deepEqual(calls.map(([name]) => name), [
    "claimRequest",
    "loadPersistedPreview",
    "loadAuthoritativeState",
    "failRequest",
  ]);
});

test("rejects a non-exact expected-state envelope from the resolver", async () => {
  const value = request("preview");
  const {calls, persistence, statePersistence} = fakePersistence({request: value});
  const result = await execute(
    persistence,
    statePersistence,
    async () => {
      const resolved = completedResult(value);
      resolved.expectedState = {
        ...resolved.expectedState,
        unexpected: true,
      };
      return resolved;
    },
    value,
  );

  assert.equal(result.kind, "failed");
  assert.equal(result.summary.failure.code, "internal_planning_failure");
  assert.deepEqual(calls.map(([name]) => name), [
    "claimRequest",
    "loadAuthoritativeState",
    "failRequest",
  ]);
});

test("resume continues the same claimed preview once", async () => {
  const value = request("preview");
  const {calls, persistence, statePersistence} = fakePersistence({
    request: value,
    claim: {kind: "resume", request: value, token: token(value)},
  });
  let resolutionCount = 0;
  const result = await execute(persistence, statePersistence, async () => {
    resolutionCount += 1;
    return completedResult(value);
  }, value);

  assert.equal(result.kind, "completed");
  assert.equal(resolutionCount, 1);
  assert.equal(
    calls.filter(([name]) => name === "completePreview").length,
    1,
  );
  assert.deepEqual(calls.map(([name]) => name), [
    "claimRequest",
    "loadAuthoritativeState",
    "completePreview",
  ]);
});

test("busy returns without loading or resolving a bundle", async () => {
  const value = request("stage");
  const {calls, persistence, statePersistence} = fakePersistence({
    request: value,
    claim: {kind: "busy", request: value, retryAfterMillis: 2_500},
  });
  let resolutionCount = 0;
  const result = await execute(persistence, statePersistence, async () => {
    resolutionCount += 1;
    return completedResult(value);
  }, value);

  assert.equal(result.kind, "busy");
  assert.equal(result.retryAfterMillis, 2_500);
  assert.equal(resolutionCount, 0);
  assert.deepEqual(calls.map(([name]) => name), [
    "claimRequest",
  ]);
});

test("terminal replay returns without loading or resolving a bundle", async () => {
  const value = request("preview");
  const summary = completedSummary("preview");
  const artifact = {kind: "preview"};
  const {calls, persistence, statePersistence} = fakePersistence({
    request: value,
    claim: {
      kind: "terminalReplay",
      request: value,
      summary,
      artifact,
    },
  });
  let resolutionCount = 0;
  const result = await execute(persistence, statePersistence, async () => {
    resolutionCount += 1;
    return completedResult(value);
  }, value);

  assert.equal(result.kind, "terminalReplay");
  assert.equal(result.summary, summary);
  assert.equal(result.artifact, artifact);
  assert.equal(resolutionCount, 0);
  assert.deepEqual(calls.map(([name]) => name), [
    "claimRequest",
  ]);
});

test("typed planning errors persist stable failure without raw copy", async () => {
  const value = request("preview");
  const {calls, persistence, statePersistence} = fakePersistence({request: value});
  const result = await execute(persistence, statePersistence, async () => {
    throw new ShiftPlanningError(
      "insufficient_delivery_members",
      "sensitive internal roster detail",
    );
  }, value);

  assert.equal(result.kind, "failed");
  assert.deepEqual(result.summary.failure, {
    scope: "delivery",
    code: "insufficient_delivery_members",
    messageKey: "shiftPlanning.error.insufficientDeliveryMembers",
  });
  assert.equal(
    JSON.stringify(result.summary).includes("sensitive internal roster detail"),
    false,
  );
  assert.equal(calls.at(-1)[0], "failRequest");
});

test("digest boundary errors are deterministic bundle failures", async () => {
  const value = request("stage");
  const {calls, persistence, statePersistence} = fakePersistence({request: value});
  const result = await execute(persistence, statePersistence, async () => {
    throw new ShiftPlanningDigestError(
      "invalid_shift_planning_fairness_snapshot",
      "sensitive snapshot detail",
    );
  }, value);

  assert.equal(result.kind, "failed");
  assert.deepEqual(result.summary.failure, {
    scope: "bundle",
    code: "invalid_shift_planning_fairness_snapshot",
    messageKey: "shiftPlanning.error.invalidShiftPlanningFairnessSnapshot",
  });
  assert.equal(calls.at(-1)[0], "failRequest");
});

test("infrastructure errors leave the lease retryable", async () => {
  const value = request("preview");
  const failure = new Error("transient Firestore outage");
  const {calls, persistence, statePersistence} = fakePersistence({request: value});

  await assert.rejects(
    execute(persistence, statePersistence, async () => {
      throw failure;
    }, value),
    (error) => error === failure,
  );
  assert.equal(calls.some(([name]) => name === "failRequest"), false);
  assert.equal(calls.some(([name]) => name === "completePreview"), false);
});

test("state-load infrastructure failure leaves the claim retryable", async () => {
  const value = request("stage");
  const failure = new Error("transient authoritative-state outage");
  const {calls, persistence, statePersistence} = fakePersistence({
    request: value,
    loadStateError: failure,
  });
  let resolutionCount = 0;

  await assert.rejects(
    execute(persistence, statePersistence, async () => {
      resolutionCount += 1;
      return completedResult(value);
    }, value),
    (error) => error === failure,
  );
  assert.equal(resolutionCount, 0);
  assert.deepEqual(calls.map(([name]) => name), [
    "claimRequest",
    "loadPersistedPreview",
    "loadAuthoritativeState",
  ]);
});

test("invalid stage artifacts fail as a stable internal planning result", async () => {
  const value = request("stage");
  const invalid = {...completedResult(value), stagedCandidate: null};
  const {calls, persistence, statePersistence} = fakePersistence({request: value});
  const result = await execute(
    persistence,
    statePersistence,
    async () => invalid,
    value,
  );

  assert.equal(result.kind, "failed");
  assert.deepEqual(result.summary.failure, {
    scope: "bundle",
    code: "internal_planning_failure",
    messageKey: "shiftPlanning.error.internalPlanningFailure",
  });
  assert.equal(calls.at(-1)[0], "failRequest");
});

test("persistence completion errors are not rewritten as business failure", async () => {
  const value = request("preview");
  const failure = new ShiftPlanningError(
    "request_intent_conflict",
    "claim was fenced after planning",
  );
  const {calls, persistence, statePersistence} = fakePersistence({
    request: value,
    completePreviewError: failure,
  });

  await assert.rejects(
    execute(
      persistence,
      statePersistence,
      async () => completedResult(value),
      value,
    ),
    (error) => error === failure,
  );
  assert.equal(calls.some(([name]) => name === "failRequest"), false);
});

test("activate performs only candidate preflight", async () => {
  const value = request("activate");
  const preflight = {request: value, candidate: {candidateDigest: "exact"}};
  const {calls, persistence, statePersistence} = fakePersistence({
    request: value,
    preflight,
  });
  let resolutionCount = 0;
  const result = await execute(persistence, statePersistence, async () => {
    resolutionCount += 1;
    return completedResult(value);
  }, value);

  assert.equal(result.kind, "activationPreflight");
  assert.equal(result.preflight, preflight);
  assert.equal(resolutionCount, 0);
  assert.deepEqual(calls.map(([name]) => name), [
    "claimRequest",
    "preflightActivation",
  ]);
});

test("activate preflight failures never claim or terminalize", async () => {
  const value = request("activate");
  const failure = new ShiftPlanningError(
    "candidate_binding_mismatch",
    "candidate changed",
  );
  const {calls, persistence, statePersistence} = fakePersistence({
    request: value,
    preflightError: failure,
  });

  await assert.rejects(
    execute(
      persistence,
      statePersistence,
      async () => completedResult(value),
      value,
    ),
    (error) => error === failure,
  );
  assert.deepEqual(calls.map(([name]) => name), [
    "claimRequest",
    "preflightActivation",
  ]);
});
