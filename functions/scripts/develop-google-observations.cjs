"use strict";

// Explicit read credentials only. No ADC, IAM grant, token mint or apply CLI.
const assert=require("node:assert/strict");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {FILE,PARENT,TABS,WRITER,createOwnerReader,validateMetadata,metadataFingerprint,snapshot}=require("./develop-original-writer-provider.cjs");
const {readShiftSheetsSnapshot}=require("../lib/shift-sheets.js");
const {createShiftSheetsConfig}=require("../lib/shift-sheets-config.js");
const PROJECT="reguerta-9f27f";
const PRESERVATION_FIELDS="spreadsheetId,properties(title,locale,timeZone),sheets(properties,protectedRanges,merges,developerMetadata,data(startRow,startColumn,rowData(values(userEnteredValue,userEnteredFormat,note,textFormatRuns,dataValidation))))";
const LEGACY_FIELDS="spreadsheetId,properties(title,locale,timeZone),sheets(properties(sheetId,title,index,sheetType,gridProperties),data(startRow,startColumn,rowData(values(userEnteredValue,note,userEnteredFormat))))";
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==="object"?Object.fromEntries(Object.keys(x).sort().map(k=>
  [k,k==="eventFilters"?[...x[k]].sort((a,b)=>a.attribute.localeCompare(b.attribute)):canonical(x[k])])):x;
const stable=x=>digest(canonical(x));
const clock=now=>{const n=now();assert.ok(Number.isSafeInteger(n)&&n>=0);return n;};
// Only for a response to the complete preservation field mask/ranges above.
// Google omits empty repeated fields. Retain cell objects and unknown properties.
function normalizePreservationSnapshot(raw,expectedFileId=FILE) {
  assert.equal(raw.spreadsheetId,expectedFileId);
  return {...structuredClone(raw),sheets:raw.sheets.map(s=>({...structuredClone(s),dataCoverage:"complete",
    protectedRanges:structuredClone(s.protectedRanges??[]),merges:structuredClone(s.merges??[]),developerMetadata:structuredClone(s.developerMetadata??[]),
    data:(s.data??[]).map(d=>({...structuredClone(d),rowData:(d.rowData??[]).map(r=>({...structuredClone(r),values:structuredClone(r.values??[])}))}))}))};
}
function reviewedRangeSnapshot(raw) {
  return {...raw,sheets:raw.sheets.map(s=>{
      const properties=Object.fromEntries(["sheetId","title","index","sheetType","gridProperties"]
        .filter(k=>Object.hasOwn(s.properties,k)).map(k=>[k,s.properties[k]]));
      return {properties,data:(s.data??[]).filter(d=>(d.startRow??0)<100).map(d=>({...d,
        rowData:(d.rowData??[]).slice(0,100-(d.startRow??0)).map(r=>({values:(r.values??[]).map(c=>
          Object.fromEntries(["userEnteredValue","note","userEnteredFormat"].filter(k=>Object.hasOwn(c,k)).map(k=>[k,c[k]])))}))}))};
  })};
}
async function request(fetchImpl,bearer,url,method="GET",body) {
  assert.ok(typeof bearer==="string"&&bearer.length);
  try {
    const response=await fetchImpl(url,{method,redirect:"error",signal:AbortSignal.timeout(20000),
      headers:{Authorization:`Bearer ${bearer}`,"Content-Type":"application/json"},
      ...(body===undefined?{}:{body:JSON.stringify(body)})});
    if(response.status!==200)throw Object.assign(Error("Scoped Google read unavailable"),{httpStatus:response.status});
    return await response.json();
  } catch(error) {throw Object.assign(Error("Scoped Google observation failed"),{httpStatus:Number.isInteger(error?.httpStatus)?error.httpStatus:null});}
}
// Fixed project reads. Returned raw records are private evidence, never a drain
// declaration or consent. A full reviewed inventory must be supplied by the caller.
function createDevelopCloudReader({bearer,reviewed,fetchImpl=fetch,nowMillis=Date.now}) {
  const baseline=structuredClone(reviewed);
  assert.equal(baseline.projectId,PROJECT);assert.equal(baseline.readOnly,true);
  assert.equal(baseline.functions.length,24);assert.equal(baseline.jobs.length,3);
  const functions=baseline.functions.map(x=>x.data),jobs=baseline.jobs.map(x=>x.data);
  for(const [list,kind]of [[functions,"functions"],[jobs,"jobs"]]) {
    assert.equal(new Set(list.map(x=>x.name)).size,list.length);
    list.forEach(x=>assert.match(x.name,new RegExp(`^projects/${PROJECT}/locations/europe-west1/${kind}/[A-Za-z0-9_-]+$`)));
  }
  assert.match(baseline.rulesRelease.data.rulesetName,new RegExp(`^projects/${PROJECT}/rulesets/[A-Za-z0-9_-]+$`));
  const read=(host,path,method,body)=>request(fetchImpl,bearer,`https://${host}/${path}`,method,body);
  return {async read() {
    const startedAtMillis=clock(nowMillis);
    const [actualFunctions,actualJobs,release,rules,projectIam,invokerPolicy]=await Promise.all([
      Promise.all(functions.map(f=>read("cloudfunctions.googleapis.com",`v2/${f.name}`))),
      Promise.all(jobs.map(j=>read("cloudscheduler.googleapis.com",`v1/${j.name}`))),
      read("firebaserules.googleapis.com",`v1/projects/${PROJECT}/releases/cloud.firestore`),
      read("firebaserules.googleapis.com",`v1/${baseline.rulesRelease.data.rulesetName}`),
      read("cloudresourcemanager.googleapis.com",`v1/projects/${PROJECT}:getIamPolicy`,"POST",{options:{requestedPolicyVersion:3}}),
      read("iam.googleapis.com",`v1/projects/${PROJECT}/serviceAccounts/reguerta-inspect-invoker@${PROJECT}.iam.gserviceaccount.com:getIamPolicy`,"POST",{options:{requestedPolicyVersion:3}}),
    ]);
    actualFunctions.forEach((f,i)=>{assert.equal(stable(f),stable(functions[i]),"Function drift");assert.notEqual(f.serviceConfig?.serviceAccountEmail,WRITER);});
    actualJobs.forEach((j,i)=>{assert.equal(j.state,"PAUSED");assert.equal(stable(j),stable(jobs[i]),"Job drift");});
    for(const [a,b]of [[release,baseline.rulesRelease.data],[rules,baseline.ruleset.data],
      [projectIam,baseline.projectIam.data],[invokerPolicy,baseline.invokerPolicy.data]])assert.equal(stable(a),stable(b),"Control authority drift");
    const observedAtMillis=clock(nowMillis);assert.ok(observedAtMillis>=startedAtMillis&&observedAtMillis-startedAtMillis<60000);
    const records={functions:actualFunctions,jobs:actualJobs,release,rules,projectIam,invokerPolicy};
    return {kind:"develop-google-controls-read",projectId:PROJECT,startedAtMillis,observedAtMillis,records,
      observationDigest:stable(records),readOnly:true,canEnterMaintenance:false,canApply:false,
      missing:["runtime-and-key-inventory","source-and-causal-reconciliation","human-window-agreements"]};
  },close(){bearer=null;}};
}

function createDevelopOwnerObservationSession({ownerBearer,fetchImpl=fetch,nowMillis=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms))}) {
  let bearer=ownerBearer,reader=createOwnerReader({ownerBearer,fetchImpl}),closing=null,closed=false;
  const get=async params=>{
    assert.equal(closed,false);assert.equal(params.spreadsheetId,FILE);
    const q=new URLSearchParams({fields:params.fields});
    for(const range of params.ranges??[])q.append("ranges",range);
    return {data:await request(fetchImpl,bearer,`https://sheets.googleapis.com/v4/spreadsheets/${FILE}?${q}`)};
  };
  const legacyRanges=TABS.map(t=>`'${t.title}'!A1:${t.id===1770956648?"Y":"Z"}100`);
  async function capture() {
    assert.equal(closed,false);const startedAtMillis=clock(nowMillis);
    const before=await reader.read();validateMetadata(before,false);
    assert.equal(before.file.owners[0].me,true);assert.equal(before.parent.owners[0].me,true);
    const config=createShiftSheetsConfig({environment:"develop",workbooks:{develop:FILE}});
    const metadata=await readShiftSheetsSnapshot({config,sheets:{get},titles:TABS.map(t=>t.title)});
    assert.deepEqual(metadata.sheets.map(s=>({id:s.properties.sheetId,title:s.properties.title})),TABS);
    const ranges=metadata.sheets.map(s=>{
      const g=s.properties.gridProperties;assert.ok(g.columnCount<=26);
      return `'${s.properties.title}'!A1:${String.fromCharCode(64+g.columnCount)}${g.rowCount}`;
    });
    const raw=[];for(let i=0;i<2;i++)raw.push((await get({spreadsheetId:FILE,ranges,fields:PRESERVATION_FIELDS})).data);
    assert.equal(raw[0].spreadsheetId,FILE);
    assert.deepEqual(raw[0],raw[1],"Full preservation image drift");
    assert.deepEqual(raw[0].sheets.map(s=>s.properties),metadata.sheets.map(s=>s.properties),"Grid changed");
    const legacy=[];for(let i=0;i<2;i++)legacy.push((await get({spreadsheetId:FILE,ranges:legacyRanges,fields:LEGACY_FIELDS})).data);
    assert.deepEqual(legacy[0],legacy[1],"Reviewed six-range image drift");
    const projected=reviewedRangeSnapshot(raw[0]);
    assert.equal(snapshot(projected).digest,snapshot(legacy[0]).digest,"Full and bounded images disagree");
    const after=await reader.read();validateMetadata(after,false);
    assert.equal(metadataFingerprint(before),metadataFingerprint(after),"Owner authority/version drift");
    const observedAtMillis=clock(nowMillis);assert.ok(observedAtMillis>=startedAtMillis&&observedAtMillis-startedAtMillis<60000);
    const full=normalizePreservationSnapshot(raw[0]);
    return {kind:"develop-owner-google-observation",fileId:FILE,parentId:PARENT,startedAtMillis,observedAtMillis,
      before,after,legacy:legacy[0],snapshot:full,preservationFields:PRESERVATION_FIELDS,metadataDigest:metadataFingerprint(after),snapshotDigest:digest(full),
      reviewedRangeDigest:snapshot(legacy[0]).digest,readOnly:true,canApply:false,canEnterMaintenance:false};
  }
  async function cleanup() {
    closed=true;const startedAtMillis=clock(nowMillis),attempts=[];let revocationStatus=null;
    try {
      try {await reader.close();revocationStatus=200;}catch(e){revocationStatus=e?.ownerCleanup?.revocationStatus??null;}
      assert.equal(revocationStatus,200,"Owner token revocation unverified");
      // Revocation can propagate differently to Drive and Sheets. Keep the same
      // token, never renew it, and preserve intermediate statuses up to 120s.
      for(let i=0;i<13&&clock(nowMillis)-startedAtMillis<120000;i++) {
        const remaining=120000-(clock(nowMillis)-startedAtMillis);
        if(remaining<=0)break;
        const statuses=await Promise.all([
          `https://www.googleapis.com/drive/v3/files/${FILE}?fields=id`,
          `https://sheets.googleapis.com/v4/spreadsheets/${FILE}?fields=spreadsheetId`,
        ].map(async url=>{try{return (await fetchImpl(url,{method:"GET",headers:{Authorization:`Bearer ${bearer}`},redirect:"error",signal:AbortSignal.timeout(Math.min(10000,remaining))})).status;}catch{return null;}}));
        attempts.push({atMillis:clock(nowMillis),drive:statuses[0],sheets:statuses[1]});
        if(statuses.every(s=>s===401)&&clock(nowMillis)-startedAtMillis<=120000)return {verified:true,revocationStatus,startedAtMillis,finishedAtMillis:clock(nowMillis),attempts};
        if(i<12&&clock(nowMillis)-startedAtMillis+10000<=120000)await sleep(10000);else break;
      }
      throw Error("Same-token denial unverified");
    } catch {throw Object.assign(Error("Owner OAuth cleanup requires inspection"),{cleanup:{verified:false,revocationStatus,startedAtMillis,finishedAtMillis:clock(nowMillis),attempts}});}
    finally {bearer=null;ownerBearer=null;reader=null;}
  }
  return {capture,close:()=>closing??=cleanup()};
}
module.exports={createDevelopCloudReader,createDevelopOwnerObservationSession,normalizePreservationSnapshot,reviewedRangeSnapshot,PRESERVATION_FIELDS,LEGACY_FIELDS};
if(require.main===module){console.error("explicit_readonly_google_session_required_no_apply_cli");process.exitCode=1;}
