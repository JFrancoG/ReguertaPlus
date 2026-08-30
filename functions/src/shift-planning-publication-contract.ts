import {
  GeoPoint,
  Timestamp,
} from "@google-cloud/firestore";
import {
  ShiftPlanningCandidatePosition,
  ShiftPlanningCandidateRotationPosition,
  parseShiftPlanningCandidatePosition,
} from "./shift-planning-candidate.js";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {
  ShiftPlanningCanonicalJsonObject,
  ShiftPlanningCanonicalJsonValue,
  createShiftPlanningDigest,
} from "./shift-planning-digest.js";
import {ShiftPlanningEnvironment} from "./shift-planning-wire.js";

export const SHIFT_PLANNING_PUBLICATION_SCHEMA_VERSION = 1 as const;
export const SHIFT_PLANNING_FIRESTORE_VALUE_CODEC_REVISION =
  "firestore-value-v1" as const;

type UnknownRecord = Record<string, unknown>;

export type ShiftPlanningEncodedFirestoreValue =
  | {kind: "null"}
  | {kind: "boolean"; value: boolean}
  | {kind: "number"; value: number}
  | {kind: "string"; value: string}
  | {kind: "timestamp"; seconds: number; nanoseconds: number}
  | {kind: "bytes"; base64: string}
  | {kind: "geoPoint"; latitude: number; longitude: number}
  | {
    kind: "array";
    values: readonly ShiftPlanningEncodedFirestoreValue[];
  }
  | {
    kind: "map";
    fields: readonly {
      name: string;
      value: ShiftPlanningEncodedFirestoreValue;
    }[];
  };

export type ShiftPlanningPublicCompletion =
  | {
    state: "uncompleted";
    revision: 0;
    actualHelperUserId: null;
    helperSourceAssignmentRevision: null;
    completedAt: null;
  }
  | {
    state: "completed";
    revision: number;
    actualHelperUserId: string | null;
    helperSourceAssignmentRevision: number | null;
    completedAt: Timestamp;
  };

export type ShiftPlanningPublicShiftPayload = {
  planningSchemaVersion: typeof SHIFT_PLANNING_PUBLICATION_SCHEMA_VERSION;
  type: "delivery" | "market";
  date: Timestamp;
  assignedUserIds: readonly string[];
  helperUserId: string | null;
  status: "planned" | "swap_pending" | "confirmed";
  source: "app";
  origin: "planner";
  planningRequestId: string;
  bundleRevision: string;
  bundleDigest: string;
  writeEpoch: number;
  projectionSeasonStartYear: number;
  rotationOwnerUserId: string | null;
  rotationOwnerUserIds: readonly string[] | null;
  roundNumber: number | null;
  positionInRound: number | null;
  rotationPositions: readonly ShiftPlanningCandidateRotationPosition[] | null;
  planningReason:
    | "target"
    | "boundaryRoundRemainder"
    | "finalGroupPadding"
    | null;
  assignmentRevision: number;
  completion: ShiftPlanningPublicCompletion;
  documentRevision: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type ShiftPlanningBackendMutationMarker = {
  schemaVersion: typeof SHIFT_PLANNING_PUBLICATION_SCHEMA_VERSION;
  kind: "activation" | "recovery" | "repair" | "syncCorrection";
  operationId: string;
  operationIntentDigest: string;
  bundleRevision: string;
  bundleDigest: string;
  writeEpoch: number;
  targetPath: string;
  documentRevision: number;
  payloadDigest: string;
};

export type ShiftPlanningPublicShiftDocument =
  ShiftPlanningPublicShiftPayload & {
    lastBackendMutation: ShiftPlanningBackendMutationMarker;
  };

export type ShiftPlanningPublicShiftMaterialization = {
  targetPath: string;
  payload: ShiftPlanningPublicShiftPayload;
  payloadDigest: string;
  documentRevision: number;
};

export type ShiftPlanningPublicMutationBinding = {
  mutationKind: "create" | "update";
  targetPath: string;
  documentRevision: number;
  payloadDigest: string;
};

export type ShiftPlanningBeforeImageBinding = {
  ordinal: number;
  targetPath: string;
  envelopePath: string;
  envelopeDigest: string;
};

export type ShiftPlanningActivationOperationTerminal = {
  schemaVersion: typeof SHIFT_PLANNING_PUBLICATION_SCHEMA_VERSION;
  operationKind: "activation";
  state: "committed";
  operationId: string;
  environment: ShiftPlanningEnvironment;
  requestId: string;
  candidateId: string;
  bundleRevision: string;
  bundleDigest: string;
  forwardManifestDigest: string;
  expectedStateDigest: string;
  writeEpoch: number;
  attemptedAt: Timestamp;
  publicMutations: readonly ShiftPlanningPublicMutationBinding[];
  beforeImages: readonly ShiftPlanningBeforeImageBinding[];
  operationIntentDigest: string;
};

export type ShiftPlanningBeforeImageEnvelope = {
  schemaVersion: typeof SHIFT_PLANNING_PUBLICATION_SCHEMA_VERSION;
  operationKind: "activationBeforeImage";
  operationId: string;
  environment: ShiftPlanningEnvironment;
  bundleRevision: string;
  bundleDigest: string;
  forwardManifestDigest: string;
  writeEpoch: number;
  ordinal: number;
  targetPath: string;
  envelopePath: string;
  targetUpdateTime: Timestamp;
  captureContractDigest: string;
  payload: Extract<ShiftPlanningEncodedFirestoreValue, {kind: "map"}>;
  payloadDigest: string;
  envelopeDigest: string;
};

export type CreateShiftPlanningActivationOperationTerminalInput = Omit<
  ShiftPlanningActivationOperationTerminal,
  "schemaVersion" | "operationKind" | "state" | "operationIntentDigest"
>;

export type CreateShiftPlanningBeforeImageEnvelopeInput = Omit<
  ShiftPlanningBeforeImageEnvelope,
  | "schemaVersion"
  | "operationKind"
  | "envelopePath"
  | "payload"
  | "payloadDigest"
  | "envelopeDigest"
> & {
  document: unknown;
};

const publicPayloadFields = [
  "planningSchemaVersion",
  "type",
  "date",
  "assignedUserIds",
  "helperUserId",
  "status",
  "source",
  "origin",
  "planningRequestId",
  "bundleRevision",
  "bundleDigest",
  "writeEpoch",
  "projectionSeasonStartYear",
  "rotationOwnerUserId",
  "rotationOwnerUserIds",
  "roundNumber",
  "positionInRound",
  "rotationPositions",
  "planningReason",
  "assignmentRevision",
  "completion",
  "documentRevision",
  "createdAt",
  "updatedAt",
] as const;

const terminalFields = [
  "schemaVersion",
  "operationKind",
  "state",
  "operationId",
  "environment",
  "requestId",
  "candidateId",
  "bundleRevision",
  "bundleDigest",
  "forwardManifestDigest",
  "expectedStateDigest",
  "writeEpoch",
  "attemptedAt",
  "publicMutations",
  "beforeImages",
  "operationIntentDigest",
] as const;

const beforeImageFields = [
  "schemaVersion",
  "operationKind",
  "operationId",
  "environment",
  "bundleRevision",
  "bundleDigest",
  "forwardManifestDigest",
  "writeEpoch",
  "ordinal",
  "targetPath",
  "envelopePath",
  "targetUpdateTime",
  "captureContractDigest",
  "payload",
  "payloadDigest",
  "envelopeDigest",
] as const;

const failPublication = (message: string): never => {
  throw new ShiftPlanningError(
    "invalid_planning_publication_contract",
    message,
  );
};

const compareCodeUnits = (left: string, right: string): number => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

const requireRecord = (value: unknown, path: string): UnknownRecord => {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (
      Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null
    ) ||
    Object.getOwnPropertySymbols(value).length > 0
  ) {
    return failPublication(`${path} must be a plain object.`);
  }
  return value as UnknownRecord;
};

const requireExactFields = (
  value: UnknownRecord,
  fields: readonly string[],
  path: string,
): void => {
  const keys = Object.getOwnPropertyNames(value);
  if (
    keys.length !== fields.length ||
    keys.some((key) => !fields.includes(key))
  ) {
    failPublication(`${path} fields must be exact.`);
  }
  for (const field of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      failPublication(`${path}.${field} must be a data property.`);
    }
  }
};

const requirePlainArray = (value: unknown, path: string): unknown[] => {
  if (
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    Object.getOwnPropertySymbols(value).length > 0
  ) {
    return failPublication(`${path} must be a plain array.`);
  }
  const expectedNames = new Set<string>(["length"]);
  for (let index = 0; index < value.length; index += 1) {
    const key = String(index);
    expectedNames.add(key);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      return failPublication(`${path}[${index}] must be a data property.`);
    }
  }
  if (Object.getOwnPropertyNames(value).some((key) =>
    !expectedNames.has(key))) {
    return failPublication(`${path} contains an extra array property.`);
  }
  return value;
};

const requireIdentifier = (value: unknown, path: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/.test(value)
  ) {
    return failPublication(`${path} must be a canonical identifier.`);
  }
  return value;
};

const requireDigest = (value: unknown, path: string): string => {
  if (
    typeof value !== "string" ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return failPublication(`${path} must be a canonical planning digest.`);
  }
  return value;
};

const requireNonNegativeInteger = (value: unknown, path: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return failPublication(`${path} must be a non-negative integer.`);
  }
  return value as number;
};

const requireSafeInteger = (value: unknown, path: string): number => {
  if (!Number.isSafeInteger(value)) {
    return failPublication(`${path} must be a safe integer.`);
  }
  return value as number;
};

const requirePositiveInteger = (value: unknown, path: string): number => {
  const parsed = requireNonNegativeInteger(value, path);
  if (parsed < 1) return failPublication(`${path} must be positive.`);
  return parsed;
};

const requireEnvironment = (value: unknown): ShiftPlanningEnvironment => {
  if (value !== "develop" && value !== "production") {
    return failPublication("environment is unsupported.");
  }
  return value;
};

const requireDocumentPath = (
  value: unknown,
  path: string,
  environment?: ShiftPlanningEnvironment,
): string => {
  if (
    typeof value !== "string" ||
    value !== value.trim() ||
    value.length < 3 ||
    value.length > 6_144 ||
    value.startsWith("/") ||
    value.endsWith("/") ||
    value.includes("//")
  ) {
    return failPublication(`${path} must be a canonical document path.`);
  }
  const segments = value.split("/");
  if (
    segments.length % 2 !== 0 ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    return failPublication(`${path} must identify one document.`);
  }
  if (
    environment !== undefined &&
    (segments[0] !== environment || segments[1] !== "plus-collections")
  ) {
    return failPublication(`${path} escapes its environment root.`);
  }
  return value;
};

const requireTimestamp = (value: unknown, path: string): Timestamp => {
  if (!(value instanceof Timestamp)) {
    return failPublication(`${path} must be a Firestore Timestamp.`);
  }
  return value;
};

const timestampCanonical = (
  value: Timestamp,
): ShiftPlanningCanonicalJsonObject => ({
  seconds: value.seconds,
  nanoseconds: value.nanoseconds,
});

const timestampCompare = (left: Timestamp, right: Timestamp): number =>
  left.seconds === right.seconds ?
    left.nanoseconds - right.nanoseconds :
    left.seconds - right.seconds;

const requireStringArray = (
  value: unknown,
  path: string,
  expectedCount?: number,
): readonly string[] => {
  const array = requirePlainArray(value, path);
  const result = array.map((item, index) =>
    requireIdentifier(item, `${path}[${index}]`));
  if (
    new Set(result).size !== result.length ||
    (expectedCount !== undefined && result.length !== expectedCount)
  ) {
    return failPublication(`${path} cardinality is invalid.`);
  }
  return result;
};

const encodedValueCanonical = (
  value: ShiftPlanningEncodedFirestoreValue,
): ShiftPlanningCanonicalJsonValue => value as ShiftPlanningCanonicalJsonValue;

const encodeFirestoreValue = (
  value: unknown,
  path: string,
  ancestors: Set<object>,
): ShiftPlanningEncodedFirestoreValue => {
  if (value === null) return {kind: "null"};
  if (typeof value === "boolean") return {kind: "boolean", value};
  if (typeof value === "string") return {kind: "string", value};
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return failPublication(`${path} contains a non-finite number.`);
    }
    return {kind: "number", value};
  }
  if (value instanceof Timestamp) {
    return {
      kind: "timestamp",
      seconds: value.seconds,
      nanoseconds: value.nanoseconds,
    };
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return {kind: "bytes", base64: Buffer.from(value).toString("base64")};
  }
  if (value instanceof GeoPoint) {
    return {
      kind: "geoPoint",
      latitude: value.latitude,
      longitude: value.longitude,
    };
  }
  if (typeof value !== "object") {
    return failPublication(`${path} contains unsupported ${typeof value}.`);
  }
  if (ancestors.has(value)) {
    return failPublication(`${path} contains a cycle.`);
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const array = requirePlainArray(value, path);
      return {
        kind: "array",
        values: array.map((item, index) =>
          encodeFirestoreValue(item, `${path}[${index}]`, ancestors)),
      };
    }
    const record = requireRecord(value, path);
    const fields = Object.getOwnPropertyNames(record)
      .sort(compareCodeUnits)
      .map((name) => {
        if (name === "__proto__") {
          return failPublication(`${path} contains a reserved field name.`);
        }
        const descriptor = Object.getOwnPropertyDescriptor(record, name);
        if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
          return failPublication(`${path}.${name} must be a data property.`);
        }
        return {
          name,
          value: encodeFirestoreValue(
            descriptor.value,
            `${path}.${name}`,
            ancestors,
          ),
        };
      });
    return {kind: "map", fields};
  } finally {
    ancestors.delete(value);
  }
};

const parseEncodedValue = (
  value: unknown,
  path: string,
): ShiftPlanningEncodedFirestoreValue => {
  const encoded = requireRecord(value, path);
  const kind = encoded.kind;
  if (kind === "null") {
    requireExactFields(encoded, ["kind"], path);
    return {kind};
  }
  if (kind === "boolean") {
    requireExactFields(encoded, ["kind", "value"], path);
    if (typeof encoded.value !== "boolean") {
      return failPublication(`${path}.value must be boolean.`);
    }
    return {kind, value: encoded.value};
  }
  if (kind === "number") {
    requireExactFields(encoded, ["kind", "value"], path);
    if (typeof encoded.value !== "number" || !Number.isFinite(encoded.value)) {
      return failPublication(`${path}.value must be finite.`);
    }
    return {kind, value: encoded.value};
  }
  if (kind === "string") {
    requireExactFields(encoded, ["kind", "value"], path);
    if (typeof encoded.value !== "string") {
      return failPublication(`${path}.value must be string.`);
    }
    return {kind, value: encoded.value};
  }
  if (kind === "timestamp") {
    requireExactFields(encoded, ["kind", "seconds", "nanoseconds"], path);
    const seconds = requireSafeInteger(
      encoded.seconds,
      `${path}.seconds`,
    );
    const nanoseconds = requireNonNegativeInteger(
      encoded.nanoseconds,
      `${path}.nanoseconds`,
    );
    if (nanoseconds > 999_999_999) {
      return failPublication(`${path}.nanoseconds is invalid.`);
    }
    try {
      new Timestamp(seconds, nanoseconds);
    } catch {
      return failPublication(`${path} is outside Firestore Timestamp range.`);
    }
    return {kind, seconds, nanoseconds};
  }
  if (kind === "bytes") {
    requireExactFields(encoded, ["kind", "base64"], path);
    if (typeof encoded.base64 !== "string") {
      return failPublication(`${path}.base64 must be string.`);
    }
    const bytes = Buffer.from(encoded.base64, "base64");
    if (bytes.toString("base64") !== encoded.base64) {
      return failPublication(`${path}.base64 is not canonical.`);
    }
    return {kind, base64: encoded.base64};
  }
  if (kind === "geoPoint") {
    requireExactFields(encoded, ["kind", "latitude", "longitude"], path);
    if (
      typeof encoded.latitude !== "number" ||
      typeof encoded.longitude !== "number" ||
      !Number.isFinite(encoded.latitude) ||
      !Number.isFinite(encoded.longitude)
    ) {
      return failPublication(`${path} GeoPoint coordinates are invalid.`);
    }
    try {
      new GeoPoint(encoded.latitude, encoded.longitude);
    } catch {
      return failPublication(`${path} GeoPoint is outside range.`);
    }
    return {
      kind,
      latitude: encoded.latitude,
      longitude: encoded.longitude,
    };
  }
  if (kind === "array") {
    requireExactFields(encoded, ["kind", "values"], path);
    const values = requirePlainArray(encoded.values, `${path}.values`).map(
      (item, index) => parseEncodedValue(item, `${path}.values[${index}]`),
    );
    return {kind, values};
  }
  if (kind === "map") {
    requireExactFields(encoded, ["kind", "fields"], path);
    const fields = requirePlainArray(encoded.fields, `${path}.fields`).map(
      (item, index) => {
        const field = requireRecord(item, `${path}.fields[${index}]`);
        requireExactFields(
          field,
          ["name", "value"],
          `${path}.fields[${index}]`,
        );
        if (typeof field.name !== "string" || field.name === "__proto__") {
          return failPublication(`${path}.fields[${index}].name is invalid.`);
        }
        return {
          name: field.name,
          value: parseEncodedValue(
            field.value,
            `${path}.fields[${index}].value`,
          ),
        };
      },
    );
    for (let index = 1; index < fields.length; index += 1) {
      if (compareCodeUnits(fields[index - 1].name, fields[index].name) >= 0) {
        return failPublication(`${path}.fields are not strictly ordered.`);
      }
    }
    return {kind, fields};
  }
  return failPublication(`${path}.kind is unsupported.`);
};

const decodeEncodedValue = (
  value: ShiftPlanningEncodedFirestoreValue,
): unknown => {
  if (value.kind === "null") return null;
  if (
    value.kind === "boolean" ||
    value.kind === "number" ||
    value.kind === "string"
  ) {
    return value.value;
  }
  if (value.kind === "timestamp") {
    return new Timestamp(value.seconds, value.nanoseconds);
  }
  if (value.kind === "bytes") return Buffer.from(value.base64, "base64");
  if (value.kind === "geoPoint") {
    return new GeoPoint(value.latitude, value.longitude);
  }
  if (value.kind === "array") return value.values.map(decodeEncodedValue);
  const result: Record<string, unknown> = {};
  value.fields.forEach((field) => {
    Object.defineProperty(result, field.name, {
      configurable: true,
      enumerable: true,
      value: decodeEncodedValue(field.value),
      writable: true,
    });
  });
  return result;
};

const firestorePayloadDigest = (
  value: ShiftPlanningEncodedFirestoreValue,
): string => createShiftPlanningDigest({
  codecRevision: SHIFT_PLANNING_FIRESTORE_VALUE_CODEC_REVISION,
  value: encodedValueCanonical(value),
});

const parseRotationPosition = (
  value: unknown,
  path: string,
): ShiftPlanningCandidateRotationPosition => {
  const position = requireRecord(value, path);
  requireExactFields(position, [
    "rotationOwnerUserId",
    "effectiveAssigneeUserId",
    "roundNumber",
    "positionInRound",
    "planningReason",
  ], path);
  const planningReason = position.planningReason;
  if (
    planningReason !== "target" &&
    planningReason !== "boundaryRoundRemainder" &&
    planningReason !== "finalGroupPadding"
  ) {
    return failPublication(`${path}.planningReason is unsupported.`);
  }
  return {
    rotationOwnerUserId: requireIdentifier(
      position.rotationOwnerUserId,
      `${path}.rotationOwnerUserId`,
    ),
    effectiveAssigneeUserId: requireIdentifier(
      position.effectiveAssigneeUserId,
      `${path}.effectiveAssigneeUserId`,
    ),
    roundNumber: requirePositiveInteger(
      position.roundNumber,
      `${path}.roundNumber`,
    ),
    positionInRound: requirePositiveInteger(
      position.positionInRound,
      `${path}.positionInRound`,
    ),
    planningReason,
  };
};

const parseCompletion = (
  value: unknown,
  type: "delivery" | "market",
  assignmentRevision: number,
): ShiftPlanningPublicCompletion => {
  const completion = requireRecord(value, "public shift completion");
  requireExactFields(completion, [
    "state",
    "revision",
    "actualHelperUserId",
    "helperSourceAssignmentRevision",
    "completedAt",
  ], "public shift completion");
  if (completion.state === "uncompleted") {
    if (
      completion.revision !== 0 ||
      completion.actualHelperUserId !== null ||
      completion.helperSourceAssignmentRevision !== null ||
      completion.completedAt !== null
    ) {
      return failPublication("Uncompleted shift metadata is inconsistent.");
    }
    return {
      state: "uncompleted",
      revision: 0,
      actualHelperUserId: null,
      helperSourceAssignmentRevision: null,
      completedAt: null,
    };
  }
  if (completion.state !== "completed") {
    return failPublication("Public shift completion state is unsupported.");
  }
  const revision = requirePositiveInteger(
    completion.revision,
    "public shift completion.revision",
  );
  const completedAt = requireTimestamp(
    completion.completedAt,
    "public shift completion.completedAt",
  );
  if (type === "delivery") {
    const actualHelperUserId = requireIdentifier(
      completion.actualHelperUserId,
      "public shift completion.actualHelperUserId",
    );
    const helperSourceAssignmentRevision = requirePositiveInteger(
      completion.helperSourceAssignmentRevision,
      "public shift completion.helperSourceAssignmentRevision",
    );
    if (helperSourceAssignmentRevision > assignmentRevision) {
      return failPublication(
        "Helper completion references a future assignment.",
      );
    }
    return {
      state: "completed",
      revision,
      actualHelperUserId,
      helperSourceAssignmentRevision,
      completedAt,
    };
  }
  if (
    completion.actualHelperUserId !== null ||
    completion.helperSourceAssignmentRevision !== null
  ) {
    return failPublication("Market completion cannot record a helper.");
  }
  return {
    state: "completed",
    revision,
    actualHelperUserId: null,
    helperSourceAssignmentRevision: null,
    completedAt,
  };
};

const calendarDate = (timestamp: Timestamp): string => {
  const date = timestamp.toDate();
  if (
    date.getUTCHours() !== 0 ||
    date.getUTCMinutes() !== 0 ||
    date.getUTCSeconds() !== 0 ||
    date.getUTCMilliseconds() !== 0 ||
    timestamp.nanoseconds !== 0
  ) {
    return failPublication("Public shift date must be UTC midnight.");
  }
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1)
    .padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
};

const dateTimestamp = (value: string): Timestamp => {
  const millis = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(millis)) {
    return failPublication("Candidate scheduledDate is invalid.");
  }
  return Timestamp.fromMillis(millis);
};

const projectionSeason = (date: string): number => {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return month >= 9 ? year : year - 1;
};

const parsePublicPayload = (
  value: unknown,
): ShiftPlanningPublicShiftPayload => {
  const payload = requireRecord(value, "public shift payload");
  requireExactFields(payload, publicPayloadFields, "public shift payload");
  if (
    payload.planningSchemaVersion !==
      SHIFT_PLANNING_PUBLICATION_SCHEMA_VERSION ||
    (payload.type !== "delivery" && payload.type !== "market") ||
    (
      payload.status !== "planned" &&
      payload.status !== "swap_pending" &&
      payload.status !== "confirmed"
    ) ||
    payload.source !== "app" ||
    payload.origin !== "planner"
  ) {
    return failPublication("Public shift discriminators are invalid.");
  }
  const type = payload.type;
  const expectedCount = type === "delivery" ? 1 : 3;
  const date = requireTimestamp(payload.date, "public shift date");
  const dateText = calendarDate(date);
  const assignedUserIds = requireStringArray(
    payload.assignedUserIds,
    "public shift assignedUserIds",
    expectedCount,
  );
  const assignmentRevision = requirePositiveInteger(
    payload.assignmentRevision,
    "public shift assignmentRevision",
  );
  const createdAt = requireTimestamp(
    payload.createdAt,
    "public shift createdAt",
  );
  const updatedAt = requireTimestamp(
    payload.updatedAt,
    "public shift updatedAt",
  );
  if (timestampCompare(updatedAt, createdAt) < 0) {
    return failPublication("Public shift timestamps are inconsistent.");
  }
  const projectionSeasonStartYear = requirePositiveInteger(
    payload.projectionSeasonStartYear,
    "public shift projectionSeasonStartYear",
  );
  if (projectionSeasonStartYear !== projectionSeason(dateText)) {
    return failPublication("Public shift projection season is inconsistent.");
  }
  const helperUserId = payload.helperUserId === null ?
    null : requireIdentifier(payload.helperUserId, "public shift helperUserId");
  let rotationOwnerUserId: string | null;
  let rotationOwnerUserIds: readonly string[] | null;
  let roundNumber: number | null;
  let positionInRound: number | null;
  let rotationPositions:
    readonly ShiftPlanningCandidateRotationPosition[] | null;
  let planningReason: ShiftPlanningPublicShiftPayload["planningReason"];
  if (type === "delivery") {
    rotationOwnerUserId = requireIdentifier(
      payload.rotationOwnerUserId,
      "public shift rotationOwnerUserId",
    );
    if (
      payload.rotationOwnerUserIds !== null ||
      payload.rotationPositions !== null
    ) {
      return failPublication("Delivery rotation shape is inconsistent.");
    }
    roundNumber = requirePositiveInteger(
      payload.roundNumber,
      "public shift roundNumber",
    );
    positionInRound = requirePositiveInteger(
      payload.positionInRound,
      "public shift positionInRound",
    );
    if (
      payload.planningReason !== "target" &&
      payload.planningReason !== "boundaryRoundRemainder"
    ) {
      return failPublication("Delivery planningReason is unsupported.");
    }
    rotationOwnerUserIds = null;
    rotationPositions = null;
    planningReason = payload.planningReason;
  } else {
    if (
      payload.rotationOwnerUserId !== null ||
      payload.roundNumber !== null ||
      payload.positionInRound !== null ||
      payload.planningReason !== null ||
      helperUserId !== null
    ) {
      return failPublication("Market scalar rotation shape is inconsistent.");
    }
    rotationOwnerUserIds = requireStringArray(
      payload.rotationOwnerUserIds,
      "public shift rotationOwnerUserIds",
      3,
    );
    const positions = requirePlainArray(
      payload.rotationPositions,
      "public shift rotationPositions",
    ).map((position, index) => parseRotationPosition(
      position,
      `public shift rotationPositions[${index}]`,
    ));
    if (
      positions.length !== 3 ||
      positions.some((position, index) =>
        position.rotationOwnerUserId !== rotationOwnerUserIds?.[index] ||
        position.effectiveAssigneeUserId !== assignedUserIds[index])
    ) {
      return failPublication("Market rotation positions are inconsistent.");
    }
    rotationOwnerUserId = null;
    roundNumber = null;
    positionInRound = null;
    rotationPositions = positions;
    planningReason = null;
  }
  const completion = parseCompletion(
    payload.completion,
    type,
    assignmentRevision,
  );
  const documentRevision = requirePositiveInteger(
    payload.documentRevision,
    "public shift documentRevision",
  );
  if (
    assignmentRevision > documentRevision ||
    completion.revision > documentRevision ||
    (
      completion.state === "completed" &&
      (
        timestampCompare(completion.completedAt, createdAt) < 0 ||
        timestampCompare(completion.completedAt, updatedAt) > 0
      )
    )
  ) {
    return failPublication("Public shift revisions are inconsistent.");
  }
  return {
    planningSchemaVersion: SHIFT_PLANNING_PUBLICATION_SCHEMA_VERSION,
    type,
    date,
    assignedUserIds,
    helperUserId,
    status: payload.status,
    source: "app",
    origin: "planner",
    planningRequestId: requireIdentifier(
      payload.planningRequestId,
      "public shift planningRequestId",
    ),
    bundleRevision: requireIdentifier(
      payload.bundleRevision,
      "public shift bundleRevision",
    ),
    bundleDigest: requireDigest(
      payload.bundleDigest,
      "public shift bundleDigest",
    ),
    writeEpoch: requireNonNegativeInteger(
      payload.writeEpoch,
      "public shift writeEpoch",
    ),
    projectionSeasonStartYear,
    rotationOwnerUserId,
    rotationOwnerUserIds,
    roundNumber,
    positionInRound,
    rotationPositions,
    planningReason,
    assignmentRevision,
    completion,
    documentRevision,
    createdAt,
    updatedAt,
  };
};

const publicPayloadRecord = (
  value: ShiftPlanningPublicShiftPayload,
): Record<string, unknown> => ({...value});

const publicMaterialization = (
  targetPath: string,
  payload: unknown,
): ShiftPlanningPublicShiftMaterialization => {
  const parsed = parsePublicPayload(payload);
  const path = requireDocumentPath(targetPath, "public shift targetPath");
  const segments = path.split("/");
  const date = calendarDate(parsed.date).replace(/-/g, "");
  const expectedId = `shift_${parsed.type}_${date}`;
  if (
    segments.length !== 4 ||
    segments[1] !== "plus-collections" ||
    segments[2] !== "shifts" ||
    segments[3] !== expectedId
  ) {
    return failPublication(
      "Public shift targetPath does not match its payload.",
    );
  }
  const encoded = encodeFirestoreValue(
    publicPayloadRecord(parsed),
    "public shift payload",
    new Set(),
  );
  return {
    targetPath: path,
    payload: parsed,
    payloadDigest: firestorePayloadDigest(encoded),
    documentRevision: parsed.documentRevision,
  };
};

/**
 * Recomputes a mutation-ready public materialization after an exact controlled
 * edit. The payload excludes its backend marker so the payload digest is not
 * self-referential.
 * @param {{targetPath: string, payload: unknown}} input Exact path and payload.
 * @return {ShiftPlanningPublicShiftMaterialization} Canonical binding.
 */
export const createShiftPlanningPublicShiftMaterialization = (input: {
  targetPath: string;
  payload: unknown;
}): ShiftPlanningPublicShiftMaterialization => publicMaterialization(
  input.targetPath,
  input.payload,
);

/**
 * Converts one immutable staged position into the exact flat public document
 * payload consumed by installed Android and iOS clients. The returned payload
 * intentionally has no backend marker until its operation intent is frozen.
 * @param {{environment: ShiftPlanningEnvironment,
 * position: unknown, attemptedAt: Timestamp}} input Candidate and attempt time.
 * @return {ShiftPlanningPublicShiftMaterialization} Exact create binding.
 */
export const buildShiftPlanningPublicShiftMaterialization = (input: {
  environment: ShiftPlanningEnvironment;
  position: unknown;
  attemptedAt: Timestamp;
}): ShiftPlanningPublicShiftMaterialization => {
  const environment = requireEnvironment(input.environment);
  const position: ShiftPlanningCandidatePosition =
    parseShiftPlanningCandidatePosition(input.position);
  const attemptedAt = requireTimestamp(input.attemptedAt, "attemptedAt");
  const firstPosition = position.rotationPositions[0];
  const payload: ShiftPlanningPublicShiftPayload = {
    planningSchemaVersion: SHIFT_PLANNING_PUBLICATION_SCHEMA_VERSION,
    type: position.type,
    date: dateTimestamp(position.scheduledDate),
    assignedUserIds: [...position.assignedUserIds],
    helperUserId: position.helperUserId,
    status: "planned",
    source: "app",
    origin: "planner",
    planningRequestId: position.planningRequestId,
    bundleRevision: position.bundleRevision,
    bundleDigest: position.bundleDigest,
    writeEpoch: position.writeEpoch,
    projectionSeasonStartYear: position.projectionSeasonStartYear,
    rotationOwnerUserId: position.type === "delivery" ?
      firstPosition.rotationOwnerUserId : null,
    rotationOwnerUserIds: position.type === "market" ?
      [...position.rotationOwnerUserIds] : null,
    roundNumber: position.type === "delivery" ?
      firstPosition.roundNumber : null,
    positionInRound: position.type === "delivery" ?
      firstPosition.positionInRound : null,
    rotationPositions: position.type === "market" ?
      position.rotationPositions.map((item) => ({...item})) : null,
    planningReason: position.type === "delivery" ?
      firstPosition.planningReason : null,
    assignmentRevision: 1,
    completion: {
      state: "uncompleted",
      revision: 0,
      actualHelperUserId: null,
      helperSourceAssignmentRevision: null,
      completedAt: null,
    },
    documentRevision: 1,
    createdAt: attemptedAt,
    updatedAt: attemptedAt,
  };
  return publicMaterialization(
    `${environment}/plus-collections/shifts/${position.shiftId}`,
    payload,
  );
};

const parsePublicMutationBinding = (
  value: unknown,
  index: number,
  environment: ShiftPlanningEnvironment,
): ShiftPlanningPublicMutationBinding => {
  const path = `activation publicMutations[${index}]`;
  const binding = requireRecord(value, path);
  requireExactFields(binding, [
    "mutationKind",
    "targetPath",
    "documentRevision",
    "payloadDigest",
  ], path);
  if (binding.mutationKind !== "create" && binding.mutationKind !== "update") {
    return failPublication(`${path}.mutationKind is unsupported.`);
  }
  const targetPath = requireDocumentPath(
    binding.targetPath,
    `${path}.targetPath`,
    environment,
  );
  const segments = targetPath.split("/");
  if (
    segments.length !== 4 ||
    segments[1] !== "plus-collections" ||
    segments[2] !== "shifts"
  ) {
    return failPublication(`${path}.targetPath is not public shift data.`);
  }
  return {
    mutationKind: binding.mutationKind,
    targetPath,
    documentRevision: requirePositiveInteger(
      binding.documentRevision,
      `${path}.documentRevision`,
    ),
    payloadDigest: requireDigest(
      binding.payloadDigest,
      `${path}.payloadDigest`,
    ),
  };
};

const parseBeforeImageBinding = (
  value: unknown,
  index: number,
  environment: ShiftPlanningEnvironment,
  operationId: string,
): ShiftPlanningBeforeImageBinding => {
  const path = `activation beforeImages[${index}]`;
  const binding = requireRecord(value, path);
  requireExactFields(binding, [
    "ordinal",
    "targetPath",
    "envelopePath",
    "envelopeDigest",
  ], path);
  const ordinal = requirePositiveInteger(binding.ordinal, `${path}.ordinal`);
  const targetPath = requireDocumentPath(
    binding.targetPath,
    `${path}.targetPath`,
    environment,
  );
  const envelopePath = requireDocumentPath(
    binding.envelopePath,
    `${path}.envelopePath`,
    environment,
  );
  const expectedEnvelopePath = `${environment}/plus-collections/` +
    `shiftPlanningOperations/${operationId}/beforeImages/${ordinal}`;
  if (envelopePath !== expectedEnvelopePath) {
    return failPublication(`${path}.envelopePath is not canonical.`);
  }
  return {
    ordinal,
    targetPath,
    envelopePath,
    envelopeDigest: requireDigest(
      binding.envelopeDigest,
      `${path}.envelopeDigest`,
    ),
  };
};

const operationIntentCore = (
  value: Omit<
    ShiftPlanningActivationOperationTerminal,
    "operationIntentDigest"
  >,
): ShiftPlanningCanonicalJsonObject => ({
  schemaVersion: value.schemaVersion,
  operationKind: value.operationKind,
  operationId: value.operationId,
  environment: value.environment,
  requestId: value.requestId,
  candidateId: value.candidateId,
  bundleRevision: value.bundleRevision,
  bundleDigest: value.bundleDigest,
  forwardManifestDigest: value.forwardManifestDigest,
  expectedStateDigest: value.expectedStateDigest,
  writeEpoch: value.writeEpoch,
  attemptedAt: timestampCanonical(value.attemptedAt),
  publicMutations: value.publicMutations as unknown as
    ShiftPlanningCanonicalJsonValue,
  beforeImages: value.beforeImages as unknown as
    ShiftPlanningCanonicalJsonValue,
});

/**
 * Freezes the append-only operation tombstone that an atomic activation must
 * create with its public mutations. `attemptedAt` is the trusted callback clock
 * sample, not a claim about server acknowledgement time.
 * @param {CreateShiftPlanningActivationOperationTerminalInput} input Exact
 * operation, public mutation, and before-image bindings.
 * @return {ShiftPlanningActivationOperationTerminal} Canonical tombstone.
 */
export const createShiftPlanningActivationOperationTerminal = (
  input: CreateShiftPlanningActivationOperationTerminalInput,
): ShiftPlanningActivationOperationTerminal => {
  const normalizedInput: CreateShiftPlanningActivationOperationTerminalInput = {
    ...input,
    publicMutations: [...input.publicMutations].sort((left, right) =>
      compareCodeUnits(left.targetPath, right.targetPath)),
    beforeImages: [...input.beforeImages].sort((left, right) =>
      left.ordinal - right.ordinal),
  };
  const terminal = {
    schemaVersion: SHIFT_PLANNING_PUBLICATION_SCHEMA_VERSION,
    operationKind: "activation",
    state: "committed",
    ...normalizedInput,
  } as const;
  return parseShiftPlanningActivationOperationTerminal({
    ...terminal,
    operationIntentDigest: createShiftPlanningDigest(
      operationIntentCore(terminal),
    ),
  });
};

/**
 * Parses an immutable activation registry tombstone and recomputes its intent
 * digest. Public mutations are target-sorted and before-images use contiguous
 * one-based ordinals, making replay comparison deterministic.
 * @param {unknown} value Untrusted terminal operation record.
 * @return {ShiftPlanningActivationOperationTerminal} Canonical record.
 */
export const parseShiftPlanningActivationOperationTerminal = (
  value: unknown,
): ShiftPlanningActivationOperationTerminal => {
  const terminal = requireRecord(value, "activation terminal");
  requireExactFields(terminal, terminalFields, "activation terminal");
  if (
    terminal.schemaVersion !== SHIFT_PLANNING_PUBLICATION_SCHEMA_VERSION ||
    terminal.operationKind !== "activation" ||
    terminal.state !== "committed"
  ) {
    return failPublication("Activation terminal discriminators are invalid.");
  }
  const environment = requireEnvironment(terminal.environment);
  const operationId = requireIdentifier(
    terminal.operationId,
    "activation terminal.operationId",
  );
  const publicMutations = requirePlainArray(
    terminal.publicMutations,
    "activation terminal.publicMutations",
  ).map((item, index) => parsePublicMutationBinding(
    item,
    index,
    environment,
  ));
  if (publicMutations.length < 1) {
    return failPublication("Activation must bind a public mutation.");
  }
  for (let index = 1; index < publicMutations.length; index += 1) {
    if (
      compareCodeUnits(
        publicMutations[index - 1].targetPath,
        publicMutations[index].targetPath,
      ) >= 0
    ) {
      return failPublication("Activation public mutations are not ordered.");
    }
  }
  const beforeImages = requirePlainArray(
    terminal.beforeImages,
    "activation terminal.beforeImages",
  ).map((item, index) => parseBeforeImageBinding(
    item,
    index,
    environment,
    operationId,
  ));
  if (beforeImages.some((item, index) => item.ordinal !== index + 1)) {
    return failPublication(
      "Activation before-image ordinals are not contiguous.",
    );
  }
  if (
    new Set(beforeImages.map((item) => item.targetPath)).size !==
      beforeImages.length ||
    new Set(beforeImages.map((item) => item.envelopePath)).size !==
      beforeImages.length
  ) {
    return failPublication("Activation before-images contain duplicate paths.");
  }
  const beforeImageTargets = new Set(
    beforeImages.map((item) => item.targetPath),
  );
  if (
    publicMutations.some((item) =>
      item.mutationKind === "update" &&
      !beforeImageTargets.has(item.targetPath))
  ) {
    return failPublication(
      "Every updated public shift requires its exact before-image.",
    );
  }
  const parsedWithoutDigest: Omit<
    ShiftPlanningActivationOperationTerminal,
    "operationIntentDigest"
  > = {
    schemaVersion: SHIFT_PLANNING_PUBLICATION_SCHEMA_VERSION,
    operationKind: "activation",
    state: "committed",
    operationId,
    environment,
    requestId: requireIdentifier(terminal.requestId, "activation requestId"),
    candidateId: requireIdentifier(
      terminal.candidateId,
      "activation candidateId",
    ),
    bundleRevision: requireIdentifier(
      terminal.bundleRevision,
      "activation bundleRevision",
    ),
    bundleDigest: requireDigest(
      terminal.bundleDigest,
      "activation bundleDigest",
    ),
    forwardManifestDigest: requireDigest(
      terminal.forwardManifestDigest,
      "activation forwardManifestDigest",
    ),
    expectedStateDigest: requireDigest(
      terminal.expectedStateDigest,
      "activation expectedStateDigest",
    ),
    writeEpoch: requireNonNegativeInteger(
      terminal.writeEpoch,
      "activation writeEpoch",
    ),
    attemptedAt: requireTimestamp(
      terminal.attemptedAt,
      "activation attemptedAt",
    ),
    publicMutations,
    beforeImages,
  };
  const operationIntentDigest = requireDigest(
    terminal.operationIntentDigest,
    "activation operationIntentDigest",
  );
  if (
    operationIntentDigest !==
      createShiftPlanningDigest(operationIntentCore(parsedWithoutDigest))
  ) {
    return failPublication(
      "Activation operation intent digest does not match.",
    );
  }
  return {...parsedWithoutDigest, operationIntentDigest};
};

export const parseShiftPlanningBackendMutationMarker = (
  value: unknown,
): ShiftPlanningBackendMutationMarker => {
  const marker = requireRecord(value, "public shift lastBackendMutation");
  requireExactFields(marker, [
    "schemaVersion",
    "kind",
    "operationId",
    "operationIntentDigest",
    "bundleRevision",
    "bundleDigest",
    "writeEpoch",
    "targetPath",
    "documentRevision",
    "payloadDigest",
  ], "public shift lastBackendMutation");
  if (
    marker.schemaVersion !== SHIFT_PLANNING_PUBLICATION_SCHEMA_VERSION ||
    (
      marker.kind !== "activation" &&
      marker.kind !== "recovery" &&
      marker.kind !== "repair" &&
      marker.kind !== "syncCorrection"
    )
  ) {
    return failPublication("Backend mutation marker is unsupported.");
  }
  return {
    schemaVersion: SHIFT_PLANNING_PUBLICATION_SCHEMA_VERSION,
    kind: marker.kind,
    operationId: requireIdentifier(marker.operationId, "marker operationId"),
    operationIntentDigest: requireDigest(
      marker.operationIntentDigest,
      "marker operationIntentDigest",
    ),
    bundleRevision: requireIdentifier(
      marker.bundleRevision,
      "marker bundleRevision",
    ),
    bundleDigest: requireDigest(marker.bundleDigest, "marker bundleDigest"),
    writeEpoch: requireNonNegativeInteger(
      marker.writeEpoch,
      "marker writeEpoch",
    ),
    targetPath: requireDocumentPath(marker.targetPath, "marker targetPath"),
    documentRevision: requirePositiveInteger(
      marker.documentRevision,
      "marker documentRevision",
    ),
    payloadDigest: requireDigest(marker.payloadDigest, "marker payloadDigest"),
  };
};

/**
 * Adds the non-self-referential activation marker after the operation intent is
 * frozen. The exact public payload must be listed in that terminal operation.
 * @param {{materialization: ShiftPlanningPublicShiftMaterialization,
 * operation: ShiftPlanningActivationOperationTerminal}} input Binding pair.
 * @return {ShiftPlanningPublicShiftDocument} Marked public document.
 */
export const attachShiftPlanningBackendMutationMarker = (input: {
  materialization: ShiftPlanningPublicShiftMaterialization;
  operation: ShiftPlanningActivationOperationTerminal;
}): ShiftPlanningPublicShiftDocument => {
  const operation = parseShiftPlanningActivationOperationTerminal(
    input.operation,
  );
  const materialization = publicMaterialization(
    input.materialization.targetPath,
    input.materialization.payload,
  );
  if (
    materialization.payloadDigest !== input.materialization.payloadDigest ||
    materialization.documentRevision !== input.materialization.documentRevision
  ) {
    return failPublication("Public materialization binding has drifted.");
  }
  const mutation = operation.publicMutations.find((item) =>
    item.targetPath === materialization.targetPath);
  if (
    mutation === undefined ||
    mutation.payloadDigest !== materialization.payloadDigest ||
    mutation.documentRevision !== materialization.documentRevision ||
    operation.environment !== materialization.targetPath.split("/")[0] ||
    operation.bundleRevision !== materialization.payload.bundleRevision ||
    operation.bundleDigest !== materialization.payload.bundleDigest ||
    operation.writeEpoch !== materialization.payload.writeEpoch
  ) {
    return failPublication(
      "Public mutation is absent from its operation intent.",
    );
  }
  return {
    ...materialization.payload,
    lastBackendMutation: {
      schemaVersion: SHIFT_PLANNING_PUBLICATION_SCHEMA_VERSION,
      kind: "activation",
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

/**
 * Validates a marked public document, including its compatibility fields,
 * completion invariants, payload digest, path, revision, and optional expected
 * operation intent.
 * @param {object} input Untrusted document and expected binding.
 * @return {ShiftPlanningPublicShiftDocument} Canonical document.
 */
export const parseShiftPlanningPublicShiftDocument = (input: {
  targetPath: string;
  value: unknown;
  expectedOperationIntentDigest?: string;
}): ShiftPlanningPublicShiftDocument => {
  const document = requireRecord(input.value, "public shift document");
  requireExactFields(
    document,
    [...publicPayloadFields, "lastBackendMutation"],
    "public shift document",
  );
  const payloadRecord: UnknownRecord = {};
  publicPayloadFields.forEach((field) => {
    payloadRecord[field] = document[field];
  });
  const materialization = publicMaterialization(
    input.targetPath,
    payloadRecord,
  );
  const marker = parseShiftPlanningBackendMutationMarker(
    document.lastBackendMutation,
  );
  if (
    marker.targetPath !== materialization.targetPath
  ) {
    return failPublication("Public shift marker targets another document.");
  }
  if (input.expectedOperationIntentDigest !== undefined) {
    const expectedOperationIntentDigest = requireDigest(
      input.expectedOperationIntentDigest,
      "expectedOperationIntentDigest",
    );
    if (
      marker.operationIntentDigest !== expectedOperationIntentDigest ||
      marker.payloadDigest !== materialization.payloadDigest ||
      marker.documentRevision !== materialization.documentRevision ||
      marker.bundleRevision !== materialization.payload.bundleRevision ||
      marker.bundleDigest !== materialization.payload.bundleDigest ||
      marker.writeEpoch !== materialization.payload.writeEpoch
    ) {
      return failPublication("Public shift marker does not bind its payload.");
    }
  }
  return {...materialization.payload, lastBackendMutation: marker};
};

const beforeImageDigestCore = (
  value: Omit<ShiftPlanningBeforeImageEnvelope, "envelopeDigest">,
): ShiftPlanningCanonicalJsonObject => ({
  schemaVersion: value.schemaVersion,
  operationKind: value.operationKind,
  operationId: value.operationId,
  environment: value.environment,
  bundleRevision: value.bundleRevision,
  bundleDigest: value.bundleDigest,
  forwardManifestDigest: value.forwardManifestDigest,
  writeEpoch: value.writeEpoch,
  ordinal: value.ordinal,
  targetPath: value.targetPath,
  envelopePath: value.envelopePath,
  targetUpdateTime: timestampCanonical(value.targetUpdateTime),
  captureContractDigest: value.captureContractDigest,
  payload: encodedValueCanonical(value.payload),
  payloadDigest: value.payloadDigest,
});

/**
 * Encodes one transaction-read document into a portable, typed before-image.
 * The exact update time remains the restore precondition; unsupported Firestore
 * sentinels or reference types fail closed rather than becoming lossy JSON.
 * @param {CreateShiftPlanningBeforeImageEnvelopeInput} input Capture binding.
 * @return {ShiftPlanningBeforeImageEnvelope} Digest-bound before-image.
 */
export const createShiftPlanningBeforeImageEnvelope = (
  input: CreateShiftPlanningBeforeImageEnvelopeInput,
): ShiftPlanningBeforeImageEnvelope => {
  const environment = requireEnvironment(input.environment);
  const operationId = requireIdentifier(
    input.operationId,
    "beforeImage operationId",
  );
  const ordinal = requirePositiveInteger(input.ordinal, "beforeImage ordinal");
  const encoded = encodeFirestoreValue(
    input.document,
    "beforeImage document",
    new Set(),
  );
  if (encoded.kind !== "map") {
    return failPublication("Before-image document must be a Firestore map.");
  }
  const payloadDigest = firestorePayloadDigest(encoded);
  const envelopePath = `${environment}/plus-collections/` +
    `shiftPlanningOperations/${operationId}/beforeImages/${ordinal}`;
  const withoutDigest: Omit<
    ShiftPlanningBeforeImageEnvelope,
    "envelopeDigest"
  > = {
    schemaVersion: SHIFT_PLANNING_PUBLICATION_SCHEMA_VERSION,
    operationKind: "activationBeforeImage",
    operationId,
    environment,
    bundleRevision: requireIdentifier(
      input.bundleRevision,
      "beforeImage bundleRevision",
    ),
    bundleDigest: requireDigest(input.bundleDigest, "beforeImage bundleDigest"),
    forwardManifestDigest: requireDigest(
      input.forwardManifestDigest,
      "beforeImage forwardManifestDigest",
    ),
    writeEpoch: requireNonNegativeInteger(
      input.writeEpoch,
      "beforeImage writeEpoch",
    ),
    ordinal,
    targetPath: requireDocumentPath(
      input.targetPath,
      "beforeImage targetPath",
      environment,
    ),
    envelopePath,
    targetUpdateTime: requireTimestamp(
      input.targetUpdateTime,
      "beforeImage targetUpdateTime",
    ),
    captureContractDigest: requireDigest(
      input.captureContractDigest,
      "beforeImage captureContractDigest",
    ),
    payload: encoded,
    payloadDigest,
  };
  return {
    ...withoutDigest,
    envelopeDigest: createShiftPlanningDigest(
      beforeImageDigestCore(withoutDigest),
    ),
  };
};

/**
 * Parses and re-digests a persisted before-image envelope.
 * @param {unknown} value Untrusted stored envelope.
 * @return {ShiftPlanningBeforeImageEnvelope} Canonical envelope.
 */
export const parseShiftPlanningBeforeImageEnvelope = (
  value: unknown,
): ShiftPlanningBeforeImageEnvelope => {
  const envelope = requireRecord(value, "beforeImage envelope");
  requireExactFields(envelope, beforeImageFields, "beforeImage envelope");
  if (
    envelope.schemaVersion !== SHIFT_PLANNING_PUBLICATION_SCHEMA_VERSION ||
    envelope.operationKind !== "activationBeforeImage"
  ) {
    return failPublication("Before-image discriminators are invalid.");
  }
  const environment = requireEnvironment(envelope.environment);
  const operationId = requireIdentifier(
    envelope.operationId,
    "beforeImage operationId",
  );
  const ordinal = requirePositiveInteger(
    envelope.ordinal,
    "beforeImage ordinal",
  );
  const payload = parseEncodedValue(envelope.payload, "beforeImage payload");
  if (payload.kind !== "map") {
    return failPublication("Before-image payload must encode a map.");
  }
  const payloadDigest = requireDigest(
    envelope.payloadDigest,
    "beforeImage payloadDigest",
  );
  if (payloadDigest !== firestorePayloadDigest(payload)) {
    return failPublication("Before-image payload digest does not match.");
  }
  const envelopePath = requireDocumentPath(
    envelope.envelopePath,
    "beforeImage envelopePath",
    environment,
  );
  const expectedEnvelopePath = `${environment}/plus-collections/` +
    `shiftPlanningOperations/${operationId}/beforeImages/${ordinal}`;
  if (envelopePath !== expectedEnvelopePath) {
    return failPublication("Before-image envelope path is not canonical.");
  }
  const withoutDigest: Omit<
    ShiftPlanningBeforeImageEnvelope,
    "envelopeDigest"
  > = {
    schemaVersion: SHIFT_PLANNING_PUBLICATION_SCHEMA_VERSION,
    operationKind: "activationBeforeImage",
    operationId,
    environment,
    bundleRevision: requireIdentifier(
      envelope.bundleRevision,
      "beforeImage bundleRevision",
    ),
    bundleDigest: requireDigest(
      envelope.bundleDigest,
      "beforeImage bundleDigest",
    ),
    forwardManifestDigest: requireDigest(
      envelope.forwardManifestDigest,
      "beforeImage forwardManifestDigest",
    ),
    writeEpoch: requireNonNegativeInteger(
      envelope.writeEpoch,
      "beforeImage writeEpoch",
    ),
    ordinal,
    targetPath: requireDocumentPath(
      envelope.targetPath,
      "beforeImage targetPath",
      environment,
    ),
    envelopePath,
    targetUpdateTime: requireTimestamp(
      envelope.targetUpdateTime,
      "beforeImage targetUpdateTime",
    ),
    captureContractDigest: requireDigest(
      envelope.captureContractDigest,
      "beforeImage captureContractDigest",
    ),
    payload,
    payloadDigest,
  };
  const envelopeDigest = requireDigest(
    envelope.envelopeDigest,
    "beforeImage envelopeDigest",
  );
  if (
    envelopeDigest !== createShiftPlanningDigest(
      beforeImageDigestCore(withoutDigest),
    )
  ) {
    return failPublication("Before-image envelope digest does not match.");
  }
  return {...withoutDigest, envelopeDigest};
};

/**
 * Restores a validated encoded before-image to Firestore-compatible values.
 * @param {unknown} value Untrusted encoded document payload.
 * @return {Record<string, unknown>} Detached Firestore document map.
 */
export const decodeShiftPlanningFirestoreDocument = (
  value: unknown,
): Record<string, unknown> => {
  const encoded = parseEncodedValue(value, "encoded Firestore document");
  if (encoded.kind !== "map") {
    return failPublication("Encoded Firestore document must be a map.");
  }
  return decodeEncodedValue(encoded) as Record<string, unknown>;
};
