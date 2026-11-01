"use strict";

// Absolute deadlines, not an estimate of Google's latency. All calls are awaited:
// aborting HTTP does not establish that a remote write was not applied.
const assert=require("node:assert/strict"),fs=require("node:fs");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const LIMITS=Object.freeze({window:600000,work:150000,fileCleanup:60000,iamCleanup:90000,oauthCleanup:120000});
const CLEANUP=LIMITS.fileCleanup+LIMITS.iamCleanup+LIMITS.oauthCleanup;

function prepareCopyTimeBudget(prepared) {
  const value={kind:"isolated-copy-deadline-budget",copyPreparationDigest:prepared.preparationDigest,
    sourceDigest:digest(fs.readFileSync(__filename,"utf8")),limits:LIMITS,
    cleanupMillis:CLEANUP,minimumWindowAtMintMillis:LIMITS.work+CLEANUP,
    tokenLifetimeMillis:300000,maximumTokens:1,canExecute:false,canEnterMaintenance:false};
  return {...value,budgetDigest:digest(value)};
}
function createCopyTimeBudget({startsAtMillis,endsAtMillis,nowMillis=Date.now,fetchImpl=fetch}) {
  assert.ok([startsAtMillis,endsAtMillis,nowMillis()].every(Number.isSafeInteger));
  assert.ok(startsAtMillis<=nowMillis()&&endsAtMillis>nowMillis()&&endsAtMillis-startsAtMillis<=LIMITS.window);
  let phase="preparation",deadline=endsAtMillis-LIMITS.work-CLEANUP,expiry=null,cleanupStart=null,inFlight=0;
  const breaches=[],stages=[{phase,startedAtMillis:nowMillis(),deadlineMillis:deadline}],pending=new Set();
  function observe() {
    if(nowMillis()>deadline&&!breaches.includes(phase))breaches.push(phase);
  }
  function assertStage() {
    assert.ok(nowMillis()>=startsAtMillis&&nowMillis()<deadline,"copy_stage_deadline_exhausted");
  }
  function enter(name,end) {observe();phase=name;deadline=end;stages.push({phase,startedAtMillis:nowMillis(),deadlineMillis:deadline});}
  return {
    assertStage,
    beginWork(tokenExpiresAtMillis) {
      assertStage();expiry=tokenExpiresAtMillis;
      assert.ok(Number.isSafeInteger(expiry)&&expiry<=nowMillis()+300000&&expiry<=endsAtMillis);
      assert.ok(nowMillis()+LIMITS.work+LIMITS.fileCleanup<expiry,"copy_token_cleanup_budget_exhausted");
      enter("work",Math.min(nowMillis()+LIMITS.work,expiry-LIMITS.fileCleanup,endsAtMillis-CLEANUP));
    },
    assertSubmission() {
      assertStage();assert.equal(phase,"work");
      // Preserve the old 150s token fence. A 30s write plus 45s readback must
      // also fit the work slot; a rejected inverse retains the forward receipt.
      assert.ok(nowMillis()+75000<deadline&&nowMillis()+150000<expiry,"copy_batch_readback_budget_exhausted");
    },
    async beginCleanup(name) {
      // Promise.all in a provider may reject before its sibling reads settle.
      // Join them under their original HTTP deadlines before changing phase.
      await Promise.allSettled([...pending]);
      cleanupStart??=nowMillis();
      const start=Math.min(cleanupStart,endsAtMillis-CLEANUP);
      if(name==="file")enter("file-cleanup",Math.min(start+LIMITS.fileCleanup,expiry??endsAtMillis));
      else if(name==="iam")enter("iam-cleanup",start+LIMITS.fileCleanup+LIMITS.iamCleanup);
      else {assert.equal(name,"oauth");enter("oauth-cleanup",Math.min(start+CLEANUP,endsAtMillis));}
    },
    complete() {
      observe();assert.equal(inFlight,0);assert.ok(nowMillis()<=endsAtMillis);
      assert.deepEqual(breaches,[],"copy_deadline_breach_requires_inspection");
      return {kind:"copy-deadline-report",stages,finishedAtMillis:nowMillis(),inFlight,breaches,canEnterMaintenance:false};
    },
    async fetch(url,options={}) {
      assertStage();const callDeadline=deadline;
      const signal=AbortSignal.timeout(Math.max(1,callDeadline-nowMillis()));
      const signals=options.signal?[options.signal,signal]:[signal];inFlight++;
      const action=(async()=>{
        const response=await fetchImpl(url,{...options,signal:AbortSignal.any(signals)});
        const data=await response.text();
        assert.ok(nowMillis()<callDeadline,"copy_http_deadline_exhausted");
        return {status:response.status,json:async()=>JSON.parse(data)};
      })();
      pending.add(action);
      try{return await action;}finally{pending.delete(action);inFlight--;observe();}
    },
  };
}

async function runBudgetedCopy(args) {
  const {prepared,input,iamBearer,ownerBearer,fetchImpl=fetch,nowMillis=Date.now,sleep,journalRoot}=args;
  const reviewed=prepareCopyTimeBudget(prepared);
  assert.equal(input.budgetDigest,reviewed.budgetDigest,"reviewed full budget required");
  const timeBudget=createCopyTimeBudget({...input,nowMillis,fetchImpl});
  const {createIamProvider}=require("./develop-writer-copy-provider.cjs");
  const {createCopyOwner,openCopyWriter,createIsolationReader}=require("./develop-helper-copy-provider.cjs");
  const {runCopy}=require("./rehearse-develop-helper-copy.cjs");
  const common={fileId:prepared.fileId,protectedWorkbookIds:prepared.protectedWorkbookIds,fetchImpl:timeBudget.fetch,nowMillis};
  const owner=createCopyOwner({...common,ownerBearer,sleep});
  try{return await runCopy({prepared,input,journalRoot,nowMillis,sleep,timeBudget,
    iam:createIamProvider({identity:prepared.identity,iamBearer,fetchImpl:timeBudget.fetch}),
    owner,
    readIsolation:createIsolationReader({iamBearer,fetchImpl:timeBudget.fetch,nowMillis}),
    openWriter:options=>openCopyWriter({...common,...options})});}
  catch {
    await timeBudget.beginCleanup("oauth");
    let cleanupVerified=false;try{cleanupVerified=(await owner.close()).verified===true;}catch{/* Preserve uncertainty. */}
    throw Object.assign(Error("budgeted_copy_preflight_failed"),{cleanupVerified});
  }
}
module.exports={LIMITS,prepareCopyTimeBudget,createCopyTimeBudget,runBudgetedCopy};
if(require.main===module){console.error("explicit_reviewed_copy_budget_required");process.exitCode=1;}
