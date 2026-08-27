"use strict";

const assert = require("node:assert/strict");
const {after, before, beforeEach, test} = require("node:test");
const {Firestore, Timestamp} = require("@google-cloud/firestore");

const {
  createFirestoreShiftPlanningSyncCommandRepository,
} = require(
  "../lib/shift-planning-firestore-sync-command-repository.js"
);
const {
  createShiftPlanningDigest,
} = require("../lib/shift-planning-digest.js");
const {
  drainShiftPlanningSyncCommands,
  executeShiftPlanningSyncCommand,
} = require("../lib/shift-planning-sync-command-executor.js");
const {
  parseShiftPlanningPersistedSyncCommand,
} = require("../lib/shift-planning-sync-command.js");

const PROJECT_ID = "demo-reguerta-hu082-sync-command";
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
if (!EMULATOR_HOST) {
  throw new Error(
    "FIRESTORE_EMULATOR_HOST is required; run this test through the " +
      "isolated Firestore emulator.",
  );
}

const environment = "develop";
const root = `${environment}/plus-collections`;
const bundleRevision = "bundle-revision-2026";
const digest = (value) => createShiftPlanningDigest(value);
const bundleDigest = digest({bundle: "2026"});
const initialMillis = 1_788_393_600_000;

let firestore;
let nowMillis;
let repository;

const commandPath = (type = "delivery") =>
  `${root}/shiftPlanningSyncCommands/${bundleRevision}-${type}`;
const statePath = `${root}/shiftPlanningState/current`;
const sourcePolicyPath = `${root}/shiftPlanningState/sourcePolicy`;

const pendingCommand = (type = "delivery", overrides = {}) => {
  const expectedPartitionStateRevision = type === "delivery" ? 4 : 6;
  const expectedPartitionEpoch = type === "delivery" ? 11 : 15;
  return {
    schemaVersion: 1,
    operationKind: "sheetsSync",
    commandId: `${bundleRevision}-${type}`,
    idempotencyKey: `${bundleRevision}:sheets:${type}`,
    state: "pending",
    type,
    bundleRevision,
    bundleDigest,
    writeEpoch: 8,
    workbookId: "workbook-production",
    workbookRevision: "workbook-revision-7",
    partitionKey: type,
    expectedPartitionStateRevision,
    expectedPartitionEpoch,
    commandPartitionEpoch: expectedPartitionEpoch + 1,
    expectedCurrentLease: null,
    leaseIntent: {
      ownerOperationId: `${bundleRevision}:sheets:${type}`,
      leaseEpoch: expectedPartitionEpoch + 1,
      state: "claimed",
      durationMillis: 120_000,
    },
    expectedActiveRevision: bundleRevision,
    expectedActiveDigest: bundleDigest,
    targetSeasonStartYear: 2026,
    affectedProjectionSeasonStartYears: [2026, 2027],
    ...overrides,
  };
};

const maintenance = (overrides = {}) => ({
  schemaVersion: 1,
  stateRevision: 12,
  writeEpoch: 8,
  maintenanceStatus: "closed",
  activeRevision: bundleRevision,
  activeDigest: bundleDigest,
  intakeBarrier: {
    revision: "barrier-2026",
    digest: digest({barrier: "2026"}),
    verifiedAtMillis: initialMillis - 1_000,
  },
  lastTransitionId: "request-activate-2026",
  ...overrides,
});

const partition = (type = "delivery", overrides = {}) => ({
  workbookId: "workbook-production",
  workbookRevision: "workbook-revision-7",
  partitionKey: type,
  stateRevision: type === "delivery" ? 4 : 6,
  epoch: type === "delivery" ? 11 : 15,
  lease: null,
  ...overrides,
});

const sourcePolicy = (overrides = {}) => ({
  environment,
  sync: {
    partitions: {
      delivery: partition("delivery"),
      market: partition("market"),
    },
  },
  ...overrides,
});

const clearFirestore = async () => {
  const response = await fetch(
    `http://${EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/` +
      "databases/(default)/documents",
    {method: "DELETE"},
  );
  assert.equal(response.ok, true, await response.text());
};

const seed = async ({commands = [pendingCommand()]} = {}) => {
  const batch = firestore.batch();
  batch.set(firestore.doc(statePath), maintenance());
  batch.set(firestore.doc(sourcePolicyPath), sourcePolicy());
  commands.forEach((command) =>
    batch.set(firestore.doc(commandPath(command.type)), command));
  await batch.commit();
};

const readPartition = async (type = "delivery") =>
  (await firestore.doc(sourcePolicyPath).get()).get(`sync.partitions.${type}`);

before(async () => {
  firestore = new Firestore({projectId: PROJECT_ID, databaseId: "(default)"});
});

after(async () => {
  await firestore.terminate();
});

beforeEach(async () => {
  await clearFirestore();
  nowMillis = initialMillis;
  repository = createFirestoreShiftPlanningSyncCommandRepository(
    firestore,
    () => Timestamp.fromMillis(nowMillis),
  );
});

test("discovers, claims, authorizes, and completes one exact command", async () => {
  await seed();
  assert.deepEqual(await repository.discoverRunnable({
    environment,
    limit: 10,
  }), [`${bundleRevision}-delivery`]);

  const claimed = await repository.claim({
    environment,
    commandId: `${bundleRevision}-delivery`,
    workerId: "sync-worker-1",
    attemptId: "sync-attempt-1",
  });
  assert.equal(claimed.kind, "claimed");
  assert.equal(claimed.command.claim.fencingEpoch, 12);
  assert.equal((await readPartition()).epoch, 12);
  assert.equal((await readPartition()).lease.state, "claimed");
  assert.deepEqual(
    await repository.authorizeBatch(claimed.token),
    claimed.command,
  );

  nowMillis += 60_000;
  const evidence = {
    workbookRevision: "workbook-revision-8",
    partitionDigest: digest({partition: "delivery-8"}),
  };
  const completed = await repository.complete({
    token: claimed.token,
    evidence,
  });
  assert.equal(completed.kind, "committed");
  assert.equal(completed.command.state, "completed");
  assert.equal((await readPartition()).workbookRevision, "workbook-revision-8");
  assert.equal((await readPartition()).stateRevision, 6);
  assert.equal((await readPartition()).lease, null);

  const replayed = await repository.complete({token: claimed.token, evidence});
  assert.equal(replayed.kind, "replayed");
  const terminalClaim = await repository.claim({
    environment,
    commandId: `${bundleRevision}-delivery`,
    workerId: "sync-worker-2",
    attemptId: "sync-attempt-2",
  });
  assert.equal(terminalClaim.kind, "terminalReplay");
  assert.deepEqual(await repository.discoverRunnable({
    environment,
    limit: 10,
  }), []);
});

test("serializes competing claims and fences an expired worker", async () => {
  await seed();
  const first = await repository.claim({
    environment,
    commandId: `${bundleRevision}-delivery`,
    workerId: "sync-worker-1",
    attemptId: "sync-attempt-1",
  });
  assert.equal(first.kind, "claimed");
  const busy = await repository.claim({
    environment,
    commandId: `${bundleRevision}-delivery`,
    workerId: "sync-worker-2",
    attemptId: "sync-attempt-2",
  });
  assert.equal(busy.kind, "busy");

  nowMillis = first.command.claim.expiresAt.toMillis();
  assert.deepEqual(await repository.discoverRunnable({
    environment,
    limit: 10,
  }), [`${bundleRevision}-delivery`]);
  const takeover = await repository.claim({
    environment,
    commandId: `${bundleRevision}-delivery`,
    workerId: "sync-worker-2",
    attemptId: "sync-attempt-2",
  });
  assert.equal(takeover.kind, "claimed");
  assert.equal(takeover.command.claim.fencingEpoch, 13);
  await assert.rejects(
    repository.authorizeBatch(first.token),
    (error) => error.code === "invalid_planning_sync_command",
  );
  assert.equal(
    (await repository.authorizeBatch(takeover.token)).claim.fencingEpoch,
    13,
  );
});

test("active or partition drift rejects a claim without mutation", async () => {
  await seed();
  await firestore.doc(statePath).update({writeEpoch: 9});
  await assert.rejects(
    repository.claim({
      environment,
      commandId: `${bundleRevision}-delivery`,
      workerId: "sync-worker-1",
      attemptId: "sync-attempt-1",
    }),
    (error) => error.code === "invalid_planning_sync_command",
  );
  assert.equal(
    parseShiftPlanningPersistedSyncCommand(
      (await firestore.doc(commandPath()).get()).data(),
    ).state,
    "pending",
  );
  assert.deepEqual(await readPartition(), partition());

  await firestore.doc(statePath).set(maintenance());
  await firestore.doc(sourcePolicyPath).update({
    "sync.partitions.delivery.epoch": 12,
  });
  await assert.rejects(
    repository.claim({
      environment,
      commandId: `${bundleRevision}-delivery`,
      workerId: "sync-worker-1",
      attemptId: "sync-attempt-2",
    }),
    (error) => error.code === "invalid_planning_sync_command",
  );
  assert.equal(
    parseShiftPlanningPersistedSyncCommand(
      (await firestore.doc(commandPath()).get()).data(),
    ).state,
    "pending",
  );
});

test("pre-batch workbook drift retains the fenced processing lease", async () => {
  await seed();
  const claimed = await repository.claim({
    environment,
    commandId: `${bundleRevision}-delivery`,
    workerId: "sync-worker-1",
    attemptId: "sync-attempt-1",
  });
  assert.equal(claimed.kind, "claimed");
  await firestore.doc(sourcePolicyPath).update({
    "sync.partitions.delivery.workbookRevision": "outside-revision-8",
  });
  await assert.rejects(
    repository.authorizeBatch(claimed.token),
    (error) => error.code === "invalid_planning_sync_command",
  );
  const retained = parseShiftPlanningPersistedSyncCommand(
    (await firestore.doc(commandPath()).get()).data(),
  );
  assert.equal(retained.state, "processing");
  assert.equal(retained.claim.fencingEpoch, 12);
  assert.equal((await readPartition()).lease.state, "claimed");
});

test("explicit polling retries idempotently after a lost completion", async () => {
  await seed();
  const physicalWrites = new Map();
  let consumerCalls = 0;
  const consumer = {
    async apply(command) {
      consumerCalls += 1;
      const retained = physicalWrites.get(command.idempotencyKey);
      if (retained) return retained;
      const evidence = {
        workbookRevision: "workbook-revision-8",
        partitionDigest: digest({
          partition: command.partitionKey,
          bundle: command.bundleDigest,
        }),
      };
      physicalWrites.set(command.idempotencyKey, evidence);
      return evidence;
    },
  };

  const first = await repository.claim({
    environment,
    commandId: `${bundleRevision}-delivery`,
    workerId: "sync-worker-1",
    attemptId: "sync-attempt-lost",
  });
  assert.equal(first.kind, "claimed");
  await repository.authorizeBatch(first.token);
  await consumer.apply(first.command);

  nowMillis = first.command.claim.expiresAt.toMillis();
  const drained = await drainShiftPlanningSyncCommands({
    repository,
    consumer,
    environment,
    workerId: "sync-worker-2",
    limit: 10,
    createAttemptId: () => "sync-attempt-retry",
  });
  assert.equal(drained.length, 1);
  assert.equal(drained[0].kind, "completed");
  assert.equal(consumerCalls, 2);
  assert.equal(physicalWrites.size, 1);

  const replay = await executeShiftPlanningSyncCommand({
    repository,
    consumer,
    environment,
    commandId: `${bundleRevision}-delivery`,
    workerId: "sync-worker-3",
    attemptId: "sync-attempt-after-terminal",
  });
  assert.equal(replay.kind, "terminalReplay");
  assert.equal(consumerCalls, 2);
});
