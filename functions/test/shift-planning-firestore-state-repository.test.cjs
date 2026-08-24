const assert = require("node:assert/strict");
const {after, before, beforeEach, test} = require("node:test");
const {deleteApp, initializeApp} = require("firebase-admin/app");
const {getFirestore, Timestamp} = require("firebase-admin/firestore");
const {
  createFirestoreShiftPlanningStateRepository,
} = require("../lib/shift-planning-firestore-state-repository.js");
const {
  createShiftPlanningDigest,
} = require("../lib/shift-planning-digest.js");
const {
  SHIFT_PLANNING_STATE_PERSISTENCE_SCHEMA_VERSION,
  buildShiftPlanningAuthoritativeState,
  parseShiftPlanningAuthoritativeState,
} = require("../lib/shift-planning-state-persistence.js");

const PROJECT_ID = "demo-reguerta-hu082-state";
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
if (!EMULATOR_HOST) {
  throw new Error(
    "FIRESTORE_EMULATOR_HOST is required; run this test through the " +
      "isolated Firestore emulator.",
  );
}

const ENVIRONMENT = "develop";
const ROOT = `${ENVIRONMENT}/plus-collections`;
const ATTEMPTED_AT_MILLIS = 1_782_643_201_000;
const ACTIVE_DIGEST = `shift-planning:v1:sha256:${"a".repeat(64)}`;
const BASELINE_DIGEST = `shift-planning:v1:sha256:${"b".repeat(64)}`;
const BARRIER_DIGEST = `shift-planning:v1:sha256:${"c".repeat(64)}`;

let app;
let firestore;
let nowMillis;
let repository;

const statePath = (environment = ENVIRONMENT) =>
  `${environment}/plus-collections/shiftPlanningState/current`;

const rotationPath = (type, environment = ENVIRONMENT) =>
  `${environment}/plus-collections/shiftRotations/${type}`;

const operationPath = (transitionId, environment = ENVIRONMENT) =>
  `${environment}/plus-collections/shiftPlanningOperations/` +
    `state-${transitionId}`;

const clearFirestore = async () => {
  const response = await fetch(
    `http://${EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/` +
      "databases/(default)/documents",
    {method: "DELETE"},
  );
  assert.equal(response.ok, true, await response.text());
};

before(async () => {
  app = initializeApp({projectId: PROJECT_ID}, "hu082-state-tests");
  firestore = getFirestore(app);
});

after(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await clearFirestore();
  nowMillis = ATTEMPTED_AT_MILLIS;
  repository = createFirestoreShiftPlanningStateRepository(
    firestore,
    () => Timestamp.fromMillis(nowMillis),
  );
});

const barrier = (overrides = {}) => ({
  revision: "rules-barrier-10",
  digest: BARRIER_DIGEST,
  verifiedAtMillis: 1_782_643_200_000,
  ...overrides,
});

const openMaintenance = (overrides = {}) => ({
  schemaVersion: 1,
  stateRevision: 11,
  writeEpoch: 9,
  maintenanceStatus: "open",
  activeRevision: "active-8",
  activeDigest: ACTIVE_DIGEST,
  intakeBarrier: null,
  lastTransitionId: "activate-8",
  ...overrides,
});

const closedMaintenance = (overrides = {}) => ({
  ...openMaintenance(),
  stateRevision: 12,
  writeEpoch: 10,
  maintenanceStatus: "closed",
  intakeBarrier: barrier(),
  lastTransitionId: "enter-001",
  ...overrides,
});

const rotation = (type, overrides = {}) => {
  const cohortUserIds = type === "delivery" ?
    ["member-1", "member-2", "member-3", "member-4"] :
    ["member-3", "member-2", "member-1"];
  return {
    schemaVersion: 1,
    type,
    stateRevision: type === "delivery" ? 4 : 7,
    cursor: {
      schemaVersion: 1,
      type,
      cohortUserIds,
      roundNumber: 3,
      nextMemberIndex: 1,
    },
    planningFrontierSeasonStartYear: 2026,
    cohortFrozen: true,
    frozenCohortUserIds: [...cohortUserIds],
    activeRevision: "active-8",
    activeDigest: ACTIVE_DIGEST,
    lastIdempotencyKey: "activate-8",
    migrationBaseline: {
      revision: "baseline-1",
      digest: BASELINE_DIGEST,
    },
    releaseLease: null,
    ...overrides,
  };
};

const seedAuthoritativeState = async ({
  environment = ENVIRONMENT,
  maintenance = openMaintenance(),
  delivery = rotation("delivery"),
  market = rotation("market"),
} = {}) => {
  await Promise.all([
    firestore.doc(statePath(environment)).set(maintenance),
    firestore.doc(rotationPath("delivery", environment)).set(delivery),
    firestore.doc(rotationPath("market", environment)).set(market),
  ]);
};

const protectedCanaryPaths = [
  `${ROOT}/shifts/shift-canary`,
  `${ROOT}/deliveryCalendar/week-canary`,
  `${ROOT}/shiftPlanningRequests/request-canary`,
  `${ROOT}/shiftPlanningCandidates/candidate-canary`,
  `${ROOT}/shiftRotationMappings/mapping-canary`,
  `${ROOT}/shiftPlanningBundles/bundle-canary`,
  `${ROOT}/shiftPlanningSyncCommands/sync-canary`,
  `${ROOT}/shiftPlanningNotificationIntents/intent-canary`,
  `${ROOT}/shiftPlanningOperations/request-canary`,
  `${ROOT}/notificationEvents/event-canary`,
];

const seedProtectedCanaries = async () => {
  await Promise.all(protectedCanaryPaths.map((path, index) =>
    firestore.doc(path).set({canary: true, revision: index + 1})));
};

const planningDocuments = async () => {
  const documents = [];
  const visitCollection = async (collection) => {
    const snapshot = await collection.get();
    for (const document of snapshot.docs) {
      documents.push([document.ref.path, document.data()]);
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
  return documents.sort(([left], [right]) => left.localeCompare(right));
};

const protectedPlanningDocuments = async () =>
  (await planningDocuments()).filter(([path]) =>
    path !== statePath() &&
    !path.startsWith(`${ROOT}/shiftPlanningOperations/state-`));

const errorCode = (expectedCode) => (error) =>
  error instanceof Error && error.code === expectedCode;

const enterCommand = (current, transitionId = "enter-001", overrides = {}) => ({
  action: "enterMaintenance",
  environment: current.environment,
  transitionId,
  expectedAuthoritativeDigest: current.authoritativeDigest,
  expectedStateRevision: current.maintenance.stateRevision,
  expectedWriteEpoch: current.maintenance.writeEpoch,
  expectedActiveRevision: current.maintenance.activeRevision,
  expectedActiveDigest: current.maintenance.activeDigest,
  intakeBarrier: barrier(),
  intakeBarrierExpiresAtMillis: ATTEMPTED_AT_MILLIS + 60_000,
  ...overrides,
});

const abortCommand = (current, transitionId = "abort-001", overrides = {}) => ({
  action: "abortPreActivationMaintenance",
  environment: current.environment,
  transitionId,
  expectedAuthoritativeDigest: current.authoritativeDigest,
  expectedStateRevision: current.maintenance.stateRevision,
  expectedWriteEpoch: current.maintenance.writeEpoch,
  expectedActiveRevision: current.maintenance.activeRevision,
  expectedActiveDigest: current.maintenance.activeDigest,
  expectedMaintenanceEntryTransitionId:
    current.maintenance.lastTransitionId,
  ...overrides,
});

const seedEnteredMaintenance = async (
  transitionId = "enter-001",
) => {
  await seedAuthoritativeState();
  const open = await repository.loadAuthoritativeState({
    environment: ENVIRONMENT,
  });
  await repository.enterMaintenanceWithBarrierEvidence(
    enterCommand(open, transitionId),
  );
};

const expectedTransition = ({intent, before, maintenanceAfter}) => {
  const afterDigest = createShiftPlanningDigest({
    environment: before.environment,
    maintenance: maintenanceAfter,
    rotations: before.rotations,
  });
  return {
    schemaVersion: SHIFT_PLANNING_STATE_PERSISTENCE_SCHEMA_VERSION,
    operationKind: "maintenanceTransition",
    transitionId: intent.transitionId,
    environment: intent.environment,
    action: intent.action,
    intent,
    intentDigest: createShiftPlanningDigest(intent),
    rotations: before.rotations,
    maintenanceBefore: before.maintenance,
    maintenanceAfter,
    authoritativeDigestBefore: before.authoritativeDigest,
    authoritativeDigestAfter: afterDigest,
    attemptedAtMillis: ATTEMPTED_AT_MILLIS,
  };
};

test("loads one exact authoritative state and digest without writes", async () => {
  await seedAuthoritativeState();
  await seedProtectedCanaries();
  const beforeDocuments = await planningDocuments();
  const maintenance = openMaintenance();
  const rotations = {
    delivery: rotation("delivery"),
    market: rotation("market"),
  };

  const loaded = await repository.loadAuthoritativeState({
    environment: ENVIRONMENT,
  });

  assert.deepEqual(loaded, {
    environment: ENVIRONMENT,
    maintenance,
    rotations,
    authoritativeDigest: createShiftPlanningDigest({
      environment: ENVIRONMENT,
      maintenance,
      rotations,
    }),
  });
  assert.deepEqual(await planningDocuments(), beforeDocuments);
});

test("normalizes and parses only an exact authoritative state envelope", () => {
  const state = buildShiftPlanningAuthoritativeState({
    environment: ENVIRONMENT,
    maintenance: openMaintenance(),
    rotations: {
      delivery: rotation("delivery"),
      market: rotation("market"),
    },
  });

  assert.deepEqual(parseShiftPlanningAuthoritativeState(state), state);
  for (const fixture of [
    {
      name: "forged digest",
      value: {
        ...state,
        authoritativeDigest:
          `shift-planning:v1:sha256:${"9".repeat(64)}`,
      },
    },
    {
      name: "extra top-level field",
      value: {...state, unexpected: true},
    },
    {
      name: "cross-lineage rotation",
      value: {
        ...state,
        rotations: {
          ...state.rotations,
          market: rotation("market", {
            activeRevision: "active-other",
            activeDigest:
              `shift-planning:v1:sha256:${"d".repeat(64)}`,
          }),
        },
      },
    },
  ]) {
    assert.throws(
      () => parseShiftPlanningAuthoritativeState(fixture.value),
      errorCode("invalid_planning_state"),
      fixture.name,
    );
  }
});

test("missing, corrupt and cross-lineage state fail closed", async () => {
  const cases = [
    {
      name: "missing",
      arrange: async () => {},
    },
    {
      name: "corrupt",
      arrange: async () => {
        await seedAuthoritativeState({
          delivery: {...rotation("delivery"), unexpected: true},
        });
      },
    },
    {
      name: "cross-lineage",
      arrange: async () => {
        await seedAuthoritativeState({
          market: rotation("market", {
            activeRevision: "active-other",
            activeDigest: `shift-planning:v1:sha256:${"d".repeat(64)}`,
          }),
        });
      },
    },
  ];

  for (const fixture of cases) {
    await clearFirestore();
    await fixture.arrange();
    const beforeDocuments = await planningDocuments();
    await assert.rejects(
      repository.loadAuthoritativeState({environment: ENVIRONMENT}),
      errorCode("invalid_planning_state"),
      fixture.name,
    );
    assert.deepEqual(
      await planningDocuments(),
      beforeDocuments,
      fixture.name,
    );
  }
});

test("enter maintenance commits once and replays the exact transition", async () => {
  await seedAuthoritativeState();
  await seedProtectedCanaries();
  const protectedBefore = await protectedPlanningDocuments();
  const before = await repository.loadAuthoritativeState({
    environment: ENVIRONMENT,
  });
  const intent = enterCommand(before);
  const maintenanceAfter = {
    ...before.maintenance,
    stateRevision: 12,
    writeEpoch: 10,
    maintenanceStatus: "closed",
    intakeBarrier: intent.intakeBarrier,
    lastTransitionId: intent.transitionId,
  };
  const expected = expectedTransition({intent, before, maintenanceAfter});
  assert.equal(await repository.loadMaintenanceTransition({
    environment: ENVIRONMENT,
    transitionId: intent.transitionId,
  }), null);

  const committed = await repository.enterMaintenanceWithBarrierEvidence(
    intent,
  );
  assert.deepEqual(committed, {kind: "committed", transition: expected});
  assert.deepEqual(await repository.loadMaintenanceTransition({
    environment: ENVIRONMENT,
    transitionId: intent.transitionId,
  }), expected);
  assert.deepEqual(
    (await firestore.doc(statePath()).get()).data(),
    maintenanceAfter,
  );
  assert.equal((await firestore.doc(operationPath("enter-001")).get()).exists, true);

  nowMillis += 60_000;
  const replayed = await repository.enterMaintenanceWithBarrierEvidence(intent);
  assert.deepEqual(replayed, {kind: "replayed", transition: expected});
  assert.deepEqual(await protectedPlanningDocuments(), protectedBefore);
  assert.deepEqual(
    (await firestore.doc(statePath()).get()).data(),
    maintenanceAfter,
  );
});

test("enter maintenance rejects a transition-id collision without mutation", async () => {
  await seedAuthoritativeState();
  await seedProtectedCanaries();
  const before = await repository.loadAuthoritativeState({
    environment: ENVIRONMENT,
  });
  const intent = enterCommand(before);
  await repository.enterMaintenanceWithBarrierEvidence(intent);
  const persistedAfterCommit = await planningDocuments();

  await assert.rejects(
    repository.enterMaintenanceWithBarrierEvidence({
      ...intent,
      intakeBarrier: barrier({revision: "rules-barrier-collision"}),
    }),
    errorCode("request_intent_conflict"),
  );
  assert.deepEqual(await planningDocuments(), persistedAfterCommit);
});

test("enter rejects barrier evidence verified after its attempt instant", async () => {
  await seedAuthoritativeState();
  const current = await repository.loadAuthoritativeState({
    environment: ENVIRONMENT,
  });
  const beforeDocuments = await planningDocuments();

  await assert.rejects(
    repository.enterMaintenanceWithBarrierEvidence(enterCommand(
      current,
      "enter-future-barrier",
      {intakeBarrier: barrier({verifiedAtMillis: ATTEMPTED_AT_MILLIS + 1})},
    )),
    errorCode("maintenance_state_conflict"),
  );
  assert.deepEqual(await planningDocuments(), beforeDocuments);
});

test("enter rejects barrier evidence expired before its attempt", async () => {
  await seedAuthoritativeState();
  const current = await repository.loadAuthoritativeState({
    environment: ENVIRONMENT,
  });
  const beforeDocuments = await planningDocuments();

  await assert.rejects(
    repository.enterMaintenanceWithBarrierEvidence(enterCommand(
      current,
      "enter-expired-barrier",
      {intakeBarrierExpiresAtMillis: ATTEMPTED_AT_MILLIS - 1},
    )),
    errorCode("maintenance_state_conflict"),
  );
  assert.deepEqual(await planningDocuments(), beforeDocuments);
});

test("terminal replay rejects tampered authoritative digest evidence", async () => {
  await seedAuthoritativeState();
  const current = await repository.loadAuthoritativeState({
    environment: ENVIRONMENT,
  });
  const intent = enterCommand(current, "enter-tampered-record");
  await repository.enterMaintenanceWithBarrierEvidence(intent);
  await firestore.doc(operationPath(intent.transitionId)).update({
    authoritativeDigestAfter:
      `shift-planning:v1:sha256:${"9".repeat(64)}`,
  });
  const beforeReplay = await planningDocuments();

  await assert.rejects(
    repository.enterMaintenanceWithBarrierEvidence(intent),
    errorCode("invalid_planning_state"),
  );
  assert.deepEqual(await planningDocuments(), beforeReplay);
});

test("enter maintenance rejects every stale CAS without mutation", async () => {
  const staleCases = [
    {
      name: "write epoch",
      code: "stale_write_epoch",
      override: {expectedWriteEpoch: 8},
    },
    {
      name: "active lineage",
      code: "stale_active_revision",
      override: {
        expectedActiveRevision: "active-other",
        expectedActiveDigest:
          `shift-planning:v1:sha256:${"e".repeat(64)}`,
      },
    },
    {
      name: "state revision",
      code: "maintenance_state_conflict",
      override: {expectedStateRevision: 10},
    },
    {
      name: "authoritative digest",
      code: "maintenance_state_conflict",
      override: {
        expectedAuthoritativeDigest:
          `shift-planning:v1:sha256:${"f".repeat(64)}`,
      },
    },
  ];

  for (const fixture of staleCases) {
    await clearFirestore();
    await seedAuthoritativeState();
    await seedProtectedCanaries();
    const current = await repository.loadAuthoritativeState({
      environment: ENVIRONMENT,
    });
    const beforeDocuments = await planningDocuments();
    await assert.rejects(
      repository.enterMaintenanceWithBarrierEvidence(
        enterCommand(current, `enter-stale-${fixture.name.replace(" ", "-")}`, {
          ...fixture.override,
        }),
      ),
      errorCode(fixture.code),
      fixture.name,
    );
    assert.deepEqual(
      await planningDocuments(),
      beforeDocuments,
      fixture.name,
    );
  }
});

test("a rotation drift invalidates the captured authoritative read-set", async () => {
  await seedAuthoritativeState();
  await seedProtectedCanaries();
  const captured = await repository.loadAuthoritativeState({
    environment: ENVIRONMENT,
  });
  const delivery = rotation("delivery", {stateRevision: 5});
  await firestore.doc(rotationPath("delivery")).set(delivery);
  const beforeDocuments = await planningDocuments();

  await assert.rejects(
    repository.enterMaintenanceWithBarrierEvidence(
      enterCommand(captured, "enter-after-rotation-drift"),
    ),
    errorCode("maintenance_state_conflict"),
  );
  assert.deepEqual(await planningDocuments(), beforeDocuments);
});

test("maintenance revisions never overflow or reuse an unsafe value", async () => {
  for (const field of ["stateRevision", "writeEpoch"]) {
    await clearFirestore();
    await seedAuthoritativeState({
      maintenance: openMaintenance({[field]: Number.MAX_SAFE_INTEGER}),
    });
    const current = await repository.loadAuthoritativeState({
      environment: ENVIRONMENT,
    });
    const beforeDocuments = await planningDocuments();

    await assert.rejects(
      repository.enterMaintenanceWithBarrierEvidence(
        enterCommand(current, `enter-overflow-${field}`),
      ),
      errorCode("maintenance_state_conflict"),
      field,
    );
    assert.deepEqual(await planningDocuments(), beforeDocuments, field);
  }
});

test("concurrent maintenance entry commits one epoch and fences the loser", async () => {
  await seedAuthoritativeState();
  await seedProtectedCanaries();
  const protectedBefore = await protectedPlanningDocuments();
  const current = await repository.loadAuthoritativeState({
    environment: ENVIRONMENT,
  });
  const commands = [
    enterCommand(current, "enter-concurrent-a"),
    enterCommand(current, "enter-concurrent-b"),
  ];

  const outcomes = await Promise.allSettled(commands.map((command) =>
    repository.enterMaintenanceWithBarrierEvidence(command)));
  const fulfilled = outcomes.filter(({status}) => status === "fulfilled");
  const rejected = outcomes.filter(({status}) => status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(fulfilled[0].value.kind, "committed");
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.code, "stale_write_epoch");

  const finalState = await repository.loadAuthoritativeState({
    environment: ENVIRONMENT,
  });
  assert.equal(finalState.maintenance.stateRevision, 12);
  assert.equal(finalState.maintenance.writeEpoch, 10);
  assert.equal(finalState.maintenance.maintenanceStatus, "closed");
  assert.ok(commands.some(({transitionId}) =>
    transitionId === finalState.maintenance.lastTransitionId));
  const operations = await firestore.collection(
    `${ROOT}/shiftPlanningOperations`,
  ).get();
  assert.equal(
    operations.docs.filter(({id}) => id.startsWith("state-")).length,
    1,
  );
  assert.deepEqual(await protectedPlanningDocuments(), protectedBefore);
});

test("abort commits once, reopens with a higher epoch and replays exactly", async () => {
  await seedEnteredMaintenance();
  await seedProtectedCanaries();
  const protectedBefore = await protectedPlanningDocuments();
  const before = await repository.loadAuthoritativeState({
    environment: ENVIRONMENT,
  });
  const intent = abortCommand(before);
  const maintenanceAfter = {
    ...before.maintenance,
    stateRevision: 13,
    writeEpoch: 11,
    maintenanceStatus: "open",
    intakeBarrier: null,
    lastTransitionId: intent.transitionId,
  };
  const expected = expectedTransition({intent, before, maintenanceAfter});

  const committed = await repository.abortPreActivationMaintenance(intent);
  assert.deepEqual(committed, {kind: "committed", transition: expected});
  nowMillis += 60_000;
  const replayed = await repository.abortPreActivationMaintenance(intent);
  assert.deepEqual(replayed, {kind: "replayed", transition: expected});
  assert.deepEqual(
    (await firestore.doc(statePath()).get()).data(),
    maintenanceAfter,
  );
  assert.deepEqual(await protectedPlanningDocuments(), protectedBefore);
});

test("a terminal replay never reapplies an older transition", async () => {
  await seedAuthoritativeState();
  const open = await repository.loadAuthoritativeState({
    environment: ENVIRONMENT,
  });
  const enter = enterCommand(open, "enter-terminal-replay");
  const committed = await repository.enterMaintenanceWithBarrierEvidence(enter);
  const closed = await repository.loadAuthoritativeState({
    environment: ENVIRONMENT,
  });
  await repository.abortPreActivationMaintenance(
    abortCommand(closed, "abort-after-enter"),
  );
  const stateAfterAbort = await firestore.doc(statePath()).get();

  const replayed = await repository.enterMaintenanceWithBarrierEvidence(enter);

  assert.deepEqual(replayed, {
    kind: "replayed",
    transition: committed.transition,
  });
  assert.deepEqual(
    (await firestore.doc(statePath()).get()).data(),
    stateAfterAbort.data(),
  );
});

test("abort replay fails if its referenced entry operation is missing", async () => {
  await seedEnteredMaintenance("enter-abort-replay-missing-entry");
  await seedProtectedCanaries();
  const closed = await repository.loadAuthoritativeState({
    environment: ENVIRONMENT,
  });
  const intent = abortCommand(closed, "abort-replay-missing-entry");
  await repository.abortPreActivationMaintenance(intent);
  await firestore.doc(operationPath(
    intent.expectedMaintenanceEntryTransitionId,
  )).delete();
  const beforeReplay = await planningDocuments();

  await assert.rejects(
    repository.abortPreActivationMaintenance(intent),
    errorCode("invalid_planning_state"),
  );
  assert.deepEqual(await planningDocuments(), beforeReplay);
});

test("entry and abort reject the opposite maintenance status", async () => {
  const cases = [
    {
      maintenance: closedMaintenance(),
      transition: (current) => repository
        .enterMaintenanceWithBarrierEvidence(
          enterCommand(current, "enter-from-closed"),
        ),
    },
    {
      maintenance: openMaintenance(),
      transition: (current) => repository.abortPreActivationMaintenance(
        abortCommand(current, "abort-from-open"),
      ),
    },
  ];

  for (const fixture of cases) {
    await clearFirestore();
    await seedAuthoritativeState({maintenance: fixture.maintenance});
    const current = await repository.loadAuthoritativeState({
      environment: ENVIRONMENT,
    });
    const beforeDocuments = await planningDocuments();
    await assert.rejects(
      fixture.transition(current),
      errorCode("maintenance_state_conflict"),
    );
    assert.deepEqual(await planningDocuments(), beforeDocuments);
  }
});

test("abort requires exact persisted maintenance-entry evidence", async () => {
  await seedAuthoritativeState({maintenance: closedMaintenance()});
  const current = await repository.loadAuthoritativeState({
    environment: ENVIRONMENT,
  });
  const beforeDocuments = await planningDocuments();

  await assert.rejects(
    repository.abortPreActivationMaintenance(
      abortCommand(current, "abort-without-entry-evidence"),
    ),
    errorCode("maintenance_state_conflict"),
  );
  assert.deepEqual(await planningDocuments(), beforeDocuments);
});

test("abort refuses either rotation while a release lease is retained", async () => {
  for (const type of ["delivery", "market"]) {
    await clearFirestore();
    const lease = {
      type,
      bundleId: "bundle-sealed",
      bundleRevision: "bundle-v1-sealed",
      bundleDigest: `shift-planning:v1:sha256:${"7".repeat(64)}`,
      leaseEpoch: 4,
      ownerOperationId: "release-sealed",
      state: "sealed",
      acquiredAtMillis: ATTEMPTED_AT_MILLIS - 10_000,
      deadlineAtMillis: ATTEMPTED_AT_MILLIS + 10_000,
    };
    await seedAuthoritativeState({
      [type]: rotation(type, {releaseLease: lease}),
    });
    const open = await repository.loadAuthoritativeState({
      environment: ENVIRONMENT,
    });
    await repository.enterMaintenanceWithBarrierEvidence(
      enterCommand(open, `enter-with-${type}-lease`),
    );
    const closed = await repository.loadAuthoritativeState({
      environment: ENVIRONMENT,
    });
    const beforeDocuments = await planningDocuments();

    await assert.rejects(
      repository.abortPreActivationMaintenance(
        abortCommand(closed, `abort-with-${type}-lease`),
      ),
      errorCode("maintenance_state_conflict"),
      type,
    );
    assert.deepEqual(await planningDocuments(), beforeDocuments, type);
  }
});

test("abort replay rejects an internally consistent retained lease", async () => {
  const retainedLease = {
    type: "delivery",
    bundleId: "bundle-sealed",
    bundleRevision: "bundle-v1-sealed",
    bundleDigest: `shift-planning:v1:sha256:${"8".repeat(64)}`,
    leaseEpoch: 4,
    ownerOperationId: "release-sealed",
    state: "sealed",
    acquiredAtMillis: ATTEMPTED_AT_MILLIS - 10_000,
    deadlineAtMillis: ATTEMPTED_AT_MILLIS + 10_000,
  };
  await seedAuthoritativeState({
    delivery: rotation("delivery", {releaseLease: retainedLease}),
  });
  await seedProtectedCanaries();
  const open = await repository.loadAuthoritativeState({
    environment: ENVIRONMENT,
  });
  await repository.enterMaintenanceWithBarrierEvidence(
    enterCommand(open, "enter-forged-abort-lease"),
  );
  const closed = await repository.loadAuthoritativeState({
    environment: ENVIRONMENT,
  });
  const intent = abortCommand(closed, "abort-forged-lease");
  const maintenanceAfter = {
    ...closed.maintenance,
    stateRevision: closed.maintenance.stateRevision + 1,
    writeEpoch: closed.maintenance.writeEpoch + 1,
    maintenanceStatus: "open",
    intakeBarrier: null,
    lastTransitionId: intent.transitionId,
  };
  const forged = expectedTransition({intent, before: closed, maintenanceAfter});
  const {attemptedAtMillis, ...persisted} = forged;
  await firestore.doc(operationPath(intent.transitionId)).set({
    ...persisted,
    attemptedAt: Timestamp.fromMillis(attemptedAtMillis),
  });
  const beforeReplay = await planningDocuments();

  await assert.rejects(
    repository.abortPreActivationMaintenance(intent),
    errorCode("invalid_planning_state"),
  );
  assert.deepEqual(await planningDocuments(), beforeReplay);
});

test("abort rejects stale epoch and digest without mutation", async () => {
  const staleCases = [
    {
      name: "write epoch",
      code: "stale_write_epoch",
      override: {expectedWriteEpoch: 9},
    },
    {
      name: "authoritative digest",
      code: "maintenance_state_conflict",
      override: {
        expectedAuthoritativeDigest:
          `shift-planning:v1:sha256:${"0".repeat(64)}`,
      },
    },
  ];

  for (const fixture of staleCases) {
    await clearFirestore();
    await seedEnteredMaintenance();
    await seedProtectedCanaries();
    const current = await repository.loadAuthoritativeState({
      environment: ENVIRONMENT,
    });
    const beforeDocuments = await planningDocuments();
    await assert.rejects(
      repository.abortPreActivationMaintenance(
        abortCommand(current, `abort-stale-${fixture.name.replace(" ", "-")}`, {
          ...fixture.override,
        }),
      ),
      errorCode(fixture.code),
      fixture.name,
    );
    assert.deepEqual(
      await planningDocuments(),
      beforeDocuments,
      fixture.name,
    );
  }
});
