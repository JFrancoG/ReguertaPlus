const assert = require("node:assert/strict");
const {test} = require("node:test");
const {
  FieldValue,
  Firestore,
  Timestamp,
} = require("@google-cloud/firestore");

const {
  SHIFT_PLANNING_FIRESTORE_COMMIT_ADAPTER_REVISION,
  SHIFT_PLANNING_FIRESTORE_TRANSACTION_BYTE_LIMIT,
  createCanonicalShiftPlanningFirestoreWriteBatch,
  serializeShiftPlanningFirestoreCommitRequest,
} = require(
  "../lib/shift-planning-firestore-transaction-serializer.js"
);

const PROJECT_ID = "demo-reguerta-hu082-serializer";
const MANIFEST_DIGEST = `shift-planning:v1:sha256:${"a".repeat(64)}`;
const INDEX_DIGEST = `shift-planning:v1:sha256:${"b".repeat(64)}`;
const TOKEN = Buffer.from("0123456789abcdef0123456789abcdef", "utf8");

const firestore = () => new Firestore({
  projectId: PROJECT_ID,
  databaseId: "(default)",
});

const fixtureMutations = (reverseDataKeys = false) => {
  const shiftData = reverseDataKeys ? {
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: Timestamp.fromMillis(1_788_307_200_000),
    assignedUserIds: ["member-1"],
  } : {
    assignedUserIds: ["member-1"],
    createdAt: Timestamp.fromMillis(1_788_307_200_000),
    updatedAt: FieldValue.serverTimestamp(),
  };
  return [
    {
      kind: "create",
      documentPath:
        "develop/plus-collections/shifts/shift_delivery_20260902",
      data: shiftData,
    },
    {
      kind: "update",
      documentPath:
        "develop/plus-collections/shiftRotations/delivery",
      data: reverseDataKeys ? {
        updatedAt: FieldValue.serverTimestamp(),
        stateRevision: 2,
      } : {
        stateRevision: 2,
        updatedAt: FieldValue.serverTimestamp(),
      },
    },
    {
      kind: "delete",
      documentPath:
        "develop/plus-collections/shiftPlanningSyncCommands/obsolete",
    },
  ];
};

const serialize = (overrides = {}) => {
  const {
    firestore: firestoreOverride,
    mutations = fixtureMutations(),
    writeBatch: writeBatchOverride,
    ...serializerOverrides
  } = overrides;
  const database = firestoreOverride ?? firestore();
  const writeBatch = writeBatchOverride ??
    createCanonicalShiftPlanningFirestoreWriteBatch({
      firestore: database,
      mutations,
    });
  return serializeShiftPlanningFirestoreCommitRequest({
    firestore: database,
    direction: "forward",
    manifestDigest: MANIFEST_DIGEST,
    writeBatch,
    transactionToken: TOKEN,
    expectedDocumentWriteCount: 3,
    authority: {
      adapterRevision:
        SHIFT_PLANNING_FIRESTORE_COMMIT_ADAPTER_REVISION,
      indexConfigurationDigest: INDEX_DIGEST,
    },
    ...serializerOverrides,
  });
};

test("serializes one deterministic exact Firestore CommitRequest", async () => {
  const database = firestore();
  const writeBatch = createCanonicalShiftPlanningFirestoreWriteBatch({
    firestore: database,
    mutations: fixtureMutations(),
  });
  const result = serialize({firestore: database, writeBatch});

  assert.deepEqual(result, {
    schemaVersion: 1,
    direction: "forward",
    manifestDigest: MANIFEST_DIGEST,
    databaseName:
      `projects/${PROJECT_ID}/databases/(default)`,
    writeSetDigest:
      "shift-planning:firestore-write-set:v1:sha256:" +
        "3470b677cb7ac1ba4e740067154160f53cd3a6c41fe78dadb4940a018fe9959d",
    commitRequestDigest:
      "shift-planning:firestore-commit-request:v1:sha256:" +
        "a6707af78024bbef322f4c9e066f65d7761d05eb3ed856068de0ecf8262c0355",
    documentWriteCount: 3,
    fieldTransformCount: 2,
    maximumFieldTransformsPerDocument: 1,
    requestByteCount: 624,
    adapterRevision:
      SHIFT_PLANNING_FIRESTORE_COMMIT_ADAPTER_REVISION,
    indexConfigurationDigest: INDEX_DIGEST,
  });
  assert.equal(Object.isFrozen(result), true);
  assert.throws(
    () => writeBatch.create(
      database.doc("develop/plus-collections/shifts/after-measurement"),
      {value: true},
    ),
  );
  assert.throws(
    () => serialize({firestore: database, writeBatch}),
    (error) => error.code === "invalid_planning_transaction",
  );

  const mutableDatabase = firestore();
  let committedRequest = null;
  mutableDatabase.initializeIfNeeded = async () => {};
  mutableDatabase.request = async (method, request) => {
    assert.equal(method, "commit");
    committedRequest = request;
    return {};
  };
  const mutablePayload = {nested: {value: 1}};
  const mutableToken = Buffer.from(TOKEN);
  const mutableBatch = mutableDatabase.batch();
  mutableBatch.create(
    mutableDatabase.doc("develop/plus-collections/shifts/mutable"),
    mutablePayload,
  );
  serialize({
    firestore: mutableDatabase,
    writeBatch: mutableBatch,
    transactionToken: mutableToken,
    expectedDocumentWriteCount: 1,
  });
  mutablePayload.nested.value = 2;
  mutableToken.fill(0);
  const firstCapturedWrite = mutableBatch._ops[0].op();
  assert.equal(
    firstCapturedWrite.update.fields.nested.mapValue.fields.value.integerValue,
    1,
  );
  firstCapturedWrite.update.fields.nested.mapValue.fields.value.integerValue = 3;
  assert.equal(
    mutableBatch._ops[0].op()
      .update.fields.nested.mapValue.fields.value.integerValue,
    1,
  );
  await assert.rejects(
    mutableBatch._commit({
      requestTag: "offline-serializer-test-invalid-token",
      transactionId: mutableToken,
    }),
    (error) => error.code === "invalid_planning_transaction",
  );
  assert.equal(committedRequest, null);
  await assert.rejects(
    mutableBatch._commit({
      methodName: "batchWrite",
      transactionId: TOKEN,
    }),
    (error) => error.code === "invalid_planning_transaction",
  );
  assert.equal(committedRequest, null);
  await mutableBatch._commit({
    requestTag: "offline-serializer-test",
    transactionId: TOKEN,
  });
  assert.equal(
    committedRequest.writes[0]
      .update.fields.nested.mapValue.fields.value.integerValue,
    1,
  );
  assert.deepEqual(Buffer.from(committedRequest.transaction), TOKEN);
  mutableBatch._reset();
  assert.doesNotThrow(
    () => mutableBatch.create(
      mutableDatabase.doc("develop/plus-collections/shifts/retry"),
      {value: true},
    ),
  );
  await assert.rejects(
    mutableBatch._commit({transactionId: TOKEN}),
    (error) => error.code === "invalid_planning_transaction",
  );
});

test("normalizes mutation order and nested document-key order", () => {
  const canonical = serialize();
  const reordered = serialize({
    mutations: fixtureMutations(true).reverse(),
  });

  assert.deepEqual(reordered, canonical);
});

test("binds the transaction token only to the full commit request", () => {
  const original = serialize();
  const changedToken = serialize({
    transactionToken: Buffer.from("different-token", "utf8"),
  });

  assert.equal(changedToken.writeSetDigest, original.writeSetDigest);
  assert.notEqual(
    changedToken.commitRequestDigest,
    original.commitRequestDigest,
  );
  assert.notEqual(changedToken.requestByteCount, original.requestByteCount);
});

test("binds paths, payloads, preconditions, manifests and index authority", () => {
  const original = serialize();
  const pathMutations = fixtureMutations();
  pathMutations[0] = {
    ...pathMutations[0],
    documentPath:
      "develop/plus-collections/shifts/shift_delivery_20260909",
  };
  const payloadMutations = fixtureMutations();
  payloadMutations[0] = {
    ...payloadMutations[0],
    data: {...payloadMutations[0].data, assignedUserIds: ["member-2"]},
  };
  const preconditionMutations = fixtureMutations();
  preconditionMutations[1] = {
    ...preconditionMutations[1],
    precondition: {
      lastUpdateTime: Timestamp.fromMillis(1_788_307_199_000),
    },
  };

  for (const mutations of [
    pathMutations,
    payloadMutations,
    preconditionMutations,
  ]) {
    const changed = serialize({mutations});
    assert.notEqual(changed.writeSetDigest, original.writeSetDigest);
    assert.notEqual(
      changed.commitRequestDigest,
      original.commitRequestDigest,
    );
  }

  const changedManifest = serialize({
    manifestDigest: `shift-planning:v1:sha256:${"c".repeat(64)}`,
  });
  assert.notEqual(changedManifest.manifestDigest, original.manifestDigest);
  assert.equal(changedManifest.writeSetDigest, original.writeSetDigest);
  const changedIndexAuthority = serialize({
    authority: {
      adapterRevision:
        SHIFT_PLANNING_FIRESTORE_COMMIT_ADAPTER_REVISION,
      indexConfigurationDigest:
        `shift-planning:v1:sha256:${"d".repeat(64)}`,
    },
  });
  assert.notEqual(
    changedIndexAuthority.indexConfigurationDigest,
    original.indexConfigurationDigest,
  );
});

test("rejects inputs that cannot describe one exact safe commit", () => {
  const duplicate = fixtureMutations();
  duplicate.push({...duplicate[0]});
  const cycle = {};
  cycle.self = cycle;
  const accessor = {};
  Object.defineProperty(accessor, "value", {
    enumerable: true,
    get: () => "not-data",
  });
  const prototypeData = {};
  Object.defineProperty(prototypeData, "__proto__", {
    enumerable: true,
    value: {polluted: true},
  });
  const sparseMutations = new Array(1);
  const sparseValues = new Array(1);
  const nonCanonicalDatabase = firestore();
  const nonCanonicalBatch = nonCanonicalDatabase.batch();
  nonCanonicalBatch.create(
    nonCanonicalDatabase.doc(
      "develop/plus-collections/shifts/noncanonical-z",
    ),
    {value: true},
  );
  nonCanonicalBatch.create(
    nonCanonicalDatabase.doc(
      "develop/plus-collections/shifts/noncanonical-a",
    ),
    {value: true},
  );

  const invalidInputs = [
    {transactionToken: Buffer.alloc(0)},
    {mutations: duplicate, expectedDocumentWriteCount: 4},
    {
      mutations: [{
        kind: "create",
        documentPath: "develop/plus-collections/shifts",
        data: {value: true},
      }],
      expectedDocumentWriteCount: 1,
    },
    {
      mutations: [{
        kind: "create",
        documentPath: "develop/plus-collections/shifts/cycle",
        data: cycle,
      }],
      expectedDocumentWriteCount: 1,
    },
    {
      mutations: [{
        kind: "create",
        documentPath: "develop/plus-collections/shifts/accessor",
        data: accessor,
      }],
      expectedDocumentWriteCount: 1,
    },
    {
      authority: {
        adapterRevision: "firestore-unknown-r1",
        indexConfigurationDigest: INDEX_DIGEST,
      },
    },
    {writeBatch: {_ops: []}},
    {
      firestore: nonCanonicalDatabase,
      writeBatch: nonCanonicalBatch,
      expectedDocumentWriteCount: 2,
    },
    {
      mutations: fixtureMutations().map((mutation, index) =>
        index === 0 ? {...mutation, unexpected: true} : mutation),
    },
    {
      mutations: [{
        kind: "create",
        documentPath: "develop/plus-collections/shifts/prototype",
        data: prototypeData,
      }],
      expectedDocumentWriteCount: 1,
    },
    {
      mutations: sparseMutations,
      expectedDocumentWriteCount: 1,
    },
    {
      mutations: [{
        kind: "create",
        documentPath: "develop/plus-collections/shifts/sparse",
        data: {values: sparseValues},
      }],
      expectedDocumentWriteCount: 1,
    },
    {
      mutations: [{
        kind: "create",
        documentPath: "develop/plus-collections/shifts/nested-array",
        data: {values: [[true]]},
      }],
      expectedDocumentWriteCount: 1,
    },
  ];

  for (const overrides of invalidInputs) {
    assert.throws(
      () => serialize(overrides),
      (error) => error.code === "invalid_planning_transaction" ||
        error.code === "planning_transaction_adapter_drift",
    );
  }
});

test("fails before publication when cardinality or byte gates drift", () => {
  assert.throws(
    () => serialize({expectedDocumentWriteCount: 4}),
    (error) => error.code === "invalid_planning_transaction",
  );
  assert.throws(
    () => serialize({byteLimit: 128}),
    (error) => error.code === "planning_bundle_oversize",
  );
  const transformHeavyMutations = Array.from({length: 251}, (_, index) => ({
    kind: "create",
    documentPath:
      `develop/plus-collections/shiftPlanningEvidence/item-${index}`,
    data: {measuredAt: FieldValue.serverTimestamp()},
  }));
  assert.throws(
    () => serialize({
      mutations: transformHeavyMutations,
      expectedDocumentWriteCount: transformHeavyMutations.length,
    }),
    (error) => error.code === "planning_bundle_oversize",
  );
  assert.equal(
    SHIFT_PLANNING_FIRESTORE_TRANSACTION_BYTE_LIMIT,
    10 * 1024 * 1024,
  );
});
