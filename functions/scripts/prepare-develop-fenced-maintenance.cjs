"use strict";

// Offline handoff only. A successful ACL probe fences future calls by two
// identities; it cannot settle calls accepted earlier or close the writer inventory.
const assert = require("node:assert/strict");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {inspectCensus} = require("./inspect-develop-legacy-census.cjs");
const PROJECT = "reguerta-9f27f";
const FILE = "1O7VKs7S4wZHVvTfNBehAd5EzF3Mgw2q9LweK68Gm76A";
const PARENT = "0ADG4r1X1_oDPUk9PVA";
const OWNER = "drpuerk@gmail.com";
const ACCOUNTS = ["195744802339-compute@developer.gserviceaccount.com",
  `firebase-adminsdk-2xhs2@${PROJECT}.iam.gserviceaccount.com`];
const INSPECTOR = `reguerta-shifts-inspector@${PROJECT}.iam.gserviceaccount.com`;
const RANGES = ["'turnos-reparto 2026-27'!A1:Z200", "'turnos-mercado 2026-27'!A1:Z200",
  "'turnos-reparto 2027-28'!A1:Z200", "'turnos-mercado 2027-28'!A1:Z200",
  "'TORRE 2025-26'!A1:Y200", "'MERCADO 2025-26'!A1:Z200"];
const stamp = value => {const n = Date.parse(value);assert.ok(Number.isFinite(n), "invalid observation time");return n;};
const roles = entries => entries.map(({type, emailAddress, role}) => ({type, emailAddress, role}))
  .sort((a, b) => a.emailAddress.localeCompare(b.emailAddress));

function prepareDevelopFencedMaintenance({fence, ownerReadback, previousCensus, currentCensus, nowMillis}) {
  assert.ok(Number.isSafeInteger(nowMillis));
  assert.equal(fence.plan.project, PROJECT);assert.equal(fence.plan.fileId, FILE);
  assert.deepEqual(fence.plan.accounts, ACCOUNTS);
  assert.equal(fence.plan.authorized, true);
  for (const name of ["positive", "negative", "cleanup"]) assert.equal(fence[name].length, 2);
  assert.equal(fence.expired.results.length, 2);
  const cleanedAt = stamp(fence.expired.at);
  assert.ok(cleanedAt <= nowMillis);
  const deniedAt = [];
  for (const [index, account] of ACCOUNTS.entries()) {
    const positive = fence.positive[index], negative = fence.negative[index], cleanup = fence.cleanup[index];
    assert.equal(positive.metadata.httpStatus, 200);assert.equal(negative.metadata.httpStatus, 200);
    for (const probe of [positive, negative]) {
      assert.equal(probe.metadata.data.id, FILE);
      assert.equal(probe.metadata.data.mimeType, "application/vnd.google-apps.spreadsheet");
    }
    const permission = positive.metadata.data.permissions.filter(p => p.emailAddress === account);
    assert.equal(permission.length, 1);assert.equal(permission[0].role, "writer");
    assert.equal(positive.metadata.data.capabilities.canEdit, true);
    assert.equal(positive.result.httpStatus, 200);assert.equal(positive.result.data.spreadsheetId, FILE);
    assert.equal(negative.metadata.data.capabilities.canEdit, false);
    assert.equal(negative.originalPreDemotionToken, true);
    assert.equal(negative.result.httpStatus, 403);assert.equal(negative.result.data.error.status, "PERMISSION_DENIED");
    assert.ok(stamp(positive.at) < stamp(negative.at) && stamp(negative.at) < cleanedAt);
    // These reviewed probe policies were empty before the experiment. Do not
    // generalize this check to other accounts or remove any live policy here.
    assert.equal(cleanup.unrelatedBindingsPreserved, true);
    assert.deepEqual(cleanup.after.bindings || [], []);
    assert.ok(stamp(cleanup.at) <= stamp(positive.at));
    assert.deepEqual(fence.expired.results[index], {index, status: 401, error: "UNAUTHENTICATED"});
    deniedAt.push(negative.at);
  }
  assert.equal(fence.valuesBefore.spreadsheetId, FILE);assert.equal(fence.valuesAfter.spreadsheetId, FILE);
  assert.deepEqual(fence.valuesBefore.valueRanges.map(row => row.range), RANGES);
  assert.equal(digest(fence.valuesBefore), digest(fence.valuesAfter), "probe changed inspected values");
  const {file, parent} = ownerReadback;
  assert.equal(file.id, FILE);assert.deepEqual(file.parent_ids, [PARENT]);assert.equal(parent.id, PARENT);
  assert.equal(file.mime_type, "application/vnd.google-apps.spreadsheet");
  const expected = [{type: "user", emailAddress: OWNER, role: "owner"},
    ...[...ACCOUNTS, INSPECTOR].map(emailAddress => ({type: "user", emailAddress, role: "reader"}))];
  assert.deepEqual(roles(file.permissions), roles(expected), "file writer set changed");
  assert.deepEqual(roles(parent.permissions), roles(expected.filter(p => p.role === "owner")), "parent writer set changed");
  const observedAt = stamp(ownerReadback.observedAt);
  assert.ok(observedAt >= cleanedAt && observedAt <= nowMillis);
  const previous = inspectCensus(previousCensus), current = inspectCensus(currentCensus);
  assert.ok(stamp(previous.readTime) <= stamp(current.readTime) && stamp(current.readTime) <= nowMillis);
  assert.ok(stamp(current.readTime) >= cleanedAt, "census precedes fence cleanup");
  const sameCensus = previous.stableSetDigest === current.stableSetDigest;
  const metadataRegressed = stamp(file.modified_time) < Math.max(...fence.negative.map(p => stamp(p.metadata.data.modifiedTime)));
  const blockers = ["old-business-effects-not-closed", "complete-automatic-writer-authority-not-closed",
    "fresh-workbook-version-and-content-required", "fresh-full-control-and-causal-drain-evidence-required",
    "owner-and-administrator-window-agreements-required"];
  if (!sameCensus) blockers.unshift("census-changed-reconciliation-required");
  if (metadataRegressed) blockers.unshift("owner-metadata-older-than-probe");
  const body = {schemaVersion: 1, kind: "develop-fenced-maintenance-preparation", projectId: PROJECT,
    environment: "develop", fileId: FILE, preparedAtMillis: nowMillis, readOnly: true,
    evidenceDigests: {fence: digest(fence), ownerReadback: digest(ownerReadback),
      previousCensus: previous.fingerprint, currentCensus: current.fingerprint},
    fence: {scope: "two-service-accounts-only", deniedAt, credentialsCleanedAt: fence.expired.at,
      ownerRolesObservedAt: ownerReadback.observedAt, metadataRegressed,
      inspectedValuesDigest: digest(fence.valuesBefore), probeRenewed: false},
    oldWork: {sameCensus, sourceCounts: current.sourceCounts, capturedEvents: current.eventCount,
      recordedDeliveries: current.deliveryCount, retainedNotices: current.historicalPossiblyDeliveredNotificationCount,
      pendingWorkCount: null, inFlightWorkCount: null, legacyUntracked: true, canReplay: false},
    status: "NOT_READY", startAt: null, blockers, writerControls: null, causalDrain: null,
    canEnterMaintenance: false, canApply: false};
  return {...body, preparationDigest: digest(body)};
}
module.exports = {prepareDevelopFencedMaintenance};
if (require.main === module) {console.error("Import reviewed private evidence; no network or apply CLI.");process.exitCode = 1;}
