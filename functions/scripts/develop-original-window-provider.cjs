"use strict";

// Original develop only. No credential lookup, permission API or live CLI.
const assert=require("node:assert/strict");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {FILE,PARENT,TABS,createOwnerReader,validateMetadata,metadataFingerprint}=require("./develop-original-writer-provider.cjs");
const {createDevelopOwnerObservationSession,normalizePreservationSnapshot,PRESERVATION_FIELDS}=require("./develop-google-observations.cjs");
const {planBatch}=require("./prepare-develop-helper-batch.cjs");

function createOriginalWindowOwner({ownerBearer,fetchImpl,nowMillis,sleep}) {
  assert.equal(typeof fetchImpl,"function");
  let reader=createOwnerReader({ownerBearer,fetchImpl});
  const revoker=createDevelopOwnerObservationSession({ownerBearer,fetchImpl,nowMillis,sleep});
  let closed=false;
  const read=async()=>{assert.equal(closed,false);return reader.read();};
  async function get(params) {
    assert.equal(closed,false);assert.equal(params.spreadsheetId,FILE);
    const q=new URLSearchParams({fields:params.fields});for(const r of params.ranges??[])q.append("ranges",r);
    try {
      const r=await fetchImpl(`https://sheets.googleapis.com/v4/spreadsheets/${FILE}?${q}`,{method:"GET",redirect:"error",
        signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${ownerBearer}`}});
      assert.equal(r.status,200);return {data:await r.json()};
    } catch {throw Error("original_owner_read_unavailable");}
  }
  async function capture(writerPresent) {
    assert.equal(typeof writerPresent,"boolean");const startedAtMillis=nowMillis();
    const before=await read();validateMetadata(before,writerPresent);
    assert.equal(before.file.owners[0].me,true);assert.equal(before.parent.owners[0].me,true);
    const meta=(await get({spreadsheetId:FILE,fields:"spreadsheetId,sheets(properties)"})).data;
    assert.equal(meta.spreadsheetId,FILE);assert.deepEqual(meta.sheets.map(s=>({id:s.properties.sheetId,title:s.properties.title})),TABS);
    const ranges=meta.sheets.map(s=>{
      const g=s.properties.gridProperties;assert.ok(Number.isSafeInteger(g.rowCount)&&g.rowCount>0&&g.rowCount<=10000);
      assert.ok(Number.isSafeInteger(g.columnCount)&&g.columnCount>0&&g.columnCount<=26);
      return `'${s.properties.title}'!A1:${String.fromCharCode(64+g.columnCount)}${g.rowCount}`;
    });
    const params={spreadsheetId:FILE,fields:PRESERVATION_FIELDS,ranges};
    const first=(await get(params)).data,second=(await get(params)).data;assert.deepEqual(first,second,"Owner cells changed");
    assert.deepEqual(first.sheets.map(s=>s.properties),meta.sheets.map(s=>s.properties));
    const after=await read();validateMetadata(after,writerPresent);
    assert.equal(metadataFingerprint(before),metadataFingerprint(after),"Owner authority/version changed");
    const observedAtMillis=nowMillis();assert.ok(observedAtMillis>=startedAtMillis&&observedAtMillis-startedAtMillis<60000);
    const snapshot=normalizePreservationSnapshot(first);
    return {kind:"develop-owner-window-observation",fileId:FILE,parentId:PARENT,before,after,snapshot,
      snapshotDigest:digest(snapshot),metadataDigest:metadataFingerprint(after),preservationFields:PRESERVATION_FIELDS,
      startedAtMillis,observedAtMillis,readOnly:true,canApply:false,canEnterMaintenance:false};
  }
  return {read,capture,sheets:{get},close(){closed=true;ownerBearer=null;reader=null;return revoker.close();}};
}

// Permission-only version movement is evidenced, not hidden behind a synthetic
// Drive version. Planning still uses the reviewed baseline; execution uses the
// actual post-grant version and identical complete cell image.
async function planOriginalWindowBatch({sourceInput,reviewPackage,observation,direction,forwardPlan,permissionTransition}) {
  const {before,after}=permissionTransition;
  for(const [v,present]of [[before,false],[after,true]]) {
    assert.equal(v.fileId,FILE);assert.equal(v.snapshotDigest,digest(v.snapshot));
    validateMetadata(v.before,present);validateMetadata(v.after,present);
    assert.equal(metadataFingerprint(v.before),metadataFingerprint(v.after));
  }
  assert.deepEqual(before.snapshot,after.snapshot,"Permission transition changed cells");
  assert.equal(metadataFingerprint(before.after,{omitWriter:true,omitVersion:true}),metadataFingerprint(after.after,{omitWriter:true,omitVersion:true}));
  assert.equal(observation.snapshotDigest,after.snapshotDigest);assert.deepEqual(observation.snapshot,after.snapshot);
  assert.equal(metadataFingerprint(observation.after),metadataFingerprint(after.after));
  const planned=await planBatch({sourceInput,reviewPackage,observation:before,direction,forwardPlan});
  const {planDigest:ignored,...body}=planned;void ignored;
  const value={...body,observedVersion:after.after.file.version,permissionTransitionDigest:digest(permissionTransition)};
  return {...value,planDigest:digest(value)};
}

function openOriginalWindowWriter({bearer,expiresAtMillis,fetchImpl,nowMillis,assertSubmission,authorizeBatch}) {
  assert.equal(typeof fetchImpl,"function");assert.equal(typeof authorizeBatch,"function");
  assert.ok(typeof bearer==="string"&&bearer.length);
  assert.ok(Number.isSafeInteger(expiresAtMillis)&&expiresAtMillis>nowMillis());
  let attempted=false,closed=false;
  async function request(url,method="GET",body) {
    assert.equal(closed,false);assert.ok(nowMillis()<expiresAtMillis);
    try {
      const r=await fetchImpl(url,{method,redirect:"error",signal:AbortSignal.timeout(method==="POST"?30000:15000),
        headers:{Authorization:`Bearer ${bearer}`,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
      let data=null;try{data=await r.json();}catch{/* Unknown response cannot prove execution. */}
      return {status:r.status,data};
    } catch {throw Error("original_writer_response_uncertain");}
  }
  return {close(){closed=true;bearer=null;},async probe(){
    const r=await request(`https://www.googleapis.com/drive/v3/files/${FILE}?fields=id`);
    if(r.status===200)assert.equal(r.data?.id,FILE);return {status:r.status};
  },sheets:{async get(params,options){
    assert.equal(params.spreadsheetId,FILE);assert.equal(options.retry,false);
    const q=new URLSearchParams({fields:params.fields});for(const r of params.ranges??[])q.append("ranges",r);
    const response=await request(`https://sheets.googleapis.com/v4/spreadsheets/${FILE}?${q}`);assert.equal(response.status,200);return {data:response.data};
  },async batchUpdate(params,options){
    assert.equal(params.spreadsheetId,FILE);assert.equal(options.retry,false);assert.equal(attempted,false,"Original batch already attempted");
    attempted=true;
    const body=structuredClone(params.requestBody);await authorizeBatch(body);assertSubmission();
    // // Consume before dispatch, including an unknown response.
    const r=await request(`https://sheets.googleapis.com/v4/spreadsheets/${FILE}:batchUpdate`,"POST",body);
    assert.equal(r.status,200);assert.equal(r.data?.spreadsheetId,FILE);assert.equal(r.data.replies?.length,55);return {data:r.data};
  }}};
}
module.exports={createOriginalWindowOwner,planOriginalWindowBatch,openOriginalWindowWriter};
if(require.main===module){console.error("explicit_original_window_composition_required");process.exitCode=1;}
