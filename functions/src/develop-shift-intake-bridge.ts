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
const administrativeEntries = ["onProductWrite", "onContainerWrite",
  "onMeasureWrite", "onUserWrite", "onOrderWrite", "upsertMemberByAdmin",
  "validateGlobalVersionPolicy", "validateGlobalFreshnessConfig"];
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
 * Resolves the original target set without filtering a mixed/default request.
 * A request including develop is rejected before any original callback work.
 * @param {string} entryPoint Audited administrative HTTP identity.
 * @param {Function} original Original callback and response contract.
 * @param {Function} resolveTargets Original lexical target resolver.
 * @return {Function} Unmodified non-develop callback or maintenance response.
 */
export const wrapDevelopAdministrativeHttp = <
  Request extends HttpRequest, Result,
>(
    entryPoint: string,
    original: (request: Request, response: HttpResponse) => Result,
    resolveTargets: (request: Request) => unknown,
  ) => {
  if (!administrativeEntries.includes(entryPoint)) {
    throw new Error("develop_bridge_entry_invalid");
  }
  return (request: Request, response: HttpResponse): Result | unknown => {
    const resolved = resolveTargets(request);
    const targets = Array.isArray(resolved) ? resolved : [resolved];
    if (!targets.length || targets.some((value) =>
      typeof value !== "string" ||
      !["local", "develop", "production"].includes(value))) {
      return rejectEnvironment();
    }
    if (targets.includes("develop")) {
      return response.status(503).json({
        ok: false, error: "develop_legacy_intake_closed",
      });
    }
    return original(request, response);
  };
};

/**
 * A paused Scheduler job does not close direct invocation of its service.
 * Resolve the original target set before any reminder reads or writes, and
 * reject the whole run if it includes develop. Do not reroute it to production.
 * @param {string} entryPoint One of the three reviewed scheduled exports.
 * @param {Function} original Unchanged original scheduled callback.
 * @param {Function} resolveTargets Original lexical environment resolver.
 * @return {Function} Guarded callback with the original SDK HTTP contract.
 */
export const wrapDevelopScheduledReminder = <Args extends unknown[], Result>(
  entryPoint: string,
  original: (...args: Args) => Promise<Result>,
  resolveTargets: () => unknown,
) => {
  if (!/^sendPendingOrderReminderSunday(20|22|23)$/.test(entryPoint)) {
    throw new Error("develop_bridge_entry_invalid");
  }
  return async (...args: Args): Promise<Result> => {
    const targets = resolveTargets();
    if (!Array.isArray(targets) || !targets.length ||
        targets.some((target) => !["local", "develop", "production"]
          .includes(target))) return rejectEnvironment();
    if (targets.includes("develop")) {
      throw new Error("develop_legacy_intake_closed");
    }
    return original(...args);
  };
};

const requireProductionResolution = (
  value: unknown, createError: () => Error,
): unknown => {
  if (value !== "production") throw createError();
  return value;
};

/**
 * Keeps the modern callback's method/parser/error ordering. Its own error type
 * handles direct develop requests before authentication or member reads.
 * @param {Function} original Audited synchronous environment parser.
 * @param {Function} createError Original module's safe HTTP error constructor.
 * @return {Function} Parser preserving the original production result/errors.
 */
export const wrapDevelopEnvironmentResolver = <Args extends unknown[]>(
  original: (...args: Args) => unknown, createError: () => Error,
) => (...args: Args): unknown => requireProductionResolution(
    original(...args), createError,
  );

/**
 * Rejects a reviewer routed from production to develop before member lookup or
 * linking. The original identity/config reads determining that route remain.
 * @param {Function} original Audited asynchronous effective-target resolver.
 * @param {Function} createError Original module's safe HTTP error constructor.
 * @return {Function} Original production resolution or maintenance rejection.
 */
export const wrapDevelopEffectiveEnvironmentResolver = <Args extends unknown[]>(
  original: (...args: Args) => Promise<unknown>, createError: () => Error,
) => async (...args: Args): Promise<unknown> => requireProductionResolution(
    await original(...args), createError,
  );

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
