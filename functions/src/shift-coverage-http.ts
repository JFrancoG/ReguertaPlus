import {Request} from "firebase-functions/v2/https";
import {HttpRequestError, IdentityTokenVerifier, VerifiedIdentity,
  verifyBearerIdentity} from "./backend-security.js";
import {parseShiftCoverageCommand} from "./shift-coverage.js";
import {parseShiftCoverageQuery} from "./shift-coverage-client.js";

type HttpResponse = {
  setHeader: (name: string, value: string) => unknown;
  status: (code: number) => {json: (value: unknown) => unknown};
};

type Dependencies = {
  verifyToken: IdentityTokenVerifier;
  requireLocalEnvironment: () => void;
  execute: (command: unknown, identity: VerifiedIdentity) => Promise<{
    case: {id: string; revision: number}; replayed: boolean}>;
  read: (query: unknown, identity: VerifiedIdentity) => Promise<unknown>;
};

/**
 * Local native-client transport, deliberately not a deployable function export.
 * Commands never accept actor IDs. Replies omit private selection records;
 * tokens, reasons, identities and SDK failures are never echoed in errors.
 * @param {object} dependencies Trusted local composition and token verifier.
 * @return {Function} POST handler suitable for a local HTTP server or tests.
 */
export const createShiftCoverageHttpHandler = (dependencies: Dependencies) =>
  async (
    request: Pick<Request, "method" | "body" | "query" | "headers">,
    response: HttpResponse,
  ): Promise<void> => {
    response.setHeader("Cache-Control", "no-store");
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      response.status(405).json({ok: false, code: "method_not_allowed"});
      return;
    }
    try {
      dependencies.requireLocalEnvironment();
      const identity = await verifyBearerIdentity(
        request.headers.authorization, dependencies.verifyToken);
      dependencies.requireLocalEnvironment();
      if (Object.keys(request.query).length) {
        throw new HttpRequestError(400, "invalid_coverage_request", "Invalid");
      }
      const query = ["overview", "detail"].includes(request.body?.action);
      let parsed;
      try {
        parsed = query ? parseShiftCoverageQuery(request.body) :
          parseShiftCoverageCommand(request.body);
      } catch {
        throw new HttpRequestError(400, "invalid_coverage_request", "Invalid");
      }
      if (query) {
        response.status(200).json({ok: true,
          data: await dependencies.read(parsed, identity)});
      } else {
        const result = await dependencies.execute(parsed, identity);
        response.status(200).json({ok: true, data: {schemaVersion: 1,
          environment: "develop", operationId: request.body.operationId,
          caseId: result.case.id, revision: result.case.revision,
          replayed: result.replayed}});
      }
    } catch (error) {
      const known = error instanceof HttpRequestError;
      response.status(known ? error.status : 500).json({ok: false,
        code: known ? error.code : "coverage_unavailable"});
    }
  };
