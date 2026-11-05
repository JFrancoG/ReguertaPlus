"use strict";

// Reviewed full-backend transitions change only the owner-manifest validator
// (eae86a89), then the opt-in cooperative barrier phase port (ADR-0027), each .ts
// plus compiled .js. Reconstructing all 285 entries with the two previous barrier
// files reproduces AFTER exactly. Retain historical outcomes without claiming
// either older execution exercised the new phase port or supplies live authority.
const assert=require("node:assert/strict");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {prepare}=require("./prepare-develop-writer-rehearsal.cjs");
const BEFORE="shift-planning:v1:sha256:2c63c31b681ef4b8b96c00d1f0f79225e5883d50785cb04fc2a29956b29ce669";
const AFTER="shift-planning:v1:sha256:049fe823dbd8a7c75f371566cc435892c719a88805d3692a0996ebf72e2ed741";
const CURRENT="shift-planning:v1:sha256:605161ccc9a50fba28591ffdef39ab07c96ce4c5e86dca8f3608092ff4169972";
const HISTORICAL=[[BEFORE,"historical-eae86a89-validator-transition"],[AFTER,"historical-pre-coherent-barrier-phase"]];
const COPY_BUDGET_BEFORE="shift-planning:v1:sha256:1f0b3841a7ff4af2016b8ad9f0adc0564d60e7e606d6504e3b940d0285031bd5";
const COPY_BUDGET_CURRENT="shift-planning:v1:sha256:d421ade92e5e3e09202547dd68ee1869d8b2abd72f223ffb887298f5c8947af1";

function historicalIamPreparation(current=prepare(),runnerSourceDigest=BEFORE) {
  assert.equal(current.runnerSourceDigest,CURRENT,"unreviewed backend transition");
  assert.ok(HISTORICAL.some(([value])=>value===runnerSourceDigest),"unreviewed historical backend");
  const {preparationDigest,...body}=current;assert.equal(digest(body),preparationDigest);
  body.runnerSourceDigest=runnerSourceDigest;
  return {...body,preparationDigest:digest(body)};
}
function reviewIamPreparation(observed) {
  const current=prepare();
  if(digest(observed)===digest(current))return "exact-reviewed-sources";
  for(const [source,label]of HISTORICAL)if(digest(observed)===digest(historicalIamPreparation(current,source)))return label;
  assert.fail("unreviewed historical execution contract");
}
function reviewIamPreparationDigest(observed) {
  const current=prepare();
  if(observed===current.preparationDigest)return "exact-reviewed-sources";
  for(const [source,label]of HISTORICAL)if(observed===historicalIamPreparation(current,source).preparationDigest)return label;
  assert.fail("unreviewed historical IAM preparation");
}
function reviewHelperExecutionDigest(observed,current) {
  if(observed===current)return "exact-reviewed-execution-sources";
  // Only optional deadline hooks changed in the consumed copy runner. Its
  // historical success is retained, never promoted to proof of the new budget.
  assert.equal(observed,"shift-planning:v1:sha256:12119f8b99eb2148713062268a185bf0d8830a038bd0126385237d5de0bcbd17");
  assert.equal(current,"shift-planning:v1:sha256:ec4692f205dbbde1ce9571257f62d125d4f2e38d5e48f0f84d7d54cc981c2ba3","unreviewed copy runner transition");
  return "historical-pre-deadline-copy-execution";
}
// The explicit original-develop opt-in adds a twenty-minute preparation path.
// The default synthetic-copy contract is byte-for-byte reconstructed except
// for this exact source hash. No copy deadline, token or safety field changes.
function historicalCopyTimeBudget(current) {
  const {budgetDigest,...body}=structuredClone(current);assert.equal(digest(body),budgetDigest);
  assert.equal(body.sourceDigest,COPY_BUDGET_CURRENT,"unreviewed budget source transition");
  assert.equal(body.kind,"isolated-copy-deadline-budget");
  assert.deepEqual(body.limits,{window:600000,work:150000,fileCleanup:60000,iamCleanup:90000,oauthCleanup:120000});
  assert.equal(body.cleanupMillis,270000);assert.equal(body.minimumWindowAtMintMillis,420000);
  assert.equal(body.tokenLifetimeMillis,300000);assert.equal(body.maximumTokens,1);
  assert.equal(body.canExecute,false);assert.equal(body.canEnterMaintenance,false);
  body.sourceDigest=COPY_BUDGET_BEFORE;
  return {...body,budgetDigest:digest(body)};
}
function reviewCopyTimeBudget(observed,current) {
  if(digest(observed)===digest(current))return "exact-reviewed-budget-sources";
  assert.deepEqual(observed,historicalCopyTimeBudget(current),"unreviewed historical copy budget");
  return "historical-pre-original-deferred-writer-budget";
}
module.exports={historicalIamPreparation,reviewIamPreparation,reviewIamPreparationDigest,reviewHelperExecutionDigest,
  historicalCopyTimeBudget,reviewCopyTimeBudget};
