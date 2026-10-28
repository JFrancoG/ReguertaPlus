import {parseShiftPlanningOwnerSheetsCopyAuthority,
  ShiftPlanningOwnerSheetsCopyAuthority} from
  "./shift-planning-owner-sheets-copy-controls.js";
import {google} from "googleapis";
import type {drive_v3 as DriveV3, sheets_v4 as SheetsV4} from "googleapis";
import {Firestore, Timestamp} from "@google-cloud/firestore";
import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {ShiftSheetsConfig} from "./shift-sheets-config.js";
import {observeShiftSheetsWorkbook} from
  "./shift-sheets-operational-preflight.js";
import {
  createShiftSheetsAdapter,
  ShiftSheetsProjectionRow,
} from "./shift-sheets.js";
import {createShiftSheetsOwnerPreservationManifest} from
  "./shift-sheets-owner-manifest.js";
import {createFirestoreShiftPlanningSyncCommandRepository} from
  "./shift-planning-firestore-sync-command-repository.js";
import {createFirestoreShiftPlanningIntakeBarrierRepository} from
  "./shift-planning-firestore-intake-barrier-repository.js";
import {
  createFirestoreShiftPlanningSheetsConsumer,
  createShiftSheetsWorkbookVersionReader,
  loadShiftPlanningSheetsSource,
} from "./shift-planning-sheets-consumer.js";
import {executeShiftPlanningSyncCommand} from
  "./shift-planning-sync-command-executor.js";
import {
  parseShiftPlanningPersistedSyncCommand,
  ShiftPlanningProcessingSyncCommand,
} from "./shift-planning-sync-command.js";
import {
  parseShiftPlanningOwnerSheetsAuthorization,
  parseShiftPlanningOwnerSheetsAuthorizationIncident,
  shiftPlanningOwnerSheetsAuthorizationDigest,
  ShiftPlanningOwnerSheetsAuthorizationIncident,
} from "./shift-planning-owner-sheets-contract.js";
import {
  createShiftPlanningOwnerSheetsGuard,
  ShiftPlanningOwnerSheetsGuardError,
} from "./shift-planning-owner-sheets-guard.js";
import type {ShiftSheetsImportTab} from "./shift-sheets-import.js";

export type ShiftPlanningOwnerSheetsGoogleClients = {
  sheets: Pick<SheetsV4.Resource$Spreadsheets, "get" | "batchUpdate">;
  drive: {
    files: Pick<DriveV3.Resource$Files, "get">;
    about: Pick<DriveV3.Resource$About, "get">;
    permissions: Pick<DriveV3.Resource$Permissions, "list">;
  };
};
const fail = (): never => {
  throw new ShiftPlanningError(
    "invalid_planning_sync_command",
    "Pinned owner Sheets controls are unavailable or changed.",
  );
};
const identifier = (value: string): boolean =>
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);

/**
 * Composes actual Google SDK reads, existing Firestore receipts and one guarded
 * consumer. No Function export, grant or scheduler is created. The independent
 * fresh external-control reader has no implementation here: absence stays
 * unknown and cannot be replaced by a historical retained packet.
 * @param {object} input Reviewed private configuration and existing adapters.
 * @return {object} Explicit execution plus a strictly read-only preparation.
 */
export const createShiftPlanningOwnerSheetsComposition = (input: {
  firestore: Firestore;
  config: ShiftSheetsConfig;
  titles: readonly string[];
  authorizationDocumentId: string;
  commandId: string;
  expectedAuthorizationDigest: string;
  technicalTransitionId: string;
  runtimePrincipalId: string;
  clients?: ShiftPlanningOwnerSheetsGoogleClients;
  nowMillis?: () => number;
  readGenerationTabs?(): readonly ShiftSheetsImportTab[] | undefined;
  readCurrentExternalControls?(
    command: ShiftPlanningProcessingSyncCommand,
  ): Promise<unknown | null>;
  readCurrentCopyControls?(command: ShiftPlanningProcessingSyncCommand):
    Promise<unknown | null>;
  copyRehearsal?: {
    copyWorkbookId: string;
    protectedWorkbookIds: readonly string[];
    runId: string;
    authority?: ShiftPlanningOwnerSheetsCopyAuthority;
  };
}) => {
  const config = structuredClone(input.config);
  const titles = [...input.titles];
  const authorizationDocumentId = input.authorizationDocumentId;
  const pinnedCommandId = input.commandId;
  const expectedAuthorizationDigest = input.expectedAuthorizationDigest;
  const technicalTransitionId = input.technicalTransitionId;
  const runtimePrincipalId = input.runtimePrincipalId;
  const externalReader = input.readCurrentExternalControls;
  const generationTabsReader = input.readGenerationTabs;
  if (
    !identifier(authorizationDocumentId) ||
    !identifier(technicalTransitionId) ||
    !identifier(pinnedCommandId) ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(
      expectedAuthorizationDigest,
    ) ||
    !runtimePrincipalId ||
    new Set(titles).size !== titles.length
  ) {
    return fail();
  }
  const copy = input.copyRehearsal ?
    structuredClone(input.copyRehearsal) :
    undefined;
  if (
    copy &&
    (config.environment !== "develop" ||
      copy.copyWorkbookId !== config.workbookId ||
      copy.protectedWorkbookIds.length < 2 ||
      new Set(copy.protectedWorkbookIds).size !==
        copy.protectedWorkbookIds.length ||
      copy.protectedWorkbookIds.includes(copy.copyWorkbookId) ||
      !identifier(copy.runId))
  ) {
    return fail();
  }
  const copyAuthority = copy?.authority ?
    parseShiftPlanningOwnerSheetsCopyAuthority(copy.authority) : undefined;
  if (copyAuthority && (copyAuthority.workbookId !== config.workbookId ||
      copyAuthority.runId !== copy?.runId ||
      digest(copyAuthority.protectedWorkbookIds) !==
        digest(copy.protectedWorkbookIds) || !input.clients ||
      process.env.FIRESTORE_EMULATOR_HOST !== copyAuthority.firestoreHost ||
      !process.env.GCLOUD_PROJECT?.startsWith("demo-"))) return fail();
  // A copy run owns its client construction: environment variables cannot route
  // an injected live Firestore client to production by accident.
  const firestore = copyAuthority ? new Firestore({
    projectId: copyAuthority.demoProjectId, host: copyAuthority.firestoreHost,
    ssl: false,
  }) : input.firestore;
  const copyReader = input.readCurrentCopyControls;
  const nowMillis = input.nowMillis ?? Date.now;
  let clients = input.clients;
  if (!clients) {
    const auth = new google.auth.GoogleAuth({
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive.metadata.readonly",
      ],
    });
    clients = {
      sheets: google.sheets({version: "v4", auth}).spreadsheets,
      drive: google.drive({version: "v3", auth}),
    };
  }
  const resources = clients;
  const root = `${config.environment}/plus-collections`;
  const authorizationReference = firestore.doc(
    `${root}/shiftPlanningOperations/${authorizationDocumentId}`,
  );
  const evidenceRepository =
    createFirestoreShiftPlanningIntakeBarrierRepository(firestore);
  const repository = createFirestoreShiftPlanningSyncCommandRepository(
    firestore,
    () => Timestamp.fromMillis(nowMillis()),
  );
  const readAuthorization = async () => {
    const snapshot = await authorizationReference.get();
    if (!snapshot.exists) return fail();
    const authorization = parseShiftPlanningOwnerSheetsAuthorization(
      snapshot.data(),
    );
    if (
      authorization.commandId !== pinnedCommandId ||
      authorization.environment !== config.environment ||
      authorization.batchIntent.workbookId !== config.workbookId ||
      authorization.technicalTransitionId !== technicalTransitionId ||
      authorization.batchIntent.observerPrincipalId !==
        runtimePrincipalId ||
      shiftPlanningOwnerSheetsAuthorizationDigest(authorization) !==
        expectedAuthorizationDigest
    ) {
      return fail();
    }
    if (!snapshot.updateTime) return fail();
    return {
      authorization,
      authorizationSnapshot: {
        path: authorizationReference.path,
        updateTime: {
          seconds: snapshot.updateTime.seconds,
          nanoseconds: snapshot.updateTime.nanoseconds,
        },
        ownerReportDigest: digest(authorization.ownerReport),
      },
    };
  };
  const observeWorkbook = async (missing: readonly string[]) => {
    return observeShiftSheetsWorkbook({
      config,
      titles,
      files: resources.drive.files,
      permissions: resources.drive.permissions,
      about: resources.drive.about,
      sheets: resources.sheets,
      nowMillis,
      collector: "googleapis-raw",
      includePreservationCells: true,
      allowMissingReviewedTitles: missing,
    });
  };
  const readControls = async (
    command: ShiftPlanningProcessingSyncCommand,
  ) => {
    const initial = await readAuthorization();
    const {authorization} = initial;
    if (authorization.commandId !== command.commandId) return fail();
    const rejectObservedReport = async (
      observation: unknown,
    ): Promise<never> => {
      const observedDigest = digest(observation);
      const incident = {
        schemaVersion: 1,
        authorizationDigest: expectedAuthorizationDigest,
        phase: "before-submission",
        reason: "owner_controls_rejected",
        observationDigest: observedDigest,
        recordedAtMillis: nowMillis(),
      };
      await retainAuthorizationIncident(
        command,
        parseShiftPlanningOwnerSheetsAuthorizationIncident({
          ...incident,
          incidentDigest: digest(incident),
        }),
      );
      throw new ShiftPlanningOwnerSheetsGuardError(
        "owner_controls_rejected",
        observedDigest,
      );
    };
    if (
      authorization.controlIncident ||
      authorization.ownerReport.agreementStatus !== "confirmed" ||
      authorization.ownerReport.ownerActivity !== "none-reported" ||
      authorization.ownerReport.unresolvedWriteCount !== 0
    ) {
      return rejectObservedReport(initial);
    }
    const missing = authorization.preservationManifest.policy.additions.map(
      (value) => {
        if (
          typeof value.title !== "string" ||
          !titles.includes(value.title)
        ) {
          return fail();
        }
        return value.title;
      },
    );
    const workbook = (await observeWorkbook(missing)).privateObservation;
    const key = {
      environment: config.environment,
      transitionId: technicalTransitionId,
    };
    const [maintenance, retainedEvidence, failure, externalEvidence] =
      await Promise.all([
        firestore.doc(`${root}/shiftPlanningState/current`).get(),
        copyAuthority ? Promise.resolve(null) :
          evidenceRepository.readExisting(key),
        copyAuthority ? Promise.resolve(null) :
          evidenceRepository.readExistingFailure(key),
        copyAuthority ? copyReader?.(command) ?? Promise.resolve(null) :
          externalReader?.(command) ?? Promise.resolve(null),
      ]);
    const fresh = await readAuthorization();
    if (
      fresh.authorizationSnapshot.ownerReportDigest !==
        initial.authorizationSnapshot.ownerReportDigest ||
      fresh.authorizationSnapshot.updateTime.seconds !==
        initial.authorizationSnapshot.updateTime.seconds ||
      fresh.authorizationSnapshot.updateTime.nanoseconds !==
        initial.authorizationSnapshot.updateTime.nanoseconds
    ) {
      return rejectObservedReport({initial, fresh});
    }
    return {
      ...fresh,
      workbook,
      maintenance: maintenance.data(),
      retainedEvidence,
      failure,
      externalEvidence: copyAuthority ? null : externalEvidence,
      ...(copyAuthority ? {copyControls: externalEvidence} : {}),
    };
  };
  const retainAuthorizationIncident = async (
    command: ShiftPlanningProcessingSyncCommand,
    incident: ShiftPlanningOwnerSheetsAuthorizationIncident,
  ): Promise<void> => {
    const parsed =
      parseShiftPlanningOwnerSheetsAuthorizationIncident(incident);
    await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(authorizationReference);
      const authorization = parseShiftPlanningOwnerSheetsAuthorization(
        snapshot.data(),
      );
      const approved =
        shiftPlanningOwnerSheetsAuthorizationDigest(authorization);
      if (
        approved !== expectedAuthorizationDigest ||
        parsed.authorizationDigest !== approved ||
        authorization.commandId !== command.commandId
      ) {
        return fail();
      }
      if (authorization.controlIncident) return;
      transaction.update(authorizationReference, {controlIncident: parsed});
    });
  };
  const ownerControls = createShiftPlanningOwnerSheetsGuard({
    environment: config.environment,
    readControls,
    ...(copyAuthority ? {copyAuthority} : {}),
    retainAuthorizationIncident,
    nowMillis,
  });
  const consumer = createFirestoreShiftPlanningSheetsConsumer({
    firestore,
    config,
    repository,
    ownerControls,
    readGenerationTabs: generationTabsReader,
    sheets: createShiftSheetsAdapter({config, sheets: resources.sheets}),
    readWorkbookVersion: createShiftSheetsWorkbookVersionReader({
      workbookId: config.workbookId,
      files: resources.drive.files,
    }),
  });
  return {
    consumer,
    repository,
    readControls,
    async dispose() {
      if (copyAuthority) await firestore.terminate();
    },
    async execute(request: {
      commandId: string;
      workerId: string;
      attemptId: string;
    }) {
      if (request.commandId !== pinnedCommandId) return fail();
      const existing = await firestore
        .doc(`${root}/shiftPlanningSyncCommands/${pinnedCommandId}`)
        .get();
      const command = parseShiftPlanningPersistedSyncCommand(
        existing.data(),
      );
      if (command.state !== "completed") {
        if (
          (copy ? !copyAuthority || !copyReader : !externalReader) ||
          (await readAuthorization()).authorization.controlIncident
        ) {
          return fail();
        }
      }
      if (
        copy &&
        (!process.env.GCLOUD_PROJECT?.startsWith("demo-") ||
          process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8897")
      ) {
        return fail();
      }
      return executeShiftPlanningSyncCommand({
        repository,
        consumer,
        environment: config.environment,
        ...request,
      });
    },
    async prepareCopyRehearsal(request: {
      commandId: string;
      proposedWindow: {
        startsAtMillis: number;
        endsAtMillis: number;
        recoveryDeadlineMillis: number;
      };
    }) {
      if (!copy || request.commandId !== pinnedCommandId) return fail();
      const window = request.proposedWindow;
      if (
        ![
          window.startsAtMillis,
          window.endsAtMillis,
          window.recoveryDeadlineMillis,
        ].every((value) => Number.isSafeInteger(value) && value >= 0) ||
        window.startsAtMillis >= window.endsAtMillis ||
        window.endsAtMillis > window.recoveryDeadlineMillis
      ) {
        return fail();
      }
      const snapshot = await firestore
        .doc(`${root}/shiftPlanningSyncCommands/${request.commandId}`)
        .get();
      const command = parseShiftPlanningPersistedSyncCommand(
        snapshot.data(),
      );
      const source = await loadShiftPlanningSheetsSource({
        firestore,
        config,
        command,
        readable: true,
      });
      const observation = await observeWorkbook(titles);
      let planned: {batch: unknown; preservationManifest: unknown} | null =
        null;
      const stop = new Error("copy_preparation_has_no_write_path");
      const readOnlySheets = {
        ...resources.sheets,
        get: resources.sheets.get.bind(resources.sheets),
        batchUpdate: async () => {
          throw stop;
        },
      };
      try {
        await createShiftSheetsAdapter({
          config,
          sheets: readOnlySheets,
        }).reconcile({
          operationId: command.idempotencyKey,
          rows: source.rows as ShiftSheetsProjectionRow[],
          generationRows: source.readable?.rows,
          generationTabs: generationTabsReader?.(),
          async authorizeMutation(batch) {
            planned = {
              batch,
              preservationManifest:
                createShiftSheetsOwnerPreservationManifest({
                  before: observation.privateObservation.snapshot,
                  requests: batch.requests,
                }),
            };
            throw stop;
          },
        });
      } catch (error) {
        if (error !== stop) throw error;
      }
      return {
        schemaVersion: 1,
        kind: "owner-copy-rehearsal-preparation",
        canApply: false,
        operationalReady: false,
        copyWorkbookId: copy.copyWorkbookId,
        runId: copy.runId,
        proposedWindow: window,
        privateObservation: observation.privateObservation,
        planned,
        blockers: [
          "owner_window_confirmation_required",
          "fresh_external_control_proof_required",
          "separate_copy_execution_authorization_required",
        ],
      };
    },
  };
};
