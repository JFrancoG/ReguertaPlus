import {setGlobalOptions} from "firebase-functions/v2";
import {onRequest} from "firebase-functions/v2/https";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {logger, config} from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

setGlobalOptions({
  region: "europe-west1",
  concurrency: 1,
  cpu: 1,
  memory: "256MiB",
  timeoutSeconds: 60,
});

let ENV = "develop";
try {
  ENV = config().app?.env || "develop";
} catch {
  ENV = "develop";
}

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

const VERSION_STRING_REGEX = /^\d+(?:\.\d+)*$/;
const DEFAULT_VERSION_POLICY_ENVS = ["local", "develop", "production"];
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

export const onNotificationEventCreated = onDocumentCreated(
  "{env}/plus-collections/notificationEvents/{eventId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      return;
    }

    const env = event.params.env;
    const eventId = event.params.eventId;
    const payload = parseNotificationDispatchPayload(
      parseBody(snapshot.data())
    );
    if (!payload) {
      logger.warn(
        "Skipping notification dispatch due to malformed payload",
        {env, eventId}
      );
      return;
    }

    const targetUserIds = await resolveTargetUserIds(env, payload);
    const tokens = await resolveDeviceTokens(env, targetUserIds);
    const eventRef = snapshot.ref;

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
