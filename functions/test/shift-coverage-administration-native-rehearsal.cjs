"use strict";
// Opt-in fixture; destructive preparation is restricted to the fixed demo only.
const {initializeApp, deleteApp} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {createProvisionalCreditFirestore} = require("../lib/shift-credit-publication.js");
const {startProvisionalShiftCoverageServer} = require("../lib/shift-coverage-local-server.js");
const {SHIFT_COVERAGE_POLICY_REVISION} = require("../lib/shift-coverage.js");
const {seedSpacingAdministration} = require("./shift-coverage-spacing-administration-fixture.cjs");
const projectId = "demo-reguerta-hu084-coverage", root = "develop/plus-collections";
const main = async () => {
  const [mode, smoke] = process.argv.slice(2);
  if (!["membership", "spacing"].includes(mode) || (smoke !== undefined && smoke !== "--smoke") ||
      process.argv.length > 4 || process.env.GCLOUD_PROJECT !== projectId ||
      process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8798" ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9098") throw new Error("Fixed demo and membership|spacing mode required");
  const db = createProvisionalCreditFirestore();
  const app = initializeApp({projectId}, "native-administration-rehearsal");
  const auth = getAuth(app); let server;
  const close = async () => {
    try { if (server) await server.close(); } finally {
      try { await db.terminate(); } finally { await deleteApp(app); }
    }
  };
  try {
    await db.recursiveDelete(db.doc(root));
    const reset = await fetch(`http://127.0.0.1:9098/emulator/v1/projects/${projectId}/accounts`, {method: "DELETE"});
    if (!reset.ok) throw new Error("Local Auth fixture reset failed");
    await seedSpacingAdministration(db);
    const ref = (collection, id) => db.doc(`${root}/${collection}/${id}`);
    if (mode === "membership") {
      await ref("shiftPlanningState", "current").update({maintenanceStatus: "open", intakeBarrier: null});
      await ref("shiftPlanningState", "sourcePolicy").delete();
      await ref("shiftPlanningRequests", "request-preview-2026").delete();
      for (const [id, name, active] of [["reserve-example", "Socio de ensayo: reserva", true],
        ["departure-example", "Socio de ensayo: baja permanente", false]]) {
        await ref("users", id).set({displayName: name, isActive: active, roles: ["member"], isCommonPurchaseManager: false});
      }
      await ref("shiftCoverageCredits", "sample-earned-service").set({schemaVersion: 1,
        policyRevision: SHIFT_COVERAGE_POLICY_REVISION, id: "sample-earned-service", caseId: "sample-earned-service",
        shiftId: "sample-completed-delivery", type: "delivery", userId: "departure-example", state: "pending",
        earnedAtMillis: Date.parse("2026-05-31T00:00:00Z"), completionRevision: 1});
      const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
      await ref("shiftCoverageMemberClaims", digest(["delivery", "departure-example"]).split(":").at(-1))
        .set({type: "delivery", userId: "departure-example", caseId: "sample-earned-service", state: "creditPending"});
      await ref("shiftCoverageLedgerState", "delivery").set({revision: 1});
    }
    await auth.createUser({uid: "native-administration-admin", email: "admin@example.test",
      password: "local-fixture-password", emailVerified: true});
    await ref("authLinks", "native-administration-admin").set({memberId: "member-1"});
    await ref("users", "member-1").update({authUid: "native-administration-admin"});
    server = await startProvisionalShiftCoverageServer({nowMillis: () => Date.parse("2026-06-01T00:00:00Z"),
      maximumOfferWindowMillis: 86_400_000, selectionPolicy: {version: "hu089-provisional-v1"}}, smoke ? 0 : 8799);
    const signed = await fetch("http://127.0.0.1:9098/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key", {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({email: "admin@example.test", password: "local-fixture-password", returnSecureToken: true})});
    if (!signed.ok) throw new Error("Local Auth fixture sign-in failed");
    const token = (await signed.json()).idToken;
    const checked = await fetch(server.url, {method: "POST", headers: {authorization: `Bearer ${token}`,
      "Content-Type": "application/json"}, body: JSON.stringify({schemaVersion: 1, environment: "develop", action: "administration"})});
    const response = await checked.json();
    if (!checked.ok || response.data.membershipWritable !== (mode === "membership") ||
        (mode === "spacing" && !response.data.spacingCandidates.length)) throw new Error("Local administration fixture verification failed");
    process.stdout.write(`Local administration ${mode} ready; virtual time 2026-06-01T00:00:00Z; API ${server.url}\n`);
    if (smoke) return;
    await new Promise((resolve) => { process.once("SIGINT", resolve); process.once("SIGTERM", resolve); });
  } finally { await close(); }
};
main().catch(() => { process.stderr.write("Local administration rehearsal failed; check fixed demo services and mode.\n"); process.exitCode = 1; });
