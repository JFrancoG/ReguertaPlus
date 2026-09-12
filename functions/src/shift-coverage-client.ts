import {readShiftCoverageChoices} from "./shift-coverage-choices.js";
import {Firestore} from "@google-cloud/firestore";
import {HttpRequestError, VerifiedIdentity} from "./backend-security.js";
import {readShiftCoverageActor} from "./shift-coverage-access.js";
import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";
import {coverageId, rejectCoverage, ShiftCoverageCase,
  SHIFT_COVERAGE_POLICY_REVISION} from "./shift-coverage.js";
import {parseShiftCoverageCredit} from "./shift-credit-unit.js";
import {parseShiftPlanningPublicShiftDocument} from
  "./shift-planning-publication-contract.js";
import {captureShiftPlanningWriterAuthority} from
  "./shift-planning-writer-authority.js";
import {requireProvisionalCreditPublication} from
  "./shift-credit-publication.js";

export type ShiftCoverageQuery = {schemaVersion: 1; environment: "develop"} &
  ({action: "overview"} | {action: "detail"; caseId: string});

export const parseShiftCoverageQuery = (value: unknown): ShiftCoverageQuery => {
  const body = value as ShiftCoverageQuery;
  if (!body || typeof body !== "object" ||
      Object.getPrototypeOf(body) !== Object.prototype ||
      body.schemaVersion !== 1 || body.environment !== "develop" ||
      !["overview", "detail"].includes(body.action) ||
      Object.keys(body).sort().join() !== (body.action === "overview" ?
        "action,environment,schemaVersion" :
        "action,caseId,environment,schemaVersion")) {
    return rejectCoverage("invalid_coverage_query");
  }
  return body.action === "overview" ? {...body} :
    {...body, caseId: coverageId(body.caseId)};
};

const visibleCase = (
  value: ShiftCoverageCase,
  actor: {memberId: string; eligible: boolean; admin: boolean},
) => actor.admin || [value.absentUserId, value.openedByUserId,
  value.acceptedUserId, value.offer?.userId].includes(actor.memberId) ||
  value.selection?.volunteers.some((item) => item.userId === actor.memberId) ||
  value.selection?.attemptedUserIds.includes(actor.memberId) ||
  (actor.eligible && ["open", "offered"].includes(value.status));

/**
 * Project case state without candidate lists, exclusion reasons or draw inputs.
 * Member views contain only their own offer/volunteering and public assignment;
 * administrative context is explicit and never spread from a stored record.
 * @param {object} input Transactional case, actor, shift and authority.
 * @return {object} JSON-safe contract shared by both native platforms.
 */
export const projectShiftCoverageCase = (input: {
  value: ShiftCoverageCase; memberId: string; admin: boolean;
  scheduledAtMillis: number; shiftRevision: number; writable: boolean;
}) => {
  const {value, memberId, admin} = input;
  const offer = value.offer && (admin || value.offer.userId === memberId) ? {
    userId: value.offer.userId, source: value.offer.source,
    expiresAtMillis: value.offer.expiresAtMillis} : null;
  return {caseId: value.id, shiftId: value.shiftId, type: value.type,
    positionIndex: value.positionIndex, status: value.status,
    revision: value.revision, shiftRevision: input.shiftRevision,
    scheduledAtMillis: input.scheduledAtMillis, writable: input.writable,
    absentUserId: value.absentUserId, acceptedUserId: value.acceptedUserId,
    offer, selectionPhase: value.selection?.phase ?? null,
    volunteerClosesAtMillis: value.selection?.volunteerClosesAtMillis ?? null,
    volunteered: value.selection?.volunteers.some((item) =>
      item.userId === memberId && !item.withdrawn) ?? false,
    hasVolunteered: value.selection?.volunteers.some((item) =>
      item.userId === memberId) ?? false,
    drawCommitted: Boolean(value.selection?.draw),
    drawAvailableAtMillis: value.selection?.draw?.availableAtMillis ?? null,
    updatedAtMillis: value.updatedAtMillis,
    openedByMe: value.openedByUserId === memberId,
    canResumeAdmin: Boolean(admin && value.status === "cancelled" &&
      value.selection?.draw),
    administration: admin ? {openedByUserId: value.openedByUserId,
      reason: value.reason,
      volunteerCount: value.selection?.volunteers.filter((item) =>
        !item.withdrawn).length ?? 0} : null};
};

/**
 * Read-only, transactionally consistent local inbox/detail and own accounting.
 * Bounds reject explicitly rather than returning a silently partial inbox.
 * Session links, roles and maintenance are re-read even for historical details.
 * @param {Firestore} db The fixed-emulator store's client.
 * @param {Function} nowMillis Trusted clock, evaluated on every retry.
 * @param {object} policy Explicit local deadlines and configured capability.
 * @return {Function} Query adapter; no internal records escape its projections.
 */
export const createShiftCoverageClientReader = (
  db: Firestore, nowMillis: () => number,
  policy: {maximumOfferWindowMillis: number;
    volunteerWindowMillis: number | null;
    drawAvailable: boolean},
) => async (value: unknown, identity: VerifiedIdentity) => {
  requireProvisionalCreditPublication("develop");
  const query = parseShiftCoverageQuery(value);
  const root = "develop/plus-collections";
  return db.runTransaction(async (transaction) => {
    const actor = await readShiftCoverageActor(db, transaction, identity);
    const now = nowMillis();
    if (!Number.isSafeInteger(now) || now < 0) {
      return rejectCoverage("invalid_coverage_clock");
    }
    const maintenance = await transaction.get(
      db.doc(`${root}/shiftPlanningState/current`));
    let authority = null;
    try {
      authority = captureShiftPlanningWriterAuthority(maintenance.data());
    } catch (error) {
      if (!(error instanceof HttpRequestError) ||
          error.code !== "shift_planning_maintenance") throw error;
    }
    const cases = query.action === "detail" ? [await transaction.get(
      db.doc(`${root}/shiftCoverageCases/${query.caseId}`))] :
      (await transaction.get(db.collection(`${root}/shiftCoverageCases`)
        .orderBy("__name__").limit(251))).docs;
    if (cases.length > 250) return rejectCoverage("coverage_read_limit");
    const visible = cases.flatMap((document) => {
      if (!document.exists) return [];
      const stored = document.data();
      const item = stored?.value as ShiftCoverageCase;
      if (!item || stored?.digest !== digest(item) ||
          item.id !== document.id || item.environment !== "develop" ||
          item.policyRevision !== SHIFT_COVERAGE_POLICY_REVISION) {
        return rejectCoverage("invalid_coverage_case");
      }
      return visibleCase(item, actor) ? [{item, authority: stored?.authority}] :
        [];
    });
    if (query.action === "detail" && !visible.length) {
      return rejectCoverage("coverage_case_unavailable");
    }
    const shifts = visible.length ? await transaction.getAll(...visible.map(
      ({item}) => db.doc(`${root}/shifts/${coverageId(item.shiftId)}`))) : [];
    const projected = visible.map(({item, authority: captured}, index) => {
      const document = shifts[index];
      const shift = parseShiftPlanningPublicShiftDocument({
        targetPath: document.ref.path, value: document.data()});
      return projectShiftCoverageCase({value: item, ...actor,
        scheduledAtMillis: shift.date.toMillis(),
        shiftRevision: shift.documentRevision,
        writable: Boolean(authority &&
          digest(authority) === digest(captured))});
    }).sort((a, b) => a.scheduledAtMillis - b.scheduledAtMillis ||
      (a.caseId < b.caseId ? -1 : a.caseId > b.caseId ? 1 : 0));
    const credits = await transaction.get(db.collection(
      `${root}/shiftCoverageCredits`).where("userId", "==", actor.memberId)
      .limit(251));
    const reserves = await transaction.get(db.collection(
      `${root}/shiftCoverageReserves`).where("userId", "==", actor.memberId)
      .limit(3));
    if (credits.size > 250 || reserves.size > 2) {
      return rejectCoverage("coverage_read_limit");
    }
    const choices = await readShiftCoverageChoices(
      db, transaction, {...actor, visibleMemberIds: projected.flatMap((item) =>
        [item.absentUserId, item.acceptedUserId, item.offer?.userId]
          .filter((id): id is string => Boolean(id)))},
      now, Boolean(authority));
    return {...choices, schemaVersion: 1, environment: "develop",
      memberId: actor.memberId,
      isAdmin: actor.admin, eligible: actor.eligible, serverTimeMillis: now,
      policyRevision: SHIFT_COVERAGE_POLICY_REVISION, policy: {...policy},
      cases: projected,
      credits: credits.docs.map((document) => {
        const credit = parseShiftCoverageCredit(document.data());
        if (credit.id !== document.id) {
          return rejectCoverage("invalid_coverage_credit");
        }
        return {creditId: credit.id, shiftId: credit.shiftId, type: credit.type,
          state: credit.state, earnedAtMillis: credit.earnedAtMillis,
          consumedAtMillis: credit.state === "consumed" ?
            credit.consumedAtMillis : null};
      }),
      reserves: reserves.docs.map((document) => {
        const reserve = document.data();
        if (!["delivery", "market"].includes(reserve.type) ||
            document.id !== digest([reserve.type, actor.memberId])
              .split(":").at(-1) || typeof reserve.active !== "boolean" ||
            !Number.isSafeInteger(reserve.enteredAtMillis) ||
            reserve.enteredAtMillis < 0 || reserve.enteredAtMillis > now) {
          return rejectCoverage("invalid_coverage_reserve");
        }
        return {type: reserve.type, active: reserve.active,
          enteredAtMillis: reserve.enteredAtMillis};
      })};
  });
};
