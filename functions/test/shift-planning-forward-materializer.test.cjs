"use strict";

const assert = require("node:assert/strict");
const {test} = require("node:test");
const {
  Firestore,
  Timestamp,
} = require("@google-cloud/firestore");

const {
  planShiftPlanningBundle,
} = require("../lib/shift-planning-bundle.js");
const {
  buildShiftPlanningCandidatePositionSet,
  persistShiftPlanningCandidatePosition,
} = require("../lib/shift-planning-candidate.js");
const {
  createShiftPlanningDigest,
} = require("../lib/shift-planning-digest.js");
const {
  materializeShiftPlanningForwardActivation,
  measureAndSealShiftPlanningForwardActivationAttempt,
} = require("../lib/shift-planning-forward-materializer.js");
const {
  attachShiftPlanningBackendMutationMarker,
  buildShiftPlanningPublicShiftMaterialization,
  createShiftPlanningActivationOperationTerminal,
  createShiftPlanningPublicShiftMaterialization,
} = require("../lib/shift-planning-publication-contract.js");
const {
  SHIFT_PLANNING_FIRESTORE_COMMIT_ADAPTER_REVISION,
} = require(
  "../lib/shift-planning-firestore-transaction-serializer.js"
);
const {
  buildShiftPlanningAuthoritativeState,
} = require("../lib/shift-planning-state-persistence.js");
const {
  parseShiftPlanningRequestV2,
} = require("../lib/shift-planning-wire.js");

const memberIds = Array.from(
  {length: 6},
  (_, index) => `member-${index + 1}`,
);
const activeDigest =
  `shift-planning:v1:sha256:${"d".repeat(64)}`;
const attemptedAt = Timestamp.fromMillis(1_788_307_200_000);

const rotation = (type, cohortUserIds) => ({
  schemaVersion: 1,
  type,
  stateRevision: type === "delivery" ? 4 : 7,
  cursor: {
    schemaVersion: 1,
    type,
    cohortUserIds,
    roundNumber: 1,
    nextMemberIndex: 0,
  },
  planningFrontierSeasonStartYear: 2026,
  cohortFrozen: false,
  frozenCohortUserIds: [],
  activeRevision: "active-6",
  activeDigest,
  lastIdempotencyKey: null,
  migrationBaseline: null,
  releaseLease: null,
});

const fairnessSnapshot = () => ({
  snapshotVersion: 1,
  environment: "develop",
  writeEpoch: 7,
  activeRevision: "active-6",
  activeDigest,
  membership: {
    revision: "membership-12",
    digest: "membership-digest-12",
  },
  roster: memberIds.map((userId, index) => ({
    userId,
    roles: index === 0 ? ["admin", "member"] : ["member"],
    isActive: true,
    isCommonPurchaseManager: false,
    membershipRevision: index + 1,
    eligibilityRevision: 20 + index,
    destinationRevision: 40 + index,
  })),
  rotations: {
    delivery: rotation("delivery", memberIds),
    market: rotation("market", [
      "member-3",
      "member-2",
      "member-1",
      "member-6",
      "member-5",
      "member-4",
    ]),
  },
  config: {
    revision: "config-3",
    policyRevision: "hu-082-v1",
    deliveryWeekday: "THU",
    timeZone: "Europe/Madrid",
    releaseLeaseDurationMillis: 900_000,
  },
  calendar: {
    revision: "calendar-9",
    deliveryOverrideRevision: "delivery-calendar-2",
    marketCalendarRevision: "market-calendar-1",
  },
  overrides: {
    revision: "overrides-2",
    digest: "overrides-digest-2",
  },
  creditLedger: {
    enabled: false,
    revision: "credits-disabled-v1",
    digest: "credits-disabled-digest-v1",
    plannedWriteCount: 0,
  },
  sync: {
    leaseDurationMillis: 120_000,
    transactionMeasurementAuthority: {
      adapterRevision:
        SHIFT_PLANNING_FIRESTORE_COMMIT_ADAPTER_REVISION,
      indexConfigurationDigest:
        `shift-planning:v1:sha256:${"1".repeat(64)}`,
    },
    partitions: {
      delivery: {
        workbookId: "reguerta-shifts",
        workbookRevision: "workbook-3",
        partitionKey: "delivery",
        stateRevision: 3,
        epoch: 11,
        lease: null,
      },
      market: {
        workbookId: "reguerta-shifts",
        workbookRevision: "workbook-3",
        partitionKey: "market",
        stateRevision: 5,
        epoch: 14,
        lease: null,
      },
    },
  },
  migrationBaseline: null,
});

const maintenanceState = (snapshot) => ({
  schemaVersion: 1,
  stateRevision: 11,
  writeEpoch: snapshot.writeEpoch,
  maintenanceStatus: "closed",
  activeRevision: snapshot.activeRevision,
  activeDigest: snapshot.activeDigest,
  intakeBarrier: {
    revision: "barrier-v1",
    digest: `shift-planning:v1:sha256:${"a".repeat(64)}`,
    verifiedAtMillis: 1_782_643_100_000,
  },
  lastTransitionId: "maintenance-enter-1",
});

const authoritativeState = (snapshot) =>
  buildShiftPlanningAuthoritativeState({
    environment: snapshot.environment,
    maintenance: maintenanceState(snapshot),
    rotations: snapshot.rotations,
  });

const request = (overrides = {}) => ({
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

const bundleInput = (snapshot, requestValue, overrides = {}) => ({
  request: requestValue,
  authoritativeState: authoritativeState(snapshot),
  fairnessSnapshot: snapshot,
  delivery: {continuity: {kind: "newRotation"}},
  market: {},
  transactionWriteLimit: 500,
  ...overrides,
});

const previewBinding = (result) => ({
  kind: "preview",
  sourceRequestId: result.requestId,
  bundleRevision: result.bundleRevision,
  bundleDigest: result.bundleDigest,
});

const candidateBinding = (result) => ({
  kind: "candidate",
  candidateId: result.bundleId,
  bundleRevision: result.bundleRevision,
  bundleDigest: result.bundleDigest,
  candidateDigest: result.stagedCandidateDigest,
});

const bundleArtifact = (result) => ({
  schemaVersion: result.schemaVersion,
  bundleId: result.bundleId,
  environment: result.environment,
  bundleRevision: result.bundleRevision,
  bundleDigest: result.bundleDigest,
  expectedWriteEpoch: result.expectedWriteEpoch,
  activationWriteEpoch: result.activationWriteEpoch,
  expectedActiveRevision: result.expectedActiveRevision,
  expectedState: result.expectedState,
  frontiers: result.frontiers,
  delivery: result.delivery,
  market: result.market,
  manifests: result.manifests,
  budgets: result.budgets,
  releaseLeaseIntents: result.releaseLeaseIntents,
  syncCommands: result.syncCommands,
  heldNotificationIntents: result.heldNotificationIntents,
  transactionRequirements: result.transactionRequirements,
});

const fixture = (snapshot = fairnessSnapshot(), planningOverrides = {}) => {
  const preview = planShiftPlanningBundle(bundleInput(
    snapshot,
    request(),
    planningOverrides,
  ));
  const stageRequest = request({
    requestId: "request-stage-2026",
    requestedAt: Timestamp.fromMillis(1_782_643_260_000),
    mode: "stage",
    binding: previewBinding(preview),
  });
  const stage = planShiftPlanningBundle(bundleInput(
    snapshot,
    stageRequest,
    {...planningOverrides, persistedPreview: preview.previewReceipt},
  ));
  const activateRequest = request({
    requestId: "request-activate-2026",
    requestedAt: Timestamp.fromMillis(1_782_643_320_000),
    mode: "activate",
    binding: candidateBinding(stage),
  });
  const activate = planShiftPlanningBundle(bundleInput(
    snapshot,
    activateRequest,
    {...planningOverrides, stagedCandidate: stage.stagedCandidate},
  ));
  const artifact = bundleArtifact(activate);
  const bundle = {
    schemaVersion: 1,
    environment: activate.environment,
    bundleId: activate.bundleId,
    bundleRevision: activate.bundleRevision,
    bundleDigest: activate.bundleDigest,
    artifactDigest: createShiftPlanningDigest(artifact),
    artifact,
  };
  const candidate = {
    schemaVersion: 1,
    status: "staged",
    environment: stage.environment,
    bundleId: stage.bundleId,
    bundleRevision: stage.bundleRevision,
    bundleDigest: stage.bundleDigest,
    candidate: stage.stagedCandidate,
    candidateDigest: stage.stagedCandidateDigest,
    bundleArtifactDigest: bundle.artifactDigest,
  };
  const positionSet = buildShiftPlanningCandidatePositionSet({
    candidateId: stage.bundleId,
    bundleRevision: stage.bundleRevision,
    bundleDigest: stage.bundleDigest,
    writeEpoch: stage.activationWriteEpoch,
    delivery: stage.delivery,
    market: stage.market,
  });
  const positions = positionSet.positions.map((position) =>
    persistShiftPlanningCandidatePosition({
      position,
      candidateDigest: stage.stagedCandidateDigest,
    }));
  return {
    preflight: {
      request: parseShiftPlanningRequestV2(activateRequest),
      candidate,
      bundle,
      positions,
    },
    liveResult: activate,
    requestDocumentData: activateRequest,
  };
};

const predecessorFixture = () => {
  const baseline = fixture();
  const firstDate = baseline.liveResult.delivery.shifts[0].date;
  const predecessorDate = new Date(`${firstDate}T00:00:00.000Z`);
  predecessorDate.setUTCDate(predecessorDate.getUTCDate() - 7);
  const scheduledDate = predecessorDate.toISOString().slice(0, 10);
  const continuity = {
    kind: "persistedAppend",
    predecessor: {
      shiftId: `shift_delivery_${scheduledDate.replace(/-/g, "")}`,
      scheduledDate,
      effectiveLeadUserId: "member-6",
      completion: {
        state: "uncompleted",
        assignmentRevision: 3,
        completionRevision: 0,
        plannedHelperUserId: null,
      },
    },
  };
  const value = fixture(fairnessSnapshot(), {
    delivery: {continuity},
  });
  const position = {
    schemaVersion: 1,
    positionId: continuity.predecessor.shiftId,
    candidateId: "prior-candidate",
    type: "delivery",
    shiftId: continuity.predecessor.shiftId,
    scheduledDate,
    projectionSeasonStartYear: 2025,
    rotationOwnerUserIds: ["member-6"],
    assignedUserIds: ["member-6"],
    rotationPositions: [{
      rotationOwnerUserId: "member-6",
      effectiveAssigneeUserId: "member-6",
      roundNumber: 1,
      positionInRound: 6,
      planningReason: "target",
    }],
    helperUserId: null,
    source: "app",
    origin: "planner",
    planningRequestId: "prior-request",
    bundleRevision: "active-6",
    bundleDigest: activeDigest,
    writeEpoch: 7,
  };
  const initial = buildShiftPlanningPublicShiftMaterialization({
    environment: "develop",
    position,
    attemptedAt: Timestamp.fromMillis(1_788_000_000_000),
  });
  const materialization = createShiftPlanningPublicShiftMaterialization({
    targetPath: initial.targetPath,
    payload: {
      ...initial.payload,
      assignmentRevision: 3,
      documentRevision: 4,
    },
  });
  const operation = createShiftPlanningActivationOperationTerminal({
    operationId: "request-prior-request",
    environment: "develop",
    requestId: "prior-request",
    candidateId: "prior-candidate",
    bundleRevision: "active-6",
    bundleDigest: activeDigest,
    forwardManifestDigest:
      `shift-planning:v1:sha256:${"8".repeat(64)}`,
    expectedStateDigest:
      `shift-planning:v1:sha256:${"9".repeat(64)}`,
    writeEpoch: 7,
    attemptedAt: Timestamp.fromMillis(1_788_000_000_000),
    publicMutations: [{
      mutationKind: "create",
      targetPath: materialization.targetPath,
      documentRevision: materialization.documentRevision,
      payloadDigest: materialization.payloadDigest,
    }],
    beforeImages: [],
  });
  return {
    value,
    predecessorDocument: attachShiftPlanningBackendMutationMarker({
      materialization,
      operation,
    }),
    predecessorPath: materialization.targetPath,
  };
};

const readDocument = (targetPath, data, millis) => ({
  targetPath,
  data,
  updateTime: Timestamp.fromMillis(millis),
});

const materializerInput = (value = fixture()) => {
  const expected = value.liveResult.expectedState.authoritativeState;
  const requestIntentDigest = createShiftPlanningDigest(
    value.preflight.request,
  );
  const acquiredAt = Timestamp.fromMillis(attemptedAt.toMillis() - 1_000);
  const expiresAt = Timestamp.fromMillis(acquiredAt.toMillis() + 60_000);
  const processingRequest = {
    ...value.requestDocumentData,
    status: "processing",
    lifecycle: {
      schemaVersion: 1,
      operationId: `request-${value.preflight.request.requestId}`,
      requestIntentDigest,
      state: "processing",
      lease: {
        workerId: "worker-activation-1",
        fencingEpoch: 1,
        acquiredAt,
        expiresAt,
      },
      terminalDigest: null,
      summary: null,
      artifact: null,
    },
  };
  return {
    operationId: `request-${value.preflight.request.requestId}`,
    workerId: "worker-activation-1",
    fencingEpoch: 1,
    leaseDurationMillis: 60_000,
    attemptedAt,
    preflight: value.preflight,
    liveResult: value.liveResult,
    requestDocument: readDocument(
      `develop/plus-collections/shiftPlanningRequests/` +
        value.preflight.request.requestId,
      processingRequest,
      1_788_307_100_000,
    ),
    beforeImageDocuments: [
      readDocument(
        "develop/plus-collections/shiftRotations/delivery",
        expected.rotations.delivery,
        1_788_307_110_000,
      ),
      readDocument(
        "develop/plus-collections/shiftRotations/market",
        expected.rotations.market,
        1_788_307_120_000,
      ),
      readDocument(
        "develop/plus-collections/shiftPlanningState/current",
        expected.maintenance,
        1_788_307_130_000,
      ),
    ],
  };
};

const errorCode = (expectedCode) => (error) =>
  error instanceof Error && error.code === expectedCode;

test("materializes the exact complete forward mutation set", () => {
  const input = materializerInput();
  const result = materializeShiftPlanningForwardActivation(input);
  const artifact = input.preflight.bundle.artifact;

  assert.equal(
    result.mutations.length,
    artifact.budgets.forward.totalWrites,
  );
  assert.deepEqual(
    result.mutations.map(({documentPath}) => documentPath),
    [...result.mutations.map(({documentPath}) => documentPath)].sort(),
  );
  assert.equal(result.operation.state, "committed");
  assert.equal(
    result.operation.publicMutations.length,
    artifact.budgets.forward.publicShiftWrites,
  );
  assert.equal(result.operation.beforeImages.length, 3);
  assert.equal(
    result.publicDocuments.every(({document}) =>
      document.lastBackendMutation.operationIntentDigest ===
        result.operation.operationIntentDigest),
    true,
  );
  const stateMutation = result.mutations.find(({documentPath}) =>
    documentPath.endsWith("/shiftPlanningState/current"));
  assert.equal(stateMutation.kind, "update");
  assert.equal(
    stateMutation.data.activeRevision,
    input.liveResult.bundleRevision,
  );
  assert.equal(
    stateMutation.data.writeEpoch,
    input.liveResult.activationWriteEpoch,
  );
});

test("rejects live bundle drift and incomplete before-images", () => {
  const driftedFixture = fixture();
  driftedFixture.liveResult = {
    ...driftedFixture.liveResult,
    bundleDigest: `shift-planning:v1:sha256:${"f".repeat(64)}`,
  };
  assert.throws(
    () => materializeShiftPlanningForwardActivation(
      materializerInput(driftedFixture),
    ),
    errorCode("invalid_planning_forward_materialization"),
  );

  const missingBeforeImage = materializerInput();
  missingBeforeImage.beforeImageDocuments =
    missingBeforeImage.beforeImageDocuments.slice(1);
  assert.throws(
    () => materializeShiftPlanningForwardActivation(missingBeforeImage),
    errorCode("invalid_planning_forward_materialization"),
  );
});

test("rejects stale and expired activation claims before publication", () => {
  const staleWorker = materializerInput();
  staleWorker.workerId = "stale-activation-worker";
  assert.throws(
    () => materializeShiftPlanningForwardActivation(staleWorker),
    errorCode("invalid_planning_forward_materialization"),
  );

  const expired = materializerInput();
  expired.requestDocument.data.lifecycle.lease.acquiredAt =
    Timestamp.fromMillis(attemptedAt.toMillis() - 60_000);
  expired.requestDocument.data.lifecycle.lease.expiresAt = attemptedAt;
  assert.throws(
    () => materializeShiftPlanningForwardActivation(expired),
    errorCode("invalid_planning_forward_materialization"),
  );
});

test("keeps credit planning closed until HU-084 is available", () => {
  const snapshot = fairnessSnapshot();
  snapshot.creditLedger = {
    enabled: true,
    revision: "credits-v1",
    digest: "credits-digest-v1",
    plannedWriteCount: 1,
  };
  assert.throws(
    () => fixture(snapshot),
    (error) =>
      errorCode("invalid_planning_state")(error) &&
      error.message.includes("HU-084"),
  );
});

test("updates the predecessor helper without shifting later turns", () => {
  const predecessor = predecessorFixture();
  const input = materializerInput(predecessor.value);
  input.beforeImageDocuments.push(readDocument(
    predecessor.predecessorPath,
    predecessor.predecessorDocument,
    1_788_307_140_000,
  ));

  const result = materializeShiftPlanningForwardActivation(input);
  const mutation = result.mutations.find(({documentPath}) =>
    documentPath === predecessor.predecessorPath);

  assert.equal(mutation.kind, "update");
  assert.equal(mutation.data.helperUserId, "member-1");
  assert.equal(mutation.data.assignmentRevision, 4);
  assert.equal(mutation.data.documentRevision, 5);
  assert.equal(result.operation.beforeImages.length, 4);
  assert.equal(
    result.operation.publicMutations.find(({targetPath}) =>
      targetPath === predecessor.predecessorPath).mutationKind,
    "update",
  );
});

test(
  "seals and commits the exact forward batch in the real adapter",
  {skip: !process.env.FIRESTORE_EMULATOR_HOST},
  async () => {
    const database = new Firestore({
      projectId: "demo-reguerta-hu082-forward-materializer",
      databaseId: "(default)",
    });
    const base = materializerInput();
    const seed = database.batch();
    seed.set(
      database.doc(base.requestDocument.targetPath),
      base.requestDocument.data,
    );
    base.beforeImageDocuments.forEach((document) => {
      seed.set(database.doc(document.targetPath), document.data);
    });
    await seed.commit();

    const result = await database.runTransaction(async (transaction) => {
      const references = [
        database.doc(base.requestDocument.targetPath),
        ...base.beforeImageDocuments.map(({targetPath}) =>
          database.doc(targetPath)),
      ];
      const snapshots = await Promise.all(
        references.map((reference) => transaction.get(reference)),
      );
      const requestSnapshot = snapshots[0];
      const beforeImageSnapshots = snapshots.slice(1);
      return measureAndSealShiftPlanningForwardActivationAttempt({
        ...base,
        firestore: database,
        transaction,
        requestDocument: {
          targetPath: requestSnapshot.ref.path,
          data: requestSnapshot.data(),
          updateTime: requestSnapshot.updateTime,
        },
        beforeImageDocuments: beforeImageSnapshots.map((snapshot) => ({
          targetPath: snapshot.ref.path,
          data: snapshot.data(),
          updateTime: snapshot.updateTime,
        })),
      });
    });

    assert.equal(
      result.measurement.documentWriteCount,
      base.preflight.bundle.artifact.budgets.forward.totalWrites,
    );
    assert.equal(result.measurement.direction, "forward");
    assert.equal(
      (await database.doc(result.materialization.operationPath).get())
        .get("operationIntentDigest"),
      result.materialization.operation.operationIntentDigest,
    );
    assert.equal(
      (await database.doc(base.requestDocument.targetPath).get())
        .get("status"),
      "completed",
    );
    const firstPublic = result.materialization.publicDocuments[0];
    assert.equal(
      (await database.doc(firstPublic.targetPath).get())
        .get("lastBackendMutation.operationIntentDigest"),
      result.materialization.operation.operationIntentDigest,
    );
    await database.terminate();
  },
);
