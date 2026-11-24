import {ShiftPlanningError} from "./shift-planning-contract.js";
import {createShiftPlanningDigest, ShiftPlanningDigest} from
  "./shift-planning-digest.js";
import type {ShiftPlanningIntakeBarrierEvidencePayload} from
  "./shift-planning-intake-barrier.js";

export const DEVELOP_HISTORICAL_RISK = "develop-historical-risk-v1" as const;
export const DEVELOP_HISTORICAL_WORKBOOK =
  "1O7VKs7S4wZHVvTfNBehAd5EzF3Mgw2q9LweK68Gm76A";
export type DevelopHistoricalRisk = {
  schemaVersion: 1;
  kind: typeof DEVELOP_HISTORICAL_RISK;
  projectId: "reguerta-9f27f";
  databaseId: "(default)";
  namespace: "develop/plus-collections";
  direction: "forward" | "inverse";
  migrationOperationId: string;
  recoveryOperationId: string;
  operatorPrincipalId: string;
  confirmationId: string;
  acceptedAtMillis: number;
  expiresAtMillis: number;
  assessedAtMillis: number;
  sourceDigest: ShiftPlanningDigest;
  causalSetDigest: ShiftPlanningDigest;
  workbookFileId: string;
  workbookRevision: string;
  workbookDigest: ShiftPlanningDigest;
  migrationPlanDigest: ShiftPlanningDigest;
  inversePlanDigest: ShiftPlanningDigest;
  currentSourceDigest: ShiftPlanningDigest;
  technicalControlManifestDigest: ShiftPlanningDigest;
  predecessors: readonly {
    writerId: string;
    sourceDigest: ShiftPlanningDigest;
    closureEvidenceDigest: ShiftPlanningDigest;
    closedAtMillis: number;
  }[];
  legacyUntracked: true;
  replayAllowed: false;
  continuingWorkObserved: false;
};
const fail = (): never => {
  throw new ShiftPlanningError("maintenance_state_conflict",
    "Historical risk is not accepted for this exact develop migration.");
};
const record = (v: unknown, keys: readonly string[]) => {
  if (!v || typeof v !== "object" || Array.isArray(v) ||
      Object.getPrototypeOf(v) !== Object.prototype) return fail();
  const r = v as Record<string, unknown>;
  if (Object.keys(r).sort().join() !== [...keys].sort().join()) return fail();
  return r;
};
const text = (v: unknown): string => {
  if (typeof v !== "string" || !v.trim() || v !== v.trim()) return fail();
  return v;
};
const hash = (v: unknown): ShiftPlanningDigest => {
  if (!/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(text(v))) return fail();
  return v as ShiftPlanningDigest;
};
const instant = (v: unknown): number => {
  if (!Number.isSafeInteger(v) || (v as number) < 0) return fail();
  return v as number;
};

/**
 * Parses an explicit acceptance, never proof of historical termination. Its
 * digest must be independently authorized by the held barrier command.
 * @param {unknown} value Retained acceptance and predecessor observations.
 * @return {DevelopHistoricalRisk} Detached versioned risk record.
 */
export const parseDevelopHistoricalRisk = (
  value: unknown,
): DevelopHistoricalRisk => {
  const r = record(value, ["schemaVersion", "kind", "projectId", "databaseId",
    "namespace", "direction", "migrationOperationId", "recoveryOperationId",
    "operatorPrincipalId", "confirmationId", "acceptedAtMillis",
    "expiresAtMillis", "assessedAtMillis", "sourceDigest", "causalSetDigest",
    "workbookFileId", "workbookRevision", "workbookDigest",
    "migrationPlanDigest",
    "inversePlanDigest", "currentSourceDigest",
    "technicalControlManifestDigest",
    "predecessors", "legacyUntracked", "replayAllowed",
    "continuingWorkObserved"]);
  if (r.schemaVersion !== 1 || r.kind !== DEVELOP_HISTORICAL_RISK ||
      r.projectId !== "reguerta-9f27f" || r.databaseId !== "(default)" ||
      r.namespace !== "develop/plus-collections" ||
      !["forward", "inverse"].includes(String(r.direction)) ||
      r.workbookFileId !== DEVELOP_HISTORICAL_WORKBOOK ||
      r.legacyUntracked !== true || r.replayAllowed !== false ||
      r.continuingWorkObserved !== false || !Array.isArray(r.predecessors) ||
      !r.predecessors.length) return fail();
  const predecessors = r.predecessors.map((value) => {
    const p = record(value, ["writerId", "sourceDigest",
      "closureEvidenceDigest",
      "closedAtMillis"]);
    return {writerId: text(p.writerId), sourceDigest: hash(p.sourceDigest),
      closureEvidenceDigest: hash(p.closureEvidenceDigest),
      closedAtMillis: instant(p.closedAtMillis)};
  });
  if (new Set(predecessors.map((p) => p.writerId)).size !==
      predecessors.length ||
      r.migrationOperationId === r.recoveryOperationId) return fail();
  const result: DevelopHistoricalRisk = {
    schemaVersion: 1, kind: DEVELOP_HISTORICAL_RISK,
    projectId: "reguerta-9f27f",
    databaseId: "(default)", namespace: "develop/plus-collections",
    direction: r.direction as "forward" | "inverse",
    migrationOperationId: text(r.migrationOperationId),
    recoveryOperationId: text(r.recoveryOperationId),
    operatorPrincipalId: text(r.operatorPrincipalId),
    confirmationId: text(r.confirmationId),
    acceptedAtMillis: instant(r.acceptedAtMillis),
    expiresAtMillis: instant(r.expiresAtMillis),
    assessedAtMillis: instant(r.assessedAtMillis),
    sourceDigest: hash(r.sourceDigest),
    causalSetDigest: hash(r.causalSetDigest),
    workbookFileId: DEVELOP_HISTORICAL_WORKBOOK,
    workbookRevision: text(r.workbookRevision),
    workbookDigest: hash(r.workbookDigest),
    migrationPlanDigest: hash(r.migrationPlanDigest),
    inversePlanDigest: hash(r.inversePlanDigest),
    currentSourceDigest: hash(r.currentSourceDigest),
    technicalControlManifestDigest: hash(r.technicalControlManifestDigest),
    predecessors, legacyUntracked: true, replayAllowed: false,
    continuingWorkObserved: false,
  };
  if (result.acceptedAtMillis > result.assessedAtMillis ||
      result.assessedAtMillis >= result.expiresAtMillis ||
      predecessors.some((p) => p.closedAtMillis > result.acceptedAtMillis)) {
    return fail();
  }
  return result;
};

/**
 * Binds risk to current source, controls, workbook, named operator and one
 * migration/recovery. It leaves every other barrier and freshness check intact.
 * @param {ShiftPlanningIntakeBarrierEvidencePayload} payload Parsed evidence.
 * @return {void} Rejects mismatched authorization without mutating evidence.
 */
export const assertDevelopHistoricalRiskBinding = (
  payload: ShiftPlanningIntakeBarrierEvidencePayload,
): void => {
  const risk = payload.causalDrain.historicalRisk;
  if (!risk) return;
  if (payload.schemaVersion !== 3 || payload.environment !== "develop" ||
      !payload.causalDrain.containedDelivery) return fail();
  const intent = payload.administratorAgreement.payload.intent;
  const transition = payload.transition;
  if (risk.direction === "forward" ?
    transition.expectedStateRevision !== 0 ||
      transition.expectedWriteEpoch !== 0 ||
      transition.expectedActiveRevision !== null ||
      transition.expectedActiveDigest !== null :
    transition.expectedStateRevision !== 1 ||
      transition.expectedWriteEpoch !== 1 ||
      transition.expectedActiveRevision === null ||
      transition.expectedActiveDigest === null) return fail();
  if (intent.projectId !== risk.projectId ||
      intent.databaseId !== risk.databaseId ||
      !intent.administratorPrincipalIds.includes(risk.operatorPrincipalId) ||
      intent.sourceDigest !== risk.currentSourceDigest ||
      intent.technicalControlManifestDigest !==
        risk.technicalControlManifestDigest ||
      payload.transition.transitionId !== (risk.direction === "forward" ?
        risk.migrationOperationId : risk.recoveryOperationId) ||
      payload.transition.expectedAuthoritativeDigest !== risk.sourceDigest ||
      payload.causalDrain.acceptedSetDigest !== risk.causalSetDigest ||
      payload.workbook.fileId !== risk.workbookFileId ||
      payload.workbook.revision !== risk.workbookRevision ||
      payload.workbook.digest !== risk.workbookDigest ||
      payload.verifiedAtMillis >= risk.expiresAtMillis) return fail();
  for (const predecessor of risk.predecessors) {
    const control = payload.writerControls.find((c) =>
      c.writerId === predecessor.writerId);
    if (!control || control.state === "agreement-recorded" ||
        control.closedAtMillis !== predecessor.closedAtMillis) return fail();
  }
};

export const developHistoricalRiskDigest = (risk: DevelopHistoricalRisk):
  ShiftPlanningDigest => createShiftPlanningDigest(risk);
