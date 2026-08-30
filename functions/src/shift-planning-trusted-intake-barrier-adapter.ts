import {
  ShiftPlanningError,
} from "./shift-planning-contract.js";
import {
  canonicalShiftPlanningJson,
  createShiftPlanningDigest,
  ShiftPlanningDigest,
} from "./shift-planning-digest.js";
import {
  parseShiftPlanningIntakeBarrierEvidenceEnvelope,
  ShiftPlanningClosedBarrierScope,
  ShiftPlanningIntakeBarrierAdapter,
} from "./shift-planning-intake-barrier.js";
import {
  SHIFT_PLANNING_WRITER_INVENTORY_DIGEST,
  SHIFT_PLANNING_WRITER_INVENTORY_REVISION,
} from "./shift-planning-writer-inventory.js";
import {
  ShiftPlanningEnvironment,
} from "./shift-planning-wire.js";

export const SHIFT_PLANNING_TRUSTED_BARRIER_ADAPTER_SCHEMA_VERSION = 1 as const;

type UnknownRecord = Record<string, unknown>;

const scopeKeys = [
  "environment",
  "transitionId",
  "expectedAuthoritativeDigest",
  "expectedStateRevision",
  "expectedWriteEpoch",
  "expectedActiveRevision",
  "expectedActiveDigest",
  "expectedBarrierRevision",
  "expectedRulesRevision",
  "expectedRulesDigest",
  "expectedControlManifestDigest",
  "expectedWorkbookFileId",
  "expectedWorkbookRevision",
  "expectedWorkbookDigest",
  "expectedCausalSetRevision",
  "expectedCausalSetDigest",
  "minimumQuietHorizonMillis",
  "maximumEvidenceAgeMillis",
  "writerInventoryRevision",
  "writerInventoryDigest",
] as const;

const checkpointKeys = [
  "schemaVersion",
  "scope",
  "scopeDigest",
  "holdRevision",
  "evidence",
  "evidenceDigest",
  "checkpointDigest",
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
  "failedAtMillis",
  "failureDigest",
] as const;

export type ShiftPlanningTrustedIntakeBarrierCheckpoint = {
  schemaVersion: typeof SHIFT_PLANNING_TRUSTED_BARRIER_ADAPTER_SCHEMA_VERSION;
  scope: ShiftPlanningClosedBarrierScope;
  scopeDigest: ShiftPlanningDigest;
  holdRevision: string;
  evidence: unknown;
  evidenceDigest: ShiftPlanningDigest;
  checkpointDigest: ShiftPlanningDigest;
};

export type ShiftPlanningIntakeBarrierFailurePhase =
  | "close"
  | "initialReadBack"
  | "operation"
  | "finalReadBack";

export type ShiftPlanningIntakeBarrierFailureClosureRequest = {
  environment: ShiftPlanningEnvironment;
  transitionId: string;
  scopeDigest: ShiftPlanningDigest;
  holdRevision: string;
  checkpointDigest: ShiftPlanningDigest;
  phase: ShiftPlanningIntakeBarrierFailurePhase;
};

export type ShiftPlanningIntakeBarrierFailureClosureRecord =
  ShiftPlanningIntakeBarrierFailureClosureRequest & {
    schemaVersion: typeof SHIFT_PLANNING_TRUSTED_BARRIER_ADAPTER_SCHEMA_VERSION;
    operationKind: "intakeBarrierFailureClosure";
    failedAtMillis: number;
    failureDigest: ShiftPlanningDigest;
  };

/**
 * Production-shaped control-plane driver. Implementations must leave all
 * manifested fences durably closed when either method succeeds or fails. This
 * port intentionally exposes no reopen operation. Repeated or concurrent
 * closure for the same exact scope must converge on one durable checkpoint;
 * the maintenance callback remains responsible for its persisted idempotency.
 */
export interface ShiftPlanningTrustedIntakeBarrierControlPlane {
  closeAndCollect(scope: ShiftPlanningClosedBarrierScope): Promise<unknown>;
  readBackClosed(scope: ShiftPlanningClosedBarrierScope): Promise<unknown>;
}

/** Immutable incident journal for a transition whose closed barrier failed. */
export interface ShiftPlanningIntakeBarrierFailureClosurePersistence {
  readExistingFailure(input: {
    environment: ShiftPlanningEnvironment;
    transitionId: string;
  }): Promise<unknown | null>;

  retainFailureAndReadBack(
    request: ShiftPlanningIntakeBarrierFailureClosureRequest,
  ): Promise<unknown>;
}

const failAdapter = (message: string): never => {
  throw new ShiftPlanningError("maintenance_state_conflict", message);
};

const requireRecord = (value: unknown, name: string): UnknownRecord => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return failAdapter(`${name} must be a plain object.`);
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
    failAdapter(`${name} fields are not exact.`);
  }
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failAdapter(`${name} is not a valid identifier.`);
  }
  return value;
};

const requireDigest = (value: unknown, name: string): ShiftPlanningDigest => {
  if (
    typeof value !== "string" ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return failAdapter(`${name} is not a planning digest.`);
  }
  return value as ShiftPlanningDigest;
};

const requireEnvironment = (value: unknown): ShiftPlanningEnvironment => {
  if (value !== "develop" && value !== "production") {
    return failAdapter("Planning environment is invalid.");
  }
  return value;
};

const requireNonNegativeInteger = (value: unknown, name: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return failAdapter(`${name} must be a non-negative safe integer.`);
  }
  return value as number;
};

const requirePositiveInteger = (value: unknown, name: string): number => {
  const parsed = requireNonNegativeInteger(value, name);
  if (parsed === 0) return failAdapter(`${name} must be positive.`);
  return parsed;
};

const requireNullableRevision = (value: unknown): string | null =>
  value === null ? null : requireIdentifier(value, "active revision");

const requireNullableDigest = (value: unknown): ShiftPlanningDigest | null =>
  value === null ? null : requireDigest(value, "active digest");

const detachedCanonicalValue = (value: unknown, name: string): unknown => {
  try {
    return JSON.parse(canonicalShiftPlanningJson(value)) as unknown;
  } catch {
    return failAdapter(`${name} must contain canonical JSON data.`);
  }
};

const deepFreeze = <Value>(value: Value): Value => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value as UnknownRecord).forEach((child) => deepFreeze(child));
  return Object.freeze(value);
};

const parseScope = (value: unknown): ShiftPlanningClosedBarrierScope => {
  const scope = requireRecord(
    detachedCanonicalValue(value, "closed barrier scope"),
    "closed barrier scope",
  );
  requireExactKeys(scope, scopeKeys, "closed barrier scope");
  const activeRevision = requireNullableRevision(scope.expectedActiveRevision);
  const activeDigest = requireNullableDigest(scope.expectedActiveDigest);
  if ((activeRevision === null) !== (activeDigest === null)) {
    return failAdapter("Active revision and digest must change together.");
  }
  const writerInventoryRevision = requireIdentifier(
    scope.writerInventoryRevision,
    "writer inventory revision",
  );
  const writerInventoryDigest = requireDigest(
    scope.writerInventoryDigest,
    "writer inventory digest",
  );
  if (
    writerInventoryRevision !== SHIFT_PLANNING_WRITER_INVENTORY_REVISION ||
    writerInventoryDigest !== SHIFT_PLANNING_WRITER_INVENTORY_DIGEST
  ) {
    return failAdapter("Closed barrier scope uses another writer inventory.");
  }
  return {
    environment: requireEnvironment(scope.environment),
    transitionId: requireIdentifier(scope.transitionId, "transitionId"),
    expectedAuthoritativeDigest: requireDigest(
      scope.expectedAuthoritativeDigest,
      "expected authoritative digest",
    ),
    expectedStateRevision: requireNonNegativeInteger(
      scope.expectedStateRevision,
      "expected state revision",
    ),
    expectedWriteEpoch: requireNonNegativeInteger(
      scope.expectedWriteEpoch,
      "expected write epoch",
    ),
    expectedActiveRevision: activeRevision,
    expectedActiveDigest: activeDigest,
    expectedBarrierRevision: requireIdentifier(
      scope.expectedBarrierRevision,
      "expected barrier revision",
    ),
    expectedRulesRevision: requireIdentifier(
      scope.expectedRulesRevision,
      "expected Rules revision",
    ),
    expectedRulesDigest: requireDigest(
      scope.expectedRulesDigest,
      "expected Rules digest",
    ),
    expectedControlManifestDigest: requireDigest(
      scope.expectedControlManifestDigest,
      "expected control manifest digest",
    ),
    expectedWorkbookFileId: requireIdentifier(
      scope.expectedWorkbookFileId,
      "expected workbook file ID",
    ),
    expectedWorkbookRevision: requireIdentifier(
      scope.expectedWorkbookRevision,
      "expected workbook revision",
    ),
    expectedWorkbookDigest: requireDigest(
      scope.expectedWorkbookDigest,
      "expected workbook digest",
    ),
    expectedCausalSetRevision: requireIdentifier(
      scope.expectedCausalSetRevision,
      "expected causal-set revision",
    ),
    expectedCausalSetDigest: requireDigest(
      scope.expectedCausalSetDigest,
      "expected causal-set digest",
    ),
    minimumQuietHorizonMillis: requirePositiveInteger(
      scope.minimumQuietHorizonMillis,
      "minimum quiet horizon",
    ),
    maximumEvidenceAgeMillis: requirePositiveInteger(
      scope.maximumEvidenceAgeMillis,
      "maximum evidence age",
    ),
    writerInventoryRevision: SHIFT_PLANNING_WRITER_INVENTORY_REVISION,
    writerInventoryDigest: SHIFT_PLANNING_WRITER_INVENTORY_DIGEST,
  };
};

const sameCanonicalValue = (left: unknown, right: unknown): boolean =>
  canonicalShiftPlanningJson(left) === canonicalShiftPlanningJson(right);

/**
 * Builds the exact checkpoint a trusted control-plane driver must persist and
 * return while every manifested fence remains held.
 * @param {object} input Exact scope, hold revision, and verified evidence.
 * @return {ShiftPlanningTrustedIntakeBarrierCheckpoint} Detached checkpoint.
 */
export const createShiftPlanningTrustedIntakeBarrierCheckpoint = (input: {
  scope: ShiftPlanningClosedBarrierScope;
  holdRevision: string;
  evidence: unknown;
}): ShiftPlanningTrustedIntakeBarrierCheckpoint => {
  const scope = parseScope(input.scope);
  const evidence = parseShiftPlanningIntakeBarrierEvidenceEnvelope(
    input.evidence,
  );
  const payload = {
    schemaVersion: SHIFT_PLANNING_TRUSTED_BARRIER_ADAPTER_SCHEMA_VERSION,
    scope,
    scopeDigest: createShiftPlanningDigest(scope),
    holdRevision: requireIdentifier(input.holdRevision, "hold revision"),
    evidence,
    evidenceDigest: evidence.digest,
  };
  return deepFreeze({
    ...payload,
    checkpointDigest: createShiftPlanningDigest(payload),
  });
};

/**
 * Revalidates one untrusted durable checkpoint from the control plane.
 * @param {unknown} value Untrusted control-plane checkpoint.
 * @return {ShiftPlanningTrustedIntakeBarrierCheckpoint} Exact checkpoint.
 */
export const parseShiftPlanningTrustedIntakeBarrierCheckpoint = (
  value: unknown,
): ShiftPlanningTrustedIntakeBarrierCheckpoint => {
  const checkpoint = requireRecord(
    detachedCanonicalValue(value, "trusted barrier checkpoint"),
    "trusted barrier checkpoint",
  );
  requireExactKeys(checkpoint, checkpointKeys, "trusted barrier checkpoint");
  if (
    checkpoint.schemaVersion !==
      SHIFT_PLANNING_TRUSTED_BARRIER_ADAPTER_SCHEMA_VERSION
  ) {
    return failAdapter("Trusted barrier checkpoint version is unsupported.");
  }
  const expected = createShiftPlanningTrustedIntakeBarrierCheckpoint({
    scope: checkpoint.scope as ShiftPlanningClosedBarrierScope,
    holdRevision: requireIdentifier(
      checkpoint.holdRevision,
      "hold revision",
    ),
    evidence: checkpoint.evidence,
  });
  if (
    requireDigest(checkpoint.scopeDigest, "scope digest") !==
      expected.scopeDigest ||
    requireDigest(checkpoint.evidenceDigest, "evidence digest") !==
      expected.evidenceDigest ||
    requireDigest(checkpoint.checkpointDigest, "checkpoint digest") !==
      expected.checkpointDigest
  ) {
    return failAdapter("Trusted barrier checkpoint digest does not match.");
  }
  return expected;
};

const requireCheckpointForScope = (
  value: unknown,
  scope: ShiftPlanningClosedBarrierScope,
): ShiftPlanningTrustedIntakeBarrierCheckpoint => {
  const checkpoint = parseShiftPlanningTrustedIntakeBarrierCheckpoint(value);
  const expectedScopeDigest = createShiftPlanningDigest(scope);
  if (
    checkpoint.scopeDigest !== expectedScopeDigest ||
    !sameCanonicalValue(checkpoint.scope, scope)
  ) {
    return failAdapter("Trusted barrier checkpoint belongs to another scope.");
  }
  return checkpoint;
};

const requireFailurePhase = (
  value: unknown,
): ShiftPlanningIntakeBarrierFailurePhase => {
  if (
    value !== "close" &&
    value !== "initialReadBack" &&
    value !== "operation" &&
    value !== "finalReadBack"
  ) {
    return failAdapter("Barrier failure phase is invalid.");
  }
  return value;
};

const failurePayload = (
  request: ShiftPlanningIntakeBarrierFailureClosureRequest,
  failedAtMillis: number,
) => ({
  schemaVersion: SHIFT_PLANNING_TRUSTED_BARRIER_ADAPTER_SCHEMA_VERSION,
  operationKind: "intakeBarrierFailureClosure" as const,
  environment: requireEnvironment(request.environment),
  transitionId: requireIdentifier(request.transitionId, "transitionId"),
  scopeDigest: requireDigest(request.scopeDigest, "scope digest"),
  holdRevision: requireIdentifier(request.holdRevision, "hold revision"),
  checkpointDigest: requireDigest(
    request.checkpointDigest,
    "checkpoint digest",
  ),
  phase: requireFailurePhase(request.phase),
  failedAtMillis: requireNonNegativeInteger(failedAtMillis, "failure instant"),
});

export const createShiftPlanningIntakeBarrierFailureClosureRecord = (
  request: ShiftPlanningIntakeBarrierFailureClosureRequest,
  failedAtMillis: number,
): ShiftPlanningIntakeBarrierFailureClosureRecord => {
  const payload = failurePayload(request, failedAtMillis);
  return deepFreeze({
    ...payload,
    failureDigest: createShiftPlanningDigest(payload),
  });
};

export const parseShiftPlanningIntakeBarrierFailureClosureRecord = (
  value: unknown,
): ShiftPlanningIntakeBarrierFailureClosureRecord => {
  const record = requireRecord(
    detachedCanonicalValue(value, "barrier failure closure"),
    "barrier failure closure",
  );
  requireExactKeys(record, failureRecordKeys, "barrier failure closure");
  if (
    record.schemaVersion !==
      SHIFT_PLANNING_TRUSTED_BARRIER_ADAPTER_SCHEMA_VERSION ||
    record.operationKind !== "intakeBarrierFailureClosure"
  ) {
    return failAdapter("Barrier failure closure discriminator is invalid.");
  }
  const expected = createShiftPlanningIntakeBarrierFailureClosureRecord(
    {
      environment: requireEnvironment(record.environment),
      transitionId: requireIdentifier(record.transitionId, "transitionId"),
      scopeDigest: requireDigest(record.scopeDigest, "scope digest"),
      holdRevision: requireIdentifier(record.holdRevision, "hold revision"),
      checkpointDigest: requireDigest(
        record.checkpointDigest,
        "checkpoint digest",
      ),
      phase: requireFailurePhase(record.phase),
    },
    requireNonNegativeInteger(record.failedAtMillis, "failure instant"),
  );
  if (
    requireDigest(record.failureDigest, "failure digest") !==
      expected.failureDigest
  ) {
    return failAdapter("Barrier failure closure digest does not match.");
  }
  return expected;
};

const requireFailureRecordMatches = (
  value: unknown,
  request: ShiftPlanningIntakeBarrierFailureClosureRequest,
): ShiftPlanningIntakeBarrierFailureClosureRecord => {
  const record = parseShiftPlanningIntakeBarrierFailureClosureRecord(value);
  if (
    record.environment !== request.environment ||
    record.transitionId !== request.transitionId ||
    record.scopeDigest !== request.scopeDigest ||
    record.holdRevision !== request.holdRevision ||
    record.checkpointDigest !== request.checkpointDigest ||
    record.phase !== request.phase
  ) {
    return failAdapter("Retained barrier failure closure does not match.");
  }
  return record;
};

const retainFailureClosure = async (
  dependencies: {
    controlPlane: ShiftPlanningTrustedIntakeBarrierControlPlane;
    failurePersistence: ShiftPlanningIntakeBarrierFailureClosurePersistence;
  },
  scope: ShiftPlanningClosedBarrierScope,
  phase: ShiftPlanningIntakeBarrierFailurePhase,
  previousCheckpoint: ShiftPlanningTrustedIntakeBarrierCheckpoint | null,
): Promise<void> => {
  try {
    const checkpoint = requireCheckpointForScope(
      await dependencies.controlPlane.readBackClosed(scope),
      scope,
    );
    if (
      previousCheckpoint !== null &&
      checkpoint.checkpointDigest !== previousCheckpoint.checkpointDigest
    ) {
      return failAdapter("Closed barrier checkpoint drifted after failure.");
    }
    const request: ShiftPlanningIntakeBarrierFailureClosureRequest = {
      environment: scope.environment,
      transitionId: scope.transitionId,
      scopeDigest: checkpoint.scopeDigest,
      holdRevision: checkpoint.holdRevision,
      checkpointDigest: checkpoint.checkpointDigest,
      phase,
    };
    const retained = await dependencies.failurePersistence
      .retainFailureAndReadBack(request);
    requireFailureRecordMatches(retained, request);
  } catch {
    return failAdapter(
      "Failed barrier closure could not be durably proven and retained.",
    );
  }
};

/**
 * Creates the production-shaped adapter around injected multi-service controls.
 * It verifies the durable held checkpoint before and after the one callback. On
 * failure it re-reads the closed state and retains an immutable incident before
 * propagating the original error. If that durable proof or journal also fails,
 * it masks the original with a stable fail-closed conflict. It never exposes or
 * invokes reopen behavior.
 * @param {object} dependencies Trusted control plane and failure journal.
 * @return {ShiftPlanningIntakeBarrierAdapter} No-reopen barrier adapter.
 */
export const createTrustedShiftPlanningIntakeBarrierAdapter = (
  dependencies: {
    controlPlane: ShiftPlanningTrustedIntakeBarrierControlPlane;
    failurePersistence: ShiftPlanningIntakeBarrierFailureClosurePersistence;
  },
): ShiftPlanningIntakeBarrierAdapter => ({
  async withClosedIntakeBarrier<Result>(
    scopeValue: ShiftPlanningClosedBarrierScope,
    operation: (evidence: unknown) => Promise<Result>,
  ): Promise<Result> {
    const scope = deepFreeze(parseScope(scopeValue));
    const scopeDigest = createShiftPlanningDigest(scope);
    const existingFailure = await dependencies.failurePersistence
      .readExistingFailure({
        environment: scope.environment,
        transitionId: scope.transitionId,
      });
    if (existingFailure !== null) {
      const record = parseShiftPlanningIntakeBarrierFailureClosureRecord(
        existingFailure,
      );
      if (record.scopeDigest !== scopeDigest) {
        return failAdapter(
          "Barrier transition has a failure closure for another scope.",
        );
      }
      return failAdapter(
        "Barrier transition is durably closed after an earlier failure.",
      );
    }

    let phase: ShiftPlanningIntakeBarrierFailurePhase = "close";
    let checkpoint: ShiftPlanningTrustedIntakeBarrierCheckpoint | null = null;
    try {
      checkpoint = requireCheckpointForScope(
        await dependencies.controlPlane.closeAndCollect(scope),
        scope,
      );
      phase = "initialReadBack";
      const initialReadBack = requireCheckpointForScope(
        await dependencies.controlPlane.readBackClosed(scope),
        scope,
      );
      if (initialReadBack.checkpointDigest !== checkpoint.checkpointDigest) {
        return failAdapter("Initial closed barrier read-back drifted.");
      }
      checkpoint = initialReadBack;
      phase = "operation";
      const result = await operation(checkpoint.evidence);
      phase = "finalReadBack";
      const finalReadBack = requireCheckpointForScope(
        await dependencies.controlPlane.readBackClosed(scope),
        scope,
      );
      if (finalReadBack.checkpointDigest !== checkpoint.checkpointDigest) {
        return failAdapter("Final closed barrier read-back drifted.");
      }
      return result;
    } catch (error) {
      await retainFailureClosure(
        dependencies,
        scope,
        phase,
        checkpoint,
      );
      throw error;
    }
  },
});
