#!/usr/bin/env node

const admin = require("firebase-admin");
const {
  buildMemberDirectoryDocument,
} = require("../lib/member-directory.js");
const {
  parseMigrationArgs,
} = require("./backfill-auth-links.cjs");

function planMemberDirectoryBackfill(users, existingDirectoryIds) {
  const desired = new Map();
  let malformedUsers = 0;
  users.forEach((user) => {
    const projection = buildMemberDirectoryDocument(user.memberId, user.data);
    if (projection) {
      desired.set(user.memberId, projection);
    } else if (user.data?.isActive === true) {
      malformedUsers += 1;
    }
  });
  const existingIds = new Set(existingDirectoryIds);
  const desiredIds = new Set(desired.keys());
  const allIds = Array.from(new Set([
    ...desiredIds,
    ...existingIds,
  ])).sort();
  return {
    allIds,
    desired,
    counts: {
      usersScanned: users.length,
      activeMembersProjected: desired.size,
      malformedUsers,
      existingDirectoryDocuments: existingIds.size,
      plannedSets: desired.size,
      plannedDeletes: Array.from(existingIds)
        .filter((id) => !desiredIds.has(id)).length,
    },
  };
}

function assertSafeMemberDirectoryApply(plans) {
  const unsafeEnvironments = plans
    .filter(({plan}) => plan.counts.malformedUsers > 0)
    .map(({environment}) => environment);
  if (unsafeEnvironments.length > 0) {
    throw new Error(
      "Unsafe member-directory plan contains malformed users in: " +
      unsafeEnvironments.join(", "),
    );
  }
}

async function applyMemberDirectoryPlan(firestore, root, plan) {
  let appliedSets = 0;
  let appliedDeletes = 0;
  for (const memberId of plan.allIds) {
    const action = await firestore.runTransaction(async (transaction) => {
      const memberRef = firestore.collection(`${root}/users`).doc(memberId);
      const directoryRef = firestore
        .collection(`${root}/memberDirectory`)
        .doc(memberId);
      const member = await transaction.get(memberRef);
      const projection = member.exists ?
        buildMemberDirectoryDocument(memberId, member.data()) :
        null;
      if (projection) {
        transaction.set(directoryRef, projection, {merge: false});
        return "set";
      }
      transaction.delete(directoryRef);
      return "delete";
    });
    if (action === "set") appliedSets += 1;
    else appliedDeletes += 1;
  }
  return {appliedSets, appliedDeletes};
}

async function runMemberDirectoryBackfill(options) {
  const app = admin.initializeApp({projectId: options.projectId});
  try {
    const firestore = app.firestore();
    const plans = [];
    for (const environment of options.environments) {
      const root = `${environment}/plus-collections`;
      const [usersSnapshot, directorySnapshot] = await Promise.all([
        firestore.collection(`${root}/users`).get(),
        firestore.collection(`${root}/memberDirectory`).get(),
      ]);
      const users = usersSnapshot.docs.map((document) => ({
        memberId: document.id,
        data: document.data(),
      }));
      const plan = planMemberDirectoryBackfill(
        users,
        directorySnapshot.docs.map((document) => document.id),
      );
      plans.push({environment, root, plan});
    }
    if (options.apply) {
      assertSafeMemberDirectoryApply(plans);
    }
    const summary = {};
    for (const {environment, root, plan} of plans) {
      const applied = options.apply ?
        await applyMemberDirectoryPlan(firestore, root, plan) :
        {appliedSets: 0, appliedDeletes: 0};
      summary[environment] = {...plan.counts, ...applied};
    }
    return summary;
  } finally {
    await app.delete();
  }
}

async function main() {
  const options = parseMigrationArgs(process.argv.slice(2));
  const summary = await runMemberDirectoryBackfill(options);
  console.log(JSON.stringify({apply: options.apply, summary}, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Migration failed");
    process.exitCode = 1;
  });
}

module.exports = {
  applyMemberDirectoryPlan,
  assertSafeMemberDirectoryApply,
  planMemberDirectoryBackfill,
  runMemberDirectoryBackfill,
};
