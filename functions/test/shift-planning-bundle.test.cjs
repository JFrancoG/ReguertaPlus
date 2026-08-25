const assert = require("node:assert/strict");
const {test} = require("node:test");
const {Timestamp} = require("firebase-admin/firestore");

const {
  parseShiftPlanningExpectedState,
  planShiftPlanningBundle,
} = require("../lib/shift-planning-bundle.js");
const {
  buildShiftPlanningAuthoritativeState,
} = require("../lib/shift-planning-state-persistence.js");
const {
  createShiftPlanningDigest,
} = require("../lib/shift-planning-digest.js");
const {
  buildShiftPlanningCandidatePositionSet,
  parseShiftPlanningCandidatePosition,
} = require("../lib/shift-planning-candidate.js");

const memberIds = Array.from(
  {length: 6},
  (_, index) => `member-${index + 1}`,
);

const activeDigest = `shift-planning:v1:sha256:${"d".repeat(64)}`;

const rotation = (type, cohortUserIds) => ({
  schemaVersion: 1,
  type,
  stateRevision: type === "delivery" ? 4 : 7,
  cursor: {
    schemaVersion: 1,
    type,
    cohortUserIds,
    roundNumber: 1,
    nextMemberIndex: 0,
  },
  planningFrontierSeasonStartYear: 2026,
  cohortFrozen: false,
  frozenCohortUserIds: [],
  activeRevision: "active-6",
  activeDigest,
  lastIdempotencyKey: null,
  migrationBaseline: null,
  releaseLease: null,
});

const fairnessSnapshot = () => ({
  snapshotVersion: 1,
  environment: "develop",
  writeEpoch: 7,
  activeRevision: "active-6",
  activeDigest,
  membership: {
    revision: "membership-12",
    digest: "membership-digest-12",
  },
  roster: memberIds.map((userId, index) => ({
    userId,
    roles: index === 0 ? ["admin", "member"] : ["member"],
    isActive: true,
    isCommonPurchaseManager: false,
    membershipRevision: index + 1,
    eligibilityRevision: 20 + index,
    destinationRevision: 40 + index,
  })),
  rotations: {
    delivery: rotation("delivery", memberIds),
    market: rotation("market", [
      "member-3",
      "member-2",
      "member-1",
      "member-6",
      "member-5",
      "member-4",
    ]),
  },
  config: {
    revision: "config-3",
    policyRevision: "hu-082-v1",
    deliveryWeekday: "THU",
    timeZone: "Europe/Madrid",
    releaseLeaseDurationMillis: 900_000,
  },
  calendar: {
    revision: "calendar-9",
    deliveryOverrideRevision: "delivery-calendar-2",
    marketCalendarRevision: "market-calendar-1",
  },
  overrides: {
    revision: "overrides-2",
    digest: "overrides-digest-2",
  },
  creditLedger: {
    enabled: false,
    revision: "credits-disabled-v1",
    digest: "credits-disabled-digest-v1",
    plannedWriteCount: 0,
  },
  sync: {
    leaseDurationMillis: 120_000,
    transactionMeasurementAuthority: {
      adapterRevision: "firestore-adapter-v1",
      indexConfigurationDigest:
        `shift-planning:v1:sha256:${"1".repeat(64)}`,
    },
    partitions: {
      delivery: {
        workbookId: "reguerta-shifts",
        workbookRevision: "workbook-3",
        partitionKey: "delivery",
        stateRevision: 3,
        epoch: 11,
        lease: null,
      },
      market: {
        workbookId: "reguerta-shifts",
        workbookRevision: "workbook-3",
        partitionKey: "market",
        stateRevision: 5,
        epoch: 14,
        lease: null,
      },
    },
  },
  migrationBaseline: null,
});

const maintenanceState = (snapshot, overrides = {}) => ({
  schemaVersion: 1,
  stateRevision: 11,
  writeEpoch: snapshot.writeEpoch,
  maintenanceStatus: "closed",
  activeRevision: snapshot.activeRevision,
  activeDigest: snapshot.activeDigest,
  intakeBarrier: {
    revision: "barrier-v1",
    digest: `shift-planning:v1:sha256:${"a".repeat(64)}`,
    verifiedAtMillis: 1_782_643_100_000,
  },
  lastTransitionId: "maintenance-enter-1",
  ...overrides,
});

const authoritativeState = (snapshot, maintenanceOverrides = {}) =>
  buildShiftPlanningAuthoritativeState({
    environment: snapshot.environment,
    maintenance: maintenanceState(snapshot, maintenanceOverrides),
    rotations: snapshot.rotations,
  });

const request = (overrides = {}) => ({
  schemaVersion: 2,
  requestId: "request-preview-2026",
  bundleId: "bundle-2026",
  environment: "develop",
  requestedByUserId: "admin-1",
  requestedAt: Timestamp.fromMillis(1_782_643_200_000),
  mode: "preview",
  status: "requested",
  expectedWriteEpoch: 7,
  expectedActiveRevision: "active-6",
  subplans: {
    delivery: {targetSeasonStartYear: 2026},
    market: {targetSeasonStartYear: 2026},
  },
  binding: null,
  ...overrides,
});

const bundleInput = (overrides = {}) => {
  const snapshot = overrides.fairnessSnapshot ?? fairnessSnapshot();
  return {
    request: request(),
    authoritativeState:
      overrides.authoritativeState ?? authoritativeState(snapshot),
    fairnessSnapshot: snapshot,
    delivery: {continuity: {kind: "newRotation"}},
    market: {},
    transactionWriteLimit: 500,
    ...overrides,
  };
};

const errorCode = (expectedCode) => (error) =>
  error instanceof Error && error.code === expectedCode;

const previewBinding = (result) => ({
  kind: "preview",
  sourceRequestId: result.requestId,
  bundleRevision: result.bundleRevision,
  bundleDigest: result.bundleDigest,
});

const candidateBinding = (result) => ({
  kind: "candidate",
  candidateId: result.bundleId,
  bundleRevision: result.bundleRevision,
  bundleDigest: result.bundleDigest,
  candidateDigest: result.stagedCandidateDigest || result.bundleDigest,
});

const transactionEvidence = (result, overrides = {}) => ({
  schemaVersion: 2,
  forward: {
    schemaVersion: 2,
    direction: "forward",
    manifestDigest: result.transactionRequirements.forwardManifestDigest,
    documentWriteCount: result.budgets.forward.totalWrites,
    fieldTransformCount: 0,
    requestByteCount: 250_000,
    adapterRevision: "firestore-adapter-v1",
    indexConfigurationDigest:
      `shift-planning:v1:sha256:${"1".repeat(64)}`,
    ...overrides.forward,
  },
  inverse: {
    schemaVersion: 2,
    direction: "inverse",
    manifestDigest: result.transactionRequirements.inverseManifestDigest,
    documentWriteCount: result.budgets.inverse.totalWrites,
    fieldTransformCount: 0,
    requestByteCount: 250_000,
    adapterRevision: "firestore-adapter-v1",
    indexConfigurationDigest:
      `shift-planning:v1:sha256:${"1".repeat(64)}`,
    ...overrides.inverse,
  },
});

const stageFromPreview = (preview, overrides = {}) => planShiftPlanningBundle(
  bundleInput({
    request: request({
      requestId: "request-stage-2026",
      requestedAt: Timestamp.fromMillis(1_782_643_260_000),
      mode: "stage",
      binding: previewBinding(preview),
    }),
    persistedPreview: preview.previewReceipt,
    transactionEvidence: transactionEvidence(preview),
    ...overrides,
  }),
);

test("plans both independent frontiers into one side-effect-free preview", () => {
  const result = planShiftPlanningBundle(bundleInput());

  assert.equal(result.mode, "preview");
  assert.match(
    result.bundleDigest,
    /^shift-planning:v1:sha256:[a-f0-9]{64}$/,
  );
  assert.equal(result.schemaVersion, 2);
  assert.match(result.bundleRevision, /^bundle-v2-[a-f0-9]{24}$/);
  assert.equal(result.delivery.shifts[0].assignedUserIds[0], "member-1");
  assert.deepEqual(result.market.shifts[0].assignedUserIds, [
    "member-3",
    "member-2",
    "member-1",
  ]);
  assert.equal(result.delivery.shifts.every((shift) =>
    shift.source === "app" &&
    shift.origin === "planner" &&
    shift.planningRequestId === "bundle-2026"
  ), true);
  assert.deepEqual(result.syncCommands.map((command) => command.type), [
    "delivery",
    "market",
  ]);
  assert.deepEqual(
    result.syncCommands.map((command) => [
      command.expectedPartitionEpoch,
      command.commandPartitionEpoch,
      command.leaseIntent.leaseEpoch,
    ]),
    [[11, 12, 12], [14, 15, 15]],
  );
  assert.equal(result.syncCommands.every((command) =>
    command.bundleDigest === result.bundleDigest &&
    command.writeEpoch === 8 &&
    command.workbookId === "reguerta-shifts" &&
    command.expectedCurrentLease === null &&
    command.expectedActiveRevision === result.bundleRevision &&
    command.expectedActiveDigest === result.bundleDigest
  ), true);
  assert.deepEqual(
    [...new Set(result.heldNotificationIntents.map(
      (intent) => intent.recipientUserId,
    ))],
    memberIds,
  );
  assert.equal(result.heldNotificationIntents.every((intent) =>
    intent.state === "held" &&
    intent.bundleDigest === result.bundleDigest &&
    intent.expectedAssignmentRevision === 1 &&
    intent.expectedMembershipRevision >= 1 &&
    intent.expectedEligibilityRevision >= 20 &&
    intent.expectedDestinationRevision >= 40 &&
    intent.payloadPolicy === "genericReferenceOnly"
  ), true);
  assert.equal(
    result.budgets.forward.heldIntentWrites,
    result.heldNotificationIntents.length,
  );
  assert.equal(
    result.budgets.forward.totalWrites <=
      result.budgets.forward.writeLimit,
    true,
  );
  assert.deepEqual(result.expectedState, {
    schemaVersion: 2,
    authoritativeState: authoritativeState(fairnessSnapshot()),
    transactionMeasurementAuthority: {
      adapterRevision: "firestore-adapter-v1",
      indexConfigurationDigest:
        `shift-planning:v1:sha256:${"1".repeat(64)}`,
    },
  });
  const expectedStateDigest = createShiftPlanningDigest(result.expectedState);
  for (const manifest of [
    result.manifests.forward,
    result.manifests.inverse,
  ]) {
    assert.equal(manifest.expectedStateDigest, expectedStateDigest);
    assert.equal(
      manifest.expectedAuthoritativeDigest,
      result.expectedState.authoritativeState.authoritativeDigest,
    );
  }
  assert.deepEqual(result.manifests.forward.activeState, {
    stateRevisionBefore: 11,
    stateRevisionAfter: 12,
    writeEpochBefore: 7,
    writeEpochAfter: 8,
    activeRevisionBefore: "active-6",
  });
  const maintenanceBeforeImage = result.manifests.inverse.restoreBeforeImages
    .find(({targetPath}) =>
      targetPath.endsWith("/shiftPlanningState/current"));
  assert.equal(
    maintenanceBeforeImage.captureContractDigest,
    createShiftPlanningDigest(
      result.expectedState.authoritativeState.maintenance,
    ),
  );
  assert.equal(
    result.frontiers.delivery.frontierBefore.seasonStartYear,
    2026,
  );
  assert.equal(
    result.frontiers.delivery.frontierAfter.seasonStartYear,
    2027,
  );
  assert.equal(result.frontiers.market.frontierAfter.seasonStartYear, 2027);
  assert.equal(result.releaseLeaseIntents.length, 2);
  assert.deepEqual(
    result.releaseLeaseIntents.map((intent) => intent.type),
    ["delivery", "market"],
  );
  assert.equal(result.releaseLeaseIntents.every((intent) =>
    intent.state === "sealed" &&
    intent.bundleDigest === result.bundleDigest &&
    intent.deadlinePolicy.durationMillis === 900_000
  ), true);
  assert.equal(result.manifests.inverse.requiresPersistedBeforeImages, true);
  for (const budget of [result.budgets.forward, result.budgets.inverse]) {
    assert.equal(budget.bundleMetadataWrites, 0);
    assert.equal(
      budget.totalWrites,
      budget.createWrites + budget.updateWrites + budget.deleteWrites,
    );
    assert.equal(
      budget.totalWrites,
      budget.publicShiftWrites +
        budget.predecessorHelperWrites +
        budget.rotationWrites +
        budget.activeStateWrites +
        budget.bundleMetadataWrites +
        budget.requestWrites +
        budget.stagedCandidateWrites +
        budget.syncCommandWrites +
        budget.operationRegistryWrites +
        budget.beforeImageWrites +
        budget.heldIntentWrites +
        budget.creditLedgerWrites,
    );
    assert.deepEqual(budget.byteEstimate, {
      status: "requiresPersistenceAdapter",
      estimatedBytes: null,
      configuredByteLimit: 10 * 1024 * 1024,
    });
  }
  const forward = result.budgets.forward;
  assert.equal(
    forward.createWrites,
    forward.publicShiftWrites + forward.syncCommandWrites +
      forward.beforeImageWrites + forward.heldIntentWrites,
  );
  assert.equal(
    forward.updateWrites,
    forward.predecessorHelperWrites + forward.rotationWrites +
      forward.activeStateWrites + forward.requestWrites +
      forward.stagedCandidateWrites + forward.operationRegistryWrites +
      forward.creditLedgerWrites,
  );
  assert.equal(forward.deleteWrites, 0);
  const inverse = result.budgets.inverse;
  assert.equal(inverse.createWrites, 0);
  assert.equal(
    inverse.updateWrites,
    inverse.predecessorHelperWrites + inverse.rotationWrites +
      inverse.activeStateWrites + inverse.requestWrites +
      inverse.stagedCandidateWrites + inverse.operationRegistryWrites +
      inverse.creditLedgerWrites,
  );
  assert.equal(
    inverse.deleteWrites,
    inverse.publicShiftWrites + inverse.syncCommandWrites +
      inverse.heldIntentWrites,
  );
  assert.equal(result.manifests.inverse.bundleMetadataUpdates, 0);
  assert.equal(
    result.budgets.forward.beforeImageWrites,
    result.manifests.inverse.restoreBeforeImages.length,
  );
  assert.equal(result.budgets.inverse.beforeImageWrites, 0);
  assert.equal(result.transactionEvidence, null);
  assert.equal(result.stagedCandidate, null);
  assert.equal(result.previewReceipt.requestId, result.requestId);
  assert.match(
    result.previewReceiptDigest,
    /^shift-planning:v1:sha256:[a-f0-9]{64}$/,
  );
  assert.equal(
    result.manifests.inverse.deleteCreatedDocuments.some(
      ({pathTemplate}) => pathTemplate.includes("shift_market_"),
    ),
    true,
  );
  assert.equal(
    result.manifests.inverse.deleteCreatedDocuments.some(
      ({pathTemplate}) => pathTemplate.includes("shiftPlanningBundles"),
    ),
    false,
  );
  assert.equal(
    result.manifests.inverse.restoreBeforeImages.some(
      ({targetPath}) => targetPath.includes("shiftPlanningBundles"),
    ),
    false,
  );
  assert.equal(
    result.manifests.inverse.recoveryWriteEpoch.minimumExclusiveEpoch,
    8,
  );
  const recoveryPaths = [
    ...result.manifests.inverse.deleteCreatedDocuments.map(
      ({pathTemplate}) => pathTemplate,
    ),
    ...result.manifests.inverse.restoreBeforeImages.flatMap((beforeImage) => [
      beforeImage.targetPath,
      beforeImage.beforeImagePathTemplate,
    ]),
  ];
  assert.equal(
    recoveryPaths.includes(
      "develop/plus-collections/shiftPlanningState/current",
    ),
    true,
  );
  assert.equal(
    recoveryPaths.some((path) =>
      path.includes("/shiftPlanningState/global")
    ),
    false,
  );
});

test("normalizes roster query and role order in the combined digest", () => {
  const baseline = planShiftPlanningBundle(bundleInput());
  const reordered = fairnessSnapshot();
  reordered.roster = reordered.roster.reverse().map((member) => ({
    ...member,
    roles: [...member.roles].reverse(),
  }));
  const result = planShiftPlanningBundle(bundleInput({
    fairnessSnapshot: reordered,
  }));

  assert.equal(result.bundleDigest, baseline.bundleDigest);
  assert.equal(result.bundleRevision, baseline.bundleRevision);
  assert.deepEqual(result.delivery.shifts, baseline.delivery.shifts);
  assert.deepEqual(result.market.shifts, baseline.market.shifts);
});

test("parses only one exact v2 expected authoritative state", () => {
  const expectedState = planShiftPlanningBundle(bundleInput()).expectedState;
  assert.deepEqual(
    parseShiftPlanningExpectedState(structuredClone(expectedState)),
    expectedState,
  );

  for (const invalid of [
    {...structuredClone(expectedState), schemaVersion: 1},
    {...structuredClone(expectedState), unexpected: true},
    {
      ...structuredClone(expectedState),
      transactionMeasurementAuthority: {
        ...expectedState.transactionMeasurementAuthority,
        unexpected: true,
      },
    },
    {
      ...structuredClone(expectedState),
      authoritativeState: {
        ...expectedState.authoritativeState,
        authoritativeDigest:
          `shift-planning:v1:sha256:${"0".repeat(64)}`,
      },
    },
  ]) {
    assert.throws(
      () => parseShiftPlanningExpectedState(invalid),
      errorCode("invalid_planning_state"),
    );
  }
});

test("requires fairness state to equal the exact authoritative read-set", () => {
  const snapshot = fairnessSnapshot();
  const captured = authoritativeState(snapshot);
  snapshot.rotations.delivery.lastIdempotencyKey = "other-operation";

  assert.throws(
    () => planShiftPlanningBundle(bundleInput({
      authoritativeState: captured,
      fairnessSnapshot: snapshot,
    })),
    errorCode("invalid_planning_state"),
  );

  const forged = structuredClone(captured);
  forged.authoritativeDigest =
    `shift-planning:v1:sha256:${"0".repeat(64)}`;
  assert.throws(
    () => planShiftPlanningBundle(bundleInput({authoritativeState: forged})),
    errorCode("invalid_planning_state"),
  );
});

test("binds maintenance and aggregate-only drift into state and manifests", () => {
  const baseline = planShiftPlanningBundle(bundleInput());
  const maintenanceSnapshot = fairnessSnapshot();
  const changedMaintenance = planShiftPlanningBundle(bundleInput({
    fairnessSnapshot: maintenanceSnapshot,
    authoritativeState: authoritativeState(maintenanceSnapshot, {
      intakeBarrier: {
        revision: "barrier-v2",
        digest: `shift-planning:v1:sha256:${"b".repeat(64)}`,
        verifiedAtMillis: 1_782_643_110_000,
      },
      lastTransitionId: "maintenance-enter-2",
    }),
  }));
  const aggregateSnapshot = fairnessSnapshot();
  aggregateSnapshot.rotations.market.lastIdempotencyKey = "rotation-market-8";
  const changedAggregate = planShiftPlanningBundle(bundleInput({
    fairnessSnapshot: aggregateSnapshot,
  }));

  for (const changed of [changedMaintenance, changedAggregate]) {
    assert.notEqual(
      createShiftPlanningDigest(changed.expectedState),
      createShiftPlanningDigest(baseline.expectedState),
    );
    assert.notEqual(
      changed.transactionRequirements.forwardManifestDigest,
      baseline.transactionRequirements.forwardManifestDigest,
    );
    assert.notEqual(
      changed.transactionRequirements.inverseManifestDigest,
      baseline.transactionRequirements.inverseManifestDigest,
    );
    assert.notEqual(changed.bundleDigest, baseline.bundleDigest);
    assert.notEqual(changed.bundleRevision, baseline.bundleRevision);
  }
});

test("allows open preview but requires a closed-state re-preview for stage", () => {
  const openSnapshot = fairnessSnapshot();
  const openState = authoritativeState(openSnapshot, {
    maintenanceStatus: "open",
    intakeBarrier: null,
    lastTransitionId: "maintenance-abort-1",
  });
  const openPreview = planShiftPlanningBundle(bundleInput({
    authoritativeState: openState,
    fairnessSnapshot: openSnapshot,
  }));
  assert.equal(openPreview.mode, "preview");
  assert.throws(
    () => stageFromPreview(openPreview, {
      authoritativeState: openState,
      fairnessSnapshot: openSnapshot,
    }),
    errorCode("maintenance_state_conflict"),
  );

  const closedSnapshot = fairnessSnapshot();
  closedSnapshot.writeEpoch = 8;
  const closedState = authoritativeState(closedSnapshot, {
    stateRevision: 12,
    lastTransitionId: "maintenance-enter-2",
  });
  assert.throws(
    () => planShiftPlanningBundle(bundleInput({
      request: request({
        requestId: "request-stage-after-entry",
        expectedWriteEpoch: 8,
        mode: "stage",
        binding: previewBinding(openPreview),
      }),
      authoritativeState: closedState,
      fairnessSnapshot: closedSnapshot,
      persistedPreview: openPreview.previewReceipt,
      transactionEvidence: transactionEvidence(openPreview),
    })),
    errorCode("preview_binding_mismatch"),
  );

  const closedPreview = planShiftPlanningBundle(bundleInput({
    request: request({
      requestId: "request-preview-after-entry",
      expectedWriteEpoch: 8,
    }),
    authoritativeState: closedState,
    fairnessSnapshot: closedSnapshot,
  }));
  assert.doesNotThrow(() => planShiftPlanningBundle(bundleInput({
    request: request({
      requestId: "request-stage-after-repreview",
      expectedWriteEpoch: 8,
      mode: "stage",
      binding: previewBinding(closedPreview),
    }),
    authoritativeState: closedState,
    fairnessSnapshot: closedSnapshot,
    persistedPreview: closedPreview.previewReceipt,
    transactionEvidence: transactionEvidence(closedPreview),
  })));
});

test("binds active lineage and transaction policy into the bundle digest", () => {
  const baseline = planShiftPlanningBundle(bundleInput());
  const changedLineage = fairnessSnapshot();
  const nextActiveDigest = `shift-planning:v1:sha256:${"e".repeat(64)}`;
  changedLineage.activeDigest = nextActiveDigest;
  changedLineage.rotations.delivery.activeDigest = nextActiveDigest;
  changedLineage.rotations.market.activeDigest = nextActiveDigest;

  const lineageResult = planShiftPlanningBundle(bundleInput({
    fairnessSnapshot: changedLineage,
  }));
  const policyResult = planShiftPlanningBundle(bundleInput({
    transactionWriteLimit: 499,
  }));

  assert.notEqual(lineageResult.bundleDigest, baseline.bundleDigest);
  assert.notEqual(policyResult.bundleDigest, baseline.bundleDigest);
});

test("advances over future market projections completed by overflow", () => {
  const ids = Array.from(
    {length: 100},
    (_, index) => `large-member-${index + 1}`,
  );
  const snapshot = fairnessSnapshot();
  snapshot.roster = ids.map((userId) => ({
    userId,
    roles: ["member"],
    isActive: true,
    isCommonPurchaseManager: false,
    membershipRevision: 1,
    eligibilityRevision: 1,
    destinationRevision: 1,
  }));
  snapshot.rotations.delivery = rotation("delivery", ids);
  snapshot.rotations.market = rotation("market", ids);

  const result = planShiftPlanningBundle(bundleInput({
    fairnessSnapshot: snapshot,
  }));

  assert.equal(result.frontiers.delivery.frontierAfter.seasonStartYear, 2027);
  assert.equal(result.frontiers.market.frontierAfter.seasonStartYear, 2029);
});

test("requires each explicit target to equal its independent frontier", () => {
  assert.throws(
    () => planShiftPlanningBundle(bundleInput({
      request: request({
        subplans: {
          delivery: {targetSeasonStartYear: 2025},
          market: {targetSeasonStartYear: 2026},
        },
      }),
    })),
    errorCode("invalid_planning_frontier"),
  );
  assert.throws(
    () => planShiftPlanningBundle(bundleInput({
      request: request({
        subplans: {
          delivery: {targetSeasonStartYear: 2026},
          market: {targetSeasonStartYear: 2027},
        },
      }),
    })),
    errorCode("invalid_planning_frontier"),
  );
});

test("returns no bundle when either pure subplan fails", () => {
  const snapshot = fairnessSnapshot();
  snapshot.roster = snapshot.roster.slice(0, 2);
  snapshot.rotations.delivery = rotation("delivery", memberIds.slice(0, 2));
  snapshot.rotations.market = rotation("market", memberIds.slice(0, 2));

  assert.throws(
    () => planShiftPlanningBundle(bundleInput({fairnessSnapshot: snapshot})),
    errorCode("insufficient_market_members"),
  );
});

test("binds stage and activate to the exact deterministic candidate", () => {
  const preview = planShiftPlanningBundle(bundleInput());
  const stage = stageFromPreview(preview);
  const activate = planShiftPlanningBundle(bundleInput({
    request: request({
      requestId: "request-activate-2026",
      requestedAt: Timestamp.fromMillis(1_782_643_320_000),
      mode: "activate",
      binding: candidateBinding(stage),
    }),
    stagedCandidate: stage.stagedCandidate,
  }));

  assert.equal(stage.bundleRevision, preview.bundleRevision);
  assert.equal(stage.bundleDigest, preview.bundleDigest);
  assert.equal(activate.bundleRevision, preview.bundleRevision);
  assert.equal(activate.bundleDigest, preview.bundleDigest);
  assert.equal(stage.stagedCandidate.sourcePreviewRequestId, preview.requestId);
  assert.equal(
    activate.stagedCandidateDigest,
    stage.stagedCandidateDigest,
  );
  assert.equal(preview.previewReceipt.schemaVersion, 2);
  assert.equal(stage.stagedCandidate.schemaVersion, 2);
  assert.equal(
    stage.stagedCandidate.positionManifest.positionDocumentCount,
    stage.delivery.shifts.length + stage.market.shifts.length,
  );
  assert.equal(
    stage.stagedCandidate.positionManifest.assignmentPositionCount,
    stage.delivery.shifts.length + (stage.market.shifts.length * 3),
  );
  assert.match(
    stage.stagedCandidate.positionManifest.positionSetDigest,
    /^shift-planning:v1:sha256:[a-f0-9]{64}$/,
  );
  const positionSet = buildShiftPlanningCandidatePositionSet({
    candidateId: stage.bundleId,
    bundleRevision: stage.bundleRevision,
    bundleDigest: stage.bundleDigest,
    writeEpoch: stage.activationWriteEpoch,
    delivery: stage.delivery,
    market: stage.market,
  });
  const deliveryPosition = positionSet.positions.find(
    ({type}) => type === "delivery",
  );
  assert.ok(deliveryPosition);
  assert.throws(
    () => parseShiftPlanningCandidatePosition({
      ...deliveryPosition,
      positionId: "shift_delivery_20260230",
      shiftId: "shift_delivery_20260230",
      scheduledDate: "2026-02-30",
    }),
    errorCode("candidate_binding_mismatch"),
  );
  assert.throws(
    () => parseShiftPlanningCandidatePosition({
      ...deliveryPosition,
      positionId: "shift_delivery_alias",
      shiftId: "shift_delivery_alias",
    }),
    errorCode("candidate_binding_mismatch"),
  );
  assert.equal(stage.transactionEvidence.schemaVersion, 2);
  assert.equal(stage.transactionEvidence.forward.schemaVersion, 2);
  assert.equal(stage.transactionEvidence.inverse.schemaVersion, 2);

  const tamperedCandidate = {
    ...stage.stagedCandidate,
    positionManifest: {
      ...stage.stagedCandidate.positionManifest,
      positionDocumentCount:
        stage.stagedCandidate.positionManifest.positionDocumentCount + 1,
    },
  };
  assert.throws(
    () => planShiftPlanningBundle(bundleInput({
      request: request({
        requestId: "request-activate-tampered-positions",
        mode: "activate",
        binding: {
          ...candidateBinding(stage),
          candidateDigest: createShiftPlanningDigest(tamperedCandidate),
        },
      }),
      stagedCandidate: tamperedCandidate,
    })),
    errorCode("candidate_binding_mismatch"),
  );

  const drifted = fairnessSnapshot();
  drifted.overrides.revision = "overrides-3";
  assert.throws(
    () => planShiftPlanningBundle(bundleInput({
      request: request({
        requestId: "request-stage-drifted",
        mode: "stage",
        binding: previewBinding(preview),
      }),
      fairnessSnapshot: drifted,
      persistedPreview: preview.previewReceipt,
      transactionEvidence: transactionEvidence(preview),
    })),
    errorCode("preview_binding_mismatch"),
  );

  assert.throws(
    () => planShiftPlanningBundle(bundleInput({
      request: request({
        requestId: "request-activate-drifted",
        mode: "activate",
        binding: candidateBinding(stage),
      }),
      fairnessSnapshot: drifted,
      stagedCandidate: stage.stagedCandidate,
    })),
    errorCode("candidate_binding_mismatch"),
  );
});

test("requires persisted preview and stage records in the exact mode chain", () => {
  const preview = planShiftPlanningBundle(bundleInput());
  assert.throws(
    () => planShiftPlanningBundle(bundleInput({
      request: request({
        requestId: "request-stage-without-preview",
        mode: "stage",
        binding: previewBinding(preview),
      }),
    })),
    errorCode("preview_binding_mismatch"),
  );

  assert.throws(
    () => planShiftPlanningBundle(bundleInput({
      request: request({
        requestId: "request-activate-without-stage",
        mode: "activate",
        binding: {
          kind: "candidate",
          candidateId: preview.bundleId,
          bundleRevision: preview.bundleRevision,
          bundleDigest: preview.bundleDigest,
          candidateDigest: preview.bundleDigest,
        },
      }),
    })),
    errorCode("candidate_binding_mismatch"),
  );

  const stage = stageFromPreview(preview);
  const tamperedCandidate = structuredClone(stage.stagedCandidate);
  tamperedCandidate.sourceStageRequestId = "another-stage";
  assert.throws(
    () => planShiftPlanningBundle(bundleInput({
      request: request({
        requestId: "request-activate-tampered-stage",
        mode: "activate",
        binding: candidateBinding(stage),
      }),
      stagedCandidate: tamperedCandidate,
    })),
    errorCode("candidate_binding_mismatch"),
  );
});

test("requires measured forward and inverse transaction budgets before stage", () => {
  const preview = planShiftPlanningBundle(bundleInput());
  assert.throws(
    () => stageFromPreview(preview, {
      transactionEvidence: transactionEvidence(preview, {
        forward: {requestByteCount: 10 * 1024 * 1024 + 1},
      }),
    }),
    errorCode("planning_bundle_oversize"),
  );
  assert.throws(
    () => stageFromPreview(preview, {
      transactionEvidence: transactionEvidence(preview, {
        inverse: {
          documentWriteCount: preview.budgets.inverse.totalWrites + 1,
        },
      }),
    }),
    errorCode("planning_bundle_oversize"),
  );
  assert.throws(
    () => planShiftPlanningBundle(bundleInput({transactionWriteLimit: 501})),
    errorCode("invalid_planning_state"),
  );

  const changedAuthority = fairnessSnapshot();
  changedAuthority.sync.transactionMeasurementAuthority.adapterRevision =
    "firestore-adapter-v2";
  const authorityPreview = planShiftPlanningBundle(bundleInput({
    fairnessSnapshot: changedAuthority,
  }));
  assert.throws(
    () => stageFromPreview(authorityPreview, {
      fairnessSnapshot: changedAuthority,
    }),
    errorCode("planning_bundle_oversize"),
  );
});

test("rejects credit transitions until HU-084 supplies exact manifests", () => {
  const snapshot = fairnessSnapshot();
  snapshot.creditLedger.enabled = true;
  snapshot.creditLedger.plannedWriteCount = 1;

  assert.throws(
    () => planShiftPlanningBundle(bundleInput({fairnessSnapshot: snapshot})),
    errorCode("invalid_planning_state"),
  );
});

test("advances a frontier over externally prefilled complete projections", () => {
  const result = planShiftPlanningBundle(bundleInput({
    market: {
      futureProjectionOccupancy: [{
        seasonStartYear: 2027,
        occupiedPositionCount: 30,
        lineageRevision: "market-projection-2027-v1",
        lineageDigest: `shift-planning:v1:sha256:${"7".repeat(64)}`,
      }],
    },
  }));

  assert.equal(result.frontiers.market.frontierAfter.seasonStartYear, 2028);
  assert.throws(
    () => planShiftPlanningBundle(bundleInput({
      delivery: {
        continuity: {kind: "newRotation"},
        futureProjectionOccupancy: [{
          seasonStartYear: 2027,
          occupiedPositionCount: 1,
          lineageRevision: "delivery-projection-2027-v1",
          lineageDigest: `shift-planning:v1:sha256:${"8".repeat(64)}`,
        }],
      },
    })),
    errorCode("invalid_planning_state"),
  );
});

test("freezes only a boundary-active cohort in the activation manifest", () => {
  const ids = memberIds.slice(0, 4);
  const snapshot = fairnessSnapshot();
  snapshot.roster = snapshot.roster.slice(0, 4);
  snapshot.rotations.delivery = rotation("delivery", ids);
  snapshot.rotations.market = rotation("market", ids);

  const result = planShiftPlanningBundle(bundleInput({
    fairnessSnapshot: snapshot,
  }));

  assert.equal(result.manifests.forward.rotations.delivery.cohortFrozenAfter, false);
  assert.deepEqual(
    result.manifests.forward.rotations.delivery.frozenCohortUserIdsAfter,
    [],
  );
  assert.equal(result.manifests.forward.rotations.market.cohortFrozenAfter, true);
  assert.deepEqual(
    result.manifests.forward.rotations.market.frozenCohortUserIdsAfter,
    ids,
  );
});

test("requires persisted cohort freeze to match the cursor boundary", () => {
  const boundary = fairnessSnapshot();
  assert.doesNotThrow(() => planShiftPlanningBundle(bundleInput({
    fairnessSnapshot: boundary,
  })));

  const withinRound = fairnessSnapshot();
  withinRound.rotations.market.cursor.nextMemberIndex = 1;
  withinRound.rotations.market.cohortFrozen = true;
  withinRound.rotations.market.frozenCohortUserIds = [
    ...withinRound.rotations.market.cursor.cohortUserIds,
  ];
  assert.doesNotThrow(() => planShiftPlanningBundle(bundleInput({
    fairnessSnapshot: withinRound,
  })));

  const frozenAtBoundary = structuredClone(withinRound);
  frozenAtBoundary.rotations.market.cursor.nextMemberIndex = 0;
  assert.throws(
    () => planShiftPlanningBundle(bundleInput({
      fairnessSnapshot: frozenAtBoundary,
    })),
    errorCode("invalid_planning_state"),
  );

  const unfrozenWithinRound = fairnessSnapshot();
  unfrozenWithinRound.rotations.market.cursor.nextMemberIndex = 1;
  assert.throws(
    () => planShiftPlanningBundle(bundleInput({
      fairnessSnapshot: unfrozenWithinRound,
    })),
    errorCode("invalid_planning_state"),
  );
});

test("requires one exact migration baseline across bundle and rotations", () => {
  const baseline = {
    revision: "baseline-2026-v1",
    digest: `shift-planning:v1:sha256:${"9".repeat(64)}`,
  };
  const valid = fairnessSnapshot();
  valid.migrationBaseline = baseline;
  valid.rotations.delivery.migrationBaseline = baseline;
  valid.rotations.market.migrationBaseline = baseline;
  assert.doesNotThrow(() => planShiftPlanningBundle(bundleInput({
    fairnessSnapshot: valid,
  })));

  const orphaned = structuredClone(valid);
  orphaned.rotations.market.migrationBaseline = null;
  assert.throws(
    () => planShiftPlanningBundle(bundleInput({fairnessSnapshot: orphaned})),
    errorCode("invalid_planning_state"),
  );
});

test("allows preview but blocks stage and activate on frozen-cohort drift", () => {
  const snapshot = fairnessSnapshot();
  snapshot.roster.at(-1).isActive = false;
  snapshot.rotations.delivery = rotation(
    "delivery",
    memberIds.slice(0, -1),
  );
  snapshot.rotations.market.cursor.nextMemberIndex = 1;
  snapshot.rotations.market.cohortFrozen = true;
  snapshot.rotations.market.frozenCohortUserIds = [
    ...snapshot.rotations.market.cursor.cohortUserIds,
  ];
  const preview = planShiftPlanningBundle(bundleInput({
    fairnessSnapshot: snapshot,
  }));

  for (const mode of ["stage", "activate"]) {
    const binding = mode === "stage" ?
      previewBinding(preview) : candidateBinding(preview);
    assert.throws(
      () => planShiftPlanningBundle(bundleInput({
        request: request({
          requestId: `request-${mode}-frozen-drift`,
          mode,
          binding,
        }),
        fairnessSnapshot: snapshot,
      })),
      errorCode("frozen_cohort_mismatch"),
    );
  }
});

test("allows preview but blocks stage and activate on a release lease", () => {
  const snapshot = fairnessSnapshot();
  snapshot.rotations.market.releaseLease = {
    type: "market",
    bundleId: "prior-bundle",
    bundleRevision: "bundle-v1-prior",
    bundleDigest: `shift-planning:v1:sha256:${"a".repeat(64)}`,
    leaseEpoch: 7,
    ownerOperationId: "release-worker-1",
    state: "releasing",
    acquiredAtMillis: 1_782_643_200_000,
    deadlineAtMillis: 1_782_643_260_000,
  };
  const preview = planShiftPlanningBundle(bundleInput({
    fairnessSnapshot: snapshot,
  }));

  for (const mode of ["stage", "activate"]) {
    const binding = mode === "stage" ?
      previewBinding(preview) : candidateBinding(preview);
    assert.throws(
      () => planShiftPlanningBundle(bundleInput({
        request: request({
          requestId: `request-${mode}-release-lease`,
          mode,
          binding,
        }),
        fairnessSnapshot: snapshot,
      })),
      errorCode("planning_release_lease_conflict"),
    );
  }
});

test("allows preview but blocks publication while a workbook partition is leased", () => {
  const snapshot = fairnessSnapshot();
  snapshot.sync.partitions.delivery.lease = {
    ownerOperationId: "prior-sync-command",
    leaseEpoch: 11,
    state: "releasing",
    acquiredAtMillis: 1_782_643_200_000,
    deadlineAtMillis: 1_782_643_260_000,
  };
  const preview = planShiftPlanningBundle(bundleInput({
    fairnessSnapshot: snapshot,
  }));

  assert.throws(
    () => planShiftPlanningBundle(bundleInput({
      request: request({
        requestId: "request-stage-sync-lease",
        mode: "stage",
        binding: previewBinding(preview),
      }),
      fairnessSnapshot: snapshot,
    })),
    errorCode("planning_release_lease_conflict"),
  );
});

test("fails closed when the combined activation manifest exceeds its limit", () => {
  assert.throws(
    () => planShiftPlanningBundle(bundleInput({transactionWriteLimit: 1})),
    errorCode("planning_bundle_oversize"),
  );
});

test("rejects request/state environment, epoch, and active-revision drift", () => {
  for (const [requestOverride, expectedCode] of [
    [{environment: "production"}, "invalid_planning_state"],
    [{expectedWriteEpoch: 8}, "stale_write_epoch"],
    [{expectedActiveRevision: "active-7"}, "stale_active_revision"],
  ]) {
    assert.throws(
      () => planShiftPlanningBundle(bundleInput({
        request: request(requestOverride),
      })),
      errorCode(expectedCode),
    );
  }
});

test("applies the exact raw v2 parser before any bundle planning", () => {
  assert.throws(
    () => planShiftPlanningBundle(bundleInput({
      request: {...request(), legacySeason: 2026},
    })),
    errorCode("invalid_planning_request"),
  );
  assert.throws(
    () => planShiftPlanningBundle(bundleInput({
      request: request({requestedAt: new Date()}),
    })),
    errorCode("invalid_planning_request"),
  );
});
