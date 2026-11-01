"use strict";
const assert=require('node:assert/strict'),{test}=require('node:test');
const {createShiftPlanningDigest:digest}=require('../lib/shift-planning-digest.js');
const {historicalIamPreparation,reviewIamPreparation,reviewIamPreparationDigest,reviewHelperExecutionDigest}=require('../scripts/develop-historical-source-compatibility.cjs');
const {prepare}=require('../scripts/prepare-develop-writer-rehearsal.cjs');
const {writerEvidence,WORKBOOK}=require('./develop-writer-evidence-fixture.cjs');
const {originalWriterEvidence}=require('./develop-original-writer-evidence-fixture.cjs');
const {reviewWriterRehearsal}=require('../scripts/develop-writer-rehearsal-evidence.cjs');
const {reviewOriginalWriterCheck}=require('../scripts/develop-original-writer-evidence.cjs');

test('reviewed source transition retains historical preparation unchanged and never matches arbitrary code',()=>{
 const old=historicalIamPreparation(),saved=structuredClone(old);
 assert.equal(reviewIamPreparation(old),'historical-eae86a89-validator-transition');assert.deepEqual(old,saved);
 assert.equal(reviewIamPreparationDigest(old.preparationDigest),'historical-eae86a89-validator-transition');
 assert.equal(reviewIamPreparation(prepare()),'exact-reviewed-sources');
 for(const key of ['runnerSourceDigest','providerSourceDigest','controllerSourceDigest','planDigest']){
  const changed=structuredClone(old);changed[key]=digest('different');const {preparationDigest,...body}=changed;void preparationDigest;changed.preparationDigest=digest(body);
  assert.throws(()=>reviewIamPreparation(changed));
 }
 assert.throws(()=>historicalIamPreparation({...prepare(),runnerSourceDigest:digest('future backend')}));
 assert.throws(()=>reviewHelperExecutionDigest(digest('unknown old'),digest('unknown new')));
});
test('older original-file proof remains historical without changing its operation or receipts',()=>{
 const e=originalWriterEvidence();e.preparation.reusedIamPreparationDigest=historicalIamPreparation().preparationDigest;
 const {preparationDigest,...body}=e.preparation;void preparationDigest;e.preparation.preparationDigest=digest(body);e.approval.preparationDigest=digest(body);
 const saved=structuredClone(e),r=reviewOriginalWriterCheck(e,digest(e),WORKBOOK);
 assert.deepEqual(e,saved);assert.equal(r.sourceCompatibility,'historical-eae86a89-validator-transition');
 assert.equal(r.currentWriterAuthorityVerified,false);assert.equal(r.canEnterMaintenance,false);
});

test('ten-row evidence remains historical with the same original receipts',()=>{
 const e=writerEvidence();e.preparation=historicalIamPreparation();e.input.approval.preparationDigest=e.preparation.preparationDigest;
 const saved=structuredClone(e),r=reviewWriterRehearsal(e,digest(e),WORKBOOK);
 assert.deepEqual(e,saved);assert.equal(r.sourceCompatibility,'historical-eae86a89-validator-transition');
 assert.equal(r.currentControlsVerified,false);assert.equal(r.canEnterMaintenance,false);
});
