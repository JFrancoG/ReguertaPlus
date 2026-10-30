"use strict";

// Pure preparation from a reviewed packet and a freshly read emulator clone.
// No credentials, network client or live apply path.
const assert = require("node:assert/strict");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {encodeShiftPlanningFirestoreValue: encode} = require("../lib/shift-planning-publication-contract.js");
const {prepareDevelopMigrationPackage} = require("./prepare-develop-migration-package.cjs");
const {closedPolicy} = require("./develop-closed-migration-policy.cjs");
const migration = require("./rehearse-develop-shift-migration.cjs");
const root = "develop/plus-collections";
const wirePayload = row => encode(Object.fromEntries(Object.entries(row.fields).map(([k,v]) =>
  [k,migration.decodeRESTValue(v)])),"clone comparison",new Set());
const rows = docs => docs.map(row => ({path:row.name.split("/documents/")[1],payload:wirePayload(row)}))
  .sort((a,b) => a.path.localeCompare(b.path));

function materializeDevelopMigrationPreparation({sourceInput,reviewPackage,cloneCapture}) {
  assert.deepEqual(prepareDevelopMigrationPackage(sourceInput),reviewPackage,"review package differs from pinned evidence");
  assert.equal(cloneCapture.projectId,migration.PROJECT_ID); assert.equal(cloneCapture.environment,"develop");
  const expected = {shifts:sourceInput.snapshot.collections.shifts,users:sourceInput.snapshot.collections.users,
    deliveryCalendar:sourceInput.snapshot.collections.deliveryCalendar,notificationEvents:sourceInput.snapshot.collections.notificationEvents,
    config:[sourceInput.snapshot.singletons["config/global"]]};
  assert.deepEqual(Object.keys(cloneCapture.guardCollections).sort(),["config","deliveryCalendar","notificationEvents","users"]);
  for (const [collection, originals] of Object.entries(expected)) {
    const clone = collection === "shifts" ? cloneCapture.documents : cloneCapture.guardCollections[collection];
    assert.ok(clone.every(row => row.name.startsWith(`projects/${migration.PROJECT_ID}/databases/(default)/documents/${root}/${collection}/`)));
    assert.deepEqual(rows(clone),rows(originals),`${collection} clone payload drift`);
  }
  const policyDraft = closedPolicy(reviewPackage.sourcePolicy,reviewPackage.packageDigest);
  const prepared = migration.prepareDevelopShiftMigration({contentProposal:sourceInput.proposal,
    legacyCapture:cloneCapture,policyDraft,runId:`closed-${reviewPackage.packageDigest.slice(-20)}`});
  const {preparedDigest:unused,...body} = prepared; void unused;
  // The existing terminal contract requires operationId = request-${requestId}.
  // Bind this deterministic lowering explicitly; never weaken the inverse parser.
  Object.assign(body,{requestId:reviewPackage.forward.operationId,operationId:`request-${reviewPackage.forward.operationId}`,
    recoveryOperationId:reviewPackage.inverse.operationId,
    operationIdentityMapping:{reviewForward:reviewPackage.forward.operationId,runtimeForward:`request-${reviewPackage.forward.operationId}`,
      reviewInverse:reviewPackage.inverse.operationId,runtimeInverse:reviewPackage.inverse.operationId},
    reviewPackageDigest:reviewPackage.packageDigest,reviewForwardDigest:reviewPackage.forwardDigest,reviewInverseDigest:reviewPackage.inverseDigest});
  return {...body,preparedDigest:digest(body)};
}
module.exports = {materializeDevelopMigrationPreparation};
if (require.main === module) {console.error("local_harness_required_no_apply_cli");process.exitCode=1;}
