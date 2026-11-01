"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {test}=require("node:test");
const {originalWindowFixture}=require("./develop-original-window-fixture.cjs");
const {runControlledWindow:run,recoverControlledWindow:recover}=require("../scripts/develop-controlled-window.cjs");
const {readWindowJournal:read}=require("../scripts/develop-window-journal.cjs");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
function root(t){const v=fs.mkdtempSync(path.join(os.tmpdir(),"original-window-"));t.after(()=>fs.rmSync(v,{recursive:true,force:true}));return v;}
async function execute(t,f,receiptId="first-window",prior=null,directory=root(t)){
  const data={...f.args(prior?"inverse":"forward",prior),receiptId},sessions=f.sessions(data,receiptId+"-owner");
  const result=await run({...data,...sessions,root:directory,receiptId,nowMillis:()=>f.state.now,fetchImpl:f.fetchImpl});
  return {data,result,directory};
}
test("concrete original session applies one exact batch and a separately admitted inverse with actual ACL versions",async t=>{
  const f=originalWindowFixture(),before=structuredClone(f.batch.sheets.state),first=await execute(t,f);
  assert.equal(first.result.kind,"direction-verified-and-contained",JSON.stringify(first.result));
  assert.equal(f.state.mints,1);assert.equal(f.batch.sheets.mutations.length,1);assert.equal(f.state.permission,false);assert.equal(f.state.disabled,true);
  const journal=read(first.result.directory),transition=journal.records.find(r=>r.value.phase==="google-permission-transition").value.transition;
  assert.notEqual(transition.before.after.file.version,transition.after.after.file.version);assert.deepEqual(transition.before.snapshot,transition.after.snapshot);
  const second=await execute(t,f,"second-window",first.result.result,first.directory);
  assert.equal(second.result.kind,"direction-verified-and-contained",JSON.stringify(second.result));assert.equal(f.state.mints,2);assert.equal(f.batch.sheets.mutations.length,2);
  const restored=structuredClone(f.batch.sheets.state);restored.sheets.forEach(s=>{s.developerMetadata=before.sheets.find(x=>x.properties.sheetId===s.properties.sheetId).developerMetadata;});assert.deepEqual(restored,before);
  assert.ok(!JSON.stringify(read(second.result.directory)).includes("fixture-owner-"));
});
for(const fault of ["grant","cells","mint","write","write-read","remove","oauth"])test(`original session ${fault} failure is contained independently without replay`,async t=>{
  const f=originalWindowFixture({fault}),{result}=await execute(t,f);assert.equal(result.kind,fault==="write"?"direction-verified-and-contained":"inspection-required");
  assert.equal(f.state.disabled,true);assert.deepEqual(f.state.policy.bindings,[]);assert.equal(f.state.revoked.size>0,fault!=="oauth");
  assert.equal(f.state.permission,fault==="remove");assert.ok(f.state.mints<=1);assert.equal(f.batch.sheets.mutations.length,["write","write-read","remove","oauth"].includes(fault)?1:0);
  const entries=read(result.directory).records.map(r=>r.value);
  assert.deepEqual(entries.filter(v=>v.phase==="cleanup-intent").map(v=>v.stage),["file","iam","oauth"]);
});
test("restart removes permissions but keeps lost writer denial and old OAuth obligations unverified",async t=>{
  const f=originalWindowFixture({fault:"remove"}),first=await execute(t,f),saved=read(first.result.directory);
  f.state.failCleanup=false;
  const newSession=f.sessions(first.data,"owner-recovery");const calls=f.state.calls.length,writes=f.state.businessWrites;
  const result=await recover({directory:first.result.directory,recoveryId:"recovery-window",expectedBindingDigest:digest(saved.binding),
    window:{startsAtMillis:f.state.now,endsAtMillis:f.state.now+600000},nowMillis:()=>f.state.now,fetchImpl:f.fetchImpl,...newSession});
  const terminal=result.records.at(-1).value;assert.equal(terminal.kind,"inspection-required");
  assert.ok(terminal.cleanup.failures.includes("file-unverified"));assert.equal(f.state.permission,false);assert.equal(f.state.disabled,true);
  assert.equal(f.state.businessWrites,writes);assert.equal(f.state.mints,1);
  assert.ok(f.state.calls.slice(calls).every(c=>!c.url.includes("generateAccessToken")&&!c.url.endsWith(":enable")&&!c.url.endsWith(":batchUpdate")));
  assert.ok(fs.existsSync(path.join(first.directory,"controlled-window-active")));
});

test("an explicitly retained matching writer token lets recovery verify denial without minting again",async t=>{
  const f=originalWindowFixture({fault:"remove"}),first=await execute(t,f),saved=read(first.result.directory);f.state.failCleanup=false;
  const recovered=await recover({directory:first.result.directory,recoveryId:"retained-writer-recovery",expectedBindingDigest:digest(saved.binding),
    window:{startsAtMillis:f.state.now,endsAtMillis:f.state.now+600000},nowMillis:()=>f.state.now,fetchImpl:f.fetchImpl,
    ...f.sessions(first.data,"recovery-owner",{recoveryWriterCredential:{bearer:"fixture-writer",expiresAtMillis:f.state.writerExpiry}})});
  assert.equal(recovered.records.at(-1).value.kind,"cleanup-verified-inspection-only");assert.equal(f.state.mints,1);assert.equal(f.batch.sheets.mutations.length,1);
  assert.equal(fs.existsSync(path.join(first.directory,"controlled-window-active")),false);
});

test("a new owner session cannot clear lost OAuth; the matching old credential can, without writes",async t=>{
  const f=originalWindowFixture({fault:"oauth"}),first=await execute(t,f),saved=read(first.result.directory);f.state.failOAuth=false;
  const recovery=async(id,ownerId)=>recover({directory:first.result.directory,recoveryId:id,expectedBindingDigest:digest(saved.binding),
    window:{startsAtMillis:f.state.now,endsAtMillis:f.state.now+600000},nowMillis:()=>f.state.now,fetchImpl:f.fetchImpl,...f.sessions(first.data,ownerId)});
  const replaced=await recovery("new-owner-recovery","replacement-owner");
  assert.ok(replaced.records.at(-1).value.cleanup.failures.includes("oauth-unverified"));
  assert.equal(fs.existsSync(path.join(first.directory,"controlled-window-active")),true);
  const recovered=await recovery("original-owner-recovery","first-window-owner");
  assert.equal(recovered.records.at(-1).value.kind,"cleanup-verified-inspection-only");assert.equal(f.state.mints,1);assert.equal(f.batch.sheets.mutations.length,1);
});

test("disk interruption after the native grant still removes access, disables IAM and revokes OAuth",async t=>{
  const f=originalWindowFixture(),directory=root(t),data={...f.args(),receiptId:"disk-failure-window"},grant=f.ownerChannel.grant;
  f.ownerChannel.grant=async p=>{await grant(p);const dir=path.join(directory,"disk-failure-window"),next=read(dir).records.length;
    fs.writeFileSync(path.join(dir,String(next).padStart(6,"0")+".json.pending"),"interrupted");};
  await assert.rejects(run({...data,...f.sessions(data),root:directory,receiptId:"disk-failure-window",nowMillis:()=>f.state.now,fetchImpl:f.fetchImpl}));
  assert.equal(f.state.permission,false);assert.equal(f.state.disabled,true);assert.deepEqual(f.state.policy.bindings,[]);assert.equal(f.state.revoked.size,1);
  assert.equal(f.state.mints,0);assert.equal(f.batch.sheets.mutations.length,0);assert.ok(fs.existsSync(path.join(directory,"controlled-window-active")));
});

for(const drift of ["enabled-writer","foreign-grant","receipt-reuse"])
test(`session preflight rejects ${drift} before obtaining any writer authority`,async t=>{
  const f=originalWindowFixture(),data=f.args(),directory=root(t);
  if(drift==="enabled-writer")f.state.disabled=false;
  if(drift==="foreign-grant")f.state.policy.bindings=[{role:"roles/viewer",members:["user:foreign@example.test"]}];
  const result=await run({...data,...f.sessions(data),root:directory,receiptId:drift==="receipt-reuse"?"another-receipt":"first-window",nowMillis:()=>f.state.now,fetchImpl:f.fetchImpl});
  assert.equal(result.kind,"inspection-required");assert.equal(f.state.mints,0);assert.equal(f.state.permission,false);assert.equal(f.batch.sheets.mutations.length,0);
  assert.ok(!f.state.calls.some(c=>c.url.endsWith(":enable")||c.url.endsWith(":disable")||c.url.endsWith(":setIamPolicy")));
});

for(const drift of ["forward-plan","forward-receipt","workbook"])
test(`concrete factory rejects mismatched ${drift} before accessing providers`,()=>{
  const f=originalWindowFixture(),data=f.args(),ports={};
  if(drift==="forward-plan")ports.forwardPlan={planDigest:"different"};
  if(drift==="forward-receipt")ports.forwardReadBack={receipt:"different"};
  if(drift==="workbook")data.scope.expectedWorkbookFileId="production-workbook";
  assert.throws(()=>f.sessions(data,"owner-rejected",ports));assert.equal(f.state.calls.length,0);assert.equal(f.state.permission,false);
});
