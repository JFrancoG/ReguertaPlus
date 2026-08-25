"use strict";

const assert = require("node:assert/strict");
const {test} = require("node:test");
const {
  FieldValue,
  GeoPoint,
  Timestamp,
} = require("@google-cloud/firestore");

const {
  attachShiftPlanningBackendMutationMarker,
  buildShiftPlanningPublicShiftMaterialization,
  createShiftPlanningActivationOperationTerminal,
  createShiftPlanningBeforeImageEnvelope,
  createShiftPlanningPublicShiftMaterialization,
  decodeShiftPlanningFirestoreDocument,
  parseShiftPlanningActivationOperationTerminal,
  parseShiftPlanningBeforeImageEnvelope,
  parseShiftPlanningPublicShiftDocument,
} = require("../lib/shift-planning-publication-contract.js");

const digest = (character) =>
  `shift-planning:v1:sha256:${character.repeat(64)}`;

const BUNDLE_DIGEST = digest("a");
const FORWARD_MANIFEST_DIGEST = digest("b");
const EXPECTED_STATE_DIGEST = digest("c");
const CAPTURE_CONTRACT_DIGEST = digest("d");
const ATTEMPTED_AT = new Timestamp(1_788_307_200, 123_000_000);

const deliveryPosition = () => ({
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
  bundleRevision: "bundle-v2-1234567890abcdef12345678",
  bundleDigest: BUNDLE_DIGEST,
  writeEpoch: 8,
});

const marketPosition = () => ({
  ...deliveryPosition(),
  positionId: "shift_market_20260919",
  type: "market",
  shiftId: "shift_market_20260919",
  scheduledDate: "2026-09-19",
  rotationOwnerUserIds: ["member-1", "member-2", "member-3"],
  assignedUserIds: ["member-1", "member-2", "member-3"],
  rotationPositions: [
    {
      rotationOwnerUserId: "member-1",
      effectiveAssigneeUserId: "member-1",
      roundNumber: 1,
      positionInRound: 1,
      planningReason: "target",
    },
    {
      rotationOwnerUserId: "member-2",
      effectiveAssigneeUserId: "member-2",
      roundNumber: 1,
      positionInRound: 2,
      planningReason: "target",
    },
    {
      rotationOwnerUserId: "member-3",
      effectiveAssigneeUserId: "member-3",
      roundNumber: 1,
      positionInRound: 3,
      planningReason: "target",
    },
  ],
  helperUserId: null,
});

const materialization = (position = deliveryPosition()) =>
  buildShiftPlanningPublicShiftMaterialization({
    environment: "develop",
    position,
    attemptedAt: ATTEMPTED_AT,
  });

const terminal = (publicMutations, beforeImages = []) =>
  createShiftPlanningActivationOperationTerminal({
    operationId: "activate-operation-1",
    environment: "develop",
    requestId: "activate-request-1",
    candidateId: "bundle-candidate-1",
    bundleRevision: "bundle-v2-1234567890abcdef12345678",
    bundleDigest: BUNDLE_DIGEST,
    forwardManifestDigest: FORWARD_MANIFEST_DIGEST,
    expectedStateDigest: EXPECTED_STATE_DIGEST,
    writeEpoch: 8,
    attemptedAt: ATTEMPTED_AT,
    publicMutations: publicMutations.map((item) => ({
      mutationKind: item.documentRevision === 1 ? "create" : "update",
      targetPath: item.targetPath,
      documentRevision: item.documentRevision,
      payloadDigest: item.payloadDigest,
    })),
    beforeImages: beforeImages.map((item) => ({
      ordinal: item.ordinal,
      targetPath: item.targetPath,
      envelopePath: item.envelopePath,
      envelopeDigest: item.envelopeDigest,
    })),
  });

test("builds exact client-compatible delivery and market payloads", () => {
  const delivery = materialization();
  const market = materialization(marketPosition());

  assert.equal(delivery.targetPath,
    "develop/plus-collections/shifts/shift_delivery_20260902");
  assert.equal(delivery.payload.type, "delivery");
  assert.equal(delivery.payload.source, "app");
  assert.equal(delivery.payload.status, "planned");
  assert.deepEqual(delivery.payload.assignedUserIds, ["member-1"]);
  assert.equal(delivery.payload.helperUserId, "member-2");
  assert.equal(delivery.payload.date.toMillis(),
    Date.parse("2026-09-02T00:00:00.000Z"));
  assert.equal(delivery.payload.rotationOwnerUserId, "member-1");
  assert.equal(delivery.payload.rotationOwnerUserIds, null);
  assert.equal(delivery.payload.assignmentRevision, 1);
  assert.deepEqual(delivery.payload.completion, {
    state: "uncompleted",
    revision: 0,
    actualHelperUserId: null,
    helperSourceAssignmentRevision: null,
    completedAt: null,
  });

  assert.equal(market.payload.type, "market");
  assert.deepEqual(market.payload.assignedUserIds,
    ["member-1", "member-2", "member-3"]);
  assert.equal(market.payload.helperUserId, null);
  assert.equal(market.payload.rotationOwnerUserId, null);
  assert.deepEqual(market.payload.rotationOwnerUserIds,
    ["member-1", "member-2", "member-3"]);
  assert.equal(market.payload.roundNumber, null);
  assert.equal(market.payload.positionInRound, null);
  assert.equal(market.payload.planningReason, null);
  assert.equal(market.payload.rotationPositions.length, 3);
});

test("binds every public marker to its exact payload and operation", () => {
  const delivery = materialization();
  const operation = terminal([delivery]);
  const document = attachShiftPlanningBackendMutationMarker({
    materialization: delivery,
    operation,
  });
  const parsed = parseShiftPlanningPublicShiftDocument({
    targetPath: delivery.targetPath,
    value: document,
    expectedOperationIntentDigest: operation.operationIntentDigest,
  });

  assert.equal(parsed.lastBackendMutation.kind, "activation");
  assert.equal(parsed.lastBackendMutation.operationId, operation.operationId);
  assert.equal(parsed.lastBackendMutation.payloadDigest,
    delivery.payloadDigest);
  assert.equal(parsed.lastBackendMutation.targetPath, delivery.targetPath);

  const tampered = structuredClone(document);
  tampered.assignedUserIds = ["member-9"];
  assert.throws(
    () => parseShiftPlanningPublicShiftDocument({
      targetPath: delivery.targetPath,
      value: tampered,
      expectedOperationIntentDigest: operation.operationIntentDigest,
    }),
    (error) => error.code === "invalid_planning_publication_contract",
  );

  const ordinaryEdit = {
    ...document,
    assignedUserIds: ["member-9"],
    assignmentRevision: 2,
    documentRevision: 2,
    updatedAt: new Timestamp(1_788_307_201, 0),
  };
  assert.equal(
    parseShiftPlanningPublicShiftDocument({
      targetPath: delivery.targetPath,
      value: ordinaryEdit,
    }).assignmentRevision,
    2,
  );
  assert.throws(
    () => parseShiftPlanningPublicShiftDocument({
      targetPath: delivery.targetPath,
      value: ordinaryEdit,
      expectedOperationIntentDigest: operation.operationIntentDigest,
    }),
    (error) => error.code === "invalid_planning_publication_contract",
  );
});

test("parses completed delivery state and rejects incoherent completion", () => {
  const delivery = materialization();
  const completedMaterialization =
    createShiftPlanningPublicShiftMaterialization({
      targetPath: delivery.targetPath,
      payload: {
        ...delivery.payload,
        completion: {
          state: "completed",
          revision: 1,
          actualHelperUserId: "member-2",
          helperSourceAssignmentRevision: 1,
          completedAt: new Timestamp(1_790_000_000, 0),
        },
        documentRevision: 1,
        updatedAt: new Timestamp(1_790_000_000, 0),
      },
    });
  const operation = terminal([completedMaterialization]);
  const document = attachShiftPlanningBackendMutationMarker({
    materialization: completedMaterialization,
    operation,
  });
  const parsed = parseShiftPlanningPublicShiftDocument({
    targetPath: delivery.targetPath,
    value: document,
    expectedOperationIntentDigest: operation.operationIntentDigest,
  });
  assert.equal(parsed.completion.state, "completed");
  assert.equal(parsed.completion.actualHelperUserId, "member-2");

  const incoherent = {
    ...document,
    completion: {
      ...document.completion,
      helperSourceAssignmentRevision: 2,
    },
  };
  assert.throws(
    () => createShiftPlanningPublicShiftMaterialization({
      targetPath: delivery.targetPath,
      payload: Object.fromEntries(
        Object.entries(incoherent).filter(
          ([key]) => key !== "lastBackendMutation",
        ),
      ),
    }),
    (error) => error.code === "invalid_planning_publication_contract",
  );

});

test("round-trips exact Firestore before-image values", () => {
  const before = {
    schemaVersion: 2,
    updatedAt: new Timestamp(1_700_000_000, 987_654_321),
    payload: {
      enabled: true,
      bytes: Buffer.from([0, 1, 2, 255]),
      point: new GeoPoint(37.1773, -3.5986),
      values: [null, "value", 3.5],
    },
  };
  const envelope = createShiftPlanningBeforeImageEnvelope({
    operationId: "activate-operation-1",
    environment: "develop",
    bundleRevision: "bundle-v2-1234567890abcdef12345678",
    bundleDigest: BUNDLE_DIGEST,
    forwardManifestDigest: FORWARD_MANIFEST_DIGEST,
    writeEpoch: 8,
    ordinal: 1,
    targetPath: "develop/plus-collections/shiftRotations/delivery",
    targetUpdateTime: new Timestamp(1_700_000_001, 123_000_000),
    captureContractDigest: CAPTURE_CONTRACT_DIGEST,
    document: before,
  });
  const parsed = parseShiftPlanningBeforeImageEnvelope(envelope);
  const decoded = decodeShiftPlanningFirestoreDocument(parsed.payload);

  assert.equal(parsed.envelopePath,
    "develop/plus-collections/shiftPlanningOperations/" +
      "activate-operation-1/beforeImages/1");
  assert.equal(decoded.updatedAt.isEqual(before.updatedAt), true);
  assert.equal(Buffer.from(decoded.payload.bytes).equals(before.payload.bytes),
    true);
  assert.equal(decoded.payload.point.latitude, 37.1773);
  assert.deepEqual(decoded.payload.values, [null, "value", 3.5]);
});

test("fails closed for tampered or unsupported before-images", () => {
  const base = {
    operationId: "activate-operation-1",
    environment: "develop",
    bundleRevision: "bundle-v2-1234567890abcdef12345678",
    bundleDigest: BUNDLE_DIGEST,
    forwardManifestDigest: FORWARD_MANIFEST_DIGEST,
    writeEpoch: 8,
    ordinal: 1,
    targetPath: "develop/plus-collections/shiftRotations/delivery",
    targetUpdateTime: new Timestamp(1_700_000_001, 0),
    captureContractDigest: CAPTURE_CONTRACT_DIGEST,
  };
  const envelope = createShiftPlanningBeforeImageEnvelope({
    ...base,
    document: {stateRevision: 1},
  });
  envelope.payload.fields[0].value.value = 2;
  assert.throws(
    () => parseShiftPlanningBeforeImageEnvelope(envelope),
    (error) => error.code === "invalid_planning_publication_contract",
  );

  assert.throws(
    () => createShiftPlanningBeforeImageEnvelope({
      ...base,
      document: {updatedAt: FieldValue.serverTimestamp()},
    }),
    (error) => error.code === "invalid_planning_publication_contract",
  );

  const hiddenExtra = {stateRevision: 1};
  Object.defineProperty(hiddenExtra, "hidden", {
    enumerable: false,
    value: "must not be discarded",
  });
  assert.throws(
    () => createShiftPlanningBeforeImageEnvelope({
      ...base,
      document: hiddenExtra,
    }),
    (error) => error.code === "invalid_planning_publication_contract",
  );
});

test("freezes an exact activation terminal and rejects registry drift", () => {
  const delivery = materialization();
  const market = materialization(marketPosition());
  const beforeImage = createShiftPlanningBeforeImageEnvelope({
    operationId: "activate-operation-1",
    environment: "develop",
    bundleRevision: "bundle-v2-1234567890abcdef12345678",
    bundleDigest: BUNDLE_DIGEST,
    forwardManifestDigest: FORWARD_MANIFEST_DIGEST,
    writeEpoch: 8,
    ordinal: 1,
    targetPath: "develop/plus-collections/shiftRotations/delivery",
    targetUpdateTime: new Timestamp(1_700_000_001, 0),
    captureContractDigest: CAPTURE_CONTRACT_DIGEST,
    document: {stateRevision: 1},
  });
  const operation = terminal([market, delivery], [beforeImage]);
  const parsed = parseShiftPlanningActivationOperationTerminal(operation);

  assert.equal(parsed.state, "committed");
  assert.deepEqual(
    parsed.publicMutations.map((item) => item.targetPath),
    [delivery.targetPath, market.targetPath],
  );
  assert.equal(parsed.beforeImages[0].envelopeDigest,
    beforeImage.envelopeDigest);

  const tampered = structuredClone(operation);
  tampered.publicMutations[0].payloadDigest = digest("e");
  assert.throws(
    () => parseShiftPlanningActivationOperationTerminal(tampered),
    (error) => error.code === "invalid_planning_publication_contract",
  );

  assert.throws(
    () => terminal([{
      ...delivery,
      documentRevision: 2,
    }]),
    (error) => error.code === "invalid_planning_publication_contract",
  );
});
