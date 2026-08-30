import {
  DocumentSnapshot,
  FieldPath,
  Firestore,
  Timestamp,
  Transaction,
} from "@google-cloud/firestore";
import {
  ShiftPlanningSyncCommand,
  ShiftPlanningWorkbookPartition,
} from "./shift-planning-bundle.js";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {
  ShiftPlanningCompletedSyncCommand,
  ShiftPlanningProcessingSyncCommand,
  ShiftPlanningSyncCommandClaimResult,
  ShiftPlanningSyncCommandCompletionResult,
  ShiftPlanningSyncCommandRepository,
  ShiftPlanningSyncCommandToken,
  createShiftPlanningCompletedSyncCommand,
  createShiftPlanningProcessingSyncCommand,
  createShiftPlanningSyncCommandToken,
  parseShiftPlanningPersistedSyncCommand,
  requireShiftPlanningSyncCommandToken,
  sameShiftPlanningSyncReadBack,
  toShiftPlanningPendingSyncCommand,
} from "./shift-planning-sync-command.js";
import {
  ShiftPlanningEnvironment,
  parseShiftPlanningMaintenanceState,
} from "./shift-planning-wire.js";

type UnknownRecord = Record<string, unknown>;
type SyncCommandLineage = Omit<ShiftPlanningSyncCommand, "state">;

type SyncCommandSourcePolicy = {
  reference: FirebaseFirestore.DocumentReference;
  partition: ShiftPlanningWorkbookPartition;
};

const partitionFields = [
  "workbookId",
  "workbookRevision",
  "partitionKey",
  "stateRevision",
  "epoch",
  "lease",
] as const;

const partitionLeaseFields = [
  "ownerOperationId",
  "leaseEpoch",
  "state",
  "acquiredAtMillis",
  "deadlineAtMillis",
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

const requireNonNegativeInteger = (value: unknown, name: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return failSync(`${name} must be a non-negative safe integer.`);
  }
  return value as number;
};

const requireEnvironment = (value: unknown): ShiftPlanningEnvironment => {
  if (value !== "develop" && value !== "production") {
    return failSync("Sync command environment is invalid.");
  }
  return value;
};

const requireSnapshotData = (
  snapshot: DocumentSnapshot,
  name: string,
): FirebaseFirestore.DocumentData => {
  const data = snapshot.data();
  if (!snapshot.exists || data === undefined) {
    return failSync(`${name} is missing.`);
  }
  return data;
};

const parsePartitionLease = (
  value: unknown,
): ShiftPlanningWorkbookPartition["lease"] => {
  if (value === null) return null;
  const lease = requireRecord(value, "sync workbook lease");
  requireExactFields(
    lease,
    partitionLeaseFields,
    "sync workbook lease",
  );
  if (
    lease.state !== "claimed" &&
    lease.state !== "releasing" &&
    lease.state !== "degraded"
  ) {
    return failSync("Sync workbook lease state is invalid.");
  }
  const acquiredAtMillis = requireNonNegativeInteger(
    lease.acquiredAtMillis,
    "sync workbook acquiredAtMillis",
  );
  const deadlineAtMillis = requireNonNegativeInteger(
    lease.deadlineAtMillis,
    "sync workbook deadlineAtMillis",
  );
  if (deadlineAtMillis <= acquiredAtMillis) {
    return failSync("Sync workbook lease window is invalid.");
  }
  return {
    ownerOperationId: requireIdentifier(
      lease.ownerOperationId,
      "sync workbook ownerOperationId",
    ),
    leaseEpoch: requireNonNegativeInteger(
      lease.leaseEpoch,
      "sync workbook leaseEpoch",
    ),
    state: lease.state,
    acquiredAtMillis,
    deadlineAtMillis,
  };
};

const parsePartition = (
  value: unknown,
): ShiftPlanningWorkbookPartition => {
  const partition = requireRecord(value, "sync workbook partition");
  requireExactFields(
    partition,
    partitionFields,
    "sync workbook partition",
  );
  return {
    workbookId: requireIdentifier(
      partition.workbookId,
      "sync workbookId",
    ),
    workbookRevision: requireIdentifier(
      partition.workbookRevision,
      "sync workbookRevision",
    ),
    partitionKey: requireIdentifier(
      partition.partitionKey,
      "sync partitionKey",
    ),
    stateRevision: requireNonNegativeInteger(
      partition.stateRevision,
      "sync partition stateRevision",
    ),
    epoch: requireNonNegativeInteger(
      partition.epoch,
      "sync partition epoch",
    ),
    lease: parsePartitionLease(partition.lease),
  };
};

const requireSourcePolicy = (
  snapshot: DocumentSnapshot,
  environment: ShiftPlanningEnvironment,
  command: SyncCommandLineage,
): SyncCommandSourcePolicy => {
  const policy = requireRecord(
    requireSnapshotData(snapshot, "planning source policy"),
    "planning source policy",
  );
  if (policy.environment !== environment) {
    return failSync("Planning source policy environment drifted.");
  }
  const sync = requireRecord(policy.sync, "planning source sync policy");
  const partitions = requireRecord(
    sync.partitions,
    "planning source sync partitions",
  );
  return {
    reference: snapshot.ref,
    partition: parsePartition(partitions[command.type]),
  };
};

const requireActiveCommand = (
  snapshot: DocumentSnapshot,
  command: SyncCommandLineage,
): void => {
  const maintenance = parseShiftPlanningMaintenanceState(
    requireSnapshotData(snapshot, "planning maintenance state"),
  );
  if (
    maintenance.maintenanceStatus !== "closed" ||
    maintenance.writeEpoch !== command.writeEpoch ||
    maintenance.activeRevision !== command.expectedActiveRevision ||
    maintenance.activeDigest !== command.expectedActiveDigest
  ) {
    failSync("Sync command is no longer bound to active maintenance state.");
  }
};

const requireInitialPartition = (
  command: ShiftPlanningSyncCommand,
  partition: ShiftPlanningWorkbookPartition,
): void => {
  if (
    partition.workbookId !== command.workbookId ||
    partition.workbookRevision !== command.workbookRevision ||
    partition.partitionKey !== command.partitionKey ||
    partition.stateRevision !== command.expectedPartitionStateRevision ||
    partition.epoch !== command.expectedPartitionEpoch ||
    partition.lease !== command.expectedCurrentLease
  ) {
    failSync("Sync command workbook partition has drifted before claim.");
  }
};

const requireOwnedPartition = (
  command: ShiftPlanningProcessingSyncCommand,
  partition: ShiftPlanningWorkbookPartition,
): void => {
  const lease = partition.lease;
  if (
    partition.workbookId !== command.workbookId ||
    partition.workbookRevision !== command.workbookRevision ||
    partition.partitionKey !== command.partitionKey ||
    partition.epoch !== command.claim.fencingEpoch ||
    lease === null ||
    lease.ownerOperationId !== command.leaseIntent.ownerOperationId ||
    lease.leaseEpoch !== command.claim.fencingEpoch ||
    lease.state !== "claimed" ||
    lease.acquiredAtMillis !== command.claim.acquiredAt.toMillis() ||
    lease.deadlineAtMillis !== command.claim.expiresAt.toMillis()
  ) {
    failSync("Sync command no longer owns the workbook partition.");
  }
};

const commandReference = (
  firestore: Firestore,
  environment: ShiftPlanningEnvironment,
  commandId: string,
) => firestore.doc(
  `${environment}/plus-collections/shiftPlanningSyncCommands/${commandId}`,
);

const maintenanceReference = (
  firestore: Firestore,
  environment: ShiftPlanningEnvironment,
) => firestore.doc(
  `${environment}/plus-collections/shiftPlanningState/current`,
);

const sourcePolicyReference = (
  firestore: Firestore,
  environment: ShiftPlanningEnvironment,
) => firestore.doc(
  `${environment}/plus-collections/shiftPlanningState/sourcePolicy`,
);

const updatePartition = (
  transaction: Transaction,
  sourcePolicy: SyncCommandSourcePolicy,
  type: ShiftPlanningSyncCommand["type"],
  partition: ShiftPlanningWorkbookPartition,
): void => {
  transaction.update(
    sourcePolicy.reference,
    new FieldPath("sync", "partitions", type),
    partition,
  );
};

const tokenFor = (
  environment: ShiftPlanningEnvironment,
  command: ShiftPlanningProcessingSyncCommand,
): ShiftPlanningSyncCommandToken => createShiftPlanningSyncCommandToken({
  environment,
  command,
});

const completionOwnsToken = (
  command: ShiftPlanningCompletedSyncCommand,
  token: ShiftPlanningSyncCommandToken,
): boolean =>
  command.commandId === token.commandId &&
  command.commandDigest === token.commandDigest &&
  command.terminal.workerId === token.workerId &&
  command.terminal.attemptId === token.attemptId &&
  command.terminal.fencingEpoch === token.fencingEpoch;

const requireOpenClaim = (
  command: ShiftPlanningProcessingSyncCommand,
  now: Timestamp,
): void => {
  if (now.toMillis() >= command.claim.expiresAt.toMillis()) {
    failSync("Sync command claim expired before the external batch.");
  }
};

/**
 * Persists the explicit pull lifecycle for activation Sheets-sync commands.
 * Discovery never mutates. Claim, stale-claim takeover, pre-batch
 * authorization, and read-back completion each revalidate partition fencing
 * in Firestore transactions. External Sheets I/O remains outside this adapter.
 * @param {Firestore} firestore Pinned Firestore authority or emulator.
 * @param {Function} clock Trusted callback clock.
 * @return {ShiftPlanningSyncCommandRepository} Governed command repository.
 */
export const createFirestoreShiftPlanningSyncCommandRepository = (
  firestore: Firestore,
  clock: () => Timestamp = () => Timestamp.now(),
): ShiftPlanningSyncCommandRepository => ({
  async discoverRunnable(input) {
    const environment = requireEnvironment(input.environment);
    if (!Number.isSafeInteger(input.limit) || input.limit < 1 ||
      input.limit > 100) {
      return failSync("Sync command discovery limit is invalid.");
    }
    const collection = firestore.collection(
      `${environment}/plus-collections/shiftPlanningSyncCommands`,
    );
    const now = clock();
    const [pending, expired] = await Promise.all([
      collection.where("state", "==", "pending").limit(input.limit).get(),
      collection.where("claim.expiresAt", "<=", now).limit(input.limit).get(),
    ]);
    const commandIds = new Set<string>();
    pending.docs.forEach((snapshot) => {
      const command = parseShiftPlanningPersistedSyncCommand(snapshot.data());
      if (command.state === "pending" && command.commandId === snapshot.id) {
        commandIds.add(command.commandId);
      }
    });
    expired.docs.forEach((snapshot) => {
      const command = parseShiftPlanningPersistedSyncCommand(snapshot.data());
      if (
        command.state === "processing" &&
        command.commandId === snapshot.id &&
        command.claim.expiresAt.toMillis() <= now.toMillis()
      ) {
        commandIds.add(command.commandId);
      }
    });
    return [...commandIds].sort().slice(0, input.limit);
  },

  async claim(input): Promise<ShiftPlanningSyncCommandClaimResult> {
    const environment = requireEnvironment(input.environment);
    const commandId = requireIdentifier(input.commandId, "sync commandId");
    const workerId = requireIdentifier(input.workerId, "sync workerId");
    const attemptId = requireIdentifier(input.attemptId, "sync attemptId");
    const reference = commandReference(firestore, environment, commandId);
    return firestore.runTransaction(async (transaction) => {
      const commandSnapshot = await transaction.get(reference);
      const persisted = parseShiftPlanningPersistedSyncCommand(
        requireSnapshotData(commandSnapshot, "sync command"),
      );
      if (persisted.commandId !== commandId) {
        return failSync("Sync command path and payload differ.");
      }
      if (persisted.state === "completed") {
        return {kind: "terminalReplay", command: persisted};
      }
      const now = clock();
      if (persisted.state === "processing") {
        if (
          persisted.claim.workerId === workerId &&
          persisted.claim.attemptId === attemptId &&
          now.toMillis() < persisted.claim.expiresAt.toMillis()
        ) {
          return {
            kind: "replayed",
            command: persisted,
            token: tokenFor(environment, persisted),
          };
        }
        if (now.toMillis() < persisted.claim.expiresAt.toMillis()) {
          return {kind: "busy", retryAt: persisted.claim.expiresAt};
        }
        if (persisted.claim.attemptId === attemptId) {
          return failSync("Expired sync retry requires a new attemptId.");
        }
      }
      const [maintenanceSnapshot, sourcePolicySnapshot] = await Promise.all([
        transaction.get(maintenanceReference(firestore, environment)),
        transaction.get(sourcePolicyReference(firestore, environment)),
      ]);
      requireActiveCommand(maintenanceSnapshot, persisted);
      const sourcePolicy = requireSourcePolicy(
        sourcePolicySnapshot,
        environment,
        persisted,
      );
      let fencingEpoch: number;
      if (persisted.state === "pending") {
        requireInitialPartition(persisted, sourcePolicy.partition);
        fencingEpoch = persisted.commandPartitionEpoch;
      } else {
        requireOwnedPartition(persisted, sourcePolicy.partition);
        if (sourcePolicy.partition.epoch >= Number.MAX_SAFE_INTEGER) {
          return failSync("Sync command fencing epoch is exhausted.");
        }
        fencingEpoch = sourcePolicy.partition.epoch + 1;
      }
      const expiresAtMillis = now.toMillis() +
        persisted.leaseIntent.durationMillis;
      if (!Number.isSafeInteger(expiresAtMillis)) {
        return failSync("Sync command lease expiry is unsafe.");
      }
      const pending = toShiftPlanningPendingSyncCommand(persisted);
      const processing = createShiftPlanningProcessingSyncCommand({
        command: pending,
        claim: {
          workerId,
          attemptId,
          fencingEpoch,
          acquiredAt: now,
          expiresAt: Timestamp.fromMillis(expiresAtMillis),
        },
      });
      const partition: ShiftPlanningWorkbookPartition = {
        ...sourcePolicy.partition,
        stateRevision: sourcePolicy.partition.stateRevision + 1,
        epoch: fencingEpoch,
        lease: {
          ownerOperationId: processing.leaseIntent.ownerOperationId,
          leaseEpoch: fencingEpoch,
          state: "claimed",
          acquiredAtMillis: now.toMillis(),
          deadlineAtMillis: expiresAtMillis,
        },
      };
      transaction.set(reference, processing);
      updatePartition(transaction, sourcePolicy, persisted.type, partition);
      return {
        kind: "claimed",
        command: processing,
        token: tokenFor(environment, processing),
      };
    });
  },

  async authorizeBatch(token) {
    const environment = requireEnvironment(token.environment);
    const reference = commandReference(
      firestore,
      environment,
      requireIdentifier(token.commandId, "sync token commandId"),
    );
    return firestore.runTransaction(async (transaction) => {
      const [commandSnapshot, maintenanceSnapshot, sourcePolicySnapshot] =
        await Promise.all([
          transaction.get(reference),
          transaction.get(maintenanceReference(firestore, environment)),
          transaction.get(sourcePolicyReference(firestore, environment)),
        ]);
      const command = parseShiftPlanningPersistedSyncCommand(
        requireSnapshotData(commandSnapshot, "sync command"),
      );
      if (command.state !== "processing") {
        return failSync("Sync command is not processing.");
      }
      requireShiftPlanningSyncCommandToken(command, token);
      requireOpenClaim(command, clock());
      requireActiveCommand(maintenanceSnapshot, command);
      const sourcePolicy = requireSourcePolicy(
        sourcePolicySnapshot,
        environment,
        command,
      );
      requireOwnedPartition(command, sourcePolicy.partition);
      return command;
    });
  },

  async complete(input): Promise<ShiftPlanningSyncCommandCompletionResult> {
    const token = input.token;
    const environment = requireEnvironment(token.environment);
    const reference = commandReference(
      firestore,
      environment,
      requireIdentifier(token.commandId, "sync token commandId"),
    );
    return firestore.runTransaction(async (transaction) => {
      const commandSnapshot = await transaction.get(reference);
      const persisted = parseShiftPlanningPersistedSyncCommand(
        requireSnapshotData(commandSnapshot, "sync command"),
      );
      if (persisted.state === "completed") {
        if (
          !completionOwnsToken(persisted, token) ||
          !sameShiftPlanningSyncReadBack(persisted, input.evidence)
        ) {
          return failSync("Sync completion replay does not match terminal.");
        }
        return {kind: "replayed", command: persisted};
      }
      if (persisted.state !== "processing") {
        return failSync("Sync command was not claimed before completion.");
      }
      requireShiftPlanningSyncCommandToken(persisted, token);
      const completedAt = clock();
      requireOpenClaim(persisted, completedAt);
      const [maintenanceSnapshot, sourcePolicySnapshot] = await Promise.all([
        transaction.get(maintenanceReference(firestore, environment)),
        transaction.get(sourcePolicyReference(firestore, environment)),
      ]);
      requireActiveCommand(maintenanceSnapshot, persisted);
      const sourcePolicy = requireSourcePolicy(
        sourcePolicySnapshot,
        environment,
        persisted,
      );
      requireOwnedPartition(persisted, sourcePolicy.partition);
      const completed = createShiftPlanningCompletedSyncCommand({
        command: persisted,
        completedAt,
        evidence: input.evidence,
      });
      const partition: ShiftPlanningWorkbookPartition = {
        ...sourcePolicy.partition,
        workbookRevision: completed.terminal.readBackWorkbookRevision,
        stateRevision: sourcePolicy.partition.stateRevision + 1,
        lease: null,
      };
      transaction.set(reference, completed);
      updatePartition(transaction, sourcePolicy, persisted.type, partition);
      return {kind: "committed", command: completed};
    });
  },
});
