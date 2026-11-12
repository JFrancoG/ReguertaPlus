'use strict';
// Real local runner/session/controlled executor/engine with Firestore emulator.
// Google, human observations and Sheets use explicit synthetic clocked doubles.
const {test,before,beforeEach,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Firestore,Timestamp}=require('@google-cloud/firestore');
const {createShiftPlanningDigest:digest}=require('../lib/shift-planning-digest.js');
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
async function fixture(t,{lateAfterMint=false}={}){
 const batch=batchFixture(),f=originalWindowFixture({batch}),seed=db.batch();f.state.now=Date.now()+300000;
 for(const collection of ['shifts','users','deliveryCalendar','notificationEvents','config'])for(const row of batch.sourceInput.snapshot.collections[collection])seed.create(db.doc(row.name.split('/documents/')[1]),Object.fromEntries(Object.entries(row.fields).map(([key,value])=>[key,migration.decodeRESTValue(value)])));
 await seed.commit();await db.doc('shiftPlanningDevelopIntake/current').create({schemaVersion:1,legacyUntracked:true,captureRevision:0,eventCount:0,deliveryCount:0});const cloneCapture={projectId:migration.PROJECT_ID,environment:'develop',documents:[],guardCollections:{}};
 for(const collection of ['shifts','users','deliveryCalendar','notificationEvents','config']){const rows=(await db.collection(`${ROOT}/${collection}`).orderBy('__name__').get()).docs.map(fromSnapshot);if(collection==='shifts')cloneCapture.documents=rows;else cloneCapture.guardCollections[collection]=rows;}
 const prepared=materializeDevelopMigrationPreparation({sourceInput:batch.sourceInput,reviewPackage:batch.reviewPackage,cloneCapture}),journal=repository(db,()=>Timestamp.fromMillis(f.state.now));
 const unavailable=async()=>{throw Error('No unscoped provider read');};
 const passive=createControlledDevelopMigrationEmulator({firestore:db,prepared,nowMillis:()=>f.state.now,controlPlane:{readBackClosed:unavailable,readBackOwnerObservation:unavailable,readBackAdministratorObservation:unavailable},failurePersistence:journal});
 const source=(await passive.inspectAdmission()).source,{scope,seed:evidence}=evidenceFor(f,prepared,source),baseline=await censusAt(f.state.now-40000),baselineFinal={...structuredClone(baseline),readTime:new Date(f.state.now-10000).toISOString().replace(/\.(\d{3})Z$/,(_,ms)=>'.'+ms+'000000Z')},state={inAdmission:false,admissionReads:0,human:[],afterMintReads:0,wrapped:null,writerFieldsObserved:false,closing:0,engineError:null,barrierError:null,ownedProofs:0,technicalTransactions:0,writerCompletedAt:null,casAt:null};
 const deliveries=evidence.payload.causalDrain.containedDelivery.initial.deliveries.map(v=>({...v,pendingCount:null,inFlightCount:null})),causal=contained({initial:baseline,final:baselineFinal,classifiedCaptures:[],initialDeliveries:deliveries,finalDeliveries:deliveries}),initialAt=Date.parse(baseline.readTime),payload=evidence.payload;
 Object.assign(payload.causalDrain,{capturedAtMillis:initialAt,initialQueueReadBackAtMillis:initialAt,finalQueueReadBackAtMillis:Date.parse(baselineFinal.readTime),containedDelivery:causal.evidence,acceptedSetDigest:causal.acceptedSetDigest});
 const deliveryCount=require('../lib/shift-planning-contained-delivery.js').containedDeliveryCount;for(const side of ['initial','final'])for(const [field,total] of [['pendingCount','PendingDeliveryCount'],['inFlightCount','InFlightDeliveryCount']])payload.causalDrain[side+total]=deliveryCount(causal.evidence[side],field);
 Object.assign(payload.causalDrain.historicalRisk,{assessedAtMillis:initialAt,causalSetDigest:causal.acceptedSetDigest});payload.workbook.capturedAtMillis=initialAt;payload.quietHorizon.startedAtMillis=initialAt;payload.quietHorizon.endedAtMillis=initialAt+30000;payload.verifiedAtMillis=f.state.now;
 Object.assign(scope,{expectedCausalSetDigest:causal.acceptedSetDigest,expectedHistoricalRiskDigest:digest(payload.causalDrain.historicalRisk)});evidence.digest=digest(payload);
 const command={...scope};delete command.writerInventoryRevision;delete command.writerInventoryDigest;try{require('../lib/shift-planning-intake-barrier.js').verifyShiftPlanningAdministratorAgreementIntakeBarrierEvidence(evidence,command,f.state.now);}catch(error){throw Error(JSON.stringify({message:error.message,now:f.state.now,rules:payload.rules,causal:{captured:payload.causalDrain.capturedAtMillis,assessed:payload.causalDrain.historicalRisk.assessedAtMillis,initial:payload.causalDrain.initialQueueReadBackAtMillis,final:payload.causalDrain.finalQueueReadBackAtMillis},workbook:payload.workbook,quiet:payload.quietHorizon,verified:payload.verifiedAtMillis}));}
 let executor;
 async function fresh(context){
  if(state.inAdmission&&state.admissionReads<3){state.admissionReads++;for(const ms of [14686,state.admissionReads===3?14685:14686]){f.state.now+=ms;state.human.push({kind:'synthetic-admission-report',at:f.state.now});}}
  else if(f.state.mints>0){state.afterMintReads++;f.state.now+=lateAfterMint?61000:6000;state.human.push({kind:'synthetic-post-mint-report',at:f.state.now});}
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
 const execute=executor.executeJoint;executor.executeJoint=async args=>{assert.ok(state.wrapped.tokenExpiresAtMillis>f.state.now);assert.strictEqual(args.sheetsAdapter,state.wrapped.sheetsAdapter);state.writerFieldsObserved=true;return execute(args);};
 const data={...f.args(),prepared,scope,executionMode:MODE,window:{startsAtMillis:f.state.now,endsAtMillis:f.state.now+1200000},receiptId:'joint-composition-synthetic'},sessions=f.sessions(data,'joint-composition-owner',{barrier,executor});
 const openSession=async context=>{const session=await sessions.openSession(context),openWriter=session.openWriter;session.openWriter=async args=>{f.state.now+=16468;const writer=await openWriter(args);state.writerCompletedAt=f.state.now;return writer;};state.wrapped=wrapClosingSession(session,{human:{beginClosing(){state.closing++;}},native:{beginClosing(){},isInFlight(){return false;}}});return state.wrapped;};
 const originalTransaction=db.runTransaction.bind(db);db.runTransaction=async(callback,...args)=>{f.state.now+=1000;state.technicalTransactions++;return originalTransaction(async tx=>{for(const method of ['create','set','update','delete']){const write=tx[method].bind(tx);tx[method]=(...values)=>{const target=values[0]?.path??'';if(state.writerFieldsObserved&&state.casAt===null&&(target.startsWith(`${ROOT}/shifts/`)||target===`${ROOT}/shiftPlanningState/current`))state.casAt=f.state.now;return write(...values);};}return callback(tx);},...args);};
 t.after(()=>{db.runTransaction=originalTransaction;});
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'joint-composition-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 return {f,state,execute:()=>runControlledWindow({...data,...sessions,openSession,root,nowMillis:()=>f.state.now,fetchImpl:f.fetchImpl})};
}
const run=(name,fn)=>test(name,{skip:!enabled},fn);
run('real composed window handles 88s human admission and deferred writer with bounded post-mint reports',async t=>{
 const f=await fixture(t),result=await f.execute(),j=readWindowJournal(result.directory),phases=j.records.map(r=>r.value.phase),admission=j.records.find(r=>r.value.phase==='admission')?.value.admission;
 assert.equal(result.kind,'direction-verified-and-contained',JSON.stringify({kind:result.kind,failure:result.failure,jointPhase:result.result?.phase,phases,engineError:f.state.engineError,barrierError:f.state.barrierError,afterMintReads:f.state.afterMintReads,admissionDuration:admission?.observedAtMillis-admission?.collectionStartedAtMillis}));
 const manifestMillis=admission.finalManifest.attemptedAt.seconds*1000+Math.floor(admission.finalManifest.attemptedAt.nanoseconds/1000000),postMint=f.state.human.filter(x=>x.kind==='synthetic-post-mint-report');
 t.diagnostic(JSON.stringify({admissionCollectionMillis:admission.observedAtMillis-admission.collectionStartedAtMillis,technicalMillis:admission.observedAtMillis-admission.startedAtMillis,manifestAgeAtAdmission:admission.observedAtMillis-manifestMillis,writerPreparationMillis:f.state.writerCompletedAt-admission.observedAtMillis,manifestAgeAtFirstCas:f.state.casAt-manifestMillis,postMintReportCount:postMint.length}));
 assert.ok(postMint.length>=2);assert.ok(admission.observedAtMillis-manifestMillis>=0&&admission.observedAtMillis-manifestMillis<10000);assert.ok(f.state.writerCompletedAt-admission.observedAtMillis>=16468);assert.ok(Number.isSafeInteger(f.state.casAt));assert.ok(f.state.casAt-manifestMillis>=20000&&f.state.casAt-manifestMillis<35000);
 assert.equal(f.state.admissionReads,3);assert.equal(f.state.human.filter(x=>x.kind==='synthetic-admission-report').length,6);assert.ok(admission.observedAtMillis-admission.collectionStartedAtMillis>=88115);assert.ok(admission.observedAtMillis-admission.startedAtMillis>=2000);assert.ok(admission.observedAtMillis-admission.startedAtMillis<=60000);assert.ok(f.state.technicalTransactions>0);
 assert.equal(f.state.writerFieldsObserved,true);assert.ok(f.state.afterMintReads>0);assert.equal(f.state.ownedProofs,1);assert.ok(phases.includes('google-batch-dispatch-intent'));assert.ok(phases.includes('joint-result'));
 assert.equal(result.result.firestoreReceipt.measurement.documentWriteCount,203);assert.equal(result.result.plan.requests.filter(r=>r.updateCells).length,53);assert.equal(result.result.plan.requests.length,55);
 assert.equal(f.f.state.mints,1);assert.equal(f.f.batch.sheets.mutations.length,1);assert.equal(f.f.state.permission,false);assert.equal(f.f.state.disabled,true);assert.deepEqual(result.cleanup.failures,[]);assert.ok(f.state.closing>=3);
});
run('expiry after mint denies business dispatch and contains all temporary permissions',async t=>{
 const f=await fixture(t,{lateAfterMint:true}),result=await f.execute(),phases=readWindowJournal(result.directory).records.map(r=>r.value.phase);
 t.diagnostic(JSON.stringify({engineError:f.state.engineError,jointPhase:result.result?.phase,afterMintReads:f.state.afterMintReads}));
 assert.equal(result.kind,'inspection-required');assert.match(f.state.engineError?.message??'',/final manifest expired or future dated/);assert.equal(f.f.state.mints,1);assert.equal(f.f.batch.sheets.mutations.length,0);assert.equal(phases.includes('google-batch-dispatch-intent'),false);
 assert.equal(f.state.casAt,null);assert.equal((await db.doc(`${ROOT}/shiftPlanningState/current`).get()).exists,false);assert.equal(f.f.state.permission,false);assert.equal(f.f.state.disabled,true);assert.deepEqual(result.cleanup.failures,[]);assert.ok(f.state.afterMintReads>0);
});
