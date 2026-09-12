import type {CoverageSelection} from "./shift-coverage-selection.js";
import {HttpRequestError} from "./backend-security.js";
import {isEligibleForShiftRotation} from "./shift-eligibility.js";

export const SHIFT_COVERAGE_POLICY_REVISION = "hu084-provisional-v1" as const;

type CommandBase = {
  schemaVersion: 1;
  environment: "develop";
  caseId: string;
  operationId: string;
  expectedRevision: number;
  expectedShiftRevision: number;
};

export type ShiftCoverageCommand = CommandBase & (
  | {action: "open"; shiftId: string; absentUserId: string; reason: string}
  | {action: "offer"; userId: string; reason: string; expiresAtMillis: number}
  | {action: "accept" | "decline" | "expire" | "complete" |
      "startSelection" | "volunteer" | "withdrawVolunteer"}
  | {action: "offerNext"; expiresAtMillis: number}
  | {action: "cancel" | "fail"; reason: string}
);

export type ShiftCoverageCase = {
  schemaVersion: 1;
  policyRevision: typeof SHIFT_COVERAGE_POLICY_REVISION;
  environment: "develop";
  id: string;
  shiftId: string;
  type: "delivery" | "market";
  absentUserId: string;
  positionIndex: number;
  ownershipDigest: string;
  openedByUserId: string;
  reason: string;
  status: "open" | "offered" | "accepted" |
    "completed" | "cancelled" | "failed";
  revision: number;
  selection?: CoverageSelection;
  offer: {
    source: "admin" | "reserve" | "volunteer";
    id: string;
    userId: string;
    expiresAtMillis: number;
    assignmentContextDigest: string;
  } | null;
  acceptedUserId: string | null;
  creditId: string | null;
  createdAtMillis: number;
  updatedAtMillis: number;
};

export type ShiftCoverageCredit = {
  schemaVersion: 1;
  policyRevision: typeof SHIFT_COVERAGE_POLICY_REVISION;
  id: string;
  caseId: string;
  shiftId: string;
  type: "delivery" | "market";
  userId: string;
  state: "pending";
  earnedAtMillis: number;
  completionRevision: number;
};

export const rejectCoverage = (code: string): never => {
  throw new HttpRequestError(409, code, "Coverage transition rejected");
};

export const coverageId = (value: unknown): string => {
  if (typeof value !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) {
    return rejectCoverage("invalid_coverage_identity");
  }
  return value;
};

const revision = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0 ||
      value === Number.MAX_SAFE_INTEGER) {
    return rejectCoverage("invalid_coverage_revision");
  }
  return value as number;
};

const reason = (value: unknown): string => {
  if (typeof value !== "string" || !value.trim() || value.length > 500) {
    return rejectCoverage("invalid_coverage_reason");
  }
  return value.trim();
};

/**
 * Provisional develop command; actor identity is never accepted from this body.
 * Unknown fields reject so callers cannot smuggle completion or credit values.
 * @param {unknown} value Untrusted command body.
 * @return {ShiftCoverageCommand} Detached, exact command.
 */
export const parseShiftCoverageCommand = (
  value: unknown,
): ShiftCoverageCommand => {
  if (!value || typeof value !== "object" ||
      Object.getPrototypeOf(value) !== Object.prototype) {
    return rejectCoverage("invalid_coverage_command");
  }
  const body = value as Record<string, unknown>;
  const base = {
    schemaVersion: 1 as const,
    environment: "develop" as const,
    caseId: coverageId(body.caseId),
    operationId: coverageId(body.operationId),
    expectedRevision: revision(body.expectedRevision),
    expectedShiftRevision: revision(body.expectedShiftRevision),
  };
  let command: ShiftCoverageCommand;
  switch (body.action) {
  case "open":
    command = {...base, action: "open", shiftId: coverageId(body.shiftId),
      absentUserId: coverageId(body.absentUserId), reason: reason(body.reason)};
    break;
  case "offer":
    command = {...base, action: "offer", userId: coverageId(body.userId),
      reason: reason(body.reason),
      expiresAtMillis: revision(body.expiresAtMillis)};
    break;
  case "offerNext":
    command = {...base, action: "offerNext",
      expiresAtMillis: revision(body.expiresAtMillis)};
    break;
  case "startSelection": case "volunteer": case "withdrawVolunteer":
  case "accept": case "decline": case "expire": case "complete":
    command = {...base, action: body.action};
    break;
  case "cancel": case "fail":
    command = {...base, action: body.action, reason: reason(body.reason)};
    break;
  default:
    return rejectCoverage("invalid_coverage_action");
  }
  if (body.schemaVersion !== 1 || body.environment !== "develop" ||
      Object.keys(body).length !== Object.keys(command).length ||
      Object.keys(body).some((key) => !(key in command)) ||
      (command.action === "open" && command.expectedRevision !== 0)) {
    return rejectCoverage("invalid_coverage_command");
  }
  return command;
};

/**
 * Reads the same eligibility predicate as normal rotation. Malformed membership
 * fails closed; an administrator role never makes a real producer eligible.
 * @param {unknown} value Current transactionally read user document.
 * @return {object} Actor role and coverage eligibility.
 */
export const coverageMember = (value: unknown) => {
  const member = value as Record<string, unknown> | undefined;
  if (!member || typeof member.isActive !== "boolean" ||
      typeof member.isCommonPurchaseManager !== "boolean" ||
      !Array.isArray(member.roles) ||
      !member.roles.every((role) => typeof role === "string")) {
    return rejectCoverage("invalid_coverage_member");
  }
  const roles = member.roles.map((role: string) => role.trim().toLowerCase());
  return {
    active: member.isActive,
    admin: member.isActive && roles.includes("admin"),
    eligible: isEligibleForShiftRotation({
      isActive: member.isActive, roles,
      isCommonPurchaseManager: member.isCommonPurchaseManager,
    }),
  };
};
