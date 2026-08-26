"use strict";

const assert = require("node:assert/strict");
const {test} = require("node:test");

const {
  classifyShiftPlanningCreatedRequest,
} = require("../lib/shift-planning-firestore-runtime.js");

test("keeps unversioned requests on the legacy route", () => {
  assert.equal(
    classifyShiftPlanningCreatedRequest({type: "delivery"}),
    "legacy",
  );
  assert.equal(classifyShiftPlanningCreatedRequest(null), "legacy");
});

test("routes every schema-v2 document away from legacy parsing", () => {
  assert.equal(
    classifyShiftPlanningCreatedRequest({schemaVersion: 2}),
    "v2",
  );
  assert.equal(
    classifyShiftPlanningCreatedRequest({
      schemaVersion: 2,
      type: "delivery",
    }),
    "v2",
  );
});

test("fails closed for an unknown declared request version", () => {
  assert.equal(
    classifyShiftPlanningCreatedRequest({
      schemaVersion: 3,
      type: "delivery",
    }),
    "unsupportedVersion",
  );
});
