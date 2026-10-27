"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {snapshot, decision, document, initialTime, Timestamp} = require("./shift-coverage-bootstrap-fixture.cjs");
const {planShiftCoverageBootstrap, parseShiftCoverageBootstrapDecision} = require("../lib/shift-coverage-bootstrap.js");
const {decodeShiftPlanningFirestoreDocument: decode} = require("../lib/shift-planning-publication-contract.js");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const run = (source = snapshot(), input = decision()) => planShiftCoverageBootstrap({snapshot: source, decision: input});
const put = (source, collection, id, data) => {
  const next = document(source.environment, collection, id, data);
  source.documents = source.documents.filter((item) => item.path !== next.path).concat(next);
};
const get = (source, collection, id) => decode(source.documents.find((item) => item.path.endsWith(`/${collection}/${id}`)).value);
const blocked = (source, code) => {
  const result = run(source);
  assert.ok(result.blockers.some((item) => item.code === code), JSON.stringify(result.blockers));
  assert.deepEqual(result.creates, []);
};
const verifiedWorkbook = (workbookId = "coverage-rehearsal-book", environment = "develop") => {
  const projectionDigest = "shift-sheets:v1:sha256:" + "a".repeat(64);
  return {schemaVersion: 1, kind: "coverageWriteBack", environment, workbookId,
    operationId: "old-completed-projection", effectsDigest: digest("old effects"), sourceDigest: digest("old source"), beforeWorkbookRevision: "1",
    claim: {workerId: "worker", attemptId: "attempt", acquiredAt: Timestamp.fromMillis(initialTime - 2000),
      expiresAt: Timestamp.fromMillis(initialTime - 1000), partitions: [{type: "delivery", partitionKey: "delivery", stateRevision: 1, epoch: 1}]},
    batch: {projectionDigest, requestDigest: "shift-sheets:v1:sha256:" + "b".repeat(64), submittedAt: Timestamp.fromMillis(initialTime - 1500)},
    evidence: {workbookRevision: "2", partitionDigest: digest({projectionDigest})}};
};

test("zero baseline observes canonical users, preserves all source documents and creates no reserves, cases or fake credits", () => {
  for (const environment of ["develop", "production"]) {
    const source = snapshot(environment), before = JSON.stringify(source);
    const result = run(source, decision(environment));
    assert.deepEqual(result.blockers, []);
    assert.equal(result.creates.length, 9);
    assert.equal(JSON.stringify(source), before);
    assert.ok(result.creates.every((item) => item.path.startsWith(`${environment}/plus-collections/`)));
    assert.ok(result.creates.every((item) => /\/(shiftMembershipState|shiftCoverageLedgerState)\//.test(item.path)));
    const member = (id) => decode(result.creates.find((item) => item.path.endsWith(`/shiftMembershipState/${id}`)).value).value;
    assert.equal(member("buyer").eligible, true, "purchase manager remains eligible despite producer role");
    assert.equal(member("admin").eligible, true);
    assert.equal(member("real-producer").eligible, false);
    assert.equal(member("inactive").eligible, false);
    assert.equal(member("a").observedAtMillis, initialTime);
    assert.equal(member("a").pendingQueueTransition, false);
    assert.deepEqual(member("a").admissionRequired, {delivery: false, market: false});
    assert.equal(member("a").admissionAfterRound.delivery, 0, "unfrozen round is not falsely frozen by bootstrap");
    assert.equal(member("a").admissionAfterRound.market, 1, "published ordinary owners provide the observed frontier");
  }
});

test("source versions and exact decision affect digests; source ordering does not", () => {
  const source = snapshot(), original = run(source);
  const shuffled = {...source, collections: [...source.collections].reverse(), documents: [...source.documents].reverse()};
  assert.deepEqual(run(shuffled), original);
  const changed = snapshot(); changed.documents[0].updateTime.nanoseconds++;
  assert.notEqual(run(changed).sourceDigest, original.sourceDigest);
  assert.notEqual(run(source, {...decision(), confirmationReference: "Another explicit confirmation"}).decisionDigest, original.decisionDigest);
  const {planDigest, ...core} = original; assert.equal(planDigest, digest(core));
});

test("valid retained rotation release leases block initialization even after their deadline", () => {
  for (const type of ["delivery", "market"]) for (const state of ["sealed", "releasing", "degraded"]) {
    const source = snapshot(), rotation = get(source, "shiftRotations", type);
    put(source, "shiftRotations", type, {...rotation, releaseLease: {
      type, bundleId: "old-bundle", bundleRevision: "active-1", bundleDigest: rotation.activeDigest,
      leaseEpoch: 1, ownerOperationId: "unfinished-publication", state,
      acquiredAtMillis: initialTime - 2000, deadlineAtMillis: initialTime - 1000,
    }});
    blocked(source, "bootstrap_rotation_release_pending");
  }
});

test("valid existing membership and inactive legacy reserve history are preserved without rewriting or inventing its boundary", () => {
  const source = snapshot(), original = run(source);
  const created = original.creates.find((item) => item.path.endsWith("/shiftMembershipState/a"));
  put(source, "shiftMembershipState", "a", decode(created.value));
  const id = digest(["delivery", "a"]).split(":").at(-1);
  const reserve = {userId: "a", type: "delivery", active: false, enteredAtMillis: initialTime - 1000, revision: 2};
  put(source, "shiftCoverageReserves", id, reserve);
  const result = run(source);
  assert.deepEqual(result.blockers, []);
  assert.equal(result.creates.length, 8);
  assert.ok(result.creates.every((item) => !item.path.endsWith("/shiftMembershipState/a") && !item.path.includes("/shiftCoverageReserves/")));
  assert.deepEqual(get(source, "shiftCoverageReserves", id), reserve);
  put(source, "shiftCoverageReserves", id, {...reserve, active: true});
  blocked(source, "bootstrap_reserve_evidence_required");
});

test("unobserved entrants and inactive frozen owners block rather than becoming invented reserves or new coverage cases", () => {
  const entrant = snapshot();
  put(entrant, "users", "new-member", {isActive: true, roles: ["member"], isCommonPurchaseManager: false});
  blocked(entrant, "bootstrap_cohort_reconciliation_required");
  const departure = snapshot(); put(departure, "users", "a", {...get(departure, "users", "a"), isActive: false});
  blocked(departure, "bootstrap_cohort_reconciliation_required");
});

test("pending or drifted membership, active reserves, and incompatible credits cannot be overwritten by zero", () => {
  const source = snapshot(), baseline = run(source);
  const value = decode(baseline.creates.find((item) => item.path.endsWith("/shiftMembershipState/a")).value).value;
  for (const changed of [{...value, pendingQueueTransition: true, pendingTypes: {delivery: true, market: false}},
    {...value, source: {...value.source, isCommonPurchaseManager: true}}]) {
    const variant = snapshot(); put(variant, "shiftMembershipState", "a", {value: changed, digest: digest(changed)});
    blocked(variant, "bootstrap_membership_reconciliation_required");
  }
  put(source, "shiftCoverageCredits", "unspent", {schemaVersion: 1, policyRevision: "hu084-provisional-v1", id: "unspent", caseId: "unspent",
    shiftId: "historical", type: "delivery", userId: "a", earnedAtMillis: initialTime - 1000, completionRevision: 1, state: "pending"});
  assert.ok(run(source).blockers.length > 0); assert.deepEqual(run(source).creates, []);
});

test("future uncompleted helpers and missing participants require resolution; completed historical helpers do not", () => {
  const source = snapshot(), shift = get(source, "shifts", "shift_market_20270904");
  const delivery = require("./shift-coverage-fixture.cjs").materialize("shift_delivery_20270901", "delivery", "2027-09-01", ["a"], "inactive");
  put(source, "shifts", "shift_delivery_20270901", delivery);
  blocked(source, "bootstrap_future_assignment_ineligible");
  put(source, "shifts", "shift_delivery_20270901", {...delivery, helperUserId: "missing-account"});
  blocked(source, "bootstrap_future_member_missing");
  put(source, "shifts", "shift_delivery_20270901", null);
  const history = require("./shift-coverage-fixture.cjs").materialize("shift_delivery_20270801", "delivery", "2027-08-01", ["a"], "inactive");
  put(source, "shifts", "shift_delivery_20270801", {...history, documentRevision: 2, updatedAt: Timestamp.fromMillis(initialTime),
    completion: {state: "completed", revision: 1, completedAt: Timestamp.fromMillis(initialTime - 500),
      actualHelperUserId: "inactive", helperSourceAssignmentRevision: 1}});
  assert.deepEqual(run(source).blockers, []);
  assert.deepEqual(get(source, "shifts", "shift_market_20270904"), shift);
});

test("maintenance, leases, unresolved work, previous migration and source admission policy block without writes", () => {
  for (const [collection, id, amend, code] of [
    ["shiftPlanningState", "current", (v) => ({...v, maintenanceStatus: "open", intakeBarrier: null}), "bootstrap_maintenance_not_closed"],
    ["shiftPlanningState", "sourcePolicy", (v) => ({...v, environment: "production"}), "bootstrap_source_policy_invalid"],
    ["shiftPlanningState", "sourcePolicy", (v) => ({...v, transactionWriteLimit: 2}), "bootstrap_write_budget_exceeded"],
    ["shiftPlanningState", "sourcePolicy", (v) => ({...v, sync: {}}), "bootstrap_workbook_partition_invalid"],
  ]) {
    const source = snapshot(); put(source, collection, id, amend(get(source, collection, id))); blocked(source, code);
  }
  for (const [collection, value, code] of [
    ["shiftCoverageEffects", {state: "pending"}, "bootstrap_coverage_effect_unresolved"],
    ["shiftPlanningRequests", {status: "requested"}, "bootstrap_planning_work_pending"],
    ["shiftPlanningSyncCommands", {state: "processing"}, "bootstrap_planning_work_pending"],
    ["shiftCoverageMigrations", {state: "completed"}, "bootstrap_already_initialized"],
  ]) { const source = snapshot(); put(source, collection, "old-work", value); blocked(source, code); }
});

test("collection scope/completeness, exact decision and reserved operation id fail closed", () => {
  for (const value of [{...decision(), reserves: "unknown"}, {...decision(), credits: "import"}, {...decision(), operationId: "current"},
    {...decision(), actorId: "spoofed"}, {...decision(), confirmationReference: " "}]) {
    assert.throws(() => parseShiftCoverageBootstrapDecision(value));
  }
  const incomplete = snapshot(); incomplete.collections.pop(); assert.throws(() => run(incomplete));
  const missing = snapshot(); missing.documents = missing.documents.filter((item) => !item.path.endsWith("/shiftCoverageLedgerState/delivery"));
  assert.throws(() => run(missing));
  const foreign = snapshot(); foreign.documents[0].path = foreign.documents[0].path.replace("develop/", "production/");
  assert.throws(() => run(foreign));
});

test("a terminal workbook pointer cannot borrow the same version from another workbook or known environment", () => {
  const valid = snapshot(); put(valid, "shiftPlanningState", "sheetsSubmission", verifiedWorkbook());
  assert.deepEqual(run(valid).blockers, []);
  for (const pointer of [verifiedWorkbook("another-book"), verifiedWorkbook("coverage-rehearsal-book", "production")]) {
    const source = snapshot(); put(source, "shiftPlanningState", "sheetsSubmission", pointer);
    blocked(source, "bootstrap_workbook_scope_mismatch");
  }
  const partitions = snapshot(), policy = get(partitions, "shiftPlanningState", "sourcePolicy");
  policy.sync.partitions.market.workbookId = "another-book";
  put(partitions, "shiftPlanningState", "sourcePolicy", policy);
  blocked(partitions, "bootstrap_workbook_scope_mismatch");
  const missing = snapshot(); put(missing, "shiftPlanningState", "sourcePolicy", null);
  blocked(missing, "bootstrap_source_policy_invalid");
});

test("pure planning applies the same cardinality and complete write budget as its adapter", () => {
  const source = snapshot();
  for (let index = 0; index < 500; index++) put(source, "users", `inactive-${index}`, {isActive: false, roles: ["member"], isCommonPurchaseManager: false});
  const result = run(source);
  assert.ok(result.blockers.some((item) => item.code === "bootstrap_source_limit"));
  assert.ok(result.blockers.some((item) => item.code === "bootstrap_write_budget_exceeded"));
  assert.deepEqual(result.creates, []);
});
