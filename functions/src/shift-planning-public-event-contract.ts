import {Timestamp} from "@google-cloud/firestore";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {createShiftPlanningDigest} from "./shift-planning-digest.js";
import {
  ShiftPlanningBackendMutationMarker,
  ShiftPlanningPublicMutationBinding,
  ShiftPlanningPublicShiftDocument,
  ShiftPlanningPublicShiftMaterialization,
  createShiftPlanningPublicShiftMaterialization,
  parseShiftPlanningActivationOperationTerminal,
  parseShiftPlanningBackendMutationMarker,
  parseShiftPlanningPublicShiftDocument,
} from "./shift-planning-publication-contract.js";
import {
  parseShiftPlanningRecoveryOperationTerminal,
} from "./shift-planning-inverse-materializer.js";
import {ShiftPlanningEnvironment} from "./shift-planning-wire.js";

export const SHIFT_PLANNING_PUBLIC_EVENT_SCHEMA_VERSION = 1 as const;

type UnknownRecord = Record<string, unknown>;

export type ShiftPlanningControlledMutationKind =
  | "repair"
  | "syncCorrection";

export type ShiftPlanningControlledMutationOperationTerminal = {
  schemaVersion: typeof SHIFT_PLANNING_PUBLIC_EVENT_SCHEMA_VERSION;
  operationKind: "controlledPublicMutation";
  state: "committed";
  kind: ShiftPlanningControlledMutationKind;
  operationId: string;
  environment: ShiftPlanningEnvironment;
  bundleRevision: string;
  bundleDigest: string;
  writeEpoch: number;
  committedAt: Timestamp;
  publicMutations: readonly ShiftPlanningPublicMutationBinding[];
  operationIntentDigest: string;
};

export type CreateShiftPlanningControlledMutationOperationTerminalInput = Omit<
  ShiftPlanningControlledMutationOperationTerminal,
  "schemaVersion" | "operationKind" | "state" | "operationIntentDigest"
>;

export type ShiftPlanningPublicWriteEventDecision =
  | {
    kind: "ordinary";
    targetPath: string;
  }
  | {
    kind: "controlledNoOp";
    operationKind:
      | "activation"
      | "recovery"
      | ShiftPlanningControlledMutationKind;
    mutationKind: "create" | "update" | "delete";
    operationId: string;
    operationIntentDigest: string;
    targetPath: string;
    eventDigest: string;
  };

const controlledTerminalFields = [
  "schemaVersion",
  "operationKind",
  "state",
  "kind",
  "operationId",
  "environment",
  "bundleRevision",
  "bundleDigest",
  "writeEpoch",
  "committedAt",
  "publicMutations",
  "operationIntentDigest",
] as const;

const failEvent = (message: string): never => {
  throw new ShiftPlanningError(
    "invalid_planning_publication_contract",
    message,
  );
};

const requireRecord = (value: unknown, name: string): UnknownRecord => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Object.getOwnPropertySymbols(value).length > 0
  ) {
    return failEvent(`${name} must be a plain object.`);
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
    return failEvent(`${name} fields are not exact.`);
  }
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failEvent(`${name} is not a valid identifier.`);
  }
  return value;
};

const requireDigest = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return failEvent(`${name} is not a planning digest.`);
  }
  return value;
};

const requireNonNegativeInteger = (value: unknown, name: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return failEvent(`${name} must be a non-negative safe integer.`);
  }
  return value as number;
};

const requirePositiveInteger = (value: unknown, name: string): number => {
  const parsed = requireNonNegativeInteger(value, name);
  if (parsed < 1) {
    return failEvent(`${name} must be positive.`);
  }
  return parsed;
};

const requireTimestamp = (value: unknown, name: string): Timestamp => {
  if (!(value instanceof Timestamp)) {
    return failEvent(`${name} must be a Firestore Timestamp.`);
  }
  return value;
};

const requireEnvironment = (value: unknown): ShiftPlanningEnvironment => {
  if (value !== "develop" && value !== "production") {
    return failEvent("Controlled operation environment is invalid.");
  }
  return value;
};

const requireDocumentPath = (
  value: unknown,
  environment: ShiftPlanningEnvironment,
  name: string,
): string => {
  if (typeof value !== "string") {
    return failEvent(`${name} must be a document path.`);
  }
  const segments = value.split("/");
  if (
    segments.length !== 4 ||
    segments[0] !== environment ||
    segments[1] !== "plus-collections" ||
    segments[2] !== "shifts" ||
    !/^shift_(delivery|market)_\d{8}$/.test(segments[3])
  ) {
    return failEvent(`${name} is not a canonical public shift path.`);
  }
  return value;
};

const parsePublicMutation = (
  value: unknown,
  index: number,
  environment: ShiftPlanningEnvironment,
): ShiftPlanningPublicMutationBinding => {
  const name = `controlled public mutation ${index + 1}`;
  const mutation = requireRecord(value, name);
  requireExactFields(mutation, [
    "mutationKind",
    "targetPath",
    "documentRevision",
    "payloadDigest",
  ], name);
  if (
    mutation.mutationKind !== "create" &&
    mutation.mutationKind !== "update"
  ) {
    return failEvent(`${name} kind is unsupported.`);
  }
  return {
    mutationKind: mutation.mutationKind,
    targetPath: requireDocumentPath(
      mutation.targetPath,
      environment,
      `${name} targetPath`,
    ),
    documentRevision: requirePositiveInteger(
      mutation.documentRevision,
      `${name} documentRevision`,
    ),
    payloadDigest: requireDigest(
      mutation.payloadDigest,
      `${name} payloadDigest`,
    ),
  };
};

const controlledOperationCore = (
  value: Omit<
    ShiftPlanningControlledMutationOperationTerminal,
    "operationIntentDigest"
  >,
): object => ({
  ...value,
  committedAt: {
    seconds: value.committedAt.seconds,
    nanoseconds: value.committedAt.nanoseconds,
  },
});

/**
 * Parses a terminal registry entry for a repair or Sheets sync correction.
 * The real producer/consumer wiring remains in HU-083; this record freezes the
 * exact public create/update bindings that its event filter must authorize.
 * @param {unknown} value Untrusted persisted operation record.
 * @return {ShiftPlanningControlledMutationOperationTerminal} Canonical record.
 */
export const parseShiftPlanningControlledMutationOperationTerminal = (
  value: unknown,
): ShiftPlanningControlledMutationOperationTerminal => {
  const terminal = requireRecord(value, "controlled mutation terminal");
  requireExactFields(
    terminal,
    controlledTerminalFields,
    "controlled mutation terminal",
  );
  if (
    terminal.schemaVersion !== SHIFT_PLANNING_PUBLIC_EVENT_SCHEMA_VERSION ||
    terminal.operationKind !== "controlledPublicMutation" ||
    terminal.state !== "committed" ||
    (terminal.kind !== "repair" && terminal.kind !== "syncCorrection")
  ) {
    return failEvent("Controlled mutation discriminators are invalid.");
  }
  const environment = requireEnvironment(terminal.environment);
  if (!Array.isArray(terminal.publicMutations)) {
    return failEvent("Controlled public mutations must be an array.");
  }
  const publicMutations = terminal.publicMutations.map((item, index) =>
    parsePublicMutation(item, index, environment));
  if (publicMutations.length < 1) {
    return failEvent("Controlled mutation must bind a public shift.");
  }
  for (let index = 1; index < publicMutations.length; index += 1) {
    if (
      publicMutations[index - 1].targetPath >=
        publicMutations[index].targetPath
    ) {
      return failEvent("Controlled public mutations are not ordered.");
    }
  }
  const withoutDigest: Omit<
    ShiftPlanningControlledMutationOperationTerminal,
    "operationIntentDigest"
  > = {
    schemaVersion: SHIFT_PLANNING_PUBLIC_EVENT_SCHEMA_VERSION,
    operationKind: "controlledPublicMutation",
    state: "committed",
    kind: terminal.kind,
    operationId: requireIdentifier(
      terminal.operationId,
      "controlled operationId",
    ),
    environment,
    bundleRevision: requireIdentifier(
      terminal.bundleRevision,
      "controlled bundleRevision",
    ),
    bundleDigest: requireDigest(
      terminal.bundleDigest,
      "controlled bundleDigest",
    ),
    writeEpoch: requireNonNegativeInteger(
      terminal.writeEpoch,
      "controlled writeEpoch",
    ),
    committedAt: requireTimestamp(
      terminal.committedAt,
      "controlled committedAt",
    ),
    publicMutations,
  };
  const operationIntentDigest = requireDigest(
    terminal.operationIntentDigest,
    "controlled operationIntentDigest",
  );
  if (
    operationIntentDigest !== createShiftPlanningDigest(
      controlledOperationCore(withoutDigest),
    )
  ) {
    return failEvent("Controlled operation intent digest does not match.");
  }
  return {...withoutDigest, operationIntentDigest};
};

/**
 * Freezes one repair/sync-correction registry tombstone.
 * @param {CreateShiftPlanningControlledMutationOperationTerminalInput} input
 * Exact operation and public mutation bindings.
 * @return {ShiftPlanningControlledMutationOperationTerminal} Terminal record.
 */
export const createShiftPlanningControlledMutationOperationTerminal = (
  input: CreateShiftPlanningControlledMutationOperationTerminalInput,
): ShiftPlanningControlledMutationOperationTerminal => {
  const publicMutations = [...input.publicMutations].sort((left, right) => {
    if (left.targetPath === right.targetPath) {
      return 0;
    }
    return left.targetPath < right.targetPath ? -1 : 1;
  });
  const withoutDigest = {
    schemaVersion: SHIFT_PLANNING_PUBLIC_EVENT_SCHEMA_VERSION,
    operationKind: "controlledPublicMutation",
    state: "committed",
    ...input,
    publicMutations,
  } as const;
  return parseShiftPlanningControlledMutationOperationTerminal({
    ...withoutDigest,
    operationIntentDigest: createShiftPlanningDigest(
      controlledOperationCore(withoutDigest),
    ),
  });
};

const markerCore = (marker: ShiftPlanningBackendMutationMarker): object => ({
  schemaVersion: marker.schemaVersion,
  kind: marker.kind,
  operationId: marker.operationId,
  operationIntentDigest: marker.operationIntentDigest,
  bundleRevision: marker.bundleRevision,
  bundleDigest: marker.bundleDigest,
  writeEpoch: marker.writeEpoch,
  targetPath: marker.targetPath,
  documentRevision: marker.documentRevision,
  payloadDigest: marker.payloadDigest,
});

const optionalMarker = (
  value: unknown,
): ShiftPlanningBackendMutationMarker | null => {
  if (value === null) {
    return null;
  }
  const document = requireRecord(value, "public shift event document");
  if (!Object.prototype.hasOwnProperty.call(document, "lastBackendMutation")) {
    return null;
  }
  return parseShiftPlanningBackendMutationMarker(
    document.lastBackendMutation,
  );
};

const sameMarker = (
  left: ShiftPlanningBackendMutationMarker | null,
  right: ShiftPlanningBackendMutationMarker | null,
): boolean => {
  if (left === null || right === null) {
    return left === right;
  }
  return createShiftPlanningDigest(markerCore(left)) ===
    createShiftPlanningDigest(markerCore(right));
};

const controlledEventDigest = (input: {
  operationKind:
    | "activation"
    | "recovery"
    | ShiftPlanningControlledMutationKind;
  mutationKind: "create" | "update" | "delete";
  operationId: string;
  operationIntentDigest: string;
  targetPath: string;
  beforeMarker: ShiftPlanningBackendMutationMarker | null;
  afterMarker: ShiftPlanningBackendMutationMarker | null;
}): string => createShiftPlanningDigest({
  schemaVersion: SHIFT_PLANNING_PUBLIC_EVENT_SCHEMA_VERSION,
  operationKind: "publicShiftControlledNoOp",
  controlledKind: input.operationKind,
  mutationKind: input.mutationKind,
  operationId: input.operationId,
  operationIntentDigest: input.operationIntentDigest,
  targetPath: input.targetPath,
  beforeMarker: input.beforeMarker === null ? null : markerCore(
    input.beforeMarker,
  ),
  afterMarker: input.afterMarker === null ? null : markerCore(
    input.afterMarker,
  ),
});

const controlledDecision = (input: {
  operationKind:
    | "activation"
    | "recovery"
    | ShiftPlanningControlledMutationKind;
  mutationKind: "create" | "update" | "delete";
  operationId: string;
  operationIntentDigest: string;
  targetPath: string;
  beforeMarker: ShiftPlanningBackendMutationMarker | null;
  afterMarker: ShiftPlanningBackendMutationMarker | null;
}): ShiftPlanningPublicWriteEventDecision => ({
  kind: "controlledNoOp",
  operationKind: input.operationKind,
  mutationKind: input.mutationKind,
  operationId: input.operationId,
  operationIntentDigest: input.operationIntentDigest,
  targetPath: input.targetPath,
  eventDigest: controlledEventDigest(input),
});

const validateMarkedDocument = (input: {
  targetPath: string;
  value: unknown;
  expectedOperationIntentDigest: string;
}): ShiftPlanningPublicShiftDocument => parseShiftPlanningPublicShiftDocument({
  targetPath: input.targetPath,
  value: input.value,
  expectedOperationIntentDigest: input.expectedOperationIntentDigest,
});

const validateAfterBinding = (input: {
  document: ShiftPlanningPublicShiftDocument;
  binding: ShiftPlanningPublicMutationBinding | undefined;
  markerKind: "activation" | ShiftPlanningControlledMutationKind;
  operationId: string;
  operationIntentDigest: string;
  bundleRevision: string;
  bundleDigest: string;
  writeEpoch: number;
  targetPath: string;
  mutationKind: "create" | "update";
}): void => {
  const marker = input.document.lastBackendMutation;
  if (
    input.binding === undefined ||
    input.binding.mutationKind !== input.mutationKind ||
    input.binding.targetPath !== input.targetPath ||
    input.binding.documentRevision !== input.document.documentRevision ||
    input.binding.payloadDigest !== marker.payloadDigest ||
    marker.kind !== input.markerKind ||
    marker.operationId !== input.operationId ||
    marker.operationIntentDigest !== input.operationIntentDigest ||
    marker.bundleRevision !== input.bundleRevision ||
    marker.bundleDigest !== input.bundleDigest ||
    marker.writeEpoch !== input.writeEpoch ||
    marker.targetPath !== input.targetPath
  ) {
    return failEvent(
      "Changed backend marker is not authorized by its operation.",
    );
  }
};

const classifyChangedAfterMarker = (input: {
  targetPath: string;
  before: unknown | null;
  after: unknown;
  beforeMarker: ShiftPlanningBackendMutationMarker | null;
  afterMarker: ShiftPlanningBackendMutationMarker;
  operation: unknown;
}): ShiftPlanningPublicWriteEventDecision => {
  const mutationKind = input.before === null ? "create" : "update";
  const operationRecord = requireRecord(input.operation, "operation registry");
  if (operationRecord.operationKind === "activation") {
    const operation = parseShiftPlanningActivationOperationTerminal(
      operationRecord,
    );
    const document = validateMarkedDocument({
      targetPath: input.targetPath,
      value: input.after,
      expectedOperationIntentDigest: operation.operationIntentDigest,
    });
    validateAfterBinding({
      document,
      binding: operation.publicMutations.find((item) =>
        item.targetPath === input.targetPath),
      markerKind: "activation",
      operationId: operation.operationId,
      operationIntentDigest: operation.operationIntentDigest,
      bundleRevision: operation.bundleRevision,
      bundleDigest: operation.bundleDigest,
      writeEpoch: operation.writeEpoch,
      targetPath: input.targetPath,
      mutationKind,
    });
    return controlledDecision({
      operationKind: "activation",
      mutationKind,
      operationId: operation.operationId,
      operationIntentDigest: operation.operationIntentDigest,
      targetPath: input.targetPath,
      beforeMarker: input.beforeMarker,
      afterMarker: input.afterMarker,
    });
  }
  if (operationRecord.operationKind === "controlledPublicMutation") {
    const operation = parseShiftPlanningControlledMutationOperationTerminal(
      operationRecord,
    );
    const document = validateMarkedDocument({
      targetPath: input.targetPath,
      value: input.after,
      expectedOperationIntentDigest: operation.operationIntentDigest,
    });
    validateAfterBinding({
      document,
      binding: operation.publicMutations.find((item) =>
        item.targetPath === input.targetPath),
      markerKind: operation.kind,
      operationId: operation.operationId,
      operationIntentDigest: operation.operationIntentDigest,
      bundleRevision: operation.bundleRevision,
      bundleDigest: operation.bundleDigest,
      writeEpoch: operation.writeEpoch,
      targetPath: input.targetPath,
      mutationKind,
    });
    return controlledDecision({
      operationKind: operation.kind,
      mutationKind,
      operationId: operation.operationId,
      operationIntentDigest: operation.operationIntentDigest,
      targetPath: input.targetPath,
      beforeMarker: input.beforeMarker,
      afterMarker: input.afterMarker,
    });
  }
  return failEvent(
    "Changed backend marker has no supported operation registry.",
  );
};

const classifyDelete = (input: {
  targetPath: string;
  before: unknown | null;
  operation: unknown | null;
}): ShiftPlanningPublicWriteEventDecision => {
  if (input.before === null || input.operation === null) {
    return {kind: "ordinary", targetPath: input.targetPath};
  }
  const operationRecord = requireRecord(
    input.operation,
    "delete operation registry",
  );
  if (operationRecord.operationKind !== "activationRecovery") {
    return {kind: "ordinary", targetPath: input.targetPath};
  }
  const operation = parseShiftPlanningRecoveryOperationTerminal(
    operationRecord,
  );
  const document = validateMarkedDocument({
    targetPath: input.targetPath,
    value: input.before,
    expectedOperationIntentDigest: operation.activationOperationIntentDigest,
  });
  const marker = document.lastBackendMutation;
  if (
    !operation.deletedPaths.includes(input.targetPath) ||
    marker.kind !== "activation" ||
    marker.operationId !== operation.operationId ||
    marker.operationIntentDigest !==
      operation.activationOperationIntentDigest ||
    marker.bundleRevision !== operation.bundleRevision ||
    marker.bundleDigest !== operation.bundleDigest ||
    marker.writeEpoch !== operation.activationWriteEpoch ||
    marker.targetPath !== input.targetPath ||
    marker.documentRevision !== document.documentRevision
  ) {
    return failEvent("Recovery delete does not match its exact before-image.");
  }
  return controlledDecision({
    operationKind: "recovery",
    mutationKind: "delete",
    operationId: operation.recoveryOperationId,
    operationIntentDigest: operation.recoveryIntentDigest,
    targetPath: input.targetPath,
    beforeMarker: marker,
    afterMarker: null,
  });
};

/**
 * Classifies one candidate `onShiftWritten` event without performing I/O.
 * Only an exact changed create/update marker or manifested recovery delete is a
 * controlled no-op. Retained historical provenance stays on the ordinary path.
 * @param {object} input Before/after snapshots and optional operation record.
 * @return {ShiftPlanningPublicWriteEventDecision} Fail-closed event decision.
 */
export const classifyShiftPlanningPublicWriteEvent = (input: {
  targetPath: string;
  before: unknown | null;
  after: unknown | null;
  operation: unknown | null;
}): ShiftPlanningPublicWriteEventDecision => {
  const environment = input.targetPath.split("/")[0];
  if (environment !== "develop" && environment !== "production") {
    return failEvent("Public shift event environment is invalid.");
  }
  const targetPath = requireDocumentPath(
    input.targetPath,
    environment,
    "public shift event targetPath",
  );
  if (input.after === null) {
    return classifyDelete({
      targetPath,
      before: input.before,
      operation: input.operation,
    });
  }
  const beforeMarker = optionalMarker(input.before);
  const afterMarker = optionalMarker(input.after);
  if (afterMarker === null) {
    if (beforeMarker !== null) {
      return failEvent("A backend mutation marker was removed.");
    }
    return {kind: "ordinary", targetPath};
  }
  parseShiftPlanningPublicShiftDocument({
    targetPath,
    value: input.after,
  });
  if (sameMarker(beforeMarker, afterMarker)) {
    return {kind: "ordinary", targetPath};
  }
  if (input.operation === null) {
    return failEvent("Changed backend marker has no operation registry.");
  }
  return classifyChangedAfterMarker({
    targetPath,
    before: input.before,
    after: input.after,
    beforeMarker,
    afterMarker,
    operation: input.operation,
  });
};

/**
 * Adds a repair/sync-correction marker bound to its exact registry terminal.
 * @param {object} input Exact materialization and operation registry terminal.
 * @return {ShiftPlanningPublicShiftDocument} Marked public shift document.
 */
export const attachShiftPlanningControlledMutationMarker = (input: {
  materialization: ShiftPlanningPublicShiftMaterialization;
  operation: ShiftPlanningControlledMutationOperationTerminal;
}): ShiftPlanningPublicShiftDocument => {
  const operation = parseShiftPlanningControlledMutationOperationTerminal(
    input.operation,
  );
  const materialization = createShiftPlanningPublicShiftMaterialization({
    targetPath: input.materialization.targetPath,
    payload: input.materialization.payload,
  });
  const binding = operation.publicMutations.find((item) =>
    item.targetPath === materialization.targetPath);
  if (
    binding === undefined ||
    binding.documentRevision !== materialization.documentRevision ||
    binding.payloadDigest !== materialization.payloadDigest ||
    operation.environment !== materialization.targetPath.split("/")[0] ||
    operation.bundleRevision !== materialization.payload.bundleRevision ||
    operation.bundleDigest !== materialization.payload.bundleDigest ||
    operation.writeEpoch !== materialization.payload.writeEpoch
  ) {
    return failEvent(
      "Controlled materialization is absent from its operation.",
    );
  }
  return {
    ...materialization.payload,
    lastBackendMutation: {
      schemaVersion: SHIFT_PLANNING_PUBLIC_EVENT_SCHEMA_VERSION,
      kind: operation.kind,
      operationId: operation.operationId,
      operationIntentDigest: operation.operationIntentDigest,
      bundleRevision: operation.bundleRevision,
      bundleDigest: operation.bundleDigest,
      writeEpoch: operation.writeEpoch,
      targetPath: materialization.targetPath,
      documentRevision: materialization.documentRevision,
      payloadDigest: materialization.payloadDigest,
    },
  };
};
