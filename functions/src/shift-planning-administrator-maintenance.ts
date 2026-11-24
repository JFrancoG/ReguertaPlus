import {ShiftPlanningError} from "./shift-planning-contract.js";
import {
  canonicalShiftPlanningJson, createShiftPlanningDigest as digest,
  ShiftPlanningDigest,
} from "./shift-planning-digest.js";

export type ShiftPlanningAdministratorMaintenanceIntent = {
  agreementId: string;
  projectId: "reguerta-9f27f";
  databaseId: "(default)";
  environment: "develop";
  administratorPrincipalIds: string[];
  participantsRevision: string;
  effectiveIamDigest: ShiftPlanningDigest;
  sourceRevision: string;
  sourceDigest: ShiftPlanningDigest;
  ownerAgreementDigest: ShiftPlanningDigest;
  affectedScopeDigest: ShiftPlanningDigest;
  writeEpoch: number;
  activeRevision: string | null;
  activeDigest: ShiftPlanningDigest | null;
  technicalControlManifestDigest: ShiftPlanningDigest;
  operations: {
    operationId: string;
    kind: "maintenance-entry" | "sheets-batch";
    manifestDigest: ShiftPlanningDigest;
  }[];
  startsAtMillis: number;
  endsAtMillis: number;
  recoveryDeadlineMillis: number;
};
export type ShiftPlanningAdministratorConfirmation = {
  principalId: string;
  intentDigest: ShiftPlanningDigest;
  confirmationId: string;
  confirmedAtMillis: number;
  noUnreviewedDataRulesDeployIamOrScriptWrites: true;
  noAutomationViaHumanCredentials: true;
};
export type ShiftPlanningAdministratorMaintenanceAgreement = {
  payload: {
    schemaVersion: 1;
    kind: "cooperative-develop-administrator-maintenance";
    intent: ShiftPlanningAdministratorMaintenanceIntent;
    confirmations: ShiftPlanningAdministratorConfirmation[];
  };
  digest: ShiftPlanningDigest;
};
export type ShiftPlanningAdministratorMaintenanceObservation = {
  projectId: "reguerta-9f27f";
  databaseId: "(default)";
  environment: "develop";
  agreementDigest: ShiftPlanningDigest;
  administratorPrincipalIds: string[];
  participantsRevision: string;
  effectiveIamDigest: ShiftPlanningDigest;
  sourceRevision: string;
  sourceDigest: ShiftPlanningDigest;
  technicalCapability: "retained";
  agreementStatus: "confirmed" | "withdrawn";
  administratorActivity: "none-reported" | "reported";
  unresolvedWriteCount: number;
  reportRevision: string;
  observedAtMillis: number;
};
const fail = (): never => {
  throw new ShiftPlanningError("maintenance_state_conflict",
    "Develop administrator commitment or fresh authority does not match.");
};
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype) return fail();
  return value as Record<string, unknown>;
};
const exact = (value: Record<string, unknown>, keys: string[]): void => {
  if (Object.keys(value).length !== keys.length ||
      Object.keys(value).some((key) => !keys.includes(key))) fail();
};
const id = (value: unknown): void => {
  if (typeof value !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9@._:+-]{0,255}$/.test(value)) fail();
};
const count = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) return fail();
  return value as number;
};
const hash = (value: unknown): void => {
  if (typeof value !== "string" ||
      !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)) fail();
};
const principals = (value: unknown): string[] => {
  if (!Array.isArray(value) || !value.length || value.length > 100 ||
      value.some((item) => typeof item !== "string" || item.length > 256 ||
        !/^user:[A-Za-z0-9._+%-]+@[A-Za-z0-9.-]+$/.test(item)) ||
      new Set(value).size !== value.length) return fail();
  return [...value].sort();
};

/**
 * Records named human commitments, never an IAM fence or authority grant.
 * Groups, workloads and unknown principals cannot inherit this exception.
 * @param {unknown} value Explicit develop-only agreement envelope.
 * @return {ShiftPlanningAdministratorMaintenanceAgreement} Bound commitment.
 */
export const parseShiftPlanningAdministratorMaintenanceAgreement = (
  value: unknown,
): ShiftPlanningAdministratorMaintenanceAgreement => {
  const envelope = record(JSON.parse(canonicalShiftPlanningJson(value)));
  exact(envelope, ["payload", "digest"]);
  const payload = record(envelope.payload);
  exact(payload, ["schemaVersion", "kind", "intent", "confirmations"]);
  const intent = record(payload.intent);
  exact(intent, ["agreementId", "projectId", "databaseId", "environment",
    "administratorPrincipalIds", "participantsRevision", "effectiveIamDigest",
    "sourceRevision", "sourceDigest", "ownerAgreementDigest",
    "affectedScopeDigest", "writeEpoch", "activeRevision", "activeDigest",
    "technicalControlManifestDigest", "operations", "startsAtMillis",
    "endsAtMillis", "recoveryDeadlineMillis"]);
  if (payload.schemaVersion !== 1 || payload.kind !==
      "cooperative-develop-administrator-maintenance" ||
      intent.projectId !== "reguerta-9f27f" ||
      intent.databaseId !== "(default)" || intent.environment !== "develop") {
    return fail();
  }
  for (const field of ["agreementId", "participantsRevision",
    "sourceRevision"]) {
    id(intent[field]);
  }
  for (const field of ["effectiveIamDigest", "sourceDigest",
    "ownerAgreementDigest", "affectedScopeDigest",
    "technicalControlManifestDigest"]) hash(intent[field]);
  count(intent.writeEpoch);
  if ((intent.activeRevision === null) !== (intent.activeDigest === null)) {
    return fail();
  }
  if (intent.activeRevision !== null) {
    id(intent.activeRevision); hash(intent.activeDigest);
  }
  const people = principals(intent.administratorPrincipalIds);
  if (!Array.isArray(intent.operations) || !intent.operations.length ||
      intent.operations.length > 100) return fail();
  const operations = intent.operations.map((value) => {
    const operation = record(value);
    exact(operation, ["operationId", "kind", "manifestDigest"]);
    id(operation.operationId); hash(operation.manifestDigest);
    if (!["maintenance-entry", "sheets-batch"].includes(
      operation.kind as string)) return fail();
    return operation.operationId;
  });
  if (new Set(operations).size !== operations.length) return fail();
  const end = count(intent.endsAtMillis);
  if (count(intent.startsAtMillis) >= end ||
      end > count(intent.recoveryDeadlineMillis)) return fail();
  if (!Array.isArray(payload.confirmations)) return fail();
  const confirmed = payload.confirmations.map((value) => {
    const confirmation = record(value);
    exact(confirmation, ["principalId", "intentDigest", "confirmationId",
      "confirmedAtMillis", "noUnreviewedDataRulesDeployIamOrScriptWrites",
      "noAutomationViaHumanCredentials"]);
    id(confirmation.confirmationId);
    if (confirmation.intentDigest !== digest(intent) ||
        count(confirmation.confirmedAtMillis) >= end ||
        confirmation.noUnreviewedDataRulesDeployIamOrScriptWrites !== true ||
        confirmation.noAutomationViaHumanCredentials !== true) return fail();
    return confirmation.principalId;
  });
  if (canonicalShiftPlanningJson(principals(confirmed)) !==
      canonicalShiftPlanningJson(people) ||
      envelope.digest !== digest(payload)) {
    return fail();
  }
  return envelope as ShiftPlanningAdministratorMaintenanceAgreement;
};

/**
 * Revalidates a separately observed complete principal set and current reports.
 * A healthy report with a changed revision still differs from earlier proof.
 * Automated IAM/workload/drain proof remains the caller's technical contract.
 * @param {object} input Exact reviewed operation and fresh independent facts.
 * @return {ShiftPlanningDigest} Stable report identity, excluding read time.
 */
export const assertShiftPlanningAdministratorMaintenanceObservation = (
  input: {
    agreement: ShiftPlanningAdministratorMaintenanceAgreement;
    observation: unknown;
    environment: string;
    ownerAgreementDigest: string;
    affectedScopeDigest: string;
    writeEpoch: number;
    activeRevision: string | null;
    activeDigest: string | null;
    technicalControlManifestDigest: string;
    sourceRevision: string;
    sourceDigest: string;
    effectiveIamDigest: string;
    operationId: string;
    operationKind: "maintenance-entry" | "sheets-batch";
    operationManifestDigest: string;
    nowMillis: number;
    maximumEvidenceAgeMillis: number;
    requireFreshWindow: boolean;
  },
): ShiftPlanningDigest => {
  const agreement = parseShiftPlanningAdministratorMaintenanceAgreement(
    input.agreement,
  );
  const {intent, confirmations} = agreement.payload;
  const observed = record(input.observation);
  exact(observed, ["projectId", "databaseId", "environment", "agreementDigest",
    "administratorPrincipalIds", "participantsRevision", "effectiveIamDigest",
    "sourceRevision", "sourceDigest", "technicalCapability", "agreementStatus",
    "administratorActivity", "unresolvedWriteCount", "reportRevision",
    "observedAtMillis"]);
  id(observed.reportRevision);
  if (input.environment !== "develop" ||
      intent.ownerAgreementDigest !== input.ownerAgreementDigest ||
      intent.affectedScopeDigest !== input.affectedScopeDigest ||
      intent.writeEpoch !== input.writeEpoch ||
      intent.activeRevision !== input.activeRevision ||
      intent.activeDigest !== input.activeDigest ||
      intent.technicalControlManifestDigest !==
        input.technicalControlManifestDigest ||
      intent.sourceRevision !== input.sourceRevision ||
      intent.sourceDigest !== input.sourceDigest ||
      intent.effectiveIamDigest !== input.effectiveIamDigest ||
      !intent.operations.some((operation) => operation.operationId ===
        input.operationId && operation.kind === input.operationKind &&
        operation.manifestDigest === input.operationManifestDigest) ||
      observed.projectId !== intent.projectId ||
      observed.databaseId !== intent.databaseId ||
      observed.environment !== intent.environment ||
      observed.agreementDigest !== agreement.digest ||
      canonicalShiftPlanningJson(
        principals(observed.administratorPrincipalIds)) !==
        canonicalShiftPlanningJson(principals(
          intent.administratorPrincipalIds)) ||
      observed.participantsRevision !== intent.participantsRevision ||
      observed.effectiveIamDigest !== intent.effectiveIamDigest ||
      observed.sourceRevision !== intent.sourceRevision ||
      observed.sourceDigest !== intent.sourceDigest ||
      observed.technicalCapability !== "retained" ||
      observed.agreementStatus !== "confirmed" ||
      observed.administratorActivity !== "none-reported" ||
      observed.unresolvedWriteCount !== 0) return fail();
  const now = count(input.nowMillis);
  const observedAt = count(observed.observedAtMillis);
  if (observedAt > now || confirmations.some((confirmation) =>
    confirmation.confirmedAtMillis > observedAt) ||
      (input.requireFreshWindow && (now < intent.startsAtMillis ||
        now >= intent.endsAtMillis ||
        now - observedAt > count(input.maximumEvidenceAgeMillis)))) {
    return fail();
  }
  const identity = {...observed,
    administratorPrincipalIds: principals(observed.administratorPrincipalIds)};
  Reflect.deleteProperty(identity, "observedAtMillis");
  return digest(identity);
};
