"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const path = require("node:path");
const base = path.resolve(__dirname, "../..");
const dir = process.env.HU083_EVIDENCE_DIR;
assert(
  dir && path.isAbsolute(dir),
  "HU083_EVIDENCE_DIR must name the private evidence directory",
);
const projectId = "demo-hu083-develop-rehearsal";
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8797");
assert.equal(process.env.GCLOUD_PROJECT, projectId);
const input = JSON.parse(
  fs.readFileSync(path.join(dir, "backend-fixture-input.json")),
);
assert.equal(typeof input.spreadsheet.spreadsheetId, "string");
const { Timestamp } = require("@google-cloud/firestore");
const { isEligibleForShiftRotation } = require(
  base + "/lib/shift-eligibility.js",
);
const { consumeRotationPositions } = require(
  base + "/lib/shift-planning-contract.js",
);
const { shiftSheetsDateFromCell } = require(
  base + "/lib/shift-sheets-human-layout.js",
);
const {
  buildShiftPlanningPublicShiftMaterialization,
  createShiftPlanningActivationOperationTerminal,
} = require(base + "/lib/shift-planning-publication-contract.js");

const { resolveShiftRotationBootstrap } = require(
  base + "/lib/shift-rotation-bootstrap.js",
);
const { createShiftPlanningDigest: digest } = require(
  base + "/lib/shift-planning-digest.js",
);
const literal = (c) =>
  String(
    c?.userEnteredValue?.stringValue ?? c?.userEnteredValue?.numberValue ?? "",
  );
const eligible = input.users
  .filter(isEligibleForShiftRotation)
  .map((u) => u.id)
  .sort();
assert.equal(input.users.length, 48);
assert.equal(eligible.length, 32);
const entries = [],
  tabs = [];
for (const sheet of input.spreadsheet.sheets) {
  const type = sheet.properties.title.includes("reparto")
    ? "delivery"
    : "market";
  const rows = sheet.data[0].rowData,
    occupied = new Set();
  for (let index = 0; index < rows.length; index++) {
    const date = shiftSheetsDateFromCell(literal(rows[index]?.values?.[0]));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const cells =
      type === "delivery"
        ? [{ row: index, column: 1 }]
        : [1, 2, 3].map((n) => ({ row: index + n, column: 0 }));
    const assigned = cells.map((c) => {
      const name = literal(rows[c.row]?.values?.[c.column]);
      const matches = input.users.filter((u) => u.displayName === name);
      assert.equal(matches.length, 1);
      assert(isEligibleForShiftRotation(matches[0]));
      return matches[0].id;
    });
    for (let offset = 0; offset < (type === "delivery" ? 1 : 4); offset++)
      occupied.add(index + offset);
    entries.push({
      id: `shift_${type}_${date.replaceAll("-", "")}`,
      type,
      date,
      assigned,
      sheetId: sheet.properties.sheetId,
      row: index,
    });
  }
  const decorations = rows.flatMap((row, index) =>
    occupied.has(index)
      ? []
      : [{ rowNumber: index + 1, cells: (row.values || []).map(literal) }],
  );
  tabs.push({
    type,
    seasonStartYear: Number(sheet.properties.title.match(/20\d\d/)[0]),
    title: sheet.properties.title,
    layout: type + "_human",
    decorations,
  });
}
assert.equal(entries.length, 72);
const assignedIds = new Set(entries.flatMap((e) => e.assigned));
assert.equal(assignedIds.size, 27);
const now = Timestamp.fromDate(new Date("2026-09-11T22:00:00Z")),
  activeRevision = "hu083-develop-reset-20260912-v1",
  activeDigest = digest({
    scope: "new-disposable-develop-rotation",
    eligible,
    entries: entries.map((e) => ({ id: e.id, assigned: e.assigned })),
  });
const rotations = {},
  materializations = [],
  bootstraps = {};
for (const type of ["delivery", "market"]) {
  const typed = entries
    .filter((e) => e.type === type)
    .sort((a, b) => a.date.localeCompare(b.date));
  const mapping = {
    revision: activeRevision,
    digest: activeDigest,
    provenance:
      "User authorized rebuilding disposable develop, then approved this reset tranche on 2026-09-12; no historical ownership inferred.",
    approvalStatus: "approved",
    type,
    orderedUserIds: eligible,
    roundNumber: 1,
    nextMemberIndex: 0,
    stableTieOrder: eligible,
    evidence:
      "48 captured users, 32 eligible; all retained. Supplied 27 effective assignees preserved.",
  };
  const bootstrap = {
    type,
    eligibleUserIds: eligible,
    isTrulyNewRotation: true,
    approvedMapping: mapping,
  };
  bootstraps[type] = {
    input: bootstrap,
    resolved: resolveShiftRotationBootstrap(bootstrap),
  };
  let cursor = bootstraps[type].resolved.rotation;
  for (const [index, e] of typed.entries()) {
    const consumed = consumeRotationPositions(
      cursor,
      type === "delivery" ? 1 : 3,
    );
    cursor = consumed.nextRotation;
    const position = {
      schemaVersion: 1,
      positionId: e.id,
      candidateId: "hu083-develop-reset-20260912-candidate",
      type,
      shiftId: e.id,
      scheduledDate: e.date,
      projectionSeasonStartYear:
        Number(e.date.slice(0, 4)) - (Number(e.date.slice(5, 7)) < 9 ? 1 : 0),
      rotationOwnerUserIds: consumed.positions.map(
        (p) => p.rotationOwnerUserId,
      ),
      assignedUserIds: e.assigned,
      rotationPositions: consumed.positions.map((p, i) => ({
        ...p,
        effectiveAssigneeUserId: e.assigned[i],
        planningReason: "target",
      })),
      helperUserId:
        type === "delivery" ? (typed[index + 1]?.assigned[0] ?? null) : null,
      source: "app",
      origin: "planner",
      planningRequestId: "hu083-develop-reset-20260912",
      bundleRevision: activeRevision,
      bundleDigest: activeDigest,
      writeEpoch: 1,
    };
    materializations.push(
      buildShiftPlanningPublicShiftMaterialization({
        environment: "develop",
        position,
        attemptedAt: now,
      }),
    );
  }
  rotations[type] = {
    schemaVersion: 1,
    type,
    lastIdempotencyKey: null,
    migrationBaseline: null,
    releaseLease: null,
    stateRevision: 1,
    cursor,
    cohortFrozen: cursor.nextMemberIndex > 0,
    frozenCohortUserIds: cursor.nextMemberIndex > 0 ? eligible : [],
    activeRevision,
    activeDigest,
    planningFrontierSeasonStartYear: 2027,
  };
}
const operation = createShiftPlanningActivationOperationTerminal({
  operationId: "hu083-develop-reset-20260912",
  environment: "develop",
  requestId: "hu083-develop-reset-20260912",
  candidateId: "hu083-develop-reset-20260912-candidate",
  bundleRevision: activeRevision,
  bundleDigest: activeDigest,
  forwardManifestDigest: digest(
    materializations.map((m) => ({
      path: m.targetPath,
      payloadDigest: m.payloadDigest,
    })),
  ),
  expectedStateDigest: digest(
    JSON.parse(fs.readFileSync(path.join(dir, "captured-firestore.json")))
      .source.shifts,
  ),
  writeEpoch: 1,
  attemptedAt: now,
  publicMutations: materializations.map((m) => ({
    mutationKind: "create",
    targetPath: m.targetPath,
    documentRevision: m.documentRevision,
    payloadDigest: m.payloadDigest,
  })),
  beforeImages: [],
});

module.exports = {
  input,
  entries,
  eligible,
  rotations,
  materializations,
  operation,
  activeRevision,
  activeDigest,
  bootstraps,
  tabs,
  now,
};
