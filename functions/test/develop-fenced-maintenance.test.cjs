"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const {prepareDevelopFencedMaintenance: prepare, inspectDevelopRetiredRuntimes: inspectRuntimes,
  inspectDevelopOwnerTransfer: inspectTransfer} =
  require("../scripts/prepare-develop-fenced-maintenance.cjs");
const {fixture, doc, LATER} = require("./develop-legacy-census-fixture.cjs");
const {parseShiftPlanningMaintenanceBarrierEvidenceEnvelope: parseBarrier} = require("../lib/shift-planning-intake-barrier.js");
const FILE = "1O7VKs7S4wZHVvTfNBehAd5EzF3Mgw2q9LweK68Gm76A", PARENT = "0ADG4r1X1_oDPUk9PVA";
const accounts = ["195744802339-compute@developer.gserviceaccount.com",
  "firebase-adminsdk-2xhs2@reguerta-9f27f.iam.gserviceaccount.com"];
const time = seconds => new Date(Date.parse("2026-10-28T10:01:00Z") + seconds * 1000).toISOString();
function input() {
  const permissions = [{type: "user", emailAddress: "drpuerk@gmail.com", role: "owner"},
    ...[...accounts, "reguerta-shifts-inspector@reguerta-9f27f.iam.gserviceaccount.com"]
      .map(emailAddress => ({type: "user", emailAddress, role: "reader"}))];
  const values = {spreadsheetId: FILE, valueRanges: ["turnos-reparto 2026-27", "turnos-mercado 2026-27",
    "turnos-reparto 2027-28", "turnos-mercado 2027-28", "TORRE 2025-26", "MERCADO 2025-26"]
    .map((name, i) => ({range: `'${name}'!A1:${i === 4 ? "Y" : "Z"}200`, values: [["Fecha"]]}))};
  return {nowMillis: Date.parse(time(300)), previousCensus: fixture(), currentCensus: fixture(),
    ownerReadback: {observedAt: time(240), file: {id: FILE, parent_ids: [PARENT],
      mime_type: "application/vnd.google-apps.spreadsheet", permissions, modified_time: time(2)},
    parent: {id: PARENT, permissions: permissions.slice(0, 1)}},
    fence: {plan: {project: "reguerta-9f27f", fileId: FILE, accounts, authorized: true},
      positive: accounts.map(emailAddress => ({at: time(1), metadata: {httpStatus: 200, data: {id: FILE,
        mimeType: "application/vnd.google-apps.spreadsheet", capabilities: {canEdit: true},
        permissions: [{emailAddress, role: "writer"}]}}, result: {httpStatus: 200, data: {spreadsheetId: FILE}}})),
      negative: accounts.map(() => ({at: time(3), originalPreDemotionToken: true,
        metadata: {httpStatus: 200, data: {id: FILE, mimeType: "application/vnd.google-apps.spreadsheet",
          capabilities: {canEdit: false}, modifiedTime: time(2)}},
        result: {httpStatus: 403, data: {error: {status: "PERMISSION_DENIED"}}}})),
      cleanup: accounts.map(() => ({at: time(0), unrelatedBindingsPreserved: true, after: {version: 1}})),
      expired: {at: time(180), results: accounts.map((_, index) => ({index, status: 401, error: "UNAUTHENTICATED"}))},
      valuesBefore: values, valuesAfter: structuredClone(values)}};
}

test("valid fence preserves unknown old work, historical probe times and closed admission", () => {
  const data = input(), original = structuredClone(data), result = prepare(data);
  assert.deepEqual(data, original);
  assert.equal(result.oldWork.sameCensus, true);
  assert.equal(result.oldWork.pendingWorkCount, null);assert.equal(result.oldWork.inFlightWorkCount, null);
  assert.equal(result.oldWork.legacyUntracked, true);assert.equal(result.oldWork.canReplay, false);
  assert.equal(result.status, "NOT_READY");assert.equal(result.startAt, null);
  assert.equal(result.writerControls, null);assert.equal(result.causalDrain, null);
  assert.equal(result.canEnterMaintenance, false);assert.equal(result.canApply, false);
  assert.deepEqual(result.fence.deniedAt, [time(3), time(3)]);assert.equal(result.fence.probeRenewed, false);
  assert.throws(() => parseBarrier(result));
  assert.equal(JSON.stringify(result).includes("Never include this private content"), false);
});
test("changed or newly queued source cannot reuse the old reconciliation", () => {
  const data = input();
  data.currentCensus.collections.shiftPlanningRequests.push(doc("develop/plus-collections/shiftPlanningRequests/late", {status: "processing"}, LATER));
  const result = prepare(data);
  assert.equal(result.oldWork.sameCensus, false);
  assert.ok(result.blockers.includes("census-changed-reconciliation-required"));
  assert.equal(result.oldWork.pendingWorkCount, null);
});
test("older metadata is reported rather than renewing workbook or probe freshness", () => {
  const data = input();data.ownerReadback.file.modified_time = time(1);
  const result = prepare(data);
  assert.equal(result.fence.metadataRegressed, true);
  assert.ok(result.blockers.includes("owner-metadata-older-than-probe"));
});
for (const [name, change] of [
  ["wrong workbook", d => {d.fence.plan.fileId = "production";}],
  ["wrong account", d => {d.fence.plan.accounts = [accounts[0], "other"];}],
  ["missing second denial", d => {d.fence.negative.pop();}],
  ["invalid positive control", d => {d.fence.positive[0].result.httpStatus = 400;}],
  ["expired credential instead of write fence", d => {d.fence.negative[0].result.httpStatus = 401;}],
  ["different negative credential", d => {d.fence.negative[0].originalPreDemotionToken = false;}],
  ["other file result", d => {d.fence.negative[0].metadata.data.id = "other";}],
  ["unremoved grant", d => {d.fence.cleanup[0].after.bindings = [{role: "roles/iam.workloadIdentityUser"}];}],
  ["credential still valid", d => {d.fence.expired.results[1].status = 200;}],
  ["changed values", d => {d.fence.valuesAfter.valueRanges[0].values[0][0] = "Other";}],
  ["duplicated range", d => {d.fence.valuesBefore.valueRanges[1] = d.fence.valuesBefore.valueRanges[0];}],
  ["restored file writer", d => {d.ownerReadback.file.permissions[1].role = "writer";}],
  ["new inherited writer", d => {d.ownerReadback.parent.permissions.push({type: "user", emailAddress: "other", role: "writer"});}],
  ["wrong parent", d => {d.ownerReadback.file.parent_ids = ["other"];}],
  ["old census", d => {d.currentCensus.readTime = time(100);}],
  ["future readback", d => {d.ownerReadback.observedAt = time(301);}],
]) test(`rejects ${name}`, () => {const data = input();change(data);assert.throws(() => prepare(data));});

function runtimes() {
  const root = "projects/reguerta-9f27f/locations/europe-west1/", name = root + "services/onshiftwritten";
  const fn = {name: root + "functions/onShiftWritten", serviceConfig: {service: name, revision: "onshiftwritten-00002-new"}};
  const latest = name + "/revisions/" + fn.serviceConfig.revision;
  const service = {name, latestReadyRevision: latest, latestCreatedRevision: latest,
    generation: "2", observedGeneration: "2", terminalCondition: {state: "CONDITION_SUCCEEDED"},
    traffic: [{type: "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST", percent: 100}],
    trafficStatuses: [{type: "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST", revision: fn.serviceConfig.revision, percent: 100}]};
  const old = {name: name + "/revisions/onshiftwritten-00001-old", generation: "1", observedGeneration: "1",
    conditions: [{type: "Active", state: "CONDITION_FAILED", revisionReason: "RETIRED", lastTransitionTime: time(100)}]};
  return {reviewedFunctions: [fn], observation: {projectId: "reguerta-9f27f", readOnly: true,
    startedAt: time(200), completedAt: time(210), services: [{functionName: fn.name, service,
      serviceAfter: structuredClone(service), revisions: [{name: latest}, old]}]}};
}
test("provider retirement closes old container execution but not submitted effects or other writers", () => {
  const data = runtimes(), before = structuredClone(data), result = inspectRuntimes(data);
  assert.equal(result.retiredRevisionCount, 1);assert.equal(result.serviceCount, 1);
  assert.equal(result.oldContainerExecution, "provider-infrastructure-retired");
  assert.equal(result.submittedExternalEffects, "not-established");assert.equal(result.otherAutomaticWriters, "not-established");
  assert.equal(result.canEnterMaintenance, false);assert.equal(result.canApply, false);assert.deepEqual(data, before);
  const combined = prepare({...input(), retiredRuntimes: data});
  assert.deepEqual(combined.oldWork.runtimeIsolation, result);
  assert.equal(combined.oldWork.inFlightWorkCount, null);
  assert.ok(combined.blockers.includes("old-business-effects-not-closed"));
  assert.throws(() => parseBarrier(combined));
});
for (const [name, change] of [
  ["unreviewed function", d => {d.reviewedFunctions[0].name += "Other";}],
  ["wrong project", d => {d.observation.projectId = "production-project";}],
  ["missing service", d => {d.observation.services.pop();}],
  ["duplicated service", d => {d.observation.services.push(d.observation.services[0]);}],
  ["service changed during read", d => {d.observation.services[0].serviceAfter.generation = "3";}],
  ["tagged old revision", d => {for (const s of [d.observation.services[0].service, d.observation.services[0].serviceAfter]) s.trafficStatuses.push({tag: "old", percent: 0, revision: "onshiftwritten-00001-old"});}],
  ["missing latest revision", d => {d.observation.services[0].revisions.shift();}],
  ["duplicate revision", d => {d.observation.services[0].revisions.push(d.observation.services[0].revisions[1]);}],
  ["timeout instead of retirement", d => {d.observation.services[0].revisions[1].conditions[0].revisionReason = "HEALTH_CHECK_CONTAINER_ERROR";}],
  ["active old revision", d => {d.observation.services[0].revisions[1].conditions[0].state = "CONDITION_SUCCEEDED";}],
  ["revision still reconciling", d => {d.observation.services[0].revisions[1].reconciling = true;}],
  ["unobserved revision generation", d => {d.observation.services[0].revisions[1].observedGeneration = "0";}],
  ["missing generations", d => {delete d.observation.services[0].revisions[1].generation;delete d.observation.services[0].revisions[1].observedGeneration;}],
  ["future retirement", d => {d.observation.services[0].revisions[1].conditions[0].lastTransitionTime = time(220);}],
]) test(`runtime isolation rejects ${name}`, () => {const data = runtimes();change(data);assert.throws(() => inspectRuntimes(data));});

function transfer() {
  const request = {spreadsheet_id: FILE, requests: [{updateCells: {
    range: {sheetId: 673721152, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1},
    rows: [{values: [{userEnteredValue: {stringValue: "Fecha"}}]}], fields: "userEnteredValue",
  }}]};
  const values = {spreadsheetId: FILE, sheets: [673721152, 300742320, 769128650, 1735509106, 1770956648, 448800119]
    .map(sheetId => ({properties: {sheetId}, data: [{rowData: [{values: [{userEnteredValue: {stringValue: "Fecha"}}]}]}]}))};
  return {fileId: FILE, authorized: true, connectorAccount: "drpuerk@gmail.com", completedAt: time(290),
    sharing: {fileId: FILE, source: "google-sharing-ui", generalAccess: "restricted", observedAt: time(280),
      permissions: [{type: "user", emailAddress: "testplusprojects@gmail.com", role: "owner"},
        ...input().ownerReadback.file.permissions.map(p => ({...p, role: "reader"}))]},
    positive: {at: time(250), request, result: {isError: false, structuredContent: {spreadsheetId: FILE}}},
    negative: {at: time(270), request: structuredClone(request), result: {isError: true,
      structuredContent: {error_code: "FORBIDDEN", error: "HTTPError: 403 PERMISSION_DENIED"}}},
    ranges: input().fence.valuesBefore.valueRanges.map(row => row.range), valuesBefore: values, valuesAfter: structuredClone(values)};
}
test("accepted transfer binds the current owner without fabricating parent authority or replacing history", () => {
  const data = transfer(), original = structuredClone(data), report = inspectTransfer(data);
  assert.equal(report.owner, "testplusprojects@gmail.com");assert.equal(report.formerOwnerRole, "reader");
  assert.equal(report.typedValueCount, 6);assert.equal(report.parentAuthority, "not-observed");
  assert.equal(report.connectorWrite, "permission-denied");assert.equal(report.connectorRead, "preserved");
  assert.deepEqual(data, original);
  const result = prepare({...input(), ownerTransfer: data});
  assert.deepEqual(result.currentOwnership, report);assert.equal(result.status, "NOT_READY");
  assert.equal(result.oldWork.legacyUntracked, true);assert.equal(result.oldWork.inFlightWorkCount, null);
  assert.ok(result.blockers.includes("fresh-owner-parent-authority-required"));
  assert.equal(result.fence.ownerRolesObservedAt, time(240));assert.equal(result.canApply, false);
  assert.throws(() => parseBarrier(result));
});
for (const [name, change] of [
  ["unaccepted owner", d => {d.sharing.permissions[0].role = "writer";}],
  ["former owner still editor", d => {d.sharing.permissions[1].role = "writer";}],
  ["extra writer", d => {d.sharing.permissions.push({type: "user", emailAddress: "other", role: "writer"});}],
  ["public sharing", d => {d.sharing.generalAccess = "anyone";}],
  ["different negative request", d => {d.negative.request.requests[0].updateCells.range.sheetId = 1;}],
  ["failed positive probe", d => {d.positive.result.isError = true;}],
  ["expired token", d => {d.negative.result.structuredContent = {error_code: "UNAUTHORIZED", error: "401 UNAUTHENTICATED"};}],
  ["unrelated forbidden error", d => {d.negative.result.structuredContent.error = "403 QUOTA_EXCEEDED";}],
  ["changed values", d => {d.valuesAfter.sheets[0].data[0].rowData[0].values[0].userEnteredValue.stringValue = "Other";}],
  ["missing tab", d => {d.valuesBefore.sheets.pop();d.valuesAfter.sheets.pop();}],
  ["sharing before denial", d => {d.sharing.observedAt = time(260);}],
]) test(`owner isolation rejects ${name}`, () => {const data = transfer();change(data);assert.throws(() => inspectTransfer(data));});
