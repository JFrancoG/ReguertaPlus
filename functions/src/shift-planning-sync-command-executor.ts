import {
  ShiftPlanningCompletedSyncCommand,
  ShiftPlanningProcessingSyncCommand,
  ShiftPlanningSyncCommandRepository,
  ShiftPlanningSyncReadBackEvidence,
} from "./shift-planning-sync-command.js";
import {ShiftPlanningEnvironment} from "./shift-planning-wire.js";
import {ShiftPlanningError} from "./shift-planning-contract.js";

export type ShiftPlanningSheetsConsumerResult =
  | ShiftPlanningSyncReadBackEvidence
  | {kind: "reconciliationRequired"};

export type ShiftPlanningSheetsSyncConsumer = {
  /** Consumers must call authorizeMutation immediately before every batch. */
  apply(
    command: ShiftPlanningProcessingSyncCommand,
    authorizeMutation: () => Promise<void>,
  ): Promise<ShiftPlanningSheetsConsumerResult>;
  inspect?(
    command: ShiftPlanningProcessingSyncCommand,
  ): Promise<ShiftPlanningSheetsConsumerResult>;
};

export type ShiftPlanningSyncExecutionResult =
  | {
    kind: "completed" | "terminalReplay";
    command: ShiftPlanningCompletedSyncCommand;
  }
  | {
    kind: "reconciliationRequired";
    commandId: string;
  }
  | {
    kind: "busy";
    retryAtMillis: number;
  };

/**
 * Executes one explicitly invoked sync command without relying on create-event
 * delivery. The repository fences the claim immediately before the external
 * batch, including later batches, and persists completion only after read-back.
 * This hook does not itself make external retries safe: the consumer must
 * persist submission intent and reconcile unknown calls.
 * A thrown or ambiguous consumer result leaves the lease retained.
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
  let evidence: ShiftPlanningSheetsConsumerResult;
  if (claim.kind === "reconcile") {
    if (!input.consumer.inspect) {
      throw new ShiftPlanningError("invalid_planning_sync_command",
        "Submitted Sheets work requires a read-only consumer.");
    }
    evidence = await input.consumer.inspect(claim.command);
  } else {
    const authorized = await input.repository.authorizeBatch(claim.token);
    evidence = await input.consumer.apply(authorized, async () => {
      await input.repository.authorizeBatch(claim.token);
    });
  }
  if ("kind" in evidence) {
    return {kind: "reconciliationRequired", commandId: claim.command.commandId};
  }
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
 * task, or deploy-time event cannot strand a command. Busy or uncertain work
 * stops this drain before another command can compete for workbook authority.
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
    const result = results[results.length - 1];
    if (result.kind === "busy" || result.kind === "reconciliationRequired") {
      break;
    }
  }
  return results;
};
