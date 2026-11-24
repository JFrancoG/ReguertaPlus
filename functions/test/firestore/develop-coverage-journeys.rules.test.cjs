"use strict";

const assert = require("node:assert/strict");
const {before, after, test} = require("node:test");
const {assertFails, assertSucceeds, initializeTestEnvironment} = require("@firebase/rules-unit-testing");
const {doc, getDoc, getDocs, collection, setDoc, writeBatch, setLogLevel} = require("firebase/firestore");
const {renderJourneyRules} = require("../../scripts/prepare-develop-coverage-journeys.cjs");

assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8897");
assert.equal(process.env.GCLOUD_PROJECT, "demo-reguerta-coverage-journeys");
setLogLevel("silent");
const root = "develop/plus-collections";
let emulator;
const dbFor = (id) => emulator.authenticatedContext("account-" + id).firestore();
const ref = (db, path) => doc(db, root + "/" + path);
const roster = ["member", "admin", "revoked-admin"];
const profile = (id) => ({authUid: "account-" + id, isActive: true,
  roles: id === "member" ? ["member"] : ["member", "admin"]});
const device = {deviceId: "iphone", platform: "ios", appVersion: "1", osVersion: "26.5",
  firstSeenAt: new Date(), lastSeenAt: new Date(), firebaseInstallationId: "synthetic-installation"};

const planned = (id, actor) => ({schemaVersion: 2, requestId: id, environment: "develop", bundleId: "bundle",
    requestedByUserId: actor, requestedAt: new Date(), mode: "preview", status: "requested",
    expectedWriteEpoch: 1, expectedActiveRevision: "active", binding: null,
    subplans: {delivery: {targetSeasonStartYear: 2026}, market: {targetSeasonStartYear: 2026}}});

before(async () => {
  emulator = await initializeTestEnvironment({projectId: process.env.GCLOUD_PROJECT,
    firestore: {host: "127.0.0.1", port: 8897, rules: renderJourneyRules(roster)}});
  await emulator.clearFirestore();
  await emulator.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const id of [...roster, "other-admin"]) {
      await setDoc(ref(db, "authLinks/account-" + id), {memberId: id});
      await setDoc(ref(db, "users/" + id), profile(id));
    }
    await setDoc(ref(db, "users/member/notificationInbox/offer"), {event: "offer"});
  });
});
after(async () => { if (emulator) await emulator.cleanup(); });

test("journey members can register a device atomically and read and mark their own notice", async () => {
  const db = dbFor("member");
  const batch = writeBatch(db);
  batch.set(ref(db, "users/member/devices/iphone"), device);
  batch.update(ref(db, "users/member"), {lastDeviceId: "iphone"});
  await assertSucceeds(batch.commit());
  await assertSucceeds(getDoc(ref(db, "users/member/notificationInbox/offer")));
  await assertSucceeds(setDoc(ref(db, "users/member/notificationReads/offer"), {notificationEventId: "offer", readAt: new Date()}));
  await assertFails(setDoc(ref(db, "users/member/notificationInbox/offer"), {event: "changed"}));
  await assertFails(setDoc(ref(db, "users/admin/devices/iphone"), device));
  await assertFails(setDoc(ref(dbFor("other-admin"), "users/other-admin/devices/iphone"), device));
});

test("only invited administrators submit a validated planning request and read its candidate", async () => {
  const db = dbFor("admin");
  const request = (client, id) => ref(client, "shiftPlanningRequests/" + id);
  await assertSucceeds(setDoc(request(db, "preview"), planned("preview", "admin")));
  await assertSucceeds(getDoc(request(db, "preview")));
  await assertSucceeds(getDocs(collection(db, root + "/shiftPlanningCandidates/bundle/positions")));
  await assertFails(setDoc(request(db, "invalid"), {...planned("invalid", "admin"), status: "completed"}));
  for (const id of ["member", "other-admin"]) {
    await assertFails(setDoc(request(dbFor(id), id), planned(id, id)));
  }
  await assertFails(setDoc(ref(db, "shiftCoverageEffects/receipt"), {state: "completed"}));
  await assertFails(setDoc(ref(db, "shifts/shift"), {state: "completed"}));
});

test("Android merges its installation and lastDeviceId atomically on registration and refresh", async () => {
  const db = dbFor("member");
  const user = ref(db, "users/member"), phone = ref(db, "users/member/devices/android");
  const registered = new Date("2026-11-24T09:00:00Z"), refreshed = new Date("2026-11-24T09:01:00Z");
  const registration = {deviceId: "android", platform: "android", apiLevel: 35, osVersion: "15",
    manufacturer: "test", model: "test", appVersion: "1", lastSeenAt: registered,
    fcmToken: null, tokenUpdatedAt: null, firebaseInstallationId: "android-installation",
    registrationUpdatedAt: registered};
  assert.equal((await getDoc(phone)).exists(), false);
  const create = writeBatch(db);
  create.set(phone, {...registration, firstSeenAt: registered}, {merge: true});
  create.set(user, {lastDeviceId: "android"}, {merge: true});
  await assertSucceeds(create.commit());
  const update = writeBatch(db);
  update.set(phone, {...registration, lastSeenAt: refreshed}, {merge: true});
  update.set(user, {lastDeviceId: "android"}, {merge: true});
  await assertSucceeds(update.commit());
  const saved = (await getDoc(phone)).data();
  assert.equal(saved.firstSeenAt.toMillis(), registered.getTime());
  assert.equal(saved.lastSeenAt.toMillis(), refreshed.getTime());
  assert.equal(saved.firebaseInstallationId, registration.firebaseInstallationId);
  assert.equal((await getDoc(user)).data().lastDeviceId, "android");
});

test("an invited administrator stages the exact completed preview from their native request", async () => {
  const db = dbFor("admin"), preview = planned("preview-to-stage", "admin");
  const previewPath = "shiftPlanningRequests/" + preview.requestId;
  await assertSucceeds(setDoc(ref(db, previewPath), preview));
  const revision = {bundleRevision: "revision-1", bundleDigest: "shift-planning:v1:sha256:" + "a".repeat(64)};
  const stage = {...planned("stage", "admin"), mode: "stage",
    binding: {kind: "preview", sourceRequestId: preview.requestId, ...revision}};
  const stageDoc = ref(db, "shiftPlanningRequests/stage");
  await assertFails(setDoc(stageDoc, stage));
  const receipt = {requestId: preview.requestId, bundleId: preview.bundleId, environment: preview.environment,
    requestedByUserId: preview.requestedByUserId, ...revision};
  await emulator.withSecurityRulesDisabled(async (context) => {
    await setDoc(ref(context.firestore(), previewPath), {...preview, status: "completed", lifecycle: {
      state: "completed", summary: {status: "completed", mode: "preview", bundleId: preview.bundleId, ...revision},
      artifact: {kind: "preview", receipt},
    }});
  });
  await assertSucceeds(setDoc(stageDoc, stage));
  assert.deepEqual((await getDoc(stageDoc)).data().binding, stage.binding);
});

test("the same invited session loses its planning rights on demotion and its member rights on deactivation", async () => {
  const id = "revoked-admin", db = dbFor(id), ownProfile = "users/" + id;
  const requestDoc = (key) => ref(db, "shiftPlanningRequests/" + key);
  await assertSucceeds(setDoc(requestDoc("before-revocation"), planned("before-revocation", id)));
  const setAccess = (fields) => emulator.withSecurityRulesDisabled(async (context) => {
    await setDoc(ref(context.firestore(), ownProfile), fields, {merge: true});
  });
  await setAccess({roles: ["member"]});
  await assertFails(getDoc(requestDoc("before-revocation")));
  await assertFails(setDoc(requestDoc("after-demotion"), planned("after-demotion", id)));
  const inboxDoc = ref(db, ownProfile + "/notificationInbox/notice");
  await assertSucceeds(getDoc(inboxDoc));
  await setAccess({isActive: false});
  await assertFails(getDoc(inboxDoc));
  await assertFails(setDoc(ref(db, ownProfile + "/devices/iphone"), device));
  await assertFails(setDoc(ref(db, ownProfile + "/notificationReads/notice"),
    {notificationEventId: "notice", readAt: new Date()}));
});

test("offline preparation rejects an empty, duplicate or malformed roster", () => {
  for (const roster of [[], ["x", "x"], ["member/child"], null]) assert.throws(() => renderJourneyRules(roster));
});
