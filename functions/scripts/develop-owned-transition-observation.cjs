"use strict";

// Read-only validation of one already-committed forward transition. The raw
// current census stays current: no normalization back to the admission image.
const assert=require("node:assert/strict");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {encodeShiftPlanningFirestoreValue:encode,decodeShiftPlanningFirestoreDocument:decode,
  parseShiftPlanningActivationOperationTerminal:parseOperation,parseShiftPlanningBackendMutationMarker:parseMarker,
  createShiftPlanningPublicShiftMaterialization:publicMaterialization}=require("../lib/shift-planning-publication-contract.js");
const {containedDeliveryBusinessDigest}=require("../lib/shift-planning-contained-delivery.js");
const {shiftPlanningPublicEventOperationRetentionPath:retentionPath}=require("../lib/shift-planning-public-event-retention.js");
const {decodeRESTValue}=require("./develop-shift-migration-engine.cjs");
const {inspectCensus}=require("./inspect-develop-legacy-census.cjs");
const {FILE}=require("./develop-original-writer-provider.cjs");
const ROOT="develop/plus-collections",BASE="projects/reguerta-9f27f/databases/(default)/documents/";
const KIND="develop-owned-forward-transition-observation";
const PROOF_KEYS=["schemaVersion","kind","projectId","environment","scopeDigest","preparedDigest","operationId","receiptDigest","callbackReceiptDigest","verifiedReceiptDigest",
  "beforeCensusDigest","afterCensusDigest","baselineCausalSetDigest","baselineSourceSetDigest","currentSourceSetDigest","baselineCaptureSetDigest","currentCaptureSetDigest",
  "ownedCaptureSetDigest","ownedObservedCaptureCount","baselineObservedCaptures","ownedObservedCaptures","beforeCaptureRevision","currentCaptureRevision","observedAtMillis",
  "pendingDeliveryCount","inFlightDeliveryCount","deliveryCompleteness","canClaimClosure","canRetry","canEnterMaintenance"];
const exact=(v,keys)=>assert.deepEqual(Object.keys(v).sort(),[...keys].sort());
const same=(a,b,message)=>assert.equal(digest(a),digest(b),message);
const rows=v=>[...v].sort((a,b)=>a.name<b.name?-1:1);
const entries=v=>[...v].sort((a,b)=>a.eventKey<b.eventKey?-1:1);
const encoded=v=>encode(v,"owned transition observation",new Set());
const time=value=>{
  assert.equal(value.kind,"timestamp");assert.ok(Number.isSafeInteger(value.seconds)&&Number.isSafeInteger(value.nanoseconds));
  assert.ok(value.nanoseconds>=0&&value.nanoseconds<1000000000);return [value.seconds,value.nanoseconds];
};
const isoTime=s=>time(encoded(decodeRESTValue({timestampValue:s})));
const compareTime=(a,b)=>a[0]-b[0]||a[1]-b[1];
const field=(map,name)=>map.fields.find(f=>f.name===name)?.value;
const plainReceipt=value=>{
  assert.ok(value&&typeof value==="object"&&!Array.isArray(value));
  const {receiptDigest,...body}=value;assert.equal(receiptDigest,digest(body),"Receipt digest changed");return body;
};
function isOwnedTransitionReceipt(value) {return value!==null&&typeof value==="object"&&Object.hasOwn(value,"receiptDigest");}
function expectedPaths(prepared) {
  assert.equal(prepared.legacy.length,62);assert.equal(prepared.content.shifts.length,72);
  const operation=`${ROOT}/shiftPlanningOperations/${prepared.operationId}`;
  return [...prepared.legacy.map(v=>v.path),...prepared.legacy.map((v,i)=>`${operation}/beforeImages/${i+1}`),
    ...prepared.content.shifts.map(v=>`${ROOT}/shifts/${v.id}`),`${ROOT}/shiftPlanningState/current`,`${ROOT}/shiftPlanningState/sourcePolicy`,
    `${ROOT}/shiftRotations/delivery`,`${ROOT}/shiftRotations/market`,operation,retentionPath({environment:"develop",operationId:prepared.operationId}),
    `${ROOT}/shiftPlanningMigrationBaselines/${prepared.baselineRevision}`].sort();
}
function receiptBody(receipt,prepared,scope) {
  const body=plainReceipt(receipt);
  exact(body,["schemaVersion","scope","projectId","preparedDigest","direction","replayed","documents","measurement","operation"]);
  assert.equal(body.schemaVersion,1);assert.equal(body.direction,"forward");assert.equal(body.projectId,prepared.projectId);
  assert.equal(body.scope,prepared.scope);assert.equal(body.preparedDigest,prepared.preparedDigest);assert.equal(typeof body.replayed,"boolean");
  const operation=parseOperation(decode(body.operation));
  assert.equal(operation.operationId,prepared.operationId);assert.equal(operation.environment,"develop");
  assert.equal(operation.requestId,prepared.requestId);assert.equal(operation.bundleRevision,prepared.baselineRevision);
  assert.equal(operation.bundleDigest,prepared.contentDigest);assert.equal(operation.forwardManifestDigest,prepared.preparedDigest);
  assert.equal(operation.expectedStateDigest,scope.expectedAuthoritativeDigest);assert.equal(operation.writeEpoch,1);
  const paths=expectedPaths(prepared);assert.equal(paths.length,203);assert.equal(new Set(paths).size,203);
  assert.deepEqual(body.documents.map(d=>d.path),paths);assert.equal(new Set(body.documents.map(d=>d.path)).size,203);
  const op=body.documents.find(d=>d.path===`${ROOT}/shiftPlanningOperations/${prepared.operationId}`);
  assert.equal(op.exists,true);same(op.payload,body.operation,"Operation receipt image differs");const committed=time(op.updateTime);
  for(const doc of body.documents){
    exact(doc,["path","exists","payload","updateTime"]);assert.equal(typeof doc.exists,"boolean");
    if(doc.exists){assert.ok(doc.payload&&doc.payload.kind==="map");same(time(doc.updateTime),committed,"Owned afterimage service version changed");}
    else{assert.equal(doc.payload,null);assert.equal(doc.updateTime,null);}
  }
  const legacy=new Set(prepared.legacy.map(d=>d.path));
  for(const doc of body.documents)assert.equal(doc.exists,!legacy.has(doc.path),"Owned afterimage existence differs");
  const publicImages=body.documents.filter(d=>d.path.startsWith(`${ROOT}/shifts/`)&&d.exists);
  const mutations=new Map(operation.publicMutations.map(v=>[v.targetPath,v]));assert.equal(mutations.size,72);assert.equal(operation.publicMutations.length,72);
  for(const doc of publicImages){
    const mutation=mutations.get(doc.path);assert.ok(mutation);assert.equal(mutation.mutationKind,"create");
    const marker=field(doc.payload,"lastBackendMutation");assert.ok(marker);
    const parsed=parseMarker(decode(marker));
    assert.equal(parsed.kind,"activation");assert.equal(parsed.operationId,operation.operationId);assert.equal(parsed.operationIntentDigest,operation.operationIntentDigest);
    assert.equal(parsed.bundleRevision,operation.bundleRevision);assert.equal(parsed.bundleDigest,operation.bundleDigest);assert.equal(parsed.writeEpoch,operation.writeEpoch);
    assert.equal(parsed.targetPath,doc.path);assert.equal(parsed.documentRevision,mutation.documentRevision);assert.equal(parsed.payloadDigest,mutation.payloadDigest);
    const payload=decode({...doc.payload,fields:doc.payload.fields.filter(v=>v.name!=="lastBackendMutation")});
    const materialized=publicMaterialization({targetPath:doc.path,payload});
    assert.equal(materialized.payloadDigest,mutation.payloadDigest,"Terminal does not bind the canonical payload");
  }
  assert.equal(operation.beforeImages.length,prepared.legacy.length);
  for(const [i,doc]of prepared.legacy.entries()){
    const binding=operation.beforeImages.find(v=>v.ordinal===i+1);assert.ok(binding);
    assert.equal(binding.targetPath,doc.path);assert.equal(binding.envelopePath,`${ROOT}/shiftPlanningOperations/${prepared.operationId}/beforeImages/${i+1}`);
  }
  return {body,operation,committed};
}
function restDocument(doc) {
  assert.ok(doc.name.startsWith(BASE));const path=doc.name.slice(BASE.length);
  return {path,payload:encoded(Object.fromEntries(Object.entries(doc.fields??{}).map(([k,v])=>[k,decodeRESTValue(v)]))),
    updateTime:encoded(decodeRESTValue({timestampValue:doc.updateTime})),createTime:encoded(decodeRESTValue({timestampValue:doc.createTime}))};
}
function tagged(value) {
  if(value.kind==="null")return ["null"];
  if(["string","boolean"].includes(value.kind))return [value.kind,value.value];
  if(value.kind==="number")return ["number",Object.is(value.value,-0)?"-0":String(value.value)];
  if(value.kind==="timestamp")return ["timestamp",time(value)];
  if(value.kind==="bytes")return ["bytes",value.base64];
  if(value.kind==="geoPoint")return ["geopoint",value.latitude,value.longitude];
  if(value.kind==="array")return ["array",value.values.map(tagged)];
  assert.equal(value.kind,"map");return ["map",value.fields.map(f=>[f.name,tagged(f.value)])];
}
// inspectCensus has already checked chunk numbering, bounds, envelope/core hashes,
// route identities, metadata and every delivery binding before this extraction.
function cores(census) {
  return new Map(census.events.map(event=>{
    const bytes=Buffer.concat([...census.chunks[event.name]].sort((a,b)=>Number(a.name.split("/").at(-1))-Number(b.name.split("/").at(-1)))
      .map(c=>Buffer.from(c.fields.bytes.bytesValue,"base64")));
    return [event.name.split("/").at(-1),JSON.parse(bytes.toString("utf8")).core];
  }));
}
function assertAppendOnly(before,after) {
  const history=c=>[...c.events,...c.deliveries,...Object.values(c.chunks).flat()];
  const current=new Map(history(after).map(v=>[v.name,v]));
  for(const doc of history(before)){
    assert.ok(current.has(doc.name),"Previously observed capture history changed");same(current.get(doc.name),doc,"Previously observed capture history changed");
  }
}
function verifyDevelopOwnedTransitionObservation({prepared,scope,baselineCensus,currentCensus,callbackReceipt,retainedInspection,classifiedCaptures}) {
  const {preparedDigest,...preparedBody}=prepared;assert.equal(digest(preparedBody),preparedDigest);
  assert.ok(["reguerta-9f27f","demo-reguerta-hu084-migration"].includes(prepared.projectId));assert.equal(prepared.environment,"develop");
  assert.equal(scope.environment,"develop");assert.equal(scope.transitionId,prepared.operationId);assert.equal(scope.expectedWorkbookFileId,FILE);
  const before=inspectCensus(baselineCensus),after=inspectCensus(currentCensus);
  assert.ok(compareTime(isoTime(currentCensus.readTime),isoTime(baselineCensus.readTime))>=0);
  assert.equal(retainedInspection.kind,"committed-and-readback-verified","Current committed images must be independently verified");
  assert.equal(retainedInspection.canRetry,false);
  const callback=receiptBody(callbackReceipt,prepared,scope),verified=receiptBody(retainedInspection.receipt,prepared,scope);
  assert.equal(callback.body.replayed,false,"Owned callback must be the actual first commit");
  assert.equal(callback.body.measurement?.documentWriteCount,203,"Owned callback must retain the measured transaction");
  assert.equal(verified.body.replayed,true,"Independent inspection must be a current retained read-back");assert.equal(verified.body.measurement,null);
  same(callback.body.documents,verified.body.documents,"Independent read-back images differ from the callback");
  same(callback.body.operation,verified.body.operation,"Independent operation binding differs");
  assert.ok(compareTime(isoTime(currentCensus.readTime),callback.committed)>=0,"Census predates the owned commit");
  const original=new Map(baselineCensus.collections.shifts.map(restDocument).map(v=>[v.path,v]));
  assert.equal(original.size,prepared.legacy.length);
  for(const doc of prepared.legacy){
    const raw=original.get(doc.path);assert.ok(raw);same(raw.payload,doc.payload,"Baseline legacy payload changed");same(raw.updateTime,doc.updateTime,"Baseline legacy version changed");
    if(doc.createTime!==undefined)same(raw.createTime,doc.createTime,"Baseline legacy creation version changed");
  }
  const canonical=new Map(callback.body.documents.filter(d=>d.path.startsWith(`${ROOT}/shifts/`)&&d.exists).map(d=>[d.path,d]));
  assert.equal(canonical.size,72);assert.equal(currentCensus.collections.shifts.length,72);
  const currentRows=new Map(currentCensus.collections.shifts.map(restDocument).map(v=>[v.path,v]));assert.equal(currentRows.size,72);
  for(const [path,expected]of canonical){
    const actual=currentRows.get(path);assert.ok(actual,"Missing owned canonical source");same(actual.payload,expected.payload,"Current canonical payload changed");
    same(actual.updateTime,expected.updateTime,"Current canonical version changed");same(time(actual.createTime),callback.committed,"Canonical creation is not the owned commit");
  }
  for(const collection of ["shiftPlanningRequests","deliveryCalendar","notificationEvents"])
    same(rows(currentCensus.collections[collection]),rows(baselineCensus.collections[collection]),"Unrelated source mutation");
  assertAppendOnly(baselineCensus,currentCensus);
  assert.ok(after.captureRevision>=before.captureRevision);
  const baselineCaptures=entries(before.captures.map(({eventKey,coreDigest})=>({eventKey,coreDigest})));
  assert.deepEqual(entries(classifiedCaptures),baselineCaptures,"Baseline capture registry is not the reviewed set");
  const prior=new Map(baselineCaptures.map(v=>[v.eventKey,v.coreDigest])),currentCores=cores(currentCensus),owned=[];
  for(const capture of after.captures){
    if(prior.has(capture.eventKey)){assert.equal(prior.get(capture.eventKey),capture.coreDigest);continue;}
    const core=currentCores.get(capture.eventKey);assert.ok(core);assert.equal(core.entryPoint,"onShiftWritten");
    assert.equal(core.type,"google.cloud.firestore.document.v1.written");
    if(canonical.has(core.path)){
      const expected=canonical.get(core.path);assert.equal(core.before.exists,false);assert.equal(core.after.exists,true);
      same(core.after.fields,tagged(expected.payload),"Captured create payload is not the owned afterimage");
      same(core.after.updateTime,time(expected.updateTime),"Captured create service version differs");same(core.after.createTime,callback.committed);
    }else if(original.has(core.path)){
      const expected=original.get(core.path);assert.equal(core.before.exists,true);assert.equal(core.after.exists,false);
      same(core.before.fields,tagged(expected.payload),"Captured delete payload is not the owned beforeimage");
      same(core.before.updateTime,time(expected.updateTime),"Captured delete service version differs");same(core.before.createTime,time(expected.createTime));
    }else assert.fail("An unreviewed captured source is not an owned transition");
    owned.push({eventKey:capture.eventKey,coreDigest:capture.coreDigest});
  }
  const sourceSet=c=>digest(rows(Object.values(c.collections).flat())),baselineSourceSetDigest=sourceSet(baselineCensus),baselineCaptureSetDigest=digest(baselineCaptures);
  const baselineCausalSetDigest=containedDeliveryBusinessDigest({sourceSetDigest:baselineSourceSetDigest,classifiedEventSetDigest:baselineCaptureSetDigest});
  assert.equal(baselineCausalSetDigest,scope.expectedCausalSetDigest,"Historical causal identity differs");
  const body={schemaVersion:1,kind:KIND,projectId:prepared.projectId,environment:"develop",scopeDigest:digest(scope),preparedDigest,operationId:prepared.operationId,
    receiptDigest:callbackReceipt.receiptDigest,callbackReceiptDigest:callbackReceipt.receiptDigest,verifiedReceiptDigest:retainedInspection.receipt.receiptDigest,
    beforeCensusDigest:digest(baselineCensus),afterCensusDigest:digest(currentCensus),baselineCausalSetDigest,baselineSourceSetDigest,currentSourceSetDigest:sourceSet(currentCensus),
    baselineCaptureSetDigest,currentCaptureSetDigest:digest(entries(after.captures.map(({eventKey,coreDigest})=>({eventKey,coreDigest})))),
    ownedCaptureSetDigest:digest(entries(owned)),ownedObservedCaptureCount:owned.length,baselineObservedCaptures:baselineCaptures,ownedObservedCaptures:entries(owned),
    beforeCaptureRevision:before.captureRevision,currentCaptureRevision:after.captureRevision,observedAtMillis:Date.parse(currentCensus.readTime),
    pendingDeliveryCount:null,inFlightDeliveryCount:null,deliveryCompleteness:"not-claimed",canClaimClosure:false,canRetry:false,canEnterMaintenance:false};
  return {...body,proofDigest:digest(body)};
}
function assertDevelopOwnedTransitionObservation(proof,{prepared,scope,callbackReceipt}) {
  const {proofDigest,...body}=proof;exact(body,PROOF_KEYS);assert.equal(digest(body),proofDigest);
  assert.equal(body.schemaVersion,1);assert.equal(body.kind,KIND);assert.equal(body.projectId,prepared.projectId);assert.equal(body.environment,"develop");
  assert.equal(body.scopeDigest,digest(scope));assert.equal(body.preparedDigest,prepared.preparedDigest);assert.equal(body.operationId,prepared.operationId);
  assert.equal(scope.expectedWorkbookFileId,FILE);
  const callback=receiptBody(callbackReceipt,prepared,scope);assert.equal(callback.body.replayed,false);assert.equal(callback.body.measurement?.documentWriteCount,203);
  assert.equal(body.receiptDigest,callbackReceipt.receiptDigest);assert.equal(body.callbackReceiptDigest,callbackReceipt.receiptDigest);
  assert.equal(body.baselineCausalSetDigest,scope.expectedCausalSetDigest);assert.equal(body.canRetry,false);assert.equal(body.canEnterMaintenance,false);assert.equal(body.canClaimClosure,false);
  assert.equal(body.pendingDeliveryCount,null);assert.equal(body.inFlightDeliveryCount,null);assert.equal(body.deliveryCompleteness,"not-claimed");
  for(const key of ["scopeDigest","preparedDigest","receiptDigest","callbackReceiptDigest","verifiedReceiptDigest","beforeCensusDigest","afterCensusDigest","baselineCausalSetDigest",
    "baselineSourceSetDigest","currentSourceSetDigest","baselineCaptureSetDigest","currentCaptureSetDigest","ownedCaptureSetDigest"])
    assert.match(body[key],/^shift-planning:v1:sha256:[a-f0-9]{64}$/);
  for(const key of ["baselineObservedCaptures","ownedObservedCaptures"]){
    assert.ok(Array.isArray(body[key])&&body[key].length<=5000);
    for(const row of body[key]){exact(row,["eventKey","coreDigest"]);assert.match(row.eventKey,/^[a-f0-9]{64}$/);assert.match(row.coreDigest,/^[a-f0-9]{64}$/);}
    assert.deepEqual(body[key],entries(body[key]));
  }
  const combined=[...body.baselineObservedCaptures,...body.ownedObservedCaptures];assert.equal(new Set(combined.map(v=>v.eventKey)).size,combined.length);
  assert.equal(body.baselineCaptureSetDigest,digest(body.baselineObservedCaptures));assert.equal(body.ownedCaptureSetDigest,digest(body.ownedObservedCaptures));
  assert.equal(body.currentCaptureSetDigest,digest(entries(combined)));assert.equal(body.ownedObservedCaptureCount,body.ownedObservedCaptures.length);
  assert.equal(body.baselineCausalSetDigest,containedDeliveryBusinessDigest({sourceSetDigest:body.baselineSourceSetDigest,classifiedEventSetDigest:body.baselineCaptureSetDigest}));
  assert.notEqual(body.currentSourceSetDigest,body.baselineSourceSetDigest);
  for(const key of ["beforeCaptureRevision","currentCaptureRevision","observedAtMillis"])assert.ok(Number.isSafeInteger(body[key])&&body[key]>=0);
  assert.ok(body.observedAtMillis>=callback.committed[0]*1000+Math.floor(callback.committed[1]/1000000));
  assert.ok(body.currentCaptureRevision-body.beforeCaptureRevision>=body.ownedObservedCaptureCount);
  assert.ok(body.beforeCaptureRevision>=body.baselineObservedCaptures.length);return structuredClone(proof);
}
module.exports={isOwnedTransitionReceipt,verifyDevelopOwnedTransitionObservation,assertDevelopOwnedTransitionObservation};
