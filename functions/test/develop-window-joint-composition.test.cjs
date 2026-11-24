'use strict';
// Real local runner/session/controlled executor/engine with Firestore emulator.
// Google, human observations and Sheets use explicit synthetic clocked doubles.
const {test,before,beforeEach,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Firestore,Timestamp}=require('@google-cloud/firestore');
const {createShiftPlanningDigest:digest}=require('../lib/shift-planning-digest.js');
const {decodeShiftPlanningFirestoreMutations,prepareShiftPlanningFirestoreTransaction}=require('../lib/shift-planning-firestore-transaction-manifest.js');
const {createShiftPlanningControlManifestDigest:manifest}=require('../lib/shift-planning-intake-barrier.js');
const {createFirestoreShiftPlanningIntakeBarrierRepository:repository}=require('../lib/shift-planning-firestore-intake-barrier-repository.js');
const {batchFixture}=require('./develop-helper-batch-fixture.cjs'),{originalWindowFixture}=require('./develop-original-window-fixture.cjs'),{historicalFixture}=require('./develop-historical-risk-fixture.cjs'),{fromSnapshot}=require('./develop-shift-migration-fixture.cjs');
const {materializeDevelopMigrationPreparation}=require('../scripts/materialize-develop-migration-package.cjs');
const migration=require('../scripts/rehearse-develop-shift-migration.cjs'),{historicalMigrationPlanBindings}=require('../scripts/develop-shift-migration-engine.cjs');
const {createControlledDevelopMigrationEmulator}=require('../scripts/controlled-develop-migration.cjs'),{createControlledDevelopBarrierEmulator}=require('../scripts/controlled-develop-barrier.cjs');
const {runControlledWindow}=require('../scripts/develop-controlled-window.cjs'),{wrapClosingSession}=require('../scripts/develop-window-session-closure.cjs'),{readWindowJournal}=require('../scripts/develop-window-journal.cjs');
const {FILE}=require('../scripts/develop-original-writer-provider.cjs');
const {prepareDevelopContainedDeliveryEvidence:contained}=require('../scripts/observe-develop-capture-controls.cjs');
const {verifyDevelopOwnedTransitionObservation:verifyOwned}=require('../scripts/develop-owned-transition-observation.cjs');
const enabled=process.env.GCLOUD_PROJECT===migration.PROJECT_ID&&process.env.FIRESTORE_EMULATOR_HOST===migration.HOST,ROOT='develop/plus-collections',MODE='original-develop-deferred-writer-v1';
let db;
before(()=>{if(enabled)db=new Firestore({projectId:migration.PROJECT_ID,host:migration.HOST,ssl:false});});
beforeEach(async()=>{if(enabled)assert.equal((await fetch(`http://${migration.HOST}/emulator/v1/projects/${migration.PROJECT_ID}/databases/(default)/documents`,{method:'DELETE'})).ok,true);});
after(async()=>{if(db)await db.terminate();});
function evidenceFor(f,prepared,source){
 const h=historicalFixture({transitionId:prepared.operationId,expectedAuthoritativeDigest:source.sourceDigest,expectedStateRevision:source.maintenance.stateRevision,expectedWriteEpoch:source.maintenance.writeEpoch,expectedActiveRevision:source.maintenance.activeRevision,expectedActiveDigest:source.maintenance.activeDigest,expectedWorkbookFileId:FILE,expectedWorkbookRevision:f.batch.sourceInput.fileAfter.data.version});
 const offset=f.state.now-265000,shift=value=>Array.isArray(value)?value.map(shift):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,k.endsWith('AtMillis')||k==='recoveryDeadlineMillis'?v===null?null:v*500+offset:shift(v)])):value;
 const p=shift(h.evidence.payload),end=f.state.now+1200000;p.policy.maximumEvidenceAgeMillis=600000;h.scope.maximumEvidenceAgeMillis=600000;
 for(const key of ['ownerAgreement','administratorAgreement']){const a=p[key];a.payload.intent.endsAtMillis=end;a.payload.intent.recoveryDeadlineMillis=end;if(key==='administratorAgreement')a.payload.intent.ownerAgreementDigest=p.ownerAgreement.digest;for(const c of a.payload.confirmations)c.intentDigest=digest(a.payload.intent);a.digest=digest(a.payload);}
 p.administratorObservation.agreementDigest=p.administratorAgreement.digest;for(const c of p.writerControls.filter(c=>c.state==='agreement-recorded')){const a=c.writerId.startsWith('workbook')?p.ownerAgreement:p.administratorAgreement;c.controlDigest=c.initialReadBackDigest=c.finalReadBackDigest=a.digest;}
 Object.assign(p.causalDrain.historicalRisk,historicalMigrationPlanBindings(prepared),{direction:'forward',migrationOperationId:prepared.operationId,recoveryOperationId:prepared.recoveryOperationId,expiresAtMillis:end});
 Object.assign(h.scope,{expectedOwnerAgreementDigest:p.ownerAgreement.digest,expectedAdministratorAgreementDigest:p.administratorAgreement.digest,expectedControlManifestDigest:manifest(p.writerControls,p.maintenanceMode),expectedHistoricalRiskDigest:digest(p.causalDrain.historicalRisk)});
 return {scope:h.scope,seed:{payload:p,digest:digest(p)}};
}
// The emulator provides real document values and versions. Only the transaction
// readTime is mapped to the test's virtual clock; no manifest timestamp is changed.
async function censusAt(now){
 return db.runTransaction(async tx=>{
  const intake=await tx.get(db.doc('shiftPlanningDevelopIntake/current')),collections={};
  const logical=snapshot=>{const row=fromSnapshot(snapshot);row.name=row.name.replace(`projects/${migration.PROJECT_ID}/`,'projects/reguerta-9f27f/');return row;};
  for(const name of ['shiftPlanningRequests','shifts','deliveryCalendar','notificationEvents']){const rows=await tx.get(db.collection(`${ROOT}/${name}`).orderBy('__name__'));collections[name]=rows.docs.map(logical);}
  const events=await tx.get(db.collection('shiftPlanningDevelopIntake/current/events').orderBy('__name__')),deliveries=await tx.get(db.collection('shiftPlanningDevelopIntake/current/deliveries').orderBy('__name__')),chunks={};
  for(const event of events.docs){const rows=await tx.get(event.ref.collection('chunks').orderBy('__name__'));chunks[logical(event).name]=rows.docs.map(logical);}
  const readTime=new Date(now).toISOString().replace(/\.(\d{3})Z$/,(_,ms)=>'.'+ms+'000000Z'),control=logical(intake);
  return {schemaVersion:1,projectId:'reguerta-9f27f',readOnly:true,atomicSnapshot:true,readTime,canApply:false,canClaimClosure:false,intakeBefore:structuredClone(control),intakeAfter:control,collections,events:events.docs.map(logical),deliveries:deliveries.docs.map(logical),chunks};
 },{readOnly:true});
}
function withDifferentAdmittedShift(admission){
 const {admissionDigest:originalAdmissionDigest,finalManifest,...admitted}=admission;
 const {finalDigest:originalManifestDigest,transaction,...manifestBody}=finalManifest;
 const measure=transaction.measurement,mutations=decodeShiftPlanningFirestoreMutations(transaction);
 const shift=mutations.find(item=>item.kind==='create'&&item.documentPath.startsWith(`${ROOT}/shifts/`));
 assert.equal(shift.data.assignmentRevision,1);
 shift.data.assignmentRevision=2;
 const revisedTransaction=prepareShiftPlanningFirestoreTransaction({
  direction:measure.direction,manifestDigest:measure.manifestDigest,mutations,expectedDocumentWriteCount:measure.documentWriteCount,
  authority:{adapterRevision:measure.adapterRevision,indexConfigurationDigest:measure.indexConfigurationDigest}
 });
 const revisedManifest={...manifestBody,transaction:revisedTransaction};
 const revisedAdmission={...admitted,finalManifest:{...revisedManifest,finalDigest:digest(revisedManifest)}};
 assert.notEqual(originalManifestDigest,revisedAdmission.finalManifest.finalDigest);
 const admissionDigest=digest(revisedAdmission);
 assert.notEqual(originalAdmissionDigest,admissionDigest);
 return {...revisedAdmission,admissionDigest};
}
async function fixture(t,{humanDelayMillis=1000,finalReportDelayMillis=1000,transactionAgeMillis=null,driftAt=null,changeAdmittedShift=false}={}){
 const batch=batchFixture(),f=originalWindowFixture({batch}),seed=db.batch();f.state.now=Date.now()+300000;
 for(const collection of ['shifts','users','deliveryCalendar','notificationEvents','config'])for(const row of batch.sourceInput.snapshot.collections[collection])seed.create(db.doc(row.name.split('/documents/')[1]),Object.fromEntries(Object.entries(row.fields).map(([key,value])=>[key,migration.decodeRESTValue(value)])));
 await seed.commit();await db.doc('shiftPlanningDevelopIntake/current').create({schemaVersion:1,legacyUntracked:true,captureRevision:0,eventCount:0,deliveryCount:0});const cloneCapture={projectId:migration.PROJECT_ID,environment:'develop',documents:[],guardCollections:{}};
 for(const collection of ['shifts','users','deliveryCalendar','notificationEvents','config']){const rows=(await db.collection(`${ROOT}/${collection}`).orderBy('__name__').get()).docs.map(fromSnapshot);if(collection==='shifts')cloneCapture.documents=rows;else cloneCapture.guardCollections[collection]=rows;}
 const prepared=materializeDevelopMigrationPreparation({sourceInput:batch.sourceInput,reviewPackage:batch.reviewPackage,cloneCapture}),journal=repository(db,()=>Timestamp.fromMillis(f.state.now));
 const unavailable=async()=>{throw Error('No unscoped provider read');};
 const passive=createControlledDevelopMigrationEmulator({firestore:db,prepared,nowMillis:()=>f.state.now,controlPlane:{readBackClosed:unavailable,readBackOwnerObservation:unavailable,readBackAdministratorObservation:unavailable},failurePersistence:journal});
 const source=(await passive.inspectAdmission()).source,{scope,seed:evidence}=evidenceFor(f,prepared,source),baseline=await censusAt(f.state.now-40000),baselineFinal={...structuredClone(baseline),readTime:new Date(f.state.now-10000).toISOString().replace(/\.(\d{3})Z$/,(_,ms)=>'.'+ms+'000000Z')},state={inAdmission:false,admissionReads:0,human:[],wrapped:null,writerFieldsObserved:false,closing:0,engineError:null,barrierError:null,ownedProofs:0,writerCompletedAt:null,sheetsHeadroomMillis:null,casAt:null,lastPreWriteReportAt:null,executionManifestAt:null,transactionAge:null,enqueuedTargets:[],changedConfigPath:null};
 const deliveries=evidence.payload.causalDrain.containedDelivery.initial.deliveries.map(v=>({...v,pendingCount:null,inFlightCount:null})),causal=contained({initial:baseline,final:baselineFinal,classifiedCaptures:[],initialDeliveries:deliveries,finalDeliveries:deliveries}),initialAt=Date.parse(baseline.readTime),payload=evidence.payload;
 Object.assign(payload.causalDrain,{capturedAtMillis:initialAt,initialQueueReadBackAtMillis:initialAt,finalQueueReadBackAtMillis:Date.parse(baselineFinal.readTime),containedDelivery:causal.evidence,acceptedSetDigest:causal.acceptedSetDigest});
 const deliveryCount=require('../lib/shift-planning-contained-delivery.js').containedDeliveryCount;for(const side of ['initial','final'])for(const [field,total] of [['pendingCount','PendingDeliveryCount'],['inFlightCount','InFlightDeliveryCount']])payload.causalDrain[side+total]=deliveryCount(causal.evidence[side],field);
 Object.assign(payload.causalDrain.historicalRisk,{assessedAtMillis:initialAt,causalSetDigest:causal.acceptedSetDigest});payload.workbook.capturedAtMillis=initialAt;payload.quietHorizon.startedAtMillis=initialAt;payload.quietHorizon.endedAtMillis=initialAt+30000;payload.verifiedAtMillis=f.state.now;
 Object.assign(scope,{expectedCausalSetDigest:causal.acceptedSetDigest,expectedHistoricalRiskDigest:digest(payload.causalDrain.historicalRisk)});evidence.digest=digest(payload);
 const command={...scope};delete command.writerInventoryRevision;delete command.writerInventoryDigest;try{require('../lib/shift-planning-intake-barrier.js').verifyShiftPlanningAdministratorAgreementIntakeBarrierEvidence(evidence,command,f.state.now);}catch(error){throw Error(JSON.stringify({message:error.message,now:f.state.now,rules:payload.rules,causal:{captured:payload.causalDrain.capturedAtMillis,assessed:payload.causalDrain.historicalRisk.assessedAtMillis,initial:payload.causalDrain.initialQueueReadBackAtMillis,final:payload.causalDrain.finalQueueReadBackAtMillis},workbook:payload.workbook,quiet:payload.quietHorizon,verified:payload.verifiedAtMillis}));}
 async function changeSource(){
  const config=batch.sourceInput.snapshot.collections.config[0];
  state.changedConfigPath=config.name.split('/documents/')[1];
  await db.doc(state.changedConfigPath).update({observedExternalChange:true});
 }
 let executor;
 async function fresh(context){
  if(state.inAdmission&&state.admissionReads<3){state.admissionReads++;for(const ms of [14686,state.admissionReads===3?14685:14686]){f.state.now+=ms;state.human.push({kind:'synthetic-admission-report',at:f.state.now});}}
  else if(f.state.mints>0){
   const initial=context?.phase==='initial';
   f.state.now+=initial?humanDelayMillis:finalReportDelayMillis;
   state.human.push({kind:'synthetic-post-mint-report',phase:context?.phase??'failure-closure',at:f.state.now});
   if(initial){
    state.lastPreWriteReportAt=f.state.now;
    if(driftAt==='last-human-report')await changeSource();
   }
  }
  else f.state.now+=1000;
  const p=structuredClone(evidence.payload),at=f.state.now;p.ownerObservation.observedAtMillis=p.administratorObservation.observedAtMillis=at;
  p.rules.finalReadBackAtMillis=p.workbook.readBackAtMillis=p.causalDrain.finalQueueReadBackAtMillis=at;p.causalDrain.containedDelivery.final.observedAtMillis=at;
  for(const c of p.writerControls)c.finalReadBackAtMillis=at;p.verifiedAtMillis=at;
  if(context?.phase==='final'&&context.operationResult?.receiptDigest){const retainedInspection=await executor.inspectUncertain({scope,direction:'forward'}),currentCensus=await censusAt(f.state.now),proof=verifyOwned({prepared,scope,baselineCensus:baseline,currentCensus,callbackReceipt:context.operationResult,retainedInspection,classifiedCaptures:[]});state.ownedProofs++;return {kind:'owned-develop-transition-observation',proof,ownerObservation:p.ownerObservation,administratorObservation:p.administratorObservation};}
  return {payload:p,digest:digest(p)};
 }
 const barrier=createControlledDevelopBarrierEmulator({firestore:db,prepared,nowMillis:()=>f.state.now,coherentObservations:true,openObservationSession:async()=>({readEvidence:fresh,readCooperativeObservation:async context=>{const value=await fresh(context);return value.kind?value:{kind:'complete-develop-barrier-observation',evidence:value};},readOwnerObservation:unavailable,readAdministratorObservation:unavailable,close:async()=>{}})});
 const acquire=barrier.acquire;barrier.acquire=async args=>{try{return await acquire(args);}catch(error){state.barrierError={name:error.name,message:error.message};throw error;}};
 executor=createControlledDevelopMigrationEmulator({firestore:db,prepared,nowMillis:()=>f.state.now,controlPlane:barrier.controlPlane,failurePersistence:barrier.failurePersistence});
 const inspect=executor.inspectAdmission;executor.inspectAdmission=async args=>{state.inAdmission=true;try{return await inspect(args);}finally{state.inAdmission=false;}};
 const executeFirestore=executor.execute;executor.execute=async args=>{try{return await executeFirestore(args);}catch(error){state.engineError={name:error.name,message:error.message};throw error;}};
 const execute=executor.executeJoint;
 executor.executeJoint=async args=>{
  assert.ok(state.wrapped.tokenExpiresAtMillis>f.state.now);
  assert.strictEqual(args.sheetsAdapter,state.wrapped.sheetsAdapter);
  state.writerFieldsObserved=true;
  const admission=changeAdmittedShift?withDifferentAdmittedShift(args.admission):args.admission;
  return execute({...args,admission,record:async event=>{
   await args.record(event);
   if(event.phase==='forward-execution-manifest'){
    assert.equal(state.executionManifestAt,null);
    state.executionManifestAt=timestampMillis(event.finalManifest.attemptedAt);
    if(driftAt==='sealed-execution-manifest')await changeSource();
   }
  }});
 };
 const data={...f.args(),prepared,scope,executionMode:MODE,window:{startsAtMillis:f.state.now,endsAtMillis:f.state.now+1200000},receiptId:'joint-composition-synthetic'},sessions=f.sessions(data,'joint-composition-owner',{barrier,executor});
 const openSession=async context=>{
  const session=await sessions.openSession({...context,record:async event=>{
   await context.record(event);
   if(event.phase==='google-batch-dispatch-intent'){
    state.sheetsHeadroomMillis=context.timeBudget.currentStageDeadlineMillis()-f.state.now;
   }
  }});
  const openWriter=session.openWriter;
  session.openWriter=async args=>{
   f.state.now+=16468;
   const writer=await openWriter(args);
   state.writerCompletedAt=f.state.now;
   return writer;
  };
  state.wrapped=wrapClosingSession(session,{human:{beginClosing(){state.closing++;}},
   native:{beginClosing(){},isInFlight(){return false;}}});
  return state.wrapped;
 };
 const originalTransaction=db.runTransaction.bind(db);
 db.runTransaction=async(callback,...args)=>{
  f.state.now+=1000;
  if(state.executionManifestAt!==null&&state.transactionAge===null&&args[0]?.readOnly!==true){
   if(transactionAgeMillis!==null){
    const next=state.executionManifestAt+transactionAgeMillis;
    assert.ok(next>=f.state.now,'The synthetic clock must only move forward');
    f.state.now=next;
   }
   state.transactionAge=f.state.now-state.executionManifestAt;
  }
  return originalTransaction(async tx=>{
   for(const method of ['create','set','update','delete']){
    const write=tx[method].bind(tx);
    tx[method]=(...values)=>{
     const target=values[0].path;
     if(state.writerFieldsObserved&&!target.startsWith(`${ROOT}/shiftPlanningOperations/barrier-`)){
      state.casAt??=f.state.now;
      state.enqueuedTargets.push(target);
     }
     return write(...values);
    };
   }
   return callback(tx);
  },...args);
 };
 t.after(()=>{db.runTransaction=originalTransaction;});
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'joint-composition-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 return {f,state,execute:()=>runControlledWindow({...data,...sessions,openSession,root,nowMillis:()=>f.state.now,fetchImpl:f.fetchImpl})};
}
const run=(name,fn)=>test(name,{skip:!enabled},fn);
const timestampMillis=value=>new Timestamp(value.seconds,value.nanoseconds).toMillis();

function assertContained(f,result){
 assert.equal(f.f.state.mints,1);
 assert.equal(f.f.state.permission,false);
 assert.equal(f.f.state.disabled,true);
 assert.deepEqual(f.f.state.policy.bindings,[]);
 assert.ok(f.f.state.revoked.size>0);
 assert.deepEqual(result.cleanup.failures,[]);
 assert.equal(result.cleanup.report.inFlight,0);
 assert.deepEqual(result.cleanup.report.breaches,[]);
 assert.ok(f.state.closing>=3);
}

function journalOf(result){
 return readWindowJournal(result.directory).records.map(row=>row.value);
}

function assertBusinessSuccess(f,result,journal){
 assert.equal(result.kind,'direction-verified-and-contained',JSON.stringify({
  phase:result.result?.phase,engineError:f.state.engineError,barrierError:f.state.barrierError
 }));
 assert.equal(result.result.firestoreReceipt.measurement.documentWriteCount,203);
 assert.equal(result.result.firestoreReceipt.documents.length,203);
 assert.equal(new Set(f.state.enqueuedTargets).size,203);
 assert.equal(f.state.ownedProofs,1);
 const requests=result.result.plan.requests;
 assert.equal(requests.length,55);
 assert.equal(requests.filter(r=>r.updateCells).length,53);
 assert.equal(requests.filter(r=>r.createDeveloperMetadata).length,2);
 assert.equal(f.f.batch.sheets.mutations.length,1);
 assert.ok(f.state.sheetsHeadroomMillis>75000,'The work slot must retain its submission and readback reserve');
 for(const phase of ['firestore-receipt','google-batch-dispatch-intent','sheets-owner-readback','joint-result']){
  assert.ok(journal.some(event=>event.phase===phase),phase);
 }
 assertContained(f,result);
}

async function assertBusinessUntouched(f,result,journal){
 assert.equal(result.kind,'inspection-required');
 assert.equal(f.state.enqueuedTargets.length,0);
 assert.equal(f.f.batch.sheets.mutations.length,0);
 assert.equal(journal.some(e=>e.phase==='firestore-receipt'||e.phase==='google-batch-dispatch-intent'),false);
 const admission=journal.find(e=>e.phase==='admission').admission;
 const changes=JSON.parse(admission.finalManifest.transaction.serializedMutations);
 const docs=await db.getAll(...changes.map(change=>db.doc(change.documentPath)));
 let absent=0,retained=0;
 for(const [i,change] of changes.entries()){
  const doc=docs[i];
  assert.equal(doc.ref.path,change.documentPath);
  if(change.kind==='create'){
   assert.equal(doc.exists,false);
   absent++;
  }else{
   assert.equal(change.kind,'delete');
   assert.ok(doc.exists);
   assert.ok(doc.updateTime.isEqual(new Timestamp(change.precondition.seconds,change.precondition.nanoseconds)));
   retained++;
  }
 }
 assert.deepEqual({absent,retained},{absent:141,retained:62});
 assertContained(f,result);
}

run('the execution manifest follows the slow human report and authorizes one exact migration',async t=>{
 const f=await fixture(t,{humanDelayMillis:61000}), result=await f.execute(), journal=journalOf(result);
 assertBusinessSuccess(f,result,journal);
 const admission=journal.find(e=>e.phase==='admission').admission;
 const manifests=journal.filter(e=>e.phase==='forward-execution-manifest');
 assert.equal(manifests.length,1);
 const event=manifests[0], admitted=admission.finalManifest, executable=event.finalManifest;
 assert.equal(event.admissionDigest,admission.admissionDigest);
 assert.equal(event.admittedManifestDigest,admitted.finalDigest);
 for(const field of ['scopeDigest','direction','preparedDigest'])assert.equal(executable[field],admitted[field]);
 assert.notEqual(executable.finalDigest,admitted.finalDigest);
 const admissionTime=timestampMillis(admitted.attemptedAt);
 const executionTime=timestampMillis(executable.attemptedAt);
 assert.ok(f.state.lastPreWriteReportAt-admissionTime>60000);
 assert.ok(executionTime>=f.state.lastPreWriteReportAt);
 assert.ok(f.state.casAt>=executionTime&&f.state.casAt-executionTime<60000);
 assert.equal(f.state.admissionReads,3);
 assert.equal(f.state.human.filter(x=>x.kind==='synthetic-admission-report').length,6);
 assert.ok(admission.observedAtMillis-admission.collectionStartedAtMillis>=88115);
 assert.ok(admission.observedAtMillis-admission.startedAtMillis<=60000);
 assert.ok(f.state.writerCompletedAt-admission.observedAtMillis>=16468);
 t.diagnostic(JSON.stringify({admissionToHumanReplyMillis:f.state.lastPreWriteReportAt-admissionTime,
  humanReplyToManifestMillis:executionTime-f.state.lastPreWriteReportAt,manifestToFirstWriteMillis:f.state.casAt-executionTime,
  writes:f.state.enqueuedTargets.length,sheetsRequests:result.result.plan.requests.length,sheetsHeadroomMillis:f.state.sheetsHeadroomMillis}));
});

// In attempt 13 the second reply confirmed an incident. This scenario reuses
// its duration for a synthetic successful post-commit observation.
run('two separate post-mint replies retain the Sheets submission and readback reserve',async t=>{
 const humanDelayMillis=33886,finalReportDelayMillis=18245;
 const f=await fixture(t,{humanDelayMillis,finalReportDelayMillis});
 const result=await f.execute(),journal=journalOf(result);
 assertBusinessSuccess(f,result,journal);
 const reports=f.state.human.filter(e=>e.kind==='synthetic-post-mint-report');
 assert.deepEqual(reports.map(e=>e.phase),['initial','final']);
 assert.ok(reports[0].at<=f.state.executionManifestAt&&reports[1].at>=f.state.casAt+finalReportDelayMillis);
 t.diagnostic(JSON.stringify({humanDelayMillis,finalReportDelayMillis,sheetsHeadroomMillis:f.state.sheetsHeadroomMillis,
  requiredHeadroomMillis:75000,writes:f.state.enqueuedTargets.length,sheetsRequests:result.result.plan.requests.length}));
});

for(const age of [60000,60001]){
 run(`the execution manifest ${age===60000?'accepts':'rejects'} age ${age} ms before CAS`,async t=>{
  const f=await fixture(t,{transactionAgeMillis:age}),result=await f.execute(),journal=journalOf(result);
  assert.equal(f.state.transactionAge,age);
  assert.equal(journal.filter(e=>e.phase==='forward-execution-manifest').length,1);
  if(age===60000){
   assertBusinessSuccess(f,result,journal);
   assert.equal(f.state.casAt-f.state.executionManifestAt,age);
  }else{
   await assertBusinessUntouched(f,result,journal);
   assert.match(f.state.engineError?.message??'',/manifest expired|manifest.*deadline/i);
   const failures=journal.filter(event=>event.phase==='firestore-first-failure');
   assert.equal(failures.length,1);
   assert.equal(failures[0].failure.reason,'manifest-expired-or-future');
   assert.equal(failures[0].failure.observedAtMillis,f.state.executionManifestAt+age);
   assert.deepEqual(result.result.firstFirestoreFailure,failures[0].failure);
  }
 });
}

run('a different self-consistent admitted shift fails exact reconstruction on unchanged data',async t=>{
 const f=await fixture(t,{changeAdmittedShift:true}),result=await f.execute(),journal=journalOf(result);
 assert.ok(Number.isSafeInteger(f.state.lastPreWriteReportAt));
 assert.equal(f.state.executionManifestAt,null);
 assert.equal(f.state.changedConfigPath,null);
 assert.equal(result.result.firstFirestoreFailure.reason,'admitted-manifest-mismatch');
 await assertBusinessUntouched(f,result,journal);
});

for(const driftAt of ['last-human-report','sealed-execution-manifest']){
 run(`source change at the ${driftAt} prevents both business writes`,async t=>{
  const f=await fixture(t,{driftAt}),result=await f.execute(),journal=journalOf(result);
  assert.equal((await db.doc(f.state.changedConfigPath).get()).get('observedExternalChange'),true);
  assert.equal(journal.filter(e=>e.phase==='forward-execution-manifest').length,driftAt==='last-human-report'?0:1);
  await assertBusinessUntouched(f,result,journal);
 });
}
