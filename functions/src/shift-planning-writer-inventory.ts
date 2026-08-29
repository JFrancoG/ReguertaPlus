import {
  createShiftPlanningDigest,
  ShiftPlanningDigest,
} from "./shift-planning-digest.js";

export const SHIFT_PLANNING_WRITER_INVENTORY_SCHEMA_VERSION = 1 as const;
export const SHIFT_PLANNING_WRITER_INVENTORY_REVISION =
  "hu082-affected-writers-v1" as const;

export type ShiftPlanningWriterControl =
  | "rules-deny"
  | "disable-ingress"
  | "disable-delivery-after-drain"
  | "isolate-causal-delivery"
  | "fence-external-authority"
  | "activation-version-check";

export type ShiftPlanningWriterControlState =
  | "denied"
  | "disabled"
  | "fenced"
  | "isolated"
  | "version-bound";

export type ShiftPlanningWriterShutdownOrder =
  | "before-causal-capture"
  | "after-causal-drain"
  | "activation-recheck";

export type ShiftPlanningWriterTarget =
  | "firestore.database-wide"
  | "firestore.deliveryCalendar"
  | "firestore.config"
  | "firestore.shiftPlanningRequests"
  | "firestore.shiftSwapRequests"
  | "firestore.shifts"
  | "firestore.users"
  | "notification.delivery"
  | "workbook.shifts";

export type ShiftPlanningAffectedWriter = {
  readonly writerId: string;
  readonly control: ShiftPlanningWriterControl;
  readonly requiredState: ShiftPlanningWriterControlState;
  readonly shutdownOrder: ShiftPlanningWriterShutdownOrder;
  readonly targets: readonly ShiftPlanningWriterTarget[];
  readonly sourceReferences: readonly string[];
};

/**
 * Complete repository and authority inventory that must be closed before a
 * maintenance epoch starts. Internal helpers belong to their exported ingress
 * or delivery and therefore are deliberately not represented as extra fences.
 */
const affectedWriters = [
  {
    writerId: "firestore-client-shifts",
    control: "rules-deny",
    requiredState: "denied",
    shutdownOrder: "before-causal-capture",
    targets: ["firestore.shifts"],
    sourceReferences: [
      "firestore.phase1.rules#shifts-server-only-write",
      "firestore.strict.rules#shifts-server-only-write",
    ],
  },
  {
    writerId: "firestore-client-delivery-calendar",
    control: "rules-deny",
    requiredState: "denied",
    shutdownOrder: "before-causal-capture",
    targets: ["firestore.deliveryCalendar"],
    sourceReferences: [
      "firestore.phase1.rules#deliveryCalendar-server-only-write",
      "firestore.strict.rules#deliveryCalendar-server-only-write",
    ],
  },
  {
    writerId: "firestore-client-shift-planning-requests",
    control: "rules-deny",
    requiredState: "denied",
    shutdownOrder: "before-causal-capture",
    targets: ["firestore.shiftPlanningRequests"],
    sourceReferences: [
      "android/Reguerta/app/src/main/java/com/reguerta/user/data/" +
        "shiftplanning/FirestoreShiftPlanningRequestRepository.kt" +
        "#submitShiftPlanningRequest",
      "ios/Reguerta/Reguerta/Data/ShiftPlanningRequests/" +
        "FirestoreShiftPlanningRequestRepository.swift#submit",
      "firestore.phase1.rules#authenticated-catch-all",
      "firestore.strict.rules#shiftPlanningRequests-admin-create",
    ],
  },
  {
    writerId: "firestore-client-shift-swap-requests",
    control: "rules-deny",
    requiredState: "denied",
    shutdownOrder: "before-causal-capture",
    targets: ["firestore.shiftSwapRequests"],
    sourceReferences: [
      "firestore.phase1.rules#authenticated-catch-all",
      "firestore.strict.rules#shiftSwapRequests-server-only-write",
    ],
  },
  {
    writerId: "https-sync-shifts-from-google-sheets",
    control: "disable-ingress",
    requiredState: "disabled",
    shutdownOrder: "before-causal-capture",
    targets: ["firestore.shifts"],
    sourceReferences: [
      "functions/src/index.ts#syncShiftsFromGoogleSheets",
      "functions/src/index.ts#syncShiftRowsIntoFirestore",
    ],
  },
  {
    writerId: "https-export-shifts-to-google-sheets",
    control: "disable-ingress",
    requiredState: "disabled",
    shutdownOrder: "before-causal-capture",
    targets: ["workbook.shifts"],
    sourceReferences: [
      "functions/src/index.ts#exportShiftsToGoogleSheets",
      "functions/src/index.ts#exportAllShiftsToGoogleSheets",
      "functions/src/shift-planning-external-writer-fence.ts",
    ],
  },
  {
    writerId: "https-transition-shift-swap",
    control: "disable-ingress",
    requiredState: "disabled",
    shutdownOrder: "before-causal-capture",
    targets: ["firestore.shiftSwapRequests", "firestore.shifts"],
    sourceReferences: [
      "android/Reguerta/app/src/main/java/com/reguerta/user/data/shiftswap/" +
        "FirebaseShiftSwapTransitionClient.kt",
      "ios/Reguerta/Reguerta/Data/ShiftSwapRequests/" +
        "FirestoreShiftSwapRequestRepository.swift#transition",
      "functions/src/index.ts#transitionShiftSwap",
    ],
  },
  {
    writerId: "trigger-on-shift-planning-request-created",
    control: "disable-delivery-after-drain",
    requiredState: "disabled",
    shutdownOrder: "after-causal-drain",
    targets: [
      "firestore.shiftPlanningRequests",
      "firestore.shifts",
      "workbook.shifts",
    ],
    sourceReferences: [
      "functions/src/index.ts#onShiftPlanningRequestCreated",
      "functions/src/index.ts#persistPlannedShifts",
    ],
  },
  {
    writerId: "trigger-on-shift-written",
    control: "disable-delivery-after-drain",
    requiredState: "disabled",
    shutdownOrder: "after-causal-drain",
    targets: [
      "firestore.shifts",
      "workbook.shifts",
      "notification.delivery",
    ],
    sourceReferences: [
      "functions/src/index.ts#onShiftWritten",
      "functions/src/index.ts#persistShiftExportEffects",
      "functions/src/shift-planning-external-writer-fence.ts",
    ],
  },
  {
    writerId: "trigger-on-delivery-calendar-override-written",
    control: "disable-delivery-after-drain",
    requiredState: "disabled",
    shutdownOrder: "after-causal-drain",
    targets: ["firestore.deliveryCalendar", "workbook.shifts"],
    sourceReferences: [
      "functions/src/index.ts#onDeliveryCalendarOverrideWritten",
    ],
  },
  {
    writerId: "trigger-on-notification-event-created",
    control: "isolate-causal-delivery",
    requiredState: "isolated",
    shutdownOrder: "before-causal-capture",
    targets: ["notification.delivery"],
    sourceReferences: [
      "functions/src/index.ts#onNotificationEventCreated",
      "functions/src/index.ts#dispatchNotificationEventGeneric",
      "functions/src/index.ts#fanOutNotificationInbox",
    ],
  },
  {
    writerId: "firestore-client-membership-fairness",
    control: "activation-version-check",
    requiredState: "version-bound",
    shutdownOrder: "activation-recheck",
    targets: ["firestore.users"],
    sourceReferences: [
      "firestore.phase1.rules#authenticated-catch-all",
      "firestore.strict.rules#users-self-update",
    ],
  },
  {
    writerId: "firestore-client-planning-config",
    control: "activation-version-check",
    requiredState: "version-bound",
    shutdownOrder: "activation-recheck",
    targets: ["firestore.config"],
    sourceReferences: [
      "firestore.phase1.rules#authenticated-catch-all",
      "firestore.strict.rules#config-server-only-write",
    ],
  },
  {
    writerId: "https-resolve-authorized-member",
    control: "activation-version-check",
    requiredState: "version-bound",
    shutdownOrder: "activation-recheck",
    targets: ["firestore.users"],
    sourceReferences: ["functions/src/index.ts#resolveAuthorizedMember"],
  },
  {
    writerId: "https-upsert-member-by-admin",
    control: "activation-version-check",
    requiredState: "version-bound",
    shutdownOrder: "activation-recheck",
    targets: ["firestore.users"],
    sourceReferences: ["functions/src/index.ts#upsertMemberByAdmin"],
  },
  {
    writerId: "https-clone-global-config",
    control: "activation-version-check",
    requiredState: "version-bound",
    shutdownOrder: "activation-recheck",
    targets: ["firestore.config"],
    sourceReferences: ["functions/src/index.ts#cloneGlobalConfig"],
  },
  {
    writerId: "https-config-maintenance-writers",
    control: "activation-version-check",
    requiredState: "version-bound",
    shutdownOrder: "activation-recheck",
    targets: ["firestore.config"],
    sourceReferences: [
      "functions/src/index.ts#validateGlobalVersionPolicy",
      "functions/src/index.ts#validateGlobalFreshnessConfig",
      "functions/src/index.ts#onProductWrite/onContainerWrite/onMeasureWrite",
      "functions/src/index.ts#onUserWrite/onOrderWrite/updateTimestamp",
    ],
  },
  {
    writerId: "iam-firestore-admin-and-server-writers",
    control: "fence-external-authority",
    requiredState: "fenced",
    shutdownOrder: "before-causal-capture",
    targets: ["firestore.database-wide"],
    sourceReferences: [
      "effective IAM ancestry/conditions/deny policies",
      "unmanifested Admin SDK use, console, CI, scripts, jobs, keys and " +
        "workloads outside separately controlled runtime writers",
    ],
  },
  {
    writerId: "workbook-human-and-offline-editors",
    control: "fence-external-authority",
    requiredState: "fenced",
    shutdownOrder: "before-causal-capture",
    targets: ["workbook.shifts"],
    sourceReferences: [
      "Drive editors, owners and pending offline edits",
    ],
  },
  {
    writerId: "workbook-apps-script-and-addons",
    control: "fence-external-authority",
    requiredState: "fenced",
    shutdownOrder: "before-causal-capture",
    targets: ["workbook.shifts"],
    sourceReferences: [
      "Apps Script triggers/deployments and Workspace add-ons",
    ],
  },
  {
    writerId: "workbook-api-oauth-and-service-accounts",
    control: "fence-external-authority",
    requiredState: "fenced",
    shutdownOrder: "before-causal-capture",
    targets: ["workbook.shifts"],
    sourceReferences: [
      "Drive/Sheets API OAuth clients and service accounts",
    ],
  },
  {
    writerId: "workbook-shared-drive-and-admin-authority",
    control: "fence-external-authority",
    requiredState: "fenced",
    shutdownOrder: "before-causal-capture",
    targets: ["workbook.shifts"],
    sourceReferences: [
      "Shared Drive automations, groups/domain grants, DWD and Workspace " +
        "admin paths",
    ],
  },
] as const satisfies readonly ShiftPlanningAffectedWriter[];

export const SHIFT_PLANNING_AFFECTED_WRITERS:
  readonly ShiftPlanningAffectedWriter[] = Object.freeze(
    affectedWriters.map((writer) => Object.freeze({
      ...writer,
      targets: Object.freeze([...writer.targets]),
      sourceReferences: Object.freeze([...writer.sourceReferences]),
    })),
  );

export const SHIFT_PLANNING_RULES_DENIED_WRITER_IDS:
  readonly string[] = Object.freeze(
    SHIFT_PLANNING_AFFECTED_WRITERS
      .filter((writer) => writer.control === "rules-deny")
      .map((writer) => writer.writerId)
      .sort(),
  );

export const SHIFT_PLANNING_INTAKE_BARRIER_WRITERS:
  readonly ShiftPlanningAffectedWriter[] = Object.freeze(
    SHIFT_PLANNING_AFFECTED_WRITERS.filter(
      (writer) => writer.shutdownOrder !== "activation-recheck",
    ),
  );

export const SHIFT_PLANNING_WRITER_INVENTORY = Object.freeze({
  schemaVersion: SHIFT_PLANNING_WRITER_INVENTORY_SCHEMA_VERSION,
  revision: SHIFT_PLANNING_WRITER_INVENTORY_REVISION,
  writers: SHIFT_PLANNING_AFFECTED_WRITERS,
} as const);

export const SHIFT_PLANNING_WRITER_INVENTORY_DIGEST: ShiftPlanningDigest =
  createShiftPlanningDigest(SHIFT_PLANNING_WRITER_INVENTORY);
