import type {AppEnvironment} from "./backend-security.js";
import {isRegisteredProvisionalCreditFirestore, requireOrdinaryShiftCreditPlan,
  requireProvisionalCreditPublication, requireShiftCreditPlanningAccess,
  ShiftCreditPlanningAccess} from "./shift-credit-planning-context.js";
export {createProvisionalCreditFirestore, requireProvisionalCreditPublication,
  requireRegisteredProvisionalCreditFirestore} from
  "./shift-credit-planning-context.js";
import {assertShiftMembershipPlanningSource,
  captureShiftMembershipPlanningSource, parseShiftMembershipPlanningSource,
  ShiftMembershipPlanningSource, ShiftMembershipPlanningChange} from
  "./shift-membership-planning.js";
import {assertNoUnreconciledMembershipEntries} from
  "./shift-membership-eligibility-time.js";
import {assertNoPendingShiftMembership} from
  "./shift-membership-reconciliation.js";
import {consumeRotationPositions, RotationProjectionPrefix,
  rotationOwnerPositionKey} from
  "./shift-planning-contract.js";
import {ShiftRotationAggregateWire} from "./shift-planning-wire.js";
import {parseShiftPlanningPublicShiftDocument,
  ShiftPlanningPublicShiftDocument} from
  "./shift-planning-publication-contract.js";
import {DocumentSnapshot, Firestore, Transaction} from
  "@google-cloud/firestore";
import {coverageId, rejectCoverage, ShiftCoverageCredit,
  SHIFT_COVERAGE_POLICY_REVISION} from "./shift-coverage.js";
import {parseShiftCoverageCredit} from "./shift-credit-unit.js";
import {ProvisionalSeasonCredits, ShiftSeasonCreditProjection} from
  "./shift-credit-season.js";
import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";

type Data = Record<string, unknown>;
type Claim = {id: string; data: Data};
export type ShiftCreditPublicationSource = ProvisionalSeasonCredits & {
  ledger: {revision: number} | null;
  claims: Claim[];
};
export type ShiftCreditPublicationSources = {
  environment?: AppEnvironment;
  activationDigest?: string;
  delivery: ShiftCreditPublicationSource;
  market: ShiftCreditPublicationSource;
  membership?: ShiftMembershipPlanningSource;
};
export type ShiftCreditPublication = {
  policyRevision: typeof SHIFT_COVERAGE_POLICY_REVISION;
  planId: string;
  sources: ShiftCreditPublicationSources;
  changes: {targetPath: string; before: Data; after: Data}[];
  excusedOwnerPositionKeys?: string[];
};
const publishedPositionKeys = (shift: ShiftPlanningPublicShiftDocument) => {
  const positions = shift.type === "delivery" ? [{
    rotationOwnerUserId: shift.rotationOwnerUserId ?? "",
    roundNumber: shift.roundNumber ?? 0,
    positionInRound: shift.positionInRound ?? 0}] :
    shift.rotationPositions ?? [];
  return positions.map((position) => rotationOwnerPositionKey(
    shift.type, position));
};
type MembershipCandidates = {
  rotations: {delivery: ShiftRotationAggregateWire;
    market: ShiftRotationAggregateWire};
  users?: readonly DocumentSnapshot[];
  plannedMemberIds?: readonly string[];
};

const assertReconciledCandidates = async (
  db: Firestore, transaction: Transaction, known: ReadonlySet<string>,
  candidates: MembershipCandidates, environment: AppEnvironment,
) => {
  const root = `${environment}/plus-collections`;
  const delivery = candidates.rotations.delivery.cursor.cohortUserIds;
  const market = new Set(candidates.rotations.market.cursor.cohortUserIds);
  const inBoth = new Set(delivery.filter((id) => market.has(id)));
  let users = candidates.users;
  if (!users) {
    // A staged forward has no raw roster. Check the old and planned cohorts.
    const ids = new Set([...delivery, ...market,
      ...(candidates.plannedMemberIds ?? [])]);
    const refs = [...ids].filter((id) => !known.has(id))
      .map((id) => db.doc(`${root}/users/${id}`));
    users = refs.length ? await transaction.getAll(...refs) : [];
  }
  if (users.some((member) => member.ref.firestore !== db ||
      member.ref.parent.path !== `${root}/users`)) {
    return rejectCoverage("invalid_membership_source");
  }
  await assertNoUnreconciledMembershipEntries(
    transaction, users, known, inBoth);
};

/**
 * Ordinary bundles cannot acknowledge transitions or spend credits. Reject a
 * stale ordinary bundle if a shared coverage authority has since been enabled.
 * @param {object} input Transaction and the server-bound SDK environment.
 */
export const assertProvisionalShiftMembershipSource = async (
  input: ShiftCreditPlanningAccess & {
    membershipCandidates?: MembershipCandidates},
) => {
  await requireOrdinaryShiftCreditPlan(input);
  if (isRegisteredProvisionalCreditFirestore(input.firestore)) {
    const environment = input.environment ?? "develop";
    requireProvisionalCreditPublication(environment);
    const known = await assertNoPendingShiftMembership(
      input.firestore, input.transaction, environment);
    if (input.membershipCandidates) {
      await assertReconciledCandidates(input.firestore, input.transaction,
        known, input.membershipCandidates, environment);
    }
  }
};

const claimId = (type: string, id: string) => digest([type, id])
  .slice("shift-planning:v1:sha256:".length);

export const parseShiftCreditPublicationSources = (
  value: unknown,
  environment: string,
): ShiftCreditPublicationSources => {
  const sources = value as ShiftCreditPublicationSources;
  if (!sources || typeof sources !== "object" || Array.isArray(sources)) {
    return rejectCoverage("invalid_credit_publication_source");
  }
  const shared = "environment" in sources || "activationDigest" in sources;
  if (shared) {
    if (!["develop", "production"].includes(environment) ||
        sources.environment !== environment ||
        typeof sources.activationDigest !== "string" ||
        !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(
          sources.activationDigest)) {
      return rejectCoverage("invalid_credit_publication_source");
    }
  } else {
    requireProvisionalCreditPublication(environment);
  }
  const fields = ["delivery", "market"];
  if (shared) fields.push("environment", "activationDigest");
  if ("membership" in sources) fields.push("membership");
  if (Object.keys(sources).sort().join() !== fields.sort().join()) {
    return rejectCoverage("invalid_credit_publication_source");
  }
  if ("membership" in sources) {
    parseShiftMembershipPlanningSource(sources.membership);
  }
  for (const type of ["delivery", "market"] as const) {
    const source = sources[type];
    const keys = source && Object.keys(source).sort().join();
    if (!source || !["claims,credits,frozenThroughRound,ledger",
      "claims,credits,frozenThroughRound,inheritedUnits,ledger"]
      .includes(keys) ||
        !Array.isArray(source.credits) || !Array.isArray(source.claims) ||
        source.credits.length > 1000 || source.claims.length > 1000 ||
        !Number.isSafeInteger(source.frozenThroughRound) ||
        source.frozenThroughRound < 0) {
      return rejectCoverage("invalid_credit_publication_source");
    }
    if (source.ledger !== null &&
        (Object.keys(source.ledger).join() !== "revision" ||
          !Number.isSafeInteger(source.ledger.revision) ||
          source.ledger.revision < 0 ||
          source.ledger.revision >= Number.MAX_SAFE_INTEGER - 1)) {
      return rejectCoverage("invalid_credit_plan_revision");
    }
    const credits = source.credits.map(parseShiftCoverageCredit);
    if (new Set(credits.map((credit) => credit.id)).size !== credits.length ||
        credits.some((credit) => credit.type !== type) ||
        (credits.length > 0 && !source.ledger?.revision)) {
      return rejectCoverage("invalid_credit_publication_source");
    }
    const claims = source.claims;
    if (new Set(claims.map((claim) => claim.id)).size !== claims.length) {
      return rejectCoverage("invalid_coverage_claim");
    }
    for (const claim of claims) {
      const data = claim.data;
      if (Object.keys(claim).sort().join() !== "data,id" ||
          !data || data.type !== type ||
          claim.id !== claimId(type, coverageId(data.userId)) ||
          !["accepted", "creditPending", "released"].includes(
            String(data.state))) {
        return rejectCoverage("invalid_coverage_claim");
      }
      coverageId(data.caseId);
      if (data.state === "released") {
        if (!isReleasedShiftCoverageClaim(data) || !credits.some((credit) =>
          credit.id === data.caseId && credit.userId === data.userId &&
          (credit.state === "consumed" ?
            credit.consumedByPlanId === data.consumedByPlanId &&
            credit.consumedAtMillis === data.consumedAtMillis :
            credit.state === "cancelled" &&
            credit.cancelledByMembershipOperationId ===
              data.cancelledByMembershipOperationId &&
            credit.cancelledAtMillis === data.cancelledAtMillis))) {
          return rejectCoverage("invalid_coverage_claim");
        }
      } else if (Object.keys(data).sort().join() !==
          "caseId,state,type,userId") {
        return rejectCoverage("invalid_coverage_claim");
      }
    }
    for (const credit of credits.filter((item) => item.state === "pending")) {
      const claim = claims.find((item) =>
        item.id === claimId(type, credit.userId))?.data;
      if (claim?.caseId !== credit.id || claim.state !== "creditPending") {
        return rejectCoverage("credit_claim_changed");
      }
    }
  }
  return structuredClone(sources);
};

// Released claims are retained for exact inverse CAS, but no longer block.
export const isReleasedShiftCoverageClaim = (value: unknown): boolean => {
  const claim = value as Data | undefined;
  if (!claim || claim.state !== "released" ||
      !["delivery", "market"].includes(String(claim.type))) return false;
  const cancelled = Object.keys(claim).sort().join() ===
    "cancelledAtMillis,cancelledByMembershipOperationId,caseId," +
    "state,type,userId";
  if (!cancelled && Object.keys(claim).sort().join() !==
      "caseId,consumedAtMillis,consumedByPlanId,state,type,userId") {
    return false;
  }
  const operationId = cancelled ? claim.cancelledByMembershipOperationId :
    claim.consumedByPlanId;
  const time = cancelled ? claim.cancelledAtMillis : claim.consumedAtMillis;
  return [claim.caseId, claim.userId, operationId].every((id) =>
    typeof id === "string" &&
      /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id)) &&
    Number.isSafeInteger(time) && (time as number) >= 0;
};

export const buildShiftCreditPublication = (input: {
  sources: ShiftCreditPublicationSources;
  environment?: AppEnvironment;
  delivery: ShiftSeasonCreditProjection;
  market: ShiftSeasonCreditProjection;
  planId: string;
  membershipChanges?: ShiftMembershipPlanningChange[];
}): ShiftCreditPublication => {
  coverageId(input.planId);
  const environment = input.environment ?? "develop";
  const root = `${environment}/plus-collections`;
  if ((input.sources.environment ?? "develop") !== environment) {
    return rejectCoverage("invalid_credit_publication_source");
  }
  const changes: ShiftCreditPublication["changes"] =
    [...input.membershipChanges ?? []];
  const membership = new Set(input.sources.membership?.records.map((record) =>
    `${root}/shiftMembershipState/${record.id}`));
  if (changes.some((change) => !membership.has(change.targetPath))) {
    return rejectCoverage("membership_plan_source_changed");
  }
  for (const type of ["delivery", "market"] as const) {
    const source = input.sources[type];
    const projection = input[type];
    for (const id of projection.consumedCreditIds) {
      const credit = source.credits.find((item) => item.id === id);
      const claim = source.claims.find((item) => item.data.caseId === id &&
        item.data.userId === credit?.userId &&
        item.data.state === "creditPending");
      if (!credit || credit.state !== "pending" || !claim) {
        return rejectCoverage("credit_claim_changed");
      }
      changes.push({targetPath: `${root}/shiftCoverageCredits/${id}`,
        before: {...credit}, after: {...credit, state: "consumed",
          consumedByPlanId: input.planId}},
      {targetPath: `${root}/shiftCoverageMemberClaims/${claim.id}`,
        before: claim.data, after: {...claim.data, state: "released",
          consumedByPlanId: input.planId}});
    }
    if (projection.consumedCreditIds.length) {
      if (!source.ledger) return rejectCoverage("invalid_credit_plan_revision");
      changes.push({targetPath: `${root}/shiftCoverageLedgerState/${type}`,
        before: source.ledger, after: {revision: source.ledger.revision + 1}});
    }
  }
  if (new Set(changes.map((change) => change.targetPath)).size !==
      changes.length) {
    return rejectCoverage("credit_plan_source_changed");
  }
  const excusedOwnerPositionKeys = ["delivery", "market"].flatMap((type) =>
    input[type as "delivery" | "market"].units.flatMap((unit) =>
      unit.servedPositions.filter((position) => position.excuse).map(
        (position) => rotationOwnerPositionKey(unit.type, position))));
  if (new Set(excusedOwnerPositionKeys).size !==
      excusedOwnerPositionKeys.length) {
    return rejectCoverage("membership_duplicate_omission");
  }
  return {policyRevision: SHIFT_COVERAGE_POLICY_REVISION, planId: input.planId,
    sources: input.sources, changes,
    ...(excusedOwnerPositionKeys.length ? {excusedOwnerPositionKeys} : {})};
};

export const shiftCreditPublicationAfter = (
  change: ShiftCreditPublication["changes"][number],
  activatedAtMillis: number,
): Data => {
  if (!Number.isSafeInteger(activatedAtMillis) || activatedAtMillis < 0 ||
      (typeof change.before.earnedAtMillis === "number" &&
        activatedAtMillis < change.before.earnedAtMillis)) {
    return rejectCoverage("invalid_coverage_credit");
  }
  return (change.targetPath.includes("/shiftCoverageLedgerState/") ||
    change.targetPath.includes("/shiftMembershipState/")) ?
    change.after : {...change.after, consumedAtMillis: activatedAtMillis};
};

/**
 * Bind complete ledgers/claims, including non-consumed credits, on every SDK
 * retry. These transaction reads also fence a new credit or accepted coverage
 * inserted after stage or activation. The caller queues no writes beforehand.
 * @param {object} input Same-attempt source and activation time for inverse.
 */
export const assertShiftCreditPublicationSource = async (input:
  ShiftCreditPlanningAccess & {
  publication: ShiftCreditPublication;
  activatedAtMillis?: number;
  membershipCandidates?: MembershipCandidates;
}) => {
  const environment = input.environment ?? "develop";
  const root = `${environment}/plus-collections`;
  const activationDigest = await requireShiftCreditPlanningAccess(input);
  const sources = input.publication.sources;
  if (sources.activationDigest !== activationDigest || sources.environment !==
      (activationDigest ? environment : undefined)) {
    return rejectCoverage("credit_plan_source_changed");
  }
  if (input.publication.excusedOwnerPositionKeys?.length) {
    const shifts = await input.transaction.get(input.firestore.collection(
      `${root}/shifts`).limit(1001));
    if (shifts.size > 1000) return rejectCoverage("credit_source_limit");
    const published = shifts.docs.flatMap((doc) => publishedPositionKeys(
      parseShiftPlanningPublicShiftDocument({targetPath: doc.ref.path,
        value: doc.data()})));
    if (input.publication.excusedOwnerPositionKeys.some((key) =>
      published.includes(key))) {
      return rejectCoverage("membership_position_already_published");
    }
  }
  await assertShiftMembershipPlanningSource({...input,
    source: input.publication.sources.membership,
    activatedChanges: input.activatedAtMillis === undefined ? undefined :
      input.publication.changes});
  if (input.membershipCandidates) {
    const known = new Set(input.publication.sources.membership?.records
      .map((record) => record.id));
    await assertReconciledCandidates(input.firestore, input.transaction,
      known, input.membershipCandidates, environment);
  }
  const allowedPaths = new Set(sources.membership?.records.map((record) =>
    `${root}/shiftMembershipState/${record.id}`));
  for (const type of ["delivery", "market"] as const) {
    const source = input.publication.sources[type];
    const expected = new Map<string, unknown>([
      [`${root}/shiftCoverageLedgerState/${type}`, source.ledger],
      ...source.credits.map((credit): [string, ShiftCoverageCredit] =>
        [`${root}/shiftCoverageCredits/${credit.id}`, credit]),
      ...source.claims.map((claim): [string, Data] =>
        [`${root}/shiftCoverageMemberClaims/${claim.id}`, claim.data]),
    ]);
    for (const [path, value] of expected) {
      if (value !== null) allowedPaths.add(path);
    }
    if (input.activatedAtMillis !== undefined) {
      for (const change of input.publication.changes) {
        if (expected.has(change.targetPath)) {
          expected.set(change.targetPath,
            shiftCreditPublicationAfter(change, input.activatedAtMillis));
        }
      }
    }
    const ledger = await input.transaction.get(
      input.firestore.doc(`${root}/shiftCoverageLedgerState/${type}`));
    const actual = new Map<string, unknown>([[ledger.ref.path,
      ledger.data() ?? null]]);
    for (const collection of ["shiftCoverageCredits",
      "shiftCoverageMemberClaims"]) {
      const snapshot = await input.transaction.get(input.firestore
        .collection(`${root}/${collection}`).where("type", "==", type)
        .limit(1001));
      if (snapshot.size > 1000) return rejectCoverage("credit_source_limit");
      for (const doc of snapshot.docs) actual.set(doc.ref.path, doc.data());
    }
    if (actual.size !== expected.size || [...expected].some(([path, data]) =>
      !actual.has(path) || digest(actual.get(path)) !== digest(data))) {
      return rejectCoverage("credit_plan_source_changed");
    }
  }
  const paths = input.publication.changes.map((change) => change.targetPath);
  if (new Set(paths).size !== paths.length ||
      paths.some((path) => !allowedPaths.has(path))) {
    return rejectCoverage("credit_plan_source_changed");
  }
};

/**
 * Rebuild governed evidence; policy cannot supply balances or lower the frozen
 * boundary. Credited carryover comes from the active bundle,
 * whose artifact/lineage must match the canonical rotation authority.
 * @param {object} input Same-transaction database and authoritative rotations.
 * @return {Promise<ShiftCreditPublicationSources>} Complete immutable sources.
 */
export const captureShiftCreditPublicationSources = async (input:
  ShiftCreditPlanningAccess & {
  rotations: {delivery: ShiftRotationAggregateWire;
    market: ShiftRotationAggregateWire};
  users?: readonly DocumentSnapshot[];
  prefixes: {delivery: RotationProjectionPrefix | null;
    market: RotationProjectionPrefix | null};
}): Promise<ShiftCreditPublicationSources> => {
  const environment = input.environment ?? "develop";
  const root = `${environment}/plus-collections`;
  const activationDigest = await requireShiftCreditPlanningAccess(input);
  const sources = (activationDigest ? {environment, activationDigest} : {}) as
    ShiftCreditPublicationSources;
  const publicPositionKeys: string[] = [];
  for (const type of ["delivery", "market"] as const) {
    const rotation = input.rotations[type];
    const ledger = await input.transaction.get(input.firestore.doc(
      `${root}/shiftCoverageLedgerState/${type}`));
    const collections = [];
    for (const name of ["shiftCoverageCredits", "shiftCoverageMemberClaims",
      "shifts"]) {
      const snapshot = await input.transaction.get(input.firestore
        .collection(`${root}/${name}`).where("type", "==", type).limit(1001));
      if (snapshot.size > 1000) return rejectCoverage("credit_source_limit");
      collections.push(snapshot.docs);
    }
    const [credits, claims, shifts] = collections;
    const rounds = shifts.flatMap((doc) => {
      const shift = parseShiftPlanningPublicShiftDocument({
        targetPath: doc.ref.path, value: doc.data()});
      publicPositionKeys.push(...publishedPositionKeys(shift));
      return shift.type === "delivery" ? [shift.roundNumber ?? 0] :
        shift.rotationPositions?.map((p) => p.roundNumber) ?? [];
    });
    const source: ShiftCreditPublicationSource = {
      ledger: ledger.exists ? ledger.data() as {revision: number} : null,
      credits: credits.map((doc) => {
        const credit = parseShiftCoverageCredit(doc.data());
        if (doc.id !== credit.id) {
          return rejectCoverage("invalid_coverage_credit");
        }
        return credit;
      }),
      claims: claims.map((doc) => ({id: doc.id, data: doc.data()})),
      frozenThroughRound: Math.max(
        rotation.cohortFrozen ? rotation.cursor.roundNumber : 0, ...rounds),
    };
    const prefix = input.prefixes[type];
    if (prefix && digest(consumeRotationPositions(prefix.rotationBeforePrefix,
      prefix.positions.length).nextRotation) !== digest(rotation.cursor)) {
      if (!rotation.activeRevision) {
        return rejectCoverage("credit_prefix_ledger_changed");
      }
      const bundleDoc = await input.transaction.get(input.firestore.doc(
        `${root}/shiftPlanningBundles/${rotation.activeRevision}`));
      const bundle = bundleDoc.data();
      if (!bundle || bundle.bundleRevision !== rotation.activeRevision ||
          bundle.bundleDigest !== rotation.activeDigest ||
          digest(bundle.artifact) !== bundle.artifactDigest) {
        return rejectCoverage("credit_prefix_ledger_changed");
      }
      const plan = bundle.artifact[type];
      if (!Array.isArray(plan?.shifts) ||
          !Array.isArray(plan.creditProjection?.units)) {
        return rejectCoverage("credit_prefix_ledger_changed");
      }
      source.inheritedUnits = prefix.dates.map((date) => {
        const index = plan.shifts.findIndex((shift: {date: string}) =>
          shift.date === date);
        const unit = plan.creditProjection?.units[index];
        if (!unit) return rejectCoverage("credit_prefix_ledger_changed");
        return unit.servedPositions;
      });
    }
    sources[type] = source;
  }
  const membership = await captureShiftMembershipPlanningSource(
    input.firestore, input.transaction, environment);
  await assertReconciledCandidates(input.firestore, input.transaction,
    new Set(membership.records.map((record) => record.id)), input, environment);
  if (membership.records.length || membership.reserves.length) {
    sources.membership = {...membership,
      publishedOwnerPositionKeys: [...new Set(publicPositionKeys)].sort()};
  }
  return parseShiftCreditPublicationSources(sources, environment);
};
