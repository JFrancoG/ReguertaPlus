"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {sealInitialEvidence,verifyInitialEvidenceSeal}=require("../scripts/develop-initial-evidence-seal.cjs");
const {originalWindowFixture}=require("./develop-original-window-fixture.cjs");
const {sealFixture}=require("./develop-initial-evidence-seal-fixture.cjs");
const {createOriginalWindowOwner}=require("../scripts/develop-original-window-provider.cjs");
const {runControlledWindow:run,recoverControlledWindow:recover}=require("../scripts/develop-controlled-window.cjs");
const {readWindowJournal:read}=require("../scripts/develop-window-journal.cjs");
const {OWNER}=require("../scripts/develop-original-writer-provider.cjs");
async function fixture(t,{fault=null,evidenceAge=600000}={}) {
  const g=originalWindowFixture({fault}),root=fs.mkdtempSync(path.join(os.tmpdir(),"initial-seal-"));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  g.state.now=Date.parse(require("./develop-legacy-census-fixture.cjs").fixture().readTime);
  const owner=createOriginalWindowOwner({ownerBearer:"fixture-owner-proof",fetchImpl:g.fetchImpl,nowMillis:()=>g.state.now,sleep:async()=>{}});
  const before=await owner.capture(false),data={...g.args(),receiptId:"sealed-window"};
  const proof=sealFixture({scopeOverrides:{transitionId:data.prepared.operationId},before,window:data.window,nowMillis:()=>g.state.now,advance:ms=>{g.state.now+=ms;},evidenceAge});
  data.scope=proof.initialEvidencePlan.scope;data.initialEvidencePlan=proof.initialEvidencePlan;
  const grant=g.ownerChannel.grant;g.ownerChannel.grant=async(p,c)=>{
    const startedAtMillis=g.state.now,before=await owner.read();await grant(p,c);const after=await owner.read();
    const native={phase:"native-grant-verified",permission:p,reviewDigest:g.ownerChannel.reviewDigest,startedAtMillis,finishedAtMillis:g.state.now,beforeDigest:digest(before),afterDigest:digest(after)};
    native.closure={kind:"native-owner-grant-workflow-closed",owner:OWNER,actionDigest:digest(native),closedAtMillis:native.finishedAtMillis,temporaryWriteCredentials:"not-created",grantCapability:"consumed"};return native;
  };
  let seals=0,acquisitions=0,mutate=x=>x;const errors=[];
  const composeServices=async({binding,receiptId,permissionReceipt,getPermissionTransition,nativeReviewDigest,retainedSeal})=>{
    let seal=retainedSeal;
    if(!seal){seals++;assert.equal(g.state.permission,true);assert.equal(g.state.mints,0);
      const collected=proof.collect(permissionReceipt),input={binding,receiptId,permissionReceipt,transition:getPermissionTransition(),nativeReviewDigest,...collected,nowMillis:g.state.now};
      try{seal=sealInitialEvidence(mutate(input));}catch(error){errors.push(error.stack);throw error;}}
    else seal=verifyInitialEvidenceSeal(seal,binding,receiptId,nativeReviewDigest);
    return {initialSeal:seal,barrier:{...g.barrier,acquire:async({scope})=>{acquisitions++;assert.deepEqual(scope,seal.scope);return {acquired:true};}},executor:g.executor,close:async()=>{}};
  };
  const ports={barrier:undefined,executor:undefined,composeServices};
  return {g,root,data,proof,ports,errors,setMutate:f=>{mutate=f;},counts:()=>({seals,acquisitions}),execute:()=>run({...data,...g.sessions(data,"seal-owner",ports),root,nowMillis:()=>g.state.now,fetchImpl:g.fetchImpl})};
}
test("post-grant evidence is sealed durably before mint/admission; recovery uses the same seal without collecting consent",async t=>{
  const f=await fixture(t),result=await f.execute();assert.equal(result.kind,"direction-verified-and-contained",JSON.stringify({result,errors:f.errors}));
  const saved=read(result.directory),phases=saved.records.map(r=>r.value.phase),seal=saved.records.find(r=>r.value.phase==="google-initial-evidence-sealed").value.seal;
  assert.ok(phases.indexOf("google-permission-receipt")<phases.indexOf("google-initial-evidence-sealed"));assert.ok(phases.indexOf("google-initial-evidence-sealed")<phases.indexOf("google-mint-intent"));
  assert.equal(saved.binding.scope.expectedOwnerAgreementDigest,null);assert.notEqual(seal.scope.expectedOwnerAgreementDigest,null);
  assert.deepEqual(f.counts(),{seals:1,acquisitions:1});assert.equal(f.g.state.mints,1);assert.equal(f.g.batch.sheets.mutations.length,1);
  const recovered=await recover({directory:result.directory,recoveryId:"sealed-recovery",expectedBindingDigest:digest(saved.binding),
    window:{startsAtMillis:f.g.state.now,endsAtMillis:f.g.state.now+600000},nowMillis:()=>f.g.state.now,fetchImpl:f.g.fetchImpl,...f.g.sessions(f.data,"seal-recovery-owner",f.ports)});
  assert.equal(recovered.records.at(-1).value.kind,"cleanup-verified-inspection-only");assert.deepEqual(f.counts(),{seals:1,acquisitions:1});assert.equal(f.g.state.mints,1);
});
for(const fault of ["old-receipt","missing-closure","future-receipt","scope","participants","window","old-confirmation","inputs","late"])
test(`initial evidence rejects ${fault} before mint and still cleans all permissions`,async t=>{
  const f=await fixture(t);f.setMutate(input=>{
    if(fault==="old-receipt")input.permissionReceipt.receiptId="other-window";
    if(fault==="missing-closure")delete input.permissionReceipt.native.closure;
    if(fault==="future-receipt")input.permissionReceipt.native.finishedAtMillis=input.nowMillis+1;
    if(fault==="scope")input.scope.expectedWriteEpoch++;
    if(fault==="participants")input.review.evidence.payload.ownerAgreement.payload.intent.participants[0].principalId="another-owner";
    if(fault==="window")input.review.evidence.payload.ownerAgreement.payload.intent.endsAtMillis++;
    if(fault==="old-confirmation")input.review.evidence.payload.ownerAgreement.payload.confirmations[0].confirmedAtMillis=input.permissionReceipt.native.finishedAtMillis-1;
    if(fault==="inputs")input.review.cloud.changed=true;
    if(fault==="late")f.g.state.now=f.data.window.startsAtMillis+181000;
    return input;
  });
  const result=await f.execute();assert.equal(result.kind,"inspection-required");assert.equal(f.g.state.mints,0);assert.equal(f.g.batch.sheets.mutations.length,0);
  assert.equal(f.g.state.permission,false);assert.equal(f.g.state.disabled,true);assert.deepEqual(f.g.state.policy.bindings,[]);assert.equal(f.g.state.revoked.size,1);
  assert.equal(f.counts().seals,1);assert.equal(f.counts().acquisitions,0);
});
module.exports={fixture};

test("concrete service factory accepts the post-grant seal before the real barrier rejects unrelated source scope",async t=>{
  const f=await fixture(t),{sourceInput,reviewPackage}=f.g.batch;
  const {materializeControlledDevelopMigrationPreparation:prepare}=require("../scripts/materialize-develop-migration-package.cjs");
  const prepared=prepare({sourceInput,reviewPackage,sourceCapture:{projectId:"reguerta-9f27f",environment:"develop",
    documents:structuredClone(sourceInput.snapshot.collections.shifts),guardCollections:Object.fromEntries(["users","deliveryCalendar","notificationEvents","config"].map(k=>[k,structuredClone(sourceInput.snapshot.collections[k])]))}});
  f.data.prepared=prepared;let collections=0,reads=0;
  f.ports.composeServices=require("../scripts/compose-develop-window-services.cjs").composeDevelopWindowServices({
    firestore:{projectId:"reguerta-9f27f",databaseId:"(default)",runTransaction:async()=>{reads++;throw Error("no shared SDK");}},prepared,
    initialEvidencePlan:f.data.initialEvidencePlan,iamBearer:"synthetic-control-reader",readHumanReports:async()=>{throw Error("not admitted");},
    readInitialReview:async({permissionReceipt})=>{collections++;return f.proof.collect(permissionReceipt);}});
  const factory=f.ports.composeServices;let factoryError=null;f.ports.composeServices=async args=>{try{return await factory(args);}catch(error){factoryError=error.stack;throw error;}};
  const result=await f.execute();assert.equal(result.kind,"inspection-required");assert.equal(collections,1);
  const records=read(result.directory).records.map(r=>r.value);assert.ok(records.some(r=>r.phase==="google-initial-evidence-sealed"),JSON.stringify({phases:records.map(r=>r.phase),factoryError}));
  assert.equal(f.g.state.mints,1);assert.equal(f.g.batch.sheets.mutations.length,0);assert.equal(reads,0);
  assert.equal(f.g.state.disabled,true);assert.equal(f.g.state.permission,false);assert.deepEqual(result.cleanup.failures,[]);
});

test("interruption while final reports are pending settles the collector before cleanup, with no token",async t=>{
  const f=await fixture(t),controller=new AbortController(),compose=f.ports.composeServices;f.data.signal=controller.signal;
  let enter,settle;const entered=new Promise(resolve=>{enter=resolve;});
  f.ports.composeServices=async args=>{enter();await new Promise(resolve=>{settle=resolve;});return compose(args);};
  const pending=f.execute();await entered;controller.abort();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.g.state.permission,true);assert.equal(f.g.state.revoked.size,0);settle();const result=await pending;
  assert.equal(result.kind,"inspection-required");assert.equal(f.g.state.mints,0);assert.equal(f.g.state.permission,false);assert.equal(f.g.state.disabled,true);
  assert.deepEqual(result.cleanup.failures,[]);
});

test("missing final seal remains cleanup-only on restart and cannot recollect or grant",async t=>{
  const f=await fixture(t,{fault:"remove"});f.setMutate(()=>{throw Error("collector interrupted");});const first=await f.execute();
  const saved=read(first.directory);assert.equal(saved.records.some(r=>r.value.phase==="google-initial-evidence-sealed"),false);
  assert.equal(f.g.state.permission,true);assert.equal(f.g.state.disabled,true);f.g.state.failCleanup=false;
  const recovered=await recover({directory:first.directory,recoveryId:"partial-seal-recovery",expectedBindingDigest:digest(saved.binding),
    window:{startsAtMillis:f.g.state.now,endsAtMillis:f.g.state.now+600000},nowMillis:()=>f.g.state.now,fetchImpl:f.g.fetchImpl,...f.g.sessions(f.data,"partial-recovery-owner",f.ports)});
  assert.equal(recovered.records.at(-1).value.kind,"cleanup-verified-inspection-only");assert.equal(f.counts().seals,1);
  assert.equal(f.g.state.mints,0);assert.equal(f.g.state.permission,false);assert.equal(f.g.batch.sheets.mutations.length,0);
  assert.equal(recovered.records.at(-1).value.results.barrier.kind,"unavailable");
});

test("interrupted seal append prevents mint and still contains the actual native grant",async t=>{
  const f=await fixture(t),compose=f.ports.composeServices;
  f.ports.composeServices=async args=>{const services=await compose(args),dir=path.join(f.root,f.data.receiptId),next=read(dir).records.length;
    fs.writeFileSync(path.join(dir,String(next).padStart(6,"0")+".json.pending"),"interrupted seal");return services;};
  await assert.rejects(f.execute());assert.equal(f.g.state.mints,0);assert.equal(f.g.state.permission,false);assert.equal(f.g.state.disabled,true);assert.equal(f.g.state.revoked.size,1);
  assert.ok(fs.existsSync(path.join(f.root,"controlled-window-active")));
});

test("a sealed initial envelope that expires during IAM propagation cannot mint",async t=>{
  const f=await fixture(t,{evidenceAge:30000}),result=await f.execute();
  assert.equal(result.kind,"inspection-required");assert.equal(f.g.state.mints,0);assert.equal(f.g.batch.sheets.mutations.length,0);
  assert.ok(read(result.directory).records.some(r=>r.value.phase==="google-initial-evidence-sealed"));
  assert.equal(f.g.state.permission,false);assert.equal(f.g.state.disabled,true);assert.deepEqual(result.cleanup.failures,[]);
});
