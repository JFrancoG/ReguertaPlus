#!/usr/bin/env node
"use strict";

// Render the participant-specific Rules for the authorized journeys offline.
const {mkdirSync, readFileSync, writeFileSync} = require("node:fs");
const {join, resolve} = require("node:path");
const {parseArgs} = require("node:util");
const repository = resolve(__dirname, "../..");

const validators = [
  "authLinkPath", "actorId", "devicePath", "validLastDeviceReference",
  "isValidDeviceData", "isPlanningIdentifier", "notificationResourceFencePath",
  "notificationIncidentShiftFencePath", "isExactNotificationIncidentShiftFence",
  "notificationIncidentShiftFenceAllowsMutation", "isExactNotificationResourceFence",
  "notificationResourceFenceAllowsMutation", "hasExactKeys", "isValidPlanningTargetSubplan",
  "isValidPlanningDigestBinding", "planningRequestPath", "isOwnedCompletedPlanningPreview",
  "isValidPlanningBinding", "isValidShiftPlanningRequest",
];

function renderJourneyRules(memberIds) {
  if (!Array.isArray(memberIds) || !memberIds.length || memberIds.some((id) =>
    typeof id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id)) ||
      new Set(memberIds).size !== memberIds.length) {
    throw new Error("Expected distinct canonical member IDs");
  }
  const strict = readFileSync(join(repository, "firestore.strict.rules"), "utf8");
  const fence = readFileSync(join(repository, "firestore.develop-coverage.rules"), "utf8");
  const helpers = [...strict.matchAll(/^    function (\w+)\([^\n]*\) \{\n[\s\S]*?^    \}$/gm)]
    .filter((definition) => validators.includes(definition[1]));
  const closing = "  }\n}\n";
  if (validators.some((name) => helpers.filter((match) => match[1] === name).length !== 1) ||
      !fence.endsWith(closing)) throw new Error("Recheck canonical Rules layout");

  const scope = `
    // Only the reviewed members of the Develop journeys can use these paths.
    match /develop/plus-collections {
      function isParticipant(memberId) {
        return memberId in ${JSON.stringify([...memberIds].sort())} &&
          isActiveDevelopOwner(memberId);
      }

      function isJourneyAdmin() {
        let memberId = developActorId();
        return isParticipant(memberId) &&
          get(/databases/$(database)/documents/develop/plus-collections/users/$(memberId)).data.roles.hasAny(["admin"]);
      }

${helpers.map(([source]) => source.replace(/^/gm, "  ")).join("\n\n")}

      match /users/{userId} {
        allow update: if isParticipant(userId) &&
          request.resource.data.diff(resource.data).affectedKeys().hasOnly(["lastDeviceId"]) &&
          validLastDeviceReference("develop", userId);
        match /devices/{deviceId} {
          allow create, update: if isParticipant(userId) &&
            notificationResourceFenceAllowsMutation("develop", "member", userId) &&
            isValidDeviceData(deviceId, request.resource.data);
        }
        match /notificationReads/{eventId} {
          allow create, update: if isParticipant(userId) &&
            request.resource.data.keys().hasOnly(["notificationEventId", "readAt"]) &&
            request.resource.data.get("notificationEventId", "") == eventId &&
            request.resource.data.get("readAt", null) is timestamp;
        }
      }
      match /shiftPlanningRequests/{requestId} {
        allow read: if isJourneyAdmin();
        allow create: if isJourneyAdmin() && isValidShiftPlanningRequest("develop", requestId);
      }
      match /shiftPlanningCandidates/{bundleId} {
        allow read: if isJourneyAdmin();
        match /positions/{positionId} {
          allow read: if isJourneyAdmin();
        }
      }
    }
`;
  return fence.slice(0, -closing.length) + scope + closing;
}

if (require.main === module) {
  const {values} = parseArgs({options: {members: {type: "string"}, out: {type: "string"}}});
  if (!values.members || !values.out) throw new Error("Use --members private-roster.json --out new-directory");
  const members = JSON.parse(readFileSync(values.members, "utf8"));
  const rules = renderJourneyRules(members);
  mkdirSync(values.out, {mode: 0o700});
  writeFileSync(join(values.out, "journeys.rules"), rules, {flag: "wx", mode: 0o600});
  writeFileSync(join(values.out, "coverage-runtime.json"), JSON.stringify({
    SHIFT_COVERAGE_DEVELOP_ENABLED: "false",
    SHIFT_COVERAGE_DEVELOP_MEMBERS: JSON.stringify([...members].sort()),
  }, null, 2) + "\n", {flag: "wx", mode: 0o600});
  writeFileSync(join(values.out, "firebase.json"), JSON.stringify({
    firestore: {database: "(default)", rules: "journeys.rules"},
  }, null, 2) + "\n", {flag: "wx", mode: 0o600});
}
module.exports = {renderJourneyRules};
