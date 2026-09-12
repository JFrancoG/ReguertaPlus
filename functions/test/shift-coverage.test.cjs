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
