"use strict";

// Review retained copy receipts offline. This adds historical evidence, never
// fresh controls, writer authority, an executable window or a timing guarantee.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {createShiftSheetsOwnerPreservationManifest:manifest,assertShiftSheetsOwnerPreservation:preserved}=require("../lib/shift-sheets-owner-manifest.js");
const {EMAIL,checkIdentity,prepare:iamPreparation}=require("./prepare-develop-writer-rehearsal.cjs");
const {PROTECTED_FILES}=require("./develop-helper-copy-provider.cjs");
const {reviewHelperExecutionDigest,reviewIamPreparationDigest}=require("./develop-historical-source-compatibility.cjs");
const equal=(a,b,why)=>assert.equal(digest(a),digest(b),why);
const millis=value=>assert.ok(Number.isSafeInteger(value)&&value>=0,"invalid receipt time");

function reviewHelperRecovery(e,reviewedDigest,originalWorkbookId) {
  assert.equal(digest(e),reviewedDigest,"copy recovery differs from review");
  const {input:a,prepared:p}=e.approval;
  const {preparationDigest,...body}=p;assert.equal(digest(body),preparationDigest);
  assert.equal(p.kind,"isolated-helper-copy-recovery-preparation");
  // Same source set as the consumed runner. Only an exact reviewed historical
  // transition can retain older receipts; it does not prove the new deadlines.
  const sources=["rehearse-develop-helper-copy.cjs","develop-helper-copy-provider.cjs","prepare-develop-helper-batch.cjs",
    "develop-google-observations.cjs","develop-writer-copy-provider.cjs","prepare-develop-writer-rehearsal.cjs",
    "../lib/shift-sheets.js","../lib/shift-sheets-owner-manifest.js"];
  const sourceCompatibility=reviewHelperExecutionDigest(p.sourceDigest,digest(sources.map(s=>fs.readFileSync(path.join(__dirname,s),"utf8"))));
  const parentSourceCompatibility=reviewIamPreparationDigest(p.parentPreparationDigest);
  assert.ok(PROTECTED_FILES.includes(originalWorkbookId));
  assert.ok(PROTECTED_FILES.every(id=>p.protectedWorkbookIds.includes(id)));
  assert.ok(!p.protectedWorkbookIds.includes(p.fileId));
  assert.equal(p.identity.email,EMAIL);assert.equal(p.identity.uniqueId,"110752956317536684858");
  assert.equal(p.maximumBatches,1);assert.equal(p.expectedHelperCells,53);
  assert.equal(p.canExecute,false);assert.equal(p.canEnterMaintenance,false);
  assert.equal(a.authorized,true);assert.equal(a.inverseOnly,true);
  assert.equal(a.preparationDigest,preparationDigest);
  assert.equal(a.onlineClosedNoOfflineEdits,true);assert.equal(a.noOtherWritesOrTokens,true);
  assert.match(a.receiptId,/^[A-Za-z0-9_-]{6,128}$/);
  assert.notEqual(a.receiptId,p.recoveryEvidence.consumedReceiptId);
  millis(a.startsAtMillis);millis(a.endsAtMillis);
  assert.ok(a.endsAtMillis>a.startsAtMillis&&a.endsAtMillis-a.startsAtMillis<=600000);
  const previous=p.recoveryEvidence;
  assert.equal(previous.terminal.kind,"inspection_required");assert.equal(previous.terminal.failure.phase,"forward");
  assert.deepEqual(previous.terminal.cleanupFailures,[]);assert.equal(previous.terminal.canRetry,false);
  equal(p.baseline,previous.observation.snapshot);equal(p.baseline,e.baseline.snapshot);
  assert.equal(p.reviewedVersion,e.baseline.version);assert.equal(p.baselineDigest,digest(p.baseline));
  preserved({manifest:previous.forwardIntent.preservation,after:p.baseline});
  equal(e.inverseIntent,p.inversePlan,"inverse requests differ from reviewed recipe");
  assert.equal(e.inverseIntent.requests.length,55);
  assert.equal(e.inverseIntent.requests.filter(r=>r.updateCells).length,53);
  assert.equal(e.inverseIntent.requests.filter(r=>r.updateDeveloperMetadata).length,2);
  equal(e.inverseIntent.preservation,manifest({before:p.baseline,requests:e.inverseIntent.requests}));
  const {observation:after,result}=e.inverseReadback;
  assert.equal(after.snapshot.spreadsheetId,p.fileId);
  preserved({manifest:e.inverseIntent.preservation,after:after.snapshot});
  const restored=structuredClone(after.snapshot);
  restored.sheets.forEach(s=>{s.developerMetadata=p.restoreBaseline.sheets.find(b=>b.properties.sheetId===s.properties.sheetId).developerMetadata;});
  equal(restored,p.restoreBaseline,"original cells or structure not restored");
  assert.equal(result.kind,"verified");assert.equal(result.operationId,p.inverse.operationId);
  assert.equal(result.projectionDigest,result.readBackDigest);equal(e.inverseVerified.result,result);
  assert.equal(e.inverseVerified.snapshotDigest,digest(after.snapshot));assert.equal(e.inverseVerified.version,after.version);
  for(const version of [p.reviewedVersion,after.version])assert.match(version,/^\d+$/);
  assert.ok(BigInt(after.version)>BigInt(p.reviewedVersion));
  const r=e.terminal;
  assert.equal(r.kind,"inverse-copy-restored-and-contained");assert.equal(r.failure,null);
  assert.deepEqual(r.cleanupFailures,[]);assert.equal(r.completedBatches,1);assert.equal(r.mintAttempted,true);
  for(const k of ["canRetry","canEnterMaintenance","productionAccess"])assert.equal(r[k],false);
  equal(e.mintIntent,{attempt:1,request:iamPreparation().tokenRequest});
  assert.equal(e.tokenIssued.tokenRetained,false);millis(e.tokenIssued.expiresAtMillis);
  assert.ok(e.tokenIssued.expiresAtMillis<=a.endsAtMillis&&after.observedAtMillis<e.tokenIssued.expiresAtMillis);
  assert.ok([403,404].includes(e.copyDenied.status));assert.equal(e.copyDenied.sameUnexpiredToken,true);
  const o=e.oauthCleanup;assert.equal(o.verified,true);assert.ok(o.attempts.length>0);
  const times=[e.baseline.observedAtMillis,after.observedAtMillis,o.startedAtMillis,
    ...o.attempts.map(x=>x.atMillis),o.finishedAtMillis,e.finalIdentity.isolation.observedAtMillis];
  times.forEach(millis);assert.deepEqual(times,[...times].sort((a,b)=>a-b));
  assert.ok(times[0]>=a.startsAtMillis&&times.at(-1)<=a.endsAtMillis);
  assert.equal(o.attempts.at(-1).drive,401);assert.equal(o.attempts.at(-1).sheets,401);
  const identity=e.finalIdentity.identity;
  checkIdentity({...identity,account:{...identity.account,disabled:false}},{identity:p.identity},[]);
  assert.equal(identity.account.disabled,true);assert.equal(e.finalIdentity.isolation.writerIsolated,true);
  assert.equal(e.finalIdentity.isolation.writerEmail,EMAIL);
  assert.equal(e.finalIdentity.isolation.scope,"reviewed-global-functions-and-cloud-run");
  const wait=e.iamReady.grantAgeMillis,verified=e.inverseVerified.elapsedMillis,total=r.elapsedMillis;
  [wait,verified,total].forEach(millis);
  assert.ok(wait>=120000&&wait<180000&&wait<=verified&&verified<=total&&total<=a.endsAtMillis-a.startsAtMillis);
  return {kind:"historical-contained-helper-copy-recovery",evidenceDigest:reviewedDigest,preparationDigest,
    syntheticWorkbookId:p.fileId,originalWorkbookId,receiptId:a.receiptId,sourceCompatibility,parentSourceCompatibility,
    restoredHelperCells:53,updatedMarkers:2,submittedBatches:1,versionBefore:p.reviewedVersion,versionAfter:after.version,
    restoredSnapshotDigest:digest(after.snapshot),independentlyObservedAtMillis:times.at(-1),
    measuredTiming:{iamPropagationMillis:wait,inverseVerifiedElapsedMillis:verified,totalWithCleanupMillis:total,
      oauthCleanupMillis:o.finishedAtMillis-o.startedAtMillis},
    uninterruptedRoundtripVerified:false,combinedMaintenanceTimingVerified:false,currentControlsVerified:false,
    currentWriterAuthorityVerified:false,canApply:false,canEnterMaintenance:false,
    pendingTiming:["uninterrupted-forward-inverse-with-one-token","fresh-observations-and-durable-acquisition",
      "Firestore-and-Sheets-combined-recovery-and-cleanup"]};
}
module.exports={reviewHelperRecovery};
