import type {
  createFirestoreShiftPlanningNotificationReleaseRepository,
} from "./shift-planning-firestore-notification-release-repository.js";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import type {
  ShiftPlanningNotificationDispatchExecutionResult,
  createShiftPlanningNotificationDispatchExecutor,
} from "./shift-planning-notification-dispatch-executor.js";
import type {ShiftPlanningEnvironment} from "./shift-planning-wire.js";

type ShiftPlanningNotificationReleaseRepository = Pick<
  ReturnType<
    typeof createFirestoreShiftPlanningNotificationReleaseRepository
  >,
  "release"
>;

type ShiftPlanningNotificationDispatchExecutor = ReturnType<
  typeof createShiftPlanningNotificationDispatchExecutor
>;

export type ShiftPlanningNotificationReleaseDispatchResult = {
  releaseKind: "committed" | "replayed";
  dispatch: ShiftPlanningNotificationDispatchExecutionResult;
};

const failExecution = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_transaction", message);
};

const requireEnvironment = (value: unknown): ShiftPlanningEnvironment => {
  if (value !== "develop" && value !== "production") {
    return failExecution("Notification execution environment is invalid.");
  }
  return value;
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failExecution(`${name} is not a valid identifier.`);
  }
  return value;
};

/**
 * Composes the idempotent canonical release with exactly one governed dispatch
 * attempt. The complete command is validated before release so caller mistakes
 * cannot create a canonical event that has no executable attempt identity.
 * @param {object} dependencies Release repository and bounded dispatcher.
 * @return {object} One local, non-exported release-dispatch executor.
 */
export const createShiftPlanningNotificationReleaseDispatchExecutor = (
  dependencies: {
    releaseRepository: ShiftPlanningNotificationReleaseRepository;
    dispatchExecutor: ShiftPlanningNotificationDispatchExecutor;
  },
) => ({
  async execute(input: {
    environment: ShiftPlanningEnvironment;
    intentId: string;
    workerId: string;
    attemptId: string;
  }): Promise<ShiftPlanningNotificationReleaseDispatchResult> {
    const environment = requireEnvironment(input.environment);
    const intentId = requireIdentifier(
      input.intentId,
      "notification intentId",
    );
    const workerId = requireIdentifier(
      input.workerId,
      "notification workerId",
    );
    const attemptId = requireIdentifier(
      input.attemptId,
      "notification attemptId",
    );
    const release = await dependencies.releaseRepository.release({
      environment,
      intentId,
    });
    if (release.artifacts.eventId !== intentId) {
      return failExecution("Notification release returned another event.");
    }
    const dispatch = await dependencies.dispatchExecutor.execute({
      environment,
      intentId,
      workerId,
      attemptId,
    });
    return {releaseKind: release.kind, dispatch};
  },
});
