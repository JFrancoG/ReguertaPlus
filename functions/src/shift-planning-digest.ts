import {createHash} from "node:crypto";

export const SHIFT_PLANNING_DIGEST_PREFIX =
  "shift-planning:v1:sha256:" as const;

const SHIFT_PLANNING_DIGEST_DOMAIN = "shift-planning:v1:sha256";

export type ShiftPlanningCanonicalJsonPrimitive =
  | null
  | boolean
  | number
  | string;

export type ShiftPlanningCanonicalJsonValue =
  | ShiftPlanningCanonicalJsonPrimitive
  | ShiftPlanningCanonicalJsonObject
  | readonly ShiftPlanningCanonicalJsonValue[];

export type ShiftPlanningCanonicalJsonObject = {
  readonly [key: string]: ShiftPlanningCanonicalJsonValue;
};

export type ShiftPlanningDigest =
  `${typeof SHIFT_PLANNING_DIGEST_PREFIX}${string}`;

export type ShiftPlanningDigestFailureCode =
  | "invalid_shift_planning_digest_input"
  | "invalid_shift_planning_fairness_snapshot";

/** Stable fail-closed error for digest and fairness-snapshot boundaries. */
export class ShiftPlanningDigestError extends Error {
  readonly code: ShiftPlanningDigestFailureCode;

  /**
   * Preserves a client-stable machine code while keeping diagnostics internal.
   * @param {ShiftPlanningDigestFailureCode} code Stable failure code.
   * @param {string} message Internal non-user-facing diagnostic.
   */
  constructor(code: ShiftPlanningDigestFailureCode, message: string) {
    super(message);
    this.name = "ShiftPlanningDigestError";
    this.code = code;
  }
}

export type ShiftPlanningFairnessRosterMember =
  ShiftPlanningCanonicalJsonObject & {
    readonly userId: string;
    readonly roles: readonly string[];
  };

/**
 * Complete input boundary whose exact value binds preview, stage, and activate.
 * Extra JSON fields are retained so a future version cannot silently escape the
 * digest, while every currently authoritative fairness source remains required.
 */
export type ShiftPlanningFairnessSnapshot =
  ShiftPlanningCanonicalJsonObject & {
    readonly snapshotVersion: number;
    readonly writeEpoch: number;
    readonly activeRevision: string | null;
    readonly activeDigest: ShiftPlanningDigest | null;
    readonly membership: ShiftPlanningCanonicalJsonObject;
    readonly roster: readonly ShiftPlanningFairnessRosterMember[];
    readonly rotations: ShiftPlanningCanonicalJsonObject;
    readonly config: ShiftPlanningCanonicalJsonObject;
    readonly calendar: ShiftPlanningCanonicalJsonObject;
    readonly overrides: ShiftPlanningCanonicalJsonObject;
    readonly creditLedger: ShiftPlanningCanonicalJsonObject;
    readonly sync: ShiftPlanningCanonicalJsonObject;
    readonly migrationBaseline: {
      readonly revision: string;
      readonly digest: ShiftPlanningDigest;
    } | null;
  };

const failDigestInput = (path: string, reason: string): never => {
  throw new ShiftPlanningDigestError(
    "invalid_shift_planning_digest_input",
    `Canonical digest input at ${path} ${reason}.`,
  );
};

const failFairnessSnapshot = (reason: string): never => {
  throw new ShiftPlanningDigestError(
    "invalid_shift_planning_fairness_snapshot",
    `Fairness snapshot ${reason}.`,
  );
};

const compareCodeUnits = (left: string, right: string): number => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

const objectPath = (path: string, key: string): string =>
  `${path}[${JSON.stringify(key)}]`;

const isPlainObject = (value: object): boolean => {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const requireDataDescriptor = (
  descriptor: PropertyDescriptor | undefined,
  path: string,
): PropertyDescriptor & {value: unknown} => {
  if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
    return failDigestInput(
      path,
      "must be an enumerable data property",
    );
  }
  return descriptor as PropertyDescriptor & {value: unknown};
};

const serializeArray = (
  value: readonly unknown[],
  path: string,
  ancestors: Set<object>,
): string => {
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    return failDigestInput(path, "must be a plain array");
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    return failDigestInput(path, "must not contain symbol properties");
  }

  const expectedNames = new Set<string>(["length"]);
  const serialized: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const key = String(index);
    const itemPath = `${path}[${key}]`;
    expectedNames.add(key);
    const descriptor = requireDataDescriptor(
      Object.getOwnPropertyDescriptor(value, key),
      itemPath,
    );
    serialized.push(serializeValue(descriptor.value, itemPath, ancestors));
  }

  const unexpectedName = Object.getOwnPropertyNames(value).find(
    (name) => !expectedNames.has(name),
  );
  if (unexpectedName !== undefined) {
    return failDigestInput(
      objectPath(path, unexpectedName),
      "is not a JSON array index",
    );
  }
  return `[${serialized.join(",")}]`;
};

const serializeObject = (
  value: object,
  path: string,
  ancestors: Set<object>,
): string => {
  if (!isPlainObject(value)) {
    return failDigestInput(path, "must be a plain object");
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    return failDigestInput(path, "must not contain symbol properties");
  }

  const keys = Object.getOwnPropertyNames(value).sort(compareCodeUnits);
  const entries = keys.map((key) => {
    const propertyPath = objectPath(path, key);
    const descriptor = requireDataDescriptor(
      Object.getOwnPropertyDescriptor(value, key),
      propertyPath,
    );
    return `${JSON.stringify(key)}:${serializeValue(
      descriptor.value,
      propertyPath,
      ancestors,
    )}`;
  });
  return `{${entries.join(",")}}`;
};

const serializeObjectValue = (
  value: object,
  path: string,
  ancestors: Set<object>,
): string => {
  if (ancestors.has(value)) {
    return failDigestInput(path, "must not contain a cycle");
  }
  ancestors.add(value);
  try {
    return Array.isArray(value) ?
      serializeArray(value, path, ancestors) :
      serializeObject(value, path, ancestors);
  } finally {
    ancestors.delete(value);
  }
};

const serializeValue = (
  value: unknown,
  path: string,
  ancestors: Set<object>,
): string => {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return failDigestInput(path, "must contain a finite number");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "object") {
    return serializeObjectValue(value, path, ancestors);
  }
  return failDigestInput(path, `contains unsupported ${typeof value}`);
};

/**
 * Serializes exactly the JSON data supplied by the caller. Object keys use
 * deterministic UTF-16 code-unit order, arrays retain their order, and values
 * that native JSON would omit or coerce fail closed.
 * @param {unknown} value Untrusted value to validate and serialize.
 * @return {string} Canonical JSON with no discarded or coerced input.
 */
export const canonicalShiftPlanningJson = (value: unknown): string =>
  serializeValue(value, "$", new Set<object>());

/**
 * Produces a domain-separated SHA-256 digest whose prefix versions the exact
 * canonicalization contract. A future contract must use a different prefix and
 * domain separator rather than silently changing this result.
 * @param {unknown} value Untrusted value to validate and digest.
 * @return {ShiftPlanningDigest} Versioned lowercase SHA-256 digest.
 */
export const createShiftPlanningDigest = (
  value: unknown,
): ShiftPlanningDigest => {
  const canonicalJson = canonicalShiftPlanningJson(value);
  const hash = createHash("sha256")
    .update(SHIFT_PLANNING_DIGEST_DOMAIN, "utf8")
    .update("\n", "utf8")
    .update(canonicalJson, "utf8")
    .digest("hex");
  return `${SHIFT_PLANNING_DIGEST_PREFIX}${hash}`;
};

const REQUIRED_FAIRNESS_FIELDS = [
  "snapshotVersion",
  "writeEpoch",
  "activeRevision",
  "activeDigest",
  "membership",
  "roster",
  "rotations",
  "config",
  "calendar",
  "overrides",
  "creditLedger",
  "sync",
  "migrationBaseline",
] as const;

const isCanonicalRecord = (
  value: ShiftPlanningCanonicalJsonValue,
): value is ShiftPlanningCanonicalJsonObject =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  isPlainObject(value);

const requireFairnessRecord = (
  snapshot: unknown,
): Record<string, unknown> => {
  if (
    typeof snapshot !== "object" ||
    snapshot === null ||
    Array.isArray(snapshot) ||
    !isPlainObject(snapshot)
  ) {
    return failFairnessSnapshot("must be a plain object");
  }
  for (const field of REQUIRED_FAIRNESS_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(snapshot, field)) {
      return failFairnessSnapshot(`is missing required field ${field}`);
    }
  }
  return snapshot as Record<string, unknown>;
};

const requireFairnessObjectField = (
  snapshot: ShiftPlanningCanonicalJsonObject,
  field: "membership" | "rotations" | "config" | "calendar" |
    "overrides" | "creditLedger" | "sync",
): void => {
  if (!isCanonicalRecord(snapshot[field])) {
    failFairnessSnapshot(`${field} must be a plain JSON object`);
  }
};

const normalizedRoster = (
  value: ShiftPlanningCanonicalJsonValue,
): ShiftPlanningFairnessRosterMember[] => {
  if (!Array.isArray(value)) {
    return failFairnessSnapshot("roster must be an array");
  }

  const userIds = new Set<string>();
  const members = value.map((member, index) => {
    if (!isCanonicalRecord(member)) {
      return failFairnessSnapshot(`roster[${index}] must be a plain object`);
    }
    const userId = member.userId;
    const roles = member.roles;
    if (
      typeof userId !== "string" ||
      !userId.trim() ||
      userId.trim() !== userId
    ) {
      return failFairnessSnapshot(
        `roster[${index}].userId must be a canonical non-empty string`,
      );
    }
    if (userIds.has(userId)) {
      return failFairnessSnapshot(`contains duplicate userId ${userId}`);
    }
    if (
      !Array.isArray(roles) ||
      roles.some((role) => typeof role !== "string" || !role.trim())
    ) {
      return failFairnessSnapshot(
        `roster[${index}].roles must contain non-empty strings`,
      );
    }
    userIds.add(userId);
    return {
      ...member,
      userId,
      roles: [...roles].sort(compareCodeUnits),
    } as ShiftPlanningFairnessRosterMember;
  });
  return members.sort((left, right) =>
    compareCodeUnits(left.userId, right.userId));
};

/**
 * Validates the complete fairness boundary and normalizes only set-like roster
 * ordering. Cohorts, cursors, calendars, ledgers, and all other arrays retain
 * their original semantic order.
 * @param {unknown} snapshot Untrusted fairness inputs read by the runtime.
 * @return {ShiftPlanningFairnessSnapshot} Detached normalized snapshot.
 */
export const normalizeShiftPlanningFairnessSnapshot = (
  snapshot: unknown,
): ShiftPlanningFairnessSnapshot => {
  requireFairnessRecord(snapshot);
  const canonicalCopy = JSON.parse(
    canonicalShiftPlanningJson(snapshot),
  ) as ShiftPlanningCanonicalJsonValue;
  if (!isCanonicalRecord(canonicalCopy)) {
    return failFairnessSnapshot("must be a canonical JSON object");
  }

  if (
    !Number.isSafeInteger(canonicalCopy.snapshotVersion) ||
    typeof canonicalCopy.snapshotVersion !== "number" ||
    canonicalCopy.snapshotVersion < 1
  ) {
    return failFairnessSnapshot(
      "snapshotVersion must be a positive safe integer",
    );
  }
  if (
    !Number.isSafeInteger(canonicalCopy.writeEpoch) ||
    typeof canonicalCopy.writeEpoch !== "number" ||
    canonicalCopy.writeEpoch < 0
  ) {
    return failFairnessSnapshot(
      "writeEpoch must be a non-negative safe integer",
    );
  }
  const activeRevision = canonicalCopy.activeRevision;
  const activeDigest = canonicalCopy.activeDigest;
  if (
    (activeRevision === null) !== (activeDigest === null) ||
    (
      activeRevision !== null &&
      (
        typeof activeRevision !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(activeRevision)
      )
    ) ||
    (
      activeDigest !== null &&
      (
        typeof activeDigest !== "string" ||
        !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(activeDigest)
      )
    )
  ) {
    return failFairnessSnapshot(
      "activeRevision and activeDigest must be one valid paired lineage",
    );
  }

  for (const field of [
    "membership",
    "rotations",
    "config",
    "calendar",
    "overrides",
    "creditLedger",
    "sync",
  ] as const) {
    requireFairnessObjectField(canonicalCopy, field);
  }
  if (canonicalCopy.migrationBaseline !== null) {
    const baseline = canonicalCopy.migrationBaseline;
    if (
      !isCanonicalRecord(baseline) ||
      Object.keys(baseline).length !== 2 ||
      !("revision" in baseline) ||
      !("digest" in baseline) ||
      typeof baseline.revision !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(baseline.revision) ||
      typeof baseline.digest !== "string" ||
      !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(baseline.digest)
    ) {
      return failFairnessSnapshot(
        "migrationBaseline must be null or one exact revision/digest lineage",
      );
    }
  }

  return {
    ...canonicalCopy,
    roster: normalizedRoster(canonicalCopy.roster),
  } as unknown as ShiftPlanningFairnessSnapshot;
};

/**
 * Binds the normalized fairness snapshot to the versioned digest contract.
 * @param {unknown} snapshot Untrusted fairness inputs read by the runtime.
 * @return {ShiftPlanningDigest} Digest stable across roster query ordering.
 */
export const createShiftPlanningFairnessDigest = (
  snapshot: unknown,
): ShiftPlanningDigest =>
  createShiftPlanningDigest(normalizeShiftPlanningFairnessSnapshot(snapshot));
