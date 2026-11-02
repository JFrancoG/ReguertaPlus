"use strict";

const assert=require("node:assert/strict");
const {createBarrierObservationSessions}=require("./develop-barrier-observation-session.cjs");
const {sealInitialEvidence,verifyInitialEvidenceSeal}=require("./develop-initial-evidence-seal.cjs");
const {createInitialReviewCollector,validateInitialCollectionReview}=require("./develop-initial-review-collector.cjs");
const {createDevelopCensusReader}=require("./develop-live-census-reader.cjs");
const {createControlledDevelopBarrier}=require("./controlled-develop-barrier.cjs");
const {createControlledDevelopMigrationExecutor}=require("./controlled-develop-migration.cjs");

// Pass this factory to createOriginalWindowSessions.composeServices. The owner
// credential and absolute budget belong to the outer session, including cleanup.
function composeDevelopWindowServices({firestore,prepared,scope,review,reviewDigest,iamBearer,readHumanReports,initialEvidencePlan=null,readInitialReview=null,initialCollectionReview=null,collectConfirmations=null,readInitialHumanReports=null,sleep}) {
  assert.equal(firestore.projectId,"reguerta-9f27f");assert.equal(firestore.databaseId,"(default)");
  if(initialEvidencePlan){assert.equal(scope,undefined);assert.equal(review,undefined);}
  assert.ok(!(readInitialReview&&initialCollectionReview),"Choose one initial collection source");
  if(initialCollectionReview){initialCollectionReview=validateInitialCollectionReview(initialCollectionReview,initialEvidencePlan.collectionReviewDigest);
    assert.equal(typeof collectConfirmations,"function");assert.equal(typeof readInitialHumanReports,"function");}
  prepared=structuredClone(prepared);scope=structuredClone(scope);review=structuredClone(review);initialEvidencePlan=structuredClone(initialEvidencePlan);
  return async ({timeBudget,owner,assertWriterAuthority,nowMillis,record,getPermissionTransition,binding,assertActive=timeBudget.assertStage,receiptId,permissionReceipt,nativeReviewDigest,retainedSeal})=>{
    assert.equal(binding.preparedDigest,prepared.preparedDigest,"Session preparation differs from service preparation");
    assert.equal(binding.reviewPackageDigest,prepared.reviewPackageDigest,"Session review package differs from service package");
    let sealed=null,currentScope=scope,currentReview=review,currentDigest=reviewDigest;
    if(initialEvidencePlan){
      assert.deepEqual(binding.initialEvidencePlan,initialEvidencePlan);assert.equal(scope,undefined);assert.equal(review,undefined);
      if(retainedSeal)sealed=verifyInitialEvidenceSeal(retainedSeal,binding,receiptId,nativeReviewDigest);
      else {
        if(initialCollectionReview){
          const unavailable=async()=>{throw Error("initial_collection_is_read_only");};
          const passive=createControlledDevelopMigrationExecutor({firestore,prepared,nowMillis,
            controlPlane:{readBackClosed:unavailable,readBackOwnerObservation:unavailable,readBackAdministratorObservation:unavailable},
            failurePersistence:{readExistingFailure:unavailable,retainFailureAndReadBack:unavailable}});
          readInitialReview=createInitialReviewCollector({reviewed:initialCollectionReview,reviewDigest:initialEvidencePlan.collectionReviewDigest,iamBearer,
            collectConfirmations,readHumanReports:readInitialHumanReports,sleep,readSource:async({direction})=>{
              const value=await passive.inspectAdmission({direction});assert.deepEqual(value.blockers,["window_scope_missing"]);
              return {source:value.source,startedAtMillis:value.startedAtMillis,observedAtMillis:value.observedAtMillis};
            }});
        }
        assert.equal(typeof readInitialReview,"function");timeBudget.assertStage();
        const transition=getPermissionTransition();
        const collected=await readInitialReview({binding:structuredClone(binding),receiptId,permissionReceipt:structuredClone(permissionReceipt),transition,nativeReviewDigest,record,
          fetchImpl:timeBudget.fetch,nowMillis,assertActive,captureOwner:()=>owner.capture(true),assertWriterAuthority});
        timeBudget.assertStage();
        sealed=sealInitialEvidence({binding,receiptId,permissionReceipt,transition,nativeReviewDigest,scope:collected.scope,review:collected.review,nowMillis:nowMillis()});
      }
      currentScope=sealed.scope;currentReview=sealed.review;currentDigest=sealed.reviewDigest;
    }else assert.ok(!binding?.initialEvidencePlan,"Deferred evidence requires the planned composition");
    const observations=createBarrierObservationSessions({scope:currentScope,review:currentReview,reviewDigest:currentDigest,timeBudget,owner,iamBearer,
      assertWriterAuthority,getPermissionTransition,readCensus:createDevelopCensusReader({bearer:iamBearer}),readHumanReports,nowMillis,record});
    try {
      const barrier=createControlledDevelopBarrier({firestore,prepared,openObservationSession:observations.openObservationSession,nowMillis});
      const executor=createControlledDevelopMigrationExecutor({firestore,prepared,controlPlane:barrier.controlPlane,
        failurePersistence:barrier.failurePersistence,nowMillis});
      return {barrier,executor,initialSeal:sealed,async close(){try{await observations.close();}finally{iamBearer=null;}}};
    }catch(error){try{await observations.close();}finally{iamBearer=null;}throw error;}
  };
}
module.exports={composeDevelopWindowServices};
if(require.main===module){console.error("explicit_develop_services_required_no_cli");process.exitCode=1;}
