import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";
import {genericShiftPlanningPush} from
  "./shift-planning-notification-dispatch.js";
import {ShiftPlanningPublicShiftDocument} from
  "./shift-planning-publication-contract.js";
import {ShiftSheetsProjectionRow} from "./shift-sheets.js";
import {ShiftCoverageCase} from "./shift-coverage.js";

export const coverageSheetRow = (
  id: string, value: ShiftPlanningPublicShiftDocument,
): ShiftSheetsProjectionRow => ({
  id, type: value.type, date: value.date.toDate().toISOString().slice(0, 10),
  rotationOwnerUserIds: value.rotationOwnerUserIds ??
    [value.rotationOwnerUserId as string],
  assignedUserIds: value.assignedUserIds, helperUserId: value.helperUserId,
  status: value.status, source: value.source, origin: value.origin,
});

/**
 * Atomic command outbox: changed public projections reach Sheets. Generic
 * recipients contain no absence reason, candidate list or credit data.
 * Historical planning markers remain unchanged on the ordinary event path.
 * @param {object} input Validated transaction outcome and before images.
 * @return {object} Immutable effect plan and deterministic notification IDs.
 */
export const buildShiftCoverageEffects = (input: {
  operationId: string;
  action: string;
  previous: ShiftCoverageCase | undefined;
  next: ShiftCoverageCase;
  before: ReadonlyMap<string, ShiftPlanningPublicShiftDocument>;
  writes: ReadonlyMap<string, ShiftPlanningPublicShiftDocument>;
}) => {
  const {next, previous, operationId, action} = input;
  const changes = [...input.writes].flatMap(([path, value]) => {
    const id = path.split("/").at(-1) as string;
    const before = coverageSheetRow(id, input.before.get(path) as
      ShiftPlanningPublicShiftDocument);
    const after = coverageSheetRow(id, value);
    return digest(before) === digest(after) ? [] : [{before, after}];
  }).sort((a, b) => a.after.id.localeCompare(b.after.id));
  const recipients = new Set<string>();
  if (next.status === "offered" && next.offer?.id !== previous?.offer?.id) {
    recipients.add(next.offer?.userId as string);
  }
  if (action === "accept") {
    recipients.add(next.absentUserId);
    recipients.add(next.acceptedUserId as string);
    for (const change of changes) {
      for (const id of [...change.before.assignedUserIds,
        ...change.after.assignedUserIds, change.before.helperUserId,
        change.after.helperUserId]) if (id) recipients.add(id);
    }
  }
  if (["complete", "fail"].includes(action) && next.acceptedUserId) {
    recipients.add(next.acceptedUserId);
    recipients.add(next.openedByUserId);
  }
  if (action === "cancel" && previous?.offer) {
    recipients.add(previous.offer.userId);
  }
  const notifications = [...recipients].sort().map((userId) => {
    const eventId = "coverage-" +
      digest([operationId, userId]).split(":").at(-1);
    return {userId, caseId: next.id, caseRevision: next.revision,
      push: genericShiftPlanningPush(eventId)};
  });
  const value = {schemaVersion: 1, environment: "develop", operationId,
    caseId: next.id, caseRevision: next.revision, caseDigest: digest(next),
    action, changes, notifications};
  return {...value, effectsDigest: digest(value)};
};

export type ShiftCoverageEffects = ReturnType<typeof buildShiftCoverageEffects>;
