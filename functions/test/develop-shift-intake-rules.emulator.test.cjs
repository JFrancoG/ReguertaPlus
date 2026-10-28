"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {test} = require("node:test");
const {Firestore} = require("@google-cloud/firestore");
const {initializeTestEnvironment, assertFails, assertSucceeds} = require("@firebase/rules-unit-testing");
const {collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, setLogLevel} = require("firebase/firestore");
const {DEVELOP_SHIFT_INTAKE_PATH} = require("../lib/develop-shift-intake.js");

assert.equal(process.env.GCLOUD_PROJECT, "demo-reguerta-writer-controls");
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8897");
setLogLevel("silent");
const policies = [
  {name: "captured baseline", projectId: "demo-rgt-intake-baseline",
    file: path.join(__dirname, "firestore/fixtures/develop-writer-controls-baseline.rules")},
  {name: "candidate develop write fence", projectId: "demo-rgt-intake-candidate",
    file: path.resolve(__dirname, "../../firestore.develop-writer-controls.rules")},
];

for (const policy of policies) {
  test(`${policy.name}: durable intake root, events, deliveries and chunks deny all client reads and mutations`, async () => {
    assert.equal(DEVELOP_SHIFT_INTAKE_PATH, "shiftPlanningDevelopIntake/current");
    const environment = await initializeTestEnvironment({projectId: policy.projectId,
      firestore: {host: "127.0.0.1", port: 8897, rules: fs.readFileSync(policy.file, "utf8")}});
    const admin = new Firestore({projectId: policy.projectId, host: "127.0.0.1:8897", ssl: false});
    const privatePaths = [DEVELOP_SHIFT_INTAKE_PATH,
      `${DEVELOP_SHIFT_INTAKE_PATH}/events/event-a`,
      `${DEVELOP_SHIFT_INTAKE_PATH}/events/event-a/chunks/0`,
      `${DEVELOP_SHIFT_INTAKE_PATH}/deliveries/delivery-a`];
    const collections = ["shiftPlanningDevelopIntake", `${DEVELOP_SHIFT_INTAKE_PATH}/events`,
      `${DEVELOP_SHIFT_INTAKE_PATH}/events/event-a/chunks`, `${DEVELOP_SHIFT_INTAKE_PATH}/deliveries`];
    const protectedImage = async () => (await admin.getAll(...privatePaths.map((name) => admin.doc(name))))
      .map((snapshot) => ({path: snapshot.ref.path, data: snapshot.data(),
        updateTime: `${snapshot.updateTime.seconds}:${snapshot.updateTime.nanoseconds}`}));
    try {
      await environment.clearFirestore();
      const batch = admin.batch();
      batch.set(admin.doc(privatePaths[0]), {schemaVersion: 1, captureRevision: 1, legacyUntracked: true});
      batch.set(admin.doc(privatePaths[1]), {state: "retained", replayable: false, coreDigest: "private-digest"});
      batch.set(admin.doc(privatePaths[2]), {bytes: Buffer.from("private-original-event-envelope")});
      batch.set(admin.doc(privatePaths[3]), {eventKey: "event-a", metadata: "private-delivery-metadata"});
      batch.set(admin.doc("develop/plus-collections/users/admin"), {
        authUid: "admin-uid", isActive: true, roles: ["admin", "member"], isAdmin: true});
      batch.set(admin.doc("develop/plus-collections/authLinks/admin-uid"), {memberId: "admin"});
      batch.set(admin.doc("develop/plus-collections/users/member"), {
        authUid: "member-uid", isActive: true, roles: ["member"]});
      batch.set(admin.doc("develop/plus-collections/config/ordinary-probe"), {scope: "ordinary-app-data"});
      await batch.commit();
      const before = await protectedImage();
      const contexts = [
        environment.authenticatedContext("admin-uid", {admin: true, roles: ["admin"]}),
        environment.authenticatedContext("member-uid", {roles: ["member"]}),
        environment.unauthenticatedContext(),
      ];
      for (const [index, context] of contexts.entries()) {
        const client = context.firestore();
        if (index < 2) {
          // Both actual policies allow ordinary authenticated app reads. This
          // control prevents a globally deny-all Rules fixture from passing.
          const publicProbe = await assertSucceeds(getDoc(doc(client, "develop/plus-collections/config/ordinary-probe")));
          assert.equal(publicProbe.get("scope"), "ordinary-app-data");
        }
        for (const name of privatePaths) {
          await assertFails(getDoc(doc(client, name)));
          await assertFails(setDoc(doc(client, `${name}-new`), {forged: true}));
          await assertFails(setDoc(doc(client, name), {forged: true}));
          await assertFails(updateDoc(doc(client, name), {forged: true}));
          await assertFails(deleteDoc(doc(client, name)));
        }
        for (const name of collections) await assertFails(getDocs(collection(client, name)));
      }
      assert.deepEqual(await protectedImage(), before);
      for (const name of privatePaths) assert.equal((await admin.doc(`${name}-new`).get()).exists, false);
    } finally {
      await Promise.allSettled([environment.cleanup(), admin.terminate()]);
    }
  });
}
