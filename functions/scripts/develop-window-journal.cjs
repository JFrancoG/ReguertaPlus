"use strict";

// Local evidence, not credentials or execution authority. Each immutable entry
// is fsynced before publication, then the directory is fsynced as well.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const active=new Set();
const id=value=>assert.match(value,/^[A-Za-z0-9_-]{6,100}$/);
function safe(value) {
  const bytes=JSON.stringify(value);assert.ok(bytes&&Buffer.byteLength(bytes)<=16*1024*1024,"bounded JSON evidence required");
  JSON.parse(bytes,(key,v)=>{assert.ok(!/^(access_?token|refresh_?token|bearer|authorization|client_?secret|private_?key)$/i.test(key),"credentials cannot enter evidence");return v;});
  return JSON.parse(bytes);
}
function syncDirectory(dir){const fd=fs.openSync(dir,"r");try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
function publish(dir,name,value) {
  const temporary=path.join(dir,name+".pending"),target=path.join(dir,name);
  const fd=fs.openSync(temporary,"wx",0o600);
  try{fs.writeFileSync(fd,JSON.stringify(safe(value)));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  // link never replaces an existing receipt; a crash may leave .pending behind.
  fs.linkSync(temporary,target);syncDirectory(dir);fs.unlinkSync(temporary);syncDirectory(dir);
}
function holdRoot(root,receiptId,existing=false) {
  const lock=path.join(root,"controlled-window-active");
  if(existing&&fs.existsSync(lock)) {
    const owner=JSON.parse(fs.readFileSync(path.join(lock,"owner.json"),"utf8"));
    assert.equal(owner.receiptId,receiptId,"another window owns cleanup");return lock;
  }
  fs.mkdirSync(lock,{mode:0o700});publish(lock,"owner.json",{receiptId,processId:process.pid});syncDirectory(root);return lock;
}
function releaseRoot(directory) {
  const root=path.dirname(directory),lock=path.join(root,"controlled-window-active");
  const owner=JSON.parse(fs.readFileSync(path.join(lock,"owner.json"),"utf8"));assert.equal(owner.receiptId,path.basename(directory));
  fs.unlinkSync(path.join(lock,"owner.json"));fs.rmdirSync(lock);syncDirectory(root);
}
function readWindowJournal(directory) {
  assert.ok(path.isAbsolute(directory));assert.ok(!fs.lstatSync(directory).isSymbolicLink());
  const names=fs.readdirSync(directory),files=names.filter(n=>/^\d{6}\.json$/.test(n)).sort();
  assert.ok(files.length>0&&files.length<=1000,"bounded journal required");
  let previous=null,totalBytes=0;const records=files.map((name,index)=>{
    assert.equal(name,String(index).padStart(6,"0")+".json","journal sequence missing");
    const file=path.join(directory,name);assert.ok(!fs.lstatSync(file).isSymbolicLink());
    const size=fs.statSync(file).size;totalBytes+=size;assert.ok(size<=16*1024*1024&&totalBytes<=64*1024*1024);const value=JSON.parse(fs.readFileSync(file,"utf8"));
    const {entryDigest,...body}=value;assert.equal(body.sequence,index);assert.equal(body.previousDigest,previous);
    assert.equal(entryDigest,digest(body),"journal digest differs");previous=entryDigest;return value;
  });
  assert.equal(records[0].value.phase,"window-binding");
  return {directory,binding:records[0].value.binding,records,headDigest:previous,
    pendingFiles:names.filter(n=>n.endsWith(".pending")),canResumeExecution:false,canEnterMaintenance:false};
}
function writer(directory) {
  let snapshot=readWindowJournal(directory);
  return {directory,read:()=>readWindowJournal(directory),append(value){
    const current=readWindowJournal(directory);assert.equal(current.headDigest,snapshot.headDigest,"concurrent journal change");
    const body={sequence:current.records.length,previousDigest:current.headDigest,value:safe(value)};
    publish(directory,String(body.sequence).padStart(6,"0")+".json",{...body,entryDigest:digest(body)});
    snapshot=readWindowJournal(directory);
  },release({cleanupVerified=false}={}){active.delete(directory);if(cleanupVerified)releaseRoot(directory);}};
}
function createWindowJournal({root,receiptId,binding}) {
  assert.ok(path.isAbsolute(root));id(receiptId);fs.mkdirSync(root,{recursive:true,mode:0o700});
  const directory=path.join(root,receiptId);
  // Reserve the shared cleanup owner before creating a per-attempt journal.
  assert.ok(!fs.existsSync(directory),"window receipt already consumed");
  holdRoot(root,receiptId);fs.mkdirSync(directory,{mode:0o700});syncDirectory(root);
  const body={sequence:0,previousDigest:null,value:{phase:"window-binding",binding:safe(binding),processId:process.pid}};
  publish(directory,"000000.json",{...body,entryDigest:digest(body)});active.add(directory);
  return writer(directory);
}
function claimWindowRecovery({directory,recoveryId,expectedBindingDigest}) {
  id(recoveryId);const saved=readWindowJournal(directory);
  assert.equal(digest(saved.binding),expectedBindingDigest,"recovery binding differs");
  assert.ok(!saved.records.some(r=>r.value.phase==="recovery-claim"&&r.value.recoveryId===recoveryId),"recovery receipt already consumed");
  assert.ok(!active.has(directory),"window still active");
  const last=saved.records.at(-1).value;
  const owner=saved.records.findLast(r=>r.value.phase==="recovery-claim")?.value.processId??saved.records[0].value.processId;
  assert.ok(Number.isSafeInteger(owner)&&owner>0);
  // An external process may still be releasing its root fence after publishing
  // a terminal. Only this process's settled, inactive call is safe while alive.
  if(owner!==process.pid||last.providerCallsSettled!==true) {
    let dead=false;try{process.kill(owner,0);}catch(error){if(error.code==="ESRCH")dead=true;else throw error;}
    assert.ok(dead,"previous process has not stopped");
  }
  // Recovery contention fails closed. A crashed recovery lock is deliberately
  // not reclaimed automatically: its owner/liveness needs separate inspection.
  const lock=path.join(directory,"recovery.lock");fs.mkdirSync(lock,{mode:0o700});syncDirectory(directory);
  try{holdRoot(path.dirname(directory),path.basename(directory),true);}catch(error){fs.rmdirSync(lock);throw error;}
  active.add(directory);const journal=writer(directory);
  try{journal.append({phase:"recovery-claim",recoveryId,processId:process.pid});}
  catch(error){journal.release();throw error;}
  return {...journal,release(options){journal.release(options);fs.rmdirSync(lock);syncDirectory(directory);}};
}
module.exports={createWindowJournal,readWindowJournal,claimWindowRecovery};
