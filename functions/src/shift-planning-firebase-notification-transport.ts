import type {BatchResponse, Messaging} from "firebase-admin/messaging";
import {
  ShiftPlanningGenericPush,
} from "./shift-planning-notification-dispatch.js";

export type ShiftPlanningNotificationTransportRequest = {
  push: ShiftPlanningGenericPush;
  targets: {
    firebaseInstallationIds: readonly string[];
    fcmTokens: readonly string[];
  };
};

export type ShiftPlanningNotificationTransportResult =
  | {outcome: "accepted"; acceptedTargetCount: number}
  | {outcome: "failed" | "unknown"; failureCode: string};

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

const responseCountsAreExact = (
  response: BatchResponse,
  expectedCount: number,
): boolean => response.responses.length === expectedCount &&
  response.successCount + response.failureCount === expectedCount &&
  response.responses.filter(({success}) => success).length ===
    response.successCount;

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
 * @return {ShiftPlanningNotificationTransport} Generic bounded-call adapter.
 */
export const createFirebaseShiftPlanningNotificationTransport = (
  messaging: Pick<Messaging, "sendEachForMulticast">,
): ShiftPlanningNotificationTransport => ({
  async submit(request): Promise<ShiftPlanningNotificationTransportResult> {
    let acceptedTargetCount = 0;
    try {
      for (const tokenChunk of chunks(
        request.targets.fcmTokens,
        MAX_MULTICAST_TARGETS,
      )) {
        const response = await messaging.sendEachForMulticast({
          ...baseMessage(request.push),
          tokens: tokenChunk,
        });
        if (!responseCountsAreExact(response, tokenChunk.length)) {
          return ambiguousOrAccepted(
            acceptedTargetCount,
            "transport_response_mismatch",
          );
        }
        acceptedTargetCount += response.successCount;
      }
      for (const fidChunk of chunks(
        request.targets.firebaseInstallationIds,
        MAX_MULTICAST_TARGETS,
      )) {
        const response = await messaging.sendEachForMulticast({
          ...baseMessage(request.push),
          fids: fidChunk,
        });
        if (!responseCountsAreExact(response, fidChunk.length)) {
          return ambiguousOrAccepted(
            acceptedTargetCount,
            "transport_response_mismatch",
          );
        }
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
      {outcome: "failed", failureCode: "all_targets_rejected"};
  },
});
