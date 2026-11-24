"use strict";

// Explicit acquisition of already-closed develop controls. No provider mutation,
// client constructor, CLI, deployment, maintenance-state write or reopen operation.
const assert = require("node:assert/strict");
const {Timestamp} = require("firebase-admin/firestore");
const {createShiftPlanningDigest:digest} = require("../lib/shift-planning-digest.js");
const {verifyShiftPlanningAdministratorAgreementIntakeBarrierEvidence:verify} = require("../lib/shift-planning-intake-barrier.js");
const {createShiftPlanningAdministratorBarrierCheckpoint:checkpoint,
  createTrustedShiftPlanningAdministratorBarrierAdapter:adapter} = require("../lib/shift-planning-trusted-intake-barrier-adapter.js");
const {createFirestoreShiftPlanningIntakeBarrierRepository:repository} = require("../lib/shift-planning-firestore-intake-barrier-repository.js");
const {createDevelopShiftMigrationEngine,historicalMigrationPlanBindings,PROJECT_ID:DEMO,HOST} = require("./develop-shift-migration-engine.cjs");
const {verifyClosedPolicy,KIND} = require("./develop-closed-migration-policy.cjs");
const {assertDevelopOwnedTransitionObservation,isOwnedTransitionReceipt}=require("./develop-owned-transition-observation.cjs");
const PROJECT = "reguerta-9f27f";

function compose({firestore,prepared:original,openObservationSession,nowMillis,coherentObservations=false}, projectId) {
  assert.equal(firestore.projectId,projectId);assert.equal(firestore.databaseId,"(default)");
  const prepared=structuredClone(original),{preparedDigest,...body}=prepared;
  assert.equal(digest(body),preparedDigest);assert.equal(prepared.projectId,projectId);
  assert.equal(prepared.environment,"develop");assert.equal(prepared.liveExecutable,false);
  assert.equal(prepared.scope,projectId===PROJECT?"controlled_develop_preparation":"loopback_emulator_only");
  assert.equal(prepared.policyDraft.document.kind,KIND);verifyClosedPolicy(prepared.policyDraft);
  assert.equal(typeof openObservationSession,"function");assert.equal(typeof nowMillis,"function");
  assert.equal(typeof coherentObservations,"boolean");
  const clock=()=>{const n=nowMillis();assert.ok(Number.isSafeInteger(n)&&n>=0);return n;};
  const journal=repository(firestore,()=>Timestamp.fromMillis(clock()));
  const key=scope=>({environment:"develop",transitionId:scope.transitionId});
  const stopped=signal=>{if(signal?.aborted)throw new Error("develop_barrier_acquisition_interrupted");};
  function direction(scope) {
    assert.equal(scope.environment,"develop");assert.equal(scope.schemaVersion,3);
    assert.equal(scope.maintenanceMode,"develop-administrator-agreement");
    assert.equal(scope.expectedWorkbookFileId,prepared.policyDraft.document.sync.partitions.delivery.workbookId);
    assert.equal(scope.expectedWorkbookRevision,prepared.policyDraft.document.sync.partitions.delivery.workbookRevision);
    if(scope.transitionId===prepared.operationId)return "forward";
    assert.equal(scope.transitionId,prepared.recoveryOperationId);return "inverse";
  }
  function validated(evidence,scope,at=clock()) {
    const d=direction(scope),command={...scope};
    delete command.writerInventoryRevision;delete command.writerInventoryDigest;
    const result=verify(evidence,command,at).evidence;
    const risk=result.payload.causalDrain.historicalRisk,plans=historicalMigrationPlanBindings(prepared);
    assert.ok(risk);assert.equal(risk.direction,d);
    assert.equal(risk.migrationOperationId,prepared.operationId);assert.equal(risk.recoveryOperationId,prepared.recoveryOperationId);
    assert.equal(risk.migrationPlanDigest,plans.migrationPlanDigest);assert.equal(risk.inversePlanDigest,plans.inversePlanDigest);
    return result;
  }
  const held=(scope,evidence)=>checkpoint({scope,evidence,
    holdRevision:`develop-held-${digest({preparedDigest,scope}).slice(-40)}`});

  // A session owns only its read credentials/resources. Its opener must clean a
  // partial open on rejection. close must verify credential cleanup or reject.
  // A static retained packet is not an implementation of this trusted live port.
  async function observe(scope,method,signal,context) {
    stopped(signal);direction(scope);
    const session=await openObservationSession(structuredClone(scope));
    assert.equal(typeof session?.close,"function","observation session must own cleanup");
    try {
      assert.equal(typeof session[method],"function");stopped(signal);
      return structuredClone(await session[method](context));
    } finally {await session.close();}
  }
  async function retained(scope) {
    direction(scope);const evidence=await journal.readExisting(key(scope));
    if(evidence===null)return null;
    // Historical parsing at its recorded verification time is not fresh authority.
    validated(evidence,scope,evidence.payload.verifiedAtMillis);
    return held(scope,evidence);
  }
  async function readBackClosed(originalScope) {
    const scope=structuredClone(originalScope),saved=await retained(scope);
    assert.ok(saved,"develop_barrier_not_acquired");
    validated(saved.evidence,scope);
    // Verify a new complete technical/owner/admin observation against the same
    // scope. Keep the original immutable evidence and checkpoint identity.
    validated(await observe(scope,"readEvidence"),scope);
    validated(saved.evidence,scope);
    return saved;
  }
  async function readRetainedClosed(originalScope) {
    const scope=structuredClone(originalScope),saved=await retained(scope);
    assert.ok(saved,"develop_barrier_not_acquired");validated(saved.evidence,scope);return saved;
  }
  async function readBackCooperativeObservation(originalScope,context) {
    const scope=structuredClone(originalScope),saved=await readRetainedClosed(scope);
    assert.ok(context&&["initial","final"].includes(context.phase),"A cooperative phase is required");
    const startedAt=clock(),observation=await observe(scope,"readCooperativeObservation",undefined,context);
    let facts;
    if(observation.kind==="owned-develop-transition-observation") {
      assert.equal(context.phase,"final");assert.equal(isOwnedTransitionReceipt(context.operationResult),true);
      assert.deepEqual(Object.keys(observation).sort(),["kind","proof","ownerObservation","administratorObservation"].sort());
      assertDevelopOwnedTransitionObservation(observation.proof,{prepared,scope,callbackReceipt:context.operationResult});
      assert.ok(observation.proof.observedAtMillis>=startedAt&&observation.proof.observedAtMillis<=clock(),"Owned source observation is stale or future");
      facts=observation;
    }else {
      assert.equal(observation.kind,"complete-develop-barrier-observation");
      assert.deepEqual(Object.keys(observation).sort(),["kind","evidence"].sort());
      assert.equal(context.phase==="final"&&isOwnedTransitionReceipt(context.operationResult),false,"Owned receipt requires its verified postimage proof");
      const fresh=validated(observation.evidence,scope);facts=fresh.payload;
    }
    validated(saved.evidence,scope);
    return {checkpoint:saved,ownerObservation:structuredClone(facts.ownerObservation),
      administratorObservation:structuredClone(facts.administratorObservation)};
  }
  const controlPlane={readBackClosed,
    readBackOwnerObservation:scope=>observe(structuredClone(scope),"readOwnerObservation"),
    readBackAdministratorObservation:scope=>observe(structuredClone(scope),"readAdministratorObservation"),
    ...(coherentObservations?{readRetainedClosed,readBackCooperativeObservation}:{})};
  const inspection=createDevelopShiftMigrationEngine({firestore,prepared,
    controlPlane:{...controlPlane,closeAndCollect:async()=>{throw new Error("explicit_acquisition_required");}},
    failurePersistence:journal,nowMillis:clock,historicalRiskMode:true});
  async function assertSource(scope) {
    const source=await inspection.inspect({initial:direction(scope)==="forward"});
    assert.equal(source.sourceDigest,scope.expectedAuthoritativeDigest);
    for(const [field,expected]of [["stateRevision","expectedStateRevision"],["writeEpoch","expectedWriteEpoch"],
      ["activeRevision","expectedActiveRevision"],["activeDigest","expectedActiveDigest"]]) {
      assert.equal(source.maintenance[field],scope[expected]);
    }
  }
  return {
    controlPlane,failurePersistence:journal,
    // Read-only inspection never opens a session, creates evidence, renews a
    // commitment, or treats an interrupted acquisition as current admission.
    async inspectRetained({scope:input}) {
      const scope=structuredClone(input),saved=await retained(scope),failure=await journal.readExistingFailure(key(scope));
      return {preparedDigest,scopeDigest:digest(scope),checkpoint:saved,failure,
        historical:true,canApply:false,canEnterMaintenance:false};
    },
    async acquire({scope:input,signal}) {
      const scope=structuredClone(input);direction(scope);stopped(signal);
      // A consumed key is inspect-only, including lost commit acknowledgements.
      // There is no automatic second attempt or update of the original evidence.
      assert.equal(await journal.readExisting(key(scope)),null,"develop_barrier_already_retained_inspect_only");
      const acquisitionObservation=method=>async (currentScope,context)=>{
        stopped(signal);const value=await controlPlane[method](currentScope,context);stopped(signal);return value;
      };
      const acquiring={...controlPlane,
        readBackOwnerObservation:acquisitionObservation("readBackOwnerObservation"),
        readBackAdministratorObservation:acquisitionObservation("readBackAdministratorObservation"),
        ...(coherentObservations?{readBackCooperativeObservation:acquisitionObservation("readBackCooperativeObservation")}:{ }),
        async closeAndCollect() {
        await assertSource(scope);stopped(signal);
        const evidence=validated(await observe(scope,"readEvidence",signal),scope);
        stopped(signal);await assertSource(scope);validated(evidence,scope);stopped(signal);
        await journal.retainAndReadBack({...key(scope),evidence});
        stopped(signal);return held(scope,evidence);
      }};
      const barrier=adapter({controlPlane:acquiring,failurePersistence:journal,readClockMillis:clock});
      const saved=await barrier.withClosedIntakeBarrier(scope,async()=>{
        stopped(signal);await assertSource(scope);
        const value=await retained(scope);assert.ok(value);stopped(signal);return value;
      });
      // The final administrator read is the cancellation boundary. No further
      // asynchronous work follows: later cancellation cannot undo acquisition.
      // Failure recovery uses the uncancelled technical read to retain an incident.
      return {preparedDigest,scopeDigest:saved.scopeDigest,checkpoint:saved,
        acquired:true,maintenanceStateChanged:false,canApply:false,canEnterMaintenance:false};
    },
  };
}
const createControlledDevelopBarrier=input=>compose(input,PROJECT);
const createControlledDevelopBarrierEmulator=input=>{
  assert.equal(process.env.GCLOUD_PROJECT,DEMO);assert.equal(process.env.FIRESTORE_EMULATOR_HOST,HOST);
  return compose(input,DEMO);
};
module.exports={createControlledDevelopBarrier,createControlledDevelopBarrierEmulator};
if(require.main===module){console.error("explicit_develop_barrier_composition_required_no_live_cli");process.exitCode=1;}
