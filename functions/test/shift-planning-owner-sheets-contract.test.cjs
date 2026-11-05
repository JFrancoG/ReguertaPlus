"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {createShiftSheetsOwnerPreservationManifest: manifestFor} =
  require("../lib/shift-sheets-owner-manifest.js");
const {createShiftPlanningOwnerMaintenanceAgreement: agreementFor} =
  require("../lib/shift-planning-owner-maintenance.js");
const {ownerFixture} = require("./shift-planning-owner-maintenance-fixture.cjs");
const {administratorFixture, agreement: administratorAgreementFor} =
  require("./shift-planning-administrator-maintenance-fixture.cjs");
const {parseShiftPlanningOwnerSheetsAuthorization: authorizationFor,
  shiftPlanningOwnerSheetsAuthorizationDigest: authorizationDigest,
  parseShiftPlanningOwnerSheetsBinding: bindingFor,
  parseShiftPlanningOwnerSheetsProof: proofFor,
  assertShiftPlanningOwnerSheetsProof: assertProof,
  parseShiftPlanningOwnerSheetsAuthorizationSnapshot: snapshotFor} =
  require("../lib/shift-planning-owner-sheets-contract.js");

function fixture() {
  const entry = ownerFixture();
  const before = {spreadsheetId: "reviewed-copy", sheets: [{properties: {
    sheetId: 1, title: "Reviewed", index: 0, sheetType: "GRID", hidden: false,
    gridProperties: {rowCount: 1, columnCount: 1, frozenRowCount: 0,
      frozenColumnCount: 0}}, dataCoverage: "complete", protectedRanges: [],
  merges: [], developerMetadata: [], data: [{startRow: 0, startColumn: 0,
    rowData: [{values: [{userEnteredValue: {stringValue: "before"}}]}]}]}]};
  const manifest = manifestFor({before, requests: [{updateCells: {range: {
    sheetId: 1, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0,
    endColumnIndex: 1}, rows: [{values: [{userEnteredValue: {stringValue: "after"}}]}],
  fields: "userEnteredValue"}}]});
  const batch = {schemaVersion: 1, kind: "owner-sheets-batch", environment: "develop",
    workbookId: "reviewed-copy", commandId: "command-1", commandDigest: digest({command: 1}),
    operationId: "operation-1", writeEpoch: 11, activeRevision: "active-4",
    activeDigest: digest({active: 4}), beforeWorkbookRevision: "10",
    beforeContentDigest: digest(before), beforeAclDigest: digest({acl: 1}),
    beforeProtectionsDigest: digest({protections: 1}), observerPrincipalId: "runtime-writer",
    projectionDigest: digest({projection: 1}), requestDigest: manifest.requestDigest,
    preservationDigest: manifest.preservationDigest, preservationManifestDigest: manifest.digest,
    technicalEvidenceDigest: entry.evidence.digest, maximumEvidenceAgeMillis: 1000};
  const intent = {...entry.agreement.payload.intent, workbookFileId: batch.workbookId,
    expectedWriteEpoch: batch.writeEpoch, expectedActiveRevision: batch.activeRevision,
    expectedActiveDigest: batch.activeDigest, sourceRevision: "10",
    sourceDigest: batch.beforeContentDigest, affectedScopeDigest: digest(batch),
    operations: [{operationId: batch.operationId, kind: "sheets-batch", manifestDigest: digest(batch)}]};
  const agreement = agreementFor(intent, intent.participants.map((participant) => ({...participant,
    intentDigest: digest(intent), confirmationId: `batch-${participant.role}`,
    confirmedAtMillis: 100, onlineClosedNoOfflineEdits: true, noManualOrAutomationWrites: true})));
  const authorization = authorizationFor({schemaVersion: 1, operationKind: "ownerSheetsAuthorization",
    environment: "develop", commandId: batch.commandId, technicalTransitionId: "maintenance-entry-7",
    agreement, batchIntent: batch, preservationManifest: manifest,
    ownerReport: {agreementDigest: agreement.digest, agreementStatus: "confirmed",
      ownerActivity: "none-reported", unresolvedWriteCount: 0,
      participantsDigest: digest({revision: intent.participantsRevision, participants: intent.participants}),
      effectiveAuthorityDigest: intent.effectiveAuthorityDigest, permissionWorkflowClosed: true,
      permissionControlEvidenceDigest: null}});
  return {authorization, batch, manifest};
}

function bindingFixture() {
  const value = fixture();
  const snapshot = {path: "develop/plus-collections/shiftPlanningOperations/approved-batch",
    updateTime: {seconds: 100, nanoseconds: 123456789},
    ownerReportDigest: digest(value.authorization.ownerReport)};
  const unsigned = {schemaVersion: 1, authorizationDigest: authorizationDigest(value.authorization),
    authorizationSnapshot: snapshot, agreement: value.authorization.agreement,
    batchIntent: value.batch, preservationManifest: value.manifest,
    claim: {workerId: "worker-1", attemptId: "attempt-1", fencingEpoch: 4,
      acquiredAtMillis: 500, expiresAtMillis: 800}, controlsValidUntilMillis: 590, preparedAtMillis: 530};
  return {...value, binding: bindingFor({...unsigned, bindingDigest: digest(unsigned)})};
}

test("binds the complete preservation policy rather than only its untouched fingerprint", () => {
  const {authorization, manifest} = fixture();
  const changed = structuredClone(manifest);
  changed.policy.writes[0].value = {stringValue: "unapproved"};
  const {digest: prior, ...unsigned} = changed;
  void prior; changed.digest = digest(unsigned);
  assert.throws(() => authorizationFor({...authorization, preservationManifest: changed}));
  assert.equal(authorizationDigest(authorization), authorizationDigest(
    {...authorization, ownerReport: {...authorization.ownerReport, ownerActivity: "reported"}}));
});

test("records an exact registry version and rejects another environment, lossy nanos or fields", () => {
  const {binding} = bindingFixture();
  assert.deepEqual(snapshotFor(binding.authorizationSnapshot, "develop"), binding.authorizationSnapshot);
  for (const changed of [
    {...binding.authorizationSnapshot, path: "production/plus-collections/shiftPlanningOperations/approved-batch"},
    {...binding.authorizationSnapshot, updateTime: {seconds: 100, nanoseconds: 1e9}},
    {...binding.authorizationSnapshot, updateTime: {seconds: 100.5, nanoseconds: 0}},
    {...binding.authorizationSnapshot, ignored: true},
  ]) assert.throws(() => snapshotFor(changed, "develop"));
});

test("fresh proofs bind the original receipt, registry path, phase and original owner deadline", () => {
  const {binding} = bindingFixture();
  const unsigned = {schemaVersion: 1, bindingDigest: binding.bindingDigest, phase: "readback",
    observationDigest: digest({observed: 1}), authorizationSnapshot: binding.authorizationSnapshot,
    controlsValidUntilMillis: 590, verifiedAtMillis: 550};
  const proof = proofFor({...unsigned, proofDigest: digest(unsigned)});
  assert.doesNotThrow(() => assertProof({binding, proof, phase: "readback", nowMillis: 550}));
  for (const nowMillis of [549, 600, 901]) {
    assert.throws(() => assertProof({binding, proof, phase: "readback", nowMillis}));
  }
  assert.throws(() => assertProof({binding, proof, phase: "completion", nowMillis: 550}));
  const wrong = {...unsigned, authorizationSnapshot: {...unsigned.authorizationSnapshot,
    path: "develop/plus-collections/shiftPlanningOperations/other"}};
  assert.throws(() => assertProof({binding, proof: {...wrong, proofDigest: digest(wrong)},
    phase: "readback", nowMillis: 550}));
});

test("technical writer cannot alias a named human and a postprepared claim cannot replace its deadline", () => {
  const {authorization} = fixture();
  assert.throws(() => authorizationFor({...authorization, batchIntent: {
    ...authorization.batchIntent, observerPrincipalId: "owner-human"}}));
  const {binding} = bindingFixture();
  const {bindingDigest, ...unsigned} = binding;
  void bindingDigest;
  const invalid = {...unsigned, claim: {...unsigned.claim, expiresAtMillis: 530}};
  assert.throws(() => bindingFor({...invalid, bindingDigest: digest(invalid)}));
});

test("explicit v3 Sheets binding and repository proof cannot outlive the independent administrator deadline", () => {
  const base = fixture(), seed = administratorFixture().administratorAgreement.payload.intent;
  const batch = {...base.batch, schemaVersion: 3, technicalControlKind: "develop-administrator-agreement",
    administratorSourceRevision: seed.sourceRevision, administratorSourceDigest: seed.sourceDigest,
    effectiveIamDigest: seed.effectiveIamDigest};
  const ownerIntent = {...base.authorization.agreement.payload.intent, affectedScopeDigest: digest(batch),
    operations: [{operationId: batch.operationId, kind: "sheets-batch", manifestDigest: digest(batch)}]};
  const owner = agreementFor(ownerIntent, ownerIntent.participants.map((participant) => ({...participant,
    intentDigest: digest(ownerIntent), confirmationId: `v3-owner-${participant.role}`, confirmedAtMillis: 100,
    onlineClosedNoOfflineEdits: true, noManualOrAutomationWrites: true})));
  const administratorAgreement = administratorAgreementFor({...seed, ownerAgreementDigest: owner.digest,
    affectedScopeDigest: digest(batch), writeEpoch: batch.writeEpoch, activeRevision: batch.activeRevision,
    activeDigest: batch.activeDigest, endsAtMillis: 550,
    operations: [{operationId: batch.operationId, kind: "sheets-batch", manifestDigest: digest(batch)}]});
  const administratorReport = {agreementDigest: administratorAgreement.digest, agreementStatus: "confirmed",
    administratorActivity: "none-reported", unresolvedWriteCount: 0, reportRevision: "admin-report-1"};
  const authorization = authorizationFor({...base.authorization, agreement: owner, batchIntent: batch,
    ownerReport: {...base.authorization.ownerReport, agreementDigest: owner.digest},
    administratorAgreement, administratorReport});
  const unsigned = {schemaVersion: 1, authorizationDigest: authorizationDigest(authorization),
    authorizationSnapshot: {path: "develop/plus-collections/shiftPlanningOperations/approved-v3",
      updateTime: {seconds: 100, nanoseconds: 1}, ownerReportDigest: digest(authorization.ownerReport)},
    agreement: owner, batchIntent: batch, preservationManifest: base.manifest, administratorAgreement,
    administratorObservationDigest: digest({report: "observed-fresh"}),
    claim: {workerId: "v3-worker", attemptId: "v3-attempt", fencingEpoch: 4,
      acquiredAtMillis: 500, expiresAtMillis: 800}, controlsValidUntilMillis: 540, preparedAtMillis: 530};
  const binding = bindingFor({...unsigned, bindingDigest: digest(unsigned)});
  const proof = {schemaVersion: 1, bindingDigest: binding.bindingDigest, phase: "completion",
    observationDigest: digest({observed: "fresh"}), authorizationSnapshot: binding.authorizationSnapshot,
    controlsValidUntilMillis: 540, verifiedAtMillis: 535};
  assert.doesNotThrow(() => assertProof({binding, proof: {...proof, proofDigest: digest(proof)},
    phase: "completion", nowMillis: 535}));
  for (const nowMillis of [535, 555]) {
    const widened = {...proof, controlsValidUntilMillis: 570};
    assert.throws(() => assertProof({binding, proof: {...widened, proofDigest: digest(widened)},
      phase: "completion", nowMillis}));
  }
  const widened = {...unsigned, controlsValidUntilMillis: 560};
  assert.throws(() => bindingFor({...widened, bindingDigest: digest(widened)}));
  assert.throws(() => authorizationFor({...authorization, batchIntent: {...batch, environment: "production"}}));
  assert.equal(authorizationDigest(authorization), authorizationDigest({...authorization,
    administratorReport: {...administratorReport, agreementStatus: "withdrawn"}}));
});
