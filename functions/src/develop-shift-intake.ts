import {createHash} from "node:crypto";
import {
  DocumentReference, DocumentSnapshot, Firestore, GeoPoint, Timestamp,
  VectorValue,
} from "@google-cloud/firestore";

export const DEVELOP_SHIFT_INTAKE_PROJECT = "reguerta-9f27f";
export const DEVELOP_SHIFT_INTAKE_PATH =
  "shiftPlanningDevelopIntake/current";
export const DEVELOP_SHIFT_INTAKE_ROUTES = {
  onShiftPlanningRequestCreated: ["shiftPlanningRequests", "requestId"],
  onShiftWritten: ["shifts", "shiftId"],
  onDeliveryCalendarOverrideWritten: ["deliveryCalendar", "weekKey"],
  onNotificationEventCreated: ["notificationEvents", "eventId"],
} as const;
type EntryPoint = keyof typeof DEVELOP_SHIFT_INTAKE_ROUTES;
type RecordValue = Record<string, unknown>;
type Wire = null | boolean | number | string | Wire[] |
  {[key: string]: Wire};
type Snapshot = {
  ref: {path: string}; exists: boolean;
  createTime?: Timestamp; updateTime?: Timestamp; readTime?: Timestamp;
  data(): unknown;
};
const databases = new WeakMap<Firestore, string>();

/**
 * Own the client and its exact destination instead of trusting environment
 * variables to redirect an injected live client. Production is never accepted
 * as an environment: this journal is exclusively the develop namespace.
 * @param {string} projectId Fixed live project or isolated demo project.
 * @return {Firestore} Owned, destination-bound client.
 */
export function createDevelopShiftIntakeDatabase(
  projectId = DEVELOP_SHIFT_INTAKE_PROJECT,
): Firestore {
  const emulator = process.env.FIRESTORE_EMULATOR_HOST;
  if (emulator ? emulator !== "127.0.0.1:8897" ||
      !/^demo-reguerta-[a-z0-9-]+$/.test(projectId) :
    projectId !== DEVELOP_SHIFT_INTAKE_PROJECT) {
    return fail("intake_database_invalid");
  }
  const db = new Firestore({projectId, databaseId: "(default)",
    ...(emulator ? {host: emulator, ssl: false} : {})});
  databases.set(db, projectId);
  return db;
}

/** Sanitized rejection: original event contents never enter error messages. */
export class DevelopShiftIntakeError extends Error {
  /** @param {string} code Stable internal failure code. */
  constructor(readonly code: string) {
    super(code);
  }
}
const fail = (code: string): never => {
  throw new DevelopShiftIntakeError(code);
};
const hash = (value: string): string =>
  createHash("sha256").update(value).digest("hex");
const record = (value: unknown): RecordValue => {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype ||
      Object.getOwnPropertySymbols(value).length) return fail("invalid_object");
  return value as RecordValue;
};
const field = (value: RecordValue, key: string): unknown => {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !("value" in descriptor)) return fail("invalid_field");
  return descriptor.value;
};
const stamp = (value: unknown): Wire => {
  if (value === undefined) return null;
  if (!(value instanceof Timestamp)) return fail("invalid_snapshot_time");
  return [value.seconds, value.nanoseconds];
};
const snapshotReadTime = (snapshot: Snapshot): Wire => {
  try {
    return stamp(snapshot.readTime);
  } catch (error) {
    // Functions constructs local snapshots from protobuf without a query read
    // time. The pinned server SDK throws for that getter; this is not a missing
    // source version. Preserve an available query time, never invent one or
    // swallow a different SDK/adapter error.
    if (snapshot instanceof DocumentSnapshot && error instanceof Error &&
        error.message === "Called 'readTime' on a local document") return null;
    throw error;
  }
};

/**
 * Tagged, lossless Firestore values: user maps cannot impersonate SDK types.
 * No arbitrary toJSON/getter is invoked. This is a retained inspection format,
 * not a serializer for reconstructing SDK snapshots or replaying old callbacks.
 * @param {unknown} value Original public SDK value.
 * @param {number} depth Bounded recursive depth.
 * @return {Wire} Stable typed value.
 */
export function encodeDevelopShiftValue(value: unknown, depth = 0): Wire {
  if (depth > 32) return fail("value_too_deep");
  if (value === null) return ["null"];
  if (typeof value === "boolean") return ["boolean", value];
  if (typeof value === "string") return ["string", value];
  if (typeof value === "number") {
    return ["number", Object.is(value, -0) ? "-0" : String(value)];
  }
  if (value instanceof Timestamp) return ["timestamp", stamp(value)];
  if (value instanceof GeoPoint) {
    return ["geopoint", value.latitude, value.longitude];
  }
  if (Buffer.isBuffer(value)) return ["bytes", value.toString("base64")];
  if (value instanceof DocumentReference) {
    // The public server SDK exposes the local path but not the full project
    // identity. Never silently collapse cross-project references or reach into
    // its private serializer to manufacture a supposedly lossless capture.
    return fail("reference_value_unsupported");
  }
  if (value instanceof VectorValue) {
    return ["vector", value.toArray().map((item) =>
      encodeDevelopShiftValue(item, depth + 1))];
  }
  if (Array.isArray(value)) {
    const items: Wire[] = [];
    for (let index = 0; index < value.length; index++) {
      items.push(encodeDevelopShiftValue(
        field(value as unknown as RecordValue, String(index)), depth + 1,
      ));
    }
    return ["array", items];
  }
  const object = record(value);
  return ["map", Object.keys(object).sort().map((key) =>
    [key, encodeDevelopShiftValue(field(object, key), depth + 1)])];
}

const snapshotWire = (value: unknown): Record<string, Wire> => {
  if (!value || typeof value !== "object") return fail("snapshot_missing");
  const snapshot = value as Snapshot;
  if (typeof snapshot.ref?.path !== "string" ||
      typeof snapshot.exists !== "boolean" ||
      typeof snapshot.data !== "function") return fail("invalid_snapshot");
  if (snapshot.exists && (!snapshot.updateTime || !snapshot.createTime)) {
    return fail("snapshot_version_missing");
  }
  return {
    path: snapshot.ref.path, exists: snapshot.exists,
    createTime: stamp(snapshot.createTime),
    updateTime: stamp(snapshot.updateTime),
    readTime: snapshotReadTime(snapshot),
    fields: snapshot.exists ? encodeDevelopShiftValue(snapshot.data()) : null,
  };
};

/**
 * Bind original CloudEvent metadata and before/after images to an exact source.
 * Delivery/read times are retained separately from source-version identity.
 * @param {string} projectId Exact runtime project.
 * @param {string} entryPoint Original handler identity.
 * @param {unknown} input Firestore CloudEvent from the SDK.
 * @return {object} Immutable event and delivery content.
 */
export function encodeDevelopShiftEvent(
  projectId: string, entryPoint: string, input: unknown,
) {
  if (!Object.prototype.hasOwnProperty.call(
    DEVELOP_SHIFT_INTAKE_ROUTES, entryPoint,
  )) {
    return fail("invalid_entry_point");
  }
  const event = record(input);
  const params = record(field(event, "params"));
  const [collection, parameter] =
    DEVELOP_SHIFT_INTAKE_ROUTES[entryPoint as EntryPoint];
  const id = field(event, "id");
  const source = field(event, "source");
  const type = field(event, "type");
  const documentId = field(params, parameter);
  if (field(params, "env") !== "develop" ||
      typeof documentId !== "string" || !documentId ||
      documentId.includes("/") ||
      typeof id !== "string" || !id || id.length > 512 ||
      source !== `//firestore.googleapis.com/projects/${projectId}/` +
        "databases/(default)" ||
      field(event, "specversion") !== "1.0" ||
      typeof field(event, "time") !== "string" ||
      !Number.isFinite(Date.parse(field(event, "time") as string))) {
    return fail("event_identity_invalid");
  }
  const created = [
    "onShiftPlanningRequestCreated", "onNotificationEventCreated",
  ].includes(entryPoint);
  if (type !== "google.cloud.firestore.document.v1." +
      (created ? "created" : "written")) return fail("event_type_invalid");
  const data = field(event, "data");
  const change = created ? null : data as {before: unknown; after: unknown};
  const before = change ? snapshotWire(change.before) : null;
  const after = snapshotWire(change ? change.after : data);
  const path = `develop/plus-collections/${collection}/${documentId}`;
  if (after.path !== path || (before && before.path !== path) ||
      field(event, "subject") !== `documents/${path}` ||
      (created && !after.exists) || (!after.exists && !before?.exists)) {
    return fail("event_path_invalid");
  }
  const metadata = Object.fromEntries(Object.keys(event).filter((key) =>
    key !== "data").sort().map((key) => [key, field(event, key)]));
  const metadataWire = encodeDevelopShiftValue(metadata);
  const stable = (snapshot: Record<string, Wire> | null) => snapshot &&
    {...snapshot, readTime: null};
  const core = {schemaVersion: 1, entryPoint, source, type, path,
    before: stable(before), after: stable(after)};
  const coreDigest = hash(JSON.stringify(core));
  const eventKey = hash(JSON.stringify({entryPoint, source, type, path,
    before: before && [before.exists, before.updateTime],
    after: [after.exists, after.updateTime]}));
  const deliveryKey = hash(JSON.stringify({entryPoint, source, id}));
  // Same source version with another delivery ID is deduplicated; conflicting
  // images or same-ID metadata can never overwrite the first capture.
  const deliveryDigest = hash(JSON.stringify({coreDigest, metadataWire}));
  return {eventKey, coreDigest, deliveryKey, deliveryDigest, path,
    envelope: JSON.stringify({core, metadata: metadataWire, before, after}),
    delivery: {metadata: JSON.stringify(metadataWire),
      beforeReadTime: before?.readTime ?? null, afterReadTime: after.readTime}};
}

const assertDatabase = (db: Firestore): void => {
  if (!databases.has(db)) {
    fail("intake_database_invalid");
  }
};

/**
 * Atomically retain a capture before ACK. Retries recover commit-ACK loss and
 * duplicate delivery without replaying Sheets/FCM. All event chunks, delivery
 * identity and the monotonically increasing capture revision commit together.
 * Absence of prior history never proves old operations drained. This adapter
 * neither opens maintenance nor emits trusted barrier evidence.
 * @param {Firestore} db Fixed runtime SDK client.
 * @param {string} entryPoint Original handler identity.
 * @param {unknown} event Complete original SDK event.
 * @return {Promise<object>} Committed or previously committed capture identity.
 */
export async function captureDevelopShiftEvent(
  db: Firestore, entryPoint: string, event: unknown,
): Promise<{eventKey: string; coreDigest: string; duplicate: boolean}> {
  assertDatabase(db);
  const captured = encodeDevelopShiftEvent(
    databases.get(db) as string, entryPoint, event,
  );
  const bytes = Buffer.from(captured.envelope);
  if (bytes.length > 4 * 1024 * 1024 ||
      Buffer.byteLength(captured.delivery.metadata) > 256 * 1024) {
    return fail("event_payload_too_large");
  }
  const chunks: Buffer[] = [];
  for (let offset = 0; offset < bytes.length; offset += 200 * 1024) {
    chunks.push(bytes.subarray(offset, offset + 200 * 1024));
  }
  const control = db.doc(DEVELOP_SHIFT_INTAKE_PATH);
  const eventRef = control.collection("events").doc(captured.eventKey);
  const deliveryRef = control.collection("deliveries")
    .doc(captured.deliveryKey);
  return db.runTransaction(async (tx) => {
    const [state, prior, delivered] = await tx.getAll(
      control, eventRef, deliveryRef,
    );
    if ((prior.exists && prior.get("coreDigest") !== captured.coreDigest) ||
        (delivered.exists &&
          (delivered.get("eventKey") !== captured.eventKey ||
           delivered.get("digest") !== captured.deliveryDigest))) {
      return fail("event_payload_conflict");
    }
    const stored = state.data();
    if (stored && (Object.keys(stored).sort().join() !== [
      "captureRevision", "deliveryCount", "eventCount", "legacyUntracked",
      "schemaVersion",
    ].join() ||
        stored.schemaVersion !== 1 ||
        stored.legacyUntracked !== true ||
        ![stored.captureRevision, stored.eventCount, stored.deliveryCount]
          .every((value) => Number.isSafeInteger(value) && value >= 0 &&
            value < Number.MAX_SAFE_INTEGER))) {
      return fail("intake_state_invalid");
    }
    if ((prior.exists && !stored) ||
        (delivered.exists && !prior.exists)) {
      return fail("intake_state_invalid");
    }
    if (!delivered.exists) {
      tx.create(deliveryRef, {schemaVersion: 1, eventKey: captured.eventKey,
        digest: captured.deliveryDigest, ...captured.delivery});
      tx.set(control, {schemaVersion: 1, legacyUntracked: true,
        captureRevision: (stored?.captureRevision ?? 0) + 1,
        eventCount: (stored?.eventCount ?? 0) + (prior.exists ? 0 : 1),
        deliveryCount: (stored?.deliveryCount ?? 0) + 1});
    }
    if (!prior.exists) {
      tx.create(eventRef, {schemaVersion: 1, coreDigest: captured.coreDigest,
        path: captured.path, entryPoint, state: "retained",
        envelopeDigest: hash(captured.envelope), chunkCount: chunks.length,
        replayable: false});
      chunks.forEach((chunk, index) => {
        tx.create(eventRef.collection("chunks").doc(String(index)),
          {bytes: chunk});
      });
    }
    return {eventKey: captured.eventKey, coreDigest: captured.coreDigest,
      duplicate: prior.exists};
  });
}

/**
 * Read-only diagnostics. Event counts describe captures, never a complete old
 * causal universe or authorization for Sheets, migration or notification work.
 * @param {Firestore} db Fixed runtime SDK client.
 * @return {Promise<object>} Explicitly unqualified intake diagnostics.
 */
export async function inspectDevelopShiftIntake(db: Firestore) {
  assertDatabase(db);
  const snapshot = await db.doc(DEVELOP_SHIFT_INTAKE_PATH).get();
  return {state: snapshot.data() ?? null, legacyUntracked: true,
    canClaimClosure: false, canApply: false};
}
