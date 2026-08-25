const assert = require("node:assert/strict");
const {test} = require("node:test");

const {
  SHIFT_PLANNING_COMMUNICATION_BASELINE_SCHEMA_VERSION,
  SHIFT_PLANNING_COMMUNICATION_APPROVAL_MAX_VALIDITY_MS,
  createShiftPlanningApprovedMappingDigest,
  createShiftPlanningCommunicationSourceManifestDigest,
  createShiftPlanningCommunicationSourceRosterDigest,
  planShiftPlanningCommunicationBaseline,
  proposeShiftPlanningCommunicationBaseline,
  renderShiftPlanningAudienceSchedule,
  sealShiftPlanningCommunicationProposal,
} = require("../lib/shift-planning-communication-baseline.js");
const {
  createShiftPlanningDigest,
} = require("../lib/shift-planning-digest.js");

const lifecycleReferenceMillis = Date.now();
const lifecycleInstant = (offsetMillis) => new Date(
  lifecycleReferenceMillis + offsetMillis,
).toISOString();
const capturedAt = lifecycleInstant(-10 * 60_000);
const attestedAt = lifecycleInstant(-8 * 60_000);
const approvedAt = lifecycleInstant(-6 * 60_000);
const sealedAt = lifecycleInstant(-4 * 60_000);
const validUntil = lifecycleInstant(6 * 60_000);

const eligibleUserIds = ["a", "b", "c", "d", "e", "f"];

const member = (userId, displayName, overrides = {}) => ({
  userId,
  displayName,
  phone: `synthetic-phone-${userId}`,
  isActive: true,
  roles: ["member"],
  isCommonPurchaseManager: false,
  ...overrides,
});

const normalizedRoster = (roster) => roster.map((entry) => ({
  ...entry,
  roles: [...entry.roles].sort(),
})).sort((left, right) => left.userId.localeCompare(right.userId));

const approvedMapping = (type, orderedUserIds = eligibleUserIds) => {
  const payload = {
    revision: `${type}-mapping-r1`,
    provenance: "admin:test",
    approvalStatus: "approved",
    type,
    orderedUserIds,
    roundNumber: 1,
    nextMemberIndex: 0,
    stableTieOrder: [...orderedUserIds],
    evidence: `approved ${type} mapping`,
  };
  return {
    ...payload,
    digest: createShiftPlanningApprovedMappingDigest(payload),
  };
};

const refreshSourceManifest = (input) => {
  const payload = {
    schemaVersion: SHIFT_PLANNING_COMMUNICATION_BASELINE_SCHEMA_VERSION,
    captureId: "production-capture-2026-08-24",
    capturedAt,
    revision: "production-snapshot-r1",
    provenance: "test:exhaustive-production-snapshot",
    rosterDigest: createShiftPlanningCommunicationSourceRosterDigest(
      normalizedRoster(input.roster),
    ),
    deliveryWeekdayDigest: createShiftPlanningDigest({
      deliveryWeekday: input.delivery.deliveryWeekday,
    }),
    predecessorDigest: createShiftPlanningDigest(
      input.delivery.predecessor,
    ),
  };
  input.sourceManifest = {
    ...payload,
    manifestDigest:
      createShiftPlanningCommunicationSourceManifestDigest(payload),
  };
  return input;
};

const proposalInput = () => refreshSourceManifest({
  schemaVersion: SHIFT_PLANNING_COMMUNICATION_BASELINE_SCHEMA_VERSION,
  proposalId: "communication-proposal-2026-v1",
  environment: "production",
  targetSeasonStartYear: 2026,
  sourceManifest: null,
  roster: [
    member("a", "Persona Alfa"),
    member("b", "Persona Beta"),
    member("c", "Persona Gamma", {
      roles: ["producer", "member"],
      isCommonPurchaseManager: true,
    }),
    member("d", "Persona Delta"),
    member("e", "Persona Epsilon"),
    member("f", "Persona Zeta"),
    member("inactive", "Persona Inactiva", {isActive: false, phone: null}),
    member("producer", "Productor Sintético", {
      roles: ["member", "producer"],
      phone: null,
    }),
  ],
  delivery: {
    planningRequestId: "communication-delivery-2026",
    deliveryWeekday: "WED",
    approvedMapping: approvedMapping("delivery"),
    predecessor: {
      shiftId: "legacy-delivery-2026-08-26",
      scheduledDate: "2026-08-26",
      effectiveLeadUserId: "f",
      completion: {
        state: "uncompleted",
        assignmentRevision: 0,
        completionRevision: 0,
        plannedHelperUserId: null,
      },
    },
    legacyHelper: {
      kind: "unique",
      userId: "a",
      evidenceRevision: "helper-r1",
      evidenceDigest: "helper-d1",
    },
  },
  market: {
    planningRequestId: "communication-market-2026",
    approvedMapping: approvedMapping("market"),
  },
});

const approvalFor = (proposal, overrides = {}) => ({
  approvalStatus: "approved",
  scope: "global",
  approvedBy: "admin-1",
  approvedAt,
  evidence: "admin approved the complete proposal",
  proposalDigest: proposal.proposalDigest,
  planningDigest: proposal.planningDigest,
  validUntil,
  supersedesPlanningDigest: null,
  zeroWriteAttestation: {
    kind: "zeroWrite",
    attestedAt,
    firestoreWriteCount: 0,
    workbookWriteCount: 0,
    notificationDispatchCount: 0,
    evidence: "read-only capture audit",
  },
  ...overrides,
});

const sealRequest = (input, approval) => ({
  schemaVersion: SHIFT_PLANNING_COMMUNICATION_BASELINE_SCHEMA_VERSION,
  sealId: "communication-seal-2026-v1",
  sealedAt,
  proposalInput: input,
  approval,
});

const renderInputFor = (seal) => ({
  schemaVersion: SHIFT_PLANNING_COMMUNICATION_BASELINE_SCHEMA_VERSION,
  seal,
});

const errorCode = (expectedCode) => (error) =>
  error instanceof Error && error.code === expectedCode;

const objectKeys = (value, result = []) => {
  if (typeof value !== "object" || value === null) return result;
  for (const [key, child] of Object.entries(value)) {
    result.push(key);
    objectKeys(child, result);
  }
  return result;
};

test("validates the source manifest and returns a frozen proposal", () => {
  const input = proposalInput();
  const original = structuredClone(input);
  const first = proposeShiftPlanningCommunicationBaseline(input);
  const second = planShiftPlanningCommunicationBaseline(
    structuredClone(input),
  );

  assert.deepEqual(input, original);
  assert.deepEqual(first, second);
  assert.equal(first.schemaVersion, 2);
  assert.equal(first.status, "proposal");
  assert.equal(first.rosterDigest, input.sourceManifest.rosterDigest);
  assert.equal(
    first.delivery.approvedMappingDigest,
    input.delivery.approvedMapping.digest,
  );
  assert.equal(
    first.market.approvedMappingDigest,
    input.market.approvedMapping.digest,
  );
  assert.deepEqual(
    first.eligibilityRoster
      .filter((entry) => entry.isActive)
      .filter((entry) =>
        !entry.roles.includes("producer") || entry.isCommonPurchaseManager
      )
      .map((entry) => entry.userId),
    eligibleUserIds,
  );
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.delivery.plan.shifts), true);
});

test("keeps delivery continuity and complete market assignments in the proposal", () => {
  const proposal = proposeShiftPlanningCommunicationBaseline(proposalInput());
  const delivery = proposal.delivery.plan;
  const market = proposal.market.plan;

  assert.equal(delivery.shifts.length, 54);
  assert.equal(delivery.shifts[0].date, "2026-09-02");
  assert.equal(delivery.shifts[0].assignedUserIds[0], "a");
  assert.equal(delivery.shifts[0].helperUserId, "b");
  assert.equal(delivery.shifts[51].date, "2027-08-25");
  assert.equal(delivery.shifts.at(-1).date, "2027-09-08");
  assert.deepEqual(delivery.predecessorHelperUpdate, {
    shiftId: "legacy-delivery-2026-08-26",
    helperUserId: "a",
  });
  assert.equal(delivery.nextRotation.nextMemberIndex, 0);

  assert.equal(market.shifts.length, 10);
  assert.equal(market.shifts[0].date, "2026-09-19");
  assert.deepEqual(market.shifts[0].assignedUserIds, ["a", "b", "c"]);
  assert.equal(market.shifts.at(-1).date, "2027-06-19");
  assert.equal(market.shifts.every((shift) =>
    new Set(shift.assignedUserIds).size === 3
  ), true);
});

test("rejects source drift against every captured source digest", () => {
  const rosterDrift = proposalInput();
  rosterDrift.roster[0].displayName = "Persona Alfa Revisada";
  assert.throws(
    () => proposeShiftPlanningCommunicationBaseline(rosterDrift),
    errorCode("shift_communication_source_manifest_mismatch"),
  );

  const weekdayDrift = proposalInput();
  weekdayDrift.delivery.deliveryWeekday = "THU";
  assert.throws(
    () => proposeShiftPlanningCommunicationBaseline(weekdayDrift),
    errorCode("shift_communication_source_manifest_mismatch"),
  );

  const predecessorDrift = proposalInput();
  predecessorDrift.delivery.predecessor.effectiveLeadUserId = "e";
  assert.throws(
    () => proposeShiftPlanningCommunicationBaseline(predecessorDrift),
    errorCode("shift_communication_source_manifest_mismatch"),
  );
});

test("rejects manipulated manifest and approved-mapping digests", () => {
  const manifest = proposalInput();
  manifest.sourceManifest.revision = "production-snapshot-tampered";
  assert.throws(
    () => proposeShiftPlanningCommunicationBaseline(manifest),
    errorCode("invalid_shift_communication_source_manifest"),
  );

  for (const type of ["delivery", "market"]) {
    const mapping = proposalInput();
    mapping[type].approvedMapping.evidence = "tampered approval evidence";
    assert.throws(
      () => proposeShiftPlanningCommunicationBaseline(mapping),
      errorCode("shift_communication_mapping_digest_mismatch"),
    );
  }
});

test("requires an exact approved mapping instead of inferring an order", () => {
  const input = proposalInput();
  input.delivery.approvedMapping.approvalStatus = "draft";

  assert.throws(
    () => proposeShiftPlanningCommunicationBaseline(input),
    errorCode("invalid_shift_communication_baseline_input"),
  );
});

test("rejects incomplete, duplicate, or incommunicable eligible rosters", () => {
  const incompleteMapping = proposalInput();
  incompleteMapping.market.approvedMapping = approvedMapping(
    "market",
    eligibleUserIds.slice(0, -1),
  );
  assert.throws(
    () => proposeShiftPlanningCommunicationBaseline(incompleteMapping),
    errorCode("invalid_rotation_cohort"),
  );

  const duplicateIdentity = proposalInput();
  duplicateIdentity.roster.push(member("a", "Persona Alfa Duplicada"));
  refreshSourceManifest(duplicateIdentity);
  assert.throws(
    () => proposeShiftPlanningCommunicationBaseline(duplicateIdentity),
    errorCode("invalid_shift_communication_baseline_input"),
  );

  const missingName = proposalInput();
  missingName.roster[0].displayName = null;
  refreshSourceManifest(missingName);
  assert.throws(
    () => proposeShiftPlanningCommunicationBaseline(missingName),
    errorCode("incommunicable_shift_roster"),
  );

  const duplicateLabel = proposalInput();
  duplicateLabel.roster[1].displayName = "ＰＥＲＳＯＮＡ　ＡＬＦＡ";
  refreshSourceManifest(duplicateLabel);
  assert.throws(
    () => proposeShiftPlanningCommunicationBaseline(duplicateLabel),
    errorCode("incommunicable_shift_roster"),
  );
});

test("seals only the exact globally approved proposal with zero writes", () => {
  const input = proposalInput();
  const proposal = proposeShiftPlanningCommunicationBaseline(input);
  const approval = approvalFor(proposal);
  const seal = sealShiftPlanningCommunicationProposal(
    sealRequest(input, approval),
  );

  assert.equal(seal.status, "sealed");
  assert.equal(seal.sealedAt, sealedAt);
  assert.equal(seal.validUntil, validUntil);
  assert.equal(seal.supersedesPlanningDigest, null);
  assert.equal(seal.validUntil, seal.approval.validUntil);
  assert.equal(
    seal.supersedesPlanningDigest,
    seal.approval.supersedesPlanningDigest,
  );
  assert.equal(seal.proposal.status, "proposal");
  assert.equal(seal.proposal.proposalDigest, proposal.proposalDigest);
  assert.equal(seal.approval.approvalStatus, "approved");
  assert.equal(seal.approval.scope, "global");
  assert.deepEqual(
    {
      firestore: seal.approval.zeroWriteAttestation.firestoreWriteCount,
      workbook: seal.approval.zeroWriteAttestation.workbookWriteCount,
      notifications:
        seal.approval.zeroWriteAttestation.notificationDispatchCount,
    },
    {firestore: 0, workbook: 0, notifications: 0},
  );
  assert.match(
    seal.sealDigest,
    /^shift-planning:v1:sha256:[a-f0-9]{64}$/,
  );
  assert.equal(Object.isFrozen(seal), true);
  assert.equal(Object.isFrozen(seal.approval.zeroWriteAttestation), true);
  assert.equal(
    seal.proposalInput.roster.every((entry) => entry.phone === null),
    true,
  );
});

test("requires coherent seal chronology, validity, and supersession", () => {
  const input = proposalInput();
  const proposal = proposeShiftPlanningCommunicationBaseline(input);
  const approval = approvalFor(proposal);

  assert.throws(
    () => sealShiftPlanningCommunicationProposal({
      ...sealRequest(input, approval),
      sealedAt: approvedAt,
    }),
    errorCode("invalid_shift_communication_seal"),
  );
  const expiredApproval = approvalFor(proposal, {
    validUntil: approvedAt,
  });
  assert.throws(
    () => sealShiftPlanningCommunicationProposal(
      sealRequest(input, expiredApproval),
    ),
    errorCode("shift_communication_approval_mismatch"),
  );
  const overlongApproval = approvalFor(proposal, {
    validUntil: new Date(
      Date.parse(approvedAt) +
        SHIFT_PLANNING_COMMUNICATION_APPROVAL_MAX_VALIDITY_MS + 1,
    ).toISOString(),
  });
  assert.throws(
    () => sealShiftPlanningCommunicationProposal(
      sealRequest(input, overlongApproval),
    ),
    errorCode("shift_communication_approval_mismatch"),
  );
  const selfSupersedingApproval = approvalFor(proposal, {
    supersedesPlanningDigest: proposal.planningDigest,
  });
  assert.throws(
    () => sealShiftPlanningCommunicationProposal(
      sealRequest(input, selfSupersedingApproval),
    ),
    errorCode("shift_communication_approval_mismatch"),
  );
});

test("rejects stale approvals and any non-zero write attestation", () => {
  const input = proposalInput();
  const proposal = proposeShiftPlanningCommunicationBaseline(input);

  const wrongPlanningDigest = approvalFor(proposal, {
    planningDigest: createShiftPlanningDigest({planning: "other"}),
  });
  assert.throws(
    () => sealShiftPlanningCommunicationProposal(
      sealRequest(input, wrongPlanningDigest),
    ),
    errorCode("shift_communication_approval_mismatch"),
  );

  const nonZeroApproval = approvalFor(proposal);
  nonZeroApproval.zeroWriteAttestation.firestoreWriteCount = 1;
  assert.throws(
    () => sealShiftPlanningCommunicationProposal(
      sealRequest(input, nonZeroApproval),
    ),
    errorCode("invalid_shift_communication_zero_write_attestation"),
  );

  const driftedInput = structuredClone(input);
  driftedInput.roster[0].displayName = "Persona Alfa Revisada";
  refreshSourceManifest(driftedInput);
  assert.throws(
    () => sealShiftPlanningCommunicationProposal(
      sealRequest(driftedInput, approvalFor(proposal)),
    ),
    errorCode("shift_communication_approval_mismatch"),
  );
});

test("renders only a revalidated seal inside its approved validity window", () => {
  const input = proposalInput();
  const proposal = proposeShiftPlanningCommunicationBaseline(input);
  assert.throws(
    () => renderShiftPlanningAudienceSchedule(proposal),
    errorCode("invalid_shift_communication_seal"),
  );

  const seal = sealShiftPlanningCommunicationProposal(
    sealRequest(input, approvalFor(proposal)),
  );
  assert.throws(
    () => renderShiftPlanningAudienceSchedule(seal),
    errorCode("invalid_shift_communication_seal"),
  );

  assert.throws(
    () => renderShiftPlanningAudienceSchedule({
      ...renderInputFor(seal),
      sealState: {status: "current"},
    }),
    errorCode("invalid_shift_communication_seal"),
  );

  const futureSeal = sealShiftPlanningCommunicationProposal({
    ...sealRequest(input, approvalFor(proposal)),
    sealedAt: lifecycleInstant(60_000),
  });
  assert.throws(
    () => renderShiftPlanningAudienceSchedule(renderInputFor(futureSeal)),
    errorCode("invalid_shift_communication_seal"),
  );

  const expiredApproval = approvalFor(proposal, {
    validUntil: lifecycleInstant(-1_000),
  });
  const expiredSeal = sealShiftPlanningCommunicationProposal(
    sealRequest(input, expiredApproval),
  );
  assert.throws(
    () => renderShiftPlanningAudienceSchedule(
      renderInputFor(expiredSeal),
    ),
    errorCode("invalid_shift_communication_seal"),
  );
});

test("renders only human-facing rows without ids, digests, or metadata", () => {
  const input = proposalInput();
  const proposal = proposeShiftPlanningCommunicationBaseline(input);
  const seal = sealShiftPlanningCommunicationProposal(
    sealRequest(input, approvalFor(proposal)),
  );
  const audience = renderShiftPlanningAudienceSchedule(renderInputFor(seal));
  assert.deepEqual(Object.keys(audience), ["deliveryRows", "marketRows"]);
  assert.equal(audience.deliveryRows[0].ownerDisplayName, "Persona Alfa");
  assert.deepEqual(Object.keys(audience.deliveryRows[0]), [
    "date",
    "projectionSeasonStartYear",
    "roundNumber",
    "ownerDisplayName",
  ]);
  assert.equal(audience.deliveryRows[0].roundNumber, 1);
  assert.deepEqual(
    audience.marketRows[0].ownerDisplayNames,
    ["Persona Alfa", "Persona Beta", "Persona Gamma"],
  );
  assert.deepEqual(Object.keys(audience.marketRows[0]), [
    "date",
    "projectionSeasonStartYear",
    "ownerDisplayNames",
  ]);
  const keys = objectKeys(audience);
  const forbiddenMetadataKeys = new Set([
    "schemaversion",
    "status",
    "environment",
    "proposal",
    "seal",
    "approval",
    "sourcemanifest",
    "evidence",
    "revision",
    "provenance",
    "planningrequestid",
    "phone",
  ]);
  assert.equal(keys.some((key) => {
    const normalizedKey = key.toLowerCase();
    return normalizedKey === "id" ||
      normalizedKey.endsWith("id") ||
      normalizedKey.endsWith("ids") ||
      normalizedKey.includes("digest") ||
      forbiddenMetadataKeys.has(normalizedKey);
  }), false);
  const serialized = JSON.stringify(audience);
  for (const privateValue of [
    seal.sealId,
    proposal.proposalId,
    proposal.inputDigest,
    proposal.assignmentDigest,
    proposal.resolverDigest,
    proposal.planningDigest,
    proposal.proposalDigest,
    seal.sealDigest,
    input.sourceManifest.captureId,
    input.delivery.planningRequestId,
    input.market.planningRequestId,
  ]) {
    assert.equal(serialized.includes(privateValue), false);
  }
  assert.equal(serialized.includes("shift-planning:v1:sha256:"), false);
  for (const rosterMember of input.roster) {
    if (rosterMember.phone) {
      assert.equal(serialized.includes(rosterMember.phone), false);
    }
  }
  assert.equal(Object.isFrozen(audience), true);

  const tamperedSeal = structuredClone(seal);
  tamperedSeal.proposal.delivery.plan.shifts[0].assignedUserIds[0] = "b";
  assert.throws(
    () => renderShiftPlanningAudienceSchedule(
      renderInputFor(tamperedSeal),
    ),
    errorCode("invalid_shift_communication_seal"),
  );
});

test("display-name changes preserve assignments but require new planning approval", () => {
  const before = proposeShiftPlanningCommunicationBaseline(proposalInput());
  const correctedInput = proposalInput();
  correctedInput.roster[0].displayName = "Persona Alfa Revisada";
  refreshSourceManifest(correctedInput);
  const after = proposeShiftPlanningCommunicationBaseline(correctedInput);

  assert.equal(before.assignmentDigest, after.assignmentDigest);
  assert.notEqual(before.resolverDigest, after.resolverDigest);
  assert.notEqual(before.planningDigest, after.planningDigest);
  assert.notEqual(before.proposalDigest, after.proposalDigest);
  assert.deepEqual(before.delivery.plan, after.delivery.plan);
  assert.deepEqual(before.market.plan, after.market.plan);
});

test("contact-only phone changes do not alter any planning artifact", () => {
  const beforeInput = proposalInput();
  const before = proposeShiftPlanningCommunicationBaseline(beforeInput);
  const afterInput = structuredClone(beforeInput);
  afterInput.roster[0].phone = "synthetic-phone-updated";
  const after = proposeShiftPlanningCommunicationBaseline(afterInput);

  assert.deepEqual(after, before);
  assert.equal(after.assignmentDigest, before.assignmentDigest);
  assert.equal(after.resolverDigest, before.resolverDigest);
  assert.equal(after.planningDigest, before.planningDigest);
  assert.equal(after.proposalDigest, before.proposalDigest);
});

test("planning digest explicitly seals source-manifest lineage", () => {
  const beforeInput = proposalInput();
  const before = proposeShiftPlanningCommunicationBaseline(beforeInput);
  assert.equal(
    before.planningDigest,
    createShiftPlanningDigest({
      schemaVersion: SHIFT_PLANNING_COMMUNICATION_BASELINE_SCHEMA_VERSION,
      sourceManifestDigest: before.sourceManifest.manifestDigest,
      assignmentDigest: before.assignmentDigest,
      resolverDigest: before.resolverDigest,
    }),
  );

  const revisedInput = structuredClone(beforeInput);
  const revisedManifestPayload = {
    schemaVersion: revisedInput.sourceManifest.schemaVersion,
    captureId: revisedInput.sourceManifest.captureId,
    capturedAt: revisedInput.sourceManifest.capturedAt,
    revision: "production-snapshot-r2",
    provenance: revisedInput.sourceManifest.provenance,
    rosterDigest: revisedInput.sourceManifest.rosterDigest,
    deliveryWeekdayDigest:
      revisedInput.sourceManifest.deliveryWeekdayDigest,
    predecessorDigest: revisedInput.sourceManifest.predecessorDigest,
  };
  revisedInput.sourceManifest = {
    ...revisedManifestPayload,
    manifestDigest: createShiftPlanningCommunicationSourceManifestDigest(
      revisedManifestPayload,
    ),
  };
  const after = proposeShiftPlanningCommunicationBaseline(revisedInput);

  assert.equal(before.assignmentDigest, after.assignmentDigest);
  assert.equal(before.resolverDigest, after.resolverDigest);
  assert.notEqual(
    before.sourceManifest.manifestDigest,
    after.sourceManifest.manifestDigest,
  );
  assert.notEqual(before.planningDigest, after.planningDigest);
  assert.notEqual(before.proposalDigest, after.proposalDigest);
});
