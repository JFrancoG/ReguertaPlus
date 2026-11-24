import type {BatchResponse, Messaging} from "firebase-admin/messaging";
import {
  ShiftPlanningGenericPush,
} from "./shift-planning-notification-dispatch.js";

export type ShiftPlanningNotificationTransportRequest = {
  submissionWindow: {
    signal: AbortSignal;
    expiresAtMillis: number;
  };
  push: ShiftPlanningGenericPush;
  targets: {
    firebaseInstallationIds: readonly string[];
    fcmTokens: readonly string[];
  };
};

export type ShiftPlanningNotificationTransportResult =
  | {outcome: "accepted"; acceptedTargetCount: number}
  | {outcome: "failed"; failureCode: string; rejectionConfirmed?: true}
  | {outcome: "unknown"; failureCode: string};

export type ShiftPlanningNotificationTransport = {
  submit(
    request: ShiftPlanningNotificationTransportRequest,
  ): Promise<ShiftPlanningNotificationTransportResult>;
};

const MAX_MULTICAST_TARGETS = 500;

const chunks = <Value>(
  values: readonly Value[],
  maximumSize: number,
): Value[][] => {
  const result: Value[][] = [];
  for (let index = 0; index < values.length; index += maximumSize) {
    result.push(values.slice(index, index + maximumSize));
  }
  return result;
};

const batchProblem = (
  response: BatchResponse, expectedCount: number,
  confirmsRejection?: (code: string) => boolean,
): string | null => {
  if (response.responses.length !== expectedCount ||
      response.successCount + response.failureCount !== expectedCount ||
      response.responses.filter(({success}) => success).length !==
        response.successCount) return "transport_response_mismatch";
  if (response.successCount === 0 && confirmsRejection &&
      response.responses.some((item) => !confirmsRejection(
        item.error?.code ?? ""))) return "transport_ambiguous_error";
  return null;
};

const baseMessage = (push: ShiftPlanningGenericPush) => ({
  notification: {...push.notification},
  data: {...push.data},
  android: {collapseKey: push.collapseKey},
  apns: {headers: {"apns-collapse-id": push.collapseKey}},
});

const ambiguousOrAccepted = (
  acceptedTargetCount: number,
  failureCode: string,
): ShiftPlanningNotificationTransportResult => acceptedTargetCount > 0 ?
  {outcome: "accepted", acceptedTargetCount} :
  {outcome: "unknown", failureCode};

/**
 * Creates the Firebase transport without wiring it to an exported trigger.
 * A thrown Admin SDK call is conservatively ambiguous because authenticated
 * submission has already begun and its acknowledgement may be unavailable.
 * @param {Messaging} messaging Injected modular Firebase Messaging client.
 * @param {Function} nowMillis Clock checked before each new SDK submission.
 * @param {Function} confirmsRejection Classify all-failed batches for retries.
 * @return {ShiftPlanningNotificationTransport} Generic bounded-call adapter.
 */
export const createFirebaseShiftPlanningNotificationTransport = (
  messaging: Pick<Messaging, "sendEachForMulticast">,
  nowMillis: () => number = Date.now,
  confirmsRejection?: (code: string) => boolean,
): ShiftPlanningNotificationTransport => ({
  async submit(request): Promise<ShiftPlanningNotificationTransportResult> {
    let acceptedTargetCount = 0;
    const mayStartSubmission = () => {
      const now = nowMillis();
      return !request.submissionWindow.signal.aborted &&
        Number.isSafeInteger(now) &&
        Number.isSafeInteger(request.submissionWindow.expiresAtMillis) &&
        now < request.submissionWindow.expiresAtMillis;
    };
    try {
      for (const tokenChunk of chunks(
        request.targets.fcmTokens,
        MAX_MULTICAST_TARGETS,
      )) {
        if (!mayStartSubmission()) {
          return ambiguousOrAccepted(
            acceptedTargetCount, "transport_window_closed",
          );
        }
        const response = await messaging.sendEachForMulticast({
          ...baseMessage(request.push),
          tokens: tokenChunk,
        });
        const problem = batchProblem(response, tokenChunk.length,
          confirmsRejection);
        if (problem) return ambiguousOrAccepted(acceptedTargetCount, problem);
        acceptedTargetCount += response.successCount;
      }
      for (const fidChunk of chunks(
        request.targets.firebaseInstallationIds,
        MAX_MULTICAST_TARGETS,
      )) {
        if (!mayStartSubmission()) {
          return ambiguousOrAccepted(
            acceptedTargetCount, "transport_window_closed",
          );
        }
        const response = await messaging.sendEachForMulticast({
          ...baseMessage(request.push),
          fids: fidChunk,
        });
        const problem = batchProblem(response, fidChunk.length,
          confirmsRejection);
        if (problem) return ambiguousOrAccepted(acceptedTargetCount, problem);
        acceptedTargetCount += response.successCount;
      }
    } catch {
      return ambiguousOrAccepted(
        acceptedTargetCount,
        "transport_ambiguous_error",
      );
    }
    return acceptedTargetCount > 0 ?
      {outcome: "accepted", acceptedTargetCount} :
      {outcome: "failed", failureCode: "all_targets_rejected",
        ...(confirmsRejection ? {rejectionConfirmed: true as const} : {})};
  },
});
