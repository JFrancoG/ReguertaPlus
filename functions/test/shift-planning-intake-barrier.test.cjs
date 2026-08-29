const assert = require("node:assert/strict");
const {test} = require("node:test");

const {
  createShiftPlanningDigest,
} = require("../lib/shift-planning-digest.js");
const {
  createShiftPlanningControlManifestDigest,
  enterShiftPlanningMaintenanceBehindIntakeBarrier,
  verifyShiftPlanningIntakeBarrierEvidence,
} = require("../lib/shift-planning-intake-barrier.js");
const {
  SHIFT_PLANNING_AFFECTED_WRITERS,
  SHIFT_PLANNING_INTAKE_BARRIER_WRITERS,
  SHIFT_PLANNING_RULES_DENIED_WRITER_IDS,
  SHIFT_PLANNING_WRITER_INVENTORY_DIGEST,
  SHIFT_PLANNING_WRITER_INVENTORY_REVISION,
} = require("../lib/shift-planning-writer-inventory.js");

const digest = (value) => createShiftPlanningDigest(value);
const activeDigest = digest({active: 4});
const authoritativeDigest = digest({authoritative: 7});
const rulesDigest = digest({rules: "hu082-barrier-r1"});
const workbookDigest = digest({workbook: "revision-19"});
const acceptedSetDigest = digest({acceptedEventIds: ["event-a", "event-b"]});

const command = () => ({
  environment: "develop",
  transitionId: "maintenance-entry-7",
  expectedAuthoritativeDigest: authoritativeDigest,
  expectedStateRevision: 6,
  expectedWriteEpoch: 11,
  expectedActiveRevision: "active-4",
  expectedActiveDigest: activeDigest,
  expectedBarrierRevision: "intake-barrier-7",
  expectedRulesRevision: "rules-hu082-r1",
  expectedRulesDigest: rulesDigest,
  expectedControlManifestDigest:
    createShiftPlanningControlManifestDigest(writerControls()),
  expectedWorkbookFileId: "workbook-develop-1",
  expectedWorkbookRevision: "workbook-r19",
  expectedWorkbookDigest: workbookDigest,
  expectedCausalSetRevision: "causal-set-7",
  expectedCausalSetDigest: acceptedSetDigest,
  minimumQuietHorizonMillis: 100,
  maximumEvidenceAgeMillis: 100,
});

const controlEvidence = (writer) => {
  const controlledByRules = writer.control === "rules-deny";
  return {
    writerId: writer.writerId,
    state: writer.requiredState,
    controlRevision: controlledByRules ?
      "rules-hu082-r1" : `${writer.writerId}-control-r1`,
    controlDigest: controlledByRules ?
      rulesDigest : digest({writerId: writer.writerId, revision: 1}),
    initialReadBackRevision: controlledByRules ?
      "rules-hu082-r1" : `${writer.writerId}-control-r1`,
    initialReadBackDigest: controlledByRules ?
      rulesDigest : digest({writerId: writer.writerId, revision: 1}),
    finalReadBackRevision: controlledByRules ?
      "rules-hu082-r1" : `${writer.writerId}-control-r1`,
    finalReadBackDigest: controlledByRules ?
      rulesDigest : digest({writerId: writer.writerId, revision: 1}),
    closedAtMillis: writer.shutdownOrder === "before-causal-capture" ?
      100 : 310,
    initialReadBackAtMillis:
      writer.shutdownOrder === "before-causal-capture" ? 150 : 315,
    finalReadBackAtMillis: 510,
    pendingWorkCount: 0,
    inFlightWorkCount: 0,
  };
};

const writerControls = () => SHIFT_PLANNING_INTAKE_BARRIER_WRITERS
  .map(controlEvidence)
  .sort((left, right) => left.writerId < right.writerId ? -1 : 1);

const payload = () => ({
  schemaVersion: 1,
  environment: "develop",
  barrierRevision: "intake-barrier-7",
  transition: {
    transitionId: "maintenance-entry-7",
    expectedAuthoritativeDigest: authoritativeDigest,
    expectedStateRevision: 6,
    expectedWriteEpoch: 11,
    expectedActiveRevision: "active-4",
    expectedActiveDigest: activeDigest,
  },
  writerInventory: {
    revision: SHIFT_PLANNING_WRITER_INVENTORY_REVISION,
    digest: SHIFT_PLANNING_WRITER_INVENTORY_DIGEST,
  },
  policy: {
    minimumQuietHorizonMillis: 100,
    maximumEvidenceAgeMillis: 100,
  },
  rules: {
    deployedRevision: "rules-hu082-r1",
    deployedDigest: rulesDigest,
    initialReadBackRevision: "rules-hu082-r1",
    initialReadBackDigest: rulesDigest,
    finalReadBackRevision: "rules-hu082-r1",
    finalReadBackDigest: rulesDigest,
    deniedWriterIds: [...SHIFT_PLANNING_RULES_DENIED_WRITER_IDS],
    closedAtMillis: 100,
    initialReadBackAtMillis: 150,
    finalReadBackAtMillis: 510,
  },
  writerControls: writerControls(),
  causalDrain: {
    acceptedSetRevision: "causal-set-7",
    acceptedSetDigest,
    capturedAtMillis: 200,
    drainedAtMillis: 300,
    initialPendingWorkCount: 0,
    initialInFlightWorkCount: 0,
    initialPendingDeliveryCount: 0,
    initialInFlightDeliveryCount: 0,
    initialQueueReadBackAtMillis: 320,
    finalPendingWorkCount: 0,
    finalInFlightWorkCount: 0,
    finalPendingDeliveryCount: 0,
    finalInFlightDeliveryCount: 0,
    finalQueueReadBackAtMillis: 510,
  },
  workbook: {
    fileId: "workbook-develop-1",
    revision: "workbook-r19",
    digest: workbookDigest,
    readBackRevision: "workbook-r19",
    readBackDigest: workbookDigest,
    pendingOfflineEditorCount: 0,
    capturedAtMillis: 330,
    readBackAtMillis: 510,
  },
  quietHorizon: {
    startedAtMillis: 400,
    endedAtMillis: 500,
    firestoreMutationCount: 0,
    workbookMutationCount: 0,
    deliveryMutationCount: 0,
  },
  verifiedAtMillis: 520,
});

const envelope = (nextPayload = payload()) => ({
  payload: nextPayload,
  digest: digest(nextPayload),
});

const stateEntryIntent = (packet) => ({
  action: "enterMaintenance",
  environment: "develop",
  transitionId: "maintenance-entry-7",
  expectedAuthoritativeDigest: authoritativeDigest,
  expectedStateRevision: 6,
  expectedWriteEpoch: 11,
  expectedActiveRevision: "active-4",
  expectedActiveDigest: activeDigest,
  intakeBarrier: {
    revision: "intake-barrier-7",
    digest: packet.digest,
    verifiedAtMillis: 520,
  },
  intakeBarrierExpiresAtMillis: 600,
});

const terminalEntryTransition = (packet, authoritativeDigestAfter) => ({
  action: "enterMaintenance",
  environment: "develop",
  transitionId: "maintenance-entry-7",
  authoritativeDigestAfter,
  intentDigest: digest(stateEntryIntent(packet)),
});

const barrierFailure = (error) =>
  error instanceof Error && error.code === "maintenance_state_conflict";

const mutateAndRehash = (mutation) => {
  const changed = structuredClone(envelope());
  mutation(changed.payload);
  changed.digest = digest(changed.payload);
  return changed;
};

const retainingEvidencePersistence = (onRetain = () => {}) => ({
  async readExisting() {
    return null;
  },
  async retainAndReadBack(request) {
    onRetain(request);
    return structuredClone(request.evidence);
  },
});

const noTerminalTransition = {
  async loadMaintenanceTransition() {
    return null;
  },
};

test("keeps the complete affected-writer inventory versioned", () => {
  assert.deepEqual(
    SHIFT_PLANNING_AFFECTED_WRITERS.map((writer) => writer.writerId),
    [
      "firestore-client-shifts",
      "firestore-client-delivery-calendar",
      "firestore-client-shift-planning-requests",
      "firestore-client-shift-swap-requests",
      "https-sync-shifts-from-google-sheets",
      "https-export-shifts-to-google-sheets",
      "https-transition-shift-swap",
      "trigger-on-shift-planning-request-created",
      "trigger-on-shift-written",
      "trigger-on-delivery-calendar-override-written",
      "trigger-on-notification-event-created",
      "firestore-client-membership-fairness",
      "firestore-client-planning-config",
      "https-resolve-authorized-member",
      "https-upsert-member-by-admin",
      "https-clone-global-config",
      "https-config-maintenance-writers",
      "iam-firestore-admin-and-server-writers",
      "workbook-human-and-offline-editors",
      "workbook-apps-script-and-addons",
      "workbook-api-oauth-and-service-accounts",
      "workbook-shared-drive-and-admin-authority",
    ],
  );
  assert.match(
    SHIFT_PLANNING_WRITER_INVENTORY_DIGEST,
    /^shift-planning:v1:sha256:[a-f0-9]{64}$/,
  );
  assert.equal(
    SHIFT_PLANNING_WRITER_INVENTORY_DIGEST,
    "shift-planning:v1:sha256:" +
      "0943955453116928762eb3d82ff1e21134b6dc8f3da0c9ab7d386bdde42012de",
  );
  assert.deepEqual(
    SHIFT_PLANNING_AFFECTED_WRITERS.find(
      (writer) => writer.writerId === "iam-firestore-admin-and-server-writers",
    ).targets,
    ["firestore.database-wide"],
  );
  assert.equal(
    SHIFT_PLANNING_AFFECTED_WRITERS.find(
      (writer) => writer.writerId === "https-resolve-authorized-member",
    ).shutdownOrder,
    "activation-recheck",
  );
});

test("derives stable evidence from a complete held-barrier packet", () => {
  const packet = envelope();
  const verified = verifyShiftPlanningIntakeBarrierEvidence(
    packet,
    command(),
    530,
  );

  assert.deepEqual(verified.barrier, {
    revision: "intake-barrier-7",
    digest: packet.digest,
    verifiedAtMillis: 520,
  });
  assert.equal(verified.expiresAtMillis, 600);
  assert.deepEqual(verified.evidence, packet);
});

test("normalizes set-like writer and Rules order before digesting", () => {
  const canonical = envelope();
  const reordered = structuredClone(canonical);
  reordered.payload.writerControls.reverse();
  reordered.payload.rules.deniedWriterIds.reverse();

  const verified = verifyShiftPlanningIntakeBarrierEvidence(
    reordered,
    command(),
    530,
  );

  assert.equal(verified.barrier.digest, canonical.digest);
  assert.deepEqual(verified.evidence, canonical);
});

test("rejects structural extras and a forged evidence digest", () => {
  const withExtra = structuredClone(envelope());
  withExtra.payload.unmanifested = true;
  assert.throws(
    () => verifyShiftPlanningIntakeBarrierEvidence(
      withExtra,
      command(),
      530,
    ),
    barrierFailure,
  );

  const forged = envelope();
  forged.digest = digest({forged: true});
  assert.throws(
    () => verifyShiftPlanningIntakeBarrierEvidence(
      forged,
      command(),
      530,
    ),
    barrierFailure,
  );
});

test("rejects maintenance command and inventory drift", () => {
  const commandDrifts = [
    {environment: "production"},
    {transitionId: "maintenance-entry-8"},
    {expectedWriteEpoch: 12},
    {expectedActiveRevision: "active-5"},
    {expectedBarrierRevision: "intake-barrier-8"},
    {expectedRulesRevision: "rules-hu082-r2"},
    {expectedRulesDigest: digest({rules: "other"})},
    {expectedControlManifestDigest: digest({controls: "other"})},
    {expectedWorkbookFileId: "workbook-other"},
    {expectedWorkbookRevision: "workbook-r20"},
    {expectedWorkbookDigest: digest({workbook: "other"})},
    {expectedCausalSetRevision: "causal-set-8"},
    {expectedCausalSetDigest: digest({acceptedEventIds: ["event-c"]})},
    {minimumQuietHorizonMillis: 101},
    {maximumEvidenceAgeMillis: 101},
  ];
  for (const drift of commandDrifts) {
    assert.throws(
      () => verifyShiftPlanningIntakeBarrierEvidence(
        envelope(),
        {...command(), ...drift},
        530,
      ),
      barrierFailure,
    );
  }

  const inventoryDrift = mutateAndRehash((value) => {
    value.writerInventory.digest = digest({inventory: "other"});
  });
  assert.throws(
    () => verifyShiftPlanningIntakeBarrierEvidence(
      inventoryDrift,
      command(),
      530,
    ),
    barrierFailure,
  );
});

test("rejects missing, duplicate, extra, active, or undrained writers", () => {
  const mutations = [
    (value) => value.writerControls.pop(),
    (value) => value.writerControls.push(value.writerControls[0]),
    (value) => {
      value.writerControls[0].writerId = "unmanifested-writer";
    },
    (value) => {
      value.writerControls[0].state = "enabled";
    },
    (value) => {
      value.writerControls[0].pendingWorkCount = 1;
    },
  ];
  for (const mutation of mutations) {
    assert.throws(
      () => verifyShiftPlanningIntakeBarrierEvidence(
        mutateAndRehash(mutation),
        command(),
        530,
      ),
      barrierFailure,
    );
  }
});

test("rejects incomplete or drifting Rules read-back", () => {
  const mutations = [
    (value) => value.rules.deniedWriterIds.pop(),
    (value) => {
      value.rules.finalReadBackRevision = "rules-hu082-r2";
    },
    (value) => {
      const rulesWriter = value.writerControls.find(
        (control) => control.state === "denied",
      );
      rulesWriter.controlDigest = digest({rules: "different"});
    },
  ];
  for (const mutation of mutations) {
    assert.throws(
      () => verifyShiftPlanningIntakeBarrierEvidence(
        mutateAndRehash(mutation),
        command(),
        530,
      ),
      barrierFailure,
    );
  }
});

test("rejects non-empty causal work, deliveries, and quiet activity", () => {
  const mutations = [
    (value) => {
      value.causalDrain.initialPendingWorkCount = 1;
    },
    (value) => {
      value.causalDrain.finalInFlightDeliveryCount = 1;
    },
    (value) => {
      value.quietHorizon.firestoreMutationCount = 1;
    },
    (value) => {
      value.quietHorizon.workbookMutationCount = 1;
    },
  ];
  for (const mutation of mutations) {
    assert.throws(
      () => verifyShiftPlanningIntakeBarrierEvidence(
        mutateAndRehash(mutation),
        command(),
        530,
      ),
      barrierFailure,
    );
  }
});

test("rejects workbook drift and pending offline editors", () => {
  const mutations = [
    (value) => {
      value.workbook.readBackRevision = "workbook-r20";
    },
    (value) => {
      value.workbook.readBackDigest = digest({workbook: "changed"});
    },
    (value) => {
      value.workbook.pendingOfflineEditorCount = 1;
    },
  ];
  for (const mutation of mutations) {
    assert.throws(
      () => verifyShiftPlanningIntakeBarrierEvidence(
        mutateAndRehash(mutation),
        command(),
        530,
      ),
      barrierFailure,
    );
  }

  const coherentlyReplaced = mutateAndRehash((value) => {
    value.workbook.revision = "workbook-r20";
    value.workbook.readBackRevision = "workbook-r20";
    value.workbook.digest = digest({workbook: "replacement"});
    value.workbook.readBackDigest = value.workbook.digest;
  });
  assert.throws(
    () => verifyShiftPlanningIntakeBarrierEvidence(
      coherentlyReplaced,
      command(),
      530,
    ),
    barrierFailure,
  );
});

test("rejects invalid closure, drain, horizon, and freshness chronology", () => {
  const mutations = [
    (value) => {
      value.rules.initialReadBackAtMillis = 201;
    },
    (value) => {
      value.causalDrain.capturedAtMillis = 99;
    },
    (value) => {
      const delivery = value.writerControls.find(
        (control) => control.writerId === "trigger-on-shift-written",
      );
      delivery.closedAtMillis = 299;
    },
    (value) => {
      const delivery = value.writerControls.find(
        (control) => control.writerId === "trigger-on-shift-written",
      );
      delivery.initialReadBackAtMillis = 321;
    },
    (value) => {
      value.quietHorizon.endedAtMillis = 499;
    },
    (value) => {
      value.causalDrain.finalQueueReadBackAtMillis = 499;
    },
    (value) => {
      value.rules.finalReadBackAtMillis = 499;
    },
    (value) => {
      value.writerControls[0].finalReadBackAtMillis = 499;
    },
  ];
  for (const mutation of mutations) {
    assert.throws(
      () => verifyShiftPlanningIntakeBarrierEvidence(
        mutateAndRehash(mutation),
        command(),
        530,
      ),
      barrierFailure,
    );
  }
  assert.throws(
    () => verifyShiftPlanningIntakeBarrierEvidence(
      envelope(),
      command(),
      621,
    ),
    barrierFailure,
  );
});

test("cannot launder stale final observations with a fresh verifiedAt", () => {
  const laundered = mutateAndRehash((value) => {
    value.verifiedAtMillis = 1_000_000;
  });

  assert.throws(
    () => verifyShiftPlanningIntakeBarrierEvidence(
      laundered,
      command(),
      1_000_010,
    ),
    barrierFailure,
  );
});

test("holds the adapter fence while verifying and entering maintenance", async () => {
  const events = [];
  let held = false;
  const expectedResult = {kind: "committed", transition: {id: "result"}};
  const barrierAdapter = {
    async withClosedIntakeBarrier(scope, operation) {
      events.push("adapter-held");
      held = true;
      assert.equal(scope.transitionId, command().transitionId);
      assert.equal(
        scope.writerInventoryDigest,
        SHIFT_PLANNING_WRITER_INVENTORY_DIGEST,
      );
      try {
        return await operation(envelope());
      } finally {
        held = false;
        events.push("adapter-returned");
      }
    },
  };
  const statePersistence = {
    ...noTerminalTransition,
    async enterMaintenanceWithBarrierEvidence(intent) {
      assert.equal(held, true);
      events.push("maintenance-cas");
      assert.deepEqual(intent.intakeBarrier, {
        revision: "intake-barrier-7",
        digest: envelope().digest,
        verifiedAtMillis: 520,
      });
      assert.equal(intent.intakeBarrierExpiresAtMillis, 600);
      return expectedResult;
    },
  };
  const evidencePersistence = retainingEvidencePersistence((request) => {
    assert.equal(held, true);
    assert.equal(request.environment, "develop");
    assert.equal(request.transitionId, "maintenance-entry-7");
    assert.equal(request.evidence.digest, envelope().digest);
    events.push("evidence-retained");
  });

  const result = await enterShiftPlanningMaintenanceBehindIntakeBarrier(
    {
      barrierAdapter,
      evidencePersistence,
      statePersistence,
      readClockMillis: () => 530,
    },
    command(),
  );

  assert.equal(result, expectedResult);
  assert.deepEqual(events, [
    "adapter-held",
    "evidence-retained",
    "maintenance-cas",
    "adapter-returned",
  ]);
});

test("does not call state persistence when barrier verification fails", async () => {
  let stateCalls = 0;
  let retentionCalls = 0;
  const barrierAdapter = {
    async withClosedIntakeBarrier(_scope, operation) {
      return operation(mutateAndRehash((value) => {
        value.causalDrain.initialPendingWorkCount = 1;
      }));
    },
  };
  const statePersistence = {
    ...noTerminalTransition,
    async enterMaintenanceWithBarrierEvidence() {
      stateCalls += 1;
    },
  };
  const evidencePersistence = retainingEvidencePersistence(() => {
    retentionCalls += 1;
  });

  await assert.rejects(
    enterShiftPlanningMaintenanceBehindIntakeBarrier(
      {
        barrierAdapter,
        evidencePersistence,
        statePersistence,
        readClockMillis: () => 530,
      },
      command(),
    ),
    barrierFailure,
  );
  assert.equal(stateCalls, 0);
  assert.equal(retentionCalls, 0);
});

test("does not enter maintenance when retained evidence reads back differently", async () => {
  let stateCalls = 0;
  const barrierAdapter = {
    async withClosedIntakeBarrier(_scope, operation) {
      return operation(envelope());
    },
  };
  const evidencePersistence = {
    async readExisting() {
      return null;
    },
    async retainAndReadBack(request) {
      const changed = structuredClone(request.evidence);
      changed.payload.verifiedAtMillis = 521;
      changed.digest = digest(changed.payload);
      return changed;
    },
  };
  const statePersistence = {
    ...noTerminalTransition,
    async enterMaintenanceWithBarrierEvidence() {
      stateCalls += 1;
    },
  };

  await assert.rejects(
    enterShiftPlanningMaintenanceBehindIntakeBarrier(
      {
        barrierAdapter,
        evidencePersistence,
        statePersistence,
        readClockMillis: () => 530,
      },
      command(),
    ),
    barrierFailure,
  );
  assert.equal(stateCalls, 0);
});

test("rechecks evidence freshness after the retained packet is read back", async () => {
  let stateCalls = 0;
  let clockIndex = 0;
  const clocks = [530, 601];
  const statePersistence = {
    ...noTerminalTransition,
    async enterMaintenanceWithBarrierEvidence() {
      stateCalls += 1;
    },
  };

  await assert.rejects(
    enterShiftPlanningMaintenanceBehindIntakeBarrier(
      {
        barrierAdapter: {
          async withClosedIntakeBarrier(_scope, operation) {
            return operation(envelope());
          },
        },
        evidencePersistence: retainingEvidencePersistence(),
        statePersistence,
        readClockMillis: () => clocks[clockIndex++],
      },
      command(),
    ),
    barrierFailure,
  );
  assert.equal(stateCalls, 0);
  assert.equal(clockIndex, 2);
});

test("propagates a CAS failure without a reopen operation", async () => {
  const casFailure = new Error("CAS lost");
  let heldDuringCas = false;
  let adapterReturned = false;
  const barrierAdapter = {
    async withClosedIntakeBarrier(_scope, operation) {
      try {
        return await operation(envelope());
      } finally {
        adapterReturned = true;
      }
    },
  };
  const statePersistence = {
    ...noTerminalTransition,
    async enterMaintenanceWithBarrierEvidence() {
      heldDuringCas = !adapterReturned;
      throw casFailure;
    },
  };
  const evidencePersistence = retainingEvidencePersistence();

  await assert.rejects(
    enterShiftPlanningMaintenanceBehindIntakeBarrier(
      {
        barrierAdapter,
        evidencePersistence,
        statePersistence,
        readClockMillis: () => 530,
      },
      command(),
    ),
    (error) => error === casFailure,
  );
  assert.equal(heldDuringCas, true);
  assert.equal(adapterReturned, true);
  assert.equal("reopenIntakeBarrier" in barrierAdapter, false);
});

test("cannot reuse evidence with another environment, transition, or epoch", () => {
  const packet = envelope();
  for (const drift of [
    {environment: "production"},
    {transitionId: "maintenance-entry-8"},
    {expectedWriteEpoch: 12},
  ]) {
    assert.throws(
      () => verifyShiftPlanningIntakeBarrierEvidence(
        packet,
        {...command(), ...drift},
        530,
      ),
      barrierFailure,
    );
  }
});

test("rejects a non-exact or non-canonical maintenance command", () => {
  assert.throws(
    () => verifyShiftPlanningIntakeBarrierEvidence(
      envelope(),
      {...command(), unrecognizedAuthority: true},
      530,
    ),
    barrierFailure,
  );

  const cyclic = command();
  cyclic.command = cyclic;
  assert.throws(
    () => verifyShiftPlanningIntakeBarrierEvidence(
      envelope(),
      cyclic,
      530,
    ),
    barrierFailure,
  );

  assert.throws(
    () => verifyShiftPlanningIntakeBarrierEvidence(
      envelope(),
      {...command(), transitionId: "maintenance entry 7"},
      530,
    ),
    barrierFailure,
  );
});

test("detaches the authorized command before the adapter can mutate it", async () => {
  const mutableCommand = command();
  const expectedResult = {kind: "committed", transition: {id: "result"}};
  const barrierAdapter = {
    async withClosedIntakeBarrier(scope, operation) {
      assert.equal(scope.environment, "develop");
      mutableCommand.environment = "production";
      mutableCommand.transitionId = "maintenance-entry-mutated";
      return operation(envelope());
    },
  };
  const statePersistence = {
    ...noTerminalTransition,
    async enterMaintenanceWithBarrierEvidence(intent) {
      assert.equal(intent.environment, "develop");
      assert.equal(intent.transitionId, "maintenance-entry-7");
      return expectedResult;
    },
  };

  const result = await enterShiftPlanningMaintenanceBehindIntakeBarrier(
    {
      barrierAdapter,
      evidencePersistence: retainingEvidencePersistence(),
      statePersistence,
      readClockMillis: () => 530,
    },
    mutableCommand,
  );

  assert.equal(result, expectedResult);
});

test("requires the adapter to invoke and return exactly one CAS callback", async () => {
  const expectedResult = {kind: "committed", transition: {id: "result"}};
  const statePersistence = {
    ...noTerminalTransition,
    async enterMaintenanceWithBarrierEvidence() {
      return expectedResult;
    },
  };
  const dependencies = (barrierAdapter) => ({
    barrierAdapter,
    evidencePersistence: retainingEvidencePersistence(),
    statePersistence,
    readClockMillis: () => 530,
  });

  await assert.rejects(
    enterShiftPlanningMaintenanceBehindIntakeBarrier(
      dependencies({
        async withClosedIntakeBarrier() {
          return {kind: "committed", transition: {id: "fabricated"}};
        },
      }),
      command(),
    ),
    barrierFailure,
  );

  await assert.rejects(
    enterShiftPlanningMaintenanceBehindIntakeBarrier(
      dependencies({
        async withClosedIntakeBarrier(_scope, operation) {
          await operation(envelope());
          return {kind: "committed", transition: {id: "fabricated"}};
        },
      }),
      command(),
    ),
    barrierFailure,
  );

  await assert.rejects(
    enterShiftPlanningMaintenanceBehindIntakeBarrier(
      dependencies({
        async withClosedIntakeBarrier(_scope, operation) {
          const first = await operation(envelope());
          await assert.rejects(operation(envelope()), barrierFailure);
          return first;
        },
      }),
      command(),
    ),
    barrierFailure,
  );
});

test("accepts a replay only while it still owns the closed state", async () => {
  const packet = envelope();
  const authoritativeDigestAfter = digest({authoritative: "closed"});
  const replay = {
    kind: "replayed",
    transition: {
      environment: "develop",
      transitionId: "maintenance-entry-7",
      authoritativeDigestAfter,
    },
  };
  const statePersistence = {
    ...noTerminalTransition,
    async enterMaintenanceWithBarrierEvidence() {
      return replay;
    },
    async loadAuthoritativeState() {
      return {
        authoritativeDigest: authoritativeDigestAfter,
        maintenance: {
          maintenanceStatus: "closed",
          lastTransitionId: "maintenance-entry-7",
          intakeBarrier: {
            revision: "intake-barrier-7",
            digest: packet.digest,
            verifiedAtMillis: 520,
          },
        },
      };
    },
  };

  const result = await enterShiftPlanningMaintenanceBehindIntakeBarrier(
    {
      barrierAdapter: {
        async withClosedIntakeBarrier(_scope, operation) {
          return operation(packet);
        },
      },
      evidencePersistence: retainingEvidencePersistence(),
      statePersistence,
      readClockMillis: () => 530,
    },
    command(),
  );

  assert.equal(result, replay);
});

test("replays retained terminal evidence after its admission expiry", async () => {
  const packet = envelope();
  const authoritativeDigestAfter = digest({authoritative: "closed-retry"});
  const transition = terminalEntryTransition(
    packet,
    authoritativeDigestAfter,
  );
  const retainedByKey = new Map();
  let retentionCalls = 0;
  let retentionCreates = 0;
  let existingReads = 0;
  let stateCalls = 0;
  let replayLoads = 0;
  let currentBarrier;
  let nowMillis = 530;
  const evidencePersistence = {
    async readExisting({environment, transitionId}) {
      existingReads += 1;
      const retained = retainedByKey.get(`${environment}:${transitionId}`);
      return retained ? structuredClone(retained) : null;
    },
    async retainAndReadBack(request) {
      retentionCalls += 1;
      const key = `${request.environment}:${request.transitionId}`;
      const existing = retainedByKey.get(key);
      if (existing && existing.digest !== request.evidence.digest) {
        throw new Error("retention collision");
      }
      if (!existing) {
        retentionCreates += 1;
        retainedByKey.set(key, structuredClone(request.evidence));
      }
      return structuredClone(retainedByKey.get(key));
    },
  };
  const statePersistence = {
    ...noTerminalTransition,
    async loadMaintenanceTransition() {
      return stateCalls === 0 ? null : transition;
    },
    async enterMaintenanceWithBarrierEvidence(intent) {
      stateCalls += 1;
      currentBarrier = intent.intakeBarrier;
      return {
        kind: stateCalls === 1 ? "committed" : "replayed",
        transition,
      };
    },
    async loadAuthoritativeState() {
      replayLoads += 1;
      return {
        authoritativeDigest: authoritativeDigestAfter,
        maintenance: {
          maintenanceStatus: "closed",
          lastTransitionId: "maintenance-entry-7",
          intakeBarrier: currentBarrier,
        },
      };
    },
  };
  const dependencies = {
    barrierAdapter: {
      async withClosedIntakeBarrier(_scope, operation) {
        return operation(packet);
      },
    },
    evidencePersistence,
    statePersistence,
    readClockMillis: () => nowMillis,
  };

  const first = await enterShiftPlanningMaintenanceBehindIntakeBarrier(
    dependencies,
    command(),
  );
  nowMillis = 700;
  const replay = await enterShiftPlanningMaintenanceBehindIntakeBarrier(
    dependencies,
    command(),
  );

  assert.equal(first.kind, "committed");
  assert.equal(replay.kind, "replayed");
  assert.equal(retentionCalls, 1);
  assert.equal(retentionCreates, 1);
  assert.equal(existingReads, 1);
  assert.equal(stateCalls, 2);
  assert.equal(replayLoads, 1);
});

test("accepts an exact terminal race when evidence expires during retention", async () => {
  const packet = envelope();
  const authoritativeDigestAfter = digest({authoritative: "closed-race"});
  const transition = terminalEntryTransition(
    packet,
    authoritativeDigestAfter,
  );
  let lookupCalls = 0;
  let stateCalls = 0;
  let clockIndex = 0;
  const clocks = [530, 700];
  const statePersistence = {
    async loadMaintenanceTransition() {
      lookupCalls += 1;
      return lookupCalls === 1 ? null : transition;
    },
    async enterMaintenanceWithBarrierEvidence() {
      stateCalls += 1;
      return {kind: "replayed", transition};
    },
    async loadAuthoritativeState() {
      return {
        authoritativeDigest: authoritativeDigestAfter,
        maintenance: {
          maintenanceStatus: "closed",
          lastTransitionId: "maintenance-entry-7",
          intakeBarrier: stateEntryIntent(packet).intakeBarrier,
        },
      };
    },
  };

  const result = await enterShiftPlanningMaintenanceBehindIntakeBarrier(
    {
      barrierAdapter: {
        async withClosedIntakeBarrier(_scope, operation) {
          return operation(packet);
        },
      },
      evidencePersistence: retainingEvidencePersistence(),
      statePersistence,
      readClockMillis: () => clocks[clockIndex++],
    },
    command(),
  );

  assert.equal(result.kind, "replayed");
  assert.equal(lookupCalls, 2);
  assert.equal(stateCalls, 1);
  assert.equal(clockIndex, 2);
});

test("rejects a terminal replay superseded by newer authoritative state", async () => {
  const replay = {
    kind: "replayed",
    transition: {
      environment: "develop",
      transitionId: "maintenance-entry-7",
      authoritativeDigestAfter: digest({authoritative: "closed"}),
    },
  };
  const statePersistence = {
    ...noTerminalTransition,
    async enterMaintenanceWithBarrierEvidence() {
      return replay;
    },
    async loadAuthoritativeState() {
      return {
        authoritativeDigest: digest({authoritative: "newer"}),
        maintenance: {
          maintenanceStatus: "open",
          lastTransitionId: "maintenance-abort-8",
          intakeBarrier: null,
        },
      };
    },
  };

  await assert.rejects(
    enterShiftPlanningMaintenanceBehindIntakeBarrier(
      {
        barrierAdapter: {
          async withClosedIntakeBarrier(_scope, operation) {
            return operation(envelope());
          },
        },
        evidencePersistence: retainingEvidencePersistence(),
        statePersistence,
        readClockMillis: () => 530,
      },
      command(),
    ),
    barrierFailure,
  );
});
