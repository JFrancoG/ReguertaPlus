"use strict";

// Real adapter code, synthetic HTTP only. These are boundary checks, not live
// credential evidence or a claim that a complete Google window factory exists.
const assert=require("node:assert/strict");
const {test}=require("node:test");
const {createIamProvider}=require("../scripts/develop-writer-copy-provider.cjs");
const {createCopyTimeBudget}=require("../scripts/develop-copy-time-budget.cjs");
const {createDevelopOwnerObservationSession}=require("../scripts/develop-google-observations.cjs");
const {FILE,PARENT,OWNER,WRITER,PERMISSION,READERS,createOwnerReader,validateMetadata}=require("../scripts/develop-original-writer-provider.cjs");
const {grantFor,removeOwnGrant}=require("../scripts/prepare-develop-writer-rehearsal.cjs");
const IDENTITY={email:WRITER,uniqueId:"110752956317536684858"};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status});
function ownerHttp() {
  const owner={emailAddress:OWNER,permissionId:"fixture-owner",me:true};
  const ownerPermission={id:owner.permissionId,type:"user",role:"owner",emailAddress:OWNER};
  const state={revoked:new Set(),calls:[],writerPresent:true};
  const file={id:FILE,mimeType:"application/vnd.google-apps.spreadsheet",trashed:false,version:"300",parents:[PARENT],owners:[owner]};
  const parent={id:PARENT,mimeType:"application/vnd.google-apps.folder",trashed:false,owners:[owner]};
  const fetchImpl=async(url,options)=>{
    const u=new URL(url);assert.equal(options.redirect,"error");assert.ok(options.signal);
    state.calls.push({url,method:options.method});
    if(u.hostname==="oauth2.googleapis.com") {
      assert.equal(u.pathname,"/revoke");assert.equal(options.method,"POST");
      state.revoked.add(new URLSearchParams(options.body).get("token"));return response({});
    }
    assert.equal(options.method,"GET");assert.ok(u.pathname.includes(FILE)||u.pathname.includes(PARENT));
    const credential=options.headers.Authorization.slice(7);
    if(state.revoked.has(credential))return response({},401);
    if(u.hostname==="sheets.googleapis.com")return response({spreadsheetId:FILE});
    if(u.pathname.endsWith("/permissions"))return response({permissions:u.pathname.includes(PARENT)?[ownerPermission]:[
      ownerPermission,...READERS.map((emailAddress,i)=>({id:`reader-${i}`,type:"user",role:"reader",emailAddress})),
      ...(state.writerPresent?[{id:PERMISSION,type:"user",role:"writer",emailAddress:WRITER}]:[])]});
    return response(u.pathname.includes(PARENT)?parent:file);
  };
  return {state,fetchImpl};
}

test("the original reader supports cleanup inspection with its exact writer present; the read-only capture intentionally refuses it",async()=>{
  const f=ownerHttp(),reader=createOwnerReader({ownerBearer:"fixture-owner",fetchImpl:f.fetchImpl});
  validateMetadata(await reader.read(),true);
  const capture=createDevelopOwnerObservationSession({ownerBearer:"fixture-owner",fetchImpl:f.fetchImpl,nowMillis:()=>1000});
  await assert.rejects(capture.capture());
  assert.equal(f.state.calls.some(c=>c.url.includes("sheets.googleapis.com")),false,"fails before reading cells with an unexpected grant");
  assert.equal((await capture.close()).verified,true);
  assert.ok(f.state.calls.every(c=>c.method==="GET"||c.url==="https://oauth2.googleapis.com/revoke"));
});

test("revoking a replacement owner session cannot establish revocation of the lost session",async()=>{
  const f=ownerHttp(),lost=createOwnerReader({ownerBearer:"fixture-lost-owner",fetchImpl:f.fetchImpl});
  const replacement=createDevelopOwnerObservationSession({ownerBearer:"fixture-new-owner",fetchImpl:f.fetchImpl,nowMillis:()=>1000});
  assert.equal((await replacement.close()).verified,true);
  validateMetadata(await lost.read(),true); // Old credential is still accepted by this provider model.
  assert.deepEqual([...f.state.revoked],["fixture-new-owner"]);
  await lost.close();assert.deepEqual([...f.state.revoked],["fixture-new-owner","fixture-lost-owner"]);
});

function iamHttp({conflict=false}={}) {
  const owned=grantFor({startsAtMillis:1000,endsAtMillis:601000});
  const foreign={role:"roles/viewer",members:["user:other@example.test"]};
  const state={calls:[],disabled:false,policy:{etag:"current-etag",version:3,bindings:[owned,foreign]}};
  const fetchImpl=async(url,options)=>{
    const u=new URL(url);assert.equal(options.redirect,"error");assert.ok(options.signal);
    assert.ok(["iam.googleapis.com","cloudresourcemanager.googleapis.com"].includes(u.hostname),"cleanup has no token mint endpoint");
    assert.equal(options.headers.Authorization,"Bearer fixture-cleanup-iam");state.calls.push({url,method:options.method});
    if(u.hostname==="cloudresourcemanager.googleapis.com")return response(url.endsWith(":getIamPolicy")?{bindings:[]}:{projectId:"reguerta-9f27f"});
    assert.ok(u.pathname.includes(IDENTITY.uniqueId));
    if(url.endsWith(":getIamPolicy"))return response(state.policy);
    if(url.includes("/keys?"))return response({keys:[]});
    if(url.endsWith(":setIamPolicy")) {
      const body=JSON.parse(options.body);assert.equal(body.policy.etag,"current-etag");assert.equal(body.updateMask,"bindings,etag,version");
      if(conflict)return response({error:{message:"private-provider-error"}},409);
      state.policy={...body.policy,etag:"updated-etag"};return response(state.policy);
    }
    if(url.endsWith(":disable")){state.disabled=true;return response({});}
    assert.equal(options.method,"GET");return response({...IDENTITY,disabled:state.disabled});
  };
  return {state,owned,foreign,fetchImpl};
}

test("cleanup with a fresh explicit IAM credential removes only the retained grant and never enables or mints",async()=>{
  const f=iamHttp(),iam=createIamProvider({identity:IDENTITY,iamBearer:"fixture-cleanup-iam",fetchImpl:f.fetchImpl});
  const current=await iam.readIdentity();
  await iam.setPolicy(removeOwnGrant(current.policy,f.owned));await iam.disableOwned();
  const after=await iam.readIdentity();assert.equal(after.account.disabled,true);assert.deepEqual(after.policy.bindings,[f.foreign]);
  assert.ok(!f.state.calls.some(c=>/enable|generateAccessToken|testIamPermissions/.test(c.url)));
});

test("a real IAM transport CAS conflict is not retried and does not prevent separate disablement",async()=>{
  const f=iamHttp({conflict:true}),iam=createIamProvider({identity:IDENTITY,iamBearer:"fixture-cleanup-iam",fetchImpl:f.fetchImpl});
  const current=await iam.readIdentity();
  await assert.rejects(iam.setPolicy(removeOwnGrant(current.policy,f.owned)),e=>e.httpStatus===409&&!e.message.includes("private-provider-error"));
  await iam.disableOwned();const after=await iam.readIdentity();assert.equal(after.account.disabled,true);
  assert.deepEqual(after.policy.bindings,[f.owned,f.foreign],"disablement does not prove grant removal");
  assert.equal(f.state.calls.filter(c=>c.url.endsWith(":setIamPolicy")).length,1);
});

test("real parallel IAM reads are joined through the common budget before cleanup begins",async()=>{
  let finishKeys,keysStarted;
  const entered=new Promise(resolve=>{keysStarted=resolve;});
  const budget=createCopyTimeBudget({startsAtMillis:1000,endsAtMillis:601000,nowMillis:()=>1000,fetchImpl:async(url)=>{
    if(url.includes("/keys?")){keysStarted();return {status:200,text:()=>new Promise(resolve=>{finishKeys=()=>resolve('{"keys":[]}');})};}
    if(url.endsWith(":getIamPolicy"))return response({error:{}},503);
    if(url.includes("cloudresourcemanager"))return response({projectId:"reguerta-9f27f"});
    return response({...IDENTITY,disabled:true});
  }});
  const iam=createIamProvider({identity:IDENTITY,iamBearer:"fixture-cleanup-iam",fetchImpl:budget.fetch});
  const reading=iam.readIdentity();await entered;await assert.rejects(reading);
  let cleaned=false;const cleanup=budget.beginCleanup("file").then(()=>{cleaned=true;});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(cleaned,false);
  finishKeys();await cleanup;assert.equal(budget.complete().inFlight,0);
});
