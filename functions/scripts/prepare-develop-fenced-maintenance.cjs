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

// RETIRED is provider lifecycle evidence, not a timeout/quiet-log inference.
// It closes only execution in these old containers, not effects already sent
// to another service or authority held by a different workload.
function inspectDevelopRetiredRuntimes({reviewedFunctions, observation}) {
  assert.equal(observation.readOnly, true);assert.equal(observation.projectId, PROJECT);
  assert.ok(stamp(observation.startedAt) <= stamp(observation.completedAt));
  assert.ok(Array.isArray(reviewedFunctions) && reviewedFunctions.length > 0);
  const expected = new Map(reviewedFunctions.map(fn => [fn.name, fn]));
  assert.equal(expected.size, reviewedFunctions.length);
  assert.deepEqual(observation.services.map(row => row.functionName).sort(), [...expected.keys()].sort());
  let retiredRevisionCount = 0;
  for (const row of observation.services) {
    const fn = expected.get(row.functionName), service = row.service;
    assert.ok(fn.name.startsWith(`projects/${PROJECT}/locations/europe-west1/functions/`));
    assert.ok(fn.serviceConfig.service.startsWith(`projects/${PROJECT}/locations/europe-west1/services/`));
    assert.equal(service.name, fn.serviceConfig.service);
    assert.equal(digest(service), digest(row.serviceAfter), "service changed during revision inspection");
    const latest = `${service.name}/revisions/${fn.serviceConfig.revision}`;
    assert.equal(service.latestReadyRevision, latest);assert.equal(service.latestCreatedRevision, latest);
    assert.match(service.generation || "", /^[1-9][0-9]*$/);
    assert.equal(service.generation, service.observedGeneration);
    assert.equal(service.terminalCondition.state, "CONDITION_SUCCEEDED");
    for (const targets of [service.traffic, service.trafficStatuses]) {
      assert.equal(targets.length, 1);
      const target = targets[0];assert.equal(target.percent, 100);assert.ok(!target.tag);
      assert.ok(target.revision === latest || target.revision === fn.serviceConfig.revision ||
        (target.type === "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST" && !target.revision));
    }
    const names = row.revisions.map(revision => revision.name);
    assert.equal(new Set(names).size, names.length);assert.ok(names.includes(latest));
    for (const revision of row.revisions) {
      assert.ok(revision.name.startsWith(service.name + "/revisions/"));
      if (revision.name === latest) continue;
      assert.match(revision.generation || "", /^[1-9][0-9]*$/);
      assert.ok(!revision.reconciling);assert.equal(revision.generation, revision.observedGeneration);
      const active = revision.conditions.filter(c => c.type === "Active");
      assert.equal(active.length, 1);assert.equal(active[0].state, "CONDITION_FAILED");
      assert.equal(active[0].revisionReason, "RETIRED");
      assert.ok(stamp(active[0].lastTransitionTime) <= stamp(observation.completedAt));
      retiredRevisionCount++;
    }
  }
  return {kind: "develop-old-runtime-isolation-observation", observationDigest: digest(observation),
    reviewedFunctionsDigest: digest(reviewedFunctions), observedAt: observation.completedAt,
    serviceCount: expected.size, retiredRevisionCount, oldContainerExecution: "provider-infrastructure-retired",
    submittedExternalEffects: "not-established", otherAutomaticWriters: "not-established",
    canEnterMaintenance: false, canApply: false};
}

// The connector loses permission/parent metadata when its user becomes a reader.
// Preserve the earlier API readback as history and bind the separately observed
// sharing UI to a real same-request denial; do not invent a new parent ACL.
function inspectDevelopOwnerTransfer(observation) {
  assert.equal(observation.fileId, FILE);assert.equal(observation.authorized, true);
  assert.equal(observation.connectorAccount, OWNER);
  const {sharing, positive, negative, valuesBefore, valuesAfter} = observation;
  assert.equal(sharing.source, "google-sharing-ui");assert.equal(sharing.fileId, FILE);
  assert.equal(sharing.generalAccess, "restricted");
  assert.deepEqual(roles(sharing.permissions), roles([
    {type: "user", emailAddress: "testplusprojects@gmail.com", role: "owner"},
    ...[OWNER, ...ACCOUNTS, INSPECTOR].map(emailAddress => ({type: "user", emailAddress, role: "reader"})),
  ]));
  const request = {spreadsheet_id: FILE, requests: [{updateCells: {
    range: {sheetId: 673721152, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1},
    rows: [{values: [{userEnteredValue: {stringValue: "Fecha"}}]}], fields: "userEnteredValue",
  }}]};
  assert.deepEqual(positive.request, request);assert.deepEqual(negative.request, request);
  assert.equal(positive.result.isError, false);assert.equal(positive.result.structuredContent.spreadsheetId, FILE);
  assert.equal(negative.result.isError, true);
  assert.equal(negative.result.structuredContent.error_code, "FORBIDDEN");
  assert.match(negative.result.structuredContent.error, /403/);
  assert.match(negative.result.structuredContent.error, /PERMISSION_DENIED/);
  assert.ok(stamp(positive.at) < stamp(negative.at));
  assert.ok(stamp(negative.at) <= stamp(sharing.observedAt));
  assert.ok(stamp(sharing.observedAt) <= stamp(observation.completedAt));
  assert.equal(valuesBefore.spreadsheetId, FILE);assert.deepEqual(valuesBefore, valuesAfter);
  assert.deepEqual(observation.ranges, RANGES);
  assert.deepEqual(valuesBefore.sheets.map(s => s.properties.sheetId),
    [673721152, 300742320, 769128650, 1735509106, 1770956648, 448800119]);
  assert.equal(valuesBefore.sheets[0].data[0].rowData[0].values[0].userEnteredValue.stringValue, "Fecha");
  const typedValueCount = valuesBefore.sheets.reduce((total, sheet) => total + sheet.data.reduce((n, grid) =>
    n + grid.rowData.reduce((m, row) => m + (row.values || []).filter(cell => cell.userEnteredValue).length, 0), 0), 0);
  return {kind: "develop-owner-transfer-observation", observationDigest: digest(observation),
    observedAt: observation.completedAt, owner: "testplusprojects@gmail.com", formerOwnerRole: "reader",
    sharingSource: sharing.source, connectorWrite: "permission-denied", connectorRead: "preserved",
    typedValueCount, parentAuthority: "not-observed", otherAutomaticWriters: "not-established",
    submittedExternalEffects: "not-established", canEnterMaintenance: false, canApply: false};
}

function prepareDevelopFencedMaintenance({fence, ownerReadback, previousCensus, currentCensus, nowMillis, retiredRuntimes, ownerTransfer}) {
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
  const runtimeIsolation = retiredRuntimes ? inspectDevelopRetiredRuntimes(retiredRuntimes) : null;
  if (runtimeIsolation) assert.ok(stamp(runtimeIsolation.observedAt) <= nowMillis);
  const currentOwnership = ownerTransfer ? inspectDevelopOwnerTransfer(ownerTransfer) : null;
  if (currentOwnership) {
    assert.ok(observedAt < stamp(ownerTransfer.positive.at), "previous owner readback is historical");
    assert.ok(stamp(currentOwnership.observedAt) <= nowMillis);
  }
  const sameCensus = previous.stableSetDigest === current.stableSetDigest;
  const metadataRegressed = stamp(file.modified_time) < Math.max(...fence.negative.map(p => stamp(p.metadata.data.modifiedTime)));
  const blockers = ["old-business-effects-not-closed", "complete-automatic-writer-authority-not-closed",
    "fresh-workbook-version-and-content-required", "fresh-full-control-and-causal-drain-evidence-required",
    "owner-and-administrator-window-agreements-required"];
  if (!sameCensus) blockers.unshift("census-changed-reconciliation-required");
  if (currentOwnership) blockers.unshift("fresh-owner-parent-authority-required");
  if (metadataRegressed) blockers.unshift("owner-metadata-older-than-probe");
  const body = {schemaVersion: 1, kind: "develop-fenced-maintenance-preparation", projectId: PROJECT,
    environment: "develop", fileId: FILE, preparedAtMillis: nowMillis, readOnly: true,
    evidenceDigests: {fence: digest(fence), ownerReadback: digest(ownerReadback),
      previousCensus: previous.fingerprint, currentCensus: current.fingerprint},
    currentOwnership,
    fence: {scope: "two-service-accounts-only", deniedAt, credentialsCleanedAt: fence.expired.at,
      ownerRolesObservedAt: ownerReadback.observedAt, metadataRegressed,
      inspectedValuesDigest: digest(fence.valuesBefore), probeRenewed: false},
    oldWork: {sameCensus, sourceCounts: current.sourceCounts, capturedEvents: current.eventCount,
      recordedDeliveries: current.deliveryCount, retainedNotices: current.historicalPossiblyDeliveredNotificationCount,
      runtimeIsolation, pendingWorkCount: null, inFlightWorkCount: null, legacyUntracked: true, canReplay: false},
    status: "NOT_READY", startAt: null, blockers, writerControls: null, causalDrain: null,
    canEnterMaintenance: false, canApply: false};
  return {...body, preparationDigest: digest(body)};
}
module.exports = {prepareDevelopFencedMaintenance, inspectDevelopRetiredRuntimes, inspectDevelopOwnerTransfer};
if (require.main === module) {console.error("Import reviewed private evidence; no network or apply CLI.");process.exitCode = 1;}
