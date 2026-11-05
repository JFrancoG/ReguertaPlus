import {AppEnvironment, HttpRequestError, requirePostMethod,
  VerifiedIdentity} from "./backend-security.js";
import {parseShiftCoverageCommand} from "./shift-coverage.js";
import {parseShiftCoverageQuery} from "./shift-coverage-client.js";
import {parseShiftAdministrationCommand, parseShiftAdministrationQuery} from
  "./shift-coverage-administration.js";
import {createFirestoreShiftCoverageService} from "./shift-coverage-live.js";

type Request = {method: string; query: object; body: unknown};
type Dependencies = {
  verifyIdentity: () => Promise<VerifiedIdentity>;
  resolveEnvironment: (requested: AppEnvironment,
    identity: VerifiedIdentity) => Promise<AppEnvironment>;
  serviceFor: (environment: AppEnvironment) =>
    ReturnType<typeof createFirestoreShiftCoverageService>;
};

const invalid = (): never => {
  throw new HttpRequestError(400, "invalid_coverage_request",
    "Shift coverage request is invalid");
};

const bodyFor = (request: Request): Record<string, unknown> => {
  requirePostMethod(request.method);
  if (Object.keys(request.query).length || !request.body ||
      typeof request.body !== "object" ||
      Object.getPrototypeOf(request.body) !== Object.prototype) {
    return invalid();
  }
  return request.body as Record<string, unknown>;
};

const identityFor = async (
  environment: AppEnvironment, dependencies: Dependencies,
) => {
  const identity = await dependencies.verifyIdentity();
  if (await dependencies.resolveEnvironment(environment, identity) !==
      environment) {
    throw new HttpRequestError(409, "coverage_environment_changed",
      "Refresh the current account environment before continuing");
  }
  return identity;
};

/**
 * Reject transport and smuggled fields before authentication or private reads.
 * Reviewer routing must match the requested canonical scope; no request is
 * silently replayed against another environment.
 * @param {Request} request Untrusted HTTP envelope.
 * @param {Dependencies} dependencies Auth and environment-bound SDK service.
 * @return {Promise<object>} Minimal access projection, without private policy.
 */
export const executeShiftCoverageAccessRequest = async (
  request: Request, dependencies: Dependencies,
) => {
  const body = bodyFor(request);
  if (Object.keys(body).sort().join() !== "environment,schemaVersion" ||
      body.schemaVersion !== 1 ||
      (body.environment !== "develop" && body.environment !== "production")) {
    return invalid();
  }
  const identity = await identityFor(body.environment, dependencies);
  return dependencies.serviceFor(body.environment).resolveAccess(identity);
};

/**
 * Use the same exact commands/projections as rehearsal, with real Auth
 * and environment-specific SDK composition. No actor ID comes from the body.
 * Commands expose only an acknowledgement, not their private case or selection.
 * @param {Request} request Untrusted HTTP envelope.
 * @param {Dependencies} dependencies Auth and environment-bound SDK service.
 * @return {Promise<unknown>} Public projection or minimal command receipt.
 */
export const executeShiftCoverageRequest = async (
  request: Request, dependencies: Dependencies,
): Promise<unknown> => {
  const body = bodyFor(request);
  let parsed;
  try {
    parsed = body.action === "administration" ?
      parseShiftAdministrationQuery(body) :
      ["reconcileMembership", "authorizeDeliverySpacingException"]
        .includes(body.action as string) ?
        parseShiftAdministrationCommand(body) :
        ["overview", "detail", "notification"].includes(body.action as string) ?
          parseShiftCoverageQuery(body) : parseShiftCoverageCommand(body);
  } catch {
    return invalid();
  }
  const identity = await identityFor(parsed.environment, dependencies);
  const service = dependencies.serviceFor(parsed.environment);
  if (parsed.action === "administration") {
    return service.readAdministration(parsed, identity);
  }
  if (["reconcileMembership", "authorizeDeliverySpacingException"]
    .includes(parsed.action)) {
    return service.executeAdministration(parsed, identity);
  }
  if (["overview", "detail", "notification"].includes(parsed.action)) {
    return service.readClient(parsed, identity);
  }
  const result = await service.execute(parsed, identity);
  return {schemaVersion: 1, environment: parsed.environment,
    operationId: body.operationId, caseId: result.case.id,
    revision: result.case.revision, replayed: result.replayed};
};
