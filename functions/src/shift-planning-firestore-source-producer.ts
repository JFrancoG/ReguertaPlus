import {
  DocumentReference,
  DocumentSnapshot,
  FieldPath,
  Firestore,
  Query,
  QueryDocumentSnapshot,
  Timestamp,
  Transaction,
} from "@google-cloud/firestore";
import {isEligibleForShiftRotation} from "./shift-eligibility.js";
import {
  SHIFT_PLANNING_FIRESTORE_TRANSACTION_WRITE_LIMIT,
} from "./shift-planning-bundle.js";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {
  ShiftPlanningCanonicalJsonObject,
  ShiftPlanningDigest,
  canonicalShiftPlanningJson,
  createShiftPlanningDigest,
  normalizeShiftPlanningFairnessSnapshot,
} from "./shift-planning-digest.js";
import {
  SHIFT_PLANNING_LIVE_SOURCE_DOCUMENT_ID,
  ShiftPlanningLiveSourceDocument,
  ShiftPlanningLiveSourceInputs,
  createFirestoreShiftPlanningForwardActivationResolver,
  createShiftPlanningLiveSourceDocument,
  parseShiftPlanningLiveSourceDocument,
} from "./shift-planning-firestore-source-resolver.js";
import {
  SHIFT_PLANNING_FIRESTORE_COMMIT_ADAPTER_REVISION,
} from "./shift-planning-firestore-transaction-serializer.js";
import {
  SHIFT_PLANNING_MAX_DEVICES_PER_USER,
  ShiftPlanningMemberDeviceRevisionSource,
  deriveShiftPlanningMemberRevision,
} from "./shift-planning-member-revision.js";
import {
  ShiftPlanningForwardActivationAttemptResolver,
} from "./shift-planning-firestore-cas-runtime.js";
import {buildShiftPlanningAuthoritativeState} from
  "./shift-planning-state-persistence.js";
import {
  ShiftPlanningEnvironment,
  parseShiftPlanningMaintenanceState,
  parseShiftRotationAggregateWire,
} from "./shift-planning-wire.js";

export const SHIFT_PLANNING_SOURCE_POLICY_SCHEMA_VERSION = 1 as const;
export const SHIFT_PLANNING_SOURCE_POLICY_DOCUMENT_ID =
  "sourcePolicy" as const;
export const SHIFT_PLANNING_SOURCE_MAX_USERS = 250 as const;
export const SHIFT_PLANNING_SOURCE_MAX_DEVICES_PER_USER =
  SHIFT_PLANNING_MAX_DEVICES_PER_USER;
export const SHIFT_PLANNING_SOURCE_MAX_CALENDAR_OVERRIDES = 400 as const;

type UnknownRecord = Record<string, unknown>;

export type ShiftPlanningSourcePolicy = {
  schemaVersion: typeof SHIFT_PLANNING_SOURCE_POLICY_SCHEMA_VERSION;
  environment: ShiftPlanningEnvironment;
  policyRevision: string;
  delivery: ShiftPlanningLiveSourceInputs["delivery"];
  market: ShiftPlanningLiveSourceInputs["market"];
  releaseLeaseDurationMillis: number;
  creditLedger: ShiftPlanningCanonicalJsonObject;
  sync: ShiftPlanningCanonicalJsonObject;
  transactionWriteLimit: number;
};

export type ShiftPlanningLiveSourceProductionResult = {
  kind: "created" | "updated" | "replayed";
  source: ShiftPlanningLiveSourceDocument;
};

const failSource = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_transaction", message);
};

const requireRecord = (value: unknown, name: string): UnknownRecord => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return failSource(`${name} must be a plain object.`);
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
    failSource(`${name} fields are not exact.`);
  }
};

const requireEnvironment = (value: unknown): ShiftPlanningEnvironment => {
  if (value !== "develop" && value !== "production") {
    return failSource("Planning source environment is invalid.");
  }
  return value;
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failSource(`${name} is not a valid identifier.`);
  }
  return value;
};

const requirePositiveInteger = (value: unknown, name: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    return failSource(`${name} must be a positive safe integer.`);
  }
  return value as number;
};

const requireNonNegativeInteger = (value: unknown, name: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return failSource(`${name} must be a non-negative safe integer.`);
  }
  return value as number;
};

const requireDigest = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return failSource(`${name} must be a planning digest.`);
  }
  return value;
};

const canonicalClone = <Value>(value: Value): Value =>
  JSON.parse(canonicalShiftPlanningJson(value)) as Value;

const planningRoot = (environment: ShiftPlanningEnvironment): string =>
  `${environment}/plus-collections`;

const digestSuffix = (digest: ShiftPlanningDigest): string =>
  digest.slice(digest.lastIndexOf(":") + 1);

const digestRevision = (prefix: string, value: unknown): string =>
  `${prefix}-${digestSuffix(createShiftPlanningDigest(value))}`;

const timestampValue = (
  value: unknown,
  name: string,
): {seconds: number; nanoseconds: number} => {
  if (!(value instanceof Timestamp)) {
    return failSource(`${name} must be a Firestore timestamp.`);
  }
  return {seconds: value.seconds, nanoseconds: value.nanoseconds};
};

const timestampSource = (value: unknown, name: string): Timestamp => {
  if (!(value instanceof Timestamp)) {
    return failSource(`${name} must be a Firestore timestamp.`);
  }
  return value;
};

const requireBoolean = (value: unknown, name: string): boolean => {
  if (typeof value !== "boolean") {
    return failSource(`${name} must be a boolean.`);
  }
  return value;
};

const requireNullableString = (
  value: unknown,
  name: string,
): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    return failSource(`${name} must be a string or null.`);
  }
  const normalized = value.trim();
  return normalized || null;
};

const requireCanonicalRoles = (value: unknown, name: string): string[] => {
  if (!Array.isArray(value) || value.length === 0) {
    return failSource(`${name} must contain canonical roles.`);
  }
  const roles = value.map((role) => {
    if (
      typeof role !== "string" ||
      !["member", "producer", "admin"].includes(role)
    ) {
      return failSource(`${name} contains an unsupported role.`);
    }
    return role;
  });
  if (new Set(roles).size !== roles.length || !roles.includes("member")) {
    return failSource(`${name} must be unique and include member.`);
  }
  return roles.sort();
};

const requirePlanningSourceTypePolicy = (
  value: unknown,
  type: "delivery" | "market",
): UnknownRecord => {
  const policy = requireRecord(value, `${type} planning source policy`);
  requireExactKeys(
    policy,
    type === "delivery" ? [
      "continuity",
      "inheritedTargetPrefix",
      "futureProjectionOccupancy",
    ] : ["inheritedTargetPrefix", "futureProjectionOccupancy"],
    `${type} planning source policy`,
  );
  if (!Array.isArray(policy.futureProjectionOccupancy)) {
    return failSource(
      `${type} futureProjectionOccupancy must be an array.`,
    );
  }
  if (
    policy.inheritedTargetPrefix !== null &&
    (
      typeof policy.inheritedTargetPrefix !== "object" ||
      Array.isArray(policy.inheritedTargetPrefix)
    )
  ) {
    return failSource(`${type} inheritedTargetPrefix is invalid.`);
  }
  if (
    type === "delivery" &&
    (
      typeof policy.continuity !== "object" ||
      policy.continuity === null ||
      Array.isArray(policy.continuity)
    )
  ) {
    return failSource("Delivery continuity policy is invalid.");
  }
  return policy;
};

const requireWorkbookPartition = (
  value: unknown,
  type: "delivery" | "market",
): void => {
  const partition = requireRecord(value, `${type} workbook partition`);
  requireExactKeys(partition, [
    "workbookId",
    "workbookRevision",
    "partitionKey",
    "stateRevision",
    "epoch",
    "lease",
  ], `${type} workbook partition`);
  requireIdentifier(partition.workbookId, `${type} workbookId`);
  requireIdentifier(partition.workbookRevision, `${type} workbookRevision`);
  requireIdentifier(partition.partitionKey, `${type} partitionKey`);
  requireNonNegativeInteger(partition.stateRevision, `${type} stateRevision`);
  requireNonNegativeInteger(partition.epoch, `${type} partition epoch`);
  if (partition.lease !== null) {
    requireRecord(partition.lease, `${type} workbook lease`);
  }
};

const parseSourcePolicy = (value: unknown): ShiftPlanningSourcePolicy => {
  const policy = requireRecord(value, "planning source policy");
  requireExactKeys(policy, [
    "schemaVersion",
    "environment",
    "policyRevision",
    "delivery",
    "market",
    "releaseLeaseDurationMillis",
    "creditLedger",
    "sync",
    "transactionWriteLimit",
  ], "planning source policy");
  if (policy.schemaVersion !== SHIFT_PLANNING_SOURCE_POLICY_SCHEMA_VERSION) {
    return failSource("Planning source policy schema is unsupported.");
  }
  const transactionWriteLimit = requirePositiveInteger(
    policy.transactionWriteLimit,
    "planning source policy transactionWriteLimit",
  );
  if (
    transactionWriteLimit > SHIFT_PLANNING_FIRESTORE_TRANSACTION_WRITE_LIMIT
  ) {
    return failSource("Planning source policy write limit exceeds Firestore.");
  }
  const creditLedger = requireRecord(
    policy.creditLedger,
    "planning source policy creditLedger",
  );
  requireExactKeys(creditLedger, [
    "enabled",
    "revision",
    "digest",
    "plannedWriteCount",
  ], "planning source policy creditLedger");
  if (
    creditLedger.enabled !== false ||
    creditLedger.plannedWriteCount !== 0
  ) {
    return failSource("Planning source coverage credits remain disabled.");
  }
  requireIdentifier(creditLedger.revision, "planning credit revision");
  requireDigest(creditLedger.digest, "planning credit digest");
  const sync = requireRecord(policy.sync, "planning source policy sync");
  requireExactKeys(sync, [
    "leaseDurationMillis",
    "transactionMeasurementAuthority",
    "partitions",
  ], "planning source policy sync");
  requirePositiveInteger(
    sync.leaseDurationMillis,
    "planning sync lease duration",
  );
  const authority = requireRecord(
    sync.transactionMeasurementAuthority,
    "planning source transaction measurement authority",
  );
  requireExactKeys(authority, [
    "adapterRevision",
    "indexConfigurationDigest",
  ], "planning source transaction measurement authority");
  if (
    authority.adapterRevision !==
      SHIFT_PLANNING_FIRESTORE_COMMIT_ADAPTER_REVISION ||
    typeof authority.indexConfigurationDigest !== "string" ||
    !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(
      authority.indexConfigurationDigest,
    )
  ) {
    return failSource("Planning source measurement authority is invalid.");
  }
  const partitions = requireRecord(
    sync.partitions,
    "planning source workbook partitions",
  );
  requireExactKeys(
    partitions,
    ["delivery", "market"],
    "planning source workbook partitions",
  );
  requireWorkbookPartition(partitions.delivery, "delivery");
  requireWorkbookPartition(partitions.market, "market");
  const delivery = requirePlanningSourceTypePolicy(
    policy.delivery,
    "delivery",
  );
  const market = requirePlanningSourceTypePolicy(policy.market, "market");
  return {
    schemaVersion: SHIFT_PLANNING_SOURCE_POLICY_SCHEMA_VERSION,
    environment: requireEnvironment(policy.environment),
    policyRevision: requireIdentifier(
      policy.policyRevision,
      "planning source policyRevision",
    ),
    delivery: canonicalClone(delivery) as
      ShiftPlanningSourcePolicy["delivery"],
    market: canonicalClone(market) as
      ShiftPlanningSourcePolicy["market"],
    releaseLeaseDurationMillis: requirePositiveInteger(
      policy.releaseLeaseDurationMillis,
      "planning source release lease duration",
    ),
    creditLedger: canonicalClone(creditLedger) as
      ShiftPlanningCanonicalJsonObject,
    sync: canonicalClone(sync) as ShiftPlanningCanonicalJsonObject,
    transactionWriteLimit,
  };
};

const requireSnapshot = (
  snapshot: DocumentSnapshot,
  name: string,
): QueryDocumentSnapshot => {
  if (!snapshot.exists) return failSource(`${name} does not exist.`);
  return snapshot as QueryDocumentSnapshot;
};

const parseDeliveryWeekday = (snapshot: DocumentSnapshot): string => {
  const data = requireRecord(
    requireSnapshot(snapshot, "config/global").data(),
    "config/global",
  );
  const otherConfig = data.otherConfig === undefined ? {} :
    requireRecord(data.otherConfig, "config/global.otherConfig");
  const values = [data.deliveryDayOfWeek, otherConfig.deliveryDayOfWeek]
    .filter((value): value is string =>
      typeof value === "string" && Boolean(value.trim()))
    .map((value) => value.trim().toUpperCase());
  if (values.length === 0 || new Set(values).size !== 1) {
    return failSource(
      "config/global delivery weekday is missing or contradictory.",
    );
  }
  if (
    !["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
      .includes(values[0])
  ) {
    return failSource("config/global delivery weekday is invalid.");
  }
  return values[0];
};

type SourceRosterMember = {
  userId: string;
  roles: string[];
  isActive: boolean;
  isCommonPurchaseManager: boolean;
  membershipRevision: number;
  eligibilityRevision: number;
  destinationRevision: number;
  membershipDigest: ShiftPlanningDigest;
  eligibilityDigest: ShiftPlanningDigest;
  destinationDigest: ShiftPlanningDigest;
};

const parseRosterMember = (
  snapshot: QueryDocumentSnapshot,
): SourceRosterMember => {
  const data = snapshot.data();
  const roles = requireCanonicalRoles(
    data.roles,
    `users/${snapshot.id}.roles`,
  );
  const isActive = requireBoolean(
    data.isActive,
    `users/${snapshot.id}.isActive`,
  );
  const isCommonPurchaseManager = requireBoolean(
    data.isCommonPurchaseManager,
    `users/${snapshot.id}.isCommonPurchaseManager`,
  );
  const revision = deriveShiftPlanningMemberRevision({
    userId: snapshot.id,
    roles,
    isActive,
    isCommonPurchaseManager,
    devices: [],
  });
  return {
    userId: revision.userId,
    roles: [...revision.roles],
    isActive: revision.isActive,
    isCommonPurchaseManager: revision.isCommonPurchaseManager,
    membershipRevision: revision.membershipRevision,
    eligibilityRevision: revision.eligibilityRevision,
    destinationRevision: revision.destinationRevision,
    membershipDigest: revision.membershipDigest,
    eligibilityDigest: revision.eligibilityDigest,
    destinationDigest: revision.destinationDigest,
  };
};

const deviceRevisionSource = (
  snapshot: QueryDocumentSnapshot,
): ShiftPlanningMemberDeviceRevisionSource => ({
  deviceId: snapshot.id,
  fcmToken: requireNullableString(
    snapshot.get("fcmToken"),
    `device ${snapshot.id}.fcmToken`,
  ),
  firebaseInstallationId: requireNullableString(
    snapshot.get("firebaseInstallationId"),
    `device ${snapshot.id}.firebaseInstallationId`,
  ),
  tokenUpdatedAt: snapshot.get("tokenUpdatedAt") === undefined ||
    snapshot.get("tokenUpdatedAt") === null ? null :
    timestampSource(
      snapshot.get("tokenUpdatedAt"),
      `device ${snapshot.id}.tokenUpdatedAt`,
    ),
  registrationUpdatedAt: snapshot.get("registrationUpdatedAt") === undefined ||
    snapshot.get("registrationUpdatedAt") === null ? null :
    timestampSource(
      snapshot.get("registrationUpdatedAt"),
      `device ${snapshot.id}.registrationUpdatedAt`,
    ),
});

const withDestinationRevision = (
  member: SourceRosterMember,
  devices: readonly QueryDocumentSnapshot[],
): SourceRosterMember => {
  const revision = deriveShiftPlanningMemberRevision({
    userId: member.userId,
    roles: member.roles,
    isActive: member.isActive,
    isCommonPurchaseManager: member.isCommonPurchaseManager,
    devices: devices.map(deviceRevisionSource),
  });
  return {
    ...member,
    destinationRevision: revision.destinationRevision,
    destinationDigest: revision.destinationDigest,
  };
};

const calendarProjection = (
  snapshot: QueryDocumentSnapshot,
): ShiftPlanningCanonicalJsonObject => {
  const weekKey = requireIdentifier(
    snapshot.get("weekKey"),
    `${snapshot.id}.weekKey`,
  );
  if (weekKey !== snapshot.id) {
    return failSource(`deliveryCalendar/${snapshot.id} weekKey has drifted.`);
  }
  return {
    weekKey,
    deliveryDate: timestampValue(
      snapshot.get("deliveryDate"),
      `${weekKey}.deliveryDate`,
    ),
    ordersBlockedDate: timestampValue(
      snapshot.get("ordersBlockedDate"),
      `${weekKey}.ordersBlockedDate`,
    ),
    ordersOpenAt: timestampValue(
      snapshot.get("ordersOpenAt"),
      `${weekKey}.ordersOpenAt`,
    ),
    ordersCloseAt: timestampValue(
      snapshot.get("ordersCloseAt"),
      `${weekKey}.ordersCloseAt`,
    ),
  };
};

const readBoundedQuery = async (
  transaction: Transaction,
  query: Query,
  maximum: number,
  name: string,
): Promise<QueryDocumentSnapshot[]> => {
  const snapshot = await transaction.get(query.limit(maximum + 1));
  if (snapshot.size > maximum) {
    return failSource(`${name} exceeds its governed read limit.`);
  }
  return snapshot.docs;
};

const buildSourceInTransaction = async (input: {
  firestore: Firestore;
  transaction: Transaction;
  environment: ShiftPlanningEnvironment;
}): Promise<ShiftPlanningLiveSourceDocument> => {
  const {firestore, transaction, environment} = input;
  const root = planningRoot(environment);
  const [
    policySnapshot,
    configSnapshot,
    maintenanceSnapshot,
    deliveryRotationSnapshot,
    marketRotationSnapshot,
  ] = await transaction.getAll(
    firestore.doc(
      `${root}/shiftPlanningState/` +
        SHIFT_PLANNING_SOURCE_POLICY_DOCUMENT_ID,
    ),
    firestore.doc(`${root}/config/global`),
    firestore.doc(`${root}/shiftPlanningState/current`),
    firestore.doc(`${root}/shiftRotations/delivery`),
    firestore.doc(`${root}/shiftRotations/market`),
  );
  const policy = parseSourcePolicy(
    requireSnapshot(policySnapshot, "planning source policy").data(),
  );
  if (policy.environment !== environment) {
    return failSource("Planning source policy environment has drifted.");
  }
  const maintenance = parseShiftPlanningMaintenanceState(
    requireSnapshot(maintenanceSnapshot, "planning maintenance state").data(),
  );
  const rotations = {
    delivery: parseShiftRotationAggregateWire(
      requireSnapshot(deliveryRotationSnapshot, "delivery rotation").data(),
      "delivery",
    ),
    market: parseShiftRotationAggregateWire(
      requireSnapshot(marketRotationSnapshot, "market rotation").data(),
      "market",
    ),
  };
  buildShiftPlanningAuthoritativeState({environment, maintenance, rotations});
  const users = await readBoundedQuery(
    transaction,
    firestore.collection(`${root}/users`).orderBy(FieldPath.documentId()),
    SHIFT_PLANNING_SOURCE_MAX_USERS,
    "planning users",
  );
  const roster = users.map(parseRosterMember);
  for (let index = 0; index < roster.length; index += 1) {
    const member = roster[index];
    if (!isEligibleForShiftRotation(member)) continue;
    const devices = await readBoundedQuery(
      transaction,
      firestore.collection(`${root}/users/${member.userId}/devices`)
        .orderBy(FieldPath.documentId()),
      SHIFT_PLANNING_SOURCE_MAX_DEVICES_PER_USER,
      `devices for ${member.userId}`,
    );
    roster[index] = withDestinationRevision(member, devices);
  }
  const calendarDocuments = await readBoundedQuery(
    transaction,
    firestore.collection(`${root}/deliveryCalendar`)
      .orderBy(FieldPath.documentId()),
    SHIFT_PLANNING_SOURCE_MAX_CALENDAR_OVERRIDES,
    "delivery calendar overrides",
  );
  const calendarEntries = calendarDocuments.map(calendarProjection);
  const calendarDigest = createShiftPlanningDigest(calendarEntries);
  const rosterDigest = createShiftPlanningDigest(roster);
  const deliveryWeekday = parseDeliveryWeekday(configSnapshot);
  const configProjection = {
    deliveryWeekday,
    timeZone: "Europe/Madrid",
    releaseLeaseDurationMillis: policy.releaseLeaseDurationMillis,
    policyRevision: policy.policyRevision,
  };
  const fairnessSnapshot = normalizeShiftPlanningFairnessSnapshot({
    snapshotVersion: 1,
    environment,
    writeEpoch: maintenance.writeEpoch,
    activeRevision: maintenance.activeRevision,
    activeDigest: maintenance.activeDigest,
    membership: {
      revision: digestRevision("membership", roster),
      digest: rosterDigest,
      memberCount: roster.length,
    },
    roster,
    rotations,
    config: {
      ...configProjection,
      revision: digestRevision("config", configProjection),
      digest: createShiftPlanningDigest(configProjection),
    },
    calendar: {
      revision: digestRevision("calendar", calendarEntries),
      deliveryOverrideRevision: digestRevision(
        "delivery-calendar",
        calendarEntries,
      ),
      marketCalendarRevision: "market-calendar-v1",
      digest: calendarDigest,
      overrideCount: calendarEntries.length,
    },
    overrides: {
      revision: digestRevision("overrides", calendarEntries),
      digest: calendarDigest,
      entries: calendarEntries,
    },
    creditLedger: policy.creditLedger,
    sync: policy.sync,
    migrationBaseline: rotations.delivery.migrationBaseline,
  });
  const inputs: ShiftPlanningLiveSourceInputs = {
    fairnessSnapshot,
    delivery: policy.delivery,
    market: policy.market,
    transactionWriteLimit: policy.transactionWriteLimit,
  };
  return createShiftPlanningLiveSourceDocument({
    environment,
    sourceRevision: digestRevision("source", inputs),
    inputs,
  });
};

/**
 * Rebuilds the governed live source from the transaction's complete read-set.
 */
export const rebuildShiftPlanningLiveSourceInTransaction =
  buildSourceInTransaction;

/**
 * Loads the cached planning source only when the same read-only transaction can
 * rebuild its governed inputs to the identical digest. This gives preview and
 * stage a current source without adding a derived-state write to their allowed
 * lifecycle effects.
 * @param {object} input Firestore instance and environment to inspect.
 * @return {Promise<ShiftPlanningLiveSourceDocument>} Current governed source.
 */
export const loadCurrentShiftPlanningLiveSource = async (input: {
  firestore: Firestore;
  environment: ShiftPlanningEnvironment;
}): Promise<ShiftPlanningLiveSourceDocument> => {
  const environment = requireEnvironment(input.environment);
  return input.firestore.runTransaction(async (transaction) => {
    const rebuilt = await buildSourceInTransaction({
      firestore: input.firestore,
      transaction,
      environment,
    });
    const cachedSnapshot = await transaction.get(input.firestore.doc(
      `${planningRoot(environment)}/shiftPlanningState/` +
        SHIFT_PLANNING_LIVE_SOURCE_DOCUMENT_ID,
    ));
    const cached = parseShiftPlanningLiveSourceDocument(
      requireSnapshot(cachedSnapshot, "planning live source").data(),
    );
    if (
      cached.environment !== environment ||
      cached.sourceDigest !== rebuilt.sourceDigest
    ) {
      return failSource("Planning live source is stale.");
    }
    return rebuilt;
  });
};

/**
 * Creates a forward resolver that must rebuild every governed source inside
 * the same Firestore transaction attempt before activation can materialize.
 * @param {object} input Environment and immutable activation request identity.
 * @return {ShiftPlanningForwardActivationAttemptResolver} Governed resolver.
 */
export const createGovernedShiftPlanningForwardActivationResolver = (input: {
  environment: ShiftPlanningEnvironment;
  requestId: string;
}): ShiftPlanningForwardActivationAttemptResolver =>
  createFirestoreShiftPlanningForwardActivationResolver({
    ...input,
    rebuildLiveSource: buildSourceInTransaction,
  });

/**
 * Rebuilds and atomically refreshes the derived fairness envelope. Exact
 * retries perform no write; drift replaces the prior derived document under
 * the same optimistic transaction read-set.
 * @param {object} input Firestore instance and environment to refresh.
 * @return {Promise<ShiftPlanningLiveSourceProductionResult>} Exact outcome.
 */
export const refreshShiftPlanningLiveSource = async (input: {
  firestore: Firestore;
  environment: ShiftPlanningEnvironment;
}): Promise<ShiftPlanningLiveSourceProductionResult> => {
  const environment = requireEnvironment(input.environment);
  return input.firestore.runTransaction(async (transaction) => {
    const source = await buildSourceInTransaction({
      firestore: input.firestore,
      transaction,
      environment,
    });
    const reference: DocumentReference = input.firestore.doc(
      `${planningRoot(environment)}/shiftPlanningState/` +
        SHIFT_PLANNING_LIVE_SOURCE_DOCUMENT_ID,
    );
    const currentSnapshot = await transaction.get(reference);
    if (currentSnapshot.exists) {
      const current = parseShiftPlanningLiveSourceDocument(
        currentSnapshot.data(),
      );
      if (current.sourceDigest === source.sourceDigest) {
        return {kind: "replayed", source};
      }
      transaction.set(reference, source);
      return {kind: "updated", source};
    }
    transaction.create(reference, source);
    return {kind: "created", source};
  });
};
