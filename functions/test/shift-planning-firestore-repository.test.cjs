const assert = require("node:assert/strict");
const {after, before, beforeEach, test} = require("node:test");
const {deleteApp, initializeApp} = require("firebase-admin/app");
const {getFirestore, Timestamp} = require("firebase-admin/firestore");
const {
  createFirestoreShiftPlanningRepository,
} = require("../lib/shift-planning-firestore-repository.js");
const {
  executeShiftPlanningRequest,
} = require("../lib/shift-planning-request-lifecycle.js");
const {
  buildShiftPlanningCompletedSummary,
} = require("../lib/shift-planning-persistence.js");
const {
  createShiftPlanningDigest,
} = require("../lib/shift-planning-digest.js");
const {
  buildShiftPlanningAuthoritativeState,
} = require("../lib/shift-planning-state-persistence.js");
const {
  buildShiftPlanningCandidatePositionSet,
} = require("../lib/shift-planning-candidate.js");
const {
  buildShiftPlanningFailureSummary,
} = require("../lib/shift-planning-wire.js");

const PROJECT_ID = "demo-reguerta-hu082-repository";
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
if (!EMULATOR_HOST) {
  throw new Error(
    "FIRESTORE_EMULATOR_HOST is required; use the repository emulator script.",
  );
}
const ENVIRONMENT = "develop";
const ROOT = `${ENVIRONMENT}/plus-collections`;
const REQUESTED_AT_MILLIS = 1_782_643_200_000;
const BUNDLE_DIGEST = `shift-planning:v1:sha256:${"a".repeat(64)}`;
const BUNDLE_REVISION = "bundle-v2-aaaaaaaaaaaaaaaaaaaaaaaa";

let app;
let firestore;
let nowMillis;
let repository;

const clearFirestore = async () => {
  const response = await fetch(
    `http://${EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/` +
      "databases/(default)/documents",
    {method: "DELETE"},
  );
  assert.equal(response.ok, true, await response.text());
};

before(async () => {
  app = initializeApp({projectId: PROJECT_ID}, "hu082-repository-tests");
  firestore = getFirestore(app);
});

after(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await clearFirestore();
  nowMillis = REQUESTED_AT_MILLIS + 1_000;
  repository = createFirestoreShiftPlanningRepository(
    firestore,
    () => Timestamp.fromMillis(nowMillis),
  );
});

const requestPath = (requestId) =>
  `${ROOT}/shiftPlanningRequests/${requestId}`;

const operationPath = (requestId) =>
  `${ROOT}/shiftPlanningOperations/request-${requestId}`;

const bundlePath = (revision = BUNDLE_REVISION) =>
  `${ROOT}/shiftPlanningBundles/${revision}`;

const candidatePath = (candidateId = "bundle-2026") =>
  `${ROOT}/shiftPlanningCandidates/${candidateId}`;

const candidatePositionPath = (
  positionId,
  candidateId = "bundle-2026",
) => `${candidatePath(candidateId)}/positions/${positionId}`;

const candidatePositionPaths = (candidateId = "bundle-2026") => [
  candidatePositionPath("shift_delivery_20260903", candidateId),
  candidatePositionPath("shift_market_20260927", candidateId),
];

const planningDocumentPaths = async () => {
  const paths = [];
  const visitCollection = async (collection) => {
    const snapshot = await collection.get();
    for (const document of snapshot.docs) {
      paths.push(document.ref.path);
      const children = await document.ref.listCollections();
      for (const child of children) {
        await visitCollection(child);
      }
    }
  };
  const collections = await firestore.doc(ROOT).listCollections();
  for (const collection of collections) {
    await visitCollection(collection);
  }
  return paths.sort();
};

const assertPlanningDocuments = async (expected) => {
  assert.deepEqual(await planningDocumentPaths(), [...expected].sort());
};

const requestDocument = ({
  requestId,
  mode = "preview",
  binding = null,
  environment = ENVIRONMENT,
  bundleId = "bundle-2026",
}) => ({
  schemaVersion: 2,
  requestId,
  bundleId,
  environment,
  requestedByUserId: "admin-001",
  requestedAt: Timestamp.fromMillis(REQUESTED_AT_MILLIS),
  mode,
  status: "requested",
  expectedWriteEpoch: 7,
  expectedActiveRevision: "active-6",
  subplans: {
    delivery: {targetSeasonStartYear: 2026},
    market: {targetSeasonStartYear: 2026},
  },
  binding,
});

const seedRequest = async (input) => {
  const document = requestDocument(input);
  await firestore.doc(requestPath(document.requestId)).set(document);
  return document;
};

const emptyBudget = (direction) => {
  const createWrites = direction === "forward" ? 2 : 0;
  const updateWrites = 5;
  const deleteWrites = direction === "inverse" ? 2 : 0;
  return {
    direction,
    writeLimit: 500,
    publicShiftWrites: 0,
    predecessorHelperWrites: 0,
    rotationWrites: 2,
    activeStateWrites: 1,
    bundleMetadataWrites: 0,
    requestWrites: 1,
    stagedCandidateWrites: 0,
    syncCommandWrites: 2,
    operationRegistryWrites: 1,
    beforeImageWrites: 0,
    heldIntentWrites: 0,
    creditLedgerWrites: 0,
    createWrites,
    updateWrites,
    deleteWrites,
    totalWrites: createWrites + updateWrites + deleteWrites,
    byteEstimate: {
      status: "requiresPersistenceAdapter",
      estimatedBytes: null,
      configuredByteLimit: 10 * 1024 * 1024,
    },
  };
};

const authoritativeState = () => buildShiftPlanningAuthoritativeState({
  environment: ENVIRONMENT,
  maintenance: {
    schemaVersion: 1,
    stateRevision: 12,
    writeEpoch: 7,
    maintenanceStatus: "closed",
    activeRevision: "active-6",
    activeDigest: `shift-planning:v1:sha256:${"b".repeat(64)}`,
    intakeBarrier: {
      revision: "rules-barrier-10",
      digest: `shift-planning:v1:sha256:${"4".repeat(64)}`,
      verifiedAtMillis: REQUESTED_AT_MILLIS - 1_000,
    },
    lastTransitionId: "enter-001",
  },
  rotations: {
    delivery: rotationState("delivery", 4, ["member-1", "member-2"]),
    market: rotationState("market", 5, ["member-2", "member-1"]),
  },
});

function rotationState(type, stateRevision, cohortUserIds) {
  return {
    schemaVersion: 1,
    type,
    stateRevision,
    cursor: {
      schemaVersion: 1,
      type,
      cohortUserIds,
      roundNumber: 2,
      nextMemberIndex: 1,
    },
    planningFrontierSeasonStartYear: 2026,
    cohortFrozen: true,
    frozenCohortUserIds: [...cohortUserIds],
    activeRevision: "active-6",
    activeDigest: `shift-planning:v1:sha256:${"b".repeat(64)}`,
    lastIdempotencyKey: "activate-6",
    migrationBaseline: {
      revision: "baseline-1",
      digest: `shift-planning:v1:sha256:${"5".repeat(64)}`,
    },
    releaseLease: null,
  };
}

const stableBundleFields = () => ({
  schemaVersion: 2,
  bundleId: "bundle-2026",
  environment: ENVIRONMENT,
  bundleRevision: BUNDLE_REVISION,
  bundleDigest: BUNDLE_DIGEST,
  expectedWriteEpoch: 7,
  activationWriteEpoch: 8,
  expectedActiveRevision: "active-6",
  expectedState: {
    schemaVersion: 2,
    authoritativeState: authoritativeState(),
    transactionMeasurementAuthority: {
      adapterRevision: "firestore-adapter-v1",
      indexConfigurationDigest:
        `shift-planning:v1:sha256:${"c".repeat(64)}`,
    },
  },
  frontiers: {
    delivery: {
      frontierBefore: {
        seasonStartYear: 2026,
        stateRevision: 4,
        cursorDigest: `shift-planning:v1:sha256:${"d".repeat(64)}`,
      },
      frontierAfter: {
        seasonStartYear: 2027,
        stateRevision: 5,
        cursorDigest: `shift-planning:v1:sha256:${"e".repeat(64)}`,
      },
    },
    market: {
      frontierBefore: {
        seasonStartYear: 2026,
        stateRevision: 5,
        cursorDigest: `shift-planning:v1:sha256:${"f".repeat(64)}`,
      },
      frontierAfter: {
        seasonStartYear: 2027,
        stateRevision: 6,
        cursorDigest: `shift-planning:v1:sha256:${"1".repeat(64)}`,
      },
    },
  },
  delivery: {
    shifts: [{
      type: "delivery",
      date: "2026-09-03",
      projectionSeasonStartYear: 2026,
      rotationOwnerUserId: "member-1",
      assignedUserIds: ["member-1"],
      helperUserId: "member-2",
      roundNumber: 2,
      positionInRound: 2,
      planningReason: "target",
      source: "app",
      origin: "planner",
      planningRequestId: "bundle-2026",
    }],
    affectedProjectionSeasonStartYears: [2026],
  },
  market: {
    shifts: [{
      type: "market",
      date: "2026-09-27",
      projectionSeasonStartYear: 2026,
      rotationOwnerUserIds: ["member-1", "member-2", "member-3"],
      assignedUserIds: ["member-1", "member-2", "member-3"],
      rotationPositions: [
        {
          rotationOwnerUserId: "member-1",
          roundNumber: 2,
          positionInRound: 2,
          planningReason: "target",
        },
        {
          rotationOwnerUserId: "member-2",
          roundNumber: 2,
          positionInRound: 3,
          planningReason: "target",
        },
        {
          rotationOwnerUserId: "member-3",
          roundNumber: 2,
          positionInRound: 4,
          planningReason: "target",
        },
      ],
      source: "app",
      origin: "planner",
      planningRequestId: "bundle-2026",
    }],
    affectedProjectionSeasonStartYears: [2026],
  },
  manifests: {
    forward: {kind: "forward-fixture"},
    inverse: {kind: "inverse-fixture"},
  },
  budgets: {
    forward: emptyBudget("forward"),
    inverse: emptyBudget("inverse"),
  },
  releaseLeaseIntents: [],
  syncCommands: [],
  heldNotificationIntents: [],
  transactionRequirements: {
    writeLimit: 500,
    byteLimit: 10 * 1024 * 1024,
    forwardManifestDigest:
      `shift-planning:v1:sha256:${"2".repeat(64)}`,
    inverseManifestDigest:
      `shift-planning:v1:sha256:${"3".repeat(64)}`,
  },
});

const previewResult = (requestId = "preview-001") => {
  const stable = stableBundleFields();
  const receipt = {
    schemaVersion: 2,
    status: "completed",
    mode: "preview",
    requestId,
    bundleId: "bundle-2026",
    bundleRevision: BUNDLE_REVISION,
    bundleDigest: BUNDLE_DIGEST,
    environment: ENVIRONMENT,
    requestedByUserId: "admin-001",
    expectedStateDigest: createShiftPlanningDigest(stable.expectedState),
  };
  return {
    ...stable,
    requestId,
    mode: "preview",
    stagedCandidate: null,
    stagedCandidateDigest: null,
    previewReceipt: receipt,
    previewReceiptDigest: createShiftPlanningDigest(receipt),
  };
};

const stageResult = (
  requestId = "stage-001",
  preview = previewResult(),
) => {
  const stable = stableBundleFields();
  const candidate = {
    schemaVersion: 2,
    status: "staged",
    candidateId: "bundle-2026",
    bundleId: "bundle-2026",
    bundleRevision: BUNDLE_REVISION,
    bundleDigest: BUNDLE_DIGEST,
    environment: ENVIRONMENT,
    requestedByUserId: "admin-001",
    sourcePreviewRequestId: preview.requestId,
    sourcePreviewReceiptDigest: preview.previewReceiptDigest,
    sourceStageRequestId: requestId,
    expectedStateDigest: preview.previewReceipt.expectedStateDigest,
    positionManifest: buildShiftPlanningCandidatePositionSet({
      candidateId: "bundle-2026",
      bundleRevision: BUNDLE_REVISION,
      bundleDigest: BUNDLE_DIGEST,
      writeEpoch: stable.activationWriteEpoch,
      delivery: stable.delivery,
      market: stable.market,
    }).manifest,
  };
  return {
    ...stable,
    requestId,
    mode: "stage",
    stagedCandidate: candidate,
    stagedCandidateDigest: createShiftPlanningDigest(candidate),
    previewReceipt: preview.previewReceipt,
    previewReceiptDigest: preview.previewReceiptDigest,
  };
};

const claim = (requestId, workerId) => repository.claimRequest({
  environment: ENVIRONMENT,
  requestId,
  operationId: `request-${requestId}`,
  workerId,
  leaseDurationMillis: 10_000,
});

const completePreview = async (requestId = "preview-001") => {
  await seedRequest({requestId});
  const acquired = await claim(requestId, "worker-preview");
  assert.equal(acquired.kind, "process");
  const result = previewResult(requestId);
  const summary = buildShiftPlanningCompletedSummary(result);
  assert.equal(
    await repository.completePreview({
      token: acquired.token,
      result,
      summary,
    }),
    "committed",
  );
  return {acquired, result, summary};
};

const completeStageFixture = async (requestId = "stage-001") => {
  const {result: preview} = await completePreview();
  await seedRequest({
    requestId,
    mode: "stage",
    binding: {
      kind: "preview",
      sourceRequestId: "preview-001",
      bundleRevision: BUNDLE_REVISION,
      bundleDigest: BUNDLE_DIGEST,
    },
  });
  const acquired = await claim(requestId, `worker-${requestId}`);
  assert.equal(acquired.kind, "process");
  const result = stageResult(requestId, preview);
  assert.equal(
    await repository.completeStage({
      token: acquired.token,
      result,
      summary: buildShiftPlanningCompletedSummary(result),
    }),
    "committed",
  );
  return {acquired, result};
};

test("completed summaries keep wire v1 for bundle v2 artifacts", () => {
  const result = previewResult("preview-wire-version");
  const summary = buildShiftPlanningCompletedSummary(result);
  assert.equal(result.schemaVersion, 2);
  assert.equal(summary.schemaVersion, 1);
});

test("claim is exclusive and an expired takeover fences the old worker", async () => {
  await seedRequest({requestId: "preview-claim"});
  const first = await Promise.all([
    claim("preview-claim", "worker-a"),
    claim("preview-claim", "worker-b"),
  ]);
  assert.deepEqual(first.map(({kind}) => kind).sort(), ["busy", "process"]);
  const owner = first.find(({kind}) => kind === "process");
  const busy = first.find(({kind}) => kind === "busy");
  assert.equal(busy.retryAfterMillis, 10_000);
  const nextWorker = owner.token.workerId === "worker-a" ?
    "worker-b" : "worker-a";
  const resumed = await claim("preview-claim", owner.token.workerId);
  assert.equal(resumed.kind, "resume");
  assert.equal(resumed.token.fencingEpoch, owner.token.fencingEpoch);

  const staleFailure = buildShiftPlanningFailureSummary({
    mode: "preview",
    bundleId: "bundle-2026",
    scope: "request",
    code: "internal_planning_failure",
  });

  nowMillis += 10_001;
  await assert.rejects(
    repository.failRequest({token: owner.token, summary: staleFailure}),
    (error) => error.code === "request_intent_conflict",
  );
  const takeover = await claim("preview-claim", nextWorker);
  assert.equal(takeover.kind, "process");
  assert.equal(takeover.token.fencingEpoch, 2);

  await assert.rejects(
    repository.failRequest({token: owner.token, summary: staleFailure}),
    (error) => error.code === "request_intent_conflict",
  );
  await assert.rejects(
    repository.failRequest({
      token: takeover.token,
      summary: {...staleFailure, errorMessage: "private diagnostic"},
    }),
    (error) => error.code === "request_intent_conflict",
  );
  assert.equal(
    (await firestore.doc(requestPath("preview-claim")).get()).get("status"),
    "processing",
  );
  assert.equal(
    await repository.failRequest({
      token: takeover.token,
      summary: staleFailure,
    }),
    "committed",
  );
  assert.equal(
    await repository.failRequest({
      token: takeover.token,
      summary: staleFailure,
    }),
    "replayed",
  );
  const stored = (await firestore.doc(requestPath("preview-claim")).get()).data();
  assert.equal(stored.status, "failed");
  assert.equal(Object.hasOwn(stored, "errorMessage"), false);
  const terminal = await claim("preview-claim", nextWorker);
  assert.equal(terminal.kind, "terminalReplay");
  assert.deepEqual(terminal.summary, staleFailure);
  assert.equal(terminal.artifact, null);
  await assertPlanningDocuments([
    requestPath("preview-claim"),
    operationPath("preview-claim"),
  ]);
});

test("preview persists one exact private receipt and replays terminally", async () => {
  const {acquired, result, summary} = await completePreview();
  assert.equal(
    await repository.completePreview({
      token: acquired.token,
      result,
      summary,
    }),
    "replayed",
  );
  const persisted = await repository.loadPersistedPreview({
    environment: ENVIRONMENT,
    requestId: "preview-001",
  });
  assert.deepEqual(persisted.receipt, result.previewReceipt);
  assert.equal(persisted.receiptDigest, result.previewReceiptDigest);
  const terminal = await claim("preview-001", "worker-terminal-replay");
  assert.equal(terminal.kind, "terminalReplay");
  assert.deepEqual(terminal.artifact.receipt, result.previewReceipt);

  for (const collection of [
    "shiftPlanningCandidates",
    "shifts",
    "shiftRotations",
    "shiftPlanningSyncCommands",
    "shiftPlanningNotificationIntents",
  ]) {
    const snapshot = await firestore.collection(`${ROOT}/${collection}`).get();
    assert.equal(snapshot.empty, true, collection);
  }
  await assertPlanningDocuments([
    requestPath("preview-001"),
    operationPath("preview-001"),
    bundlePath(),
  ]);
});

test("preview rejects noncanonical or mismatched receipt lineage", async () => {
  await seedRequest({requestId: "preview-invalid-receipt"});
  const acquired = await claim(
    "preview-invalid-receipt",
    "worker-preview",
  );
  assert.equal(acquired.kind, "process");
  const result = previewResult("preview-invalid-receipt");
  const extraReceipt = {...result.previewReceipt, unexpected: true};
  const extraResult = {
    ...result,
    previewReceipt: extraReceipt,
    previewReceiptDigest: createShiftPlanningDigest(extraReceipt),
  };
  await assert.rejects(
    repository.completePreview({
      token: acquired.token,
      result: extraResult,
      summary: buildShiftPlanningCompletedSummary(extraResult),
    }),
    (error) => typeof error.code === "string",
  );

  const wrongStateReceipt = {
    ...result.previewReceipt,
    expectedStateDigest:
      `shift-planning:v1:sha256:${"8".repeat(64)}`,
  };
  const wrongStateResult = {
    ...result,
    previewReceipt: wrongStateReceipt,
    previewReceiptDigest: createShiftPlanningDigest(wrongStateReceipt),
  };
  await assert.rejects(
    repository.completePreview({
      token: acquired.token,
      result: wrongStateResult,
      summary: buildShiftPlanningCompletedSummary(wrongStateResult),
    }),
    (error) => error.code === "request_intent_conflict",
  );

  const nonExactExpectedState = {
    ...result.expectedState,
    unexpected: true,
  };
  const nonExactReceipt = {
    ...result.previewReceipt,
    expectedStateDigest: createShiftPlanningDigest(nonExactExpectedState),
  };
  const nonExactStateResult = {
    ...result,
    expectedState: nonExactExpectedState,
    previewReceipt: nonExactReceipt,
    previewReceiptDigest: createShiftPlanningDigest(nonExactReceipt),
  };
  await assert.rejects(
    repository.completePreview({
      token: acquired.token,
      result: nonExactStateResult,
      summary: buildShiftPlanningCompletedSummary(nonExactStateResult),
    }),
    (error) => error.code === "invalid_planning_state",
  );
  assert.equal(
    (await firestore.doc(requestPath("preview-invalid-receipt")).get())
      .get("status"),
    "processing",
  );
  await assertPlanningDocuments([
    requestPath("preview-invalid-receipt"),
    operationPath("preview-invalid-receipt"),
  ]);
});

test("claims fail closed across environment paths", async () => {
  await seedRequest({
    requestId: "preview-cross-environment",
    environment: "production",
  });
  await assert.rejects(
    claim("preview-cross-environment", "worker-preview"),
    (error) => error.code === "request_intent_conflict",
  );
  await assertPlanningDocuments([
    requestPath("preview-cross-environment"),
  ]);
});

test("activate routing is normalized and read-only", async () => {
  await seedRequest({
    requestId: "activate-routing",
    mode: "activate",
    binding: {
      kind: "candidate",
      candidateId: "bundle-2026",
      bundleRevision: BUNDLE_REVISION,
      bundleDigest: BUNDLE_DIGEST,
      candidateDigest: `shift-planning:v1:sha256:${"9".repeat(64)}`,
    },
  });

  const claim = await repository.claimRequest({
    environment: ENVIRONMENT,
    requestId: "activate-routing",
    operationId: "request-activate-routing",
    workerId: "worker-activate-routing",
    leaseDurationMillis: 10_000,
  });

  assert.equal(claim.kind, "activationPreflight");
  assert.equal(claim.request.requestedAtMillis, REQUESTED_AT_MILLIS);
  assert.equal(claim.request.mode, "activate");
  await assertPlanningDocuments([requestPath("activate-routing")]);
});

test("stage loads the persisted preview and never overwrites a candidate", async () => {
  const {result: preview} = await completePreview();
  await seedRequest({
    requestId: "stage-001",
    mode: "stage",
    binding: {
      kind: "preview",
      sourceRequestId: "preview-001",
      bundleRevision: BUNDLE_REVISION,
      bundleDigest: BUNDLE_DIGEST,
    },
  });
  const acquired = await claim("stage-001", "worker-stage");
  assert.equal(acquired.kind, "process");
  const result = stageResult("stage-001", preview);
  const summary = buildShiftPlanningCompletedSummary(result);
  const divergentCandidate = {
    ...result,
    stagedCandidate: {
      ...result.stagedCandidate,
      sourceStageRequestId: "stage-other",
    },
  };
  await assert.rejects(
    repository.completeStage({
      token: acquired.token,
      result: divergentCandidate,
      summary,
    }),
    (error) => error.code === "request_intent_conflict",
  );
  assert.deepEqual(
    (await Promise.all([
      repository.completeStage({token: acquired.token, result, summary}),
      repository.completeStage({token: acquired.token, result, summary}),
    ])).sort(),
    ["committed", "replayed"],
  );
  const stagedCandidatePath = candidatePath();
  const candidate = (await firestore.doc(stagedCandidatePath).get()).data();
  assert.equal(candidate.candidateDigest, result.stagedCandidateDigest);
  assert.equal(
    createShiftPlanningDigest(candidate.candidate),
    candidate.candidateDigest,
  );
  const positionSnapshots = await firestore
    .collection(`${stagedCandidatePath}/positions`)
    .get();
  assert.equal(positionSnapshots.size, 2);
  const positions = positionSnapshots.docs
    .map((snapshot) => snapshot.data())
    .sort((left, right) => left.positionId.localeCompare(right.positionId));
  assert.deepEqual(
    positions.map(({position}) => position.type),
    ["delivery", "market"],
  );
  assert.equal(positions[0].position.rotationPositions.length, 1);
  assert.equal(positions[1].position.rotationPositions.length, 3);
  assert.equal(
    positions.every((position) =>
      position.candidateDigest === candidate.candidateDigest),
    true,
  );
  assert.equal(
    await repository.completeStage({token: acquired.token, result, summary}),
    "replayed",
  );
  await assertPlanningDocuments([
    requestPath("preview-001"),
    operationPath("preview-001"),
    bundlePath(),
    requestPath("stage-001"),
    operationPath("stage-001"),
    candidatePath(),
    ...candidatePositionPaths(),
  ]);

  await firestore.doc(stagedCandidatePath).update({
    candidateDigest: `shift-planning:v1:sha256:${"9".repeat(64)}`,
  });
  await assert.rejects(
    repository.completeStage({token: acquired.token, result, summary}),
    (error) => error.code === "request_intent_conflict",
  );
  await assert.rejects(
    claim("stage-001", "worker-terminal-replay"),
    (error) => error.code === "request_intent_conflict",
  );
  await seedRequest({
    requestId: "activate-tampered",
    mode: "activate",
    binding: {
      kind: "candidate",
      candidateId: "bundle-2026",
      bundleRevision: BUNDLE_REVISION,
      bundleDigest: BUNDLE_DIGEST,
      candidateDigest: result.stagedCandidateDigest,
    },
  });
  await assert.rejects(
    repository.preflightActivation({
      environment: ENVIRONMENT,
      requestId: "activate-tampered",
    }),
    (error) => error.code === "request_intent_conflict",
  );
});

test("stage rejects noncanonical or mismatched candidate lineage", async () => {
  const {result: preview} = await completePreview();
  await seedRequest({
    requestId: "stage-invalid-candidate",
    mode: "stage",
    binding: {
      kind: "preview",
      sourceRequestId: "preview-001",
      bundleRevision: BUNDLE_REVISION,
      bundleDigest: BUNDLE_DIGEST,
    },
  });
  const acquired = await claim(
    "stage-invalid-candidate",
    "worker-stage",
  );
  assert.equal(acquired.kind, "process");
  const result = stageResult("stage-invalid-candidate", preview);
  const mutations = [
    (candidate) => ({...candidate, unexpected: true}),
    (candidate) => ({
      ...candidate,
      transactionEvidence: {unexpected: true},
    }),
    (candidate) => ({
      ...candidate,
      sourcePreviewRequestId: "preview-other",
    }),
    (candidate) => ({
      ...candidate,
      sourceStageRequestId: "stage-other",
    }),
    (candidate) => ({
      ...candidate,
      requestedByUserId: "admin-other",
    }),
    (candidate) => ({
      ...candidate,
      expectedStateDigest:
        `shift-planning:v1:sha256:${"8".repeat(64)}`,
    }),
  ];
  for (const mutate of mutations) {
    const stagedCandidate = mutate(result.stagedCandidate);
    const invalidResult = {
      ...result,
      stagedCandidate,
      stagedCandidateDigest: createShiftPlanningDigest(stagedCandidate),
    };
    await assert.rejects(
      repository.completeStage({
        token: acquired.token,
        result: invalidResult,
        summary: buildShiftPlanningCompletedSummary(invalidResult),
      }),
      (error) => typeof error.code === "string",
    );
  }
  assert.equal(
    (await firestore.doc(requestPath("stage-invalid-candidate")).get())
      .get("status"),
    "processing",
  );
  await assertPlanningDocuments([
    requestPath("preview-001"),
    operationPath("preview-001"),
    bundlePath(),
    requestPath("stage-invalid-candidate"),
    operationPath("stage-invalid-candidate"),
  ]);
});

test("stage rejects an identical candidate that predates completion", async () => {
  const {result: preview} = await completePreview();
  await seedRequest({
    requestId: "stage-collision",
    mode: "stage",
    binding: {
      kind: "preview",
      sourceRequestId: "preview-001",
      bundleRevision: BUNDLE_REVISION,
      bundleDigest: BUNDLE_DIGEST,
    },
  });
  const acquired = await claim("stage-collision", "worker-stage");
  assert.equal(acquired.kind, "process");
  const result = stageResult("stage-collision", preview);
  const bundle = (await firestore.doc(
    `${ROOT}/shiftPlanningBundles/${BUNDLE_REVISION}`,
  ).get()).data();
  await firestore.doc(
    `${ROOT}/shiftPlanningCandidates/bundle-2026`,
  ).set({
    schemaVersion: 1,
    status: "staged",
    environment: ENVIRONMENT,
    bundleId: result.bundleId,
    bundleRevision: result.bundleRevision,
    bundleDigest: result.bundleDigest,
    candidate: result.stagedCandidate,
    candidateDigest: result.stagedCandidateDigest,
    bundleArtifactDigest: bundle.artifactDigest,
  });

  await assert.rejects(
    repository.completeStage({
      token: acquired.token,
      result,
      summary: buildShiftPlanningCompletedSummary(result),
    }),
    (error) => error.code === "request_intent_conflict",
  );
  assert.equal(
    (await firestore.doc(requestPath("stage-collision")).get()).get("status"),
    "processing",
  );
});

test("activate preflight reads the exact immutable candidate package", async () => {
  const {result: preview} = await completePreview();
  await seedRequest({
    requestId: "stage-activate",
    mode: "stage",
    binding: {
      kind: "preview",
      sourceRequestId: "preview-001",
      bundleRevision: BUNDLE_REVISION,
      bundleDigest: BUNDLE_DIGEST,
    },
  });
  const stageClaim = await claim("stage-activate", "worker-stage");
  assert.equal(stageClaim.kind, "process");
  const staged = stageResult("stage-activate", preview);
  await repository.completeStage({
    token: stageClaim.token,
    result: staged,
    summary: buildShiftPlanningCompletedSummary(staged),
  });
  await seedRequest({
    requestId: "activate-001",
    mode: "activate",
    binding: {
      kind: "candidate",
      candidateId: "bundle-2026",
      bundleRevision: BUNDLE_REVISION,
      bundleDigest: BUNDLE_DIGEST,
      candidateDigest: staged.stagedCandidateDigest,
    },
  });

  const preflight = await repository.preflightActivation({
    environment: ENVIRONMENT,
    requestId: "activate-001",
  });
  assert.equal(preflight.candidate.candidateDigest, staged.stagedCandidateDigest);
  assert.equal(
    preflight.bundle.artifactDigest,
    preflight.candidate.bundleArtifactDigest,
  );
  assert.deepEqual(
    preflight.positions.map(({positionId}) => positionId),
    ["shift_delivery_20260903", "shift_market_20260927"],
  );
  assert.equal(
    (await firestore.doc(requestPath("activate-001")).get()).get("status"),
    "requested",
  );
  assert.equal(
    (await firestore.doc(
      `${ROOT}/shiftPlanningOperations/request-activate-001`,
    ).get()).exists,
    false,
  );
  assert.equal(
    (await firestore.collection(`${ROOT}/shifts`).get()).empty,
    true,
  );
  await assertPlanningDocuments([
    requestPath("preview-001"),
    operationPath("preview-001"),
    requestPath("stage-activate"),
    operationPath("stage-activate"),
    bundlePath(),
    candidatePath(),
    ...candidatePositionPaths(),
    requestPath("activate-001"),
  ]);
});

test("activate preflight rejects incomplete or altered candidate packages", async () => {
  const {result: staged} = await completeStageFixture("stage-integrity");
  await seedRequest({
    requestId: "activate-integrity",
    mode: "activate",
    binding: {
      kind: "candidate",
      candidateId: "bundle-2026",
      bundleRevision: BUNDLE_REVISION,
      bundleDigest: BUNDLE_DIGEST,
      candidateDigest: staged.stagedCandidateDigest,
    },
  });
  const deliveryReference = firestore.doc(candidatePositionPaths()[0]);
  const marketReference = firestore.doc(candidatePositionPaths()[1]);
  const delivery = (await deliveryReference.get()).data();
  const market = (await marketReference.get()).data();

  await deliveryReference.delete();
  await assert.rejects(
    repository.preflightActivation({
      environment: ENVIRONMENT,
      requestId: "activate-integrity",
    }),
    (error) => error.code === "request_intent_conflict",
  );
  await deliveryReference.set(delivery);

  const extraReference = firestore.doc(
    candidatePositionPath("shift_market_extra"),
  );
  await extraReference.set(market);
  await assert.rejects(
    repository.preflightActivation({
      environment: ENVIRONMENT,
      requestId: "activate-integrity",
    }),
    (error) => error.code === "request_intent_conflict",
  );
  await extraReference.delete();

  await marketReference.update({
    "position.assignedUserIds": ["member-3", "member-2", "member-1"],
  });
  await assert.rejects(
    repository.preflightActivation({
      environment: ENVIRONMENT,
      requestId: "activate-integrity",
    }),
    (error) => error.code === "request_intent_conflict",
  );
  await marketReference.set(market);
  assert.equal(
    (await repository.preflightActivation({
      environment: ENVIRONMENT,
      requestId: "activate-integrity",
    })).positions.length,
    2,
  );

  await firestore.doc(bundlePath()).delete();
  await assert.rejects(
    repository.preflightActivation({
      environment: ENVIRONMENT,
      requestId: "activate-integrity",
    }),
    (error) => error.code === "candidate_binding_mismatch",
  );
  assert.equal(
    (await firestore.doc(requestPath("activate-integrity")).get())
      .get("status"),
    "requested",
  );
  assert.equal(
    (await firestore.doc(operationPath("activate-integrity")).get()).exists,
    false,
  );
  assert.equal(
    (await firestore.collection(`${ROOT}/shifts`).get()).empty,
    true,
  );
});

test("activate preflight rejects an aliased candidate document path", async () => {
  const {result: preview} = await completePreview();
  await seedRequest({
    requestId: "stage-alias",
    mode: "stage",
    binding: {
      kind: "preview",
      sourceRequestId: "preview-001",
      bundleRevision: BUNDLE_REVISION,
      bundleDigest: BUNDLE_DIGEST,
    },
  });
  const stageClaim = await claim("stage-alias", "worker-stage");
  assert.equal(stageClaim.kind, "process");
  const staged = stageResult("stage-alias", preview);
  await repository.completeStage({
    token: stageClaim.token,
    result: staged,
    summary: buildShiftPlanningCompletedSummary(staged),
  });
  const canonicalCandidate = (
    await firestore.doc(candidatePath()).get()
  ).data();
  await firestore.doc(candidatePath("candidate-alias")).set(
    canonicalCandidate,
  );
  await seedRequest({
    requestId: "activate-alias",
    mode: "activate",
    bundleId: "candidate-alias",
    binding: {
      kind: "candidate",
      candidateId: "candidate-alias",
      bundleRevision: BUNDLE_REVISION,
      bundleDigest: BUNDLE_DIGEST,
      candidateDigest: staged.stagedCandidateDigest,
    },
  });

  await assert.rejects(
    repository.preflightActivation({
      environment: ENVIRONMENT,
      requestId: "activate-alias",
    }),
    (error) => error.code === "candidate_binding_mismatch",
  );
  assert.equal(
    (await firestore.doc(requestPath("activate-alias")).get()).get("status"),
    "requested",
  );
  assert.equal(
    (await firestore.doc(operationPath("activate-alias")).get()).exists,
    false,
  );
});

test("private runtime drives preview and stage but only preflights activate", async () => {
  const stateLoads = [];
  const statePersistence = {
    loadAuthoritativeState: async (input) => {
      stateLoads.push(input);
      return authoritativeState();
    },
  };
  await seedRequest({requestId: "preview-runtime"});
  const previewExecution = await executeShiftPlanningRequest({
    persistence: repository,
    statePersistence,
    resolveBundle: async ({
      persistedPreview: source,
      authoritativeState: loadedState,
    }) => {
      assert.equal(source, null);
      assert.equal(
        loadedState.authoritativeDigest,
        authoritativeState().authoritativeDigest,
      );
      return previewResult("preview-runtime");
    },
    environment: ENVIRONMENT,
    requestId: "preview-runtime",
    operationId: "request-preview-runtime",
    workerId: "worker-preview-runtime",
    leaseDurationMillis: 10_000,
  });
  assert.equal(previewExecution.kind, "completed");

  await seedRequest({
    requestId: "stage-runtime",
    mode: "stage",
    binding: {
      kind: "preview",
      sourceRequestId: "preview-runtime",
      bundleRevision: BUNDLE_REVISION,
      bundleDigest: BUNDLE_DIGEST,
    },
  });
  const stageExecution = await executeShiftPlanningRequest({
    persistence: repository,
    statePersistence,
    resolveBundle: async ({
      persistedPreview: source,
      authoritativeState: loadedState,
    }) => {
      assert.equal(source.receipt.requestId, "preview-runtime");
      assert.equal(
        loadedState.authoritativeDigest,
        authoritativeState().authoritativeDigest,
      );
      return stageResult("stage-runtime", previewExecution.result);
    },
    environment: ENVIRONMENT,
    requestId: "stage-runtime",
    operationId: "request-stage-runtime",
    workerId: "worker-stage-runtime",
    leaseDurationMillis: 10_000,
  });
  assert.equal(stageExecution.kind, "completed");

  await seedRequest({
    requestId: "activate-runtime",
    mode: "activate",
    binding: {
      kind: "candidate",
      candidateId: "bundle-2026",
      bundleRevision: BUNDLE_REVISION,
      bundleDigest: BUNDLE_DIGEST,
      candidateDigest: stageExecution.result.stagedCandidateDigest,
    },
  });
  let activateResolverCalls = 0;
  const activateExecution = await executeShiftPlanningRequest({
    persistence: repository,
    statePersistence,
    resolveBundle: async () => {
      activateResolverCalls += 1;
      return stageExecution.result;
    },
    environment: ENVIRONMENT,
    requestId: "activate-runtime",
    operationId: "request-activate-runtime",
    workerId: "worker-activate-runtime",
    leaseDurationMillis: 10_000,
  });
  assert.equal(activateExecution.kind, "activationPreflight");
  assert.equal(activateResolverCalls, 0);
  assert.deepEqual(stateLoads, [
    {environment: ENVIRONMENT},
    {environment: ENVIRONMENT},
  ]);
  assert.equal(
    (await firestore.doc(operationPath("activate-runtime")).get()).exists,
    false,
  );
  await assertPlanningDocuments([
    requestPath("preview-runtime"),
    operationPath("preview-runtime"),
    bundlePath(),
    requestPath("stage-runtime"),
    operationPath("stage-runtime"),
    candidatePath(),
    ...candidatePositionPaths(),
    requestPath("activate-runtime"),
  ]);
});
