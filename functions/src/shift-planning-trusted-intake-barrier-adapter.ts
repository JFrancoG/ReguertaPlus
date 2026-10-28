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
  parseShiftPlanningOwnerAgreementIntakeBarrierEvidenceEnvelope,
  verifyShiftPlanningOwnerAgreementIntakeBarrierEvidence,
  ShiftPlanningClosedBarrierScope,
  ShiftPlanningIntakeBarrierAdapter,
} from "./shift-planning-intake-barrier.js";
import {
  SHIFT_PLANNING_OWNER_AGREEMENT_INVENTORY_REVISION,
  SHIFT_PLANNING_OWNER_AGREEMENT_INVENTORY_DIGEST,
  SHIFT_PLANNING_WRITER_INVENTORY_DIGEST,
  SHIFT_PLANNING_WRITER_INVENTORY_REVISION,
} from "./shift-planning-writer-inventory.js";
import {
  ShiftPlanningEnvironment,
} from "./shift-planning-wire.js";

import {
  assertShiftPlanningOwnerMaintenanceObservation,
} from "./shift-planning-owner-maintenance.js";

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
  schemaVersion: 1 | 2;
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

export type ShiftPlanningOwnerMaintenanceIncident = {
  agreementDigest: ShiftPlanningDigest;
  reason: "agreement_expired" | "owner_reported_activity" | "owner_withdrawn" |
    "authority_drift" | "uncertain_write" | "readback_unavailable" |
    "operation_failed";
  observationDigest: ShiftPlanningDigest | null;
};

export type ShiftPlanningIntakeBarrierFailureClosureRequest = {
  environment: ShiftPlanningEnvironment;
  transitionId: string;
  scopeDigest: ShiftPlanningDigest;
  holdRevision: string;
  checkpointDigest: ShiftPlanningDigest;
  phase: ShiftPlanningIntakeBarrierFailurePhase;
  ownerIncident?: ShiftPlanningOwnerMaintenanceIncident;
};

export type ShiftPlanningIntakeBarrierFailureClosureRecord =
  ShiftPlanningIntakeBarrierFailureClosureRequest & {
    schemaVersion: 1 | 2;
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
  /** Fresh owner facts, separate from the immutable technical checkpoint. */
  readBackOwnerObservation?(scope: ShiftPlanningClosedBarrierScope):
    Promise<unknown>;
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

const parseScope = (
  value: unknown,
  cooperative = false,
): ShiftPlanningClosedBarrierScope => {
  const scope = requireRecord(
    detachedCanonicalValue(value, "closed barrier scope"),
    "closed barrier scope",
  );
  requireExactKeys(scope, cooperative ? [...scopeKeys, "schemaVersion",
    "maintenanceMode", "expectedOwnerAgreementDigest",
    "expectedTechnicalControlManifestDigest"] : scopeKeys,
  "closed barrier scope");
  if (cooperative && (scope.schemaVersion !== 2 ||
      scope.maintenanceMode !== "owner-agreement")) {
    return failAdapter("Owner maintenance must be explicitly versioned.");
  }
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
  if (writerInventoryRevision !== (cooperative ?
    SHIFT_PLANNING_OWNER_AGREEMENT_INVENTORY_REVISION :
    SHIFT_PLANNING_WRITER_INVENTORY_REVISION) || writerInventoryDigest !==
    (cooperative ? SHIFT_PLANNING_OWNER_AGREEMENT_INVENTORY_DIGEST :
      SHIFT_PLANNING_WRITER_INVENTORY_DIGEST)) {
    return failAdapter("Closed barrier scope uses another writer inventory.");
  }
  const common = {
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
    writerInventoryRevision: cooperative ?
      SHIFT_PLANNING_OWNER_AGREEMENT_INVENTORY_REVISION :
      SHIFT_PLANNING_WRITER_INVENTORY_REVISION,
    writerInventoryDigest: cooperative ?
      SHIFT_PLANNING_OWNER_AGREEMENT_INVENTORY_DIGEST :
      SHIFT_PLANNING_WRITER_INVENTORY_DIGEST,
  };
  return cooperative ? {
    ...common, schemaVersion: 2, maintenanceMode: "owner-agreement",
    expectedOwnerAgreementDigest: requireDigest(
      scope.expectedOwnerAgreementDigest, "owner agreement digest",
    ),
    expectedTechnicalControlManifestDigest: requireDigest(
      scope.expectedTechnicalControlManifestDigest, "technical control digest",
    ),
  } : common;
};

const sameCanonicalValue = (left: unknown, right: unknown): boolean =>
  canonicalShiftPlanningJson(left) === canonicalShiftPlanningJson(right);

/**
 * Builds the exact checkpoint a trusted control-plane driver must persist and
 * return while every manifested fence remains held.
 * @param {object} input Exact scope, hold revision, and verified evidence.
 * @param {boolean} cooperative Whether this is explicit owner agreement mode.
 * @return {ShiftPlanningTrustedIntakeBarrierCheckpoint} Detached checkpoint.
 */
const createCheckpoint = (input: {
  scope: ShiftPlanningClosedBarrierScope;
  holdRevision: string;
  evidence: unknown;
}, cooperative = false): ShiftPlanningTrustedIntakeBarrierCheckpoint => {
  const scope = parseScope(input.scope, cooperative);
  const evidence = cooperative ?
    parseShiftPlanningOwnerAgreementIntakeBarrierEvidenceEnvelope(
      input.evidence,
    ) :
    parseShiftPlanningIntakeBarrierEvidenceEnvelope(input.evidence);
  const payload = {
    schemaVersion: cooperative ? 2 as const : 1 as const,
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
 * @param {boolean} cooperative Whether explicit v2 is required.
 * @return {ShiftPlanningTrustedIntakeBarrierCheckpoint} Exact checkpoint.
 */
const parseCheckpoint = (
  value: unknown,
  cooperative = false,
): ShiftPlanningTrustedIntakeBarrierCheckpoint => {
  const checkpoint = requireRecord(
    detachedCanonicalValue(value, "trusted barrier checkpoint"),
    "trusted barrier checkpoint",
  );
  requireExactKeys(checkpoint, checkpointKeys, "trusted barrier checkpoint");
  if (
    checkpoint.schemaVersion !== (cooperative ? 2 : 1)
  ) {
    return failAdapter("Trusted barrier checkpoint version is unsupported.");
  }
  const expected = createCheckpoint({
    scope: checkpoint.scope as ShiftPlanningClosedBarrierScope,
    holdRevision: requireIdentifier(
      checkpoint.holdRevision,
      "hold revision",
    ),
    evidence: checkpoint.evidence,
  }, cooperative);
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
  cooperative = false,
): ShiftPlanningTrustedIntakeBarrierCheckpoint => {
  const checkpoint = parseCheckpoint(value, cooperative);
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

const parseOwnerIncident = (value: unknown):
ShiftPlanningOwnerMaintenanceIncident => {
  const incident = requireRecord(value, "owner maintenance incident");
  requireExactKeys(incident, ["agreementDigest", "reason", "observationDigest"],
    "owner maintenance incident");
  if (!["agreement_expired", "owner_reported_activity", "owner_withdrawn",
    "authority_drift", "uncertain_write", "readback_unavailable",
    "operation_failed"].includes(incident.reason as string)) {
    return failAdapter("Owner maintenance incident reason is invalid.");
  }
  return {
    agreementDigest: requireDigest(
      incident.agreementDigest, "agreement digest",
    ),
    reason: incident.reason as ShiftPlanningOwnerMaintenanceIncident["reason"],
    observationDigest: incident.observationDigest === null ? null :
      requireDigest(incident.observationDigest, "owner observation digest"),
  };
};

const failurePayload = (
  request: ShiftPlanningIntakeBarrierFailureClosureRequest,
  failedAtMillis: number,
) => ({
  schemaVersion: request.ownerIncident !== undefined ? 2 as const : 1 as const,
  ...(request.ownerIncident !== undefined ? {
    ownerIncident: parseOwnerIncident(request.ownerIncident),
  } : {}),
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
  requireExactKeys(record, record.schemaVersion === 2 ?
    [...failureRecordKeys, "ownerIncident"] : failureRecordKeys,
  "barrier failure closure");
  if (
    ![1, 2].includes(record.schemaVersion as number) ||
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
      ...(record.schemaVersion === 2 ? {
        ownerIncident: parseOwnerIncident(record.ownerIncident),
      } : {}),
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
    record.phase !== request.phase ||
    !sameCanonicalValue(
      record.ownerIncident ?? null, request.ownerIncident ?? null,
    )
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
  cooperative = false,
  ownerIncident?: ShiftPlanningOwnerMaintenanceIncident,
): Promise<void> => {
  try {
    const checkpoint = requireCheckpointForScope(
      await dependencies.controlPlane.readBackClosed(scope),
      scope, cooperative,
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
      ...(ownerIncident ? {ownerIncident} : {}),
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
 * @param {boolean} cooperative Whether explicit v2 is required.
 * @return {ShiftPlanningIntakeBarrierAdapter} No-reopen barrier adapter.
 */
const createBarrierAdapter = (
  dependencies: {
    controlPlane: ShiftPlanningTrustedIntakeBarrierControlPlane;
    failurePersistence: ShiftPlanningIntakeBarrierFailureClosurePersistence;
    readClockMillis?: () => number;
  },
  cooperative = false,
): ShiftPlanningIntakeBarrierAdapter => ({
  async assertReadOnlyReplayAllowed(scopeValue): Promise<void> {
    const scope = parseScope(scopeValue, cooperative);
    const failure = await dependencies.failurePersistence.readExistingFailure({
      environment: scope.environment, transitionId: scope.transitionId,
    });
    if (failure !== null) {
      parseShiftPlanningIntakeBarrierFailureClosureRecord(failure);
      return failAdapter("Maintenance replay remains incident-closed.");
    }
  },
  async withClosedIntakeBarrier<Result>(
    scopeValue: ShiftPlanningClosedBarrierScope,
    operation: (evidence: unknown) => Promise<Result>,
  ): Promise<Result> {
    const scope = deepFreeze(parseScope(scopeValue, cooperative));
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
    let observationDigest: ShiftPlanningDigest | null = null;
    let reason: ShiftPlanningOwnerMaintenanceIncident["reason"] =
      "operation_failed";
    const freshOwner = async (
      value: ShiftPlanningTrustedIntakeBarrierCheckpoint,
    ): Promise<void> => {
      if (!cooperative) return;
      const command = {...scope};
      Reflect.deleteProperty(command, "writerInventoryRevision");
      Reflect.deleteProperty(command, "writerInventoryDigest");
      if (!dependencies.controlPlane.readBackOwnerObservation ||
          !dependencies.readClockMillis || command.schemaVersion !== 2) {
        return failAdapter("A fresh owner observation and clock are required.");
      }
      let observation: unknown;
      try {
        observation = await dependencies.controlPlane
          .readBackOwnerObservation(scope);
        observationDigest = createShiftPlanningDigest(observation);
      } catch (error) {
        reason = "readback_unavailable";
        observationDigest = null;
        throw error;
      }
      const now = dependencies.readClockMillis();
      const payload =
        parseShiftPlanningOwnerAgreementIntakeBarrierEvidenceEnvelope(
          value.evidence,
        ).payload;
      if (payload.schemaVersion !== 2) {
        return failAdapter("Owner evidence missing.");
      }
      const observed = typeof observation === "object" && observation !== null ?
        observation as UnknownRecord : {};
      reason = now >= payload.ownerAgreement.payload.intent.endsAtMillis ?
        "agreement_expired" : observed.ownerActivity !== "none-reported" ?
          "owner_reported_activity" : observed.agreementStatus !== "confirmed" ?
            "owner_withdrawn" : observed.unresolvedWriteCount !== 0 ?
              "uncertain_write" : "authority_drift";
      verifyShiftPlanningOwnerAgreementIntakeBarrierEvidence(
        value.evidence, command, now,
      );
      assertShiftPlanningOwnerMaintenanceObservation({
        agreement: payload.ownerAgreement, observation,
        environment: command.environment, operationId: command.transitionId,
        workbookFileId: command.expectedWorkbookFileId,
        workbookRevision: command.expectedWorkbookRevision,
        workbookDigest: command.expectedWorkbookDigest,
        writeEpoch: command.expectedWriteEpoch,
        activeRevision: command.expectedActiveRevision,
        activeDigest: command.expectedActiveDigest,
        authoritativeDigest: command.expectedAuthoritativeDigest,
        technicalControlManifestDigest:
          command.expectedTechnicalControlManifestDigest,
        nowMillis: now,
        maximumEvidenceAgeMillis: command.maximumEvidenceAgeMillis,
        requireFreshWindow: true,
      });
      reason = "operation_failed";
    };
    let checkpoint: ShiftPlanningTrustedIntakeBarrierCheckpoint | null = null;
    try {
      checkpoint = requireCheckpointForScope(
        await dependencies.controlPlane.closeAndCollect(scope),
        scope, cooperative,
      );
      phase = "initialReadBack";
      const initialReadBack = requireCheckpointForScope(
        await dependencies.controlPlane.readBackClosed(scope),
        scope, cooperative,
      );
      if (initialReadBack.checkpointDigest !== checkpoint.checkpointDigest) {
        return failAdapter("Initial closed barrier read-back drifted.");
      }
      checkpoint = initialReadBack;
      await freshOwner(checkpoint);
      phase = "operation";
      const result = await operation(checkpoint.evidence);
      phase = "finalReadBack";
      const finalReadBack = requireCheckpointForScope(
        await dependencies.controlPlane.readBackClosed(scope),
        scope, cooperative,
      );
      if (finalReadBack.checkpointDigest !== checkpoint.checkpointDigest) {
        return failAdapter("Final closed barrier read-back drifted.");
      }
      await freshOwner(finalReadBack);
      return result;
    } catch (error) {
      await retainFailureClosure(
        dependencies,
        scope,
        phase,
        checkpoint, cooperative,
        cooperative && scope.schemaVersion === 2 ? {
          agreementDigest: scope.expectedOwnerAgreementDigest,
          reason, observationDigest,
        } : undefined,
      );
      throw error;
    }
  },
});


/**
 * Creates a strict v1 checkpoint; explicit owner capability is unsupported.
 * @param {object} input Exact strict scope, hold and evidence.
 * @return {ShiftPlanningTrustedIntakeBarrierCheckpoint} Strict checkpoint.
 */
export const createShiftPlanningTrustedIntakeBarrierCheckpoint = (input: {
  scope: ShiftPlanningClosedBarrierScope;
  holdRevision: string;
  evidence: unknown;
}): ShiftPlanningTrustedIntakeBarrierCheckpoint => createCheckpoint(input);

/**
 * Parses strict v1 checkpoints without a cooperative fallback.
 * @param {unknown} value Untrusted strict checkpoint.
 * @return {ShiftPlanningTrustedIntakeBarrierCheckpoint} Strict checkpoint.
 */
export const parseShiftPlanningTrustedIntakeBarrierCheckpoint = (
  value: unknown,
): ShiftPlanningTrustedIntakeBarrierCheckpoint => parseCheckpoint(value);

/**
 * Creates a v2 checkpoint of technical controls and the historical commitment.
 * Current owner validity must come from the separate fresh observation port.
 * @param {object} input Explicit cooperative scope, hold and evidence.
 * @return {ShiftPlanningTrustedIntakeBarrierCheckpoint} Version 2 checkpoint.
 */
export const createShiftPlanningOwnerAgreementIntakeBarrierCheckpoint = (
  input: {
  scope: ShiftPlanningClosedBarrierScope;
  holdRevision: string;
  evidence: unknown;
  },
): ShiftPlanningTrustedIntakeBarrierCheckpoint => createCheckpoint(input, true);

/**
 * Preserves the original strict control-plane contract.
 * @param {object} dependencies Strict controls and immutable failure journal.
 * @return {ShiftPlanningIntakeBarrierAdapter} Strict adapter.
 */
export const createTrustedShiftPlanningIntakeBarrierAdapter = (dependencies: {
  controlPlane: ShiftPlanningTrustedIntakeBarrierControlPlane;
  failurePersistence: ShiftPlanningIntakeBarrierFailureClosurePersistence;
}): ShiftPlanningIntakeBarrierAdapter => createBarrierAdapter(dependencies);

/**
 * Uses the held-control/incident workflow with explicit cooperative policy.
 * Before and after the callback, a fresh owner observation and actual clock are
 * checked. On failure only the technical hold is certified; expiry never renews
 * the commitment, retracts a write, retries a callback, or opens intake.
 * @param {object} dependencies Controls, fresh owner port and journal.
 * @return {ShiftPlanningIntakeBarrierAdapter} Explicit version 2 adapter.
 */
export const createTrustedShiftPlanningOwnerAgreementIntakeBarrierAdapter = (
  dependencies: {
    controlPlane: ShiftPlanningTrustedIntakeBarrierControlPlane & {
      readBackOwnerObservation(scope: ShiftPlanningClosedBarrierScope):
        Promise<unknown>;
    };
    failurePersistence: ShiftPlanningIntakeBarrierFailureClosurePersistence;
    readClockMillis: () => number;
  },
): ShiftPlanningIntakeBarrierAdapter =>
  createBarrierAdapter(dependencies, true);
