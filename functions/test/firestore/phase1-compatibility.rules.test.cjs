const fs = require("node:fs");
const path = require("node:path");
const {after, before, beforeEach, test} = require("node:test");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");

const PROJECT_ID = "demo-reguerta-phase1-compatibility";
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const [host, portText] = EMULATOR_HOST.split(":");
const port = Number(portText || 8080);
const rules = fs.readFileSync(
  path.resolve(__dirname, "../../../firestore.phase1.rules"),
  "utf8",
);
const envs = ["develop", "production"];
const legacyCollections = [
  "config",
  "containers",
  "measures",
  "news",
  "orderLines",
  "orders",
  "products",
  "users",
];
const privateShiftPlanningCollections = [
  "shiftPlanningRequests",
  "shiftPlanningState",
  "shiftRotations",
  "shiftRotationMappings",
  "shiftPlanningBundles",
  "shiftPlanningCandidates",
  "shiftPlanningSyncCommands",
  "shiftPlanningNotificationIntents",
  "shiftPlanningNotificationFences",
  "shiftPlanningOperations",
];

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {host, port, rules},
  });
});

after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

test("phase 1 preserves every known authenticated legacy collection", async () => {
  const authenticatedDb = testEnv.authenticatedContext("legacy-user").firestore();
  const unauthenticatedDb = testEnv.unauthenticatedContext().firestore();

  for (const env of envs) {
    for (const collection of legacyCollections) {
      const path = `${env}/collections/${collection}/compat-smoke`;
      await assertSucceeds(authenticatedDb.doc(path).set({value: collection}));
      await assertSucceeds(authenticatedDb.doc(path).get());
      await assertFails(unauthenticatedDb.doc(path).get());
    }
    await assertFails(
      authenticatedDb.doc(`${env}/collections/authLinks/forged`).set({
        memberId: "admin",
      }),
    );
    await assertFails(
      authenticatedDb.doc(`${env}/collections/unknown/forged`).set({
        value: true,
      }),
    );
  }
});

test("phase 1 leaves the previously deployed plus contract unchanged", async () => {
  const db = testEnv.authenticatedContext("plus-user").firestore();
  const unauthenticatedDb = testEnv.unauthenticatedContext().firestore();

  for (const env of envs) {
    const product = `${env}/plus-collections/products/product`;
    const validOrder = `${env}/plus-collections/orders/valid-order`;
    const invalidOrder = `${env}/plus-collections/orders/invalid-order`;

    await assertSucceeds(db.doc(product).set({name: "Compatible"}));
    await assertSucceeds(db.doc(product).get());
    await assertFails(unauthenticatedDb.doc(product).get());
    await assertSucceeds(db.doc(validOrder).set({userId: "plus-user"}));
    await assertFails(db.doc(invalidOrder).set({
      userId: "plus-user",
      producerStatus: "prepared",
    }));
  }
});

test("phase 1 exposes only public startup config without authentication", async () => {
  const unauthenticatedDb = testEnv.unauthenticatedContext().firestore();

  for (const env of envs) {
    await assertSucceeds(
      unauthenticatedDb.doc(`${env}/plus-collections/config/public`).get(),
    );
    await assertFails(
      unauthenticatedDb.doc(`${env}/plus-collections/config/global`).get(),
    );
    await assertFails(
      unauthenticatedDb.doc(`${env}/plus-collections/products/product`).get(),
    );
  }
  await assertFails(
    unauthenticatedDb.doc("preview/plus-collections/config/public").get(),
  );
});

test("phase 1 rejects unsupported environments and unrelated roots", async () => {
  const db = testEnv.authenticatedContext("tester").firestore();
  await assertFails(
    db.doc("preview/collections/users/user").set({value: true}),
  );
  await assertFails(db.doc("unrelated/root/document/value").set({value: true}));
});

test("phase 1 closes every private shift-planning partition", async () => {
  const db = testEnv.authenticatedContext("legacy-admin").firestore();

  for (const env of envs) {
    for (const collection of privateShiftPlanningCollections) {
      const path = `${env}/plus-collections/${collection}/private-document`;
      const nestedPath = `${path}/nested/value`;
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc(path).set({schemaVersion: 1});
        await context.firestore().doc(nestedPath).set({schemaVersion: 1});
      });
      await assertFails(db.doc(path).get());
      await assertFails(db.doc(nestedPath).get());
      await assertFails(db.doc(path).set({schemaVersion: 1}));
      await assertFails(db.doc(nestedPath).set({schemaVersion: 1}));
      await assertFails(db.doc(path).update({schemaVersion: 2}));
      await assertFails(db.doc(path).delete());
    }
  }
});
