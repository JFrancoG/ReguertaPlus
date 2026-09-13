import {randomUUID} from "node:crypto";
import {Transaction, Timestamp} from "@google-cloud/firestore";
import {coverageId, coverageMember, rejectCoverage} from "./shift-coverage.js";
import {createProvisionalCreditFirestore} from "./shift-credit-publication.js";
import {readCoverageNotificationReference} from
  "./shift-coverage-notification.js";
import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";
import {assertShiftPlanningWriterAuthority} from
  "./shift-planning-writer-authority.js";
import {genericShiftPlanningPush} from
  "./shift-planning-notification-dispatch.js";
import {ShiftPlanningNotificationTransport} from
  "./shift-planning-firebase-notification-transport.js";

type Targets = {
  firebaseInstallationIds: readonly string[];
  fcmTokens: readonly string[];
};

/**
 * Fixed-demo dispatch after verified projection/inbox release. The injected
 * destination resolver and transport are rehearsal boundaries, not live wiring.
 * A persisted submitting/terminal record is never automatically resent: a lost
 * acknowledgement or process crash requires governed reconciliation. No tokens
 * are persisted in the receipt, and a push is never proof of device delivery.
 * @param {object} input Rehearsal destination resolver, transport and clock.
 * @return {object} Submit once or close the owned emulator store.
 */
export const createProvisionalCoveragePushDispatcher = (input: {
  resolveTargets(memberId: string): Promise<Targets>;
  transport: ShiftPlanningNotificationTransport;
  nowMillis(): number;
}) => {
  const db = createProvisionalCreditFirestore();
  const root = "develop/plus-collections";
  const clock = () => {
    const now = input.nowMillis();
    if (!Number.isSafeInteger(now) || now < 0) {
      return rejectCoverage("invalid_coverage_clock");
    }
    return now;
  };
  const locate = async (
    tx: Transaction, memberId: string, eventId: string,
  ) => {
    const reference = await readCoverageNotificationReference(
      db, tx, memberId, eventId);
    const inbox = await tx.get(db.doc(
      `${root}/users/${memberId}/notificationInbox/${eventId}`));
    const operationId = inbox.data()?.coverageOperationId as string;
    return {reference, operationId,
      path: `${root}/shiftCoverageEffects/${operationId}/pushes/${memberId}`};
  };
  const load = async (tx: Transaction, memberId: string, eventId: string) => {
    const {reference, operationId, path} = await locate(tx, memberId, eventId);
    const [effect, member, maintenance, current] = await tx.getAll(
      db.doc(`${root}/shiftCoverageEffects/${operationId}`),
      db.doc(`${root}/users/${memberId}`),
      db.doc(`${root}/shiftPlanningState/current`),
      db.doc(`${root}/shiftCoverageCases/${reference.caseId}`));
    const value = effect.data()?.value;
    assertShiftPlanningWriterAuthority({
      capturedValue: effect.data()?.authority,
      currentStateValue: maintenance.data(),
      changedCode: "coverage_push_authority_changed",
      changedMessage: "Coverage notification lost writer authority",
    });
    if (!member.exists || !coverageMember(member.data()).active ||
      current.data()?.digest !== value.caseDigest ||
      digest(current.data()?.value) !== value.caseDigest ||
      (current.data()?.value.status === "offered" &&
        current.data()?.value.offer?.expiresAtMillis <= clock())) {
      return rejectCoverage("coverage_push_stale");
    }
    const revisions = [member, maintenance, current].map((snapshot) =>
      [snapshot.updateTime?.seconds, snapshot.updateTime?.nanoseconds]);
    return {path, sourceDigest: digest([value.effectsDigest, ...revisions])};
  };
  return {
    close: () => db.terminate(),
    async submit(memberIdValue: string, eventIdValue: string) {
      const memberId = coverageId(memberIdValue);
      const eventId = coverageId(eventIdValue);
      const replay = await db.runTransaction(async (tx) => {
        const {path} = await locate(tx, memberId, eventId);
        const existing = await tx.get(db.doc(path));
        return existing.exists ?
          {state: existing.data()?.state as string, replayed: true} : null;
      });
      if (replay) return replay;
      const before = await db.runTransaction((tx) =>
        load(tx, memberId, eventId));
      const targets = await input.resolveTargets(memberId);
      const values = [...targets.fcmTokens, ...targets.firebaseInstallationIds];
      if (values.length > 500 || values.some((v) =>
        typeof v !== "string" || !v.trim()) ||
        new Set(values).size !== values.length) {
        return rejectCoverage("coverage_push_destinations_invalid");
      }
      if (!values.length) return {state: "noTargets", replayed: false};
      const attemptId = randomUUID();
      const expiresAtMillis = clock() + 30_000;
      const recordRef = db.doc(before.path);
      const claim = await db.runTransaction(async (tx) => {
        const existing = await tx.get(recordRef);
        if (existing.exists) {
          return {state: existing.data()?.state as string, replayed: true};
        }
        const fresh = await load(tx, memberId, eventId);
        if (fresh.sourceDigest !== before.sourceDigest ||
          clock() >= expiresAtMillis) {
          return rejectCoverage("coverage_push_source_changed");
        }
        tx.create(recordRef, {eventId, attemptId, state: "submitting",
          sourceDigest: fresh.sourceDigest, targetsDigest: digest(targets),
          startedAt: Timestamp.fromMillis(clock())});
        return null;
      });
      if (claim) return claim;
      let result;
      try {
        result = await input.transport.submit({
          push: {...genericShiftPlanningPush(eventId),
            collapseKey: digest(eventId).split(":").at(-1) as string}, targets,
          submissionWindow: {signal: new AbortController().signal,
            expiresAtMillis},
        });
      } catch {
        result = {outcome: "unknown" as const,
          failureCode: "transport_ambiguous_error"};
      }
      await db.runTransaction(async (tx) => {
        const existing = await tx.get(recordRef);
        if (existing.data()?.attemptId !== attemptId ||
          existing.data()?.state !== "submitting") {
          return rejectCoverage("coverage_push_receipt_changed");
        }
        tx.update(recordRef, {state: result.outcome, result,
          completedAt: Timestamp.fromMillis(clock())});
      });
      return {state: result.outcome, replayed: false};
    },
  };
};
