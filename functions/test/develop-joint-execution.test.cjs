"use strict";
const assert=require("node:assert/strict"),{test}=require("node:test");
const {guardFirestore}=require("../scripts/develop-joint-execution.cjs");

test("Firestore guard covers the last read, every queued mutation and callback completion without automatic retry",async()=>{
  for(const at of ["after-read","after-write","callback-end"]){
    let expired=false,queued=0,committed=0,attempts;
    const db={runTransaction:async(fn,options)=>{attempts=options.maxAttempts;const result=await fn({
      getAll:async()=>{if(at==="after-read")expired=true;},
      create(){queued++;if(at==="after-write")expired=true;},update(){queued++;},delete(){queued++;},
    });committed++;return result;}};
    const guarded=guardFirestore(db,()=>assert.equal(expired,false,"expired"));
    await assert.rejects(guarded.runTransaction(async tx=>{
      await tx.getAll();tx.create();if(at==="callback-end")expired=true;else tx.update();
    },{maxAttempts:5}),/expired/);
    assert.equal(committed,0);assert.equal(attempts,1);assert.equal(queued,at==="after-read"?0:1);
  }
});
test("lost response is propagated once and pending transaction is joined rather than raced",async()=>{
  let finish,calls=0,settled=false,committed=false;
  const db={runTransaction:async fn=>{calls++;await fn({create(){}});await new Promise(resolve=>{finish=resolve;});committed=true;throw Error("lost");}};
  const action=guardFirestore(db,()=>{}).runTransaction(async tx=>{tx.create();}).finally(()=>{settled=true;});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(settled,false);assert.equal(committed,false);
  finish();await assert.rejects(action,/lost/);assert.equal(committed,true);assert.equal(calls,1);
});
test("read-only inspection remains readable after the mutation budget expires",async()=>{
  let calls=0;const db={runTransaction:async(fn,options)=>{assert.equal(options.readOnly,true);return fn({getAll:async()=>{calls++;return ["retained"];}});}};
  const result=await guardFirestore(db,()=>{throw Error("expired");}).runTransaction(tx=>tx.getAll(),{readOnly:true});
  assert.deepEqual(result,["retained"]);assert.equal(calls,1);
});
