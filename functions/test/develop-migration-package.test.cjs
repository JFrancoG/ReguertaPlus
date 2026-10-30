"use strict";

const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const {spawnSync} = require("node:child_process");
const {createHash} = require("node:crypto");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {prepareDevelopMigrationPackage: prepare, loadManifest} = require("../scripts/prepare-develop-migration-package.cjs");
const {fixture} = require("./develop-migration-package-fixture.cjs");

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
