import {setGlobalOptions} from "firebase-functions/v2";
import {onRequest, Request} from "firebase-functions/v2/https";
import {
  onDocumentCreatedWithAuthContext,
  onDocumentWritten,
  onDocumentWrittenWithAuthContext,
} from "firebase-functions/v2/firestore";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {logger} from "firebase-functions";
import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {
  DocumentReference,
  DocumentSnapshot,
  FieldValue,
  getFirestore,
  QueryDocumentSnapshot,
  Timestamp,
  Transaction,
} from "firebase-admin/firestore";
import {getMessaging, SendResponse} from "firebase-admin/messaging";
import {Response} from "express";
import {google} from "googleapis";
import {
  AppEnvironment,
  assertMemberIdCompatible,
  buildMemberId as buildSecureMemberId,
  canProcessPrivilegedFirestoreEvent,
  HttpRequestError,
  isAdminMember,
  isOperationallyLinkedAdmin,
  isVerifiedLinkedAdminActor,
  LinkedMember,
  parseAppEnvironment,
  parseMemberUpsertInput,
  resolveReviewerEnvironment,
  resolveMemberBusinessFields,
  resolveLinkedMember,
  requirePostMethod,
  verifyBearerIdentity,
  VerifiedIdentity,
} from "./backend-security.js";
import {
  applyMemberSwap,
  assertActiveShiftSwapParticipants,
  assertShiftSwapTimingEligible,
  buildShiftSwapCandidates,
  parseShiftSwapTransitionInput,
  recomputeDeliveryHelpers,
  ShiftLike,
  ShiftSwapCandidateLike,
  ShiftSwapResponseLike,
  upsertShiftSwapResponse,
} from "./shift-swap-security.js";
import {buildNotificationInboxDocument} from "./notification-inbox.js";
import {buildMemberDirectoryDocument} from "./member-directory.js";
import {isEligibleForShiftRotation} from "./shift-eligibility.js";
import {
  classifyShiftPlanningCreatedRequest,
  createFirestoreShiftPlanningRuntime,
} from "./shift-planning-firestore-runtime.js";
import {
  createFirestoreShiftPlanningOperatorRecoveryExecutor,
} from "./shift-planning-operator-recovery.js";
import {
  createShiftPlanningOperatorRecoveryHttpFunction,
} from "./shift-planning-operator-http.js";
import {
  ShiftPlanningNotificationGuardedShiftWriteResult,
  ShiftPlanningNotificationWriterResource,
  inspectShiftPlanningNotificationWriterFences,
  runShiftPlanningNotificationGuardedShiftWrite,
} from "./shift-planning-firestore-notification-writer-fence.js";

const firebaseApp = initializeApp();
const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);
const messaging = getMessaging(firebaseApp);
const shiftPlanningRuntime = createFirestoreShiftPlanningRuntime(firestore);
const shiftPlanningRecoveryExecutor =
  createFirestoreShiftPlanningOperatorRecoveryExecutor(firestore);

setGlobalOptions({
  region: "europe-west1",
  concurrency: 1,
  cpu: 1,
  memory: "256MiB",
  timeoutSeconds: 60,
});

export const executeShiftPlanningRecovery =
  createShiftPlanningOperatorRecoveryHttpFunction(
    shiftPlanningRecoveryExecutor,
    logger,
  );

let ENV = "develop";

const parseRuntimeConfig = (): Record<string, unknown> => {
  const rawConfig = process.env.CLOUD_RUNTIME_CONFIG;
  if (!rawConfig) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawConfig);
    return parsed !== null && typeof parsed === "object" ?
      parsed as Record<string, unknown> :
      {};
  } catch {
    return {};
  }
};

const runtimeConfig = parseRuntimeConfig();

const getRuntimeConfigNamespace = (
  namespace: string,
): Record<string, unknown> => {
  const value = runtimeConfig[namespace];
  return value !== null && typeof value === "object" ?
    value as Record<string, unknown> :
    {};
};

const parseOptionalEnvString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const appConfig = getRuntimeConfigNamespace("app");
ENV = parseOptionalEnvString(process.env.APP_ENV) ||
  parseOptionalEnvString(appConfig.env) ||
  "develop";

const updateTimestamp = async (env: string, collectionName: string) => {
  const now = Timestamp.now();
  const config = firestore.collection(`${env}/plus-collections/config`);
  const update = {
    lastTimestamps: {
      [collectionName]: now,
    },
  };
  const batch = firestore.batch();
  batch.set(config.doc("global"), update, {merge: true});
  batch.set(config.doc("member"), update, {merge: true});
  await batch.commit();
};

const parseBody = (value: unknown): Record<string, unknown> => {
  if (value !== null && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
};

const usersCollection = (env: string) =>
  firestore.collection(`${env}/plus-collections/users`);

const authLinksCollection = (env: AppEnvironment) =>
  firestore.collection(`${env}/plus-collections/authLinks`);

const plusUsersCollection = (env: string) =>
  firestore.collection(`${env}/plus-collections/users`);

const deliveryCalendarCollection = (env: string) =>
  firestore.collection(`${env}/plus-collections/deliveryCalendar`);

const globalConfigDocRefs = (env: string) => [
  firestore.collection(`${env}/plus-collections/config`).doc("global"),
];

const parseString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const verifyRequestIdentity = async (
  request: Request,
): Promise<VerifiedIdentity> => verifyBearerIdentity(
  request.headers.authorization,
  (token, checkRevoked) =>
    auth.verifyIdToken(token, checkRevoked),
);

const parseRequestEnvironment = (request: Request): AppEnvironment => {
  const body = parseBody(request.body);
  return parseAppEnvironment(
    body.environment ?? body.env ?? request.query.environment ??
    request.query.env ?? ENV,
  );
};

const resolveRequestEnvironmentForIdentity = async (
  requestedEnvironment: AppEnvironment,
  identity: VerifiedIdentity,
): Promise<AppEnvironment> => {
  if (requestedEnvironment !== "production") {
    return requestedEnvironment;
  }
  const globalConfigSnapshot = await globalConfigDocRefs("production")[0]
    .get();
  return resolveReviewerEnvironment(
    requestedEnvironment,
    identity,
    globalConfigSnapshot.exists ? globalConfigSnapshot.data() : {},
  );
};

const readLinkedMember = async (
  environment: AppEnvironment,
  identity: VerifiedIdentity,
): Promise<LinkedMember | null> => {
  const linkSnapshot = await authLinksCollection(environment)
    .doc(identity.uid)
    .get();
  if (!linkSnapshot.exists) {
    return null;
  }
  const linkData = parseBody(linkSnapshot.data());
  const memberId = parseString(linkData.memberId);
  if (!memberId || memberId.includes("/")) {
    throw new HttpRequestError(403, "invalid_link", "Account link is invalid");
  }
  const memberSnapshot = await usersCollection(environment).doc(memberId).get();
  if (!memberSnapshot.exists) {
    throw new HttpRequestError(403, "invalid_link", "Account link is invalid");
  }
  return resolveLinkedMember(identity.uid, linkData, memberSnapshot.data());
};

const requireLinkedMember = async (
  environment: AppEnvironment,
  identity: VerifiedIdentity,
): Promise<LinkedMember> => {
  const member = await readLinkedMember(environment, identity);
  if (!member) {
    throw new HttpRequestError(
      403,
      "unlinked_account",
      "Account is not linked",
    );
  }
  return member;
};

const requireAdminInEnvironment = async (
  environment: AppEnvironment,
  identity: VerifiedIdentity,
): Promise<LinkedMember> => {
  const member = await requireLinkedMember(environment, identity);
  if (!isAdminMember(member)) {
    throw new HttpRequestError(
      403,
      "admin_required",
      "An active admin is required",
    );
  }
  return member;
};

const resolveVerifiedLinkedAdminActor = async (
  environment: AppEnvironment,
  uid: string,
): Promise<boolean> => {
  try {
    const linkSnapshot = await authLinksCollection(environment).doc(uid).get();
    if (!linkSnapshot.exists) {
      return false;
    }
    const linkValue = linkSnapshot.data();
    const memberId = parseString(parseBody(linkValue).memberId);
    if (!memberId || memberId.includes("/")) {
      return false;
    }
    const [authUser, memberSnapshot] = await Promise.all([
      auth.getUser(uid),
      usersCollection(environment).doc(memberId).get(),
    ]);
    return memberSnapshot.exists && isVerifiedLinkedAdminActor(
      uid,
      authUser,
      linkValue,
      memberSnapshot.data(),
    );
  } catch {
    return false;
  }
};

const authorizePrivilegedFirestoreEvent = async (
  functionName: string,
  environmentValue: string,
  authType: "service_account" | "api_key" | "system" |
    "unauthenticated" | "unknown",
  authId?: string,
): Promise<boolean> => {
  if (
    environmentValue !== "develop" &&
    environmentValue !== "production"
  ) {
    logger.warn("Skipping privileged Firestore event for unknown environment", {
      functionName,
      environment: environmentValue,
    });
    return false;
  }
  const environment = environmentValue as AppEnvironment;
  const authorized = await canProcessPrivilegedFirestoreEvent(
    {authType, authId},
    (uid) => resolveVerifiedLinkedAdminActor(environment, uid),
  );
  if (!authorized) {
    logger.warn("Skipping unauthorized privileged Firestore event", {
      functionName,
      environment,
      authType,
      hasAuthId: typeof authId === "string" && authId.length > 0,
    });
  }
  return authorized;
};

const sendHttpError = (response: Response, error: unknown): void => {
  if (error instanceof HttpRequestError) {
    response.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }
  logger.error("HTTP operation failed", {
    error: error instanceof Error ? error.message : "Unknown error",
  });
  response.status(500).json({
    error: {
      code: "internal",
      message: "Internal server error",
    },
  });
};

const requireShiftPlanningNotificationResourcesWritable = async (
  transaction: Transaction,
  environment: AppEnvironment,
  resources: readonly ShiftPlanningNotificationWriterResource[],
  now: Timestamp,
): Promise<void> => {
  const result = await inspectShiftPlanningNotificationWriterFences({
    firestore,
    transaction,
    root: `${environment}/plus-collections`,
    resources,
    now,
  });
  if (result.kind === "busy") {
    throw shiftPlanningNotificationDispatchInProgressError();
  }
};

const shiftPlanningNotificationDispatchInProgressError = () =>
  new HttpRequestError(
    409,
    "shift_notification_dispatch_in_progress",
    "A shift notification is being delivered. Try again shortly.",
  );

const requireShiftPlanningNotificationGuardedWrite = <Value>(
  result: ShiftPlanningNotificationGuardedShiftWriteResult<Value>,
): Value => {
  if (result.kind === "busy") {
    throw shiftPlanningNotificationDispatchInProgressError();
  }
  return result.value;
};

const parseAdminTargetEnvironments = (
  request: Request,
): AppEnvironment[] => {
  const body = parseBody(request.body);
  const raw = body.environments ?? body.envs ?? body.environment ?? body.env ??
    request.query.environments ?? request.query.envs ??
    request.query.environment ?? request.query.env;
  const values = (Array.isArray(raw) ? raw : [raw])
    .flatMap((entry) => typeof entry === "string" ? entry.split(",") : [])
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (values.length === 0) {
    return ["develop", "production"];
  }
  return Array.from(new Set(values.map(parseAppEnvironment)));
};

const requireAdminForTargets = async (
  request: Request,
  environments: AppEnvironment[],
): Promise<VerifiedIdentity> => {
  requirePostMethod(request.method);
  const identity = await verifyRequestIdentity(request);
  await Promise.all(environments.map((environment) =>
    requireAdminInEnvironment(environment, identity)
  ));
  return identity;
};

const parseBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const parseRoles = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return ["member"];
  }

  const allowedRoles = new Set(["member", "producer", "admin"]);
  const roles = value
    .filter((item): item is string => typeof item === "string")
    .map((role) => role.trim().toLowerCase())
    .filter((role) => allowedRoles.has(role));

  return roles.length > 0 ? Array.from(new Set(roles)) : ["member"];
};

const parseStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  ));
};

type VersionPlatformKey = "android" | "ios";

type VersionPolicy = {
  current: string;
  min: string;
  forceUpdate: boolean;
  storeUrl: string;
};

type DeliveryCalendarOverrideMap = Map<string, Timestamp>;

const VERSION_STRING_REGEX = /^\d+(?:\.\d+)*$/;
const DEFAULT_ORDER_REMINDER_ENVS = ["develop", "production"];
const DEFAULT_CACHE_EXPIRATION_MINUTES = 15;
const REQUIRED_FRESHNESS_COLLECTIONS = [
  "products",
  "containers",
  "measures",
  "orders",
  "orderlines",
  "users",
] as const;
const DEFAULT_VERSION_POLICIES: Record<VersionPlatformKey, VersionPolicy> = {
  android: {
    current: "0.3.0",
    min: "0.3.0",
    forceUpdate: false,
    storeUrl: "https://play.google.com/store/apps/details?id=com.reguerta.user",
  },
  ios: {
    current: "0.3.0",
    min: "0.3.0",
    forceUpdate: false,
    storeUrl: "https://apps.apple.com",
  },
};

const parseEnvList = (value: unknown): string[] => {
  const source = Array.isArray(value) ? value : [value];

  return Array.from(new Set(
    source
      .flatMap((entry) =>
        typeof entry === "string" ? entry.split(",") : []
      )
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0)
  ));
};

const parseOrderReminderEnvs = (): string[] => {
  const configured = Array.from(new Set([
    ...parseEnvList(process.env.ORDER_REMINDER_ENVS),
    ...parseEnvList(appConfig.orderReminderEnvs),
    ...parseEnvList(appConfig.order_reminder_envs),
  ]));

  if (configured.length > 0) {
    return configured;
  }

  const normalizedEnv = ENV.trim().toLowerCase();
  if (normalizedEnv && normalizedEnv !== "local") {
    return [normalizedEnv];
  }

  return DEFAULT_ORDER_REMINDER_ENVS;
};

const parseVersionValue = (value: unknown, fallback: string): string => {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim();
  if (!VERSION_STRING_REGEX.test(normalized)) {
    return fallback;
  }
  return normalized;
};

const parseStoreUrlValue = (value: unknown, fallback: string): string => {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim();
  if (!normalized) {
    return fallback;
  }
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return fallback;
    }
    return parsed.toString();
  } catch {
    return fallback;
  }
};

const parsePositiveInteger = (value: unknown, fallback: number): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

const parseNonNegativeInteger = (value: unknown, fallback: number): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

const sanitizeLastTimestamps = (
  value: unknown,
  fallback: Timestamp,
): Record<string, Timestamp> => {
  const source = parseBody(value);

  return Object.fromEntries(
    REQUIRED_FRESHNESS_COLLECTIONS.map((collection) => {
      const rawValue = source[collection];
      const timestamp = rawValue instanceof Timestamp ?
        rawValue :
        fallback;
      return [collection, timestamp];
    })
  );
};

const sanitizeDeliveryDayOfWeek = (value: unknown): string => {
  const source = parseBody(value);
  const otherConfig = parseBody(source.otherConfig);
  const candidates = [
    source.deliveryDayOfWeek,
    otherConfig.deliveryDayOfWeek,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const normalized = candidate.trim().toUpperCase();
    if (["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
      .includes(normalized)) {
      return normalized;
    }
  }
  return "WED";
};

const buildMemberConfigProjection = (
  value: unknown,
  fallbackTimestamp: Timestamp,
) => {
  const source = parseBody(value);
  return {
    cacheExpirationMinutes: parsePositiveInteger(
      source.cacheExpirationMinutes,
      DEFAULT_CACHE_EXPIRATION_MINUTES,
    ),
    lastTimestamps: sanitizeLastTimestamps(
      source.lastTimestamps,
      fallbackTimestamp,
    ),
    deliveryDayOfWeek: sanitizeDeliveryDayOfWeek(source),
  };
};

const sanitizeVersionPolicy = (
  value: unknown,
  fallback: VersionPolicy,
): VersionPolicy => {
  const source = parseBody(value);

  return {
    current: parseVersionValue(source.current, fallback.current),
    min: parseVersionValue(source.min, fallback.min),
    forceUpdate: parseBoolean(source.forceUpdate, fallback.forceUpdate),
    storeUrl: parseStoreUrlValue(source.storeUrl, fallback.storeUrl),
  };
};

const sanitizeVersionPolicies = (
  value: unknown,
): Record<VersionPlatformKey, VersionPolicy> => {
  const source = parseBody(value);

  return {
    android: sanitizeVersionPolicy(
      source.android,
      DEFAULT_VERSION_POLICIES.android
    ),
    ios: sanitizeVersionPolicy(
      source.ios,
      DEFAULT_VERSION_POLICIES.ios
    ),
  };
};

type NotificationDispatchPayload = {
  title: string;
  body: string;
  type: string;
  target: string;
  userIds: string[];
  segmentType: string | null;
  targetRole: string | null;
};

const parseNotificationDispatchPayload = (
  value: Record<string, unknown>,
): NotificationDispatchPayload | null => {
  const title = parseString(value.title);
  const body = parseString(value.body);
  const type = parseString(value.type);
  const target = parseString(value.target);
  const targetPayload = parseBody(value.targetPayload);

  if (!title || !body || !type || !target) {
    return null;
  }

  return {
    title,
    body,
    type,
    target,
    userIds: parseStringArray(targetPayload.userIds),
    segmentType: parseString(targetPayload.segmentType),
    targetRole: parseString(targetPayload.role)?.toLowerCase() || null,
  };
};

const chunkArray = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const resolveTargetUserIds = async (
  env: string,
  payload: NotificationDispatchPayload,
): Promise<string[]> => {
  const collection = plusUsersCollection(env);

  switch (payload.target) {
  case "all": {
    const snapshot = await collection
      .where("isActive", "==", true)
      .get();
    return snapshot.docs.map((doc) => doc.id);
  }
  case "users": {
    const userIds = payload.userIds;
    if (userIds.length === 0) {
      return [];
    }

    const snapshots = await firestore.getAll(
      ...userIds.map((userId) => collection.doc(userId))
    );

    return snapshots
      .filter(
        (snapshot) => snapshot.exists && snapshot.get("isActive") === true
      )
      .map((snapshot) => snapshot.id);
  }
  case "segment": {
    if (payload.segmentType !== "role" || !payload.targetRole) {
      return [];
    }

    const snapshot = await collection
      .where("isActive", "==", true)
      .where("roles", "array-contains", payload.targetRole)
      .get();
    return snapshot.docs.map((doc) => doc.id);
  }
  default:
    return [];
  }
};

const fanOutNotificationInbox = async (
  env: string,
  eventId: string,
  eventData: Record<string, unknown>,
  targetUserIds: string[],
): Promise<number> => {
  const uniqueUserIds = Array.from(new Set(targetUserIds));
  for (const userIdChunk of chunkArray(uniqueUserIds, 400)) {
    const batch = firestore.batch();
    userIdChunk.forEach((userId) => {
      const inboxDocument = buildNotificationInboxDocument(
        eventId,
        eventData,
        userId,
      );
      if (!inboxDocument) {
        throw new Error(
          "Notification event cannot be copied to member inboxes",
        );
      }
      const inboxRef = plusUsersCollection(env)
        .doc(userId)
        .collection("notificationInbox")
        .doc(eventId);
      batch.set(inboxRef, inboxDocument, {merge: false});
    });
    await batch.commit();
  }
  return uniqueUserIds.length;
};

type DeviceMessagingTargets = {
  fids: string[];
  tokens: string[];
};

const resolveDeviceMessagingTargets = async (
  env: string,
  userIds: string[],
): Promise<DeviceMessagingTargets> => {
  const uniqueFids = new Set<string>();
  const uniqueTokens = new Set<string>();
  const collection = plusUsersCollection(env);

  for (const userId of userIds) {
    const devicesSnapshot = await collection
      .doc(userId)
      .collection("devices")
      .get();
    for (const deviceDoc of devicesSnapshot.docs) {
      const fid = parseString(deviceDoc.get("firebaseInstallationId"));
      const token = parseString(deviceDoc.get("fcmToken"));
      if (fid) {
        uniqueFids.add(fid);
      }
      if (token) {
        uniqueTokens.add(token);
      }
    }
  }

  return {
    fids: Array.from(uniqueFids),
    tokens: Array.from(uniqueTokens),
  };
};

type MessagingDispatchResult = {
  failureCount: number;
  responses: SendResponse[];
  successCount: number;
};

const sendEachForMessagingTargets = async (
  targets: DeviceMessagingTargets,
  notification: {title: string; body: string},
  data: Record<string, string>,
): Promise<MessagingDispatchResult> => {
  const result: MessagingDispatchResult = {
    failureCount: 0,
    responses: [],
    successCount: 0,
  };

  for (const tokenChunk of chunkArray(targets.tokens, 500)) {
    const response = await messaging.sendEachForMulticast({
      tokens: tokenChunk,
      notification,
      data,
    });
    result.successCount += response.successCount;
    result.failureCount += response.failureCount;
    result.responses.push(...response.responses);
  }
  for (const fidChunk of chunkArray(targets.fids, 500)) {
    const response = await messaging.sendEachForMulticast({
      fids: fidChunk,
      notification,
      data,
    });
    result.successCount += response.successCount;
    result.failureCount += response.failureCount;
    result.responses.push(...response.responses);
  }

  return result;
};

const hasDeviceMessagingTargets = (
  targets: DeviceMessagingTargets,
): boolean => targets.fids.length > 0 || targets.tokens.length > 0;

const ORDER_REMINDER_TYPE = "order_reminder";
const ORDER_REMINDER_USER_FIELDS = [
  "userId",
  "memberId",
  "uid",
  "user",
  "member",
  "userRef",
  "memberRef",
  "userID",
  "memberID",
] as const;
const ORDER_REMINDER_DISPATCH_MARKERS_COLLECTION =
  "orderReminderDispatchMarkers";
const ORDER_REMINDER_RETRY_RUNS_COLLECTION = "orderReminderRetryRuns";
const DEFAULT_ORDER_REMINDER_RETRY_MAX_ATTEMPTS = 3;
const DEFAULT_ORDER_REMINDER_RETRY_BASE_DELAY_MINUTES = 15;
const DEFAULT_ORDER_REMINDER_RETRY_BATCH_SIZE = 200;
const DEFAULT_ORDER_REMINDER_PROCESSING_LOCK_MINUTES = 30;
const ORDER_REMINDER_TRANSIENT_ERROR_CODES = new Set([
  "messaging/internal-error",
  "messaging/server-unavailable",
  "messaging/unknown-error",
  "messaging/quota-exceeded",
  "messaging/unavailable",
  "app/network-error",
]);

type CommitmentWeekParity = "even" | "odd";
type OrderReminderEventStatus = "created" | "skipped" | "dry_run" | "failed";
type OrderReminderDispatchMarkerStatus =
  | "processing"
  | "sent"
  | "retry_pending"
  | "failed"
  | "no_tokens";

type OrderReminderDispatchOutcome = {
  outcome: "sent" | "skipped" | "failed" | "retry_queued";
  reason: string;
  deliveredTokensCount: number;
  failedTokensCount: number;
  attemptNumber: number;
  markerId: string;
};

type OrderReminderRunTelemetry = {
  processedUsersCount: number;
  sentUsersCount: number;
  skippedUsersCount: number;
  failedUsersCount: number;
  retryQueuedUsersCount: number;
  deliveredTokensCount: number;
  failedTokensCount: number;
};

type PendingOrderReminderEnvSummary = {
  env: string;
  committedUsersCount: number;
  confirmedUsersCount: number;
  pendingUsersCount: number;
  eventStatus: OrderReminderEventStatus;
  errorMessage: string | null;
};

type PendingOrderReminderRunSummary = {
  reminderHour: number;
  weekKey: string;
  weekNumber: number;
  referenceNowIso: string;
  dryRun: boolean;
  envs: string[];
  failedEnvs: string[];
  envSummaries: PendingOrderReminderEnvSummary[];
};

type PendingOrderReminderRunOptions = {
  referenceNow?: Timestamp;
  weekKey?: string;
  envs?: string[];
  dryRun?: boolean;
  throwOnFailure?: boolean;
};

type OrderReminderEventContext = {
  weekKey: string;
  reminderHour: number;
};

type OrderReminderDispatchClaimResult =
  | {
    action: "dispatch";
    markerId: string;
    markerRef: DocumentReference;
    attemptNumber: number;
  }
  | {
    action: "skip";
    markerId: string;
    attemptNumber: number;
    reason: string;
  };

const parseOrderReminderRetryMaxAttempts = (): number => parsePositiveInteger(
  process.env.ORDER_REMINDER_RETRY_MAX_ATTEMPTS ??
    appConfig.orderReminderRetryMaxAttempts ??
    appConfig.order_reminder_retry_max_attempts,
  DEFAULT_ORDER_REMINDER_RETRY_MAX_ATTEMPTS
);

const parseOrderReminderRetryBaseDelayMinutes = (): number =>
  parsePositiveInteger(
    process.env.ORDER_REMINDER_RETRY_BASE_DELAY_MINUTES ??
      appConfig.orderReminderRetryBaseDelayMinutes ??
      appConfig.order_reminder_retry_base_delay_minutes,
    DEFAULT_ORDER_REMINDER_RETRY_BASE_DELAY_MINUTES
  );

const parseOrderReminderRetryBatchSize = (): number => parsePositiveInteger(
  process.env.ORDER_REMINDER_RETRY_BATCH_SIZE ??
    appConfig.orderReminderRetryBatchSize ??
    appConfig.order_reminder_retry_batch_size,
  DEFAULT_ORDER_REMINDER_RETRY_BATCH_SIZE
);

const parseOrderReminderProcessingLockMinutes = (): number =>
  parsePositiveInteger(
    process.env.ORDER_REMINDER_PROCESSING_LOCK_MINUTES ??
      appConfig.orderReminderProcessingLockMinutes ??
      appConfig.order_reminder_processing_lock_minutes,
    DEFAULT_ORDER_REMINDER_PROCESSING_LOCK_MINUTES
  );

const buildOrderReminderSlotLabel = (reminderHour: number): string =>
  String(reminderHour).padStart(2, "0");

const buildOrderReminderEventId = (
  weekKey: string,
  reminderHour: number,
): string =>
  `order_reminder_${weekKey}_${buildOrderReminderSlotLabel(reminderHour)}`;

const buildOrderReminderDispatchMarkerId = (
  weekKey: string,
  reminderHour: number,
  userId: string,
): string => `${buildOrderReminderEventId(weekKey, reminderHour)}_${userId}`;

const buildOrderReminderNotificationTitle = (): string =>
  "Recordatorio de pedido pendiente";

const buildOrderReminderNotificationBody = (weekKey: string): string =>
  `Todavia no has confirmado tu pedido de la semana ${weekKey}.`;

const orderReminderDispatchMarkersCollection = (env: string) =>
  firestore.collection(
    `${env}/plus-collections/${ORDER_REMINDER_DISPATCH_MARKERS_COLLECTION}`
  );

const orderReminderRetryRunsCollection = (env: string) =>
  firestore.collection(
    `${env}/plus-collections/${ORDER_REMINDER_RETRY_RUNS_COLLECTION}`
  );

const parseReminderHour = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 23) {
    return null;
  }
  return parsed;
};

const parseOrderReminderEventContext = (
  eventId: string,
  data: Record<string, unknown>,
): OrderReminderEventContext | null => {
  const targetPayload = parseBody(data.targetPayload);
  const weekKey =
    parseString(data.weekKey) || parseString(targetPayload.weekKey);
  const reminderHour = parseReminderHour(data.reminderSlotHour);
  if (weekKey && reminderHour !== null) {
    return {weekKey, reminderHour};
  }

  const eventIdMatch = eventId.match(/^order_reminder_(.+)_(\d{2})$/);
  if (!eventIdMatch) {
    return null;
  }

  const fallbackWeekKey = parseString(eventIdMatch[1]);
  const fallbackReminderHour = parseReminderHour(eventIdMatch[2]);
  if (!fallbackWeekKey || fallbackReminderHour === null) {
    return null;
  }

  return {
    weekKey: weekKey || fallbackWeekKey,
    reminderHour: reminderHour ?? fallbackReminderHour,
  };
};

const parseOrderReminderDispatchMarkerStatus = (
  value: unknown,
): OrderReminderDispatchMarkerStatus | null => {
  const parsed = parseString(value)?.toLowerCase();
  switch (parsed) {
  case "processing":
  case "sent":
  case "retry_pending":
  case "failed":
  case "no_tokens":
    return parsed;
  default:
    return null;
  }
};

const isTransientMessagingErrorCode = (code: string | null): boolean => {
  if (!code) {
    return false;
  }
  return ORDER_REMINDER_TRANSIENT_ERROR_CODES.has(code.toLowerCase());
};

const parseMessagingErrorCode = (error: unknown): string | null => {
  if (error === null || typeof error !== "object") {
    return null;
  }
  const code = (error as {code?: unknown}).code;
  if (typeof code !== "string" || code.trim().length === 0) {
    return null;
  }
  return code.trim().toLowerCase();
};

const parseMessagingErrorMessage = (error: unknown): string | null => {
  if (error === null || typeof error !== "object") {
    return null;
  }
  const message = (error as {message?: unknown}).message;
  return typeof message === "string" && message.trim().length > 0 ?
    message.trim() :
    null;
};

const summarizeMessagingFailureResponses = (
  responses: SendResponse[],
): {
  hasTransientFailure: boolean;
  failureCodes: string[];
  firstFailureMessage: string | null;
} => {
  const failureCodes = new Set<string>();
  let hasTransientFailure = false;
  let firstFailureMessage: string | null = null;

  for (const response of responses) {
    if (response.success || !response.error) {
      continue;
    }
    const code = parseMessagingErrorCode(response.error);
    if (code) {
      failureCodes.add(code);
      if (isTransientMessagingErrorCode(code)) {
        hasTransientFailure = true;
      }
    }

    if (!firstFailureMessage) {
      firstFailureMessage = parseMessagingErrorMessage(response.error);
    }
  }

  return {
    hasTransientFailure,
    failureCodes: Array.from(failureCodes),
    firstFailureMessage,
  };
};

const computeOrderReminderNextRetryAt = (
  attemptNumber: number,
  referenceNow: Timestamp = Timestamp.now(),
): Timestamp => {
  const baseDelayMinutes = parseOrderReminderRetryBaseDelayMinutes();
  const backoffMultiplier = 2 ** Math.max(0, attemptNumber - 1);
  const delayMs = baseDelayMinutes * backoffMultiplier * 60 * 1000;
  return Timestamp.fromMillis(
    referenceNow.toMillis() + delayMs
  );
};

const emptyOrderReminderRunTelemetry = (): OrderReminderRunTelemetry => ({
  processedUsersCount: 0,
  sentUsersCount: 0,
  skippedUsersCount: 0,
  failedUsersCount: 0,
  retryQueuedUsersCount: 0,
  deliveredTokensCount: 0,
  failedTokensCount: 0,
});

const applyOrderReminderDispatchOutcome = (
  telemetry: OrderReminderRunTelemetry,
  outcome: OrderReminderDispatchOutcome,
): void => {
  telemetry.processedUsersCount += 1;
  telemetry.deliveredTokensCount += outcome.deliveredTokensCount;
  telemetry.failedTokensCount += outcome.failedTokensCount;

  if (outcome.outcome === "sent") {
    telemetry.sentUsersCount += 1;
    return;
  }
  if (outcome.outcome === "retry_queued") {
    telemetry.retryQueuedUsersCount += 1;
    return;
  }
  if (outcome.outcome === "failed") {
    telemetry.failedUsersCount += 1;
    return;
  }
  telemetry.skippedUsersCount += 1;
};

const resolveOrderReminderRunStatus = (
  telemetry: OrderReminderRunTelemetry,
): "success" | "partial_success" | "failed" | "retry_pending" | "skipped" => {
  if (telemetry.failedUsersCount > 0) {
    const hasOtherOutcomes = telemetry.sentUsersCount > 0 ||
      telemetry.skippedUsersCount > 0 ||
      telemetry.retryQueuedUsersCount > 0;
    return hasOtherOutcomes ? "partial_success" : "failed";
  }

  if (telemetry.retryQueuedUsersCount > 0) {
    return telemetry.sentUsersCount > 0 || telemetry.skippedUsersCount > 0 ?
      "partial_success" :
      "retry_pending";
  }

  if (telemetry.sentUsersCount === 0 && telemetry.skippedUsersCount > 0) {
    return "skipped";
  }

  return "success";
};

const claimOrderReminderDispatchAttempt = async (
  env: string,
  userId: string,
  weekKey: string,
  reminderHour: number,
  eventId: string,
  referenceNow: Timestamp = Timestamp.now(),
): Promise<OrderReminderDispatchClaimResult> => {
  const markerId = buildOrderReminderDispatchMarkerId(
    weekKey,
    reminderHour,
    userId
  );
  const markerRef = orderReminderDispatchMarkersCollection(env).doc(markerId);
  const maxAttempts = parseOrderReminderRetryMaxAttempts();
  let claim: OrderReminderDispatchClaimResult = {
    action: "skip",
    markerId,
    attemptNumber: 0,
    reason: "claim_not_acquired",
  };

  await firestore.runTransaction(async (transaction) => {
    const markerSnapshot = await transaction.get(markerRef);

    if (markerSnapshot.exists) {
      const markerData = parseBody(markerSnapshot.data());
      const status = parseOrderReminderDispatchMarkerStatus(markerData.status);
      const attempts = parseNonNegativeInteger(markerData.attempts, 0);
      const nextRetryAt = markerData.nextRetryAt instanceof Timestamp ?
        markerData.nextRetryAt : null;
      const lastAttemptAt = markerData.lastAttemptAt instanceof Timestamp ?
        markerData.lastAttemptAt : null;

      if (status === "sent" || status === "failed" || status === "no_tokens") {
        claim = {
          action: "skip",
          markerId,
          attemptNumber: attempts,
          reason: `already_${status}`,
        };
        return;
      }

      if (status === "processing" && lastAttemptAt) {
        const lockDurationMs =
          parseOrderReminderProcessingLockMinutes() * 60 * 1000;
        const lockExpiresAt = lastAttemptAt.toMillis() + lockDurationMs;
        if (lockExpiresAt > referenceNow.toMillis()) {
          claim = {
            action: "skip",
            markerId,
            attemptNumber: attempts,
            reason: "already_processing",
          };
          return;
        }
      }

      if (attempts >= maxAttempts) {
        transaction.set(markerRef, {
          status: "failed",
          failureReason: "max_attempts_reached",
          updatedAt: FieldValue.serverTimestamp(),
        }, {merge: true});
        claim = {
          action: "skip",
          markerId,
          attemptNumber: attempts,
          reason: "max_attempts_reached",
        };
        return;
      }

      if (status === "retry_pending" &&
        nextRetryAt &&
        nextRetryAt.toMillis() > referenceNow.toMillis()) {
        claim = {
          action: "skip",
          markerId,
          attemptNumber: attempts,
          reason: "retry_not_due",
        };
        return;
      }

      const nextAttempt = attempts + 1;
      transaction.set(markerRef, {
        status: "processing",
        attempts: nextAttempt,
        maxAttempts,
        lastEventId: eventId,
        lastAttemptAt: FieldValue.serverTimestamp(),
        nextRetryAt: null,
        updatedAt: FieldValue.serverTimestamp(),
      }, {merge: true});
      claim = {
        action: "dispatch",
        markerId,
        markerRef,
        attemptNumber: nextAttempt,
      };
      return;
    }

    transaction.set(markerRef, {
      userId,
      weekKey,
      reminderSlotHour: reminderHour,
      status: "processing",
      attempts: 1,
      maxAttempts,
      lastEventId: eventId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastAttemptAt: FieldValue.serverTimestamp(),
      nextRetryAt: null,
    }, {merge: true});
    claim = {
      action: "dispatch",
      markerId,
      markerRef,
      attemptNumber: 1,
    };
  });

  return claim;
};

const finalizeOrderReminderDispatchMarker = async (
  markerRef: DocumentReference,
  patch: Record<string, unknown>,
): Promise<void> => {
  await markerRef.set({
    ...patch,
    updatedAt: FieldValue.serverTimestamp(),
  }, {merge: true});
};

const dispatchOrderReminderToUser = async (
  env: string,
  eventId: string,
  payload: NotificationDispatchPayload,
  context: OrderReminderEventContext,
  userId: string,
  triggerSource: "event" | "retry_scheduler",
  referenceNow: Timestamp = Timestamp.now(),
): Promise<OrderReminderDispatchOutcome> => {
  const dispatchClaim = await claimOrderReminderDispatchAttempt(
    env,
    userId,
    context.weekKey,
    context.reminderHour,
    eventId,
    referenceNow
  );

  if (dispatchClaim.action === "skip") {
    const exhaustedRetries = dispatchClaim.reason === "max_attempts_reached";
    return {
      outcome: exhaustedRetries ? "failed" : "skipped",
      reason: dispatchClaim.reason,
      deliveredTokensCount: 0,
      failedTokensCount: 0,
      attemptNumber: dispatchClaim.attemptNumber,
      markerId: dispatchClaim.markerId,
    };
  }

  const targets = await resolveDeviceMessagingTargets(env, [userId]);
  if (!hasDeviceMessagingTargets(targets)) {
    await finalizeOrderReminderDispatchMarker(dispatchClaim.markerRef, {
      status: "no_tokens",
      failureReason: "no_tokens",
      sentAt: null,
      nextRetryAt: null,
      deliveredTokensCount: 0,
      failedTokensCount: 0,
      lastErrorCode: null,
      lastErrorMessage: null,
      triggerSource,
    });
    return {
      outcome: "skipped",
      reason: "no_tokens",
      deliveredTokensCount: 0,
      failedTokensCount: 0,
      attemptNumber: dispatchClaim.attemptNumber,
      markerId: dispatchClaim.markerId,
    };
  }

  const dispatchResult = await sendEachForMessagingTargets(
    targets,
    {
      title: payload.title,
      body: payload.body,
    },
    {
      eventId,
      type: payload.type,
      target: payload.target,
      userId,
      weekKey: context.weekKey,
      reminderSlotHour: String(context.reminderHour),
      triggerSource,
    },
  );
  const deliveredTokensCount = dispatchResult.successCount;
  const failedTokensCount = dispatchResult.failureCount;
  const failureSummary = summarizeMessagingFailureResponses(
    dispatchResult.responses,
  );
  if (deliveredTokensCount > 0) {
    await finalizeOrderReminderDispatchMarker(dispatchClaim.markerRef, {
      status: "sent",
      sentAt: FieldValue.serverTimestamp(),
      nextRetryAt: null,
      deliveredTokensCount,
      failedTokensCount,
      lastErrorCode: failureSummary.failureCodes[0] || null,
      lastErrorMessage: failureSummary.firstFailureMessage,
      triggerSource,
    });
    return {
      outcome: "sent",
      reason: failedTokensCount > 0 ? "partial_token_failures" : "success",
      deliveredTokensCount,
      failedTokensCount,
      attemptNumber: dispatchClaim.attemptNumber,
      markerId: dispatchClaim.markerId,
    };
  }

  const maxAttempts = parseOrderReminderRetryMaxAttempts();
  if (failureSummary.hasTransientFailure &&
    dispatchClaim.attemptNumber < maxAttempts) {
    const nextRetryAt = computeOrderReminderNextRetryAt(
      dispatchClaim.attemptNumber,
      referenceNow
    );
    await finalizeOrderReminderDispatchMarker(dispatchClaim.markerRef, {
      status: "retry_pending",
      nextRetryAt,
      sentAt: null,
      deliveredTokensCount,
      failedTokensCount,
      lastErrorCode: failureSummary.failureCodes[0] || null,
      lastErrorMessage: failureSummary.firstFailureMessage,
      triggerSource,
    });
    return {
      outcome: "retry_queued",
      reason: "transient_failure",
      deliveredTokensCount,
      failedTokensCount,
      attemptNumber: dispatchClaim.attemptNumber,
      markerId: dispatchClaim.markerId,
    };
  }

  const failureReason = failureSummary.hasTransientFailure ?
    "transient_failure_max_attempts_reached" :
    "terminal_failure";
  await finalizeOrderReminderDispatchMarker(dispatchClaim.markerRef, {
    status: "failed",
    failureReason,
    nextRetryAt: null,
    sentAt: null,
    deliveredTokensCount,
    failedTokensCount,
    lastErrorCode: failureSummary.failureCodes[0] || null,
    lastErrorMessage: failureSummary.firstFailureMessage,
    triggerSource,
  });
  return {
    outcome: "failed",
    reason: failureReason,
    deliveredTokensCount,
    failedTokensCount,
    attemptNumber: dispatchClaim.attemptNumber,
    markerId: dispatchClaim.markerId,
  };
};

const normalizePathLikeIdentifier = (rawValue: string): string => {
  if (!rawValue.includes("/")) {
    return rawValue;
  }
  const trailing = rawValue.split("/").pop()?.trim() || "";
  return trailing.length > 0 ? trailing : rawValue;
};

const parseUserIdCandidate = (value: unknown): string | null => {
  if (typeof value === "string") {
    const parsed = parseString(value);
    return parsed ? normalizePathLikeIdentifier(parsed) : null;
  }

  if (value instanceof DocumentReference) {
    return parseString(value.id);
  }

  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    return parseUserIdCandidate(
      source.id ??
        source.documentId ??
        source.documentID ??
        source.path
    );
  }

  return null;
};

const parseSeasonalCommitmentUserId = (
  data: Record<string, unknown>,
): string | null => {
  for (const field of ORDER_REMINDER_USER_FIELDS) {
    const parsed = parseUserIdCandidate(data[field]);
    if (parsed) {
      return parsed;
    }
  }
  return null;
};

const parseIsoWeekNumberFromWeekKey = (
  weekKey: string,
): number | null => {
  const match = weekKey.match(/-W(\d{1,2})$/i);
  if (!match) {
    return null;
  }
  const parsedWeek = Number(match[1]);
  if (!Number.isInteger(parsedWeek) || parsedWeek < 1 || parsedWeek > 53) {
    return null;
  }
  return parsedWeek;
};

const weekParityFromIsoWeekNumber = (
  weekNumber: number,
): CommitmentWeekParity => weekNumber % 2 === 0 ? "even" : "odd";

const hasEcoCommitmentForWeek = (
  memberData: Record<string, unknown>,
  weekParity: CommitmentWeekParity,
): boolean => {
  const ecoCommitment = parseBody(memberData.ecoCommitment);
  const mode = parseString(ecoCommitment.mode)?.toLowerCase() || "weekly";
  if (mode !== "biweekly") {
    return true;
  }

  const parity = parseString(ecoCommitment.parity)?.toLowerCase();
  if (parity !== "even" && parity !== "odd") {
    return true;
  }
  return parity === weekParity;
};

const listMembersWithCommitments = async (
  env: string,
  weekParity: CommitmentWeekParity,
): Promise<string[]> => {
  const membersSnapshot = await plusUsersCollection(env)
    .where("isActive", "==", true)
    .get();

  const seasonalCommitmentUserIds = new Set<string>();
  const commitmentCollectionPaths = [
    `${env}/plus-collections/seasonalCommitments`,
  ];

  for (const collectionPath of commitmentCollectionPaths) {
    const commitmentSnapshot = await firestore.collection(collectionPath).get();
    commitmentSnapshot.docs.forEach((commitmentDoc) => {
      const data = parseBody(commitmentDoc.data());
      if (data.active === false) {
        return;
      }
      const userId = parseSeasonalCommitmentUserId(data);
      if (userId) {
        seasonalCommitmentUserIds.add(userId);
      }
    });
  }

  return membersSnapshot.docs
    .filter((memberDoc) => {
      const memberData = parseBody(memberDoc.data());
      const roles = parseRoles(memberData.roles);
      if (!roles.includes("member")) {
        return false;
      }
      return hasEcoCommitmentForWeek(memberData, weekParity) ||
        seasonalCommitmentUserIds.has(memberDoc.id);
    })
    .map((memberDoc) => memberDoc.id);
};

const isConfirmedOrderRecord = (
  data: Record<string, unknown>,
): boolean => {
  const consumerStatus = parseString(data.consumerStatus)?.toLowerCase();
  if (consumerStatus === "confirmado") {
    return true;
  }
  return data.confirmedAt instanceof Timestamp;
};

const parseOrderUserId = (
  docId: string,
  data: Record<string, unknown>,
  weekKey: string,
): string | null => {
  const fieldUserId = parseUserIdCandidate(data.userId);
  if (fieldUserId) {
    return fieldUserId;
  }

  const weekSuffix = `_${weekKey}`;
  if (docId.endsWith(weekSuffix) && docId.length > weekSuffix.length) {
    return docId.slice(0, -weekSuffix.length);
  }

  return null;
};

const listConfirmedOrderUserIds = async (
  env: string,
  weekKey: string,
  weekNumber: number,
): Promise<Set<string>> => {
  const confirmedUserIds = new Set<string>();
  const orderCollectionPaths = [
    `${env}/plus-collections/orders`,
  ];

  for (const collectionPath of orderCollectionPaths) {
    const collection = firestore.collection(collectionPath);
    const [byWeekKeySnapshot, byWeekNumberSnapshot] = await Promise.all([
      collection.where("weekKey", "==", weekKey).get(),
      collection.where("week", "==", weekNumber).get(),
    ]);

    const docsById = new Map<string, QueryDocumentSnapshot>();
    [...byWeekKeySnapshot.docs, ...byWeekNumberSnapshot.docs]
      .forEach((doc) => docsById.set(doc.id, doc));

    docsById.forEach((doc) => {
      const data = parseBody(doc.data());
      if (!isConfirmedOrderRecord(data)) {
        return;
      }
      const userId = parseOrderUserId(doc.id, data, weekKey);
      if (userId) {
        confirmedUserIds.add(userId);
      }
    });
  }

  return confirmedUserIds;
};

const isAlreadyExistsError = (error: unknown): boolean => {
  if (error === null || typeof error !== "object") {
    return false;
  }
  const maybeCode = (error as {code?: unknown}).code;
  return maybeCode === 6 ||
    maybeCode === "already-exists" ||
    maybeCode === "ALREADY_EXISTS";
};

const createOrderReminderEvent = async (
  env: string,
  weekKey: string,
  reminderHour: number,
  userIds: string[],
): Promise<"created" | "skipped"> => {
  const deduplicatedUserIds = Array.from(new Set(userIds));
  if (deduplicatedUserIds.length === 0) {
    return "skipped";
  }

  const eventId = buildOrderReminderEventId(weekKey, reminderHour);
  const eventRef = firestore
    .collection(`${env}/plus-collections/notificationEvents`)
    .doc(eventId);

  try {
    await eventRef.create({
      title: buildOrderReminderNotificationTitle(),
      body: buildOrderReminderNotificationBody(weekKey),
      type: ORDER_REMINDER_TYPE,
      target: "users",
      targetPayload: {
        userIds: deduplicatedUserIds,
        segmentType: "members_with_pending_order",
        weekKey,
      },
      weekKey,
      reminderSlotHour: reminderHour,
      createdBy: "system",
      sentAt: FieldValue.serverTimestamp(),
    });
    return "created";
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      return "skipped";
    }
    throw error;
  }
};

const runPendingOrderReminderForHour = async (
  reminderHour: number,
  options: PendingOrderReminderRunOptions = {},
): Promise<PendingOrderReminderRunSummary> => {
  const referenceNow = options.referenceNow || Timestamp.now();
  const weekKey = options.weekKey || timestampToIsoWeekKey(referenceNow);
  const weekNumber = parseIsoWeekNumberFromWeekKey(weekKey);
  if (!weekNumber) {
    throw new Error(`Invalid week key for reminder: ${weekKey}`);
  }

  const weekParity = weekParityFromIsoWeekNumber(weekNumber);
  const configuredEnvs = options.envs && options.envs.length > 0 ?
    options.envs :
    parseOrderReminderEnvs();
  const targetEnvs = Array.from(new Set(
    configuredEnvs
      .map((env) => env.trim().toLowerCase())
      .filter((env) => env.length > 0)
  ));
  if (targetEnvs.length === 0) {
    throw new Error("No environments configured for pending order reminders.");
  }

  const dryRun = options.dryRun === true;
  const shouldThrowOnFailure = options.throwOnFailure !== false;
  const failedEnvs: string[] = [];
  const envSummaries: PendingOrderReminderEnvSummary[] = [];

  for (const env of targetEnvs) {
    let committedUsersCount = 0;
    let confirmedUsersCount = 0;
    let pendingUsersCount = 0;

    try {
      const committedUserIds = await listMembersWithCommitments(
        env,
        weekParity
      );
      committedUsersCount = committedUserIds.length;
      const confirmedOrderUserIds = await listConfirmedOrderUserIds(
        env,
        weekKey,
        weekNumber
      );
      confirmedUsersCount = confirmedOrderUserIds.size;
      const pendingUserIds = committedUserIds
        .filter((userId) => !confirmedOrderUserIds.has(userId));
      pendingUsersCount = pendingUserIds.length;
      const result = dryRun ?
        "dry_run" as const :
        await createOrderReminderEvent(
          env,
          weekKey,
          reminderHour,
          pendingUserIds
        );
      envSummaries.push({
        env,
        committedUsersCount,
        confirmedUsersCount,
        pendingUsersCount,
        eventStatus: result,
        errorMessage: null,
      });

      logger.info("Pending order reminder run completed", {
        env,
        weekKey,
        reminderHour,
        committedUsersCount,
        confirmedUsersCount,
        pendingUsersCount,
        dryRun,
        eventStatus: result,
      });
    } catch (error) {
      failedEnvs.push(env);
      const errorMessage = error instanceof Error ?
        error.message :
        "Unknown error";
      envSummaries.push({
        env,
        committedUsersCount,
        confirmedUsersCount,
        pendingUsersCount,
        eventStatus: "failed",
        errorMessage,
      });
      logger.error("Pending order reminder run failed", {
        env,
        weekKey,
        reminderHour,
        dryRun,
        error,
      });
    }
  }

  if (shouldThrowOnFailure && failedEnvs.length > 0) {
    throw new Error(
      `Pending order reminder failed for envs: ${failedEnvs.join(", ")}`
    );
  }

  return {
    reminderHour,
    weekKey,
    weekNumber,
    referenceNowIso: referenceNow.toDate().toISOString(),
    dryRun,
    envs: targetEnvs,
    failedEnvs,
    envSummaries,
  };
};

const dispatchNotificationEventGeneric = async (
  env: string,
  eventId: string,
  payload: NotificationDispatchPayload,
  eventRef: DocumentReference,
  targetUserIds: string[],
): Promise<void> => {
  const targets = await resolveDeviceMessagingTargets(env, targetUserIds);

  if (!hasDeviceMessagingTargets(targets)) {
    await eventRef.set({
      dispatch: {
        attemptedAt: FieldValue.serverTimestamp(),
        dispatchedAt: null,
        resolvedUsersCount: targetUserIds.length,
        deliveredTokensCount: 0,
        failedTokensCount: 0,
        status: "no_tokens",
      },
    }, {merge: true});
    logger.warn(
      "Notification dispatch skipped because no device targets were found",
      {
        env,
        eventId,
        target: payload.target,
        resolvedUsersCount: targetUserIds.length,
      }
    );
    return;
  }

  const dispatchResult = await sendEachForMessagingTargets(
    targets,
    {
      title: payload.title,
      body: payload.body,
    },
    {
      eventId,
      type: payload.type,
      target: payload.target,
    },
  );
  const deliveredTokensCount = dispatchResult.successCount;
  const failedTokensCount = dispatchResult.failureCount;

  await eventRef.set({
    dispatch: {
      attemptedAt: FieldValue.serverTimestamp(),
      dispatchedAt: FieldValue.serverTimestamp(),
      resolvedUsersCount: targetUserIds.length,
      deliveredTokensCount,
      failedTokensCount,
      status: failedTokensCount > 0 ? "partial_success" : "success",
    },
  }, {merge: true});

  logger.info("Notification event dispatched", {
    env,
    eventId,
    target: payload.target,
    resolvedUsersCount: targetUserIds.length,
    deliveredTokensCount,
    failedTokensCount,
  });
};

const dispatchOrderReminderEvent = async (
  env: string,
  eventId: string,
  eventData: Record<string, unknown>,
  payload: NotificationDispatchPayload,
  eventRef: DocumentReference,
  targetUserIds: string[],
): Promise<boolean> => {
  const reminderContext = parseOrderReminderEventContext(eventId, eventData);
  if (!reminderContext) {
    logger.warn("Order reminder event context is missing. Falling back.", {
      env,
      eventId,
    });
    return false;
  }

  const telemetry = emptyOrderReminderRunTelemetry();
  for (const userId of targetUserIds) {
    try {
      const outcome = await dispatchOrderReminderToUser(
        env,
        eventId,
        payload,
        reminderContext,
        userId,
        "event"
      );
      applyOrderReminderDispatchOutcome(telemetry, outcome);
    } catch (error) {
      telemetry.processedUsersCount += 1;
      telemetry.failedUsersCount += 1;
      logger.error("Order reminder user dispatch failed", {
        env,
        eventId,
        userId,
        weekKey: reminderContext.weekKey,
        reminderSlotHour: reminderContext.reminderHour,
        error,
      });
    }
  }

  const dispatchStatus = resolveOrderReminderRunStatus(telemetry);
  await eventRef.set({
    dispatch: {
      attemptedAt: FieldValue.serverTimestamp(),
      dispatchedAt: FieldValue.serverTimestamp(),
      resolvedUsersCount: targetUserIds.length,
      processedUsersCount: telemetry.processedUsersCount,
      sentUsersCount: telemetry.sentUsersCount,
      skippedUsersCount: telemetry.skippedUsersCount,
      failedUsersCount: telemetry.failedUsersCount,
      retryQueuedUsersCount: telemetry.retryQueuedUsersCount,
      deliveredTokensCount: telemetry.deliveredTokensCount,
      failedTokensCount: telemetry.failedTokensCount,
      status: dispatchStatus,
      retryMaxAttempts: parseOrderReminderRetryMaxAttempts(),
      retryBaseDelayMinutes: parseOrderReminderRetryBaseDelayMinutes(),
      idempotencyScope: "weekKey+reminderSlotHour+userId",
    },
  }, {merge: true});

  logger.info("Order reminder event dispatched", {
    env,
    eventId,
    weekKey: reminderContext.weekKey,
    reminderSlotHour: reminderContext.reminderHour,
    ...telemetry,
    status: dispatchStatus,
  });
  return true;
};

type OrderReminderRetryRunEnvSummary = {
  env: string;
  candidateMarkersCount: number;
  telemetry: OrderReminderRunTelemetry;
  status:
    | "success"
    | "partial_success"
    | "failed"
    | "retry_pending"
    | "skipped";
  errorsCount: number;
};

const runOrderReminderRetryCycle = async (): Promise<{
  runId: string;
  referenceNowIso: string;
  envSummaries: OrderReminderRetryRunEnvSummary[];
}> => {
  const referenceNow = Timestamp.now();
  const runId = `order_reminder_retry_${referenceNow.toMillis()}`;
  const envs = Array.from(new Set(
    parseOrderReminderEnvs()
      .map((env) => env.trim().toLowerCase())
      .filter((env) => env.length > 0)
  ));
  const envSummaries: OrderReminderRetryRunEnvSummary[] = [];

  for (const env of envs) {
    const markerSnapshot = await orderReminderDispatchMarkersCollection(env)
      .where("status", "==", "retry_pending")
      .limit(parseOrderReminderRetryBatchSize())
      .get();
    const telemetry = emptyOrderReminderRunTelemetry();
    let errorsCount = 0;

    for (const markerDoc of markerSnapshot.docs) {
      const markerData = parseBody(markerDoc.data());
      const userId = parseString(markerData.userId);
      const weekKey = parseString(markerData.weekKey);
      const reminderHour = parseReminderHour(markerData.reminderSlotHour);
      const nextRetryAt = markerData.nextRetryAt instanceof
        Timestamp ? markerData.nextRetryAt : null;

      if (!userId || !weekKey || reminderHour === null) {
        errorsCount += 1;
        logger.error("Invalid order reminder retry marker payload", {
          env,
          markerId: markerDoc.id,
          markerData,
        });
        continue;
      }

      if (nextRetryAt && nextRetryAt.toMillis() > referenceNow.toMillis()) {
        continue;
      }

      const payload: NotificationDispatchPayload = {
        title: buildOrderReminderNotificationTitle(),
        body: buildOrderReminderNotificationBody(weekKey),
        type: ORDER_REMINDER_TYPE,
        target: "users",
        userIds: [userId],
        segmentType: "members_with_pending_order",
        targetRole: null,
      };
      const context: OrderReminderEventContext = {
        weekKey,
        reminderHour,
      };
      const eventId = buildOrderReminderEventId(weekKey, reminderHour);

      try {
        const outcome = await dispatchOrderReminderToUser(
          env,
          eventId,
          payload,
          context,
          userId,
          "retry_scheduler",
          referenceNow
        );
        applyOrderReminderDispatchOutcome(telemetry, outcome);
      } catch (error) {
        telemetry.processedUsersCount += 1;
        telemetry.failedUsersCount += 1;
        errorsCount += 1;
        logger.error("Order reminder retry dispatch failed", {
          env,
          markerId: markerDoc.id,
          userId,
          weekKey,
          reminderHour,
          error,
        });
      }
    }

    const status = resolveOrderReminderRunStatus(telemetry);
    const envSummary: OrderReminderRetryRunEnvSummary = {
      env,
      candidateMarkersCount: markerSnapshot.size,
      telemetry,
      status,
      errorsCount,
    };
    envSummaries.push(envSummary);
    await orderReminderRetryRunsCollection(env).doc(runId).set({
      runId,
      trigger: "order_reminder_retry_scheduler",
      referenceNow: referenceNow,
      candidateMarkersCount: markerSnapshot.size,
      status,
      errorsCount,
      ...telemetry,
      retryBatchSize: parseOrderReminderRetryBatchSize(),
      retryMaxAttempts: parseOrderReminderRetryMaxAttempts(),
      retryBaseDelayMinutes: parseOrderReminderRetryBaseDelayMinutes(),
      createdAt: FieldValue.serverTimestamp(),
    });

    logger.info("Order reminder retry run completed", {
      runId,
      ...envSummary,
    });
  }

  return {
    runId,
    referenceNowIso: referenceNow.toDate().toISOString(),
    envSummaries,
  };
};

export const __testOnly = {
  buildOrderReminderEventId,
  buildOrderReminderDispatchMarkerId,
  parseOrderReminderEventContext,
  computeOrderReminderNextRetryAt,
  resolveOrderReminderRunStatus,
};

type ShiftType = "delivery" | "market";
type ShiftStatus = "planned" | "swap_pending" | "confirmed";

type SheetShiftConfig = {
  spreadsheetId: string;
  deliveryRange: string;
  marketRange: string;
};

type SheetRangeDefinition = {
  range: string;
  defaultType: ShiftType;
  layout: "delivery_human" | "market_human";
};

type MemberSheetRef = {
  id: string;
  displayName: string;
  normalizedEmail: string;
  phone: string | null;
};

type MarketParticipantRow = {
  listedName: string;
  phone: string | null;
  replacementName: string | null;
};

type NormalizedShiftSheetRow = {
  shiftId: string;
  type: ShiftType;
  date: Timestamp;
  assignedUserIds: string[];
  helperUserId: string | null;
  status: ShiftStatus;
  source: "google_sheets";
  rowNumber: number;
  rowKey: string;
  sheetName: string;
};

type FirestoreShiftRecord = {
  id: string;
  type: ShiftType;
  date: Timestamp;
  assignedUserIds: string[];
  helperUserId: string | null;
  status: ShiftStatus;
  source: string;
  syncSheetName: string | null;
};

type ShiftPlanningRequestType = "delivery" | "market";

type ShiftPlanningRequestStatus =
  "requested" |
  "processing" |
  "completed" |
  "failed";

type ShiftPlanningRequestRecord = {
  id: string;
  type: ShiftPlanningRequestType;
  requestedByUserId: string;
  requestedAt: Timestamp;
  status: ShiftPlanningRequestStatus;
};

type PlanningMemberRef = MemberSheetRef & {
  isActive: boolean;
  roles: string[];
  isCommonPurchaseManager: boolean;
  createdAtMillis: number;
  updatedAtMillis: number;
};

const SHIFT_NOTIFICATION_TYPE = "shift_updated";

const getConfigValue = (
  source: Record<string, unknown>,
  key: string,
): string | null => parseString(source[key]);

const getEnvScopedConfigValue = (
  source: Record<string, unknown>,
  key: string,
  env: string,
): string | null =>
  getConfigValue(source, `${key}_${env.toLowerCase()}`) ||
  getConfigValue(source, key);

const getSheetConfig = (env: string): SheetShiftConfig | null => {
  const sheetsConfig = {
    ...getRuntimeConfigNamespace("sheets"),
    spreadsheet_id: process.env.SHEETS_SPREADSHEET_ID,
    spreadsheet_id_develop: process.env.SHEETS_SPREADSHEET_ID_DEVELOP,
    spreadsheet_id_production: process.env.SHEETS_SPREADSHEET_ID_PRODUCTION,
    delivery_range: process.env.SHEETS_DELIVERY_RANGE,
    delivery_range_develop: process.env.SHEETS_DELIVERY_RANGE_DEVELOP,
    delivery_range_production: process.env.SHEETS_DELIVERY_RANGE_PRODUCTION,
    market_range: process.env.SHEETS_MARKET_RANGE,
    market_range_develop: process.env.SHEETS_MARKET_RANGE_DEVELOP,
    market_range_production: process.env.SHEETS_MARKET_RANGE_PRODUCTION,
  };
  const spreadsheetId = getEnvScopedConfigValue(
    sheetsConfig,
    "spreadsheet_id",
    env,
  );
  const deliveryRange = getEnvScopedConfigValue(
    sheetsConfig,
    "delivery_range",
    env,
  ) || "Delivery!A:Z";
  const marketRange = getEnvScopedConfigValue(
    sheetsConfig,
    "market_range",
    env,
  ) || "Market!A:Z";

  if (!spreadsheetId) {
    return null;
  }

  return {
    spreadsheetId,
    deliveryRange,
    marketRange,
  };
};

const sheetRangeDefinitions = (
  configValue: SheetShiftConfig,
): SheetRangeDefinition[] => [
  {
    range: configValue.deliveryRange,
    defaultType: "delivery",
    layout: "delivery_human",
  },
  {
    range: configValue.marketRange,
    defaultType: "market",
    layout: "market_human",
  },
];

const getSheetsClient = async () => {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({
    version: "v4",
    auth,
  });
};

const shiftsCollection = (env: string) =>
  firestore.collection(`${env}/plus-collections/shifts`);

const normalizeLookupKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizePhoneKey = (value: string): string =>
  value.replace(/\D+/g, "").trim();

const phoneLookupKeys = (value: string): string[] => {
  const normalized = normalizePhoneKey(value);
  if (!normalized) {
    return [];
  }

  return Array.from(new Set([
    normalized,
    normalized.length > 9 ? normalized.slice(-9) : normalized,
  ]));
};

const MONTH_INDEX_BY_NAME: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

const isShiftType = (value: string): value is ShiftType =>
  value === "delivery" || value === "market";

const isShiftStatus = (value: string): value is ShiftStatus =>
  value === "planned" || value === "swap_pending" || value === "confirmed";

const SHEET_TIME_ZONE = "Europe/Madrid";

const timestampToZonedDateParts = (
  timestamp: Timestamp,
  timeZone: string = SHEET_TIME_ZONE,
): {year: number; month: number; day: number} => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(timestamp.toDate());
  const getPart = (type: "year" | "month" | "day") =>
    Number(parts.find((part) => part.type === type)?.value || "0");
  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
  };
};

const timestampToSheetDate = (timestamp: Timestamp): string => {
  const {year, month, day} = timestampToZonedDateParts(timestamp);
  const paddedMonth = String(month).padStart(2, "0");
  const paddedDay = String(day).padStart(2, "0");
  return `${year}-${paddedMonth}-${paddedDay}`;
};

const buildShiftId = (
  type: ShiftType,
  timestamp: Timestamp,
): string =>
  `shift_${type}_${timestampToSheetDate(timestamp).replace(/-/g, "")}`;

const buildShiftRowKey = (
  type: ShiftType,
  timestamp: Timestamp,
): string => `${type}:${timestampToSheetDate(timestamp)}`;

const parseDateInput = (value: unknown): Timestamp | null => {
  const text = parseString(value);
  if (!text) {
    return null;
  }

  const dayMonthYear = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dayMonthYear) {
    const [, day, month, year] = dayMonthYear;
    const millis = Date.UTC(Number(year), Number(month) - 1, Number(day));
    return Timestamp.fromMillis(millis);
  }

  const normalizedText = text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  const normalizedHumanDate = normalizedText.replace(/\s+de\s+/g, " ");
  const dayMonthNameYear = normalizedText.match(
    /^(\d{1,2})\s+([a-záéíóúñ]+)\s+(\d{4})$/i
  );
  const humanDateMatch = dayMonthNameYear || normalizedHumanDate.match(
    /^(\d{1,2})\s+([a-záéíóúñ]+)\s+(\d{4})$/i
  );
  if (humanDateMatch) {
    const [, day, monthName, year] = humanDateMatch;
    const monthIndex = MONTH_INDEX_BY_NAME[monthName];
    if (monthIndex !== undefined) {
      const millis = Date.UTC(Number(year), monthIndex, Number(day));
      return Timestamp.fromMillis(millis);
    }
  }

  return null;
};

const parseSheetName = (range: string): string =>
  range.includes("!") ? range.split("!")[0] : "Sheet1";

const buildMemberLookup = async (
  env: string,
): Promise<Map<string, MemberSheetRef>> => {
  const snapshot = await plusUsersCollection(env).get();
  const lookup = new Map<string, MemberSheetRef>();
  const aliasCandidates = new Map<string, MemberSheetRef[]>();

  const registerAliasCandidate = (
    alias: string,
    memberRef: MemberSheetRef,
  ) => {
    if (!alias) {
      return;
    }
    const current = aliasCandidates.get(alias) || [];
    current.push(memberRef);
    aliasCandidates.set(alias, current);
  };

  snapshot.docs.forEach((doc) => {
    const normalizedEmail =
      parseString(doc.get("normalizedEmail")) ||
      parseString(doc.get("emailNormalized")) ||
      "";
    const displayName = parseString(doc.get("displayName")) || doc.id;
    const memberRef: MemberSheetRef = {
      id: doc.id,
      displayName,
      normalizedEmail,
      phone: parseString(doc.get("phone")),
    };

    [
      doc.id,
      displayName,
      normalizedEmail,
    ].forEach((key) => {
      if (!key) {
        return;
      }
      lookup.set(normalizeLookupKey(key), memberRef);
    });

    if (memberRef.phone) {
      phoneLookupKeys(memberRef.phone).forEach((phoneKey) => {
        lookup.set(phoneKey, memberRef);
      });
    }

    const displayNameTokens = normalizeLookupKey(displayName)
      .split(" ")
      .filter((token) => token.length > 0);
    if (displayNameTokens.length > 0) {
      registerAliasCandidate(displayNameTokens[0], memberRef);
    }
    if (displayNameTokens.length >= 2) {
      registerAliasCandidate(
        `${displayNameTokens[0]} ${displayNameTokens[1]}`,
        memberRef,
      );
    }
  });

  aliasCandidates.forEach((candidates, alias) => {
    const uniqueCandidates = Array.from(new Map(
      candidates.map((candidate) => [candidate.id, candidate]),
    ).values());
    if (uniqueCandidates.length === 1 && !lookup.has(alias)) {
      lookup.set(alias, uniqueCandidates[0]);
    }
  });

  return lookup;
};

const resolveMemberId = (
  lookup: Map<string, MemberSheetRef>,
  value: string,
): string | null => lookup.get(normalizeLookupKey(value))?.id || null;

const resolveMemberIdByPhone = (
  lookup: Map<string, MemberSheetRef>,
  value: string,
): string | null => {
  const phoneKeys = phoneLookupKeys(value);
  for (const phoneKey of phoneKeys) {
    const resolved = lookup.get(phoneKey)?.id || null;
    if (resolved) {
      return resolved;
    }
  }
  return null;
};

const resolveMemberIdFromCandidate = (
  lookup: Map<string, MemberSheetRef>,
  name: string | null,
  phone: string | null = null,
): string | null => {
  if (name) {
    const byName = resolveMemberId(lookup, name);
    if (byName) {
      return byName;
    }
  }
  if (phone) {
    return resolveMemberIdByPhone(lookup, phone);
  }
  return null;
};

const parseReplacementName = (value: unknown): string | null => {
  const text = parseString(value);
  if (!text) {
    return null;
  }

  const match = text.match(/lo hace\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

const toDeliveryShiftSheetRow = (
  row: string[],
  rowNumber: number,
  definition: SheetRangeDefinition,
  lookup: Map<string, MemberSheetRef>,
): NormalizedShiftSheetRow | null => {
  const date = parseDateInput(row[0]);
  if (!date) {
    return null;
  }

  const listedName = parseString(row[1]);
  if (!listedName) {
    return null;
  }
  const listedPhone = parseString(row[2]);
  const replacementName = parseReplacementName(row[4]);
  const assignedUserId = replacementName ?
    resolveMemberIdFromCandidate(lookup, replacementName) ||
      resolveMemberIdFromCandidate(lookup, listedName, listedPhone) :
    resolveMemberIdFromCandidate(lookup, listedName, listedPhone);
  if (!assignedUserId) {
    logger.warn(
      "Skipping delivery shift row because member could not be resolved",
      {
        rowNumber,
        listedName,
        listedPhone,
        replacementName,
        sheetName: parseSheetName(definition.range),
      }
    );
    return null;
  }

  return {
    shiftId: buildShiftId(definition.defaultType, date),
    type: definition.defaultType,
    date,
    assignedUserIds: [assignedUserId],
    helperUserId: null,
    status: "planned",
    source: "google_sheets",
    rowNumber,
    rowKey: buildShiftRowKey(definition.defaultType, date),
    sheetName: parseSheetName(definition.range),
  };
};

const buildMarketShiftSheetRow = (
  date: Timestamp,
  participants: MarketParticipantRow[],
  rowNumber: number,
  definition: SheetRangeDefinition,
  lookup: Map<string, MemberSheetRef>,
): NormalizedShiftSheetRow | null => {
  const assignedUserIds = Array.from(new Set(
    participants
      .map((participant) =>
        participant.replacementName ?
          resolveMemberIdFromCandidate(lookup, participant.replacementName) ||
            resolveMemberIdFromCandidate(
              lookup,
              participant.listedName,
              participant.phone,
            ) :
          resolveMemberIdFromCandidate(
            lookup,
            participant.listedName,
            participant.phone,
          )
      )
      .filter((value): value is string => Boolean(value))
  ));
  if (assignedUserIds.length === 0) {
    logger.warn(
      "Skipping market shift block because no participants were resolved",
      {
        rowNumber,
        participants,
        sheetName: parseSheetName(definition.range),
      }
    );
    return null;
  }

  return {
    shiftId: buildShiftId(definition.defaultType, date),
    type: definition.defaultType,
    date,
    assignedUserIds,
    helperUserId: null,
    status: "planned",
    source: "google_sheets",
    rowNumber,
    rowKey: buildShiftRowKey(definition.defaultType, date),
    sheetName: parseSheetName(definition.range),
  };
};

const fetchSheetRows = async (
  sheets: Awaited<ReturnType<typeof getSheetsClient>>,
  spreadsheetId: string,
  definition: SheetRangeDefinition,
  lookup: Map<string, MemberSheetRef>,
): Promise<NormalizedShiftSheetRow[]> => {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: definition.range,
  });
  const rows = (response.data.values || []).map((row) =>
    row.map((cell) => `${cell}`)
  );
  if (rows.length === 0) {
    return [];
  }

  if (definition.layout === "delivery_human") {
    return rows
      .map((row, index) =>
        toDeliveryShiftSheetRow(
          row,
          index + 1,
          definition,
          lookup,
        )
      )
      .filter((row): row is NormalizedShiftSheetRow => Boolean(row));
  }

  const marketRows: NormalizedShiftSheetRow[] = [];
  let currentDate: Timestamp | null = null;
  let currentDateRowNumber = 0;
  let participants: MarketParticipantRow[] = [];

  const flushCurrentBlock = () => {
    if (!currentDate) {
      return;
    }
    const shiftRow = buildMarketShiftSheetRow(
      currentDate,
      participants,
      currentDateRowNumber,
      definition,
      lookup,
    );
    if (shiftRow) {
      marketRows.push(shiftRow);
    }
    currentDate = null;
    currentDateRowNumber = 0;
    participants = [];
  };

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const firstCell = parseString(row[0]);
    const secondCell = parseString(row[1]);
    const maybeDate = parseDateInput(firstCell);

    if (maybeDate && !secondCell) {
      flushCurrentBlock();
      currentDate = maybeDate;
      currentDateRowNumber = rowNumber;
      return;
    }

    if (!currentDate) {
      return;
    }

    if (!firstCell) {
      flushCurrentBlock();
      return;
    }

    const replacementName = parseReplacementName(row[2]);
    participants.push({
      listedName: firstCell,
      phone: secondCell,
      replacementName,
    });
  });

  flushCurrentBlock();
  return marketRows;
};

const withDerivedDeliveryHelpers = (
  rows: NormalizedShiftSheetRow[],
): NormalizedShiftSheetRow[] => {
  const deliveryRows = rows
    .filter((row) => row.type === "delivery")
    .sort((left, right) => left.date.toMillis() - right.date.toMillis());
  const helperByRowKey = new Map<string, string | null>();

  deliveryRows.forEach((row, index) => {
    const nextShift = deliveryRows[index + 1];
    helperByRowKey.set(
      row.rowKey,
      nextShift?.assignedUserIds?.[0] || null,
    );
  });

  return rows.map((row) =>
    row.type === "delivery" ? {
      ...row,
      helperUserId: helperByRowKey.get(row.rowKey) || null,
    } : row
  );
};

const syncShiftRowsIntoFirestore = async (
  env: AppEnvironment,
  rows: NormalizedShiftSheetRow[],
): Promise<number> => {
  const root = `${env}/plus-collections`;
  const collection = firestore.collection(`${root}/shifts`);
  const importedAt = FieldValue.serverTimestamp();
  const importedIds = new Set(rows.map((row) => row.shiftId));
  let writes = 0;

  for (const row of rows) {
    const result = await runShiftPlanningNotificationGuardedShiftWrite({
      firestore,
      root,
      shiftId: row.shiftId,
      clock: () => Timestamp.now(),
      mutate: ({transaction, reference, snapshot}) => {
        const existingCreatedAt = snapshot.get("createdAt");
        transaction.set(reference, {
          type: row.type,
          date: row.date,
          assignedUserIds: row.assignedUserIds,
          helperUserId: row.helperUserId,
          status: row.status,
          source: row.source,
          createdAt: existingCreatedAt instanceof Timestamp ?
            existingCreatedAt :
            FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          syncMeta: {
            origin: "google_sheets",
            rowKey: row.rowKey,
            rowNumber: row.rowNumber,
            sheetName: row.sheetName,
            importedAt,
          },
        }, {merge: true});
      },
    });
    requireShiftPlanningNotificationGuardedWrite(result);
    writes += 1;
  }

  const staleSnapshot = await collection
    .where("source", "==", "google_sheets")
    .get();
  const staleDocs = staleSnapshot.docs.filter(
    (doc) => !importedIds.has(doc.id),
  );
  for (const staleDoc of staleDocs) {
    const result = await runShiftPlanningNotificationGuardedShiftWrite({
      firestore,
      root,
      shiftId: staleDoc.id,
      clock: () => Timestamp.now(),
      mutate: ({transaction, reference, snapshot}) => {
        if (
          !snapshot.exists ||
          snapshot.get("source") !== "google_sheets" ||
          importedIds.has(snapshot.id)
        ) {
          return false;
        }
        transaction.delete(reference);
        return true;
      },
    });
    requireShiftPlanningNotificationGuardedWrite(result);
  }

  return writes;
};

const toShiftRecord = (
  snapshot: DocumentSnapshot,
): FirestoreShiftRecord | null => {
  if (!snapshot.exists) {
    return null;
  }

  const type = parseString(snapshot.get("type"))?.toLowerCase();
  const status = parseString(snapshot.get("status"))?.toLowerCase();
  const date = snapshot.get("date");
  const assignedUserIds = snapshot.get("assignedUserIds");

  if (
    !type ||
    !isShiftType(type) ||
    !status ||
    !isShiftStatus(status) ||
    !(date instanceof Timestamp) ||
    !Array.isArray(assignedUserIds)
  ) {
    return null;
  }

  return {
    id: snapshot.id,
    type,
    date,
    assignedUserIds: assignedUserIds
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
    helperUserId: parseString(snapshot.get("helperUserId")),
    status,
    source: parseString(snapshot.get("source")) || "app",
    syncSheetName: parseString(snapshot.get("syncMeta.sheetName")),
  };
};

const formatHumanShortDate = (
  timestamp: Timestamp,
): string => {
  const {year, month, day} = timestampToZonedDateParts(timestamp);
  return `${day}/${month}/${year}`;
};

const formatHumanLongDate = (
  timestamp: Timestamp,
): string => {
  const formatter = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: SHEET_TIME_ZONE,
  });
  return formatter.format(timestamp.toDate()).toUpperCase();
};

const formatHumanMonthHeading = (
  timestamp: Timestamp,
): string => {
  const formatter = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
    timeZone: SHEET_TIME_ZONE,
  });
  return formatter.format(timestamp.toDate()).toUpperCase();
};

const isoWeekNumber = (
  timestamp: Timestamp,
): number => {
  const {year, month, day: localDay} = timestampToZonedDateParts(timestamp);
  const utcDate = new Date(Date.UTC(
    year,
    month - 1,
    localDay,
  ));
  const isoDay = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - isoDay);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  return Math.ceil(
    (((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7
  );
};

const timestampToIsoWeekKey = (
  timestamp: Timestamp,
): string => {
  const {
    year: localYear,
    month,
    day: localDay,
  } = timestampToZonedDateParts(timestamp);
  const utcDate = new Date(Date.UTC(
    localYear,
    month - 1,
    localDay,
  ));
  const isoDay = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - isoDay);
  const year = utcDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(
    (((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7
  );
  return `${year}-W${String(week).padStart(2, "0")}`;
};

const resolveEffectiveDeliveryDate = (
  shift: FirestoreShiftRecord,
  overrides: DeliveryCalendarOverrideMap,
): Timestamp => {
  if (shift.type !== "delivery") {
    return shift.date;
  }
  return overrides.get(timestampToIsoWeekKey(shift.date)) || shift.date;
};

const readDeliveryCalendarOverrideMap = async (
  env: string,
): Promise<DeliveryCalendarOverrideMap> => {
  const snapshot = await deliveryCalendarCollection(env).get();
  const overrides = new Map<string, Timestamp>();
  snapshot.docs.forEach((doc) => {
    const deliveryDate = doc.get("deliveryDate");
    if (deliveryDate instanceof Timestamp) {
      overrides.set(doc.id, deliveryDate);
    }
  });
  return overrides;
};

const toDeliveryHumanRow = (
  shift: FirestoreShiftRecord,
  membersById: Map<string, MemberSheetRef>,
  effectiveDate: Timestamp,
  existingRow: string[] = [],
): string[] => {
  const responsible = shift.assignedUserIds
    .map((userId) => membersById.get(userId))
    .find((value): value is MemberSheetRef => Boolean(value));

  return [
    formatHumanShortDate(effectiveDate),
    responsible?.displayName || existingRow[1] || "",
    responsible?.phone || existingRow[2] || "",
    existingRow[3] || "",
    existingRow[4] || "",
    `${isoWeekNumber(effectiveDate)}`,
  ];
};

const toMarketHumanLeadRow = (
  shift: FirestoreShiftRecord,
  membersById: Map<string, MemberSheetRef>,
  existingRow: string[] = [],
): string[] => {
  const leadMember = shift.assignedUserIds[0] ?
    membersById.get(shift.assignedUserIds[0]) :
    null;

  return [
    leadMember?.displayName || existingRow[0] || "",
    existingRow[1] || "",
    existingRow[2] || "",
  ];
};

const toMarketHumanSupportRows = (
  shift: FirestoreShiftRecord,
  membersById: Map<string, MemberSheetRef>,
  existingRows: string[][] = [],
): string[][] =>
  Array.from({length: 4}).map((_, index) => {
    const member = shift.assignedUserIds[index + 1] ?
      membersById.get(shift.assignedUserIds[index + 1]) :
      null;
    const existingRow = existingRows[index] || [];
    return [
      member?.displayName || existingRow[0] || "",
      member?.phone || existingRow[1] || "",
      existingRow[2] || "",
    ];
  });

const upsertShiftRowInSheet = async (
  sheets: Awaited<ReturnType<typeof getSheetsClient>>,
  spreadsheetId: string,
  range: string,
  shift: FirestoreShiftRecord,
  membersById: Map<string, MemberSheetRef>,
  deliveryOverrides: DeliveryCalendarOverrideMap,
): Promise<"updated" | "appended"> => {
  const valuesResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  const rows = valuesResponse.data.values || [];
  const normalizedRows = rows.map((row) => row.map((cell) => `${cell}`));
  const effectiveDate = resolveEffectiveDeliveryDate(shift, deliveryOverrides);

  if (shift.type === "delivery") {
    const targetWeekKey = timestampToIsoWeekKey(effectiveDate);
    for (let rowOffset = 0; rowOffset < normalizedRows.length; rowOffset += 1) {
      const row = normalizedRows[rowOffset];
      const rowDate = parseDateInput(row[0]);
      if (
        rowDate &&
        timestampToIsoWeekKey(rowDate) === targetWeekKey
      ) {
        const rowNumber = rowOffset + 1;
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${parseSheetName(range)}!A${rowNumber}:F${rowNumber}`,
          valueInputOption: "RAW",
          requestBody: {
            values: [
              toDeliveryHumanRow(shift, membersById, effectiveDate, row),
            ],
          },
        });
        return "updated";
      }
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${parseSheetName(range)}!A:F`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [
          [formatHumanMonthHeading(effectiveDate)],
          toDeliveryHumanRow(shift, membersById, effectiveDate),
        ],
      },
    });
    return "appended";
  }

  for (let rowOffset = 0; rowOffset < normalizedRows.length; rowOffset += 1) {
    const row = normalizedRows[rowOffset];
    const rowDate = parseDateInput(row[0]);
    if (
      rowDate &&
      timestampToSheetDate(rowDate) === timestampToSheetDate(shift.date)
    ) {
      const dateRowNumber = rowOffset + 1;
      const existingLeadRow = normalizedRows[rowOffset + 1] || [];
      const existingSupportRows = normalizedRows.slice(
        rowOffset + 2,
        rowOffset + 6,
      );
      const leadRow = toMarketHumanLeadRow(
        shift,
        membersById,
        existingLeadRow,
      );
      const supportRows = toMarketHumanSupportRows(
        shift,
        membersById,
        existingSupportRows,
      );

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range:
          `${parseSheetName(range)}!A${dateRowNumber}:` +
          `C${dateRowNumber + 5}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [
            [formatHumanLongDate(shift.date)],
            leadRow,
            ...supportRows,
          ],
        },
      });
      return "updated";
    }
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${parseSheetName(range)}!A:C`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        [formatHumanLongDate(shift.date)],
        toMarketHumanLeadRow(shift, membersById),
        ...toMarketHumanSupportRows(shift, membersById),
      ],
    },
  });
  return "appended";
};

const loadMembersById = async (
  env: string,
): Promise<Map<string, MemberSheetRef>> => {
  const lookup = await buildMemberLookup(env);
  const membersById = new Map<string, MemberSheetRef>();
  lookup.forEach((value) => {
    membersById.set(value.id, value);
  });
  return membersById;
};

const isShiftPlanningRequestType = (
  value: string,
): value is ShiftPlanningRequestType =>
  value === "delivery" || value === "market";

const parseLegacyShiftPlanningRequest = (
  snapshot: DocumentSnapshot,
): ShiftPlanningRequestRecord | null => {
  if (!snapshot.exists) {
    return null;
  }

  const type = parseString(snapshot.get("type"))?.toLowerCase();
  const requestedByUserId = parseString(snapshot.get("requestedByUserId"));
  const requestedAt = snapshot.get("requestedAt");
  const status = parseString(snapshot.get("status"))?.toLowerCase() as
    ShiftPlanningRequestStatus | undefined;

  if (
    !type ||
    !isShiftPlanningRequestType(type) ||
    !requestedByUserId ||
    !(requestedAt instanceof Timestamp) ||
    !status
  ) {
    return null;
  }

  return {
    id: snapshot.id,
    type,
    requestedByUserId,
    requestedAt,
    status,
  };
};

const targetSeasonStartYearFromNow = (): number => {
  const now = new Date();
  const utcYear = now.getUTCFullYear();
  const utcMonth = now.getUTCMonth() + 1;
  return utcMonth >= 9 ? utcYear + 1 : utcYear;
};

const buildSeasonLabel = (seasonStartYear: number): string =>
  `${seasonStartYear}-${`${(seasonStartYear + 1) % 100}`.padStart(2, "0")}`;

const buildDeliverySheetName = (seasonLabel: string): string =>
  `turnos-reparto ${seasonLabel}`;

const buildMarketSheetName = (seasonLabel: string): string =>
  `turnos-mercado ${seasonLabel}`;

const shiftTypeLabelEs = (type: ShiftPlanningRequestType): string =>
  type === "delivery" ? "reparto" : "mercado";

const normalizeWeekdayWireValue = (value: string | null): string =>
  (value || "WED").trim().toUpperCase();

const weekdayWireValueToUtcDay = (value: string | null): number => {
  switch (normalizeWeekdayWireValue(value)) {
  case "MON":
    return 1;
  case "TUE":
    return 2;
  case "WED":
    return 3;
  case "THU":
    return 4;
  case "FRI":
    return 5;
  case "SAT":
    return 6;
  case "SUN":
    return 0;
  default:
    return 3;
  }
};

const addUtcDays = (date: Date, days: number): Date => {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const timestampFromUtcDate = (date: Date): Timestamp =>
  Timestamp.fromDate(new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  )));

const getDefaultDeliveryDayWireValue = async (
  env: string,
): Promise<string> => {
  for (const ref of globalConfigDocRefs(env)) {
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      continue;
    }
    const topLevel = parseString(snapshot.get("deliveryDayOfWeek"));
    if (topLevel) {
      return normalizeWeekdayWireValue(topLevel);
    }
    const deliveryCalendar = parseBody(snapshot.get("deliveryCalendar"));
    const nested = parseString(deliveryCalendar.deliveryDayOfWeek);
    if (nested) {
      return normalizeWeekdayWireValue(nested);
    }
  }
  return "WED";
};

const listEligiblePlanningMembers = async (
  env: string,
): Promise<PlanningMemberRef[]> => {
  const snapshot = await plusUsersCollection(env)
    .where("isActive", "==", true)
    .get();

  return snapshot.docs
    .map((doc) => {
      const createdAt = doc.get("createdAt");
      const updatedAt = doc.get("updatedAt");
      return {
        id: doc.id,
        displayName: parseString(doc.get("displayName")) || doc.id,
        normalizedEmail:
          parseString(doc.get("normalizedEmail")) ||
          parseString(doc.get("emailNormalized")) ||
          "",
        phone: parseString(doc.get("phone")),
        isActive: doc.get("isActive") === true,
        roles: parseRoles(doc.get("roles")),
        isCommonPurchaseManager:
          doc.get("isCommonPurchaseManager") === true,
        createdAtMillis: createdAt instanceof Timestamp ?
          createdAt.toMillis() :
          0,
        updatedAtMillis: updatedAt instanceof Timestamp ?
          updatedAt.toMillis() :
          0,
      };
    })
    .filter(isEligibleForShiftRotation);
};

const shuffleArray = <T>(values: T[]): T[] => {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

const buildPlanningRoster = (
  activeMembers: PlanningMemberRef[],
  existingRotationUserIds: string[],
): PlanningMemberRef[] => {
  const activeById = new Map(
    activeMembers.map((member) => [member.id, member]),
  );
  const knownMembers = existingRotationUserIds
    .map((userId) => activeById.get(userId))
    .filter((member): member is PlanningMemberRef => Boolean(member));
  const knownIds = new Set(knownMembers.map((member) => member.id));
  const appendedMembers = activeMembers
    .filter((member) => !knownIds.has(member.id))
    .sort((left, right) =>
      left.displayName.localeCompare(right.displayName, "es", {
        sensitivity: "base",
      })
    );

  if (knownMembers.length === 0) {
    return shuffleArray(activeMembers);
  }

  const shuffledKnown = shuffleArray(knownMembers);
  const roster = [...shuffledKnown, ...appendedMembers];
  return roster;
};

const existingRotationUserIdsForType = (
  shifts: FirestoreShiftRecord[],
  type: ShiftPlanningRequestType,
): string[] => {
  const orderedIds = shifts
    .filter((shift) => shift.type === type)
    .sort((left, right) => left.date.toMillis() - right.date.toMillis())
    .flatMap((shift) => shift.assignedUserIds);
  return Array.from(new Set(orderedIds));
};

const buildDeliverySeasonDates = (
  seasonStartYear: number,
  deliveryWeekdayWireValue: string,
): Timestamp[] => {
  const start = new Date(Date.UTC(seasonStartYear, 8, 1));
  const end = new Date(Date.UTC(seasonStartYear + 1, 5, 30));
  const targetDay = weekdayWireValueToUtcDay(deliveryWeekdayWireValue);
  const offset = (targetDay - start.getUTCDay() + 7) % 7;
  const firstDate = addUtcDays(start, offset);
  const results: Timestamp[] = [];

  for (
    let current = firstDate;
    current.getTime() <= end.getTime();
    current = addUtcDays(current, 7)
  ) {
    results.push(timestampFromUtcDate(current));
  }

  return results;
};

const thirdSaturdayOfMonth = (
  year: number,
  monthIndex: number,
): Timestamp => {
  const firstDay = new Date(Date.UTC(year, monthIndex, 1));
  const firstSaturdayOffset = (6 - firstDay.getUTCDay() + 7) % 7;
  const thirdSaturday = addUtcDays(firstDay, firstSaturdayOffset + 14);
  return timestampFromUtcDate(thirdSaturday);
};

const buildMarketSeasonDates = (
  seasonStartYear: number,
): Timestamp[] => {
  const months = [8, 9, 10, 11, 0, 1, 2, 3, 4, 5];
  return months.map((monthIndex) => {
    const year = monthIndex >= 8 ? seasonStartYear : seasonStartYear + 1;
    return thirdSaturdayOfMonth(year, monthIndex);
  });
};

const ensureMinimumGroupSize = (
  groups: string[][],
  minimum: number,
): string[][] => {
  const normalized = groups.map((group) => [...group]);
  while (
    normalized.length > 1 &&
    normalized[normalized.length - 1].length > 0 &&
    normalized[normalized.length - 1].length < minimum
  ) {
    const leftovers = normalized.pop() || [];
    leftovers.forEach((userId) => {
      const index = Math.floor(Math.random() * normalized.length);
      normalized[index].push(userId);
    });
  }
  return normalized;
};

const buildMarketGroups = (
  activeMembers: PlanningMemberRef[],
  monthsCount: number,
): string[][] => {
  if (activeMembers.length === 0) {
    return [];
  }

  const roster = buildPlanningRoster(activeMembers, []);
  let groups: string[][] = [];
  for (let index = 0; index < roster.length; index += 3) {
    groups.push(roster.slice(index, index + 3).map((member) => member.id));
  }
  groups = ensureMinimumGroupSize(groups, 3);

  if (groups.length > monthsCount) {
    const kept = groups.slice(0, monthsCount);
    const overflowMembers = groups.slice(monthsCount).flat();
    overflowMembers.forEach((userId) => {
      const index = Math.floor(Math.random() * kept.length);
      kept[index].push(userId);
    });
    groups = kept;
  }

  let cursor = 0;
  while (groups.length < monthsCount) {
    const group: string[] = [];
    while (group.length < 3) {
      group.push(roster[cursor % roster.length].id);
      cursor += 1;
    }
    groups.push(group);
  }

  return groups;
};

const buildDeliveryPlannedShifts = (
  seasonStartYear: number,
  activeMembers: PlanningMemberRef[],
  existingShifts: FirestoreShiftRecord[],
  deliveryWeekdayWireValue: string,
): FirestoreShiftRecord[] => {
  const dates = buildDeliverySeasonDates(
    seasonStartYear,
    deliveryWeekdayWireValue,
  );
  if (dates.length === 0 || activeMembers.length === 0) {
    return [];
  }

  const existingRotationUserIds = existingRotationUserIdsForType(
    existingShifts,
    "delivery",
  );
  const rounds: PlanningMemberRef[] = [];
  while (rounds.length < dates.length) {
    rounds.push(...buildPlanningRoster(activeMembers, existingRotationUserIds));
  }

  return dates.map((date, index) => ({
    id: buildShiftId("delivery", date),
    type: "delivery" as const,
    date,
    assignedUserIds: [rounds[index].id],
    helperUserId: rounds[index + 1]?.id || null,
    status: "planned" as const,
    source: "planner",
    syncSheetName: buildDeliverySheetName(buildSeasonLabel(seasonStartYear)),
  }));
};

const buildMarketPlannedShifts = (
  seasonStartYear: number,
  activeMembers: PlanningMemberRef[],
): FirestoreShiftRecord[] => {
  const dates = buildMarketSeasonDates(seasonStartYear);
  const groups = buildMarketGroups(activeMembers, dates.length);
  return dates.map((date, index) => ({
    id: buildShiftId("market", date),
    type: "market" as const,
    date,
    assignedUserIds: groups[index] || [],
    helperUserId: null,
    status: "planned" as const,
    source: "planner",
    syncSheetName: buildMarketSheetName(buildSeasonLabel(seasonStartYear)),
  }));
};

const ensureSheetExists = async (
  sheets: Awaited<ReturnType<typeof getSheetsClient>>,
  spreadsheetId: string,
  sheetName: string,
): Promise<void> => {
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });
  const exists = spreadsheet.data.sheets?.some(
    (sheet) => sheet.properties?.title === sheetName,
  );
  if (exists) {
    return;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: sheetName,
            },
          },
        },
      ],
    },
  });
};

const updateWholeSheet = async (
  sheets: Awaited<ReturnType<typeof getSheetsClient>>,
  spreadsheetId: string,
  sheetName: string,
  values: string[][],
): Promise<void> => {
  await ensureSheetExists(sheets, spreadsheetId, sheetName);
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
  });
  if (values.length === 0) {
    return;
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "RAW",
    requestBody: {
      values,
    },
  });
};

const buildDeliverySheetValues = (
  shifts: FirestoreShiftRecord[],
  seasonLabel: string,
  membersById: Map<string, MemberSheetRef>,
  deliveryOverrides: DeliveryCalendarOverrideMap,
): string[][] => {
  const rows: string[][] = [[`TURNOS REPARTO ${seasonLabel}`], []];
  let currentMonthHeading = "";
  shifts.forEach((shift) => {
    const effectiveDate = resolveEffectiveDeliveryDate(
      shift,
      deliveryOverrides,
    );
    const monthHeading = formatHumanMonthHeading(effectiveDate);
    if (monthHeading !== currentMonthHeading) {
      rows.push([monthHeading]);
      currentMonthHeading = monthHeading;
    }
    rows.push(toDeliveryHumanRow(shift, membersById, effectiveDate));
  });
  return rows;
};

const buildMarketSheetValues = (
  shifts: FirestoreShiftRecord[],
  seasonLabel: string,
  membersById: Map<string, MemberSheetRef>,
): string[][] => {
  const rows: string[][] = [[`TURNOS MERCADO ${seasonLabel}`], []];
  shifts.forEach((shift) => {
    rows.push([formatHumanLongDate(shift.date)]);
    rows.push(toMarketHumanLeadRow(shift, membersById));
    rows.push(...toMarketHumanSupportRows(shift, membersById));
  });
  return rows;
};

const persistPlannedShifts = async (
  env: AppEnvironment,
  requestId: string,
  shifts: FirestoreShiftRecord[],
): Promise<number> => {
  const root = `${env}/plus-collections`;
  let writes = 0;

  for (const shift of shifts) {
    const result = await runShiftPlanningNotificationGuardedShiftWrite({
      firestore,
      root,
      shiftId: shift.id,
      clock: () => Timestamp.now(),
      mutate: ({transaction, reference, snapshot}) => {
        const existingCreatedAt = snapshot.get("createdAt");
        transaction.set(reference, {
          type: shift.type,
          date: shift.date,
          assignedUserIds: shift.assignedUserIds,
          helperUserId: shift.helperUserId,
          status: shift.status,
          source: shift.source,
          createdAt: existingCreatedAt instanceof Timestamp ?
            existingCreatedAt :
            FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          planningMeta: {
            requestId,
            seasonLabel:
              shift.syncSheetName?.replace(
                /^turnos-(reparto|mercado)\s+/i,
                "",
              ) || null,
          },
          syncMeta: {
            origin: "planner",
            sheetName: shift.syncSheetName,
          },
        }, {merge: true});
      },
    });
    requireShiftPlanningNotificationGuardedWrite(result);
    writes += 1;
  }

  return writes;
};

const createShiftPlanningNotification = async (
  env: string,
  type: ShiftPlanningRequestType,
  seasonLabel: string,
  requestedByUserId: string,
  userIds: string[],
): Promise<void> => {
  const uniqueUserIds = Array.from(new Set(userIds));
  if (uniqueUserIds.length === 0) {
    return;
  }
  await firestore.collection(`${env}/plus-collections/notificationEvents`).add({
    title: `Nuevos turnos de ${shiftTypeLabelEs(type)}`,
    body:
      `Ya tienes disponibles los turnos de ${shiftTypeLabelEs(type)} ` +
      `para la temporada ${seasonLabel}.`,
    type: "shift_planning_generated",
    target: "users",
    targetPayload: {
      userIds: uniqueUserIds,
    },
    createdBy: requestedByUserId,
    sentAt: FieldValue.serverTimestamp(),
  });
};

const dispatchShiftUpdatedNotification = async (
  env: string,
  shift: FirestoreShiftRecord,
): Promise<void> => {
  const dateLabel = timestampToSheetDate(shift.date);
  await firestore.collection(`${env}/plus-collections/notificationEvents`).add({
    title: "Shift updated",
    body: `${shift.type} shift updated for ${dateLabel}.`,
    type: SHIFT_NOTIFICATION_TYPE,
    target: "all",
    targetPayload: {},
    createdBy: "system",
    sentAt: FieldValue.serverTimestamp(),
  });
};

const formatNotificationDate = (
  timestamp: Timestamp,
): string => {
  const formatter = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: SHEET_TIME_ZONE,
  });
  return formatter.format(timestamp.toDate());
};

const createDeliveryCalendarNotification = async (
  env: string,
  weekKey: string,
  updatedByUserId: string | null,
  nextDate: Timestamp | null,
  previousDate: Timestamp | null,
): Promise<void> => {
  if (!nextDate && !previousDate) {
    return;
  }

  const title = "Cambio en el dia de reparto";
  const body = nextDate ?
    (
      previousDate ?
        `El reparto de la semana ${weekKey} pasa del ` +
          `${formatNotificationDate(previousDate)} al ` +
          `${formatNotificationDate(nextDate)}.` :
        `El reparto de la semana ${weekKey} pasa al ` +
          `${formatNotificationDate(nextDate)}.`
    ) :
    `El reparto de la semana ${weekKey} vuelve a su dia por defecto.`;

  await firestore.collection(`${env}/plus-collections/notificationEvents`).add({
    title,
    body,
    type: "delivery_calendar_updated",
    target: "all",
    targetPayload: {},
    createdBy: updatedByUserId || "system",
    sentAt: FieldValue.serverTimestamp(),
  });
};

const hasRelevantShiftChange = (
  before: FirestoreShiftRecord | null,
  after: FirestoreShiftRecord,
): boolean => {
  if (!before) {
    return true;
  }

  return before.status !== after.status ||
    before.type !== after.type ||
    before.date.toMillis() !== after.date.toMillis() ||
    before.helperUserId !== after.helperUserId ||
    JSON.stringify(before.assignedUserIds) !==
      JSON.stringify(after.assignedUserIds);
};

const readAllShifts = async (
  env: string,
): Promise<FirestoreShiftRecord[]> => {
  const snapshot = await shiftsCollection(env)
    .orderBy("date", "asc")
    .get();

  return snapshot.docs
    .map((doc) => toShiftRecord(doc))
    .filter((shift): shift is FirestoreShiftRecord => Boolean(shift));
};

const exportAllShiftsToGoogleSheets = async (
  env: string,
): Promise<{
  exportedCount: number;
  deliveryCount: number;
  marketCount: number;
}> => {
  const sheetConfig = getSheetConfig(env);
  if (!sheetConfig) {
    throw new Error(
      `Missing sheets configuration for env=${env}. ` +
      "Expected sheets.spreadsheet_id and ranges."
    );
  }

  const [sheets, membersById, shifts, deliveryOverrides] = await Promise.all([
    getSheetsClient(),
    loadMembersById(env),
    readAllShifts(env),
    readDeliveryCalendarOverrideMap(env),
  ]);
  let deliveryCount = 0;
  let marketCount = 0;

  for (const shift of shifts) {
    await upsertShiftRowInSheet(
      sheets,
      sheetConfig.spreadsheetId,
      shift.type === "market" ?
        sheetConfig.marketRange :
        sheetConfig.deliveryRange,
      shift,
      membersById,
      deliveryOverrides,
    );
    if (shift.type === "market") {
      marketCount += 1;
    } else {
      deliveryCount += 1;
    }
  }

  return {
    exportedCount: shifts.length,
    deliveryCount,
    marketCount,
  };
};

const syncShiftsFromGoogleSheetsInternal = async (
  env: AppEnvironment,
): Promise<{
  importedCount: number;
  deliveryCount: number;
  marketCount: number;
}> => {
  const sheetConfig = getSheetConfig(env);
  if (!sheetConfig) {
    throw new Error(
      `Missing sheets configuration for env=${env}. ` +
      "Expected sheets.spreadsheet_id and ranges."
    );
  }

  const sheets = await getSheetsClient();
  const lookup = await buildMemberLookup(env);
  const definitions = sheetRangeDefinitions(sheetConfig);
  const rowsByRange = await Promise.all(
    definitions.map((definition) =>
      fetchSheetRows(
        sheets,
        sheetConfig.spreadsheetId,
        definition,
        lookup,
      )
    )
  );
  const rows = withDerivedDeliveryHelpers(rowsByRange.flat());
  const importedCount = await syncShiftRowsIntoFirestore(env, rows);

  return {
    importedCount,
    deliveryCount: rows.filter((row) => row.type === "delivery").length,
    marketCount: rows.filter((row) => row.type === "market").length,
  };
};

export const sendPendingOrderReminderSunday20 = onSchedule(
  {
    schedule: "0 20 * * 0",
    timeZone: SHEET_TIME_ZONE,
  },
  async () => {
    await runPendingOrderReminderForHour(20);
  }
);

export const sendPendingOrderReminderSunday22 = onSchedule(
  {
    schedule: "0 22 * * 0",
    timeZone: SHEET_TIME_ZONE,
  },
  async () => {
    await runPendingOrderReminderForHour(22);
  }
);

export const sendPendingOrderReminderSunday23 = onSchedule(
  {
    schedule: "0 23 * * 0",
    timeZone: SHEET_TIME_ZONE,
  },
  async () => {
    await runPendingOrderReminderForHour(23);
  }
);

export const retryPendingOrderReminderDispatches = onSchedule(
  {
    schedule: "*/15 * * * *",
    timeZone: SHEET_TIME_ZONE,
  },
  async () => {
    await runOrderReminderRetryCycle();
  }
);

export const onNotificationEventCreated = onDocumentCreatedWithAuthContext(
  "{env}/plus-collections/notificationEvents/{eventId}",
  async (event) => {
    const env = event.params.env;
    if (!await authorizePrivilegedFirestoreEvent(
      "onNotificationEventCreated",
      env,
      event.authType,
      event.authId,
    )) {
      return;
    }
    const snapshot = event.data;
    if (!snapshot) {
      return;
    }

    const eventId = event.params.eventId;
    const eventData = parseBody(snapshot.data());
    const payload = parseNotificationDispatchPayload(
      eventData
    );
    if (!payload) {
      logger.warn(
        "Skipping notification dispatch due to malformed payload",
        {env, eventId}
      );
      return;
    }

    const eventRef = snapshot.ref;
    const targetUserIds = await resolveTargetUserIds(env, payload);
    const inboxWrites = await fanOutNotificationInbox(
      env,
      eventId,
      eventData,
      targetUserIds,
    );
    logger.info("Notification event copied to member inboxes", {
      env,
      eventId,
      inboxWrites,
    });
    if (payload.type === ORDER_REMINDER_TYPE) {
      const handledAsOrderReminder = await dispatchOrderReminderEvent(
        env,
        eventId,
        eventData,
        payload,
        eventRef,
        targetUserIds,
      );
      if (handledAsOrderReminder) {
        return;
      }
    }

    await dispatchNotificationEventGeneric(
      env,
      eventId,
      payload,
      eventRef,
      targetUserIds,
    );
  }
);

export const syncShiftsFromGoogleSheets = onRequest(async (req, res) => {
  try {
    requirePostMethod(req.method);
    const env = parseRequestEnvironment(req);
    const identity = await verifyRequestIdentity(req);
    await requireAdminInEnvironment(env, identity);
    const summary = await syncShiftsFromGoogleSheetsInternal(env);
    logger.info("✅ Shifts synced from Google Sheets", {env, ...summary});
    res.status(200).json({
      ok: true,
      env,
      ...summary,
    });
  } catch (error) {
    sendHttpError(res, error);
  }
});

export const exportShiftsToGoogleSheets = onRequest(async (req, res) => {
  try {
    requirePostMethod(req.method);
    const env = parseRequestEnvironment(req);
    const identity = await verifyRequestIdentity(req);
    await requireAdminInEnvironment(env, identity);
    const summary = await exportAllShiftsToGoogleSheets(env);
    logger.info("✅ Shifts exported to Google Sheets", {env, ...summary});
    res.status(200).json({
      ok: true,
      env,
      ...summary,
    });
  } catch (error) {
    sendHttpError(res, error);
  }
});

const processShiftPlanningRequest = async (
  env: AppEnvironment,
  request: ShiftPlanningRequestRecord,
): Promise<{
  seasonLabel: string;
  sheetName: string;
  generatedCount: number;
}> => {
  const seasonStartYear = targetSeasonStartYearFromNow();
  const seasonLabel = buildSeasonLabel(seasonStartYear);
  const existingShifts = await readAllShifts(env);
  const activeMembers = await listEligiblePlanningMembers(env);

  if (activeMembers.length === 0) {
    throw new Error("No active members available for planning.");
  }

  const plannedShifts = request.type === "delivery" ?
    buildDeliveryPlannedShifts(
      seasonStartYear,
      activeMembers,
      existingShifts,
      await getDefaultDeliveryDayWireValue(env),
    ) :
    buildMarketPlannedShifts(seasonStartYear, activeMembers);

  if (plannedShifts.length === 0) {
    throw new Error(
      "No shifts were generated for the requested planning type.",
    );
  }

  const sheetConfig = getSheetConfig(env);
  if (!sheetConfig) {
    throw new Error("Missing sheets configuration for shift planning.");
  }

  const [sheets, membersById, deliveryOverrides] = await Promise.all([
    getSheetsClient(),
    loadMembersById(env),
    readDeliveryCalendarOverrideMap(env),
  ]);

  const sheetName = request.type === "delivery" ?
    buildDeliverySheetName(seasonLabel) :
    buildMarketSheetName(seasonLabel);
  const sheetValues = request.type === "delivery" ?
    buildDeliverySheetValues(
      plannedShifts,
      seasonLabel,
      membersById,
      deliveryOverrides,
    ) :
    buildMarketSheetValues(plannedShifts, seasonLabel, membersById);

  await updateWholeSheet(
    sheets,
    sheetConfig.spreadsheetId,
    sheetName,
    sheetValues,
  );

  await persistPlannedShifts(env, request.id, plannedShifts);
  await createShiftPlanningNotification(
    env,
    request.type,
    seasonLabel,
    request.requestedByUserId,
    plannedShifts.flatMap((shift) => shift.assignedUserIds),
  );

  return {
    seasonLabel,
    sheetName,
    generatedCount: plannedShifts.length,
  };
};

export const onShiftPlanningRequestCreated = onDocumentCreatedWithAuthContext(
  "{env}/plus-collections/shiftPlanningRequests/{requestId}",
  async (event) => {
    const env = event.params.env;
    if (!await authorizePrivilegedFirestoreEvent(
      "onShiftPlanningRequestCreated",
      env,
      event.authType,
      event.authId,
    )) {
      return;
    }
    const snapshot = event.data;
    if (!snapshot) {
      return;
    }

    const route = classifyShiftPlanningCreatedRequest(snapshot.data());
    if (route === "unsupportedVersion") {
      logger.error("Skipping unsupported shift planning request version", {
        env,
        requestId: event.params.requestId,
      });
      return;
    }
    if (route === "v2") {
      try {
        const result = await shiftPlanningRuntime.executeRequest({
          environment: parseAppEnvironment(env),
          requestId: event.params.requestId,
          request: snapshot.data(),
          workerId: "shift-planning-trigger-v2",
        });
        logger.info("✅ Shift planning v2 request routed", {
          env,
          requestId: event.params.requestId,
          routeKind: result.kind,
          resultKind: result.result.kind,
        });
      } catch (error) {
        logger.error("❌ Shift planning v2 request failed", {
          env,
          requestId: event.params.requestId,
          error,
        });
        throw error;
      }
      return;
    }

    const request = parseLegacyShiftPlanningRequest(snapshot);
    if (!request || request.status !== "requested") {
      logger.warn("Skipping malformed shift planning request", {
        env,
        requestId: event.params.requestId,
      });
      return;
    }

    await snapshot.ref.set({
      status: "processing",
      processingStartedAt: FieldValue.serverTimestamp(),
    }, {merge: true});

    try {
      const summary = await processShiftPlanningRequest(
        parseAppEnvironment(env),
        request,
      );
      await snapshot.ref.set({
        status: "completed",
        completedAt: FieldValue.serverTimestamp(),
        seasonLabel: summary.seasonLabel,
        sheetName: summary.sheetName,
        generatedCount: summary.generatedCount,
      }, {merge: true});
      logger.info("✅ Shift planning completed", {
        env,
        requestId: request.id,
        type: request.type,
        ...summary,
      });
    } catch (error) {
      await snapshot.ref.set({
        status: "failed",
        failedAt: FieldValue.serverTimestamp(),
        errorMessage:
          error instanceof Error ? error.message : "Unknown planning error",
      }, {merge: true});
      logger.error("❌ Shift planning failed", {
        env,
        requestId: request.id,
        type: request.type,
        error,
      });
    }
  }
);

export const onShiftWritten = onDocumentWrittenWithAuthContext(
  "{env}/plus-collections/shifts/{shiftId}",
  async (event) => {
    const env = event.params.env;
    if (!await authorizePrivilegedFirestoreEvent(
      "onShiftWritten",
      env,
      event.authType,
      event.authId,
    )) {
      return;
    }
    const afterSnapshot = event.data?.after;
    if (!afterSnapshot?.exists) {
      return;
    }

    const beforeSnapshot = event.data?.before;
    const after = toShiftRecord(afterSnapshot);
    const before = beforeSnapshot?.exists ?
      toShiftRecord(beforeSnapshot) :
      null;

    if (!after) {
      logger.warn("Skipping shift sync due to malformed Firestore shift", {
        env,
        shiftId: event.params.shiftId,
      });
      return;
    }

    if (after.source === "google_sheets") {
      return;
    }

    if (after.status !== "confirmed") {
      return;
    }

    if (!hasRelevantShiftChange(before, after)) {
      return;
    }

    const sheetConfig = getSheetConfig(env);
    if (!sheetConfig) {
      logger.warn("Skipping shift export because sheets config is missing", {
        env,
        shiftId: after.id,
      });
      return;
    }

    const targetRange = after.syncSheetName ?
      `${after.syncSheetName}!${after.type === "market" ? "A:C" : "A:F"}` :
      (
        after.type === "market" ?
          sheetConfig.marketRange :
          sheetConfig.deliveryRange
      );

    const [sheets, membersById, deliveryOverrides] = await Promise.all([
      getSheetsClient(),
      loadMembersById(env),
      readDeliveryCalendarOverrideMap(env),
    ]);

    const result = await upsertShiftRowInSheet(
      sheets,
      sheetConfig.spreadsheetId,
      targetRange,
      after,
      membersById,
      deliveryOverrides,
    );

    await afterSnapshot.ref.set({
      syncMeta: {
        origin: "app",
        sheetName: parseSheetName(targetRange),
        exportedAt: FieldValue.serverTimestamp(),
        exportMode: result,
      },
    }, {merge: true});

    await dispatchShiftUpdatedNotification(env, after);

    logger.info("✅ Confirmed shift exported to Google Sheets", {
      env,
      shiftId: after.id,
      exportMode: result,
      targetRange,
    });
  }
);

export const onDeliveryCalendarOverrideWritten =
onDocumentWrittenWithAuthContext(
  "{env}/plus-collections/deliveryCalendar/{weekKey}",
  async (event) => {
    const env = event.params.env;
    if (!await authorizePrivilegedFirestoreEvent(
      "onDeliveryCalendarOverrideWritten",
      env,
      event.authType,
      event.authId,
    )) {
      return;
    }
    const weekKey = event.params.weekKey;
    const beforeSnapshot = event.data?.before;
    const afterSnapshot = event.data?.after;
    const previousDate = beforeSnapshot?.exists &&
      beforeSnapshot.get("deliveryDate") instanceof Timestamp ?
      beforeSnapshot.get("deliveryDate") as Timestamp :
      null;
    const nextDate = afterSnapshot?.exists &&
      afterSnapshot.get("deliveryDate") instanceof Timestamp ?
      afterSnapshot.get("deliveryDate") as Timestamp :
      null;
    const updatedByUserId = parseString(
      afterSnapshot?.get("updatedBy") ?? beforeSnapshot?.get("updatedBy"),
    );

    try {
      const sheetConfig = getSheetConfig(env);
      if (!sheetConfig) {
        throw new Error(
          `Missing sheets configuration for env=${env}. ` +
          "Expected sheets.spreadsheet_id and ranges."
        );
      }

      const [
        sheets,
        membersById,
        shifts,
        deliveryOverrides,
      ] = await Promise.all([
        getSheetsClient(),
        loadMembersById(env),
        readAllShifts(env),
        readDeliveryCalendarOverrideMap(env),
      ]);

      const matchingDeliveryShifts = shifts.filter((shift) =>
        shift.type === "delivery" &&
        timestampToIsoWeekKey(shift.date) === weekKey
      );

      let updatedCount = 0;
      for (const shift of matchingDeliveryShifts) {
        await upsertShiftRowInSheet(
          sheets,
          sheetConfig.spreadsheetId,
          sheetConfig.deliveryRange,
          shift,
          membersById,
          deliveryOverrides,
        );
        updatedCount += 1;
      }

      logger.info("✅ Delivery calendar override reflected in Google Sheets", {
        env,
        weekKey,
        updatedCount,
      });

      if (updatedCount > 0) {
        await createDeliveryCalendarNotification(
          env,
          weekKey,
          updatedByUserId,
          nextDate,
          previousDate,
        );
      }
    } catch (error) {
      logger.error(
        "❌ Failed to reflect delivery calendar override in Google Sheets",
        {
          env,
          weekKey,
          error,
        },
      );
    }
  }
);

export const onMemberDirectorySourceWritten = onDocumentWritten(
  "{env}/plus-collections/users/{memberId}",
  async (event) => {
    const environment = event.params.env;
    const memberId = event.params.memberId;
    if (
      (environment !== "develop" && environment !== "production") ||
      typeof memberId !== "string" ||
      memberId.length === 0
    ) {
      logger.warn("Ignored unsupported member directory source path", {
        environment,
      });
      return;
    }
    const directoryRef = firestore
      .collection(`${environment}/plus-collections/memberDirectory`)
      .doc(memberId);
    const after = event.data?.after;
    const projection = after?.exists ?
      buildMemberDirectoryDocument(memberId, after.data()) :
      null;
    if (projection) {
      await directoryRef.set(projection, {merge: false});
    } else {
      await directoryRef.delete();
    }
    logger.info("Member directory projection synchronized", {environment});
  },
);

const ALLOWED_TIMESTAMP_COLLECTIONS = new Set([
  "products",
  "orderlines",
  "containers",
  "measures",
  "users",
  "orders",
]);

const handleTimestampWrite = async (
  request: Request,
  response: Response,
  forcedCollectionName?: string,
): Promise<void> => {
  try {
    requirePostMethod(request.method);
    const environment = parseRequestEnvironment(request);
    const identity = await verifyRequestIdentity(request);
    await requireAdminInEnvironment(environment, identity);
    const body = parseBody(request.body);
    const collectionName = forcedCollectionName ||
      parseString(body.collectionName) ||
      parseString(request.query.collectionName) ||
      "products";
    if (!ALLOWED_TIMESTAMP_COLLECTIONS.has(collectionName)) {
      throw new HttpRequestError(
        400,
        "invalid_collection",
        "collectionName is not supported",
      );
    }
    await updateTimestamp(environment, collectionName);
    logger.info("HTTP freshness timestamp updated", {
      environment,
      collectionName,
    });
    response.status(200).json({
      ok: true,
      environment,
      collectionName,
    });
  } catch (error) {
    sendHttpError(response, error);
  }
};

export const onProductWrite = onRequest((req, res) =>
  handleTimestampWrite(req, res)
);

export const onContainerWrite = onRequest((req, res) =>
  handleTimestampWrite(req, res, "containers")
);

export const onMeasureWrite = onRequest((req, res) =>
  handleTimestampWrite(req, res, "measures")
);

export const onUserWrite = onRequest((req, res) =>
  handleTimestampWrite(req, res, "users")
);

export const onOrderWrite = onRequest((req, res) =>
  handleTimestampWrite(req, res, "orders")
);

export const resolveAuthorizedMember = onRequest(async (req, res) => {
  try {
    requirePostMethod(req.method);
    const requestedEnvironment = parseRequestEnvironment(req);
    const identity = await verifyRequestIdentity(req);
    const environment = await resolveRequestEnvironmentForIdentity(
      requestedEnvironment,
      identity,
    );
    const linkedMember = await readLinkedMember(environment, identity);
    if (linkedMember) {
      res.status(200).json({
        authorized: true,
        memberId: linkedMember.memberId,
        roles: linkedMember.roles,
        isActive: linkedMember.isActive,
        environment,
        firstLoginLinked: false,
      });
      return;
    }
    if (!identity.email || !identity.emailVerified) {
      throw new HttpRequestError(
        403,
        "verified_email_required",
        "A verified email is required for the first link",
      );
    }

    const collection = usersCollection(environment);
    const linkRef = authLinksCollection(environment).doc(identity.uid);
    const result = await firestore.runTransaction(async (transaction) => {
      const linkSnapshot = await transaction.get(linkRef);
      if (linkSnapshot.exists) {
        const linkData = parseBody(linkSnapshot.data());
        const linkedMemberId = parseString(linkData.memberId);
        if (!linkedMemberId || linkedMemberId.includes("/")) {
          throw new HttpRequestError(
            403,
            "invalid_link",
            "Account link is invalid",
          );
        }
        const linkedSnapshot = await transaction.get(
          collection.doc(linkedMemberId),
        );
        if (!linkedSnapshot.exists) {
          throw new HttpRequestError(
            403,
            "invalid_link",
            "Account link is invalid",
          );
        }
        return {
          member: resolveLinkedMember(
            identity.uid,
            linkData,
            linkedSnapshot.data(),
          ),
          firstLoginLinked: false,
        };
      }

      const [canonicalQuery, legacyQuery, uidQuery] = await Promise.all([
        transaction.get(collection
          .where("normalizedEmail", "==", identity.email)
          .limit(2)),
        transaction.get(collection
          .where("emailNormalized", "==", identity.email)
          .limit(2)),
        transaction.get(collection
          .where("authUid", "==", identity.uid)
          .limit(2)),
      ]);
      const matches = new Map<string, QueryDocumentSnapshot>();
      [...canonicalQuery.docs, ...legacyQuery.docs].forEach((document) => {
        matches.set(document.id, document);
      });
      if (matches.size !== 1) {
        throw new HttpRequestError(
          403,
          matches.size === 0 ? "member_not_found" : "duplicate_member_email",
          "Unable to link this account",
        );
      }
      const memberDocument = [...matches.values()][0];
      if (uidQuery.docs.some((document) =>
        document.id !== memberDocument.id
      )) {
        throw new HttpRequestError(
          409,
          "auth_uid_conflict",
          "Account is already linked to another member",
        );
      }
      const memberData = parseBody(memberDocument.data());
      const existingAuthUid = parseString(memberData.authUid);
      if (existingAuthUid && existingAuthUid !== identity.uid) {
        throw new HttpRequestError(
          409,
          "auth_uid_conflict",
          "Member is already linked to another account",
        );
      }
      const member = resolveLinkedMember(
        identity.uid,
        {memberId: memberDocument.id},
        {...memberData, authUid: identity.uid},
      );
      const firstLoginLinked = !existingAuthUid;
      if (firstLoginLinked) {
        transaction.set(memberDocument.ref, {
          authUid: identity.uid,
          normalizedEmail: identity.email,
          email: FieldValue.delete(),
          emailNormalized: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        }, {merge: true});
      }
      transaction.create(linkRef, {
        memberId: memberDocument.id,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return {member, firstLoginLinked};
    });

    res.status(200).json({
      authorized: true,
      memberId: result.member.memberId,
      roles: result.member.roles,
      isActive: result.member.isActive,
      environment,
      firstLoginLinked: result.firstLoginLinked,
    });
  } catch (error) {
    sendHttpError(res, error);
  }
});

export const upsertMemberByAdmin = onRequest(async (req, res) => {
  try {
    requirePostMethod(req.method);
    const environment = parseRequestEnvironment(req);
    const identity = await verifyRequestIdentity(req);
    await requireAdminInEnvironment(environment, identity);
    const input = parseMemberUpsertInput(req.body);
    const collection = usersCollection(environment);
    const memberId = input.memberId ||
      buildSecureMemberId(input.normalizedEmail);
    const memberRef = collection.doc(memberId);

    await firestore.runTransaction(async (transaction) => {
      const [memberSnapshot, canonicalQuery, legacyQuery, adminQuery] =
        await Promise.all([
          transaction.get(memberRef),
          transaction.get(collection
            .where("normalizedEmail", "==", input.normalizedEmail)
            .limit(2)),
          transaction.get(collection
            .where("emailNormalized", "==", input.normalizedEmail)
            .limit(2)),
          transaction.get(collection
            .where("roles", "array-contains", "admin")),
        ]);
      const duplicates = new Set(
        [...canonicalQuery.docs, ...legacyQuery.docs]
          .map((document) => document.id)
          .filter((documentId) => documentId !== memberId),
      );
      if (duplicates.size > 0) {
        throw new HttpRequestError(
          409,
          "duplicate_member_email",
          "Another member already uses this email",
        );
      }

      const currentData = parseBody(memberSnapshot.data());
      assertMemberIdCompatible(
        memberSnapshot.exists,
        currentData,
        input.normalizedEmail,
      );
      const businessFields = resolveMemberBusinessFields(input, currentData);
      const currentRoles = Array.isArray(currentData.roles) ?
        currentData.roles :
        [];
      const wasActiveAdmin = memberSnapshot.exists &&
        currentData.isActive === true &&
        currentRoles.includes("admin");
      const willBeActiveAdmin = input.isActive &&
        input.roles.includes("admin");
      if (wasActiveAdmin && !willBeActiveAdmin) {
        const otherAdminCandidates = adminQuery.docs.flatMap((document) => {
          const authUid = parseString(document.get("authUid"));
          return document.id !== memberId &&
            document.get("isActive") === true &&
            authUid &&
            !authUid.includes("/") ?
            [{document, authUid}] :
            [];
        });
        const linkSnapshots = otherAdminCandidates.length > 0 ?
          await transaction.getAll(...otherAdminCandidates.map((candidate) =>
            authLinksCollection(environment).doc(candidate.authUid)
          )) :
          [];
        const hasOtherOperationalAdmin = otherAdminCandidates.some(
          (candidate, index) => isOperationallyLinkedAdmin(
            candidate.document.id,
            candidate.document.data(),
            linkSnapshots[index]?.data(),
          ),
        );
        if (!hasOtherOperationalAdmin) {
          throw new HttpRequestError(
            409,
            "last_active_admin",
            "Cannot remove the last active admin",
          );
        }
      }

      const payload: Record<string, unknown> = {
        displayName: input.displayName,
        normalizedEmail: input.normalizedEmail,
        email: FieldValue.delete(),
        emailNormalized: FieldValue.delete(),
        roles: input.roles,
        isActive: input.isActive,
        producerCatalogEnabled: input.producerCatalogEnabled,
        isCommonPurchaseManager: input.isCommonPurchaseManager,
        companyName: businessFields.companyName ||
          FieldValue.delete(),
        company_name: FieldValue.delete(),
        company: FieldValue.delete(),
        phoneNumber: businessFields.phoneNumber ||
          FieldValue.delete(),
        phone: FieldValue.delete(),
        telephone: FieldValue.delete(),
        telefono: FieldValue.delete(),
        producerParity: businessFields.producerParity,
        ecoCommitment: businessFields.ecoCommitment,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (!memberSnapshot.exists) {
        payload.authUid = null;
        payload.createdAt = FieldValue.serverTimestamp();
      }
      await requireShiftPlanningNotificationResourcesWritable(
        transaction,
        environment,
        [{scope: "member", resourceId: memberId}],
        Timestamp.now(),
      );
      transaction.set(memberRef, payload, {merge: true});
    });

    logger.info("Member upserted by an authenticated admin", {environment});
    res.status(200).json({
      ok: true,
      memberId,
      roles: input.roles,
      isActive: input.isActive,
      environment,
    });
  } catch (error) {
    sendHttpError(res, error);
  }
});

type ShiftSwapStoredShift = ShiftLike & {
  status: "planned" | "swap_pending" | "confirmed";
  source: string;
  ref: DocumentReference;
};

type StoredShiftSwapRequest = {
  id: string;
  requestedShiftId: string;
  requesterUserId: string;
  status: "open" | "cancelled" | "applied";
  candidates: ShiftSwapCandidateLike[];
  responses: ShiftSwapResponseLike[];
};

const toShiftSwapStoredShift = (
  snapshot: DocumentSnapshot,
): ShiftSwapStoredShift | null => {
  const record = toShiftRecord(snapshot);
  if (!record) {
    return null;
  }
  return {
    id: record.id,
    type: record.type,
    dateMillis: record.date.toMillis(),
    assignedUserIds: record.assignedUserIds,
    helperUserId: record.helperUserId,
    status: record.status,
    source: record.source,
    ref: snapshot.ref,
  };
};

const parseShiftSwapCandidates = (
  value: unknown,
): ShiftSwapCandidateLike[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    const candidate = parseBody(item);
    const userId = parseString(candidate.userId);
    const shiftId = parseString(candidate.shiftId);
    return userId && shiftId ? [{userId, shiftId}] : [];
  });
};

const parseShiftSwapResponses = (
  value: unknown,
): ShiftSwapResponseLike[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    const response = parseBody(item);
    const userId = parseString(response.userId);
    const shiftId = parseString(response.shiftId);
    const status = parseString(response.status)?.toLowerCase();
    const respondedAt = response.respondedAt;
    if (
      !userId ||
      !shiftId ||
      (status !== "available" && status !== "unavailable") ||
      !(respondedAt instanceof Timestamp)
    ) {
      return [];
    }
    return [{
      userId,
      shiftId,
      status,
      respondedAtMillis: respondedAt.toMillis(),
    }];
  });
};

const toStoredShiftSwapRequest = (
  snapshot: DocumentSnapshot,
): StoredShiftSwapRequest | null => {
  if (!snapshot.exists) {
    return null;
  }
  const data = parseBody(snapshot.data());
  const requestedShiftId = parseString(data.requestedShiftId);
  const requesterUserId = parseString(data.requesterUserId);
  const status = parseString(data.status)?.toLowerCase();
  if (
    !requestedShiftId ||
    !requesterUserId ||
    (status !== "open" && status !== "cancelled" && status !== "applied")
  ) {
    return null;
  }
  return {
    id: snapshot.id,
    requestedShiftId,
    requesterUserId,
    status,
    candidates: parseShiftSwapCandidates(data.candidates),
    responses: parseShiftSwapResponses(data.responses),
  };
};

const serializeShiftSwapResponses = (
  responses: ShiftSwapResponseLike[],
): Record<string, unknown>[] => responses.map((response) => ({
  userId: response.userId,
  shiftId: response.shiftId,
  status: response.status,
  respondedAt: Timestamp.fromMillis(
    response.respondedAtMillis,
  ),
}));

const setShiftSwapNotification = (
  transaction: Transaction,
  environment: AppEnvironment,
  payload: {
    title: string;
    body: string;
    type: string;
    target: "all" | "users";
    userIds?: string[];
    createdBy: string;
    sentAt: Timestamp;
  },
): void => {
  const eventRef = firestore
    .collection(`${environment}/plus-collections/notificationEvents`)
    .doc();
  transaction.create(eventRef, {
    title: payload.title,
    body: payload.body,
    type: payload.type,
    target: payload.target,
    targetPayload: payload.target === "users" ? {
      userIds: payload.userIds || [],
    } : {},
    createdBy: payload.createdBy,
    sentAt: payload.sentAt,
  });
};

const requireOpenShiftSwapRequest = (
  snapshot: DocumentSnapshot,
): StoredShiftSwapRequest => {
  const request = toStoredShiftSwapRequest(snapshot);
  if (!request) {
    throw new HttpRequestError(
      404,
      "shift_swap_not_found",
      "Shift swap request was not found",
    );
  }
  if (request.status !== "open") {
    throw new HttpRequestError(
      409,
      "shift_swap_closed",
      "Shift swap request is already closed",
    );
  }
  return request;
};

export const transitionShiftSwap = onRequest(async (req, res) => {
  try {
    requirePostMethod(req.method);
    const input = parseShiftSwapTransitionInput(req.body);
    const identity = await verifyRequestIdentity(req);
    const actor = await requireLinkedMember(input.environment, identity);
    const requests = firestore.collection(
      `${input.environment}/plus-collections/shiftSwapRequests`,
    );
    const shifts = shiftsCollection(input.environment);
    const now = Timestamp.now();
    const requestId = input.action === "create" ?
      requests.doc().id :
      input.requestId;
    let candidateCount: number | undefined;

    if (input.action === "create") {
      const requestRef = requests.doc(requestId);
      await firestore.runTransaction(async (transaction) => {
        const [shiftSnapshot, activeUsersSnapshot] = await Promise.all([
          transaction.get(shifts),
          transaction.get(usersCollection(input.environment)
            .where("isActive", "==", true)),
        ]);
        const storedShifts = shiftSnapshot.docs
          .map(toShiftSwapStoredShift)
          .filter((shift): shift is ShiftSwapStoredShift => Boolean(shift));
        if (storedShifts.length !== shiftSnapshot.size) {
          throw new HttpRequestError(
            409,
            "invalid_shift_data",
            "Shift data must be repaired before creating a swap",
          );
        }
        const requestedShift = storedShifts.find((shift) =>
          shift.id === input.requestedShiftId
        );
        if (!requestedShift || (
          !requestedShift.assignedUserIds.includes(actor.memberId) &&
          requestedShift.helperUserId !== actor.memberId
        )) {
          throw new HttpRequestError(
            403,
            "shift_not_owned",
            "Only an assigned member can request a swap",
          );
        }
        if (requestedShift.dateMillis < now.toMillis()) {
          throw new HttpRequestError(
            409,
            "shift_in_past",
            "Past shifts cannot be swapped",
          );
        }
        const activeMemberIds = new Set(
          activeUsersSnapshot.docs.map((document) => document.id),
        );
        const candidates = buildShiftSwapCandidates(
          requestedShift,
          storedShifts,
          actor.memberId,
          now.toMillis(),
        ).filter((candidate) => activeMemberIds.has(candidate.userId));
        if (candidates.length === 0) {
          throw new HttpRequestError(
            409,
            "no_shift_swap_candidates",
            "No eligible shift-swap candidates are available",
          );
        }
        candidateCount = candidates.length;
        transaction.create(requestRef, {
          requestedShiftId: requestedShift.id,
          requesterUserId: actor.memberId,
          reason: input.reason || "",
          status: "open",
          candidates,
          responses: [],
          selectedCandidateUserId: null,
          selectedCandidateShiftId: null,
          requestedAt: now,
          confirmedAt: null,
          appliedAt: null,
        });
        setShiftSwapNotification(transaction, input.environment, {
          title: "Solicitud de cambio de turno",
          body: "Hay una nueva solicitud de cambio de turno.",
          type: "shift_swap_requested",
          target: "users",
          userIds: candidates.map((candidate) => candidate.userId),
          createdBy: actor.memberId,
          sentAt: now,
        });
      });
    } else if (input.action === "respond") {
      const requestRef = requests.doc(requestId);
      const candidateShiftRef = shifts.doc(input.candidateShiftId);
      await firestore.runTransaction(async (transaction) => {
        const [requestSnapshot, candidateShiftSnapshot] = await Promise.all([
          transaction.get(requestRef),
          transaction.get(candidateShiftRef),
        ]);
        const swapRequest = requireOpenShiftSwapRequest(requestSnapshot);
        const candidate = swapRequest.candidates.find((item) =>
          item.userId === actor.memberId &&
          item.shiftId === input.candidateShiftId
        );
        const candidateShift = toShiftSwapStoredShift(candidateShiftSnapshot);
        if (!candidate || !candidateShift ||
            !candidateShift.assignedUserIds.includes(actor.memberId)) {
          throw new HttpRequestError(
            403,
            "invalid_shift_swap_candidate",
            "Actor is not an eligible candidate",
          );
        }
        const responses = upsertShiftSwapResponse(swapRequest.responses, {
          userId: actor.memberId,
          shiftId: candidate.shiftId,
          status: input.response,
          respondedAtMillis: now.toMillis(),
        });
        transaction.update(requestRef, {
          responses: serializeShiftSwapResponses(responses),
        });
        setShiftSwapNotification(transaction, input.environment, {
          title: input.response === "available" ?
            "Socio disponible para cambio" :
            "Socio no disponible para cambio",
          body: input.response === "available" ?
            "Un socio puede realizar el cambio solicitado." :
            "Un socio no puede realizar el cambio solicitado.",
          type: input.response === "available" ?
            "shift_swap_available" :
            "shift_swap_unavailable",
          target: "users",
          userIds: [swapRequest.requesterUserId],
          createdBy: actor.memberId,
          sentAt: now,
        });
      });
    } else if (input.action === "cancel") {
      const requestRef = requests.doc(requestId);
      await firestore.runTransaction(async (transaction) => {
        const requestSnapshot = await transaction.get(requestRef);
        const swapRequest = requireOpenShiftSwapRequest(requestSnapshot);
        if (swapRequest.requesterUserId !== actor.memberId) {
          throw new HttpRequestError(
            403,
            "shift_swap_requester_required",
            "Only the requester can cancel this swap",
          );
        }
        transaction.update(requestRef, {status: "cancelled"});
      });
    } else {
      const requestRef = requests.doc(requestId);
      await firestore.runTransaction(async (transaction) => {
        const [requestSnapshot, shiftSnapshot] = await Promise.all([
          transaction.get(requestRef),
          transaction.get(shifts),
        ]);
        const swapRequest = requireOpenShiftSwapRequest(requestSnapshot);
        if (swapRequest.requesterUserId !== actor.memberId) {
          throw new HttpRequestError(
            403,
            "shift_swap_requester_required",
            "Only the requester can apply this swap",
          );
        }
        const candidate = swapRequest.candidates.find((item) =>
          item.shiftId === input.candidateShiftId
        );
        if (!candidate || !swapRequest.responses.some((response) =>
          response.userId === candidate.userId &&
          response.shiftId === candidate.shiftId &&
          response.status === "available"
        )) {
          throw new HttpRequestError(
            409,
            "available_response_required",
            "The selected candidate has not accepted this swap",
          );
        }
        const storedShifts = shiftSnapshot.docs
          .map(toShiftSwapStoredShift)
          .filter((shift): shift is ShiftSwapStoredShift => Boolean(shift));
        if (storedShifts.length !== shiftSnapshot.size) {
          throw new HttpRequestError(
            409,
            "invalid_shift_data",
            "Shift data must be repaired before applying a swap",
          );
        }
        const requestedShift = storedShifts.find((shift) =>
          shift.id === swapRequest.requestedShiftId
        );
        const candidateShift = storedShifts.find((shift) =>
          shift.id === candidate.shiftId
        );
        if (!requestedShift || !candidateShift) {
          throw new HttpRequestError(
            409,
            "shift_not_found",
            "A shift in this request no longer exists",
          );
        }
        const [requesterSnapshot, candidateMemberSnapshot] =
          await transaction.getAll(
            usersCollection(input.environment)
              .doc(swapRequest.requesterUserId),
            usersCollection(input.environment).doc(candidate.userId),
          );
        assertActiveShiftSwapParticipants(
          requesterSnapshot.data(),
          candidateMemberSnapshot.data(),
        );
        const applyNow = Timestamp.now();
        assertShiftSwapTimingEligible(
          requestedShift,
          candidateShift,
          applyNow.toMillis(),
        );
        const [swappedRequested, swappedCandidate] = applyMemberSwap(
          requestedShift,
          candidateShift,
          swapRequest.requesterUserId,
          candidate.userId,
        );
        const replaced = storedShifts.map((shift) => {
          if (shift.id === swappedRequested.id) {
            return swappedRequested;
          }
          if (shift.id === swappedCandidate.id) {
            return swappedCandidate;
          }
          return shift;
        });
        const recomputed = recomputeDeliveryHelpers(replaced);
        const changedShifts = recomputed.filter((shift, index) => {
          const original = storedShifts[index];
          const assignmentsChanged =
            shift.assignedUserIds.length !== original.assignedUserIds.length ||
            shift.assignedUserIds.some((userId, assignmentIndex) =>
              userId !== original.assignedUserIds[assignmentIndex]
            );
          const helperChanged = shift.helperUserId !== original.helperUserId;
          return assignmentsChanged || helperChanged;
        });
        await requireShiftPlanningNotificationResourcesWritable(
          transaction,
          input.environment,
          changedShifts.map((shift) => ({
            scope: "shift",
            resourceId: shift.id,
          })),
          applyNow,
        );
        changedShifts.forEach((shift) => {
          transaction.update(shift.ref, {
            assignedUserIds: shift.assignedUserIds,
            helperUserId: shift.helperUserId,
            status: "confirmed",
            source: "app",
            updatedAt: applyNow,
          });
        });
        transaction.update(requestRef, {
          status: "applied",
          selectedCandidateUserId: candidate.userId,
          selectedCandidateShiftId: candidate.shiftId,
          confirmedAt: applyNow,
          appliedAt: applyNow,
        });
        setShiftSwapNotification(transaction, input.environment, {
          title: "Cambio de turno confirmado",
          body: "Se ha aplicado un cambio de turno.",
          type: "shift_swap_applied",
          target: "all",
          createdBy: actor.memberId,
          sentAt: applyNow,
        });
      });
    }

    logger.info("Authenticated shift-swap transition completed", {
      environment: input.environment,
      action: input.action,
    });
    res.status(200).json({
      ok: true,
      environment: input.environment,
      action: input.action,
      requestId,
      ...(candidateCount === undefined ? {} : {candidateCount}),
    });
  } catch (error) {
    sendHttpError(res, error);
  }
});

export const validateGlobalVersionPolicy = onRequest(async (req, res) => {
  try {
    const targetEnvs = parseAdminTargetEnvironments(req);
    await requireAdminForTargets(req, targetEnvs);
    const summary: {environment: AppEnvironment; existed: boolean}[] = [];

    for (const environment of targetEnvs) {
      const globalDoc = firestore
        .collection(`${environment}/plus-collections/config`)
        .doc("global");
      const publicDoc = firestore
        .collection(`${environment}/plus-collections/config`)
        .doc("public");
      const snapshot = await globalDoc.get();
      const current = parseBody(snapshot.data());
      const versions = sanitizeVersionPolicies(current.versions);
      const batch = firestore.batch();
      batch.set(globalDoc, {versions}, {merge: true});
      batch.set(publicDoc, {versions}, {merge: false});
      await batch.commit();
      summary.push({environment, existed: snapshot.exists});
    }

    logger.info("Global and public version policies validated", {summary});
    res.status(200).json({ok: true, summary});
  } catch (error) {
    sendHttpError(res, error);
  }
});

export const validateGlobalFreshnessConfig = onRequest(async (req, res) => {
  try {
    const targetEnvs = parseAdminTargetEnvironments(req);
    await requireAdminForTargets(req, targetEnvs);
    const summary: {environment: AppEnvironment; existed: boolean}[] = [];
    const fallbackTimestamp = Timestamp.fromDate(
      new Date("2025-01-01T00:00:00Z"),
    );

    for (const environment of targetEnvs) {
      const globalDoc = firestore
        .collection(`${environment}/plus-collections/config`)
        .doc("global");
      const snapshot = await globalDoc.get();
      const current = parseBody(snapshot.data());
      const memberProjection = buildMemberConfigProjection(
        current,
        fallbackTimestamp,
      );
      const batch = firestore.batch();
      batch.set(globalDoc, {
        cacheExpirationMinutes: parsePositiveInteger(
          current.cacheExpirationMinutes,
          DEFAULT_CACHE_EXPIRATION_MINUTES,
        ),
        lastTimestamps: sanitizeLastTimestamps(
          current.lastTimestamps,
          fallbackTimestamp,
        ),
      }, {merge: true});
      batch.set(
        globalDoc.parent.doc("member"),
        memberProjection,
        {merge: false},
      );
      await batch.commit();
      summary.push({environment, existed: snapshot.exists});
    }

    logger.info("Global freshness config validated", {summary});
    res.status(200).json({
      ok: true,
      summary,
      requiredCollections: REQUIRED_FRESHNESS_COLLECTIONS,
    });
  } catch (error) {
    sendHttpError(res, error);
  }
});

export const cloneGlobalConfig = onRequest(async (req, res) => {
  try {
    await requireAdminForTargets(req, ["develop", "production"]);
    const sourceDoc = firestore
      .collection("develop/plus-collections/config")
      .doc("global");
    const targetDoc = firestore
      .collection("production/plus-collections/config")
      .doc("global");
    const targetPublicDoc = firestore
      .collection("production/plus-collections/config")
      .doc("public");
    const targetMemberDoc = firestore
      .collection("production/plus-collections/config")
      .doc("member");
    const baseTimestamp = Timestamp.fromDate(
      new Date("2025-01-01T00:00:00Z"),
    );
    const snapshot = await sourceDoc.get();
    if (!snapshot.exists || !snapshot.data()) {
      throw new HttpRequestError(
        404,
        "source_config_not_found",
        "Develop config/global does not exist",
      );
    }
    const data = snapshot.data() as Record<string, unknown>;
    const versions = sanitizeVersionPolicies(data.versions);
    const overridden = {
      ...data,
      cacheExpirationMinutes: parsePositiveInteger(
        data.cacheExpirationMinutes,
        DEFAULT_CACHE_EXPIRATION_MINUTES,
      ),
      versions,
      lastTimestamps: sanitizeLastTimestamps(
        data.lastTimestamps,
        baseTimestamp,
      ),
    };
    const batch = firestore.batch();
    batch.set(targetDoc, overridden, {merge: true});
    batch.set(targetPublicDoc, {versions}, {merge: false});
    batch.set(
      targetMemberDoc,
      buildMemberConfigProjection(overridden, baseTimestamp),
      {merge: false},
    );
    await batch.commit();
    logger.info("Develop global config copied to production");
    res.status(200).json({
      ok: true,
      sourceEnvironment: "develop",
      targetEnvironment: "production",
    });
  } catch (error) {
    sendHttpError(res, error);
  }
});
