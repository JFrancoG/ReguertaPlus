"use strict";

const assert = require("node:assert/strict");
const {test} = require("node:test");
const {
  FieldValue,
  Firestore,
  Timestamp,
} = require("@google-cloud/firestore");

const {
  createShiftPlanningDigest,
} = require("../lib/shift-planning-digest.js");
const {
  buildShiftPlanningExactReplacementData,
  materializeShiftPlanningInverseRecovery,
  measureAndSealShiftPlanningInverseRecoveryAttempt,
} = require("../lib/shift-planning-inverse-materializer.js");
const {
  attachShiftPlanningBackendMutationMarker,
  buildShiftPlanningPublicShiftMaterialization,
  createShiftPlanningActivationOperationTerminal,
  createShiftPlanningBeforeImageEnvelope,
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

const environment = "develop";
const root = `${environment}/plus-collections`;
const bundleId = "bundle-2026";
const bundleRevision = "bundle-revision-2026";
const bundleDigest = `shift-planning:v1:sha256:${"b".repeat(64)}`;
const forwardManifestDigest =
  `shift-planning:v1:sha256:${"f".repeat(64)}`;
const previousDigest = `shift-planning:v1:sha256:${"a".repeat(64)}`;
const requestId = "activate-2026";
const operationId = `request-${requestId}`;
const recoveryOperationId = "recovery-activate-2026";
const activationWriteEpoch = 8;
const activatedAt = Timestamp.fromMillis(1_788_307_200_000);
const recoveredAt = Timestamp.fromMillis(1_788_393_600_000);

const rotation = (type) => ({
  schemaVersion: 1,
  type,
  stateRevision: type === "delivery" ? 4 : 7,
  cursor: {
    schemaVersion: 1,
    type,
    cohortUserIds: ["member-1", "member-2", "member-3"],
    roundNumber: 1,
    nextMemberIndex: 0,
  },
  planningFrontierSeasonStartYear: 2026,
  cohortFrozen: false,
  frozenCohortUserIds: [],
  activeRevision: "active-previous",
  activeDigest: previousDigest,
  lastIdempotencyKey: null,
  migrationBaseline: null,
  releaseLease: null,
});

const maintenance = {
  schemaVersion: 1,
  stateRevision: 11,
  writeEpoch: 7,
  maintenanceStatus: "closed",
  activeRevision: "active-previous",
  activeDigest: previousDigest,
  intakeBarrier: {
    revision: "barrier-v1",
    digest: `shift-planning:v1:sha256:${"c".repeat(64)}`,
    verifiedAtMillis: 1_782_643_100_000,
  },
  lastTransitionId: "maintenance-enter-1",
};

const readDocument = (targetPath, data, millis) => ({
  targetPath,
  data,
  updateTime: Timestamp.fromMillis(millis),
});

const fixture = () => {
  const deliveryPath = `${root}/shiftRotations/delivery`;
  const marketPath = `${root}/shiftRotations/market`;
  const maintenancePath = `${root}/shiftPlanningState/current`;
  const beforeByPath = new Map([
    [deliveryPath, rotation("delivery")],
    [marketPath, rotation("market")],
    [maintenancePath, maintenance],
  ]);
  const authoritativeState = buildShiftPlanningAuthoritativeState({
    environment,
    maintenance,
    rotations: {
      delivery: beforeByPath.get(deliveryPath),
      market: beforeByPath.get(marketPath),
    },
  });
  const expectedState = {
    authoritativeState,
    transactionMeasurementAuthority: {
      adapterRevision: SHIFT_PLANNING_FIRESTORE_COMMIT_ADAPTER_REVISION,
      indexConfigurationDigest:
        `shift-planning:v1:sha256:${"1".repeat(64)}`,
    },
  };
  const position = {
    schemaVersion: 1,
    positionId: "shift_delivery_20260903",
    candidateId: bundleId,
    type: "delivery",
    shiftId: "shift_delivery_20260903",
    scheduledDate: "2026-09-03",
    projectionSeasonStartYear: 2026,
    rotationOwnerUserIds: ["member-1"],
    assignedUserIds: ["member-1"],
    rotationPositions: [{
      rotationOwnerUserId: "member-1",
      effectiveAssigneeUserId: "member-1",
      roundNumber: 1,
      positionInRound: 1,
      planningReason: "target",
    }],
    helperUserId: "member-2",
    source: "app",
    origin: "planner",
    planningRequestId: requestId,
    bundleRevision,
    bundleDigest,
    writeEpoch: activationWriteEpoch,
  };
  const publicMaterialization = buildShiftPlanningPublicShiftMaterialization({
    environment,
    position,
    attemptedAt: activatedAt,
  });
  const publicPath = publicMaterialization.targetPath;
  const predecessorPosition = {
    ...position,
    positionId: "shift_delivery_20260827",
    candidateId: "prior-candidate",
    shiftId: "shift_delivery_20260827",
    scheduledDate: "2026-08-27",
    projectionSeasonStartYear: 2025,
    assignedUserIds: ["member-3"],
    rotationOwnerUserIds: ["member-3"],
    rotationPositions: [{
      rotationOwnerUserId: "member-3",
      effectiveAssigneeUserId: "member-3",
      roundNumber: 1,
      positionInRound: 3,
      planningReason: "target",
    }],
    helperUserId: null,
    planningRequestId: "prior-request",
    bundleRevision: "active-previous",
    bundleDigest: previousDigest,
    writeEpoch: 7,
  };
  const predecessorMaterialization =
    buildShiftPlanningPublicShiftMaterialization({
      environment,
      position: predecessorPosition,
      attemptedAt: Timestamp.fromMillis(1_787_702_400_000),
    });
  const priorOperation = createShiftPlanningActivationOperationTerminal({
    operationId: "request-prior-request",
    environment,
    requestId: "prior-request",
    candidateId: "prior-candidate",
    bundleRevision: "active-previous",
    bundleDigest: previousDigest,
    forwardManifestDigest:
      `shift-planning:v1:sha256:${"8".repeat(64)}`,
    expectedStateDigest:
      `shift-planning:v1:sha256:${"9".repeat(64)}`,
    writeEpoch: 7,
    attemptedAt: Timestamp.fromMillis(1_787_702_400_000),
    publicMutations: [{
      mutationKind: "create",
      targetPath: predecessorMaterialization.targetPath,
      documentRevision: predecessorMaterialization.documentRevision,
      payloadDigest: predecessorMaterialization.payloadDigest,
    }],
    beforeImages: [],
  });
  const predecessorBefore = attachShiftPlanningBackendMutationMarker({
    materialization: predecessorMaterialization,
    operation: priorOperation,
  });
  const predecessorPayload = {...predecessorBefore};
  delete predecessorPayload.lastBackendMutation;
  const predecessorAfterMaterialization =
    createShiftPlanningPublicShiftMaterialization({
      targetPath: predecessorMaterialization.targetPath,
      payload: {
        ...predecessorPayload,
        helperUserId: "member-1",
        planningRequestId: bundleId,
        bundleRevision,
        bundleDigest,
        writeEpoch: activationWriteEpoch,
        assignmentRevision: predecessorBefore.assignmentRevision + 1,
        documentRevision: predecessorBefore.documentRevision + 1,
        updatedAt: activatedAt,
      },
    });
  beforeByPath.set(predecessorMaterialization.targetPath, predecessorBefore);
  const syncCommands = ["delivery", "market"].map((type) => ({
    commandId: `${bundleRevision}-${type}`,
    idempotencyKey: `${bundleRevision}:${type}`,
    state: "pending",
    type,
    bundleRevision,
    bundleDigest,
    expectedAuthoritativeDigest: authoritativeState.authoritativeDigest,
    activationWriteEpoch,
    payload: {type},
  }));
  const heldNotificationIntents = [{
    intentId: `${bundleRevision}-notification-1`,
    state: "held",
    bundleRevision,
    bundleDigest,
    writeEpoch: activationWriteEpoch,
    recipientUserId: "member-1",
  }];
  const deleteCreatedDocuments = [
    publicPath,
    ...syncCommands.map((command) =>
      `${root}/shiftPlanningSyncCommands/${command.commandId}`),
    ...heldNotificationIntents.map((intent) =>
      `${root}/shiftPlanningNotificationIntents/${intent.intentId}`),
  ].map((pathTemplate) => ({
    pathTemplate,
    expectedBundleRevision: "{bundleRevision}",
    expectedBundleDigest: "{bundleDigest}",
  }));
  const restoreBeforeImages = [...beforeByPath.entries()].map(
    ([targetPath, document], index) => ({
      targetPath,
      beforeImagePathTemplate:
        `${root}/shiftPlanningOperations/{operationId}/` +
        `beforeImages/${index + 1}`,
      captureContractDigest: targetPath.includes("/shifts/") ?
        `shift-planning:v1:sha256:${"7".repeat(64)}` :
        createShiftPlanningDigest(document),
    }),
  );
  const inverseManifest = {
    expectedStateDigest: createShiftPlanningDigest(expectedState),
    expectedAuthoritativeDigest: authoritativeState.authoritativeDigest,
    requiresPersistedBeforeImages: true,
    recoveryWriteEpoch: {
      kind: "incrementCurrent",
      minimumExclusiveEpoch: activationWriteEpoch,
      neverReuseOrDecrement: true,
    },
    restoreActiveLineage: {
      revision: maintenance.activeRevision,
      digest: maintenance.activeDigest,
    },
    requiredActiveCas: {
      bundleRevision: "{bundleRevision}",
      bundleDigest: "{bundleDigest}",
      writeEpoch: activationWriteEpoch,
    },
    deleteCreatedDocuments,
    restoreBeforeImages,
    publicProjectionDeletes: {delivery: 1, market: 0},
    predecessorHelperRestores: 1,
    rotationRestores: 2,
    activeStateRestores: 1,
    bundleMetadataUpdates: 0,
    requestUpdates: 1,
    stagedCandidateUpdates: 0,
    syncCommandDeletes: 2,
    operationRegistryUpdates: 1,
    heldIntentDeletes: 1,
    creditLedgerRestores: 0,
    releaseLeaseActions: [
      {action: "clear", type: "delivery", expectedState: "sealed"},
      {action: "clear", type: "market", expectedState: "sealed"},
    ],
  };
  const artifact = {
    schemaVersion: 1,
    bundleId,
    environment,
    bundleRevision,
    bundleDigest,
    expectedWriteEpoch: 7,
    activationWriteEpoch,
    expectedActiveRevision: maintenance.activeRevision,
    expectedState,
    manifests: {inverse: inverseManifest},
    budgets: {
      inverse: {
        direction: "inverse",
        writeLimit: 500,
        publicShiftWrites: 1,
        predecessorHelperWrites: 1,
        rotationWrites: 2,
        activeStateWrites: 1,
        bundleMetadataWrites: 0,
        requestWrites: 1,
        stagedCandidateWrites: 0,
        syncCommandWrites: 2,
        operationRegistryWrites: 1,
        beforeImageWrites: 0,
        heldIntentWrites: 1,
        creditLedgerWrites: 0,
        createWrites: 0,
        updateWrites: 6,
        deleteWrites: 4,
        totalWrites: 10,
      },
    },
    releaseLeaseIntents: ["delivery", "market"].map((type) => ({
      action: "acquire",
      type,
      state: "sealed",
      bundleId,
      bundleRevision,
      bundleDigest,
      leaseEpoch: activationWriteEpoch,
      ownerOperationId: operationId,
      expectedCurrentLease: null,
      deadlinePolicy: {durationMillis: 900_000},
    })),
    syncCommands,
    heldNotificationIntents,
    transactionRequirements: {
      byteLimit: 10 * 1024 * 1024,
      forwardManifestDigest,
      inverseManifestDigest: createShiftPlanningDigest(inverseManifest),
    },
  };
  const bundle = {
    schemaVersion: 1,
    environment,
    bundleId,
    bundleRevision,
    bundleDigest,
    artifactDigest: createShiftPlanningDigest(artifact),
    artifact,
  };
  const beforeImages = restoreBeforeImages.map((restore, index) =>
    createShiftPlanningBeforeImageEnvelope({
      operationId,
      environment,
      bundleRevision,
      bundleDigest,
      forwardManifestDigest,
      writeEpoch: activationWriteEpoch,
      ordinal: index + 1,
      targetPath: restore.targetPath,
      targetUpdateTime: Timestamp.fromMillis(1_788_307_100_000 + index),
      captureContractDigest: restore.captureContractDigest,
      document: beforeByPath.get(restore.targetPath),
    }));
  const activation = createShiftPlanningActivationOperationTerminal({
    operationId,
    environment,
    requestId,
    candidateId: bundleId,
    bundleRevision,
    bundleDigest,
    forwardManifestDigest,
    expectedStateDigest: inverseManifest.expectedStateDigest,
    writeEpoch: activationWriteEpoch,
    attemptedAt: activatedAt,
    publicMutations: [
      {
        mutationKind: "create",
        targetPath: publicPath,
        documentRevision: publicMaterialization.documentRevision,
        payloadDigest: publicMaterialization.payloadDigest,
      },
      {
        mutationKind: "update",
        targetPath: predecessorAfterMaterialization.targetPath,
        documentRevision: predecessorAfterMaterialization.documentRevision,
        payloadDigest: predecessorAfterMaterialization.payloadDigest,
      },
    ],
    beforeImages: beforeImages.map((envelope) => ({
      ordinal: envelope.ordinal,
      targetPath: envelope.targetPath,
      envelopePath: envelope.envelopePath,
      envelopeDigest: envelope.envelopeDigest,
    })),
  });
  const publicDocument = attachShiftPlanningBackendMutationMarker({
    materialization: publicMaterialization,
    operation: activation,
  });
  const predecessorAfter = attachShiftPlanningBackendMutationMarker({
    materialization: predecessorAfterMaterialization,
    operation: activation,
  });
  const leaseFor = (type) => ({
    type,
    bundleId,
    bundleRevision,
    bundleDigest,
    leaseEpoch: activationWriteEpoch,
    ownerOperationId: operationId,
    state: "sealed",
    acquiredAtMillis: activatedAt.toMillis(),
    deadlineAtMillis: activatedAt.toMillis() + 900_000,
  });
  const currentDocuments = [
    readDocument(deliveryPath, {
      ...beforeByPath.get(deliveryPath),
      stateRevision: beforeByPath.get(deliveryPath).stateRevision + 1,
      activeRevision: bundleRevision,
      activeDigest: bundleDigest,
      lastIdempotencyKey: `${bundleRevision}:activation:delivery`,
      releaseLease: leaseFor("delivery"),
    }, 1_788_307_210_000),
    readDocument(marketPath, {
      ...beforeByPath.get(marketPath),
      stateRevision: beforeByPath.get(marketPath).stateRevision + 1,
      activeRevision: bundleRevision,
      activeDigest: bundleDigest,
      lastIdempotencyKey: `${bundleRevision}:activation:market`,
      releaseLease: leaseFor("market"),
    }, 1_788_307_220_000),
    readDocument(maintenancePath, {
      ...maintenance,
      stateRevision: maintenance.stateRevision + 1,
      writeEpoch: activationWriteEpoch,
      activeRevision: bundleRevision,
      activeDigest: bundleDigest,
      lastTransitionId: operationId,
    }, 1_788_307_230_000),
    readDocument(publicPath, publicDocument, 1_788_307_240_000),
    readDocument(
      predecessorAfterMaterialization.targetPath,
      predecessorAfter,
      1_788_307_245_000,
    ),
    ...syncCommands.map((command, index) => readDocument(
      `${root}/shiftPlanningSyncCommands/${command.commandId}`,
      command,
      1_788_307_250_000 + index,
    )),
    ...heldNotificationIntents.map((intent, index) => readDocument(
      `${root}/shiftPlanningNotificationIntents/${intent.intentId}`,
      intent,
      1_788_307_260_000 + index,
    )),
  ];
  const summary = {
    schemaVersion: 1,
    status: "completed",
    mode: "activate",
    bundleId,
    bundleRevision,
    bundleDigest,
    delivery: {
      targetSeasonStartYear: 2026,
      generatedShiftCount: 1,
      affectedProjectionSeasonStartYears: [2026],
    },
    market: {
      targetSeasonStartYear: 2026,
      generatedShiftCount: 0,
      affectedProjectionSeasonStartYears: [],
    },
  };
  const persistedArtifact = {
    kind: "candidate",
    candidateId: bundleId,
    candidateDigest: `shift-planning:v1:sha256:${"d".repeat(64)}`,
    bundleArtifactDigest: bundle.artifactDigest,
  };
  const requestDocument = {
    schemaVersion: 2,
    requestId,
    bundleId,
    environment,
    requestedByUserId: "admin-1",
    requestedAt: Timestamp.fromMillis(1_782_643_320_000),
    mode: "activate",
    status: "completed",
    expectedWriteEpoch: 7,
    expectedActiveRevision: maintenance.activeRevision,
    subplans: {
      delivery: {targetSeasonStartYear: 2026},
      market: {targetSeasonStartYear: 2026},
    },
    binding: {
      kind: "candidate",
      candidateId: bundleId,
      bundleRevision,
      bundleDigest,
      candidateDigest: persistedArtifact.candidateDigest,
    },
    lifecycle: {
      schemaVersion: 1,
      operationId,
      requestIntentDigest:
        `shift-planning:v1:sha256:${"e".repeat(64)}`,
      state: "completed",
      lease: {
        workerId: "worker-1",
        fencingEpoch: 1,
        acquiredAt: activatedAt,
        expiresAt: Timestamp.fromMillis(activatedAt.toMillis() + 60_000),
      },
      terminalDigest: createShiftPlanningDigest({
        summary,
        artifact: persistedArtifact,
      }),
      summary,
      artifact: persistedArtifact,
    },
  };
  return {
    recoveryOperationId,
    recoveredAt,
    bundle,
    activationOperationDocument: readDocument(
      `${root}/shiftPlanningOperations/${operationId}`,
      activation,
      1_788_307_270_000,
    ),
    requestDocument: readDocument(
      `${root}/shiftPlanningRequests/${requestId}`,
      requestDocument,
      1_788_307_280_000,
    ),
    beforeImageDocuments: beforeImages.map((envelope, index) =>
      readDocument(
        envelope.envelopePath,
        envelope,
        1_788_307_290_000 + index,
      )),
    currentDocuments,
  };
};

const errorCode = (expectedCode) => (error) =>
  error instanceof Error && error.code === expectedCode;

test("materializes exact inverse mutations and advances recovery epoch", () => {
  const input = fixture();
  const result = materializeShiftPlanningInverseRecovery(input);

  assert.equal(result.recoveryWriteEpoch, activationWriteEpoch + 1);
  assert.equal(
    result.mutations.length,
    input.bundle.artifact.budgets.inverse.totalWrites,
  );
  assert.equal(
    result.mutations.filter(({kind}) => kind === "delete").length,
    input.bundle.artifact.budgets.inverse.deleteWrites,
  );
  const maintenanceRestore = result.restoredDocuments.find(({targetPath}) =>
    targetPath.endsWith("/shiftPlanningState/current"));
  assert.equal(maintenanceRestore.document.activeRevision, "active-previous");
  assert.equal(maintenanceRestore.document.writeEpoch, activationWriteEpoch + 1);
  const predecessorRestore = result.restoredDocuments.find(({targetPath}) =>
    targetPath.includes("/shifts/"));
  assert.equal(predecessorRestore.document.helperUserId, null);
  assert.equal(predecessorRestore.document.bundleRevision, "active-previous");
  const operationMutation = result.mutations.find(({documentPath}) =>
    documentPath === result.operationPath);
  assert.ok(operationMutation.data.attemptedAt instanceof FieldValue);
  assert.equal(result.operation.operationKind, "activationRecovery");
  assert.match(
    result.operation.recoveryIntentDigest,
    /^shift-planning:v1:sha256:[a-f0-9]{64}$/,
  );
});

test("exact replacement deletes after-only fields and replaces nested maps", () => {
  const replacement = buildShiftPlanningExactReplacementData({
    desired: {kept: {before: true}},
    current: {kept: {before: false, afterOnly: true}, afterOnly: 1},
  });

  assert.deepEqual(replacement.kept, {before: true});
  assert.ok(replacement.afterOnly instanceof FieldValue);
});

test("rejects active CAS and before-image drift", () => {
  const stale = fixture();
  const maintenanceDocument = stale.currentDocuments.find(({targetPath}) =>
    targetPath.endsWith("/shiftPlanningState/current"));
  maintenanceDocument.data.writeEpoch += 1;
  assert.throws(
    () => materializeShiftPlanningInverseRecovery(stale),
    errorCode("invalid_planning_inverse_materialization"),
  );

  const driftedEnvelope = fixture();
  driftedEnvelope.beforeImageDocuments[0].data.envelopeDigest =
    `shift-planning:v1:sha256:${"0".repeat(64)}`;
  assert.throws(
    () => materializeShiftPlanningInverseRecovery(driftedEnvelope),
    errorCode("invalid_planning_inverse_materialization"),
  );
});

test(
  "seals and commits the exact inverse batch in the real adapter",
  {skip: !process.env.FIRESTORE_EMULATOR_HOST},
  async () => {
    const database = new Firestore({
      projectId: "demo-reguerta-hu082-inverse-materializer",
      databaseId: "(default)",
    });
    const base = fixture();
    const seedDocuments = [
      base.activationOperationDocument,
      base.requestDocument,
      ...base.beforeImageDocuments,
      ...base.currentDocuments,
    ];
    const seed = database.batch();
    seedDocuments.forEach((document) => {
      seed.set(database.doc(document.targetPath), document.data);
    });
    await seed.commit();

    const result = await database.runTransaction(async (transaction) => {
      const snapshots = await Promise.all(seedDocuments.map((document) =>
        transaction.get(database.doc(document.targetPath))));
      const liveByPath = new Map(snapshots.map((snapshot) => [
        snapshot.ref.path,
        {
          targetPath: snapshot.ref.path,
          data: snapshot.data(),
          updateTime: snapshot.updateTime,
        },
      ]));
      return measureAndSealShiftPlanningInverseRecoveryAttempt({
        ...base,
        firestore: database,
        transaction,
        activationOperationDocument: liveByPath.get(
          base.activationOperationDocument.targetPath,
        ),
        requestDocument: liveByPath.get(base.requestDocument.targetPath),
        beforeImageDocuments: base.beforeImageDocuments.map((document) =>
          liveByPath.get(document.targetPath)),
        currentDocuments: base.currentDocuments.map((document) =>
          liveByPath.get(document.targetPath)),
      });
    });

    assert.equal(result.measurement.direction, "inverse");
    assert.equal(
      result.measurement.documentWriteCount,
      base.bundle.artifact.budgets.inverse.totalWrites,
    );
    const deleted = await Promise.all(result.materialization.deletedPaths.map(
      (path) => database.doc(path).get(),
    ));
    assert.equal(deleted.every((snapshot) => !snapshot.exists), true);
    const restoredState = await database
      .doc(`${root}/shiftPlanningState/current`).get();
    assert.equal(restoredState.get("activeRevision"), "active-previous");
    assert.equal(restoredState.get("writeEpoch"), activationWriteEpoch + 1);
    const operation = await database
      .doc(result.materialization.operationPath).get();
    assert.equal(operation.get("operationKind"), "activationRecovery");
    assert.equal(operation.get("attemptedAt"), undefined);
    const predecessorPath = result.materialization.restoredDocuments
      .find(({targetPath}) => targetPath.includes("/shifts/")).targetPath;
    const predecessor = await database.doc(predecessorPath).get();
    assert.equal(predecessor.get("helperUserId"), null);
    assert.equal(predecessor.get("bundleRevision"), "active-previous");
    assert.equal(
      (await database.doc(base.beforeImageDocuments[0].targetPath).get()).exists,
      true,
    );
    await database.terminate();
  },
);
