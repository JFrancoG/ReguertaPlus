import {createPublicKey, verify} from "node:crypto";
import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";
import {coverageId, rejectCoverage} from "./shift-coverage.js";
import type {CoverageCandidate} from "./shift-coverage-selection.js";

/** Signed-beacon protocol exclusively for the local rehearsal. */
export type CoverageBeaconPolicy = {
  sourceId: string;
  publicKeyPem: string;
  genesisMillis: number;
  periodMillis: number;
};

export type CoverageDraw = {
  algorithm: "sha256-rank-v1";
  caseId: string;
  selectionDigest: string;
  assignmentContextDigest: string;
  candidates: CoverageCandidate[];
  committedAtMillis: number;
  beacon: CoverageBeaconPolicy;
  round: number;
  availableAtMillis: number;
  commitmentDigest: string;
  evidence: CoverageBeaconEvidence | null;
  order: string[] | null;
};

export type CoverageBeaconEvidence = {
  domain: "hu084-local-beacon-v1";
  sourceId: string;
  round: number;
  publishedAtMillis: number;
  randomness: string;
  signatureHex: string;
};

export const parseCoverageBeaconPolicy = (
  value: CoverageBeaconPolicy | undefined,
): CoverageBeaconPolicy => {
  if (!value || !Number.isSafeInteger(value.genesisMillis) ||
      value.genesisMillis < 0 || !Number.isSafeInteger(value.periodMillis) ||
      value.periodMillis <= 0 || typeof value.publicKeyPem !== "string") {
    return rejectCoverage("coverage_beacon_policy_required");
  }
  let publicKeyPem: string;
  try {
    const key = createPublicKey(value.publicKeyPem);
    if (key.asymmetricKeyType !== "ed25519") {
      return rejectCoverage("coverage_beacon_policy_required");
    }
    publicKeyPem = key.export({format: "pem", type: "spki"}).toString();
  } catch {
    return rejectCoverage("coverage_beacon_policy_required");
  }
  return {sourceId: coverageId(value.sourceId), publicKeyPem,
    genesisMillis: value.genesisMillis, periodMillis: value.periodMillis};
};

/**
 * Fixes a future round with at least one full beacon period of lead time.
 * The caller supplies no round/seed. The commitment binds all draw inputs.
 * @param {object} input Transactionally frozen candidates and trusted policy.
 * @return {CoverageDraw} Commitment with no result until authenticated reveal.
 */
export const commitCoverageDraw = (input: {
  caseId: string;
  selectionDigest: string;
  assignmentContextDigest: string;
  candidates: CoverageCandidate[];
  policy: CoverageBeaconPolicy | undefined;
  now: number;
}): CoverageDraw => {
  const beacon = parseCoverageBeaconPolicy(input.policy);
  const round = Math.floor((input.now - beacon.genesisMillis) /
    beacon.periodMillis) + 2;
  const availableAtMillis = beacon.genesisMillis + round * beacon.periodMillis;
  if (input.now < beacon.genesisMillis || !Number.isSafeInteger(round) ||
      !Number.isSafeInteger(availableAtMillis) ||
      availableAtMillis <= input.now) {
    return rejectCoverage("coverage_beacon_round_invalid");
  }
  const candidates = structuredClone(input.candidates)
    .sort((a, b) => a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0);
  const uniqueIds = new Set(candidates.map((item) => item.userId));
  if (uniqueIds.size !== candidates.length) {
    return rejectCoverage("coverage_draw_duplicate_candidate");
  }
  const commitment = {algorithm: "sha256-rank-v1" as const,
    caseId: input.caseId, selectionDigest: input.selectionDigest,
    assignmentContextDigest: input.assignmentContextDigest,
    candidates, beacon, round, availableAtMillis, committedAtMillis: input.now};
  return {...commitment, commitmentDigest: digest(commitment),
    evidence: null, order: null};
};

/**
 * Verify the fixed source, round, publication time and Ed25519 signature before
 * deriving one ordering. The local issuer remains a trust assumption. A
 * signature authenticates it but does not prove unbiased/unpredictable entropy.
 * @param {object} input Stored commitment and backend-only beacon evidence.
 * @return {CoverageDraw} Result retaining the complete signed evidence.
 */
export const revealCoverageDraw = (input: {
  draw: CoverageDraw;
  value: unknown;
  now: number;
}): CoverageDraw => {
  const {evidence: oldEvidence, order, commitmentDigest, ...commitment} =
    input.draw;
  if (oldEvidence || order || commitmentDigest !== digest(commitment)) {
    return rejectCoverage("coverage_draw_already_revealed_or_changed");
  }
  if (input.now < commitment.availableAtMillis) {
    return rejectCoverage("coverage_entropy_not_available");
  }
  const value = input.value as CoverageBeaconEvidence | undefined;
  if (!value || value.domain !== "hu084-local-beacon-v1" ||
      value.sourceId !== commitment.beacon.sourceId ||
      value.round !== commitment.round ||
      value.publishedAtMillis !== commitment.availableAtMillis ||
      typeof value.randomness !== "string" ||
      !/^[0-9a-f]{64}$/.test(value.randomness) ||
      typeof value.signatureHex !== "string" ||
      !/^[0-9a-f]{128}$/.test(value.signatureHex)) {
    return rejectCoverage("coverage_beacon_evidence_invalid");
  }
  const payload = {domain: value.domain, sourceId: value.sourceId,
    round: value.round, publishedAtMillis: value.publishedAtMillis,
    randomness: value.randomness};
  if (!verify(null, Buffer.from(digest(payload)),
    createPublicKey(commitment.beacon.publicKeyPem),
    Buffer.from(value.signatureHex, "hex"))) {
    return rejectCoverage("coverage_beacon_signature_invalid");
  }
  const scores = commitment.candidates.filter((item) => !item.exclusion)
    .map((item) => ({userId: item.userId,
      score: digest({domain: "hu084-draw-sha256-rank-v1", commitmentDigest,
        randomness: value.randomness, userId: item.userId})}))
    .sort((a, b) => a.score < b.score ? -1 : a.score > b.score ? 1 :
      a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0);
  return {...input.draw,
    evidence: {...payload, signatureHex: value.signatureHex},
    order: scores.map((item) => item.userId)};
};
