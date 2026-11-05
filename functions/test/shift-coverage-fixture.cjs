"use strict";
const {Timestamp} = require("@google-cloud/firestore");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {buildShiftPlanningPublicShiftMaterialization, createShiftPlanningActivationOperationTerminal,
  attachShiftPlanningBackendMutationMarker} = require("../lib/shift-planning-publication-contract.js");
const initialTime = Date.parse("2027-08-25T00:00:00Z");
const activeDigest = digest({fixture: "coverage"});
const materialize = (id, type, date, assigned, helper = null, round = 1, environment = "develop") => {
  const item = buildShiftPlanningPublicShiftMaterialization({environment,
    attemptedAt: Timestamp.fromMillis(initialTime - 1_000_000), position: {
      schemaVersion: 1, positionId: id, shiftId: id, type, scheduledDate: date,
      candidateId: "candidate", projectionSeasonStartYear: Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 9 ? 1 : 0),
      rotationOwnerUserIds: assigned, assignedUserIds: assigned,
      rotationPositions: assigned.map((uid, i) => ({rotationOwnerUserId: uid,
        effectiveAssigneeUserId: uid, roundNumber: round, positionInRound: i + 1, planningReason: "target"})),
      helperUserId: helper, source: "app", origin: "planner", planningRequestId: "initial",
      bundleRevision: "active-1", bundleDigest: activeDigest, writeEpoch: 1,
    }});
  const operation = createShiftPlanningActivationOperationTerminal({operationId: "initial",
    environment, requestId: "initial", candidateId: "candidate", bundleRevision: "active-1",
    bundleDigest: activeDigest, forwardManifestDigest: digest("forward"), expectedStateDigest: digest("before"),
    writeEpoch: 1, attemptedAt: Timestamp.fromMillis(initialTime - 1_000_000),
    publicMutations: [{mutationKind: "create", targetPath: item.targetPath,
      documentRevision: item.documentRevision, payloadDigest: item.payloadDigest}], beforeImages: []});
  return attachShiftPlanningBackendMutationMarker({materialization: item, operation});
};
const coverageWorkbookSubmission = ({environment = "develop", workbookId = "coverage-rehearsal-book",
  operationId = "fixture-coverage", beforeWorkbookRevision = "1", now = initialTime} = {}) => ({
  schemaVersion: 1, kind: "coverageWriteBack", environment, workbookId, operationId,
  effectsDigest: digest("fixture-effects"), sourceDigest: digest("fixture-source"), beforeWorkbookRevision,
  claim: {workerId: "fixture-worker", attemptId: "fixture-attempt", acquiredAt: Timestamp.fromMillis(now),
    expiresAt: Timestamp.fromMillis(now + 60_000),
    partitions: [{type: "delivery", partitionKey: "delivery", stateRevision: 2, epoch: 1}]},
  batch: null, evidence: null,
});
module.exports = {materialize, initialTime, activeDigest, coverageWorkbookSubmission};
