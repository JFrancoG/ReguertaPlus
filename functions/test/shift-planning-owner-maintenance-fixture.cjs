const {scope, evidence} = require("./shift-planning-barrier-fixture.cjs");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {createShiftPlanningControlManifestDigest} = require("../lib/shift-planning-intake-barrier.js");
const {createShiftPlanningOwnerMaintenanceAgreement} = require("../lib/shift-planning-owner-maintenance.js");
const {SHIFT_PLANNING_OWNER_AGREEMENT_INVENTORY_REVISION: revision,
  SHIFT_PLANNING_OWNER_AGREEMENT_INVENTORY_DIGEST: inventoryDigest,
  SHIFT_PLANNING_OWNER_AGREEMENT_OWNER_WRITER_ID: ownerId} =
  require("../lib/shift-planning-writer-inventory.js");
function ownerFixture(overrides = {}) {
  const base = scope(overrides);
  const payload = evidence().payload;
  for (const field of ["transitionId", "expectedAuthoritativeDigest", "expectedStateRevision",
    "expectedWriteEpoch", "expectedActiveRevision", "expectedActiveDigest"]) {
    payload.transition[field] = base[field];
  }
  payload.workbook.fileId = base.expectedWorkbookFileId;
  payload.workbook.revision = payload.workbook.readBackRevision = base.expectedWorkbookRevision;
  payload.workbook.digest = payload.workbook.readBackDigest = base.expectedWorkbookDigest;
  const technicalDigest = createShiftPlanningControlManifestDigest(payload.writerControls, "owner-agreement");
  const participants = [{principalId: "owner-human", role: "owner"},
    {principalId: "operator-invoker", role: "operator"}];
  const intent = {agreementId: "owner-agreement-1", environment: base.environment,
    workbookFileId: base.expectedWorkbookFileId, ownerPrincipalId: "owner-human",
    participants, participantsRevision: "participants-1", effectiveAuthorityDigest: digest({authority: 1}),
    sourceRevision: base.expectedWorkbookRevision, sourceDigest: base.expectedWorkbookDigest,
    expectedWriteEpoch: base.expectedWriteEpoch, expectedActiveRevision: base.expectedActiveRevision,
    expectedActiveDigest: base.expectedActiveDigest, affectedScopeDigest: base.expectedAuthoritativeDigest,
    operations: [{operationId: base.transitionId, kind: "maintenance-entry", manifestDigest: technicalDigest}],
    startsAtMillis: 90, endsAtMillis: 600, recoveryDeadlineMillis: 900, permissionControl: null};
  const agreement = createShiftPlanningOwnerMaintenanceAgreement(intent, participants.map((participant) => ({
    ...participant, intentDigest: digest(intent), confirmationId: `confirm-${participant.role}`,
    confirmedAtMillis: 100, onlineClosedNoOfflineEdits: true, noManualOrAutomationWrites: true,
  })));
  payload.schemaVersion = 2;
  payload.maintenanceMode = "owner-agreement";
  payload.policy.maximumEvidenceAgeMillis = 1000;
  payload.writerInventory = {revision, digest: inventoryDigest};
  payload.ownerAgreement = agreement;
  payload.ownerObservation = {workbookFileId: intent.workbookFileId,
    ownerPrincipalId: intent.ownerPrincipalId,
    participantsDigest: digest({revision: intent.participantsRevision, participants}),
    effectiveAuthorityDigest: intent.effectiveAuthorityDigest, sourceRevision: intent.sourceRevision,
    sourceDigest: intent.sourceDigest, technicalCapability: "retained", permissionWorkflowClosed: true,
    permissionControlEvidenceDigest: null, agreementStatus: "confirmed", ownerActivity: "none-reported",
    unresolvedWriteCount: 0, observedAtMillis: 510};
  payload.writerControls.push({writerId: ownerId, state: "agreement-recorded", controlRevision: "agreement-1",
    controlDigest: agreement.digest, initialReadBackRevision: "agreement-1", initialReadBackDigest: agreement.digest,
    finalReadBackRevision: "agreement-1", finalReadBackDigest: agreement.digest,
    closedAtMillis: 110, initialReadBackAtMillis: 150, finalReadBackAtMillis: 510,
    pendingWorkCount: 0, inFlightWorkCount: 0});
  payload.writerControls.sort((a, b) => a.writerId < b.writerId ? -1 : 1);
  const command = {...base, schemaVersion: 2, maintenanceMode: "owner-agreement",
    maximumEvidenceAgeMillis: 1000, expectedOwnerAgreementDigest: agreement.digest,
    expectedTechnicalControlManifestDigest: technicalDigest,
    expectedControlManifestDigest: createShiftPlanningControlManifestDigest(payload.writerControls, "owner-agreement")};
  delete command.writerInventoryRevision; delete command.writerInventoryDigest;
  return {command, scope: {...command, writerInventoryRevision: revision, writerInventoryDigest: inventoryDigest},
    evidence: {payload, digest: digest(payload)}, agreement, nowMillis: 530};
}
module.exports = {ownerFixture};
