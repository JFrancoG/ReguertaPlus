"use strict";
const {Timestamp} = require("@google-cloud/firestore");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {buildShiftPlanningPublicShiftMaterialization, createShiftPlanningActivationOperationTerminal,
  attachShiftPlanningBackendMutationMarker} = require("../lib/shift-planning-publication-contract.js");
const initialTime = Date.parse("2027-08-25T00:00:00Z");
const activeDigest = digest({fixture: "coverage"});
const materialize = (id, type, date, assigned, helper = null) => {
  const item = buildShiftPlanningPublicShiftMaterialization({environment: "develop",
    attemptedAt: Timestamp.fromMillis(initialTime - 1_000_000), position: {
      schemaVersion: 1, positionId: id, shiftId: id, type, scheduledDate: date,
      candidateId: "candidate", projectionSeasonStartYear: Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 9 ? 1 : 0),
      rotationOwnerUserIds: assigned, assignedUserIds: assigned,
      rotationPositions: assigned.map((uid, i) => ({rotationOwnerUserId: uid,
        effectiveAssigneeUserId: uid, roundNumber: 1, positionInRound: i + 1, planningReason: "target"})),
      helperUserId: helper, source: "app", origin: "planner", planningRequestId: "initial",
      bundleRevision: "active-1", bundleDigest: activeDigest, writeEpoch: 1,
    }});
  const operation = createShiftPlanningActivationOperationTerminal({operationId: "initial",
    environment: "develop", requestId: "initial", candidateId: "candidate", bundleRevision: "active-1",
    bundleDigest: activeDigest, forwardManifestDigest: digest("forward"), expectedStateDigest: digest("before"),
    writeEpoch: 1, attemptedAt: Timestamp.fromMillis(initialTime - 1_000_000),
    publicMutations: [{mutationKind: "create", targetPath: item.targetPath,
      documentRevision: item.documentRevision, payloadDigest: item.payloadDigest}], beforeImages: []});
  return attachShiftPlanningBackendMutationMarker({materialization: item, operation});
};
module.exports = {materialize, initialTime, activeDigest};
