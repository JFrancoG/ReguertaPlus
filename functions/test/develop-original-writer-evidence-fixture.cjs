"use strict";
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {prepare, IDENTITY}=require("../scripts/prepare-develop-original-writer-check.cjs");
const {FILE,PARENT,OWNER,READERS,TABS,REQUEST,metadataFingerprint,snapshot}=require("../scripts/develop-original-writer-provider.cjs");
function metadata() {
  const owners = [{emailAddress: OWNER, permissionId: "owner-id", me: true}];
  const ownerPermission = {id: "owner-id", type: "user", role: "owner", emailAddress: OWNER};
  return {file: {id: FILE, mimeType: "application/vnd.google-apps.spreadsheet", trashed: false,
    version: "278", parents: [PARENT], owners, capabilities: {canEdit: true, canModifyContent: true, canShare: true}},
  filePermissions: [ownerPermission, ...READERS.map((emailAddress, i) => ({id: `reader-${i}`, emailAddress, type: "user", role: "reader"}))]
    .sort((a, b) => a.id.localeCompare(b.id)),
  parent: {id: PARENT, mimeType: "application/vnd.google-apps.folder", trashed: false, version: "99", owners},
  parentPermissions: [ownerPermission]};
}
function grid() {
  return {spreadsheetId: FILE, properties: {locale: "es_ES"}, sheets: TABS.map((tab, index) => ({
    properties: {sheetId: tab.id, title: tab.title, index, gridProperties: {rowCount: 1000, columnCount: tab.id === 1770956648 ? 25 : 26}},
    data: [{rowData: [{values: [{userEnteredValue: {stringValue: "Fecha"}, note: "preserve note"}]}]}],
  }))};
}

function originalWriterEvidence() {
 const preparation=prepare(),ownerBefore=metadata(),ownerAfter=metadata(),rawBefore=grid();
 ownerAfter.file.version="281"; const raw=snapshot(rawBefore),controlsDigest=digest("controls");
 const approval={...preparation.approvalTemplate,authorized:true,receiptId:"original-fixture-receipt",preparationDigest:preparation.preparationDigest,
  startsAtMillis:1000000,endsAtMillis:1600000,onlineClosedNoOfflineEdits:true,noOtherWritesOrTokens:true,
  baselineSnapshotDigest:raw.digest,baselineMetadataDigest:metadataFingerprint(ownerBefore),controlsDigest};
 const result={kind:"original-probe-contained",failure:null,cleanupFailures:[],mintAttempted:true,writeAttempted:true,writeVerified:true,
  canRetry:false,canEnterMaintenance:false,grantsMigrationAuthority:false};
 const identity={account:{...IDENTITY,disabled:true},project:{projectId:"reguerta-9f27f"},keys:{},policy:{etag:"fixture"},projectPolicy:{bindings:[]}};
 const controls={controlsDigest,writerIsolated:true,developFencesHeld:true,maintenanceAdmitted:false,globalDrainProven:false};
 return {preparation,approval,result,receipts:{terminal:structuredClone(result),"mint-intent":{attempt:1,request:preparation.tokenRequest},
  "token-issued":{expiresAtMillis:1500000,tokenRetained:false},"file-denied":{status:404,sameUnexpiredToken:true},
  "owner-oauth-cleanup":{verified:true,sameTokenStatus:401},"baseline-snapshot-comparison":{expectedDigest:raw.digest,actualDigest:raw.digest},
  "post-write-observation":{beforeDigest:raw.digest,afterDigest:raw.digest},"write-intent":{fileId:FILE,requestDigest:digest(REQUEST()),baseline:raw.digest},
  "writer-capabilities":{canEdit:true,canModifyContent:true,canShare:true},"writer-metadata-comparison":{writerDigest:digest("metadata"),ownerDigest:digest("metadata")}},
  rawBefore,rawRepeat:structuredClone(rawBefore),capture:{kind:"independent-owner-readonly-raw-sheets",reads:2,preservesEmptyObjects:true,
   snapshotDigest:raw.digest,selectedCells:raw.selectedCells,
   fields:"spreadsheetId,properties(title,locale,timeZone),sheets(properties(sheetId,title,index,sheetType,gridProperties),data(startRow,startColumn,rowData(values(userEnteredValue,note,userEnteredFormat))))",
   ranges:TABS.map(t=>`'${t.title}'!A1:${t.id===1770956648?"Y":"Z"}100`),startedAtMillis:995000,observedAtMillis:996000},ownerBefore,ownerAfter,
  uiGrant:{id:1,success:true,at:new Date(1010000).toISOString(),evidenceFile:"/fixture/granted-owner-private.json"},
  uiRemove:{id:2,success:true,at:new Date(1300000).toISOString(),evidenceFile:"/fixture/restored-owner-private.json"},
  identityBefore:identity,identityAfter:{completedAt:new Date(1310000).toISOString(),identity:structuredClone(identity),readOnly:true,projectId:"reguerta-9f27f",unchangedBeforeAfter:true,
   inventory:["services","jobs","workerpools","instances"].map(kind=>({kind,status:200,data:{items:[]}}))},
  controlsBefore:controls,controlsAfter:structuredClone(controls)};
}
const withOriginalWriter=input=>{const originalWriterCheck=originalWriterEvidence();return {...input,originalWriterCheck,
 reviewedOriginalWriterCheckDigest:digest(originalWriterCheck)};};
module.exports={originalWriterEvidence,withOriginalWriter};
