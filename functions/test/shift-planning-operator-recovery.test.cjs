"use strict";

const assert = require("node:assert/strict");
const {test} = require("node:test");
const {Timestamp} = require("@google-cloud/firestore");

const {
  createShiftPlanningDigest,
} = require("../lib/shift-planning-digest.js");
const {
  createShiftPlanningRecoveryAuthorization,
  parseShiftPlanningOperatorRecoveryCommand,
  parseShiftPlanningRecoveryAuthorization,
  shiftPlanningRecoveryAuthorizationPath,
} = require("../lib/shift-planning-operator-recovery.js");

const digest = (value) => createShiftPlanningDigest(value);

const authorization = () => createShiftPlanningRecoveryAuthorization({
  schemaVersion: 1,
  mode: "recovery",
  state: "authorized",
  environment: "develop",
  activationOperationId: "request-activate-2026",
  recoveryOperationId: "recovery-activate-2026",
  bundleRevision: "bundle-revision-2026",
  bundleDigest: digest({bundle: "2026"}),
  activationOperationIntentDigest: digest({activation: "2026"}),
  expectedMaintenance: {
    stateRevision: 12,
    writeEpoch: 8,
    maintenanceStatus: "closed",
    activeRevision: "bundle-revision-2026",
    activeDigest: digest({bundle: "2026"}),
    lastTransitionId: "request-activate-2026",
  },
  authorizedAt: Timestamp.fromMillis(1_788_393_600_000),
  expiresAt: Timestamp.fromMillis(1_788_397_200_000),
});

test("binds one exact operator recovery command to its authorization", () => {
  const value = authorization();
  assert.deepEqual(parseShiftPlanningRecoveryAuthorization(value), value);
  const command = parseShiftPlanningOperatorRecoveryCommand({
    schemaVersion: 1,
    mode: "recovery",
    environment: value.environment,
    activationOperationId: value.activationOperationId,
    recoveryOperationId: value.recoveryOperationId,
    authorizationDigest: value.authorizationDigest,
  });
  assert.equal(
    shiftPlanningRecoveryAuthorizationPath(command),
    "develop/plus-collections/shiftPlanningOperations/" +
      "request-activate-2026/recoveryAuthorizations/recovery-activate-2026",
  );
});

test("rejects authorization, window, and command drift", () => {
  const value = authorization();
  const {authorizationDigest: _authorizationDigest, ...withoutDigest} = value;
  assert.throws(
    () => parseShiftPlanningRecoveryAuthorization({
      ...value,
      bundleRevision: "another-revision",
    }),
    (error) => error.code === "invalid_planning_transaction",
  );
  assert.throws(
    () => parseShiftPlanningRecoveryAuthorization({
      ...value,
      unexpected: true,
    }),
    (error) => error.code === "invalid_planning_transaction",
  );
  assert.throws(
    () => createShiftPlanningRecoveryAuthorization({
      ...withoutDigest,
      authorizedAt: value.expiresAt,
    }),
    (error) => error.code === "invalid_planning_transaction",
  );
  assert.throws(
    () => parseShiftPlanningOperatorRecoveryCommand({
      schemaVersion: 1,
      mode: "recovery",
      environment: "develop",
      activationOperationId: value.activationOperationId,
      recoveryOperationId: value.recoveryOperationId,
      authorizationDigest: value.authorizationDigest,
      requestedByUserId: "admin",
    }),
    (error) => error.code === "invalid_planning_transaction",
  );
});
