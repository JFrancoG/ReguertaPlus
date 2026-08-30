"use strict";

const assert = require("node:assert/strict");
const {test} = require("node:test");
const {Timestamp} = require("firebase-admin/firestore");

const {
  createShiftPlanningNotificationTerminalMarker,
  parseShiftPlanningNotificationTerminalMarker,
  sameShiftPlanningNotificationTerminalMarker,
  shiftPlanningNotificationTerminalMarkerPath,
} = require("../lib/shift-planning-notification-terminal-marker.js");

const digest = (character) =>
  `shift-planning:v1:sha256:${character.repeat(64)}`;
const terminalizedAtMillis = 1_788_656_400_000;

const terminalIntent = (overrides = {}) => ({
  intentId: "bundle-terminal-notification-1",
  shiftId: "shift-1",
  resolution: "cancelledUnsubmitted",
  attemptIds: [],
  dispatchEvidenceDigest: digest("a"),
  ...overrides,
});

const terminalIncident = (overrides = {}) => ({
  incidentId: "incident-terminal-1",
  bundleRevision: "bundle-terminal",
  bundleDigest: digest("b"),
  terminalizedAtMillis,
  terminalIncidentDigest: digest("c"),
  intents: [terminalIntent()],
  ...overrides,
});

test("creates one exact terminal marker for each incident intent", () => {
  const marker = createShiftPlanningNotificationTerminalMarker({
    terminalIncident: terminalIncident(),
    intent: terminalIntent(),
  });

  assert.equal(marker.state, "terminal");
  assert.equal(marker.resolution, "cancelledUnsubmitted");
  assert.equal(marker.terminalizedAt.toMillis(), terminalizedAtMillis);
  assert.equal(
    shiftPlanningNotificationTerminalMarkerPath(marker.intentId),
    "shiftPlanningNotificationIntents/" +
      "bundle-terminal-notification-1/terminalState/current",
  );
  assert.equal(
    sameShiftPlanningNotificationTerminalMarker(
      marker,
      parseShiftPlanningNotificationTerminalMarker(marker),
    ),
    true,
  );
});

test("rejects a marker outside the incident and malformed evidence", () => {
  assert.throws(
    () => createShiftPlanningNotificationTerminalMarker({
      terminalIncident: terminalIncident(),
      intent: terminalIntent({intentId: "bundle-terminal-notification-2"}),
    }),
    (error) => error.code === "invalid_planning_transaction",
  );
  const marker = createShiftPlanningNotificationTerminalMarker({
    terminalIncident: terminalIncident(),
    intent: terminalIntent(),
  });
  for (const invalid of [
    {...marker, extra: true},
    {...marker, resolution: "released"},
    {...marker, attemptIds: ["attempt-1", "attempt-1"]},
    {...marker, terminalizedAt: Timestamp.fromMillis(-1)},
  ]) {
    assert.throws(
      () => parseShiftPlanningNotificationTerminalMarker(invalid),
      (error) => error.code === "invalid_planning_transaction",
    );
  }
});
