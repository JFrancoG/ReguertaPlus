import {Firestore, Timestamp} from "@google-cloud/firestore";
import type {Messaging} from "firebase-admin/messaging";
import {
  createFirebaseShiftPlanningNotificationTransport,
} from "./shift-planning-firebase-notification-transport.js";
import {
  createFirestoreShiftPlanningNotificationDispatchRepository,
} from "./shift-planning-firestore-notification-dispatch-repository.js";
import {
  createFirestoreShiftPlanningNotificationReleaseRepository,
} from "./shift-planning-firestore-notification-release-repository.js";
import {
  createShiftPlanningNotificationDispatchExecutor,
} from "./shift-planning-notification-dispatch-executor.js";
import {
  createShiftPlanningNotificationReleaseDispatchExecutor,
} from "./shift-planning-notification-release-dispatch-executor.js";

type FirebaseShiftPlanningNotificationRuntimeDependencies = {
  firestore: Firestore;
  messaging: Pick<Messaging, "sendEachForMulticast">;
  clock?: () => Timestamp;
  nowMillis?: () => number;
  transportTimeoutMillis?: number;
};

/**
 * Composes the real Firestore repositories and modular Firebase Messaging
 * transport behind the local release-dispatch contract. Construction performs
 * no I/O; only an explicit executor call may reach Firestore or FCM.
 * @param {object} dependencies Firebase authorities and optional test clocks.
 * @return {object} Fully composed but not exported notification runtime.
 */
export const createFirebaseShiftPlanningNotificationRuntime = (
  dependencies: FirebaseShiftPlanningNotificationRuntimeDependencies,
) => {
  const releaseRepository =
    createFirestoreShiftPlanningNotificationReleaseRepository(
      dependencies.firestore,
      dependencies.clock,
    );
  const dispatchRepository =
    createFirestoreShiftPlanningNotificationDispatchRepository(
      dependencies.firestore,
      dependencies.clock,
    );
  const transport = createFirebaseShiftPlanningNotificationTransport(
    dependencies.messaging,
  );
  const dispatchExecutor = createShiftPlanningNotificationDispatchExecutor({
    repository: dispatchRepository,
    transport,
    nowMillis: dependencies.nowMillis,
    transportTimeoutMillis: dependencies.transportTimeoutMillis,
  });
  return createShiftPlanningNotificationReleaseDispatchExecutor({
    releaseRepository,
    dispatchExecutor,
  });
};
