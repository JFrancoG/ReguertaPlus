"use strict";
const {test}=require("node:test"), assert=require("node:assert/strict");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {reviewWriterRehearsal:review}=require("../scripts/develop-writer-rehearsal-evidence.cjs");
const {writerEvidence,withWriter,WORKBOOK}=require("./develop-writer-evidence-fixture.cjs");
const {fixture}=require("./develop-migration-package-fixture.cjs");
const {prepareDevelopMigrationPackage:prepare}=require("../scripts/prepare-develop-migration-package.cjs");

test("copy evidence changes package binding but preserves exact source policy and both migration intents",()=>{
  const input=fixture(), before=prepare(input), bound=withWriter(input), saved=structuredClone(bound), after=prepare(bound);
  assert.deepEqual(bound,saved);
  for(const key of ["sourcePolicy","policyDigest","forward","forwardDigest","inverse","inverseDigest","evidenceDigests"])
    assert.deepEqual(after[key],before[key],key);
  assert.notEqual(after.packageDigest,before.packageDigest);
  assert.equal(after.writerRehearsal.evidenceDigest,digest(bound.writerRehearsal));
  assert.equal(after.writerRehearsal.originalWorkbookId,WORKBOOK);
  for(const key of ["originalFileAuthorityVerified","currentControlsVerified","canApply","canEnterMaintenance"])
    assert.equal(after.writerRehearsal[key],false);
  assert.equal(after.canEnterMaintenance,false);assert.equal(after.canApply,false);
  assert.equal(after.window,null);assert.equal(after.operationRiskAcceptance,null);
});

const invalid={
  "changed review pin":e=>{e.localFinal.marketCommands=2;},
  "another preparation source":e=>{e.preparation.controllerSourceDigest=digest("other-source");},
  "original file used as copy":e=>{e.input.copy.fileId=WORKBOOK;},
  "identity replaced under same email":e=>{e.identityAfter.account.uniqueId="99999999999999999999";},
  "incomplete cleanup":e=>{e.result.cleanupFailures.push("disable");e.terminal.body=structuredClone(e.result);},
  "unknown external effect":e=>{e.child.unknown=1;},
  "second batch":e=>{e.child.submitted=2;},
  "wrong child target":e=>{e.child.result.command.workbookId=WORKBOOK;},
  "missing row":e=>{e.child.receipt.readable.rows.pop();},
  "expired token denial":e=>{e.accessRemoved.at=e.tokenIssued.body.expiresAtMillis;},
  "denial not observed":e=>{e.accessRemoved.body.status=200;},
  "altered original snapshot despite self hash":e=>{e.after.snapshot.sheets[0].properties.title="Changed";e.after.digest=digest(e.after.snapshot);},
  "different completed receipt":e=>{e.child.receipt.command.commandDigest=digest("other-command");},
  "remaining file editor":e=>{e.permissionsAfter.permissions.push({role:"writer"});},
  "still enabled":e=>{e.identityAfter.account.disabled=false;},
  "remaining IAM binding":e=>{e.identityAfter.policy.bindings=[{role:"roles/iam.workloadIdentityUser"}];},
  "project policy drift":e=>{e.identityAfter.projectPolicy.bindings=[{role:"roles/editor"}];},
  "OAuth not revoked":e=>{e.oauthRevoked.sameTokenProbe=200;},
  "wrapper cleanup failed":e=>{e.wrapperCleanup.failures=["cleanup"];},
  "notice emitted":e=>{e.localFinal.notificationEvents=1;},
};
for(const [name,change]of Object.entries(invalid))test(`writer evidence rejects ${name}`,()=>{
  const e=writerEvidence(), pinned=digest(e); change(e);
  assert.throws(()=>review(e,name==="changed review pin"?pinned:digest(e),WORKBOOK));
});

test("successful historical copy cannot mask current source, permissions or control drift",()=>{
  for(const change of [i=>{i.fileAfter.data.version="999";},i=>{i.controls.jobs[0].data.state="ENABLED";},
    i=>{i.filePermissions.data.permissions[1].role="writer";}]){
    const input=withWriter(fixture());change(input);assert.throws(()=>prepare(input));
  }
});
