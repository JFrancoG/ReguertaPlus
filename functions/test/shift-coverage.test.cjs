"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {parseShiftCoverageCommand, coverageMember} = require("../lib/shift-coverage.js");
const {createProvisionalShiftCoverageStore} = require("../lib/shift-coverage-provisional-store.js");
const command = {schemaVersion: 1, environment: "develop", caseId: "case-1",
  operationId: "op-1", expectedRevision: 0, expectedShiftRevision: 1,
  action: "open", shiftId: "shift-1", absentUserId: "member-1", reason: "Absence"};

test("coverage input rejects caller-supplied identity, credit, completion and wrong environment", () => {
  assert.deepEqual(parseShiftCoverageCommand(command), command);
  for (const extra of [{actorId: "admin"}, {credit: 1}, {completed: true},
    {environment: "production"}, {schemaVersion: 2}, {expectedRevision: 1},
    {expectedShiftRevision: NaN}, {caseId: "../users"}, {reason: " "}]) {
    assert.throws(() => parseShiftCoverageCommand({...command, ...extra}));
  }
  assert.throws(() => parseShiftCoverageCommand(Object.create(command)));
});

test("coverage preserves the canonical common-purchase-manager eligibility rule", () => {
  const member = {isActive: true, roles: ["member", "producer"], isCommonPurchaseManager: true};
  assert.equal(coverageMember(member).eligible, true);
  assert.equal(coverageMember({...member, isCommonPurchaseManager: false}).eligible, false);
  assert.equal(coverageMember({...member, isActive: false}).eligible, false);
  assert.equal(coverageMember({...member, roles: ["admin", "producer"],
    isCommonPurchaseManager: false}).eligible, false);
  assert.throws(() => coverageMember({...member, isActive: "true"}));
});

test("provisional store rejects a live project before constructing a client", () => {
  const prior = process.env.GCLOUD_PROJECT;
  try {
    process.env.GCLOUD_PROJECT = "not-a-demo-project";
    assert.throws(() => createProvisionalShiftCoverageStore({nowMillis: () => 1,
      maximumOfferWindowMillis: 1000}), {code: "coverage_provisional_emulator_required"});
  } finally {
    if (prior === undefined) delete process.env.GCLOUD_PROJECT;
    else process.env.GCLOUD_PROJECT = prior;
  }
});

const {createCoverageSelection, advanceCoverageSelection, parseCoverageSelectionPolicy,
  coverageCandidateExclusion} = require("../lib/shift-coverage-selection.js");
const policy = {version: "fifo-signup-v1", volunteerWindowMillis: 1000};
const selectionCandidate = (userId, time, exclusion = null) => ({userId, exclusion, memberDigest: "fixture",
  reserve: {userId, type: "delivery", active: true, enteredAtMillis: time, revision: 1}});

test("reserve snapshot and FIFO ties are independent of Firestore enumeration order", () => {
  const candidates = [selectionCandidate("z", 1), selectionCandidate("b", 3), selectionCandidate("a", 3)];
  const first = createCoverageSelection({policy, caseId: "case", candidates});
  const reordered = createCoverageSelection({policy, caseId: "case", candidates: [...candidates].reverse()});
  assert.deepEqual(first, reordered);
  const untouched = structuredClone(first);
  const one = advanceCoverageSelection({selection: first, candidates, now: 100});
  assert.equal(one.userId, "z");
  const two = advanceCoverageSelection({selection: one.selection, candidates, now: 100});
  assert.equal(two.userId, "a");
  assert.deepEqual(first, untouched);
  const changed = candidates.map((entry) => entry.userId === "b" ? {...entry, exclusion: "same_type_claim"} : entry);
  const next = advanceCoverageSelection({selection: two.selection, candidates: changed, now: 100});
  assert.equal(next.userId, null);
  assert.equal(next.selection.phase, "volunteers");
  assert.equal(next.selection.volunteerClosesAtMillis, 1100);
  assert.equal(next.selection.snapshotDigest, first.snapshotDigest);
});

test("provisional selection requires an explicit valid policy and refuses client-selected candidates", () => {
  for (const value of [undefined, {...policy, version: "random"}, {...policy, volunteerWindowMillis: 0},
    {...policy, volunteerWindowMillis: NaN}, {...policy, volunteerWindowMillis: Number.MAX_SAFE_INTEGER}]) {
    assert.throws(() => parseCoverageSelectionPolicy(value), {code: "coverage_selection_policy_required"});
  }
  const base = {schemaVersion: 1, environment: "develop", caseId: "c", operationId: "op",
    expectedRevision: 1, expectedShiftRevision: 1, action: "offerNext", expiresAtMillis: 100};
  assert.deepEqual(parseShiftCoverageCommand(base), base);
  for (const extra of [{userId: "chosen"}, {seed: "grind"}, {candidates: ["chosen"]}, {actorId: "admin"}]) {
    assert.throws(() => parseShiftCoverageCommand({...base, ...extra}), {code: "invalid_coverage_command"});
  }
});

test("discovery records inactive, producer, malformed, assignment, adjacency and claim exclusions", () => {
  const member = {isActive: true, roles: ["member"], isCommonPurchaseManager: false};
  const base = {userId: "a", memberValue: member, claimed: false, assignedUserIds: [], adjacentUserIds: []};
  for (const [patch, expected] of [[{memberValue: null}, "member_missing"],
    [{memberValue: {...member, roles: null}}, "member_malformed"],
    [{memberValue: {...member, isActive: false}}, "inactive"],
    [{memberValue: {...member, roles: ["producer"]}}, "real_producer"],
    [{assignedUserIds: ["a"]}, "already_assigned"], [{adjacentUserIds: ["a"]}, "adjacent_delivery"],
    [{claimed: true}, "same_type_claim"]]) assert.equal(coverageCandidateExclusion({...base, ...patch}), expected);
  assert.equal(coverageCandidateExclusion({...base, memberValue: {...member, roles: ["producer"],
    isCommonPurchaseManager: true}}), null);
});
