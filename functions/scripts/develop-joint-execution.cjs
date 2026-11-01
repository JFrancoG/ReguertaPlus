"use strict";

// Internal composition, not a second workflow engine. Provider calls are joined:
// a local deadline cannot cancel or disprove a Firestore commit already sent.
const assert=require("node:assert/strict");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {planBatch}=require("./prepare-develop-helper-batch.cjs");
const {assertShiftSheetsOwnerPreservation:preserved}=require("../lib/shift-sheets-owner-manifest.js");

function guardFirestore(firestore,assertMutation) {
  return new Proxy(firestore,{get(target,name){
    if(name==="runTransaction")return (callback,options={})=>target.runTransaction(async tx=>{
      let wrote=false;
      const guarded=new Proxy(tx,{get(transaction,key){
        const value=Reflect.get(transaction,key);
        if(["create","update","delete","set"].includes(key))return (...args)=>{
          assertMutation();wrote=true;value.apply(transaction,args);return guarded;
        };
        return typeof value==="function"?value.bind(transaction):value;
      }});
      const result=await callback(guarded);
      // Includes SDK retries and late fence reads; no commit if the callback
      // returns after the deadline. An already-dispatched commit remains uncertain.
      if(wrote)assertMutation();return result;
    },options.readOnly?options:{...options,maxAttempts:1});
    const value=Reflect.get(target,name);return typeof value==="function"?value.bind(target):value;
  }});
}

async function executeJointStep({prepared,scope,admission,forwardReadBack=null,sourceInput,reviewPackage,
  forwardPlan=null,observeSheets,sheetsAdapter,timeBudget,record,signal,executeFirestore,inspectFirestore}) {
  const direction=admission.direction;
  assert.ok(["forward","inverse"].includes(direction));
  assert.equal(reviewPackage.packageDigest,prepared.reviewPackageDigest);
  for(const method of ["assertStage","assertSubmission"])assert.equal(typeof timeBudget?.[method],"function");
  for(const fn of [observeSheets,record,executeFirestore,inspectFirestore,sheetsAdapter?.inspect,sheetsAdapter?.reconcile])assert.equal(typeof fn,"function");
  const stage=()=>{if(signal?.aborted)throw Error("joint_interrupted");timeBudget.assertStage();};
  const mutation=()=>{stage();direction==="forward"?timeBudget.assertSubmission():timeBudget.assertStage();};
  let phase="planning",plan=null,firestoreReceipt=null,sheetsResult=null;
  const inspect=async()=>{
    // Separate read-only inspection never calls execute/reconcile, acquires a
    // barrier, or interprets an absent/unavailable receipt as permission to retry.
    let firestore,sheets={kind:"not-inspected"};
    try{firestore=await inspectFirestore({scope,direction,forwardReadBack});}catch{firestore={kind:"unavailable"};}
    if(plan)try{
      const result=await sheetsAdapter.inspect(plan.operation),observation=await observeSheets();
      if(result.kind==="verified")preserved({manifest:plan.preservation,after:observation.snapshot});
      sheets={kind:result.kind,result,snapshotDigest:digest(observation.snapshot)};
    }catch{sheets={kind:"unavailable-or-drifted"};}
    return {firestore,sheets,canRetry:false,canEnterMaintenance:false};
  };
  try {
    stage();const observation=await observeSheets();stage();
    plan=await planBatch({sourceInput,reviewPackage,observation,direction,forwardPlan});stage();
    assert.equal(plan.operation.operationId,direction==="forward"?prepared.operationId:prepared.recoveryOperationId);
    assert.equal(plan.reviewPackageDigest,prepared.reviewPackageDigest);
    await record({phase:"intent",preparedDigest:prepared.preparedDigest,admissionDigest:admission.admissionDigest,plan});stage();
    const writeFirestore=async()=>{
      phase="firestore";mutation();
      firestoreReceipt=await executeFirestore({scope,admission,forwardReadBack,assertMutation:mutation});
      await record({phase:"firestore-receipt",receipt:firestoreReceipt});stage();
    };
    const writeSheets=async()=>{
      phase="sheets";stage();
      sheetsResult=await sheetsAdapter.reconcile({...plan.operation,signal,assertSubmissionNow:()=>{stage();timeBudget.assertSubmission();},
        authorizeMutation:async binding=>{
          stage();assert.equal(binding.requestDigest,plan.requestDigest);assert.deepEqual(binding.requests,plan.requests);
          const fresh=await observeSheets();stage();assert.equal(fresh.snapshotDigest,plan.observationDigest);
          assert.equal(fresh.after.file.version,plan.observedVersion);
        }});
      await record({phase:"sheets-result",result:sheetsResult});stage();
      assert.equal(sheetsResult.kind,"verified");const after=await observeSheets();stage();
      preserved({manifest:plan.preservation,after:after.snapshot});
      await record({phase:"sheets-owner-readback",observation:after});stage();
    };
    // Recovery is separately admitted. The normal direction commits Firestore
    // first; recovery restores Sheets before removing canonical Firestore rows.
    if(direction==="forward"){await writeFirestore();await writeSheets();}
    else{await writeSheets();await writeFirestore();}
    return {kind:"joint-step-verified",direction,plan,firestoreReceipt,sheetsResult,
      cleanupVerified:false,canRetry:false,canEnterMaintenance:false};
  } catch {
    const result={kind:"joint-inspection-required",direction,phase,plan,firestoreReceipt,sheetsResult,
      inspection:await inspect(),cleanupVerified:false,canRetry:false,canEnterMaintenance:false};
    // If the local evidence sink also fails, propagate that failure. Do not
    // claim the uncertain outcome was recorded or begin another operation.
    await record({phase:"inspection-required",result});return result;
  }
}
module.exports={guardFirestore,executeJointStep};
