"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {createHash}=require("node:crypto");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {reviewOriginalWriterCheck:review}=require("../scripts/develop-original-writer-evidence.cjs");
const {originalWriterEvidence,withOriginalWriter}=require("./develop-original-writer-evidence-fixture.cjs");
const {fixture}=require("./develop-migration-package-fixture.cjs");
const {withWriter,WORKBOOK}=require("./develop-writer-evidence-fixture.cjs");
const {prepareDevelopMigrationPackage:prepare,loadManifest}=require("../scripts/prepare-develop-migration-package.cjs");

test("original proof coexists with copy evidence without changing source or migration intents",()=>{
 const input=withWriter(fixture()),old=prepare(input),bound=withOriginalWriter(input),saved=structuredClone(bound),next=prepare(bound);
 assert.deepEqual(bound,saved);
 for(const key of ["writerRehearsal","sourcePolicy","forward","inverse","policyDigest","forwardDigest","inverseDigest","evidenceDigests"])
  assert.deepEqual(next[key],old[key]);
 assert.notEqual(next.packageDigest,old.packageDigest);
 assert.equal(next.originalWriterCheck.sameValueWriteVerified,true);
 for(const key of ["currentWriterAuthorityVerified","currentControlsVerified","canApply","canEnterMaintenance","grantsMigrationAuthority"])
  assert.equal(next.originalWriterCheck[key],false);
 assert.equal(next.canApply,false);assert.equal(next.window,null);
});

const invalid={
 "review pin":e=>{e.approval.receiptId="modified-receipt";},
 "changed execution source":e=>{e.preparation.providerSourceDigest=digest("different");const {preparationDigest,...body}=e.preparation;void preparationDigest;e.preparation.preparationDigest=digest(body);e.approval.preparationDigest=digest(body);},
 "unsuccessful terminal":e=>{e.result.writeVerified=false;e.receipts.terminal=structuredClone(e.result);},
 "second token":e=>{e.receipts["mint-intent"].attempt=2;},
 "other destination":e=>{e.receipts["write-intent"].fileId="another-file";},
 "different request":e=>{e.receipts["write-intent"].requestDigest=digest("write-other-cell");},
 "format drift":e=>{e.rawRepeat.sheets[0].data[0].rowData[0].values[0].userEnteredFormat={backgroundColor:{}};},
 "incomplete mask":e=>{e.capture.fields="userEnteredValue";},
 "wrong ranges":e=>{e.capture.ranges.pop();},
 "post-write drift":e=>{e.receipts["post-write-observation"].afterDigest=digest("different");},
 "writer-baseline substitution":e=>{e.approval.baselineSnapshotDigest=digest("writer-only");},
 "stale independent baseline":e=>{e.capture.startedAtMillis-=600001;e.capture.observedAtMillis-=600001;},
 "capture after writer access":e=>{e.capture.startedAtMillis=1020000;e.capture.observedAtMillis=1021000;},
 "expired token denial":e=>{e.uiRemove.at=new Date(e.receipts["token-issued"].expiresAtMillis).toISOString();},
 "access not denied":e=>{e.receipts["file-denied"].status=200;},
 "OAuth still active":e=>{e.receipts["owner-oauth-cleanup"].sameTokenStatus=200;},
 "retained editor":e=>{e.ownerAfter.filePermissions[1].role="writer";},
 "identity replaced":e=>{e.identityAfter.identity.account.uniqueId="999999999999999999999";},
 "identity enabled":e=>{e.identityAfter.identity.account.disabled=false;},
 "leftover IAM":e=>{e.identityAfter.identity.policy.bindings=[{role:"roles/editor"}];},
 "runtime assignment":e=>{e.identityAfter.inventory[0].data.items=[{spec:{template:{spec:{serviceAccountName:e.identityBefore.account.email}}}}];},
 "incomplete inventory":e=>{e.identityAfter.inventory.pop();},
 "project role":e=>{e.identityBefore.projectPolicy.bindings=[{role:"roles/editor",members:["serviceAccount:"+e.identityBefore.account.email]}];e.identityAfter.identity.projectPolicy=structuredClone(e.identityBefore.projectPolicy);},
 "control drift":e=>{e.controlsAfter.controlsDigest=digest("changed");},
 "cleanup outside window":e=>{e.identityAfter.completedAt=new Date(1600001).toISOString();},
};
for(const [name,mutate]of Object.entries(invalid))test(`original evidence rejects ${name}`,()=>{
 const e=originalWriterEvidence(),pin=digest(e);mutate(e);
 assert.throws(()=>review(e,name==="review pin"?pin:digest(e),WORKBOOK));
});
test("historical success cannot hide current source, permission or control drift",()=>{
 for(const change of [i=>{i.fileAfter.data.version="999";},i=>{i.filePermissions.data.permissions[1].role="writer";},i=>{i.controls.jobs[0].data.state="ENABLED";}]){
  const input=withOriginalWriter(withWriter(fixture()));change(input);assert.throws(()=>prepare(input));
 }
});
test("manifest hash-binds original evidence and rejects missing digest or modified file",t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"original-evidence-"));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const input=withOriginalWriter(withWriter(fixture())),manifest={files:{}};
 for(const [key,value]of Object.entries(input)){
  if(key.startsWith("reviewed")&&key.endsWith("Digest")){manifest[key]=value;continue;}
  const file=path.join(root,key+".json"),bytes=JSON.stringify(value);fs.writeFileSync(file,bytes);
  manifest.files[key]={path:file,sha256:createHash("sha256").update(bytes).digest("hex")};
 }
 const file=path.join(root,"manifest.json");fs.writeFileSync(file,JSON.stringify(manifest));
 assert.deepEqual(loadManifest(file),input);
 delete manifest.reviewedOriginalWriterCheckDigest;fs.writeFileSync(file,JSON.stringify(manifest));assert.throws(()=>loadManifest(file));
 manifest.reviewedOriginalWriterCheckDigest=input.reviewedOriginalWriterCheckDigest;fs.writeFileSync(file,JSON.stringify(manifest));
 fs.appendFileSync(manifest.files.originalWriterCheck.path," ");assert.throws(()=>loadManifest(file));
});
