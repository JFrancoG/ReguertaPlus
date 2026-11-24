"use strict";
const {readFile} = require("node:fs/promises");
const {startProvisionalShiftCoverageServer} = require("../lib/shift-coverage-local-server.js");

const main = async () => {
  const [policyPath, portText] = process.argv.slice(2);
  if (!policyPath || !/^\d+$/.test(portText ?? "") || process.argv.length !== 4) {
    throw new Error("Usage: node scripts/serve-shift-coverage.cjs POLICY_JSON PORT");
  }
  const policy = JSON.parse(await readFile(policyPath, "utf8"));
  if (!policy || typeof policy !== "object" || Array.isArray(policy) ||
      Object.keys(policy).some((key) => !["maximumOfferWindowMillis", "selectionPolicy", "beaconPolicy"].includes(key))) {
    throw new Error("Policy must explicitly contain coverage options only");
  }
  const server = await startProvisionalShiftCoverageServer({...policy, nowMillis: Date.now}, Number(portText));
  process.stdout.write(`Local coverage API: ${server.url}\n`);
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    try { await server.close(); } catch { process.exitCode = 1; }
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
};

if (require.main === module) main().catch(() => {
  process.stderr.write("Local coverage server failed. Check policy, port and fixed emulator environment.\n");
  process.exitCode = 1;
});
