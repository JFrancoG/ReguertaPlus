import {
  DocumentSnapshot,
  FieldPath,
  Firestore,
  QueryDocumentSnapshot,
  Timestamp,
} from "@google-cloud/firestore";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {
  SHIFT_PLANNING_MAX_DEVICES_PER_USER,
  ShiftPlanningMemberDeviceRevisionSource,
  deriveShiftPlanningMemberRevision,
} from "./shift-planning-member-revision.js";
import {
  ShiftPlanningNotificationReleaseArtifacts,
  createShiftPlanningNotificationReleaseArtifacts,
  parseShiftPlanningHeldNotificationIntent,
  sameShiftPlanningNotificationValue,
} from "./shift-planning-notification-release.js";
import {
  parseShiftPlanningPublicShiftDocument,
} from "./shift-planning-publication-contract.js";
import {
  ShiftPlanningCompletedSyncCommand,
  parseShiftPlanningPersistedSyncCommand,
} from "./shift-planning-sync-command.js";
import {
  ShiftPlanningEnvironment,
  parseShiftPlanningMaintenanceState,
} from "./shift-planning-wire.js";

export type ShiftPlanningNotificationReleaseResult = {
  kind: "committed" | "replayed";
  artifacts: ShiftPlanningNotificationReleaseArtifacts;
};

const failRelease = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_transaction", message);
};

const requireEnvironment = (value: unknown): ShiftPlanningEnvironment => {
  if (value !== "develop" && value !== "production") {
    return failRelease("Notification release environment is invalid.");
  }
  return value;
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failRelease(`${name} is not a valid identifier.`);
  }
  return value;
};

const requireSnapshot = (
  snapshot: DocumentSnapshot,
  name: string,
): QueryDocumentSnapshot => {
  if (!snapshot.exists) return failRelease(`${name} does not exist.`);
  return snapshot as QueryDocumentSnapshot;
};

const nullableString = (value: unknown, name: string): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    return failRelease(`${name} must be a string or null.`);
  }
  return value.trim() || null;
};

const nullableTimestamp = (value: unknown, name: string): Timestamp | null => {
  if (value === null || value === undefined) return null;
  if (!(value instanceof Timestamp)) {
    return failRelease(`${name} must be a Firestore Timestamp or null.`);
  }
  return value;
};

const deviceRevisionSource = (
  snapshot: QueryDocumentSnapshot,
): ShiftPlanningMemberDeviceRevisionSource => ({
  deviceId: snapshot.id,
  fcmToken: nullableString(
    snapshot.get("fcmToken"),
    `device ${snapshot.id}.fcmToken`,
  ),
  firebaseInstallationId: nullableString(
    snapshot.get("firebaseInstallationId"),
    `device ${snapshot.id}.firebaseInstallationId`,
  ),
  tokenUpdatedAt: nullableTimestamp(
    snapshot.get("tokenUpdatedAt"),
    `device ${snapshot.id}.tokenUpdatedAt`,
  ),
  registrationUpdatedAt: nullableTimestamp(
    snapshot.get("registrationUpdatedAt"),
    `device ${snapshot.id}.registrationUpdatedAt`,
  ),
});

const completedSyncCommand = (
  snapshot: DocumentSnapshot,
  type: "delivery" | "market",
): ShiftPlanningCompletedSyncCommand => {
  const command = parseShiftPlanningPersistedSyncCommand(
    requireSnapshot(snapshot, `${type} sync command`).data(),
  );
  if (command.state !== "completed") {
    return failRelease(`${type} sync command has no terminal read-back.`);
  }
  return command;
};

const requireCurrentReleaseSource = (input: {
  root: string;
  intent: ReturnType<typeof parseShiftPlanningHeldNotificationIntent>;
  maintenanceSnapshot: DocumentSnapshot;
  shiftSnapshot: DocumentSnapshot;
  memberSnapshot: DocumentSnapshot;
  devices: readonly QueryDocumentSnapshot[];
}): void => {
  const {intent} = input;
  const maintenance = parseShiftPlanningMaintenanceState(
    requireSnapshot(input.maintenanceSnapshot, "planning state").data(),
  );
  if (
    maintenance.activeRevision !== intent.bundleRevision ||
    maintenance.activeDigest !== intent.bundleDigest ||
    maintenance.writeEpoch !== intent.writeEpoch
  ) {
    return failRelease("Active planning state no longer owns the intent.");
  }
  const shiftPath = `${input.root}/shifts/${intent.shiftId}`;
  const shift = parseShiftPlanningPublicShiftDocument({
    targetPath: shiftPath,
    value: requireSnapshot(input.shiftSnapshot, "planned shift").data(),
  });
  parseShiftPlanningPublicShiftDocument({
    targetPath: shiftPath,
    value: input.shiftSnapshot.data(),
    expectedOperationIntentDigest:
      shift.lastBackendMutation.operationIntentDigest,
  });
  if (
    shift.type !== intent.shiftType ||
    shift.bundleRevision !== intent.bundleRevision ||
    shift.bundleDigest !== intent.bundleDigest ||
    shift.writeEpoch !== intent.writeEpoch ||
    shift.assignmentRevision !== intent.expectedAssignmentRevision ||
    !shift.assignedUserIds.includes(intent.recipientUserId)
  ) {
    return failRelease("Current shift assignment no longer owns the intent.");
  }
  const memberSnapshot = requireSnapshot(
    input.memberSnapshot,
    "release member",
  );
  const member = deriveShiftPlanningMemberRevision({
    userId: memberSnapshot.id,
    roles: memberSnapshot.get("roles"),
    isActive: memberSnapshot.get("isActive"),
    isCommonPurchaseManager: memberSnapshot.get("isCommonPurchaseManager"),
    devices: input.devices.map(deviceRevisionSource),
  });
  if (
    member.userId !== intent.recipientUserId ||
    !member.isEligible ||
    member.membershipRevision !== intent.expectedMembershipRevision ||
    member.eligibilityRevision !== intent.expectedEligibilityRevision ||
    member.destinationRevision !== intent.expectedDestinationRevision
  ) {
    return failRelease("Current member revisions no longer own the intent.");
  }
};

const requireExactReplay = (
  snapshot: DocumentSnapshot,
  expected: unknown,
  name: string,
): void => {
  if (
    !snapshot.exists ||
    !sameShiftPlanningNotificationValue(snapshot.data(), expected)
  ) {
    failRelease(`${name} does not match its canonical release.`);
  }
};

/**
 * Creates a local Firestore repository for one explicit held-intent release.
 * It is intentionally not wired to a trigger: FCM dispatch first needs the
 * separate lease and append-only attempt lifecycle defined by HU-082.
 * @param {Firestore} firestore Pinned Firestore authority or emulator.
 * @param {Function} clock Trusted callback clock.
 * @return {object} Explicit held-intent release repository.
 */
export const createFirestoreShiftPlanningNotificationReleaseRepository = (
  firestore: Firestore,
  clock: () => Timestamp = () => Timestamp.now(),
) => ({
  async release(input: {
    environment: ShiftPlanningEnvironment;
    intentId: string;
  }): Promise<ShiftPlanningNotificationReleaseResult> {
    const environment = requireEnvironment(input.environment);
    const intentId = requireIdentifier(
      input.intentId,
      "notification intentId",
    );
    const root = `${environment}/plus-collections`;
    const intentReference = firestore.doc(
      `${root}/shiftPlanningNotificationIntents/${intentId}`,
    );
    const receiptReference = intentReference
      .collection("releases")
      .doc("canonical");
    const eventReference = firestore.doc(
      `${root}/notificationEvents/${intentId}`,
    );
    return firestore.runTransaction(async (transaction) => {
      const [
        intentSnapshot,
        receiptSnapshot,
        eventSnapshot,
      ] = await transaction.getAll(
        intentReference,
        receiptReference,
        eventReference,
      );
      const intent = parseShiftPlanningHeldNotificationIntent(
        requireSnapshot(intentSnapshot, "held notification intent").data(),
      );
      if (intent.intentId !== intentId) {
        return failRelease("Notification intent path and payload differ.");
      }
      const inboxReference = firestore.doc(
        `${root}/users/${intent.recipientUserId}/notificationInbox/${intentId}`,
      );
      const [
        inboxSnapshot,
        maintenanceSnapshot,
        shiftSnapshot,
        memberSnapshot,
        deliverySyncSnapshot,
        marketSyncSnapshot,
      ] = await transaction.getAll(
        inboxReference,
        firestore.doc(`${root}/shiftPlanningState/current`),
        firestore.doc(`${root}/shifts/${intent.shiftId}`),
        firestore.doc(`${root}/users/${intent.recipientUserId}`),
        firestore.doc(
          `${root}/shiftPlanningSyncCommands/${intent.bundleRevision}-delivery`,
        ),
        firestore.doc(
          `${root}/shiftPlanningSyncCommands/${intent.bundleRevision}-market`,
        ),
      );
      const deliverySync = completedSyncCommand(
        deliverySyncSnapshot,
        "delivery",
      );
      const marketSync = completedSyncCommand(marketSyncSnapshot, "market");
      if (receiptSnapshot.exists) {
        const releasedAt = receiptSnapshot.get("releasedAt");
        if (!(releasedAt instanceof Timestamp)) {
          return failRelease("Notification release timestamp is invalid.");
        }
        const artifacts = createShiftPlanningNotificationReleaseArtifacts({
          intent,
          deliverySync,
          marketSync,
          releasedAt,
        });
        requireExactReplay(
          receiptSnapshot,
          artifacts.receipt,
          "Release receipt",
        );
        requireExactReplay(eventSnapshot, artifacts.event, "Canonical event");
        requireExactReplay(inboxSnapshot, artifacts.inbox, "Canonical inbox");
        return {kind: "replayed", artifacts};
      }
      if (eventSnapshot.exists || inboxSnapshot.exists) {
        return failRelease(
          "Notification release has a partial canonical effect.",
        );
      }
      const devicesSnapshot = await transaction.get(
        firestore.collection(
          `${root}/users/${intent.recipientUserId}/devices`,
        ).orderBy(FieldPath.documentId()).limit(
          SHIFT_PLANNING_MAX_DEVICES_PER_USER + 1,
        ),
      );
      if (devicesSnapshot.size > SHIFT_PLANNING_MAX_DEVICES_PER_USER) {
        return failRelease(
          "Notification destinations exceed their read limit.",
        );
      }
      requireCurrentReleaseSource({
        root,
        intent,
        maintenanceSnapshot,
        shiftSnapshot,
        memberSnapshot,
        devices: devicesSnapshot.docs,
      });
      const artifacts = createShiftPlanningNotificationReleaseArtifacts({
        intent,
        deliverySync,
        marketSync,
        releasedAt: clock(),
      });
      transaction.create(receiptReference, artifacts.receipt);
      transaction.create(eventReference, artifacts.event);
      transaction.create(inboxReference, artifacts.inbox);
      return {kind: "committed", artifacts};
    });
  },
});
