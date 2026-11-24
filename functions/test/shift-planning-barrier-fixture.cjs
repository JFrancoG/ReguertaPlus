const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {createShiftPlanningControlManifestDigest} = require("../lib/shift-planning-intake-barrier.js");
const {SHIFT_PLANNING_INTAKE_BARRIER_WRITERS, SHIFT_PLANNING_RULES_DENIED_WRITER_IDS,
  SHIFT_PLANNING_WRITER_INVENTORY_DIGEST, SHIFT_PLANNING_WRITER_INVENTORY_REVISION} =
  require("../lib/shift-planning-writer-inventory.js");

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

module.exports = {scope, evidence};
