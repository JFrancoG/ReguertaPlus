#!/usr/bin/env node
"use strict";

// Offline review only: this command never constructs a Firebase/Google client.
const {readFileSync, writeFileSync, statSync} = require("node:fs");
const {parseArgs} = require("node:util");
const {resolve} = require("node:path");

const MAX_BYTES = 6 * 1024 * 1024;
const readJSON = (path) => {
  const metadata = statSync(path);
  if (!metadata.isFile() || metadata.size > MAX_BYTES) {
    throw new Error("coverage_bootstrap_review_input_limit");
  }
  const bytes = readFileSync(path);
  if (bytes.length > MAX_BYTES) throw new Error("coverage_bootstrap_review_input_limit");
  return JSON.parse(bytes.toString("utf8"));
};

const main = () => {
  const {values} = parseArgs({options: {
    snapshot: {type: "string"}, decision: {type: "string"}, out: {type: "string"},
  }, allowPositionals: false, strict: true});
  if (!values.snapshot || !values.decision || !values.out) {
    throw new Error("usage: --snapshot capture.json --decision decision.json --out new-review.json");
  }
  const output = resolve(values.out);
  if ([values.snapshot, values.decision].some((input) => resolve(input) === output)) {
    throw new Error("coverage_bootstrap_review_cannot_replace_input");
  }
  const {planShiftCoverageBootstrap} = require("../lib/shift-coverage-bootstrap.js");
  const plan = planShiftCoverageBootstrap({
    snapshot: readJSON(values.snapshot), decision: readJSON(values.decision),
  });
  const artifact = JSON.stringify(plan, null, 2) + "\n";
  if (Buffer.byteLength(artifact) > MAX_BYTES) throw new Error("coverage_bootstrap_review_output_limit");
  writeFileSync(output, artifact, {flag: "wx", mode: 0o600});
  process.stdout.write(JSON.stringify({mode: "review-only", environment: plan.environment,
    operationId: plan.operationId, planDigest: plan.planDigest,
    blockers: plan.blockers.length, creates: plan.creates.length, artifact: output}) + "\n");
  if (plan.blockers.length) process.exitCode = 2;
};

try { main(); } catch (error) {
  const code = error.code ?? "coverage_bootstrap_review_failed";
  // Never print captured documents, member information or credential paths.
  process.stderr.write(JSON.stringify({error: code,
    message: error.message?.startsWith("usage:") ? error.message :
      "Could not prepare the offline coverage initialization review."}) + "\n");
  process.exitCode = 1;
}
