"use strict";

// The transport must present each exact challenge and return the explicit reply.
// Null templates are not confirmations; no default answer, polling or UI automation.
const assert=require("node:assert/strict");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {createShiftPlanningOwnerMaintenanceAgreement:ownerAgreement}=require("../lib/shift-planning-owner-maintenance.js");
const {parseShiftPlanningAdministratorMaintenanceAgreement:adminAgreement}=require("../lib/shift-planning-administrator-maintenance.js");
const {plannedScope}=require("./develop-initial-evidence-seal.cjs");
const exact=(value,keys)=>assert.deepEqual(Object.keys(value).sort(),[...keys].sort());
const time=value=>assert.ok(Number.isSafeInteger(value)&&value>=0);
function reportTemplate(owner,admin) {
  const oi=owner.payload.intent,ai=admin.payload.intent;
  return {ownerObservation:{workbookFileId:oi.workbookFileId,ownerPrincipalId:oi.ownerPrincipalId,
    participantsDigest:digest({revision:oi.participantsRevision,participants:oi.participants}),effectiveAuthorityDigest:oi.effectiveAuthorityDigest,
    sourceRevision:oi.sourceRevision,sourceDigest:oi.sourceDigest,technicalCapability:"retained",permissionWorkflowClosed:null,
    permissionControlEvidenceDigest:digest(oi.permissionControl),agreementStatus:null,ownerActivity:null,unresolvedWriteCount:null,observedAtMillis:null},
  administratorObservation:{projectId:ai.projectId,databaseId:ai.databaseId,environment:ai.environment,agreementDigest:admin.digest,
    administratorPrincipalIds:ai.administratorPrincipalIds,participantsRevision:ai.participantsRevision,effectiveIamDigest:ai.effectiveIamDigest,
    sourceRevision:ai.sourceRevision,sourceDigest:ai.sourceDigest,technicalCapability:"retained",agreementStatus:null,administratorActivity:null,
    unresolvedWriteCount:null,reportRevision:null,observedAtMillis:null}};
}
function createDevelopHumanInputs({receiptId,exchange,record,nowMillis=Date.now,deadlineMillis,assertActive}) {
  assert.match(receiptId,/^[A-Za-z0-9][A-Za-z0-9._-]+$/);
  for(const fn of [exchange,record,nowMillis,deadlineMillis,assertActive])assert.equal(typeof fn,"function");
  let sequence=0,busy=false,closed=false,owner=null,admin=null,scope=null;const responses=new Set();
  const current=end=>{assert.equal(closed,false);assertActive();assert.ok(nowMillis()<end,"human_input_deadline_exhausted");};
  async function ask(kind,binding,responseTemplate,prompt,notBeforeMillis,end,checkActive=()=>{}) {
    time(notBeforeMillis);time(end);current(end);checkActive();assert.equal(busy,false,"Concurrent human challenges");busy=true;
    const request={kind,receiptId,sequence:++sequence,binding:structuredClone(binding),notBeforeMillis:Math.max(notBeforeMillis,nowMillis()),deadlineMillis:end,
      prompt,responseTemplate:{responseId:null,respondedAtMillis:null,...structuredClone(responseTemplate)}};
    const requestDigest=digest(request),challenge={...request,requestDigest};
    try {
      await record({phase:"human-input-request",challenge});current(end);checkActive();
      const reply=structuredClone(await exchange(structuredClone(challenge)));
      // Retain negative/malformed replies before validation. They never become consent.
      await record({phase:"human-input-reply",requestDigest,reply});current(end);checkActive();
      exact(reply,["requestDigest","responseId","respondedAtMillis",...Object.keys(responseTemplate)]);
      assert.equal(reply.requestDigest,requestDigest);assert.match(reply.responseId,/^[A-Za-z0-9][A-Za-z0-9._:-]+$/);
      assert.equal(responses.has(reply.responseId),false,"Human reply already consumed");responses.add(reply.responseId);
      time(reply.respondedAtMillis);assert.ok(reply.respondedAtMillis>=request.notBeforeMillis&&reply.respondedAtMillis<=nowMillis());
      return {reply,request};
    }finally{busy=false;}
  }
  const ports={
    async collectConfirmations({kind,intent,intentDigest,notBeforeMillis,deadlineMillis:end,assertActive:checkActive}) {
      assert.ok(["owner","administrator"].includes(kind));assert.equal(digest(intent),intentDigest);
      if(kind==="owner")assert.equal(owner,null);else{assert.ok(owner);assert.equal(admin,null);assert.equal(intent.ownerAgreementDigest,owner.digest);}
      const confirmations=kind==="owner"?intent.participants.map(p=>({...p,intentDigest,confirmationId:null,confirmedAtMillis:null,onlineClosedNoOfflineEdits:null,noManualOrAutomationWrites:null})):
        intent.administratorPrincipalIds.map(principalId=>({principalId,intentDigest,confirmationId:null,confirmedAtMillis:null,noUnreviewedDataRulesDeployIamOrScriptWrites:null,noAutomationViaHumanCredentials:null}));
      const statement=kind==="owner"?"Confirma para todas las personas y funciones indicadas: hoja de develop cerrada en todos los dispositivos, en línea, sin cambios sin conexión pendientes; ninguna edición ni automatización durante este intervalo. La acción de permisos indicada ya debe haber terminado. Puedes rechazar; una respuesta vacía no confirma.":
        "Confirma para todas las cuentas administradoras indicadas: no cambiar datos, Rules, despliegues, IAM ni scripts de develop, ni usar sus credenciales en automatizaciones durante este intervalo. No concede permisos nuevos ni autoriza producción. Puedes rechazar.";
      const people=kind==="owner"?intent.participants.map(p=>`${p.principalId} (${p.role})`):intent.administratorPrincipalIds;
      const prompt=`${statement}\nCuentas: ${people.join(", ")}.\nIntervalo UTC: ${new Date(intent.startsAtMillis).toISOString()} a ${new Date(intent.endsAtMillis).toISOString()}.\nOperaciones: ${intent.operations.map(o=>o.operationId).join(", ")}.`;
      const {reply,request}=await ask(kind,{intent,intentDigest},{confirmations},prompt,notBeforeMillis,Math.min(end,deadlineMillis()),checkActive);
      for(const c of reply.confirmations){time(c.confirmedAtMillis);assert.ok(c.confirmedAtMillis>=request.notBeforeMillis&&c.confirmedAtMillis<=reply.respondedAtMillis);}
      if(kind==="owner")owner=ownerAgreement(intent,reply.confirmations);
      else{const payload={schemaVersion:1,kind:"cooperative-develop-administrator-maintenance",intent,confirmations:reply.confirmations};admin=adminAgreement({payload,digest:digest(payload)});}
      return structuredClone(reply.confirmations);
    },
    async readInitialHumanReports({scope:requested,ownerAgreement:oa,administratorAgreement:aa,notBeforeMillis,deadlineMillis:end,assertActive:checkActive}) {
      assert.ok(owner&&admin);assert.deepEqual(oa,owner);assert.deepEqual(aa,admin);assert.equal(scope,null);scope=plannedScope(requested);
      return reports(requested,notBeforeMillis,Math.min(end,deadlineMillis()),checkActive);
    },
    async readHumanReports(requested) {
      assert.ok(scope,"Initial human report is missing");assert.deepEqual(plannedScope(requested),scope);
      assert.equal(requested.expectedOwnerAgreementDigest,owner.digest);assert.equal(requested.expectedAdministratorAgreementDigest,admin.digest);
      return reports(requested,nowMillis(),deadlineMillis());
    },
    close(){assert.equal(busy,false,"Pending human reply must settle first");closed=true;},
  };
  async function reports(requested,notBefore,end,checkActive) {
    const template=reportTemplate(owner,admin);
    const {reply,request}=await ask("reports",{scope:requested,ownerAgreement:owner,administratorAgreement:admin},{reports:template},
      "Informa de nuevo sobre el intervalo acordado: ¿se mantienen ambos compromisos, sigue cerrado el flujo de permisos y no ha habido ediciones ni operaciones pendientes conocidas del propietario o los administradores? Si hubo actividad, dudas o retirada del acuerdo, indícalo; no se continuará.",notBefore,end,checkActive);
    exact(reply.reports,Object.keys(template));
    for(const [key,expected]of Object.entries(template)){
      const actual=reply.reports[key];exact(actual,Object.keys(expected));
      for(const [field,value]of Object.entries(expected))if(value!==null)assert.deepEqual(actual[field],value);
      time(actual.observedAtMillis);assert.ok(actual.observedAtMillis>=request.notBeforeMillis&&actual.observedAtMillis<=reply.respondedAtMillis);
      assert.equal(actual.agreementStatus,"confirmed");assert.equal(actual.unresolvedWriteCount,0);
      if(key==="ownerObservation"){assert.equal(actual.permissionWorkflowClosed,true);assert.equal(actual.ownerActivity,"none-reported");}
      else{assert.equal(actual.administratorActivity,"none-reported");assert.match(actual.reportRevision,/^[A-Za-z0-9][A-Za-z0-9._:-]+$/);}
    }
    return structuredClone(reply.reports);
  }
  return ports;
}
module.exports={createDevelopHumanInputs,reportTemplate};
if(require.main===module){console.error("explicit_human_exchange_required_no_cli");process.exitCode=1;}
