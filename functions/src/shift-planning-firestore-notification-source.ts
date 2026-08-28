import {
  DocumentSnapshot,
  QueryDocumentSnapshot,
  Timestamp,
} from "@google-cloud/firestore";
import {ShiftPlanningHeldNotificationIntent} from "./shift-planning-bundle.js";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {
  ShiftPlanningDigest,
  createShiftPlanningDigest,
} from "./shift-planning-digest.js";
import {
  ShiftPlanningMemberDeviceRevisionSource,
  deriveShiftPlanningMemberRevision,
} from "./shift-planning-member-revision.js";
import {
  parseShiftPlanningPublicShiftDocument,
} from "./shift-planning-publication-contract.js";
import {parseShiftPlanningMaintenanceState} from "./shift-planning-wire.js";

export type ShiftPlanningNotificationCurrentValidation = {
  recipientUserId: string;
  shiftId: string;
  shiftType: "delivery" | "market";
  assignmentRevision: number;
  membershipRevision: number;
  eligibilityRevision: number;
  destinationRevision: number;
  destinationDigest: ShiftPlanningDigest;
  messagingTargets: {
    firebaseInstallationIds: readonly string[];
    fcmTokens: readonly string[];
  };
  validationDigest: ShiftPlanningDigest;
};

const failSource = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_transaction", message);
};

const requireSnapshot = (
  snapshot: DocumentSnapshot,
  name: string,
): QueryDocumentSnapshot => {
  if (!snapshot.exists) return failSource(`${name} does not exist.`);
  return snapshot as QueryDocumentSnapshot;
};

const nullableString = (value: unknown, name: string): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    return failSource(`${name} must be a string or null.`);
  }
  return value.trim() || null;
};

const nullableTimestamp = (value: unknown, name: string): Timestamp | null => {
  if (value === null || value === undefined) return null;
  if (!(value instanceof Timestamp)) {
    return failSource(`${name} must be a Firestore Timestamp or null.`);
  }
  return value;
};

const deviceRevisionSource = (
  snapshot: QueryDocumentSnapshot,
): ShiftPlanningMemberDeviceRevisionSource => ({
  deviceId: snapshot.id,
  fcmToken: nullableString(
    snapshot.get("fcmToken"),
    `device ${snapshot.id}.fcmToken`,
  ),
  firebaseInstallationId: nullableString(
    snapshot.get("firebaseInstallationId"),
    `device ${snapshot.id}.firebaseInstallationId`,
  ),
  tokenUpdatedAt: nullableTimestamp(
    snapshot.get("tokenUpdatedAt"),
    `device ${snapshot.id}.tokenUpdatedAt`,
  ),
  registrationUpdatedAt: nullableTimestamp(
    snapshot.get("registrationUpdatedAt"),
    `device ${snapshot.id}.registrationUpdatedAt`,
  ),
});

/**
 * Revalidates the current active assignment, eligible member, and complete
 * device projection shared by initial release and every dispatch attempt.
 * @param {object} input Exact transaction snapshots and immutable held intent.
 * @return {ShiftPlanningNotificationCurrentValidation} Current bound targets.
 */
export const validateShiftPlanningNotificationCurrentSource = (input: {
  root: string;
  intent: ShiftPlanningHeldNotificationIntent;
  maintenanceSnapshot: DocumentSnapshot;
  shiftSnapshot: DocumentSnapshot;
  memberSnapshot: DocumentSnapshot;
  devices: readonly QueryDocumentSnapshot[];
}): ShiftPlanningNotificationCurrentValidation => {
  const {intent} = input;
  const maintenance = parseShiftPlanningMaintenanceState(
    requireSnapshot(input.maintenanceSnapshot, "planning state").data(),
  );
  if (
    maintenance.activeRevision !== intent.bundleRevision ||
    maintenance.activeDigest !== intent.bundleDigest ||
    maintenance.writeEpoch !== intent.writeEpoch
  ) {
    return failSource("Active planning state no longer owns the intent.");
  }
  const shiftPath = `${input.root}/shifts/${intent.shiftId}`;
  const shift = parseShiftPlanningPublicShiftDocument({
    targetPath: shiftPath,
    value: requireSnapshot(input.shiftSnapshot, "planned shift").data(),
  });
  parseShiftPlanningPublicShiftDocument({
    targetPath: shiftPath,
    value: input.shiftSnapshot.data(),
    expectedOperationIntentDigest:
      shift.lastBackendMutation.operationIntentDigest,
  });
  if (
    shift.type !== intent.shiftType ||
    shift.bundleRevision !== intent.bundleRevision ||
    shift.bundleDigest !== intent.bundleDigest ||
    shift.writeEpoch !== intent.writeEpoch ||
    shift.assignmentRevision !== intent.expectedAssignmentRevision ||
    !shift.assignedUserIds.includes(intent.recipientUserId)
  ) {
    return failSource("Current shift assignment no longer owns the intent.");
  }
  const memberSnapshot = requireSnapshot(
    input.memberSnapshot,
    "notification member",
  );
  const deviceSources = input.devices.map(deviceRevisionSource);
  const member = deriveShiftPlanningMemberRevision({
    userId: memberSnapshot.id,
    roles: memberSnapshot.get("roles"),
    isActive: memberSnapshot.get("isActive"),
    isCommonPurchaseManager: memberSnapshot.get("isCommonPurchaseManager"),
    devices: deviceSources,
  });
  if (
    member.userId !== intent.recipientUserId ||
    !member.isEligible ||
    member.membershipRevision !== intent.expectedMembershipRevision ||
    member.eligibilityRevision !== intent.expectedEligibilityRevision ||
    member.destinationRevision !== intent.expectedDestinationRevision
  ) {
    return failSource("Current member revisions no longer own the intent.");
  }
  const messagingTargets = {
    firebaseInstallationIds: [...new Set(deviceSources.flatMap(
      ({firebaseInstallationId}) =>
        firebaseInstallationId === null ? [] : [firebaseInstallationId],
    ))],
    fcmTokens: [...new Set(deviceSources.flatMap(
      ({fcmToken}) => fcmToken === null ? [] : [fcmToken],
    ))],
  };
  const validationCore = {
    recipientUserId: intent.recipientUserId,
    shiftId: intent.shiftId,
    shiftType: intent.shiftType,
    assignmentRevision: shift.assignmentRevision,
    membershipRevision: member.membershipRevision,
    eligibilityRevision: member.eligibilityRevision,
    destinationRevision: member.destinationRevision,
    destinationDigest: member.destinationDigest,
    messagingTargets,
  };
  return {
    ...validationCore,
    validationDigest: createShiftPlanningDigest(validationCore),
  };
};
