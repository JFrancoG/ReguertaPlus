"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const {prepareDevelopFencedMaintenance: prepare} = require("../scripts/prepare-develop-fenced-maintenance.cjs");
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
