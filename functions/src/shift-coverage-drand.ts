import {createHash} from "node:crypto";
import {bls12_381 as bls} from "@noble/curves/bls12-381.js";
import {rejectCoverage} from "./shift-coverage.js";
import type {CoverageBeaconEvidence, CoverageDraw} from
  "./shift-coverage-draw.js";

// League of Entropy Quicknet. Genesis is the time of round 1, in milliseconds.
// https://docs.drand.love/developer/API-v1/drand-http-api/
export const DRAND_QUICKNET = Object.freeze({
  sourceId: "drand-quicknet",
  scheme: "bls-unchained-g1-rfc9380",
  chainHash: "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971",
  publicKeyHex: "83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911f" +
    "b90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d106451" +
    "0d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809" +
    "bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a",
  genesisMillis: 1692803367000,
  periodMillis: 3000,
} as const);

export type DrandCoveragePolicy = typeof DRAND_QUICKNET;
export const isDrandCoveragePolicy = (
  value: unknown,
): value is DrandCoveragePolicy => Boolean(value && typeof value === "object" &&
  Object.keys(value).length === Object.keys(DRAND_QUICKNET).length &&
  Object.entries(DRAND_QUICKNET).every(([key, expected]) =>
    (value as Record<string, unknown>)[key] === expected));

// Leave room for the Firestore commitment transaction to finish before reveal.
const leadMillis = 300_000;
export const nextDrandCoverageRound = (now: number): number =>
  1 + Math.ceil((now + leadMillis - DRAND_QUICKNET.genesisMillis) /
    DRAND_QUICKNET.periodMillis);

export const drandCoverageRoundTime = (round: number): number =>
  DRAND_QUICKNET.genesisMillis + (round - 1) * DRAND_QUICKNET.periodMillis;

export const verifyDrandCoverageSignature = (
  round: number, signatureHex: string, randomness: string,
): boolean => {
  const signature = Buffer.from(signatureHex, "hex");
  if (createHash("sha256").update(signature).digest("hex") !== randomness) {
    return false;
  }
  const roundBytes = Buffer.alloc(8);
  roundBytes.writeBigUInt64BE(BigInt(round));
  // Quicknet signs SHA256(uint64be(round)) on G1 under its RFC 9380 DST.
  const suite = bls.shortSignatures;
  const message = suite.hash(createHash("sha256").update(roundBytes).digest(),
    "BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_");
  try {
    return suite.verify(signature, message,
      Buffer.from(DRAND_QUICKNET.publicKeyHex, "hex"));
  } catch {
    return false;
  }
};

/**
 * Retrieve the exact committed round. Only the public chain and round go to the
 * relay. A drand v1 Quicknet response is under 250 bytes; cap the body even
 * when the server omits Content-Length. The timeout covers the body as well.
 * @param {CoverageDraw} draw Frozen source, round and availability.
 * @param {Function} fetcher HTTP transport.
 * @return {Promise<CoverageBeaconEvidence>} Verified, persistable evidence.
 */
export const fetchDrandCoverageEvidence = async (
  draw: Pick<CoverageDraw, "round" | "beacon" | "availableAtMillis">,
  fetcher: typeof fetch = fetch,
): Promise<CoverageBeaconEvidence> => {
  if (!isDrandCoveragePolicy(draw.beacon) ||
      !Number.isSafeInteger(draw.round) || draw.round < 1 ||
      !Number.isSafeInteger(draw.availableAtMillis) ||
      draw.availableAtMillis !== drandCoverageRoundTime(draw.round)) {
    return rejectCoverage("coverage_beacon_round_invalid");
  }
  const url = "https://api.drand.sh/" + DRAND_QUICKNET.chainHash +
    "/public/" + draw.round;
  let body = "";
  const maxBytes = 2048;
  try {
    const response = await fetcher(url, {
      redirect: "error", signal: AbortSignal.timeout(5000),
    });
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      return rejectCoverage("coverage_beacon_unavailable");
    }
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let bytes = 0;
    while (bytes <= maxBytes) {
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > maxBytes) {
        await reader.cancel();
        break;
      }
      chunks.push(Buffer.from(value));
    }
    if (bytes <= maxBytes) body = Buffer.concat(chunks).toString("utf8");
  } catch {
    return rejectCoverage("coverage_beacon_unavailable");
  }
  let wire: {round?: number; signature?: string; randomness?: string} | null;
  try {
    wire = JSON.parse(body);
  } catch {
    return rejectCoverage("coverage_beacon_evidence_invalid");
  }
  if (wire?.round !== draw.round || typeof wire.randomness !== "string" ||
      !/^[0-9a-f]{64}$/.test(wire.randomness) ||
      typeof wire.signature !== "string" ||
      !/^[0-9a-f]{96}$/.test(wire.signature)) {
    return rejectCoverage("coverage_beacon_evidence_invalid");
  }
  if (!verifyDrandCoverageSignature(draw.round, wire.signature,
    wire.randomness)) {
    return rejectCoverage("coverage_beacon_signature_invalid");
  }
  return {domain: "drand-quicknet-v1", sourceId: DRAND_QUICKNET.sourceId,
    round: draw.round, publishedAtMillis: draw.availableAtMillis,
    randomness: wire.randomness, signatureHex: wire.signature};
};
