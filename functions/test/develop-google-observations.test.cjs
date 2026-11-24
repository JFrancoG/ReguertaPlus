"use strict";
const assert=require("node:assert/strict");
const {test}=require("node:test");
const {createDevelopOwnerObservationSession,createDevelopCloudReader}=require("../scripts/develop-google-observations.cjs");
const {FILE,PARENT,TABS,OWNER,READERS}=require("../scripts/develop-original-writer-provider.cjs");
const secret="test-only-secret";
function fixture() {
  const owner={emailAddress:OWNER,permissionId:"test-owner",me:true},permission={...owner,id:owner.permissionId,type:"user",role:"owner"};
  const file={id:FILE,mimeType:"application/vnd.google-apps.spreadsheet",trashed:false,version:"287",parents:[PARENT],owners:[owner]};
  const parent={id:PARENT,mimeType:"application/vnd.google-apps.folder",trashed:false,owners:[owner]};
  const permissions=[permission,...READERS.map((emailAddress,i)=>({id:`reader-${i}`,type:"user",role:"reader",emailAddress}))];
  const grid={spreadsheetId:FILE,properties:{locale:"es_ES"},sheets:TABS.map((t,index)=>({properties:{sheetId:t.id,title:t.title,index,
    sheetType:"GRID",gridProperties:{rowCount:1000,columnCount:t.id===1770956648?25:26}},
  data:[{rowData:[{values:[{userEnteredValue:{stringValue:"Fecha"},note:"preserve",userEnteredFormat:{}}]}]}]}))};
  const state={now:1000,revoked:false,reads:0,probes:0,delay:0,deny:false,drift:false,calls:[]};
  const response=(data,status=200)=>({status,json:async()=>structuredClone(data)});
  const fetchImpl=async(url,options)=>{
    const u=new URL(url);assert.equal(options.redirect,"error");assert.ok(options.signal);state.calls.push([u.hostname,u.pathname,options.method]);
    if(u.hostname==="oauth2.googleapis.com") {
      assert.equal(u.pathname,"/revoke");assert.equal(options.method,"POST");assert.equal(new URLSearchParams(options.body).get("token"),secret);
      state.revoked=true;return response({});
    }
    assert.equal(options.headers.Authorization,`Bearer ${secret}`);assert.equal(options.method,"GET");
    assert.ok(u.pathname.includes(FILE)||u.pathname.includes(PARENT));
    if(state.deny) return response({error:secret},403);
    if(state.revoked){if(u.hostname==="sheets.googleapis.com"&&state.probes++<state.delay)return response({spreadsheetId:FILE});return response({},401);}
    if(u.pathname.endsWith("/permissions"))return response({permissions:u.pathname.includes(PARENT)?[permission]:permissions});
    if(u.hostname==="www.googleapis.com")return response(u.pathname.includes(PARENT)?parent:file);
    assert.equal(u.hostname,"sheets.googleapis.com");state.reads++;
    const result=structuredClone(grid);if(state.drift&&state.reads===4)result.sheets[0].data[0].rowData[0].values[0].note="drift";
    return response(result);
  };
  const session=createDevelopOwnerObservationSession({ownerBearer:secret,fetchImpl,nowMillis:()=>state.now,sleep:async ms=>{state.now+=ms;}});
  return {state,session,fetchImpl};
}
test("real read transport captures complete and bounded images, revokes once and observes both services",async()=>{
  const f=fixture();f.state.delay=2;
  const observed=await f.session.capture();assert.equal(observed.canApply,false);assert.equal(observed.snapshot.sheets.length,6);
  assert.ok(observed.snapshot.sheets.every(s=>s.dataCoverage==="complete"));
  const cleanup=await f.session.close();assert.equal(cleanup.verified,true);assert.equal(cleanup.attempts.length,3);
  assert.deepEqual(cleanup.attempts.map(x=>x.sheets),[200,200,401]);assert.equal(cleanup.finishedAtMillis-cleanup.startedAtMillis,20000);
  assert.deepEqual(await f.session.close(),cleanup);assert.equal(f.state.calls.filter(c=>c[1]==="/revoke").length,1);
  await assert.rejects(f.session.capture());assert.ok(!JSON.stringify({observed,cleanup}).includes(secret));
});
test("a changed complete image fails before admission but still allows cleanup",async()=>{
  const f=fixture();f.state.drift=true;await assert.rejects(f.session.capture(),/image drift/);
  assert.equal((await f.session.close()).verified,true);
});
test("a provider rejection sanitizes raw response data and does not retry",async()=>{
  const f=fixture();f.state.deny=true;
  await assert.rejects(f.session.capture(),e=>!e.message.includes(secret));
  assert.equal(f.state.calls.length,1);f.state.deny=false;assert.equal((await f.session.close()).verified,true);
});
test("unproven same-token denial is bounded and never requests another credential",async()=>{
  const f=fixture();f.state.delay=100;
  await assert.rejects(f.session.close(),e=>e.cleanup.verified===false&&e.cleanup.attempts.length===12);
  assert.equal(f.state.now,121000);assert.equal(f.state.calls.filter(c=>c[1]==="/revoke").length,1);
  await assert.rejects(f.session.capture());
});
test("Cloud reader only queries the reviewed project resources and compares real responses",async()=>{
  const project="reguerta-9f27f",prefix=`projects/${project}/locations/europe-west1`;
  const reviewed={projectId:project,readOnly:true,functions:Array.from({length:24},(_,i)=>({data:{name:`${prefix}/functions/fn${i}`}})),
    jobs:Array.from({length:3},(_,i)=>({data:{name:`${prefix}/jobs/job${i}`,state:"PAUSED"}})),
    rulesRelease:{data:{rulesetName:`projects/${project}/rulesets/test-rules`}},ruleset:{data:{name:"rules"}},
    projectIam:{data:{bindings:[]}},invokerPolicy:{data:{bindings:[]}}};
  let calls=0,changed=false;
  const fetchImpl=async(url,options)=>{
    calls++;assert.ok(url.includes(project));assert.equal(options.redirect,"error");
    if(options.method==="POST")assert.ok(url.endsWith(":getIamPolicy"));
    let data=reviewed.functions.find(x=>url.endsWith(x.data.name))?.data??reviewed.jobs.find(x=>url.endsWith(x.data.name))?.data;
    if(!data)data=url.includes("/releases/")?reviewed.rulesRelease.data:url.includes("/rulesets/")?reviewed.ruleset.data:{bindings:[]};
    return {status:200,json:async()=>({...data,...(changed&&url.includes("/jobs/")?{state:"ENABLED"}:{})})};
  };
  const reader=createDevelopCloudReader({bearer:secret,reviewed,fetchImpl,nowMillis:()=>1000});
  assert.equal((await reader.read()).canEnterMaintenance,false);assert.equal(calls,31);
  changed=true;await assert.rejects(reader.read());reader.close();await assert.rejects(reader.read());
  const before=calls;reviewed.functions[0].data.name="projects/production/locations/europe-west1/functions/x";
  assert.throws(()=>createDevelopCloudReader({bearer:secret,reviewed,fetchImpl}));assert.equal(calls,before);
});
