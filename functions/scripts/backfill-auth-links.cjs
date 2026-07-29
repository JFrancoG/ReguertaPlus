#!/usr/bin/env node

const {deleteApp, initializeApp} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {FieldValue, getFirestore} = require("firebase-admin/firestore");

const ALLOWED_ENVIRONMENTS = new Set(["develop", "production"]);
const MAX_BATCH_OPERATIONS = 400;
const CANONICAL_ROLE_ORDER = ["member", "producer", "admin"];
const ROLE_ALIASES = new Map([
  ["member", "member"],
  ["socio", "member"],
  ["producer", "producer"],
  ["productor", "producer"],
  ["admin", "admin"],
  ["administrador", "admin"],
]);
const RETAINED_DEVELOP_NON_AUTH_FIXTURES = new Map([
  ["member_admin_001", "mock_ana_admin_reguerta_app"],
  ["member_producer_001", "mock_pablo_producer_reguerta_app"],
]);

function parseMigrationArgs(args) {
  let apply = false;
  let projectId = null;
  const environmentValues = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--apply") {
      apply = true;
    } else if (argument === "--project") {
      projectId = args[index + 1] || null;
      index += 1;
    } else if (argument === "--env") {
      environmentValues.push(args[index + 1] || "");
      index += 1;
    } else {
      throw new Error("Unsupported argument");
    }
  }

  if (!projectId || !/^[a-z0-9][a-z0-9-]{2,62}$/i.test(projectId)) {
    throw new Error("--project with an explicit Firebase project id is required");
  }
  const environments = environmentValues.length === 0 ?
    ["develop", "production"] :
    [...new Set(environmentValues
      .flatMap((value) => value.split(","))
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean))];
  if (
    environments.length === 0 ||
    environments.some((environment) =>
      !ALLOWED_ENVIRONMENTS.has(environment)
    )
  ) {
    throw new Error("--env supports only develop and production");
  }
  return {apply, projectId, environments};
}

function isValidAuthUid(value) {
  return typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    value.length <= 128 &&
    !value.includes("/");
}

function normalizeEmail(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length === 0 ||
    normalized.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function analyzeFirestoreEmails(user) {
  const emails = [];
  let invalidValue = false;
  ["normalizedEmail", "emailNormalized", "email"].forEach((key) => {
    const value = user[key];
    if (value === null || value === undefined || value === "") {
      return;
    }
    if (typeof value !== "string" || value.trim().length === 0) {
      invalidValue = true;
      return;
    }
    const normalized = normalizeEmail(value);
    if (normalized) {
      emails.push(normalized);
    } else {
      invalidValue = true;
    }
  });
  const uniqueEmails = Array.from(new Set(emails));
  return {
    emails: uniqueEmails,
    canonicalEmail: emails[0] || null,
    matchEmail: uniqueEmails.length === 1 ? uniqueEmails[0] : null,
    invalidValue,
    conflicting: uniqueEmails.length > 1,
  };
}

function analyzeMemberShape(user) {
  const rawRoles = user.roles;
  const parsedRoles = new Set();
  let invalidRoleValue = false;
  if (Array.isArray(rawRoles)) {
    rawRoles.forEach((value) => {
      const normalized = typeof value === "string" ?
        value.trim().toLowerCase() : "";
      const canonical = ROLE_ALIASES.get(normalized);
      if (canonical) {
        parsedRoles.add(canonical);
      } else {
        invalidRoleValue = true;
      }
    });
  } else if (rawRoles !== null && rawRoles !== undefined) {
    invalidRoleValue = true;
  }
  ["isProducer", "isAdmin"].forEach((key) => {
    if (hasOwn(user, key) && user[key] !== null &&
        user[key] !== undefined && typeof user[key] !== "boolean") {
      invalidRoleValue = true;
    }
  });
  const hasCanonicalRoles = parsedRoles.size > 0;
  const conflictingRoleRepresentations = hasCanonicalRoles &&
    (
      (typeof user.isProducer === "boolean" &&
        user.isProducer !== parsedRoles.has("producer")) ||
      (typeof user.isAdmin === "boolean" &&
        user.isAdmin !== parsedRoles.has("admin"))
    );
  if (!hasCanonicalRoles) {
    if (user.isProducer === true) {
      parsedRoles.add("producer");
    }
    if (user.isAdmin === true) {
      parsedRoles.add("admin");
    }
  }
  parsedRoles.add("member");
  const roles = CANONICAL_ROLE_ORDER.filter((role) => parsedRoles.has(role));

  let invalidActiveValue = false;
  ["isActive", "available"].forEach((key) => {
    if (hasOwn(user, key) && user[key] !== null &&
        user[key] !== undefined && typeof user[key] !== "boolean") {
      invalidActiveValue = true;
    }
  });
  const isActive = typeof user.isActive === "boolean" ? user.isActive :
    typeof user.available === "boolean" ? user.available : true;
  const emailAnalysis = analyzeFirestoreEmails(user);
  const patch = {};
  if (
    !Array.isArray(rawRoles) ||
    rawRoles.length !== roles.length ||
    rawRoles.some((role, index) => role !== roles[index])
  ) {
    patch.roles = roles;
  }
  if (user.isActive !== isActive) {
    patch.isActive = isActive;
  }
  if (
    emailAnalysis.canonicalEmail &&
    user.normalizedEmail !== emailAnalysis.canonicalEmail
  ) {
    patch.normalizedEmail = emailAnalysis.canonicalEmail;
  }
  return {
    patch,
    invalidRoleValue,
    invalidActiveValue,
    conflictingRoleRepresentations,
    canonicalRoles: roles,
    canonicalIsActive: isActive,
    emailAnalysis,
  };
}

function addToGroup(map, key, value) {
  const values = map.get(key) || [];
  values.push(value);
  map.set(key, values);
}

function addWrite(writes, counts, write) {
  writes.push(write);
  if (write.writeUser) {
    counts.plannedUserWrites += 1;
    if (Object.keys(write.userPatch || {}).length > 0) {
      counts.plannedMemberShapeWrites += 1;
    }
  }
  if (write.writeLink) {
    counts.plannedLinkWrites += 1;
  }
}

function planAuthLinkBackfill(
  users,
  existingLinks,
  authUsers = [],
  options = {},
) {
  const authUids = new Set(authUsers.map((user) => user.uid));
  const retainedFixtureMemberIds = new Set();
  if (
    options.environment === "develop" &&
    options.dataset === "plus-collections"
  ) {
    users.forEach((user) => {
      const expectedUid = RETAINED_DEVELOP_NON_AUTH_FIXTURES.get(
        user.memberId,
      );
      if (
        expectedUid &&
        user.authUid === expectedUid &&
        !authUids.has(expectedUid) &&
        !existingLinks.has(expectedUid)
      ) {
        retainedFixtureMemberIds.add(user.memberId);
      }
    });
  }
  const migrationUsers = users.filter(
    (user) => !retainedFixtureMemberIds.has(user.memberId),
  );
  const counts = {
    usersScanned: users.length,
    usersEligibleForMigration: migrationUsers.length,
    retainedDevelopNonAuthFixtures: retainedFixtureMemberIds.size,
    authUsersScanned: authUsers.length,
    usersWithUid: 0,
    usersWithoutUid: 0,
    existingAligned: 0,
    invalidUid: 0,
    invalidAuthUid: 0,
    duplicateUid: 0,
    duplicateAuthUid: 0,
    duplicateFirestoreEmail: 0,
    duplicateAuthEmail: 0,
    conflictingFirestoreEmailFields: 0,
    skippedDuplicateEmailCanonicalization: 0,
    missingFirestoreEmail: 0,
    invalidFirestoreEmail: 0,
    invalidRoleValues: 0,
    invalidActiveValues: 0,
    conflictingRoleRepresentations: 0,
    activeAdminsAfter: 0,
    linkedActiveAdminsAfter: 0,
    activeAdminsWithUniqueAuthEmail: 0,
    verifiedActiveAdminMatches: 0,
    unverifiedActiveAdminMatches: 0,
    disabledActiveAdminMatches: 0,
    activeAdminsWithoutUniqueAuthEmail: 0,
    existingUidMissingAuthUser: 0,
    existingUidEmailMismatch: 0,
    existingUidUnverified: 0,
    existingUidDisabled: 0,
    membersNeedingCanonicalShape: 0,
    unmatchedEmail: 0,
    unverifiedAuthEmail: 0,
    disabledAuthUser: 0,
    conflicts: 0,
    plannedMatches: 0,
    plannedMemberShapeWrites: 0,
    plannedUserWrites: 0,
    plannedLinkWrites: 0,
    plannedOperations: 0,
  };
  const preparedUsers = migrationUsers.map((user) => {
    const rawAuthUid = user.authUid;
    const hasAuthUid = rawAuthUid !== null &&
      rawAuthUid !== undefined && rawAuthUid !== "";
    const shape = analyzeMemberShape(user);
    const emails = shape.emailAnalysis.emails;
    if (hasAuthUid) {
      counts.usersWithUid += 1;
      if (!isValidAuthUid(rawAuthUid)) {
        counts.invalidUid += 1;
      }
    } else {
      counts.usersWithoutUid += 1;
    }
    if (shape.emailAnalysis.conflicting) {
      counts.conflictingFirestoreEmailFields += 1;
    }
    if (!shape.emailAnalysis.canonicalEmail) {
      counts.missingFirestoreEmail += 1;
    }
    if (shape.emailAnalysis.invalidValue) {
      counts.invalidFirestoreEmail += 1;
    }
    if (shape.invalidRoleValue) {
      counts.invalidRoleValues += 1;
    }
    if (shape.invalidActiveValue) {
      counts.invalidActiveValues += 1;
    }
    if (shape.conflictingRoleRepresentations) {
      counts.conflictingRoleRepresentations += 1;
    }
    if (
      shape.canonicalIsActive &&
      shape.canonicalRoles.includes("admin")
    ) {
      counts.activeAdminsAfter += 1;
    }
    if (Object.keys(shape.patch).length > 0) {
      counts.membersNeedingCanonicalShape += 1;
    }
    return {
      memberId: user.memberId,
      authUid: isValidAuthUid(rawAuthUid) ? rawAuthUid : null,
      hasAuthUid,
      emails,
      email: shape.emailAnalysis.matchEmail,
      canonicalRoles: shape.canonicalRoles,
      canonicalIsActive: shape.canonicalIsActive,
      userPatch: shape.patch,
      ...(user.sourceUpdateTime ?
        {sourceUpdateTime: user.sourceUpdateTime} : {}),
    };
  });

  const usersByUid = new Map();
  const usersByEmail = new Map();
  preparedUsers.forEach((user) => {
    if (user.authUid) {
      addToGroup(usersByUid, user.authUid, user);
    }
    user.emails.forEach((email) => addToGroup(usersByEmail, email, user));
  });
  const duplicateUidUsers = new Set();
  usersByUid.forEach((group) => {
    if (group.length > 1) {
      group.forEach((user) => duplicateUidUsers.add(user.memberId));
    }
  });
  counts.duplicateUid = duplicateUidUsers.size;
  const duplicateEmailUsers = new Set();
  usersByEmail.forEach((group) => {
    if (new Set(group.map((user) => user.memberId)).size > 1) {
      group.forEach((user) => duplicateEmailUsers.add(user.memberId));
    }
  });
  counts.duplicateFirestoreEmail = duplicateEmailUsers.size;
  preparedUsers.forEach((user) => {
    if (
      duplicateEmailUsers.has(user.memberId) &&
      hasOwn(user.userPatch, "normalizedEmail")
    ) {
      const wasOnlyShapeChange = Object.keys(user.userPatch).length === 1;
      delete user.userPatch.normalizedEmail;
      counts.skippedDuplicateEmailCanonicalization += 1;
      if (wasOnlyShapeChange) {
        counts.membersNeedingCanonicalShape -= 1;
      }
    }
  });

  const preparedAuthUsers = authUsers.map((authUser) => ({
    uid: authUser.uid,
    uidIsValid: isValidAuthUid(authUser.uid),
    email: normalizeEmail(authUser.email),
    emailVerified: authUser.emailVerified === true,
    disabled: authUser.disabled === true,
  }));
  const authUsersByUid = new Map();
  const authUsersByEmail = new Map();
  preparedAuthUsers.forEach((authUser) => {
    if (!authUser.uidIsValid) {
      counts.invalidAuthUid += 1;
    } else {
      addToGroup(authUsersByUid, authUser.uid, authUser);
    }
    if (authUser.email) {
      addToGroup(authUsersByEmail, authUser.email, authUser);
      if (!authUser.emailVerified) {
        counts.unverifiedAuthEmail += 1;
      }
    }
    if (authUser.disabled) {
      counts.disabledAuthUser += 1;
    }
  });
  const duplicateAuthUids = new Set();
  authUsersByUid.forEach((group, uid) => {
    if (group.length > 1) {
      duplicateAuthUids.add(uid);
    }
  });
  counts.duplicateAuthUid = duplicateAuthUids.size;
  const duplicateAuthEmails = new Set();
  authUsersByEmail.forEach((group, email) => {
    if (group.length > 1) {
      duplicateAuthEmails.add(email);
    }
  });
  counts.duplicateAuthEmail = duplicateAuthEmails.size;

  const linkedUidsByMember = new Map();
  existingLinks.forEach((memberId, uid) => {
    if (typeof memberId === "string" && memberId.length > 0) {
      addToGroup(linkedUidsByMember, memberId, uid);
    }
  });

  const writes = [];
  usersByUid.forEach((group, authUid) => {
    if (group.length !== 1) {
      return;
    }
    const user = group[0];
    const authGroup = authUsersByUid.get(authUid) || [];
    if (authGroup.length === 0) {
      counts.existingUidMissingAuthUser += 1;
      return;
    }
    if (authGroup.length !== 1) {
      return;
    }
    const authUser = authGroup[0];
    if (!authUser.emailVerified) {
      counts.existingUidUnverified += 1;
    }
    if (authUser.disabled) {
      counts.existingUidDisabled += 1;
    }
    if (!user.email || authUser.email !== user.email) {
      counts.existingUidEmailMismatch += 1;
    }
    if (
      !authUser.uidIsValid ||
      !authUser.emailVerified ||
      authUser.disabled ||
      !user.email ||
      authUser.email !== user.email
    ) {
      return;
    }
    const linkedUids = linkedUidsByMember.get(user.memberId) || [];
    const hasOwnLink = existingLinks.has(authUid);
    const linkedMemberId = existingLinks.get(authUid);
    if (hasOwnLink && linkedMemberId === user.memberId) {
      if (linkedUids.length === 1) {
        counts.existingAligned += 1;
      } else {
        counts.conflicts += 1;
      }
      return;
    }
    if (hasOwnLink || linkedUids.length > 0) {
      counts.conflicts += 1;
      return;
    }
    addWrite(writes, counts, {
      authUid,
      memberId: user.memberId,
      writeUser: Object.keys(user.userPatch).length > 0,
      writeLink: true,
      writeAuthUid: false,
      userPatch: user.userPatch,
      source: "existing-auth-uid",
      ...(user.sourceUpdateTime ?
        {sourceUpdateTime: user.sourceUpdateTime} : {}),
    });
  });

  preparedUsers.forEach((user) => {
    if (user.hasAuthUid) {
      return;
    }
    if (!user.email) {
      return;
    }
    const firestoreGroup = usersByEmail.get(user.email) || [];
    if (new Set(firestoreGroup.map((item) => item.memberId)).size !== 1) {
      return;
    }
    const authGroup = authUsersByEmail.get(user.email) || [];
    if (authGroup.length === 0) {
      counts.unmatchedEmail += 1;
      return;
    }
    if (authGroup.length !== 1) {
      return;
    }
    const authUser = authGroup[0];
    if (
      !authUser.uidIsValid ||
      !authUser.emailVerified ||
      authUser.disabled ||
      duplicateAuthUids.has(authUser.uid)
    ) {
      return;
    }
    if (usersByUid.has(authUser.uid)) {
      counts.conflicts += 1;
      return;
    }
    const linkedUids = linkedUidsByMember.get(user.memberId) || [];
    const hasCandidateLink = existingLinks.has(authUser.uid);
    const candidateLinkedMember = existingLinks.get(authUser.uid);
    if (hasCandidateLink && candidateLinkedMember !== user.memberId) {
      counts.conflicts += 1;
      return;
    }
    if (
      linkedUids.some((linkedUid) => linkedUid !== authUser.uid) ||
      (hasCandidateLink && linkedUids.length !== 1)
    ) {
      counts.conflicts += 1;
      return;
    }
    addWrite(writes, counts, {
      authUid: authUser.uid,
      memberId: user.memberId,
      writeUser: true,
      writeLink: !hasCandidateLink,
      writeAuthUid: true,
      userPatch: user.userPatch,
      source: "verified-email",
      ...(user.sourceUpdateTime ?
        {sourceUpdateTime: user.sourceUpdateTime} : {}),
    });
  });

  const membersWithWrites = new Set(writes.map((write) => write.memberId));
  preparedUsers.forEach((user) => {
    if (
      Object.keys(user.userPatch).length === 0 ||
      membersWithWrites.has(user.memberId)
    ) {
      return;
    }
    addWrite(writes, counts, {
      authUid: user.authUid,
      memberId: user.memberId,
      writeUser: true,
      writeLink: false,
      writeAuthUid: false,
      userPatch: user.userPatch,
      source: "member-shape",
      ...(user.sourceUpdateTime ?
        {sourceUpdateTime: user.sourceUpdateTime} : {}),
    });
  });

  writes.sort((left, right) =>
    left.memberId.localeCompare(right.memberId) ||
    String(left.authUid || "").localeCompare(String(right.authUid || ""))
  );
  counts.plannedMatches = writes.filter((write) =>
    write.source !== "member-shape"
  ).length;
  counts.plannedOperations =
    counts.plannedUserWrites + counts.plannedLinkWrites;

  const finalLinks = new Map(existingLinks);
  const effectiveUidByMember = new Map();
  preparedUsers.forEach((user) => {
    if (user.authUid) {
      effectiveUidByMember.set(user.memberId, user.authUid);
    }
  });
  writes.forEach((write) => {
    if (write.writeLink) {
      finalLinks.set(write.authUid, write.memberId);
    }
    if (write.writeAuthUid) {
      effectiveUidByMember.set(write.memberId, write.authUid);
    }
  });
  preparedUsers.forEach((user) => {
    if (
      !user.canonicalIsActive ||
      !user.canonicalRoles.includes("admin")
    ) {
      return;
    }
    const authEmailGroup = user.email ?
      (authUsersByEmail.get(user.email) || []) : [];
    if (authEmailGroup.length === 1) {
      counts.activeAdminsWithUniqueAuthEmail += 1;
      if (authEmailGroup[0].disabled) {
        counts.disabledActiveAdminMatches += 1;
      } else if (!authEmailGroup[0].emailVerified) {
        counts.unverifiedActiveAdminMatches += 1;
      } else {
        counts.verifiedActiveAdminMatches += 1;
      }
    } else {
      counts.activeAdminsWithoutUniqueAuthEmail += 1;
    }
    const uid = effectiveUidByMember.get(user.memberId);
    const authGroup = authUsersByUid.get(uid) || [];
    const authUser = authGroup.length === 1 ? authGroup[0] : null;
    if (
      authUser &&
      authUser.uidIsValid &&
      authUser.emailVerified &&
      !authUser.disabled &&
      user.email &&
      authUser.email === user.email &&
      finalLinks.get(uid) === user.memberId
    ) {
      counts.linkedActiveAdminsAfter += 1;
    }
  });
  return {writes, counts};
}

async function listAllAuthUsers(auth) {
  const users = [];
  let pageToken;
  do {
    const result = await auth.listUsers(1000, pageToken);
    result.users.forEach((user) => users.push({
      uid: user.uid,
      email: user.email || null,
      emailVerified: user.emailVerified === true,
      disabled: user.disabled === true,
    }));
    pageToken = result.pageToken;
  } while (pageToken);
  return users;
}

function chunkAuthLinkWrites(items, maximumOperations = MAX_BATCH_OPERATIONS) {
  const chunks = [];
  let currentChunk = [];
  let currentOperations = 0;
  items.forEach((item) => {
    const itemOperations = Number(item.writeUser) + Number(item.writeLink);
    if (itemOperations < 1 || itemOperations > maximumOperations) {
      throw new Error("Invalid auth-link write plan");
    }
    if (currentOperations + itemOperations > maximumOperations) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentOperations = 0;
    }
    currentChunk.push(item);
    currentOperations += itemOperations;
  });
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  return chunks;
}

async function commitAuthLinkWrites(firestore, root, items) {
  let appliedUserWrites = 0;
  let appliedLinkWrites = 0;
  for (const chunk of chunkAuthLinkWrites(items)) {
    const batch = firestore.batch();
    chunk.forEach((item) => {
      if (item.writeUser) {
        if (!item.sourceUpdateTime) {
          throw new Error("Missing source update time for guarded member write");
        }
        const userPayload = {
          ...(item.userPatch || {}),
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (item.writeAuthUid) {
          userPayload.authUid = item.authUid;
        }
        batch.update(
          firestore.collection(`${root}/users`).doc(item.memberId),
          userPayload,
          {lastUpdateTime: item.sourceUpdateTime},
        );
        appliedUserWrites += 1;
      }
      if (item.writeLink) {
        batch.create(
          firestore.collection(`${root}/authLinks`).doc(item.authUid),
          {
            memberId: item.memberId,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
        );
        appliedLinkWrites += 1;
      }
    });
    await batch.commit();
  }
  return {
    appliedMatches: items.filter((item) =>
      item.source !== "member-shape"
    ).length,
    appliedMemberShapeWrites: items.filter((item) =>
      item.writeUser && Object.keys(item.userPatch || {}).length > 0
    ).length,
    appliedUserWrites,
    appliedLinkWrites,
    appliedOperations: appliedUserWrites + appliedLinkWrites,
  };
}

function assertSafeAuthLinkApply(counts, environment) {
  const blockingCounters = [
    "invalidUid",
    "invalidAuthUid",
    "duplicateUid",
    "duplicateAuthUid",
    "duplicateFirestoreEmail",
    "duplicateAuthEmail",
    "conflictingFirestoreEmailFields",
    "invalidFirestoreEmail",
    "invalidRoleValues",
    "invalidActiveValues",
    "conflictingRoleRepresentations",
    "existingUidMissingAuthUser",
    "existingUidEmailMismatch",
    "existingUidUnverified",
    "existingUidDisabled",
    "conflicts",
  ];
  const unsafe = blockingCounters.filter((key) => counts[key] > 0);
  if (counts.activeAdminsAfter < 1) {
    unsafe.push("activeAdminsAfter");
  }
  if (counts.linkedActiveAdminsAfter < 1) {
    unsafe.push("linkedActiveAdminsAfter");
  }
  if (unsafe.length > 0) {
    throw new Error(
      `Unsafe ${environment} auth-link plan: ${unsafe.join(", ")}`,
    );
  }
}

async function runAuthLinkBackfill(options) {
  const app = initializeApp({projectId: options.projectId});
  try {
    const firestore = getFirestore(app);
    const authUsers = await listAllAuthUsers(getAuth(app));
    const summary = {};
    const environmentPlans = [];

    for (const environment of options.environments) {
      const dataset = options.dataset || "plus-collections";
      if (!new Set(["collections", "plus-collections"]).has(dataset)) {
        throw new Error("Unsupported auth-link dataset");
      }
      const root = `${environment}/${dataset}`;
      const [usersSnapshot, linksSnapshot] = await Promise.all([
        firestore.collection(`${root}/users`).get(),
        firestore.collection(`${root}/authLinks`).get(),
      ]);
      const users = usersSnapshot.docs.map((document) => ({
        ...document.data(),
        memberId: document.id,
        sourceUpdateTime: document.updateTime,
      }));
      const existingLinks = new Map(linksSnapshot.docs.map((document) => [
        document.id,
        typeof document.get("memberId") === "string" ?
          document.get("memberId") :
          null,
      ]));
      const plan = planAuthLinkBackfill(
        users,
        existingLinks,
        authUsers,
        {environment, dataset},
      );
      environmentPlans.push({environment, root, plan});
    }

    if (options.apply) {
      environmentPlans.forEach(({environment, plan}) =>
        assertSafeAuthLinkApply(plan.counts, environment)
      );
    }

    for (const {environment, root, plan} of environmentPlans) {
      const applied = options.apply ?
        await commitAuthLinkWrites(firestore, root, plan.writes) :
        {
          appliedMatches: 0,
          appliedMemberShapeWrites: 0,
          appliedUserWrites: 0,
          appliedLinkWrites: 0,
          appliedOperations: 0,
        };
      summary[environment] = {...plan.counts, ...applied};
    }
    return summary;
  } finally {
    await deleteApp(app);
  }
}

async function main() {
  const options = parseMigrationArgs(process.argv.slice(2));
  const summary = await runAuthLinkBackfill(options);
  console.log(JSON.stringify({apply: options.apply, summary}, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Migration failed");
    process.exitCode = 1;
  });
}

module.exports = {
  assertSafeAuthLinkApply,
  chunkAuthLinkWrites,
  commitAuthLinkWrites,
  listAllAuthUsers,
  parseMigrationArgs,
  planAuthLinkBackfill,
  runAuthLinkBackfill,
};
