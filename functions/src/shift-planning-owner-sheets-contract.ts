import {parseShiftPlanningOwnerSheetsCopyAuthority,
  ShiftPlanningOwnerSheetsCopyAuthority} from
  "./shift-planning-owner-sheets-copy-controls.js";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {
  canonicalShiftPlanningJson,
  createShiftPlanningDigest as digest,
} from "./shift-planning-digest.js";
import {
  parseShiftPlanningOwnerMaintenanceAgreement,
  ShiftPlanningOwnerMaintenanceAgreement,
} from "./shift-planning-owner-maintenance.js";
import {
  parseShiftSheetsOwnerPreservationManifest,
  ShiftSheetsOwnerPreservationManifest,
} from "./shift-sheets-owner-manifest.js";

export type ShiftPlanningOwnerSheetsBatchIntent = {
  schemaVersion: 1 | 2;
  kind: "owner-sheets-batch";
  technicalControlKind?: "isolated-copy-runtime";
  environment: "develop" | "production";
  workbookId: string;
  commandId: string;
  commandDigest: string;
  operationId: string;
  writeEpoch: number;
  activeRevision: string;
  activeDigest: string;
  beforeWorkbookRevision: string;
  beforeContentDigest: string;
  beforeAclDigest: string;
  beforeProtectionsDigest: string;
  observerPrincipalId: string;
  projectionDigest: string;
  requestDigest: string;
  preservationDigest: string;
  preservationManifestDigest: string;
  technicalEvidenceDigest: string;
  maximumEvidenceAgeMillis: number;
};
export type ShiftPlanningOwnerSheetsAuthorization = {
  schemaVersion: 1;
  operationKind: "ownerSheetsAuthorization";
  environment: "develop" | "production";
  commandId: string;
  technicalTransitionId: string;
  agreement: ShiftPlanningOwnerMaintenanceAgreement;
  batchIntent: ShiftPlanningOwnerSheetsBatchIntent;
  preservationManifest: ShiftSheetsOwnerPreservationManifest;
  copyAuthority?: ShiftPlanningOwnerSheetsCopyAuthority;
  controlIncident?: ShiftPlanningOwnerSheetsAuthorizationIncident;
  ownerReport: {
    agreementDigest: string;
    agreementStatus: "confirmed" | "withdrawn";
    ownerActivity: "none-reported" | "reported";
    unresolvedWriteCount: number;
    participantsDigest: string;
    effectiveAuthorityDigest: string;
    permissionWorkflowClosed: boolean;
    permissionControlEvidenceDigest: string | null;
  };
};
export type ShiftPlanningOwnerSheetsAuthorizationSnapshot = {
  path: string;
  updateTime: {seconds: number; nanoseconds: number};
  ownerReportDigest: string;
};
export type ShiftPlanningOwnerSheetsBinding = {
  schemaVersion: 1;
  authorizationDigest: string;
  authorizationSnapshot: ShiftPlanningOwnerSheetsAuthorizationSnapshot;
  agreement: ShiftPlanningOwnerMaintenanceAgreement;
  batchIntent: ShiftPlanningOwnerSheetsBatchIntent;
  preservationManifest: ShiftSheetsOwnerPreservationManifest;
  copyAuthority?: ShiftPlanningOwnerSheetsCopyAuthority;
  claim: {
    workerId: string;
    attemptId: string;
    fencingEpoch: number;
    acquiredAtMillis: number;
    expiresAtMillis: number;
  };
  controlsValidUntilMillis: number;
  preparedAtMillis: number;
  bindingDigest: string;
};
export type ShiftPlanningOwnerSheetsProof = {
  schemaVersion: 1;
  bindingDigest: string;
  phase: "readback" | "completion";
  observationDigest: string;
  authorizationSnapshot: ShiftPlanningOwnerSheetsAuthorizationSnapshot;
  controlsValidUntilMillis: number;
  verifiedAtMillis: number;
  proofDigest: string;
};
export type ShiftPlanningOwnerSheetsIncident = {
  schemaVersion: 1;
  bindingDigest: string;
  phase: "submission" | "readback" | "completion";
  reason:
    | "owner_controls_rejected"
    | "owner_controls_unavailable"
    | "owner_window_expired"
    | "workbook_preservation_rejected"
    | "command_authority_changed";
  observationDigest: string | null;
  recordedAtMillis: number;
  incidentDigest: string;
};
export type ShiftPlanningOwnerSheetsAuthorizationIncident = {
  schemaVersion: 1;
  authorizationDigest: string;
  phase: "before-submission";
  reason: ShiftPlanningOwnerSheetsIncident["reason"];
  observationDigest: string | null;
  recordedAtMillis: number;
  incidentDigest: string;
};
type RecordValue = Record<string, unknown>;
const fail = (): never => {
  throw new ShiftPlanningError(
    "invalid_planning_sync_command",
    "Owner Sheets authorization or retained control evidence is invalid.",
  );
};
const record = (value: unknown): RecordValue => {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return fail();
  }
  return value as RecordValue;
};
const exact = (value: RecordValue, keys: readonly string[]): void => {
  if (
    Object.keys(value).length !== keys.length ||
    Object.keys(value).some((key) => !keys.includes(key))
  ) {
    fail();
  }
};
const id = (value: unknown): void => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9@._:+-]{0,255}$/.test(value)
  ) {
    fail();
  }
};
const hash = (value: unknown): void => {
  if (
    typeof value !== "string" ||
    !/^shift-(planning|sheets):v1:sha256:[a-f0-9]{64}$/.test(value)
  ) {
    fail();
  }
};
const count = (value: unknown): void => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail();
};
const detached = (value: unknown): RecordValue =>
  record(JSON.parse(canonicalShiftPlanningJson(value)));
const verifiedDigest = (value: RecordValue, field: string): void => {
  const unsigned = {...value};
  delete unsigned[field];
  if (value[field] !== digest(unsigned)) fail();
};

/**
 * Parses one preapproved batch, never approving hashes discovered at execution.
 * Drive versions are observations; expected managed and preserved images are
 * bound independently to the exact command and owner commitment.
 * @param {unknown} value Reviewed batch intent.
 * @return {ShiftPlanningOwnerSheetsBatchIntent} Detached intent.
 */
export const parseShiftPlanningOwnerSheetsBatchIntent = (
  value: unknown,
): ShiftPlanningOwnerSheetsBatchIntent => {
  const input = detached(value);
  exact(input, [
    "schemaVersion",
    "kind",
    "environment",
    "workbookId",
    "commandId",
    "commandDigest",
    "operationId",
    "writeEpoch",
    "activeRevision",
    "activeDigest",
    "beforeWorkbookRevision",
    "beforeContentDigest",
    "beforeAclDigest",
    "beforeProtectionsDigest",
    "observerPrincipalId",
    "projectionDigest",
    "requestDigest",
    "preservationDigest",
    "preservationManifestDigest",
    "technicalEvidenceDigest",
    "maximumEvidenceAgeMillis",
    ...(input.schemaVersion === 2 ? ["technicalControlKind"] : []),
  ]);
  if (
    ![1, 2].includes(input.schemaVersion as number) ||
    (input.schemaVersion === 2 &&
      (input.technicalControlKind !== "isolated-copy-runtime" ||
        input.environment !== "develop")) ||
    input.kind !== "owner-sheets-batch" ||
    !["develop", "production"].includes(input.environment as string) ||
    typeof input.beforeWorkbookRevision !== "string" ||
    !/^[1-9][0-9]{0,18}$/.test(input.beforeWorkbookRevision)
  ) {
    fail();
  }
  for (const key of [
    "workbookId",
    "commandId",
    "operationId",
    "activeRevision",
    "observerPrincipalId",
  ]) {
    id(input[key]);
  }
  for (const key of [
    "commandDigest",
    "activeDigest",
    "beforeContentDigest",
    "beforeAclDigest",
    "beforeProtectionsDigest",
    "projectionDigest",
    "requestDigest",
    "preservationDigest",
    "preservationManifestDigest",
    "technicalEvidenceDigest",
  ]) {
    hash(input[key]);
  }
  count(input.writeEpoch);
  count(input.maximumEvidenceAgeMillis);
  if (input.maximumEvidenceAgeMillis === 0) fail();
  return input as ShiftPlanningOwnerSheetsBatchIntent;
};

/**
 * Validates the existing operation-registry record and human report separately.
 * A report is required; absence is not evidence of no activity.
 * @param {unknown} value Reviewed registry record read from its pinned path.
 * @return {ShiftPlanningOwnerSheetsAuthorization} Bound authorization.
 */
export const parseShiftPlanningOwnerSheetsAuthorization = (
  value: unknown,
): ShiftPlanningOwnerSheetsAuthorization => {
  const input = detached(value);
  exact(input, [
    "schemaVersion",
    "operationKind",
    "environment",
    "commandId",
    "technicalTransitionId",
    "agreement",
    "batchIntent",
    "preservationManifest",
    "ownerReport",
    ...(Object.prototype.hasOwnProperty.call(input, "copyAuthority") ?
      ["copyAuthority"] : []),
    ...(Object.prototype.hasOwnProperty.call(input, "controlIncident") ?
      ["controlIncident"] :
      []),
  ]);
  const batch = parseShiftPlanningOwnerSheetsBatchIntent(input.batchIntent);
  const agreement = parseShiftPlanningOwnerMaintenanceAgreement(
    input.agreement, batch.schemaVersion === 2,
  );
  validateCopyAuthority(input.copyAuthority, batch, agreement);
  const preservation = parseShiftSheetsOwnerPreservationManifest(
    input.preservationManifest,
  );
  if (
    preservation.digest !== batch.preservationManifestDigest ||
    preservation.requestDigest !== batch.requestDigest ||
    preservation.preservationDigest !== batch.preservationDigest ||
    preservation.workbookId !== batch.workbookId ||
    agreement.payload.intent.participants.some(
      (participant) =>
        participant.principalId === batch.observerPrincipalId,
    )
  ) {
    fail();
  }
  if (
    input.schemaVersion !== 1 ||
    input.operationKind !== "ownerSheetsAuthorization" ||
    input.environment !== batch.environment ||
    input.commandId !== batch.commandId ||
    agreement.payload.intent.environment !== batch.environment ||
    agreement.payload.intent.workbookFileId !== batch.workbookId ||
    agreement.payload.intent.expectedWriteEpoch !== batch.writeEpoch ||
    agreement.payload.intent.expectedActiveRevision !==
      batch.activeRevision ||
    agreement.payload.intent.expectedActiveDigest !== batch.activeDigest ||
    !agreement.payload.intent.operations.some(
      (operation) =>
        operation.kind === "sheets-batch" &&
        operation.operationId === batch.operationId &&
        operation.manifestDigest === digest(batch),
    )
  ) {
    fail();
  }
  id(input.technicalTransitionId);
  const report = record(input.ownerReport);
  exact(report, [
    "agreementDigest",
    "agreementStatus",
    "ownerActivity",
    "unresolvedWriteCount",
    "participantsDigest",
    "effectiveAuthorityDigest",
    "permissionWorkflowClosed",
    "permissionControlEvidenceDigest",
  ]);
  if (
    report.agreementDigest !== agreement.digest ||
    !["confirmed", "withdrawn"].includes(
      report.agreementStatus as string,
    ) ||
    !["none-reported", "reported"].includes(
      report.ownerActivity as string,
    ) ||
    typeof report.permissionWorkflowClosed !== "boolean"
  ) {
    fail();
  }
  count(report.unresolvedWriteCount);
  hash(report.participantsDigest);
  hash(report.effectiveAuthorityDigest);
  if (report.permissionControlEvidenceDigest !== null) {
    hash(report.permissionControlEvidenceDigest);
  }
  const result = {
    ...input,
    agreement,
    batchIntent: batch,
    preservationManifest: preservation,
  } as ShiftPlanningOwnerSheetsAuthorization;
  if (input.controlIncident !== undefined) {
    const incident = parseShiftPlanningOwnerSheetsAuthorizationIncident(
      input.controlIncident,
    );
    if (
      incident.authorizationDigest !==
      shiftPlanningOwnerSheetsAuthorizationDigest(result)
    ) {
      fail();
    }
    result.controlIncident = incident;
  }
  return result;
};

/**
 * Keeps the approved core stable while fresh reports can record withdrawal.
 * @param {ShiftPlanningOwnerSheetsAuthorization} value Registry record.
 * @return {string} Exact approval identity, excluding the mutable report.
 */
export const shiftPlanningOwnerSheetsAuthorizationDigest = (
  value: ShiftPlanningOwnerSheetsAuthorization,
): string => {
  const core = {...value};
  Reflect.deleteProperty(core, "ownerReport");
  Reflect.deleteProperty(core, "controlIncident");
  return digest(core);
};

/**
 * Parses the immutable owner binding stored with an external submission.
 * @param {unknown} value Stored owner binding.
 * @return {ShiftPlanningOwnerSheetsBinding} Verified detached binding.
 */
export const parseShiftPlanningOwnerSheetsBinding = (
  value: unknown,
): ShiftPlanningOwnerSheetsBinding => {
  const input = detached(value);
  exact(input, [
    "schemaVersion",
    "authorizationDigest",
    "authorizationSnapshot",
    "agreement",
    "batchIntent",
    "preservationManifest",
    "claim",
    "controlsValidUntilMillis",
    "preparedAtMillis",
    "bindingDigest",
    ...(Object.prototype.hasOwnProperty.call(input, "copyAuthority") ?
      ["copyAuthority"] : []),
  ]);
  if (input.schemaVersion !== 1) fail();
  hash(input.authorizationDigest);
  count(input.preparedAtMillis);
  count(input.controlsValidUntilMillis);
  if (
    (input.preparedAtMillis as number) >=
    (input.controlsValidUntilMillis as number)
  ) {
    fail();
  }
  verifiedDigest(input, "bindingDigest");
  const batch = parseShiftPlanningOwnerSheetsBatchIntent(input.batchIntent);
  const agreement = parseShiftPlanningOwnerMaintenanceAgreement(
    input.agreement, batch.schemaVersion === 2,
  );
  validateCopyAuthority(input.copyAuthority, batch, agreement);
  const authorizationSnapshot =
    parseShiftPlanningOwnerSheetsAuthorizationSnapshot(
      input.authorizationSnapshot,
      batch.environment,
    );
  const preservation = parseShiftSheetsOwnerPreservationManifest(
    input.preservationManifest,
  );
  const claim = record(input.claim);
  exact(claim, [
    "workerId",
    "attemptId",
    "fencingEpoch",
    "acquiredAtMillis",
    "expiresAtMillis",
  ]);
  id(claim.workerId);
  id(claim.attemptId);
  count(claim.fencingEpoch);
  count(claim.acquiredAtMillis);
  count(claim.expiresAtMillis);
  if (
    (claim.expiresAtMillis as number) <=
      (claim.acquiredAtMillis as number) ||
    (input.preparedAtMillis as number) <
      (claim.acquiredAtMillis as number) ||
    (input.preparedAtMillis as number) >= (claim.expiresAtMillis as number)
  ) {
    fail();
  }
  if (
    preservation.workbookId !== batch.workbookId ||
    preservation.requestDigest !== batch.requestDigest ||
    preservation.preservationDigest !== batch.preservationDigest ||
    preservation.digest !== batch.preservationManifestDigest ||
    agreement.payload.intent.environment !== batch.environment ||
    agreement.payload.intent.workbookFileId !== batch.workbookId ||
    agreement.payload.intent.expectedWriteEpoch !== batch.writeEpoch ||
    agreement.payload.intent.expectedActiveRevision !==
      batch.activeRevision ||
    agreement.payload.intent.expectedActiveDigest !== batch.activeDigest ||
    !agreement.payload.intent.operations.some(
      (operation) =>
        operation.kind === "sheets-batch" &&
        operation.operationId === batch.operationId &&
        operation.manifestDigest === digest(batch),
    ) ||
    (input.preparedAtMillis as number) <
      agreement.payload.intent.startsAtMillis ||
    (input.preparedAtMillis as number) >=
      agreement.payload.intent.endsAtMillis
  ) {
    fail();
  }
  return {
    ...input,
    agreement,
    authorizationSnapshot,
    batchIntent: batch,
    preservationManifest: preservation,
  } as ShiftPlanningOwnerSheetsBinding;
};

/**
 * Validates one fresh verification proof; it cannot authorize a Sheets retry.
 * @param {unknown} value Guard proof.
 * @return {ShiftPlanningOwnerSheetsProof} Verified proof.
 */
export const parseShiftPlanningOwnerSheetsProof = (
  value: unknown,
): ShiftPlanningOwnerSheetsProof => {
  const input = detached(value);
  exact(input, [
    "schemaVersion",
    "bindingDigest",
    "phase",
    "observationDigest",
    "authorizationSnapshot",
    "controlsValidUntilMillis",
    "verifiedAtMillis",
    "proofDigest",
  ]);
  if (
    input.schemaVersion !== 1 ||
    !["readback", "completion"].includes(input.phase as string)
  ) {
    fail();
  }
  hash(input.bindingDigest);
  hash(input.observationDigest);
  count(input.verifiedAtMillis);
  count(input.controlsValidUntilMillis);
  if (
    (input.verifiedAtMillis as number) >=
    (input.controlsValidUntilMillis as number)
  ) {
    fail();
  }
  verifiedDigest(input, "proofDigest");
  parseShiftPlanningOwnerSheetsAuthorizationSnapshot(
    input.authorizationSnapshot,
  );
  return input as ShiftPlanningOwnerSheetsProof;
};

/**
 * Parses a sticky failure, including the concrete phase and observation hash.
 * @param {unknown} value Retained incident.
 * @return {ShiftPlanningOwnerSheetsIncident} Verified incident.
 */
export const parseShiftPlanningOwnerSheetsIncident = (
  value: unknown,
): ShiftPlanningOwnerSheetsIncident => {
  const input = detached(value);
  exact(input, [
    "schemaVersion",
    "bindingDigest",
    "phase",
    "reason",
    "observationDigest",
    "recordedAtMillis",
    "incidentDigest",
  ]);
  if (
    input.schemaVersion !== 1 ||
    !["submission", "readback", "completion"].includes(
      input.phase as string,
    ) ||
    ![
      "owner_controls_rejected",
      "owner_controls_unavailable",
      "owner_window_expired",
      "workbook_preservation_rejected",
      "command_authority_changed",
    ].includes(input.reason as string)
  ) {
    fail();
  }
  hash(input.bindingDigest);
  count(input.recordedAtMillis);
  if (input.observationDigest !== null) hash(input.observationDigest);
  verifiedDigest(input, "incidentDigest");
  return input as ShiftPlanningOwnerSheetsIncident;
};

/**
 * Enforces the original owner deadline and a phase-bound fresh guard proof.
 * Called inside the repository transaction before completion is persisted.
 * @param {object} input Stored binding, fresh proof, phase and trusted clock.
 */
export const assertShiftPlanningOwnerSheetsProof = (input: {
  binding: ShiftPlanningOwnerSheetsBinding;
  proof: unknown;
  phase: "readback" | "completion";
  nowMillis: number;
}): void => {
  count(input.nowMillis);
  const proof = parseShiftPlanningOwnerSheetsProof(input.proof);
  const window = input.binding.agreement.payload.intent;
  if (
    proof.bindingDigest !== input.binding.bindingDigest ||
    proof.phase !== input.phase ||
    proof.authorizationSnapshot.path !==
      input.binding.authorizationSnapshot.path ||
    proof.verifiedAtMillis < input.binding.preparedAtMillis ||
    input.nowMillis < window.startsAtMillis ||
    input.nowMillis >= window.endsAtMillis ||
    input.nowMillis >= proof.controlsValidUntilMillis ||
    proof.verifiedAtMillis > input.nowMillis ||
    input.nowMillis - proof.verifiedAtMillis >
      input.binding.batchIntent.maximumEvidenceAgeMillis
  ) {
    fail();
  }
};

/**
 * Validates the sticky pre-submission latch in the original authorization row.
 * @param {unknown} value Recorded pre-submission incident, never a fake send.
 * @return {ShiftPlanningOwnerSheetsAuthorizationIncident} Verified latch.
 */
export const parseShiftPlanningOwnerSheetsAuthorizationIncident = (
  value: unknown,
): ShiftPlanningOwnerSheetsAuthorizationIncident => {
  const input = detached(value);
  exact(input, [
    "schemaVersion",
    "authorizationDigest",
    "phase",
    "reason",
    "observationDigest",
    "recordedAtMillis",
    "incidentDigest",
  ]);
  if (input.schemaVersion !== 1 || input.phase !== "before-submission") {
    fail();
  }
  hash(input.authorizationDigest);
  count(input.recordedAtMillis);
  if (input.observationDigest !== null) hash(input.observationDigest);
  verifiedDigest(input, "incidentDigest");
  const probe = {
    schemaVersion: 1,
    bindingDigest: input.authorizationDigest,
    phase: "submission",
    reason: input.reason,
    observationDigest: input.observationDigest,
    recordedAtMillis: input.recordedAtMillis,
  };
  parseShiftPlanningOwnerSheetsIncident({
    ...probe,
    incidentDigest: digest(probe),
  });
  return input as ShiftPlanningOwnerSheetsAuthorizationIncident;
};

/**
 * Binds a fresh human report to the exact Firestore document version.
 * @param {unknown} value Registry version recorded after provider reads.
 * @param {string} environment Optional command environment.
 * @return {ShiftPlanningOwnerSheetsAuthorizationSnapshot} Exact version DTO.
 */
export const parseShiftPlanningOwnerSheetsAuthorizationSnapshot = (
  value: unknown,
  environment?: "develop" | "production",
): ShiftPlanningOwnerSheetsAuthorizationSnapshot => {
  const input = detached(value);
  exact(input, ["path", "updateTime", "ownerReportDigest"]);
  if (
    typeof input.path !== "string" ||
    !new RegExp(
      "^(develop|production)/plus-collections/" +
        "shiftPlanningOperations/[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$",
    ).test(input.path) ||
    (environment && !input.path.startsWith(`${environment}/`))
  ) {
    fail();
  }
  hash(input.ownerReportDigest);
  const time = record(input.updateTime);
  exact(time, ["seconds", "nanoseconds"]);
  if (
    !Number.isSafeInteger(time.seconds) ||
    !Number.isSafeInteger(time.nanoseconds) ||
    (time.nanoseconds as number) < 0 ||
    (time.nanoseconds as number) >= 1000000000
  ) {
    fail();
  }
  return input as ShiftPlanningOwnerSheetsAuthorizationSnapshot;
};

const validateCopyAuthority = (value: unknown,
  batch: ShiftPlanningOwnerSheetsBatchIntent,
  agreement: ShiftPlanningOwnerMaintenanceAgreement): void => {
  if (batch.schemaVersion !== 2) {
    if (value !== undefined || agreement.payload.schemaVersion !== 1) fail();
    return;
  }
  const authority = parseShiftPlanningOwnerSheetsCopyAuthority(value);
  const intent = agreement.payload.intent;
  if (agreement.payload.schemaVersion !== 2 ||
      digest(authority) !== batch.technicalEvidenceDigest ||
      authority.workbookId !== batch.workbookId ||
      authority.drivePermissionId !== batch.observerPrincipalId ||
      !intent.participants.some((participant) =>
        participant.role === "operator" &&
        participant.principalId === authority.runnerInstanceId) ||
      intent.endsAtMillis > authority.grantExpiresAtMillis) fail();
};
