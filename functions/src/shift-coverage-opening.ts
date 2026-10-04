import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";
import type {ShiftPlanningPublicShiftDocument} from
  "./shift-planning-publication-contract.js";
import {SHIFT_COVERAGE_POLICY_REVISION, ShiftCoverageCase} from
  "./shift-coverage.js";

export const shiftCoverageOwnershipDigest = (
  shift: ShiftPlanningPublicShiftDocument,
) => digest({
  owner: shift.rotationOwnerUserId, owners: shift.rotationOwnerUserIds,
  round: shift.roundNumber, position: shift.positionInRound,
  positions: shift.rotationPositions?.map((position) => ({
    owner: position.rotationOwnerUserId, round: position.roundNumber,
    position: position.positionInRound,
  })) ?? null,
});

/**
 * Shared case construction after transactional authority, future-slot and
 * occupancy checks. Opening never changes public assignment or earns credit.
 * @param {object} input Validated source and trusted administrative provenance.
 * @return {ShiftCoverageCase} Initial immutable case value.
 */
export const buildShiftCoverageOpening = (input: {
  caseId: string; shiftId: string; shift: ShiftPlanningPublicShiftDocument;
  positionIndex: number; actorId: string; reason: string; now: number;
}): ShiftCoverageCase => ({
  schemaVersion: 1, policyRevision: SHIFT_COVERAGE_POLICY_REVISION,
  environment: "develop", id: input.caseId, shiftId: input.shiftId,
  type: input.shift.type,
  absentUserId: input.shift.assignedUserIds[input.positionIndex],
  positionIndex: input.positionIndex,
  ownershipDigest: shiftCoverageOwnershipDigest(input.shift),
  openedByUserId: input.actorId, reason: input.reason, status: "open",
  revision: 1, offer: null, acceptedUserId: null, creditId: null,
  createdAtMillis: input.now, updatedAtMillis: input.now,
});
