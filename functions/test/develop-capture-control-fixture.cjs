"use strict";
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {createShiftPlanningControlManifestDigest: manifest} = require("../lib/shift-planning-intake-barrier.js");
const {DEVELOP_CAPTURE_ROUTES: routes, DEVELOP_CAPTURE_CONTROL_REVISION: revision} =
  require("../lib/shift-planning-develop-capture-control.js");
const captureProof = (writerId, projectId = "demo-reguerta-hu084-migration") => {
  const route = routes.find(row => row[0] === writerId);
  const source = (index) => ({functionName: `projects/${projectId}/locations/europe-west1/functions/${route[index + 1]}`,
    runtimeRevision: `fixture-${index}-revision`, sourceGeneration: "12345",
    sourceDigest: digest({source: route[index + 1]}), reviewedSourceDigest: digest({source: route[index + 1]}),
    configurationDigest: digest({configuration: route[index + 1]}), reviewedConfigurationDigest: digest({configuration: route[index + 1]}),
    documentPattern: `${index ? "develop" : "{env}"}/plus-collections/${route[3]}`,
    retryPolicy: index ? "RETRY_POLICY_RETRY" : "RETRY_POLICY_DO_NOT_RETRY", transportState: "ACTIVE"});
  return {schemaVersion: 1, kind: "develop-source-capture", projectId, databaseId: "(default)", environment: "develop",
    writerId, shared: source(0), collector: source(1)};
};
const applyCapture = (payload, projectId) => {
  for (const control of payload.writerControls) {
    if (!routes.some(route => route[0] === control.writerId)) continue;
    control.developCapture = captureProof(control.writerId, projectId); control.state = "capture-only";
    control.controlRevision = control.initialReadBackRevision = control.finalReadBackRevision = revision;
    control.controlDigest = control.initialReadBackDigest = control.finalReadBackDigest = digest(control.developCapture);
  }
  return payload;
};
const bindScope = (scope, payload, mode) => ({...scope, expectedControlManifestDigest: manifest(payload.writerControls, mode),
  expectedCausalSetRevision: payload.causalDrain.acceptedSetRevision, expectedCausalSetDigest: payload.causalDrain.acceptedSetDigest});
module.exports = {applyCapture, bindScope, captureProof};

// Synthetic observations only; live data must use the validated census projector.
const applyContained = payload => {
  const {DEVELOP_CONTAINED_DELIVERY_POLICY: policy, containedDeliveryBusinessDigest, containedDeliveryCount} =
    require("../lib/shift-planning-contained-delivery.js");
  const controls = payload.writerControls.filter(control => control.developCapture);
  for (const control of controls) control.deliveryPolicy = policy;
  const names = controls.flatMap(control => [control.developCapture.shared.functionName,
    control.developCapture.collector.functionName]).sort();
  const source = {sourceSetDigest: digest({sourceVersions: ["example-1"]}),
    classifiedEventSetDigest: digest({reviewedCores: ["example-a"]}),
    capturedEventSetDigest: digest({reviewedCores: ["example-a"]})};
  const snapshot = (observedAtMillis, captureRevision, pendingCount) => ({...source,
    observedAtMillis, captureRevision, deliveryHistoryDigest: digest({deliveries: captureRevision}),
    deliveries: names.map((functionName, index) => ({functionName, pendingCount: index ? 0 : pendingCount, inFlightCount: 0}))});
  const initial = snapshot(payload.causalDrain.initialQueueReadBackAtMillis, 1, null);
  const final = snapshot(payload.causalDrain.finalQueueReadBackAtMillis, 2, 1);
  payload.causalDrain.containedDelivery = {schemaVersion: 1, kind: policy, initial, final};
  payload.causalDrain.acceptedSetDigest = containedDeliveryBusinessDigest(initial);
  for (const stage of ["initial", "final"]) {
    payload.causalDrain[`${stage}PendingDeliveryCount`] = containedDeliveryCount(payload.causalDrain.containedDelivery[stage], "pendingCount");
    payload.causalDrain[`${stage}InFlightDeliveryCount`] = containedDeliveryCount(payload.causalDrain.containedDelivery[stage], "inFlightCount");
  }
  return payload;
};
module.exports.applyContained = applyContained;
