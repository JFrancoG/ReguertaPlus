"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const classifiedFailures = new WeakMap();

// Error objects from a provider or an assertion may include credentials, paths
// or customer data. Only fixed classifications cross the desktop boundary.
function classify(error) {
  try {
    const code = Object.getOwnPropertyDescriptor(error, "code")?.value;
    if (code === "ERR_ASSERTION") {
      const message = Object.getOwnPropertyDescriptor(error, "message")?.value;
      const first = typeof message === "string" ? message.split("\n", 1)[0] : "";
      if (first === "unreviewed backend transition") return "unreviewed-backend-transition";
      if (first === "Start is outside 15 second bound") return "start-deadline-exhausted";
      return "assertion-failed";
    }
    if (code === "ENOENT") return "missing-file";
    if (code === "EACCES" || code === "EPERM") return "access-denied";
  } catch { /* A primitive or throwing Proxy has no trusted failure fields. */ }
  return "unclassified-error";
}

function prepareAttendedWindowStart(input, {
  requireOperationalReview, validateOperatorInputs, validateRiskAcceptance,
  bindActualWindow, createOperator, directory, nowMillis = Date.now,
}) {
  let step = "review-package";
  let consumed = false;
  function failed(error) {
    let observedAtMillis = null;
    try {
      const at = nowMillis();
      if (Number.isSafeInteger(at) && at >= 0) observedAtMillis = at;
    } catch { /* Keep the initiating exception even if the clock is unavailable. */ }
    const failure = {phase: step, reason: classify(error), observedAtMillis};
    const file = path.join(directory, "startup-first-failure-private.json");
    let recorded = false;
    try {
      fs.writeFileSync(file, JSON.stringify(failure) + "\n", {flag: "wx", mode: 0o600, flush: true});
      assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), failure);
      recorded = true;
    } catch { /* Cleanup still runs; report the same primary failure in memory. */ }
    const exception = new Error("Develop operator startup failed");
    exception.startupFailure = Object.freeze({...failure, recorded});
    classifiedFailures.set(exception, exception.startupFailure);
    return exception;
  }
  let inputs;
  try {
    requireOperationalReview();
    step = "prepare-inputs";
    const {ownerCredential, iamBearer, firestore, tab} = input;
    inputs = {ownerCredential: {sessionId: ownerCredential?.sessionId, bearer: ownerCredential?.bearer,
      expiresAtMillis: ownerCredential?.expiresAtMillis}, iamBearer, firestore, tab};
    validateOperatorInputs(inputs);
    step = "prepare-risk";
    validateRiskAcceptance();
  } catch (error) {
    throw failed(error);
  }
  return {
    async start({confirmed, answerText, observedAtMillis}) {
      assert.equal(consumed, false, "Start is one-shot");
      try {
        step = "check-inputs";
        validateOperatorInputs(inputs);
        step = "check-risk";
        validateRiskAcceptance();
        consumed = true;
        step = "bind-window";
        const dated = bindActualWindow({confirmed, answerText, observedAtMillis,
          ownerSessionExpiresAtMillis: inputs.ownerCredential.expiresAtMillis});
        step = "read-quiet-receipt";
        const quiet = JSON.parse(fs.readFileSync(dated.quietFile, "utf8"));
        step = "create-operator";
        const operator = createOperator(inputs);
        step = "check-start-deadline";
        assert.ok(nowMillis() < dated.operatorMustStartBeforeMillis, "Start is outside 15 second bound");
        step = "attend-start";
        const first = await operator.startAndAttend(quiet);
        return {operator, first, window: dated.window};
      } catch (error) {
        throw failed(error);
      }
    },
  };
}

// Always join owner cleanup. A secondary cleanup error must not mask the
// already classified startup failure, even when its local receipt failed.
async function releaseAfterFailedStart(error, release, context = "start") {
  const result = new Error(context === "preparation" ? "Desktop owner preflight failed." :
    "Attended start interrupted. Inspect the operation journal.");
  const failure = classifiedFailures.get(error);
  if (failure) result.startupFailure = failure;
  try {
    await release();
  } catch {
    result.ownerReleaseNeedsInspection = true;
  }
  throw result;
}

module.exports = {prepareAttendedWindowStart, releaseAfterFailedStart};
