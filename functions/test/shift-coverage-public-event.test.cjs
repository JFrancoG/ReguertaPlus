"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {Timestamp} = require("@google-cloud/firestore");
const {materialize, initialTime} = require("./shift-coverage-fixture.cjs");
const {describeCoveragePublicEvent, coveragePublicEventBindingId,
  classifyCoveragePublicEventEvidence} = require("../lib/shift-coverage-public-event.js");
const {requiresShiftPlanningPublicEventAudit} = require("../lib/shift-planning-public-event-trigger.js");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");

const fixture = () => {
  const path = "develop/plus-collections/shifts/shift_market_20270904";
  const before = materialize("shift_market_20270904", "market", "2027-09-04", ["a", "b", "c"]);
  const after = {...before, assignedUserIds: ["d", "b", "c"], assignmentRevision: 2,
    rotationPositions: before.rotationPositions.map((position, index) =>
      index === 0 ? {...position, effectiveAssigneeUserId: "d"} : position),
    documentRevision: 2, updatedAt: Timestamp.fromMillis(initialTime)};
  const descriptor = describeCoveragePublicEvent({targetPath: path, before, after});
  const command = {schemaVersion: 1, environment: "develop", operationId: "accept-once", caseId: "case-a",
    expectedRevision: 2, expectedShiftRevision: 1, action: "accept"};
  const result = {id: "case-a", environment: "develop", revision: 3};
  const core = {schemaVersion: 1, environment: "develop", operationId: command.operationId,
    caseId: result.id, caseRevision: result.revision, caseDigest: digest(result), action: "accept", changes: [], notifications: []};
  const value = {...core, effectsDigest: digest(core)};
  const time = new Timestamp(1_800_000_000, 123_456_789);
  const evidence = {descriptor, afterUpdateTime: time,
    binding: {createTime: time, value: {...descriptor, operationId: command.operationId, effectsDigest: value.effectsDigest}},
    receipt: {createTime: time, value: {command, actorMemberId: "d", commandDigest: digest({actorId: "d", command}),
      result, effectsDigest: value.effectsDigest, publicEventDigests: [descriptor.eventDigest]}},
    effect: {createTime: time, value: {value, publicEventDigests: [descriptor.eventDigest], state: "pending"}}};
  return {path, before, after, evidence};
};

test("exact before/after/version and same-commit receipt/effect own one public update without changing planner provenance", () => {
  const f = fixture();
  assert.equal(requiresShiftPlanningPublicEventAudit({targetPath: f.path, before: f.before, after: f.after}), false);
  assert.equal(classifyCoveragePublicEventEvidence(f.evidence), "coverage");
  assert.match(coveragePublicEventBindingId(f.evidence.descriptor), /^[a-f0-9]{64}$/);
  for (const state of ["completed", "retired", "future-worker-state"]) {
    f.evidence.effect.value.state = state;
    assert.equal(classifyCoveragePublicEventEvidence(f.evidence), "coverage");
  }
  assert.deepEqual(f.after.lastBackendMutation, f.before.lastBackendMutation);
});

test("revert/reapply of identical bodies at another commit is ordinary, including a one-nanosecond difference", () => {
  const f = fixture();
  for (const time of [new Timestamp(1_800_000_001, 123_456_789), new Timestamp(1_800_000_000, 123_456_790)]) {
    assert.equal(classifyCoveragePublicEventEvidence({...f.evidence, afterUpdateTime: time,
      orphanClaims: [f.evidence.receipt, f.evidence.effect]}), "ordinary");
  }
});

test("missing sidecar cannot reopen ordinary effects when either immutable claim belongs to the commit", () => {
  const f = fixture();
  for (const claim of [f.evidence.receipt, f.evidence.effect]) {
    assert.throws(() => classifyCoveragePublicEventEvidence({...f.evidence, binding: null, orphanClaims: [claim]}),
      {code: "coverage_public_event_evidence_invalid"});
  }
  assert.equal(classifyCoveragePublicEventEvidence({...f.evidence, binding: null}), "ordinary");
});

test("partial evidence and changed environment, revision, target, command, result or effects fail closed", () => {
  for (const mutate of [
    (f) => { f.evidence.receipt = null; },
    (f) => { f.evidence.effect = null; },
    (f) => { f.evidence.binding.value.environment = "production"; },
    (f) => { f.evidence.binding.value.afterRevision++; },
    (f) => { f.evidence.binding.value.targetPath = f.path + "-foreign"; },
    (f) => { f.evidence.receipt.value.command.operationId = "foreign"; },
    (f) => { f.evidence.receipt.value.commandDigest = digest("wrong-command"); },
    (f) => { f.evidence.receipt.value.result.environment = "production"; },
    (f) => { f.evidence.effect.value.value.action = "complete"; },
    (f) => { f.evidence.effect.value.publicEventDigests = []; },
    (f) => { f.evidence.effect.createTime = new Timestamp(1_800_000_000, 123_456_788); },
  ]) {
    const f = fixture(); mutate(f);
    assert.throws(() => classifyCoveragePublicEventEvidence(f.evidence));
  }
});

test("completion updates are described even without assignment or Sheets row changes; no-op and legacy writes are not", () => {
  const f = fixture();
  const complete = {...f.before, documentRevision: 2, updatedAt: Timestamp.fromMillis(initialTime),
    completion: {state: "completed", revision: 1, completedAt: Timestamp.fromMillis(initialTime),
      actualHelperUserId: null, helperSourceAssignmentRevision: null}};
  assert.ok(describeCoveragePublicEvent({targetPath: f.path, before: f.before, after: complete}));
  assert.equal(describeCoveragePublicEvent({targetPath: f.path, before: f.before, after: f.before}), null);
  assert.equal(describeCoveragePublicEvent({targetPath: f.path, before: null, after: f.after}), null);
  assert.equal(describeCoveragePublicEvent({targetPath: f.path, before: {status: "planned"}, after: {status: "confirmed"}}), null);
});

test("changed, removed and malformed planner markers retain the existing audit owner first", () => {
  const f = fixture();
  for (const after of [{...f.after, lastBackendMutation: {...f.after.lastBackendMutation, operationId: "other"}},
    {...f.after, lastBackendMutation: null},
    {...f.after, lastBackendMutation: {kind: "activation"}}]) {
    assert.equal(requiresShiftPlanningPublicEventAudit({targetPath: f.path, before: f.before, after}), true);
  }
});
