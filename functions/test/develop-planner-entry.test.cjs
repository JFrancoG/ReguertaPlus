"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const {spawnSync} = require("node:child_process");
const {prepareDevelopPlannerEntry: prepare, PAIRS, PATHS} = require("../scripts/prepare-develop-planner-entry.cjs");
const {contentProposal} = require("./develop-shift-migration-fixture.cjs");
const {fixture, doc} = require("./develop-legacy-census-fixture.cjs");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
function input() {
  const census = fixture();
  for (let i = 1; i < 62; i++) census.collections.shifts.push(doc(`develop/plus-collections/shifts/old-${i}`, {status: "planned"}));
  for (const [collection, count] of [["deliveryCalendar", 4], ["notificationEvents", 117]]) {
    census.collections[collection] = Array.from({length: count}, (_, i) => doc(`develop/plus-collections/${collection}/old-${i}`, {}));
  }
  const functions = PAIRS.flatMap(([legacy, collector, document, kind]) => [legacy, collector].map((name, i) => {
    const source = {bucket: "example-private-bucket", object: `${name}/source.zip`, generation: "1234"};
    return {name: `projects/reguerta-9f27f/locations/europe-west1/functions/${name}`, environment: "GEN_2", state: "ACTIVE",
      updateTime: "2026-10-29T00:20:00Z", buildConfig: {entryPoint: name, runtime: "nodejs22", source: {storageSource: source},
        sourceProvenance: {resolvedStorageSource: source}}, serviceConfig: {allTrafficOnLatestRevision: true,
        revision: name + "-revision", serviceAccountEmail: "runtime@example.invalid"},
      eventTrigger: {serviceAccountEmail: "runtime@example.invalid", retryPolicy: i ? "RETRY_POLICY_RETRY" : "RETRY_POLICY_DO_NOT_RETRY",
        eventType: `google.cloud.firestore.document.v1.${kind}`, eventFilters: [
          {attribute: "database", value: "(default)"}, {attribute: "namespace", value: "(default)"},
          {attribute: "document", value: `${i ? "develop" : "{env}"}/plus-collections/${document}`, operator: "match-path-pattern"}]}};
  }));
  return {schemaVersion: 1, projectId: "reguerta-9f27f", environment: "develop", reviewedFunctions: structuredClone(functions),
    observedFunctions: functions, observedAt: "2026-10-29T00:25:00Z", absence: {projectId: "reguerta-9f27f", databaseId: "(default)",
      environment: "develop", readOnly: true, readTime: "2026-10-29T00:24:00Z",
      observations: PATHS.map(path => ({path, status: 404, document: null}))}, contentProposal: contentProposal(), census};
}
function redigest(value) {
  const body = structuredClone(value.contentProposal);
  delete body.proposalDigest; delete body.contentDigest;
  value.contentProposal = {...body, proposalDigest: digest(body), contentDigest: digest(body.content)};
}
test("prepares actual capture scope and preserves dates/order/cursors without inventing initial authority", () => {
  const value = input(), before = structuredClone(value), result = prepare(value);
  assert.deepEqual(value, before); assert.equal(result.controls.length, 4);
  assert.ok(result.controls.every(x => x.state === "capture-only" && x.productionTransportState === "ACTIVE" &&
    x.pendingBusinessWorkCount === null && x.inFlightBusinessWorkCount === null && !x.compatibleWithCurrentBarrier));
  assert.equal(result.initialStateDocument, null); assert.equal(result.observedInitialState, "absent-not-epoch-zero");
  assert.equal(result.initialization[4].action, "keep-absent-until-governed-sheets-submission");
  for (const [i, type] of ["delivery", "market"].entries()) {
    assert.deepEqual(result.initialization[i + 2].retainedPostPublishedCursor, value.contentProposal.content.rotations[type].postPublishedCursor);
  }
  assert.equal(result.publishedContentDigest, value.contentProposal.contentDigest);
  assert.equal(result.canApply, false); assert.equal(result.canEnterMaintenance, false);
});
for (const [name, mutate] of [
  ["production", x => { x.environment = "production"; }],
  ["missing collector", x => { x.observedFunctions.pop(); }],
  ["duplicate function", x => { x.observedFunctions[0] = x.observedFunctions[1]; }],
  ["source archive drift", x => { x.observedFunctions[0].buildConfig.source.storageSource.generation = "5678"; }],
  ["runtime identity drift", x => { x.observedFunctions[0].serviceConfig.serviceAccountEmail = "other@example.invalid"; }],
  ["revision traffic drift", x => { x.observedFunctions[0].serviceConfig.allTrafficOnLatestRevision = false; }],
  ["existing state", x => { x.absence.observations[0] = {...x.absence.observations[0], status: 200, document: {}}; }],
  ["missing absence", x => { x.absence.observations.pop(); }],
  ["duplicate absence", x => { x.absence.observations[1] = x.absence.observations[0]; }],
  ["changed retained dates", x => { x.contentProposal.content.shifts[0].date = "2030-01-01"; }],
  ["reordered ownership", x => { x.contentProposal.content.shifts[0].positions[0].rotationOwnerUserId = "unreviewed"; redigest(x); }],
  ["fake cursor", x => { x.contentProposal.content.rotations.delivery.postPublishedCursor.nextMemberIndex = 0; redigest(x); }],
  ["invented executable permission", x => { x.canApply = true; }],
]) test(`rejects ${name}`, () => { const value = input(); mutate(value); assert.throws(() => prepare(value)); });
for (const [name, mutate] of [
  ["shared trigger called disabled", x => { x.state = "DISABLED"; }],
  ["collector with no retry", x => { x.eventTrigger.retryPolicy = "RETRY_POLICY_DO_NOT_RETRY"; }],
  ["collector broadened to production", x => { x.eventTrigger.eventFilters[2].value = "{env}/plus-collections/shifts/{shiftId}"; }],
  ["missing immutable source", x => { delete x.buildConfig.sourceProvenance; }],
]) test(`rejects internally consistent but invalid ${name}`, () => {
  const value = input(); mutate(value.observedFunctions[1]); value.reviewedFunctions = structuredClone(value.observedFunctions);
  assert.throws(() => prepare(value));
});
test("CLI only writes review output once and rejects an apply option without replacing input", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "develop-entry-")), source = path.join(dir, "input.json"), output = path.join(dir, "result.json");
  try {
    fs.writeFileSync(source, JSON.stringify(input()));
    const script = path.resolve(__dirname, "../scripts/prepare-develop-planner-entry.cjs");
    const args = [script, "--input", source, "--output", output];
    assert.equal(spawnSync(process.execPath, args).status, 0);
    assert.notEqual(spawnSync(process.execPath, args).status, 0);
    assert.notEqual(spawnSync(process.execPath, [...args, "--apply"]).status, 0);
    assert.equal(JSON.parse(fs.readFileSync(output)).liveExecutable, false);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test("provider filter ordering does not change the reviewed source scope", () => {
  const value = input();
  for (const fn of value.observedFunctions) fn.eventTrigger.eventFilters.reverse();
  assert.deepEqual(prepare(value).controls, prepare(input()).controls);
});
