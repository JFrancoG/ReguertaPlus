const fs = require("node:fs");
const path = require("node:path");
const {after, before, beforeEach, test} = require("node:test");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");

const PROJECT_ID = "demo-reguerta-storage-role-access";
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const STORAGE_HOST = process.env.FIREBASE_STORAGE_EMULATOR_HOST || "127.0.0.1:9199";
const [firestoreHost, firestorePortText] = FIRESTORE_HOST.split(":");
const [storageHost, storagePortText] = STORAGE_HOST.split(":");
const firestorePort = Number(firestorePortText || 8080);
const storagePort = Number(storagePortText || 9199);
const firestoreRules = fs.readFileSync(
  path.resolve(__dirname, "../../../firestore.strict.rules"),
  "utf8",
);
const storageRules = fs.readFileSync(
  path.resolve(__dirname, "../../../storage.strict.rules"),
  "utf8",
);

const envs = ["develop", "production"];
const actors = {
  member: {
    memberId: "member_001",
    uid: "uid_member_001",
    roles: ["member"],
    isActive: true,
    isCommonPurchaseManager: false,
  },
  producer: {
    memberId: "producer_001",
    uid: "uid_producer_001",
    roles: ["member", "producer"],
    isActive: true,
    isCommonPurchaseManager: false,
  },
  manager: {
    memberId: "manager_001",
    uid: "uid_manager_001",
    roles: ["member"],
    isActive: true,
    isCommonPurchaseManager: true,
  },
  admin: {
    memberId: "admin_001",
    uid: "uid_admin_001",
    roles: ["member", "admin"],
    isActive: true,
    isCommonPurchaseManager: false,
  },
  inactive: {
    memberId: "inactive_001",
    uid: "uid_inactive_001",
    roles: ["member", "producer"],
    isActive: false,
    isCommonPurchaseManager: false,
  },
};

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: firestoreHost,
      port: firestorePort,
      rules: firestoreRules,
    },
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
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const env of envs) {
      for (const actor of Object.values(actors)) {
        await db.doc(`${env}/plus-collections/users/${actor.memberId}`).set({
          authUid: actor.uid,
          roles: actor.roles,
          isActive: actor.isActive,
          isCommonPurchaseManager: actor.isCommonPurchaseManager,
        });
        await db.doc(`${env}/plus-collections/authLinks/${actor.uid}`).set({
          memberId: actor.memberId,
        });
      }
      await db.doc(`${env}/plus-collections/authLinks/uid_mismatched`).set({
        memberId: actors.member.memberId,
      });
    }
  });
});

function storageFor(actor) {
  return testEnv.authenticatedContext(actor.uid).storage();
}

function jpegBytes(size = 32) {
  return new Uint8Array(size).fill(7);
}

test("legacy product images retain their authenticated compatibility boundary", async () => {
  const storage = storageFor(actors.member);
  const legacyPath = "products/legacy-company/product-image";

  await assertSucceeds(
    storage.ref(legacyPath).put(jpegBytes(), {
      contentType: "application/octet-stream",
    }),
  );
  await assertSucceeds(storage.ref(legacyPath).getDownloadURL());
  await assertFails(storage.ref(legacyPath).delete());
  await assertFails(
    testEnv.unauthenticatedContext().storage().ref(legacyPath).getDownloadURL(),
  );
  await assertFails(
    storage.ref("users/legacy-marker").put(jpegBytes(), {
      contentType: "application/octet-stream",
    }),
  );
  await assertFails(storage.ref("products").listAll());
});

test("only linked active members can read application images", async () => {
  for (const env of envs) {
    const objectPath = `${env}/images/products/${actors.producer.memberId}/existing.jpg`;
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.storage().ref(objectPath).put(jpegBytes(), {contentType: "image/jpeg"});
    });

    await assertSucceeds(storageFor(actors.member).ref(objectPath).getDownloadURL());
    await assertFails(testEnv.unauthenticatedContext().storage().ref(objectPath).getDownloadURL());
    await assertFails(
      testEnv.authenticatedContext("uid_unlinked").storage().ref(objectPath).getDownloadURL(),
    );
    await assertFails(
      testEnv.authenticatedContext("uid_mismatched").storage().ref(objectPath).getDownloadURL(),
    );
    await assertFails(storageFor(actors.inactive).ref(objectPath).getDownloadURL());
    for (const fixtureUid of [
      "mock_ana_admin_reguerta_app",
      "mock_pablo_producer_reguerta_app",
    ]) {
      await assertFails(
        testEnv.authenticatedContext(fixtureUid)
          .storage()
          .ref(objectPath)
          .getDownloadURL(),
      );
    }
  }
});

test("catalog image writes are scoped to producer or manager ownership", async () => {
  for (const env of envs) {
    await assertSucceeds(
      storageFor(actors.producer)
        .ref(`${env}/images/products/${actors.producer.memberId}/own.jpg`)
        .put(jpegBytes(), {contentType: "image/jpeg"}),
    );
    await assertSucceeds(
      storageFor(actors.manager)
        .ref(`${env}/images/products/${actors.manager.memberId}/own.jpg`)
        .put(jpegBytes(), {contentType: "image/jpeg"}),
    );
    await assertFails(
      storageFor(actors.member)
        .ref(`${env}/images/products/${actors.member.memberId}/forbidden.jpg`)
        .put(jpegBytes(), {contentType: "image/jpeg"}),
    );
    await assertFails(
      storageFor(actors.producer)
        .ref(`${env}/images/products/${actors.member.memberId}/foreign.jpg`)
        .put(jpegBytes(), {contentType: "image/jpeg"}),
    );
  }
});

test("news images are admin-only and shared profile images are owner-only", async () => {
  for (const env of envs) {
    await assertSucceeds(
      storageFor(actors.admin)
        .ref(`${env}/images/news/${actors.admin.memberId}/news.jpg`)
        .put(jpegBytes(), {contentType: "image/jpeg"}),
    );
    await assertFails(
      storageFor(actors.member)
        .ref(`${env}/images/news/${actors.member.memberId}/news.jpg`)
        .put(jpegBytes(), {contentType: "image/jpeg"}),
    );
    await assertSucceeds(
      storageFor(actors.member)
        .ref(`${env}/images/shared_profiles/${actors.member.memberId}/profile.jpg`)
        .put(jpegBytes(), {contentType: "image/jpeg"}),
    );
    await assertFails(
      storageFor(actors.admin)
        .ref(`${env}/images/shared_profiles/${actors.member.memberId}/foreign.jpg`)
        .put(jpegBytes(), {contentType: "image/jpeg"}),
    );
  }
});

test("uploads reject non-JPEG content and payloads larger than two MiB", async () => {
  for (const env of envs) {
    const basePath = `${env}/images/products/${actors.producer.memberId}`;
    await assertFails(
      storageFor(actors.producer)
        .ref(`${basePath}/wrong-type.png`)
        .put(jpegBytes(), {contentType: "image/png"}),
    );
    await assertFails(
      storageFor(actors.producer)
        .ref(`${basePath}/too-large.jpg`)
        .put(jpegBytes(2 * 1024 * 1024 + 1), {contentType: "image/jpeg"}),
    );
  }
});

test("application image namespaces cannot be enumerated", async () => {
  for (const env of envs) {
    await assertFails(
      storageFor(actors.member).ref(`${env}/images/products`).listAll(),
    );
    await assertFails(
      storageFor(actors.admin).ref(`${env}/images/news`).listAll(),
    );
    await assertFails(
      storageFor(actors.member).ref(`${env}/images/shared_profiles`).listAll(),
    );
  }
});
