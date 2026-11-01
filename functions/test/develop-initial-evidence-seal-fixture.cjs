"use strict";
const {historicalFixture}=require("./develop-historical-risk-fixture.cjs");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {createShiftPlanningControlManifestDigest:manifest}=require("../lib/shift-planning-intake-barrier.js");
const {plannedScope,plannedOwner,plannedAdmin,plannedRisk,observationInputs}=require("../scripts/develop-initial-evidence-seal.cjs");
const {fixture:censusFixture}=require("./develop-legacy-census-fixture.cjs");
const {inspectCensus}=require("../scripts/inspect-develop-legacy-census.cjs");
const {prepareDevelopContainedDeliveryEvidence:contained}=require("../scripts/observe-develop-capture-controls.cjs");
const {OWNER:OWNER_CONTROL,ADMIN}=require("./shift-planning-administrator-maintenance-fixture.cjs");
// Genuine barrier codec, synthetic human confirmations and provider observations.
function sealFixture({scopeOverrides={},before,window,nowMillis,advance,evidenceAge=600000}) {
  const f=historicalFixture(scopeOverrides);
  const scale=x=>Array.isArray(x)?x.map(scale):x&&typeof x==="object"?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,
    (k.endsWith("AtMillis")||k.endsWith("DeadlineMillis")||k.endsWith("AgeMillis")||k.endsWith("HorizonMillis"))&&typeof v==="number"?v*1000:scale(v)])):x;
  f.evidence.payload=scale(f.evidence.payload);f.scope.maximumEvidenceAgeMillis=evidenceAge;f.evidence.payload.policy.maximumEvidenceAgeMillis=evidenceAge;f.scope.minimumQuietHorizonMillis=30000;f.evidence.payload.policy.minimumQuietHorizonMillis=30000;
  const body=f.evidence.payload,owner=body.ownerAgreement.payload.intent,admin=body.administratorAgreement.payload.intent;
  for(const intent of [owner,admin])Object.assign(intent,{startsAtMillis:window.startsAtMillis,endsAtMillis:window.endsAtMillis,recoveryDeadlineMillis:window.endsAtMillis});
  body.causalDrain.historicalRisk.expiresAtMillis=window.endsAtMillis;
  f.scope.expectedHistoricalRiskDigest=digest(body.causalDrain.historicalRisk);
  owner.participants.push({principalId:owner.ownerPrincipalId,role:"permission-controller"});
  owner.permissionControl={principalId:owner.ownerPrincipalId,actionId:"owned-native-grant",actionKind:"acl-protection-only",
    sealedActionDigest:null,postAuthorityDigest:owner.effectiveAuthorityDigest,credentialClosureDigest:null};
  const census=censusFixture(),classifiedCaptures=inspectCensus(census).captures.map(({eventKey,coreDigest})=>({eventKey,coreDigest}));
  const deliveries=body.causalDrain.containedDelivery.initial.deliveries.map(d=>({...d,pendingCount:null,inFlightCount:null}));
  const causal=contained({initial:census,final:census,classifiedCaptures,initialDeliveries:deliveries,finalDeliveries:deliveries});
  body.causalDrain.acceptedSetDigest=causal.acceptedSetDigest;body.causalDrain.historicalRisk.causalSetDigest=causal.acceptedSetDigest;f.scope.expectedCausalSetDigest=causal.acceptedSetDigest;
  body.causalDrain.containedDelivery=causal.evidence;
  for(const k of ["initialPendingDeliveryCount","initialInFlightDeliveryCount","finalPendingDeliveryCount","finalInFlightDeliveryCount"])body.causalDrain[k]=null;
  const prefix="projects/reguerta-9f27f/locations/europe-west1";
  const cloud={projectId:"reguerta-9f27f",readOnly:true,functions:Array.from({length:24},(_,i)=>({data:{name:`${prefix}/functions/fn${i}`}})),
    jobs:Array.from({length:3},(_,i)=>({data:{name:`${prefix}/jobs/job${i}`,state:"PAUSED"}})),rulesRelease:{data:{rulesetName:"projects/reguerta-9f27f/rulesets/test-rules"}},
    ruleset:{data:{name:"rules"}},projectIam:{data:{bindings:[]}},invokerPolicy:{data:{bindings:[]}}};
  const review={scopeDigest:null,evidence:f.evidence,cloud,owner:before,census,classifiedCaptures,deliveries};
  const initialEvidencePlan={kind:"develop-post-permission-initial-evidence",scope:plannedScope(f.scope),ownerIntent:plannedOwner(owner),
    administratorIntent:plannedAdmin(admin),historicalRisk:plannedRisk(body.causalDrain.historicalRisk),observationInputsDigest:digest(observationInputs(review))};
  function collect(permissionReceipt) {
    const copy=structuredClone(review),payload=copy.evidence.payload,oi=payload.ownerAgreement.payload.intent,ai=payload.administratorAgreement.payload.intent;
    oi.permissionControl.sealedActionDigest=digest(permissionReceipt);oi.permissionControl.credentialClosureDigest=digest(permissionReceipt.native.closure);
    payload.ownerAgreement.payload.confirmations=oi.participants.map(participant=>({...participant,intentDigest:digest(oi),confirmationId:`final-${participant.role}`,
      confirmedAtMillis:nowMillis(),onlineClosedNoOfflineEdits:true,noManualOrAutomationWrites:true}));
    payload.ownerAgreement.digest=digest(payload.ownerAgreement.payload);ai.ownerAgreementDigest=payload.ownerAgreement.digest;
    payload.administratorAgreement.payload.confirmations=ai.administratorPrincipalIds.map((principalId,i)=>({principalId,intentDigest:digest(ai),confirmationId:`admin-final-${i}`,
      confirmedAtMillis:nowMillis(),noUnreviewedDataRulesDeployIamOrScriptWrites:true,noAutomationViaHumanCredentials:true}));
    payload.administratorAgreement.digest=digest(payload.administratorAgreement.payload);
    Object.assign(payload.ownerObservation,{participantsDigest:digest({revision:oi.participantsRevision,participants:oi.participants}),
      permissionControlEvidenceDigest:digest(oi.permissionControl),observedAtMillis:nowMillis()});
    Object.assign(payload.administratorObservation,{agreementDigest:payload.administratorAgreement.digest,observedAtMillis:nowMillis()});
    for(const control of payload.writerControls)if([OWNER_CONTROL,ADMIN].includes(control.writerId)) {
      const d=control.writerId===OWNER_CONTROL?payload.ownerAgreement.digest:payload.administratorAgreement.digest;
      for(const key of ["controlDigest","initialReadBackDigest","finalReadBackDigest"])control[key]=d;
    }
    const confirmed=nowMillis();
    // Synthetic provider clock: fresh initial capture follows confirmation and
    // the complete quiet horizon elapses before the final observation.
    payload.causalDrain.capturedAtMillis=confirmed+1;payload.causalDrain.historicalRisk.assessedAtMillis=confirmed+2;
    payload.causalDrain.initialQueueReadBackAtMillis=confirmed+2;
    payload.causalDrain.containedDelivery.initial.observedAtMillis=confirmed+2;copy.census.readTime=new Date(confirmed+2).toISOString();
    payload.workbook.capturedAtMillis=confirmed+3;
    payload.quietHorizon.startedAtMillis=confirmed+4;payload.quietHorizon.endedAtMillis=confirmed+30004;
    for(const control of payload.writerControls)if([OWNER_CONTROL,ADMIN].includes(control.writerId)) {
      control.closedAtMillis=confirmed;control.initialReadBackAtMillis=confirmed;
    }
    advance(30005);
    payload.rules.finalReadBackAtMillis=nowMillis();payload.workbook.readBackAtMillis=nowMillis();
    payload.causalDrain.finalQueueReadBackAtMillis=nowMillis();payload.causalDrain.containedDelivery.final.observedAtMillis=nowMillis();
    for(const control of payload.writerControls)control.finalReadBackAtMillis=nowMillis();
    payload.ownerObservation.observedAtMillis=nowMillis();payload.administratorObservation.observedAtMillis=nowMillis();
    payload.verifiedAtMillis=nowMillis();copy.evidence.digest=digest(payload);
    const scope={...initialEvidencePlan.scope,expectedOwnerAgreementDigest:payload.ownerAgreement.digest,expectedAdministratorAgreementDigest:payload.administratorAgreement.digest,
      expectedHistoricalRiskDigest:digest(payload.causalDrain.historicalRisk),expectedControlManifestDigest:manifest(payload.writerControls,payload.maintenanceMode)};
    copy.scopeDigest=digest(scope);return {scope,review:copy};
  }
  return {initialEvidencePlan,collect};
}
module.exports={sealFixture};
