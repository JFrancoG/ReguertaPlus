import {
  HttpRequestError,
  requirePostMethod,
  VerifiedIdentity,
} from "./backend-security.js";
import {
  captureShiftPlanningWriterAuthority,
} from "./shift-planning-writer-authority.js";

type UnknownRecord = Record<string, unknown>;

export type ShiftPlanningRequestContextInput = {
  schemaVersion: 1;
  environment: "develop" | "production";
};

export type ShiftPlanningRequestContext = {
  schemaVersion: 1;
  environment: "develop" | "production";
  expectedWriteEpoch: number;
  expectedActiveRevision: string | null;
};

export type ShiftPlanningRequestContextHttpRequest = {
  method: string;
  query: object;
  body: unknown;
};

export type ShiftPlanningRequestContextDependencies = {
  verifyIdentity: () => Promise<VerifiedIdentity>;
  requireAdmin: (
    environment: "develop" | "production",
    identity: VerifiedIdentity,
  ) => Promise<unknown>;
  resolveContext: (
    input: ShiftPlanningRequestContextInput,
  ) => Promise<ShiftPlanningRequestContext>;
};

const contextFields = ["schemaVersion", "environment"] as const;

const failInput = (message: string): never => {
  throw new HttpRequestError(
    400,
    "invalid_shift_planning_context",
    message,
  );
};

const requirePlainRecord = (value: unknown): UnknownRecord => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return failInput("Shift planning context must be a plain object");
  }
  return value as UnknownRecord;
};

export const parseShiftPlanningRequestContextInput = (
  value: unknown,
): ShiftPlanningRequestContextInput => {
  const input = requirePlainRecord(value);
  const fields = Object.keys(input);
  if (
    fields.length !== contextFields.length ||
    fields.some((field) => !contextFields.includes(
      field as typeof contextFields[number],
    )) ||
    input.schemaVersion !== 1 ||
    (input.environment !== "develop" && input.environment !== "production")
  ) {
    return failInput("Shift planning context fields are invalid");
  }
  return {
    schemaVersion: 1,
    environment: input.environment,
  };
};

/**
 * Projects private maintenance state into the minimal values an admin client
 * must bind to a v2 planning request. Digests and state internals stay private.
 * @param {ShiftPlanningRequestContextInput} input Validated request scope.
 * @param {unknown} stateValue Current private maintenance-state document.
 * @return {ShiftPlanningRequestContext} Minimal immutable request context.
 */
export const buildShiftPlanningRequestContext = (
  input: ShiftPlanningRequestContextInput,
  stateValue: unknown,
): ShiftPlanningRequestContext => {
  const authority = captureShiftPlanningWriterAuthority(stateValue);
  if (!authority) {
    throw new HttpRequestError(
      409,
      "shift_planning_state_unavailable",
      "Shift planning state is unavailable",
    );
  }
  return {
    schemaVersion: 1,
    environment: input.environment,
    expectedWriteEpoch: authority.writeEpoch,
    expectedActiveRevision: authority.activeRevision,
  };
};

/**
 * Validates transport shape before authentication, then authorizes the exact
 * environment before any private-state read.
 * @param {ShiftPlanningRequestContextHttpRequest} request HTTP request subset.
 * @param {ShiftPlanningRequestContextDependencies} dependencies Auth and read
 * seams.
 * @return {Promise<ShiftPlanningRequestContext>} Authorized minimal context.
 */
export const executeShiftPlanningRequestContextRequest = async (
  request: ShiftPlanningRequestContextHttpRequest,
  dependencies: ShiftPlanningRequestContextDependencies,
): Promise<ShiftPlanningRequestContext> => {
  requirePostMethod(request.method);
  if (Object.keys(request.query).length !== 0) {
    return failInput("Shift planning context does not accept query parameters");
  }
  const input = parseShiftPlanningRequestContextInput(request.body);
  const identity = await dependencies.verifyIdentity();
  await dependencies.requireAdmin(input.environment, identity);
  return dependencies.resolveContext(input);
};
