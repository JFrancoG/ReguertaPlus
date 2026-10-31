"use strict";

// Historical, locally reviewed evidence only. No clients, grants or admission.
const assert = require("node:assert/strict");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {prepare, PROJECT, EMAIL, DEMO} = require("./prepare-develop-writer-rehearsal.cjs");
const equal = (a, b, why) => assert.equal(digest(a), digest(b), why);

function reviewWriterRehearsal(evidence, reviewedDigest, originalWorkbookId) {
  assert.equal(digest(evidence), reviewedDigest, "writer evidence differs from review");
  const {preparation, input, result, terminal, reviewedBatch, tokenIssued, accessRemoved,
    before, after, child, identityBefore, identityAfter, permissionsAfter, oauthRevoked,
    wrapperCleanup, localFinal} = evidence;
  // Evidence cannot certify a changed runner, controller, provider or plan.
  equal(preparation, prepare(), "writer rehearsal sources changed; review required");
  assert.equal(input.approval.preparationDigest, preparation.preparationDigest);
  assert.equal(input.approval.kind, "authorized-single-synthetic-copy-rehearsal");
  assert.equal(input.identity.email, EMAIL);
  assert.match(input.identity.uniqueId, /^\d{10,30}$/);
  assert.ok(input.protectedWorkbookIds.includes(originalWorkbookId));
  assert.ok(!input.protectedWorkbookIds.includes(input.copy.fileId));
  assert.equal(input.copy.ownerEmail, "testplusprojects@gmail.com");
  const window = input.window;
  assert.ok(Number.isSafeInteger(window.startsAtMillis) && Number.isSafeInteger(window.endsAtMillis));
  assert.ok(window.endsAtMillis > window.startsAtMillis && window.endsAtMillis - window.startsAtMillis <= 600000);
  const times = [tokenIssued.body.issuedAtMillis, tokenIssued.at, reviewedBatch.at, accessRemoved.at,
    terminal.at, wrapperCleanup.at, identityAfter.observedAtMillis];
  assert.ok(times.every(t => Number.isSafeInteger(t) && t >= window.startsAtMillis && t <= window.endsAtMillis));
  assert.deepEqual(times, [...times].sort((a,b) => a-b), "receipt order changed");
  assert.equal(tokenIssued.body.expiresAtMillis - tokenIssued.body.issuedAtMillis, 300000);
  assert.equal(tokenIssued.body.tokenRetained, false);
  assert.ok(accessRemoved.at < tokenIssued.body.expiresAtMillis, "expired token proves no ACL containment");
  assert.equal(accessRemoved.body.originalTokenUnexpired, true);
  assert.ok([403,404].includes(accessRemoved.body.status));
  equal(terminal.body, result);
  assert.equal(result.kind, "completed-and-contained");
  assert.equal(result.primaryFailure, null); assert.equal(result.failureDetails, null);
  assert.deepEqual(result.cleanupFailures, []); assert.equal(result.mintAttempted, true);
  assert.equal(result.canRetry, false); assert.equal(result.canEnterMaintenance, false);
  const batch = reviewedBatch.body;
  assert.equal(batch.workbookId, input.copy.fileId); assert.equal(batch.runtimeEmail, EMAIL);
  assert.equal(batch.runtimePermissionId, input.copy.permissionId);
  assert.equal(batch.ownerEmail, input.copy.ownerEmail); assert.equal(batch.ownerPermissionId, input.copy.ownerPermissionId);
  assert.equal(batch.expectedRows, 10); assert.equal(batch.requests, 45); assert.equal(batch.canApply, false);
  equal(result.outcome, {kind:"completed",submitted:1,preservedOriginalTabs:7,expectedRows:10,title:batch.title});
  for (const snapshot of [before,after]) {
    assert.equal(snapshot.snapshot.spreadsheetId, input.copy.fileId);
    assert.equal(snapshot.digest, digest(snapshot.snapshot));
    assert.deepEqual(snapshot.snapshot.sheets.map(s => s.properties.sheetId), [100,101,102,103,104,105,106]);
  }
  equal(before.snapshot, after.snapshot, "original tabs changed");
  assert.equal(before.digest, input.copy.baselineDigest); assert.equal(batch.originalTabsDigest, before.digest);
  assert.equal(child.submitted, 1); assert.equal(child.inFlight, 0); assert.equal(child.unknown, 0);
  assert.equal(child.result.kind, "completed");
  const command = child.result.command;
  assert.equal(command.state, "completed"); assert.equal(command.workbookId, input.copy.fileId);
  assert.equal(command.type, "market"); assert.equal(command.workbookRevision, before.version);
  assert.equal(command.terminal.readBackWorkbookRevision, after.version);
  assert.equal(child.receipt.command.commandId, command.commandId);
  assert.equal(child.receipt.command.commandDigest, command.commandDigest);
  assert.equal(child.receipt.command.workbookId, input.copy.fileId);
  assert.equal(child.receipt.evidence.workbookRevision, after.version);
  assert.equal(child.receipt.evidence.partitionDigest, command.terminal.readBackPartitionDigest);
  assert.equal(child.receipt.readable.rows.length, 10); equal(child.originalTabsAfter, after);
  for (const identity of [identityBefore,identityAfter]) {
    assert.equal(identity.account.email, EMAIL); assert.equal(identity.account.uniqueId, input.identity.uniqueId);
    assert.equal(identity.account.projectId, PROJECT); assert.equal(identity.project.projectId, PROJECT);
    assert.equal(identity.account.disabled, true);
    assert.deepEqual(identity.keys.keys ?? [], []); assert.deepEqual(identity.policy.bindings ?? [], []);
  }
  equal(identityBefore.projectPolicy, identityAfter.projectPolicy, "project authority changed");
  equal(permissionsAfter, {permissions:[{id:input.copy.ownerPermissionId,type:"user",emailAddress:input.copy.ownerEmail,role:"owner"}]});
  assert.equal(oauthRevoked.revokeStatus, 200); assert.equal(oauthRevoked.sameTokenProbe, 401);
  assert.equal(oauthRevoked.refreshTokenRequested, false);
  assert.deepEqual(wrapperCleanup.failures, []);
  assert.equal(wrapperCleanup.canRetry, false); assert.equal(wrapperCleanup.canEnterMaintenance, false);
  equal(localFinal, {demoProjectId:DEMO,notificationEvents:0,marketCommands:1,marketState:"completed"});
  return {kind:"historical-contained-writer-rehearsal", evidenceDigest:reviewedDigest,
    preparationDigest:preparation.preparationDigest, identity:structuredClone(input.identity),
    syntheticWorkbookId:input.copy.fileId, originalWorkbookId, completedAtMillis:terminal.at,
    independentlyObservedAtMillis:identityAfter.observedAtMillis, originalTabsDigest:before.digest,
    submittedBatches:1, syntheticRows:10, preservedOriginalTabs:7, sourceCompatibility:"exact-reviewed-sources",
    originalFileAuthorityVerified:false, currentControlsVerified:false, canApply:false, canEnterMaintenance:false,
    remainingBindings:["fresh-original-source-version-and-complete-ACL", "authorized-original-writer-and-capabilities",
      "independent-current-controls-and-drain", "separate-Firestore-authority", "owner-admin-risk-window"]};
}
module.exports = {reviewWriterRehearsal};
