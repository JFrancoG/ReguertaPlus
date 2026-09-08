"use strict";
const {Timestamp} = require("@google-cloud/firestore");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {encodeShiftPlanningFirestoreValue, decodeShiftPlanningFirestoreDocument} = require("../lib/shift-planning-publication-contract.js");
const {createShiftPlanningPublicEventRetentionPolicy} = require("../lib/shift-planning-public-event-retention.js");
const {createShiftSheetsConfig, resolveShiftSheetsTab} = require("../lib/shift-sheets-config.js");
const {createShiftSheetsAdapter} = require("../lib/shift-sheets.js");
const {planShiftRepair} = require("../scripts/repair-planned-shifts.cjs");
const {materializeShiftRepair} = require("../scripts/materialize-shift-repair.cjs");
const {sheetsService, clone, setCell} = require("./shift-sheets-api-fixture.cjs");
const encode = (value) => encodeShiftPlanningFirestoreValue(value, "fixture", new Set());
const PROJECT_ID = "demo-reguerta-hu083-repair";
const root = "develop/plus-collections";
const cursor = (type, nextMemberIndex = 3) => ({schemaVersion: 1, type, cohortUserIds: ["a", "b", "c", "d"], roundNumber: 1, nextMemberIndex});
const repairFixture = async ({firestore, createMissing = false} = {}) => {
  const target = {projectId: PROJECT_ID, environment: "develop", workbookId: "fixture-book"};
  const authority = {bundleRevision: "bundle-r1", bundleDigest: digest({fixture: "bundle"}), writeEpoch: 7};
  const rows = ["2026-08-27", "2026-09-03", "2026-09-10"].map((date, index) => ({id: `shift_delivery_${date.replaceAll("-", "")}`,
    type: "delivery", date, rotationOwnerUserIds: [["a"], ["b"], ["c"]][index], assignedUserIds: [["a"], ["b"], ["c"]][index],
    helperUserId: ["b", "c", null][index], status: "planned", source: "app", origin: "planner"}));
  rows.push({id: "shift_market_20260920", type: "market", date: "2026-09-20", rotationOwnerUserIds: ["a", "b", "c"],
    assignedUserIds: ["a", "b", "c"], helperUserId: null, status: "planned", source: "app", origin: "planner"});
  const config = createShiftSheetsConfig({environment: "develop", workbooks: {develop: target.workbookId}}), sheets = sheetsService(target.workbookId);
  await createShiftSheetsAdapter({config, sheets}).reconcile({operationId: "fixture", rows, authorizeMutation: async () => {}});
  const proposal = {schemaVersion: 2, target, capturedAt: "2026-09-08T12:00:00.000Z", aliases: [], workbookVersion: "17", spreadsheet: clone(sheets.state),
    tabs: [...new Map(rows.map((row) => {const tab = resolveShiftSheetsTab(config, row.type, row.date); return [tab.title, {...tab, layout: "canonical", decorations: []}];})).values()],
    source: rows.map((row) => ({row, documentRevision: 2, assignmentRevision: 1, completionRevision: 0, completed: false})),
    expectedDates: {delivery: rows.slice(0, 3).map((row) => row.date), market: [rows[3].date]},
    members: ["a", "b", "c", "d"].map((userId) => ({userId, names: ["Fixture " + userId], phones: [], eligibleTypes: ["delivery", "market"]})),
    lineage: Object.fromEntries(["delivery", "market"].map((type) => [type, {beforeDate: rows.find((row) => row.type === type).date,
      bootstrap: {type, eligibleUserIds: ["a", "b", "c", "d"], isTrulyNewRotation: false,
        versionedState: {revision: "before-r1", digest: "before-digest", provenance: "fixture", rotation: cursor(type, 0)},
        ownerHistory: null, approvedMapping: null, legacyDeliveryHelper: null}, rotationAfterHorizon: cursor(type),
      rows: rows.filter((row) => row.type === type).map((row, index) => ({shiftId: row.id,
        positions: (type === "delivery" ? [index + 1] : [1, 2, 3]).map((positionInRound) => ({roundNumber: 1, positionInRound}))}))}]))};
  const input = clone(proposal); input.source[3].row.source = "planner";
  for (const sheet of input.spreadsheet.sheets) {
    const rowIndex = sheet.data[0].rowData.findIndex((row) => row.values[0]?.userEnteredValue?.stringValue === rows[3].id);
    if (rowIndex >= 0) setCell(sheet, rowIndex, 8, {userEnteredValue: {stringValue: "planner"}});
  }
  if (createMissing) {input.source.splice(1, 1); input.lineage.delivery.rows.splice(1, 1); Object.assign(proposal.source[1], {documentRevision: 0, assignmentRevision: 0});}
  const payloadFor = (row, positions) => ({planningSchemaVersion: 1, type: row.type, date: Timestamp.fromDate(new Date(row.date + "T00:00:00Z")),
    assignedUserIds: row.assignedUserIds, helperUserId: row.helperUserId, status: row.status, source: row.source, origin: row.origin,
    planningRequestId: "fixture-request", ...authority, projectionSeasonStartYear: Number(row.date.slice(5, 7)) < 9 ? 2025 : 2026,
    rotationOwnerUserId: row.type === "delivery" ? row.rotationOwnerUserIds[0] : null, rotationOwnerUserIds: row.type === "market" ? row.rotationOwnerUserIds : null,
    roundNumber: row.type === "delivery" ? positions[0].roundNumber : null, positionInRound: row.type === "delivery" ? positions[0].positionInRound : null,
    rotationPositions: row.type === "market" ? positions.map((pos, index) => ({...pos, rotationOwnerUserId: row.rotationOwnerUserIds[index],
      effectiveAssigneeUserId: row.assignedUserIds[index], planningReason: "target"})) : null, planningReason: row.type === "delivery" ? "target" : null,
    assignmentRevision: 1, documentRevision: 2, completion: {state: "uncompleted", revision: 0, actualHelperUserId: null, helperSourceAssignmentRevision: null, completedAt: null},
    createdAt: Timestamp.fromMillis(0), updatedAt: Timestamp.fromMillis(1000)});
  const initial = new Map(input.source.map(({row}) => [`${root}/shifts/${row.id}`, payloadFor(row, input.lineage[row.type].rows.find((item) => item.shiftId === row.id).positions)]));
  initial.set(`${root}/shiftPlanningState/current`, {schemaVersion: 1, stateRevision: 11, writeEpoch: 7, maintenanceStatus: "closed",
    activeRevision: authority.bundleRevision, activeDigest: authority.bundleDigest,
    intakeBarrier: {revision: "barrier-r1", digest: digest({fixture: "barrier"}), verifiedAtMillis: 0}, lastTransitionId: "close-r1"});
  for (const type of ["delivery", "market"]) initial.set(`${root}/shiftRotations/${type}`, {schemaVersion: 1, type, stateRevision: 2, cursor: cursor(type),
    planningFrontierSeasonStartYear: 2026, cohortFrozen: true, frozenCohortUserIds: ["a", "b", "c", "d"],
    activeRevision: authority.bundleRevision, activeDigest: authority.bundleDigest, lastIdempotencyKey: null, migrationBaseline: null, releaseLease: null});
  const times = new Map([...initial.keys()].map((path) => [path, Timestamp.fromMillis(1000)]));
  if (firestore) {
    const batch = firestore.batch(); for (const [path, payload] of initial) batch.create(firestore.doc(path), payload); await batch.commit();
    const snapshots = await firestore.getAll(...[...initial.keys()].map((path) => firestore.doc(path)));
    snapshots.forEach((snapshot) => times.set(snapshot.ref.path, snapshot.updateTime));
    input.capturedAt = proposal.capturedAt = new Date(Math.max(...[...times.values()].map((time) => time.seconds * 1000 + Math.floor(time.nanoseconds / 1000000) + 1))).toISOString();
  }
  const captureEntry = (path) => ({targetPath: path, payload: encode(initial.get(path)), updateTime: encode(times.get(path))});
  const firestoreCapture = {schemaVersion: 1, target, inputDigest: digest(input), capturedAt: input.capturedAt,
    documents: input.source.map(({row}) => captureEntry(`${root}/shifts/${row.id}`)),
    absentPaths: proposal.source.filter((entry) => entry.documentRevision === 0).map(({row}) => `${root}/shifts/${row.id}`)};
  const options = {input, proposal, target, expectedInputDigest: digest(input), expectedProposalDigest: digest(proposal),
    firestoreCapture, expectedCaptureDigest: digest(firestoreCapture)};
  const review = await planShiftRepair(options), preparedAt = Timestamp.fromMillis(Date.parse(input.capturedAt) + (firestore ? 0 : 1000));
  options.materialization = {schemaVersion: 1, target, repairPlanDigest: review.planDigest, operationId: "repair-r1", preparedAt: encode(preparedAt), authority,
    retentionPolicy: createShiftPlanningPublicEventRetentionPolicy({policyRevision: "policy-r1", maximumDeliveryRetryHorizonMillis: 86400000, safetyMarginMillis: 3600000}),
    writes: review.projectionChanges.map(({after}) => {
      const row = after.row, payload = payloadFor(row, proposal.lineage[row.type].rows.find((item) => item.shiftId === row.id).positions);
      payload.documentRevision = after.documentRevision + 1; payload.updatedAt = preparedAt;
      if (after.documentRevision === 0) payload.createdAt = preparedAt;
      return {targetPath: `${root}/shifts/${row.id}`, payload: encode(payload)};
    })};
  options.expectedMaterializationDigest = digest(options.materialization);
  const materialized = await materializeShiftRepair(options);
  Object.assign(options, {baselineRevision: "baseline-r1", expectedMaterializedPlanDigest: materialized.planDigest,
    authorityCapture: {schemaVersion: 1, target, inputDigest: digest(input), capturedAt: input.capturedAt,
      documents: [...initial.keys()].filter((path) => !path.includes("/shifts/")).map(captureEntry)}});
  options.expectedAuthorityCaptureDigest = digest(options.authorityCapture);
  return {options, review: await materializeShiftRepair(options), initial};
};
module.exports = {repairFixture, PROJECT_ID, root, encode, digest, decode: decodeShiftPlanningFirestoreDocument};
