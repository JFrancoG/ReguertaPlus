import {ShiftPlanningError} from "./shift-planning-contract.js";
import {
  canonicalShiftPlanningJson,
  createShiftPlanningDigest as digest,
} from "./shift-planning-digest.js";

import {
  parseShiftPlanningOwnerMaintenanceAgreement,
  ShiftPlanningOwnerMaintenanceIntent,
  ShiftPlanningOwnerConfirmation,
} from "./shift-planning-owner-maintenance.js";

export const SHIFT_PLANNING_COPY_TOKEN_SCOPES = Object.freeze([
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/spreadsheets",
]);

/** Reviewed authority for one isolated copy, never a develop intake barrier. */
export type ShiftPlanningOwnerSheetsCopyAuthority = {
  schemaVersion: 1;
  kind: "isolated-copy-authority";
  runId: string;
  workbookId: string;
  protectedWorkbookIds: readonly string[];
  demoProjectId: string;
  firestoreHost: "127.0.0.1:8897";
  runnerInstanceId: string;
  runnerSourceDigest: string;
  runnerStartedAtMillis: number;
  lockNonceDigest: string;
  serviceAccountEmail: string;
  serviceAccountUniqueId: string;
  drivePermissionId: string;
  creationReceiptDigest: string;
  grantPolicyDigest: string;
  grantStartsAtMillis: number;
  grantExpiresAtMillis: number;
  tokenIssuedAtMillis: number;
  tokenExpiresAtMillis: number;
  tokenScopes: readonly string[];
  maximumEvidenceAgeMillis: number;
};

/** Fresh provider/runner reads; counters come from the actual SDK port. */
export type ShiftPlanningOwnerSheetsCopyObservation = {
  schemaVersion: 1;
  kind: "isolated-copy-runtime";
  authorityDigest: string;
  observedAtMillis: number;
  serviceAccountEmail: string;
  serviceAccountUniqueId: string;
  serviceAccountDisabled: boolean;
  userManagedKeyCount: number;
  directProjectRoleCount: number;
  grantPolicyDigest: string;
  tokenExpiresAtMillis: number;
  tokenScopes: readonly string[];
  runnerInstanceId: string;
  runnerSourceDigest: string;
  runnerPid: number;
  lockOwnerPid: number;
  lockRunnerStartedAtMillis: number;
  lockNonceDigest: string;
  submittedRequestCount: number;
  inFlightRequestCount: number;
  unknownRequestCount: number;
  submittedRequestDigest: string | null;
  receiptBindingDigest: string | null;
};

const fail = (): never => {
  throw new ShiftPlanningError(
    "invalid_planning_sync_command",
    "Isolated copy authority is incomplete, stale or outside its one request.",
  );
};
const record = (value: unknown): Record<string, unknown> => {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return fail();
  }
  return value as Record<string, unknown>;
};
const exact = (value: Record<string, unknown>, keys: readonly string[]) => {
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
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
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
const scopes = (value: unknown): void => {
  if (
    canonicalShiftPlanningJson(value) !==
    canonicalShiftPlanningJson(SHIFT_PLANNING_COPY_TOKEN_SCOPES)
  ) {
    fail();
  }
};

/**
 * Parses fixed copy authority. TokenCreator coordination is an operational
 * commitment of the invoker; these fields do not prove an IAM owner fence.
 * @param {unknown} value Reviewed keyless identity and one short token.
 * @return {ShiftPlanningOwnerSheetsCopyAuthority} Detached copy scope.
 */
export const parseShiftPlanningOwnerSheetsCopyAuthority = (
  value: unknown,
): ShiftPlanningOwnerSheetsCopyAuthority => {
  const input = record(JSON.parse(canonicalShiftPlanningJson(value)));
  exact(input, [
    "schemaVersion",
    "kind",
    "runId",
    "workbookId",
    "protectedWorkbookIds",
    "demoProjectId",
    "firestoreHost",
    "runnerInstanceId",
    "runnerSourceDigest",
    "runnerStartedAtMillis",
    "lockNonceDigest",
    "serviceAccountEmail",
    "serviceAccountUniqueId",
    "drivePermissionId",
    "creationReceiptDigest",
    "grantPolicyDigest",
    "grantStartsAtMillis",
    "grantExpiresAtMillis",
    "tokenIssuedAtMillis",
    "tokenExpiresAtMillis",
    "tokenScopes",
    "maximumEvidenceAgeMillis",
  ]);
  if (
    input.schemaVersion !== 1 ||
    input.kind !== "isolated-copy-authority" ||
    input.firestoreHost !== "127.0.0.1:8897" ||
    typeof input.demoProjectId !== "string" ||
    !/^demo-[a-z0-9-]{1,50}$/.test(input.demoProjectId) ||
    !Array.isArray(input.protectedWorkbookIds) ||
    input.protectedWorkbookIds.length < 2 ||
    new Set(input.protectedWorkbookIds).size !==
      input.protectedWorkbookIds.length ||
    input.protectedWorkbookIds.includes(input.workbookId) ||
    typeof input.serviceAccountEmail !== "string" ||
    !/^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(
      input.serviceAccountEmail,
    )
  ) {
    fail();
  }
  for (const key of [
    "runId",
    "workbookId",
    "runnerInstanceId",
    "serviceAccountUniqueId",
    "drivePermissionId",
  ]) {
    id(input[key]);
  }
  for (const value of input.protectedWorkbookIds as unknown[]) id(value);
  for (const key of [
    "runnerSourceDigest",
    "lockNonceDigest",
    "creationReceiptDigest",
    "grantPolicyDigest",
  ]) {
    hash(input[key]);
  }
  for (const key of [
    "runnerStartedAtMillis",
    "grantStartsAtMillis",
    "grantExpiresAtMillis",
    "tokenIssuedAtMillis",
    "tokenExpiresAtMillis",
    "maximumEvidenceAgeMillis",
  ]) {
    count(input[key]);
  }
  scopes(input.tokenScopes);
  const result = input as unknown as ShiftPlanningOwnerSheetsCopyAuthority;
  if (
    result.maximumEvidenceAgeMillis === 0 ||
    result.maximumEvidenceAgeMillis > 60000 ||
    result.grantStartsAtMillis >= result.grantExpiresAtMillis ||
    result.grantExpiresAtMillis - result.grantStartsAtMillis > 1200000 ||
    result.tokenIssuedAtMillis < result.grantStartsAtMillis ||
    result.tokenExpiresAtMillis > result.grantExpiresAtMillis ||
    result.tokenExpiresAtMillis <= result.tokenIssuedAtMillis ||
    result.tokenExpiresAtMillis - result.tokenIssuedAtMillis > 300000 ||
    result.runnerStartedAtMillis > result.tokenIssuedAtMillis
  ) {
    fail();
  }
  return result;
};

/**
 * Checks current copy-only evidence without inventing the shared writer set.
 * The runner reads IAM/lock/receipts and counts its actual SDK port;
 * a retained packet or an operator-supplied zero cannot replace those reads.
 * @param {object} input Pinned authority, fresh observation and actual phase.
 * @return {number} Earliest exclusive expiry of this observation/token/grant.
 */
export const verifyShiftPlanningOwnerSheetsCopyObservation = (input: {
  authority: ShiftPlanningOwnerSheetsCopyAuthority;
  observation: unknown;
  nowMillis: number;
  phase: "before-submission" | "after-submission";
  requestDigest: string;
  bindingDigest?: string;
}): number => {
  const authority = parseShiftPlanningOwnerSheetsCopyAuthority(
    input.authority,
  );
  const observed = record(
    JSON.parse(canonicalShiftPlanningJson(input.observation)),
  );
  exact(observed, [
    "schemaVersion",
    "kind",
    "authorityDigest",
    "observedAtMillis",
    "serviceAccountEmail",
    "serviceAccountUniqueId",
    "serviceAccountDisabled",
    "userManagedKeyCount",
    "directProjectRoleCount",
    "grantPolicyDigest",
    "tokenExpiresAtMillis",
    "tokenScopes",
    "runnerInstanceId",
    "runnerSourceDigest",
    "runnerPid",
    "lockOwnerPid",
    "lockRunnerStartedAtMillis",
    "lockNonceDigest",
    "submittedRequestCount",
    "inFlightRequestCount",
    "unknownRequestCount",
    "submittedRequestDigest",
    "receiptBindingDigest",
  ]);
  for (const key of [
    "observedAtMillis",
    "userManagedKeyCount",
    "directProjectRoleCount",
    "tokenExpiresAtMillis",
    "runnerPid",
    "lockOwnerPid",
    "lockRunnerStartedAtMillis",
    "submittedRequestCount",
    "inFlightRequestCount",
    "unknownRequestCount",
  ]) {
    count(observed[key]);
  }
  count(input.nowMillis);
  hash(input.requestDigest);
  scopes(observed.tokenScopes);
  const expectedCount = input.phase === "before-submission" ? 0 : 1;
  const deadline = Math.min(
    authority.tokenExpiresAtMillis,
    authority.grantExpiresAtMillis,
    (observed.observedAtMillis as number) +
      authority.maximumEvidenceAgeMillis,
  );
  if (
    observed.schemaVersion !== 1 ||
    observed.kind !== "isolated-copy-runtime" ||
    observed.authorityDigest !== digest(authority) ||
    (observed.observedAtMillis as number) > input.nowMillis ||
    input.nowMillis < authority.tokenIssuedAtMillis ||
    input.nowMillis >= deadline ||
    observed.serviceAccountEmail !== authority.serviceAccountEmail ||
    observed.serviceAccountUniqueId !== authority.serviceAccountUniqueId ||
    observed.serviceAccountDisabled !== false ||
    observed.userManagedKeyCount !== 0 ||
    observed.directProjectRoleCount !== 0 ||
    observed.grantPolicyDigest !== authority.grantPolicyDigest ||
    observed.tokenExpiresAtMillis !== authority.tokenExpiresAtMillis ||
    observed.runnerInstanceId !== authority.runnerInstanceId ||
    observed.runnerSourceDigest !== authority.runnerSourceDigest ||
    observed.runnerPid === 0 ||
    observed.lockOwnerPid !== observed.runnerPid ||
    observed.lockRunnerStartedAtMillis !==
      authority.runnerStartedAtMillis ||
    observed.lockNonceDigest !== authority.lockNonceDigest ||
    observed.submittedRequestCount !== expectedCount ||
    observed.inFlightRequestCount !== 0 ||
    observed.unknownRequestCount !== 0 ||
    observed.submittedRequestDigest !==
      (expectedCount ? input.requestDigest : null) ||
    observed.receiptBindingDigest !==
      (expectedCount ? input.bindingDigest : null)
  ) {
    fail();
  }
  return deadline;
};

/**
 * Records one human owner and the local runner as distinct roles, without
 * claiming that the runner is another human or an invoker-only IAM principal.
 * @param {ShiftPlanningOwnerMaintenanceIntent} intent Copy operation.
 * @param {ShiftPlanningOwnerConfirmation[]} confirmations Owner/runner records.
 * @return {object} Explicit copy-only agreement, rejected by the shared codec.
 */
export const createShiftPlanningOwnerSheetsCopyAgreement = (
  intent: ShiftPlanningOwnerMaintenanceIntent,
  confirmations: ShiftPlanningOwnerConfirmation[],
) => {
  const payload = {
    schemaVersion: 2,
    kind: "cooperative-owner-copy-rehearsal",
    intent,
    confirmations,
  };
  return parseShiftPlanningOwnerMaintenanceAgreement(
    {payload, digest: digest(payload)},
    true,
  );
};
