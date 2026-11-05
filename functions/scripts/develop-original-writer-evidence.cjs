"use strict";

// Offline historical proof, not an active writer grant or held maintenance barrier.
const assert = require("node:assert/strict");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {prepare, IDENTITY} = require("./prepare-develop-original-writer-check.cjs");
const {checkIdentity} = require("./prepare-develop-writer-rehearsal.cjs");
const {FILE, TABS, REQUEST, validateMetadata, metadataFingerprint, snapshot} = require("./develop-original-writer-provider.cjs");
const {reviewIamPreparationDigest} = require("./develop-historical-source-compatibility.cjs");
const equal = (a, b, message) => assert.equal(digest(a), digest(b), message);

function reviewOriginalWriterCheck(e, reviewedDigest, originalWorkbookId) {
  assert.equal(digest(e), reviewedDigest, "original writer evidence differs from review");
  assert.equal(originalWorkbookId, FILE);
  const {preparationDigest, ...preparation} = e.preparation;
  assert.equal(digest(preparation), preparationDigest);
  const current = prepare();
  const iamCompatibility = reviewIamPreparationDigest(e.preparation.reusedIamPreparationDigest);
  // The inert plan may accumulate outcomes. The IAM preparation has its own
  // exact reviewed transition; all other execution fields must still match.
  for (const key of Object.keys(current).filter(k => !["planDigest", "preparationDigest", "reusedIamPreparationDigest"].includes(k)))
    equal(e.preparation[key], current[key], "original writer execution contract changed");
  const a = e.approval, r = e.receipts;
  assert.equal(a.preparationDigest, preparationDigest);
  assert.equal(a.kind, "authorized-single-original-develop-writer-check");
  assert.equal(a.authorized, true); assert.equal(a.ownerEmail, "testplusprojects@gmail.com");
  assert.equal(a.onlineClosedNoOfflineEdits, true); assert.equal(a.noOtherWritesOrTokens, true);
  assert.ok(Number.isSafeInteger(a.startsAtMillis) && Number.isSafeInteger(a.endsAtMillis));
  assert.ok(a.endsAtMillis > a.startsAtMillis && a.endsAtMillis - a.startsAtMillis <= 600000);
  assert.match(a.receiptId, /^[A-Za-z0-9_-]{6,128}$/);
  equal(r.terminal, e.result);
  equal(e.result, {kind:"original-probe-contained", failure:null, cleanupFailures:[],
    mintAttempted:true, writeAttempted:true, writeVerified:true, canRetry:false,
    canEnterMaintenance:false, grantsMigrationAuthority:false});
  equal(r["mint-intent"], {attempt:1, request:e.preparation.tokenRequest});
  assert.equal(r["token-issued"].tokenRetained, false);
  equal(r["file-denied"], {status:404, sameUnexpiredToken:true});
  equal(r["owner-oauth-cleanup"], {verified:true, sameTokenStatus:401});
  equal(e.rawBefore, e.rawRepeat, "independent raw observations changed");
  const raw = snapshot(e.rawBefore);
  assert.equal(e.capture.kind, "independent-owner-readonly-raw-sheets");
  assert.equal(e.capture.reads, 2); assert.equal(e.capture.preservesEmptyObjects, true);
  assert.equal(e.capture.snapshotDigest, raw.digest);
  assert.equal(e.capture.selectedCells, raw.selectedCells);
  assert.equal(e.capture.fields, "spreadsheetId,properties(title,locale,timeZone),sheets(properties(sheetId,title,index,sheetType,gridProperties),data(startRow,startColumn,rowData(values(userEnteredValue,note,userEnteredFormat))))");
  assert.deepEqual(e.capture.ranges, TABS.map(t => `'${t.title}'!A1:${t.id === 1770956648 ? "Y" : "Z"}100`));
  const captureStart=e.capture.startedAtMillis, captured=e.capture.observedAtMillis;
  const grant=Date.parse(e.uiGrant.at), removed=Date.parse(e.uiRemove.at), cleaned=Date.parse(e.identityAfter.completedAt);
  assert.ok([captureStart,captured,grant,removed,cleaned,r["token-issued"].expiresAtMillis].every(Number.isSafeInteger));
  assert.ok(captureStart <= captured && captured - captureStart < 60000);
  assert.ok(captured <= grant && grant - captured < 600000 && grant >= a.startsAtMillis);
  assert.ok(grant <= removed && removed <= cleaned && cleaned <= a.endsAtMillis);
  assert.ok(removed < r["token-issued"].expiresAtMillis && r["token-issued"].expiresAtMillis <= a.endsAtMillis);
  for (const [ui,kind,id] of [[e.uiGrant,"grant",1],[e.uiRemove,"remove",2]]) {
    assert.equal(ui.success, true); assert.equal(ui.id, id);
    assert.ok(ui.evidenceFile.endsWith(kind === "grant" ? "/granted-owner-private.json" : "/restored-owner-private.json"));
  }
  assert.equal(a.baselineSnapshotDigest, raw.digest);
  equal(r["baseline-snapshot-comparison"], {expectedDigest:raw.digest, actualDigest:raw.digest});
  equal(r["post-write-observation"], {beforeDigest:raw.digest, afterDigest:raw.digest});
  equal(r["write-intent"], {fileId:FILE, requestDigest:digest(REQUEST()), baseline:raw.digest});
  equal(r["writer-capabilities"], {canEdit:true, canModifyContent:true, canShare:true});
  assert.equal(r["writer-metadata-comparison"].writerDigest, r["writer-metadata-comparison"].ownerDigest);
  validateMetadata(e.ownerBefore, false); validateMetadata(e.ownerAfter, false);
  assert.equal(metadataFingerprint(e.ownerBefore), a.baselineMetadataDigest);
  assert.equal(metadataFingerprint(e.ownerBefore,{omitVersion:true}), metadataFingerprint(e.ownerAfter,{omitVersion:true}));
  const before=e.identityBefore, after=e.identityAfter.identity;
  for (const value of [before,after]) {
    checkIdentity({...value,account:{...value.account,disabled:false}}, {identity:IDENTITY}, []);
    assert.equal(value.account.email, IDENTITY.email); assert.equal(value.account.uniqueId, IDENTITY.uniqueId);
    assert.equal(value.project.projectId, "reguerta-9f27f"); assert.equal(value.account.disabled, true);
    assert.deepEqual(value.keys.keys ?? [], []); assert.deepEqual(value.policy.bindings ?? [], []);
  }
  assert.equal(e.identityAfter.readOnly, true); assert.equal(e.identityAfter.projectId, "reguerta-9f27f");
  assert.equal(e.identityAfter.unchangedBeforeAfter, true);
  assert.deepEqual(e.identityAfter.inventory.map(r => r.kind).sort(), ["instances","jobs","services","workerpools"]);
  for (const row of e.identityAfter.inventory) {
    assert.equal(row.status, 200); assert.ok(!row.data.metadata?.continue);
    assert.deepEqual(row.data.unreachable ?? [], []);
    if (row.kind === "services") assert.ok(!(row.data.items ?? []).some(s => s.spec?.template?.spec?.serviceAccountName === IDENTITY.email));
    else assert.deepEqual(row.data.items ?? [], []);
  }
  equal(before.projectPolicy, after.projectPolicy, "project IAM changed");
  for (const controls of [e.controlsBefore,e.controlsAfter]) {
    assert.equal(controls.controlsDigest, a.controlsDigest);
    assert.equal(controls.writerIsolated, true); assert.equal(controls.developFencesHeld, true);
    assert.equal(controls.maintenanceAdmitted, false); assert.equal(controls.globalDrainProven, false);
  }
  return {kind:"historical-contained-original-writer-check", evidenceDigest:reviewedDigest,
    preparationDigest, receiptId:a.receiptId, originalWorkbookId:FILE, identity:IDENTITY,
    snapshotDigest:raw.digest, selectedCells:raw.selectedCells, submittedBatches:1,
    requestDigest:digest(REQUEST()), versionBefore:e.ownerBefore.file.version, versionAfter:e.ownerAfter.file.version,
    independentlyObservedAtMillis:cleaned, sourceCompatibility:iamCompatibility === "exact-reviewed-sources" ? "exact-execution-contract-inert-plan-history-excluded" : iamCompatibility,
    sameValueWriteVerified:true, currentWriterAuthorityVerified:false, currentControlsVerified:false,
    grantsMigrationAuthority:false, canApply:false, canEnterMaintenance:false};
}
module.exports = {reviewOriginalWriterCheck};
