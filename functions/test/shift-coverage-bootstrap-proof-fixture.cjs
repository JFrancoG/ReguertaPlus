"use strict";
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {SHIFT_COVERAGE_POLICY_REVISION} = require("../lib/shift-coverage.js");

// Synthetic historical proof for readiness-boundary tests. The real producer,
// source capture and atomic target writes are tested in bootstrap.emulator.
const proof = (environment, {uid = "shared-admin", memberId = `${environment}-admin`, now} = {}) => {
  const decision = {schemaVersion: 1, environment, operationId: "fixture-initialization",
    effectiveAtMillis: now - 5000, confirmationReference: "Synthetic readiness fixture: zero initial balances",
    reserves: "none", credits: "none"};
  const core = {schemaVersion: 1, environment, policyRevision: SHIFT_COVERAGE_POLICY_REVISION,
    operationId: decision.operationId, state: "completed", sourceDigest: digest("fixture-source"),
    decisionDigest: digest(decision), planDigest: digest("fixture-plan"), createsDigest: digest([]),
    decision, actor: {uid, memberId}, completedAtMillis: now - 1000};
  const receipt = {...core, receiptDigest: digest(core)};
  const marker = {schemaVersion: 1, environment, policyRevision: SHIFT_COVERAGE_POLICY_REVISION,
    operationId: receipt.operationId, receiptDigest: receipt.receiptDigest};
  return {receipt, marker};
};
const writeProof = async (db, environment, options) => {
  const value = proof(environment, options), batch = db.batch();
  const root = `${environment}/plus-collections/shiftCoverageMigrations`;
  batch.create(db.doc(`${root}/${value.receipt.operationId}`), value.receipt);
  batch.create(db.doc(`${root}/current`), value.marker);
  await batch.commit();
  return value;
};
module.exports = {proof, writeProof};
