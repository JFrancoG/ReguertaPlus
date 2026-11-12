"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {wrapClosingSession}=require("../scripts/develop-window-session-closure.cjs");
const {originalWindowFixture}=require("./develop-original-window-fixture.cjs");
const {runControlledWindow:run}=require("../scripts/develop-controlled-window.cjs");
const {readWindowJournal:read}=require("../scripts/develop-window-journal.cjs");
const {ORIGINAL_DEVELOP_MODE}=require("../scripts/develop-copy-time-budget.cjs");
const {FILE}=require("../scripts/develop-original-writer-provider.cjs");

test("a deferred real session exposes its writer to the runner and completes the synthetic batch",async t=>{
  const f=originalWindowFixture(),root=fs.mkdtempSync(path.join(os.tmpdir(),"deferred-session-"));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const data={...f.args(),receiptId:"deferred-session",executionMode:ORIGINAL_DEVELOP_MODE};
  data.scope.expectedWorkbookFileId=FILE;data.window.endsAtMillis=data.window.startsAtMillis+1200000;
  const sessions=f.sessions(data,"deferred-owner"),state={closing:0,inFlight:false},human={beginClosing(){state.closing++;}},
    native={beginClosing(){},isInFlight(){return state.inFlight;}};
  let actualSession=null,writerObserved=false;
  const openSession=async context=>{
    actualSession=await sessions.openSession(context);
    assert.equal(actualSession.tokenExpiresAtMillis,undefined);
    const execute=actualSession.executor.executeJoint;
    actualSession.executor.executeJoint=async args=>{
      assert.equal(actualSession.tokenExpiresAtMillis,f.state.writerExpiry);
      assert.strictEqual(args.sheetsAdapter,actualSession.sheetsAdapter);
      writerObserved=true;return execute(args);
    };
    return wrapClosingSession(actualSession,{human,native});
  };
  const result=await run({...data,...sessions,openSession,root,nowMillis:()=>f.state.now,fetchImpl:f.fetchImpl});
  assert.equal(result.kind,"direction-verified-and-contained",JSON.stringify(result));
  assert.equal(writerObserved,true);assert.equal(f.state.mints,1);assert.equal(f.batch.sheets.mutations.length,1);
  assert.equal(f.state.permission,false);assert.equal(f.state.disabled,true);assert.deepEqual(result.cleanup.failures,[]);
  assert.ok(state.closing>=3);assert.ok(read(result.directory).records.some(r=>r.value.phase==="joint-result"));
});

test("closing blocks inspection and file removal while native action is in flight, but allows other cleanup",async()=>{
  const state={human:false,native:false,inFlight:true,events:[]};
  const group=kind=>async()=>{assert.equal(state.human,true);assert.equal(state.native,true);state.events.push(kind);return {verified:true};};
  const session={inspect:{barrier:group("inspect")},cleanup:{file:group("file"),iam:group("iam"),oauth:group("oauth")}},
    wrapped=wrapClosingSession(session,{human:{beginClosing(){state.human=true;}},native:{beginClosing(){state.native=true;},isInFlight(){return state.inFlight;}}});
  assert.strictEqual(wrapped,session);
  await assert.rejects(wrapped.inspect.barrier(),/native_action_unsettled/);
  await assert.rejects(wrapped.cleanup.file(),/native_action_unsettled/);
  await wrapped.cleanup.iam();await wrapped.cleanup.oauth();
  state.inFlight=false;await wrapped.cleanup.file();
  assert.deepEqual(state.events,["iam","oauth","file"]);
});

test("runner failure closes a pending human exchange before inspection and cleanup",async t=>{
  const f=originalWindowFixture(),root=fs.mkdtempSync(path.join(os.tmpdir(),"closing-session-"));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const data={...f.args(),receiptId:"closing-session",executionMode:ORIGINAL_DEVELOP_MODE};
  data.scope.expectedWorkbookFileId=FILE;data.window.endsAtMillis=data.window.startsAtMillis+1200000;
  f.barrier.acquire=async()=>{throw Error("synthetic barrier interruption");};
  const sessions=f.sessions(data,"closing-owner"),state={pending:true,closing:false},human={beginClosing(){state.pending=false;state.closing=true;}},
    native={beginClosing(){},isInFlight(){return false;}};
  const openSession=async context=>wrapClosingSession(await sessions.openSession(context),{human,native});
  const result=await run({...data,...sessions,openSession,root,nowMillis:()=>f.state.now,fetchImpl:f.fetchImpl});
  assert.equal(result.kind,"inspection-required");assert.equal(state.pending,false);assert.equal(state.closing,true);
  assert.equal(f.state.permission,false);assert.equal(f.state.disabled,true);assert.deepEqual(result.cleanup.failures,[]);
  assert.equal(f.batch.sheets.mutations.length,0);
  const records=read(result.directory).records.map(r=>r.value.phase);
  assert.ok(records.includes("inspection"));assert.equal(records.filter(phase=>phase==="cleanup-verified").length,3);
});
