"use strict";

// The pre-effect plan fixes all authority except hashes that depend on this
// attempt's actual permission receipt and newly collected confirmations. The
// existing journal stores both records; neither is execution-resumable.
const assert=require("node:assert/strict");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {verifyShiftPlanningAdministratorAgreementIntakeBarrierEvidence:verify}=require("../lib/shift-planning-intake-barrier.js");
const {FILE,OWNER,WRITER,PERMISSION,validateMetadata,metadataFingerprint}=require("./develop-original-writer-provider.cjs");
const lateFields=["expectedOwnerAgreementDigest","expectedAdministratorAgreementDigest","expectedControlManifestDigest","expectedHistoricalRiskDigest"];
const permission={fileId:FILE,permissionId:PERMISSION,type:"user",role:"writer",emailAddress:WRITER};
const command=scope=>{const v={...scope};delete v.writerInventoryRevision;delete v.writerInventoryDigest;return v;};
function plannedScope(scope){const v=structuredClone(scope);for(const k of lateFields)v[k]=null;return v;}
function plannedOwner(intent){const v=structuredClone(intent);assert.ok(v.permissionControl);v.permissionControl.sealedActionDigest=null;v.permissionControl.credentialClosureDigest=null;return v;}
function plannedAdmin(intent){return {...structuredClone(intent),ownerAgreementDigest:null};}
function plannedRisk(risk){return {...structuredClone(risk),assessedAtMillis:null};}
function observationInputs(review){return {cloud:review.cloud,classifiedCaptures:review.classifiedCaptures,deliveries:review.deliveries,
  ownerSnapshotDigest:review.owner.snapshotDigest,ownerMetadataDigest:review.owner.metadataDigest};}
function validateInitialEvidencePlan(plan,binding) {
  assert.deepEqual(Object.keys(plan).sort(),["kind","scope","ownerIntent","administratorIntent","historicalRisk","observationInputsDigest",...(plan.collectionReviewDigest===undefined?[]:["collectionReviewDigest"])].sort());
  if(plan.collectionReviewDigest!==undefined)assert.match(plan.collectionReviewDigest,/^shift-planning:v1:sha256:[a-f0-9]{64}$/);
  assert.equal(plan.kind,"develop-post-permission-initial-evidence");
  assert.deepEqual(plan.scope,plannedScope(plan.scope));assert.deepEqual(plan.scope,binding.scope);
  assert.equal(plan.scope.schemaVersion,3);assert.equal(plan.scope.maintenanceMode,"develop-administrator-agreement");
  assert.equal(plan.scope.environment,"develop");assert.equal(plan.scope.expectedWorkbookFileId,FILE);
  assert.deepEqual(plan.ownerIntent,plannedOwner(plan.ownerIntent));assert.deepEqual(plan.administratorIntent,plannedAdmin(plan.administratorIntent));
  assert.deepEqual(plan.historicalRisk,plannedRisk(plan.historicalRisk));
  assert.equal(plan.ownerIntent.workbookFileId,FILE);assert.equal(plan.ownerIntent.permissionControl.principalId,plan.ownerIntent.ownerPrincipalId);
  assert.equal(plan.ownerIntent.permissionControl.actionKind,"acl-protection-only");
  assert.match(plan.observationInputsDigest,/^shift-planning:v1:sha256:[a-f0-9]{64}$/);
  for(const intent of [plan.ownerIntent,plan.administratorIntent]) {
    assert.equal(intent.environment,"develop");assert.ok(intent.startsAtMillis<=binding.window.startsAtMillis);
    assert.ok(intent.endsAtMillis>=binding.window.endsAtMillis);assert.ok(intent.recoveryDeadlineMillis>=intent.endsAtMillis);
  }
}
function verifyPermissionReceipt({receipt,binding,receiptId,transition,nativeReviewDigest,nowMillis}) {
  assert.equal(receipt.kind,"develop-owned-native-grant");assert.equal(receipt.receiptId,receiptId);
  assert.equal(receipt.bindingDigest,digest(binding));assert.equal(receipt.transitionDigest,digest(transition));
  const native=receipt.native,closure=native.closure,{closure:ignored,...action}=native;void ignored;
  assert.equal(native.phase,"native-grant-verified");assert.equal(native.reviewDigest,nativeReviewDigest);
  assert.deepEqual(native.permission,permission);
  assert.equal(native.beforeDigest,digest(transition.before.after));assert.equal(native.afterDigest,digest(transition.after.after));
  assert.ok(Number.isSafeInteger(native.startedAtMillis)&&Number.isSafeInteger(native.finishedAtMillis));
  assert.ok(native.startedAtMillis>=binding.window.startsAtMillis&&native.finishedAtMillis>=native.startedAtMillis&&native.finishedAtMillis<=nowMillis);
  assert.deepEqual(closure,{kind:"native-owner-grant-workflow-closed",owner:OWNER,actionDigest:digest(action),
    closedAtMillis:native.finishedAtMillis,temporaryWriteCredentials:"not-created",grantCapability:"consumed"});
  validateMetadata(transition.before.after,false);validateMetadata(transition.after.after,true);
  assert.deepEqual(transition.before.snapshot,transition.after.snapshot);
  assert.equal(metadataFingerprint(transition.before.after,{omitWriter:true,omitVersion:true}),metadataFingerprint(transition.after.after,{omitWriter:true,omitVersion:true}));
}
function sealInitialEvidence({binding,receiptId,permissionReceipt,transition,nativeReviewDigest,scope,review,nowMillis}) {
  const plan=binding.initialEvidencePlan;validateInitialEvidencePlan(plan,binding);
  verifyPermissionReceipt({receipt:permissionReceipt,binding,receiptId,transition,nativeReviewDigest,nowMillis});
  assert.deepEqual(plannedScope(scope),plan.scope);
  assert.equal(digest(observationInputs(review)),plan.observationInputsDigest,"Unreviewed observation inputs");
  assert.equal(review.scopeDigest,digest(scope));
  assert.equal(review.owner.snapshotDigest,transition.before.snapshotDigest);assert.equal(review.owner.metadataDigest,transition.before.metadataDigest);
  const p=review.evidence.payload,owner=p.ownerAgreement,admin=p.administratorAgreement;
  assert.deepEqual(plannedRisk(p.causalDrain.historicalRisk),plan.historicalRisk);
  assert.deepEqual(plannedOwner(owner.payload.intent),plan.ownerIntent);
  assert.deepEqual(plannedAdmin(admin.payload.intent),plan.administratorIntent);
  const control=owner.payload.intent.permissionControl;
  assert.equal(control.sealedActionDigest,digest(permissionReceipt));assert.equal(control.credentialClosureDigest,digest(permissionReceipt.native.closure));
  assert.equal(p.ownerObservation.permissionControlEvidenceDigest,digest(control));
  const closed=permissionReceipt.native.finishedAtMillis;
  // These come from the explicit human-report port. No copying or re-signing of
  // old confirmations is performed by the sealer.
  for(const agreement of [owner,admin])for(const confirmation of agreement.payload.confirmations) {
    assert.ok(confirmation.confirmedAtMillis>=closed&&confirmation.confirmedAtMillis<=nowMillis,"Confirmation must follow this grant closure");
  }
  for(const observation of [p.ownerObservation,p.administratorObservation])assert.ok(observation.observedAtMillis>=closed&&observation.observedAtMillis<=nowMillis);
  assert.ok(p.verifiedAtMillis>=closed&&p.verifiedAtMillis<=nowMillis);
  assert.ok(p.causalDrain.capturedAtMillis>=closed&&p.quietHorizon.startedAtMillis>=closed);
  verify(review.evidence,command(scope),nowMillis);
  const body={kind:"develop-initial-evidence-seal",bindingDigest:digest(binding),receiptId,nativeReviewDigest,
    permissionReceipt,transition,scope,review,reviewDigest:digest(review),sealedAtMillis:nowMillis};
  return structuredClone({...body,sealDigest:digest(body)});
}
function verifyInitialEvidenceSeal(seal,binding,receiptId,nativeReviewDigest,atMillis=seal.sealedAtMillis) {
  const {sealDigest,...body}=seal;assert.equal(sealDigest,digest(body));
  assert.equal(body.kind,"develop-initial-evidence-seal");assert.equal(body.bindingDigest,digest(binding));
  assert.equal(body.receiptId,receiptId);assert.equal(body.nativeReviewDigest,nativeReviewDigest);
  assert.deepEqual(seal,sealInitialEvidence({binding,receiptId,nativeReviewDigest,permissionReceipt:body.permissionReceipt,
    transition:body.transition,scope:body.scope,review:body.review,nowMillis:body.sealedAtMillis}));
  verify(body.review.evidence,command(body.scope),atMillis);
  return structuredClone(seal);
}
module.exports={validateInitialEvidencePlan,verifyPermissionReceipt,sealInitialEvidence,verifyInitialEvidenceSeal,plannedScope,plannedOwner,plannedAdmin,plannedRisk,observationInputs};
