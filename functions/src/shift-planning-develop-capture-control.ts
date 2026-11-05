import {ShiftPlanningError} from "./shift-planning-contract.js";
import {
  canonicalShiftPlanningJson,
  createShiftPlanningDigest,
  ShiftPlanningDigest,
} from "./shift-planning-digest.js";

export const DEVELOP_CAPTURE_CONTROL_REVISION =
  "hu084-develop-source-capture-v1";

export const DEVELOP_CAPTURE_ROUTES = Object.freeze([
  ["trigger-on-shift-planning-request-created",
    "onShiftPlanningRequestCreated", "captureDevelopShiftPlanningRequest",
    "shiftPlanningRequests/{requestId}"],
  ["trigger-on-shift-written", "onShiftWritten",
    "captureDevelopShiftWritten", "shifts/{shiftId}"],
  ["trigger-on-delivery-calendar-override-written",
    "onDeliveryCalendarOverrideWritten",
    "captureDevelopDeliveryCalendarWritten",
    "deliveryCalendar/{weekKey}"],
  ["trigger-on-notification-event-created", "onNotificationEventCreated",
    "captureDevelopNotificationCreated", "notificationEvents/{eventId}"],
].map((route) => Object.freeze(route)));

type SourceBinding = {
  functionName: string;
  runtimeRevision: string;
  sourceGeneration: string;
  sourceDigest: ShiftPlanningDigest;
  reviewedSourceDigest: ShiftPlanningDigest;
  configurationDigest: ShiftPlanningDigest;
  reviewedConfigurationDigest: ShiftPlanningDigest;
  documentPattern: string;
  retryPolicy: "RETRY_POLICY_RETRY" | "RETRY_POLICY_DO_NOT_RETRY";
  transportState: "ACTIVE";
};

export type ShiftPlanningDevelopCaptureControl = {
  schemaVersion: 1;
  kind: "develop-source-capture";
  projectId: string;
  databaseId: "(default)";
  environment: "develop";
  writerId: string;
  shared: SourceBinding;
  collector: SourceBinding;
};

const reject = (): never => {
  throw new ShiftPlanningError("maintenance_state_conflict",
    "Develop source capture control is not bound to reviewed deployment.");
};
const record = (value: unknown, keys: readonly string[]) => {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype) return reject();
  const result = value as Record<string, unknown>;
  if (Object.keys(result).length !== keys.length ||
      Object.keys(result).sort().join() !== [...keys].sort().join()) {
    return reject();
  }
  return result;
};
const isDigest = (value: unknown): value is ShiftPlanningDigest =>
  typeof value === "string" && /^shift-planning:v1:sha256:[a-f0-9]{64}$/
    .test(value);

/**
 * Checks the four reviewed develop routes without relabelling shared transport
 * as disabled. Only a trusted control-plane read may supply these bindings;
 * hashes cannot replace live observations or independent causal drain.
 * @param {unknown} value Source-scoped deployment binding.
 * @param {string} writerId Exact inventory writer.
 * @return {ShiftPlanningDevelopCaptureControl} Detached validated binding.
 */
export const parseShiftPlanningDevelopCaptureControl = (
  value: unknown,
  writerId: string,
): ShiftPlanningDevelopCaptureControl => {
  const control = record(value, ["schemaVersion", "kind", "projectId",
    "databaseId", "environment", "writerId", "shared", "collector"]);
  const route = DEVELOP_CAPTURE_ROUTES.find((item) => item[0] === writerId);
  if (!route || control.writerId !== writerId || control.schemaVersion !== 1 ||
      control.kind !== "develop-source-capture" ||
      control.environment !== "develop" || control.databaseId !== "(default)" ||
      (control.projectId !== "reguerta-9f27f" &&
        control.projectId !== "demo-reguerta-hu084-migration")) return reject();
  for (const [index, key] of ["shared", "collector"].entries()) {
    const binding = record(control[key], ["functionName", "runtimeRevision",
      "sourceGeneration", "sourceDigest", "reviewedSourceDigest",
      "configurationDigest", "reviewedConfigurationDigest",
      "documentPattern",
      "retryPolicy", "transportState"]);
    if (binding.functionName !== `projects/${control.projectId}/locations/` +
        `europe-west1/functions/${route[index + 1]}` ||
        binding.documentPattern !== `${index ? "develop" : "{env}"}/` +
          `plus-collections/${route[3]}` ||
        binding.transportState !== "ACTIVE" ||
        binding.retryPolicy !== (index ? "RETRY_POLICY_RETRY" :
          "RETRY_POLICY_DO_NOT_RETRY") ||
        typeof binding.runtimeRevision !== "string" ||
        !/^[A-Za-z0-9._-]{1,128}$/.test(binding.runtimeRevision) ||
        typeof binding.sourceGeneration !== "string" ||
        !/^[1-9][0-9]*$/.test(binding.sourceGeneration) ||
        !isDigest(binding.sourceDigest) ||
        binding.sourceDigest !== binding.reviewedSourceDigest ||
        !isDigest(binding.configurationDigest) ||
        binding.configurationDigest !== binding.reviewedConfigurationDigest) {
      return reject();
    }
  }
  return JSON.parse(canonicalShiftPlanningJson(control)) as
    ShiftPlanningDevelopCaptureControl;
};

export const developCaptureControlDigest = (
  control: ShiftPlanningDevelopCaptureControl,
): ShiftPlanningDigest => createShiftPlanningDigest(
  parseShiftPlanningDevelopCaptureControl(control, control.writerId),
);
