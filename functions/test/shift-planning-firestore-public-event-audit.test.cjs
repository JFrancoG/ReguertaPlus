"use strict";

const assert = require("node:assert/strict");
const {after, before, beforeEach, test} = require("node:test");
const {Firestore, Timestamp} = require("@google-cloud/firestore");
const {createFirestoreShiftPlanningPublicEventAudit} =
  require("../lib/shift-planning-firestore-public-event-audit.js");
const {
  attachShiftPlanningControlledMutationMarker,
  createShiftPlanningControlledMutationOperationTerminal,
} = require("../lib/shift-planning-public-event-contract.js");
const {
  attachShiftPlanningBackendMutationMarker,
  buildShiftPlanningPublicShiftMaterialization,
  createShiftPlanningActivationOperationTerminal,
} = require("../lib/shift-planning-publication-contract.js");
const {
  createShiftPlanningPublicEventOperationRetention,
  createShiftPlanningPublicEventRetentionPolicy,
  produceShiftPlanningPublicEventAudit,
  shiftPlanningPublicEventLedgerPath,
  shiftPlanningPublicEventOperationRetentionPath,
} = require("../lib/shift-planning-public-event-retention.js");
const {parseShiftPlanningRecoveryOperationTerminal} =
  require("../lib/shift-planning-inverse-materializer.js");
const {createShiftPlanningDigest} = require("../lib/shift-planning-digest.js");

const PROJECT_ID = "demo-reguerta-hu083-public-event-audit";
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const emulatorTest = (name, fn) => test(name, {skip: !EMULATOR_HOST}, fn);
const root = "develop/plus-collections";
const digest = (value) => createShiftPlanningDigest({fixture: value});
const terminalAt = Timestamp.fromMillis(1_800_000_000_000);
const eventTime = Timestamp.fromMillis(terminalAt.toMillis() + 2_000);
const policy = (revision = "test-policy-1", horizon = 60_000) =>
  createShiftPlanningPublicEventRetentionPolicy({
    policyRevision: revision,
    maximumDeliveryRetryHorizonMillis: horizon,
    safetyMarginMillis: 1_000,
  });
const invalidContract = (error) =>
  error.code === "invalid_planning_publication_contract";
let firestore;

before(() => {
  if (EMULATOR_HOST) firestore = new Firestore({projectId: PROJECT_ID});
});
after(async () => {
  if (firestore) await firestore.terminate();
});
beforeEach(async () => {
  if (!EMULATOR_HOST) return;
  const response = await fetch(
    `http://${EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/` +
      "databases/(default)/documents",
    {method: "DELETE"},
  );
  assert.equal(response.ok, true, await response.text());
});

const fixture = (kind = "repair", mutationKind = "create") => {
  const materialization = buildShiftPlanningPublicShiftMaterialization({
    environment: "develop",
    attemptedAt: terminalAt,
    position: {
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
      planningRequestId: "preview-1",
      bundleRevision: "bundle-v2-1234567890abcdef12345678",
      bundleDigest: digest("bundle"),
      writeEpoch: 8,
    },
  });
  const shared = {
    operationId: kind === "activation" ? "request-preview-1" : `${kind}-1`,
    environment: "develop",
    bundleRevision: materialization.payload.bundleRevision,
    bundleDigest: materialization.payload.bundleDigest,
    writeEpoch: 8,
    publicMutations: [{
      mutationKind,
      targetPath: materialization.targetPath,
      documentRevision: materialization.documentRevision,
      payloadDigest: materialization.payloadDigest,
    }],
  };
  const operation = kind === "activation" ?
    createShiftPlanningActivationOperationTerminal({
      ...shared,
      requestId: "preview-1",
      candidateId: "bundle-candidate-1",
      attemptedAt: terminalAt,
      forwardManifestDigest: digest("forward"),
      expectedStateDigest: digest("state"),
      beforeImages: [],
    }) : createShiftPlanningControlledMutationOperationTerminal({
      ...shared, kind, committedAt: terminalAt,
    });
  const document = kind === "activation" ?
    attachShiftPlanningBackendMutationMarker({materialization, operation}) :
    attachShiftPlanningControlledMutationMarker({materialization, operation});
  const retention = createShiftPlanningPublicEventOperationRetention({
    environment: "develop",
    controlledOperationKind: kind,
    operationId: operation.operationId,
    operationIntentDigest: operation.operationIntentDigest,
    terminalAt,
    policy: policy(),
  });
  return {
    operation, retention, document,
    input: {
      eventId: "event-1", eventTime,
      targetPath: materialization.targetPath,
      before: null, after: document,
    },
  };
};

const seed = async (value) => {
  await firestore.doc(`${root}/shiftPlanningOperations/${value.operation.operationId}`)
    .create(value.operation);
  await firestore.doc(shiftPlanningPublicEventOperationRetentionPath({
    environment: "develop", operationId: value.retention.operationId,
  })).create(value.retention);
};
const ledgers = () => firestore.collection(`${root}/shiftPlanningPublicEventLedgers`)
  .where("recordKind", "==", "publicEventLedger").get();
const adapter = (configuredPolicy = policy()) =>
  createFirestoreShiftPlanningPublicEventAudit(firestore, configuredPolicy);

test("requires an explicit valid policy before accessing Firestore", () => {
  assert.throws(() => createFirestoreShiftPlanningPublicEventAudit(null, null), invalidContract);
});

for (const kind of ["activation", "repair", "syncCorrection"]) {
  emulatorTest(`${kind} delivery and concurrent replay create one controlled ledger`, async () => {
    const value = fixture(kind);
    await seed(value);
    const results = await Promise.all(Array.from({length: 5}, (_, index) =>
      adapter().audit({...value.input, eventId: `delivery-${index}`})));

    assert.equal(results.filter((item) => item.persistence === "created").length, 1);
    assert.equal(results.filter((item) => item.persistence === "replayed").length, 4);
    for (const result of results) {
      assert.equal(result.outcome.kind, "controlledNoOp");
      assert.equal(result.outcome.legacySideEffectsAllowed, false);
      assert.equal(result.outcome.alertRequired, false);
    }
    assert.equal((await ledgers()).size, 1);
    const replay = await adapter(policy("test-policy-2", 120_000)).audit(value.input);
    assert.equal(replay.persistence, "replayed");
    assert.deepEqual(replay.outcome.ledger, results[0].outcome.ledger);
  });
}

emulatorTest("ordinary edits retaining provenance do not create audit work", async () => {
  const value = fixture();
  const result = await adapter().audit({
    ...value.input,
    before: value.document,
    after: {
      ...value.document,
      assignedUserIds: ["member-3"],
      assignmentRevision: 2,
      documentRevision: 2,
      updatedAt: eventTime,
    },
  });
  assert.equal(result.outcome.kind, "ordinary");
  assert.equal(result.outcome.legacySideEffectsAllowed, true);
  assert.equal(result.persistence, "notRequired");
  assert.equal((await ledgers()).size, 0);
});

emulatorTest("missing authority persists rejection and preserves policy/time on replay", async () => {
  const value = fixture();
  const first = await adapter().audit(value.input);
  const replay = await adapter(policy("test-policy-2", 120_000)).audit(value.input);

  assert.equal(first.outcome.kind, "failClosed");
  assert.equal(first.outcome.alertRequired, true);
  assert.equal(first.outcome.legacySideEffectsAllowed, false);
  assert.equal(first.persistence, "created");
  assert.equal(replay.persistence, "replayed");
  assert.deepEqual(replay.outcome.ledger, first.outcome.ledger);
  assert.ok(replay.outcome.ledger.eventTime.isEqual(eventTime));
  assert.equal((await ledgers()).size, 1);
});

emulatorTest("a recorded rejection remains terminal when missing authority later appears", async () => {
  const value = fixture();
  const first = await adapter().audit(value.input);
  await seed(value);
  const replay = await adapter(policy("test-policy-2", 120_000)).audit(value.input);
  assert.equal(replay.outcome.kind, "failClosed");
  assert.equal(replay.persistence, "replayed");
  assert.deepEqual(replay.outcome.ledger, first.outcome.ledger);
  assert.equal((await ledgers()).size, 1);
});

emulatorTest("reusing a rejection event ID with a different event time is rejected", async () => {
  const value = fixture();
  await adapter().audit(value.input);
  await assert.rejects(adapter().audit({
    ...value.input, eventTime: Timestamp.fromMillis(eventTime.toMillis() + 1),
  }), invalidContract);
  assert.equal((await ledgers()).size, 1);
});

emulatorTest("invalid retained authority is rejected without ordinary effects", async () => {
  const value = fixture();
  await seed(value);
  await firestore.doc(shiftPlanningPublicEventOperationRetentionPath({
    environment: "develop", operationId: value.operation.operationId,
  })).update({safetyMarginMillis: 99});
  const result = await adapter().audit(value.input);
  assert.equal(result.outcome.kind, "failClosed");
  assert.equal(result.outcome.legacySideEffectsAllowed, false);
  assert.equal((await ledgers()).size, 1);
});

emulatorTest("a corrupted ledger is never overwritten as a successful replay", async () => {
  const value = fixture();
  await seed(value);
  const first = await adapter().audit(value.input);
  const reference = firestore.doc(shiftPlanningPublicEventLedgerPath({
    environment: "develop", eventDigest: first.outcome.ledger.eventDigest,
  }));
  await reference.update({ledgerDigest: digest("tampered")});
  await assert.rejects(adapter().audit(value.input), invalidContract);
  assert.equal((await reference.get()).get("ledgerDigest"), digest("tampered"));
});

emulatorTest("SDK read failure propagates without creating a rejection ledger", async () => {
  const unavailable = Object.assign(new Error("injected unavailable read"), {code: 14});
  const failingReadFirestore = {
    doc: (path) => firestore.doc(path),
    runTransaction: (update) => firestore.runTransaction((transaction) => update({
      get: async () => { throw unavailable; },
      create: (...args) => transaction.create(...args),
    }), {maxAttempts: 1}),
  };
  const failingAdapter = createFirestoreShiftPlanningPublicEventAudit(failingReadFirestore, policy());
  await assert.rejects(failingAdapter.audit(fixture().input), (error) => error === unavailable);
  assert.equal((await ledgers()).size, 0);
  const retry = await adapter().audit(fixture().input);
  assert.equal(retry.persistence, "created");
});

const recovery = (activation, restoredPath, deletedPath = `${root}/shifts/shift_delivery_20260909`) => {
  const recoveredAt = Timestamp.fromMillis(terminalAt.toMillis() + 1_000);
  const restoredPaths = [
    `${root}/shiftPlanningState/current`,
    `${root}/shiftRotations/delivery`,
    `${root}/shiftRotations/market`,
    ...(restoredPath ? [restoredPath] : []),
  ];
  const record = {
    schemaVersion: 1, operationKind: "activationRecovery", state: "committed",
    operationId: activation.operationId, recoveryOperationId: "recovery-1",
    environment: "develop", requestId: "preview-1",
    bundleRevision: activation.bundleRevision, bundleDigest: activation.bundleDigest,
    forwardManifestDigest: activation.forwardManifestDigest,
    inverseManifestDigest: digest("inverse"),
    activationOperationIntentDigest: activation.operationIntentDigest,
    expectedStateDigest: activation.expectedStateDigest,
    activationWriteEpoch: 8, recoveryWriteEpoch: 9, recoveredAt,
    restoreActiveLineage: {revision: null, digest: null},
    deletedPaths: [deletedPath],
    restoredBeforeImages: restoredPaths.map((targetPath, index) => ({
      ordinal: index + 1, targetPath,
      envelopePath: `${root}/shiftPlanningOperations/${activation.operationId}/beforeImages/${index + 1}`,
      envelopeDigest: digest(targetPath),
    })),
  };
  return parseShiftPlanningRecoveryOperationTerminal({
    ...record,
    recoveryIntentDigest: createShiftPlanningDigest({
      ...record,
      recoveredAt: {seconds: recoveredAt.seconds, nanoseconds: recoveredAt.nanoseconds},
    }),
  });
};

emulatorTest("unsupported recovery UPDATE cannot masquerade as the restored old operation", async () => {
  const old = fixture("repair", "update");
  const activated = fixture("activation");
  await seed(old);
  const recovered = recovery(activated.operation, old.input.targetPath);
  await firestore.doc(`${root}/shiftPlanningOperations/${activated.operation.operationId}`)
    .create(recovered);
  const input = {...old.input, before: activated.document};
  const oldAuthorityDecision = produceShiftPlanningPublicEventAudit({
    ...input, operation: old.operation, retention: old.retention, policy: policy(),
  });
  assert.equal(oldAuthorityDecision.kind, "controlledNoOp");

  const result = await adapter().audit(input);
  assert.equal(result.outcome.kind, "failClosed");
  assert.equal(result.outcome.legacySideEffectsAllowed, false);
  assert.equal(result.outcome.alertRequired, true);
  assert.equal((await ledgers()).size, 1);
});

for (const authorityChange of ["missing", "recovered"]) {
  emulatorTest(`controlled replay preserves its decision after authority becomes ${authorityChange}`, async () => {
    const value = fixture("activation");
    await seed(value);
    const first = await adapter().audit(value.input);
    const operation = firestore.doc(`${root}/shiftPlanningOperations/${value.operation.operationId}`);
    if (authorityChange === "missing") {
      await operation.delete();
    } else {
      await operation.set(recovery(value.operation, value.input.targetPath));
    }
    await firestore.doc(shiftPlanningPublicEventOperationRetentionPath({
      environment: "develop", operationId: value.operation.operationId,
    })).delete();

    const replay = await adapter(policy("test-policy-2", 120_000)).audit(value.input);
    assert.equal(replay.outcome.kind, "controlledNoOp");
    assert.equal(replay.persistence, "replayed");
    assert.deepEqual(replay.outcome.ledger, first.outcome.ledger);
    assert.equal((await ledgers()).size, 1);
  });
}

for (const authority of [null, {operationKind: "unknown"}, {operationKind: "activation"}]) {
  emulatorTest(`marked delete with ${JSON.stringify(authority)} authority is never ordinary`, async () => {
    const value = fixture("activation");
    if (authority) {
      await firestore.doc(`${root}/shiftPlanningOperations/${value.operation.operationId}`)
        .create(authority);
    }
    const result = await adapter().audit({...value.input, before: value.document, after: null});
    assert.equal(result.outcome.kind, "failClosed");
    assert.equal(result.outcome.alertRequired, true);
    assert.equal(result.outcome.legacySideEffectsAllowed, false);
    assert.equal((await ledgers()).size, 1);
  });
}

emulatorTest("a valid historical activation proves a later ordinary delete", async () => {
  const value = fixture("activation");
  await seed(value);
  const result = await adapter().audit({
    ...value.input,
    before: {...value.document, helperUserId: "member-9"},
    after: null,
  });
  assert.equal(result.outcome.kind, "ordinary");
  assert.equal(result.persistence, "notRequired");
  assert.equal((await ledgers()).size, 0);
});

emulatorTest("ordinary delete requires the event path and exact marker operation lineage", async () => {
  const value = fixture("activation");
  await seed(value);
  const mismatches = [
    {targetPath: `${root}/shifts/shift_delivery_20260909`},
    {marker: {bundleRevision: "different-revision"}},
    {marker: {bundleDigest: digest("different-bundle")}},
    {marker: {writeEpoch: 9}},
  ];
  for (const [index, mismatch] of mismatches.entries()) {
    const result = await adapter().audit({
      ...value.input,
      eventId: `mismatch-${index}`,
      targetPath: mismatch.targetPath ?? value.input.targetPath,
      before: {
        ...value.document,
        lastBackendMutation: {...value.document.lastBackendMutation, ...mismatch.marker},
      },
      after: null,
    });
    assert.equal(result.outcome.kind, "failClosed");
    assert.equal(result.outcome.legacySideEffectsAllowed, false);
  }
  assert.equal((await ledgers()).size, mismatches.length);
});

emulatorTest("recovery delete replays while retained and rejects safely if its registry is lost", async () => {
  const value = fixture("activation");
  const recovered = recovery(value.operation, null, value.input.targetPath);
  const reference = firestore.doc(`${root}/shiftPlanningOperations/${value.operation.operationId}`);
  await reference.create(recovered);
  await firestore.doc(shiftPlanningPublicEventOperationRetentionPath({
    environment: "develop", operationId: recovered.recoveryOperationId,
  })).create(createShiftPlanningPublicEventOperationRetention({
    environment: "develop", controlledOperationKind: "recovery",
    operationId: recovered.recoveryOperationId,
    operationIntentDigest: recovered.recoveryIntentDigest,
    terminalAt: recovered.recoveredAt, policy: policy(),
  }));
  const input = {...value.input, before: value.document, after: null};
  const first = await adapter().audit(input);
  const replay = await adapter(policy("test-policy-2", 120_000)).audit(input);
  assert.equal(first.outcome.kind, "controlledNoOp");
  assert.equal(replay.persistence, "replayed");
  assert.deepEqual(replay.outcome.ledger, first.outcome.ledger);

  await reference.delete();
  const rejected = await adapter().audit(input);
  assert.equal(rejected.outcome.kind, "failClosed");
  assert.equal(rejected.outcome.alertRequired, true);
  assert.equal(rejected.outcome.legacySideEffectsAllowed, false);
  assert.equal((await ledgers()).size, 2, "Missing recovery identity creates a separate safe rejection");
});

emulatorTest("controlled replay cannot approve a payload changed under the old marker", async () => {
  const value = fixture();
  await seed(value);
  await adapter().audit(value.input);
  await assert.rejects(adapter().audit({
    ...value.input, after: {...value.document, helperUserId: "member-9"},
  }), invalidContract);
  assert.equal((await ledgers()).size, 1);
});
