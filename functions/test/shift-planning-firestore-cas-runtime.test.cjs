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
  createFirestoreShiftPlanningCasRuntime,
  createShiftPlanningForwardActivationOutcome,
  createShiftPlanningInverseRecoveryOutcome,
} = require("../lib/shift-planning-firestore-cas-runtime.js");
const {
  SHIFT_PLANNING_FIRESTORE_COMMIT_ADAPTER_REVISION,
} = require(
  "../lib/shift-planning-firestore-transaction-serializer.js"
);
const {
  createShiftPlanningActivationOperationTerminal,
} = require("../lib/shift-planning-publication-contract.js");

const projectId = "demo-reguerta-hu082-cas-runtime";
const environment = "develop";
const digest = (value) => createShiftPlanningDigest(value);
const databaseName = `projects/${projectId}/databases/(default)`;
const indexConfigurationDigest = digest({indexes: "strict-v1"});

const measurement = ({direction, manifestDigest, attemptNumber}) => ({
  schemaVersion: 1,
  direction,
  manifestDigest,
  databaseName,
  writeSetDigest:
    `shift-planning:firestore-write-set:v1:sha256:` +
    `${String(attemptNumber).padStart(64, "a")}`,
  commitRequestDigest:
    `shift-planning:firestore-commit-request:v1:sha256:` +
    `${String(attemptNumber).padStart(64, "b")}`,
  documentWriteCount: 2,
  fieldTransformCount: 0,
  maximumFieldTransformsPerDocument: 0,
  requestByteCount: 512 + attemptNumber,
  adapterRevision: SHIFT_PLANNING_FIRESTORE_COMMIT_ADAPTER_REVISION,
  indexConfigurationDigest,
});

const activationOperation = ({operationId, attemptedAt}) =>
  createShiftPlanningActivationOperationTerminal({
    operationId,
    environment,
    requestId: operationId.replace(/^request-/, ""),
    candidateId: "bundle-runtime-2026",
    bundleRevision: "bundle-revision-runtime-2026",
    bundleDigest: digest({bundle: "runtime-2026"}),
    forwardManifestDigest: digest({manifest: "forward-runtime"}),
    expectedStateDigest: digest({state: "before-runtime"}),
    writeEpoch: 8,
    attemptedAt,
    publicMutations: [{
      mutationKind: "create",
      targetPath:
        `${environment}/plus-collections/shifts/runtime-delivery-1`,
      documentRevision: 1,
      payloadDigest: digest({shift: "runtime-delivery-1"}),
    }],
    beforeImages: [],
  });

const recoveryOperation = ({activation, recoveryOperationId, recoveredAt}) => {
  const withoutDigest = {
    schemaVersion: 1,
    operationKind: "activationRecovery",
    state: "committed",
    operationId: activation.operationId,
    recoveryOperationId,
    environment,
    requestId: activation.requestId,
    bundleRevision: activation.bundleRevision,
    bundleDigest: activation.bundleDigest,
    forwardManifestDigest: activation.forwardManifestDigest,
    inverseManifestDigest: digest({manifest: "inverse-runtime"}),
    activationOperationIntentDigest: activation.operationIntentDigest,
    expectedStateDigest: activation.expectedStateDigest,
    activationWriteEpoch: activation.writeEpoch,
    recoveryWriteEpoch: activation.writeEpoch + 1,
    recoveredAt,
    restoreActiveLineage: {
      revision: "active-before-runtime",
      digest: digest({active: "before-runtime"}),
    },
    deletedPaths: [
      `${environment}/plus-collections/shifts/runtime-delivery-1`,
    ],
    restoredBeforeImages: [
      "shiftPlanningState/current",
      "shiftRotations/delivery",
      "shiftRotations/market",
    ].map((target, index) => ({
      ordinal: index + 1,
      targetPath: `${environment}/plus-collections/${target}`,
      envelopePath: `${environment}/plus-collections/` +
        `shiftPlanningOperations/${activation.operationId}/` +
        `beforeImages/${index + 1}`,
      envelopeDigest: digest({beforeImage: index + 1}),
    })),
  };
  return {
    ...withoutDigest,
    recoveryIntentDigest: digest({
      ...withoutDigest,
      recoveredAt: {
        seconds: recoveredAt.seconds,
        nanoseconds: recoveredAt.nanoseconds,
      },
    }),
  };
};

const forwardAttempt = (attemptedAt, attemptNumber = 1) => {
  const operation = activationOperation({
    operationId: "request-activate-runtime-pure",
    attemptedAt,
  });
  return {
    materialization: {
      operationPath: `${environment}/plus-collections/` +
        `shiftPlanningOperations/${operation.operationId}`,
      operation,
      beforeImages: [],
      publicDocuments: [],
      mutations: [],
    },
    measurement: measurement({
      direction: "forward",
      manifestDigest: operation.forwardManifestDigest,
      attemptNumber,
    }),
  };
};

const inverseAttempt = (recoveredAt, attemptNumber = 1) => {
  const activation = activationOperation({
    operationId: "request-activate-runtime-inverse-pure",
    attemptedAt: Timestamp.fromMillis(recoveredAt.toMillis() - 1_000),
  });
  const operation = recoveryOperation({
    activation,
    recoveryOperationId: "recovery-runtime-inverse-pure",
    recoveredAt,
  });
  return {
    materialization: {
      operationPath: `${environment}/plus-collections/` +
        `shiftPlanningOperations/${operation.operationId}`,
      operation,
      recoveryWriteEpoch: operation.recoveryWriteEpoch,
      restoredDocuments: [],
      deletedPaths: operation.deletedPaths,
      mutations: [],
    },
    measurement: measurement({
      direction: "inverse",
      manifestDigest: operation.inverseManifestDigest,
      attemptNumber,
    }),
  };
};

const errorCode = (expectedCode) => (error) =>
  error instanceof Error && error.code === expectedCode;

test("derives forward and inverse outcomes only from final attempts", () => {
  const forwardTime = Timestamp.fromMillis(1_788_307_200_000);
  const forward = createShiftPlanningForwardActivationOutcome(
    forwardAttempt(forwardTime),
    Timestamp.fromMillis(forwardTime.toMillis() + 1),
  );
  assert.equal(forward.direction, "forward");
  assert.equal(forward.writeEpoch, 8);

  const inverseTime = Timestamp.fromMillis(1_788_393_500_000);
  const inverse = createShiftPlanningInverseRecoveryOutcome(
    inverseAttempt(inverseTime),
    Timestamp.fromMillis(inverseTime.toMillis() + 1),
  );
  assert.equal(inverse.direction, "inverse");
  assert.equal(inverse.writeEpoch, 9);
  assert.notEqual(
    inverse.operationIntentDigest,
    inverseAttempt(inverseTime).materialization.operation
      .activationOperationIntentDigest,
  );
});

test("rejects an outcome clock that precedes its transaction attempt", () => {
  const attemptedAt = Timestamp.fromMillis(1_788_307_200_000);
  assert.throws(
    () => createShiftPlanningForwardActivationOutcome(
      forwardAttempt(attemptedAt),
      Timestamp.fromMillis(attemptedAt.toMillis() - 1),
    ),
    errorCode("invalid_planning_attempt_outcome"),
  );
});

test(
  "re-resolves every forward retry and retains only the committed attempt",
  {skip: !process.env.FIRESTORE_EMULATOR_HOST},
  async () => {
    const database = new Firestore({projectId, databaseId: "(default)"});
    const stateReference = database.doc("casRuntime/forward-state");
    await stateReference.set({revision: 1});
    const originalRequest = database.request;
    let rejectFirstTransactionCommit = true;
    database.request = async function(method, request, ...remaining) {
      if (
        method === "commit" &&
        request.transaction &&
        rejectFirstTransactionCommit
      ) {
        rejectFirstTransactionCommit = false;
        const error = new Error("forced CAS retry");
        error.code = 10;
        throw error;
      }
      return originalRequest.call(this, method, request, ...remaining);
    };
    const clockValues = [
      Timestamp.fromMillis(1_788_307_200_000),
      Timestamp.fromMillis(1_788_307_201_000),
      Timestamp.fromMillis(1_788_307_202_000),
    ];
    let resolverCalls = 0;
    let executorCalls = 0;
    const operationId = "request-activate-runtime-retry";
    const operationReference = database.doc(
      `${environment}/plus-collections/shiftPlanningOperations/${operationId}`,
    );
    const runtime = createFirestoreShiftPlanningCasRuntime(database, {
      clock: () => clockValues.shift(),
      measureForwardAttempt: async (input) => {
        executorCalls += 1;
        const operation = activationOperation({
          operationId,
          attemptedAt: input.attemptedAt,
        });
        input.transaction.update(stateReference, {
          revision: input.liveResult.revision + 1,
        });
        input.transaction.create(operationReference, operation);
        return {
          materialization: {
            operationPath: operationReference.path,
            operation,
            beforeImages: [],
            publicDocuments: [],
            mutations: [],
          },
          measurement: measurement({
            direction: "forward",
            manifestDigest: operation.forwardManifestDigest,
            attemptNumber: executorCalls,
          }),
        };
      },
    });

    const result = await runtime.executeForwardActivation({
      environment,
      operationId,
      workerId: "worker-runtime-forward",
      fencingEpoch: 1,
      leaseDurationMillis: 60_000,
      resolveAttempt: async ({transaction}) => {
        resolverCalls += 1;
        const snapshot = await transaction.get(stateReference);
        return {liveResult: {revision: snapshot.get("revision")}};
      },
    });

    assert.equal(resolverCalls, 2);
    assert.equal(executorCalls, 2);
    assert.equal(result.kind, "committed");
    assert.equal(result.outcomePersistenceKind, "committed");
    assert.equal(result.outcome.direction, "forward");
    assert.match(result.outcome.attemptId, /2$/);
    assert.equal((await stateReference.get()).get("revision"), 2);
    const outcomes = await operationReference.collection("attemptOutcomes").get();
    assert.equal(outcomes.size, 1);
    assert.equal(outcomes.docs[0].id, result.outcome.attemptId);
    const replay = await runtime.executeForwardActivation({
      environment,
      operationId,
      workerId: "worker-runtime-forward",
      fencingEpoch: 1,
      leaseDurationMillis: 60_000,
      resolveAttempt: async () => {
        throw new Error("terminal replay must not resolve another attempt");
      },
    });
    assert.equal(replay.kind, "terminalReplay");
    assert.equal(replay.attempt, null);
    assert.deepEqual(replay.outcome, result.outcome);
    assert.equal(resolverCalls, 2);
    await operationReference.set({corrupt: true});
    await assert.rejects(
      runtime.executeForwardActivation({
        environment,
        operationId,
        workerId: "worker-runtime-forward",
        fencingEpoch: 1,
        leaseDurationMillis: 60_000,
        resolveAttempt: async () => {
          throw new Error("corrupt replay must not resolve another attempt");
        },
      }),
      errorCode("invalid_planning_attempt_outcome"),
    );
    await database.terminate();
  },
);

test(
  "commits inverse recovery before retaining its bound outcome",
  {skip: !process.env.FIRESTORE_EMULATOR_HOST},
  async () => {
    const database = new Firestore({projectId, databaseId: "(default)"});
    const stateReference = database.doc("casRuntime/inverse-state");
    const operationId = "request-activate-runtime-inverse";
    const operationReference = database.doc(
      `${environment}/plus-collections/shiftPlanningOperations/${operationId}`,
    );
    const activation = activationOperation({
      operationId,
      attemptedAt: Timestamp.fromMillis(1_788_393_400_000),
    });
    await database.runTransaction(async (transaction) => {
      transaction.create(stateReference, {revision: 8});
      transaction.create(operationReference, activation);
    });
    const clockValues = [
      Timestamp.fromMillis(1_788_393_500_000),
      Timestamp.fromMillis(1_788_393_501_000),
    ];
    const runtime = createFirestoreShiftPlanningCasRuntime(database, {
      clock: () => clockValues.shift(),
      measureInverseAttempt: async (input) => {
        const operation = recoveryOperation({
          activation: input.activationOperationDocument.data,
          recoveryOperationId: input.recoveryOperationId,
          recoveredAt: input.recoveredAt,
        });
        input.transaction.update(stateReference, {revision: 9});
        input.transaction.set(operationReference, operation);
        return {
          materialization: {
            operationPath: operationReference.path,
            operation,
            recoveryWriteEpoch: operation.recoveryWriteEpoch,
            restoredDocuments: [],
            deletedPaths: operation.deletedPaths,
            mutations: [],
          },
          measurement: measurement({
            direction: "inverse",
            manifestDigest: operation.inverseManifestDigest,
            attemptNumber: 3,
          }),
        };
      },
    });

    const result = await runtime.executeInverseRecovery({
      environment,
      activationOperationId: operationId,
      recoveryOperationId: "recovery-runtime-inverse",
      resolveAttempt: async ({transaction}) => {
        const [state, operation] = await Promise.all([
          transaction.get(stateReference),
          transaction.get(operationReference),
        ]);
        return {
          bundle: {},
          activationOperationDocument: {
            targetPath: operation.ref.path,
            data: operation.data(),
            updateTime: operation.updateTime,
          },
          requestDocument: {},
          beforeImageDocuments: [],
          currentDocuments: [{revision: state.get("revision")}],
        };
      },
    });

    assert.equal(result.kind, "committed");
    assert.equal(result.outcomePersistenceKind, "committed");
    assert.equal(result.outcome.direction, "inverse");
    assert.equal(result.outcome.writeEpoch, 9);
    assert.equal((await stateReference.get()).get("revision"), 9);
    assert.equal(
      (await operationReference.get()).get("operationKind"),
      "activationRecovery",
    );
    const retained = await operationReference
      .collection("attemptOutcomes")
      .doc(result.outcome.attemptId)
      .get();
    assert.equal(retained.exists, true);
    const replay = await runtime.executeInverseRecovery({
      environment,
      activationOperationId: operationId,
      recoveryOperationId: "recovery-runtime-inverse",
      resolveAttempt: async () => {
        throw new Error("terminal replay must not resolve another recovery");
      },
    });
    assert.equal(replay.kind, "terminalReplay");
    assert.deepEqual(replay.outcome, result.outcome);
    await database.terminate();
  },
);

test(
  "fails closed when a committed activation has no retained outcome",
  {skip: !process.env.FIRESTORE_EMULATOR_HOST},
  async () => {
    const database = new Firestore({projectId, databaseId: "(default)"});
    const operationId = "request-activate-runtime-missing-outcome";
    const operationReference = database.doc(
      `${environment}/plus-collections/shiftPlanningOperations/${operationId}`,
    );
    await operationReference.create(activationOperation({
      operationId,
      attemptedAt: Timestamp.fromMillis(1_788_500_000_000),
    }));
    const runtime = createFirestoreShiftPlanningCasRuntime(database);

    await assert.rejects(
      runtime.executeForwardActivation({
        environment,
        operationId,
        workerId: "worker-must-not-run",
        fencingEpoch: 1,
        leaseDurationMillis: 60_000,
        resolveAttempt: async () => {
          throw new Error("missing outcome must block another CAS");
        },
      }),
      errorCode("invalid_planning_attempt_outcome"),
    );
    assert.equal(
      (await operationReference.collection("attemptOutcomes").get()).size,
      0,
    );
    await database.terminate();
  },
);
