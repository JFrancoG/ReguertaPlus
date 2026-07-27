#!/usr/bin/env node

const admin = require("firebase-admin");
const {
  parseMigrationArgs,
} = require("./backfill-auth-links.cjs");

function uniqueStrings(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean))];
}

function resolveEventAudience(event, activeMembers) {
  const payload = event && typeof event.targetPayload === "object" ?
    event.targetPayload :
    {};
  if (event.target === "all") {
    return activeMembers.map((member) => member.memberId);
  }
  if (event.target === "users") {
    const activeIds = new Set(activeMembers.map((member) => member.memberId));
    return uniqueStrings(payload.userIds).filter((id) => activeIds.has(id));
  }
  if (
    event.target === "segment" &&
    payload.segmentType === "role" &&
    typeof payload.role === "string"
  ) {
    const role = payload.role.trim().toLowerCase();
    return activeMembers
      .filter((member) => member.roles.includes(role))
      .map((member) => member.memberId);
  }
  return [];
}

function buildInboxDocument(eventId, event, recipientMemberId) {
  const requiredStrings = [
    eventId,
    event.title,
    event.body,
    event.type,
    event.createdBy,
  ];
  const target = typeof event.target === "string" ?
    event.target.trim().toLowerCase() : "";
  if (
    requiredStrings.some((value) =>
      typeof value !== "string" || value.trim().length === 0
    ) ||
    event.sentAt === null ||
    event.sentAt === undefined ||
    !["all", "users", "segment"].includes(target)
  ) {
    return null;
  }
  const sourceTargetPayload = event.targetPayload !== null &&
    typeof event.targetPayload === "object" &&
    !Array.isArray(event.targetPayload) ? event.targetPayload : {};
  let targetPayload = {};
  if (target === "users") {
    if (
      typeof recipientMemberId !== "string" ||
      recipientMemberId.trim().length === 0
    ) {
      return null;
    }
    targetPayload = {userIds: [recipientMemberId.trim()]};
  } else if (target === "segment") {
    const segmentType = typeof sourceTargetPayload.segmentType === "string" ?
      sourceTargetPayload.segmentType.trim() : "";
    const role = typeof sourceTargetPayload.role === "string" ?
      sourceTargetPayload.role.trim() : "";
    if (segmentType) {
      targetPayload.segmentType = segmentType;
    }
    if (role) {
      targetPayload.role = role;
    }
  }
  const document = {
    notificationEventId: eventId,
    title: event.title.trim(),
    body: event.body.trim(),
    type: event.type.trim(),
    target,
    targetPayload,
    createdBy: event.createdBy.trim(),
    sentAt: event.sentAt,
  };
  if (typeof event.weekKey === "string" && event.weekKey.trim()) {
    document.weekKey = event.weekKey.trim();
  }
  return document;
}

async function runNotificationInboxBackfill(options) {
  const app = admin.initializeApp({projectId: options.projectId});
  const firestore = app.firestore();
  const summary = {};
  for (const environment of options.environments) {
    const root = `${environment}/plus-collections`;
    const [eventsSnapshot, usersSnapshot] = await Promise.all([
      firestore.collection(`${root}/notificationEvents`).get(),
      firestore.collection(`${root}/users`).where("isActive", "==", true).get(),
    ]);
    const activeMembers = usersSnapshot.docs.map((document) => ({
      memberId: document.id,
      roles: uniqueStrings(document.get("roles"))
        .map((role) => role.toLowerCase()),
    }));
    let malformedEvents = 0;
    let resolvedDeliveries = 0;
    const candidates = [];
    eventsSnapshot.docs.forEach((eventDocument) => {
      const event = eventDocument.data();
      if (!buildInboxDocument(eventDocument.id, event, "validation-member")) {
        malformedEvents += 1;
        return;
      }
      const memberIds = resolveEventAudience(event, activeMembers);
      resolvedDeliveries += memberIds.length;
      memberIds.forEach((memberId) => {
        const inboxDocument = buildInboxDocument(
          eventDocument.id,
          event,
          memberId,
        );
        if (!inboxDocument) {
          return;
        }
        candidates.push({
          ref: firestore.collection(`${root}/users`)
            .doc(memberId)
            .collection("notificationInbox")
            .doc(eventDocument.id),
          inboxDocument,
        });
      });
    });

    const writes = candidates;
    let existingInbox = 0;
    for (let index = 0; index < candidates.length; index += 400) {
      const chunk = candidates.slice(index, index + 400);
      const snapshots = await firestore.getAll(...chunk.map((item) => item.ref));
      snapshots.forEach((snapshot) => {
        if (snapshot.exists) {
          existingInbox += 1;
        }
      });
    }

    let appliedWrites = 0;
    if (options.apply) {
      for (let index = 0; index < writes.length; index += 400) {
        const batch = firestore.batch();
        writes.slice(index, index + 400).forEach((item) => {
          batch.set(item.ref, item.inboxDocument, {merge: false});
        });
        await batch.commit();
        appliedWrites += Math.min(400, writes.length - index);
      }
    }
    summary[environment] = {
      eventsScanned: eventsSnapshot.size,
      activeMembersScanned: activeMembers.length,
      malformedEvents,
      resolvedDeliveries,
      existingInbox,
      plannedWrites: writes.length,
      appliedWrites,
    };
  }
  await app.delete();
  return summary;
}

async function main() {
  const options = parseMigrationArgs(process.argv.slice(2));
  const summary = await runNotificationInboxBackfill(options);
  console.log(JSON.stringify({apply: options.apply, summary}, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Migration failed");
    process.exitCode = 1;
  });
}

module.exports = {
  buildInboxDocument,
  resolveEventAudience,
  runNotificationInboxBackfill,
};
