"use strict";
const assert=require("node:assert/strict"),{test}=require("node:test");
const {fixture}=require("./develop-migration-package-fixture.cjs");
const {prepareDevelopMigrationPackage}=require("../scripts/prepare-develop-migration-package.cjs");
const {materializeControlledDevelopMigrationPreparation:prepare}=require("../scripts/materialize-develop-migration-package.cjs");
const {createControlledDevelopMigrationExecutor:create}=require("../scripts/controlled-develop-migration.cjs");
const rehearsal=require("../scripts/rehearse-develop-shift-migration.cjs");
const {withWriter}=require("./develop-writer-evidence-fixture.cjs");
const {withOriginalWriter}=require("./develop-original-writer-evidence-fixture.cjs");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
function input(){
  const sourceInput=fixture();return {sourceInput,reviewPackage:prepareDevelopMigrationPackage(sourceInput),sourceCapture:{
    projectId:"reguerta-9f27f",environment:"develop",documents:structuredClone(sourceInput.snapshot.collections.shifts),
    guardCollections:{...Object.fromEntries(["users","deliveryCalendar","notificationEvents"].map(c=>[c,structuredClone(sourceInput.snapshot.collections[c])])),
      config:structuredClone(sourceInput.snapshot.collections.config)}}};
}
function dependencies(){
  let reads=0;const prepared=prepare(input());
  return {prepared,firestore:{projectId:"reguerta-9f27f",databaseId:"(default)",runTransaction:async()=>{reads++;throw new Error("no provider configured");}},
    controlPlane:{readBackClosed:async()=>null,readBackOwnerObservation:async()=>null,readBackAdministratorObservation:async()=>null},
    failurePersistence:{readExistingFailure:async()=>null,retainFailureAndReadBack:async()=>{throw new Error("unexpected write");}},nowMillis:()=>100,
    readCount:()=>reads};
}
test("shared preparation binds retained real versions without consuming or renaming emulator evidence",()=>{
  const args=input(),prepared=prepare(args);assert.equal(prepared.projectId,"reguerta-9f27f");
  assert.equal(prepared.scope,"controlled_develop_preparation");assert.equal(prepared.liveExecutable,false);
  assert.equal(prepared.policyDraft.localOnly.scope,"controlled_develop_preparation");
  assert.equal(prepared.reviewPackageDigest,args.reviewPackage.packageDigest);assert.equal(prepared.legacy[0].updateTime.nanoseconds,123456789);
  assert.throws(()=>rehearsal.prepareDevelopShiftMigration({targetProjectId:"reguerta-9f27f"}),/fixed demo/);
});
for(const [name,mutate]of Object.entries({
  "cloned service version":x=>{x.sourceCapture.documents[0].updateTime="2026-10-30T12:00:00.000001Z";},
  "changed member config version":x=>{x.sourceCapture.guardCollections.config[1].updateTime="2026-10-28T10:00:01.123456790Z";},
  "changed public config payload":x=>{x.sourceCapture.guardCollections.config[2].fields.extra={booleanValue:true};},
  "other project":x=>{x.sourceCapture.projectId="another-project";},
  "production namespace":x=>{x.sourceCapture.documents[0].name=x.sourceCapture.documents[0].name.replace("/develop/","/production/");},
  "another environment":x=>{x.sourceCapture.environment="production";},
}))test(`shared preparation rejects ${name}`,()=>{const args=input();mutate(args);assert.throws(()=>prepare(args));});
for(const [name,mutate]of Object.entries({
  "emulator project":x=>{x.firestore.projectId=rehearsal.PROJECT_ID;},
  "named database":x=>{x.firestore.databaseId="other";},
  "altered preparation":x=>{x.prepared.operationId="unreviewed";},
  "missing fresh owner reader":x=>{delete x.controlPlane.readBackOwnerObservation;},
}))test(`shared composition rejects ${name} before any provider read`,()=>{const args=dependencies();mutate(args);assert.throws(()=>create(args));assert.equal(args.readCount(),0);});
test("invalid production scope is refused before SDK reads and absent providers cannot grant admission",async()=>{
  const args=dependencies(),executor=create(args);
  const invalid=await executor.inspectAdmission({scope:{environment:"production"}});assert.deepEqual(invalid.blockers,["invalid_scope"]);
  assert.equal(args.readCount(),0);
  const absent=await executor.inspectAdmission();assert.deepEqual(absent.blockers,["source_not_verified"]);assert.equal(absent.canApply,false);
  assert.equal(absent.canEnterMaintenance,false);assert.equal(args.readCount(),1);
});
test("historical writer proof reaches admission report but cannot replace held controls or a window",async()=>{
  const original=input(),sourceInput=withWriter(original.sourceInput);
  const prepared=prepare({...original,sourceInput,reviewPackage:prepareDevelopMigrationPackage(sourceInput)});
  assert.equal(prepared.writerRehearsal.evidenceDigest,sourceInput.reviewedWriterRehearsalDigest);
  const args=dependencies(), executor=create({...args,prepared});
  const report=await executor.inspectAdmission();
  assert.deepEqual(report.writerRehearsal,prepared.writerRehearsal);
  assert.deepEqual(report.blockers,["source_not_verified"]);
  assert.equal(report.checksPassed,false); assert.equal(report.canApply,false); assert.equal(report.canEnterMaintenance,false);
  assert.equal(args.readCount(),1);
});

test("original writer proof reaches materializer and admission without replacing live checks",async()=>{
 const original=input(),sourceInput=withOriginalWriter(withWriter(original.sourceInput));
 const prepared=prepare({...original,sourceInput,reviewPackage:prepareDevelopMigrationPackage(sourceInput)});
 const args=dependencies(),report=await create({...args,prepared}).inspectAdmission();
 assert.equal(prepared.originalWriterCheck.evidenceDigest,sourceInput.reviewedOriginalWriterCheckDigest);
 assert.deepEqual(report.originalWriterCheck,prepared.originalWriterCheck);
 assert.deepEqual(report.blockers,["source_not_verified"]);assert.equal(report.checksPassed,false);
 assert.equal(report.canApply,false);assert.equal(report.canEnterMaintenance,false);assert.equal(args.readCount(),1);
});

test("shared develop refuses the legacy unbounded execute path before provider access",async()=>{
  const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
  const args=dependencies(),p=args.prepared,part=p.policyDraft.document.sync.partitions.delivery;
  const scope={schemaVersion:3,environment:"develop",transitionId:p.operationId,
    expectedWorkbookFileId:part.workbookId,expectedWorkbookRevision:part.workbookRevision};
  const value={kind:"develop-migration-admission-inspection",preparedDigest:p.preparedDigest,projectId:"reguerta-9f27f",environment:"develop",
    direction:"forward",scopeDigest:digest(scope),readOnly:true,canApply:false,canEnterMaintenance:false,checksPassed:true,
    blockers:[],finalManifest:{},collectionStartedAtMillis:100,startedAtMillis:100,observedAtMillis:100};
  await assert.rejects(create(args).execute({scope,admission:{...value,admissionDigest:digest(value)}}),/requires joint deadline guard/);
  assert.equal(args.readCount(),0);
});

// Exercise the real composition with a migration-engine collaborator. The
// engine's own transaction/CAS and held-evidence checks retain their emulator
// coverage; this fixture controls read latency and returned source versions.
function admissionFixture({humanMillis=88_115,onInspect=()=>{}}={}) {
  const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),{createRequire}=require("node:module");
  const filename=path.join(__dirname,"../scripts/controlled-develop-migration.cjs"),realRequire=createRequire(filename);
  const prepared=prepare(input()),state={now:1_000,casVersion:1,reads:[],humanReads:[],executions:[],manifests:[]};
  const source=()=>({sourceDigest:digest({payload:"unchanged source",serviceVersion:state.casVersion}),
    maintenance:{exists:false,stateRevision:0,writeEpoch:0,activeRevision:null,activeDigest:null}});
  const controlPlane={readBackClosed:async()=>({held:true}),
    readBackOwnerObservation:async()=>{state.now+=Math.floor(humanMillis/2);state.humanReads.push("owner");return {observedAtMillis:state.now};},
    readBackAdministratorObservation:async()=>{state.now+=humanMillis-Math.floor(humanMillis/2);state.humanReads.push("administrator");return {observedAtMillis:state.now};}};
  const engine=({controlPlane:readers})=>{
    const direction=kind=>async args=>{
      if(!args.materializeOnly){state.executions.push({kind,args});return {verified:true,direction:kind};}
      await readers.readBackOwnerObservation(args.scope);await readers.readBackAdministratorObservation(args.scope);
      const manifest={preparedDigest:prepared.preparedDigest,direction:kind,scopeDigest:digest(args.scope),attemptedAtMillis:state.now,
        sourceDigest:source().sourceDigest};state.manifests.push(manifest);return manifest;
    };
    return {async inspect(options){onInspect(state,state.reads.length+1);const startedAtMillis=state.now;state.now+=5;
      const value=source();state.reads.push({options,startedAtMillis,observedAtMillis:state.now,value});return value;},
    forward:direction("forward"),inverse:direction("inverse")};
  };
  const module={exports:{}};
  const load=vm.runInThisContext(`(function(require,module,exports){${fs.readFileSync(filename,"utf8")}\n})`,{filename});
  load(name=>name==="./develop-shift-migration-engine.cjs"?{...realRequire(name),createDevelopShiftMigrationEngine:engine}:realRequire(name),module,module.exports);
  const executor=module.exports.createControlledDevelopMigrationExecutor({prepared,controlPlane,nowMillis:()=>state.now,
    firestore:{projectId:"reguerta-9f27f",databaseId:"(default)",runTransaction:async()=>{throw Error("unexpected provider transaction");}},
    failurePersistence:{readExistingFailure:async()=>null,retainFailureAndReadBack:async()=>{throw Error("unexpected incident write");}}});
  const scope=(direction="forward")=>({schemaVersion:3,environment:"develop",transitionId:direction==="forward"?prepared.operationId:prepared.recoveryOperationId,
    expectedWorkbookFileId:prepared.policyDraft.document.sync.partitions.delivery.workbookId,
    expectedWorkbookRevision:prepared.policyDraft.document.sync.partitions.delivery.workbookRevision,expectedAuthoritativeDigest:source().sourceDigest});
  return {executor,state,scope,prepared};
}

test("88.115 seconds of human collection precede two genuinely new technical reads and the unchanged TTL",async()=>{
  const f=admissionFixture(),scope=f.scope(),collectionStarted=f.state.now,admission=await f.executor.inspectAdmission({scope});
  assert.equal(admission.checksPassed,true);assert.equal(admission.collectionStartedAtMillis,collectionStarted);
  assert.ok(admission.startedAtMillis-collectionStarted>=88_115);
  assert.equal(f.state.reads.length,3);assert.deepEqual(f.state.humanReads,["owner","administrator"]);
  assert.equal(admission.startedAtMillis,f.state.reads[1].startedAtMillis);
  assert.equal(admission.observedAtMillis,f.state.reads[2].observedAtMillis);
  assert.deepEqual(admission.finalManifest,f.state.manifests[0]);
  const attemptedAt=admission.finalManifest.attemptedAtMillis;f.state.now+=15_000; // Writer mint/probe latency, not a timestamp rewrite.
  const result=await f.executor.execute({scope,admission,assertMutation:()=>{}});
  assert.equal(result.verified,true);assert.equal(f.state.executions.length,1);
  assert.equal(f.state.executions[0].args.finalManifest.attemptedAtMillis,attemptedAt);
});

for(const read of [2,3])test(`source CAS drift at final technical read ${read-1} rejects admission`,async()=>{
  const f=admissionFixture({onInspect:(state,count)=>{if(count===read)state.casVersion++;}}),scope=f.scope();
  const admission=await f.executor.inspectAdmission({scope});
  assert.equal(admission.checksPassed,false);assert.deepEqual(admission.blockers,["admission_not_proven"]);
  assert.equal(admission.finalManifest,null);assert.equal(f.state.executions.length,0);
});

test("a technical validation lasting over sixty seconds is not reported as passed",async()=>{
  const f=admissionFixture({onInspect:(state,count)=>{if(count===3)state.now+=60_001;}});
  const admission=await f.executor.inspectAdmission({scope:f.scope()});
  assert.equal(admission.checksPassed,false);assert.deepEqual(admission.blockers,["admission_not_proven"]);
  assert.equal(admission.finalManifest,null);assert.equal(f.state.executions.length,0);
});

test("sixty seconds after technical validation still expire without executing or renewing human reports",async()=>{
  const f=admissionFixture(),scope=f.scope(),admission=await f.executor.inspectAdmission({scope});
  f.state.now=admission.startedAtMillis+60_001;
  await assert.rejects(f.executor.execute({scope,admission,assertMutation:()=>{}}),/inspection expired/);
  assert.equal(f.state.executions.length,0);assert.equal(f.state.reads.length,3);
  assert.deepEqual(f.state.humanReads,["owner","administrator"]);
});

test("fresh technical validation retains inverse receipt and forward scope restrictions",async()=>{
  const f=admissionFixture(),scope=f.scope("inverse"),missing=await f.executor.inspectAdmission({direction:"inverse",scope});
  assert.deepEqual(missing.blockers,["forward_receipt_missing"]);assert.equal(f.state.humanReads.length,0);
  const forwardReadBack={receiptDigest:digest("independently supplied forward receipt")};
  const admission=await f.executor.inspectAdmission({direction:"inverse",scope,forwardReadBack});
  assert.equal(admission.checksPassed,true);assert.equal(admission.finalManifest.direction,"inverse");
  await assert.rejects(f.executor.execute({scope:f.scope(),admission,forwardReadBack,assertMutation:()=>{}}));
  assert.equal(f.state.executions.length,0);
  assert.equal((await f.executor.execute({scope,admission,forwardReadBack,assertMutation:()=>{}})).direction,"inverse");
  assert.deepEqual(f.state.executions[0].args.forwardReadBack,forwardReadBack);
});

module.exports={admissionFixture};
