"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {test,before}=require("node:test"),{createHash}=require("node:crypto");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {createShiftSheetsAdapter}=require("../lib/shift-sheets.js");
const {createShiftSheetsConfig}=require("../lib/shift-sheets-config.js");
const {createShiftSheetsOwnerPreservationManifest:manifest}=require("../lib/shift-sheets-owner-manifest.js");
const {prepareCopy,prepareCopyRecovery,runCopy,IDENTITY}=require("../scripts/rehearse-develop-helper-copy.cjs");
const {PROTECTED_FILES}=require("../scripts/develop-helper-copy-provider.cjs");
const {reviewHelperRecovery:review}=require("../scripts/develop-helper-recovery-evidence.cjs");
const {prepareDevelopMigrationPackage:prepare,loadManifest}=require("../scripts/prepare-develop-migration-package.cjs");
const {materializeControlledDevelopMigrationPreparation:materialize}=require("../scripts/materialize-develop-migration-package.cjs");
const {createControlledDevelopMigrationExecutor:create}=require("../scripts/controlled-develop-migration.cjs");
const {fixture}=require("./develop-migration-package-fixture.cjs");
const {sheetsService}=require("./shift-sheets-api-fixture.cjs");
const FILE=PROTECTED_FILES[0];let evidence;

// Generate successful receipts with the actual runner and Sheets adapter, using
// only in-memory providers. Never copy personal or credential-bearing live data.
before(async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"helper-recovery-evidence-"));
  try {
    const original=await prepareCopy({fileId:"synthetic-recovery-review",protectedWorkbookIds:PROTECTED_FILES,runId:"review-fixture"});
    const sheets=sheetsService(original.fileId);sheets.state=structuredClone(original.baseline);
    const api=createShiftSheetsAdapter({config:createShiftSheetsConfig({environment:"develop",workbooks:{develop:original.fileId}}),sheets});
    let forwardIntent;
    await api.reconcile({...original.forward,authorizeMutation:async b=>{forwardIntent={requestDigest:b.requestDigest,requests:b.requests,preservation:manifest({before:original.baseline,requests:b.requests})};}});
    const prepared=await prepareCopyRecovery({original,forwardIntent,consumedReceiptId:"old-forward",observation:{snapshot:sheets.state,version:String(sheets.revision)},
      terminal:{kind:"inspection_required",failure:{phase:"forward"},mintAttempted:true,completedBatches:0,cleanupFailures:[],canRetry:false}});
    let now=1000000,disabled=true,permission=false,policy={etag:"fixture",bindings:[]};
    const readIdentity=async()=>({account:{...IDENTITY,disabled},keys:{},policy:structuredClone(policy),project:{projectId:"reguerta-9f27f"},projectPolicy:{bindings:[]}});
    const readIsolation=async()=>({writerEmail:IDENTITY.email,writerIsolated:true,observedAtMillis:now,scope:"reviewed-global-functions-and-cloud-run"});
    const input={authorized:true,inverseOnly:true,preparationDigest:prepared.preparationDigest,receiptId:"new-inverse",startsAtMillis:now,endsAtMillis:now+600000,
      onlineClosedNoOfflineEdits:true,noOtherWritesOrTokens:true};
    const result=await runCopy({prepared,input,journalRoot:root,nowMillis:()=>now,sleep:async ms=>{now+=ms;},readIsolation,
      iam:{readIdentity,enableOwned:async()=>{disabled=false;},disableOwned:async()=>{disabled=true;},setPolicy:async v=>{policy=v;},
        hasMintPermission:async()=>true,mint:async()=>({accessToken:"fixture-only",expireTime:new Date(now+300000).toISOString()})},
      owner:{observe:async expected=>{assert.equal(permission,expected);now+=1000;return {snapshot:structuredClone(sheets.state),version:String(sheets.revision),observedAtMillis:now};},
        grant:async()=>{permission=true;return {id:"fixture-writer"};},remove:async()=>{permission=false;},
        close:async()=>{const start=now;now+=42000;return {verified:true,startedAtMillis:start,finishedAtMillis:now,attempts:[{atMillis:start,drive:401,sheets:200},{atMillis:now,drive:401,sheets:401}]};}},
      openWriter:async()=>({sheets,probe:async()=>({status:permission?200:404}),close(){}})});
    assert.equal(result.kind,"inverse-copy-restored-and-contained",JSON.stringify(result));
    const read=name=>JSON.parse(fs.readFileSync(path.join(root,input.receiptId,name+".json")));
    evidence=Object.fromEntries(Object.entries({approval:"approval",baseline:"baseline",iamReady:"iam-ready",mintIntent:"mint-intent",tokenIssued:"token-issued",inverseIntent:"inverse-intent",
      inverseReadback:"inverse-readback",inverseVerified:"inverse-verified",copyDenied:"copy-denied",oauthCleanup:"owner-oauth-cleanup",terminal:"terminal"}).map(([k,v])=>[k,read(v)]));
    evidence.finalIdentity={identity:await readIdentity(),isolation:await readIsolation()};
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});

const bound=()=>({...fixture(),helperCopyRecovery:structuredClone(evidence),reviewedHelperCopyRecoveryDigest:digest(evidence)});
test("copy recovery binds through review, materialization and blocked admission without changing business intents",async()=>{
  const sourceInput=bound(),base=prepare(fixture()),reviewPackage=prepare(sourceInput);
  for(const key of ["sourcePolicy","forward","inverse","policyDigest","forwardDigest","inverseDigest","evidenceDigests"])assert.deepEqual(reviewPackage[key],base[key]);
  assert.notEqual(reviewPackage.packageDigest,base.packageDigest);
  const sourceCapture={projectId:"reguerta-9f27f",environment:"develop",documents:sourceInput.snapshot.collections.shifts,
    guardCollections:Object.fromEntries(["users","deliveryCalendar","notificationEvents","config"].map(k=>[k,sourceInput.snapshot.collections[k]]))};
  const prepared=materialize({sourceInput,reviewPackage,sourceCapture});
  let writes=0;const executor=create({prepared,firestore:{projectId:"reguerta-9f27f",databaseId:"(default)",runTransaction:async()=>{throw Error("offline no current source");}},
    controlPlane:{readBackClosed:async()=>null,readBackOwnerObservation:async()=>null,readBackAdministratorObservation:async()=>null},
    failurePersistence:{readExistingFailure:async()=>null,retainFailureAndReadBack:async()=>{writes++;}},nowMillis:()=>2000000});
  const admission=await executor.inspectAdmission();assert.deepEqual(admission.helperCopyRecovery,reviewPackage.helperCopyRecovery);
  assert.deepEqual(admission.blockers,["source_not_verified"]);assert.equal(writes,0);
  const r=admission.helperCopyRecovery;
  for(const k of ["uninterruptedRoundtripVerified","combinedMaintenanceTimingVerified","currentControlsVerified","currentWriterAuthorityVerified","canApply","canEnterMaintenance"])assert.equal(r[k],false);
  assert.equal(r.restoredHelperCells,53);assert.equal(r.measuredTiming.oauthCleanupMillis,42000);
  await assert.rejects(executor.execute({scope:{},admission}));assert.equal(writes,0);
});
const mutations={
  "wrong review digest":e=>{e.terminal.elapsedMillis++;},
  "changed execution sources":e=>{e.approval.prepared.sourceDigest=digest("changed");},
  "forward state masquerading as recovered":e=>{e.inverseReadback.observation.snapshot=e.approval.prepared.baseline;},
  "unrelated note changed":e=>{e.inverseReadback.observation.snapshot.sheets[0].data[0].rowData[0].values[0].note="drift";},
  "retained marker changed":e=>{e.inverseReadback.observation.snapshot.sheets[0].developerMetadata[0].metadataValue="other";},
  "unknown terminal":e=>{e.terminal.kind="inspection_required";},
  "cleanup failure":e=>{e.terminal.cleanupFailures.push("unknown");},
  "second token":e=>{e.mintIntent.attempt=2;},
  "extra batch":e=>{e.terminal.completedBatches=2;},
  "denial with expired token":e=>{e.copyDenied.sameUnexpiredToken=false;},
  "Sheets OAuth still works":e=>{e.oauthCleanup.attempts.at(-1).sheets=200;},
  "cleanup after window":e=>{e.finalIdentity.isolation.observedAtMillis=e.approval.input.endsAtMillis+1;},
  "IAM wait omitted":e=>{e.iamReady.grantAgeMillis=119999;},
  "invented negative time":e=>{e.inverseVerified.elapsedMillis=-1;},
  "elapsed phases reversed":e=>{e.terminal.elapsedMillis=e.inverseVerified.elapsedMillis-1;},
  "identity still enabled":e=>{e.finalIdentity.identity.account.disabled=false;},
  "residual IAM":e=>{e.finalIdentity.identity.policy.bindings=[{role:"roles/editor"}];},
  "runtime not isolated":e=>{e.finalIdentity.isolation.writerIsolated=false;},
  "consumed approval reused":e=>{e.approval.input.receiptId=e.approval.prepared.recoveryEvidence.consumedReceiptId;},
};
for(const [name,change] of Object.entries(mutations))test(`historical recovery rejects ${name}`,()=>{
  const e=structuredClone(evidence),pin=digest(e);change(e);
  if(name==="changed execution sources") {const {preparationDigest,...body}=e.approval.prepared;void preparationDigest;e.approval.prepared.preparationDigest=digest(body);e.approval.input.preparationDigest=digest(body);}
  assert.throws(()=>review(e,name==="wrong review digest"?pin:digest(e),FILE));
});
test("manifest preserves recovery pin and rejects missing pin or changed raw file",t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"helper-evidence-manifest-"));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const input=bound(),m={files:{}};
  for(const [key,value]of Object.entries(input)){
    if(key.startsWith("reviewed")&&key.endsWith("Digest")){m[key]=value;continue;}
    const file=path.join(root,key+".json"),bytes=JSON.stringify(value);fs.writeFileSync(file,bytes);
    m.files[key]={path:file,sha256:createHash("sha256").update(bytes).digest("hex")};
  }
  const f=path.join(root,"manifest.json");fs.writeFileSync(f,JSON.stringify(m));assert.deepEqual(loadManifest(f),input);
  delete m.reviewedHelperCopyRecoveryDigest;fs.writeFileSync(f,JSON.stringify(m));assert.throws(()=>loadManifest(f));
  m.reviewedHelperCopyRecoveryDigest=input.reviewedHelperCopyRecoveryDigest;fs.writeFileSync(f,JSON.stringify(m));
  fs.appendFileSync(m.files.helperCopyRecovery.path," ");assert.throws(()=>loadManifest(f));
});
