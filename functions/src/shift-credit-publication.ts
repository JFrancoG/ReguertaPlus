import {assertShiftMembershipPlanningSource,
  captureShiftMembershipPlanningSource, parseShiftMembershipPlanningSource,
  ShiftMembershipPlanningSource, ShiftMembershipPlanningChange} from
  "./shift-membership-planning.js";
import {assertNoPendingShiftMembership} from
  "./shift-membership-reconciliation.js";
import {consumeRotationPositions, RotationProjectionPrefix} from
  "./shift-planning-contract.js";
import {ShiftRotationAggregateWire} from "./shift-planning-wire.js";
import {parseShiftPlanningPublicShiftDocument} from
  "./shift-planning-publication-contract.js";
import {Firestore, Transaction} from "@google-cloud/firestore";
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
  delivery: ShiftCreditPublicationSource;
  market: ShiftCreditPublicationSource;
  membership?: ShiftMembershipPlanningSource;
};
export type ShiftCreditPublication = {
  policyRevision: typeof SHIFT_COVERAGE_POLICY_REVISION;
  planId: string;
  sources: ShiftCreditPublicationSources;
  changes: {targetPath: string; before: Data; after: Data}[];
};
const root = "develop/plus-collections";
const provisionalDatabases = new WeakSet<Firestore>();

export const createProvisionalCreditFirestore = (): Firestore => {
  requireProvisionalCreditPublication("develop");
  const db = new Firestore({projectId: "demo-reguerta-hu084-coverage",
    host: "127.0.0.1:8798", ssl: false});
  provisionalDatabases.add(db);
  return db;
};
/**
 * Local membership transitions also fence ordinary (credit-disabled) plans.
 * Live and legacy test clients keep their existing authority contract.
 * @param {object} input Transaction and its registered emulator client.
 */
export const assertProvisionalShiftMembershipSource = async (input: {
  firestore: Firestore; transaction: Transaction;
}) => {
  if (provisionalDatabases.has(input.firestore)) {
    await assertNoPendingShiftMembership(input.firestore, input.transaction);
  }
};

const claimId = (type: string, id: string) => digest([type, id])
  .slice("shift-planning:v1:sha256:".length);

export const requireProvisionalCreditPublication = (environment: string) => {
  if (environment !== "develop" ||
      process.env.GCLOUD_PROJECT !== "demo-reguerta-hu084-coverage" ||
      process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8798") {
    return rejectCoverage("coverage_provisional_emulator_required");
  }
};

export const parseShiftCreditPublicationSources = (
  value: unknown,
  environment: string,
): ShiftCreditPublicationSources => {
  requireProvisionalCreditPublication(environment);
  const sources = value as ShiftCreditPublicationSources;
  if (!sources || !["delivery,market", "delivery,market,membership"].includes(
    Object.keys(sources).sort().join())) {
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
          credit.state === "consumed" && credit.id === data.caseId &&
          credit.userId === data.userId &&
          credit.consumedByPlanId === data.consumedByPlanId &&
          credit.consumedAtMillis === data.consumedAtMillis)) {
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
  return !!claim && claim.state === "released" &&
    Object.keys(claim).sort().join() ===
      "caseId,consumedAtMillis,consumedByPlanId,state,type,userId" &&
    ["delivery", "market"].includes(String(claim.type)) &&
    [claim.caseId, claim.userId, claim.consumedByPlanId].every((id) =>
      typeof id === "string" &&
      /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id)) &&
    Number.isSafeInteger(claim.consumedAtMillis) &&
    (claim.consumedAtMillis as number) >= 0;
};

export const buildShiftCreditPublication = (input: {
  sources: ShiftCreditPublicationSources;
  delivery: ShiftSeasonCreditProjection;
  market: ShiftSeasonCreditProjection;
  planId: string;
  membershipChanges?: ShiftMembershipPlanningChange[];
}): ShiftCreditPublication => {
  coverageId(input.planId);
  const changes: ShiftCreditPublication["changes"] =
    [...input.membershipChanges ?? []];
  for (const type of ["delivery", "market"] as const) {
    const source = input.sources[type];
    const projection = input[type];
    for (const id of projection.consumedCreditIds) {
      const credit = source.credits.find((item) => item.id === id);
      const claim = source.claims.find((item) => item.data.caseId === id &&
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
  return {policyRevision: SHIFT_COVERAGE_POLICY_REVISION, planId: input.planId,
    sources: input.sources, changes};
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
export const assertShiftCreditPublicationSource = async (input: {
  firestore: Firestore;
  transaction: Transaction;
  publication: ShiftCreditPublication;
  activatedAtMillis?: number;
}) => {
  requireProvisionalCreditPublication("develop");
  if (!provisionalDatabases.has(input.firestore)) {
    return rejectCoverage("coverage_provisional_emulator_required");
  }
  await assertShiftMembershipPlanningSource({...input,
    source: input.publication.sources.membership,
    activatedChanges: input.activatedAtMillis === undefined ? undefined :
      input.publication.changes});
  for (const type of ["delivery", "market"] as const) {
    const source = input.publication.sources[type];
    const expected = new Map<string, unknown>([
      [`${root}/shiftCoverageLedgerState/${type}`, source.ledger],
      ...source.credits.map((credit): [string, ShiftCoverageCredit] =>
        [`${root}/shiftCoverageCredits/${credit.id}`, credit]),
      ...source.claims.map((claim): [string, Data] =>
        [`${root}/shiftCoverageMemberClaims/${claim.id}`, claim.data]),
    ]);
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
};

/**
 * Rebuild governed evidence; policy cannot supply balances or lower the frozen
 * boundary. Credited carryover comes from the active bundle,
 * whose artifact/lineage must match the canonical rotation authority.
 * @param {object} input Same-transaction database and authoritative rotations.
 * @return {Promise<ShiftCreditPublicationSources>} Complete immutable sources.
 */
export const captureShiftCreditPublicationSources = async (input: {
  firestore: Firestore;
  transaction: Transaction;
  rotations: {delivery: ShiftRotationAggregateWire;
    market: ShiftRotationAggregateWire};
  prefixes: {delivery: RotationProjectionPrefix | null;
    market: RotationProjectionPrefix | null};
}): Promise<ShiftCreditPublicationSources> => {
  requireProvisionalCreditPublication("develop");
  if (!provisionalDatabases.has(input.firestore)) {
    return rejectCoverage("coverage_provisional_emulator_required");
  }
  const sources = {} as ShiftCreditPublicationSources;
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
    input.firestore, input.transaction);
  if (membership.records.length || membership.reserves.length) {
    sources.membership = membership;
  }
  return parseShiftCreditPublicationSources(sources, "develop");
};
