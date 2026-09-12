"use strict";
const fs = require("node:fs");
const path = require("node:path");
const {test} = require("node:test");
const {initializeTestEnvironment, assertFails} = require("@firebase/rules-unit-testing");
const collections = ["shiftCoverageReserves", "shiftCoverageCases", "shiftCoverageOperations", "shiftCoverageSlots",
  "shiftCoverageMemberClaims", "shiftCoverageCredits", "shiftCoverageLedgerState"];

for (const policy of ["strict", "phase1"]) {
  test(`${policy}: coverage state is backend-only even for authenticated administrators`, async () => {
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
    const env = await initializeTestEnvironment({projectId: `demo-reguerta-hu084-rules-${policy}`,
      firestore: {host, port: Number(port), rules: fs.readFileSync(
        path.resolve(__dirname, `../../../firestore.${policy}.rules`), "utf8")}});
    try {
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        for (const environment of ["develop", "production"]) {
          const root = `${environment}/plus-collections`;
          await db.doc(`${root}/users/admin`).set({authUid: "admin-uid", isActive: true,
            roles: ["admin", "member"], isCommonPurchaseManager: false});
          await db.doc(`${root}/authLinks/admin-uid`).set({memberId: "admin"});
          for (const collection of collections) await db.doc(`${root}/${collection}/existing`).set({revision: 1});
        }
      });
      for (const db of [env.authenticatedContext("admin-uid").firestore(),
        env.authenticatedContext("member-uid").firestore(), env.unauthenticatedContext().firestore()]) {
        for (const environment of ["develop", "production"]) {
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
