"use strict";
const assert=require("node:assert/strict");
const {batchFixture}=require("./develop-helper-batch-fixture.cjs");
const {FILE,PARENT,OWNER,WRITER,PERMISSION,READERS}=require("../scripts/develop-original-writer-provider.cjs");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {createOriginalWindowSessions}=require("../scripts/develop-original-window-session.cjs");
const {bindWindow}=require("../scripts/develop-controlled-window.cjs");
const {executeJointStep}=require("../scripts/develop-joint-execution.cjs");
function originalWindowFixture({batch=batchFixture(),fault=null}={}) {
  const state={now:1000000,permission:false,disabled:true,policy:{etag:"one",version:3,bindings:[]},revoked:new Set(),calls:[],mints:0,
    version:Number(batch.reviewPackage.forward.sheets.observedVersion),businessWrites:0,failCleanup:fault==="remove",lastPlan:null,failOAuth:fault==="oauth",ownerExpiries:new Map(),writerExpiry:0};
  const identity={email:WRITER,uniqueId:"110752956317536684858"};
  const owners=[{emailAddress:OWNER,permissionId:"fixture-owner",me:true}];
  const ownerPermission={id:"fixture-owner",emailAddress:OWNER,type:"user",role:"owner"};
  const reply=(data,status=200)=>new Response(JSON.stringify(data),{status});
  const fetchImpl=async(url,o)=>{
    state.now+=10;assert.ok(o.signal);assert.equal(o.redirect,"error");const u=new URL(url),body=o.body?.startsWith("{")?JSON.parse(o.body):null;
    state.calls.push({url,method:o.method});
    if(u.hostname==="oauth2.googleapis.com"){if(state.failOAuth&&new URLSearchParams(o.body).get("token").includes("first-window"))return reply({},503);state.revoked.add(new URLSearchParams(o.body).get("token"));return reply({});}
    const token=o.headers.Authorization.slice(7),isOwner=token.startsWith("fixture-owner-");
    if(state.revoked.has(token))return reply({},401);
    if(u.hostname==="iamcredentials.googleapis.com"){
      state.mints++;if(fault==="mint")throw Error("lost mint response");state.writerExpiry=state.now+300000;return reply({accessToken:"fixture-writer",expireTime:new Date(state.writerExpiry).toISOString()});}
    if(u.hostname==="iam.googleapis.com"){
      assert.ok(url.includes(identity.uniqueId));
      if(url.endsWith(":enable")){state.disabled=false;return reply({});}
      if(url.endsWith(":disable")){state.disabled=true;return reply({});}
      if(url.endsWith(":setIamPolicy")){state.policy={...body.policy,etag:"next"};return reply(state.policy);}
      if(url.endsWith(":getIamPolicy"))return reply(state.policy);
      if(url.endsWith(":testIamPermissions"))return reply({permissions:["iam.serviceAccounts.getAccessToken"]});
      if(u.pathname.endsWith("/keys"))return reply({keys:[]});return reply({...identity,disabled:state.disabled});
    }
    if(u.hostname==="cloudresourcemanager.googleapis.com")return reply(url.endsWith(":getIamPolicy")?{bindings:[]}:{projectId:"reguerta-9f27f"});
    if(["cloudfunctions.googleapis.com","run.googleapis.com"].includes(u.hostname))return reply({});
    assert.ok(u.pathname.includes(FILE)||u.pathname.includes(PARENT),"no production destination");
    if(!isOwner&&!state.permission)return reply({},404);
    if(u.hostname==="www.googleapis.com"){
      assert.equal(o.method,"GET","permissions are native-owner actions, not Drive API writes");
      if(u.pathname.endsWith("/permissions"))return reply({permissions:u.pathname.includes(PARENT)?[ownerPermission]:[ownerPermission,
        ...READERS.map((emailAddress,i)=>({id:`reader-${i}`,emailAddress,type:"user",role:"reader"})),
        ...(state.permission?[{id:PERMISSION,emailAddress:WRITER,type:"user",role:"writer"}]:[])]});
      if(u.searchParams.get("fields")==="id")return reply({id:FILE});
      return reply(u.pathname.includes(PARENT)?{id:PARENT,mimeType:"application/vnd.google-apps.folder",trashed:false,owners}:
        {id:FILE,mimeType:"application/vnd.google-apps.spreadsheet",trashed:false,owners,parents:[PARENT],version:String(state.version)});
    }
    assert.equal(u.hostname,"sheets.googleapis.com");
    if(o.method==="POST"){
      assert.equal(isOwner,false);const result=await batch.sheets.batchUpdate({spreadsheetId:FILE,requestBody:body},{retry:false});state.version++;
      if(["write","write-read"].includes(fault))throw Error("lost batch response");return reply({...result.data,replies:body.requests.map(()=>({}))});
    }
    if(fault==="write-read"&&batch.sheets.mutations.length)return reply({},503);
    if(isOwner){const raw=structuredClone(batch.sheets.state);raw.sheets.forEach(s=>{delete s.dataCoverage;});return reply(raw);}
    return reply((await batch.sheets.get({spreadsheetId:FILE,fields:u.searchParams.get("fields"),...(u.searchParams.has("ranges")?{ranges:u.searchParams.getAll("ranges")}:{})},{retry:false})).data);
  };
  const ownerChannel={kind:"native-drive-owner-sharing",reviewDigest:digest("reviewed-native-channel"),
    async grant(p,control){control?.assertActive();assert.equal(p.fileId,FILE);assert.equal(p.permissionId,PERMISSION);state.permission=true;state.version++;
      if(fault==="grant")throw Error("lost UI response");
      if(fault==="cells")batch.sheets.state.sheets[0].data[0].rowData[0].values[0].note="external change";},
    async remove(p,control){control?.assertActive();assert.equal(p.permissionId,PERMISSION);if(state.failCleanup)throw Error("unavailable native channel");state.permission=false;state.version++;}};
  const p={projectId:"demo-reguerta-hu084-migration",environment:"develop",liveExecutable:false,reviewPackageDigest:batch.reviewPackage.packageDigest,
    operationId:`request-${batch.reviewPackage.forward.operationId}`,recoveryOperationId:batch.reviewPackage.inverse.operationId};
  const prepared={...p,preparedDigest:digest(p)};
  const barrier={acquire:async()=>({acquired:true}),inspectRetained:async()=>({kind:"retained"})};
  const executor={inspectAdmission:async({direction})=>({checksPassed:true,direction,admissionDigest:digest("fixture-admission")}),
    inspectUncertain:async()=>({kind:state.businessWrites?"verified":"absent"}),
    executeJoint:async args=>executeJointStep({...args,prepared,executeFirestore:async()=>{state.businessWrites++;return {verified:true};},
      inspectFirestore:()=>executor.inspectUncertain()})};
  function args(direction="forward",previous=null){return {prepared,scope:{environment:"develop",transitionId:direction==="forward"?p.operationId:p.recoveryOperationId},direction,
    window:{startsAtMillis:state.now,endsAtMillis:state.now+600000},sourceInput:batch.sourceInput,reviewPackage:batch.reviewPackage,
    ...(previous?{forwardReadBack:previous.firestoreReceipt,forwardPlan:previous.plan}:{})};}
  function sessions(data,sessionId="owner-original",ports={}) {
    const expectedBinding=bindWindow(data);
    if(!state.ownerExpiries.has(sessionId))state.ownerExpiries.set(sessionId,state.now+3600000);
    return createOriginalWindowSessions({expectedBinding,authorization:{authorized:true,receiptId:data.receiptId??"first-window",bindingDigest:digest(expectedBinding),ownerChannelReviewDigest:ownerChannel.reviewDigest},
      ownerCredential:{sessionId,bearer:`fixture-owner-${sessionId}`,expiresAtMillis:state.ownerExpiries.get(sessionId)},iamBearer:"fixture-iam",ownerChannel,
      sourceInput:batch.sourceInput,reviewPackage:batch.reviewPackage,forwardPlan:data.forwardPlan,forwardReadBack:data.forwardReadBack,
      barrier,executor,nowMillis:()=>state.now,sleep:async ms=>{state.now+=ms;},...ports});
  }
  return {batch,state,args,sessions,fetchImpl,ownerChannel,barrier,executor};
}
module.exports={originalWindowFixture};
