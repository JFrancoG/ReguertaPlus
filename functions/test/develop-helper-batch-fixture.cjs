"use strict";
const {fixture}=require("./develop-migration-package-fixture.cjs");
const {withWriter}=require("./develop-writer-evidence-fixture.cjs");
const {withOriginalWriter}=require("./develop-original-writer-evidence-fixture.cjs");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {FILE,TABS}=require("../scripts/develop-original-writer-provider.cjs");
const {normalizePreservationSnapshot,reviewedRangeSnapshot,PRESERVATION_FIELDS}=require("../scripts/develop-google-observations.cjs");
const {prepareDevelopMigrationPackage}=require("../scripts/prepare-develop-migration-package.cjs");
const {sheetsService}=require("./shift-sheets-api-fixture.cjs");
function batchFixture() {
  const sourceInput=withOriginalWriter(withWriter(fixture({timestampNanoseconds:"123456000"})));
  const delivery=sourceInput.proposal.content.shifts.filter(s=>s.type==="delivery");
  const raw={spreadsheetId:FILE,properties:{locale:"es_ES"},sheets:TABS.map((t,index)=>({
    properties:{sheetId:t.id,title:t.title,index,sheetType:"GRID",gridProperties:{rowCount:1000,columnCount:26}},
    data:[{rowData:[{values:["Fecha","Persona","Teléfono","Notas","Cambio","Ayuda"].map(stringValue=>({userEnteredValue:{stringValue}}))}]}],
  }))};
  sourceInput.proposal.content.helperProjectionDraft.forEach((cell,i)=>{
    const sheet=raw.sheets.find(s=>s.properties.title===cell.tabTitle),date=delivery[i].date.split("-").reverse().join("/");
    sheet.data[0].rowData[cell.rowNumber-1]={values:[date,"Published member","Preserved phone","","",""]
      .map(stringValue=>({userEnteredValue:{stringValue}}))};
    sheet.data[0].rowData[cell.rowNumber-1].values[5]={note:"Preserved helper note",userEnteredFormat:{textFormat:{bold:true}}};
  });
  // Preserve unrelated cells well outside the former A1:Z100 observation.
  raw.sheets[0].data[0].rowData[150]={values:[{userEnteredValue:{formulaValue:"=1+1"},note:"Outside managed rows"}]};
  for(const sheet of raw.sheets)sheet.data[0].rowData=Array.from(sheet.data[0].rowData,r=>r??{values:[]});
  const image=normalizePreservationSnapshot(raw);
  sourceInput.sheetCells=reviewedRangeSnapshot(image);sourceInput.referenceCells=structuredClone(sourceInput.sheetCells);
  const reviewPackage=prepareDevelopMigrationPackage(sourceInput),sheets=sheetsService(FILE);sheets.state=structuredClone(image);
  const observe=()=>({fileId:FILE,snapshot:structuredClone(sheets.state),snapshotDigest:digest(sheets.state),
    preservationFields:PRESERVATION_FIELDS,after:{file:{version:sourceInput.fileAfter.data.version}}});
  return {sourceInput,reviewPackage,sheets,observe};
}
module.exports={batchFixture};
