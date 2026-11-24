import type {AppEnvironment} from "./backend-security.js";
import {DocumentSnapshot, Firestore, Transaction} from
  "@google-cloud/firestore";
import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";
import {coverageId, coverageMember, rejectCoverage} from "./shift-coverage.js";
import {readShiftMembershipState} from "./shift-membership-reconciliation.js";
import {firstDueOrdinaryShift} from "./shift-membership-lifecycle.js";
import {parseShiftCoverageCredit} from "./shift-credit-unit.js";
import {CoverageReserve} from "./shift-coverage-selection.js";
import {parseShiftPlanningPublicShiftDocument} from
  "./shift-planning-publication-contract.js";
import {captureShiftPlanningWriterAuthority} from
  "./shift-planning-writer-authority.js";
import {HttpRequestError} from "./backend-security.js";

const types = ["delivery", "market"] as const;
const version = (doc: DocumentSnapshot) => ({path: doc.ref.path,
  updateTime: doc.updateTime ?
    [doc.updateTime.seconds, doc.updateTime.nanoseconds] : null});

/**
 * Administrative accounting and source observation, not a membership editor.
 * The token binds the current source, persisted accounting and planning inputs;
 * writers recompute it in their own transaction before any mutation. Names and
 * private reasons never grant authority. Missing members with history remain
 * addressable; due ordinary positions use the same reserve exit predicate.
 * @param {Firestore} db Fixed local database.
 * @param {Transaction} transaction Shared read/write transaction.
 * @param {number} now Trusted time.
 * @param {string} environment Same bound environment as the caller transaction.
 * @return {Promise<object>} Minimal rows and membership-writer capability.
 */
export const readMembershipAdministration = async (
  db: Firestore, transaction: Transaction, now: number,
  environment: AppEnvironment = "develop",
) => {
  const root = `${environment}/plus-collections`;
  const snapshots = [];
  for (const [collection, limit] of [["users", 500],
    ["shiftMembershipState", 250], ["shiftCoverageReserves", 1000],
    ["shiftCoverageCredits", 1000], ["shifts", 1000]] as const) {
    const snapshot = await transaction.get(
      db.collection(`${root}/${collection}`)
        .orderBy("__name__").limit(limit + 1));
    if (snapshot.size > limit) return rejectCoverage("membership_source_limit");
    snapshots.push(snapshot.docs);
  }
  const [users, states, reserves, credits, shifts] = snapshots;
  const authority = await transaction.getAll(
    db.doc(`${root}/shiftPlanningState/current`),
    ...types.map((type) => db.doc(`${root}/shiftRotations/${type}`)));
  let membershipWritable = false;
  try {
    membershipWritable = Boolean(captureShiftPlanningWriterAuthority(
      authority[0].data()));
  } catch (error) {
    if (!(error instanceof HttpRequestError) ||
        error.code !== "shift_planning_maintenance") throw error;
  }
  const publicShifts = shifts.map((doc) => ({id: doc.id,
    shift: parseShiftPlanningPublicShiftDocument({
      targetPath: doc.ref.path, value: doc.data()})}));
  const parsedCredits = credits.map((doc) => {
    const credit = parseShiftCoverageCredit(doc.data());
    if (credit.id !== doc.id) return rejectCoverage("invalid_coverage_credit");
    return credit;
  });
  const parsedReserves = reserves.map((doc) => {
    const reserve = doc.data() as CoverageReserve;
    coverageId(reserve.userId);
    if (!types.includes(reserve.type) ||
        doc.id !== digest([reserve.type, reserve.userId]).split(":").at(-1) ||
        typeof reserve.active !== "boolean" ||
        !Number.isSafeInteger(reserve.revision) || reserve.revision < 1 ||
        !Number.isSafeInteger(reserve.enteredAtMillis) ||
        reserve.enteredAtMillis < 0 || reserve.enteredAtMillis > now) {
      return rejectCoverage("invalid_coverage_reserve");
    }
    const due = reserve.active ?
      firstDueOrdinaryShift(reserve, publicShifts, now) : undefined;
    return {stored: reserve, visible: {type: reserve.type,
      active: reserve.active && !due, enteredAtMillis: reserve.enteredAtMillis,
      admissionAfterRound: reserve.admissionAfterRound ?? null}};
  });
  const ids = new Set([...users.map((doc) => doc.id),
    ...states.map((doc) => doc.id), ...parsedCredits.map((item) => item.userId),
    ...parsedReserves.map((item) => item.stored.userId)]);
  if (ids.size > 500) return rejectCoverage("membership_source_limit");
  const planningDigest = digest({authority: authority.map(version),
    shifts: shifts.map(version)});
  const members = [...ids].sort().map((userId) => {
    coverageId(userId);
    const sourceDoc = users.find((doc) => doc.id === userId);
    const source = sourceDoc?.data();
    const member = source ? coverageMember(source) : null;
    const state = readShiftMembershipState(
      states.find((doc) => doc.id === userId)?.data(), userId);
    const ownReserves = parsedReserves.filter((item) =>
      item.stored.userId === userId);
    const ownCredits = parsedCredits.filter((item) => item.userId === userId);
    const name = typeof source?.displayName === "string" ?
      source.displayName.trim() : "";
    return {userId, displayName: name || userId,
      membershipRevision: state?.revision ?? 0,
      sourceActive: member?.active ?? null, eligible: member?.eligible ?? false,
      permanentDeparture: Boolean(state?.permanentDeparture),
      pendingQueueTransition: state?.pendingQueueTransition ?? false,
      contextDigest: digest({userId,
        source: sourceDoc ? version(sourceDoc) : null,
        state, reserves: ownReserves, credits: ownCredits, planningDigest}),
      reserves: ownReserves.map((item) => item.visible),
      credits: types.map((type) => ({type,
        pendingCount: ownCredits.filter((item) =>
          item.type === type && item.state === "pending").length,
        consumedCount: ownCredits.filter((item) =>
          item.type === type && item.state === "consumed").length,
        cancelledCount: ownCredits.filter((item) =>
          item.type === type && item.state === "cancelled").length}))};
  });
  return {membershipWritable, members};
};
