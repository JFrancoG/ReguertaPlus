"use strict";
const {test}=require('node:test'),assert=require('node:assert/strict');
// This joint suite includes the collector cases exactly once.
const {fixture}=require('./develop-initial-review-collector.test.cjs');
const {createDevelopHumanInputs}=require('../scripts/develop-window-human-inputs.cjs');
const {createShiftPlanningDigest:digest}=require('../lib/shift-planning-digest.js');
async function setup(fault=null){
 const f=await fixture(),requests=[],records=[];
 f.args.reviewed.payload.workbook.pendingOfflineEditorCount=null;f.args.reviewDigest=digest(f.args.reviewed);
 f.context.binding.initialEvidencePlan.collectionReviewDigest=f.args.reviewDigest;f.context.permissionReceipt.bindingDigest=digest(f.context.binding);
 const human=createDevelopHumanInputs({receiptId:f.context.receiptId,nowMillis:()=>f.g.state.now,deadlineMillis:()=>f.context.binding.window.endsAtMillis-450000,
 assertActive:f.context.assertActive,record:async r=>records.push(structuredClone(r)),exchange:async request=>{
 requests.push(structuredClone(request));f.g.state.now+=100;
 const reply={...structuredClone(request.responseTemplate),requestDigest:request.requestDigest,responseId:`reply-${requests.length}`,respondedAtMillis:f.g.state.now};
 if(reply.confirmations)for(const c of reply.confirmations){c.confirmationId=`confirm-${requests.length}-${c.role??c.principalId}`;c.confirmedAtMillis=f.g.state.now;
 for(const k of request.kind==='owner'?['onlineClosedNoOfflineEdits','noManualOrAutomationWrites']:['noUnreviewedDataRulesDeployIamOrScriptWrites','noAutomationViaHumanCredentials'])c[k]=true;}
 if(reply.reports)for(const [key,v]of Object.entries(reply.reports)){v.agreementStatus='confirmed';v.unresolvedWriteCount=0;v.observedAtMillis=f.g.state.now;
 if(key==='ownerObservation'){v.permissionWorkflowClosed=true;v.ownerActivity='none-reported';}else{v.administratorActivity='none-reported';v.reportRevision=`report-${requests.length}`;}}
 if(fault==='blank')return request.responseTemplate;
 if(fault==='other-challenge')reply.requestDigest=digest('other');
 if(fault==='future')reply.respondedAtMillis=f.g.state.now+1;
 if(fault==='old')reply.respondedAtMillis=request.notBeforeMillis-1;
 if(fault==='negative'&&reply.confirmations)reply.confirmations[0].noManualOrAutomationWrites=false;
 if(fault==='missing-participant'&&reply.confirmations)reply.confirmations.pop();
 if(fault==='reused-reply')reply.responseId='same-reply';
 if(fault==='mutated-intent'&&request.binding.intent)request.binding.intent.agreementId='changed';
 if(fault==='activity'&&reply.reports)reply.reports.ownerObservation.ownerActivity='reported';
 if(fault==='withdrawn'&&reply.reports)reply.reports.administratorObservation.agreementStatus='withdrawn';
 if(fault==='cancelled')f.state.aborted=true;
 return reply;
 }});
 Object.assign(f.args,{collectConfirmations:human.collectConfirmations,readHumanReports:human.readInitialHumanReports});return {f,human,requests,records};
}
test('explicit replies complete collector and a later report requires a new challenge',async()=>{
 const {f,human,requests,records}=await setup(),result=await f.make()(f.context);
 assert.equal(result.review.evidence.payload.workbook.pendingOfflineEditorCount,0);assert.deepEqual(requests.map(r=>r.kind),['owner','administrator','reports']);
 assert.ok(requests[0].responseTemplate.confirmations.every(c=>c.confirmedAtMillis===null&&c.onlineClosedNoOfflineEdits===null));
 assert.equal(requests[2].responseTemplate.reports.ownerObservation.ownerActivity,null);
 const before=f.g.state.now,report=await human.readHumanReports(result.scope);assert.ok(report.ownerObservation.observedAtMillis>before);assert.equal(requests.length,4);assert.equal(records.length,8);
 human.close();await assert.rejects(human.readHumanReports(result.scope));
});
for(const fault of ['blank','other-challenge','future','old','negative','missing-participant','reused-reply','activity','withdrawn','cancelled'])
test(`human ${fault} cannot seal or mint`,async()=>{
 const {f,records}=await setup(fault);await assert.rejects(f.make()(f.context));assert.equal(f.g.state.mints,0);assert.equal(f.state.records.at(-1).result,'rejected');assert.ok(records.some(r=>r.phase==='human-input-reply'));
});
test('transport receives detached intents and cannot obtain reports before agreements',async()=>{
 const {f,human}=await setup('mutated-intent');await assert.rejects(human.readHumanReports({}));const result=await f.make()(f.context);assert.notEqual(result.review.evidence.payload.ownerAgreement.payload.intent.agreementId,'changed');
});
