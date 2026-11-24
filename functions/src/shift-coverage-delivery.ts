import type {Firestore, Transaction} from "@google-cloud/firestore";
import {type AppEnvironment, HttpRequestError} from "./backend-security.js";
import {readShiftCoverageActivation} from "./shift-coverage-activation.js";
import type {ShiftCoverageEffects} from "./shift-coverage-effects.js";
import type {createFirestoreShiftCoverageEffectsWorker} from
  "./shift-coverage-effects-worker.js";
import type {createFirestoreShiftCoveragePushDispatcher} from
  "./shift-coverage-push.js";
import type {ShiftCoverageStoreContext} from
  "./shift-coverage-store-context.js";
import {coverageId, rejectCoverage} from "./shift-coverage.js";
import {captureShiftPlanningWriterAuthority} from
  "./shift-planning-writer-authority.js";

type Worker = ReturnType<typeof createFirestoreShiftCoverageEffectsWorker>;
type Push = ReturnType<typeof createFirestoreShiftCoveragePushDispatcher>;

/**
 * Each inbox creation wakes its own push worker. An administrator resuming an
 * older operation can also visit the released recipients: both routes share
 * the same per-recipient receipt and recheck their current account binding.
 * @param {object} input Owned clients, scope and consumer factories.
 * @return {object} Delivery actions for the private triggers and admin API.
 */
export const createFirestoreShiftCoverageDelivery = (input: {
  firestore: Firestore; context: ShiftCoverageStoreContext;
  sheetsWorker: () => Worker; push: Push;
}) => {
  const {firestore, context, push} = input;
  const root = `${context.environment}/plus-collections`;
  return {
    project: (id: string) => input.sheetsWorker().drain(id),
    submit: push.submit,
    inspect: (id: string) => input.sheetsWorker().inspect(id),
    retryRejected: push.retryRejected,
    async drain(operationId: string) {
      const id = coverageId(operationId);
      const projected = await input.sheetsWorker().drain(id);
      if (projected.state !== "completed") return projected;
      const recipients = await firestore.runTransaction(async (tx) => {
        await context.requireReady(tx);
        const effect = (await tx.get(firestore.doc(
          `${root}/shiftCoverageEffects/${id}`))).data();
        const value = effect?.value as ShiftCoverageEffects | undefined;
        if (effect?.state !== "completed" || value?.operationId !== id ||
            value.environment !== context.environment ||
            !Array.isArray(effect.deliveredTo)) {
          return rejectCoverage("coverage_effects_changed");
        }
        return value.notifications.filter((notice) =>
          effect.deliveredTo.includes(notice.userId));
      });
      // One member may have been deactivated since the inbox release. Each
      // remaining member can still receive their own outstanding notice.
      const results = await Promise.allSettled(recipients.map((notice) =>
        push.submit(notice.userId, notice.push.data.eventId)));
      const states = new Set<string>();
      for (const result of results) {
        if (result.status === "fulfilled") states.add(result.value.state);
        else if (!(result.reason instanceof HttpRequestError &&
            result.reason.code === "coverage_push_stale")) {
          throw result.reason;
        }
      }
      return {state: ["unknown", "submitting", "failed"].find((state) =>
        states.has(state)) ?? "completed"};
    },
  };
};

type Event = {kind: "effect"; environment: string; operationId: string} |
  {kind: "inbox"; environment: string; memberId: string; eventId: string;
    coverageOperationId: unknown};

/**
 * Take the identity from the Firestore event path. Recheck the private policy
 * and bootstrap in every worker transaction, including the last admission
 * before external I/O. Durable receipts determine what redelivery may do.
 * @param {object} input Server-owned environment configuration and ports.
 * @return {Function} Handler shared by both Firestore creation events.
 */
export const createShiftCoverageDeliveryEventHandler = (input: {
  firestore: Firestore; operationalReady(environment: AppEnvironment): boolean;
  participants?: ReadonlySet<string>;
  deliveryFor(context: ShiftCoverageStoreContext):
    Pick<ReturnType<typeof createFirestoreShiftCoverageDelivery>,
      "project" | "submit">;
}) => async (event: Event) => {
  const environment = event.environment;
  if ((environment !== "develop" && environment !== "production") ||
      !input.operationalReady(environment)) return;
  if (event.kind === "inbox" && (typeof event.coverageOperationId !==
      "string" || !event.eventId.startsWith("coverage-"))) return;

  const readActivation = async (tx: Transaction) => {
    const state = await tx.get(input.firestore.doc(
      `${environment}/plus-collections/shiftPlanningState/current`));
    const authority = captureShiftPlanningWriterAuthority(state.data());
    if (!authority?.activeRevision || !authority.activeDigest) return null;
    return readShiftCoverageActivation(input.firestore, tx, environment);
  };
  try {
    const activation = await input.firestore.runTransaction(readActivation);
    if (!activation) return;
    const delivery = input.deliveryFor({environment,
      participants: input.participants,
      requireReady: async (tx) => {
        if ((await readActivation(tx))?.digest !== activation.digest) {
          return rejectCoverage("coverage_unavailable");
        }
      }});
    if (event.kind === "inbox") {
      await delivery.submit(event.memberId, event.eventId);
      return;
    }
    const result = await delivery.project(event.operationId);
    if (result.state === "pending") {
      throw new Error("Coverage projection is awaiting its workbook lease.");
    }
  } catch (error) {
    // A delayed event can arrive after a newer case revision or offer expiry.
    if (error instanceof HttpRequestError && [
      "coverage_effects_superseded", "coverage_effects_expired",
      "coverage_effects_retired", "coverage_push_stale",
      "coverage_participant_out_of_scope",
    ].includes(error.code)) return;
    // Eventarc retains the error. Provider exceptions can include tokens,
    // workbook data or a complete SDK request.
    throw new Error(error instanceof HttpRequestError ?
      error.code : "coverage_delivery_retry");
  }
};
