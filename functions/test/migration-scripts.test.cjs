const assert = require("node:assert/strict");
const {test} = require("node:test");

const {
  assertSafeAuthLinkApply,
  chunkAuthLinkWrites,
  commitAuthLinkWrites,
  listAllAuthUsers,
  parseMigrationArgs,
  planAuthLinkBackfill,
} = require("../scripts/backfill-auth-links.cjs");
const {
  extractMemberConfig,
  extractPublicVersions,
} = require("../scripts/backfill-public-versions.cjs");
const {
  buildInboxDocument,
  resolveEventAudience,
} = require("../scripts/backfill-notification-inbox.cjs");
const {
  applyMemberDirectoryPlan,
  assertSafeMemberDirectoryApply,
  planMemberDirectoryBackfill,
} = require("../scripts/backfill-member-directory.cjs");

const canonicalMember = (memberId, overrides = {}) => ({
  memberId,
  normalizedEmail: `${memberId}@example.test`,
  roles: ["member"],
  isActive: true,
  ...overrides,
});

test("migration arguments are dry-run by default and require a project", () => {
  assert.deepEqual(parseMigrationArgs([
    "--project",
    "reguerta-test",
    "--env",
    "develop,production",
  ]), {
    apply: false,
    projectId: "reguerta-test",
    environments: ["develop", "production"],
  });
  assert.throws(() => parseMigrationArgs(["--apply"]));
  assert.throws(() => parseMigrationArgs([
    "--project",
    "reguerta-test",
    "--env",
    "local",
  ]));
});

test("auth-link plan rejects duplicate uids and conflicting links", () => {
  const plan = planAuthLinkBackfill([
    canonicalMember("one", {authUid: "duplicate"}),
    canonicalMember("two", {authUid: "duplicate"}),
    canonicalMember("three", {authUid: "aligned"}),
    canonicalMember("four", {authUid: "conflict"}),
    canonicalMember("five", {authUid: "new"}),
  ], new Map([
    ["aligned", "three"],
    ["conflict", "someone-else"],
  ]), [
    {
      uid: "aligned",
      email: "three@example.test",
      emailVerified: true,
    },
    {
      uid: "conflict",
      email: "four@example.test",
      emailVerified: true,
    },
    {
      uid: "new",
      email: "five@example.test",
      emailVerified: true,
    },
  ]);

  assert.deepEqual(plan.writes, [{
    authUid: "new",
    memberId: "five",
    writeUser: false,
    writeLink: true,
    writeAuthUid: false,
    userPatch: {},
    source: "existing-auth-uid",
  }]);
  assert.equal(plan.counts.usersScanned, 5);
  assert.equal(plan.counts.usersWithUid, 5);
  assert.equal(plan.counts.existingAligned, 1);
  assert.equal(plan.counts.duplicateUid, 2);
  assert.equal(plan.counts.conflicts, 1);
  assert.equal(plan.counts.plannedUserWrites, 0);
  assert.equal(plan.counts.plannedLinkWrites, 1);
  assert.equal(plan.counts.plannedOperations, 1);
});

test("auth-link plan creates reciprocal writes only for a unique verified email", () => {
  const plan = planAuthLinkBackfill([canonicalMember("member-one", {
    authUid: null,
    normalizedEmail: " Member@One.Example ",
  })], new Map(), [{
    uid: "auth-one",
    email: "member@one.example",
    emailVerified: true,
  }]);

  assert.deepEqual(plan.writes, [{
    authUid: "auth-one",
    memberId: "member-one",
    writeUser: true,
    writeLink: true,
    writeAuthUid: true,
    userPatch: {normalizedEmail: "member@one.example"},
    source: "verified-email",
  }]);
  assert.equal(plan.counts.plannedUserWrites, 1);
  assert.equal(plan.counts.plannedLinkWrites, 1);
  assert.equal(plan.counts.plannedOperations, 2);
});

test("auth-link plan rejects an unverified existing uid", () => {
  const plan = planAuthLinkBackfill([canonicalMember("member-one", {
    authUid: "auth-one",
    normalizedEmail: "member@one.example",
  })], new Map(), [{
    uid: "auth-one",
    email: "member@one.example",
    emailVerified: false,
  }]);

  assert.deepEqual(plan.writes, []);
  assert.equal(plan.counts.unverifiedAuthEmail, 1);
  assert.equal(plan.counts.existingUidUnverified, 1);
});

test("auth-link plan rejects a forged or stale existing uid", () => {
  const mismatch = planAuthLinkBackfill([canonicalMember("member-one", {
    authUid: "auth-one",
    normalizedEmail: "member-one@example.test",
  })], new Map(), [{
    uid: "auth-one",
    email: "attacker@example.test",
    emailVerified: true,
  }]);
  assert.deepEqual(mismatch.writes, []);
  assert.equal(mismatch.counts.existingUidEmailMismatch, 1);

  const missing = planAuthLinkBackfill([canonicalMember("member-one", {
    authUid: "missing-auth-user",
  })], new Map(), []);
  assert.deepEqual(missing.writes, []);
  assert.equal(missing.counts.existingUidMissingAuthUser, 1);
});

test("auth-link plan retains only the two exact develop fixtures", () => {
  const plan = planAuthLinkBackfill([
    {
      memberId: "member_admin_001",
      authUid: "mock_ana_admin_reguerta_app",
    },
    {
      memberId: "member_producer_001",
      authUid: "mock_pablo_producer_reguerta_app",
    },
  ], new Map(), [], {
    environment: "develop",
    dataset: "plus-collections",
  });

  assert.deepEqual(plan.writes, []);
  assert.equal(plan.counts.usersScanned, 2);
  assert.equal(plan.counts.usersEligibleForMigration, 0);
  assert.equal(plan.counts.retainedDevelopNonAuthFixtures, 2);
  assert.equal(plan.counts.existingUidMissingAuthUser, 0);
  assert.equal(plan.counts.membersNeedingCanonicalShape, 0);
});

test("auth-link fixture retention stays develop-only and exact", () => {
  const production = planAuthLinkBackfill([{
    memberId: "member_admin_001",
    authUid: "mock_ana_admin_reguerta_app",
  }], new Map(), [], {
    environment: "production",
    dataset: "plus-collections",
  });
  assert.equal(production.counts.retainedDevelopNonAuthFixtures, 0);
  assert.equal(production.counts.existingUidMissingAuthUser, 1);

  const mismatches = planAuthLinkBackfill([
    {
      memberId: "member_admin_001",
      authUid: "mock_someone_else",
    },
    {
      memberId: "different-member",
      authUid: "mock_pablo_producer_reguerta_app",
    },
    {
      memberId: "arbitrary-member",
      authUid: "mock_arbitrary",
    },
  ], new Map(), [], {
    environment: "develop",
    dataset: "plus-collections",
  });
  assert.equal(mismatches.counts.retainedDevelopNonAuthFixtures, 0);
  assert.equal(mismatches.counts.existingUidMissingAuthUser, 3);
});

test("auth-link fixture retention fails closed on Auth or link state", () => {
  const fixture = {
    memberId: "member_admin_001",
    authUid: "mock_ana_admin_reguerta_app",
  };
  const withAuthUser = planAuthLinkBackfill(
    [fixture],
    new Map(),
    [{
      uid: fixture.authUid,
      email: "fixture@example.test",
      emailVerified: true,
    }],
    {environment: "develop", dataset: "plus-collections"},
  );
  assert.equal(withAuthUser.counts.retainedDevelopNonAuthFixtures, 0);
  assert.equal(withAuthUser.counts.existingUidEmailMismatch, 1);

  const withLink = planAuthLinkBackfill(
    [fixture],
    new Map([[fixture.authUid, fixture.memberId]]),
    [],
    {environment: "develop", dataset: "plus-collections"},
  );
  assert.equal(withLink.counts.retainedDevelopNonAuthFixtures, 0);
  assert.equal(withLink.counts.existingUidMissingAuthUser, 1);
});

test("retained fixtures do not block a verified operational admin", () => {
  const plan = planAuthLinkBackfill([
    canonicalMember("admin-one", {
      authUid: null,
      roles: ["member", "admin"],
    }),
    {
      memberId: "member_admin_001",
      authUid: "mock_ana_admin_reguerta_app",
    },
    {
      memberId: "member_producer_001",
      authUid: "mock_pablo_producer_reguerta_app",
    },
  ], new Map(), [{
    uid: "auth-admin-one",
    email: "admin-one@example.test",
    emailVerified: true,
  }], {
    environment: "develop",
    dataset: "plus-collections",
  });

  assert.equal(plan.counts.retainedDevelopNonAuthFixtures, 2);
  assert.equal(plan.counts.linkedActiveAdminsAfter, 1);
  assert.doesNotThrow(() => assertSafeAuthLinkApply(
    plan.counts,
    "develop",
  ));
});

test("auth-link plan skips unverified and duplicate email identities", () => {
  const unverified = planAuthLinkBackfill([canonicalMember(
    "unverified-member",
    {
      authUid: null,
      normalizedEmail: "unverified@example.test",
    },
  )], new Map(), [{
    uid: "unverified-auth",
    email: "unverified@example.test",
    emailVerified: false,
  }]);
  assert.deepEqual(unverified.writes, []);

  const duplicateFirestore = planAuthLinkBackfill([
    canonicalMember("first-member", {
      authUid: null,
      normalizedEmail: "duplicate@example.test",
    }),
    canonicalMember("second-member", {
      authUid: null,
      normalizedEmail: null,
      email: "DUPLICATE@example.test",
    }),
  ], new Map(), [{
    uid: "unique-auth",
    email: "duplicate@example.test",
    emailVerified: true,
  }]);
  assert.deepEqual(duplicateFirestore.writes, []);
  assert.equal(duplicateFirestore.counts.duplicateFirestoreEmail, 2);

  const duplicateAuth = planAuthLinkBackfill([canonicalMember("member", {
    authUid: null,
    normalizedEmail: "duplicate@example.test",
  })], new Map(), [
    {
      uid: "first-auth",
      email: "duplicate@example.test",
      emailVerified: true,
    },
    {
      uid: "second-auth",
      email: "duplicate@example.test",
      emailVerified: true,
    },
  ]);
  assert.deepEqual(duplicateAuth.writes, []);
  assert.equal(duplicateAuth.counts.duplicateAuthEmail, 1);
});

test("member shape backfill canonicalizes legacy roles, active and email", () => {
  const plan = planAuthLinkBackfill([{
    memberId: "legacy-member",
    authUid: null,
    email: " Legacy@Example.test ",
    isProducer: true,
    isAdmin: true,
    available: false,
    untouchedLegacyField: "preserved",
  }], new Map());

  assert.deepEqual(plan.writes, [{
    authUid: null,
    memberId: "legacy-member",
    writeUser: true,
    writeLink: false,
    writeAuthUid: false,
    userPatch: {
      roles: ["member", "producer", "admin"],
      isActive: false,
      normalizedEmail: "legacy@example.test",
    },
    source: "member-shape",
  }]);
  assert.equal(plan.counts.membersNeedingCanonicalShape, 1);
  assert.equal(plan.counts.plannedMemberShapeWrites, 1);
  assert.equal(plan.counts.plannedOperations, 1);
});

test("member shape backfill counts invalid values without guessing email", () => {
  const plan = planAuthLinkBackfill([{
    memberId: "invalid-member",
    authUid: null,
    email: 42,
    roles: "admin",
    isProducer: "yes",
    isActive: "yes",
    available: "yes",
  }], new Map());

  assert.deepEqual(plan.writes[0].userPatch, {
    roles: ["member"],
    isActive: true,
  });
  assert.equal(plan.counts.invalidFirestoreEmail, 1);
  assert.equal(plan.counts.missingFirestoreEmail, 1);
  assert.equal(plan.counts.invalidRoleValues, 1);
  assert.equal(plan.counts.invalidActiveValues, 1);
});

test("auth-link apply rejects ambiguous role state and zero active admins", () => {
  const conflicting = planAuthLinkBackfill([canonicalMember("member-one", {
    roles: ["member"],
    isAdmin: true,
  })], new Map());
  assert.equal(conflicting.counts.conflictingRoleRepresentations, 1);
  assert.equal(conflicting.counts.activeAdminsAfter, 0);
  assert.throws(
    () => assertSafeAuthLinkApply(conflicting.counts, "develop"),
    /conflictingRoleRepresentations.*activeAdminsAfter/,
  );

  const safe = planAuthLinkBackfill([canonicalMember("admin-one", {
    roles: ["member", "admin"],
  })], new Map(), [{
    uid: "auth-admin-one",
    email: "admin-one@example.test",
    emailVerified: true,
  }]);
  assert.equal(safe.counts.activeAdminsAfter, 1);
  assert.equal(safe.counts.activeAdminsWithUniqueAuthEmail, 1);
  assert.equal(safe.counts.verifiedActiveAdminMatches, 1);
  assert.equal(safe.counts.unverifiedActiveAdminMatches, 0);
  assert.equal(safe.counts.linkedActiveAdminsAfter, 1);
  assert.doesNotThrow(() => assertSafeAuthLinkApply(safe.counts, "develop"));
});

test("Firebase Auth users are collected from every page", async () => {
  const calls = [];
  const auth = {
    async listUsers(limit, pageToken) {
      calls.push({limit, pageToken});
      if (!pageToken) {
        return {
          users: [{
            uid: "one",
            email: "one@example.test",
            emailVerified: true,
            disabled: false,
          }],
          pageToken: "next-page",
        };
      }
      return {
        users: [{uid: "two", emailVerified: false, disabled: true}],
      };
    },
  };

  assert.deepEqual(await listAllAuthUsers(auth), [
    {
      uid: "one",
      email: "one@example.test",
      emailVerified: true,
      disabled: false,
    },
    {
      uid: "two",
      email: null,
      emailVerified: false,
      disabled: true,
    },
  ]);
  assert.deepEqual(calls, [
    {limit: 1000, pageToken: undefined},
    {limit: 1000, pageToken: "next-page"},
  ]);
});

test("auth-link write batches never exceed 400 Firestore operations", () => {
  const writes = Array.from({length: 201}, (_, index) => ({
    authUid: `auth-${index}`,
    memberId: `member-${index}`,
    writeUser: true,
    writeLink: true,
  }));
  const chunks = chunkAuthLinkWrites(writes);
  assert.deepEqual(chunks.map((chunk) => chunk.length), [200, 1]);
  chunks.forEach((chunk) => assert.ok(
    chunk.reduce((total, item) =>
      total + Number(item.writeUser) + Number(item.writeLink), 0
    ) <= 400,
  ));
});

test("auth-link apply uses create so a racing link cannot be overwritten", async () => {
  const operations = [];
  const firestore = {
    batch() {
      return {
        update(ref, payload, precondition) {
          operations.push({kind: "update", ref, payload, precondition});
        },
        create(ref, payload) {
          operations.push({kind: "create", ref, payload});
        },
        async commit() {
          operations.push({kind: "commit"});
        },
      };
    },
    collection(path) {
      return {doc: (id) => `${path}/${id}`};
    },
  };

  const plan = planAuthLinkBackfill([canonicalMember("member-one", {
    authUid: null,
    roles: ["socio"],
    sourceUpdateTime: "snapshot-update-time",
  })], new Map(), [{
    uid: "auth-one",
    email: "member-one@example.test",
    emailVerified: true,
  }]);
  assert.equal(plan.writes[0].sourceUpdateTime, "snapshot-update-time");
  const result = await commitAuthLinkWrites(
    firestore,
    "develop/root",
    plan.writes,
  );

  assert.deepEqual(operations.map((operation) => operation.kind), [
    "update",
    "create",
    "commit",
  ]);
  assert.equal(operations[0].ref, "develop/root/users/member-one");
  assert.equal(operations[1].ref, "develop/root/authLinks/auth-one");
  assert.equal(operations[0].payload.authUid, "auth-one");
  assert.deepEqual(operations[0].precondition, {
    lastUpdateTime: "snapshot-update-time",
  });
  assert.deepEqual(result, {
    appliedMatches: 1,
    appliedMemberShapeWrites: 1,
    appliedUserWrites: 1,
    appliedLinkWrites: 1,
    appliedOperations: 2,
  });
});

test("public config extraction whitelists and sanitizes version policies", () => {
  assert.deepEqual(extractPublicVersions({
    versions: {
      android: {
        current: " 1.2.3 ",
        min: "invalid",
        forceUpdate: true,
        storeUrl: "javascript:alert(1)",
        internalRolloutPercent: 25,
      },
      ios: {
        current: "2.0",
        min: "1.9.1",
        forceUpdate: false,
        storeUrl: "https://apps.example.test/reguerta",
        reviewerNotes: "private",
      },
      web: {current: "99.0"},
    },
    reviewerAllowlistEmails: ["private@example.test"],
    cacheExpirationMinutes: 60,
  }), {
    versions: {
      android: {
        current: "1.2.3",
        min: "0.3.0",
        forceUpdate: true,
        storeUrl: "https://play.google.com/store/apps/details?id=com.reguerta.user",
      },
      ios: {
        current: "2.0",
        min: "1.9.1",
        forceUpdate: false,
        storeUrl: "https://apps.example.test/reguerta",
      },
    },
  });
  assert.throws(() => extractPublicVersions({cacheExpirationMinutes: 60}));
});

test("member config extraction excludes reviewer and version data", () => {
  const fallback = {kind: "fallback-timestamp"};
  const projection = extractMemberConfig({
    cacheExpirationMinutes: 30,
    deliveryDayOfWeek: "fri",
    lastTimestamps: {},
    versions: {ios: {current: "9.9"}},
    reviewerAllowlist: {emails: ["private@example.test"]},
  }, fallback);

  assert.equal(projection.cacheExpirationMinutes, 30);
  assert.equal(projection.deliveryDayOfWeek, "FRI");
  assert.deepEqual(Object.keys(projection.lastTimestamps).sort(), [
    "containers",
    "measures",
    "orderlines",
    "orders",
    "products",
    "users",
  ]);
  assert.equal(Object.hasOwn(projection, "versions"), false);
  assert.equal(Object.hasOwn(projection, "reviewerAllowlist"), false);
});

test("notification backfill resolves each private inbox audience", () => {
  const activeMembers = [
    {memberId: "one", roles: ["member"]},
    {memberId: "producer-one", roles: ["member", "producer"]},
  ];
  assert.deepEqual(resolveEventAudience({
    target: "users",
    targetPayload: {userIds: ["one", "missing", "one"]},
  }, activeMembers), ["one"]);
  assert.deepEqual(resolveEventAudience({
    target: "segment",
    targetPayload: {
      segmentType: "role",
      role: "Producer",
    },
  }, activeMembers), ["producer-one"]);
  const event = {
    title: "Title",
    body: "Body",
    type: "news",
    target: "users",
    targetPayload: {userIds: ["one", "producer-one"]},
    createdBy: "admin",
    sentAt: {seconds: 123},
  };
  assert.deepEqual(
    buildInboxDocument("event", event, "one").targetPayload,
    {userIds: ["one"]},
  );
  assert.deepEqual(
    buildInboxDocument("event", event, "producer-one").targetPayload,
    {userIds: ["producer-one"]},
  );
  assert.equal(
    buildInboxDocument("event", {title: "invalid"}, "one"),
    null,
  );
});

test("member-directory plan whitelists fields and counts only stale docs", () => {
  const plan = planMemberDirectoryBackfill([
    {
      memberId: "active-member",
      data: {
        displayName: "Active Member",
        normalizedEmail: "private@example.test",
        phoneNumber: "+34 600 000 000",
        authUid: "private-uid",
        roles: ["member", "producer"],
        isActive: true,
        companyName: "Test Farm",
      },
    },
    {
      memberId: "inactive-without-directory",
      data: {
        displayName: "Inactive Member",
        roles: ["member"],
        isActive: false,
      },
    },
  ], ["active-member", "stale-directory"]);

  assert.deepEqual(plan.desired.get("active-member"), {
    userId: "active-member",
    displayName: "Active Member",
    companyName: "Test Farm",
    roles: ["member", "producer"],
    isActive: true,
    producerCatalogEnabled: true,
    isCommonPurchaseManager: false,
    producerParity: null,
    ecoCommitment: {mode: "weekly", parity: null},
  });
  assert.equal(
    Object.hasOwn(plan.desired.get("active-member"), "normalizedEmail"),
    false,
  );
  assert.equal(
    Object.hasOwn(plan.desired.get("active-member"), "phoneNumber"),
    false,
  );
  assert.equal(
    Object.hasOwn(plan.desired.get("active-member"), "authUid"),
    false,
  );
  assert.equal(plan.counts.plannedSets, 1);
  assert.equal(plan.counts.plannedDeletes, 1);
  assert.deepEqual(plan.allIds, ["active-member", "stale-directory"]);
});

const makeMemberDirectoryFirestore = (currentMembers) => {
  const operations = [];
  return {
    operations,
    firestore: {
      collection(path) {
        return {
          doc(id) {
            return {id, path: `${path}/${id}`};
          },
        };
      },
      async runTransaction(work) {
        return work({
          async get(ref) {
            const value = currentMembers.get(ref.id);
            return value === undefined ? {
              exists: false,
              data: () => undefined,
            } : {
              exists: true,
              data: () => value,
            };
          },
          set(ref, payload, options) {
            operations.push({kind: "set", ref, payload, options});
          },
          delete(ref) {
            operations.push({kind: "delete", ref});
          },
        });
      },
    },
  };
};

test("member-directory apply deletes inactive and missing projections", async () => {
  const harness = makeMemberDirectoryFirestore(new Map([
    ["inactive-member", {
      displayName: "Inactive",
      roles: ["member"],
      isActive: false,
    }],
  ]));
  const result = await applyMemberDirectoryPlan(
    harness.firestore,
    "develop/plus-collections",
    {allIds: ["inactive-member", "missing-member"]},
  );

  assert.deepEqual(result, {appliedSets: 0, appliedDeletes: 2});
  assert.deepEqual(harness.operations.map(({kind, ref}) => ({
    kind,
    path: ref.path,
  })), [
    {
      kind: "delete",
      path: "develop/plus-collections/memberDirectory/inactive-member",
    },
    {
      kind: "delete",
      path: "develop/plus-collections/memberDirectory/missing-member",
    },
  ]);
});

test("member-directory apply re-reads the member inside its transaction", async () => {
  const planned = planMemberDirectoryBackfill([{
    memberId: "racing-member",
    data: {
      displayName: "Initially Active",
      roles: ["member"],
      isActive: true,
    },
  }], ["racing-member"]);
  assert.equal(planned.counts.plannedSets, 1);

  const harness = makeMemberDirectoryFirestore(new Map([
    ["racing-member", {
      displayName: "Now Inactive",
      roles: ["member"],
      isActive: false,
    }],
  ]));
  const result = await applyMemberDirectoryPlan(
    harness.firestore,
    "production/plus-collections",
    planned,
  );

  assert.deepEqual(result, {appliedSets: 0, appliedDeletes: 1});
  assert.deepEqual(harness.operations.map(({kind}) => kind), ["delete"]);
});

test("member-directory apply aborts before writes for malformed users", () => {
  const malformedPlan = planMemberDirectoryBackfill([{
    memberId: "malformed-member",
    data: {
      normalizedEmail: "private@example.test",
      roles: ["member"],
      isActive: true,
    },
  }], []);
  assert.equal(malformedPlan.counts.malformedUsers, 1);
  assert.throws(() => assertSafeMemberDirectoryApply([{
    environment: "develop",
    plan: malformedPlan,
  }]), /malformed users in: develop/);
});
