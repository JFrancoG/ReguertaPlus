"use strict";
// Real Firestore emulator, concrete Google providers on synthetic HTTP only.
const assert=require("node:assert/strict"),fs=require("node:fs");
const {Firestore}=require("@google-cloud/firestore");
const {createControlledDevelopBarrierEmulator}=require("../scripts/controlled-develop-barrier.cjs");
const {createControlledDevelopMigrationEmulator}=require("../scripts/controlled-develop-migration.cjs");
const {runControlledWindow}=require("../scripts/develop-controlled-window.cjs");
const {sheetsService}=require("./shift-sheets-api-fixture.cjs");
const {originalWindowFixture}=require("./develop-original-window-fixture.cjs");
assert.equal(process.env.GCLOUD_PROJECT,"demo-reguerta-hu084-migration");assert.equal(process.env.FIRESTORE_EMULATOR_HOST,"127.0.0.1:8798");
const input=JSON.parse(fs.readFileSync(process.argv[2])),{prepared,scope,evidence,image}=input;
const db=new Firestore({projectId:process.env.GCLOUD_PROJECT,host:process.env.FIRESTORE_EMULATOR_HOST,ssl:false});
const barrier=createControlledDevelopBarrierEmulator({firestore:db,prepared,nowMillis:()=>520,openObservationSession:async()=>({
  readEvidence:async()=>structuredClone(evidence),readOwnerObservation:async()=>structuredClone(evidence.payload.ownerObservation),
  readAdministratorObservation:async()=>structuredClone(evidence.payload.administratorObservation),close:async()=>{}})});
const core=createControlledDevelopMigrationEmulator({firestore:db,prepared,controlPlane:barrier.controlPlane,failurePersistence:barrier.failurePersistence,nowMillis:()=>520});
const sheets=sheetsService(image.fileId);sheets.state=structuredClone(image.snapshot);
const g=originalWindowFixture({batch:{sourceInput:input.sourceInput,reviewPackage:input.reviewPackage,sheets}});
const data={...g.args(),receiptId:"concrete-crash",prepared,scope};
const executor={...core,executeJoint:args=>core.executeJoint({...args,record:async value=>{
  await args.record(value);if(value.phase==="firestore-receipt"){
    fs.writeFileSync(input.remoteState,JSON.stringify({permission:g.state.permission,disabled:g.state.disabled,policy:g.state.policy,version:g.state.version}),{mode:0o600});
    process.send("committed");await new Promise(()=>{setInterval(()=>{},1000);});
  }
}})};
runControlledWindow({...data,...g.sessions(data,"crashed-owner-session",{barrier,executor}),root:input.root,receiptId:"concrete-crash",fetchImpl:g.fetchImpl,nowMillis:()=>g.state.now})
  .then(()=>{process.send("unexpected-terminal");process.exitCode=1;},()=>{process.send("failed");process.exitCode=1;});
