import {
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  Timestamp,
} from "firebase-admin/firestore";
import {
  ShiftPlanningError,
} from "./shift-planning-contract.js";
import {
  canonicalShiftPlanningJson,
  ShiftPlanningDigest,
} from "./shift-planning-digest.js";
import {
  parseShiftPlanningIntakeBarrierEvidenceEnvelope,
  ShiftPlanningIntakeBarrierEvidenceEnvelope,
  ShiftPlanningIntakeBarrierEvidenceKey,
  ShiftPlanningIntakeBarrierEvidencePersistence,
  ShiftPlanningIntakeBarrierEvidenceRetentionRequest,
} from "./shift-planning-intake-barrier.js";
import {
  createShiftPlanningIntakeBarrierFailureClosureRecord,
  ShiftPlanningIntakeBarrierFailureClosurePersistence,
  ShiftPlanningIntakeBarrierFailureClosureRecord,
  ShiftPlanningIntakeBarrierFailureClosureRequest,
} from "./shift-planning-trusted-intake-barrier-adapter.js";
import {
  ShiftPlanningEnvironment,
} from "./shift-planning-wire.js";

const INTAKE_BARRIER_REPOSITORY_SCHEMA_VERSION = 1 as const;

type UnknownRecord = Record<string, unknown>;

type PersistedIntakeBarrierEvidence = {
  schemaVersion: typeof INTAKE_BARRIER_REPOSITORY_SCHEMA_VERSION;
  operationKind: "intakeBarrierEvidence";
  environment: ShiftPlanningEnvironment;
  transitionId: string;
  evidence: ShiftPlanningIntakeBarrierEvidenceEnvelope;
  evidenceDigest: ShiftPlanningDigest;
  retainedAt: Timestamp;
};

type PersistedIntakeBarrierFailureClosure = Omit<
  ShiftPlanningIntakeBarrierFailureClosureRecord,
  "failedAtMillis"
> & {
  failedAt: Timestamp;
};

const evidenceRecordKeys = [
  "schemaVersion",
  "operationKind",
  "environment",
  "transitionId",
  "evidence",
  "evidenceDigest",
  "retainedAt",
] as const;

const failureRecordKeys = [
  "schemaVersion",
  "operationKind",
  "environment",
  "transitionId",
  "scopeDigest",
  "holdRevision",
  "checkpointDigest",
  "phase",
  "failedAt",
  "failureDigest",
] as const;

const failState = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_state", message);
};

const failConflict = (message: string): never => {
  throw new ShiftPlanningError("request_intent_conflict", message);
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
    return failState("Intake barrier environment is invalid.");
  }
  return value;
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failState(`${name} must be a canonical identifier.`);
  }
  return value;
};

const requireDigest = (value: unknown, name: string): ShiftPlanningDigest => {
  if (
    typeof value !== "string" ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return failState(`${name} must be a shift-planning digest.`);
  }
  return value as ShiftPlanningDigest;
};

const requireTimestamp = (value: unknown, name: string): Timestamp => {
  if (!(value instanceof Timestamp)) {
    return failState(`${name} must be a Firestore Timestamp.`);
  }
  return value;
};

const normalizedKey = (
  value: ShiftPlanningIntakeBarrierEvidenceKey,
): ShiftPlanningIntakeBarrierEvidenceKey => ({
  environment: requireEnvironment(value.environment),
  transitionId: requireIdentifier(value.transitionId, "transitionId"),
});

const parseEvidenceEnvelope = (
  value: unknown,
): ShiftPlanningIntakeBarrierEvidenceEnvelope => {
  try {
    return parseShiftPlanningIntakeBarrierEvidenceEnvelope(value);
  } catch (error) {
    if (
      error instanceof ShiftPlanningError &&
      error.code === "invalid_planning_state"
    ) {
      throw error;
    }
    return failState("Retained intake barrier evidence is invalid.");
  }
};

const requireEvidenceBoundToKey = (
  evidence: ShiftPlanningIntakeBarrierEvidenceEnvelope,
  key: ShiftPlanningIntakeBarrierEvidenceKey,
): void => {
  if (
    evidence.payload.environment !== key.environment ||
    evidence.payload.transition.transitionId !== key.transitionId
  ) {
    failState("Intake barrier evidence belongs to another stable key.");
  }
};

const parseEvidenceRecord = (
  value: unknown,
  key: ShiftPlanningIntakeBarrierEvidenceKey,
): PersistedIntakeBarrierEvidence => {
  const record = requireRecord(value, "intake barrier evidence record");
  requireExactKeys(
    record,
    evidenceRecordKeys,
    "intake barrier evidence record",
  );
  if (
    record.schemaVersion !== INTAKE_BARRIER_REPOSITORY_SCHEMA_VERSION ||
    record.operationKind !== "intakeBarrierEvidence"
  ) {
    return failState("Intake barrier evidence discriminator is invalid.");
  }
  const environment = requireEnvironment(record.environment);
  const transitionId = requireIdentifier(record.transitionId, "transitionId");
  if (
    environment !== key.environment ||
    transitionId !== key.transitionId
  ) {
    return failState("Intake barrier record belongs to another stable key.");
  }
  const evidence = parseEvidenceEnvelope(record.evidence);
  requireEvidenceBoundToKey(evidence, key);
  const evidenceDigest = requireDigest(
    record.evidenceDigest,
    "retained evidence digest",
  );
  if (evidenceDigest !== evidence.digest) {
    return failState("Retained intake barrier evidence digest is invalid.");
  }
  const retainedAt = requireTimestamp(record.retainedAt, "retention instant");
  if (timestampMillis(retainedAt) < evidence.payload.verifiedAtMillis) {
    return failState("Retention instant predates barrier verification.");
  }
  return {
    schemaVersion: INTAKE_BARRIER_REPOSITORY_SCHEMA_VERSION,
    operationKind: "intakeBarrierEvidence",
    environment,
    transitionId,
    evidence,
    evidenceDigest,
    retainedAt,
  };
};

const sameCanonicalValue = (left: unknown, right: unknown): boolean =>
  canonicalShiftPlanningJson(left) === canonicalShiftPlanningJson(right);

const requireExactEvidenceReplay = (
  persisted: PersistedIntakeBarrierEvidence,
  expected: ShiftPlanningIntakeBarrierEvidenceEnvelope,
): void => {
  if (
    persisted.evidenceDigest !== expected.digest ||
    !sameCanonicalValue(persisted.evidence, expected)
  ) {
    failConflict("Intake barrier evidence key owns another envelope.");
  }
};

const requireExactEvidenceRecordReadBack = (
  readBack: PersistedIntakeBarrierEvidence,
  transactionRecord: PersistedIntakeBarrierEvidence,
): void => {
  if (
    readBack.environment !== transactionRecord.environment ||
    readBack.transitionId !== transactionRecord.transitionId ||
    readBack.evidenceDigest !== transactionRecord.evidenceDigest ||
    !sameCanonicalValue(readBack.evidence, transactionRecord.evidence) ||
    !readBack.retainedAt.isEqual(transactionRecord.retainedAt)
  ) {
    failState("Intake barrier evidence changed before read-back.");
  }
};

const planningRoot = (environment: ShiftPlanningEnvironment): string =>
  `${environment}/plus-collections`;

const evidenceReference = (
  firestore: Firestore,
  key: ShiftPlanningIntakeBarrierEvidenceKey,
): DocumentReference => firestore.doc(
  `${planningRoot(key.environment)}/shiftPlanningOperations/` +
  `barrier-evidence-${key.transitionId}`,
);

const failureReference = (
  firestore: Firestore,
  key: ShiftPlanningIntakeBarrierEvidenceKey,
): DocumentReference => firestore.doc(
  `${planningRoot(key.environment)}/shiftPlanningOperations/` +
  `barrier-failure-${key.transitionId}`,
);

const requireSnapshotData = (
  snapshot: DocumentSnapshot,
  name: string,
): unknown => {
  if (!snapshot.exists) return failState(`${name} does not exist.`);
  return snapshot.data();
};

const parseFailureRecord = (
  value: unknown,
  key: ShiftPlanningIntakeBarrierEvidenceKey,
): ShiftPlanningIntakeBarrierFailureClosureRecord => {
  const persisted = requireRecord(
    value,
    "intake barrier failure closure",
  );
  requireExactKeys(
    persisted,
    failureRecordKeys,
    "intake barrier failure closure",
  );
  if (
    persisted.schemaVersion !== INTAKE_BARRIER_REPOSITORY_SCHEMA_VERSION ||
    persisted.operationKind !== "intakeBarrierFailureClosure"
  ) {
    return failState("Barrier failure closure discriminator is invalid.");
  }
  const environment = requireEnvironment(persisted.environment);
  const transitionId = requireIdentifier(
    persisted.transitionId,
    "transitionId",
  );
  if (
    environment !== key.environment ||
    transitionId !== key.transitionId
  ) {
    return failState("Barrier failure closure belongs to another stable key.");
  }
  let record: ShiftPlanningIntakeBarrierFailureClosureRecord;
  try {
    record = createShiftPlanningIntakeBarrierFailureClosureRecord(
      {
        environment,
        transitionId,
        scopeDigest: requireDigest(persisted.scopeDigest, "scope digest"),
        holdRevision: requireIdentifier(
          persisted.holdRevision,
          "hold revision",
        ),
        checkpointDigest: requireDigest(
          persisted.checkpointDigest,
          "checkpoint digest",
        ),
        phase: persisted.phase as
          ShiftPlanningIntakeBarrierFailureClosureRequest["phase"],
      },
      timestampMillis(requireTimestamp(persisted.failedAt, "failure instant")),
    );
  } catch {
    return failState("Retained intake barrier failure closure is invalid.");
  }
  if (
    requireDigest(persisted.failureDigest, "failure digest") !==
      record.failureDigest
  ) {
    return failState("Retained barrier failure digest is invalid.");
  }
  return record;
};

const normalizedFailureRequest = (
  value: ShiftPlanningIntakeBarrierFailureClosureRequest,
): ShiftPlanningIntakeBarrierFailureClosureRequest => {
  const key = normalizedKey(value);
  try {
    const probe = createShiftPlanningIntakeBarrierFailureClosureRecord(
      value,
      0,
    );
    return {
      environment: key.environment,
      transitionId: key.transitionId,
      scopeDigest: probe.scopeDigest,
      holdRevision: probe.holdRevision,
      checkpointDigest: probe.checkpointDigest,
      phase: probe.phase,
    };
  } catch {
    return failState("Intake barrier failure closure request is invalid.");
  }
};

const failureMatchesRequest = (
  record: ShiftPlanningIntakeBarrierFailureClosureRecord,
  request: ShiftPlanningIntakeBarrierFailureClosureRequest,
): boolean => record.environment === request.environment &&
  record.transitionId === request.transitionId &&
  record.scopeDigest === request.scopeDigest &&
  record.holdRevision === request.holdRevision &&
  record.checkpointDigest === request.checkpointDigest &&
  record.phase === request.phase;

const requireExactFailureReplay = (
  record: ShiftPlanningIntakeBarrierFailureClosureRecord,
  request: ShiftPlanningIntakeBarrierFailureClosureRequest,
): void => {
  if (!failureMatchesRequest(record, request)) {
    failConflict("Barrier failure key owns another closure intent.");
  }
};

const requireExactFailureRecordReadBack = (
  readBack: ShiftPlanningIntakeBarrierFailureClosureRecord,
  transactionRecord: ShiftPlanningIntakeBarrierFailureClosureRecord,
): void => {
  if (!sameCanonicalValue(readBack, transactionRecord)) {
    failState("Barrier failure closure changed before read-back.");
  }
};

const timestampMillis = (timestamp: Timestamp): number => {
  if (timestamp.nanoseconds % 1_000_000 !== 0) {
    return failState("Repository timestamp must have millisecond precision.");
  }
  const millis = timestamp.toMillis();
  if (!Number.isSafeInteger(millis) || millis < 0) {
    return failState("Repository clock returned an invalid instant.");
  }
  return millis;
};

/**
 * Builds the backend-only immutable store for full intake-barrier packets and
 * durable failure-closure incidents. Every create is followed by a real
 * Firestore read-back; exact retries never update their original timestamp.
 * @param {Firestore} firestore Backend-owned Firestore connection.
 * @param {function(): Timestamp} readTimestamp Trusted repository clock.
 * @return {object} Evidence and failure-closure persistence ports.
 */
export const createFirestoreShiftPlanningIntakeBarrierRepository = (
  firestore: Firestore,
  readTimestamp: () => Timestamp = Timestamp.now,
): ShiftPlanningIntakeBarrierEvidencePersistence &
  ShiftPlanningIntakeBarrierFailureClosurePersistence => {
  const readExisting = async (
    input: ShiftPlanningIntakeBarrierEvidenceKey,
  ): Promise<ShiftPlanningIntakeBarrierEvidenceEnvelope | null> => {
    const key = normalizedKey(input);
    const snapshot = await evidenceReference(firestore, key).get();
    if (!snapshot.exists) return null;
    return parseEvidenceRecord(snapshot.data(), key).evidence;
  };

  const retainAndReadBack = async (
    input: ShiftPlanningIntakeBarrierEvidenceRetentionRequest,
  ): Promise<ShiftPlanningIntakeBarrierEvidenceEnvelope> => {
    const key = normalizedKey(input);
    const evidence = parseEvidenceEnvelope(input.evidence);
    requireEvidenceBoundToKey(evidence, key);
    const reference = evidenceReference(firestore, key);
    const transactionRecord = await firestore.runTransaction(
      async (transaction): Promise<PersistedIntakeBarrierEvidence> => {
        const snapshot = await transaction.get(reference);
        if (snapshot.exists) {
          const persisted = parseEvidenceRecord(snapshot.data(), key);
          requireExactEvidenceReplay(persisted, evidence);
          return persisted;
        }
        const retainedAt = requireTimestamp(
          readTimestamp(),
          "retention instant",
        );
        if (timestampMillis(retainedAt) < evidence.payload.verifiedAtMillis) {
          return failState("Retention clock predates barrier verification.");
        }
        const record: PersistedIntakeBarrierEvidence = {
          schemaVersion: INTAKE_BARRIER_REPOSITORY_SCHEMA_VERSION,
          operationKind: "intakeBarrierEvidence",
          environment: key.environment,
          transitionId: key.transitionId,
          evidence,
          evidenceDigest: evidence.digest,
          retainedAt,
        };
        transaction.create(reference, record);
        return record;
      },
    );
    const readBack = parseEvidenceRecord(
      requireSnapshotData(await reference.get(), "intake barrier evidence"),
      key,
    );
    requireExactEvidenceReplay(readBack, evidence);
    requireExactEvidenceRecordReadBack(readBack, transactionRecord);
    return readBack.evidence;
  };

  const readExistingFailure = async (
    input: ShiftPlanningIntakeBarrierEvidenceKey,
  ): Promise<ShiftPlanningIntakeBarrierFailureClosureRecord | null> => {
    const key = normalizedKey(input);
    const snapshot = await failureReference(firestore, key).get();
    if (!snapshot.exists) return null;
    return parseFailureRecord(snapshot.data(), key);
  };

  const retainFailureAndReadBack = async (
    input: ShiftPlanningIntakeBarrierFailureClosureRequest,
  ): Promise<ShiftPlanningIntakeBarrierFailureClosureRecord> => {
    const request = normalizedFailureRequest(input);
    const key = normalizedKey(request);
    const reference = failureReference(firestore, key);
    const transactionRecord = await firestore.runTransaction(
      async (
        transaction,
      ): Promise<ShiftPlanningIntakeBarrierFailureClosureRecord> => {
        const snapshot = await transaction.get(reference);
        if (snapshot.exists) {
          const persisted = parseFailureRecord(snapshot.data(), key);
          requireExactFailureReplay(persisted, request);
          return persisted;
        }
        const failedAtMillis = timestampMillis(requireTimestamp(
          readTimestamp(),
          "failure instant",
        ));
        const record = createShiftPlanningIntakeBarrierFailureClosureRecord(
          request,
          failedAtMillis,
        );
        const persisted: PersistedIntakeBarrierFailureClosure = {
          schemaVersion: record.schemaVersion,
          operationKind: record.operationKind,
          environment: record.environment,
          transitionId: record.transitionId,
          scopeDigest: record.scopeDigest,
          holdRevision: record.holdRevision,
          checkpointDigest: record.checkpointDigest,
          phase: record.phase,
          failedAt: Timestamp.fromMillis(failedAtMillis),
          failureDigest: record.failureDigest,
        };
        transaction.create(reference, persisted);
        return record;
      },
    );
    const readBack = parseFailureRecord(
      requireSnapshotData(
        await reference.get(),
        "intake barrier failure closure",
      ),
      key,
    );
    requireExactFailureReplay(readBack, request);
    requireExactFailureRecordReadBack(readBack, transactionRecord);
    return readBack;
  };

  return {
    readExisting,
    retainAndReadBack,
    readExistingFailure,
    retainFailureAndReadBack,
  };
};
