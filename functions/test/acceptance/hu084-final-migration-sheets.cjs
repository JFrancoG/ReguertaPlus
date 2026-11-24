"use strict";

// Private opt-in acceptance: only the existing in-memory Sheets API is used.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {test}=require("node:test");
const {createCapturedMigrationSheetsFixture}=require("./hu084-develop-migration-sheets.cjs");
const {loadManifest,prepareDevelopMigrationPackage,literalCells}=require("../../scripts/prepare-develop-migration-package.cjs");
const {createShiftPlanningDigest:digest}=require("../../lib/shift-planning-digest.js");
const enabled=Boolean(process.env.HU084_REVIEW_MANIFEST);
const cellImage = state => {
  const snapshot=structuredClone(state);
  // The API double can leave sparse empty cells when extending a short row.
  for(const sheet of snapshot.sheets)for(const block of sheet.data??[])for(const row of block.rowData??[])
    row.values=Array.from(row.values??[],cell=>cell??{});
  return literalCells(snapshot);
};
test("final Sheets batches bind the reviewed 53 literals and restore all 742 observed cells/notes",{skip:!enabled},async()=>{
  const input=loadManifest(process.env.HU084_REVIEW_MANIFEST),review=prepareDevelopMigrationPackage(input);
  const directory=process.env.HU084_FINAL_OUTPUT;assert.ok(path.isAbsolute(directory));
  const prepared=JSON.parse(fs.readFileSync(path.join(directory,"prepared.json")));
  assert.equal(prepared.reviewPackageDigest,review.packageDigest);
  const f=await createCapturedMigrationSheetsFixture(process.env.HU084_MIGRATION_EVIDENCE_DIR);
  assert.equal(f.evidence.proposal.contentDigest,input.proposal.contentDigest);
  f.sheets.state=structuredClone(input.sheetCells);f.sheets.revision=Number(input.fileAfter.data.version);
  f.forward.operationId=prepared.operationId;f.inverse.operationId=prepared.recoveryOperationId;
  const original=literalCells(f.sheets.state),manifests={};
  for(const direction of ["forward","inverse"]){
    const receipt=JSON.parse(fs.readFileSync(path.join(directory,direction==="forward"?"forwardReceipt.json":"inverseReceipt.json")));
    assert.equal(receipt.preparedDigest,prepared.preparedDigest);assert.equal(receipt.direction,direction);
    let batch;
    await assert.rejects(f.adapter.reconcile({...f[direction],authorizeMutation:async value=>{
      batch=structuredClone(value);throw new Error("local materialization only");
    }}),/local materialization only/);
    assert.equal(f.sheets.mutations.length,direction==="forward"?0:1);
    const cells=batch.requests.filter(r=>r.updateCells);assert.equal(cells.length,53);assert.equal(batch.requests.length,55);
    const expected=review[direction].sheets.cells;
    for(const cell of cells){const r=cell.updateCells,range=r.range;
      assert.equal(r.fields,"userEnteredValue");assert.equal(range.startColumnIndex,5);assert.equal(range.endColumnIndex,6);
      assert.equal(range.endRowIndex,range.startRowIndex+1);
      const target=expected.find(c=>c.sheetId===range.sheetId&&c.rowNumber===range.startRowIndex+1);assert.ok(target);
      assert.deepEqual(r.rows[0].values[0].userEnteredValue??null,target.after);
    }
    const body={schemaVersion:1,scope:"in_memory_Sheets_only",liveExecutable:false,direction,
      reviewPackageDigest:review.packageDigest,preparedDigest:prepared.preparedDigest,firestoreReceiptDigest:receipt.receiptDigest,
      workbookVersionAuthority:"local_counter_seeded_from_retained_278",beforeLocalVersion:String(f.sheets.revision),batch};
    manifests[direction]={...body,manifestDigest:digest(body)};
    assert.equal((await f.adapter.reconcile({...f[direction],authorizeMutation:async value=>assert.deepEqual(value,batch)})).kind,"verified");
    const after=cellImage(f.sheets.state),allowed=new Set(expected.map(c=>`${c.sheetId}:${c.rowNumber-1}:5`));
    for(const key of new Set([...Object.keys(original),...Object.keys(after)]))if(!allowed.has(key))assert.deepEqual(after[key],original[key]);
  }
  assert.deepEqual(cellImage(f.sheets.state),original);assert.equal(Object.keys(original).length,742);
  const body={reviewPackageDigest:review.packageDigest,manifests,restoredCellsAndNotes:742,helperCells:53,
    externalCalls:0,liveExecutable:false,limitations:["Local metadata IDs and version counter are not live Drive authority.",
      "Observed literals/notes only; unobserved formatting and grids are not certified.","No cross-service atomicity or live writer authorization."]};
  fs.writeFileSync(path.join(directory,"sheets-final-manifests.json"),JSON.stringify({...body,digest:digest(body)},null,2),{mode:0o600,flag:"wx"});
});
