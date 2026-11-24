"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {test}=require("node:test");
const {originalWindowFixture}=require("./develop-original-window-fixture.cjs");
const {runControlledWindow:run,recoverControlledWindow:recover,bindWindow}=require("../scripts/develop-controlled-window.cjs");
const {readWindowJournal:read}=require("../scripts/develop-window-journal.cjs");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {FILE}=require("../scripts/develop-original-writer-provider.cjs");
const {ORIGINAL_DEVELOP_MODE,createCopyTimeBudget,createOriginalDevelopTimeBudget}=require("../scripts/develop-copy-time-budget.cjs");
const {createDevelopHumanInputs}=require("../scripts/develop-window-human-inputs.cjs");

function args(f){
  const data={...f.args(),receiptId:"deferred-original-window",executionMode:ORIGINAL_DEVELOP_MODE};
  data.scope.expectedWorkbookFileId=FILE;data.window.endsAtMillis=data.window.startsAtMillis+1200000;return data;
}
function root(t){const value=fs.mkdtempSync(path.join(os.tmpdir(),"original-budget-"));t.after(()=>fs.rmSync(value,{recursive:true,force:true}));return value;}
async function execute(t,f,data=args(f),ports={}){
  const sessions=f.sessions(data,data.receiptId+"-owner",ports);
  return run({...data,...sessions,root:root(t),nowMillis:()=>f.state.now,fetchImpl:f.fetchImpl});
}
test("twenty-minute original preparation is explicit; copy defaults and all token fences stay bounded",()=>{
  let now=1000;const input={startsAtMillis:now,endsAtMillis:now+1200000,nowMillis:()=>now};
  assert.throws(()=>createCopyTimeBudget(input));assert.throws(()=>createOriginalDevelopTimeBudget(input));
  const budget=createOriginalDevelopTimeBudget({...input,reviewedMode:ORIGINAL_DEVELOP_MODE});
  now=780999;budget.assertStage();now=781000;assert.throws(budget.assertStage);
  assert.throws(()=>createOriginalDevelopTimeBudget({...input,endsAtMillis:input.startsAtMillis+1800000,reviewedMode:ORIGINAL_DEVELOP_MODE}));
  now=1000;assert.doesNotThrow(()=>createCopyTimeBudget({...input,endsAtMillis:now+600000}));
  const work=createOriginalDevelopTimeBudget({...input,reviewedMode:ORIGINAL_DEVELOP_MODE});
  assert.throws(()=>work.beginWork(now+300001));work.beginWork(now+300000);
  now+=149999;work.assertStage();assert.throws(work.assertSubmission);now++;assert.throws(work.assertStage);
});
for(const original of [false,true])test(`current stage deadline is read-only and follows each ${original?"original":"default"} budget phase`,async()=>{
  let now=1000;const input={startsAtMillis:now,endsAtMillis:now+(original?1200000:600000),nowMillis:()=>now};
  const budget=original?createOriginalDevelopTimeBudget({...input,reviewedMode:ORIGINAL_DEVELOP_MODE}):createCopyTimeBudget(input);
  const preparationDeadline=input.endsAtMillis-420000;
  assert.equal(budget.currentStageDeadlineMillis(),preparationDeadline);assert.equal(budget.currentStageDeadlineMillis(),preparationDeadline);
  budget.beginWork(now+300000);assert.equal(budget.currentStageDeadlineMillis(),now+150000);
  now+=1000;await budget.beginCleanup("file");assert.equal(budget.currentStageDeadlineMillis(),now+60000);
  await budget.beginCleanup("iam");assert.equal(budget.currentStageDeadlineMillis(),now+150000);
  await budget.beginCleanup("oauth");assert.equal(budget.currentStageDeadlineMillis(),now+270000);
  assert.equal(budget.complete().stages.length,5);
});
test("human transport times out at the work deadline and settles before consuming cleanup reserve",async()=>{
  let now=1000;const endsAtMillis=now+1200000,records=[];
  const budget=createOriginalDevelopTimeBudget({startsAtMillis:now,endsAtMillis,reviewedMode:ORIGINAL_DEVELOP_MODE,nowMillis:()=>now});
  budget.beginWork(now+300000);const workDeadline=budget.currentStageDeadlineMillis();let observedDeadline=null;
  const human=createDevelopHumanInputs({receiptId:"work-human-timeout",nowMillis:()=>now,assertActive:budget.assertStage,
    deadlineMillis:()=>Math.min(endsAtMillis,budget.currentStageDeadlineMillis()),record:async value=>records.push(value),
    exchange:request=>new Promise((resolve,reject)=>{
      void resolve;observedDeadline=request.deadlineMillis;
      setTimeout(()=>{now=request.deadlineMillis;reject(Error("explicit_human_response_deadline"));},5);
    })});
  const intent={participants:[{principalId:"owner@example.test",role:"owner"}],startsAtMillis:1000,endsAtMillis,operations:[{operationId:"local-work-timeout"}]};
  const pending=human.collectConfirmations({kind:"owner",intent,intentDigest:digest(intent),notBeforeMillis:now,deadlineMillis:endsAtMillis,assertActive:budget.assertStage});
  const settled=await Promise.allSettled([Promise.resolve("technical reads settled"),pending]);
  assert.equal(settled[1].status,"rejected");assert.match(settled[1].reason.message,/explicit_human_response_deadline/);
  assert.equal(observedDeadline,workDeadline);assert.ok(observedDeadline<endsAtMillis);human.close();
  assert.equal(records.filter(r=>r.phase==="human-input-request").length,1);assert.equal(records.some(r=>r.phase==="human-input-reply"),false);
  await budget.beginCleanup("file");assert.equal(budget.currentStageDeadlineMillis(),workDeadline+60000);
  await budget.beginCleanup("iam");await budget.beginCleanup("oauth");const report=budget.complete();
  assert.equal(report.inFlight,0);assert.deepEqual(report.breaches,[]);assert.ok(now+270000<endsAtMillis);
});
test("mode binds the original destination and cannot widen a live scope without its evidence plan",()=>{
  const f=originalWindowFixture(),data=args(f),bound=bindWindow(data);
  assert.equal(bound.executionMode,ORIGINAL_DEVELOP_MODE);assert.notEqual(digest(bound),digest(bindWindow({...data,executionMode:undefined})));
  assert.throws(()=>bindWindow({...data,executionMode:"unknown"}));
  assert.throws(()=>bindWindow({...data,direction:"inverse",scope:{...data.scope,transitionId:data.prepared.recoveryOperationId}}),/only the reviewed forward transition/);
  assert.throws(()=>bindWindow({...data,scope:{...data.scope,expectedWorkbookFileId:"other-sheet"}}));
  const prepared={...data.prepared,projectId:"reguerta-9f27f"};delete prepared.preparedDigest;prepared.preparedDigest=digest(prepared);
  assert.throws(()=>bindWindow({...data,prepared}),/post-permission evidence/);assert.equal(f.state.calls.length,0);
});
test("slow real-session preparation and admission finish before the single short writer is issued",async t=>{
  const f=originalWindowFixture(),data=args(f);let session;
  const barrier={...f.barrier,acquire:async()=>{assert.equal(f.state.mints,0);f.state.now+=180000;return {acquired:true};}};
  const executor={...f.executor,inspectAdmission:async input=>{assert.equal(f.state.mints,0);f.state.now+=120000;return f.executor.inspectAdmission(input);}};
  const sessions=f.sessions(data,"slow-preparation-owner",{barrier:undefined,executor:undefined,composeServices:async()=>{
    f.state.now+=300000;assert.equal(f.state.mints,0);return {barrier,executor,close:async()=>{}};
  }});
  const result=await run({...data,...sessions,openSession:async context=>{session=await sessions.openSession(context);assert.equal(f.state.mints,0);assert.equal(session.sheetsAdapter,undefined);return session;},
    root:root(t),nowMillis:()=>f.state.now,fetchImpl:f.fetchImpl});
  assert.equal(result.kind,"direction-verified-and-contained",JSON.stringify(result));
  const entries=read(result.directory).records.map(r=>r.value),phases=entries.map(v=>v.phase);
  assert.ok(phases.indexOf("google-mint-intent")>phases.indexOf("admission"));assert.ok(phases.indexOf("admission")>phases.indexOf("acquired"));
  assert.ok(phases.includes("google-writer-deferred"));assert.equal(f.state.mints,1);assert.equal(f.batch.sheets.mutations.length,1);
  assert.equal(f.state.permission,false);assert.equal(f.state.disabled,true);assert.deepEqual(f.state.policy.bindings,[]);assert.equal(result.cleanup.failures.length,0);
  await assert.rejects(session.openWriter({acquired:{acquired:true},admission:{checksPassed:true,direction:"forward"}}),/already consumed/);
});
test("deferred issuance still waits at least two minutes after the IAM grant",async t=>{
  const f=originalWindowFixture(),data=args(f);let grantedAt=null,mintedAt=null;
  const fetchImpl=async(url,options)=>{
    const response=await f.fetchImpl(url,options);
    if(url.endsWith(":setIamPolicy")&&JSON.parse(options.body).policy.bindings.length)grantedAt=f.state.now;
    if(url.includes("iamcredentials.googleapis.com")){mintedAt=f.state.now;assert.ok(mintedAt-grantedAt>=120000);}
    return response;
  };
  const result=await run({...data,...f.sessions(data),root:root(t),nowMillis:()=>f.state.now,fetchImpl});
  assert.equal(result.kind,"direction-verified-and-contained");assert.ok(Number.isSafeInteger(grantedAt)&&Number.isSafeInteger(mintedAt));assert.equal(f.state.mints,1);
});
for(const failure of ["acquire","admission","late-admission","sheet-drift","mint"])
test(`deferred ${failure} rejection retains independent cleanup without early mint or Sheets writes`,async t=>{
  const f=originalWindowFixture({fault:failure==="mint"?"mint":null}),data=args(f);
  const barrier={...f.barrier,acquire:async()=>{assert.equal(f.state.mints,0);if(failure==="acquire")throw Error("Unproven barrier");return {acquired:true};}};
  const executor={...f.executor,inspectAdmission:async input=>{
    assert.equal(f.state.mints,0);
    if(failure==="late-admission")f.state.now=data.window.endsAtMillis-420000;
    if(failure==="sheet-drift")f.batch.sheets.state.sheets[0].data[0].rowData[0].values[0].note="External change";
    return failure==="admission"?{checksPassed:false}:f.executor.inspectAdmission(input);
  }};
  const result=await execute(t,f,data,{barrier,executor});assert.equal(result.kind,"inspection-required");
  assert.equal(f.state.mints,failure==="mint"?1:0);assert.equal(f.batch.sheets.mutations.length,0);
  assert.equal(f.state.disabled,true);assert.equal(f.state.permission,false);assert.deepEqual(f.state.policy.bindings,[]);assert.equal(f.state.revoked.size,1);
  assert.deepEqual(read(result.directory).records.filter(r=>r.value.phase==="cleanup-intent").map(r=>r.value.stage),["file","iam","oauth"]);
});
for(const variant of ["copy-widening","thirty-minutes"])
test(`unsupported ${variant} window fails before provider access`,async t=>{
  const f=originalWindowFixture(),data=args(f);
  if(variant==="copy-widening")delete data.executionMode;else data.window.endsAtMillis=data.window.startsAtMillis+1800000;
  await assert.rejects(execute(t,f,data));assert.equal(f.state.calls.length,0);assert.equal(f.state.mints,0);
});
test("recovery cannot add or omit the original operation's reviewed timing mode",async t=>{
  const f=originalWindowFixture(),data=args(f),first=await execute(t,f,data),saved=read(first.directory);let opens=0;
  const request={directory:first.directory,recoveryId:"deferred-recovery",expectedBindingDigest:digest(saved.binding),window:{startsAtMillis:f.state.now,endsAtMillis:f.state.now+1200000},
    nowMillis:()=>f.state.now,fetchImpl:f.fetchImpl,openRecoverySession:async()=>{opens++;throw Error("Should not open");}};
  await assert.rejects(recover(request));assert.equal(opens,0);
  const recovered=await recover({...request,executionMode:ORIGINAL_DEVELOP_MODE,openRecoverySession:f.sessions(data,"recovery-owner").openRecoverySession});
  assert.equal(recovered.records.at(-1).value.kind,"cleanup-verified-inspection-only");assert.equal(f.state.mints,1);
});
