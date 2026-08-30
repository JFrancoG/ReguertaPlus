import {
  ShiftPlanningCompletedSyncCommand,
  ShiftPlanningProcessingSyncCommand,
  ShiftPlanningSyncCommandRepository,
  ShiftPlanningSyncReadBackEvidence,
} from "./shift-planning-sync-command.js";
import {ShiftPlanningEnvironment} from "./shift-planning-wire.js";

export type ShiftPlanningSheetsSyncConsumer = {
  apply(
    command: ShiftPlanningProcessingSyncCommand,
  ): Promise<ShiftPlanningSyncReadBackEvidence>;
};

export type ShiftPlanningSyncExecutionResult =
  | {
    kind: "completed" | "terminalReplay";
    command: ShiftPlanningCompletedSyncCommand;
  }
  | {
    kind: "busy";
    retryAtMillis: number;
  };

/**
 * Executes one explicitly invoked sync command without relying on create-event
 * delivery. The repository fences the claim immediately before the external
 * batch and persists completion only after the consumer supplies read-back
 * evidence. A thrown or ambiguous consumer result leaves the lease retained.
 * @param {object} input Repository, worker identity, and external consumer.
 * @return {ShiftPlanningSyncExecutionResult} Terminal or retryable result.
 */
export const executeShiftPlanningSyncCommand = async (input: {
  repository: ShiftPlanningSyncCommandRepository;
  consumer: ShiftPlanningSheetsSyncConsumer;
  environment: ShiftPlanningEnvironment;
  commandId: string;
  workerId: string;
  attemptId: string;
}): Promise<ShiftPlanningSyncExecutionResult> => {
  const claim = await input.repository.claim({
    environment: input.environment,
    commandId: input.commandId,
    workerId: input.workerId,
    attemptId: input.attemptId,
  });
  if (claim.kind === "busy") {
    return {kind: "busy", retryAtMillis: claim.retryAt.toMillis()};
  }
  if (claim.kind === "terminalReplay") {
    return {kind: "terminalReplay", command: claim.command};
  }
  const authorized = await input.repository.authorizeBatch(claim.token);
  const evidence = await input.consumer.apply(authorized);
  const completion = await input.repository.complete({
    token: claim.token,
    evidence,
  });
  return {
    kind: completion.kind === "committed" ? "completed" : "terminalReplay",
    command: completion.command,
  };
};

/**
 * Polls a bounded runnable set and executes it in stable command-ID order.
 * Every invocation rediscovers pending or expired work, so a missed scheduler,
 * task, or deploy-time event cannot strand a command.
 * @param {object} input Bounded poll plus deterministic attempt-ID factory.
 * @return {ShiftPlanningSyncExecutionResult[]} Results for discovered commands.
 */
export const drainShiftPlanningSyncCommands = async (input: {
  repository: ShiftPlanningSyncCommandRepository;
  consumer: ShiftPlanningSheetsSyncConsumer;
  environment: ShiftPlanningEnvironment;
  workerId: string;
  limit: number;
  createAttemptId(commandId: string, index: number): string;
}): Promise<readonly ShiftPlanningSyncExecutionResult[]> => {
  const commandIds = await input.repository.discoverRunnable({
    environment: input.environment,
    limit: input.limit,
  });
  const results: ShiftPlanningSyncExecutionResult[] = [];
  for (const [index, commandId] of commandIds.entries()) {
    results.push(await executeShiftPlanningSyncCommand({
      repository: input.repository,
      consumer: input.consumer,
      environment: input.environment,
      commandId,
      workerId: input.workerId,
      attemptId: input.createAttemptId(commandId, index),
    }));
  }
  return results;
};
