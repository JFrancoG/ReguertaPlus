import {Firestore} from "@google-cloud/firestore";
import type {drive_v3 as DriveV3} from "googleapis";
import {buildShiftPlanningCandidatePositionSet} from
  "./shift-planning-candidate.js";
import {createShiftPlanningDigest} from "./shift-planning-digest.js";
import {parsePersistedBundle} from "./shift-planning-firestore-repository.js";
import {
  parseShiftPlanningActivationOperationTerminal,
  parseShiftPlanningPublicShiftDocument,
} from "./shift-planning-publication-contract.js";
import {
  failSheetsSubmission,
  requireShiftSheetsWorkbookVersion,
} from "./shift-planning-sheets-submission.js";
import {
  ShiftPlanningSheetsConsumerResult,
  ShiftPlanningSheetsSyncConsumer,
} from "./shift-planning-sync-command-executor.js";
import {
  ShiftPlanningProcessingSyncCommand,
  ShiftPlanningSyncCommandRepository,
  createShiftPlanningSyncCommandToken,
  toShiftPlanningPendingSyncCommand,
} from "./shift-planning-sync-command.js";
import {parseShiftPlanningMaintenanceState} from "./shift-planning-wire.js";
import {ShiftSheetsConfig} from "./shift-sheets-config.js";
import {
  SHIFT_SHEETS_LIMITS,
  ShiftSheetsProjectionRow,
  createShiftSheetsAdapter,
} from "./shift-sheets.js";

/**
 * Loads exactly the activated partition, including its predecessor update.
 * No caller-supplied rows or mutable assignment projections are authoritative.
 * @param {object} input Pinned environment/workbook and immutable command.
 * @return {ShiftSheetsProjectionRow[]} Exact current activation projections.
 */
export const loadShiftPlanningSheetsProjection = async (input: {
  firestore: Firestore;
  config: ShiftSheetsConfig;
  command: ShiftPlanningProcessingSyncCommand;
}): Promise<readonly ShiftSheetsProjectionRow[]> => {
  const {firestore, config, command} = input;
  if (command.workbookId !== config.workbookId) {
    return failSheetsSubmission("Command targets another configured workbook.");
  }
  const root = `${config.environment}/plus-collections`;
  return firestore.runTransaction(async (transaction) => {
    const [bundleSnapshot, stateSnapshot] = await Promise.all([
      transaction.get(firestore.doc(
        `${root}/shiftPlanningBundles/${command.bundleRevision}`,
      )),
      transaction.get(firestore.doc(`${root}/shiftPlanningState/current`)),
    ]);
    const state = parseShiftPlanningMaintenanceState(stateSnapshot.data());
    const bundle = parsePersistedBundle(bundleSnapshot.data());
    const artifact = bundle.artifact;
    const template = artifact.syncCommands.find((item) =>
      item.commandId === command.commandId);
    if (!template || bundle.environment !== config.environment ||
      state.maintenanceStatus !== "closed" ||
      state.activeRevision !== command.bundleRevision ||
      state.activeDigest !== command.bundleDigest ||
      state.writeEpoch !== command.writeEpoch ||
      createShiftPlanningDigest(template) !== createShiftPlanningDigest(
        toShiftPlanningPendingSyncCommand(command),
      )) {
      return failSheetsSubmission("Sync source no longer matches its command.");
    }
    const operationSnapshot = await transaction.get(firestore.doc(
      `${root}/shiftPlanningOperations/${state.lastTransitionId}`,
    ));
    const operation = parseShiftPlanningActivationOperationTerminal(
      operationSnapshot.data(),
    );
    if (operation.environment !== config.environment ||
      operation.operationId !== state.lastTransitionId ||
      operation.bundleRevision !== command.bundleRevision ||
      operation.bundleDigest !== command.bundleDigest ||
      operation.writeEpoch !== command.writeEpoch ||
      operation.forwardManifestDigest !==
        artifact.transactionRequirements.forwardManifestDigest) {
      return failSheetsSubmission("Sync source lost its activation terminal.");
    }
    const positions = buildShiftPlanningCandidatePositionSet({
      candidateId: bundle.bundleId,
      bundleRevision: bundle.bundleRevision,
      bundleDigest: bundle.bundleDigest,
      writeEpoch: artifact.activationWriteEpoch,
      delivery: artifact.delivery,
      market: artifact.market,
    }).positions.filter((position) => position.type === command.type);
    const paths = positions.map((position) =>
      `${root}/shifts/${position.shiftId}`);
    if (command.type === "delivery" &&
      artifact.delivery.predecessorHelperUpdate) {
      paths.push(`${root}/shifts/` +
        artifact.delivery.predecessorHelperUpdate.shiftId);
    }
    const bindings = operation.publicMutations.filter((binding) =>
      binding.targetPath.startsWith(`${root}/shifts/shift_${command.type}_`));
    if (!paths.length || paths.length > SHIFT_SHEETS_LIMITS.projectionRows ||
      new Set(paths).size !== paths.length ||
      bindings.length !== paths.length ||
      bindings.some((binding) => !paths.includes(binding.targetPath))) {
      return failSheetsSubmission("Sync partition manifest is incomplete.");
    }
    const snapshots = await transaction.getAll(...paths.map((path) =>
      firestore.doc(path)));
    const seasons = new Set<number>();
    const rows = snapshots.map((snapshot): ShiftSheetsProjectionRow => {
      const document = parseShiftPlanningPublicShiftDocument({
        targetPath: snapshot.ref.path,
        value: snapshot.data(),
        expectedOperationIntentDigest: operation.operationIntentDigest,
      });
      const marker = document.lastBackendMutation;
      const binding = bindings.find((item) =>
        item.targetPath === snapshot.ref.path);
      if (!binding || document.type !== command.type ||
        marker.kind !== "activation" ||
        marker.operationId !== operation.operationId ||
        binding.payloadDigest !== marker.payloadDigest ||
        binding.documentRevision !== document.documentRevision) {
        return failSheetsSubmission("Sync row differs from its activation.");
      }
      seasons.add(document.projectionSeasonStartYear);
      return {
        id: snapshot.id, type: document.type,
        date: document.date.toDate().toISOString().slice(0, 10),
        rotationOwnerUserIds: document.rotationOwnerUserIds ??
          [document.rotationOwnerUserId as string],
        assignedUserIds: document.assignedUserIds,
        helperUserId: document.helperUserId, status: document.status,
        source: document.source, origin: document.origin,
      };
    });
    if (createShiftPlanningDigest([...seasons].sort((a, b) => a - b)) !==
      createShiftPlanningDigest(command.affectedProjectionSeasonStartYears)) {
      return failSheetsSubmission("Affected seasons differ from actual rows.");
    }
    return rows;
  });
};

/**
 * Uses the real Drive file version, which includes non-content changes too.
 * Requires metadata-read scope in addition to the Sheets client's own scope.
 * @param {object} input Pinned file and public googleapis Drive resource.
 * @return {Function} Read-only version observer; never writes Drive metadata.
 */
export const createShiftSheetsWorkbookVersionReader = (input: {
  workbookId: string;
  files: Pick<DriveV3.Resource$Files, "get">;
}): (() => Promise<string>) => async () => {
  const {data} = await input.files.get({
    fileId: input.workbookId, fields: "id,mimeType,trashed,version",
    supportsAllDrives: true,
  }, {retry: false, timeout: 15000});
  if (data.id !== input.workbookId || data.trashed ||
    data.mimeType !== "application/vnd.google-apps.spreadsheet") {
    return failSheetsSubmission("Drive file is not the configured workbook.");
  }
  return requireShiftSheetsWorkbookVersion(data.version);
};

/**
 * Bridges command claims to one physical Sheets batch and durable read-back.
 * Before I/O, the repository serializes submissions for both partitions. After
 * an uncertain outcome every invocation is read-only, even beyond lease expiry.
 * External human/API writers still require the operational fence from HU-085.
 * @param {object} input Concrete repository, Sheets adapter and Drive observer.
 * @return {ShiftPlanningSheetsSyncConsumer} Explicitly invoked consumer.
 */
export const createFirestoreShiftPlanningSheetsConsumer = (input: {
  firestore: Firestore;
  config: ShiftSheetsConfig;
  repository: ShiftPlanningSyncCommandRepository;
  sheets: ReturnType<typeof createShiftSheetsAdapter>;
  readWorkbookVersion(): Promise<string>;
}): ShiftPlanningSheetsSyncConsumer => {
  const tokenFor = (command: ShiftPlanningProcessingSyncCommand) =>
    createShiftPlanningSyncCommandToken({
      environment: input.config.environment, command,
    });
  const inspect = async (
    command: ShiftPlanningProcessingSyncCommand,
  ): Promise<ShiftPlanningSheetsConsumerResult> => {
    const token = tokenFor(command);
    const receipt = await input.repository.readSubmission(token);
    if (!receipt || command.workbookId !== input.config.workbookId) {
      return failSheetsSubmission("Read-back has no matching submission.");
    }
    if (receipt.evidence !== null) return receipt.evidence;
    const rows = await loadShiftPlanningSheetsProjection({...input, command});
    let observed;
    let version: string;
    try {
      const before = await input.readWorkbookVersion();
      observed = await input.sheets.inspect({
        operationId: command.idempotencyKey, rows,
      });
      version = await input.readWorkbookVersion();
      if (before !== version || observed.kind !== "verified" ||
        observed.readBackDigest !== receipt.projectionDigest ||
        BigInt(requireShiftSheetsWorkbookVersion(version)) <=
          BigInt(receipt.beforeWorkbookRevision)) {
        return {kind: "reconciliationRequired"};
      }
    } catch {
      return {kind: "reconciliationRequired"};
    }
    const evidence = {
      workbookRevision: version,
      partitionDigest: createShiftPlanningDigest({
        projectionDigest: observed.readBackDigest,
      }),
    };
    await input.repository.verifySubmission({token, evidence});
    return evidence;
  };
  return {
    inspect,
    async apply(command, authorizeMutation) {
      const token = tokenFor(command);
      if (await input.repository.readSubmission(token)) return inspect(command);
      const beforeWorkbookRevision = await input.readWorkbookVersion();
      const rows = await loadShiftPlanningSheetsProjection({...input, command});
      await input.sheets.reconcile({
        operationId: command.idempotencyKey, rows,
        async authorizeMutation(batch) {
          if (batch.workbookId !== command.workbookId ||
            await input.readWorkbookVersion() !== beforeWorkbookRevision) {
            return failSheetsSubmission("Workbook changed during planning.");
          }
          await authorizeMutation();
          await input.repository.prepareSubmission({token, binding: {
            beforeWorkbookRevision,
            projectionDigest: batch.projectionDigest,
            requestDigest: batch.requestDigest,
          }});
        },
      });
      return inspect(command);
    },
  };
};
