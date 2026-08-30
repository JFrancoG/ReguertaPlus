const assert = require("node:assert/strict");
const {test} = require("node:test");

const {
  resolveShiftRotationBootstrap,
} = require("../lib/shift-rotation-bootstrap.js");

const rotation = (
  type,
  cohortUserIds,
  roundNumber = 1,
  nextMemberIndex = 0,
) => ({
  schemaVersion: 1,
  type,
  cohortUserIds,
  roundNumber,
  nextMemberIndex,
});

const mapping = (
  type,
  orderedUserIds,
  roundNumber = 1,
  nextMemberIndex = 0,
) => ({
  approvalStatus: "approved",
  type,
  orderedUserIds,
  roundNumber,
  nextMemberIndex,
  stableTieOrder: [...orderedUserIds],
  evidence: "admin-reviewed exact UID mapping",
  provenance: "admin:bootstrap-review",
  revision: "mapping-r1",
  digest: "mapping-d1",
});

const uniqueHelper = (userId) => ({
  kind: "unique",
  userId,
  evidenceRevision: "legacy-r1",
  evidenceDigest: "legacy-d1",
});

const history = (type, cohortUserIds, entries) => ({
  revision: "history-r1",
  digest: "history-d1",
  provenance: "owner-history:audit",
  entries: entries.map((entry) => ({
    type,
    cohortUserIds,
    evidence: `owner-row-${entry.chronologySequence}`,
    ...entry,
  })),
});

test(
  "prefers valid versioned state and never falls through corrupt state",
  () => {
    const eligibleUserIds = ["a", "b", "c"];
    const base = {
      type: "market",
      eligibleUserIds,
      isTrulyNewRotation: false,
      ownerHistory: history("market", eligibleUserIds, [{
        chronologySequence: 1,
        roundNumber: 1,
        positionInRound: 1,
        rotationOwnerUserId: "a",
      }]),
      approvedMapping: mapping("market", ["c", "b", "a"]),
    };
    const resolved = resolveShiftRotationBootstrap({
      ...base,
      versionedState: {
        rotation: rotation("market", eligibleUserIds, 4, 1),
        revision: "state-r4",
        digest: "state-d4",
        provenance: "firestore:rotation-state",
      },
    });
    assert.equal(resolved.source, "versionedState");
    assert.equal(resolved.rotation.roundNumber, 4);
    assert.equal(resolved.rotation.nextMemberIndex, 1);

    assert.throws(() => resolveShiftRotationBootstrap({
      ...base,
      versionedState: {
        rotation: {...rotation("market", eligibleUserIds), schemaVersion: 99},
        revision: "state-corrupt",
        digest: "state-corrupt-digest",
        provenance: "firestore:rotation-state",
      },
    }), (error) => error.code === "invalid_rotation_cursor");
  },
);

test(
  "reconstructs history from chronology regardless of query order",
  () => {
    const eligibleUserIds = ["a", "b", "c"];
    const resolved = resolveShiftRotationBootstrap({
      type: "market",
      eligibleUserIds,
      isTrulyNewRotation: false,
      approvedMapping: mapping("market", ["c", "b", "a"], 8, 2),
      ownerHistory: history("market", eligibleUserIds, [
        {
          chronologySequence: 12,
          roundNumber: 1,
          positionInRound: 3,
          rotationOwnerUserId: "c",
          assignedUserIds: ["a"],
        },
        {
          chronologySequence: 10,
          roundNumber: 1,
          positionInRound: 1,
          rotationOwnerUserId: "a",
          assignedUserIds: ["c"],
        },
        {
          chronologySequence: 11,
          roundNumber: 1,
          positionInRound: 2,
          rotationOwnerUserId: "b",
          assignedUserIds: ["a"],
        },
      ]),
    });
    assert.equal(resolved.source, "ownerHistory");
    assert.deepEqual(
      resolved.rotation,
      rotation("market", eligibleUserIds, 2, 0),
    );
  },
);

test(
  "detects history gaps and duplicates before approved mapping fallback",
  () => {
    const eligibleUserIds = ["a", "b", "c"];
    const gappedHistory = history("market", eligibleUserIds, [
      {
        chronologySequence: 1,
        roundNumber: 1,
        positionInRound: 1,
        rotationOwnerUserId: "a",
      },
      {
        chronologySequence: 3,
        roundNumber: 1,
        positionInRound: 2,
        rotationOwnerUserId: "b",
      },
    ]);
    assert.throws(() => resolveShiftRotationBootstrap({
      type: "market",
      eligibleUserIds,
      isTrulyNewRotation: false,
      ownerHistory: gappedHistory,
    }), (error) => error.code === "invalid_inherited_rotation_lineage");

    const mapped = resolveShiftRotationBootstrap({
      type: "market",
      eligibleUserIds,
      isTrulyNewRotation: false,
      ownerHistory: gappedHistory,
      approvedMapping: mapping("market", ["c", "a", "b"], 2, 1),
    });
    assert.equal(mapped.source, "approvedMapping");
    assert.deepEqual(
      mapped.rotation,
      rotation("market", ["c", "a", "b"], 2, 1),
    );

    const duplicate = history("market", eligibleUserIds, [
      {
        chronologySequence: 4,
        roundNumber: 1,
        positionInRound: 1,
        rotationOwnerUserId: "a",
      },
      {
        chronologySequence: 4,
        roundNumber: 1,
        positionInRound: 1,
        rotationOwnerUserId: "b",
      },
    ]);
    assert.throws(() => resolveShiftRotationBootstrap({
      type: "market",
      eligibleUserIds,
      isTrulyNewRotation: false,
      ownerHistory: duplicate,
    }), (error) => error.code === "invalid_inherited_rotation_lineage");
  },
);

test("requires an approved explicit mapping for a truly new rotation", () => {
  const eligibleUserIds = ["a", "b", "c"];
  assert.throws(() => resolveShiftRotationBootstrap({
    type: "market",
    eligibleUserIds,
    isTrulyNewRotation: true,
  }), (error) => error.code === "invalid_inherited_rotation_lineage");

  const resolved = resolveShiftRotationBootstrap({
    type: "market",
    eligibleUserIds,
    isTrulyNewRotation: true,
    approvedMapping: mapping("market", ["b", "a", "c"]),
  });
  assert.equal(resolved.source, "approvedMapping");
  assert.deepEqual(resolved.rotation, rotation("market", ["b", "a", "c"]));

  assert.throws(() => resolveShiftRotationBootstrap({
    type: "market",
    eligibleUserIds,
    isTrulyNewRotation: true,
    approvedMapping: mapping("market", eligibleUserIds, 2, 0),
  }), (error) => error.code === "invalid_inherited_rotation_lineage");
});

test(
  "requires unique eligible legacy delivery helper to match first owner",
  () => {
    const eligibleUserIds = ["a", "b", "c"];
    const base = {
      type: "delivery",
      eligibleUserIds,
      isTrulyNewRotation: false,
      approvedMapping: mapping("delivery", eligibleUserIds),
    };
    assert.throws(
      () => resolveShiftRotationBootstrap(base),
      (error) => error.code === "delivery_helper_evidence_ambiguous",
    );
    const resolved = resolveShiftRotationBootstrap({
      ...base,
      legacyDeliveryHelper: uniqueHelper("a"),
    });
    assert.equal(resolved.rotation.cohortUserIds[0], "a");

    assert.throws(() => resolveShiftRotationBootstrap({
      ...base,
      legacyDeliveryHelper: uniqueHelper("b"),
    }), (error) => error.code === "delivery_helper_cursor_conflict");

    assert.throws(() => resolveShiftRotationBootstrap({
      ...base,
      legacyDeliveryHelper: {
        kind: "ineligible",
        userId: "former-member",
        evidenceDigest: "legacy-d2",
      },
    }), (error) => error.code === "delivery_helper_ineligible");

    assert.throws(() => resolveShiftRotationBootstrap({
      ...base,
      legacyDeliveryHelper: {
        kind: "ambiguous",
        candidateUserIds: ["a", "b"],
        evidenceDigest: "legacy-d3",
      },
    }), (error) => error.code === "delivery_helper_evidence_ambiguous");

    const versionedDelivery = {
      type: "delivery",
      eligibleUserIds,
      isTrulyNewRotation: false,
      versionedState: {
        rotation: rotation("delivery", eligibleUserIds),
        revision: "state-r1",
        digest: "state-d1",
        provenance: "firestore:rotation-state",
      },
    };
    const fromState = resolveShiftRotationBootstrap(versionedDelivery);
    assert.equal(fromState.source, "versionedState");
  },
);

test("keeps delivery and market bootstrap independent", () => {
  const eligibleUserIds = ["a", "b", "c"];
  const delivery = resolveShiftRotationBootstrap({
    type: "delivery",
    eligibleUserIds,
    isTrulyNewRotation: false,
    approvedMapping: mapping("delivery", ["a", "b", "c"]),
    legacyDeliveryHelper: uniqueHelper("a"),
  });
  const market = resolveShiftRotationBootstrap({
    type: "market",
    eligibleUserIds,
    isTrulyNewRotation: false,
    approvedMapping: mapping("market", ["c", "b", "a"]),
    legacyDeliveryHelper: {
      kind: "ambiguous",
      candidateUserIds: ["a", "b"],
      evidenceDigest: "delivery-only-evidence",
    },
  });
  assert.deepEqual(delivery.rotation.cohortUserIds, ["a", "b", "c"]);
  assert.deepEqual(market.rotation.cohortUserIds, ["c", "b", "a"]);
  assert.equal(
    market.rotation.cohortUserIds[market.rotation.nextMemberIndex],
    "c",
  );
});
