const {test, beforeEach, afterEach, after} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {Firestore, Timestamp} = require("@google-cloud/firestore");
const {
  createDevelopLegacyPauseRehearsal,
  runDevelopLegacyPauseRehearsal: dispatch,
  runDevelopLegacyRehearsalEffect: effect,
} = require("../lib/develop-legacy-pause-rehearsal.js");
const {loadExactLegacy, normalize} = require(
  "./develop-legacy-pause-rehearsal-vm.cjs",
);

assert.equal(process.env.GCLOUD_PROJECT, "demo-reguerta-writer-controls");
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8897");
const db = new Firestore({
  projectId: "demo-reguerta-writer-controls", host: "127.0.0.1:8897", ssl: false,
});
let store;
beforeEach(async () => {
  for (const path of [
    "develop/plus-collections", "production/plus-collections",
    "shiftWriterPauses/develop",
  ]) await db.recursiveDelete(db.doc(path));
  store = createDevelopLegacyPauseRehearsal();
});
afterEach(async () => { await store.dispose(); });
after(async () => { await db.terminate(); });
const date = Timestamp.fromDate(new Date("2027-01-06T00:00:00Z"));
const missing = "missing/absent";
const eventNames = [
  "onShiftPlanningRequestCreated", "onShiftWritten",
  "onDeliveryCalendarOverrideWritten", "onNotificationEventCreated",
];
const allNames = [
  "syncShiftsFromGoogleSheets", "exportShiftsToGoogleSheets", ...eventNames,
];

async function seed(env) {
  const root = `${env}/plus-collections`;
  for (const [id, name] of [["a", "Member A"], ["b", "Member B"]]) {
    await db.doc(`${root}/users/${id}`).set({
      displayName: name, isActive: true, roles: ["member"],
      producerCatalogEnabled: false, phone: "600000001", createdAt: date,
    });
  }
  await db.doc(`${root}/users/a/devices/one`).set({fcmToken: "demo-token"});
  await db.doc(`${root}/shifts/shift_delivery_20270106`).set({
    type: "delivery", date, assignedUserIds: ["a"], helperUserId: "b",
    source: "app", status: "confirmed",
  });
  await db.doc(`${root}/shiftPlanningRequests/req`).set({
    type: "market", requestedByUserId: "a", requestedAt: date,
    status: "requested",
  });
  await db.doc(`${root}/notificationEvents/event`).set({
    title: "Demo notice", body: "Demo body", type: "shift_updated",
    target: "users", targetPayload: {userIds: ["a"]},
  });
  await db.doc(`${root}/deliveryCalendar/2027-W01`).set({
    deliveryDate: Timestamp.fromDate(new Date("2027-01-07T00:00:00Z")),
    updatedBy: "a",
  });
}

async function eventFor(harness, env, name) {
  const root = `${env}/plus-collections`;
  const params = {env, requestId: "req", shiftId: "shift_delivery_20270106",
    weekKey: "2027-W01", eventId: "event"};
  const paths = {
    onShiftPlanningRequestCreated: `${root}/shiftPlanningRequests/req`,
    onShiftWritten: `${root}/shifts/shift_delivery_20270106`,
    onDeliveryCalendarOverrideWritten: `${root}/deliveryCalendar/2027-W01`,
    onNotificationEventCreated: `${root}/notificationEvents/event`,
  };
  const after = await harness.snapshot(paths[name]);
  return {id: `cloud-${name}`, params, data: name.endsWith("Written") ? {
    before: await harness.snapshot(missing), after,
  } : after};
}

function wire(value) {
  if (value instanceof Timestamp) return {timestamp: {
    seconds: value.seconds, nanoseconds: value.nanoseconds,
  }};
  if (Array.isArray(value)) return value.map(wire);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, wire(item)]),
  );
  return value;
}
function wireEvent(event) {
  const snapshot = (snap) => ({
    path: snap.ref.path, exists: snap.exists, data: wire(snap.data() || null),
  });
  return {params: event.params, data: event.data.after ? {
    before: snapshot(event.data.before), after: snapshot(event.data.after),
  } : snapshot(event.data)};
}
async function invoke(harness, env, name, wrapped = true, storeFactory) {
  let response;
  let event;
  const isEvent = eventNames.includes(name);
  if (isEvent) event = await eventFor(harness, env, name);
  const req = {query: {env}};
  const res = {
    status(code) { response = {code}; return this; },
    json(body) { response.body = normalize(body); },
  };
  const original = () => isEvent ? harness.handlers[name](event) :
    harness.handlers[name](req, res);
  const result = wrapped ? await dispatch({
    environment: isEvent ? event.params.env :
      harness.handlers.__resolveEnv(req.query.env),
    entryPoint: name, kind: isEvent ? "event" : "http",
    event: event && {id: event.id, payload: wireEvent(event)},
    store: storeFactory || (() => store), invoke: original,
  }) : await original();
  return normalize({response: response || null, result: result || null});
}
async function businessData(env) {
  const data = {};
  for (const name of [
    "shifts", "users", "shiftPlanningRequests", "notificationEvents",
    "deliveryCalendar",
  ]) {
    const query = await db.collection(`${env}/plus-collections/${name}`).get();
    data[name] = Object.fromEntries(query.docs.map((doc) => [
      doc.id, normalize(doc.data()),
    ]));
  }
  return data;
}

// Each pair runs the unchanged, pinned callback against real emulator data.
// Ports preserve controlled outcomes; SDK/runtime/live routing parity is unproven.
test("six exact production callbacks preserve trace and data with zero ledger access",
  async (t) => {
    for (const name of allNames) await t.test(name, async () => {
      await db.recursiveDelete(db.doc("production/plus-collections"));
      await seed("production");
      const baseline = loadExactLegacy(db);
      const originalResult = await invoke(baseline, "production", name, false);
      const originalData = await businessData("production");
      assert.ok(baseline.mutations.length > 0, `${name} must exercise writes`);
      if (!eventNames.includes(name)) assert.equal(originalResult.response.code, 200);
      if (name === "onShiftPlanningRequestCreated") {
        assert.equal(originalData.shiftPlanningRequests.req.status, "completed");
        assert.equal(originalData.shiftPlanningRequests.req.generatedCount, 10);
      }
      if (name === "onShiftWritten") {
        assert.equal(originalData.shifts.shift_delivery_20270106
          .syncMeta.exportMode, "updated");
        assert.equal(originalData.notificationEvents.auto_1.type, "shift_updated");
      }
      if (name === "onDeliveryCalendarOverrideWritten") {
        assert.equal(originalData.notificationEvents.auto_1.type,
          "delivery_calendar_updated");
      }
      if (name === "onNotificationEventCreated") {
        assert.equal(originalData.notificationEvents.event.dispatch.status, "success");
        assert.ok(baseline.mutations.includes("fcm.sendEachForMulticast"));
      }
      await db.recursiveDelete(db.doc("production/plus-collections"));
      await seed("production");
      const candidate = loadExactLegacy(db);
      const result = await invoke(candidate, "production", name, true, () => {
        assert.fail("production must not construct or access the journal");
      });
      assert.deepEqual(result, originalResult);
      assert.deepEqual(candidate.trace, baseline.trace);
      assert.deepEqual(await businessData("production"), originalData);
      assert.equal((await db.doc("shiftWriterPauses/develop").get()).exists,
        false);
    });
  });

test("deployed resolver variants cannot route an untracked develop writer", async () => {
  const harness = loadExactLegacy(db);
  assert.equal(harness.handlers.__resolveEnv(undefined), "develop");
  assert.equal(loadExactLegacy(db, {defaultEnv: "production"})
    .handlers.__resolveEnv(undefined), "production");
  assert.equal(loadExactLegacy(db, {defaultEnv: null, runtimeEnv: "production"})
    .handlers.__resolveEnv(undefined), "production");
  assert.equal(harness.handlers.__resolveEnv(" DEVELOP "), "DEVELOP");
  for (const env of ["DEVELOP", "Production", "staging", ""]) {
    await assert.rejects(dispatch({
      environment: env, kind: "http", entryPoint: allNames[0],
      store: () => assert.fail("no store I/O before validation"),
      invoke: () => assert.fail("no callback before validation"),
    }), {code: "environment_invalid"});
  }
  assert.equal(harness.trace.length, 0);
});

test("absent state refuses HTTP and can never establish closure", async () => {
  await assert.rejects(dispatch({
    environment: "develop", kind: "http", entryPoint: allNames[0],
    store: () => store, invoke: () => assert.fail("must fail closed"),
  }), {code: "develop_paused"});
  assert.deepEqual(await store.assess(), {
    state: null, trackedIdle: false, canClaimClosure: false, canApply: false,
  });
  await assert.rejects(store.pause(), {code: "state_missing"});
});

test("admitted exact develop write finishes; pause refuses new HTTP before ports",
  async () => {
    await seed("develop");
    await store.initializeOpen();
    const first = loadExactLegacy(db);
    await invoke(first, "develop", "exportShiftsToGoogleSheets");
    assert.ok(first.mutations.includes("sheets.values.update"));
    assert.equal((await store.assess()).state.active, 0);
    await store.pause();
    const blocked = loadExactLegacy(db);
    await assert.rejects(invoke(blocked, "develop", allNames[0]), {
      code: "develop_paused",
    });
    assert.equal(blocked.trace.length, 0);
    const assessment = await store.assess();
    assert.equal(assessment.state.legacyUntracked, true);
    assert.equal(assessment.canClaimClosure, false);
  });

test("paused exact triggers are durable, bound to original event and never replayed",
  async () => {
    await seed("develop");
    await store.initializeOpen();
    await store.pause();
    for (const name of eventNames) {
      const harness = loadExactLegacy(db);
      assert.deepEqual(await invoke(harness, "develop", name), {
        response: null, result: {kind: "deferred"},
      });
      assert.equal(harness.trace.length, 0);
      assert.deepEqual(await invoke(harness, "develop", name), {
        response: null, result: {kind: "duplicate"},
      });
    }
    const pending = await db.collection("shiftWriterPauses/develop/deferred").get();
    assert.equal(pending.size, 4);
    for (const doc of pending.docs) {
      const retained = doc.data();
      const envelope = JSON.parse(retained.envelope);
      assert.ok(envelope.id.startsWith("cloud-"));
      assert.ok(envelope.payload.data);
      assert.equal(retained.replayable, false);
    }
    await db.doc("develop/plus-collections/notificationEvents/event").update({
      body: "Changed after original delivery",
    });
    await assert.rejects(invoke(loadExactLegacy(db), "develop",
      "onNotificationEventCreated"), {code: "event_payload_conflict"});
    assert.equal((await store.assess()).state.deferred, 4);
    // A new SDK client observes the same retained evidence after reconnect.
    const recovered = createDevelopLegacyPauseRehearsal();
    assert.equal((await recovered.assess()).state.deferred, 4);
    await recovered.dispose();
  });

test("swallowed exact calendar error stays uncertain and duplicate never clears it",
  async () => {
    await seed("develop");
    await store.initializeOpen();
    const harness = loadExactLegacy(db, {failPort: "sheets.values.update"});
    await invoke(harness, "develop", "onDeliveryCalendarOverrideWritten");
    assert.ok(harness.trace.some((entry) => entry.port === "logger.error"));
    const first = await store.assess();
    assert.equal(first.state.uncertain, 1);
    assert.equal(first.trackedIdle, false);
    assert.deepEqual(await invoke(harness, "develop",
      "onDeliveryCalendarOverrideWritten"), {
      response: null, result: {kind: "duplicate"},
    });
    assert.equal((await store.assess()).state.uncertain, 1);
    await db.doc("develop/plus-collections/deliveryCalendar/2027-W01").update({
      updatedBy: "b",
    });
    await assert.rejects(invoke(harness, "develop",
      "onDeliveryCalendarOverrideWritten"), {code: "event_payload_conflict"});
    assert.equal((await store.assess()).state.uncertain, 1);
  });

test("admission serializes with pause and unfinished effects stay active", async () => {
  await store.initializeOpen();
  let release;
  let entered;
  const started = new Promise((resolve) => { entered = resolve; });
  const waiting = new Promise((resolve) => { release = resolve; });
  const running = dispatch({
    environment: "develop", kind: "http", entryPoint: allNames[0],
    store: () => store, invoke: async () => effect(async () => {
      entered(); await waiting;
    }),
  });
  await started;
  await store.pause();
  assert.equal((await store.assess()).state.active, 1);
  await assert.rejects(dispatch({
    environment: "develop", kind: "http", entryPoint: allNames[0],
    store: () => store, invoke: () => assert.fail("paused"),
  }), {code: "develop_paused"});
  release(); await running;
  assert.equal((await store.assess()).state.active, 0);
  assert.equal((await store.assess()).canClaimClosure, false);
});

test("late effects are rejected and pending effects survive callback settlement",
  async () => {
    await store.initializeOpen();
    let release;
    let pending;
    let late;
    let started;
    const entered = new Promise((resolve) => { started = resolve; });
    const waiting = new Promise((resolve) => { release = resolve; });
    await dispatch({
      environment: "develop", kind: "http", entryPoint: allNames[0],
      store: () => store, invoke: async () => {
        pending = effect(async () => { started(); await waiting; });
        late = () => effect(async () => assert.fail("late mutation"));
        await entered;
      },
    });
    assert.equal((await store.assess()).state.active, 1);
    // A continuation created inside the invocation retains its ALS context.
    let lateResult;
    await dispatch({
      environment: "develop", kind: "http", entryPoint: allNames[0],
      store: () => store, invoke: async () => {
        lateResult = waiting.then(() => late());
      },
    });
    const rejectedLate = assert.rejects(lateResult, {
      code: "late_effect_rejected",
    });
    release();
    await pending;
    await rejectedLate;
    assert.equal((await store.assess()).state.active, 0);
  });

test("retention failure cannot return deferred; no false delivery assurance", async () => {
  await seed("develop");
  const unavailable = {
    admit: async () => "paused",
    retain: async () => { throw Error("synthetic_retention_unavailable"); },
  };
  await assert.rejects(invoke(loadExactLegacy(db), "develop",
    "onNotificationEventCreated", true, () => unavailable),
  /synthetic_retention_unavailable/);
  assert.equal((await store.assess()).canApply, false);
});

// The data commit happens before its acknowledgment is lost. The attempt must
// not become idle merely because a retry might later return normally.
test("lost acknowledgment after a real Firestore commit remains uncertain", async () => {
  await seed("develop");
  await store.initializeOpen();
  const harness = loadExactLegacy(db, {loseAckPort: "firestore.create"});
  await assert.rejects(invoke(harness, "develop", "onShiftWritten"),
    /synthetic_ack_lost/);
  const notice = await db.doc(
    "develop/plus-collections/notificationEvents/auto_1",
  ).get();
  assert.equal(notice.exists, true);
  assert.equal(notice.get("type"), "shift_updated");
  const assessment = await store.assess();
  assert.equal(assessment.state.active, 0);
  assert.equal(assessment.state.uncertain, 1);
  assert.equal(assessment.trackedIdle, false);
});

test("factory refuses another project or emulator before creating a client", () => {
  const original = process.env.FIRESTORE_EMULATOR_HOST;
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  try {
    assert.throws(createDevelopLegacyPauseRehearsal, {
      code: "local_emulator_required",
    });
  } finally {
    process.env.FIRESTORE_EMULATOR_HOST = original;
  }
});

test("absent state durably quarantines events instead of defaulting open", async () => {
  await seed("develop");
  const harness = loadExactLegacy(db);
  assert.deepEqual(await invoke(harness, "develop", "onNotificationEventCreated"), {
    response: null, result: {kind: "deferred"},
  });
  assert.equal(harness.trace.length, 0);
  const assessment = await store.assess();
  assert.equal(assessment.state.mode, "paused");
  assert.equal(assessment.state.deferred, 1);
  assert.equal(assessment.state.legacyUntracked, true);
  assert.equal(assessment.canApply, false);
});

test("production ports also bypass an inherited develop invocation context", async () => {
  await store.initializeOpen();
  let effectAdmissions = 0;
  const startEffect = store.startEffect.bind(store);
  store.startEffect = async (...args) => {
    effectAdmissions += 1;
    return startEffect(...args);
  };
  await dispatch({
    environment: "develop", kind: "http", entryPoint: allNames[0],
    store: () => store, invoke: () => dispatch({
      environment: "production", kind: "http", entryPoint: allNames[0],
      store: () => assert.fail("production journal"),
      invoke: () => effect(async () => "original production result"),
    }),
  });
  const attempts = await db.collection("shiftWriterPauses/develop/attempts").get();
  assert.equal(attempts.size, 1);
  assert.equal(effectAdmissions, 0);
  assert.equal(attempts.docs[0].get("effects"), 0);
  assert.equal(attempts.docs[0].get("uncertain"), false);
});

test("the baseline rejects any deployed source byte drift before executing it", () => {
  const sourcePath = process.env.HU084_DEPLOYED_LEGACY_JS;
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "hu084-source-pin-"));
  const changed = path.join(folder, "changed-source.js");
  fs.writeFileSync(changed, Buffer.concat([fs.readFileSync(sourcePath), Buffer.from("\n")]));
  process.env.HU084_DEPLOYED_LEGACY_JS = changed;
  try {
    assert.throws(() => loadExactLegacy(db), /source_digest_mismatch/);
  } finally {
    process.env.HU084_DEPLOYED_LEGACY_JS = sourcePath;
    fs.rmSync(folder, {recursive: true, force: true});
  }
});
