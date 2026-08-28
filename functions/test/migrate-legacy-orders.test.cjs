const assert = require("node:assert/strict");
const {test} = require("node:test");

const {
  FIXED_WEEK_KEYS,
  assertSafeLegacyOrderMigrationPlan,
  buildLegacyOrderMigrationPlan,
  canonicalizeComparableValue,
  computeLegacyOrderMigrationDigest,
  includeNumericWeekTargetOrder,
  listQueryDocuments,
  parseLegacyOrderMigrationArgs,
  redactedPlanSummary,
  runLegacyOrderMigration,
} = require("../scripts/migrate-legacy-orders.cjs");

const SOURCE_CREATE_TIME = new Date("2026-07-09T08:30:00.000Z");
const SOURCE_UPDATE_TIME = new Date("2026-07-09T09:45:00.000Z");
const TARGET_CREATE_TIME = new Date("2026-07-10T08:30:00.000Z");
const TARGET_UPDATE_TIME = new Date("2026-07-10T09:45:00.000Z");

const RENUNCIATION_PRODUCT_ID = "atFiXuTxsuy90ig2X9UQ";
const RENUNCIATION_TARGET_PRODUCT_ID = "ERy0QEktDQ4IFMajfqAj";
const HALF_KILO_PRODUCT_ID = "3LdNWBheI22Zqzv7wumo";
const KILO_TARGET_PRODUCT_ID = "WbxQuHm6JBqrHrqptVvm";

function snapshot(id, data, metadata = {}) {
  return {
    id,
    data,
    createTime: Object.hasOwn(metadata, "createTime") ?
      metadata.createTime : SOURCE_CREATE_TIME,
    updateTime: Object.hasOwn(metadata, "updateTime") ?
      metadata.updateTime : SOURCE_UPDATE_TIME,
  };
}

function sourceOrder(overrides = {}, metadata = {}) {
  const id = overrides.id ?? "order-member-1-week-28";
  const data = {
    userId: "member-1",
    name: "Ada",
    surname: "Lovelace",
    week: 28,
    ...overrides,
  };
  delete data.id;
  return snapshot(id, data, metadata);
}

function sourceOrderLine(overrides = {}, metadata = {}) {
  const id = overrides.id ?? "line-member-1-week-28";
  const data = {
    orderId: "order-member-1-week-28",
    productId: "product-1",
    userId: "member-1",
    companyName: "Huerta Uno",
    quantity: 2,
    subtotal: 8.5,
    week: 28,
    ...overrides,
  };
  delete data.id;
  return snapshot(id, data, metadata);
}

function product(overrides = {}) {
  const id = overrides.id ?? "product-1";
  const data = {
    vendorId: "vendor-product",
    companyName: "Huerta Uno",
    name: "Tomate",
    productImageUrl: "https://example.test/tomate.jpg",
    price: 5,
    pricingMode: "fixed",
    isEcoBasket: false,
    packContainerName: "Caja",
    packContainerPlural: "Cajas",
    packContainerAbbreviation: "caja",
    packContainerQty: 1,
    unitName: "kilo",
    unitPlural: "kilos",
    unitAbbreviation: "kg",
    unitQty: 1,
    ...overrides,
  };
  delete data.id;
  return snapshot(id, data);
}

function targetSnapshot(id, data) {
  return snapshot(id, data, {
    createTime: TARGET_CREATE_TIME,
    updateTime: TARGET_UPDATE_TIME,
  });
}

function buildPlan(overrides = {}) {
  return buildLegacyOrderMigrationPlan({
    sourceOrders: [sourceOrder()],
    sourceOrderLines: [sourceOrderLine()],
    targetOrders: [],
    targetOrderLines: [],
    products: [product()],
    weekKey: "2026-W28",
    ...overrides,
  });
}

function allWrites(plan) {
  return plan.groups.flatMap((group) => group.writes);
}

function writeFor(plan, collection, documentId) {
  return allWrites(plan).find((write) =>
    write.collection === collection && write.documentId === documentId
  );
}

function blockerCodes(plan) {
  return plan.blockers.map((blocker) => blocker.code);
}

test("migration arguments require one of seven 2026 weeks and dry-run", () => {
  assert.deepEqual(FIXED_WEEK_KEYS, [
    "2026-W28",
    "2026-W29",
    "2026-W30",
    "2026-W31",
    "2026-W32",
    "2026-W33",
    "2026-W34",
  ]);

  assert.deepEqual(parseLegacyOrderMigrationArgs([
    "--project",
    "reguerta-test",
    "--target-env",
    "develop",
    "--week",
    "2026-W28",
  ]), {
    apply: false,
    projectId: "reguerta-test",
    targetEnvironment: "develop",
    weekKey: "2026-W28",
    expectedPlanDigest: null,
  });
});

test("migration arguments reject implicit or expanded scope", () => {
  const exactScope = [
    "--project",
    "reguerta-test",
    "--target-env",
    "production",
    "--week",
    "2026-W28",
  ];

  assert.throws(
    () => parseLegacyOrderMigrationArgs(exactScope.slice(2)),
    /project/i,
  );
  assert.throws(
    () => parseLegacyOrderMigrationArgs([
      ...exactScope.slice(0, 3),
      "develop,production",
      ...exactScope.slice(4),
    ]),
    /target-env|develop|production/i,
  );
  assert.throws(
    () => parseLegacyOrderMigrationArgs(exactScope.map((value) =>
      value === "2026-W28" ? "2026-W27" : value
    )),
    /2026-W28|scope/i,
  );
  assert.throws(
    () => parseLegacyOrderMigrationArgs(exactScope.map((value) =>
      value === "2026-W28" ? "2026-W35" : value
    )),
    /2026-W34|scope/i,
  );
  assert.throws(
    () => parseLegacyOrderMigrationArgs([...exactScope, "--source-env", "develop"]),
    /unsupported/i,
  );
  assert.throws(
    () => parseLegacyOrderMigrationArgs([
      ...exactScope,
      "--week",
      "2026-W29",
    ]),
    /duplicate.*week/i,
  );
});

test("apply requires the exact dry-run digest", () => {
  const digest = "a".repeat(64);
  const applyScope = [
    "--project",
    "reguerta-test",
    "--target-env",
    "production",
    "--week",
    "2026-W28",
    "--apply",
  ];

  assert.throws(
    () => parseLegacyOrderMigrationArgs(applyScope),
    /expected-plan-digest/i,
  );
  assert.throws(
    () => parseLegacyOrderMigrationArgs([
      ...applyScope,
      "--expected-plan-digest",
      "not-a-sha256",
    ]),
    /digest|hex/i,
  );
  assert.deepEqual(parseLegacyOrderMigrationArgs([
    ...applyScope,
    "--expected-plan-digest",
    digest,
  ]), {
    apply: true,
    projectId: "reguerta-test",
    targetEnvironment: "production",
    weekKey: "2026-W28",
    expectedPlanDigest: digest,
  });
});

test("programmatic runner enforces the same fixed scope before Firestore access", async () => {
  const options = {
    apply: false,
    projectId: "reguerta-test",
    targetEnvironment: "rogue",
    weekKey: "2026-W28",
    expectedPlanDigest: null,
  };
  const inaccessibleFirestore = new Proxy({}, {
    get() {
      throw new Error("Firestore must not be accessed");
    },
  });

  await assert.rejects(
    runLegacyOrderMigration(options, {firestore: inaccessibleFirestore}),
    /target-env|develop|production/i,
  );
  await assert.rejects(
    runLegacyOrderMigration({...options, targetEnvironment: "develop", apply: "yes"}, {
      firestore: inaccessibleFirestore,
    }),
    /boolean apply/i,
  );
  assert.throws(
    () => buildLegacyOrderMigrationPlan({targetEnvironment: "rogue"}),
    /target-env|develop|production/i,
  );
});

test("live runner rejects a different project and inherited emulator routing", async () => {
  const inaccessibleFirestore = new Proxy({}, {
    get() {
      throw new Error("Firestore must not be accessed");
    },
  });
  const options = {
    apply: false,
    projectId: "different-project",
    targetEnvironment: "develop",
    weekKey: "2026-W28",
    expectedPlanDigest: null,
  };

  await assert.rejects(
    runLegacyOrderMigration(options, {firestore: inaccessibleFirestore}),
    /live migration project.*reguerta-9f27f/i,
  );

  const previousEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  try {
    await assert.rejects(
      runLegacyOrderMigration({...options, projectId: "reguerta-9f27f"}),
      /live migration cli refuses the firestore emulator/i,
    );
  } finally {
    if (previousEmulatorHost === undefined) {
      delete process.env.FIRESTORE_EMULATOR_HOST;
    } else {
      process.env.FIRESTORE_EMULATOR_HOST = previousEmulatorHost;
    }
  }
});

test("missing targets produce canonical create-only order groups", () => {
  const plan = buildPlan({
    sourceOrderLines: [sourceOrderLine({
      vendorId: "vendor-source",
      priceAtOrder: 4.25,
      productName: "Stale source name",
      productImageUrl: "https://example.test/stale-source.jpg",
    })],
    products: [product({
      vendorId: "vendor-catalog",
      price: 9.99,
      isEcoBasket: true,
    })],
  });

  assert.doesNotThrow(() => assertSafeLegacyOrderMigrationPlan(plan));
  assert.deepEqual(plan.blockers, []);
  assert.equal(plan.groups.length, 1);
  assert.equal(plan.groups[0].orderId, "order-member-1-week-28");
  assert.equal(plan.groups[0].weekKey, "2026-W28");

  const orderWrite = writeFor(
    plan,
    "orders",
    "order-member-1-week-28",
  );
  const lineWrite = writeFor(
    plan,
    "orderlines",
    "line-member-1-week-28",
  );
  assert.ok(orderWrite);
  assert.ok(lineWrite);
  assert.equal(orderWrite.operation, "create");
  assert.equal(lineWrite.operation, "create");
  assert.equal(orderWrite.targetUpdateTime, null);
  assert.equal(lineWrite.targetUpdateTime, null);
  assert.deepEqual(orderWrite.sourceUpdateTime, SOURCE_UPDATE_TIME);
  assert.deepEqual(lineWrite.sourceUpdateTime, SOURCE_UPDATE_TIME);

  assert.deepEqual(Object.keys(orderWrite.data).sort(), [
    "confirmedAt",
    "consumerDisplayName",
    "consumerStatus",
    "createdAt",
    "deliveryDate",
    "isAutoGenerated",
    "producerStatus",
    "total",
    "totalsByVendor",
    "updatedAt",
    "userId",
    "week",
    "weekKey",
  ].sort());
  assert.equal(orderWrite.data.userId, "member-1");
  assert.equal(orderWrite.data.consumerDisplayName, "Ada Lovelace");
  assert.equal(orderWrite.data.week, 28);
  assert.equal(orderWrite.data.weekKey, "2026-W28");
  assert.equal(orderWrite.data.consumerStatus, "confirmed");
  assert.equal(orderWrite.data.producerStatus, "delivered");
  assert.equal(orderWrite.data.total, 8.5);
  assert.deepEqual(orderWrite.data.totalsByVendor, {
    "vendor-catalog": 8.5,
  });
  assert.equal(orderWrite.data.isAutoGenerated, false);
  assert.equal("consumerState" in orderWrite.data, false);
  assert.equal("memberId" in orderWrite.data, false);
  assert.equal(orderWrite.data.createdAt instanceof Date, true);
  assert.equal(orderWrite.data.updatedAt instanceof Date, true);
  assert.equal(orderWrite.data.confirmedAt instanceof Date, true);
  assert.equal(orderWrite.data.deliveryDate instanceof Date, true);
  assert.equal(
    orderWrite.data.confirmedAt.toISOString(),
    "2026-07-12T10:00:00.000Z",
  );
  assert.equal(
    orderWrite.data.deliveryDate.toISOString(),
    "2026-07-07T22:00:00.000Z",
  );

  assert.deepEqual(Object.keys(lineWrite.data).sort(), [
    "companyName",
    "consumerDisplayName",
    "createdAt",
    "ecoBasketOption",
    "orderId",
    "packContainerAbbreviation",
    "packContainerName",
    "packContainerPlural",
    "packContainerQty",
    "priceAtOrder",
    "pricingModeAtOrder",
    "productId",
    "productImageUrl",
    "productName",
    "quantity",
    "subtotal",
    "unitAbbreviation",
    "unitName",
    "unitPlural",
    "unitQty",
    "updatedAt",
    "userId",
    "vendorId",
    "week",
    "weekKey",
  ].sort());
  assert.equal(lineWrite.data.orderId, "order-member-1-week-28");
  assert.equal(lineWrite.data.userId, "member-1");
  assert.equal(lineWrite.data.productId, "product-1");
  assert.equal(lineWrite.data.vendorId, "vendor-catalog");
  assert.equal(lineWrite.data.productName, "Tomate");
  assert.equal(lineWrite.data.productImageUrl, "https://example.test/tomate.jpg");
  assert.equal(lineWrite.data.priceAtOrder, 9.99);
  assert.equal(lineWrite.data.ecoBasketOption, "pickup");
  assert.equal(lineWrite.data.weekKey, "2026-W28");
  assert.equal("ecoBasketOptionAtOrder" in lineWrite.data, false);
  assert.equal("memberId" in lineWrite.data, false);
});

test("renunciation and half-kilo legacy products map without losing totals", () => {
  const plan = buildPlan({
    sourceOrderLines: [
      sourceOrderLine({
        id: "line-renunciation",
        productId: RENUNCIATION_PRODUCT_ID,
        quantity: 1,
        subtotal: 12,
      }),
      sourceOrderLine({
        id: "line-half-kilo",
        productId: HALF_KILO_PRODUCT_ID,
        quantity: 3,
        subtotal: 9,
      }),
    ],
    products: [
      product({
        id: RENUNCIATION_TARGET_PRODUCT_ID,
        vendorId: "eco-vendor",
        name: "Ecocesta",
        price: 12,
        isEcoBasket: true,
      }),
      product({
        id: KILO_TARGET_PRODUCT_ID,
        vendorId: "fruit-vendor",
        name: "Fruta por kilo",
        price: 6,
      }),
    ],
  });

  assert.doesNotThrow(() => assertSafeLegacyOrderMigrationPlan(plan));
  const renunciation = writeFor(plan, "orderlines", "line-renunciation");
  const halfKilo = writeFor(plan, "orderlines", "line-half-kilo");
  const order = writeFor(plan, "orders", "order-member-1-week-28");

  assert.equal(renunciation.data.productId, RENUNCIATION_TARGET_PRODUCT_ID);
  assert.equal(renunciation.data.quantity, 1);
  assert.equal(renunciation.data.ecoBasketOption, "no_pickup");
  assert.equal(renunciation.data.vendorId, "eco-vendor");
  assert.equal(halfKilo.data.productId, KILO_TARGET_PRODUCT_ID);
  assert.equal(halfKilo.data.quantity, 1.5);
  assert.equal(halfKilo.data.priceAtOrder, 6);
  assert.equal(halfKilo.data.ecoBasketOption, null);
  assert.equal(halfKilo.data.vendorId, "fruit-vendor");
  assert.equal(order.data.total, 21);
  assert.deepEqual(order.data.totalsByVendor, {
    "eco-vendor": 12,
    "fruit-vendor": 9,
  });
});

test("historical product prices retain the published migrator cent rounding", () => {
  const plan = buildPlan({
    products: [product({price: 2.965, pricingMode: "weight"})],
  });
  assert.doesNotThrow(() => assertSafeLegacyOrderMigrationPlan(plan));
  const line = writeFor(plan, "orderlines", "line-member-1-week-28");
  assert.equal(line.data.priceAtOrder, 2.97);
  assert.equal(line.data.subtotal, 8.5);

  const binaryBoundaryPlan = buildPlan({
    sourceOrderLines: [sourceOrderLine({subtotal: 1.005})],
    products: [product({price: 1.005})],
  });
  const binaryBoundaryLine = writeFor(
    binaryBoundaryPlan,
    "orderlines",
    "line-member-1-week-28",
  );
  assert.equal(binaryBoundaryLine.data.priceAtOrder, 1);
  assert.equal(binaryBoundaryLine.data.subtotal, 1);
  assert.equal(
    writeFor(binaryBoundaryPlan, "orders", "order-member-1-week-28").data.total,
    1,
  );
});

test("identical targets are no-ops while divergent targets block apply", () => {
  const createPlan = buildPlan();
  const orderWrite = writeFor(
    createPlan,
    "orders",
    "order-member-1-week-28",
  );
  const lineWrite = writeFor(
    createPlan,
    "orderlines",
    "line-member-1-week-28",
  );
  const alignedPlan = buildPlan({
    targetOrders: [targetSnapshot(orderWrite.documentId, orderWrite.data)],
    targetOrderLines: [targetSnapshot(lineWrite.documentId, lineWrite.data)],
  });

  assert.deepEqual(alignedPlan.blockers, []);
  assert.equal(allWrites(alignedPlan).length, 0);
  assert.doesNotThrow(() => assertSafeLegacyOrderMigrationPlan(alignedPlan));

  const divergentPlan = buildPlan({
    targetOrders: [targetSnapshot(orderWrite.documentId, {
      ...orderWrite.data,
      total: 999,
    })],
    targetOrderLines: [targetSnapshot(lineWrite.documentId, lineWrite.data)],
  });
  assert.ok(blockerCodes(divergentPlan).includes("target-divergence"));
  assert.throws(
    () => assertSafeLegacyOrderMigrationPlan(divergentPlan),
    /target-divergence|divergen/i,
  );

  const shadowedProducerStatus = buildPlan({
    targetOrders: [targetSnapshot(orderWrite.documentId, {
      ...orderWrite.data,
      producerStatusesByVendor: {"vendor-product": "prepared"},
    })],
    targetOrderLines: [targetSnapshot(lineWrite.documentId, lineWrite.data)],
  });
  assert.ok(blockerCodes(shadowedProducerStatus).includes("target-divergence"));

  const contradictoryTargetIdentity = buildPlan({
    targetOrders: [targetSnapshot("alternate-order", {
      userId: "different-member",
      memberId: "member-1",
      week: 28,
      weekKey: "2026-W28",
    })],
  });
  assert.ok(blockerCodes(contradictoryTargetIdentity).includes(
    "malformed-target-order",
  ));

  const contradictoryTargetWeek = buildPlan({
    targetOrders: [targetSnapshot("alternate-order", {
      userId: "member-1",
      week: 28,
      weekKey: "2026-W29",
    })],
  });
  assert.ok(blockerCodes(contradictoryTargetWeek).includes(
    "malformed-target-order",
  ));

  const outsideWeekExactIdCollision = buildPlan({
    targetOrders: [targetSnapshot("order-member-1-week-28", {
      userId: "member-1",
      week: 28,
      weekKey: "2025-W28",
    })],
  });
  assert.ok(blockerCodes(outsideWeekExactIdCollision).includes(
    "target-divergence",
  ));

  const contradictoryTargetLineIdentity = buildPlan({
    targetOrderLines: [targetSnapshot(lineWrite.documentId, {
      ...lineWrite.data,
      memberId: "different-member",
    })],
  });
  assert.ok(blockerCodes(contradictoryTargetLineIdentity).includes(
    "malformed-target-orderline",
  ));

  const nonFiniteTargetLine = buildPlan({
    targetOrderLines: [targetSnapshot(lineWrite.documentId, {
      ...lineWrite.data,
      ecoBasketOption: Number.NaN,
    })],
  });
  assert.ok(blockerCodes(nonFiniteTargetLine).includes("target-divergence"));

  const createdAtMilliseconds = orderWrite.data.createdAt.getTime();
  const mapTimestampTarget = buildPlan({
    targetOrders: [targetSnapshot(orderWrite.documentId, {
      ...orderWrite.data,
      createdAt: {
        seconds: Math.floor(createdAtMilliseconds / 1_000),
        nanoseconds: 0,
      },
    })],
  });
  assert.ok(blockerCodes(mapTimestampTarget).includes("target-divergence"));
});

test("malformed source documents block the plan", () => {
  const malformedOrderPlan = buildPlan({
    sourceOrders: [sourceOrder({userId: ""})],
  });
  assert.ok(blockerCodes(malformedOrderPlan).includes("malformed-order"));
  assert.throws(
    () => assertSafeLegacyOrderMigrationPlan(malformedOrderPlan),
    /malformed-order|malformed/i,
  );

  const malformedLinePlan = buildPlan({
    sourceOrderLines: [sourceOrderLine({quantity: 0})],
  });
  assert.ok(blockerCodes(malformedLinePlan).includes("malformed-orderline"));
  assert.throws(
    () => assertSafeLegacyOrderMigrationPlan(malformedLinePlan),
    /malformed-orderline|malformed/i,
  );

  const whitespaceOrderIdPlan = buildPlan({
    sourceOrders: [sourceOrder({id: " order-member-1-week-28"})],
    sourceOrderLines: [],
  });
  assert.ok(blockerCodes(whitespaceOrderIdPlan).includes("malformed-order"));

  const whitespaceLineIdPlan = buildPlan({
    sourceOrderLines: [sourceOrderLine({id: "line-member-1-week-28 "})],
  });
  assert.ok(blockerCodes(whitespaceLineIdPlan).includes(
    "malformed-orderline",
  ));
});

test("source createTime must prove that every legacy document is from 2026", () => {
  const missingYearPlan = buildPlan({
    sourceOrders: [sourceOrder({}, {createTime: null})],
  });
  assert.ok(missingYearPlan.blockers.length > 0);
  assert.throws(
    () => assertSafeLegacyOrderMigrationPlan(missingYearPlan),
    /createTime|2026|year/i,
  );

  const wrongYearPlan = buildPlan({
    sourceOrderLines: [sourceOrderLine({}, {
      createTime: new Date("2025-07-09T08:30:00.000Z"),
    })],
  });
  assert.ok(wrongYearPlan.blockers.length > 0);
  assert.throws(
    () => assertSafeLegacyOrderMigrationPlan(wrongYearPlan),
    /createTime|2026|year/i,
  );

  const explicitBusinessYearPlan = buildPlan({
    sourceOrderLines: [sourceOrderLine({year: 2026}, {
      createTime: new Date("2027-01-02T08:30:00.000Z"),
    })],
  });
  assert.doesNotThrow(() =>
    assertSafeLegacyOrderMigrationPlan(explicitBusinessYearPlan)
  );

  const contradictoryBusinessYearPlan = buildPlan({
    sourceOrders: [sourceOrder({year: 2025})],
  });
  assert.ok(blockerCodes(contradictoryBusinessYearPlan).includes(
    "source-year-unproven",
  ));

  const contradictoryOrderWeekKey = buildPlan({
    sourceOrders: [sourceOrder({weekKey: "2025-W28"})],
  });
  assert.ok(blockerCodes(contradictoryOrderWeekKey).includes("malformed-order"));

  const contradictoryLineWeekKey = buildPlan({
    sourceOrderLines: [sourceOrderLine({weekKey: "2026-W29"})],
  });
  assert.ok(blockerCodes(contradictoryLineWeekKey).includes(
    "malformed-orderline",
  ));
});

test("orphan lines and order owner mismatches block the plan", () => {
  const orphanPlan = buildPlan({
    sourceOrderLines: [sourceOrderLine({orderId: "missing-order"})],
  });
  assert.ok(blockerCodes(orphanPlan).includes("orphan-orderline"));

  const mismatchPlan = buildPlan({
    sourceOrderLines: [sourceOrderLine({userId: "different-member"})],
  });
  assert.ok(blockerCodes(mismatchPlan).includes("orderline-user-mismatch"));
  assert.throws(
    () => assertSafeLegacyOrderMigrationPlan(mismatchPlan),
    /orderline-user-mismatch|user.*mismatch/i,
  );
});

test("duplicate order ownership for one week blocks the plan", () => {
  const plan = buildPlan({
    sourceOrders: [
      sourceOrder({id: "order-a"}),
      sourceOrder({id: "order-b"}),
    ],
    sourceOrderLines: [sourceOrderLine({orderId: "order-a"})],
  });

  assert.ok(blockerCodes(plan).includes("duplicate-owner-week"));
  assert.deepEqual(plan.diagnostics.duplicateOwnerWeek, {
    groups: 1,
    documents: 2,
    groupSizes: [{size: 2, groups: 1}],
    weeks: [{weekKey: "2026-W28", groups: 1, documents: 2}],
  });
  assert.throws(
    () => assertSafeLegacyOrderMigrationPlan(plan),
    /duplicate-owner-week|duplicate/i,
  );
});

test("duplicate empty cart placeholders are all omitted safely", () => {
  const plan = buildPlan({
    sourceOrders: [
      sourceOrder({id: "empty-order-a"}),
      sourceOrder({id: "empty-order-b"}),
    ],
    sourceOrderLines: [],
  });

  assert.deepEqual(plan.blockers, []);
  assert.equal(plan.groups.length, 0);
  assert.equal(plan.skippedEmptyOrders.length, 2);
  assert.deepEqual(plan.diagnostics.duplicateOwnerWeek, {
    groups: 0,
    documents: 0,
    groupSizes: [],
    weeks: [],
  });
  assert.deepEqual(plan.diagnostics.emptyLegacyOrdersSkipped, {
    orders: 2,
    weeks: [{weekKey: "2026-W28", orders: 2}],
  });
  assert.doesNotThrow(() => assertSafeLegacyOrderMigrationPlan(plan));

  const collision = buildPlan({
    sourceOrders: [
      sourceOrder({id: "empty-order-a"}),
      sourceOrder({id: "empty-order-b"}),
    ],
    sourceOrderLines: [],
    targetOrders: [targetSnapshot("existing-order", {
      userId: "member-1",
      week: 28,
      weekKey: "2026-W28",
    })],
  });
  assert.ok(blockerCodes(collision).includes("target-divergence"));
});

test("a missing canonical product blocks direct and mapped lines", () => {
  const directPlan = buildPlan({products: []});
  assert.ok(blockerCodes(directPlan).includes("missing-product"));

  const mappedPlan = buildPlan({
    sourceOrderLines: [sourceOrderLine({
      productId: RENUNCIATION_PRODUCT_ID,
    })],
    products: [],
  });
  assert.ok(blockerCodes(mappedPlan).includes("missing-product"));
  assert.throws(
    () => assertSafeLegacyOrderMigrationPlan(mappedPlan),
    /missing-product|product/i,
  );
});

test("invalid catalog snapshots are rejected instead of silently replaced", () => {
  const invalidVendor = buildPlan({
    products: [product({vendorId: "invalid/vendor"})],
  });
  assert.ok(blockerCodes(invalidVendor).includes("malformed-product"));

  const invalidCatalogPrice = buildPlan({
    products: [product({price: "4.25"})],
  });
  assert.ok(blockerCodes(invalidCatalogPrice).includes(
    "malformed-product",
  ));

  const incompleteProduct = buildPlan({
    products: [product({unitPlural: null})],
  });
  assert.ok(blockerCodes(incompleteProduct).includes("malformed-product"));

  const optionalPackPlan = buildPlan({
    products: [product({
      isEcoBasket: null,
      pricingMode: null,
      packContainerName: null,
      packContainerPlural: null,
      packContainerAbbreviation: null,
      packContainerQty: null,
    })],
  });
  assert.doesNotThrow(() => assertSafeLegacyOrderMigrationPlan(optionalPackPlan));
  const optionalPackLine = writeFor(
    optionalPackPlan,
    "orderlines",
    "line-member-1-week-28",
  );
  assert.equal(optionalPackLine.data.pricingModeAtOrder, "fixed");
  assert.equal(optionalPackLine.data.ecoBasketOption, null);
  [
    "packContainerName",
    "packContainerPlural",
    "packContainerAbbreviation",
    "packContainerQty",
  ].forEach((field) => assert.equal(field in optionalPackLine.data, false));

  const invalidEcoOption = buildPlan({
    sourceOrderLines: [sourceOrderLine({ecoBasketOption: "renuncia"})],
  });
  assert.ok(blockerCodes(invalidEcoOption).includes(
    "invalid-eco-basket-option",
  ));
  assert.throws(
    () => assertSafeLegacyOrderMigrationPlan(invalidEcoOption),
    /invalid-eco-basket-option/i,
  );
});

test("legacy empty product images normalize to canonical null", () => {
  const emptyCatalogImage = buildPlan({
    sourceOrderLines: [sourceOrderLine({
      productImageUrl: "https://example.test/legacy-fallback.jpg",
    })],
    products: [product({productImageUrl: "   "})],
  });
  assert.doesNotThrow(() =>
    assertSafeLegacyOrderMigrationPlan(emptyCatalogImage)
  );
  assert.equal(
    writeFor(
      emptyCatalogImage,
      "orderlines",
      "line-member-1-week-28",
    ).data.productImageUrl,
    null,
  );

  const emptyFallbackImage = buildPlan({
    sourceOrderLines: [sourceOrderLine({productImageUrl: ""})],
    products: [product({productImageUrl: null})],
  });
  assert.doesNotThrow(() =>
    assertSafeLegacyOrderMigrationPlan(emptyFallbackImage)
  );
  assert.equal(
    writeFor(
      emptyFallbackImage,
      "orderlines",
      "line-member-1-week-28",
    ).data.productImageUrl,
    null,
  );

  const invalidImageType = buildPlan({
    products: [product({productImageUrl: 42})],
  });
  assert.ok(blockerCodes(invalidImageType).includes("malformed-product"));
  assert.deepEqual(
    invalidImageType.diagnostics.malformedProduct.affectedOrderlines.reasons,
    [{reason: "invalidProductImageUrl", count: 1, distinctProducts: 1}],
  );
});

test("product diagnostics aggregate safe field causes without identifiers", () => {
  const plan = buildPlan({
    sourceOrderLines: [
      sourceOrderLine({
        id: "line-invalid-vendor",
        productId: "product-invalid-vendor",
      }),
      sourceOrderLine({
        id: "line-invalid-price",
        productId: "product-invalid-price",
      }),
    ],
    products: [
      product({
        id: "product-invalid-vendor",
        vendorId: "invalid/vendor",
      }),
      product({
        id: "product-invalid-price",
        price: "4.25",
      }),
    ],
  });

  assert.deepEqual(plan.diagnostics.malformedProduct, {
    catalogDocuments: {count: 0, reasons: []},
    affectedOrderlines: {
      count: 2,
      distinctProducts: 2,
      reasons: [
        {reason: "invalidPrice", count: 1, distinctProducts: 1},
        {reason: "invalidVendorId", count: 1, distinctProducts: 1},
      ],
    },
  });
  const serializedDiagnostics = JSON.stringify(plan.diagnostics);
  [
    "line-invalid-vendor",
    "line-invalid-price",
    "product-invalid-vendor",
    "product-invalid-price",
    "member-1",
    "Ada",
  ].forEach((identifier) => {
    assert.equal(serializedDiagnostics.includes(identifier), false);
  });

  const invalidCatalogDocument = buildPlan({
    products: [product({id: " product-1"})],
  });
  assert.deepEqual(
    invalidCatalogDocument.diagnostics.malformedProduct.catalogDocuments,
    {
      count: 1,
      reasons: [{reason: "invalidCatalogDocumentId", count: 1}],
    },
  );
});

test("target-order diagnostics distinguish safe identity and week causes", () => {
  const plan = buildPlan({
    targetOrders: [
      targetSnapshot("target-owner-conflict", {
        userId: "member-a",
        memberId: "member-b",
        week: 28,
        weekKey: "2026-W28",
      }),
      targetSnapshot("target-invalid-owner-and-week", {
        userId: " invalid-member",
        week: 28,
      }),
      targetSnapshot("target-missing-owner", {
        week: 28,
        weekKey: "2026-W28",
      }),
      targetSnapshot("target-missing-week-key", {
        userId: "member-c",
        week: 28,
      }),
      targetSnapshot("target-invalid-week-key-type", {
        userId: "member-f",
        week: 28,
        weekKey: 28,
      }),
      targetSnapshot("target-out-of-scope-week-key", {
        userId: "member-g",
        week: 28,
        weekKey: "2025-W28",
      }),
      targetSnapshot("target-week-mismatch", {
        userId: "member-d",
        week: 29,
        weekKey: "2026-W28",
      }),
      targetSnapshot("target-noncanonical-week-key", {
        userId: "member-e",
        week: 28,
        weekKey: " 2026-W28 ",
      }),
    ],
  });

  assert.deepEqual(plan.diagnostics.malformedTargetOrder, {
    documents: 7,
    reasons: [
      {reason: "conflictingOwnerAliases", count: 1},
      {reason: "invalidOwnerAndWeekKey", count: 1},
      {reason: "invalidWeekKeyType", count: 1},
      {reason: "missingOrInvalidOwner", count: 1},
      {reason: "missingWeekKey", count: 1},
      {reason: "nonCanonicalWeekKey", count: 1},
      {reason: "weekValueMismatch", count: 1},
    ],
  });
  assert.equal(plan.diagnostics.canonicalTargetOrdersOutsideSelectedWeek, 1);
  const serializedDiagnostics = JSON.stringify(plan.diagnostics);
  [
    "target-owner-conflict",
    "member-a",
    "member-b",
    "member-c",
    "member-d",
    "member-e",
    "member-f",
    "member-g",
  ].forEach((identifier) => {
    assert.equal(serializedDiagnostics.includes(identifier), false);
  });
});

test("numeric target queries ignore only proven canonical outside weeks", () => {
  const included = (data) => includeNumericWeekTargetOrder(
    targetSnapshot("target", data),
    "2026-W28",
  );

  assert.equal(included({
    userId: "member-1",
    week: 28,
    weekKey: "2025-W28",
  }), false);
  assert.equal(included({
    userId: "member-1",
    week: 28,
    weekKey: "2026-W28",
  }), true);
  assert.equal(included({
    userId: "member-1",
    week: 28,
    weekKey: "2025-W29",
  }), true);
  assert.equal(included({
    userId: "member-1",
    memberId: "member-2",
    week: 28,
    weekKey: "2025-W28",
  }), true);
  assert.equal(included({userId: "member-1", week: 28}), true);
  assert.equal(included({
    userId: "member-1",
    week: 28,
    weekKey: " 2025-W28 ",
  }), true);
});

test("redacted dry-run summaries omit groups and document identifiers", () => {
  const plan = buildPlan({
    sourceOrders: [sourceOrder({
      id: "sensitive-order-id",
      userId: "sensitive-member-id",
      name: "Sensitive",
      surname: "Person",
    })],
    sourceOrderLines: [sourceOrderLine({
      id: "sensitive-line-id",
      orderId: "sensitive-order-id",
      productId: "sensitive-product-id",
      userId: "sensitive-member-id",
    })],
    products: [product({
      id: "sensitive-product-id",
      vendorId: "invalid/vendor",
    })],
    targetOrders: [targetSnapshot("sensitive-target-id", {
      userId: "sensitive-target-owner",
      week: 28,
    })],
  });
  const summary = {
    apply: false,
    ...redactedPlanSummary(
      plan,
      computeLegacyOrderMigrationDigest(plan),
    ),
    appliedWrites: 0,
    readBack: null,
  };

  assert.equal(Object.hasOwn(summary, "groups"), false);
  assert.equal(summary.diagnostics.malformedProduct.affectedOrderlines.count, 1);
  assert.equal(summary.diagnostics.malformedTargetOrder.documents, 1);
  const serializedSummary = JSON.stringify(summary);
  [
    "sensitive-order-id",
    "sensitive-line-id",
    "sensitive-product-id",
    "sensitive-member-id",
    "sensitive-target-id",
    "sensitive-target-owner",
    "Sensitive",
    "Person",
  ].forEach((identifier) => {
    assert.equal(serializedSummary.includes(identifier), false);
  });
});

test("orders without compatible lines report aggregate relationship causes", () => {
  const plan = buildPlan({
    sourceOrders: [
      sourceOrder({id: "order-no-lines", userId: "member-a", week: 28}),
      sourceOrder({id: "order-rejected", userId: "member-b", week: 28}),
      sourceOrder({id: "order-incompatible", userId: "member-c", week: 28}),
      sourceOrder({id: "order-mixed", userId: "member-d", week: 28}),
    ],
    sourceOrderLines: [
      sourceOrderLine({
        id: "line-rejected",
        orderId: "order-rejected",
        userId: "member-b",
        week: 28,
        quantity: 0,
      }),
      sourceOrderLine({
        id: "line-incompatible",
        orderId: "order-incompatible",
        userId: "different-member",
        week: 28,
      }),
      sourceOrderLine({
        id: "line-mixed-rejected",
        orderId: "order-mixed",
        userId: "member-d",
        week: 28,
        quantity: 0,
      }),
      sourceOrderLine({
        id: "line-mixed-incompatible",
        orderId: "order-mixed",
        userId: "different-member",
        week: 28,
      }),
    ],
  });

  assert.deepEqual(plan.diagnostics.orderWithoutOrderlines, {
    orders: 3,
    reasons: [
      {reason: "linkedOrderlinesIncompatible", count: 1},
      {reason: "linkedOrderlinesRejected", count: 1},
      {reason: "mixedRejectedAndIncompatibleOrderlines", count: 1},
    ],
    weeks: [
      {
        weekKey: "2026-W28",
        orders: 3,
        reasons: [
          {reason: "linkedOrderlinesIncompatible", count: 1},
          {reason: "linkedOrderlinesRejected", count: 1},
          {reason: "mixedRejectedAndIncompatibleOrderlines", count: 1},
        ],
      },
    ],
  });
  assert.deepEqual(plan.diagnostics.emptyLegacyOrdersSkipped, {
    orders: 1,
    weeks: [{weekKey: "2026-W28", orders: 1}],
  });
});

test("empty legacy cart placeholders are skipped without becoming orders", () => {
  const plan = buildPlan({sourceOrderLines: []});

  assert.deepEqual(plan.blockers, []);
  assert.equal(plan.groups.length, 0);
  assert.equal(plan.counts.plannedWrites, 0);
  assert.deepEqual(plan.diagnostics.emptyLegacyOrdersSkipped, {
    orders: 1,
    weeks: [{weekKey: "2026-W28", orders: 1}],
  });
  assert.doesNotThrow(() => assertSafeLegacyOrderMigrationPlan(plan));
});

test("empty legacy carts retain target collision and digest guards", () => {
  const exactOrderCollision = buildPlan({
    sourceOrderLines: [],
    targetOrders: [targetSnapshot("order-member-1-week-28", {
      userId: "member-1",
      week: 28,
      weekKey: "2025-W28",
    })],
  });
  assert.ok(blockerCodes(exactOrderCollision).includes("target-divergence"));

  const businessKeyCollision = buildPlan({
    sourceOrderLines: [],
    targetOrders: [targetSnapshot("alternate-order", {
      userId: "member-1",
      week: 28,
      weekKey: "2026-W28",
    })],
  });
  assert.ok(blockerCodes(businessKeyCollision).includes("target-divergence"));

  const linkedTargetLineCollision = buildPlan({
    sourceOrderLines: [],
    targetOrderLines: [targetSnapshot("unexpected-target-line", {
      orderId: "order-member-1-week-28",
      userId: "member-1",
    })],
  });
  assert.ok(blockerCodes(linkedTargetLineCollision).includes(
    "target-divergence",
  ));

  const baseline = buildPlan({sourceOrderLines: []});
  const changedVersion = buildPlan({
    sourceOrders: [sourceOrder({}, {
      updateTime: new Date("2026-07-09T09:46:00.000Z"),
    })],
    sourceOrderLines: [],
  });
  assert.notEqual(
    computeLegacyOrderMigrationDigest(baseline),
    computeLegacyOrderMigrationDigest(changedVersion),
  );

  const redacted = redactedPlanSummary(
    baseline,
    computeLegacyOrderMigrationDigest(baseline),
  );
  assert.equal(JSON.stringify(redacted).includes("order-member-1-week-28"), false);
});

test("comparable canonicalization and plan digests are deterministic", () => {
  const firstComparable = canonicalizeComparableValue({
    z: [2, new Date("2026-07-12T12:00:00.000Z")],
    a: {d: 4, c: 3},
  });
  const reorderedComparable = canonicalizeComparableValue({
    a: {c: 3, d: 4},
    z: [2, new Date("2026-07-12T12:00:00.000Z")],
  });
  const changedDateComparable = canonicalizeComparableValue({
    a: {c: 3, d: 4},
    z: [2, new Date("2026-07-12T12:00:01.000Z")],
  });

  assert.equal(
    JSON.stringify(firstComparable),
    JSON.stringify(reorderedComparable),
  );
  assert.notEqual(
    JSON.stringify(firstComparable),
    JSON.stringify(changedDateComparable),
  );
  assert.notDeepEqual(
    canonicalizeComparableValue({seconds: 1_785_000_000, nanoseconds: 123_456_000}),
    canonicalizeComparableValue({seconds: 1_785_000_000, nanoseconds: 123_457_000}),
  );
  assert.notDeepEqual(
    canonicalizeComparableValue(Number.NaN),
    canonicalizeComparableValue(null),
  );

  const firstPlan = buildPlan();
  const reorderedPlan = buildPlan({
    sourceOrders: [
      sourceOrder({id: "order-member-2-week-28", userId: "member-2", week: 28}),
      sourceOrder(),
    ],
    sourceOrderLines: [
      sourceOrderLine({
        id: "line-member-2-week-28",
        orderId: "order-member-2-week-28",
        userId: "member-2",
        week: 28,
      }),
      sourceOrderLine(),
    ],
  });
  const sameReorderedPlan = buildPlan({
    sourceOrders: [
      sourceOrder(),
      sourceOrder({id: "order-member-2-week-28", userId: "member-2", week: 28}),
    ],
    sourceOrderLines: [
      sourceOrderLine(),
      sourceOrderLine({
        id: "line-member-2-week-28",
        orderId: "order-member-2-week-28",
        userId: "member-2",
        week: 28,
      }),
    ],
  });
  const changedPlan = buildPlan({
    sourceOrderLines: [sourceOrderLine({subtotal: 8.51})],
  });
  const nextWeekPlan = buildPlan({
    weekKey: "2026-W29",
    sourceOrders: [sourceOrder({
      id: "order-member-1-week-29",
      week: 29,
    })],
    sourceOrderLines: [sourceOrderLine({
      id: "line-member-1-week-29",
      orderId: "order-member-1-week-29",
      week: 29,
    })],
  });
  const differentProjectPlan = buildPlan({projectId: "different-project"});

  const firstDigest = computeLegacyOrderMigrationDigest(firstPlan);
  const diagnosticsChangedDigest = computeLegacyOrderMigrationDigest({
    ...firstPlan,
    diagnostics: {safeAggregateOnly: 999},
  });
  const reorderedDigest = computeLegacyOrderMigrationDigest(reorderedPlan);
  const sameReorderedDigest = computeLegacyOrderMigrationDigest(
    sameReorderedPlan,
  );
  const changedDigest = computeLegacyOrderMigrationDigest(changedPlan);
  assert.match(firstDigest, /^[a-f0-9]{64}$/);
  assert.equal(firstDigest, diagnosticsChangedDigest);
  assert.match(reorderedDigest, /^[a-f0-9]{64}$/);
  assert.equal(reorderedDigest, sameReorderedDigest);
  assert.deepEqual(reorderedPlan.diagnostics, sameReorderedPlan.diagnostics);
  assert.notEqual(firstDigest, changedDigest);
  assert.notEqual(
    firstDigest,
    computeLegacyOrderMigrationDigest(nextWeekPlan),
  );
  assert.equal(nextWeekPlan.scope.weekKey, "2026-W29");
  assert.equal(firstPlan.scope.projectId, "reguerta-9f27f");
  assert.notEqual(
    firstDigest,
    computeLegacyOrderMigrationDigest(differentProjectPlan),
  );

  const firstNanosecondPlan = buildPlan({
    sourceOrders: [sourceOrder({}, {
      updateTime: {seconds: 1_785_000_000, nanoseconds: 123_456_000},
    })],
  });
  const changedNanosecondPlan = buildPlan({
    sourceOrders: [sourceOrder({}, {
      updateTime: {seconds: 1_785_000_000, nanoseconds: 123_457_000},
    })],
  });
  assert.notEqual(
    computeLegacyOrderMigrationDigest(firstNanosecondPlan),
    computeLegacyOrderMigrationDigest(changedNanosecondPlan),
  );
});

test("paginated reads use document cursors until the final short page", async () => {
  const sourceDocuments = Array.from({length: 5}, (_, index) => ({
    id: `document-${index + 1}`,
    data: () => ({position: index + 1}),
    createTime: SOURCE_CREATE_TIME,
    updateTime: SOURCE_UPDATE_TIME,
  }));
  const cursors = [];
  const pageSizes = [];
  const pageQuery = (startIndex, limit) => ({
    limit(nextLimit) {
      return pageQuery(startIndex, nextLimit);
    },
    startAfter(cursor) {
      cursors.push(cursor.id);
      return pageQuery(
        sourceDocuments.findIndex((document) => document.id === cursor.id) + 1,
        limit,
      );
    },
    async get() {
      const docs = sourceDocuments.slice(startIndex, startIndex + limit);
      pageSizes.push(docs.length);
      return {docs, size: docs.length};
    },
  });
  const query = {
    orderBy() {
      return pageQuery(0, sourceDocuments.length);
    },
  };

  const documents = await listQueryDocuments(query, 2);

  assert.deepEqual(documents.map((document) => document.id),
    sourceDocuments.map((document) => document.id));
  assert.deepEqual(cursors, ["document-2", "document-4"]);
  assert.deepEqual(pageSizes, [2, 2, 1]);
});

test("an oversized order group is rejected by the actual transaction gate", () => {
  const plan = buildPlan({
    sourceOrderLines: Array.from({length: 200}, (_, index) => sourceOrderLine({
      id: `line-${index}`,
    })),
  });
  assert.equal(plan.groups[0].writes.length, 201);
  assert.throws(
    () => assertSafeLegacyOrderMigrationPlan(plan),
    /exceeds 200 Firestore operations/i,
  );
});
