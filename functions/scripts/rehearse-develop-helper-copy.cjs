"use strict";

// Explicit isolated-copy composition. No credentials, live CLI or Firestore client.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {createShiftSheetsConfig}=require("../lib/shift-sheets-config.js");
const {createShiftSheetsAdapter}=require("../lib/shift-sheets.js");
const {createShiftSheetsOwnerPreservationManifest:manifest,assertShiftSheetsOwnerPreservation:preserved}=require("../lib/shift-sheets-owner-manifest.js");
const {prepare:iamPreparation,grantFor,removeOwnGrant,checkIdentity,EMAIL}=require("./prepare-develop-writer-rehearsal.cjs");
const {FILE,TABS}=require("./develop-original-writer-provider.cjs");
const {assertHelperBatchTime,planBatch}=require("./prepare-develop-helper-batch.cjs");
const {batchFixture}=require("../test/develop-helper-batch-fixture.cjs");
const {PROTECTED_FILES}=require("./develop-helper-copy-provider.cjs");
const IDENTITY=Object.freeze({email:EMAIL,uniqueId:"110752956317536684858"});
const sourceDigest=()=>digest([__filename,"develop-helper-copy-provider.cjs","prepare-develop-helper-batch.cjs",
  "develop-google-observations.cjs","develop-writer-copy-provider.cjs","prepare-develop-writer-rehearsal.cjs",
  "../lib/shift-sheets.js","../lib/shift-sheets-owner-manifest.js"]
  .map(p=>fs.readFileSync(path.isAbsolute(p)?p:path.join(__dirname,p),"utf8")));

async function prepareCopy({fileId,protectedWorkbookIds,runId}) {
  assert.match(fileId,/^[A-Za-z0-9_-]{6,128}$/);assert.match(runId,/^[A-Za-z0-9_-]{6,48}$/);
  assert.ok(protectedWorkbookIds.length>=2&&PROTECTED_FILES.every(id=>protectedWorkbookIds.includes(id))&&!protectedWorkbookIds.includes(fileId));
  const f=batchFixture(),forward=await planBatch({...f,observation:f.observe()});
  const baseline=structuredClone(f.sheets.state);baseline.spreadsheetId=fileId;
  baseline.properties={title:"HU-084 — ENSAYO LOTE COMPLETO — "+runId,locale:"es_ES",timeZone:"Europe/Madrid"};
  for(const s of baseline.sheets)for(const d of s.data)for(const r of d.rowData)for(const c of r.values)
    if(c.userEnteredValue?.stringValue==="")delete c.userEnteredValue;
  const operation=structuredClone(forward.operation);operation.operationId=`hu084-helper-copy-${runId}`;
  const inverse=structuredClone(operation);inverse.operationId=`hu084-helper-inverse-${runId}`;
  inverse.rows.forEach(r=>{r.helperUserId=null;});
  inverse.humanRows.forEach(r=>{[r.before,r.after]=[r.after,r.before];r.helper={userId:null,name:""};});
  const value={kind:"isolated-helper-copy-preparation",fileId,protectedWorkbookIds,runId,identity:IDENTITY,
    sourceDigest:sourceDigest(),parentPreparationDigest:iamPreparation().preparationDigest,
    baseline,baselineDigest:digest(baseline),forward:operation,inverse,
    maximumWindowMillis:600000,minimumIamAgeMillis:120000,tokenSeconds:300,cleanupReserveMillis:120000,
    expectedHelperCells:53,maximumBatches:2,canExecute:false,canEnterMaintenance:false};
  return {...value,preparationDigest:digest(value)};
}
// Plan with the production adapter but a read-only in-memory transport. No SDK or
// credential is consulted; the authorization callback captures and stops the batch.
async function copyPlan(fileId,operation,snapshot) {
  let batch=null;const stop=Error("copy_plan_complete");
  const api=createShiftSheetsAdapter({config:createShiftSheetsConfig({environment:"develop",workbooks:{develop:fileId}}),
    sheets:{get:async()=>({data:structuredClone(snapshot)}),batchUpdate:async()=>{throw Error("offline_copy_plan_cannot_write");}}});
  try{await api.reconcile({...operation,authorizeMutation:async value=>{batch=structuredClone(value);throw stop;}});}
  catch(e){if(e!==stop)throw e;}
  assert.ok(batch,"Retained operation is inspect-only");return batch;
}
async function prepareCopyRecovery(evidence) {
  evidence=structuredClone(evidence);
  const {original,forwardIntent,terminal,observation,consumedReceiptId}=evidence;
  const {preparationDigest,...body}=original;assert.equal(digest(body),preparationDigest);
  assert.match(consumedReceiptId,/^[A-Za-z0-9_-]{6,128}$/);
  assert.equal(terminal.kind,"inspection_required");assert.equal(terminal.failure?.phase,"forward");
  assert.equal(terminal.mintAttempted,true);assert.ok([0,1].includes(terminal.completedBatches));
  assert.deepEqual(terminal.cleanupFailures,[]);assert.equal(terminal.canRetry,false);
  const recipe=await prepareCopy(original);
  // Historical source hashes identify a consumed attempt, not permission to run old
  // code. Its business recipe must still equal the freshly derived current recipe.
  for(const key of ["kind","fileId","protectedWorkbookIds","runId","identity","baseline","baselineDigest","forward","inverse"])
    assert.deepEqual(original[key],recipe[key]);
  const forward=await copyPlan(recipe.fileId,recipe.forward,recipe.baseline);
  assert.equal(forwardIntent.requestDigest,forward.requestDigest);
  assert.deepEqual(forwardIntent.requests,forward.requests);
  assert.deepEqual(forwardIntent.preservation,manifest({before:recipe.baseline,requests:forward.requests}));
  assert.match(observation.version,/^[0-9]+$/);
  assert.equal(observation.snapshot.spreadsheetId,recipe.fileId);
  preserved({manifest:forwardIntent.preservation,after:observation.snapshot});
  const api=createShiftSheetsAdapter({config:createShiftSheetsConfig({environment:"develop",workbooks:{develop:recipe.fileId}}),
    sheets:{get:async()=>({data:structuredClone(observation.snapshot)})}});
  assert.equal((await api.inspect(recipe.forward)).kind,"verified");
  const inverse=await copyPlan(recipe.fileId,recipe.inverse,observation.snapshot);
  assert.equal(inverse.requests.length,55);assert.equal(inverse.requests.filter(r=>r.updateCells).length,53);
  assert.equal(inverse.requests.filter(r=>r.updateDeveloperMetadata).length,2);
  const {preparationDigest:ignored,...current}=recipe;void ignored;
  const value={...current,kind:"isolated-helper-copy-recovery-preparation",maximumBatches:1,
    baseline:observation.snapshot,baselineDigest:digest(observation.snapshot),restoreBaseline:recipe.baseline,
    reviewedVersion:observation.version,recoveryEvidence:evidence,
    inversePlan:{requestDigest:inverse.requestDigest,requests:inverse.requests,
      preservation:manifest({before:observation.snapshot,requests:inverse.requests})}};
  return {...value,preparationDigest:digest(value)};
}
function checkPrepared(prepared) {
  const {preparationDigest,...body}=prepared;assert.equal(digest(body),preparationDigest);
  assert.equal(prepared.sourceDigest,sourceDigest());
  assert.equal(prepared.parentPreparationDigest,iamPreparation().preparationDigest);
  assert.deepEqual(prepared.identity,IDENTITY);assert.equal(prepared.canExecute,false);
  assert.equal(prepared.canEnterMaintenance,false);
  assert.ok(["isolated-helper-copy-preparation","isolated-helper-copy-recovery-preparation"].includes(prepared.kind));
  assert.ok(PROTECTED_FILES.every(id=>prepared.protectedWorkbookIds.includes(id)));
  assert.ok(!prepared.protectedWorkbookIds.includes(prepared.fileId));
}

async function runCopy({prepared,input,iam,owner,openWriter,readIsolation,journalRoot,nowMillis=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms))}) {
  prepared=structuredClone(prepared);input=structuredClone(input);checkPrepared(prepared);
  // Recompute the recipe, not just a caller-supplied hash, before any provider I/O.
  const recovery=prepared.kind==="isolated-helper-copy-recovery-preparation";
  assert.deepEqual(prepared,recovery?await prepareCopyRecovery(prepared.recoveryEvidence):await prepareCopy(prepared));
  if(recovery){assert.equal(input.inverseOnly,true);assert.notEqual(input.receiptId,prepared.recoveryEvidence.consumedReceiptId);}
  assert.equal(input.authorized,true);assert.equal(input.preparationDigest,prepared.preparationDigest);
  assert.match(input.receiptId,/^[A-Za-z0-9_-]{6,128}$/);
  for(const flag of ["onlineClosedNoOfflineEdits","noOtherWritesOrTokens"])assert.equal(input[flag],true);
  assert.ok([input.startsAtMillis,input.endsAtMillis,nowMillis()].every(Number.isSafeInteger));
  assert.ok(input.startsAtMillis<=nowMillis()&&nowMillis()+360000<input.endsAtMillis);
  assert.ok(input.endsAtMillis-input.startsAtMillis<=600000);
  const directory=path.join(journalRoot,input.receiptId),lock=path.join(journalRoot,"helper-copy-active");
  fs.mkdirSync(lock,{mode:0o700});try{fs.mkdirSync(directory,{mode:0o700});}catch(e){fs.rmdirSync(lock);throw e;}
  const record=(name,data)=>{const fd=fs.openSync(path.join(directory,name+".json"),"wx",0o600);
    try{fs.writeFileSync(fd,JSON.stringify(data,null,2));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}};
  record("approval",{input,prepared});
  const binding=grantFor(input);binding.condition.title="hu084-helper-copy";
  binding.condition.description=recovery?"One inverse-only recovery of an isolated 53-helper copy":"One isolated 53-helper copy roundtrip; no original workbook access";
  let owned=false,grantAttempted=false,mintAttempted=false,bearer=null,expiry=0,writer=null,phase="preflight",failure=null;
  let projectBaseline=null,permission=null,completedBatches=0;const cleanupFailures=[],started=nowMillis();
  const current=(reserve=0)=>{checkPrepared(prepared);assert.ok(nowMillis()>=input.startsAtMillis&&nowMillis()+reserve<input.endsAtMillis);};
  const budget=()=>{current();assertHelperBatchTime({nowMillis:nowMillis(),tokenExpiresAtMillis:expiry,windowEndsAtMillis:input.endsAtMillis});};
  async function identity(disabled,bindings,deadline) {
    while(true){assert.ok(nowMillis()<deadline);const v=await iam.readIdentity();
      checkIdentity({...v,account:{...v.account,disabled:false}},{identity:IDENTITY},bindings);
      if(projectBaseline!==null)assert.equal(digest(v.projectPolicy),projectBaseline);
      assert.ok(nowMillis()<deadline);
      if((v.account.disabled===true)===disabled)return v;
      await sleep(Math.min(5000,deadline-nowMillis()));}
  }
  async function isolated() {
    const v=await readIsolation();assert.equal(v.writerEmail,EMAIL);assert.equal(v.writerIsolated,true);
    assert.ok(v.observedAtMillis<=nowMillis()&&nowMillis()-v.observedAtMillis<60000);
    return v;
  }
  try {
    phase="isolation";await isolated();phase="identity-baseline";const before=await identity(true,[],nowMillis()+60000);projectBaseline=digest(before.projectPolicy);
    phase="copy-baseline";const initial=await owner.observe(false);assert.equal(initial.snapshot.spreadsheetId,prepared.fileId);
    assert.deepEqual(initial.snapshot,prepared.baseline);
    if(recovery)assert.equal(initial.version,prepared.reviewedVersion);record("baseline",initial);
    current(360000);record("enable-intent",IDENTITY);owned=true;
    phase="enable";await iam.enableOwned();const enabled=await identity(false,[],Math.min(nowMillis()+60000,input.endsAtMillis-360000));
    phase="grant-iam";record("iam-intent",binding);await iam.setPolicy({...enabled.policy,version:3,bindings:[binding]});const grantedAt=nowMillis();
    phase="grant-copy";current(360000);record("file-grant-intent",{fileId:prepared.fileId,email:EMAIL});grantAttempted=true;
    permission=await owner.grant();record("file-granted",permission);
    phase="wait-iam";const deadline=Math.min(grantedAt+180000,input.endsAtMillis-360000);
    while(true){current(360000);await identity(false,[binding],Math.min(nowMillis()+60000,deadline));
      const ready=await iam.hasMintPermission();assert.equal(typeof ready,"boolean");assert.ok(nowMillis()<deadline);
      if(ready&&nowMillis()>=grantedAt+120000)break;await sleep(Math.min(5000,deadline-nowMillis()));}
    record("iam-ready",{grantAgeMillis:nowMillis()-grantedAt});await isolated();
    const readyCopy=await owner.observe(true);assert.deepEqual(readyCopy.snapshot,prepared.baseline);
    current(300000);phase="mint";
    record("mint-intent",{attempt:1,request:iamPreparation().tokenRequest});mintAttempted=true;
    let token=await iam.mint(iamPreparation().tokenRequest);
    try{bearer=token.accessToken;expiry=Date.parse(token.expireTime);assert.ok(typeof bearer==="string"&&bearer.length);
      assert.ok(Number.isSafeInteger(expiry)&&expiry<=nowMillis()+300000&&expiry<=input.endsAtMillis);budget();}finally{token=null;}
    record("token-issued",{expiresAtMillis:expiry,tokenRetained:false});writer=await openWriter({bearer,expiresAtMillis:expiry,maximumBatches:prepared.maximumBatches});
    assert.equal((await writer.probe()).status,200);record("positive-copy-access",{status:200});
    const api=createShiftSheetsAdapter({config:createShiftSheetsConfig({environment:"develop",workbooks:{develop:prepared.fileId}}),sheets:writer.sheets});
    let expected=prepared.baseline;
    for(const direction of recovery?["inverse"]:["forward","inverse"]) {
      phase=direction;budget();const before=await owner.observe(true);assert.deepEqual(before.snapshot,expected);
      let preservation=null;
      const result=await api.reconcile({...prepared[direction],assertSubmissionNow:budget,authorizeMutation:async batch=>{
        budget();assert.equal(batch.workbookId,prepared.fileId);assert.equal(batch.requests.length,55);
        const updates=batch.requests.filter(r=>r.updateCells);assert.equal(updates.length,53);
        const targets=new Map(prepared[direction].humanRows.map(r=>[`${r.sheetId}:${r.rowNumber-1}`,r.after[0].values[5]]));
        for(const {updateCells:u}of updates){assert.equal(u.fields,"userEnteredValue");assert.equal(u.range.startColumnIndex,5);assert.equal(u.range.endColumnIndex,6);
          assert.equal(u.range.endRowIndex,u.range.startRowIndex+1);assert.equal(u.rows.length,1);assert.equal(u.rows[0].values.length,1);
          const key=`${u.range.sheetId}:${u.range.startRowIndex}`;assert.ok(targets.has(key));assert.deepEqual(u.rows[0].values[0].userEnteredValue??{},targets.get(key));targets.delete(key);}
        assert.equal(targets.size,0);preservation=manifest({before:before.snapshot,requests:batch.requests});
        if(recovery){assert.equal(batch.requestDigest,prepared.inversePlan.requestDigest);
          assert.deepEqual(batch.requests,prepared.inversePlan.requests);assert.deepEqual(preservation,prepared.inversePlan.preservation);}
        await identity(false,[binding],Math.min(nowMillis()+60000,expiry-150000));await isolated();
        const final=await owner.observe(true);assert.equal(final.version,before.version);assert.deepEqual(final.snapshot,before.snapshot);
        budget();record(direction+"-intent",{requestDigest:batch.requestDigest,requests:batch.requests,preservation});
      }});
      assert.ok(preservation,"Consumed operation is inspect-only; cannot start a new run");assert.equal(result.kind,"verified");
      const after=await owner.observe(true);record(direction+"-readback",{result,observation:after});
      preserved({manifest:preservation,after:after.snapshot});expected=after.snapshot;
      record(direction+"-verified",{result,snapshotDigest:digest(expected),version:after.version,elapsedMillis:nowMillis()-started});completedBatches++;
    }
    const restoreBaseline=recovery?prepared.restoreBaseline:prepared.baseline;
    const restored=structuredClone(expected);restored.sheets.forEach(s=>{s.developerMetadata=restoreBaseline.sheets.find(x=>x.properties.sheetId===s.properties.sheetId).developerMetadata;});
    assert.deepEqual(restored,restoreBaseline);
  }catch(e){const frame=String(e?.stack??"").split("\n").find(line=>line.includes(__filename+":"));
    const location=frame?.slice(frame.indexOf(__filename+":")+__filename.length+1).match(/^(\d+):(\d+)/);
    failure={phase,httpStatus:Number.isInteger(e?.httpStatus)?e.httpStatus:null,sourceLine:location?Number(location[1]):null};}
  finally {
    if(grantAttempted)try{await owner.remove(permission);await owner.observe(false);
      if(bearer){assert.ok(writer&&nowMillis()<expiry);const denied=await writer.probe();assert.ok([403,404].includes(denied.status)&&nowMillis()<expiry);
        record("copy-denied",{status:denied.status,sameUnexpiredToken:true});}}
    catch{cleanupFailures.push("file_removal_or_live_token_denial_unproven");}
    if(owned){
      try{const v=await iam.readIdentity();assert.equal(v.account.uniqueId,IDENTITY.uniqueId);assert.equal(v.account.email,EMAIL);
        const next=removeOwnGrant(v.policy,binding);if(digest(next.bindings)!==digest(v.policy.bindings??[]))await iam.setPolicy(next);}
      catch{cleanupFailures.push("iam_removal_unproven");}
      try{await iam.disableOwned();}catch{cleanupFailures.push("disable_unproven");}
      try{await identity(true,[],nowMillis()+60000);await isolated();}catch{cleanupFailures.push("terminal_identity_unproven");}
    }
    try{writer?.close();}catch{cleanupFailures.push("writer_discard_unproven");}bearer=null;
    try{const cleanup=await owner.close();assert.equal(cleanup.verified,true);record("owner-oauth-cleanup",cleanup);}catch{cleanupFailures.push("owner_oauth_cleanup_unproven");}
  }
  const result={kind:failure||cleanupFailures.length?"inspection_required":recovery?"inverse-copy-restored-and-contained":"full-copy-restored-and-contained",failure,cleanupFailures,
    completedBatches,mintAttempted,elapsedMillis:nowMillis()-started,canRetry:false,canEnterMaintenance:false,productionAccess:false};
  record("terminal",result);if(!cleanupFailures.length)fs.rmdirSync(lock);return result;
}
module.exports={prepareCopy,prepareCopyRecovery,runCopy,IDENTITY,TABS};
if(require.main===module){console.error("explicit_isolated_copy_composition_only");process.exitCode=1;}
