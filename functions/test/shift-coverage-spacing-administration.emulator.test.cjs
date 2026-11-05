"use strict";
const assert = require("node:assert/strict");
const {test, before, beforeEach, after} = require("node:test");
const {Timestamp} = require("@google-cloud/firestore");
const {createProvisionalCreditFirestore} = require("../lib/shift-credit-publication.js");
const {createDeliverySpacingAdministration} = require("../lib/shift-delivery-spacing-store.js");
const {readSpacingAdministration, assertSpacingAdministrationContext} = require("../lib/shift-coverage-spacing-administration.js");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {parseShiftPlanningRequestV2, buildShiftPlanningFailureSummary} = require("../lib/shift-planning-wire.js");
const {request} = require("./shift-planning-activation-fixture.cjs");
const {seedSpacingAdministration} = require("./shift-coverage-spacing-administration-fixture.cjs");
const enabled = process.env.GCLOUD_PROJECT === "demo-reguerta-hu084-coverage" &&
  process.env.FIRESTORE_EMULATOR_HOST === "127.0.0.1:8798";
const run = (name, fn) => test(name, {skip: !enabled}, fn);
const root = "develop/plus-collections", now = Date.parse("2026-06-01T00:00:00Z");
let db, writer;
const ref = (collection, id) => db.doc(`${root}/${collection}/${id}`);
const capture = async () => {
  const names = (await db.doc(root).listCollections()).map((collection) => collection.id).sort();
  return Promise.all(names.map(async (name) => [name,
    (await db.collection(`${root}/${name}`).orderBy("__name__").get()).docs.map((doc) => [doc.id, doc.data()])]));
};
const read = () => db.runTransaction((transaction) => readSpacingAdministration(db, transaction, now));
const select = (candidate) => ({proposalId: candidate.id, expectedContextDigest: candidate.contextDigest,
  userId: candidate.userId, planningRequestId: candidate.planningRequestId,
  previousDate: candidate.previousDate, previousRoundNumber: candidate.previousRoundNumber,
  date: candidate.date, roundNumber: candidate.roundNumber});
const authorize = (choice, extra = {}, actor = "member-1") => {
  const command = {schemaVersion: 1, environment: "develop", operationId: "authorize-native-spacing",
    planningRequestId: choice.planningRequestId, userId: choice.userId, previousDate: choice.previousDate,
    previousRoundNumber: choice.previousRoundNumber, date: choice.date, roundNumber: choice.roundNumber,
    reason: "Evitar un turno vacio", ...extra};
  return writer.authorizeDeliverySpacingException(command, actor, {contextDigest: choice.expectedContextDigest,
    verify: (transaction) => assertSpacingAdministrationContext(db, transaction, now,
      {...choice, ...extra})});
};
before(() => { if (enabled) { db = createProvisionalCreditFirestore(); writer = createDeliverySpacingAdministration(db, () => now); } });
beforeEach(async () => { if (enabled) { await db.recursiveDelete(db.doc(root)); await seedSpacingAdministration(db); } });
after(async () => { if (db) await db.terminate(); });

run("native spacing choices enumerate the unchanged six-person calendar and never write diagnostic artifacts", async () => {
  const before = await capture(), result = await read();
  assert.equal(result.spacingUnavailableReason, null);
  assert.equal(result.spacingCandidates.length, 48);
  const ana = result.spacingCandidates.find((item) => item.userId === "member-1");
  assert.equal(ana.displayName, "Ana");
  assert.equal(ana.previousDate, "2026-09-03");
  assert.equal(ana.date, "2026-10-15");
  assert.equal(ana.previousRoundNumber, 1); assert.equal(ana.roundNumber, 2);
  assert.equal(ana.planningRequestId, "bundle-2026");
  assert.deepEqual(await capture(), before);
});

run("one exact native approval removes one choice, changes no public data and retains exact replay after context changes", async () => {
  const candidate = (await read()).spacingCandidates[0], choice = select(candidate);
  const before = await capture();
  const accepted = await authorize(choice);
  assert.equal(accepted.replayed, false);
  assert.equal(accepted.result.approvedByUserId, "member-1");
  assert.equal((await read()).spacingCandidates.length, 47);
  const after = await capture();
  assert.deepEqual(after.filter(([name]) => !["shiftDeliverySpacingExceptions", "shiftDeliverySpacingOperations"].includes(name)), before);
  assert.equal((await authorize(choice)).replayed, true);
  assert.deepEqual(await capture(), after);
  await assert.rejects(() => authorize(choice, {reason: "Different intent"}), {code: "delivery_spacing_operation_conflict"});
  assert.deepEqual(await capture(), after);
});

run("forged pairs and source drift reject atomically before recording approval or receipt", async () => {
  const choice = select((await read()).spacingCandidates[0]);
  const before = await capture();
  await assert.rejects(() => authorize(choice, {date: "2026-10-14"}),
    {code: "coverage_administration_context_changed"});
  assert.deepEqual(await capture(), before);
  await ref("config", "global").update({"otherConfig.deliveryDayOfWeek": "WED"});
  const drifted = await capture();
  await assert.rejects(() => authorize(choice), {code: "coverage_administration_context_changed"});
  assert.deepEqual(await capture(), drifted);
});

run("missing preparation has an explicit empty state while corrupt source or request evidence fails closed", async () => {
  await ref("shiftPlanningRequests", "request-preview-2026").delete();
  assert.deepEqual(await read(), {spacingCandidates: [], spacingUnavailableReason: "no_planning_request"});
  await ref("shiftPlanningRequests", "request-preview-2026").set({...request(), actorMemberId: "forged"});
  const malformed = await capture();
  await assert.rejects(() => read());
  assert.deepEqual(await capture(), malformed);
  await ref("shiftPlanningRequests", "request-preview-2026").set(request());
  await ref("shiftPlanningState", "sourcePolicy").update({deliverySpacing: {version: "unknown"}});
  const corrupt = await capture(); await assert.rejects(() => read()); assert.deepEqual(await capture(), corrupt);
});

run("canonical failed spacing previews remain actionable but a forged lifecycle digest is rejected", async () => {
  const intent = request();
  const summary = buildShiftPlanningFailureSummary({mode: "preview", bundleId: intent.bundleId,
    scope: "delivery", code: "delivery_spacing_conflict"});
  const lifecycle = {schemaVersion: 1, operationId: "request-request-preview-2026",
    requestIntentDigest: digest(parseShiftPlanningRequestV2(intent)), state: "failed",
    lease: {workerId: "local-worker", fencingEpoch: 1,
      acquiredAt: Timestamp.fromMillis(now), expiresAt: Timestamp.fromMillis(now + 1000)},
    summary, artifact: null, terminalDigest: digest({summary, artifact: null})};
  await ref("shiftPlanningRequests", intent.requestId).set({...intent, status: "failed", lifecycle});
  assert.equal((await read()).spacingCandidates.length, 48);
  await ref("shiftPlanningRequests", intent.requestId).update({"lifecycle.requestIntentDigest": digest("forged")});
  const before = await capture(); await assert.rejects(() => read()); assert.deepEqual(await capture(), before);
});

run("transactional native spacing identity binds replay to the original account and rechecks current admin role", async () => {
  const identity = {uid: "auth-ana", email: "ana@example.test", emailVerified: true};
  await ref("authLinks", identity.uid).set({memberId: "member-1"});
  await ref("users", "member-1").update({authUid: identity.uid});
  const choice = select((await read()).spacingCandidates[0]);
  assert.equal((await authorize(choice, {}, identity)).replayed, false);
  const accepted = await capture();
  assert.equal((await authorize(choice, {}, identity)).replayed, true);
  assert.deepEqual(await capture(), accepted);
  await ref("authLinks", "auth-ana-new").set({memberId: "member-1"});
  await ref("users", "member-1").update({authUid: "auth-ana-new"});
  const relinked = await capture();
  await assert.rejects(() => authorize(choice, {}, {...identity, uid: "auth-ana-new"}),
    {code: "delivery_spacing_operation_conflict"});
  assert.deepEqual(await capture(), relinked);
  await ref("users", "member-1").update({authUid: identity.uid, roles: ["member"]});
  const nonadmin = await capture();
  await assert.rejects(() => authorize(choice, {}, identity),
    {code: "coverage_actor_forbidden", status: 403});
  assert.deepEqual(await capture(), nonadmin);
});

run("a later preview replaces the same bundle choice while corrupt older envelopes still reject", async () => {
  const previous = (await read()).spacingCandidates[0];
  await ref("shiftPlanningRequests", "preview-later").set(request({requestId: "preview-later",
    requestedAt: Timestamp.fromMillis(Date.parse("2026-07-01T00:00:00Z"))}));
  const refreshed = await read();
  assert.equal(refreshed.spacingCandidates.length, 48);
  const current = refreshed.spacingCandidates.find((item) => item.id === previous.id);
  assert.notEqual(current.contextDigest, previous.contextDigest);
  const before = await capture();
  await assert.rejects(() => authorize(select(previous)), {code: "coverage_administration_context_changed"});
  assert.deepEqual(await capture(), before);
  await ref("shiftPlanningRequests", "request-preview-2026").update({actorMemberId: "forged"});
  const corrupt = await capture(); await assert.rejects(() => read()); assert.deepEqual(await capture(), corrupt);
});

run("all exact approvals leave a valid empty state rather than an unavailable planning proposal", async () => {
  for (let remaining = 48; remaining > 0; remaining--) {
    const current = await read();
    assert.equal(current.spacingCandidates.length, remaining);
    await authorize(select(current.spacingCandidates[0]), {operationId: `approve-pair-${remaining}`});
  }
  const result = await read();
  assert.deepEqual(result, {spacingCandidates: [], spacingUnavailableReason: null});
  assert.equal((await db.collection(`${root}/shifts`).get()).size, 0);
  assert.equal((await db.collection(`${root}/shiftPlanningCandidates`).get()).size, 0);
});

run("an incompatible preview reports missing current planning rather than a completed empty list", async () => {
  await ref("shiftPlanningRequests", "request-preview-2026").set(request({expectedWriteEpoch: 8}));
  assert.deepEqual(await read(), {spacingCandidates: [], spacingUnavailableReason: "no_planning_request"});
});
