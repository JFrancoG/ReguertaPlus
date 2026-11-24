"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {test}=require("node:test");
const {prepareCopy,runCopy,IDENTITY}=require("../scripts/rehearse-develop-helper-copy.cjs");
const {FILE}=require("../scripts/develop-original-writer-provider.cjs");
const {createCopyOwner,openCopyWriter}=require("../scripts/develop-helper-copy-provider.cjs");
const {sheetsService}=require("./shift-sheets-api-fixture.cjs");
async function fixture(t) {
  const prepared=await prepareCopy({fileId:"synthetic-copy-only",protectedWorkbookIds:[FILE,"1bBJX9VqadOTFJ_HyKHLcsikFjytLr7jPu9GyFUJ1nwE"],runId:"full-test-copy"});
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"helper-copy-"));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const state={now:1000000,disabled:true,permission:false,policy:{etag:"initial",version:3,bindings:[]},mintCount:0,closed:0,enabled:0};
  const sheets=sheetsService(prepared.fileId);sheets.state=structuredClone(prepared.baseline);
  const iam={readIdentity:async()=>({account:{...IDENTITY,disabled:state.disabled},keys:{},policy:structuredClone(state.policy),project:{projectId:"reguerta-9f27f"},projectPolicy:{bindings:[]}}),
    enableOwned:async()=>{state.disabled=false;state.enabled++;},disableOwned:async()=>{state.disabled=true;},
    setPolicy:async policy=>{assert.equal(policy.etag,state.policy.etag);state.policy={...structuredClone(policy),etag:policy.etag+"-next"};},
    hasMintPermission:async()=>true,mint:async()=>{state.mintCount++;return {accessToken:"private-test-token",expireTime:new Date(state.now+300000).toISOString()};}};
  const owner={observe:async writer=>{assert.equal(state.permission,writer);return {snapshot:structuredClone(sheets.state),version:String(sheets.revision)};},
    grant:async()=>{assert.equal(state.permission,false);state.permission=true;return {id:"copy-writer"};},
    remove:async()=>{state.permission=false;},close:async()=>{state.closed++;return {verified:true};}};
  const input={authorized:true,preparationDigest:prepared.preparationDigest,receiptId:"one-full-copy",startsAtMillis:state.now,endsAtMillis:state.now+600000,
    onlineClosedNoOfflineEdits:true,noOtherWritesOrTokens:true};
  const args={prepared,input,iam,owner,journalRoot:root,nowMillis:()=>state.now,sleep:async ms=>{state.now+=ms;},
    readIsolation:async()=>({writerEmail:IDENTITY.email,writerIsolated:true,observedAtMillis:state.now}),
    openWriter:async()=>({sheets,probe:async()=>({status:state.permission?200:404}),close(){}})};
  return {prepared,state,sheets,args,receipts:()=>fs.readdirSync(path.join(root,input.receiptId)).map(n=>fs.readFileSync(path.join(root,input.receiptId,n),"utf8")).join("\n")};
}
test("full copy lifecycle waits once, mints once, writes/reverses exactly two batches, removes access and revokes once",async t=>{
  const f=await fixture(t);f.sheets.loseAcknowledgement=true;
  f.sheets.onMutation=async()=>{for(const sheet of f.sheets.state.sheets)for(const marker of sheet.developerMetadata)marker.location.locationType="SHEET";};
  const result=await runCopy(f.args);
  assert.equal(result.kind,"full-copy-restored-and-contained");assert.equal(result.completedBatches,2);
  assert.equal(f.sheets.mutations.length,2);assert.ok(f.sheets.mutations.every(m=>m.requestBody.requests.length===55));
  assert.equal(f.state.now,1120000);assert.equal(f.state.mintCount,1);assert.equal(f.state.closed,1);
  assert.equal(f.state.permission,false);assert.equal(f.state.disabled,true);assert.deepEqual(f.state.policy.bindings,[]);
  const restored=structuredClone(f.sheets.state);restored.sheets.forEach(s=>{s.developerMetadata=[];});assert.deepEqual(restored,f.prepared.baseline);
  assert.ok(!f.receipts().includes("private-test-token"));
  await assert.rejects(runCopy(f.args),{code:"EEXIST"});assert.equal(f.state.mintCount,1);
});
test("preservation rejection retains the complete owner readback before cleanup and never starts the inverse",async t=>{
  const f=await fixture(t);
  f.sheets.onMutation=async()=>{f.sheets.state.sheets[0].data[0].rowData[0].values[0].note="unexpected note";};
  const result=await runCopy(f.args);
  assert.equal(result.kind,"inspection_required");assert.equal(result.failure.phase,"forward");
  assert.equal(f.sheets.mutations.length,1);assert.equal(result.completedBatches,0);
  const readback=JSON.parse(fs.readFileSync(path.join(f.args.journalRoot,f.args.input.receiptId,"forward-readback.json")));
  assert.equal(readback.result.kind,"verified");
  assert.equal(readback.observation.snapshot.sheets[0].data[0].rowData[0].values[0].note,"unexpected note");
  assert.equal(f.state.permission,false);assert.equal(f.state.disabled,true);
  assert.deepEqual(f.state.policy.bindings,[]);assert.equal(f.state.closed,1);
});
for(const phase of ["enable","grant","mint","write","deadline","cleanup"])test(`full lifecycle contains ${phase} failure without automatic replay`,async t=>{
  const f=await fixture(t);
  if(phase==="enable")f.args.iam.enableOwned=async()=>{f.state.disabled=false;throw Error("lost");};
  if(phase==="grant")f.args.owner.grant=async()=>{f.state.permission=true;throw Error("lost");};
  if(phase==="mint")f.args.iam.mint=async()=>{f.state.mintCount++;throw Error("private-test-token");};
  if(phase==="write")f.sheets.rejectBeforeApply=true;
  if(phase==="deadline")f.sheets.onMutation=async()=>{f.state.now+=151000;};
  if(phase==="cleanup")f.args.owner.close=async()=>{f.state.closed++;throw Error("unproven");};
  const result=await runCopy(f.args);assert.equal(result.kind,"inspection_required");assert.equal(result.canRetry,false);
  assert.ok(f.state.mintCount<=1);assert.equal(f.state.disabled,true);assert.deepEqual(f.state.policy.bindings,[]);
  assert.equal(f.state.permission,false);assert.equal(f.state.closed,1);
  assert.ok(!f.receipts().includes("private-test-token"));
  if(phase==="deadline"){assert.equal(f.sheets.mutations.length,1);assert.equal(result.completedBatches,1);}
  if(phase==="write")assert.equal(f.sheets.mutations.length,1);
});
test("changed recipe, original destination and missing confirmation reject before access",async t=>{
  for(const change of [f=>{f.args.input.authorized=false;},f=>{f.args.input.noOtherWritesOrTokens=false;},
    f=>{f.args.prepared.forward.rows.pop();},f=>{f.args.prepared.fileId=FILE;}]){
    const f=await fixture(t);change(f);await assert.rejects(runCopy(f.args));assert.equal(f.state.enabled,0);assert.equal(f.state.mintCount,0);
  }
});
test("writer transport pins destination, forbids refresh and has a two-attempt ceiling even after unknown response",async()=>{
  const calls=[],fileId="synthetic-copy-only",protectedWorkbookIds=[FILE,"1bBJX9VqadOTFJ_HyKHLcsikFjytLr7jPu9GyFUJ1nwE"];
  const writer=openCopyWriter({fileId,protectedWorkbookIds,bearer:"private-test-token",expiresAtMillis:500000,nowMillis:()=>1,
    fetchImpl:async(url,o)=>{calls.push(url);assert.ok(url.includes(fileId));assert.equal(o.redirect,"error");throw Error("lost");}});
  const body={spreadsheetId:fileId,requestBody:{requests:[...Array.from({length:53},()=>({updateCells:{}})),{createDeveloperMetadata:{}},{createDeveloperMetadata:{}}]}};
  for(let i=0;i<3;i++)await assert.rejects(writer.sheets.batchUpdate(body,{retry:false}));assert.equal(calls.length,2);
  await assert.rejects(writer.sheets.get({spreadsheetId:FILE},{retry:false}));assert.equal(calls.length,2);writer.close();
  assert.throws(()=>openCopyWriter({fileId:FILE,protectedWorkbookIds,bearer:"x"}));
});
test("copy OAuth revokes once and waits for both services without reading the original",async()=>{
  let now=1000,revokes=0,sheetsProbes=0;const fileId="synthetic-copy-only";
  const owner=createCopyOwner({fileId,protectedWorkbookIds:[FILE,"1bBJX9VqadOTFJ_HyKHLcsikFjytLr7jPu9GyFUJ1nwE"],ownerBearer:"private-test-token",nowMillis:()=>now,sleep:async ms=>{now+=ms;},
    fetchImpl:async(url,o)=>{assert.equal(o.redirect,"error");
      if(url.includes("/revoke")){revokes++;return {status:200};}
      assert.ok(url.includes(fileId));return {status:url.includes("sheets.googleapis.com")&&sheetsProbes++<2?200:401,json:async()=>({})};}});
  const result=await owner.close();assert.equal(result.verified,true);assert.equal(now,21000);assert.equal(result.attempts.length,3);
  assert.deepEqual(await owner.close(),result);assert.equal(revokes,1);
});
test("owner transport reads the complete copy, grants only its writer and reconciles a lost grant response",async t=>{
  const f=await fixture(t),{PARENT,OWNER,WRITER}=require("../scripts/develop-original-writer-provider.cjs");
  const permissions=[{id:"test-owner",type:"user",role:"owner",emailAddress:OWNER}];let revoked=false;
  const owner=createCopyOwner({fileId:f.prepared.fileId,protectedWorkbookIds:f.prepared.protectedWorkbookIds,ownerBearer:"private-test-token",
    fetchImpl:async(url,o)=>{
      if(url.includes("/revoke")){revoked=true;return {status:200};}
      assert.ok(url.includes(f.prepared.fileId));assert.equal(o.redirect,"error");
      if(revoked)return {status:401,json:async()=>({})};
      const u=new URL(url),result=data=>({status:200,json:async()=>structuredClone(data)});
      if(o.method==="POST"){
        assert.ok(u.pathname.endsWith("/permissions"));assert.equal(u.searchParams.get("sendNotificationEmail"),"false");
        assert.deepEqual(JSON.parse(o.body),{type:"user",role:"writer",emailAddress:WRITER});
        permissions.push({id:"test-writer",type:"user",role:"writer",emailAddress:WRITER});throw Error("lost grant reply");
      }
      if(o.method==="DELETE"){
        assert.ok(u.pathname.endsWith("/permissions/test-writer"));permissions.splice(1,1);return {status:204,json:async()=>null};
      }
      if(u.hostname==="sheets.googleapis.com"){
        assert.equal(u.searchParams.getAll("ranges").length,6);const raw=structuredClone(f.prepared.baseline);
        raw.sheets.forEach(s=>{delete s.dataCoverage;delete s.developerMetadata;delete s.protectedRanges;delete s.merges;});return result(raw);
      }
      if(u.pathname.endsWith("/permissions"))return result({permissions});
      return result({id:f.prepared.fileId,mimeType:"application/vnd.google-apps.spreadsheet",trashed:false,version:"1",parents:[PARENT],
        owners:[{emailAddress:OWNER,permissionId:"test-owner",me:true}]});
    }});
  assert.deepEqual((await owner.observe(false)).snapshot,f.prepared.baseline);
  await assert.rejects(owner.grant());assert.equal(permissions.length,2);
  await owner.observe(true);await owner.remove(null);assert.equal(permissions.length,1);
  assert.equal((await owner.close()).verified,true);
});
test("runtime inventory rejects incomplete pages, unreachable resources and any occurrence of the writer",async()=>{
  const {createIsolationReader}=require("../scripts/develop-helper-copy-provider.cjs");
  for(const data of [{nextPageToken:"more"},{metadata:{continue:"more"}},{unreachable:["region"]},{items:[{serviceAccount:IDENTITY.email}]}]){
    const read=createIsolationReader({iamBearer:"private-test-token",fetchImpl:async()=>({status:200,json:async()=>data})});
    await assert.rejects(read());
  }
});

async function recoveryFixture(t) {
  const f=await fixture(t);
  const {createShiftSheetsAdapter}=require('../lib/shift-sheets.js');
  const {createShiftSheetsConfig}=require('../lib/shift-sheets-config.js');
  const {createShiftSheetsOwnerPreservationManifest:manifest}=require('../lib/shift-sheets-owner-manifest.js');
  const {prepareCopyRecovery}=require('../scripts/rehearse-develop-helper-copy.cjs');
  const api=createShiftSheetsAdapter({config:createShiftSheetsConfig({environment:'develop',workbooks:{develop:f.prepared.fileId}}),sheets:f.sheets});
  let forwardIntent;
  f.sheets.onMutation=async()=>{for(const s of f.sheets.state.sheets)for(const m of s.developerMetadata)m.location.locationType='SHEET';};
  assert.equal((await api.reconcile({...f.prepared.forward,authorizeMutation:async batch=>{
    forwardIntent={requestDigest:batch.requestDigest,requests:batch.requests,preservation:manifest({before:f.prepared.baseline,requests:batch.requests})};
  }})).kind,'verified');
  const evidence={original:f.prepared,forwardIntent,consumedReceiptId:'consumed-forward',
    terminal:{kind:'inspection_required',failure:{phase:'forward'},mintAttempted:true,completedBatches:0,cleanupFailures:[],canRetry:false},
    observation:await f.args.owner.observe(false)};
  const recovery=await prepareCopyRecovery(evidence);
  f.args.prepared=recovery;f.args.input={...f.args.input,inverseOnly:true,preparationDigest:recovery.preparationDigest,receiptId:'explicit-inverse'};
  f.sheets.mutations.length=0;
  return {...f,recovery,evidence};
}
test('inverse-only recovery restores the retained copy with one batch and keeps the inverse receipt markers',async t=>{
  const f=await recoveryFixture(t);f.sheets.loseAcknowledgement=true;
  const open=f.args.openWriter;f.args.openWriter=async args=>{assert.equal(args.maximumBatches,1);return open(args);};
  const result=await runCopy(f.args);
  assert.equal(result.kind,'inverse-copy-restored-and-contained');assert.equal(result.completedBatches,1);
  assert.equal(f.state.mintCount,1);assert.equal(f.sheets.mutations.length,1);
  const requests=f.sheets.mutations[0].requestBody.requests;
  assert.equal(requests.filter(r=>r.updateCells).length,53);assert.equal(requests.filter(r=>r.updateDeveloperMetadata).length,2);
  const markers=f.sheets.state.sheets.flatMap(s=>s.developerMetadata);
  assert.equal(markers.length,2);markers.forEach(m=>assert.equal(JSON.parse(m.metadataValue).operationId,f.prepared.inverse.operationId));
  const restored=structuredClone(f.sheets.state);restored.sheets.forEach(s=>{s.developerMetadata=[];});assert.deepEqual(restored,f.prepared.baseline);
  assert.equal(f.state.disabled,true);assert.equal(f.state.permission,false);assert.deepEqual(f.state.policy.bindings,[]);assert.equal(f.state.closed,1);
  const names=fs.readdirSync(path.join(f.args.journalRoot,f.args.input.receiptId));assert.ok(names.includes('inverse-readback.json'));assert.ok(!names.includes('forward-intent.json'));
  await assert.rejects(runCopy(f.args),{code:'EEXIST'});assert.equal(f.state.mintCount,1);
});
test('recovery preparation rejects changed cells, markers, historical recipe, unclosed cleanup and inverse attempts',async t=>{
  const {prepareCopyRecovery}=require('../scripts/rehearse-develop-helper-copy.cjs');
  const {createShiftPlanningDigest:digest}=require('../lib/shift-planning-digest.js');
  const f=await recoveryFixture(t);
  for(const change of [
    e=>{e.observation.snapshot.sheets[0].data[0].rowData[150].values[0].note='unrelated edit';},
    e=>{e.observation.snapshot.sheets[0].developerMetadata[0].metadataValue='wrong marker';},
    e=>{e.original.inverse.rows[0].helperUserId='unreviewed';const {preparationDigest,...body}=e.original;void preparationDigest;e.original.preparationDigest=digest(body);},
    e=>{e.terminal.cleanupFailures=['unknown'];},
    e=>{e.terminal.failure.phase='inverse';},
    e=>{e.forwardIntent.requests.pop();},
  ]){const evidence=structuredClone(f.evidence);change(evidence);await assert.rejects(prepareCopyRecovery(evidence));}
  assert.equal(f.state.enabled,0);assert.equal(f.state.mintCount,0);
});
for(const drift of ['version','before-grant','after-grant','marker-after-mint'])test(`inverse recovery refuses ${drift} drift and cleans owned permissions`,async t=>{
  const f=await recoveryFixture(t),observe=f.args.owner.observe,open=f.args.openWriter;
  if(drift==='version')f.args.owner.observe=async writer=>({...await observe(writer),version:'999'});
  if(drift==='before-grant')f.sheets.state.sheets[0].data[0].rowData[0].values[0].note='changed';
  if(drift==='after-grant'){const grant=f.args.owner.grant;f.args.owner.grant=async()=>{const r=await grant();f.sheets.state.sheets[0].data[0].rowData[0].values[0].note='changed';return r;};}
  if(drift==='marker-after-mint')f.args.openWriter=async args=>{f.sheets.state.sheets[0].developerMetadata[0].metadataId+=123;return open(args);};
  const result=await runCopy(f.args);assert.equal(result.kind,'inspection_required');assert.equal(f.sheets.mutations.length,0);
  if(['version','before-grant'].includes(drift))assert.equal(f.state.enabled,0);
  if(drift!=='marker-after-mint')assert.equal(f.state.mintCount,0);
  assert.equal(f.state.disabled,true);assert.equal(f.state.permission,false);assert.deepEqual(f.state.policy.bindings,[]);assert.equal(f.state.closed,1);
});
test('inverse requires its own explicit approval and a different consumed receipt',async t=>{
  for(const change of [f=>{f.args.input.inverseOnly=false;},f=>{f.args.input.receiptId=f.evidence.consumedReceiptId;},f=>{f.args.prepared.maximumBatches=2;}]){
    const f=await recoveryFixture(t);change(f);await assert.rejects(runCopy(f.args));assert.equal(f.state.enabled,0);assert.equal(f.state.mintCount,0);
  }
});
test('uncertain inverse stops without replay and keeps cleanup independent',async t=>{
  const f=await recoveryFixture(t);f.sheets.rejectBeforeApply=true;
  const result=await runCopy(f.args);assert.equal(result.kind,'inspection_required');assert.equal(result.failure.phase,'inverse');
  assert.equal(result.completedBatches,0);assert.equal(f.sheets.mutations.length,1);assert.equal(result.canRetry,false);
  assert.equal(f.state.permission,false);assert.equal(f.state.disabled,true);assert.deepEqual(f.state.policy.bindings,[]);
  await assert.rejects(runCopy(f.args));assert.equal(f.sheets.mutations.length,1);
});
test('copy transport enforces one inverse attempt even after an unknown network result',async()=>{
  let calls=0;const fileId='synthetic-copy-only';
  const writer=openCopyWriter({fileId,protectedWorkbookIds:[FILE,'1bBJX9VqadOTFJ_HyKHLcsikFjytLr7jPu9GyFUJ1nwE'],
    bearer:'private-test-token',expiresAtMillis:999999,maximumBatches:1,nowMillis:()=>1,
    fetchImpl:async()=>{calls++;throw Error('unknown');}});
  const body={spreadsheetId:fileId,requestBody:{requests:[...Array.from({length:53},()=>({updateCells:{}})),{updateDeveloperMetadata:{}},{updateDeveloperMetadata:{}}]}};
  await assert.rejects(writer.sheets.batchUpdate(body,{retry:false}));await assert.rejects(writer.sheets.batchUpdate(body,{retry:false}));assert.equal(calls,1);writer.close();
});

const {createCopyTimeBudget,prepareCopyTimeBudget,runBudgetedCopy}=require('../scripts/develop-copy-time-budget.cjs');
function budgetFixture(f) {
  const b=createCopyTimeBudget({...f.args.input,nowMillis:f.args.nowMillis});f.args.timeBudget=b;return b;
}
test('full deadline composition completes two batches and slow OAuth with one short token',async t=>{
  const f=await fixture(t);budgetFixture(f);
  const close=f.args.owner.close;f.args.owner.close=async()=>{f.state.now+=119000;return close();};
  const result=await runCopy(f.args);assert.equal(result.kind,'full-copy-restored-and-contained');
  assert.equal(result.completedBatches,2);assert.equal(f.state.mintCount,1);assert.equal(f.state.permission,false);assert.equal(f.state.disabled,true);
  const report=JSON.parse(fs.readFileSync(path.join(f.args.journalRoot,f.args.input.receiptId,'deadline-report.json')));
  assert.deepEqual(report.breaches,[]);assert.equal(report.inFlight,0);assert.ok(report.finishedAtMillis<f.args.input.endsAtMillis);
});
for(const stage of ['before-first','after-forward','file-cleanup','IAM-cleanup','OAuth-cleanup'])
 test(`deadline overrun in ${stage} retains uncertainty and still attempts independent cleanup`,async t=>{
  const f=await fixture(t);budgetFixture(f);
  if(stage==='before-first') {
    const observe=f.args.owner.observe;let delayed=false;
    f.args.owner.observe=async(...args)=>{if(f.state.mintCount&&!delayed){f.state.now+=80000;delayed=true;}return observe(...args);};
  }
  if(stage==='after-forward')f.sheets.onMutation=async()=>{f.state.now+=80000;};
  if(stage==='file-cleanup'){const remove=f.args.owner.remove;f.args.owner.remove=async(...args)=>{f.state.now+=61000;return remove(...args);};}
  if(stage==='IAM-cleanup'){const disable=f.args.iam.disableOwned;f.args.iam.disableOwned=async()=>{f.state.now+=151000;return disable();};}
  if(stage==='OAuth-cleanup'){const close=f.args.owner.close;f.args.owner.close=async()=>{f.state.now+=271000;return close();};}
  const result=await runCopy(f.args);assert.equal(result.kind,'inspection_required');assert.equal(result.canRetry,false);
  assert.equal(f.state.disabled,true);assert.deepEqual(f.state.policy.bindings,[]);assert.equal(f.state.permission,false);assert.equal(f.state.closed,1);
  assert.equal(f.state.mintCount,1);
  if(stage==='before-first')assert.equal(f.sheets.mutations.length,0);
  if(stage==='after-forward')assert.equal(f.sheets.mutations.length,1);
  if(stage.endsWith('cleanup')){assert.ok(result.cleanupFailures.includes('deadline_budget_unproven'));assert.ok(fs.existsSync(path.join(f.args.journalRoot,'helper-copy-active')));}
 });
test('approved inverse recovery uses the same complete budget without resending forward',async t=>{
  const f=await recoveryFixture(t);budgetFixture(f);f.sheets.loseAcknowledgement=true;
  const result=await runCopy(f.args);assert.equal(result.kind,'inverse-copy-restored-and-contained');
  assert.equal(f.sheets.mutations.length,1);assert.equal(f.state.mintCount,1);
});
test('budgeted entry requires exact reviewed budget before any live transport',async t=>{
  const f=await fixture(t);let calls=0;
  const preparedBudget=prepareCopyTimeBudget(f.prepared);assert.equal(preparedBudget.cleanupMillis,270000);assert.equal(preparedBudget.minimumWindowAtMintMillis,420000);
  await assert.rejects(runBudgetedCopy({prepared:f.prepared,input:{...f.args.input,budgetDigest:'wrong'},fetchImpl:async()=>{calls++;}}));assert.equal(calls,0);
});
test('late HTTP settlement is awaited, marked unknown and cannot authorize another call',async()=>{
  let now=1000,finish,calls=0;
  const b=createCopyTimeBudget({startsAtMillis:1000,endsAtMillis:601000,nowMillis:()=>now,
    fetchImpl:async()=>{calls++;return new Promise(resolve=>{finish=()=>resolve(new Response('{}',{status:200}));});}});
  const pending=b.fetch('https://example.test');now=181001;assert.throws(()=>b.complete());
  finish();await assert.rejects(pending);await assert.rejects(b.fetch('https://example.test'));assert.equal(calls,1);
  await b.beginCleanup('file');await b.beginCleanup('iam');await b.beginCleanup('oauth');assert.throws(()=>b.complete());
});

test('concrete budgeted composition runs real transports on synthetic HTTP, verifies rollback and removes temporary access',async t=>{
 const f=await fixture(t),{PARENT,OWNER,WRITER}=require('../scripts/develop-original-writer-provider.cjs');
 let revoked=false,requests=0,mints=0;
 const input={...f.args.input,budgetDigest:prepareCopyTimeBudget(f.prepared).budgetDigest};
 const fetchImpl=async(url,o)=>{
  requests++;f.state.now+=100;assert.ok(o.signal);assert.equal(o.redirect,'error');
  const u=new URL(url),body=o.body?JSON.parse(String(o.body).startsWith('{')?o.body:'{}'):null;
  const reply=(data,status=200)=>new Response(JSON.stringify(data),{status});
  const ownerToken=o.headers?.Authorization==='Bearer fixture-owner';
  if(u.hostname==='oauth2.googleapis.com'){revoked=true;return reply({});}
  if(ownerToken&&revoked)return reply({},401);
  if(u.hostname==='iamcredentials.googleapis.com'){mints++;return reply({accessToken:'fixture-writer',expireTime:new Date(f.state.now+300000).toISOString()});}
  if(u.hostname==='iam.googleapis.com'){
   if(u.pathname.endsWith(':enable')){f.state.disabled=false;return reply({});}
   if(u.pathname.endsWith(':disable')){f.state.disabled=true;return reply({});}
   if(u.pathname.endsWith(':setIamPolicy')){f.state.policy={...body.policy,etag:'next'};return reply(f.state.policy);}
   if(u.pathname.endsWith(':getIamPolicy'))return reply(f.state.policy);
   if(u.pathname.endsWith(':testIamPermissions'))return reply({permissions:['iam.serviceAccounts.getAccessToken']});
   if(u.pathname.endsWith('/keys'))return reply({});
   return reply({...IDENTITY,disabled:f.state.disabled});
  }
  if(u.hostname==='cloudresourcemanager.googleapis.com')return reply(u.pathname.endsWith(':getIamPolicy')?{bindings:[]}:{projectId:'reguerta-9f27f'});
  if(['cloudfunctions.googleapis.com','run.googleapis.com'].includes(u.hostname))return reply({});
  assert.ok(u.pathname.includes(f.prepared.fileId));
  if(u.hostname==='www.googleapis.com'){
   if(!ownerToken)return reply({id:f.prepared.fileId},f.state.permission?200:404);
   if(o.method==='POST'){f.state.permission=true;return reply({id:'writer'});}
   if(o.method==='DELETE'){f.state.permission=false;return new Response(null,{status:204});}
   if(u.pathname.endsWith('/permissions'))return reply({permissions:[{id:'owner',type:'user',role:'owner',emailAddress:OWNER},
    ...(f.state.permission?[{id:'writer',type:'user',role:'writer',emailAddress:WRITER}]:[])]});
   return reply({id:f.prepared.fileId,mimeType:'application/vnd.google-apps.spreadsheet',trashed:false,version:String(f.sheets.revision),parents:[PARENT],owners:[{permissionId:'owner',emailAddress:OWNER,me:true}]});
  }
  assert.equal(u.hostname,'sheets.googleapis.com');
  if(o.method==='POST'){const result=await f.sheets.batchUpdate({spreadsheetId:f.prepared.fileId,requestBody:body},{retry:false});return reply(result.data);}
  if(ownerToken){const raw=structuredClone(f.sheets.state);raw.sheets.forEach(s=>{delete s.dataCoverage;delete s.protectedRanges;delete s.merges;});return reply(raw);}
  return reply((await f.sheets.get({spreadsheetId:f.prepared.fileId,fields:u.searchParams.get('fields'),...(u.searchParams.has('ranges')?{ranges:u.searchParams.getAll('ranges')}:{})},{retry:false})).data);
 };
 const result=await runBudgetedCopy({prepared:f.prepared,input,iamBearer:'fixture-iam',ownerBearer:'fixture-owner',fetchImpl,
  nowMillis:f.args.nowMillis,sleep:f.args.sleep,journalRoot:f.args.journalRoot});
 assert.equal(result.kind,'full-copy-restored-and-contained',JSON.stringify(result));assert.equal(result.completedBatches,2);
 assert.equal(mints,1);assert.equal(f.state.disabled,true);assert.equal(f.state.permission,false);assert.deepEqual(f.state.policy.bindings,[]);assert.equal(revoked,true);assert.ok(requests>30);
 const restored=structuredClone(f.sheets.state);restored.sheets.forEach(s=>{s.developerMetadata=[];});assert.deepEqual(restored,f.prepared.baseline);
});

test('cleanup joins sibling HTTP reads after early Promise.all rejection',async()=>{
 let finish;
 const b=createCopyTimeBudget({startsAtMillis:1000,endsAtMillis:601000,nowMillis:()=>1000,fetchImpl:async url=>{
  if(url.endsWith('fail'))throw Error('unavailable');
  return new Promise(resolve=>{finish=()=>resolve(new Response('{}',{status:200}));});
 }});
 const slow=b.fetch('https://example.test/slow');await assert.rejects(Promise.all([b.fetch('https://example.test/fail'),slow]));
 let cleaned=false;const cleanup=b.beginCleanup('file').then(()=>{cleaned=true;});await Promise.resolve();assert.equal(cleaned,false);
 finish();await slow;await cleanup;assert.equal(cleaned,true);assert.equal(b.complete().inFlight,0);
});
