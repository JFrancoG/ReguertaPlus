"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {Timestamp} = require("@google-cloud/firestore");
const {parseShiftCoverageSheetsSubmission, parseShiftSheetsWorkbookSubmission} =
  require("../lib/shift-planning-sheets-submission.js");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {coverageWorkbookSubmission, initialTime} = require("./shift-coverage-fixture.cjs");

test("coverage workbook admission rejects malformed claims, unknown fields and detached read-back", () => {
  const base = coverageWorkbookSubmission();
  const batch = {projectionDigest: `shift-sheets:v1:sha256:${"a".repeat(64)}`,
    requestDigest: `shift-sheets:v1:sha256:${"b".repeat(64)}`, submittedAt: Timestamp.fromMillis(initialTime + 1)};
  for (const value of [null, {...base, unexpected: true}, {...base, claim: null},
    {...base, claim: {...base.claim, partitions: [null]}},
    {...base, claim: {...base.claim, partitions: [...base.claim.partitions, ...base.claim.partitions]}},
    {...base, claim: {...base.claim, expiresAt: base.claim.acquiredAt}},
    {...base, batch: {...batch, submittedAt: base.claim.expiresAt}},
    {...base, evidence: {workbookRevision: "2", partitionDigest: digest("forged")}},
    {...base, batch, evidence: {workbookRevision: "1", partitionDigest: digest({projectionDigest: batch.projectionDigest})}},
    {...base, batch, evidence: {workbookRevision: "2", partitionDigest: digest("forged")}},
  ]) assert.throws(() => parseShiftCoverageSheetsSubmission(value), {code: "invalid_planning_sync_command"});
  const terminal = {...base, batch, evidence: {workbookRevision: "2",
    partitionDigest: digest({projectionDigest: batch.projectionDigest})}};
  assert.deepEqual(parseShiftCoverageSheetsSubmission(terminal), terminal);
  const summary = parseShiftSheetsWorkbookSubmission(terminal);
  assert.equal(summary.coverageOperationId, base.operationId);
  assert.equal(summary.importOperationId, null); assert.equal(summary.ordinaryOperationId, null);
  assert.deepEqual(summary.evidence, terminal.evidence);
});
