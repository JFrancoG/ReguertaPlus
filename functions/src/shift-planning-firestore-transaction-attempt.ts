import {
  Firestore,
  Timestamp,
  Transaction,
  WriteBatch,
} from "@google-cloud/firestore";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {
  PopulateCanonicalShiftPlanningFirestoreWriteBatchInput,
  SerializeShiftPlanningFirestoreCommitRequestInput,
  ShiftPlanningFirestoreCommitMeasurement,
  populateCanonicalShiftPlanningFirestoreWriteBatch,
  serializeShiftPlanningFirestoreCommitRequest,
} from "./shift-planning-firestore-transaction-serializer.js";
import {
  ShiftPlanningNotificationWriterResource,
  inspectShiftPlanningNotificationWriterFences,
} from "./shift-planning-firestore-notification-writer-fence.js";

export type MeasureAndSealShiftPlanningFirestoreTransactionAttemptInput =
  Omit<
    SerializeShiftPlanningFirestoreCommitRequestInput,
    "transactionToken" | "writeBatch"
  > & {
    transaction: Transaction;
    mutations: PopulateCanonicalShiftPlanningFirestoreWriteBatchInput[
      "mutations"
    ];
    writerFenceCheckedAt: Timestamp;
  };

type PrivateWriteBatch = WriteBatch & {
  _firestore?: unknown;
  _ops?: unknown;
};

type PrivateTransaction = Transaction & {
  commit?: unknown;
  _firestore?: unknown;
  _transactionIdPromise?: unknown;
  _writeBatch?: unknown;
};

type PrivateTransactionCommit = () => Promise<unknown>;

type GuardedTransactionState = {
  batch: WriteBatch;
  commit: PrivateTransactionCommit;
  firestore: Firestore;
};

type ResolvedTransactionInternals = {
  batch: WriteBatch;
  tokenPromise: Promise<unknown>;
};

const guardedTransactions =
  new WeakMap<Transaction, GuardedTransactionState>();
const pinnedTransactionPrototype = Transaction.prototype;
const pinnedTransactionCommit =
  (pinnedTransactionPrototype as unknown as {commit?: unknown}).commit;

const failTransaction = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_transaction", message);
};

const failAdapter = (message: string): never => {
  throw new ShiftPlanningError(
    "planning_transaction_adapter_drift",
    message,
  );
};

const publicShiftFenceGroups = (
  mutations: PopulateCanonicalShiftPlanningFirestoreWriteBatchInput[
    "mutations"
  ],
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
  mutations: PopulateCanonicalShiftPlanningFirestoreWriteBatchInput[
    "mutations"
  ];
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

const requireEmptyBatch = (batch: WriteBatch): void => {
  const operations = (batch as PrivateWriteBatch)._ops;
  if (!Array.isArray(operations)) {
    return failAdapter("Firestore Transaction batch storage has drifted.");
  }
  if (operations.length !== 0) {
    return failTransaction(
      "Firestore Transaction contains writes outside the attempt adapter.",
    );
  }
};

const installTransactionGuards = (
  firestore: Firestore,
  transaction: Transaction,
  batch: WriteBatch,
): void => {
  const privateTransaction = transaction as PrivateTransaction;
  const existing = guardedTransactions.get(transaction);
  if (existing !== undefined) {
    if (
      Object.getPrototypeOf(transaction) !== pinnedTransactionPrototype ||
      existing.batch !== batch ||
      existing.firestore !== firestore ||
      privateTransaction._writeBatch !== existing.batch ||
      privateTransaction._firestore !== existing.firestore ||
      privateTransaction.commit !== existing.commit
    ) {
      return failAdapter("Guarded Firestore Transaction internals drifted.");
    }
    return;
  }
  const batchDescriptor = Object.getOwnPropertyDescriptor(
    transaction,
    "_writeBatch",
  );
  const firestoreDescriptor = Object.getOwnPropertyDescriptor(
    transaction,
    "_firestore",
  );
  const ownCommitDescriptor = Object.getOwnPropertyDescriptor(
    transaction,
    "commit",
  );
  if (
    Object.getPrototypeOf(transaction) !== pinnedTransactionPrototype ||
    !batchDescriptor ||
    !("value" in batchDescriptor) ||
    batchDescriptor.value !== batch ||
    !batchDescriptor.configurable ||
    !firestoreDescriptor ||
    !("value" in firestoreDescriptor) ||
    firestoreDescriptor.value !== firestore ||
    !firestoreDescriptor.configurable ||
    ownCommitDescriptor !== undefined ||
    typeof pinnedTransactionCommit !== "function" ||
    privateTransaction.commit !== pinnedTransactionCommit
  ) {
    return failAdapter("Firestore Transaction guard shape has drifted.");
  }
  const state: GuardedTransactionState = {
    batch,
    commit: pinnedTransactionCommit as PrivateTransactionCommit,
    firestore,
  };
  try {
    Object.defineProperties(transaction, {
      commit: {
        configurable: false,
        enumerable: false,
        get: () => state.commit,
        set: () => failTransaction(
          "Firestore Transaction commit is adapter-owned.",
        ),
      },
      _firestore: {
        configurable: false,
        enumerable: firestoreDescriptor.enumerable,
        get: () => state.firestore,
        set: () => failTransaction(
          "Firestore Transaction client is adapter-owned.",
        ),
      },
      _writeBatch: {
        configurable: false,
        enumerable: batchDescriptor.enumerable,
        get: () => state.batch,
        set: () => failTransaction(
          "Firestore Transaction batch is adapter-owned.",
        ),
      },
    });
  } catch (error) {
    if (error instanceof ShiftPlanningError) throw error;
    return failAdapter("Firestore Transaction guard installation failed.");
  }
  guardedTransactions.set(transaction, state);
};

const requireTransactionInternals = (
  firestore: Firestore,
  transaction: Transaction,
): ResolvedTransactionInternals => {
  if (
    !(firestore instanceof Firestore) ||
    !(transaction instanceof Transaction)
  ) {
    return failAdapter("Firestore Transaction came from an unpinned SDK.");
  }
  const privateTransaction = transaction as PrivateTransaction;
  if (privateTransaction._firestore !== firestore) {
    return failAdapter("Firestore Transaction belongs to another client.");
  }
  const batch = privateTransaction._writeBatch;
  if (
    !(batch instanceof WriteBatch) ||
    (batch as PrivateWriteBatch)._firestore !== firestore
  ) {
    return failAdapter("Firestore Transaction write batch has drifted.");
  }
  installTransactionGuards(firestore, transaction, batch);
  const tokenPromise = privateTransaction._transactionIdPromise;
  if (!(tokenPromise instanceof Promise)) {
    return failTransaction(
      "Firestore Transaction must complete its authoritative reads first.",
    );
  }
  requireEmptyBatch(batch);
  return {batch, tokenPromise};
};

/**
 * Populates, measures, and seals the SDK-owned batch for one Firestore
 * transaction attempt. Callers must invoke this once per `runTransaction`
 * callback after awaiting every authoritative read and then return without any
 * further write. Firestore retries re-enter the callback with a reset batch and
 * a new opaque token, so every attempt is independently measured. SDK read or
 * token failures retain their original error code and remain eligible for the
 * SDK retry policy; the token is copied only into the in-memory commit guard
 * and is never returned.
 * @param {MeasureAndSealShiftPlanningFirestoreTransactionAttemptInput} input
 * Actual transaction, complete resolved mutations, manifest, and limits.
 * @return {Promise<ShiftPlanningFirestoreCommitMeasurement>} Exact evidence for
 * the request that the SDK will commit for this attempt.
 */
export const measureAndSealShiftPlanningFirestoreTransactionAttempt = async (
  input: MeasureAndSealShiftPlanningFirestoreTransactionAttemptInput,
): Promise<ShiftPlanningFirestoreCommitMeasurement> => {
  const internals = requireTransactionInternals(
    input.firestore,
    input.transaction,
  );
  await requirePublicShiftWriterFences({
    firestore: input.firestore,
    transaction: input.transaction,
    mutations: input.mutations,
    checkedAt: input.writerFenceCheckedAt,
  });
  const token = await internals.tokenPromise;
  const privateTransaction = input.transaction as PrivateTransaction;
  if (
    privateTransaction._transactionIdPromise !== internals.tokenPromise ||
    privateTransaction._writeBatch !== internals.batch
  ) {
    return failAdapter(
      "Firestore Transaction attempt changed while resolving.",
    );
  }
  if (!(token instanceof Uint8Array) || token.byteLength < 1) {
    return failAdapter("Firestore Transaction token shape has drifted.");
  }
  requireEmptyBatch(internals.batch);
  populateCanonicalShiftPlanningFirestoreWriteBatch({
    firestore: input.firestore,
    writeBatch: internals.batch,
    mutations: input.mutations,
  });
  return serializeShiftPlanningFirestoreCommitRequest({
    firestore: input.firestore,
    direction: input.direction,
    manifestDigest: input.manifestDigest,
    writeBatch: internals.batch,
    transactionToken: Buffer.from(token),
    expectedDocumentWriteCount: input.expectedDocumentWriteCount,
    authority: input.authority,
    writeLimit: input.writeLimit,
    byteLimit: input.byteLimit,
  });
};
