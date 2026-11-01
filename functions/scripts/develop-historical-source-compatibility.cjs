"use strict";

// Reviewed transition eae86a89 changes only the owner-manifest validator (.ts
// and its compiled .js): Google's derived SHEET location is accepted for the
// exact expected marker. Reconstructed historical/current full backend manifests
// match these pins. This preserves historical outcomes, not live authority or a
// claim that an older execution exercised the newer validator.
const assert=require("node:assert/strict");
const {createShiftPlanningDigest:digest}=require("../lib/shift-planning-digest.js");
const {prepare}=require("./prepare-develop-writer-rehearsal.cjs");
const BEFORE="shift-planning:v1:sha256:2c63c31b681ef4b8b96c00d1f0f79225e5883d50785cb04fc2a29956b29ce669";
const AFTER="shift-planning:v1:sha256:049fe823dbd8a7c75f371566cc435892c719a88805d3692a0996ebf72e2ed741";

function historicalIamPreparation(current=prepare()) {
  assert.equal(current.runnerSourceDigest,AFTER,"unreviewed backend transition");
  const {preparationDigest,...body}=current;assert.equal(digest(body),preparationDigest);
  body.runnerSourceDigest=BEFORE;
  return {...body,preparationDigest:digest(body)};
}
function reviewIamPreparation(observed) {
  const current=prepare();
  if(digest(observed)===digest(current))return "exact-reviewed-sources";
  assert.deepEqual(observed,historicalIamPreparation(current),"unreviewed historical execution contract");
  return "historical-eae86a89-validator-transition";
}
function reviewIamPreparationDigest(observed) {
  const current=prepare();
  if(observed===current.preparationDigest)return "exact-reviewed-sources";
  assert.equal(observed,historicalIamPreparation(current).preparationDigest,"unreviewed historical IAM preparation");
  return "historical-eae86a89-validator-transition";
}
function reviewHelperExecutionDigest(observed,current) {
  if(observed===current)return "exact-reviewed-execution-sources";
  // Only optional deadline hooks changed in the consumed copy runner. Its
  // historical success is retained, never promoted to proof of the new budget.
  assert.equal(observed,"shift-planning:v1:sha256:12119f8b99eb2148713062268a185bf0d8830a038bd0126385237d5de0bcbd17");
  assert.equal(current,"shift-planning:v1:sha256:ec4692f205dbbde1ce9571257f62d125d4f2e38d5e48f0f84d7d54cc981c2ba3","unreviewed copy runner transition");
  return "historical-pre-deadline-copy-execution";
}
module.exports={historicalIamPreparation,reviewIamPreparation,reviewIamPreparationDigest,reviewHelperExecutionDigest};
