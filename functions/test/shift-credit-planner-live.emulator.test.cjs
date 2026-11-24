"use strict";
const assert = require("node:assert/strict");
const {before, after, test} = require("node:test");
const {Firestore} = require("@google-cloud/firestore");
const {createShiftCreditPlanningContext} = require("../lib/shift-credit-planning-context.js");
const {createFirestoreShiftCoverageService} = require("../lib/shift-coverage-live.js");
const {createFirestoreShiftPlanningRequestContextRepository} = require("../lib/shift-planning-firestore-request-context.js");
const {createFirestoreShiftPlanningRuntime} = require("../lib/shift-planning-firestore-runtime.js");
const {refreshShiftPlanningLiveSource} = require("../lib/shift-planning-firestore-source-producer.js");
const {SHIFT_COVERAGE_POLICY_REVISION} = require("../lib/shift-coverage.js");
const {materialize, activeDigest} = require("./shift-coverage-fixture.cjs");
const {writeProof} = require("./shift-coverage-bootstrap-proof-fixture.cjs");
const {fairnessSnapshot, rotation, maintenanceState, request, previewBinding,
  candidateBinding} = require("./shift-planning-activation-fixture.cjs");

const projectId = "demo-reguerta-hu084-coverage";
const host = "127.0.0.1:8798";
const enabled = process.env.FIRESTORE_EMULATOR_HOST === host && process.env.GCLOUD_PROJECT === projectId;
const caseId = "completed-delivery";
const substitute = "member-10";
const shiftId = "shift_delivery_20260514";
const start = Date.parse("2026-05-12T12:00:00Z");
const day = 86_400_000;
let db;
before(() => { if (enabled) db = new Firestore({projectId, host, ssl: false}); });
after(async () => { if (db) await db.terminate(); });

const seed = async (environment, count) => {
  const root = environment + "/plus-collections";
  await db.recursiveDelete(db.doc(root));
  const ref = (collection, id) => db.collection(root + "/" + collection).doc(id);
  const ids = Array.from({length: count}, (_, index) => "member-" + (index + 1));
  const snapshot = {...fairnessSnapshot(), environment, activeRevision: "active-1", activeDigest, writeEpoch: 1};
  const open = {...maintenanceState(snapshot), maintenanceStatus: "open", intakeBarrier: null};
  const maintenance = {...maintenanceState(snapshot), writeEpoch: open.writeEpoch + 1, stateRevision: open.stateRevision + 1};
  const batch = db.batch();
  batch.set(ref("shiftPlanningState", "current"), open);
  batch.set(ref("shiftPlanningState", "sourcePolicy"), {
    schemaVersion: 1, environment, policyRevision: "spacing-with-credits-v1",
    coverage: {enabled: true, environment, policyRevision: SHIFT_COVERAGE_POLICY_REVISION,
      ratificationReference: "synthetic integration fixture", maximumOfferWindowMillis: 60_000},
    creditLedger: {enabled: true, policyRevision: SHIFT_COVERAGE_POLICY_REVISION},
    deliverySpacing: {version: "hu089-delivery-spacing-v1"},
    delivery: {continuity: {kind: "newRotation"}, inheritedTargetPrefix: null, futureProjectionOccupancy: []},
    market: {inheritedTargetPrefix: null, futureProjectionOccupancy: []},
    releaseLeaseDurationMillis: snapshot.config.releaseLeaseDurationMillis,
    sync: snapshot.sync, transactionWriteLimit: 500,
  });
  batch.set(ref("config", "global"), {otherConfig: {deliveryDayOfWeek: "THU"}});
  for (const userId of ids) {
    batch.set(ref("users", userId), {displayName: userId, authUid: userId,
      roles: userId === "member-1" ? ["admin", "member"] : ["member"], isActive: true, isCommonPurchaseManager: false});
    batch.set(ref("authLinks", userId), {memberId: userId});
  }
  for (const type of ["delivery", "market"]) {
    const value = {...rotation(type, ids), activeRevision: "active-1", activeDigest};
    batch.set(ref("shiftRotations", type), value);
  }
  for (const [date, owner, helper] of [["2026-05-07", "member-2", "member-3"],
    ["2026-05-14", "member-3", "member-4"], ["2026-05-21", "member-4", "member-5"]]) {
    const id = "shift_delivery_" + date.replaceAll("-", "");
    batch.set(ref("shifts", id), materialize(id, "delivery", date, [owner], helper, 1, environment, start - 10 * day));
  }
  await batch.commit();
  await writeProof(db, environment, {uid: "member-1", memberId: "member-1", now: start});
  return {environment, ref, maintenance};
};

// Include commit times: an identical rewrite would otherwise look like an idempotent replay.
const ledger = async ({ref}) => {
  const result = {};
  for (const name of ["shiftCoverageCredits", "shiftCoverageMemberClaims", "shiftCoverageLedgerState"]) {
    const docs = await ref(name, caseId).parent.orderBy("__name__").get();
    result[name] = docs.docs.map((row) => ({id: row.id, data: row.data(), updated: row.updateTime}));
  }
  return result;
};

const earn = async (env) => {
  const {environment, ref} = env;
  let now = start;
  const send = (body, uid = "member-1") => createFirestoreShiftCoverageService({
    firestore: db, environment, operationalReady: true, nowMillis: () => now,
  }).execute(body, {uid});
  const command = async (action, options = {}) => ({
    schemaVersion: 1, environment, caseId, operationId: "op-" + action, action,
    expectedRevision: (await ref("shiftCoverageCases", caseId).get()).get("value.revision") ?? 0,
    expectedShiftRevision: (await ref("shifts", shiftId).get()).get("documentRevision"), ...options,
  });
  await send(await command("open", {shiftId, absentUserId: "member-3", reason: "Unavailable"}), "member-3");
  await send(await command("startSelection"));
  await send(await command("offerAdmin", {userId: substitute, reason: "Urgent coverage", expiresAtMillis: now + 20_000}));
  await send(await command("accept"), substitute);
  now = (await ref("shifts", shiftId).get()).get("date").toMillis() + 1_000;
  const complete = await command("complete");
  await send(complete); // The caller loses this acknowledgement.
  const earned = await ledger(env);
  assert.equal(earned.shiftCoverageCredits.length, 1);
  assert.equal(earned.shiftCoverageCredits[0].id, caseId);
  assert.equal(earned.shiftCoverageCredits[0].data.userId, substitute);
  assert.equal(earned.shiftCoverageCredits[0].data.state, "pending");
  assert.equal(earned.shiftCoverageLedgerState[0].data.revision, 1);
  assert.equal(earned.shiftCoverageMemberClaims[0].data.state, "creditPending");
  assert.equal((await send(complete)).replayed, true);
  await assert.rejects(send({...complete, action: "fail", reason: "Different intent"}), {code: "coverage_operation_conflict"});
  await assert.rejects(send(await command("complete", {operationId: "different-completion"})), {code: "coverage_slot_changed"});
  assert.deepEqual(await ledger(env), earned);
  return earned;
};

const plan = async (env) => {
  const {environment, ref, maintenance} = env;
  await ref("shiftPlanningState", "current").set(maintenance);
  const creditPlanning = createShiftCreditPlanningContext({firestore: db, environment, operationalReady: true});
  const authority = await createFirestoreShiftPlanningRequestContextRepository(db).resolve({schemaVersion: 1, environment}, creditPlanning);
  assert.equal(authority.expectedWriteEpoch, maintenance.writeEpoch);
  assert.equal(authority.expectedActiveRevision, maintenance.activeRevision);
  const execute = (body) => createFirestoreShiftPlanningRuntime(db, creditPlanning).executeRequest({
    environment, requestId: body.requestId, request: body, workerId: "planner-worker",
  });
  const submit = async (mode, binding = null, requestId = "planning-" + mode) => {
    const body = request({environment, requestId, bundleId: "planning-season", mode, binding,
      requestedByUserId: "member-1", expectedWriteEpoch: authority.expectedWriteEpoch,
      expectedActiveRevision: authority.expectedActiveRevision});
    await ref("shiftPlanningRequests", requestId).create(body);
    return {body, response: await execute(body)};
  };
  return {submit, execute, creditPlanning};
};

test("normal governed planning spends a completed delivery credit once across fresh workers, then recovers it once",
  {skip: !enabled}, async () => {
    const env = await seed("production", 12);
    const other = await seed("develop", 10);
    const untouched = await earn(other);
    const earned = await earn(env);
    const {submit, execute, creditPlanning} = await plan(env);
    const fairness = env.ref("shiftPlanningState", "fairness");
    assert.equal((await fairness.get()).exists, false);
    const preview = await submit("preview");
    const captured = (await fairness.get()).get("inputs.fairnessSnapshot");
    assert.deepEqual(captured.creditLedger.sources.delivery.credits.map((credit) => credit.id), [caseId]);
    assert.equal(captured.deliverySpacing.history.length, 3);
    assert.equal(preview.response.result.kind, "completed", JSON.stringify(preview.response.result.summary));
    const proposed = preview.response.result.result;
    assert.deepEqual(proposed.delivery.creditProjection.consumedCreditIds, [caseId]);
    assert.deepEqual(proposed.delivery.spacingEvidence.appliedExceptionIds, []);
    const stage = await submit("stage", previewBinding(proposed));
    assert.equal(stage.response.result.kind, "completed", JSON.stringify(stage.response.result.summary));
    const staged = stage.response.result.result;
    assert.deepEqual(await ledger(env), earned);
    const activation = await submit("activate", candidateBinding(staged));
    assert.equal(activation.response.result.kind, "committed", JSON.stringify(activation.response.result.summary));
    const consumed = await ledger(env);
    assert.equal(consumed.shiftCoverageCredits.length, 1);
    assert.equal(consumed.shiftCoverageCredits[0].data.state, "consumed");
    assert.equal(consumed.shiftCoverageCredits[0].data.consumedByPlanId, staged.bundleId);
    assert.equal(consumed.shiftCoverageLedgerState[0].data.revision, 2);
    assert.equal(consumed.shiftCoverageMemberClaims[0].data.state, "released");
    const schedule = await env.ref("shifts", shiftId).parent.where("planningRequestId", "==", staged.bundleId).get();
    const ordinary = schedule.docs.filter((row) => row.get("type") === "delivery" && row.get("rotationOwnerUserId") === substitute);
    assert.ok(ordinary.some((row) => row.get("roundNumber") === 1));
    assert.ok(!ordinary.some((row) => row.get("roundNumber") === 2));
    assert.ok(ordinary.some((row) => row.get("roundNumber") === 3));
    const replay = await execute(activation.body);
    assert.equal(replay.result.kind, "terminalReplay");
    await assert.rejects(execute({...activation.body, requestedByUserId: "member-2"}), {code: "invalid_planning_request"});
    const again = await submit("activate", candidateBinding(staged), "repeat-activation");
    assert.equal(again.response.result.kind, "failed");
    assert.deepEqual(await ledger(env), consumed);
    const recover = () => createFirestoreShiftPlanningRuntime(db, creditPlanning).executeRecovery({
      environment: env.environment, activationOperationId: "request-" + activation.body.requestId,
      recoveryOperationId: "recover-credit-spend",
    });
    assert.equal((await recover()).kind, "committed");
    const restored = await ledger(env);
    assert.equal(restored.shiftCoverageLedgerState[0].data.revision, 3);
    for (const collection of ["shiftCoverageCredits", "shiftCoverageMemberClaims"]) {
      assert.deepEqual(restored[collection].map(({id, data}) => [id, data]),
        earned[collection].map(({id, data}) => [id, data]));
    }
    assert.equal((await recover()).kind, "terminalReplay");
    assert.deepEqual(await ledger(env), restored);
    assert.deepEqual(await ledger(other), untouched);
  });

test("normal governed planning keeps the credit pending on a spacing conflict and spends it once after exact approvals",
  {skip: !enabled}, async () => {
    const env = await seed("develop", 10);
    const earned = await earn(env);
    const {submit, execute} = await plan(env);
    const preview = await submit("preview");
    const failure = await env.ref("shiftPlanningRequests", preview.body.requestId).get();
    assert.equal(preview.response.result.kind, "failed");
    assert.equal(failure.get("lifecycle.summary.failure.code"), "delivery_spacing_conflict");
    const replay = await execute(preview.body);
    assert.equal(replay.result.kind, "terminalReplay");
    assert.equal(replay.result.summary.failure.code, "delivery_spacing_conflict");
    assert.deepEqual((await failure.ref.get()).updateTime, failure.updateTime);
    assert.deepEqual(await ledger(env), earned);
    assert.equal((await env.ref("shifts", shiftId).parent.get()).size, 3);

    const service = createFirestoreShiftCoverageService({firestore: db, environment: env.environment,
      operationalReady: true, nowMillis: () => start + 20 * day});
    const actor = {uid: "member-1"};
    const base = {schemaVersion: 1, environment: env.environment};
    const query = {...base, action: "administration"};
    await assert.rejects(service.readAdministration(query, {uid: substitute}), {code: "coverage_unavailable"});
    const currentCase = (await env.ref("shiftCoverageCases", caseId).get()).get("value");
    const ordinary = {...base, action: "complete", caseId, operationId: "different-admin-completion",
      expectedRevision: currentCase.revision, expectedShiftRevision: (await env.ref("shifts", shiftId).get()).get("documentRevision")};
    await assert.rejects(service.execute(ordinary, actor), {code: "coverage_unavailable"});
    const diagnostic = await service.readAdministration(query, actor);
    assert.equal(diagnostic.spacingUnavailableReason, null);
    assert.deepEqual(diagnostic.spacingCandidates.map(({userId}) => userId).sort(),
      Array.from({length: 9}, (_, index) => "member-" + (index + 1)));
    const member = diagnostic.members.find(({userId}) => userId === substitute);
    const reconcile = {...base, action: "reconcileMembership", operationId: "unrelated-membership-change",
      userId: member.userId, expectedRevision: member.membershipRevision, expectedContextDigest: member.contextDigest};
    await assert.rejects(service.executeAdministration(reconcile, actor), {code: "coverage_unavailable"});
    const pairs = diagnostic.spacingCandidates.map((candidate) => candidate.id);
    const receipts = [];
    for (const [index, id] of pairs.entries()) {
      const current = await service.readAdministration(query, actor);
      assert.equal(current.spacingCandidates.length, pairs.length - index);
      const pair = current.spacingCandidates.find((candidate) => candidate.id === id);
      assert.ok(pair);
      assert.equal(Date.parse(pair.date) - Date.parse(pair.previousDate), 63 * day);
      const approval = {...base, action: "authorizeDeliverySpacingException", operationId: "authorize-pair-" + index,
        reason: "One force majeure exception for this pair", proposalId: pair.id, expectedContextDigest: pair.contextDigest,
        userId: pair.userId, planningRequestId: pair.planningRequestId, previousDate: pair.previousDate,
        previousRoundNumber: pair.previousRoundNumber, date: pair.date, roundNumber: pair.roundNumber};
      if (index === 0) {
        await assert.rejects(service.executeAdministration(approval, {uid: substitute}), {code: "coverage_unavailable"});
      }
      const approved = await service.executeAdministration(approval, actor);
      assert.equal(approved.replayed, false);
      assert.equal((await service.executeAdministration(approval, actor)).replayed, true);
      receipts.push(approved.exceptionId);
    }
    assert.deepEqual((await service.readAdministration(query, actor)).spacingCandidates, []);
    assert.deepEqual(await ledger(env), earned);
    const approved = await submit("preview", null, "preview-with-exceptions");
    assert.equal(approved.response.result.kind, "completed", JSON.stringify(approved.response.result.summary));
    const proposed = approved.response.result.result;
    assert.equal((await service.readAdministration(query, actor)).spacingUnavailableReason, "no_planning_request");
    assert.deepEqual([...proposed.delivery.spacingEvidence.appliedExceptionIds].sort(), receipts.sort());
    const stage = await submit("stage", previewBinding(proposed));
    assert.equal(stage.response.result.kind, "completed", JSON.stringify(stage.response.result.summary));
    const activation = await submit("activate", candidateBinding(stage.response.result.result));
    assert.equal(activation.response.result.kind, "committed", JSON.stringify(activation.response.result.summary));
    const consumed = await ledger(env);
    assert.equal(consumed.shiftCoverageCredits.length, 1);
    assert.equal(consumed.shiftCoverageCredits[0].data.state, "consumed");
    assert.equal(consumed.shiftCoverageLedgerState[0].data.revision, 2);
    assert.equal((await execute(activation.body)).result.kind, "terminalReplay");
    assert.deepEqual(await ledger(env), consumed);
  });

test("normal credit source requires the server environment, readiness and current initialization on every capture",
  {skip: !enabled}, async () => {
    const env = await seed("production", 12);
    const earned = await earn(env);
    const {submit, creditPlanning} = await plan(env);
    const capture = (scope) => refreshShiftPlanningLiveSource({
      firestore: db, environment: env.environment, creditPlanning: scope,
    });
    const fairness = env.ref("shiftPlanningState", "fairness");
    const preview = await submit("preview");
    assert.equal(preview.response.result.kind, "completed", JSON.stringify(preview.response.result.summary));
    const priorSource = await fairness.get();
    await env.ref("config", "global").update({"otherConfig.deliveryDayOfWeek": "WED"});
    const obsolete = await submit("stage", previewBinding(preview.response.result.result));
    assert.equal(obsolete.response.result.kind, "failed");
    assert.deepEqual((await fairness.get()).updateTime, priorSource.updateTime);
    const fresh = await submit("preview", null, "new-source-preview");
    assert.equal(fresh.response.result.kind, "completed", JSON.stringify(fresh.response.result.summary));
    const cached = await fairness.get();
    assert.notEqual(cached.get("sourceDigest"), priorSource.get("sourceDigest"));
    for (const scope of [
      createShiftCreditPlanningContext({firestore: db, environment: "develop", operationalReady: true}),
      createShiftCreditPlanningContext({firestore: db, environment: env.environment, operationalReady: false}),
      {...creditPlanning},
    ]) {
      await assert.rejects(capture(scope), {code: "coverage_unavailable"});
    }
    await env.ref("shiftCoverageMigrations", "current").delete();
    await assert.rejects(capture(creditPlanning), {code: "coverage_unavailable"});
    assert.deepEqual((await fairness.get()).updateTime, cached.updateTime);
    assert.deepEqual(await ledger(env), earned);
  });
