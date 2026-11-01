"use strict";

// Refreshes a reviewed, operation-bound barrier from independent live reads.
// Initial closure/consent/quiet-horizon evidence is immutable. This adapter can
// renew readbacks, never manufacture that initial evidence or extend consent.
const assert=require("node:assert/strict");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {verifyShiftPlanningAdministratorAgreementIntakeBarrierEvidence:verify}=require("../lib/shift-planning-intake-barrier.js");
const {createDevelopCloudReader}=require("./develop-google-observations.cjs");
const {prepareDevelopContainedDeliveryEvidence:contained}=require("./observe-develop-capture-controls.cjs");
const {containedDeliveryCount:count}=require("../lib/shift-planning-contained-delivery.js");
const {FILE,metadataFingerprint}=require("./develop-original-writer-provider.cjs");
const clone=structuredClone;
const command=scope=>{const value={...scope};delete value.writerInventoryRevision;delete value.writerInventoryDigest;return value;};

function createBarrierObservationSessions({scope:input,review:original,reviewDigest,timeBudget,owner,iamBearer,
  assertWriterAuthority,getPermissionTransition,readCensus,readHumanReports,nowMillis=Date.now,record}) {
  const scope=clone(input),review=clone(original),scopeDigest=digest(scope);
  assert.equal(digest(review),reviewDigest,"Unreviewed observation binding");
  assert.equal(review.scopeDigest,scopeDigest);assert.equal(scope.expectedWorkbookFileId,FILE);
  assert.equal(typeof record,"function");assert.equal(typeof assertWriterAuthority,"function");
  const seed=verify(review.evidence,command(scope),review.evidence.payload.verifiedAtMillis).evidence;
  assert.equal(review.evidence.digest,digest(seed.payload));
  // The review links these exact raw observations to the complete barrier. Raw
  // digests and the barrier's domain digests deliberately stay distinct.
  assert.equal(review.owner.fileId,FILE);assert.equal(review.owner.snapshotDigest,digest(review.owner.snapshot));
  assert.equal(review.owner.metadataDigest,metadataFingerprint(review.owner.after));
  assert.ok(review.deliveries.every(d=>d.pendingCount===null&&d.inFlightCount===null),"Live adapter requires explicit unknown delivery counts");
  const baseline=contained({initial:review.census,final:review.census,classifiedCaptures:review.classifiedCaptures,
    initialDeliveries:review.deliveries,finalDeliveries:review.deliveries});
  assert.equal(baseline.acceptedSetDigest,seed.payload.causalDrain.acceptedSetDigest);
  assert.deepEqual(baseline.evidence.initial,seed.payload.causalDrain.containedDelivery.initial);
  const pendingHttp=new Set();
  const observedFetch=async(...args)=>{
    const pending=Promise.resolve().then(()=>timeBudget.fetch(...args));pendingHttp.add(pending);
    try{return await pending;}finally{pendingHttp.delete(pending);}
  };
  const cloud=createDevelopCloudReader({bearer:iamBearer,reviewed:review.cloud,fetchImpl:observedFetch,nowMillis});
  let closed=false,active=null;
  const current=()=>{assert.equal(closed,false,"Observation owner closed");timeBudget.assertStage();};
  async function collect() {
    current();const startedAtMillis=nowMillis();
    // Await every sibling, including failures, before releasing the lease or
    // changing cleanup phase. Never race a deadline against an abandoned read.
    const results=await Promise.allSettled([
      ()=>cloud.read(),()=>owner.capture(true),()=>readCensus({fetchImpl:observedFetch,nowMillis}),
      ()=>assertWriterAuthority(),()=>readHumanReports(clone(scope)),
    ].map(read=>Promise.resolve().then(read)));
    await Promise.allSettled([...pendingHttp]);
    current();if(results.some(r=>r.status==="rejected"))throw Error("barrier_observation_incomplete");
    const [controls,sheets,census,,reports]=results.map(r=>r.value);
    for(const value of [controls,sheets])assert.ok(value.startedAtMillis>=startedAtMillis&&value.observedAtMillis<=nowMillis());
    assert.equal(sheets.snapshotDigest,review.owner.snapshotDigest,"Workbook content drift");
    const transition=getPermissionTransition();assert.ok(transition,"Missing owned permission transition");
    assert.equal(transition.before.snapshotDigest,review.owner.snapshotDigest);
    assert.equal(transition.before.metadataDigest,review.owner.metadataDigest);
    assert.deepEqual(transition.before.snapshot,transition.after.snapshot);
    assert.equal(metadataFingerprint(transition.before.after,{omitWriter:true,omitVersion:true}),
      metadataFingerprint(transition.after.after,{omitWriter:true,omitVersion:true}));
    assert.equal(sheets.metadataDigest,transition.after.metadataDigest,"Workbook authority/version drift");
    const at=Date.parse(census.readTime);assert.ok(at>=startedAtMillis&&at<=nowMillis(),"Stale census read");
    // Queue metrics cannot prove causal zero. Keep the reviewed per-route unknown
    // counts and use the fresh complete census for append-only history checks.
    const causal=contained({initial:review.census,final:census,classifiedCaptures:review.classifiedCaptures,
      initialDeliveries:review.deliveries,finalDeliveries:review.deliveries});
    const payload=clone(seed.payload);
    payload.causalDrain.containedDelivery=causal.evidence;
    payload.causalDrain.finalQueueReadBackAtMillis=at;
    payload.causalDrain.finalPendingDeliveryCount=count(causal.evidence.final,"pendingCount");
    payload.causalDrain.finalInFlightDeliveryCount=count(causal.evidence.final,"inFlightCount");
    // Human reports must have been explicitly observed in this read interval.
    // Google ACL/IAM responses do not establish absence of human intervention.
    for(const field of ["ownerObservation","administratorObservation"]) {
      assert.ok(reports[field].observedAtMillis>=startedAtMillis&&reports[field].observedAtMillis<=nowMillis(),"Stale human report");
      payload[field]=clone(reports[field]);
    }
    payload.rules.finalReadBackAtMillis=controls.observedAtMillis;
    payload.workbook.readBackAtMillis=sheets.observedAtMillis;
    for(const control of payload.writerControls)control.finalReadBackAtMillis=Math.min(controls.observedAtMillis,sheets.observedAtMillis,at,
      reports.ownerObservation.observedAtMillis,reports.administratorObservation.observedAtMillis);
    payload.verifiedAtMillis=nowMillis();
    const evidence=verify({payload,digest:digest(payload)},command(scope),nowMillis()).evidence;
    await record({phase:"barrier-live-observation",scopeDigest,startedAtMillis,observedAtMillis:nowMillis(),evidence,
      cloudObservationDigest:controls.observationDigest,ownerObservationDigest:digest(sheets),censusDigest:digest(census),reviewDigest});
    current();verify(evidence,command(scope),nowMillis());return evidence;
  }
  return {
    async openObservationSession(requested) {
      current();assert.equal(digest(requested),scopeDigest);assert.equal(active,null,"Concurrent observation lease");
      const lease={closed:false,pending:null};active=lease;
      async function read(field) {
        current();assert.equal(lease.closed,false);assert.equal(lease.pending,null,"Concurrent lease read");
        lease.pending=collect();try{const result=await lease.pending;return clone(field?result.payload[field]:result);}
        finally{lease.pending=null;}
      }
      return {readEvidence:()=>read(null),readOwnerObservation:()=>read("ownerObservation"),
        readAdministratorObservation:()=>read("administratorObservation"),async close(){
          lease.closed=true;try{if(lease.pending)await lease.pending;}finally{if(active===lease)active=null;}
        }};
    },
    async close(){closed=true;try{if(active?.pending)await active.pending;}finally{cloud.close();readCensus.close?.();active=null;}}
  };
}
module.exports={createBarrierObservationSessions};
if(require.main===module){console.error("explicit_reviewed_barrier_observations_required_no_cli");process.exitCode=1;}
