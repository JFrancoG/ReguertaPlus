import {
  DocumentSnapshot,
  Firestore,
  QueryDocumentSnapshot,
  Timestamp,
} from "@google-cloud/firestore";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {
  ShiftPlanningDigest,
  createShiftPlanningDigest,
} from "./shift-planning-digest.js";
import {
  parsePersistedBundle,
} from "./shift-planning-firestore-repository.js";
import {
  ShiftPlanningNotificationBatchReconciliation,
  ShiftPlanningNotificationIntentReconciliation,
  createShiftPlanningNotificationBatchReconciliation,
} from "./shift-planning-notification-batch-reconciliation.js";
import {
  ShiftPlanningNotificationDispatchAttempt,
  parseShiftPlanningNotificationDispatchAttempt,
  parseShiftPlanningNotificationDispatchState,
} from "./shift-planning-notification-dispatch.js";
import {
  parseShiftPlanningHeldNotificationIntent,
} from "./shift-planning-notification-release.js";
import {
  ShiftPlanningAuthoritativeState,
  buildShiftPlanningAuthoritativeState,
} from "./shift-planning-state-persistence.js";
import {
  ShiftPlanningEnvironment,
  ShiftPlanningMaintenanceState,
  ShiftPlanningReleaseLease,
  ShiftRotationAggregateWire,
  parseShiftPlanningMaintenanceState,
  parseShiftRotationAggregateWire,
} from "./shift-planning-wire.js";

export const SHIFT_PLANNING_NOTIFICATION_BATCH_RECORD_SCHEMA_VERSION =
  1 as const;

export type ShiftPlanningNotificationBatchAttemptBinding = {
  intentId: string;
  attemptIds: readonly string[];
};

export type ShiftPlanningNotificationBatchReconciliationCommand = {
  schemaVersion:
    typeof SHIFT_PLANNING_NOTIFICATION_BATCH_RECORD_SCHEMA_VERSION;
  operationKind: "notificationBatchReconciliation";
  environment: ShiftPlanningEnvironment;
  reconciliationId: string;
  bundleRevision: string;
  attemptBindings: readonly ShiftPlanningNotificationBatchAttemptBinding[];
};

export type ShiftPlanningNotificationBatchReconciliationRecord = {
  schemaVersion:
    typeof SHIFT_PLANNING_NOTIFICATION_BATCH_RECORD_SCHEMA_VERSION;
  operationKind: "notificationBatchReconciliationRecord";
  reconciliationId: string;
  environment: ShiftPlanningEnvironment;
  command: ShiftPlanningNotificationBatchReconciliationCommand;
  commandDigest: ShiftPlanningDigest;
  reconciliation: ShiftPlanningNotificationBatchReconciliation;
  authoritativeDigestBefore: ShiftPlanningDigest;
  authoritativeDigestAfter: ShiftPlanningDigest;
  maintenanceBefore: ShiftPlanningMaintenanceState;
  maintenanceAfter: ShiftPlanningMaintenanceState;
  rotationsBefore: {
    delivery: ShiftRotationAggregateWire;
    market: ShiftRotationAggregateWire;
  };
  rotationsAfter: {
    delivery: ShiftRotationAggregateWire;
    market: ShiftRotationAggregateWire;
  };
  attemptedAtMillis: number;
  recordDigest: ShiftPlanningDigest;
};

export type ShiftPlanningNotificationBatchReconciliationResult = {
  kind: "committed" | "replayed";
  record: ShiftPlanningNotificationBatchReconciliationRecord;
};

type UnknownRecord = Record<string, unknown>;

const commandFields = [
  "schemaVersion",
  "operationKind",
  "environment",
  "reconciliationId",
  "bundleRevision",
  "attemptBindings",
] as const;

const bindingFields = ["intentId", "attemptIds"] as const;

const recordFields = [
  "schemaVersion",
  "operationKind",
  "reconciliationId",
  "environment",
  "command",
  "commandDigest",
  "reconciliation",
  "authoritativeDigestBefore",
  "authoritativeDigestAfter",
  "maintenanceBefore",
  "maintenanceAfter",
  "rotationsBefore",
  "rotationsAfter",
  "attemptedAt",
  "recordDigest",
] as const;

const reconciliationFields = [
  "schemaVersion",
  "operationKind",
  "reconciliationId",
  "environment",
  "state",
  "resolution",
  "bundleId",
  "bundleRevision",
  "bundleDigest",
  "writeEpoch",
  "reconciledAtMillis",
  "intents",
  "possibleDeliveryIntentIds",
  "definitivelyFailedIntentIds",
  "demonstrablyUnsubmittedIntentIds",
  "releaseLeaseActions",
  "reconciliationDigest",
] as const;

const reconciledIntentFields = [
  "intentId",
  "eventId",
  "disposition",
  "attemptIds",
  "intentEvidenceDigest",
  "terminalEvidenceDigest",
] as const;

const releaseLeaseFields = [
  "type",
  "bundleId",
  "bundleRevision",
  "bundleDigest",
  "leaseEpoch",
  "ownerOperationId",
  "state",
  "acquiredAtMillis",
  "deadlineAtMillis",
] as const;

const failRepository = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_transaction", message);
};

const failLeaseConflict = (message: string): never => {
  throw new ShiftPlanningError("planning_release_lease_conflict", message);
};

const requireRecord = (value: unknown, name: string): UnknownRecord => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return failRepository(`${name} must be a plain object.`);
  }
  return value as UnknownRecord;
};

const requireExactFields = (
  value: UnknownRecord,
  fields: readonly string[],
  name: string,
): void => {
  const actual = Object.keys(value);
  if (
    actual.length !== fields.length ||
    actual.some((field) => !fields.includes(field))
  ) {
    failRepository(`${name} fields are not exact.`);
  }
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failRepository(`${name} is not a valid identifier.`);
  }
  return value;
};

const requireDigest = (value: unknown, name: string): ShiftPlanningDigest => {
  if (
    typeof value !== "string" ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return failRepository(`${name} is not a planning digest.`);
  }
  return value as ShiftPlanningDigest;
};

const requireNonNegativeInteger = (value: unknown, name: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return failRepository(`${name} must be a non-negative integer.`);
  }
  return value as number;
};

const requireEnvironment = (value: unknown): ShiftPlanningEnvironment => {
  if (value !== "develop" && value !== "production") {
    return failRepository("Planning environment is invalid.");
  }
  return value;
};

const requireStringArray = (value: unknown, name: string): string[] => {
  if (!Array.isArray(value)) {
    return failRepository(`${name} must be an array.`);
  }
  const parsed = value.map((item) => requireIdentifier(item, name));
  if (new Set(parsed).size !== parsed.length) {
    return failRepository(`${name} must be unique.`);
  }
  return parsed;
};

const intentOrdinal = (intentId: string, bundleRevision: string): number => {
  const match = /^(.*)-notification-([1-9][0-9]*)$/.exec(intentId);
  if (!match || match[1] !== bundleRevision) {
    return failRepository("Notification intent ordinal is invalid.");
  }
  const ordinal = Number(match[2]);
  if (!Number.isSafeInteger(ordinal)) {
    return failRepository("Notification intent ordinal is unsafe.");
  }
  return ordinal;
};

export const parseShiftPlanningNotificationBatchReconciliationCommand = (
  value: unknown,
): ShiftPlanningNotificationBatchReconciliationCommand => {
  const command = requireRecord(value, "notification reconciliation command");
  requireExactFields(
    command,
    commandFields,
    "notification reconciliation command",
  );
  if (
    command.schemaVersion !==
      SHIFT_PLANNING_NOTIFICATION_BATCH_RECORD_SCHEMA_VERSION ||
    command.operationKind !== "notificationBatchReconciliation" ||
    !Array.isArray(command.attemptBindings)
  ) {
    return failRepository(
      "Notification reconciliation command discriminator is invalid.",
    );
  }
  const environment = requireEnvironment(command.environment);
  const reconciliationId = requireIdentifier(
    command.reconciliationId,
    "reconciliationId",
  );
  const bundleRevision = requireIdentifier(
    command.bundleRevision,
    "bundleRevision",
  );
  const bindings = command.attemptBindings.map((bindingValue) => {
    const binding = requireRecord(bindingValue, "attempt binding");
    requireExactFields(binding, bindingFields, "attempt binding");
    const intentId = requireIdentifier(binding.intentId, "binding intentId");
    const attemptIds = requireStringArray(
      binding.attemptIds,
      "binding attemptIds",
    );
    if (attemptIds.length === 0) {
      return failLeaseConflict("Every intent requires terminal attempts.");
    }
    return {
      intentId,
      attemptIds,
      ordinal: intentOrdinal(intentId, bundleRevision),
    };
  }).sort((left, right) => left.ordinal - right.ordinal);
  if (
    bindings.length === 0 ||
    new Set(bindings.map(({intentId}) => intentId)).size !== bindings.length ||
    bindings.some(({ordinal}, index) => ordinal !== index + 1)
  ) {
    return failRepository(
      "Notification reconciliation bindings are not contiguous and unique.",
    );
  }
  return {
    schemaVersion:
      SHIFT_PLANNING_NOTIFICATION_BATCH_RECORD_SCHEMA_VERSION,
    operationKind: "notificationBatchReconciliation",
    environment,
    reconciliationId,
    bundleRevision,
    attemptBindings: bindings.map(({intentId, attemptIds}) => ({
      intentId,
      attemptIds,
    })),
  };
};

const parseReconciledIntent = (
  value: unknown,
): ShiftPlanningNotificationIntentReconciliation => {
  const intent = requireRecord(value, "reconciled intent");
  requireExactFields(intent, reconciledIntentFields, "reconciled intent");
  if (
    intent.disposition !== "accepted" &&
    intent.disposition !== "unknown" &&
    intent.disposition !== "definitivelyFailed" &&
    intent.disposition !== "demonstrablyUnsubmitted"
  ) {
    return failRepository("Reconciled intent disposition is invalid.");
  }
  const intentId = requireIdentifier(intent.intentId, "reconciled intentId");
  const eventId = requireIdentifier(intent.eventId, "reconciled eventId");
  if (eventId !== intentId) {
    return failRepository("Reconciled event and intent differ.");
  }
  return {
    intentId,
    eventId,
    disposition: intent.disposition,
    attemptIds: requireStringArray(intent.attemptIds, "reconciled attemptIds"),
    intentEvidenceDigest: requireDigest(
      intent.intentEvidenceDigest,
      "intent evidence digest",
    ),
    terminalEvidenceDigest: requireDigest(
      intent.terminalEvidenceDigest,
      "terminal evidence digest",
    ),
  };
};

const parseReleaseLease = (
  value: unknown,
  type: "delivery" | "market",
): ShiftPlanningReleaseLease => {
  const lease = requireRecord(value, `${type} release lease`);
  requireExactFields(lease, releaseLeaseFields, `${type} release lease`);
  const acquiredAtMillis = requireNonNegativeInteger(
    lease.acquiredAtMillis,
    `${type} lease acquisition`,
  );
  const deadlineAtMillis = requireNonNegativeInteger(
    lease.deadlineAtMillis,
    `${type} lease deadline`,
  );
  if (
    lease.type !== type ||
    (
      lease.state !== "sealed" &&
      lease.state !== "releasing" &&
      lease.state !== "degraded"
    ) ||
    deadlineAtMillis < acquiredAtMillis
  ) {
    return failRepository(`${type} release lease is invalid.`);
  }
  return {
    type,
    bundleId: requireIdentifier(lease.bundleId, `${type} lease bundleId`),
    bundleRevision: requireIdentifier(
      lease.bundleRevision,
      `${type} lease bundleRevision`,
    ),
    bundleDigest: requireDigest(
      lease.bundleDigest,
      `${type} lease bundleDigest`,
    ),
    leaseEpoch: requireNonNegativeInteger(
      lease.leaseEpoch,
      `${type} lease epoch`,
    ),
    ownerOperationId: requireIdentifier(
      lease.ownerOperationId,
      `${type} lease owner`,
    ),
    state: lease.state,
    acquiredAtMillis,
    deadlineAtMillis,
  };
};

const parseClearAction = (
  value: unknown,
  type: "delivery" | "market",
) => {
  const action = requireRecord(value, `${type} release clear action`);
  requireExactFields(
    action,
    ["action", "type", "expectedLease"],
    `${type} release clear action`,
  );
  if (action.action !== "clear" || action.type !== type) {
    return failRepository(`${type} release clear action is invalid.`);
  }
  return {
    action: "clear" as const,
    type,
    expectedLease: parseReleaseLease(action.expectedLease, type),
  };
};

const parseReconciliation = (
  value: unknown,
): ShiftPlanningNotificationBatchReconciliation => {
  const reconciliation = requireRecord(value, "batch reconciliation");
  requireExactFields(
    reconciliation,
    reconciliationFields,
    "batch reconciliation",
  );
  if (
    reconciliation.schemaVersion !== 1 ||
    reconciliation.operationKind !== "notificationBatchReconciliation" ||
    reconciliation.state !== "terminal" ||
    reconciliation.resolution !== "reconciled" ||
    !Array.isArray(reconciliation.intents) ||
    !Array.isArray(reconciliation.releaseLeaseActions)
  ) {
    return failRepository("Batch reconciliation discriminator is invalid.");
  }
  const intents = reconciliation.intents.map(parseReconciledIntent);
  const possibleDeliveryIntentIds = requireStringArray(
    reconciliation.possibleDeliveryIntentIds,
    "possible-delivery intentIds",
  );
  const definitivelyFailedIntentIds = requireStringArray(
    reconciliation.definitivelyFailedIntentIds,
    "definitively-failed intentIds",
  );
  const demonstrablyUnsubmittedIntentIds = requireStringArray(
    reconciliation.demonstrablyUnsubmittedIntentIds,
    "demonstrably-unsubmitted intentIds",
  );
  const actions = reconciliation.releaseLeaseActions;
  if (
    actions.length !== 2 ||
    actions[0]?.action !== "clear" ||
    actions[0]?.type !== "delivery" ||
    actions[1]?.action !== "clear" ||
    actions[1]?.type !== "market"
  ) {
    return failRepository("Reconciliation does not clear both exact leases.");
  }
  const parsed = {
    schemaVersion: 1 as const,
    operationKind: "notificationBatchReconciliation" as const,
    reconciliationId: requireIdentifier(
      reconciliation.reconciliationId,
      "reconciliationId",
    ),
    environment: requireEnvironment(reconciliation.environment),
    state: "terminal" as const,
    resolution: "reconciled" as const,
    bundleId: requireIdentifier(reconciliation.bundleId, "bundleId"),
    bundleRevision: requireIdentifier(
      reconciliation.bundleRevision,
      "bundleRevision",
    ),
    bundleDigest: requireDigest(
      reconciliation.bundleDigest,
      "bundleDigest",
    ),
    writeEpoch: requireNonNegativeInteger(
      reconciliation.writeEpoch,
      "reconciliation writeEpoch",
    ),
    reconciledAtMillis: requireNonNegativeInteger(
      reconciliation.reconciledAtMillis,
      "reconciliation instant",
    ),
    intents,
    possibleDeliveryIntentIds,
    definitivelyFailedIntentIds,
    demonstrablyUnsubmittedIntentIds,
    releaseLeaseActions: [
      parseClearAction(actions[0], "delivery"),
      parseClearAction(actions[1], "market"),
    ] as const,
  };
  const reconciliationDigest = requireDigest(
    reconciliation.reconciliationDigest,
    "reconciliation digest",
  );
  const expectedPossibleDelivery = intents
    .filter(({disposition}) =>
      disposition === "accepted" || disposition === "unknown")
    .map(({intentId}) => intentId);
  const expectedDefinitivelyFailed = intents
    .filter(({disposition}) => disposition === "definitivelyFailed")
    .map(({intentId}) => intentId);
  const expectedDemonstrablyUnsubmitted = intents
    .filter(({disposition}) => disposition === "demonstrablyUnsubmitted")
    .map(({intentId}) => intentId);
  if (
    createShiftPlanningDigest(parsed) !== reconciliationDigest ||
    new Set(intents.map(({intentId}) => intentId)).size !== intents.length ||
    !sameValue(possibleDeliveryIntentIds, expectedPossibleDelivery) ||
    !sameValue(definitivelyFailedIntentIds, expectedDefinitivelyFailed) ||
    !sameValue(
      demonstrablyUnsubmittedIntentIds,
      expectedDemonstrablyUnsubmitted,
    )
  ) {
    return failRepository("Batch reconciliation evidence is inconsistent.");
  }
  return {...parsed, reconciliationDigest};
};

const recordDigestCore = (
  record: Omit<ShiftPlanningNotificationBatchReconciliationRecord,
    "recordDigest">,
): object => record;

const parsePersistedRecord = (
  snapshot: DocumentSnapshot,
): ShiftPlanningNotificationBatchReconciliationRecord => {
  if (!snapshot.exists) {
    return failRepository("Notification reconciliation record is missing.");
  }
  const data = requireRecord(
    snapshot.data(),
    "notification reconciliation record",
  );
  requireExactFields(data, recordFields, "notification reconciliation record");
  if (
    data.schemaVersion !==
      SHIFT_PLANNING_NOTIFICATION_BATCH_RECORD_SCHEMA_VERSION ||
    data.operationKind !== "notificationBatchReconciliationRecord" ||
    !(data.attemptedAt instanceof Timestamp)
  ) {
    return failRepository("Reconciliation record discriminator is invalid.");
  }
  const command = parseShiftPlanningNotificationBatchReconciliationCommand(
    data.command,
  );
  const reconciliation = parseReconciliation(data.reconciliation);
  const before = buildShiftPlanningAuthoritativeState({
    environment: command.environment,
    maintenance: data.maintenanceBefore,
    rotations: data.rotationsBefore,
  });
  const after = buildShiftPlanningAuthoritativeState({
    environment: command.environment,
    maintenance: data.maintenanceAfter,
    rotations: data.rotationsAfter,
  });
  const recordWithoutDigest = {
    schemaVersion:
      SHIFT_PLANNING_NOTIFICATION_BATCH_RECORD_SCHEMA_VERSION,
    operationKind: "notificationBatchReconciliationRecord" as const,
    reconciliationId: requireIdentifier(
      data.reconciliationId,
      "reconciliationId",
    ),
    environment: requireEnvironment(data.environment),
    command,
    commandDigest: requireDigest(data.commandDigest, "command digest"),
    reconciliation,
    authoritativeDigestBefore: requireDigest(
      data.authoritativeDigestBefore,
      "authoritative digest before",
    ),
    authoritativeDigestAfter: requireDigest(
      data.authoritativeDigestAfter,
      "authoritative digest after",
    ),
    maintenanceBefore: before.maintenance,
    maintenanceAfter: after.maintenance,
    rotationsBefore: before.rotations,
    rotationsAfter: after.rotations,
    attemptedAtMillis: data.attemptedAt.toMillis(),
  };
  const recordDigest = requireDigest(data.recordDigest, "record digest");
  const expectedAfter = nextAuthoritativeState({
    before,
    reconciliationId: command.reconciliationId,
  });
  const deliveryLease = before.rotations.delivery.releaseLease;
  const marketLease = before.rotations.market.releaseLease;
  if (
    recordWithoutDigest.reconciliationId !== command.reconciliationId ||
    recordWithoutDigest.environment !== command.environment ||
    reconciliation.reconciliationId !== command.reconciliationId ||
    reconciliation.environment !== command.environment ||
    reconciliation.bundleRevision !== command.bundleRevision ||
    createShiftPlanningDigest(command) !==
      recordWithoutDigest.commandDigest ||
    before.authoritativeDigest !==
      recordWithoutDigest.authoritativeDigestBefore ||
    after.authoritativeDigest !==
      recordWithoutDigest.authoritativeDigestAfter ||
    deliveryLease === null ||
    marketLease === null ||
    !sameValue(
      reconciliation.releaseLeaseActions[0].expectedLease,
      deliveryLease,
    ) ||
    !sameValue(
      reconciliation.releaseLeaseActions[1].expectedLease,
      marketLease,
    ) ||
    reconciliation.bundleRevision !== before.maintenance.activeRevision ||
    reconciliation.bundleDigest !== before.maintenance.activeDigest ||
    reconciliation.writeEpoch !== before.maintenance.writeEpoch ||
    !sameValue(after, expectedAfter) ||
    !sameValue(
      reconciliation.intents.map(({intentId, attemptIds}) => ({
        intentId,
        attemptIds,
      })),
      command.attemptBindings,
    ) ||
    createShiftPlanningDigest(recordDigestCore(recordWithoutDigest)) !==
      recordDigest
  ) {
    return failRepository("Reconciliation record evidence is inconsistent.");
  }
  return {...recordWithoutDigest, recordDigest};
};

const requireSnapshot = (
  snapshot: DocumentSnapshot,
  name: string,
): QueryDocumentSnapshot => {
  if (!snapshot.exists) return failRepository(`${name} does not exist.`);
  return snapshot as QueryDocumentSnapshot;
};

const sameValue = (left: unknown, right: unknown): boolean =>
  createShiftPlanningDigest(left) === createShiftPlanningDigest(right);

const pairedLease = (
  state: ShiftPlanningAuthoritativeState,
  type: "delivery" | "market",
): ShiftPlanningReleaseLease => {
  const lease = state.rotations[type].releaseLease;
  if (lease === null) {
    return failLeaseConflict(`${type} release lease is not retained.`);
  }
  return lease;
};

const nextAuthoritativeState = (input: {
  before: ShiftPlanningAuthoritativeState;
  reconciliationId: string;
}): ShiftPlanningAuthoritativeState => {
  const maintenance = input.before.maintenance;
  const delivery = input.before.rotations.delivery;
  const market = input.before.rotations.market;
  if (
    maintenance.stateRevision === Number.MAX_SAFE_INTEGER ||
    maintenance.writeEpoch === Number.MAX_SAFE_INTEGER ||
    delivery.stateRevision === Number.MAX_SAFE_INTEGER ||
    market.stateRevision === Number.MAX_SAFE_INTEGER
  ) {
    return failLeaseConflict("Planning revisions cannot advance safely.");
  }
  return buildShiftPlanningAuthoritativeState({
    environment: input.before.environment,
    maintenance: parseShiftPlanningMaintenanceState({
      ...maintenance,
      stateRevision: maintenance.stateRevision + 1,
      writeEpoch: maintenance.writeEpoch + 1,
      lastTransitionId: input.reconciliationId,
    }),
    rotations: {
      delivery: parseShiftRotationAggregateWire({
        ...delivery,
        stateRevision: delivery.stateRevision + 1,
        lastIdempotencyKey: input.reconciliationId,
        releaseLease: null,
      }, "delivery"),
      market: parseShiftRotationAggregateWire({
        ...market,
        stateRevision: market.stateRevision + 1,
        lastIdempotencyKey: input.reconciliationId,
        releaseLease: null,
      }, "market"),
    },
  });
};

const reconciliationRecord = (input: {
  command: ShiftPlanningNotificationBatchReconciliationCommand;
  reconciliation: ShiftPlanningNotificationBatchReconciliation;
  before: ShiftPlanningAuthoritativeState;
  after: ShiftPlanningAuthoritativeState;
  attemptedAtMillis: number;
}): ShiftPlanningNotificationBatchReconciliationRecord => {
  const recordWithoutDigest = {
    schemaVersion:
      SHIFT_PLANNING_NOTIFICATION_BATCH_RECORD_SCHEMA_VERSION,
    operationKind: "notificationBatchReconciliationRecord" as const,
    reconciliationId: input.command.reconciliationId,
    environment: input.command.environment,
    command: input.command,
    commandDigest: createShiftPlanningDigest(input.command),
    reconciliation: input.reconciliation,
    authoritativeDigestBefore: requireDigest(
      input.before.authoritativeDigest,
      "authoritative digest before",
    ),
    authoritativeDigestAfter: requireDigest(
      input.after.authoritativeDigest,
      "authoritative digest after",
    ),
    maintenanceBefore: input.before.maintenance,
    maintenanceAfter: input.after.maintenance,
    rotationsBefore: input.before.rotations,
    rotationsAfter: input.after.rotations,
    attemptedAtMillis: input.attemptedAtMillis,
  };
  return {
    ...recordWithoutDigest,
    recordDigest: createShiftPlanningDigest(
      recordDigestCore(recordWithoutDigest),
    ),
  };
};

const serializeRecord = (
  record: ShiftPlanningNotificationBatchReconciliationRecord,
): object => {
  const {attemptedAtMillis, ...persisted} = record;
  return {
    ...persisted,
    attemptedAt: Timestamp.fromMillis(attemptedAtMillis),
  };
};

/**
 * Persists one terminal batch reconciliation through a single Firestore CAS.
 * The transaction reads the canonical bundle intent set, every current intent,
 * dispatch counter, and named append-only attempt before clearing both rotation
 * leases and advancing the shared maintenance epoch. It is not exported.
 * @param {Firestore} firestore Backend-owned Firestore or emulator authority.
 * @param {function(): Timestamp} clock Trusted reconciliation clock.
 * @return {object} Idempotent terminal reconciliation repository.
 */
export const createFirestoreShiftPlanningNotificationBatchRepository = (
  firestore: Firestore,
  clock: () => Timestamp = () => Timestamp.now(),
) => ({
  async reconcile(
    commandValue: ShiftPlanningNotificationBatchReconciliationCommand,
  ): Promise<ShiftPlanningNotificationBatchReconciliationResult> {
    const command = parseShiftPlanningNotificationBatchReconciliationCommand(
      commandValue,
    );
    const commandDigest = createShiftPlanningDigest(command);
    const root = `${command.environment}/plus-collections`;
    const operationReference = firestore.doc(
      `${root}/shiftPlanningOperations/` +
        `notification-reconciliation-${command.reconciliationId}`,
    );
    return firestore.runTransaction(async (transaction) => {
      const operationSnapshot = await transaction.get(operationReference);
      if (operationSnapshot.exists) {
        const record = parsePersistedRecord(operationSnapshot);
        if (record.commandDigest !== commandDigest) {
          throw new ShiftPlanningError(
            "request_intent_conflict",
            "Reconciliation ID is bound to another command.",
          );
        }
        return {kind: "replayed", record};
      }

      const stateReference = firestore.doc(
        `${root}/shiftPlanningState/current`,
      );
      const deliveryReference = firestore.doc(
        `${root}/shiftRotations/delivery`,
      );
      const marketReference = firestore.doc(`${root}/shiftRotations/market`);
      const bundleReference = firestore.doc(
        `${root}/shiftPlanningBundles/${command.bundleRevision}`,
      );
      const [
        stateSnapshot,
        deliverySnapshot,
        marketSnapshot,
        bundleSnapshot,
      ] = await transaction.getAll(
        stateReference,
        deliveryReference,
        marketReference,
        bundleReference,
      );
      const before = buildShiftPlanningAuthoritativeState({
        environment: command.environment,
        maintenance: requireSnapshot(
          stateSnapshot,
          "planning maintenance state",
        ).data(),
        rotations: {
          delivery: requireSnapshot(
            deliverySnapshot,
            "delivery rotation",
          ).data(),
          market: requireSnapshot(marketSnapshot, "market rotation").data(),
        },
      });
      const bundle = parsePersistedBundle(
        requireSnapshot(bundleSnapshot, "persisted bundle").data(),
      );
      const deliveryLease = pairedLease(before, "delivery");
      const marketLease = pairedLease(before, "market");
      if (
        bundle.environment !== command.environment ||
        bundle.bundleRevision !== command.bundleRevision ||
        before.maintenance.activeRevision !== bundle.bundleRevision ||
        before.maintenance.activeDigest !== bundle.bundleDigest ||
        before.rotations.delivery.activeRevision !== bundle.bundleRevision ||
        before.rotations.delivery.activeDigest !== bundle.bundleDigest ||
        before.rotations.market.activeRevision !== bundle.bundleRevision ||
        before.rotations.market.activeDigest !== bundle.bundleDigest ||
        bundle.artifact.activationWriteEpoch !==
          before.maintenance.writeEpoch ||
        deliveryLease.bundleRevision !== bundle.bundleRevision ||
        deliveryLease.bundleDigest !== bundle.bundleDigest ||
        marketLease.bundleRevision !== bundle.bundleRevision ||
        marketLease.bundleDigest !== bundle.bundleDigest
      ) {
        return failLeaseConflict(
          "Active planning lineage does not own the reconciliation batch.",
        );
      }

      const canonicalIntents = bundle.artifact.heldNotificationIntents.map(
        parseShiftPlanningHeldNotificationIntent,
      );
      const intentQuery = firestore.collection(
        `${root}/shiftPlanningNotificationIntents`,
      ).where("bundleRevision", "==", command.bundleRevision);
      const queriedIntents = await transaction.get(intentQuery);
      if (
        canonicalIntents.length !== command.attemptBindings.length ||
        queriedIntents.size !== canonicalIntents.length
      ) {
        return failLeaseConflict(
          "Persisted intent set differs from the canonical bundle.",
        );
      }
      const intentById = new Map(queriedIntents.docs.map((snapshot) => [
        snapshot.id,
        parseShiftPlanningHeldNotificationIntent(snapshot.data()),
      ]));
      for (let index = 0; index < canonicalIntents.length; index += 1) {
        const canonical = canonicalIntents[index];
        const binding = command.attemptBindings[index];
        const persisted = intentById.get(canonical.intentId);
        if (
          binding.intentId !== canonical.intentId ||
          persisted === undefined ||
          !sameValue(persisted, canonical)
        ) {
          return failLeaseConflict(
            "Persisted intent evidence differs from its canonical bundle.",
          );
        }
      }

      const intentReferences = canonicalIntents.map((intent) => firestore.doc(
        `${root}/shiftPlanningNotificationIntents/${intent.intentId}`,
      ));
      const dispatchStateReferences = intentReferences.map((reference) =>
        reference.collection("dispatchState").doc("current"));
      const dispatchStateSnapshots = await transaction.getAll(
        ...dispatchStateReferences,
      );
      const attemptReferences = command.attemptBindings.flatMap(
        (binding, index) => binding.attemptIds.map((attemptId) =>
          intentReferences[index]
            .collection("dispatchAttempts")
            .doc(attemptId)),
      );
      const attemptSnapshots = await transaction.getAll(...attemptReferences);
      let attemptOffset = 0;
      const attemptHistories = command.attemptBindings.map((binding, index) => {
        const dispatchState = parseShiftPlanningNotificationDispatchState(
          requireSnapshot(
            dispatchStateSnapshots[index],
            "notification dispatch state",
          ).data(),
        );
        if (
          dispatchState.intentId !== binding.intentId ||
          dispatchState.eventId !== binding.intentId ||
          dispatchState.activeLease !== null ||
          dispatchState.attemptCount !== binding.attemptIds.length ||
          dispatchState.lastLeaseEpoch !== binding.attemptIds.length
        ) {
          return failLeaseConflict(
            "Notification dispatch state is not exactly terminal.",
          );
        }
        const attempts: ShiftPlanningNotificationDispatchAttempt[] = [];
        for (const attemptId of binding.attemptIds) {
          const snapshot = requireSnapshot(
            attemptSnapshots[attemptOffset],
            "notification dispatch attempt",
          );
          attemptOffset += 1;
          const attempt = parseShiftPlanningNotificationDispatchAttempt(
            snapshot.data(),
          );
          if (snapshot.id !== attemptId) {
            return failRepository("Dispatch attempt path and command differ.");
          }
          attempts.push(attempt);
        }
        return {intentId: binding.intentId, attempts};
      });
      const attemptedAt = clock();
      if (!(attemptedAt instanceof Timestamp)) {
        return failRepository("Repository clock returned an invalid instant.");
      }
      const attemptedAtMillis = requireNonNegativeInteger(
        attemptedAt.toMillis(),
        "reconciliation attempt instant",
      );
      const reconciliation =
        createShiftPlanningNotificationBatchReconciliation({
          environment: command.environment,
          reconciliationId: command.reconciliationId,
          deliveryLease,
          marketLease,
          intents: canonicalIntents,
          attemptHistories,
          reconciledAtMillis: attemptedAtMillis,
        });
      const after = nextAuthoritativeState({
        before,
        reconciliationId: command.reconciliationId,
      });
      const record = reconciliationRecord({
        command,
        reconciliation,
        before,
        after,
        attemptedAtMillis,
      });
      transaction.update(stateReference, after.maintenance);
      transaction.update(deliveryReference, after.rotations.delivery);
      transaction.update(marketReference, after.rotations.market);
      transaction.create(operationReference, serializeRecord(record));
      return {kind: "committed", record};
    });
  },
});
