"use strict";

// Opt-in private-data acceptance. The only external resource is an injected,
// in-memory Sheets API; this file creates no Google, Firebase or network client.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {createHash} = require("node:crypto");
const {createShiftPlanningDigest: digest} = require("../../lib/shift-planning-digest.js");
const {createShiftSheetsConfig} = require("../../lib/shift-sheets-config.js");
const {createShiftSheetsAdapter, shiftSheetsGridRows} = require("../../lib/shift-sheets.js");
const {readShiftSheetsImport} = require("../../lib/shift-sheets-import.js");
const {parseShiftSheetsImportTabs} = require("../../lib/shift-sheets-import-mapping.js");
const {isEligibleForShiftRotation} = require("../../lib/shift-eligibility.js");
const {shiftSheetsDateFromCell} = require("../../lib/shift-sheets-human-layout.js");
const {sheetsService, clone, setCell} = require("../shift-sheets-api-fixture.cjs");

const CONTENT_DIGEST = "shift-planning:v1:sha256:36f53c5e1391e244383fb109920c697d0e7dc6717afa2e1bc558a1e1120f665f";
const PROPOSAL_DIGEST = "shift-planning:v1:sha256:05d1efc316f3878cdb191d5cc4acc51bff5a23069559bff6ca53eceddc0446b9";
const sha = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const same = (left, right, message) => assert.equal(digest(left), digest(right), message);
const literal = (cell) => String(cell?.userEnteredValue?.stringValue ??
  cell?.userEnteredValue?.numberValue ?? "");

const literalImage = (spreadsheet) => {
  const entries = [];
  for (const sheet of spreadsheet.sheets) {
    for (const [row, cells] of shiftSheetsGridRows(sheet).entries()) {
      for (const [column, cell] of cells.entries()) {
        if (cell?.userEnteredValue !== undefined) {
          entries.push([`${sheet.properties.sheetId}:${row + 1}:${column}`, cell.userEnteredValue]);
        }
      }
    }
  }
  return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)));
};

const plainMember = (document) => {
  const fields = document.fields;
  const phones = [fields.phoneNumber?.stringValue, fields.phone?.stringValue]
    .filter((value) => typeof value === "string" && value.trim());
  const roles = (fields.roles?.arrayValue?.values ?? []).map((value) => value.stringValue);
  const eligible = isEligibleForShiftRotation({roles,
    isActive: fields.isActive?.booleanValue,
    isCommonPurchaseManager: fields.isCommonPurchaseManager?.booleanValue});
  return {userId: document.name.split("/").at(-1), names: [fields.displayName?.stringValue],
    phones: phones.slice(0, 1), eligibleTypes: eligible ? ["delivery", "market"] : []};
};

// Reuse the reviewed human layouts, without adding dates or inventing calendar
// authority. Non-participant rows are retained as exact literal decorations.
const capturedTabs = (spreadsheet) => parseShiftSheetsImportTabs(spreadsheet.sheets.map((sheet) => {
  const type = sheet.properties.title.includes("reparto") ? "delivery" : "market";
  const rows = shiftSheetsGridRows(sheet), occupied = new Set();
  for (const [index, row] of rows.entries()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(shiftSheetsDateFromCell(literal(row[0])))) continue;
    for (let offset = 0; offset < (type === "delivery" ? 1 : 4); offset++) occupied.add(index + offset);
  }
  return {type, seasonStartYear: Number(sheet.properties.title.match(/20\d\d/)[0]),
    title: sheet.properties.title, layout: `${type}_human`,
    decorations: rows.flatMap((row, index) => occupied.has(index) ? [] :
      [{rowNumber: index + 1, cells: row.map(literal)}])};
}));

const loadEvidence = (directory) => {
  assert.ok(directory && path.isAbsolute(directory), "An absolute private evidence directory is required");
  const currentPath = path.join(directory, "read-only-capture.json");
  const proposalPath = path.join(directory, "content-proposal.json");
  const receiptPath = path.join(directory, "validation-receipt.json");
  const current = read(currentPath), proposal = read(proposalPath), receipt = read(receiptPath);
  const {contentDigest, proposalDigest, ...proposalBody} = proposal;
  const {receiptDigest, ...receiptBody} = receipt;
  assert.equal(current.environment, "develop");
  assert.equal(proposal.environment, "develop");
  assert.equal(proposal.liveExecutable, false);
  assert.equal(receipt.liveExecutable, false);
  assert.equal(contentDigest, CONTENT_DIGEST);
  assert.equal(proposalDigest, PROPOSAL_DIGEST);
  assert.equal(digest(proposal.content), contentDigest);
  assert.equal(digest(proposalBody), proposalDigest);
  assert.equal(digest(receiptBody), receiptDigest);
  assert.equal(receipt.contentDigest, contentDigest);
  assert.equal(receipt.proposalDigest, proposalDigest);
  assert.equal(sha(currentPath), receipt.sources.currentCaptureSha256);
  assert.equal(proposal.content.workbookId, current.spreadsheet.spreadsheetId);
  assert.equal(proposal.content.ownerProvenance, "declared_synthetic_develop_only");
  assert.equal(current.spreadsheet.sheets.length, 4);
  assert.equal(current.sheetMetadata.sheets.length, 6);
  assert.equal(proposal.content.shifts.length, 72);
  assert.equal(proposal.content.helperProjectionDraft.length, 53);
  assert.equal(Object.keys(literalImage(current.spreadsheet)).length, 399);
  return {current, proposal, sources: {currentCaptureSha256: sha(currentPath),
    proposalSha256: sha(proposalPath), validationReceiptSha256: sha(receiptPath)}};
};

// Exported so the SDK acceptance can use the same parsed observation and double,
// rather than manufacturing a second representation of the 53 reviewed edits.
const createCapturedMigrationSheetsFixture = async (directory) => {
  const evidence = loadEvidence(directory), {current, proposal} = evidence;
  const config = createShiftSheetsConfig({environment: "develop",
    workbooks: {develop: proposal.content.workbookId}});
  const sheets = sheetsService(config.workbookId);
  const grids = new Map(current.spreadsheet.sheets.map((sheet) => [sheet.properties.sheetId, sheet]));
  sheets.state = {...clone(current.sheetMetadata), sheets: current.sheetMetadata.sheets.map((metadata) => {
    const grid = grids.get(metadata.properties.sheetId);
    return grid ? {...clone(metadata), ...clone(grid)} : clone(metadata);
  })};
  // This counter belongs only to the in-memory copy; it is not a Drive observation.
  sheets.revision = 1;
  const members = current.users.documents.map(plainMember);
  assert.equal(members.length, 48);
  assert.equal(members.filter((member) => member.eligibleTypes.length).length, 32);
  const baseline = proposal.content.shifts.map((row) => ({id: row.id, type: row.type, date: row.date,
    rotationOwnerUserIds: row.rotationOwnerUserIds, assignedUserIds: row.assignedUserIds,
    helperUserId: row.helperUserId, status: row.status, source: "app", origin: "planner"}));
  const tabs = capturedTabs(current.spreadsheet);
  const observation = await readShiftSheetsImport({config, sheets, tabs, members, baseline,
    readWorkbookVersion: async () => String(sheets.revision)});
  assert.equal(observation.assignments.length, 72);
  same(observation.missingIds, [], "No captured published date may be missing");
  const humanRows = observation.humanRows.filter((row) => digest(row.before) !== digest(row.after));
  assert.equal(humanRows.length, 53, "The real reader must propose exactly the 53 helper edits");
  const rows = baseline.filter((row) => humanRows.some((human) => human.id === row.id));
  const names = new Map(members.map((member) => [member.userId, member.names[0]]));
  const expectedDraft = humanRows.map((row) => ({tabTitle: row.sheetName, rowNumber: row.rowNumber,
    column: "F", before: "", after: row.helper.name})).sort((a, b) =>
    a.tabTitle.localeCompare(b.tabTitle) || a.rowNumber - b.rowNumber);
  const declaredDraft = clone(proposal.content.helperProjectionDraft).sort((a, b) =>
    a.tabTitle.localeCompare(b.tabTitle) || a.rowNumber - b.rowNumber);
  same(expectedDraft, declaredDraft, "Reader proposals must match the approved draft exactly");
  const delivery = baseline.filter((row) => row.type === "delivery").sort((a, b) => a.date.localeCompare(b.date));
  assert.equal(delivery.at(-1).helperUserId, null);
  for (const [index, row] of delivery.slice(0, -1).entries()) {
    assert.equal(row.helperUserId, delivery[index + 1].assignedUserIds[0]);
    assert.ok(names.has(row.helperUserId));
  }
  same([2026, 2027].map((year) => baseline.filter((row) => row.type === "market" &&
    Number(row.date.slice(0, 4)) - (Number(row.date.slice(5, 7)) < 9 ? 1 : 0) === year).length),
  [10, 8], "Do not fill the unpublished market dates");
  const forward = {operationId: "hu084-local-helpers-forward", rows, humanRows};
  const inverse = {operationId: "hu084-local-helpers-inverse",
    rows: rows.map((row) => ({...row, helperUserId: null})),
    humanRows: humanRows.map((row) => ({...row, before: clone(row.after), after: clone(row.before),
      helper: {userId: null, name: ""}}))};
  return {evidence, config, sheets, members, tabs, baseline, observation, forward, inverse,
    adapter: createShiftSheetsAdapter({config, sheets}), initial: clone(sheets.state)};
};

const assertOnlyHelperRequests = (fixture, batch) => {
  const drafts = new Set(fixture.evidence.proposal.content.helperProjectionDraft.map((cell) => {
    const sheet = fixture.initial.sheets.find((item) => item.properties.title === cell.tabTitle);
    return `${sheet.properties.sheetId}:${cell.rowNumber}:5`;
  }));
  const cells = batch.requestBody.requests.filter((request) => request.updateCells);
  assert.equal(cells.length, 53);
  for (const request of cells) {
    const update = request.updateCells, range = update.range;
    assert.equal(update.fields, "userEnteredValue");
    assert.equal(range.startColumnIndex, 5);
    assert.equal(range.endColumnIndex, 6);
    assert.equal(range.endRowIndex, range.startRowIndex + 1);
    assert.equal(update.rows.length, 1);
    assert.equal(update.rows[0].values.length, 1);
    assert.ok(drafts.delete(`${range.sheetId}:${range.startRowIndex + 1}:5`));
  }
  assert.equal(drafts.size, 0);
  const technical = batch.requestBody.requests.filter((request) => !request.updateCells);
  assert.equal(technical.length, 2, "Only the adapter's two retained operation markers are permitted");
  assert.ok(technical.every((request) => request.createDeveloperMetadata || request.updateDeveloperMetadata));
};

const assertUntouchedContent = (fixture) => {
  const before = literalImage(fixture.initial), after = literalImage(fixture.sheets.state);
  for (const cell of fixture.evidence.proposal.content.helperProjectionDraft) {
    const sheet = fixture.initial.sheets.find((item) => item.properties.title === cell.tabTitle);
    const key = `${sheet.properties.sheetId}:${cell.rowNumber}:5`;
    delete before[key]; delete after[key];
  }
  assert.equal(Object.keys(before).length, 399);
  same(before, after, "All captured literal values outside the 53 helpers must remain exact");
  const gridIds = new Set(fixture.evidence.current.spreadsheet.sheets.map((sheet) => sheet.properties.sheetId));
  for (const initial of fixture.initial.sheets) {
    if (!gridIds.has(initial.properties.sheetId) || initial.properties.title.includes("mercado")) {
      same(initial, fixture.sheets.state.sheets.find((sheet) => sheet.properties.sheetId === initial.properties.sheetId),
        "Historical metadata and both market grids must remain untouched");
    }
  }
};

const registerAcceptance = () => {
  const {test, after} = require("node:test");
  const directory = process.env.HU084_MIGRATION_EVIDENCE_DIR;
  const resultDirectory = process.env.HU084_MIGRATION_RESULT_DIR;
  const enabled = Boolean(directory || resultDirectory);
  if (enabled) {
    assert.ok(directory && path.isAbsolute(directory));
    assert.ok(resultDirectory && path.isAbsolute(resultDirectory));
    assert.notEqual(path.resolve(directory), path.resolve(resultDirectory), "Keep outputs separate from input evidence");
    assert.ok(fs.statSync(resultDirectory).isDirectory());
    assert.equal(fs.existsSync(path.join(resultDirectory, "hu084-develop-migration-sheets-receipt.json")), false);
  }
  const completed = {}, run = (name, action) => test(name, {skip: !enabled}, action);
  const make = () => createCapturedMigrationSheetsFixture(directory);
  const submit = (fixture, operation) => fixture.adapter.reconcile({...operation, authorizeMutation: async () => {}});

  run("captured workbook normalizes only 53 helpers and restores exact literals with read-only replays", async () => {
    const f = await make();
    assert.equal((await submit(f, f.forward)).kind, "verified");
    assert.equal(f.sheets.mutations.length, 1);
    assertOnlyHelperRequests(f, f.sheets.mutations[0]);
    assertUntouchedContent(f);
    assert.equal(Object.keys(literalImage(f.sheets.state)).length, 452);
    assert.equal((await submit(f, f.forward)).kind, "verified");
    assert.equal(f.sheets.mutations.length, 1);
    assert.equal((await submit(f, f.inverse)).kind, "verified");
    assert.equal(f.sheets.mutations.length, 2);
    assertOnlyHelperRequests(f, f.sheets.mutations[1]);
    same(literalImage(f.sheets.state), literalImage(f.initial), "Inverse must restore every original literal value");
    assertUntouchedContent(f);
    assert.equal((await submit(f, f.inverse)).kind, "verified");
    assert.equal(f.sheets.mutations.length, 2);
    completed.forwardInverse = {helperCells: 53, literalCellsRestored: 399, sdkCalls: 2,
      forwardReplayExtraCalls: 0, inverseReplayExtraCalls: 0, terminalHelperNull: true,
      marketPublishedRowsBySeason: [10, 8], historicalMetadataOnlyTabsUnchanged: 2};
  });

  run("changed forward and inverse before-images reject before authorization or SDK submission", async () => {
    for (const direction of ["forward", "inverse"]) {
      const f = await make();
      if (direction === "inverse") assert.equal((await submit(f, f.forward)).kind, "verified");
      const row = f.forward.humanRows[0];
      const sheet = f.sheets.state.sheets.find((item) => item.properties.sheetId === row.sheetId);
      setCell(sheet, row.rowNumber - 1, 3, {userEnteredValue: {stringValue: "Local conflict probe"}});
      const before = clone(f.sheets.state), calls = f.sheets.mutations.length;
      let authorizations = 0;
      await assert.rejects(f.adapter.reconcile({...f[direction],
        authorizeMutation: async () => { authorizations++; }}), {code: "sheets_manual_conflict"});
      assert.equal(authorizations, 0);
      assert.equal(f.sheets.mutations.length, calls);
      // The API double's setCell can leave sparse trailing cells. Its JSON
      // transport image normalizes those holes without changing literal values.
      same(clone(f.sheets.state), before, "Rejected image guard must preserve the conflicting workbook");
    }
    completed.beforeImageDrift = {forwardRejected: true, inverseRejected: true, extraSdkCalls: 0};
  });

  run("external authorization refusal prevents the real adapter from submitting its prepared batch", async () => {
    const f = await make();
    let authorizations = 0;
    await assert.rejects(f.adapter.reconcile({...f.forward, authorizeMutation: async () => {
      authorizations++; throw new Error("Injected closed writer authority");
    }}), /Injected closed writer authority/);
    assert.equal(authorizations, 1);
    assert.equal(f.sheets.mutations.length, 0);
    same(f.sheets.state, f.initial, "Authorization rejection must leave the original workbook unchanged");
    completed.authorityRefusal = {authorizations: 1, sdkCalls: 0};
  });

  run("lost acknowledgement recovers through inspection and retained marker without another submission", async () => {
    const f = await make();
    f.sheets.loseAcknowledgement = true;
    f.sheets.onMutation = async () => { f.sheets.failRead = true; };
    const result = await submit(f, f.forward);
    assert.equal(result.kind, "ambiguous");
    assert.equal(result.reason, "read_back_unavailable");
    assert.equal(f.sheets.mutations.length, 1);
    assertUntouchedContent(f);
    f.sheets.failRead = false; f.sheets.onMutation = null;
    assert.equal((await f.adapter.inspect(f.forward)).kind, "verified");
    assert.equal((await submit(f, f.forward)).kind, "verified");
    assert.equal(f.sheets.mutations.length, 1);
    completed.lostAcknowledgement = {initial: "ambiguous", inspection: "verified", sdkCalls: 1,
      retainedMarkerReplayExtraCalls: 0, durableCallerTTLExercised: false};
  });

  run("post-submission source drift stays ambiguous and retained replay cannot overwrite it", async () => {
    const f = await make(), human = f.forward.humanRows[0];
    f.sheets.onMutation = async () => {
      const sheet = f.sheets.state.sheets.find((item) => item.properties.sheetId === human.sheetId);
      setCell(sheet, human.rowNumber - 1, 3, {userEnteredValue: {stringValue: "Local post-submit probe"}});
    };
    assert.equal((await submit(f, f.forward)).kind, "ambiguous");
    const changed = clone(f.sheets.state);
    assert.equal((await f.adapter.inspect(f.forward)).kind, "ambiguous");
    assert.equal((await submit(f, f.forward)).kind, "ambiguous");
    assert.equal(f.sheets.mutations.length, 1);
    same(clone(f.sheets.state), changed, "Uncertain read-back must not overwrite a later edit");
    completed.postSubmissionDrift = {initial: "ambiguous", replay: "ambiguous", sdkCalls: 1};
  });

  after(() => {
    if (!enabled) return;
    const loaded = loadEvidence(directory);
    const body = {schemaVersion: 1, scope: "in_memory_sheets_adapter_acceptance_only", liveExecutable: false,
      contentDigest: CONTENT_DIGEST, proposalDigest: PROPOSAL_DIGEST, sources: loaded.sources,
      scriptSha256: sha(__filename), status: Object.keys(completed).length === 5 ? "passed" : "incomplete",
      completed, limitations: [
        "No Firestore, CloudEvent delivery, IAM, deployed Rules, Google Drive, FCM or actual Google Sheets was exercised.",
        "The numeric revision belongs only to the injected in-memory workbook, not the captured live file.",
        "Replay after a retained marker is proven; durable unknown-outcome exclusion and TTL require the real Firestore caller acceptance.",
        "The adapter has no Sheets CAS; image validation cannot exclude a human edit between its read and submission.",
        "Only captured userEnteredValue and observed historical metadata are certified; native notes, formats, groups and historical grids are not captured.",
        "formattedValue is derived and is not recalculated or used as an oracle by this double.",
        "The terminal helper remains null; the market horizon stays 10 plus 8 dates, without a claim of complete seasons.",
      ]};
    const receipt = {...body, receiptDigest: digest(body)};
    fs.writeFileSync(path.join(resultDirectory, "hu084-develop-migration-sheets-receipt.json"),
      JSON.stringify(receipt, null, 2) + "\n", {mode: 0o600});
  });
};

module.exports = {createCapturedMigrationSheetsFixture};
if (require.main === module) registerAcceptance();
