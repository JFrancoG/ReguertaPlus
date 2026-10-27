import {randomUUID} from "node:crypto";
import {Firestore, Transaction, Timestamp} from "@google-cloud/firestore";
import type {AppEnvironment} from "./backend-security.js";
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
import {ShiftCoverageStoreContext} from "./shift-coverage-store-context.js";

type Targets = {
  firebaseInstallationIds: readonly string[];
  fcmTokens: readonly string[];
};

type DispatcherInput = {
  firestore: Firestore;
  context: ShiftCoverageStoreContext;
  resolveTargets(
    environment: AppEnvironment, memberId: string,
  ): Promise<Targets>;
  transport: ShiftPlanningNotificationTransport;
  nowMillis(): number;
};

/**
 * Environment-bound dispatch after verified projection/inbox release. The
 * caller owns the SDK, trusted readiness and destination/transport admission;
 * this factory neither creates an SDK client nor enables a deployed delivery.
 * A persisted submitting/terminal record is never automatically resent: a lost
 * acknowledgement or process crash requires governed reconciliation. No tokens
 * are persisted in the receipt, and a push is never proof of device delivery.
 * @param {object} input Owned SDK, trusted scope, transport and clock.
 * @return {object} Submit once without terminating the caller's SDK.
 */
export const createFirestoreShiftCoveragePushDispatcher = (
  input: DispatcherInput,
) => {
  const db = input.firestore;
  const environment = input.context.environment;
  if (environment !== "develop" && environment !== "production") {
    return rejectCoverage("invalid_coverage_environment");
  }
  const root = `${environment}/plus-collections`;
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
    await input.context.requireReady(tx);
    const reference = await readCoverageNotificationReference(
      db, tx, memberId, eventId, environment);
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
      const targets = await input.resolveTargets(environment, memberId);
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
        await input.context.requireReady(tx);
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

/**
 * Preserve the fixed emulator boundary and ownership of its private SDK client.
 * @param {object} input Local destination resolver, transport and clock.
 * @return {object} Dispatcher and explicit emulator client disposal.
 */
export const createProvisionalCoveragePushDispatcher = (input: {
  resolveTargets(memberId: string): Promise<Targets>;
  transport: ShiftPlanningNotificationTransport;
  nowMillis(): number;
}) => {
  const firestore = createProvisionalCreditFirestore();
  const dispatcher = createFirestoreShiftCoveragePushDispatcher({
    ...input, firestore,
    context: {environment: "develop", requireReady: async () => undefined},
    resolveTargets: (_environment, memberId) => input.resolveTargets(memberId),
  });
  return {...dispatcher, close: () => firestore.terminate()};
};
