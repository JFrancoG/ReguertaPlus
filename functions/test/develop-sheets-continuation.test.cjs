"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {test} = require("node:test");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {assertShiftSheetsOwnerPreservation} = require("../lib/shift-sheets-owner-manifest.js");
const {planBatch} = require("../scripts/prepare-develop-helper-batch.cjs");
const {runDevelopSheetsContinuation} = require("../scripts/develop-sheets-continuation.cjs");
const {batchFixture} = require("./develop-helper-batch-fixture.cjs");
const {createSheetsContinuationAccess, IDENTITY} = require("../scripts/develop-sheets-continuation-access.cjs");
const {createOriginalWindowOwner} = require("../scripts/develop-original-window-provider.cjs");
const {createOriginalDevelopTimeBudget, ORIGINAL_DEVELOP_MODE} = require("../scripts/develop-copy-time-budget.cjs");
const {createIsolationReader} = require("../scripts/develop-helper-copy-provider.cjs");
const {createIamProvider} = require("../scripts/develop-writer-copy-provider.cjs");
const {originalWindowFixture} = require("./develop-original-window-fixture.cjs");
const {content} = require("./shift-sheets-api-fixture.cjs");

function laggingIamPolicy(iam, provider, lagMillis, observations) {
  let previous;
  let visibleAt = 0;
  let direction;
  return {...iam,
    async setPolicy(policy) {
      previous = structuredClone(provider.state.policy);
      const applied = await iam.setPolicy(policy);
      direction = policy.bindings.length ? "grant" : "remove";
      visibleAt = provider.state.now + lagMillis[direction];
      return applied;
    },
    async readIdentity() {
      const value = await iam.readIdentity();
      if (!previous || provider.state.now >= visibleAt) return value;
      observations[direction]++;
      return {...value, policy: structuredClone(previous)};
    },
  };
}

async function scenario(t, {uncertainGrant = false, policyLag = {grant: 0, remove: 0}, shared = null} = {}) {
  const book = shared?.book ?? batchFixture();
  const before = book.observe();
  const plan = await planBatch({...book, observation: before});
  const updates = plan.requests.filter(request => request.updateCells);
  const markers = plan.requests.filter(request => request.createDeveloperMetadata);
  assert.equal(updates.length, 53);
  assert.equal(markers.length, 2);
  assert.equal(plan.requests.length, 55);
  const {projectionDigest} = JSON.parse(markers[0].createDeveloperMetadata.developerMetadata.metadataValue);
  const journalRoot = shared?.input.journalRoot ?? fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "develop-sheets-continuation-")));
  if (!shared) t.after(() => fs.rmSync(journalRoot, {recursive: true, force: true}));
  const provider = shared?.provider ?? originalWindowFixture({batch: book});
  const nowMillis = () => provider.state.now;
  const sleep = async ms => { provider.state.now += ms; };
  const start = nowMillis();
  const binding = {
    operationId: plan.operation.operationId,
    planDigest: plan.planDigest,
    requestDigest: plan.requestDigest,
    projectionDigest,
    workbookId: before.fileId,
    receiptDigest: digest("retained-firestore-receipt"),
    afterimageProof: digest("read-back-of-all-203-firestore-targets"),
    checkpointDigest: digest("retained-barrier-checkpoint"),
    window: {startsAtMillis: start, endsAtMillis: start + 1200000, dispatchDeadlineMillis: start + 160000},
  };
  const firestoreState = {
    operationId: binding.operationId, receiptDigest: binding.receiptDigest,
    afterimageProof: binding.afterimageProof, checkpointDigest: binding.checkpointDigest,
    verifiedImages: 203, verifiedCreates: 141, verifiedDeletes: 62,
    operationPresent: true, baselinePresent: true, barrierPresent: true, failurePresent: false,
  };
  const history = {firestoreReads: 0, ownerReads: 0, controls: [], sent: [], closures: [], staleIam: {grant: 0, remove: 0}};
  let access;
  const input = {
    binding, plan, originalSnapshot: before.snapshot, journalRoot, nowMillis,
    async readFirestore() {
      history.firestoreReads++;
      return structuredClone(firestoreState);
    },
    async readOwner() {
      history.ownerReads++;
      return access.capture();
    },
    async assertControls({phase}) {
      history.controls.push(phase);
      if (phase === "initial") return access.verifyIdle();
      if (phase === "prepare-writer") return access.acquire();
      if (phase === "before-dispatch") await access.issue();
    },
    async submitBatch({workbookId, requests, operationId, requestDigest, projectionDigest: actualProjection, assertSubmissionNow}) {
      assert.equal(workbookId, binding.workbookId);
      assert.equal(operationId, binding.operationId);
      assert.equal(requestDigest, binding.requestDigest);
      assert.equal(actualProjection, binding.projectionDigest);
      assert.deepEqual(requests, plan.requests);
      return access.submit(requests, () => {
        assertSubmissionNow();
        history.sent.push(structuredClone(requests));
      });
    },
  };
  async function run() {
    const ownerBearer = "fixture-owner-continuation-" + (shared ? "second-" : "first-") + history.closures.length;
    const budget = createOriginalDevelopTimeBudget({...binding.window, reviewedMode: ORIGINAL_DEVELOP_MODE,
      nowMillis, fetchImpl: provider.fetchImpl});
    const transport = {iamBearer: "fixture-iam", fetchImpl: budget.fetch, nowMillis};
    const events = [];
    access = createSheetsContinuationAccess({window: binding.window, requests: plan.requests, budget, nowMillis, sleep,
      owner: createOriginalWindowOwner({ownerBearer, fetchImpl: budget.fetch, nowMillis, sleep}),
      iam: laggingIamPolicy(createIamProvider({...transport, identity: IDENTITY}), provider, policyLag, history.staleIam),
      isolated: createIsolationReader(transport),
      channel: {async grant(permission, controls) {
        await provider.ownerChannel.grant(permission, controls);
        if (uncertainGrant) throw Object.assign(new Error("Native grant outcome unknown"), {nativeGrantUncertain: true});
        return {closure: {grantCapability: "consumed"}};
      }, remove: provider.ownerChannel.remove},
      assertQuiet() {}, record: event => events.push(event.phase)});
    try {
      return await runDevelopSheetsContinuation(input);
    } finally {
      const closure = await access.close();
      const neverObserved = policyLag.grant === Infinity;
      const expectedFailures = neverObserved ? ["iam"] : uncertainGrant ? ["file"] : [];
      assert.deepEqual(closure.failures, expectedFailures, JSON.stringify(events));
      assert.equal(closure.verified, expectedFailures.length === 0);
      assert.deepEqual(closure.receipts.oauth, {verified: true, revocationStatus: 200, drive: 401, sheets: 401});
      assert.equal(provider.state.permission, false);
      assert.equal(provider.state.disabled, true);
      if (neverObserved) {
        assert.equal(provider.state.policy.bindings.length, 1, "The unknown grant must not be reported removed");
        assert.equal(Object.hasOwn(closure.receipts, "iam"), false);
      } else {
        assert.deepEqual(provider.state.policy.bindings ?? [], []);
      }
      assert.equal(provider.state.revoked.has(ownerBearer), true);
      assert.equal(provider.state.businessWrites, 0);
      if (events.includes("enable-intent") && !neverObserved) assert.equal(closure.receipts.iam.isolated, true);
      if (events.includes("writer-probed")) {
        assert.ok([403, 404].includes(closure.receipts.file.denialStatus));
      }
      history.closures.push({minted: events.includes("writer-probed"), events});
    }
  }
  return {input, book, provider, binding, plan, updates, markers, history, firestoreState, run,
    expireDispatch: () => { provider.state.now = binding.window.dispatchDeadlineMillis; },
    async establishProjectedState() {
      await book.sheets.batchUpdate({spreadsheetId: binding.workbookId, requestBody: {requests: plan.requests}}, {retry: false});
    },
  };
}

function assertProjection(fixture) {
  const {book, plan, updates, markers} = fixture;
  const after = book.observe().snapshot;
  for (const {updateCells: {range, rows}} of updates) {
    const sheet = after.sheets.find(item => item.properties.sheetId === range.sheetId);
    assert.deepEqual(content(sheet, range.startRowIndex, range.startColumnIndex), rows[0].values[0].userEnteredValue);
  }
  for (const {createDeveloperMetadata: {developerMetadata: expected}} of markers) {
    const sheet = after.sheets.find(item => item.properties.sheetId === expected.location.sheetId);
    const actual = sheet.developerMetadata.filter(value => value.metadataKey === expected.metadataKey);
    assert.equal(actual.length, 1);
    assert.equal(actual[0].metadataValue, expected.metadataValue);
  }
  assertShiftSheetsOwnerPreservation({manifest: plan.preservation, after});
}

test("the original workbook submits 53 cells and two markers once and verifies the untouched Firestore post-image", async t => {
  const fixture = await scenario(t, {policyLag: {grant: 4000, remove: 4000}});
  const originalFirestore = structuredClone(fixture.firestoreState);
  const result = await fixture.run();
  assert.equal(result.kind, "projection-verified");
  assert.deepEqual(fixture.history.sent, [fixture.plan.requests]);
  assert.equal(fixture.book.sheets.mutations.length, 1);
  assertProjection(fixture);
  assert.ok(fixture.history.firestoreReads >= 2);
  assert.ok(fixture.history.ownerReads >= 2);
  assert.equal(fixture.history.closures[0].minted, true);
  assert.ok(fixture.history.staleIam.grant > 0);
  assert.ok(fixture.history.staleIam.remove > 0);
  assert.ok(fixture.history.controls.includes("before-dispatch"));
  assert.ok(fixture.history.controls.includes("final-readback"));
  assert.deepEqual(fixture.firestoreState, originalFirestore);
});

test("the two retained markers and all projected values verify without calling the writer", async t => {
  const fixture = await scenario(t);
  await fixture.establishProjectedState();
  const originalFirestore = structuredClone(fixture.firestoreState);
  const result = await fixture.run();
  assert.equal(result.kind, "already-projected");
  assert.deepEqual(fixture.history.sent, []);
  assert.equal(fixture.book.sheets.mutations.length, 1, "Only fixture setup changed the workbook");
  assert.ok(fixture.history.firestoreReads >= 1);
  assert.equal(fixture.history.closures[0].minted, false);
  assertProjection(fixture);
  assert.deepEqual(fixture.firestoreState, originalFirestore);
});

test("partial projection, foreign marker, unrelated change, Firestore drift and expired authority prevent dispatch", async t => {
  for (const defect of ["one-cell", "wrong-marker", "unrelated-note", "different-firestore",
    "drift-after-grant", "uncertain-grant", "iam-grant-timeout", "iam-never-observed", "missed-deadline"]) {
    const grantLags = {"iam-grant-timeout": 66000, "iam-never-observed": Infinity};
    const fixture = await scenario(t, {uncertainGrant: defect === "uncertain-grant",
      policyLag: {grant: grantLags[defect] ?? 0, remove: 0}});
    const {book, updates, markers, input, firestoreState} = fixture;
    if (defect === "one-cell") {
      const {range, rows} = updates[0].updateCells;
      const sheet = book.sheets.state.sheets.find(item => item.properties.sheetId === range.sheetId);
      sheet.data[0].rowData[range.startRowIndex].values[range.startColumnIndex].userEnteredValue = rows[0].values[0].userEnteredValue;
    } else if (defect === "wrong-marker") {
      const expected = markers[0].createDeveloperMetadata.developerMetadata;
      const sheet = book.sheets.state.sheets.find(item => item.properties.sheetId === expected.location.sheetId);
      sheet.developerMetadata.push({...expected, metadataId: 1, metadataValue: "some-other-operation"});
    } else if (defect === "unrelated-note") {
      book.sheets.state.sheets[0].data[0].rowData[150].values[0].note = "Changed outside the reviewed 53 cells";
    } else if (defect === "different-firestore") {
      firestoreState.afterimageProof = digest("different committed afterimage");
    } else if (defect === "drift-after-grant") {
      const read = input.readFirestore;
      input.readFirestore = async () => {
        const observed = await read();
        if (fixture.history.controls.includes("prepare-writer")) observed.failurePresent = true;
        return observed;
      };
    } else if (defect === "missed-deadline") {
      const submit = input.submitBatch;
      input.submitBatch = args => { fixture.expireDispatch(); return submit(args); };
    }
    const firestoreBefore = structuredClone(firestoreState);
    const snapshotBefore = book.observe().snapshotDigest;
    const result = await fixture.run();
    assert.equal(result.kind, "inspection-required", defect);
    assert.deepEqual(fixture.history.sent, [], defect);
    const closure = fixture.history.closures[0];
    assert.equal(closure.minted, defect === "missed-deadline");
    assert.equal(closure.events.includes("enable-intent"),
      ["drift-after-grant", "uncertain-grant", "iam-grant-timeout", "iam-never-observed", "missed-deadline"].includes(defect));
    assert.equal(result.canRetry, false);
    assert.equal(book.sheets.mutations.length, 0, defect);
    assert.equal(book.observe().snapshotDigest, snapshotBefore, defect);
    assert.deepEqual(firestoreState, firestoreBefore, defect);
  }
});

test("competing executions and a lost response retain the single submission across later inspections", async t => {
  const first = await scenario(t);
  const second = await scenario(t, {shared: first});
  let readyCount = 0, bothSawOriginal, contenderInspected;
  const initialReads = new Promise(resolve => { bothSawOriginal = resolve; });
  const loserFinished = new Promise(resolve => { contenderInspected = resolve; });
  for (const fixture of [first, second]) {
    const controls = fixture.input.assertControls;
    fixture.input.assertControls = async context => {
      if (context.phase === "prepare-writer") await loserFinished;
      const result = await controls(context);
      if (context.phase === "initial") {
        if (++readyCount === 2) bothSawOriginal();
        await initialReads;
      }
      return result;
    };
  }
  const outcomes = await Promise.all([first, second].map(async fixture => {
    const result = await fixture.run();
    if (result.kind === "inspection-required") contenderInspected();
    return result;
  }));
  assert.deepEqual(outcomes.map(result => result.kind).sort(), ["inspection-required", "projection-verified"]);
  assert.equal(fs.readdirSync(path.join(first.input.journalRoot, first.binding.operationId))
    .filter(name => name === "writer-claim.json").length, 1);
  assert.equal(first.provider.state.mints, 1);
  assert.equal(first.book.sheets.mutations.length, 1);
  assert.equal(first.history.sent.length + second.history.sent.length, 1);
  assertProjection(first);

  for (const applied of [true, false]) {
    const fixture = await scenario(t);
    const {sheets} = fixture.book;
    const originalFirestore = structuredClone(fixture.firestoreState);
    sheets.loseAcknowledgement = applied;
    sheets.rejectBeforeApply = !applied;
    const first = await fixture.run();
    assert.equal(first.kind, "inspection-required");
    assert.equal(first.firstFailure.step, "sheets-submit");
    assert.equal(first.failureDurable, true);
    assert.equal(first.intentRetained, true);
    assert.equal(fixture.history.sent.length, 1);
    assert.equal(sheets.mutations.length, 1);
    assert.equal(sheets.revision, applied ? 1 : 0);
    sheets.loseAcknowledgement = false;
    sheets.rejectBeforeApply = false;
    const later = await fixture.run();
    assert.equal(later.kind, applied ? "already-projected" : "inspection-required");
    assert.equal(fixture.history.sent.length, 1);
    assert.equal(sheets.mutations.length, 1);
    assert.deepEqual(fixture.history.closures.map(entry => entry.minted), [true, false]);
    if (applied) assertProjection(fixture);
    assert.deepEqual(fixture.firestoreState, originalFirestore);
  }
});
