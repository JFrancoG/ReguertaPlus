"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {FieldValue, Timestamp, GeoPoint} = require("@google-cloud/firestore");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {
  prepareShiftPlanningFirestoreTransaction: prepare,
  decodeShiftPlanningFirestoreMutations: decode,
  SHIFT_PLANNING_FIRESTORE_ADMISSION_REVISION,
} = require("../lib/shift-planning-firestore-transaction-manifest.js");
const input = (mutations, overrides = {}) => ({
  mutations, direction: "forward", manifestDigest: digest({manifest: "test"}),
  expectedDocumentWriteCount: mutations.length,
  authority: {
    adapterRevision: SHIFT_PLANNING_FIRESTORE_ADMISSION_REVISION,
    indexConfigurationDigest: digest({indexes: "test"}),
  },
  ...overrides,
});
const create = (data, path = "shifts/one") => ({kind: "create", documentPath: path, data});
const errorCode = (code) => (error) => error.code === code;

test("detaches all payloads and canonicalizes logical writes before asynchronous work", () => {
  const bytes = Buffer.from([1, 2, 3]);
  const data = {nested: {value: "original"}, bytes, at: new Timestamp(10, 20), geo: new GeoPoint(40, -3)};
  const prepared = prepare(input([create(data, "shifts/two"), create({z: 1, a: 2})]));
  data.nested.value = "changed";
  bytes.fill(8);
  const mutations = decode(prepared);
  assert.deepEqual(mutations.map((item) => item.documentPath), ["shifts/one", "shifts/two"]);
  assert.equal(mutations[1].data.nested.value, "original");
  assert.deepEqual(mutations[1].data.bytes, Buffer.from([1, 2, 3]));
  assert.ok(mutations[1].data.at.isEqual(new Timestamp(10, 20)));
  assert.ok(mutations[1].data.geo.isEqual(new GeoPoint(40, -3)));
  mutations[1].data.bytes.fill(9);
  assert.deepEqual(decode(prepared)[1].data.bytes, Buffer.from([1, 2, 3]));
  assert.equal(prepared.measurement.evidenceKind, "applicationAdmission");
  assert.equal("commitRequestDigest" in prepared.measurement, false);
});

test("logical digest is stable for field/order changes and changes for data or CAS differences", () => {
  const first = prepare(input([create({a: 1, b: 2})]));
  const reordered = prepare(input([create({b: 2, a: 1})]));
  const changed = prepare(input([create({a: 1, b: 3})]));
  assert.equal(first.measurement.logicalMutationDigest, reordered.measurement.logicalMutationDigest);
  assert.notEqual(first.measurement.logicalMutationDigest, changed.measurement.logicalMutationDigest);
  const update = (at) => ({kind: "update", documentPath: "shifts/one", data: {a: 1}, precondition: {lastUpdateTime: at}});
  assert.notEqual(prepare(input([update(new Timestamp(1, 0))])).measurement.logicalMutationDigest,
    prepare(input([update(new Timestamp(2, 0))])).measurement.logicalMutationDigest);
});

test("preserves field deletion and update-time preconditions for inverse recovery", () => {
  const prepared = prepare(input([{
    kind: "update", documentPath: "shifts/one", data: {remove: FieldValue.delete(), keep: "before"},
    precondition: {lastUpdateTime: new Timestamp(8, 9)},
  }], {direction: "inverse"}));
  const [mutation] = decode(prepared);
  assert.ok(mutation.data.remove.isEqual(FieldValue.delete()));
  assert.ok(mutation.precondition.lastUpdateTime.isEqual(new Timestamp(8, 9)));
});

test("rejects duplicate writes, unsafe paths, unsupported transforms and mismatched plans", () => {
  assert.throws(() => prepare(input([create({}), create({})])), errorCode("invalid_planning_transaction"));
  assert.throws(() => prepare(input([create({}, "shifts")])), errorCode("invalid_planning_transaction"));
  assert.throws(() => prepare(input([create({n: FieldValue.increment(1)})])));
  assert.throws(() => prepare(input([create({gone: FieldValue.delete()})])), errorCode("invalid_planning_transaction"));
  assert.throws(() => prepare(input([create({})], {expectedDocumentWriteCount: 2})), errorCode("invalid_planning_transaction"));
});

test("admits 500 bounded writes and rejects the 501st or an oversized document before commit", () => {
  const writes = Array.from({length: 500}, (_, index) => create({value: index}, `shifts/${index}`));
  assert.equal(prepare(input(writes)).measurement.documentWriteCount, 500);
  assert.throws(() => prepare(input([...writes, create({}, "shifts/extra")])), errorCode("planning_bundle_oversize"));
  assert.throws(() => prepare(input([create({value: "x".repeat(400_000)})])), errorCode("planning_bundle_oversize"));
  const receipt = prepare(input([create({value: "tiny"})]));
  assert.throws(() => prepare(input([create({value: "tiny"})], {
    byteLimit: receipt.measurement.estimatedRequestBytes - 1,
  })), errorCode("planning_bundle_oversize"));
});
