#!/usr/bin/env node

const admin = require("firebase-admin");
const {
  parseMigrationArgs,
} = require("./backfill-auth-links.cjs");

const VERSION_STRING_REGEX = /^\d+(?:\.\d+)*$/;
const REQUIRED_FRESHNESS_COLLECTIONS = [
  "products",
  "orderlines",
  "containers",
  "measures",
  "users",
  "orders",
];
const DEFAULT_VERSION_POLICIES = {
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

function asObject(value) {
  return value !== null && typeof value === "object" &&
    !Array.isArray(value) ? value : {};
}

function parseVersion(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim();
  return VERSION_STRING_REGEX.test(normalized) ? normalized : fallback;
}

function parseStoreUrl(value, fallback) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:" ?
      parsed.toString() : fallback;
  } catch {
    return fallback;
  }
}

function sanitizeVersionPolicy(value, fallback) {
  const source = asObject(value);
  return {
    current: parseVersion(source.current, fallback.current),
    min: parseVersion(source.min, fallback.min),
    forceUpdate: typeof source.forceUpdate === "boolean" ?
      source.forceUpdate : fallback.forceUpdate,
    storeUrl: parseStoreUrl(source.storeUrl, fallback.storeUrl),
  };
}

function extractPublicVersions(globalConfig) {
  const versions = globalConfig && typeof globalConfig === "object" ?
    globalConfig.versions :
    null;
  if (!versions || typeof versions !== "object" || Array.isArray(versions)) {
    throw new Error("config/global does not contain a versions map");
  }
  return {
    versions: {
      android: sanitizeVersionPolicy(
        versions.android,
        DEFAULT_VERSION_POLICIES.android,
      ),
      ios: sanitizeVersionPolicy(
        versions.ios,
        DEFAULT_VERSION_POLICIES.ios,
      ),
    },
  };
}

function extractMemberConfig(globalConfig, fallbackTimestamp) {
  const source = asObject(globalConfig);
  const otherConfig = asObject(source.otherConfig);
  const rawDay = [
    source.deliveryDayOfWeek,
    otherConfig.deliveryDayOfWeek,
  ].find((value) => typeof value === "string");
  const normalizedDay = typeof rawDay === "string" ?
    rawDay.trim().toUpperCase() :
    "";
  const deliveryDayOfWeek = [
    "MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN",
  ].includes(normalizedDay) ? normalizedDay : "WED";
  const rawExpiration = typeof source.cacheExpirationMinutes === "number" ?
    source.cacheExpirationMinutes :
    Number(source.cacheExpirationMinutes);
  const cacheExpirationMinutes = Number.isFinite(rawExpiration) &&
    rawExpiration > 0 ? Math.floor(rawExpiration) : 15;
  const sourceTimestamps = asObject(source.lastTimestamps);
  const lastTimestamps = Object.fromEntries(
    REQUIRED_FRESHNESS_COLLECTIONS.map((collection) => [
      collection,
      sourceTimestamps[collection] instanceof admin.firestore.Timestamp ?
        sourceTimestamps[collection] :
        fallbackTimestamp,
    ]),
  );
  return {cacheExpirationMinutes, lastTimestamps, deliveryDayOfWeek};
}

async function runPublicVersionsBackfill(options) {
  const app = admin.initializeApp({projectId: options.projectId});
  const firestore = app.firestore();
  const summary = {};
  const fallbackTimestamp = admin.firestore.Timestamp.fromDate(
    new Date("2025-01-01T00:00:00Z"),
  );
  for (const environment of options.environments) {
    const config = firestore.collection(
      `${environment}/plus-collections/config`,
    );
    const globalSnapshot = await config.doc("global").get();
    if (!globalSnapshot.exists) {
      summary[environment] = {
        globalMissing: 1,
        plannedWrites: 0,
        appliedWrites: 0,
      };
      continue;
    }
    const publicPayload = extractPublicVersions(globalSnapshot.data());
    const memberPayload = extractMemberConfig(
      globalSnapshot.data(),
      fallbackTimestamp,
    );
    if (options.apply) {
      const batch = firestore.batch();
      batch.set(config.doc("public"), publicPayload, {merge: false});
      batch.set(config.doc("member"), memberPayload, {merge: false});
      await batch.commit();
    }
    summary[environment] = {
      globalMissing: 0,
      plannedWrites: 2,
      appliedWrites: options.apply ? 2 : 0,
    };
  }
  await app.delete();
  return summary;
}

async function main() {
  const options = parseMigrationArgs(process.argv.slice(2));
  const summary = await runPublicVersionsBackfill(options);
  console.log(JSON.stringify({apply: options.apply, summary}, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Migration failed");
    process.exitCode = 1;
  });
}

module.exports = {
  extractMemberConfig,
  extractPublicVersions,
  runPublicVersionsBackfill,
};
