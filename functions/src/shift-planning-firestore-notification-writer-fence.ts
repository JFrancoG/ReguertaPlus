import {
  Firestore,
  Timestamp,
  Transaction,
} from "@google-cloud/firestore";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {
  ShiftPlanningNotificationResourceFenceScope,
  parseShiftPlanningNotificationResourceFence,
  shiftPlanningNotificationResourceFenceId,
  shiftPlanningNotificationResourceFenceIsActive,
} from "./shift-planning-notification-resource-fence.js";

export const SHIFT_PLANNING_NOTIFICATION_WRITER_MAX_RESOURCES = 500 as const;

export type ShiftPlanningNotificationWriterResource = {
  scope: ShiftPlanningNotificationResourceFenceScope;
  resourceId: string;
};

export type ShiftPlanningNotificationWriterFenceResult =
  | {kind: "writable"}
  | {kind: "busy"; retryAt: Timestamp};

const failWriterFence = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_transaction", message);
};

const canonicalResources = (
  resources: readonly ShiftPlanningNotificationWriterResource[],
): ShiftPlanningNotificationWriterResource[] => {
  if (
    resources.length === 0 ||
    resources.length > SHIFT_PLANNING_NOTIFICATION_WRITER_MAX_RESOURCES
  ) {
    return failWriterFence("Notification writer resource count is invalid.");
  }
  const canonical = new Map<
    string,
    ShiftPlanningNotificationWriterResource
  >();
  resources.forEach(({scope, resourceId}) => {
    const fenceId = shiftPlanningNotificationResourceFenceId(
      scope,
      resourceId,
    );
    canonical.set(fenceId, {scope, resourceId});
  });
  return [...canonical.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, resource]) => resource);
};

/**
 * Reads every notification fence in the caller's write transaction. A claim
 * racing this read changes the same deterministic document, so Firestore
 * retries the writer and observes the active lease before any mutation commits.
 * Malformed fences fail closed; expired exact fences do not block the writer.
 * @param {object} input Transaction, root, resources, and one clock sample.
 * @return {Promise<ShiftPlanningNotificationWriterFenceResult>} Write decision.
 */
export const inspectShiftPlanningNotificationWriterFences = async (input: {
  firestore: Firestore;
  transaction: Transaction;
  root: string;
  resources: readonly ShiftPlanningNotificationWriterResource[];
  now: Timestamp;
}): Promise<ShiftPlanningNotificationWriterFenceResult> => {
  const resources = canonicalResources(input.resources);
  const references = resources.map(({scope, resourceId}) =>
    input.firestore.doc(
      `${input.root}/shiftPlanningNotificationFences/` +
        shiftPlanningNotificationResourceFenceId(scope, resourceId),
    )
  );
  const snapshots = await input.transaction.getAll(...references);
  let retryAt: Timestamp | null = null;
  snapshots.forEach((snapshot, index) => {
    if (!snapshot.exists) return;
    const resource = resources[index];
    const fence = parseShiftPlanningNotificationResourceFence(
      snapshot.data(),
    );
    if (
      fence.scope !== resource.scope ||
      fence.resourceId !== resource.resourceId
    ) {
      return failWriterFence(
        "Notification writer resource fence path binding drifted.",
      );
    }
    if (
      shiftPlanningNotificationResourceFenceIsActive(fence, input.now) &&
      (retryAt === null || fence.expiresAt.toMillis() > retryAt.toMillis())
    ) {
      retryAt = fence.expiresAt;
    }
  });
  return retryAt === null ? {kind: "writable"} : {kind: "busy", retryAt};
};
