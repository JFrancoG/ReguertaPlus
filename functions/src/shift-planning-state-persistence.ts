import {
  ShiftPlanningError,
} from "./shift-planning-contract.js";
import {
  createShiftPlanningDigest,
} from "./shift-planning-digest.js";
import {
  ShiftPlanningEnvironment,
  ShiftPlanningIntakeBarrier,
  ShiftPlanningLineage,
  ShiftPlanningMaintenanceState,
  ShiftRotationAggregateWire,
  parseShiftPlanningMaintenanceState,
  parseShiftRotationAggregateWire,
} from "./shift-planning-wire.js";

export const SHIFT_PLANNING_STATE_PERSISTENCE_SCHEMA_VERSION = 2 as const;

export type ShiftPlanningAuthoritativeRotations = {
  delivery: ShiftRotationAggregateWire;
  market: ShiftRotationAggregateWire;
};

/**
 * One coherent read of the maintenance document and both rotation aggregates.
 * The digest binds all three documents and is the optimistic concurrency token.
 */
export type ShiftPlanningAuthoritativeState = {
  environment: ShiftPlanningEnvironment;
  maintenance: ShiftPlanningMaintenanceState;
  rotations: ShiftPlanningAuthoritativeRotations;
  authoritativeDigest: string;
};

type UnknownRecord = Record<string, unknown>;

const authoritativeStateKeys = [
  "environment",
  "maintenance",
  "rotations",
  "authoritativeDigest",
] as const;

const failState = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_state", message);
};

const requireRecord = (value: unknown, name: string): UnknownRecord => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return failState(`${name} must be a plain object.`);
  }
  return value as UnknownRecord;
};

const requireExactKeys = (
  value: UnknownRecord,
  keys: readonly string[],
  name: string,
): void => {
  const actual = Object.keys(value);
  if (
    actual.length !== keys.length ||
    actual.some((key) => !keys.includes(key))
  ) {
    failState(`${name} fields are not exact.`);
  }
};

const requireEnvironment = (value: unknown): ShiftPlanningEnvironment => {
  if (value !== "develop" && value !== "production") {
    return failState("Planning environment is invalid.");
  }
  return value;
};

const requireDigest = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return failState("Authoritative planning digest is invalid.");
  }
  return value;
};

const sameLineage = (
  left: ShiftPlanningLineage | null,
  right: ShiftPlanningLineage | null,
): boolean => left === null || right === null ? left === right :
  left.revision === right.revision && left.digest === right.digest;

const sameActiveLineage = (
  maintenance: ShiftPlanningMaintenanceState,
  rotation: ShiftRotationAggregateWire,
): boolean =>
  maintenance.activeRevision === rotation.activeRevision &&
  maintenance.activeDigest === rotation.activeDigest;

const parseAuthoritativeRotations = (
  value: unknown,
): ShiftPlanningAuthoritativeRotations => {
  const rotations = requireRecord(value, "authoritative rotations");
  requireExactKeys(
    rotations,
    ["delivery", "market"],
    "authoritative rotations",
  );
  return {
    delivery: parseShiftRotationAggregateWire(
      rotations.delivery,
      "delivery",
    ),
    market: parseShiftRotationAggregateWire(rotations.market, "market"),
  };
};

/**
 * Normalizes one SDK-free authoritative maintenance and rotation read-set.
 * @param {object} input Untrusted environment, maintenance, and rotations.
 * @return {ShiftPlanningAuthoritativeState} Canonical state and derived digest.
 */
export const buildShiftPlanningAuthoritativeState = (input: {
  environment: unknown;
  maintenance: unknown;
  rotations: unknown;
}): ShiftPlanningAuthoritativeState => {
  const environment = requireEnvironment(input.environment);
  const maintenance = parseShiftPlanningMaintenanceState(input.maintenance);
  const rotations = parseAuthoritativeRotations(input.rotations);
  if (
    !sameActiveLineage(maintenance, rotations.delivery) ||
    !sameActiveLineage(maintenance, rotations.market)
  ) {
    return failState(
      "Maintenance and rotation active lineages do not match.",
    );
  }
  if (
    !sameLineage(
      rotations.delivery.migrationBaseline,
      rotations.market.migrationBaseline,
    )
  ) {
    return failState("Rotation migration baselines do not match.");
  }
  const authoritativeDigest = createShiftPlanningDigest({
    environment,
    maintenance,
    rotations,
  });
  return {environment, maintenance, rotations, authoritativeDigest};
};

/**
 * Parses a persisted authoritative state and verifies its claimed digest.
 * @param {unknown} value Untrusted canonical state envelope.
 * @return {ShiftPlanningAuthoritativeState} Revalidated authoritative state.
 */
export const parseShiftPlanningAuthoritativeState = (
  value: unknown,
): ShiftPlanningAuthoritativeState => {
  const state = requireRecord(value, "authoritative planning state");
  requireExactKeys(
    state,
    authoritativeStateKeys,
    "authoritative planning state",
  );
  const expectedDigest = requireDigest(state.authoritativeDigest);
  const parsed = buildShiftPlanningAuthoritativeState({
    environment: state.environment,
    maintenance: state.maintenance,
    rotations: state.rotations,
  });
  if (parsed.authoritativeDigest !== expectedDigest) {
    return failState("Authoritative planning digest does not match its state.");
  }
  return parsed;
};

/** Exact state observed by an operator before requesting a maintenance CAS. */
export type ShiftPlanningMaintenanceCas = {
  environment: ShiftPlanningEnvironment;
  transitionId: string;
  expectedAuthoritativeDigest: string;
  expectedStateRevision: number;
  expectedWriteEpoch: number;
  expectedActiveRevision: string | null;
  expectedActiveDigest: string | null;
};

export type ShiftPlanningEnterMaintenanceCommand =
  ShiftPlanningMaintenanceCas & {
    action: "enterMaintenance";
    intakeBarrier: ShiftPlanningIntakeBarrier;
    /** Latest trusted transaction-attempt instant that may admit this proof. */
    intakeBarrierExpiresAtMillis: number;
  };

export type ShiftPlanningAbortPreActivationCommand =
  ShiftPlanningMaintenanceCas & {
    action: "abortPreActivationMaintenance";
    expectedMaintenanceEntryTransitionId: string;
  };

export type ShiftPlanningMaintenanceTransitionIntent =
  | ShiftPlanningEnterMaintenanceCommand
  | ShiftPlanningAbortPreActivationCommand;

/**
 * Immutable terminal evidence for one maintenance transition. It stores the
 * exact intent and original outcome so a later retry cannot reapply the CAS.
 */
export type ShiftPlanningMaintenanceTransitionRecord = {
  schemaVersion: typeof SHIFT_PLANNING_STATE_PERSISTENCE_SCHEMA_VERSION;
  operationKind: "maintenanceTransition";
  transitionId: string;
  environment: ShiftPlanningEnvironment;
  action: ShiftPlanningMaintenanceTransitionIntent["action"];
  intent: ShiftPlanningMaintenanceTransitionIntent;
  intentDigest: string;
  rotations: ShiftPlanningAuthoritativeRotations;
  maintenanceBefore: ShiftPlanningMaintenanceState;
  maintenanceAfter: ShiftPlanningMaintenanceState;
  authoritativeDigestBefore: string;
  authoritativeDigestAfter: string;
  /** Trusted transaction-callback clock; this is not the server commit time. */
  attemptedAtMillis: number;
};

export type ShiftPlanningMaintenanceTransitionResult = {
  kind: "committed" | "replayed";
  transition: ShiftPlanningMaintenanceTransitionRecord;
};

/**
 * SDK-free persistence boundary for authoritative planning-state transitions.
 */
export interface ShiftPlanningStatePersistence {
  loadAuthoritativeState(input: {
    environment: ShiftPlanningEnvironment;
  }): Promise<ShiftPlanningAuthoritativeState>;

  /** Loads immutable terminal evidence without attempting a new transition. */
  loadMaintenanceTransition(input: {
    environment: ShiftPlanningEnvironment;
    transitionId: string;
  }): Promise<ShiftPlanningMaintenanceTransitionRecord | null>;

  /**
   * Requires evidence already verified by a trusted external-barrier adapter.
   */
  enterMaintenanceWithBarrierEvidence(
    command: ShiftPlanningEnterMaintenanceCommand,
  ): Promise<ShiftPlanningMaintenanceTransitionResult>;

  abortPreActivationMaintenance(
    command: ShiftPlanningAbortPreActivationCommand,
  ): Promise<ShiftPlanningMaintenanceTransitionResult>;
}
