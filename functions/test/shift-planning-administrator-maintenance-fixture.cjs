"use strict";
const {ownerFixture} = require("./shift-planning-owner-maintenance-fixture.cjs");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {createShiftPlanningOwnerMaintenanceAgreement: ownerAgreement} =
  require("../lib/shift-planning-owner-maintenance.js");
const {parseShiftPlanningAdministratorMaintenanceAgreement: parseAgreement} =
  require("../lib/shift-planning-administrator-maintenance.js");
const {createShiftPlanningControlManifestDigest: controlsDigest} =
  require("../lib/shift-planning-intake-barrier.js");
const inventory = require("../lib/shift-planning-writer-inventory.js");
const MODE = "develop-administrator-agreement";
const ADMIN = inventory.SHIFT_PLANNING_ADMINISTRATOR_AGREEMENT_WRITER_ID;
const OWNER = inventory.SHIFT_PLANNING_OWNER_AGREEMENT_OWNER_WRITER_ID;

function agreement(intent, confirmedAtMillis = 100) {
  const payload = {schemaVersion: 1, kind: "cooperative-develop-administrator-maintenance",
    intent, confirmations: intent.administratorPrincipalIds.map((principalId, index) => ({
      principalId, intentDigest: digest(intent), confirmationId: `admin-confirm-${index}`,
      confirmedAtMillis, noUnreviewedDataRulesDeployIamOrScriptWrites: true,
      noAutomationViaHumanCredentials: true}))};
  return parseAgreement({payload, digest: digest(payload)});
}
function observation(value, observedAtMillis = 510) {
  const {intent} = value.payload;
  return {projectId: intent.projectId, databaseId: intent.databaseId, environment: intent.environment,
    agreementDigest: value.digest, administratorPrincipalIds: [...intent.administratorPrincipalIds],
    participantsRevision: intent.participantsRevision, effectiveIamDigest: intent.effectiveIamDigest,
    sourceRevision: intent.sourceRevision, sourceDigest: intent.sourceDigest,
    technicalCapability: "retained", agreementStatus: "confirmed",
    administratorActivity: "none-reported", unresolvedWriteCount: 0,
    reportRevision: "admin-report-1", observedAtMillis};
}
function administratorFixture(overrides = {}, {captureControl = false} = {}) {
  const fixture = ownerFixture(overrides);
  const payload = fixture.evidence.payload;
  if (captureControl) require("./develop-capture-control-fixture.cjs").applyCapture(payload, "reguerta-9f27f");
  const technical = controlsDigest(payload.writerControls.filter((item) => item.writerId !== OWNER), MODE);
  const ownerIntent = {...fixture.agreement.payload.intent,
    operations: [{operationId: fixture.command.transitionId, kind: "maintenance-entry", manifestDigest: technical}]};
  fixture.agreement = ownerAgreement(ownerIntent, ownerIntent.participants.map((participant) => ({
    ...participant, intentDigest: digest(ownerIntent), confirmationId: `owner-${participant.role}`,
    confirmedAtMillis: 100, onlineClosedNoOfflineEdits: true, noManualOrAutomationWrites: true})));
  payload.ownerAgreement = fixture.agreement;
  const owner = payload.writerControls.find((item) => item.writerId === OWNER);
  for (const field of ["controlDigest", "initialReadBackDigest", "finalReadBackDigest"]) {
    owner[field] = fixture.agreement.digest;
  }
  const intent = {agreementId: "develop-admins-1", projectId: "reguerta-9f27f", databaseId: "(default)",
    environment: "develop", administratorPrincipalIds: ["user:admin-a@example.test", "user:admin-b@example.test"],
    participantsRevision: "effective-administrators-1", effectiveIamDigest: digest({iam: "current"}),
    sourceRevision: "deployed-controls-1", sourceDigest: digest({source: "deployed-controls"}),
    ownerAgreementDigest: fixture.agreement.digest, affectedScopeDigest: fixture.command.expectedAuthoritativeDigest,
    writeEpoch: fixture.command.expectedWriteEpoch, activeRevision: fixture.command.expectedActiveRevision,
    activeDigest: fixture.command.expectedActiveDigest, technicalControlManifestDigest: technical,
    operations: [{operationId: fixture.command.transitionId, kind: "maintenance-entry", manifestDigest: technical}],
    startsAtMillis: 90, endsAtMillis: 590, recoveryDeadlineMillis: 900};
  fixture.administratorAgreement = agreement(intent);
  payload.schemaVersion = 3; payload.maintenanceMode = MODE;
  payload.administratorAgreement = fixture.administratorAgreement;
  payload.administratorObservation = observation(fixture.administratorAgreement);
  payload.writerInventory = {revision: inventory.SHIFT_PLANNING_ADMINISTRATOR_AGREEMENT_INVENTORY_REVISION,
    digest: inventory.SHIFT_PLANNING_ADMINISTRATOR_AGREEMENT_INVENTORY_DIGEST};
  payload.writerControls.push({...owner, writerId: ADMIN,
    controlDigest: fixture.administratorAgreement.digest,
    initialReadBackDigest: fixture.administratorAgreement.digest,
    finalReadBackDigest: fixture.administratorAgreement.digest});
  payload.writerControls.sort((a, b) => a.writerId < b.writerId ? -1 : 1);
  fixture.command = {...fixture.command, schemaVersion: 3, maintenanceMode: MODE,
    expectedOwnerAgreementDigest: fixture.agreement.digest,
    expectedAdministratorAgreementDigest: fixture.administratorAgreement.digest,
    expectedTechnicalControlManifestDigest: technical,
    expectedAdministratorSourceRevision: intent.sourceRevision, expectedAdministratorSourceDigest: intent.sourceDigest,
    expectedEffectiveIamDigest: intent.effectiveIamDigest,
    expectedControlManifestDigest: controlsDigest(payload.writerControls, MODE)};
  fixture.scope = {...fixture.command, writerInventoryRevision: payload.writerInventory.revision,
    writerInventoryDigest: payload.writerInventory.digest};
  fixture.evidence.digest = digest(payload);
  return fixture;
}
module.exports = {administratorFixture, agreement, observation, MODE, ADMIN, OWNER};
