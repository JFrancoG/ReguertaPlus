"use strict";

const assert = require("node:assert/strict");
const {test} = require("node:test");
const {
  Firestore,
  Timestamp,
} = require("@google-cloud/firestore");

const {
  planShiftPlanningBundle,
} = require("../lib/shift-planning-bundle.js");
const {
  buildShiftPlanningCandidatePositionSet,
  persistShiftPlanningCandidatePosition,
} = require("../lib/shift-planning-candidate.js");
const {
  createShiftPlanningDigest,
} = require("../lib/shift-planning-digest.js");
const {
  buildShiftPlanningCompletedSummary,
} = require("../lib/shift-planning-persistence.js");
const {
  materializeShiftPlanningForwardActivation,
  applyShiftPlanningForwardActivationAttempt,
} = require("../lib/shift-planning-forward-materializer.js");
const {
  attachShiftPlanningBackendMutationMarker,
  buildShiftPlanningPublicShiftMaterialization,
  createShiftPlanningActivationOperationTerminal,
  createShiftPlanningPublicShiftMaterialization,
} = require("../lib/shift-planning-publication-contract.js");
const {
  SHIFT_PLANNING_FIRESTORE_ADMISSION_REVISION,
} = require(
  "../lib/shift-planning-firestore-transaction-manifest.js"
);
const {
  buildShiftPlanningAuthoritativeState,
} = require("../lib/shift-planning-state-persistence.js");
const {
  parseShiftPlanningRequestV2,
} = require("../lib/shift-planning-wire.js");

const {
  memberIds,
  activeDigest,
  attemptedAt,
  rotation,
  fairnessSnapshot,
  maintenanceState,
  authoritativeState,
  request,
  bundleInput,
  previewBinding,
  candidateBinding,
  bundleArtifact,
  fixture,
  predecessorFixture,
  readDocument,
  materializerInput
} = require("./shift-planning-activation-fixture.cjs");

const errorCode = (expectedCode) => (error) =>
  error instanceof Error && error.code === expectedCode;

const executeForwardTransaction = (database, base) =>
  database.runTransaction(async (transaction) => {
    const references = [
      database.doc(base.requestDocument.targetPath),
      ...base.beforeImageDocuments.map(({targetPath}) =>
        database.doc(targetPath)),
    ];
    const snapshots = await Promise.all(
      references.map((reference) => transaction.get(reference)),
    );
    const requestSnapshot = snapshots[0];
    const beforeImageSnapshots = snapshots.slice(1);
    return applyShiftPlanningForwardActivationAttempt({
      ...base,
      firestore: database,
      transaction,
      requestDocument: {
        targetPath: requestSnapshot.ref.path,
        data: requestSnapshot.data(),
        updateTime: requestSnapshot.updateTime,
      },
      beforeImageDocuments: beforeImageSnapshots.map((snapshot) => ({
        targetPath: snapshot.ref.path,
        data: snapshot.data(),
        updateTime: snapshot.updateTime,
      })),
    });
  });

test("materializes the exact complete forward mutation set", () => {
  const input = materializerInput();
  const result = materializeShiftPlanningForwardActivation(input);
  const artifact = input.preflight.bundle.artifact;
  const root = "develop/plus-collections";
  const mutationByPath = new Map(
    result.mutations.map((mutation) => [mutation.documentPath, mutation]),
  );

  assert.equal(
    result.mutations.length,
    artifact.budgets.forward.totalWrites,
  );
  assert.deepEqual(
    result.mutations.map(({documentPath}) => documentPath),
    [...result.mutations.map(({documentPath}) => documentPath)].sort(),
  );
  assert.equal(result.operation.state, "committed");
  assert.equal(
    result.operation.publicMutations.length,
    artifact.budgets.forward.publicShiftWrites,
  );
  assert.equal(result.operation.beforeImages.length, 3);
  assert.equal(
    result.publicDocuments.every(({document}) =>
      document.lastBackendMutation.operationIntentDigest ===
        result.operation.operationIntentDigest),
    true,
  );
  const stateMutation = result.mutations.find(({documentPath}) =>
    documentPath.endsWith("/shiftPlanningState/current"));
  assert.equal(stateMutation.kind, "update");
  assert.equal(
    stateMutation.data.activeRevision,
    input.liveResult.bundleRevision,
  );
  assert.equal(
    stateMutation.data.writeEpoch,
    input.liveResult.activationWriteEpoch,
  );
  for (const type of ["delivery", "market"]) {
    const rotationMutation = mutationByPath.get(
      `${root}/shiftRotations/${type}`,
    );
    assert.equal(rotationMutation.kind, "update");
    assert.deepEqual(
      rotationMutation.data.cursor,
      artifact.manifests.forward.rotations[type].cursorAfter,
    );
    assert.equal(rotationMutation.data.activeRevision, artifact.bundleRevision);
    assert.equal(rotationMutation.data.activeDigest, artifact.bundleDigest);
    assert.equal(rotationMutation.data.releaseLease.state, "sealed");
  }
  const requestMutation = mutationByPath.get(
    `${root}/shiftPlanningRequests/${input.preflight.request.requestId}`,
  );
  assert.equal(requestMutation.kind, "update");
  assert.equal(requestMutation.data.status, "completed");
  assert.deepEqual(
    requestMutation.data.lifecycle.summary,
    buildShiftPlanningCompletedSummary(input.liveResult),
  );
  const intentMutations = result.mutations.filter(({documentPath}) =>
    documentPath.includes("/shiftPlanningNotificationIntents/"));
  assert.equal(intentMutations.length, artifact.heldNotificationIntents.length);
  assert.deepEqual(
    intentMutations.map(({data}) => data),
    [...artifact.heldNotificationIntents].sort((left, right) =>
      left.intentId < right.intentId ? -1 :
        left.intentId > right.intentId ? 1 : 0),
  );
  assert.equal(
    intentMutations.every(({kind, data}) =>
      kind === "create" && data.state === "held"),
    true,
  );
  assert.equal(
    result.mutations.some(({documentPath}) =>
      documentPath.includes("/notificationEvents/")),
    false,
  );
});

test("rejects live bundle drift and incomplete before-images", () => {
  const driftedFixture = fixture();
  driftedFixture.liveResult = {
    ...driftedFixture.liveResult,
    bundleDigest: `shift-planning:v1:sha256:${"f".repeat(64)}`,
  };
  assert.throws(
    () => materializeShiftPlanningForwardActivation(
      materializerInput(driftedFixture),
    ),
    errorCode("invalid_planning_forward_materialization"),
  );

  const missingBeforeImage = materializerInput();
  missingBeforeImage.beforeImageDocuments =
    missingBeforeImage.beforeImageDocuments.slice(1);
  assert.throws(
    () => materializeShiftPlanningForwardActivation(missingBeforeImage),
    errorCode("invalid_planning_forward_materialization"),
  );
});

test("rejects stale and expired activation claims before publication", () => {
  const staleWorker = materializerInput();
  staleWorker.workerId = "stale-activation-worker";
  assert.throws(
    () => materializeShiftPlanningForwardActivation(staleWorker),
    errorCode("invalid_planning_forward_materialization"),
  );

  const expired = materializerInput();
  expired.requestDocument.data.lifecycle.lease.acquiredAt =
    Timestamp.fromMillis(attemptedAt.toMillis() - 60_000);
  expired.requestDocument.data.lifecycle.lease.expiresAt = attemptedAt;
  assert.throws(
    () => materializeShiftPlanningForwardActivation(expired),
    errorCode("invalid_planning_forward_materialization"),
  );
});

test("keeps credit planning closed until HU-084 is available", () => {
  const snapshot = fairnessSnapshot();
  snapshot.creditLedger = {
    enabled: true,
    revision: "credits-v1",
    digest: "credits-digest-v1",
    plannedWriteCount: 1,
  };
  assert.throws(
    () => fixture(snapshot),
    (error) =>
      errorCode("invalid_planning_state")(error) &&
      error.message.includes("HU-084"),
  );
});

test("updates the predecessor helper without shifting later turns", () => {
  const predecessor = predecessorFixture();
  const input = materializerInput(predecessor.value);
  input.beforeImageDocuments.push(readDocument(
    predecessor.predecessorPath,
    predecessor.predecessorDocument,
    1_788_307_140_000,
  ));

  const result = materializeShiftPlanningForwardActivation(input);
  const mutation = result.mutations.find(({documentPath}) =>
    documentPath === predecessor.predecessorPath);

  assert.equal(mutation.kind, "update");
  assert.equal(mutation.data.helperUserId, "member-1");
  assert.equal(mutation.data.assignmentRevision, 4);
  assert.equal(mutation.data.documentRevision, 5);
  assert.equal(result.operation.beforeImages.length, 4);
  assert.equal(
    result.operation.publicMutations.find(({targetPath}) =>
      targetPath === predecessor.predecessorPath).mutationKind,
    "update",
  );
});

test(
  "a conflicting create aborts every cursor and held intent",
  {skip: !process.env.FIRESTORE_EMULATOR_HOST},
  async () => {
    const database = new Firestore({
      projectId: "demo-reguerta-hu082-forward-materializer",
      databaseId: "(default)",
    });
    const base = materializerInput();
    const materialization = materializeShiftPlanningForwardActivation(base);
    const collisionPath = materialization.publicDocuments[0].targetPath;
    const seed = database.batch();
    seed.set(
      database.doc(base.requestDocument.targetPath),
      base.requestDocument.data,
    );
    base.beforeImageDocuments.forEach((document) => {
      seed.set(database.doc(document.targetPath), document.data);
    });
    seed.set(database.doc(collisionPath), {sentinel: "collision"});
    await seed.commit();

    try {
      await assert.rejects(executeForwardTransaction(database, base));
      const expected = base.liveResult.expectedState.authoritativeState;
      const [delivery, market, state, requestSnapshot] = await database.getAll(
        database.doc("develop/plus-collections/shiftRotations/delivery"),
        database.doc("develop/plus-collections/shiftRotations/market"),
        database.doc("develop/plus-collections/shiftPlanningState/current"),
        database.doc(base.requestDocument.targetPath),
      );
      assert.deepEqual(delivery.get("cursor"), expected.rotations.delivery.cursor);
      assert.deepEqual(market.get("cursor"), expected.rotations.market.cursor);
      assert.equal(state.get("writeEpoch"), expected.maintenance.writeEpoch);
      assert.equal(requestSnapshot.get("status"), "processing");
      assert.equal(requestSnapshot.get("lifecycle.state"), "processing");
      const absentCreates = await Promise.all(
        materialization.mutations
          .filter(({kind, documentPath}) =>
            kind === "create" && documentPath !== collisionPath)
          .map(({documentPath}) => database.doc(documentPath).get()),
      );
      assert.equal(absentCreates.every((snapshot) => !snapshot.exists), true);
      assert.equal(
        (await database.doc(collisionPath).get()).get("sentinel"),
        "collision",
      );
    } finally {
      const cleanup = database.batch();
      cleanup.delete(database.doc(base.requestDocument.targetPath));
      base.beforeImageDocuments.forEach(({targetPath}) => {
        cleanup.delete(database.doc(targetPath));
      });
      cleanup.delete(database.doc(collisionPath));
      await cleanup.commit();
      await database.terminate();
    }
  },
);

test(
  "applies and commits the atomic forward manifest through public APIs",
  {skip: !process.env.FIRESTORE_EMULATOR_HOST},
  async () => {
    const database = new Firestore({
      projectId: "demo-reguerta-hu082-forward-materializer",
      databaseId: "(default)",
    });
    const base = materializerInput();
    const seed = database.batch();
    seed.set(
      database.doc(base.requestDocument.targetPath),
      base.requestDocument.data,
    );
    base.beforeImageDocuments.forEach((document) => {
      seed.set(database.doc(document.targetPath), document.data);
    });
    await seed.commit();

    const result = await executeForwardTransaction(database, base);

    assert.equal(
      result.measurement.documentWriteCount,
      base.preflight.bundle.artifact.budgets.forward.totalWrites,
    );
    assert.equal(result.measurement.direction, "forward");
    assert.equal(
      (await database.doc(result.materialization.operationPath).get())
        .get("operationIntentDigest"),
      result.materialization.operation.operationIntentDigest,
    );
    assert.equal(
      (await database.doc(base.requestDocument.targetPath).get())
        .get("status"),
      "completed",
    );
    const artifact = base.preflight.bundle.artifact;
    for (const type of ["delivery", "market"]) {
      const snapshot = await database.doc(
        `develop/plus-collections/shiftRotations/${type}`,
      ).get();
      assert.deepEqual(
        snapshot.get("cursor"),
        artifact.manifests.forward.rotations[type].cursorAfter,
      );
      assert.equal(snapshot.get("releaseLease.state"), "sealed");
    }
    const heldIntents = await Promise.all(
      artifact.heldNotificationIntents.map(({intentId}) => database.doc(
        `develop/plus-collections/shiftPlanningNotificationIntents/${intentId}`,
      ).get()),
    );
    assert.equal(heldIntents.every((snapshot) => snapshot.exists), true);
    assert.equal(
      heldIntents.every((snapshot) => snapshot.get("state") === "held"),
      true,
    );
    assert.equal(
      (await database.collection(
        "develop/plus-collections/notificationEvents",
      ).get()).empty,
      true,
    );
    const firstPublic = result.materialization.publicDocuments[0];
    assert.equal(
      (await database.doc(firstPublic.targetPath).get())
        .get("lastBackendMutation.operationIntentDigest"),
      result.materialization.operation.operationIntentDigest,
    );
    await database.terminate();
  },
);
