"use strict";
const assert=require("node:assert/strict");
const {test}=require("node:test");
const {fixture}=require("./develop-migration-package-fixture.cjs");
const {prepareDevelopMigrationPackage}=require("../scripts/prepare-develop-migration-package.cjs");
const {materializeDevelopMigrationPreparation:prepare}=require("../scripts/materialize-develop-migration-package.cjs");
const {verifyClosedPolicy}=require("../scripts/develop-closed-migration-policy.cjs");
const migration=require("../scripts/rehearse-develop-shift-migration.cjs");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
function input(){
  const sourceInput=fixture(),reviewPackage=prepareDevelopMigrationPackage(sourceInput);
  const clone=docs=>structuredClone(docs).map(row=>({...row,name:row.name.replace("reguerta-9f27f",migration.PROJECT_ID),
    createTime:"2026-10-30T11:00:00.000001Z",updateTime:"2026-10-30T11:00:00.000001Z"}));
  return {sourceInput,reviewPackage,cloneCapture:{projectId:migration.PROJECT_ID,environment:"develop",
    documents:clone(sourceInput.snapshot.collections.shifts),guardCollections:{
      ...Object.fromEntries(["users","deliveryCalendar","notificationEvents"].map(key=>[key,clone(sourceInput.snapshot.collections[key])])),
      config:clone([sourceInput.snapshot.singletons["config/global"]])}}};
}
test("closed preparation binds reviewed intent and fresh clone versions without annual placeholders",()=>{
  const args=input(),result=prepare(args),policy=result.policyDraft.document;
  verifyClosedPolicy(result.policyDraft);assert.equal(policy.planningEnabled,false);assert.equal(policy.annualContinuity,null);
  assert.equal(policy.inheritedPrefix,null);assert.equal(policy.planningFrontier,null);
  assert.equal(policy.sync.partitions.delivery.workbookRevision,"278");assert.equal(policy.creditLedger.enabled,false);
  assert.equal(result.reviewPackageDigest,args.reviewPackage.packageDigest);
  assert.equal(result.operationId,`request-${result.requestId}`);
  assert.equal(result.operationIdentityMapping.reviewForward,args.reviewPackage.forward.operationId);
  assert.notEqual(result.legacy[0].updateTime.nanoseconds,123456789);
  assert.deepEqual(result.content,args.sourceInput.proposal.content);
  assert.deepEqual(result,prepare(args));
});
for(const [name,change]of Object.entries({
  "different retained review":a=>{a.reviewPackage.forward.operationId="other";},
  "shared-project capture":a=>{a.cloneCapture.projectId="reguerta-9f27f";},
  "production document":a=>{a.cloneCapture.documents[0].name=a.cloneCapture.documents[0].name.replace("/develop/","/production/");},
  "rounded raw timestamp":a=>{a.cloneCapture.documents[0].fields.opaqueLegacyField.mapValue.fields.precise.timestampValue="2025-01-01T00:00:00.123456000Z";},
  "changed notice":a=>{a.cloneCapture.guardCollections.notificationEvents[0].fields.extra={booleanValue:true};},
  "missing config":a=>{a.cloneCapture.guardCollections.config=[];},
  "missing guard collection":a=>{delete a.cloneCapture.guardCollections.notificationEvents;},
}))test(`closed preparation rejects ${name}`,()=>{const args=input();change(args);assert.throws(()=>prepare(args));});
test("a rehashed policy cannot enable planning, replace its workbook or claim a new rotation",()=>{
  for(const mutate of [p=>{p.document.planningEnabled=true;},p=>{p.document.sync.partitions.delivery.workbookId="other";},
    p=>{p.document.annualContinuity={kind:"newRotation"};}]){
    const policy=prepare(input()).policyDraft;mutate(policy);policy.draftDigest=digest({document:policy.document,localOnly:policy.localOnly});
    assert.throws(()=>verifyClosedPolicy(policy));
  }
});
