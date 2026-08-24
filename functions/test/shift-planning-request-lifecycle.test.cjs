const assert = require("node:assert/strict");
const {test} = require("node:test");
const {
  ShiftPlanningError,
} = require("../lib/shift-planning-contract.js");
const {
  ShiftPlanningDigestError,
} = require("../lib/shift-planning-digest.js");
const {
  executeShiftPlanningRequest,
} = require("../lib/shift-planning-request-lifecycle.js");

const ENVIRONMENT = "develop";
const BUNDLE_ID = "bundle-2026";
const BUNDLE_REVISION = "bundle-v1-aaaaaaaaaaaaaaaaaaaaaaaa";
const BUNDLE_DIGEST = `shift-planning:v1:sha256:${"a".repeat(64)}`;

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

const completedResult = (value) => {
  const previewReceipt = {
    schemaVersion: 1,
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
    schemaVersion: 1,
    requestId: value.requestId,
    mode: value.mode,
    bundleId: value.bundleId,
    environment: value.environment,
    bundleRevision: BUNDLE_REVISION,
    bundleDigest: BUNDLE_DIGEST,
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
    transactionEvidence: isPreview ? null : {schemaVersion: 1},
    stagedCandidate: isPreview ? null : {schemaVersion: 1},
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
  return {calls, persistence};
};

const execute = (persistence, resolveBundle, value = request("preview")) =>
  executeShiftPlanningRequest({
    persistence,
    resolveBundle,
    environment: value.environment,
    requestId: value.requestId,
    operationId: `request-${value.requestId}`,
    workerId: "worker-001",
    leaseDurationMillis: 10_000,
  });

test("preview claims before resolving and completes its exact result", async () => {
  const value = request("preview");
  const {calls, persistence} = fakePersistence({request: value});
  const resolutionInputs = [];
  const result = await execute(persistence, async (input) => {
    calls.push(["resolveBundle", input]);
    resolutionInputs.push(input);
    return completedResult(value);
  }, value);

  assert.equal(result.kind, "completed");
  assert.equal(result.persistenceResult, "committed");
  assert.equal(result.summary.mode, "preview");
  assert.equal(resolutionInputs.length, 1);
  assert.equal(resolutionInputs[0].persistedPreview, null);
  assert.deepEqual(calls.map(([name]) => name), [
    "claimRequest",
    "resolveBundle",
    "completePreview",
  ]);
});

test("stage loads its exact persisted preview before resolving", async () => {
  const value = request("stage");
  const {calls, persistence} = fakePersistence({request: value});
  let resolutionInput;
  const result = await execute(persistence, async (input) => {
    calls.push(["resolveBundle", input]);
    resolutionInput = input;
    return completedResult(value);
  }, value);

  assert.equal(result.kind, "completed");
  assert.equal(result.summary.mode, "stage");
  assert.equal(resolutionInput.persistedPreview, persistedPreview);
  assert.deepEqual(calls.map(([name]) => name), [
    "claimRequest",
    "loadPersistedPreview",
    "resolveBundle",
    "completeStage",
  ]);
  assert.equal(
    calls.find(([name]) => name === "loadPersistedPreview")[1].requestId,
    "preview-001",
  );
});

test("resume continues the same claimed preview once", async () => {
  const value = request("preview");
  const {calls, persistence} = fakePersistence({
    request: value,
    claim: {kind: "resume", request: value, token: token(value)},
  });
  let resolutionCount = 0;
  const result = await execute(persistence, async () => {
    resolutionCount += 1;
    return completedResult(value);
  }, value);

  assert.equal(result.kind, "completed");
  assert.equal(resolutionCount, 1);
  assert.equal(
    calls.filter(([name]) => name === "completePreview").length,
    1,
  );
});

test("busy returns without loading or resolving a bundle", async () => {
  const value = request("stage");
  const {calls, persistence} = fakePersistence({
    request: value,
    claim: {kind: "busy", request: value, retryAfterMillis: 2_500},
  });
  let resolutionCount = 0;
  const result = await execute(persistence, async () => {
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
  const {calls, persistence} = fakePersistence({
    request: value,
    claim: {
      kind: "terminalReplay",
      request: value,
      summary,
      artifact,
    },
  });
  let resolutionCount = 0;
  const result = await execute(persistence, async () => {
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
  const {calls, persistence} = fakePersistence({request: value});
  const result = await execute(persistence, async () => {
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
  const {calls, persistence} = fakePersistence({request: value});
  const result = await execute(persistence, async () => {
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
  const {calls, persistence} = fakePersistence({request: value});

  await assert.rejects(
    execute(persistence, async () => {
      throw failure;
    }, value),
    (error) => error === failure,
  );
  assert.equal(calls.some(([name]) => name === "failRequest"), false);
  assert.equal(calls.some(([name]) => name === "completePreview"), false);
});

test("invalid stage artifacts fail as a stable internal planning result", async () => {
  const value = request("stage");
  const invalid = {...completedResult(value), stagedCandidate: null};
  const {calls, persistence} = fakePersistence({request: value});
  const result = await execute(persistence, async () => invalid, value);

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
  const {calls, persistence} = fakePersistence({
    request: value,
    completePreviewError: failure,
  });

  await assert.rejects(
    execute(persistence, async () => completedResult(value), value),
    (error) => error === failure,
  );
  assert.equal(calls.some(([name]) => name === "failRequest"), false);
});

test("activate performs only candidate preflight", async () => {
  const value = request("activate");
  const preflight = {request: value, candidate: {candidateDigest: "exact"}};
  const {calls, persistence} = fakePersistence({
    request: value,
    preflight,
  });
  let resolutionCount = 0;
  const result = await execute(persistence, async () => {
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
  const {calls, persistence} = fakePersistence({
    request: value,
    preflightError: failure,
  });

  await assert.rejects(
    execute(persistence, async () => completedResult(value), value),
    (error) => error === failure,
  );
  assert.deepEqual(calls.map(([name]) => name), [
    "claimRequest",
    "preflightActivation",
  ]);
});
