"use strict";
const {test, after} = require("node:test");
const assert = require("node:assert/strict");
const {Firestore, Timestamp} = require("@google-cloud/firestore");
const {loadExactLegacy, normalize} = require("./develop-legacy-pause-rehearsal-vm.cjs");
const {wrapDevelopLegacyHttp, wrapDevelopLegacyEvent} = require("../lib/develop-shift-intake-bridge.js");
const {LEGACY} = require("../scripts/prepare-develop-intake-bridge.cjs");
assert.equal(process.env.GCLOUD_PROJECT, "demo-reguerta-writer-controls");
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8897");
const db = new Firestore({projectId: "demo-reguerta-writer-controls", host: "127.0.0.1:8897", ssl: false});
after(async () => { await db.terminate(); });
const root = "production/plus-collections";
const date = Timestamp.fromDate(new Date("2027-01-06T00:00:00Z"));

async function seed() {
  await db.recursiveDelete(db.doc(root));
  for (const [id, displayName] of [["a", "Member A"], ["b", "Member B"]]) {
    await db.doc(`${root}/users/${id}`).set({displayName, isActive: true,
      roles: ["member"], producerCatalogEnabled: false, phone: "600000001", createdAt: date});
  }
  await db.doc(`${root}/users/a/devices/one`).set({fcmToken: "demo-token"});
  await db.doc(`${root}/shifts/shift_delivery_20270106`).set({type: "delivery", date,
    assignedUserIds: ["a"], helperUserId: "b", source: "app", status: "confirmed"});
  await db.doc(`${root}/shiftPlanningRequests/req`).set({type: "market", requestedByUserId: "a",
    requestedAt: date, status: "requested"});
  await db.doc(`${root}/notificationEvents/event`).set({title: "Demo notice", body: "Demo body",
    type: "shift_updated", target: "users", targetPayload: {userIds: ["a"]}});
  await db.doc(`${root}/deliveryCalendar/2027-W01`).set({
    deliveryDate: Timestamp.fromDate(new Date("2027-01-07T00:00:00Z")), updatedBy: "a"});
}
async function image() {
  return Object.fromEntries(await Promise.all(["users", "shifts", "shiftPlanningRequests",
    "notificationEvents", "deliveryCalendar"].map(async (collection) => [collection,
    Object.fromEntries((await db.collection(`${root}/${collection}`).get()).docs.map((doc) =>
      [doc.id, normalize(doc.data())]))])));
}
async function invoke(harness, name, omitEnvironment = false) {
  let response;
  const original = harness.handlers[name];
  if (!name.startsWith("on")) {
    const req = {query: omitEnvironment ? {} : {env: "production"}};
    const res = {status(code) { response = {code}; return this; },
      json(body) { response.body = normalize(body); }};
    await original(req, res);
  } else {
    const route = {onShiftPlanningRequestCreated: "shiftPlanningRequests/req",
      onShiftWritten: "shifts/shift_delivery_20270106",
      onDeliveryCalendarOverrideWritten: "deliveryCalendar/2027-W01",
      onNotificationEventCreated: "notificationEvents/event"}[name];
    const after = await harness.snapshot(`${root}/${route}`);
    const event = {id: `production-${name}`, params: {env: "production", requestId: "req",
      shiftId: "shift_delivery_20270106", weekKey: "2027-W01", eventId: "event"},
    data: name.endsWith("Written") ? {before: await harness.snapshot("absent/missing"), after} : after};
    await original(event);
  }
  return response || null;
}

const cases = [...LEGACY.map((name) => ({name, omitEnvironment: false})),
  ...LEGACY.slice(0, 2).map((name) => ({name, omitEnvironment: true}))];
for (const {name, omitEnvironment} of cases) test(
  `emitted bridge preserves production ${name}${omitEnvironment ? " with original production fallback" : ""}`, async () => {
  await seed();
  const options = omitEnvironment ? {defaultEnv: "production"} : {};
  const baseline = loadExactLegacy(db, options);
  const response = await invoke(baseline, name, omitEnvironment);
  const before = await image();
  assert.ok(baseline.mutations.length > 0);
  if (!name.startsWith("on")) assert.equal(response.code, 200);
  if (name === "onShiftPlanningRequestCreated") {
    assert.equal(before.shiftPlanningRequests.req.status, "completed");
    assert.equal(before.shiftPlanningRequests.req.generatedCount, 10);
  }
  if (name === "onShiftWritten") {
    assert.equal(before.shifts.shift_delivery_20270106.syncMeta.exportMode, "updated");
    assert.equal(before.notificationEvents.auto_1.type, "shift_updated");
  }
  if (name === "onDeliveryCalendarOverrideWritten") {
    assert.equal(before.notificationEvents.auto_1.type, "delivery_calendar_updated");
  }
  if (name === "onNotificationEventCreated") {
    assert.equal(before.notificationEvents.event.dispatch.status, "success");
    assert.ok(baseline.mutations.includes("fcm.sendEachForMulticast"));
  }
  await seed();
  const candidate = loadExactLegacy(db, {...options, bridgeWrappers: {
    wrapDevelopLegacyHttp,
    wrapDevelopLegacyEvent: (entry, callback) => wrapDevelopLegacyEvent(
      entry, callback, () => assert.fail("Production must not load capture"),
    ),
  }});
  assert.deepEqual(await invoke(candidate, name, omitEnvironment), response);
  assert.deepEqual(candidate.trace, baseline.trace);
  assert.deepEqual(await image(), before);
});
