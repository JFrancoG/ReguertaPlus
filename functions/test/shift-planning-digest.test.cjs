const assert = require("node:assert/strict");
const {test} = require("node:test");

const {
  SHIFT_PLANNING_DIGEST_PREFIX,
  canonicalShiftPlanningJson,
  createShiftPlanningDigest,
  createShiftPlanningFairnessDigest,
  normalizeShiftPlanningFairnessSnapshot,
} = require("../lib/shift-planning-digest.js");

const fairnessSnapshot = () => ({
  snapshotVersion: 1,
  writeEpoch: 7,
  activeRevision: "active-6",
  activeDigest: `shift-planning:v1:sha256:${"a".repeat(64)}`,
  membership: {
    version: "members-12",
    digest: "members-digest-12",
  },
  roster: [
    {
      userId: "member-b",
      roles: ["producer", "member"],
      isActive: true,
      isCommonPurchaseManager: true,
    },
    {
      userId: "member-a",
      roles: ["member", "admin"],
      isActive: true,
      isCommonPurchaseManager: false,
    },
  ],
  rotations: {
    delivery: {
      version: "delivery-4",
      cohortUserIds: ["member-b", "member-a"],
      cursor: {roundNumber: 2, nextMemberIndex: 1},
    },
    market: {
      version: "market-3",
      cohortUserIds: ["member-a", "member-b"],
      cursor: {roundNumber: 1, nextMemberIndex: 0},
    },
  },
  config: {
    version: "config-8",
    deliveryDay: 4,
    timeZone: "Europe/Madrid",
  },
  calendar: {
    version: "calendar-15",
    deliveryDates: ["2026-09-03", "2026-09-10"],
    marketDates: ["2026-09-19", "2026-10-17"],
  },
  overrides: {
    version: "overrides-2",
    entries: [{date: "2026-09-10", deliveryDate: "2026-09-11"}],
  },
  creditLedger: {
    enabled: false,
    version: "ledger-disabled-v1",
  },
  sync: {
    revision: "sync-3",
    partitions: {
      delivery: {epoch: 4},
      market: {epoch: 8},
    },
  },
  migrationBaseline: {
    revision: "baseline-4",
    digest: `shift-planning:v1:sha256:${"b".repeat(64)}`,
  },
  projectionOrder: ["delivery", "market"],
});

const digestCode = (expectedCode) => (error) =>
  error instanceof Error && error.code === expectedCode;

test("serializes plain JSON objects canonically at every nesting level", () => {
  const left = {
    z: 0,
    a: [3, {b: 2, a: 1}],
    nested: {second: false, first: null},
  };
  const right = {
    nested: {first: null, second: false},
    a: [3, {a: 1, b: 2}],
    z: 0,
  };

  assert.equal(
    canonicalShiftPlanningJson(left),
    "{\"a\":[3,{\"a\":1,\"b\":2}],\"nested\":{\"first\":null,\"second\":false},\"z\":0}",
  );
  assert.equal(canonicalShiftPlanningJson(left), canonicalShiftPlanningJson(right));
  assert.equal(createShiftPlanningDigest(left), createShiftPlanningDigest(right));
});

test("returns a versioned SHA-256 digest and preserves array order", () => {
  const forward = createShiftPlanningDigest({values: ["a", "b", "c"]});
  const reverse = createShiftPlanningDigest({values: ["c", "b", "a"]});

  assert.match(
    forward,
    /^shift-planning:v1:sha256:[a-f0-9]{64}$/,
  );
  assert.equal(forward.startsWith(SHIFT_PLANNING_DIGEST_PREFIX), true);
  assert.notEqual(forward, reverse);
  assert.notEqual(
    createShiftPlanningDigest({value: 0}),
    createShiftPlanningDigest({value: -1}),
  );
});

test("keeps the v1 canonical digest vector stable", () => {
  assert.equal(
    createShiftPlanningDigest({a: [1, true, null, "x"], z: {b: 2, a: "á"}}),
    "shift-planning:v1:sha256:bf6371965bcefc4079fdf1ac8fd7b116e01ef7582dee4ab51a1eddf8a213eb79",
  );
});

test("accepts shared acyclic references without treating them as cycles", () => {
  const shared = {value: "same"};

  assert.equal(
    canonicalShiftPlanningJson({left: shared, right: shared}),
    "{\"left\":{\"value\":\"same\"},\"right\":{\"value\":\"same\"}}",
  );
});

test("rejects undefined, non-finite numbers, and non-JSON primitives", () => {
  const invalidValues = [
    undefined,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    1n,
    Symbol("not-json"),
    () => "not-json",
    {nested: undefined},
    ["valid", undefined],
  ];

  for (const value of invalidValues) {
    assert.throws(
      () => createShiftPlanningDigest(value),
      digestCode("invalid_shift_planning_digest_input"),
    );
  }
});

test("rejects dates, collections, class instances, and other non-plain objects", () => {
  class CustomValue {
    constructor() {
      this.value = "custom";
    }
  }

  for (const value of [
    new Date("2026-09-01T00:00:00.000Z"),
    new Map([["a", 1]]),
    new Set(["a"]),
    new CustomValue(),
    /pattern/u,
  ]) {
    assert.throws(
      () => canonicalShiftPlanningJson(value),
      digestCode("invalid_shift_planning_digest_input"),
    );
  }
});

test("rejects cycles, sparse arrays, accessors, symbols, and discarded properties", () => {
  const directCycle = {};
  directCycle.self = directCycle;

  const indirectCycle = {child: {}};
  indirectCycle.child.parent = indirectCycle;

  const sparse = [];
  sparse.length = 1;

  const withExtraArrayProperty = ["a"];
  withExtraArrayProperty.extra = "discarded-by-json";

  const withAccessor = {};
  Object.defineProperty(withAccessor, "value", {
    enumerable: true,
    get: () => "computed",
  });

  const withHiddenProperty = {visible: true};
  Object.defineProperty(withHiddenProperty, "hidden", {
    enumerable: false,
    value: "discarded-by-json",
  });

  const withSymbolProperty = {visible: true};
  withSymbolProperty[Symbol("hidden")] = "discarded-by-json";

  for (const value of [
    directCycle,
    indirectCycle,
    sparse,
    withExtraArrayProperty,
    withAccessor,
    withHiddenProperty,
    withSymbolProperty,
  ]) {
    assert.throws(
      () => canonicalShiftPlanningJson(value),
      digestCode("invalid_shift_planning_digest_input"),
    );
  }
});

test("normalizes roster member and role order without mutating the source", () => {
  const source = fairnessSnapshot();
  const original = structuredClone(source);
  const normalized = normalizeShiftPlanningFairnessSnapshot(source);

  assert.deepEqual(source, original);
  assert.deepEqual(
    normalized.roster.map(({userId, roles}) => ({userId, roles})),
    [
      {userId: "member-a", roles: ["admin", "member"]},
      {userId: "member-b", roles: ["member", "producer"]},
    ],
  );
  assert.deepEqual(
    normalized.rotations.delivery.cohortUserIds,
    ["member-b", "member-a"],
  );
  assert.deepEqual(normalized.projectionOrder, ["delivery", "market"]);
});

test("treats roster as a userId set while retaining member data", () => {
  const left = fairnessSnapshot();
  const right = fairnessSnapshot();
  right.roster = [
    {
      ...right.roster[1],
      roles: [...right.roster[1].roles].reverse(),
    },
    {
      ...right.roster[0],
      roles: [...right.roster[0].roles].reverse(),
    },
  ];

  assert.equal(
    createShiftPlanningFairnessDigest(left),
    createShiftPlanningFairnessDigest(right),
  );

  right.roster[0].isActive = false;
  assert.notEqual(
    createShiftPlanningFairnessDigest(left),
    createShiftPlanningFairnessDigest(right),
  );
});

test("preserves cohort, cursor, and every other semantically ordered list", () => {
  const source = fairnessSnapshot();
  const cohortReordered = structuredClone(source);
  cohortReordered.rotations.delivery.cohortUserIds.reverse();
  const calendarReordered = structuredClone(source);
  calendarReordered.calendar.deliveryDates.reverse();
  const projectionReordered = structuredClone(source);
  projectionReordered.projectionOrder.reverse();

  const digest = createShiftPlanningFairnessDigest(source);
  assert.notEqual(digest, createShiftPlanningFairnessDigest(cohortReordered));
  assert.notEqual(digest, createShiftPlanningFairnessDigest(calendarReordered));
  assert.notEqual(digest, createShiftPlanningFairnessDigest(projectionReordered));
});

test("changes for every fairness version, baseline, and write epoch input", () => {
  const source = fairnessSnapshot();
  const digest = createShiftPlanningFairnessDigest(source);
  const mutations = [
    (value) => { value.snapshotVersion += 1; },
    (value) => { value.writeEpoch += 1; },
    (value) => { value.activeRevision = "active-7"; },
    (value) => {
      value.activeDigest = `shift-planning:v1:sha256:${"b".repeat(64)}`;
    },
    (value) => { value.membership.version = "members-13"; },
    (value) => { value.rotations.delivery.version = "delivery-5"; },
    (value) => { value.rotations.delivery.cursor.nextMemberIndex = 0; },
    (value) => { value.config.version = "config-9"; },
    (value) => { value.config.deliveryDay = 5; },
    (value) => { value.calendar.version = "calendar-16"; },
    (value) => { value.calendar.deliveryDates[0] = "2026-09-04"; },
    (value) => { value.overrides.version = "overrides-3"; },
    (value) => { value.overrides.entries[0].deliveryDate = "2026-09-12"; },
    (value) => { value.creditLedger.version = "ledger-enabled-v1"; },
    (value) => { value.creditLedger.enabled = true; },
    (value) => { value.sync.revision = "sync-4"; },
    (value) => { value.sync.partitions.delivery.epoch += 1; },
    (value) => { value.migrationBaseline.revision = "baseline-5"; },
    (value) => {
      value.migrationBaseline.digest =
        `shift-planning:v1:sha256:${"c".repeat(64)}`;
    },
    (value) => { value.migrationBaseline = null; },
  ];

  for (const mutate of mutations) {
    const changed = structuredClone(source);
    mutate(changed);
    assert.notEqual(digest, createShiftPlanningFairnessDigest(changed));
  }
});

test("rejects incomplete snapshots and structurally invalid rosters", () => {
  const requiredFields = [
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
  ];

  for (const field of requiredFields) {
    const incomplete = fairnessSnapshot();
    delete incomplete[field];
    assert.throws(
      () => createShiftPlanningFairnessDigest(incomplete),
      digestCode("invalid_shift_planning_fairness_snapshot"),
    );
  }

  const invalidSnapshots = [
    {...fairnessSnapshot(), snapshotVersion: 0},
    {...fairnessSnapshot(), writeEpoch: -1},
    {...fairnessSnapshot(), activeRevision: null},
    {...fairnessSnapshot(), activeDigest: null},
    {...fairnessSnapshot(), activeRevision: " padded "},
    {...fairnessSnapshot(), activeDigest: "invalid-digest"},
    {...fairnessSnapshot(), migrationBaseline: {}},
    {
      ...fairnessSnapshot(),
      migrationBaseline: {
        revision: "baseline-4",
        digest: "invalid-digest",
      },
    },
    {...fairnessSnapshot(), roster: "not-an-array"},
    {...fairnessSnapshot(), roster: [{userId: "", roles: ["member"]}]},
    {...fairnessSnapshot(), roster: [{userId: "member-a", roles: "member"}]},
    {...fairnessSnapshot(), roster: [{userId: "member-a", roles: ["member", 1]}]},
    {
      ...fairnessSnapshot(),
      roster: [
        {userId: "member-a", roles: ["member"]},
        {userId: "member-a", roles: ["admin"]},
      ],
    },
  ];

  for (const snapshot of invalidSnapshots) {
    assert.throws(
      () => normalizeShiftPlanningFairnessSnapshot(snapshot),
      digestCode("invalid_shift_planning_fairness_snapshot"),
    );
  }
});

test("keeps non-roster role arrays ordered", () => {
  const left = fairnessSnapshot();
  left.policyAudit = {roles: ["admin", "member"]};
  const right = structuredClone(left);
  right.policyAudit.roles.reverse();

  assert.notEqual(
    createShiftPlanningFairnessDigest(left),
    createShiftPlanningFairnessDigest(right),
  );
});
