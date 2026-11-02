"use strict";
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {bindDevelopTechnicalReceipts:bind}=require('../scripts/bind-develop-technical-receipts.cjs');
const {historicalFixture}=require('./develop-historical-risk-fixture.cjs');
const {createShiftPlanningDigest:digest}=require('../lib/shift-planning-digest.js');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'technical-receipts-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const p=historicalFixture().evidence.payload,rules=structuredClone(p.rules);rules.initialReadBackAtMillis=rules.finalReadBackAtMillis=null;
 const closures=Object.fromEntries(p.writerControls.filter(c=>c.state!=='agreement-recorded').map(c=>[c.writerId,c.closedAtMillis]));
 const file=path.join(root,'receipt.json');fs.writeFileSync(file,JSON.stringify({closures}));
 const receipt={id:'retained-receipt',path:file,format:'json',sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
 const bindings=p.writerControls.filter(c=>c.state!=='agreement-recorded').map(c=>({control:{...c,initialReadBackAtMillis:null,finalReadBackAtMillis:null,pendingWorkCount:null,inFlightWorkCount:null},receiptIds:[receipt.id],closure:{receiptId:receipt.id,pointer:['closures',c.writerId],meaning:'closure-readback'},sourceDigest:digest({source:c.writerId}),limitations:['synthetic retained receipt, not fresh authority']}));
 return {file,args:{receipts:[receipt],bindings,rules}};
}
test('23 exact technical controls retain unknown work without admission',t=>{const {args}=fixture(t),r=bind(args);assert.equal(r.writerControls.length,23);assert.equal(r.predecessors.length,23);assert.equal(r.canApply,false);assert.equal(r.currentReadbacksCollected,false);});
for(const kind of ['bytes','missing-control','missing-receipt','wrong-time','zero-work','wrong-rule','capture-drift'])test(`receipt binding rejects ${kind}`,t=>{
 const {args,file}=fixture(t);
 if(kind==='bytes')fs.appendFileSync(file,' ');
 if(kind==='missing-control')args.bindings.pop();
 if(kind==='missing-receipt')args.bindings[0].receiptIds=['other'];
 if(kind==='wrong-time')args.bindings[0].control.closedAtMillis++;
 if(kind==='zero-work')args.bindings[0].control.pendingWorkCount=0;
 if(kind==='wrong-rule')args.rules.deployedDigest=digest('different');
 if(kind==='capture-drift')args.bindings.find(b=>b.control.developCapture).control.developCapture.shared.sourceGeneration='999999';
 assert.throws(()=>bind(args));
});
