"use strict";
// Opt-in native rehearsal. All destructive setup is confined to the fixed demo emulators.
const {initializeApp, deleteApp} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {createProvisionalCreditFirestore} = require("../lib/shift-credit-publication.js");
const {startProvisionalShiftCoverageServer} = require("../lib/shift-coverage-local-server.js");
const {materialize, initialTime, activeDigest} = require("./shift-coverage-fixture.cjs");
const projectId = "demo-reguerta-hu084-coverage", root = "develop/plus-collections";

const main = async () => {
  if (process.env.GCLOUD_PROJECT !== projectId || process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8798" ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9098") throw new Error("Fixed demo emulators required");
  const db = createProvisionalCreditFirestore();
  const app = initializeApp({projectId}, "native-rehearsal");
  const auth = getAuth(app);
  await db.recursiveDelete(db.doc(root));
  const reset = await fetch(`http://127.0.0.1:9098/emulator/v1/projects/${projectId}/accounts`, {method: "DELETE"});
  if (!reset.ok) throw new Error("Auth fixture reset failed");
  const ref = (collection, id) => db.doc(`${root}/${collection}/${id}`);
  const tokens = {};
  for (const id of ["a", "b", "c", "d", "e", "admin"]) {
    await auth.createUser({uid: `auth-${id}`, email: `${id}@example.test`, password: "local-fixture-password", emailVerified: true});
    await ref("authLinks", `auth-${id}`).set({memberId: id});
    await ref("users", id).set({authUid: `auth-${id}`, displayName: `Socio de prueba ${id}`,
      isActive: true, isCommonPurchaseManager: false, roles: id === "admin" ? ["member", "admin"] : ["member"]});
    const login = await fetch("http://127.0.0.1:9098/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key", {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({email: `${id}@example.test`, password: "local-fixture-password", returnSecureToken: true})});
    if (!login.ok) throw new Error("Fixture login failed");
    tokens[id] = (await login.json()).idToken;
  }
  await ref("shiftPlanningState", "current").set({schemaVersion: 1, stateRevision: 1, writeEpoch: 1,
    maintenanceStatus: "open", activeRevision: "active-1", activeDigest, intakeBarrier: null, lastTransitionId: "initial"});
  for (const [id, type, date, assigned, helper] of [
    ["shift_delivery_20270825", "delivery", "2027-08-25", ["b"], "a"],
    ["shift_delivery_20270908", "delivery", "2027-09-08", ["c"], "b"],
    ["shift_delivery_20270901", "delivery", "2027-09-01", ["a"], "c"],
    ["shift_market_20270904", "market", "2027-09-04", ["a", "b", "c"], null],
  ]) await ref("shifts", id).set(materialize(id, type, date, assigned, helper));
  let now = initialTime, sequence = 0;
  const server = await startProvisionalShiftCoverageServer({nowMillis: () => now, maximumOfferWindowMillis: 86400000,
    selectionPolicy: {version: "fifo-signup-v1", volunteerWindowMillis: 3600000}}, 8799);
  const command = async (actor, caseId, action, extra = {}) => {
    const item = (await ref("shiftCoverageCases", caseId).get()).data()?.value;
    const shiftId = extra.shiftId ?? item.shiftId;
    const shift = (await ref("shifts", shiftId).get()).data();
    const response = await fetch(server.url, {method: "POST", headers: {"Content-Type": "application/json",
      authorization: `Bearer ${tokens[actor]}`}, body: JSON.stringify({schemaVersion: 1, environment: "develop", caseId,
      operationId: `native-seed-${++sequence}`, expectedRevision: item?.revision ?? 0,
      expectedShiftRevision: shift.documentRevision, action, ...extra})});
    if (!response.ok) throw new Error(`Seed action failed: ${JSON.stringify(await response.json())}`);
  };
  await command("a", "native-delivery", "open", {shiftId: "shift_delivery_20270901", absentUserId: "a", reason: "Ensayo de reparto"});
  await command("admin", "native-delivery", "offer", {userId: "e", reason: "Acuerdo de prueba", expiresAtMillis: now + 3600000});
  await command("e", "native-delivery", "accept");
  now = Date.parse("2027-09-02T10:00:00Z");
  await command("a", "native-market", "open", {shiftId: "shift_market_20270904", absentUserId: "a", reason: "Ensayo de mercado"});
  await command("admin", "native-market", "offer", {userId: "d", reason: "Acuerdo de prueba", expiresAtMillis: now + 86400000});
  process.stdout.write("Native rehearsal ready on 127.0.0.1:8799; virtual time 2027-09-02T10:00:00Z\n");
  let closing = false;
  const close = async () => {
    if (closing) return; closing = true;
    await server.close(); await db.terminate(); await deleteApp(app);
  };
  process.once("SIGINT", close); process.once("SIGTERM", close);
};
main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
