"use strict";

// Composition only: no Firebase export, client constructor, CLI or deployment.
// Even execution consumes an already-held barrier; it cannot open/close controls.
const assert = require("node:assert/strict");
const {createShiftPlanningDigest:digest} = require("../lib/shift-planning-digest.js");
const {createDevelopShiftMigrationEngine,PROJECT_ID:DEMO,HOST} = require("./develop-shift-migration-engine.cjs");
const {verifyClosedPolicy,KIND} = require("./develop-closed-migration-policy.cjs");
const {guardFirestore,executeJointStep}=require("./develop-joint-execution.cjs");
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
  const coherent=typeof controlPlane.readBackCooperativeObservation==="function";
  assert.equal(typeof controlPlane.readRetainedClosed==="function",coherent,"Coherent reads require explicit retained checkpoint access");
  const heldReaders={closeAndCollect:scope=>coherent?controlPlane.readRetainedClosed(scope):controlPlane.readBackClosed(scope),
    readBackClosed:scope=>controlPlane.readBackClosed(scope),
    readBackOwnerObservation:scope=>controlPlane.readBackOwnerObservation(scope),
    readBackAdministratorObservation:scope=>controlPlane.readBackAdministratorObservation(scope),
    ...(coherent?{readBackCooperativeObservation:(scope,context)=>controlPlane.readBackCooperativeObservation(scope,context)}:{})};
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
  function report(direction,scope,source,startedAtMillis,blocker,finalManifest=null,collectionStartedAtMillis=startedAtMillis) {
    const value={schemaVersion:1,kind:"develop-migration-admission-inspection",projectId,environment:"develop",
      preparedDigest,direction,scopeDigest:scope===null?null:digest(scope),source,
      collectionStartedAtMillis,startedAtMillis,observedAtMillis:clock(),readOnly:true,canApply:false,canEnterMaintenance:false,
      checksPassed:blocker===null,blockers:blocker?[blocker]:[],finalManifest};
    if (prepared.writerRehearsal) value.writerRehearsal = structuredClone(prepared.writerRehearsal);
    if (prepared.originalWriterCheck) value.originalWriterCheck = structuredClone(prepared.originalWriterCheck);
    if (prepared.helperCopyRecovery) value.helperCopyRecovery = structuredClone(prepared.helperCopyRecovery);
    if (prepared.helperCopyCycle) value.helperCopyCycle = structuredClone(prepared.helperCopyCycle);
    return {...value,admissionDigest:digest(value)};
  }
  function validateAdmission(scope,admission) {
    const {admissionDigest,...value}=admission;assert.equal(admissionDigest,digest(value));
    assert.equal(value.kind,"develop-migration-admission-inspection");assert.equal(value.preparedDigest,preparedDigest);
    assert.equal(value.projectId,projectId);assert.equal(value.environment,"develop");assert.equal(value.readOnly,true);
    assert.equal(value.canApply,false);assert.equal(value.canEnterMaintenance,false);assert.equal(value.checksPassed,true);
    assert.deepEqual(value.blockers,[]);assert.ok(value.finalManifest);
    requireScope(scope,value.direction);assert.equal(value.scopeDigest,digest(scope));
    const now=clock();assert.ok(Number.isSafeInteger(value.collectionStartedAtMillis)&&value.collectionStartedAtMillis>=0&&
      Number.isSafeInteger(value.startedAtMillis)&&Number.isSafeInteger(value.observedAtMillis)&&
      value.collectionStartedAtMillis<=value.startedAtMillis&&value.startedAtMillis<=value.observedAtMillis&&
      value.observedAtMillis<=now&&now-value.startedAtMillis<=60_000,"admission inspection expired");
    return value;
  }
  let jointActive=false;
  const jointConsumed=new Set();
  const executor = {
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
      let validationStarted=started;
      try{
        const finalManifest=direction==="forward"?await inspection.forward({scope,materializeOnly:true}):
          await inspection.inverse({scope,forwardReadBack,materializeOnly:true});
        // Human collection keeps its real start above. The technical lifetime
        // starts only before two new noninteractive source/CAS inspections; it
        // never refreshes the held evidence or the manifest's attempt timestamp.
        validationStarted=clock();
        const before=await inspection.inspect({initial:direction==="forward"});
        const after=await inspection.inspect({initial:direction==="forward"});
        assert.equal(digest(before),digest(source));assert.equal(digest(after),digest(source));
        assert.equal(source.sourceDigest,scope.expectedAuthoritativeDigest);
        assert.equal(finalManifest.preparedDigest,preparedDigest);assert.equal(finalManifest.direction,direction);assert.equal(finalManifest.scopeDigest,digest(scope));
        assert.ok(clock()-validationStarted<=60_000,"admission technical validation expired");
        return report(direction,scope,after,validationStarted,null,finalManifest,started);
      }catch{return report(direction,scope,source,validationStarted,"admission_not_proven",null,started);}
    },
    async execute({scope,admission,forwardReadBack=null,assertMutation=null}) {
      scope=structuredClone(scope);admission=structuredClone(admission);forwardReadBack=structuredClone(forwardReadBack);
      const value=validateAdmission(scope,admission);
      assert.ok(projectId!==PROJECT||assertMutation!==null,"shared execution requires joint deadline guard");
      if(assertMutation!==null)assert.equal(typeof assertMutation,"function");
      const target=assertMutation?createDevelopShiftMigrationEngine({...dependencies,
        firestore:guardFirestore(firestore,assertMutation),failurePersistence}):execution;
      assertMutation?.();
      // No preflight result bypasses the engine's fresh barrier/source/CAS checks.
      return value.direction==="forward"?target.forward({scope,finalManifest:value.finalManifest}):
        target.inverse({scope,forwardReadBack,finalManifest:value.finalManifest});
    },
    async inspectUncertain({scope,direction="forward",forwardReadBack=null}) {
      scope=structuredClone(scope);forwardReadBack=structuredClone(forwardReadBack);requireScope(scope,direction);
      return inspection.inspectRetained({scope,direction,forwardReadBack});
    },
    async executeJoint(input) {
      // Clone caller-owned data before the first suspension. Functions and the
      // budget/session owners stay within this explicit infrastructure boundary.
      const {observeSheets,sheetsAdapter,timeBudget,record,signal,...values}=input;
      const frozen=structuredClone(values);validateAdmission(frozen.scope,frozen.admission);
      timeBudget.assertStage();
      assert.ok(!jointActive&&!jointConsumed.has(frozen.admission.direction),"joint attempt consumed or active; inspect only");
      jointActive=true;jointConsumed.add(frozen.admission.direction);
      try {
        if(frozen.admission.direction==="inverse") {
          // Validate the supplied forward receipt/current source before restoring
          // Sheets, rather than discovering a bad inverse only after that write.
          const fresh=await executor.inspectAdmission({direction:"inverse",scope:frozen.scope,forwardReadBack:frozen.forwardReadBack});
          assert.equal(fresh.checksPassed,true,"inverse preflight not proven");
          assert.equal(digest(fresh.source),digest(frozen.admission.source),"inverse source changed");
          timeBudget.assertStage();
        }
        return await executeJointStep({...frozen,observeSheets,sheetsAdapter,timeBudget,record,signal,prepared,
          executeFirestore:args=>executor.execute(args),inspectFirestore:args=>executor.inspectUncertain(args)});
      } finally {jointActive=false;}
    },
    async readRetained({scope,direction="forward",forwardReadBack=null}) {
      scope=structuredClone(scope);forwardReadBack=structuredClone(forwardReadBack);
      requireScope(scope,direction);
      // Closed mode cannot perform a first write without a final manifest.
      return direction==="forward"?execution.forward({scope}):execution.inverse({scope,forwardReadBack});
    },
  };
  return executor;
}
const createControlledDevelopMigrationExecutor=input=>compose(input,PROJECT);
const createControlledDevelopMigrationEmulator=input=>{
  assert.equal(process.env.GCLOUD_PROJECT,DEMO);assert.equal(process.env.FIRESTORE_EMULATOR_HOST,HOST);
  return compose(input,DEMO);
};
module.exports={createControlledDevelopMigrationExecutor,createControlledDevelopMigrationEmulator};
if(require.main===module){console.error("controlled_develop_composition_required_no_apply_cli");process.exitCode=1;}
