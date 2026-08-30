"use strict";

const assert = require("node:assert/strict");
const {test} = require("node:test");
const {
  Firestore,
  Timestamp,
} = require("@google-cloud/firestore");

const {
  createShiftPlanningCommittedAttemptOutcome,
  parseShiftPlanningCommittedAttemptOutcome,
} = require("../lib/shift-planning-attempt-outcome.js");
const {
  createShiftPlanningDigest,
} = require("../lib/shift-planning-digest.js");
const {
  createFirestoreShiftPlanningAttemptOutcomePersistence,
} = require(
  "../lib/shift-planning-firestore-attempt-outcome-repository.js"
);
const {
  createShiftPlanningActivationOperationTerminal,
} = require("../lib/shift-planning-publication-contract.js");
const {
  parseShiftPlanningRecoveryOperationTerminal,
} = require("../lib/shift-planning-inverse-materializer.js");
const {
  SHIFT_PLANNING_FIRESTORE_COMMIT_ADAPTER_REVISION,
} = require(
  "../lib/shift-planning-firestore-transaction-serializer.js"
);

const digest = (value) => createShiftPlanningDigest(value);
const environment = "develop";
const operationId = "request-activate-2026";
const bundleDigest = digest({bundle: "2026"});
const forwardManifestDigest = digest({manifest: "forward"});
const activationOperation = createShiftPlanningActivationOperationTerminal({
  operationId,
  environment,
  requestId: "activate-2026",
  candidateId: "bundle-2026",
  bundleRevision: "bundle-revision-2026",
  bundleDigest,
  forwardManifestDigest,
  expectedStateDigest: digest({state: "before"}),
  writeEpoch: 8,
  attemptedAt: Timestamp.fromMillis(1_788_307_200_000),
  publicMutations: [{
    mutationKind: "create",
    targetPath: `${environment}/plus-collections/shifts/shift-delivery-1`,
    documentRevision: 1,
    payloadDigest: digest({shift: 1}),
  }],
  beforeImages: [],
});
const operationIntentDigest = activationOperation.operationIntentDigest;
const inverseManifestDigest = digest({manifest: "inverse"});
const recoveryRecordedAt = Timestamp.fromMillis(1_788_393_500_000);
const recoveryWithoutDigest = {
  schemaVersion: 1,
  operationKind: "activationRecovery",
  state: "committed",
  operationId,
  recoveryOperationId: "recovery-activate-2026",
  environment,
  requestId: "activate-2026",
  bundleRevision: "bundle-revision-2026",
  bundleDigest,
  forwardManifestDigest,
  inverseManifestDigest,
  activationOperationIntentDigest: operationIntentDigest,
  expectedStateDigest: digest({state: "before"}),
  activationWriteEpoch: 8,
  recoveryWriteEpoch: 9,
  recoveredAt: recoveryRecordedAt,
  restoreActiveLineage: {
    revision: "active-previous",
    digest: digest({active: "previous"}),
  },
  deletedPaths: [
    `${environment}/plus-collections/shifts/shift-delivery-1`,
  ],
  restoredBeforeImages: [
    "shiftPlanningState/current",
    "shiftRotations/delivery",
    "shiftRotations/market",
  ].map((target, index) => ({
    ordinal: index + 1,
    targetPath: `${environment}/plus-collections/${target}`,
    envelopePath: `${environment}/plus-collections/` +
      `shiftPlanningOperations/${operationId}/beforeImages/${index + 1}`,
    envelopeDigest: digest({beforeImage: index + 1}),
  })),
};
const recoveryOperation = {
  ...recoveryWithoutDigest,
  recoveryIntentDigest: digest({
    ...recoveryWithoutDigest,
    recoveredAt: {
      seconds: recoveryRecordedAt.seconds,
      nanoseconds: recoveryRecordedAt.nanoseconds,
    },
  }),
};

const measurement = (overrides = {}) => ({
  schemaVersion: 1,
  direction: "forward",
  manifestDigest: forwardManifestDigest,
  databaseName:
    "projects/demo-reguerta-hu082-attempt-outcome/databases/(default)",
  writeSetDigest:
    `shift-planning:firestore-write-set:v1:sha256:${"a".repeat(64)}`,
  commitRequestDigest:
    `shift-planning:firestore-commit-request:v1:sha256:${"b".repeat(64)}`,
  documentWriteCount: 41,
  fieldTransformCount: 0,
  maximumFieldTransformsPerDocument: 0,
  requestByteCount: 12_345,
  adapterRevision: SHIFT_PLANNING_FIRESTORE_COMMIT_ADAPTER_REVISION,
  indexConfigurationDigest: digest({indexes: "strict-v1"}),
  ...overrides,
});

const outcome = (overrides = {}) =>
  createShiftPlanningCommittedAttemptOutcome({
    environment,
    operationId,
    operationIntentDigest,
    bundleRevision: "bundle-revision-2026",
    bundleDigest,
    writeEpoch: 8,
    recordedAt: Timestamp.fromMillis(1_788_393_600_000),
    measurement: measurement(),
    ...overrides,
  });

const errorCode = (expectedCode) => (error) =>
  error instanceof Error && error.code === expectedCode;

test("builds an immutable non-circular committed outcome", () => {
  const value = outcome();

  assert.equal(value.state, "committed");
  assert.equal(value.acknowledgement, "transactionReturned");
  assert.equal(value.direction, "forward");
  assert.equal(
    value.attemptId,
    `forward-${"b".repeat(64)}`,
  );
  assert.equal(
    value.outcomePath,
    `${environment}/plus-collections/shiftPlanningOperations/` +
      `${operationId}/attemptOutcomes/${value.attemptId}`,
  );
  assert.equal(value.measurementDigest, digest(value.measurement));
  assert.deepEqual(parseShiftPlanningCommittedAttemptOutcome(value), value);
});

test("binds inverse direction and exact measurement authority", () => {
  const value = outcome({
    measurement: measurement({
      direction: "inverse",
      manifestDigest: digest({manifest: "inverse"}),
      commitRequestDigest:
        `shift-planning:firestore-commit-request:v1:sha256:` +
        `${"c".repeat(64)}`,
    }),
    writeEpoch: 9,
  });

  assert.equal(value.direction, "inverse");
  assert.equal(value.attemptId, `inverse-${"c".repeat(64)}`);
  assert.equal(value.writeEpoch, 9);
  assert.deepEqual(
    parseShiftPlanningRecoveryOperationTerminal(recoveryOperation),
    recoveryOperation,
  );
});

test("rejects forged keys, digests, counts, and timestamps", () => {
  const forgedPath = outcome();
  forgedPath.outcomePath += "-other";
  assert.throws(
    () => parseShiftPlanningCommittedAttemptOutcome(forgedPath),
    errorCode("invalid_planning_attempt_outcome"),
  );

  const forgedDigest = outcome();
  forgedDigest.outcomeDigest = digest({forged: true});
  assert.throws(
    () => parseShiftPlanningCommittedAttemptOutcome(forgedDigest),
    errorCode("invalid_planning_attempt_outcome"),
  );

  assert.throws(
    () => outcome({
      measurement: measurement({
        fieldTransformCount: 0,
        maximumFieldTransformsPerDocument: 1,
      }),
    }),
    errorCode("invalid_planning_attempt_outcome"),
  );
  assert.throws(
    () => outcome({recordedAt: new Date()}),
    errorCode("invalid_planning_attempt_outcome"),
  );

  const forgedRecovery = {
    ...recoveryOperation,
    recoveryWriteEpoch: 10,
  };
  assert.throws(
    () => parseShiftPlanningRecoveryOperationTerminal(forgedRecovery),
    errorCode("invalid_planning_inverse_materialization"),
  );
});

test(
  "persists once, replays exactly, and rejects key conflicts",
  {skip: !process.env.FIRESTORE_EMULATOR_HOST},
  async () => {
    const firestore = new Firestore({
      projectId: "demo-reguerta-hu082-attempt-outcome",
      databaseId: "(default)",
    });
    const persistence =
      createFirestoreShiftPlanningAttemptOutcomePersistence(firestore);
    const expected = outcome();
    await firestore
      .doc(`${environment}/plus-collections/shiftPlanningOperations/` +
        operationId)
      .create(activationOperation);

    const committed = await persistence.retainCommittedOutcomeAndReadBack(
      expected,
    );
    assert.equal(committed.kind, "committed");
    assert.deepEqual(committed.outcome, expected);

    const replayed = await persistence.retainCommittedOutcomeAndReadBack(
      expected,
    );
    assert.equal(replayed.kind, "replayed");
    assert.deepEqual(replayed.outcome, expected);

    const conflict = outcome({writeEpoch: 9});
    await assert.rejects(
      persistence.retainCommittedOutcomeAndReadBack(conflict),
      errorCode("invalid_planning_attempt_outcome"),
    );
    const retained = parseShiftPlanningCommittedAttemptOutcome(
      (await firestore.doc(expected.outcomePath).get()).data(),
    );
    assert.deepEqual(retained, expected);

    const unbound = outcome({
      operationIntentDigest: digest({operation: "forged"}),
      measurement: measurement({
        commitRequestDigest:
          `shift-planning:firestore-commit-request:v1:sha256:` +
          `${"d".repeat(64)}`,
      }),
    });
    await assert.rejects(
      persistence.retainCommittedOutcomeAndReadBack(unbound),
      errorCode("invalid_planning_attempt_outcome"),
    );
    assert.equal((await firestore.doc(unbound.outcomePath).get()).exists, false);

    await firestore.doc(
      `${environment}/plus-collections/shiftPlanningOperations/${operationId}`,
    ).set(recoveryOperation);
    const historicalReplay =
      await persistence.retainCommittedOutcomeAndReadBack(expected);
    assert.equal(historicalReplay.kind, "replayed");
    const inverse = outcome({
      operationIntentDigest: recoveryOperation.recoveryIntentDigest,
      writeEpoch: recoveryOperation.recoveryWriteEpoch,
      measurement: measurement({
        direction: "inverse",
        manifestDigest: inverseManifestDigest,
        commitRequestDigest:
          `shift-planning:firestore-commit-request:v1:sha256:` +
          `${"e".repeat(64)}`,
      }),
    });
    const inverseCommitted =
      await persistence.retainCommittedOutcomeAndReadBack(inverse);
    assert.equal(inverseCommitted.kind, "committed");
    assert.deepEqual(inverseCommitted.outcome, inverse);
    await firestore.terminate();
  },
);
