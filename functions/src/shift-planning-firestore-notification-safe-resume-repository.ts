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
import {parsePersistedBundle} from "./shift-planning-firestore-repository.js";
import {
  ShiftPlanningNotificationDispatchAttempt,
  parseShiftPlanningNotificationDispatchAttempt,
  parseShiftPlanningNotificationDispatchState,
} from "./shift-planning-notification-dispatch.js";
import {
  createShiftPlanningNotificationIncidentShiftFence,
  shiftPlanningNotificationIncidentShiftFenceId,
} from "./shift-planning-notification-incident-fence.js";
import {parseShiftPlanningHeldNotificationIntent} from
  "./shift-planning-notification-release.js";
import {
  SHIFT_PLANNING_NOTIFICATION_SAFE_RESUME_MAX_TTL_MILLIS,
  ShiftPlanningNotificationDispatchEvidence,
  ShiftPlanningNotificationSafeResume,
  createShiftPlanningNotificationSafeResume,
  parseShiftPlanningNotificationSafeResume,
} from "./shift-planning-notification-terminal-incident.js";
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

export const SHIFT_PLANNING_NOTIFICATION_SAFE_RESUME_RECORD_SCHEMA_VERSION =
  1 as const;

export type ShiftPlanningNotificationSafeResumeAttemptBinding = {
  intentId: string;
  attemptIds: readonly string[];
};

export type ShiftPlanningNotificationSafeResumeCommand = {
  schemaVersion:
    typeof SHIFT_PLANNING_NOTIFICATION_SAFE_RESUME_RECORD_SCHEMA_VERSION;
  operationKind: "notificationSafeResumeEntry";
  environment: ShiftPlanningEnvironment;
  incidentId: string;
  bundleRevision: string;
  ownerUserId: string;
  escalationTargetId: string;
  ttlMillis: number;
  attemptBindings: readonly ShiftPlanningNotificationSafeResumeAttemptBinding[];
};

export type ShiftPlanningNotificationIncidentFenceEvidence = {
  shiftId: string;
  incidentId: string;
  bundleRevision: string;
  bundleDigest: ShiftPlanningDigest;
  ownerUserId: string;
  acquiredAtMillis: number;
  expiresAtMillis: number;
  safeResumeDigest: ShiftPlanningDigest;
};

export type ShiftPlanningNotificationSafeResumeRecord = {
  schemaVersion:
    typeof SHIFT_PLANNING_NOTIFICATION_SAFE_RESUME_RECORD_SCHEMA_VERSION;
  operationKind: "notificationSafeResumeEntryRecord";
  incidentId: string;
  environment: ShiftPlanningEnvironment;
  command: ShiftPlanningNotificationSafeResumeCommand;
  commandDigest: ShiftPlanningDigest;
  safeResume: ShiftPlanningNotificationSafeResume;
  incidentFences: readonly ShiftPlanningNotificationIncidentFenceEvidence[];
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

export type ShiftPlanningNotificationSafeResumeResult = {
  kind: "committed" | "replayed";
  record: ShiftPlanningNotificationSafeResumeRecord;
};

type UnknownRecord = Record<string, unknown>;

const commandFields = [
  "schemaVersion",
  "operationKind",
  "environment",
  "incidentId",
  "bundleRevision",
  "ownerUserId",
  "escalationTargetId",
  "ttlMillis",
  "attemptBindings",
] as const;
const bindingFields = ["intentId", "attemptIds"] as const;
const recordFields = [
  "schemaVersion",
  "operationKind",
  "incidentId",
  "environment",
  "command",
  "commandDigest",
  "safeResume",
  "incidentFences",
  "authoritativeDigestBefore",
  "authoritativeDigestAfter",
  "maintenanceBefore",
  "maintenanceAfter",
  "rotationsBefore",
  "rotationsAfter",
  "attemptedAt",
  "recordDigest",
] as const;
const fenceEvidenceFields = [
  "shiftId",
  "incidentId",
  "bundleRevision",
  "bundleDigest",
  "ownerUserId",
  "acquiredAtMillis",
  "expiresAtMillis",
  "safeResumeDigest",
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

const requirePositiveInteger = (value: unknown, name: string): number => {
  const parsed = requireNonNegativeInteger(value, name);
  if (parsed === 0) return failRepository(`${name} must be positive.`);
  return parsed;
};

const requireEnvironment = (value: unknown): ShiftPlanningEnvironment => {
  if (value !== "develop" && value !== "production") {
    return failRepository("Planning environment is invalid.");
  }
  return value;
};

const requireStringArray = (value: unknown, name: string): string[] => {
  if (!Array.isArray(value)) return failRepository(`${name} must be an array.`);
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
  return requirePositiveInteger(Number(match[2]), "notification ordinal");
};

export const parseShiftPlanningNotificationSafeResumeCommand = (
  value: unknown,
): ShiftPlanningNotificationSafeResumeCommand => {
  const command = requireRecord(value, "safe-resume command");
  requireExactFields(command, commandFields, "safe-resume command");
  if (
    command.schemaVersion !==
      SHIFT_PLANNING_NOTIFICATION_SAFE_RESUME_RECORD_SCHEMA_VERSION ||
    command.operationKind !== "notificationSafeResumeEntry" ||
    !Array.isArray(command.attemptBindings)
  ) {
    return failRepository("Safe-resume command discriminator is invalid.");
  }
  const bundleRevision = requireIdentifier(
    command.bundleRevision,
    "bundleRevision",
  );
  const attemptBindings = command.attemptBindings.map((value) => {
    const binding = requireRecord(value, "safe-resume attempt binding");
    requireExactFields(binding, bindingFields, "safe-resume attempt binding");
    const intentId = requireIdentifier(binding.intentId, "binding intentId");
    return {
      intentId,
      attemptIds: requireStringArray(binding.attemptIds, "binding attemptIds"),
      ordinal: intentOrdinal(intentId, bundleRevision),
    };
  }).sort((left, right) => left.ordinal - right.ordinal);
  if (
    attemptBindings.length === 0 ||
    new Set(attemptBindings.map(({intentId}) => intentId)).size !==
      attemptBindings.length ||
    attemptBindings.some(({ordinal}, index) => ordinal !== index + 1)
  ) {
    return failRepository(
      "Safe-resume bindings are not contiguous and unique.",
    );
  }
  const ttlMillis = requirePositiveInteger(
    command.ttlMillis,
    "safe-resume TTL",
  );
  if (ttlMillis > SHIFT_PLANNING_NOTIFICATION_SAFE_RESUME_MAX_TTL_MILLIS) {
    return failRepository("Safe-resume TTL exceeds its bounded policy.");
  }
  return {
    schemaVersion:
      SHIFT_PLANNING_NOTIFICATION_SAFE_RESUME_RECORD_SCHEMA_VERSION,
    operationKind: "notificationSafeResumeEntry",
    environment: requireEnvironment(command.environment),
    incidentId: requireIdentifier(command.incidentId, "incidentId"),
    bundleRevision,
    ownerUserId: requireIdentifier(command.ownerUserId, "ownerUserId"),
    escalationTargetId: requireIdentifier(
      command.escalationTargetId,
      "escalationTargetId",
    ),
    ttlMillis,
    attemptBindings: attemptBindings.map(({intentId, attemptIds}) => ({
      intentId,
      attemptIds,
    })),
  };
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
  safeResume: ShiftPlanningNotificationSafeResume;
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
      lastTransitionId: input.safeResume.incidentId,
    }),
    rotations: {
      delivery: parseShiftRotationAggregateWire({
        ...delivery,
        stateRevision: delivery.stateRevision + 1,
        lastIdempotencyKey: input.safeResume.incidentId,
        releaseLease: input.safeResume.releaseLeaseActions[0].replacementLease,
      }, "delivery"),
      market: parseShiftRotationAggregateWire({
        ...market,
        stateRevision: market.stateRevision + 1,
        lastIdempotencyKey: input.safeResume.incidentId,
        releaseLease: input.safeResume.releaseLeaseActions[1].replacementLease,
      }, "market"),
    },
  });
};

const fenceEvidence = (
  safeResume: ShiftPlanningNotificationSafeResume,
): readonly ShiftPlanningNotificationIncidentFenceEvidence[] =>
  safeResume.affectedShiftIds.map((shiftId) => ({
    shiftId,
    incidentId: safeResume.incidentId,
    bundleRevision: safeResume.bundleRevision,
    bundleDigest: safeResume.bundleDigest,
    ownerUserId: safeResume.ownerUserId,
    acquiredAtMillis: safeResume.enteredAtMillis,
    expiresAtMillis: safeResume.expiresAtMillis,
    safeResumeDigest: safeResume.safeResumeDigest,
  }));

const parseFenceEvidence = (
  value: unknown,
): ShiftPlanningNotificationIncidentFenceEvidence => {
  const evidence = requireRecord(value, "incident fence evidence");
  requireExactFields(evidence, fenceEvidenceFields, "incident fence evidence");
  return {
    shiftId: requireIdentifier(evidence.shiftId, "fence shiftId"),
    incidentId: requireIdentifier(evidence.incidentId, "fence incidentId"),
    bundleRevision: requireIdentifier(
      evidence.bundleRevision,
      "fence bundleRevision",
    ),
    bundleDigest: requireDigest(evidence.bundleDigest, "fence bundleDigest"),
    ownerUserId: requireIdentifier(evidence.ownerUserId, "fence ownerUserId"),
    acquiredAtMillis: requireNonNegativeInteger(
      evidence.acquiredAtMillis,
      "fence acquisition",
    ),
    expiresAtMillis: requireNonNegativeInteger(
      evidence.expiresAtMillis,
      "fence expiry",
    ),
    safeResumeDigest: requireDigest(
      evidence.safeResumeDigest,
      "fence safe-resume digest",
    ),
  };
};

const recordDigestCore = (
  record: Omit<ShiftPlanningNotificationSafeResumeRecord, "recordDigest">,
): object => record;

const createRecord = (input: {
  command: ShiftPlanningNotificationSafeResumeCommand;
  safeResume: ShiftPlanningNotificationSafeResume;
  before: ShiftPlanningAuthoritativeState;
  after: ShiftPlanningAuthoritativeState;
  attemptedAtMillis: number;
}): ShiftPlanningNotificationSafeResumeRecord => {
  const recordWithoutDigest = {
    schemaVersion:
      SHIFT_PLANNING_NOTIFICATION_SAFE_RESUME_RECORD_SCHEMA_VERSION,
    operationKind: "notificationSafeResumeEntryRecord" as const,
    incidentId: input.command.incidentId,
    environment: input.command.environment,
    command: input.command,
    commandDigest: createShiftPlanningDigest(input.command),
    safeResume: input.safeResume,
    incidentFences: fenceEvidence(input.safeResume),
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

const serializeRecord = (record: ShiftPlanningNotificationSafeResumeRecord) => {
  const {attemptedAtMillis, ...persisted} = record;
  return {...persisted, attemptedAt: Timestamp.fromMillis(attemptedAtMillis)};
};

export const parsePersistedShiftPlanningNotificationSafeResumeRecord = (
  snapshot: DocumentSnapshot,
): ShiftPlanningNotificationSafeResumeRecord => {
  const data = requireRecord(
    requireSnapshot(snapshot, "safe-resume record").data(),
    "safe-resume record",
  );
  requireExactFields(data, recordFields, "safe-resume record");
  if (
    data.schemaVersion !==
      SHIFT_PLANNING_NOTIFICATION_SAFE_RESUME_RECORD_SCHEMA_VERSION ||
    data.operationKind !== "notificationSafeResumeEntryRecord" ||
    !(data.attemptedAt instanceof Timestamp) ||
    !Array.isArray(data.incidentFences)
  ) {
    return failRepository("Safe-resume record discriminator is invalid.");
  }
  const command = parseShiftPlanningNotificationSafeResumeCommand(data.command);
  const safeResume = parseShiftPlanningNotificationSafeResume(data.safeResume);
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
      SHIFT_PLANNING_NOTIFICATION_SAFE_RESUME_RECORD_SCHEMA_VERSION,
    operationKind: "notificationSafeResumeEntryRecord" as const,
    incidentId: requireIdentifier(data.incidentId, "incidentId"),
    environment: requireEnvironment(data.environment),
    command,
    commandDigest: requireDigest(data.commandDigest, "command digest"),
    safeResume,
    incidentFences: data.incidentFences.map(parseFenceEvidence),
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
  const expectedAfter = nextAuthoritativeState({before, safeResume});
  const deliveryLease = pairedLease(before, "delivery");
  const marketLease = pairedLease(before, "market");
  if (
    recordWithoutDigest.incidentId !== command.incidentId ||
    recordWithoutDigest.environment !== command.environment ||
    safeResume.incidentId !== command.incidentId ||
    safeResume.environment !== command.environment ||
    safeResume.bundleRevision !== command.bundleRevision ||
    safeResume.ownerUserId !== command.ownerUserId ||
    safeResume.escalationTargetId !== command.escalationTargetId ||
    safeResume.expiresAtMillis - safeResume.enteredAtMillis !==
      command.ttlMillis ||
    safeResume.enteredAtMillis !== recordWithoutDigest.attemptedAtMillis ||
    !sameValue(
      safeResume.releaseLeaseActions[0].expectedLease,
      deliveryLease,
    ) ||
    !sameValue(
      safeResume.releaseLeaseActions[1].expectedLease,
      marketLease,
    ) ||
    createShiftPlanningDigest(command) !== recordWithoutDigest.commandDigest ||
    before.authoritativeDigest !==
      recordWithoutDigest.authoritativeDigestBefore ||
    after.authoritativeDigest !==
      recordWithoutDigest.authoritativeDigestAfter ||
    !sameValue(after, expectedAfter) ||
    !sameValue(recordWithoutDigest.incidentFences, fenceEvidence(safeResume)) ||
    !sameValue(
      safeResume.intents.map(({intentId}) => intentId),
      command.attemptBindings.map(({intentId}) => intentId),
    ) ||
    createShiftPlanningDigest(recordDigestCore(recordWithoutDigest)) !==
      recordDigest
  ) {
    return failRepository("Safe-resume record evidence is inconsistent.");
  }
  return {...recordWithoutDigest, recordDigest};
};

/**
 * Persists entry into bounded notification degraded mode through one Firestore
 * CAS. The activation epoch remains on both leases while the maintenance epoch
 * advances, preserving the exact held-intent lineage for terminal resolution.
 * @param {Firestore} firestore Backend-owned Firestore or emulator authority.
 * @param {function(): Timestamp} clock Trusted incident-entry clock.
 * @return {object} Idempotent safe-resume entry repository.
 */
export const createFirestoreShiftPlanningNotificationSafeResumeRepository = (
  firestore: Firestore,
  clock: () => Timestamp = () => Timestamp.now(),
) => ({
  async enter(
    commandValue: ShiftPlanningNotificationSafeResumeCommand,
  ): Promise<ShiftPlanningNotificationSafeResumeResult> {
    const command = parseShiftPlanningNotificationSafeResumeCommand(
      commandValue,
    );
    const commandDigest = createShiftPlanningDigest(command);
    const root = `${command.environment}/plus-collections`;
    const operationReference = firestore.doc(
      `${root}/shiftPlanningOperations/` +
        `notification-safe-resume-${command.incidentId}`,
    );
    return firestore.runTransaction(async (transaction) => {
      const operationSnapshot = await transaction.get(operationReference);
      if (operationSnapshot.exists) {
        const record =
          parsePersistedShiftPlanningNotificationSafeResumeRecord(
            operationSnapshot,
          );
        if (record.commandDigest !== commandDigest) {
          throw new ShiftPlanningError(
            "request_intent_conflict",
            "Incident ID is bound to another safe-resume command.",
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
      const [stateSnapshot, deliverySnapshot, marketSnapshot, bundleSnapshot] =
        await transaction.getAll(
          stateReference,
          deliveryReference,
          marketReference,
          bundleReference,
        );
      const before = buildShiftPlanningAuthoritativeState({
        environment: command.environment,
        maintenance: requireSnapshot(stateSnapshot, "maintenance state").data(),
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
        deliveryLease.leaseEpoch !== before.maintenance.writeEpoch ||
        marketLease.leaseEpoch !== before.maintenance.writeEpoch
      ) {
        return failLeaseConflict(
          "Active planning lineage does not own the safe-resume batch.",
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
      const dispatchStateSnapshots = await transaction.getAll(
        ...intentReferences.map((reference) =>
          reference.collection("dispatchState").doc("current")),
      );
      const attemptReferences = command.attemptBindings.flatMap(
        (binding, index) => binding.attemptIds.map((attemptId) =>
          intentReferences[index]
            .collection("dispatchAttempts")
            .doc(attemptId)),
      );
      const attemptSnapshots = attemptReferences.length === 0 ? [] :
        await transaction.getAll(...attemptReferences);
      let attemptOffset = 0;
      const dispatchEvidence: ShiftPlanningNotificationDispatchEvidence[] =
        command.attemptBindings.map((binding, index) => {
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
              "Notification dispatch state is not exactly inactive.",
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
              return failRepository(
                "Dispatch attempt path and command differ.",
              );
            }
            attempts.push(attempt);
          }
          return {intentId: binding.intentId, dispatchState, attempts};
        });
      const attemptedAt = clock();
      if (!(attemptedAt instanceof Timestamp)) {
        return failRepository("Repository clock returned an invalid instant.");
      }
      const attemptedAtMillis = requireNonNegativeInteger(
        attemptedAt.toMillis(),
        "safe-resume attempt instant",
      );
      const safeResume = createShiftPlanningNotificationSafeResume({
        environment: command.environment,
        incidentId: command.incidentId,
        ownerUserId: command.ownerUserId,
        escalationTargetId: command.escalationTargetId,
        deliveryLease,
        marketLease,
        intents: canonicalIntents,
        dispatchEvidence,
        enteredAtMillis: attemptedAtMillis,
        ttlMillis: command.ttlMillis,
      });
      if (
        canonicalIntents.length + safeResume.affectedShiftIds.length > 496
      ) {
        return failRepository(
          "Safe-resume scope cannot be terminalized in one Firestore CAS.",
        );
      }
      const fences = safeResume.affectedShiftIds.map((shiftId) => ({
        reference: firestore.doc(
          `${root}/shiftPlanningNotificationIncidentFences/` +
            shiftPlanningNotificationIncidentShiftFenceId(shiftId),
        ),
        value: createShiftPlanningNotificationIncidentShiftFence({
          safeResume,
          shiftId,
        }),
      }));
      const fenceSnapshots = await transaction.getAll(
        ...fences.map(({reference}) => reference),
      );
      if (fenceSnapshots.some(({exists}) => exists)) {
        return failLeaseConflict(
          "Incident fence scope already contains untracked evidence.",
        );
      }
      const after = nextAuthoritativeState({before, safeResume});
      const record = createRecord({
        command,
        safeResume,
        before,
        after,
        attemptedAtMillis,
      });
      transaction.update(stateReference, after.maintenance);
      transaction.update(deliveryReference, after.rotations.delivery);
      transaction.update(marketReference, after.rotations.market);
      fences.forEach(({reference, value}) =>
        transaction.create(reference, value));
      transaction.create(operationReference, serializeRecord(record));
      return {kind: "committed", record};
    });
  },
});
