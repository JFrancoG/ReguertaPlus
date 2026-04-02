import {setGlobalOptions} from "firebase-functions/v2";
import {onRequest} from "firebase-functions/v2/https";
import {
  onDocumentCreated,
  onDocumentWritten,
} from "firebase-functions/v2/firestore";
import {logger, config} from "firebase-functions";
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
};

type MemberSheetRef = {
  id: string;
  displayName: string;
  normalizedEmail: string;
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
};

const SHIFT_SHEET_HEADERS = [
  "shiftId",
  "type",
  "date",
  "assignedUserIds",
  "assignedDisplayNames",
  "helperUserId",
  "helperDisplayName",
  "status",
  "source",
] as const;

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
  const sheetsConfig = parseBody(config().sheets);
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
  },
  {
    range: configValue.marketRange,
    defaultType: "market",
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

const normalizeHeader = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const normalizeLookupKey = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

const parseShiftType = (value: unknown, fallback: ShiftType): ShiftType => {
  const normalized = parseString(value)?.toLowerCase();
  return normalized === "market" ? "market" : normalized === "delivery" ?
    "delivery" :
    fallback;
};

const parseShiftStatus = (value: unknown): ShiftStatus =>
  parseString(value)?.toLowerCase() === "swap_pending" ?
    "swap_pending" :
    parseString(value)?.toLowerCase() === "confirmed" ?
      "confirmed" :
      "planned";

const parseParticipantTokens = (value: unknown): string[] => {
  const text = parseString(value);
  if (!text) {
    return [];
  }

  return Array.from(new Set(
    text
      .split(/[,\n;|]+/g)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
  ));
};

const isShiftType = (value: string): value is ShiftType =>
  value === "delivery" || value === "market";

const isShiftStatus = (value: string): value is ShiftStatus =>
  value === "planned" || value === "swap_pending" || value === "confirmed";

const timestampToSheetDate = (timestamp: admin.firestore.Timestamp): string =>
  timestamp.toDate().toISOString().slice(0, 10);

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

  const isoMillis = Date.parse(text);
  if (!Number.isNaN(isoMillis)) {
    return admin.firestore.Timestamp.fromMillis(isoMillis);
  }

  const dayMonthYear = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dayMonthYear) {
    const [, day, month, year] = dayMonthYear;
    const millis = Date.UTC(Number(year), Number(month) - 1, Number(day));
    return admin.firestore.Timestamp.fromMillis(millis);
  }

  return null;
};

const parseSheetName = (range: string): string =>
  range.includes("!") ? range.split("!")[0] : "Sheet1";

const buildHeaderIndex = (
  headerRow: string[],
): Record<string, number> =>
  Object.fromEntries(
    headerRow.map((header, index) => [normalizeHeader(header), index])
  );

const firstNonEmptyCell = (
  row: string[],
  headerIndex: Record<string, number>,
  aliases: string[],
): string | null => {
  for (const alias of aliases) {
    const index = headerIndex[normalizeHeader(alias)];
    if (index === undefined) {
      continue;
    }
    const value = parseString(row[index]);
    if (value) {
      return value;
    }
  }
  return null;
};

const collectParticipantCells = (
  row: string[],
  headerIndex: Record<string, number>,
  aliases: string[],
): string[] => {
  const values: string[] = [];
  Object.entries(headerIndex).forEach(([normalizedHeader, index]) => {
    if (
      aliases.includes(normalizedHeader) ||
      /^assigned[0-9]+$/.test(normalizedHeader) ||
      /^participant[0-9]+$/.test(normalizedHeader) ||
      /^member[0-9]+$/.test(normalizedHeader)
    ) {
      const raw = parseString(row[index]);
      if (raw) {
        values.push(raw);
      }
    }
  });
  return values;
};

const buildMemberLookup = async (
  env: string,
): Promise<Map<string, MemberSheetRef>> => {
  const snapshot = await plusUsersCollection(env).get();
  const lookup = new Map<string, MemberSheetRef>();

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
  });

  return lookup;
};

const resolveMemberId = (
  lookup: Map<string, MemberSheetRef>,
  value: string,
): string | null => lookup.get(normalizeLookupKey(value))?.id || null;

const resolveParticipantIds = (
  lookup: Map<string, MemberSheetRef>,
  values: string[],
): string[] =>
  Array.from(new Set(
    values
      .flatMap((value) => parseParticipantTokens(value))
      .map((token) => resolveMemberId(lookup, token))
      .filter((value): value is string => Boolean(value))
  ));

const toNormalizedShiftSheetRow = (
  row: string[],
  rowNumber: number,
  definition: SheetRangeDefinition,
  lookup: Map<string, MemberSheetRef>,
  headerIndex: Record<string, number>,
): NormalizedShiftSheetRow | null => {
  const date = parseDateInput(
    firstNonEmptyCell(row, headerIndex, ["date", "fecha"])
  );
  if (!date) {
    return null;
  }

  const type = parseShiftType(
    firstNonEmptyCell(row, headerIndex, ["type", "tipo"]),
    definition.defaultType,
  );
  const statusRaw = firstNonEmptyCell(row, headerIndex, ["status", "estado"]);
  const status = parseShiftStatus(statusRaw);
  const participantValues = [
    firstNonEmptyCell(
      row,
      headerIndex,
      ["assignedUserIds", "assignedusers", "assigneddisplaynames"]
    ) || "",
    ...collectParticipantCells(
      row,
      headerIndex,
      [
        normalizeHeader("responsible"),
        normalizeHeader("encargado"),
        normalizeHeader("assigned"),
        normalizeHeader("asignados"),
      ],
    ),
  ];
  const assignedUserIds = resolveParticipantIds(lookup, participantValues);
  if (assignedUserIds.length === 0) {
    return null;
  }

  const helperValue = firstNonEmptyCell(
    row,
    headerIndex,
    ["helperUserId", "helperDisplayName", "helper", "ayudante"]
  );
  const helperUserId = helperValue ?
    resolveMemberId(lookup, helperValue) :
    null;
  const shiftId = firstNonEmptyCell(
    row,
    headerIndex,
    ["shiftId", "id", "shift_id"]
  ) || buildShiftId(type, date);
  const rowKey = buildShiftRowKey(type, date);

  return {
    shiftId,
    type,
    date,
    assignedUserIds,
    helperUserId,
    status,
    source: "google_sheets",
    rowNumber,
    rowKey,
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
  const rows = response.data.values || [];
  if (rows.length === 0) {
    return [];
  }

  const headerIndex = buildHeaderIndex(
    rows[0].map((cell) => `${cell}`)
  );

  return rows
    .slice(1)
    .map((row, index) =>
      toNormalizedShiftSheetRow(
        row.map((cell) => `${cell}`),
        index + 2,
        definition,
        lookup,
        headerIndex,
      )
    )
    .filter((row): row is NormalizedShiftSheetRow => Boolean(row));
};

const syncShiftRowsIntoFirestore = async (
  env: string,
  rows: NormalizedShiftSheetRow[],
): Promise<number> => {
  const collection = firestore.collection(`${env}/plus-collections/shifts`);
  const importedAt = admin.firestore.FieldValue.serverTimestamp();
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
  };
};

const toShiftSheetRow = (
  shift: FirestoreShiftRecord,
  membersById: Map<string, MemberSheetRef>,
): string[] => {
  const assignedMembers = shift.assignedUserIds
    .map((userId) => membersById.get(userId))
    .filter((value): value is MemberSheetRef => Boolean(value));
  const helperMember = shift.helperUserId ?
    membersById.get(shift.helperUserId) || null :
    null;

  return [
    shift.id,
    shift.type,
    timestampToSheetDate(shift.date),
    shift.assignedUserIds.join(","),
    assignedMembers.map((member) => member.displayName).join(", "),
    shift.helperUserId || "",
    helperMember?.displayName || "",
    shift.status,
    shift.source,
  ];
};

const ensureSheetHeaders = async (
  sheets: Awaited<ReturnType<typeof getSheetsClient>>,
  spreadsheetId: string,
  range: string,
): Promise<void> => {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${parseSheetName(range)}!A1:I1`,
  });
  const currentHeader = response.data.values?.[0] || [];
  const isMatching = SHIFT_SHEET_HEADERS.every(
    (header, index) => currentHeader[index] === header
  );

  if (isMatching) {
    return;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${parseSheetName(range)}!A1:I1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [Array.from(SHIFT_SHEET_HEADERS)],
    },
  });
};

const upsertShiftRowInSheet = async (
  sheets: Awaited<ReturnType<typeof getSheetsClient>>,
  spreadsheetId: string,
  range: string,
  shift: FirestoreShiftRecord,
  membersById: Map<string, MemberSheetRef>,
): Promise<"updated" | "appended"> => {
  await ensureSheetHeaders(sheets, spreadsheetId, range);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  const rows = response.data.values || [];
  if (rows.length === 0) {
    await ensureSheetHeaders(sheets, spreadsheetId, range);
  }

  const normalizedRows = rows.map((row) => row.map((cell) => `${cell}`));
  const headerIndex = normalizedRows.length > 0 ?
    buildHeaderIndex(normalizedRows[0]) :
    {};
  const shiftIdIndex = headerIndex[normalizeHeader("shiftId")];
  const shiftRow = toShiftSheetRow(shift, membersById);
  const targetRowKey = buildShiftRowKey(shift.type, shift.date);
  const normalizedDate = timestampToSheetDate(shift.date);

  for (let rowOffset = 1; rowOffset < normalizedRows.length; rowOffset += 1) {
    const row = normalizedRows[rowOffset];
    const rowShiftId = shiftIdIndex !== undefined ?
      parseString(row[shiftIdIndex]) :
      null;
    const rowDate = firstNonEmptyCell(row, headerIndex, ["date", "fecha"]);
    const rowType = firstNonEmptyCell(row, headerIndex, ["type", "tipo"]);
    const rowKey = rowDate && rowType ?
      buildShiftRowKey(
        parseShiftType(rowType, shift.type),
        admin.firestore.Timestamp.fromDate(new Date(rowDate))
      ) :
      null;

    if (
      rowShiftId === shift.id ||
      rowKey === targetRowKey ||
      (rowType?.toLowerCase() === shift.type &&
        rowDate === normalizedDate)
    ) {
      const rowNumber = rowOffset + 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${parseSheetName(range)}!A${rowNumber}:I${rowNumber}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [shiftRow],
        },
      });
      return "updated";
    }
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${parseSheetName(range)}!A:I`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [shiftRow],
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

const groupShiftsByType = (
  shifts: FirestoreShiftRecord[],
): Record<ShiftType, FirestoreShiftRecord[]> => ({
  delivery: shifts.filter((shift) => shift.type === "delivery"),
  market: shifts.filter((shift) => shift.type === "market"),
});

const writeShiftRowsToSheet = async (
  sheets: Awaited<ReturnType<typeof getSheetsClient>>,
  spreadsheetId: string,
  range: string,
  rows: string[][],
): Promise<void> => {
  const sheetName = parseSheetName(range);
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${sheetName}!A2:I`,
  });

  if (rows.length === 0) {
    return;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A2:I${rows.length + 1}`,
    valueInputOption: "RAW",
    requestBody: {
      values: rows,
    },
  });
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

  const [sheets, membersById, shifts] = await Promise.all([
    getSheetsClient(),
    loadMembersById(env),
    readAllShifts(env),
  ]);
  const grouped = groupShiftsByType(shifts);

  await ensureSheetHeaders(
    sheets,
    sheetConfig.spreadsheetId,
    sheetConfig.deliveryRange,
  );
  await ensureSheetHeaders(
    sheets,
    sheetConfig.spreadsheetId,
    sheetConfig.marketRange,
  );

  await writeShiftRowsToSheet(
    sheets,
    sheetConfig.spreadsheetId,
    sheetConfig.deliveryRange,
    grouped.delivery.map((shift) => toShiftSheetRow(shift, membersById)),
  );
  await writeShiftRowsToSheet(
    sheets,
    sheetConfig.spreadsheetId,
    sheetConfig.marketRange,
    grouped.market.map((shift) => toShiftSheetRow(shift, membersById)),
  );

  return {
    exportedCount: shifts.length,
    deliveryCount: grouped.delivery.length,
    marketCount: grouped.market.length,
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
  const rows = rowsByRange.flat();
  const importedCount = await syncShiftRowsIntoFirestore(env, rows);

  return {
    importedCount,
    deliveryCount: rows.filter((row) => row.type === "delivery").length,
    marketCount: rows.filter((row) => row.type === "market").length,
  };
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

    const targetRange = after.type === "market" ?
      sheetConfig.marketRange :
      sheetConfig.deliveryRange;

    const [sheets, membersById] = await Promise.all([
      getSheetsClient(),
      loadMembersById(env),
    ]);

    const result = await upsertShiftRowInSheet(
      sheets,
      sheetConfig.spreadsheetId,
      targetRange,
      after,
      membersById,
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
