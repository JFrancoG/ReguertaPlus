"use strict";

const assert = require("node:assert/strict");
const {test} = require("node:test");
const {Timestamp} = require("@google-cloud/firestore");

const {
  createShiftPlanningDigest,
} = require("../lib/shift-planning-digest.js");
const {
  createShiftPlanningCompletedSyncCommand,
  createShiftPlanningProcessingSyncCommand,
  createShiftPlanningSyncCommandToken,
  parseShiftPlanningPersistedSyncCommand,
  requireShiftPlanningSyncCommandToken,
} = require("../lib/shift-planning-sync-command.js");

const digest = (value) => createShiftPlanningDigest(value);
const bundleRevision = "bundle-revision-2026";
const bundleDigest = digest({bundle: "2026"});

const pendingCommand = (overrides = {}) => ({
  schemaVersion: 1,
  operationKind: "sheetsSync",
  commandId: `${bundleRevision}-delivery`,
  idempotencyKey: `${bundleRevision}:sheets:delivery`,
  state: "pending",
  type: "delivery",
  bundleRevision,
  bundleDigest,
  writeEpoch: 8,
  workbookId: "workbook-production",
  workbookRevision: "workbook-revision-7",
  partitionKey: "delivery",
  expectedPartitionStateRevision: 4,
  expectedPartitionEpoch: 11,
  commandPartitionEpoch: 12,
  expectedCurrentLease: null,
  leaseIntent: {
    ownerOperationId: `${bundleRevision}:sheets:delivery`,
    leaseEpoch: 12,
    state: "claimed",
    durationMillis: 120_000,
  },
  expectedActiveRevision: bundleRevision,
  expectedActiveDigest: bundleDigest,
  targetSeasonStartYear: 2026,
  affectedProjectionSeasonStartYears: [2026, 2027],
  ...overrides,
});

const claim = (overrides = {}) => ({
  workerId: "sync-worker-1",
  attemptId: "sync-attempt-1",
  fencingEpoch: 12,
  acquiredAt: Timestamp.fromMillis(1_788_393_600_000),
  expiresAt: Timestamp.fromMillis(1_788_393_720_000),
  ...overrides,
});

test("round-trips exact pending, processing, and completed sync commands", () => {
  const pending = pendingCommand();
  assert.deepEqual(parseShiftPlanningPersistedSyncCommand(pending), pending);

  const processing = createShiftPlanningProcessingSyncCommand({
    command: pending,
    claim: claim(),
  });
  assert.equal(processing.state, "processing");
  assert.equal(processing.commandDigest, digest(pending));
  assert.deepEqual(parseShiftPlanningPersistedSyncCommand(processing), processing);

  const completed = createShiftPlanningCompletedSyncCommand({
    command: processing,
    completedAt: Timestamp.fromMillis(1_788_393_660_000),
    evidence: {
      workbookRevision: "workbook-revision-8",
      partitionDigest: digest({partition: "delivery-8"}),
    },
  });
  assert.equal(completed.state, "completed");
  assert.equal(completed.terminal.attemptId, "sync-attempt-1");
  assert.equal("claim" in completed, false);
  assert.deepEqual(parseShiftPlanningPersistedSyncCommand(completed), completed);
});

test("rejects non-canonical lineage, extras, and forged lifecycle evidence", () => {
  assert.throws(
    () => parseShiftPlanningPersistedSyncCommand({
      ...pendingCommand(),
      commandPartitionEpoch: 13,
    }),
    (error) => error.code === "invalid_planning_sync_command",
  );
  assert.throws(
    () => parseShiftPlanningPersistedSyncCommand({
      ...pendingCommand(),
      requestedByUserId: "admin",
    }),
    (error) => error.code === "invalid_planning_sync_command",
  );

  const processing = createShiftPlanningProcessingSyncCommand({
    command: pendingCommand(),
    claim: claim(),
  });
  assert.throws(
    () => parseShiftPlanningPersistedSyncCommand({
      ...processing,
      commandDigest: digest({forged: true}),
    }),
    (error) => error.code === "invalid_planning_sync_command",
  );
  assert.throws(
    () => createShiftPlanningCompletedSyncCommand({
      command: processing,
      completedAt: processing.claim.expiresAt,
      evidence: {
        workbookRevision: "workbook-revision-8",
        partitionDigest: digest({partition: "delivery-8"}),
      },
    }),
    (error) => error.code === "invalid_planning_sync_command",
  );
});

test("binds an execution token to one exact fenced claim", () => {
  const processing = createShiftPlanningProcessingSyncCommand({
    command: pendingCommand(),
    claim: claim(),
  });
  const token = createShiftPlanningSyncCommandToken({
    environment: "develop",
    command: processing,
  });
  assert.doesNotThrow(() =>
    requireShiftPlanningSyncCommandToken(processing, token));
  assert.throws(
    () => requireShiftPlanningSyncCommandToken(processing, {
      ...token,
      fencingEpoch: token.fencingEpoch + 1,
    }),
    (error) => error.code === "invalid_planning_sync_command",
  );
});
