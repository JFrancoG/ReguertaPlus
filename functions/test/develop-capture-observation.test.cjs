"use strict";
const assert = require("node:assert/strict"), {test} = require("node:test"), {createHash} = require("node:crypto");
const {input} = require("./develop-planner-entry-fixture.cjs");
const {observeDevelopCaptureControls: observe} = require("../scripts/observe-develop-capture-controls.cjs");
function ports() {
  const reviewedFunctions = input().reviewedFunctions;
  for (const fn of reviewedFunctions) fn.eventTrigger.trigger = fn.name.replace('/functions/', '/triggers/');
  const bytes = Buffer.from("reviewed deployment archive");const calls = [];
  const reviewedArchives = reviewedFunctions.map(fn => ({target: fn.name.split('/').at(-1),
    source: fn.buildConfig.sourceProvenance.resolvedStorageSource, archiveSha256: createHash('sha256').update(bytes).digest('hex')}));
  const queues = {readOnly: true, projectId: 'reguerta-9f27f', observedAt: new Date(200).toISOString(),
    bindings: reviewedArchives.map(x => ({id: x.target, transportBinding: true, functionObserved: true, subscriptionObserved: true})),
    metrics: [{type: 'backlog', observed: true, exhausted: true, series: []}]};
  let clock = 0;
  return {calls, queues, args: {reviewedFunctions, reviewedArchives,
    readFunction: async name => {calls.push(name);return structuredClone(reviewedFunctions.find(x => x.name === name));},
    readArchive: async () => bytes, readQueues: async () => structuredClone(queues), nowMillis: () => (++clock)*100}};
}
test('connects all eight reviewed deployments and real archive bytes while leaving missing metrics UNKNOWN', async () => {
  const p = ports(), result = await observe(p.args);
  assert.equal(p.calls.length, 16);assert.equal(result.proofs.length, 4);
  assert.equal(result.queueSamples[0].status, 'UNKNOWN');assert.equal(result.causalDrain, null);
  assert.equal(result.canEnterMaintenance, false);assert.equal(result.canApply, false);
});
test('explicit zero samples still do not manufacture causal drain or maintenance admission', async () => {
  const p = ports();p.queues.metrics[0].series = [{latestValue: '0'}];
  const result = await observe(p.args);assert.equal(result.queueSamples[0].status, 'SAMPLED_ONLY');
  assert.equal(result.causalDrain, null);assert.equal(result.canEnterMaintenance, false);
});
for (const [label, change] of [
  ['unreviewed archive', p => {p.args.readArchive = async () => Buffer.from('changed');}],
  ['missing archive binding', p => {p.args.reviewedArchives.pop();}],
  ['archive generation drift', p => {p.args.reviewedArchives[0] = {...p.args.reviewedArchives[0], source: {...p.args.reviewedArchives[0].source, generation:'999'}};}],
  ['changed runtime', p => {const read=p.args.readFunction;p.args.readFunction=async name=>{const v=await read(name);v.serviceConfig.revision='changed';return v;};}],
  ['unbound transport', p => {p.queues.bindings[0].transportBinding=false;}],
  ['duplicate transport', p => {p.queues.bindings[0]=p.queues.bindings[1];}],
  ['stale queue observation', p => {p.queues.observedAt=new Date(0).toISOString();}],
  ['other project queues', p => {p.queues.projectId='other';}],
  ['partial queue metadata', p => {p.queues.bindings[0].subscriptionObserved=false;}],
]) test(`rejects ${label}`, async () => {const p=ports();change(p);await assert.rejects(observe(p.args));});
test('rejects a deployment changed during archive/queue reads', async () => {
  const p=ports(),read=p.args.readFunction;let count=0;
  p.args.readFunction=async name=>{const fn=await read(name);if(++count>8)fn.serviceConfig.revision='new-revision';return fn;};
  await assert.rejects(observe(p.args));
});
test('validates fixed function selectors before invoking any provider', async () => {
  const p=ports();p.args.reviewedFunctions[0].name='projects/other/locations/europe-west1/functions/unknown';
  await assert.rejects(observe(p.args));assert.equal(p.calls.length,0);
});
