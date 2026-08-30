import {Timestamp} from "@google-cloud/firestore";
import {ShiftPlanningSyncCommand} from "./shift-planning-bundle.js";
import {
  ShiftPlanningError,
  ShiftRotationType,
} from "./shift-planning-contract.js";
import {createShiftPlanningDigest} from "./shift-planning-digest.js";
import {ShiftPlanningEnvironment} from "./shift-planning-wire.js";

export const SHIFT_PLANNING_SYNC_COMMAND_SCHEMA_VERSION = 1 as const;

type UnknownRecord = Record<string, unknown>;

export type ShiftPlanningSyncCommandClaim = {
  workerId: string;
  attemptId: string;
  fencingEpoch: number;
  acquiredAt: Timestamp;
  expiresAt: Timestamp;
};

export type ShiftPlanningSyncCommandTerminal = {
  workerId: string;
  attemptId: string;
  fencingEpoch: number;
  acquiredAt: Timestamp;
  expiresAt: Timestamp;
  completedAt: Timestamp;
  readBackWorkbookRevision: string;
  readBackPartitionDigest: string;
};

export type ShiftPlanningProcessingSyncCommand = Omit<
  ShiftPlanningSyncCommand,
  "state"
> & {
  state: "processing";
  commandDigest: string;
  claim: ShiftPlanningSyncCommandClaim;
};

export type ShiftPlanningCompletedSyncCommand = Omit<
  ShiftPlanningSyncCommand,
  "state"
> & {
  state: "completed";
  commandDigest: string;
  terminal: ShiftPlanningSyncCommandTerminal;
};

export type ShiftPlanningPersistedSyncCommand =
  | ShiftPlanningSyncCommand
  | ShiftPlanningProcessingSyncCommand
  | ShiftPlanningCompletedSyncCommand;

export type ShiftPlanningSyncCommandToken = {
  environment: ShiftPlanningEnvironment;
  commandId: string;
  commandDigest: string;
  workerId: string;
  attemptId: string;
  fencingEpoch: number;
};

export type ShiftPlanningSyncReadBackEvidence = {
  workbookRevision: string;
  partitionDigest: string;
};

export type ShiftPlanningSyncCommandClaimResult =
  | {
    kind: "claimed" | "replayed";
    command: ShiftPlanningProcessingSyncCommand;
    token: ShiftPlanningSyncCommandToken;
  }
  | {
    kind: "busy";
    retryAt: Timestamp;
  }
  | {
    kind: "terminalReplay";
    command: ShiftPlanningCompletedSyncCommand;
  };

export type ShiftPlanningSyncCommandCompletionResult = {
  kind: "committed" | "replayed";
  command: ShiftPlanningCompletedSyncCommand;
};

export interface ShiftPlanningSyncCommandRepository {
  discoverRunnable(input: {
    environment: ShiftPlanningEnvironment;
    limit: number;
  }): Promise<readonly string[]>;

  claim(input: {
    environment: ShiftPlanningEnvironment;
    commandId: string;
    workerId: string;
    attemptId: string;
  }): Promise<ShiftPlanningSyncCommandClaimResult>;

  authorizeBatch(
    token: ShiftPlanningSyncCommandToken,
  ): Promise<ShiftPlanningProcessingSyncCommand>;

  complete(input: {
    token: ShiftPlanningSyncCommandToken;
    evidence: ShiftPlanningSyncReadBackEvidence;
  }): Promise<ShiftPlanningSyncCommandCompletionResult>;
}

const immutableFields = [
  "schemaVersion",
  "operationKind",
  "commandId",
  "idempotencyKey",
  "type",
  "bundleRevision",
  "bundleDigest",
  "writeEpoch",
  "workbookId",
  "workbookRevision",
  "partitionKey",
  "expectedPartitionStateRevision",
  "expectedPartitionEpoch",
  "commandPartitionEpoch",
  "expectedCurrentLease",
  "leaseIntent",
  "expectedActiveRevision",
  "expectedActiveDigest",
  "targetSeasonStartYear",
  "affectedProjectionSeasonStartYears",
] as const;

const pendingFields = [...immutableFields, "state"] as const;
const processingFields = [
  ...immutableFields,
  "state",
  "commandDigest",
  "claim",
] as const;
const completedFields = [
  ...immutableFields,
  "state",
  "commandDigest",
  "terminal",
] as const;

const claimFields = [
  "workerId",
  "attemptId",
  "fencingEpoch",
  "acquiredAt",
  "expiresAt",
] as const;

const terminalFields = [
  ...claimFields,
  "completedAt",
  "readBackWorkbookRevision",
  "readBackPartitionDigest",
] as const;

const leaseIntentFields = [
  "ownerOperationId",
  "leaseEpoch",
  "state",
  "durationMillis",
] as const;

const failSync = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_sync_command", message);
};

const requireRecord = (value: unknown, name: string): UnknownRecord => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    (
      Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null
    )
  ) {
    return failSync(`${name} must be a plain object.`);
  }
  return value as UnknownRecord;
};

const requireExactFields = (
  value: UnknownRecord,
  fields: readonly string[],
  name: string,
): void => {
  const actual = Object.keys(value);
  if (
    actual.length !== fields.length ||
    actual.some((field) => !fields.includes(field))
  ) {
    failSync(`${name} fields are not exact.`);
  }
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failSync(`${name} is not a valid identifier.`);
  }
  return value;
};

const requireDigest = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return failSync(`${name} is not a planning digest.`);
  }
  return value;
};

const requireNonNegativeInteger = (value: unknown, name: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return failSync(`${name} must be a non-negative safe integer.`);
  }
  return value as number;
};

const requirePositiveInteger = (value: unknown, name: string): number => {
  const parsed = requireNonNegativeInteger(value, name);
  if (parsed < 1) return failSync(`${name} must be positive.`);
  return parsed;
};

const requireTimestamp = (value: unknown, name: string): Timestamp => {
  if (!(value instanceof Timestamp)) {
    return failSync(`${name} must be a Firestore Timestamp.`);
  }
  return value;
};

const requireSeasonYears = (
  value: unknown,
  targetSeasonStartYear: number,
): readonly number[] => {
  if (!Array.isArray(value) || value.length === 0) {
    return failSync("Affected projection seasons must not be empty.");
  }
  const years = value.map((year, index) =>
    requirePositiveInteger(year, `affected season ${index + 1}`));
  if (
    new Set(years).size !== years.length ||
    years.some((year, index) => index > 0 && years[index - 1] >= year) ||
    !years.includes(targetSeasonStartYear)
  ) {
    return failSync("Affected projection seasons are not canonical.");
  }
  return years;
};

const parseImmutableCommand = (
  command: UnknownRecord,
): Omit<ShiftPlanningSyncCommand, "state"> => {
  if (
    command.schemaVersion !== SHIFT_PLANNING_SYNC_COMMAND_SCHEMA_VERSION ||
    command.operationKind !== "sheetsSync" ||
    (command.type !== "delivery" && command.type !== "market") ||
    command.expectedCurrentLease !== null
  ) {
    return failSync("Sync command discriminator is invalid.");
  }
  const type: ShiftRotationType = command.type;
  const bundleRevision = requireIdentifier(
    command.bundleRevision,
    "sync bundleRevision",
  );
  const bundleDigest = requireDigest(
    command.bundleDigest,
    "sync bundleDigest",
  );
  const expectedPartitionEpoch = requireNonNegativeInteger(
    command.expectedPartitionEpoch,
    "sync expectedPartitionEpoch",
  );
  const commandPartitionEpoch = requirePositiveInteger(
    command.commandPartitionEpoch,
    "sync commandPartitionEpoch",
  );
  const leaseIntent = requireRecord(command.leaseIntent, "sync leaseIntent");
  requireExactFields(leaseIntent, leaseIntentFields, "sync leaseIntent");
  const durationMillis = requirePositiveInteger(
    leaseIntent.durationMillis,
    "sync lease duration",
  );
  if (leaseIntent.state !== "claimed") {
    return failSync("Sync lease intent state is invalid.");
  }
  const targetSeasonStartYear = requirePositiveInteger(
    command.targetSeasonStartYear,
    "sync targetSeasonStartYear",
  );
  const normalized = {
    schemaVersion: SHIFT_PLANNING_SYNC_COMMAND_SCHEMA_VERSION,
    operationKind: "sheetsSync" as const,
    commandId: requireIdentifier(command.commandId, "sync commandId"),
    idempotencyKey: requireIdentifier(
      command.idempotencyKey,
      "sync idempotencyKey",
    ),
    type,
    bundleRevision,
    bundleDigest,
    writeEpoch: requirePositiveInteger(command.writeEpoch, "sync writeEpoch"),
    workbookId: requireIdentifier(command.workbookId, "sync workbookId"),
    workbookRevision: requireIdentifier(
      command.workbookRevision,
      "sync workbookRevision",
    ),
    partitionKey: requireIdentifier(
      command.partitionKey,
      "sync partitionKey",
    ),
    expectedPartitionStateRevision: requireNonNegativeInteger(
      command.expectedPartitionStateRevision,
      "sync expectedPartitionStateRevision",
    ),
    expectedPartitionEpoch,
    commandPartitionEpoch,
    expectedCurrentLease: null,
    leaseIntent: {
      ownerOperationId: requireIdentifier(
        leaseIntent.ownerOperationId,
        "sync lease ownerOperationId",
      ),
      leaseEpoch: requirePositiveInteger(
        leaseIntent.leaseEpoch,
        "sync leaseEpoch",
      ),
      state: "claimed" as const,
      durationMillis,
    },
    expectedActiveRevision: requireIdentifier(
      command.expectedActiveRevision,
      "sync expectedActiveRevision",
    ),
    expectedActiveDigest: requireDigest(
      command.expectedActiveDigest,
      "sync expectedActiveDigest",
    ),
    targetSeasonStartYear,
    affectedProjectionSeasonStartYears: requireSeasonYears(
      command.affectedProjectionSeasonStartYears,
      targetSeasonStartYear,
    ),
  };
  if (
    normalized.commandId !== `${bundleRevision}-${type}` ||
    normalized.idempotencyKey !== `${bundleRevision}:sheets:${type}` ||
    normalized.expectedActiveRevision !== bundleRevision ||
    normalized.expectedActiveDigest !== bundleDigest ||
    commandPartitionEpoch !== expectedPartitionEpoch + 1 ||
    normalized.leaseIntent.ownerOperationId !==
      `${bundleRevision}:sheets:${type}` ||
    normalized.leaseIntent.leaseEpoch !== commandPartitionEpoch ||
    normalized.leaseIntent.state !== "claimed"
  ) {
    return failSync("Sync command lineage is not canonical.");
  }
  return normalized;
};

const pendingCommand = (
  command: UnknownRecord,
): ShiftPlanningSyncCommand => ({
  ...parseImmutableCommand(command),
  state: "pending",
});

const commandDigest = (command: ShiftPlanningSyncCommand): string =>
  createShiftPlanningDigest(command);

const parseClaim = (
  value: unknown,
  minimumFencingEpoch: number,
): ShiftPlanningSyncCommandClaim => {
  const claim = requireRecord(value, "sync command claim");
  requireExactFields(claim, claimFields, "sync command claim");
  const acquiredAt = requireTimestamp(claim.acquiredAt, "sync acquiredAt");
  const expiresAt = requireTimestamp(claim.expiresAt, "sync expiresAt");
  if (expiresAt.toMillis() <= acquiredAt.toMillis()) {
    return failSync("Sync command claim window is invalid.");
  }
  const fencingEpoch = requirePositiveInteger(
    claim.fencingEpoch,
    "sync fencingEpoch",
  );
  if (fencingEpoch < minimumFencingEpoch) {
    return failSync("Sync command fencing epoch regressed.");
  }
  return {
    workerId: requireIdentifier(claim.workerId, "sync workerId"),
    attemptId: requireIdentifier(claim.attemptId, "sync attemptId"),
    fencingEpoch,
    acquiredAt,
    expiresAt,
  };
};

const parseTerminal = (
  value: unknown,
  minimumFencingEpoch: number,
): ShiftPlanningSyncCommandTerminal => {
  const terminal = requireRecord(value, "sync command terminal");
  requireExactFields(terminal, terminalFields, "sync command terminal");
  const claim = parseClaim(
    Object.fromEntries(claimFields.map((field) => [field, terminal[field]])),
    minimumFencingEpoch,
  );
  const completedAt = requireTimestamp(
    terminal.completedAt,
    "sync completedAt",
  );
  if (
    completedAt.toMillis() < claim.acquiredAt.toMillis() ||
    completedAt.toMillis() >= claim.expiresAt.toMillis()
  ) {
    return failSync("Sync completion falls outside its authorized lease.");
  }
  return {
    ...claim,
    completedAt,
    readBackWorkbookRevision: requireIdentifier(
      terminal.readBackWorkbookRevision,
      "sync read-back workbookRevision",
    ),
    readBackPartitionDigest: requireDigest(
      terminal.readBackPartitionDigest,
      "sync read-back partitionDigest",
    ),
  };
};

/**
 * Parses one exact pending, processing, or completed Sheets-sync command.
 * @param {unknown} value Untrusted persisted command value.
 * @return {ShiftPlanningPersistedSyncCommand} Canonical lifecycle document.
 */
export const parseShiftPlanningPersistedSyncCommand = (
  value: unknown,
): ShiftPlanningPersistedSyncCommand => {
  const document = requireRecord(value, "persisted sync command");
  if (document.state === "pending") {
    requireExactFields(document, pendingFields, "pending sync command");
    return pendingCommand(document);
  }
  if (document.state === "processing") {
    requireExactFields(document, processingFields, "processing sync command");
    const pending = pendingCommand({...document, state: "pending"});
    const expectedDigest = commandDigest(pending);
    if (requireDigest(document.commandDigest, "sync commandDigest") !==
      expectedDigest) {
      return failSync("Processing sync command digest has drifted.");
    }
    return {
      ...pending,
      state: "processing",
      commandDigest: expectedDigest,
      claim: parseClaim(document.claim, pending.commandPartitionEpoch),
    };
  }
  if (document.state === "completed") {
    requireExactFields(document, completedFields, "completed sync command");
    const pending = pendingCommand({...document, state: "pending"});
    const expectedDigest = commandDigest(pending);
    if (requireDigest(document.commandDigest, "sync commandDigest") !==
      expectedDigest) {
      return failSync("Completed sync command digest has drifted.");
    }
    return {
      ...pending,
      state: "completed",
      commandDigest: expectedDigest,
      terminal: parseTerminal(
        document.terminal,
        pending.commandPartitionEpoch,
      ),
    };
  }
  return failSync("Persisted sync command state is invalid.");
};

export const createShiftPlanningProcessingSyncCommand = (input: {
  command: ShiftPlanningSyncCommand;
  claim: ShiftPlanningSyncCommandClaim;
}): ShiftPlanningProcessingSyncCommand =>
  parseShiftPlanningPersistedSyncCommand({
    ...input.command,
    state: "processing",
    commandDigest: commandDigest(input.command),
    claim: input.claim,
  }) as ShiftPlanningProcessingSyncCommand;

export const toShiftPlanningPendingSyncCommand = (
  value: unknown,
): ShiftPlanningSyncCommand => {
  parseShiftPlanningPersistedSyncCommand(value);
  return {
    ...parseImmutableCommand(requireRecord(value, "persisted sync command")),
    state: "pending",
  };
};

export const createShiftPlanningCompletedSyncCommand = (input: {
  command: ShiftPlanningProcessingSyncCommand;
  completedAt: Timestamp;
  evidence: ShiftPlanningSyncReadBackEvidence;
}): ShiftPlanningCompletedSyncCommand => {
  const {claim, ...command} = input.command;
  return parseShiftPlanningPersistedSyncCommand({
    ...command,
    state: "completed",
    terminal: {
      ...claim,
      completedAt: input.completedAt,
      readBackWorkbookRevision: input.evidence.workbookRevision,
      readBackPartitionDigest: input.evidence.partitionDigest,
    },
  }) as ShiftPlanningCompletedSyncCommand;
};

export const createShiftPlanningSyncCommandToken = (input: {
  environment: ShiftPlanningEnvironment;
  command: ShiftPlanningProcessingSyncCommand;
}): ShiftPlanningSyncCommandToken => ({
  environment: input.environment,
  commandId: input.command.commandId,
  commandDigest: input.command.commandDigest,
  workerId: input.command.claim.workerId,
  attemptId: input.command.claim.attemptId,
  fencingEpoch: input.command.claim.fencingEpoch,
});

export const requireShiftPlanningSyncCommandToken = (
  command: ShiftPlanningProcessingSyncCommand,
  token: ShiftPlanningSyncCommandToken,
): void => {
  if (
    command.commandId !== token.commandId ||
    command.commandDigest !== token.commandDigest ||
    command.claim.workerId !== token.workerId ||
    command.claim.attemptId !== token.attemptId ||
    command.claim.fencingEpoch !== token.fencingEpoch
  ) {
    failSync("Sync command token no longer owns the claim.");
  }
};

export const sameShiftPlanningSyncReadBack = (
  command: ShiftPlanningCompletedSyncCommand,
  evidence: ShiftPlanningSyncReadBackEvidence,
): boolean =>
  command.terminal.readBackWorkbookRevision === evidence.workbookRevision &&
  command.terminal.readBackPartitionDigest === evidence.partitionDigest;
