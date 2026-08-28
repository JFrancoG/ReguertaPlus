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
  parsePersistedShiftPlanningNotificationSafeResumeRecord,
} from "./shift-planning-firestore-notification-safe-resume-repository.js";
import {
  createShiftPlanningNotificationIncidentShiftFence,
  parseShiftPlanningNotificationIncidentShiftFence,
  sameShiftPlanningNotificationIncidentShiftFence,
  shiftPlanningNotificationIncidentShiftFenceId,
} from "./shift-planning-notification-incident-fence.js";
import {parseShiftPlanningHeldNotificationIntent} from
  "./shift-planning-notification-release.js";
import {
  ShiftPlanningNotificationDispatchEvidence,
  ShiftPlanningNotificationSafeResume,
  ShiftPlanningNotificationTerminalIncident,
  ShiftPlanningNotificationTerminalIncidentCancellation,
  createShiftPlanningNotificationTerminalIncident,
  parseShiftPlanningNotificationSafeResume,
  parseShiftPlanningNotificationTerminalIncident,
} from "./shift-planning-notification-terminal-incident.js";
import {
  ShiftPlanningNotificationTerminalMarker,
  createShiftPlanningNotificationTerminalMarker,
  shiftPlanningNotificationTerminalMarkerPath,
} from "./shift-planning-notification-terminal-marker.js";
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

export const SHIFT_PLANNING_NOTIFICATION_TERMINAL_RECORD_SCHEMA_VERSION =
  1 as const;

export type ShiftPlanningNotificationTerminalAttemptBinding = {
  intentId: string;
  attemptIds: readonly string[];
};

export type ShiftPlanningNotificationTerminalIncidentCommand = {
  schemaVersion:
    typeof SHIFT_PLANNING_NOTIFICATION_TERMINAL_RECORD_SCHEMA_VERSION;
  operationKind: "notificationTerminalIncidentFinalize";
  environment: ShiftPlanningEnvironment;
  incidentId: string;
  bundleRevision: string;
  cancelIntentIds: readonly string[];
  attemptBindings: readonly ShiftPlanningNotificationTerminalAttemptBinding[];
};

export type ShiftPlanningNotificationTerminalMarkerEvidence = {
  intentId: string;
  shiftId: string;
  incidentId: string;
  bundleRevision: string;
  bundleDigest: ShiftPlanningDigest;
  resolution:
    | "cancelledUnsubmitted"
    | "possibleDeliveryCorrectionRequired"
    | "definitivelyFailed";
  attemptIds: readonly string[];
  dispatchEvidenceDigest: ShiftPlanningDigest;
  terminalizedAtMillis: number;
  terminalIncidentDigest: ShiftPlanningDigest;
};

export type ShiftPlanningNotificationTerminalIncidentRecord = {
  schemaVersion:
    typeof SHIFT_PLANNING_NOTIFICATION_TERMINAL_RECORD_SCHEMA_VERSION;
  operationKind: "notificationTerminalIncidentRecord";
  incidentId: string;
  environment: ShiftPlanningEnvironment;
  command: ShiftPlanningNotificationTerminalIncidentCommand;
  commandDigest: ShiftPlanningDigest;
  safeResume: ShiftPlanningNotificationSafeResume;
  terminalIncident: ShiftPlanningNotificationTerminalIncident;
  terminalMarkers: readonly ShiftPlanningNotificationTerminalMarkerEvidence[];
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
  terminalizedAtMillis: number;
  recordDigest: ShiftPlanningDigest;
};

export type ShiftPlanningNotificationTerminalIncidentResult = {
  kind: "committed" | "replayed";
  record: ShiftPlanningNotificationTerminalIncidentRecord;
};

type UnknownRecord = Record<string, unknown>;

const commandFields = [
  "schemaVersion",
  "operationKind",
  "environment",
  "incidentId",
  "bundleRevision",
  "cancelIntentIds",
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
  "terminalIncident",
  "terminalMarkers",
  "authoritativeDigestBefore",
  "authoritativeDigestAfter",
  "maintenanceBefore",
  "maintenanceAfter",
  "rotationsBefore",
  "rotationsAfter",
  "terminalizedAt",
  "recordDigest",
] as const;
const markerEvidenceFields = [
  "intentId",
  "shiftId",
  "incidentId",
  "bundleRevision",
  "bundleDigest",
  "resolution",
  "attemptIds",
  "dispatchEvidenceDigest",
  "terminalizedAtMillis",
  "terminalIncidentDigest",
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
  const ordinal = Number(match[2]);
  if (!Number.isSafeInteger(ordinal)) {
    return failRepository("Notification intent ordinal is unsafe.");
  }
  return ordinal;
};

export const parseShiftPlanningNotificationTerminalIncidentCommand = (
  value: unknown,
): ShiftPlanningNotificationTerminalIncidentCommand => {
  const command = requireRecord(value, "terminal-incident command");
  requireExactFields(command, commandFields, "terminal-incident command");
  if (
    command.schemaVersion !==
      SHIFT_PLANNING_NOTIFICATION_TERMINAL_RECORD_SCHEMA_VERSION ||
    command.operationKind !== "notificationTerminalIncidentFinalize" ||
    !Array.isArray(command.attemptBindings)
  ) {
    return failRepository("Terminal-incident command is invalid.");
  }
  const bundleRevision = requireIdentifier(
    command.bundleRevision,
    "bundleRevision",
  );
  const bindings = command.attemptBindings.map((bindingValue) => {
    const binding = requireRecord(bindingValue, "terminal attempt binding");
    requireExactFields(binding, bindingFields, "terminal attempt binding");
    const intentId = requireIdentifier(binding.intentId, "binding intentId");
    return {
      intentId,
      attemptIds: requireStringArray(binding.attemptIds, "binding attemptIds"),
      ordinal: intentOrdinal(intentId, bundleRevision),
    };
  }).sort((left, right) => left.ordinal - right.ordinal);
  if (
    bindings.length === 0 ||
    new Set(bindings.map(({intentId}) => intentId)).size !== bindings.length ||
    bindings.some(({ordinal}, index) => ordinal !== index + 1)
  ) {
    return failRepository(
      "Terminal attempt bindings are not contiguous and unique.",
    );
  }
  const bindingOrder = new Map(bindings.map(({intentId}, index) => [
    intentId,
    index,
  ]));
  const cancelIntentIds = requireStringArray(
    command.cancelIntentIds,
    "cancel intentIds",
  ).map((intentId) => ({
    intentId,
    index: bindingOrder.get(intentId) ??
      failRepository("Cancelled intent is outside the terminal batch."),
  })).sort((left, right) => left.index - right.index)
    .map(({intentId}) => intentId);
  return {
    schemaVersion: SHIFT_PLANNING_NOTIFICATION_TERMINAL_RECORD_SCHEMA_VERSION,
    operationKind: "notificationTerminalIncidentFinalize",
    environment: requireEnvironment(command.environment),
    incidentId: requireIdentifier(command.incidentId, "incidentId"),
    bundleRevision,
    cancelIntentIds,
    attemptBindings: bindings.map(({intentId, attemptIds}) => ({
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
    return failLeaseConflict(`${type} degraded release lease is missing.`);
  }
  return lease;
};

const nextAuthoritativeState = (input: {
  before: ShiftPlanningAuthoritativeState;
  incidentId: string;
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
      lastTransitionId: input.incidentId,
    }),
    rotations: {
      delivery: parseShiftRotationAggregateWire({
        ...delivery,
        stateRevision: delivery.stateRevision + 1,
        lastIdempotencyKey: input.incidentId,
        releaseLease: null,
      }, "delivery"),
      market: parseShiftRotationAggregateWire({
        ...market,
        stateRevision: market.stateRevision + 1,
        lastIdempotencyKey: input.incidentId,
        releaseLease: null,
      }, "market"),
    },
  });
};

const markerEvidence = (
  marker: ShiftPlanningNotificationTerminalMarker,
): ShiftPlanningNotificationTerminalMarkerEvidence => ({
  intentId: marker.intentId,
  shiftId: marker.shiftId,
  incidentId: marker.incidentId,
  bundleRevision: marker.bundleRevision,
  bundleDigest: marker.bundleDigest,
  resolution: marker.resolution,
  attemptIds: marker.attemptIds,
  dispatchEvidenceDigest: marker.dispatchEvidenceDigest,
  terminalizedAtMillis: marker.terminalizedAt.toMillis(),
  terminalIncidentDigest: marker.terminalIncidentDigest,
});

const parseMarkerEvidence = (
  value: unknown,
): ShiftPlanningNotificationTerminalMarkerEvidence => {
  const evidence = requireRecord(value, "terminal marker evidence");
  requireExactFields(
    evidence,
    markerEvidenceFields,
    "terminal marker evidence",
  );
  if (
    evidence.resolution !== "cancelledUnsubmitted" &&
    evidence.resolution !== "possibleDeliveryCorrectionRequired" &&
    evidence.resolution !== "definitivelyFailed"
  ) {
    return failRepository("Terminal marker resolution is invalid.");
  }
  return {
    intentId: requireIdentifier(evidence.intentId, "marker intentId"),
    shiftId: requireIdentifier(evidence.shiftId, "marker shiftId"),
    incidentId: requireIdentifier(evidence.incidentId, "marker incidentId"),
    bundleRevision: requireIdentifier(
      evidence.bundleRevision,
      "marker bundleRevision",
    ),
    bundleDigest: requireDigest(evidence.bundleDigest, "marker bundleDigest"),
    resolution: evidence.resolution,
    attemptIds: requireStringArray(evidence.attemptIds, "marker attemptIds"),
    dispatchEvidenceDigest: requireDigest(
      evidence.dispatchEvidenceDigest,
      "marker dispatch evidence digest",
    ),
    terminalizedAtMillis: requireNonNegativeInteger(
      evidence.terminalizedAtMillis,
      "marker terminal instant",
    ),
    terminalIncidentDigest: requireDigest(
      evidence.terminalIncidentDigest,
      "marker terminal incident digest",
    ),
  };
};

const recordDigestCore = (
  record: Omit<ShiftPlanningNotificationTerminalIncidentRecord,
    "recordDigest">,
): object => record;

const createRecord = (input: {
  command: ShiftPlanningNotificationTerminalIncidentCommand;
  safeResume: ShiftPlanningNotificationSafeResume;
  terminalIncident: ShiftPlanningNotificationTerminalIncident;
  terminalMarkers: readonly ShiftPlanningNotificationTerminalMarker[];
  before: ShiftPlanningAuthoritativeState;
  after: ShiftPlanningAuthoritativeState;
}): ShiftPlanningNotificationTerminalIncidentRecord => {
  const recordWithoutDigest = {
    schemaVersion: SHIFT_PLANNING_NOTIFICATION_TERMINAL_RECORD_SCHEMA_VERSION,
    operationKind: "notificationTerminalIncidentRecord" as const,
    incidentId: input.command.incidentId,
    environment: input.command.environment,
    command: input.command,
    commandDigest: createShiftPlanningDigest(input.command),
    safeResume: input.safeResume,
    terminalIncident: input.terminalIncident,
    terminalMarkers: input.terminalMarkers.map(markerEvidence),
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
    terminalizedAtMillis: input.terminalIncident.terminalizedAtMillis,
  };
  return {
    ...recordWithoutDigest,
    recordDigest: createShiftPlanningDigest(
      recordDigestCore(recordWithoutDigest),
    ),
  };
};

const serializeRecord = (
  record: ShiftPlanningNotificationTerminalIncidentRecord,
): object => {
  const {terminalizedAtMillis, ...persisted} = record;
  return {
    ...persisted,
    terminalizedAt: Timestamp.fromMillis(terminalizedAtMillis),
  };
};

const parsePersistedRecord = (
  snapshot: DocumentSnapshot,
): ShiftPlanningNotificationTerminalIncidentRecord => {
  const data = requireRecord(
    requireSnapshot(snapshot, "terminal incident record").data(),
    "terminal incident record",
  );
  requireExactFields(data, recordFields, "terminal incident record");
  if (
    data.schemaVersion !==
      SHIFT_PLANNING_NOTIFICATION_TERMINAL_RECORD_SCHEMA_VERSION ||
    data.operationKind !== "notificationTerminalIncidentRecord" ||
    !(data.terminalizedAt instanceof Timestamp) ||
    !Array.isArray(data.terminalMarkers)
  ) {
    return failRepository("Terminal incident record is invalid.");
  }
  const command = parseShiftPlanningNotificationTerminalIncidentCommand(
    data.command,
  );
  const terminalIncident = parseShiftPlanningNotificationTerminalIncident(
    data.terminalIncident,
  );
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
    schemaVersion: SHIFT_PLANNING_NOTIFICATION_TERMINAL_RECORD_SCHEMA_VERSION,
    operationKind: "notificationTerminalIncidentRecord" as const,
    incidentId: requireIdentifier(data.incidentId, "incidentId"),
    environment: requireEnvironment(data.environment),
    command,
    commandDigest: requireDigest(data.commandDigest, "command digest"),
    safeResume,
    terminalIncident,
    terminalMarkers: data.terminalMarkers.map(parseMarkerEvidence),
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
    terminalizedAtMillis: data.terminalizedAt.toMillis(),
  };
  const recordDigest = requireDigest(data.recordDigest, "record digest");
  const expectedAfter = nextAuthoritativeState({
    before,
    incidentId: command.incidentId,
  });
  const deliveryLease = pairedLease(before, "delivery");
  const marketLease = pairedLease(before, "market");
  const expectedMarkers = terminalIncident.intents.map((intent) =>
    markerEvidence(createShiftPlanningNotificationTerminalMarker({
      terminalIncident,
      intent,
    })));
  if (
    recordWithoutDigest.incidentId !== command.incidentId ||
    recordWithoutDigest.environment !== command.environment ||
    terminalIncident.incidentId !== command.incidentId ||
    terminalIncident.environment !== command.environment ||
    terminalIncident.bundleRevision !== command.bundleRevision ||
    terminalIncident.terminalizedAtMillis !==
      recordWithoutDigest.terminalizedAtMillis ||
    safeResume.incidentId !== command.incidentId ||
    safeResume.environment !== command.environment ||
    safeResume.bundleRevision !== command.bundleRevision ||
    terminalIncident.ownerUserId !== safeResume.ownerUserId ||
    terminalIncident.escalationTargetId !== safeResume.escalationTargetId ||
    terminalIncident.terminalizedAtMillis < safeResume.expiresAtMillis ||
    !sameValue(
      terminalIncident.releaseLeaseActions.map(({expectedLease}) =>
        expectedLease),
      safeResume.releaseLeaseActions.map(({replacementLease}) =>
        replacementLease),
    ) ||
    !sameValue(
      terminalIncident.intents.map(({intentId, shiftId}) => ({
        intentId,
        shiftId,
      })),
      safeResume.intents.map(({intentId, shiftId}) => ({intentId, shiftId})),
    ) ||
    !sameValue(
      terminalIncident.releaseLeaseActions[0].expectedLease,
      deliveryLease,
    ) ||
    !sameValue(
      terminalIncident.releaseLeaseActions[1].expectedLease,
      marketLease,
    ) ||
    !sameValue(terminalIncident.cancelledIntentIds, command.cancelIntentIds) ||
    !sameValue(
      terminalIncident.intents.map(({intentId, attemptIds}) => ({
        intentId,
        attemptIds,
      })),
      command.attemptBindings,
    ) ||
    !sameValue(recordWithoutDigest.terminalMarkers, expectedMarkers) ||
    createShiftPlanningDigest(command) !== recordWithoutDigest.commandDigest ||
    before.authoritativeDigest !==
      recordWithoutDigest.authoritativeDigestBefore ||
    after.authoritativeDigest !==
      recordWithoutDigest.authoritativeDigestAfter ||
    !sameValue(after, expectedAfter) ||
    createShiftPlanningDigest(recordDigestCore(recordWithoutDigest)) !==
      recordDigest
  ) {
    return failRepository("Terminal incident record evidence is inconsistent.");
  }
  return {...recordWithoutDigest, recordDigest};
};

/**
 * Terminalizes one expired degraded notification incident in a single CAS.
 * Every intent receives a terminal marker, every exact incident fence is
 * removed, both leases clear together, and immutable replay evidence remains.
 * @param {Firestore} firestore Backend-owned Firestore or emulator authority.
 * @param {function(): Timestamp} clock Trusted terminalization clock.
 * @return {object} Idempotent terminal-incident repository.
 */
export const createFirestoreShiftPlanningNotificationTerminalRepository = (
  firestore: Firestore,
  clock: () => Timestamp = () => Timestamp.now(),
) => ({
  async terminalize(
    commandValue: ShiftPlanningNotificationTerminalIncidentCommand,
  ): Promise<ShiftPlanningNotificationTerminalIncidentResult> {
    const command = parseShiftPlanningNotificationTerminalIncidentCommand(
      commandValue,
    );
    const commandDigest = createShiftPlanningDigest(command);
    const root = `${command.environment}/plus-collections`;
    const operationReference = firestore.doc(
      `${root}/shiftPlanningOperations/` +
        `notification-terminal-${command.incidentId}`,
    );
    return firestore.runTransaction(async (transaction) => {
      const operationSnapshot = await transaction.get(operationReference);
      if (operationSnapshot.exists) {
        const record = parsePersistedRecord(operationSnapshot);
        if (record.commandDigest !== commandDigest) {
          throw new ShiftPlanningError(
            "request_intent_conflict",
            "Incident ID is bound to another terminal command.",
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
      const safeResumeReference = firestore.doc(
        `${root}/shiftPlanningOperations/` +
          `notification-safe-resume-${command.incidentId}`,
      );
      const [
        stateSnapshot,
        deliverySnapshot,
        marketSnapshot,
        bundleSnapshot,
        safeResumeSnapshot,
      ] = await transaction.getAll(
        stateReference,
        deliveryReference,
        marketReference,
        bundleReference,
        safeResumeReference,
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
      const safeResumeRecord =
        parsePersistedShiftPlanningNotificationSafeResumeRecord(
          safeResumeSnapshot,
        );
      const safeResume = safeResumeRecord.safeResume;
      const bundle = parsePersistedBundle(
        requireSnapshot(bundleSnapshot, "persisted bundle").data(),
      );
      const deliveryLease = pairedLease(before, "delivery");
      const marketLease = pairedLease(before, "market");
      if (
        safeResumeRecord.environment !== command.environment ||
        safeResume.incidentId !== command.incidentId ||
        safeResume.bundleRevision !== command.bundleRevision ||
        !sameValue(before.maintenance, safeResumeRecord.maintenanceAfter) ||
        !sameValue(before.rotations, safeResumeRecord.rotationsAfter) ||
        bundle.environment !== command.environment ||
        bundle.bundleId !== safeResume.bundleId ||
        bundle.bundleRevision !== command.bundleRevision ||
        before.maintenance.activeRevision !== bundle.bundleRevision ||
        before.maintenance.activeDigest !== bundle.bundleDigest ||
        bundle.artifact.activationWriteEpoch !== safeResume.writeEpoch ||
        !sameValue(
          deliveryLease,
          safeResume.releaseLeaseActions[0].replacementLease,
        ) ||
        !sameValue(
          marketLease,
          safeResume.releaseLeaseActions[1].replacementLease,
        )
      ) {
        return failLeaseConflict(
          "Degraded planning lineage does not own the terminal incident.",
        );
      }

      const canonicalIntents = bundle.artifact.heldNotificationIntents.map(
        parseShiftPlanningHeldNotificationIntent,
      );
      const queriedIntents = await transaction.get(firestore.collection(
        `${root}/shiftPlanningNotificationIntents`,
      ).where("bundleRevision", "==", command.bundleRevision));
      if (
        canonicalIntents.length !== command.attemptBindings.length ||
        queriedIntents.size !== canonicalIntents.length
      ) {
        return failLeaseConflict(
          "Persisted intent set differs from the terminal bundle.",
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
            "Persisted terminal intent differs from its canonical bundle.",
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
              "Terminal dispatch state is not exactly inactive.",
            );
          }
          const attempts: ShiftPlanningNotificationDispatchAttempt[] = [];
          for (const attemptId of binding.attemptIds) {
            const snapshot = requireSnapshot(
              attemptSnapshots[attemptOffset],
              "terminal dispatch attempt",
            );
            attemptOffset += 1;
            const attempt = parseShiftPlanningNotificationDispatchAttempt(
              snapshot.data(),
            );
            if (snapshot.id !== attemptId) {
              return failRepository(
                "Terminal attempt path and command differ.",
              );
            }
            attempts.push(attempt);
          }
          return {intentId: binding.intentId, dispatchState, attempts};
        });

      const fenceEntries = safeResume.affectedShiftIds.map((shiftId) => ({
        reference: firestore.doc(
          `${root}/shiftPlanningNotificationIncidentFences/` +
            shiftPlanningNotificationIncidentShiftFenceId(shiftId),
        ),
        expected: createShiftPlanningNotificationIncidentShiftFence({
          safeResume,
          shiftId,
        }),
      }));
      const markerReferences = canonicalIntents.map((intent) => firestore.doc(
        `${root}/${shiftPlanningNotificationTerminalMarkerPath(
          intent.intentId,
        )}`,
      ));
      const fenceSnapshots = await transaction.getAll(
        ...fenceEntries.map(({reference}) => reference),
      );
      const markerSnapshots = await transaction.getAll(...markerReferences);
      if (markerSnapshots.some(({exists}) => exists)) {
        return failLeaseConflict(
          "Terminal marker scope already contains untracked evidence.",
        );
      }
      fenceSnapshots.forEach((snapshot, index) => {
        const persisted = parseShiftPlanningNotificationIncidentShiftFence(
          requireSnapshot(snapshot, "incident shift fence").data(),
        );
        if (!sameShiftPlanningNotificationIncidentShiftFence(
          persisted,
          fenceEntries[index].expected,
        )) {
          failLeaseConflict("Incident shift fence drifted before cleanup.");
        }
      });

      const terminalizedAt = clock();
      if (!(terminalizedAt instanceof Timestamp)) {
        return failRepository("Repository clock returned an invalid instant.");
      }
      const terminalizedAtMillis = requireNonNegativeInteger(
        terminalizedAt.toMillis(),
        "terminal incident instant",
      );
      const cancellations:
        ShiftPlanningNotificationTerminalIncidentCancellation[] =
          command.cancelIntentIds.map((intentId) => ({
            action: "cancelAndSupersede",
            intentId,
            incidentId: command.incidentId,
            cancelledAtMillis: terminalizedAtMillis,
          }));
      const terminalIncident = createShiftPlanningNotificationTerminalIncident({
        safeResume,
        deliveryLease,
        marketLease,
        intents: canonicalIntents,
        dispatchEvidence,
        cancellations,
        terminalizedAtMillis,
      });
      const terminalMarkers = terminalIncident.intents.map((intent) =>
        createShiftPlanningNotificationTerminalMarker({
          terminalIncident,
          intent,
        }));
      if (terminalMarkers.length + fenceEntries.length > 496) {
        return failRepository(
          "Terminal incident exceeds one Firestore CAS write budget.",
        );
      }
      const after = nextAuthoritativeState({
        before,
        incidentId: command.incidentId,
      });
      const record = createRecord({
        command,
        safeResume,
        terminalIncident,
        terminalMarkers,
        before,
        after,
      });
      transaction.update(stateReference, after.maintenance);
      transaction.update(deliveryReference, after.rotations.delivery);
      transaction.update(marketReference, after.rotations.market);
      terminalMarkers.forEach((marker, index) =>
        transaction.create(markerReferences[index], marker));
      fenceEntries.forEach(({reference}) => transaction.delete(reference));
      transaction.create(operationReference, serializeRecord(record));
      return {kind: "committed", record};
    });
  },
});
