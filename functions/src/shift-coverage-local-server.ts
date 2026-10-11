import {createServer, IncomingMessage, ServerResponse} from "node:http";
import {HttpRequestError} from "./backend-security.js";
import {createProvisionalShiftCoverageApp} from
  "./shift-coverage-provisional-app.js";

const readBody = (request: IncomingMessage): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 16_384) {
        chunks.length = 0;
        reject(new HttpRequestError(413,
          "coverage_request_too_large", "Large"));
        return;
      }
      chunks.push(chunk);
    });
    request.on("error", reject);
    request.on("end", () => {
      if (size > 16_384) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new HttpRequestError(400,
          "invalid_coverage_request", "Invalid"));
      }
    });
  });

const respond = (response: ServerResponse, status: number, value: unknown) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(value));
};

/**
 * Start only a loopback HTTP listener with fixed Auth/Firestore emulators.
 * Policy is explicit; port 0 lets integration tests select an available port.
 * @param {object} options Required local policy and trusted clock.
 * @param {number} port Requested local port; clients cannot supply a host.
 * @return {Promise<object>} Bound local URL and owned-resource cleanup.
 */
export const startProvisionalShiftCoverageServer = async (
  options: Parameters<typeof createProvisionalShiftCoverageApp>[0],
  port: number,
) => {
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("Invalid local coverage port");
  }
  const app = createProvisionalShiftCoverageApp(options);
  const server = createServer({requestTimeout: 10_000, headersTimeout: 10_000},
    async (request, response) => {
      response.setHeader("Cache-Control", "no-store");
      try {
        const url = new URL(request.url ?? "/", "http://127.0.0.1");
        if (url.pathname !== "/coverage") {
          respond(response, 404, {ok: false, code: "not_found"});
          return;
        }
        if (request.method === "POST" &&
            request.headers["content-type"]?.split(";")[0].trim() !==
              "application/json") {
          respond(response, 415, {ok: false, code: "json_required"});
          return;
        }
        const body = request.method === "POST" ? await readBody(request) : {};
        const adapter = {
          setHeader: (name: string, value: string) =>
            response.setHeader(name, value),
          status: (status: number) => {
            response.statusCode = status;
            return adapter;
          },
          json: (value: unknown) =>
            respond(response, response.statusCode, value),
        };
        await app.handle({method: request.method ?? "",
          headers: request.headers,
          query: Object.fromEntries(url.searchParams), body}, adapter);
      } catch (error) {
        if (!response.writableEnded) {
          respond(response, error instanceof HttpRequestError ?
            error.status : 500, {ok: false, code:
            error instanceof HttpRequestError ? error.code :
              "coverage_unavailable"});
        }
      }
    });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", () => {
        server.removeListener("error", reject);
        resolve();
      });
    });
  } catch (error) {
    await app.close();
    throw error;
  }
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No address");
  return {url: `http://127.0.0.1:${address.port}/coverage`,
    close: async () => {
      try {
        await new Promise<void>((resolve, reject) => server.close((error) =>
          error ? reject(error) : resolve()));
      } finally {
        await app.close();
      }
    }};
};
