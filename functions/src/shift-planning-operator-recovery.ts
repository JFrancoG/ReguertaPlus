import {
  DocumentSnapshot,
  Firestore,
  Timestamp,
} from "@google-cloud/firestore";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {
  ShiftPlanningCasRejectedBeforeCommitError,
  ShiftPlanningFirestoreCasExecutionResult,
  createFirestoreShiftPlanningCasRuntime,
} from "./shift-planning-firestore-cas-runtime.js";
import {createShiftPlanningDigest} from "./shift-planning-digest.js";
import {
  createFirestoreShiftPlanningInverseRecoveryResolver,
} from "./shift-planning-firestore-source-resolver.js";
import {
  ShiftPlanningInverseRecoveryAttempt,
} from "./shift-planning-inverse-materializer.js";
import {
  parseShiftPlanningActivationOperationTerminal,
} from "./shift-planning-publication-contract.js";
import {
  ShiftPlanningEnvironment,
  ShiftPlanningMaintenanceState,
  parseShiftPlanningMaintenanceState,
} from "./shift-planning-wire.js";

export const SHIFT_PLANNING_RECOVERY_AUTHORIZATION_SCHEMA_VERSION = 1 as const;
export const SHIFT_PLANNING_OPERATOR_RECOVERY_SCHEMA_VERSION = 1 as const;

type UnknownRecord = Record<string, unknown>;

export type ShiftPlanningRecoveryMaintenanceBinding = Pick<
  ShiftPlanningMaintenanceState,
  | "stateRevision"
  | "writeEpoch"
  | "maintenanceStatus"
  | "activeRevision"
  | "activeDigest"
  | "lastTransitionId"
>;

export type ShiftPlanningRecoveryAuthorization = {
  schemaVersion:
    typeof SHIFT_PLANNING_RECOVERY_AUTHORIZATION_SCHEMA_VERSION;
  mode: "recovery";
  state: "authorized";
  environment: ShiftPlanningEnvironment;
  activationOperationId: string;
  recoveryOperationId: string;
  bundleRevision: string;
  bundleDigest: string;
  activationOperationIntentDigest: string;
  expectedMaintenance: ShiftPlanningRecoveryMaintenanceBinding;
  authorizedAt: Timestamp;
  expiresAt: Timestamp;
  authorizationDigest: string;
};

export type ShiftPlanningOperatorRecoveryCommand = {
  schemaVersion: typeof SHIFT_PLANNING_OPERATOR_RECOVERY_SCHEMA_VERSION;
  mode: "recovery";
  environment: ShiftPlanningEnvironment;
  activationOperationId: string;
  recoveryOperationId: string;
  authorizationDigest: string;
};

export type ShiftPlanningOperatorRecoveryExecutor = {
  execute(command: unknown): Promise<ShiftPlanningFirestoreCasExecutionResult<
    ShiftPlanningInverseRecoveryAttempt
  >>;
};

const authorizationKeys = [
  "schemaVersion",
  "mode",
  "state",
  "environment",
  "activationOperationId",
  "recoveryOperationId",
  "bundleRevision",
  "bundleDigest",
  "activationOperationIntentDigest",
  "expectedMaintenance",
  "authorizedAt",
  "expiresAt",
  "authorizationDigest",
] as const;

const maintenanceBindingKeys = [
  "stateRevision",
  "writeEpoch",
  "maintenanceStatus",
  "activeRevision",
  "activeDigest",
  "lastTransitionId",
] as const;

const commandKeys = [
  "schemaVersion",
  "mode",
  "environment",
  "activationOperationId",
  "recoveryOperationId",
  "authorizationDigest",
] as const;

const failAuthorization = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_transaction", message);
};

const requireRecord = (value: unknown, name: string): UnknownRecord => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return failAuthorization(`${name} must be a plain object.`);
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
    failAuthorization(`${name} fields are not exact.`);
  }
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failAuthorization(`${name} is not a valid identifier.`);
  }
  return value;
};

const requireDigest = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return failAuthorization(`${name} is not a planning digest.`);
  }
  return value;
};

const requireEnvironment = (value: unknown): ShiftPlanningEnvironment => {
  if (value !== "develop" && value !== "production") {
    return failAuthorization("Recovery environment is invalid.");
  }
  return value;
};

const requireTimestamp = (value: unknown, name: string): Timestamp => {
  if (!(value instanceof Timestamp)) {
    return failAuthorization(`${name} must be a Firestore Timestamp.`);
  }
  return value;
};

const requireNonNegativeInteger = (value: unknown, name: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return failAuthorization(`${name} must be a non-negative integer.`);
  }
  return value as number;
};

const requireNullableDigest = (value: unknown, name: string): string | null =>
  value === null ? null : requireDigest(value, name);

const requireNullableIdentifier = (
  value: unknown,
  name: string,
): string | null => value === null ? null : requireIdentifier(value, name);

const parseMaintenanceBinding = (
  value: unknown,
): ShiftPlanningRecoveryMaintenanceBinding => {
  const binding = requireRecord(value, "recovery maintenance binding");
  requireExactKeys(
    binding,
    maintenanceBindingKeys,
    "recovery maintenance binding",
  );
  if (binding.maintenanceStatus !== "closed") {
    return failAuthorization("Recovery requires closed maintenance.");
  }
  const activeRevision = requireNullableIdentifier(
    binding.activeRevision,
    "recovery activeRevision",
  );
  const activeDigest = requireNullableDigest(
    binding.activeDigest,
    "recovery activeDigest",
  );
  if ((activeRevision === null) !== (activeDigest === null)) {
    return failAuthorization("Recovery active lineage is incomplete.");
  }
  return {
    stateRevision: requireNonNegativeInteger(
      binding.stateRevision,
      "recovery stateRevision",
    ),
    writeEpoch: requireNonNegativeInteger(
      binding.writeEpoch,
      "recovery writeEpoch",
    ),
    maintenanceStatus: "closed",
    activeRevision,
    activeDigest,
    lastTransitionId: requireIdentifier(
      binding.lastTransitionId,
      "recovery lastTransitionId",
    ),
  };
};

const authorizationDigestInput = (
  value: Omit<ShiftPlanningRecoveryAuthorization, "authorizationDigest">,
): object => {
  const {authorizedAt, expiresAt, ...binding} = value;
  return {
    ...binding,
    authorizedAtMillis: authorizedAt.toMillis(),
    expiresAtMillis: expiresAt.toMillis(),
  };
};

const authorizationDigest = (
  value: Omit<ShiftPlanningRecoveryAuthorization, "authorizationDigest">,
): string => {
  return createShiftPlanningDigest(authorizationDigestInput(value));
};

/**
 * Creates one exact backend-owned recovery authorization document.
 * @param {object} input Digest-bound operation, maintenance, and time window.
 * @return {ShiftPlanningRecoveryAuthorization} Canonical authorization.
 */
export const createShiftPlanningRecoveryAuthorization = (
  input: Omit<ShiftPlanningRecoveryAuthorization, "authorizationDigest">,
): ShiftPlanningRecoveryAuthorization =>
  parseShiftPlanningRecoveryAuthorization({
    ...input,
    authorizationDigest: authorizationDigest(input),
  });

/**
 * Parses an exact persisted recovery authorization without accepting extras.
 * @param {unknown} value Persisted backend-only authorization.
 * @return {ShiftPlanningRecoveryAuthorization} Canonical authorization.
 */
export const parseShiftPlanningRecoveryAuthorization = (
  value: unknown,
): ShiftPlanningRecoveryAuthorization => {
  const document = requireRecord(value, "recovery authorization");
  requireExactKeys(document, authorizationKeys, "recovery authorization");
  if (
    document.schemaVersion !==
      SHIFT_PLANNING_RECOVERY_AUTHORIZATION_SCHEMA_VERSION ||
    document.mode !== "recovery" ||
    document.state !== "authorized"
  ) {
    return failAuthorization(
      "Recovery authorization discriminator is invalid.",
    );
  }
  const authorizationWithoutDigest = {
    schemaVersion: SHIFT_PLANNING_RECOVERY_AUTHORIZATION_SCHEMA_VERSION,
    mode: "recovery" as const,
    state: "authorized" as const,
    environment: requireEnvironment(document.environment),
    activationOperationId: requireIdentifier(
      document.activationOperationId,
      "activationOperationId",
    ),
    recoveryOperationId: requireIdentifier(
      document.recoveryOperationId,
      "recoveryOperationId",
    ),
    bundleRevision: requireIdentifier(
      document.bundleRevision,
      "recovery bundleRevision",
    ),
    bundleDigest: requireDigest(
      document.bundleDigest,
      "recovery bundleDigest",
    ),
    activationOperationIntentDigest: requireDigest(
      document.activationOperationIntentDigest,
      "activation operation intent digest",
    ),
    expectedMaintenance: parseMaintenanceBinding(
      document.expectedMaintenance,
    ),
    authorizedAt: requireTimestamp(document.authorizedAt, "authorizedAt"),
    expiresAt: requireTimestamp(document.expiresAt, "expiresAt"),
  };
  if (
    authorizationWithoutDigest.authorizedAt.toMillis() >=
      authorizationWithoutDigest.expiresAt.toMillis()
  ) {
    return failAuthorization("Recovery authorization window is invalid.");
  }
  const storedDigest = requireDigest(
    document.authorizationDigest,
    "authorizationDigest",
  );
  if (storedDigest !== authorizationDigest(authorizationWithoutDigest)) {
    return failAuthorization("Recovery authorization digest has drifted.");
  }
  return {...authorizationWithoutDigest, authorizationDigest: storedDigest};
};

/**
 * Parses the minimal operator command accepted by the future IAM-only endpoint.
 * @param {unknown} value Untrusted request body.
 * @return {ShiftPlanningOperatorRecoveryCommand} Canonical command.
 */
export const parseShiftPlanningOperatorRecoveryCommand = (
  value: unknown,
): ShiftPlanningOperatorRecoveryCommand => {
  const command = requireRecord(value, "operator recovery command");
  requireExactKeys(command, commandKeys, "operator recovery command");
  if (
    command.schemaVersion !== SHIFT_PLANNING_OPERATOR_RECOVERY_SCHEMA_VERSION ||
    command.mode !== "recovery"
  ) {
    return failAuthorization("Operator recovery command is invalid.");
  }
  return {
    schemaVersion: SHIFT_PLANNING_OPERATOR_RECOVERY_SCHEMA_VERSION,
    mode: "recovery",
    environment: requireEnvironment(command.environment),
    activationOperationId: requireIdentifier(
      command.activationOperationId,
      "activationOperationId",
    ),
    recoveryOperationId: requireIdentifier(
      command.recoveryOperationId,
      "recoveryOperationId",
    ),
    authorizationDigest: requireDigest(
      command.authorizationDigest,
      "authorizationDigest",
    ),
  };
};

export const shiftPlanningRecoveryAuthorizationPath = (
  command: ShiftPlanningOperatorRecoveryCommand,
): string => `${command.environment}/plus-collections/` +
  `shiftPlanningOperations/${command.activationOperationId}/` +
  `recoveryAuthorizations/${command.recoveryOperationId}`;

const requireAuthorizationSnapshot = (
  snapshot: DocumentSnapshot,
  command: ShiftPlanningOperatorRecoveryCommand,
): ShiftPlanningRecoveryAuthorization => {
  if (!snapshot.exists || snapshot.ref.path !==
    shiftPlanningRecoveryAuthorizationPath(command)) {
    return failAuthorization("Recovery authorization does not exist.");
  }
  const authorization = parseShiftPlanningRecoveryAuthorization(
    snapshot.data(),
  );
  if (
    authorization.environment !== command.environment ||
    authorization.activationOperationId !== command.activationOperationId ||
    authorization.recoveryOperationId !== command.recoveryOperationId ||
    authorization.authorizationDigest !== command.authorizationDigest
  ) {
    return failAuthorization("Recovery command is not exactly allowlisted.");
  }
  return authorization;
};

const requireAuthorizationWindow = (
  authorization: ShiftPlanningRecoveryAuthorization,
  attemptedAt: Timestamp,
): void => {
  const attemptedAtMillis = attemptedAt.toMillis();
  if (
    attemptedAtMillis < authorization.authorizedAt.toMillis() ||
    attemptedAtMillis >= authorization.expiresAt.toMillis()
  ) {
    failAuthorization("Recovery authorization is outside its valid window.");
  }
};

const requireMaintenanceBinding = (
  expected: ShiftPlanningRecoveryMaintenanceBinding,
  current: ShiftPlanningMaintenanceState,
): void => {
  if (
    expected.stateRevision !== current.stateRevision ||
    expected.writeEpoch !== current.writeEpoch ||
    expected.maintenanceStatus !== current.maintenanceStatus ||
    expected.activeRevision !== current.activeRevision ||
    expected.activeDigest !== current.activeDigest ||
    expected.lastTransitionId !== current.lastTransitionId
  ) {
    failAuthorization("Recovery maintenance allowlist has drifted.");
  }
};

/**
 * Composes the local recovery executor around an exact backend allowlist read.
 * The HTTP/IAM export remains separate so deployment cannot invent an operator.
 * @param {Firestore} firestore Pinned Firestore authority.
 * @param {object} dependencies Testable clock.
 * @return {ShiftPlanningOperatorRecoveryExecutor} Allowlisted recovery port.
 */
export const createFirestoreShiftPlanningOperatorRecoveryExecutor = (
  firestore: Firestore,
  dependencies: {clock?: () => Timestamp} = {},
): ShiftPlanningOperatorRecoveryExecutor => {
  const clock = dependencies.clock ?? (() => Timestamp.now());
  const casRuntime = createFirestoreShiftPlanningCasRuntime(firestore, {clock});
  return {
    async execute(rawCommand) {
      const command = parseShiftPlanningOperatorRecoveryCommand(rawCommand);
      const authorizationReference = firestore.doc(
        shiftPlanningRecoveryAuthorizationPath(command),
      );
      const preflightAuthorization = requireAuthorizationSnapshot(
        await authorizationReference.get(),
        command,
      );
      requireAuthorizationWindow(preflightAuthorization, clock());
      const baseResolver = createFirestoreShiftPlanningInverseRecoveryResolver({
        environment: command.environment,
        activationOperationId: command.activationOperationId,
      });
      try {
        return await casRuntime.executeInverseRecovery({
          environment: command.environment,
          activationOperationId: command.activationOperationId,
          recoveryOperationId: command.recoveryOperationId,
          resolveAttempt: async (context) => {
            const [authorizationSnapshot, resolution] = await Promise.all([
              context.transaction.get(authorizationReference),
              baseResolver(context),
            ]);
            const authorization = requireAuthorizationSnapshot(
              authorizationSnapshot,
              command,
            );
            requireAuthorizationWindow(authorization, context.attemptedAt);
            const activation = parseShiftPlanningActivationOperationTerminal(
              resolution.activationOperationDocument.data,
            );
            if (
              authorization.bundleRevision !== activation.bundleRevision ||
              authorization.bundleDigest !== activation.bundleDigest ||
              authorization.activationOperationIntentDigest !==
                activation.operationIntentDigest
            ) {
              return failAuthorization(
                "Recovery activation allowlist has drifted.",
              );
            }
            const maintenancePath = `${command.environment}/plus-collections/` +
              "shiftPlanningState/current";
            const maintenanceDocuments = resolution.currentDocuments.filter(
              ({targetPath}) => targetPath === maintenancePath,
            );
            if (maintenanceDocuments.length !== 1) {
              return failAuthorization(
                "Recovery maintenance read-set is incomplete.",
              );
            }
            const maintenance = parseShiftPlanningMaintenanceState(
              maintenanceDocuments[0].data,
            );
            requireMaintenanceBinding(
              authorization.expectedMaintenance,
              maintenance,
            );
            return resolution;
          },
        });
      } catch (error) {
        if (error instanceof ShiftPlanningCasRejectedBeforeCommitError) {
          throw error.planningError;
        }
        throw error;
      }
    },
  };
};
