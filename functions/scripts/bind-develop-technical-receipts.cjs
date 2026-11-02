"use strict";

// Offline binding of reviewed facts to retained bytes. This does not review the
// meaning of a receipt or turn an inventory/disclosure into a provider fence.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const inventory=require("../lib/shift-planning-writer-inventory.js");
const {createShiftPlanningControlManifestDigest:manifest}=require("../lib/shift-planning-intake-barrier.js");
const {parseShiftPlanningDevelopCaptureControl:parseCapture,developCaptureControlDigest,DEVELOP_CAPTURE_CONTROL_REVISION}=require("../lib/shift-planning-develop-capture-control.js");
const human=[inventory.SHIFT_PLANNING_OWNER_AGREEMENT_OWNER_WRITER_ID,inventory.SHIFT_PLANNING_ADMINISTRATOR_AGREEMENT_WRITER_ID];
const sha=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");
function bindDevelopTechnicalReceipts({receipts,bindings,rules}) {
  const data=new Map(),pins=[];
  for(const r of receipts){assert.match(r.id,/^[A-Za-z0-9][A-Za-z0-9._-]+$/);assert.equal(data.has(r.id),false);assert.ok(path.isAbsolute(r.path));
    const bytes=fs.readFileSync(r.path);assert.equal(sha(bytes),r.sha256,"Retained receipt bytes changed");
    data.set(r.id,r.format==="json"?JSON.parse(bytes):null);pins.push(structuredClone(r));}
  const expected=inventory.SHIFT_PLANNING_ADMINISTRATOR_AGREEMENT_INTAKE_WRITERS.filter(w=>!human.includes(w.writerId));
  assert.deepEqual(bindings.map(b=>b.control.writerId).sort(),expected.map(w=>w.writerId).sort(),"Exactly 23 technical controls required");
  const controls=[],mapping=[];
  for(const b of bindings){const c=structuredClone(b.control),w=expected.find(w=>w.writerId===c.writerId);
    assert.ok(b.receiptIds.length>0&&new Set(b.receiptIds).size===b.receiptIds.length);b.receiptIds.forEach(id=>assert.ok(data.has(id),"Missing receipt"));
    assert.ok(b.receiptIds.includes(b.closure.receiptId));assert.ok(b.closure.pointer.length>0);
    let observed=data.get(b.closure.receiptId);for(const part of b.closure.pointer){assert.ok(Object.hasOwn(observed,part),"Missing receipt field");observed=observed[part];}
    const at=typeof observed==="string"?Date.parse(observed):observed;assert.ok(Number.isSafeInteger(at)&&at>=0);assert.equal(c.closedAtMillis,at,"Closure time is not the retained observation");
    assert.ok(["closure-readback","absence-observation","composite-observation"].includes(b.closure.meaning));
    if(c.state==="capture-only"){parseCapture(c.developCapture,c.writerId);assert.equal(c.controlRevision,DEVELOP_CAPTURE_CONTROL_REVISION);assert.equal(c.controlDigest,developCaptureControlDigest(c.developCapture));}
    else assert.equal(c.state,w.requiredState);
    assert.match(c.controlDigest,/^shift-planning:v1:sha256:[a-f0-9]{64}$/);
    for(const name of ["initial","final"]){assert.equal(c[name+"ReadBackAtMillis"],null);assert.equal(c[name+"ReadBackDigest"],c.controlDigest);assert.equal(c[name+"ReadBackRevision"],c.controlRevision);}
    // Initial state intentionally retains unknown prior work; acceptance must
    // later bind every predecessor rather than replacing it with an invented 0.
    assert.equal(c.pendingWorkCount,null);assert.equal(c.inFlightWorkCount,null);
    if(inventory.SHIFT_PLANNING_RULES_DENIED_WRITER_IDS.includes(c.writerId)){assert.equal(c.controlDigest,rules.deployedDigest);assert.equal(c.controlRevision,rules.deployedRevision);assert.equal(c.closedAtMillis,rules.closedAtMillis);}
    assert.ok(b.limitations.length>0);controls.push(c);mapping.push(structuredClone(b));
  }
  for(const name of ["initial","final"]){assert.equal(rules[name+"ReadBackAtMillis"],null);assert.equal(rules[name+"ReadBackDigest"],rules.deployedDigest);assert.equal(rules[name+"ReadBackRevision"],rules.deployedRevision);}
  const value={kind:"develop-retained-technical-receipts",schemaVersion:1,projectId:"reguerta-9f27f",environment:"develop",
    rules:structuredClone(rules),writerControls:controls.sort((a,b)=>a.writerId.localeCompare(b.writerId)),receipts:pins,mapping,
    technicalControlManifestDigest:manifest(controls,"develop-administrator-agreement"),
    predecessors:mapping.map(b=>({writerId:b.control.writerId,sourceDigest:b.sourceDigest,closureEvidenceDigest:digest({receiptIds:b.receiptIds.map(id=>pins.find(p=>p.id===id)),closure:b.closure}),closedAtMillis:b.control.closedAtMillis})),
    currentReadbacksCollected:false,canApply:false,canEnterMaintenance:false};
  value.predecessors.forEach(p=>assert.match(p.sourceDigest,/^shift-planning:v1:sha256:[a-f0-9]{64}$/));
  return {...value,bindingDigest:digest(value)};
}
module.exports={bindDevelopTechnicalReceipts};
if(require.main===module){console.error("offline_reviewed_receipts_required_no_apply_cli");process.exitCode=1;}
