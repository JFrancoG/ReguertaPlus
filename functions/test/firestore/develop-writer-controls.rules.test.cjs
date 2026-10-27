"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {after, before, beforeEach, test} = require("node:test");

// A failed guard must stop before any Firebase client or credential discovery.
assert.equal(process.env.GCLOUD_PROJECT, "demo-reguerta-writer-controls");
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8897");
const {assertFails, assertSucceeds, initializeTestEnvironment} = require("@firebase/rules-unit-testing");
const {collection, deleteDoc, doc, getDoc, getDocs, setDoc, setLogLevel, updateDoc, writeBatch} = require("firebase/firestore");
// Expected permission denials are asserted below; SDK diagnostics add no evidence.
setLogLevel("silent");

const BASELINE_ID = "demo-rgt-controls-baseline";
const CANDIDATE_ID = "demo-rgt-controls-candidate";
const baseline = fs.readFileSync(path.join(__dirname, "fixtures/develop-writer-controls-baseline.rules"), "utf8");
const candidate = fs.readFileSync(path.resolve(__dirname, "../../../firestore.develop-writer-controls.rules"), "utf8");
const capturedHash = "bb87cdacc63dc4e285ac24d50b8f2f8c64eff3def1e4fcf24265030059591dfa";
const envs = ["develop", "production"];
const plusPaths = [
  "shifts/published",
  "deliveryCalendar/2027-W02",
  "shiftPlanningRequests/request",
  "shiftSwapRequests/swap",
  "shiftPlanningState/current",
  "shiftRotations/delivery",
  "shiftCoverageCases/coverage",
  "shiftCoverageEffects/effect",
  "shiftCoverageEffects/effect/externalSubmissions/sheets",
  "shiftCreditLedgers/member",
  "shiftCoverageOperations/operation",
  "unknownFuturePrivateCollection/item/submissions/attempt",
  "config/public",
  "users/member",
];
const legacyCollections = ["config", "containers", "measures", "news", "orderLines", "orders", "products", "users"];
const genericPaths = [
  ...plusPaths.map((tail) => `plus-collections/${tail}`),
  ...legacyCollections.map((name) => `collections/${name}/legacy`),
];
const published = {type: "delivery", date: "2027-01-13", assignedUserIds: ["member-a", "member-b"], deliveryHelperUserId: "member-c"};
const rotationState = {writeEpoch: 7, activeRevision: "synthetic-before-controls", maintenanceStatus: "open"};
const vendorStatuses = {producerA: "unread", producerB: "unread", inactive: "unread"};
const order = {userId: "buyer", producerStatus: "unread", producerStatusesByVendor: vendorStatuses,
  producerStatusUpdatedBy: "bootstrap", totalsByVendor: {producerA: 10, producerB: 5, inactive: 7}, updatedAt: "before"};
let baselineEnv, candidateEnv;
const options = (projectId, rules) => ({projectId, firestore: {host: "127.0.0.1", port: 8897, rules}});
const authenticated = (environment, uid = "member-uid") => environment.authenticatedContext(uid).firestore();
const target = (db, env, relative) => doc(db, `${env}/${relative}`);
const privilegedRead = async (environment, paths) => {
  let images;
  // The test library discards the callback return value; retain the reads here.
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    images = await Promise.all(paths.map(async (name) => {
      const snapshot = await getDoc(doc(db, name));
      assert.equal(snapshot.exists(), true, `Expected existing image: ${name}`);
      return {path: name, data: snapshot.data()};
    }));
  });
  assert.equal(Array.isArray(images), true, "Privileged reads must return actual captured images");
  assert.equal(images.length, paths.length);
  return images;
};
const orderRef = (db, env, id = "ordinary") => target(db, env, `plus-collections/orders/${id}`);

const seed = async (environment) => environment.withSecurityRulesDisabled(async (context) => {
  const db = context.firestore(), batch = writeBatch(db);
  for (const env of envs) {
    for (const relative of genericPaths) batch.set(target(db, env, relative), published);
    batch.set(target(db, env, "plus-collections/shiftPlanningState/current"), rotationState);
    for (const name of ["ordinary", "producer-valid", "producer-forged", "producer-other-vendor", "producer-inactive", "admin-valid", "admin-map", "admin-invalid"]) {
      batch.set(orderRef(db, env, name), order);
    }
    batch.set(orderRef(db, env, "producer-terminal"), {...order, producerStatus: "delivered",
      producerStatusesByVendor: {...vendorStatuses, producerA: "delivered"}});
    for (const [id, authUid, roles, isActive] of [
      ["producerA", "producer-a-uid", ["producer"], true],
      ["producerB", "producer-b-uid", ["producer"], true],
      ["inactive", "inactive-uid", ["producer"], false],
      ["administrator", "admin-uid", ["admin"], true],
    ]) batch.set(target(db, env, `plus-collections/users/${id}`), {authUid, roles, isActive});
  }
  await batch.commit();
});

before(async () => {
  baselineEnv = await initializeTestEnvironment(options(BASELINE_ID, baseline));
  candidateEnv = await initializeTestEnvironment(options(CANDIDATE_ID, candidate));
});
after(async () => {
  if (baselineEnv) await baselineEnv.cleanup();
  if (candidateEnv) await candidateEnv.cleanup();
});
beforeEach(async () => {
  await Promise.all([baselineEnv.clearFirestore(), candidateEnv.clearFirestore()]);
  await Promise.all([seed(baselineEnv), seed(candidateEnv)]);
});

test("the comparison fixture is the exact captured Rules source", () => {
  assert.equal(Buffer.byteLength(baseline), 6712);
  assert.equal(crypto.createHash("sha256").update(baseline).digest("hex"), capturedHash);
});

test("the baseline admits develop mutation probes for every generic surface being closed", async () => {
  const db = authenticated(baselineEnv);
  for (const relative of genericPaths) {
    const existing = target(db, "develop", relative), created = target(db, "develop", `${relative}-new`);
    await assertSucceeds(setDoc(created, published));
    await assertSucceeds(updateDoc(existing, {controlProbe: "baseline-permitted"}));
    await assertSucceeds(getDoc(existing));
    await assertSucceeds(deleteDoc(created));
  }
});

test("the candidate denies create, update and delete throughout develop without changing stored images", async () => {
  const db = authenticated(candidateEnv);
  const before = await privilegedRead(candidateEnv, genericPaths.map((p) => `develop/${p}`));
  for (const relative of genericPaths) {
    const existing = target(db, "develop", relative), created = target(db, "develop", `${relative}-new`);
    await assertFails(setDoc(created, {...published, assignedUserIds: ["member-c", "member-b"]}));
    await assertFails(updateDoc(existing, {date: "2027-01-20", assignedUserIds: ["member-b", "member-a"]}));
    await assertFails(deleteDoc(existing));
    assert.equal((await assertSucceeds(getDoc(created))).exists(), false);
  }
  assert.deepEqual(await privilegedRead(candidateEnv, genericPaths.map((p) => `develop/${p}`)), before);
});

test("production generic create, update, delete and read outcomes remain identical to the baseline", async () => {
  for (const environment of [baselineEnv, candidateEnv]) {
    const db = authenticated(environment);
    for (const relative of genericPaths) {
      const existing = target(db, "production", relative), created = target(db, "production", `${relative}-new`);
      await assertSucceeds(setDoc(created, published));
      await assertSucceeds(updateDoc(existing, {controlProbe: "production-still-admitted"}));
      await assertSucceeds(getDoc(existing));
      await assertSucceeds(deleteDoc(created));
    }
  }
  assert.deepEqual(await privilegedRead(candidateEnv, genericPaths.map((p) => `production/${p}`)),
    await privilegedRead(baselineEnv, genericPaths.map((p) => `production/${p}`)));
});

test("authenticated reads and queries remain open, while anonymous access retains the public-config exception only", async () => {
  for (const environment of [baselineEnv, candidateEnv]) {
    const db = authenticated(environment), anonymous = environment.unauthenticatedContext().firestore();
    for (const env of envs) {
      for (const relative of genericPaths) await assertSucceeds(getDoc(target(db, env, relative)));
      await assertSucceeds(getDocs(collection(db, `${env}/plus-collections/shiftPlanningState`)));
      await assertSucceeds(getDoc(target(anonymous, env, "plus-collections/config/public")));
      await assertFails(getDocs(collection(anonymous, `${env}/plus-collections/config`)));
      for (const relative of ["plus-collections/shifts/published", "plus-collections/shiftPlanningState/current", "collections/config/legacy"]) {
        await assertFails(getDoc(target(anonymous, env, relative)));
        await assertFails(setDoc(target(anonymous, env, relative), published));
      }
    }
  }
});

test("production order creation, ordinary updates and deletes retain the deployed contract", async () => {
  for (const environment of [baselineEnv, candidateEnv]) {
    const db = authenticated(environment);
    await assertSucceeds(setDoc(orderRef(db, "production", "created-without-status"), {userId: "buyer"}));
    await assertSucceeds(setDoc(orderRef(db, "production", "created-unread"), {userId: "buyer", producerStatus: "unread"}));
    await assertFails(setDoc(orderRef(db, "production", "created-prepared"), {userId: "buyer", producerStatus: "prepared"}));
    await assertFails(setDoc(orderRef(db, "production", "created-map-only"), {userId: "buyer", producerStatusesByVendor: {producerA: "read"}}));
    await assertSucceeds(updateDoc(orderRef(db, "production"), {memberNote: "unchanged deployed admission"}));
    await assertSucceeds(deleteDoc(orderRef(db, "production", "created-unread")));
  }
});

test("production producer status permits only the same linked active vendor transitions as the baseline", async () => {
  const change = (actor, map) => ({producerStatus: "read", producerStatusesByVendor: map,
    producerStatusUpdatedBy: actor, updatedAt: "after"});
  for (const environment of [baselineEnv, candidateEnv]) {
    const producer = authenticated(environment, "producer-a-uid"), attacker = authenticated(environment, "attacker-uid");
    await assertSucceeds(updateDoc(orderRef(producer, "production", "producer-valid"), change("producerA", {...vendorStatuses, producerA: "read"})));
    await assertFails(updateDoc(orderRef(attacker, "production", "producer-forged"), change("producerA", {...vendorStatuses, producerA: "read"})));
    await assertFails(updateDoc(orderRef(producer, "production", "producer-other-vendor"), change("producerA", {...vendorStatuses, producerA: "read", producerB: "read"})));
    await assertFails(updateDoc(orderRef(producer, "production", "producer-terminal"), change("producerA", {...vendorStatuses, producerA: "read"})));
    await assertFails(updateDoc(orderRef(authenticated(environment, "inactive-uid"), "production", "producer-inactive"), change("inactive", {...vendorStatuses, inactive: "read"})));
  }
});

test("production administrator corrections retain the deployed vendor-map and status restrictions", async () => {
  for (const environment of [baselineEnv, candidateEnv]) {
    const db = authenticated(environment, "admin-uid");
    await assertSucceeds(updateDoc(orderRef(db, "production", "admin-valid"), {producerStatus: "prepared", producerStatusUpdatedBy: "administrator", updatedAt: "after"}));
    await assertFails(updateDoc(orderRef(db, "production", "admin-map"), {producerStatus: "prepared", producerStatusUpdatedBy: "administrator", producerStatusesByVendor: {...vendorStatuses, producerA: "prepared"}, updatedAt: "after"}));
    await assertFails(updateDoc(orderRef(db, "production", "admin-invalid"), {producerStatus: "not-a-status", producerStatusUpdatedBy: "administrator", updatedAt: "after"}));
  }
});

test("develop orders are closed even to otherwise authorized member, producer and administrator paths", async () => {
  const before = await privilegedRead(candidateEnv, ["develop/plus-collections/orders/ordinary", "develop/plus-collections/orders/producer-valid", "develop/plus-collections/orders/admin-valid"]);
  const member = authenticated(candidateEnv), producer = authenticated(candidateEnv, "producer-a-uid"), admin = authenticated(candidateEnv, "admin-uid");
  await assertFails(setDoc(orderRef(member, "develop", "new"), {userId: "buyer"}));
  await assertFails(updateDoc(orderRef(member, "develop"), {memberNote: "queued client write"}));
  await assertFails(deleteDoc(orderRef(member, "develop")));
  await assertFails(updateDoc(orderRef(producer, "develop", "producer-valid"), {producerStatus: "read", producerStatusesByVendor: {...vendorStatuses, producerA: "read"}, producerStatusUpdatedBy: "producerA", updatedAt: "after"}));
  await assertFails(updateDoc(orderRef(admin, "develop", "admin-valid"), {producerStatus: "prepared", producerStatusUpdatedBy: "administrator", updatedAt: "after"}));
  assert.deepEqual(await privilegedRead(candidateEnv, before.map((item) => item.path)), before);
});

test("unknown environments, datasets and legacy collections remain denied in both policies", async () => {
  for (const environment of [baselineEnv, candidateEnv]) {
    const db = authenticated(environment);
    for (const name of ["staging/plus-collections/shifts/item", "production/unreviewed/shifts/item", "production/collections/authLinks/item", "develop/collections/unknown/item"]) {
      await assertFails(setDoc(doc(db, name), published));
      await assertFails(getDoc(doc(db, name)));
    }
  }
});

test("the client Rules fence deliberately does not claim to block privileged server access", async () => {
  await candidateEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "develop/plus-collections/controlProbes/server"), {synthetic: true});
  });
  assert.equal((await getDoc(target(authenticated(candidateEnv), "develop", "plus-collections/controlProbes/server"))).data().synthetic, true);
});

test("pre-write Rules-only restoration reopens a control probe without restoring or rewriting published dates, order or epoch", async () => {
  const names = ["develop/plus-collections/shifts/published", "develop/plus-collections/shiftPlanningState/current"];
  const before = await privilegedRead(candidateEnv, names);
  assert.deepEqual(before, [
    {path: names[0], data: {type: "delivery", date: "2027-01-13", assignedUserIds: ["member-a", "member-b"], deliveryHelperUserId: "member-c"}},
    {path: names[1], data: {writeEpoch: 7, activeRevision: "synthetic-before-controls", maintenanceStatus: "open"}},
  ]);
  await assertFails(updateDoc(target(authenticated(candidateEnv), "develop", "plus-collections/shifts/published"), {date: "2027-07-21", assignedUserIds: ["member-b", "member-a"]}));
  let restored, reclosed;
  try {
    // Only the demo project's Rules are replaced. No before-image data is written.
    // This is not authorization to restore permissive Rules after migration.
    restored = await initializeTestEnvironment(options(CANDIDATE_ID, baseline));
    const db = authenticated(restored);
    await assertSucceeds(setDoc(target(db, "develop", "plus-collections/controlProbes/reopened"), {synthetic: true}));
    assert.deepEqual(await privilegedRead(candidateEnv, names), before);
  } finally {
    reclosed = await initializeTestEnvironment(options(CANDIDATE_ID, candidate));
    if (restored) await restored.cleanup();
    if (reclosed) await reclosed.cleanup();
  }
  await assertFails(setDoc(target(authenticated(candidateEnv), "develop", "plus-collections/controlProbes/closed-again"), {synthetic: true}));
  assert.deepEqual(await privilegedRead(candidateEnv, names), before);
});
