"use strict";
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {fairnessSnapshot, maintenanceState, request} = require("./shift-planning-activation-fixture.cjs");

// Six weekly owners create an independent, predictable six-week cross-round
// conflict. This deliberately prepares no source cache, candidates or effects.
const seedSpacingAdministration = async (db) => {
  const root = "develop/plus-collections";
  const ref = (collection, id) => db.doc(`${root}/${collection}/${id}`);
  const source = fairnessSnapshot();
  source.creditLedger.digest = digest({credits: "disabled-v1"});
  const batch = db.batch();
  batch.set(ref("shiftPlanningState", "current"), maintenanceState(source));
  for (const type of ["delivery", "market"]) batch.set(ref("shiftRotations", type), source.rotations[type]);
  for (const member of source.roster) batch.set(ref("users", member.userId), {...member,
    displayName: member.userId === "member-1" ? "Ana" : member.userId});
  batch.set(ref("config", "global"), {otherConfig: {deliveryDayOfWeek: "THU"}});
  batch.set(ref("shiftPlanningState", "sourcePolicy"), {schemaVersion: 1, environment: "develop",
    policyRevision: "hu089-local-source", delivery: {continuity: {kind: "newRotation"},
      inheritedTargetPrefix: null, futureProjectionOccupancy: []},
    market: {inheritedTargetPrefix: null, futureProjectionOccupancy: []},
    releaseLeaseDurationMillis: source.config.releaseLeaseDurationMillis,
    creditLedger: source.creditLedger, sync: source.sync, transactionWriteLimit: 500,
    deliverySpacing: {version: "hu089-delivery-spacing-v1"}});
  batch.set(ref("shiftPlanningRequests", "request-preview-2026"), request());
  await batch.commit();
};

module.exports = {seedSpacingAdministration};
