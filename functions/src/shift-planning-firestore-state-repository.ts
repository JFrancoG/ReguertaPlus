import {
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  Timestamp,
  Transaction,
} from "firebase-admin/firestore";
import {
  ShiftPlanningError,
} from "./shift-planning-contract.js";
import {
  createShiftPlanningDigest,
} from "./shift-planning-digest.js";
import {
  SHIFT_PLANNING_STATE_PERSISTENCE_SCHEMA_VERSION,
  ShiftPlanningAbortPreActivationCommand,
  ShiftPlanningAuthoritativeState,
  ShiftPlanningEnterMaintenanceCommand,
  ShiftPlanningMaintenanceCas,
  ShiftPlanningMaintenanceTransitionIntent,
  ShiftPlanningMaintenanceTransitionRecord,
  ShiftPlanningMaintenanceTransitionResult,
  ShiftPlanningStatePersistence,
  buildShiftPlanningAuthoritativeState,
} from "./shift-planning-state-persistence.js";
import {
  ShiftPlanningEnvironment,
  ShiftPlanningIntakeBarrier,
  ShiftPlanningMaintenanceState,
} from "./shift-planning-wire.js";

type UnknownRecord = Record<string, unknown>;

const transitionRecordKeys = [
  "schemaVersion",
  "operationKind",
  "transitionId",
  "environment",
  "action",
  "intent",
  "intentDigest",
  "rotations",
  "maintenanceBefore",
  "maintenanceAfter",
  "authoritativeDigestBefore",
  "authoritativeDigestAfter",
  "committedAt",
] as const;

const maintenanceCasKeys = [
  "action",
  "environment",
  "transitionId",
  "expectedAuthoritativeDigest",
  "expectedStateRevision",
  "expectedWriteEpoch",
  "expectedActiveRevision",
  "expectedActiveDigest",
] as const;

const enterMaintenanceKeys = [
  ...maintenanceCasKeys,
  "intakeBarrier",
] as const;

const abortMaintenanceKeys = [
  ...maintenanceCasKeys,
  "expectedMaintenanceEntryTransitionId",
] as const;

const failState = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_state", message);
};

const failMaintenanceConflict = (message: string): never => {
  throw new ShiftPlanningError("maintenance_state_conflict", message);
};

const requireRecord = (value: unknown, name: string): UnknownRecord => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return failState(`${name} must be a plain object.`);
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
    failState(`${name} fields are not exact.`);
  }
};

const requireEnvironment = (value: unknown): ShiftPlanningEnvironment => {
  if (value !== "develop" && value !== "production") {
    return failState("Planning environment is invalid.");
  }
  return value;
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failState(`${name} is not a valid identifier.`);
  }
  return value;
};

const requireDigest = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return failState(`${name} is not a planning digest.`);
  }
  return value;
};

const requireNonNegativeInteger = (value: unknown, name: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return failState(`${name} must be a non-negative safe integer.`);
  }
  return value as number;
};

const requireNullableRevision = (value: unknown): string | null =>
  value === null ? null : requireIdentifier(value, "active revision");

const requireNullableDigest = (value: unknown): string | null =>
  value === null ? null : requireDigest(value, "active digest");

const requireActiveLineage = (
  revisionValue: unknown,
  digestValue: unknown,
): {revision: string | null; digest: string | null} => {
  const revision = requireNullableRevision(revisionValue);
  const digest = requireNullableDigest(digestValue);
  if ((revision === null) !== (digest === null)) {
    return failState("Active revision and digest must change together.");
  }
  return {revision, digest};
};

const requireIntakeBarrier = (
  value: unknown,
): ShiftPlanningIntakeBarrier => {
  const barrier = requireRecord(value, "intake barrier");
  requireExactKeys(
    barrier,
    ["revision", "digest", "verifiedAtMillis"],
    "intake barrier",
  );
  return {
    revision: requireIdentifier(barrier.revision, "barrier revision"),
    digest: requireDigest(barrier.digest, "barrier digest"),
    verifiedAtMillis: requireNonNegativeInteger(
      barrier.verifiedAtMillis,
      "barrier verification instant",
    ),
  };
};

const normalizeMaintenanceCas = (
  value: UnknownRecord,
): ShiftPlanningMaintenanceCas => {
  const active = requireActiveLineage(
    value.expectedActiveRevision,
    value.expectedActiveDigest,
  );
  return {
    environment: requireEnvironment(value.environment),
    transitionId: requireIdentifier(value.transitionId, "transitionId"),
    expectedAuthoritativeDigest: requireDigest(
      value.expectedAuthoritativeDigest,
      "expected authoritative digest",
    ),
    expectedStateRevision: requireNonNegativeInteger(
      value.expectedStateRevision,
      "expected state revision",
    ),
    expectedWriteEpoch: requireNonNegativeInteger(
      value.expectedWriteEpoch,
      "expected write epoch",
    ),
    expectedActiveRevision: active.revision,
    expectedActiveDigest: active.digest,
  };
};

const normalizeTransitionIntent = (
  value: unknown,
): ShiftPlanningMaintenanceTransitionIntent => {
  const intent = requireRecord(value, "maintenance transition intent");
  if (intent.action === "enterMaintenance") {
    requireExactKeys(
      intent,
      enterMaintenanceKeys,
      "enter-maintenance intent",
    );
    return {
      ...normalizeMaintenanceCas(intent),
      action: "enterMaintenance",
      intakeBarrier: requireIntakeBarrier(intent.intakeBarrier),
    };
  }
  if (intent.action === "abortPreActivationMaintenance") {
    requireExactKeys(
      intent,
      abortMaintenanceKeys,
      "abort-maintenance intent",
    );
    return {
      ...normalizeMaintenanceCas(intent),
      action: "abortPreActivationMaintenance",
      expectedMaintenanceEntryTransitionId: requireIdentifier(
        intent.expectedMaintenanceEntryTransitionId,
        "expected maintenance-entry transitionId",
      ),
    };
  }
  return failState("Maintenance transition action is invalid.");
};

const planningRoot = (environment: ShiftPlanningEnvironment): string =>
  `${environment}/plus-collections`;

const stateReference = (
  firestore: Firestore,
  environment: ShiftPlanningEnvironment,
): DocumentReference => firestore.doc(
  `${planningRoot(environment)}/shiftPlanningState/current`,
);

const rotationReference = (
  firestore: Firestore,
  environment: ShiftPlanningEnvironment,
  type: "delivery" | "market",
): DocumentReference => firestore.doc(
  `${planningRoot(environment)}/shiftRotations/${type}`,
);

const operationReference = (
  firestore: Firestore,
  environment: ShiftPlanningEnvironment,
  transitionId: string,
): DocumentReference => firestore.doc(
  `${planningRoot(environment)}/shiftPlanningOperations/` +
  `state-${transitionId}`,
);

const requireSnapshotData = (
  snapshot: DocumentSnapshot,
  name: string,
): unknown => {
  if (!snapshot.exists) {
    return failState(`${name} does not exist.`);
  }
  return snapshot.data();
};

const readAuthoritativeState = async (
  transaction: Transaction,
  firestore: Firestore,
  environment: ShiftPlanningEnvironment,
): Promise<ShiftPlanningAuthoritativeState> => {
  const [maintenanceSnapshot, deliverySnapshot, marketSnapshot] =
    await Promise.all([
      transaction.get(stateReference(firestore, environment)),
      transaction.get(rotationReference(firestore, environment, "delivery")),
      transaction.get(rotationReference(firestore, environment, "market")),
    ]);
  return buildShiftPlanningAuthoritativeState({
    environment,
    maintenance: requireSnapshotData(
      maintenanceSnapshot,
      "planning maintenance state",
    ),
    rotations: {
      delivery: requireSnapshotData(
        deliverySnapshot,
        "delivery rotation state",
      ),
      market: requireSnapshotData(marketSnapshot, "market rotation state"),
    },
  });
};

const assertTransitionShape = (
  record: ShiftPlanningMaintenanceTransitionRecord,
): void => {
  const before = record.maintenanceBefore;
  const after = record.maintenanceAfter;
  const intent = record.intent;
  const authoritativeBefore = buildShiftPlanningAuthoritativeState({
    environment: record.environment,
    maintenance: before,
    rotations: record.rotations,
  });
  const authoritativeAfter = buildShiftPlanningAuthoritativeState({
    environment: record.environment,
    maintenance: after,
    rotations: record.rotations,
  });
  if (
    before.stateRevision !== intent.expectedStateRevision ||
    before.writeEpoch !== intent.expectedWriteEpoch ||
    before.activeRevision !== intent.expectedActiveRevision ||
    before.activeDigest !== intent.expectedActiveDigest ||
    record.authoritativeDigestBefore !==
      intent.expectedAuthoritativeDigest ||
    record.authoritativeDigestBefore !==
      authoritativeBefore.authoritativeDigest ||
    record.authoritativeDigestAfter !==
      authoritativeAfter.authoritativeDigest ||
    before.stateRevision === Number.MAX_SAFE_INTEGER ||
    before.writeEpoch === Number.MAX_SAFE_INTEGER ||
    after.stateRevision !== before.stateRevision + 1 ||
    after.writeEpoch !== before.writeEpoch + 1 ||
    after.activeRevision !== before.activeRevision ||
    after.activeDigest !== before.activeDigest ||
    after.lastTransitionId !== record.transitionId
  ) {
    failState("Persisted maintenance transition is inconsistent.");
  }
  if (
    intent.action === "enterMaintenance" &&
    (
      before.maintenanceStatus !== "open" ||
      before.intakeBarrier !== null ||
      after.maintenanceStatus !== "closed" ||
      after.intakeBarrier === null ||
      intent.intakeBarrier.verifiedAtMillis > record.committedAtMillis ||
      createShiftPlanningDigest(after.intakeBarrier) !==
        createShiftPlanningDigest(intent.intakeBarrier)
    )
  ) {
    failState("Persisted maintenance-entry transition is inconsistent.");
  }
  if (
    intent.action === "abortPreActivationMaintenance" &&
    (
      before.maintenanceStatus !== "closed" ||
      before.intakeBarrier === null ||
      before.lastTransitionId !==
        intent.expectedMaintenanceEntryTransitionId ||
      record.rotations.delivery.releaseLease !== null ||
      record.rotations.market.releaseLease !== null ||
      after.maintenanceStatus !== "open" ||
      after.intakeBarrier !== null
    )
  ) {
    failState("Persisted maintenance-abort transition is inconsistent.");
  }
};

const parseTransitionRecord = (
  snapshot: DocumentSnapshot,
): ShiftPlanningMaintenanceTransitionRecord => {
  const data = requireRecord(
    requireSnapshotData(snapshot, "maintenance transition"),
    "maintenance transition",
  );
  requireExactKeys(data, transitionRecordKeys, "maintenance transition");
  if (
    data.schemaVersion !== SHIFT_PLANNING_STATE_PERSISTENCE_SCHEMA_VERSION ||
    data.operationKind !== "maintenanceTransition" ||
    !(data.committedAt instanceof Timestamp)
  ) {
    return failState("Maintenance transition discriminator is invalid.");
  }
  const intent = normalizeTransitionIntent(data.intent);
  const transitionId = requireIdentifier(data.transitionId, "transitionId");
  const environment = requireEnvironment(data.environment);
  const action = data.action;
  const intentDigest = requireDigest(data.intentDigest, "intent digest");
  const committedAtMillis = requireNonNegativeInteger(
    data.committedAt.toMillis(),
    "transition commit instant",
  );
  if (
    action !== intent.action ||
    transitionId !== intent.transitionId ||
    environment !== intent.environment ||
    createShiftPlanningDigest(intent) !== intentDigest
  ) {
    return failState("Maintenance transition intent is inconsistent.");
  }
  const before = buildShiftPlanningAuthoritativeState({
    environment,
    maintenance: data.maintenanceBefore,
    rotations: data.rotations,
  });
  const after = buildShiftPlanningAuthoritativeState({
    environment,
    maintenance: data.maintenanceAfter,
    rotations: data.rotations,
  });
  const record: ShiftPlanningMaintenanceTransitionRecord = {
    schemaVersion: SHIFT_PLANNING_STATE_PERSISTENCE_SCHEMA_VERSION,
    operationKind: "maintenanceTransition",
    transitionId,
    environment,
    action: intent.action,
    intent,
    intentDigest,
    rotations: before.rotations,
    maintenanceBefore: before.maintenance,
    maintenanceAfter: after.maintenance,
    authoritativeDigestBefore: requireDigest(
      data.authoritativeDigestBefore,
      "authoritative digest before",
    ),
    authoritativeDigestAfter: requireDigest(
      data.authoritativeDigestAfter,
      "authoritative digest after",
    ),
    committedAtMillis,
  };
  assertTransitionShape(record);
  return record;
};

const requirePreActivationAbortAuthority = async (
  transaction: Transaction,
  firestore: Firestore,
  intent: ShiftPlanningAbortPreActivationCommand,
  current: ShiftPlanningAuthoritativeState,
): Promise<void> => {
  if (
    current.maintenance.lastTransitionId !==
      intent.expectedMaintenanceEntryTransitionId ||
    current.rotations.delivery.releaseLease !== null ||
    current.rotations.market.releaseLease !== null
  ) {
    return failMaintenanceConflict(
      "Planning state is not an abortable pre-activation entry.",
    );
  }
  const entrySnapshot = await transaction.get(operationReference(
    firestore,
    intent.environment,
    intent.expectedMaintenanceEntryTransitionId,
  ));
  if (!entrySnapshot.exists) {
    return failMaintenanceConflict(
      "Maintenance-entry evidence is not persisted.",
    );
  }
  const entry = parseTransitionRecord(entrySnapshot);
  if (
    entry.environment !== intent.environment ||
    entry.transitionId !== intent.expectedMaintenanceEntryTransitionId ||
    entry.action !== "enterMaintenance" ||
    entry.authoritativeDigestAfter !== current.authoritativeDigest
  ) {
    return failMaintenanceConflict(
      "Maintenance-entry evidence does not own the current state.",
    );
  }
};

const requireAbortReplayEntryEvidence = async (
  transaction: Transaction,
  firestore: Firestore,
  record: ShiftPlanningMaintenanceTransitionRecord,
): Promise<void> => {
  if (record.intent.action !== "abortPreActivationMaintenance") return;
  const entrySnapshot = await transaction.get(operationReference(
    firestore,
    record.environment,
    record.intent.expectedMaintenanceEntryTransitionId,
  ));
  if (!entrySnapshot.exists) {
    return failState("Abort replay lost its maintenance-entry evidence.");
  }
  const entry = parseTransitionRecord(entrySnapshot);
  if (
    entry.environment !== record.environment ||
    entry.transitionId !==
      record.intent.expectedMaintenanceEntryTransitionId ||
    entry.action !== "enterMaintenance" ||
    entry.authoritativeDigestAfter !== record.authoritativeDigestBefore
  ) {
    return failState("Abort replay maintenance-entry evidence is invalid.");
  }
};

const serializeTransitionRecord = (
  record: ShiftPlanningMaintenanceTransitionRecord,
): object => {
  const {committedAtMillis, ...persisted} = record;
  return {
    ...persisted,
    committedAt: Timestamp.fromMillis(committedAtMillis),
  };
};

const assertCas = (
  command: ShiftPlanningMaintenanceCas,
  current: ShiftPlanningAuthoritativeState,
): void => {
  if (current.maintenance.writeEpoch !== command.expectedWriteEpoch) {
    throw new ShiftPlanningError(
      "stale_write_epoch",
      "Planning write epoch changed before maintenance transition.",
    );
  }
  if (
    current.maintenance.activeRevision !== command.expectedActiveRevision ||
    current.maintenance.activeDigest !== command.expectedActiveDigest
  ) {
    throw new ShiftPlanningError(
      "stale_active_revision",
      "Active planning lineage changed before maintenance transition.",
    );
  }
  if (
    current.maintenance.stateRevision !== command.expectedStateRevision ||
    current.authoritativeDigest !== command.expectedAuthoritativeDigest
  ) {
    failMaintenanceConflict(
      "Authoritative planning state changed before maintenance transition.",
    );
  }
};

const advanceMaintenanceState = (
  current: ShiftPlanningMaintenanceState,
  intent: ShiftPlanningMaintenanceTransitionIntent,
): ShiftPlanningMaintenanceState => {
  if (
    current.stateRevision === Number.MAX_SAFE_INTEGER ||
    current.writeEpoch === Number.MAX_SAFE_INTEGER
  ) {
    return failMaintenanceConflict("Maintenance revision cannot advance.");
  }
  if (
    intent.action === "enterMaintenance" &&
    (current.maintenanceStatus !== "open" || current.intakeBarrier !== null)
  ) {
    return failMaintenanceConflict("Planning maintenance is not open.");
  }
  if (
    intent.action === "abortPreActivationMaintenance" &&
    (current.maintenanceStatus !== "closed" || current.intakeBarrier === null)
  ) {
    return failMaintenanceConflict("Planning maintenance is not closed.");
  }
  return {
    ...current,
    stateRevision: current.stateRevision + 1,
    writeEpoch: current.writeEpoch + 1,
    maintenanceStatus: intent.action === "enterMaintenance" ?
      "closed" : "open",
    intakeBarrier: intent.action === "enterMaintenance" ?
      intent.intakeBarrier : null,
    lastTransitionId: intent.transitionId,
  };
};

const transitionRecord = (input: {
  intent: ShiftPlanningMaintenanceTransitionIntent;
  before: ShiftPlanningAuthoritativeState;
  after: ShiftPlanningAuthoritativeState;
  committedAtMillis: number;
}): ShiftPlanningMaintenanceTransitionRecord => ({
  schemaVersion: SHIFT_PLANNING_STATE_PERSISTENCE_SCHEMA_VERSION,
  operationKind: "maintenanceTransition",
  transitionId: input.intent.transitionId,
  environment: input.intent.environment,
  action: input.intent.action,
  intent: input.intent,
  intentDigest: createShiftPlanningDigest(input.intent),
  rotations: input.before.rotations,
  maintenanceBefore: input.before.maintenance,
  maintenanceAfter: input.after.maintenance,
  authoritativeDigestBefore: input.before.authoritativeDigest,
  authoritativeDigestAfter: input.after.authoritativeDigest,
  committedAtMillis: input.committedAtMillis,
});

/**
 * Builds the private authoritative-state adapter. Missing state fails closed;
 * the adapter neither bootstraps documents nor verifies the external barrier.
 * @param {Firestore} firestore Backend-owned Firestore connection.
 * @param {function(): Timestamp} clock Injected transition clock.
 * @return {ShiftPlanningStatePersistence} Fail-closed state persistence port.
 */
export const createFirestoreShiftPlanningStateRepository = (
  firestore: Firestore,
  clock: () => Timestamp = () => Timestamp.now(),
): ShiftPlanningStatePersistence => {
  const readClockMillis = (): number => {
    const instant = clock();
    if (!(instant instanceof Timestamp)) {
      return failState("Repository clock returned an invalid instant.");
    }
    const value = instant.toMillis();
    return requireNonNegativeInteger(value, "repository clock");
  };

  const loadAuthoritativeState = async (input: {
    environment: ShiftPlanningEnvironment;
  }): Promise<ShiftPlanningAuthoritativeState> => {
    const environment = requireEnvironment(input.environment);
    return firestore.runTransaction((transaction) =>
      readAuthoritativeState(transaction, firestore, environment));
  };

  const executeTransition = async (
    commandValue: ShiftPlanningMaintenanceTransitionIntent,
  ): Promise<ShiftPlanningMaintenanceTransitionResult> => {
    const intent = normalizeTransitionIntent(commandValue);
    const intentDigest = createShiftPlanningDigest(intent);
    return firestore.runTransaction(async (transaction) => {
      const operation = operationReference(
        firestore,
        intent.environment,
        intent.transitionId,
      );
      const operationSnapshot = await transaction.get(operation);
      if (operationSnapshot.exists) {
        const persisted = parseTransitionRecord(operationSnapshot);
        if (persisted.intentDigest !== intentDigest) {
          throw new ShiftPlanningError(
            "request_intent_conflict",
            "Maintenance transition ID is bound to another intent.",
          );
        }
        await requireAbortReplayEntryEvidence(
          transaction,
          firestore,
          persisted,
        );
        return {kind: "replayed", transition: persisted};
      }
      const before = await readAuthoritativeState(
        transaction,
        firestore,
        intent.environment,
      );
      assertCas(intent, before);
      if (intent.action === "abortPreActivationMaintenance") {
        await requirePreActivationAbortAuthority(
          transaction,
          firestore,
          intent,
          before,
        );
      }
      const maintenanceAfter = advanceMaintenanceState(
        before.maintenance,
        intent,
      );
      const after = buildShiftPlanningAuthoritativeState({
        environment: intent.environment,
        maintenance: maintenanceAfter,
        rotations: before.rotations,
      });
      const committedAtMillis = readClockMillis();
      if (
        intent.action === "enterMaintenance" &&
        intent.intakeBarrier.verifiedAtMillis > committedAtMillis
      ) {
        return failMaintenanceConflict(
          "Intake barrier cannot be verified after the transition.",
        );
      }
      const record = transitionRecord({
        intent,
        before,
        after,
        committedAtMillis,
      });
      transaction.update(
        stateReference(firestore, intent.environment),
        maintenanceAfter,
      );
      transaction.create(operation, serializeTransitionRecord(record));
      return {kind: "committed", transition: record};
    });
  };

  const enterMaintenanceWithBarrierEvidence = (
    command: ShiftPlanningEnterMaintenanceCommand,
  ): Promise<ShiftPlanningMaintenanceTransitionResult> =>
    executeTransition(command);

  const abortPreActivationMaintenance = (
    command: ShiftPlanningAbortPreActivationCommand,
  ): Promise<ShiftPlanningMaintenanceTransitionResult> =>
    executeTransition(command);

  return {
    loadAuthoritativeState,
    enterMaintenanceWithBarrierEvidence,
    abortPreActivationMaintenance,
  };
};
