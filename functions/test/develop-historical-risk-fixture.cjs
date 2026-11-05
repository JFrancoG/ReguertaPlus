"use strict";
const {administratorFixture} = require("./shift-planning-administrator-maintenance-fixture.cjs");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {DEVELOP_HISTORICAL_RISK, DEVELOP_HISTORICAL_WORKBOOK} = require("../lib/shift-planning-historical-risk.js");
function historicalFixture(overrides = {}) {
  const f = administratorFixture({expectedWorkbookFileId: DEVELOP_HISTORICAL_WORKBOOK, expectedStateRevision: 0,
    expectedWriteEpoch: 0, expectedActiveRevision: null, expectedActiveDigest: null, ...overrides},
    {captureControl: true, containedDelivery: true});
  const p = f.evidence.payload, drain = p.causalDrain, intent = p.administratorAgreement.payload.intent;
  const predecessors = p.writerControls.filter(c => c.developCapture).map(c => ({
    writerId: c.writerId, sourceDigest: digest({predecessor: c.writerId}),
    closureEvidenceDigest: digest({closed: c.writerId, revision: c.controlRevision}), closedAtMillis: c.closedAtMillis}));
  for (const control of p.writerControls.filter(c => c.developCapture)) {
    control.pendingWorkCount = null; control.inFlightWorkCount = null;
  }
  const risk = {schemaVersion: 1, kind: DEVELOP_HISTORICAL_RISK, projectId: "reguerta-9f27f",
    databaseId: "(default)", namespace: "develop/plus-collections", direction: "forward",
    migrationOperationId: f.command.transitionId, recoveryOperationId: "initial-recovery",
    operatorPrincipalId: intent.administratorPrincipalIds[0], confirmationId: "risk-acceptance-1",
    acceptedAtMillis: 315, expiresAtMillis: 580, assessedAtMillis: drain.initialQueueReadBackAtMillis,
    sourceDigest: f.command.expectedAuthoritativeDigest, causalSetDigest: drain.acceptedSetDigest,
    workbookFileId: p.workbook.fileId, workbookRevision: p.workbook.revision, workbookDigest: p.workbook.digest,
    migrationPlanDigest: digest("initial-migration-plan"), inversePlanDigest: digest("initial-inverse-plan"),
    currentSourceDigest: intent.sourceDigest, technicalControlManifestDigest: intent.technicalControlManifestDigest,
    predecessors, legacyUntracked: true, replayAllowed: false, continuingWorkObserved: false};
  Object.assign(drain, {historicalRisk: risk, drainedAtMillis: null, initialPendingWorkCount: null,
    initialInFlightWorkCount: null, finalPendingWorkCount: null, finalInFlightWorkCount: null});
  f.command.expectedHistoricalRiskDigest = digest(risk);
  f.scope.expectedHistoricalRiskDigest = digest(risk);f.evidence.digest = digest(p);
  return f;
}
module.exports = {historicalFixture};
