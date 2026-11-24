"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {createNativeOwnerChannel}=require("../scripts/develop-native-owner-channel.cjs");
const {createOriginalWindowOwner}=require("../scripts/develop-original-window-provider.cjs");
const {FILE,OWNER,WRITER,PERMISSION}=require("../scripts/develop-original-writer-provider.cjs");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {originalWindowFixture}=require("./develop-original-window-fixture.cjs");
function fixture(){
  const f=originalWindowFixture(),p={fileId:FILE,permissionId:PERMISSION,type:"user",role:"writer",emailAddress:WRITER};
  const review={kind:"native-drive-owner-sharing",permission:p,owner:OWNER};
  const ui={stage:"list",typed:false,notify:true,clicks:[],records:[],expire:false,lost:false,wrongFile:false,wrongRole:false,authorized:true,duplicate:false,grantDelayReads:0,presses:0,sleeps:0};
  const tab={async getAXState(){
    const start=`0 AXWebArea drive.google.com/drivesharing/driveshare?id=${ui.wrongFile?"wrong":FILE}&hl=es\n 1 text Compartir "Regüerta — DEVELOP — Turnos de prueba"\n`;
    if(ui.pendingReopen>0){ui.pendingReopen--;return "0 AXWebArea Drive\n 1 text Loading";}
    if(ui.pendingGrant>0){ui.pendingGrant--;return start+" 8 text Applying permission";}
    if(ui.pendingDismiss>0){ui.pendingDismiss--;return start+" 8 text Closing dialog";}
    if(ui.pendingRemoval>0){ui.pendingRemoval--;return start+" 8 text Guardando";}
    if(ui.stage==="closed")return `0 AXWebArea Drive\n 1 row (selected) Regüerta — DEVELOP — Turnos de prueba Hojas de cálculo de Google file\n 2 Cuenta de Google: Plus Projects Test (${OWNER})\n 13 button Compartir archivo`;
    if(ui.stage==="list")return start+` 14 button Hecho\n 2 text ${OWNER}. Propietario.\n 3 combo box (settable) Description: Añadir personas, grupos y eventos de calendario${ui.typed?`, Value: ${WRITER}`:""}\n`+
      (f.state.permission?` 4 ${WRITER} ${WRITER}. Editor. Cambiar permiso\n   5 pop up button (collapsed) Description: Editor. Cambiar permiso`:"");
    if(ui.stage==="menu")return start+" 6 Quitar acceso";
    if(ui.stage==="remove")return start+" 7 button Guardar";
    if(ui.grantDelayReads>0){ui.grantDelayReads--;return start+" 8 text Loading sharing form";}
    return start+` 8 row Quitar a ${WRITER}, ID: recipient\n 9 pop up button (collapsed) Description: ${ui.wrongRole?"Lector":"Editor"}. Cambiar permiso\n 10 checkbox (settable) Description: Notificar a los usuarios, Value: ${ui.notify?1:0}\n 11 button ${ui.notify?"Enviar":"Compartir"}`+(ui.duplicate?"\n 12 button Compartir":"");
  },async typeText(id,text){assert.equal(id,3);assert.equal(text,WRITER);ui.typed=true;},async pressKey(id,key){assert.equal(id,3);assert.equal(key,"Return");ui.presses++;ui.stage="grant";},
  async click(id){ui.clicks.push(id);if(id===14){if(!ui.closeFault)ui.stage="closed";ui.pendingDismiss=ui.dismissDelayReads??0;return;}if(id===13){ui.stage="list";ui.pendingReopen=ui.reopenDelayReads??0;return;}if(id===10){ui.notify=false;return;}if(id===5){ui.stage="menu";return;}if(id===6){ui.stage="remove";return;}
    assert.ok([7,11].includes(id));f.state.permission=id===11;f.state.version++;ui.stage=ui.autoDismiss?"closed":"list";ui.typed=false;
    if(id===11){ui.pendingGrant=ui.afterGrantDelayReads??0;if(ui.expireAfterGrant)f.state.now+=100000;}
    if(id===7){ui.pendingRemoval=ui.afterRemovalDelayReads??0;if(ui.autoCloseRemoval)ui.stage="closed";if(ui.expireAfterRemoval)f.state.now+=100000;}
    if(ui.lost)throw Error("Native acknowledgement lost");}};
  const owner=createOriginalWindowOwner({ownerBearer:"fixture-owner-native",fetchImpl:f.fetchImpl,nowMillis:()=>f.state.now,sleep:async()=>{}});
  const args={tab,review,reviewDigest:digest(review),readMetadata:owner.read,authorizeAction:async()=>assert.equal(ui.authorized,true),
    record:async v=>{ui.records.push(v);if(ui.expire&&v.phase.endsWith("dispatch"))f.state.now+=600000;},nowMillis:()=>f.state.now,
    sleep:async()=>{ui.sleeps++;if(ui.expireDuringWait)f.state.now+=100000;}};
  const deadline=f.state.now+100000,control={assertActive:()=>assert.ok(f.state.now<deadline,"deadline")};
  return {f,ui,args,p,control,channel:createNativeOwnerChannel(args)};
}
test("native actions use fresh AX indices, exact owner/file/writer and independent ACL readbacks",async()=>{
  const t=fixture();const receipt=await t.channel.grant(t.p,t.control);assert.equal(receipt.closure.grantCapability,"consumed");assert.equal(t.ui.stage,"closed");assert.equal(t.f.state.permission,true);assert.equal(t.ui.notify,false);
  await t.channel.remove(t.p,t.control);assert.equal(t.f.state.permission,false);
  assert.deepEqual(t.ui.records.map(r=>r.phase),["native-grant-dispatch","native-grant-verified","native-remove-dispatch","native-remove-verified"]);
  assert.equal(t.f.state.calls.filter(c=>c.method!=="GET").length,0);await assert.rejects(t.channel.grant(t.p,t.control));
});
test("delayed invitation is read again without repeating input or permission dispatch",async()=>{
  const t=fixture();t.ui.grantDelayReads=3;
  await t.channel.grant(t.p,t.control);
  assert.equal(t.ui.sleeps,3);assert.equal(t.ui.presses,1);
  assert.equal(t.ui.clicks.filter(id=>id===11).length,1);assert.equal(t.f.state.permission,true);
});
test("missing expected role reports its selector and never dispatches sharing",async()=>{
  const t=fixture();t.ui.wrongRole=true;
  await assert.rejects(t.channel.grant(t.p,t.control),/Native control missing after bounded wait: editor role/);
  assert.equal(t.ui.sleeps,20);assert.equal(t.ui.presses,1);assert.ok(!t.ui.clicks.includes(11));
  assert.equal(t.f.state.permission,false);assert.deepEqual(t.ui.records,[]);
});
test("expiration during an asynchronous wait never dispatches sharing",async()=>{
  const t=fixture();t.ui.grantDelayReads=2;t.ui.expireDuringWait=true;
  await assert.rejects(t.channel.grant(t.p,t.control),/deadline/);
  assert.equal(t.ui.presses,1);assert.ok(!t.ui.clicks.includes(11));
  assert.equal(t.f.state.permission,false);assert.deepEqual(t.ui.records,[]);
});
test("delayed grant and dialog close are observed without resubmitting",async()=>{
  const t=fixture();t.ui.afterGrantDelayReads=3;t.ui.dismissDelayReads=2;
  const receipt=await t.channel.grant(t.p,t.control);
  assert.equal(receipt.closure.grantCapability,"consumed");assert.equal(t.ui.sleeps,5);
  assert.equal(t.ui.clicks.filter(id=>id===11).length,1);assert.equal(t.ui.clicks.filter(id=>id===14).length,1);
});
test("delayed reopening and removal are observed without repeating permission actions",async()=>{
  const t=fixture();await t.channel.grant(t.p,t.control);
  t.ui.reopenDelayReads=3;t.ui.afterRemovalDelayReads=2;t.ui.autoCloseRemoval=true;
  await t.channel.remove(t.p,t.control);
  assert.equal(t.f.state.permission,false);assert.equal(t.ui.sleeps,5);
  for(const id of [13,5,6,7])assert.equal(t.ui.clicks.filter(i=>i===id).length,1);
});
test("unresolved post-grant state stops without resubmission or closure receipt",async()=>{
  const t=fixture();t.ui.afterGrantDelayReads=50;
  await assert.rejects(t.channel.grant(t.p,t.control),error=>error.nativeGrantUncertain===true&&/Native state missing after bounded wait: grant completion/.test(error.message));
  assert.equal(t.ui.clicks.filter(id=>id===11).length,1);assert.equal(t.f.state.permission,true);
  assert.equal(t.ui.records.some(r=>r.phase==="native-grant-verified"),false);
});
test("unresolved sharing reopen stops before attempting removal",async()=>{
  const t=fixture();await t.channel.grant(t.p,t.control);t.ui.reopenDelayReads=50;
  await assert.rejects(t.channel.remove(t.p,t.control),/Native state missing after bounded wait: opened sharing dialog/);
  assert.equal(t.ui.clicks.filter(id=>id===13).length,1);assert.ok(!t.ui.clicks.includes(7));assert.equal(t.f.state.permission,true);
});
test("unresolved save stops without repeating it or claiming verified cleanup",async()=>{
  const t=fixture();await t.channel.grant(t.p,t.control);t.ui.afterRemovalDelayReads=50;
  await assert.rejects(t.channel.remove(t.p,t.control),/Native state missing after bounded wait: removal completion/);
  await assert.rejects(t.channel.remove(t.p,t.control),/Native removal already attempted/);
  assert.equal(t.ui.clicks.filter(id=>id===7).length,1);
  assert.equal(t.ui.records.some(r=>r.phase==="native-remove-verified"),false);
});
test("expiry after grant still observes settlement and never submits again",async()=>{
  const t=fixture();t.ui.afterGrantDelayReads=2;t.ui.expireAfterGrant=true;
  await assert.rejects(t.channel.grant(t.p,t.control),error=>error.nativeGrantUncertain===true&&/deadline/.test(error.message));
  assert.equal(t.ui.pendingGrant,0);assert.equal(t.ui.sleeps,2);assert.equal(t.ui.clicks.filter(id=>id===11).length,1);
  assert.ok(!t.ui.clicks.includes(14));assert.equal(t.ui.records.some(r=>r.phase==="native-grant-verified"),false);
  await assert.rejects(t.channel.grant(t.p,t.control),/Native grant already attempted/);
});
test("expiry after removal still observes settlement and never saves again",async()=>{
  const t=fixture();await t.channel.grant(t.p,t.control);t.ui.afterRemovalDelayReads=2;t.ui.expireAfterRemoval=true;
  await assert.rejects(t.channel.remove(t.p,t.control),/deadline/);
  assert.equal(t.ui.pendingRemoval,0);assert.equal(t.ui.sleeps,2);assert.equal(t.ui.clicks.filter(id=>id===7).length,1);
  assert.equal(t.ui.records.some(r=>r.phase==="native-remove-verified"),false);
  await assert.rejects(t.channel.remove(t.p,t.control),/Native removal already attempted/);
});
for(const fault of ["wrongFile","wrongRole","duplicate","expire"])test(`native ${fault} blocks final mutation`,async()=>{
  const t=fixture();t.ui[fault]=true;await assert.rejects(t.channel.grant(t.p,t.control));assert.equal(t.f.state.permission,false);assert.ok(!t.ui.clicks.includes(11));
});
test("missing action authorization and mismatched recipient stop before native interaction",async()=>{
  const t=fixture();t.ui.authorized=false;await assert.rejects(t.channel.grant(t.p,t.control));
  await assert.rejects(t.channel.grant({...t.p,emailAddress:"other"},t.control));assert.equal(t.ui.clicks.length,0);
});
test("lost native grant acknowledgement is not resent; independently observed access can still be removed",async()=>{
  const t=fixture();t.ui.lost=true;await assert.rejects(t.channel.grant(t.p,t.control));assert.equal(t.f.state.permission,true);
  await assert.rejects(t.channel.grant(t.p,t.control));assert.equal(t.ui.clicks.filter(id=>id===11).length,1);
  t.ui.lost=false;await t.channel.remove(t.p,t.control);assert.equal(t.f.state.permission,false);
});

test("grant workflow must be dismissed before a closure receipt; failed dismissal never repeats the grant",async()=>{
  const t=fixture();t.ui.closeFault=true;await assert.rejects(t.channel.grant(t.p,t.control),/sharing dialog closed/);
  assert.equal(t.f.state.permission,true);assert.equal(t.ui.records.some(r=>r.closure),false);
  await assert.rejects(t.channel.grant(t.p,t.control));await t.channel.remove(t.p,t.control);assert.equal(t.f.state.permission,false);
});

test("an already dismissed grant is verified without reopening the sharing workflow",async()=>{
  const t=fixture();t.ui.autoDismiss=true;const receipt=await t.channel.grant(t.p,t.control);
  assert.equal(receipt.closure.grantCapability,"consumed");assert.equal(t.ui.stage,"closed");assert.ok(!t.ui.clicks.includes(14));
  await t.channel.remove(t.p,t.control);assert.equal(t.f.state.permission,false);
});
