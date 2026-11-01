"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {test}=require("node:test");
const {prepareCopy,runCopy,IDENTITY}=require("../scripts/rehearse-develop-helper-copy.cjs");
const {FILE}=require("../scripts/develop-original-writer-provider.cjs");
const {createCopyOwner,openCopyWriter}=require("../scripts/develop-helper-copy-provider.cjs");
const {sheetsService}=require("./shift-sheets-api-fixture.cjs");
async function fixture(t) {
  const prepared=await prepareCopy({fileId:"synthetic-copy-only",protectedWorkbookIds:[FILE,"1bBJX9VqadOTFJ_HyKHLcsikFjytLr7jPu9GyFUJ1nwE"],runId:"full-test-copy"});
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"helper-copy-"));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const state={now:1000000,disabled:true,permission:false,policy:{etag:"initial",version:3,bindings:[]},mintCount:0,closed:0,enabled:0};
  const sheets=sheetsService(prepared.fileId);sheets.state=structuredClone(prepared.baseline);
  const iam={readIdentity:async()=>({account:{...IDENTITY,disabled:state.disabled},keys:{},policy:structuredClone(state.policy),project:{projectId:"reguerta-9f27f"},projectPolicy:{bindings:[]}}),
    enableOwned:async()=>{state.disabled=false;state.enabled++;},disableOwned:async()=>{state.disabled=true;},
    setPolicy:async policy=>{assert.equal(policy.etag,state.policy.etag);state.policy={...structuredClone(policy),etag:policy.etag+"-next"};},
    hasMintPermission:async()=>true,mint:async()=>{state.mintCount++;return {accessToken:"private-test-token",expireTime:new Date(state.now+300000).toISOString()};}};
  const owner={observe:async writer=>{assert.equal(state.permission,writer);return {snapshot:structuredClone(sheets.state),version:String(sheets.revision)};},
    grant:async()=>{assert.equal(state.permission,false);state.permission=true;return {id:"copy-writer"};},
    remove:async()=>{state.permission=false;},close:async()=>{state.closed++;return {verified:true};}};
  const input={authorized:true,preparationDigest:prepared.preparationDigest,receiptId:"one-full-copy",startsAtMillis:state.now,endsAtMillis:state.now+600000,
    onlineClosedNoOfflineEdits:true,noOtherWritesOrTokens:true};
  const args={prepared,input,iam,owner,journalRoot:root,nowMillis:()=>state.now,sleep:async ms=>{state.now+=ms;},
    readIsolation:async()=>({writerEmail:IDENTITY.email,writerIsolated:true,observedAtMillis:state.now}),
    openWriter:async()=>({sheets,probe:async()=>({status:state.permission?200:404}),close(){}})};
  return {prepared,state,sheets,args,receipts:()=>fs.readdirSync(path.join(root,input.receiptId)).map(n=>fs.readFileSync(path.join(root,input.receiptId,n),"utf8")).join("\n")};
}
test("full copy lifecycle waits once, mints once, writes/reverses exactly two batches, removes access and revokes once",async t=>{
  const f=await fixture(t);f.sheets.loseAcknowledgement=true;
  f.sheets.onMutation=async()=>{for(const sheet of f.sheets.state.sheets)for(const marker of sheet.developerMetadata)marker.location.locationType="SHEET";};
  const result=await runCopy(f.args);
  assert.equal(result.kind,"full-copy-restored-and-contained");assert.equal(result.completedBatches,2);
  assert.equal(f.sheets.mutations.length,2);assert.ok(f.sheets.mutations.every(m=>m.requestBody.requests.length===55));
  assert.equal(f.state.now,1120000);assert.equal(f.state.mintCount,1);assert.equal(f.state.closed,1);
  assert.equal(f.state.permission,false);assert.equal(f.state.disabled,true);assert.deepEqual(f.state.policy.bindings,[]);
  const restored=structuredClone(f.sheets.state);restored.sheets.forEach(s=>{s.developerMetadata=[];});assert.deepEqual(restored,f.prepared.baseline);
  assert.ok(!f.receipts().includes("private-test-token"));
  await assert.rejects(runCopy(f.args),{code:"EEXIST"});assert.equal(f.state.mintCount,1);
});
test("preservation rejection retains the complete owner readback before cleanup and never starts the inverse",async t=>{
  const f=await fixture(t);
  f.sheets.onMutation=async()=>{f.sheets.state.sheets[0].data[0].rowData[0].values[0].note="unexpected note";};
  const result=await runCopy(f.args);
  assert.equal(result.kind,"inspection_required");assert.equal(result.failure.phase,"forward");
  assert.equal(f.sheets.mutations.length,1);assert.equal(result.completedBatches,0);
  const readback=JSON.parse(fs.readFileSync(path.join(f.args.journalRoot,f.args.input.receiptId,"forward-readback.json")));
  assert.equal(readback.result.kind,"verified");
  assert.equal(readback.observation.snapshot.sheets[0].data[0].rowData[0].values[0].note,"unexpected note");
  assert.equal(f.state.permission,false);assert.equal(f.state.disabled,true);
  assert.deepEqual(f.state.policy.bindings,[]);assert.equal(f.state.closed,1);
});
for(const phase of ["enable","grant","mint","write","deadline","cleanup"])test(`full lifecycle contains ${phase} failure without automatic replay`,async t=>{
  const f=await fixture(t);
  if(phase==="enable")f.args.iam.enableOwned=async()=>{f.state.disabled=false;throw Error("lost");};
  if(phase==="grant")f.args.owner.grant=async()=>{f.state.permission=true;throw Error("lost");};
  if(phase==="mint")f.args.iam.mint=async()=>{f.state.mintCount++;throw Error("private-test-token");};
  if(phase==="write")f.sheets.rejectBeforeApply=true;
  if(phase==="deadline")f.sheets.onMutation=async()=>{f.state.now+=151000;};
  if(phase==="cleanup")f.args.owner.close=async()=>{f.state.closed++;throw Error("unproven");};
  const result=await runCopy(f.args);assert.equal(result.kind,"inspection_required");assert.equal(result.canRetry,false);
  assert.ok(f.state.mintCount<=1);assert.equal(f.state.disabled,true);assert.deepEqual(f.state.policy.bindings,[]);
  assert.equal(f.state.permission,false);assert.equal(f.state.closed,1);
  assert.ok(!f.receipts().includes("private-test-token"));
  if(phase==="deadline"){assert.equal(f.sheets.mutations.length,1);assert.equal(result.completedBatches,1);}
  if(phase==="write")assert.equal(f.sheets.mutations.length,1);
});
test("changed recipe, original destination and missing confirmation reject before access",async t=>{
  for(const change of [f=>{f.args.input.authorized=false;},f=>{f.args.input.noOtherWritesOrTokens=false;},
    f=>{f.args.prepared.forward.rows.pop();},f=>{f.args.prepared.fileId=FILE;}]){
    const f=await fixture(t);change(f);await assert.rejects(runCopy(f.args));assert.equal(f.state.enabled,0);assert.equal(f.state.mintCount,0);
  }
});
test("writer transport pins destination, forbids refresh and has a two-attempt ceiling even after unknown response",async()=>{
  const calls=[],fileId="synthetic-copy-only",protectedWorkbookIds=[FILE,"1bBJX9VqadOTFJ_HyKHLcsikFjytLr7jPu9GyFUJ1nwE"];
  const writer=openCopyWriter({fileId,protectedWorkbookIds,bearer:"private-test-token",expiresAtMillis:500000,nowMillis:()=>1,
    fetchImpl:async(url,o)=>{calls.push(url);assert.ok(url.includes(fileId));assert.equal(o.redirect,"error");throw Error("lost");}});
  const body={spreadsheetId:fileId,requestBody:{requests:[...Array.from({length:53},()=>({updateCells:{}})),{createDeveloperMetadata:{}},{createDeveloperMetadata:{}}]}};
  for(let i=0;i<3;i++)await assert.rejects(writer.sheets.batchUpdate(body,{retry:false}));assert.equal(calls.length,2);
  await assert.rejects(writer.sheets.get({spreadsheetId:FILE},{retry:false}));assert.equal(calls.length,2);writer.close();
  assert.throws(()=>openCopyWriter({fileId:FILE,protectedWorkbookIds,bearer:"x"}));
});
test("copy OAuth revokes once and waits for both services without reading the original",async()=>{
  let now=1000,revokes=0,sheetsProbes=0;const fileId="synthetic-copy-only";
  const owner=createCopyOwner({fileId,protectedWorkbookIds:[FILE,"1bBJX9VqadOTFJ_HyKHLcsikFjytLr7jPu9GyFUJ1nwE"],ownerBearer:"private-test-token",nowMillis:()=>now,sleep:async ms=>{now+=ms;},
    fetchImpl:async(url,o)=>{assert.equal(o.redirect,"error");
      if(url.includes("/revoke")){revokes++;return {status:200};}
      assert.ok(url.includes(fileId));return {status:url.includes("sheets.googleapis.com")&&sheetsProbes++<2?200:401,json:async()=>({})};}});
  const result=await owner.close();assert.equal(result.verified,true);assert.equal(now,21000);assert.equal(result.attempts.length,3);
  assert.deepEqual(await owner.close(),result);assert.equal(revokes,1);
});
test("owner transport reads the complete copy, grants only its writer and reconciles a lost grant response",async t=>{
  const f=await fixture(t),{PARENT,OWNER,WRITER}=require("../scripts/develop-original-writer-provider.cjs");
  const permissions=[{id:"test-owner",type:"user",role:"owner",emailAddress:OWNER}];let revoked=false;
  const owner=createCopyOwner({fileId:f.prepared.fileId,protectedWorkbookIds:f.prepared.protectedWorkbookIds,ownerBearer:"private-test-token",
    fetchImpl:async(url,o)=>{
      if(url.includes("/revoke")){revoked=true;return {status:200};}
      assert.ok(url.includes(f.prepared.fileId));assert.equal(o.redirect,"error");
      if(revoked)return {status:401,json:async()=>({})};
      const u=new URL(url),result=data=>({status:200,json:async()=>structuredClone(data)});
      if(o.method==="POST"){
        assert.ok(u.pathname.endsWith("/permissions"));assert.equal(u.searchParams.get("sendNotificationEmail"),"false");
        assert.deepEqual(JSON.parse(o.body),{type:"user",role:"writer",emailAddress:WRITER});
        permissions.push({id:"test-writer",type:"user",role:"writer",emailAddress:WRITER});throw Error("lost grant reply");
      }
      if(o.method==="DELETE"){
        assert.ok(u.pathname.endsWith("/permissions/test-writer"));permissions.splice(1,1);return {status:204,json:async()=>null};
      }
      if(u.hostname==="sheets.googleapis.com"){
        assert.equal(u.searchParams.getAll("ranges").length,6);const raw=structuredClone(f.prepared.baseline);
        raw.sheets.forEach(s=>{delete s.dataCoverage;delete s.developerMetadata;delete s.protectedRanges;delete s.merges;});return result(raw);
      }
      if(u.pathname.endsWith("/permissions"))return result({permissions});
      return result({id:f.prepared.fileId,mimeType:"application/vnd.google-apps.spreadsheet",trashed:false,version:"1",parents:[PARENT],
        owners:[{emailAddress:OWNER,permissionId:"test-owner",me:true}]});
    }});
  assert.deepEqual((await owner.observe(false)).snapshot,f.prepared.baseline);
  await assert.rejects(owner.grant());assert.equal(permissions.length,2);
  await owner.observe(true);await owner.remove(null);assert.equal(permissions.length,1);
  assert.equal((await owner.close()).verified,true);
});
test("runtime inventory rejects incomplete pages, unreachable resources and any occurrence of the writer",async()=>{
  const {createIsolationReader}=require("../scripts/develop-helper-copy-provider.cjs");
  for(const data of [{nextPageToken:"more"},{metadata:{continue:"more"}},{unreachable:["region"]},{items:[{serviceAccount:IDENTITY.email}]}]){
    const read=createIsolationReader({iamBearer:"private-test-token",fetchImpl:async()=>({status:200,json:async()=>data})});
    await assert.rejects(read());
  }
});
