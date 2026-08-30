"use strict";

const assert = require("node:assert/strict");
const {test} = require("node:test");
const {Timestamp} = require("@google-cloud/firestore");

const {
  attachShiftPlanningControlledMutationMarker,
  classifyShiftPlanningPublicWriteEvent,
  createShiftPlanningControlledMutationOperationTerminal,
} = require("../lib/shift-planning-public-event-contract.js");
const {
  attachShiftPlanningBackendMutationMarker,
  buildShiftPlanningPublicShiftMaterialization,
  createShiftPlanningActivationOperationTerminal,
  createShiftPlanningBeforeImageEnvelope,
  createShiftPlanningPublicShiftMaterialization,
} = require("../lib/shift-planning-publication-contract.js");
const {
  createShiftPlanningDigest,
} = require("../lib/shift-planning-digest.js");

const digest = (character) =>
  `shift-planning:v1:sha256:${character.repeat(64)}`;

const BUNDLE_REVISION = "bundle-v2-1234567890abcdef12345678";
const BUNDLE_DIGEST = digest("a");
const FORWARD_MANIFEST_DIGEST = digest("b");
const INVERSE_MANIFEST_DIGEST = digest("c");
const EXPECTED_STATE_DIGEST = digest("d");
const CAPTURE_CONTRACT_DIGEST = digest("e");
const ATTEMPTED_AT = new Timestamp(1_788_307_200, 123_000_000);
const ACTIVATION_OPERATION_ID = "request-preview-request-1";

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

const materialization = () => buildShiftPlanningPublicShiftMaterialization({
  environment: "develop",
  position: position(),
  attemptedAt: ATTEMPTED_AT,
});

const mutationBinding = (value, mutationKind) => ({
  mutationKind,
  targetPath: value.targetPath,
  documentRevision: value.documentRevision,
  payloadDigest: value.payloadDigest,
});

const activationTerminal = (value, mutationKind, beforeImages = []) =>
  createShiftPlanningActivationOperationTerminal({
    operationId: ACTIVATION_OPERATION_ID,
    environment: "develop",
    requestId: "preview-request-1",
    candidateId: "bundle-candidate-1",
    bundleRevision: BUNDLE_REVISION,
    bundleDigest: BUNDLE_DIGEST,
    forwardManifestDigest: FORWARD_MANIFEST_DIGEST,
    expectedStateDigest: EXPECTED_STATE_DIGEST,
    writeEpoch: 8,
    attemptedAt: ATTEMPTED_AT,
    publicMutations: [mutationBinding(value, mutationKind)],
    beforeImages: beforeImages.map((item) => ({
      ordinal: item.ordinal,
      targetPath: item.targetPath,
      envelopePath: item.envelopePath,
      envelopeDigest: item.envelopeDigest,
    })),
  });

const markedActivationCreate = () => {
  const value = materialization();
  const operation = activationTerminal(value, "create");
  return {
    value,
    operation,
    document: attachShiftPlanningBackendMutationMarker({
      materialization: value,
      operation,
    }),
  };
};

const changedMaterialization = (document, changes) => {
  const {lastBackendMutation: _marker, ...payload} = document;
  return createShiftPlanningPublicShiftMaterialization({
    targetPath: materialization().targetPath,
    payload: {...payload, ...changes},
  });
};

const controlledTerminal = (kind, value, mutationKind) =>
  createShiftPlanningControlledMutationOperationTerminal({
    kind,
    operationId: `${kind}-operation-1`,
    environment: "develop",
    bundleRevision: BUNDLE_REVISION,
    bundleDigest: BUNDLE_DIGEST,
    writeEpoch: 8,
    committedAt: ATTEMPTED_AT,
    publicMutations: [mutationBinding(value, mutationKind)],
  });

const recoveryTerminal = (activation, targetPath) => {
  const recoveredAt = new Timestamp(1_788_307_300, 0);
  const withoutDigest = {
    schemaVersion: 1,
    operationKind: "activationRecovery",
    state: "committed",
    operationId: ACTIVATION_OPERATION_ID,
    recoveryOperationId: "recovery-operation-1",
    environment: "develop",
    requestId: "preview-request-1",
    bundleRevision: BUNDLE_REVISION,
    bundleDigest: BUNDLE_DIGEST,
    forwardManifestDigest: FORWARD_MANIFEST_DIGEST,
    inverseManifestDigest: INVERSE_MANIFEST_DIGEST,
    activationOperationIntentDigest: activation.operationIntentDigest,
    expectedStateDigest: EXPECTED_STATE_DIGEST,
    activationWriteEpoch: 8,
    recoveryWriteEpoch: 9,
    recoveredAt,
    restoreActiveLineage: {revision: null, digest: null},
    deletedPaths: [targetPath],
    restoredBeforeImages: [
      {
        ordinal: 1,
        targetPath: "develop/plus-collections/shiftPlanningState/current",
        envelopePath: "develop/plus-collections/shiftPlanningOperations/" +
          `${ACTIVATION_OPERATION_ID}/beforeImages/1`,
        envelopeDigest: digest("f"),
      },
      {
        ordinal: 2,
        targetPath: "develop/plus-collections/shiftRotations/delivery",
        envelopePath: "develop/plus-collections/shiftPlanningOperations/" +
          `${ACTIVATION_OPERATION_ID}/beforeImages/2`,
        envelopeDigest: digest("1"),
      },
      {
        ordinal: 3,
        targetPath: "develop/plus-collections/shiftRotations/market",
        envelopePath: "develop/plus-collections/shiftPlanningOperations/" +
          `${ACTIVATION_OPERATION_ID}/beforeImages/3`,
        envelopeDigest: digest("2"),
      },
    ],
  };
  return {
    ...withoutDigest,
    recoveryIntentDigest: createShiftPlanningDigest({
      ...withoutDigest,
      recoveredAt: {
        seconds: recoveredAt.seconds,
        nanoseconds: recoveredAt.nanoseconds,
      },
    }),
  };
};

const consumeWithFake = (state, decision) => {
  if (decision.kind === "controlledNoOp") {
    state.auditedNoOps.add(decision.eventDigest);
    return;
  }
  state.legacySideEffects += 1;
};

test("audits activation creates and updates as idempotent no-ops", () => {
  const created = markedActivationCreate();
  const createDecision = classifyShiftPlanningPublicWriteEvent({
    targetPath: created.value.targetPath,
    before: null,
    after: created.document,
    operation: created.operation,
  });
  assert.equal(createDecision.kind, "controlledNoOp");
  assert.equal(createDecision.operationKind, "activation");
  assert.equal(createDecision.mutationKind, "create");

  const beforeImage = createShiftPlanningBeforeImageEnvelope({
    operationId: ACTIVATION_OPERATION_ID,
    environment: "develop",
    bundleRevision: BUNDLE_REVISION,
    bundleDigest: BUNDLE_DIGEST,
    forwardManifestDigest: FORWARD_MANIFEST_DIGEST,
    writeEpoch: 8,
    ordinal: 1,
    targetPath: created.value.targetPath,
    targetUpdateTime: new Timestamp(1_788_307_199, 0),
    captureContractDigest: CAPTURE_CONTRACT_DIGEST,
    document: created.document,
  });
  const updated = changedMaterialization(created.document, {
    assignedUserIds: ["member-3"],
    helperUserId: "member-4",
    assignmentRevision: 2,
    documentRevision: 2,
    updatedAt: new Timestamp(1_788_307_250, 0),
  });
  const updateOperation = activationTerminal(updated, "update", [beforeImage]);
  const updateDocument = attachShiftPlanningBackendMutationMarker({
    materialization: updated,
    operation: updateOperation,
  });
  const updateDecision = classifyShiftPlanningPublicWriteEvent({
    targetPath: updated.targetPath,
    before: created.document,
    after: updateDocument,
    operation: updateOperation,
  });
  assert.equal(updateDecision.kind, "controlledNoOp");
  assert.equal(updateDecision.mutationKind, "update");

  const fake = {auditedNoOps: new Set(), legacySideEffects: 0};
  consumeWithFake(fake, createDecision);
  consumeWithFake(fake, createDecision);
  consumeWithFake(fake, updateDecision);
  assert.equal(fake.auditedNoOps.size, 2);
  assert.equal(fake.legacySideEffects, 0);
});

test("idempotent consumer audits repair and sync correction once", () => {
  const fake = {auditedNoOps: new Set(), legacySideEffects: 0};
  for (const kind of ["repair", "syncCorrection"]) {
    const base = markedActivationCreate();
    const value = changedMaterialization(base.document, {
      assignedUserIds: [kind === "repair" ? "member-5" : "member-6"],
      assignmentRevision: 2,
      documentRevision: 2,
      updatedAt: new Timestamp(1_788_307_260, 0),
    });
    const operation = controlledTerminal(kind, value, "update");
    const after = attachShiftPlanningControlledMutationMarker({
      materialization: value,
      operation,
    });
    const decision = classifyShiftPlanningPublicWriteEvent({
      targetPath: value.targetPath,
      before: base.document,
      after,
      operation,
    });
    assert.equal(decision.kind, "controlledNoOp");
    assert.equal(decision.operationKind, kind);
    assert.equal(decision.operationId, operation.operationId);
    consumeWithFake(fake, decision);
    consumeWithFake(fake, decision);
  }
  assert.equal(fake.auditedNoOps.size, 2);
  assert.equal(fake.legacySideEffects, 0);
});

test("retained historical markers keep later edits and deletes ordinary", () => {
  const base = markedActivationCreate();
  const ordinaryEdit = {
    ...base.document,
    assignedUserIds: ["member-7"],
    assignmentRevision: 2,
    documentRevision: 2,
    updatedAt: new Timestamp(1_788_307_270, 0),
  };
  const updateDecision = classifyShiftPlanningPublicWriteEvent({
    targetPath: base.value.targetPath,
    before: base.document,
    after: ordinaryEdit,
    operation: base.operation,
  });
  const deleteDecision = classifyShiftPlanningPublicWriteEvent({
    targetPath: base.value.targetPath,
    before: ordinaryEdit,
    after: null,
    operation: null,
  });
  const fake = {auditedNoOps: new Set(), legacySideEffects: 0};
  consumeWithFake(fake, updateDecision);
  consumeWithFake(fake, deleteDecision);
  assert.equal(updateDecision.kind, "ordinary");
  assert.equal(deleteDecision.kind, "ordinary");
  assert.equal(fake.legacySideEffects, 2);
});

test("idempotent consumer audits an exact recovery delete once", () => {
  const base = markedActivationCreate();
  const recovery = recoveryTerminal(base.operation, base.value.targetPath);
  const decision = classifyShiftPlanningPublicWriteEvent({
    targetPath: base.value.targetPath,
    before: base.document,
    after: null,
    operation: recovery,
  });
  assert.equal(decision.kind, "controlledNoOp");
  assert.equal(decision.operationKind, "recovery");
  assert.equal(decision.mutationKind, "delete");
  assert.equal(decision.operationId, recovery.recoveryOperationId);
  const fake = {auditedNoOps: new Set(), legacySideEffects: 0};
  consumeWithFake(fake, decision);
  consumeWithFake(fake, decision);
  assert.equal(fake.auditedNoOps.size, 1);
  assert.equal(fake.legacySideEffects, 0);

  const drifted = structuredClone(base.document);
  drifted.documentRevision += 1;
  assert.throws(
    () => classifyShiftPlanningPublicWriteEvent({
      targetPath: base.value.targetPath,
      before: drifted,
      after: null,
      operation: recovery,
    }),
    (error) => error.code === "invalid_planning_publication_contract",
  );
});

test("fails closed for missing or forged changed-marker authority", () => {
  const base = markedActivationCreate();
  assert.throws(
    () => classifyShiftPlanningPublicWriteEvent({
      targetPath: base.value.targetPath,
      before: null,
      after: base.document,
      operation: null,
    }),
    (error) => error.code === "invalid_planning_publication_contract",
  );

  const forgedOperation = structuredClone(base.operation);
  forgedOperation.publicMutations[0].payloadDigest = digest("9");
  assert.throws(
    () => classifyShiftPlanningPublicWriteEvent({
      targetPath: base.value.targetPath,
      before: null,
      after: base.document,
      operation: forgedOperation,
    }),
    (error) => error.code === "invalid_planning_publication_contract",
  );

  const {lastBackendMutation: _marker, ...withoutMarker} = base.document;
  assert.throws(
    () => classifyShiftPlanningPublicWriteEvent({
      targetPath: base.value.targetPath,
      before: base.document,
      after: withoutMarker,
      operation: null,
    }),
    (error) => error.code === "invalid_planning_publication_contract",
  );
});
