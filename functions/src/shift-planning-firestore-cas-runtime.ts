import {
  Firestore,
  Timestamp,
  Transaction,
} from "@google-cloud/firestore";
import {
  ShiftPlanningCommittedAttemptOutcome,
  createShiftPlanningCommittedAttemptOutcome,
  parseShiftPlanningCommittedAttemptOutcome,
} from "./shift-planning-attempt-outcome.js";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {ShiftPlanningDigest} from "./shift-planning-digest.js";
import {
  ShiftPlanningAttemptOutcomePersistence,
  ShiftPlanningAttemptOutcomePersistenceResult,
  createFirestoreShiftPlanningAttemptOutcomePersistence,
  requireShiftPlanningAttemptOutcomeOperationBinding,
} from "./shift-planning-firestore-attempt-outcome-repository.js";
import {
  MaterializeShiftPlanningForwardActivationInput,
  ShiftPlanningForwardActivationAttempt,
  measureAndSealShiftPlanningForwardActivationAttempt,
} from "./shift-planning-forward-materializer.js";
import {
  MaterializeShiftPlanningInverseRecoveryInput,
  ShiftPlanningInverseRecoveryAttempt,
  measureAndSealShiftPlanningInverseRecoveryAttempt,
  parseShiftPlanningRecoveryOperationTerminal,
} from "./shift-planning-inverse-materializer.js";
import {
  parseShiftPlanningActivationOperationTerminal,
} from "./shift-planning-publication-contract.js";
import {ShiftPlanningEnvironment} from "./shift-planning-wire.js";

export const SHIFT_PLANNING_FIRESTORE_CAS_MAX_ATTEMPTS = 5 as const;

export type ShiftPlanningFirestoreCasAttemptContext = {
  firestore: Firestore;
  transaction: Transaction;
  attemptedAt: Timestamp;
};

export type ShiftPlanningForwardActivationAttemptResolution = Omit<
  MaterializeShiftPlanningForwardActivationInput,
  | "operationId"
  | "workerId"
  | "fencingEpoch"
  | "leaseDurationMillis"
  | "attemptedAt"
>;

export type ShiftPlanningInverseRecoveryAttemptResolution = Omit<
  MaterializeShiftPlanningInverseRecoveryInput,
  "recoveryOperationId" | "recoveredAt"
>;

export type ShiftPlanningForwardActivationAttemptResolver = (
  context: ShiftPlanningFirestoreCasAttemptContext,
) => Promise<ShiftPlanningForwardActivationAttemptResolution>;

export type ShiftPlanningInverseRecoveryAttemptResolver = (
  context: ShiftPlanningFirestoreCasAttemptContext,
) => Promise<ShiftPlanningInverseRecoveryAttemptResolution>;

export type ExecuteShiftPlanningForwardActivationInput = {
  environment: ShiftPlanningEnvironment;
  operationId: string;
  workerId: string;
  fencingEpoch: number;
  leaseDurationMillis: number;
  resolveAttempt: ShiftPlanningForwardActivationAttemptResolver;
};

export type ExecuteShiftPlanningInverseRecoveryInput = {
  environment: ShiftPlanningEnvironment;
  activationOperationId: string;
  recoveryOperationId: string;
  resolveAttempt: ShiftPlanningInverseRecoveryAttemptResolver;
};

export type ShiftPlanningFirestoreCasExecutionResult<Attempt> =
  | {
    kind: "committed";
    attempt: Attempt;
    outcomePersistenceKind:
      ShiftPlanningAttemptOutcomePersistenceResult["kind"];
    outcome: ShiftPlanningCommittedAttemptOutcome;
  }
  | {
    kind: "terminalReplay";
    attempt: null;
    outcomePersistenceKind: "replayed";
    outcome: ShiftPlanningCommittedAttemptOutcome;
  };

export type ShiftPlanningFirestoreCasRuntime = {
  executeForwardActivation(
    input: ExecuteShiftPlanningForwardActivationInput,
  ): Promise<
    ShiftPlanningFirestoreCasExecutionResult<
      ShiftPlanningForwardActivationAttempt
    >
  >;
  executeInverseRecovery(
    input: ExecuteShiftPlanningInverseRecoveryInput,
  ): Promise<
    ShiftPlanningFirestoreCasExecutionResult<
      ShiftPlanningInverseRecoveryAttempt
    >
  >;
};

type ShiftPlanningFirestoreCasRuntimeDependencies = {
  outcomePersistence?: ShiftPlanningAttemptOutcomePersistence;
  clock?: () => Timestamp;
  measureForwardAttempt?:
    typeof measureAndSealShiftPlanningForwardActivationAttempt;
  measureInverseAttempt?:
    typeof measureAndSealShiftPlanningInverseRecoveryAttempt;
};

const failRuntime = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_transaction", message);
};

const failOutcome = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_attempt_outcome", message);
};

const requireTimestamp = (value: unknown, name: string): Timestamp => {
  if (!(value instanceof Timestamp)) {
    return failRuntime(`${name} must be a Firestore Timestamp.`);
  }
  return value;
};

const requireDigest = (value: unknown, name: string): ShiftPlanningDigest => {
  if (
    typeof value !== "string" ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return failOutcome(`${name} must be a planning digest.`);
  }
  return value as ShiftPlanningDigest;
};

const requireEnvironment = (value: unknown): ShiftPlanningEnvironment => {
  if (value !== "develop" && value !== "production") {
    return failRuntime("Planning CAS environment is invalid.");
  }
  return value;
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failRuntime(`${name} is not a valid identifier.`);
  }
  return value;
};

const isEarlier = (left: Timestamp, right: Timestamp): boolean =>
  left.seconds < right.seconds ||
  (left.seconds === right.seconds && left.nanoseconds < right.nanoseconds);

const requirePostReturnTimestamp = (
  recordedAt: Timestamp,
  attemptedAt: Timestamp,
): Timestamp => {
  if (isEarlier(recordedAt, attemptedAt)) {
    return failOutcome(
      "Attempt outcome clock precedes the committed transaction attempt.",
    );
  }
  return recordedAt;
};

/**
 * Derives the non-circular acknowledgement for a committed forward attempt.
 * The caller supplies the clock sample read only after `runTransaction`
 * returns, so the outcome never participates in the measured request.
 * @param {ShiftPlanningForwardActivationAttempt} attempt Final SDK attempt.
 * @param {Timestamp} recordedAt Trusted post-return clock sample.
 * @return {ShiftPlanningCommittedAttemptOutcome} Canonical forward outcome.
 */
export const createShiftPlanningForwardActivationOutcome = (
  attempt: ShiftPlanningForwardActivationAttempt,
  recordedAt: Timestamp,
): ShiftPlanningCommittedAttemptOutcome => {
  const operation = attempt.materialization.operation;
  return createShiftPlanningCommittedAttemptOutcome({
    environment: operation.environment,
    operationId: operation.operationId,
    operationIntentDigest: requireDigest(
      operation.operationIntentDigest,
      "forward operation intent digest",
    ),
    bundleRevision: operation.bundleRevision,
    bundleDigest: requireDigest(
      operation.bundleDigest,
      "forward bundle digest",
    ),
    writeEpoch: operation.writeEpoch,
    recordedAt: requirePostReturnTimestamp(
      requireTimestamp(recordedAt, "forward outcome recordedAt"),
      operation.attemptedAt,
    ),
    measurement: attempt.measurement,
  });
};

/**
 * Derives the non-circular acknowledgement for a committed inverse attempt.
 * Recovery binds its own intent and strictly newer epoch while retaining the
 * activation operation as the parent audit identity.
 * @param {ShiftPlanningInverseRecoveryAttempt} attempt Final SDK attempt.
 * @param {Timestamp} recordedAt Trusted post-return clock sample.
 * @return {ShiftPlanningCommittedAttemptOutcome} Canonical inverse outcome.
 */
export const createShiftPlanningInverseRecoveryOutcome = (
  attempt: ShiftPlanningInverseRecoveryAttempt,
  recordedAt: Timestamp,
): ShiftPlanningCommittedAttemptOutcome => {
  const operation = attempt.materialization.operation;
  return createShiftPlanningCommittedAttemptOutcome({
    environment: operation.environment,
    operationId: operation.operationId,
    operationIntentDigest: requireDigest(
      operation.recoveryIntentDigest,
      "inverse operation intent digest",
    ),
    bundleRevision: operation.bundleRevision,
    bundleDigest: requireDigest(
      operation.bundleDigest,
      "inverse bundle digest",
    ),
    writeEpoch: operation.recoveryWriteEpoch,
    recordedAt: requirePostReturnTimestamp(
      requireTimestamp(recordedAt, "inverse outcome recordedAt"),
      operation.recoveredAt,
    ),
    measurement: attempt.measurement,
  });
};

/**
 * Creates the backend-only CAS executor. Every Firestore retry invokes the
 * supplied resolver again inside that callback, then the real materializer
 * measures and seals the same SDK-owned batch. Only the final attempt returned
 * by `runTransaction` can produce an outcome, which is retained and read back
 * in the separate non-circular protocol.
 * @param {Firestore} firestore Pinned Firestore client or emulator instance.
 * @param {ShiftPlanningFirestoreCasRuntimeDependencies} dependencies Testable
 * clock, outcome store, and materializer seams.
 * @return {ShiftPlanningFirestoreCasRuntime} Forward and inverse executors.
 */
export const createFirestoreShiftPlanningCasRuntime = (
  firestore: Firestore,
  dependencies: ShiftPlanningFirestoreCasRuntimeDependencies = {},
): ShiftPlanningFirestoreCasRuntime => {
  if (!(firestore instanceof Firestore)) {
    return failRuntime("Planning CAS runtime requires Firestore.");
  }
  const clock = dependencies.clock ?? (() => Timestamp.now());
  const outcomePersistence = dependencies.outcomePersistence ??
    createFirestoreShiftPlanningAttemptOutcomePersistence(firestore);
  const measureForwardAttempt = dependencies.measureForwardAttempt ??
    measureAndSealShiftPlanningForwardActivationAttempt;
  const measureInverseAttempt = dependencies.measureInverseAttempt ??
    measureAndSealShiftPlanningInverseRecoveryAttempt;
  const now = (name: string): Timestamp => requireTimestamp(clock(), name);
  const operationReference = (
    environment: ShiftPlanningEnvironment,
    operationId: string,
  ) => firestore.doc(
    `${environment}/plus-collections/shiftPlanningOperations/${operationId}`,
  );
  const loadAttemptState = async (
    environment: ShiftPlanningEnvironment,
    operationId: string,
    direction: "forward" | "inverse",
  ): Promise<{
    operation: FirebaseFirestore.DocumentData | null;
    outcome: ShiftPlanningCommittedAttemptOutcome | null;
  }> => {
    const reference = operationReference(environment, operationId);
    const [operationSnapshot, outcomeSnapshots] = await Promise.all([
      reference.get(),
      reference.collection("attemptOutcomes").limit(3).get(),
    ]);
    if (outcomeSnapshots.size > 2) {
      return failOutcome("Operation owns too many attempt outcomes.");
    }
    const matching = outcomeSnapshots.docs.map((snapshot) => {
      const outcome = parseShiftPlanningCommittedAttemptOutcome(
        snapshot.data(),
      );
      if (
        snapshot.ref.path !== outcome.outcomePath ||
        outcome.environment !== environment ||
        outcome.operationId !== operationId
      ) {
        return failOutcome("Persisted attempt outcome path has drifted.");
      }
      return outcome;
    }).filter((outcome) => outcome.direction === direction);
    if (matching.length > 1) {
      return failOutcome("Operation owns duplicate directional outcomes.");
    }
    const operation = operationSnapshot.exists ?
      operationSnapshot.data() ?? null : null;
    if (matching.length === 1) {
      if (operation === null) {
        return failOutcome("Attempt outcome lost its operation terminal.");
      }
      requireShiftPlanningAttemptOutcomeOperationBinding(
        operation,
        matching[0],
      );
    }
    return {
      operation,
      outcome: matching[0] ?? null,
    };
  };
  const replayOutcome = async (
    outcome: ShiftPlanningCommittedAttemptOutcome,
  ): Promise<ShiftPlanningCommittedAttemptOutcome> => {
    const retained = await outcomePersistence
      .retainCommittedOutcomeAndReadBack(outcome);
    return retained.outcome;
  };

  return {
    async executeForwardActivation(
      input: ExecuteShiftPlanningForwardActivationInput,
    ): Promise<
      ShiftPlanningFirestoreCasExecutionResult<
        ShiftPlanningForwardActivationAttempt
      >
    > {
      const environment = requireEnvironment(input.environment);
      const operationId = requireIdentifier(
        input.operationId,
        "activation operationId",
      );
      const existing = await loadAttemptState(
        environment,
        operationId,
        "forward",
      );
      if (existing.outcome !== null) {
        return {
          kind: "terminalReplay",
          attempt: null,
          outcomePersistenceKind: "replayed",
          outcome: await replayOutcome(existing.outcome),
        };
      }
      if (existing.operation !== null) {
        return failOutcome(
          "Committed activation is missing its forward attempt outcome.",
        );
      }
      const attempt = await firestore.runTransaction(async (transaction) => {
        const attemptedAt = now("forward attempt clock");
        const resolution = await input.resolveAttempt({
          firestore,
          transaction,
          attemptedAt,
        });
        return measureForwardAttempt({
          ...resolution,
          firestore,
          transaction,
          operationId,
          workerId: input.workerId,
          fencingEpoch: input.fencingEpoch,
          leaseDurationMillis: input.leaseDurationMillis,
          attemptedAt,
        });
      }, {maxAttempts: SHIFT_PLANNING_FIRESTORE_CAS_MAX_ATTEMPTS});
      const expectedOutcome = createShiftPlanningForwardActivationOutcome(
        attempt,
        now("forward outcome clock"),
      );
      const retained = await outcomePersistence
        .retainCommittedOutcomeAndReadBack(expectedOutcome);
      return {
        kind: "committed",
        attempt,
        outcomePersistenceKind: retained.kind,
        outcome: retained.outcome,
      };
    },

    async executeInverseRecovery(
      input: ExecuteShiftPlanningInverseRecoveryInput,
    ): Promise<
      ShiftPlanningFirestoreCasExecutionResult<
        ShiftPlanningInverseRecoveryAttempt
      >
    > {
      const environment = requireEnvironment(input.environment);
      const activationOperationId = requireIdentifier(
        input.activationOperationId,
        "activation operationId",
      );
      const recoveryOperationId = requireIdentifier(
        input.recoveryOperationId,
        "recovery operationId",
      );
      const existing = await loadAttemptState(
        environment,
        activationOperationId,
        "inverse",
      );
      if (existing.outcome !== null) {
        return {
          kind: "terminalReplay",
          attempt: null,
          outcomePersistenceKind: "replayed",
          outcome: await replayOutcome(existing.outcome),
        };
      }
      if (existing.operation === null) {
        return failOutcome("Recovery activation operation is missing.");
      }
      let activation: ReturnType<
        typeof parseShiftPlanningActivationOperationTerminal
      >;
      try {
        activation = parseShiftPlanningActivationOperationTerminal(
          existing.operation,
        );
      } catch {
        let recovery: ReturnType<
          typeof parseShiftPlanningRecoveryOperationTerminal
        > | null = null;
        try {
          recovery = parseShiftPlanningRecoveryOperationTerminal(
            existing.operation,
          );
        } catch {
          return failOutcome("Recovery activation operation is invalid.");
        }
        if (recovery === null) {
          return failOutcome("Recovery activation operation is invalid.");
        }
        if (
          recovery.environment === environment &&
          recovery.operationId === activationOperationId
        ) {
          return failOutcome(
            "Committed recovery is missing its inverse attempt outcome.",
          );
        }
        return failOutcome("Recovery operation identity has drifted.");
      }
      if (
        activation.environment !== environment ||
        activation.operationId !== activationOperationId
      ) {
        return failOutcome("Recovery activation operation has drifted.");
      }
      const attempt = await firestore.runTransaction(async (transaction) => {
        const recoveredAt = now("inverse attempt clock");
        const resolution = await input.resolveAttempt({
          firestore,
          transaction,
          attemptedAt: recoveredAt,
        });
        return measureInverseAttempt({
          ...resolution,
          firestore,
          transaction,
          recoveryOperationId,
          recoveredAt,
        });
      }, {maxAttempts: SHIFT_PLANNING_FIRESTORE_CAS_MAX_ATTEMPTS});
      const expectedOutcome = createShiftPlanningInverseRecoveryOutcome(
        attempt,
        now("inverse outcome clock"),
      );
      if (expectedOutcome.operationId !== activationOperationId) {
        return failOutcome(
          "Recovery attempt returned another activation operation.",
        );
      }
      const retained = await outcomePersistence
        .retainCommittedOutcomeAndReadBack(expectedOutcome);
      return {
        kind: "committed",
        attempt,
        outcomePersistenceKind: retained.kind,
        outcome: retained.outcome,
      };
    },
  };
};
