"use strict";

// A loopback-only rehearsal, not an exported migration endpoint. The common
// admission/fence adapter executes both directions. No annual bundle, deployed
// IAM proof, Drive version or historical ownership is fabricated here.
const assert = require("node:assert/strict");
const {Firestore, Timestamp, GeoPoint} = require("@google-cloud/firestore");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {encodeShiftPlanningFirestoreValue: encodeValue,
  decodeShiftPlanningFirestoreDocument: decode,
  decodeShiftPlanningFirestoreValue,
  createShiftPlanningPublicShiftMaterialization,
  createShiftPlanningActivationOperationTerminal,
  parseShiftPlanningActivationOperationTerminal,
  attachShiftPlanningBackendMutationMarker,
  createShiftPlanningBeforeImageEnvelope,
  parseShiftPlanningPublicShiftDocument} = require("../lib/shift-planning-publication-contract.js");
const {parseShiftPlanningRecoveryOperationTerminal,
  buildShiftPlanningExactReplacementData} = require("../lib/shift-planning-inverse-materializer.js");
const {buildShiftPlanningAuthoritativeState} = require("../lib/shift-planning-state-persistence.js");
const {isEligibleForShiftRotation} = require("../lib/shift-eligibility.js");
const {resolveShiftRotationBootstrap} = require("../lib/shift-rotation-bootstrap.js");
const {consumeRotationPositions} = require("../lib/shift-planning-contract.js");
const {parseShiftPlanningMaintenanceState} = require("../lib/shift-planning-wire.js");
const {applyShiftPlanningFirestoreTransactionAttempt} = require("../lib/shift-planning-firestore-transaction-attempt.js");
const {SHIFT_PLANNING_FIRESTORE_ADMISSION_REVISION, prepareShiftPlanningFirestoreTransaction} = require("../lib/shift-planning-firestore-transaction-manifest.js");
const {KIND: CLOSED_POLICY, verifyClosedPolicy} = require("./develop-closed-migration-policy.cjs");
const {createTrustedShiftPlanningIntakeBarrierAdapter, createTrustedShiftPlanningAdministratorBarrierAdapter} = require("../lib/shift-planning-trusted-intake-barrier-adapter.js");
const {DEVELOP_HISTORICAL_WORKBOOK} = require("../lib/shift-planning-historical-risk.js");
const {verifyShiftPlanningIntakeBarrierEvidence, verifyShiftPlanningAdministratorAgreementIntakeBarrierEvidence} = require("../lib/shift-planning-intake-barrier.js");
const {createShiftPlanningPublicEventRetentionPolicy,
  createShiftPlanningPublicEventOperationRetention,
  parseShiftPlanningPublicEventOperationRetention,
  shiftPlanningPublicEventOperationRetentionPath} = require("../lib/shift-planning-public-event-retention.js");

const PROJECT_ID = "demo-reguerta-hu084-migration";
const HOST = "127.0.0.1:8798";
const WORKBOOK_ID = "demo-hu084-migration-workbook";
const ROOT = "develop/plus-collections";
const CONTROL_PATHS = ["shiftPlanningState/current", "shiftPlanningState/sourcePolicy",
  "shiftRotations/delivery", "shiftRotations/market"].map((p) => `${ROOT}/${p}`);
const WORKBOOK_POINTER_PATH = `${ROOT}/shiftPlanningState/sheetsSubmission`;
const encode = (value) => encodeValue(value, "emulator migration", new Set());
const encodedDigest = (value) => digest(encode(value));
const same = (a, b) => assert.equal(encodedDigest(a), encodedDigest(b));
const fail = (message) => { throw new Error(`migration_rehearsal_rejected: ${message}`); };
const requireValue = (condition, message) => { if (!condition) fail(message); };
const id = (value) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const timestamp = (value) => {
  requireValue(typeof value === "string", "missing timestamp");
  const match = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,9}))?Z$/.exec(value);
  requireValue(match, "noncanonical timestamp");
  const seconds = Date.parse(`${match[1]}Z`) / 1000;
  requireValue(Number.isSafeInteger(seconds), "invalid timestamp seconds");
  return new Timestamp(seconds, Number((match[2] ?? "").padEnd(9, "0")));
};
const decodeRESTValue = (value) => {
  requireValue(value && typeof value === "object" && Object.keys(value).length === 1, "REST field shape");
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return timestamp(value.timestampValue);
  if ("integerValue" in value) {
    const number = Number(value.integerValue);
    requireValue(Number.isSafeInteger(number) && BigInt(number) === BigInt(value.integerValue), "lossy integer");
    return number;
  }
  if ("doubleValue" in value) { requireValue(Number.isFinite(value.doubleValue), "nonfinite double"); return value.doubleValue; }
  if ("bytesValue" in value) return Buffer.from(value.bytesValue, "base64");
  if ("geoPointValue" in value) return new GeoPoint(value.geoPointValue.latitude, value.geoPointValue.longitude);
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(decodeRESTValue);
  if ("mapValue" in value) return Object.fromEntries(Object.entries(value.mapValue.fields ?? {})
    .map(([key, item]) => [key, decodeRESTValue(item)]));
  return fail("unsupported lossless REST field");
};

const decodeRESTDocument = (document) => {
  const prefix = `projects/${PROJECT_ID}/databases/(default)/documents/`;
  requireValue(document?.name?.startsWith(prefix), "clone capture project required");
  const path = document.name.slice(prefix.length);
  requireValue(path.startsWith(`${ROOT}/shifts/`) && path.split("/").length === 4, "legacy path scope");
  const data = Object.fromEntries(Object.entries(document.fields ?? {}).map(([key, value]) => [key, decodeRESTValue(value)]));
  return {path, data, updateTime: timestamp(document.updateTime), createTime: timestamp(document.createTime)};
};

const guardDocument = (document, collection) => {
  const prefix = `projects/${PROJECT_ID}/databases/(default)/documents/${ROOT}/${collection}/`;
  requireValue(document?.name?.startsWith(prefix) && !document.name.slice(prefix.length).includes("/"), "guard collection scope");
  return {path: `${ROOT}/${collection}/${document.name.slice(prefix.length)}`,
    payload: encode(Object.fromEntries(Object.entries(document.fields ?? {}).map(([key, value]) => [key, decodeRESTValue(value)]))),
    updateTime: encode(timestamp(document.updateTime))};
};

const createLocalMigrationPolicyDraft = (contentProposal) => {
  requireValue(contentProposal?.environment === "develop" && contentProposal.liveExecutable === false, "content scope");
  const document = {schemaVersion: 1, environment: "develop", policyRevision: "hu084-clone-policy-v1",
    delivery: {continuity: {kind: "newRotation"}, inheritedTargetPrefix: null, futureProjectionOccupancy: []},
    market: {inheritedTargetPrefix: null, futureProjectionOccupancy: []}, releaseLeaseDurationMillis: 900_000,
    creditLedger: {enabled: false, revision: "clone-credits-disabled-v1", digest: digest("clone credits disabled"), plannedWriteCount: 0},
    sync: {leaseDurationMillis: 120_000, transactionMeasurementAuthority: {
      adapterRevision: SHIFT_PLANNING_FIRESTORE_ADMISSION_REVISION,
      indexConfigurationDigest: digest("synthetic emulator index authority, not deployed indexes")},
    partitions: Object.fromEntries(["delivery", "market"].map((type) => [type, {workbookId: WORKBOOK_ID,
      workbookRevision: "1", partitionKey: type, stateRevision: 1, epoch: 1, lease: null}]))}, transactionWriteLimit: 500};
  const localOnly = {scope: "loopback_emulator_only", liveExecutable: false, planningReady: false,
    template: "HU082 source-producer fixture shape only; continuity/prefix are not admitted annual planning inputs",
    workbookVersionAuthority: "stateful_fixture_counter_only", indexAuthority: "synthetic_fixture_only",
    horizon: "partial published set; July/August 2027 market dates remain missing"};
  return {document, localOnly, draftDigest: digest({document, localOnly})};
};

const checkContentPositions = (content) => {
  requireValue(content.shifts.every((shift) => ["delivery", "market"].includes(shift.type)), "content rotation type");
  for (const type of ["delivery", "market"]) {
    const rotation = content.rotations[type], width = type === "delivery" ? 1 : 3;
    const rows = content.shifts.filter((shift) => shift.type === type).sort((a, b) => compare(a.date, b.date));
    requireValue(rotation.publishedPositionCount === rows.length * width && rows.every((row) =>
      row.positions.length === width && row.rotationOwnerUserIds.length === width), "published position cardinality");
    const consumed = consumeRotationPositions(rotation.initialCursor, rotation.publishedPositionCount);
    requireValue(digest(consumed.nextRotation) === digest(rotation.postPublishedCursor), "published cursor sequence");
    requireValue(digest(rows.flatMap((row) => row.positions)) === digest(consumed.positions), "published rotation positions differ");
    requireValue(rows.every((row) => digest(row.rotationOwnerUserIds) ===
      digest(row.positions.map((position) => position.rotationOwnerUserId))), "published owner sequence differs");
  }
};

const prepareDevelopShiftMigration = ({contentProposal, legacyCapture, policyDraft, runId}) => {
  const proposal = structuredClone(contentProposal);
  const {proposalDigest, contentDigest, ...body} = proposal;
  requireValue(proposal.liveExecutable === false && proposal.environment === "develop" &&
    proposal.content.ownerProvenance === "declared_synthetic_develop_only", "synthetic develop content only");
  requireValue(digest(body) === proposalDigest && digest(proposal.content) === contentDigest, "content digest");
  requireValue(legacyCapture?.projectId === PROJECT_ID && legacyCapture.environment === "develop" &&
    legacyCapture.documents?.length === 62, "fresh clone capture required");
  const legacy = legacyCapture.documents.map(decodeRESTDocument).sort((a, b) => compare(a.path, b.path));
  requireValue(new Set(legacy.map((item) => item.path)).size === 62, "duplicate legacy path");
  requireValue(legacy.every((item) => item.data.source === "google_sheets" && item.data.status === "planned" &&
    item.data.planningSchemaVersion === undefined && item.data.lastBackendMutation === undefined), "legacy disposition changed");
  const draft = structuredClone(policyDraft ?? createLocalMigrationPolicyDraft(proposal));
  requireValue(draft.draftDigest === digest({document: draft.document, localOnly: draft.localOnly}) &&
    draft.localOnly.liveExecutable === false && draft.localOnly.planningReady === false &&
    draft.document.environment === "develop" && draft.document.creditLedger.enabled === false &&
    draft.document.coverage?.enabled !== true, "closed policy draft");
  if (draft.document.kind === CLOSED_POLICY) verifyClosedPolicy(draft);
  else requireValue(["delivery", "market"].every((type) => draft.document.sync.partitions[type].workbookId === WORKBOOK_ID &&
    draft.document.sync.partitions[type].workbookRevision === "1" && draft.document.sync.partitions[type].lease === null), "local workbook authority");
  const chosenRun = runId ?? `hu084-migration-${contentDigest.slice(-12)}`;
  requireValue(id(chosenRun), "run id");
  const source = legacy.map((item) => ({path: item.path, payload: encode(item.data),
    updateTime: encode(item.updateTime), createTime: encode(item.createTime)}));
  const guards = legacyCapture.guardCollections ?? null;
  const guardNames = draft.document.kind === CLOSED_POLICY ? ["users", "deliveryCalendar", "notificationEvents", "config"] : ["users", "deliveryCalendar"];
  requireValue(guards === null || Object.keys(guards).sort().join() === [...guardNames].sort().join(), "complete guard collection names");
  requireValue(draft.document.kind !== CLOSED_POLICY || guards !== null, "closed migration requires complete source guards");
  const guardCollections = guards === null ? null : Object.fromEntries(guardNames.map((collection) => {
    requireValue(Array.isArray(guards[collection]) && guards[collection].length <= 1000, "bounded guard documents");
    const documents = guards[collection].map((doc) => guardDocument(doc, collection)).sort((a, b) => compare(a.path, b.path));
    requireValue(new Set(documents.map((doc) => doc.path)).size === documents.length, "duplicate guard path");
    return [collection, documents];
  }));
  const value = {schemaVersion: 1, scope: "loopback_emulator_only", liveExecutable: false,
    projectId: PROJECT_ID, environment: "develop", contentDigest, proposalDigest,
    sourceDigest: digest(source), operationId: `request-${chosenRun}`, requestId: chosenRun,
    recoveryOperationId: `recover-${chosenRun}`, baselineRevision: `baseline-${chosenRun}`,
    legacy: source, guardCollections, content: proposal.content, policyDraft: draft};
  requireValue(id(value.operationId) && id(value.recoveryOperationId) && id(value.baselineRevision), "derived ids");
  requireValue(value.content.shifts.length === 72 && new Set(value.content.shifts.map((s) => s.id)).size === 72,
    "72 exact content rows required");
  requireValue(value.content.shifts.every((s) => !legacy.some((old) => old.path === `${ROOT}/shifts/${s.id}`)), "legacy/canonical ID collision");
  checkContentPositions(value.content);
  return {...value, preparedDigest: digest(value)};
};

const historicalMigrationPlanBindings = prepared => ({
  migrationPlanDigest: prepared.preparedDigest,
  inversePlanDigest: digest({kind: "initial-migration-inverse", preparedDigest: prepared.preparedDigest,
    recoveryOperationId: prepared.recoveryOperationId, baselineRevision: prepared.baselineRevision}),
});
const createDevelopShiftMigrationRehearsal = ({prepared: value, controlPlane, failurePersistence, nowMillis, historicalRiskMode = false}) => {
  requireValue(process.env.GCLOUD_PROJECT === PROJECT_ID && process.env.FIRESTORE_EMULATOR_HOST === HOST, "fixed demo emulator required");
  const prepared = structuredClone(value);
  const {preparedDigest, ...preparedBody} = prepared;
  requireValue(prepared.projectId === PROJECT_ID && prepared.environment === "develop" &&
    prepared.liveExecutable === false && digest(preparedBody) === preparedDigest, "prepared binding");
  checkContentPositions(prepared.content);
  const closedPolicy = prepared.policyDraft.document.kind === CLOSED_POLICY;
  if (closedPolicy) {
    verifyClosedPolicy(prepared.policyDraft);
    requireValue(historicalRiskMode, "closed migration requires the historical risk barrier");
  }
  const db = new Firestore({projectId: PROJECT_ID, host: HOST, ssl: false});
  requireValue(typeof historicalRiskMode === "boolean", "explicit historical risk mode");
  const barrier = historicalRiskMode ? createTrustedShiftPlanningAdministratorBarrierAdapter({
    controlPlane, failurePersistence, readClockMillis: nowMillis,
  }) : createTrustedShiftPlanningIntakeBarrierAdapter({controlPlane, failurePersistence});
  const operationPath = `${ROOT}/shiftPlanningOperations/${prepared.operationId}`;
  const baselinePath = `${ROOT}/shiftPlanningMigrationBaselines/${prepared.baselineRevision}`;
  const retentionPolicy = createShiftPlanningPublicEventRetentionPolicy({policyRevision: "hu084-clone-retention-v1",
    maximumDeliveryRetryHorizonMillis: 86_400_000, safetyMarginMillis: 3_600_000});
  const clock = () => { const ms = nowMillis(); requireValue(Number.isSafeInteger(ms) && ms >= 0, "clock"); return Timestamp.fromMillis(ms); };
  const ownPaths = [operationPath, baselinePath,
    shiftPlanningPublicEventOperationRetentionPath({environment: "develop", operationId: prepared.operationId}),
    shiftPlanningPublicEventOperationRetentionPath({environment: "develop", operationId: prepared.recoveryOperationId}),
    ...CONTROL_PATHS, WORKBOOK_POINTER_PATH];
  const expectedForwardPaths = [...prepared.legacy.flatMap((item, index) => [item.path,
    `${operationPath}/beforeImages/${index + 1}`]), ...prepared.content.shifts.map((item) => `${ROOT}/shifts/${item.id}`),
  ...CONTROL_PATHS, operationPath, ownPaths[2]].sort(compare);
  const capture = async (tx) => {
    const documents = new Map();
    for (const collection of ["shifts", "users", "deliveryCalendar", "shiftPlanningSyncCommands", "shiftCoverageEffects", "shiftSwapRequests",
      ...(historicalRiskMode ? ["notificationEvents"] : []),
      ...(closedPolicy ? ["config", "shiftPlanningRequests", "shiftCoverageReserves", "shiftCoverageCredits", "shiftMembershipState", "shiftCoverageCases"] : [])]) {
      const query = await tx.get(db.collection(`${ROOT}/${collection}`).orderBy("__name__").limit(1001));
      requireValue(query.size <= 1000, "bounded source");
      if (["shiftPlanningSyncCommands", "shiftCoverageEffects", "shiftSwapRequests", "shiftPlanningRequests",
        "shiftCoverageReserves", "shiftCoverageCredits", "shiftMembershipState", "shiftCoverageCases"].includes(collection)) {
        requireValue(query.empty, "runnable or retained workflow requires separate review");
      }
      for (const doc of query.docs) documents.set(doc.ref.path, doc);
    }
    const rows = await tx.getAll(...ownPaths.map((p) => db.doc(p)));
    rows.forEach((doc) => documents.set(doc.ref.path, doc));
    const snapshots = [...documents.values()].sort((a, b) => compare(a.ref.path, b.ref.path));
    const source = snapshots.map((doc) => ({path: doc.ref.path, payload: doc.exists ? encode(doc.data()) : null,
      updateTime: doc.updateTime ? encode(doc.updateTime) : null}));
    const current = documents.get(CONTROL_PATHS[0]);
    const state = current.exists ? parseShiftPlanningMaintenanceState(current.data()) : null;
    return {documents, sourceDigest: digest(source), maintenance: {exists: current.exists,
      stateRevision: state?.stateRevision ?? 0, writeEpoch: state?.writeEpoch ?? 0,
      activeRevision: state?.activeRevision ?? null, activeDigest: state?.activeDigest ?? null}};
  };
  // Risk evidence keeps its real develop identity. This fixed demo runner maps
  // that logical workbook to WORKBOOK_ID; no Google client or live port exists.
  const scopeCheck = (scope, source, inverse = false) => {
    requireValue(scope.environment === "develop" && scope.expectedWorkbookFileId === (historicalRiskMode ? DEVELOP_HISTORICAL_WORKBOOK : WORKBOOK_ID) &&
      scope.expectedWorkbookRevision === prepared.policyDraft.document.sync.partitions.delivery.workbookRevision &&
      scope.expectedWorkbookRevision === prepared.policyDraft.document.sync.partitions.market.workbookRevision &&
      scope.transitionId === (inverse ? prepared.recoveryOperationId : prepared.operationId) &&
      scope.expectedAuthoritativeDigest === source.sourceDigest &&
      scope.expectedStateRevision === source.maintenance.stateRevision && scope.expectedWriteEpoch === source.maintenance.writeEpoch &&
      scope.expectedActiveRevision === source.maintenance.activeRevision && scope.expectedActiveDigest === source.maintenance.activeDigest,
    "scope/source binding");
  };
  const verifyHeld = (evidence, scope) => {
    const bound = {...scope}; delete bound.writerInventoryRevision; delete bound.writerInventoryDigest;
    const verified = historicalRiskMode ? verifyShiftPlanningAdministratorAgreementIntakeBarrierEvidence(evidence, bound, clock().toMillis()) :
      verifyShiftPlanningIntakeBarrierEvidence(evidence, bound, clock().toMillis());
    if (historicalRiskMode) {
      const risk = verified.evidence.payload.causalDrain.historicalRisk, plans = historicalMigrationPlanBindings(prepared);
      requireValue(risk && risk.migrationOperationId === prepared.operationId && risk.recoveryOperationId === prepared.recoveryOperationId &&
        risk.migrationPlanDigest === plans.migrationPlanDigest && risk.inversePlanDigest === plans.inversePlanDigest,
      "accepted historical risk must bind this initial migration and inverse");
    }
    return verified;
  };
  const checkGuardsAndCohort = (source) => {
    for (const [collection, expected] of Object.entries(prepared.guardCollections ?? {})) {
      const actual = [...source.documents.values()].filter((doc) => doc.ref.path.startsWith(`${ROOT}/${collection}/`))
        .map((doc) => ({path: doc.ref.path, payload: encode(doc.data()), updateTime: encode(doc.updateTime)}))
        .sort((a, b) => compare(a.path, b.path));
      requireValue(digest(actual) === digest(expected), `${collection} source changed`);
    }
    const eligibleUserIds = [...source.documents.values()].filter((doc) => doc.ref.path.startsWith(`${ROOT}/users/`))
      .filter((doc) => {
        const member = doc.data();
        requireValue(typeof member.isActive === "boolean" && typeof member.isCommonPurchaseManager === "boolean" &&
          Array.isArray(member.roles) && member.roles.every((role) => typeof role === "string"), "canonical roster fields");
        return isEligibleForShiftRotation(member);
      }).map((doc) => doc.id);
    for (const type of ["delivery", "market"]) {
      const initial = prepared.content.rotations[type].initialCursor;
      const bootstrap = resolveShiftRotationBootstrap({type, eligibleUserIds,
      isTrulyNewRotation: true, approvedMapping: {revision: prepared.baselineRevision, digest: prepared.contentDigest,
        provenance: "declared_synthetic_develop_only", approvalStatus: "approved", type,
        orderedUserIds: initial.cohortUserIds, roundNumber: initial.roundNumber, nextMemberIndex: initial.nextMemberIndex,
        stableTieOrder: initial.cohortUserIds,
        evidence: "retained synthetic develop content; no historical ownership inferred"}});
      same(consumeRotationPositions(bootstrap.rotation, prepared.content.rotations[type].publishedPositionCount).nextRotation,
        prepared.content.rotations[type].postPublishedCursor);
    }
  };
  const descriptors = (mutations, replacement = {}) => mutations.map((mutation) => ({path: mutation.documentPath,
    payloadDigest: mutation.kind === "delete" ? null : encodedDigest(replacement[mutation.documentPath] ?? mutation.data)}))
    .sort((a, b) => compare(a.path, b.path));
  const baselineValue = (snapshot) => {
    requireValue(snapshot.exists && snapshot.createTime.isEqual(snapshot.updateTime), "immutable baseline changed");
    const value = snapshot.data(), {baselineDigest, ...body} = value;
    requireValue(body.schemaVersion === 1 && body.recordKind === "emulatorDevelopMigrationBaseline" &&
      body.preparedDigest === preparedDigest && body.contentDigest === prepared.contentDigest &&
      body.sourceDigest === prepared.sourceDigest && digest(body) === baselineDigest &&
      Array.isArray(body.expectedForward) && digest(body.expectedForward.map((item) => item.path)) === digest(expectedForwardPaths), "baseline proof");
    return value;
  };
  const forwardDescriptors = (baseline) => [...baseline.expectedForward,
    {path: baselinePath, payloadDigest: encodedDigest(baseline)}].sort((a, b) => compare(a.path, b.path));
  const readExpected = async (tx, expected, committedAt) => {
    requireValue(new Set(expected.map((item) => item.path)).size === expected.length, "unique expected targets");
    const documents = await tx.getAll(...expected.map((item) => db.doc(item.path)));
    return documents.map((doc, index) => {
      const target = expected[index];
      requireValue(doc.exists === (target.payloadDigest !== null), "afterimage existence changed");
      if (doc.exists) {
        requireValue(doc.updateTime.isEqual(committedAt), "afterimage commit version changed");
        requireValue(encodedDigest(doc.data()) === target.payloadDigest, "afterimage payload changed");
      }
      return {path: doc.ref.path, exists: doc.exists, payload: doc.exists ? encode(doc.data()) : null,
        updateTime: doc.updateTime ? encode(doc.updateTime) : null};
    });
  };
  const snapshotReceipt = async (direction, expected, measurement, operation, replayed = false) => {
    const documents = await db.runTransaction(async (tx) => {
      const op = await tx.get(db.doc(operationPath));
      requireValue(op.exists && encodedDigest(op.data()) === encodedDigest(operation), "terminal changed before read-back");
      return readExpected(tx, expected, op.updateTime);
    }, {readOnly: true});
    const body = {schemaVersion: 1, scope: "loopback_emulator_only", projectId: PROJECT_ID,
      preparedDigest, direction, replayed, documents, measurement, operation: encode(operation)};
    return {...body, receiptDigest: digest(body)};
  };
  const checkReadBack = async (tx, receipt, baselineSnapshot) => {
    const {receiptDigest, ...body} = receipt;
    requireValue(body.preparedDigest === preparedDigest && body.projectId === PROJECT_ID &&
      body.direction === "forward" && digest(body) === receiptDigest, "forward read-back receipt");
    const baseline = baselineValue(baselineSnapshot);
    const actual = await readExpected(tx, forwardDescriptors(baseline), baselineSnapshot.createTime);
    requireValue(digest(actual) === digest(body.documents), "read-back differs from immutable manifest");
    const terminal = actual.find((item) => item.path === operationPath);
    requireValue(digest(terminal.payload) === digest(body.operation), "receipt terminal differs from manifest");
  };
  const inverseDigest = (scope, receipt) => {
    const {receiptDigest, ...body} = receipt;
    requireValue(body.preparedDigest === preparedDigest && body.direction === "forward" && digest(body) === receiptDigest,
      "inverse replay receipt binding");
    return digest({preparedDigest, forwardReceiptDigest: receiptDigest, scopeDigest: digest(scope), direction: "inverse"});
  };
  const retained = async (scope, inverse = false, receipt = null) => db.runTransaction(async (tx) => {
    const [op, baselineSnapshot, forwardRetention, inverseRetention] = await tx.getAll(db.doc(operationPath), db.doc(baselinePath),
      db.doc(ownPaths[2]), db.doc(ownPaths[3]));
    if (!op.exists) return null;
    const baseline = baselineValue(baselineSnapshot);
    const recovery = op.data().operationKind === "activationRecovery" ? parseShiftPlanningRecoveryOperationTerminal(op.data()) : null;
    const activation = recovery?.activationTerminal ?? parseShiftPlanningActivationOperationTerminal(op.data());
    requireValue(activation.operationId === prepared.operationId && activation.bundleRevision === prepared.baselineRevision &&
      activation.bundleDigest === prepared.contentDigest && activation.forwardManifestDigest === preparedDigest &&
      activation.environment === "develop" && activation.requestId === prepared.requestId &&
      baseline.expectedForward.find((item) => item.path === operationPath)?.payloadDigest === encodedDigest(activation), "retained activation binding");
    const retention = parseShiftPlanningPublicEventOperationRetention(forwardRetention.data());
    requireValue(retention.operationId === prepared.operationId && retention.operationIntentDigest === activation.operationIntentDigest &&
      retention.environment === "develop" && retention.controlledOperationKind === "activation" &&
      retention.terminalAt.isEqual(activation.attemptedAt) && forwardRetention.createTime.isEqual(baselineSnapshot.createTime) &&
      forwardRetention.updateTime.isEqual(forwardRetention.createTime) && op.createTime.isEqual(baselineSnapshot.createTime), "retained activation proof");
    if (recovery) {
      const kept = parseShiftPlanningPublicEventOperationRetention(inverseRetention.data());
      requireValue(recovery.recoveryOperationId === prepared.recoveryOperationId && kept.operationId === prepared.recoveryOperationId &&
        kept.operationIntentDigest === recovery.recoveryIntentDigest && kept.environment === "develop" && kept.controlledOperationKind === "recovery" &&
        kept.terminalAt.isEqual(recovery.recoveredAt) &&
        inverseRetention.createTime.isEqual(inverseRetention.updateTime) && inverseRetention.updateTime.isEqual(op.updateTime), "retained recovery proof");
    }
    if (inverse && !recovery) return null;
    if (inverse) requireValue(recovery.inverseManifestDigest === inverseDigest(scope, receipt), "inverse replay intent changed");
    if (!inverse) requireValue(baseline.scopeDigest === digest(scope), "replay scope changed");
    return {operation: recovery ?? activation, baseline};
  });
  const requireNoFailure = async (transitionId) => requireValue(await failurePersistence.readExistingFailure({environment: "develop", transitionId}) === null,
    "retained barrier failure requires governed inspection");
  const runHeld = async (scope, callback) => barrier.withClosedIntakeBarrier(scope, async (evidence) => {
    verifyHeld(evidence, scope);
    return callback(evidence);
  });
  const finalTimestamp = (finalManifest) => {
    if (!finalManifest) return clock();
    const {finalDigest, ...body} = finalManifest;
    requireValue(digest(body) === finalDigest && body.preparedDigest === preparedDigest, "final manifest identity");
    const value = decodeShiftPlanningFirestoreValue(body.attemptedAt), age = clock().toMillis() - value.toMillis();
    requireValue(age >= 0 && age <= 60_000, "final manifest expired or future dated");
    return value;
  };
  const finalize = (direction, scope, mutations, manifestDigest, attemptedAt) => {
    const transaction = prepareShiftPlanningFirestoreTransaction({direction, manifestDigest, mutations,
      expectedDocumentWriteCount:mutations.length, authority:prepared.policyDraft.document.sync.transactionMeasurementAuthority, writeLimit:500});
    const body = {schemaVersion:1,scope:"loopback_emulator_only",projectId:PROJECT_ID,liveExecutable:false,
      preparedDigest,direction,scopeDigest:digest(scope),attemptedAt:encode(attemptedAt),transaction};
    return {...body,finalDigest:digest(body)};
  };
  return {
    close: () => db.terminate(),
    retentionPolicy,
    async inspect() { const source = await db.runTransaction(capture); return {sourceDigest: source.sourceDigest, maintenance: source.maintenance}; },
    async forward({scope, materializeOnly = false, finalManifest = null}) {
      requireValue(typeof materializeOnly === "boolean" && !(materializeOnly && finalManifest), "materialization options");
      await requireNoFailure(prepared.operationId);
      const replay = await retained(scope);
      if (replay) {
        requireValue(!materializeOnly && !finalManifest, "use retained receipt after commit, not a new manifest");
        if (replay.operation.operationKind === "activationRecovery") return {replayed: true, direction: "forward", recovered: true, operation: encode(replay.operation)};
        return snapshotReceipt("forward", forwardDescriptors(replay.baseline), null, replay.operation, true);
      }
      requireValue(!closedPolicy || materializeOnly || finalManifest, "closed migration requires a final manifest");
      return runHeld(scope, async (evidence) => {
        const result = await db.runTransaction(async (tx) => {
        const source = await capture(tx);
        scopeCheck(scope, source);
        checkGuardsAndCohort(source);
        requireValue(!source.documents.get(WORKBOOK_POINTER_PATH).exists, "workbook submission pointer must be absent");
        requireValue(CONTROL_PATHS.every((p) => !source.documents.get(p).exists), "control documents must be absent");
        requireValue(!source.documents.get(operationPath).exists && !source.documents.get(baselinePath).exists, "initialization already exists");
        const publicRows = [...source.documents.values()].filter((doc) => doc.ref.path.startsWith(`${ROOT}/shifts/`));
        requireValue(publicRows.length === prepared.legacy.length, "public source cardinality");
        for (const before of prepared.legacy) {
          const actual = source.documents.get(before.path);
          requireValue(actual?.exists && actual.updateTime.isEqual(decodeShiftPlanningFirestoreValue(before.updateTime)), "legacy source version changed");
          requireValue(digest(encode(actual.data())) === digest(before.payload), "legacy source payload changed");
        }
        const attemptedAt = finalTimestamp(finalManifest);
        const verified = verifyHeld(evidence, scope);
        const archives = prepared.legacy.map((before, index) => createShiftPlanningBeforeImageEnvelope({
          operationId: prepared.operationId, environment: "develop", bundleRevision: prepared.baselineRevision,
          bundleDigest: prepared.contentDigest, forwardManifestDigest: preparedDigest, writeEpoch: 1,
          ordinal: index + 1, targetPath: before.path, targetUpdateTime: decodeShiftPlanningFirestoreValue(before.updateTime),
          captureContractDigest: prepared.sourceDigest, document: decode(before.payload)}));
        const materializations = prepared.content.shifts.map((shift) => {
          requireValue(shift.completion.state === "uncompleted" && shift.completion.actualHelperUserId === null &&
            shift.completion.helperSourceAssignmentRevision === null && shift.completion.completedAt === null, "no inferred completion");
          const delivery = shift.type === "delivery", first = shift.positions[0];
          const payload = {planningSchemaVersion: 1, type: shift.type, date: Timestamp.fromDate(new Date(`${shift.date}T00:00:00Z`)),
            assignedUserIds: shift.assignedUserIds, helperUserId: shift.helperUserId, status: shift.status, source: "app", origin: "planner",
            planningRequestId: prepared.requestId, bundleRevision: prepared.baselineRevision, bundleDigest: prepared.contentDigest, writeEpoch: 1,
            projectionSeasonStartYear: Number(shift.date.slice(0, 4)) - Number(Number(shift.date.slice(5, 7)) < 9),
            rotationOwnerUserId: delivery ? shift.rotationOwnerUserIds[0] : null, rotationOwnerUserIds: delivery ? null : shift.rotationOwnerUserIds,
            roundNumber: delivery ? first.roundNumber : null, positionInRound: delivery ? first.positionInRound : null,
            planningReason: delivery ? "target" : null, rotationPositions: delivery ? null : shift.positions.map((position, index) =>
              ({...position, effectiveAssigneeUserId: shift.assignedUserIds[index], planningReason: "target"})),
            assignmentRevision: 1, documentRevision: 1, completion: {state: "uncompleted", revision: 0,
              actualHelperUserId: null, helperSourceAssignmentRevision: null, completedAt: null}, createdAt: attemptedAt, updatedAt: attemptedAt};
          return createShiftPlanningPublicShiftMaterialization({targetPath: `${ROOT}/shifts/${shift.id}`, payload});
        });
        const operation = createShiftPlanningActivationOperationTerminal({operationId: prepared.operationId, environment: "develop",
          requestId: prepared.requestId, candidateId: prepared.baselineRevision, bundleRevision: prepared.baselineRevision,
          bundleDigest: prepared.contentDigest, forwardManifestDigest: preparedDigest, expectedStateDigest: source.sourceDigest,
          writeEpoch: 1, attemptedAt, publicMutations: materializations.map((m) => ({mutationKind: "create", targetPath: m.targetPath,
            documentRevision: m.documentRevision, payloadDigest: m.payloadDigest})), beforeImages: archives.map((a) =>
            ({ordinal: a.ordinal, targetPath: a.targetPath, envelopePath: a.envelopePath, envelopeDigest: a.envelopeDigest}))});
        const canonical = materializations.map((m) => ({path: m.targetPath, data: attachShiftPlanningBackendMutationMarker({materialization: m, operation})}));
        canonical.forEach((item) => parseShiftPlanningPublicShiftDocument({targetPath: item.path, value: item.data}));
        const baselineCore = {schemaVersion: 1, recordKind: "emulatorDevelopMigrationBaseline", preparedDigest,
          contentDigest: prepared.contentDigest, sourceDigest: prepared.sourceDigest, scopeDigest: digest(scope),
          ownerProvenance: "declared_synthetic_develop_only", localOnly: prepared.policyDraft.localOnly,
          partialMarketHorizon: {published2026: 10, missingMonths: ["2027-07", "2027-08"]},
          sourceControlAbsence: CONTROL_PATHS, originalRawLegacy: prepared.legacy.map((item) => ({path: item.path, payloadDigest: digest(item.payload)}))};
        const current = {schemaVersion: 1, stateRevision: 1, writeEpoch: 1, maintenanceStatus: "closed",
          activeRevision: prepared.baselineRevision, activeDigest: prepared.contentDigest, intakeBarrier: verified.barrier,
          lastTransitionId: prepared.operationId};
        // Rotation baseline binds the retained proposal; baseline's own digest
        // additionally covers the concrete admission afterimages below.
        const lineageDigest = digest(baselineCore);
        const rotations = Object.fromEntries(["delivery", "market"].map((type) => {
          const cursor = prepared.content.rotations[type].postPublishedCursor;
          return [type, {schemaVersion: 1, type, stateRevision: 1, cursor, planningFrontierSeasonStartYear: 2025,
            cohortFrozen: true, frozenCohortUserIds: cursor.cohortUserIds, activeRevision: prepared.baselineRevision,
            activeDigest: prepared.contentDigest, lastIdempotencyKey: null,
            migrationBaseline: {revision: prepared.baselineRevision, digest: lineageDigest}, releaseLease: null}];
        }));
        buildShiftPlanningAuthoritativeState({environment: "develop", maintenance: current, rotations});
        const retention = createShiftPlanningPublicEventOperationRetention({environment: "develop", controlledOperationKind: "activation",
          operationId: prepared.operationId, operationIntentDigest: operation.operationIntentDigest, terminalAt: attemptedAt, policy: retentionPolicy});
        const mutations = [...archives.map((a) => ({kind: "create", documentPath: a.envelopePath, data: a})),
          ...prepared.legacy.map((item) => ({kind: "delete", documentPath: item.path,
            precondition: {lastUpdateTime: decodeShiftPlanningFirestoreValue(item.updateTime)}})),
          ...canonical.map((item) => ({kind: "create", documentPath: item.path, data: item.data})),
          {kind: "create", documentPath: CONTROL_PATHS[0], data: current},
          {kind: "create", documentPath: CONTROL_PATHS[1], data: prepared.policyDraft.document},
          ...["delivery", "market"].map((type) => ({kind: "create", documentPath: `${ROOT}/shiftRotations/${type}`, data: rotations[type]})),
          {kind: "create", documentPath: operationPath, data: operation},
          {kind: "create", documentPath: shiftPlanningPublicEventOperationRetentionPath({environment: "develop", operationId: prepared.operationId}), data: retention}];
        baselineCore.expectedForward = descriptors(mutations);
        const baseline = {...baselineCore, baselineDigest: digest(baselineCore)};
        mutations.push({kind: "create", documentPath: baselinePath, data: baseline});
        const finalized = finalize("forward", scope, mutations, preparedDigest, attemptedAt);
        if (materializeOnly) return {finalized};
        if (finalManifest) same(finalized, finalManifest);
        const measurement = await applyShiftPlanningFirestoreTransactionAttempt({firestore: db, transaction: tx, direction: "forward",
          manifestDigest: preparedDigest, mutations, expectedDocumentWriteCount: mutations.length, writerFenceCheckedAt: clock(),
          authority: prepared.policyDraft.document.sync.transactionMeasurementAuthority, writeLimit: 500});
        return {measurement, operation, expected: descriptors(mutations)};
        });
        if (materializeOnly) return result.finalized;
        return snapshotReceipt("forward", result.expected, result.measurement, result.operation);
      });
    },
    async inverse({scope, forwardReadBack, materializeOnly = false, finalManifest = null}) {
      requireValue(typeof materializeOnly === "boolean" && !(materializeOnly && finalManifest), "materialization options");
      await requireNoFailure(prepared.recoveryOperationId);
      const replay = await retained(scope, true, forwardReadBack);
      if (replay) {
        requireValue(!materializeOnly && !finalManifest, "use retained recovery after commit, not a new manifest");
        return {replayed: true, direction: "inverse", historical: true, readBackVerified: false, operation: encode(replay.operation)};
      }
      requireValue(!closedPolicy || materializeOnly || finalManifest, "closed recovery requires a final manifest");
      return runHeld(scope, async (evidence) => {
        const result = await db.runTransaction(async (tx) => {
        const source = await capture(tx); scopeCheck(scope, source, true);
        if (closedPolicy) checkGuardsAndCohort(source);
        requireValue(!source.documents.get(WORKBOOK_POINTER_PATH).exists, "workbook submission pointer must be absent before inverse");
        const canonicalPaths = prepared.content.shifts.map((item) => `${ROOT}/shifts/${item.id}`).sort(compare);
        const actualPaths = [...source.documents.values()].filter((doc) => doc.ref.path.startsWith(`${ROOT}/shifts/`))
          .map((doc) => doc.ref.path).sort(compare);
        requireValue(digest(actualPaths) === digest(canonicalPaths), "public namespace changed before inverse");
        await checkReadBack(tx, forwardReadBack, source.documents.get(baselinePath));
        const activation = parseShiftPlanningActivationOperationTerminal(decode(forwardReadBack.operation));
        requireValue(activation.operationId === prepared.operationId, "activation identity");
        const recoveredAt = finalTimestamp(finalManifest); verifyHeld(evidence, scope);
        const deletedPaths = prepared.content.shifts.map((s) => `${ROOT}/shifts/${s.id}`).sort(compare);
        const inverseManifestDigest = inverseDigest(scope, forwardReadBack);
        const recoveryCore = {schemaVersion: 2, operationKind: "activationRecovery", state: "committed",
          operationId: prepared.operationId, recoveryOperationId: prepared.recoveryOperationId, environment: "develop", requestId: prepared.requestId,
          bundleRevision: activation.bundleRevision, bundleDigest: activation.bundleDigest, forwardManifestDigest: preparedDigest,
          inverseManifestDigest, activationOperationIntentDigest: activation.operationIntentDigest, activationTerminal: activation,
          expectedStateDigest: activation.expectedStateDigest, activationWriteEpoch: 1, recoveryWriteEpoch: 2, recoveredAt,
          restoreActiveLineage: {revision: null, digest: null}, deletedPaths, restoredBeforeImages: activation.beforeImages};
        const recoveryDigestCore = {...recoveryCore, activationTerminal: {...activation,
          attemptedAt: {seconds: activation.attemptedAt.seconds, nanoseconds: activation.attemptedAt.nanoseconds}},
        recoveredAt: {seconds: recoveredAt.seconds, nanoseconds: recoveredAt.nanoseconds}};
        const recovery = parseShiftPlanningRecoveryOperationTerminal({...recoveryCore, recoveryIntentDigest: digest(recoveryDigestCore)});
        const currentBefore = source.documents.get(CONTROL_PATHS[0]).data();
        requireValue(currentBefore.maintenanceStatus === "closed" && currentBefore.writeEpoch === 1, "forward authority changed");
        const current = {...currentBefore, stateRevision: currentBefore.stateRevision + 1, writeEpoch: 2,
          activeRevision: null, activeDigest: null, lastTransitionId: prepared.recoveryOperationId};
        parseShiftPlanningMaintenanceState(current);
        const retention = createShiftPlanningPublicEventOperationRetention({environment: "develop", controlledOperationKind: "recovery",
          operationId: prepared.recoveryOperationId, operationIntentDigest: recovery.recoveryIntentDigest, terminalAt: recoveredAt, policy: retentionPolicy});
        const mutations = [...deletedPaths.map((p) => ({kind: "delete", documentPath: p,
          precondition: {lastUpdateTime: source.documents.get(p).updateTime}})),
        ...prepared.legacy.map((item) => ({kind: "create", documentPath: item.path, data: decode(item.payload)})),
        ...CONTROL_PATHS.slice(1).map((p) => ({kind: "delete", documentPath: p,
          precondition: {lastUpdateTime: source.documents.get(p).updateTime}})),
        {kind: "update", documentPath: CONTROL_PATHS[0], data: current,
          precondition: {lastUpdateTime: source.documents.get(CONTROL_PATHS[0]).updateTime}},
        {kind: "update", documentPath: operationPath, data: buildShiftPlanningExactReplacementData({desired: recovery, current: source.documents.get(operationPath).data()}),
          precondition: {lastUpdateTime: source.documents.get(operationPath).updateTime}},
        {kind: "create", documentPath: shiftPlanningPublicEventOperationRetentionPath({environment: "develop", operationId: prepared.recoveryOperationId}), data: retention}];
        const finalized = finalize("inverse", scope, mutations, inverseManifestDigest, recoveredAt);
        if (materializeOnly) return {finalized};
        if (finalManifest) same(finalized, finalManifest);
        const measurement = await applyShiftPlanningFirestoreTransactionAttempt({firestore: db, transaction: tx, direction: "inverse",
          manifestDigest: inverseManifestDigest, mutations, expectedDocumentWriteCount: mutations.length, writerFenceCheckedAt: clock(),
          authority: prepared.policyDraft.document.sync.transactionMeasurementAuthority, writeLimit: 500});
        return {measurement, operation: recovery, expected: descriptors(mutations, {[operationPath]: recovery})};
        });
        if (materializeOnly) return result.finalized;
        return snapshotReceipt("inverse", result.expected, result.measurement, result.operation);
      });
    },
  };
};

module.exports = {PROJECT_ID, HOST, WORKBOOK_ID, checkContentPositions, decodeRESTValue, decodeRESTDocument, createLocalMigrationPolicyDraft,
  prepareDevelopShiftMigration, createDevelopShiftMigrationRehearsal, historicalMigrationPlanBindings};
if (require.main === module) fail("import explicitly from the isolated emulator harness; there is no live CLI");
