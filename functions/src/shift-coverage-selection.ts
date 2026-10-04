import type {CoverageDraw} from "./shift-coverage-draw.js";
import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";
import {coverageMember, rejectCoverage} from "./shift-coverage.js";

export type CoverageSelectionPolicy = {
  version: "fifo-signup-v1";
  volunteerWindowMillis: number;
};

export type CoverageReserve = {
  userId: string;
  type: "delivery" | "market";
  active: boolean;
  enteredAtMillis: number;
  revision: number;
};

export type CoverageCandidate = {
  userId: string;
  memberDigest: string;
  exclusion: string | null;
  reserve: CoverageReserve | null;
};

export type CoverageSelection = {
  policy: CoverageSelectionPolicy;
  snapshot: CoverageCandidate[];
  snapshotDigest: string;
  phase: "reserve" | "volunteers" | "drawRequired" | "draw" | "adminRequired";
  draw?: CoverageDraw;
  attemptedUserIds: string[];
  volunteers: {userId: string; receivedAtMillis: number; withdrawn: boolean}[];
  volunteerClosesAtMillis: number | null;
  latestExclusions: {userId: string; reason: string}[];
};

/**
 * Discovery exclusions mirror the acceptance invariants. Proximity beyond
 * immediate delivery neighbors remains outside this provisional policy.
 * @param {object} input Transactionally observed candidate and physical unit.
 * @return {string|null} Auditable exclusion, or null when eligible.
 */
export const coverageCandidateExclusion = (input: {
  userId: string;
  memberValue: unknown;
  claimed: boolean;
  assignedUserIds: readonly string[];
  adjacentUserIds: readonly string[];
}): string | null => {
  if (!input.memberValue) return "member_missing";
  let member;
  try {
    member = coverageMember(input.memberValue);
  } catch {
    return "member_malformed";
  }
  if (!member.active) return "inactive";
  if (!member.eligible) return "real_producer";
  if (input.assignedUserIds.includes(input.userId)) return "already_assigned";
  if (input.adjacentUserIds.includes(input.userId)) return "adjacent_delivery";
  if (input.claimed) return "same_type_claim";
  return null;
};

export const parseCoverageSelectionPolicy = (
  value: CoverageSelectionPolicy | undefined,
): CoverageSelectionPolicy => {
  if (!value || value.version !== "fifo-signup-v1" ||
      !Number.isSafeInteger(value.volunteerWindowMillis) ||
      value.volunteerWindowMillis <= 0 ||
      value.volunteerWindowMillis >= Number.MAX_SAFE_INTEGER) {
    return rejectCoverage("coverage_selection_policy_required");
  }
  return {...value};
};

const compareId = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

export const createCoverageSelection = (input: {
  policy: CoverageSelectionPolicy;
  candidates: CoverageCandidate[];
  caseId: string;
}): CoverageSelection => {
  const policy = parseCoverageSelectionPolicy(input.policy);
  const snapshot = [...input.candidates]
    .sort((a, b) => compareId(a.userId, b.userId));
  return {
    policy, snapshot, snapshotDigest: digest({caseId: input.caseId,
      policy, snapshot}), phase: "reserve", attemptedUserIds: [],
    volunteers: [], volunteerClosesAtMillis: null,
    latestExclusions: snapshot.flatMap((candidate) => candidate.exclusion ?
      [{userId: candidate.userId, reason: candidate.exclusion}] : []),
  };
};

/**
 * Advances only through the frozen pool. Declines/expiry never rebuild it or
 * repeat an offered member. Current exclusions and reserve exits are persisted
 * with the operation; newly joined reserves cannot jump into an existing queue.
 * Draw offers use the committed order; exhaustion requires admin resolution.
 * @param {object} input Frozen selection, current eligibility and server time.
 * @return {object} Next selection state and at most one proposed offer.
 */
export const advanceCoverageSelection = (input: {
  selection: CoverageSelection;
  candidates: CoverageCandidate[];
  now: number;
}): {selection: CoverageSelection; userId: string | null} => {
  const selection = structuredClone(input.selection);
  if (selection.phase === "adminRequired") {
    return rejectCoverage("coverage_admin_required");
  }
  if (selection.phase === "drawRequired") {
    return rejectCoverage("coverage_draw_required");
  }
  if (selection.phase === "volunteers" &&
      (selection.volunteerClosesAtMillis === null ||
        input.now < selection.volunteerClosesAtMillis)) {
    return rejectCoverage("coverage_volunteer_window_open");
  }
  const current = new Map(input.candidates.map((item) => [item.userId, item]));
  const pool = selection.phase === "draw" ?
    (selection.draw?.order ?? rejectCoverage("coverage_draw_not_revealed"))
      .map((userId) => ({userId})) : selection.phase === "reserve" ?
      selection.snapshot
        .filter((item) => item.reserve?.active)
        .sort((a, b) => (a.reserve?.enteredAtMillis ?? 0) -
      (b.reserve?.enteredAtMillis ?? 0) || compareId(a.userId, b.userId)) :
      selection.volunteers.filter((item) => !item.withdrawn)
        .sort((a, b) => a.receivedAtMillis - b.receivedAtMillis ||
        compareId(a.userId, b.userId));
  const original = new Map(
    selection.snapshot.map((item) => [item.userId, item]));
  selection.latestExclusions = [];
  let selected: string | null = null;
  for (const entry of pool) {
    const id = entry.userId;
    const source = original.get(id);
    const live = current.get(id);
    const reason = selection.attemptedUserIds.includes(id) ? "already_offered" :
      source?.exclusion ?? live?.exclusion ?? (!live ? "member_missing" : null);
    const reserveChanged = selection.phase === "reserve" &&
      (!live?.reserve?.active ||
        live.reserve.revision !== source?.reserve?.revision ||
        live.reserve.enteredAtMillis !== source.reserve?.enteredAtMillis);
    const exclusion = reason ?? (reserveChanged ? "reserve_changed" : null);
    if (exclusion) {
      selection.latestExclusions.push({userId: id, reason: exclusion});
    } else if (!selected) {
      selected = id;
    }
  }
  if (selected) {
    selection.attemptedUserIds.push(selected);
  } else if (selection.phase === "reserve") {
    selection.phase = "volunteers";
    selection.volunteerClosesAtMillis =
      input.now + selection.policy.volunteerWindowMillis;
  } else {
    selection.phase = selection.phase === "draw" ?
      "adminRequired" : "drawRequired";
  }
  return {selection, userId: selected};
};
