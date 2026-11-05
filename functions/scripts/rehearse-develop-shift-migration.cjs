"use strict";

// Preserve the original fixed-loopback boundary. Shared develop composition
// lives in its own guarded entry point and never changes this rehearsal target.
const {Firestore} = require("@google-cloud/firestore");
const engine = require("./develop-shift-migration-engine.cjs");
const {createShiftPlanningDigest:digest} = require("../lib/shift-planning-digest.js");
const {KIND,verifyClosedPolicy} = require("./develop-closed-migration-policy.cjs");
const {PROJECT_ID, HOST} = engine;
const requireDemo = () => {
  if (process.env.GCLOUD_PROJECT !== PROJECT_ID || process.env.FIRESTORE_EMULATOR_HOST !== HOST)
    throw new Error("migration_rehearsal_rejected: fixed demo emulator required");
};
function prepareDevelopShiftMigration(input) {
  if (input.targetProjectId !== undefined && input.targetProjectId !== PROJECT_ID)
    throw new Error("migration_rehearsal_rejected: fixed demo preparation required");
  return engine.prepareDevelopShiftMigration({...input,targetProjectId:PROJECT_ID});
}
function createDevelopShiftMigrationRehearsal(input) {
  requireDemo();
  if (input.prepared.projectId !== PROJECT_ID || input.prepared.scope !== "loopback_emulator_only")
    throw new Error("migration_rehearsal_rejected: fixed demo preparation required");
  const {preparedDigest,...body}=input.prepared;
  if (digest(body)!==preparedDigest || input.prepared.liveExecutable!==false || input.prepared.environment!=="develop")
    throw new Error("migration_rehearsal_rejected: prepared binding");
  engine.checkContentPositions(input.prepared.content);
  if (input.prepared.policyDraft.document.kind===KIND) verifyClosedPolicy(input.prepared.policyDraft);
  return engine.createDevelopShiftMigrationEngine({...input,firestore:new Firestore({projectId:PROJECT_ID,host:HOST,ssl:false})});
}
module.exports = {PROJECT_ID,HOST,WORKBOOK_ID:engine.WORKBOOK_ID,checkContentPositions:engine.checkContentPositions,
  decodeRESTValue:engine.decodeRESTValue,decodeRESTDocument:document=>engine.decodeRESTDocument(document,PROJECT_ID),
  createLocalMigrationPolicyDraft:engine.createLocalMigrationPolicyDraft,prepareDevelopShiftMigration,
  createDevelopShiftMigrationRehearsal,historicalMigrationPlanBindings:engine.historicalMigrationPlanBindings};
if (require.main === module) throw new Error("migration_rehearsal_rejected: isolated emulator harness required; no live CLI");
