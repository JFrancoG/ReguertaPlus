import {ShiftPlanningError} from "./shift-planning-contract.js";
import {
  createShiftPlanningDigest,
  ShiftPlanningDigest,
} from "./shift-planning-digest.js";

export const DEVELOP_CONTAINED_DELIVERY_POLICY =
  "develop-contained-delivery-v1" as const;

export type ContainedDeliveryObservation = {
  functionName: string;
  pendingCount: number | null;
  inFlightCount: number | null;
};
export type ContainedDeliverySnapshot = {
  observedAtMillis: number;
  sourceSetDigest: ShiftPlanningDigest;
  classifiedEventSetDigest: ShiftPlanningDigest;
  capturedEventSetDigest: ShiftPlanningDigest;
  captureRevision: number;
  deliveryHistoryDigest: ShiftPlanningDigest;
  deliveries: readonly ContainedDeliveryObservation[];
};
export type ContainedDeliveryEvidence = {
  schemaVersion: 1;
  kind: typeof DEVELOP_CONTAINED_DELIVERY_POLICY;
  initial: ContainedDeliverySnapshot;
  final: ContainedDeliverySnapshot;
};

const reject = (): never => {
  throw new ShiftPlanningError("maintenance_state_conflict",
    "Contained delivery evidence is incomplete or its sources changed.");
};
const record = (value: unknown, keys: readonly string[]) => {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype) return reject();
  const result = value as Record<string, unknown>;
  if (Object.keys(result).sort().join() !== [...keys].sort().join()) {
    return reject();
  }
  return result;
};
const count = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) return reject();
  return value as number;
};
const digest = (value: unknown): ShiftPlanningDigest => {
  if (typeof value !== "string" ||
      !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)) return reject();
  return value as ShiftPlanningDigest;
};

/**
 * Source versions and reviewed event cores are independent of retry metadata.
 * This identity binds the approved causal set; it is not inferred from
 * quiet transport. Caller-supplied hashes establish no authority.
 * @param {ContainedDeliverySnapshot} snapshot Trusted source observation.
 * @return {ShiftPlanningDigest} Frozen business-set binding.
 */
export const containedDeliveryBusinessDigest = (
  snapshot: Pick<ContainedDeliverySnapshot,
    "sourceSetDigest" | "classifiedEventSetDigest">,
): ShiftPlanningDigest => createShiftPlanningDigest({
  kind: DEVELOP_CONTAINED_DELIVERY_POLICY,
  sourceSetDigest: snapshot.sourceSetDigest,
  classifiedEventSetDigest: snapshot.classifiedEventSetDigest,
});

/**
 * Unknown counts remain null; a known aggregate cannot hide an unknown route.
 * @param {ContainedDeliverySnapshot} snapshot Complete eight-route observation.
 * @param {string} field Counter to aggregate.
 * @return {number|null} Exact sum or unknown.
 */
export const containedDeliveryCount = (
  snapshot: ContainedDeliverySnapshot,
  field: "pendingCount" | "inFlightCount",
): number | null => {
  if (snapshot.deliveries.some((item) => item[field] === null)) return null;
  return count(snapshot.deliveries.reduce((sum, item) =>
    sum + (item[field] as number), 0));
};

const parseSnapshot = (
  value: unknown,
  functionNames: readonly string[],
): ContainedDeliverySnapshot => {
  const input = record(value, ["observedAtMillis", "sourceSetDigest",
    "classifiedEventSetDigest", "capturedEventSetDigest", "captureRevision",
    "deliveryHistoryDigest", "deliveries"]);
  if (!Array.isArray(input.deliveries) || functionNames.length !== 8 ||
      new Set(functionNames).size !== 8) return reject();
  const deliveries = input.deliveries.map((item) => {
    const row = record(item, ["functionName", "pendingCount", "inFlightCount"]);
    if (typeof row.functionName !== "string") return reject();
    return {functionName: row.functionName,
      pendingCount: row.pendingCount === null ? null : count(row.pendingCount),
      inFlightCount: row.inFlightCount === null ? null :
        count(row.inFlightCount)};
  }).sort((a, b) => a.functionName < b.functionName ? -1 : 1);
  if (deliveries.map((item) => item.functionName).join() !==
      [...functionNames].sort().join()) return reject();
  const parsed = {
    observedAtMillis: count(input.observedAtMillis),
    sourceSetDigest: digest(input.sourceSetDigest),
    classifiedEventSetDigest: digest(input.classifiedEventSetDigest),
    capturedEventSetDigest: digest(input.capturedEventSetDigest),
    captureRevision: count(input.captureRevision),
    deliveryHistoryDigest: digest(input.deliveryHistoryDigest), deliveries,
  };
  if (parsed.classifiedEventSetDigest !== parsed.capturedEventSetDigest) {
    return reject();
  }
  return parsed;
};

/**
 * Validates observations within the admission window, not prior business-call
 * termination. Later checkpoint drift still rejects in the held adapter.
 * @param {unknown} value Explicit ADR-0025 alternative.
 * @param {string[]} functionNames Names from all four verified capture pairs.
 * @param {ShiftPlanningDigest} businessDigest Authorized frozen source set.
 * @return {ContainedDeliveryEvidence} Detached, complete observations.
 */
export const parseContainedDeliveryEvidence = (
  value: unknown,
  functionNames: readonly string[],
  businessDigest: ShiftPlanningDigest,
): ContainedDeliveryEvidence => {
  const input = record(value, ["schemaVersion", "kind", "initial", "final"]);
  if (input.schemaVersion !== 1 ||
      input.kind !== DEVELOP_CONTAINED_DELIVERY_POLICY) return reject();
  const initial = parseSnapshot(input.initial, functionNames);
  const final = parseSnapshot(input.final, functionNames);
  if (containedDeliveryBusinessDigest(initial) !== businessDigest ||
      containedDeliveryBusinessDigest(final) !== businessDigest ||
      initial.observedAtMillis > final.observedAtMillis ||
      initial.captureRevision > final.captureRevision ||
      (initial.captureRevision === final.captureRevision) !==
        (initial.deliveryHistoryDigest === final.deliveryHistoryDigest)) {
    return reject();
  }
  return {schemaVersion: 1, kind: DEVELOP_CONTAINED_DELIVERY_POLICY,
    initial, final};
};
