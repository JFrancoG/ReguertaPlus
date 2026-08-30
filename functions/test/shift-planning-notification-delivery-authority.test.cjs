"use strict";

const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {join} = require("node:path");
const {test} = require("node:test");
const {Timestamp} = require("@google-cloud/firestore");

const {
  classifyShiftPlanningNotificationDeliveryAuthority,
} = require(
  "../lib/shift-planning-notification-delivery-authority.js"
);

const eventId = "bundle-v2-1234567890abcdef12345678-notification-1";
const releasedAt = Timestamp.fromMillis(1_788_393_900_000);
const digest = (character) =>
  `shift-planning:v1:sha256:${character.repeat(64)}`;

const canonicalEvent = () => ({
  title: "Turnos actualizados",
  body: "Consulta la aplicación para ver la información actualizada.",
  type: "shift_updated",
  target: "users",
  targetPayload: {userIds: ["member-1"]},
  sentAt: releasedAt,
  createdBy: "system",
});

const releaseReceipt = () => ({
  schemaVersion: 1,
  operationKind: "notificationRelease",
  state: "released",
  intentId: eventId,
  idempotencyKey:
    "bundle-v2-1234567890abcdef12345678:notification:1",
  canonicalEventId: eventId,
  recipientUserId: "member-1",
  shiftId: "shift_delivery_20260902",
  shiftType: "delivery",
  bundleRevision: "bundle-v2-1234567890abcdef12345678",
  bundleDigest: digest("a"),
  writeEpoch: 8,
  releasedAt,
  readBackGate: {delivery: {}, market: {}},
  readBackGateDigest: digest("b"),
  dispatchPolicy: {
    deliveryGuarantee: "atLeastOnce",
    duplicatePresentationPossible: true,
    stableEventId: eventId,
    collapseKey: eventId,
  },
  releaseDigest: digest("c"),
});

test("keeps events without a release receipt on the legacy path", () => {
  assert.equal(
    classifyShiftPlanningNotificationDeliveryAuthority({
      eventId: "notificación legacy 1",
      event: {type: "news"},
      releaseReceipt: null,
    }),
    "legacy",
  );
});

test("reserves an exact canonical event for governed dispatch", () => {
  assert.equal(
    classifyShiftPlanningNotificationDeliveryAuthority({
      eventId,
      event: canonicalEvent(),
      releaseReceipt: releaseReceipt(),
    }),
    "governed",
  );
});

test("fails closed when governed receipt or event evidence drifts", () => {
  const assertInvalid = (event, receipt) => assert.throws(
    () => classifyShiftPlanningNotificationDeliveryAuthority({
      eventId,
      event,
      releaseReceipt: receipt,
    }),
    (error) => error.code === "invalid_planning_transaction",
  );

  assertInvalid(
    {...canonicalEvent(), body: "Turno de member-1 el 2 de septiembre"},
    releaseReceipt(),
  );
  assertInvalid(canonicalEvent(), {
    ...releaseReceipt(),
    dispatchPolicy: {
      ...releaseReceipt().dispatchPolicy,
      stableEventId: "different-event",
    },
  });
});

test("legacy trigger checks governed authority before any fan-out", () => {
  const source = readFileSync(join(__dirname, "../src/index.ts"), "utf8");
  const start = source.indexOf("export const onNotificationEventCreated");
  const end = source.indexOf("export const syncShiftsFromGoogleSheets", start);
  const trigger = source.slice(start, end);
  const authorityIndex = trigger.indexOf(
    "classifyShiftPlanningNotificationDeliveryAuthority",
  );
  const inboxIndex = trigger.indexOf("fanOutNotificationInbox");
  const transportIndex = trigger.indexOf("dispatchNotificationEventGeneric");

  assert.ok(authorityIndex >= 0);
  assert.ok(inboxIndex > authorityIndex);
  assert.ok(transportIndex > authorityIndex);
  assert.match(trigger, /deliveryAuthority === "governed"[\s\S]*?return;/);
});
