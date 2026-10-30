"use strict";
const assert=require("node:assert/strict"),{test}=require("node:test");
const {fixture}=require("./develop-migration-package-fixture.cjs");
const {prepareDevelopMigrationPackage}=require("../scripts/prepare-develop-migration-package.cjs");
const {materializeControlledDevelopMigrationPreparation:prepare}=require("../scripts/materialize-develop-migration-package.cjs");
const {createControlledDevelopMigrationExecutor:create}=require("../scripts/controlled-develop-migration.cjs");
const rehearsal=require("../scripts/rehearse-develop-shift-migration.cjs");
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
