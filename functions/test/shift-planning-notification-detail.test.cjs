"use strict";

const assert = require("node:assert/strict");
const {test} = require("node:test");
const {Timestamp} = require("@google-cloud/firestore");

const {
  resolveShiftPlanningNotificationDetail,
} = require("../lib/shift-planning-notification-detail.js");
const {
  attachShiftPlanningBackendMutationMarker,
  buildShiftPlanningPublicShiftMaterialization,
  createShiftPlanningActivationOperationTerminal,
} = require("../lib/shift-planning-publication-contract.js");

const eventId = "bundle-v2-1234567890abcdef12345678-notification-1";
const bundleRevision = "bundle-v2-1234567890abcdef12345678";
const digest = (character) =>
  `shift-planning:v1:sha256:${character.repeat(64)}`;
const bundleDigest = digest("a");
const shiftId = "shift_delivery_20260902";
const root = "develop/plus-collections";

const inbox = () => ({
  notificationEventId: eventId,
  schemaVersion: 1,
  operationKind: "shiftPlanningNotification",
  contentPolicy: "genericReferenceOnly",
  title: "Turnos actualizados",
  body: "Consulta la aplicación para ver la información actualizada.",
  type: "shift_updated",
  target: "users",
  targetPayload: {userIds: ["member-1"]},
  createdBy: "system",
  sentAt: Timestamp.fromMillis(1_788_393_900_000),
});

const intent = () => ({
  intentId: eventId,
  idempotencyKey: `${bundleRevision}:notification:1`,
  state: "held",
  recipientUserId: "member-1",
  shiftId,
  shiftType: "delivery",
  expectedAssignmentRevision: 1,
  expectedMembershipRevision: 3,
  expectedEligibilityRevision: 4,
  expectedDestinationRevision: 5,
  canonicalEventType: "shift_assignment_updated",
  payloadPolicy: "genericReferenceOnly",
  bundleRevision,
  bundleDigest,
  writeEpoch: 8,
});

const release = () => ({
  schemaVersion: 1,
  operationKind: "notificationRelease",
  state: "released",
  intentId: eventId,
  idempotencyKey: `${bundleRevision}:notification:1`,
  canonicalEventId: eventId,
  recipientUserId: "member-1",
  shiftId,
  shiftType: "delivery",
  bundleRevision,
  bundleDigest,
  writeEpoch: 8,
  releasedAt: Timestamp.fromMillis(1_788_393_900_000),
  readBackGate: {},
  readBackGateDigest: digest("b"),
  dispatchPolicy: {
    deliveryGuarantee: "atLeastOnce",
    duplicatePresentationPossible: true,
    stableEventId: eventId,
    collapseKey: eventId,
  },
  releaseDigest: digest("c"),
});

const shift = (assignedUserIds = ["member-1"]) => {
  const materialization = buildShiftPlanningPublicShiftMaterialization({
    environment: "develop",
    position: {
      schemaVersion: 1,
      positionId: shiftId,
      candidateId: "candidate-1",
      type: "delivery",
      shiftId,
      scheduledDate: "2026-09-02",
      projectionSeasonStartYear: 2026,
      rotationOwnerUserIds: [assignedUserIds[0]],
      assignedUserIds,
      rotationPositions: [{
        rotationOwnerUserId: assignedUserIds[0],
        effectiveAssigneeUserId: assignedUserIds[0],
        roundNumber: 1,
        positionInRound: 1,
        planningReason: "target",
      }],
      helperUserId: "member-2",
      source: "app",
      origin: "planner",
      planningRequestId: "request-1",
      bundleRevision,
      bundleDigest,
      writeEpoch: 8,
    },
    attemptedAt: Timestamp.fromMillis(Date.UTC(2026, 8, 2)),
  });
  const operation = createShiftPlanningActivationOperationTerminal({
    operationId: "request-activate-1",
    environment: "develop",
    requestId: "request-1",
    candidateId: "candidate-1",
    bundleRevision,
    bundleDigest,
    forwardManifestDigest: digest("e"),
    expectedStateDigest: digest("f"),
    writeEpoch: 8,
    attemptedAt: Timestamp.fromMillis(Date.UTC(2026, 8, 2)),
    publicMutations: [{
      mutationKind: "create",
      targetPath: materialization.targetPath,
      documentRevision: materialization.documentRevision,
      payloadDigest: materialization.payloadDigest,
    }],
    beforeImages: [],
  });
  return attachShiftPlanningBackendMutationMarker({
    materialization,
    operation,
  });
};

const input = (overrides = {}) => ({
  eventId,
  memberId: "member-1",
  inboxValue: inbox(),
  intentValue: intent(),
  releaseValue: release(),
  shiftValue: shift(),
  shiftTargetPath: `${root}/shifts/${shiftId}`,
  ...overrides,
});

test("returns only the current assigned shift for the active recipient", () => {
  const detail = resolveShiftPlanningNotificationDetail(input());

  assert.deepEqual(detail, {
    schemaVersion: 1,
    eventId,
    assignmentRevision: 1,
    documentRevision: 1,
    shift: {
      id: shiftId,
      type: "delivery",
      dateMillis: Date.UTC(2026, 8, 2),
      assignedUserIds: ["member-1"],
      helperUserId: "member-2",
      status: "planned",
      source: "app",
      createdAtMillis: Date.UTC(2026, 8, 2),
      updatedAtMillis: Date.UTC(2026, 8, 2),
    },
  });
});

test("returns no detail after assignment, recipient, or generic-copy drift", () => {
  assert.equal(resolveShiftPlanningNotificationDetail(input({
    shiftValue: shift(["member-3"]),
  })), null);
  assert.equal(resolveShiftPlanningNotificationDetail(input({
    memberId: "member-2",
  })), null);
  assert.equal(resolveShiftPlanningNotificationDetail(input({
    inboxValue: {...inbox(), body: "Turno de Ana el 2 de septiembre"},
  })), null);
});

test("returns no detail before canonical release or for malformed public data", () => {
  assert.equal(resolveShiftPlanningNotificationDetail(input({
    releaseValue: {...release(), state: "pending"},
  })), null);
  assert.equal(resolveShiftPlanningNotificationDetail(input({
    shiftValue: {...shift(), assignmentRevision: 0},
  })), null);
});
