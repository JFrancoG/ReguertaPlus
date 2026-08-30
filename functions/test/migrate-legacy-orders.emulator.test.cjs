const assert = require("node:assert/strict");
const {after, test} = require("node:test");

const {deleteApp, initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {
  runLegacyOrderMigration,
} = require("../scripts/migrate-legacy-orders.cjs");

const projectId = "demo-reguerta-hu086-order-migration";
const app = initializeApp({projectId}, "hu086-order-migration-emulator");
const firestore = getFirestore(app);

after(async () => {
  await deleteApp(app);
});

function migrationOptions(targetEnvironment, overrides = {}) {
  return {
    apply: false,
    projectId,
    targetEnvironment,
    weekKey: "2026-W28",
    expectedPlanDigest: null,
    ...overrides,
  };
}

async function seedLegacyOrder() {
  const batch = firestore.batch();
  batch.create(
    firestore.doc("production/collections/orders/order-hu086-week-28"),
    {
      userId: "member-hu086",
      name: "Migration",
      surname: "Fixture",
      week: 28,
      year: 2026,
    },
  );
  batch.create(
    firestore.doc("production/collections/orderLines/line-hu086-week-28"),
    {
      orderId: "order-hu086-week-28",
      productId: "product-hu086",
      userId: "member-hu086",
      companyName: "Fixture producer",
      quantity: 2,
      subtotal: 8.5,
      week: 28,
      year: 2026,
    },
  );
  batch.create(
    firestore.doc("production/collections/orders/order-hu086-z-week-28"),
    {
      userId: "member-hu086-2",
      name: "Second",
      surname: "Fixture",
      week: 28,
      year: 2026,
    },
  );
  batch.create(
    firestore.doc("production/collections/orderLines/line-hu086-z-week-28"),
    {
      orderId: "order-hu086-z-week-28",
      productId: "product-hu086",
      userId: "member-hu086-2",
      companyName: "Fixture producer",
      quantity: 1,
      subtotal: 4.25,
      week: 28,
      year: 2026,
    },
  );
  batch.create(
    firestore.doc("production/collections/orders/empty-cart-hu086-week-28"),
    {
      userId: "empty-cart-member-hu086",
      name: "Empty",
      surname: "Cart",
      week: 28,
      year: 2026,
    },
  );
  batch.create(
    firestore.doc("production/collections/orders/empty-cart-hu086-week-28-b"),
    {
      userId: "empty-cart-member-hu086",
      name: "Empty",
      surname: "Cart",
      week: 28,
      year: 2026,
    },
  );
  batch.create(
    firestore.doc("production/plus-collections/products/product-hu086"),
    {
      vendorId: "vendor-hu086",
      name: "Fixture product",
      productImageUrl: "",
      price: 4.25,
      pricingMode: "fixed",
      isEcoBasket: false,
      packContainerName: "Caja",
      packContainerPlural: "Cajas",
      packContainerAbbreviation: "caja",
      packContainerQty: 1,
      unitName: "unidad",
      unitPlural: "unidades",
      unitAbbreviation: "ud",
      unitQty: 1,
    },
  );
  batch.create(
    firestore.doc("develop/collections/orders/decoy-develop-order"),
    {
      userId: "decoy-member",
      name: "Wrong",
      surname: "Source",
      week: 28,
    },
  );
  batch.create(
    firestore.doc("develop/collections/orderLines/decoy-develop-line"),
    {
      orderId: "decoy-develop-order",
      productId: "product-hu086",
      userId: "decoy-member",
      companyName: "Wrong source",
      quantity: 1,
      subtotal: 999,
      week: 28,
    },
  );
  batch.create(
    firestore.doc("production/collections/orders/decoy-week-27-order"),
    {
      userId: "decoy-week-27-member",
      name: "Wrong",
      surname: "Week",
      week: 27,
    },
  );
  batch.create(
    firestore.doc("production/collections/orderLines/decoy-week-27-line"),
    {
      orderId: "decoy-week-27-order",
      productId: "product-hu086",
      userId: "decoy-week-27-member",
      companyName: "Wrong week",
      quantity: 1,
      subtotal: 999,
      week: 27,
    },
  );
  batch.create(
    firestore.doc("develop/plus-collections/products/product-hu086"),
    {
      vendorId: "wrong-develop-vendor",
      name: "Wrong develop catalog",
      pricingMode: "fixed",
      isEcoBasket: false,
    },
  );
  ["develop", "production"].forEach((environment) => batch.create(
    firestore.doc(
      `${environment}/plus-collections/orders/historical-hu086-week-28`,
    ),
    {
      userId: "member-hu086",
      week: 28,
      weekKey: "2025-W28",
    },
  ));
  await batch.commit();
}

test("dry-run, guarded apply, read-back, and conflict stay fail-closed", async () => {
  await seedLegacyOrder();

  const dryRun = await runLegacyOrderMigration(
    migrationOptions("develop"),
    {firestore},
  );
  assert.equal(dryRun.apply, false);
  assert.equal(dryRun.counts.plannedOrderCreates, 2);
  assert.equal(dryRun.counts.plannedOrderlineCreates, 2);
  assert.equal(dryRun.counts.plannedWrites, 4);
  assert.equal(dryRun.counts.sourceOrdersScanned, 4);
  assert.equal(dryRun.counts.sourceOrderlinesScanned, 2);
  assert.equal(dryRun.counts.productsScanned, 1);
  assert.deepEqual(dryRun.blockers, []);
  assert.equal(
    dryRun.diagnostics.canonicalTargetOrdersOutsideSelectedWeek,
    1,
  );
  assert.equal(dryRun.diagnostics.emptyLegacyOrdersSkipped.orders, 2);
  assert.match(dryRun.planDigest, /^[a-f0-9]{64}$/);

  const preexistingWrongWeekLine = firestore.doc(
    "production/collections/orderLines/preexisting-wrong-week-line",
  );
  await preexistingWrongWeekLine.create({
    orderId: "order-hu086-z-week-28",
    productId: "product-hu086",
    userId: "member-hu086-2",
    companyName: "Preflight fixture",
    quantity: 1,
    subtotal: 4.25,
    week: 27,
    year: 2026,
  });
  const incompletePreflight = await runLegacyOrderMigration(
    migrationOptions("develop"),
    {firestore},
  );
  assert.equal(incompletePreflight.counts.sourceOrderlinesScanned, 3);
  assert.ok(incompletePreflight.blockers.some((blocker) =>
    blocker.code === "malformed-orderline"
  ));
  assert.equal((await firestore
    .doc("develop/plus-collections/orders/order-hu086-week-28")
    .get()).exists, false);
  await preexistingWrongWeekLine.delete();

  const phantomSourceLine = firestore.doc(
    "production/collections/orderLines/phantom-line-hu086-week-28",
  );
  await assert.rejects(
    runLegacyOrderMigration(migrationOptions("develop", {
      apply: true,
      expectedPlanDigest: dryRun.planDigest,
    }), {
      firestore,
      testHooks: {
        beforeFirstWrite: async () => phantomSourceLine.create({
          orderId: "order-hu086-week-28",
          productId: "product-hu086",
          userId: "member-hu086",
          companyName: "Concurrent fixture",
          quantity: 1,
          subtotal: 4.25,
          week: 28,
          year: 2026,
        }),
      },
    }),
    /after 0 successful writes/i,
  );
  assert.equal((await firestore
    .doc("develop/plus-collections/orders/order-hu086-week-28")
    .get()).exists, false);
  await phantomSourceLine.delete();

  const stableDryRun = await runLegacyOrderMigration(
    migrationOptions("develop"),
    {firestore},
  );
  assert.equal(stableDryRun.planDigest, dryRun.planDigest);

  const racingAmbiguousOrder = firestore.doc(
    "develop/plus-collections/orders/concurrent-order-without-week-key",
  );
  await assert.rejects(
    runLegacyOrderMigration(migrationOptions("develop", {
      apply: true,
      expectedPlanDigest: stableDryRun.planDigest,
    }), {
      firestore,
      testHooks: {
        beforeFirstWrite: async () => racingAmbiguousOrder.create({
          userId: "member-hu086",
          week: 28,
        }),
      },
    }),
    /after 0 successful writes/i,
  );
  await racingAmbiguousOrder.delete();

  const racingEmptyCartLine = firestore.doc(
    "develop/plus-collections/orderlines/concurrent-empty-cart-line",
  );
  await assert.rejects(
    runLegacyOrderMigration(migrationOptions("develop", {
      apply: true,
      expectedPlanDigest: stableDryRun.planDigest,
    }), {
      firestore,
      testHooks: {
        beforeFirstWrite: async () => racingEmptyCartLine.create({
          orderId: "empty-cart-hu086-week-28",
          userId: "empty-cart-member-hu086",
        }),
      },
    }),
    /after 0 successful writes/i,
  );
  await racingEmptyCartLine.delete();

  const racingEmptyCartSourceLine = firestore.doc(
    "production/collections/orderLines/concurrent-empty-cart-source-line",
  );
  await assert.rejects(
    runLegacyOrderMigration(migrationOptions("develop", {
      apply: true,
      expectedPlanDigest: stableDryRun.planDigest,
    }), {
      firestore,
      testHooks: {
        beforeFirstWrite: async () => racingEmptyCartSourceLine.create({
          orderId: "empty-cart-hu086-week-28",
          productId: "product-hu086",
          userId: "empty-cart-member-hu086",
          companyName: "Concurrent source fixture",
          quantity: 1,
          subtotal: 4.25,
          week: 28,
          year: 2026,
        }),
      },
    }),
    /after 0 successful writes/i,
  );
  assert.equal((await firestore
    .doc("develop/plus-collections/orders/order-hu086-week-28")
    .get()).exists, false);
  await racingEmptyCartSourceLine.delete();

  const racingEmptyCartOrder = firestore.doc(
    "production/collections/orders/concurrent-empty-cart-order",
  );
  await assert.rejects(
    runLegacyOrderMigration(migrationOptions("develop", {
      apply: true,
      expectedPlanDigest: stableDryRun.planDigest,
    }), {
      firestore,
      testHooks: {
        beforeFirstWrite: async () => racingEmptyCartOrder.create({
          userId: "empty-cart-member-hu086",
          name: "Concurrent",
          surname: "Empty cart",
          week: 28,
          year: 2026,
        }),
      },
    }),
    /after 0 successful writes/i,
  );
  assert.equal((await firestore
    .doc("develop/plus-collections/orders/order-hu086-week-28")
    .get()).exists, false);
  await racingEmptyCartOrder.delete();

  await assert.rejects(
    runLegacyOrderMigration(migrationOptions("develop", {
      apply: true,
      expectedPlanDigest: stableDryRun.planDigest,
    }), {
      firestore,
      testHooks: {
        beforeGroupApply: async (index) => {
          if (index === 1) {
            await firestore
              .doc("develop/plus-collections/orders/order-hu086-z-week-28")
              .create({userId: "member-hu086-2", week: 28});
          }
        },
      },
    }),
    /after 2 successful writes/i,
  );
  assert.equal((await firestore
    .doc("develop/plus-collections/orders/order-hu086-week-28")
    .get()).exists, true);
  assert.equal((await firestore
    .doc("develop/plus-collections/orderlines/line-hu086-z-week-28")
    .get()).exists, false);

  const cleanup = firestore.batch();
  cleanup.delete(firestore
    .doc("develop/plus-collections/orders/order-hu086-week-28"));
  cleanup.delete(firestore
    .doc("develop/plus-collections/orderlines/line-hu086-week-28"));
  cleanup.delete(firestore
    .doc("develop/plus-collections/orders/order-hu086-z-week-28"));
  await cleanup.commit();

  const cleanDryRun = await runLegacyOrderMigration(
    migrationOptions("develop"),
    {firestore},
  );

  const applied = await runLegacyOrderMigration(migrationOptions("develop", {
    apply: true,
    expectedPlanDigest: cleanDryRun.planDigest,
  }), {
    firestore,
    testHooks: {
      beforeFirstWrite: async () => firestore.doc(
        "develop/plus-collections/orders/concurrent-historical-week-28",
      ).create({
        userId: "member-hu086",
        week: 28,
        weekKey: "2025-W28",
      }),
    },
  });
  assert.equal(applied.appliedWrites, 4);
  assert.equal(applied.readBack.counts.plannedWrites, 0);
  assert.deepEqual(applied.readBack.blockers, []);
  assert.equal(applied.sourceDigest, applied.readBack.sourceDigest);
  assert.equal(applied.projectionDigest, applied.readBack.projectionDigest);

  const [order, orderline, sourceOrder] = await Promise.all([
    firestore.doc("develop/plus-collections/orders/order-hu086-week-28").get(),
    firestore.doc("develop/plus-collections/orderlines/line-hu086-week-28").get(),
    firestore.doc("production/collections/orders/order-hu086-week-28").get(),
  ]);
  assert.equal(order.get("consumerStatus"), "confirmed");
  assert.equal(order.get("producerStatus"), "delivered");
  assert.equal(order.get("total"), 8.5);
  assert.deepEqual(order.get("totalsByVendor"), {"vendor-hu086": 8.5});
  assert.equal(orderline.get("ecoBasketOption"), null);
  assert.equal(orderline.get("priceAtOrder"), 4.25);
  assert.equal(orderline.get("vendorId"), "vendor-hu086");
  assert.equal(orderline.get("productImageUrl"), null);
  assert.equal(orderline.get("weekKey"), "2026-W28");
  assert.equal(orderline.get("ecoBasketOptionAtOrder"), undefined);
  assert.equal(sourceOrder.get("week"), 28);

  const idempotent = await runLegacyOrderMigration(
    migrationOptions("develop"),
    {firestore},
  );
  assert.equal(idempotent.counts.plannedWrites, 0);
  assert.deepEqual(idempotent.blockers, []);

  const hiddenExtraLine = firestore.doc(
    "develop/plus-collections/orderlines/extra-line-with-wrong-week-key",
  );
  await hiddenExtraLine.create({
    orderId: "order-hu086-week-28",
    weekKey: "2025-W28",
  });
  const hiddenLineConflict = await runLegacyOrderMigration(
    migrationOptions("develop"),
    {firestore},
  );
  assert.ok(hiddenLineConflict.blockers.some((blocker) =>
    blocker.code === "target-divergence"
  ));
  await hiddenExtraLine.delete();

  const malformedAlternateOrder = firestore.doc(
    "production/plus-collections/orders/alternate-order-without-week-key",
  );
  await malformedAlternateOrder.create({userId: "member-hu086", week: 28});
  const alternateOrderConflict = await runLegacyOrderMigration(
    migrationOptions("production"),
    {firestore},
  );
  assert.ok(alternateOrderConflict.blockers.some((blocker) =>
    blocker.code === "malformed-target-order"
  ));
  await malformedAlternateOrder.delete();

  const outsideWeekExactId = firestore.doc(
    "production/plus-collections/orders/order-hu086-week-28",
  );
  await outsideWeekExactId.create({
    userId: "member-hu086",
    week: 28,
    weekKey: "2025-W28",
  });
  const outsideWeekIdConflict = await runLegacyOrderMigration(
    migrationOptions("production"),
    {firestore},
  );
  assert.ok(outsideWeekIdConflict.blockers.some((blocker) =>
    blocker.code === "target-divergence"
  ));
  await outsideWeekExactId.delete();

  const productionDryRun = await runLegacyOrderMigration(
    migrationOptions("production"),
    {firestore},
  );
  const racingTargetOrder = firestore.doc(
    "production/plus-collections/orders/order-hu086-week-28",
  );
  await assert.rejects(
    runLegacyOrderMigration(migrationOptions("production", {
      apply: true,
      expectedPlanDigest: productionDryRun.planDigest,
    }), {
      firestore,
      testHooks: {
        beforeGroupApply: async (index) => {
          if (index === 0) {
            await racingTargetOrder.create({userId: "member-hu086", week: 28});
          }
        },
      },
    }),
    /after 0 successful writes/i,
  );
  assert.equal((await firestore
    .doc("production/plus-collections/orderlines/line-hu086-week-28")
    .get()).exists, false);
  await racingTargetOrder.delete();

  const finalProductionDryRun = await runLegacyOrderMigration(
    migrationOptions("production"),
    {firestore},
  );
  await assert.rejects(
    runLegacyOrderMigration(migrationOptions("production", {
      apply: true,
      expectedPlanDigest: finalProductionDryRun.planDigest,
    }), {
      firestore,
      testHooks: {
        beforeReadBack: async () => firestore
          .doc("production/plus-collections/orderlines/late-empty-cart-line")
          .create({
            orderId: "empty-cart-hu086-week-28",
            userId: "empty-cart-member-hu086",
          }),
      },
    }),
    /read-back failed after 4 successful writes/i,
  );

  const conflicting = await runLegacyOrderMigration(
    migrationOptions("production"),
    {firestore},
  );
  assert.ok(conflicting.blockers.some((blocker) =>
    blocker.code === "target-divergence"
  ));
  const [committedProductionLine, sourceAfterRaces] = await Promise.all([
    firestore
      .doc("production/plus-collections/orderlines/line-hu086-week-28")
      .get(),
    firestore.doc("production/collections/orders/order-hu086-week-28").get(),
  ]);
  assert.equal(committedProductionLine.exists, true);
  assert.equal(sourceAfterRaces.get("week"), 28);
});
