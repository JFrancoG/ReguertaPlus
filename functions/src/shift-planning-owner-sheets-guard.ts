import {parseShiftPlanningOwnerSheetsCopyAuthority,
  verifyShiftPlanningOwnerSheetsCopyObservation,
  ShiftPlanningOwnerSheetsCopyAuthority} from
  "./shift-planning-owner-sheets-copy-controls.js";
import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {parseShiftPlanningMaintenanceState} from "./shift-planning-wire.js";
import {assertShiftPlanningOwnerMaintenanceWindow} from
  "./shift-planning-owner-maintenance.js";
import {verifyShiftPlanningOwnerSheetsTechnicalEvidence} from
  "./shift-planning-intake-barrier.js";
import {observeShiftSheetsWorkbook} from
  "./shift-sheets-operational-preflight.js";
import {
  assertShiftSheetsOwnerPreservation,
  createShiftSheetsOwnerPreservationManifest,
} from "./shift-sheets-owner-manifest.js";
import {ShiftSheetsBatchBinding} from "./shift-sheets.js";
import {
  ShiftPlanningProcessingSyncCommand,
  ShiftPlanningSyncReadBackEvidence,
} from "./shift-planning-sync-command.js";
import type {ShiftPlanningSheetsSubmission} from
  "./shift-planning-sheets-submission.js";
import {
  parseShiftPlanningOwnerSheetsAuthorization,
  parseShiftPlanningOwnerSheetsBinding,
  parseShiftPlanningOwnerSheetsProof,
  parseShiftPlanningOwnerSheetsIncident,
  parseShiftPlanningOwnerSheetsAuthorizationIncident,
  shiftPlanningOwnerSheetsAuthorizationDigest,
  ShiftPlanningOwnerSheetsBinding,
  ShiftPlanningOwnerSheetsProof,
  ShiftPlanningOwnerSheetsIncident,
  ShiftPlanningOwnerSheetsAuthorizationIncident,
  ShiftPlanningOwnerSheetsAuthorization,
  ShiftPlanningOwnerSheetsAuthorizationSnapshot,
} from "./shift-planning-owner-sheets-contract.js";

export type ShiftPlanningOwnerSheetsControls = {
  authorization: unknown;
  authorizationSnapshot: ShiftPlanningOwnerSheetsAuthorizationSnapshot;
  workbook: Awaited<
    ReturnType<typeof observeShiftSheetsWorkbook>
  >["privateObservation"];
  maintenance: unknown;
  retainedEvidence: unknown;
  externalEvidence: unknown | null;
  failure: unknown | null;
  copyControls?: unknown;
};
/** A blocked phase retains only a stable reason and observation digest. */
export class ShiftPlanningOwnerSheetsGuardError extends ShiftPlanningError {
  /**
   * @param {string} reason Typed incident cause, never raw provider payload.
   * @param {string|null} observationDigest Observed controls, if available.
   */
  constructor(
    readonly reason: ShiftPlanningOwnerSheetsIncident["reason"],
    readonly observationDigest: string | null = null,
  ) {
    super(
      "invalid_planning_sync_command",
      "Owner Sheets controls did not admit progression.",
    );
  }
}
export type ShiftPlanningOwnerSheetsGuard = {
  beforeSubmission(input: {
    command: ShiftPlanningProcessingSyncCommand;
    batch: ShiftSheetsBatchBinding;
    beforeWorkbookRevision: string;
  }): Promise<ShiftPlanningOwnerSheetsBinding>;
  assertSubmissionNow(
    command: ShiftPlanningProcessingSyncCommand,
    binding: ShiftPlanningOwnerSheetsBinding,
  ): void;
  authorizePreparedSubmission(input: {
    command: ShiftPlanningProcessingSyncCommand;
    binding: ShiftPlanningOwnerSheetsBinding;
  }): Promise<ShiftPlanningOwnerSheetsBinding>;
  afterReadBack(input: {
    command: ShiftPlanningProcessingSyncCommand;
    receipt: ShiftPlanningSheetsSubmission;
    evidence: ShiftPlanningSyncReadBackEvidence;
  }): Promise<ShiftPlanningOwnerSheetsProof>;
  beforeCompletion(input: {
    command: ShiftPlanningProcessingSyncCommand;
    receipt: ShiftPlanningSheetsSubmission;
    evidence: ShiftPlanningSyncReadBackEvidence;
  }): Promise<ShiftPlanningOwnerSheetsProof>;
  incident(
    binding: ShiftPlanningOwnerSheetsBinding,
    phase: ShiftPlanningOwnerSheetsIncident["phase"],
    error: unknown,
  ): ShiftPlanningOwnerSheetsIncident;
};

/**
 * Gates the existing submission path without adding a queue or retry.
 * Every phase reads current controls, including the independent external hold.
 * Missing read authority never becomes a zero pending/in-flight declaration.
 * @param {object} input Fresh read composition and trusted operation clock.
 * @return {ShiftPlanningOwnerSheetsGuard} Explicit phase guard.
 */
export const createShiftPlanningOwnerSheetsGuard = (input: {
  readControls(
    command: ShiftPlanningProcessingSyncCommand,
  ): Promise<ShiftPlanningOwnerSheetsControls>;
  nowMillis(): number;
  copyAuthority?: ShiftPlanningOwnerSheetsCopyAuthority;
  environment: "develop" | "production";
  retainAuthorizationIncident(
    command: ShiftPlanningProcessingSyncCommand,
    incident: ShiftPlanningOwnerSheetsAuthorizationIncident,
  ): Promise<void>;
}): ShiftPlanningOwnerSheetsGuard => {
  const reject = (
    reason: ShiftPlanningOwnerSheetsIncident["reason"],
    observationDigest: string | null,
  ): never => {
    throw new ShiftPlanningOwnerSheetsGuardError(reason, observationDigest);
  };
  type ControlValue = {
    authorization: ShiftPlanningOwnerSheetsAuthorization;
    authorizationSnapshot: ShiftPlanningOwnerSheetsAuthorizationSnapshot;
    workbook: ShiftPlanningOwnerSheetsControls["workbook"];
    observationDigest: string;
    now: number;
    controlsValidUntilMillis: number;
  };
  const controls = async (
    command: ShiftPlanningProcessingSyncCommand,
    phase: "before-submission" | "after-submission",
    bindingDigest?: string,
  ): Promise<ControlValue> => {
    let observed: ShiftPlanningOwnerSheetsControls;
    try {
      observed = await input.readControls(command);
    } catch (error) {
      if (error instanceof ShiftPlanningOwnerSheetsGuardError) throw error;
      return reject("owner_controls_unavailable", null);
    }
    const observationDigest = digest(observed);
    let authorizationDigest: string | null = null;
    try {
      const authorization = parseShiftPlanningOwnerSheetsAuthorization(
        observed.authorization,
      );
      authorizationDigest =
        shiftPlanningOwnerSheetsAuthorizationDigest(authorization);
      if (authorization.controlIncident) {
        return reject("owner_controls_rejected", observationDigest);
      }
      const batch = authorization.batchIntent;
      const state = parseShiftPlanningMaintenanceState(
        observed.maintenance,
      );
      const now = input.nowMillis();
      let technicalExpiresAtMillis: number;
      if (input.copyAuthority) {
        const authority = parseShiftPlanningOwnerSheetsCopyAuthority(
          input.copyAuthority,
        );
        if (batch.schemaVersion !== 2 ||
            digest(authorization.copyAuthority) !== digest(authority) ||
            batch.technicalEvidenceDigest !== digest(authority)) {
          return reject("owner_controls_rejected", observationDigest);
        }
        try {
          technicalExpiresAtMillis =
            verifyShiftPlanningOwnerSheetsCopyObservation({
              authority, observation: observed.copyControls,
              nowMillis: now, phase,
              requestDigest: batch.requestDigest, bindingDigest,
            });
        } catch {
          return reject("owner_controls_rejected", observationDigest);
        }
      } else {
        if (batch.schemaVersion !== 1 || observed.externalEvidence === null ||
            observed.failure !== null) {
          return reject("owner_controls_unavailable", observationDigest);
        }
        const retained = verifyShiftPlanningOwnerSheetsTechnicalEvidence(
          observed.retainedEvidence, batch.technicalEvidenceDigest,
          batch.environment, batch.workbookId, now,
        );
        const current = verifyShiftPlanningOwnerSheetsTechnicalEvidence(
          observed.externalEvidence, batch.technicalEvidenceDigest,
          batch.environment, batch.workbookId, now,
        );
        technicalExpiresAtMillis = Math.min(retained.technicalExpiresAtMillis,
          current.technicalExpiresAtMillis);
      }
      if (
        authorization.commandId !== command.commandId ||
        batch.commandDigest !== command.commandDigest ||
        batch.operationId !== command.idempotencyKey ||
        batch.workbookId !== command.workbookId ||
        batch.environment !== input.environment ||
        batch.writeEpoch !== command.writeEpoch ||
        batch.activeRevision !== command.expectedActiveRevision ||
        batch.activeDigest !== command.expectedActiveDigest ||
        state.maintenanceStatus !== "closed" ||
        state.writeEpoch !== command.writeEpoch ||
        state.activeRevision !== command.expectedActiveRevision ||
        state.activeDigest !== command.expectedActiveDigest
      ) {
        return reject("command_authority_changed", observationDigest);
      }
      const workbook = observed.workbook;
      const owners = workbook.file.owners;
      const owner = authorization.agreement.payload.intent.ownerPrincipalId;
      if (input.copyAuthority &&
          (workbook.principal.emailAddress !==
            input.copyAuthority.serviceAccountEmail ||
          workbook.file.driveId !== null ||
          workbook.permissions?.some((permission) => {
            // The named owner may inherit a writer grant without adding any
            // actor beyond the retained owner capability in this agreement.
            const namedOwner = permission.id === owner &&
              permission.role === "owner" && owners.length === 1 &&
              owners[0].permissionId === owner;
            return ["owner", "writer", "organizer", "fileOrganizer"].includes(
              permission.role ?? "",
            ) && (permission.type !== "user" || (!namedOwner &&
              permission.permissionDetails.some((detail) =>
                detail.inherited === true)));
          }))) {
        return reject("owner_controls_rejected", observationDigest);
      }
      if (
        workbook.file.id !== batch.workbookId ||
        workbook.principal.permissionId !== batch.observerPrincipalId ||
        workbook.permissions === null ||
        owners.length !== 1 ||
        owners[0].permissionId !== owner ||
        workbook.file.capabilities.canEdit !== true ||
        workbook.file.capabilities.canModifyContent !== true ||
        typeof workbook.file.capabilities
          .canModifyEditorContentRestriction !== "boolean" ||
        typeof workbook.file.capabilities
          .canModifyOwnerContentRestriction !== "boolean" ||
        typeof workbook.file.capabilities.canRemoveContentRestriction !==
          "boolean" ||
        workbook.file.contentRestrictions === null ||
        workbook.file.contentRestrictions.some(
          (restriction) => restriction.readOnly !== false,
        ) ||
        workbook.authorityDigest !== batch.beforeAclDigest ||
        workbook.permissions.some(
          (permission) =>
            ["owner", "writer", "organizer", "fileOrganizer"].includes(
              permission.role ?? "",
            ) &&
            permission.id !== owner &&
            permission.id !== batch.observerPrincipalId,
        )
      ) {
        return reject("owner_controls_rejected", observationDigest);
      }
      const agreement = authorization.agreement;
      if (
        now < agreement.payload.intent.startsAtMillis ||
        now >= agreement.payload.intent.endsAtMillis
      ) {
        return reject("owner_window_expired", observationDigest);
      }
      const controlsValidUntilMillis = Math.min(
        technicalExpiresAtMillis,
        workbook.observedAtMillis + batch.maximumEvidenceAgeMillis,
        agreement.payload.intent.endsAtMillis,
      );
      if (now >= controlsValidUntilMillis) {
        return reject("owner_controls_unavailable", observationDigest);
      }
      const value = {
        controlsValidUntilMillis,
        authorization,
        authorizationSnapshot: observed.authorizationSnapshot,
        workbook,
        observationDigest,
        now,
      };
      humanWindow(value);
      return value;
    } catch (error) {
      if (
        authorizationDigest &&
        error instanceof ShiftPlanningOwnerSheetsGuardError &&
        error.reason !== "owner_controls_unavailable"
      ) {
        const incident = {
          schemaVersion: 1,
          authorizationDigest,
          phase: "before-submission",
          reason: error.reason,
          observationDigest: error.observationDigest,
          recordedAtMillis: input.nowMillis(),
        };
        await input.retainAuthorizationIncident(
          command,
          parseShiftPlanningOwnerSheetsAuthorizationIncident({
            ...incident,
            incidentDigest: digest(incident),
          }),
        );
      }
      if (error instanceof ShiftPlanningOwnerSheetsGuardError) throw error;
      return reject("owner_controls_rejected", observationDigest);
    }
  };
  const humanWindow = (value: ControlValue) => {
    const {authorization, workbook, now} = value;
    const batch = authorization.batchIntent;
    const report = authorization.ownerReport;
    try {
      assertShiftPlanningOwnerMaintenanceWindow({
        agreement: authorization.agreement,
        observation: {
          workbookFileId: batch.workbookId,
          ownerPrincipalId: workbook.file.owners[0].permissionId,
          participantsDigest: report.participantsDigest,
          effectiveAuthorityDigest: report.effectiveAuthorityDigest,
          sourceRevision: workbook.workbookVersionAfter,
          sourceDigest: workbook.contentDigest,
          technicalCapability: "retained",
          permissionWorkflowClosed: report.permissionWorkflowClosed,
          permissionControlEvidenceDigest:
            report.permissionControlEvidenceDigest,
          agreementStatus: report.agreementStatus,
          ownerActivity: report.ownerActivity,
          unresolvedWriteCount: report.unresolvedWriteCount,
          observedAtMillis: workbook.observedAtMillis,
        },
        environment: batch.environment,
        operationId: batch.operationId,
        operationKind: "sheets-batch",
        operationManifestDigest: digest(batch),
        workbookFileId: batch.workbookId,
        sourceRevision: workbook.workbookVersionAfter,
        sourceDigest: workbook.contentDigest,
        nowMillis: now,
        maximumEvidenceAgeMillis: batch.maximumEvidenceAgeMillis,
        requireFreshWindow: true,
      });
    } catch {
      return reject("owner_controls_rejected", value.observationDigest);
    }
  };
  const retainPreSubmissionFailure = async (
    command: ShiftPlanningProcessingSyncCommand,
    value: ControlValue,
    error: ShiftPlanningOwnerSheetsGuardError,
  ): Promise<void> => {
    const incident = {
      schemaVersion: 1,
      authorizationDigest: shiftPlanningOwnerSheetsAuthorizationDigest(
        value.authorization,
      ),
      phase: "before-submission",
      reason: error.reason,
      observationDigest: error.observationDigest,
      recordedAtMillis: input.nowMillis(),
    };
    await input.retainAuthorizationIncident(
      command,
      parseShiftPlanningOwnerSheetsAuthorizationIncident({
        ...incident,
        incidentDigest: digest(incident),
      }),
    );
  };
  const checked = async (
    request: {
      command: ShiftPlanningProcessingSyncCommand;
      receipt: ShiftPlanningSheetsSubmission;
      evidence: ShiftPlanningSyncReadBackEvidence;
    },
    phase: "readback" | "completion",
  ): Promise<ShiftPlanningOwnerSheetsProof> => {
    const receipt = request.receipt;
    if (!receipt.ownerMaintenance || receipt.guardIncident) {
      return reject("owner_controls_rejected", null);
    }
    const binding = parseShiftPlanningOwnerSheetsBinding(
      receipt.ownerMaintenance,
    );
    const value = await controls(request.command, "after-submission",
      binding.bindingDigest);
    try {
      if (
        binding.authorizationDigest !==
          shiftPlanningOwnerSheetsAuthorizationDigest(
            value.authorization,
          ) ||
        digest(binding.batchIntent) !==
          digest(value.authorization.batchIntent) ||
        binding.claim.workerId !== request.command.claim.workerId ||
        binding.claim.attemptId !== request.command.claim.attemptId ||
        binding.claim.fencingEpoch !== request.command.claim.fencingEpoch ||
        request.evidence.workbookRevision !==
          value.workbook.workbookVersionAfter ||
        request.evidence.partitionDigest !==
          digest({projectionDigest: binding.batchIntent.projectionDigest})
      ) {
        return reject("owner_controls_rejected", value.observationDigest);
      }
      humanWindow(value);
      assertShiftSheetsOwnerPreservation({
        manifest: binding.preservationManifest,
        after: value.workbook.snapshot,
      });
      const proof = {
        schemaVersion: 1,
        bindingDigest: binding.bindingDigest,
        phase,
        observationDigest: value.observationDigest,
        authorizationSnapshot: value.authorizationSnapshot,
        controlsValidUntilMillis: value.controlsValidUntilMillis,
        verifiedAtMillis: value.workbook.observedAtMillis,
      };
      return parseShiftPlanningOwnerSheetsProof({
        ...proof,
        proofDigest: digest(proof),
      });
    } catch (error) {
      if (error instanceof ShiftPlanningOwnerSheetsGuardError) throw error;
      return reject(
        "workbook_preservation_rejected",
        value.observationDigest,
      );
    }
  };
  return {
    async beforeSubmission({command, batch, beforeWorkbookRevision}) {
      const value = await controls(command, "before-submission");
      const approved = value.authorization.batchIntent;
      try {
        humanWindow(value);
        const preservation = createShiftSheetsOwnerPreservationManifest({
          before: value.workbook.snapshot,
          requests: batch.requests,
        });
        if (
          beforeWorkbookRevision !== approved.beforeWorkbookRevision ||
          value.workbook.workbookVersionBefore !== beforeWorkbookRevision ||
          value.workbook.contentDigest !== approved.beforeContentDigest ||
          batch.workbookId !== approved.workbookId ||
          batch.requestDigest !== approved.requestDigest ||
          batch.projectionDigest !== approved.projectionDigest ||
          preservation.requestDigest !== approved.requestDigest ||
          preservation.preservationDigest !== approved.preservationDigest ||
          preservation.digest !== approved.preservationManifestDigest ||
          value.workbook.protectionsDigest !==
            approved.beforeProtectionsDigest ||
          value.authorization.agreement.payload.intent.sourceRevision !==
            approved.beforeWorkbookRevision ||
          value.authorization.agreement.payload.intent.sourceDigest !==
            approved.beforeContentDigest ||
          value.authorization.agreement.payload.intent
            .affectedScopeDigest !== digest(approved)
        ) {
          return reject("owner_controls_rejected", value.observationDigest);
        }
        const binding = {
          schemaVersion: 1,
          authorizationDigest: shiftPlanningOwnerSheetsAuthorizationDigest(
            value.authorization,
          ),
          authorizationSnapshot: value.authorizationSnapshot,
          agreement: value.authorization.agreement,
          batchIntent: approved,
          preservationManifest: preservation,
          ...(value.authorization.copyAuthority ?
            {copyAuthority: value.authorization.copyAuthority} : {}),
          claim: {
            workerId: command.claim.workerId,
            attemptId: command.claim.attemptId,
            fencingEpoch: command.claim.fencingEpoch,
            acquiredAtMillis: command.claim.acquiredAt.toMillis(),
            expiresAtMillis: command.claim.expiresAt.toMillis(),
          },
          controlsValidUntilMillis: value.controlsValidUntilMillis,
          preparedAtMillis: input.nowMillis(),
        };
        return parseShiftPlanningOwnerSheetsBinding({
          ...binding,
          bindingDigest: digest(binding),
        });
      } catch (error) {
        const rejected =
          error instanceof ShiftPlanningOwnerSheetsGuardError ?
            error :
            new ShiftPlanningOwnerSheetsGuardError(
              "workbook_preservation_rejected",
              value.observationDigest,
            );
        await retainPreSubmissionFailure(command, value, rejected);
        throw rejected;
      }
    },
    async authorizePreparedSubmission({command, binding}) {
      const value = await controls(command, "before-submission");
      if (
        binding.authorizationDigest !==
          shiftPlanningOwnerSheetsAuthorizationDigest(
            value.authorization,
          ) ||
        value.workbook.workbookVersionAfter !==
          binding.batchIntent.beforeWorkbookRevision ||
        value.workbook.contentDigest !==
          binding.batchIntent.beforeContentDigest ||
        value.workbook.protectionsDigest !==
          binding.batchIntent.beforeProtectionsDigest
      ) {
        const error = new ShiftPlanningOwnerSheetsGuardError(
          "owner_controls_rejected",
          value.observationDigest,
        );
        await retainPreSubmissionFailure(command, value, error);
        throw error;
      }
      humanWindow(value);
      const refreshed = {
        ...binding,
        authorizationSnapshot: value.authorizationSnapshot,
        controlsValidUntilMillis: value.controlsValidUntilMillis,
      };
      const {bindingDigest: previousDigest, ...unsigned} = refreshed;
      void previousDigest;
      return parseShiftPlanningOwnerSheetsBinding({
        ...unsigned,
        bindingDigest: digest(unsigned),
      });
    },
    assertSubmissionNow(command, binding) {
      const now = input.nowMillis();
      if (
        !Number.isSafeInteger(now) ||
        now < binding.agreement.payload.intent.startsAtMillis ||
        now >= binding.agreement.payload.intent.endsAtMillis ||
        now >= binding.controlsValidUntilMillis ||
        now >= binding.claim.expiresAtMillis ||
        binding.claim.expiresAtMillis !== command.claim.expiresAt.toMillis()
      ) {
        return reject("owner_window_expired", null);
      }
    },
    afterReadBack: (request) => checked(request, "readback"),
    beforeCompletion: (request) => checked(request, "completion"),
    incident(binding, phase, error) {
      const incident = {
        schemaVersion: 1,
        bindingDigest: binding.bindingDigest,
        phase,
        reason:
          error instanceof ShiftPlanningOwnerSheetsGuardError ?
            error.reason :
            "owner_controls_unavailable",
        observationDigest:
          error instanceof ShiftPlanningOwnerSheetsGuardError ?
            error.observationDigest :
            null,
        recordedAtMillis: input.nowMillis(),
      };
      return parseShiftPlanningOwnerSheetsIncident({
        ...incident,
        incidentDigest: digest(incident),
      });
    },
  };
};
