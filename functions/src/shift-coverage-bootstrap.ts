import {AppEnvironment, HttpRequestError, normalizeCanonicalRoles} from
  "./backend-security.js";
import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";
import {decodeShiftPlanningFirestoreDocument,
  encodeShiftPlanningFirestoreValue, ShiftPlanningEncodedFirestoreValue,
  parseShiftPlanningPublicShiftDocument} from
  "./shift-planning-publication-contract.js";
import {buildShiftPlanningAuthoritativeState} from
  "./shift-planning-state-persistence.js";
import {parseShiftSheetsWorkbookSubmission} from
  "./shift-planning-sheets-submission.js";
import {parseShiftPlanningWorkbookPartition} from
  "./shift-planning-firestore-sync-command-repository.js";
import {coverageId, coverageMember, SHIFT_COVERAGE_POLICY_REVISION} from
  "./shift-coverage.js";
import {MemberSource, MembershipState, readShiftMembershipState} from
  "./shift-membership-reconciliation.js";
import {planZeroShiftCoverageCredits} from
  "./shift-coverage-bootstrap-credit.js";
import {SHIFT_PLANNING_FIRESTORE_ADMISSION_REVISION} from
  "./shift-planning-firestore-transaction-manifest.js";

export const SHIFT_COVERAGE_BOOTSTRAP_COLLECTIONS = [
  "shiftCoverageCases", "shiftCoverageCredits", "shiftCoverageEffects",
  "shiftCoverageLedgerState", "shiftCoverageMemberClaims",
  "shiftCoverageMigrations", "shiftCoverageReserves", "shiftMembershipState",
  "shiftPlanningRequests", "shiftPlanningState", "shiftPlanningSyncCommands",
  "shiftRotations", "shifts", "users",
] as const;

export type ShiftCoverageBootstrapDecision = {
  schemaVersion: 1; environment: AppEnvironment; operationId: string;
  effectiveAtMillis: number; confirmationReference: string;
  reserves: "none"; credits: "none";
};
export type ShiftCoverageBootstrapSnapshot = {
  schemaVersion: 1; environment: AppEnvironment;
  collections: readonly string[];
  documents: readonly {path: string;
    value: ShiftPlanningEncodedFirestoreValue | null;
    updateTime: {seconds: number; nanoseconds: number} | null}[];
};
export type ShiftCoverageBootstrapPlan = {
  schemaVersion: 1; environment: AppEnvironment; operationId: string;
  sourceDigest: string; decisionDigest: string;
  blockers: {code: string; path: string}[];
  creates: {path: string; value: ShiftPlanningEncodedFirestoreValue}[];
  planDigest: string;
};
type Data = Record<string, unknown>;
const types = ["delivery", "market"] as const;
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const invalid = (): never => {
  throw new HttpRequestError(400, "invalid_coverage_bootstrap_input",
    "Coverage bootstrap requires an exact reviewed snapshot and decision");
};
const object = (value: unknown): Data => {
  if (!value || typeof value !== "object" ||
      Object.getPrototypeOf(value) !== Object.prototype) return invalid();
  return value as Data;
};
const exact = (value: unknown, fields: string[]) => value !== null &&
  typeof value === "object" &&
  Object.getPrototypeOf(value) === Object.prototype &&
  Object.keys(value).sort().join() === fields.sort().join();

/**
 * Only an explicit zero-balance/no-reserve decision is supported. This is a
 * current starting observation, never an invented historical activation date.
 * @param {unknown} value Exact human-confirmed decision.
 * @return {object} Detached immutable decision input.
 */
export const parseShiftCoverageBootstrapDecision = (
  value: unknown,
): ShiftCoverageBootstrapDecision => {
  const decision = object(value);
  if (!exact(decision, ["schemaVersion", "environment", "operationId",
    "effectiveAtMillis", "confirmationReference", "reserves", "credits"]) ||
      decision.schemaVersion !== 1 ||
      !["develop", "production"].includes(decision.environment as string) ||
      !Number.isSafeInteger(decision.effectiveAtMillis) ||
      (decision.effectiveAtMillis as number) < 0 ||
      typeof decision.confirmationReference !== "string" ||
      !decision.confirmationReference.trim() ||
      decision.confirmationReference.length > 500 ||
      decision.operationId === "current" ||
      decision.reserves !== "none" || decision.credits !== "none") {
    return invalid();
  }
  coverageId(decision.operationId);
  return {...decision} as ShiftCoverageBootstrapDecision;
};

/**
 * Prepare create-only baseline records from canonical users and frozen owner
 * evidence. No user, account, queue, assignment, case, policy or historical
 * balance is changed. Any incompatibility yields a reviewable blocked plan
 * with zero writes; applying it belongs to the separate held-barrier adapter.
 * @param {object} input Complete versioned source and explicit zero decision.
 * @return {object} Deterministic scoped plan, never an activation permission.
 */
export const planShiftCoverageBootstrap = (input: {
  snapshot: ShiftCoverageBootstrapSnapshot;
  decision: ShiftCoverageBootstrapDecision;
}): ShiftCoverageBootstrapPlan => {
  const decision = parseShiftCoverageBootstrapDecision(input.decision);
  const snapshot = input.snapshot;
  if (!exact(snapshot, ["schemaVersion", "environment", "collections",
    "documents"]) || snapshot.schemaVersion !== 1 ||
      snapshot.environment !== decision.environment ||
      !Array.isArray(snapshot.collections) ||
      [...snapshot.collections].sort().join() !==
        [...SHIFT_COVERAGE_BOOTSTRAP_COLLECTIONS].sort().join() ||
      !Array.isArray(snapshot.documents)) return invalid();
  const root = `${decision.environment}/plus-collections`;
  const decoded = new Map<string, Data | null>();
  for (const document of snapshot.documents) {
    if (!exact(document, ["path", "value", "updateTime"]) ||
        typeof document.path !== "string" || decoded.has(document.path)) {
      return invalid();
    }
    const parts = document.path.split("/");
    if (parts.length !== 4 || parts.slice(0, 2).join("/") !== root ||
        !snapshot.collections.includes(parts[2])) return invalid();
    coverageId(parts[3]);
    if (document.value === null) {
      if (document.updateTime !== null) return invalid();
      decoded.set(document.path, null);
    } else {
      const time = document.updateTime;
      if (!time || !exact(time, ["seconds", "nanoseconds"]) ||
          !Number.isSafeInteger(time.seconds) ||
          !Number.isSafeInteger(time.nanoseconds) ||
          time.nanoseconds < 0 || time.nanoseconds >= 1_000_000_000) {
        return invalid();
      }
      decoded.set(document.path,
        decodeShiftPlanningFirestoreDocument(document.value));
    }
  }
  for (const [collection, ids] of [["shiftPlanningState",
    ["current", "sourcePolicy", "sheetsSubmission"]],
  ["shiftRotations", types], ["shiftCoverageLedgerState", types],
  ["shiftCoverageMigrations", ["current"]]] as const) {
    if (ids.some((id) => !decoded.has(`${root}/${collection}/${id}`))) {
      return invalid();
    }
  }
  const normalized = {...snapshot,
    collections: [...snapshot.collections].sort(),
    documents: [...snapshot.documents].sort((a, b) =>
      compare(a.path, b.path))};
  const blockers: ShiftCoverageBootstrapPlan["blockers"] = [];
  const creates: ShiftCoverageBootstrapPlan["creates"] = [];
  const block = (code: string, path: string) => blockers.push({code, path});
  const rows = (collection: string) => [...decoded].flatMap(([path, data]) =>
    path.startsWith(`${root}/${collection}/`) && data !== null ?
      [{id: path.split("/")[3], path, data}] : []);
  for (const collection of SHIFT_COVERAGE_BOOTSTRAP_COLLECTIONS) {
    const limit = collection === "users" ||
      collection === "shiftMembershipState" ? 250 :
      collection === "shiftCoverageReserves" ? 500 : 1000;
    if (rows(collection).length > limit) {
      block("bootstrap_source_limit", `${root}/${collection}`);
    }
  }
  const create = (path: string, data: object) => creates.push({path,
    value: encodeShiftPlanningFirestoreValue(data, path, new Set())});
  let authority: ReturnType<typeof buildShiftPlanningAuthoritativeState> | null;
  try {
    authority = buildShiftPlanningAuthoritativeState({
      environment: decision.environment,
      maintenance: decoded.get(`${root}/shiftPlanningState/current`),
      rotations: Object.fromEntries(types.map((type) => [type,
        decoded.get(`${root}/shiftRotations/${type}`)]))});
    if (authority.maintenance.maintenanceStatus !== "closed") {
      block("bootstrap_maintenance_not_closed",
        `${root}/shiftPlanningState/current`);
    }
    if (!authority.maintenance.activeRevision) {
      block("bootstrap_active_rotation_required",
        `${root}/shiftPlanningState/current`);
    }
    for (const type of types) {
      if (authority.rotations[type].releaseLease) {
        block("bootstrap_rotation_release_pending",
          `${root}/shiftRotations/${type}`);
      }
    }
  } catch {
    authority = null;
    block("bootstrap_planning_authority_invalid",
      `${root}/shiftPlanningState/current`);
  }
  const policy = decoded.get(`${root}/shiftPlanningState/sourcePolicy`);
  const measurement = (policy?.sync as Data)
    ?.transactionMeasurementAuthority as Data | undefined;
  if (!policy || policy.schemaVersion !== 1 ||
      policy.environment !== decision.environment ||
      !Number.isSafeInteger(policy.transactionWriteLimit) ||
      (policy.transactionWriteLimit as number) < 1 ||
      (policy.transactionWriteLimit as number) > 500 || !measurement ||
      !exact(measurement, ["adapterRevision", "indexConfigurationDigest"]) ||
      measurement.adapterRevision !==
        SHIFT_PLANNING_FIRESTORE_ADMISSION_REVISION ||
      typeof measurement.indexConfigurationDigest !== "string" ||
      !/^shift-planning:v1:sha256:[a-f0-9]{64}$/
        .test(measurement.indexConfigurationDigest)) {
    block("bootstrap_source_policy_invalid",
      `${root}/shiftPlanningState/sourcePolicy`);
  }
  if ((policy?.coverage as Data)?.enabled === true) {
    block("bootstrap_coverage_already_enabled",
      `${root}/shiftPlanningState/sourcePolicy`);
  }
  const partitions = (policy?.sync as Data)?.partitions as Data | undefined;
  const workbooks = new Set<string>();
  if (!partitions || !exact(partitions, ["delivery", "market"])) {
    block("bootstrap_workbook_partition_invalid",
      `${root}/shiftPlanningState/sourcePolicy`);
  } else {
    for (const type of types) {
      try {
        const partition = parseShiftPlanningWorkbookPartition(partitions[type]);
        workbooks.add(partition.workbookId);
        if (partition.lease) {
          block("bootstrap_workbook_lease_pending",
            `${root}/shiftPlanningState/sourcePolicy`);
        }
      } catch {
        block("bootstrap_workbook_partition_invalid",
          `${root}/shiftPlanningState/sourcePolicy`);
      }
    }
  }
  if (workbooks.size !== 1) {
    block("bootstrap_workbook_scope_mismatch",
      `${root}/shiftPlanningState/sourcePolicy`);
  }
  const pointer = decoded.get(`${root}/shiftPlanningState/sheetsSubmission`);
  if (pointer) {
    try {
      const submission = parseShiftSheetsWorkbookSubmission(pointer);
      if (!workbooks.has(submission.workbookId) ||
          (submission.environment !== null &&
          submission.environment !== decision.environment)) {
        block("bootstrap_workbook_scope_mismatch",
          `${root}/shiftPlanningState/sheetsSubmission`);
      }
      if (submission.evidence === null) {
        block("bootstrap_workbook_submission_pending",
          `${root}/shiftPlanningState/sheetsSubmission`);
      }
    } catch {
      block("bootstrap_workbook_submission_invalid",
        `${root}/shiftPlanningState/sheetsSubmission`);
    }
  }
  for (const row of rows("shiftCoverageMigrations")) {
    block("bootstrap_already_initialized", row.path);
  }
  for (const row of rows("shiftCoverageCases")) {
    const value = row.data.value as Data;
    if (!value || value.schemaVersion !== 1 ||
        row.data.digest !== digest(value) || value.id !== row.id ||
        value.environment !== decision.environment ||
        value.policyRevision !== SHIFT_COVERAGE_POLICY_REVISION ||
        !["completed", "cancelled", "failed"].includes(
          value.status as string)) {
      block("bootstrap_coverage_case_unresolved", row.path);
    }
  }
  for (const row of rows("shiftCoverageEffects")) {
    const value = row.data.value as Data;
    const {effectsDigest, ...core} = value ?? {};
    if (!value || value.schemaVersion !== 1 ||
        value.environment !== decision.environment ||
        value.operationId !== row.id || effectsDigest !== digest(core) ||
        !["completed", "retired"].includes(row.data.state as string)) {
      block("bootstrap_coverage_effect_unresolved", row.path);
    }
  }
  for (const collection of ["shiftPlanningRequests",
    "shiftPlanningSyncCommands"]) {
    for (const row of rows(collection)) {
      const state = row.data.status ?? row.data.state;
      if (!["completed", "failed"].includes(state as string)) {
        block("bootstrap_planning_work_pending", row.path);
      }
    }
  }
  const publicShifts = rows("shifts").flatMap((row) => {
    try {
      return [{path: row.path, value: parseShiftPlanningPublicShiftDocument({
        targetPath: row.path, value: row.data})}];
    } catch {
      block("bootstrap_public_history_invalid", row.path);
      return [];
    }
  });
  const sources = new Map<string, MemberSource>();
  for (const row of rows("users")) {
    try {
      const roles = normalizeCanonicalRoles(row.data.roles).sort();
      coverageMember(row.data);
      sources.set(row.id, {roles, isActive: row.data.isActive as boolean,
        isCommonPurchaseManager: row.data.isCommonPurchaseManager as boolean});
    } catch {
      block("bootstrap_member_invalid", row.path);
    }
  }
  const existing = new Map<string, MembershipState>();
  for (const {value} of publicShifts) {
    if (value.date.toMillis() <= decision.effectiveAtMillis ||
        value.completion.state !== "uncompleted") continue;
    const participants = [...value.assignedUserIds,
      ...(value.helperUserId ? [value.helperUserId] : [])];
    for (const userId of participants) {
      const source = sources.get(userId);
      if (!source) {
        block("bootstrap_future_member_missing", `${root}/users/${userId}`);
      } else if (!coverageMember(source).eligible) {
        block("bootstrap_future_assignment_ineligible",
          `${root}/users/${userId}`);
      }
    }
  }
  for (const row of rows("shiftMembershipState")) {
    try {
      const state = readShiftMembershipState(row.data, row.id);
      if (!state || state.pendingQueueTransition ||
        digest(state.source) !== digest(sources.get(row.id) ?? null) ||
        state.observedAtMillis > decision.effectiveAtMillis) {
        block("bootstrap_membership_reconciliation_required", row.path);
      } else existing.set(row.id, state);
    } catch {
      block("bootstrap_membership_state_invalid", row.path);
    }
  }
  for (const row of rows("shiftCoverageReserves")) {
    const reserve = row.data;
    try {
      coverageId(reserve.userId);
      if (!types.includes(reserve.type as typeof types[number]) ||
          row.id !== digest([reserve.type, reserve.userId]).split(":").at(-1) ||
          typeof reserve.active !== "boolean" ||
          !Number.isSafeInteger(reserve.revision) ||
          (reserve.revision as number) < 1 ||
          (reserve.revision as number) >= Number.MAX_SAFE_INTEGER ||
          !Number.isSafeInteger(reserve.enteredAtMillis) ||
          (reserve.enteredAtMillis as number) < 0 ||
          (reserve.enteredAtMillis as number) > decision.effectiveAtMillis ||
          (reserve.admissionAfterRound !== undefined &&
            (!Number.isSafeInteger(reserve.admissionAfterRound) ||
            (reserve.admissionAfterRound as number) < 0)) || reserve.active) {
        block("bootstrap_reserve_evidence_required", row.path);
      }
    } catch {
      block("bootstrap_reserve_evidence_required", row.path);
    }
  }
  if (authority) {
    for (const [userId, source] of sources) {
      const eligible = coverageMember(source).eligible;
      for (const type of types) {
        const inCohort = authority.rotations[type].cursor.cohortUserIds
          .includes(userId);
        if (eligible !== inCohort) {
          block("bootstrap_cohort_reconciliation_required",
            `${root}/users/${userId}`);
        }
      }
      if (existing.has(userId)) continue;
      const admissionAfterRound = Object.fromEntries(types.map((type) => [type,
        Math.max((authority?.rotations[type].cursor.roundNumber as number) -
        (authority?.rotations[type].cohortFrozen ? 0 : 1),
        ...publicShifts.filter(({value}) => value.type === type).flatMap(
          ({value}) => value.rotationPositions?.map((p) => p.roundNumber) ??
            [value.roundNumber ?? 0]))])) as {delivery: number; market: number};
      const value: MembershipState = {schemaVersion: 1,
        policyRevision: SHIFT_COVERAGE_POLICY_REVISION, userId, revision: 1,
        source, eligible, observedAtMillis: decision.effectiveAtMillis,
        pendingQueueTransition: false, admissionAfterRound,
        admissionRequired: {delivery: false, market: false},
        pendingTypes: {delivery: false, market: false}};
      readShiftMembershipState({value, digest: digest(value)}, userId);
      create(`${root}/shiftMembershipState/${userId}`,
        {value, digest: digest(value)});
    }
  }
  if (authority) {
    for (const type of types) {
      for (const userId of authority.rotations[type].cursor.cohortUserIds) {
        if (!sources.has(userId)) {
          block("bootstrap_cohort_member_missing", `${root}/users/${userId}`);
        }
      }
    }
  }
  const credit = planZeroShiftCoverageCredits({
    credits: rows("shiftCoverageCredits"),
    claims: rows("shiftCoverageMemberClaims"),
    ledgers: rows("shiftCoverageLedgerState")});
  for (const item of credit.blockers) {
    block(item.code, `${root}/${item.collection}/${item.id}`);
  }
  for (const item of credit.creates) {
    create(`${root}/${item.collection}/${item.id}`, item.data);
  }
  if (creates.length + 2 > 500 ||
      creates.length + 2 > (policy?.transactionWriteLimit as number)) {
    block("bootstrap_write_budget_exceeded", root);
  }
  const core = {schemaVersion: 1 as const, environment: decision.environment,
    operationId: decision.operationId, sourceDigest: digest(normalized),
    decisionDigest: digest(decision),
    blockers: [...new Map(blockers.map((item) =>
      [`${item.code}:${item.path}`, item])).values()].sort((a, b) =>
      compare(a.path, b.path) || compare(a.code, b.code)),
    creates: blockers.length ? [] : creates.sort((a, b) =>
      compare(a.path, b.path))};
  return {...core, planDigest: digest(core)};
};
