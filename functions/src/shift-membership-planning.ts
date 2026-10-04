import type {ShiftMembershipUnitPolicy} from "./shift-credit-unit.js";
import {Firestore, Transaction} from "@google-cloud/firestore";
import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";
import {ShiftRotationCursor} from "./shift-planning-contract.js";
import {coverageId, coverageMember, rejectCoverage} from "./shift-coverage.js";
import {CoverageReserve} from "./shift-coverage-selection.js";
import {MemberSource, readShiftMembershipState} from
  "./shift-membership-reconciliation.js";

const root = "develop/plus-collections";
const types = ["delivery", "market"] as const;
type RecordValue = Record<string, unknown>;
type RecordDocument = {id: string; data: RecordValue};
export type ShiftMembershipPlanningSource = {
  records: RecordDocument[];
  reserves: RecordDocument[];
  publishedOwnerPositionKeys?: string[];
};
export type ShiftMembershipPlanningChange = {
  targetPath: string; before: RecordValue; after: RecordValue;
};

const memberSource = (value: RecordValue | undefined): MemberSource => {
  if (!value) return null;
  coverageMember(value);
  return {isActive: value.isActive as boolean,
    isCommonPurchaseManager: value.isCommonPurchaseManager as boolean,
    roles: [...new Set((value.roles as string[]).map((role) =>
      role.trim().toLowerCase()))].sort()};
};

export const parseShiftMembershipPlanningSource = (
  value: unknown,
): ShiftMembershipPlanningSource => {
  const source = value as ShiftMembershipPlanningSource;
  if (!source || !["records,reserves",
    "publishedOwnerPositionKeys,records,reserves"].includes(
    Object.keys(source).sort().join()) ||
      !Array.isArray(source.records) || !Array.isArray(source.reserves) ||
      source.records.length > 250 || source.reserves.length > 500) {
    return rejectCoverage("invalid_membership_planning_source");
  }
  if (source.publishedOwnerPositionKeys !== undefined &&
      (!Array.isArray(source.publishedOwnerPositionKeys) ||
        source.publishedOwnerPositionKeys.length > 3000 ||
        source.publishedOwnerPositionKeys.some((key) =>
          typeof key !== "string"))) {
    return rejectCoverage("invalid_membership_planning_source");
  }
  for (const records of [source.records, source.reserves]) {
    if (new Set(records.map((record) => record.id)).size !== records.length ||
        records.some((record) => Object.keys(record).sort().join() !==
          "data,id" || !record.data)) {
      return rejectCoverage("invalid_membership_planning_source");
    }
  }
  for (const record of source.records) {
    readShiftMembershipState(record.data, coverageId(record.id));
  }
  for (const record of source.reserves) {
    const reserve = record.data as CoverageReserve;
    if (!types.includes(reserve.type) || typeof reserve.active !== "boolean" ||
        record.id !== digest([reserve.type, coverageId(reserve.userId)])
          .split(":").at(-1) || !Number.isSafeInteger(reserve.revision) ||
        reserve.revision < 1 || reserve.revision >= Number.MAX_SAFE_INTEGER ||
        !Number.isSafeInteger(reserve.enteredAtMillis) ||
        reserve.enteredAtMillis < 0) {
      return rejectCoverage("invalid_coverage_reserve");
    }
  }
  return structuredClone(source);
};

/**
 * Capture all membership/reserve evidence, including nonpending records, so a
 * later eligibility reversal or FIFO change invalidates the staged candidate.
 * @param {Firestore} db Registered local emulator client.
 * @param {Transaction} transaction Planning source transaction.
 * @return {Promise<ShiftMembershipPlanningSource>} Complete bounded evidence.
 */
export const captureShiftMembershipPlanningSource = async (
  db: Firestore, transaction: Transaction,
): Promise<ShiftMembershipPlanningSource> => {
  const records = await transaction.get(db.collection(
    `${root}/shiftMembershipState`).orderBy("__name__").limit(251));
  const reserves = await transaction.get(db.collection(
    `${root}/shiftCoverageReserves`).orderBy("__name__").limit(501));
  return parseShiftMembershipPlanningSource({
    records: records.docs.map((doc) => ({id: doc.id, data: doc.data()})),
    reserves: reserves.docs.map((doc) => ({id: doc.id, data: doc.data()})),
  });
};

/**
 * Rebuild cohorts only at wholly new round boundaries. Retained owners keep
 * order; new/re-entering members append by reserve entry time then UID.
 * Prefixes and canonical input cursors are unchanged until the combined bundle
 * commits. Frozen exclusions are proposed with their original owner and reason;
 * planners must pair them with a full physical unit before acknowledgement.
 * @param {object} input Authoritative cursors, public frontier and live roster.
 * @return {object} Planned cohorts and complete-unit transition policies.
 */
export const planShiftMembershipAdmission = (input: {
  source: ShiftMembershipPlanningSource;
  rotations: {delivery: ShiftRotationCursor; market: ShiftRotationCursor};
  frozenThroughRound: {delivery: number; market: number};
  roster: readonly {userId: string; isActive: boolean; roles: readonly string[];
    isCommonPurchaseManager: boolean}[];
}) => {
  const source = parseShiftMembershipPlanningSource(input.source);
  const states = source.records.map((record) => ({record,
    state: readShiftMembershipState(record.data, record.id) ??
      rejectCoverage("invalid_shift_membership_state")}));
  for (const {state} of states) {
    const user = input.roster.find((member) => member.userId === state.userId);
    if (digest(state.source) !== digest(memberSource(user))) {
      return rejectCoverage("membership_source_not_reconciled");
    }
  }
  const pending = states.filter(({state}) => state.pendingQueueTransition);
  const cohorts = {delivery: [...input.rotations.delivery.cohortUserIds],
    market: [...input.rotations.market.cohortUserIds]};
  const policies: Partial<Record<"delivery" | "market",
    ShiftMembershipUnitPolicy>> = {};
  if (!pending.length) return {cohorts, policies};
  const eligibleIds = input.roster.filter((member) =>
    coverageMember(member).eligible).map((member) => member.userId);
  for (const type of types) {
    const cursor = input.rotations[type];
    const pendingForType = pending.filter(({state}) =>
      state.pendingTypes?.[type] ?? true);
    if (!pendingForType.length) continue;
    const startRound = Math.max(cursor.roundNumber +
      (cursor.nextMemberIndex === 0 ? 0 : 1),
    input.frozenThroughRound[type] + 1,
    ...pendingForType.map(({state}) => state.admissionAfterRound[type] + 1));
    if (pendingForType.some(({state}) => !state.admissionRequired ||
        types.some((key) => typeof state.admissionRequired?.[key] !==
          "boolean"))) {
      return rejectCoverage("membership_admission_evidence_required");
    }
    if (cursor.cohortUserIds.some((id) => !eligibleIds.includes(id) &&
        !pendingForType.some(({state}) =>
          state.userId === id && !state.eligible))) {
      return rejectCoverage("membership_source_not_reconciled");
    }
    const entrants = pendingForType.filter(({state}) => state.eligible &&
      state.admissionRequired?.[type]).map(({state}) => {
      const reserve = source.reserves.find((record) =>
        record.data.type === type && record.data.userId === state.userId)?.data;
      if (!reserve?.active || (reserve.enteredAtMillis as number) >
          state.observedAtMillis) {
        return rejectCoverage("membership_reserve_evidence_required");
      }
      return {id: state.userId, time: reserve.enteredAtMillis as number};
    }).sort((a, b) => a.time - b.time ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    cohorts[type] = [...cursor.cohortUserIds.filter((id) =>
      eligibleIds.includes(id) && !entrants.some((entry) => entry.id === id)),
    ...entrants.map((entry) => entry.id)];
    if (cohorts[type].length !== eligibleIds.length ||
        eligibleIds.some((id) => !cohorts[type].includes(id))) {
      return rejectCoverage("membership_source_not_reconciled");
    }
    if (cohorts[type].length < (type === "delivery" ? 2 : 3)) {
      return rejectCoverage("membership_unit_unstaffable");
    }
    const excusedOwners = pendingForType.filter(({state}) =>
      startRound > cursor.roundNumber &&
      cursor.cohortUserIds.includes(state.userId) &&
      (!state.eligible || state.admissionRequired?.[type])).map(({state}) => {
      const exclusion = state.frozenExclusion ?? (!state.eligible ? {
        reason: (!state.source || !state.source.isActive ? "excusedDeparture" :
          "excusedIneligible") as "excusedDeparture" | "excusedIneligible",
        revision: state.revision} : null);
      if (!exclusion) {
        return rejectCoverage("membership_exclusion_evidence_required");
      }
      return {userId: state.userId, reason: exclusion.reason,
        membershipRevision: exclusion.revision};
    });
    policies[type] = {cohortUserIds: cohorts[type], startRound, excusedOwners,
      publishedOwnerPositionKeys: source.publishedOwnerPositionKeys ?? []};
  }
  return {cohorts, policies};
};

/**
 * Acknowledge only the rotation whose first complete new-cohort unit activated.
 * The other rotation may retain its pending evidence for a later frontier.
 * @param {ShiftMembershipPlanningSource} source Bound pre-activation records.
 * @param {object} applied Complete-unit admission outcomes by rotation.
 * @return {ShiftMembershipPlanningChange[]} Exact transactional state images.
 */
export const buildShiftMembershipAcknowledgements = (
  source: ShiftMembershipPlanningSource,
  applied: {delivery: boolean; market: boolean},
): ShiftMembershipPlanningChange[] => {
  const changes: ShiftMembershipPlanningChange[] = [];
  for (const record of source.records) {
    const state = readShiftMembershipState(record.data, record.id);
    if (!state?.pendingQueueTransition) continue;
    const pendingTypes = {...state.pendingTypes ??
      {delivery: true, market: true}};
    const admissionRequired = {...state.admissionRequired ??
      {delivery: false, market: false}};
    let changed = false;
    for (const type of types) {
      if (!pendingTypes[type] || !applied[type]) continue;
      changed = true;
      pendingTypes[type] = false;
      admissionRequired[type] = false;
    }
    if (!changed) continue;
    if (state.revision >= Number.MAX_SAFE_INTEGER - 2) {
      return rejectCoverage("invalid_shift_membership_state");
    }
    const after = {...state, revision: state.revision + 1, pendingTypes,
      pendingQueueTransition: types.some((type) => pendingTypes[type]),
      admissionRequired};
    changes.push({targetPath: `${root}/shiftMembershipState/${record.id}`,
      before: record.data, after: {value: after, digest: digest(after)}});
  }
  return changes;
};

/**
 * Bind complete membership/reserve evidence and current member predicates on
 * each retry. Inverse expects acknowledged records but the same source members.
 * @param {object} input Same-attempt source and optional activated images.
 */
export const assertShiftMembershipPlanningSource = async (input: {
  firestore: Firestore; transaction: Transaction;
  source?: ShiftMembershipPlanningSource;
  activatedChanges?: ShiftMembershipPlanningChange[];
}) => {
  const actual = await captureShiftMembershipPlanningSource(
    input.firestore, input.transaction);
  const expected = structuredClone(input.source ?? {records: [], reserves: []});
  for (const change of input.activatedChanges ?? []) {
    const record = expected.records.find((record) =>
      change.targetPath === `${root}/shiftMembershipState/${record.id}`);
    if (record) record.data = change.after;
  }
  const ordered = (source: ShiftMembershipPlanningSource) => ({
    records: [...source.records].sort((a, b) => a.id.localeCompare(b.id)),
    reserves: [...source.reserves].sort((a, b) => a.id.localeCompare(b.id)),
  });
  if (digest(ordered(actual)) !== digest(ordered(expected))) {
    return rejectCoverage("membership_plan_source_changed");
  }
  if (!input.source?.records.length) return;
  const users = await input.transaction.getAll(...input.source.records.map(
    (record) => input.firestore.doc(`${root}/users/${record.id}`)));
  for (const [index, user] of users.entries()) {
    const record = input.source.records[index];
    const state = readShiftMembershipState(record.data, record.id);
    if (digest(state?.source) !== digest(memberSource(user.data()))) {
      return rejectCoverage("membership_source_not_reconciled");
    }
  }
};

export const restoreShiftMembershipPlanningRecord = (
  before: RecordValue, after: RecordValue, userId: string,
): RecordValue => {
  const original = readShiftMembershipState(before, userId) ??
    rejectCoverage("invalid_shift_membership_state");
  const current = readShiftMembershipState(after, userId) ??
    rejectCoverage("invalid_shift_membership_state");
  const restored = {...original, revision: current.revision + 1};
  return {value: restored, digest: digest(restored)};
};
