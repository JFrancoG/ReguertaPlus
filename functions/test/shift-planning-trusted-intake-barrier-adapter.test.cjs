const assert = require("node:assert/strict");
const {test} = require("node:test");

const {
  createShiftPlanningDigest,
} = require("../lib/shift-planning-digest.js");
const {
  createShiftPlanningControlManifestDigest,
} = require("../lib/shift-planning-intake-barrier.js");
const {
  createShiftPlanningTrustedIntakeBarrierCheckpoint,
  createTrustedShiftPlanningIntakeBarrierAdapter,
} = require("../lib/shift-planning-trusted-intake-barrier-adapter.js");
const {
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

const controlEvidence = (writer) => {
  const controlledByRules = writer.control === "rules-deny";
  const revision = controlledByRules ?
    "rules-hu082-r1" : `${writer.writerId}-control-r1`;
  const evidenceDigest = controlledByRules ?
    rulesDigest : digest({writerId: writer.writerId, revision: 1});
  return {
    writerId: writer.writerId,
    state: writer.requiredState,
    controlRevision: revision,
    controlDigest: evidenceDigest,
    initialReadBackRevision: revision,
    initialReadBackDigest: evidenceDigest,
    finalReadBackRevision: revision,
    finalReadBackDigest: evidenceDigest,
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

const scope = (overrides = {}) => ({
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
  writerInventoryRevision: SHIFT_PLANNING_WRITER_INVENTORY_REVISION,
  writerInventoryDigest: SHIFT_PLANNING_WRITER_INVENTORY_DIGEST,
  ...overrides,
});

const evidencePayload = () => ({
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

const evidence = () => {
  const payload = evidencePayload();
  return {payload, digest: digest(payload)};
};

const checkpoint = (overrides = {}) =>
  createShiftPlanningTrustedIntakeBarrierCheckpoint({
    scope: scope(),
    holdRevision: "hold-hu082-r7",
    evidence: evidence(),
    ...overrides,
  });

const failureKey = (barrierScope = scope()) => ({
  environment: barrierScope.environment,
  transitionId: barrierScope.transitionId,
});

const failureRequest = (barrierCheckpoint, phase) => ({
  ...failureKey(barrierCheckpoint.scope),
  scopeDigest: barrierCheckpoint.scopeDigest,
  holdRevision: barrierCheckpoint.holdRevision,
  checkpointDigest: barrierCheckpoint.checkpointDigest,
  phase,
});

const persistedFailure = (
  request,
  failedAtMillis = 1_782_643_201_000,
) => {
  const record = {
    schemaVersion: 1,
    operationKind: "intakeBarrierFailureClosure",
    ...request,
    failedAtMillis,
  };
  return {...record, failureDigest: digest(record)};
};

const errorCode = (expectedCode) => (error) =>
  error instanceof Error && error.code === expectedCode;

const assertDeepFrozen = (value) => {
  if (typeof value !== "object" || value === null) return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child);
};

const createFailurePersistence = ({
  existing = null,
  retain = (request) => persistedFailure(request),
} = {}) => {
  const reads = [];
  const retained = [];
  return {
    reads,
    retained,
    port: {
      async readExistingFailure(key) {
        reads.push(structuredClone(key));
        return existing === null ? null : structuredClone(existing);
      },
      async retainFailureAndReadBack(request) {
        retained.push(structuredClone(request));
        return retain(request);
      },
    },
  };
};

const createControlPlane = ({
  barrierCheckpoint = checkpoint(),
  closeError = null,
  readBackSteps = [barrierCheckpoint, barrierCheckpoint],
} = {}) => {
  const events = [];
  const scopes = [];
  let readBackIndex = 0;
  let reopenCalls = 0;
  return {
    events,
    scopes,
    get reopenCalls() {
      return reopenCalls;
    },
    port: {
      async closeAndCollect(receivedScope) {
        events.push("close");
        scopes.push(structuredClone(receivedScope));
        if (closeError !== null) throw closeError;
        return structuredClone(barrierCheckpoint);
      },
      async readBackClosed(receivedScope) {
        events.push("readBack");
        scopes.push(structuredClone(receivedScope));
        const step = readBackSteps[readBackIndex++];
        if (step instanceof Error) throw step;
        if (step === undefined) {
          throw new Error("Unexpected extra closed-barrier read-back.");
        }
        return structuredClone(step);
      },
      async reopen() {
        reopenCalls += 1;
        throw new Error("The trusted adapter must never reopen intake.");
      },
    },
  };
};

test("creates one exact detached and deeply frozen trusted checkpoint", () => {
  const inputScope = scope();
  const inputEvidence = evidence();
  const result = createShiftPlanningTrustedIntakeBarrierCheckpoint({
    scope: inputScope,
    holdRevision: "hold-hu082-r7",
    evidence: inputEvidence,
  });
  const expectedWithoutDigest = {
    schemaVersion: 1,
    scope: inputScope,
    scopeDigest: digest(inputScope),
    holdRevision: "hold-hu082-r7",
    evidence: inputEvidence,
    evidenceDigest: inputEvidence.digest,
  };

  assert.deepEqual(result, {
    ...expectedWithoutDigest,
    checkpointDigest: digest(expectedWithoutDigest),
  });
  assertDeepFrozen(result);

  inputScope.transitionId = "mutated-transition";
  inputEvidence.payload.barrierRevision = "mutated-barrier";
  assert.equal(result.scope.transitionId, "maintenance-entry-7");
  assert.equal(result.evidence.payload.barrierRevision, "intake-barrier-7");
});

test("rejects non-canonical checkpoint evidence", () => {
  assert.throws(
    () => createShiftPlanningTrustedIntakeBarrierCheckpoint({
      scope: scope(),
      holdRevision: "hold-hu082-r7",
      evidence: {unsupported: undefined},
    }),
    errorCode("maintenance_state_conflict"),
  );
});

test("holds one exact checkpoint around one callback and never reopens", async () => {
  const barrierCheckpoint = checkpoint();
  const control = createControlPlane({barrierCheckpoint});
  const failures = createFailurePersistence();
  const adapter = createTrustedShiftPlanningIntakeBarrierAdapter({
    controlPlane: control.port,
    failurePersistence: failures.port,
  });
  const resultValue = {kind: "committed"};
  let callbackCalls = 0;
  let callbackEvidence;

  const result = await adapter.withClosedIntakeBarrier(
    scope(),
    async (receivedEvidence) => {
      control.events.push("operation");
      callbackCalls += 1;
      callbackEvidence = receivedEvidence;
      return resultValue;
    },
  );

  assert.equal(result, resultValue);
  assert.equal(callbackCalls, 1);
  assert.deepEqual(callbackEvidence, barrierCheckpoint.evidence);
  assertDeepFrozen(callbackEvidence);
  assert.deepEqual(control.events, [
    "close",
    "readBack",
    "operation",
    "readBack",
  ]);
  assert.equal(control.scopes.length, 3);
  for (const receivedScope of control.scopes) {
    assert.deepEqual(receivedScope, barrierCheckpoint.scope);
  }
  assert.deepEqual(failures.reads, [failureKey()]);
  assert.deepEqual(failures.retained, []);
  assert.equal(control.reopenCalls, 0);
});

test("rejects checkpoint drift before invoking the callback", async () => {
  const barrierCheckpoint = checkpoint();
  const driftedCheckpoint = checkpoint({holdRevision: "other-hold-r8"});
  const control = createControlPlane({
    barrierCheckpoint,
    readBackSteps: [driftedCheckpoint, barrierCheckpoint],
  });
  const failures = createFailurePersistence();
  const adapter = createTrustedShiftPlanningIntakeBarrierAdapter({
    controlPlane: control.port,
    failurePersistence: failures.port,
  });
  let callbackCalls = 0;

  await assert.rejects(
    adapter.withClosedIntakeBarrier(scope(), async () => {
      callbackCalls += 1;
    }),
    errorCode("maintenance_state_conflict"),
  );

  assert.equal(callbackCalls, 0);
  assert.deepEqual(control.events, ["close", "readBack", "readBack"]);
  assert.deepEqual(
    failures.retained,
    [failureRequest(barrierCheckpoint, "initialReadBack")],
  );
  assert.equal(control.reopenCalls, 0);
});

const phaseScenarios = [
  {
    name: "close",
    phase: "close",
    configure(original, barrierCheckpoint) {
      return {
        control: createControlPlane({
          barrierCheckpoint,
          closeError: original,
          readBackSteps: [barrierCheckpoint],
        }),
        operation: async () => assert.fail("Operation must not run."),
        expectedEvents: ["close", "readBack"],
      };
    },
  },
  {
    name: "initial read-back",
    phase: "initialReadBack",
    configure(original, barrierCheckpoint) {
      return {
        control: createControlPlane({
          barrierCheckpoint,
          readBackSteps: [original, barrierCheckpoint],
        }),
        operation: async () => assert.fail("Operation must not run."),
        expectedEvents: ["close", "readBack", "readBack"],
      };
    },
  },
  {
    name: "operation",
    phase: "operation",
    configure(original, barrierCheckpoint) {
      return {
        control: createControlPlane({
          barrierCheckpoint,
          readBackSteps: [barrierCheckpoint, barrierCheckpoint],
        }),
        operation: async () => {
          throw original;
        },
        expectedEvents: ["close", "readBack", "readBack"],
      };
    },
  },
  {
    name: "final read-back",
    phase: "finalReadBack",
    configure(original, barrierCheckpoint) {
      return {
        control: createControlPlane({
          barrierCheckpoint,
          readBackSteps: [
            barrierCheckpoint,
            original,
            barrierCheckpoint,
          ],
        }),
        operation: async () => "operation-result",
        expectedEvents: [
          "close",
          "readBack",
          "readBack",
          "readBack",
        ],
      };
    },
  },
];

for (const scenario of phaseScenarios) {
  test(`retains opaque durable failure evidence after ${scenario.name} fails`,
    async () => {
      const barrierCheckpoint = checkpoint();
      const rawMarker = `raw-secret-${scenario.phase}`;
      const original = new Error(rawMarker);
      const configured = scenario.configure(original, barrierCheckpoint);
      const failures = createFailurePersistence();
      const adapter = createTrustedShiftPlanningIntakeBarrierAdapter({
        controlPlane: configured.control.port,
        failurePersistence: failures.port,
      });

      await assert.rejects(
        adapter.withClosedIntakeBarrier(scope(), configured.operation),
        (error) => error === original,
      );

      assert.deepEqual(configured.control.events, configured.expectedEvents);
      assert.deepEqual(
        failures.retained,
        [failureRequest(barrierCheckpoint, scenario.phase)],
      );
      assert.equal(JSON.stringify(failures.retained).includes(rawMarker), false);
      assert.equal(configured.control.reopenCalls, 0);
    });
}

test("an existing durable failure blocks the transition before closure", async () => {
  const barrierCheckpoint = checkpoint();
  const existing = persistedFailure(
    failureRequest(barrierCheckpoint, "operation"),
  );
  const control = createControlPlane({barrierCheckpoint});
  const failures = createFailurePersistence({existing});
  const adapter = createTrustedShiftPlanningIntakeBarrierAdapter({
    controlPlane: control.port,
    failurePersistence: failures.port,
  });
  let callbackCalls = 0;

  await assert.rejects(
    adapter.withClosedIntakeBarrier(scope(), async () => {
      callbackCalls += 1;
    }),
    errorCode("maintenance_state_conflict"),
  );

  assert.equal(callbackCalls, 0);
  assert.deepEqual(control.events, []);
  assert.deepEqual(failures.reads, [failureKey()]);
  assert.deepEqual(failures.retained, []);
  assert.equal(control.reopenCalls, 0);
});

test("masks the original failure when durable journaling fails", async () => {
  const barrierCheckpoint = checkpoint();
  const original = new Error("raw-operation-secret");
  const journalError = new Error("raw-journal-secret");
  const control = createControlPlane({
    barrierCheckpoint,
    readBackSteps: [barrierCheckpoint, barrierCheckpoint],
  });
  const failures = createFailurePersistence({
    retain() {
      throw journalError;
    },
  });
  const adapter = createTrustedShiftPlanningIntakeBarrierAdapter({
    controlPlane: control.port,
    failurePersistence: failures.port,
  });

  await assert.rejects(
    adapter.withClosedIntakeBarrier(scope(), async () => {
      throw original;
    }),
    (error) => error !== original &&
      error !== journalError &&
      errorCode("maintenance_state_conflict")(error) &&
      !error.message.includes("raw-operation-secret") &&
      !error.message.includes("raw-journal-secret"),
  );

  assert.deepEqual(
    failures.retained,
    [failureRequest(barrierCheckpoint, "operation")],
  );
  assert.equal(control.reopenCalls, 0);
});

test("masks the original failure when journal read-back is tampered", async () => {
  const barrierCheckpoint = checkpoint();
  const original = new Error("raw-operation-secret");
  const control = createControlPlane({
    barrierCheckpoint,
    readBackSteps: [barrierCheckpoint, barrierCheckpoint],
  });
  const failures = createFailurePersistence({
    retain(request) {
      const record = persistedFailure(request);
      return {...record, phase: "close"};
    },
  });
  const adapter = createTrustedShiftPlanningIntakeBarrierAdapter({
    controlPlane: control.port,
    failurePersistence: failures.port,
  });

  await assert.rejects(
    adapter.withClosedIntakeBarrier(scope(), async () => {
      throw original;
    }),
    (error) => error !== original &&
      errorCode("maintenance_state_conflict")(error) &&
      !error.message.includes("raw-operation-secret"),
  );

  assert.equal(control.reopenCalls, 0);
});
