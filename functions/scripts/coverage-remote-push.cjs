"use strict";
// Transport-only rehearsal. No Auth, Firestore, topic or production-app destinations.
const {readFileSync, writeFileSync} = require("node:fs");
const {createHash} = require("node:crypto");
const {parseArgs} = require("node:util");
const PROJECT = "reguerta-9f27f";
const EVENT = "coverage-" + "84".repeat(32);
const APPS = {
  android: ["1:195744802339:android:65308f6405a03baaadb396", "com.reguerta.user.debug", "firebaseInstallationId"],
  ios: ["1:195744802339:ios:3fa2544ff8ed478aadb396", "com.plusprojects.Reguerta.debug", "fcmToken"],
};

function plan(destination) {
  const app = APPS[destination?.platform];
  if (!app || destination.projectId !== PROJECT || destination.appId !== app[0] || destination.bundleId !== app[1]) {
    throw new Error("Only registered Reguerta Debug destinations are allowed");
  }
  const keys = ["platform", "projectId", "appId", "bundleId", app[2]];
  if (Object.keys(destination).some((key) => !keys.includes(key)) ||
      typeof destination[app[2]] !== "string" || !/^[A-Za-z0-9_:\-]{10,4096}$/.test(destination[app[2]])) {
    throw new Error("Exactly one installation destination is required");
  }
  return {
    projectId: PROJECT, platform: destination.platform, appId: app[0], eventId: EVENT,
    destinationSHA256: createHash("sha256").update(destination[app[2]]).digest("hex"),
  };
}

// FCM HTTP v1: https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages/send
// Unlike Admin Messaging, native fetch does not retry failed POSTs. Never follow a redirect
// carrying the installation token or bearer credential; an uncertain acknowledgement stays unknown.
async function submitIOSOnce(destination, accessToken, fetchImpl = globalThis.fetch) {
  plan(destination);
  if (destination.platform !== "ios" || typeof accessToken !== "string" || !accessToken) {
    throw new Error("An iOS Debug destination and access credential are required");
  }
  try {
    const response = await fetchImpl(`https://fcm.googleapis.com/v1/projects/${PROJECT}/messages:send`, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(15_000),
      headers: {Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json"},
      body: JSON.stringify({message: {
        token: destination.fcmToken,
        notification: {title: "Ensayo HU-084", body: "Abrir cobertura de ejemplo"},
        data: {eventId: EVENT, type: "shift_updated", target: "users"},
        apns: {headers: {"apns-collapse-id": "84".repeat(32)}},
      }}),
    });
    if (response.status !== 200) {
      const result = {outcome: response.status >= 400 && response.status < 500 ? "failed" : "unknown",
        failureCode: `fcm_http_${response.status}`};
      // Keep only known machine codes; provider error messages can echo private destination data.
      const body = await response.json().catch(() => ({}));
      const status = body.error?.status;
      if (["INVALID_ARGUMENT", "NOT_FOUND", "PERMISSION_DENIED", "RESOURCE_EXHAUSTED",
        "UNAUTHENTICATED", "UNAVAILABLE", "INTERNAL"].includes(status)) result.errorStatus = status;
      const details = Array.isArray(body.error?.details) ? body.error.details : [];
      const fcmCode = details.find((detail) =>
        detail?.["@type"] === "type.googleapis.com/google.firebase.fcm.v1.FcmError")?.errorCode;
      if (["INVALID_ARGUMENT", "UNREGISTERED", "SENDER_ID_MISMATCH", "QUOTA_EXCEEDED",
        "APNS_AUTH_ERROR", "THIRD_PARTY_AUTH_ERROR", "UNAVAILABLE", "INTERNAL"].includes(fcmCode)) {
        result.fcmErrorCode = fcmCode;
      }
      return result;
    }
    const receipt = await response.json();
    if (typeof receipt.name !== "string" || !receipt.name.startsWith(`projects/${PROJECT}/messages/`) ||
        receipt.name === `projects/${PROJECT}/messages/`) {
      return {outcome: "unknown", failureCode: "transport_response_mismatch"};
    }
    return {outcome: "accepted", acceptedTargetCount: 1};
  } catch {
    return {outcome: "unknown", failureCode: "transport_ambiguous_error"};
  }
}

async function main(args) {
  const {values} = parseArgs({args, options: {
    destination: {type: "string"}, send: {type: "boolean", default: false},
    "confirm-project": {type: "string"}, receipt: {type: "string"},
  }});
  if (!values.destination) throw new Error("--destination <private JSON file> is required");
  const destination = JSON.parse(readFileSync(values.destination, "utf8"));
  const summary = plan(destination);
  if (!values.send) {
    console.log(JSON.stringify({...summary, mode: "offline-plan", sends: 0}));
    return;
  }
  if (values["confirm-project"] !== PROJECT || !values.receipt) {
    throw new Error("Live send requires --confirm-project reguerta-9f27f and a new --receipt path");
  }
  // Exclusive receipt fences automatic replay, including a lost SDK acknowledgement.
  writeFileSync(values.receipt, JSON.stringify({...summary, outcome: "submission-started"}), {flag: "wx", mode: 0o600});
  const {initializeApp, applicationDefault, deleteApp} = require("firebase-admin/app");
  if (destination.platform === "ios") {
    // ADC may refresh its OAuth credential, but only this one fetch can submit the message.
    const {access_token: accessToken} = await applicationDefault().getAccessToken();
    const result = await submitIOSOnce(destination, accessToken);
    writeFileSync(values.receipt, JSON.stringify({...summary, ...result}), {mode: 0o600});
    console.log(JSON.stringify({...summary, ...result}));
    return;
  }
  const {getMessaging} = require("firebase-admin/messaging");
  const {createFirebaseShiftPlanningNotificationTransport} = require("../lib/shift-planning-firebase-notification-transport.js");
  const app = initializeApp({projectId: PROJECT, credential: applicationDefault()}, "coverage-remote-transport");
  try {
    const result = await createFirebaseShiftPlanningNotificationTransport(getMessaging(app)).submit({
      submissionWindow: {signal: new AbortController().signal, expiresAtMillis: Date.now() + 60_000},
      push: {
        notification: {title: "Ensayo HU-084", body: "Abrir cobertura de ejemplo"},
        data: {eventId: EVENT, type: "shift_updated", target: "users"}, collapseKey: "84".repeat(32),
      },
      targets: {
        firebaseInstallationIds: destination.platform === "android" ? [destination.firebaseInstallationId] : [],
        fcmTokens: destination.platform === "ios" ? [destination.fcmToken] : [],
      },
    });
    writeFileSync(values.receipt, JSON.stringify({...summary, ...result}), {mode: 0o600});
    console.log(JSON.stringify({...summary, ...result}));
  } finally {
    await deleteApp(app);
  }
}
module.exports = {plan, main, submitIOSOnce};
if (require.main === module) main(process.argv.slice(2)).catch(() => {
  console.error("Rehearsal failed. Check arguments/configuration and the local receipt before any retry.");
  process.exitCode = 1;
});
