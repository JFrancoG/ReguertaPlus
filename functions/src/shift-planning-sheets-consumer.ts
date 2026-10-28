import type {
  ShiftPlanningOwnerSheetsProof, ShiftPlanningOwnerSheetsBinding,
} from
  "./shift-planning-owner-sheets-contract.js";
import {ShiftPlanningOwnerSheetsGuard, ShiftPlanningOwnerSheetsGuardError} from
  "./shift-planning-owner-sheets-guard.js";
import type {ShiftSheetsImportTab} from "./shift-sheets-import.js";
import {Firestore, Timestamp} from "@google-cloud/firestore";
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
  ShiftPlanningReadableSubmission,
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

import {shiftSheetsISOWeekKey} from "./shift-sheets-human-layout.js";

/**
 * Loads exactly the activated partition, including its predecessor update.
 * New submissions also read the display directory and absent/present calendar
 * documents in this transaction; their versions fence receipt creation.
 * No caller-supplied rows or mutable assignment projections are authoritative.
 * @param {object} input Pinned environment/workbook and immutable command.
 * @return {object} Activated projections and optional versioned display data.
 */
export const loadShiftPlanningSheetsSource = async (input: {
  firestore: Firestore;
  config: ShiftSheetsConfig;
  command: Omit<ShiftPlanningProcessingSyncCommand,
    "state" | "claim" | "commandDigest">;
  readable: boolean;
}): Promise<{rows: readonly ShiftSheetsProjectionRow[];
  readable?: ShiftPlanningReadableSubmission}> => {
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
    if (!input.readable) return {rows};
    const userIds = new Set(rows.flatMap((row) =>
      [...row.assignedUserIds,
        ...(row.helperUserId ? [row.helperUserId] : [])]));
    const weeks = new Set(rows.filter((row) => row.type === "delivery")
      .map((row) => shiftSheetsISOWeekKey(row.date)));
    if (rows.length + userIds.size + weeks.size > 500) {
      return failSheetsSubmission("Readable source exceeds the bounded limit.");
    }
    const displayPaths = [...[...userIds].sort().map((id) =>
      `${root}/users/${id}`), ...[...weeks].sort().map((week) =>
      `${root}/deliveryCalendar/${week}`)];
    const display = await transaction.getAll(...displayPaths.map((path) =>
      firestore.doc(path)));
    const members = new Map(display.filter((doc) =>
      doc.ref.parent.id === "users").map((doc) => {
      const value = doc.data();
      const phoneKeys = ["phoneNumber", "phone", "telephone", "telefono"];
      if (!value || typeof value.displayName !== "string" ||
        !value.displayName.trim() || !Array.isArray(value.roles) ||
        !value.roles.includes("member") || phoneKeys.some((key) =>
        value[key] != null && typeof value[key] !== "string")) {
        return failSheetsSubmission("Readable member identity is missing.");
      }
      return [doc.id, {userId: doc.id, name: value.displayName,
        phone: phoneKeys.map((key) => value[key] as string | undefined)
          .find((phone) => phone?.trim()) ?? ""}] as const;
    }));
    const calendar = new Map(display.filter((doc) =>
      doc.ref.parent.id === "deliveryCalendar" && doc.exists).map((doc) => {
      const timestamp = doc.get("deliveryDate");
      if (!(timestamp instanceof Timestamp) ||
        (doc.get("weekKey") != null && doc.get("weekKey") !== doc.id)) {
        return failSheetsSubmission("Readable calendar identity is invalid.");
      }
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Madrid", year: "numeric", month: "2-digit",
        day: "2-digit",
      }).formatToParts(timestamp.toDate());
      const part = (type: string) =>
        parts.find((item) => item.type === type)?.value;
      const date = `${part("year")}-${part("month")}-${part("day")}`;
      if (shiftSheetsISOWeekKey(date) !== doc.id) {
        return failSheetsSubmission("Readable calendar week changed.");
      }
      return [doc.id, date] as const;
    }));
    const memberFor = (id: string) => {
      const member = members.get(id);
      if (!member) return failSheetsSubmission("Readable member is absent.");
      return member;
    };
    return {rows, readable: {environment: config.environment,
      rows: rows.map((row) => ({id: row.id,
        visibleDate: calendar.get(shiftSheetsISOWeekKey(row.date)) ?? row.date,
        assignees: row.assignedUserIds.map((id) => memberFor(id)),
        helper: row.helperUserId ? {userId: row.helperUserId,
          name: memberFor(row.helperUserId).name} : null})),
      sourceVersions: [...snapshots, ...display].map((doc) => ({
        path: doc.ref.path, updateTime: doc.updateTime ?? null,
      }))}};
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
 * New submissions persist readable display data; legacy receipts still inspect
 * canonical cells. Recovery never rebuilds submitted labels from live members.
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
  readGenerationTabs?(): readonly ShiftSheetsImportTab[] | undefined;
  ownerControls?: ShiftPlanningOwnerSheetsGuard;
}): ShiftPlanningSheetsSyncConsumer => {
  const tokenFor = (command: ShiftPlanningProcessingSyncCommand) =>
    createShiftPlanningSyncCommandToken({
      environment: input.config.environment,
      command,
    });
  if (
    input.ownerControls &&
    (!input.repository.retainSubmissionIncident ||
      !input.repository.readSubmissionForIncident)
  ) {
    return failSheetsSubmission(
      "Owner controls require durable incident support.",
    );
  }
  const retainOwnerFailure = async (
    command: ShiftPlanningProcessingSyncCommand,
    phase: "submission" | "readback" | "completion",
    error: unknown,
  ): Promise<void> => {
    if (!input.ownerControls) return;
    const token = tokenFor(command);
    const receipt =
      await input.repository.readSubmissionForIncident?.(token);
    if (!receipt?.ownerMaintenance) return;
    await input.repository.retainSubmissionIncident?.({
      token,
      incident: input.ownerControls.incident(
        receipt.ownerMaintenance,
        phase,
        error,
      ),
    });
  };
  const inspect = async (
    command: ShiftPlanningProcessingSyncCommand,
  ): Promise<ShiftPlanningSheetsConsumerResult> => {
    const token = tokenFor(command);
    try {
      const receipt = await input.repository.readSubmission(token);
      if (!receipt || command.workbookId !== input.config.workbookId) {
        return failSheetsSubmission(
          "Read-back has no matching submission.",
        );
      }
      if (receipt.ownerMaintenance && !input.ownerControls) {
        return failSheetsSubmission(
          "Owner submissions require their phase controls.",
        );
      }
      if (receipt.guardIncident) {
        throw new ShiftPlanningOwnerSheetsGuardError(
          "owner_controls_rejected",
        );
      }
      if (receipt.evidence !== null) {
        if (receipt.ownerMaintenance) {
          await input.ownerControls?.afterReadBack({
            command,
            receipt,
            evidence: receipt.evidence,
          });
        }
        return receipt.evidence;
      }
      const {rows} = await loadShiftPlanningSheetsSource({
        ...input,
        command,
        readable: false,
      });
      if (
        receipt.readable &&
        receipt.readable.environment !== input.config.environment
      ) {
        return failSheetsSubmission(
          "Readable receipt targets another environment.",
        );
      }
      let observed;
      let version: string;
      try {
        const before = await input.readWorkbookVersion();
        observed = await input.sheets.inspect({
          operationId: command.idempotencyKey,
          rows,
          generationRows: receipt.readable?.rows,
          generationTabs: receipt.readable?.generationTabs,
        });
        version = await input.readWorkbookVersion();
        if (
          before !== version ||
          observed.kind !== "verified" ||
          observed.readBackDigest !== receipt.projectionDigest ||
          BigInt(requireShiftSheetsWorkbookVersion(version)) <=
            BigInt(receipt.beforeWorkbookRevision)
        ) {
          if (input.ownerControls) {
            throw new ShiftPlanningOwnerSheetsGuardError(
              "workbook_preservation_rejected",
            );
          }
          return {kind: "reconciliationRequired"};
        }
      } catch (error) {
        if (input.ownerControls) throw error;
        return {kind: "reconciliationRequired"};
      }
      const evidence = {
        workbookRevision: version,
        partitionDigest: createShiftPlanningDigest({
          projectionDigest: observed.readBackDigest,
        }),
      };
      const ownerProof = input.ownerControls ?
        await input.ownerControls.afterReadBack({
          command,
          receipt,
          evidence,
        }) :
        undefined;
      await input.repository.verifySubmission({
        token,
        evidence,
        ...(ownerProof ? {ownerProof} : {}),
      });
      return evidence;
    } catch (error) {
      await retainOwnerFailure(command, "readback", error);
      throw error;
    }
  };
  return {
    inspect,
    async authorizeCompletion(
      command,
      evidence,
    ): Promise<ShiftPlanningOwnerSheetsProof | undefined> {
      if (!input.ownerControls) return undefined;
      try {
        const receipt = await input.repository.readSubmission(
          tokenFor(command),
        );
        if (!receipt?.ownerMaintenance || receipt.guardIncident) {
          return failSheetsSubmission(
            "Owner completion has no healthy submission.",
          );
        }
        return await input.ownerControls.beforeCompletion({
          command,
          receipt,
          evidence,
        });
      } catch (error) {
        await retainOwnerFailure(command, "completion", error);
        throw error;
      }
    },
    async completionFailed(command, error): Promise<void> {
      await retainOwnerFailure(command, "completion", error);
    },
    async apply(command, authorizeMutation) {
      const token = tokenFor(command);
      try {
        if (await input.repository.readSubmission(token)) {
          return inspect(command);
        }
        const beforeWorkbookRevision = await input.readWorkbookVersion();
        const {rows, readable} = await loadShiftPlanningSheetsSource({
          ...input,
          command,
          readable: true,
        });
        const generationTabs = input.readGenerationTabs?.();
        if (readable && generationTabs) {
          readable.generationTabs = structuredClone(generationTabs);
        }
        let preparedOwnerBinding:
          | ShiftPlanningOwnerSheetsBinding
          | undefined;
        await input.sheets.reconcile({
          assertSubmissionNow: () => {
            if (preparedOwnerBinding) {
              input.ownerControls?.assertSubmissionNow(
                command,
                preparedOwnerBinding,
              );
            }
          },
          operationId: command.idempotencyKey,
          rows,
          generationRows: readable?.rows,
          generationTabs: readable?.generationTabs,
          async authorizeMutation(batch) {
            if (
              batch.workbookId !== command.workbookId ||
              (await input.readWorkbookVersion()) !== beforeWorkbookRevision
            ) {
              return failSheetsSubmission(
                "Workbook changed during planning.",
              );
            }
            await authorizeMutation();
            let ownerMaintenance = input.ownerControls ?
              await input.ownerControls.beforeSubmission({
                command,
                batch,
                beforeWorkbookRevision,
              }) :
              undefined;
            if (ownerMaintenance && input.ownerControls) {
              ownerMaintenance =
                await input.ownerControls.authorizePreparedSubmission({
                  command,
                  binding: ownerMaintenance,
                });
            }
            await input.repository.prepareSubmission({
              token,
              binding: {
                beforeWorkbookRevision,
                readable,
                projectionDigest: batch.projectionDigest,
                requestDigest: batch.requestDigest,
                ...(ownerMaintenance ? {ownerMaintenance} : {}),
              },
            });
            preparedOwnerBinding = ownerMaintenance;
          },
        });
        return inspect(command);
      } catch (error) {
        await retainOwnerFailure(command, "submission", error);
        throw error;
      }
    },
  };
};
