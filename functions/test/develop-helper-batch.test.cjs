"use strict";
const assert=require("node:assert/strict");
const {test}=require("node:test");
const {batchFixture}=require("./develop-helper-batch-fixture.cjs");
const {planBatch,assertHelperBatchTime}=require("../scripts/prepare-develop-helper-batch.cjs");
const {createShiftSheetsAdapter}=require("../lib/shift-sheets.js");
const {createShiftSheetsConfig}=require("../lib/shift-sheets-config.js");
const {assertShiftSheetsOwnerPreservation:preserved}=require("../lib/shift-sheets-owner-manifest.js");
const {FILE}=require("../scripts/develop-original-writer-provider.cjs");
const adapter=f=>createShiftSheetsAdapter({config:createShiftSheetsConfig({environment:"develop",workbooks:{develop:FILE}}),sheets:f.sheets});
const exact=plan=>async batch=>{assert.equal(batch.requestDigest,plan.requestDigest);assert.deepEqual(batch.requests,plan.requests);};
test("53 helper values and two markers roundtrip without changing names, dates, notes, formats or distant cells",async()=>{
  const f=batchFixture(),before=f.observe(),forward=await planBatch({...f,observation:before});
  assert.equal(forward.operation.operationId,`request-${f.reviewPackage.forward.operationId}`);
  assert.equal(forward.requests.length,55);assert.equal(f.sheets.mutations.length,0);
  const api=adapter(f);f.sheets.loseAcknowledgement=true;
  assert.equal((await api.reconcile({...forward.operation,authorizeMutation:exact(forward)})).kind,"verified");
  preserved({manifest:forward.preservation,after:f.sheets.state});
  assert.equal(f.sheets.mutations.length,1);
  assert.equal((await api.reconcile({...forward.operation,authorizeMutation:()=>assert.fail("must only inspect")})).kind,"verified");
  assert.equal(f.sheets.mutations.length,1);
  const inverse=await planBatch({...f,observation:f.observe(),direction:"inverse",forwardPlan:forward});
  assert.equal((await api.reconcile({...inverse.operation,authorizeMutation:exact(inverse)})).kind,"verified");
  preserved({manifest:inverse.preservation,after:f.sheets.state});
  const restored=structuredClone(f.sheets.state);restored.sheets.forEach(s=>{s.developerMetadata=[];});
  assert.deepEqual(restored,before.snapshot);assert.equal(f.sheets.mutations.length,2);
});
for(const defect of ["protected","formula","distant-drift","changed-plan"])
  test(`helper plan rejects ${defect} without submitting`,async()=>{
    const f=batchFixture(),forward=await planBatch({...f,observation:f.observe()}),api=adapter(f);
    if(defect==="protected")f.sheets.state.sheets[0].protectedRanges=[{range:{sheetId:f.sheets.state.sheets[0].properties.sheetId,startRowIndex:1,endRowIndex:2,startColumnIndex:5,endColumnIndex:6}}];
    if(defect==="formula")f.sheets.state.sheets[0].data[0].rowData[1].values[5].userEnteredValue={formulaValue:"=1"};
    if(defect==="changed-plan")f.reviewPackage.forward.sheets.cells[0].after={stringValue:"Unauthorised helper"};
    if(defect==="distant-drift") {
      await api.reconcile({...forward.operation,authorizeMutation:exact(forward)});
      f.sheets.state.sheets[0].data[0].rowData[150].values[0].note="Unexpected edit";
      await assert.rejects(planBatch({...f,observation:f.observe(),direction:"inverse",forwardPlan:forward}));
      assert.equal(f.sheets.mutations.length,1);
    } else {
      await assert.rejects(planBatch({...f,observation:f.observe()}));assert.equal(f.sheets.mutations.length,0);
    }
  });
test("unknown submission stops at inspection and never resubmits automatically",async()=>{
  const f=batchFixture(),plan=await planBatch({...f,observation:f.observe()});f.sheets.rejectBeforeApply=true;
  assert.equal((await adapter(f).reconcile({...plan.operation,authorizeMutation:exact(plan)})).kind,"ambiguous");
  assert.equal(f.sheets.mutations.length,1);assert.equal(f.sheets.revision,0);
});
test("expiry or cancellation after admission prevents the batch while retaining cleanup reserve",async()=>{
  for(const mode of ["token","window","cancel"]) {
    const f=batchFixture(),plan=await planBatch({...f,observation:f.observe()}),abort=new AbortController();let now=1000;
    const clock={tokenExpiresAtMillis:301000,windowEndsAtMillis:601000};
    assertHelperBatchTime({...clock,nowMillis:now});
    await assert.rejects(adapter(f).reconcile({...plan.operation,signal:abort.signal,
      authorizeMutation:async batch=>{await exact(plan)(batch);if(mode==="cancel")abort.abort();else now=clock[mode==="token"?"tokenExpiresAtMillis":"windowEndsAtMillis"]-150000;},
      assertSubmissionNow:()=>assertHelperBatchTime({...clock,nowMillis:now})}));
    assert.equal(f.sheets.mutations.length,0);
  }
});
