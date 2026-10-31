"use strict";
const {prepare, PROJECT, EMAIL, DEMO} = require("../scripts/prepare-develop-writer-rehearsal.cjs");
const {createShiftPlanningDigest:digest} = require("../lib/shift-planning-digest.js");
const WORKBOOK = "1O7VKs7S4wZHVvTfNBehAd5EzF3Mgw2q9LweK68Gm76A";
function writerEvidence() {
  const preparation=prepare(), fileId="synthetic-copy-only", ownerEmail="testplusprojects@gmail.com";
  const identity={email:EMAIL,uniqueId:"123456789012345678901"};
  const snapshot={spreadsheetId:fileId,sheets:Array.from({length:7},(_,i)=>({properties:{sheetId:100+i}}))};
  const before={version:"12",snapshot,digest:digest(snapshot)}, after={...structuredClone(before),version:"13"};
  const batch={workbookId:fileId,runtimeEmail:EMAIL,runtimePermissionId:"copy-writer",ownerEmail,ownerPermissionId:"copy-owner",
    expectedRows:10,requests:45,canApply:false,originalTabsDigest:before.digest,title:"Synthetic market"};
  const result={kind:"completed-and-contained",primaryFailure:null,failureDetails:null,cleanupFailures:[],mintAttempted:true,
    canRetry:false,canEnterMaintenance:false,outcome:{kind:"completed",submitted:1,preservedOriginalTabs:7,expectedRows:10,title:batch.title}};
  const command={state:"completed",workbookId:fileId,type:"market",workbookRevision:"12",commandId:"copy-command",commandDigest:digest("command"),
    terminal:{readBackWorkbookRevision:"13",readBackPartitionDigest:digest("partition")}};
  const initial={observedAtMillis:900,account:{...identity,projectId:PROJECT,disabled:true},project:{projectId:PROJECT},
    keys:{},policy:{},projectPolicy:{bindings:[]}};
  return {preparation,input:{approval:{kind:"authorized-single-synthetic-copy-rehearsal",preparationDigest:preparation.preparationDigest},
    identity,copy:{fileId,ownerEmail,ownerPermissionId:"copy-owner",permissionId:"copy-writer",baselineDigest:before.digest},
    protectedWorkbookIds:[WORKBOOK,"protected-production"],window:{startsAtMillis:1000,endsAtMillis:601000}},
    result,terminal:{at:1300,body:structuredClone(result)},reviewedBatch:{at:1150,body:batch},
    tokenIssued:{at:1110,body:{issuedAtMillis:1100,expiresAtMillis:301100,tokenRetained:false}},
    accessRemoved:{at:1200,body:{originalTokenUnexpired:true,status:404}}, before,after,
    child:{submitted:1,inFlight:0,unknown:0,result:{kind:"completed",command},originalTabsAfter:structuredClone(after),
      receipt:{command:structuredClone(command),readable:{rows:Array.from({length:10},(_,i)=>({id:`row-${i}`}))},
        evidence:{workbookRevision:"13",partitionDigest:command.terminal.readBackPartitionDigest}}},
    identityBefore:initial,identityAfter:{...structuredClone(initial),observedAtMillis:1500},
    permissionsAfter:{permissions:[{id:"copy-owner",type:"user",emailAddress:ownerEmail,role:"owner"}]},
    oauthRevoked:{at:1400,revokeStatus:200,sameTokenProbe:401,refreshTokenRequested:false},
    wrapperCleanup:{at:1400,failures:[],canRetry:false,canEnterMaintenance:false},
    localFinal:{demoProjectId:DEMO,notificationEvents:0,marketCommands:1,marketState:"completed"}};
}
const withWriter = input => {
  const writerRehearsal=writerEvidence();
  return {...input,writerRehearsal,reviewedWriterRehearsalDigest:digest(writerRehearsal)};
};
module.exports={writerEvidence,withWriter,WORKBOOK};
