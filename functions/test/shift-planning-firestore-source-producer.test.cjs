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
  refreshShiftPlanningLiveSource,
} = require("../lib/shift-planning-firestore-source-producer.js");
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
