"use strict";

const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const {spawnSync} = require("node:child_process");
const {createHash} = require("node:crypto");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {input: plannerInput} = require("./develop-planner-entry-fixture.cjs");
const {doc} = require("./develop-legacy-census-fixture.cjs");
const {inspectCensus} = require("../scripts/inspect-develop-legacy-census.cjs");
const {prepareDevelopMigrationPackage: prepare, loadManifest} = require("../scripts/prepare-develop-migration-package.cjs");
const WORKBOOK = "1O7VKs7S4wZHVvTfNBehAd5EzF3Mgw2q9LweK68Gm76A";
const OWNER = "testplusprojects@gmail.com";
const ROOT = "develop/plus-collections";

function fixture() {
  const base = plannerInput(), snapshot = base.census;
  for (const row of snapshot.collections.shifts) {
    // The current legacy payload postdates the retained event, with its own CAS version.
    row.updateTime = "2026-10-28T10:00:03.123456789Z";
    row.fields.source = {stringValue: "google_sheets"};
    row.fields.opaqueLegacyField = {mapValue: {fields: {precise: {timestampValue: "2025-01-01T00:00:00.123456789Z"},
      large: {integerValue: "9007199254740991"}, binary: {bytesValue: "AQID"}}}};
  }
  const stableSourceDigest = inspectCensus(snapshot).stableSetDigest;
  const proposal = base.contentProposal;
  proposal.content.workbookId = WORKBOOK;
  delete proposal.contentDigest; delete proposal.proposalDigest;
  const proposalDigest = digest(proposal), contentDigest = digest(proposal.content);
  Object.assign(proposal, {proposalDigest, contentDigest});
  const cohort = proposal.content.rotations.delivery.initialCursor.cohortUserIds;
  snapshot.collections.users = Array.from({length:48}, (_, i) => doc(`${ROOT}/users/${i < 32 ? cohort[i] : `inactive-${i}`}`,
    {isActive:i < 32, roles:["member"], isCommonPurchaseManager:false, displayName:`Example ${i}`}));
  for (const name of ["shiftPlanningState", "shiftCoverageReserves", "shiftCoverageCredits", "shiftMembershipState",
    "shiftPlanningSyncCommands", "shiftCoverageCases", "shiftCoverageEffects", "shiftSwapRequests"]) snapshot.collections[name] = [];
  snapshot.singletons = Object.fromEntries(["shiftPlanningState/current", "shiftPlanningState/sourcePolicy", "shiftPlanningState/sheetsSubmission",
    "shiftRotations/delivery", "shiftRotations/market"].map(key => [key,null]));
  snapshot.singletons["config/global"] = doc(`${ROOT}/config/global`, {version:1});
  const sheetCells = {spreadsheetId:WORKBOOK, sheets:[...new Set(proposal.content.helperProjectionDraft.map(c => c.tabTitle))].map((title,i) => ({
    properties:{sheetId:i,title},data:[{rowData:Array.from({length:60}, (_,r) => ({values:[{userEnteredValue:{stringValue:`Published ${r}`}}]}))}]}))};
  const owners = [{emailAddress:OWNER}];
  const file = {id:WORKBOOK,mimeType:"application/vnd.google-apps.spreadsheet",version:"278",parents:["root"],owners};
  const permission = (emailAddress,role) => ({type:"user",emailAddress,role});
  const permissions = [permission(OWNER,"owner"), ...["drpuerk@gmail.com", "195744802339-compute@developer.gserviceaccount.com",
    "firebase-adminsdk-2xhs2@reguerta-9f27f.iam.gserviceaccount.com", "reguerta-shifts-inspector@reguerta-9f27f.iam.gserviceaccount.com"].map(e => permission(e,"reader"))];
  const controls = {projectId:"reguerta-9f27f",readOnly:true,functions:base.observedFunctions.map(data => ({data})),
    jobs:Array.from({length:3}, () => ({observed:true,data:{state:"PAUSED"}})),rulesRelease:{observed:true,data:{}},
    ruleset:{observed:true,data:{}},projectIam:{observed:true,data:{}}};
  const indexes = {projectId:"reguerta-9f27f",databaseId:"(default)",readOnly:true,
    indexes:Array.from({length:6}, (_,i) => ({state:"READY",name:`projects/reguerta-9f27f/databases/(default)/collectionGroups/${i ? `example-${i}` : "shiftPlanningRequests"}/indexes/example`,
      fields:[{fieldPath:"requestedByUserId",order:"ASCENDING"},{fieldPath:"schemaVersion",order:"ASCENDING"},{fieldPath:"requestedAt",order:"DESCENDING"}]}))};
  return {snapshot,proposal,sheetCells,referenceCells:structuredClone(sheetCells),fileBefore:{data:structuredClone(file)},fileAfter:{data:file},
    filePermissions:{fileId:WORKBOOK,data:{permissions}},parent:{data:{id:"root",name:"Mi unidad",mimeType:"application/vnd.google-apps.folder",owners}},
    parentPermissions:{fileId:"root",data:{permissions:[permission(OWNER,"owner")]}},indexes,controls,reviewedControls:structuredClone(controls),
    assessment:{canEnterMaintenance:false,canApply:false,stableSourceDigest,workbook:{numericRevision:"278"}},
    reviewedContentDigest:contentDigest,reviewedProposalDigest:proposalDigest};
}

test("review packet preserves every legacy value and published position without admitting execution", () => {
  const input = fixture(), before = structuredClone(input), result = prepare(input);
  assert.deepEqual(input,before);
  assert.deepEqual(prepare(input),result);
  for (const original of input.snapshot.collections.shifts) {
    const restore = result.inverse.publicWrites.find(w => w.targetPath === original.name.split("/documents/")[1]);
    assert.equal(restore.kind,"create"); assert.deepEqual(restore.fields,original.fields);
    assert.equal(result.forward.archives.find(w => w.targetPath === restore.targetPath).expectedUpdateTime,original.updateTime);
  }
  assert.deepEqual(result.forward.publicWrites.filter(w => w.kind === "create").map(w => w.semanticPayload),input.proposal.content.shifts);
  assert.equal(result.forward.observedNoticesToPreserve.length,117);
  assert.equal(result.forward.sheets.cells.length,53);
  result.forward.sheets.cells.forEach((cell,i) => {
    assert.deepEqual(result.inverse.sheets.cells[i].after,cell.before);
    assert.deepEqual(result.inverse.sheets.cells[i].before,cell.after);
  });
  assert.equal(result.inverse.forwardDigest,result.forwardDigest);
  for (const key of ["liveExecutable","canApply","canEnterMaintenance","annualPlanningReady"]) assert.equal(result[key],false);
  for (const key of ["operationRiskAcceptance","window"]) assert.equal(result[key],null);
  assert.equal(result.sourcePolicy.runtimeDocument,null); assert.equal(result.inverse.requiredForwardReceipt,null);
  assert.equal(result.inverse.controlRecovery.writeEpoch,2); assert.equal(result.inverse.controlRecovery.restoreAbsentSecurityState,false);
});

test("unordered provider filters do not change reviewed code/configuration equality", () => {
  const input = fixture();
  input.controls.functions.reverse();
  input.controls.functions.forEach(row => row.data.eventTrigger.eventFilters.reverse());
  assert.equal(prepare(input).canApply,false);
});

const invalid = {
  "production legacy path": x => {x.snapshot.collections.shifts[0].name = x.snapshot.collections.shifts[0].name.replace("/develop/","/production/");},
  "changed proposal despite valid self hashes": x => {
    x.proposal.content.shifts[0].date = "2026-09-09";
    const {contentDigest:ignored,proposalDigest:ignored2,...body} = x.proposal;
    void ignored; void ignored2;
    x.proposal.contentDigest=digest(body.content);x.proposal.proposalDigest=digest(body);
  },
  "changed source version": x => {x.snapshot.collections.shifts[1].updateTime = "2026-10-30T10:00:00.111111111Z";},
  "uninspected parent": x => {x.parent.data.parents=["another-root"];},
  "additional writer": x => {x.filePermissions.data.permissions[1].role="writer";},
  "incomplete permissions page": x => {x.filePermissions.data.nextPageToken="more";},
  "changed workbook version": x => {x.fileAfter.data.version="279";},
  "changed note": x => {x.sheetCells.sheets[0].data[0].rowData[0].values[0].note="late edit";},
  "occupied helper cell": x => {
    for (const book of [x.sheetCells,x.referenceCells]) book.sheets[0].data[0].rowData[1].values = [ {},{},{},{},{},{userEnteredValue:{numberValue:0}} ];
  },
  "changed eligible cohort": x => {x.snapshot.collections.users[0].fields.isActive.booleanValue=false;},
  "existing source authority": x => {x.snapshot.singletons["shiftPlanningState/sourcePolicy"]={exists:true};},
  "pending sync command": x => {x.snapshot.collections.shiftPlanningSyncCommands.push({pending:true});},
  "function revision drift": x => {x.controls.functions[0].data.serviceConfig.revision="new-revision";},
  "running scheduler": x => {x.controls.jobs[0].data.state="ENABLED";},
  "index still building": x => {x.indexes.indexes[0].state="CREATING";},
  "assessment claims maintenance admission": x => {x.assessment.canEnterMaintenance=true;},
};
for (const [name, mutate] of Object.entries(invalid)) test(`rejects ${name}`, () => {
  const input = fixture(); mutate(input); assert.throws(() => prepare(input));
});

test("manifest pins file bytes; CLI never overwrites a packet or accepts an apply option", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),"hu084-review-"));
  try {
    const input = fixture(), manifest = {files:{},reviewedContentDigest:input.reviewedContentDigest,reviewedProposalDigest:input.reviewedProposalDigest};
    for (const [key,value] of Object.entries(input).filter(([key]) => !key.startsWith("reviewed") || key === "reviewedControls")) {
      const target = path.join(directory,`${key}.json`), bytes = JSON.stringify(value);
      fs.writeFileSync(target,bytes);manifest.files[key]={path:target,sha256:createHash("sha256").update(bytes).digest("hex")};
    }
    const filename = path.join(directory,"manifest.json"), output = path.join(directory,"packet.json");
    fs.writeFileSync(filename,JSON.stringify(manifest));
    assert.deepEqual(loadManifest(filename),input);
    const script = path.resolve(__dirname,"../scripts/prepare-develop-migration-package.cjs");
    const run = args => spawnSync(process.execPath,[script,...args],{encoding:"utf8"});
    const args = ["--input",filename,"--output",output];
    assert.equal(run(args).status,0);const saved = fs.readFileSync(output,"utf8");
    assert.equal(fs.statSync(output).mode & 0o777,0o600);
    assert.equal(run(args).status,1);assert.equal(fs.readFileSync(output,"utf8"),saved);
    assert.equal(run([...args,"--apply"]).status,1);
    fs.appendFileSync(manifest.files.snapshot.path," ");assert.throws(() => loadManifest(filename),/file changed/);
  } finally {fs.rmSync(directory,{recursive:true,force:true});}
});
