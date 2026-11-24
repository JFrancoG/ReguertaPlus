import {DocumentSnapshot, FieldPath, Firestore, Transaction} from
  "@google-cloud/firestore";
import {AppEnvironment, HttpRequestError, VerifiedIdentity} from
  "./backend-security.js";
import {coverageId, coverageMember, rejectCoverage} from "./shift-coverage.js";
import {ShiftCoverageEffects} from "./shift-coverage-effects.js";
import {isVerifiedCoverageProjection, readCoverageAcceptanceProjection} from
  "./shift-coverage-projection.js";
import {isRetryableCoveragePush} from "./shift-coverage-push.js";
import {ShiftCoverageStoreContext} from "./shift-coverage-store-context.js";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {createShiftPlanningDigest as digest, ShiftPlanningDigestError} from
  "./shift-planning-digest.js";

type DeliveryQuery = {action: "deliveryIncidents"; after?: string};
type RecoveryTarget = {mode: "resume" | "inspect"} |
  {mode: "retryPush"; operationId: string; expectedAttemptId: string;
    memberId: string; eventId: string};
type DeliveryCommand = {action: "retryDelivery"; effectOperationId: string} &
  RecoveryTarget;
type DeliveryRequest = {schemaVersion: 1; environment: AppEnvironment} &
  (DeliveryQuery | DeliveryCommand);

export type CoverageDeliveryPort = {
  drain(effectOperationId: string): Promise<{state: string}>;
  inspect(effectOperationId: string): Promise<{state: string}>;
  retryRejected(command: {operationId: string; expectedAttemptId: string;
    memberId: string; eventId: string}, identity: VerifiedIdentity):
    Promise<{state: string; replayed: boolean}>;
};

export const parseCoverageDeliveryRequest = (
  value: unknown,
): DeliveryRequest => {
  const request = value as DeliveryRequest;
  if (!request || Object.getPrototypeOf(request) !== Object.prototype ||
      request.schemaVersion !== 1 ||
      !["develop", "production"].includes(request.environment)) {
    return rejectCoverage("invalid_coverage_delivery_request");
  }
  const keys = ["schemaVersion", "environment", "action"];
  if (request.action === "deliveryIncidents") {
    if ("after" in request) {
      coverageId(request.after);
      keys.push("after");
    }
  } else if (request.action === "retryDelivery") {
    coverageId(request.effectOperationId);
    keys.push("effectOperationId", "mode");
    if (request.mode === "retryPush") {
      [request.operationId, request.expectedAttemptId, request.memberId,
        request.eventId].forEach(coverageId);
      keys.push("operationId", "expectedAttemptId", "memberId", "eventId");
    } else if (request.mode !== "resume" && request.mode !== "inspect") {
      return rejectCoverage("invalid_coverage_delivery_request");
    }
  } else return rejectCoverage("invalid_coverage_delivery_request");
  if (Object.keys(request).sort().join() !== keys.sort().join()) {
    return rejectCoverage("invalid_coverage_delivery_request");
  }
  return request;
};

type Incident = {caseId?: string; effectOperationId: string; state: string;
  mode: RecoveryTarget["mode"] | null; memberId?: string; eventId?: string;
  expectedAttemptId?: string; projectionOperationId?: string};

const hasInvalidEvidence = (error: unknown) =>
  (error instanceof ShiftPlanningError &&
    error.code === "invalid_planning_sync_command") ||
  (error instanceof ShiftPlanningDigestError &&
    error.code === "invalid_shift_planning_digest_input") ||
  (error instanceof HttpRequestError && [
    "coverage_effects_changed", "coverage_effects_missing",
    "coverage_effects_projection_changed", "coverage_effects_readback_required",
  ].includes(error.code));

const readCompletion = async (tx: Transaction, effect: DocumentSnapshot,
  environment: AppEnvironment) => {
  const record = effect.data();
  const value = record?.value as ShiftCoverageEffects | undefined;
  if (!value) return rejectCoverage("coverage_effects_missing");
  const {effectsDigest, ...core} = value;
  const receipt = await tx.get(effect.ref.firestore.doc(
    `${environment}/plus-collections/shiftCoverageOperations/${effect.id}`));
  if (value.environment !== environment || value.operationId !== effect.id ||
      value.schemaVersion !== 1 || value.action !== "complete" ||
      digest(core) !== effectsDigest || receipt.get("effectsDigest") !==
        effectsDigest || receipt.get("command.action") !== "complete" ||
      receipt.get("result.status") !== "completed" ||
      digest(receipt.get("result")) !== value.caseDigest) {
    return rejectCoverage("coverage_effects_changed");
  }
  return value;
};

const deliveryIncidents = async (
  db: Firestore, tx: Transaction, effect: DocumentSnapshot,
  value: ShiftCoverageEffects,
): Promise<Incident[]> => {
  const base = {effectOperationId: effect.id, caseId: value.caseId};
  const state = effect.get("state");
  if (state === "retired") return [];
  const projection = await readCoverageAcceptanceProjection(db, tx, value);
  const frozenProjection = projection.get("state") === "reconciliationRequired";
  if (frozenProjection || state === "reconciliationRequired") {
    return [{...base, state: "governedReconciliation", mode: null,
      projectionOperationId: frozenProjection ? projection.id : effect.id}];
  }
  // Historical completion could release the inbox before the acceptance batch.
  if (!isVerifiedCoverageProjection(projection)) {
    const verify = Boolean(projection.get("workbookSubmission.batch"));
    return [{...base, state: verify ? "projectionUnconfirmed" :
      "deliveryPending", mode: verify ? "inspect" : "resume"}];
  }
  if (state === "pending") {
    return [{...base, state: "deliveryPending", mode: "resume"}];
  }
  if (state !== "completed" || !Array.isArray(effect.get("deliveredTo"))) {
    return rejectCoverage("coverage_effects_changed");
  }
  const incidents: Incident[] = [];
  for (const id of effect.get("deliveredTo") as string[]) {
    const notification = value.notifications.find((item) => item.userId === id);
    if (!notification) return rejectCoverage("coverage_effects_changed");
    const eventId = notification.push.data.eventId;
    const target = {...base, memberId: id, eventId};
    const push = (await tx.get(effect.ref.collection("pushes").doc(id))).data();
    if (!push || isRetryableCoveragePush(push)) {
      const member = await tx.get(db.doc(
        `${value.environment}/plus-collections/users/${id}`));
      if (!member.exists || !coverageMember(member.data()).active) continue;
    }
    if (!push) {
      incidents.push({...target, state: "pushPending", mode: "resume"});
    } else if (push.eventId !== eventId) {
      return rejectCoverage("coverage_effects_changed");
    } else if (isRetryableCoveragePush(push)) {
      incidents.push({...target, state: "pushRejected", mode: "retryPush",
        expectedAttemptId: coverageId(push.attemptId)});
    } else if (!["accepted", "noTargets"].includes(push.state)) {
      incidents.push({...target, state: "pushUnconfirmed", mode: null});
    }
  }
  return incidents;
};

/**
 * Scope inspection to completed coverages and the linked administrator.
 * The cursor advances across successful deliveries as well as incidents.
 * Consumers receive the same session fence and revalidate it on each attempt.
 * @param {object} input Authenticated scope and server-owned delivery ports.
 * @return {Promise<object>} Sanitized incident page or recovery outcome.
 */
export const administerCoverageDelivery = async (input: {
  firestore: Firestore; context: ShiftCoverageStoreContext;
  identity: VerifiedIdentity; request: DeliveryRequest;
  delivery: CoverageDeliveryPort;
}) => {
  const {context, firestore: db, request} = input;
  const environment = context.environment;
  if (request.environment !== environment) {
    return rejectCoverage("invalid_coverage_environment");
  }
  const effects = db.collection(
    `${environment}/plus-collections/shiftCoverageEffects`);
  if (request.action === "deliveryIncidents") {
    return db.runTransaction(async (tx) => {
      await context.requireReady(tx);
      let query = effects.where("value.action", "==", "complete")
        .orderBy(FieldPath.documentId());
      if (request.after) query = query.startAfter(request.after);
      const page = await tx.get(query.limit(26));
      const incidents: Incident[] = [];
      for (const effect of page.docs.slice(0, 25)) {
        try {
          const value = await readCompletion(tx, effect, environment);
          incidents.push(...await deliveryIncidents(db, tx, effect, value));
        } catch (error) {
          if (!hasInvalidEvidence(error)) throw error;
          incidents.push({effectOperationId: effect.id,
            state: "invalidEvidence", mode: null});
        }
      }
      return {schemaVersion: 1, environment, incidents,
        nextCursor: page.size > 25 ? page.docs[24].id : null};
    });
  }
  const mode = request.mode;
  const effectOperationId = request.effectOperationId;
  const alreadyCompleted = await db.runTransaction(async (tx) => {
    await context.requireReady(tx);
    const effect = await tx.get(effects.doc(effectOperationId));
    const value = await readCompletion(tx, effect, environment);
    if (request.mode === "retryPush") {
      // Pass an exact replay through even if the new receipt already succeeded.
      if (effect.get("state") !== "completed" ||
          !effect.get("deliveredTo")?.includes(request.memberId) ||
          !value.notifications.some((item) =>
            item.userId === request.memberId &&
            item.push.data.eventId === request.eventId)) {
        return rejectCoverage("coverage_delivery_target_changed");
      }
      return false;
    }
    const incidents = await deliveryIncidents(db, tx, effect, value);
    if (incidents.some((incident) => incident.mode === mode)) return false;
    if (effect.get("state") === "completed" && !incidents.length) return true;
    return rejectCoverage("coverage_delivery_state_changed");
  });
  const base = {schemaVersion: 1, environment, effectOperationId, mode};
  if (alreadyCompleted) return {...base, state: "completed", replayed: true};
  if (request.mode === "retryPush") {
    const result = await input.delivery.retryRejected({
      memberId: request.memberId, eventId: request.eventId,
      expectedAttemptId: request.expectedAttemptId,
      operationId: request.operationId}, input.identity);
    return {...base, state: result.state, replayed: result.replayed};
  }
  const result = request.mode === "inspect" ?
    await input.delivery.inspect(effectOperationId) :
    await input.delivery.drain(effectOperationId);
  return {...base, state: result.state};
};
