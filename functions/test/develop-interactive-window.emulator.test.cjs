"use strict";

// Google, native sharing and human observations are explicit clocked doubles.
// Barrier acquisition, admission, source/CAS checks and migration use the actual
// Firestore SDK against the fixed emulator. No live-provider latency is claimed.
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {createHash}=require("node:crypto");
const {before,beforeEach,after,test}=require("node:test");
const {Firestore,Timestamp}=require("@google-cloud/firestore");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {createShiftPlanningControlManifestDigest:manifest}=require("../lib/shift-planning-intake-barrier.js");
const {encodeShiftPlanningFirestoreValue:encode}=require("../lib/shift-planning-publication-contract.js");
const {createFirestoreShiftPlanningIntakeBarrierRepository:repository}=require("../lib/shift-planning-firestore-intake-barrier-repository.js");
const {batchFixture}=require("./develop-helper-batch-fixture.cjs");
const {originalWindowFixture}=require("./develop-original-window-fixture.cjs");
const {historicalFixture}=require("./develop-historical-risk-fixture.cjs");
const {fromSnapshot}=require("./develop-shift-migration-fixture.cjs");
const {materializeDevelopMigrationPreparation}=require("../scripts/materialize-develop-migration-package.cjs");
const migration=require("../scripts/rehearse-develop-shift-migration.cjs");
const {historicalMigrationPlanBindings}=require("../scripts/develop-shift-migration-engine.cjs");
const {createControlledDevelopMigrationEmulator}=require("../scripts/controlled-develop-migration.cjs");
const {createControlledDevelopBarrierEmulator}=require("../scripts/controlled-develop-barrier.cjs");
const {runControlledWindow}=require("../scripts/develop-controlled-window.cjs");
const {readWindowJournal}=require("../scripts/develop-window-journal.cjs");
const {FILE}=require("../scripts/develop-original-writer-provider.cjs");
const {metadataFingerprint}=require("../scripts/develop-original-writer-provider.cjs");
const {createBarrierObservationSessions}=require("../scripts/develop-barrier-observation-session.cjs");
const {createCopyTimeBudget}=require("../scripts/develop-copy-time-budget.cjs");
const {prepareDevelopContainedDeliveryEvidence:containedEvidence}=require("../scripts/observe-develop-capture-controls.cjs");
const {createShiftSheetsAdapter}=require("../lib/shift-sheets.js");
const {createShiftSheetsConfig}=require("../lib/shift-sheets-config.js");
const {encodeDevelopShiftEvent}=require("../lib/develop-shift-intake.js");
const ROOT="develop/plus-collections",MODE="original-develop-deferred-writer-v1";
const enabled=process.env.GCLOUD_PROJECT===migration.PROJECT_ID&&process.env.FIRESTORE_EMULATOR_HOST===migration.HOST;
const run=(name,body)=>test(name,{skip:!enabled},body);
let db;
before(()=>{if(enabled)db=new Firestore({projectId:migration.PROJECT_ID,host:migration.HOST,ssl:false});});
beforeEach(async()=>{if(enabled)assert.equal((await fetch(`http://${migration.HOST}/emulator/v1/projects/${migration.PROJECT_ID}/databases/(default)/documents`,{method:"DELETE"})).ok,true);});
after(async()=>{if(db)await db.terminate();});
const saved=async name=>(await db.collection(`${ROOT}/${name}`).orderBy("__name__").get()).docs.map(d=>({path:d.ref.path,data:encode(d.data(),"interactive test",new Set())}));
const contained=(h,result)=>{
 assert.equal(h.f.state.permission,false);assert.equal(h.f.state.disabled,true);assert.deepEqual(h.f.state.policy.bindings,[]);
 assert.equal(h.f.state.revoked.size,1);assert.deepEqual(result.cleanup.failures,[]);assert.equal(h.leases().opened,h.leases().closed);
};

function longEvidence(f,prepared,source) {
 const h=historicalFixture({transitionId:prepared.operationId,expectedAuthoritativeDigest:source.sourceDigest,
  expectedStateRevision:source.maintenance.stateRevision,expectedWriteEpoch:source.maintenance.writeEpoch,
  expectedActiveRevision:source.maintenance.activeRevision,expectedActiveDigest:source.maintenance.activeDigest,
  expectedWorkbookFileId:FILE,expectedWorkbookRevision:f.batch.sourceInput.fileAfter.data.version});
 const offset=f.state.now-265000;
 const shift=value=>Array.isArray(value)?value.map(shift):value&&typeof value==="object"?
  Object.fromEntries(Object.entries(value).map(([key,v])=>[key,key.endsWith("AtMillis")||key==="recoveryDeadlineMillis"?v===null?null:v*500+offset:shift(v)])):value;
 const p=shift(h.evidence.payload),end=f.state.now+1200000;
 p.policy.maximumEvidenceAgeMillis=600000;h.scope.maximumEvidenceAgeMillis=600000;
 for(const key of ["ownerAgreement","administratorAgreement"]){
  const agreement=p[key];agreement.payload.intent.endsAtMillis=end;agreement.payload.intent.recoveryDeadlineMillis=end;
  if(key==="administratorAgreement")agreement.payload.intent.ownerAgreementDigest=p.ownerAgreement.digest;
  for(const confirmation of agreement.payload.confirmations)confirmation.intentDigest=digest(agreement.payload.intent);
  agreement.digest=digest(agreement.payload);
 }
 p.administratorObservation.agreementDigest=p.administratorAgreement.digest;
 for(const c of p.writerControls.filter(c=>c.state==="agreement-recorded")){
  const a=c.writerId.startsWith("workbook")?p.ownerAgreement:p.administratorAgreement;
  c.controlDigest=c.initialReadBackDigest=c.finalReadBackDigest=a.digest;
 }
 Object.assign(p.causalDrain.historicalRisk,historicalMigrationPlanBindings(prepared),{direction:"forward",
  migrationOperationId:prepared.operationId,recoveryOperationId:prepared.recoveryOperationId,expiresAtMillis:end});
 Object.assign(h.scope,{expectedOwnerAgreementDigest:p.ownerAgreement.digest,expectedAdministratorAgreementDigest:p.administratorAgreement.digest,
  expectedControlManifestDigest:manifest(p.writerControls,p.maintenanceMode),expectedHistoricalRiskDigest:digest(p.causalDrain.historicalRisk)});
 return {scope:h.scope,seed:{payload:p,digest:digest(p)}};
}
async function harness(t,{observationMillis=12000,workObservationMillis=observationMillis,mintMillis=0,failAdmission=false,configureObservation=null,physicalClock=false}={}) {
 const batch=batchFixture(),f=originalWindowFixture({batch}),seed=db.batch();
 for(const collection of ["shifts","users","deliveryCalendar","notificationEvents","config"])
  for(const row of batch.sourceInput.snapshot.collections[collection])seed.create(db.doc(row.name.split("/documents/")[1]),
   Object.fromEntries(Object.entries(row.fields).map(([key,value])=>[key,migration.decodeRESTValue(value)])));
 await seed.commit();
 const cloneCapture={projectId:migration.PROJECT_ID,environment:"develop",documents:[],guardCollections:{}};
 for(const collection of ["shifts","users","deliveryCalendar","notificationEvents","config"]){
  const rows=(await db.collection(`${ROOT}/${collection}`).orderBy("__name__").get()).docs.map(fromSnapshot);
  if(collection==="shifts")cloneCapture.documents=rows;else cloneCapture.guardCollections[collection]=rows;
 }
 const prepared=materializeDevelopMigrationPreparation({sourceInput:batch.sourceInput,reviewPackage:batch.reviewPackage,cloneCapture});
 const journal=repository(db,()=>Timestamp.fromMillis(f.state.now)),unavailable=async()=>{throw Error("No unscoped provider read");};
 const passive=createControlledDevelopMigrationEmulator({firestore:db,prepared,nowMillis:()=>f.state.now,
  controlPlane:{readBackClosed:unavailable,readBackOwnerObservation:unavailable,readBackAdministratorObservation:unavailable},failurePersistence:journal});
 const source=(await passive.inspectAdmission()).source,{scope,seed:evidence}=longEvidence(f,prepared,source);
 const observationAdapter=configureObservation?await configureObservation({f,prepared,scope,evidence}):null;
 const observeCurrent=typeof observationAdapter==="function"?observationAdapter:observationAdapter?.observe;
 const clock=physicalClock?Date.now:()=>f.state.now;
 const observations=[],events=[];let opened=0,closed=0;
 const fresh=async context=>{
  const started=clock();if(!physicalClock)f.state.now+=f.state.mints>0?workObservationMillis:observationMillis;
  const actual=observeCurrent?await observeCurrent(context):null;
  const p=structuredClone(evidence.payload),at=clock();
  p.ownerObservation.observedAtMillis=p.administratorObservation.observedAtMillis=at;
  p.rules.finalReadBackAtMillis=p.workbook.readBackAtMillis=p.causalDrain.finalQueueReadBackAtMillis=at;
  p.causalDrain.containedDelivery.final.observedAtMillis=at;
  for(const control of p.writerControls)control.finalReadBackAtMillis=at;
  p.verifiedAtMillis=at;observations.push({startedAtMillis:started,observedAtMillis:at,afterMint:f.state.mints>0});
  events.push("observation");return physicalClock?actual:{payload:p,digest:digest(p)};
 };
 const barrier=createControlledDevelopBarrierEmulator({firestore:db,prepared,nowMillis:clock,coherentObservations:true,
  openObservationSession:async()=>{
   opened++;return {readEvidence:async()=>{const value=await fresh();return value?.kind==="complete-develop-barrier-observation"?value.evidence:value;},
    readCooperativeObservation:async context=>{const value=await fresh(context);return value?.kind?value:{kind:"complete-develop-barrier-observation",evidence:value};},
    readOwnerObservation:unavailable,readAdministratorObservation:unavailable,close:async()=>{closed++;}};
  }});
 const executor=createControlledDevelopMigrationEmulator({firestore:db,prepared,nowMillis:clock,
  controlPlane:barrier.controlPlane,failurePersistence:barrier.failurePersistence});
 observationAdapter?.bindExecutor?.(executor);
 if(failAdmission)executor.inspectAdmission=async()=>({checksPassed:false});
 const data={...f.args(),prepared,scope,executionMode:MODE,window:{startsAtMillis:clock(),endsAtMillis:clock()+1200000},receiptId:"interactive-real-sdk"};
 const sessions=physicalClock?{openSession:async()=>{
  // Explicit lifecycle double: the real session's IAM wait/cleanup is covered by
  // the clocked original-provider cases above; this cycle measures real reads.
  f.state.permission=true;f.state.disabled=false;
  const session={barrier,executor,observeSheets:async()=>batch.observe(),permissionTransition:null,
   inspect:{barrier:async()=>barrier.inspectRetained({scope}),firestore:async()=>executor.inspectUncertain({scope}),sheets:async()=>({kind:"read-only"})},
   cleanup:{file:async()=>{f.state.permission=false;return {verified:true};},iam:async()=>{f.state.disabled=true;f.state.policy.bindings=[];return {verified:true};},
    oauth:async()=>{f.state.revoked.add("synthetic-owner-only");return {verified:true};}}};
  let issued=false;session.openWriter=async()=>{
   assert.equal(issued,false);issued=true;f.state.mints++;events.push("mint");
   session.tokenExpiresAtMillis=Date.now()+300000;
   session.sheetsAdapter=createShiftSheetsAdapter({config:createShiftSheetsConfig({environment:"develop",workbooks:{develop:FILE}}),sheets:batch.sheets});
   return {tokenExpiresAtMillis:session.tokenExpiresAtMillis,sheetsAdapter:session.sheetsAdapter};
  };return session;
 },openRecoverySession:async()=>{throw Error("No recovery fixture session");}}:f.sessions(data,"interactive-owner",{barrier,executor});
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),"interactive-window-"));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const fetchImpl=async(url,options)=>{
  if(url.startsWith("https://iamcredentials.googleapis.com/")){events.push("mint");f.state.now+=mintMillis;}
  return f.fetchImpl(url,options);
 };
 const before={shifts:await saved("shifts"),users:await saved("users"),notifications:await saved("notificationEvents"),sheet:structuredClone(batch.sheets.state)};
 return {f,prepared,data,events,observations,before,leases:()=>({opened,closed}),execute:()=>runControlledWindow({...data,...sessions,
  root:directory,nowMillis:clock,fetchImpl})};
}
run("slow mint expires the sixty-second admission before business writes and still cleans all access",async t=>{
 const h=await harness(t,{mintMillis:61000}),result=await h.execute();
 assert.equal(result.kind,"inspection-required");assert.equal(h.f.state.mints,1);assert.equal(h.f.batch.sheets.mutations.length,0);
 assert.deepEqual(await saved("shifts"),h.before.shifts);assert.equal((await db.doc(`${ROOT}/shiftPlanningState/current`).get()).exists,false);
 contained(h,result);
});
run("human/control observation latency can exhaust the final-manifest age without extending or retrying",async t=>{
 const h=await harness(t,{workObservationMillis:61000}),result=await h.execute();
 assert.equal(result.kind,"inspection-required");assert.equal(h.f.state.mints,1);assert.equal(h.f.batch.sheets.mutations.length,0);
 assert.deepEqual(await saved("shifts"),h.before.shifts);assert.equal((await db.doc(`${ROOT}/shiftPlanningState/current`).get()).exists,false);
 contained(h,result);
});
run("pre-mint admission denial contains the real acquired checkpoint without creating a writer token",async t=>{
 const h=await harness(t,{failAdmission:true}),result=await h.execute();
 assert.equal(result.kind,"inspection-required");assert.equal(h.f.state.mints,0);assert.equal(h.f.batch.sheets.mutations.length,0);
 assert.deepEqual(await saved("shifts"),h.before.shifts);assert.equal(h.observations.length,3);
 contained(h,result);
});

// The production reader validates one fixed logical project. This fixture maps
// only emulator document names to that logical namespace after an actual SDK
// read-only transaction; document data and service versions are never replaced.
async function actualCensus() {
 return db.runTransaction(async transaction=>{
  const intake=await transaction.get(db.doc("shiftPlanningDevelopIntake/current")),collections={};let readTime=intake.readTime;
  const logical=snapshot=>{const row=fromSnapshot(snapshot);row.name=row.name.replace(`projects/${migration.PROJECT_ID}/`,"projects/reguerta-9f27f/");return row;};
  for(const collection of ["shiftPlanningRequests","shifts","deliveryCalendar","notificationEvents"]){
   const rows=await transaction.get(db.collection(`${ROOT}/${collection}`).orderBy("__name__"));readTime=rows.readTime;
   collections[collection]=rows.docs.map(logical);
  }
  const stamp=t=>`${new Date(t.seconds*1000).toISOString().slice(0,19)}.${String(t.nanoseconds).padStart(9,"0")}Z`;
  const eventRows=await transaction.get(db.collection("shiftPlanningDevelopIntake/current/events").orderBy("__name__"));
  const deliveryRows=await transaction.get(db.collection("shiftPlanningDevelopIntake/current/deliveries").orderBy("__name__")),chunks={};
  for(const event of eventRows.docs){const rows=await transaction.get(event.ref.collection("chunks").orderBy("__name__"));chunks[logical(event).name]=rows.docs.map(logical);}
  readTime=deliveryRows.readTime;
  const control=logical(intake);
  return {schemaVersion:1,projectId:"reguerta-9f27f",readOnly:true,atomicSnapshot:true,readTime:stamp(readTime),canApply:false,canClaimClosure:false,
   intakeBefore:structuredClone(control),intakeAfter:control,collections,events:eventRows.docs.map(logical),deliveries:deliveryRows.docs.map(logical),chunks};
 },{readOnly:true});
}
async function realObserver(t,{f,prepared,scope,evidence},{owned=false,beforeRead=null}={}) {
  await db.doc("shiftPlanningDevelopIntake/current").create({schemaVersion:1,legacyUntracked:true,captureRevision:0,eventCount:0,deliveryCount:0});
  const initial=await actualCensus();await new Promise(resolve=>setTimeout(resolve,120));const final=await actualCensus();
  const deliveries=evidence.payload.causalDrain.containedDelivery.initial.deliveries.map(v=>({...v,pendingCount:null,inFlightCount:null}));
  const causal=containedEvidence({initial,final,classifiedCaptures:[],initialDeliveries:deliveries,finalDeliveries:deliveries});
  const p=evidence.payload,initialAt=Date.parse(initial.readTime),finalAt=Date.parse(final.readTime),at=Date.now();
  // Seed a separately synthetic current owner/admin agreement under a real clock.
  // This regression targets the real source-census guard, not the human UI.
  const move=value=>Array.isArray(value)?value.map(move):value&&typeof value==="object"?
   Object.fromEntries(Object.entries(value).map(([key,v])=>[key,key.endsWith("AtMillis")||key==="recoveryDeadlineMillis"?v===null?null:v+at-1000000:move(v)])):value;
  Object.assign(p,move(p));f.state.now=at;
  for(const key of ["ownerAgreement","administratorAgreement"]){
   const a=p[key];if(key==="administratorAgreement")a.payload.intent.ownerAgreementDigest=p.ownerAgreement.digest;
   for(const c of a.payload.confirmations)c.intentDigest=digest(a.payload.intent);a.digest=digest(a.payload);
  }
  p.administratorObservation.agreementDigest=p.administratorAgreement.digest;
  for(const c of p.writerControls.filter(c=>c.state==="agreement-recorded")){
   const a=c.writerId.startsWith("workbook")?p.ownerAgreement:p.administratorAgreement;c.controlDigest=c.initialReadBackDigest=c.finalReadBackDigest=a.digest;
  }
  p.ownerObservation.observedAtMillis=p.administratorObservation.observedAtMillis=at;
  p.workbook.capturedAtMillis=initialAt;p.workbook.readBackAtMillis=p.rules.finalReadBackAtMillis=finalAt;
  for(const c of p.writerControls)c.finalReadBackAtMillis=finalAt;
  Object.assign(p.causalDrain,{capturedAtMillis:initialAt,initialQueueReadBackAtMillis:initialAt,finalQueueReadBackAtMillis:finalAt,
   containedDelivery:causal.evidence,acceptedSetDigest:causal.acceptedSetDigest,initialPendingDeliveryCount:null,initialInFlightDeliveryCount:null,
   finalPendingDeliveryCount:null,finalInFlightDeliveryCount:null});
  Object.assign(p.causalDrain.historicalRisk,{assessedAtMillis:initialAt,causalSetDigest:causal.acceptedSetDigest});
  p.quietHorizon.startedAtMillis=initialAt;p.quietHorizon.endedAtMillis=finalAt;p.verifiedAtMillis=at;
  Object.assign(scope,{expectedOwnerAgreementDigest:p.ownerAgreement.digest,expectedAdministratorAgreementDigest:p.administratorAgreement.digest,
   expectedControlManifestDigest:manifest(p.writerControls,p.maintenanceMode),expectedHistoricalRiskDigest:digest(p.causalDrain.historicalRisk),
   expectedCausalSetDigest:causal.acceptedSetDigest});evidence.digest=digest(p);
  const prefix="projects/reguerta-9f27f/locations/europe-west1";
  const cloud={projectId:"reguerta-9f27f",readOnly:true,functions:Array.from({length:24},(_,i)=>({data:{name:`${prefix}/functions/fn${i}`}})),
   jobs:Array.from({length:3},(_,i)=>({data:{name:`${prefix}/jobs/job${i}`,state:"PAUSED"}})),rulesRelease:{data:{rulesetName:"projects/reguerta-9f27f/rulesets/test-rules"}},
   ruleset:{data:{name:"rules"}},projectIam:{data:{bindings:[]}},invokerPolicy:{data:{bindings:[]}}};
  const after={file:{id:FILE,version:"287",owners:[],parents:[]},parent:{id:"parent",owners:[]},filePermissions:[],parentPermissions:[]};
  const image={fileId:FILE,snapshot:{state:"pre-Sheets-image"},snapshotDigest:digest({state:"pre-Sheets-image"}),after,metadataDigest:metadataFingerprint(after)};
  const review={scopeDigest:digest(scope),evidence,cloud,owner:image,census:initial,classifiedCaptures:[],deliveries};
  const fetchImpl=async url=>{
   const data=cloud.functions.find(x=>url.endsWith(x.data.name))?.data??cloud.jobs.find(x=>url.endsWith(x.data.name))?.data??
    (url.includes("/releases/")?cloud.rulesRelease.data:url.includes("/rulesets/")?cloud.ruleset.data:{bindings:[]});
   return new Response(JSON.stringify(data));
  };
  const now=Date.now(),budget=createCopyTimeBudget({startsAtMillis:now,endsAtMillis:now+600000,nowMillis:Date.now,fetchImpl});
  let executor;
  const observers=createBarrierObservationSessions({scope,review,reviewDigest:digest(review),timeBudget:budget,iamBearer:"fixture-only",nowMillis:Date.now,
   ...(owned?{prepared,inspectCommitted:async({scope,receipt})=>{assert.ok(executor);return executor.inspectUncertain({scope,direction:receipt.direction});}}:{}),
   owner:{capture:async()=>({...image,startedAtMillis:Date.now(),observedAtMillis:Date.now()})},getPermissionTransition:()=>({before:image,after:image}),
   assertWriterAuthority:async()=>{},readCensus:actualCensus,readHumanReports:async()=>({
    ownerObservation:{...p.ownerObservation,observedAtMillis:Date.now()},administratorObservation:{...p.administratorObservation,observedAtMillis:Date.now()}}),record:async()=>{}});
  t.after(()=>observers.close());
  return {bindExecutor:value=>{executor=value;},initialCensus:initial,async observe(context){
   if(beforeRead)await beforeRead(context);
   const lease=await observers.openObservationSession(scope);
   try{return await lease.readCooperativeObservation(context);}finally{await lease.close();}
  }};
}
run("real census observer rejects the migration's own committed afterimage before the Sheets batch",async t=>{
 let sourceBlocker=null,actualRowsAfterCommit=null,observerReads=0,observeDirect=null;
 const h=await harness(t,{configureObservation:async args=>{
  const observer=await realObserver(t,args);
  observeDirect=async()=>{
   observerReads++;
   try{return await observer.observe();}
   catch(error){sourceBlocker=error.message;actualRowsAfterCommit=(await db.collection(`${ROOT}/shifts`).get()).size;throw error;}
  };
  return observeDirect;
 }});
 const result=await h.execute();
 assert.equal(result.kind,"inspection-required");assert.match(sourceBlocker,/sources changed/);assert.equal(actualRowsAfterCommit,72);
 assert.ok(observerReads>=8);assert.equal(h.f.state.mints,1);assert.equal(h.f.batch.sheets.mutations.length,0);
 assert.equal((await saved("shifts")).length,72);assert.deepEqual(await saved("notificationEvents"),h.before.notifications);
 const committed=await db.doc(`${ROOT}/shiftPlanningOperations/${h.prepared.operationId}`).get();
 assert.equal(committed.exists,true);assert.equal(committed.get("forwardManifestDigest"),h.prepared.preparedDigest);
 assert.equal(committed.get("publicMutations").length,72);
 contained(h,result);
 const records=readWindowJournal(result.directory).records.map(r=>r.value);
 assert.equal(records.find(r=>r.phase==="admission").admission.finalManifest.transaction.measurement.documentWriteCount,203);
 assert.equal(records.some(r=>r.phase==="google-batch-dispatch-intent"),false);
 const changed=db.doc(`${ROOT}/shifts/${h.prepared.content.shifts[0].id}`);await changed.update({unreviewedLateChange:true});
 await assert.rejects(observeDirect(),/sources changed/);assert.equal((await changed.get()).get("unreviewedLateChange"),true);
 if(process.env.HU084_AFTERIMAGE_BLOCKER_OUTPUT){
  assert.ok(path.isAbsolute(process.env.HU084_AFTERIMAGE_BLOCKER_OUTPUT));
  fs.writeFileSync(process.env.HU084_AFTERIMAGE_BLOCKER_OUTPUT,JSON.stringify({kind:"real-observer-afterimage-blocker",node:process.version,
   firestore:"actual SDK against fixed emulator",googleAndHumanPorts:"explicit read-only doubles",realCensusObserver:true,
   logicalProjectMapping:"demo document names mapped to fixed logical develop project only in fixture",sourceVersionsPreserved:true,
   terminal:result.kind,blocker:sourceBlocker,committedFirestoreWrites:203,canonicalRowsRetained:72,sheetsBatches:0,writerTokens:1,
   observerReads,unexpectedLateChangeStillRejectedAndPreserved:true,cleanupFailures:result.cleanup.failures,
   liveCalls:false,canEnterMaintenance:false,nextAttemptReady:false},null,2),{mode:0o600,flag:"wx"});
 }
});

const sha=value=>createHash("sha256").update(value).digest("hex");
async function retainCapture(before,after,{metadataVariant=false,id="owned-capture-1"}={}) {
 const event={specversion:"1.0",id,source:"//firestore.googleapis.com/projects/reguerta-9f27f/databases/(default)",
  type:"google.cloud.firestore.document.v1.written",subject:`documents/${after.ref.path}`,time:new Date().toISOString(),
  params:{env:"develop",shiftId:after.ref.id},data:{before,after}};
 const encoded=encodeDevelopShiftEvent("reguerta-9f27f","onShiftWritten",event);
 const root=db.doc("shiftPlanningDevelopIntake/current"),eventRef=root.collection("events").doc(encoded.eventKey);
 await db.runTransaction(async tx=>{
  const current=await tx.get(root),data=current.data();
  tx.create(eventRef,{schemaVersion:1,coreDigest:encoded.coreDigest,path:encoded.path,entryPoint:"onShiftWritten",state:"retained",
   envelopeDigest:sha(encoded.envelope),chunkCount:1,replayable:false});
  tx.create(eventRef.collection("chunks").doc("0"),{bytes:Buffer.from(encoded.envelope)});
  tx.create(root.collection("deliveries").doc(encoded.deliveryKey),{schemaVersion:1,eventKey:encoded.eventKey,digest:encoded.deliveryDigest,...encoded.delivery});
  tx.update(root,{captureRevision:data.captureRevision+1,eventCount:data.eventCount+1,deliveryCount:data.deliveryCount+1});
 });
 if(metadataVariant){
  const alternate=encodeDevelopShiftEvent("reguerta-9f27f","onShiftWritten",{...event,extension:"second receiver observation"});
  assert.equal(alternate.eventKey,encoded.eventKey);const key=sha(JSON.stringify({baseDeliveryKey:encoded.deliveryKey,metadataDigest:alternate.deliveryDigest}));
  await db.runTransaction(async tx=>{const current=await tx.get(root),data=current.data();
   tx.create(root.collection("deliveries").doc(key),{schemaVersion:2,baseDeliveryKey:encoded.deliveryKey,eventKey:encoded.eventKey,digest:alternate.deliveryDigest,...alternate.delivery});
   tx.update(root,{captureRevision:data.captureRevision+1,deliveryCount:data.deliveryCount+1});
  });
 }
 return encoded;
}
async function physicalOwnedHarness(t,{fault=null,withCapture=false,fullObservationDelayMillis=0}={}) {
 const state={proofs:[],actualReads:0,injected:false,failures:[]};
 const h=await harness(t,{observationMillis:0,workObservationMillis:0,physicalClock:true,configureObservation:async args=>{
  const target=db.doc(`${ROOT}/shifts/${args.prepared.content.shifts[0].id}`),before=await target.get();assert.equal(before.exists,false);
  const observer=await realObserver(t,args,{owned:true,beforeRead:async context=>{
   if(fullObservationDelayMillis)await new Promise(resolve=>setTimeout(resolve,fullObservationDelayMillis));
   if(state.injected||context?.phase!=="final"||!context.operationResult?.receiptDigest)return;
   state.injected=true;
   if(fault==="field")await target.update({unreviewedLateChange:true});
   if(fault==="version") {const prior=await target.get();await target.update({temporaryABA:true});await target.set(prior.data());}
   if(fault==="source")await db.doc(`${ROOT}/notificationEvents/unreviewed`).create({body:"Unexpected source"});
   if(fault==="capture"){
    const unknown=db.doc(`${ROOT}/shifts/unreviewed-capture-only`),stamp=Timestamp.now();
    const prior={ref:unknown,exists:true,createTime:stamp,updateTime:stamp,readTime:stamp,data:()=>({unknown:true})},absent=await unknown.get();
    await retainCapture(prior,absent,{id:"unreviewed-capture"});
   }
   if(withCapture)await retainCapture(before,await target.get(),{metadataVariant:true});
  }});
  return {bindExecutor:observer.bindExecutor,observe:async context=>{
   state.actualReads++;
   try{
    const value=await observer.observe(context);
    if(value.kind==="owned-develop-transition-observation")state.proofs.push(value.proof);
    return value;
   }catch(error){
    state.failures.push({phase:context?.phase??null,ownedReceipt:!!context?.operationResult?.receiptDigest,
     name:error.name,code:error.code??null,message:String(error.message).slice(0,500),
     stack:String(error.stack).split("\n").slice(0,8).join("\n")});
    throw error;
   }
  }};
 }});
 return {...h,ownedState:state};
}
for(const withCapture of [false,true])run(`real observer accepts only the exact owned afterimage and completes Sheets (${withCapture?"owned capture and metadata observation":"capture not yet observed"})`,async t=>{
 const phaseDelay=withCapture?12000:0,h=await physicalOwnedHarness(t,{withCapture,fullObservationDelayMillis:phaseDelay}),result=await h.execute();
 assert.equal(result.kind,"direction-verified-and-contained",JSON.stringify({kind:result.kind,failure:result.failure,resultKind:result.result?.kind,
  phase:result.result?.phase,cleanup:result.cleanup,observerFailures:h.ownedState.failures}));
 assert.equal(h.f.state.mints,1);assert.equal(h.f.batch.sheets.mutations.length,1);contained(h,result);
 assert.equal(h.ownedState.actualReads,8);assert.equal(h.ownedState.proofs.length,1);
 const proof=h.ownedState.proofs[0];assert.notEqual(proof.currentSourceSetDigest,proof.baselineSourceSetDigest);
 assert.equal(proof.baselineCausalSetDigest,h.data.scope.expectedCausalSetDigest);
 assert.equal(proof.ownedObservedCaptureCount,withCapture?1:0);assert.equal(proof.currentCaptureRevision,withCapture?2:0);
 assert.equal(proof.pendingDeliveryCount,null);assert.equal(proof.inFlightDeliveryCount,null);assert.equal(proof.deliveryCompleteness,"not-claimed");
 assert.equal(result.result.firestoreReceipt.measurement.documentWriteCount,203);assert.equal(result.result.plan.requests.filter(r=>r.updateCells).length,53);
 assert.equal(result.result.plan.requests.length,55);assert.equal((await saved("shifts")).length,72);
 assert.deepEqual(await saved("notificationEvents"),h.before.notifications);
 const shifts=(await db.collection(`${ROOT}/shifts`).get()).docs.map(d=>d.data());
 for(const expected of h.prepared.content.shifts){
  const row=shifts.find(s=>s.type===expected.type&&s.date.toDate().toISOString().slice(0,10)===expected.date);assert.ok(row);
  assert.deepEqual(row.type==="delivery"?[row.rotationOwnerUserId]:row.rotationOwnerUserIds,expected.rotationOwnerUserIds);
 }
 const stages=result.cleanup.report.stages,work=stages.find(s=>s.phase==="work"),cleanup=stages.find(s=>s.phase==="file-cleanup");
 assert.ok(cleanup.startedAtMillis-work.startedAtMillis<150000);assert.deepEqual(result.cleanup.report.breaches,[]);
 if(process.env.HU084_OWNED_OBSERVER_OUTPUT&&withCapture){
  assert.ok(path.isAbsolute(process.env.HU084_OWNED_OBSERVER_OUTPUT));
  fs.writeFileSync(process.env.HU084_OWNED_OBSERVER_OUTPUT,JSON.stringify({kind:"real-observer-owned-afterimage-local-acceptance",node:process.version,
   firestore:"actual SDK against fixed emulator",clock:"actual wall clock",observer:"actual complete phase observer and owned transition verifier",
   lifecyclePorts:"explicit doubles; original IAM/native lifecycle separately tested with fake clock",googleAndHumanPorts:"read-only doubles",
   fullObservations:8,phaseDelayMillis:phaseDelay,delayIsSimulatedProviderAndHumanLatency:true,googleLatencyAcceptance:false,
   ownedProof:proof,firestoreWrites:203,helperCells:53,markers:2,sourceRows:72,noticesPreserved:true,datesAndOwnerOrderPreserved:true,
   stages,workElapsedMillis:cleanup.startedAtMillis-work.startedAtMillis,
   sheetsBatches:1,writerTokens:1,cleanupFailures:result.cleanup.failures,liveCalls:false},null,2),{mode:0o600,flag:"wx"});
 }
});
for(const fault of ["field","version","source","capture"])run(`real owned observer rejects ${fault} drift after the committed write without sending Sheets`,async t=>{
 const h=await physicalOwnedHarness(t,{fault}),result=await h.execute();
 assert.equal(result.kind,"inspection-required");assert.equal(h.f.state.mints,1);assert.equal(h.f.batch.sheets.mutations.length,0);contained(h,result);
 assert.equal((await saved("shifts")).length,72);assert.equal(h.ownedState.proofs.length,0);
 if(fault==="field")assert.equal((await db.doc(`${ROOT}/shifts/${h.prepared.content.shifts[0].id}`).get()).get("unreviewedLateChange"),true);
 if(fault==="source")assert.equal((await db.doc(`${ROOT}/notificationEvents/unreviewed`).get()).exists,true);
 if(fault==="capture")assert.equal((await db.collection("shiftPlanningDevelopIntake/current/events").get()).size,1);
});
