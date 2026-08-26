import {
  DocumentSnapshot,
  Firestore,
} from "@google-cloud/firestore";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {
  ShiftPlanningCommittedAttemptOutcome,
  parseShiftPlanningCommittedAttemptOutcome,
} from "./shift-planning-attempt-outcome.js";
import {
  parseShiftPlanningRecoveryOperationTerminal,
} from "./shift-planning-inverse-materializer.js";
import {
  parseShiftPlanningActivationOperationTerminal,
} from "./shift-planning-publication-contract.js";

export type ShiftPlanningAttemptOutcomePersistenceResult = {
  kind: "committed" | "replayed";
  outcome: ShiftPlanningCommittedAttemptOutcome;
};

export interface ShiftPlanningAttemptOutcomePersistence {
  retainCommittedOutcomeAndReadBack(
    value: unknown,
  ): Promise<ShiftPlanningAttemptOutcomePersistenceResult>;
}

const failOutcome = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_attempt_outcome", message);
};

const requireSnapshotData = (
  snapshot: DocumentSnapshot,
  name: string,
): FirebaseFirestore.DocumentData => {
  const data = snapshot.data();
  if (!snapshot.exists || data === undefined) {
    return failOutcome(`${name} is missing.`);
  }
  return data;
};

const requireExactReplay = (
  actual: ShiftPlanningCommittedAttemptOutcome,
  expected: ShiftPlanningCommittedAttemptOutcome,
): void => {
  if (
    actual.outcomePath !== expected.outcomePath ||
    actual.attemptId !== expected.attemptId ||
    actual.operationId !== expected.operationId ||
    actual.operationIntentDigest !== expected.operationIntentDigest ||
    actual.outcomeDigest !== expected.outcomeDigest
  ) {
    failOutcome("Attempt outcome key already owns another acknowledgement.");
  }
};

const requireOperationBinding = (
  value: unknown,
  expected: ShiftPlanningCommittedAttemptOutcome,
): void => {
  try {
    if (expected.direction === "forward") {
      const operation = parseShiftPlanningActivationOperationTerminal(value);
      if (
        operation.environment !== expected.environment ||
        operation.operationId !== expected.operationId ||
        operation.operationIntentDigest !== expected.operationIntentDigest ||
        operation.bundleRevision !== expected.bundleRevision ||
        operation.bundleDigest !== expected.bundleDigest ||
        operation.writeEpoch !== expected.writeEpoch ||
        operation.forwardManifestDigest !==
          expected.measurement.manifestDigest
      ) {
        failOutcome("Forward outcome does not match its operation terminal.");
      }
      return;
    }
    const operation = parseShiftPlanningRecoveryOperationTerminal(value);
    if (
      operation.environment !== expected.environment ||
      operation.operationId !== expected.operationId ||
      operation.recoveryIntentDigest !== expected.operationIntentDigest ||
      operation.bundleRevision !== expected.bundleRevision ||
      operation.bundleDigest !== expected.bundleDigest ||
      operation.recoveryWriteEpoch !== expected.writeEpoch ||
      operation.inverseManifestDigest !== expected.measurement.manifestDigest
    ) {
      failOutcome("Inverse outcome does not match its operation terminal.");
    }
  } catch (error) {
    if (
      error instanceof ShiftPlanningError &&
      error.code === "invalid_planning_attempt_outcome"
    ) {
      throw error;
    }
    failOutcome("Attempt outcome operation terminal is invalid.");
  }
};

/**
 * Creates the backend-only immutable outcome repository. The caller invokes it
 * only after the measured transaction has returned successfully. Persistence
 * uses create-without-overwrite semantics in a separate transaction and then
 * performs an independent read-back; exact retries converge on the same record.
 * @param {Firestore} firestore Pinned Firestore client or emulator instance.
 * @return {ShiftPlanningAttemptOutcomePersistence} Immutable repository port.
 */
export const createFirestoreShiftPlanningAttemptOutcomePersistence = (
  firestore: Firestore,
): ShiftPlanningAttemptOutcomePersistence => {
  if (!(firestore instanceof Firestore)) {
    return failOutcome("Attempt outcome persistence requires Firestore.");
  }
  return {
    async retainCommittedOutcomeAndReadBack(
      value: unknown,
    ): Promise<ShiftPlanningAttemptOutcomePersistenceResult> {
      const expected = parseShiftPlanningCommittedAttemptOutcome(value);
      const reference = firestore.doc(expected.outcomePath);
      const operationReference = reference.parent.parent;
      if (operationReference === null) {
        return failOutcome("Attempt outcome operation path is invalid.");
      }
      const kind = await firestore.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(reference);
        if (snapshot.exists) {
          const persisted = parseShiftPlanningCommittedAttemptOutcome(
            requireSnapshotData(snapshot, "persisted attempt outcome"),
          );
          requireExactReplay(persisted, expected);
          return "replayed" as const;
        }
        const operationSnapshot = await transaction.get(operationReference);
        requireOperationBinding(
          requireSnapshotData(
            operationSnapshot,
            "attempt outcome operation terminal",
          ),
          expected,
        );
        transaction.create(reference, expected);
        return "committed" as const;
      });
      const readBack = parseShiftPlanningCommittedAttemptOutcome(
        requireSnapshotData(
          await reference.get(),
          "attempt outcome read-back",
        ),
      );
      requireExactReplay(readBack, expected);
      return {kind, outcome: readBack};
    },
  };
};
