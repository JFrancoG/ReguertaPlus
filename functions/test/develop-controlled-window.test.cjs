"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {test}=require("node:test"),{spawn}=require("node:child_process"),{once}=require("node:events");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {runControlledWindow:run,recoverControlledWindow:recover}=require("../scripts/develop-controlled-window.cjs");
const {readWindowJournal:read,createWindowJournal:create,claimWindowRecovery:claim}=require("../scripts/develop-window-journal.cjs");
function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"controlled-window-"));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const p={projectId:"demo-reguerta-hu084-migration",environment:"develop",liveExecutable:false,reviewPackageDigest:"review",operationId:"request-forward",recoveryOperationId:"recover-forward"};
  const prepared={...p,preparedDigest:digest(p)},events=[],controller=new AbortController();let now=1000000;
  const cleanup=Object.fromEntries(["file","iam","oauth"].map(stage=>[stage,async()=>{events.push(stage);return {verified:true};}]));
  const inspect=Object.fromEntries(["barrier","firestore","sheets"].map(name=>[name,async()=>{events.push("inspect-"+name);return {kind:"observed"};}]));
  const session={cleanup,inspect,tokenExpiresAtMillis:now+420000,
    barrier:{acquire:async()=>{events.push("acquire");return {acquired:true};}},executor:{inspectAdmission:async()=>({checksPassed:true}),
      executeJoint:async({record})=>{events.push("execute");await record({phase:"intent",plan:{operationId:"request-forward"}});return {kind:"joint-step-verified"};}}};
  const args={root,receiptId:"one-window",prepared,scope:{environment:"develop",transitionId:p.operationId},direction:"forward",window:{startsAtMillis:now,endsAtMillis:now+600000},
    sourceInput:{},reviewPackage:{packageDigest:"review"},signal:controller.signal,nowMillis:()=>now,
    openSession:async()=>{events.push("open");now+=120000;return session;},openRecoverySession:async()=>{events.push("reopen-cleanup");return session;}};
  return {root,args,session,events,controller,setClock:v=>{now=v;}};
}
test("one window persists intent before execution, cleans in order and refuses execution reuse",async t=>{
  const f=fixture(t),result=await run(f.args);assert.equal(result.kind,"direction-verified-and-contained");
  assert.deepEqual(f.events,["open","acquire","execute","file","iam","oauth"]);
  const saved=read(result.directory);assert.equal(saved.records.at(-1).value.providerCallsSettled,true);
  assert.ok(saved.records.some(r=>r.value.phase==="intent"));assert.equal(saved.canResumeExecution,false);
  await assert.rejects(run(f.args),/already consumed/);assert.equal(f.events.filter(x=>x==="execute").length,1);
  const recovered=await recover({directory:result.directory,recoveryId:"review-cleanup",expectedBindingDigest:digest(saved.binding),window:{startsAtMillis:1120000,endsAtMillis:1720000},
    nowMillis:()=>1120000,openRecoverySession:async()=>f.session});
  assert.equal(recovered.records.at(-1).value.kind,"cleanup-verified-inspection-only");assert.equal(f.events.filter(x=>x==="execute").length,1);
  assert.throws(()=>claim({directory:result.directory,recoveryId:"review-cleanup",expectedBindingDigest:digest(saved.binding)}),/already consumed/);
});
for(const phase of ["open","acquire","execute","file","iam","oauth"])test(`partial ${phase} failure still attempts each cleanup stage`,async t=>{
  const f=fixture(t);
  if(phase==="open")f.args.openSession=async()=>{throw Error("partial grant");};
  else if(phase==="acquire")f.session.barrier.acquire=async()=>{throw Error("lost acknowledgement");};
  else if(phase==="execute")f.session.executor.executeJoint=async()=>{throw Error("unknown commit");};
  else f.session.cleanup[phase]=async()=>{f.events.push(phase);throw Error("unverified revocation");};
  const result=await run(f.args);assert.equal(result.kind,"inspection-required");
  assert.deepEqual(f.events.filter(x=>["file","iam","oauth"].includes(x)),["file","iam","oauth"]);
  assert.equal(read(result.directory).records.at(-1).value.providerCallsSettled,true);
});
test("cancellation before opening performs no provider operation",async t=>{
  const f=fixture(t);f.controller.abort();const result=await run(f.args);assert.equal(result.kind,"inspection-required");assert.deepEqual(f.events,[]);
});
test("abort while execution is pending waits for settlement before cleanup",async t=>{
  const f=fixture(t);let finish,entered;const pending=new Promise(resolve=>{entered=resolve;});
  f.session.executor.executeJoint=async()=>{entered();await new Promise(resolve=>{finish=resolve;});return {kind:"joint-inspection-required"};};
  const action=run(f.args);await pending;f.controller.abort();await new Promise(resolve=>setImmediate(resolve));
  assert.ok(!f.events.includes("file"));finish();const result=await action;assert.equal(result.kind,"inspection-required");assert.ok(f.events.includes("oauth"));
});
test("journal corruption, wrong binding and credential fields reject before recovery providers",async t=>{
  const f=fixture(t),result=await run(f.args),saved=read(result.directory);
  assert.throws(()=>claim({directory:result.directory,recoveryId:"wrong-bind",expectedBindingDigest:"different"}));
  const j=create({root:f.root,receiptId:"secret-check",binding:{scope:"local"}});t.after(()=>j.release());
  assert.throws(()=>j.append({phase:"bad",accessToken:"must-not-persist"}),/credentials/);
  const file=path.join(result.directory,"000001.json"),data=JSON.parse(fs.readFileSync(file));data.value.phase="changed";fs.writeFileSync(file,JSON.stringify(data));
  let calls=0;await assert.rejects(recover({directory:result.directory,recoveryId:"corrupt-review",expectedBindingDigest:digest(saved.binding),window:{startsAtMillis:1,endsAtMillis:600001},nowMillis:()=>1,
    openRecoverySession:async()=>{calls++;return f.session;}}));assert.equal(calls,0);
});
test("crashed child retains the intent and recovery only inspects and cleans",async t=>{
  const f=fixture(t),module=path.resolve(__dirname,"../scripts/develop-window-journal.cjs"),directory=path.join(f.root,"crashed-run");
  const child=spawn(process.execPath,["-e",`const {createWindowJournal}=require(process.argv[1]);const j=createWindowJournal({root:process.argv[2],receiptId:'crashed-run',binding:{projectId:'demo-reguerta-hu084-migration'}});j.append({phase:'intent',operationId:'already-sent'});process.send('ready');setInterval(()=>{},1000);`,module,f.root],{stdio:["ignore","pipe","pipe","ipc"]});
  t.after(()=>{if(child.exitCode===null)child.kill("SIGKILL");});await once(child,"message",{signal:AbortSignal.timeout(30000)});
  const saved=read(directory);assert.throws(()=>claim({directory,recoveryId:"too-early",expectedBindingDigest:digest(saved.binding)}),/not stopped/);
  const exited=once(child,"exit");child.kill("SIGKILL");await exited;
  const result=await recover({directory,recoveryId:"after-crash",expectedBindingDigest:digest(saved.binding),window:{startsAtMillis:1,endsAtMillis:600001},nowMillis:()=>1,openRecoverySession:async()=>f.session});
  assert.equal(result.records[1].value.operationId,"already-sent");assert.equal(result.records.at(-1).value.canResumeExecution,false);
  assert.deepEqual(f.events,["inspect-barrier","inspect-firestore","inspect-sheets","file","iam","oauth"]);
});

test("unverified cleanup fences other windows until explicit verified cleanup",async t=>{
  const f=fixture(t);let fail=true;
  f.session.cleanup.file=async()=>{if(fail)throw Error("still granted");return {verified:true};};
  const result=await run(f.args);assert.equal(result.kind,"inspection-required");
  const calls=f.events.length;await assert.rejects(run({...f.args,receiptId:"other-window"}),{code:"EEXIST"});assert.equal(f.events.length,calls);
  const saved=read(result.directory);fail=false;
  await recover({directory:result.directory,recoveryId:"revoke-owned",expectedBindingDigest:digest(saved.binding),window:{startsAtMillis:1120000,endsAtMillis:1720000},
    nowMillis:()=>1120000,openRecoverySession:async()=>f.session});
  assert.equal(fs.existsSync(path.join(f.root,"controlled-window-active")),false);
});
test("partial evidence file and removed sequence never masquerade as a complete record",async t=>{
  const f=fixture(t),j=create({root:f.root,receiptId:"partial-write",binding:{scope:"local"}});t.after(()=>j.release());
  fs.writeFileSync(path.join(j.directory,"000001.json.pending"),'{"partial":');
  assert.deepEqual(j.read().pendingFiles,["000001.json.pending"]);assert.throws(()=>j.append({phase:"retry"}),{code:"EEXIST"});
  assert.equal(j.read().records.length,1);
});

test("an interrupted journal append cannot skip cleanup or report a clean terminal",async t=>{
  const f=fixture(t);
  f.session.executor.executeJoint=async({record})=>{
    const directory=path.join(f.root,f.args.receiptId),next=read(directory).records.length;
    fs.writeFileSync(path.join(directory,String(next).padStart(6,"0")+".json.pending"),"partial");
    await record({phase:"intent"});return {kind:"joint-step-verified"};
  };
  await assert.rejects(run(f.args),{code:"EEXIST"});
  assert.deepEqual(f.events.filter(x=>["file","iam","oauth"].includes(x)),["file","iam","oauth"]);
  const saved=read(path.join(f.root,f.args.receiptId));assert.equal(saved.records.some(r=>r.value.phase==="window-terminal"),false);
  assert.equal(fs.existsSync(path.join(f.root,"controlled-window-active")),true);
});
