import {Firestore, Timestamp, Transaction} from "@google-cloud/firestore";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {
  PrepareShiftPlanningFirestoreTransactionInput,
  ShiftPlanningFirestoreAdmission,
  ShiftPlanningFirestoreMutation,
  decodeShiftPlanningFirestoreMutations,
  prepareShiftPlanningFirestoreTransaction,
} from "./shift-planning-firestore-transaction-manifest.js";
import {
  ShiftPlanningNotificationWriterResource,
  inspectShiftPlanningNotificationWriterFences,
} from "./shift-planning-firestore-notification-writer-fence.js";

export type ApplyShiftPlanningFirestoreTransactionAttemptInput =
  PrepareShiftPlanningFirestoreTransactionInput & {
    firestore: Firestore;
    transaction: Transaction;
    writerFenceCheckedAt: Timestamp;
  };

const failTransaction = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_transaction", message);
};

const publicShiftFenceGroups = (
  mutations: readonly ShiftPlanningFirestoreMutation[],
): Map<string, ShiftPlanningNotificationWriterResource[]> => {
  const groups = new Map<
    string,
    ShiftPlanningNotificationWriterResource[]
  >();
  mutations.forEach(({documentPath}) => {
    if (typeof documentPath !== "string") return;
    const match = /^(develop|production)\/plus-collections\/shifts\/([^/]+)$/
      .exec(documentPath);
    if (match === null) return;
    const root = `${match[1]}/plus-collections`;
    groups.set(root, [
      ...(groups.get(root) ?? []),
      {scope: "shift", resourceId: match[2]},
    ]);
  });
  return groups;
};

const requirePublicShiftWriterFences = async (input: {
  firestore: Firestore;
  transaction: Transaction;
  mutations: readonly ShiftPlanningFirestoreMutation[];
  checkedAt: Timestamp;
}): Promise<void> => {
  if (!(input.checkedAt instanceof Timestamp)) {
    return failTransaction("Notification writer-fence clock is invalid.");
  }
  for (const [root, resources] of publicShiftFenceGroups(input.mutations)) {
    const result = await inspectShiftPlanningNotificationWriterFences({
      firestore: input.firestore,
      transaction: input.transaction,
      root,
      resources,
      now: input.checkedAt,
    });
    if (result.kind === "busy") {
      throw new ShiftPlanningError(
        "planning_release_lease_conflict",
        "Public shift mutation overlaps notification dispatch.",
      );
    }
  }
};

/**
 * Applies a detached logical manifest through public transaction methods after
 * every notification fence has been read in the same attempt. The caller owns
 * the callback: resolve all authoritative inputs again on SDK retry, invoke
 * this function once, and return without adding writes. Server commit remains
 * the authority for atomicity and Firestore's actual limits.
 * @param {ApplyShiftPlanningFirestoreTransactionAttemptInput} input Live
 * attempt.
 * @return {Promise<ShiftPlanningFirestoreAdmission>} Application admission
 * only.
 */
export const applyShiftPlanningFirestoreTransactionAttempt = async (
  input: ApplyShiftPlanningFirestoreTransactionAttemptInput,
): Promise<ShiftPlanningFirestoreAdmission> => {
  const prepared = prepareShiftPlanningFirestoreTransaction(input);
  const mutations = decodeShiftPlanningFirestoreMutations(prepared);
  await requirePublicShiftWriterFences({
    firestore: input.firestore,
    transaction: input.transaction,
    mutations,
    checkedAt: input.writerFenceCheckedAt,
  });
  for (const mutation of mutations) {
    const reference = input.firestore.doc(mutation.documentPath);
    if (mutation.kind === "create") {
      input.transaction.create(reference, mutation.data);
    } else if (mutation.kind === "update") {
      if (mutation.precondition === undefined) {
        input.transaction.update(reference, mutation.data);
      } else {
        input.transaction.update(
          reference, mutation.data, mutation.precondition,
        );
      }
    } else if (mutation.precondition === undefined) {
      input.transaction.delete(reference);
    } else {
      input.transaction.delete(reference, mutation.precondition);
    }
  }
  return prepared.measurement;
};
