"use strict";

const assert=require("node:assert/strict");
const {createBarrierObservationSessions}=require("./develop-barrier-observation-session.cjs");
const {createDevelopCensusReader}=require("./develop-live-census-reader.cjs");
const {createControlledDevelopBarrier}=require("./controlled-develop-barrier.cjs");
const {createControlledDevelopMigrationExecutor}=require("./controlled-develop-migration.cjs");

// Pass this factory to createOriginalWindowSessions.composeServices. The owner
// credential and absolute budget belong to the outer session, including cleanup.
function composeDevelopWindowServices({firestore,prepared,scope,review,reviewDigest,iamBearer,readHumanReports}) {
  assert.equal(firestore.projectId,"reguerta-9f27f");assert.equal(firestore.databaseId,"(default)");
  prepared=structuredClone(prepared);scope=structuredClone(scope);review=structuredClone(review);
  return ({timeBudget,owner,assertWriterAuthority,nowMillis,record,getPermissionTransition})=>{
    const observations=createBarrierObservationSessions({scope,review,reviewDigest,timeBudget,owner,iamBearer,
      assertWriterAuthority,getPermissionTransition,readCensus:createDevelopCensusReader({bearer:iamBearer}),readHumanReports,nowMillis,record});
    const barrier=createControlledDevelopBarrier({firestore,prepared,openObservationSession:observations.openObservationSession,nowMillis});
    const executor=createControlledDevelopMigrationExecutor({firestore,prepared,controlPlane:barrier.controlPlane,
      failurePersistence:barrier.failurePersistence,nowMillis});
    return {barrier,executor,async close(){try{await observations.close();}finally{iamBearer=null;}}};
  };
}
module.exports={composeDevelopWindowServices};
if(require.main===module){console.error("explicit_develop_services_required_no_cli");process.exitCode=1;}
