"use strict";

// One already-authorized direction, composed from existing adapters. No CLI,
// SDK construction, permission selection, automatic inverse or execution resume.
const assert=require("node:assert/strict");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {createCopyTimeBudget}=require("./develop-copy-time-budget.cjs");
const {createWindowJournal,claimWindowRecovery}=require("./develop-window-journal.cjs");

function bind({prepared,scope,direction,window,reviewPackage,forwardReadBack=null,forwardPlan=null}) {
  const {preparedDigest,...body}=prepared;assert.equal(digest(body),preparedDigest);
  assert.ok(["reguerta-9f27f","demo-reguerta-hu084-migration"].includes(prepared.projectId));
  assert.equal(prepared.environment,"develop");assert.equal(prepared.liveExecutable,false);
  assert.ok(["forward","inverse"].includes(direction));assert.equal(scope.environment,"develop");
  assert.equal(scope.transitionId,direction==="forward"?prepared.operationId:prepared.recoveryOperationId);
  assert.equal(reviewPackage.packageDigest,prepared.reviewPackageDigest);
  return {projectId:prepared.projectId,environment:"develop",preparedDigest,scope,direction,window,
    reviewPackageDigest:reviewPackage.packageDigest,forwardReceiptDigest:forwardReadBack===null?null:digest(forwardReadBack),
    forwardPlanDigest:forwardPlan===null?null:digest(forwardPlan)};
}
async function cleanup(session,budget,note) {
  const failures=[];
  // Every stage is attempted even if the prior cleanup, deadline transition or
  // evidence append failed. All provider promises settle before terminal output.
  for(const stage of ["file","iam","oauth"]) {
    try{await budget.beginCleanup(stage);}catch{failures.push(stage+"-deadline");}
    try{await note({phase:"cleanup-intent",stage});}catch{failures.push(stage+"-journal");}
    try{const result=await session.cleanup[stage]();assert.equal(result.verified,true);
      await note({phase:"cleanup-verified",stage,result});}catch{failures.push(stage+"-unverified");}
  }
  let report=null;try{report=budget.complete();}catch{failures.push("deadline-unverified");}
  return {failures,report};
}
async function inspect(session,saved) {
  const results={};
  for(const name of ["barrier","firestore","sheets"]) {
    try{results[name]=await session.inspect[name](saved);}catch{results[name]={kind:"unavailable"};}
  }
  return results;
}
async function runControlledWindow(args) {
  const {openSession,openRecoverySession,nowMillis=Date.now,signal,root,receiptId,...data}=args;
  const frozen=structuredClone(data),binding=bind(frozen);
  const budget=createCopyTimeBudget({...binding.window,nowMillis});
  const journal=createWindowJournal({root,receiptId,binding}),note=value=>journal.append(value);
  let session=null,result=null,failure=null,clean=null,openAttempted=false;
  try {
    const stage=()=>{if(signal?.aborted)throw Error("window interrupted");budget.assertStage();};
    stage();note({phase:"session-intent"});openAttempted=true;session=await openSession({binding:structuredClone(binding),timeBudget:budget,record:note});stage();
    budget.beginWork(session.tokenExpiresAtMillis);
    note({phase:"acquisition-intent"});const acquired=await session.barrier.acquire({scope:binding.scope,signal});
    note({phase:"acquired",acquired});stage();assert.equal(acquired.acquired,true);
    const admission=await session.executor.inspectAdmission({scope:binding.scope,direction:binding.direction,forwardReadBack:frozen.forwardReadBack});
    note({phase:"admission",admission});stage();assert.equal(admission.checksPassed,true);
    result=await session.executor.executeJoint({scope:binding.scope,admission,sourceInput:frozen.sourceInput,reviewPackage:frozen.reviewPackage,
      forwardReadBack:frozen.forwardReadBack,forwardPlan:frozen.forwardPlan,observeSheets:session.observeSheets,sheetsAdapter:session.sheetsAdapter,
      timeBudget:budget,record:note,signal});
    note({phase:"joint-result",result});
  }catch{failure="window-inspection-required";}
  finally {
    if(!session&&openAttempted)try{session=await openRecoverySession({binding:structuredClone(binding),saved:journal.read(),timeBudget:budget,record:note});}catch{failure="session-cleanup-unavailable";}
    if(session) {
      if(failure||result?.kind!=="joint-step-verified")try{note({phase:"inspection",results:await inspect(session,journal.read())});}catch{failure="inspection-journal-unavailable";}
      clean=await cleanup(session,budget,note);
    }
  }
  const terminal={phase:"window-terminal",kind:!failure&&result?.kind==="joint-step-verified"&&clean?.failures.length===0?"direction-verified-and-contained":"inspection-required",
    failure,result,cleanup:clean,providerCallsSettled:true,canResumeExecution:false,canEnterMaintenance:false};
  try{note(terminal);return {...terminal,journalVerified:true,directory:journal.directory};}
  finally{journal.release({cleanupVerified:!openAttempted||clean?.failures.length===0});}
}
async function recoverControlledWindow({directory,recoveryId,expectedBindingDigest,window,nowMillis=Date.now,openRecoverySession}) {
  const budget=createCopyTimeBudget({...window,nowMillis});
  const journal=claimWindowRecovery({directory,recoveryId,expectedBindingDigest});
  let session=null,results=null,clean=null;
  try {
    const saved=journal.read();session=await openRecoverySession({binding:saved.binding,saved,timeBudget:budget,record:value=>journal.append(value)});
    results=await inspect(session,saved);journal.append({phase:"recovery-inspection",results});
  } finally {
    try {
      if(session)clean=await cleanup(session,budget,value=>journal.append(value));
      journal.append({phase:"recovery-terminal",recoveryId,results,cleanup:clean,providerCallsSettled:true,
        kind:clean?.failures.length===0?"cleanup-verified-inspection-only":"inspection-required",canResumeExecution:false,canEnterMaintenance:false});
    } finally {journal.release({cleanupVerified:clean?.failures.length===0});}
  }
  return journal.read();
}
module.exports={runControlledWindow,recoverControlledWindow};
if(require.main===module){console.error("explicit_window_composition_required_no_apply_cli");process.exitCode=1;}
