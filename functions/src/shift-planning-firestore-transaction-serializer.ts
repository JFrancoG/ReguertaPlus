import {createHash} from "node:crypto";
import {createRequire} from "node:module";
import {
  DocumentData,
  FieldValue,
  Firestore,
  GeoPoint,
  Timestamp,
  WriteBatch,
  v1,
} from "@google-cloud/firestore";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {SHIFT_PLANNING_DIGEST_PREFIX} from "./shift-planning-digest.js";

export const SHIFT_PLANNING_FIRESTORE_TRANSACTION_SERIALIZER_SCHEMA_VERSION =
  1 as const;
export const SHIFT_PLANNING_FIRESTORE_TRANSACTION_WRITE_LIMIT = 500 as const;
export const SHIFT_PLANNING_FIRESTORE_TRANSACTION_BYTE_LIMIT =
  10 * 1024 * 1024;
export const SHIFT_PLANNING_FIRESTORE_FIELD_TRANSFORM_LIMIT = 500 as const;
export const SHIFT_PLANNING_FIRESTORE_COMMIT_ADAPTER_REVISION =
  "firestore-grpc-v1-fs8.7.0-r1" as const;

const EXPECTED_FIRESTORE_SDK_VERSION = "8.7.0";
const WRITE_SET_DIGEST_PREFIX =
  "shift-planning:firestore-write-set:v1:sha256:";
const COMMIT_REQUEST_DIGEST_PREFIX =
  "shift-planning:firestore-commit-request:v1:sha256:";
const COMMIT_REQUEST_PROTO_NAME = "google.firestore.v1.CommitRequest";
const DATABASE_NAME_PATTERN = new RegExp(
  "^projects/[a-z][a-z0-9-]{3,62}/databases/" +
  "(?:\\(default\\)|[a-z][a-z0-9_-]{2,62})$",
);

export type ShiftPlanningFirestoreTransactionDirection =
  | "forward"
  | "inverse";

export type ShiftPlanningFirestorePrecondition =
  | {exists: boolean}
  | {lastUpdateTime: Timestamp};

export type ShiftPlanningFirestoreMutation =
  | {
    kind: "create";
    documentPath: string;
    data: DocumentData;
  }
  | {
    kind: "update";
    documentPath: string;
    data: DocumentData;
    precondition?: ShiftPlanningFirestorePrecondition;
  }
  | {
    kind: "delete";
    documentPath: string;
    precondition?: ShiftPlanningFirestorePrecondition;
  };

export type ShiftPlanningFirestoreCommitMeasurement = {
  readonly schemaVersion:
    typeof SHIFT_PLANNING_FIRESTORE_TRANSACTION_SERIALIZER_SCHEMA_VERSION;
  readonly direction: ShiftPlanningFirestoreTransactionDirection;
  readonly manifestDigest: string;
  readonly databaseName: string;
  readonly writeSetDigest: string;
  readonly commitRequestDigest: string;
  readonly documentWriteCount: number;
  readonly fieldTransformCount: number;
  readonly maximumFieldTransformsPerDocument: number;
  readonly requestByteCount: number;
  readonly adapterRevision:
    typeof SHIFT_PLANNING_FIRESTORE_COMMIT_ADAPTER_REVISION;
  readonly indexConfigurationDigest: string;
};

export type SerializeShiftPlanningFirestoreCommitRequestInput = {
  firestore: Firestore;
  direction: ShiftPlanningFirestoreTransactionDirection;
  manifestDigest: string;
  writeBatch: WriteBatch;
  transactionToken: Uint8Array;
  expectedDocumentWriteCount: number;
  authority: {
    adapterRevision: string;
    indexConfigurationDigest: string;
  };
  writeLimit?: number;
  byteLimit?: number;
};

export type CreateCanonicalShiftPlanningFirestoreWriteBatchInput = {
  firestore: Firestore;
  mutations: readonly ShiftPlanningFirestoreMutation[];
};

export type PopulateCanonicalShiftPlanningFirestoreWriteBatchInput = {
  firestore: Firestore;
  writeBatch: WriteBatch;
  mutations: readonly ShiftPlanningFirestoreMutation[];
};

type FirestorePackageMetadata = {version?: unknown};

type PrivateWriteOperation = {
  docPath?: unknown;
  op?: unknown;
};

type PrivateWriteBatch = WriteBatch & {
  _commit?: unknown;
  _committed?: unknown;
  _firestore?: unknown;
  _ops?: unknown;
  _reset?: unknown;
};

type PrivateCommitOptions = {
  transactionId?: unknown;
  [key: string]: unknown;
};

type FirestoreWrite = {
  update?: {name?: unknown};
  delete?: unknown;
  transform?: {
    document?: unknown;
    fieldTransforms?: unknown;
  };
  verify?: unknown;
  updateTransforms?: unknown;
};

type StabilizedWriteBatch = {
  operations: PrivateWriteOperation[];
  writes: FirestoreWrite[];
};

type GuardedCommitAuthority = {
  databaseName: string;
  firestore: Firestore;
  requestBytes: Buffer;
  transactionToken: Buffer;
};

type GuardedWriteBatchState = {
  authority?: GuardedCommitAuthority;
  commitInFlight: boolean;
  operations: readonly PrivateWriteOperation[];
};

type ProtobufEncoder = {
  finish(): Uint8Array;
};

type CommitRequestCodec = {
  fromObject(value: unknown): unknown;
  encode(value: unknown): ProtobufEncoder;
};

type PrivateProtobufRoot = {
  lookupType?: unknown;
};

type PrivateFirestoreClient = {
  _protos?: unknown;
};

const localRequire = createRequire(__filename);
let cachedCommitRequestCodec: CommitRequestCodec | null = null;
const guardedWriteBatchStates =
  new WeakMap<WriteBatch, GuardedWriteBatchState>();
const pinnedWriteBatchPrototype = WriteBatch.prototype;
const pinnedWriteBatchCommit =
  (pinnedWriteBatchPrototype as PrivateWriteBatch)._commit;
const pinnedWriteBatchReset =
  (pinnedWriteBatchPrototype as PrivateWriteBatch)._reset;

const failTransaction = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_transaction", message);
};

const failAdapter = (message: string): never => {
  throw new ShiftPlanningError(
    "planning_transaction_adapter_drift",
    message,
  );
};

const requireDigest = (value: string, field: string): string => {
  if (
    typeof value !== "string" ||
    !value.startsWith(SHIFT_PLANNING_DIGEST_PREFIX) ||
    !/^[a-f0-9]{64}$/.test(value.slice(SHIFT_PLANNING_DIGEST_PREFIX.length))
  ) {
    return failTransaction(`${field} must be a canonical planning digest.`);
  }
  return value;
};

const requirePositiveLimit = (
  value: number | undefined,
  fallback: number,
  maximum: number,
  field: string,
): number => {
  const resolved = value ?? fallback;
  if (
    !Number.isSafeInteger(resolved) ||
    resolved < 1 ||
    resolved > maximum
  ) {
    return failTransaction(`${field} is outside its supported range.`);
  }
  return resolved;
};

const requireDocumentPath = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    value.length < 3 ||
    value.length > 6_144 ||
    value !== value.trim() ||
    value.startsWith("/") ||
    value.endsWith("/") ||
    value.includes("//")
  ) {
    return failTransaction("Firestore document path is not canonical.");
  }
  const segments = value.split("/");
  if (
    segments.length % 2 !== 0 ||
    segments.some((segment) => segment.length < 1 || segment === "." ||
      segment === "..")
  ) {
    return failTransaction("Firestore document path must identify a document.");
  }
  return value;
};

const requirePlainArray = (value: readonly unknown[], path: string): void => {
  if (
    Object.getPrototypeOf(value) !== Array.prototype ||
    Object.getOwnPropertySymbols(value).length > 0
  ) {
    return failTransaction(`${path} must be a plain dense array.`);
  }
  const expectedNames = new Set(["length"]);
  for (let index = 0; index < value.length; index += 1) {
    expectedNames.add(String(index));
  }
  if (
    Object.getOwnPropertyNames(value)
      .some((name) => !expectedNames.has(name))
  ) {
    return failTransaction(`${path} contains a non-index array property.`);
  }
};

const normalizeArray = (
  value: readonly unknown[],
  path: string,
  ancestors: Set<object>,
): unknown[] => {
  requirePlainArray(value, path);
  return Array.from({length: value.length}, (_, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      return failTransaction(`${path}[${index}] must be a data property.`);
    }
    if (Array.isArray(descriptor.value)) {
      return failTransaction(`${path}[${index}] must not be a nested array.`);
    }
    return normalizeFirestoreValue(
      descriptor.value,
      `${path}[${index}]`,
      ancestors,
    );
  });
};

const isPlainObject = (value: object): boolean => {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const requirePlainDataRecord = (
  value: unknown,
  path: string,
): Record<string, unknown> => {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !isPlainObject(value) ||
    Object.getOwnPropertySymbols(value).length > 0
  ) {
    return failTransaction(`${path} must be a plain data object.`);
  }
  const result = Object.create(null) as Record<string, unknown>;
  for (const key of Object.getOwnPropertyNames(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      return failTransaction(`${path}.${key} must be a data property.`);
    }
    result[key] = descriptor.value;
  }
  return result;
};

const requireExactFields = (
  value: Record<string, unknown>,
  fields: readonly string[],
  path: string,
): void => {
  const keys = Object.keys(value);
  if (
    keys.length !== fields.length ||
    keys.some((key) => !fields.includes(key))
  ) {
    return failTransaction(`${path} fields must be exact.`);
  }
};

const normalizeObject = (
  value: object,
  path: string,
  ancestors: Set<object>,
): DocumentData => {
  if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length > 0) {
    return failTransaction(`${path} must be a plain Firestore map.`);
  }
  const result: DocumentData = {};
  for (const key of Object.getOwnPropertyNames(value).sort()) {
    if (key === "__proto__") {
      return failTransaction(`${path} contains a reserved prototype key.`);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      return failTransaction(`${path}.${key} must be a data property.`);
    }
    Object.defineProperty(result, key, {
      configurable: true,
      enumerable: true,
      value: normalizeFirestoreValue(
        descriptor.value,
        `${path}.${key}`,
        ancestors,
      ),
      writable: true,
    });
  }
  return result;
};

const normalizeFirestoreObject = (
  value: object,
  path: string,
  ancestors: Set<object>,
): unknown => {
  if (value instanceof Timestamp || value instanceof GeoPoint ||
    value instanceof FieldValue) {
    return value;
  }
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) {
      return failTransaction(`${path} contains an invalid Date.`);
    }
    return new Date(value.getTime());
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return Buffer.from(value);
  }
  if (ancestors.has(value)) {
    return failTransaction(`${path} must not contain a cycle.`);
  }
  ancestors.add(value);
  try {
    return Array.isArray(value) ?
      normalizeArray(value, path, ancestors) :
      normalizeObject(value, path, ancestors);
  } finally {
    ancestors.delete(value);
  }
};

const normalizeFirestoreValue = (
  value: unknown,
  path: string,
  ancestors: Set<object>,
): unknown => {
  if (value === null || typeof value === "string" ||
    typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return failTransaction(`${path} must be a finite number.`);
    }
    return value;
  }
  if (typeof value === "object") {
    return normalizeFirestoreObject(value, path, ancestors);
  }
  return failTransaction(`${path} contains unsupported ${typeof value}.`);
};

const normalizeData = (value: unknown, path: string): DocumentData => {
  const normalized = normalizeFirestoreValue(value, path, new Set());
  if (
    normalized === null ||
    typeof normalized !== "object" ||
    Array.isArray(normalized)
  ) {
    return failTransaction(`${path} must be a Firestore document map.`);
  }
  return normalized as DocumentData;
};

const normalizePrecondition = (
  value: unknown,
  path: string,
): ShiftPlanningFirestorePrecondition | undefined => {
  if (value === undefined) return undefined;
  const record = requirePlainDataRecord(value, path);
  if ("exists" in record) {
    requireExactFields(record, ["exists"], path);
    if (typeof record.exists !== "boolean") {
      return failTransaction(`${path}.exists must be boolean.`);
    }
    return {exists: record.exists};
  }
  if (
    "lastUpdateTime" in record
  ) {
    requireExactFields(record, ["lastUpdateTime"], path);
    if (!(record.lastUpdateTime instanceof Timestamp)) {
      return failTransaction(`${path}.lastUpdateTime must be a Timestamp.`);
    }
    return {lastUpdateTime: record.lastUpdateTime};
  }
  return failTransaction(`${path} is not a supported Firestore precondition.`);
};

const compareCodeUnits = (left: string, right: string): number => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

const canonicalMutations = (
  value: readonly ShiftPlanningFirestoreMutation[],
): ShiftPlanningFirestoreMutation[] => {
  if (!Array.isArray(value) || value.length < 1) {
    return failTransaction("Commit mutations must be a non-empty array.");
  }
  requirePlainArray(value, "mutations");
  const normalized = Array.from({length: value.length}, (_, index) => {
    const path = `mutations[${index}]`;
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      return failTransaction(`${path} must be a data property.`);
    }
    const mutation = descriptor.value;
    const record = requirePlainDataRecord(mutation, path);
    const documentPath = requireDocumentPath(record.documentPath);
    if (record.kind === "create") {
      requireExactFields(record, ["kind", "documentPath", "data"], path);
      return {
        kind: "create" as const,
        documentPath,
        data: normalizeData(record.data, `${path}.data`),
      };
    }
    if (record.kind === "update") {
      const fields = record.precondition === undefined ?
        ["kind", "documentPath", "data"] :
        ["kind", "documentPath", "data", "precondition"];
      requireExactFields(record, fields, path);
      return {
        kind: "update" as const,
        documentPath,
        data: normalizeData(record.data, `${path}.data`),
        precondition: normalizePrecondition(
          record.precondition,
          `${path}.precondition`,
        ),
      };
    }
    if (record.kind === "delete") {
      const fields = record.precondition === undefined ?
        ["kind", "documentPath"] :
        ["kind", "documentPath", "precondition"];
      requireExactFields(record, fields, path);
      return {
        kind: "delete" as const,
        documentPath,
        precondition: normalizePrecondition(
          record.precondition,
          `${path}.precondition`,
        ),
      };
    }
    return failTransaction(`mutations[${index}].kind is unsupported.`);
  }).sort((left, right) =>
    compareCodeUnits(left.documentPath, right.documentPath));
  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index - 1].documentPath === normalized[index].documentPath) {
      return failTransaction("Commit mutations contain a duplicate document.");
    }
  }
  return normalized;
};

const applyMutationsToWriteBatch = (
  firestore: Firestore,
  batch: WriteBatch,
  mutations: readonly ShiftPlanningFirestoreMutation[],
): WriteBatch => {
  try {
    for (const mutation of mutations) {
      const reference = firestore.doc(mutation.documentPath);
      if (mutation.kind === "create") {
        batch.create(reference, mutation.data);
      } else if (mutation.kind === "update") {
        if (mutation.precondition === undefined) {
          batch.update(reference, mutation.data);
        } else {
          batch.update(reference, mutation.data, mutation.precondition);
        }
      } else if (mutation.precondition === undefined) {
        batch.delete(reference);
      } else {
        batch.delete(reference, mutation.precondition);
      }
    }
    return batch;
  } catch (error) {
    if (error instanceof ShiftPlanningError) throw error;
    return failTransaction("Firestore rejected the resolved mutation set.");
  }
};

const buildWriteBatch = (
  firestore: Firestore,
  mutations: readonly ShiftPlanningFirestoreMutation[],
): WriteBatch => applyMutationsToWriteBatch(
  firestore,
  firestore.batch(),
  mutations,
);

/**
 * Applies one canonical mutation set to the batch that callers may later
 * measure and commit. Invalid SDK values are converted to a stable planning
 * failure before any transport is opened.
 * @param {CreateCanonicalShiftPlanningFirestoreWriteBatchInput} input Firestore
 * instance and complete mutation set.
 * @return {WriteBatch} Caller-owned canonical batch; this function never
 * commits it.
 */
export const createCanonicalShiftPlanningFirestoreWriteBatch = (
  input: CreateCanonicalShiftPlanningFirestoreWriteBatchInput,
): WriteBatch => buildWriteBatch(
  input.firestore,
  canonicalMutations(input.mutations),
);

/**
 * Populates one existing caller-owned batch with a complete canonical mutation
 * set. The batch must belong to the supplied Firestore instance and be empty;
 * this prevents an attempt adapter from measuring writes it did not resolve.
 * @param {PopulateCanonicalShiftPlanningFirestoreWriteBatchInput} input Actual
 * empty batch, Firestore owner, and complete mutation set.
 * @return {WriteBatch} The same populated batch.
 */
export const populateCanonicalShiftPlanningFirestoreWriteBatch = (
  input: PopulateCanonicalShiftPlanningFirestoreWriteBatchInput,
): WriteBatch => {
  requireFirestoreSdkVersion();
  if (
    !(input.firestore instanceof Firestore) ||
    !(input.writeBatch instanceof WriteBatch) ||
    (input.writeBatch as PrivateWriteBatch)._firestore !== input.firestore
  ) {
    return failAdapter(
      "Firestore instance or WriteBatch came from an unpinned SDK owner.",
    );
  }
  requireOpenWriteBatch(input.writeBatch);
  const operations = (input.writeBatch as PrivateWriteBatch)._ops;
  if (!Array.isArray(operations)) {
    return failAdapter("Firestore WriteBatch operation storage has drifted.");
  }
  if (operations.length !== 0) {
    return failTransaction("Firestore transaction batch must start empty.");
  }
  return applyMutationsToWriteBatch(
    input.firestore,
    input.writeBatch,
    canonicalMutations(input.mutations),
  );
};

const requireFirestoreSdkVersion = (): void => {
  let metadata: FirestorePackageMetadata;
  try {
    metadata = localRequire(
      "@google-cloud/firestore/package.json",
    ) as FirestorePackageMetadata;
  } catch {
    return failAdapter("Pinned Firestore SDK metadata is unavailable.");
  }
  if (metadata.version !== EXPECTED_FIRESTORE_SDK_VERSION) {
    return failAdapter("Pinned Firestore SDK revision has drifted.");
  }
};

const commitRequestCodec = (): CommitRequestCodec => {
  requireFirestoreSdkVersion();
  if (cachedCommitRequestCodec !== null) return cachedCommitRequestCodec;
  const client = new v1.FirestoreClient({
    projectId: "shift-planning-offline-serializer",
    fallback: true,
  }) as unknown as PrivateFirestoreClient;
  const root = client._protos as PrivateProtobufRoot | undefined;
  if (!root || typeof root.lookupType !== "function") {
    return failAdapter("Firestore CommitRequest protobuf root has drifted.");
  }
  const codec = root.lookupType(COMMIT_REQUEST_PROTO_NAME) as
    Partial<CommitRequestCodec>;
  if (
    !codec ||
    typeof codec.fromObject !== "function" ||
    typeof codec.encode !== "function"
  ) {
    return failAdapter("Firestore CommitRequest protobuf codec has drifted.");
  }
  cachedCommitRequestCodec = codec as CommitRequestCodec;
  return cachedCommitRequestCodec;
};

const extractWrites = (batch: WriteBatch): FirestoreWrite[] => {
  const operations = (batch as PrivateWriteBatch)._ops;
  if (!Array.isArray(operations)) {
    return failAdapter("Firestore WriteBatch operation storage has drifted.");
  }
  return operations.map((rawOperation, index) => {
    const operation = rawOperation as PrivateWriteOperation;
    if (!operation || typeof operation.op !== "function") {
      return failAdapter(
        `Firestore WriteBatch operation ${index} has drifted.`,
      );
    }
    const write = operation.op();
    if (!write || typeof write !== "object" || Array.isArray(write)) {
      return failAdapter(`Firestore Write ${index} has drifted.`);
    }
    return write as FirestoreWrite;
  });
};

const cloneFirestoreProtoValue = (
  value: unknown,
  path: string,
  ancestors: Set<object>,
): unknown => {
  if (value === null || typeof value === "string" ||
    typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return failAdapter(`${path} contains a non-finite protobuf number.`);
    }
    return value;
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return Buffer.from(value);
  }
  if (typeof value !== "object") {
    return failAdapter(`${path} contains an unsupported protobuf value.`);
  }
  if (ancestors.has(value)) {
    return failAdapter(`${path} contains a protobuf cycle.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (
    !Array.isArray(value) &&
    prototype !== Object.prototype &&
    prototype !== null
  ) {
    return failAdapter(`${path} contains an unsupported protobuf object.`);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    return failAdapter(`${path} contains a protobuf symbol.`);
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const names = Object.getOwnPropertyNames(value);
      if (
        names.length !== value.length + 1 ||
        names.some((name) => name !== "length" &&
          !/^(0|[1-9][0-9]*)$/.test(name))
      ) {
        return failAdapter(`${path} contains a sparse protobuf array.`);
      }
      return Array.from({length: value.length}, (_, index) => {
        const descriptor = Object.getOwnPropertyDescriptor(
          value,
          String(index),
        );
        if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
          return failAdapter(`${path}[${index}] protobuf shape has drifted.`);
        }
        return cloneFirestoreProtoValue(
          descriptor.value,
          `${path}[${index}]`,
          ancestors,
        );
      });
    }
    const result: Record<string, unknown> = {};
    for (const key of Object.getOwnPropertyNames(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
        return failAdapter(`${path}.${key} protobuf shape has drifted.`);
      }
      Object.defineProperty(result, key, {
        configurable: true,
        enumerable: true,
        value: cloneFirestoreProtoValue(
          descriptor.value,
          `${path}.${key}`,
          ancestors,
        ),
        writable: true,
      });
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
};

const cloneFirestoreWrite = (
  value: FirestoreWrite,
  index: number,
): FirestoreWrite => {
  const cloned = cloneFirestoreProtoValue(
    value,
    `writes[${index}]`,
    new Set(),
  );
  if (!cloned || typeof cloned !== "object" || Array.isArray(cloned)) {
    return failAdapter(`Firestore Write ${index} clone has drifted.`);
  }
  return cloned as FirestoreWrite;
};

const stabilizeWriteBatch = (
  batch: WriteBatch,
  writes: readonly FirestoreWrite[],
): StabilizedWriteBatch => {
  const operations = (batch as PrivateWriteBatch)._ops;
  if (!Array.isArray(operations) || operations.length !== writes.length) {
    return failAdapter("Firestore WriteBatch operation count has drifted.");
  }
  const capturedWrites = writes.map(cloneFirestoreWrite);
  const stableOperations = operations.map((rawOperation, index) => {
    const operation = rawOperation as PrivateWriteOperation;
    if (
      !operation ||
      typeof operation !== "object" ||
      Array.isArray(operation) ||
      Object.keys(operation).length !== 2 ||
      !("docPath" in operation) ||
      !("op" in operation) ||
      typeof operation.docPath !== "string" ||
      typeof operation.op !== "function"
    ) {
      return failAdapter(
        `Firestore WriteBatch operation ${index} shape has drifted.`,
      );
    }
    const capturedWrite = capturedWrites[index];
    return {
      docPath: operation.docPath,
      op: (): FirestoreWrite => cloneFirestoreWrite(capturedWrite, index),
    };
  });
  return {
    operations: stableOperations,
    writes: stableOperations.map((operation) =>
      (operation.op as () => FirestoreWrite)()),
  };
};

const requireOpenWriteBatch = (batch: WriteBatch): void => {
  const descriptor = Object.getOwnPropertyDescriptor(batch, "_committed");
  if (
    !descriptor ||
    !("value" in descriptor) ||
    typeof descriptor.value !== "boolean" ||
    !descriptor.writable
  ) {
    return failAdapter("Firestore WriteBatch commit state has drifted.");
  }
  if (descriptor.value) {
    return failTransaction("Firestore WriteBatch is already sealed.");
  }
};

const installCommitGuards = (batch: WriteBatch): void => {
  if (guardedWriteBatchStates.has(batch)) return;
  const privateBatch = batch as PrivateWriteBatch;
  const ownCommitDescriptor = Object.getOwnPropertyDescriptor(batch, "_commit");
  const ownResetDescriptor = Object.getOwnPropertyDescriptor(batch, "_reset");
  const firestoreDescriptor = Object.getOwnPropertyDescriptor(
    batch,
    "_firestore",
  );
  const operationsDescriptor = Object.getOwnPropertyDescriptor(batch, "_ops");
  if (
    Object.getPrototypeOf(batch) !== pinnedWriteBatchPrototype ||
    ownCommitDescriptor !== undefined ||
    ownResetDescriptor !== undefined ||
    typeof pinnedWriteBatchCommit !== "function" ||
    typeof pinnedWriteBatchReset !== "function" ||
    privateBatch._commit !== pinnedWriteBatchCommit ||
    privateBatch._reset !== pinnedWriteBatchReset ||
    !firestoreDescriptor ||
    !("value" in firestoreDescriptor) ||
    !(firestoreDescriptor.value instanceof Firestore) ||
    !firestoreDescriptor.configurable ||
    !operationsDescriptor ||
    !("value" in operationsDescriptor) ||
    !Array.isArray(operationsDescriptor.value) ||
    !operationsDescriptor.configurable ||
    !Object.isExtensible(batch)
  ) {
    return failAdapter("Firestore WriteBatch commit methods have drifted.");
  }
  const originalCommit = pinnedWriteBatchCommit;
  const state: GuardedWriteBatchState = {
    commitInFlight: false,
    operations: operationsDescriptor.value as PrivateWriteOperation[],
  };
  try {
    Object.defineProperties(batch, {
      _commit: {
        configurable: false,
        value: async (options: PrivateCommitOptions | undefined) => {
          const authority = state.authority;
          const suppliedToken = options?.transactionId;
          if (
            authority === undefined ||
            !(suppliedToken instanceof Uint8Array) ||
            !Buffer.from(suppliedToken).equals(authority.transactionToken) ||
            (options?.methodName !== undefined &&
              options.methodName !== "commit")
          ) {
            return failTransaction(
              "Firestore commit options differ from the measured request.",
            );
          }
          if (
            privateBatch._firestore !== authority.firestore ||
            requireDatabaseName(authority.firestore) !== authority.databaseName
          ) {
            return failAdapter("Firestore commit owner has drifted.");
          }
          const commitBytes = encodedBytes(commitRequestCodec(), {
            database: authority.databaseName,
            writes: extractWrites(batch),
            transaction: Buffer.from(authority.transactionToken),
          });
          if (!commitBytes.equals(authority.requestBytes)) {
            return failTransaction(
              "Firestore CommitRequest changed after measurement.",
            );
          }
          state.commitInFlight = true;
          try {
            return await originalCommit.call(batch, {
              ...options,
              transactionId: Buffer.from(authority.transactionToken),
            });
          } finally {
            state.commitInFlight = false;
          }
        },
        writable: false,
      },
      _firestore: {
        configurable: false,
        enumerable: firestoreDescriptor.enumerable,
        value: firestoreDescriptor.value,
        writable: false,
      },
      _ops: {
        configurable: false,
        enumerable: operationsDescriptor.enumerable,
        get: () => state.operations,
        set: () => failTransaction(
          "Firestore WriteBatch operation storage is adapter-owned.",
        ),
      },
      _reset: {
        configurable: false,
        value: () => {
          if (state.commitInFlight) {
            return failTransaction(
              "Firestore WriteBatch cannot reset during guarded commit.",
            );
          }
          state.authority = undefined;
          state.operations = [];
          privateBatch._committed = false;
        },
        writable: false,
      },
    });
  } catch (error) {
    if (error instanceof ShiftPlanningError) throw error;
    return failAdapter("Firestore WriteBatch guard installation failed.");
  }
  guardedWriteBatchStates.set(batch, state);
};

const sealWriteBatch = (
  batch: WriteBatch,
  operations: readonly PrivateWriteOperation[],
): void => {
  requireOpenWriteBatch(batch);
  installCommitGuards(batch);
  const privateBatch = batch as PrivateWriteBatch;
  const state = guardedWriteBatchStates.get(batch);
  if (state === undefined) {
    return failAdapter("Firestore WriteBatch operation storage has drifted.");
  }
  state.operations = Object.freeze(operations.map((operation) =>
    Object.freeze(operation)));
  privateBatch._committed = true;
};

const authorizeSealedCommit = (
  batch: WriteBatch,
  firestore: Firestore,
  databaseName: string,
  requestBytes: Buffer,
  transactionToken: Uint8Array,
): void => {
  const state = guardedWriteBatchStates.get(batch);
  if (
    state === undefined ||
    (batch as PrivateWriteBatch)._committed !== true
  ) {
    return failAdapter("Firestore WriteBatch was not sealed by the adapter.");
  }
  state.authority = Object.freeze({
    databaseName,
    firestore,
    requestBytes: Buffer.from(requestBytes),
    transactionToken: Buffer.from(transactionToken),
  });
};

const requireDatabaseName = (firestore: Firestore): string => {
  const value = (firestore as Firestore & {formattedName?: unknown})
    .formattedName;
  if (
    typeof value !== "string" ||
    !DATABASE_NAME_PATTERN.test(value)
  ) {
    return failAdapter("Firestore formatted database name has drifted.");
  }
  return value;
};

const writeTarget = (write: FirestoreWrite, index: number): string => {
  const candidates = [
    write.update?.name,
    write.delete,
    write.transform?.document,
    write.verify,
  ].filter((value) => value !== undefined);
  if (candidates.length !== 1 || typeof candidates[0] !== "string") {
    return failAdapter(`Firestore Write ${index} target has drifted.`);
  }
  return candidates[0];
};

const transformCount = (value: unknown, path: string): number => {
  if (value === undefined) return 0;
  if (!Array.isArray(value)) {
    return failAdapter(`${path} has drifted.`);
  }
  return value.length;
};

const encodedBytes = (
  codec: CommitRequestCodec,
  request: unknown,
): Buffer => {
  try {
    return Buffer.from(codec.encode(codec.fromObject(request)).finish());
  } catch {
    return failAdapter("Firestore CommitRequest serialization failed closed.");
  }
};

const digestBytes = (prefix: string, value: Uint8Array): string =>
  `${prefix}${createHash("sha256").update(value).digest("hex")}`;

/**
 * Serializes the exact protobuf request for one fully resolved write batch.
 *
 * This function never commits or initializes a remote Firestore transport. The
 * caller must pass the actual batch that the adapter will commit and invoke it
 * inside every real transaction attempt once the opaque transaction token and
 * all before-images, IDs, payloads, and preconditions are known. The result
 * proves protobuf request bytes only; Firestore index-entry accounting still
 * requires the separately governed rehearsal gate. A successful measurement
 * replaces its operations with detached copies of the measured `Write` protos
 * and seals further public mutations. Its commit guard supplies a detached copy
 * of the measured token and rejects any different token while preserving the
 * SDK retry path; every reset must populate and measure again.
 * @param {SerializeShiftPlanningFirestoreCommitRequestInput} input Actual
 * batch, authority, budget, and transaction token for one attempt.
 * @return {ShiftPlanningFirestoreCommitMeasurement} Immutable byte and digest
 * evidence for that exact request.
 */
export const serializeShiftPlanningFirestoreCommitRequest = (
  input: SerializeShiftPlanningFirestoreCommitRequestInput,
): ShiftPlanningFirestoreCommitMeasurement => {
  requireFirestoreSdkVersion();
  if (
    !(input.firestore instanceof Firestore) ||
    !(input.writeBatch instanceof WriteBatch) ||
    (input.writeBatch as PrivateWriteBatch)._firestore !== input.firestore
  ) {
    return failAdapter(
      "Firestore instance or WriteBatch came from an unpinned SDK owner.",
    );
  }
  if (input.direction !== "forward" && input.direction !== "inverse") {
    return failTransaction("Commit direction is unsupported.");
  }
  const manifestDigest = requireDigest(input.manifestDigest, "manifestDigest");
  const indexConfigurationDigest = requireDigest(
    input.authority.indexConfigurationDigest,
    "authority.indexConfigurationDigest",
  );
  if (
    input.authority.adapterRevision !==
      SHIFT_PLANNING_FIRESTORE_COMMIT_ADAPTER_REVISION
  ) {
    return failAdapter("Transaction measurement authority has drifted.");
  }
  if (
    !(input.transactionToken instanceof Uint8Array) ||
    input.transactionToken.byteLength < 1
  ) {
    return failTransaction("A non-empty transaction token is required.");
  }
  if (
    !Number.isSafeInteger(input.expectedDocumentWriteCount) ||
    input.expectedDocumentWriteCount < 1
  ) {
    return failTransaction("Expected document-write count is invalid.");
  }
  const writeLimit = requirePositiveLimit(
    input.writeLimit,
    SHIFT_PLANNING_FIRESTORE_TRANSACTION_WRITE_LIMIT,
    SHIFT_PLANNING_FIRESTORE_TRANSACTION_WRITE_LIMIT,
    "writeLimit",
  );
  const byteLimit = requirePositiveLimit(
    input.byteLimit,
    SHIFT_PLANNING_FIRESTORE_TRANSACTION_BYTE_LIMIT,
    SHIFT_PLANNING_FIRESTORE_TRANSACTION_BYTE_LIMIT,
    "byteLimit",
  );
  requireOpenWriteBatch(input.writeBatch);
  const stabilizedBatch = stabilizeWriteBatch(
    input.writeBatch,
    extractWrites(input.writeBatch),
  );
  const writes = stabilizedBatch.writes;
  if (writes.length !== input.expectedDocumentWriteCount) {
    return failTransaction(
      "Resolved write set does not match the expected document budget.",
    );
  }
  const databaseName = requireDatabaseName(input.firestore);
  const targetPrefix = `${databaseName}/documents/`;
  const targets = writes.map((write, index) => writeTarget(write, index));
  const hasNonCanonicalTarget = targets.some((target, index) =>
    !target.startsWith(targetPrefix) ||
    (index > 0 && targets[index - 1] >= target));
  if (hasNonCanonicalTarget) {
    return failTransaction(
      "Resolved writes escape the database or are not strictly ordered.",
    );
  }
  const transformsPerDocument = writes.map((write, index) =>
    transformCount(
      write.updateTransforms,
      `writes[${index}].updateTransforms`,
    ) + transformCount(
      write.transform?.fieldTransforms,
      `writes[${index}].transform.fieldTransforms`,
    ));
  const fieldTransformCount = transformsPerDocument.reduce(
    (total, count) => total + count,
    0,
  );
  const maximumFieldTransformsPerDocument = Math.max(
    0,
    ...transformsPerDocument,
  );
  if (
    writes.length + fieldTransformCount > writeLimit ||
    maximumFieldTransformsPerDocument >
      SHIFT_PLANNING_FIRESTORE_FIELD_TRANSFORM_LIMIT
  ) {
    throw new ShiftPlanningError(
      "planning_bundle_oversize",
      "Firestore write and transform cardinality exceeds its safe gate.",
    );
  }
  const codec = commitRequestCodec();
  const writeSetBytes = encodedBytes(codec, {writes});
  const requestBytes = encodedBytes(codec, {
    database: databaseName,
    writes,
    transaction: Buffer.from(input.transactionToken),
  });
  if (requestBytes.byteLength > byteLimit) {
    throw new ShiftPlanningError(
      "planning_bundle_oversize",
      "Firestore CommitRequest exceeds its serialized byte gate.",
    );
  }
  sealWriteBatch(input.writeBatch, stabilizedBatch.operations);
  const sealedWrites = extractWrites(input.writeBatch);
  const sealedWriteSetBytes = encodedBytes(codec, {writes: sealedWrites});
  const sealedRequestBytes = encodedBytes(codec, {
    database: databaseName,
    writes: sealedWrites,
    transaction: Buffer.from(input.transactionToken),
  });
  if (
    !sealedWriteSetBytes.equals(writeSetBytes) ||
    !sealedRequestBytes.equals(requestBytes)
  ) {
    return failAdapter("Sealed Firestore WriteBatch bytes have drifted.");
  }
  authorizeSealedCommit(
    input.writeBatch,
    input.firestore,
    databaseName,
    requestBytes,
    input.transactionToken,
  );
  return Object.freeze({
    schemaVersion:
      SHIFT_PLANNING_FIRESTORE_TRANSACTION_SERIALIZER_SCHEMA_VERSION,
    direction: input.direction,
    manifestDigest,
    databaseName,
    writeSetDigest: digestBytes(WRITE_SET_DIGEST_PREFIX, writeSetBytes),
    commitRequestDigest: digestBytes(
      COMMIT_REQUEST_DIGEST_PREFIX,
      requestBytes,
    ),
    documentWriteCount: writes.length,
    fieldTransformCount,
    maximumFieldTransformsPerDocument,
    requestByteCount: requestBytes.byteLength,
    adapterRevision: SHIFT_PLANNING_FIRESTORE_COMMIT_ADAPTER_REVISION,
    indexConfigurationDigest,
  });
};
