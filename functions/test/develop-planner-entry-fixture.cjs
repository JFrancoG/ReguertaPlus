"use strict";
const {PAIRS, PATHS} = require("../scripts/prepare-develop-planner-entry.cjs");
const {contentProposal} = require("./develop-shift-migration-fixture.cjs");
const {fixture, doc} = require("./develop-legacy-census-fixture.cjs");
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
module.exports = {input};
