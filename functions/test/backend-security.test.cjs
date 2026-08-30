const assert = require("node:assert/strict");
const {test} = require("node:test");

const {
  assertMemberIdCompatible,
  buildMemberId,
  canProcessPrivilegedFirestoreEvent,
  HttpRequestError,
  extractBearerToken,
  isOperationallyLinkedAdmin,
  isVerifiedLinkedAdminActor,
  normalizeCanonicalRoles,
  parseAppEnvironment,
  parseMemberUpsertInput,
  parseReviewerRoutingPolicy,
  parseVerifiedIdentity,
  resolveMemberBusinessFields,
  resolveLinkedMember,
  resolveReviewerEnvironment,
  verifyBearerIdentity,
} = require("../lib/backend-security.js");
const {
  buildNotificationInboxDocument,
} = require("../lib/notification-inbox.js");

test("member ids remain distinct when long email slugs share a prefix", () => {
  const sharedPrefix = "a".repeat(60);
  const first = buildMemberId(`${sharedPrefix}1@example.test`);
  const second = buildMemberId(`${sharedPrefix}2@example.test`);
  assert.notEqual(first, second);
  assert.match(first, /^member_[a-z0-9_]+_[a-f0-9]{10}$/);
});

test("an existing member id can never be overwritten with another email", () => {
  assert.throws(
    () => assertMemberIdCompatible(
      true,
      {normalizedEmail: "old@example.test", authUid: null},
      "new@example.test",
    ),
    (error) => error instanceof HttpRequestError &&
      error.code === "member_id_conflict",
  );
  assert.throws(
    () => assertMemberIdCompatible(
      true,
      {normalizedEmail: "old@example.test", authUid: "auth-one"},
      "new@example.test",
    ),
    (error) => error instanceof HttpRequestError &&
      error.code === "member_id_conflict",
  );
  assert.doesNotThrow(() => assertMemberIdCompatible(
    true,
    {normalizedEmail: "same@example.test", authUid: "auth-one"},
    "same@example.test",
  ));
  assert.doesNotThrow(() => assertMemberIdCompatible(
    false,
    {},
    "new@example.test",
  ));
});

test("accepts only develop and production environments", () => {
  assert.equal(parseAppEnvironment(" develop "), "develop");
  assert.equal(parseAppEnvironment("PRODUCTION"), "production");
  assert.throws(
    () => parseAppEnvironment("local"),
    (error) => error instanceof HttpRequestError && error.status === 400,
  );
});

test("reviewer routing policy accepts canonical and legacy allowlists", () => {
  assert.deepEqual(parseReviewerRoutingPolicy({
    reviewerAllowlistEmails: " Canonical@Example.test ",
    reviewerEmails: ["legacy@example.test", " "],
    reviewerAllowlistUids: [" canonical-uid "],
    reviewerUids: "legacy-uid",
    reviewerAllowlist: {
      emails: ["nested@example.test"],
      allowlistedEmails: "nested-legacy@example.test",
      uids: "nested-uid",
      allowlistedUids: ["nested-legacy-uid"],
    },
  }), {
    emails: [
      "canonical@example.test",
      "legacy@example.test",
      "nested@example.test",
      "nested-legacy@example.test",
    ],
    uids: [
      "canonical-uid",
      "legacy-uid",
      "nested-uid",
      "nested-legacy-uid",
    ],
  });
  assert.deepEqual(parseReviewerRoutingPolicy({
    reviewerAllowlist: ["root-legacy@example.test"],
  }), {
    emails: ["root-legacy@example.test"],
    uids: [],
  });
});

test("only an allowlisted production identity routes to develop", () => {
  const policy = {
    reviewerAllowlistEmails: ["reviewer@example.test"],
    reviewerAllowlistUids: ["reviewer-uid"],
  };
  assert.equal(resolveReviewerEnvironment("production", {
    uid: "other-uid",
    email: "reviewer@example.test",
    emailVerified: false,
  }, policy), "develop");
  assert.equal(resolveReviewerEnvironment("production", {
    uid: "reviewer-uid",
    email: null,
    emailVerified: false,
  }, policy), "develop");
  assert.equal(resolveReviewerEnvironment("production", {
    uid: "other-uid",
    email: "member@example.test",
    emailVerified: true,
  }, policy), "production");
  assert.equal(resolveReviewerEnvironment("develop", {
    uid: "reviewer-uid",
    email: "reviewer@example.test",
    emailVerified: true,
  }, policy), "develop");
});

test("extracts only a well-formed bearer token", () => {
  assert.equal(extractBearerToken("Bearer token-123"), "token-123");
  assert.throws(
    () => extractBearerToken("Basic token-123"),
    (error) => error instanceof HttpRequestError && error.status === 401,
  );
  assert.throws(
    () => extractBearerToken(undefined),
    (error) => error instanceof HttpRequestError && error.code === "unauthenticated",
  );
});

test("derives identity only from a verified token", () => {
  assert.deepEqual(parseVerifiedIdentity({
    uid: " uid-1 ",
    email: " Tester@Example.test ",
    email_verified: true,
  }), {
    uid: "uid-1",
    email: "tester@example.test",
    emailVerified: true,
  });
  assert.throws(
    () => parseVerifiedIdentity({uid: ""}),
    (error) => error instanceof HttpRequestError && error.status === 401,
  );
});

test("verifies revocation and hides token-provider failures", async () => {
  const calls = [];
  assert.deepEqual(await verifyBearerIdentity(
    "Bearer token-123",
    async (token, checkRevoked) => {
      calls.push({token, checkRevoked});
      return {uid: "uid-1", email_verified: false};
    },
  ), {
    uid: "uid-1",
    email: null,
    emailVerified: false,
  });
  assert.deepEqual(calls, [{token: "token-123", checkRevoked: true}]);
  await assert.rejects(
    verifyBearerIdentity("Bearer revoked", async () => {
      throw new Error("provider detail that must not escape");
    }),
    (error) => error instanceof HttpRequestError &&
      error.status === 401 &&
      error.code === "unauthenticated" &&
      !error.message.includes("provider detail"),
  );
});

test("normalizes only canonical roles and requires member", () => {
  assert.deepEqual(
    normalizeCanonicalRoles(["admin", "member", "admin"]),
    ["member", "admin"],
  );
  assert.throws(
    () => normalizeCanonicalRoles(["admin"]),
    (error) => error instanceof HttpRequestError && error.code === "invalid_roles",
  );
  assert.throws(
    () => normalizeCanonicalRoles(["member", "reviewer"]),
    (error) => error instanceof HttpRequestError && error.code === "invalid_roles",
  );
});

test("resolves only an active member whose link and uid agree", () => {
  assert.deepEqual(resolveLinkedMember(
    "uid-1",
    {memberId: "member-1"},
    {
      authUid: "uid-1",
      isActive: true,
      roles: ["member", "producer"],
    },
  ), {
    memberId: "member-1",
    roles: ["member", "producer"],
    isActive: true,
  });
  assert.throws(
    () => resolveLinkedMember(
      "uid-1",
      {memberId: "member-1"},
      {authUid: "uid-2", isActive: true, roles: ["member"]},
    ),
    (error) => error instanceof HttpRequestError && error.status === 403,
  );
  assert.throws(
    () => resolveLinkedMember(
      "uid-1",
      {memberId: "member-1"},
      {authUid: "uid-1", isActive: false, roles: ["member"]},
    ),
    (error) => error instanceof HttpRequestError && error.code === "inactive_member",
  );
});

test("privileged Firestore events trust only backend or resolved admins", async () => {
  const resolvedUids = [];
  const resolver = async (uid) => {
    resolvedUids.push(uid);
    return uid === "admin-uid";
  };

  assert.equal(await canProcessPrivilegedFirestoreEvent(
    {authType: "system"},
    resolver,
  ), true);
  assert.equal(await canProcessPrivilegedFirestoreEvent(
    {authType: "service_account", authId: "service@example.test"},
    resolver,
  ), true);
  assert.deepEqual(resolvedUids, []);

  assert.equal(await canProcessPrivilegedFirestoreEvent(
    {authType: "unknown", authId: " admin-uid "},
    resolver,
  ), true);
  assert.equal(await canProcessPrivilegedFirestoreEvent(
    {authType: "unknown", authId: "member-uid"},
    resolver,
  ), false);
  assert.deepEqual(resolvedUids, ["admin-uid", "member-uid"]);
});

test("privileged Firestore events fail closed for every other actor", async () => {
  let resolverCalls = 0;
  const resolver = async () => {
    resolverCalls += 1;
    throw new Error("lookup failed");
  };

  for (const context of [
    {authType: "api_key", authId: "api-key"},
    {authType: "unauthenticated"},
    {authType: "unknown"},
    {authType: "unknown", authId: " "},
  ]) {
    assert.equal(await canProcessPrivilegedFirestoreEvent(
      context,
      resolver,
    ), false);
  }
  assert.equal(resolverCalls, 0);
  assert.equal(await canProcessPrivilegedFirestoreEvent(
    {authType: "unknown", authId: "admin-uid"},
    resolver,
  ), false);
  assert.equal(resolverCalls, 1);
});

test("client admin requires verified Auth and reciprocal canonical identity", () => {
  const authUser = {
    uid: "admin-uid",
    email: " Admin@Example.test ",
    emailVerified: true,
    disabled: false,
  };
  const link = {memberId: "admin-member"};
  const member = {
    authUid: "admin-uid",
    normalizedEmail: "admin@example.test",
    isActive: true,
    roles: ["member", "admin"],
  };

  assert.equal(isVerifiedLinkedAdminActor(
    "admin-uid",
    authUser,
    link,
    member,
  ), true);
  assert.equal(isVerifiedLinkedAdminActor(
    "admin-uid",
    {...authUser, disabled: true},
    link,
    member,
  ), false);
  assert.equal(isVerifiedLinkedAdminActor(
    "admin-uid",
    {...authUser, emailVerified: false},
    link,
    member,
  ), false);
  assert.equal(isVerifiedLinkedAdminActor(
    "admin-uid",
    {...authUser, email: "other@example.test"},
    link,
    member,
  ), false);
  assert.equal(isVerifiedLinkedAdminActor(
    "admin-uid",
    authUser,
    link,
    {...member, roles: ["member"]},
  ), false);
  assert.equal(isVerifiedLinkedAdminActor(
    "admin-uid",
    authUser,
    link,
    {...member, authUid: "different-uid"},
  ), false);
});

test("last-admin guard counts only active reciprocal admin links", () => {
  const member = {
    authUid: "admin-uid",
    isActive: true,
    roles: ["member", "admin"],
  };
  assert.equal(isOperationallyLinkedAdmin(
    "admin-member",
    member,
    {memberId: "admin-member"},
  ), true);
  for (const [candidateMember, link] of [
    [{...member, authUid: null}, {memberId: "admin-member"}],
    [{...member, isActive: false}, {memberId: "admin-member"}],
    [{...member, roles: ["member"]}, {memberId: "admin-member"}],
    [member, undefined],
    [member, {memberId: "different-member"}],
  ]) {
    assert.equal(isOperationallyLinkedAdmin(
      "admin-member",
      candidateMember,
      link,
    ), false);
  }
});

test("validates the admin member payload without accepting actor identity", () => {
  assert.deepEqual(parseMemberUpsertInput({
    memberId: "member_2",
    displayName: "  Member Two  ",
    email: " MEMBER2@Example.test ",
    roles: ["producer", "member"],
    isActive: true,
    producerCatalogEnabled: false,
    isCommonPurchaseManager: true,
    companyName: "  Huerta Two  ",
    phoneNumber: null,
    producerParity: "even",
    ecoCommitmentMode: "biweekly",
    ecoCommitmentParity: null,
    actorAuthUid: "must-be-ignored",
  }), {
    memberId: "member_2",
    displayName: "Member Two",
    normalizedEmail: "member2@example.test",
    roles: ["member", "producer"],
    isActive: true,
    producerCatalogEnabled: false,
    isCommonPurchaseManager: true,
    companyName: {kind: "set", value: "Huerta Two"},
    phoneNumber: {kind: "clear"},
    producerParity: {kind: "set", value: "even"},
    ecoCommitment: {
      mode: {kind: "set", value: "biweekly"},
      parity: {kind: "clear"},
    },
  });
  assert.throws(
    () => parseMemberUpsertInput({
      displayName: "Member",
      email: "not-an-email",
      roles: ["member"],
    }),
    (error) => error instanceof HttpRequestError && error.code === "invalid_email",
  );
});

test("accepts canonical and flattened eco commitment fields", () => {
  const parsed = parseMemberUpsertInput({
    displayName: "Member",
    normalizedEmail: "member@example.test",
    roles: ["member"],
    ecoCommitment: {mode: "weekly", parity: "odd"},
    ecoCommitmentMode: "weekly",
    ecoCommitmentParity: "odd",
  });
  assert.deepEqual(parsed.ecoCommitment, {
    mode: {kind: "set", value: "weekly"},
    parity: {kind: "set", value: "odd"},
  });
  assert.throws(() => parseMemberUpsertInput({
    displayName: "Member",
    normalizedEmail: "member@example.test",
    roles: ["member"],
    ecoCommitment: {mode: "weekly"},
    ecoCommitmentMode: "biweekly",
  }), (error) =>
    error instanceof HttpRequestError &&
    error.code === "conflicting_eco_commitment",
  );
});

test("transaction fields preserve omissions and apply explicit clears", () => {
  const current = {
    companyName: "Existing company",
    phoneNumber: "+34 600 000 000",
    producerParity: "odd",
    ecoCommitment: {mode: "biweekly", parity: "even"},
  };
  const preserving = parseMemberUpsertInput({
    displayName: "Member",
    normalizedEmail: "member@example.test",
    roles: ["member"],
  });
  assert.deepEqual(resolveMemberBusinessFields(preserving, current), current);

  const clearing = parseMemberUpsertInput({
    displayName: "Member",
    normalizedEmail: "member@example.test",
    roles: ["member"],
    companyName: null,
    phoneNumber: " ",
    producerParity: null,
    ecoCommitment: {mode: "weekly", parity: null},
  });
  assert.deepEqual(resolveMemberBusinessFields(clearing, current), {
    companyName: null,
    phoneNumber: null,
    producerParity: null,
    ecoCommitment: {mode: "weekly", parity: null},
  });
});

test("a producer transaction cannot clear its required company", () => {
  const input = parseMemberUpsertInput({
    displayName: "Producer",
    normalizedEmail: "producer@example.test",
    roles: ["member", "producer"],
    companyName: null,
  });
  assert.throws(
    () => resolveMemberBusinessFields(input, {companyName: "Old company"}),
    (error) => error instanceof HttpRequestError &&
      error.code === "producer_company_required",
  );
});

test("builds an immutable notification inbox copy without dispatch state", () => {
  const sentAt = {seconds: 123};
  assert.deepEqual(buildNotificationInboxDocument("event-1", {
    title: "Title",
    body: "Body",
    type: "news",
    target: "users",
    targetPayload: {
      userIds: ["member-1", "member-2"],
      internalAudienceNote: "private",
    },
    createdBy: "admin-1",
    sentAt,
    weekKey: "2026-W30",
    dispatch: {status: "success"},
  }, "member-1"), {
    notificationEventId: "event-1",
    title: "Title",
    body: "Body",
    type: "news",
    target: "users",
    targetPayload: {userIds: ["member-1"]},
    createdBy: "admin-1",
    sentAt,
    weekKey: "2026-W30",
  });
  assert.deepEqual(buildNotificationInboxDocument("event-all", {
    title: "Title",
    body: "Body",
    type: "news",
    target: "all",
    targetPayload: {userIds: ["must-not-leak"]},
    createdBy: "admin-1",
    sentAt,
  }, "member-1")?.targetPayload, {});
  assert.deepEqual(buildNotificationInboxDocument("event-role", {
    title: "Title",
    body: "Body",
    type: "news",
    target: "segment",
    targetPayload: {
      segmentType: "role",
      role: "producer",
      userIds: ["must-not-leak"],
      internalAudienceNote: "private",
    },
    createdBy: "admin-1",
    sentAt,
  }, "producer-1")?.targetPayload, {
    segmentType: "role",
    role: "producer",
  });
  assert.deepEqual(buildNotificationInboxDocument("event-planning", {
    schemaVersion: 1,
    operationKind: "shiftPlanningNotification",
    contentPolicy: "genericReferenceOnly",
    title: "Turnos actualizados",
    body: "Consulta la aplicación para ver la información actualizada.",
    type: "shift_updated",
    target: "users",
    targetPayload: {userIds: ["member-1"]},
    createdBy: "system",
    sentAt,
  }, "member-1"), {
    notificationEventId: "event-planning",
    schemaVersion: 1,
    operationKind: "shiftPlanningNotification",
    contentPolicy: "genericReferenceOnly",
    title: "Turnos actualizados",
    body: "Consulta la aplicación para ver la información actualizada.",
    type: "shift_updated",
    target: "users",
    targetPayload: {userIds: ["member-1"]},
    createdBy: "system",
    sentAt,
  });
  assert.equal(buildNotificationInboxDocument("event-planning", {
    schemaVersion: 1,
    operationKind: "shiftPlanningNotification",
    title: "Private shift detail",
    body: "Member and date",
    type: "shift_updated",
    target: "users",
    targetPayload: {userIds: ["member-1"]},
    createdBy: "system",
    sentAt,
  }, "member-1"), null);
  assert.equal(buildNotificationInboxDocument("event-1", {
    title: "Missing fields",
  }, "member-1"), null);
});
