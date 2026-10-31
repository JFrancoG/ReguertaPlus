"use strict";

// Offline intent binding only. No provider client, environment switch or apply
// option. Runtime timestamps, held evidence and forward receipts are not data
// that a preparation step may invent.
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), {createHash} = require("node:crypto");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {isEligibleForShiftRotation} = require("../lib/shift-eligibility.js");
const {inspectCensus} = require("./inspect-develop-legacy-census.cjs");
const {checkContentPositions, decodeRESTValue} = require("./rehearse-develop-shift-migration.cjs");
const {reviewDevelopCaptureControls, PAIRS} = require("./prepare-develop-planner-entry.cjs");
const {reviewWriterRehearsal} = require("./develop-writer-rehearsal-evidence.cjs");
const PROJECT = "reguerta-9f27f", ROOT = "develop/plus-collections";
const WORKBOOK = "1O7VKs7S4wZHVvTfNBehAd5EzF3Mgw2q9LweK68Gm76A";
const PREFIX = `projects/${PROJECT}/databases/(default)/documents/`;
const OWNER = "testplusprojects@gmail.com";
const READERS = ["drpuerk@gmail.com", "195744802339-compute@developer.gserviceaccount.com",
  "firebase-adminsdk-2xhs2@reguerta-9f27f.iam.gserviceaccount.com",
  "reguerta-shifts-inspector@reguerta-9f27f.iam.gserviceaccount.com"].sort();
const FILES = ["snapshot", "sheetCells", "referenceCells", "proposal", "fileBefore", "fileAfter",
  "filePermissions", "parent", "parentPermissions", "indexes", "controls", "reviewedControls", "assessment"];
const equal = (a, b, message) => assert.equal(digest(a), digest(b), message);
const shortPath = document => {
  assert.ok(document.name.startsWith(PREFIX + ROOT + "/"), "document outside develop Plus");
  assert.match(document.updateTime, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/);
  return document.name.slice(PREFIX.length);
};
const byPath = documents => [...documents].sort((a, b) => a.name.localeCompare(b.name));
function reviewedConfiguration(snapshot) {
  const documents = snapshot.collections.config;
  assert.ok(Array.isArray(documents), "complete config census required");
  const expected = ["global", "member", "public"].map(name => `${ROOT}/config/${name}`);
  assert.deepEqual(documents.map(shortPath).sort(), expected, "exact reviewed config document set required");
  const readTime = decodeRESTValue({timestampValue:snapshot.readTime});
  for (const document of documents) {
    assert.ok(document.fields && typeof document.fields === "object" && !Array.isArray(document.fields), "config fields required");
    const created = decodeRESTValue({timestampValue:document.createTime});
    const updated = decodeRESTValue({timestampValue:document.updateTime});
    assert.ok(created.valueOf() <= updated.valueOf() && updated.valueOf() <= readTime.valueOf(), "config version outside snapshot");
    decodeRESTValue({mapValue:{fields:document.fields}});
  }
  const global = documents.find(document => shortPath(document) === `${ROOT}/config/global`);
  equal(global, snapshot.singletons["config/global"], "global singleton and config census differ");
  return byPath(documents);
}
function literalCells(book) {
  assert.equal(book.spreadsheetId, WORKBOOK);
  const result = {};
  for (const sheet of book.sheets) for (const block of sheet.data || []) {
    for (const [row, record] of (block.rowData || []).entries()) for (const [column, cell] of (record.values || []).entries()) {
      const key = `${sheet.properties.sheetId}:${(block.startRow || 0) + row}:${(block.startColumn || 0) + column}`;
      const value = Object.fromEntries(["userEnteredValue", "note"].filter(k => k in cell).map(k => [k, cell[k]]));
      if (Object.keys(value).length) { assert.equal(result[key], undefined, "overlapping cell observations"); result[key] = value; }
    }
  }
  return result;
}

function prepareDevelopMigrationPackage(input) {
  const hasWriter = Object.hasOwn(input, "writerRehearsal");
  const writerKeys = hasWriter ? ["writerRehearsal", "reviewedWriterRehearsalDigest"] : [];
  assert.deepEqual(Object.keys(input).sort(), [...FILES, "reviewedContentDigest", "reviewedProposalDigest", ...writerKeys].sort());
  const writerRehearsal = hasWriter ? reviewWriterRehearsal(input.writerRehearsal, input.reviewedWriterRehearsalDigest, WORKBOOK) : null;
  const {snapshot, proposal, controls, reviewedControls, indexes} = structuredClone(input);
  const {contentDigest, proposalDigest, ...proposalBody} = proposal;
  assert.equal(contentDigest, input.reviewedContentDigest); assert.equal(proposalDigest, input.reviewedProposalDigest);
  assert.equal(digest(proposal.content), contentDigest); assert.equal(digest(proposalBody), proposalDigest);
  assert.equal(proposal.environment, "develop"); assert.equal(proposal.liveExecutable, false);
  assert.equal(proposal.content.workbookId, WORKBOOK);
  assert.equal(proposal.content.ownerProvenance, "declared_synthetic_develop_only");
  assert.equal(proposal.content.shifts.length, 72); assert.equal(new Set(proposal.content.shifts.map(s => s.id)).size, 72);
  checkContentPositions(proposal.content);
  const names = ["shiftPlanningRequests", "shifts", "deliveryCalendar", "notificationEvents"];
  const keys = ["schemaVersion", "projectId", "readOnly", "atomicSnapshot", "readTime", "canApply", "canClaimClosure",
    "intakeBefore", "intakeAfter", "events", "deliveries", "chunks"];
  const core = {...Object.fromEntries(keys.map(key => [key, snapshot[key]])),
    collections: Object.fromEntries(names.map(key => [key, snapshot.collections[key]]))};
  const census = inspectCensus(core);
  const configuration = reviewedConfiguration(snapshot);
  equal(census.sourceCounts, {shiftPlanningRequests: 0, shifts: 62, deliveryCalendar: 4, notificationEvents: 117});
  for (const name of ["shiftPlanningState", "shiftCoverageReserves", "shiftCoverageCredits", "shiftMembershipState",
    "shiftPlanningSyncCommands", "shiftCoverageCases", "shiftCoverageEffects", "shiftSwapRequests"]) equal(snapshot.collections[name], []);
  for (const name of ["shiftPlanningState/current", "shiftPlanningState/sourcePolicy", "shiftPlanningState/sheetsSubmission",
    "shiftRotations/delivery", "shiftRotations/market"]) assert.equal(snapshot.singletons[name], null, "initial authority must be absent");
  const legacy = byPath(snapshot.collections.shifts).map(doc => {
    const targetPath = shortPath(doc);
    assert.ok(targetPath.startsWith(`${ROOT}/shifts/`));
    assert.equal(doc.fields.source?.stringValue, "google_sheets"); assert.equal(doc.fields.status?.stringValue, "planned");
    assert.equal(doc.fields.planningSchemaVersion, undefined); assert.equal(doc.fields.lastBackendMutation, undefined);
    return {targetPath, expectedUpdateTime: doc.updateTime, originalCreateTime: doc.createTime,
      fields: doc.fields, fieldsDigest: digest(doc.fields)};
  });
  const users = snapshot.collections.users;
  assert.equal(users.length, 48); assert.equal(new Set(users.map(u => u.name)).size, 48);
  const eligible = users.filter(doc => isEligibleForShiftRotation({isActive: doc.fields.isActive?.booleanValue === true,
    roles: (doc.fields.roles?.arrayValue?.values || []).map(x => x.stringValue),
    isCommonPurchaseManager: doc.fields.isCommonPurchaseManager?.booleanValue === true})).map(doc => shortPath(doc).split("/").at(-1)).sort();
  assert.equal(eligible.length, 32);
  for (const type of ["delivery", "market"]) equal([...proposal.content.rotations[type].initialCursor.cohortUserIds].sort(), eligible, "cohort changed");
  const currentCells = literalCells(input.sheetCells);
  equal(currentCells, literalCells(input.referenceCells), "published cells changed");
  const file = input.fileAfter.data, before = input.fileBefore.data, parent = input.parent.data;
  equal(before, file, "Drive metadata changed during observation");
  assert.equal(file.id, WORKBOOK); assert.equal(file.mimeType, "application/vnd.google-apps.spreadsheet");
  assert.match(file.version, /^[1-9]\d*$/); equal(file.owners.map(o => o.emailAddress), [OWNER]);
  equal(file.parents, [parent.id]); assert.equal(parent.mimeType, "application/vnd.google-apps.folder");
  assert.equal(parent.name, "Mi unidad"); assert.ok(!parent.parents?.length, "parent chain not fully inspected");
  equal(parent.owners.map(o => o.emailAddress), [OWNER]);
  const permissions = input.filePermissions.data, parentPermissions = input.parentPermissions.data;
  assert.equal(input.filePermissions.fileId, WORKBOOK); assert.equal(input.parentPermissions.fileId, parent.id);
  assert.equal(permissions.nextPageToken, undefined); assert.equal(parentPermissions.nextPageToken, undefined);
  assert.equal(permissions.permissions.length, 5); assert.equal(parentPermissions.permissions.length, 1);
  equal(permissions.permissions.filter(p => p.role === "reader" && p.type === "user" && p.deleted !== true).map(p => p.emailAddress).sort(), READERS);
  equal(permissions.permissions.filter(p => p.role === "owner").map(p => p.emailAddress), [OWNER]);
  for (const permission of [...permissions.permissions.filter(p => p.role === "owner"), ...parentPermissions.permissions]) {
    assert.equal(permission.role, "owner"); assert.equal(permission.emailAddress, OWNER);
    assert.equal(permission.type, "user"); assert.notEqual(permission.deleted, true);
  }
  for (const report of [controls, reviewedControls, indexes]) { assert.equal(report.projectId, PROJECT); assert.equal(report.readOnly, true); }
  const normalizedFunctions = report => report.functions.map(row => {
    const fn = structuredClone(row.data);
    if (fn.eventTrigger?.eventFilters) fn.eventTrigger.eventFilters.sort((a, b) => a.attribute.localeCompare(b.attribute));
    return fn;
  }).sort((a, b) => a.name.localeCompare(b.name));
  equal(normalizedFunctions(controls), normalizedFunctions(reviewedControls), "deployed configuration drift");
  const routes = new Set(PAIRS.flatMap(pair => pair.slice(0, 2)));
  const select = report => report.functions.map(r => r.data).filter(fn => routes.has(fn.buildConfig.entryPoint));
  reviewDevelopCaptureControls({reviewedFunctions: select(reviewedControls), observedFunctions: select(controls)});
  assert.equal(controls.jobs.length, 3); assert.ok(controls.jobs.every(r => r.observed && r.data.state === "PAUSED"));
  for (const key of ["rulesRelease", "ruleset", "projectIam"]) { assert.equal(controls[key].observed, true); equal(controls[key], reviewedControls[key]); }
  assert.equal(indexes.databaseId, "(default)"); assert.equal(indexes.indexes.length, 6);
  assert.ok(indexes.indexes.every(i => i.state === "READY" && i.name.startsWith(`projects/${PROJECT}/databases/(default)/collectionGroups/`)));
  const planningIndex = indexes.indexes.find(i => i.name.includes("/collectionGroups/shiftPlanningRequests/"));
  equal(planningIndex?.fields.slice(0, 3), [{fieldPath:"requestedByUserId",order:"ASCENDING"},
    {fieldPath:"schemaVersion",order:"ASCENDING"},{fieldPath:"requestedAt",order:"DESCENDING"}]);
  assert.equal(input.assessment.canEnterMaintenance, false); assert.equal(input.assessment.canApply, false);
  assert.equal(input.assessment.stableSourceDigest, census.stableSetDigest);
  assert.equal(input.assessment.workbook.numericRevision, file.version);
  const evidenceDigests = Object.fromEntries(FILES.map(key => [key, digest(input[key])]));
  const suffix = digest({evidenceDigests, contentDigest}).slice(-20);
  const operationId = `hu084-initial-${suffix}`, recoveryOperationId = `hu084-inverse-${suffix}`;
  const canonical = proposal.content.shifts.map(shift => {
    assert.match(shift.id, /^[A-Za-z0-9_-]+$/); assert.match(shift.date, /^\d{4}-\d\d-\d\d$/);
    assert.ok(!legacy.some(row => row.targetPath === `${ROOT}/shifts/${shift.id}`));
    assert.equal(shift.completion.state, "uncompleted"); assert.equal(shift.status, "planned");
    return {kind: "create", targetPath: `${ROOT}/shifts/${shift.id}`, expectedBefore: "absent", semanticPayload: shift};
  });
  const helpers = proposal.content.helperProjectionDraft.map(change => {
    const sheet = input.sheetCells.sheets.find(s => s.properties.title === change.tabTitle);
    assert.ok(sheet && change.column === "F" && Number.isSafeInteger(change.rowNumber) && change.rowNumber > 0);
    const key = `${sheet.properties.sheetId}:${change.rowNumber - 1}:5`, observed = currentCells[key] || {};
    assert.equal(observed.userEnteredValue?.stringValue || "", "");
    assert.ok(observed.userEnteredValue === undefined || (Object.keys(observed.userEnteredValue).join() === "stringValue" && observed.userEnteredValue.stringValue === ""));
    assert.equal(change.before, ""); assert.ok(typeof change.after === "string" && change.after.trim());
    return {sheetId: sheet.properties.sheetId, rowNumber: change.rowNumber, column: "F", fields: "userEnteredValue",
      before: observed.userEnteredValue ?? null, after: {stringValue: change.after}, preservedNote: observed.note ?? null};
  });
  assert.equal(helpers.length, 53); assert.equal(new Set(helpers.map(h => `${h.sheetId}:${h.rowNumber}`)).size, 53);
  const sourcePolicy = {kind: "initial-migration-source-policy-binding", environment: "develop",
    path: `${ROOT}/shiftPlanningState/sourcePolicy`, expectedBefore: "absent", runtimeDocument: null,
    workbook: {fileId: WORKBOOK, version: file.version, typedCellsDigest: digest(currentCells), parentId: parent.id,
      authorityDigest: digest({file, permissions, parent, parentPermissions}), observationsHeldTogether: false},
    indexAuthorityDigest: digest(indexes), controlObservationDigest: digest(controls), sourceReadTime: snapshot.readTime,
    sourceDigest: census.stableSetDigest, configurationDigest: digest(configuration),
    configurationPaths: configuration.map(shortPath),
    rosterProjectionDigest: digest(byPath(users)), userProjectionOnly: true,
    rotations: proposal.content.rotations, initialCreditBalance: 0, retainedReserves: [],
    planningEnabled: false, coverageEnabled: false, notificationReplayAllowed: false,
    annualContinuity: null, inheritedPrefix: null, planningFrontier: null,
    reason: "Published-set migration only; partial market horizon and runtime annual policy are not admitted."};
  const policyDigest = digest(sourcePolicy);
  const forward = {kind: "develop-initial-migration-intent", operationId, policyDigest, evidenceDigests, contentDigest,
    sourceReadTime: snapshot.readTime, archives: legacy, publicWrites: [
      ...legacy.map(row => ({kind: "delete", targetPath: row.targetPath, expectedUpdateTime: row.expectedUpdateTime, expectedFieldsDigest: row.fieldsDigest})), ...canonical],
    controlMaterialization: {state: "closed", stateRevision: 1, writeEpoch: 1, sourcePolicyDigest: policyDigest,
      retainedCursors: Object.fromEntries(["delivery", "market"].map(type => [type, proposal.content.rotations[type].postPublishedCursor])),
      requiredRecords: ["current", "sourcePolicy", "delivery-rotation", "market-rotation", "baseline", "operation-terminal", "event-retention"]},
    sheets: {workbookId: WORKBOOK, observedVersion: file.version, cells: helpers,
      protocol: "existing-controlled-Sheets-adapter", technicalOperationMarkers: "materialize-and-bind-before-execution"},
    observedNoticesToPreserve: snapshot.collections.notificationEvents.map(doc => ({name: doc.name, updateTime: doc.updateTime, digest: digest(doc)})),
    expectedFirestoreWriteCount: 203, runtimeBindingsRequired: ["held-barrier", "operation-risk-acceptance", "source-policy-document",
      "commit-timestamps-and-backend-markers", "post-admission-source-versions", "index-write-budget", "Sheets-writer-and-operation-marker"]};
  const forwardDigest = digest(forward);
  const inverse = {kind: "develop-initial-migration-inverse-intent", operationId: recoveryOperationId, forwardOperationId: operationId,
    forwardDigest, policyDigest, evidenceDigests, requiredForwardReceipt: null,
    publicWrites: [...canonical.map(row => ({kind:"delete", targetPath:row.targetPath, precondition:"exact-forward-readback-version-and-payload"})),
      ...legacy.map(row => ({kind:"create", targetPath:row.targetPath, expectedBefore:"absent", fields:row.fields, fieldsDigest:row.fieldsDigest}))],
    sheets: {workbookId:WORKBOOK, cells:helpers.map(cell => ({...cell,before:cell.after,after:cell.before})),
      precondition:"exact-forward-afterimage-and-governed-recovery", preserveTechnicalMarkers:true},
    controlRecovery: {delete:["sourcePolicy","delivery-rotation","market-rotation"], maintenanceStatus:"closed", writeEpoch:2,
      activeRevision:null, retain:["archives","baseline","recovery-terminal","event-retention"], restoreAbsentSecurityState:false},
    expectedFirestoreWriteCount:140, restoreOriginalServiceTimestamps:false,
    stopOnUnexplainedChange:true, crossServiceAtomicity:false, reopenWriters:false};
  const body = {schemaVersion:1,kind:"develop-migration-review-package",projectId:PROJECT,environment:"develop",namespace:ROOT,
    evidenceDigests,sourcePolicy,policyDigest,forward,forwardDigest,inverse,inverseDigest:digest(inverse),
    exactness:"captured-data-and-static-intent; runtime manifest still requires held evidence and receipts",
    status:"PREPARED_NOT_ADMITTED",liveExecutable:false,canApply:false,canEnterMaintenance:false,
    annualPlanningReady:false,operationRiskAcceptance:null,window:null};
  // Supporting evidence changes the reviewed package, never the source policy,
  // forward/inverse intent or operation IDs. It grants no runtime authority.
  if (writerRehearsal) body.writerRehearsal = writerRehearsal;
  return {...body,packageDigest:digest(body)};
}

function loadManifest(filename) {
  const manifest = JSON.parse(fs.readFileSync(filename, "utf8"));
  const hasWriter = Object.hasOwn(manifest.files, "writerRehearsal");
  assert.deepEqual(Object.keys(manifest).sort(), ["files","reviewedContentDigest","reviewedProposalDigest",
    ...(hasWriter ? ["reviewedWriterRehearsalDigest"] : [])].sort());
  const files = [...FILES, ...(hasWriter ? ["writerRehearsal"] : [])];
  assert.deepEqual(Object.keys(manifest.files).sort(), files.sort());
  const input = {reviewedContentDigest:manifest.reviewedContentDigest,reviewedProposalDigest:manifest.reviewedProposalDigest};
  if (hasWriter) input.reviewedWriterRehearsalDigest = manifest.reviewedWriterRehearsalDigest;
  for (const key of files) {
    const entry = manifest.files[key]; assert.ok(path.isAbsolute(entry.path)); assert.ok(fs.statSync(entry.path).size <= 16 * 1024 * 1024);
    const bytes = fs.readFileSync(entry.path); assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256, `${key} file changed`);
    input[key] = JSON.parse(bytes);
  }
  return input;
}
module.exports = {prepareDevelopMigrationPackage, loadManifest, literalCells};
if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    assert.ok(args.length === 4 && args[0] === "--input" && args[2] === "--output", "review only; no apply mode");
    const result = prepareDevelopMigrationPackage(loadManifest(args[1]));
    fs.writeFileSync(args[3], JSON.stringify(result,null,2), {mode:0o600,flag:"wx"});
    console.log(JSON.stringify({packageDigest:result.packageDigest,forwardDigest:result.forwardDigest,inverseDigest:result.inverseDigest,
      legacyRows:result.forward.archives.length,canonicalRows:result.inverse.publicWrites.filter(w=>w.kind==="delete").length,
      helperCells:result.forward.sheets.cells.length,canApply:false,canEnterMaintenance:false}));
  } catch { console.error("develop_migration_package_rejected"); process.exitCode = 1; }
}
