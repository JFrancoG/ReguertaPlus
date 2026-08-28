import {Timestamp} from "@google-cloud/firestore";
import {isEligibleForShiftRotation} from "./shift-eligibility.js";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {
  ShiftPlanningDigest,
  createShiftPlanningDigest,
} from "./shift-planning-digest.js";

export const SHIFT_PLANNING_MAX_DEVICES_PER_USER = 20 as const;

export type ShiftPlanningMemberDeviceRevisionSource = {
  deviceId: string;
  fcmToken: string | null;
  firebaseInstallationId: string | null;
  tokenUpdatedAt: Timestamp | null;
  registrationUpdatedAt: Timestamp | null;
};

export type ShiftPlanningMemberRevisionSource = {
  userId: string;
  roles: readonly string[];
  isActive: boolean;
  isCommonPurchaseManager: boolean;
  devices: readonly ShiftPlanningMemberDeviceRevisionSource[];
};

export type ShiftPlanningMemberRevision = {
  userId: string;
  roles: readonly string[];
  isActive: boolean;
  isCommonPurchaseManager: boolean;
  isEligible: boolean;
  membershipRevision: number;
  eligibilityRevision: number;
  destinationRevision: number;
  membershipDigest: ShiftPlanningDigest;
  eligibilityDigest: ShiftPlanningDigest;
  destinationDigest: ShiftPlanningDigest;
};

const failRevision = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_transaction", message);
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failRevision(`${name} is not a valid identifier.`);
  }
  return value;
};

const canonicalRoles = (value: readonly string[]): string[] => {
  if (!Array.isArray(value) || value.length === 0) {
    return failRevision("Planning member roles are missing.");
  }
  const roles = value.map((role) => {
    if (
      typeof role !== "string" ||
      !["member", "producer", "admin"].includes(role)
    ) {
      return failRevision("Planning member roles are invalid.");
    }
    return role;
  }).sort();
  if (new Set(roles).size !== roles.length || !roles.includes("member")) {
    return failRevision("Planning member roles are not canonical.");
  }
  return roles;
};

const timestampProjection = (
  value: Timestamp | null,
): {seconds: number; nanoseconds: number} | null => value === null ? null : {
  seconds: value.seconds,
  nanoseconds: value.nanoseconds,
};

const numericDigestRevision = (digest: ShiftPlanningDigest): number =>
  Number.parseInt(digest.slice(digest.lastIndexOf(":") + 1).slice(0, 13), 16);

/**
 * Derives the exact membership, eligibility, and notification-destination
 * revisions shared by planning intake and notification release. Both callers
 * supply the same canonical Firestore document-ID device order.
 * @param {ShiftPlanningMemberRevisionSource} source Current member and devices.
 * @return {ShiftPlanningMemberRevision} Stable digests and numeric revisions.
 */
export const deriveShiftPlanningMemberRevision = (
  source: ShiftPlanningMemberRevisionSource,
): ShiftPlanningMemberRevision => {
  const userId = requireIdentifier(source.userId, "planning member userId");
  const roles = canonicalRoles(source.roles);
  if (
    typeof source.isActive !== "boolean" ||
    typeof source.isCommonPurchaseManager !== "boolean"
  ) {
    return failRevision("Planning member flags are invalid.");
  }
  const devices = source.devices.map((device) => ({
    deviceId: requireIdentifier(device.deviceId, "planning deviceId"),
    fcmToken: device.fcmToken,
    firebaseInstallationId: device.firebaseInstallationId,
    tokenUpdatedAt: timestampProjection(device.tokenUpdatedAt),
    registrationUpdatedAt: timestampProjection(device.registrationUpdatedAt),
  }));
  if (new Set(devices.map(({deviceId}) => deviceId)).size !== devices.length) {
    return failRevision("Planning member devices are duplicated.");
  }
  const membershipProjection = {userId, isActive: source.isActive};
  const eligibilityProjection = {
    userId,
    roles,
    isActive: source.isActive,
    isCommonPurchaseManager: source.isCommonPurchaseManager,
  };
  const destinationProjection = {userId, devices};
  const membershipDigest = createShiftPlanningDigest(membershipProjection);
  const eligibilityDigest = createShiftPlanningDigest(eligibilityProjection);
  const destinationDigest = createShiftPlanningDigest(destinationProjection);
  return {
    ...eligibilityProjection,
    isEligible: isEligibleForShiftRotation(eligibilityProjection),
    membershipRevision: numericDigestRevision(membershipDigest),
    eligibilityRevision: numericDigestRevision(eligibilityDigest),
    destinationRevision: numericDigestRevision(destinationDigest),
    membershipDigest,
    eligibilityDigest,
    destinationDigest,
  };
};
