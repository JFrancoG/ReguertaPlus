/**
 * Bridge over audited legacy callbacks, not the current application index.
 * Production invokes its original callback without loading a journal.
 */
export type DevelopShiftBridgeEventEntry =
  | "onShiftPlanningRequestCreated"
  | "onShiftWritten"
  | "onDeliveryCalendarOverrideWritten"
  | "onNotificationEventCreated";
export type DevelopShiftBridgeCapture = (
  entryPoint: DevelopShiftBridgeEventEntry, event: unknown,
) => Promise<{eventKey: string; coreDigest: string; duplicate: boolean}>;
type EventValue = {params?: Record<string, unknown>};
type HttpRequest = {query?: Record<string, unknown>};
type HttpResponse = {
  status(code: number): {json(value: unknown): unknown};
};
const eventEntries: readonly DevelopShiftBridgeEventEntry[] = [
  "onShiftPlanningRequestCreated", "onShiftWritten",
  "onDeliveryCalendarOverrideWritten", "onNotificationEventCreated",
];
const httpEntries = [
  "syncShiftsFromGoogleSheets", "exportShiftsToGoogleSheets",
];
let captureReady: Promise<DevelopShiftBridgeCapture> | undefined;
const capture: DevelopShiftBridgeCapture = async (entryPoint, event) => {
  captureReady ??= (async () => {
    const {createDevelopShiftIntakeDatabase, captureDevelopShiftEvent} =
      await import("./develop-shift-intake.js");
    const database = createDevelopShiftIntakeDatabase(
      process.env.GCLOUD_PROJECT ?? "",
    );
    return (name, value) => captureDevelopShiftEvent(database, name, value);
  })();
  return (await captureReady)(entryPoint, event);
};
const rejectEnvironment = (): never => {
  throw new Error("develop_bridge_environment_invalid");
};

/**
 * Keeps the original SDK constructor/options and only wraps its callback.
 * The resolver is the audited module's own lexical HTTP environment resolver.
 * @param {string} entryPoint Exact legacy HTTP name.
 * @param {Function} original Original callback body.
 * @param {Function} resolveEnvironment Original lexical environment resolver.
 * @return {Function} Production bypass or explicit develop rejection.
 */
export const wrapDevelopLegacyHttp = <Request extends HttpRequest, Result>(
  entryPoint: string,
  original: (request: Request, response: HttpResponse) => Result,
  resolveEnvironment: (request: Request) => unknown,
) => {
  if (!httpEntries.includes(entryPoint)) {
    throw new Error("develop_bridge_entry_invalid");
  }
  return (request: Request, response: HttpResponse): Result | unknown => {
    const environment = resolveEnvironment(request);
    if (environment === "production") return original(request, response);
    if (environment !== "develop") return rejectEnvironment();
    return response.status(503).json({
      ok: false, error: "develop_legacy_intake_closed",
    });
  };
};

/**
 * Retains develop delivery before ACK without running legacy side effects.
 * An old retry-disabled destination can still lose delivery on storage failure;
 * It does not certify historical delivery or earlier effects drained.
 * @param {string} entryPoint Exact legacy trigger name.
 * @param {Function} original Callback from the original SDK constructor.
 * @param {Function} retain Lazy durable capture port.
 * @return {Function} Original production result or durable develop capture.
 */
export const wrapDevelopLegacyEvent = <Event extends EventValue, Result>(
  entryPoint: DevelopShiftBridgeEventEntry,
  original: (event: Event) => Promise<Result>,
  retain: DevelopShiftBridgeCapture = capture,
) => {
  if (!eventEntries.includes(entryPoint)) {
    throw new Error("develop_bridge_entry_invalid");
  }
  return async (event: Event): Promise<Result | void> => {
    const environment = event.params?.env;
    if (environment === "production") return original(event);
    if (environment !== "develop") return rejectEnvironment();
    await retain(entryPoint, event);
  };
};

type Registration = (
  options: {document: string; retry: true; maxInstances: 20},
  handler: (event: EventValue) => Promise<void>,
) => unknown;

/**
 * Four new exact-develop retry-enabled collectors. Establish/read them back
 * before changing shared originals; source generation is not deployment.
 * @param {object} register The original non-auth-context SDK constructors.
 * @param {Function} retain Durable capture, constructed lazily at invocation.
 * @return {object} Exactly four new collector exports.
 */
export const createDevelopShiftCaptureTriggers = (
  register: {created: Registration; written: Registration},
  retain: DevelopShiftBridgeCapture = capture,
): Record<string, unknown> => {
  const specs = [
    {name: "captureDevelopShiftPlanningRequest", collection:
      "shiftPlanningRequests/{requestId}", entryPoint:
      "onShiftPlanningRequestCreated", kind: "created"},
    {name: "captureDevelopShiftWritten", collection: "shifts/{shiftId}",
      entryPoint: "onShiftWritten", kind: "written"},
    {name: "captureDevelopDeliveryCalendarWritten", collection:
      "deliveryCalendar/{weekKey}", entryPoint:
      "onDeliveryCalendarOverrideWritten", kind: "written"},
    {name: "captureDevelopNotificationCreated", collection:
      "notificationEvents/{eventId}", entryPoint:
      "onNotificationEventCreated", kind: "created"},
  ] as const;
  return Object.fromEntries(specs.map((spec) => [spec.name,
    register[spec.kind]({
      document: `develop/plus-collections/${spec.collection}`,
      retry: true, maxInstances: 20}, async (event) => {
      const supplied = event.params?.env;
      if (supplied !== undefined && supplied !== "develop") {
        return rejectEnvironment();
      }
      await retain(spec.entryPoint, {...event,
        params: {...event.params, env: "develop"}});
    })]));
};
