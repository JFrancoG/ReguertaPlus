"use strict";

// A closed migration record, deliberately not an annual source-producer policy.
// The ordinary source parser must reject it even if maintenance is opened by mistake.
const assert = require("node:assert/strict");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {SHIFT_PLANNING_FIRESTORE_ADMISSION_REVISION} = require("../lib/shift-planning-firestore-transaction-manifest.js");
const KIND = "closedDevelopInitialMigration";
const WORKBOOK = "1O7VKs7S4wZHVvTfNBehAd5EzF3Mgw2q9LweK68Gm76A";

function closedPolicy(binding, packageDigest, scope = "loopback_emulator_only") {
  assert.ok(["loopback_emulator_only", "controlled_develop_preparation"].includes(scope));
  assert.equal(binding.environment,"develop"); assert.equal(binding.runtimeDocument,null);
  assert.equal(binding.workbook.fileId,WORKBOOK); assert.match(binding.workbook.version,/^[1-9]\d*$/);
  assert.equal(binding.planningEnabled,false); assert.equal(binding.coverageEnabled,false);
  assert.equal(binding.notificationReplayAllowed,false); assert.equal(binding.initialCreditBalance,0);
  assert.deepEqual(binding.retainedReserves,[]);
  for (const key of ["annualContinuity","inheritedPrefix","planningFrontier"]) assert.equal(binding[key],null);
  const document = {schemaVersion:1,environment:"develop",kind:KIND,policyRevision:`closed-${packageDigest.slice(-20)}`,
    reviewPackageDigest:packageDigest,sourcePolicyBindingDigest:digest(binding),planningEnabled:false,
    annualContinuity:null,inheritedPrefix:null,planningFrontier:null,notificationReplayAllowed:false,
    coverage:{enabled:false},creditLedger:{enabled:false,initialBalance:0},retainedReserves:[],
    sync:{transactionMeasurementAuthority:{adapterRevision:SHIFT_PLANNING_FIRESTORE_ADMISSION_REVISION,
      indexConfigurationDigest:binding.indexAuthorityDigest},partitions:Object.fromEntries(["delivery","market"].map(type =>
      [type,{workbookId:WORKBOOK,workbookRevision:binding.workbook.version,partitionKey:type,stateRevision:1,epoch:1,lease:null}]))}};
  const localOnly = {scope,liveExecutable:false,planningReady:false,
    sourcePolicyBinding:binding,reviewPackageDigest:packageDigest,
    indexAuthority:"retained_observation_not_wire_or_index_budget",workbookAuthority:"retained_not_held",
    rotationFrontier:"2025_is_a_closed_rehearsal_sentinel_not_an_admitted_annual_frontier"};
  return {document,localOnly,draftDigest:digest({document,localOnly})};
}
function verifyClosedPolicy(draft) {
  assert.deepEqual(draft,closedPolicy(draft.localOnly.sourcePolicyBinding,draft.localOnly.reviewPackageDigest,draft.localOnly.scope));
}
module.exports = {KIND,closedPolicy,verifyClosedPolicy};
