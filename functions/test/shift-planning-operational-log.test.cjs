"use strict";

const assert = require("node:assert/strict");
const {test} = require("node:test");

const {ShiftPlanningError} = require("../lib/shift-planning-contract.js");
const {
  logShiftPlanningOperationalEvent,
} = require("../lib/shift-planning-operational-log.js");

const createLogger = () => {
  const entries = [];
  return {
    entries,
    logger: {
      info(message, data) {
        entries.push({level: "info", message, data});
      },
      warn(message, data) {
        entries.push({level: "warn", message, data});
      },
      error(message, data) {
        entries.push({level: "error", message, data});
      },
    },
  };
};

test("logs stable request outcomes with pseudonymous correlation", () => {
  const {entries, logger} = createLogger();
  const requestId = "member-jane-private-request";

  logShiftPlanningOperationalEvent(logger, {
    kind: "requestRouted",
    environment: "develop",
    requestId,
    routeKind: "lifecycle",
    resultKind: "completed",
  });
  logShiftPlanningOperationalEvent(logger, {
    kind: "requestRejected",
    environment: "develop",
    requestId,
    failureCode: "unsupported_schema_version",
  });

  assert.deepEqual(entries.map(({level}) => level), ["info", "warn"]);
  assert.deepEqual(entries[0].data, {
    schemaVersion: 1,
    component: "shift_planning",
    eventKind: "request_routed",
    environment: "develop",
    requestCorrelationId: entries[0].data.requestCorrelationId,
    routeKind: "lifecycle",
    resultKind: "completed",
  });
  assert.match(
    entries[0].data.requestCorrelationId,
    /^shift-planning-request:v1:sha256:[a-f0-9]{64}$/,
  );
  assert.equal(
    entries[1].data.requestCorrelationId,
    entries[0].data.requestCorrelationId,
  );
  assert.equal(JSON.stringify(entries).includes(requestId), false);
});

test("reduces failures to stable codes without error details", () => {
  const {entries, logger} = createLogger();
  const sensitive = "member-42 email@example.com private digest";

  logShiftPlanningOperationalEvent(logger, {
    kind: "requestFailed",
    environment: "production",
    requestId: "private-request",
    error: new ShiftPlanningError("fairness_input_drift", sensitive),
  });
  logShiftPlanningOperationalEvent(logger, {
    kind: "legacyFailed",
    environment: "production",
    requestId: "private-legacy-request",
    planningType: "market",
    error: new Error(sensitive),
  });

  assert.equal(entries[0].data.failureCode, "fairness_input_drift");
  assert.equal(entries[1].data.failureCode, "internal_planning_failure");
  assert.equal(JSON.stringify(entries).includes(sensitive), false);
  assert.equal(JSON.stringify(entries).includes("private-request"), false);
  assert.equal(JSON.stringify(entries).includes("private-legacy-request"), false);
  assert.deepEqual(Object.keys(entries[0].data).sort(), [
    "component",
    "environment",
    "eventKind",
    "failureCode",
    "requestCorrelationId",
    "schemaVersion",
  ]);
});

test("logs legacy completion counts without sheet or member payloads", () => {
  const {entries, logger} = createLogger();

  logShiftPlanningOperationalEvent(logger, {
    kind: "legacyCompleted",
    environment: "develop",
    requestId: "delivery-request",
    planningType: "delivery",
    seasonLabel: "2026-27",
    generatedCount: 54,
  });

  assert.deepEqual(entries[0].data, {
    schemaVersion: 1,
    component: "shift_planning",
    eventKind: "legacy_completed",
    environment: "develop",
    requestCorrelationId: entries[0].data.requestCorrelationId,
    planningType: "delivery",
    seasonLabel: "2026-27",
    generatedCount: 54,
  });
  assert.equal(Object.hasOwn(entries[0].data, "sheetName"), false);
  assert.equal(Object.hasOwn(entries[0].data, "requestedByUserId"), false);
});
