"use strict";

// Explicit composition for an already reviewed window. Credentials are supplied
// in memory, never loaded from ADC/environment or written to the journal. There
// is no CLI, deployment, maintenance switch or automatic inverse here.
const assert=require("node:assert/strict");
const {createHash}=require("node:crypto");
const path=require("node:path");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {createShiftSheetsAdapter}=require("../lib/shift-sheets.js");
const {createShiftSheetsConfig}=require("../lib/shift-sheets-config.js");
const {assertShiftSheetsOwnerPreservation:preserved}=require("../lib/shift-sheets-owner-manifest.js");
const {FILE,WRITER,PERMISSION,validateMetadata,metadataFingerprint}=require("./develop-original-writer-provider.cjs");
const {createOriginalWindowOwner,openOriginalWindowWriter,planOriginalWindowBatch}=require("./develop-original-window-provider.cjs");
const {createIamProvider}=require("./develop-writer-copy-provider.cjs");
const {createIsolationReader}=require("./develop-helper-copy-provider.cjs");
const {prepare,grantFor,removeOwnGrant,checkIdentity}=require("./prepare-develop-writer-rehearsal.cjs");
const {planBatch}=require("./prepare-develop-helper-batch.cjs");
const IDENTITY=Object.freeze({email:WRITER,uniqueId:"110752956317536684858"});
const descriptor=c=>({sessionId:c.sessionId,credentialDigest:createHash("sha256").update(c.bearer).digest("hex"),expiresAtMillis:c.expiresAtMillis});
const id=v=>assert.match(v,/^[A-Za-z0-9_-]{6,100}$/);

function createOriginalWindowSessions({expectedBinding,authorization,ownerCredential,iamBearer,ownerChannel,
  sourceInput,reviewPackage,forwardPlan=null,forwardReadBack=null,recoveryWriterCredential=null,barrier,executor,nowMillis=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms))}) {
  expectedBinding=structuredClone(expectedBinding);authorization=structuredClone(authorization);ownerChannel={...ownerChannel};
  sourceInput=structuredClone(sourceInput);reviewPackage=structuredClone(reviewPackage);forwardPlan=structuredClone(forwardPlan);
  forwardReadBack=structuredClone(forwardReadBack);ownerCredential={...ownerCredential};
  recoveryWriterCredential=recoveryWriterCredential?{...recoveryWriterCredential}:null;
  const bindingDigest=digest(expectedBinding),grant=grantFor(expectedBinding.window);
  grant.condition.title="hu084-original-controlled-window";
  grant.condition.description="One reviewed develop direction; exact cleanup after interruption";
  assert.equal(expectedBinding.environment,"develop");assert.ok(["reguerta-9f27f","demo-reguerta-hu084-migration"].includes(expectedBinding.projectId));
  id(authorization.receiptId);assert.equal(authorization.authorized,true);assert.equal(authorization.bindingDigest,bindingDigest);
  assert.equal(ownerChannel.kind,"native-drive-owner-sharing");assert.equal(ownerChannel.reviewDigest,authorization.ownerChannelReviewDigest);
  assert.equal(typeof ownerChannel.grant,"function");assert.equal(typeof ownerChannel.remove,"function");
  assert.equal(typeof ownerCredential.bearer,"string");assert.ok(ownerCredential.bearer.length);id(ownerCredential.sessionId);
  assert.ok(Number.isSafeInteger(ownerCredential.expiresAtMillis));assert.ok(typeof iamBearer==="string"&&iamBearer.length);
  assert.equal(expectedBinding.reviewPackageDigest,reviewPackage.packageDigest);
  assert.equal(expectedBinding.forwardReceiptDigest,forwardReadBack===null?null:digest(forwardReadBack));
  assert.equal(expectedBinding.forwardPlanDigest,forwardPlan===null?null:digest(forwardPlan));
  if(expectedBinding.projectId==="reguerta-9f27f"||expectedBinding.scope.expectedWorkbookFileId!==undefined)
    assert.equal(expectedBinding.scope.expectedWorkbookFileId,FILE);
  const credential=descriptor(ownerCredential),permission={fileId:FILE,permissionId:PERMISSION,type:"user",role:"writer",emailAddress:WRITER};
  let consumed=false,cached=null;
  function values(saved){return saved.records.map(r=>r.value);}
  function context({binding,timeBudget,record,saved=null}) {
    assert.equal(digest(binding),bindingDigest);if(saved){assert.equal(digest(saved.binding),bindingDigest);assert.equal(path.basename(saved.directory),authorization.receiptId);}
    const iam=createIamProvider({identity:IDENTITY,iamBearer,fetchImpl:timeBudget.fetch});
    const isolation=createIsolationReader({iamBearer,fetchImpl:timeBudget.fetch,nowMillis});
    const owner=createOriginalWindowOwner({ownerBearer:ownerCredential.bearer,fetchImpl:timeBudget.fetch,nowMillis,sleep});
    let records=saved?values(saved):[],writer=null,expiry=0,positive=false,transition=null,registrationValid=false;
    const note=async value=>{await record(value);records.push(structuredClone(value));};
    const cleanupRecord=async value=>{try{await note(value);return true;}catch{return false;}};
    const matching=phase=>records.filter(v=>v.phase===phase);
    const intent=phase=>matching(phase).length>0;
    function ownership(){
      const v=matching("google-session-ownership");assert.equal(v.length,1);const own=v[0];
      assert.equal(own.bindingDigest,bindingDigest);assert.equal(own.receiptId,authorization.receiptId);assert.deepEqual(own.identity,IDENTITY);assert.deepEqual(own.grant,grant);
      validateMetadata(own.baseline.after,false);assert.equal(own.baseline.snapshotDigest,digest(own.baseline.snapshot));
      checkIdentity({...own.iam,account:{...own.iam.account,disabled:false}},{identity:IDENTITY},[]);
      assert.equal(own.iam.account.disabled,true);return own;
    }
    const current=()=>{timeBudget.assertStage();assert.ok(nowMillis()<credential.expiresAtMillis);};
    async function identity(disabled,bindings){
      const end=nowMillis()+60000;
      for(;;){timeBudget.assertStage();assert.ok(nowMillis()<end);
        const v=await iam.readIdentity();checkIdentity({...v,account:{...v.account,disabled:false}},{identity:IDENTITY},bindings);
        if(intent("google-session-ownership"))assert.equal(digest(v.projectPolicy),digest(ownership().iam.projectPolicy));
        if((v.account.disabled===true)===disabled)return v;
        await sleep(Math.min(5000,end-nowMillis()));}
    }
    async function isolated(){const v=await isolation();assert.equal(v.writerIsolated,true);return v;}
    async function observeSheets(){current();return owner.capture(true);}
    const readOnlySheets=createShiftSheetsAdapter({config:createShiftSheetsConfig({environment:"develop",workbooks:{develop:FILE}}),sheets:owner.sheets});
    const cleanup={
      async file(){
        if(!intent("google-file-grant-intent"))return {verified:true,kind:"not-attempted"};
        const own=ownership();let logged=true,value=await owner.read();assert.equal(value.file.id,FILE);
        const found=value.filePermissions.find(p=>p.id===PERMISSION);
        if(found){assert.equal(found.emailAddress,WRITER);assert.equal(found.type,"user");assert.equal(found.role,"writer");
          assert.ok(!(found.permissionDetails??[]).some(d=>d.inherited));
          logged=await cleanupRecord({phase:"google-file-remove-intent",permission})&&logged;await ownerChannel.remove(structuredClone(permission),{assertActive:timeBudget.assertStage});}
        value=await owner.read();validateMetadata(value,false);
        assert.equal(metadataFingerprint(value,{omitVersion:true}),metadataFingerprint(own.baseline.after,{omitVersion:true}));
        // A restarted process has no writer token. ACL absence is retained as
        // metadata evidence; it must not be labelled a same-token denial.
        let denial=null;
        if(!writer&&recoveryWriterCredential){
          const issued=matching("google-writer-issued").at(-1),candidate=recoveryWriterCredential;
          assert.ok(issued);assert.equal(createHash("sha256").update(candidate.bearer).digest("hex"),issued.credentialDigest);
          assert.equal(candidate.expiresAtMillis,issued.expiresAtMillis);
          assert.ok(matching("google-writer-positive").some(v=>v.credentialDigest===issued.credentialDigest));
          expiry=issued.expiresAtMillis;
          writer=openOriginalWindowWriter({bearer:candidate.bearer,expiresAtMillis:expiry,fetchImpl:timeBudget.fetch,nowMillis,
            assertSubmission:()=>{throw Error("recovery_cannot_write");},authorizeBatch:async()=>{throw Error("recovery_cannot_write");}});
          positive=true;
        }
        if(writer&&positive&&nowMillis()<expiry){denial=await writer.probe();assert.ok([403,404].includes(denial.status));assert.ok(nowMillis()<expiry);}
        else if(intent("google-mint-intent")) {
          const prior=matching("google-file-closed").at(-1);
          if(!prior?.sameUnexpiredToken)throw Error("writer_token_denial_unverified_after_restart");
          assert.deepEqual(prior.permission,permission);denial=prior.denial;
        }
        const receipt={verified:true,permission,denial,sameUnexpiredToken:denial!==null};logged=await cleanupRecord({phase:"google-file-closed",...receipt})&&logged;assert.equal(logged,true,"File cleanup evidence unavailable");return receipt;
      },
      async iam(){
        if(!intent("google-enable-intent"))return {verified:true,kind:"not-attempted"};
        ownership();const failures=[];
        try{const v=await iam.readIdentity();assert.equal(v.account.uniqueId,IDENTITY.uniqueId);assert.equal(v.account.email,WRITER);
          const next=removeOwnGrant(v.policy,grant);if(digest(next.bindings)!==digest(v.policy.bindings??[])){
            if(!await cleanupRecord({phase:"google-iam-remove-intent",grant}))failures.push("grant-journal-unavailable");await iam.setPolicy(next);}}
        catch{failures.push("grant-removal-unverified");}
        try{if(!await cleanupRecord({phase:"google-disable-intent",identity:IDENTITY}))failures.push("disable-journal-unavailable");await iam.disableOwned();}catch{failures.push("disable-unverified");}
        try{await identity(true,[]);await isolated();}catch{failures.push("identity-unverified");}
        writer?.close();assert.deepEqual(failures,[]);
        const result={verified:true,identity:IDENTITY,grant};assert.equal(await cleanupRecord({phase:"google-iam-closed",...result}),true);return result;
      },
      async oauth(){
        // Every descriptor belongs to this journal; a new credential can never
        // satisfy a prior descriptor's cleanup obligation, even with the same ID.
        let closed=null;try{closed=await owner.close();assert.equal(closed.verified,true);
          assert.equal(await cleanupRecord({phase:"google-owner-closed",credential,cleanup:closed}),true);}finally{writer?.close();ownerCredential.bearer=null;iamBearer=null;recoveryWriterCredential=null;}
        assert.equal(registrationValid,true,"Owner registration incomplete");
        const pending=matching("google-owner-session").filter(open=>!matching("google-owner-closed").some(done=>
          digest(done.credential)===digest(open.credential)&&done.cleanup?.verified===true));
        assert.deepEqual(pending,[],"Prior owner OAuth session remains unverified");
        return {verified:true,sessionIds:matching("google-owner-session").map(v=>v.credential.sessionId),cleanup:closed};
      },
    };
    const session={cleanup,observeSheets,inspect:{
      barrier:()=>barrier.inspectRetained({scope:expectedBinding.scope}),
      firestore:()=>executor.inspectUncertain({scope:expectedBinding.scope,direction:expectedBinding.direction,forwardReadBack}),
      sheets:async saved=>{
        const plan=values(saved).findLast(v=>v.phase==="intent")?.plan;if(!plan)return {kind:"not-started"};
        assert.equal(plan.reviewPackageDigest,reviewPackage.packageDigest);
        const {planDigest,...body}=plan;assert.equal(planDigest,digest(body));
        const metadata=await owner.read(),present=metadata.filePermissions.some(p=>p.id===PERMISSION);
        const observed=await owner.capture(present),result=await readOnlySheets.inspect(plan.operation);
        if(result.kind==="verified")preserved({manifest:plan.preservation,after:observed.snapshot});
        return {kind:result.kind,result,snapshotDigest:observed.snapshotDigest};
      }}};
    async function registerOwner(){
      const old=matching("google-owner-session").find(v=>v.credential.sessionId===credential.sessionId);
      if(old)assert.deepEqual(old.credential,credential,"Session ID cannot identify another credential");
      else await note({phase:"google-owner-session",credential});
      registrationValid=true;
    }
    return {session,timeBudget,registerOwner,records,note,owner,iam,current,identity,isolated,ownership,
      async start(){
        await registerOwner();current();await isolated();const initialIam=await iam.readIdentity();
        checkIdentity({...initialIam,account:{...initialIam.account,disabled:false}},{identity:IDENTITY},[]);
        assert.equal(initialIam.account.disabled,true,"Pre-existing active writer requires separate recovery");
        const before=await owner.capture(false);
        // Verify complete reviewed cells before acquiring any writer authority.
        await planBatch({sourceInput,reviewPackage,observation:before,direction:expectedBinding.direction,forwardPlan});current();
        await note({phase:"google-session-ownership",receiptId:authorization.receiptId,bindingDigest,identity:IDENTITY,grant,baseline:before,iam:initialIam});
        await note({phase:"google-enable-intent",identity:IDENTITY});await iam.enableOwned();const enabled=await identity(false,[]);current();
        await note({phase:"google-iam-grant-intent",grant});await iam.setPolicy({...enabled.policy,version:3,bindings:[grant]});const grantedAt=nowMillis();
        await note({phase:"google-file-grant-intent",permission});await ownerChannel.grant(structuredClone(permission),{assertActive:timeBudget.assertStage});current();
        const end=Math.min(grantedAt+180000,expectedBinding.window.endsAtMillis-420000);
        for(;;){current();await identity(false,[grant]);const ready=await iam.hasMintPermission();assert.ok(nowMillis()<end);
          if(ready&&nowMillis()>=grantedAt+120000)break;await sleep(Math.min(5000,end-nowMillis()));}
        await isolated();const after=await owner.capture(true);transition={before,after};
        const plan=await planOriginalWindowBatch({sourceInput,reviewPackage,observation:after,direction:expectedBinding.direction,forwardPlan,permissionTransition:transition});
        current();await note({phase:"google-permission-transition",transition,planDigest:plan.planDigest});
        await note({phase:"google-mint-intent",request:prepare().tokenRequest,attempt:1});
        let token=await iam.mint(prepare().tokenRequest),writerDigest=null;
        try{assert.ok(typeof token.accessToken==="string"&&token.accessToken.length);writerDigest=createHash("sha256").update(token.accessToken).digest("hex");expiry=Date.parse(token.expireTime);assert.ok(Number.isSafeInteger(expiry)&&expiry<=nowMillis()+300000&&expiry>nowMillis()+210000);
          writer=openOriginalWindowWriter({bearer:token.accessToken,expiresAtMillis:expiry,fetchImpl:timeBudget.fetch,nowMillis,
            assertSubmission:()=>timeBudget.assertSubmission(),authorizeBatch:async body=>{
              assert.deepEqual(Object.keys(body),["requests"]);assert.deepEqual(body.requests,plan.requests);
              await identity(false,[grant]);await isolated();const fresh=await owner.capture(true);
              assert.equal(fresh.snapshotDigest,plan.observationDigest);assert.equal(fresh.after.file.version,plan.observedVersion);
              await note({phase:"google-batch-dispatch-intent",planDigest:plan.planDigest,requestDigest:plan.requestDigest});
            }});
        }finally{token=null;}
        await note({phase:"google-writer-issued",expiresAtMillis:expiry,credentialDigest:writerDigest});assert.equal((await writer.probe()).status,200);positive=true;
        await note({phase:"google-writer-positive",credentialDigest:writerDigest});
        session.tokenExpiresAtMillis=expiry;session.permissionTransition=transition;session.barrier=barrier;session.executor=executor;
        session.sheetsAdapter=createShiftSheetsAdapter({config:createShiftSheetsConfig({environment:"develop",workbooks:{develop:FILE}}),sheets:writer.sheets});
        return session;
      }};
  }
  return {
    async openSession(args){assert.equal(args.receiptId,authorization.receiptId);assert.equal(consumed,false,"Google window session already consumed");consumed=true;
      cached=context(args);try{return await cached.start();}catch{return {...cached.session,setupFailed:true};}},
    async openRecoverySession(args){
      assert.equal(digest(args.binding),bindingDigest);
      if(cached?.timeBudget===args.timeBudget)return {cleanup:cached.session.cleanup,inspect:cached.session.inspect};
      cached=context(args);try{await cached.registerOwner();}catch{/* Cleanup still owns this explicit credential. */}
      return {cleanup:cached.session.cleanup,inspect:cached.session.inspect};
    },
  };
}
module.exports={createOriginalWindowSessions};
if(require.main===module){console.error("explicit_original_window_authority_required_no_cli");process.exitCode=1;}
