const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const {after, before, beforeEach, test} = require("node:test");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");

const PROJECT_ID = "demo-reguerta-role-access";
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const [host, portText] = EMULATOR_HOST.split(":");
const port = Number(portText || 8080);
const rules = fs.readFileSync(
  path.resolve(__dirname, "../../../firestore.strict.rules"),
  "utf8",
);

const envs = ["develop", "production"];
const actors = {
  member: {
    memberId: "member_001",
    uid: "uid_member_001",
    roles: ["member"],
    isActive: true,
    isCommonPurchaseManager: false,
  },
  producer: {
    memberId: "producer_001",
    uid: "uid_producer_001",
    roles: ["member", "producer"],
    isActive: true,
    isCommonPurchaseManager: false,
  },
  otherProducer: {
    memberId: "producer_002",
    uid: "uid_producer_002",
    roles: ["member", "producer"],
    isActive: true,
    isCommonPurchaseManager: false,
  },
  manager: {
    memberId: "manager_001",
    uid: "uid_manager_001",
    roles: ["member"],
    isActive: true,
    isCommonPurchaseManager: true,
  },
  admin: {
    memberId: "admin_001",
    uid: "uid_admin_001",
    roles: ["member", "admin"],
    isActive: true,
    isCommonPurchaseManager: false,
  },
  inactive: {
    memberId: "inactive_001",
    uid: "uid_inactive_001",
    roles: ["member", "producer"],
    isActive: false,
    isCommonPurchaseManager: false,
  },
};

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {host, port, rules},
  });
});

after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedFixtures();
});

function collectionPath(env, collection) {
  return `${env}/plus-collections/${collection}`;
}

function docPath(env, collection, documentId) {
  return `${collectionPath(env, collection)}/${documentId}`;
}

function contextFor(actor) {
  return testEnv.authenticatedContext(actor.uid);
}

async function seedFixtures() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const env of envs) {
      for (const actor of Object.values(actors)) {
        await db.doc(docPath(env, "users", actor.memberId)).set({
          displayName: actor.memberId,
          normalizedEmail: `${actor.memberId}@example.test`,
          authUid: actor.uid,
          roles: actor.roles,
          isActive: actor.isActive,
          producerCatalogEnabled: true,
          isCommonPurchaseManager: actor.isCommonPurchaseManager,
        });
        if (actor.isActive) {
          await db.doc(docPath(env, "memberDirectory", actor.memberId)).set({
            userId: actor.memberId,
            displayName: actor.memberId,
            roles: actor.roles,
            isActive: true,
            producerCatalogEnabled: true,
            isCommonPurchaseManager: actor.isCommonPurchaseManager,
          });
        }
        await db.doc(docPath(env, "authLinks", actor.uid)).set({
          memberId: actor.memberId,
        });
        await db.doc(
          `${docPath(env, "users", actor.memberId)}/devices/device_${actor.memberId}`,
        ).set({
          deviceId: `device_${actor.memberId}`,
          platform: "android",
          appVersion: "1.0",
          osVersion: "16",
          apiLevel: 36,
          firstSeenAt: new Date("2026-07-01T00:00:00Z"),
          lastSeenAt: new Date("2026-07-02T00:00:00Z"),
          fcmToken: null,
          tokenUpdatedAt: null,
        });
      }
      await db.doc(docPath(env, "authLinks", "uid_mismatched")).set({
        memberId: actors.member.memberId,
      });

      await db.doc(docPath(env, "products", "product_producer_001")).set({
        vendorId: actors.producer.memberId,
        name: "Own product",
        price: 3,
        archived: false,
        isAvailable: true,
      });
      await db.doc(docPath(env, "orders", "order_member_001")).set({
        userId: actors.member.memberId,
        weekKey: "2026-W30",
        consumerStatus: "confirmado",
        total: 10,
        producerStatus: "unread",
        producerStatusesByVendor: {
          [actors.producer.memberId]: "unread",
        },
        totalsByVendor: {
          [actors.producer.memberId]: 10,
        },
      });
      await db.doc(docPath(env, "orders", "order_other_001")).set({
        userId: "member_other",
        weekKey: "2026-W30",
        consumerStatus: "confirmado",
        total: 5,
        producerStatus: "unread",
        producerStatusesByVendor: {
          [actors.otherProducer.memberId]: "unread",
        },
        totalsByVendor: {
          [actors.otherProducer.memberId]: 5,
        },
      });
      await db.doc(docPath(env, "orders", "order_member_legacy_alias")).set({
        memberId: actors.member.memberId,
        weekKey: "2026-W29",
        consumerStatus: "confirmado",
        total: 4,
        producerStatus: "unread",
        producerStatusesByVendor: {
          [actors.producer.memberId]: "unread",
        },
        totalsByVendor: {
          [actors.producer.memberId]: 4,
        },
      });
      await db.doc(docPath(env, "orderlines", "line_member_001")).set({
        orderId: "order_member_001",
        userId: actors.member.memberId,
        vendorId: actors.producer.memberId,
        productId: "product_producer_001",
        weekKey: "2026-W30",
        quantity: 2,
        priceAtOrder: 5,
        subtotal: 10,
      });
      await db.doc(docPath(env, "seasonalCommitments", "commitment_member_id")).set({
        userId: actors.member.memberId,
        productId: "product_producer_001",
        seasonKey: "2026-summer",
        fixedQty: 1,
        active: true,
      });
      await db.doc(docPath(env, "seasonalCommitments", "commitment_auth_uid")).set({
        uid: actors.member.uid,
        productId: "product_producer_001",
        seasonKey: "2026-summer",
        fixedQty: 1,
        active: true,
      });
      await db.doc(docPath(env, "seasonalCommitments", "commitment_email")).set({
        user: `${actors.member.memberId}@example.test`,
        productId: "product_producer_001",
        seasonKey: "2026-summer",
        fixedQty: 1,
        active: true,
      });
      await db.doc(docPath(env, "news", "news_active")).set({
        title: "Published",
        body: "Visible",
        publishedBy: "Admin Tester",
        publishedAt: new Date(),
        active: true,
      });
      await db.doc(docPath(env, "news", "news_draft")).set({
        title: "Draft",
        body: "Private",
        publishedBy: "Admin Tester",
        publishedAt: new Date(),
        active: false,
      });
      await db.doc(docPath(env, "config", "public")).set({
        versions: {android: {current: "1"}, ios: {current: "1"}},
      });
      await db.doc(docPath(env, "config", "global")).set({
        reviewerAllowlistEmails: ["reviewer@example.test"],
        cacheExpirationMinutes: 60,
      });
      await db.doc(docPath(env, "config", "member")).set({
        cacheExpirationMinutes: 60,
        lastTimestamps: {},
        deliveryDayOfWeek: "WED",
      });
      await db.doc(docPath(env, "notificationEvents", "event_all")).set({
        title: "All",
        body: "Visible to all active members",
        type: "admin_broadcast",
        target: "all",
        targetPayload: {},
        sentAt: 1,
        createdBy: actors.admin.memberId,
      });
      await db.doc(docPath(env, "notificationEvents", "event_member")).set({
        title: "Member",
        body: "Visible to one member",
        type: "shift_swap_requested",
        target: "users",
        targetPayload: {userIds: [actors.member.memberId]},
        sentAt: 2,
        createdBy: "system",
      });
      await db.doc(docPath(env, "notificationEvents", "event_admin")).set({
        title: "Admins",
        body: "Visible to admins",
        type: "admin_broadcast",
        target: "segment",
        targetPayload: {segmentType: "role", role: "admin"},
        sentAt: 3,
        createdBy: actors.admin.memberId,
      });
      await db.doc(
        `${docPath(env, "users", actors.member.memberId)}/notificationInbox/event_all`,
      ).set({
        notificationEventId: "event_all",
        title: "All",
        body: "Visible to all active members",
        type: "admin_broadcast",
        target: "all",
        targetPayload: {},
        sentAt: 1,
        createdBy: actors.admin.memberId,
      });
      await db.doc(
        `${docPath(env, "users", actors.member.memberId)}/notificationInbox/event_member`,
      ).set({
        notificationEventId: "event_member",
        title: "Member",
        body: "Visible to one member",
        type: "shift_swap_requested",
        target: "users",
        targetPayload: {userIds: [actors.member.memberId]},
        sentAt: 2,
        createdBy: "system",
      });
      await db.doc(
        `${docPath(env, "users", actors.admin.memberId)}/notificationInbox/event_admin`,
      ).set({
        notificationEventId: "event_admin",
        title: "Admins",
        body: "Visible to admins",
        type: "admin_broadcast",
        target: "segment",
        targetPayload: {segmentType: "role", role: "admin"},
        sentAt: 3,
        createdBy: actors.admin.memberId,
      });
    }
  });
}

test("only the minimal public config is readable without authentication", async () => {
  for (const env of envs) {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(db.doc(docPath(env, "config", "public")).get());
    await assertFails(db.doc(docPath(env, "config", "global")).get());
    await assertFails(db.doc(docPath(env, "products", "product_producer_001")).get());
  }
  await assertFails(
    testEnv.unauthenticatedContext().firestore()
      .doc(docPath("preview", "config", "public"))
      .get(),
  );
});

test("legacy collections stay authenticated and isolated from strict plus rules", async () => {
  const legacyCollections = [
    "config",
    "containers",
    "measures",
    "news",
    "orderLines",
    "orders",
    "products",
    "users",
  ];
  for (const env of envs) {
    const authenticatedDb = contextFor(actors.member).firestore();
    const unauthenticatedDb = testEnv.unauthenticatedContext().firestore();

    for (const collection of legacyCollections) {
      const legacyPath = `${env}/collections/${collection}/compat-smoke`;
      await assertSucceeds(
        authenticatedDb.doc(legacyPath).set({value: "legacy"}),
      );
      await assertSucceeds(authenticatedDb.doc(legacyPath).get());
      await assertFails(unauthenticatedDb.doc(legacyPath).get());
    }
    await assertFails(
      authenticatedDb.doc(`${env}/collections/authLinks/forged`).set({
        memberId: actors.admin.memberId,
      }),
    );
    await assertFails(
      authenticatedDb.doc(`${env}/collections/unknown/forged`).set({
        value: "unknown",
      }),
    );
    await assertSucceeds(
      authenticatedDb
        .doc(`${env}/collections/users/legacy/plus-collections/nested`)
        .set({value: "still-legacy"}),
    );
    await assertFails(
      authenticatedDb.doc(docPath(env, "authLinks", "forged")).set({
        memberId: actors.admin.memberId,
      }),
    );
  }

  const unsupportedDb = contextFor(actors.member).firestore();
  await assertFails(
    unsupportedDb.doc("preview/collections/users/member-write").set({
      value: "wrong-env",
    }),
  );
});

test("unlinked and inactive accounts cannot enter the operational dataset", async () => {
  for (const env of envs) {
    const unlinkedDb = testEnv.authenticatedContext("uid_unlinked").firestore();
    const mismatchedDb = testEnv.authenticatedContext("uid_mismatched").firestore();
    const inactiveDb = contextFor(actors.inactive).firestore();
    const product = docPath(env, "products", "product_producer_001");
    await assertFails(unlinkedDb.doc(product).get());
    await assertFails(mismatchedDb.doc(product).get());
    await assertFails(inactiveDb.doc(product).get());
  }
});

test("develop UI-test fixture UIDs receive no strict Rules bypass", async () => {
  const fixtureUids = [
    "mock_ana_admin_reguerta_app",
    "mock_pablo_producer_reguerta_app",
  ];
  for (const uid of fixtureUids) {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(
      db.doc(docPath("develop", "products", "product_producer_001")).get(),
    );
    await assertFails(
      db.doc(docPath("develop", "users", "member_admin_001")).get(),
    );
    await assertFails(
      db.doc(
        `${docPath("develop", "users", "member_admin_001")}/devices/mock`,
      ).set({deviceId: "mock"}),
    );
  }
});

test("private members and global config stay admin-only", async () => {
  for (const env of envs) {
    const memberDb = contextFor(actors.member).firestore();
    const adminDb = contextFor(actors.admin).firestore();
    await assertSucceeds(
      memberDb.doc(docPath(env, "users", actors.member.memberId)).get(),
    );
    await assertFails(
      memberDb.doc(docPath(env, "users", actors.producer.memberId)).get(),
    );
    await assertSucceeds(
      memberDb.doc(docPath(env, "memberDirectory", actors.producer.memberId)).get(),
    );
    await assertFails(
      memberDb.doc(docPath(env, "memberDirectory", actors.member.memberId))
        .update({displayName: "Tampered"}),
    );
    await assertSucceeds(memberDb.doc(docPath(env, "config", "member")).get());
    await assertFails(memberDb.doc(docPath(env, "config", "global")).get());
    await assertSucceeds(adminDb.doc(docPath(env, "config", "global")).get());
  }
});

test("identity links are self-readable and server-owned", async () => {
  for (const env of envs) {
    const memberDb = contextFor(actors.member).firestore();
    const ownLink = docPath(env, "authLinks", actors.member.uid);
    const producerLink = docPath(env, "authLinks", actors.producer.uid);

    await assertSucceeds(memberDb.doc(ownLink).get());
    await assertFails(memberDb.doc(producerLink).get());
    await assertFails(memberDb.collection(collectionPath(env, "authLinks")).get());
    await assertFails(memberDb.doc(ownLink).update({memberId: actors.admin.memberId}));
    await assertFails(memberDb.doc(ownLink).delete());
  }
});

test("a member cannot escalate roles or write another member profile", async () => {
  for (const env of envs) {
    const db = contextFor(actors.member).firestore();
    const ownUser = db.doc(docPath(env, "users", actors.member.memberId));
    const adminUser = db.doc(docPath(env, "users", actors.admin.memberId));
    await assertFails(ownUser.update({roles: ["member", "admin"]}));
    await assertFails(adminUser.update({isActive: false}));
    await assertSucceeds(ownUser.update({
      lastDeviceId: `device_${actors.member.memberId}`,
    }));
    await assertFails(ownUser.update({lastDeviceId: "missing-device"}));
  }
});

test("member self-service fields stay bounded by capability", async () => {
  for (const env of envs) {
    const memberDb = contextFor(actors.member).firestore();
    const producerDb = contextFor(actors.producer).firestore();
    const managerDb = contextFor(actors.manager).firestore();
    const member = docPath(env, "users", actors.member.memberId);
    const producer = docPath(env, "users", actors.producer.memberId);

    await assertSucceeds(memberDb.doc(member).update({
      lastDeviceId: `device_${actors.member.memberId}`,
      updatedAt: new Date(),
    }));
    await assertFails(memberDb.doc(member).update({producerCatalogEnabled: false}));
    await assertFails(memberDb.doc(member).update({displayName: "Forged name"}));
    await assertSucceeds(producerDb.doc(producer).update({
      producerCatalogEnabled: false,
      updatedAt: new Date(),
    }));
    await assertSucceeds(
      managerDb.doc(docPath(env, "users", actors.manager.memberId)).update({
        producerCatalogEnabled: false,
        updatedAt: new Date(),
      }),
    );
  }
});

test("device registration validates platform metadata and timestamps", async () => {
  for (const env of envs) {
    const memberDb = contextFor(actors.member).firestore();
    const devices = `${docPath(env, "users", actors.member.memberId)}/devices`;
    const base = {
      appVersion: "1.0",
      osVersion: "26.0",
      firstSeenAt: new Date("2026-07-01T00:00:00Z"),
      lastSeenAt: new Date("2026-07-02T00:00:00Z"),
      fcmToken: null,
      tokenUpdatedAt: null,
      firebaseInstallationId: null,
      registrationUpdatedAt: null,
    };

    await assertSucceeds(memberDb.doc(`${devices}/ios-valid`).set({
      ...base,
      deviceId: "ios-valid",
      platform: "ios",
    }));
    await assertFails(memberDb.doc(`${devices}/ios-invalid-api`).set({
      ...base,
      deviceId: "ios-invalid-api",
      platform: "ios",
      apiLevel: 26,
    }));
    await assertFails(memberDb.doc(`${devices}/android-missing-api`).set({
      ...base,
      deviceId: "android-missing-api",
      platform: "android",
    }));
    await assertSucceeds(memberDb.doc(`${devices}/android-fid-valid`).set({
      ...base,
      deviceId: "android-fid-valid",
      platform: "android",
      apiLevel: 37,
      firebaseInstallationId: "FID-A",
      registrationUpdatedAt: new Date("2026-07-02T00:00:00Z"),
    }));
    await assertFails(memberDb.doc(`${devices}/android-fid-invalid`).set({
      ...base,
      deviceId: "android-fid-invalid",
      platform: "android",
      apiLevel: 37,
      firebaseInstallationId: 42,
    }));
    await assertFails(memberDb.doc(`${devices}/backdated`).set({
      ...base,
      deviceId: "backdated",
      platform: "android",
      apiLevel: 36,
      firstSeenAt: new Date("2026-07-03T00:00:00Z"),
    }));
  }
});

test("catalog writes require producer or common-purchase capability and immutable ownership", async () => {
  for (const env of envs) {
    const ownPayload = {
      vendorId: actors.producer.memberId,
      name: "Fresh product",
      price: 4,
      archived: false,
      isAvailable: true,
    };
    const producerDb = contextFor(actors.producer).firestore();
    const memberDb = contextFor(actors.member).firestore();
    const managerDb = contextFor(actors.manager).firestore();
    const adminDb = contextFor(actors.admin).firestore();

    await assertSucceeds(
      producerDb.doc(docPath(env, "products", "product_new_producer")).set(ownPayload),
    );
    await assertSucceeds(
      managerDb.doc(docPath(env, "products", "product_new_manager")).set({
        ...ownPayload,
        vendorId: actors.manager.memberId,
      }),
    );
    await assertFails(
      memberDb.doc(docPath(env, "products", "product_new_member")).set({
        ...ownPayload,
        vendorId: actors.member.memberId,
      }),
    );
    await assertFails(
      adminDb.doc(docPath(env, "products", "product_new_admin")).set({
        ...ownPayload,
        vendorId: actors.admin.memberId,
      }),
    );
    await assertFails(
      producerDb.doc(docPath(env, "products", "product_producer_001"))
        .update({vendorId: actors.otherProducer.memberId}),
    );
    await assertFails(
      producerDb.doc(docPath(env, "products", "product_producer_001")).delete(),
    );
  }
});

test("orders and lines are visible only to owner, involved producer, or admin", async () => {
  for (const env of envs) {
    const ownOrder = docPath(env, "orders", "order_member_001");
    const otherOrder = docPath(env, "orders", "order_other_001");
    const line = docPath(env, "orderlines", "line_member_001");

    await assertSucceeds(contextFor(actors.member).firestore().doc(ownOrder).get());
    await assertFails(contextFor(actors.member).firestore().doc(otherOrder).get());
    await assertSucceeds(contextFor(actors.producer).firestore().doc(ownOrder).get());
    await assertFails(contextFor(actors.otherProducer).firestore().doc(ownOrder).get());
    await assertSucceeds(contextFor(actors.admin).firestore().doc(otherOrder).get());
    await assertSucceeds(contextFor(actors.member).firestore().doc(line).get());
    await assertSucceeds(contextFor(actors.producer).firestore().doc(line).get());
    await assertFails(contextFor(actors.otherProducer).firestore().doc(line).get());
  }
});

test("a buyer cannot forge ownership and producers cannot edit commercial order fields", async () => {
  for (const env of envs) {
    const memberDb = contextFor(actors.member).firestore();
    const producerDb = contextFor(actors.producer).firestore();
    const ownOrder = docPath(env, "orders", "order_member_001");

    await assertSucceeds(memberDb.doc(ownOrder).update({total: 12}));
    await assertFails(memberDb.doc(ownOrder).update({total: -1}));
    await assertFails(memberDb.doc(ownOrder).update({userId: "member_other"}));
    await assertFails(producerDb.doc(ownOrder).update({total: 999}));
    await assertFails(
      memberDb.doc(docPath(env, "orderlines", "line_member_001")).update({quantity: 0}),
    );
    await assertFails(
      memberDb.doc(docPath(env, "orders", "order_forged")).set({
        userId: "member_other",
        weekKey: "2026-W31",
        consumerStatus: "en_carrito",
        total: 0,
        totalsByVendor: {},
      }),
    );
    await assertFails(
      memberDb.doc(docPath(env, "orders", "order_forged_legacy_alias")).set({
        userId: actors.member.memberId,
        memberId: "member_other",
        weekKey: "2026-W31",
        consumerStatus: "en_carrito",
        total: 0,
        totalsByVendor: {},
      }),
    );
    await assertFails(
      memberDb.doc(docPath(env, "orderlines", "line_forged_legacy_alias")).set({
        userId: actors.member.memberId,
        memberId: "member_other",
        orderId: "order_member_001",
        productId: "product_producer_001",
        vendorId: actors.producer.memberId,
        quantity: 1,
        subtotal: 2,
      }),
    );
    await assertFails(
      memberDb.doc(docPath(env, "orderlines", "line_member_001"))
        .update({memberId: "member_other"}),
    );
  }
});

test("producer status changes remain scoped to the involved producer", async () => {
  for (const env of envs) {
    const order = docPath(env, "orders", "order_member_001");
    await assertSucceeds(
      contextFor(actors.producer).firestore().doc(order).update({
        producerStatus: "prepared",
        [`producerStatusesByVendor.${actors.producer.memberId}`]: "prepared",
        producerStatusUpdatedBy: actors.producer.memberId,
        updatedAt: new Date(),
      }),
    );
    await assertFails(
      contextFor(actors.otherProducer).firestore().doc(order).update({
        producerStatus: "prepared",
        [`producerStatusesByVendor.${actors.producer.memberId}`]: "prepared",
        producerStatusUpdatedBy: actors.otherProducer.memberId,
        updatedAt: new Date(),
      }),
    );
  }
});

test("draft news is admin-only and member administration is backend-only", async () => {
  for (const env of envs) {
    const memberDb = contextFor(actors.member).firestore();
    const adminDb = contextFor(actors.admin).firestore();
    await assertSucceeds(memberDb.doc(docPath(env, "news", "news_active")).get());
    await assertFails(memberDb.doc(docPath(env, "news", "news_draft")).get());
    await assertSucceeds(adminDb.doc(docPath(env, "news", "news_draft")).get());
    await assertFails(
      adminDb.doc(docPath(env, "users", "new_member")).set({
        displayName: "New member",
        normalizedEmail: "new@example.test",
        roles: ["member"],
        isActive: true,
      }),
    );
  }
});

test("queries prove the same predicates enforced by document reads", async () => {
  for (const env of envs) {
    const memberDb = contextFor(actors.member).firestore();
    const producerDb = contextFor(actors.producer).firestore();
    const adminDb = contextFor(actors.admin).firestore();

    const ownedOrders = await assertSucceeds(
      memberDb.collection(collectionPath(env, "orders"))
        .where("userId", "==", actors.member.memberId)
        .where("weekKey", "==", "2026-W30")
        .get(),
    );
    assert.equal(ownedOrders.size, 1);
    const emptyOwnedOrders = await assertSucceeds(
      memberDb.collection(collectionPath(env, "orders"))
        .where("userId", "==", actors.member.memberId)
        .where("weekKey", "==", "2099-W01")
        .get(),
    );
    assert.equal(emptyOwnedOrders.empty, true);
    const legacyAliasOrders = await assertSucceeds(
      memberDb.collection(collectionPath(env, "orders"))
        .where("memberId", "==", actors.member.memberId)
        .where("weekKey", "==", "2026-W29")
        .get(),
    );
    assert.equal(legacyAliasOrders.size, 1);
    await assertFails(
      memberDb.collection(collectionPath(env, "orders"))
        .where("weekKey", "==", "2026-W30")
        .get(),
    );
    await assertSucceeds(
      producerDb.collection(collectionPath(env, "orderlines"))
        .where("vendorId", "==", actors.producer.memberId)
        .get(),
    );
    await assertFails(
      producerDb.collection(collectionPath(env, "orderlines"))
        .where("weekKey", "==", "2026-W30")
        .get(),
    );
    await assertSucceeds(
      memberDb.collection(collectionPath(env, "news"))
        .where("active", "==", true)
        .get(),
    );
    await assertFails(memberDb.collection(collectionPath(env, "news")).get());
    await assertSucceeds(adminDb.collection(collectionPath(env, "news")).get());
    await assertSucceeds(
      memberDb.collection(collectionPath(env, "memberDirectory"))
        .where("isActive", "==", true)
        .get(),
    );
    await assertFails(memberDb.collection(collectionPath(env, "users")).get());
    await assertFails(
      memberDb.doc(docPath(env, "users", actors.inactive.memberId)).get(),
    );
    await assertSucceeds(adminDb.collection(collectionPath(env, "users")).get());
  }
});

test("legacy seasonal commitment aliases remain scoped to their owner", async () => {
  for (const env of envs) {
    const memberDb = contextFor(actors.member).firestore();
    const commitments = memberDb.collection(
      collectionPath(env, "seasonalCommitments"),
    );

    await assertSucceeds(
      commitments.where("userId", "==", actors.member.memberId).get(),
    );
    await assertSucceeds(
      commitments.where("uid", "==", actors.member.uid).get(),
    );
    await assertSucceeds(
      commitments.where(
        "user",
        "==",
        `${actors.member.memberId}@example.test`,
      ).get(),
    );
    await assertFails(
      commitments.where("uid", "==", actors.otherProducer.uid).get(),
    );
    await assertFails(
      commitments.where(
        "user",
        "==",
        `${actors.otherProducer.memberId}@example.test`,
      ).get(),
    );
  }
});

test("members query only their materialized notification inbox", async () => {
  for (const env of envs) {
    const memberDb = contextFor(actors.member).firestore();
    const ownInbox = memberDb.collection(
      `${docPath(env, "users", actors.member.memberId)}/notificationInbox`,
    );
    const adminInbox = memberDb.collection(
      `${docPath(env, "users", actors.admin.memberId)}/notificationInbox`,
    );

    await assertSucceeds(ownInbox.orderBy("sentAt", "desc").get());
    await assertFails(adminInbox.get());
  }
});

test("members cannot read the global notification source", async () => {
  for (const env of envs) {
    const memberDb = contextFor(actors.member).firestore();
    const events = memberDb.collection(collectionPath(env, "notificationEvents"));

    await assertFails(events.doc("event_member").get());
    await assertFails(events.doc("event_admin").get());
    await assertFails(events.get());
  }
});

test("admins retain global notification moderation access", async () => {
  for (const env of envs) {
    const adminDb = contextFor(actors.admin).firestore();

    await assertSucceeds(
      adminDb.collection(collectionPath(env, "notificationEvents")).get(),
    );
  }
});

test("notification inbox copies are immutable from clients", async () => {
  for (const env of envs) {
    const memberDb = contextFor(actors.member).firestore();
    const inboxEvent = `${docPath(env, "users", actors.member.memberId)}/notificationInbox/event_all`;

    await assertSucceeds(memberDb.doc(inboxEvent).get());
    await assertFails(memberDb.doc(inboxEvent).update({title: "Tampered"}));
    await assertFails(memberDb.doc(inboxEvent).delete());
    await assertFails(
      memberDb.doc(
        `${docPath(env, "users", actors.member.memberId)}/notificationInbox/forged`,
      ).set({notificationEventId: "forged"}),
    );
  }
});

test("notification read markers are owner-scoped and timestamped", async () => {
  for (const env of envs) {
    const memberDb = contextFor(actors.member).firestore();
    const ownReads = `${docPath(env, "users", actors.member.memberId)}/notificationReads`;
    const otherReads = `${docPath(env, "users", actors.producer.memberId)}/notificationReads`;
    await assertSucceeds(memberDb.doc(`${ownReads}/event_all`).set({
      notificationEventId: "event_all",
      readAt: new Date(),
    }));
    await assertFails(memberDb.doc(`${ownReads}/event_bad`).set({
      notificationEventId: "event_bad",
      readAt: "now",
    }));
    await assertFails(memberDb.doc(`${otherReads}/event_all`).set({
      notificationEventId: "event_all",
      readAt: new Date(),
    }));
  }
});

test("admin governance does not imply producer ownership", async () => {
  for (const env of envs) {
    const adminDb = contextFor(actors.admin).firestore();

    await assertSucceeds(adminDb.doc(docPath(env, "news", "news_admin")).set({
      title: "Admin notice",
      body: "Governed content",
      publishedBy: "Admin Tester",
      publishedAt: new Date(),
      active: true,
    }));
    await assertSucceeds(adminDb.doc(docPath(env, "news", "news_display_author")).set({
      title: "Delegated notice",
      body: "The author name is display-only metadata",
      publishedBy: "Another Admin",
      publishedAt: new Date(),
      active: true,
    }));
    await assertSucceeds(adminDb.doc(docPath(env, "deliveryCalendar", "2026-W31")).set({
      weekKey: "2026-W31",
      updatedBy: actors.admin.memberId,
    }));
    await assertSucceeds(adminDb.doc(docPath(env, "seasonalCommitments", "commitment_admin")).set({
      userId: actors.member.memberId,
      season: "summer",
    }));
    await assertSucceeds(adminDb.doc(docPath(env, "notificationEvents", "event_admin_created")).set({
      title: "Admin broadcast",
      body: "Visible through recipient inboxes",
      type: "admin_broadcast",
      target: "all",
      targetPayload: {},
      createdBy: actors.admin.memberId,
      sentAt: new Date(),
    }));
    await assertFails(adminDb.doc(docPath(env, "notificationEvents", "event_malformed")).set({
      title: "",
      body: "Missing a valid title and timestamp",
      type: "admin_broadcast",
      target: "all",
      targetPayload: {},
      createdBy: actors.admin.memberId,
    }));
    await assertFails(adminDb.doc(docPath(env, "products", "product_admin_forbidden")).set({
      vendorId: actors.admin.memberId,
      name: "Not an admin capability",
      price: 1,
    }));
  }
});

test("sensitive system workflows reject direct member writes", async () => {
  for (const env of envs) {
    const memberDb = contextFor(actors.member).firestore();
    const adminDb = contextFor(actors.admin).firestore();

    await assertFails(
      memberDb.doc(docPath(env, "shifts", "shift_member_write")).set({
        type: "delivery",
        assignedUserIds: [actors.member.memberId],
        status: "confirmed",
        source: "app",
      }),
    );
    await assertSucceeds(
      adminDb.doc(docPath(env, "shifts", "shift_admin_write")).set({
        type: "delivery",
        assignedUserIds: [actors.member.memberId],
        status: "confirmed",
        source: "app",
      }),
    );
    await assertFails(
      memberDb.doc(docPath(env, "shiftPlanningRequests", "planning_member")).set({
        type: "delivery",
        requestedByUserId: actors.member.memberId,
        status: "requested",
      }),
    );
    await assertFails(
      adminDb.doc(docPath(env, "unknownCollection", "unknown")).set({ok: true}),
    );
  }
});
