"use strict";

// One post-permission collection. Only explicit read credentials/ports; no
// client discovery, grants, token issuance, maintenance mutation or apply CLI.
const assert=require("node:assert/strict");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {createShiftPlanningOwnerMaintenanceAgreement:ownerAgreement}=require("../lib/shift-planning-owner-maintenance.js");
const {parseShiftPlanningAdministratorMaintenanceAgreement:adminAgreement}=require("../lib/shift-planning-administrator-maintenance.js");
const {createShiftPlanningControlManifestDigest:manifest}=require("../lib/shift-planning-intake-barrier.js");
const {SHIFT_PLANNING_OWNER_AGREEMENT_OWNER_WRITER_ID:OWNER,SHIFT_PLANNING_ADMINISTRATOR_AGREEMENT_WRITER_ID:ADMIN}=require("../lib/shift-planning-writer-inventory.js");
const {createDevelopCloudReader}=require("./develop-google-observations.cjs");
const {createDevelopCensusReader}=require("./develop-live-census-reader.cjs");
const {prepareDevelopContainedDeliveryEvidence:contained}=require("./observe-develop-capture-controls.cjs");
const {validateInitialEvidencePlan,observationInputs,verifyPermissionReceipt,sealInitialEvidence}=require("./develop-initial-evidence-seal.cjs");
const {LIMITS}=require("./develop-copy-time-budget.cjs");
const POST_COLLECTION_RESERVE=30000;
function validateInitialCollectionReview(input,reviewDigest) {
  const reviewed=structuredClone(input);assert.equal(digest(reviewed),reviewDigest,"Unreviewed initial collection template");
  assert.equal(reviewed.kind,"develop-initial-review-template");
  const template=reviewed.payload;
  assert.equal(template.schemaVersion,3);assert.equal(template.environment,"develop");
  for(const key of ["ownerAgreement","administratorAgreement","ownerObservation","administratorObservation","quietHorizon","verifiedAtMillis"])assert.equal(template[key],null);
  assert.ok(Number.isSafeInteger(template.rules.closedAtMillis)&&template.rules.closedAtMillis>=0,"Reviewed Rules closure is missing");
  for(const key of ["initialReadBackAtMillis","finalReadBackAtMillis"])assert.equal(template.rules[key],null);
  for(const c of template.writerControls) {
    assert.equal(c.initialReadBackAtMillis,null);assert.equal(c.finalReadBackAtMillis,null);
    if([OWNER,ADMIN].includes(c.writerId)){assert.equal(c.closedAtMillis,null);assert.equal(c.controlDigest,null);}
    else assert.ok(Number.isSafeInteger(c.closedAtMillis)&&c.closedAtMillis>=0,"Reviewed technical closure is missing");
  }
  assert.ok(reviewed.deliveries.every(d=>d.pendingCount===null&&d.inFlightCount===null));
  return reviewed;
}
function createInitialReviewCollector({reviewed:input,reviewDigest,iamBearer,readSource,collectConfirmations,readHumanReports,
  sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}) {
  const reviewed=validateInitialCollectionReview(input,reviewDigest),template=reviewed.payload;
  for(const port of [readSource,collectConfirmations,readHumanReports,sleep])assert.equal(typeof port,"function");
  let consumed=false;
  return async function collect(context) {
    assert.equal(consumed,false,"Initial collection already consumed");consumed=true;
    const {binding,receiptId,permissionReceipt,transition,nativeReviewDigest,fetchImpl,nowMillis,assertActive,captureOwner,assertWriterAuthority,record}=context;
    const plan=binding.initialEvidencePlan;validateInitialEvidencePlan(plan,binding);
    assert.equal(plan.collectionReviewDigest,reviewDigest);assert.equal(plan.observationInputsDigest,digest(observationInputs(reviewed)));
    assert.equal(manifest(template.writerControls.filter(c=>![OWNER,ADMIN].includes(c.writerId)),template.maintenanceMode),plan.scope.expectedTechnicalControlManifestDigest);
    assert.deepEqual(template.policy,{minimumQuietHorizonMillis:plan.scope.minimumQuietHorizonMillis,maximumEvidenceAgeMillis:plan.scope.maximumEvidenceAgeMillis});
    assert.equal(template.rules.deployedDigest,plan.scope.expectedRulesDigest);assert.equal(template.rules.deployedRevision,plan.scope.expectedRulesRevision);
    assert.equal(template.workbook.fileId,plan.scope.expectedWorkbookFileId);assert.equal(template.workbook.revision,plan.scope.expectedWorkbookRevision);assert.equal(template.workbook.digest,plan.scope.expectedWorkbookDigest);
    verifyPermissionReceipt({receipt:permissionReceipt,binding,receiptId,transition,nativeReviewDigest,nowMillis:nowMillis()});
    const deadlineMillis=binding.window.endsAtMillis-LIMITS.work-LIMITS.fileCleanup-LIMITS.iamCleanup-LIMITS.oauthCleanup-POST_COLLECTION_RESERVE;
    const startedAtMillis=nowMillis(),stages=[],pending=new Set();let result=null;
    const current=()=>{assertActive();assert.ok(nowMillis()<deadlineMillis,"initial_collection_headroom_exhausted");};
    const boundedFetch=async(url,options={})=>{
      current();const timeout=AbortSignal.timeout(Math.max(1,deadlineMillis-nowMillis()));
      const action=Promise.resolve().then(()=>fetchImpl(url,{...options,signal:options.signal?AbortSignal.any([options.signal,timeout]):timeout}));pending.add(action);
      try{return await action;}finally{pending.delete(action);}
    };
    const cloud=createDevelopCloudReader({bearer:iamBearer,reviewed:reviewed.cloud,fetchImpl:boundedFetch,nowMillis});
    const census=createDevelopCensusReader({bearer:iamBearer});
    async function stage(name,reads) {
      current();const start=nowMillis();
      const all=await Promise.allSettled(reads.map(fn=>Promise.resolve().then(fn)));
      await Promise.allSettled([...pending]);
      stages.push({name,startedAtMillis:start,finishedAtMillis:nowMillis(),settled:true,succeeded:all.every(r=>r.status==="fulfilled")});
      current();if(all.some(r=>r.status==="rejected"))throw Error(`initial_collection_${name}_failed`);
      return all.map(r=>r.value);
    }
    const fresh=(value,start)=>{assert.ok(value.startedAtMillis>=start&&value.observedAtMillis>=value.startedAtMillis&&value.observedAtMillis<=nowMillis(),"Initial read timestamp is stale or future");};
    const source=async()=>{
      current();const start=nowMillis(),value=await readSource({direction:binding.direction,nowMillis,assertActive:current});current();fresh(value,start);
      assert.equal(value.source.sourceDigest,plan.scope.expectedAuthoritativeDigest);
      for(const [actual,expected]of [["stateRevision","expectedStateRevision"],["writeEpoch","expectedWriteEpoch"],["activeRevision","expectedActiveRevision"],["activeDigest","expectedActiveDigest"]])assert.equal(value.source.maintenance[actual],plan.scope[expected]);
      return value;
    };
    const sheets=async()=>{current();const start=nowMillis(),v=await captureOwner();current();fresh(v,start);
      assert.equal(v.metadataDigest,transition.after.metadataDigest);assert.equal(v.snapshotDigest,transition.after.snapshotDigest);return v;};
    const controls=async()=>{current();const start=nowMillis(),v=await cloud.read();current();fresh(v,start);return v;};
    const routeCensus=async()=>{current();const start=nowMillis(),v=await census({fetchImpl:boundedFetch,nowMillis});current();assert.ok(Date.parse(v.readTime)>=start&&Date.parse(v.readTime)<=nowMillis());return v;};
    try {
      current();await record({phase:"initial-review-collection-intent",receiptId,reviewDigest,startedAtMillis,deadlineMillis,postCollectionReserveMillis:POST_COLLECTION_RESERVE});
      const oi=structuredClone(plan.ownerIntent);oi.permissionControl.sealedActionDigest=digest(permissionReceipt);oi.permissionControl.credentialClosureDigest=digest(permissionReceipt.native.closure);
      const confirmation=async(kind,intent)=>{
        const start=nowMillis(),values=await collectConfirmations({kind,intent:structuredClone(intent),intentDigest:digest(intent),notBeforeMillis:start,deadlineMillis,assertActive:current});
        current();assert.ok(values.every(v=>v.confirmedAtMillis>=start&&v.confirmedAtMillis<=nowMillis()),"Confirmation was not collected for this challenge");return values;
      };
      const [ownerConfirmations]=await stage("owner-confirmation",[()=>confirmation("owner",oi)]);
      const oa=ownerAgreement(oi,ownerConfirmations),ai={...structuredClone(plan.administratorIntent),ownerAgreementDigest:oa.digest};
      const [adminConfirmations]=await stage("administrator-confirmation",[()=>confirmation("administrator",ai)]);
      const ap={schemaVersion:1,kind:"cooperative-develop-administrator-maintenance",intent:ai,confirmations:adminConfirmations},aa=adminAgreement({payload:ap,digest:digest(ap)});
      const [initialCloud]=await stage("initial-controls",[controls,assertWriterAuthority]);
      const initialControlsAt=nowMillis();
      const [initialCensus,initialSource]=await stage("initial-sources",[routeCensus,source]);
      const [initialSheets]=await stage("initial-workbook",[sheets]);
      const quietStart=nowMillis(),quietEnd=quietStart+plan.scope.minimumQuietHorizonMillis;
      assert.ok(quietEnd<deadlineMillis,"Quiet interval cannot fit collection deadline");
      await stage("quiet-interval",[async()=>{while(nowMillis()<quietEnd){current();const before=nowMillis();await sleep(Math.min(1000,quietEnd-before));assert.ok(nowMillis()>before,"Quiet wait did not advance the clock");}}]);
      const endedAtMillis=nowMillis(),finalStart=nowMillis();
      const [finalCloud,finalCensus,finalSource,finalSheets,,reports]=await stage("final-observations",[controls,routeCensus,source,sheets,assertWriterAuthority,
        ()=>readHumanReports({scope:structuredClone(plan.scope),ownerAgreement:oa,administratorAgreement:aa,notBeforeMillis:finalStart,deadlineMillis,assertActive:current})]);
      assert.deepEqual(initialSource.source,finalSource.source,"Source mutation during quiet interval");
      const causal=contained({initial:initialCensus,final:finalCensus,classifiedCaptures:reviewed.classifiedCaptures,initialDeliveries:reviewed.deliveries,finalDeliveries:reviewed.deliveries});
      assert.equal(causal.acceptedSetDigest,plan.scope.expectedCausalSetDigest);
      for(const v of [reports.ownerObservation,reports.administratorObservation])assert.ok(v.observedAtMillis>=finalStart&&v.observedAtMillis<=nowMillis(),"Final human report is stale or future");
      const p=structuredClone(template),initialAt=Date.parse(initialCensus.readTime),finalAt=Date.parse(finalCensus.readTime);
      p.ownerAgreement=oa;p.administratorAgreement=aa;p.ownerObservation=reports.ownerObservation;p.administratorObservation=reports.administratorObservation;
      // The prepared template cannot claim the future human offline-edit state.
      // The agreement parser has now validated every explicit closed/online confirmation.
      if(p.workbook.pendingOfflineEditorCount===null)p.workbook.pendingOfflineEditorCount=0;
      p.rules.initialReadBackAtMillis=initialCloud.observedAtMillis;p.rules.finalReadBackAtMillis=finalCloud.observedAtMillis;
      for(const c of p.writerControls) {
        c.initialReadBackAtMillis=initialControlsAt;
        c.finalReadBackAtMillis=Math.min(finalStart,finalCloud.observedAtMillis,finalAt,finalSheets.observedAtMillis,reports.ownerObservation.observedAtMillis,reports.administratorObservation.observedAtMillis);
        if([OWNER,ADMIN].includes(c.writerId)){
          const agreement=c.writerId===OWNER?oa:aa;c.closedAtMillis=Math.max(...agreement.payload.confirmations.map(v=>v.confirmedAtMillis));
          c.controlDigest=c.initialReadBackDigest=c.finalReadBackDigest=agreement.digest;
        }
      }
      Object.assign(p.causalDrain,{capturedAtMillis:initialAt,initialQueueReadBackAtMillis:initialAt,finalQueueReadBackAtMillis:finalAt,
        containedDelivery:causal.evidence,historicalRisk:{...structuredClone(plan.historicalRisk),assessedAtMillis:initialAt}});
      p.workbook.capturedAtMillis=initialSheets.observedAtMillis;p.workbook.readBackAtMillis=finalSheets.observedAtMillis;
      p.quietHorizon={startedAtMillis:quietStart,endedAtMillis,firestoreMutationCount:0,workbookMutationCount:0,deliveryMutationCount:0};
      p.verifiedAtMillis=nowMillis();
      const scope={...plan.scope,expectedOwnerAgreementDigest:oa.digest,expectedAdministratorAgreementDigest:aa.digest,
        expectedControlManifestDigest:manifest(p.writerControls,p.maintenanceMode),expectedHistoricalRiskDigest:digest(p.causalDrain.historicalRisk)};
      const review={scopeDigest:digest(scope),evidence:{payload:p,digest:digest(p)},cloud:reviewed.cloud,owner:reviewed.owner,census:initialCensus,
        classifiedCaptures:reviewed.classifiedCaptures,deliveries:reviewed.deliveries};
      sealInitialEvidence({binding,receiptId,permissionReceipt,transition,nativeReviewDigest,scope,review,nowMillis:nowMillis()});current();
      await record({phase:"initial-review-collection-observations",receiptId,initialCloud,finalCloud,initialSource,finalSource,initialSheets,finalSheets,initialCensus,finalCensus,reports});
      current();result={scope,review};return result;
    } finally {
      await Promise.allSettled([...pending]);cloud.close();census.close();iamBearer=null;
      await record({phase:"initial-review-collection-finished",receiptId,startedAtMillis,finishedAtMillis:nowMillis(),deadlineMillis,
        postCollectionReserveMillis:POST_COLLECTION_RESERVE,stages,result:result?"verified":"rejected",providerCallsSettled:true});
    }
  };
}
module.exports={createInitialReviewCollector,validateInitialCollectionReview,POST_COLLECTION_RESERVE};
if(require.main===module){console.error("explicit_reviewed_initial_collection_required_no_cli");process.exitCode=1;}
