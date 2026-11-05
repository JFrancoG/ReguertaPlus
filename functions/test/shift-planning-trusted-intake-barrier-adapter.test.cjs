const assert = require("node:assert/strict");
const {test} = require("node:test");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {createShiftPlanningControlManifestDigest} = require("../lib/shift-planning-intake-barrier.js");
const {inspectCensus} = require("../scripts/inspect-develop-legacy-census.cjs");
const {createShiftPlanningTrustedIntakeBarrierCheckpoint, createTrustedShiftPlanningIntakeBarrierAdapter} =
  require("../lib/shift-planning-trusted-intake-barrier-adapter.js");
const {scope, evidence} = require("./shift-planning-barrier-fixture.cjs");

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

test("a valid offline census report cannot become a trusted checkpoint or held evidence", async () => {
  const instant = "2026-10-28T10:00:00Z";
  const intake = {
    name: "projects/reguerta-9f27f/databases/(default)/documents/shiftPlanningDevelopIntake/current",
    createTime: instant,
    updateTime: instant,
    fields: {
      schemaVersion: {integerValue: "1"}, legacyUntracked: {booleanValue: true},
      captureRevision: {integerValue: "0"}, eventCount: {integerValue: "0"}, deliveryCount: {integerValue: "0"},
    },
  };
  const report = inspectCensus({
    schemaVersion: 1, projectId: "reguerta-9f27f", readOnly: true, atomicSnapshot: true,
    readTime: instant, canApply: false, canClaimClosure: false,
    intakeBefore: structuredClone(intake), intakeAfter: intake,
    collections: {shiftPlanningRequests: [], shifts: [], deliveryCalendar: [], notificationEvents: []},
    events: [], deliveries: [], chunks: {},
  });
  assert.equal(report.legacyUntracked, true);
  assert.equal(report.canClaimClosure, false);
  assert.match(report.stableSetDigest, /^[a-f0-9]{64}$/);
  const {checkpointDigest: _originalDigest, ...validShape} = checkpoint();
  const reboxed = {...validShape, evidence: report, evidenceDigest: digest(report)};
  const rehashed = {...reboxed, checkpointDigest: digest(reboxed)};

  for (const candidate of [report, rehashed]) {
    const control = createControlPlane({barrierCheckpoint: candidate, readBackSteps: [candidate]});
    const failures = createFailurePersistence();
    const adapter = createTrustedShiftPlanningIntakeBarrierAdapter({
      controlPlane: control.port, failurePersistence: failures.port,
    });
    let callbackCalls = 0;
    await assert.rejects(adapter.withClosedIntakeBarrier(scope(), async () => {
      callbackCalls += 1;
    }), errorCode("maintenance_state_conflict"));
    assert.equal(callbackCalls, 0);
    assert.deepEqual(control.events, ["close", "readBack"]);
    assert.deepEqual(failures.retained, []);
    assert.equal(control.reopenCalls, 0);
  }
});

test("a fully rehashed retained capture never qualifies as a disabled or isolated writer", async () => {
  for (const [writerId, requiredState] of [
    ["trigger-on-shift-written", "disabled"],
    ["trigger-on-notification-event-created", "isolated"],
  ]) {
    const candidate = structuredClone(checkpoint());
    const writer = candidate.evidence.payload.writerControls.find((item) => item.writerId === writerId);
    assert.equal(writer.state, requiredState);
    writer.state = "retained";
    candidate.scope.expectedControlManifestDigest =
      createShiftPlanningControlManifestDigest(candidate.evidence.payload.writerControls);
    candidate.scopeDigest = digest(candidate.scope);
    candidate.evidence.digest = digest(candidate.evidence.payload);
    candidate.evidenceDigest = candidate.evidence.digest;
    const {checkpointDigest: _oldDigest, ...body} = candidate;
    candidate.checkpointDigest = digest(body);
    const control = createControlPlane({barrierCheckpoint: candidate, readBackSteps: [candidate]});
    const failures = createFailurePersistence();
    const adapter = createTrustedShiftPlanningIntakeBarrierAdapter({
      controlPlane: control.port, failurePersistence: failures.port,
    });
    let callbackCalls = 0;
    await assert.rejects(adapter.withClosedIntakeBarrier(candidate.scope, async () => {
      callbackCalls += 1;
    }), errorCode("maintenance_state_conflict"));
    assert.equal(callbackCalls, 0);
    assert.deepEqual(control.events, ["close", "readBack"]);
    assert.deepEqual(failures.retained, []);
    assert.equal(control.reopenCalls, 0);
  }
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
