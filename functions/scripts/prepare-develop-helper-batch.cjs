"use strict";

// Materialize the reviewed helper-only intent through the existing Sheets adapter.
// No HTTP client, permission grant, maintenance entry, or externally callable writer.
const assert=require("node:assert/strict");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {createShiftSheetsConfig}=require("../lib/shift-sheets-config.js");
const {createShiftSheetsAdapter,shiftSheetsGridRows,shiftSheetsCellValue}=require("../lib/shift-sheets.js");
const {shiftSheetsDateFromCell}=require("../lib/shift-sheets-human-layout.js");
const {createShiftSheetsOwnerPreservationManifest:preservation}=require("../lib/shift-sheets-owner-manifest.js");
const {prepareDevelopMigrationPackage}=require("./prepare-develop-migration-package.cjs");
const {reviewedRangeSnapshot,PRESERVATION_FIELDS}=require("./develop-google-observations.cjs");
const {FILE,TABS,snapshot}=require("./develop-original-writer-provider.cjs");

async function planBatch({sourceInput,reviewPackage,observation,direction="forward",forwardPlan=null}) {
  assert.deepEqual(prepareDevelopMigrationPackage(sourceInput),reviewPackage);
  assert.ok(["forward","inverse"].includes(direction));assert.equal(observation.fileId,FILE);
  assert.equal(observation.snapshotDigest,digest(observation.snapshot));
  assert.equal(observation.snapshot.spreadsheetId,FILE);
  assert.ok(observation.snapshot.sheets.every(s=>s.dataCoverage==="complete"));
  assert.deepEqual(observation.snapshot.sheets.map(s=>({id:s.properties.sheetId,title:s.properties.title})),TABS);
  assert.equal(observation.preservationFields,PRESERVATION_FIELDS);
  if(direction==="forward") {
    assert.equal(observation.after.file.version,reviewPackage.forward.sheets.observedVersion);
    assert.equal(snapshot(reviewedRangeSnapshot(observation.snapshot)).digest,snapshot(sourceInput.sheetCells).digest,"Reviewed cells drift");
  }
  else {
    assert.ok(forwardPlan);const {planDigest,...body}=forwardPlan;assert.equal(planDigest,digest(body));
    assert.equal(forwardPlan.reviewPackageDigest,reviewPackage.packageDigest);assert.equal(forwardPlan.direction,"forward");
    require("../lib/shift-sheets-owner-manifest.js").assertShiftSheetsOwnerPreservation({manifest:forwardPlan.preservation,after:observation.snapshot});
  }
  const intent=reviewPackage[direction].sheets,rows=[],humanRows=[];
  const config=createShiftSheetsConfig({environment:"develop",workbooks:{develop:FILE}});
  for(const cell of intent.cells) {
    const sheet=observation.snapshot.sheets.find(s=>s.properties.sheetId===cell.sheetId);assert.ok(sheet);
    const grid=shiftSheetsGridRows(sheet),row=grid[cell.rowNumber-1];assert.ok(row);
    const date=shiftSheetsDateFromCell(row[0]?.userEnteredValue?.stringValue??String(row[0]?.userEnteredValue?.numberValue??""));
    const matches=sourceInput.proposal.content.shifts.filter(s=>s.type==="delivery"&&s.date===date);
    assert.equal(matches.length,1,"Reviewed helper row date must identify one published shift");const shift=matches[0];
    assert.equal(cell.column,"F");assert.equal(cell.fields,"userEnteredValue");
    assert.deepEqual(shiftSheetsCellValue(row[5]),cell.before?.stringValue===""?{}:cell.before??{});
    const before=[{values:Array.from({length:6},(_,i)=>shiftSheetsCellValue(row[i]))}],after=structuredClone(before);
    after[0].values[5]=cell.after??{};
    rows.push({id:shift.id,type:shift.type,date:shift.date,rotationOwnerUserIds:shift.rotationOwnerUserIds,
      assignedUserIds:shift.assignedUserIds,helperUserId:direction==="forward"?shift.helperUserId:null,
      status:shift.status,source:"app",origin:"initial-migration"});
    humanRows.push({id:shift.id,sheetName:sheet.properties.title,sheetId:cell.sheetId,rowNumber:cell.rowNumber,
      assignedUserIds:shift.assignedUserIds,helper:{userId:rows.at(-1).helperUserId,name:cell.after?.stringValue??""},before,after});
  }
  assert.equal(rows.length,53);assert.equal(new Set(rows.map(r=>r.id)).size,53);
  // Match the already materialized Firestore terminal identity, including its forward prefix.
  const operation={operationId:direction==="forward"?`request-${reviewPackage.forward.operationId}`:reviewPackage.inverse.operationId,rows,humanRows};
  let binding=null;const stop=Error("planning-complete");
  const adapter=createShiftSheetsAdapter({config,sheets:{get:async()=>({data:structuredClone(observation.snapshot)}),
    batchUpdate:async()=>{throw Error("offline_planning_cannot_submit");}}});
  try {await adapter.reconcile({...operation,authorizeMutation:async value=>{binding=structuredClone(value);throw stop;}});}
  catch(error){if(error!==stop)throw error;}
  assert.ok(binding,"Existing operation requires read-only reconciliation");
  const updates=binding.requests.filter(r=>r.updateCells),markers=binding.requests.filter(r=>r.createDeveloperMetadata||r.updateDeveloperMetadata);
  assert.equal(updates.length,53);assert.equal(markers.length,2);assert.equal(binding.requests.length,55);
  const expected=new Map(intent.cells.map(c=>[`${c.sheetId}:${c.rowNumber-1}`,c.after??{}]));
  for(const {updateCells:u}of updates){
    assert.equal(u.fields,"userEnteredValue");assert.equal(u.range.startColumnIndex,5);assert.equal(u.range.endColumnIndex,6);
    assert.equal(u.range.endRowIndex,u.range.startRowIndex+1);assert.equal(u.rows.length,1);assert.equal(u.rows[0].values.length,1);
    const key=`${u.range.sheetId}:${u.range.startRowIndex}`;assert.ok(expected.has(key));
    assert.deepEqual(u.rows[0].values[0].userEnteredValue??{},expected.get(key));expected.delete(key);
  }
  assert.equal(expected.size,0);
  const value={kind:"develop-helper-batch-plan",direction,reviewPackageDigest:reviewPackage.packageDigest,
    observationDigest:observation.snapshotDigest,observedVersion:observation.after.file.version,operation,
    requestDigest:binding.requestDigest,requests:binding.requests,preservation:preservation({before:observation.snapshot,requests:binding.requests}),
    canApply:false,canEnterMaintenance:false};
  return {...value,planDigest:digest(value)};
}
// This is a time fence, never permission or maintenance authority. Recheck it
// immediately before the existing adapter submits; reserve its 30s request limit
// as well as the approved 120s cleanup allowance. No renewal or extension.
function assertHelperBatchTime({nowMillis,tokenExpiresAtMillis,windowEndsAtMillis}) {
  assert.ok([nowMillis,tokenExpiresAtMillis,windowEndsAtMillis].every(n=>Number.isSafeInteger(n)&&n>=0));
  assert.ok(nowMillis+150000<Math.min(tokenExpiresAtMillis,windowEndsAtMillis),"helper_batch_cleanup_budget_exhausted");
}
module.exports={planBatch,assertHelperBatchTime};
if(require.main===module){console.error("offline_helper_plan_only_no_apply_cli");process.exitCode=1;}
