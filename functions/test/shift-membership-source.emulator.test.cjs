"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");

const projectId = process.env.GCLOUD_PROJECT;
const enabled = ["demo-reguerta-hu084-coverage", "demo-reguerta-d01-writer"].includes(projectId) &&
  process.env.FIRESTORE_EMULATOR_HOST === "127.0.0.1:8798";

test("member administration stamps eligibility transitions at commit time and preserves them across other edits", {skip: !enabled}, async (t) => {
  const {upsertMemberByAdmin} = require("../lib/index.js");
  const {getAuth} = require("firebase-admin/auth");
  const {getFirestore} = require("firebase-admin/firestore");
  const {deleteApp, getApp} = require("firebase-admin/app");
  const db = getFirestore();
  const root = "develop/plus-collections";
  const uid = "d01-source-admin";
  const link = db.doc(`${root}/authLinks/${uid}`);
  const admin = db.doc(`${root}/users/${uid}`);
  const target = db.doc(`${root}/users/d01-source-member`);
  const source = db.doc(`${root}/shiftMembershipState/${target.id}/source/eligibility`);
  t.after(async () => {
    await Promise.all([link.delete(), admin.delete(), target.delete(), source.delete()]);
    await deleteApp(getApp());
  });
  t.mock.method(getAuth(), "verifyIdToken", async () => ({uid}));
  await Promise.all([link.set({memberId: uid}), admin.set({isActive: true,
    roles: ["member", "admin"], authUid: uid}), target.delete(), source.delete()]);

  const baseline = {memberId: target.id, normalizedEmail: "d01-source@example.test", displayName: "D01",
    isActive: true, roles: ["member"], isCommonPurchaseManager: false};
  async function save(changes = {}) {
    const response = {
      status(code) { this.code = code; return this; },
      json(value) { this.body = value; },
    };
    await upsertMemberByAdmin({method: "POST", headers: {authorization: "Bearer local-identity"},
      body: {environment: "develop", ...baseline, ...changes}}, response);
    assert.equal(response.code, 200, JSON.stringify(response.body));
    const [member, period] = await db.getAll(target, source);
    return {member, period};
  }

  function assertTransition({member, period}, expected) {
    const {transitionId, ...fields} = period.data();
    assert.match(transitionId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.deepEqual(fields, expected);
    assert.ok(period.updateTime.isEqual(member.updateTime), "same atomic commit");
  }

  const created = await save();
  assertTransition(created, {eligible: true});
  assert.ok(created.period.updateTime.isEqual(created.member.createTime));
  // Firestore retains private descendants when an account is removed. Even a
  // recreation with identical eligibility must advance the evidence version.
  await target.delete();
  const recreated = await save();
  assertTransition(recreated, {eligible: true, previousExclusion: "excusedDeparture"});
  assert.ok(recreated.period.updateTime.isEqual(recreated.member.createTime));
  assert.notEqual(recreated.period.get("transitionId"), created.period.get("transitionId"));
  await target.delete();
  const repeated = await save();
  assertTransition(repeated, {eligible: true, previousExclusion: "excusedDeparture"});
  assert.ok(repeated.period.updateTime.isEqual(repeated.member.createTime));
  assert.notEqual(repeated.period.get("transitionId"), recreated.period.get("transitionId"));

  const renamed = await save({displayName: "Renamed", roles: ["member", "admin"]});
  assert.ok(renamed.period.updateTime.isEqual(repeated.period.updateTime));
  assert.ok(!renamed.member.updateTime.isEqual(repeated.period.updateTime));

  assertTransition(await save({isActive: false}), {eligible: false});
  assertTransition(await save(), {eligible: true, previousExclusion: "excusedDeparture"});
  assertTransition(await save({roles: ["member", "producer"], companyName: "Demo grower"}), {eligible: false});
  const manager = await save({roles: ["member", "producer"], isCommonPurchaseManager: true});
  assertTransition(manager, {eligible: true, previousExclusion: "excusedIneligible"});
  const profile = await save({displayName: "Manager", producerCatalogEnabled: false,
    previousExclusion: "excusedDeparture", eligible: false});
  assert.ok(profile.period.updateTime.isEqual(manager.period.updateTime));
  assert.deepEqual(profile.period.data(), manager.period.data());

  // An older, continuously eligible source has no provable transition date.
  await Promise.all([source.delete(), target.set(baseline)]);
  const legacy = await save({displayName: "Legacy profile"});
  assert.equal(legacy.period.exists, false);
});
