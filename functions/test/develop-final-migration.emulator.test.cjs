"use strict";

const assert = require("node:assert/strict");
const {before,beforeEach,after,test} = require("node:test");
const fs = require("node:fs"), path = require("node:path");
const {Firestore,Timestamp} = require("@google-cloud/firestore");
const {createShiftPlanningDigest:digest} = require("../lib/shift-planning-digest.js");
const {encodeShiftPlanningFirestoreValue:encode} = require("../lib/shift-planning-publication-contract.js");
const {refreshShiftPlanningLiveSource} = require("../lib/shift-planning-firestore-source-producer.js");
const {parseShiftCoverageActivation} = require("../lib/shift-coverage-store-context.js");
const {createShiftPlanningAdministratorBarrierCheckpoint:checkpoint} = require("../lib/shift-planning-trusted-intake-barrier-adapter.js");
const {createFirestoreShiftPlanningIntakeBarrierRepository:repository} = require("../lib/shift-planning-firestore-intake-barrier-repository.js");
const {historicalFixture} = require("./develop-historical-risk-fixture.cjs");
const {fixture:reviewFixture} = require("./develop-migration-package-fixture.cjs");
const {withWriter} = require("./develop-writer-evidence-fixture.cjs");
const {withOriginalWriter} = require("./develop-original-writer-evidence-fixture.cjs");
// Firestore stores field timestamps at microsecond precision. The offline tests
// retain arbitrary nanoseconds; a clone must reject, never hide, any rounding.
const fixture = () => reviewFixture({timestampNanoseconds:"123456000"});
const {fromSnapshot} = require("./develop-shift-migration-fixture.cjs");
const {loadManifest,prepareDevelopMigrationPackage} = require("../scripts/prepare-develop-migration-package.cjs");
const {materializeDevelopMigrationPreparation} = require("../scripts/materialize-develop-migration-package.cjs");
const migration = require("../scripts/rehearse-develop-shift-migration.cjs");
const {createControlledDevelopMigrationEmulator}=require("../scripts/controlled-develop-migration.cjs");
const {createControlledDevelopBarrierEmulator}=require("../scripts/controlled-develop-barrier.cjs");
const ROOT = "develop/plus-collections";
const enabled = process.env.GCLOUD_PROJECT === migration.PROJECT_ID && process.env.FIRESTORE_EMULATOR_HOST === migration.HOST;
const run = (name,fn) => test(name,{skip:!enabled},fn);
const encoded = value => encode(value,"test",new Set());
let db; const services=[];
before(() => {if (enabled) db = new Firestore({projectId:migration.PROJECT_ID,host:migration.HOST,ssl:false});});
beforeEach(async () => {
  if (enabled) assert.equal((await fetch(`http://${migration.HOST}/emulator/v1/projects/${migration.PROJECT_ID}/databases/(default)/documents`,{method:"DELETE"})).ok,true);
});
after(async () => {for (const service of services) await service.close();if(db)await db.terminate();});
const saved = async (collection,versions=false) => (await db.collection(`${ROOT}/${collection}`).orderBy("__name__").get()).docs
  .map(doc => ({path:doc.ref.path,data:encoded(doc.data()),...(versions?{version:encoded(doc.updateTime)}:{})}));
async function harness(sourceInput=fixture()) {
  const reviewPackage=prepareDevelopMigrationPackage(sourceInput), batch=db.batch();
  for (const row of [...sourceInput.snapshot.collections.shifts,...sourceInput.snapshot.collections.users,
    ...sourceInput.snapshot.collections.deliveryCalendar,...sourceInput.snapshot.collections.notificationEvents,...sourceInput.snapshot.collections.config]) {
    const target=row.name.split("/documents/")[1];assert.ok(target.startsWith(ROOT+"/"));
    batch.create(db.doc(target),Object.fromEntries(Object.entries(row.fields).map(([k,v])=>[k,migration.decodeRESTValue(v)])));
  }
  await batch.commit();
  const cloneCapture={projectId:migration.PROJECT_ID,environment:"develop",documents:[],guardCollections:{}};
  for (const collection of ["shifts","users","deliveryCalendar","notificationEvents","config"]) {
    const docs=(await db.collection(`${ROOT}/${collection}`).orderBy("__name__").get()).docs.map(fromSnapshot);
    if(collection==="shifts")cloneCapture.documents=docs;else cloneCapture.guardCollections[collection]=docs;
  }
  const prepared=materializeDevelopMigrationPreparation({sourceInput,reviewPackage,cloneCapture});
  let f,held,now=520;
  const journal=repository(db,()=>Timestamp.fromMillis(now));
  const controlPlane={async closeAndCollect(){
    held=checkpoint({scope:f.scope,evidence:f.evidence,holdRevision:"closed-policy-local"});
    await journal.retainAndReadBack({environment:"develop",transitionId:f.command.transitionId,evidence:f.evidence});return held;
  },readBackClosed:async()=>held,readBackOwnerObservation:async()=>f.evidence.payload.ownerObservation,
  readBackAdministratorObservation:async()=>f.evidence.payload.administratorObservation};
  const service=migration.createDevelopShiftMigrationRehearsal({prepared,controlPlane,failurePersistence:journal,nowMillis:()=>now,historicalRiskMode:true});
  services.push(service);
  const scope=async(inverse=false)=>{
    const inspected=await service.inspect();f=historicalFixture({transitionId:inverse?prepared.recoveryOperationId:prepared.operationId,
      expectedAuthoritativeDigest:inspected.sourceDigest,expectedStateRevision:inspected.maintenance.stateRevision,
      expectedWriteEpoch:inspected.maintenance.writeEpoch,expectedActiveRevision:inspected.maintenance.activeRevision,
      expectedActiveDigest:inspected.maintenance.activeDigest,expectedWorkbookRevision:sourceInput.fileAfter.data.version});
    const risk=f.evidence.payload.causalDrain.historicalRisk;
    Object.assign(risk,migration.historicalMigrationPlanBindings(prepared),{direction:inverse?"inverse":"forward",
      migrationOperationId:prepared.operationId,recoveryOperationId:prepared.recoveryOperationId});
    f.command.expectedHistoricalRiskDigest=f.scope.expectedHistoricalRiskDigest=digest(risk);f.evidence.digest=digest(f.evidence.payload);
    return f.scope;
  };
  return {prepared,service,scope,reviewPackage,sourceInput,cloneCapture,controlPlane,journal,current:()=>f,
    setClock:value=>{now=value;},clock:()=>now};
}
async function forward(h) {
  const scope=await h.scope(),finalManifest=await h.service.forward({scope,materializeOnly:true});
  return {scope,finalManifest,receipt:await h.service.forward({scope,finalManifest})};
}
run("exact final manifests migrate and recover with a policy that cannot produce annual planning",async()=>{
  const sourceInput=process.env.HU084_REVIEW_MANIFEST?loadManifest(process.env.HU084_REVIEW_MANIFEST):fixture();
  const h=await harness(sourceInput),originals=await saved("shifts"),guards={};
  for(const name of ["users","deliveryCalendar","notificationEvents","config"])guards[name]=await saved(name,true);
  const scope=await h.scope(),finalManifest=await h.service.forward({scope,materializeOnly:true});
  assert.deepEqual(await saved("shifts"),originals);assert.equal((await db.doc(`${ROOT}/shiftPlanningState/current`).get()).exists,false);
  const forwardReceipt=await h.service.forward({scope,finalManifest});
  assert.equal(finalManifest.transaction.measurement.documentWriteCount,203);
  assert.equal(forwardReceipt.measurement.logicalMutationDigest,finalManifest.transaction.measurement.logicalMutationDigest);
  assert.equal((await saved("shifts")).length,72);
  assert.deepEqual((await db.doc(`${ROOT}/shiftPlanningState/sourcePolicy`).get()).data(),h.prepared.policyDraft.document);
  await assert.rejects(refreshShiftPlanningLiveSource({firestore:db,environment:"develop"}),/source policy fields are not exact/);
  assert.equal((await db.doc(`${ROOT}/shiftPlanningState/fairness`).get()).exists,false);
  assert.equal(parseShiftCoverageActivation(h.prepared.policyDraft.document.coverage,"develop"),null);
  const replay=await h.service.forward({scope});assert.equal(replay.replayed,true);
  const inverseScope=await h.scope(true),inverseManifest=await h.service.inverse({scope:inverseScope,forwardReadBack:forwardReceipt,materializeOnly:true});
  assert.equal((await saved("shifts")).length,72);
  const inverseReceipt=await h.service.inverse({scope:inverseScope,forwardReadBack:forwardReceipt,finalManifest:inverseManifest});
  assert.equal(inverseManifest.transaction.measurement.documentWriteCount,140);
  assert.equal(inverseReceipt.measurement.logicalMutationDigest,inverseManifest.transaction.measurement.logicalMutationDigest);
  assert.deepEqual(await saved("shifts"),originals);
  for(const [name,rows]of Object.entries(guards))assert.deepEqual(await saved(name,true),rows);
  const state=(await db.doc(`${ROOT}/shiftPlanningState/current`).get()).data();assert.equal(state.maintenanceStatus,"closed");assert.equal(state.writeEpoch,2);
  assert.equal((await h.service.inverse({scope:inverseScope,forwardReadBack:forwardReceipt})).replayed,true);
  if(process.env.HU084_FINAL_OUTPUT){
    assert.ok(path.isAbsolute(process.env.HU084_FINAL_OUTPUT));fs.mkdirSync(process.env.HU084_FINAL_OUTPUT,{recursive:true,mode:0o700});
    for(const [name,value]of Object.entries({prepared:h.prepared,finalManifest,forwardReceipt,inverseManifest,inverseReceipt}))
      fs.writeFileSync(path.join(process.env.HU084_FINAL_OUTPUT,name+".json"),JSON.stringify(value,null,2),{mode:0o600,flag:"wx"});
  }
});
run("closed migration and recovery require materialization before the first write",async()=>{
  const h=await harness(),scope=await h.scope();
  await assert.rejects(h.service.forward({scope}),/requires a final manifest/);assert.equal((await saved("shifts")).length,62);
  const f=await forward(h);await assert.rejects(h.service.inverse({scope:await h.scope(true),forwardReadBack:f.receipt}),/requires a final manifest/);
  assert.equal((await saved("shifts")).length,72);
});
run("a rehashed edited manifest cannot substitute a different write set",async()=>{
  const h=await harness(),scope=await h.scope(),finalManifest=structuredClone(await h.service.forward({scope,materializeOnly:true}));
  const writes=JSON.parse(finalManifest.transaction.serializedMutations);writes.pop();
  finalManifest.transaction.serializedMutations=JSON.stringify(writes);const {finalDigest:unused,...body}=finalManifest;void unused;
  finalManifest.finalDigest=digest(body);
  await assert.rejects(h.service.forward({scope,finalManifest}));assert.equal((await saved("shifts")).length,62);
});
run("late raw ABA change invalidates the prepared final manifest",async()=>{
  const h=await harness(),scope=await h.scope(),finalManifest=await h.service.forward({scope,materializeOnly:true});
  const ref=db.doc(h.prepared.legacy[0].path),prior=await ref.get();await ref.update({late:true});await ref.set(prior.data());
  await assert.rejects(h.service.forward({scope,finalManifest}));assert.equal((await saved("shifts")).length,62);
});
for(const collection of ["notificationEvents","config","shiftCoverageReserves","shiftMembershipState"])run(`late ${collection} change stops execution after materialization`,async()=>{
  const h=await harness(),scope=await h.scope(),finalManifest=await h.service.forward({scope,materializeOnly:true});
  await db.doc(`${ROOT}/${collection}/late`).create({keep:true});
  await assert.rejects(h.service.forward({scope,finalManifest}));assert.equal((await saved("shifts")).length,62);
  assert.equal((await db.doc(`${ROOT}/${collection}/late`).get()).get("keep"),true);
});
run("a changed canonical row is preserved when final inverse execution is refused",async()=>{
  const h=await harness(),f=await forward(h),scope=await h.scope(true);
  const finalManifest=await h.service.inverse({scope,forwardReadBack:f.receipt,materializeOnly:true});
  const ref=db.doc(`${ROOT}/shifts/${h.prepared.content.shifts[0].id}`);await ref.update({late:true});
  await assert.rejects(h.service.inverse({scope,forwardReadBack:f.receipt,finalManifest}));
  assert.equal((await ref.get()).get("late"),true);assert.equal((await saved("shifts")).length,72);
});
for(const millis of [-60_000,521])run(`final manifest rejects a stale or future attempt timestamp (${millis})`,async()=>{
  const h=await harness(),scope=await h.scope(),finalManifest=structuredClone(await h.service.forward({scope,materializeOnly:true}));
  finalManifest.attemptedAt=encoded(Timestamp.fromMillis(millis));const {finalDigest:unused,...body}=finalManifest;void unused;
  finalManifest.finalDigest=digest(body);
  await assert.rejects(h.service.forward({scope,finalManifest}),/expired or future/);assert.equal((await saved("shifts")).length,62);
});
run("closed policy still refuses annual production if a local maintenance flag is accidentally opened",async()=>{
  const h=await harness();await forward(h);
  await db.doc(`${ROOT}/shiftPlanningState/current`).update({maintenanceStatus:"open"});
  await assert.rejects(refreshShiftPlanningLiveSource({firestore:db,environment:"develop"}),/source policy fields are not exact/);
  assert.equal((await db.doc(`${ROOT}/shiftPlanningState/fairness`).get()).exists,false);
});
run("clone precision loss is rejected instead of silently changing a retained payload",async()=>{
  await assert.rejects(harness(reviewFixture()),/clone payload drift/);
});

async function controlled(sourceInput=withOriginalWriter(withWriter(fixture()))) {
  const h=await harness(sourceInput),counts={close:0,incident:0};
  const controlPlane={...h.controlPlane,closeAndCollect:async()=>{counts.close++;throw new Error("must not close controls");}};
  const failurePersistence={readExistingFailure:i=>h.journal.readExistingFailure(i),retainFailureAndReadBack:async i=>{
    counts.incident++;return h.journal.retainFailureAndReadBack(i);
  }};
  const executor=createControlledDevelopMigrationEmulator({firestore:db,prepared:h.prepared,controlPlane,failurePersistence,nowMillis:h.clock});
  const hold=async(inverse=false)=>{const scope=await h.scope(inverse);await h.controlPlane.closeAndCollect(scope);return scope;};
  return {...h,executor,hold,counts,readers:controlPlane};
}
const businessSnapshot=async()=>Object.fromEntries(await Promise.all(["shifts","users","config","notificationEvents","deliveryCalendar",
  "shiftPlanningState","shiftRotations","shiftPlanningOperations","shiftPlanningMigrationBaselines"].map(async c=>[c,await saved(c,true)])));
run("controlled read-only admission reports the absent window without acquiring controls or writing",async()=>{
  const h=await controlled(),before=await businessSnapshot();
  const result=await h.executor.inspectAdmission();assert.equal(result.checksPassed,false);
  assert.deepEqual(result.writerRehearsal,h.prepared.writerRehearsal);
  assert.deepEqual(result.originalWriterCheck,h.prepared.originalWriterCheck);
  assert.equal(result.originalWriterCheck.currentWriterAuthorityVerified,false);
  assert.equal(result.writerRehearsal.originalFileAuthorityVerified,false);
  assert.deepEqual(result.blockers,["window_scope_missing"]);assert.equal(result.canApply,false);assert.equal(result.canEnterMaintenance,false);
  assert.deepEqual(await businessSnapshot(),before);assert.deepEqual(h.counts,{close:0,incident:0});
});
run("controlled admission and execution reuse exact forward/inverse manifests and held controls",async()=>{
  const sourceInput=process.env.HU084_REVIEW_MANIFEST?loadManifest(process.env.HU084_REVIEW_MANIFEST):withOriginalWriter(withWriter(fixture()));
  const h=await controlled(sourceInput),original=await saved("shifts"),notices=await saved("notificationEvents",true),scope=await h.hold();
  const before=await businessSnapshot(),admission=await h.executor.inspectAdmission({scope});
  assert.equal(admission.checksPassed,true);assert.equal(admission.canApply,false);assert.deepEqual(await businessSnapshot(),before);
  assert.deepEqual(admission.writerRehearsal,h.prepared.writerRehearsal);
  assert.deepEqual(admission.originalWriterCheck,h.prepared.originalWriterCheck);
  const receipt=await h.executor.execute({scope,admission});assert.equal(receipt.measurement.documentWriteCount,203);
  assert.equal((await h.executor.readRetained({scope})).replayed,true);
  const inverseScope=await h.hold(true),afterForward=await businessSnapshot();
  const inverse=await h.executor.inspectAdmission({direction:"inverse",scope:inverseScope,forwardReadBack:receipt});
  assert.equal(inverse.checksPassed,true);assert.deepEqual(await businessSnapshot(),afterForward);
  assert.equal((await h.executor.execute({scope:inverseScope,admission:inverse,forwardReadBack:receipt})).measurement.documentWriteCount,140);
  assert.deepEqual(await saved("shifts"),original);assert.deepEqual(await saved("notificationEvents",true),notices);
  assert.deepEqual(h.counts,{close:0,incident:0});
  if(process.env.HU084_CONTROLLED_OUTPUT){
    assert.ok(path.isAbsolute(process.env.HU084_CONTROLLED_OUTPUT));fs.mkdirSync(process.env.HU084_CONTROLLED_OUTPUT,{recursive:true,mode:0o700});
    fs.writeFileSync(path.join(process.env.HU084_CONTROLLED_OUTPUT,"controlled-roundtrip.json"),JSON.stringify({
      reviewPackageDigest:h.reviewPackage.packageDigest,preparedDigest:h.prepared.preparedDigest,admission,inverse,
      forwardReceiptDigest:receipt.receiptDigest,counts:h.counts,originalsRestored:62,noticesPreserved:117,liveExecutable:false},null,2),{mode:0o600,flag:"wx"});
  }
});
run("invalid owner facts block passive admission without creating a failure journal",async()=>{
  const h=await controlled(),scope=await h.hold(),before=await businessSnapshot();
  h.current().evidence.payload.ownerObservation.ownerActivity="reported";
  const result=await h.executor.inspectAdmission({scope});assert.equal(result.checksPassed,false);assert.equal(result.finalManifest,null);
  assert.deepEqual(await businessSnapshot(),before);assert.deepEqual(h.counts,{close:0,incident:0});
});
run("a passed inspection cannot bypass a changed administrator observation during execution",async()=>{
  const h=await controlled(),scope=await h.hold(),admission=await h.executor.inspectAdmission({scope});assert.equal(admission.checksPassed,true);
  h.readers.readBackAdministratorObservation=async()=>({...h.current().evidence.payload.administratorObservation,administratorActivity:"reported"});
  await assert.rejects(h.executor.execute({scope,admission}));assert.equal((await saved("shifts")).length,62);
  assert.equal(h.counts.close,0);assert.equal(h.counts.incident,1);
});
run("a passed inspection cannot bypass a late source write",async()=>{
  const h=await controlled(),scope=await h.hold(),admission=await h.executor.inspectAdmission({scope});assert.equal(admission.checksPassed,true);
  const ref=db.doc(`${ROOT}/notificationEvents/after-inspection`);await ref.create({keep:true});
  await assert.rejects(h.executor.execute({scope,admission}));assert.equal((await ref.get()).get("keep"),true);
  assert.equal((await saved("shifts")).length,62);assert.equal(h.counts.close,0);
});
run("inspection failure does not claim a durable incident when the held checkpoint is missing",async()=>{
  const h=await controlled(),scope=await h.scope();h.readers.readBackClosed=async()=>null;
  const before=await businessSnapshot(),result=await h.executor.inspectAdmission({scope});
  assert.deepEqual(result.blockers,["held_checkpoint_missing"]);assert.deepEqual(await businessSnapshot(),before);
  await assert.rejects(h.executor.execute({scope,admission:result}));assert.deepEqual(h.counts,{close:0,incident:0});
});
run("an unreviewed config document blocks passive admission even when config/global is unchanged",async()=>{
  const h=await controlled(),global=await db.doc(`${ROOT}/config/global`).get();
  await db.doc(`${ROOT}/config/unreviewed`).create({deliveryDayOfWeek:3});
  const before=await businessSnapshot(),result=await h.executor.inspectAdmission();
  assert.deepEqual(result.blockers,["source_not_verified"]);assert.equal(result.source,null);
  assert.ok((await db.doc(`${ROOT}/config/global`).get()).updateTime.isEqual(global.updateTime));
  assert.deepEqual(await businessSnapshot(),before);assert.deepEqual(h.counts,{close:0,incident:0});
});
run("an expired controlled admission cannot execute or persist an incident",async()=>{
  const h=await controlled(),scope=await h.hold(),admission=await h.executor.inspectAdmission({scope});
  assert.equal(admission.checksPassed,true);const before=await businessSnapshot();
  h.setClock(h.clock()+60_001);
  await assert.rejects(h.executor.execute({scope,admission}),/inspection expired/);
  assert.deepEqual(await businessSnapshot(),before);assert.deepEqual(h.counts,{close:0,incident:0});
});
for(const name of ["member","public"])run(`reviewed config/${name} version drift blocks execution and preserves the change`,async()=>{
  const h=await controlled(),scope=await h.hold(),admission=await h.executor.inspectAdmission({scope});
  assert.equal(admission.checksPassed,true);const ref=db.doc(`${ROOT}/config/${name}`),before=await ref.get();
  // A no-op set can keep the same service version. Exercise an actual ABA edit.
  await ref.update({late:true});await ref.set(before.data());const after=await ref.get();
  assert.equal(after.updateTime.isEqual(before.updateTime),false);assert.deepEqual(after.data(),before.data());
  await assert.rejects(h.executor.execute({scope,admission}));
  assert.ok((await ref.get()).updateTime.isEqual(after.updateTime));assert.equal((await saved("shifts")).length,62);
  assert.equal(h.counts.close,0);
});
run("changed public config blocks inverse admission without altering the committed migration",async()=>{
  const h=await controlled(),scope=await h.hold(),admission=await h.executor.inspectAdmission({scope});
  const receipt=await h.executor.execute({scope,admission}),inverseScope=await h.hold(true);
  await db.doc(`${ROOT}/config/public`).update({late:true});const before=await businessSnapshot();
  const result=await h.executor.inspectAdmission({direction:"inverse",scope:inverseScope,forwardReadBack:receipt});
  assert.equal(result.checksPassed,false);assert.equal(result.finalManifest,null);
  assert.deepEqual(await businessSnapshot(),before);assert.equal((await saved("shifts")).length,72);
  assert.deepEqual(h.counts,{close:0,incident:0});
});

// Provider observations remain explicit test doubles. The acquisition, journal,
// source reads, admission and forward/inverse transactions use the real emulator.
function durable(h,{firestore=db,onRead=()=>{},onClose=()=>{}}={}) {
  const counts={opened:0,closed:0};
  const create=()=>createControlledDevelopBarrierEmulator({firestore,prepared:h.prepared,nowMillis:h.clock,
    openObservationSession:async scope=>{
      counts.opened++;
      const read=async name=>{await onRead(name,scope);return structuredClone(name==="evidence"?h.current().evidence:h.current().evidence.payload[name]);};
      return {readEvidence:()=>read("evidence"),readOwnerObservation:()=>read("ownerObservation"),
        readAdministratorObservation:()=>read("administratorObservation"),close:async()=>{counts.closed++;await onClose();}};
    }});
  const barrier=create(),executor=createControlledDevelopMigrationEmulator({firestore:db,prepared:h.prepared,
    controlPlane:barrier.controlPlane,failurePersistence:barrier.failurePersistence,nowMillis:h.clock});
  return {barrier,executor,create,counts};
}
const withoutJournal=async()=>{const snapshot=await businessSnapshot();delete snapshot.shiftPlanningOperations;return snapshot;};
const evidenceKey=scope=>({environment:"develop",transitionId:scope.transitionId});
// Commit on the emulator, then inject a lost acknowledgement or interruption.
function afterEvidenceCommit(effect) {
  let pending=true;
  return new Proxy(db,{get(target,name){
    if(name==="runTransaction")return async(...args)=>{
      const result=await target.runTransaction(...args);
      if(pending&&result?.operationKind==="intakeBarrierEvidence"){pending=false;await effect();}
      return result;
    };
    const value=Reflect.get(target,name);return typeof value==="function"?value.bind(target):value;
  }});
}
run("durable acquisition survives composition restart and drives exact migration and recovery",async()=>{
  const input=process.env.HU084_REVIEW_MANIFEST?loadManifest(process.env.HU084_REVIEW_MANIFEST):withOriginalWriter(withWriter(fixture()));
  const h=await harness(input),scope=await h.scope(),d=durable(h),before=await withoutJournal();
  assert.equal((await d.executor.inspectAdmission({scope})).checksPassed,false);
  const acquired=await d.barrier.acquire({scope});
  assert.equal(acquired.acquired,true);assert.equal(acquired.canEnterMaintenance,false);
  assert.equal(acquired.maintenanceStateChanged,false);assert.deepEqual(await withoutJournal(),before);
  const restarted=d.create(),retained=await restarted.inspectRetained({scope});
  assert.deepEqual(retained.checkpoint,acquired.checkpoint);assert.equal(retained.failure,null);
  assert.equal(retained.historical,true);assert.equal(retained.canApply,false);
  assert.deepEqual(await restarted.controlPlane.readBackClosed(scope),acquired.checkpoint);
  await assert.rejects(restarted.acquire({scope}),/already_retained/);
  const admission=await d.executor.inspectAdmission({scope});assert.equal(admission.checksPassed,true);
  const receipt=await d.executor.execute({scope,admission});assert.equal(receipt.measurement.documentWriteCount,203);
  const inverseScope=await h.scope(true);await restarted.acquire({scope:inverseScope});
  const inverse=await d.executor.inspectAdmission({direction:"inverse",scope:inverseScope,forwardReadBack:receipt});
  assert.equal(inverse.checksPassed,true);
  assert.equal((await d.executor.execute({scope:inverseScope,admission:inverse,forwardReadBack:receipt})).measurement.documentWriteCount,140);
  assert.deepEqual(await saved("shifts"),before.shifts.map(({path,data})=>({path,data})));
  for(const name of ["users","config","notificationEvents","deliveryCalendar"])assert.deepEqual(await saved(name,true),before[name]);
  const state=(await db.doc(`${ROOT}/shiftPlanningState/current`).get()).data();
  assert.equal(state.maintenanceStatus,"closed");assert.equal(state.writeEpoch,2);
  assert.equal(d.counts.opened,d.counts.closed);assert.ok(d.counts.opened>0);
  if(process.env.HU084_CONTROLLED_OUTPUT)fs.writeFileSync(path.join(process.env.HU084_CONTROLLED_OUTPUT,"durable-barrier-roundtrip.json"),
    JSON.stringify({preparedDigest:h.prepared.preparedDigest,acquired,admissionDigest:admission.admissionDigest,
      inverseAdmissionDigest:inverse.admissionDigest,counts:d.counts,originalsRestored:62,noticesPreserved:117,liveExecutable:false},null,2),{mode:0o600,flag:"wx"});
});
run("abort before acquisition performs no observation or journal write",async()=>{
  const h=await harness(),scope=await h.scope(),d=durable(h),before=await businessSnapshot();
  await assert.rejects(d.barrier.acquire({scope,signal:AbortSignal.abort()}),/interrupted/);
  assert.deepEqual(await businessSnapshot(),before);assert.deepEqual(d.counts,{opened:0,closed:0});
});
for(const mode of ["read-failure","cleanup-failure","abort-during-read"])run(`${mode} attempts session cleanup and cannot acquire`,async()=>{
  const h=await harness(),scope=await h.scope(),controller=new AbortController(),before=await businessSnapshot();
  const d=durable(h,{onRead:()=>{
    if(mode==="read-failure")throw new Error("read failed");
    if(mode==="abort-during-read")controller.abort();
  },onClose:()=>{if(mode==="cleanup-failure")throw new Error("cleanup unverified");}});
  await assert.rejects(d.barrier.acquire({scope,signal:controller.signal}));
  assert.equal(d.counts.opened,1);assert.equal(d.counts.closed,1);
  assert.deepEqual(await businessSnapshot(),before);
  assert.equal((await d.barrier.inspectRetained({scope})).failure,null);
});
for(const mode of ["lost-acknowledgement","abort-after-commit"])run(`${mode} retains evidence and incident without business writes or automatic retry`,async()=>{
  const h=await harness(),scope=await h.scope(),controller=new AbortController(),before=await withoutJournal();
  const d=durable(h,{firestore:afterEvidenceCommit(()=>{
    if(mode==="lost-acknowledgement")throw new Error("acknowledgement lost");controller.abort();
  })});
  await assert.rejects(d.barrier.acquire({scope,signal:controller.signal}));
  const retained=await d.create().inspectRetained({scope});assert.ok(retained.checkpoint);assert.ok(retained.failure);
  assert.equal(retained.canApply,false);assert.deepEqual(await withoutJournal(),before);
  const journal=await saved("shiftPlanningOperations",true);
  await assert.rejects(d.create().acquire({scope}),/already_retained/);
  assert.equal((await d.executor.inspectAdmission({scope})).checksPassed,false);
  assert.deepEqual(await saved("shiftPlanningOperations",true),journal);
  assert.equal(d.counts.opened,d.counts.closed);
});
run("restart after expiry exposes only historical evidence and cannot revive admission",async()=>{
  const h=await harness(),scope=await h.scope(),d=durable(h);await d.barrier.acquire({scope});
  const before=await businessSnapshot();h.setClock(10_000_000);
  const restarted=d.create(),retained=await restarted.inspectRetained({scope});assert.ok(retained.checkpoint);
  const count=d.counts.opened;
  await assert.rejects(restarted.controlPlane.readBackClosed(scope));
  assert.equal(d.counts.opened,count);assert.equal((await d.executor.inspectAdmission({scope})).checksPassed,false);
  assert.deepEqual(await businessSnapshot(),before);
});
for(const phase of ["ownerObservation","administratorObservation"])run(`cancellation during final ${phase} retains a blocking incident`,async()=>{
  const h=await harness(),scope=await h.scope(),controller=new AbortController(),before=await withoutJournal();let reads=0;
  const d=durable(h,{onRead:name=>{if(name===phase&&++reads===2)controller.abort();}});
  await assert.rejects(d.barrier.acquire({scope,signal:controller.signal}));
  assert.equal(reads,2);const retained=await d.create().inspectRetained({scope});
  assert.ok(retained.checkpoint);assert.ok(retained.failure);assert.equal(retained.failure.phase,"finalReadBack");
  assert.equal((await d.executor.inspectAdmission({scope})).checksPassed,false);
  assert.deepEqual(await withoutJournal(),before);assert.equal(d.counts.opened,d.counts.closed);
});
run("source drift during observation is preserved and prevents evidence retention",async()=>{
  const h=await harness(),scope=await h.scope(),d=durable(h,{onRead:async()=>{
    await db.doc(`${ROOT}/config/public`).update({late:true});
  }});
  await assert.rejects(d.barrier.acquire({scope}));
  assert.equal(await h.journal.readExisting(evidenceKey(scope)),null);
  assert.equal((await db.doc(`${ROOT}/config/public`).get()).get("late"),true);
  assert.equal((await saved("shifts")).length,62);assert.equal(d.counts.opened,d.counts.closed);
});
run("current observation drift blocks a retained checkpoint without falsely certifying cleanup or closure",async()=>{
  const h=await harness(),scope=await h.scope();let drift=false;
  const d=durable(h,{onRead:()=>{if(drift)throw new Error("controls unavailable");}});
  await d.barrier.acquire({scope});const before=await businessSnapshot();drift=true;
  assert.equal((await d.executor.inspectAdmission({scope})).checksPassed,false);
  assert.deepEqual(await businessSnapshot(),before);assert.equal(d.counts.opened,d.counts.closed);
});
run("cleanup failure after retaining evidence is durably incident-closed when readback recovers",async()=>{
  const h=await harness(),scope=await h.scope(),before=await withoutJournal();let closes=0;
  const d=durable(h,{onClose:()=>{if(++closes===2)throw new Error("cleanup unverified");}});
  await assert.rejects(d.barrier.acquire({scope}));
  const retained=await d.create().inspectRetained({scope});assert.ok(retained.checkpoint);assert.ok(retained.failure);
  assert.equal(retained.failure.phase,"initialReadBack");assert.equal((await d.executor.inspectAdmission({scope})).checksPassed,false);
  assert.deepEqual(await withoutJournal(),before);assert.equal(d.counts.opened,d.counts.closed);
});

// Full Sheets writes remain a stateful API fake. The source, durable barrier,
// admission and transactions below use Firestore's emulator. No live writer is
// accepted, even when the optional inputs are retained real read observations.
async function jointHarness() {
  const {batchFixture}=require("./develop-helper-batch-fixture.cjs");
  const {sheetsService}=require("./shift-sheets-api-fixture.cjs");
  const {FILE}=require("../scripts/develop-original-writer-provider.cjs");
  const {createShiftSheetsAdapter}=require("../lib/shift-sheets.js");
  const {createShiftSheetsConfig}=require("../lib/shift-sheets-config.js");
  let f=batchFixture();
  if(process.env.HU084_HELPER_OBSERVATION) {
    assert.ok(process.env.HU084_REVIEW_MANIFEST);
    const sourceInput=loadManifest(process.env.HU084_REVIEW_MANIFEST);
    const observation=JSON.parse(fs.readFileSync(process.env.HU084_HELPER_OBSERVATION));
    const sheets=sheetsService(FILE);sheets.state=structuredClone(observation.snapshot);
    f={sourceInput,reviewPackage:prepareDevelopMigrationPackage(sourceInput),sheets,
      observe:()=>({...observation,snapshot:structuredClone(sheets.state),snapshotDigest:digest(sheets.state)})};
  }
  const h=await harness(f.sourceInput),d=durable(h);
  const api=createShiftSheetsAdapter({config:createShiftSheetsConfig({environment:"develop",workbooks:{develop:FILE}}),sheets:f.sheets});
  return {...f,h,d,api};
}
run("durable barrier, exact Firestore migration and complete Sheets batch recover together after a lost Sheets acknowledgement",async()=>{
  const {planBatch,assertHelperBatchTime}=require("../scripts/prepare-develop-helper-batch.cjs");
  const {assertShiftSheetsOwnerPreservation:preserved}=require("../lib/shift-sheets-owner-manifest.js");
  const f=await jointHarness(),before=await businessSnapshot(),image=f.observe(),scope=await f.h.scope();
  const forward=await planBatch({...f,observation:image});assert.equal(forward.operation.operationId,f.h.prepared.operationId);
  await f.d.barrier.acquire({scope});const admission=await f.d.executor.inspectAdmission({scope});
  assert.equal(admission.checksPassed,true);
  const receipt=await f.d.executor.execute({scope,admission});
  const budget={nowMillis:1000,tokenExpiresAtMillis:301000,windowEndsAtMillis:601000};
  const exact=plan=>async binding=>{assert.equal(binding.requestDigest,plan.requestDigest);assert.deepEqual(binding.requests,plan.requests);};
  f.sheets.loseAcknowledgement=true;
  const written=await f.api.reconcile({...forward.operation,authorizeMutation:exact(forward),assertSubmissionNow:()=>assertHelperBatchTime(budget)});
  assert.equal(written.kind,"verified");preserved({manifest:forward.preservation,after:f.sheets.state});
  assert.equal(f.sheets.mutations.length,1);assert.equal((await saved("shifts")).length,72);
  const inverse=await planBatch({...f,observation:f.observe(),direction:"inverse",forwardPlan:forward});
  assert.equal(inverse.operation.operationId,f.h.prepared.recoveryOperationId);
  // An inverse is a separately checked action, never an automatic catch/retry.
  const inverseScope=await f.h.scope(true);await f.d.barrier.acquire({scope:inverseScope});
  const inverseAdmission=await f.d.executor.inspectAdmission({direction:"inverse",scope:inverseScope,forwardReadBack:receipt});
  assert.equal(inverseAdmission.checksPassed,true);
  const restored=await f.api.reconcile({...inverse.operation,authorizeMutation:exact(inverse),assertSubmissionNow:()=>assertHelperBatchTime(budget)});
  assert.equal(restored.kind,"verified");preserved({manifest:inverse.preservation,after:f.sheets.state});
  await f.d.executor.execute({scope:inverseScope,admission:inverseAdmission,forwardReadBack:receipt});
  const cells=structuredClone(f.sheets.state);cells.sheets.forEach(s=>{s.developerMetadata=image.snapshot.sheets.find(x=>x.properties.sheetId===s.properties.sheetId).developerMetadata;});
  assert.deepEqual(cells,image.snapshot);assert.equal(f.sheets.mutations.length,2);
  assert.deepEqual(await saved("shifts"),before.shifts.map(({path,data})=>({path,data})));
  for(const name of ["users","config","notificationEvents","deliveryCalendar"])assert.deepEqual(await saved(name,true),before[name]);
  assert.equal(f.d.counts.opened,f.d.counts.closed);
  assert.equal((await db.doc(`${ROOT}/shiftPlanningState/current`).get()).get("maintenanceStatus"),"closed");
  if(process.env.HU084_CONTROLLED_OUTPUT)fs.writeFileSync(path.join(process.env.HU084_CONTROLLED_OUTPUT,"joint-sheets-roundtrip.json"),JSON.stringify({
    preparedDigest:f.h.prepared.preparedDigest,forwardPlanDigest:forward.planDigest,inversePlanDigest:inverse.planDigest,
    firestoreWrites:[203,140],sheetsRequests:[55,55],sheetsSubmissions:f.sheets.mutations.length,
    observationSessions:f.d.counts,originalsRestored:62,noticesPreserved:117,realGoogleWrites:false,
    livePermissionsExercised:false,liveTimingCertified:false,canEnterMaintenance:false},null,2),{mode:0o600,flag:"wx"});
});
for(const phase of ["expired-budget","interrupted"])run(`joint ${phase} after Firestore retains its receipt without sending Sheets or automatically reverting`,async()=>{
  const {planBatch,assertHelperBatchTime}=require("../scripts/prepare-develop-helper-batch.cjs");
  const f=await jointHarness(),scope=await f.h.scope(),image=f.observe();
  const plan=await planBatch({...f,observation:image});await f.d.barrier.acquire({scope});
  const admission=await f.d.executor.inspectAdmission({scope});await f.d.executor.execute({scope,admission});
  await assert.rejects(f.api.reconcile({...plan.operation,
    signal:phase==="interrupted"?AbortSignal.abort():undefined,
    authorizeMutation:async binding=>assert.equal(binding.requestDigest,plan.requestDigest),
    assertSubmissionNow:()=>assertHelperBatchTime({nowMillis:151000,tokenExpiresAtMillis:301000,windowEndsAtMillis:601000})}));
  assert.equal(f.sheets.mutations.length,0);assert.deepEqual(f.observe().snapshot,image.snapshot);
  assert.equal((await saved("shifts")).length,72);assert.equal((await f.d.executor.readRetained({scope})).replayed,true);
  assert.equal(f.d.counts.opened,f.d.counts.closed);
  assert.equal((await db.doc(`${ROOT}/shiftPlanningState/current`).get()).get("maintenanceStatus"),"closed");
});
run("failed recovery readback never claims a durable incident after a lost acknowledgement",async()=>{
  const h=await harness(),scope=await h.scope(),before=await withoutJournal();let failed=false;
  const d=durable(h,{firestore:afterEvidenceCommit(()=>{failed=true;throw new Error("acknowledgement lost");}),
    onRead:()=>{if(failed)throw new Error("provider unavailable");}});
  await assert.rejects(d.barrier.acquire({scope}),/could not be durably proven/);
  const retained=await d.create().inspectRetained({scope});assert.ok(retained.checkpoint);assert.equal(retained.failure,null);
  assert.equal(retained.canApply,false);assert.equal((await d.executor.inspectAdmission({scope})).checksPassed,false);
  await assert.rejects(d.create().acquire({scope}),/already_retained/);
  assert.deepEqual(await withoutJournal(),before);assert.equal(d.counts.opened,d.counts.closed);
});
run("evidence from another prepared package cannot be acquired even with a rehashed risk binding",async()=>{
  const h=await harness(),scope=await h.scope(),d=durable(h);
  const risk=h.current().evidence.payload.causalDrain.historicalRisk;
  risk.migrationPlanDigest=digest({wrong:"package"});scope.expectedHistoricalRiskDigest=digest(risk);
  h.current().evidence.digest=digest(h.current().evidence.payload);const before=await businessSnapshot();
  await assert.rejects(d.barrier.acquire({scope}));assert.deepEqual(await businessSnapshot(),before);
  assert.equal(d.counts.opened,d.counts.closed);
});
