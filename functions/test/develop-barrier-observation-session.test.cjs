"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {historicalFixture}=require("./develop-historical-risk-fixture.cjs");
const censusFixture=require("./develop-legacy-census-fixture.cjs");
const {inspectCensus}=require("../scripts/inspect-develop-legacy-census.cjs");
const {prepareDevelopContainedDeliveryEvidence:contained}=require("../scripts/observe-develop-capture-controls.cjs");
const {createBarrierObservationSessions}=require("../scripts/develop-barrier-observation-session.cjs");
const {createDevelopCensusReader}=require("../scripts/develop-live-census-reader.cjs");
const {createCopyTimeBudget}=require("../scripts/develop-copy-time-budget.cjs");
const {FILE,metadataFingerprint}=require("../scripts/develop-original-writer-provider.cjs");
function fixture() {
  const f=historicalFixture(),census=censusFixture.fixture(),offset=Date.parse(census.readTime)-320;
  const shift=x=>Array.isArray(x)?x.map(shift):x&&typeof x==="object"?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,k.endsWith("AtMillis")||["observedAtMillis","recoveryDeadlineMillis"].includes(k)?v===null?null:v+offset:shift(v)])):x;
  f.evidence.payload=shift(f.evidence.payload);const p=f.evidence.payload;
  for(const key of ["ownerAgreement","administratorAgreement"]){const agreement=p[key];agreement.payload.confirmations.forEach(c=>c.intentDigest=digest(agreement.payload.intent));agreement.digest=digest(agreement.payload);}
  p.administratorAgreement.payload.intent.ownerAgreementDigest=p.ownerAgreement.digest;
  p.administratorAgreement.payload.confirmations.forEach(c=>c.intentDigest=digest(p.administratorAgreement.payload.intent));p.administratorAgreement.digest=digest(p.administratorAgreement.payload);
  p.administratorObservation.agreementDigest=p.administratorAgreement.digest;
  for(const c of p.writerControls.filter(c=>c.state==="agreement-recorded")){const a=c.writerId.startsWith("workbook")?p.ownerAgreement:p.administratorAgreement;c.controlDigest=c.initialReadBackDigest=c.finalReadBackDigest=a.digest;}
  const {createShiftPlanningControlManifestDigest:manifest}=require("../lib/shift-planning-intake-barrier.js");
  f.scope.expectedOwnerAgreementDigest=p.ownerAgreement.digest;f.scope.expectedAdministratorAgreementDigest=p.administratorAgreement.digest;f.scope.expectedControlManifestDigest=manifest(p.writerControls,p.maintenanceMode);
  const classifiedCaptures=inspectCensus(census).captures.map(({eventKey,coreDigest})=>({eventKey,coreDigest}));
  const deliveries=p.causalDrain.containedDelivery.initial.deliveries.map(d=>({...d,pendingCount:null,inFlightCount:null}));
  const causal=contained({initial:census,final:census,classifiedCaptures,initialDeliveries:deliveries,finalDeliveries:deliveries});
  p.causalDrain.containedDelivery=causal.evidence;p.causalDrain.containedDelivery.final.observedAtMillis=offset+510;
  p.causalDrain.initialPendingDeliveryCount=p.causalDrain.initialInFlightDeliveryCount=p.causalDrain.finalPendingDeliveryCount=p.causalDrain.finalInFlightDeliveryCount=null;
  p.causalDrain.acceptedSetDigest=causal.acceptedSetDigest;p.causalDrain.historicalRisk.causalSetDigest=causal.acceptedSetDigest;
  f.scope.expectedCausalSetDigest=causal.acceptedSetDigest;f.scope.expectedHistoricalRiskDigest=digest(p.causalDrain.historicalRisk);f.evidence.digest=digest(p);
  const project="reguerta-9f27f",prefix=`projects/${project}/locations/europe-west1`;
  const cloud={projectId:project,readOnly:true,functions:Array.from({length:24},(_,i)=>({data:{name:`${prefix}/functions/fn${i}`}})),
    jobs:Array.from({length:3},(_,i)=>({data:{name:`${prefix}/jobs/job${i}`,state:"PAUSED"}})),rulesRelease:{data:{rulesetName:`projects/${project}/rulesets/test-rules`}},ruleset:{data:{name:"rules"}},projectIam:{data:{bindings:[]}},invokerPolicy:{data:{bindings:[]}}};
  const after={file:{id:FILE,version:"287",owners:[],parents:[]},parent:{id:"parent",owners:[]},filePermissions:[],parentPermissions:[]};
  const owner={fileId:FILE,snapshot:{cells:"unchanged"},snapshotDigest:digest({cells:"unchanged"}),after,metadataDigest:metadataFingerprint(after)};
  const review={scopeDigest:digest(f.scope),evidence:f.evidence,cloud,owner,census,classifiedCaptures,deliveries};
  const state={now:offset+530,closed:0,records:[],stale:false,withdrawn:false,drift:false,delay:0,calls:0};
  const fetchImpl=async url=>{state.calls++;let data=cloud.functions.find(x=>url.endsWith(x.data.name))?.data??cloud.jobs.find(x=>url.endsWith(x.data.name))?.data;
    data??=url.includes("/releases/")?cloud.rulesRelease.data:url.includes("/rulesets/")?cloud.ruleset.data:{bindings:[]};return new Response(JSON.stringify(data));};
  const budget=createCopyTimeBudget({startsAtMillis:state.now,endsAtMillis:state.now+600000,nowMillis:()=>state.now,fetchImpl});
  const args={scope:f.scope,review,reviewDigest:digest(review),timeBudget:budget,iamBearer:"fixture-only",nowMillis:()=>state.now,
    owner:{capture:async()=>({...structuredClone(owner),startedAtMillis:state.now,observedAtMillis:state.now,...(state.drift?{snapshotDigest:digest("changed")}: {})}),close:async()=>state.closed++},
    getPermissionTransition:()=>({before:owner,after:owner}),assertWriterAuthority:async()=>{state.now+=state.delay;},readCensus:async()=>({...structuredClone(census),readTime:new Date(state.now).toISOString()}),
    readHumanReports:async()=>Object.fromEntries(["ownerObservation","administratorObservation"].map(k=>[k,{...p[k],observedAtMillis:state.stale?offset+510:state.now,...(state.withdrawn?{agreementStatus:"withdrawn"}:{})}])),
    record:async r=>state.records.push(r)};
  return {args,state,budget,census,scope:f.scope,make:()=>createBarrierObservationSessions(args)};
}
test("fresh real-reader composition preserves initial evidence and unknown counters; leases never revoke owner",async()=>{
  const f=fixture(),sessions=f.make(),lease=await sessions.openObservationSession(f.scope),e=await lease.readEvidence();
  assert.equal(e.payload.causalDrain.finalPendingDeliveryCount,null);assert.equal(e.payload.causalDrain.finalPendingWorkCount,null);
  assert.deepEqual(e.payload.quietHorizon,f.args.review.evidence.payload.quietHorizon);assert.equal(e.payload.rules.initialReadBackAtMillis,f.args.review.evidence.payload.rules.initialReadBackAtMillis);
  assert.equal(f.state.calls,31);await lease.close();assert.equal(f.state.closed,0);await assert.rejects(lease.readEvidence());
  const second=await sessions.openObservationSession(f.scope);await second.readOwnerObservation();await second.close();await sessions.close();assert.equal(f.state.closed,0);
  assert.equal(f.state.records.length,2);await assert.rejects(sessions.openObservationSession(f.scope));
});
for(const fault of ["stale","withdrawn","drift"])test(`live observation rejects ${fault} without renewing authority`,async()=>{
  const f=fixture(),sessions=f.make();f.state[fault]=true;const lease=await sessions.openObservationSession(f.scope);
  await assert.rejects(lease.readEvidence());await lease.close();assert.equal(f.state.records.length,0);assert.equal(f.state.closed,0);
});
test("review hash, scope and fabricated zero queue counts fail before provider reads",()=>{
  for(const variant of ["hash","scope","zero"]){const f=fixture();if(variant==="hash")f.args.review.cloud.jobs[0].data.state="ENABLED";
    if(variant==="scope")f.args.scope.transitionId="wrong-operation";
    if(variant==="zero"){f.args.review.deliveries[0].pendingCount=0;f.args.reviewDigest=digest(f.args.review);}
    assert.throws(f.make);assert.equal(f.state.calls,0);}
});
test("late observation is awaited and fails within the same work budget before any submission",async()=>{
  const f=fixture();f.budget.beginWork(f.state.now+300000);f.state.delay=151000;
  const lease=await f.make().openObservationSession(f.scope);await assert.rejects(lease.readEvidence());await lease.close();
  await assert.rejects(Promise.resolve().then(()=>f.budget.assertSubmission()));assert.equal(f.state.records.length,0);
});
test("observation close waits for pending siblings even when another provider fails",async()=>{
  const f=fixture();let settle,finished=false;f.args.readCensus=()=>new Promise(resolve=>{settle=()=>{finished=true;resolve(f.census);};});
  f.args.owner.capture=async()=>{throw Error("unavailable");};const sessions=f.make(),lease=await sessions.openObservationSession(f.scope);
  const read=lease.readEvidence(),rejected=assert.rejects(read);let closed=false;const close=lease.close().catch(()=>{}).then(()=>{closed=true;});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(closed,false);settle();await rejected;await close;assert.equal(finished,true);
});
test("cooperative phase method collects once per call, sharing no capture across later phases",async()=>{
  const f=fixture();let reports=0;
  const original=f.args.readHumanReports;f.args.readHumanReports=async(...args)=>{reports++;return original(...args);};
  // Construct after installing the counted human port.
  const counted=f.make(),first=await counted.openObservationSession(f.scope);
  const initial=await first.readCooperativeObservation({phase:"initial"}),before=initial.evidence;assert.equal(initial.kind,"complete-develop-barrier-observation");assert.equal(reports,1);assert.equal(f.state.calls,31);
  assert.equal(before.payload.ownerObservation.observedAtMillis,before.payload.administratorObservation.observedAtMillis);
  await first.close();f.state.now++;
  const final=await counted.openObservationSession(f.scope),after=(await final.readCooperativeObservation({phase:"final"})).evidence;
  assert.equal(reports,2);assert.equal(f.state.calls,62);
  assert.ok(after.payload.ownerObservation.observedAtMillis>before.payload.ownerObservation.observedAtMillis);
  await final.close();await counted.close();
});
test("a callback receipt cannot fall back to an unchanged-source capture without its owned package",async()=>{
  const f=fixture(),sessions=f.make(),lease=await sessions.openObservationSession(f.scope);
  await assert.rejects(lease.readCooperativeObservation({phase:"final",operationResult:{receiptDigest:digest("not a retained receipt")}}),
    /exact prepared package/);
  assert.equal(f.state.records.length,0);assert.equal(f.state.calls,31);
  await lease.close();await sessions.close();
});
test("phase close awaits the independent committed inspection before releasing its lease",async()=>{
  const f=fixture();let settle,finished=false;
  f.args.prepared={};f.args.inspectCommitted=()=>new Promise(resolve=>{
    settle=()=>{finished=true;resolve({kind:"not-observed"});};
  });
  const sessions=f.make(),lease=await sessions.openObservationSession(f.scope);
  const read=lease.readCooperativeObservation({phase:"final",operationResult:{receiptDigest:digest("invalid receipt")}}),rejected=assert.rejects(read);
  while(!settle)await new Promise(resolve=>setImmediate(resolve));
  let closed=false;const close=lease.close().catch(()=>{}).then(()=>{closed=true;});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(closed,false);
  settle();await rejected;await close;assert.equal(finished,true);await sessions.close();
});
test("GET-only census uses one snapshot, checks all pages and refuses external document names",async()=>{
  const f=fixture(),calls=[],reader=createDevelopCensusReader({bearer:"fixture-only"});
  const fetchImpl=async(url,options)=>{calls.push(url);assert.equal(options.method,"GET");const name=new URL(url).pathname.slice(4),c=f.census;
    let data=name.endsWith("/current")?c.intakeBefore:{documents: name.endsWith("/events")?c.events:name.endsWith("/deliveries")?c.deliveries:name.endsWith("/chunks")?Object.values(c.chunks)[0]:c.collections[name.split("/").at(-1)]};return new Response(JSON.stringify(data));};
  const result=await reader({fetchImpl,nowMillis:()=>f.state.now});assert.equal(inspectCensus(result).eventCount,1);assert.equal(new Set(calls.map(u=>new URL(u).searchParams.get("readTime"))).size,1);
  f.census.events[0].name="projects/other/databases/(default)/documents/secret";await assert.rejects(reader({fetchImpl,nowMillis:()=>f.state.now}));
  assert.ok(calls.every(u=>u.startsWith("https://firestore.googleapis.com/v1/projects/reguerta-9f27f/")));
});
module.exports={fixture};
