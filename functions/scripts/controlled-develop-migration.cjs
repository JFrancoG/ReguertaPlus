"use strict";

// Composition only: no Firebase export, client constructor, CLI or deployment.
// Even execution consumes an already-held barrier; it cannot open/close controls.
const assert = require("node:assert/strict");
const {createShiftPlanningDigest:digest} = require("../lib/shift-planning-digest.js");
const {createDevelopShiftMigrationEngine,PROJECT_ID:DEMO,HOST} = require("./develop-shift-migration-engine.cjs");
const {verifyClosedPolicy,KIND} = require("./develop-closed-migration-policy.cjs");
const PROJECT = "reguerta-9f27f";

function compose({firestore,prepared:original,controlPlane,failurePersistence,nowMillis}, projectId) {
  assert.equal(firestore.projectId,projectId); assert.equal(firestore.databaseId,"(default)");
  const prepared=structuredClone(original),{preparedDigest,...body}=prepared;
  assert.equal(prepared.projectId,projectId);assert.equal(prepared.environment,"develop");assert.equal(prepared.liveExecutable,false);
  assert.equal(prepared.scope,projectId===PROJECT?"controlled_develop_preparation":"loopback_emulator_only");
  assert.equal(digest(body),preparedDigest);assert.equal(prepared.policyDraft.document.kind,KIND);verifyClosedPolicy(prepared.policyDraft);
  for(const name of ["readBackClosed","readBackOwnerObservation","readBackAdministratorObservation"])assert.equal(typeof controlPlane[name],"function");
  for(const name of ["readExistingFailure","retainFailureAndReadBack"])assert.equal(typeof failurePersistence[name],"function");
  assert.equal(typeof nowMillis,"function");
  // Never pass a provider's potentially mutating closeAndCollect to either path.
  const heldReaders={closeAndCollect:scope=>controlPlane.readBackClosed(scope),
    readBackClosed:scope=>controlPlane.readBackClosed(scope),
    readBackOwnerObservation:scope=>controlPlane.readBackOwnerObservation(scope),
    readBackAdministratorObservation:scope=>controlPlane.readBackAdministratorObservation(scope)};
  const readOnlyFailures={readExistingFailure:input=>failurePersistence.readExistingFailure(input),
    retainFailureAndReadBack:async()=>{throw new Error("read_only_admission_does_not_persist_incidents");}};
  const dependencies={firestore,prepared,controlPlane:heldReaders,nowMillis,historicalRiskMode:true};
  const inspection=createDevelopShiftMigrationEngine({...dependencies,failurePersistence:readOnlyFailures});
  const execution=createDevelopShiftMigrationEngine({...dependencies,failurePersistence});
  const clock=()=>{const now=nowMillis();assert.ok(Number.isSafeInteger(now)&&now>=0);return now;};
  function requireScope(scope,direction) {
    assert.ok(["forward","inverse"].includes(direction));assert.equal(scope.environment,"develop");assert.equal(scope.schemaVersion,3);
    assert.equal(scope.transitionId,direction==="forward"?prepared.operationId:prepared.recoveryOperationId);
    assert.equal(scope.expectedWorkbookFileId,prepared.policyDraft.document.sync.partitions.delivery.workbookId);
    assert.equal(scope.expectedWorkbookRevision,prepared.policyDraft.document.sync.partitions.delivery.workbookRevision);
  }
  function report(direction,scope,source,startedAtMillis,blocker,finalManifest=null) {
    const value={schemaVersion:1,kind:"develop-migration-admission-inspection",projectId,environment:"develop",
      preparedDigest,direction,scopeDigest:scope===null?null:digest(scope),source,
      startedAtMillis,observedAtMillis:clock(),readOnly:true,canApply:false,canEnterMaintenance:false,
      checksPassed:blocker===null,blockers:blocker?[blocker]:[],finalManifest};
    return {...value,admissionDigest:digest(value)};
  }
  return {
    close:()=>firestore.terminate(),
    async inspectAdmission({direction="forward",scope=null,forwardReadBack=null}={}) {
      scope=structuredClone(scope);forwardReadBack=structuredClone(forwardReadBack);
      assert.ok(["forward","inverse"].includes(direction));const started=clock();
      if(scope!==null){try{requireScope(scope,direction);}catch{return report(direction,null,null,started,"invalid_scope");}}
      let source;
      try{source=await inspection.inspect({initial:direction==="forward"});}
      catch{return report(direction,scope,null,started,"source_not_verified");}
      if(scope===null)return report(direction,null,source,started,"window_scope_missing");
      if(direction==="inverse"&&!forwardReadBack)return report(direction,scope,source,started,"forward_receipt_missing");
      let held;
      try{held=await controlPlane.readBackClosed(scope);}catch{return report(direction,scope,source,started,"held_checkpoint_unavailable");}
      if(held===null||held===undefined)return report(direction,scope,source,started,"held_checkpoint_missing");
      try{
        const finalManifest=direction==="forward"?await inspection.forward({scope,materializeOnly:true}):
          await inspection.inverse({scope,forwardReadBack,materializeOnly:true});
        // A second independent source read brackets the barrier validation.
        const after=await inspection.inspect({initial:direction==="forward"});
        assert.equal(digest(after),digest(source));
        return report(direction,scope,source,started,null,finalManifest);
      }catch{return report(direction,scope,source,started,"admission_not_proven");}
    },
    async execute({scope,admission,forwardReadBack=null}) {
      scope=structuredClone(scope);admission=structuredClone(admission);forwardReadBack=structuredClone(forwardReadBack);
      const {admissionDigest,...value}=admission;assert.equal(admissionDigest,digest(value));
      assert.equal(value.kind,"develop-migration-admission-inspection");assert.equal(value.preparedDigest,preparedDigest);
      assert.equal(value.projectId,projectId);assert.equal(value.environment,"develop");assert.equal(value.readOnly,true);
      assert.equal(value.canApply,false);assert.equal(value.canEnterMaintenance,false);assert.equal(value.checksPassed,true);
      assert.deepEqual(value.blockers,[]);assert.ok(value.finalManifest);
      requireScope(scope,value.direction);assert.equal(value.scopeDigest,digest(scope));
      const now=clock();assert.ok(value.startedAtMillis<=value.observedAtMillis&&value.observedAtMillis<=now&&now-value.startedAtMillis<=60_000,"admission inspection expired");
      // No preflight result bypasses the engine's fresh barrier/source/CAS checks.
      return value.direction==="forward"?execution.forward({scope,finalManifest:value.finalManifest}):
        execution.inverse({scope,forwardReadBack,finalManifest:value.finalManifest});
    },
    async readRetained({scope,direction="forward",forwardReadBack=null}) {
      scope=structuredClone(scope);forwardReadBack=structuredClone(forwardReadBack);
      requireScope(scope,direction);
      // Closed mode cannot perform a first write without a final manifest.
      return direction==="forward"?execution.forward({scope}):execution.inverse({scope,forwardReadBack});
    },
  };
}
const createControlledDevelopMigrationExecutor=input=>compose(input,PROJECT);
const createControlledDevelopMigrationEmulator=input=>{
  assert.equal(process.env.GCLOUD_PROJECT,DEMO);assert.equal(process.env.FIRESTORE_EMULATOR_HOST,HOST);
  return compose(input,DEMO);
};
module.exports={createControlledDevelopMigrationExecutor,createControlledDevelopMigrationEmulator};
if(require.main===module){console.error("controlled_develop_composition_required_no_apply_cli");process.exitCode=1;}
