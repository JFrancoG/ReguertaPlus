const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {after, before, beforeEach, test} = require("node:test");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");

const PROJECT_ID = "demo-reguerta-hu045";
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const [host, portText] = EMULATOR_HOST.split(":");
const port = Number(portText || 8080);
const rules = fs.readFileSync(
  path.resolve(__dirname, "../../../firestore.rules"),
  "utf8",
);

const envs = ["develop", "production"];
const datasets = ["plus-collections", "collections"];

const ACTORS = {
  producerOne: {
    memberId: "member_producer_001",
    uid: "uid_producer_001",
    roles: ["member", "producer"],
  },
  producerTwo: {
    memberId: "member_producer_002",
    uid: "uid_producer_002",
    roles: ["member", "producer"],
  },
  admin: {
    memberId: "member_admin_001",
    uid: "uid_admin_001",
    roles: ["member", "admin"],
  },
  consumer: {
    memberId: "member_consumer_001",
    uid: "uid_consumer_001",
    roles: ["member"],
  },
};

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host,
      port,
      rules,
    },
  });
});

after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedBaseFixtures();
});

function orderPath(env, dataset, orderId) {
  return `${env}/${dataset}/orders/${orderId}`;
}

function actorPath(env, dataset, actorId) {
  return `${env}/${dataset}/users/${actorId}`;
}

function producerUpdatePayload(actorId, status) {
  return {
    producerStatus: status,
    [`producerStatusesByVendor.${actorId}`]: status,
    producerStatusUpdatedBy: actorId,
    updatedAt: new Date(),
  };
}

async function seedBaseFixtures() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    for (const env of envs) {
      for (const dataset of datasets) {
        for (const actor of Object.values(ACTORS)) {
          await db.doc(actorPath(env, dataset, actor.memberId)).set({
            authUid: actor.uid,
            roles: actor.roles,
            isActive: true,
          });
        }

        await db.doc(orderPath(env, dataset, "order_shared_001")).set({
          userId: "member_buyer_001",
          weekKey: "2026-W16",
          producerStatus: "unread",
          producerStatusesByVendor: {
            [ACTORS.producerOne.memberId]: "unread",
            [ACTORS.producerTwo.memberId]: "unread",
          },
          totalsByVendor: {
            [ACTORS.producerOne.memberId]: 20.5,
            [ACTORS.producerTwo.memberId]: 18.1,
          },
          updatedAt: new Date(),
        });
      }
    }
  });
}

test("producer can update only own vendor status in develop and production", async () => {
  for (const env of envs) {
    for (const dataset of datasets) {
      const producerContext = testEnv.authenticatedContext(ACTORS.producerOne.uid);
      const producerOrderRef = producerContext.firestore().doc(orderPath(env, dataset, "order_shared_001"));

      await assertSucceeds(
        producerOrderRef.update(
          producerUpdatePayload(ACTORS.producerOne.memberId, "prepared"),
        ),
      );

      const snapshot = await producerOrderRef.get();
      assert.equal(snapshot.get("producerStatus"), "prepared");
      assert.equal(
        snapshot.get(`producerStatusesByVendor.${ACTORS.producerOne.memberId}`),
        "prepared",
      );
    }
  }
});

test("producer cannot update another producer vendor key", async () => {
  for (const env of envs) {
    for (const dataset of datasets) {
      const producerContext = testEnv.authenticatedContext(ACTORS.producerOne.uid);
      const producerOrderRef = producerContext.firestore().doc(orderPath(env, dataset, "order_shared_001"));

      await assertFails(
        producerOrderRef.update({
          producerStatus: "prepared",
          [`producerStatusesByVendor.${ACTORS.producerTwo.memberId}`]: "prepared",
          producerStatusUpdatedBy: ACTORS.producerOne.memberId,
          updatedAt: new Date(),
        }),
      );
    }
  }
});

test("consumer cannot mutate producer status fields", async () => {
  for (const env of envs) {
    for (const dataset of datasets) {
      const consumerContext = testEnv.authenticatedContext(ACTORS.consumer.uid);
      const consumerOrderRef = consumerContext.firestore().doc(orderPath(env, dataset, "order_shared_001"));

      await assertFails(
        consumerOrderRef.update({
          producerStatus: "prepared",
          [`producerStatusesByVendor.${ACTORS.producerOne.memberId}`]: "prepared",
          producerStatusUpdatedBy: ACTORS.consumer.memberId,
          updatedAt: new Date(),
        }),
      );
    }
  }
});

test("admin can apply top-level producer status correction with explicit actor", async () => {
  for (const env of envs) {
    for (const dataset of datasets) {
      const adminContext = testEnv.authenticatedContext(ACTORS.admin.uid);
      const adminOrderRef = adminContext.firestore().doc(orderPath(env, dataset, "order_shared_001"));

      await assertSucceeds(
        adminOrderRef.update({
          producerStatus: "delivered",
          producerStatusUpdatedBy: ACTORS.admin.memberId,
          updatedAt: new Date(),
        }),
      );

      const snapshot = await adminOrderRef.get();
      assert.equal(snapshot.get("producerStatus"), "delivered");
      assert.equal(
        snapshot.get(`producerStatusesByVendor.${ACTORS.producerOne.memberId}`),
        "unread",
      );
    }
  }
});

test("producer transition delivered to read is denied", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    for (const env of envs) {
      for (const dataset of datasets) {
        await db.doc(orderPath(env, dataset, "order_shared_001")).set({
          userId: "member_buyer_001",
          weekKey: "2026-W16",
          producerStatus: "delivered",
          producerStatusesByVendor: {
            [ACTORS.producerOne.memberId]: "delivered",
            [ACTORS.producerTwo.memberId]: "unread",
          },
          totalsByVendor: {
            [ACTORS.producerOne.memberId]: 20.5,
            [ACTORS.producerTwo.memberId]: 18.1,
          },
          updatedAt: new Date(),
        });
      }
    }
  });

  for (const env of envs) {
    for (const dataset of datasets) {
      const producerContext = testEnv.authenticatedContext(ACTORS.producerOne.uid);
      const producerOrderRef = producerContext.firestore().doc(orderPath(env, dataset, "order_shared_001"));

      await assertFails(
        producerOrderRef.update(
          producerUpdatePayload(ACTORS.producerOne.memberId, "read"),
        ),
      );
    }
  }
});

test("order creation with non-unread producerStatus is denied", async () => {
  for (const env of envs) {
    for (const dataset of datasets) {
      const consumerContext = testEnv.authenticatedContext(ACTORS.consumer.uid);
      const createRef = consumerContext.firestore().doc(orderPath(env, dataset, "order_new_002"));

      await assertFails(
        createRef.set({
          userId: ACTORS.consumer.memberId,
          weekKey: "2026-W17",
          producerStatus: "prepared",
          totalsByVendor: {
            [ACTORS.producerOne.memberId]: 11.0,
          },
          updatedAt: new Date(),
        }),
      );
    }
  }
});
