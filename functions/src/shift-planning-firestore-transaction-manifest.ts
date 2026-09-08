import {DocumentData, FieldValue, Timestamp} from "@google-cloud/firestore";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {createShiftPlanningDigest} from "./shift-planning-digest.js";
import {
  ShiftPlanningEncodedFirestoreValue,
  decodeShiftPlanningFirestoreValue,
  encodeShiftPlanningFirestoreValue,
} from "./shift-planning-publication-contract.js";

export const SHIFT_PLANNING_FIRESTORE_ADMISSION_SCHEMA_VERSION = 2 as const;
export const SHIFT_PLANNING_FIRESTORE_ADMISSION_REVISION =
  "public-transaction-v2" as const;
export const SHIFT_PLANNING_FIRESTORE_TRANSACTION_WRITE_LIMIT = 500 as const;
export const SHIFT_PLANNING_FIRESTORE_TRANSACTION_BYTE_LIMIT = 8 * 1024 * 1024;
const DOCUMENT_BYTE_LIMIT = 768 * 1024;

export type ShiftPlanningFirestoreTransactionDirection = "forward" | "inverse";
export type ShiftPlanningFirestorePrecondition =
  | {exists: boolean}
  | {lastUpdateTime: Timestamp};
export type ShiftPlanningFirestoreMutation =
  | {kind: "create"; documentPath: string; data: DocumentData}
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

/**
 * Application admission evidence; never a wire, token, or index measurement.
 */
export type ShiftPlanningFirestoreAdmission = {
  readonly schemaVersion:
    typeof SHIFT_PLANNING_FIRESTORE_ADMISSION_SCHEMA_VERSION;
  readonly evidenceKind: "applicationAdmission";
  readonly direction: ShiftPlanningFirestoreTransactionDirection;
  readonly manifestDigest: string;
  readonly logicalMutationDigest: string;
  readonly documentWriteCount: number;
  readonly estimatedRequestBytes: number;
  readonly adapterRevision: typeof SHIFT_PLANNING_FIRESTORE_ADMISSION_REVISION;
  readonly indexConfigurationDigest: string;
};

export type PrepareShiftPlanningFirestoreTransactionInput = {
  direction: ShiftPlanningFirestoreTransactionDirection;
  manifestDigest: string;
  mutations: readonly ShiftPlanningFirestoreMutation[];
  expectedDocumentWriteCount: number;
  authority: {adapterRevision: string; indexConfigurationDigest: string};
  writeLimit?: number;
  byteLimit?: number;
};

export type ShiftPlanningPreparedFirestoreTransaction = {
  readonly serializedMutations: string;
  readonly measurement: ShiftPlanningFirestoreAdmission;
};

type EncodedField = {
  name: string;
  value: ShiftPlanningEncodedFirestoreValue | {kind: "delete"};
};
type EncodedMutation = {
  kind: ShiftPlanningFirestoreMutation["kind"];
  documentPath: string;
  fields: EncodedField[] | null;
  precondition:
    {exists: boolean} | {seconds: number; nanoseconds: number} | null;
};

const failTransaction = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_transaction", message);
};
const requireDigest = (value: unknown): string => {
  if (typeof value !== "string" ||
      !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)) {
    return failTransaction("Planning admission requires canonical digests.");
  }
  return value;
};
const limit = (value: number | undefined, maximum: number): number => {
  const result = value ?? maximum;
  if (!Number.isSafeInteger(result) || result < 1 || result > maximum) {
    return failTransaction("Application admission limit is invalid.");
  }
  return result;
};
const documentPath = (value: string): string => {
  if (typeof value !== "string" || value !== value.trim() ||
      Buffer.byteLength(value) > 6_144 || value.split("/").length % 2 !== 0 ||
      value.split("/").some((part) => !part || part === "." || part === "..")) {
    return failTransaction("Mutation must identify a canonical document path.");
  }
  return value;
};

const encodeMutation = (
  mutation: ShiftPlanningFirestoreMutation,
): EncodedMutation => {
  const path = documentPath(mutation.documentPath);
  if (!["create", "update", "delete"].includes(mutation.kind)) {
    return failTransaction("Unsupported mutation kind.");
  }
  const fields = mutation.kind === "delete" ? null :
    Object.keys(mutation.data).sort().map((name): EncodedField => {
      const descriptor = Object.getOwnPropertyDescriptor(mutation.data, name);
      if (!descriptor || !("value" in descriptor)) {
        return failTransaction("Mutation fields must be data properties.");
      }
      const value = descriptor.value;
      if (value instanceof FieldValue && value.isEqual(FieldValue.delete())) {
        if (mutation.kind !== "update") {
          return failTransaction("Field deletion requires an update.");
        }
        return {name, value: {kind: "delete"}};
      }
      return {
        name,
        value: encodeShiftPlanningFirestoreValue(value, path, new Set()),
      };
    });
  const condition = mutation.kind === "create" ?
    undefined : mutation.precondition;
  let precondition: EncodedMutation["precondition"] = null;
  if (condition !== undefined) {
    if (Object.keys(condition).length !== 1) {
      return failTransaction("Mutation precondition must be exact.");
    }
    if ("lastUpdateTime" in condition &&
        condition.lastUpdateTime instanceof Timestamp) {
      precondition = {
        seconds: condition.lastUpdateTime.seconds,
        nanoseconds: condition.lastUpdateTime.nanoseconds,
      };
    } else if ("exists" in condition && typeof condition.exists === "boolean") {
      precondition = {exists: condition.exists};
    } else {
      return failTransaction("Mutation precondition is invalid.");
    }
  }
  return {kind: mutation.kind, documentPath: path, fields, precondition};
};

/**
 * Captures immutable logical writes before any asynchronous fence check. Tagged
 * JSON detaches maps, timestamps, and byte arrays from caller-owned values.
 * Admission doubles the tagged payload size and reserves 1 KiB per document
 * plus 1 KiB per request, capped at 8 MiB and 768 KiB per document. This is a
 * deliberately conservative application estimate, not a bound on Firestore's
 * wire or index accounting; the server may still reject the atomic commit.
 * Only concrete values and top-level deletion sentinels used by recovery are
 * supported. Dynamic transforms are not part of the planning write contract.
 * @param {PrepareShiftPlanningFirestoreTransactionInput} input Complete writes.
 * @return {ShiftPlanningPreparedFirestoreTransaction} Detached logical
 * manifest.
 */
export const prepareShiftPlanningFirestoreTransaction = (
  input: PrepareShiftPlanningFirestoreTransactionInput,
): ShiftPlanningPreparedFirestoreTransaction => {
  if (input.direction !== "forward" && input.direction !== "inverse") {
    return failTransaction("Planning direction is invalid.");
  }
  if (input.authority.adapterRevision !==
      SHIFT_PLANNING_FIRESTORE_ADMISSION_REVISION) {
    return failTransaction("Application admission policy has changed.");
  }
  const manifestDigest = requireDigest(input.manifestDigest);
  const indexConfigurationDigest = requireDigest(
    input.authority.indexConfigurationDigest,
  );
  if (!Array.isArray(input.mutations) || input.mutations.length < 1 ||
      input.mutations.length !== input.expectedDocumentWriteCount) {
    return failTransaction("Logical write count does not match the plan.");
  }
  const mutations = input.mutations.map(encodeMutation).sort((left, right) =>
    left.documentPath < right.documentPath ? -1 :
      left.documentPath > right.documentPath ? 1 : 0);
  if (new Set(mutations.map((item) => item.documentPath)).size !==
      mutations.length) {
    return failTransaction("Logical manifest contains a duplicate document.");
  }
  const estimatedDocumentBytes = mutations.map((item) =>
    1024 + 2 * Buffer.byteLength(JSON.stringify(item)));
  const estimatedRequestBytes = 1024 + estimatedDocumentBytes.reduce(
    (a, b) => a + b, 0,
  );
  const writeLimit = limit(
    input.writeLimit, SHIFT_PLANNING_FIRESTORE_TRANSACTION_WRITE_LIMIT,
  );
  const byteLimit = limit(
    input.byteLimit, SHIFT_PLANNING_FIRESTORE_TRANSACTION_BYTE_LIMIT,
  );
  if (mutations.length > writeLimit ||
      estimatedRequestBytes > byteLimit ||
      estimatedDocumentBytes.some((bytes) => bytes > DOCUMENT_BYTE_LIMIT)) {
    throw new ShiftPlanningError(
      "planning_bundle_oversize",
      "Plan exceeds application admission limits.",
    );
  }
  const serializedMutations = JSON.stringify(mutations);
  return Object.freeze({
    serializedMutations,
    measurement: Object.freeze({
      schemaVersion: SHIFT_PLANNING_FIRESTORE_ADMISSION_SCHEMA_VERSION,
      evidenceKind: "applicationAdmission",
      direction: input.direction,
      manifestDigest,
      logicalMutationDigest: createShiftPlanningDigest(serializedMutations),
      documentWriteCount: mutations.length,
      estimatedRequestBytes,
      adapterRevision: SHIFT_PLANNING_FIRESTORE_ADMISSION_REVISION,
      indexConfigurationDigest,
    }),
  });
};

/**
 * Rehydrates fresh SDK values from the admitted logical manifest, without
 * exposing or modifying the SDK's internal batch or transaction state.
 * @param {ShiftPlanningPreparedFirestoreTransaction} prepared Admitted
 * manifest.
 * @return {ShiftPlanningFirestoreMutation[]} Detached mutations for public
 * APIs.
 */
export const decodeShiftPlanningFirestoreMutations = (
  prepared: ShiftPlanningPreparedFirestoreTransaction,
): ShiftPlanningFirestoreMutation[] => {
  const mutations: EncodedMutation[] = JSON.parse(prepared.serializedMutations);
  return mutations.map((item): ShiftPlanningFirestoreMutation => {
    const condition = item.precondition;
    const precondition = condition === null ?
      undefined : "exists" in condition ? condition : {
        lastUpdateTime: new Timestamp(condition.seconds, condition.nanoseconds),
      };
    if (item.kind === "delete") {
      return {kind: "delete", documentPath: item.documentPath, precondition};
    }
    const data = Object.fromEntries((item.fields ?? []).map(({name, value}) => [
      name, value.kind === "delete" ?
        FieldValue.delete() : decodeShiftPlanningFirestoreValue(value),
    ]));
    return item.kind === "create" ?
      {kind: "create", documentPath: item.documentPath, data} :
      {kind: "update", documentPath: item.documentPath, data, precondition};
  });
};
