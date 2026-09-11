"use strict";
const fs = require("node:fs"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto");
const path = require("node:path");
const dir = process.env.HU083_EVIDENCE_DIR,
  base = path.resolve(__dirname, "../.."),
  root = "develop/plus-collections";
assert(
  dir && path.isAbsolute(dir),
  "HU083_EVIDENCE_DIR must name the private evidence directory",
);
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8797");
assert.equal(process.env.GCLOUD_PROJECT, "demo-hu083-develop-rehearsal");
const { Firestore, Timestamp } = require("@google-cloud/firestore");
const { createShiftPlanningDigest: digest } = require(
  base + "/lib/shift-planning-digest.js",
);
const {
  encodeShiftPlanningFirestoreValue: encodeValue,
  attachShiftPlanningBackendMutationMarker,
} = require(base + "/lib/shift-planning-publication-contract.js");
const { buildShiftPlanningAuthoritativeState } = require(
  base + "/lib/shift-planning-state-persistence.js",
);
const { SHIFT_PLANNING_FIRESTORE_ADMISSION_REVISION } = require(
  base + "/lib/shift-planning-firestore-transaction-manifest.js",
);
const { createFirestoreShiftSheetsImport } = require(
  base + "/lib/shift-sheets-firestore-import.js",
);
const { createShiftSheetsConfig } = require(
  base + "/lib/shift-sheets-config.js",
);
const { createShiftPlanningPublicEventRetentionPolicy } = require(
  base + "/lib/shift-planning-public-event-retention.js",
);
const { sheetsService, setCell } = require(
  base + "/test/shift-sheets-api-fixture.cjs",
);
const f = require("./hu083-reset-fixture.cjs");
const encode = (x) => encodeValue(x, "HU083 develop reset", new Set());
const save = (name, data) =>
  fs.writeFileSync(dir + "/" + name, JSON.stringify(data, null, 2) + "\n", {
    mode: 0o600,
  });
const fromRest = (v) => {
  if ("timestampValue" in v) {
    const s = v.timestampValue,
      m = /\.(\d+)Z$/.exec(s);
    return new Timestamp(
      Math.floor(Date.parse(s) / 1000),
      Number((m?.[1] ?? "").padEnd(9, "0")),
    );
  }
  if ("mapValue" in v)
    return Object.fromEntries(
      Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, fromRest(x)]),
    );
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(fromRest);
  for (const k of ["stringValue", "booleanValue", "nullValue"])
    if (k in v) return v[k];
  for (const k of ["integerValue", "doubleValue"])
    if (k in v) return Number(v[k]);
  throw Error("Unsupported source field");
};
const capture = JSON.parse(fs.readFileSync(dir + "/captured-firestore.json"));
const old = new Map(
  capture.source.shifts.map((x) => [
    x.document.name.split("/documents/")[1],
    fromRest({ mapValue: { fields: x.document.fields } }),
  ]),
);
const untouched = new Map(
  capture.source.calendar.map((x) => [
    x.document.name.split("/documents/")[1],
    fromRest({ mapValue: { fields: x.document.fields } }),
  ]),
);
for (const { id, ...u } of f.input.users)
  untouched.set(`${root}/users/${id}`, u);
for (const p of [...old.keys(), ...untouched.keys()])
  assert(p.startsWith(root + "/"), "Only develop paths are accepted");
assert.equal(old.size, 62);
assert.equal(untouched.size, 52);
const inventory = (m) =>
  [...m]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, payload]) => ({
      path,
      payloadDigest: digest(encode(payload)),
    }));
const desired = new Map(
  f.materializations.map((m) => [
    m.targetPath,
    attachShiftPlanningBackendMutationMarker({
      materialization: m,
      operation: f.operation,
    }),
  ]),
);
const baselineBody = {
  schemaVersion: 1,
  recordKind: "shiftPlanningDevelopResetBaseline",
  revision: f.activeRevision,
  target: {
    environment: "develop",
    workbookId: f.input.spreadsheet.spreadsheetId,
  },
  preparedAt: f.now,
  authority: "Explicit disposable develop reset; no historic ownership claim",
  inputSha256: crypto
    .createHash("sha256")
    .update(fs.readFileSync(dir + "/backend-fixture-input.json"))
    .digest("hex"),
  captureArtifactDigest: capture.sourceArtifactDigest,
  before: inventory(old),
  after: inventory(desired),
  rotations: Object.fromEntries(
    ["delivery", "market"].map((type) => [
      type,
      {
        bootstrap: f.bootstraps[type],
        cursorAfterHorizon: f.rotations[type].cursor,
      },
    ]),
  ),
};
const baselineRef = {
  revision: f.activeRevision,
  digest: digest(encode(baselineBody)),
};
for (const type of ["delivery", "market"]) {
  f.rotations[type].migrationBaseline = baselineRef;
  desired.set(`${root}/shiftRotations/${type}`, f.rotations[type]);
}
const maintenance = {
  schemaVersion: 1,
  stateRevision: 1,
  writeEpoch: 1,
  maintenanceStatus: "open",
  activeRevision: f.activeRevision,
  activeDigest: f.activeDigest,
  intakeBarrier: null,
  lastTransitionId: f.operation.operationId,
};
const authority = buildShiftPlanningAuthoritativeState({
  environment: "develop",
  maintenance,
  rotations: f.rotations,
});
desired.set(`${root}/shiftPlanningState/current`, maintenance);
desired.set(
  `${root}/shiftPlanningOperations/${f.operation.operationId}`,
  f.operation,
);
desired.set(`${root}/shiftPlanningMigrationBaselines/${baselineRef.revision}`, {
  ...baselineBody,
  baselineDigest: baselineRef.digest,
});
const planBody = {
  schemaVersion: 2,
  scope: "approved_disposable_develop_content_reset",
  liveExecutable: false,
  baseline: baselineRef,
  authoritativeStateDigest: authority.authoritativeDigest,
  forward: [...old]
    .map(([path]) => ({ path, action: "delete" }))
    .concat(
      [...desired].map(([path, data]) => ({
        path,
        action: "create",
        payload: encode(data),
      })),
    ),
  inverse: [...desired]
    .map(([path]) => ({ path, action: "delete" }))
    .concat(
      [...old].map(([path, data]) => ({
        path,
        action: "create",
        payload: encode(data),
      })),
    ),
  untouched: inventory(untouched),
  sourcePolicyBinding: {
    targetPath: `${root}/shiftPlanningState/sourcePolicy`,
    status: "requires_fresh_Drive_version_at_HU085_activation",
    workbookId: f.input.spreadsheet.spreadsheetId,
    partitionInitialization: { stateRevision: 1, epoch: 1, lease: null },
    reason:
      "Connected metadata drops Drive version; operator OAuth scope rejects files.get. No fabricated version or existing policy is written by this plan.",
  },
  liveGates: [
    "contained and drained writers with reviewed shared Functions and Rules release",
    "fresh full source and updateTime guards",
    "actual Drive version and deployed admission index authority binding; finite reviewed transaction including sourcePolicy",
    "guarded forward read-back and inverse updateTime binding",
  ],
};
const plan = { ...planBody, planDigest: digest(planBody) };
assert.equal(plan.forward.length, 139);
save("develop-reset-plan.json", plan);
const db = new Firestore({
  projectId: process.env.GCLOUD_PROJECT,
  host: "127.0.0.1:8797",
  ssl: false,
});
const readAll = async () => {
  const docs = [];
  const walk = async (ref) => {
    for (const c of await ref.listCollections()) {
      for (const child of await c.listDocuments()) {
        const d = await child.get();
        if (d.exists) docs.push(d);
        await walk(child);
      }
    }
  };
  await walk(db.doc(root));
  return new Map(
    docs.map((d) => [
      d.ref.path,
      { payload: d.data(), updateTime: d.updateTime },
    ]),
  );
};
const fields = (m) => new Map([...m].map(([p, d]) => [p, d.payload]));
const assertUnchanged = async (expected) => {
  const current = await readAll();
  assert.deepEqual(
    inventory(fields(current)),
    inventory(fields(expected)),
    "payload drift",
  );
  for (const [p, d] of current)
    assert(
      d.updateTime.isEqual(expected.get(p).updateTime),
      "update time drift",
    );
};
let state = "idle",
  service,
  api,
  version,
  snapshotAfter,
  phaseDigests,
  rows,
  run = 0;
const allAssigned = new Set(f.entries.flatMap((e) => e.assigned));
const replacement = f.input.users.find(
  (u) => f.eligible.includes(u.id) && !allAssigned.has(u.id),
);
const target = f.entries.find(
  (e) => e.type === "delivery" && e.date === "2027-09-01",
);
const predecessor = f.entries.find(
  (e) => e.type === "delivery" && e.date === "2027-08-25",
);
const oracle = () => {
  const ordered = [...rows].sort((a, b) => a.dateMillis - b.dateMillis),
    delivery = ordered.filter((r) => r.type === "delivery");
  const now = Date.parse("2027-08-26T00:00:00Z");
  const lead = delivery.find(
    (r) => r.dateMillis >= now && r.assignedUserIds.includes(replacement.id),
  );
  return {
    memberId: replacement.id,
    nowMillis: now,
    rows: [...rows].sort((a, b) => a.id.localeCompare(b.id)),
    nextLeadId: lead?.id ?? null,
    nextHelperId: lead
      ? (delivery.filter((r) => r.dateMillis < lead.dateMillis).at(-1)?.id ??
        null)
      : null,
    nextMarketId:
      ordered.find(
        (r) =>
          r.type === "market" &&
          r.dateMillis >= now &&
          r.assignedUserIds.includes(replacement.id),
      )?.id ?? null,
    boardDeliveryId: delivery.find((r) => r.dateMillis >= now)?.id ?? null,
  };
};
const begin = async () => {
  assert(["idle", "restored"].includes(state));
  run++;
  const current = await readAll();
  const batch = db.batch();
  for (const p of current.keys()) batch.delete(db.doc(p));
  await batch.commit();
  const seed = db.batch();
  for (const [p, d] of [...old, ...untouched]) seed.create(db.doc(p), d);
  await seed.commit();
  // One finite transaction replaces the captured raw legacy fields, without canonicalizing them.
  await db.runTransaction(async (tx) => {
    const docs = await tx.getAll(
      ...[...old.keys(), ...desired.keys(), ...untouched.keys()].map((p) =>
        db.doc(p),
      ),
    );
    assert.deepEqual(
      inventory(
        new Map(
          docs.filter((d) => d.exists).map((d) => [d.ref.path, d.data()]),
        ),
      ),
      inventory(new Map([...old, ...untouched])),
    );
    for (const p of old.keys()) tx.delete(db.doc(p));
    for (const [p, d] of desired) tx.create(db.doc(p), d);
  });
  assert.deepEqual(
    inventory(fields(await readAll())),
    inventory(new Map([...desired, ...untouched])),
  );
  phaseDigests = {
    materializedContent: digest(inventory(new Map([...desired, ...untouched]))),
  };
  service = sheetsService(f.input.spreadsheet.spreadsheetId);
  service.state = structuredClone(f.input.spreadsheet);
  version = 1;
  service.onMutation = async () => {
    version++;
  };
  // The isolated copy owns its own revision counter. This is never persisted in the live reset plan.
  const sync = {
    leaseDurationMillis: 120000,
    transactionMeasurementAuthority: {
      adapterRevision: SHIFT_PLANNING_FIRESTORE_ADMISSION_REVISION,
      indexConfigurationDigest: digest(
        JSON.parse(fs.readFileSync(base + "/../firestore.indexes.json")),
      ),
    },
    partitions: Object.fromEntries(
      ["delivery", "market"].map((type) => [
        type,
        {
          workbookId: f.input.spreadsheet.spreadsheetId,
          workbookRevision: "1",
          partitionKey: type,
          stateRevision: 1,
          epoch: 1,
          lease: null,
        },
      ]),
    ),
  };
  await db
    .doc(`${root}/shiftPlanningState/sourcePolicy`)
    .create({ environment: "develop", sync });
  api = createFirestoreShiftSheetsImport({
    retentionPolicy: createShiftPlanningPublicEventRetentionPolicy({
      policyRevision: "hu083-local-acceptance-v1",
      maximumDeliveryRetryHorizonMillis: 60000,
      safetyMarginMillis: 1000,
    }),
    firestore: db,
    config: createShiftSheetsConfig({
      environment: "develop",
      workbooks: { develop: f.input.spreadsheet.spreadsheetId },
    }),
    tabs: f.tabs,
    sheets: service,
    clock: () => Timestamp.now(),
    readWorkbookVersion: async () => String(version),
  });
  const norm = await api.prepare("normalize-" + run);
  assert.equal(norm.kind, "prepared");
  assert.equal(norm.plan.patches.length, 53);
  assert.equal(
    (await api.apply("normalize-" + run, norm.plan.planDigest)).kind,
    "committed",
  );
  assert.equal(
    (await api.writeBack("normalize-" + run, norm.plan.planDigest)).kind,
    "completed",
  );
  rows = f.entries.map((e) => ({
    id: e.id,
    type: e.type,
    dateMillis: Date.parse(e.date + "T00:00:00Z"),
    assignedUserIds: e.assigned,
    helperUserId:
      e.type === "delivery"
        ? (f.entries
            .filter((x) => x.type === "delivery" && x.date > e.date)
            .sort((a, b) => a.date.localeCompare(b.date))[0]?.assigned[0] ??
          null)
        : null,
    status: "planned",
    source: "app",
  }));
  snapshotAfter = await readAll();
  phaseDigests.normalized = digest(inventory(fields(snapshotAfter)));
  state = "forward";
  return oracle();
};
const synchronize = async () => {
  assert.equal(state, "forward");
  await assertUnchanged(snapshotAfter);
  setCell(
    service.state.sheets.find((s) => s.properties.sheetId === target.sheetId),
    target.row,
    4,
    { userEnteredValue: { stringValue: "Lo hace " + replacement.displayName } },
  );
  version++;
  const request = "boundary-" + run,
    prepared = await api.prepare(request);
  assert.equal(prepared.kind, "prepared");
  assert.deepEqual(
    prepared.plan.patches.map((p) => p.id).sort(),
    [target.id, predecessor.id].sort(),
  );
  assert.equal(
    (await api.apply(request, prepared.plan.planDigest)).kind,
    "committed",
  );
  assert.equal(
    (await api.apply(request, prepared.plan.planDigest)).kind,
    "replayed",
  );
  assert.equal(
    (await api.writeBack(request, prepared.plan.planDigest)).kind,
    "completed",
  );
  assert.equal((await api.prepare("settled-" + run)).kind, "unchanged");
  const current = await readAll();
  for (const [p, d] of snapshotAfter)
    if (p.includes("/shifts/")) {
      const updated = current.get(p).payload;
      if (![target.id, predecessor.id].includes(p.split("/").pop()))
        assert.deepEqual(updated, d.payload);
      else
        for (const key of [
          "rotationOwnerUserId",
          "rotationOwnerUserIds",
          "roundNumber",
          "positionInRound",
          "rotationPositions",
          "completion",
        ])
          assert.deepEqual(updated[key], d.payload[key]);
    }
  assert.equal(
    (await db.collection(`${root}/notificationEvents`).get()).size,
    0,
  );
  rows = rows.map((r) =>
    r.id === target.id
      ? { ...r, assignedUserIds: [replacement.id] }
      : r.id === predecessor.id
        ? { ...r, helperUserId: replacement.id }
        : r,
  );
  snapshotAfter = current;
  phaseDigests.synchronized = digest(inventory(fields(snapshotAfter)));
  state = "synchronized";
  return oracle();
};
const restore = async () => {
  assert.equal(state, "synchronized");
  await assertUnchanged(snapshotAfter);
  // Exercise the same inverse guards against an extra record and ABA timestamp drift.
  const extra = db.doc(`${root}/shifts/acceptance-unexpected`);
  await extra.create({ sentinel: true });
  await assert.rejects(() => assertUnchanged(snapshotAfter), /payload drift/);
  assert((await extra.get()).exists);
  await extra.delete();
  const driftPath = [...snapshotAfter.keys()].find((p) =>
    p.includes("/shifts/"),
  );
  const stable = snapshotAfter.get(driftPath).payload;
  await db.doc(driftPath).set({ ...stable, acceptanceDrift: true });
  await db.doc(driftPath).set(stable);
  await assert.rejects(
    () => assertUnchanged(snapshotAfter),
    /update time drift/,
  );
  const renewed = await readAll();
  assert.deepEqual(
    inventory(fields(renewed)),
    inventory(fields(snapshotAfter)),
  );
  // Renew the local guard only after the deliberate probe restored exact fields.
  snapshotAfter = renewed;
  await db.runTransaction(async (tx) => {
    const docs = await tx.getAll(
      ...[...snapshotAfter.keys(), ...old.keys()].map((p) => db.doc(p)),
    );
    for (const d of docs)
      if (d.exists)
        assert(d.updateTime.isEqual(snapshotAfter.get(d.ref.path).updateTime));
    for (const p of snapshotAfter.keys())
      if (!untouched.has(p)) tx.delete(db.doc(p));
    for (const [p, d] of old) tx.create(db.doc(p), d);
  });
  const after = await readAll();
  assert.deepEqual(
    inventory(fields(after)),
    inventory(new Map([...old, ...untouched])),
  );
  for (const [p, d] of untouched) assert.deepEqual(after.get(p).payload, d);
  rows = [...old].map(([p, d]) => ({
    id: p.split("/").pop(),
    type: d.type,
    dateMillis: d.date.toMillis(),
    assignedUserIds: d.assignedUserIds,
    helperUserId: d.helperUserId ?? null,
    status: d.status,
    source: d.source,
  }));
  state = "restored";
  save("native-controller-receipt-" + run + ".json", {
    completedAt: new Date().toISOString(),
    planDigest: plan.planDigest,
    phaseDigests: {
      ...phaseDigests,
      restored: digest(inventory(fields(after))),
    },
    forward: 72,
    syncPatches: 2,
    restored: 62,
    inverseExtraDocumentRejected: true,
    inverseSameFieldsNewUpdateTimeRejected: true,
    usersUnchanged: 48,
    calendarUnchanged: 4,
    baseline: baselineRef,
    liveWrites: 0,
  });
  return oracle();
};
let queue = Promise.resolve();
const handled = new Set();
const stop = db.collection("hu083AcceptanceCommands").onSnapshot((s) => {
  for (const c of s.docChanges()) {
    if (
      c.type !== "added" ||
      handled.has(c.doc.id) ||
      c.doc.get("oracle") ||
      c.doc.get("error")
    )
      continue;
    handled.add(c.doc.id);
    queue = queue.then(async () => {
      try {
        const action = c.doc.get("action");
        assert(["forward", "synchronize", "restore"].includes(action));
        const result = await { forward: begin, synchronize, restore }[action]();
        await c.doc.ref.update({ oracle: JSON.stringify(result) });
        console.log(JSON.stringify({ action, count: result.rows.length, run }));
      } catch (e) {
        console.error(e.stack);
        await c.doc.ref.update({ error: e.message });
      }
    });
  }
});
console.log(
  JSON.stringify({
    ready: true,
    project: process.env.GCLOUD_PROJECT,
    planDigest: plan.planDigest,
  }),
);
process.on("SIGINT", () => {
  stop();
  db.terminate().then(() => process.exit());
});
