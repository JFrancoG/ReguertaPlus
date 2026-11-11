"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
function retainTiming(name,f){if(!process.env.HU084_INITIAL_COLLECTION_OUTPUT)return;const root=process.env.HU084_INITIAL_COLLECTION_OUTPUT;assert.ok(path.isAbsolute(root));fs.mkdirSync(root,{recursive:true,mode:0o700});
  fs.writeFileSync(path.join(root,name+".json"),JSON.stringify({kind:"synthetic-initial-collection-timing",liveLatencyVerified:false,window:f.context.binding.window,records:f.state.records.filter(v=>v.phase!=="initial-review-collection-observations")},null,2),{mode:0o600,flag:"wx"});}
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {createInitialReviewCollector}=require("../scripts/develop-initial-review-collector.cjs");
const {sealInitialEvidence}=require("../scripts/develop-initial-evidence-seal.cjs");
const {createCopyTimeBudget,createOriginalDevelopTimeBudget,ORIGINAL_DEVELOP_MODE}=require("../scripts/develop-copy-time-budget.cjs");
const {bindWindow}=require("../scripts/develop-controlled-window.cjs");
const {originalWindowFixture}=require("./develop-original-window-fixture.cjs");
const {sealFixture}=require("./develop-initial-evidence-seal-fixture.cjs");
const {createOriginalWindowOwner}=require("../scripts/develop-original-window-provider.cjs");
const {OWNER,FILE,WRITER,PERMISSION}=require("../scripts/develop-original-writer-provider.cjs");
const censusFixture=require("./develop-legacy-census-fixture.cjs");
async function fixture({confirmationDelay=10000,sourceDelay=3000,sheetsDelay=2000,grantDelay=10000,fault=null,interactive=false}={}) {
  const g=originalWindowFixture();g.state.now=Date.parse(censusFixture.fixture().readTime);
  const owner=createOriginalWindowOwner({ownerBearer:"fixture-owner-collector",fetchImpl:g.fetchImpl,nowMillis:()=>g.state.now,sleep:async()=>{}});
  const before=await owner.capture(false),data=g.args();
  if(interactive){data.window.endsAtMillis=data.window.startsAtMillis+1200000;data.executionMode=ORIGINAL_DEVELOP_MODE;}
  const f=sealFixture({scopeOverrides:{transitionId:data.prepared.operationId},before,window:data.window,nowMillis:()=>g.state.now,advance:ms=>{g.state.now+=ms;}});
  const reviewed={kind:"develop-initial-review-template",cloud:f.review.cloud,owner:before,classifiedCaptures:f.review.classifiedCaptures,deliveries:f.review.deliveries,payload:structuredClone(f.review.evidence.payload)};
  const p=reviewed.payload;
  for(const k of ["ownerAgreement","administratorAgreement","ownerObservation","administratorObservation","quietHorizon","verifiedAtMillis"])p[k]=null;
  for(const k of ["initialReadBackAtMillis","finalReadBackAtMillis"])p.rules[k]=null;
  for(const c of p.writerControls){c.initialReadBackAtMillis=c.finalReadBackAtMillis=null;if(c.state==="agreement-recorded")c.closedAtMillis=c.controlDigest=c.initialReadBackDigest=c.finalReadBackDigest=null;}
  const reviewDigest=digest(reviewed),plan={...f.initialEvidencePlan,collectionReviewDigest:reviewDigest};data.scope=plan.scope;data.initialEvidencePlan=plan;
  const binding=bindWindow(data),receiptId="collector-window",permission={fileId:FILE,permissionId:PERMISSION,type:"user",role:"writer",emailAddress:WRITER};
  const startedAtMillis=g.state.now;g.state.now+=grantDelay;await g.ownerChannel.grant(permission);const after=await owner.capture(true),transition={before,after};
  const native={phase:"native-grant-verified",permission,reviewDigest:g.ownerChannel.reviewDigest,startedAtMillis,finishedAtMillis:g.state.now,beforeDigest:digest(before.after),afterDigest:digest(after.after)};
  native.closure={kind:"native-owner-grant-workflow-closed",owner:OWNER,actionDigest:digest(native),closedAtMillis:native.finishedAtMillis,temporaryWriteCredentials:"not-created",grantCapability:"consumed"};
  const receipt={kind:"develop-owned-native-grant",receiptId,bindingDigest:digest(binding),transitionDigest:digest(transition),native};
  const state={records:[],http:[],sources:0,captures:0,human:[],livePending:0,aborted:false,authority:0};
  const fetchImpl=async(url,options)=>{
    state.http.push({url,method:options.method});assert.ok(options.signal);g.state.now+=5;
    const c=f.review.cloud,all=[...c.functions,...c.jobs],u=new URL(url);let value;
    if(u.hostname==="firestore.googleapis.com"){
      const census=censusFixture.fixture(),name=u.pathname.slice(4);
      value=name.endsWith("/current")?census.intakeBefore:{documents:name.endsWith("/events")?census.events:name.endsWith("/deliveries")?census.deliveries:name.endsWith("/chunks")?Object.values(census.chunks)[0]:census.collections[name.split("/").at(-1)]};
      if(fault==="census"&&state.sources>0&&name.endsWith("/shifts"))value={documents:[]};
    }else value=all.find(v=>url.endsWith(v.data.name))?.data??(url.includes("/releases/")?c.rulesRelease.data:url.includes("/rulesets/")?c.ruleset.data:{bindings:[]});
    if(fault==="cloud"&&url.includes("/jobs/"))value={...value,state:"ENABLED"};
    return new Response(JSON.stringify(value));
  };
  const budget=interactive?createOriginalDevelopTimeBudget({...data.window,reviewedMode:ORIGINAL_DEVELOP_MODE,nowMillis:()=>g.state.now,fetchImpl}):
    createCopyTimeBudget({...data.window,nowMillis:()=>g.state.now,fetchImpl});
  const args={reviewed,reviewDigest,iamBearer:"synthetic-read-token",
    readSource:async()=>{const start=g.state.now;g.state.now+=sourceDelay;state.sources++;const s=plan.scope;
      return {startedAtMillis:start,observedAtMillis:g.state.now,source:{sourceDigest:fault==="source"&&state.sources>1?digest("drift"):s.expectedAuthoritativeDigest,
        maintenance:{stateRevision:s.expectedStateRevision,writeEpoch:s.expectedWriteEpoch,activeRevision:s.expectedActiveRevision,activeDigest:s.expectedActiveDigest}}};},
    collectConfirmations:async request=>{state.human.push(request);const at=g.state.now;g.state.now+=confirmationDelay;
      if(fault==="confirmation")return [];
      return request.kind==="owner"?request.intent.participants.map(v=>({...v,intentDigest:request.intentDigest,confirmationId:`owner-${v.role}`,
        confirmedAtMillis:g.state.now,onlineClosedNoOfflineEdits:true,noManualOrAutomationWrites:true})):
        request.intent.administratorPrincipalIds.map((principalId,i)=>({principalId,intentDigest:request.intentDigest,confirmationId:`admin-${i}`,
          confirmedAtMillis:fault==="old-confirmation"?at-1:g.state.now,noUnreviewedDataRulesDeployIamOrScriptWrites:true,noAutomationViaHumanCredentials:true}));},
    readHumanReports:async({ownerAgreement:oa,administratorAgreement:aa})=>{
      const oi=oa.payload.intent,ai=aa.payload.intent,at=fault==="stale-report"?g.state.now-100000:g.state.now;
      return {ownerObservation:{workbookFileId:FILE,ownerPrincipalId:oi.ownerPrincipalId,participantsDigest:digest({revision:oi.participantsRevision,participants:oi.participants}),
        effectiveAuthorityDigest:oi.effectiveAuthorityDigest,sourceRevision:oi.sourceRevision,sourceDigest:oi.sourceDigest,technicalCapability:"retained",permissionWorkflowClosed:true,
        permissionControlEvidenceDigest:digest(oi.permissionControl),agreementStatus:fault==="withdrawn"?"withdrawn":"confirmed",ownerActivity:"none-reported",unresolvedWriteCount:0,observedAtMillis:at},
      administratorObservation:{projectId:ai.projectId,databaseId:ai.databaseId,environment:ai.environment,agreementDigest:aa.digest,administratorPrincipalIds:ai.administratorPrincipalIds,
        participantsRevision:ai.participantsRevision,effectiveIamDigest:ai.effectiveIamDigest,sourceRevision:ai.sourceRevision,sourceDigest:ai.sourceDigest,technicalCapability:"retained",
        agreementStatus:"confirmed",administratorActivity:"none-reported",unresolvedWriteCount:0,reportRevision:"collected-final",observedAtMillis:at}};},
    sleep:async ms=>{g.state.now+=fault==="short-wait"?0:ms;}};
  const context={binding,receiptId,permissionReceipt:receipt,transition,nativeReviewDigest:g.ownerChannel.reviewDigest,fetchImpl:budget.fetch,nowMillis:()=>g.state.now,
    assertActive:()=>{assert.equal(state.aborted,false);budget.assertStage();},captureOwner:async()=>{const start=g.state.now;g.state.now+=sheetsDelay;state.captures++;
      return {...structuredClone(after),startedAtMillis:start,observedAtMillis:g.state.now,...(fault==="sheets"&&state.captures>1?{metadataDigest:digest("changed")}: {})};},
    assertWriterAuthority:async()=>{state.authority++;},record:async value=>state.records.push(structuredClone(value))};
  return {g,state,args,context,budget,make:()=>createInitialReviewCollector(args)};
}

test("concrete collector binds actual confirmation challenges, reads and quiet interval within reserved preparation time",async()=>{
  const f=await fixture(),collector=f.make(),result=await collector(f.context);
  const seal=sealInitialEvidence({...f.context,scope:result.scope,review:result.review,nowMillis:f.g.state.now});assert.equal(seal.receiptId,"collector-window");
  const p=result.review.evidence.payload,report=f.state.records.at(-1);
  assert.equal(report.result,"verified");assert.ok(report.finishedAtMillis<report.deadlineMillis);assert.equal(report.postCollectionReserveMillis,30000);
  assert.ok(p.quietHorizon.endedAtMillis-p.quietHorizon.startedAtMillis>=30000);assert.equal(f.state.sources,2);assert.equal(f.state.captures,2);assert.equal(f.state.authority,2);
  assert.deepEqual(f.state.human.map(r=>r.kind),["owner","administrator"]);assert.equal(f.state.human[1].intent.ownerAgreementDigest,p.ownerAgreement.digest);
  assert.equal(p.causalDrain.initialPendingDeliveryCount,null);assert.equal(p.causalDrain.finalInFlightWorkCount,null);
  assert.ok(f.state.http.every(r=>r.method==="GET"||r.url.endsWith(":getIamPolicy")));
  assert.equal(f.g.state.mints,0);assert.equal(f.g.batch.sheets.mutations.length,0);retainTiming("normal",f);await assert.rejects(collector(f.context),/already consumed/);
});

test("explicit twenty-minute collector accepts slower actual-challenge replies without consuming work or cleanup reserve",async()=>{
  const f=await fixture({interactive:true,confirmationDelay:100000}),result=await f.make()(f.context);
  const seal=sealInitialEvidence({...f.context,scope:result.scope,review:result.review,nowMillis:f.g.state.now});
  assert.equal(seal.receiptId,"collector-window");
  const report=f.state.records.at(-1),start=f.context.binding.window.startsAtMillis;
  assert.equal(report.deadlineMillis,start+750000);assert.ok(report.finishedAtMillis>start+180000);
  assert.ok(report.finishedAtMillis<report.deadlineMillis);assert.equal(report.postCollectionReserveMillis,30000);
  assert.equal(f.g.state.mints,0);assert.equal(f.state.human.length,2);assert.equal(f.state.sources,2);
});

test("the same slow replies still reject under the unchanged default ten-minute collector",async()=>{
  const f=await fixture({confirmationDelay:100000});await assert.rejects(f.make()(f.context));
  assert.equal(f.state.records.at(-1).result,"rejected");assert.equal(f.g.state.mints,0);assert.equal(f.state.sources,0);
});
for(const fault of ["cloud","census","source","sheets","confirmation","old-confirmation","withdrawn","stale-report","short-wait"])
test(`initial collector rejects ${fault} without manufacturing a usable envelope`,async()=>{
  const f=await fixture({fault});await assert.rejects(f.make()(f.context));assert.equal(f.state.records.at(-1).result,"rejected");assert.equal(f.g.state.mints,0);assert.equal(f.g.batch.sheets.mutations.length,0);
  if(fault==="withdrawn")assert.deepEqual(f.state.records.at(-1).diagnostic,{checkpoint:"post-final-seal",kind:"error"});
});
for(const [name,options]of [["slow confirmations",{confirmationDelay:60000}],["slow source",{sourceDelay:80000}],["late grant",{grantDelay:145000}]])
test(`collection reserves post-processing headroom despite ${name}`,async()=>{
  const f=await fixture(options);await assert.rejects(f.make()(f.context));assert.equal(f.state.records.at(-1).result,"rejected");assert.equal(f.g.state.mints,0);
  assert.equal(f.state.records.at(-1).deadlineMillis,f.context.binding.window.endsAtMillis-450000);retainTiming(name.replaceAll(" ","-"),f);
});
test("unreviewed template, missing technical closure and bound-plan drift stop before any collection reads",async()=>{
  for(const kind of ["hash","closure","plan"]){const f=await fixture();
    if(kind==="hash")f.args.reviewed.payload.rules.deployedRevision="other";
    if(kind==="closure"){f.args.reviewed.payload.writerControls.find(c=>c.state!=="agreement-recorded").closedAtMillis=null;f.args.reviewDigest=digest(f.args.reviewed);}
    if(kind==="plan") {f.context.binding.initialEvidencePlan.collectionReviewDigest=digest("different");await assert.rejects(f.make()(f.context));}
    else assert.throws(f.make);assert.equal(f.state.http.length,0);assert.equal(f.state.human.length,0);
  }
});

test("a failed parallel cloud read still joins all pending provider calls before returning",async()=>{
  const f=await fixture();let finish,entered;const started=new Promise(resolve=>{entered=resolve;}),fetch=f.context.fetchImpl;
  f.context.fetchImpl=async(url,opts)=>{if(url.endsWith("/functions/fn0"))return new Response("{}",{status:503});
    if(url.endsWith("/functions/fn1")){entered();await new Promise(resolve=>{finish=resolve;});}return fetch(url,opts);};
  let returned=false;const pending=assert.rejects(f.make()(f.context)).then(()=>{returned=true;});await started;await new Promise(resolve=>setImmediate(resolve));
  assert.equal(returned,false);finish();await pending;assert.equal(f.state.records.at(-1).providerCallsSettled,true);
});
test("cancellation during the quiet interval rejects without final reads or resealing",async()=>{
  const f=await fixture();f.args.sleep=async ms=>{f.g.state.now+=ms;f.state.aborted=true;};await assert.rejects(f.make()(f.context));
  assert.equal(f.state.sources,1);assert.equal(f.state.captures,1);assert.equal(f.state.records.at(-1).result,"rejected");
});

test("post-observation failure retains its sanitized checkpoint without recording the exception or observations",async()=>{
  const f=await fixture(),original=f.args.readHumanReports,secret="Bearer synthetic-secret user@example.test",error=new Error(secret);
  f.args.readHumanReports=async request=>{
    const reports=await original(request);
    Object.defineProperty(reports,"ownerObservation",{get(){throw error;}});
    return reports;
  };
  await assert.rejects(f.make()(f.context),caught=>caught===error);
  const report=f.state.records.at(-1);
  assert.equal(report.result,"rejected");assert.equal(report.providerCallsSettled,true);
  assert.deepEqual(report.diagnostic,{checkpoint:"post-final-human-reports",kind:"error"});
  assert.equal(report.stages.at(-1).name,"final-observations");assert.equal(report.stages.at(-1).succeeded,true);
  assert.equal(f.state.records.some(v=>v.phase==="initial-review-collection-observations"),false);
  assert.equal(JSON.stringify(f.state.records).includes(secret),false);
  assert.equal(f.state.authority,2);assert.equal(f.state.sources,2);assert.equal(f.state.captures,2);
  assert.equal(f.g.state.mints,0);assert.equal(f.g.batch.sheets.mutations.length,0);
});

test("a failed failure-record preserves the original collection error",async()=>{
  const f=await fixture(),original=f.args.readHumanReports,error=new Error("original synthetic collection failure"),record=f.context.record;
  f.args.readHumanReports=async request=>{
    const reports=await original(request);
    Object.defineProperty(reports,"ownerObservation",{get(){throw error;}});
    return reports;
  };
  let finishAttempted=false;
  f.context.record=async value=>{
    if(value.phase==="initial-review-collection-finished"){finishAttempted=true;throw Error("synthetic journal failure");}
    return record(value);
  };
  await assert.rejects(f.make()(f.context),caught=>caught===error);
  assert.equal(finishAttempted,true);assert.equal(f.state.sources,2);assert.equal(f.state.captures,2);assert.equal(f.state.authority,2);
  assert.equal(f.state.records.some(v=>v.phase==="initial-review-collection-observations"),false);
});
module.exports={fixture};

test("cancellation waits for the already started source inspection before releasing collection",async()=>{
  const f=await fixture();let finish,enter;const entered=new Promise(resolve=>{enter=resolve;});
  f.args.readSource=async()=>{enter();await new Promise(resolve=>{finish=resolve;});throw Error("source unavailable");};
  let finished=false;const pending=assert.rejects(f.make()(f.context)).then(()=>{finished=true;});await entered;f.state.aborted=true;
  await new Promise(resolve=>setImmediate(resolve));assert.equal(finished,false);finish();await pending;
  assert.equal(f.state.records.at(-1).providerCallsSettled,true);assert.equal(f.state.captures,0);
});

test("concrete factory binds its package and uses a read-only SDK transaction before sealing",async()=>{
  const f=await fixture(),{sourceInput,reviewPackage}=f.g.batch;
  const {materializeControlledDevelopMigrationPreparation:prepare}=require("../scripts/materialize-develop-migration-package.cjs");
  const prepared=prepare({sourceInput,reviewPackage,sourceCapture:{projectId:"reguerta-9f27f",environment:"develop",
    documents:structuredClone(sourceInput.snapshot.collections.shifts),guardCollections:Object.fromEntries(["users","deliveryCalendar","notificationEvents","config"].map(k=>[k,structuredClone(sourceInput.snapshot.collections[k])]))}});
  let reads=0;
  const compose=require("../scripts/compose-develop-window-services.cjs").composeDevelopWindowServices({
    firestore:{projectId:"reguerta-9f27f",databaseId:"(default)",runTransaction:async(_callback,options)=>{assert.deepEqual(options,{readOnly:true});reads++;throw Error("source unavailable");}},
    prepared,initialEvidencePlan:f.context.binding.initialEvidencePlan,initialCollectionReview:f.args.reviewed,iamBearer:f.args.iamBearer,
    collectConfirmations:f.args.collectConfirmations,readInitialHumanReports:f.args.readHumanReports,sleep:f.args.sleep,readHumanReports:async()=>{throw Error("must not admit");}});
  const context={...f.context,timeBudget:f.budget,owner:{capture:f.context.captureOwner},getPermissionTransition:()=>f.context.transition};
  context.binding={...f.context.binding,preparedDigest:prepared.preparedDigest,reviewPackageDigest:prepared.reviewPackageDigest};
  context.permissionReceipt={...f.context.permissionReceipt,bindingDigest:digest(context.binding)};
  await assert.rejects(compose({...context,binding:{...context.binding,preparedDigest:digest("other")}}),/preparation differs/);
  assert.equal(reads,0);assert.equal(f.state.http.length,0);
  await assert.rejects(compose(context),/initial_collection_initial-sources_failed/);
  assert.equal(reads,1);assert.equal(f.state.records.at(-1).result,"rejected");assert.equal(f.state.captures,0);assert.equal(f.g.state.mints,0);
});
