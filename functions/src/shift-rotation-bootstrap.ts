import {
  consumeRotationPositions,
  ShiftPlanningError,
  ShiftRotationCursor,
  ShiftRotationType,
} from "./shift-planning-contract.js";

type BootstrapMetadata = {
  revision: string;
  digest: string;
  provenance: string;
};

export type VersionedRotationStateEvidence = BootstrapMetadata & {
  rotation: ShiftRotationCursor;
};

export type RotationOwnerHistoryEntry = {
  type: ShiftRotationType;
  chronologySequence: number;
  roundNumber: number;
  positionInRound: number;
  rotationOwnerUserId: string;
  cohortUserIds: readonly string[];
  evidence: string;
};

export type RotationOwnerHistoryEvidence = BootstrapMetadata & {
  entries: readonly RotationOwnerHistoryEntry[];
};

export type ApprovedRotationMapping = BootstrapMetadata & {
  approvalStatus: "approved";
  type: ShiftRotationType;
  orderedUserIds: readonly string[];
  roundNumber: number;
  nextMemberIndex: number;
  stableTieOrder: readonly string[];
  evidence: string;
};

export type LegacyDeliveryHelperEvidence =
  | {
    kind: "unique";
    userId: string;
    evidenceRevision: string;
    evidenceDigest: string;
  }
  | {
    kind: "ambiguous";
    candidateUserIds: readonly string[];
    evidenceDigest: string;
  }
  | {
    kind: "ineligible";
    userId: string;
    evidenceDigest: string;
  };

export type ShiftRotationBootstrapInput = {
  type: ShiftRotationType;
  eligibleUserIds: readonly string[];
  versionedState?: VersionedRotationStateEvidence | null;
  ownerHistory?: RotationOwnerHistoryEvidence | null;
  approvedMapping?: ApprovedRotationMapping | null;
  isTrulyNewRotation: boolean;
  legacyDeliveryHelper?: LegacyDeliveryHelperEvidence | null;
};

export type ShiftRotationBootstrapResult = BootstrapMetadata & {
  source: "versionedState" | "ownerHistory" | "approvedMapping";
  rotation: ShiftRotationCursor;
};

const failLineage = (message: string): never => {
  throw new ShiftPlanningError("invalid_inherited_rotation_lineage", message);
};

const requireMetadata = (
  metadata: BootstrapMetadata,
  label: string,
): BootstrapMetadata => {
  const revision = metadata.revision.trim();
  const digest = metadata.digest.trim();
  const provenance = metadata.provenance.trim();
  if (!revision || !digest || !provenance) {
    return failLineage(`${label} requires revision, digest, and provenance.`);
  }
  return {revision, digest, provenance};
};

const requireExactUserIds = (
  values: readonly string[],
  label: string,
): string[] => {
  const userIds = values.map((userId) => userId.trim());
  if (
    userIds.length === 0 ||
    values.some((userId, index) => userId !== userIds[index]) ||
    userIds.some((userId) => !userId || userId.includes("/")) ||
    new Set(userIds).size !== userIds.length
  ) {
    throw new ShiftPlanningError(
      "invalid_rotation_cohort",
      `${label} must contain unique exact document-safe member ids.`,
    );
  }
  return userIds;
};

const sameOrderedValues = (
  left: readonly string[],
  right: readonly string[],
): boolean =>
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

const sameValueSet = (
  left: readonly string[],
  right: readonly string[],
): boolean =>
  left.length === right.length && new Set(left).size === left.length &&
  left.every((value) => right.includes(value));

const requireEligibleCohort = (
  cohortUserIds: readonly string[],
  eligibleUserIds: readonly string[],
  label: string,
): string[] => {
  const cohort = requireExactUserIds(cohortUserIds, label);
  if (!sameValueSet(cohort, eligibleUserIds)) {
    throw new ShiftPlanningError(
      "invalid_rotation_cohort",
      `${label} does not match the complete eligible roster.`,
    );
  }
  return cohort;
};

const normalizedRotation = (
  rotation: ShiftRotationCursor,
  type: ShiftRotationType,
  eligibleUserIds: readonly string[],
  label: string,
): ShiftRotationCursor => {
  if (rotation.type !== type) {
    throw new ShiftPlanningError(
      "invalid_rotation_type",
      `${label} belongs to a different shift type.`,
    );
  }
  const cohortUserIds = requireEligibleCohort(
    rotation.cohortUserIds,
    eligibleUserIds,
    `${label} cohort`,
  );
  return consumeRotationPositions({...rotation, cohortUserIds}, 0).nextRotation;
};

const resultFromState = (
  input: ShiftRotationBootstrapInput,
  state: VersionedRotationStateEvidence,
  eligibleUserIds: readonly string[],
): ShiftRotationBootstrapResult => {
  const metadata = requireMetadata(state, "Versioned rotation state");
  const rotation = normalizedRotation(
    state.rotation,
    input.type,
    eligibleUserIds,
    "Versioned rotation state",
  );
  return {source: "versionedState", rotation, ...metadata};
};

const resultFromHistory = (
  input: ShiftRotationBootstrapInput,
  history: RotationOwnerHistoryEvidence,
  eligibleUserIds: readonly string[],
): ShiftRotationBootstrapResult => {
  const metadata = requireMetadata(history, "Rotation owner history");
  if (history.entries.length === 0) {
    return failLineage("Rotation owner history is empty.");
  }
  const entries = [...history.entries].sort(
    (left, right) => left.chronologySequence - right.chronologySequence,
  );
  const first = entries[0];
  const cohortUserIds = requireEligibleCohort(
    first.cohortUserIds,
    eligibleUserIds,
    "Rotation owner history cohort",
  );
  const seenSequences = new Set<number>();
  const seenPositions = new Set<string>();

  entries.forEach((entry, index) => {
    if (
      entry.type !== input.type ||
      !Number.isSafeInteger(entry.chronologySequence) ||
      entry.chronologySequence < 0 ||
      entry.chronologySequence !== first.chronologySequence + index ||
      seenSequences.has(entry.chronologySequence) ||
      !entry.evidence.trim() ||
      !sameOrderedValues(entry.cohortUserIds, cohortUserIds)
    ) {
      failLineage("Rotation owner history chronology or cohort is ambiguous.");
    }
    const positionKey = `${entry.roundNumber}:${entry.positionInRound}`;
    if (seenPositions.has(positionKey)) {
      failLineage(
        "Rotation owner history contains a duplicate round position.",
      );
    }
    seenSequences.add(entry.chronologySequence);
    seenPositions.add(positionKey);
  });

  if (
    !Number.isSafeInteger(first.roundNumber) ||
    first.roundNumber < 1 ||
    !Number.isSafeInteger(first.positionInRound) ||
    first.positionInRound < 1 ||
    first.positionInRound > cohortUserIds.length
  ) {
    return failLineage(
      "Rotation owner history starts at an invalid round position.",
    );
  }
  const rotationBeforeHistory: ShiftRotationCursor = {
    schemaVersion: 1,
    type: input.type,
    cohortUserIds,
    roundNumber: first.roundNumber,
    nextMemberIndex: first.positionInRound - 1,
  };
  const expected = consumeRotationPositions(
    rotationBeforeHistory,
    entries.length,
  );
  const positionsMatch = expected.positions.every((position, index) => {
    const entry = entries[index];
    return entry.rotationOwnerUserId === position.rotationOwnerUserId &&
      entry.roundNumber === position.roundNumber &&
      entry.positionInRound === position.positionInRound;
  });
  if (!positionsMatch) {
    return failLineage(
      "Rotation owner history has gaps or conflicting owners.",
    );
  }
  return {
    source: "ownerHistory",
    rotation: expected.nextRotation,
    ...metadata,
  };
};

const resultFromMapping = (
  input: ShiftRotationBootstrapInput,
  mapping: ApprovedRotationMapping,
  eligibleUserIds: readonly string[],
): ShiftRotationBootstrapResult => {
  const metadata = requireMetadata(mapping, "Approved rotation mapping");
  if (
    mapping.approvalStatus !== "approved" ||
    mapping.type !== input.type ||
    !mapping.evidence.trim()
  ) {
    return failLineage(
      "Rotation mapping is not an approved evidenced mapping for this type.",
    );
  }
  const orderedUserIds = requireEligibleCohort(
    mapping.orderedUserIds,
    eligibleUserIds,
    "Approved rotation mapping cohort",
  );
  const stableTieOrder = requireExactUserIds(
    mapping.stableTieOrder,
    "Approved rotation mapping stable tie order",
  );
  if (!sameOrderedValues(orderedUserIds, stableTieOrder)) {
    return failLineage(
      "Stable tie order does not reproduce the approved member order.",
    );
  }
  const rotation = normalizedRotation({
    schemaVersion: 1,
    type: input.type,
    cohortUserIds: orderedUserIds,
    roundNumber: mapping.roundNumber,
    nextMemberIndex: mapping.nextMemberIndex,
  }, input.type, eligibleUserIds, "Approved rotation mapping");
  if (
    input.isTrulyNewRotation &&
    (rotation.roundNumber !== 1 || rotation.nextMemberIndex !== 0)
  ) {
    return failLineage(
      "A truly new rotation must start at round one and cursor zero.",
    );
  }
  return {source: "approvedMapping", rotation, ...metadata};
};

const requireDeliveryHelperContinuity = (
  input: ShiftRotationBootstrapInput,
  result: ShiftRotationBootstrapResult,
  eligibleUserIds: readonly string[],
): void => {
  if (input.type !== "delivery" || result.source === "versionedState") {
    return;
  }
  const helper = input.legacyDeliveryHelper || null;
  if (!helper) {
    if (!input.isTrulyNewRotation) {
      throw new ShiftPlanningError(
        "delivery_helper_evidence_ambiguous",
        "Existing delivery bootstrap requires explicit legacy helper evidence.",
      );
    }
    return;
  }
  if (helper.kind === "ambiguous") {
    throw new ShiftPlanningError(
      "delivery_helper_evidence_ambiguous",
      "Legacy delivery helper evidence is ambiguous.",
    );
  }
  if (
    helper.kind === "ineligible" ||
    !eligibleUserIds.includes(helper.userId) ||
    !result.rotation.cohortUserIds.includes(helper.userId)
  ) {
    throw new ShiftPlanningError(
      "delivery_helper_ineligible",
      "Legacy delivery helper is not eligible for this rotation.",
    );
  }
  if (!helper.evidenceRevision.trim() || !helper.evidenceDigest.trim()) {
    return failLineage(
      "Unique legacy helper evidence requires revision and digest.",
    );
  }
  const firstOwnerUserId = result.rotation.cohortUserIds[
    result.rotation.nextMemberIndex
  ];
  if (helper.userId !== firstOwnerUserId) {
    throw new ShiftPlanningError(
      "delivery_helper_cursor_conflict",
      "Legacy delivery helper conflicts with the selected rotation cursor.",
    );
  }
};

export const resolveShiftRotationBootstrap = (
  input: ShiftRotationBootstrapInput,
): ShiftRotationBootstrapResult => {
  if (input.type !== "delivery" && input.type !== "market") {
    throw new ShiftPlanningError(
      "invalid_rotation_type",
      "Bootstrap shift type is not supported.",
    );
  }
  const eligibleUserIds = requireExactUserIds(
    input.eligibleUserIds,
    "Eligible bootstrap roster",
  );
  if (
    input.isTrulyNewRotation &&
    (input.versionedState || input.ownerHistory)
  ) {
    return failLineage(
      "A truly new rotation cannot contain prior state or owner history.",
    );
  }

  let result: ShiftRotationBootstrapResult;
  if (input.versionedState) {
    // Present corrupt state is authoritative evidence of corruption. Never
    // bypass it through history or an approved mapping.
    result = resultFromState(input, input.versionedState, eligibleUserIds);
  } else if (input.ownerHistory) {
    try {
      result = resultFromHistory(input, input.ownerHistory, eligibleUserIds);
    } catch (error) {
      if (!input.approvedMapping || !(error instanceof ShiftPlanningError)) {
        throw error;
      }
      result = resultFromMapping(input, input.approvedMapping, eligibleUserIds);
    }
  } else if (input.approvedMapping) {
    result = resultFromMapping(input, input.approvedMapping, eligibleUserIds);
  } else {
    return failLineage(
      input.isTrulyNewRotation ?
        "A truly new rotation requires an explicit approved mapping." :
        "No reproducible rotation bootstrap source is available.",
    );
  }

  requireDeliveryHelperContinuity(input, result, eligibleUserIds);
  return result;
};
