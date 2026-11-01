"use strict";

// Consumed copy receipts are historical evidence only. No provider, credentials,
// freshness refresh or acquisition is available through this synchronous review.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),{createHash}=require("node:crypto");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {planShiftSheetsMerge}=require("../lib/shift-sheets.js");
const {createShiftSheetsConfig}=require("../lib/shift-sheets-config.js");
const {createShiftSheetsOwnerPreservationManifest:manifest,assertShiftSheetsOwnerPreservation:preserved}=require("../lib/shift-sheets-owner-manifest.js");
const {EMAIL,checkIdentity,prepare:iamPreparation}=require("./prepare-develop-writer-rehearsal.cjs");
const {PROTECTED_FILES}=require("./develop-helper-copy-provider.cjs");
const {prepareCopyTimeBudget,LIMITS}=require("./develop-copy-time-budget.cjs");
const equal=(a,b,why)=>assert.equal(digest(a),digest(b),why);
const millis=v=>assert.ok(Number.isSafeInteger(v)&&v>=0,"invalid receipt time");
const sources=["rehearse-develop-helper-copy.cjs","develop-helper-copy-provider.cjs","prepare-develop-helper-batch.cjs",
  "develop-google-observations.cjs","develop-writer-copy-provider.cjs","prepare-develop-writer-rehearsal.cjs",
  "../lib/shift-sheets.js","../lib/shift-sheets-owner-manifest.js"];

function reviewHelperCycle(e,reviewedDigest,originalWorkbookId) {
  assert.equal(digest(e),reviewedDigest,"copy cycle differs from review");
  const {input:a,prepared:p}=e.approval;
  const {preparationDigest,...body}=p;assert.equal(digest(body),preparationDigest);
  assert.equal(p.kind,"isolated-helper-copy-preparation");
  assert.equal(p.sourceDigest,digest(sources.map(s=>fs.readFileSync(path.join(__dirname,s),"utf8"))),"unreviewed cycle source transition");
  assert.equal(p.parentPreparationDigest,iamPreparation().preparationDigest);
  equal(e.budget,prepareCopyTimeBudget(p),"unreviewed deadline source or limits");
  assert.equal(a.budgetDigest,e.budget.budgetDigest);assert.equal(a.preparationDigest,preparationDigest);
  assert.ok(PROTECTED_FILES.includes(originalWorkbookId)&&PROTECTED_FILES.every(id=>p.protectedWorkbookIds.includes(id)));
  assert.ok(!p.protectedWorkbookIds.includes(p.fileId));
  assert.equal(p.identity.email,EMAIL);assert.equal(p.identity.uniqueId,"110752956317536684858");
  assert.equal(p.maximumBatches,2);assert.equal(p.expectedHelperCells,53);
  assert.equal(p.canExecute,false);assert.equal(p.canEnterMaintenance,false);
  for(const flag of ["authorized","onlineClosedNoOfflineEdits","noOtherWritesOrTokens"])assert.equal(a[flag],true);
  assert.equal(a.inverseOnly,undefined);assert.match(a.receiptId,/^[A-Za-z0-9_-]{6,128}$/);
  millis(a.startsAtMillis);millis(a.endsAtMillis);assert.ok(a.endsAtMillis>a.startsAtMillis&&a.endsAtMillis-a.startsAtMillis<=LIMITS.window);
  equal(p.baseline,e.baseline.snapshot);assert.equal(p.baseline.spreadsheetId,p.fileId);assert.equal(p.baselineDigest,digest(p.baseline));
  const config=createShiftSheetsConfig({environment:"develop",workbooks:{develop:p.fileId}});
  let before=p.baseline;
  for(const direction of ["forward","inverse"]) {
    const intent=e[direction+"Intent"],{result,observation:after}=e[direction+"Readback"],verified=e[direction+"Verified"],operation=p[direction];
    const plan=planShiftSheetsMerge(config,before,operation.rows,operation.reviewedRows,operation.humanRows);
    assert.equal(plan.requests.length,53);equal(intent.requests.slice(0,53),plan.requests);
    assert.equal(intent.requests.length,55);assert.equal(plan.sheets.length,2);
    // Reconstruct only the two adapter-owned markers; all cell requests come
    // from the production merge planner, not a duplicate fixture algorithm.
    plan.sheets.forEach((target,i)=>{
      const sheet=before.sheets.find(s=>s.properties.sheetId===target.sheetId);
      const markers=(sheet.developerMetadata||[]).filter(m=>m.metadataKey==="reguerta.shiftSheets.v1");assert.ok(markers.length<=1);
      const value=JSON.stringify({operationId:operation.operationId,projectionDigest:plan.projectionDigest});
      const expected=markers.length?{updateDeveloperMetadata:{dataFilters:[{developerMetadataLookup:{metadataId:markers[0].metadataId}}],
        developerMetadata:{metadataValue:value},fields:"metadataValue"}}:{createDeveloperMetadata:{developerMetadata:{
        metadataKey:"reguerta.shiftSheets.v1",metadataValue:value,location:{sheetId:target.sheetId},visibility:"DOCUMENT"}}};
      equal(intent.requests[53+i],expected);
    });
    assert.equal(intent.requestDigest,"shift-sheets:v1:sha256:"+createHash("sha256").update(JSON.stringify({requests:intent.requests})).digest("hex"));
    equal(intent.preservation,manifest({before,requests:intent.requests}));preserved({manifest:intent.preservation,after:after.snapshot});
    assert.equal(after.snapshot.spreadsheetId,p.fileId);
    equal(result,{kind:"verified",operationId:operation.operationId,projectionDigest:plan.projectionDigest,readBackDigest:plan.projectionDigest});
    equal(verified.result,result);assert.equal(verified.snapshotDigest,digest(after.snapshot));assert.equal(verified.version,after.version);
    before=after.snapshot;
  }
  const restored=structuredClone(before);restored.sheets.forEach(s=>{s.developerMetadata=p.baseline.sheets.find(b=>b.properties.sheetId===s.properties.sheetId).developerMetadata;});
  equal(restored,p.baseline,"cells or structure not restored");
  const versions=[e.baseline.version,e.forwardVerified.version,e.inverseVerified.version];versions.forEach(v=>assert.match(v,/^\d+$/));
  // Drive may return the same version for both completed batches. Exact cells
  // and operation markers, not a strictly increasing version, prove the inverse.
  assert.ok(BigInt(versions[1])>BigInt(versions[0])&&BigInt(versions[2])>=BigInt(versions[1]));
  const r=e.terminal,d=e.deadlineReport;
  assert.equal(r.kind,"full-copy-restored-and-contained");assert.equal(r.failure,null);assert.deepEqual(r.cleanupFailures,[]);
  assert.equal(r.completedBatches,2);assert.equal(r.mintAttempted,true);
  for(const k of ["canRetry","canEnterMaintenance","productionAccess"])assert.equal(r[k],false);
  equal(e.mintIntent,{attempt:1,request:iamPreparation().tokenRequest});assert.equal(e.tokenIssued.tokenRetained,false);
  const expiry=e.tokenIssued.expiresAtMillis;millis(expiry);
  assert.ok([403,404].includes(e.copyDenied.status));assert.equal(e.copyDenied.sameUnexpiredToken,true);
  assert.equal(d.kind,"copy-deadline-report");assert.equal(d.inFlight,0);assert.deepEqual(d.breaches,[]);assert.equal(d.canEnterMaintenance,false);
  assert.deepEqual(d.stages.map(s=>s.phase),["preparation","work","file-cleanup","iam-cleanup","oauth-cleanup"]);
  const [prep,work,file,iam,oauth]=d.stages;
  assert.equal(prep.deadlineMillis,a.endsAtMillis-e.budget.minimumWindowAtMintMillis);
  assert.ok(work.startedAtMillis<prep.deadlineMillis&&expiry<=a.endsAtMillis&&expiry<=work.startedAtMillis+300000);
  assert.ok(work.startedAtMillis+210000<expiry);
  assert.ok(work.deadlineMillis<=Math.min(work.startedAtMillis+LIMITS.work,expiry-LIMITS.fileCleanup,a.endsAtMillis-e.budget.cleanupMillis));
  const cleanupStart=Math.min(file.startedAtMillis,a.endsAtMillis-e.budget.cleanupMillis);
  assert.equal(file.deadlineMillis,Math.min(cleanupStart+LIMITS.fileCleanup,expiry));
  assert.equal(iam.deadlineMillis,cleanupStart+LIMITS.fileCleanup+LIMITS.iamCleanup);
  assert.equal(oauth.deadlineMillis,Math.min(cleanupStart+e.budget.cleanupMillis,a.endsAtMillis));
  d.stages.forEach((s,i)=>{millis(s.startedAtMillis);millis(s.deadlineMillis);assert.ok(s.startedAtMillis<s.deadlineMillis);
    assert.ok((d.stages[i+1]?.startedAtMillis??d.finishedAtMillis)<=s.deadlineMillis);});
  const o=e.oauthCleanup;assert.equal(o.verified,true);assert.ok(o.attempts.length>0);
  assert.equal(o.attempts.at(-1).drive,401);assert.equal(o.attempts.at(-1).sheets,401);
  const times=[a.startsAtMillis,prep.startedAtMillis,e.baseline.observedAtMillis,work.startedAtMillis,
    e.forwardReadback.observation.observedAtMillis,e.inverseReadback.observation.observedAtMillis,file.startedAtMillis,iam.startedAtMillis,
    oauth.startedAtMillis,o.startedAtMillis,...o.attempts.map(x=>x.atMillis),o.finishedAtMillis,d.finishedAtMillis,
    e.finalIdentity.isolation.observedAtMillis,a.endsAtMillis];
  times.forEach(millis);assert.deepEqual(times,[...times].sort((a,b)=>a-b));
  const identity=e.finalIdentity.identity;checkIdentity({...identity,account:{...identity.account,disabled:false}},{identity:p.identity},[]);
  assert.equal(identity.account.disabled,true);assert.equal(e.finalIdentity.isolation.writerIsolated,true);
  assert.equal(e.finalIdentity.isolation.writerEmail,EMAIL);assert.equal(e.finalIdentity.isolation.scope,"reviewed-global-functions-and-cloud-run");
  const wait=e.iamReady.grantAgeMillis,f=e.forwardVerified.elapsedMillis,i=e.inverseVerified.elapsedMillis,total=r.elapsedMillis;
  [wait,f,i,total].forEach(millis);assert.ok(wait>=120000&&wait<180000&&wait<=f&&f<=i&&i<=total&&total<=a.endsAtMillis-a.startsAtMillis);
  // The runner starts after the first budget timestamp; allow that measured
  // setup interval, but never an elapsed total preceding either verified batch.
  assert.ok(total<=d.finishedAtMillis-a.startsAtMillis&&total>=d.finishedAtMillis-e.baseline.observedAtMillis);
  return {kind:"historical-contained-helper-copy-cycle",evidenceDigest:reviewedDigest,preparationDigest,budgetDigest:e.budget.budgetDigest,
    syntheticWorkbookId:p.fileId,originalWorkbookId,receiptId:a.receiptId,restoredHelperCells:53,updatedMarkers:2,submittedBatches:2,
    versionBefore:versions[0],versionAfter:versions[2],restoredSnapshotDigest:digest(before),
    measuredTiming:{iamPropagationMillis:wait,forwardVerifiedElapsedMillis:f,inverseVerifiedElapsedMillis:i,totalWithCleanupMillis:total,
      oauthCleanupMillis:o.finishedAtMillis-o.startedAtMillis},deadlineReportDigest:digest(d),
    uninterruptedRoundtripVerified:true,combinedMaintenanceTimingVerified:false,currentControlsVerified:false,currentWriterAuthorityVerified:false,
    canApply:false,canEnterMaintenance:false,pendingTiming:["fresh-observations-and-durable-acquisition","Firestore-and-Sheets-combined-recovery-and-cleanup"]};
}
module.exports={reviewHelperCycle};
