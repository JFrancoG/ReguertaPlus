"use strict";

const {Timestamp} = require("@google-cloud/firestore");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {consumeRotationPositions} = require("../lib/shift-planning-contract.js");
const {scope: barrierScope, evidence: barrierEvidence} = require("./shift-planning-barrier-fixture.cjs");
const {createShiftPlanningTrustedIntakeBarrierCheckpoint: checkpoint,
  createShiftPlanningIntakeBarrierFailureClosureRecord: failureRecord} =
  require("../lib/shift-planning-trusted-intake-barrier-adapter.js");
const {applyCapture, applyContained, bindScope} = require("./develop-capture-control-fixture.cjs");
const migration = require("../scripts/rehearse-develop-shift-migration.cjs");

const ROOT = "develop/plus-collections";
const NOW = Date.parse("2026-10-27T12:00:00.000Z");
const cohort = Array.from({length: 32}, (_, i) => `member-${String(i + 1).padStart(2, "0")}`);
const iso = (millis) => new Date(millis).toISOString().slice(0, 10);
const weeks = (first, count) => Array.from({length: count}, (_, i) =>
  iso(Date.parse(`${first}T00:00:00Z`) + i * 7 * 86_400_000));
const thirdSaturday = (year, month) => {
  const first = new Date(Date.UTC(year, month, 1));
  return iso(Date.UTC(year, month, 15 + (6 - first.getUTCDay() + 7) % 7));
};
const marketDates = (year, count) => Array.from({length: count}, (_, i) =>
  thirdSaturday(year + Math.floor((8 + i) / 12), (8 + i) % 12));

const contentProposal = () => {
  const shifts = [], rotations = {};
  for (const type of ["delivery", "market"]) {
    const dates = type === "delivery" ? weeks("2026-09-02", 54) :
      [...marketDates(2026, 10), ...marketDates(2027, 8)];
    const initialCursor = {schemaVersion: 1, type, cohortUserIds: [...cohort], roundNumber: 1, nextMemberIndex: 0};
    const consumed = consumeRotationPositions(initialCursor, 54), width = type === "delivery" ? 1 : 3;
    dates.forEach((date, index) => {
      const positions = consumed.positions.slice(index * width, (index + 1) * width);
      const owners = positions.map((p) => p.rotationOwnerUserId);
      shifts.push({id: `shift_${type}_${date.replaceAll("-", "")}`, type, date,
        assignedUserIds: owners, rotationOwnerUserIds: [...owners], positions,
        helperUserId: null, status: "planned", completion: {state: "uncompleted",
          actualHelperUserId: null, helperSourceAssignmentRevision: null, completedAt: null}});
    });
    rotations[type] = {ownerProvenance: "declared_synthetic_develop_only", initialCursor,
      postPublishedCursor: consumed.nextRotation, publishedPositionCount: 54,
      horizonScope: "published_set_only", completeness: "not_a_complete_season_or_runtime_frontier"};
  }
  const delivery = shifts.filter((s) => s.type === "delivery");
  delivery.slice(0, -1).forEach((s, i) => { s.helperUserId = delivery[i + 1].assignedUserIds[0]; });
  const content = {workbookId: migration.WORKBOOK_ID, ownerProvenance: "declared_synthetic_develop_only",
    shifts, rotations, helperProjectionDraft: delivery.slice(0, -1).map((s, i) => ({
      tabTitle: i < 52 ? "turnos-reparto 2026-27" : "turnos-reparto 2027-28",
      rowNumber: (i < 52 ? i : i - 52) + 2, column: "F", before: "", after: `Example ${s.helperUserId}`}))};
  const body = {schemaVersion: 1, scope: "develop_content_proposal_only", environment: "develop",
    liveExecutable: false, historicalEvidence: {source: "portable synthetic test fixture"}, content, limitations: []};
  return {...body, contentDigest: digest(content), proposalDigest: digest(body)};
};

const legacyRows = () => [
  ...weeks("2025-09-03", 52).map((date) => ({type: "delivery", date})),
  ...marketDates(2025, 10).map((date) => ({type: "market", date})),
].map(({type, date}, index) => ({path: `${ROOT}/shifts/shift_${type}_${date.replaceAll("-", "")}`,
  data: {type, date: Timestamp.fromDate(new Date(`${date}T00:00:00Z`)),
    assignedUserIds: Array.from({length: type === "delivery" ? 1 : 3}, (_, offset) => cohort[(index + offset) % 32]),
    helperUserId: type === "delivery" && index < 51 ? cohort[(index + 1) % 32] : null,
    status: "planned", source: "google_sheets", createdAt: new Timestamp(1_700_000_000, 1234),
    updatedAt: new Timestamp(1_710_000_000, 5678),
    syncMeta: {importedAt: new Timestamp(1_710_000_000, 5678), retained: [null, true, "Example legacy note"]}}}));

const restValue = (value) => {
  if (value === null) return {nullValue: null};
  if (Buffer.isBuffer(value)) return {bytesValue: value.toString("base64")};
  if (value instanceof Timestamp) return {timestampValue:
    `${new Date(value.seconds * 1000).toISOString().slice(0, 19)}.${String(value.nanoseconds).padStart(9, "0")}Z`};
  if (typeof value === "string") return {stringValue: value};
  if (typeof value === "boolean") return {booleanValue: value};
  if (typeof value === "number") return Number.isInteger(value) ? {integerValue: String(value)} : {doubleValue: value};
  if (Array.isArray(value)) return {arrayValue: {values: value.map(restValue)}};
  return {mapValue: {fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, restValue(item)]))}};
};
const restDocument = (path, data, updateTime = Timestamp.fromMillis(NOW - 1000), createTime = Timestamp.fromMillis(NOW - 2000)) => ({
  name: `projects/${migration.PROJECT_ID}/databases/(default)/documents/${path}`,
  fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, restValue(value)])),
  updateTime: restValue(updateTime).timestampValue, createTime: restValue(createTime).timestampValue,
});
const fromSnapshot = (doc) => restDocument(doc.ref.path, doc.data(), doc.updateTime, doc.createTime);
const legacyCapture = () => ({projectId: migration.PROJECT_ID, environment: "develop",
  documents: legacyRows().map(({path, data}) => restDocument(path, data))});

const seedAndCapture = async (db) => {
  const batch = db.batch();
  for (const row of legacyRows()) batch.create(db.doc(row.path), row.data);
  for (let i = 0; i < 48; i++) {
    const id = i < 32 ? cohort[i] : `inactive-${i}`;
    batch.create(db.doc(`${ROOT}/users/${id}`), {displayName: `Example ${id}`, roles: ["member"],
      isActive: i < 32, isCommonPurchaseManager: false, phoneNumber: ""});
  }
  batch.create(db.doc(`${ROOT}/deliveryCalendar/2026-W36`), {weekKey: "2026-W36",
    deliveryDate: Timestamp.fromDate(new Date("2026-09-02T00:00:00Z"))});
  await batch.commit();
  const read = async (collection) => (await db.collection(`${ROOT}/${collection}`).orderBy("__name__").get()).docs.map(fromSnapshot);
  return {projectId: migration.PROJECT_ID, environment: "develop", documents: await read("shifts"),
    guardCollections: {users: await read("users"), deliveryCalendar: await read("deliveryCalendar")}};
};

const heldControl = (options = {}) => {
  let held, reads = 0, failed = null;
  const events = [];
  const controlPlane = {
    async closeAndCollect(scope) {
      events.push("close"); await options.onClose?.(scope);
      const payload = barrierEvidence().payload;
      if (options.captureControl) applyCapture(payload);
      if (options.containedDelivery) applyContained(payload);
      options.onPayload?.(payload);
      const shiftTimes = (item) => {
        for (const [key, value] of Object.entries(item)) {
          if (value && typeof value === "object") shiftTimes(value);
          else if (key.endsWith("AtMillis")) item[key] += NOW - 520;
        }
      };
      shiftTimes(payload);
      payload.transition = Object.fromEntries(["transitionId", "expectedAuthoritativeDigest", "expectedStateRevision",
        "expectedWriteEpoch", "expectedActiveRevision", "expectedActiveDigest"].map((key) => [key, scope[key]]));
      payload.workbook.fileId = scope.expectedWorkbookFileId;
      payload.workbook.revision = payload.workbook.readBackRevision = scope.expectedWorkbookRevision;
      held = checkpoint({scope, holdRevision: "synthetic-migration-held", evidence: {payload, digest: digest(payload)}});
      return held;
    },
    async readBackClosed() {
      events.push("readBack"); reads++; await options.onReadBack?.(reads);
      return held;
    },
  };
  const failurePersistence = {
    async readExistingFailure() { return failed; },
    async retainFailureAndReadBack(request) {
      events.push("failureJournal"); await options.onJournal?.(request);
      failed = failureRecord(request, NOW); return failed;
    },
  };
  return {controlPlane, failurePersistence, events, get failed() { return failed; }};
};
const scopeFor = (prepared, inspection, inverse = false, captureControl = false, containedDelivery = false) => {
  const scope = barrierScope({
  environment: "develop", transitionId: inverse ? prepared.recoveryOperationId : prepared.operationId,
  expectedAuthoritativeDigest: inspection.sourceDigest, expectedStateRevision: inspection.maintenance.stateRevision,
  expectedWriteEpoch: inspection.maintenance.writeEpoch, expectedActiveRevision: inspection.maintenance.activeRevision,
  expectedActiveDigest: inspection.maintenance.activeDigest, expectedWorkbookFileId: migration.WORKBOOK_ID,
  expectedWorkbookRevision: "1",
  });
  if (!captureControl) return scope;
  const payload = applyCapture(barrierEvidence().payload);
  if (containedDelivery) applyContained(payload);
  return bindScope(scope, payload);
};

module.exports = {ROOT, NOW, cohort, contentProposal, legacyRows, legacyCapture,
  restValue, restDocument, fromSnapshot, seedAndCapture, heldControl, scopeFor};
