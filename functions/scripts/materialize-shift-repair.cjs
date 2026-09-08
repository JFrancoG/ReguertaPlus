"use strict";

// Offline compiler only. Encoded writes are review templates, never SDK calls.
const {Timestamp} = require("@google-cloud/firestore");
const {planShiftRepair} = require("./repair-planned-shifts.cjs");
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
  const {materialization: packet, expectedMaterializationDigest, ...reviewOptions} = captured;
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
  return {...result, planDigest: digest(result)};
};
module.exports = {materializeShiftRepair};
