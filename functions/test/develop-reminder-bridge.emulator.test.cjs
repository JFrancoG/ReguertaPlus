"use strict";
const {test, after} = require("node:test"), assert = require("node:assert/strict");
const {Firestore} = require("@google-cloud/firestore");
const {loadExactLegacy, normalize} = require("./develop-legacy-pause-rehearsal-vm.cjs");
const bridge = require("../lib/develop-shift-intake-bridge.js");
const {REMINDERS} = require("../scripts/prepare-develop-intake-bridge.cjs");
assert.ok(process.env.HU084_REMAINING_LEGACY_SOURCES);
assert.equal(process.env.GCLOUD_PROJECT, "demo-reguerta-writer-controls");
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8897");
const db = new Firestore({projectId: "demo-reguerta-writer-controls", host: "127.0.0.1:8897", ssl: false});
after(async () => db.terminate());
const seed = async () => {
  for (const env of ["develop", "production"]) {
    await db.recursiveDelete(db.doc(`${env}/plus-collections`));await db.recursiveDelete(db.doc(`${env}/collections`));
    await db.doc(`${env}/plus-collections/users/member-a`).create({roles: ["member"], isActive: true});
  }
};
const image = async env => (await db.collection(`${env}/plus-collections/notificationEvents`).get()).docs.map(doc => {
  const data = normalize(doc.data());delete data.sentAt;return {id: doc.id, data};
});
const load = (env, wrapped, overrides = {}) => loadExactLegacy(db, {reminders: true, defaultEnv: env,
  fixedTimestampMillis: Date.parse("2026-10-28T12:00:00Z"), ...overrides,
  ...(wrapped ? {administrativeBridgeWrappers: bridge} : {})});
for (const name of REMINDERS) test(`exact archived ${name} writes before guard, while default develop guard performs zero original operations`, async () => {
  await seed();const original = load("develop", false);await original.handlers[name]();
  assert.equal((await image("develop")).length, 1);assert.ok(original.mutations.length > 0);
  await seed();const candidate = load("develop", true);
  await assert.rejects(candidate.handlers[name]({jobName: "manual-invocation"}), /develop_legacy_intake_closed/);
  assert.deepEqual(candidate.trace, []);assert.deepEqual(candidate.mutations, []);
  assert.deepEqual(await image("develop"), []);assert.deepEqual(await image("production"), []);
});
for (const name of REMINDERS) test(`exact archived ${name} retains production result, effects and port ordering when explicitly targeting production`, async () => {
  await seed();const original = load("production", false);await original.handlers[name]();const before = await image("production");
  assert.equal(before.length, 1);
  await seed();const candidate = load("production", true);await candidate.handlers[name]();
  assert.deepEqual(await image("production"), before);assert.deepEqual(candidate.trace, original.trace);
  assert.deepEqual(await image("develop"), []);
});
test("original default-local fallback and mixed overrides cannot escape the develop guard", async () => {
  await seed();
  for (const options of [{defaultEnv: "local"}, {reminderEnvs: "production,develop"}, {reminderEnvs: " DEVELOP "}]) {
    const candidate = load("production", true, options);
    await assert.rejects(candidate.handlers[REMINDERS[0]](), /develop_legacy_intake_closed/);assert.deepEqual(candidate.trace, []);
  }
});
