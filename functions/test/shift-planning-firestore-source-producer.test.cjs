"use strict";

const assert = require("node:assert/strict");
const {test} = require("node:test");
const {
  Firestore,
  Timestamp,
} = require("@google-cloud/firestore");

const {
  createShiftPlanningDigest,
} = require("../lib/shift-planning-digest.js");
const {
  planShiftPlanningBundle,
} = require("../lib/shift-planning-bundle.js");
const {
  buildShiftPlanningCandidatePositionSet,
  persistShiftPlanningCandidatePosition,
} = require("../lib/shift-planning-candidate.js");
const {
  createGovernedShiftPlanningForwardActivationResolver,
  refreshShiftPlanningLiveSource,
} = require("../lib/shift-planning-firestore-source-producer.js");
const {
  createFirestoreShiftPlanningRepository,
} = require("../lib/shift-planning-firestore-repository.js");
const {
  createFirestoreShiftPlanningRuntime,
} = require("../lib/shift-planning-firestore-runtime.js");
const {
  SHIFT_PLANNING_FIRESTORE_COMMIT_ADAPTER_REVISION,
} = require(
  "../lib/shift-planning-firestore-transaction-serializer.js"
);
const {
  buildShiftPlanningAuthoritativeState,
} = require("../lib/shift-planning-state-persistence.js");
const {
  buildShiftPlanningFailureSummary,
} = require("../lib/shift-planning-wire.js");

const projectId = "demo-reguerta-hu082-source-producer";
const environment = "develop";
const root = `${environment}/plus-collections`;
const digest = (value) => createShiftPlanningDigest(value);

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
  activeRevision: null,
  activeDigest: null,
  lastIdempotencyKey: null,
  migrationBaseline: null,
  releaseLease: null,
});

const maintenance = () => ({
  schemaVersion: 1,
  stateRevision: 11,
  writeEpoch: 7,
  maintenanceStatus: "closed",
  activeRevision: null,
  activeDigest: null,
  intakeBarrier: {
    revision: "barrier-source-producer-v1",
    digest: digest({barrier: "source-producer-v1"}),
    verifiedAtMillis: 1_788_393_600_000,
  },
  lastTransitionId: "maintenance-source-producer-v1",
});

const sourcePolicy = () => ({
  schemaVersion: 1,
  environment,
  policyRevision: "hu-082-source-policy-v1",
  delivery: {
    continuity: {kind: "newRotation"},
    inheritedTargetPrefix: null,
    futureProjectionOccupancy: [],
  },
  market: {
    inheritedTargetPrefix: null,
    futureProjectionOccupancy: [],
  },
  releaseLeaseDurationMillis: 900_000,
  creditLedger: {
    enabled: false,
    revision: "credits-disabled-v1",
    digest: digest({credits: "disabled-v1"}),
    plannedWriteCount: 0,
  },
  sync: {
    leaseDurationMillis: 120_000,
    transactionMeasurementAuthority: {
      adapterRevision: SHIFT_PLANNING_FIRESTORE_COMMIT_ADAPTER_REVISION,
      indexConfigurationDigest: digest({indexes: "strict-source-v1"}),
    },
    partitions: {
      delivery: {
        workbookId: "workbook-source",
        workbookRevision: "workbook-source-3",
        partitionKey: "delivery",
        stateRevision: 3,
        epoch: 11,
        lease: null,
      },
      market: {
        workbookId: "workbook-source",
        workbookRevision: "workbook-source-3",
        partitionKey: "market",
        stateRevision: 5,
        epoch: 14,
        lease: null,
      },
    },
  },
  transactionWriteLimit: 500,
});

const member = (overrides = {}) => ({
  displayName: "Synthetic member",
  roles: ["member"],
  isActive: true,
  isCommonPurchaseManager: false,
  ...overrides,
});

const device = (token) => ({
  deviceId: "device-1",
  platform: "ios",
  appVersion: "1",
  osVersion: "26",
  fcmToken: token,
  tokenUpdatedAt: Timestamp.fromMillis(1_788_393_700_000),
  firebaseInstallationId: null,
  registrationUpdatedAt: null,
  firstSeenAt: Timestamp.fromMillis(1_788_393_600_000),
  lastSeenAt: Timestamp.fromMillis(1_788_393_700_000),
});

const calendarOverride = () => ({
  weekKey: "2026-W41",
  deliveryDate: Timestamp.fromMillis(Date.UTC(2026, 9, 7)),
  ordersBlockedDate: Timestamp.fromMillis(Date.UTC(2026, 9, 5)),
  ordersOpenAt: Timestamp.fromMillis(Date.UTC(2026, 8, 30)),
  ordersCloseAt: Timestamp.fromMillis(Date.UTC(2026, 9, 4)),
  updatedBy: "admin-fixture",
  updatedAt: Timestamp.fromMillis(1_788_393_700_000),
});

const planningRequest = ({requestId, bundleId, mode, binding}) => ({
  schemaVersion: 2,
  requestId,
  bundleId,
  environment,
  requestedByUserId: "member-a",
  requestedAt: Timestamp.fromMillis(1_788_393_800_000),
  mode,
  status: "requested",
  expectedWriteEpoch: 7,
  expectedActiveRevision: null,
  subplans: {
    delivery: {targetSeasonStartYear: 2026},
    market: {targetSeasonStartYear: 2026},
  },
  binding,
});

const persistedArtifact = (result) => ({
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

const buildPlanningChain = (source) => {
  const authoritativeState = buildShiftPlanningAuthoritativeState({
    environment,
    maintenance: maintenance(),
    rotations: {
      delivery: rotation("delivery", ["member-a", "member-b", "manager-c"]),
      market: rotation("market", ["manager-c", "member-b", "member-a"]),
    },
  });
  const bundleId = "source-producer-bundle";
  const previewRequest = planningRequest({
    requestId: "source-producer-preview",
    bundleId,
    mode: "preview",
    binding: null,
  });
  const preview = planShiftPlanningBundle({
    request: previewRequest,
    authoritativeState,
    ...source.inputs,
  });
  const stageRequest = planningRequest({
    requestId: "source-producer-stage",
    bundleId,
    mode: "stage",
    binding: {
      kind: "preview",
      sourceRequestId: previewRequest.requestId,
      bundleRevision: preview.bundleRevision,
      bundleDigest: preview.bundleDigest,
    },
  });
  const stage = planShiftPlanningBundle({
    request: stageRequest,
    authoritativeState,
    ...source.inputs,
    persistedPreview: preview.previewReceipt,
  });
  const activateRequest = planningRequest({
    requestId: "source-producer-activate",
    bundleId,
    mode: "activate",
    binding: {
      kind: "candidate",
      candidateId: stage.stagedCandidate.candidateId,
      bundleRevision: stage.bundleRevision,
      bundleDigest: stage.bundleDigest,
      candidateDigest: stage.stagedCandidateDigest,
    },
  });
  const activate = planShiftPlanningBundle({
    request: activateRequest,
    authoritativeState,
    ...source.inputs,
    stagedCandidate: stage.stagedCandidate,
  });
  return {stage, activate, activateRequest};
};

const seedStagedActivation = async (database, chain) => {
  const artifact = persistedArtifact(chain.activate);
  const bundle = {
    schemaVersion: 1,
    environment,
    bundleId: chain.activate.bundleId,
    bundleRevision: chain.activate.bundleRevision,
    bundleDigest: chain.activate.bundleDigest,
    artifactDigest: digest(artifact),
    artifact,
  };
  const candidate = {
    schemaVersion: 1,
    status: "staged",
    environment,
    bundleId: chain.stage.bundleId,
    bundleRevision: chain.stage.bundleRevision,
    bundleDigest: chain.stage.bundleDigest,
    candidate: chain.stage.stagedCandidate,
    candidateDigest: chain.stage.stagedCandidateDigest,
    bundleArtifactDigest: bundle.artifactDigest,
  };
  const positions = buildShiftPlanningCandidatePositionSet({
    candidateId: candidate.bundleId,
    bundleRevision: candidate.bundleRevision,
    bundleDigest: candidate.bundleDigest,
    writeEpoch: artifact.activationWriteEpoch,
    delivery: artifact.delivery,
    market: artifact.market,
  }).positions.map((position) => persistShiftPlanningCandidatePosition({
    position,
    candidateDigest: candidate.candidateDigest,
  }));
  const batch = database.batch();
  batch.create(
    database.doc(`${root}/shiftPlanningBundles/${bundle.bundleRevision}`),
    bundle,
  );
  const candidateReference = database.doc(
    `${root}/shiftPlanningCandidates/${candidate.bundleId}`,
  );
  batch.create(candidateReference, candidate);
  positions.forEach((position) => batch.create(
    candidateReference.collection("positions").doc(position.positionId),
    position,
  ));
  batch.create(
    database.doc(
      `${root}/shiftPlanningRequests/${chain.activateRequest.requestId}`,
    ),
    chain.activateRequest,
  );
  await batch.commit();
};

const seed = async (database) => {
  const eligibleIds = ["member-a", "member-b", "manager-c"];
  const batch = database.batch();
  batch.create(
    database.doc(`${root}/shiftPlanningState/sourcePolicy`),
    sourcePolicy(),
  );
  batch.create(database.doc(`${root}/shiftPlanningState/current`), maintenance());
  batch.create(
    database.doc(`${root}/shiftRotations/delivery`),
    rotation("delivery", eligibleIds),
  );
  batch.create(
    database.doc(`${root}/shiftRotations/market`),
    rotation("market", ["manager-c", "member-b", "member-a"]),
  );
  batch.create(database.doc(`${root}/config/global`), {
    cacheExpirationMinutes: 30,
    lastTimestamps: {},
    otherConfig: {deliveryDayOfWeek: "WED"},
    versions: {},
  });
  batch.create(database.doc(`${root}/users/member-a`), member({
    roles: ["admin", "member"],
  }));
  batch.create(database.doc(`${root}/users/member-b`), member());
  batch.create(database.doc(`${root}/users/manager-c`), member({
    roles: ["member", "producer"],
    isCommonPurchaseManager: true,
  }));
  batch.create(database.doc(`${root}/users/producer-d`), member({
    roles: ["member", "producer"],
  }));
  batch.create(database.doc(`${root}/users/inactive-e`), member({
    isActive: false,
  }));
  batch.create(
    database.doc(`${root}/users/member-a/devices/device-1`),
    device("synthetic-token-a"),
  );
  batch.create(
    database.doc(`${root}/deliveryCalendar/2026-W41`),
    calendarOverride(),
  );
  await batch.commit();
};

const clear = async (database) => {
  await database.recursiveDelete(database.doc(root));
};

const emulatorTest = process.env.FIRESTORE_EMULATOR_HOST ? test : test.skip;

emulatorTest("produces, replays, and versions real planning sources", async () => {
  const database = new Firestore({projectId});
  await clear(database);
  await seed(database);

  const created = await refreshShiftPlanningLiveSource({
    firestore: database,
    environment,
  });
  assert.equal(created.kind, "created");
  assert.equal(JSON.stringify(created.source).includes("synthetic-token"), false);
  assert.equal(created.source.inputs.fairnessSnapshot.roster.length, 5);
  const roster = created.source.inputs.fairnessSnapshot.roster;
  const manager = roster.find(({userId}) => userId === "manager-c");
  const producer = roster.find(({userId}) => userId === "producer-d");
  assert.equal(manager.isCommonPurchaseManager, true);
  assert.equal(producer.isCommonPurchaseManager, false);
  const authoritativeState = buildShiftPlanningAuthoritativeState({
    environment,
    maintenance: maintenance(),
    rotations: {
      delivery: rotation("delivery", ["member-a", "member-b", "manager-c"]),
      market: rotation("market", ["manager-c", "member-b", "member-a"]),
    },
  });
  const preview = planShiftPlanningBundle({
    request: {
      schemaVersion: 2,
      requestId: "source-producer-preview",
      bundleId: "source-producer-bundle",
      environment,
      requestedByUserId: "member-a",
      requestedAt: Timestamp.fromMillis(1_788_393_800_000),
      mode: "preview",
      status: "requested",
      expectedWriteEpoch: 7,
      expectedActiveRevision: null,
      subplans: {
        delivery: {targetSeasonStartYear: 2026},
        market: {targetSeasonStartYear: 2026},
      },
      binding: null,
    },
    authoritativeState,
    ...created.source.inputs,
  });
  assert.equal(preview.delivery.shifts.length > 0, true);
  assert.equal(preview.market.shifts.length > 0, true);

  const runtime = createFirestoreShiftPlanningRuntime(database);
  const routedPreviewRequest = planningRequest({
    requestId: "source-runtime-preview",
    bundleId: "source-runtime-bundle",
    mode: "preview",
    binding: null,
  });
  await database.doc(
    `${root}/shiftPlanningRequests/${routedPreviewRequest.requestId}`,
  ).create(routedPreviewRequest);
  const routedPreview = await runtime.executeRequest({
    environment,
    requestId: routedPreviewRequest.requestId,
    request: routedPreviewRequest,
    workerId: "source-runtime-worker",
  });
  assert.equal(routedPreview.kind, "lifecycle");
  assert.equal(
    routedPreview.result.kind,
    "completed",
    JSON.stringify(routedPreview.result),
  );
  const previewResult = routedPreview.result.result;
  const routedStageRequest = planningRequest({
    requestId: "source-runtime-stage",
    bundleId: "source-runtime-bundle",
    mode: "stage",
    binding: {
      kind: "preview",
      sourceRequestId: routedPreviewRequest.requestId,
      bundleRevision: previewResult.bundleRevision,
      bundleDigest: previewResult.bundleDigest,
    },
  });
  await database.doc(
    `${root}/shiftPlanningRequests/${routedStageRequest.requestId}`,
  ).create(routedStageRequest);
  const routedStage = await runtime.executeRequest({
    environment,
    requestId: routedStageRequest.requestId,
    request: routedStageRequest,
    workerId: "source-runtime-worker",
  });
  assert.equal(routedStage.kind, "lifecycle");
  assert.equal(routedStage.result.kind, "completed");
  assert.equal(
    (await database.doc(
      `${root}/shiftPlanningCandidates/${routedStageRequest.bundleId}`,
    ).get()).exists,
    true,
  );
  assert.equal((await database.collection(`${root}/shifts`).get()).size, 0);

  const replayed = await refreshShiftPlanningLiveSource({
    firestore: database,
    environment,
  });
  assert.equal(replayed.kind, "replayed");
  assert.equal(replayed.source.sourceDigest, created.source.sourceDigest);

  await database.doc(`${root}/users/member-a`).update({
    authUid: "auth-only-change",
  });
  const authOnlyReplay = await refreshShiftPlanningLiveSource({
    firestore: database,
    environment,
  });
  assert.equal(authOnlyReplay.kind, "replayed");

  const priorDestinationRevision = roster.find(
    ({userId}) => userId === "member-a",
  ).destinationRevision;
  await database.doc(`${root}/users/member-a/devices/device-1`).set(
    device("synthetic-token-b"),
    {merge: false},
  );
  const updated = await refreshShiftPlanningLiveSource({
    firestore: database,
    environment,
  });
  assert.equal(updated.kind, "updated");
  assert.notEqual(updated.source.sourceDigest, created.source.sourceDigest);
  assert.notEqual(
    updated.source.inputs.fairnessSnapshot.roster.find(
      ({userId}) => userId === "member-a",
    ).destinationRevision,
    priorDestinationRevision,
  );

  await clear(database);
  await database.terminate();
});

emulatorTest("invalid source drift preserves the last valid envelope", async () => {
  const database = new Firestore({projectId});
  await clear(database);
  await seed(database);
  const created = await refreshShiftPlanningLiveSource({
    firestore: database,
    environment,
  });
  await database.doc(`${root}/deliveryCalendar/2026-W41`).update({
    weekKey: "2026-W42",
  });

  await assert.rejects(
    refreshShiftPlanningLiveSource({firestore: database, environment}),
    (error) => error.code === "invalid_planning_transaction",
  );
  const persisted = await database.doc(
    `${root}/shiftPlanningState/fairness`,
  ).get();
  assert.equal(persisted.get("sourceDigest"), created.source.sourceDigest);

  await clear(database);
  await database.terminate();
});

emulatorTest(
  "routes governed activation and recovery through the v2 runtime",
  async () => {
    const database = new Firestore({projectId});
    await clear(database);
    await seed(database);
    const produced = await refreshShiftPlanningLiveSource({
      firestore: database,
      environment,
    });
    const chain = buildPlanningChain(produced.source);
    await seedStagedActivation(database, chain);
    const resolver = createGovernedShiftPlanningForwardActivationResolver({
      environment,
      requestId: chain.activateRequest.requestId,
    });
    const resolved = await database.runTransaction((transaction) => resolver({
      firestore: database,
      transaction,
      attemptedAt: Timestamp.fromMillis(1_788_393_900_000),
    }));
    assert.equal(
      resolved.liveResult.bundleDigest,
      chain.activate.bundleDigest,
    );

    await database.doc(`${root}/users/member-a/devices/device-1`).set(
      device("synthetic-token-after-stage"),
      {merge: false},
    );
    const runtime = createFirestoreShiftPlanningRuntime(database);
    const rejected = await runtime.executeRequest({
      environment,
      requestId: chain.activateRequest.requestId,
      request: chain.activateRequest,
      workerId: "source-runtime-worker",
    });
    assert.equal(rejected.kind, "lifecycle");
    assert.equal(rejected.result.kind, "failed");
    assert.equal(
      rejected.result.summary.failure.code,
      "invalid_planning_transaction",
    );
    assert.equal(rejected.result.persistenceResult, "committed");
    const rejectedReplay = await runtime.executeRequest({
      environment,
      requestId: chain.activateRequest.requestId,
      request: chain.activateRequest,
      workerId: "source-runtime-worker",
    });
    assert.equal(rejectedReplay.kind, "lifecycle");
    assert.equal(rejectedReplay.result.kind, "terminalReplay");
    assert.equal(rejectedReplay.result.summary.status, "failed");
    assert.equal((await database.collection(`${root}/shifts`).get()).size, 0);
    assert.equal(
      (await database.doc(`${root}/shiftPlanningState/fairness`).get())
        .get("sourceDigest"),
      produced.source.sourceDigest,
    );

    await database.doc(`${root}/users/member-a/devices/device-1`).set(
      device("synthetic-token-a"),
      {merge: false},
    );
    const retryRequest = {
      ...chain.activateRequest,
      requestId: `${chain.activateRequest.requestId}-retry`,
    };
    await database.doc(
      `${root}/shiftPlanningRequests/${retryRequest.requestId}`,
    ).create(retryRequest);
    const activated = await runtime.executeRequest({
      environment,
      requestId: retryRequest.requestId,
      request: retryRequest,
      workerId: "source-runtime-worker",
    });
    assert.equal(activated.kind, "activation");
    assert.equal(activated.result.kind, "committed");
    assert.equal(
      (await database.collection(`${root}/shifts`).get()).size,
      chain.activate.delivery.shifts.length +
        chain.activate.market.shifts.length,
    );
    const replayed = await runtime.executeRequest({
      environment,
      requestId: retryRequest.requestId,
      request: retryRequest,
      workerId: "source-runtime-worker",
    });
    assert.equal(replayed.kind, "activation");
    assert.equal(replayed.result.kind, "terminalReplay");

    const operationId = `request-${retryRequest.requestId}`;
    const repository = createFirestoreShiftPlanningRepository(database);
    const lateFailure = await repository.failActivationRequest({
      environment,
      requestId: retryRequest.requestId,
      operationId,
      workerId: "late-failure-worker",
      leaseDurationMillis: 300_000,
      summary: buildShiftPlanningFailureSummary({
        mode: "activate",
        bundleId: retryRequest.bundleId,
        scope: "bundle",
        code: "invalid_planning_transaction",
      }),
    });
    assert.equal(lateFailure, "activationCommitted");
    assert.equal(
      (await database.doc(
        `${root}/shiftPlanningRequests/${retryRequest.requestId}`,
      ).get()).get("status"),
      "completed",
    );
    const recovered = await runtime.executeRecovery({
      environment,
      activationOperationId: operationId,
      recoveryOperationId: "recovery-source-runtime-route",
    });
    assert.equal(recovered.kind, "committed");
    assert.equal((await database.collection(`${root}/shifts`).get()).size, 0);

    await clear(database);
    await database.terminate();
  },
);
