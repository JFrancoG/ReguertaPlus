// Execute the byte-pinned deployed module; only dependency ports are replaced.
// This helper never imports the deployed dependencies or uses live credentials.
const fs = require("node:fs");
const vm = require("node:vm");
const {createHash} = require("node:crypto");
const path = require("node:path");
const {execFileSync} = require("node:child_process");
const {RESOLVE_PROFILE, REMINDER_PROFILE} = require("../scripts/prepare-develop-intake-bridge.cjs");
const {
  Timestamp, FieldValue,
} = require("@google-cloud/firestore");
const {
  DEPLOYED_LEGACY_SOURCE_SHA256,
  runDevelopLegacyRehearsalEffect,
} = require("../lib/develop-legacy-pause-rehearsal.js");

function normalize(value, key = "") {
  if (value instanceof Timestamp) {
    return key.endsWith("At") ? "<server-time>" : value.toMillis();
  }
  if (value instanceof FieldValue) return "<field-transform>";
  if (value instanceof Error) return {error: value.message};
  if (Array.isArray(value)) return Array.from(value, (item) => normalize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((name) => [
      name, normalize(value[name], name),
    ]));
  }
  return value;
}

function loadExactLegacy(db, options = {}) {
  if (process.env.GCLOUD_PROJECT !== "demo-reguerta-writer-controls" ||
      process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8897" ||
      db.projectId !== "demo-reguerta-writer-controls") {
    throw Error("local_emulator_required");
  }
  const modern = options.authorizedMember === true;
  const reminders = options.reminders === true;
  const directory = process.env.HU084_REMAINING_LEGACY_SOURCES;
  const sourcePath = reminders && directory ? path.join(directory, "sendPendingOrderReminderSunday20.main.js") : modern && directory ? path.join(directory, "resolveAuthorizedMember.main.js") :
    process.env.HU084_DEPLOYED_LEGACY_JS;
  if (!sourcePath) throw Error("HU084_DEPLOYED_LEGACY_JS_required");
  const source = fs.readFileSync(sourcePath);
  if (createHash("sha256").update(source).digest("hex") !==
      (modern ? RESOLVE_PROFILE.main : reminders ? REMINDER_PROFILE.main : DEPLOYED_LEGACY_SOURCE_SHA256)) throw Error("source_digest_mismatch");
  // Only the audited builder's fixed six callback insertions may transform this
  // already pinned source. No arbitrary source/transform override is accepted.
  const evaluatedSource = options.administrativeBridgeWrappers ?
    require("../scripts/prepare-develop-intake-bridge.cjs").wrapAdministrativeSource(
      source, modern ? "authorized-member1" : reminders ? "reminders3" : "legacy-http8",
    ).source : options.bridgeWrappers ?
    require("../scripts/prepare-develop-intake-bridge.cjs")
      .wrapLegacySource(source).source : source.toString("utf8");
  const trace = [];
  const mutations = [];
  const objects = new WeakMap();
  let autoId = 0;
  const record = (port, args) => trace.push({port, args: normalize(args)});
  const mutate = (port, args, work) => runDevelopLegacyRehearsalEffect(
    async () => {
      record(port, args);
      mutations.push(port);
      if (options.failPort === port) throw Error("synthetic_port_uncertain");
      if (options.waitPort === port) await options.wait;
      const result = await work();
      if (options.loseAckPort === port) throw Error("synthetic_ack_lost");
      return result;
    },
  );
  const unwrap = (value) => objects.get(value) || value;
  const snapshot = (raw) => new Proxy(raw, {get(target, property) {
    if (property === "ref") return wrap(target.ref);
    if (property === "docs") return target.docs.map(snapshot);
    if (property === "forEach") {
      return (callback) => target.docs.forEach((doc) => callback(snapshot(doc)));
    }
    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  }});
  function wrap(raw) {
    const proxy = new Proxy(raw, {get(target, property) {
      const path = target.path || "query";
      if (property === "collection") {
        return (name) => wrap(target.collection(name));
      }
      if (property === "doc") {
        return (id) => wrap(target.doc(id || `auto_${++autoId}`));
      }
      if (property === "add") {
        return async (data) => {
          const ref = wrap(target.doc(`auto_${++autoId}`));
          await ref.create(data);
          return ref;
        };
      }
      if (["where", "orderBy", "limit"].includes(property)) {
        return (...args) => {
          record(`firestore.${property}`, {path, args});
          return wrap(target[property](...args));
        };
      }
      if (property === "get") {
        return async () => {
          record("firestore.get", {path});
          return snapshot(await target.get());
        };
      }
      if (["set", "update", "create", "delete"].includes(property)) {
        return (...args) => mutate(`firestore.${property}`, {path, args},
          () => target[property](...args));
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    }});
    objects.set(proxy, raw);
    return proxy;
  }
  const firestore = {
    collection: (path) => wrap(db.collection(path)),
    doc: (path) => wrap(db.doc(path)),
    getAll: async (...refs) => {
      record("firestore.getAll", refs.map((ref) => ref.path));
      return (await db.getAll(...refs.map(unwrap))).map(snapshot);
    },
    batch: () => {
      const batch = db.batch();
      const operations = [];
      const facade = {};
      for (const method of ["delete", "set", "update", "create"]) {
        facade[method] = (ref, ...args) => {
          operations.push({method, path: ref.path, args});
          batch[method](unwrap(ref), ...args);
          return facade;
        };
      }
      facade.commit = () => mutate("firestore.batch.commit", operations,
        () => batch.commit());
      return facade;
    },
    runTransaction: async (callback) => {
      record("firestore.runTransaction", {});
      return db.runTransaction(async (transaction) => {
        const facade = {get: async (reference) => {
          record("firestore.transaction.get", {path: reference.path || "query"});
          return snapshot(await transaction.get(unwrap(reference)));
        }};
        for (const method of ["set", "create", "update", "delete"]) {
          facade[method] = (reference, ...args) => {
            record(`firestore.transaction.${method}`, {path: reference.path, args});
            mutations.push(`firestore.transaction.${method}`);
            transaction[method](unwrap(reference), ...args);
            return facade;
          };
        }
        return callback(facade);
      });
    },
  };
  const firestoreFactory = () => firestore;
  const clockTimestamp = options.fixedTimestampMillis === undefined ? Timestamp :
    new Proxy(Timestamp, {get(target, property) {
      return property === "now" ? () => Timestamp.fromMillis(options.fixedTimestampMillis) :
        Reflect.get(target, property, target);
    }});
  firestoreFactory.Timestamp = clockTimestamp;
  firestoreFactory.FieldValue = FieldValue;
  const sheets = {spreadsheets: {values: {}}};
  for (const method of ["get", "batchUpdate"]) {
    sheets.spreadsheets[method] = (args) => method === "get" ?
      (record("sheets.get", args), Promise.resolve({data: {sheets: []}})) :
      mutate("sheets.batchUpdate", args, async () => ({data: {}}));
  }
  for (const method of ["get", "update", "append", "clear"]) {
    sheets.spreadsheets.values[method] = (args) => {
      if (method === "get") {
        record("sheets.values.get", args);
        const values = args.range.startsWith("Delivery") ?
          [["06/01/2027", "Member A", "600000001"]] :
          [["09/01/2027"], ["Member A"], ["Member B"]];
        return Promise.resolve({data: {values}});
      }
      return mutate(`sheets.values.${method}`, args, async () => ({data: {}}));
    };
  }
  const capture = (...args) => args.at(-1);
  const admin = {
    initializeApp() {}, firestore: firestoreFactory,
    messaging: () => ({sendEachForMulticast: (args) =>
      mutate("fcm.sendEachForMulticast", args, async () => ({
        successCount: args.tokens.length, failureCount: 0,
      }))}),
  };
  const modules = {
    "firebase-functions/v2": {setGlobalOptions() {}},
    "firebase-functions/v2/https": {onRequest: capture},
    "firebase-functions/v2/scheduler": {onSchedule: capture},
    "firebase-functions/v2/firestore": {
      onDocumentCreated: capture, onDocumentWritten: capture,
    },
    "firebase-functions": {logger: Object.fromEntries(
      ["info", "warn", "error"].map((level) => [level, (...args) =>
        record(`logger.${level}`, args)]),
    )},
    "firebase-admin": admin,
    "googleapis": {google: {
      auth: {GoogleAuth: class { constructor() {} }},
      sheets: () => sheets,
    }},
  };
  if (modern) {
    modules["firebase-functions/v2/firestore"].onDocumentCreatedWithAuthContext = capture;
    modules["firebase-functions/v2/firestore"].onDocumentWrittenWithAuthContext = capture;
    modules["firebase-functions/v2/scheduler"] = {onSchedule: capture};
    modules["firebase-admin/app"] = {initializeApp() { return {}; }};
    modules["firebase-admin/auth"] = {getAuth: () => ({verifyIdToken: async (token, checkRevoked) => {
      record("auth.verifyIdToken", {token, checkRevoked});
      if (options.identityError) throw Error("synthetic_identity_rejected");
      return options.identity || {uid: "fixture-uid", email: "member@example.test", email_verified: true};
    }})};
    modules["firebase-admin/firestore"] = {getFirestore: () => firestore, Timestamp: clockTimestamp, FieldValue};
    modules["firebase-admin/messaging"] = {getMessaging: admin.messaging};
    modules["node:crypto"] = require("node:crypto");
    const archive = path.join(directory, "resolveAuthorizedMember.zip");
    if (createHash("sha256").update(fs.readFileSync(archive)).digest("hex") !== RESOLVE_PROFILE.zip) {
      throw Error("source_archive_digest_mismatch");
    }
    for (const [entry, expected] of Object.entries(RESOLVE_PROFILE.helpers)) {
      const bytes = execFileSync("unzip", ["-p", archive, entry]);
      if (createHash("sha256").update(bytes).digest("hex") !== expected) throw Error("helper_source_digest_mismatch");
      const exports = {};
      vm.runInNewContext(bytes.toString("utf8"), {exports, require(name) {
        if (!(name in modules)) throw Error("undeclared_dependency_port");
        return modules[name];
      }, Error, Map, Set, Buffer}, {filename: `byte-pinned-${entry}`, timeout: 5000});
      modules[`./${path.basename(entry)}`] = exports;
    }
  }
  if (options.bridgeWrappers) {
    modules["./develop-shift-intake-bridge.js"] = options.bridgeWrappers;
  }
  if (options.administrativeBridgeWrappers) {
    modules["./develop-shift-intake-bridge.js"] = options.administrativeBridgeWrappers;
  }
  const exports = {};
  class FixedDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : ["2026-10-28T12:00:00Z"]));
    }
  }
  const math = Object.create(Math);
  math.random = () => 0.3;
  const sandbox = {
    exports, require(name) {
      if (!(name in modules)) throw Error("undeclared_dependency_port");
      return modules[name];
    },
    process: {env: {
      APP_ENV: options.defaultEnv === null ? undefined :
        (options.defaultEnv || "develop"),
      CLOUD_RUNTIME_CONFIG: JSON.stringify({app: {env: options.runtimeEnv}}),
      ORDER_REMINDER_ENVS: options.reminderEnvs,
      SHEETS_SPREADSHEET_ID_DEVELOP: "demo-develop-workbook",
      SHEETS_SPREADSHEET_ID_PRODUCTION: "demo-production-workbook",
      SHEETS_DELIVERY_RANGE: "Delivery!A:F",
      SHEETS_MARKET_RANGE: "Market!A:C",
    }},
    Error, Date: FixedDate, Math: math, Intl,
  };
  vm.runInNewContext(evaluatedSource +
    "\nexports.__resolveEnv = value => parseEnvParam(value);", sandbox, {
    filename: "byte-pinned-deployed-index.js", timeout: 5000,
  });
  return {
    handlers: exports, trace, mutations,
    snapshot: async (path) => snapshot(await db.doc(path).get()),
    normalize,
  };
}
module.exports = {loadExactLegacy, normalize};
