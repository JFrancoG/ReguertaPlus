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
const bindScope = (scope, payload, mode) => ({...scope, expectedControlManifestDigest: manifest(payload.writerControls, mode)});
module.exports = {applyCapture, bindScope, captureProof};
