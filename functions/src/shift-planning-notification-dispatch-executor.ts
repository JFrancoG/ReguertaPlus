import type {
  createFirestoreShiftPlanningNotificationDispatchRepository,
} from "./shift-planning-firestore-notification-dispatch-repository.js";
import type {
  ShiftPlanningNotificationTransport,
  ShiftPlanningNotificationTransportResult,
} from "./shift-planning-firebase-notification-transport.js";
import type {
  ShiftPlanningTerminalNotificationDispatchAttempt,
} from "./shift-planning-notification-dispatch.js";
import type {ShiftPlanningEnvironment} from "./shift-planning-wire.js";

export const SHIFT_PLANNING_NOTIFICATION_TRANSPORT_TIMEOUT_MILLIS =
  10_000 as const;

type ShiftPlanningNotificationDispatchRepository = ReturnType<
  typeof createFirestoreShiftPlanningNotificationDispatchRepository
>;

export type ShiftPlanningNotificationDispatchExecutionResult =
  | {kind: "busy"; retryAtMillis: number}
  | {
    kind: "completed" | "terminalReplay";
    attempt: ShiftPlanningTerminalNotificationDispatchAttempt;
  };

type TransportSettlement =
  | {kind: "fulfilled"; result: unknown}
  | {kind: "rejected"}
  | {kind: "timeout"};

const transportFailureCodes = new Set([
  "all_targets_rejected",
  "transport_ambiguous_error",
  "transport_response_mismatch",
]);

const boundedTransportSettlement = async (
  operation: () => Promise<ShiftPlanningNotificationTransportResult>,
  timeoutMillis: number,
): Promise<TransportSettlement> => {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<TransportSettlement>((resolve) => {
    timeoutHandle = setTimeout(() => resolve({kind: "timeout"}), timeoutMillis);
  });
  const transport: Promise<TransportSettlement> = Promise.resolve()
    .then(operation)
    .then(
      (result): TransportSettlement => ({kind: "fulfilled", result}),
      (): TransportSettlement => ({kind: "rejected"}),
    );
  try {
    return await Promise.race([transport, timeout]);
  } finally {
    if (timeoutHandle !== null) clearTimeout(timeoutHandle);
  }
};

const normalizeTransportResult = (
  value: unknown,
  targetCount: number,
): ShiftPlanningNotificationTransportResult => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {outcome: "unknown", failureCode: "transport_response_invalid"};
  }
  const result = value as Record<string, unknown>;
  const fields = Object.keys(result);
  if (
    result.outcome === "accepted" &&
    fields.length === 2 &&
    fields.includes("acceptedTargetCount") &&
    Number.isSafeInteger(result.acceptedTargetCount) &&
    (result.acceptedTargetCount as number) > 0 &&
    (result.acceptedTargetCount as number) <= targetCount
  ) {
    return {
      outcome: "accepted",
      acceptedTargetCount: result.acceptedTargetCount as number,
    };
  }
  if (
    (result.outcome === "failed" || result.outcome === "unknown") &&
    fields.length === 2 &&
    fields.includes("failureCode") &&
    typeof result.failureCode === "string" &&
    transportFailureCodes.has(result.failureCode)
  ) {
    return {outcome: result.outcome, failureCode: result.failureCode};
  }
  return {outcome: "unknown", failureCode: "transport_response_invalid"};
};

const executionCompletion = (completion: {
  kind: "committed" | "terminalReplay";
  attempt: ShiftPlanningTerminalNotificationDispatchAttempt;
}): ShiftPlanningNotificationDispatchExecutionResult => ({
  kind: completion.kind === "committed" ? "completed" : "terminalReplay",
  attempt: completion.attempt,
});

/**
 * Executes one dispatch attempt inside its persisted lease and bounded network
 * window. Timeout only bounds the caller wait; it cannot retract an
 * authenticated FCM submission, so every ambiguous path is possibly delivered.
 * @param {object} dependencies Repository, transport, clock, and timeout.
 * @return {object} One explicit attempt executor.
 */
export const createShiftPlanningNotificationDispatchExecutor = (dependencies: {
  repository: ShiftPlanningNotificationDispatchRepository;
  transport: ShiftPlanningNotificationTransport;
  nowMillis?: () => number;
  transportTimeoutMillis?: number;
}) => {
  const nowMillis = dependencies.nowMillis ?? Date.now;
  const transportTimeoutMillis = dependencies.transportTimeoutMillis ??
    SHIFT_PLANNING_NOTIFICATION_TRANSPORT_TIMEOUT_MILLIS;
  if (
    !Number.isSafeInteger(transportTimeoutMillis) ||
    transportTimeoutMillis <= 0 ||
    transportTimeoutMillis >
      SHIFT_PLANNING_NOTIFICATION_TRANSPORT_TIMEOUT_MILLIS
  ) {
    throw new Error("Notification transport timeout is outside policy.");
  }
  return {
    async execute(input: {
      environment: ShiftPlanningEnvironment;
      intentId: string;
      workerId: string;
      attemptId: string;
    }): Promise<ShiftPlanningNotificationDispatchExecutionResult> {
      const claim = await dependencies.repository.claim(input);
      if (claim.kind === "busy") {
        return {kind: "busy", retryAtMillis: claim.retryAt.toMillis()};
      }
      if (claim.kind === "terminalReplay") return claim;
      if (claim.attempt.validation.messagingTargetCount === 0) {
        const completion = await dependencies.repository.failBeforeSubmission({
          environment: input.environment,
          token: claim.token,
          failureCode: "no_destination",
        });
        return executionCompletion(completion);
      }
      const authorization = await dependencies.repository
        .authorizeAuthenticatedSubmission({
          environment: input.environment,
          token: claim.token,
        });
      const targetCount =
        authorization.targets.firebaseInstallationIds.length +
        authorization.targets.fcmTokens.length;
      const observedNowMillis = nowMillis();
      const remainingLeaseMillis = authorization.token.leaseExpiresAtMillis -
        observedNowMillis;
      if (
        !Number.isSafeInteger(observedNowMillis) ||
        remainingLeaseMillis <= 0
      ) {
        const completion = await dependencies.repository.completeSubmission({
          environment: input.environment,
          token: authorization.token,
          result: {
            outcome: "unknown",
            failureCode: "lease_budget_exhausted",
          },
        });
        return executionCompletion(completion);
      }
      const settlement = await boundedTransportSettlement(
        () => dependencies.transport.submit({
          push: authorization.push,
          targets: authorization.targets,
        }),
        Math.min(transportTimeoutMillis, remainingLeaseMillis),
      );
      let result: ShiftPlanningNotificationTransportResult;
      if (settlement.kind === "timeout") {
        result = {outcome: "unknown", failureCode: "transport_timeout"};
      } else if (settlement.kind === "rejected") {
        result = {
          outcome: "unknown",
          failureCode: "transport_ambiguous_error",
        };
      } else {
        result = normalizeTransportResult(settlement.result, targetCount);
      }
      const completion = await dependencies.repository.completeSubmission({
        environment: input.environment,
        token: authorization.token,
        result,
      });
      return executionCompletion(completion);
    },
  };
};
