"use strict";
// Read-only observation through injected provider ports. Even explicit zero
// samples cannot supply the independent causal counters of the trusted barrier.
const assert = require("node:assert/strict");
const {createHash} = require("node:crypto");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {DEVELOP_CAPTURE_ROUTES, parseShiftPlanningDevelopCaptureControl: parse} =
  require("../lib/shift-planning-develop-capture-control.js");
const {PAIRS, reviewDevelopCaptureControls} = require("./prepare-develop-planner-entry.cjs");
const {inspectCensus} = require("./inspect-develop-legacy-census.cjs");
const {DEVELOP_CONTAINED_DELIVERY_POLICY, containedDeliveryBusinessDigest, parseContainedDeliveryEvidence} =
  require("../lib/shift-planning-contained-delivery.js");
const PROJECT = "reguerta-9f27f";
const identity = name => `projects/${PROJECT}/locations/europe-west1/functions/${name}`;
async function observeDevelopCaptureControls({reviewedFunctions, reviewedArchives, readFunction, readArchive, readQueues, nowMillis}) {
  const expected = structuredClone(reviewedFunctions), archives = structuredClone(reviewedArchives);
  // Validate all fixed selectors before calling any provider port.
  reviewDevelopCaptureControls({reviewedFunctions: expected, observedFunctions: expected});
  assert.deepEqual(archives.map(x => x.target).sort(), PAIRS.flatMap(x => x.slice(0, 2)).sort());
  for (const archive of archives) {
    assert.match(archive.archiveSha256, /^[a-f0-9]{64}$/);
    const fn = expected.find(x => x.name === identity(archive.target));
    assert.equal(digest(archive.source), digest(fn.buildConfig.sourceProvenance.resolvedStorageSource));
  }
  const startedAtMillis = nowMillis(); assert.ok(Number.isSafeInteger(startedAtMillis) && startedAtMillis >= 0);
  const actual = [];
  for (const fn of expected) actual.push(await readFunction(fn.name));
  const controls = reviewDevelopCaptureControls({reviewedFunctions: expected, observedFunctions: actual});
  const sourceDigests = new Map();
  for (const archive of archives) {
    const bytes = await readArchive(structuredClone(archive.source));
    assert.ok(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= 8 * 1024 * 1024);
    const archiveSha256 = createHash("sha256").update(bytes).digest("hex");
    assert.equal(archiveSha256, archive.archiveSha256, "deployed archive differs from reviewed bytes");
    sourceDigests.set(archive.target, digest({archiveSha256}));
  }
  const proofs = controls.map(control => {
    const route = DEVELOP_CAPTURE_ROUTES.find(x => x[1] === control.shared.name);
    const binding = (value, index) => ({functionName: identity(value.name), runtimeRevision: value.runtimeRevision,
      sourceGeneration: value.immutableSource.generation, sourceDigest: sourceDigests.get(value.name),
      reviewedSourceDigest: sourceDigests.get(value.name), configurationDigest: value.configurationDigest,
      reviewedConfigurationDigest: value.configurationDigest,
      documentPattern: `${index ? "develop" : "{env}"}/plus-collections/${route[3]}`,
      retryPolicy: index ? "RETRY_POLICY_RETRY" : "RETRY_POLICY_DO_NOT_RETRY", transportState: "ACTIVE"});
    return parse({schemaVersion: 1, kind: "develop-source-capture", projectId: PROJECT, databaseId: "(default)",
      environment: "develop", writerId: route[0], shared: binding(control.shared, 0), collector: binding(control.collector, 1)}, route[0]);
  });
  const queues = await readQueues(actual.map(fn => ({functionName: fn.name, triggerName: fn.eventTrigger.trigger})));
  assert.equal(queues.readOnly, true); assert.equal(queues.projectId, PROJECT);
  assert.ok(Number.isFinite(Date.parse(queues.observedAt)));
  assert.equal(queues.bindings.length, 8);
  assert.deepEqual(queues.bindings.map(x => x.id).sort(), archives.map(x => x.target).sort());
  assert.ok(queues.bindings.every(x => x.transportBinding && x.functionObserved && x.subscriptionObserved));
  const finishedAtMillis = nowMillis(); assert.ok(Number.isSafeInteger(finishedAtMillis) && finishedAtMillis >= startedAtMillis);
  assert.ok(Date.parse(queues.observedAt) >= startedAtMillis && Date.parse(queues.observedAt) <= finishedAtMillis,
    "queue observation must belong to this read interval");
  // Recheck all deployments after source and queue reads; an intervening rollout
  // must not yield a successful mixed-generation observation.
  const after = [];for (const fn of expected) after.push(await readFunction(fn.name));
  reviewDevelopCaptureControls({reviewedFunctions: actual, observedFunctions: after});
  const body = {schemaVersion: 1, kind: "develop-capture-provider-observation", projectId: PROJECT,
    startedAtMillis, finishedAtMillis: nowMillis(), readOnly: true, reviewedConfigurationDigest: digest(expected),
    proofs, queueObservationDigest: digest(queues), queueSamples: queues.metrics.map(metric => ({type: metric.type,
      status: !metric.observed || !metric.exhausted || !metric.series.length ? "UNKNOWN" : "SAMPLED_ONLY",
      series: metric.series})), causalDrain: null, canEnterMaintenance: false, canApply: false,
    limits: ["sampled-metrics-not-causal-drain", "shared-metrics-not-develop-partitioned", "not-a-held-barrier",
      "separate-workbook-rules-iam-participant-bindings-required"]};
  return {...body, observationDigest: digest(body)};
}
// Offline projection, not a provider-backed business-drain declaration. The
// classified list must come from the separately reviewed reconciliation packet.
// Full census validation preserves nanosecond source versions and immutable rows.
function prepareDevelopContainedDeliveryEvidence({initial, final, classifiedCaptures, initialDeliveries, finalDeliveries}) {
  assert.ok(Array.isArray(classifiedCaptures));
  const classified = classifiedCaptures.map(row => {
    assert.deepEqual(Object.keys(row).sort(), ["coreDigest", "eventKey"]);
    assert.match(row.eventKey, /^[a-f0-9]{64}$/);assert.match(row.coreDigest, /^[a-f0-9]{64}$/);
    return {...row};
  }).sort((a, b) => a.eventKey < b.eventKey ? -1 : 1);
  assert.equal(new Set(classified.map(row => row.eventKey)).size, classified.length);
  const rows = values => [...values].sort((a, b) => a.name < b.name ? -1 : 1);
  const history = census => rows([...census.events, ...census.deliveries, ...Object.values(census.chunks).flat()]);
  const snapshot = (census, deliveries) => {
    const inspected = inspectCensus(census);
    return {observedAtMillis: Date.parse(census.readTime),
      sourceSetDigest: digest(rows(Object.values(census.collections).flat())),
      classifiedEventSetDigest: digest(classified),
      capturedEventSetDigest: digest(inspected.captures.map(({eventKey, coreDigest}) => ({eventKey, coreDigest}))),
      captureRevision: inspected.captureRevision, deliveryHistoryDigest: digest(history(census)), deliveries};
  };
  const first = snapshot(initial, initialDeliveries), last = snapshot(final, finalDeliveries);
  const finalHistory = new Map(history(final).map(row => [row.name, row]));
  for (const row of history(initial)) assert.equal(digest(finalHistory.get(row.name)), digest(row),
    "capture history must remain append-only");
  const acceptedSetDigest = containedDeliveryBusinessDigest(first);
  const evidence = parseContainedDeliveryEvidence({schemaVersion: 1, kind: DEVELOP_CONTAINED_DELIVERY_POLICY,
    initial: first, final: last}, PAIRS.flatMap(pair => pair.slice(0, 2)).map(identity), acceptedSetDigest);
  return {evidence, acceptedSetDigest, legacyUntracked: true, canEnterMaintenance: false, canApply: false};
}
module.exports = {observeDevelopCaptureControls, prepareDevelopContainedDeliveryEvidence};
if (require.main === module) {console.error("Import with explicit read-only provider ports; no apply CLI.");process.exitCode = 1;}
