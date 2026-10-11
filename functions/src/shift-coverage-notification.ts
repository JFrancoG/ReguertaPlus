import {Firestore, Transaction, Timestamp} from "@google-cloud/firestore";
import {rejectCoverage} from "./shift-coverage.js";
import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";
import {ShiftCoverageEffects} from "./shift-coverage-effects.js";

const root = "develop/plus-collections";
const unavailable = () => rejectCoverage("coverage_notification_unavailable");

/**
 * Resolve the authenticated member's delivered reference. A public event ID
 * alone grants nothing: a delivered reference permits the minimal current case
 * projection. Old offers resolve current state, never replay old actions.
 * @param {Firestore} db Fixed local store.
 * @param {Transaction} tx Owning authorized read transaction.
 * @param {string} memberId Canonical authenticated member.
 * @param {string} eventId Opaque client reference.
 * @return {Promise<object>} Verified case and minimum delivered revision.
 */
export const readCoverageNotificationReference = async (
  db: Firestore, tx: Transaction, memberId: string, eventId: string,
) => {
  const inbox = await tx.get(db.doc(
    `${root}/users/${memberId}/notificationInbox/${eventId}`));
  const operationId = inbox.data()?.coverageOperationId;
  if (typeof operationId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(operationId) ||
    inbox.data()?.notificationEventId !== eventId) return unavailable();
  const [effect, receipt] = await tx.getAll(
    db.doc(`${root}/shiftCoverageEffects/${operationId}`),
    db.doc(`${root}/shiftCoverageOperations/${operationId}`));
  const record = effect.data();
  const value = record?.value as ShiftCoverageEffects | undefined;
  if (!value) return unavailable();
  const {effectsDigest, ...core} = value;
  if (record?.state !== "completed" ||
    !record?.deliveredTo?.includes(memberId) ||
    value.operationId !== operationId || value.environment !== "develop" ||
    value.schemaVersion !== 1 || digest(core) !== effectsDigest ||
    receipt.data()?.effectsDigest !== effectsDigest ||
    !value.notifications.some((intent) => intent.userId === memberId &&
      intent.push.data.eventId === eventId)) return unavailable();
  return {eventId, caseId: value.caseId, caseRevision: value.caseRevision};
};

export const readCoverageNotificationInbox = async (
  db: Firestore, tx: Transaction, memberId: string,
) => {
  const records = await tx.get(db.collection(
    `${root}/users/${memberId}/notificationInbox`)
    .where("coverageOperationId", "!=", null).limit(251));
  if (records.size > 250) return rejectCoverage("coverage_read_limit");
  return records.docs.map((doc) => {
    const sentAt = doc.data().sentAt;
    if (!(sentAt instanceof Timestamp)) return unavailable();
    return {eventId: doc.id, sentAtMillis: sentAt.toMillis()};
  }).sort((a, b) => b.sentAtMillis - a.sentAtMillis ||
    a.eventId.localeCompare(b.eventId));
};
