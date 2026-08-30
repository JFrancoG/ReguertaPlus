import {Timestamp} from "@google-cloud/firestore";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {
  ShiftPlanningDigest,
  createShiftPlanningDigest,
} from "./shift-planning-digest.js";
import {
  ShiftPlanningNotificationTerminalIncident,
  ShiftPlanningNotificationTerminalIncidentIntent,
} from "./shift-planning-notification-terminal-incident.js";

export const SHIFT_PLANNING_NOTIFICATION_TERMINAL_MARKER_SCHEMA_VERSION =
  1 as const;

export type ShiftPlanningNotificationTerminalMarker = {
  schemaVersion:
    typeof SHIFT_PLANNING_NOTIFICATION_TERMINAL_MARKER_SCHEMA_VERSION;
  operationKind: "notificationTerminalMarker";
  state: "terminal";
  intentId: string;
  shiftId: string;
  incidentId: string;
  bundleRevision: string;
  bundleDigest: ShiftPlanningDigest;
  resolution: ShiftPlanningNotificationTerminalIncidentIntent["resolution"];
  attemptIds: readonly string[];
  dispatchEvidenceDigest: ShiftPlanningDigest;
  terminalizedAt: Timestamp;
  terminalIncidentDigest: ShiftPlanningDigest;
};

type UnknownRecord = Record<string, unknown>;

const fields = [
  "schemaVersion",
  "operationKind",
  "state",
  "intentId",
  "shiftId",
  "incidentId",
  "bundleRevision",
  "bundleDigest",
  "resolution",
  "attemptIds",
  "dispatchEvidenceDigest",
  "terminalizedAt",
  "terminalIncidentDigest",
] as const;

const failMarker = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_transaction", message);
};

const requireRecord = (value: unknown): UnknownRecord => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return failMarker("Terminal notification marker must be a plain object.");
  }
  return value as UnknownRecord;
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failMarker(`${name} is not a valid identifier.`);
  }
  return value;
};

const requireDigest = (value: unknown, name: string): ShiftPlanningDigest => {
  if (
    typeof value !== "string" ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return failMarker(`${name} is not a planning digest.`);
  }
  return value as ShiftPlanningDigest;
};

const requireStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return failMarker("Terminal marker attemptIds must be an array.");
  }
  const attemptIds = value.map((item) =>
    requireIdentifier(item, "terminal marker attemptId"));
  if (new Set(attemptIds).size !== attemptIds.length) {
    return failMarker("Terminal marker attemptIds must be unique.");
  }
  return attemptIds;
};

export const parseShiftPlanningNotificationTerminalMarker = (
  value: unknown,
): ShiftPlanningNotificationTerminalMarker => {
  const marker = requireRecord(value);
  const actualFields = Object.keys(marker);
  if (
    actualFields.length !== fields.length ||
    actualFields.some((field) =>
      !(fields as readonly string[]).includes(field)) ||
    marker.schemaVersion !==
      SHIFT_PLANNING_NOTIFICATION_TERMINAL_MARKER_SCHEMA_VERSION ||
    marker.operationKind !== "notificationTerminalMarker" ||
    marker.state !== "terminal" ||
    (
      marker.resolution !== "cancelledUnsubmitted" &&
      marker.resolution !== "possibleDeliveryCorrectionRequired" &&
      marker.resolution !== "definitivelyFailed"
    ) ||
    !(marker.terminalizedAt instanceof Timestamp)
  ) {
    return failMarker("Terminal notification marker is invalid.");
  }
  const terminalizedAt = marker.terminalizedAt;
  if (terminalizedAt.toMillis() < 0) {
    return failMarker("Terminal marker instant must be non-negative.");
  }
  return {
    schemaVersion: SHIFT_PLANNING_NOTIFICATION_TERMINAL_MARKER_SCHEMA_VERSION,
    operationKind: "notificationTerminalMarker",
    state: "terminal",
    intentId: requireIdentifier(marker.intentId, "terminal marker intentId"),
    shiftId: requireIdentifier(marker.shiftId, "terminal marker shiftId"),
    incidentId: requireIdentifier(
      marker.incidentId,
      "terminal marker incidentId",
    ),
    bundleRevision: requireIdentifier(
      marker.bundleRevision,
      "terminal marker bundleRevision",
    ),
    bundleDigest: requireDigest(
      marker.bundleDigest,
      "terminal marker bundleDigest",
    ),
    resolution: marker.resolution,
    attemptIds: requireStringArray(marker.attemptIds),
    dispatchEvidenceDigest: requireDigest(
      marker.dispatchEvidenceDigest,
      "terminal marker dispatch evidence digest",
    ),
    terminalizedAt,
    terminalIncidentDigest: requireDigest(
      marker.terminalIncidentDigest,
      "terminal incident digest",
    ),
  };
};

export const shiftPlanningNotificationTerminalMarkerPath = (
  intentId: string,
): string => `shiftPlanningNotificationIntents/${
  requireIdentifier(intentId, "terminal marker intentId")
}/terminalState/current`;

export const createShiftPlanningNotificationTerminalMarker = (input: {
  terminalIncident: ShiftPlanningNotificationTerminalIncident;
  intent: ShiftPlanningNotificationTerminalIncidentIntent;
}): ShiftPlanningNotificationTerminalMarker => {
  const canonical = input.terminalIncident.intents.find((intent) =>
    intent.intentId === input.intent.intentId);
  if (
    canonical === undefined ||
    createShiftPlanningDigest(canonical) !==
      createShiftPlanningDigest(input.intent)
  ) {
    return failMarker("Terminal marker intent is outside the incident.");
  }
  return parseShiftPlanningNotificationTerminalMarker({
    schemaVersion: SHIFT_PLANNING_NOTIFICATION_TERMINAL_MARKER_SCHEMA_VERSION,
    operationKind: "notificationTerminalMarker",
    state: "terminal",
    intentId: input.intent.intentId,
    shiftId: input.intent.shiftId,
    incidentId: input.terminalIncident.incidentId,
    bundleRevision: input.terminalIncident.bundleRevision,
    bundleDigest: input.terminalIncident.bundleDigest,
    resolution: input.intent.resolution,
    attemptIds: input.intent.attemptIds,
    dispatchEvidenceDigest: input.intent.dispatchEvidenceDigest,
    terminalizedAt: Timestamp.fromMillis(
      input.terminalIncident.terminalizedAtMillis,
    ),
    terminalIncidentDigest: input.terminalIncident.terminalIncidentDigest,
  });
};

export const sameShiftPlanningNotificationTerminalMarker = (
  left: ShiftPlanningNotificationTerminalMarker,
  right: ShiftPlanningNotificationTerminalMarker,
): boolean => fields.every((field) => {
  const leftValue = left[field];
  const rightValue = right[field];
  if (leftValue instanceof Timestamp && rightValue instanceof Timestamp) {
    return leftValue.isEqual(rightValue);
  }
  if (Array.isArray(leftValue) && Array.isArray(rightValue)) {
    return leftValue.length === rightValue.length &&
      leftValue.every((value, index) => value === rightValue[index]);
  }
  return leftValue === rightValue;
});
