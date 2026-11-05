"use strict";

// Explicit GET-only, single-read-time census of the four retained intake routes.
// The executor separately reads the complete planner source in its transaction.
const assert=require("node:assert/strict");
const {inspectCensus}=require("./inspect-develop-legacy-census.cjs");
const BASE="projects/reguerta-9f27f/databases/(default)/documents";
const ROOT=`${BASE}/shiftPlanningDevelopIntake/current`;
const COLLECTIONS=["shiftPlanningRequests","shifts","deliveryCalendar","notificationEvents"];
function createDevelopCensusReader({bearer}) {
  assert.ok(typeof bearer==="string"&&bearer.length);
  const readCensus=async function({fetchImpl,nowMillis}) {
    assert.ok(typeof bearer==="string"&&bearer.length,"Census reader closed");assert.equal(typeof fetchImpl,"function");const readTime=new Date(nowMillis()).toISOString();
    async function get(name,query={}) {
      const q=new URLSearchParams({readTime,...query});
      const r=await fetchImpl(`https://firestore.googleapis.com/v1/${name}?${q}`,{method:"GET",redirect:"error",
        headers:{Authorization:`Bearer ${bearer}`},signal:AbortSignal.timeout(20000)});
      assert.equal(r.status,200,"Develop census unavailable");return r.json();
    }
    async function list(parent,collectionId,limit) {
      const values=[],tokens=new Set();let pageToken;
      do {const r=await get(`${parent}/${collectionId}`,{pageSize:"100",...(pageToken?{pageToken}:{})});
        assert.ok(r.documents===undefined||Array.isArray(r.documents));values.push(...r.documents??[]);
        assert.ok(values.length<=limit,"Census bound exceeded");pageToken=r.nextPageToken;
        if(pageToken){assert.equal(typeof pageToken,"string");assert.ok(!tokens.has(pageToken),"Repeated census page");tokens.add(pageToken);assert.ok(tokens.size<=Math.ceil(limit/100));}
      }while(pageToken);return values;
    }
    const result={schemaVersion:1,projectId:"reguerta-9f27f",readOnly:true,atomicSnapshot:true,readTime,canApply:false,canClaimClosure:false,
      intakeBefore:await get(ROOT),collections:{},events:[],deliveries:[],chunks:{}};
    for(const collection of COLLECTIONS)result.collections[collection]=await list(`${BASE}/develop/plus-collections`,collection,5000);
    result.events=await list(ROOT,"events",5000);result.deliveries=await list(ROOT,"deliveries",10000);
    for(const event of result.events){assert.match(event.name,new RegExp(`^${ROOT.replace(/[()]/g,"\\$&")}/events/[a-f0-9]{64}$`));result.chunks[event.name]=await list(event.name,"chunks",32);}
    result.intakeAfter=await get(ROOT);inspectCensus(result);return result;
  };
  readCensus.close=()=>{bearer=null;};return readCensus;
}
module.exports={createDevelopCensusReader};
if(require.main===module){console.error("explicit_readonly_develop_census_required_no_cli");process.exitCode=1;}
