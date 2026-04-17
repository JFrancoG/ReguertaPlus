import {setGlobalOptions} from "firebase-functions/v2";
import {onRequest} from "firebase-functions/v2/https";
import {
  onDocumentCreated,
  onDocumentWritten,
} from "firebase-functions/v2/firestore";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {logger} from "firebase-functions";
import * as admin from "firebase-admin";
import {google} from "googleapis";

admin.initializeApp();

setGlobalOptions({
  region: "europe-west1",
  concurrency: 1,
  cpu: 1,
  memory: "256MiB",
  timeoutSeconds: 60,
});

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

const firestore = admin.firestore();

const updateTimestamp = async (env: string, collectionName: string) => {
  const now = admin.firestore.Timestamp.now();
  await firestore
    .collection(`${env}/collections/config`)
    .doc("global")
    .set({
      lastTimestamps: {
        [collectionName]: now,
      },
    }, {merge: true});
};

const parseBody = (value: unknown): Record<string, unknown> => {
  if (value !== null && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
};

const usersCollection = (env: string) =>
  firestore.collection(`${env}/collections/users`);

const plusUsersCollection = (env: string) =>
  firestore.collection(`${env}/plus-collections/users`);

const deliveryCalendarCollection = (env: string) =>
  firestore.collection(`${env}/plus-collections/deliveryCalendar`);

const globalConfigDocRefs = (env: string) => [
  firestore.collection(`${env}/collections/config`).doc("global"),
  firestore.collection(`${env}/plus-collections/config`).doc("global"),
];

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const parseString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

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

const isAdminRecord = (data: Record<string, unknown>): boolean => {
  const isActive = data.isActive !== false;
  const roles = parseRoles(data.roles);
  return isActive && roles.includes("admin");
};

const buildMemberId = (normalizedEmail: string): string => {
  const sanitized = normalizedEmail
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const suffix = sanitized.length > 0 ? sanitized.slice(0, 40) : "member";
  return `member_${suffix}`;
};

type VersionPlatformKey = "android" | "ios";

type VersionPolicy = {
  current: string;
  min: string;
  forceUpdate: boolean;
  storeUrl: string;
};

type DeliveryCalendarOverrideMap = Map<string, admin.firestore.Timestamp>;

const VERSION_STRING_REGEX = /^\d+(?:\.\d+)*$/;
const DEFAULT_VERSION_POLICY_ENVS = ["local", "develop", "production"];
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
  fallback: admin.firestore.Timestamp,
): Record<string, admin.firestore.Timestamp> => {
  const source = parseBody(value);

  return Object.fromEntries(
    REQUIRED_FRESHNESS_COLLECTIONS.map((collection) => {
      const rawValue = source[collection];
      const timestamp = rawValue instanceof admin.firestore.Timestamp ?
        rawValue :
        fallback;
      return [collection, timestamp];
    })
  );
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
        (snapshot) => snapshot.exists && snapshot.get("isActive") !== false
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

const resolveDeviceTokens = async (
  env: string,
  userIds: string[],
): Promise<string[]> => {
  const uniqueTokens = new Set<string>();
  const collection = plusUsersCollection(env);

  for (const userId of userIds) {
    const devicesSnapshot = await collection
      .doc(userId)
      .collection("devices")
      .get();
    for (const deviceDoc of devicesSnapshot.docs) {
      const token = parseString(deviceDoc.get("fcmToken"));
      if (token) {
        uniqueTokens.add(token);
      }
    }
  }

  return Array.from(uniqueTokens);
};

const resolveDeviceTokensByUser = async (
  env: string,
  userId: string,
): Promise<string[]> => {
  const uniqueTokens = new Set<string>();
  const devicesSnapshot = await plusUsersCollection(env)
    .doc(userId)
    .collection("devices")
    .get();

  for (const deviceDoc of devicesSnapshot.docs) {
    const token = parseString(deviceDoc.get("fcmToken"));
    if (token) {
      uniqueTokens.add(token);
    }
  }

  return Array.from(uniqueTokens);
};

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
  referenceNow?: admin.firestore.Timestamp;
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
    markerRef: admin.firestore.DocumentReference;
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
  responses: admin.messaging.SendResponse[],
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
  referenceNow: admin.firestore.Timestamp = admin.firestore.Timestamp.now(),
): admin.firestore.Timestamp => {
  const baseDelayMinutes = parseOrderReminderRetryBaseDelayMinutes();
  const backoffMultiplier = 2 ** Math.max(0, attemptNumber - 1);
  const delayMs = baseDelayMinutes * backoffMultiplier * 60 * 1000;
  return admin.firestore.Timestamp.fromMillis(
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
  referenceNow: admin.firestore.Timestamp = admin.firestore.Timestamp.now(),
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
      const nextRetryAt = markerData.nextRetryAt instanceof admin
        .firestore.Timestamp ? markerData.nextRetryAt : null;
      const lastAttemptAt = markerData.lastAttemptAt instanceof admin
        .firestore.Timestamp ? markerData.lastAttemptAt : null;

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
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
        lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        nextRetryAt: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
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
  markerRef: admin.firestore.DocumentReference,
  patch: Record<string, unknown>,
): Promise<void> => {
  await markerRef.set({
    ...patch,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
};

const dispatchOrderReminderToUser = async (
  env: string,
  eventId: string,
  payload: NotificationDispatchPayload,
  context: OrderReminderEventContext,
  userId: string,
  triggerSource: "event" | "retry_scheduler",
  referenceNow: admin.firestore.Timestamp = admin.firestore.Timestamp.now(),
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

  const tokens = await resolveDeviceTokensByUser(env, userId);
  if (tokens.length === 0) {
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

  let deliveredTokensCount = 0;
  let failedTokensCount = 0;
  const tokenResponses: admin.messaging.SendResponse[] = [];
  for (const tokenChunk of chunkArray(tokens, 500)) {
    const response = await admin.messaging().sendEachForMulticast({
      tokens: tokenChunk,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        eventId,
        type: payload.type,
        target: payload.target,
        userId,
        weekKey: context.weekKey,
        reminderSlotHour: String(context.reminderHour),
        triggerSource,
      },
    });
    deliveredTokensCount += response.successCount;
    failedTokensCount += response.failureCount;
    tokenResponses.push(...response.responses);
  }

  const failureSummary = summarizeMessagingFailureResponses(tokenResponses);
  if (deliveredTokensCount > 0) {
    await finalizeOrderReminderDispatchMarker(dispatchClaim.markerRef, {
      status: "sent",
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
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

  if (value instanceof admin.firestore.DocumentReference) {
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
    `${env}/collections/seasonalCommitments`,
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
  return data.confirmedAt instanceof admin.firestore.Timestamp;
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
    `${env}/collections/orders`,
  ];

  for (const collectionPath of orderCollectionPaths) {
    const collection = firestore.collection(collectionPath);
    const [byWeekKeySnapshot, byWeekNumberSnapshot] = await Promise.all([
      collection.where("weekKey", "==", weekKey).get(),
      collection.where("week", "==", weekNumber).get(),
    ]);

    const docsById = new Map<string, admin.firestore.QueryDocumentSnapshot>();
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
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
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
  const referenceNow = options.referenceNow || admin.firestore.Timestamp.now();
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
  eventRef: admin.firestore.DocumentReference,
): Promise<void> => {
  const targetUserIds = await resolveTargetUserIds(env, payload);
  const tokens = await resolveDeviceTokens(env, targetUserIds);

  if (tokens.length === 0) {
    await eventRef.set({
      dispatch: {
        attemptedAt: admin.firestore.FieldValue.serverTimestamp(),
        dispatchedAt: null,
        resolvedUsersCount: targetUserIds.length,
        deliveredTokensCount: 0,
        failedTokensCount: 0,
        status: "no_tokens",
      },
    }, {merge: true});
    logger.warn(
      "Notification dispatch skipped because no device tokens were found",
      {
        env,
        eventId,
        target: payload.target,
        resolvedUsersCount: targetUserIds.length,
      }
    );
    return;
  }

  let deliveredTokensCount = 0;
  let failedTokensCount = 0;

  for (const tokenChunk of chunkArray(tokens, 500)) {
    const response = await admin.messaging().sendEachForMulticast({
      tokens: tokenChunk,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        eventId,
        type: payload.type,
        target: payload.target,
      },
    });

    deliveredTokensCount += response.successCount;
    failedTokensCount += response.failureCount;
  }

  await eventRef.set({
    dispatch: {
      attemptedAt: admin.firestore.FieldValue.serverTimestamp(),
      dispatchedAt: admin.firestore.FieldValue.serverTimestamp(),
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
  eventRef: admin.firestore.DocumentReference,
): Promise<boolean> => {
  const reminderContext = parseOrderReminderEventContext(eventId, eventData);
  if (!reminderContext) {
    logger.warn("Order reminder event context is missing. Falling back.", {
      env,
      eventId,
    });
    return false;
  }

  const targetUserIds = await resolveTargetUserIds(env, payload);
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
      attemptedAt: admin.firestore.FieldValue.serverTimestamp(),
      dispatchedAt: admin.firestore.FieldValue.serverTimestamp(),
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
  const referenceNow = admin.firestore.Timestamp.now();
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
        admin.firestore.Timestamp ? markerData.nextRetryAt : null;

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
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
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
  date: admin.firestore.Timestamp;
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
  date: admin.firestore.Timestamp;
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
  requestedAt: admin.firestore.Timestamp;
  status: ShiftPlanningRequestStatus;
};

type PlanningMemberRef = MemberSheetRef & {
  roles: string[];
  producerCatalogEnabled: boolean;
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
  timestamp: admin.firestore.Timestamp,
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

const timestampToSheetDate = (timestamp: admin.firestore.Timestamp): string => {
  const {year, month, day} = timestampToZonedDateParts(timestamp);
  const paddedMonth = String(month).padStart(2, "0");
  const paddedDay = String(day).padStart(2, "0");
  return `${year}-${paddedMonth}-${paddedDay}`;
};

const buildShiftId = (
  type: ShiftType,
  timestamp: admin.firestore.Timestamp,
): string =>
  `shift_${type}_${timestampToSheetDate(timestamp).replace(/-/g, "")}`;

const buildShiftRowKey = (
  type: ShiftType,
  timestamp: admin.firestore.Timestamp,
): string => `${type}:${timestampToSheetDate(timestamp)}`;

const parseDateInput = (value: unknown): admin.firestore.Timestamp | null => {
  const text = parseString(value);
  if (!text) {
    return null;
  }

  const dayMonthYear = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dayMonthYear) {
    const [, day, month, year] = dayMonthYear;
    const millis = Date.UTC(Number(year), Number(month) - 1, Number(day));
    return admin.firestore.Timestamp.fromMillis(millis);
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
      return admin.firestore.Timestamp.fromMillis(millis);
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
  date: admin.firestore.Timestamp,
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
  let currentDate: admin.firestore.Timestamp | null = null;
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
  env: string,
  rows: NormalizedShiftSheetRow[],
): Promise<number> => {
  const collection = firestore.collection(`${env}/plus-collections/shifts`);
  const importedAt = admin.firestore.FieldValue.serverTimestamp();
  const importedIds = rows.map((row) => row.shiftId);
  let writes = 0;

  for (const row of rows) {
    const ref = collection.doc(row.shiftId);
    const existing = await ref.get();
    const existingCreatedAt = existing.get("createdAt");
    await ref.set({
      type: row.type,
      date: row.date,
      assignedUserIds: row.assignedUserIds,
      helperUserId: row.helperUserId,
      status: row.status,
      source: row.source,
      createdAt: existingCreatedAt instanceof admin.firestore.Timestamp ?
        existingCreatedAt :
        admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      syncMeta: {
        origin: "google_sheets",
        rowKey: row.rowKey,
        rowNumber: row.rowNumber,
        sheetName: row.sheetName,
        importedAt,
      },
    }, {merge: true});
    writes += 1;
  }

  const staleSnapshot = await collection
    .where("source", "==", "google_sheets")
    .get();
  const staleDocs = staleSnapshot.docs.filter((doc) =>
    !importedIds.includes(doc.id)
  );
  while (staleDocs.length > 0) {
    const batch = firestore.batch();
    staleDocs.splice(0, 400).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }

  return writes;
};

const toShiftRecord = (
  snapshot: admin.firestore.DocumentSnapshot,
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
    !(date instanceof admin.firestore.Timestamp) ||
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
  timestamp: admin.firestore.Timestamp,
): string => {
  const {year, month, day} = timestampToZonedDateParts(timestamp);
  return `${day}/${month}/${year}`;
};

const formatHumanLongDate = (
  timestamp: admin.firestore.Timestamp,
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
  timestamp: admin.firestore.Timestamp,
): string => {
  const formatter = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
    timeZone: SHEET_TIME_ZONE,
  });
  return formatter.format(timestamp.toDate()).toUpperCase();
};

const isoWeekNumber = (
  timestamp: admin.firestore.Timestamp,
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
  timestamp: admin.firestore.Timestamp,
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
): admin.firestore.Timestamp => {
  if (shift.type !== "delivery") {
    return shift.date;
  }
  return overrides.get(timestampToIsoWeekKey(shift.date)) || shift.date;
};

const readDeliveryCalendarOverrideMap = async (
  env: string,
): Promise<DeliveryCalendarOverrideMap> => {
  const snapshot = await deliveryCalendarCollection(env).get();
  const overrides = new Map<string, admin.firestore.Timestamp>();
  snapshot.docs.forEach((doc) => {
    const deliveryDate = doc.get("deliveryDate");
    if (deliveryDate instanceof admin.firestore.Timestamp) {
      overrides.set(doc.id, deliveryDate);
    }
  });
  return overrides;
};

const toDeliveryHumanRow = (
  shift: FirestoreShiftRecord,
  membersById: Map<string, MemberSheetRef>,
  effectiveDate: admin.firestore.Timestamp,
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

const parseShiftPlanningRequest = (
  snapshot: admin.firestore.DocumentSnapshot,
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
    !(requestedAt instanceof admin.firestore.Timestamp) ||
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
  type === "delivery" ? "reparto" : "mercadillo";

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

const timestampFromUtcDate = (date: Date): admin.firestore.Timestamp =>
  admin.firestore.Timestamp.fromDate(new Date(Date.UTC(
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

const listActivePlanningMembers = async (
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
        roles: parseRoles(doc.get("roles")),
        producerCatalogEnabled:
          doc.get("producerCatalogEnabled") !== false,
        createdAtMillis: createdAt instanceof admin.firestore.Timestamp ?
          createdAt.toMillis() :
          0,
        updatedAtMillis: updatedAt instanceof admin.firestore.Timestamp ?
          updatedAt.toMillis() :
          0,
      };
    })
    .filter((member) =>
      !(member.roles.includes("producer") && member.producerCatalogEnabled)
    );
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
): admin.firestore.Timestamp[] => {
  const start = new Date(Date.UTC(seasonStartYear, 8, 1));
  const end = new Date(Date.UTC(seasonStartYear + 1, 5, 30));
  const targetDay = weekdayWireValueToUtcDay(deliveryWeekdayWireValue);
  const offset = (targetDay - start.getUTCDay() + 7) % 7;
  const firstDate = addUtcDays(start, offset);
  const results: admin.firestore.Timestamp[] = [];

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
): admin.firestore.Timestamp => {
  const firstDay = new Date(Date.UTC(year, monthIndex, 1));
  const firstSaturdayOffset = (6 - firstDay.getUTCDay() + 7) % 7;
  const thirdSaturday = addUtcDays(firstDay, firstSaturdayOffset + 14);
  return timestampFromUtcDate(thirdSaturday);
};

const buildMarketSeasonDates = (
  seasonStartYear: number,
): admin.firestore.Timestamp[] => {
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
  env: string,
  requestId: string,
  shifts: FirestoreShiftRecord[],
): Promise<number> => {
  const collection = shiftsCollection(env);
  let writes = 0;

  for (const shift of shifts) {
    const ref = collection.doc(shift.id);
    const existing = await ref.get();
    const existingCreatedAt = existing.get("createdAt");
    await ref.set({
      type: shift.type,
      date: shift.date,
      assignedUserIds: shift.assignedUserIds,
      helperUserId: shift.helperUserId,
      status: shift.status,
      source: shift.source,
      createdAt: existingCreatedAt instanceof admin.firestore.Timestamp ?
        existingCreatedAt :
        admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      planningMeta: {
        requestId,
        seasonLabel:
          shift.syncSheetName?.replace(/^turnos-(reparto|mercado)\s+/i, "") ||
          null,
      },
      syncMeta: {
        origin: "planner",
        sheetName: shift.syncSheetName,
      },
    }, {merge: true});
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
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
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
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
  });
};

const formatNotificationDate = (
  timestamp: admin.firestore.Timestamp,
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
  nextDate: admin.firestore.Timestamp | null,
  previousDate: admin.firestore.Timestamp | null,
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
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
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

const parseEnvParam = (
  value: unknown,
  fallback: string = ENV,
): string => parseString(value) || fallback;

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
  env: string,
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

export const onNotificationEventCreated = onDocumentCreated(
  "{env}/plus-collections/notificationEvents/{eventId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      return;
    }

    const env = event.params.env;
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
    if (payload.type === ORDER_REMINDER_TYPE) {
      const handledAsOrderReminder = await dispatchOrderReminderEvent(
        env,
        eventId,
        eventData,
        payload,
        eventRef
      );
      if (handledAsOrderReminder) {
        return;
      }
    }

    await dispatchNotificationEventGeneric(env, eventId, payload, eventRef);
  }
);

export const syncShiftsFromGoogleSheets = onRequest(async (req, res) => {
  const env = parseEnvParam(req.query.env);

  try {
    const summary = await syncShiftsFromGoogleSheetsInternal(env);
    logger.info("✅ Shifts synced from Google Sheets", {env, ...summary});
    res.status(200).json({
      ok: true,
      env,
      ...summary,
    });
  } catch (error) {
    logger.error("❌ Failed to sync shifts from Google Sheets", {
      env,
      error,
    });
    res.status(500).json({
      ok: false,
      env,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export const exportShiftsToGoogleSheets = onRequest(async (req, res) => {
  const env = parseEnvParam(req.query.env);

  try {
    const summary = await exportAllShiftsToGoogleSheets(env);
    logger.info("✅ Shifts exported to Google Sheets", {env, ...summary});
    res.status(200).json({
      ok: true,
      env,
      ...summary,
    });
  } catch (error) {
    logger.error("❌ Failed to export shifts to Google Sheets", {
      env,
      error,
    });
    res.status(500).json({
      ok: false,
      env,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

const processShiftPlanningRequest = async (
  env: string,
  request: ShiftPlanningRequestRecord,
): Promise<{
  seasonLabel: string;
  sheetName: string;
  generatedCount: number;
}> => {
  const seasonStartYear = targetSeasonStartYearFromNow();
  const seasonLabel = buildSeasonLabel(seasonStartYear);
  const existingShifts = await readAllShifts(env);
  const activeMembers = await listActivePlanningMembers(env);

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

export const onShiftPlanningRequestCreated = onDocumentCreated(
  "{env}/plus-collections/shiftPlanningRequests/{requestId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      return;
    }

    const env = event.params.env;
    const request = parseShiftPlanningRequest(snapshot);
    if (!request || request.status !== "requested") {
      logger.warn("Skipping malformed shift planning request", {
        env,
        requestId: event.params.requestId,
      });
      return;
    }

    await snapshot.ref.set({
      status: "processing",
      processingStartedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});

    try {
      const summary = await processShiftPlanningRequest(env, request);
      await snapshot.ref.set({
        status: "completed",
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
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
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
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

export const onShiftWritten = onDocumentWritten(
  "{env}/plus-collections/shifts/{shiftId}",
  async (event) => {
    const afterSnapshot = event.data?.after;
    if (!afterSnapshot?.exists) {
      return;
    }

    const env = event.params.env;
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
        exportedAt: admin.firestore.FieldValue.serverTimestamp(),
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

export const onDeliveryCalendarOverrideWritten = onDocumentWritten(
  "{env}/plus-collections/deliveryCalendar/{weekKey}",
  async (event) => {
    const env = event.params.env;
    const weekKey = event.params.weekKey;
    const beforeSnapshot = event.data?.before;
    const afterSnapshot = event.data?.after;
    const previousDate = beforeSnapshot?.exists &&
      beforeSnapshot.get("deliveryDate") instanceof admin.firestore.Timestamp ?
      beforeSnapshot.get("deliveryDate") as admin.firestore.Timestamp :
      null;
    const nextDate = afterSnapshot?.exists &&
      afterSnapshot.get("deliveryDate") instanceof admin.firestore.Timestamp ?
      afterSnapshot.get("deliveryDate") as admin.firestore.Timestamp :
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

export const onProductWrite = onRequest(async (req, res) => {
  const env = (req.query.env as string) || ENV;
  const collectionName = (req.query.collectionName ?? "products") as string;
  await updateTimestamp(env, collectionName);
  logger.info(
    `🟢 HTTP timestamp updated for: ${collectionName}, env: ${env}`
  );
  res.status(200).send(`Timestamp updated for: ${collectionName}, env: ${env}`);
});

export const onContainerWrite = onRequest(async (req, res) => {
  const env = (req.query.env as string) || ENV;
  await updateTimestamp(env, "containers");
  logger.info(`🟢 HTTP timestamp updated for: containers, env: ${env}`);
  res.status(200).send(`Timestamp updated for: containers, env: ${env}`);
});

export const onMeasureWrite = onRequest(async (req, res) => {
  const env = (req.query.env as string) || ENV;
  await updateTimestamp(env, "measures");
  logger.info(`🟢 HTTP timestamp updated for: measures, env: ${env}`);
  res.status(200).send(`Timestamp updated for: measures, env: ${env}`);
});

export const onUserWrite = onRequest(async (req, res) => {
  const env = (req.query.env as string) || ENV;
  await updateTimestamp(env, "users");
  logger.info(`🟢 HTTP timestamp updated for: users in env: ${env}`);
  res.status(200).send(`Timestamp updated for: users in env: ${env}`);
});

export const onOrderWrite = onRequest(async (req, res) => {
  const env = (req.query.env as string) || ENV;
  await updateTimestamp(env, "orders");
  logger.info(`🟢 HTTP timestamp updated for: orders in env: ${env}`);
  res.status(200).send(`Timestamp updated for: orders in env: ${env}`);
});

export const resolveAuthorizedMember = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({error: "Method Not Allowed"});
    return;
  }

  const body = parseBody(req.body);
  const env = parseString(body.env) || parseString(req.query.env) || ENV;
  const authUid = parseString(body.authUid);
  const rawEmail = parseString(body.email);
  const emailInput = rawEmail || parseString(body.normalizedEmail);

  if (!authUid || !emailInput) {
    res.status(400).json({error: "authUid and email are required"});
    return;
  }

  const normalizedEmail = normalizeEmail(emailInput);
  const collection = usersCollection(env);

  let memberQuery = await collection
    .where("normalizedEmail", "==", normalizedEmail)
    .limit(1)
    .get();

  if (memberQuery.empty) {
    memberQuery = await collection
      .where("emailNormalized", "==", normalizedEmail)
      .limit(1)
      .get();
  }

  if (memberQuery.empty && rawEmail) {
    memberQuery = await collection
      .where("email", "==", rawEmail)
      .limit(1)
      .get();
  }

  if (memberQuery.empty) {
    res.status(403).json({authorized: false, message: "Unauthorized user"});
    return;
  }

  const memberDoc = memberQuery.docs[0];
  const memberData = parseBody(memberDoc.data());

  if (memberData.isActive === false) {
    res.status(403).json({authorized: false, message: "Unauthorized user"});
    return;
  }

  const existingAuthUid = parseString(memberData.authUid);
  if (existingAuthUid && existingAuthUid !== authUid) {
    res.status(403).json({authorized: false, message: "Unauthorized user"});
    return;
  }

  const firstLoginLinked = !existingAuthUid;
  if (firstLoginLinked) {
    await memberDoc.ref.set({
      authUid,
      normalizedEmail,
      email: admin.firestore.FieldValue.delete(),
      emailNormalized: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
  }

  const roles = parseRoles(memberData.roles);
  res.status(200).json({
    authorized: true,
    memberId: memberDoc.id,
    roles,
    isActive: true,
    firstLoginLinked,
  });
});

export const upsertMemberByAdmin = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({error: "Method Not Allowed"});
    return;
  }

  const body = parseBody(req.body);
  const env = parseString(body.env) || parseString(req.query.env) || ENV;
  const actorAuthUid = parseString(body.actorAuthUid);
  const displayName = parseString(body.displayName);
  const normalizedEmailInput = parseString(body.normalizedEmail) ||
    parseString(body.email);

  if (!actorAuthUid || !displayName || !normalizedEmailInput) {
    res.status(400).json({
      error: "actorAuthUid, displayName and normalizedEmail are required",
    });
    return;
  }

  const normalizedEmail = normalizeEmail(normalizedEmailInput);
  const roles = parseRoles(body.roles);
  const isActive = parseBoolean(body.isActive, true);
  const producerCatalogEnabled = parseBoolean(
    body.producerCatalogEnabled,
    true
  );
  const requestedMemberId = parseString(body.memberId);

  const collection = usersCollection(env);
  const actorQuery = await collection
    .where("authUid", "==", actorAuthUid)
    .limit(1)
    .get();

  if (
    actorQuery.empty ||
    !isAdminRecord(parseBody(actorQuery.docs[0].data()))
  ) {
    res.status(403).json({error: "Only active admins can manage members"});
    return;
  }

  const memberId = requestedMemberId || buildMemberId(normalizedEmail);
  const memberRef = collection.doc(memberId);
  const memberSnapshot = await memberRef.get();
  const currentData = parseBody(memberSnapshot.data());

  const wasActiveAdmin = memberSnapshot.exists && isAdminRecord(currentData);
  const willBeActiveAdmin = isActive && roles.includes("admin");

  if (wasActiveAdmin && !willBeActiveAdmin) {
    const activeAdmins = await collection
      .where("isActive", "==", true)
      .where("roles", "array-contains", "admin")
      .get();

    if (activeAdmins.size <= 1) {
      res.status(409).json({
        error: "Cannot leave the app without active admins",
      });
      return;
    }
  }

  const payload: Record<string, unknown> = {
    displayName,
    normalizedEmail,
    email: admin.firestore.FieldValue.delete(),
    emailNormalized: admin.firestore.FieldValue.delete(),
    roles,
    isActive,
    producerCatalogEnabled,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (!memberSnapshot.exists) {
    payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
    payload.authUid = null;
  } else if (currentData.authUid !== undefined) {
    payload.authUid = currentData.authUid;
  }

  await memberRef.set(payload, {merge: true});

  logger.info(`✅ Member ${memberId} upserted by admin`, {env, actorAuthUid});
  res.status(200).json({
    ok: true,
    memberId,
    roles,
    isActive,
  });
});

export const validateGlobalVersionPolicy = onRequest(async (req, res) => {
  const envs = parseEnvList(req.query.envs ?? req.query.env);
  const targetEnvs = envs.length > 0 ? envs : DEFAULT_VERSION_POLICY_ENVS;
  const summary: {env: string; existed: boolean}[] = [];

  for (const env of targetEnvs) {
    const docRefs = globalConfigDocRefs(env);
    let existed = false;

    for (const globalDoc of docRefs) {
      const snapshot = await globalDoc.get();
      const current = parseBody(snapshot.data());
      const versions = sanitizeVersionPolicies(current.versions);

      await globalDoc.set({versions}, {merge: true});
      existed = existed || snapshot.exists;
    }

    summary.push({env, existed});
  }

  logger.info("✅ Global version policy validated", {summary});
  res.status(200).json({
    ok: true,
    summary,
  });
});

export const validateGlobalFreshnessConfig = onRequest(async (req, res) => {
  const envs = parseEnvList(req.query.envs ?? req.query.env);
  const targetEnvs = envs.length > 0 ? envs : DEFAULT_VERSION_POLICY_ENVS;
  const summary: {env: string; existed: boolean}[] = [];
  const fallbackTimestamp = admin.firestore.Timestamp.fromDate(
    new Date("2025-01-01T00:00:00Z")
  );

  for (const env of targetEnvs) {
    const docRefs = globalConfigDocRefs(env);
    let existed = false;

    for (const globalDoc of docRefs) {
      const snapshot = await globalDoc.get();
      const current = parseBody(snapshot.data());

      await globalDoc.set({
        cacheExpirationMinutes: parsePositiveInteger(
          current.cacheExpirationMinutes,
          DEFAULT_CACHE_EXPIRATION_MINUTES
        ),
        lastTimestamps: sanitizeLastTimestamps(
          current.lastTimestamps,
          fallbackTimestamp
        ),
      }, {merge: true});

      existed = existed || snapshot.exists;
    }

    summary.push({env, existed});
  }

  logger.info("✅ Global freshness config validated", {summary});
  res.status(200).json({
    ok: true,
    summary,
    requiredCollections: REQUIRED_FRESHNESS_COLLECTIONS,
  });
});

export const cloneGlobalConfig = onRequest(async (_req, res) => {
  const sourceDoc = firestore
    .collection("develop/collections/config")
    .doc("global");

  const targetDoc = firestore
    .collection("production/collections/config")
    .doc("global");

  const baseTimestamp = admin.firestore.Timestamp.fromDate(
    new Date("2025-01-01T00:00:00Z")
  );

  const snapshot = await sourceDoc.get();

  if (!snapshot.exists) {
    res.status(404).send("⚠️ Source config/global (develop) does not exist");
    return;
  }

  const data = snapshot.data();
  if (!data) {
    res.status(500).send("❌ No data found in source document");
    return;
  }

  const overridden = {
    ...data,
    cacheExpirationMinutes: parsePositiveInteger(
      data.cacheExpirationMinutes,
      DEFAULT_CACHE_EXPIRATION_MINUTES
    ),
    versions: sanitizeVersionPolicies(data.versions),
    lastTimestamps: sanitizeLastTimestamps(data.lastTimestamps, baseTimestamp),
  };

  await targetDoc.set(overridden, {merge: true});

  logger.info("✅ config/global copied to prod");
  res.status(200).send("✅ config/global copied");
});
