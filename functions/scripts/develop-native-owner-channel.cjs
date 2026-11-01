"use strict";

// Use only inside cua_repl with a supported native Tab. No browser discovery,
// hidden DOM access, network permission API or persisted element indices.
const assert=require("node:assert/strict");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {FILE,OWNER,WRITER,PERMISSION,validateMetadata}=require("./develop-original-writer-provider.cjs");
const TITLE='Compartir "Regüerta — DEVELOP — Turnos de prueba"';
const permission=Object.freeze({fileId:FILE,permissionId:PERMISSION,type:"user",role:"writer",emailAddress:WRITER});
function lines(state){return state.split("\n").map(line=>{const m=line.match(/^(\s*)(\d+) (.*)$/);return m?{indent:m[1].length,id:Number(m[2]),text:m[3]}:null;}).filter(Boolean);}
function one(rows,predicate){const found=rows.filter(predicate);assert.equal(found.length,1,"Native control missing or ambiguous");return found[0];}
function button(rows,name){return one(rows,r=>r.text===`button ${name}`);}
function assertFile(rows){assert.ok(rows.some(r=>r.text.includes(`drive.google.com/drivesharing/driveshare?id=${FILE}&`)));assert.ok(rows.some(r=>r.text===`text ${TITLE}`));}
function createNativeOwnerChannel({tab,review,reviewDigest,readMetadata,authorizeAction,record,nowMillis=Date.now}) {
  assert.equal(digest(review),reviewDigest);assert.deepEqual(review.permission,permission);assert.equal(review.owner,OWNER);
  assert.equal(review.kind,"native-drive-owner-sharing");assert.equal(typeof authorizeAction,"function");assert.equal(typeof record,"function");
  let active=false,grantAttempted=false;
  const snapshot=async()=>{
    let rows=lines(await tab.getAXState({disableDiffing:true,emit:false}));
    if(!rows.some(r=>r.text.includes("drive.google.com/drivesharing/driveshare?id="))){
      one(rows,r=>r.text.startsWith("row (selected) Regüerta — DEVELOP — Turnos de prueba Hojas de cálculo de Google "));
      assert.ok(rows.some(r=>r.text.includes(`Cuenta de Google: Plus Projects Test (${OWNER})`)));
      await tab.click(one(rows,r=>r.text.startsWith("button Compartir ")).id);
      rows=lines(await tab.getAXState({disableDiffing:true,emit:false}));
    }
    assertFile(rows);return rows;
  };
  async function action(kind,p,{assertActive}) {
    assert.deepEqual(p,permission);assert.equal(active,false,"Concurrent native permission action");
    if(kind==="grant")assert.equal(grantAttempted,false,"Native grant already attempted; inspect instead");
    active=true;const startedAtMillis=nowMillis();
    try {
      assertActive();await authorizeAction({kind,permission:{...permission},reviewDigest});assertActive();
      const before=await readMetadata();validateMetadata(before,kind==="remove");
      let rows=await snapshot();assertActive();
      if(kind==="grant") {
        assert.ok(rows.some(r=>r.text.includes(`${OWNER}. Propietario.`)));assert.ok(!rows.some(r=>r.text.includes(WRITER)));
        const input=one(rows,r=>r.text.startsWith("combo box ")&&r.text.includes("Description: Añadir personas, grupos y eventos de calendario"));
        await tab.typeText(input.id,WRITER);rows=await snapshot();assertActive();
        await tab.pressKey(one(rows,r=>r.text.startsWith("combo box ")&&r.text.includes(`Value: ${WRITER}`)).id,"Return");rows=await snapshot();
        one(rows,r=>r.text.startsWith(`row Quitar a ${WRITER},`));
        one(rows,r=>r.text.includes("Description: Editor. Cambiar permiso")&&!r.text.includes("disabled"));
        const notify=one(rows,r=>r.text.startsWith("checkbox ")&&r.text.includes("Description: Notificar a los usuarios"));
        if(notify.text.includes("Value: 1")){await tab.click(notify.id);rows=await snapshot();}
        one(rows,r=>r.text.startsWith("checkbox ")&&r.text.includes("Notificar a los usuarios, Value: 0"));
      } else {
        const row=one(rows,r=>r.text.startsWith(`${WRITER} `)&&r.text.includes("Editor. Cambiar permiso"));
        const index=rows.indexOf(row),end=rows.findIndex((r,i)=>i>index&&r.indent<=row.indent);
        const nested=rows.slice(index+1,end<0?undefined:end);
        await tab.click(one(nested,r=>r.text.startsWith("pop up button ")&&r.text.includes("Editor. Cambiar permiso")).id);rows=await snapshot();assertActive();
        await tab.click(one(rows,r=>r.text==="Quitar acceso").id);rows=await snapshot();
      }
      // Record intent before the one final mutation. A lost result is inspect-only;
      // neither the grant nor Save is retried. Caller still owns ACL containment.
      const target=button(rows,kind==="grant"?"Compartir":"Guardar");
      await record({phase:`native-${kind}-dispatch`,permission:{...permission},reviewDigest,startedAtMillis,atMillis:nowMillis()});
      assertActive();if(kind==="grant")grantAttempted=true;
      await tab.click(target.id);
      // Settle the native action before reading independent ACLs, even on expiry.
      await tab.getAXState({disableDiffing:true,emit:false});
      const after=await readMetadata();validateMetadata(after,kind==="grant");assertActive();
      const receipt={phase:`native-${kind}-verified`,permission:{...permission},reviewDigest,startedAtMillis,finishedAtMillis:nowMillis(),
        beforeDigest:digest(before),afterDigest:digest(after)};
      await record(receipt);assertActive();return receipt;
    } finally {active=false;}
  }
  return {kind:review.kind,reviewDigest,grant:(p,c)=>action("grant",p,c),remove:(p,c)=>action("remove",p,c)};
}
module.exports={createNativeOwnerChannel};
if(require.main===module){console.error("explicit_cua_owner_channel_required_no_cli");process.exitCode=1;}
