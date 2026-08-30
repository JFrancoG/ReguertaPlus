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
  createFirestoreShiftPlanningNotificationReleaseRepository,
} = require(
  "../lib/shift-planning-firestore-notification-release-repository.js"
);
const {
  createFirebaseShiftPlanningNotificationRuntime,
} = require(
  "../lib/shift-planning-firebase-notification-runtime.js"
);
const {
  createFirestoreShiftPlanningRuntime,
} = require("../lib/shift-planning-firestore-runtime.js");
const {
  createFirestoreShiftPlanningSyncCommandRepository,
} = require(
  "../lib/shift-planning-firestore-sync-command-repository.js"
);
const {
  createFirestoreShiftPlanningOperatorRecoveryExecutor,
  createShiftPlanningRecoveryAuthorization,
  shiftPlanningRecoveryAuthorizationPath,
} = require("../lib/shift-planning-operator-recovery.js");
const {
  SHIFT_PLANNING_FIRESTORE_COMMIT_ADAPTER_REVISION,
} = require(
  "../lib/shift-planning-firestore-transaction-serializer.js"
);
const {
  buildShiftPlanningAuthoritativeState,
} = require("../lib/shift-planning-state-persistence.js");
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

emulatorTest(
  "publishes and reads back one complete governed planning chain",
  async () => {
    const database = new Firestore({projectId});
    await clear(database);
    await seed(database);
    await refreshShiftPlanningLiveSource({
      firestore: database,
      environment,
    });

    const runtime = createFirestoreShiftPlanningRuntime(database);
    const bundleId = "source-runtime-readback-bundle";
    const execute = async (request) => {
      await database.doc(
        `${root}/shiftPlanningRequests/${request.requestId}`,
      ).create(request);
      return runtime.executeRequest({
        environment,
        requestId: request.requestId,
        request,
        workerId: "source-runtime-readback-worker",
      });
    };

    const previewRequest = planningRequest({
      requestId: "source-runtime-readback-preview",
      bundleId,
      mode: "preview",
      binding: null,
    });
    const previewExecution = await execute(previewRequest);
    assert.equal(previewExecution.kind, "lifecycle");
    assert.equal(previewExecution.result.kind, "completed");
    assert.equal((await database.collection(`${root}/shifts`).get()).size, 0);

    const preview = previewExecution.result.result;
    const stageRequest = planningRequest({
      requestId: "source-runtime-readback-stage",
      bundleId,
      mode: "stage",
      binding: {
        kind: "preview",
        sourceRequestId: previewRequest.requestId,
        bundleRevision: preview.bundleRevision,
        bundleDigest: preview.bundleDigest,
      },
    });
    const stageExecution = await execute(stageRequest);
    assert.equal(stageExecution.kind, "lifecycle");
    assert.equal(stageExecution.result.kind, "completed");
    assert.equal((await database.collection(`${root}/shifts`).get()).size, 0);

    const staged = stageExecution.result.result;
    const activateRequest = planningRequest({
      requestId: "source-runtime-readback-activate",
      bundleId,
      mode: "activate",
      binding: {
        kind: "candidate",
        candidateId: staged.stagedCandidate.candidateId,
        bundleRevision: staged.bundleRevision,
        bundleDigest: staged.bundleDigest,
        candidateDigest: staged.stagedCandidateDigest,
      },
    });
    const activation = await execute(activateRequest);
    assert.equal(activation.kind, "activation");
    assert.equal(activation.result.kind, "committed");

    const [
      requestSnapshot,
      maintenanceSnapshot,
      deliveryRotationSnapshot,
      marketRotationSnapshot,
      shiftSnapshot,
      heldIntentSnapshot,
      publicNotificationSnapshot,
    ] = await Promise.all([
      database.doc(
        `${root}/shiftPlanningRequests/${activateRequest.requestId}`,
      ).get(),
      database.doc(`${root}/shiftPlanningState/current`).get(),
      database.doc(`${root}/shiftRotations/delivery`).get(),
      database.doc(`${root}/shiftRotations/market`).get(),
      database.collection(`${root}/shifts`).get(),
      database.collection(`${root}/shiftPlanningNotificationIntents`).get(),
      database.collection(`${root}/notifications`).get(),
    ]);
    const expectedShiftCount = staged.delivery.shifts.length +
      staged.market.shifts.length;
    assert.equal(requestSnapshot.get("status"), "completed");
    assert.equal(requestSnapshot.get("lifecycle.state"), "completed");
    assert.equal(
      requestSnapshot.get("lifecycle.summary.bundleRevision"),
      staged.bundleRevision,
    );
    assert.equal(
      requestSnapshot.get("lifecycle.summary.bundleDigest"),
      staged.bundleDigest,
    );
    assert.equal(
      maintenanceSnapshot.get("activeRevision"),
      staged.bundleRevision,
    );
    assert.equal(
      maintenanceSnapshot.get("activeDigest"),
      staged.bundleDigest,
    );
    assert.equal(
      maintenanceSnapshot.get("writeEpoch"),
      staged.activationWriteEpoch,
    );
    assert.equal(
      deliveryRotationSnapshot.get("activeRevision"),
      staged.bundleRevision,
    );
    assert.equal(
      marketRotationSnapshot.get("activeRevision"),
      staged.bundleRevision,
    );
    assert.equal(shiftSnapshot.size, expectedShiftCount);
    for (const document of shiftSnapshot.docs) {
      assert.equal(document.get("source"), "app");
      assert.equal(document.get("origin"), "planner");
      assert.equal(document.get("planningRequestId"), bundleId);
      assert.equal(document.get("bundleRevision"), staged.bundleRevision);
      assert.equal(document.get("bundleDigest"), staged.bundleDigest);
      assert.equal(document.get("writeEpoch"), staged.activationWriteEpoch);
      assert.equal(document.get("status"), "planned");
    }
    assert.equal(
      heldIntentSnapshot.size,
      staged.heldNotificationIntents.length,
    );
    assert.equal(
      heldIntentSnapshot.docs.every((document) =>
        document.get("state") === "held" &&
        document.get("bundleRevision") === staged.bundleRevision
      ),
      true,
    );
    assert.equal(publicNotificationSnapshot.size, 0);

    const replay = await runtime.executeRequest({
      environment,
      requestId: activateRequest.requestId,
      request: activateRequest,
      workerId: "source-runtime-readback-replay-worker",
    });
    assert.equal(replay.kind, "activation");
    assert.equal(replay.result.kind, "terminalReplay");
    assert.equal(
      (await database.collection(`${root}/shifts`).get()).size,
      expectedShiftCount,
    );
    assert.equal(
      (await database.doc(`${root}/shiftPlanningState/current`).get())
        .get("stateRevision"),
      maintenanceSnapshot.get("stateRevision"),
    );
    assert.equal(
      (await database.doc(`${root}/shiftRotations/delivery`).get())
        .get("stateRevision"),
      deliveryRotationSnapshot.get("stateRevision"),
    );
    assert.equal(
      (await database.doc(`${root}/shiftRotations/market`).get())
        .get("stateRevision"),
      marketRotationSnapshot.get("stateRevision"),
    );

    let releaseNowMillis = 1_788_393_900_000;
    const syncRepository = createFirestoreShiftPlanningSyncCommandRepository(
      database,
      () => Timestamp.fromMillis(releaseNowMillis),
    );
    for (const command of staged.syncCommands) {
      const claimed = await syncRepository.claim({
        environment,
        commandId: command.commandId,
        workerId: `source-runtime-sync-${command.type}`,
        attemptId: `source-runtime-sync-attempt-${command.type}`,
      });
      assert.equal(claimed.kind, "claimed");
      assert.deepEqual(
        await syncRepository.authorizeBatch(claimed.token),
        claimed.command,
      );
      releaseNowMillis += 1_000;
      const completed = await syncRepository.complete({
        token: claimed.token,
        evidence: {
          workbookRevision: `workbook-source-readback-${command.type}`,
          partitionDigest: digest({
            bundleRevision: staged.bundleRevision,
            partition: command.partitionKey,
            readBack: "local-e2e",
          }),
        },
      });
      assert.equal(completed.kind, "committed");
      assert.equal(completed.command.state, "completed");
    }

    releaseNowMillis += 1_000;
    const releaseRepository =
      createFirestoreShiftPlanningNotificationReleaseRepository(
        database,
        () => Timestamp.fromMillis(releaseNowMillis),
      );
    const releasedArtifacts = [];
    for (const intent of staged.heldNotificationIntents) {
      const released = await releaseRepository.release({
        environment,
        intentId: intent.intentId,
      });
      assert.equal(released.kind, "committed");
      releasedArtifacts.push(released.artifacts);
    }

    const notificationEvents = await database.collection(
      `${root}/notificationEvents`,
    ).get();
    assert.equal(
      notificationEvents.size,
      staged.heldNotificationIntents.length,
    );
    const forbiddenPublicFields = [
      "shiftId",
      "shiftType",
      "bundleRevision",
      "bundleDigest",
      "writeEpoch",
      "assignedUserIds",
      "date",
    ];
    for (const event of notificationEvents.docs) {
      assert.equal(event.get("contentPolicy"), "genericReferenceOnly");
      assert.equal(event.get("type"), "shift_updated");
      assert.equal(event.get("title"), "Turnos actualizados");
      assert.equal(
        event.get("body"),
        "Consulta la aplicación para ver la información actualizada.",
      );
      assert.equal(
        forbiddenPublicFields.every((field) => event.get(field) === undefined),
        true,
      );
    }

    const recipientUserIds = [...new Set(
      staged.heldNotificationIntents.map(({recipientUserId}) => recipientUserId),
    )];
    const inboxSnapshots = await Promise.all(recipientUserIds.map(
      (recipientUserId) => database.collection(
        `${root}/users/${recipientUserId}/notificationInbox`,
      ).get(),
    ));
    assert.equal(
      inboxSnapshots.reduce((total, snapshot) => total + snapshot.size, 0),
      staged.heldNotificationIntents.length,
    );
    assert.equal(inboxSnapshots.every((snapshot) => snapshot.docs.every(
      (document) =>
        document.get("contentPolicy") === "genericReferenceOnly" &&
        forbiddenPublicFields.every(
          (field) => document.get(field) === undefined,
        ),
    )), true);

    const releaseReceipts = await Promise.all(
      staged.heldNotificationIntents.map(({intentId}) => database.doc(
        `${root}/shiftPlanningNotificationIntents/${intentId}/` +
          "releases/canonical",
      ).get()),
    );
    assert.equal(releaseReceipts.every(({exists}) => exists), true);
    const dispatchAttempts = await Promise.all(
      staged.heldNotificationIntents.map(({intentId}) => database.collection(
        `${root}/shiftPlanningNotificationIntents/${intentId}/` +
          "dispatchAttempts",
      ).get()),
    );
    assert.equal(dispatchAttempts.every(({empty}) => empty), true);

    const firstIntent = staged.heldNotificationIntents[0];
    const releaseReplay = await releaseRepository.release({
      environment,
      intentId: firstIntent.intentId,
    });
    assert.equal(releaseReplay.kind, "replayed");
    assert.deepEqual(releaseReplay.artifacts, releasedArtifacts[0]);
    assert.equal(
      (await database.collection(`${root}/notificationEvents`).get()).size,
      staged.heldNotificationIntents.length,
    );

    const dispatchIntent = staged.heldNotificationIntents.find(
      ({recipientUserId}) => recipientUserId === "member-a",
    );
    assert.notEqual(dispatchIntent, undefined);
    const submittedMessages = [];
    const notificationRuntime = createFirebaseShiftPlanningNotificationRuntime({
      firestore: database,
      messaging: {
        async sendEachForMulticast(message) {
          submittedMessages.push(message);
          return {
            responses: [{success: true, messageId: "fake-message-1"}],
            successCount: 1,
            failureCount: 0,
          };
        },
      },
      clock: () => Timestamp.fromMillis(releaseNowMillis),
      nowMillis: () => releaseNowMillis,
      transportTimeoutMillis: 10,
    });
    const dispatchCommand = {
      environment,
      intentId: dispatchIntent.intentId,
      workerId: "source-runtime-dispatch-worker",
      attemptId: "source-runtime-dispatch-attempt-1",
    };
    const dispatched = await notificationRuntime.execute(dispatchCommand);
    assert.equal(dispatched.releaseKind, "replayed");
    assert.equal(dispatched.dispatch.kind, "completed");
    assert.equal(dispatched.dispatch.attempt.terminal.outcome, "accepted");
    assert.equal(dispatched.dispatch.attempt.terminal.acceptedTargetCount, 1);
    assert.deepEqual(submittedMessages, [{
      notification: {
        title: "Turnos actualizados",
        body: "Consulta la aplicación para ver la información actualizada.",
      },
      data: {
        eventId: dispatchIntent.intentId,
        type: "shift_updated",
        target: "users",
      },
      android: {collapseKey: dispatchIntent.intentId},
      apns: {headers: {"apns-collapse-id": dispatchIntent.intentId}},
      tokens: ["synthetic-token-a"],
    }]);
    const attemptSnapshot = await database.doc(
      `${root}/shiftPlanningNotificationIntents/${dispatchIntent.intentId}/` +
        `dispatchAttempts/${dispatchCommand.attemptId}`,
    ).get();
    assert.equal(attemptSnapshot.get("terminal.outcome"), "accepted");
    assert.equal(attemptSnapshot.get("terminal.acceptedTargetCount"), 1);

    const dispatchReplay = await notificationRuntime.execute(dispatchCommand);
    assert.equal(dispatchReplay.releaseKind, "replayed");
    assert.equal(dispatchReplay.dispatch.kind, "terminalReplay");
    assert.equal(dispatchReplay.dispatch.attempt.terminal.outcome, "accepted");
    assert.equal(submittedMessages.length, 1);
    assert.equal(
      (await database.collection(`${root}/notificationEvents`).get()).size,
      staged.heldNotificationIntents.length,
    );

    await clear(database);
    await database.terminate();
  },
);

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
  "rejects an invalid planning frontier without public state mutation",
  async () => {
    const database = new Firestore({projectId});
    await clear(database);
    await seed(database);
    await refreshShiftPlanningLiveSource({
      firestore: database,
      environment,
    });
    const initialPublicState = await Promise.all([
      database.doc(`${root}/shiftPlanningState/current`).get(),
      database.doc(`${root}/shiftRotations/delivery`).get(),
      database.doc(`${root}/shiftRotations/market`).get(),
    ]);
    const request = {
      ...planningRequest({
        requestId: "source-runtime-invalid-frontier",
        bundleId: "source-runtime-invalid-frontier-bundle",
        mode: "preview",
        binding: null,
      }),
      subplans: {
        delivery: {targetSeasonStartYear: 2026},
        market: {targetSeasonStartYear: 2027},
      },
    };
    await database.doc(
      `${root}/shiftPlanningRequests/${request.requestId}`,
    ).create(request);

    const runtime = createFirestoreShiftPlanningRuntime(database);
    const rejected = await runtime.executeRequest({
      environment,
      requestId: request.requestId,
      request,
      workerId: "source-runtime-invalid-frontier-worker",
    });
    assert.equal(rejected.kind, "lifecycle");
    assert.equal(rejected.result.kind, "failed");
    assert.equal(
      rejected.result.summary.failure.code,
      "invalid_planning_frontier",
    );
    assert.equal(rejected.result.persistenceResult, "committed");

    const replay = await runtime.executeRequest({
      environment,
      requestId: request.requestId,
      request,
      workerId: "source-runtime-invalid-frontier-replay-worker",
    });
    assert.equal(replay.kind, "lifecycle");
    assert.equal(replay.result.kind, "terminalReplay");
    assert.equal(replay.result.summary.status, "failed");
    assert.equal(
      replay.result.summary.failure.code,
      "invalid_planning_frontier",
    );

    const [
      currentPublicState,
      shifts,
      candidates,
      bundles,
      syncCommands,
      notificationIntents,
    ] = await Promise.all([
      Promise.all([
        database.doc(`${root}/shiftPlanningState/current`).get(),
        database.doc(`${root}/shiftRotations/delivery`).get(),
        database.doc(`${root}/shiftRotations/market`).get(),
      ]),
      database.collection(`${root}/shifts`).get(),
      database.collection(`${root}/shiftPlanningCandidates`).get(),
      database.collection(`${root}/shiftPlanningBundles`).get(),
      database.collection(`${root}/shiftPlanningSyncCommands`).get(),
      database.collection(`${root}/shiftPlanningNotificationIntents`).get(),
    ]);
    assert.deepEqual(
      currentPublicState.map((snapshot) => snapshot.data()),
      initialPublicState.map((snapshot) => snapshot.data()),
    );
    for (const snapshot of [
      shifts,
      candidates,
      bundles,
      syncCommands,
      notificationIntents,
    ]) {
      assert.equal(snapshot.size, 0);
    }

    await clear(database);
    await database.terminate();
  },
);

emulatorTest(
  "rejects fairness drift before governed activation and recovery",
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
    const repository = createFirestoreShiftPlanningRepository(database);
    const initialClaim = await repository.claimActivationRequest({
      environment,
      requestId: chain.activateRequest.requestId,
      operationId: `request-${chain.activateRequest.requestId}`,
      workerId: "source-runtime-worker",
      leaseDurationMillis: 300_000,
    });
    assert.equal(initialClaim.kind, "process");
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

    const runtime = createFirestoreShiftPlanningRuntime(database);
    const deviceReference = database.doc(
      `${root}/users/member-a/devices/device-1`,
    );
    const memberReference = database.doc(`${root}/users/member-b`);
    const managerReference = database.doc(`${root}/users/manager-c`);
    const configReference = database.doc(`${root}/config/global`);
    const calendarReference = database.doc(
      `${root}/deliveryCalendar/2026-W41`,
    );
    const policyReference = database.doc(
      `${root}/shiftPlanningState/sourcePolicy`,
    );
    const initialPublicState = await Promise.all([
      database.doc(`${root}/shiftPlanningState/current`).get(),
      database.doc(`${root}/shiftRotations/delivery`).get(),
      database.doc(`${root}/shiftRotations/market`).get(),
    ]);
    const driftCases = [
      {
        name: "destination",
        apply: () => deviceReference.set(
          device("synthetic-token-after-stage"),
          {merge: false},
        ),
        restore: () => deviceReference.set(
          device("synthetic-token-a"),
          {merge: false},
        ),
      },
      {
        name: "membership",
        apply: () => memberReference.update({isActive: false}),
        restore: () => memberReference.update({isActive: true}),
      },
      {
        name: "eligibility",
        apply: () => managerReference.update({
          isCommonPurchaseManager: false,
        }),
        restore: () => managerReference.update({
          isCommonPurchaseManager: true,
        }),
      },
      {
        name: "config",
        apply: () => configReference.update({
          "otherConfig.deliveryDayOfWeek": "THU",
        }),
        restore: () => configReference.update({
          "otherConfig.deliveryDayOfWeek": "WED",
        }),
      },
      {
        name: "calendar",
        apply: () => calendarReference.update({
          ordersCloseAt: Timestamp.fromMillis(Date.UTC(2026, 9, 5)),
        }),
        restore: () => calendarReference.update({
          ordersCloseAt: calendarOverride().ordersCloseAt,
        }),
      },
      {
        name: "credit-ledger",
        apply: () => policyReference.update({
          creditLedger: {
            enabled: true,
            revision: "credits-enabled-v1",
            digest: digest({credits: "enabled-v1"}),
            plannedWriteCount: 1,
          },
        }),
        restore: () => policyReference.update({
          creditLedger: sourcePolicy().creditLedger,
        }),
      },
    ];
    for (const [index, driftCase] of driftCases.entries()) {
      const driftRequest = index === 0 ? chain.activateRequest : {
        ...chain.activateRequest,
        requestId: `${chain.activateRequest.requestId}-${driftCase.name}`,
      };
      if (index > 0) {
        await database.doc(
          `${root}/shiftPlanningRequests/${driftRequest.requestId}`,
        ).create(driftRequest);
      }
      await driftCase.apply();
      const rejected = await runtime.executeRequest({
        environment,
        requestId: driftRequest.requestId,
        request: driftRequest,
        workerId: "source-runtime-worker",
      });
      assert.equal(rejected.kind, "lifecycle", driftCase.name);
      assert.equal(rejected.result.kind, "failed", driftCase.name);
      assert.equal(
        rejected.result.summary.failure.code,
        "fairness_input_drift",
        driftCase.name,
      );
      assert.equal(
        rejected.result.persistenceResult,
        "committed",
        driftCase.name,
      );
      const rejectedReplay = await runtime.executeRequest({
        environment,
        requestId: driftRequest.requestId,
        request: driftRequest,
        workerId: "source-runtime-worker",
      });
      assert.equal(rejectedReplay.kind, "lifecycle", driftCase.name);
      assert.equal(
        rejectedReplay.result.kind,
        "terminalReplay",
        driftCase.name,
      );
      assert.equal(
        rejectedReplay.result.summary.status,
        "failed",
        driftCase.name,
      );
      assert.equal(
        (await database.collection(`${root}/shifts`).get()).size,
        0,
        driftCase.name,
      );
      assert.equal(
        (await database.doc(`${root}/shiftPlanningState/current`).get())
          .get("activeRevision"),
        null,
        driftCase.name,
      );
      const currentPublicState = await Promise.all([
        database.doc(`${root}/shiftPlanningState/current`).get(),
        database.doc(`${root}/shiftRotations/delivery`).get(),
        database.doc(`${root}/shiftRotations/market`).get(),
      ]);
      assert.deepEqual(
        currentPublicState.map((snapshot) => snapshot.data()),
        initialPublicState.map((snapshot) => snapshot.data()),
        driftCase.name,
      );
      await driftCase.restore();
    }
    assert.equal(
      (await database.doc(`${root}/shiftPlanningState/fairness`).get())
        .get("sourceDigest"),
      produced.source.sourceDigest,
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
    const lateClaim = await repository.claimActivationRequest({
      environment,
      requestId: retryRequest.requestId,
      operationId,
      workerId: "late-failure-worker",
      leaseDurationMillis: 300_000,
    });
    assert.equal(lateClaim.kind, "activationCommitted");
    assert.equal(
      (await database.doc(
        `${root}/shiftPlanningRequests/${retryRequest.requestId}`,
      ).get()).get("status"),
      "completed",
    );
    const recoveryOperationId = "recovery-source-runtime-route";
    const activationTerminal = await database.doc(
      `${root}/shiftPlanningOperations/${operationId}`,
    ).get();
    const maintenanceTerminal = await database.doc(
      `${root}/shiftPlanningState/current`,
    ).get();
    const authorizationInput = {
      schemaVersion: 1,
      mode: "recovery",
      state: "authorized",
      environment,
      activationOperationId: operationId,
      recoveryOperationId,
      bundleRevision: activationTerminal.get("bundleRevision"),
      bundleDigest: activationTerminal.get("bundleDigest"),
      activationOperationIntentDigest:
        activationTerminal.get("operationIntentDigest"),
      expectedMaintenance: {
        stateRevision: maintenanceTerminal.get("stateRevision"),
        writeEpoch: maintenanceTerminal.get("writeEpoch"),
        maintenanceStatus: maintenanceTerminal.get("maintenanceStatus"),
        activeRevision: maintenanceTerminal.get("activeRevision"),
        activeDigest: maintenanceTerminal.get("activeDigest"),
        lastTransitionId: maintenanceTerminal.get("lastTransitionId"),
      },
      authorizedAt: Timestamp.fromMillis(1_788_393_600_000),
      expiresAt: Timestamp.fromMillis(1_788_397_200_000),
    };
    const driftedAuthorization = createShiftPlanningRecoveryAuthorization({
      ...authorizationInput,
      expectedMaintenance: {
        ...authorizationInput.expectedMaintenance,
        writeEpoch: authorizationInput.expectedMaintenance.writeEpoch + 1,
      },
    });
    const recoveryCommand = (authorization) => ({
      schemaVersion: 1,
      mode: "recovery",
      environment,
      activationOperationId: operationId,
      recoveryOperationId,
      authorizationDigest: authorization.authorizationDigest,
    });
    const authorizationReference = database.doc(
      shiftPlanningRecoveryAuthorizationPath(
        recoveryCommand(driftedAuthorization),
      ),
    );
    await authorizationReference.create(driftedAuthorization);
    const recoveryExecutor = createFirestoreShiftPlanningOperatorRecoveryExecutor(
      database,
      {clock: () => Timestamp.fromMillis(1_788_393_900_000)},
    );
    await assert.rejects(
      recoveryExecutor.execute(recoveryCommand(driftedAuthorization)),
      (error) => error.code === "invalid_planning_transaction",
    );
    assert.equal(
      (await database.collection(`${root}/shifts`).get()).size,
      chain.activate.delivery.shifts.length +
        chain.activate.market.shifts.length,
    );
    const authorization = createShiftPlanningRecoveryAuthorization(
      authorizationInput,
    );
    await authorizationReference.set(authorization);
    const expiredExecutor = createFirestoreShiftPlanningOperatorRecoveryExecutor(
      database,
      {clock: () => authorization.expiresAt},
    );
    await assert.rejects(
      expiredExecutor.execute(recoveryCommand(authorization)),
      (error) => error.code === "invalid_planning_transaction",
    );
    const recovered = await recoveryExecutor.execute(
      recoveryCommand(authorization),
    );
    assert.equal(recovered.kind, "committed");
    const recoveryReplay = await recoveryExecutor.execute(
      recoveryCommand(authorization),
    );
    assert.equal(recoveryReplay.kind, "terminalReplay");
    assert.equal(recovered.outcome.direction, "inverse");
    assert.equal(recoveryReplay.outcome.outcomeDigest, recovered.outcome.outcomeDigest);
    assert.equal((await database.collection(`${root}/shifts`).get()).size, 0);

    await clear(database);
    await database.terminate();
  },
);
