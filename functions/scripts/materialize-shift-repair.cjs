"use strict";

// Offline compiler only. Encoded writes are review templates, never SDK calls.
const {Timestamp} = require("@google-cloud/firestore");
const {planShiftRepair} = require("./repair-planned-shifts.cjs");
const {resolveShiftRotationBootstrap} = require("../lib/shift-rotation-bootstrap.js");
const {buildShiftPlanningAuthoritativeState} = require("../lib/shift-planning-state-persistence.js");
const {MAX_BYTES} = require("./audit-shift-planning.cjs");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {encodeShiftPlanningFirestoreValue, decodeShiftPlanningFirestoreValue, decodeShiftPlanningFirestoreDocument,
  createShiftPlanningPublicShiftMaterialization} = require("../lib/shift-planning-publication-contract.js");
const {createShiftPlanningControlledMutationOperationTerminal, attachShiftPlanningControlledMutationMarker} =
  require("../lib/shift-planning-public-event-contract.js");
const {createShiftPlanningPublicEventOperationRetention, shiftPlanningPublicEventOperationRetentionPath,
  produceShiftPlanningPublicEventAudit} = require("../lib/shift-planning-public-event-retention.js");
const encode = (value) => encodeShiftPlanningFirestoreValue(value, "repair materialization", new Set());
const same = (a, b) => digest(a) === digest(b);
const check = (condition) => { if (!condition) throw new Error("repair_materialization_rejected"); };
const keys = (value, fields) => value && typeof value === "object" && !Array.isArray(value) &&
  same(Object.keys(value).sort(), [...fields].sort());
const positions = (snapshot, row) => snapshot.lineage[row.type].rows.find((item) => item.shiftId === row.id)?.positions ?? null;
const mutableFields = new Set(["planningSchemaVersion", "assignedUserIds", "helperUserId", "status", "source", "origin",
  "bundleRevision", "bundleDigest", "writeEpoch", "rotationOwnerUserId", "rotationOwnerUserIds", "roundNumber",
  "positionInRound", "rotationPositions", "assignmentRevision", "documentRevision", "updatedAt", "lastBackendMutation"]);
const mutablePositionFields = new Set(["rotationOwnerUserId", "effectiveAssigneeUserId", "roundNumber", "positionInRound"]);

// Recompute the parent review instead of trusting a digest on a caller-supplied plan.
const materializeShiftRepair = async (options) => {
  const captured = structuredClone(options);
  const {materialization: packet, expectedMaterializationDigest, baselineRevision, expectedMaterializedPlanDigest, authorityCapture, expectedAuthorityCaptureDigest, ...reviewOptions} = captured;
  check((authorityCapture === undefined) === (expectedAuthorityCaptureDigest === undefined));
  check(authorityCapture === undefined || baselineRevision !== undefined);
  check((baselineRevision === undefined) === (expectedMaterializedPlanDigest === undefined));
  check(packet && Buffer.byteLength(JSON.stringify(packet)) <= MAX_BYTES && digest(packet) === expectedMaterializationDigest);
  const review = await planShiftRepair(reviewOptions), {input, proposal} = reviewOptions;
  check(review.schemaVersion === 2 && review.target.environment === "develop");
  check(keys(packet, ["schemaVersion", "target", "repairPlanDigest", "operationId", "preparedAt", "authority", "retentionPolicy", "writes"]) &&
    packet.schemaVersion === 1 && same(packet.target, review.target) && packet.repairPlanDigest === review.planDigest && Array.isArray(packet.writes));
  check(keys(packet.authority, ["bundleRevision", "bundleDigest", "writeEpoch"]));
  const preparedAt = decodeShiftPlanningFirestoreValue(packet.preparedAt);
  check(preparedAt instanceof Timestamp && same(encode(preparedAt), packet.preparedAt) &&
    preparedAt.toMillis() >= Date.parse(input.capturedAt));
  const root = `${review.target.environment}/plus-collections`;
  const before = new Map(input.source.map((entry) => [entry.row.id, entry]));
  const originals = new Map(review.firestoreEvidence.documents.map((entry) => [entry.targetPath, entry]));
  const changes = new Map(proposal.source.filter((entry) => !before.has(entry.row.id) ||
    !same(entry, before.get(entry.row.id)) || !same(positions(input, entry.row), positions(proposal, entry.row)))
    .map((entry) => [`${root}/shifts/${entry.row.id}`, entry]));
  // A Sheets-only/cursor-only diff needs no fabricated public repair operation.
  check(changes.size > 0 && packet.writes.length === changes.size && packet.writes.length <= 498);
  const seen = new Set(), materializations = [];
  for (const write of packet.writes) {
    check(keys(write, ["targetPath", "payload"]) && changes.has(write.targetPath) && !seen.has(write.targetPath)); seen.add(write.targetPath);
    const next = changes.get(write.targetPath), row = next.row, previous = originals.get(write.targetPath);
    const payload = decodeShiftPlanningFirestoreDocument(write.payload);
    check(same(encode(payload), write.payload));
    const materialization = createShiftPlanningPublicShiftMaterialization({targetPath: write.targetPath, payload});
    const projection = {id: row.id, type: payload.type, date: payload.date.toDate().toISOString().slice(0, 10),
      rotationOwnerUserIds: payload.type === "delivery" ? [payload.rotationOwnerUserId] : payload.rotationOwnerUserIds,
      assignedUserIds: payload.assignedUserIds, helperUserId: payload.helperUserId, status: payload.status, source: payload.source, origin: payload.origin};
    const finalPositions = payload.type === "delivery" ? [{roundNumber: payload.roundNumber, positionInRound: payload.positionInRound}] :
      payload.rotationPositions.map(({roundNumber, positionInRound}) => ({roundNumber, positionInRound}));
    check(same(projection, row) && same(finalPositions, positions(proposal, row)) && !next.completed &&
      same(encode(payload.updatedAt), packet.preparedAt));
    for (const [field, value] of Object.entries(packet.authority)) check(same(payload[field], value));
    if (previous) {
      const old = decodeShiftPlanningFirestoreDocument(previous.payload);
      const assignmentChanged = !same(old.assignedUserIds, payload.assignedUserIds) || old.helperUserId !== payload.helperUserId;
      check(payload.documentRevision === old.documentRevision + 1 &&
        payload.assignmentRevision === old.assignmentRevision + Number(assignmentChanged) &&
        old.updatedAt instanceof Timestamp && old.updatedAt.valueOf() <= preparedAt.valueOf());
      // All original fields outside the reviewed edit survive exactly. The upstream
      // exact-field parser deliberately rejects extra fields instead of dropping them.
      for (const [field, value] of Object.entries(old)) {
        if (!mutableFields.has(field)) check(Object.hasOwn(payload, field) && same(encode(payload[field]), encode(value)));
      }
      if (old.rotationPositions) old.rotationPositions.forEach((position, index) => {
        for (const [field, value] of Object.entries(position)) {
          if (!mutablePositionFields.has(field)) check(Object.hasOwn(payload.rotationPositions[index], field) &&
            same(encode(payload.rotationPositions[index][field]), encode(value)));
        }
      });
    } else check(payload.documentRevision === 1 && payload.assignmentRevision === 1 && payload.completion.state === "uncompleted" &&
      same(encode(payload.createdAt), packet.preparedAt));
    materializations.push({materialization, previous});
  }
  materializations.sort((a, b) => a.materialization.targetPath.localeCompare(b.materialization.targetPath));
  const operation = createShiftPlanningControlledMutationOperationTerminal({kind: "repair", operationId: packet.operationId,
    environment: review.target.environment, ...packet.authority, committedAt: preparedAt,
    publicMutations: materializations.map(({materialization: item, previous}) => ({mutationKind: previous ? "update" : "create",
      targetPath: item.targetPath, documentRevision: item.documentRevision, payloadDigest: item.payloadDigest}))});
  const retention = createShiftPlanningPublicEventOperationRetention({environment: review.target.environment, controlledOperationKind: "repair",
    operationId: operation.operationId, operationIntentDigest: operation.operationIntentDigest, terminalAt: preparedAt, policy: packet.retentionPolicy});
  const eventRehearsal = [], writes = materializations.map(({materialization, previous}) => {
    const after = attachShiftPlanningControlledMutationMarker({materialization, operation});
    const event = produceShiftPlanningPublicEventAudit({eventId: `repair-review-${packet.operationId}`, eventTime: preparedAt,
      targetPath: materialization.targetPath, before: previous ? decodeShiftPlanningFirestoreDocument(previous.payload) : null,
      after, operation, retention, policy: packet.retentionPolicy});
    check(event.kind === "controlledNoOp" && event.legacySideEffectsAllowed === false);
    eventRehearsal.push({targetPath: materialization.targetPath, outcome: event.kind, eventDigest: event.ledger.eventDigest,
      legacySideEffectsAllowed: event.legacySideEffectsAllowed});
    return {targetPath: materialization.targetPath, mutationKind: previous ? "update" : "create", payload: encode(after)};
  });
  const terminalPath = `${root}/shiftPlanningOperations/${operation.operationId}`;
  const retentionPath = shiftPlanningPublicEventOperationRetentionPath({environment: review.target.environment, operationId: operation.operationId});
  writes.push({targetPath: terminalPath, mutationKind: "create", payload: encode(operation)},
    {targetPath: retentionPath, mutationKind: "create", payload: encode(retention)});
  const readGuards = [...review.firestoreEvidence.documents.map((entry) => ({targetPath: entry.targetPath, exists: true,
    updateTime: entry.updateTime, payloadDigest: entry.payloadDigest})),
  ...[...review.firestoreEvidence.absentPaths, terminalPath, retentionPath].map((targetPath) => ({targetPath, exists: false}))]
    .sort((a, b) => a.targetPath.localeCompare(b.targetPath));
  const {planDigest: parentPlanDigest, ...body} = review;
  const result = {...body, schemaVersion: 3, scope: "firestore_materialization_review", parentPlanDigest,
    materializationEvidence: {packetDigest: expectedMaterializationDigest, atomicGroup: {readGuards, writes}, eventRehearsal},
    pendingGates: [...body.pendingGates.filter((gate) => gate !== "full_document_atomic_cas_and_provenance"),
      "live_authority_binding_and_atomic_cas_execution", "isolated_forward_inverse_commit_rehearsal"]};
  const materialized = {...result, planDigest: digest(result)};
  if (baselineRevision === undefined) return materialized;
  const recovery = recoveryReview({materialized, input, proposal, baselineRevision, expectedMaterializedPlanDigest});
  return authorityCapture === undefined ? recovery : attachAuthority({recovery, input, packet, authorityCapture, expectedAuthorityCaptureDigest});
};

// Payload restoration is a clone rehearsal. Service update times cannot be restored,
// and live repair recovery still needs its own retained event authority and fence.
const recoveryReview = ({materialized, input, proposal, baselineRevision, expectedMaterializedPlanDigest}) => {
  check(typeof baselineRevision === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(baselineRevision) &&
    materialized.planDigest === expectedMaterializedPlanDigest);
  const group = materialized.materializationEvidence.atomicGroup;
  const originals = new Map(materialized.firestoreEvidence.documents.map((entry) => [entry.targetPath, entry.payload]));
  const finalShifts = new Map(originals);
  for (const write of group.writes) if (write.targetPath.split("/")[2] === "shifts") finalShifts.set(write.targetPath, write.payload);
  const inventory = (documents) => [...documents].sort(([a], [b]) => a.localeCompare(b))
    .map(([targetPath, payload]) => ({targetPath, payloadDigest: digest(payload)}));
  const rotations = Object.fromEntries(["delivery", "market"].map((type) => {
    const lineage = proposal.lineage[type];
    return [type, {beforeDate: lineage.beforeDate, bootstrapInput: lineage.bootstrap,
      resolvedBootstrap: resolveShiftRotationBootstrap(lineage.bootstrap),
      rows: [...lineage.rows].sort((a, b) => a.shiftId.localeCompare(b.shiftId)), rotationAfterHorizon: lineage.rotationAfterHorizon}];
  }));
  const root = `${materialized.target.environment}/plus-collections`;
  const baselinePath = `${root}/shiftPlanningMigrationBaselines/${baselineRevision}`;
  const operationWrite = group.writes.find((write) => write.targetPath.split("/")[2] === "shiftPlanningOperations");
  const operation = decodeShiftPlanningFirestoreDocument(operationWrite.payload);
  const baseline = {schemaVersion: 1, recordKind: "shiftPlanningMigrationBaseline", revision: baselineRevision,
    target: materialized.target, preparedAt: operation.committedAt, repairOperationId: operation.operationId,
    materializedPlanDigest: materialized.planDigest, originalInputDigest: materialized.inputDigest,
    proposedSnapshotDigest: materialized.proposalDigest,
    expectedPostRepair: {shifts: inventory(finalShifts), spreadsheetDigest: digest(proposal.spreadsheet),
      expectedDates: {delivery: [...proposal.expectedDates.delivery].sort(), market: [...proposal.expectedDates.market].sort()}, rotations}};
  const reference = {revision: baselineRevision, digest: digest(encode(baseline))};
  const baselineWrite = {targetPath: baselinePath, mutationKind: "create", payload: encode({...baseline, baselineDigest: reference.digest})};
  const forward = {readGuards: [...group.readGuards, {targetPath: baselinePath, exists: false}]
    .sort((a, b) => a.targetPath.localeCompare(b.targetPath)), writes: [...group.writes, baselineWrite]};
  check(forward.writes.length <= 500);
  const postDocuments = new Map(originals);
  for (const write of forward.writes) postDocuments.set(write.targetPath, write.payload);
  const inverse = {scope: "isolated_clone_only", requiresVerifiedForwardReadBack: true,
    updateTimeBinding: "per_document_forward_readback_required",
    readGuards: inventory(postDocuments).map((entry) => ({...entry, exists: true})),
    writes: forward.writes.map((write) => originals.has(write.targetPath) ?
      {targetPath: write.targetPath, mutationKind: "update", payload: originals.get(write.targetPath)} :
      {targetPath: write.targetPath, mutationKind: "delete"})};
  const inverseCells = [...materialized.sheetsChanges].reverse().map(({before, after, ...cell}) => ({...cell, before: after, after: before}));
  const sheets = {scope: "captured_grid_clone_rehearsal", workbookId: materialized.target.workbookId,
    capturedVersion: input.workbookVersion, requiresVerifiedForwardReadBackVersion: true,
    originalSnapshotDigest: digest(input.spreadsheet), expectedSnapshotDigest: digest(proposal.spreadsheet),
    forwardCells: materialized.sheetsChanges, inverseCells,
    // The full images preserve empty/missing cells and trailing-row representation;
    // they are clone fixtures, never whole-workbook replacement API requests.
    originalSnapshot: input.spreadsheet, expectedSnapshot: proposal.spreadsheet};
  const {planDigest: parentMaterializedPlanDigest, ...body} = materialized;
  const result = {...body, schemaVersion: 4, scope: "baseline_and_clone_inverse_review", parentMaterializedPlanDigest,
    recoveryEvidence: {baseline: {targetPath: baselinePath, reference}, forward, inverse, sheets,
      originalShiftStateDigest: digest(inventory(originals)), expectedShiftStateDigest: digest(inventory(finalShifts)),
      rotationLineageAttachments: ["delivery", "market"].map((type) => ({targetPath: `${root}/shiftRotations/${type}`,
        migrationBaseline: reference, expectedCursor: rotations[type].rotationAfterHorizon, state: "requires_authoritative_capture"}))},
    pendingGates: [...body.pendingGates.filter((gate) => gate !== "migration_baseline_and_rollback"),
      "authoritative_rotation_baseline_attachment", "guarded_live_repair_recovery_provenance"]};
  return {...result, planDigest: digest(result)};
};
const attachAuthority = ({recovery, input, packet, authorityCapture: capture, expectedAuthorityCaptureDigest}) => {
  check(capture && Buffer.byteLength(JSON.stringify(capture)) <= MAX_BYTES && digest(capture) === expectedAuthorityCaptureDigest);
  check(keys(capture, ["schemaVersion", "target", "inputDigest", "capturedAt", "documents"]) && capture.schemaVersion === 1 &&
    same(capture.target, recovery.target) && capture.inputDigest === recovery.inputDigest && capture.capturedAt === input.capturedAt &&
    Array.isArray(capture.documents) && capture.documents.length === 3);
  const root = `${recovery.target.environment}/plus-collections`;
  const paths = [`${root}/shiftPlanningState/current`, `${root}/shiftRotations/delivery`, `${root}/shiftRotations/market`];
  const documents = new Map();
  for (const entry of capture.documents) {
    check(keys(entry, ["targetPath", "payload", "updateTime"]) && paths.includes(entry.targetPath) && !documents.has(entry.targetPath));
    const data = decodeShiftPlanningFirestoreDocument(entry.payload), updateTime = decodeShiftPlanningFirestoreValue(entry.updateTime);
    check(same(encode(data), entry.payload) && updateTime instanceof Timestamp && same(encode(updateTime), entry.updateTime) &&
      updateTime.valueOf() <= Timestamp.fromDate(new Date(capture.capturedAt)).valueOf());
    documents.set(entry.targetPath, {entry, data});
  }
  const state = buildShiftPlanningAuthoritativeState({environment: recovery.target.environment,
    maintenance: documents.get(paths[0]).data, rotations: {delivery: documents.get(paths[1]).data, market: documents.get(paths[2]).data}});
  check(state.maintenance.maintenanceStatus === "closed" && state.maintenance.intakeBarrier !== null &&
    state.maintenance.intakeBarrier.verifiedAtMillis <= Date.parse(capture.capturedAt) &&
    state.maintenance.activeRevision === packet.authority.bundleRevision && state.maintenance.activeDigest === packet.authority.bundleDigest &&
    state.maintenance.writeEpoch === packet.authority.writeEpoch);
  const evidence = recovery.recoveryEvidence, reference = evidence.baseline.reference;
  const after = {};
  for (const type of ["delivery", "market"]) {
    const current = state.rotations[type], attachment = evidence.rotationLineageAttachments.find((item) => item.targetPath === `${root}/shiftRotations/${type}`);
    check(current.releaseLease === null && current.stateRevision < Number.MAX_SAFE_INTEGER &&
      same(current.cursor, input.lineage[type].rotationAfterHorizon));
    const dates = input.expectedDates[type];
    check(dates.every((date) => Number(date.slice(0, 4)) - Number(Number(date.slice(5, 7)) < 9) <= current.planningFrontierSeasonStartYear));
    const cursor = attachment.expectedCursor, frozen = cursor.nextMemberIndex !== 0;
    after[type] = {...current, stateRevision: current.stateRevision + 1, cursor, cohortFrozen: frozen,
      frozenCohortUserIds: frozen ? cursor.cohortUserIds : [], migrationBaseline: reference};
  }
  buildShiftPlanningAuthoritativeState({environment: recovery.target.environment, maintenance: state.maintenance, rotations: after});
  const forward = structuredClone(evidence.forward), inverse = structuredClone(evidence.inverse);
  for (const path of paths) {
    const {entry} = documents.get(path), isRotation = path !== paths[0];
    forward.readGuards.push({targetPath: path, exists: true, updateTime: entry.updateTime, payloadDigest: digest(entry.payload)});
    const finalPayload = isRotation ? encode(after[path.split("/").at(-1)]) : entry.payload;
    inverse.readGuards.push({targetPath: path, exists: true, payloadDigest: digest(finalPayload)});
    if (isRotation) {
      forward.writes.push({targetPath: path, mutationKind: "update", payload: finalPayload});
      inverse.writes.push({targetPath: path, mutationKind: "update", payload: entry.payload});
    }
  }
  check(forward.writes.length <= 500);
  forward.readGuards.sort((a, b) => a.targetPath.localeCompare(b.targetPath));
  inverse.readGuards.sort((a, b) => a.targetPath.localeCompare(b.targetPath));
  const {planDigest: parentRecoveryPlanDigest, ...body} = recovery;
  const result = {...body, schemaVersion: 5, scope: "authority_bound_clone_rehearsal", parentRecoveryPlanDigest,
    recoveryEvidence: {...evidence, forward, inverse, authorityCaptureDigest: expectedAuthorityCaptureDigest,
      authorityDocuments: paths.map((path) => documents.get(path).entry),
      rotationLineageAttachments: evidence.rotationLineageAttachments.map((item) => ({...item, state: "captured_and_materialized"}))},
    pendingGates: body.pendingGates.filter((gate) => gate !== "authoritative_rotation_baseline_attachment")};
  return {...result, planDigest: digest(result)};
};
module.exports = {materializeShiftRepair};
