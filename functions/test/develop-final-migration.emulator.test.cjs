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
// Firestore stores field timestamps at microsecond precision. The offline tests
// retain arbitrary nanoseconds; a clone must reject, never hide, any rounding.
const fixture = () => reviewFixture({timestampNanoseconds:"123456000"});
const {fromSnapshot} = require("./develop-shift-migration-fixture.cjs");
const {loadManifest,prepareDevelopMigrationPackage} = require("../scripts/prepare-develop-migration-package.cjs");
const {materializeDevelopMigrationPreparation} = require("../scripts/materialize-develop-migration-package.cjs");
const migration = require("../scripts/rehearse-develop-shift-migration.cjs");
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
    ...sourceInput.snapshot.collections.deliveryCalendar,...sourceInput.snapshot.collections.notificationEvents,sourceInput.snapshot.singletons["config/global"]]) {
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
  return {prepared,service,scope,reviewPackage,sourceInput,cloneCapture,setClock:value=>{now=value;}};
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
