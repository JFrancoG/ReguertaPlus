"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {Timestamp}=require("@google-cloud/firestore");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {encodeShiftPlanningFirestoreValue:encode,createShiftPlanningActivationOperationTerminal:createOperation,
  createShiftPlanningPublicShiftMaterialization:publicMaterialization,attachShiftPlanningBackendMutationMarker:mark}=require("../lib/shift-planning-publication-contract.js");
const {shiftPlanningPublicEventOperationRetentionPath:retentionPath}=require("../lib/shift-planning-public-event-retention.js");
const {containedDeliveryBusinessDigest}=require("../lib/shift-planning-contained-delivery.js");
const {inspectCensus}=require("../scripts/inspect-develop-legacy-census.cjs");
const {FILE}=require("../scripts/develop-original-writer-provider.cjs");
const {decodeRESTValue}=require("../scripts/develop-shift-migration-engine.cjs");
const {isOwnedTransitionReceipt,verifyDevelopOwnedTransitionObservation:verify,assertDevelopOwnedTransitionObservation:parse}=require("../scripts/develop-owned-transition-observation.cjs");
const wire=require("./develop-legacy-census-fixture.cjs");
const {contentProposal,restDocument}=require("./develop-shift-migration-fixture.cjs");
const ROOT="develop/plus-collections",COMMIT="2026-10-28T10:03:00.123456789Z",READ="2026-10-28T10:06:00.123456789Z";
const encoded=value=>encode(value,"owned observation test",new Set());
const timestamp=value=>new Timestamp(...wire.at(value));
function receipt(body){return {...body,receiptDigest:digest(body)};}
function makeFixture(){
  const initial=wire.fixture();initial.events=[];initial.deliveries=[];initial.chunks={};
  for(const control of [initial.intakeBefore,initial.intakeAfter])for(const key of ["captureRevision","eventCount","deliveryCount"])control.fields[key]=wire.raw(0);
  initial.collections.shifts=Array.from({length:62},(_,i)=>wire.doc(`${ROOT}/shifts/legacy-${i}`,{legacy:i,status:"planned"}));
  initial.collections.deliveryCalendar=[wire.doc(`${ROOT}/deliveryCalendar/retained`,{unchanged:"calendar"})];
  initial.collections.notificationEvents=[wire.doc(`${ROOT}/notificationEvents/retained`,{unchanged:"notice"})];
  const raw={projectId:"reguerta-9f27f",environment:"develop",scope:"controlled_develop_preparation",operationId:"request-owned-forward",requestId:"request-owned",baselineRevision:"owned-baseline",
    contentDigest:digest("owned content"),sourceDigest:digest("owned source"),content:contentProposal().content,
    legacy:initial.collections.shifts.map((d,i)=>({path:d.name.slice(wire.BASE.length),payload:encoded({legacy:i,status:"planned"}),
      createTime:encoded(timestamp(d.createTime)),updateTime:encoded(timestamp(d.updateTime))}))};
  const prepared={...raw,preparedDigest:digest(raw)},operationPath=`${ROOT}/shiftPlanningOperations/${prepared.operationId}`;
  const sourceDigest=digest(Object.values(initial.collections).flat().sort((a,b)=>a.name<b.name?-1:1));
  const scope={environment:"develop",transitionId:prepared.operationId,expectedWorkbookFileId:FILE,expectedAuthoritativeDigest:digest("original authoritative state"),
    expectedCausalSetDigest:containedDeliveryBusinessDigest({sourceSetDigest:sourceDigest,classifiedEventSetDigest:digest([])})};
  const canonical=prepared.content.shifts.map(s=>{
    const delivery=s.type==="delivery",first=s.positions[0],date=Timestamp.fromDate(new Date(`${s.date}T00:00:00Z`));
    const payload={planningSchemaVersion:1,type:s.type,date,assignedUserIds:s.assignedUserIds,helperUserId:s.helperUserId,status:s.status,
      source:"app",origin:"planner",planningRequestId:prepared.requestId,bundleRevision:prepared.baselineRevision,bundleDigest:prepared.contentDigest,writeEpoch:1,
      projectionSeasonStartYear:Number(s.date.slice(0,4))-Number(Number(s.date.slice(5,7))<9),rotationOwnerUserId:delivery?s.rotationOwnerUserIds[0]:null,
      rotationOwnerUserIds:delivery?null:s.rotationOwnerUserIds,roundNumber:delivery?first.roundNumber:null,positionInRound:delivery?first.positionInRound:null,
      planningReason:delivery?"target":null,rotationPositions:delivery?null:s.positions.map((p,i)=>({...p,effectiveAssigneeUserId:s.assignedUserIds[i],planningReason:"target"})),
      assignmentRevision:1,documentRevision:1,completion:{state:"uncompleted",revision:0,actualHelperUserId:null,helperSourceAssignmentRevision:null,completedAt:null},
      createdAt:timestamp(COMMIT),updatedAt:timestamp(COMMIT)};
    const path=`${ROOT}/shifts/${s.id}`,materialization=publicMaterialization({targetPath:path,payload});
    return {path,materialization};
  });
  const operation=createOperation({operationId:prepared.operationId,environment:"develop",requestId:prepared.requestId,candidateId:prepared.baselineRevision,
    bundleRevision:prepared.baselineRevision,bundleDigest:prepared.contentDigest,forwardManifestDigest:prepared.preparedDigest,expectedStateDigest:scope.expectedAuthoritativeDigest,
    writeEpoch:1,attemptedAt:timestamp(COMMIT),publicMutations:canonical.map(d=>({mutationKind:"create",targetPath:d.path,documentRevision:1,payloadDigest:d.materialization.payloadDigest})),
    beforeImages:prepared.legacy.map((d,i)=>({ordinal:i+1,targetPath:d.path,envelopePath:`${operationPath}/beforeImages/${i+1}`,envelopeDigest:digest({before:i})}))});
  for(const row of canonical){
    row.data=mark({materialization:row.materialization,operation});
  }
  const sourceRows=canonical.map(d=>({...restDocument(d.path,d.data,timestamp(COMMIT),timestamp(COMMIT)),name:wire.BASE+d.path}));
  const others=[...prepared.legacy.map((d,i)=>`${operationPath}/beforeImages/${i+1}`),`${ROOT}/shiftPlanningState/current`,`${ROOT}/shiftPlanningState/sourcePolicy`,
    `${ROOT}/shiftRotations/delivery`,`${ROOT}/shiftRotations/market`,retentionPath({environment:"develop",operationId:prepared.operationId}),`${ROOT}/shiftPlanningMigrationBaselines/${prepared.baselineRevision}`];
  const documents=[...prepared.legacy.map(d=>({path:d.path,exists:false,payload:null,updateTime:null})),
    ...canonical.map(d=>({path:d.path,exists:true,payload:encoded(d.data),updateTime:encoded(timestamp(COMMIT))})),
    ...others.map(path=>({path,exists:true,payload:encoded({retained:path}),updateTime:encoded(timestamp(COMMIT))})),
    {path:operationPath,exists:true,payload:encoded(operation),updateTime:encoded(timestamp(COMMIT))}].sort((a,b)=>a.path<b.path?-1:1);
  const body={schemaVersion:1,scope:prepared.scope,projectId:prepared.projectId,preparedDigest:prepared.preparedDigest,direction:"forward",replayed:false,
    documents,measurement:{documentWriteCount:203},operation:encoded(operation)};
  const callbackReceipt=receipt(body),retainedInspection={kind:"committed-and-readback-verified",canRetry:false,receipt:receipt({...body,replayed:true,measurement:null})};
  const current=structuredClone(initial);current.collections.shifts=sourceRows;current.readTime=READ;
  return {prepared,scope,baselineCensus:initial,currentCensus:current,callbackReceipt,retainedInspection,classifiedCaptures:[]};
}
function addCapture(census,{path,before,after,id}){
  const core={schemaVersion:1,entryPoint:"onShiftWritten",source:wire.SOURCE,type:"google.cloud.firestore.document.v1.written",path,before,after};
  const metadata=wire.tagged({id,params:{env:"develop",shiftId:path.split("/").at(-1)},source:wire.SOURCE,specversion:"1.0",subject:`documents/${path}`,time:COMMIT,type:core.type});
  const envelope=JSON.stringify({core,metadata,before,after}),coreDigest=wire.hash(JSON.stringify(core));
  const eventKey=wire.hash(JSON.stringify({entryPoint:core.entryPoint,source:core.source,type:core.type,path,before:[before.exists,before.updateTime],after:[after.exists,after.updateTime]}));
  const eventName=`${wire.ROOT}/events/${eventKey}`,deliveryKey=wire.hash(JSON.stringify({entryPoint:core.entryPoint,source:core.source,id}));
  census.events.push(wire.doc(`shiftPlanningDevelopIntake/current/events/${eventKey}`,{schemaVersion:1,coreDigest,path,entryPoint:core.entryPoint,state:"retained",envelopeDigest:wire.hash(envelope),chunkCount:1,replayable:false}));
  census.deliveries.push(wire.doc(`shiftPlanningDevelopIntake/current/deliveries/${deliveryKey}`,{schemaVersion:1,eventKey,digest:wire.hash(JSON.stringify({coreDigest,metadataWire:metadata})),
    metadata:JSON.stringify(metadata),beforeReadTime:null,afterReadTime:null}));
  census.chunks[eventName]=[wire.doc(`shiftPlanningDevelopIntake/current/events/${eventKey}/chunks/0`,{bytes:Buffer.from(envelope)})];
  for(const control of [census.intakeBefore,census.intakeAfter]){
    control.fields.captureRevision=wire.raw(Number(control.fields.captureRevision.integerValue)+1);
    control.fields.deliveryCount=wire.raw(census.deliveries.length);control.fields.eventCount=wire.raw(census.events.length);
  }
}
const absent=path=>({path,exists:false,createTime:null,updateTime:null,readTime:null,fields:null});
function snapshotFields(value){
  if(value instanceof Timestamp)return ["timestamp",[value.seconds,value.nanoseconds]];
  if(Array.isArray(value))return ["array",value.map(snapshotFields)];
  if(value&&typeof value==="object")return ["map",Object.keys(value).sort().map(k=>[k,snapshotFields(value[k])])];
  return wire.tagged(value);
}
const present=(path,data,created,updated)=>({path,exists:true,createTime:wire.at(created),updateTime:wire.at(updated),readTime:null,fields:snapshotFields(data)});
function addOwned(f){
  const created=`${ROOT}/shifts/${f.prepared.content.shifts[0].id}`,deleted=`${ROOT}/shifts/legacy-0`;
  const raw=f.currentCensus.collections.shifts.find(v=>v.name===wire.BASE+created);
  const data=Object.fromEntries(Object.entries(raw.fields).map(([k,v])=>[k,decodeRESTValue(v)]));
  addCapture(f.currentCensus,{path:created,before:absent(created),after:present(created,data,COMMIT,COMMIT),id:"owned-create"});
  addCapture(f.currentCensus,{path:deleted,before:present(deleted,{legacy:0,status:"planned"},wire.CREATED,wire.UPDATED),after:absent(deleted),id:"owned-delete"});
}
test("exact committed afterimages retain actual current source identity and unknown delivery completeness",()=>{
  const f=makeFixture(),before=structuredClone(f),proof=verify(f);
  assert.equal(proof.kind,"develop-owned-forward-transition-observation");assert.notEqual(proof.currentSourceSetDigest,proof.baselineSourceSetDigest);
  assert.equal(proof.baselineCausalSetDigest,f.scope.expectedCausalSetDigest);assert.equal(proof.ownedObservedCaptureCount,0);
  assert.equal(proof.pendingDeliveryCount,null);assert.equal(proof.inFlightDeliveryCount,null);assert.equal(proof.canClaimClosure,false);
  assert.deepEqual(parse(proof,f),proof);assert.deepEqual(f,before);assert.equal(isOwnedTransitionReceipt(f.callbackReceipt),true);assert.equal(isOwnedTransitionReceipt({direction:"forward"}),false);
});
test("a subset of exact own create/delete cores and metadata retries is accepted without inventing remaining delivery counts",()=>{
  const f=makeFixture();addOwned(f);wire.addMetadataObservation(f.currentCensus);
  const proof=verify(f);assert.equal(proof.ownedObservedCaptureCount,2);assert.equal(proof.currentCaptureRevision,3);
  assert.equal(proof.deliveryCompleteness,"not-claimed");assert.deepEqual(parse(proof,f),proof);
});
for(const [name,change]of Object.entries({
  "missing independently current proof":f=>{f.retainedInspection.kind="committed-terminal-only";},
  "replayed callback":f=>{const {receiptDigest,...body}=f.callbackReceipt;void receiptDigest;f.callbackReceipt=receipt({...body,replayed:true});},
  "wrong measurement":f=>{const {receiptDigest,...body}=f.callbackReceipt;void receiptDigest;f.callbackReceipt=receipt({...body,measurement:{documentWriteCount:202}});},
  "missing own image":f=>{const {receiptDigest,...body}=f.callbackReceipt;void receiptDigest;body.documents.pop();f.callbackReceipt=receipt(body);},
  "different independent image":f=>{const {receiptDigest,...body}=structuredClone(f.retainedInspection.receipt);void receiptDigest;body.documents[0].payload=encoded({changed:true});f.retainedInspection.receipt=receipt(body);},
  "changed canonical payload":f=>{f.currentCensus.collections.shifts[0].fields.status=wire.raw("changed");},
  "canonical ABA version":f=>{f.currentCensus.collections.shifts[0].updateTime="2026-10-28T10:04:00.123456789Z";},
  "extra source":f=>{f.currentCensus.collections.shifts.push(wire.doc(`${ROOT}/shifts/extra`,{extra:true}));},
  "missing canonical source":f=>{f.currentCensus.collections.shifts.pop();},
  "unrelated notification mutation":f=>{f.currentCensus.collections.notificationEvents[0].fields.unchanged=wire.raw("edited");},
  "unreviewed classification":f=>{f.classifiedCaptures=[{eventKey:"a".repeat(64),coreDigest:"b".repeat(64)}];},
  "stale census":f=>{f.currentCensus.readTime="2026-10-28T10:02:00.123456789Z";},
  "inverse callback":f=>{const {receiptDigest,...body}=f.callbackReceipt;void receiptDigest;f.callbackReceipt=receipt({...body,direction:"inverse"});},
}))test(`owned proof rejects ${name}`,()=>{const f=makeFixture();change(f);assert.throws(()=>verify(f));});
test("an unrelated captured deletion remains rejected even when its live source is absent",()=>{
  const f=makeFixture(),path=`${ROOT}/shifts/unreviewed`;
  addCapture(f.currentCensus,{path,before:present(path,{outside:true},wire.CREATED,wire.UPDATED),after:absent(path),id:"unplanned-delete"});
  assert.doesNotThrow(()=>inspectCensus(f.currentCensus));assert.throws(()=>verify(f),/not an owned transition/);
});
test("previous captured history cannot disappear after the owned transition",()=>{
  const f=makeFixture(),path=`${ROOT}/shifts/legacy-0`;
  addCapture(f.baselineCensus,{path,before:absent(path),after:present(path,{legacy:0,status:"planned"},wire.CREATED,wire.UPDATED),id:"prior-create"});
  f.classifiedCaptures=inspectCensus(f.baselineCensus).captures.map(({eventKey,coreDigest})=>({eventKey,coreDigest}));
  f.scope.expectedCausalSetDigest=containedDeliveryBusinessDigest({sourceSetDigest:digest(Object.values(f.baselineCensus.collections).flat().sort((a,b)=>a.name<b.name?-1:1)),classifiedEventSetDigest:digest(f.classifiedCaptures)});
  assert.throws(()=>verify(f),/capture history changed/);
});
test("reviewed historical cores remain immutable alongside the distinct owned core set",()=>{
  const f=makeFixture(),path=`${ROOT}/shifts/legacy-0`;
  addCapture(f.baselineCensus,{path,before:absent(path),after:present(path,{legacy:0,status:"planned"},wire.CREATED,wire.UPDATED),id:"prior-create"});
  f.classifiedCaptures=inspectCensus(f.baselineCensus).captures.map(({eventKey,coreDigest})=>({eventKey,coreDigest}));
  f.scope.expectedCausalSetDigest=containedDeliveryBusinessDigest({sourceSetDigest:digest(Object.values(f.baselineCensus.collections).flat().sort((a,b)=>a.name<b.name?-1:1)),classifiedEventSetDigest:digest(f.classifiedCaptures)});
  f.currentCensus.events=structuredClone(f.baselineCensus.events);f.currentCensus.deliveries=structuredClone(f.baselineCensus.deliveries);f.currentCensus.chunks=structuredClone(f.baselineCensus.chunks);
  f.currentCensus.intakeBefore=structuredClone(f.baselineCensus.intakeBefore);f.currentCensus.intakeAfter=structuredClone(f.baselineCensus.intakeAfter);
  addOwned(f);const proof=verify(f);assert.equal(proof.baselineObservedCaptures.length,1);assert.equal(proof.ownedObservedCaptureCount,2);
  assert.deepEqual(parse(proof,f),proof);
});
test("a deletion at an owned path still requires the exact original service version",()=>{
  const f=makeFixture(),path=`${ROOT}/shifts/legacy-0`;
  addCapture(f.currentCensus,{path,before:present(path,{legacy:0,status:"planned"},wire.CREATED,wire.LATER),after:absent(path),id:"wrong-version-delete"});
  assert.doesNotThrow(()=>inspectCensus(f.currentCensus));assert.throws(()=>verify(f),/Captured delete service version differs/);
});
test("post-proof parser refuses recomputed unknown fields, invented counters and capture/digest substitutions",()=>{
  const f=makeFixture(),valid=verify(f);
  for(const change of [v=>{v.extra="unreviewed";},v=>{v.pendingDeliveryCount=0;},v=>{v.ownedObservedCaptureCount=1;},
    v=>{v.currentCaptureSetDigest=digest("other cores");},v=>{v.baselineSourceSetDigest=digest("other historical source");},v=>{v.currentSourceSetDigest=v.baselineSourceSetDigest;}]){
    const {proofDigest,...body}=structuredClone(valid);void proofDigest;change(body);assert.throws(()=>parse({...body,proofDigest:digest(body)},f));
  }
});
module.exports={makeFixture,addCapture,absent,present,COMMIT};
