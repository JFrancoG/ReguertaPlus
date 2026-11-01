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
  const ui={stage:"list",typed:false,notify:true,clicks:[],records:[],expire:false,lost:false,wrongFile:false,wrongRole:false,authorized:true,duplicate:false};
  const tab={async getAXState(){
    const start=`0 AXWebArea drive.google.com/drivesharing/driveshare?id=${ui.wrongFile?"wrong":FILE}&hl=es\n 1 text Compartir "Regüerta — DEVELOP — Turnos de prueba"\n`;
    if(ui.stage==="list")return start+` 2 text ${OWNER}. Propietario.\n 3 combo box (settable) Description: Añadir personas, grupos y eventos de calendario${ui.typed?`, Value: ${WRITER}`:""}\n`+
      (f.state.permission?` 4 ${WRITER} ${WRITER}. Editor. Cambiar permiso\n   5 pop up button (collapsed) Description: Editor. Cambiar permiso`:"");
    if(ui.stage==="menu")return start+" 6 Quitar acceso";
    if(ui.stage==="remove")return start+" 7 button Guardar";
    return start+` 8 row Quitar a ${WRITER}, ID: recipient\n 9 pop up button (collapsed) Description: ${ui.wrongRole?"Lector":"Editor"}. Cambiar permiso\n 10 checkbox (settable) Description: Notificar a los usuarios, Value: ${ui.notify?1:0}\n 11 button ${ui.notify?"Enviar":"Compartir"}`+(ui.duplicate?"\n 12 button Compartir":"");
  },async typeText(id,text){assert.equal(id,3);assert.equal(text,WRITER);ui.typed=true;},async pressKey(id,key){assert.equal(id,3);assert.equal(key,"Return");ui.stage="grant";},
  async click(id){ui.clicks.push(id);if(id===10){ui.notify=false;return;}if(id===5){ui.stage="menu";return;}if(id===6){ui.stage="remove";return;}
    assert.ok([7,11].includes(id));f.state.permission=id===11;f.state.version++;ui.stage="list";ui.typed=false;if(ui.lost)throw Error("Native acknowledgement lost");}};
  const owner=createOriginalWindowOwner({ownerBearer:"fixture-owner-native",fetchImpl:f.fetchImpl,nowMillis:()=>f.state.now,sleep:async()=>{}});
  const args={tab,review,reviewDigest:digest(review),readMetadata:owner.read,authorizeAction:async()=>assert.equal(ui.authorized,true),
    record:async v=>{ui.records.push(v);if(ui.expire&&v.phase.endsWith("dispatch"))f.state.now+=600000;},nowMillis:()=>f.state.now};
  const deadline=f.state.now+100000,control={assertActive:()=>assert.ok(f.state.now<deadline,"deadline")};
  return {f,ui,args,p,control,channel:createNativeOwnerChannel(args)};
}
test("native actions use fresh AX indices, exact owner/file/writer and independent ACL readbacks",async()=>{
  const t=fixture();await t.channel.grant(t.p,t.control);assert.equal(t.f.state.permission,true);assert.equal(t.ui.notify,false);
  await t.channel.remove(t.p,t.control);assert.equal(t.f.state.permission,false);
  assert.deepEqual(t.ui.records.map(r=>r.phase),["native-grant-dispatch","native-grant-verified","native-remove-dispatch","native-remove-verified"]);
  assert.equal(t.f.state.calls.filter(c=>c.method!=="GET").length,0);await assert.rejects(t.channel.grant(t.p,t.control));
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
