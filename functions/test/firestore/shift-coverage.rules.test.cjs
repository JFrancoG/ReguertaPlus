"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {test} = require("node:test");
const {initializeTestEnvironment, assertFails, assertSucceeds} = require("@firebase/rules-unit-testing");
const collections = ["shiftDeliverySpacingExceptions", "shiftDeliverySpacingOperations",
  "shiftCoverageEffects", "shiftCoverageProjectionState", "shiftMembershipState", "shiftMembershipOperations", "shiftCoverageBeaconRounds", "shiftCoverageReserves", "shiftCoverageCreditPlans", "shiftCoverageCreditUnits",
  "shiftCoverageCases", "shiftCoverageOperations", "shiftCoverageMigrations", "shiftCoveragePublicWrites", "shiftSheetsOrdinaryOperations", "shiftCoverageSlots",
  "shiftCoverageMemberClaims", "shiftCoverageCredits", "shiftCoverageLedgerState"];

for (const policy of ["strict", "phase1", "develop-coverage"]) {
  // The successor changes only Develop and retains the production fence policy.
  const environments = policy === "develop-coverage" ? ["develop"] : ["develop", "production"];
  test(`${policy}: coverage state is backend-only even for authenticated administrators`, async () => {
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
    const env = await initializeTestEnvironment({projectId: `demo-reguerta-hu084-rules-${policy}`,
      firestore: {host, port: Number(port), rules: fs.readFileSync(
        path.resolve(__dirname, `../../../firestore.${policy}.rules`), "utf8")}});
    try {
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        for (const environment of environments) {
          const root = `${environment}/plus-collections`;
          await db.doc(`${root}/users/admin`).set({authUid: "admin-uid", isActive: true,
            roles: ["admin", "member"], isCommonPurchaseManager: false});
          await db.doc(`${root}/authLinks/admin-uid`).set({memberId: "admin"});
          for (const collection of collections) await db.doc(`${root}/${collection}/existing`).set({revision: 1});
          for (const child of ["recoveryAuthorizations", "recoveries", "pushes"]) {
            await db.doc(`${root}/shiftCoverageEffects/existing/${child}/private`).set({revision: 1});
          }
        }
      });
      for (const db of [env.authenticatedContext("admin-uid").firestore(),
        env.authenticatedContext("member-uid").firestore(), env.unauthenticatedContext().firestore()]) {
        for (const environment of environments) {
          for (const child of ["recoveryAuthorizations", "recoveries", "pushes"]) {
            const ref = db.doc(`${environment}/plus-collections/shiftCoverageEffects/existing/${child}/private`);
            await assertFails(ref.get());
            await assertFails(ref.set({actorId: "admin", state: "accepted"}));
            await assertFails(ref.update({revision: 2}));
            await assertFails(ref.delete());
          }
          for (const collection of collections) {
            const ref = db.collection(`${environment}/plus-collections/${collection}`);
            await assertFails(ref.doc("existing").get());
            await assertFails(ref.get());
            await assertFails(ref.doc("new").set({revision: 1}));
            await assertFails(ref.doc("existing").update({revision: 2}));
            await assertFails(ref.doc("existing").delete());
            await assertFails(ref.doc("existing/events/forged").set({accepted: true}));
          }
        }
      }
    } finally { await env.cleanup(); }
  });
}

test("the Develop coverage successor preserves every predecessor write grant in its original match", () => {
  const policies = ["develop-writer-controls", "develop-coverage"].map((name) =>
    fs.readFileSync(path.resolve(__dirname, `../../../firestore.${name}.rules`), "utf8"));
  const grants = (rules) => rules.split(/\bmatch /).slice(1).flatMap((block) => {
    const path = block.slice(0, block.indexOf(" {"));
    return [...block.matchAll(/allow ([\w, ]+):([^;]+);/g)]
      .filter(([, methods]) => /create|update|delete|write/.test(methods))
      .map(([, methods, predicate]) => [path, methods, predicate.trim().replace(/\s+/g, " ")]);
  });
  assert.deepEqual(grants(policies[1]), grants(policies[0]));
});

for (const policy of ["phase1", "develop-coverage"]) {
  test(`${policy}: Develop permits the member inbox and protects account, destination and recovery authority`, async () => {
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
    const env = await initializeTestEnvironment({projectId: `demo-hu084-delivery-${policy}`,
      firestore: {host, port: Number(port), rules: fs.readFileSync(
        path.resolve(__dirname, `../../../firestore.${policy}.rules`), "utf8")}});
    const root = "develop/plus-collections";
    const member = env.authenticatedContext("u-member").firestore();
    const admin = env.authenticatedContext("u-admin").firestore();
    const guest = env.unauthenticatedContext().firestore();
    const inactive = env.authenticatedContext("u-inactive").firestore();
    const stale = env.authenticatedContext("u-stale").firestore();
    const user = "users/member", device = user + "/devices/phone", notice = user + "/notificationInbox/notice";
    try {
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore(), batch = db.batch();
        for (const id of ["member", "admin", "inactive", "no-role"]) {
          batch.set(db.doc(`${root}/users/${id}`), {authUid: "u-" + id, isActive: id !== "inactive",
            roles: id === "no-role" ? [] : id === "admin" ? ["admin", "member"] : ["member"]});
          batch.set(db.doc(`${root}/authLinks/u-${id}`), {memberId: id});
        }
        batch.set(db.doc(`${root}/authLinks/u-stale`), {memberId: "member"});
        for (const item of [device, notice, "config/global", "config/member", "config/public",
          "notificationEvents/private", "shiftCoverageProjectionState/pushRetries/operations/retry"]) {
          batch.set(db.doc(`${root}/${item}`), {value: true});
        }
        await batch.commit();
      });
      const ref = (db, name) => db.doc(`${root}/${name}`);
      await assertSucceeds(ref(member, notice).get());
      await assertSucceeds(member.collection(`${root}/${user}/notificationInbox`).get());
      await assertSucceeds(ref(member, device).get());
      await assertSucceeds(ref(member, "authLinks/u-member").get());
      await assertSucceeds(ref(guest, "config/public").get());
      await assertSucceeds(ref(member, "config/member").get());
      await assertSucceeds(ref(admin, "config/global").get());
      await assertFails(ref(member, "config/global").get());
      await assertFails(member.collection(`${root}/config`).get());
      for (const db of [guest, admin, stale]) {
        await assertFails(ref(db, notice).get());
        await assertFails(db.collection(`${root}/${user}/notificationInbox`).get());
        await assertFails(ref(db, device).get());
        await assertFails(ref(db, device).set({fcmToken: "another-device"}));
        await assertFails(ref(db, "authLinks/u-member").get());
      }
      await assertFails(ref(inactive, "users/inactive/notificationInbox/notice").get());
      const noRole = env.authenticatedContext("u-no-role").firestore();
      await assertFails(ref(noRole, "users/no-role/notificationInbox/notice").get());
      for (const db of [member, admin]) {
        await assertFails(ref(db, notice).set({value: false}));
        await assertFails(ref(db, notice).delete());
        await assertFails(ref(db, "authLinks/u-member").update({memberId: "other"}));
        await assertFails(ref(db, user).update({authUid: "different-uid"}));
        await assertFails(ref(db, user).update({roles: ["admin"]}));
        for (const field of ["normalizedEmail", "emailNormalized", "email"]) {
          await assertFails(ref(db, user).update({[field]: "member@example.invalid"}));
        }
        await assertFails(ref(db, "config/public").update({setting: true}));
        await assertFails(ref(db, "config/global").update({setting: true}));
        await assertFails(ref(db, "shiftCoverageProjectionState/pushRetries/operations/retry").get());
        await assertFails(ref(db, "notificationEvents/private").get());
      }
      if (policy === "develop-coverage") {
        for (const item of [device, user + "/notificationReads/notice", "products/sample",
          "shifts/market", "shiftSwapRequests/swap", "orders/request", "config/member"]) {
          await assertFails(ref(member, item).set({value: true}));
        }
        await assertFails(member.doc("develop/collections/products/sample").set({value: true}));
        // The predecessor's production access remains in force.
        await assertSucceeds(member.doc("production/plus-collections/" + notice).get());
        await assertSucceeds(member.doc("production/plus-collections/products/sample").set({value: true}));
      } else {
        await assertSucceeds(ref(member, device).set({fcmToken: "owned-device"}));
        await assertSucceeds(member.doc("production/plus-collections/" + notice).get());
      }
    } finally { await env.cleanup(); }
  });
}
