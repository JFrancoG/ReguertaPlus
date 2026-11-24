"use strict";
// Explicit emulator-only child used to stop the process after a real commit.
const assert=require("node:assert/strict"),fs=require("node:fs");
const {Firestore}=require("@google-cloud/firestore");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {createControlledDevelopBarrierEmulator}=require("../scripts/controlled-develop-barrier.cjs");
const {createControlledDevelopMigrationEmulator}=require("../scripts/controlled-develop-migration.cjs");
const {runControlledWindow}=require("../scripts/develop-controlled-window.cjs");
const {createShiftSheetsAdapter}=require("../lib/shift-sheets.js");
const {createShiftSheetsConfig}=require("../lib/shift-sheets-config.js");
const {sheetsService}=require("./shift-sheets-api-fixture.cjs");
assert.equal(process.env.GCLOUD_PROJECT,"demo-reguerta-hu084-migration");assert.equal(process.env.FIRESTORE_EMULATOR_HOST,"127.0.0.1:8798");
const input=JSON.parse(fs.readFileSync(process.argv[2],"utf8")),{prepared,scope,evidence,image}=input;
const db=new Firestore({projectId:process.env.GCLOUD_PROJECT,host:process.env.FIRESTORE_EMULATOR_HOST,ssl:false});
const barrier=createControlledDevelopBarrierEmulator({firestore:db,prepared,nowMillis:()=>520,openObservationSession:async()=>({
  readEvidence:async()=>structuredClone(evidence),readOwnerObservation:async()=>structuredClone(evidence.payload.ownerObservation),
  readAdministratorObservation:async()=>structuredClone(evidence.payload.administratorObservation),close:async()=>{}})});
const executor=createControlledDevelopMigrationEmulator({firestore:db,prepared,controlPlane:barrier.controlPlane,failurePersistence:barrier.failurePersistence,nowMillis:()=>520});
const sheets=sheetsService(image.fileId);sheets.state=structuredClone(image.snapshot);
const sheetsAdapter=createShiftSheetsAdapter({config:createShiftSheetsConfig({environment:"develop",workbooks:{develop:image.fileId}}),sheets});
let now=1000000;
runControlledWindow({root:input.root,receiptId:"crash-after-commit",prepared,scope,direction:"forward",sourceInput:input.sourceInput,reviewPackage:input.reviewPackage,
  window:{startsAtMillis:now,endsAtMillis:now+600000},nowMillis:()=>now,openSession:async({record})=>{
    await record({phase:"fixture-grant-intent",scope:"local-only"});fs.writeFileSync(input.accessFile,"granted");now+=120000;
    return {barrier,executor:{...executor,executeJoint:args=>executor.executeJoint({...args,record:async value=>{
      await args.record(value);if(value.phase==="firestore-receipt"){
        process.send("committed");await new Promise(()=>{setInterval(()=>{},1000);});
      }
    }})},sheetsAdapter,observeSheets:async()=>({...image,snapshot:structuredClone(sheets.state),snapshotDigest:digest(sheets.state)}),tokenExpiresAtMillis:now+300000,
    cleanup:Object.fromEntries(["file","iam","oauth"].map(k=>[k,async()=>{fs.writeFileSync(input.accessFile,"clean");return {verified:true};}]))};
  },openRecoverySession:async()=>{throw Error("must stop before cleanup");}})
  .then(()=>{process.send("unexpected-terminal");process.exitCode=1;},()=>{process.send("failed");process.exitCode=1;});
