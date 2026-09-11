"use strict";

// No live execution surface: construct the only client here, after target checks.
const {Firestore, Timestamp, FieldValue} = require("@google-cloud/firestore");
const {materializeShiftRepair} = require("./materialize-shift-repair.cjs");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {encodeShiftPlanningFirestoreValue, decodeShiftPlanningFirestoreValue, decodeShiftPlanningFirestoreDocument} =
  require("../lib/shift-planning-publication-contract.js");
const {applyShiftPlanningFirestoreTransactionAttempt} = require("../lib/shift-planning-firestore-transaction-attempt.js");
const {produceShiftPlanningPublicEventAudit} = require("../lib/shift-planning-public-event-retention.js");
const {SHIFT_PLANNING_FIRESTORE_ADMISSION_REVISION} = require("../lib/shift-planning-firestore-transaction-manifest.js");
const check = (condition) => { if (!condition) throw new Error("repair_rehearsal_rejected"); };
const encode = (value) => encodeShiftPlanningFirestoreValue(value, "repair rehearsal", new Set());
const same = (a, b) => digest(a) === digest(b);
const exact = (value, fields) => value && typeof value === "object" && !Array.isArray(value) && same(Object.keys(value).sort(), [...fields].sort());
const stamp = (value) => {
  const decoded = decodeShiftPlanningFirestoreValue(value);
  check(decoded instanceof Timestamp && same(encode(decoded), value)); return decoded;
};
const descriptors = (guards) => guards.map((guard) => ({targetPath: guard.targetPath, exists: guard.exists,
  payloadDigest: guard.exists ? guard.payloadDigest : null})).sort((a, b) => a.targetPath.localeCompare(b.targetPath));

const rehearseShiftRepair = async (input) => {
  const {options, expectedReviewDigest, direction, emulator, indexConfigurationDigest, readBack} = structuredClone(input);
  const match = /^(127\.0\.0\.1|localhost|\[::1\]):([1-9][0-9]{0,4})$/.exec(emulator?.host ?? "");
  check(match && Number(match[2]) <= 65535 && process.env.FIRESTORE_EMULATOR_HOST === emulator.host &&
    /^demo-[a-z0-9-]+$/.test(emulator.projectId) && options?.target?.projectId === emulator.projectId && options.target.environment === "develop");
  check(direction === "forward" || direction === "inverse");
  check(typeof indexConfigurationDigest === "string" && /^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(indexConfigurationDigest));
  const review = await materializeShiftRepair(options);
  check(review.schemaVersion === 5 && review.planDigest === expectedReviewDigest);
  const evidence = review.recoveryEvidence;
  const before = descriptors(evidence.forward.readGuards), after = descriptors(evidence.inverse.readGuards);
  let replay = false, receiptTimes = new Map();
  if (readBack !== undefined) {
    check(exact(readBack, ["schemaVersion", "scope", "target", "reviewDigest", "direction", "documents", "receiptDigest"]));
    const {receiptDigest, ...body} = readBack;
    check(digest(body) === receiptDigest && body.schemaVersion === 1 && body.scope === "loopback_emulator" &&
      same(body.target, review.target) && body.reviewDigest === review.planDigest && ["forward", "inverse"].includes(body.direction) && Array.isArray(body.documents));
    check(body.documents.every((doc) => exact(doc, ["targetPath", "exists", "payloadDigest", "updateTime"])));
    check(same(body.documents.map(({updateTime, ...doc}) => doc), body.direction === "forward" ? after : before));
    for (const doc of body.documents) {
      if (doc.exists) receiptTimes.set(doc.targetPath, stamp(doc.updateTime));
      else check(doc.updateTime === null);
    }
    replay = body.direction === direction;
    check(replay || (direction === "inverse" && body.direction === "forward"));
  }
  check(direction !== "inverse" || readBack !== undefined);
  const group = direction === "forward" ? evidence.forward : evidence.inverse;
  const desired = direction === "forward" ? after : before;
  const checkedGuards = replay ? desired : group.readGuards;
  const firestore = new Firestore({projectId: emulator.projectId, host: emulator.host, ssl: false});
  try {
    const admission = await firestore.runTransaction(async (transaction) => {
      if (!replay && direction === "forward") check(stamp(options.materialization.preparedAt).valueOf() <= Timestamp.now().valueOf());
      const snapshots = await transaction.getAll(...checkedGuards.map((guard) => firestore.doc(guard.targetPath)));
      const live = new Map();
      snapshots.forEach((snapshot, index) => {
        const guard = checkedGuards[index]; check(snapshot.exists === guard.exists);
        if (snapshot.exists) {
          check(digest(encode(snapshot.data())) === guard.payloadDigest);
          const expectedTime = readBack !== undefined ? receiptTimes.get(guard.targetPath) : stamp(guard.updateTime);
          check(expectedTime && snapshot.updateTime.isEqual(expectedTime));
          live.set(guard.targetPath, snapshot);
        }
      });
      if (replay) return null;
      const mutations = group.writes.map((write) => {
        const common = {kind: write.mutationKind, documentPath: write.targetPath};
        if (write.mutationKind === "create") return {...common, data: decodeShiftPlanningFirestoreDocument(write.payload)};
        const current = live.get(write.targetPath); check(current);
        const precondition = {lastUpdateTime: current.updateTime};
        if (write.mutationKind === "delete") return {...common, precondition};
        const data = decodeShiftPlanningFirestoreDocument(write.payload);
        // update() merges top-level fields: delete fields absent from the exact
        // restored image, notably provenance introduced by the forward mutation.
        for (const key of Object.keys(current.data())) if (!Object.hasOwn(data, key)) data[key] = FieldValue.delete();
        return {...common, data, precondition};
      });
      return applyShiftPlanningFirestoreTransactionAttempt({firestore, transaction, direction, manifestDigest: review.planDigest,
        mutations, expectedDocumentWriteCount: mutations.length, writerFenceCheckedAt: Timestamp.now(),
        authority: {adapterRevision: SHIFT_PLANNING_FIRESTORE_ADMISSION_REVISION, indexConfigurationDigest}});
    });
    if (replay) return {outcome: "replayed", admission, readBack};
    // A read-back failure must remain an unknown outcome; never retry the forward
    // writes automatically merely because no verified receipt could be produced.
    const documents = await firestore.runTransaction(async (transaction) => {
      const snapshots = await transaction.getAll(...desired.map((item) => firestore.doc(item.targetPath)));
      return snapshots.map((snapshot, index) => {
        const expected = desired[index]; check(snapshot.exists === expected.exists);
        if (snapshot.exists) check(digest(encode(snapshot.data())) === expected.payloadDigest);
        if (direction === "forward" && group.writes.some((write) => write.targetPath === expected.targetPath && write.targetPath.split("/")[2] === "shifts")) {
          const operation = decodeShiftPlanningFirestoreDocument(group.writes.find((write) => write.targetPath.split("/")[2] === "shiftPlanningOperations").payload);
          const retention = decodeShiftPlanningFirestoreDocument(group.writes.find((write) => write.targetPath.split("/")[2] === "shiftPlanningPublicEventLedgers").payload);
          const before = review.firestoreEvidence.documents.find((doc) => doc.targetPath === expected.targetPath);
          // Match the trigger's Date.parse(event.time) millisecond boundary;
          // retain the exact nanoseconds separately for read-back and CAS.
          const eventTime = Timestamp.fromMillis(snapshot.updateTime.seconds * 1000 + Math.floor(snapshot.updateTime.nanoseconds / 1000000));
          const audit = produceShiftPlanningPublicEventAudit({eventId: `rehearsal-${operation.operationId}`, eventTime,
            targetPath: expected.targetPath, before: before ? decodeShiftPlanningFirestoreDocument(before.payload) : null,
            after: snapshot.data(), operation, retention, policy: options.materialization.retentionPolicy});
          check(audit.kind === "controlledNoOp");
        }
        return {...expected, updateTime: snapshot.exists ? encode(snapshot.updateTime) : null};
      });
    }, {readOnly: true});
    const body = {schemaVersion: 1, scope: "loopback_emulator", target: review.target, reviewDigest: review.planDigest, direction, documents};
    return {outcome: "committed", admission, readBack: {...body, receiptDigest: digest(body)}};
  } finally { await firestore.terminate(); }
};
module.exports = {rehearseShiftRepair};
