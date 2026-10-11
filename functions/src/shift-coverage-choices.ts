import {Firestore, Transaction} from "@google-cloud/firestore";
import {coverageMember, rejectCoverage} from "./shift-coverage.js";
import {parseShiftPlanningPublicShiftDocument} from
  "./shift-planning-publication-contract.js";

/**
 * Minimal native form choices; these are not selection snapshots or permission
 * grants. Commands still check eligibility, neighbors and slot occupancy.
 * @param {Firestore} db Local store.
 * @param {Transaction} transaction Same authorization/read transaction.
 * @param {object} actor Canonical actor.
 * @param {number} now Authoritative time.
 * @param {boolean} writable Current writer authority.
 * @return {object} Future owned slots and administrator member labels only.
 */
export const readShiftCoverageChoices = async (
  db: Firestore, transaction: Transaction,
  actor: {memberId: string; admin: boolean; visibleMemberIds: string[]},
  now: number, writable: boolean,
) => {
  const root = "develop/plus-collections";
  const shifts = await transaction.get(db.collection(`${root}/shifts`)
    .where("date", ">", new Date(now)).limit(501));
  if (shifts.size > 500) return rejectCoverage("coverage_read_limit");
  const availableShifts = shifts.docs.flatMap((document) => {
    const shift = parseShiftPlanningPublicShiftDocument({
      targetPath: document.ref.path, value: document.data()});
    if (!actor.admin && !shift.assignedUserIds.includes(actor.memberId)) {
      return [];
    }
    return [{shiftId: document.id, type: shift.type,
      scheduledAtMillis: shift.date.toMillis(),
      shiftRevision: shift.documentRevision, writable,
      assignedUserIds: actor.admin ? shift.assignedUserIds : [actor.memberId]}];
  }).sort((a, b) => a.scheduledAtMillis - b.scheduledAtMillis ||
    a.shiftId.localeCompare(b.shiftId));
  const visibleMemberIds = new Set([...actor.visibleMemberIds,
    ...availableShifts.flatMap((shift) => shift.assignedUserIds)]);
  const users = actor.admin ? (await transaction.get(
    db.collection(`${root}/users`).limit(501))).docs :
    await transaction.getAll(...[...new Set([actor.memberId,
      ...actor.visibleMemberIds])].map((id) => db.doc(`${root}/users/${id}`)));
  if (users.length > 500) return rejectCoverage("coverage_read_limit");
  const members = users.flatMap((document) => {
    const value = document.data();
    const member = value ? coverageMember(value) : null;
    if (actor.admin && !member?.eligible &&
        !visibleMemberIds.has(document.id) &&
        document.id !== actor.memberId) return [];
    const name = typeof value?.displayName === "string" ?
      value.displayName.trim() : "";
    return [{memberId: document.id, displayName: name || document.id,
      offerCandidate: Boolean(actor.admin && member?.eligible)}];
  });
  return {availableShifts, members};
};
