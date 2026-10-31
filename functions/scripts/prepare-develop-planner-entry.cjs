"use strict";
// Offline preparation only. Provider/source receipts are evidence inputs, never
// a replacement for the trusted control plane or permission to initialize data.
const fs = require("node:fs");
const assert = require("node:assert/strict");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {inspectCensus} = require("./inspect-develop-legacy-census.cjs");
const {checkContentPositions} = require("./rehearse-develop-shift-migration.cjs");
const PROJECT = "reguerta-9f27f", ROOT = "develop/plus-collections";
const PAIRS = [
  ["onShiftPlanningRequestCreated", "captureDevelopShiftPlanningRequest", "shiftPlanningRequests/{requestId}", "created"],
  ["onShiftWritten", "captureDevelopShiftWritten", "shifts/{shiftId}", "written"],
  ["onDeliveryCalendarOverrideWritten", "captureDevelopDeliveryCalendarWritten", "deliveryCalendar/{weekKey}", "written"],
  ["onNotificationEventCreated", "captureDevelopNotificationCreated", "notificationEvents/{eventId}", "created"],
];
const PATHS = ["shiftPlanningState/current", "shiftPlanningState/sourcePolicy",
  "shiftRotations/delivery", "shiftRotations/market", "shiftPlanningState/sheetsSubmission"].map(p => `${ROOT}/${p}`);
const equal = (a, b, message) => assert.equal(digest(a), digest(b), message);
const exact = (value, keys) => assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), "exact fields required");
function normalizedConfiguration(fn) {
  const result = structuredClone(fn);
  result.eventTrigger.eventFilters.sort((a, b) => a.attribute.localeCompare(b.attribute));
  return result;
}
const identity = name => `projects/${PROJECT}/locations/europe-west1/functions/${name}`;

function reviewDevelopCaptureControls(input) {
  const names = PAIRS.flatMap(pair => pair.slice(0, 2));
  for (const set of [input.reviewedFunctions, input.observedFunctions]) {
    assert.equal(set.length, 8);
    assert.deepEqual(set.map(fn => fn.name).sort(), names.map(identity).sort(), "exact eight functions required");
  }
  return PAIRS.map(([legacy, collector, document, kind]) => {
    const read = (name, prefix, retry) => {
      const fn = input.observedFunctions.find(fn => fn.name === identity(name));
      equal(normalizedConfiguration(input.reviewedFunctions.find(old => old.name === fn.name)),
        normalizedConfiguration(fn), "reviewed provider/source configuration changed");
      assert.equal(fn.state, "ACTIVE"); assert.equal(fn.environment, "GEN_2");
      assert.equal(fn.buildConfig.entryPoint, name); assert.equal(fn.buildConfig.runtime, "nodejs22");
      const source = fn.buildConfig.sourceProvenance?.resolvedStorageSource;
      assert.ok(source?.bucket && source.object && /^\d+$/.test(source.generation), "immutable deployed source required");
      equal(source, fn.buildConfig.source.storageSource, "immutable source differs");
      assert.equal(fn.eventTrigger.eventType, `google.cloud.firestore.document.v1.${kind}`);
      assert.equal(fn.eventTrigger.retryPolicy, retry);
      equal([...fn.eventTrigger.eventFilters].sort((a, b) => a.attribute.localeCompare(b.attribute)), [
        {attribute: "database", value: "(default)"},
        {attribute: "document", value: `${prefix}/plus-collections/${document}`, operator: "match-path-pattern"},
        {attribute: "namespace", value: "(default)"},
      ], "exact source scope required");
      assert.equal(fn.serviceConfig.allTrafficOnLatestRevision, true);
      assert.ok(fn.serviceConfig.revision && fn.serviceConfig.serviceAccountEmail);
      assert.equal(fn.eventTrigger.serviceAccountEmail, fn.serviceConfig.serviceAccountEmail);
      return {name, providerRevision: fn.updateTime, runtimeRevision: fn.serviceConfig.revision,
        configurationDigest: digest(normalizedConfiguration(fn)), immutableSource: source};
    };
    return {sourceScope: {projectId: PROJECT, databaseId: "(default)", environment: "develop",
      documentPattern: `${ROOT}/${document}`}, state: "capture-only", productionTransportState: "ACTIVE",
    shared: read(legacy, "{env}", "RETRY_POLICY_DO_NOT_RETRY"),
    collector: read(collector, "develop", "RETRY_POLICY_RETRY"),
    pendingBusinessWorkCount: null, inFlightBusinessWorkCount: null,
    requiredControl: "source-scoped-capture-with-separate-drain", compatibleWithCurrentBarrier: false};
  });
}

function prepareDevelopPlannerEntry(value) {
  const input = structuredClone(value);
  exact(input, ["schemaVersion", "projectId", "environment", "reviewedFunctions", "observedFunctions",
    "observedAt", "absence", "contentProposal", "census"]);
  assert.equal(input.schemaVersion, 1); assert.equal(input.projectId, PROJECT); assert.equal(input.environment, "develop");
  assert.ok(Number.isFinite(Date.parse(input.observedAt)), "observation timestamp required");
  const controls = reviewDevelopCaptureControls(input);
  const absence = input.absence;
  assert.equal(absence.projectId, PROJECT); assert.equal(absence.databaseId, "(default)");
  assert.equal(absence.environment, "develop"); assert.equal(absence.readOnly, true);
  assert.ok(Number.isFinite(Date.parse(absence.readTime)), "atomic absence readTime required");
  assert.deepEqual(absence.observations.map(x => x.path).sort(), [...PATHS].sort());
  assert.ok(absence.observations.every(x => x.status === 404 && x.document === null), "initial authority is not absent");
  const {proposalDigest, contentDigest, ...body} = input.contentProposal;
  assert.equal(body.scope, "develop_content_proposal_only"); assert.equal(body.environment, "develop");
  assert.equal(body.liveExecutable, false); equal(digest(body), proposalDigest, "proposal binding changed");
  equal(digest(body.content), contentDigest, "content binding changed");
  assert.equal(body.content.ownerProvenance, "declared_synthetic_develop_only");
  assert.equal(body.content.shifts.length, 72);
  assert.equal(new Set(body.content.shifts.map(x => x.id)).size, 72);
  checkContentPositions(body.content);
  const census = inspectCensus(input.census);
  equal(census.sourceCounts, {shiftPlanningRequests: 0, shifts: 62, deliveryCalendar: 4, notificationEvents: 117}, "source counts changed");
  const initialization = [
    {path: PATHS[0], action: "create-after-trusted-admission", expectedBefore: "absent",
      nextStateRevision: 1, nextWriteEpoch: 1, requiredMaintenanceStatus: "closed",
      requiredBindings: ["real-intake-barrier", "operation-id", "active-lineage", "atomic-source-absence"]},
    {path: PATHS[1], action: "prepare-real-source-policy", expectedBefore: "absent",
      unresolved: ["numeric-workbook-version", "deployed-index-authority", "partial-market-horizon",
        "helper-projection-parity", "planning-frontier", "source-policy-admission"]},
    ...["delivery", "market"].map((type, i) => ({path: PATHS[i + 2], action: "create-with-canonical-migration",
      expectedBefore: "absent", retainedPostPublishedCursor: body.content.rotations[type].postPublishedCursor,
      requiredBindings: ["active-lineage", "migration-baseline", "frontier-review"], annualPlanningReady: false})),
    {path: PATHS[4], action: "keep-absent-until-governed-sheets-submission", expectedBefore: "absent"},
  ];
  const result = {schemaVersion: 1, kind: "develop-planner-entry-preparation", projectId: PROJECT, environment: "develop",
    inputDigest: digest(input), providerObservedAt: input.observedAt, sourceReadTime: input.census.readTime,
    absenceReadTime: absence.readTime, sourceSetDigest: census.stableSetDigest, proposalDigest, contentDigest,
    controls, initialization, publishedShiftCount: 72, publishedContentDigest: contentDigest,
    dateAndOrderPreservation: "reuse-exact-reviewed-content-no-regeneration", legacyDisposition: "62-version-bound-before-images-before-retirement",
    observedInitialState: "absent-not-epoch-zero", initialStateDocument: null,
    blockers: ["trusted-source-scoped-control-plane", "separate-causal-drain", "fresh-cohort-and-workbook-bindings",
      "initial-state-atomic-admission", "real-source-policy", "owner-administrator-window-agreements"],
    liveExecutable: false, canApply: false, canEnterMaintenance: false, legacyUntracked: true};
  return {...result, preparationDigest: digest(result)};
}
module.exports = {prepareDevelopPlannerEntry, reviewDevelopCaptureControls, PAIRS, PATHS};
if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    assert.ok(args.length === 4 && args[0] === "--input" && args[2] === "--output", "review arguments only");
    assert.ok(fs.statSync(args[1]).size <= 16 * 1024 * 1024, "input size limit");
    const result = prepareDevelopPlannerEntry(JSON.parse(fs.readFileSync(args[1], "utf8")));
    fs.writeFileSync(args[3], JSON.stringify(result, null, 2), {mode: 0o600, flag: "wx"});
    console.log(JSON.stringify({preparationDigest: result.preparationDigest, controls: 4, paths: 5, canApply: false}));
  } catch { console.error("develop_planner_entry_preparation_rejected"); process.exitCode = 1; }
}
