import {Firestore, Transaction} from "@google-cloud/firestore";
import {ShiftPlanningHeldNotificationIntent} from "./shift-planning-bundle.js";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {createShiftPlanningDigest} from "./shift-planning-digest.js";
import {
  parseShiftPlanningNotificationDispatchAttempt,
  parseShiftPlanningNotificationDispatchState,
} from "./shift-planning-notification-dispatch.js";
import {parseShiftPlanningHeldNotificationIntent} from
  "./shift-planning-notification-release.js";
import type {ShiftPlanningNotificationDispatchEvidence} from
  "./shift-planning-notification-terminal-incident.js";

const conflict = (message: string): never => {
  throw new ShiftPlanningError("planning_release_lease_conflict", message);
};

/**
 * Reads the complete inactive dispatch history under the caller's transaction.
 * Reconciliation, incident entry and terminalization share this authority:
 * missing intents, unlisted attempts, live leases or changed payloads prevent
 * all three transitions. Each caller then applies its own terminal policy.
 * @param {object} input Canonical bundle intents and explicitly named attempts.
 * @return {Promise<ShiftPlanningNotificationDispatchEvidence[]>} History.
 */
export const readShiftPlanningNotificationRecoveryEvidence = async (input: {
  firestore: Firestore;
  transaction: Transaction;
  root: string;
  bundleRevision: string;
  canonicalIntents: readonly ShiftPlanningHeldNotificationIntent[];
  attemptBindings: readonly {
    intentId: string;
    attemptIds: readonly string[];
  }[];
}): Promise<ShiftPlanningNotificationDispatchEvidence[]> => {
  const {firestore, transaction, canonicalIntents, attemptBindings} = input;
  const collection = firestore.collection(
    `${input.root}/shiftPlanningNotificationIntents`,
  );
  const persisted = await transaction.get(
    collection.where("bundleRevision", "==", input.bundleRevision),
  );
  if (
    persisted.size !== canonicalIntents.length ||
    attemptBindings.length !== canonicalIntents.length
  ) return conflict("Persisted intent set differs from the canonical bundle.");
  const byId = new Map(persisted.docs.map((snapshot) => [
    snapshot.id, parseShiftPlanningHeldNotificationIntent(snapshot.data()),
  ]));
  canonicalIntents.forEach((intent, index) => {
    const stored = byId.get(intent.intentId);
    if (
      attemptBindings[index].intentId !== intent.intentId ||
      stored === undefined ||
      createShiftPlanningDigest(stored) !== createShiftPlanningDigest(intent)
    ) conflict("Persisted intent evidence differs from its canonical bundle.");
  });
  const references = canonicalIntents.map(({intentId}) =>
    collection.doc(intentId));
  const states = references.length === 0 ? [] : await transaction.getAll(
    ...references.map((ref) => ref.collection("dispatchState").doc("current")),
  );
  const attemptReferences = attemptBindings.flatMap((binding, index) =>
    binding.attemptIds.map((id) =>
      references[index].collection("dispatchAttempts").doc(id)));
  const snapshots = attemptReferences.length === 0 ? [] :
    await transaction.getAll(...attemptReferences);
  let offset = 0;
  return attemptBindings.map((binding, index) => {
    if (!states[index].exists) {
      throw new ShiftPlanningError(
        "invalid_planning_transaction",
        "Notification dispatch state is missing.",
      );
    }
    const dispatchState = parseShiftPlanningNotificationDispatchState(
      states[index].data(),
    );
    if (
      dispatchState.intentId !== binding.intentId ||
      dispatchState.eventId !== binding.intentId ||
      dispatchState.activeLease !== null ||
      dispatchState.attemptCount !== binding.attemptIds.length ||
      dispatchState.lastLeaseEpoch !== binding.attemptIds.length
    ) return conflict("Notification dispatch state is not exactly inactive.");
    const attempts = binding.attemptIds.map((attemptId) => {
      const snapshot = snapshots[offset++];
      if (!snapshot.exists || snapshot.id !== attemptId) {
        throw new ShiftPlanningError(
          "invalid_planning_transaction",
          "Dispatch attempt is missing or its path differs from the command.",
        );
      }
      return parseShiftPlanningNotificationDispatchAttempt(snapshot.data());
    });
    return {intentId: binding.intentId, dispatchState, attempts};
  });
};
