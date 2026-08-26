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
  createFirestoreShiftPlanningCasRuntime,
} = require("../lib/shift-planning-firestore-cas-runtime.js");
const {
  createFirestoreShiftPlanningForwardActivationResolver,
  createFirestoreShiftPlanningInverseRecoveryResolver,
  createShiftPlanningLiveSourceDocument,
  parseShiftPlanningLiveSourceDocument,
} = require("../lib/shift-planning-firestore-source-resolver.js");
const {
  SHIFT_PLANNING_FIRESTORE_COMMIT_ADAPTER_REVISION,
} = require(
  "../lib/shift-planning-firestore-transaction-serializer.js"
);
const {
  buildShiftPlanningAuthoritativeState,
} = require("../lib/shift-planning-state-persistence.js");

const projectId = "demo-reguerta-hu082-source-resolver";
const environment = "develop";
const root = `${environment}/plus-collections`;
const memberIds = Array.from(
  {length: 6},
  (_, index) => `resolver-member-${index + 1}`,
);
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

const rotations = () => ({
  delivery: rotation("delivery", memberIds),
  market: rotation("market", [
    memberIds[2],
    memberIds[1],
    memberIds[0],
    memberIds[5],
    memberIds[4],
    memberIds[3],
  ]),
});

const maintenance = () => ({
  schemaVersion: 1,
  stateRevision: 11,
  writeEpoch: 7,
  maintenanceStatus: "closed",
  activeRevision: null,
  activeDigest: null,
  intakeBarrier: {
    revision: "barrier-source-v1",
    digest: digest({barrier: "source-v1"}),
    verifiedAtMillis: 1_788_307_100_000,
  },
  lastTransitionId: "maintenance-source-v1",
});

const fairnessSnapshot = (sourceRotations = rotations()) => ({
  snapshotVersion: 1,
  environment,
  writeEpoch: 7,
  activeRevision: null,
  activeDigest: null,
  membership: {
    revision: "membership-source-12",
    digest: digest({membership: "source-12"}),
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
  rotations: sourceRotations,
  config: {
    revision: "config-source-3",
    policyRevision: "hu-082-v1",
    deliveryWeekday: "THU",
    timeZone: "Europe/Madrid",
    releaseLeaseDurationMillis: 900_000,
  },
  calendar: {
    revision: "calendar-source-9",
    deliveryOverrideRevision: "delivery-source-2",
    marketCalendarRevision: "market-source-1",
  },
  overrides: {
    revision: "overrides-source-2",
    digest: digest({overrides: "source-2"}),
  },
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
  migrationBaseline: null,
});

const sourceInputs = (snapshot = fairnessSnapshot()) => ({
  fairnessSnapshot: snapshot,
  delivery: {
    continuity: {kind: "newRotation"},
    inheritedTargetPrefix: null,
    futureProjectionOccupancy: [],
  },
  market: {
    inheritedTargetPrefix: null,
    futureProjectionOccupancy: [],
  },
  transactionWriteLimit: 500,
});

const request = ({requestId, mode, binding}) => ({
  schemaVersion: 2,
  requestId,
  bundleId: "bundle-source-2026",
  environment,
  requestedByUserId: "resolver-admin-1",
  requestedAt: Timestamp.fromMillis(1_788_307_200_000),
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

const planningChain = () => {
  const sourceRotations = rotations();
  const state = buildShiftPlanningAuthoritativeState({
    environment,
    maintenance: maintenance(),
    rotations: sourceRotations,
  });
  const inputs = sourceInputs(fairnessSnapshot(sourceRotations));
  const previewRequest = request({
    requestId: "preview-source-runtime",
    mode: "preview",
    binding: null,
  });
  const preview = planShiftPlanningBundle({
    request: previewRequest,
    authoritativeState: state,
    ...inputs,
  });
  const stageRequest = request({
    requestId: "stage-source-runtime",
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
    authoritativeState: state,
    ...inputs,
    persistedPreview: preview.previewReceipt,
  });
  const activateRequest = request({
    requestId: "activate-source-runtime",
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
    authoritativeState: state,
    ...inputs,
    stagedCandidate: stage.stagedCandidate,
  });
  return {
    sourceRotations,
    state,
    inputs,
    stage,
    activate,
    activateRequest,
  };
};

const seedActivation = async (database, chain) => {
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
  batch.create(database.doc(`${root}/shiftPlanningState/current`), maintenance());
  batch.create(
    database.doc(`${root}/shiftPlanningState/fairness`),
    createShiftPlanningLiveSourceDocument({
      environment,
      sourceRevision: "source-live-1",
      inputs: chain.inputs,
    }),
  );
  batch.create(
    database.doc(`${root}/shiftRotations/delivery`),
    chain.sourceRotations.delivery,
  );
  batch.create(
    database.doc(`${root}/shiftRotations/market`),
    chain.sourceRotations.market,
  );
  batch.create(
    database.doc(
      `${root}/shiftPlanningBundles/${bundle.bundleRevision}`,
    ),
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

const errorCode = (expectedCode) => (error) =>
  error instanceof Error && error.code === expectedCode;

const rebuildPersistedSource = async ({firestore, transaction}) => {
  const snapshot = await transaction.get(
    firestore.doc(`${root}/shiftPlanningState/fairness`),
  );
  return parseShiftPlanningLiveSourceDocument(snapshot.data());
};

test("seals and revalidates the complete live source envelope", () => {
  const source = createShiftPlanningLiveSourceDocument({
    environment,
    sourceRevision: "source-live-pure-1",
    inputs: sourceInputs(),
  });
  assert.deepEqual(parseShiftPlanningLiveSourceDocument(source), source);
  assert.throws(
    () => parseShiftPlanningLiveSourceDocument({
      ...source,
      inputs: {
        ...source.inputs,
        fairnessSnapshot: {
          ...source.inputs.fairnessSnapshot,
          membership: {revision: "drifted", digest: digest({drifted: true})},
        },
      },
    }),
    errorCode("invalid_planning_transaction"),
  );
});

test(
  "resolves, activates, and recovers one exact live transaction read-set",
  {skip: !process.env.FIRESTORE_EMULATOR_HOST},
  async () => {
    const database = new Firestore({projectId, databaseId: "(default)"});
    const chain = planningChain();
    await seedActivation(database, chain);
    const operationId = `request-${chain.activateRequest.requestId}`;
    const runtime = createFirestoreShiftPlanningCasRuntime(database);
    const sourceReference = database.doc(
      `${root}/shiftPlanningState/fairness`,
    );
    const driftedSnapshot = {
      ...chain.inputs.fairnessSnapshot,
      membership: {
        revision: "membership-source-13",
        digest: digest({membership: "source-13"}),
      },
    };
    await sourceReference.set(createShiftPlanningLiveSourceDocument({
      environment,
      sourceRevision: "source-live-2",
      inputs: sourceInputs(driftedSnapshot),
    }));
    await assert.rejects(
      runtime.executeForwardActivation({
        environment,
        operationId,
        workerId: "source-resolver-worker",
        fencingEpoch: 1,
        leaseDurationMillis: 60_000,
        resolveAttempt:
          createFirestoreShiftPlanningForwardActivationResolver({
            environment,
            requestId: chain.activateRequest.requestId,
            rebuildLiveSource: rebuildPersistedSource,
          }),
      }),
      errorCode("candidate_binding_mismatch"),
    );
    assert.equal((await database.collection(`${root}/shifts`).get()).size, 0);
    assert.equal(
      (await database.doc(
        `${root}/shiftPlanningOperations/${operationId}`,
      ).get()).exists,
      false,
    );
    await sourceReference.set(createShiftPlanningLiveSourceDocument({
      environment,
      sourceRevision: "source-live-1",
      inputs: chain.inputs,
    }));
    const activation = await runtime.executeForwardActivation({
      environment,
      operationId,
      workerId: "source-resolver-worker",
      fencingEpoch: 1,
      leaseDurationMillis: 60_000,
      resolveAttempt:
        createFirestoreShiftPlanningForwardActivationResolver({
          environment,
          requestId: chain.activateRequest.requestId,
          rebuildLiveSource: rebuildPersistedSource,
        }),
    });
    assert.equal(activation.kind, "committed");
    assert.equal(activation.outcome.direction, "forward");
    assert.equal(
      (await database.doc(`${root}/shiftPlanningState/current`).get())
        .get("activeRevision"),
      chain.activate.bundleRevision,
    );
    const publicShifts = await database.collection(`${root}/shifts`).get();
    assert.equal(
      publicShifts.size,
      chain.activate.delivery.shifts.length + chain.activate.market.shifts.length,
    );

    const recovery = await runtime.executeInverseRecovery({
      environment,
      activationOperationId: operationId,
      recoveryOperationId: "recovery-source-runtime",
      resolveAttempt: createFirestoreShiftPlanningInverseRecoveryResolver({
        environment,
        activationOperationId: operationId,
      }),
    });
    assert.equal(recovery.kind, "committed");
    assert.equal(recovery.outcome.direction, "inverse");
    assert.equal((await database.collection(`${root}/shifts`).get()).size, 0);
    const recoveredState = await database.doc(
      `${root}/shiftPlanningState/current`,
    ).get();
    assert.equal(recoveredState.get("writeEpoch"), 9);
    assert.equal(recoveredState.get("activeRevision"), null);
    assert.equal(
      (await database.doc(
        `${root}/shiftPlanningOperations/${operationId}`,
      ).get()).get("operationKind"),
      "activationRecovery",
    );
    assert.equal(
      (await database.doc(
        `${root}/shiftPlanningOperations/${operationId}`,
      ).collection("attemptOutcomes").get()).size,
      2,
    );
    await database.terminate();
  },
);
