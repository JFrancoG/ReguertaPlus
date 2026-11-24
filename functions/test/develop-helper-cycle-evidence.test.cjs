"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {test,before}=require("node:test"),{createHash}=require("node:crypto");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {prepareCopy,runCopy,IDENTITY}=require("../scripts/rehearse-develop-helper-copy.cjs");
const {PROTECTED_FILES}=require("../scripts/develop-helper-copy-provider.cjs");
const {reviewHelperCycle:review}=require("../scripts/develop-helper-cycle-evidence.cjs");
const {prepareCopyTimeBudget,createCopyTimeBudget}=require("../scripts/develop-copy-time-budget.cjs");
const {prepareDevelopMigrationPackage:prepare,loadManifest}=require("../scripts/prepare-develop-migration-package.cjs");
const {materializeControlledDevelopMigrationPreparation:materialize}=require("../scripts/materialize-develop-migration-package.cjs");
const {createControlledDevelopMigrationExecutor:create}=require("../scripts/controlled-develop-migration.cjs");
const {fixture}=require("./develop-migration-package-fixture.cjs");
const {sheetsService}=require("./shift-sheets-api-fixture.cjs");
const {historicalIamPreparation,historicalCopyTimeBudget}=require("../scripts/develop-historical-source-compatibility.cjs");
const {prepare:prepareIam}=require("../scripts/prepare-develop-writer-rehearsal.cjs");
const FILE=PROTECTED_FILES[0];let evidence;

// Generate successful receipts with the actual runner and Sheets adapter, using
// only in-memory providers. Never copy personal or credential-bearing live data.
before(async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"helper-cycle-evidence-"));
  try {
    const prepared=await prepareCopy({fileId:"synthetic-cycle-review",protectedWorkbookIds:PROTECTED_FILES,runId:"cycle-fixture"});
    const sheets=sheetsService(prepared.fileId);sheets.state=structuredClone(prepared.baseline);
    let now=1000000,disabled=true,permission=false,policy={etag:"fixture",bindings:[]};
    const readIdentity=async()=>({account:{...IDENTITY,disabled},keys:{},policy:structuredClone(policy),project:{projectId:"reguerta-9f27f"},projectPolicy:{bindings:[]}});
    const readIsolation=async()=>({writerEmail:IDENTITY.email,writerIsolated:true,observedAtMillis:now,scope:"reviewed-global-functions-and-cloud-run"});
    const budget=prepareCopyTimeBudget(prepared);
    const input={authorized:true,preparationDigest:prepared.preparationDigest,budgetDigest:budget.budgetDigest,receiptId:"full-cycle",startsAtMillis:now,endsAtMillis:now+600000,
      onlineClosedNoOfflineEdits:true,noOtherWritesOrTokens:true};
    const result=await runCopy({prepared,input,journalRoot:root,nowMillis:()=>now,sleep:async ms=>{now+=ms;},readIsolation,
      timeBudget:createCopyTimeBudget({...input,nowMillis:()=>now}),
      iam:{readIdentity,enableOwned:async()=>{disabled=false;},disableOwned:async()=>{disabled=true;},setPolicy:async v=>{policy=v;},
        hasMintPermission:async()=>true,mint:async()=>({accessToken:"fixture-only",expireTime:new Date(now+300000).toISOString()})},
      owner:{observe:async expected=>{assert.equal(permission,expected);now+=1000;return {snapshot:structuredClone(sheets.state),version:String(sheets.revision),observedAtMillis:now};},
        grant:async()=>{permission=true;return {id:"fixture-writer"};},remove:async()=>{permission=false;},
        close:async()=>{const start=now;now+=42000;return {verified:true,startedAtMillis:start,finishedAtMillis:now,attempts:[{atMillis:start,drive:401,sheets:200},{atMillis:now,drive:401,sheets:401}]};}},
      openWriter:async()=>({sheets,probe:async()=>({status:permission?200:404}),close(){}})});
    assert.equal(result.kind,"full-copy-restored-and-contained",JSON.stringify(result));
    const read=name=>JSON.parse(fs.readFileSync(path.join(root,input.receiptId,name+".json")));
    evidence=Object.fromEntries(Object.entries({approval:"approval",baseline:"baseline",iamReady:"iam-ready",mintIntent:"mint-intent",tokenIssued:"token-issued",
      forwardIntent:"forward-intent",forwardReadback:"forward-readback",forwardVerified:"forward-verified",inverseIntent:"inverse-intent",
      inverseReadback:"inverse-readback",inverseVerified:"inverse-verified",copyDenied:"copy-denied",oauthCleanup:"owner-oauth-cleanup",deadlineReport:"deadline-report",terminal:"terminal"}).map(([k,v])=>[k,read(v)]));
    evidence.budget=budget;evidence.finalIdentity={identity:await readIdentity(),isolation:await readIsolation()};
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});

const bound=()=>({...fixture(),helperCopyCycle:structuredClone(evidence),reviewedHelperCopyCycleDigest:digest(evidence)});
test("copy cycle binds through review, materialization and blocked admission without changing business intents",async()=>{
  const sourceInput=bound(),base=prepare(fixture()),reviewPackage=prepare(sourceInput);
  for(const key of ["sourcePolicy","forward","inverse","policyDigest","forwardDigest","inverseDigest","evidenceDigests"])assert.deepEqual(reviewPackage[key],base[key]);
  assert.notEqual(reviewPackage.packageDigest,base.packageDigest);
  const sourceCapture={projectId:"reguerta-9f27f",environment:"develop",documents:sourceInput.snapshot.collections.shifts,
    guardCollections:Object.fromEntries(["users","deliveryCalendar","notificationEvents","config"].map(k=>[k,sourceInput.snapshot.collections[k]]))};
  const prepared=materialize({sourceInput,reviewPackage,sourceCapture});
  let writes=0;const executor=create({prepared,firestore:{projectId:"reguerta-9f27f",databaseId:"(default)",runTransaction:async()=>{throw Error("offline no current source");}},
    controlPlane:{readBackClosed:async()=>null,readBackOwnerObservation:async()=>null,readBackAdministratorObservation:async()=>null},
    failurePersistence:{readExistingFailure:async()=>null,retainFailureAndReadBack:async()=>{writes++;}},nowMillis:()=>2000000});
  const admission=await executor.inspectAdmission();assert.deepEqual(admission.helperCopyCycle,reviewPackage.helperCopyCycle);
  assert.deepEqual(admission.blockers,["source_not_verified"]);assert.equal(writes,0);
  const r=admission.helperCopyCycle;
  for(const k of ["combinedMaintenanceTimingVerified","currentControlsVerified","currentWriterAuthorityVerified","canApply","canEnterMaintenance"])assert.equal(r[k],false);
  assert.equal(r.uninterruptedRoundtripVerified,true);assert.equal(r.submittedBatches,2);
  assert.equal(r.restoredHelperCells,53);assert.equal(r.measuredTiming.oauthCleanupMillis,42000);
  await assert.rejects(executor.execute({scope:{},admission}));assert.equal(writes,0);
});
const mutations={
  "wrong review digest":e=>{e.terminal.elapsedMillis++;},
  "changed execution sources":e=>{e.approval.prepared.sourceDigest=digest("changed");},
  "forward state masquerading as recovered":e=>{e.inverseReadback.observation.snapshot=e.forwardReadback.observation.snapshot;},
  "unrelated note changed":e=>{e.inverseReadback.observation.snapshot.sheets[0].data[0].rowData[0].values[0].note="drift";},
  "retained marker changed":e=>{e.inverseReadback.observation.snapshot.sheets[0].developerMetadata[0].metadataValue="other";},
  "unknown terminal":e=>{e.terminal.kind="inspection_required";},
  "cleanup failure":e=>{e.terminal.cleanupFailures.push("unknown");},
  "second token":e=>{e.mintIntent.attempt=2;},
  "extra batch":e=>{e.terminal.completedBatches=3;},
  "denial with expired token":e=>{e.copyDenied.sameUnexpiredToken=false;},
  "Sheets OAuth still works":e=>{e.oauthCleanup.attempts.at(-1).sheets=200;},
  "cleanup after window":e=>{e.finalIdentity.isolation.observedAtMillis=e.approval.input.endsAtMillis+1;},
  "IAM wait omitted":e=>{e.iamReady.grantAgeMillis=119999;},
  "invented negative time":e=>{e.inverseVerified.elapsedMillis=-1;},
  "elapsed phases reversed":e=>{e.terminal.elapsedMillis=e.inverseVerified.elapsedMillis-1;},
  "identity still enabled":e=>{e.finalIdentity.identity.account.disabled=false;},
  "residual IAM":e=>{e.finalIdentity.identity.policy.bindings=[{role:"roles/editor"}];},
  "runtime not isolated":e=>{e.finalIdentity.isolation.writerIsolated=false;},
  "deadline breach":e=>{e.deadlineReport.breaches.push("work");},
  "pending HTTP":e=>{e.deadlineReport.inFlight=1;},
  "missing cleanup stage":e=>{e.deadlineReport.stages.pop();},
  "extended work deadline":e=>{e.deadlineReport.stages[1].deadlineMillis+=150000;},
  "late inverse":e=>{e.inverseReadback.observation.observedAtMillis=e.deadlineReport.stages[2].startedAtMillis+1;},
  "different budget":e=>{e.budget.limits.work++;},
  "different forward cell":e=>{e.forwardIntent.requests[0].updateCells.range.startColumnIndex=4;},
  "different marker":e=>{e.forwardIntent.requests[53].createDeveloperMetadata.developerMetadata.metadataValue="other";},
};
for(const [name,change] of Object.entries(mutations))test(`historical cycle rejects ${name}`,()=>{
  const e=structuredClone(evidence),pin=digest(e);change(e);
  if(name==="changed execution sources") {const {preparationDigest,...body}=e.approval.prepared;void preparationDigest;e.approval.prepared.preparationDigest=digest(body);e.approval.input.preparationDigest=digest(body);}
  assert.throws(()=>review(e,name==="wrong review digest"?pin:digest(e),FILE));
});
test("manifest preserves cycle pin and rejects missing pin or changed raw file",t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"helper-evidence-manifest-"));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const input=bound(),m={files:{}};
  for(const [key,value]of Object.entries(input)){
    if(key.startsWith("reviewed")&&key.endsWith("Digest")){m[key]=value;continue;}
    const file=path.join(root,key+".json"),bytes=JSON.stringify(value);fs.writeFileSync(file,bytes);
    m.files[key]={path:file,sha256:createHash("sha256").update(bytes).digest("hex")};
  }
  const f=path.join(root,"manifest.json");fs.writeFileSync(f,JSON.stringify(m));assert.deepEqual(loadManifest(f),input);
  delete m.reviewedHelperCopyCycleDigest;fs.writeFileSync(f,JSON.stringify(m));assert.throws(()=>loadManifest(f));
  m.reviewedHelperCopyCycleDigest=input.reviewedHelperCopyCycleDigest;fs.writeFileSync(f,JSON.stringify(m));
  fs.appendFileSync(m.files.helperCopyCycle.path," ");assert.throws(()=>loadManifest(f));
});

test("equal forward and inverse Drive versions still require the exact restored cells and markers",()=>{
  const e=structuredClone(evidence);
  e.inverseReadback.observation.version=e.forwardReadback.observation.version;
  e.inverseVerified.version=e.forwardVerified.version;
  assert.equal(review(e,digest(e),FILE).uninterruptedRoundtripVerified,true);
  e.inverseReadback.observation.snapshot=e.forwardReadback.observation.snapshot;
  assert.throws(()=>review(e,digest(e),FILE));
});

for(const [runner,label]of [
  ["shift-planning:v1:sha256:2c63c31b681ef4b8b96c00d1f0f79225e5883d50785cb04fc2a29956b29ce669","historical-eae86a89-validator-transition"],
  ["shift-planning:v1:sha256:049fe823dbd8a7c75f371566cc435892c719a88805d3692a0996ebf72e2ed741","historical-pre-coherent-barrier-phase"],
])test(`cycle preserves exact ${label} parent and old default budget receipts`,()=>{
  const e=structuredClone(evidence),p=e.approval.prepared;
  p.parentPreparationDigest=historicalIamPreparation(prepareIam(),runner).preparationDigest;
  const {preparationDigest,...body}=p;void preparationDigest;p.preparationDigest=digest(body);e.approval.input.preparationDigest=p.preparationDigest;
  e.budget=historicalCopyTimeBudget(prepareCopyTimeBudget(p));e.approval.input.budgetDigest=e.budget.budgetDigest;
  const saved=structuredClone(e),result=review(e,digest(e),FILE);
  assert.deepEqual(e,saved);assert.equal(result.parentSourceCompatibility,label);
  assert.equal(result.budgetSourceCompatibility,'historical-pre-original-deferred-writer-budget');
  assert.equal(result.currentWriterAuthorityVerified,false);assert.equal(result.combinedMaintenanceTimingVerified,false);
  assert.equal(result.canEnterMaintenance,false);
  e.budget.limits.window=1200000;
  const {budgetDigest,...changed}=e.budget;void budgetDigest;e.budget.budgetDigest=digest(changed);e.approval.input.budgetDigest=e.budget.budgetDigest;
  assert.throws(()=>review(e,digest(e),FILE));
});
