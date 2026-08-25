"use strict";

const assert = require("node:assert/strict");
const {createHash} = require("node:crypto");
const {test} = require("node:test");
const {
  Firestore,
  Transaction,
  v1,
} = require("@google-cloud/firestore");

const {
  measureAndSealShiftPlanningFirestoreTransactionAttempt,
} = require(
  "../lib/shift-planning-firestore-transaction-attempt.js"
);
const {
  SHIFT_PLANNING_FIRESTORE_COMMIT_ADAPTER_REVISION,
} = require(
  "../lib/shift-planning-firestore-transaction-serializer.js"
);

const PROJECT_ID = "demo-reguerta-hu082-transaction-attempt";
const MANIFEST_DIGEST = `shift-planning:v1:sha256:${"a".repeat(64)}`;
const INDEX_DIGEST = `shift-planning:v1:sha256:${"b".repeat(64)}`;
const COMMIT_DIGEST_PREFIX =
  "shift-planning:firestore-commit-request:v1:sha256:";

const requireEmulator = () => {
  assert.ok(
    process.env.FIRESTORE_EMULATOR_HOST,
    "FIRESTORE_EMULATOR_HOST is required for this suite",
  );
};

const firestore = () => {
  requireEmulator();
  return new Firestore({
    projectId: PROJECT_ID,
    databaseId: "(default)",
  });
};

const measurementInput = ({database, transaction, mutations}) => ({
  firestore: database,
  transaction,
  mutations,
  direction: "forward",
  manifestDigest: MANIFEST_DIGEST,
  expectedDocumentWriteCount: mutations.length,
  authority: {
    adapterRevision: SHIFT_PLANNING_FIRESTORE_COMMIT_ADAPTER_REVISION,
    indexConfigurationDigest: INDEX_DIGEST,
  },
});

const captureTransactionCommits = (database) => {
  const requests = [];
  const originalRequest = database.request;
  database.request = async function(method, request, ...remaining) {
    if (method === "commit" && request.transaction) {
      requests.push(request);
    }
    return originalRequest.call(this, method, request, ...remaining);
  };
  return requests;
};

let commitCodec;
const encodedCommitRequest = (request) => {
  if (!commitCodec) {
    const client = new v1.FirestoreClient({
      projectId: "shift-planning-attempt-test-codec",
      fallback: true,
    });
    commitCodec = client._protos.lookupType(
      "google.firestore.v1.CommitRequest",
    );
  }
  return Buffer.from(
    commitCodec.encode(commitCodec.fromObject(request)).finish(),
  );
};

const commitDigest = (request) => {
  const bytes = encodedCommitRequest(request);
  return {
    byteCount: bytes.byteLength,
    digest: `${COMMIT_DIGEST_PREFIX}${
      createHash("sha256").update(bytes).digest("hex")
    }`,
  };
};

test("measures and commits the exact SDK-owned transaction batch", async () => {
  const database = firestore();
  const stateReference = database.doc("attemptState/current");
  const bypassReference = database.doc("publicShifts/bypass");
  const shiftReference = database.doc("publicShifts/shift-a");
  await stateReference.set({revision: 1});
  const committedRequests = captureTransactionCommits(database);

  const measurement = await database.runTransaction(async (transaction) => {
    const state = await transaction.get(stateReference);
    const mutations = [
      {
        kind: "create",
        documentPath: shiftReference.path,
        data: {ownerUserId: "member-1"},
      },
      {
        kind: "update",
        documentPath: stateReference.path,
        data: {revision: state.get("revision") + 1},
      },
    ];
    const result = await measureAndSealShiftPlanningFirestoreTransactionAttempt(
      measurementInput({database, transaction, mutations}),
    );
    const measuredBatch = transaction._writeBatch;
    const replacementBatch = database.batch();
    replacementBatch.create(bypassReference, {ownerUserId: "bypass"});

    assert.throws(
      () => {
        transaction._writeBatch = replacementBatch;
      },
      (error) => error.code === "invalid_planning_transaction",
    );
    assert.throws(
      () => {
        transaction.commit = async () => replacementBatch.commit();
      },
      (error) => error.code === "invalid_planning_transaction",
    );
    assert.throws(
      () => {
        transaction._firestore = {};
      },
      (error) => error.code === "invalid_planning_transaction",
    );
    assert.equal(transaction._writeBatch, measuredBatch);

    assert.throws(
      () => transaction._writeBatch._ops.push({docPath: "escape", op: () => ({})}),
      TypeError,
    );
    assert.throws(
      () => {
        transaction._writeBatch._ops = [];
      },
      (error) => error.code === "invalid_planning_transaction",
    );
    assert.throws(
      () => {
        transaction._writeBatch._ops[0].op = () => ({delete: "escape"});
      },
      TypeError,
    );
    return result;
  });

  assert.equal(committedRequests.length, 1);
  const transported = commitDigest(committedRequests[0]);
  assert.equal(measurement.commitRequestDigest, transported.digest);
  assert.equal(measurement.requestByteCount, transported.byteCount);
  assert.deepEqual(
    committedRequests[0].writes.map((write) => write.update?.name ?? write.delete),
    [stateReference.formattedName, shiftReference.formattedName],
  );
  assert.equal("transactionToken" in measurement, false);
  assert.equal((await stateReference.get()).get("revision"), 2);
  assert.deepEqual((await shiftReference.get()).data(), {
    ownerUserId: "member-1",
  });
  assert.equal((await bypassReference.get()).exists, false);
  await database.terminate();
});

test("resets and remeasures the actual batch for every SDK retry", async () => {
  const database = firestore();
  const stateReference = database.doc("retryState/current");
  const shiftReference = database.doc("retryShifts/shift-a");
  await stateReference.set({revision: 1});
  const attemptedRequests = [];
  const originalRequest = database.request;
  let rejectFirstCommit = true;
  database.request = async function(method, request, ...remaining) {
    if (method === "commit" && request.transaction) {
      attemptedRequests.push(request);
      if (rejectFirstCommit) {
        rejectFirstCommit = false;
        const error = new Error("forced emulator commit retry");
        error.code = 10;
        throw error;
      }
    }
    return originalRequest.call(this, method, request, ...remaining);
  };
  const measurements = [];
  let attempts = 0;

  await database.runTransaction(async (transaction) => {
    attempts += 1;
    const state = await transaction.get(stateReference);
    const mutations = [
      {
        kind: "update",
        documentPath: stateReference.path,
        data: {revision: state.get("revision") + 1},
      },
      {
        kind: "create",
        documentPath: shiftReference.path,
        data: {ownerUserId: "member-2"},
      },
    ];
    measurements.push(
      await measureAndSealShiftPlanningFirestoreTransactionAttempt(
        measurementInput({database, transaction, mutations}),
      ),
    );
  }, {maxAttempts: 3});

  assert.equal(attempts, 2);
  assert.equal(measurements.length, 2);
  assert.equal(
    measurements[0].writeSetDigest,
    measurements[1].writeSetDigest,
  );
  assert.notEqual(
    measurements[0].commitRequestDigest,
    measurements[1].commitRequestDigest,
  );
  assert.equal(attemptedRequests.length, 2);
  assert.equal(
    measurements[0].commitRequestDigest,
    commitDigest(attemptedRequests[0]).digest,
  );
  assert.equal(
    measurements[1].commitRequestDigest,
    commitDigest(attemptedRequests[1]).digest,
  );
  assert.equal((await stateReference.get()).get("revision"), 2);
  assert.equal((await shiftReference.get()).exists, true);
  await database.terminate();
});

test("rejects shadowed SDK batch methods before transport", async () => {
  const database = firestore();
  const stateReference = database.doc("shadowState/current");
  await stateReference.set({revision: 1});
  const committedRequests = captureTransactionCommits(database);

  for (const method of ["_commit", "_reset"]) {
    const targetReference = database.doc(`shadowShifts/${method.slice(1)}`);
    await assert.rejects(
      database.runTransaction(async (transaction) => {
        await transaction.get(stateReference);
        transaction._writeBatch[method] = async () => {
          throw new Error("shadowed method must never execute");
        };
        const mutations = [{
          kind: "create",
          documentPath: targetReference.path,
          data: {ownerUserId: "shadow"},
        }];
        return measureAndSealShiftPlanningFirestoreTransactionAttempt(
          measurementInput({database, transaction, mutations}),
        );
      }, {maxAttempts: 1}),
      (error) => error.code === "planning_transaction_adapter_drift",
    );
    assert.equal((await targetReference.get()).exists, false);
  }

  const commitTarget = database.doc("shadowShifts/transaction-commit");
  await assert.rejects(
    database.runTransaction(async (transaction) => {
      await transaction.get(stateReference);
      transaction.commit = async () => {
        throw new Error("shadowed commit must never execute");
      };
      const mutations = [{
        kind: "create",
        documentPath: commitTarget.path,
        data: {ownerUserId: "shadow"},
      }];
      return measureAndSealShiftPlanningFirestoreTransactionAttempt(
        measurementInput({database, transaction, mutations}),
      );
    }, {maxAttempts: 1}),
    (error) => error.code === "planning_transaction_adapter_drift",
  );
  assert.equal((await commitTarget.get()).exists, false);

  const prototypeTarget = database.doc("shadowShifts/prototype-commit");
  const originalPrototypeCommit = Transaction.prototype.commit;
  Transaction.prototype.commit = async () => {
    throw new Error("drifted prototype must never execute");
  };
  try {
    await assert.rejects(
      database.runTransaction(async (transaction) => {
        await transaction.get(stateReference);
        const mutations = [{
          kind: "create",
          documentPath: prototypeTarget.path,
          data: {ownerUserId: "shadow"},
        }];
        return measureAndSealShiftPlanningFirestoreTransactionAttempt(
          measurementInput({database, transaction, mutations}),
        );
      }, {maxAttempts: 1}),
      (error) => error.code === "planning_transaction_adapter_drift",
    );
  } finally {
    Transaction.prototype.commit = originalPrototypeCommit;
  }
  assert.equal((await prototypeTarget.get()).exists, false);

  assert.equal(committedRequests.length, 0);
  await database.terminate();
});

test("rejects missing reads and writes outside the attempt adapter", async () => {
  const database = firestore();
  const stateReference = database.doc("invalidState/current");
  const outsideReference = database.doc("invalidShifts/outside");
  const targetReference = database.doc("invalidShifts/target");
  await stateReference.set({revision: 1});

  await assert.rejects(
    database.runTransaction(async (transaction) => {
      const mutations = [{
        kind: "create",
        documentPath: targetReference.path,
        data: {ownerUserId: "member-3"},
      }];
      return measureAndSealShiftPlanningFirestoreTransactionAttempt(
        measurementInput({database, transaction, mutations}),
      );
    }, {maxAttempts: 1}),
    (error) => error.code === "invalid_planning_transaction",
  );

  await assert.rejects(
    database.runTransaction(async (transaction) => {
      await transaction.get(stateReference);
      transaction.create(outsideReference, {ownerUserId: "outside"});
      const mutations = [{
        kind: "create",
        documentPath: targetReference.path,
        data: {ownerUserId: "member-3"},
      }];
      return measureAndSealShiftPlanningFirestoreTransactionAttempt(
        measurementInput({database, transaction, mutations}),
      );
    }, {maxAttempts: 1}),
    (error) => error.code === "invalid_planning_transaction",
  );

  assert.equal((await outsideReference.get()).exists, false);
  assert.equal((await targetReference.get()).exists, false);
  await database.terminate();
});
