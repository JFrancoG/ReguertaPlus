const fs = require("node:fs");
const path = require("node:path");
const {after, before, beforeEach, test} = require("node:test");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");

const PROJECT_ID = "demo-reguerta-storage-phase1-compatibility";
const STORAGE_HOST = process.env.FIREBASE_STORAGE_EMULATOR_HOST || "127.0.0.1:9199";
const [storageHost, storagePortText] = STORAGE_HOST.split(":");
const storagePort = Number(storagePortText || 9199);
const storageRules = fs.readFileSync(
  path.resolve(__dirname, "../../../storage.phase1.rules"),
  "utf8",
);

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    storage: {
      host: storageHost,
      port: storagePort,
      rules: storageRules,
    },
  });
});

after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearStorage();
});

function bytes() {
  return new Uint8Array([1, 2, 3]);
}

test("phase 1 preserves the exact authenticated Storage rollback contract", async () => {
  const authenticated = testEnv.authenticatedContext("uid_phase1").storage();
  const product = authenticated.ref("products/legacy-company/product.jpg");
  const plusImage = authenticated.ref("develop/images/products/member_001/product.jpg");

  await assertSucceeds(product.put(bytes()));
  await assertSucceeds(product.getDownloadURL());
  await assertSucceeds(authenticated.ref("products").listAll());
  await assertSucceeds(product.delete());
  await assertSucceeds(plusImage.put(bytes()));
});

test("phase 1 continues to deny unauthenticated Storage access", async () => {
  const unauthenticated = testEnv.unauthenticatedContext().storage();

  await assertFails(unauthenticated.ref("products/company/product.jpg").put(bytes()));
  await assertFails(unauthenticated.ref("products/company/product.jpg").getDownloadURL());
  await assertFails(unauthenticated.ref("products").listAll());
});
