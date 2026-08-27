"use strict";

const assert = require("node:assert/strict");
const {test} = require("node:test");
const {Timestamp} = require("@google-cloud/firestore");

const {
  attachShiftPlanningControlledMutationMarker,
  createShiftPlanningControlledMutationOperationTerminal,
} = require("../lib/shift-planning-public-event-contract.js");
const {
  classifyShiftPlanningPublicEventEvidenceCleanup,
  createShiftPlanningPublicEventOperationRetention,
  createShiftPlanningPublicEventRetentionPolicy,
  parseShiftPlanningPublicEventLedger,
  parseShiftPlanningPublicEventOperationRetention,
  parseShiftPlanningPublicEventRetentionPolicy,
  produceShiftPlanningPublicEventAudit,
  shiftPlanningPublicEventLedgerPath,
  shiftPlanningPublicEventOperationRetentionPath,
} = require("../lib/shift-planning-public-event-retention.js");
const {
  buildShiftPlanningPublicShiftMaterialization,
} = require("../lib/shift-planning-publication-contract.js");

const digest = (character) =>
  `shift-planning:v1:sha256:${character.repeat(64)}`;

const BUNDLE_REVISION = "bundle-v2-1234567890abcdef12345678";
const BUNDLE_DIGEST = digest("a");
const TERMINAL_AT = Timestamp.fromMillis(1_788_307_200_000);
const EVENT_TIME = Timestamp.fromMillis(1_788_307_201_000);
const HORIZON_MILLIS = 7 * 24 * 60 * 60 * 1_000;
const SAFETY_MARGIN_MILLIS = 24 * 60 * 60 * 1_000;

const position = () => ({
  schemaVersion: 1,
  positionId: "shift_delivery_20260902",
  candidateId: "bundle-candidate-1",
  type: "delivery",
  shiftId: "shift_delivery_20260902",
  scheduledDate: "2026-09-02",
  projectionSeasonStartYear: 2026,
  rotationOwnerUserIds: ["member-1"],
  assignedUserIds: ["member-1"],
  rotationPositions: [{
    rotationOwnerUserId: "member-1",
    effectiveAssigneeUserId: "member-1",
    roundNumber: 2,
    positionInRound: 4,
    planningReason: "target",
  }],
  helperUserId: "member-2",
  source: "app",
  origin: "planner",
  planningRequestId: "preview-request-1",
  bundleRevision: BUNDLE_REVISION,
  bundleDigest: BUNDLE_DIGEST,
  writeEpoch: 8,
});

const policy = () => createShiftPlanningPublicEventRetentionPolicy({
  policyRevision: "public-events-v1",
  maximumDeliveryRetryHorizonMillis: HORIZON_MILLIS,
  safetyMarginMillis: SAFETY_MARGIN_MILLIS,
});

const fixture = () => {
  const materialization = buildShiftPlanningPublicShiftMaterialization({
    environment: "develop",
    position: position(),
    attemptedAt: TERMINAL_AT,
  });
  const operation = createShiftPlanningControlledMutationOperationTerminal({
    kind: "repair",
    operationId: "repair-operation-1",
    environment: "develop",
    bundleRevision: BUNDLE_REVISION,
    bundleDigest: BUNDLE_DIGEST,
    writeEpoch: 8,
    committedAt: TERMINAL_AT,
    publicMutations: [{
      mutationKind: "create",
      targetPath: materialization.targetPath,
      documentRevision: materialization.documentRevision,
      payloadDigest: materialization.payloadDigest,
    }],
  });
  const retentionPolicy = policy();
  const retention = createShiftPlanningPublicEventOperationRetention({
    environment: "develop",
    controlledOperationKind: "repair",
    operationId: operation.operationId,
    operationIntentDigest: operation.operationIntentDigest,
    terminalAt: operation.committedAt,
    policy: retentionPolicy,
  });
  return {
    materialization,
    operation,
    retentionPolicy,
    retention,
    document: attachShiftPlanningControlledMutationMarker({
      materialization,
      operation,
    }),
  };
};

const producerInput = (value, changes = {}) => ({
  eventId: "firestore-event-1",
  eventTime: EVENT_TIME,
  targetPath: value.materialization.targetPath,
  before: null,
  after: value.document,
  operation: value.operation,
  retention: value.retention,
  policy: value.retentionPolicy,
  ...changes,
});

test("freezes the approved horizon and terminal retention binding", () => {
  const value = fixture();
  const expectedRetainUntil = TERMINAL_AT.toMillis() +
    HORIZON_MILLIS + SAFETY_MARGIN_MILLIS;

  assert.deepEqual(
    parseShiftPlanningPublicEventRetentionPolicy(value.retentionPolicy),
    value.retentionPolicy,
  );
  assert.deepEqual(
    parseShiftPlanningPublicEventOperationRetention(value.retention),
    value.retention,
  );
  assert.equal(value.retention.retainUntil.toMillis(), expectedRetainUntil);

  const tampered = structuredClone(value.retention);
  tampered.safetyMarginMillis += 1;
  assert.throws(
    () => parseShiftPlanningPublicEventOperationRetention(tampered),
    (error) => error.code === "invalid_planning_publication_contract",
  );
});

test("produces one stable audited no-op ledger for controlled replay", () => {
  const value = fixture();
  const first = produceShiftPlanningPublicEventAudit(producerInput(value));
  const replay = produceShiftPlanningPublicEventAudit(producerInput(value));

  assert.equal(first.kind, "controlledNoOp");
  assert.equal(first.alertRequired, false);
  assert.equal(first.legacySideEffectsAllowed, false);
  assert.equal(first.ledger.outcome, "controlledNoOp");
  assert.equal(first.ledger.eventDigest, first.decision.eventDigest);
  assert.deepEqual(first.ledger, replay.ledger);
  const newerPolicyReplay = produceShiftPlanningPublicEventAudit(producerInput(
    value,
    {
      policy: createShiftPlanningPublicEventRetentionPolicy({
        policyRevision: "public-events-v2",
        maximumDeliveryRetryHorizonMillis: HORIZON_MILLIS * 2,
        safetyMarginMillis: SAFETY_MARGIN_MILLIS,
      }),
    },
  ));
  assert.deepEqual(first.ledger, newerPolicyReplay.ledger);
  assert.deepEqual(
    parseShiftPlanningPublicEventLedger(first.ledger),
    first.ledger,
  );
});

test("cleanup retains terminals and ledgers through the exact boundary", () => {
  const value = fixture();
  const outcome = produceShiftPlanningPublicEventAudit(producerInput(value));
  assert.equal(outcome.kind, "controlledNoOp");

  const beforeExpiry = classifyShiftPlanningPublicEventEvidenceCleanup({
    currentTime: Timestamp.fromMillis(
      value.retention.retainUntil.toMillis() - 1,
    ),
    retention: value.retention,
    ledgers: [outcome.ledger],
  });
  const atExpiry = classifyShiftPlanningPublicEventEvidenceCleanup({
    currentTime: value.retention.retainUntil,
    retention: value.retention,
    ledgers: [outcome.ledger],
  });
  const afterExpiry = classifyShiftPlanningPublicEventEvidenceCleanup({
    currentTime: Timestamp.fromMillis(
      value.retention.retainUntil.toMillis() + 1,
    ),
    retention: value.retention,
    ledgers: [outcome.ledger],
  });

  assert.equal(beforeExpiry.kind, "retain");
  assert.equal(atExpiry.kind, "retain");
  assert.equal(afterExpiry.kind, "eligible");
  assert.deepEqual(beforeExpiry.protectedDigests, [
    value.retention.retentionDigest,
    outcome.ledger.ledgerDigest,
  ]);
  assert.deepEqual(beforeExpiry.protectedPaths, [
    "develop/plus-collections/shiftPlanningOperations/repair-operation-1",
    shiftPlanningPublicEventOperationRetentionPath({
      environment: "develop",
      operationId: "repair-operation-1",
    }),
    shiftPlanningPublicEventLedgerPath({
      environment: "develop",
      eventDigest: outcome.ledger.eventDigest,
    }),
  ]);
});

test("unknown changed authority is retained for one alert without effects", () => {
  const value = fixture();
  const input = producerInput(value, {
    operation: null,
    retention: null,
  });
  const first = produceShiftPlanningPublicEventAudit(input);
  const replay = produceShiftPlanningPublicEventAudit(input);

  assert.equal(first.kind, "failClosed");
  assert.equal(first.failureCode, "invalid_planning_publication_contract");
  assert.equal(first.alertRequired, true);
  assert.equal(first.legacySideEffectsAllowed, false);
  assert.equal(first.ledger.outcome, "rejected");
  assert.equal(first.ledger.alertRequired, true);
  assert.deepEqual(first.ledger, replay.ledger);
  assert.deepEqual(
    parseShiftPlanningPublicEventLedger(first.ledger),
    first.ledger,
  );
});

test("delayed delivery stays controlled only inside retained authority", () => {
  const value = fixture();
  const atBoundary = produceShiftPlanningPublicEventAudit(producerInput(value, {
    eventTime: value.retention.retainUntil,
  }));
  const afterBoundary = produceShiftPlanningPublicEventAudit(producerInput(
    value,
    {
      eventId: "firestore-event-after-retention",
      eventTime: Timestamp.fromMillis(
        value.retention.retainUntil.toMillis() + 1,
      ),
    },
  ));
  const ordinaryDocument = {
    ...value.document,
    assignedUserIds: ["member-3"],
    assignmentRevision: 2,
    documentRevision: 2,
    updatedAt: Timestamp.fromMillis(EVENT_TIME.toMillis() + 1),
  };
  const ordinary = produceShiftPlanningPublicEventAudit(producerInput(value, {
    eventId: "firestore-event-ordinary",
    before: value.document,
    after: ordinaryDocument,
  }));

  assert.equal(atBoundary.kind, "controlledNoOp");
  assert.equal(afterBoundary.kind, "failClosed");
  assert.equal(afterBoundary.alertRequired, true);
  assert.equal(ordinary.kind, "ordinary");
  assert.equal(ordinary.legacySideEffectsAllowed, true);
});
