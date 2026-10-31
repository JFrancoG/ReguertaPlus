"use strict";
const {Timestamp} = require("@google-cloud/firestore");
const {SHIFT_COVERAGE_BOOTSTRAP_COLLECTIONS} = require("../lib/shift-coverage-bootstrap.js");
const {encodeShiftPlanningFirestoreValue: encode} = require("../lib/shift-planning-publication-contract.js");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {materialize, initialTime, activeDigest} = require("./shift-coverage-fixture.cjs");
const cohort = ["a", "b", "c", "buyer", "admin"];
const decision = (environment = "develop") => ({schemaVersion: 1, environment,
  operationId: "initial-no-balances", effectiveAtMillis: initialTime,
  confirmationReference: "Maintainer explicitly confirmed no current reserves and zero initial credits",
  reserves: "none", credits: "none"});
const document = (environment, collection, id, data) => ({
  path: `${environment}/plus-collections/${collection}/${id}`,
  value: data === null ? null : encode(data, "bootstrap fixture", new Set()),
  updateTime: data === null ? null : {seconds: 1_800_000_000, nanoseconds: 1234},
});
const snapshot = (environment = "develop") => {
  const docs = [];
  const add = (collection, id, data) => docs.push(document(environment, collection, id, data));
  for (const id of [...cohort, "inactive", "real-producer"]) add("users", id,
    {isActive: id !== "inactive", roles: id === "admin" ? ["member", "admin"] :
      ["buyer", "real-producer"].includes(id) ? ["member", "producer"] : ["member"],
    isCommonPurchaseManager: id === "buyer", displayName: `Example ${id}`});
  add("shiftPlanningState", "current", {schemaVersion: 1, stateRevision: 2,
    writeEpoch: 1, maintenanceStatus: "closed", activeRevision: "active-1", activeDigest,
    intakeBarrier: {revision: "bootstrap-closed", digest: digest("bootstrap barrier"), verifiedAtMillis: initialTime},
    lastTransitionId: "bootstrap-closed"});
  add("shiftPlanningState", "sourcePolicy", {schemaVersion: 1, environment, transactionWriteLimit: 500,
    sync: {transactionMeasurementAuthority: {adapterRevision: "public-transaction-v2", indexConfigurationDigest: digest("bootstrap indexes")}, partitions:
    Object.fromEntries(["delivery", "market"].map((type) => [type, {workbookId: "coverage-rehearsal-book",
      workbookRevision: "1", partitionKey: type, stateRevision: 1, epoch: 0, lease: null}]))}});
  add("shiftPlanningState", "sheetsSubmission", null);
  for (const type of ["delivery", "market"]) {
    add("shiftRotations", type, {schemaVersion: 1, type, stateRevision: 1,
      cursor: {schemaVersion: 1, type, cohortUserIds: cohort, roundNumber: 1, nextMemberIndex: 0},
      planningFrontierSeasonStartYear: 2027, cohortFrozen: false, frozenCohortUserIds: [],
      activeRevision: "active-1", activeDigest, lastIdempotencyKey: null, migrationBaseline: null, releaseLease: null});
    add("shiftCoverageLedgerState", type, null);
  }
  add("shiftCoverageMigrations", "current", null);
  const publicShift = materialize("shift_market_20270904", "market", "2027-09-04", ["a", "b", "c"]);
  publicShift.lastBackendMutation = {...publicShift.lastBackendMutation,
    targetPath: `${environment}/plus-collections/shifts/shift_market_20270904`};
  add("shifts", "shift_market_20270904", publicShift);
  return {schemaVersion: 1, environment,
    collections: [...SHIFT_COVERAGE_BOOTSTRAP_COLLECTIONS], documents: docs};
};
module.exports = {snapshot, decision, document, cohort, initialTime, Timestamp};
