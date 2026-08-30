const assert = require("node:assert/strict");
const {after, before, beforeEach, test} = require("node:test");
const {deleteApp, initializeApp} = require("firebase-admin/app");
const {getFirestore, Timestamp} = require("firebase-admin/firestore");

const {
  createFirestoreShiftPlanningIntakeBarrierRepository,
} = require(
  "../lib/shift-planning-firestore-intake-barrier-repository.js"
);
const {
  createShiftPlanningDigest,
} = require("../lib/shift-planning-digest.js");
const {
  SHIFT_PLANNING_INTAKE_BARRIER_WRITERS,
  SHIFT_PLANNING_RULES_DENIED_WRITER_IDS,
  SHIFT_PLANNING_WRITER_INVENTORY_DIGEST,
  SHIFT_PLANNING_WRITER_INVENTORY_REVISION,
} = require("../lib/shift-planning-writer-inventory.js");

const PROJECT_ID = "demo-reguerta-hu082-intake-barrier";
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
if (!EMULATOR_HOST) {
  throw new Error(
    "FIRESTORE_EMULATOR_HOST is required; run this test through the " +
      "isolated Firestore emulator.",
  );
}

const ENVIRONMENT = "develop";
const TRANSITION_ID = "maintenance-entry-7";
const RETAINED_AT_MILLIS = 1_782_643_300_000;
const digest = (value) => createShiftPlanningDigest(value);
const activeDigest = digest({active: 4});
const authoritativeDigest = digest({authoritative: 7});
const rulesDigest = digest({rules: "hu082-barrier-r1"});
const workbookDigest = digest({workbook: "revision-19"});
const acceptedSetDigest = digest({acceptedEventIds: ["event-a", "event-b"]});

let app;
let firestore;
let nowMillis;
let repository;

const evidencePath = (
  transitionId = TRANSITION_ID,
  environment = ENVIRONMENT,
) => `${environment}/plus-collections/shiftPlanningOperations/` +
  `barrier-evidence-${transitionId}`;

const failurePath = (
  transitionId = TRANSITION_ID,
  environment = ENVIRONMENT,
) => `${environment}/plus-collections/shiftPlanningOperations/` +
  `barrier-failure-${transitionId}`;

const clearFirestore = async () => {
  const response = await fetch(
    `http://${EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/` +
      "databases/(default)/documents",
    {method: "DELETE"},
  );
  assert.equal(response.ok, true, await response.text());
};

before(async () => {
  app = initializeApp(
    {projectId: PROJECT_ID},
    "hu082-intake-barrier-repository-tests",
  );
  firestore = getFirestore(app);
});

after(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await clearFirestore();
  nowMillis = RETAINED_AT_MILLIS;
  repository = createFirestoreShiftPlanningIntakeBarrierRepository(
    firestore,
    () => Timestamp.fromMillis(nowMillis),
  );
});

const controlEvidence = (writer) => {
  const controlledByRules = writer.control === "rules-deny";
  return {
    writerId: writer.writerId,
    state: writer.requiredState,
    controlRevision: controlledByRules ?
      "rules-hu082-r1" : `${writer.writerId}-control-r1`,
    controlDigest: controlledByRules ?
      rulesDigest : digest({writerId: writer.writerId, revision: 1}),
    initialReadBackRevision: controlledByRules ?
      "rules-hu082-r1" : `${writer.writerId}-control-r1`,
    initialReadBackDigest: controlledByRules ?
      rulesDigest : digest({writerId: writer.writerId, revision: 1}),
    finalReadBackRevision: controlledByRules ?
      "rules-hu082-r1" : `${writer.writerId}-control-r1`,
    finalReadBackDigest: controlledByRules ?
      rulesDigest : digest({writerId: writer.writerId, revision: 1}),
    closedAtMillis: writer.shutdownOrder === "before-causal-capture" ?
      100 : 310,
    initialReadBackAtMillis:
      writer.shutdownOrder === "before-causal-capture" ? 150 : 315,
    finalReadBackAtMillis: 510,
    pendingWorkCount: 0,
    inFlightWorkCount: 0,
  };
};

const writerControls = () => SHIFT_PLANNING_INTAKE_BARRIER_WRITERS
  .map(controlEvidence)
  .sort((left, right) => left.writerId < right.writerId ? -1 : 1);

const evidencePayload = ({
  environment = ENVIRONMENT,
  transitionId = TRANSITION_ID,
  barrierRevision = "intake-barrier-7",
} = {}) => ({
  schemaVersion: 1,
  environment,
  barrierRevision,
  transition: {
    transitionId,
    expectedAuthoritativeDigest: authoritativeDigest,
    expectedStateRevision: 6,
    expectedWriteEpoch: 11,
    expectedActiveRevision: "active-4",
    expectedActiveDigest: activeDigest,
  },
  writerInventory: {
    revision: SHIFT_PLANNING_WRITER_INVENTORY_REVISION,
    digest: SHIFT_PLANNING_WRITER_INVENTORY_DIGEST,
  },
  policy: {
    minimumQuietHorizonMillis: 100,
    maximumEvidenceAgeMillis: 100,
  },
  rules: {
    deployedRevision: "rules-hu082-r1",
    deployedDigest: rulesDigest,
    initialReadBackRevision: "rules-hu082-r1",
    initialReadBackDigest: rulesDigest,
    finalReadBackRevision: "rules-hu082-r1",
    finalReadBackDigest: rulesDigest,
    deniedWriterIds: [...SHIFT_PLANNING_RULES_DENIED_WRITER_IDS],
    closedAtMillis: 100,
    initialReadBackAtMillis: 150,
    finalReadBackAtMillis: 510,
  },
  writerControls: writerControls(),
  causalDrain: {
    acceptedSetRevision: "causal-set-7",
    acceptedSetDigest,
    capturedAtMillis: 200,
    drainedAtMillis: 300,
    initialPendingWorkCount: 0,
    initialInFlightWorkCount: 0,
    initialPendingDeliveryCount: 0,
    initialInFlightDeliveryCount: 0,
    initialQueueReadBackAtMillis: 320,
    finalPendingWorkCount: 0,
    finalInFlightWorkCount: 0,
    finalPendingDeliveryCount: 0,
    finalInFlightDeliveryCount: 0,
    finalQueueReadBackAtMillis: 510,
  },
  workbook: {
    fileId: "workbook-develop-1",
    revision: "workbook-r19",
    digest: workbookDigest,
    readBackRevision: "workbook-r19",
    readBackDigest: workbookDigest,
    pendingOfflineEditorCount: 0,
    capturedAtMillis: 330,
    readBackAtMillis: 510,
  },
  quietHorizon: {
    startedAtMillis: 400,
    endedAtMillis: 500,
    firestoreMutationCount: 0,
    workbookMutationCount: 0,
    deliveryMutationCount: 0,
  },
  verifiedAtMillis: 520,
});

const evidenceEnvelope = (options) => {
  const payload = evidencePayload(options);
  return {payload, digest: digest(payload)};
};

const changedEnvelope = (packet = evidenceEnvelope()) => {
  const changed = structuredClone(packet);
  changed.payload.barrierRevision = "intake-barrier-collision";
  changed.digest = digest(changed.payload);
  return changed;
};

const retentionRequest = (
  evidence = evidenceEnvelope(),
  environment = ENVIRONMENT,
  transitionId = TRANSITION_ID,
) => ({environment, transitionId, evidence});

const persistedRecord = ({
  evidence = evidenceEnvelope(),
  environment = ENVIRONMENT,
  transitionId = TRANSITION_ID,
  retainedAt = Timestamp.fromMillis(RETAINED_AT_MILLIS),
} = {}) => ({
  schemaVersion: 1,
  operationKind: "intakeBarrierEvidence",
  environment,
  transitionId,
  evidence,
  evidenceDigest: evidence.digest,
  retainedAt,
});

const failureRequest = (overrides = {}) => ({
  environment: ENVIRONMENT,
  transitionId: TRANSITION_ID,
  scopeDigest: digest({scope: "maintenance-entry-7"}),
  holdRevision: "hold-hu082-r7",
  checkpointDigest: digest({checkpoint: "maintenance-entry-7"}),
  phase: "operation",
  ...overrides,
});

const failureRecord = ({
  request = failureRequest(),
  failedAtMillis = RETAINED_AT_MILLIS,
} = {}) => {
  const payload = {
    schemaVersion: 1,
    operationKind: "intakeBarrierFailureClosure",
    ...request,
    failedAtMillis,
  };
  return {...payload, failureDigest: digest(payload)};
};

const persistedFailureRecord = ({
  request = failureRequest(),
  failedAtMillis = RETAINED_AT_MILLIS,
} = {}) => {
  const domain = failureRecord({request, failedAtMillis});
  const {failedAtMillis: _, ...persisted} = domain;
  return {
    ...persisted,
    failedAt: Timestamp.fromMillis(failedAtMillis),
  };
};

const errorCode = (expectedCode) => (error) =>
  error instanceof Error && error.code === expectedCode;

test("readExisting returns null without creating missing evidence", async () => {
  assert.equal(await repository.readExisting({
    environment: ENVIRONMENT,
    transitionId: TRANSITION_ID,
  }), null);
  assert.equal(
    (await firestore.doc(evidencePath()).get()).exists,
    false,
  );
});

test("retainAndReadBack creates and returns one exact evidence envelope", async () => {
  const packet = evidenceEnvelope();

  assert.deepEqual(
    await repository.retainAndReadBack(retentionRequest(packet)),
    packet,
  );
  assert.deepEqual(await repository.readExisting({
    environment: ENVIRONMENT,
    transitionId: TRANSITION_ID,
  }), packet);

  const snapshot = await firestore.doc(evidencePath()).get();
  assert.equal(snapshot.exists, true);
  assert.deepEqual(snapshot.data(), persistedRecord({evidence: packet}));
});

test("an exact replay preserves the original envelope and retention instant", async () => {
  const packet = evidenceEnvelope();
  await repository.retainAndReadBack(retentionRequest(packet));
  const first = await firestore.doc(evidencePath()).get();
  const firstData = first.data();

  nowMillis += 60_000;
  assert.deepEqual(
    await repository.retainAndReadBack(retentionRequest(packet)),
    packet,
  );

  const replayed = await firestore.doc(evidencePath()).get();
  assert.deepEqual(replayed.data(), firstData);
  assert.equal(
    replayed.get("retainedAt").isEqual(
      Timestamp.fromMillis(RETAINED_AT_MILLIS),
    ),
    true,
  );
  assert.equal(replayed.updateTime.isEqual(first.updateTime), true);
});

test("concurrent exact retains converge on one immutable document", async () => {
  const packet = evidenceEnvelope();

  const results = await Promise.all([
    repository.retainAndReadBack(retentionRequest(packet)),
    repository.retainAndReadBack(retentionRequest(structuredClone(packet))),
  ]);

  assert.deepEqual(results, [packet, packet]);
  const operations = await firestore.collection(
    `${ENVIRONMENT}/plus-collections/shiftPlanningOperations`,
  ).get();
  assert.deepEqual(operations.docs.map((document) => document.id), [
    `barrier-evidence-${TRANSITION_ID}`,
  ]);
  assert.deepEqual(
    (await firestore.doc(evidencePath()).get()).data(),
    persistedRecord({evidence: packet}),
  );
});

test("concurrent different digests commit one winner and reject the collision", async () => {
  const firstPacket = evidenceEnvelope();
  const secondPacket = changedEnvelope(firstPacket);

  const settled = await Promise.allSettled([
    repository.retainAndReadBack(retentionRequest(firstPacket)),
    repository.retainAndReadBack(retentionRequest(secondPacket)),
  ]);
  const fulfilled = settled.filter((result) => result.status === "fulfilled");
  const rejected = settled.filter((result) => result.status === "rejected");

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(errorCode("request_intent_conflict")(rejected[0].reason), true);
  const winner = fulfilled[0].value;
  assert.deepEqual(
    await repository.readExisting({
      environment: ENVIRONMENT,
      transitionId: TRANSITION_ID,
    }),
    winner,
  );
  assert.deepEqual(
    (await firestore.doc(evidencePath()).get()).data(),
    persistedRecord({evidence: winner}),
  );
});

test("corrupt or tampered retained evidence fails closed without repair", async () => {
  const tamperedPayload = evidenceEnvelope();
  tamperedPayload.payload.barrierRevision = "tampered-without-rehash";
  const fixtures = [
    {
      name: "payload digest mismatch",
      record: persistedRecord({evidence: tamperedPayload}),
    },
    {
      name: "wrapper digest mismatch",
      record: {
        ...persistedRecord(),
        evidenceDigest: digest({different: true}),
      },
    },
    {
      name: "stable-key metadata mismatch",
      record: persistedRecord({transitionId: "maintenance-entry-other"}),
    },
    {
      name: "retention instant predates evidence verification",
      record: persistedRecord({retainedAt: Timestamp.fromMillis(519)}),
    },
    {
      name: "retention instant has hidden submillisecond precision",
      record: persistedRecord({
        retainedAt: new Timestamp(
          Math.floor(RETAINED_AT_MILLIS / 1_000),
          1_000,
        ),
      }),
    },
    {
      name: "unexpected persisted field",
      record: {...persistedRecord(), overwriteAllowed: true},
    },
  ];

  for (const fixture of fixtures) {
    await clearFirestore();
    const reference = firestore.doc(evidencePath());
    await reference.set(fixture.record);
    const before = (await reference.get()).data();

    await assert.rejects(
      repository.readExisting({
        environment: ENVIRONMENT,
        transitionId: TRANSITION_ID,
      }),
      errorCode("invalid_planning_state"),
      fixture.name,
    );
    await assert.rejects(
      repository.retainAndReadBack(retentionRequest()),
      errorCode("invalid_planning_state"),
      fixture.name,
    );
    assert.deepEqual((await reference.get()).data(), before, fixture.name);
  }
});

test("the same transition ID is isolated by environment", async () => {
  const developPacket = evidenceEnvelope();
  const productionPacket = evidenceEnvelope({
    environment: "production",
    barrierRevision: "intake-barrier-production-7",
  });

  await Promise.all([
    repository.retainAndReadBack(retentionRequest(developPacket)),
    repository.retainAndReadBack(retentionRequest(
      productionPacket,
      "production",
    )),
  ]);

  assert.deepEqual(await repository.readExisting({
    environment: ENVIRONMENT,
    transitionId: TRANSITION_ID,
  }), developPacket);
  assert.deepEqual(await repository.readExisting({
    environment: "production",
    transitionId: TRANSITION_ID,
  }), productionPacket);
  assert.equal((await firestore.doc(evidencePath()).get()).exists, true);
  assert.equal(
    (await firestore.doc(evidencePath(TRANSITION_ID, "production")).get())
      .exists,
    true,
  );
});

test("a key cannot retain evidence bound to another environment or transition", async () => {
  const mismatches = [
    evidenceEnvelope({environment: "production"}),
    evidenceEnvelope({transitionId: "maintenance-entry-other"}),
  ];

  for (const packet of mismatches) {
    await assert.rejects(
      repository.retainAndReadBack(retentionRequest(packet)),
      errorCode("invalid_planning_state"),
    );
  }
  assert.equal((await firestore.doc(evidencePath()).get()).exists, false);
});

test("readExistingFailure returns null without creating an incident", async () => {
  assert.equal(await repository.readExistingFailure({
    environment: ENVIRONMENT,
    transitionId: TRANSITION_ID,
  }), null);
  assert.equal((await firestore.doc(failurePath()).get()).exists, false);
});

test("retainFailureAndReadBack creates one exact durable incident", async () => {
  const request = failureRequest();
  const expected = failureRecord({request});

  assert.deepEqual(
    await repository.retainFailureAndReadBack(request),
    expected,
  );
  assert.deepEqual(await repository.readExistingFailure({
    environment: ENVIRONMENT,
    transitionId: TRANSITION_ID,
  }), expected);

  const snapshot = await firestore.doc(failurePath()).get();
  assert.equal(snapshot.exists, true);
  assert.deepEqual(snapshot.data(), persistedFailureRecord({request}));
  assert.equal(snapshot.get("failedAt") instanceof Timestamp, true);
  assert.equal(snapshot.get("failedAtMillis"), undefined);
  assert.equal(snapshot.get("failureDigest"), expected.failureDigest);
});

test("an exact failure replay preserves its timestamp and update time", async () => {
  const request = failureRequest();
  const expected = failureRecord({request});
  await repository.retainFailureAndReadBack(request);
  const first = await firestore.doc(failurePath()).get();
  const firstData = first.data();

  nowMillis += 60_000;
  assert.deepEqual(
    await repository.retainFailureAndReadBack(structuredClone(request)),
    expected,
  );

  const replayed = await firestore.doc(failurePath()).get();
  assert.deepEqual(replayed.data(), firstData);
  assert.equal(
    replayed.get("failedAt").isEqual(
      Timestamp.fromMillis(RETAINED_AT_MILLIS),
    ),
    true,
  );
  assert.equal(replayed.updateTime.isEqual(first.updateTime), true);
});

test("concurrent exact failure retains converge on one immutable incident",
  async () => {
    const request = failureRequest();
    const expected = failureRecord({request});

    const results = await Promise.all([
      repository.retainFailureAndReadBack(request),
      repository.retainFailureAndReadBack(structuredClone(request)),
    ]);

    assert.deepEqual(results, [expected, expected]);
    const operations = await firestore.collection(
      `${ENVIRONMENT}/plus-collections/shiftPlanningOperations`,
    ).get();
    assert.deepEqual(operations.docs.map((document) => document.id), [
      `barrier-failure-${TRANSITION_ID}`,
    ]);
    assert.deepEqual(
      (await firestore.doc(failurePath()).get()).data(),
      persistedFailureRecord({request}),
    );
  });

test("concurrent different failure intents retain one immutable winner", async () => {
  const operationFailure = failureRequest();
  const finalReadBackFailure = failureRequest({phase: "finalReadBack"});

  const settled = await Promise.allSettled([
    repository.retainFailureAndReadBack(operationFailure),
    repository.retainFailureAndReadBack(finalReadBackFailure),
  ]);
  const fulfilled = settled.filter((result) => result.status === "fulfilled");
  const rejected = settled.filter((result) => result.status === "rejected");

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(errorCode("request_intent_conflict")(rejected[0].reason), true);
  const winner = fulfilled[0].value;
  assert.deepEqual(await repository.readExistingFailure({
    environment: ENVIRONMENT,
    transitionId: TRANSITION_ID,
  }), winner);
  assert.deepEqual(
    (await firestore.doc(failurePath()).get()).data(),
    persistedFailureRecord({
      request: {
        environment: winner.environment,
        transitionId: winner.transitionId,
        scopeDigest: winner.scopeDigest,
        holdRevision: winner.holdRevision,
        checkpointDigest: winner.checkpointDigest,
        phase: winner.phase,
      },
      failedAtMillis: winner.failedAtMillis,
    }),
  );
});

test("corrupt failure incidents fail closed without repair", async () => {
  const base = persistedFailureRecord();
  const fixtures = [
    {
      name: "failure digest mismatch",
      record: {...base, failureDigest: digest({tampered: true})},
    },
    {
      name: "failure instant is not a Timestamp",
      record: {...base, failedAt: RETAINED_AT_MILLIS},
    },
    {
      name: "failure instant has hidden submillisecond precision",
      record: {
        ...base,
        failedAt: new Timestamp(
          Math.floor(RETAINED_AT_MILLIS / 1_000),
          1_000,
        ),
      },
    },
    {
      name: "stable-key metadata mismatch",
      record: {...base, transitionId: "maintenance-entry-other"},
    },
    {
      name: "unexpected persisted field",
      record: {...base, overwriteAllowed: true},
    },
  ];

  for (const fixture of fixtures) {
    await clearFirestore();
    const reference = firestore.doc(failurePath());
    await reference.set(fixture.record);
    const before = (await reference.get()).data();

    await assert.rejects(
      repository.readExistingFailure({
        environment: ENVIRONMENT,
        transitionId: TRANSITION_ID,
      }),
      errorCode("invalid_planning_state"),
      fixture.name,
    );
    await assert.rejects(
      repository.retainFailureAndReadBack(failureRequest()),
      errorCode("invalid_planning_state"),
      fixture.name,
    );
    assert.deepEqual((await reference.get()).data(), before, fixture.name);
  }
});

test("failure closure coexists with the retained barrier envelope", async () => {
  const packet = evidenceEnvelope();
  const incident = failureRequest();

  const [retainedEvidence, retainedFailure] = await Promise.all([
    repository.retainAndReadBack(retentionRequest(packet)),
    repository.retainFailureAndReadBack(incident),
  ]);

  assert.deepEqual(retainedEvidence, packet);
  assert.deepEqual(retainedFailure, failureRecord({request: incident}));
  const operations = await firestore.collection(
    `${ENVIRONMENT}/plus-collections/shiftPlanningOperations`,
  ).get();
  assert.deepEqual(
    operations.docs.map((document) => document.id).sort(),
    [
      `barrier-evidence-${TRANSITION_ID}`,
      `barrier-failure-${TRANSITION_ID}`,
    ],
  );
  assert.deepEqual(await repository.readExisting({
    environment: ENVIRONMENT,
    transitionId: TRANSITION_ID,
  }), packet);
  assert.deepEqual(await repository.readExistingFailure({
    environment: ENVIRONMENT,
    transitionId: TRANSITION_ID,
  }), failureRecord({request: incident}));
});

test("evidence and failure namespaces cannot collide through transition IDs",
  async () => {
    const failureTransitionId = "collision-7";
    const evidenceTransitionId = `failure-${failureTransitionId}`;
    const packet = evidenceEnvelope({
      transitionId: evidenceTransitionId,
      barrierRevision: "intake-barrier-namespace-collision",
    });
    const incident = failureRequest({
      transitionId: failureTransitionId,
      scopeDigest: digest({scope: failureTransitionId}),
      checkpointDigest: digest({checkpoint: failureTransitionId}),
    });

    await Promise.all([
      repository.retainAndReadBack(retentionRequest(
        packet,
        ENVIRONMENT,
        evidenceTransitionId,
      )),
      repository.retainFailureAndReadBack(incident),
    ]);

    const evidenceReference = firestore.doc(evidencePath(
      evidenceTransitionId,
    ));
    const failureReference = firestore.doc(failurePath(failureTransitionId));
    assert.notEqual(evidenceReference.path, failureReference.path);
    assert.equal((await evidenceReference.get()).exists, true);
    assert.equal((await failureReference.get()).exists, true);
    assert.deepEqual(await repository.readExisting({
      environment: ENVIRONMENT,
      transitionId: evidenceTransitionId,
    }), packet);
    assert.deepEqual(await repository.readExistingFailure({
      environment: ENVIRONMENT,
      transitionId: failureTransitionId,
    }), failureRecord({request: incident}));
  });
