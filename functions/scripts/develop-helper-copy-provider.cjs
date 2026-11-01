"use strict";
const assert=require("node:assert/strict");
const {FILE,PARENT,OWNER,WRITER,TABS}=require("./develop-original-writer-provider.cjs");
const {normalizePreservationSnapshot,PRESERVATION_FIELDS}=require("./develop-google-observations.cjs");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const PROTECTED_FILES=Object.freeze([FILE,"1bBJX9VqadOTFJ_HyKHLcsikFjytLr7jPu9GyFUJ1nwE"]);
function destination(fileId,protectedWorkbookIds) {
  assert.match(fileId,/^[A-Za-z0-9_-]{6,128}$/);assert.ok(protectedWorkbookIds.length>=2);
  assert.ok(PROTECTED_FILES.every(id=>protectedWorkbookIds.includes(id))&&!protectedWorkbookIds.includes(fileId));
}
async function http(fetchImpl,bearer,url,method="GET",body,timeout=15000) {
  assert.ok(typeof bearer==="string"&&bearer.length);
  try {
    const r=await fetchImpl(url,{method,redirect:"error",signal:AbortSignal.timeout(timeout),headers:{Authorization:`Bearer ${bearer}`,"Content-Type":"application/json"},
      ...(body===undefined?{}:{body:JSON.stringify(body)})});
    let data=null;try{data=await r.json();}catch{/* Never surface raw provider content. */}
    return {status:r.status,data};
  }catch{throw Error("isolated_copy_transport_unavailable");}
}
function urls(fileId) {
  return {drive:`https://www.googleapis.com/drive/v3/files/${fileId}`,sheets:`https://sheets.googleapis.com/v4/spreadsheets/${fileId}`};
}
function snapshotQuery(fileId) {
  const q=new URLSearchParams({fields:PRESERVATION_FIELDS});
  for(const t of TABS)q.append("ranges",`'${t.title}'!A1:Z1000`);
  return urls(fileId).sheets+"?"+q;
}
function createCopyOwner({fileId,protectedWorkbookIds,ownerBearer,fetchImpl=fetch,nowMillis=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms))}) {
  destination(fileId,protectedWorkbookIds);const u=urls(fileId);let bearer=ownerBearer,closing=null;
  const request=async(url,method,body)=>{const r=await http(fetchImpl,bearer,url,method,body);
    if(![200,204].includes(r.status))throw Object.assign(Error("isolated_owner_request_denied"),{httpStatus:r.status});return r.data;};
  async function metadata(writer) {
    const file=await request(u.drive+"?fields=id,mimeType,trashed,version,parents,owners(emailAddress,permissionId,me)");
    assert.equal(file.id,fileId);assert.equal(file.trashed,false);assert.equal(file.mimeType,"application/vnd.google-apps.spreadsheet");
    assert.deepEqual(file.parents,[PARENT]);assert.equal(file.owners.length,1);assert.equal(file.owners[0].emailAddress,OWNER);assert.equal(file.owners[0].me,true);
    const value=await request(u.drive+"/permissions?fields=nextPageToken,permissions(id,type,role,emailAddress)");assert.ok(!value.nextPageToken);
    const expected=[{id:file.owners[0].permissionId,type:"user",role:"owner",emailAddress:OWNER}];
    const grant=value.permissions.find(p=>p.emailAddress===WRITER);
    if(writer){assert.ok(grant);expected.push({id:grant.id,type:"user",role:"writer",emailAddress:WRITER});}
    const sorted=a=>[...a].sort((a,b)=>a.id.localeCompare(b.id));assert.deepEqual(sorted(value.permissions),sorted(expected));
    return {file,permissions:value.permissions,grant:grant??null};
  }
  return {async observe(writer) {
    const before=await metadata(writer),raw=await request(snapshotQuery(fileId));
    assert.equal(raw.spreadsheetId,fileId);assert.deepEqual(raw.sheets.map(s=>({id:s.properties.sheetId,title:s.properties.title})),TABS);
    const after=await metadata(writer);assert.equal(digest(before),digest(after));
    return {version:after.file.version,snapshot:normalizePreservationSnapshot(raw,fileId),metadata:after,observedAtMillis:nowMillis()};
  },async grant() {
    await metadata(false);
    return request(u.drive+"/permissions?sendNotificationEmail=false&fields=id,type,role,emailAddress","POST",{type:"user",role:"writer",emailAddress:WRITER});
  },async remove(permission) {
    // A lost grant response is reconciled by the unique new writer absent at baseline.
    const v=await request(u.drive+"/permissions?fields=nextPageToken,permissions(id,type,role,emailAddress)");assert.ok(!v.nextPageToken);
    const found=v.permissions.filter(p=>p.emailAddress===WRITER);assert.ok(found.length<=1);
    if(found.length){assert.equal(found[0].type,"user");assert.equal(found[0].role,"writer");
      if(permission)assert.equal(found[0].id,permission.id);await request(u.drive+`/permissions/${found[0].id}`,"DELETE");}
    await metadata(false);
  },close(){return closing??=(async()=>{
    const startedAtMillis=nowMillis(),attempts=[];
    try{
      const revoked=await fetchImpl("https://oauth2.googleapis.com/revoke",{method:"POST",redirect:"error",signal:AbortSignal.timeout(15000),
        headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({token:bearer}).toString()});
      assert.equal(revoked.status,200);
      for(let n=0;n<13&&nowMillis()<startedAtMillis+120000;n++){
        const remaining=startedAtMillis+120000-nowMillis();
        const responses=await Promise.all([u.drive+"?fields=id",u.sheets+"?fields=spreadsheetId"].map(async url=>{
          try{return (await http(fetchImpl,bearer,url,"GET",undefined,Math.min(10000,remaining))).status;}catch{return null;}}));
        attempts.push({atMillis:nowMillis(),drive:responses[0],sheets:responses[1]});
        if(responses.every(s=>s===401)&&nowMillis()<=startedAtMillis+120000)return {verified:true,startedAtMillis,finishedAtMillis:nowMillis(),attempts};
        if(nowMillis()+10000>=startedAtMillis+120000)break;await sleep(10000);
      }
      throw Error("denial_unproven");
    }catch{throw Object.assign(Error("copy_owner_cleanup_unproven"),{cleanup:{verified:false,attempts}});}
    finally{bearer=null;ownerBearer=null;}
  })();}};
}
function openCopyWriter({fileId,protectedWorkbookIds,bearer,expiresAtMillis,fetchImpl=fetch,nowMillis=Date.now}) {
  destination(fileId,protectedWorkbookIds);const u=urls(fileId);let batches=0;
  const request=async(url,method,body,timeout)=>{assert.ok(nowMillis()<expiresAtMillis);return http(fetchImpl,bearer,url,method,body,timeout);};
  return {probe:async()=>{const r=await request(u.drive+"?fields=id");if(r.status===200)assert.equal(r.data.id,fileId);return {status:r.status};},close(){bearer=null;},sheets:{
    async get(params,options) {
      assert.equal(params.spreadsheetId,fileId);assert.equal(options.retry,false);
      const q=new URLSearchParams({fields:params.fields});for(const r of params.ranges??[])q.append("ranges",r);
      const result=await request(u.sheets+"?"+q);if(result.status!==200)throw Error("copy_read_unavailable");return {data:result.data};
    },async batchUpdate(params,options) {
      assert.equal(params.spreadsheetId,fileId);assert.equal(options.retry,false);assert.ok(batches<2);batches++;
      const requests=params.requestBody.requests;assert.equal(requests.length,55);
      assert.equal(requests.filter(r=>r.updateCells).length,53);
      assert.ok(requests.every(r=>r.updateCells||r.createDeveloperMetadata||r.updateDeveloperMetadata));
      const result=await request(u.sheets+":batchUpdate","POST",params.requestBody,30000);
      if(result.status!==200)throw Error("copy_submission_requires_inspection");return {data:result.data};
    },
  }};
}
function createIsolationReader({iamBearer,fetchImpl=fetch,nowMillis=Date.now}) {
  const project="reguerta-9f27f";
  const resources=[
    ["functions",`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/-/functions`],
    ["services",`https://run.googleapis.com/v1/projects/${project}/locations/-/services?limit=100`],
    ["jobs",`https://run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${project}/jobs?limit=100`],
    ["workerpools",`https://run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${project}/workerpools?limit=100`],
    ["instances",`https://run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${project}/instances?limit=100`],
  ];
  return async()=>{
    const observations=await Promise.all(resources.map(async([kind,url])=>{
      const r=await http(fetchImpl,iamBearer,url);assert.equal(r.status,200);assert.ok(r.data&&!r.data.nextPageToken&&!r.data.metadata?.continue&&!r.data.unreachables?.length&&!r.data.unreachable?.length);
      if(!["services","functions"].includes(kind))assert.deepEqual(r.data.items??[],[]);
      assert.ok(!JSON.stringify(r.data).includes(WRITER),"Writer occurs in a runtime inventory");
      return {kind,data:r.data};
    }));
    return {writerEmail:WRITER,writerIsolated:true,observedAtMillis:nowMillis(),scope:"reviewed-global-functions-and-cloud-run",
      inventoryDigest:digest(observations)};
  };
}
module.exports={createCopyOwner,openCopyWriter,createIsolationReader,PROTECTED_FILES};
if(require.main===module){console.error("explicit_isolated_copy_credentials_required");process.exitCode=1;}
