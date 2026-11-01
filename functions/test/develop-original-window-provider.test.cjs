"use strict";
const assert=require("node:assert/strict");
const {test}=require("node:test");
const {originalWindowFixture}=require("./develop-original-window-fixture.cjs");
const {createOriginalWindowOwner,openOriginalWindowWriter,planOriginalWindowBatch}=require("../scripts/develop-original-window-provider.cjs");
const {FILE,PERMISSION,WRITER}=require("../scripts/develop-original-writer-provider.cjs");
const {createCopyTimeBudget}=require("../scripts/develop-copy-time-budget.cjs");
const {planBatch}=require("../scripts/prepare-develop-helper-batch.cjs");
async function transition(){
  const f=originalWindowFixture(),budget=createCopyTimeBudget({...f.args().window,nowMillis:()=>f.state.now,fetchImpl:f.fetchImpl});
  const owner=createOriginalWindowOwner({ownerBearer:"fixture-owner-test",fetchImpl:budget.fetch,nowMillis:()=>f.state.now});
  const before=await owner.capture(false);await f.ownerChannel.grant({fileId:FILE,permissionId:PERMISSION});const after=await owner.capture(true);
  return {f,before,after};
}
for(const drift of ["cells","foreign-reader","inherited-writer","wrong-version","wrong-file"])
 test(`owned permission transition rejects ${drift} instead of widening the original plan`,async()=>{
  const {f,before,after}=await transition(),observation=structuredClone(after);
  if(drift==="cells")after.snapshot.sheets[0].data[0].rowData[0].values[0].note="changed";
  if(drift==="foreign-reader")after.after.filePermissions.find(p=>p.role==="reader").emailAddress="foreign@example.test";
  if(drift==="inherited-writer")after.after.filePermissions.find(p=>p.emailAddress===WRITER).permissionDetails=[{inherited:true}];
  if(drift==="wrong-version")observation.after.file.version="999999";
  if(drift==="wrong-file")after.fileId="foreign-file";
  await assert.rejects(planOriginalWindowBatch({sourceInput:f.batch.sourceInput,reviewPackage:f.batch.reviewPackage,observation,
    direction:"forward",permissionTransition:{before,after}}));assert.equal(f.batch.sheets.mutations.length,0);
 });
test("original transport rejects another destination and consumes a simultaneous or uncertain batch only once",async()=>{
  const f=originalWindowFixture(),plan=await planBatch({...f.batch,observation:f.batch.observe()});let release,calls=0;
  const pending=new Promise(resolve=>{release=resolve;});
  const writer=openOriginalWindowWriter({bearer:"fixture-writer",expiresAtMillis:301000,nowMillis:()=>1000,assertSubmission:()=>{},
    authorizeBatch:async body=>{assert.deepEqual(body.requests,plan.requests);await pending;},fetchImpl:async()=>{calls++;throw Error("lost");}});
  await assert.rejects(writer.sheets.batchUpdate({spreadsheetId:"foreign-file",requestBody:{requests:plan.requests}},{retry:false}));assert.equal(calls,0);
  const first=writer.sheets.batchUpdate({spreadsheetId:FILE,requestBody:{requests:plan.requests}},{retry:false});
  await assert.rejects(writer.sheets.batchUpdate({spreadsheetId:FILE,requestBody:{requests:plan.requests}},{retry:false}),/already attempted/);
  release();await assert.rejects(first,/uncertain/);assert.equal(calls,1);writer.close();await assert.rejects(writer.probe());
});
