import {Firestore, QuerySnapshot, Timestamp, Transaction} from
  "@google-cloud/firestore";
import {buildNotificationInboxDocument} from "./notification-inbox.js";
import {coverageMember, rejectCoverage} from "./shift-coverage.js";
import {ShiftCoverageEffects} from "./shift-coverage-effects.js";

/**
 * Stages inbox writes in the transaction that finalizes verified projection.
 * The caller has already read and authorized the complete effect and roster;
 * no notification is sent here, and inactive recipients remain excluded.
 * @param {object} input Owning transaction, frozen effect and current roster.
 * @return {string[]} Recipients staged for atomic release.
 */
export const releaseCoverageInbox = (input: {
  db: Firestore;
  tx: Transaction;
  value: ShiftCoverageEffects;
  users: QuerySnapshot;
  now: number;
}) => {
  const deliveredTo: string[] = [];
  for (const intent of input.value.notifications) {
    const user = input.users.docs.find((doc) => doc.id === intent.userId);
    if (!user || !coverageMember(user.data()).active) continue;
    const eventId = intent.push.data.eventId;
    const inbox = buildNotificationInboxDocument(eventId, {
      ...intent.push.notification, type: intent.push.data.type,
      target: "users", targetPayload: {userIds: [intent.userId]},
      createdBy: "system", sentAt: Timestamp.fromMillis(input.now),
    }, intent.userId) ?? rejectCoverage("coverage_effects_inbox_invalid");
    input.tx.create(input.db.doc("develop/plus-collections/users/" +
      `${intent.userId}/notificationInbox/${eventId}`),
    {...inbox, coverageOperationId: input.value.operationId});
    deliveredTo.push(intent.userId);
  }
  return deliveredTo;
};
