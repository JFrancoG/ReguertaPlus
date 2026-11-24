import {randomUUID} from "node:crypto";
import {Firestore, Transaction, Timestamp} from "@google-cloud/firestore";
import type {Messaging} from "firebase-admin/messaging";
import {AppEnvironment, HttpRequestError, VerifiedIdentity} from
  "./backend-security.js";
import {readShiftCoverageActor} from "./shift-coverage-access.js";
import {SHIFT_PLANNING_MAX_DEVICES_PER_USER} from
  "./shift-planning-member-revision.js";
import {coverageId, coverageMember, rejectCoverage} from "./shift-coverage.js";
import {createProvisionalCreditFirestore} from "./shift-credit-publication.js";
import {readCoverageNotificationDelivery} from
  "./shift-coverage-notification.js";
import {isCurrentCoverageEffect} from "./shift-coverage-effects.js";
import {isVerifiedCoverageProjection, readCoverageAcceptanceProjection} from
  "./shift-coverage-projection.js";
import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";
import {assertShiftPlanningWriterAuthority} from
  "./shift-planning-writer-authority.js";
import {genericShiftPlanningPush} from
  "./shift-planning-notification-dispatch.js";
import {createFirebaseShiftPlanningNotificationTransport,
  ShiftPlanningNotificationTransport} from
  "./shift-planning-firebase-notification-transport.js";
import {requireCoverageParticipants, ShiftCoverageStoreContext} from
  "./shift-coverage-store-context.js";

type Targets = {
  firebaseInstallationIds: readonly string[];
  fcmTokens: readonly string[];
};

type DispatcherInput = {
  firestore: Firestore;
  context: ShiftCoverageStoreContext;
  resolveTargets?(
    environment: AppEnvironment, memberId: string,
  ): Promise<Targets>;
  transport: ShiftPlanningNotificationTransport;
  nowMillis(): number;
};

type Retry = {memberId: string; eventId: string; expectedAttemptId: string;
  operationId: string};

type PushRecord = Record<string, unknown> & {
  result?: {outcome?: string; failureCode?: string};
};
type PushOutcome = {state: string; replayed: boolean};

export const isRetryableCoveragePush = (record?: PushRecord): boolean =>
  record?.state === "failed" && record.retryable === true &&
  record.result?.outcome === "failed" &&
  record.result.failureCode === "all_targets_rejected";

const definiteRejections = new Set(["messaging/invalid-registration-token",
  "messaging/registration-token-not-registered", "messaging/invalid-recipient",
  "messaging/mismatched-credential", "messaging/invalid-package-name"]);

/**
 * Authorize a manual retry only when every submitted target was definitively
 * rejected. Individual SDK response errors can also represent lost replies.
 * @param {object} messaging Server-owned Firebase Messaging client.
 * @param {Function} nowMillis Trusted clock.
 * @return {object} Generic push transport without automatic retries.
 */
export const createFirebaseShiftCoverageNotificationTransport = (
  messaging: Pick<Messaging, "sendEachForMulticast">,
  nowMillis: () => number = Date.now,
): ShiftPlanningNotificationTransport =>
  createFirebaseShiftPlanningNotificationTransport(messaging, nowMillis,
    (code) => definiteRejections.has(code));

const readTargets = async (db: Firestore, tx: Transaction,
  root: string, memberId: string): Promise<Targets> => {
  const devices = await tx.get(db.collection(`${root}/users/${memberId}` +
    "/devices").limit(SHIFT_PLANNING_MAX_DEVICES_PER_USER + 1));
  if (devices.size > SHIFT_PLANNING_MAX_DEVICES_PER_USER) {
    return rejectCoverage("coverage_push_destinations_invalid");
  }
  const fids = new Set<string>();
  const tokens = new Set<string>();
  const tokenAliases = new Map<string, string>();
  for (const doc of devices.docs) {
    const fid = doc.get("firebaseInstallationId");
    const token = doc.get("fcmToken");
    if ([fid, token].some((v) => v != null && typeof v !== "string")) {
      return rejectCoverage("coverage_push_destinations_invalid");
    }
    const installation = fid?.trim();
    const legacyToken = token?.trim();
    if (installation) {
      fids.add(installation);
      if (legacyToken) {
        if (tokenAliases.has(legacyToken) &&
            tokenAliases.get(legacyToken) !== installation) {
          return rejectCoverage("coverage_push_destinations_invalid");
        }
        tokenAliases.set(legacyToken, installation);
      }
    } else if (legacyToken) tokens.add(legacyToken);
  }
  for (const alias of tokenAliases.keys()) tokens.delete(alias);
  return {firebaseInstallationIds: [...fids].sort(),
    fcmTokens: [...tokens].sort()};
};

/**
 * Environment-bound dispatch after verified projection/inbox release. The
 * caller owns the SDK, trusted readiness and destination/transport admission;
 * this factory neither creates an SDK client nor enables a deployed delivery.
 * A linked administrator can retry a definitively rejected attempt using its
 * exact ID. The claim and retry history are atomic. An uncertain submission
 * keeps its single inbox notice and cannot be submitted again. Push receipts
 * retain only a digest of the destinations.
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
    requireCoverageParticipants(input.context.participants, [memberId]);
    const reference = await readCoverageNotificationDelivery(
      db, tx, memberId, eventId, environment);
    const {operationId} = reference;
    return {reference, operationId,
      path: `${root}/shiftCoverageEffects/${operationId}/pushes/${memberId}`};
  };
  const load = async (tx: Transaction, memberId: string,
    {reference, operationId, path}: Awaited<ReturnType<typeof locate>>) => {
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
    const recipient = member.exists && coverageMember(member.data());
    if (!recipient || !recipient.active ||
      (value.drawFailureNotice && !recipient.admin) ||
      !isCurrentCoverageEffect(value, current.data()) ||
      (current.data()?.value.status === "offered" &&
        current.data()?.value.offer?.expiresAtMillis <= clock())) {
      return rejectCoverage("coverage_push_stale");
    }
    if (value.action === "complete") {
      const projection = await readCoverageAcceptanceProjection(db, tx, value);
      if (!isVerifiedCoverageProjection(projection)) {
        return rejectCoverage("coverage_effects_readback_required");
      }
    }
    const revisions = [member, maintenance, current].map((snapshot) =>
      [snapshot.updateTime?.seconds, snapshot.updateTime?.nanoseconds]);
    return {path, sourceDigest: digest([value.effectsDigest, ...revisions])};
  };
  const dispatch = async (memberIdValue: string, eventIdValue: string,
    retry?: {command: Retry; identity: VerifiedIdentity}):
    Promise<PushOutcome> => {
    const memberId = coverageId(memberIdValue);
    const eventId = coverageId(eventIdValue);
    const attemptId = randomUUID();
    if (retry) {
      coverageId(retry.command.operationId);
      coverageId(retry.command.expectedAttemptId);
    }
    const inspect = async (tx: Transaction) => {
      const actor = retry ? await readShiftCoverageActor(
        db, tx, retry.identity, environment) : null;
      if (retry && !actor?.admin) {
        throw new HttpRequestError(403, "coverage_actor_forbidden", "Denied");
      }
      const delivery = await locate(tx, memberId, eventId);
      const record = db.doc(delivery.path);
      const current = (await tx.get(record)).data();
      let replay: PushOutcome | null = null;
      if (!retry) {
        if (current) replay = {state: current.state, replayed: true};
        return {record, replay, commandDigest: null, history: null, current,
          delivery};
      }
      const history = db.doc(`${root}/shiftCoverageProjectionState/` +
        `pushRetries/operations/${retry.command.operationId}`);
      const commandDigest = digest({environment, command: retry.command,
        actorId: actor?.memberId, authUid: retry.identity.uid});
      const previous = (await tx.get(history)).data();
      if (previous) {
        if (previous.commandDigest !== commandDigest) {
          return rejectCoverage("coverage_push_retry_conflict");
        }
        replay = {state: previous.attemptId === current?.attemptId ?
          current?.state : previous.state, replayed: true};
      } else if (current?.eventId !== eventId ||
          current?.attemptId !== retry.command.expectedAttemptId ||
          !isRetryableCoveragePush(current)) {
        return rejectCoverage("coverage_push_retry_unavailable");
      }
      return {record, replay, commandDigest, history, current, delivery};
    };
    // External resolver is used by the fixed rehearsal. Normal installations
    // are read in the same transaction as the push claim.
    const preflight = async (tx: Transaction) => {
      const admission = await inspect(tx);
      const source = admission.replay ? null :
        await load(tx, memberId, admission.delivery);
      return {replay: admission.replay, source,
        commandDigest: admission.commandDigest};
    };
    const before = input.resolveTargets ?
      await db.runTransaction(preflight) : null;
    if (before?.replay) return before.replay;
    const resolved = await input.resolveTargets?.(environment, memberId);
    const expiresAtMillis = clock() + 30_000;
    const claim = await db.runTransaction(async (tx) => {
      const admission = await inspect(tx);
      if (admission.replay) return {outcome: admission.replay};
      const fresh = await load(tx, memberId, admission.delivery);
      if ((before && (fresh.sourceDigest !== before.source?.sourceDigest ||
          admission.commandDigest !== before.commandDigest)) ||
          clock() >= expiresAtMillis) {
        return rejectCoverage("coverage_push_source_changed");
      }
      const targets = resolved ?? await readTargets(db, tx, root, memberId);
      const values = [...targets.fcmTokens, ...targets.firebaseInstallationIds];
      if (values.length > 500 || values.some((v) =>
        typeof v !== "string" || !v.trim()) ||
          new Set(values).size !== values.length) {
        return rejectCoverage("coverage_push_destinations_invalid");
      }
      const startedAt = Timestamp.fromMillis(clock());
      const receipt = {eventId, attemptId, sourceDigest: fresh.sourceDigest,
        targetsDigest: digest(targets), startedAt,
        ...(retry ? {retryOperationId: retry.command.operationId} : {}),
        ...(values.length ? {state: "submitting"} : {state: "noTargets",
          result: {outcome: "noTargets"}, completedAt: startedAt})};
      if (values.length || !input.resolveTargets) {
        if (admission.history) {
          tx.create(admission.history, {...receipt,
            commandDigest: admission.commandDigest,
            operationId: retry?.command.operationId,
            actorUid: retry?.identity.uid,
            previousAttempt: admission.current});
          tx.set(admission.record, receipt);
        } else tx.create(admission.record, receipt);
      }
      if (!values.length) {
        return {outcome: {state: "noTargets", replayed: false}};
      }
      return {record: admission.record, history: admission.history, targets};
    });
    if (claim.outcome) return claim.outcome;
    let result;
    try {
      result = await input.transport.submit({
        push: {...genericShiftPlanningPush(eventId),
          collapseKey: digest(eventId).split(":").at(-1) as string},
        targets: claim.targets,
        submissionWindow: {signal: new AbortController().signal,
          expiresAtMillis},
      });
    } catch {
      result = {outcome: "unknown" as const,
        failureCode: "transport_ambiguous_error"};
    }
    await db.runTransaction(async (tx) => {
      await input.context.requireReady(tx);
      const current = (await tx.get(claim.record)).data();
      if (current?.attemptId !== attemptId || current.state !== "submitting") {
        return rejectCoverage("coverage_push_receipt_changed");
      }
      const completion = {state: result.outcome, result,
        ...(result.outcome === "failed" && result.rejectionConfirmed === true &&
          result.failureCode === "all_targets_rejected" ? {retryable: true} :
          {}), completedAt: Timestamp.fromMillis(clock())};
      tx.update(claim.record, completion);
      if (claim.history) tx.update(claim.history, completion);
    });
    return {state: result.outcome, replayed: false};
  };
  return {
    submit: (memberId: string, eventId: string) => dispatch(memberId, eventId),
    retryRejected: (command: Retry, identity: VerifiedIdentity) =>
      dispatch(command.memberId, command.eventId, {command, identity}),
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
