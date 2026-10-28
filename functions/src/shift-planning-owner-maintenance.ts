import {ShiftPlanningError} from "./shift-planning-contract.js";
import {
  canonicalShiftPlanningJson, createShiftPlanningDigest, ShiftPlanningDigest,
} from "./shift-planning-digest.js";
import {ShiftPlanningEnvironment} from "./shift-planning-wire.js";

export type ShiftPlanningOwnerParticipant = {
  principalId: string;
  role: "owner" | "operator" | "permission-controller";
};
export type ShiftPlanningOwnerMaintenanceIntent = {
  agreementId: string;
  environment: ShiftPlanningEnvironment;
  workbookFileId: string;
  ownerPrincipalId: string;
  participants: ShiftPlanningOwnerParticipant[];
  participantsRevision: string;
  effectiveAuthorityDigest: ShiftPlanningDigest;
  sourceRevision: string;
  sourceDigest: ShiftPlanningDigest;
  expectedWriteEpoch: number;
  expectedActiveRevision: string | null;
  expectedActiveDigest: string | null;
  affectedScopeDigest: ShiftPlanningDigest;
  operations: {
    operationId: string;
    kind: "maintenance-entry";
    manifestDigest: ShiftPlanningDigest;
  }[];
  startsAtMillis: number;
  endsAtMillis: number;
  recoveryDeadlineMillis: number;
  permissionControl: null | {
    principalId: string;
    actionId: string;
    actionKind: "acl-protection-only";
    sealedActionDigest: ShiftPlanningDigest;
    postAuthorityDigest: ShiftPlanningDigest;
    credentialClosureDigest: ShiftPlanningDigest;
  };
};
export type ShiftPlanningOwnerConfirmation = ShiftPlanningOwnerParticipant & {
  intentDigest: ShiftPlanningDigest;
  confirmationId: string;
  confirmedAtMillis: number;
  onlineClosedNoOfflineEdits: true;
  noManualOrAutomationWrites: true;
};
export type ShiftPlanningOwnerMaintenanceAgreement = {
  payload: {
    schemaVersion: 1;
    kind: "cooperative-owner-maintenance";
    intent: ShiftPlanningOwnerMaintenanceIntent;
    confirmations: ShiftPlanningOwnerConfirmation[];
  };
  digest: ShiftPlanningDigest;
};
export type ShiftPlanningOwnerMaintenanceObservation = {
  workbookFileId: string;
  ownerPrincipalId: string;
  participantsDigest: ShiftPlanningDigest;
  effectiveAuthorityDigest: ShiftPlanningDigest;
  sourceRevision: string;
  sourceDigest: ShiftPlanningDigest;
  technicalCapability: "retained";
  permissionWorkflowClosed: true;
  permissionControlEvidenceDigest: ShiftPlanningDigest | null;
  agreementStatus: "confirmed";
  ownerActivity: "none-reported";
  unresolvedWriteCount: 0;
  observedAtMillis: number;
};
const fail = (message: string): never => {
  throw new ShiftPlanningError("maintenance_state_conflict", message);
};
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype) {
    return fail("Owner maintenance requires plain records.");
  }
  return value as Record<string, unknown>;
};
const keys = (value: Record<string, unknown>, expected: string[]): void => {
  if (Object.keys(value).length !== expected.length ||
      Object.keys(value).some((key) => !expected.includes(key))) {
    fail("Owner maintenance fields are not exact.");
  }
};
const id = (value: unknown): string => {
  if (typeof value !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9@._:+-]{0,255}$/.test(value)) {
    return fail("Owner maintenance identity is invalid.");
  }
  return value;
};
const number = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return fail("Owner maintenance instant or epoch is invalid.");
  }
  return value as number;
};
const hash = (value: unknown): ShiftPlanningDigest => {
  if (typeof value !== "string" ||
      !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)) {
    return fail("Owner maintenance digest is invalid.");
  }
  return value as ShiftPlanningDigest;
};
const list = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) return fail("Owner maintenance list is invalid.");
  return value;
};
const participant = (value: unknown): ShiftPlanningOwnerParticipant => {
  const item = record(value);
  keys(item, ["principalId", "role"]);
  if (!["owner", "operator", "permission-controller"].includes(
    item.role as string,
  )) return fail("Owner maintenance participant role is invalid.");
  return {principalId: id(item.principalId), role: item.role as
    ShiftPlanningOwnerParticipant["role"]};
};
const participantKey = (value: ShiftPlanningOwnerParticipant): string =>
  `${value.role}:${value.principalId}`;

/**
 * Parses recorded human commitments without treating them as technical fences.
 * Confirmation digests bind the complete intent, including participants and
 * authority. Any changed ACL/participant/window requires new confirmation.
 * @param {unknown} value Detached agreement envelope.
 * @return {ShiftPlanningOwnerMaintenanceAgreement} Exact agreement.
 */
export const parseShiftPlanningOwnerMaintenanceAgreement = (
  value: unknown,
): ShiftPlanningOwnerMaintenanceAgreement => {
  const envelope = record(JSON.parse(canonicalShiftPlanningJson(value)));
  keys(envelope, ["payload", "digest"]);
  const payload = record(envelope.payload);
  keys(payload, ["schemaVersion", "kind", "intent", "confirmations"]);
  if (payload.schemaVersion !== 1 ||
      payload.kind !== "cooperative-owner-maintenance") {
    return fail("Owner agreement version or kind is unsupported.");
  }
  const intent = record(payload.intent);
  keys(intent, ["agreementId", "environment", "workbookFileId",
    "ownerPrincipalId", "participants", "participantsRevision",
    "effectiveAuthorityDigest", "sourceRevision", "sourceDigest",
    "expectedWriteEpoch", "expectedActiveRevision", "expectedActiveDigest",
    "affectedScopeDigest", "operations", "startsAtMillis", "endsAtMillis",
    "recoveryDeadlineMillis", "permissionControl"]);
  if (intent.environment !== "develop" && intent.environment !== "production") {
    return fail("Owner agreement environment is invalid.");
  }
  for (const field of ["agreementId", "workbookFileId", "ownerPrincipalId",
    "participantsRevision", "sourceRevision"]) id(intent[field]);
  for (const field of ["effectiveAuthorityDigest", "sourceDigest",
    "affectedScopeDigest"]) hash(intent[field]);
  number(intent.expectedWriteEpoch);
  if ((intent.expectedActiveRevision === null) !==
      (intent.expectedActiveDigest === null)) {
    return fail("Owner agreement active lineage is incomplete.");
  }
  if (intent.expectedActiveRevision !== null) id(intent.expectedActiveRevision);
  if (intent.expectedActiveDigest !== null) hash(intent.expectedActiveDigest);
  const participants = list(intent.participants).map(participant);
  const participantKeys = participants.map(participantKey).sort();
  if (new Set(participantKeys).size !== participants.length ||
      participants.filter((item) => item.role === "owner").length !== 1 ||
      participants.filter((item) => item.role === "operator").length !== 1 ||
      participants.filter((item) => item.role === "permission-controller")
        .length > 1 ||
      !participants.some((item) => item.role === "owner" &&
        item.principalId === intent.ownerPrincipalId)) {
    return fail("Owner agreement participants are incomplete or duplicated.");
  }
  const operator = participants.find((item) => item.role === "operator");
  if (participants.some((item) => item.role !== "operator" &&
      item.principalId === operator?.principalId)) {
    return fail("Operator identity must differ from owner and controller.");
  }
  const operations = list(intent.operations).map((value) => {
    const operation = record(value);
    keys(operation, ["operationId", "kind", "manifestDigest"]);
    id(operation.operationId);
    hash(operation.manifestDigest);
    if (!["maintenance-entry"].includes(
      operation.kind as string,
    )) return fail("Owner agreement operation kind is invalid.");
    return operation;
  });
  if (!operations.length || new Set(operations.map((operation) =>
    operation.operationId)).size !== operations.length) {
    return fail("Owner agreement operations are missing or duplicated.");
  }
  const start = number(intent.startsAtMillis);
  const end = number(intent.endsAtMillis);
  if (start >= end || end > number(intent.recoveryDeadlineMillis)) {
    return fail("Owner maintenance window or recovery deadline is invalid.");
  }
  if (intent.permissionControl !== null) {
    const control = record(intent.permissionControl);
    keys(control, ["principalId", "actionId", "actionKind",
      "sealedActionDigest", "postAuthorityDigest", "credentialClosureDigest"]);
    if (control.actionKind !== "acl-protection-only" ||
        control.postAuthorityDigest !== intent.effectiveAuthorityDigest ||
        !participants.some((item) => item.role === "permission-controller" &&
          item.principalId === control.principalId)) {
      return fail("Owner permission action is not sealed and closed.");
    }
    id(control.actionId);
    hash(control.sealedActionDigest);
    hash(control.postAuthorityDigest);
    hash(control.credentialClosureDigest);
  }
  const intentDigest = createShiftPlanningDigest(intent);
  const confirmations = list(payload.confirmations).map((value) => {
    const confirmation = record(value);
    keys(confirmation, ["principalId", "role", "intentDigest",
      "confirmationId", "confirmedAtMillis", "onlineClosedNoOfflineEdits",
      "noManualOrAutomationWrites"]);
    participant({
      principalId: confirmation.principalId, role: confirmation.role,
    });
    id(confirmation.confirmationId);
    if (confirmation.intentDigest !== intentDigest ||
        number(confirmation.confirmedAtMillis) >= end ||
        confirmation.onlineClosedNoOfflineEdits !== true ||
        confirmation.noManualOrAutomationWrites !== true) {
      return fail("Owner confirmation does not bind the complete commitment.");
    }
    return confirmation as ShiftPlanningOwnerConfirmation;
  });
  if (canonicalShiftPlanningJson(confirmations.map(participantKey).sort()) !==
      canonicalShiftPlanningJson(participantKeys) ||
      hash(envelope.digest) !== createShiftPlanningDigest(payload)) {
    return fail("Owner confirmations or agreement digest do not match.");
  }
  return envelope as ShiftPlanningOwnerMaintenanceAgreement;
};

/**
 * Builds a bound agreement; confirmation receipts remain externally collected
 * evidence, never proof that the owner lost technical capability.
 * @param {ShiftPlanningOwnerMaintenanceIntent} intent Complete agreed intent.
 * @param {ShiftPlanningOwnerConfirmation[]} confirmations Human confirmations.
 * @return {ShiftPlanningOwnerMaintenanceAgreement} Verified envelope.
 */
export const createShiftPlanningOwnerMaintenanceAgreement = (
  intent: ShiftPlanningOwnerMaintenanceIntent,
  confirmations: ShiftPlanningOwnerConfirmation[],
): ShiftPlanningOwnerMaintenanceAgreement => {
  const payload = {schemaVersion: 1, kind: "cooperative-owner-maintenance",
    intent, confirmations};
  return parseShiftPlanningOwnerMaintenanceAgreement({
    payload, digest: createShiftPlanningDigest(payload),
  });
};

/**
 * Checks observed owner, participants and authority against the agreement.
 * Freshness is checked at each admission, not when an adapter is constructed.
 * @param {object} input Agreement, observation, binding and trusted clock.
 */
export const assertShiftPlanningOwnerMaintenanceObservation = (input: {
  agreement: ShiftPlanningOwnerMaintenanceAgreement;
  observation: unknown;
  environment: ShiftPlanningEnvironment;
  operationId: string;
  workbookFileId: string;
  workbookRevision: string;
  workbookDigest: string;
  writeEpoch: number;
  activeRevision: string | null;
  activeDigest: string | null;
  nowMillis: number;
  maximumEvidenceAgeMillis: number;
  authoritativeDigest: string;
  technicalControlManifestDigest: string;
  requireFreshWindow: boolean;
}): void => {
  const {intent, confirmations} = input.agreement.payload;
  const observed = record(input.observation);
  keys(observed, ["workbookFileId", "ownerPrincipalId", "participantsDigest",
    "effectiveAuthorityDigest", "sourceRevision", "sourceDigest",
    "technicalCapability", "permissionWorkflowClosed",
    "permissionControlEvidenceDigest", "agreementStatus", "ownerActivity",
    "unresolvedWriteCount", "observedAtMillis"]);
  const participantsDigest = createShiftPlanningDigest({
    revision: intent.participantsRevision, participants: intent.participants,
  });
  if (intent.environment !== input.environment ||
      intent.workbookFileId !== input.workbookFileId ||
      intent.sourceRevision !== input.workbookRevision ||
      intent.sourceDigest !== input.workbookDigest ||
      intent.expectedWriteEpoch !== input.writeEpoch ||
      intent.expectedActiveRevision !== input.activeRevision ||
      intent.expectedActiveDigest !== input.activeDigest ||
      intent.affectedScopeDigest !== input.authoritativeDigest ||
      !intent.operations.some((operation) =>
        operation.operationId === input.operationId &&
        operation.kind === "maintenance-entry" &&
        operation.manifestDigest === input.technicalControlManifestDigest) ||
      observed.workbookFileId !== intent.workbookFileId ||
      observed.ownerPrincipalId !== intent.ownerPrincipalId ||
      observed.participantsDigest !== participantsDigest ||
      observed.effectiveAuthorityDigest !== intent.effectiveAuthorityDigest ||
      observed.sourceRevision !== intent.sourceRevision ||
      observed.sourceDigest !== intent.sourceDigest ||
      observed.technicalCapability !== "retained" ||
      observed.permissionWorkflowClosed !== true ||
      observed.permissionControlEvidenceDigest !== (intent.permissionControl ?
        createShiftPlanningDigest(intent.permissionControl) : null) ||
      observed.agreementStatus !== "confirmed" ||
      observed.ownerActivity !== "none-reported" ||
      observed.unresolvedWriteCount !== 0) {
    fail("Owner agreement binding or observed authority drifted.");
  }
  const observedAt = number(observed.observedAtMillis);
  const now = number(input.nowMillis);
  if (observedAt > now || confirmations.some((confirmation) =>
    confirmation.confirmedAtMillis > observedAt)) {
    fail("Owner confirmation or observation chronology is invalid.");
  }
  if (input.requireFreshWindow && (
    now < intent.startsAtMillis || now >= intent.endsAtMillis ||
    now - observedAt > input.maximumEvidenceAgeMillis
  )) fail("Owner maintenance window or confirmation expired.");
};
